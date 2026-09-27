/**
 * Tenant Scoped API Management Module
 */
import { TenantContext } from '../../core/tenancy/types';
import { AuthorizationPipeline } from '../../infrastructure/security/idorProtection';
import { Feature } from '../../core/entitlements/types';
import { Permission } from '../../core/permissions/types';

export class ApiModule {
  public static generateApiToken(ctx: TenantContext) {
    return AuthorizationPipeline.execute(
      {
        ctx,
        requiredFeature: Feature.API,
        requiredPermission: Permission.API_MANAGE
      },
      () => {
        return {
          token: `tok-${ctx.tenantId}-${Math.random().toString(36).substr(2, 16)}`,
          tenantId: ctx.tenantId,
          createdAt: new Date().toISOString()
        };
      }
    );
  }
}
