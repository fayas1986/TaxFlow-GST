import { Invoice, InvoiceItem, TaxBreakdown } from '../../types';

/**
 * GST State Code Helpers & Union Territory Checkers
 */
export const UNION_TERRITORIES = new Set([
  '04', // Chandigarh
  '26', // Dadra and Nagar Haveli and Daman and Diu
  '31', // Lakshadweep
  '35', // Andaman and Nicobar Islands
  '38', // Ladakh
]);

/**
 * Checks if a state code belongs to a Union Territory
 */
export const isUnionTerritory = (stateCode: string): boolean => {
  return UNION_TERRITORIES.has(stateCode);
};

export interface StatutoryRateTier {
  rate: number;
  label: string;
  category: string;
  description: string;
  examples: string[];
  color: string;
}

export const STATUTORY_SCHEDULES: StatutoryRateTier[] = [
  {
    rate: 0,
    label: 'Nil / Exempt / Zero-Rated',
    category: 'Essential Fresh Produce & Exports',
    description: 'Fresh vegetables, unbranded grains, milk, healthcare, education, and zero-rated exports under LUT.',
    examples: ['Unbranded Rice/Wheat (HSN 1006)', 'Fresh Vegetables & Milk (HSN 0401)', 'LUT Exports (SAC 9983)'],
    color: 'bg-emerald-50 text-emerald-800 border-emerald-200'
  },
  {
    rate: 0.1,
    label: '0.1% Merchant Export',
    category: 'Concessional Export Supplies',
    description: 'Concessional GST rate for supplies to registered merchant exporters (Notification 40/2017).',
    examples: ['Supplies to Merchant Exporter for Export'],
    color: 'bg-teal-50 text-teal-800 border-teal-200'
  },
  {
    rate: 0.25,
    label: '0.25% Rough Precious Stones',
    category: 'Diamonds & Precious Stones',
    description: 'Cut & polished diamonds, precious and semi-precious stones.',
    examples: ['Unworked or Simply Sawn Diamonds (HSN 7102)'],
    color: 'bg-cyan-50 text-cyan-800 border-cyan-200'
  },
  {
    rate: 1,
    label: '1% Composition Scheme',
    category: 'Small Traders & Manufacturers',
    description: 'Concessional flat rate for turnover under ₹1.5 Cr under Section 10 Composition Scheme.',
    examples: ['Composition Manufacturers & Traders (0.5% CGST + 0.5% SGST)'],
    color: 'bg-blue-50 text-blue-800 border-blue-200'
  },
  {
    rate: 3,
    label: '3% Precious Metals & Jewelry',
    category: 'Gold, Silver & Platinum',
    description: 'Gold, silver, platinum bars, coins, and articles of jewelry.',
    examples: ['Gold Jewelry (HSN 7113)', 'Silver Articles (HSN 7106)'],
    color: 'bg-amber-50 text-amber-800 border-amber-200'
  },
  {
    rate: 5,
    label: '5% Essential Goods & Services',
    category: 'Essentials, Low-tier Apparel, Transport',
    description: 'Packaged food items, apparel/footwear <= ₹1,000, GTA transport, restaurants without liquor.',
    examples: ['Branded Packaged Rice/Sugar (HSN 1701)', 'Apparel <= ₹1,000 (HSN 6109)', 'Transport Services (SAC 9964)'],
    color: 'bg-indigo-50 text-indigo-800 border-indigo-200'
  },
  {
    rate: 6,
    label: '6% Composition Bricks / Real Estate',
    category: 'Building Materials / Special Scheme',
    description: 'Special composition rate for brick kilns without ITC benefit.',
    examples: ['Building Bricks & Roofing Tiles (HSN 6901)'],
    color: 'bg-purple-50 text-purple-800 border-purple-200'
  },
  {
    rate: 12,
    label: '12% Standard Lower Tier',
    category: 'Processed Food, High-tier Apparel, Medical',
    description: 'Processed food, medical equipment, apparel/footwear > ₹1,000, works contracts.',
    examples: ['Medicaments & Pharma (HSN 3004)', 'Apparel > ₹1,000 (HSN 6201)', 'Construction Works Contract (SAC 9954)'],
    color: 'bg-violet-50 text-violet-800 border-violet-200'
  },
  {
    rate: 18,
    label: '18% Standard Upper Tier',
    category: 'Capital Goods, IT, Banking, Consultancy',
    description: 'Standard default rate for services, IT software, electronics, capital machinery, and industrial supplies.',
    examples: ['IT Consultancy (SAC 9983)', 'Smartphones & Electronics (HSN 8517)', 'Banking Services (SAC 9971)'],
    color: 'bg-rose-50 text-rose-800 border-rose-200'
  },
  {
    rate: 28,
    label: '28% Luxury & Demerit Tier',
    category: 'Automobiles, Aerated Drinks, Gaming',
    description: 'Luxury goods, automobiles, motorcycles, aerated beverages, online gaming, and demerit products.',
    examples: ['Motor Cars (HSN 8703)', 'Aerated Drinks (HSN 2202)', 'Online Gaming & Casinos'],
    color: 'bg-red-50 text-red-900 border-red-300'
  }
];

