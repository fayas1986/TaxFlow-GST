/**
 * E-Invoice IRN Generation Module
 */
import { TenantContext } from '../../core/tenancy/types';
import { AuthorizationPipeline } from '../../infrastructure/security/idorProtection';
import { Feature } from '../../core/entitlements/types';
import { Permission } from '../../core/permissions/types';
import { UsageMetric } from '../../core/usage/types';

export class EInvoiceModule {
  public static generateIrn(ctx: TenantContext, invoiceId: string) {
    return AuthorizationPipeline.execute(
      {
        ctx,
        requiredFeature: Feature.E_INVOICE,
        requiredPermission: Permission.EINVOICE_GENERATE,
        usageMetricToConsume: { metric: UsageMetric.E_INVOICE_DOCUMENTS, amount: 1 },
        auditAction: 'EINVOICE_GENERATE',
        auditModule: 'E-Invoice'
      },
      () => {
        return {
          invoiceId,
          irn: `irn-${ctx.tenantId}-${Date.now()}`,
          ackNo: `ack-${Date.now()}`,
          qrCodeData: `https://einvoice.taxflow.in/qr/${ctx.tenantId}/${invoiceId}`,
          status: 'ACT'
        };
      }
    );
  }
}
