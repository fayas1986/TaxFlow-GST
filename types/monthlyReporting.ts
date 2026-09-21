export interface MonthlyGstLiabilityData {
  monthKey: string; // e.g. '2026-04'
  monthName: string; // e.g. 'Apr 2026'
  shortMonth: string; // e.g. 'Apr'
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  isProjected: boolean;
  
  // Turnover
  taxableTurnover: number;
  b2bTurnover: number;
  b2cTurnover: number;
  exportTurnover: number;
  
  // Output Liability (GSTR-1 / GSTR-3B Table 3.1)
  grossLiability: number;
  outputIgst: number;
  outputCgst: number;
  outputSgst: number;
  outputCess: number;
  
  // Inward Supplies & ITC Availability (GSTR-2B / GSTR-3B Table 4)
  totalInwardSupplies: number;
  availableItc: number; // Total eligible ITC
  itcInputs: number;
  itcCapitalGoods: number;
  itcServices: number;
  itcIgst: number;
  itcCgst: number;
  itcSgst: number;
  itcCess: number;
  
  // Blocked & Ineligible ITC
  ineligibleItc17_5: number; // Section 17(5) blocked
  itcReversals: number; // Rule 42/43 reversals
  netItcClaimed: number; // Net eligible after reversals
  
  // Set-off & Discharge (GSTR-3B Table 6.1)
  paidViaItc: number;
  paidViaCash: number;
  itcUtilizationRate: number; // % (paidViaItc / grossLiability)
  cashPaidRate: number; // % (paidViaCash / grossLiability)
  
  // Electronic Credit Ledger
  openingCreditBalance: number;
  closingCreditBalance: number;
  
  // Statutory Compliance
  filingStatus: 'FILED' | 'AUTO_DRAFTED' | 'PROJECTED';
  gstr1FilingDate?: string;
  gstr3bFilingDate?: string;
  arn?: string;
}

export interface FinancialYearReportingSummary {
  financialYear: string; // e.g. 'FY 2026-27'
  tenantId: string;
  selectedGstin: string;
  selectedQuarter: 'ALL' | 'Q1' | 'Q2' | 'Q3' | 'Q4';
  
  // Aggregated Totals
  totalTurnover: number;
  totalGrossLiability: number;
  totalAvailableItc: number;
  totalItcClaimed: number;
  totalIneligibleItc: number;
  totalPaidViaItc: number;
  totalPaidViaCash: number;
  overallItcCoverage: number; // %
  
  // Tax Heads Breakdown
  totalOutputIgst: number;
  totalOutputCgst: number;
  totalOutputSgst: number;
  totalOutputCess: number;
  
  totalItcIgst: number;
  totalItcCgst: number;
  totalItcSgst: number;
  totalItcCess: number;
  
  // Ledger Balances
  openingFyBalance: number;
  closingFyBalance: number;
  
  // Monthly Records (12 Months)
  monthlyRecords: MonthlyGstLiabilityData[];
}
