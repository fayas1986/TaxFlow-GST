/**
 * TaxFlow Enterprise API Contracts & Canonical DTOs
 * Version: 1.0.0-FROZEN
 * 
 * Invariants:
 * 1. The frontend is STRICTLY a consumer; the backend and Tax Engine are authoritative.
 * 2. ZERO client-side statutory tax logic (rates, POS, RCM, ITC eligibility, Rule 42/43, Section 17(5)).
 * 3. All requests carry mandatory Entity Context and Correlation headers.
 * 4. Mutations on locked tax periods return HTTP 423 Locked with structured amendment guidance.
 */

// ============================================================================
// 1. HTTP HEADERS & CONTEXT CONTRACTS
// ============================================================================

export interface EntityContextHeaders {
  'x-tenant-id': string;           // Holding Group / Enterprise ID (e.g. "GROUP-TATA")
  'x-company-id': string;          // Legal Entity / PAN identifier (e.g. "CO-TITAN")
  'x-gstin-id': string;            // Operating State GSTIN (e.g. "27AABCT1332M1Z2")
  'x-branch-id'?: string;          // Specific Unit / Branch (or "ALL")
  'x-tax-period': string;          // ISO Year-Month format (e.g. "2026-09")
  'x-correlation-id': string;      // Distributed W3C Trace context (e.g. "corr-8f92-...")
  'x-idempotency-key'?: string;    // UUIDv4 required for non-safe statutory mutations
}

// ============================================================================
// 2. STANDARD ENVELOPES & PAGINATION CONTRACTS
// ============================================================================

export interface ApiResponseMeta {
  timestamp: string;               // ISO 8601 UTC
  correlationId: string;           // Echoed request correlation identifier
  tenantId: string;
  companyId: string;
  gstinId: string;
  taxPeriod: string;
  periodStatus: TaxPeriodStatus;
  version: string;                 // API SemVer (e.g. "1.0.0")
}

export interface PaginationParams {
  page: number;                    // 1-indexed, default 1
  pageSize: number;                // Default 25, max 100
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  search?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  meta: ApiResponseMeta;
}

export interface ApiPaginatedEnvelope<T> {
  success: true;
  data: PaginatedResult<T>;
  meta: ApiResponseMeta;
}

// RFC 7807 Compliant Problem Details Error Envelope
export interface ApiErrorDetail {
  field?: string;
  code: string;
  message: string;
  rejectedValue?: any;
}

export interface ApiErrorEnvelope {
  success: false;
  status: number;
  error: {
    type: string;                  // URI identifier of problem type
    title: string;                 // Short, human-readable summary
    detail: string;                // Detailed explanation of specific occurrence
    code: string;                  // Standardized error code
    instance: string;              // Request URI or resource path
    timestamp: string;
    correlationId: string;
    validationErrors?: ApiErrorDetail[];
    // For HTTP 423 Locked responses
    periodLockDetails?: PeriodLockErrorPayload;
  };
}

export interface PeriodLockErrorPayload {
  period: string;
  lockedAt: string;
  lockedBy: string;
  currentState: 'LOCKED' | 'FILED';
  filingArn?: string;
  allowedAmendments: {
    protocol: 'SECTION_34_CREDIT_DEBIT_NOTE' | 'DRC_03_VOLUNTARY_PAYMENT' | 'TABLE_9_GSTR_1_AMENDMENT';
    targetPeriod: string;
    actionEndpoint: string;
  }[];
}

// ============================================================================
// 3. TAX PERIOD STATE MACHINE CONTRACTS
// ============================================================================

export type TaxPeriodStatus = 
  | 'OPEN'                         // Full draft and invoice creation/editing permitted
  | 'UNDER_REVIEW'                 // Read-only for standard users; Approver review in progress
  | 'APPROVED'                     // Locked for filing preparation; mutations blocked
  | 'FILED'                        // Transmitted to GSTN; ARN assigned
  | 'LOCKED';                      // Permanently sealed; mutations trigger HTTP 423

export interface TaxPeriodSummaryDto {
  period: string;                  // "YYYY-MM"
  status: TaxPeriodStatus;
  openedAt: string;
  closedAt?: string;
  filedAt?: string;
  arn?: string;
  gstr1Status: 'PENDING' | 'GENERATED' | 'UPLOADED' | 'FILED';
  gstr3bStatus: 'PENDING' | 'COMPUTED' | 'OFF-SET' | 'FILED';
  totalOutwardInvoices: number;
  totalInwardInvoices: number;
  grossLiability: number;
  netEligibleItc: number;
  payableInCash: number;
}

export interface PeriodStateTransitionRequestDto {
  targetStatus: TaxPeriodStatus;
  justificationNotes: string;
  forceLockAcknowledged?: boolean;
}

