/**
 * Tenant-Scoped Invoices Module
 */
import { TenantContext } from '../../core/tenancy/types';
import { 
  invoiceRepository, 
  ScopedInvoice, 
  withTenantScope, 
  WhereClause 
} from '../../infrastructure/database/repositories';
import { AuthorizationPipeline } from '../../infrastructure/security/idorProtection';
import { Permission } from '../../core/permissions/types';
import { Feature } from '../../core/entitlements/types';
import { UsageMetric } from '../../core/usage/types';

export class InvoicesModule {
  public static listInvoices(ctx: TenantContext, where?: WhereClause<ScopedInvoice>): ScopedInvoice[] {
    return AuthorizationPipeline.execute(
      {
        ctx,
        requiredPermission: Permission.INVOICE_READ,
        requiredFeature: Feature.INVOICES
      },
      () => {
        // Automatically injects where: { tenantId: ctx.tenantId } via HOF
        const client = withTenantScope(ctx, invoiceRepository);
        return client.findMany(where ? { where } : undefined);
      }
    );
  }

  public static getInvoice(ctx: TenantContext, id: string): ScopedInvoice | null {
    return AuthorizationPipeline.execute(
      {
        ctx,
        requiredPermission: Permission.INVOICE_READ,
        requiredFeature: Feature.INVOICES
      },
      () => {
        const client = withTenantScope(ctx, invoiceRepository);
        return client.findById(id);
      }
    );
  }

  public static createInvoice(ctx: TenantContext, data: Omit<ScopedInvoice, 'id' | 'tenantId'>): ScopedInvoice {
    return AuthorizationPipeline.execute(
      {
        ctx,
        requiredPermission: Permission.INVOICE_WRITE,
        requiredFeature: Feature.INVOICES,
        usageMetricToConsume: { metric: UsageMetric.INVOICE_DOCUMENTS, amount: 1 },
        auditAction: 'INVOICE_CREATE',
        auditModule: 'Invoices'
      },
      () => {
        const client = withTenantScope(ctx, invoiceRepository);
        return client.create(data);
      }
    );
  }
}

