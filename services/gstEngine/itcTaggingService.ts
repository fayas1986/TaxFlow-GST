import { Invoice, InvoiceItem } from '../../types';
import { GSTRuleEngine } from './ruleEngine';

export interface ITCEligibilityResult {
  isEligible: boolean;
  eligibilityTag: 'Input Tax Credit Eligible' | 'Input Tax Credit Non-Eligible' | 'N/A (Sales Supply)';
  blockedCategory?: string;
  reason: string;
  statutoryClause: string;
  recommendedTags: string[];
  eligibleItcAmount: number;
  blockedItcAmount: number;
  confidenceScore: number; // 0-100%
  itemBreakdown: {
    itemId?: string;
    description: string;
    isItemBlocked: boolean;
    ruleMatched?: string;
    blockedAmount: number;
    eligibleAmount: number;
  }[];
}

export interface ITCTaggingSummary {
  totalInvoices: number;
  purchaseInvoices: number;
  eligibleCount: number;
  nonEligibleCount: number;
  totalPurchaseTax: number;
  eligibleItcTax: number;
  blockedItcTax: number;
  blockedCategoryCounts: Record<string, number>;
}

/**
 * Automated Statutory ITC Tagging & Classification Engine
 * Evaluates invoices against CGST Act 2017 Sections 16, 17(5), 9(3), and statutory rules.
 */