// ============================================================================
// 4. TAX ENGINE & STATUTORY PROVENANCE CONTRACTS
// ============================================================================

export type TaxTreatmentType = 
  | 'INTRA_STATE'                  // CGST + SGST (or CGST + UTGST)
  | 'INTER_STATE'                  // IGST
  | 'EXPORT_WITH_PAYMENT'          // IGST
  | 'EXPORT_WITHOUT_PAYMENT_LUT'   // Zero-rated LUT
  | 'SEZ_WITH_PAYMENT'             // IGST
  | 'SEZ_WITHOUT_PAYMENT_LUT'      // Zero-rated LUT
  | 'DEEMED_EXPORT'                // IGST
  | 'EXEMPT'                       // Nil tax
  | 'NIL_RATED'                    // 0%
  | 'NON_GST';                     // Outside GST scope

export type ItcEligibilityType = 
  | 'ELIGIBLE_INPUTS'              // Regular business input goods
  | 'ELIGIBLE_CAPITAL_GOODS'       // Plant & machinery
  | 'ELIGIBLE_SERVICES'            // Input services
  | 'INELIGIBLE_SECTION_17_5'      // Blocked credit (motor vehicles, food, personal use)
  | 'INELIGIBLE_RULE_42_43'        // Common credit reversed for exempt supplies
  | 'INELIGIBLE_OTHER';

export interface TaxCalculationLineItemInputDto {
  lineNumber: number;
  hsnSacCode: string;
  itemDescription: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  isRcmSubject?: boolean;
  isCapitalGood?: boolean;
  intendedUsage?: 'BUSINESS' | 'EXEMPT_SUPPLY' | 'PERSONAL_USE';
}

export interface TaxCalculationRequestDto {
  supplierGstin: string;
  recipientGstin?: string;
  placeOfSupplyStateCode: string;  // 2-digit numeric GST state code
  isRecipientSez?: boolean;
  isExport?: boolean;
  shippingBillDate?: string;
  documentType: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'BILL_OF_ENTRY';
  documentDate: string;            // ISO Date (YYYY-MM-DD)
  lineItems: TaxCalculationLineItemInputDto[];
}

export interface StatutoryProvenanceDto {
  primarySection: string;          // e.g. "Section 10(1)(a) IGST Act, 2017"
  rulesApplied: string[];          // e.g. ["Rule 28 CGST Rules", "Rule 42 Apportionment"]
  ruleAstVersion: string;          // e.g. "GST-AST-2026.04-REL3"
  effectiveDate: string;           // Date this specific rule version was published
  notificationReference?: string;  // e.g. "Notification No. 04/2026 - Central Tax"
  explanationText: string;         // Plain-text step-by-step arithmetic narrative
  nonLegalAdviceDisclaimer: string;// Mandatory regulatory notice
}

export interface TaxCalculationLineItemOutputDto {
  lineNumber: number;
  hsnSacCode: string;
  taxableValue: number;
  taxTreatment: TaxTreatmentType;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  cessRate: number;
  cessAmount: number;
  totalTaxAmount: number;
  totalLineAmount: number;
  isRcm: boolean;
  itcEligibility: ItcEligibilityType;
  ineligibleReason?: string;
  statutoryProvenance: StatutoryProvenanceDto;
}

export interface TaxCalculationResponseDto {
  totalTaxableValue: number;
  totalCgstAmount: number;
  totalSgstAmount: number;
  totalIgstAmount: number;
  totalCessAmount: number;
  grandTotalTax: number;
  grandTotalInvoiceAmount: number;
  taxTreatmentSummary: TaxTreatmentType;
  isRcmApplicable: boolean;
  eligibleItcTotal: number;
  blockedItcTotal: number;
  lineItems: TaxCalculationLineItemOutputDto[];
  calculationId: string;
  calculatedAt: string;
}

// ============================================================================
// 5. CANONICAL INVOICE DTOs (SALES & PURCHASES)
// ============================================================================

export type InvoiceCategory = 'SALES' | 'PURCHASE';
export type InvoiceStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'VALIDATED' | 'IRN_GENERATED' | 'REJECTED' | 'CANCELLED';

export interface InvoiceLineItemDto {
  id: string;
  lineNumber: number;
  hsnSacCode: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  taxableValue: number;
  taxRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  totalAmount: number;
  itcEligibility?: ItcEligibilityType;
}

