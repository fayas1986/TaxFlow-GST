// Hierarchical Approval Workflow Service
// Manages multi-tiered review pipelines for GST Returns and Reconciliation Adjustments
// Supporting Accountant Submissions, Finance Manager Reviews, Tax Head Escalations, and GSTN Portal Locks.

import { UserRole } from '../types';
import { safeStorage } from '../utils/safeStorage';

export type ApprovalRequestType = 
  | 'GSTR1_FILING'
  | 'GSTR3B_FILING'
  | 'GSTR9_ANNUAL'
  | 'ITC_RECON_ADJUSTMENT'
  | 'RCM_LIABILITY_ADJUSTMENT'
  | 'VENDOR_MISMATCH_CREDIT_NOTE'
  | 'TAX_RATE_CORRECTION';

export type ApprovalStatus = 
  | 'DRAFT'
  | 'PENDING_FINANCE_MANAGER'
  | 'PENDING_TAX_HEAD'
  | 'REVISION_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUBMITTED_TO_GSTN';

export type PriorityLevel = 'URGENT_DUE_SOON' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface WorkflowComment {
  id: string;
  authorName: string;
  authorRole: UserRole;
  authorEmail: string;
  timestamp: string;
  text: string;
  actionTaken?: 'SUBMITTED' | 'APPROVED' | 'REVISED' | 'ESCALATED' | 'REJECTED' | 'DISPATCHED' | 'AUDIT_OBSERVATION' | 'DELEGATED';
}

// Granular RBAC Permissions for Hierarchical Approval Workflow
export interface RoleApprovalPermission {
  role: UserRole;
  roleLabel: string;
  canDraft: boolean;
  canApproveL1: boolean; // Up to singleStageLimit (e.g. ₹5,00,000)
  canApproveL2: boolean; // High liability (> ₹5,00,000) & Tax Head Sign-off
  canRequestRevision: boolean;
  canReject: boolean;
  canEscalate: boolean;
  canDispatchToGstn: boolean;
  canModifyPolicy: boolean;
  canAuditAndRemark: boolean;
  maxSingleSignoffAmount: number; // 0 = unlimited, or specific currency ceiling
  description: string;
}

export const ROLE_APPROVAL_PERMISSIONS: Record<UserRole, RoleApprovalPermission> = {
  [UserRole.ACCOUNTANT]: {
    role: UserRole.ACCOUNTANT,
    roleLabel: 'Staff Accountant (Preparer)',
    canDraft: true,
    canApproveL1: false,
    canApproveL2: false,
    canRequestRevision: false,
    canReject: false,
    canEscalate: true,
    canDispatchToGstn: false,
    canModifyPolicy: false,
    canAuditAndRemark: false,
    maxSingleSignoffAmount: 0,
    description: 'Prepares draft returns, calculates taxes, uploads supporting workpapers, and responds to revision queries. Cannot self-approve (Four-Eyes principle).'
  },
  [UserRole.FINANCE_MANAGER]: {
    role: UserRole.FINANCE_MANAGER,
    roleLabel: 'Finance Manager (L1 Reviewer)',
    canDraft: true,
    canApproveL1: true,
    canApproveL2: false,
    canRequestRevision: true,
    canReject: true,
    canEscalate: true,
    canDispatchToGstn: false,
    canModifyPolicy: false,
    canAuditAndRemark: true,
    maxSingleSignoffAmount: 500000,
    description: 'First-line supervisory approval for filings & ITC adjustments up to ₹5,00,000. Escalates higher liability filings to Tax Head.'
  },
  [UserRole.ADMIN]: {
    role: UserRole.ADMIN,
    roleLabel: 'Tax Head / Partner (L2 Authority)',
    canDraft: true,
    canApproveL1: true,
    canApproveL2: true,
    canRequestRevision: true,
    canReject: true,
    canEscalate: false,
    canDispatchToGstn: true,
    canModifyPolicy: true,
    canAuditAndRemark: true,
    maxSingleSignoffAmount: 0, // Unlimited
    description: 'Principal statutory authority with unrestricted sign-off, dual authorization for high-value liabilities, EVC/DSC dispatch, and policy governance.'
  },
  [UserRole.SUPER_ADMIN]: {
    role: UserRole.SUPER_ADMIN,
    roleLabel: 'Enterprise Super Admin',
    canDraft: true,
    canApproveL1: true,
    canApproveL2: true,
    canRequestRevision: true,
    canReject: true,
    canEscalate: false,
    canDispatchToGstn: true,
    canModifyPolicy: true,
    canAuditAndRemark: true,
    maxSingleSignoffAmount: 0,
    description: 'Full administrative access across all tenant branches, delegation controls, emergency override, and policy matrix management.'
  },
  [UserRole.AUDITOR]: {
    role: UserRole.AUDITOR,
    roleLabel: 'External / Internal Auditor (Assurance)',
    canDraft: false,
    canApproveL1: false,
    canApproveL2: false,
    canRequestRevision: false,
    canReject: false,
    canEscalate: false,
    canDispatchToGstn: false,
    canModifyPolicy: false,
    canAuditAndRemark: true,
    maxSingleSignoffAmount: 0,
    description: 'Independent inspection role. Verifies four-eyes segregation of duties, inspects cryptographic certificates, and logs compliance observations without mutating workflow state.'
  },
  [UserRole.VIEWER]: {
    role: UserRole.VIEWER,
    roleLabel: 'Executive Viewer (Read-Only)',
    canDraft: false,
    canApproveL1: false,
    canApproveL2: false,
    canRequestRevision: false,
    canReject: false,
    canEscalate: false,
    canDispatchToGstn: false,
    canModifyPolicy: false,
    canAuditAndRemark: false,
    maxSingleSignoffAmount: 0,
    description: 'Read-only access for corporate board and management overview of tax liability pipelines and bottleneck analytics.'
  },
  [UserRole.CUSTOMER]: {
    role: UserRole.CUSTOMER,
    roleLabel: 'Customer / Client',
    canDraft: false,
    canApproveL1: false,
    canApproveL2: false,
    canRequestRevision: false,
    canReject: false,
    canEscalate: false,
    canDispatchToGstn: false,
    canModifyPolicy: false,
    canAuditAndRemark: false,
    maxSingleSignoffAmount: 0,
    description: 'Client portal representative with access to personal document upload and sales invoices.'
  }
};