export interface ValueThresholdRule {
  hsnPrefix: string;
  categoryName: string;
  thresholdAmount: number;
  belowRate: number;
  aboveRate: number;
  note: string;
}

export const THRESHOLD_RULES: ValueThresholdRule[] = [
  {
    hsnPrefix: '61',
    categoryName: 'Knitted Apparel & Clothing',
    thresholdAmount: 1000,
    belowRate: 5,
    aboveRate: 12,
    note: 'Apparel with sale value up to ₹1,000 per piece attracts 5% GST; above ₹1,000 attracts 12% GST.'
  },
  {
    hsnPrefix: '62',
    categoryName: 'Woven Apparel & Garments',
    thresholdAmount: 1000,
    belowRate: 5,
    aboveRate: 12,
    note: 'Garments priced up to ₹1,000 per piece attract 5% GST; above ₹1,000 attract 12% GST.'
  },
  {
    hsnPrefix: '64',
    categoryName: 'Footwear',
    thresholdAmount: 1000,
    belowRate: 5,
    aboveRate: 12,
    note: 'Footwear with sale value up to ₹1,000 per pair attracts 5% GST; above ₹1,000 attracts 12% GST.'
  },
  {
    hsnPrefix: '9963',
    categoryName: 'Hotel Accommodation Tariff',
    thresholdAmount: 7500,
    belowRate: 12,
    aboveRate: 18,
    note: 'Hotel rooms with tariff up to ₹7,500/day attract 12% GST; above ₹7,500/day attract 18% GST.'
  }
];

export interface CessScheduleRule {
  category: string;
  hsnSac: string;
  adValoremRate: number; // percentage e.g. 15 for 15%
  specificRatePerUnit?: number; // e.g. 4170 per 1000 sticks
  unitLabel?: string;
  description: string;
}

export const CESS_SCHEDULES: CessScheduleRule[] = [
  { category: 'Motor Vehicles (SUV)', hsnSac: '8703', adValoremRate: 22, description: 'SUVs & Luxury Motor Vehicles (> 1500 cc)' },
  { category: 'Mid-size Cars', hsnSac: '8703', adValoremRate: 15, description: 'Mid-sized Cars (1200cc - 1500cc)' },
  { category: 'Small Petrol Cars', hsnSac: '8703', adValoremRate: 1, description: 'Small Petrol / CNG Cars (< 1200cc)' },
  { category: 'Aerated Drinks & Water', hsnSac: '2202', adValoremRate: 12, description: 'Aerated Waters containing added sugar or flavor' },
  { category: 'Cigarettes & Tobacco', hsnSac: '2402', adValoremRate: 5, specificRatePerUnit: 4.17, unitLabel: 'stick', description: '5% Ad Valorem + ₹4,170 per 1000 sticks' },
  { category: 'Coal, Lignite & Peat', hsnSac: '2701', adValoremRate: 0, specificRatePerUnit: 400, unitLabel: 'tonne', description: 'GST Compensation Cess of ₹400 per Metric Tonne' }
];

export interface LineItemTaxCalculation {
  taxableValue: number;
  applicableRate: number;
  isThresholdApplied: boolean;
  effectiveRateNote?: string;
  cgstRate: number;
  sgstRate: number;
  utgstRate: number;
  igstRate: number;
  cgst: number;
  sgst: number;
  utgst: number;
  igst: number;
  adValoremCess: number;
  specificCess: number;
  totalCess: number;
  totalTax: number;
  totalInvoiceAmount: number;
}

