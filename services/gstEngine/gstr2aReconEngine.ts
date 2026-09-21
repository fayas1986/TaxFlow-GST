/**
 * GSTR-2A vs Purchase Register Reconciliation Engine
 * 
 * Implements deep matching algorithms between internal accounting records
 * (Purchase Register) and Government GST Portal inward supplies data (GSTR-2A).
 * 
 * Evaluates:
 * - Exact 5-way field matching (GSTIN, Invoice Number, Date, Taxable Value, Tax Heads)
 * - Tolerance window evaluation (rounding, date shifts)
 * - Missing in GSTR-2A (Supplier non-upload / Section 16(2)(aa) ITC at risk)
 * - Missing in Books / Purchase Register (Unclaimed ITC opportunities)
 * - Tax Head & Place of Supply (POS) mismatches (IGST vs CGST+SGST)
 * - Supplier GSTR-1 / GSTR-3B return filing defaults
 */

export interface PurchaseRegisterInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  supplierGstin: string;
  supplierName: string;
  placeOfSupply: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalTax: number;
  totalAmount: number;
  docType: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
  paymentStatus?: 'PAID' | 'PENDING' | 'ON_HOLD';
  internalVoucherNo?: string;
}

export interface GSTR2AGovtRecord {
  id: string;
  supplierGstin: string;
  supplierTradeName: string;
  supplierLegalName?: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceType: 'B2B' | 'CDNR' | 'B2BA' | 'ISD' | 'IMPG';
  placeOfSupply: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalTax: number;
  totalInvoiceValue: number;
  gstr1FilingStatus: 'FILED' | 'NOT_FILED';
  gstr1FilingDate?: string;
  gstr1FilingPeriod: string; // e.g., '08/2026'
  gstr3bFilingStatus: 'FILED' | 'NOT_FILED';
  amendmentFlag?: boolean;
  source: 'GSTR-1' | 'GSTR-5' | 'GSTR-6' | 'ICEGATE';
}

export type GSTR2ADiscrepancyType =
  | 'EXACT_MATCH'
  | 'MATCH_WITH_TOLERANCE'
  | 'TAXABLE_VALUE_MISMATCH'
  | 'TAX_AMOUNT_MISMATCH'
  | 'TAX_HEAD_MISMATCH'
  | 'DATE_MISMATCH'
  | 'MISSING_IN_GSTR2A'
  | 'MISSING_IN_PURCHASE_REGISTER'
  | 'PROBABLE_MATCH'
  | 'SUPPLIER_GSTR1_NOT_FILED';

export interface DiscrepancyFieldDetail {
  field: 'taxableValue' | 'cgst' | 'sgst' | 'igst' | 'cess' | 'totalTax' | 'totalAmount' | 'date' | 'placeOfSupply' | 'invoiceNumber' | 'filingStatus';
  fieldName: string;
  prValue: string | number;
  govtValue: string | number;
  diff?: number; // prValue - govtValue
  status: 'CRITICAL' | 'WARNING' | 'INFO';
  explanation: string;
}

export interface GSTR2AReconciliationItem {
  id: string;
  purchaseInvoice?: PurchaseRegisterInvoice;
  govtRecord?: GSTR2AGovtRecord;
  discrepancyType: GSTR2ADiscrepancyType;
  discrepancies: DiscrepancyFieldDetail[];
  taxDifference: number; // >0: Excess in PR; <0: Shortfall in PR
  taxableDifference: number;
  matchScore: number; // 0 - 100
  statutoryStatus: 'ITC_ELIGIBLE' | 'ITC_AT_RISK' | 'UNCLAIMED_ITC' | 'REQUIRES_AMENDMENT';
  statutoryNote: string;
  actionTaken?: 'NONE' | 'NOTICE_SENT' | 'PAYMENT_HELD' | 'ACCEPTED_GOVT_VALUE' | 'FORCE_MATCHED' | 'RECORDED_IN_BOOKS';
  actionNote?: string;
}

export interface GSTR2AReconConfig {
  dateToleranceDays: number; // Default: 7
  taxAmountTolerance: number; // Default: 10 (₹10)
  taxableValueTolerance: number; // Default: 100 (₹100)
  lenientInvoiceNumberMatch: boolean; // Default: true (ignores dashes, slashes, leading zeroes)
  requireStrictGstin: boolean; // Default: true
}

export const DEFAULT_GSTR2A_RECON_CONFIG: GSTR2AReconConfig = {
  dateToleranceDays: 7,
  taxAmountTolerance: 10,
  taxableValueTolerance: 100,
  lenientInvoiceNumberMatch: true,
  requireStrictGstin: true,
};

export interface GSTR2AReconSummary {
  totalPrInvoices: number;
  totalGovtInvoices: number;
  exactMatchesCount: number;
  toleranceMatchesCount: number;
  valueMismatchesCount: number;
  taxHeadMismatchesCount: number;
  missingInGovtCount: number;
  missingInPrCount: number;
  probableMatchesCount: number;
  supplierNotFiledCount: number;
  totalPrTaxable: number;
  totalGovtTaxable: number;
  totalPrTax: number;
  totalGovtTax: number;
  netTaxDifference: number;
  itcAtRiskAmount: number;
  unclaimedItcAmount: number;
  matchRatePercentage: number;
}

