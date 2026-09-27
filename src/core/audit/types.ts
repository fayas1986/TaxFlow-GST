/**
 * Scoped Audit Logging Types
 * Guarantees every audit event is strictly bound to its owning tenant.
 */

export interface ScopedAuditEvent {
  id: string;
  tenantId: string;
  userId: string;
  userEmail?: string;
  role: string;
  action: string;
  module: string;
  resourceType: string;
  resourceId: string;
  gstinId?: string;
  branchId?: string;
  timestamp: string;
  ip: string;
  device?: string;
  status: 'SUCCESS' | 'FAILURE';
  before?: any;
  after?: any;
  tamperHash: string;
  prevHash?: string;
  isPlatformSuperAdminOverride?: boolean;
  overrideReason?: string;
}

export interface AuditLogFilter {
  module?: string;
  action?: string;
  resourceType?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}
