/**
 * Statutory Export Module
 */
import { TenantContext } from '../../core/tenancy/types';
import { AuthorizationPipeline } from '../../infrastructure/security/idorProtection';
import { Permission } from '../../core/permissions/types';

export class ExportsModule {
  public static exportAuditDossier(ctx: TenantContext, period: string) {
    return AuthorizationPipeline.execute(
      {
        ctx,
        requiredPermission: Permission.REPORT_EXPORT,
        auditAction: 'EXPORT_AUDIT_DOSSIER',
        auditModule: 'Exports'
      },
      () => {
        return {
          downloadUrl: `/tenants/${ctx.tenantId}/exports/dossier-${period}.zip`,
          generatedAt: new Date().toISOString()
        };
      }
    );
  }
}
