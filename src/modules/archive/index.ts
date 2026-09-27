/**
 * Statutory 7-Year Ledger Archive Module
 */
import { TenantContext } from '../../core/tenancy/types';
import { AuthorizationPipeline } from '../../infrastructure/security/idorProtection';
import { Permission } from '../../core/permissions/types';

export class ArchiveModule {
  public static getArchiveTimeline(ctx: TenantContext) {
    return AuthorizationPipeline.execute(
      {
        ctx,
        requiredPermission: Permission.AUDIT_VIEW
      },
      () => {
        return {
          tenantId: ctx.tenantId,
          statutoryRetentionYears: 7,
          oldestArchivedPeriod: '2019-07',
          immutableEntriesCount: 14200,
          hashChainStatus: 'VALID'
        };
      }
    );
  }
}
