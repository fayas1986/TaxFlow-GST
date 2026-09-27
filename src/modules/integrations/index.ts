/**
 * ERP & External Integrations Module
 */
import { TenantContext } from '../../core/tenancy/types';
import { integrationRepository } from '../../infrastructure/database/repositories';
import { AuthorizationPipeline } from '../../infrastructure/security/idorProtection';
import { Feature } from '../../core/entitlements/types';
import { Permission } from '../../core/permissions/types';

export class IntegrationsModule {
  public static listIntegrations(ctx: TenantContext) {
    return AuthorizationPipeline.execute(
      {
        ctx,
        requiredFeature: Feature.ERP_INTEGRATION,
        requiredPermission: Permission.INTEGRATION_VIEW
      },
      () => integrationRepository.findMany(ctx)
    );
  }
}
