
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  ACCOUNTANT = 'ACCOUNTANT',
  AUDITOR = 'AUDITOR',
  FINANCE_MANAGER = 'FINANCE_MANAGER',
  VIEWER = 'VIEWER'
}

export type DepartmentCode = 
  | 'FINANCE'
  | 'TAX'
  | 'AUDIT'
  | 'TREASURY'
  | 'OPERATIONS'
  | 'SALES'
  | 'PROCUREMENT'
  | 'HR_ADMIN';

export interface DepartmentAccess {
  id: string;
  name: string;
  code: DepartmentCode;
  description: string;
  isPrimary?: boolean;
  memberCount?: number;
  departmentLead?: string;
}

export type BranchAccessLevel = 'FULL_ACCESS' | 'READ_ONLY' | 'NO_ACCESS';

export interface BranchAccessConfig {
  branchId: string;
  branchName: string;
  branchCode: string;
  gstin: string;
  accessLevel: BranchAccessLevel;
}

export type PermissionAction = 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE' | 'APPROVE' | 'EXPORT' | 'ADMIN';

export interface ModulePermission {
  moduleKey: string;
  moduleName: string;
  description: string;
  actions: Record<PermissionAction, boolean>;
}

export interface RolePermissionMatrix {
  role: UserRole;
  roleName: string;
  description: string;
  color: string;
  badgeBg: string;
  modules: ModulePermission[];
}

export interface UserAccessProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING_INVITE' | 'SUSPENDED';
  primaryDepartment: DepartmentCode;
  secondaryDepartments: DepartmentCode[];
  branchScope: 'ALL_BRANCHES' | 'SELECTED_BRANCHES';
  branchAccess: BranchAccessConfig[];
  enforce2FA: boolean;
  is2FAVerified: boolean;
  lastLoginAt?: string;
  lastLoginIp?: string;
  createdAt: string;
  currentTenantId: string;
  availableTenants: Tenant[];
  avatarUrl?: string;
}

export interface RbacChangeHistoryRecord {
  id: string;
  timestamp: string;
  actorName: string;
  actorEmail: string;
  actorRole: UserRole;
  targetType: 'ROLE_MATRIX' | 'USER_ROLE' | 'USER_STATUS' | 'BRANCH_ACCESS' | 'PRESET_APPLIED' | 'ROLE_CLONED' | 'MATRIX_RESET';
  targetName: string;
  changeCategory: 'GRANT' | 'REVOKE' | 'ROLE_CHANGE' | 'STATUS_CHANGE' | 'BRANCH_SCOPING' | 'PRESET_APPLY';
  moduleOrFeature?: string;
  oldValue: string;
  newValue: string;
  details: string;
  ipAddress?: string;
}

export interface LoginAuditRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: UserRole;
  timestamp: string;
  eventType: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | '2FA_VERIFIED' | 'LOGOUT' | 'SESSION_EXPIRED' | 'PASSWORD_RESET' | 'SESSION_REVOKED';
  ipAddress: string;
  location: string;
  deviceBrowser: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
  riskScore: 'LOW' | 'MEDIUM' | 'HIGH';
  failureReason?: string;
}

export interface UserSessionRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: UserRole;
  department: string;
  deviceOS: string;
  browser: string;
  ipAddress: string;
  location: string;
  loginTime: string;
  lastActiveTime: string;
  isCurrentSession: boolean;
  twoFactorVerified: boolean;
}

export interface SessionSettings {
  inactivityTimeoutMinutes: number;
  maxConcurrentSessions: number;
  enforceSingleDevice: boolean;
  autoRevokeInactiveDays: number;
  require2FAForHighPrivilege: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  gstin: string;
  address: string;
  logoUrl?: string;
  stateCode: string; // e.g., '27' for MH
  stateName?: string;
  sector?: string;
  entityType?: 'HOLDING' | 'SUBSIDIARY' | 'JOINT_VENTURE' | 'SPV' | 'SEZ_UNIT' | 'BRANCH';
  isSez?: boolean;
  filingStatus?: 'COMPLIANT' | 'NEEDS_ATTENTION' | 'CRITICAL_RISK';
  complianceScore?: number;
  gstinCount?: number;
  branchCount?: number;
  annualTurnover?: number;
  revenueContributionPct?: number;
  pendingExceptionsCount?: number;
  gstinRegistrations?: GstinRegistrationItem[];
  branches?: BranchDetailsItem[];
}