export class ITCTaggingService {
  /**
   * Evaluates a single invoice and computes statutory ITC eligibility
   */
  public static classifyInvoiceITC(invoice: Invoice): ITCEligibilityResult {
    // 1. Sales invoices generate Output Tax Liability, not ITC
    if (invoice.category === 'SALES') {
      return {
        isEligible: false,
        eligibilityTag: 'N/A (Sales Supply)',
        reason: 'Outward sales transactions create tax liability and do not carry Input Tax Credit.',
        statutoryClause: 'CGST Act Section 9(1) - Output Tax Liability',
        recommendedTags: ['Output Tax Liability', 'Outward Supply'],
        eligibleItcAmount: 0,
        blockedItcAmount: 0,
        confidenceScore: 100,
        itemBreakdown: []
      };
    }

    const items = invoice.items || [];
    const itemBreakdown: ITCEligibilityResult['itemBreakdown'] = [];
    let blockedItemTax = 0;
    let eligibleItemTax = 0;
    const itemBlockedReasons: string[] = [];

    // Helper keyword matchers
    const hasWord = (text: string, words: string[]) => {
      const lower = text.toLowerCase();
      return words.some(w => lower.includes(w));
    };

    // 2. Global Invoice-level Header Checks
    // Check A: Vendor GSTIN structural validity (Section 16(2)(a))
    if (invoice.type === 'B2B' && invoice.gstin) {
      if (!GSTRuleEngine.validateGSTIN(invoice.gstin)) {
        return {
          isEligible: false,
          eligibilityTag: 'Input Tax Credit Non-Eligible',
          blockedCategory: 'Invalid Supplier GSTIN',
          reason: `Supplier GSTIN "${invoice.gstin}" fails 15-digit statutory checksum validation under Section 16(2)(a).`,
          statutoryClause: 'CGST Act Section 16(2)(a) - Valid Invoice & GSTIN Requirement',
          recommendedTags: ['Input Tax Credit Non-Eligible', 'Section 16 Ineligible', 'Invalid Supplier GSTIN'],
          eligibleItcAmount: 0,
          blockedItcAmount: invoice.taxAmount,
          confidenceScore: 98,
          itemBreakdown: []
        };
      }
    } else if (invoice.type === 'B2B' && !invoice.gstin && !invoice.isImport) {
      return {
        isEligible: false,
        eligibilityTag: 'Input Tax Credit Non-Eligible',
        blockedCategory: 'Unregistered Supplier / Missing GSTIN',
        reason: 'B2B purchase invoice lacks supplier GSTIN registration credential mandatory under Section 16(2).',
        statutoryClause: 'CGST Act Section 16(2) - Tax Invoice Requirement',
        recommendedTags: ['Input Tax Credit Non-Eligible', 'Section 16 Ineligible', 'Unregistered Supplier'],
        eligibleItcAmount: 0,
        blockedItcAmount: invoice.taxAmount,
        confidenceScore: 95,
        itemBreakdown: []
      };
    }

    // Check B: Explicitly flagged as blocked ITC during manual entry
    if (invoice.isBlockedItc && invoice.reasonForBlocked) {
      return {
        isEligible: false,
        eligibilityTag: 'Input Tax Credit Non-Eligible',
        blockedCategory: 'Section 17(5) Blocked Credit',
        reason: invoice.reasonForBlocked,
        statutoryClause: 'CGST Act Section 17(5) - Ineligible Credit',
        recommendedTags: ['Input Tax Credit Non-Eligible', 'Section 17(5) Blocked'],
        eligibleItcAmount: 0,
        blockedItcAmount: invoice.taxAmount,
        confidenceScore: 100,
        itemBreakdown: []
      };
    }

    // 3. Line-Item Level Statutory Audit against Section 17(5) Clauses
    items.forEach((item) => {
      const desc = (item.description || '').toLowerCase();
      const hsn = (item.hsnSac || '').trim();
      const itemTax = item.taxAmount || 0;

      let isBlocked = false;
      let matchedClause = '';

      // Clause A: Motor Vehicles, Cab Hire, Passenger Transport (Section 17(5)(a))
      // HSN 8702, 8703, 8711, 8802 or keywords
      const motorVehicleKeywords = ['car hire', 'cab', 'cab aggregator', 'uber', 'ola', 'vehicle rent', 'motor vehicle', 'luxury sedan', 'car lease', 'car maintenance', 'car repair', 'auto insurance'];
      if (hsn.startsWith('8702') || hsn.startsWith('8703') || hsn.startsWith('8711') || hasWord(desc, motorVehicleKeywords)) {
        isBlocked = true;
        matchedClause = 'Section 17(5)(a) - Motor Vehicles & Passenger Transport';
      }

      // Clause B: Food & Beverages, Outdoor Catering, Beauty, Health Services (Section 17(5)(b)(i))
      // HSN 9963, 9997 or keywords
      const foodBeverageKeywords = ['food', 'beverage', 'catering', 'outdoor catering', 'restaurant', 'dining', 'lunch', 'dinner', 'snacks', 'pantry', 'beauty treatment', 'cosmetic', 'plastic surgery', 'spa', 'salon', 'hair styling'];
      if (!isBlocked && (hsn.startsWith('9963') || hasWord(desc, foodBeverageKeywords))) {
        isBlocked = true;
        matchedClause = 'Section 17(5)(b)(i) - Food, Beverages & Personal Grooming';
      }

      // Clause C: Club Membership, Health & Fitness Centre (Section 17(5)(b)(ii))
      const clubKeywords = ['club membership', 'gym membership', 'fitness center', 'health club', 'golf club'];
      if (!isBlocked && hasWord(desc, clubKeywords)) {
        isBlocked = true;
        matchedClause = 'Section 17(5)(b)(ii) - Club & Fitness Membership';
      }

      // Clause D: Travel Benefits to Employees on Vacation (Section 17(5)(b)(iii))
      const vacationKeywords = ['leave travel concession', 'ltc', 'vacation travel', 'employee excursion', 'holiday tour package'];
      if (!isBlocked && hasWord(desc, vacationKeywords)) {
        isBlocked = true;
        matchedClause = 'Section 17(5)(b)(iii) - Employee Vacation Travel Benefits';
      }

      // Clause E: Voluntary Life & Health Insurance (Section 17(5)(b)(iii))
      const insuranceKeywords = ['life insurance', 'health insurance', 'mediclaim', 'personal accident insurance'];
      if (!isBlocked && hasWord(desc, insuranceKeywords)) {
        isBlocked = true;
        matchedClause = 'Section 17(5)(b)(iii) - Life & Health Insurance';
      }

      // Clause F: Works Contract & Civil Construction of Immovable Property (Section 17(5)(c) & (d))
      // HSN 9954 or keywords
      const constructionKeywords = ['building construction', 'civil works', 'works contract for building', 'office interior construction', 'immovable property construction', 'architectural civil construction'];
      if (!isBlocked && (hsn.startsWith('9954') || hasWord(desc, constructionKeywords))) {
        isBlocked = true;
        matchedClause = 'Section 17(5)(c/d) - Immovable Property Construction';
      }

      // Clause G: Personal Consumption / Gifts / Samples (Section 17(5)(g) & (h))
      const personalGiftKeywords = ['personal use', 'personal consumption', 'gift item', 'free sample', 'stolen inventory', 'goods written off'];
      if (!isBlocked && hasWord(desc, personalGiftKeywords)) {
        isBlocked = true;
        matchedClause = 'Section 17(5)(g/h) - Personal Consumption / Gift / Lost Goods';
      }

      if (isBlocked) {
        blockedItemTax += itemTax;
        itemBlockedReasons.push(`${item.description} (${matchedClause})`);
        itemBreakdown.push({
          itemId: item.id,
          description: item.description,
          isItemBlocked: true,
          ruleMatched: matchedClause,
          blockedAmount: itemTax,
          eligibleAmount: 0
        });
      } else {
        eligibleItemTax += itemTax;
        itemBreakdown.push({
          itemId: item.id,
          description: item.description,
          isItemBlocked: false,
          blockedAmount: 0,
          eligibleAmount: itemTax
        });
      }
    });

    // 4. Also check Invoice Party Name / Vendor Description if items were empty or clean
    const partyName = (invoice.partyName || '').toLowerCase();
    let headerBlockedReason = '';
    let headerClause = '';

    if (hasWord(partyName, ['catering', 'restaurant', 'food', 'hotel', 'spa', 'gym', 'resort', 'cab service', 'car rental'])) {
      if (hasWord(partyName, ['catering', 'restaurant', 'food', 'dining'])) {
        headerBlockedReason = 'Vendor is categorized under Food & Outdoor Catering (Sec 17(5)(b))';
        headerClause = 'Section 17(5)(b)(i)';
      } else if (hasWord(partyName, ['cab service', 'car rental', 'car hire'])) {
        headerBlockedReason = 'Vendor categorized under Passenger Vehicle Rental (Sec 17(5)(a))';
        headerClause = 'Section 17(5)(a)';
      } else if (hasWord(partyName, ['gym', 'spa', 'resort'])) {
        headerBlockedReason = 'Vendor categorized under Personal Grooming / Health Club (Sec 17(5)(b))';
        headerClause = 'Section 17(5)(b)';
      }
    }

    // Combine results
    const totalBlockedTax = blockedItemTax > 0 ? blockedItemTax : (headerBlockedReason ? invoice.taxAmount : 0);
    const totalEligibleTax = invoice.taxAmount - totalBlockedTax;

    if (totalBlockedTax > 0) {
      const isFullyBlocked = totalBlockedTax >= invoice.taxAmount - 1;
      const primaryClause = headerClause || itemBlockedReasons[0] || 'CGST Act Section 17(5)';
      const reasonText = headerBlockedReason || `Ineligible ITC detected on line items: ${itemBlockedReasons.join(', ')}`;

      const tags: string[] = ['Input Tax Credit Non-Eligible', 'Section 17(5) Blocked'];
      if (headerClause.includes('17(5)(b)') || itemBlockedReasons.some(r => r.includes('17(5)(b)'))) {
        tags.push('Food & Beverages');
      }
      if (headerClause.includes('17(5)(a)') || itemBlockedReasons.some(r => r.includes('17(5)(a)'))) {
        tags.push('Motor Vehicle / Transport');
      }
      if (itemBlockedReasons.some(r => r.includes('17(5)(c)'))) {
        tags.push('Works Contract');
      }

      return {
        isEligible: !isFullyBlocked,
        eligibilityTag: 'Input Tax Credit Non-Eligible',
        blockedCategory: headerClause || 'Section 17(5) Ineligible Credit',
        reason: reasonText,
        statutoryClause: primaryClause,
        recommendedTags: tags,
        eligibleItcAmount: Math.max(0, totalEligibleTax),
        blockedItcAmount: totalBlockedTax,
        confidenceScore: 95,
        itemBreakdown
      };
    }

    // 5. Special RCM Note (Eligible after cash payment)
    if (invoice.isRcm) {
      return {
        isEligible: true,
        eligibilityTag: 'Input Tax Credit Eligible',
        reason: 'Section 9(3) Reverse Charge supply. ITC is available in Electronic Credit Ledger immediately following cash payment in Electronic Cash Ledger.',
        statutoryClause: 'CGST Act Section 9(3) / Section 16(2) - RCM Cash Discharge',
        recommendedTags: ['Input Tax Credit Eligible', 'RCM Credit Available', 'Sec 9(3) Cash First'],
        eligibleItcAmount: invoice.taxAmount,
        blockedItcAmount: 0,
        confidenceScore: 92,
        itemBreakdown
      };
    }

    // 6. Default Fully Eligible Business Inward Supply (Section 16(1))
    return {
      isEligible: true,
      eligibilityTag: 'Input Tax Credit Eligible',
      reason: 'Complies fully with Section 16(1) & 16(2) conditions: Valid business input, valid GSTIN invoice, and no Section 17(5) restrictions.',
      statutoryClause: 'CGST Act Section 16(1) - Eligible Business Input/Service',
      recommendedTags: ['Input Tax Credit Eligible', 'Section 16 Compliant'],
      eligibleItcAmount: invoice.taxAmount,
      blockedItcAmount: 0,
      confidenceScore: 96,
      itemBreakdown
    };
  }

