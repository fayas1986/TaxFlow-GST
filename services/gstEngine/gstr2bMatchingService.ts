import { Invoice } from '../../types';
import { ITCTaggingService } from './itcTaggingService';

export interface InternalLedgerEntry {
  id: string;
  voucherNumber: string;
  voucherDate: string;
  invoiceNumber: string;
  invoiceDate: string;
  supplierName: string;
  supplierGstin: string;
  ledgerAccount: string;
  placeOfSupply: string;
  taxableAmount: number;
  taxRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalTax: number;
  totalInvoiceValue: number;
  isSec17Blocked?: boolean;
  blockedReason?: string;
  itcEligibility: 'INPUTS' | 'CAPITAL_GOODS' | 'INPUT_SERVICES' | 'INELIGIBLE_17_5';
  paymentStatus: 'PAID' | 'PAYMENT_HELD' | 'PENDING' | 'OVERDUE';
  paymentDueDate?: string;
  internalRemarks?: string;
}

export interface GSTR2BPortalRecord {
  id: string;
  gstin: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceType: 'B2B' | 'CDNR' | 'B2BA' | 'ISD' | 'RCM';
  taxableValue: number;
  taxRate?: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  totalTax: number;
  gstr1FilingDate?: string;
  gstr1FilingPeriod?: string; // e.g., '072026'
  itcAvailability: 'ELIGIBLE' | 'INELIGIBLE' | 'BLOCKED';
  ineligibilityReason?: string;
  placeOfSupply?: string;
  supplierFilingStatus?: 'ON_TIME' | 'LATE' | 'NOT_FILED';
}

export interface GSTR2BMatchingConfig {
  dateToleranceDays?: number; // Default: 7
  taxAmountTolerance?: number; // Default: 10
  taxableValueTolerance?: number; // Default: 100 (₹100 taxable value variance)
  fuzzyInvoiceMatching?: boolean; // Default: true
  enforceGstinStrictMatch?: boolean; // Default: true
  enforcePosMatch?: boolean; // Default: false
  autoTagSec17Blocked?: boolean; // Default: true
}

export const DEFAULT_GSTR2B_MATCHING_CONFIG: GSTR2BMatchingConfig = {
  dateToleranceDays: 7,
  taxAmountTolerance: 10,
  taxableValueTolerance: 100,
  fuzzyInvoiceMatching: true,
  enforceGstinStrictMatch: true,
  enforcePosMatch: false,
  autoTagSec17Blocked: true
};

export type GSTR2BMatchStatus =
  | 'EXACT_MATCH'
  | 'AMOUNT_MISMATCH'
  | 'TAX_HEAD_MISMATCH'
  | 'DATE_MISMATCH'
  | 'MISSING_IN_GSTR2B'
  | 'MISSING_IN_BOOKS'
  | 'SECTION_17_5_BLOCKED';

export interface FiveWayMatchDetails {
  gstinMatched: boolean;
  invoiceNoMatched: 'EXACT' | 'FUZZY' | 'MISMATCH';
  dateMatched: 'EXACT' | 'TOLERANCE' | 'MISMATCH';
  taxableValueMatched: 'EXACT' | 'TOLERANCE' | 'MISMATCH';
  taxAmountMatched: 'EXACT' | 'TOLERANCE' | 'MISMATCH';
}

export interface GSTR2BMatchResultItem {
  id: string;
  purchaseRecord?: {
    id: string;
    voucherNumber?: string;
    invoiceNumber: string;
    date: string;
    partyName: string;
    gstin: string;
    ledgerAccount?: string;
    placeOfSupply?: string;
    taxableValue: number;
    taxAmount: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess?: number;
    isBlockedItc?: boolean;
    reasonForBlocked?: string;
    itcEligibility?: string;
    paymentStatus?: 'PAID' | 'PAYMENT_HELD' | 'PENDING' | 'OVERDUE';
  };
  gstr2bRecord?: GSTR2BPortalRecord;
  status: GSTR2BMatchStatus;
  matchingScore: number; // 0 to 100%
  taxDifference: number;
  discrepancyCategory: string;
  discrepancies: string[];
  statutoryClause: string;
  recommendedAction: string;
  matchLevel?: 1 | 2 | 3 | 4 | 5;
  fiveWayMatch?: FiveWayMatchDetails;
  actionStatus?: 'PENDING_REVIEW' | 'ACCEPTED_OVERRIDE' | 'SUPPLIER_NOTICE_SENT' | 'PAYMENT_HELD' | 'DEFERRED_NEXT_MONTH';
  auditRemarks?: string;
}

export interface GSTR2BMatchingSummary {
  totalPurchaseInvoices: number;
  totalGstr2bInvoices: number;
  exactMatchesCount: number;
  discrepanciesCount: number;
  missingInGstr2bCount: number;
  missingInBooksCount: number;
  sec17BlockedCount: number;
  totalBooksTaxAmount: number;
  totalGstr2bTaxAmount: number;
  claimableItcAmount: number;
  atRiskItcAmount: number;
  reconciliationMatchRate: number; // 0 to 100%
}

/**
 * Automated GSTR-2B vs. Purchase Register Matching Service
 * Executes multi-dimensional reconciliations between internal ERP purchase books
 * and auto-populated GSTR-2B data filed by suppliers under CGST Rules 36(4) & Section 16(2)(aa).
 */
