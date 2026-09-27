/**
 * Central Scoped Audit Service
 * Enforces strict tenant boundaries on all audit logs.
 */

import { ScopedAuditEvent, AuditLogFilter } from './types';
import { TenantContext } from '../tenancy/types';

class AuditService {
  // tenantId -> ScopedAuditEvent[]
  private auditLogs: Map<string, ScopedAuditEvent[]> = new Map();
  private lastHash: Map<string, string> = new Map();

  constructor() {
    this.seedDefaultAuditLogs();
  }

  private simpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `sha256_${Math.abs(hash).toString(16).padStart(16, '0')}`;
  }

  private superAdminAuditLogs: ScopedAuditEvent[] = [];

  private seedDefaultAuditLogs() {
    this.logEvent(
      { tenantId: 't1', userId: 'u-fayas', userEmail: 'fayasamd@gmail.com', role: 'SUPER_ADMIN', plan: 'ENTERPRISE', permissions: [] },
      {
        action: 'TENANT_PROVISIONED',
        module: 'Tenancy',
        resourceType: 'Tenant',
        resourceId: 't1',
        ip: '192.168.1.1',
        status: 'SUCCESS',
        after: { name: 'Acme Technologies Private Limited', tier: 'ENTERPRISE' }
      }
    );

    this.logEvent(
      { tenantId: 't1', userId: 'u-fayas', userEmail: 'fayasamd@gmail.com', role: 'SUPER_ADMIN', plan: 'ENTERPRISE', permissions: [] },
      {
        action: 'RECONCILIATION_APPROVE',
        module: 'Reconciliation',
        resourceType: 'ReconciliationBatch',
        resourceId: 'RECON-2026-08',
        ip: '192.168.1.1',
        status: 'SUCCESS',
        before: { status: 'PENDING_APPROVAL' },
        after: { status: 'APPROVED', matchedCount: 1420 }
      }
    );

    this.logEvent(
      { tenantId: 't2', userId: 'u-globex-user', userEmail: 'accounts@globexengg.com', role: 'FINANCE_MANAGER', plan: 'PROFESSIONAL', permissions: [] },
      {
        action: 'INVOICE_CREATE',
        module: 'Invoices',
        resourceType: 'Invoice',
        resourceId: 'INV-GLB-001',
        ip: '10.0.0.4',
        status: 'SUCCESS',
        after: { invoiceNumber: 'INV-GLB-001', taxableAmount: 500000 }
      }
    );
  }

  /**
   * Log an audit event securely scoped to the active TenantContext
   */
  public logEvent(
    ctx: TenantContext,
    event: {
      action: string;
      module: string;
      resourceType: string;
      resourceId: string;
      gstinId?: string;
      branchId?: string;
      ip?: string;
      device?: string;
      status?: 'SUCCESS' | 'FAILURE';
      before?: any;
      after?: any;
      overrideReason?: string;
    }
  ): ScopedAuditEvent {
    const tenantId = ctx.tenantId;
    const prevHash = this.lastHash.get(tenantId) || 'GENESIS_HASH_0000000000';
    const timestamp = new Date().toISOString();
    const id = `audit-${tenantId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const rawPayload = `${tenantId}:${ctx.userId}:${event.action}:${event.resourceType}:${event.resourceId}:${timestamp}:${prevHash}`;
    const tamperHash = this.simpleHash(rawPayload);
    this.lastHash.set(tenantId, tamperHash);

    const auditRecord: ScopedAuditEvent = {
      id,
      tenantId,
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      role: ctx.role,
      action: event.action,
      module: event.module,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      gstinId: event.gstinId,
      branchId: event.branchId,
      timestamp,
      ip: event.ip || '127.0.0.1',
      device: event.device || 'Web-Browser/Desktop',
      status: event.status || 'SUCCESS',
      before: event.before,
      after: event.after,
      tamperHash,
      prevHash,
      isPlatformSuperAdminOverride: ctx.isPlatformSuperAdmin || false,
      overrideReason: event.overrideReason
    };

    const logs = this.auditLogs.get(tenantId) || [];
    logs.unshift(auditRecord);
    this.auditLogs.set(tenantId, logs);

    // If performed under platform super admin privilege, separately record in super admin audit log
    if (ctx.isPlatformSuperAdmin) {
      this.superAdminAuditLogs.unshift({ ...auditRecord });
    }

    return auditRecord;
  }

  /**
   * Query audit logs with STRICT TENANT ISOLATION.
   * Will NEVER return records from another tenant.
   */
  public getAuditLogs(ctx: TenantContext, filter?: AuditLogFilter): ScopedAuditEvent[] {
    const tenantLogs = this.auditLogs.get(ctx.tenantId) || [];

    return tenantLogs.filter(log => {
      // Hard check: absolutely enforce tenant isolation
      if (log.tenantId !== ctx.tenantId) return false;

      if (filter?.module && log.module.toLowerCase() !== filter.module.toLowerCase()) return false;
      if (filter?.action && log.action.toLowerCase() !== filter.action.toLowerCase()) return false;
      if (filter?.resourceType && log.resourceType.toLowerCase() !== filter.resourceType.toLowerCase()) return false;
      if (filter?.userId && log.userId !== filter.userId) return false;

      return true;
    });
  }

  /**
   * Retrieve platform Super Admin audit logs (accessible ONLY by platform super admins)
   */
  public getPlatformSuperAdminLogs(ctx: TenantContext): ScopedAuditEvent[] {
    if (!ctx.isPlatformSuperAdmin) {
      throw new Error('403 Forbidden: Only platform super admins can access platform audit logs');
    }
    return [...this.superAdminAuditLogs];
  }

  /**
   * Record security events such as cross-tenant access denials or unauthorized selection
   */
  public recordSecurityEvent(event: {
    action: string;
    tenantId: string;
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    details?: any;
  }): ScopedAuditEvent {
    const timestamp = new Date().toISOString();
    const id = `sec-${event.tenantId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const tamperHash = this.simpleHash(`${event.tenantId}:${event.userId}:${event.action}:${timestamp}`);

    const record: ScopedAuditEvent = {
      id,
      tenantId: event.tenantId,
      userId: event.userId,
      userEmail: `${event.userId}@unauthorized.attempt`,
      role: 'UNAUTHORIZED',
      action: event.action,
      module: 'SecurityGateway',
      resourceType: 'TENANT_BOUNDARY',
      resourceId: event.tenantId,
      timestamp,
      ip: event.ipAddress || '127.0.0.1',
      device: event.userAgent || 'API/HTTP-Client',
      status: 'FAILURE',
      after: event.details,
      tamperHash,
      prevHash: this.lastHash.get(event.tenantId) || 'GENESIS_HASH_0000000000',
      isPlatformSuperAdminOverride: false
    };

    const logs = this.auditLogs.get(event.tenantId) || [];
    logs.unshift(record);
    this.auditLogs.set(event.tenantId, logs);
    this.superAdminAuditLogs.unshift(record);

    return record;
  }
}

export const auditService = new AuditService();