// Delegation of Authority (DOA)
export interface DelegationOfAuthority {
  id: string;
  delegatorRole: UserRole;
  delegatorName: string;
  delegatedToRole: UserRole;
  delegatedToName: string;
  delegatedToEmail: string;
  maxApprovalLimit: number; // e.g. 500000
  startDate: string;
  endDate: string;
  isActive: boolean;
  reason: string;
}

export interface TaxBreakdown {
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalTax: number;
}

export interface RiskCheckItem {
  id: string;
  category: 'ITC_VARIANCE' | 'TURNOVER_MISMATCH' | 'RCM_COMPLIANCE' | 'DEADLINE_RISK' | 'TAX_RATE_VALIDATION';
  label: string;
  status: 'PASS' | 'WARNING' | 'FAIL';
  details: string;
}

export interface ApprovalRequest {
  id: string;
  requestNumber: string;
  requestType: ApprovalRequestType;
  title: string;
  description: string;
  taxPeriod: string; // e.g. 'June 2026'
  gstin: string;
  branchName: string;
  financialYear: string;
  priority: PriorityLevel;
  
  // Tax details
  taxAmount: TaxBreakdown;
  turnoverImpact?: number;
  
  // Submitter details (Level 1 - Accountant)
  submittedBy: {
    name: string;
    email: string;
    role: UserRole;
    timestamp: string;
  };

  // Reviewer details (Level 2 - Finance Manager)
  reviewedBy?: {
    name: string;
    email: string;
    role: UserRole;
    timestamp: string;
    decisionNote?: string;
  };

  // Final Sign-off details (Level 3 - Tax Head / Partner) if escalated
  escalatedToTaxHead?: boolean;
  approvedByTaxHead?: {
    name: string;
    email: string;
    role: UserRole;
    timestamp: string;
  };

  // Current State
  status: ApprovalStatus;
  currentAssigneeRole: UserRole;
  dueByDate: string;
  
  // Supporting documents & checks
  supportingDocCount: number;
  supportingDocName?: string;
  riskChecks: RiskCheckItem[];
  riskScore: number; // 0 to 100
  
  // Audit Trail & Digital Hash
  comments: WorkflowComment[];
  digitalSignatureHash?: string;
  portalSubmissionArn?: string;
  updatedAt: string;
}

