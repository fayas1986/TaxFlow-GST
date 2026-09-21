import { ReconItem, BankStatementTransaction, ReconMatchResult, AutoReconcileSummary } from '../types';

// Mock Bank Statement Transactions representing real corporate bank feeds (HDFC Bank & ICICI Bank)
export const MOCK_BANK_TRANSACTIONS: BankStatementTransaction[] = [
  {
    id: 'bt-101',
    txnDate: '2026-06-15',
    description: 'NEFT-ACME SUPPLIERS-27ABCDE1234F1Z1-INV/2026/089',
    amount: 18000,
    type: 'DEBIT',
    gstin: '27ABCDE1234F1Z1',
    partyName: 'Acme Corp',
    refNo: 'N1652098442',
    bankName: 'HDFC Corporate Bank',
    accountNumber: '•••• 8821'
  },
  {
    id: 'bt-102',
    txnDate: '2026-06-18',
    description: 'RTGS-GLOBAL LOGISTICS LTD-27GHIJK5678L1Z2-PAYMENT FOR INV-102',
    amount: 12500,
    type: 'DEBIT',
    gstin: '27GHIJK5678L1Z2',
    partyName: 'Global Logistics',
    refNo: 'R20260618099',
    bankName: 'HDFC Corporate Bank',
    accountNumber: '•••• 8821'
  },
  {
    id: 'bt-103',
    txnDate: '2026-06-21',
    description: 'UPI-TECHSUPPLIES INDIA-27MNOPQ9012R1Z3-REF 449201',
    amount: 4500, // Discrepancy example: Invoice amount is 4800, bank is 4500 (300 short)
    type: 'DEBIT',
    gstin: '27MNOPQ9012R1Z3',
    partyName: 'TechSupplies',
    refNo: 'UPI/20260621/4492',
    bankName: 'ICICI Commercial Bank',
    accountNumber: '•••• 4102'
  },
  {
    id: 'bt-104',
    txnDate: '2026-06-25',
    description: 'IMPS-FASTFREIGHT SERVICES-27STUVW3456X1Z4',
    amount: 9200,
    type: 'DEBIT',
    gstin: '27STUVW3456X1Z4',
    partyName: 'FastFreight',
    refNo: 'I20260625771',
    bankName: 'HDFC Corporate Bank',
    accountNumber: '•••• 8821'
  },
  {
    id: 'bt-105',
    txnDate: '2026-06-12',
    description: 'CMS CLEARING-WALKIN RETAIL CONSUMER-B2C SALES',
    amount: 25000,
    type: 'CREDIT',
    partyName: 'Walk-in Retail',
    refNo: 'CMS8820912',
    bankName: 'ICICI Commercial Bank',
    accountNumber: '•••• 4102'
  },
  {
    id: 'bt-106',
    txnDate: '2026-06-28',
    description: 'NEFT-ALPHA TRADERS-27XYZAB1234C1Z5-SALES RECEIPT',
    amount: 54000,
    type: 'CREDIT',
    gstin: '27XYZAB1234C1Z5',
    partyName: 'Alpha Traders',
    refNo: 'N20260628990',
    bankName: 'ICICI Commercial Bank',
    accountNumber: '•••• 4102'
  },
  {
    id: 'bt-107',
    txnDate: '2026-06-30',
    description: 'ACH-OMEGA INFRASTRUCTURE-27DEFGH5678I1Z6',
    amount: 14200, // Date delay: Invoice date was 2026-06-20 (10 days off)
    type: 'CREDIT',
    gstin: '27DEFGH5678I1Z6',
    partyName: 'Omega Infra',
    refNo: 'ACH7712093',
    bankName: 'HDFC Corporate Bank',
    accountNumber: '•••• 8821'
  }
];

export interface AutoReconcileConfig {
  dateToleranceDays: number; // e.g. 5 days
  amountTolerance: number; // e.g. 50 (₹)
  requireGstinMatch: boolean;
}

export const DEFAULT_CONFIG: AutoReconcileConfig = {
  dateToleranceDays: 5,
  amountTolerance: 50,
  requireGstinMatch: false
};

/**
 * Parses raw bank CSV content into BankStatementTransaction objects
 */
