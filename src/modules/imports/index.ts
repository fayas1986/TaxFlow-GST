/**
 * Bulk Data Import Module
 */
import { TenantContext } from '../../core/tenancy/types';
import { AuthorizationPipeline } from '../../infrastructure/security/idorProtection';
import { Permission } from '../../core/permissions/types';
import { invoiceRepository } from '../../infrastructure/database/repositories';

export class ImportsModule {
  public static bulkImportInvoices(ctx: TenantContext, records: any[]) {
    return AuthorizationPipeline.execute(
      {
        ctx,
        requiredPermission: Permission.INVOICE_WRITE,
        auditAction: 'BULK_IMPORT_INVOICES',
        auditModule: 'Imports'
      },
      () => {
        let count = 0;
        for (const item of records) {
          invoiceRepository.create(ctx, item);
          count++;
        }
        return { importedCount: count, tenantId: ctx.tenantId };
      }
    );
  }
}