export class GSTR2AReconEngine {
  /**
   * Normalizes invoice number for fuzzy comparisons (removes slashes, dashes, spaces, and leading zeros)
   */
  public static normalizeInvoiceNumber(invNo: string): string {
    if (!invNo) return '';
    return invNo
      .toUpperCase()
      .trim()
      .replace(/[^A-Z0-9]/g, '')
      .replace(/^0+/, '');
  }

  /**
   * Calculate day delta between two ISO date strings
   */
  public static getDayDifference(d1: string, d2: string): number {
    try {
      const date1 = new Date(d1);
      const date2 = new Date(d2);
      const diffMs = Math.abs(date2.getTime() - date1.getTime());
      return Math.round(diffMs / (1000 * 60 * 60 * 24));
    } catch {
      return 999;
    }
  }

  /**
   * Execute reconciliation between Purchase Register invoices and GSTR-2A government records
   */
  public static reconcile(
    purchaseInvoices: PurchaseRegisterInvoice[],
    govtRecords: GSTR2AGovtRecord[],
    config: GSTR2AReconConfig = DEFAULT_GSTR2A_RECON_CONFIG
  ): { items: GSTR2AReconciliationItem[]; summary: GSTR2AReconSummary } {
    const matchedGovtIds = new Set<string>();
    const results: GSTR2AReconciliationItem[] = [];

    // Step 1: Iterate over each Purchase Register record to find best matching Government record
    purchaseInvoices.forEach((pr) => {
      let bestGovt: GSTR2AGovtRecord | null = null;
      let highestScore = -1;
      let bestDiscrepancies: DiscrepancyFieldDetail[] = [];
      let bestType: GSTR2ADiscrepancyType = 'MISSING_IN_GSTR2A';

      const prGstin = (pr.supplierGstin || '').toUpperCase().trim();
      const prNormInv = this.normalizeInvoiceNumber(pr.invoiceNumber);

      govtRecords.forEach((govt) => {
        if (matchedGovtIds.has(govt.id)) return;

        const govtGstin = (govt.supplierGstin || '').toUpperCase().trim();
        const govtNormInv = this.normalizeInvoiceNumber(govt.invoiceNumber);

        // GSTIN Matching check
        const gstinMatches = prGstin === govtGstin;
        if (config.requireStrictGstin && !gstinMatches) return;

        let score = 0;
        const discrepancies: DiscrepancyFieldDetail[] = [];

        if (gstinMatches) score += 30;

        // Invoice Number Check
        const exactInvMatch = pr.invoiceNumber.trim().toUpperCase() === govt.invoiceNumber.trim().toUpperCase();
        const normalizedInvMatch = prNormInv === govtNormInv;

        if (exactInvMatch) {
          score += 30;
        } else if (config.lenientInvoiceNumberMatch && normalizedInvMatch) {
          score += 24;
          discrepancies.push({
            field: 'invoiceNumber',
            fieldName: 'Invoice Number Formatting',
            prValue: pr.invoiceNumber,
            govtValue: govt.invoiceNumber,
            status: 'INFO',
            explanation: `Minor character/format variation between Books (${pr.invoiceNumber}) and GSTR-2A (${govt.invoiceNumber}).`,
          });
        } else {
          // Check substring overlap
          if (govtNormInv.includes(prNormInv) || prNormInv.includes(govtNormInv)) {
            score += 12;
            discrepancies.push({
              field: 'invoiceNumber',
              fieldName: 'Invoice Number Variation',
              prValue: pr.invoiceNumber,
              govtValue: govt.invoiceNumber,
              status: 'WARNING',
              explanation: 'Partial invoice number pattern matched with variations.',
            });
          } else {
            return; // Not same invoice
          }
        }

        // Date Check
        const dayDiff = this.getDayDifference(pr.date, govt.invoiceDate);
        if (dayDiff === 0) {
          score += 15;
        } else if (dayDiff <= config.dateToleranceDays) {
          score += 10;
          discrepancies.push({
            field: 'date',
            fieldName: 'Invoice Date Variance',
            prValue: pr.date,
            govtValue: govt.invoiceDate,
            diff: dayDiff,
            status: 'INFO',
            explanation: `Invoice date differs by ${dayDiff} days (within allowable tolerance of ±${config.dateToleranceDays} days).`,
          });
        } else {
          discrepancies.push({
            field: 'date',
            fieldName: 'Invoice Date Mismatch',
            prValue: pr.date,
            govtValue: govt.invoiceDate,
            diff: dayDiff,
            status: 'WARNING',
            explanation: `Significant date disparity: Books recorded on ${pr.date} vs GSTR-2A dated ${govt.invoiceDate} (${dayDiff} days gap).`,
          });
        }

        // Taxable Value Check
        const taxableDiff = Math.abs(pr.taxableValue - govt.taxableValue);
        if (taxableDiff <= 1) {
          score += 15;
        } else if (taxableDiff <= config.taxableValueTolerance) {
          score += 10;
          discrepancies.push({
            field: 'taxableValue',
            fieldName: 'Taxable Value Variance',
            prValue: pr.taxableValue,
            govtValue: govt.taxableValue,
            diff: pr.taxableValue - govt.taxableValue,
            status: 'INFO',
            explanation: `Taxable value variation of ₹${taxableDiff.toFixed(2)} is within acceptable tolerance.`,
          });
        } else {
          discrepancies.push({
            field: 'taxableValue',
            fieldName: 'Taxable Value Discrepancy',
            prValue: pr.taxableValue,
            govtValue: govt.taxableValue,
            diff: pr.taxableValue - govt.taxableValue,
            status: 'CRITICAL',
            explanation: `Books state ₹${pr.taxableValue.toLocaleString('en-IN')} vs GSTR-2A portal states ₹${govt.taxableValue.toLocaleString('en-IN')} (Discrepancy: ₹${(pr.taxableValue - govt.taxableValue).toLocaleString('en-IN')}).`,
          });
        }

        // Tax Amount Check
        const taxDiff = Math.abs(pr.totalTax - govt.totalTax);
        if (taxDiff <= 1) {
          score += 10;
        } else if (taxDiff <= config.taxAmountTolerance) {
          score += 7;
          discrepancies.push({
            field: 'totalTax',
            fieldName: 'Tax Amount Rounding',
            prValue: pr.totalTax,
            govtValue: govt.totalTax,
            diff: pr.totalTax - govt.totalTax,
            status: 'INFO',
            explanation: `Tax amount delta of ₹${taxDiff.toFixed(2)} is within rounding tolerance.`,
          });
        } else {
          discrepancies.push({
            field: 'totalTax',
            fieldName: 'Tax Amount Discrepancy',
            prValue: pr.totalTax,
            govtValue: govt.totalTax,
            diff: pr.totalTax - govt.totalTax,
            status: 'CRITICAL',
            explanation: `Tax mismatch: Books claim ₹${pr.totalTax.toLocaleString('en-IN')} vs Portal reports ₹${govt.totalTax.toLocaleString('en-IN')}.`,
          });
        }

        // Tax Head / Place of Supply Check (IGST vs CGST+SGST)
        const isPrInterstate = pr.igst > 0 && pr.cgst === 0;
        const isGovtInterstate = govt.igst > 0 && govt.cgst === 0;
        if (isPrInterstate !== isGovtInterstate && (pr.totalTax > 0 || govt.totalTax > 0)) {
          score -= 15;
          discrepancies.push({
            field: 'placeOfSupply',
            fieldName: 'Tax Head / POS Mismatch',
            prValue: isPrInterstate ? 'Inter-State (IGST)' : 'Intra-State (CGST+SGST)',
            govtValue: isGovtInterstate ? 'Inter-State (IGST)' : 'Intra-State (CGST+SGST)',
            status: 'CRITICAL',
            explanation: `POS classification discrepancy: Books recorded as ${isPrInterstate ? 'IGST' : 'CGST+SGST'} while Supplier reported as ${isGovtInterstate ? 'IGST' : 'CGST+SGST'}.`,
          });
        }

        // Supplier Filing Status Check
        if (govt.gstr1FilingStatus === 'NOT_FILED') {
          discrepancies.push({
            field: 'filingStatus',
            fieldName: 'Supplier GSTR-1 Not Filed',
            prValue: 'N/A',
            govtValue: 'NOT FILED',
            status: 'WARNING',
            explanation: 'Supplier uploaded invoice details, but has not completed formal GSTR-1 return filing.',
          });
        }

        if (score > highestScore && score >= 45) {
          highestScore = score;
          bestGovt = govt;
          bestDiscrepancies = discrepancies;
        }
      });

      if (bestGovt) {
        matchedGovtIds.add(bestGovt.id);

        // Determine specific discrepancy type
        const hasCriticalTaxable = bestDiscrepancies.some((d) => d.field === 'taxableValue' && d.status === 'CRITICAL');
        const hasCriticalTax = bestDiscrepancies.some((d) => d.field === 'totalTax' && d.status === 'CRITICAL');
        const hasPosMismatch = bestDiscrepancies.some((d) => d.field === 'placeOfSupply');
        const hasDateMismatch = bestDiscrepancies.some((d) => d.field === 'date' && d.status === 'WARNING');
        const hasSupplierNotFiled = bestGovt.gstr1FilingStatus === 'NOT_FILED';
        const hasFuzzyInv = bestDiscrepancies.some((d) => d.field === 'invoiceNumber');

        if (hasPosMismatch) {
          bestType = 'TAX_HEAD_MISMATCH';
        } else if (hasCriticalTaxable) {
          bestType = 'TAXABLE_VALUE_MISMATCH';
        } else if (hasCriticalTax) {
          bestType = 'TAX_AMOUNT_MISMATCH';
        } else if (hasSupplierNotFiled) {
          bestType = 'SUPPLIER_GSTR1_NOT_FILED';
        } else if (hasDateMismatch) {
          bestType = 'DATE_MISMATCH';
        } else if (hasFuzzyInv && highestScore >= 70) {
          bestType = 'PROBABLE_MATCH';
        } else if (bestDiscrepancies.length > 0) {
          bestType = 'MATCH_WITH_TOLERANCE';
        } else {
          bestType = 'EXACT_MATCH';
        }

        // Determine statutory note & status
        let statutoryStatus: GSTR2AReconciliationItem['statutoryStatus'] = 'ITC_ELIGIBLE';
        let statutoryNote = 'Invoice perfectly matched with Government GSTR-2A. ITC fully compliant under Section 16(2)(aa).';

        if (bestType === 'TAX_HEAD_MISMATCH') {
          statutoryStatus = 'REQUIRES_AMENDMENT';
          statutoryNote = 'Tax head conflict. Supplier must amend invoice in next GSTR-1 (Table 9A) to rectify Place of Supply.';
        } else if (bestType === 'TAXABLE_VALUE_MISMATCH' || bestType === 'TAX_AMOUNT_MISMATCH') {
          const isBooksExcess = pr.totalTax > bestGovt.totalTax;
          statutoryStatus = isBooksExcess ? 'ITC_AT_RISK' : 'ITC_ELIGIBLE';
          statutoryNote = isBooksExcess
            ? `ITC claimed in Books exceeds Government Portal by ₹${(pr.totalTax - bestGovt.totalTax).toLocaleString('en-IN')}. Excess ITC ineligible under Sec 16(2)(aa).`
            : `Supplier reported higher tax on portal. Eligible to claim up to ₹${bestGovt.totalTax.toLocaleString('en-IN')}.`;
        } else if (bestType === 'SUPPLIER_GSTR1_NOT_FILED') {
          statutoryStatus = 'ITC_AT_RISK';
          statutoryNote = 'Supplier return not filed. ITC may be restricted under Rule 36(4) if not finalized before deadline.';
        }

        results.push({
          id: `recon-${pr.id}-${bestGovt.id}`,
          purchaseInvoice: pr,
          govtRecord: bestGovt,
          discrepancyType: bestType,
          discrepancies: bestDiscrepancies,
          taxDifference: pr.totalTax - bestGovt.totalTax,
          taxableDifference: pr.taxableValue - bestGovt.taxableValue,
          matchScore: Math.min(100, highestScore),
          statutoryStatus,
          statutoryNote,
          actionTaken: 'NONE',
        });
      } else {
        // Missing in GSTR-2A (Vendor non-filing / omitted invoice)
        results.push({
          id: `recon-pr-missing-${pr.id}`,
          purchaseInvoice: pr,
          discrepancyType: 'MISSING_IN_GSTR2A',
          discrepancies: [
            {
              field: 'invoiceNumber',
              fieldName: 'Government Portal Omission',
              prValue: pr.invoiceNumber,
              govtValue: 'NOT REPORTED',
              status: 'CRITICAL',
              explanation: `Invoice ${pr.invoiceNumber} recorded in Purchase Register has NOT been reported by supplier ${pr.supplierName} (${pr.supplierGstin}) in GSTR-2A.`,
            },
          ],
          taxDifference: pr.totalTax,
          taxableDifference: pr.taxableValue,
          matchScore: 0,
          statutoryStatus: 'ITC_AT_RISK',
          statutoryNote: `Critical ITC Risk: ₹${pr.totalTax.toLocaleString('en-IN')} cannot be claimed under Section 16(2)(aa) until supplier uploads and files in GSTR-1.`,
          actionTaken: 'NONE',
        });
      }
    });

    // Step 2: Invoices present in GSTR-2A but MISSING in Purchase Register (Unclaimed ITC!)
    govtRecords.forEach((govt) => {
      if (!matchedGovtIds.has(govt.id)) {
        results.push({
          id: `recon-govt-missing-${govt.id}`,
          govtRecord: govt,
          discrepancyType: 'MISSING_IN_PURCHASE_REGISTER',
          discrepancies: [
            {
              field: 'invoiceNumber',
              fieldName: 'Books Omission / Unclaimed ITC',
              prValue: 'NOT IN BOOKS',
              govtValue: govt.invoiceNumber,
              status: 'WARNING',
              explanation: `Supplier ${govt.supplierTradeName} (${govt.supplierGstin}) reported Invoice ${govt.invoiceNumber} on GSTN Portal, but it is not recorded in Purchase Register.`,
            },
          ],
          taxDifference: -govt.totalTax,
          taxableDifference: -govt.taxableValue,
          matchScore: 0,
          statutoryStatus: 'UNCLAIMED_ITC',
          statutoryNote: `Unclaimed ITC Opportunity: ₹${govt.totalTax.toLocaleString('en-IN')} available on GST Portal. Add to Purchase Register before Nov 30 deadline.`,
          actionTaken: 'NONE',
        });
      }
    });

    // Step 3: Compute Summary Statistics
    let exactMatchesCount = 0;
    let toleranceMatchesCount = 0;
    let valueMismatchesCount = 0;
    let taxHeadMismatchesCount = 0;
    let missingInGovtCount = 0;
    let missingInPrCount = 0;
    let probableMatchesCount = 0;
    let supplierNotFiledCount = 0;

    let totalPrTaxable = 0;
    let totalGovtTaxable = 0;
    let totalPrTax = 0;
    let totalGovtTax = 0;
    let itcAtRiskAmount = 0;
    let unclaimedItcAmount = 0;

    purchaseInvoices.forEach((pr) => {
      totalPrTaxable += pr.taxableValue || 0;
      totalPrTax += pr.totalTax || 0;
    });

    govtRecords.forEach((g) => {
      totalGovtTaxable += g.taxableValue || 0;
      totalGovtTax += g.totalTax || 0;
    });

    results.forEach((item) => {
      switch (item.discrepancyType) {
        case 'EXACT_MATCH':
          exactMatchesCount++;
          break;
        case 'MATCH_WITH_TOLERANCE':
          toleranceMatchesCount++;
          break;
        case 'TAXABLE_VALUE_MISMATCH':
        case 'TAX_AMOUNT_MISMATCH':
          valueMismatchesCount++;
          if (item.taxDifference > 0) {
            itcAtRiskAmount += item.taxDifference;
          }
          break;
        case 'TAX_HEAD_MISMATCH':
          taxHeadMismatchesCount++;
          break;
        case 'MISSING_IN_GSTR2A':
          missingInGovtCount++;
          itcAtRiskAmount += item.taxDifference;
          break;
        case 'MISSING_IN_PURCHASE_REGISTER':
          missingInPrCount++;
          unclaimedItcAmount += Math.abs(item.taxDifference);
          break;
        case 'PROBABLE_MATCH':
          probableMatchesCount++;
          break;
        case 'SUPPLIER_GSTR1_NOT_FILED':
          supplierNotFiledCount++;
          if (item.taxDifference > 0) itcAtRiskAmount += item.taxDifference;
          break;
        default:
          break;
      }
    });

    const totalEvaluated = purchaseInvoices.length;
    const matchRatePercentage =
      totalEvaluated > 0
        ? Math.round(((exactMatchesCount + toleranceMatchesCount + probableMatchesCount) / totalEvaluated) * 100)
        : 0;

    const summary: GSTR2AReconSummary = {
      totalPrInvoices: purchaseInvoices.length,
      totalGovtInvoices: govtRecords.length,
      exactMatchesCount,
      toleranceMatchesCount,
      valueMismatchesCount,
      taxHeadMismatchesCount,
      missingInGovtCount,
      missingInPrCount,
      probableMatchesCount,
      supplierNotFiledCount,
      totalPrTaxable,
      totalGovtTaxable,
      totalPrTax,
      totalGovtTax,
      netTaxDifference: totalPrTax - totalGovtTax,
      itcAtRiskAmount,
      unclaimedItcAmount,
      matchRatePercentage,
    };

    return { items: results, summary };
  }

