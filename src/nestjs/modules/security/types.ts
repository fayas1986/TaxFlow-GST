export interface SecurityContext {
  tenantId: string;
  userId: string;
  role: string;
  permissions: string[];
  allowedCompanies?: string[];
  allowedGstins?: string[];
  allowedBranches?: string[];
  sessionId?: string;
}

export interface SecurityAttackResult {
  attackType: string;
  targetDomain: string;
  passed: boolean;
  blockedBy: string;
  detail: string;
}

export interface AuditChainVerificationResult {
  valid: boolean;
  totalRecords: number;
  tamperedRecordId?: string;
  reason?: string;
}
