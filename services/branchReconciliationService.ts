import { Invoice, BankStatementTransaction, BranchDetailsItem, BranchDiscrepancyType, BranchReconMatch, BranchReconSummary, UserRole } from '../types';
import { ENTERPRISE_BRANCHES_BY_TENANT } from '../src/fixtures/enterpriseTenants';

// Standard mock bank accounts linked to corporate branches
export interface BranchBankAccount {
  branchId: string;
  branchName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  accountType: 'CURRENT' | 'OVERDRAFT' | 'ESCROW';
  openingBalance: number;
  currentBalance: number;
}

export const BRANCH_BANK_ACCOUNTS: Record<string, BranchBankAccount[]> = {
  'b1': [
    {
      branchId: 'b1',
      branchName: 'Mumbai HQ Office',
      bankName: 'HDFC Bank - BKC Branch',
      accountNumber: '50200014208821',
      ifscCode: 'HDFC0000014',
      accountType: 'CURRENT',
      openingBalance: 2450000,
      currentBalance: 3120450
    },
    {
      branchId: 'b1',
      branchName: 'Mumbai HQ Office',
      bankName: 'ICICI Bank - Fort Corporate',
      accountNumber: '001105009942',
      ifscCode: 'ICIC0000011',
      accountType: 'CURRENT',
      openingBalance: 1200000,
      currentBalance: 1540200
    }
  ],
  'b2': [
    {
      branchId: 'b2',
      branchName: 'Pune Software Lab',
      bankName: 'ICICI Bank - Hinjewadi Tech Park',
      accountNumber: '003905004102',
      ifscCode: 'ICIC0000039',
      accountType: 'CURRENT',
      openingBalance: 1850000,
      currentBalance: 2210800
    }
  ],
  'b3': [
    {
      branchId: 'b3',
      branchName: 'Nagpur Logistics Depot',
      bankName: 'State Bank of India - Nagpur Commercial',
      accountNumber: '33910009031',
      ifscCode: 'SBIN0003391',
      accountType: 'CURRENT',
      openingBalance: 980000,
      currentBalance: 1145000
    }
  ],
  'b4': [
    {
      branchId: 'b4',
      branchName: 'Nashik Component Plant',
      bankName: 'Axis Bank - Nashik Industrial Estate',
      accountNumber: '91802002245',
      ifscCode: 'UTIB0000918',
      accountType: 'CURRENT',
      openingBalance: 1420000,
      currentBalance: 1680900
    }
  ]
};

