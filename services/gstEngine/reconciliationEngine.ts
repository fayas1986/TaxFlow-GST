import { ReconItem, ReconStatus } from '../../types';

export interface ReconciliationConfig {
  dateToleranceDays: number;
  taxAmountTolerance: number;
  matchInvoiceNumbersLeniently: boolean;
}

export const DEFAULT_RECON_CONFIG: ReconciliationConfig = {
  dateToleranceDays: 7,
  taxAmountTolerance: 100, // ₹100 tolerance
  matchInvoiceNumbersLeniently: true
};

export interface ReconciliationRecord {
  booksRecord?: {
    id: string;
    invoiceNumber: string;
    date: string;
    partyName: string;
    gstin: string;
    taxAmount: number;
  };
  portalRecord?: {
    id: string;
    invoiceNumber: string;
    date: string;
    partyName: string;
    gstin: string;
    taxAmount: number;
  };
  status: ReconStatus;
  matchingScore: number; // 0 to 100
  discrepancies: string[];
  suggestedAction: string;
}

/**
 * GST 2A/2B Auto-Reconciliation Domain Service
 */
export class GSTReconciliationEngine {
  /**
   * Cleans invoice numbers to allow lenient string similarity matches
   * (e.g. "INV-2026-001" and "INV2026001" or "001" can be matched logically)
   */
  private static normalizeInvoiceNumber(invNum: string): string {
    return invNum.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  /**
   * Helper to calculate day difference
   */
  private static getDayDifference(d1Str: string, d2Str: string): number {
    try {
      const d1 = new Date(d1Str);
      const d2 = new Date(d2Str);
      const diffTime = Math.abs(d2.getTime() - d1.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return 999;
    }
  }

  /**
   * Matches Books items (Purchase invoices) against GST Portal items (GSTR-2A / 2B)
   */
  public static reconcileGstData(
    booksInvoices: any[],
    portalInvoices: any[],
    config: ReconciliationConfig = DEFAULT_RECON_CONFIG
  ): ReconciliationRecord[] {
    const results: ReconciliationRecord[] = [];
    const matchedPortalIds = new Set<string>();

    booksInvoices.forEach((books) => {
      let bestMatch: any = null;
      let maxScore = -1;
      let bestReasons: string[] = [];

      portalInvoices.forEach((portal) => {
        if (matchedPortalIds.has(portal.id)) return;

        let score = 0;
        const reasons: string[] = [];

        // 1. GSTIN Match (Weight: 35)
        const gstinBooks = (books.gstin || '').toUpperCase().trim();
        const gstinPortal = (portal.gstin || '').toUpperCase().trim();
        if (gstinBooks && gstinBooks === gstinPortal) {
          score += 35;
        } else {
          reasons.push('GSTIN Mismatch');
        }

        // 2. Invoice Number Match (Weight: 35)
        const booksNumNorm = this.normalizeInvoiceNumber(books.invoiceNumber);
        const portalNumNorm = this.normalizeInvoiceNumber(portal.invoiceNumber);
        if (booksNumNorm === portalNumNorm) {
          score += 35;
        } else if (config.matchInvoiceNumbersLeniently && 
                  (booksNumNorm.endsWith(portalNumNorm) || portalNumNorm.endsWith(booksNumNorm)) &&
                  Math.min(booksNumNorm.length, portalNumNorm.length) >= 3) {
          score += 25;
          reasons.push('Lenient Invoice Number Match');
        } else {
          reasons.push('Invoice Number Mismatch');
        }

        // 3. Tax Amount Match (Weight: 20)
        const taxBooks = books.taxAmount || books.taxAmountBooks || 0;
        const taxPortal = portal.taxAmount || portal.taxAmountPortal || 0;
        const amtDiff = Math.abs(taxBooks - taxPortal);

        if (amtDiff === 0) {
          score += 20;
        } else if (amtDiff <= config.taxAmountTolerance) {
          score += 15;
          reasons.push(`Tax mismatch within tolerance: Diff ₹${amtDiff.toFixed(2)}`);
        } else {
          reasons.push(`Tax Amount discrepancy: books=₹${taxBooks}, portal=₹${taxPortal}`);
        }

        // 4. Date Match (Weight: 10)
        const dayDiff = this.getDayDifference(books.date, portal.date);
        if (dayDiff === 0) {
          score += 10;
        } else if (dayDiff <= config.dateToleranceDays) {
          score += 5;
          reasons.push(`Date delayed by ${dayDiff} days`);
        } else {
          reasons.push(`Date out of tolerance window (${dayDiff} days)`);
        }

        if (score > maxScore) {
          maxScore = score;
          bestMatch = portal;
          bestReasons = reasons;
        }
      });

      // Classify the match results
      if (bestMatch && maxScore >= 75) {
        matchedPortalIds.add(bestMatch.id);
        const taxBooks = books.taxAmount || books.taxAmountBooks || 0;
        const taxPortal = bestMatch.taxAmount || bestMatch.taxAmountPortal || 0;
        const amtDiff = Math.abs(taxBooks - taxPortal);
        const dayDiff = this.getDayDifference(books.date, bestMatch.date);

        const record: ReconciliationRecord = {
          booksRecord: books,
          portalRecord: bestMatch,
          status: 'MATCHED',
          matchingScore: maxScore,
          discrepancies: [],
          suggestedAction: 'None. Ready for ITC claim.'
        };

        if (amtDiff > 0 || dayDiff > 2) {
          record.status = 'PARTIAL_MATCH';
          if (amtDiff > 0) record.discrepancies.push(`Amount Diff: ₹${amtDiff.toFixed(2)}`);
          if (dayDiff > 2) record.discrepancies.push(`Filing Delay: ${dayDiff} days`);
          record.suggestedAction = amtDiff > 10 ? 'Accept with variance or reconcile manually.' : 'Auto-adjust minor rounding variance.';
        }

        results.push(record);
      } else if (bestMatch && maxScore >= 40) {
        matchedPortalIds.add(bestMatch.id);
        const taxBooks = books.taxAmount || books.taxAmountBooks || 0;
        const taxPortal = bestMatch.taxAmount || bestMatch.taxAmountPortal || 0;
        
        results.push({
          booksRecord: books,
          portalRecord: bestMatch,
          status: 'MISMATCH',
          matchingScore: maxScore,
          discrepancies: bestReasons,
          suggestedAction: taxBooks > taxPortal 
            ? 'Contact supplier to amend and upload invoice.' 
            : 'Claim lower ITC or hold for supplier verification.'
        });
      } else {
        // No match found in portal (GSTR-2B)
        results.push({
          booksRecord: books,
          status: 'MISSING_IN_PORTAL',
          matchingScore: 0,
          discrepancies: ['Invoice not filed by supplier.'],
          suggestedAction: 'Notify supplier to file their GSTR-1 for the corresponding period.'
        });
      }
    });

    // Capture portal items that had no corresponding records in books
    portalInvoices.forEach((portal) => {
      if (!matchedPortalIds.has(portal.id)) {
        results.push({
          portalRecord: portal,
          status: 'MISSING_IN_BOOKS',
          matchingScore: 0,
          discrepancies: ['No record exists in internal purchase register.'],
          suggestedAction: 'Verify physical receipts and enter transaction in internal accounting system.'
        });
      }
    });

    return results;
  }
}