  /**
   * Enriches an Invoice object with statutory ITC tags and blocked flags
   */
  public static tagSingleInvoice(invoice: Invoice): Invoice {
    if (typeof window !== 'undefined') {
      const isEnabled = localStorage.getItem('TF_ITC_AUTO_TAGGING_ENABLED') !== 'false';
      if (!isEnabled) {
        return invoice;
      }
    }

    const classification = this.classifyInvoiceITC(invoice);

    if (invoice.category === 'SALES') {
      return invoice;
    }

    const currentTags = invoice.tags || [];
    // Remove stale eligibility tags
    const filteredTags = currentTags.filter(t => 
      t !== 'Input Tax Credit Eligible' && 
      t !== 'Input Tax Credit Non-Eligible' && 
      t !== 'ITC Eligible' && 
      t !== 'ITC Non-Eligible' &&
      t !== 'Section 17(5) Blocked'
    );

    const updatedTags = Array.from(new Set([...filteredTags, ...classification.recommendedTags]));

    return {
      ...invoice,
      isBlockedItc: !classification.isEligible,
      reasonForBlocked: !classification.isEligible ? classification.reason : undefined,
      tags: updatedTags
    };
  }

  /**
   * Runs automated statutory ITC tagging across a batch of invoices
   */
  public static tagBatchInvoices(invoices: Invoice[]): {
    updatedInvoices: Invoice[];
    summary: ITCTaggingSummary;
  } {
    let purchaseCount = 0;
    let eligibleCount = 0;
    let nonEligibleCount = 0;
    let totalPurchaseTax = 0;
    let eligibleItcTax = 0;
    let blockedItcTax = 0;
    const blockedCategoryCounts: Record<string, number> = {};

    const updatedInvoices = invoices.map(inv => {
      const tagged = this.tagSingleInvoice(inv);
      if (inv.category === 'PURCHASE') {
        purchaseCount++;
        totalPurchaseTax += inv.taxAmount;
        const res = this.classifyInvoiceITC(inv);

        if (res.isEligible) {
          eligibleCount++;
          eligibleItcTax += res.eligibleItcAmount;
        } else {
          nonEligibleCount++;
          blockedItcTax += res.blockedItcAmount;
          const cat = res.blockedCategory || 'Section 17(5) General';
          blockedCategoryCounts[cat] = (blockedCategoryCounts[cat] || 0) + 1;
        }
      }
      return tagged;
    });

    return {
      updatedInvoices,
      summary: {
        totalInvoices: invoices.length,
        purchaseInvoices: purchaseCount,
        eligibleCount,
        nonEligibleCount,
        totalPurchaseTax,
        eligibleItcTax,
        blockedItcTax,
        blockedCategoryCounts
      }
    };
  }
}
