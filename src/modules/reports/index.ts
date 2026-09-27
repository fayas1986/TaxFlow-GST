/**
 * Statutory & MIS Reports Module
 */
import { TenantContext } from '../../core/tenancy/types';
import { reportRepository } from '../../infrastructure/database/repositories';
import { AuthorizationPipeline } from '../../infrastructure/security/idorProtection';
import { Permission } from '../../core/permissions/types';

export class ReportsModule {
  public static listReports(ctx: TenantContext) {
    return AuthorizationPipeline.execute(
      {
        ctx,
        requiredPermission: Permission.REPORT_VIEW
      },
      () => reportRepository.findMany(ctx)
    );
  }
}
