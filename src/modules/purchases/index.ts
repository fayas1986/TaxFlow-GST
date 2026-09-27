/**
 * Tenant-Scoped Purchases Module
 */
import { TenantContext } from '../../core/tenancy/types';
import { 
  purchaseRepository, 
  ScopedPurchase, 
  withTenantScope, 
  WhereClause 
} from '../../infrastructure/database/repositories';
import { AuthorizationPipeline } from '../../infrastructure/security/idorProtection';
import { Permission } from '../../core/permissions/types';
import { Feature } from '../../core/entitlements/types';
import { UsageMetric } from '../../core/usage/types';

export class PurchasesModule {
  public static listPurchases(ctx: TenantContext, where?: WhereClause<ScopedPurchase>): ScopedPurchase[] {
    return AuthorizationPipeline.execute(
      {
        ctx,
        requiredPermission: Permission.PURCHASE_READ,
        requiredFeature: Feature.PURCHASES
      },
      () => {
        const client = withTenantScope(ctx, purchaseRepository);
        return client.findMany(where ? { where } : undefined);
      }
    );
  }

  public static getPurchase(ctx: TenantContext, id: string): ScopedPurchase | null {
    return AuthorizationPipeline.execute(
      {
        ctx,
        requiredPermission: Permission.PURCHASE_READ,
        requiredFeature: Feature.PURCHASES
      },
      () => {
        const client = withTenantScope(ctx, purchaseRepository);
        return client.findById(id);
      }
    );
  }

  public static createPurchase(ctx: TenantContext, data: Omit<ScopedPurchase, 'id' | 'tenantId'>): ScopedPurchase {
    return AuthorizationPipeline.execute(
      {
        ctx,
        requiredPermission: Permission.PURCHASE_WRITE,
        requiredFeature: Feature.PURCHASES,
        usageMetricToConsume: { metric: UsageMetric.INVOICE_DOCUMENTS, amount: 1 },
        auditAction: 'PURCHASE_CREATE',
        auditModule: 'Purchases'
      },
      () => {
        const client = withTenantScope(ctx, purchaseRepository);
        return client.create(data);
      }
    );
  }
}