// Seed bank transactions for branches
export const SEED_BRANCH_BANK_TRANSACTIONS: BankStatementTransaction[] = [
  // Branch b1 (Mumbai HQ) - Transactions
  {
    id: 'bt-b1-01',
    txnDate: '2026-06-15',
    description: 'NEFT-TECH SOLUTIONS LTD-27ABCDE1234F1Z0-INV-2026-1000',
    amount: 14750,
    type: 'CREDIT',
    gstin: '27ABCDE1234F1Z0',
    partyName: 'Tech Solutions Ltd',
    refNo: 'N202606158819',
    bankName: 'HDFC Bank - BKC Branch',
    accountNumber: '50200014208821',
    branchId: 'b1',
    branchName: 'Mumbai HQ Office',
    costCenter: 'CC-MUM-101',
    category: 'CUSTOMER_RECEIPT'
  },
  {
    id: 'bt-b1-02',
    txnDate: '2026-06-19',
    description: 'RTGS-OFFICE SUPPLIES CO-27ABCDE1234F1Z1-PUR-2026-1001',
    amount: 9800, // Discrepancy: Inv 10,000, Bank 9,800 (₹200 TDS section 194C)
    type: 'DEBIT',
    gstin: '27ABCDE1234F1Z1',
    partyName: 'Office Supplies Co',
    refNo: 'R202606190042',
    bankName: 'HDFC Bank - BKC Branch',
    accountNumber: '50200014208821',
    branchId: 'b1',
    branchName: 'Mumbai HQ Office',
    costCenter: 'CC-MUM-101',
    category: 'VENDOR_PAYMENT'
  },
  {
    id: 'bt-b1-03',
    txnDate: '2026-06-28', // Delay: Invoice was dated 2026-06-18 (10 days lag)
    description: 'ACH CLG-GLOBAL TRADE LLC-EXPORT RECEIPT-INV-2026-1003',
    amount: 85000,
    type: 'CREDIT',
    partyName: 'Global Trade LLC',
    refNo: 'ACH771209388',
    bankName: 'HDFC Bank - BKC Branch',
    accountNumber: '50200014208821',
    branchId: 'b1',
    branchName: 'Mumbai HQ Office',
    costCenter: 'CC-MUM-101',
    category: 'CUSTOMER_RECEIPT'
  },
  {
    id: 'bt-b1-04',
    txnDate: '2026-06-22',
    description: 'IMPS-FASTFREIGHT LOGISTICS-27STUVW3456X1Z4-PUR-2026-1005',
    amount: 18450,
    type: 'DEBIT',
    gstin: '27STUVW3456X1Z4',
    partyName: 'FastFreight Logistics',
    refNo: 'I202606229910',
    bankName: 'HDFC Bank - BKC Branch',
    accountNumber: '50200014208821',
    branchId: 'b1',
    branchName: 'Mumbai HQ Office',
    costCenter: 'CC-MUM-101',
    category: 'VENDOR_PAYMENT'
  },
  {
    id: 'bt-b1-05',
    txnDate: '2026-06-30',
    description: 'BANK SERVICE CHARGES & GST - Q1 CURRENT A/C MAINTENANCE',
    amount: 1180,
    type: 'DEBIT',
    refNo: 'CHG2026063099',
    bankName: 'HDFC Bank - BKC Branch',
    accountNumber: '50200014208821',
    branchId: 'b1',
    branchName: 'Mumbai HQ Office',
    costCenter: 'CC-MUM-101',
    category: 'BANK_CHARGE'
  },

  // Branch b2 (Pune Software Lab) - Transactions
  {
    id: 'bt-b2-01',
    txnDate: '2026-06-14',
    description: 'NEFT-CLOUD HOSTING IN-27MNOPQ9012R1Z3-PUR-2026-1002',
    amount: 35400,
    type: 'DEBIT',
    gstin: '27MNOPQ9012R1Z3',
    partyName: 'Cloud Hosting India',
    refNo: 'N202606143301',
    bankName: 'ICICI Bank - Hinjewadi Tech Park',
    accountNumber: '003905004102',
    branchId: 'b2',
    branchName: 'Pune Software Lab',
    costCenter: 'CC-PUN-202',
    category: 'VENDOR_PAYMENT'
  },
  {
    id: 'bt-b2-02',
    txnDate: '2026-06-20',
    description: 'UPI-RETAIL CONSUMER PAYMENT-INV-2026-1004',
    amount: 12200, // Discrepancy: Invoice 12,500, Bank 12,200 (₹300 discount/round-off)
    type: 'CREDIT',
    partyName: 'Retail Consumer',
    refNo: 'UPI/20260620/9912',
    bankName: 'ICICI Bank - Hinjewadi Tech Park',
    accountNumber: '003905004102',
    branchId: 'b2',
    branchName: 'Pune Software Lab',
    costCenter: 'CC-PUN-202',
    category: 'CUSTOMER_RECEIPT'
  },
  {
    id: 'bt-b2-03',
    txnDate: '2026-06-25',
    description: 'CMS DIRECT CREDIT-INFRASTRUCTURE CLIENT-INV-2026-1006',
    amount: 58000,
    type: 'CREDIT',
    partyName: 'Tech Solutions Ltd',
    refNo: 'CMS2026062588',
    bankName: 'ICICI Bank - Hinjewadi Tech Park',
    accountNumber: '003905004102',
    branchId: 'b2',
    branchName: 'Pune Software Lab',
    costCenter: 'CC-PUN-202',
    category: 'CUSTOMER_RECEIPT'
  },

  // Branch b3 (Nagpur Logistics Depot) - Transactions
  {
    id: 'bt-b3-01',
    txnDate: '2026-06-16',
    description: 'RTGS-CENTRAL WAREHOUSING CORP-PUR-2026-1007',
    amount: 42000,
    type: 'DEBIT',
    partyName: 'Central Warehousing Corp',
    refNo: 'R202606169931',
    bankName: 'State Bank of India - Nagpur Commercial',
    accountNumber: '33910009031',
    branchId: 'b3',
    branchName: 'Nagpur Logistics Depot',
    costCenter: 'CC-NAG-303',
    category: 'VENDOR_PAYMENT'
  },
  {
    id: 'bt-b3-02',
    txnDate: '2026-06-24',
    description: 'NEFT-AGRO DISTRIBUTORS LTD-INV-2026-1008',
    amount: 67200,
    type: 'CREDIT',
    partyName: 'Agro Distributors Ltd',
    refNo: 'N202606248812',
    bankName: 'State Bank of India - Nagpur Commercial',
    accountNumber: '33910009031',
    branchId: 'b3',
    branchName: 'Nagpur Logistics Depot',
    costCenter: 'CC-NAG-303',
    category: 'CUSTOMER_RECEIPT'
  }
];