export class GSTR2BMatchingService {
  /**
   * Normalizes invoice numbers for lenient matching (removes symbols, spaces, leading zeros)
   */
  private static normalizeInvoiceNo(num: string): string {
    if (!num) return '';
    return num.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '');
  }

  /**
   * Calculates difference in days between two YYYY-MM-DD date strings
   */
  private static calculateDayDiff(d1Str: string, d2Str: string): number {
    try {
      const d1 = new Date(d1Str);
      const d2 = new Date(d2Str);
      const diffMs = Math.abs(d2.getTime() - d1.getTime());
      return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    } catch {
      return 999;
    }
  }

  /**
   * Primary matching execution function comparing Purchase Register to GSTR-2B
   */
  public static matchGSTR2BWithPurchaseRegister(
    purchaseInvoices: Invoice[],
    gstr2bRecords: GSTR2BPortalRecord[],
    config: GSTR2BMatchingConfig = DEFAULT_GSTR2B_MATCHING_CONFIG
  ): {
    results: GSTR2BMatchResultItem[];
    summary: GSTR2BMatchingSummary;
  } {
    const results: GSTR2BMatchResultItem[] = [];
    const matched2bIds = new Set<string>();

    // Safeguard config defaults
    const dateToleranceDays = config.dateToleranceDays ?? 7;
    const taxAmountTolerance = config.taxAmountTolerance ?? 10;
    const taxableValueTolerance = config.taxableValueTolerance ?? 100;
    const fuzzyInvoiceMatching = config.fuzzyInvoiceMatching ?? true;
    const enforceGstinStrictMatch = config.enforceGstinStrictMatch ?? true;

    // Filter purchase invoices for Purchase category
    const purchases = purchaseInvoices.filter(i => i.category === 'PURCHASE' || i.category === undefined);

    let exactMatchesCount = 0;
    let discrepanciesCount = 0;
    let missingInGstr2bCount = 0;
    let missingInBooksCount = 0;
    let sec17BlockedCount = 0;

    let totalBooksTaxAmount = 0;
    let totalGstr2bTaxAmount = 0;
    let claimableItcAmount = 0;
    let atRiskItcAmount = 0;

    // 1. Process all internal Purchase Register Records against GSTR-2B
    purchases.forEach((books, index) => {
      const booksTaxable = books.amount || books.taxDetails?.taxableValue || 0;
      const booksTax = books.taxAmount || 0;
      const booksIgst = books.taxDetails?.igst || 0;
      const booksCgst = books.taxDetails?.cgst || 0;
      const booksSgst = books.taxDetails?.sgst || 0;

      totalBooksTaxAmount += booksTax;

      const booksRecordFormatted = {
        id: books.id,
        invoiceNumber: books.invoiceNumber,
        date: books.date,
        partyName: books.partyName,
        gstin: books.gstin,
        taxableValue: booksTaxable,
        taxAmount: booksTax,
        igst: booksIgst,
        cgst: booksCgst,
        sgst: booksSgst,
        isBlockedItc: books.isBlockedItc,
        reasonForBlocked: books.reasonForBlocked,
      };

      const normBooksNo = this.normalizeInvoiceNo(books.invoiceNumber);
      const normBooksGstin = (books.gstin || '').trim().toUpperCase();

      let bestCandidate: GSTR2BPortalRecord | null = null;
      let maxScore = -1;
      let candidateReasons: string[] = [];
      let bestFiveWayMatch: FiveWayMatchDetails = {
        gstinMatched: false,
        invoiceNoMatched: 'MISMATCH',
        dateMatched: 'MISMATCH',
        taxableValueMatched: 'MISMATCH',
        taxAmountMatched: 'MISMATCH'
      };

      gstr2bRecords.forEach((portal) => {
        if (matched2bIds.has(portal.id)) return;

        let score = 0;
        const reasons: string[] = [];
        const fiveWay: FiveWayMatchDetails = {
          gstinMatched: false,
          invoiceNoMatched: 'MISMATCH',
          dateMatched: 'MISMATCH',
          taxableValueMatched: 'MISMATCH',
          taxAmountMatched: 'MISMATCH'
        };

        // Component 1: GSTIN Alignment (20 points)
        const normPortalGstin = (portal.gstin || '').trim().toUpperCase();
        if (normBooksGstin && normBooksGstin === normPortalGstin) {
          fiveWay.gstinMatched = true;
          score += 20;
        } else if (enforceGstinStrictMatch) {
          return; // Strict GSTIN requirement
        } else {
          reasons.push(`GSTIN Mismatch: Books (${normBooksGstin}) vs 2B (${normPortalGstin})`);
        }

        // Component 2: Invoice Number Match (20 points)
        const normPortalNo = this.normalizeInvoiceNo(portal.invoiceNumber);
        if (normBooksNo === normPortalNo) {
          fiveWay.invoiceNoMatched = 'EXACT';
          score += 20;
        } else if (
          fuzzyInvoiceMatching &&
          (normBooksNo.endsWith(normPortalNo) || normPortalNo.endsWith(normBooksNo)) &&
          Math.min(normBooksNo.length, normPortalNo.length) >= 3
        ) {
          fiveWay.invoiceNoMatched = 'FUZZY';
          score += 15;
          reasons.push(`Lenient Invoice No. Match: ${books.invoiceNumber} ~ ${portal.invoiceNumber}`);
        } else {
          reasons.push(`Invoice No. Mismatch: Books (${books.invoiceNumber}) vs 2B (${portal.invoiceNumber})`);
        }

        // Component 3: Invoice Date Match (20 points)
        const dayDiff = this.calculateDayDiff(books.date, portal.invoiceDate);
        if (dayDiff === 0) {
          fiveWay.dateMatched = 'EXACT';
          score += 20;
        } else if (dayDiff <= dateToleranceDays) {
          fiveWay.dateMatched = 'TOLERANCE';
          score += 15;
          reasons.push(`Date variance: ${dayDiff} days difference`);
        } else {
          reasons.push(`Invoice Date out of tolerance window (${dayDiff} days)`);
        }

        // Component 4: Taxable Value Match (20 points)
        const booksTaxableVal = booksTaxable;
        const portalTaxableVal = portal.taxableValue || 0;
        const valDiff = Math.abs(booksTaxableVal - portalTaxableVal);
        if (valDiff === 0) {
          fiveWay.taxableValueMatched = 'EXACT';
          score += 20;
        } else if (valDiff <= taxableValueTolerance) {
          fiveWay.taxableValueMatched = 'TOLERANCE';
          score += 15;
          reasons.push(`Minor Taxable Value Difference: ₹${valDiff.toFixed(2)} within tolerance`);
        } else {
          reasons.push(`Taxable Value Mismatch: Books ₹${booksTaxableVal.toLocaleString()} vs 2B ₹${portalTaxableVal.toLocaleString()}`);
        }

        // Component 5: Total Tax Amount Match (20 points)
        const portalTax = portal.totalTax || 0;
        const taxDiff = Math.abs(booksTax - portalTax);
        if (taxDiff === 0) {
          fiveWay.taxAmountMatched = 'EXACT';
          score += 20;
        } else if (taxDiff <= taxAmountTolerance) {
          fiveWay.taxAmountMatched = 'TOLERANCE';
          score += 15;
          reasons.push(`Minor Tax Difference: ₹${taxDiff.toFixed(2)} within tolerance`);
        } else {
          reasons.push(`Tax Amount Mismatch: Books ₹${booksTax.toLocaleString()} vs 2B ₹${portalTax.toLocaleString()}`);
        }

        if (score > maxScore) {
          maxScore = score;
          bestCandidate = portal;
          candidateReasons = reasons;
          bestFiveWayMatch = fiveWay;
        }
      });

      // Classification Logic (Multi-level mapping)
      if (bestCandidate && maxScore >= 40) {
        const portal: GSTR2BPortalRecord = bestCandidate;
        matched2bIds.add(portal.id);

        const portalTax = portal.totalTax || 0;
        const taxDiff = Math.abs(booksTax - portalTax);
        const dayDiff = this.calculateDayDiff(books.date, portal.invoiceDate);

        // Check for tax head (IGST vs CGST/SGST) mismatch
        const isTaxHeadMismatch =
          (booksIgst > 0 && portal.igst === 0 && (portal.cgst > 0 || portal.sgst > 0)) ||
          (booksCgst > 0 && portal.cgst === 0 && portal.igst > 0);

        // Check for statutory Sec 17(5) block in books or 2B
        const isSec17Blocked = books.isBlockedItc || portal.itcAvailability === 'BLOCKED' || portal.itcAvailability === 'INELIGIBLE';

        // Multi-level hierarchy assignment (Levels 1 to 4)
        let matchLevel: 1 | 2 | 3 | 4 | 5 = 4;
        if (
          bestFiveWayMatch.gstinMatched &&
          bestFiveWayMatch.invoiceNoMatched === 'EXACT' &&
          bestFiveWayMatch.dateMatched === 'EXACT' &&
          bestFiveWayMatch.taxableValueMatched === 'EXACT' &&
          bestFiveWayMatch.taxAmountMatched === 'EXACT'
        ) {
          matchLevel = 1; // Level 1: Perfect 5-Way Match
        } else if (
          bestFiveWayMatch.gstinMatched &&
          bestFiveWayMatch.invoiceNoMatched === 'EXACT' &&
          bestFiveWayMatch.dateMatched === 'EXACT' &&
          (bestFiveWayMatch.taxableValueMatched === 'TOLERANCE' || bestFiveWayMatch.taxAmountMatched === 'TOLERANCE')
        ) {
          matchLevel = 2; // Level 2: Strict Match with Rounding Variance
        } else if (
          bestFiveWayMatch.gstinMatched &&
          (bestFiveWayMatch.invoiceNoMatched === 'FUZZY' || bestFiveWayMatch.dateMatched === 'TOLERANCE') &&
          bestFiveWayMatch.taxAmountMatched !== 'MISMATCH'
        ) {
          matchLevel = 3; // Level 3: Lenient Match (Fuzzy ID or Filing Delay)
        } else {
          matchLevel = 4; // Level 4: Probable Match (Tax head/large value deviations)
        }

        if (isSec17Blocked) {
          sec17BlockedCount++;
          atRiskItcAmount += booksTax;
          results.push({
            id: `g2b-match-${index}`,
            purchaseRecord: booksRecordFormatted,
            gstr2bRecord: portal,
            status: 'SECTION_17_5_BLOCKED',
            matchingScore: maxScore,
            taxDifference: taxDiff,
            discrepancyCategory: 'Section 17(5) Ineligible ITC',
            discrepancies: [
              books.reasonForBlocked || portal.ineligibilityReason || 'ITC restricted under Section 17(5) of CGST Act'
            ],
            statutoryClause: 'CGST Act Section 17(5) / Rule 36(4)',
            recommendedAction: 'Do NOT claim ITC in GSTR-3B Table 4(A). Tag as Ineligible ITC under Table 4(B)(1).',
            matchLevel,
            fiveWayMatch: bestFiveWayMatch
          });
        } else if (isTaxHeadMismatch) {
          discrepanciesCount++;
          atRiskItcAmount += booksTax;
          results.push({
            id: `g2b-match-${index}`,
            purchaseRecord: booksRecordFormatted,
            gstr2bRecord: portal,
            status: 'TAX_HEAD_MISMATCH',
            matchingScore: maxScore,
            taxDifference: taxDiff,
            discrepancyCategory: 'Tax Head Mismatch (IGST vs CGST/SGST)',
            discrepancies: [
              `Books tax head (${booksIgst > 0 ? 'IGST' : 'CGST+SGST'}) conflicts with GSTR-2B (${portal.igst > 0 ? 'IGST' : 'CGST+SGST'})`
            ],
            statutoryClause: 'CGST Act Section 12/13 - Place of Supply Rules',
            recommendedAction: 'Verify Place of Supply and ask vendor to correct tax head in GSTR-1 amendment.',
            matchLevel,
            fiveWayMatch: bestFiveWayMatch
          });
        } else if (taxDiff > taxAmountTolerance) {
          discrepanciesCount++;
          atRiskItcAmount += Math.abs(booksTax - portalTax);
          claimableItcAmount += Math.min(booksTax, portalTax);

          results.push({
            id: `g2b-match-${index}`,
            purchaseRecord: booksRecordFormatted,
            gstr2bRecord: portal,
            status: 'AMOUNT_MISMATCH',
            matchingScore: maxScore,
            taxDifference: taxDiff,
            discrepancyCategory: 'Tax Amount Variance',
            discrepancies: [
              `Books Tax: ₹${booksTax.toLocaleString()} vs GSTR-2B Tax: ₹${portalTax.toLocaleString()} (Diff: ₹${taxDiff.toFixed(2)})`
            ],
            statutoryClause: 'CGST Act Section 16(2)(aa) - Credit capped to GSTR-2B',
            recommendedAction: booksTax > portalTax
              ? `Claim lower GSTR-2B amount (₹${portalTax.toLocaleString()}) and request vendor GSTR-1 amendment for ₹${taxDiff.toFixed(2)}.`
              : 'Accept higher GSTR-2B credit or reconcile purchase entry.',
            matchLevel,
            fiveWayMatch: bestFiveWayMatch
          });
        } else if (dayDiff > dateToleranceDays) {
          discrepanciesCount++;
          claimableItcAmount += booksTax;

          results.push({
            id: `g2b-match-${index}`,
            purchaseRecord: booksRecordFormatted,
            gstr2bRecord: portal,
            status: 'DATE_MISMATCH',
            matchingScore: maxScore,
            taxDifference: taxDiff,
            discrepancyCategory: 'Filing Date Delay',
            discrepancies: [
              `Invoice date delay of ${dayDiff} days between internal books (${books.date}) and GSTR-2B (${portal.invoiceDate})`
            ],
            statutoryClause: 'CGST Act Section 16(4) - Time Limit for Claiming ITC',
            recommendedAction: 'Verify filing tax period and ensure claim is made before Section 16(4) deadline.',
            matchLevel,
            fiveWayMatch: bestFiveWayMatch
          });
        } else {
          exactMatchesCount++;
          claimableItcAmount += booksTax;

          results.push({
            id: `g2b-match-${index}`,
            purchaseRecord: booksRecordFormatted,
            gstr2bRecord: portal,
            status: 'EXACT_MATCH',
            matchingScore: maxScore,
            taxDifference: 0,
            discrepancyCategory: 'Fully Reconciled',
            discrepancies: [],
            statutoryClause: 'CGST Act Section 16(2) - Compliant ITC',
            recommendedAction: 'Fully eligible for GSTR-3B Table 4(A)(5) ITC claim.',
            matchLevel,
            fiveWayMatch: bestFiveWayMatch
          });
        }
      } else {
        // No matching record found in GSTR-2B (Level 5: Unmatched)
        missingInGstr2bCount++;
        atRiskItcAmount += booksTax;

        const isSec17Blocked = books.isBlockedItc;

        results.push({
          id: `g2b-match-${index}`,
          purchaseRecord: booksRecordFormatted,
          status: 'MISSING_IN_GSTR2B',
          matchingScore: 0,
          taxDifference: booksTax,
          discrepancyCategory: 'Unfiled Supplier Invoice (Missing in 2B)',
          discrepancies: [
            `Supplier (${books.partyName} - ${books.gstin}) has NOT filed invoice in GSTR-1/2B yet.`
          ],
          statutoryClause: 'CGST Act Section 16(2)(aa) - Strict GSTR-2B Auto-Population Restriction',
          recommendedAction: isSec17Blocked
            ? 'Invoice is also blocked under Sec 17(5). Do not claim.'
            : 'Hold ITC claim in GSTR-3B. Send formal communication to supplier asking them to file GSTR-1.',
          matchLevel: 5,
          fiveWayMatch: {
            gstinMatched: false,
            invoiceNoMatched: 'MISMATCH',
            dateMatched: 'MISMATCH',
            taxableValueMatched: 'MISMATCH',
            taxAmountMatched: 'MISMATCH'
          }
        });
      }
    });

    // 2. Capture GSTR-2B records that were NOT matched to any Purchase Register invoice (Level 5: Unmatched)
    gstr2bRecords.forEach((portal, pIdx) => {
      totalGstr2bTaxAmount += portal.totalTax || 0;

      if (!matched2bIds.has(portal.id)) {
        missingInBooksCount++;

        results.push({
          id: `g2b-portal-only-${pIdx}`,
          gstr2bRecord: portal,
          status: 'MISSING_IN_BOOKS',
          matchingScore: 0,
          taxDifference: portal.totalTax,
          discrepancyCategory: 'Unrecorded Purchase (Missing in Books)',
          discrepancies: [
            `Supplier ${portal.supplierName} filed invoice ${portal.invoiceNumber} in GSTR-2B, but no entry exists in Purchase Register.`
          ],
          statutoryClause: 'CGST Act Section 16(2)(a) - Physical Invoice/Goods Receipt Verification',
          recommendedAction: 'Verify physical goods receipt/invoice and enter transaction in internal purchase accounting books.',
          matchLevel: 5,
          fiveWayMatch: {
            gstinMatched: false,
            invoiceNoMatched: 'MISMATCH',
            dateMatched: 'MISMATCH',
            taxableValueMatched: 'MISMATCH',
            taxAmountMatched: 'MISMATCH'
          }
        });
      }
    });

    const totalProcessed = purchases.length + missingInBooksCount;
    const reconciliationMatchRate = totalProcessed > 0
      ? Math.round((exactMatchesCount / totalProcessed) * 100)
      : 100;

    return {
      results,
      summary: {
        totalPurchaseInvoices: purchases.length,
        totalGstr2bInvoices: gstr2bRecords.length,
        exactMatchesCount,
        discrepanciesCount,
        missingInGstr2bCount,
        missingInBooksCount,
        sec17BlockedCount,
        totalBooksTaxAmount,
        totalGstr2bTaxAmount,
        claimableItcAmount,
        atRiskItcAmount,
        reconciliationMatchRate
      }
    };
  }

  /**
   * Generates mock GSTR-2B portal data for testing & simulation when live GSP connection is inactive
   */
  public static generateMockGSTR2BData(purchaseInvoices: Invoice[]): GSTR2BPortalRecord[] {
    const purchases = purchaseInvoices.filter(i => i.category === 'PURCHASE' || i.category === undefined);
    
    const records: GSTR2BPortalRecord[] = purchases.map((inv, idx) => {
      const tax = inv.taxAmount || 0;
      const taxable = inv.amount || inv.taxDetails?.taxableValue || 0;
      const igst = inv.taxDetails?.igst || tax;
      const cgst = inv.taxDetails?.cgst || 0;
      const sgst = inv.taxDetails?.sgst || 0;

      // Introduce controlled discrepancies for realistic automated testing
      if (idx === 1) {
        // Amount mismatch
        return {
          id: `g2b-rec-${idx}`,
          gstin: inv.gstin || '27ABCDE1234F1Z1',
          supplierName: inv.partyName || 'Supplier',
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.date,
          invoiceType: 'B2B',
          taxableValue: taxable - 500,
          totalTax: Math.max(0, tax - 90),
          igst: Math.max(0, igst - 90),
          cgst: 0,
          sgst: 0,
          cess: 0,
          gstr1FilingPeriod: '072026',
          gstr1FilingDate: '2026-08-11',
          itcAvailability: 'ELIGIBLE'
        };
      } else if (idx === 2) {
        // Date mismatch
        const d = new Date(inv.date || '2026-08-01');
        d.setDate(d.getDate() + 12);
        return {
          id: `g2b-rec-${idx}`,
          gstin: inv.gstin || '27ABCDE1234F1Z2',
          supplierName: inv.partyName || 'Supplier',
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: d.toISOString().split('T')[0],
          invoiceType: 'B2B',
          taxableValue: taxable,
          totalTax: tax,
          igst,
          cgst,
          sgst,
          cess: 0,
          gstr1FilingPeriod: '082026',
          gstr1FilingDate: '2026-08-13',
          itcAvailability: 'ELIGIBLE'
        };
      } else if (idx === 4) {
        // Ineligible / Blocked under Sec 17(5)
        return {
          id: `g2b-rec-${idx}`,
          gstin: inv.gstin || '27ABCDE1234F1Z4',
          supplierName: inv.partyName || 'Supplier',
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.date,
          invoiceType: 'B2B',
          taxableValue: taxable,
          totalTax: tax,
          igst,
          cgst,
          sgst,
          cess: 0,
          gstr1FilingPeriod: '072026',
          itcAvailability: 'BLOCKED',
          ineligibilityReason: 'Motor Vehicle Service blocked under Section 17(5)(a)'
        };
      }

      // Exact match for others
      return {
        id: `g2b-rec-${idx}`,
        gstin: inv.gstin || `27ABCDE1234F1Z${idx}`,
        supplierName: inv.partyName || `Vendor ${idx}`,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.date,
        invoiceType: 'B2B',
        taxableValue: taxable,
        totalTax: tax,
        igst,
        cgst,
        sgst,
        cess: 0,
        gstr1FilingPeriod: '072026',
        gstr1FilingDate: '2026-08-10',
        itcAvailability: 'ELIGIBLE'
      };
    });

    // Add extra GSTR-2B record missing in Books
    records.push({
      id: 'g2b-rec-extra-1',
      gstin: '27DEFGH9999K1Z8',
      supplierName: 'National Logistics Express Corp',
      invoiceNumber: 'NLE/2026/8812',
      invoiceDate: '2026-08-05',
      invoiceType: 'B2B',
      taxableValue: 45000,
      totalTax: 8100,
      igst: 8100,
      cgst: 0,
      sgst: 0,
      cess: 0,
      gstr1FilingPeriod: '072026',
      gstr1FilingDate: '2026-08-11',
      itcAvailability: 'ELIGIBLE'
    });

    return records;
  }

  /**
   * Reconciles Internal Ledger Entries with GSTR-2B Portal Records directly
   */
  public static reconcileLedgerWith2B(
    ledgerEntries: InternalLedgerEntry[],
    gstr2bRecords: GSTR2BPortalRecord[],
    config: GSTR2BMatchingConfig = DEFAULT_GSTR2B_MATCHING_CONFIG
  ): {
    results: GSTR2BMatchResultItem[];
    summary: GSTR2BMatchingSummary;
  } {
    // Transform internal ledger entries into Invoice shape for reconciliation
    const syntheticInvoices: Invoice[] = ledgerEntries.map(entry => ({
      id: entry.id,
      invoiceNumber: entry.invoiceNumber,
      date: entry.invoiceDate,
      partyName: entry.supplierName,
      gstin: entry.supplierGstin,
      category: 'PURCHASE',
      amount: entry.taxableAmount,
      taxAmount: entry.totalTax,
      totalAmount: entry.totalInvoiceValue,
      status: 'PAID',
      tenantId: 't1',
      type: 'B2B',
      docType: 'INVOICE',
      placeOfSupply: entry.placeOfSupply || '27-Maharashtra',
      taxDetails: {
        taxableValue: entry.taxableAmount,
        cgst: entry.cgst,
        sgst: entry.sgst,
        igst: entry.igst,
        utgst: 0,
        cess: entry.cess
      },
      isBlockedItc: entry.isSec17Blocked,
      reasonForBlocked: entry.blockedReason
    }));

    const matchOutcome = this.matchGSTR2BWithPurchaseRegister(syntheticInvoices, gstr2bRecords, config);

    // Enrich results with ledger specific fields
    const enrichedResults = matchOutcome.results.map(res => {
      const matchedLedger = ledgerEntries.find(l => l.id === res.purchaseRecord?.id || l.invoiceNumber === res.purchaseRecord?.invoiceNumber);
      if (matchedLedger && res.purchaseRecord) {
        res.purchaseRecord.voucherNumber = matchedLedger.voucherNumber;
        res.purchaseRecord.ledgerAccount = matchedLedger.ledgerAccount;
        res.purchaseRecord.placeOfSupply = matchedLedger.placeOfSupply;
        res.purchaseRecord.itcEligibility = matchedLedger.itcEligibility;
        res.purchaseRecord.paymentStatus = matchedLedger.paymentStatus;
      }
      return res;
    });

    return {
      results: enrichedResults,
      summary: matchOutcome.summary
    };
  }

  /**
   * Generates benchmark high-fidelity datasets for specific tax periods
   */
  public static generatePeriodDataset(period: string = 'August 2026'): {
    ledgerEntries: InternalLedgerEntry[];
    gstr2bRecords: GSTR2BPortalRecord[];
  } {
    const isJuly = period.includes('July') || period.includes('07');
    const isJune = period.includes('June') || period.includes('06');
    const isMay = period.includes('May') || period.includes('05');

    const prefixDate = isJuly ? '2026-07' : isJune ? '2026-06' : isMay ? '2026-05' : '2026-08';
    const filingPeriod = isJuly ? '072026' : isJune ? '062026' : isMay ? '052026' : '082026';
    const filingDate = `${prefixDate}-12`;

    const ledgerEntries: InternalLedgerEntry[] = [
      {
        id: 'ledg-001',
        voucherNumber: `PV/${prefixDate.replace('-', '')}/0101`,
        voucherDate: `${prefixDate}-02`,
        invoiceNumber: 'INV-INFRA-8801',
        invoiceDate: `${prefixDate}-02`,
        supplierName: 'Tata Steel Processing & Distribution Ltd',
        supplierGstin: '27AAACT2727Q1ZW',
        ledgerAccount: 'Raw Materials & Steel Inventory',
        placeOfSupply: '27-Maharashtra',
        taxableAmount: 480000,
        taxRate: 18,
        cgst: 43200,
        sgst: 43200,
        igst: 0,
        cess: 0,
        totalTax: 86400,
        totalInvoiceValue: 566400,
        isSec17Blocked: false,
        itcEligibility: 'INPUTS',
        paymentStatus: 'PAID'
      },
      {
        id: 'ledg-002',
        voucherNumber: `PV/${prefixDate.replace('-', '')}/0102`,
        voucherDate: `${prefixDate}-04`,
        invoiceNumber: 'INV/2026/0921',
        invoiceDate: `${prefixDate}-03`,
        supplierName: 'Infosys BPM Cloud Solutions Ltd',
        supplierGstin: '29AABCI1234F1Z8',
        ledgerAccount: 'IT & Cloud Infrastructure',
        placeOfSupply: '27-Maharashtra',
        taxableAmount: 125000,
        taxRate: 18,
        cgst: 0,
        sgst: 0,
        igst: 22500,
        cess: 0,
        totalTax: 22500,
        totalInvoiceValue: 147500,
        isSec17Blocked: false,
        itcEligibility: 'INPUT_SERVICES',
        paymentStatus: 'PAID'
      },
      {
        id: 'ledg-003',
        voucherNumber: `PV/${prefixDate.replace('-', '')}/0103`,
        voucherDate: `${prefixDate}-06`,
        invoiceNumber: 'LGT-DEL-4419',
        invoiceDate: `${prefixDate}-05`,
        supplierName: 'Blue Dart Express Freight Ltd',
        supplierGstin: '27AAACB2014P1ZV',
        ledgerAccount: 'Freight & Courier Outward',
        placeOfSupply: '27-Maharashtra',
        taxableAmount: 64000,
        taxRate: 18,
        cgst: 5760,
        sgst: 5760,
        igst: 0,
        cess: 0,
        totalTax: 11520,
        totalInvoiceValue: 75520,
        isSec17Blocked: false,
        itcEligibility: 'INPUT_SERVICES',
        paymentStatus: 'PENDING'
      },
      {
        id: 'ledg-004',
        voucherNumber: `PV/${prefixDate.replace('-', '')}/0104`,
        voucherDate: `${prefixDate}-08`,
        invoiceNumber: 'SHK-PKG-5512',
        invoiceDate: `${prefixDate}-07`,
        supplierName: 'Shree Krishna Packaging Industries',
        supplierGstin: '24AAECS9912K1Z3',
        ledgerAccount: 'Packaging Materials & Cartons',
        placeOfSupply: '27-Maharashtra',
        taxableAmount: 92000,
        taxRate: 12,
        cgst: 0,
        sgst: 0,
        igst: 11040,
        cess: 0,
        totalTax: 11040,
        totalInvoiceValue: 103040,
        isSec17Blocked: false,
        itcEligibility: 'INPUTS',
        paymentStatus: 'PAID'
      },
      {
        id: 'ledg-005',
        voucherNumber: `PV/${prefixDate.replace('-', '')}/0105`,
        voucherDate: `${prefixDate}-10`,
        invoiceNumber: 'AUTO-SERV-2201',
        invoiceDate: `${prefixDate}-09`,
        supplierName: 'Apex Motor Fleet Services Pvt Ltd',
        supplierGstin: '27AAACA9812M1Z0',
        ledgerAccount: 'Executive Fleet Maintenance',
        placeOfSupply: '27-Maharashtra',
        taxableAmount: 58000,
        taxRate: 18,
        cgst: 5220,
        sgst: 5220,
        igst: 0,
        cess: 0,
        totalTax: 10440,
        totalInvoiceValue: 68440,
        isSec17Blocked: true,
        blockedReason: 'Motor Vehicle servicing and passenger transport blocked under Section 17(5)(a)',
        itcEligibility: 'INELIGIBLE_17_5',
        paymentStatus: 'PAID'
      },
      {
        id: 'ledg-006',
        voucherNumber: `PV/${prefixDate.replace('-', '')}/0106`,
        voucherDate: `${prefixDate}-12`,
        invoiceNumber: 'HCL-HW-9912',
        invoiceDate: `${prefixDate}-11`,
        supplierName: 'HCL Tech Hardware Enterprise',
        supplierGstin: '33AAACH1919N1ZZ',
        ledgerAccount: 'Capital Plant & Server Hardware',
        placeOfSupply: '27-Maharashtra',
        taxableAmount: 320000,
        taxRate: 18,
        cgst: 0,
        sgst: 0,
        igst: 57600,
        cess: 0,
        totalTax: 57600,
        totalInvoiceValue: 377600,
        isSec17Blocked: false,
        itcEligibility: 'CAPITAL_GOODS',
        paymentStatus: 'PAID'
      },
      {
        id: 'ledg-007',
        voucherNumber: `PV/${prefixDate.replace('-', '')}/0107`,
        voucherDate: `${prefixDate}-15`,
        invoiceNumber: 'UNFILED-SUPP-101',
        invoiceDate: `${prefixDate}-14`,
        supplierName: 'Vanguard Industrial Chemicals LLP',
        supplierGstin: '27AABCV5512D1ZR',
        ledgerAccount: 'Industrial Chemicals & Reagents',
        placeOfSupply: '27-Maharashtra',
        taxableAmount: 180000,
        taxRate: 18,
        cgst: 16200,
        sgst: 16200,
        igst: 0,
        cess: 0,
        totalTax: 32400,
        totalInvoiceValue: 212400,
        isSec17Blocked: false,
        itcEligibility: 'INPUTS',
        paymentStatus: 'PAYMENT_HELD'
      },
      {
        id: 'ledg-008',
        voucherNumber: `PV/${prefixDate.replace('-', '')}/0108`,
        voucherDate: `${prefixDate}-18`,
        invoiceNumber: 'CAT-EXEC-404',
        invoiceDate: `${prefixDate}-17`,
        supplierName: 'Royal Gourmet Executive Catering',
        supplierGstin: '27AABCR8814E1Z6',
        ledgerAccount: 'Office Refreshment & Staff Welfare',
        placeOfSupply: '27-Maharashtra',
        taxableAmount: 42000,
        taxRate: 5,
        cgst: 1050,
        sgst: 1050,
        igst: 0,
        cess: 0,
        totalTax: 2100,
        totalInvoiceValue: 44100,
        isSec17Blocked: true,
        blockedReason: 'Food and beverages catering blocked under Section 17(5)(b)(i)',
        itcEligibility: 'INELIGIBLE_17_5',
        paymentStatus: 'PAID'
      },
      {
        id: 'ledg-009',
        voucherNumber: `PV/${prefixDate.replace('-', '')}/0109`,
        voucherDate: `${prefixDate}-20`,
        invoiceNumber: 'AMZ-AWS-CLOUD-09',
        invoiceDate: `${prefixDate}-19`,
        supplierName: 'Amazon Web Services India Pvt Ltd',
        supplierGstin: '27AABCA1299P1ZK',
        ledgerAccount: 'Cloud Hosting & Storage',
        placeOfSupply: '27-Maharashtra',
        taxableAmount: 85000,
        taxRate: 18,
        cgst: 7650,
        sgst: 7650,
        igst: 0,
        cess: 0,
        totalTax: 15300,
        totalInvoiceValue: 100300,
        isSec17Blocked: false,
        itcEligibility: 'INPUT_SERVICES',
        paymentStatus: 'PAID'
      }
    ];

    const gstr2bRecords: GSTR2BPortalRecord[] = [
      // 1. Tata Steel - Exact Match
      {
        id: 'g2b-001',
        gstin: '27AAACT2727Q1ZW',
        supplierName: 'Tata Steel Processing & Distribution Ltd',
        invoiceNumber: 'INV-INFRA-8801',
        invoiceDate: `${prefixDate}-02`,
        invoiceType: 'B2B',
        taxableValue: 480000,
        taxRate: 18,
        igst: 0,
        cgst: 43200,
        sgst: 43200,
        cess: 0,
        totalTax: 86400,
        gstr1FilingDate: filingDate,
        gstr1FilingPeriod: filingPeriod,
        itcAvailability: 'ELIGIBLE',
        placeOfSupply: '27-Maharashtra',
        supplierFilingStatus: 'ON_TIME'
      },
      // 2. Infosys - Amount Mismatch (₹22,500 vs ₹20,700 reported)
      {
        id: 'g2b-002',
        gstin: '29AABCI1234F1Z8',
        supplierName: 'Infosys BPM Cloud Solutions Ltd',
        invoiceNumber: 'INV/2026/0921',
        invoiceDate: `${prefixDate}-03`,
        invoiceType: 'B2B',
        taxableValue: 115000,
        taxRate: 18,
        igst: 20700,
        cgst: 0,
        sgst: 0,
        cess: 0,
        totalTax: 20700,
        gstr1FilingDate: filingDate,
        gstr1FilingPeriod: filingPeriod,
        itcAvailability: 'ELIGIBLE',
        placeOfSupply: '27-Maharashtra',
        supplierFilingStatus: 'ON_TIME'
      },
      // 3. Blue Dart - Date Mismatch (Filing delayed by 14 days)
      {
        id: 'g2b-003',
        gstin: '27AAACB2014P1ZV',
        supplierName: 'Blue Dart Express Freight Ltd',
        invoiceNumber: 'LGT-DEL-4419',
        invoiceDate: `${prefixDate}-19`,
        invoiceType: 'B2B',
        taxableValue: 64000,
        taxRate: 18,
        igst: 0,
        cgst: 5760,
        sgst: 5760,
        cess: 0,
        totalTax: 11520,
        gstr1FilingDate: `${prefixDate}-28`,
        gstr1FilingPeriod: filingPeriod,
        itcAvailability: 'ELIGIBLE',
        placeOfSupply: '27-Maharashtra',
        supplierFilingStatus: 'LATE'
      },
      // 4. Shree Krishna Packaging - Tax Head Mismatch (IGST in Books vs CGST+SGST in 2B)
      {
        id: 'g2b-004',
        gstin: '24AAECS9912K1Z3',
        supplierName: 'Shree Krishna Packaging Industries',
        invoiceNumber: 'SHK-PKG-5512',
        invoiceDate: `${prefixDate}-07`,
        invoiceType: 'B2B',
        taxableValue: 92000,
        taxRate: 12,
        igst: 0,
        cgst: 5520,
        sgst: 5520,
        cess: 0,
        totalTax: 11040,
        gstr1FilingDate: filingDate,
        gstr1FilingPeriod: filingPeriod,
        itcAvailability: 'ELIGIBLE',
        placeOfSupply: '24-Gujarat',
        supplierFilingStatus: 'ON_TIME'
      },
      // 5. Apex Motor - Blocked u/s 17(5)
      {
        id: 'g2b-005',
        gstin: '27AAACA9812M1Z0',
        supplierName: 'Apex Motor Fleet Services Pvt Ltd',
        invoiceNumber: 'AUTO-SERV-2201',
        invoiceDate: `${prefixDate}-09`,
        invoiceType: 'B2B',
        taxableValue: 58000,
        taxRate: 18,
        igst: 0,
        cgst: 5220,
        sgst: 5220,
        cess: 0,
        totalTax: 10440,
        gstr1FilingDate: filingDate,
        gstr1FilingPeriod: filingPeriod,
        itcAvailability: 'BLOCKED',
        ineligibilityReason: 'Restricted under Section 17(5)(a) - Motor Vehicle Servicing',
        placeOfSupply: '27-Maharashtra',
        supplierFilingStatus: 'ON_TIME'
      },
      // 6. HCL Tech - Exact Match
      {
        id: 'g2b-006',
        gstin: '33AAACH1919N1ZZ',
        supplierName: 'HCL Tech Hardware Enterprise',
        invoiceNumber: 'HCL-HW-9912',
        invoiceDate: `${prefixDate}-11`,
        invoiceType: 'B2B',
        taxableValue: 320000,
        taxRate: 18,
        igst: 57600,
        cgst: 0,
        sgst: 0,
        cess: 0,
        totalTax: 57600,
        gstr1FilingDate: filingDate,
        gstr1FilingPeriod: filingPeriod,
        itcAvailability: 'ELIGIBLE',
        placeOfSupply: '27-Maharashtra',
        supplierFilingStatus: 'ON_TIME'
      },
      // 7. Amazon AWS - Exact Match
      {
        id: 'g2b-009',
        gstin: '27AABCA1299P1ZK',
        supplierName: 'Amazon Web Services India Pvt Ltd',
        invoiceNumber: 'AMZ-AWS-CLOUD-09',
        invoiceDate: `${prefixDate}-19`,
        invoiceType: 'B2B',
        taxableValue: 85000,
        taxRate: 18,
        igst: 0,
        cgst: 7650,
        sgst: 7650,
        cess: 0,
        totalTax: 15300,
        gstr1FilingDate: filingDate,
        gstr1FilingPeriod: filingPeriod,
        itcAvailability: 'ELIGIBLE',
        placeOfSupply: '27-Maharashtra',
        supplierFilingStatus: 'ON_TIME'
      },
      // 8. Extra GSTR-2B entry (Missing in Books / Unrecorded Purchase)
      {
        id: 'g2b-extra-01',
        gstin: '27AAACS1198L1ZZ',
        supplierName: 'Schneider Electric Infrastructure Ltd',
        invoiceNumber: 'SEI/2026/0412',
        invoiceDate: `${prefixDate}-16`,
        invoiceType: 'B2B',
        taxableValue: 140000,
        taxRate: 18,
        igst: 0,
        cgst: 12600,
        sgst: 12600,
        cess: 0,
        totalTax: 25200,
        gstr1FilingDate: filingDate,
        gstr1FilingPeriod: filingPeriod,
        itcAvailability: 'ELIGIBLE',
        placeOfSupply: '27-Maharashtra',
        supplierFilingStatus: 'ON_TIME'
      }
    ];

    return {
      ledgerEntries,
      gstr2bRecords
    };
  }
}
