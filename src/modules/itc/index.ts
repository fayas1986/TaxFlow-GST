/**
 * ITC Ledger & Reversal Rules Module
 */
import { TenantContext } from '../../core/tenancy/types';
import { AuthorizationPipeline } from '../../infrastructure/security/idorProtection';
import { Feature } from '../../core/entitlements/types';
import { Permission } from '../../core/permissions/types';

export class ItcModule {
  public static computeEligibleItc(ctx: TenantContext, params: { grossItc: number; ineligibleItcSec17_5: number }) {
    return AuthorizationPipeline.execute(
      {
        ctx,
        requiredFeature: Feature.ITC,
        requiredPermission: Permission.ITC_MANAGE
      },
      () => {
        return {
          grossItc: params.grossItc,
          blockedItc: params.ineligibleItcSec17_5,
          netEligibleItc: Math.max(0, params.grossItc - params.ineligibleItcSec17_5),
          rule36_4Cap: Math.round(params.grossItc * 1.05)
        };
      }
    );
  }
}