  /**
   * Generates sample realistic dataset of Government GSTR-2A records alongside Purchase Register
   * covering all reconciliation scenarios for demonstration and interactive testing.
   */
  public static generateSampleData(period: string = '08/2026'): {
    purchaseRegister: PurchaseRegisterInvoice[];
    govtGstr2a: GSTR2AGovtRecord[];
  } {
    const monthPrefix = period === '07/2026' ? '2026-07' : period === '06/2026' ? '2026-06' : '2026-08';
    const periodLabel = period === '07/2026' ? '07/2026' : period === '06/2026' ? '06/2026' : '08/2026';
    const monthTag = period === '07/2026' ? 'JUL' : period === '06/2026' ? 'JUN' : 'AUG';

    const purchaseRegister: PurchaseRegisterInvoice[] = [
      // 1. Exact Match - Clean enterprise supplier
      {
        id: `pr-${monthTag}-001`,
        invoiceNumber: `TSL/2026/${monthTag === 'AUG' ? '0892' : monthTag === 'JUL' ? '0781' : '0654'}`,
        date: `${monthPrefix}-04`,
        supplierGstin: '27AAACT2727Q1ZW',
        supplierName: 'Tata Steel Limited',
        placeOfSupply: '27',
        taxableValue: 500000,
        cgst: 45000,
        sgst: 45000,
        igst: 0,
        cess: 0,
        totalTax: 90000,
        totalAmount: 590000,
        docType: 'INVOICE',
        paymentStatus: 'PAID',
        internalVoucherNo: `VCH-${monthTag}-012`,
      },
      // 2. Taxable Value & Tax Mismatch - Supplier reported lower amount on portal
      {
        id: `pr-${monthTag}-002`,
        invoiceNumber: `INF-2026-${monthTag === 'AUG' ? '9041' : monthTag === 'JUL' ? '8910' : '7822'}`,
        date: `${monthPrefix}-08`,
        supplierGstin: '29AABCI1234K1ZV',
        supplierName: 'Infosys BPM Solutions Ltd',
        placeOfSupply: '27',
        taxableValue: 180000,
        cgst: 0,
        sgst: 0,
        igst: 32400,
        cess: 0,
        totalTax: 32400,
        totalAmount: 212400,
        docType: 'INVOICE',
        paymentStatus: 'PAID',
        internalVoucherNo: `VCH-${monthTag}-045`,
      },
      // 3. Tax Head Mismatch - POS conflict (PR booked as IGST, Govt reported as CGST+SGST)
      {
        id: `pr-${monthTag}-003`,
        invoiceNumber: `LT/MUM/2026/${monthTag === 'AUG' ? '514' : monthTag === 'JUL' ? '418' : '312'}`,
        date: `${monthPrefix}-11`,
        supplierGstin: '27AAACL0149E1ZS',
        supplierName: 'Larsen & Toubro ECC Div',
        placeOfSupply: '27',
        taxableValue: 350000,
        cgst: 0,
        sgst: 0,
        igst: 63000,
        cess: 0,
        totalTax: 63000,
        totalAmount: 413000,
        docType: 'INVOICE',
        paymentStatus: 'PENDING',
        internalVoucherNo: `VCH-${monthTag}-067`,
      },
      // 4. Missing in GSTR-2A (CRITICAL: Vendor Default - Supreme Logistics)
      {
        id: `pr-${monthTag}-004`,
        invoiceNumber: `SL/DEL/2026/${monthTag === 'AUG' ? '889' : monthTag === 'JUL' ? '772' : '651'}`,
        date: `${monthPrefix}-14`,
        supplierGstin: '07AABCS9912C1ZZ',
        supplierName: 'Supreme Freight Logistics Pvt Ltd',
        placeOfSupply: '27',
        taxableValue: 240000,
        cgst: 0,
        sgst: 0,
        igst: 43200,
        cess: 0,
        totalTax: 43200,
        totalAmount: 283200,
        docType: 'INVOICE',
        paymentStatus: 'PENDING',
        internalVoucherNo: `VCH-${monthTag}-088`,
      },
      // 5. Missing in GSTR-2A (CRITICAL: Vendor Default - Bharat Petroleum)
      {
        id: `pr-${monthTag}-005`,
        invoiceNumber: `BPCL/IND/${monthTag === 'AUG' ? '99201' : monthTag === 'JUL' ? '88190' : '77120'}`,
        date: `${monthPrefix}-16`,
        supplierGstin: '27AAACB2902M1ZT',
        supplierName: 'Bharat Petroleum Corp Industrial',
        placeOfSupply: '27',
        taxableValue: 125000,
        cgst: 11250,
        sgst: 11250,
        igst: 0,
        cess: 0,
        totalTax: 22500,
        totalAmount: 147500,
        docType: 'INVOICE',
        paymentStatus: 'ON_HOLD',
        internalVoucherNo: `VCH-${monthTag}-094`,
      },
      // 6. Probable Match (Fuzzy Invoice Number variation)
      {
        id: `pr-${monthTag}-006`,
        invoiceNumber: `SIE-2026-${monthTag === 'AUG' ? '441' : monthTag === 'JUL' ? '331' : '221'}`,
        date: `${monthPrefix}-18`,
        supplierGstin: '27AAACS1849K1ZY',
        supplierName: 'Siemens Industrial Technologies Ltd',
        placeOfSupply: '27',
        taxableValue: 420000,
        cgst: 37800,
        sgst: 37800,
        igst: 0,
        cess: 0,
        totalTax: 75600,
        totalAmount: 495600,
        docType: 'INVOICE',
        paymentStatus: 'PAID',
        internalVoucherNo: `VCH-${monthTag}-115`,
      },
      // 7. Match with Tolerance (Minor rounding difference of ₹4.80)
      {
        id: `pr-${monthTag}-007`,
        invoiceNumber: `HAV/2026/${monthTag === 'AUG' ? '1190' : monthTag === 'JUL' ? '1080' : '990'}`,
        date: `${monthPrefix}-20`,
        supplierGstin: '06AAACH1001M1ZQ',
        supplierName: 'Havells India Limited',
        placeOfSupply: '27',
        taxableValue: 84320,
        cgst: 0,
        sgst: 0,
        igst: 15177.6,
        cess: 0,
        totalTax: 15177.6,
        totalAmount: 99497.6,
        docType: 'INVOICE',
        paymentStatus: 'PAID',
        internalVoucherNo: `VCH-${monthTag}-132`,
      },
      // 8. Supplier GSTR-1 Not Filed
      {
        id: `pr-${monthTag}-008`,
        invoiceNumber: `VTX/2026/${monthTag === 'AUG' ? '781' : monthTag === 'JUL' ? '665' : '550'}`,
        date: `${monthPrefix}-22`,
        supplierGstin: '27AABCV8192L1Z3',
        supplierName: 'Vertex Cloud Infrastructure Services',
        placeOfSupply: '27',
        taxableValue: 95000,
        cgst: 8550,
        sgst: 8550,
        igst: 0,
        cess: 0,
        totalTax: 17100,
        totalAmount: 112100,
        docType: 'INVOICE',
        paymentStatus: 'PENDING',
        internalVoucherNo: `VCH-${monthTag}-149`,
      },
      // 9. Exact Match 2
      {
        id: `pr-${monthTag}-009`,
        invoiceNumber: `WIP/2026/${monthTag === 'AUG' ? '4109' : monthTag === 'JUL' ? '3908' : '3701'}`,
        date: `${monthPrefix}-25`,
        supplierGstin: '29AABCW1420P1ZH',
        supplierName: 'Wipro Enterprises Tech Services',
        placeOfSupply: '27',
        taxableValue: 210000,
        cgst: 0,
        sgst: 0,
        igst: 37800,
        cess: 0,
        totalTax: 37800,
        totalAmount: 247800,
        docType: 'INVOICE',
        paymentStatus: 'PAID',
        internalVoucherNo: `VCH-${monthTag}-165`,
      },
    ];

    const govtGstr2a: GSTR2AGovtRecord[] = [
      // 1. Matches PR 1 perfectly
      {
        id: `gstr2a-${monthTag}-001`,
        supplierGstin: '27AAACT2727Q1ZW',
        supplierTradeName: 'Tata Steel Limited',
        supplierLegalName: 'Tata Steel Limited',
        invoiceNumber: `TSL/2026/${monthTag === 'AUG' ? '0892' : monthTag === 'JUL' ? '0781' : '0654'}`,
        invoiceDate: `${monthPrefix}-04`,
        invoiceType: 'B2B',
        placeOfSupply: '27-Maharashtra',
        taxableValue: 500000,
        cgst: 45000,
        sgst: 45000,
        igst: 0,
        cess: 0,
        totalTax: 90000,
        totalInvoiceValue: 590000,
        gstr1FilingStatus: 'FILED',
        gstr1FilingDate: `${monthPrefix}-10`,
        gstr1FilingPeriod: periodLabel,
        gstr3bFilingStatus: 'FILED',
        source: 'GSTR-1',
      },
      // 2. Corresponds to PR 2, but supplier reported ₹150,000 instead of ₹180,000!
      {
        id: `gstr2a-${monthTag}-002`,
        supplierGstin: '29AABCI1234K1ZV',
        supplierTradeName: 'Infosys BPM Solutions Ltd',
        supplierLegalName: 'Infosys Limited',
        invoiceNumber: `INF-2026-${monthTag === 'AUG' ? '9041' : monthTag === 'JUL' ? '8910' : '7822'}`,
        invoiceDate: `${monthPrefix}-08`,
        invoiceType: 'B2B',
        placeOfSupply: '27-Maharashtra',
        taxableValue: 150000,
        cgst: 0,
        sgst: 0,
        igst: 27000,
        cess: 0,
        totalTax: 27000,
        totalInvoiceValue: 177000,
        gstr1FilingStatus: 'FILED',
        gstr1FilingDate: `${monthPrefix}-09`,
        gstr1FilingPeriod: periodLabel,
        gstr3bFilingStatus: 'FILED',
        source: 'GSTR-1',
      },
      // 3. Corresponds to PR 3, but reported as Intra-State (CGST+SGST) instead of IGST!
      {
        id: `gstr2a-${monthTag}-003`,
        supplierGstin: '27AAACL0149E1ZS',
        supplierTradeName: 'Larsen & Toubro ECC Div',
        supplierLegalName: 'Larsen and Toubro Limited',
        invoiceNumber: `LT/MUM/2026/${monthTag === 'AUG' ? '514' : monthTag === 'JUL' ? '418' : '312'}`,
        invoiceDate: `${monthPrefix}-11`,
        invoiceType: 'B2B',
        placeOfSupply: '27-Maharashtra',
        taxableValue: 350000,
        cgst: 31500,
        sgst: 31500,
        igst: 0,
        cess: 0,
        totalTax: 63000,
        totalInvoiceValue: 413000,
        gstr1FilingStatus: 'FILED',
        gstr1FilingDate: `${monthPrefix}-11`,
        gstr1FilingPeriod: periodLabel,
        gstr3bFilingStatus: 'FILED',
        source: 'GSTR-1',
      },
      // Notice: PR 4 (Supreme Logistics) and PR 5 (Bharat Petroleum) are NOT in GSTR-2A!
      // 6. Fuzzy match for PR 6
      {
        id: `gstr2a-${monthTag}-006`,
        supplierGstin: '27AAACS1849K1ZY',
        supplierTradeName: 'Siemens Industrial Technologies Ltd',
        supplierLegalName: 'Siemens Limited',
        invoiceNumber: monthTag === 'AUG' ? 'SIE/26/0441' : monthTag === 'JUL' ? 'SIE/26/0331' : 'SIE/26/0221',
        invoiceDate: `${monthPrefix}-18`,
        invoiceType: 'B2B',
        placeOfSupply: '27-Maharashtra',
        taxableValue: 420000,
        cgst: 37800,
        sgst: 37800,
        igst: 0,
        cess: 0,
        totalTax: 75600,
        totalInvoiceValue: 495600,
        gstr1FilingStatus: 'FILED',
        gstr1FilingDate: `${monthPrefix}-08`,
        gstr1FilingPeriod: periodLabel,
        gstr3bFilingStatus: 'FILED',
        source: 'GSTR-1',
      },
      // 7. Matches PR 7 with rounding tolerance: Tax is 15173 (diff ₹4.60)
      {
        id: `gstr2a-${monthTag}-007`,
        supplierGstin: '06AAACH1001M1ZQ',
        supplierTradeName: 'Havells India Limited',
        supplierLegalName: 'Havells India Limited',
        invoiceNumber: `HAV/2026/${monthTag === 'AUG' ? '1190' : monthTag === 'JUL' ? '1080' : '990'}`,
        invoiceDate: `${monthPrefix}-20`,
        invoiceType: 'B2B',
        placeOfSupply: '27-Maharashtra',
        taxableValue: 84320,
        cgst: 0,
        sgst: 0,
        igst: 15173,
        cess: 0,
        totalTax: 15173,
        totalInvoiceValue: 99493,
        gstr1FilingStatus: 'FILED',
        gstr1FilingDate: `${monthPrefix}-11`,
        gstr1FilingPeriod: periodLabel,
        gstr3bFilingStatus: 'FILED',
        source: 'GSTR-1',
      },
      // 8. Matches PR 8, but Supplier has NOT FILED GSTR-1
      {
        id: `gstr2a-${monthTag}-008`,
        supplierGstin: '27AABCV8192L1Z3',
        supplierTradeName: 'Vertex Cloud Infrastructure Services',
        supplierLegalName: 'Vertex Cloud Solutions LLP',
        invoiceNumber: `VTX/2026/${monthTag === 'AUG' ? '781' : monthTag === 'JUL' ? '665' : '550'}`,
        invoiceDate: `${monthPrefix}-22`,
        invoiceType: 'B2B',
        placeOfSupply: '27-Maharashtra',
        taxableValue: 95000,
        cgst: 8550,
        sgst: 8550,
        igst: 0,
        cess: 0,
        totalTax: 17100,
        totalInvoiceValue: 112100,
        gstr1FilingStatus: 'NOT_FILED',
        gstr1FilingPeriod: periodLabel,
        gstr3bFilingStatus: 'NOT_FILED',
        source: 'GSTR-1',
      },
      // 9. Matches PR 9 exactly
      {
        id: `gstr2a-${monthTag}-009`,
        supplierGstin: '29AABCW1420P1ZH',
        supplierTradeName: 'Wipro Enterprises Tech Services',
        supplierLegalName: 'Wipro Limited',
        invoiceNumber: `WIP/2026/${monthTag === 'AUG' ? '4109' : monthTag === 'JUL' ? '3908' : '3701'}`,
        invoiceDate: `${monthPrefix}-25`,
        invoiceType: 'B2B',
        placeOfSupply: '27-Maharashtra',
        taxableValue: 210000,
        cgst: 0,
        sgst: 0,
        igst: 37800,
        cess: 0,
        totalTax: 37800,
        totalInvoiceValue: 247800,
        gstr1FilingStatus: 'FILED',
        gstr1FilingDate: `${monthPrefix}-10`,
        gstr1FilingPeriod: periodLabel,
        gstr3bFilingStatus: 'FILED',
        source: 'GSTR-1',
      },
      // 10. MISSING IN PURCHASE REGISTER (CRITICAL: Unclaimed ITC! Dell International)
      {
        id: `gstr2a-${monthTag}-010`,
        supplierGstin: '29AABCD2581K1Z2',
        supplierTradeName: 'Dell International Services India',
        supplierLegalName: 'Dell International Services India Pvt Ltd',
        invoiceNumber: `DEL-IND-2026-${monthTag === 'AUG' ? '5590' : monthTag === 'JUL' ? '4480' : '3370'}`,
        invoiceDate: `${monthPrefix}-15`,
        invoiceType: 'B2B',
        placeOfSupply: '27-Maharashtra',
        taxableValue: 85000,
        cgst: 0,
        sgst: 0,
        igst: 15300,
        cess: 0,
        totalTax: 15300,
        totalInvoiceValue: 100300,
        gstr1FilingStatus: 'FILED',
        gstr1FilingDate: `${monthPrefix}-07`,
        gstr1FilingPeriod: periodLabel,
        gstr3bFilingStatus: 'FILED',
        source: 'GSTR-1',
      },
      // 11. MISSING IN PURCHASE REGISTER (CRITICAL: Unclaimed ITC! Reliance Jio Telecom)
      {
        id: `gstr2a-${monthTag}-011`,
        supplierGstin: '27AAACR5055K1Z4',
        supplierTradeName: 'Reliance Jio Infocomm Limited',
        supplierLegalName: 'Reliance Jio Infocomm Limited',
        invoiceNumber: `JIO/CORP/${monthTag}/7721`,
        invoiceDate: `${monthPrefix}-28`,
        invoiceType: 'B2B',
        placeOfSupply: '27-Maharashtra',
        taxableValue: 18000,
        cgst: 1620,
        sgst: 1620,
        igst: 0,
        cess: 0,
        totalTax: 3240,
        totalInvoiceValue: 21240,
        gstr1FilingStatus: 'FILED',
        gstr1FilingDate: `${monthPrefix}-11`,
        gstr1FilingPeriod: periodLabel,
        gstr3bFilingStatus: 'FILED',
        source: 'GSTR-1',
      },
    ];

    return { purchaseRegister, govtGstr2a };
  }
}