export const parseBankCsv = (csvText: string): BankStatementTransaction[] => {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
  
  const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('txn'));
  const descIdx = headers.findIndex(h => h.includes('desc') || h.includes('narration') || h.includes('particulars'));
  const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('val') || h.includes('debit') || h.includes('credit'));
  const typeIdx = headers.findIndex(h => h.includes('type') || h.includes('cr/dr') || h.includes('d/c'));
  const gstinIdx = headers.findIndex(h => h.includes('gstin') || h.includes('gst'));

  const parsed: BankStatementTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 2) continue;

    const dateVal = dateIdx >= 0 ? cols[dateIdx] : new Date().toISOString().split('T')[0];
    const descVal = descIdx >= 0 ? cols[descIdx] : cols[1] || 'Bank Transaction';
    const rawAmount = amountIdx >= 0 ? parseFloat(cols[amountIdx].replace(/[^0-9.-]/g, '')) || 0 : 0;
    const typeVal = typeIdx >= 0 && cols[typeIdx]?.toUpperCase().includes('CR') ? 'CREDIT' : 'DEBIT';
    const gstinVal = gstinIdx >= 0 ? cols[gstinIdx] : undefined;

    parsed.push({
      id: `bt-csv-${i}-${Date.now()}`,
      txnDate: dateVal,
      description: descVal,
      amount: Math.abs(rawAmount),
      type: typeVal,
      gstin: gstinVal,
      refNo: `REF-CSV-${i}`,
      bankName: 'Uploaded Statement',
      accountNumber: 'Imported File'
    });
  }

  return parsed;
};

/**
 * Calculates date difference in days between two ISO date strings (YYYY-MM-DD)
 */
const getDayDifference = (d1Str: string, d2Str: string): number => {
  try {
    const d1 = new Date(d1Str);
    const d2 = new Date(d2Str);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return 999;
  }
};

/**
 * Core Auto-Reconcile Matching Engine
 */