export interface InvoiceReminder {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  partyName: string;
  scheduledDate: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  type: 'EMAIL' | 'SMS' | 'WHATSAPP';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  currentTenantId: string;
  availableTenants: Tenant[];
  avatarUrl?: string;
  primaryDepartment?: DepartmentCode;
  department?: string;
}

export interface EWayBill {
  ewayBillNo: string;
  ewayBillDate: string;
  validUpto: string;
  status: 'ACTIVE' | 'CANCELLED';
  vehicleNo?: string;
  transporterId?: string;
  transporterName?: string;
  transportMode?: 'ROAD' | 'RAIL' | 'AIR' | 'SHIP';
  transportDocNo?: string;
  currentPlace?: string;
  extendedCount?: number;
  vehicleHistory?: Array<{
    vehicleNo: string;
    fromPlace: string;
    updatedAt: string;
    reason: string;
    transportDocNo?: string;
  }>;
}

export interface TaxBreakdown {
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  utgst: number;
  cess: number;
}

export interface InvoiceItem {
  id: string;
  description: string;
  hsnSac: string;
  quantity: number;
  unit: string;
  rate: number;
  taxRate: number; // e.g. 18
  taxableValue: number;
  taxAmount: number;
  expenseCategory?: string;
  glCode?: string;
}

export interface ExpenseCategorySuggestion {
  suggestedCategory: string;
  subCategory?: string;
  confidence: number;
  reasoning: string;
  glCode: string;
  suggestedHsnSac?: string;
  suggestedGstRate?: number;
  itcEligibility: 'ELIGIBLE' | 'BLOCKED_17_5' | 'CONDITIONAL';
  itcReasoning?: string;
  suggestedTags: string[];
  costCenter?: string;
  itemBreakdowns?: Array<{
    itemDescription: string;
    suggestedCategory: string;
    hsnSac?: string;
    glCode?: string;
    confidence: number;
  }>;
}

export type InvoiceApprovalStatus = 
  | 'DRAFT'
  | 'PENDING_FINANCE_REVIEW'
  | 'PENDING_SR_FINANCE_SIGNOFF'
  | 'APPROVED'
  | 'REVISION_REQUESTED'
  | 'REJECTED'
  | 'SUBMITTED_TO_PORTAL';

export interface ApprovalStageAction {
  stage: 'PREPARATION' | 'FINANCE_REVIEW' | 'SR_FINANCE_SIGNOFF' | 'PORTAL_DISPATCH';
  status: 'PENDING' | 'APPROVED' | 'REVISED' | 'REJECTED' | 'DISPATCHED';
  actionBy: {
    id?: string;
    name: string;
    email: string;
    role: UserRole;
    designation?: string;
  };
  timestamp: string;
  notes?: string;
  signatureHash?: string;
  checklistCompleted?: string[];
}

export interface InvoiceApprovalWorkflow {
  currentStage: 'DRAFT' | 'FINANCE_REVIEW' | 'SR_FINANCE_SIGNOFF' | 'READY_FOR_PORTAL' | 'SUBMITTED_TO_PORTAL';
  overallStatus: InvoiceApprovalStatus;
  preparedBy?: { 
    name: string; 
    email: string; 
    role: UserRole; 
    timestamp: string; 
    notes?: string 
  };
  reviewedBy?: { 
    name: string; 
    email: string; 
    role: UserRole; 
    timestamp: string; 
    notes?: string; 
    checklistCompleted: string[];
    riskScore?: number;
  };
  seniorSignoff?: {
    name: string;
    email: string;
    role: UserRole;
    designation: string;
    timestamp: string;
    signatureHash: string;
    evcOtpOrPin?: string;
    declarationAccepted: boolean;
    notes?: string;
  };
  history: ApprovalStageAction[];
  requiredThresholdAmount?: number;
  complianceChecklist?: {
    gstinValid: boolean;
    hsnSacValid: boolean;
    taxCalculationValid: boolean;
    posValid: boolean;
    eInvoiceMandatory: boolean;
  };
}