export interface BranchReconFilterConfig {
  dateToleranceDays: number;
  amountTolerance: number;
  categoryFilter: 'ALL' | 'SALES' | 'PURCHASE';
  statusFilter: 'ALL' | 'DISCREPANCIES' | 'RECONCILED' | 'UNMATCHED';
}

export const DEFAULT_BRANCH_RECON_CONFIG: BranchReconFilterConfig = {
  dateToleranceDays: 5,
  amountTolerance: 50,
  categoryFilter: 'ALL',
  statusFilter: 'ALL'
};

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
 * Executes Automated Branch-Specific Reconciliation
 * Matches invoices for the selected branch against bank statement transactions.
 */
export const runBranchReconciliation = (
  branchId: string,
  allInvoices: Invoice[],
  allBankTxns: BankStatementTransaction[] = SEED_BRANCH_BANK_TRANSACTIONS,
  config: BranchReconFilterConfig = DEFAULT_BRANCH_RECON_CONFIG,
  branchDetails?: BranchDetailsItem
): BranchReconSummary => {
  const isAllBranches = branchId === 'ALL';

  // 1. Filter invoices for target branch (or all)
  const targetInvoices = allInvoices.filter(inv => {
    if (!isAllBranches && inv.branchId && inv.branchId !== branchId) return false;
    if (config.categoryFilter !== 'ALL' && inv.category !== config.categoryFilter) return false;
    return true;
  });

  // 2. Filter bank transactions for target branch (or all)
  const targetBankTxns = allBankTxns.filter(txn => {
    if (!isAllBranches && txn.branchId && txn.branchId !== branchId) return false;
    if (config.categoryFilter === 'SALES' && txn.type !== 'CREDIT') return false;
    if (config.categoryFilter === 'PURCHASE' && txn.type !== 'DEBIT') return false;
    return true;
  });

  const usedTxnIds = new Set<string>();
  const matches: BranchReconMatch[] = [];

  let reconciledCount = 0;
  let reconciledAmount = 0;
  let discrepancyCount = 0;
  let discrepancyAmount = 0;
  let unmatchedInvoicesCount = 0;

  let totalInvoicesAmount = 0;
  targetInvoices.forEach(inv => {
    totalInvoicesAmount += (inv.amount + (inv.taxAmount || 0));
  });

  let totalBankTxnsAmount = 0;
  targetBankTxns.forEach(txn => {
    totalBankTxnsAmount += txn.amount;
  });

  // 3. Match each branch invoice against available branch bank transactions
  targetInvoices.forEach((inv, index) => {
    const totalInvVal = inv.amount + (inv.taxAmount || 0);
    const expectedTxnType = inv.category === 'SALES' ? 'CREDIT' : 'DEBIT';

    let bestTxn: BankStatementTransaction | null = null;
    let bestScore = -1;
    let matchReasons: string[] = [];

    targetBankTxns.forEach(txn => {
      if (usedTxnIds.has(txn.id)) return;
      if (txn.type !== expectedTxnType) return;

      let score = 0;
      const reasons: string[] = [];

      // Check invoice number in description (40 pts)
      const descUpper = txn.description.toUpperCase();
      const invNumUpper = inv.invoiceNumber.toUpperCase();
      if (descUpper.includes(invNumUpper)) {
        score += 45;
      }

      // Check GSTIN or Party Name match (35 pts)
      const gstinMatch = inv.gstin && txn.gstin && inv.gstin.toUpperCase() === txn.gstin.toUpperCase();
      const partyMatch = inv.partyName && descUpper.includes(inv.partyName.toUpperCase().split(' ')[0]);
      if (gstinMatch || descUpper.includes(inv.gstin?.toUpperCase() || '___')) {
        score += 35;
      } else if (partyMatch) {
        score += 25;
      }

      // Check Amount similarity (35 pts)
      const amtDiff = Math.abs(totalInvVal - txn.amount);
      if (amtDiff === 0) {
        score += 35;
      } else if (amtDiff <= config.amountTolerance) {
        score += 25;
        reasons.push(`Minor amount variance ₹${amtDiff.toFixed(2)} (Within tolerance)`);
      } else if (amtDiff <= totalInvVal * 0.05) {
        score += 15;
        // Check standard TDS (1%, 2%, 10%) or round-off
        const diffPct = (amtDiff / totalInvVal) * 100;
        if (Math.abs(diffPct - 2) < 0.2 || Math.abs(diffPct - 1) < 0.2 || Math.abs(diffPct - 10) < 0.2) {
          reasons.push(`Likely TDS Deduction (${diffPct.toFixed(1)}% / ₹${amtDiff.toFixed(2)})`);
        } else {
          reasons.push(`Amount Variance: Books ₹${totalInvVal.toLocaleString()} vs Bank ₹${txn.amount.toLocaleString()} (Diff ₹${amtDiff.toFixed(2)})`);
        }
      }

      // Check Date proximity (15 pts)
      const dayDiff = getDayDifference(inv.date, txn.txnDate);
      if (dayDiff <= 1) {
        score += 15;
      } else if (dayDiff <= config.dateToleranceDays) {
        score += 8;
        reasons.push(`Settlement timing difference of ${dayDiff} days`);
      }

      if (score > bestScore) {
        bestScore = score;
        bestTxn = txn;
        matchReasons = reasons;
      }
    });

    // Determine discrepancy type and confidence
    let discrepancyType: BranchDiscrepancyType = 'EXACT_MATCH';
    let confidence: BranchReconMatch['confidence'] = 'EXACT';
    let status: BranchReconMatch['status'] = 'RECONCILED';
    let diffAmount = 0;
    let suggestedAction = 'Match verified. No further action needed.';

    if (bestTxn && bestScore >= 75) {
      usedTxnIds.add(bestTxn.id);
      diffAmount = Math.abs(totalInvVal - bestTxn.amount);
      const dayDiff = getDayDifference(inv.date, bestTxn.txnDate);

      if (diffAmount === 0 && dayDiff <= 2) {
        discrepancyType = 'EXACT_MATCH';
        confidence = 'EXACT';
        status = 'RECONCILED';
        reconciledCount++;
        reconciledAmount += totalInvVal;
        suggestedAction = 'Automatic exact match verified.';
      } else if (diffAmount > 0 && diffAmount <= 500) {
        discrepancyType = 'TDS_ROUNDOFF';
        confidence = 'PROBABLE';
        status = 'RESOLVED_ADJUSTMENT';
        discrepancyCount++;
        discrepancyAmount += diffAmount;
        suggestedAction = `Post ₹${diffAmount.toFixed(2)} adjustment to TDS / Round-off ledger.`;
      } else if (diffAmount > 0) {
        discrepancyType = 'AMOUNT_VARIANCE';
        confidence = 'DISCREPANCY';
        status = 'PENDING';
        discrepancyCount++;
        discrepancyAmount += diffAmount;
        suggestedAction = `Review partial payment of ₹${bestTxn.amount.toLocaleString()} (Shortfall ₹${diffAmount.toFixed(2)}).`;
      } else {
        discrepancyType = 'TIMING_DELAY';
        confidence = 'EXACT';
        status = 'RECONCILED';
        reconciledCount++;
        reconciledAmount += totalInvVal;
        suggestedAction = `Timing delay confirmed (${dayDiff} days lag). Validated.`;
      }
    } else if (bestTxn && bestScore >= 45) {
      usedTxnIds.add(bestTxn.id);
      diffAmount = Math.abs(totalInvVal - bestTxn.amount);
      discrepancyType = 'AMOUNT_VARIANCE';
      confidence = 'PROBABLE';
      status = 'PENDING';
      discrepancyCount++;
      discrepancyAmount += diffAmount;
      suggestedAction = `Probable match with ${bestTxn.partyName || 'party'}. Requires accountant review.`;
    } else {
      discrepancyType = 'MISSING_IN_BANK';
      confidence = 'UNMATCHED';
      status = 'PENDING';
      unmatchedInvoicesCount++;
      discrepancyCount++;
      discrepancyAmount += totalInvVal;
      diffAmount = totalInvVal;
      matchReasons.push('No corresponding bank statement credit/debit found for this branch invoice.');
      suggestedAction = inv.category === 'SALES' 
        ? 'Send payment reminder to client or check uncleared cheques.' 
        : 'Verify whether vendor payment was executed through another branch or mode.';
    }

    matches.push({
      id: `match-${inv.id || index}`,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.date,
      invoiceAmount: totalInvVal,
      partyName: inv.partyName,
      partyGstin: inv.gstin,
      branchId: inv.branchId || branchId,
      branchName: inv.branchName || branchDetails?.name || 'Assigned Branch',
      costCenter: inv.costCenter || branchDetails?.costCenterCode,
      category: inv.category,
      bankTxn: bestTxn || undefined,
      matchScore: Math.min(100, Math.max(0, bestScore >= 0 ? bestScore : 0)),
      confidence,
      status,
      discrepancyType,
      discrepancyAmount: diffAmount,
      discrepancyReasons: matchReasons.length > 0 ? matchReasons : ['Perfect reconciliation between invoice and bank statement.'],
      suggestedAction
    });
  });

  // 4. Find unmatched bank transactions (Transactions with no invoice match)
  let unmatchedBankTxnsCount = 0;
  targetBankTxns.forEach(txn => {
    if (!usedTxnIds.has(txn.id)) {
      unmatchedBankTxnsCount++;
      discrepancyCount++;
      discrepancyAmount += txn.amount;

      matches.push({
        id: `unmatched-txn-${txn.id}`,
        branchId: txn.branchId || branchId,
        branchName: txn.branchName || branchDetails?.name || 'Assigned Branch',
        costCenter: txn.costCenter,
        category: txn.type === 'CREDIT' ? 'SALES' : 'PURCHASE',
        bankTxn: txn,
        matchScore: 0,
        confidence: 'UNMATCHED',
        status: 'PENDING',
        discrepancyType: 'UNMATCHED_BANK_TXN',
        discrepancyAmount: txn.amount,
        discrepancyReasons: [`Direct bank ${txn.type.toLowerCase()} of ₹${txn.amount.toLocaleString()} without linked branch invoice (${txn.description}).`],
        suggestedAction: txn.category === 'BANK_CHARGE' 
          ? 'Post direct bank service charge journal voucher.' 
          : 'Create matching invoice / payment entry in branch ledger.'
      });
    }
  });

  const totalProcessed = matches.length;
  const ratePct = totalProcessed > 0 ? Math.round((reconciledCount / Math.max(1, targetInvoices.length)) * 100) : 100;

  return {
    branchId: branchId,
    branchName: branchDetails?.name || (isAllBranches ? 'Consolidated All Branches' : 'Selected Branch'),
    branchCode: branchDetails?.code || (isAllBranches ? 'ALL' : 'BR-01'),
    totalInvoicesCount: targetInvoices.length,
    totalInvoicesAmount,
    totalBankTxnsCount: targetBankTxns.length,
    totalBankTxnsAmount,
    reconciledCount,
    reconciledAmount,
    discrepancyCount,
    discrepancyAmount,
    unmatchedInvoicesCount,
    unmatchedBankTxnsCount,
    reconciliationRatePct: ratePct,
    matches
  };
};
