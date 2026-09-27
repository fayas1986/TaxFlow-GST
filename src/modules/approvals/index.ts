/**
 * Approvals Workflow Module
 */
import { TenantContext } from '../../core/tenancy/types';
import { AuthorizationPipeline } from '../../infrastructure/security/idorProtection';
import { Permission } from '../../core/permissions/types';

export class ApprovalsModule {
  public static approveReconciliation(ctx: TenantContext, batchId: string) {
    return AuthorizationPipeline.execute(
      {
        ctx,
        requiredPermission: Permission.RECONCILIATION_APPROVE,
        auditAction: 'APPROVE_RECONCILIATION',
        auditModule: 'Approvals'
      },
      () => {
        return { batchId, status: 'APPROVED', approvedBy: ctx.userId };
      }
    );
  }
}