export interface ApprovalThresholdConfig {
  singleStageLimit: number; // e.g., <= Rs. 500,000 needs only FM
  requireTwoStageApproval: boolean; // > Rs. 500,000 needs Tax Head
  autoEscalateHoursBeforeDeadline: number;
  enforceEvcOtpSignoff: boolean;
  allowAccountantDrafting: boolean;
}

const LOCAL_STORAGE_KEY = 'TF_APPROVAL_WORKFLOWS_V1';
const POLICY_CONFIG_KEY = 'TF_APPROVAL_POLICY_CONFIG_V1';
const DELEGATIONS_KEY = 'TF_APPROVAL_DELEGATIONS_V1';

const INITIAL_MOCK_DELEGATIONS: DelegationOfAuthority[] = [
  {
    id: 'del-01',
    delegatorRole: UserRole.FINANCE_MANAGER,
    delegatorName: 'Anish Kapoor',
    delegatedToRole: UserRole.ACCOUNTANT,
    delegatedToName: 'Rohan Sharma',
    delegatedToEmail: 'rohan.accountant@taxflow.in',
    maxApprovalLimit: 200000,
    startDate: '2026-07-20',
    endDate: '2026-07-31',
    isActive: true,
    reason: 'Interim Acting Approval Authority during audit closing week (Capped at ₹2,00,000)'
  }
];

// Default Policy Configuration
export const DEFAULT_APPROVAL_POLICY: ApprovalThresholdConfig = {
  singleStageLimit: 500000, // 5 Lakhs INR
  requireTwoStageApproval: true,
  autoEscalateHoursBeforeDeadline: 24,
  enforceEvcOtpSignoff: true,
  allowAccountantDrafting: true
};

