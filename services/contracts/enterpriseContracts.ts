/**
 * TaxFlow Enterprise Shared Contracts
 * 
 * Strict architectural contracts for Next.js Frontend and NestJS Backend.
 * Frontend MUST consume these types and never hard-code statutory rates,
 * rules, Place of Supply determination, or tax calculations.
 */

// ==========================================
// 1. GLOBAL ENTITY & TENANT CONTEXT
// ==========================================

export interface HoldingGroup {
  id: string;
  name: string;
  code: string;
  currency: string;
  companies: LegalEntity[];
}

export interface LegalEntity {
  id: string;
  holdingGroupId: string;
  legalName: string;
  tradeName: string;
  pan: string; // 10-char PAN
  cin: string;
  gstins: StateGstin[];
}

export interface StateGstin {
  id: string;
  companyId: string;
  gstin: string; // 15-char GSTIN
  stateCode: string; // e.g., '27'
  stateName: string; // e.g., 'Maharashtra'
  registrationType: 'REGULAR' | 'SEZ_DEVELOPER' | 'SEZ_UNIT' | 'COMPOSITION' | 'ISD';
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  branches: OperationalBranch[];
}

export interface OperationalBranch {
  id: string;
  gstinId: string;
  branchCode: string; // e.g., 'BR-001'
  branchName: string;
  isPrincipalPlace: boolean;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
}

export interface ActiveEntityContext {
  groupId: string;
  companyId: string;
  gstinId: string;
  branchId?: string; // Optional: can be 'ALL' for consolidated GSTIN view
}

// ==========================================
// 2. FINANCIAL / TAX PERIOD STATE MACHINE
// ==========================================

export type PeriodState = 'OPEN' | 'UNDER_REVIEW' | 'APPROVED' | 'FILED' | 'LOCKED';

export interface TaxPeriodStatus {
  period: string; // e.g., '2026-09'
  periodLabel: string; // e.g., 'September 2026'
  state: PeriodState;
  openedAt: string;
  underReviewAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  filedAt?: string;
  filedBy?: string;
  arn?: string;
  lockedAt?: string;
  lockedBy?: string;
  allowedTransitions: PeriodState[];
  isMutationBlocked: boolean; // True when LOCKED
}

export interface PeriodTransitionRequest {
  period: string;
  targetState: PeriodState;
  reason?: string;
  otpOrSignOffToken?: string;
}

// ==========================================
// 3. STATUTORY TAX ENGINE CONTRACTS
// ==========================================

export type SupplyCategory = 
  | 'B2B' 
  | 'B2C_LARGE' 
  | 'B2C_SMALL' 
  | 'EXPORTS_WITH_PAYMENT' 
  | 'EXPORTS_WITHOUT_PAYMENT' 
  | 'SEZ_WITH_PAYMENT' 
  | 'SEZ_WITHOUT_PAYMENT' 
  | 'DEEMED_EXPORTS' 
  | 'NON_GST' 
  | 'NIL_RATED' 
  | 'EXEMPT';

export type TaxTreatmentType = 'INTER_STATE_IGST' | 'INTRA_STATE_CGST_SGST' | 'ZERO_RATED' | 'EXEMPT';

export interface TaxEngineInputLine {
  lineId: string;
  hsnSacCode: string;
  itemDescription: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxableValue: number;
}

export interface TaxEngineCalculationRequest {
  supplierGstin: string;
  supplierStateCode: string;
  recipientGstin?: string;
  placeOfSupplyStateCode: string; // Mandatory POS State
  dispatchStateCode?: string;
  supplyCategory: SupplyCategory;
  docDate: string; // YYYY-MM-DD
  lines: TaxEngineInputLine[];
}

export interface TaxEngineComputedLine {
  lineId: string;
  taxableValue: number;
  taxTreatment: TaxTreatmentType;
  resolvedRuleId: string;
  resolvedRuleVersion: string;
  appliedIgstRate: number; // e.g., 18.0
  appliedCgstRate: number; // e.g., 9.0
  appliedSgstRate: number; // e.g., 9.0
  appliedCessRate: number; // e.g., 0.0
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessAmount: number;
  totalTaxAmount: number;
  totalLineAmount: number;
}

export interface TaxEngineCalculationResponse {
  docSummary: {
    totalTaxableValue: number;
    totalIgst: number;
    totalCgst: number;
    totalSgst: number;
    totalCess: number;
    totalTax: number;
    grandTotal: number;
    roundingAdjustment: number;
  };
  lines: TaxEngineComputedLine[];
  engineVersion: string;
  executionHash: string;
  correlationId: string;
  computedAt: string;
}

