/**
 * Automation & Background Scheduling Module
 */
import { TenantContext } from '../../core/tenancy/types';
import { AuthorizationPipeline } from '../../infrastructure/security/idorProtection';
import { Feature } from '../../core/entitlements/types';

export class AutomationModule {
  public static scheduleAutoRecon(ctx: TenantContext, scheduleCron: string) {
    return AuthorizationPipeline.execute(
      {
        ctx,
        requiredFeature: Feature.AUTOMATION,
        auditAction: 'SCHEDULE_AUTO_RECON',
        auditModule: 'Automation'
      },
      () => {
        return { scheduleId: `sched-${ctx.tenantId}-recon`, cron: scheduleCron, status: 'ACTIVE' };
      }
    );
  }
}