// Seed Mock Approval Requests for demonstration
const INITIAL_MOCK_REQUESTS: ApprovalRequest[] = [
  {
    id: 'req-001',
    requestNumber: 'REQ-2026-06-001',
    requestType: 'GSTR3B_FILING',
    title: 'GSTR-3B Monthly Return - June 2026 (MH Branch)',
    description: 'Monthly summary tax payment & ITC claim calculation for Maharashtra principal place of business.',
    taxPeriod: 'June 2026',
    gstin: '27ABCDE1234F1Z5',
    branchName: 'Mumbai HQ Branch',
    financialYear: '2026-27',
    priority: 'URGENT_DUE_SOON',
    taxAmount: {
      cgst: 185000,
      sgst: 185000,
      igst: 420000,
      cess: 15000,
      totalTax: 805000
    },
    turnoverImpact: 4472222,
    submittedBy: {
      name: 'Rohan Sharma',
      email: 'rohan.accountant@taxflow.in',
      role: UserRole.ACCOUNTANT,
      timestamp: '2026-07-25T10:30:00Z'
    },
    status: 'PENDING_FINANCE_MANAGER',
    currentAssigneeRole: UserRole.FINANCE_MANAGER,
    dueByDate: '2026-07-28',
    supportingDocCount: 3,
    supportingDocName: 'GSTR3B_Rec_Summary_Jun2026.pdf',
    riskChecks: [
      { id: 'r1', category: 'ITC_VARIANCE', label: 'GSTR-3B vs 2B ITC Variance', status: 'PASS', details: 'Variance is +1.2% (Well within 5% allowable limit)' },
      { id: 'r2', category: 'TURNOVER_MISMATCH', label: 'Turnover vs GSTR-1 Outward', status: 'PASS', details: 'Reconciled 100% with e-Invoices' },
      { id: 'r3', category: 'RCM_COMPLIANCE', label: 'Reverse Charge Liability Self-Invoice', status: 'PASS', details: 'RCM tax liability verified for freight & legal fees' }
    ],
    riskScore: 94,
    comments: [
      {
        id: 'c1',
        authorName: 'Rohan Sharma',
        authorRole: UserRole.ACCOUNTANT,
        authorEmail: 'rohan.accountant@taxflow.in',
        timestamp: '2026-07-25T10:30:00Z',
        text: 'Prepared GSTR-3B after verifying all vendor 2B ITC credit notes. Net liability payable via cash ledger is Rs 3,40,000 after ITC set-off.',
        actionTaken: 'SUBMITTED'
      }
    ],
    updatedAt: '2026-07-25T10:30:00Z'
  },
  {
    id: 'req-002',
    requestNumber: 'REQ-2026-06-002',
    requestType: 'ITC_RECON_ADJUSTMENT',
    title: 'ITC Claim Adjustment - Vendor Mismatch Reclass (DL Branch)',
    description: 'Claiming provisional ITC under Rule 36(4) for delayed supplier invoice uploads totaling Rs 1.45 Lakhs.',
    taxPeriod: 'June 2026',
    gstin: '07AAAAA0000A1Z5',
    branchName: 'Delhi NCR Hub',
    financialYear: '2026-27',
    priority: 'HIGH',
    taxAmount: {
      cgst: 65000,
      sgst: 65000,
      igst: 15000,
      cess: 0,
      totalTax: 145000
    },
    turnoverImpact: 805555,
    submittedBy: {
      name: 'Priya Verma',
      email: 'priya.accountant@taxflow.in',
      role: UserRole.ACCOUNTANT,
      timestamp: '2026-07-24T15:10:00Z'
    },
    reviewedBy: {
      name: 'Anish Kapoor',
      email: 'anish.finance@taxflow.in',
      role: UserRole.FINANCE_MANAGER,
      timestamp: '2026-07-25T09:00:00Z',
      decisionNote: 'Requested additional vendor confirmation letter for Supplier TCS Logistics.'
    },
    status: 'REVISION_REQUESTED',
    currentAssigneeRole: UserRole.ACCOUNTANT,
    dueByDate: '2026-07-29',
    supportingDocCount: 2,
    supportingDocName: 'Vendor_Mismatch_Recon_June.xlsx',
    riskChecks: [
      { id: 'r1', category: 'ITC_VARIANCE', label: 'Rule 36(4) Provisional ITC Cap', status: 'WARNING', details: 'Provisional ITC claim is 4.8% (Cap is 5.0%)' },
      { id: 'r2', category: 'DEADLINE_RISK', label: 'GSTR-2B Refresh Sync', status: 'PASS', details: 'Synced with GSTN Portal on 24th July' }
    ],
    riskScore: 78,
    comments: [
      {
        id: 'c1',
        authorName: 'Priya Verma',
        authorRole: UserRole.ACCOUNTANT,
        authorEmail: 'priya.accountant@taxflow.in',
        timestamp: '2026-07-24T15:10:00Z',
        text: 'Submitted adjustment for TCS Logistics invoice #INV-9821. Supplier confirmed GSTR-1 will be filed by 28th.',
        actionTaken: 'SUBMITTED'
      },
      {
        id: 'c2',
        authorName: 'Anish Kapoor',
        authorRole: UserRole.FINANCE_MANAGER,
        authorEmail: 'anish.finance@taxflow.in',
        timestamp: '2026-07-25T09:00:00Z',
        text: 'Please attach written email confirmation from TCS Logistics CFO before final approval.',
        actionTaken: 'REVISED'
      }
    ],
    updatedAt: '2026-07-25T09:00:00Z'
  },
  {
    id: 'req-003',
    requestNumber: 'REQ-2026-06-003',
    requestType: 'GSTR1_FILING',
    title: 'GSTR-1 Outward Supplies Filing - June 2026 (KA Branch)',
    description: 'Outward B2B and B2C sales register export summary for Karnataka unit with e-Way Bill cross validation.',
    taxPeriod: 'June 2026',
    gstin: '29AAACW9876K1Z2',
    branchName: 'Bengaluru Tech Park',
    financialYear: '2026-27',
    priority: 'MEDIUM',
    taxAmount: {
      cgst: 210000,
      sgst: 210000,
      igst: 850000,
      cess: 25000,
      totalTax: 1295000
    },
    turnoverImpact: 7194444,
    submittedBy: {
      name: 'Rohan Sharma',
      email: 'rohan.accountant@taxflow.in',
      role: UserRole.ACCOUNTANT,
      timestamp: '2026-07-23T11:00:00Z'
    },
    reviewedBy: {
      name: 'Anish Kapoor',
      email: 'anish.finance@taxflow.in',
      role: UserRole.FINANCE_MANAGER,
      timestamp: '2026-07-24T14:30:00Z',
      decisionNote: 'Value exceeds Rs 5 Lakhs single stage threshold. Escalated to Tax Head for final review.'
    },
    escalatedToTaxHead: true,
    status: 'PENDING_TAX_HEAD',
    currentAssigneeRole: UserRole.ADMIN, // Tax Head / Admin
    dueByDate: '2026-07-27',
    supportingDocCount: 4,
    supportingDocName: 'GSTR1_Outward_Register_Jun2026.xlsx',
    riskChecks: [
      { id: 'r1', category: 'TURNOVER_MISMATCH', label: 'E-Invoice IRN Match Rate', status: 'PASS', details: '100% of B2B invoices have valid IRN & QR codes' },
      { id: 'r2', category: 'TAX_RATE_VALIDATION', label: 'HSN Rate Verification', status: 'PASS', details: 'All 8-digit HSN codes match 18% & 28% GST schedules' }
    ],
    riskScore: 98,
    comments: [
      {
        id: 'c1',
        authorName: 'Rohan Sharma',
        authorRole: UserRole.ACCOUNTANT,
        authorEmail: 'rohan.accountant@taxflow.in',
        timestamp: '2026-07-23T11:00:00Z',
        text: 'Outward register ready for filing. Total 412 B2B invoices and 1,820 B2C summaries validated.',
        actionTaken: 'SUBMITTED'
      },
      {
        id: 'c2',
        authorName: 'Anish Kapoor',
        authorRole: UserRole.FINANCE_MANAGER,
        authorEmail: 'anish.finance@taxflow.in',
        timestamp: '2026-07-24T14:30:00Z',
        text: 'Reviewed and verified IRN mappings. Due to high value (Rs 12.95 Lakhs), escalating to Partner/Admin for final GSTN EVC authorization.',
        actionTaken: 'ESCALATED'
      }
    ],
    updatedAt: '2026-07-24T14:30:00Z'
  },
  {
    id: 'req-004',
    requestNumber: 'REQ-2026-05-004',
    requestType: 'RCM_LIABILITY_ADJUSTMENT',
    title: 'RCM Liability Self-Invoice Adjustment - May 2026',
    description: 'Reverse Charge liability adjustment for foreign software subscriptions & director remuneration.',
    taxPeriod: 'May 2026',
    gstin: '27ABCDE1234F1Z5',
    branchName: 'Mumbai HQ Branch',
    financialYear: '2026-27',
    priority: 'LOW',
    taxAmount: {
      cgst: 18000,
      sgst: 18000,
      igst: 54000,
      cess: 0,
      totalTax: 90000
    },
    turnoverImpact: 500000,
    submittedBy: {
      name: 'Rohan Sharma',
      email: 'rohan.accountant@taxflow.in',
      role: UserRole.ACCOUNTANT,
      timestamp: '2026-06-18T09:15:00Z'
    },
    reviewedBy: {
      name: 'Anish Kapoor',
      email: 'anish.finance@taxflow.in',
      role: UserRole.FINANCE_MANAGER,
      timestamp: '2026-06-19T10:00:00Z',
      decisionNote: 'Verified with international SaaS payment invoices.'
    },
    status: 'SUBMITTED_TO_GSTN',
    currentAssigneeRole: UserRole.FINANCE_MANAGER,
    dueByDate: '2026-06-20',
    supportingDocCount: 1,
    supportingDocName: 'RCM_Self_Invoice_May2026.pdf',
    riskChecks: [
      { id: 'r1', category: 'RCM_COMPLIANCE', label: 'RCM Ledger Match', status: 'PASS', details: 'RCM liability set off against ITC same month' }
    ],
    riskScore: 100,
    comments: [
      {
        id: 'c1',
        authorName: 'Rohan Sharma',
        authorRole: UserRole.ACCOUNTANT,
        authorEmail: 'rohan.accountant@taxflow.in',
        timestamp: '2026-06-18T09:15:00Z',
        text: 'Self-invoices generated for AWS and Google Workspace import of services.',
        actionTaken: 'SUBMITTED'
      },
      {
        id: 'c2',
        authorName: 'Anish Kapoor',
        authorRole: UserRole.FINANCE_MANAGER,
        authorEmail: 'anish.finance@taxflow.in',
        timestamp: '2026-06-19T10:00:00Z',
        text: 'Approved for portal filing with EVC signoff.',
        actionTaken: 'APPROVED'
      }
    ],
    digitalSignatureHash: '8f92b1a3c74e01d9f823a01948271e8473a10294b817c6a91d2837492c1092',
    portalSubmissionArn: 'AA270526019823412',
    updatedAt: '2026-06-19T10:30:00Z'
  }
];