export interface Invoice {
  id: string;
  tenantId?: string;
  invoiceNumber: string;
  partyName: string; 
  gstin: string;
  placeOfSupply: string; // State Code
  date: string;
  amount: number; // Taxable Value
  taxAmount: number; // Total Tax
  taxDetails: TaxBreakdown;
  items?: InvoiceItem[];
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'UPLOADED' | 'FILED' | 'FAILED' | 'PENDING' | 'PAID';
  approvalStage?: InvoiceApprovalStatus;
  approvalWorkflow?: InvoiceApprovalWorkflow;
  type: 'B2B' | 'B2C' | 'EXPORT';
  category: 'SALES' | 'PURCHASE'; 
  docType: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
  irn?: string; 
  ackNo?: string;
  ackDate?: string;
  qrCodeUrl?: string;
  irnError?: string; 
  irnStatus?: 'ACTIVE' | 'CANCELLED' | 'FAILED' | 'PENDING';
  irnCancellationReason?: string;
  irnCancellationRemarks?: string;
  irnCancelledAt?: string;
  irnHistory?: Array<{ action: string; timestamp: string; user: string; details?: string }>;
  ewayBillDetails?: EWayBill;
  ewayBillError?: string;
  
  // Multi-currency Support
  currency?: string; 
  exchangeRate?: number; // Rate relative to INR (e.g., 83.5)
  originalAmount?: number; // Amount in foreign currency
  originalTaxAmount?: number; // Tax in foreign currency
  
  // Compliance Flags
  isRcm?: boolean; 
  isImport?: boolean;
  isSez?: boolean;
  isBlockedItc?: boolean; // Section 17(5)
  reasonForBlocked?: string;
  tags?: string[];
  costCenter?: string;
  assignedReviewer?: string;
  compliancePriority?: 'HIGH' | 'NORMAL' | 'LOW';
  archivedAt?: string; // ISO date when invoice was archived
  versionHistory?: InvoiceVersion[];

  // Custom enhanced fields
  isAmended?: boolean;
  originalInvoiceNumber?: string;
  originalDate?: string;
  amendmentReason?: string;
  isVendorBill?: boolean;
  dueDate?: string;

  // Expense Categorization & Accounting
  expenseCategory?: string; // e.g., 'Office Supplies', 'Professional Fees', etc.
  glCode?: string; // e.g., 'GL-5210'
  expenseCategoryConfidence?: number;
  expenseCategoryReasoning?: string;
  itcEligibility?: 'ELIGIBLE' | 'BLOCKED_17_5' | 'CONDITIONAL';

  // Multi-Registration & Branch attribution
  supplierGstin?: string;
  recipientGstin?: string;
  branchId?: string;
  branchName?: string;

  // ERP & Ledger Ingestion Metadata
  sourceErp?: string;
  ledgerSyncMeta?: {
    erpId: string;
    syncTime: string;
    voucherType: string;
    originalVoucherId?: string;
  };
  itcDetails?: {
    eligible: boolean;
    category?: string;
    taxAmount: number;
    reversalReason?: string;
  };
}

export interface AutomationRuleCondition {
  field: 'vendorName' | 'gstin' | 'category' | 'type' | 'minAmount' | 'maxAmount' | 'hsnSac';
  operator: 'contains' | 'equals' | 'greaterThan' | 'lessThan' | 'startsWith';
  value: string | number;
}

export interface AutomationRuleAction {
  type: 'AUTO_TAG' | 'ASSIGN_COST_CENTER' | 'SET_RCM' | 'FLAG_BLOCKED_ITC' | 'ASSIGN_REVIEWER' | 'SET_PRIORITY';
  value: string;
}

export interface AutomationRule {
  id: string;
  tenantId?: string;
  name: string;
  description?: string;
  category: 'ALL' | 'PURCHASE' | 'SALES';
  isActive: boolean;
  conditions: AutomationRuleCondition[];
  actions: AutomationRuleAction[];
  executionCount: number;
  lastExecutedAt?: string;
  createdAt: string;
}

export interface InvoiceVersion {
  id: string;
  timestamp: string;
  modifiedBy: string;
  changeSummary: string;
  dataSnapshot: Partial<Invoice>;
}

export type ReconStatus = 
  | 'MATCHED' 
  | 'PARTIAL_MATCH' 
  | 'MISMATCH' 
  | 'MISSING_IN_BOOKS' 
  | 'MISSING_IN_PORTAL' 
  | 'EXCESS_ITC' 
  | 'PROBABLE_MATCH';

export interface ReconItem {
  id: string;
  tenantId?: string;
  type: 'PURCHASE' | 'SALES'; 
  invoiceNumber: string;
  date: string;
  partyName: string;
  gstin: string;
  taxAmountBooks: number; 
  taxAmountPortal: number; 
  difference: number;
  status: ReconStatus;
  riskScore: number; 
  suggestedAction: string;
  notes?: string;
}