// ==========================================
// 4. STATUTORY TAX EXPLAINER CONTRACT
// ==========================================

export interface TaxExplainerLineProvenance {
  lineId: string;
  hsnSacCode: string;
  taxInputs: {
    supplierGstin: string;
    supplierState: string;
    recipientGstin?: string;
    placeOfSupply: string;
    taxableValue: number;
  };
  resolvedRule: {
    ruleId: string;
    ruleVersion: string;
    effectiveDate: string;
    statutoryNotification: string;
    legalSectionReference: string;
  };
  taxTreatment: TaxTreatmentType;
  calculationBreakdown: {
    taxableValue: number;
    igstRate: number;
    igstAmount: number;
    cgstRate: number;
    cgstAmount: number;
    sgstRate: number;
    sgstAmount: number;
    cessAmount: number;
    roundingProtocol: string;
    totalTax: number;
  };
  provenance: {
    engineVersion: string;
    executionHash: string;
    correlationId: string;
    explanationText: string;
  };
}

export interface TaxExplainerResponse {
  docNumber: string;
  statutoryDisclaimer: "System calculation explanation derived from backend rules for operational auditability. Does not constitute independent legal advice.";
  provenanceLines: TaxExplainerLineProvenance[];
  overallExplanation: string;
}

// ==========================================
// 5. ENTERPRISE EXCEPTION CENTER CONTRACT
// ==========================================

export type ExceptionDomain = 
  | 'TAX_MISMATCH' 
  | 'POS_ISSUE' 
  | 'RULE_CONFLICT' 
  | 'ITC_MISMATCH' 
  | 'SEC_17_5' 
  | 'RCM_ISSUE' 
  | 'RECONCILIATION' 
  | 'IRP_FAILURE' 
  | 'EWB_FAILURE' 
  | 'ERP_SYNC';

export type ExceptionSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type ExceptionStatus = 
  | 'OPEN' 
  | 'UNDER_REVIEW' 
  | 'PENDING_VENDOR' 
  | 'AMENDED' 
  | 'RESOLVED' 
  | 'DISMISSED_WITH_JUSTIFICATION';

export interface ExceptionAuditLog {
  timestamp: string;
  actor: string;
  action: string;
  comment?: string;
}

export interface EnterpriseException {
  exceptionId: string; // e.g., 'EXC-2026-09-0012'
  domain: ExceptionDomain;
  title: string;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  sourceRecordId: string; // e.g., 'INV-9014' or 'IRP-REQ-4819'
  entityContext: ActiveEntityContext;
  period: string; // e.g., '2026-09'
  detectedAt: string;
  slaDueDate: string;
  assignedOwnerId: string;
  assignedOwnerName: string;
  summary: string;
  proposedAction: string;
  auditHistory: ExceptionAuditLog[];
}

// ==========================================
// 6. EXTENSIBLE RECONCILIATION CONTRACTS
// ==========================================

export type ReconciliationEvidenceSourceId = 
  | 'PURCHASE_REGISTER' 
  | 'GSTR_2B' 
  | 'EWAY_BILL' 
  | 'ERP_LEDGER' 
  | 'BANK_CLEARANCE' 
  | 'CUSTOMS_ICEGATE';

export interface ReconciliationEvidenceSource {
  id: ReconciliationEvidenceSourceId;
  name: string;
  description: string;
  isAvailable: boolean;
  lastSyncedAt?: string;
  recordCount: number;
}

export type MatchCategory = 
  | 'EXACT_MATCH' 
  | 'PARTIAL_MATCH' 
  | 'VALUE_MISMATCH' 
  | 'TAX_MISMATCH' 
  | 'MISSING_IN_2B' 
  | 'MISSING_IN_PR' 
  | 'DUPLICATE' 
  | 'MANUALLY_RESOLVED';

export interface MultiEvidenceMatchRecord {
  matchId: string;
  partyGstin: string;
  partyName: string;
  docNumber: string;
  docDate: string;
  category: MatchCategory;
  sourcesEvidence: {
    purchaseRegister?: {
      taxableValue: number;
      taxAmount: number;
      rate: number;
      docDate: string;
    };
    gstr2b?: {
      taxableValue: number;
      taxAmount: number;
      rate: number;
      filingDate: string;
      itcAvailability: 'YES' | 'NO' | 'CONDITIONAL';
    };
    ewayBill?: {
      ewbNumber: string;
      vehicleNumber: string;
      status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
    };
    erpLedger?: {
      docId: string;
      costCenter: string;
      clearingStatus: 'OPEN' | 'CLEARED';
    };
    bankClearance?: {
      paymentDate: string;
      utr: string;
      isWithin180Days: boolean;
    };
    customsIcegate?: {
      boeNumber: string;
      portCode: string;
    };
  };
  varianceAmount: number;
  itcActionRecommendation: 'CLAIM_FULL' | 'HOLD_ITC' | 'REVERSE_ITC' | 'REVERT_TO_VENDOR';
}

