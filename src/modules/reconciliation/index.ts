/**
 * ITC Reconciliation Module (GSTR-2B Matching)
 */
import { TenantContext } from '../../core/tenancy/types';
import { reconciliationRepository } from '../../infrastructure/database/repositories';
import { AuthorizationPipeline } from '../../infrastructure/security/idorProtection';
import { Feature } from '../../core/entitlements/types';
import { Permission } from '../../core/permissions/types';
import { UsageMetric } from '../../core/usage/types';

export class ReconciliationModule {
  public static listBatches(ctx: TenantContext) {
    return AuthorizationPipeline.execute(
      {
        ctx,
        requiredFeature: Feature.RECONCILIATION,
        requiredPermission: Permission.RECONCILIATION_READ
      },
      () => reconciliationRepository.findMany(ctx)
    );
  }

  public static runMatching(ctx: TenantContext, period: string) {
    return AuthorizationPipeline.execute(
      {
        ctx,
        requiredFeature: Feature.RECONCILIATION,
        requiredPermission: Permission.RECONCILIATION_EXECUTE,
        usageMetricToConsume: { metric: UsageMetric.RECONCILIATION_DOCUMENTS, amount: 100 },
        auditAction: 'RECONCILIATION_EXECUTE',
        auditModule: 'Reconciliation'
      },
      () => {
        return reconciliationRepository.create(ctx, {
          batchId: `BATCH-${ctx.tenantId.toUpperCase()}-${period}`,
          period,
          matchedCount: 250,
          mismatchCount: 5,
          missingIn2bCount: 1,
          totalTaxClaimed: 450000,
          status: 'COMPLETED'
        });
      }
    );
  }
}