export type ReturnFormType = 'GSTR-1' | 'GSTR-3B' | 'GSTR-9' | 'GSTR-9C' | 'CMP-08' | 'ITC-04' | 'GSTR-7' | 'GSTR-8' | 'GSTR-6' | 'GSTR-5' | 'GSTR-5A';

export interface FilingSectionDetail {
  label: string;
  count: number;
  value: number;
}

export interface FilingDataSummary {
  totalLiability: number;
  itcAvailable: number;
  cashPayable: number;
  sections: FilingSectionDetail[];
}

export interface FilingVersion {
  id: string;
  filingId: string;
  version: number;
  timestamp: string;
  modifiedBy: string;
  status: 'DRAFT' | 'SUBMITTED' | 'PRE-VALIDATION';
  changeSummary: string;
  summary: FilingDataSummary;
}

export interface FilingRecord {
  id: string;
  tenantId?: string;
  type: ReturnFormType;
  period: string; 
  fy: string;
  status: 'FILED' | 'PENDING' | 'OVERDUE' | 'FAILED' | 'SAVED';
  dueDate: string;
  filedDate?: string;
  arn?: string; 
  taxLiability?: number;
}

export interface ComplianceAlert {
  id: string;
  tenantId?: string;
  title: string;
  message: string;
  type: 'DUE_DATE' | 'VENDOR_RISK' | 'ITC_EXPIRY' | 'PENALTY';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  date: string;
  actionUrl?: string;
}

export interface VendorRisk {
  id: string;
  tenantId?: string;
  vendorName: string;
  gstin: string;
  pendingInvoices: number;
  totalItcAtRisk: number;
  lastFiledPeriod: string;
  complianceScore: number; 
  status: 'COMPLIANT' | 'AT_RISK' | 'NON_COMPLIANT';
}

export interface NotificationSettings {
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  phone?: string;
  alerts: {
    dueDate: boolean;
    vendorNonCompliance: boolean;
    itcExpiry: boolean;
    returnFiling: boolean;
  }
}

export interface LiabilityReportData {
  month: string;
  liability: number;
  itcAdjustment: number;
  cashPaid: number;
}

export interface ItcReportData {
  head: 'IGST' | 'CGST' | 'SGST';
  openingBalance: number;
  availed: number;
  utilized: number;
  closingBalance: number;
}

export interface BranchReportData {
  id: string;
  tenantId?: string;
  name: string;
  gstin: string;
  state: string;
  turnover: number;
  taxLiability: number;
  itcSetOff?: number;
  netPayable?: number;
  igst?: number;
  cgst?: number;
  sgst?: number;
  type?: 'HEAD_OFFICE' | 'BRANCH' | 'SISTER_COMPANY';
  status?: 'ACTIVE' | 'INACTIVE' | 'PENDING';
}

export interface AuditChange {
  field: string;
  oldValue: string | number | null;
  newValue: string | number | null;
}

export interface AuditLogData {
  id: string;
  tenantId?: string;
  action: string;
  module: 'INVOICE' | 'FILING' | 'AUTH' | 'COMPLIANCE' | 'SYSTEM' | 'SETTINGS';
  user: string;
  role: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILURE';
  details?: string;
  ipAddress?: string;
  changes?: AuditChange[];
  hash: string;
  previousHash: string;
}

export type AnomalyCategory = 
  | 'TAX_RATE_MISMATCH' 
  | 'DUPLICATE_INVOICE' 
  | 'HIGH_VALUE_DEVIATION' 
  | 'ROUND_NUMBER_BIAS' 
  | 'GSTIN_FORMAT_ERROR' 
  | 'LATE_FILING_RISK' 
  | 'UNUSUAL_TAX_HEAD_RATIO'
  | 'VENDOR_BLACK_LISTED'
  | 'HSN_MISMATCH'
  | 'ITC_BLOCK_17_5'
  | 'RCM_OMISSION'
  | 'EWAY_VALUE_VARIANCE'
  | 'RULE_36_4_EXCESS';