// ==========================================
// 7. DETERMINISTIC 9-STAGE INVOICE WORKFLOW
// ==========================================

export type InvoiceStage = 
  | 'DRAFT' 
  | 'VALIDATION' 
  | 'TAX_CALCULATION' 
  | 'INTERNAL_REVIEW' 
  | 'APPROVAL' 
  | 'LEDGER_POST' 
  | 'IRN_GENERATION' 
  | 'EWAYBILL_GENERATION' 
  | 'COMPLETED';

export interface InvoiceWorkflowStatus {
  invoiceId: string;
  currentStage: InvoiceStage;
  isStageTerminal: boolean;
  availableTransitions: InvoiceStage[];
  validationErrors: string[];
  irnDetails?: {
    irn: string;
    signedQr: string;
    signedInvoice: string;
    ackNo: string;
    ackDate: string;
  };
  ewayBillDetails?: {
    ewbNo: string;
    ewbDate: string;
    validUpto: string;
  };
  subledgerPostingId?: string;
}

// ==========================================
// 8. ROLE-BASED ACCESS CONTROL (RBAC)
// ==========================================

export type EnterpriseRole = 
  | 'SUPER_ADMIN' 
  | 'TAX_ADMIN' 
  | 'OPERATIONS_ACCOUNTANT' 
  | 'FINANCE_APPROVER' 
  | 'STATUTORY_AUDITOR' 
  | 'BUSINESS_VIEWER';

export type PermissionAction = 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'FILE' | 'LOCK';

export type ResourceDomain = 
  | 'SALES_INVOICE' 
  | 'PURCHASE_REGISTER' 
  | 'GSTR_2B_DATA' 
  | 'ITC_MANAGEMENT' 
  | 'RCM_MANAGEMENT' 
  | 'RECONCILIATION' 
  | 'TAX_LEDGER' 
  | 'STATUTORY_RETURNS' 
  | 'REGULATORY_RULES' 
  | 'EXCEPTION_CENTER' 
  | 'PERIOD_CONTROL' 
  | 'AUDIT_VAULT' 
  | 'SYSTEM_SETTINGS';

// ==========================================
// 9. CONSOLIDATED EXECUTIVE ANALYTICS CONTRACTS
// ==========================================

export interface MonthlyGstTrendPoint {
  name: string;                 // e.g., 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'
  periodCode?: string;          // e.g., '2026-09'
  sales: number;                // Taxable Outward Supplies / Gross Sales (INR)
  purchase: number;             // Taxable Inward Supplies / Gross Purchases (INR)
  liability: number;            // Net Output Tax Liability (INR)
  itc: number;                  // Input Tax Credit Eligible (INR)
  outputLiability: number;      // Total Gross Output Liability (INR)
  mismatches: number;           // Discrepancy Count
  accuracy: number;             // Accuracy Percentage (0-100)
}

export interface SettlementMixItem {
  name: string;                 // 'Cash Ledger' | 'Credit Ledger'
  value: number;                // In INR
  color: string;
  percentage: number;
}

export interface EntityConsolidatedRollup {
  companyId: string;
  companyName: string;
  gstinCount: number;
  sales: number;
  purchases: number;
  liability: number;
  itc: number;
  filingComplianceRate: number; // Percentage, e.g. 98.5
  pendingExceptions: number;
  status: 'COMPLIANT' | 'NEEDS_ATTENTION' | 'CRITICAL_RISK';
}

export interface MonthlyConsolidatedGstSummaryDto {
  groupId: string;
  groupName: string;
  taxPeriod: string;
  currency: string;
  timeRange: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  totalEntities: number;
  totalGstins: number;
  totals: {
    totalSales: number;
    totalPurchases: number;
    totalOutputTax: number;
    totalEligibleItc: number;
    netTaxLiability: number;
    totalSettled: number;
    cashLedgerBalance: number;
    creditLedgerBalance: number;
  };
  monthlyTrends: MonthlyGstTrendPoint[];
  settlementMix: {
    cashLedgerAmount: number;
    creditLedgerAmount: number;
    totalPaid: number;
    items: SettlementMixItem[];
  };
  entityRollups: EntityConsolidatedRollup[];
  riskMetrics: {
    mismatchedInvoices: number;
    activeExceptionsCount: number;
    unreconciledTaxDisparity: number;
    auditComplianceScore: number;
  };
  generatedAt: string;
  correlationId: string;
}