export interface StatutoryLiabilityComputationResult {
  period: string;
  grossOutputTax: TaxBreakdown;
  rateTierBreakdown: Array<{
    rate: number;
    label: string;
    taxableValue: number;
    taxAmount: number;
  }>;
  rcmLiability: TaxBreakdown & { cashPayableMandatory: number };
  eligibleInputTaxCredit: TaxBreakdown;
  ineligibleBlockedItc: number; // Section 17(5)
  rule42ReversalItc: number; // Exempt supply reversal
  netAvailableItc: TaxBreakdown;
  setOffMatrix: {
    igst_igst: number;
    igst_cgst: number;
    igst_sgst: number;
    cgst_cgst: number;
    cgst_igst: number;
    sgst_sgst: number;
    sgst_igst: number;
    totalSetOffIgst: number;
    totalSetOffCgst: number;
    totalSetOffSgst: number;
    grandTotalSetOff: number;
  };
  netCashPayable: TaxBreakdown & { totalCashPayable: number };
  closingCreditLedger: TaxBreakdown & { totalCarryforward: number };
  statutoryLateFees: number;
  statutoryInterestSec50: number;
  totalOutflowRequired: number;
}

/**
 * Core GST Domain Calculator Service
 */
export class GSTTaxCalculator {
  /**
   * Evaluates dynamic threshold rate for value-linked line items (Apparel, Footwear, Hotel)
   */
  public static evaluateDynamicRate(hsnSac: string, unitRate: number, defaultTaxRate: number): { rate: number; isApplied: boolean; note?: string } {
    if (!hsnSac) return { rate: defaultTaxRate, isApplied: false };
    
    const cleanHsn = hsnSac.trim();
    const matchedRule = THRESHOLD_RULES.find(r => cleanHsn.startsWith(r.hsnPrefix));
    
    if (matchedRule) {
      if (unitRate <= matchedRule.thresholdAmount) {
        return {
          rate: matchedRule.belowRate,
          isApplied: true,
          note: `Value <= ₹${matchedRule.thresholdAmount.toLocaleString()}: Applicable concessional rate ${matchedRule.belowRate}% applied under statutory threshold rule.`
        };
      } else {
        return {
          rate: matchedRule.aboveRate,
          isApplied: true,
          note: `Value > ₹${matchedRule.thresholdAmount.toLocaleString()}: Applicable standard rate ${matchedRule.aboveRate}% applied.`
        };
      }
    }

    // Solar Power Generating System (70:30 composite supply)
    if (cleanHsn.startsWith('8412') || cleanHsn.startsWith('8541')) {
      return {
        rate: 13.8,
        isApplied: true,
        note: 'Composite Solar System Valuation: 70% Goods @ 12% + 30% Services @ 18% = Effective 13.8% Tax.'
      };
    }

    return { rate: defaultTaxRate, isApplied: false };
  }

  /**
   * Computes line item tax with statutory schedule, Place of Supply, and Compensation Cess
   */
  public static calculateLineItem(
    taxableValue: number,
    baseTaxRate: number,
    hsnSac: string = '',
    unitPrice: number = 0,
    quantity: number = 1,
    supplierStateCode: string = '27',
    placeOfSupply: string = '27',
    isSez: boolean = false,
    isImport: boolean = false,
    isExport: boolean = false,
    cessAdValoremPercent: number = 0,
    specificCessPerUnit: number = 0
  ): LineItemTaxCalculation {
    const { rate: effectiveRate, isApplied, note } = this.evaluateDynamicRate(hsnSac, unitPrice || (taxableValue / Math.max(1, quantity)), baseTaxRate);
    
    const isInterState = isImport || isExport || isSez || (supplierStateCode !== placeOfSupply);
    const isZeroRated = (isExport || isSez) && (effectiveRate === 0 || baseTaxRate === 0);

    let igstRate = 0;
    let cgstRate = 0;
    let sgstRate = 0;
    let utgstRate = 0;

    if (!isZeroRated) {
      if (isInterState) {
        igstRate = effectiveRate;
      } else {
        const halfRate = effectiveRate / 2;
        cgstRate = halfRate;
        if (isUnionTerritory(placeOfSupply)) {
          utgstRate = halfRate;
        } else {
          sgstRate = halfRate;
        }
      }
    }

    const igst = Math.round((taxableValue * (igstRate / 100)) * 100) / 100;
    const cgst = Math.round((taxableValue * (cgstRate / 100)) * 100) / 100;
    const sgst = Math.round((taxableValue * (sgstRate / 100)) * 100) / 100;
    const utgst = Math.round((taxableValue * (utgstRate / 100)) * 100) / 100;

    // Cess Calculation
    const adValoremCess = Math.round((taxableValue * (cessAdValoremPercent / 100)) * 100) / 100;
    const specificCess = Math.round((quantity * specificCessPerUnit) * 100) / 100;
    const totalCess = Math.round((adValoremCess + specificCess) * 100) / 100;

    const totalTax = Math.round((igst + cgst + sgst + utgst + totalCess) * 100) / 100;
    const totalInvoiceAmount = Math.round((taxableValue + totalTax) * 100) / 100;

    return {
      taxableValue: Math.round(taxableValue * 100) / 100,
      applicableRate: effectiveRate,
      isThresholdApplied: isApplied,
      effectiveRateNote: note,
      cgstRate,
      sgstRate,
      utgstRate,
      igstRate,
      cgst,
      sgst,
      utgst,
      igst,
      adValoremCess,
      specificCess,
      totalCess,
      totalTax,
      totalInvoiceAmount
    };
  }