export interface AnomalyRecord {
  id: string;
  tenantId?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  partyGstin?: string;
  partyName?: string;
  category: AnomalyCategory;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  detectedAt: string;
  potentialImpact: number;
  recommendation: string;
  status: 'PENDING' | 'RESOLVED' | 'IGNORED';
  confidence: number;
  statutoryRule?: string;
  taxHeadBreakdown?: {
    cgst: number;
    sgst: number;
    igst: number;
    cess?: number;
  };
  resolutionNotes?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

// Update AiRiskRecord to use AnomalyCategory
export interface AiRiskRecord {
  id: string;
  category: AnomalyCategory | 'ITC_BLOCK' | 'RCM_ALERT' | 'VALUATION';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  invoiceNumber?: string;
  potentialImpact: number;
  recommendation: string;
  aiConfidence: number; // 0-100
}

export interface GstrMapping {
  table: string;
  description: string;
  taxableValue: number;
  liability: number;
  source: 'SALES_REGISTER' | 'PURCHASE_REGISTER' | 'RCM_CALCULATOR';
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: 'INVOICE' | 'REPORT';
  previewColor: string;
  styles: {
    primaryColor: string;
    fontFamily: string;
    layout: 'MODERN' | 'CLASSIC' | 'MINIMAL';
  };
}

export interface ExportConfig {
  templateId: string;
  includeLogo: boolean;
  includeSignature: boolean;
  paperSize: 'A4' | 'LETTER';
}

export interface InvoiceAnnotation {
  id: string;
  x: number; // percentage from left
  y: number; // percentage from top
  width: number; // percentage
  height: number; // percentage
  text: string;
  author: string;
  createdAt: string;
}

export interface TaxComputationSummary {
  outputLiability: TaxBreakdown;
  inputTaxCredit: TaxBreakdown & { blocked: number };
  rcmLiability: TaxBreakdown;
  netPayable: TaxBreakdown;
  gstr1Mapping: GstrMapping[];
  gstr3bMapping: GstrMapping[];
  aiRisks: AiRiskRecord[];
}

export interface HSNCode {
  id?: string;
  code: string;
  description: string;
  taxRate: number;
  category: 'GOODS' | 'SERVICES';
  chapter?: string;
  cessRate?: number;
  rcmApplicable?: boolean;
  itcEligibility?: 'ELIGIBLE' | 'INELIGIBLE' | 'CONDITIONAL';
  conditions?: string;
  uqc?: string;
  // Enhanced statutory metadata
  sector?: string;
  schedule?: string;
  notificationNo?: string;
  effectiveDate?: string;
  isExempt?: boolean;
  exemptionNotification?: string;
  exemptionCondition?: string;
  rcmNotification?: string;
  itcRestrictionNote?: string;
  keywords?: string[];
  rateHistory?: Array<{
    effectiveDate: string;
    oldRate: number;
    newRate: number;
    notification: string;
    description: string;
  }>;
  councilDecision?: string;
  digitsRequired?: 4 | 6 | 8;
}

export interface GovernmentNotification {
  id: string;
  notificationNo: string;
  date: string;
  title: string;
  category: 'RATE_CHANGE' | 'EXEMPTION' | 'RCM' | 'CIRCULAR' | 'COUNCIL_DECISION';
  applicableTo: 'GOODS' | 'SERVICES' | 'BOTH';
  summary: string;
  detailedNotes: string;
  impactedHsnCodes: string[];
  gstCouncilMeeting?: string;
  gazetteRef?: string;
  effectiveDate: string;
  status: 'ACTIVE' | 'SUPERSEDED';
  relevantSection?: string;
}

export interface GstExemptionItem {
  id: string;
  hsnSacCode: string;
  category: 'GOODS' | 'SERVICES';
  heading: string;
  scopeOfExemption: string;
  statutoryConditions: string;
  notificationReference: string;
  applicableLawClause: string;
  itcImpact: string;
}

export interface SavedReport {
  id: string;
  name: string;
  description?: string;
  tab: 'LIABILITY' | 'ITC' | 'VENDOR' | 'BRANCH' | 'AUDIT' | 'BRANCH_COMPARISON' | 'REGIONAL_MAP' | string;
  filters: {
    startDate?: string;
    endDate?: string;
    branchId?: string;
    taxHead?: string;
    minScore?: number;
    module?: string;
  };
  createdAt: string;
}

export interface ImportLog {
  id: string;
  tenantId: string;
  fileName: string;
  timestamp: string;
  successCount: number;
  failureCount: number;
  totalCount: number;
  status: 'COMPLETED' | 'PARTIAL_SUCCESS' | 'FAILED';
  processedFileUrl: string;
}

export interface VendorActivityLog {
  id: string;
  vendorName: string;
  action: string;
  module: 'INVOICE' | 'PROFILE' | 'COMPLIANCE' | 'SYSTEM';
  timestamp: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
  details: string;
  ipAddress?: string;
}

export interface BankStatementTransaction {
  id: string;
  txnDate: string;
  description: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  gstin?: string;
  partyName?: string;
  refNo: string;
  bankName: string;
  accountNumber: string;
}

export interface ReconMatchResult {
  id: string;
  reconItemId: string;
  invoiceNumber: string;
  date: string;
  partyName: string;
  gstin: string;
  invoiceAmount: number;
  bankTxn?: BankStatementTransaction;
  matchScore: number; // 0 - 100
  confidence: 'EXACT' | 'PROBABLE' | 'DISCREPANCY' | 'UNMATCHED';
  status: 'AUTO_MATCHED' | 'FLAGGED' | 'MANUAL_APPROVED' | 'DISPUTED';
  discrepancyReasons: string[];
}

export interface AutoReconcileSummary {
  totalProcessed: number;
  exactMatchesCount: number;
  flaggedDiscrepanciesCount: number;
  unmatchedCount: number;
  totalInvoiceAmount: number;
  totalBankAmount: number;
  discrepancyAmount: number;
  matches: ReconMatchResult[];
}

export interface GstPortalEndpoint {
  id: string;
  name: string;
  category: 'GSTN' | 'IRP' | 'EWAYBILL' | 'GSTIN_LOOKUP';
  status: 'OPERATIONAL' | 'DEGRADED' | 'MAINTENANCE' | 'OFFLINE';
  currentLatencyMs: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  successRatePercent: number;
  uptimePercent: number;
  lastPingTime: string;
  endpointUrl: string;
}

export interface LatencyTimePoint {
  time: string;
  timestamp: number;
  gstnLatency: number;
  irpLatency: number;
  ewbLatency: number;
  gstinLatency: number;
  overallAvgLatency: number;
  targetSla: number;
}

export interface GstPortalHealthSummary {
  overallStatus: 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE';
  avgLatencyMs: number;
  overallSuccessRate: number;
  uptime24h: number;
  totalRequests1h: number;
  activeAlertsCount: number;
  endpoints: GstPortalEndpoint[];
  history: LatencyTimePoint[];
}

export interface CompanyRegistrationProfile {
  id: string;
  legalName: string;
  tradeName: string;
  entityType: 'PRIVATE_LIMITED' | 'PUBLIC_LIMITED' | 'LLP' | 'SOLE_PROPRIETORSHIP' | 'PARTNERSHIP' | 'PSU' | 'TRUST';
  cinLLPin: string;
  dateOfIncorporation: string;
  pan: string;
  tan: string;
  registeredAddress: string;
  corporateAddress: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  logoUrl?: string;
}

export interface GstinRegistrationItem {
  id: string;
  gstin: string;
  stateCode: string;
  stateName: string;
  registrationType: 'REGULAR' | 'COMPOSITION' | 'SEZ_UNIT' | 'SEZ_DEVELOPER' | 'ISD' | 'NON_RESIDENT';
  registrationDate: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  filingFrequency: 'MONTHLY' | 'QRMP';
  einvoicingStatus: 'ENABLED' | 'EXEMPTED' | 'PENDING';
  ewaybillStatus: 'ENABLED' | 'DISABLED';
  isPrimary: boolean;
}

export interface BranchDetailsItem {
  id: string;
  name: string;
  code: string;
  type: 'HEAD_OFFICE' | 'REGIONAL_OFFICE' | 'WAREHOUSE' | 'FACTORY' | 'RETAIL_STORE' | 'SEZ_UNIT';
  address: string;
  stateCode: string;
  stateName: string;
  gstin: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  status: 'ACTIVE' | 'INACTIVE';
  annualTurnoverContributionPct: number;
}

export interface FinancialYearConfigItem {
  activeFY: string;
  periodLockDate: string;
  taxMethod: 'ACCRUAL' | 'CASH';
  defaultCurrency: string;
  returnFilingCycle: 'MONTHLY' | 'QUARTERLY';
  booksBeginDate: string;
  autoLockFiledPeriods: boolean;
}

export interface StateConfigItem {
  stateCode: string;
  stateName: string;
  jurisdictionWard: string;
  jurisdictionCircle: string;
  commissionerate: string;
  intraStateEwayThreshold: number;
  interStateEwayThreshold: number;
  posRulesNote: string;
}

export interface BusinessProfileDetailsItem {
  turnoverBracket: '< 1.5 CR' | '1.5 CR - 5 CR' | '5 CR - 20 CR' | '> 20 CR';
  natureOfBusiness: string[];
  primaryHsnSacCodes: string[];
  iecCode?: string;
  sezStatus: boolean;
  eInvoicingApplicable: boolean;
}

export interface AuthorizedSignatoryItem {
  id: string;
  name: string;
  designation: string;
  pan: string;
  dinDpin?: string;
  mobile: string;
  email: string;
  isPrimary: boolean;
  dscStatus: 'ACTIVE' | 'EXPIRED' | 'NOT_CONFIGURED';
  dscExpiryDate?: string;
  evcStatus: 'ACTIVE' | 'INACTIVE';
}

// ==========================================
// REGULATORY EVENTS DATA MODEL
// ==========================================

export type RegulatoryAuthority = 'GST_COUNCIL' | 'CBIC' | 'MINISTRY_OF_FINANCE' | 'GSTN' | 'STATE_TAX_DEPT' | string;

export type RegulatoryLegalStatus = 'LEGALLY_EFFECTIVE' | 'RECOMMENDED' | 'GAZETTE_PENDING' | 'SUPERSEDED' | 'DRAFT_STAGE';

export type RegulatoryVerificationStatus = 'VERIFIED' | 'FLAGGED_MISMATCH' | 'BLOCKED';

export interface CouncilRecommendationDetails {
  meetingName: string; // e.g. "56th GST Council Meeting"
  meetingDate: string; // e.g. "2025-09-03"
  summary: string;
  pressReleaseUrl?: string;
  pressReleasePdfUrl?: string;
}

export interface OperativeGovernmentNotification {
  notificationNumber: string; // e.g. "Notification No. 01/2025-Central Tax (Rate)"
  notificationDate?: string; // e.g. "2025-09-17"
  effectiveDate: string; // e.g. "2025-09-22"
  officialPdfUrl?: string; // Link to official CBIC / Gazette PDF document
  provisions: string;
  impactedCategory?: string;
  gazetteReference?: string;
}

export interface SectorImpactMapping {
  sectorName: string;
  linkedNotification: string;
  treatment: string;
}

export interface RegulatoryEvent {
  id: string;
  title: string;
  category: 'RATE_REVISION' | 'COMPLIANCE_DEADLINE' | 'E_INVOICING' | 'ITC_RULES' | 'CIRCULAR' | string;
  authority: RegulatoryAuthority;
  councilRecommendation?: CouncilRecommendationDetails;
  operativeNotifications: OperativeGovernmentNotification[];
  effectiveDate: string;
  summary: string;
  legalStatus: RegulatoryLegalStatus;
  verificationStatus: RegulatoryVerificationStatus;
  mismatchAuditNote?: string;
  sectorMappings?: SectorImpactMapping[];
  reference: string;
  impactedSectors?: string[];
  actionRequired: string;
  sourceTitle: string;
  sourceUrl: string;
  officialPdfUrl?: string;
}

// Re-export refund types
export type {
  RefundCategory,
  RefundProcessingStatus,
  RefundTaxBreakdown,
  StatutoryDocument,
  RefundTimelineEvent,
  PfmsBankingDetails,
  StatutorySlaTracker,
  IcegateSyncDetails,
  ItcRefundClaim
} from './services/refundService';

// =========================================================================
// WHATSAPP NOTIFICATION & AUTOMATED GST REMINDERS TYPES
// =========================================================================

export type WhatsAppTemplateType = 
  | 'GST_DUE_DATE_REMINDER'
  | 'DEADLINE_ALERT'
  | 'FILING_REMINDER'
  | 'RETURN_FILED_SUCCESS'
  | 'GST_RETURN_FILED'
  | 'FILING_STATUS_UPDATE'
  | 'FILING_DRAFT_READY'
  | 'CLIENT_MONTHLY_DIGEST'
  | 'INVOICE_STATUS_NOTIFICATION'
  | 'PAYMENT_REMINDER'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_RECEIVED'
  | 'INVOICE_ISSUED'
  | 'E_INVOICE_GENERATED'
  | 'REFUND_STATUS'
  | 'RECONCILIATION_MISMATCH'
  | 'RECON_MISMATCH_ALERT'
  | 'CUSTOM';

export interface WhatsAppMessageLog {
  id: string;
  recipientPhone: string;
  recipientName?: string;
  recipientGstin?: string;
  template: WhatsAppTemplateType;
  messageBody: string;
  status: 'SENT' | 'DELIVERED' | 'FAILED' | 'QUEUED';
  timestamp: string;
  messageSid?: string;
  entityId?: string; // invoiceId or returnFormType
  entityType?: 'INVOICE' | 'GST_RETURN' | 'REFUND' | 'GENERAL';
  isAutomated?: boolean;
  error?: string;
  simulated?: boolean;
  metadata?: Record<string, any>;
}

export interface GstDueDateItem {
  id: string;
  returnType: 'GSTR-1' | 'GSTR-3B' | 'CMP-08' | 'GSTR-9' | 'GSTR-9C' | 'IFF' | 'GSTR-4' | 'GSTR-7' | 'GSTR-8';
  period: string; // e.g. "August 2026"
  dueDate: string; // e.g. "2026-09-20"
  description: string;
  taxpayerCategory: 'REGULAR' | 'COMPOSITION' | 'QRMP' | 'TDS_DEDUCTOR' | 'ECOMMERCE';
  frequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  status?: 'PENDING' | 'FILED' | 'OVERDUE' | 'UPCOMING';
  estimatedLiability?: number;
  daysRemaining: number;
  isUrgent: boolean;
  applicableClientsCount?: number;
}

export interface WhatsAppAutoReminderConfig {
  enabled: boolean;
  gstDueDateReminders: {
    enabled: boolean;
    daysBefore: number[]; // e.g. [7, 3, 1]
    targetReturns: string[]; // e.g. ['GSTR-1', 'GSTR-3B', 'CMP-08', 'GSTR-9']
    sendTime: string; // e.g. "09:00"
    includeLateFeeWarning: boolean;
  };
  invoiceStatusNotifications: {
    enabled: boolean;
    notifyOnIssued: boolean;
    notifyOnPaymentDue: boolean;
    notifyOnOverdue: boolean;
    notifyOnPaymentReceived: boolean;
    overdueDaysInterval: number;
    includeUpiPaymentLink: boolean;
  };
  defaultCountryCode: string;
  defaultFallbackNumber?: string;
}

export interface SendWhatsAppNotificationParams {
  to: string;
  template: WhatsAppTemplateType;
  data: Record<string, any>;
  recipientName?: string;
  recipientGstin?: string;
  entityId?: string;
  entityType?: 'INVOICE' | 'GST_RETURN' | 'REFUND' | 'GENERAL';
  isAutomated?: boolean;
}

export interface SendWhatsAppResponse {
  success: boolean;
  messageId?: string;
  status: 'SENT' | 'DELIVERED' | 'FAILED' | 'QUEUED';
  messageBody?: string;
  simulated?: boolean;
  error?: string;
  timestamp?: string;
}

export interface AutomatedGstRemindersSummary {
  totalProcessed: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  reminders: Array<{
    clientName: string;
    phone: string;
    returnType: string;
    dueDate: string;
    period: string;
    status: string;
    messageId?: string;
  }>;
}

export interface WhatsAppGatewayStatus {
  configured: boolean;
  accountSid: string | null;
  fromNumber: string;
  mode: 'LIVE' | 'SANDBOX_SIMULATION';
  totalLoggedMessages: number;
  lastActiveTimestamp?: string;
}

export interface FilingStatusWhatsAppParams {
  returnType: ReturnFormType | string;
  period: string;
  status: 'FILED' | 'PENDING' | 'OVERDUE' | 'DRAFT_READY' | 'REJECTED' | 'SAVED';
  arn?: string;
  filedDate?: string;
  taxLiability?: number;
  clientName: string;
  recipientPhone: string;
  recipientGstin?: string;
  customNotes?: string;
  includeReceiptLink?: boolean;
}

export interface WhatsAppClientItem {
  id: string;
  name: string;
  tradeName?: string;
  gstin: string;
  phone: string;
  email?: string;
  category?: 'REGULAR' | 'COMPOSITION' | 'QRMP' | 'TDS_DEDUCTOR' | string;
  taxpayerCategory?: string;
  currentFiling?: {
    returnType: ReturnFormType | string;
    period: string;
    status: 'FILED' | 'PENDING' | 'OVERDUE' | 'DRAFT_READY' | string;
    dueDate: string;
    arn?: string;
    taxLiability?: number;
    filedDate?: string;
  };
  filings?: Array<{
    returnType: ReturnFormType | string;
    period: string;
    status: 'FILED' | 'PENDING' | 'OVERDUE' | string;
    dueDate: string;
    arn?: string;
    taxLiability?: number;
  }>;
}