export interface InvoiceCreateRequestDto {
  category: InvoiceCategory;
  docType: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
  invoiceNumber: string;
  date: string;                    // YYYY-MM-DD
  partyName: string;
  partyGstin?: string;
  placeOfSupply: string;           // 2-digit state code
  isRcm: boolean;
  isSez?: boolean;
  isImport?: boolean;
  lineItems: Omit<InvoiceLineItemDto, 'id' | 'cgstAmount' | 'sgstAmount' | 'igstAmount' | 'cessAmount' | 'totalAmount'>[];
  notes?: string;
}

export interface InvoiceResponseDto {
  id: string;
  tenantId: string;
  companyId: string;
  gstin: string;
  branchId: string;
  category: InvoiceCategory;
  docType: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
  invoiceNumber: string;
  date: string;
  taxPeriod: string;
  partyName: string;
  partyGstin?: string;
  placeOfSupply: string;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  totalTax: number;
  grandTotal: number;
  status: InvoiceStatus;
  isRcm: boolean;
  isBlockedItc: boolean;
  blockedItcReason?: string;
  irn?: string;
  signedQrCode?: string;
  ackNumber?: string;
  ackDate?: string;
  ewayBillNumber?: string;
  ewayBillValidUntil?: string;
  lineItems: InvoiceLineItemDto[];
  statutoryProvenance?: StatutoryProvenanceDto;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 6. MULTI-EVIDENCE RECONCILIATION CONTRACTS
// ============================================================================

export type ReconciliationEvidenceSource = 
  | 'PURCHASE_REGISTER_ERP'        // Inward Book of Accounts
  | 'GSTR_2B_GOVERNMENT_PORTAL'    // Auto-drafted ITC statement from GSTN
  | 'GSTR_2A_SUPPLIER_LIVE'        // Dynamic supplier upload stream
  | 'EWAY_BILL_INWARD'             // Physical logistics evidence from NIC
  | 'CUSTOMS_ICEGATE_BOE'          // Bill of Entry customs data
  | 'THIRD_PARTY_VENDOR_FEED';     // Direct EDI / Vendor Portal transmission

export interface ReconciliationEvidenceSourceConfigDto {
  id: ReconciliationEvidenceSource;
  displayName: string;
  authorityLevel: 'PRIMARY_BOOKS' | 'STATUTORY_PORTAL' | 'PHYSICAL_LOGISTICS' | 'CUSTOMS_PORTAL';
  isRealTime: boolean;
  lastIngestedAt?: string;
  recordCount: number;
  status: 'CONNECTED' | 'SYNCING' | 'STALE' | 'ERROR';
}

export interface ReconciliationExecutionRequestDto {
  taxPeriod: string;               // e.g. "2026-09"
  targetGstin: string;
  evidenceSourcesToMatch: ReconciliationEvidenceSource[];
  tolerances: {
    taxAmountTolerance: number;    // e.g. 5.0 (₹5 max disparity)
    dateToleranceDays: number;     // e.g. 30 days
    fuzzyInvoiceNumberMatching: boolean;
  };
}

export type ReconciliationMatchCategory = 
  | 'EXACT_MATCH'                  // Invoice #, date, value, tax match 100%
  | 'TOLERANCE_MATCH'              // Within ±₹5 tax tolerance or ±30 days
  | 'PROBABLE_MATCH'               // Fuzzy invoice string match, identical tax
  | 'UNMATCHED_IN_BOOKS_ONLY'      // Present in PR, missing in GSTR-2B (Risk: Ineligible ITC)
  | 'UNMATCHED_IN_PORTAL_ONLY'     // Present in GSTR-2B, missing in PR (Opportunity: Unclaimed ITC)
  | 'TAX_VALUE_MISMATCH'           // Same invoice #, different tax or rate
  | 'SUPPLIER_GSTIN_MISMATCH';     // Found against different GSTIN under same group

export interface ReconciliationMatchItemDto {
  matchId: string;
  category: ReconciliationMatchCategory;
  confidenceScore: number;         // 0 to 100
  prInvoice?: InvoiceResponseDto;
  portalRecord?: {
    source: ReconciliationEvidenceSource;
    supplierGstin: string;
    supplierTradeName: string;
    invoiceNumber: string;
    invoiceDate: string;
    invoiceValue: number;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    itcAvailability: 'AVAILABLE' | 'INELIGIBLE_SECTION_16_4' | 'INELIGIBLE_RULE_37A';
  };
  logisticsEvidence?: {
    ewayBillNumber: string;
    vehicleNumber: string;
    deliveredDate: string;
  };
  taxDisparity: number;
  varianceReasons: string[];
}

export interface ReconciliationResultDto {
  reconciliationJobId: string;
  taxPeriod: string;
  gstin: string;
  executedAt: string;
  summary: {
    totalBookRecords: number;
    totalPortalRecords: number;
    matchedRecords: number;
    toleranceMatchedRecords: number;
    unmatchedBookRecords: number;
    unmatchedPortalRecords: number;
    eligibleItcClaimable: number;
    atRiskItcBlocked: number;
  };
  matches: ReconciliationMatchItemDto[];
}

// ============================================================================
// 7. CENTRALIZED COMPLIANCE EXCEPTION INBOX CONTRACTS
// ============================================================================

export type ExceptionDomain = 
  | 'ITC_MISMATCH'                 // Discrepancy between PR and GSTR-2B
  | 'E_INVOICE_MISSING'            // Turnover > threshold but IRN absent
  | 'E_WAY_BILL_EXPIRED'           // Goods delivered after validity lapsed
  | 'SECTION_16_4_DEADLINE'        // Approaching Nov 30 statutory ITC cut-off
  | 'RULE_37_REVERSAL_180_DAYS'    // Vendor unpaid after 180 days from invoice date
  | 'GSTIN_CANCELLED_SUPPLIER'     // Vendor registration cancelled/suspended
  | 'REVERSE_CHARGE_UNPAID'        // RCM liability not discharged in cash
  | 'CIRCULAR_TRADING_FLAG'        // High-velocity circular flow flagged by Risk Engine
  | 'DATA_QUALITY_HSN_INVALID'     // 4-digit HSN used where 6-digit mandated
  | 'PERIOD_LOCK_VIOLATION';       // Attempted mutation on sealed tax period

export type ExceptionSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type ExceptionStatus = 'OPEN' | 'IN_INVESTIGATION' | 'ESCALATED' | 'RESOLVED' | 'WAIVED_WITH_AUDIT';

export interface ComplianceExceptionDto {
  id: string;
  tenantId: string;
  companyId: string;
  gstin: string;
  domain: ExceptionDomain;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  title: string;
  description: string;
  financialImpact: number;
  relatedInvoiceId?: string;
  relatedInvoiceNumber?: string;
  supplierName?: string;
  supplierGstin?: string;
  statutoryRuleReference: string;
  detectedAt: string;
  assignedTo?: string;
  resolutionDeadline?: string;
  resolutionAuditNote?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface ExceptionResolutionRequestDto {
  action: 'ADJUST_CREDIT_NOTE' | 'DISCHARGE_DRC_03' | 'COMMUNICATE_TO_VENDOR' | 'WAIVE_EXPLAINED';
  justificationNotes: string;
  supportingDocumentId?: string;
}

// ============================================================================
// 8. TAX LEDGERS & STATUTORY RETURN FILING CONTRACTS
// ============================================================================

export interface LedgerBalanceResponseDto {
  gstin: string;
  taxPeriod: string;
  cashLedger: {
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    total: number;
  };
  creditLedger: {
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    total: number;
  };
  netLiability: {
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    total: number;
  };
  updatedAt: string;
}

export interface Gstr1TableSummaryDto {
  table4A_B2B: { count: number; taxable: number; igst: number; cgst: number; sgst: number; total: number };
  table5A_B2CL: { count: number; taxable: number; igst: number; total: number };
  table7_B2CS: { taxable: number; igst: number; cgst: number; sgst: number; total: number };
  table6A_Exports: { count: number; taxable: number; igst: number; total: number };
  table9B_CreditDebitNotes: { count: number; taxable: number; igst: number; cgst: number; sgst: number; total: number };
  table12_HsnSummary: { count: number; totalTaxable: number; totalTax: number };
}

export interface Gstr3bSectionSummaryDto {
  section3_1_TaxOnOutwardSupplies: { taxable: number; igst: number; cgst: number; sgst: number; cess: number };
  section3_2_InterStateSuppliesToUnregistered: { taxable: number; igst: number };
  section4_EligibleItc: {
    itcAvailable_ImportsGoods: { igst: number; cess: number };
    itcAvailable_ImportsServices: { igst: number; cess: number };
    itcAvailable_InwardRcm: { igst: number; cgst: number; sgst: number; cess: number };
    itcAvailable_AllOtherItc: { igst: number; cgst: number; sgst: number; cess: number };
    itcReversed_Rule42_43: { igst: number; cgst: number; sgst: number; cess: number };
    itcReversed_Others: { igst: number; cgst: number; sgst: number; cess: number };
    netItcAvailable: { igst: number; cgst: number; sgst: number; cess: number };
  };
  section5_ValuesOfExemptNilAndNonGst: { interState: number; intraState: number };
  section6_1_PaymentOfTax: {
    totalTaxPayable: number;
    paidThroughItc: number;
    paidInCash: number;
    interestPaid: number;
    lateFeePaid: number;
  };
}

// ============================================================================
// 9. CONSOLIDATED EXECUTIVE ANALYTICS & DASHBOARD CONTRACTS
// ============================================================================

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