  /**
   * Computes detailed tax breakdown for a list of items based on supply parameters
   */
  public static calculateTax(
    items: InvoiceItem[],
    supplierStateCode: string,
    placeOfSupply: string,
    isSez: boolean = false,
    isImport: boolean = false,
    isExport: boolean = false
  ): TaxBreakdown {
    let totalTaxableValue = 0;
    let igst = 0;
    let cgst = 0;
    let sgst = 0;
    let utgst = 0;
    let cess = 0;

    items.forEach((item) => {
      const lineTaxableValue = item.taxableValue || (item.quantity * item.rate) || 0;
      const unitPrice = item.rate || (lineTaxableValue / Math.max(1, item.quantity || 1));
      
      const calc = this.calculateLineItem(
        lineTaxableValue,
        item.taxRate || 0,
        item.hsnSac,
        unitPrice,
        item.quantity || 1,
        supplierStateCode,
        placeOfSupply,
        isSez,
        isImport,
        isExport
      );

      totalTaxableValue += calc.taxableValue;
      igst += calc.igst;
      cgst += calc.cgst;
      sgst += calc.sgst;
      utgst += calc.utgst;
      cess += calc.totalCess;
    });

    return {
      taxableValue: Math.round(totalTaxableValue * 100) / 100,
      igst: Math.round(igst * 100) / 100,
      cgst: Math.round(cgst * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      utgst: Math.round(utgst * 100) / 100,
      cess: Math.round(cess * 100) / 100,
    };
  }

  /**
   * Recalculates the tax breakdown of an entire Invoice
   */
  public static processInvoiceTax(invoice: Partial<Invoice>, supplierStateCode: string): Partial<Invoice> {
    const items = invoice.items || [];
    const placeOfSupply = invoice.placeOfSupply || supplierStateCode;
    const isSez = !!invoice.isSez;
    const isImport = !!invoice.isImport;
    const isExport = invoice.type === 'EXPORT';

    const calculatedTaxDetails = this.calculateTax(
      items,
      supplierStateCode,
      placeOfSupply,
      isSez,
      isImport,
      isExport
    );

    const totalTax = calculatedTaxDetails.igst + 
                     calculatedTaxDetails.cgst + 
                     calculatedTaxDetails.sgst + 
                     calculatedTaxDetails.utgst + 
                     calculatedTaxDetails.cess;

    return {
      ...invoice,
      amount: calculatedTaxDetails.taxableValue,
      taxAmount: Math.round(totalTax * 100) / 100,
      taxDetails: calculatedTaxDetails,
    };
  }

  /**
   * Computes complete statutory tax liability and Rule 88A set-off matrix
   */
  public static calculateAutomatedTaxLiability(
    outwardInvoices: Invoice[],
    inwardInvoices: Invoice[],
    openingLedger: { igst: number; cgst: number; sgst: number },
    period: string = 'July 2026',
    delayDays: number = 0
  ): StatutoryLiabilityComputationResult {
    let grossOut = { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, utgst: 0, cess: 0 };
    let rcmOut = { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, utgst: 0, cess: 0 };
    let totalInwardItc = { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, utgst: 0, cess: 0 };
    let blockedItcVal = 0;

    const rateBuckets: Record<number, { taxableValue: number; taxAmount: number }> = {
      0: { taxableValue: 0, taxAmount: 0 },
      0.1: { taxableValue: 0, taxAmount: 0 },
      0.25: { taxableValue: 0, taxAmount: 0 },
      1: { taxableValue: 0, taxAmount: 0 },
      3: { taxableValue: 0, taxAmount: 0 },
      5: { taxableValue: 0, taxAmount: 0 },
      6: { taxableValue: 0, taxAmount: 0 },
      12: { taxableValue: 0, taxAmount: 0 },
      18: { taxableValue: 0, taxAmount: 0 },
      28: { taxableValue: 0, taxAmount: 0 },
    };

    // 1. Process Outward Sales
    outwardInvoices.filter(i => i.category === 'SALES' && i.status !== 'FAILED').forEach(inv => {
      grossOut.taxableValue += inv.amount;
      grossOut.igst += inv.taxDetails?.igst || 0;
      grossOut.cgst += inv.taxDetails?.cgst || 0;
      grossOut.sgst += inv.taxDetails?.sgst || 0;
      grossOut.utgst += inv.taxDetails?.utgst || 0;
      grossOut.cess += inv.taxDetails?.cess || 0;

      // Group into rate tiers
      const items = inv.items || [];
      if (items.length > 0) {
        items.forEach(item => {
          const r = item.taxRate || 18;
          if (!rateBuckets[r]) rateBuckets[r] = { taxableValue: 0, taxAmount: 0 };
          rateBuckets[r].taxableValue += item.taxableValue;
          rateBuckets[r].taxAmount += item.taxAmount;
        });
      } else {
        const estRate = inv.amount > 0 ? Math.round((inv.taxAmount / inv.amount) * 100) : 18;
        const matchedRate = [0, 0.1, 0.25, 1, 3, 5, 6, 12, 18, 28].includes(estRate) ? estRate : 18;
        rateBuckets[matchedRate].taxableValue += inv.amount;
        rateBuckets[matchedRate].taxAmount += inv.taxAmount;
      }
    });

    // 2. Process Inward Purchases & RCM
    inwardInvoices.filter(i => i.category === 'PURCHASE' && i.status !== 'FAILED').forEach(inv => {
      if (inv.isBlockedItc) {
        blockedItcVal += inv.taxAmount;
      } else {
        totalInwardItc.taxableValue += inv.amount;
        totalInwardItc.igst += inv.taxDetails?.igst || 0;
        totalInwardItc.cgst += inv.taxDetails?.cgst || 0;
        totalInwardItc.sgst += inv.taxDetails?.sgst || 0;
        totalInwardItc.utgst += inv.taxDetails?.utgst || 0;
        totalInwardItc.cess += inv.taxDetails?.cess || 0;
      }

      if (inv.isRcm) {
        rcmOut.taxableValue += inv.amount;
        rcmOut.igst += inv.taxDetails?.igst || 0;
        rcmOut.cgst += inv.taxDetails?.cgst || 0;
        rcmOut.sgst += inv.taxDetails?.sgst || 0;
        rcmOut.utgst += inv.taxDetails?.utgst || 0;
        rcmOut.cess += inv.taxDetails?.cess || 0;
      }
    });

    // Total Output Liability to be discharged (Gross Sales + RCM Output)
    const grossIgstOut = grossOut.igst + rcmOut.igst;
    const grossCgstOut = grossOut.cgst + rcmOut.cgst;
    const grossSgstOut = grossOut.sgst + rcmOut.sgst;

    // Available Credit (Opening + Current Eligible Purchase ITC)
    const totalAvailIgst = openingLedger.igst + totalInwardItc.igst;
    const totalAvailCgst = openingLedger.cgst + totalInwardItc.cgst;
    const totalAvailSgst = openingLedger.sgst + totalInwardItc.sgst;

    // --- RULE 88A SET-OFF ALGORITHM ---
    // Step 1: IGST Credit vs Output IGST, CGST, SGST
    const igst_igst = Math.min(totalAvailIgst, grossIgstOut);
    let remIgstCred = totalAvailIgst - igst_igst;
    let remIgstOut = grossIgstOut - igst_igst;

    const igst_cgst = Math.min(remIgstCred, grossCgstOut);
    remIgstCred -= igst_cgst;
    let remCgstOut = grossCgstOut - igst_cgst;

    const igst_sgst = Math.min(remIgstCred, grossSgstOut);
    remIgstCred -= igst_sgst;
    let remSgstOut = grossSgstOut - igst_sgst;

    // Step 2: CGST Credit vs remaining Output CGST, then IGST
    const cgst_cgst = Math.min(totalAvailCgst, remCgstOut);
    let remCgstCred = totalAvailCgst - cgst_cgst;
    remCgstOut -= cgst_cgst;

    const cgst_igst = Math.min(remCgstCred, remIgstOut);
    remCgstCred -= cgst_igst;
    remIgstOut -= cgst_igst;

    // Step 3: SGST Credit vs remaining Output SGST, then IGST
    const sgst_sgst = Math.min(totalAvailSgst, remSgstOut);
    let remSgstCred = totalAvailSgst - sgst_sgst;
    remSgstOut -= sgst_sgst;

    const sgst_igst = Math.min(remSgstCred, remIgstOut);
    remSgstCred -= sgst_igst;
    remIgstOut -= sgst_igst;

    // Summary Cash & Carryforward
    const netCashIgst = Math.max(0, remIgstOut);
    const netCashCgst = Math.max(0, remCgstOut);
    const netCashSgst = Math.max(0, remSgstOut);
    const totalRegularCash = netCashIgst + netCashCgst + netCashSgst;

    // Note: RCM liability MUST be paid in cash (cannot be offset by ITC)
    const rcmCashPayable = rcmOut.igst + rcmOut.cgst + rcmOut.sgst;

    const closingIgst = Math.max(0, remIgstCred);
    const closingCgst = Math.max(0, remCgstCred);
    const closingSgst = Math.max(0, remSgstCred);

    // Section 50 Interest (18% p.a. on net cash tax liability for delayed days)
    const statutoryInterestSec50 = delayDays > 0 
      ? Math.round((totalRegularCash * 0.18 * delayDays) / 365) 
      : 0;

    // Late fee u/s 47 (₹50/day = ₹25 CGST + ₹25 SGST)
    const statutoryLateFees = delayDays > 0 ? delayDays * 50 : 0;

    const totalOutflowRequired = totalRegularCash + rcmCashPayable + statutoryInterestSec50 + statutoryLateFees;

    const rateTierBreakdown = STATUTORY_SCHEDULES.map(tier => ({
      rate: tier.rate,
      label: tier.label,
      taxableValue: rateBuckets[tier.rate]?.taxableValue || 0,
      taxAmount: rateBuckets[tier.rate]?.taxAmount || 0,
    }));

    return {
      period,
      grossOutputTax: {
        taxableValue: grossOut.taxableValue,
        igst: grossOut.igst,
        cgst: grossOut.cgst,
        sgst: grossOut.sgst,
        utgst: grossOut.utgst,
        cess: grossOut.cess
      },
      rateTierBreakdown,
      rcmLiability: {
        taxableValue: rcmOut.taxableValue,
        igst: rcmOut.igst,
        cgst: rcmOut.cgst,
        sgst: rcmOut.sgst,
        utgst: rcmOut.utgst,
        cess: rcmOut.cess,
        cashPayableMandatory: rcmCashPayable
      },
      eligibleInputTaxCredit: totalInwardItc,
      ineligibleBlockedItc: blockedItcVal,
      rule42ReversalItc: 0,
      netAvailableItc: {
        taxableValue: totalInwardItc.taxableValue,
        igst: totalAvailIgst,
        cgst: totalAvailCgst,
        sgst: totalAvailSgst,
        utgst: totalInwardItc.utgst,
        cess: totalInwardItc.cess
      },
      setOffMatrix: {
        igst_igst,
        igst_cgst,
        igst_sgst,
        cgst_cgst,
        cgst_igst,
        sgst_sgst,
        sgst_igst,
        totalSetOffIgst: igst_igst + cgst_igst + sgst_igst,
        totalSetOffCgst: igst_cgst + cgst_cgst,
        totalSetOffSgst: igst_sgst + sgst_sgst,
        grandTotalSetOff: igst_igst + igst_cgst + igst_sgst + cgst_cgst + cgst_igst + sgst_sgst + sgst_igst
      },
      netCashPayable: {
        taxableValue: 0,
        igst: netCashIgst,
        cgst: netCashCgst,
        sgst: netCashSgst,
        utgst: 0,
        cess: grossOut.cess,
        totalCashPayable: totalRegularCash
      },
      closingCreditLedger: {
        taxableValue: 0,
        igst: closingIgst,
        cgst: closingCgst,
        sgst: closingSgst,
        utgst: 0,
        cess: 0,
        totalCarryforward: closingIgst + closingCgst + closingSgst
      },
      statutoryLateFees,
      statutoryInterestSec50,
      totalOutflowRequired
    };
  }
}