export const runAutoReconcile = (
  reconItems: ReconItem[],
  bankTransactions: BankStatementTransaction[],
  activeTab: 'PURCHASE' | 'SALES',
  config: AutoReconcileConfig = DEFAULT_CONFIG
): AutoReconcileSummary => {
  const targetTxnType: 'CREDIT' | 'DEBIT' = activeTab === 'PURCHASE' ? 'DEBIT' : 'CREDIT';
  
  // Filter bank transactions by type
  const relevantTxns = bankTransactions.filter(t => t.type === targetTxnType);
  const usedTxnIds = new Set<string>();

  const matchResults: ReconMatchResult[] = [];

  let exactMatchesCount = 0;
  let flaggedDiscrepanciesCount = 0;
  let unmatchedCount = 0;
  let totalInvoiceAmount = 0;
  let totalBankAmount = 0;
  let totalDiscrepancyAmount = 0;

  reconItems.forEach(item => {
    // Invoice amount from books or portal
    const invAmount = item.taxAmountBooks || item.taxAmountPortal || 0;
    totalInvoiceAmount += invAmount;

    let bestCandidate: BankStatementTransaction | null = null;
    let maxScore = -1;
    let bestReasons: string[] = [];

    relevantTxns.forEach(txn => {
      if (usedTxnIds.has(txn.id)) return;

      let score = 0;
      const reasons: string[] = [];

      // 1. GSTIN Match check (40 pts)
      const gstinInItem = item.gstin?.toUpperCase() || '';
      const gstinInTxn = txn.gstin?.toUpperCase() || '';
      const descUpper = txn.description.toUpperCase();

      let gstinMatched = false;
      if (gstinInItem && (gstinInTxn.includes(gstinInItem) || descUpper.includes(gstinInItem))) {
        score += 40;
        gstinMatched = true;
      } else if (item.partyName) {
        // Name overlap check (25 pts)
        const partyWords = item.partyName.toLowerCase().split(' ').filter(w => w.length > 3);
        const nameMatch = partyWords.some(word => descUpper.toLowerCase().includes(word));
        if (nameMatch) {
          score += 25;
        } else {
          reasons.push('GSTIN / Vendor name not matched in statement narration');
        }
      }

      // 2. Amount Match Check (40 pts)
      const amtDiff = Math.abs(invAmount - txn.amount);
      if (amtDiff === 0) {
        score += 40;
      } else if (amtDiff <= config.amountTolerance) {
        score += 25;
        reasons.push(`Minor amount discrepancy: Invoice ₹${invAmount.toLocaleString()} vs Bank ₹${txn.amount.toLocaleString()} (Diff ₹${amtDiff.toFixed(2)})`);
      } else if (amtDiff <= invAmount * 0.1) {
        score += 10;
        reasons.push(`Significant amount discrepancy: Invoice ₹${invAmount.toLocaleString()} vs Bank ₹${txn.amount.toLocaleString()} (Diff ₹${amtDiff.toFixed(2)})`);
      } else {
        reasons.push(`Large amount mismatch: Diff ₹${amtDiff.toFixed(2)}`);
      }

      // 3. Date Proximity Check (20 pts)
      const dayDiff = getDayDifference(item.date, txn.txnDate);
      if (dayDiff === 0) {
        score += 20;
      } else if (dayDiff <= 3) {
        score += 15;
      } else if (dayDiff <= config.dateToleranceDays) {
        score += 5;
        reasons.push(`Date variance: Invoice ${item.date} vs Bank ${txn.txnDate} (${dayDiff} days diff)`);
      } else {
        reasons.push(`Date out of tolerance: ${dayDiff} days difference`);
      }

      if (score > maxScore) {
        maxScore = score;
        bestCandidate = txn;
        bestReasons = reasons;
      }
    });

    // Classify match based on best candidate and score
    let confidence: ReconMatchResult['confidence'] = 'UNMATCHED';
    let status: ReconMatchResult['status'] = 'FLAGGED';
    const discrepancyReasons: string[] = [];

    if (bestCandidate && maxScore >= 75) {
      const candidate: BankStatementTransaction = bestCandidate;
      const amtDiff = Math.abs(invAmount - candidate.amount);
      const dayDiff = getDayDifference(item.date, candidate.txnDate);

      if (amtDiff === 0 && dayDiff <= 2) {
        confidence = 'EXACT';
        status = 'AUTO_MATCHED';
        exactMatchesCount++;
        usedTxnIds.add(candidate.id);
        totalBankAmount += candidate.amount;
      } else {
        confidence = 'DISCREPANCY';
        status = 'FLAGGED';
        flaggedDiscrepanciesCount++;
        usedTxnIds.add(candidate.id);
        totalBankAmount += candidate.amount;
        totalDiscrepancyAmount += amtDiff;

        if (amtDiff > 0) {
          discrepancyReasons.push(`Amount Variance: Invoice ₹${invAmount.toLocaleString()} vs Bank ₹${candidate.amount.toLocaleString()} (Diff ₹${amtDiff.toFixed(2)})`);
        }
        if (dayDiff > 2) {
          discrepancyReasons.push(`Date Delay: Transaction recorded ${dayDiff} days apart (${item.date} vs ${candidate.txnDate})`);
        }
      }
    } else if (bestCandidate && maxScore >= 45) {
      const candidate: BankStatementTransaction = bestCandidate;
      const amtDiff = Math.abs(invAmount - candidate.amount);
      confidence = 'PROBABLE';
      status = 'FLAGGED';
      flaggedDiscrepanciesCount++;
      usedTxnIds.add(candidate.id);
      totalBankAmount += candidate.amount;
      totalDiscrepancyAmount += amtDiff;

      discrepancyReasons.push(`Probable Match (Score ${maxScore}%): Flagged for manual verification.`);
      discrepancyReasons.push(...bestReasons);
    } else {
      confidence = 'UNMATCHED';
      status = 'FLAGGED';
      unmatchedCount++;
      totalDiscrepancyAmount += invAmount;
      discrepancyReasons.push('Missing in Bank Statement: No corresponding payment transaction found matching GSTIN, Date & Amount.');
    }

    matchResults.push({
      id: `match-${item.id}`,
      reconItemId: item.id,
      invoiceNumber: item.invoiceNumber,
      date: item.date,
      partyName: item.partyName,
      gstin: item.gstin,
      invoiceAmount: invAmount,
      bankTxn: bestCandidate || undefined,
      matchScore: Math.min(100, Math.max(0, maxScore)),
      confidence,
      status,
      discrepancyReasons
    });
  });

  return {
    totalProcessed: reconItems.length,
    exactMatchesCount,
    flaggedDiscrepanciesCount,
    unmatchedCount,
    totalInvoiceAmount,
    totalBankAmount,
    discrepancyAmount: totalDiscrepancyAmount,
    matches: matchResults
  };
};