// Helper Functions
export const loadApprovalRequests = (): ApprovalRequest[] => {
  try {
    const raw = safeStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      safeStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_MOCK_REQUESTS));
      return INITIAL_MOCK_REQUESTS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load approval requests from local storage:', err);
    return INITIAL_MOCK_REQUESTS;
  }
};

export const saveApprovalRequests = (requests: ApprovalRequest[]) => {
  try {
    safeStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(requests));
  } catch (err) {
    console.error('Failed to save approval requests:', err);
  }
};

export const loadPolicyConfig = (): ApprovalThresholdConfig => {
  try {
    const raw = safeStorage.getItem(POLICY_CONFIG_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_APPROVAL_POLICY;
  } catch (err) {
    return DEFAULT_APPROVAL_POLICY;
  }
};

export const savePolicyConfig = (config: ApprovalThresholdConfig) => {
  try {
    safeStorage.setItem(POLICY_CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save approval policy config:', err);
  }
};

export const loadDelegations = (): DelegationOfAuthority[] => {
  try {
    const raw = safeStorage.getItem(DELEGATIONS_KEY);
    if (!raw) {
      safeStorage.setItem(DELEGATIONS_KEY, JSON.stringify(INITIAL_MOCK_DELEGATIONS));
      return INITIAL_MOCK_DELEGATIONS;
    }
    return JSON.parse(raw);
  } catch (err) {
    return INITIAL_MOCK_DELEGATIONS;
  }
};

export const saveDelegations = (delegations: DelegationOfAuthority[]) => {
  try {
    safeStorage.setItem(DELEGATIONS_KEY, JSON.stringify(delegations));
  } catch (err) {
    console.error('Failed to save delegations:', err);
  }
};

export const createDelegation = (delegation: Omit<DelegationOfAuthority, 'id'>): DelegationOfAuthority => {
  const list = loadDelegations();
  const newItem: DelegationOfAuthority = {
    ...delegation,
    id: `del-${Date.now()}`
  };
  const updated = [newItem, ...list];
  saveDelegations(updated);
  return newItem;
};

export const toggleDelegation = (id: string): DelegationOfAuthority[] => {
  const list = loadDelegations();
  const updated = list.map(d => d.id === id ? { ...d, isActive: !d.isActive } : d);
  saveDelegations(updated);
  return updated;
};

export interface RbacActionValidationResult {
  allowed: boolean;
  reason?: string;
  requiredRole?: string;
  isFourEyesViolation?: boolean;
  isOverLimit?: boolean;
  hasDelegation?: boolean;
}

/**
 * Validates whether the active role has permission to execute an approval workflow action.
 * Strict Four-Eyes Separation of Duties (SoD) & Value Tier Checks.
 */
export const validateApprovalActionPermission = (
  userRole: UserRole,
  action: 'APPROVE' | 'REQUEST_REVISION' | 'REJECT' | 'ESCALATE' | 'DISPATCH_TO_GSTN' | 'AUDIT_OBSERVATION',
  request: ApprovalRequest,
  userEmail?: string,
  policy?: ApprovalThresholdConfig,
  delegations: DelegationOfAuthority[] = []
): RbacActionValidationResult => {
  const effectivePolicy = policy || loadPolicyConfig();
  const perms = ROLE_APPROVAL_PERMISSIONS[userRole] || ROLE_APPROVAL_PERMISSIONS[UserRole.VIEWER];
  const totalTax = request.taxAmount.totalTax;

  // 1. Separation of Duties (SoD) / Four-Eyes Check
  // The person who drafted / submitted the request cannot approve or dispatch it.
  const isAuthor = userEmail && request.submittedBy.email && userEmail.toLowerCase() === request.submittedBy.email.toLowerCase();
  if (isAuthor && (action === 'APPROVE' || action === 'DISPATCH_TO_GSTN')) {
    return {
      allowed: false,
      isFourEyesViolation: true,
      reason: 'Separation of Duties (SoD) Governance: Preparers cannot approve their own submissions (Four-Eyes Principle).',
      requiredRole: 'Independent Reviewer (Finance Manager or Tax Head)'
    };
  }

  // 2. Auditor Special Handling
  if (userRole === UserRole.AUDITOR) {
    if (action === 'AUDIT_OBSERVATION') {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Auditors have read-only inspection access. Use "Add Audit Observation" to record compliance remarks.',
      requiredRole: 'Finance Manager or Admin'
    };
  }

  // 3. Viewer Special Handling
  if (userRole === UserRole.VIEWER) {
    return {
      allowed: false,
      reason: 'Viewer role has read-only executive visibility and cannot mutate workflow status.',
      requiredRole: 'Finance Manager or Admin'
    };
  }

  // 4. Check Active Delegation of Authority
  const activeDelegation = delegations.find(d => 
    d.isActive && 
    (d.delegatedToRole === userRole || (userEmail && d.delegatedToEmail.toLowerCase() === userEmail.toLowerCase()))
  );

  // 5. Action Specific Validations
  if (action === 'APPROVE') {
    // If request is in PENDING_TAX_HEAD status
    if (request.status === 'PENDING_TAX_HEAD') {
      if (userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'This high-value return (> single stage limit) has been escalated to Level-2. Only Tax Head / Partner (Admin) can sign off.',
        requiredRole: 'Tax Head / Partner (Admin)'
      };
    }

    // If request is in PENDING_FINANCE_MANAGER status
    if (request.status === 'PENDING_FINANCE_MANAGER') {
      if (userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN || userRole === UserRole.FINANCE_MANAGER) {
        return { allowed: true };
      }
      // Check if accountant has delegation
      if (activeDelegation && totalTax <= activeDelegation.maxApprovalLimit) {
        return { 
          allowed: true, 
          hasDelegation: true, 
          reason: `Permitted under active Delegation of Authority (${activeDelegation.delegatorName} up to ₹${activeDelegation.maxApprovalLimit.toLocaleString('en-IN')})` 
        };
      }
      return {
        allowed: false,
        reason: 'Requires Finance Manager (L1 Reviewer) or Tax Head sign-off.',
        requiredRole: 'Finance Manager or Tax Head'
      };
    }

    return { allowed: false, reason: `Cannot approve request currently in [${request.status}] state.` };
  }

  if (action === 'REQUEST_REVISION' || action === 'REJECT') {
    if (perms.canRequestRevision || perms.canReject) {
      return { allowed: true };
    }
    if (activeDelegation) {
      return { allowed: true, hasDelegation: true };
    }
    return {
      allowed: false,
      reason: 'Only Reviewers (Finance Manager / Tax Head) can request revisions or reject submissions.',
      requiredRole: 'Finance Manager or Tax Head'
    };
  }

  if (action === 'ESCALATE') {
    return { allowed: true };
  }

  if (action === 'DISPATCH_TO_GSTN') {
    if (request.status !== 'APPROVED') {
      return { allowed: false, reason: 'Request must be in APPROVED state before portal dispatch.' };
    }
    if (perms.canDispatchToGstn) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Only Authorized Signatories (Tax Head / Admin) can execute EVC/DSC digital signature locks and dispatch to GSTN portal.',
      requiredRole: 'Tax Head / Admin (Authorized Signatory)'
    };
  }

  return { allowed: true };
};

// Add Formal Auditor Observation to Immutable Trail
export const addAuditorObservation = (
  requestId: string,
  user: { name: string; email: string; role: UserRole },
  observation: string
): ApprovalRequest => {
  const requests = loadApprovalRequests();
  const index = requests.findIndex(r => r.id === requestId);
  if (index === -1) throw new Error('Approval request not found');

  const req = requests[index];
  const comment: WorkflowComment = {
    id: `audit-${Date.now()}`,
    authorName: user.name,
    authorRole: user.role,
    authorEmail: user.email,
    timestamp: new Date().toISOString(),
    text: `[AUDIT OBSERVATION]: ${observation}`,
    actionTaken: 'AUDIT_OBSERVATION'
  };

  req.comments.push(comment);
  req.updatedAt = new Date().toISOString();
  requests[index] = req;
  saveApprovalRequests(requests);
  return req;
};

// Create New Approval Request
export const createApprovalRequest = (
  input: Omit<ApprovalRequest, 'id' | 'requestNumber' | 'status' | 'comments' | 'updatedAt' | 'currentAssigneeRole' | 'submittedBy'>,
  user: { name: string; email: string; role: UserRole }
): ApprovalRequest => {
  const requests = loadApprovalRequests();
  const nextNum = requests.length + 1;
  const reqNum = `REQ-2026-${String(nextNum).padStart(3, '0')}`;
  
  const policy = loadPolicyConfig();
  const totalTax = input.taxAmount.totalTax;
  
  // Assign initial target role based on hierarchy
  const initialAssignee = UserRole.FINANCE_MANAGER;

  const newRequest: ApprovalRequest = {
    ...input,
    id: `req-${Date.now()}`,
    requestNumber: reqNum,
    status: 'PENDING_FINANCE_MANAGER',
    currentAssigneeRole: initialAssignee,
    submittedBy: {
      name: user.name,
      email: user.email,
      role: user.role,
      timestamp: new Date().toISOString()
    },
    comments: [
      {
        id: `c-${Date.now()}`,
        authorName: user.name,
        authorRole: user.role,
        authorEmail: user.email,
        timestamp: new Date().toISOString(),
        text: `Submitted ${input.title} for Finance Manager review. Total Tax Value: ₹${totalTax.toLocaleString('en-IN')}.`,
        actionTaken: 'SUBMITTED'
      }
    ],
    updatedAt: new Date().toISOString()
  };

  const updatedList = [newRequest, ...requests];
  saveApprovalRequests(updatedList);
  return newRequest;
};

// Transition Approval State (Approve / Reject / Escalated / Revision / Dispatch)
export const updateApprovalStatus = (
  requestId: string,
  action: 'APPROVE' | 'REQUEST_REVISION' | 'REJECT' | 'ESCALATE' | 'DISPATCH_TO_GSTN',
  user: { name: string; email: string; role: UserRole },
  note?: string
): ApprovalRequest => {
  const requests = loadApprovalRequests();
  const index = requests.findIndex(r => r.id === requestId);
  if (index === -1) throw new Error('Approval request not found');

  const req = requests[index];
  const policy = loadPolicyConfig();
  let newStatus = req.status;
  let newAssignee = req.currentAssigneeRole;
  let actionTakenName: WorkflowComment['actionTaken'] = 'APPROVED';

  if (action === 'APPROVE') {
    // Check if threshold requires 2nd stage Tax Head approval
    if (policy.requireTwoStageApproval && req.taxAmount.totalTax > policy.singleStageLimit && !req.escalatedToTaxHead) {
      newStatus = 'PENDING_TAX_HEAD';
      newAssignee = UserRole.ADMIN; // Tax Head
      req.escalatedToTaxHead = true;
      actionTakenName = 'ESCALATED';
      req.reviewedBy = {
        name: user.name,
        email: user.email,
        role: user.role,
        timestamp: new Date().toISOString(),
        decisionNote: note || 'First level Finance Manager approval passed. Escalated for Tax Head signoff.'
      };
    } else {
      newStatus = 'APPROVED';
      actionTakenName = 'APPROVED';
      if (req.status === 'PENDING_TAX_HEAD') {
        req.approvedByTaxHead = {
          name: user.name,
          email: user.email,
          role: user.role,
          timestamp: new Date().toISOString()
        };
      } else {
        req.reviewedBy = {
          name: user.name,
          email: user.email,
          role: user.role,
          timestamp: new Date().toISOString(),
          decisionNote: note || 'Approved by Finance Manager.'
        };
      }
    }
  } else if (action === 'REQUEST_REVISION') {
    newStatus = 'REVISION_REQUESTED';
    newAssignee = UserRole.ACCOUNTANT;
    actionTakenName = 'REVISED';
  } else if (action === 'REJECT') {
    newStatus = 'REJECTED';
    actionTakenName = 'REJECTED';
  } else if (action === 'ESCALATE') {
    newStatus = 'PENDING_TAX_HEAD';
    newAssignee = UserRole.ADMIN;
    req.escalatedToTaxHead = true;
    actionTakenName = 'ESCALATED';
  } else if (action === 'DISPATCH_TO_GSTN') {
    newStatus = 'SUBMITTED_TO_GSTN';
    actionTakenName = 'DISPATCHED';
    req.digitalSignatureHash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    req.portalSubmissionArn = `AA${req.gstin.substring(0, 2)}${new Date().getMonth() + 1}26${Math.floor(10000000 + Math.random() * 90000000)}`;
  }

  const comment: WorkflowComment = {
    id: `c-${Date.now()}`,
    authorName: user.name,
    authorRole: user.role,
    authorEmail: user.email,
    timestamp: new Date().toISOString(),
    text: note || `Action [${action}] applied by ${user.name}.`,
    actionTaken: actionTakenName
  };

  req.status = newStatus;
  req.currentAssigneeRole = newAssignee;
  req.comments.push(comment);
  req.updatedAt = new Date().toISOString();

  requests[index] = req;
  saveApprovalRequests(requests);
  return req;
};

// Reset demo state back to default seed items
export const resetApprovalDataToSeed = () => {
  saveApprovalRequests(INITIAL_MOCK_REQUESTS);
  return INITIAL_MOCK_REQUESTS;
};
