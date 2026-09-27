/**
 * E-Invoice IRN Generation Module
 * Integrates with ComplianceGatewayRouter and AuthorizationPipeline for multi-tenant protection.
 */
import { TenantContext } from '../../core/tenancy/types';
import { AuthorizationPipeline } from '../../infrastructure/security/idorProtection';
import { Feature } from '../../core/entitlements/types';
import { Permission } from '../../core/permissions/types';
import { UsageMetric } from '../../core/usage/types';
import { ComplianceGatewayRouter } from '../../../services/gsp/adapter';
import { Invoice } from '../../../types';

export class EInvoiceModule {
  public static async generateIrn(ctx: TenantContext, invoice: Invoice) {
    return AuthorizationPipeline.execute(
      {
        ctx,
        requiredFeature: Feature.E_INVOICE,
        requiredPermission: Permission.EINVOICE_GENERATE,
        usageMetricToConsume: { metric: UsageMetric.E_INVOICE_DOCUMENTS, amount: 1 },
        auditAction: 'EINVOICE_GENERATE',
        auditModule: 'E-Invoice',
      },
      async () => {
        const provider = ComplianceGatewayRouter.getProvider();
        const irnResult = await provider.generateIRN(invoice);

        if (!irnResult.success) {
          throw new Error(irnResult.error || 'Failed to generate IRN via Compliance Gateway');
        }

        return {
          invoiceId: invoice.id,
          irn: irnResult.irn,
          ackNo: irnResult.ackNo,
          ackDate: irnResult.ackDate,
          qrCodeData: irnResult.qrCodeUrl,
          status: 'ACT',
        };
      }
    );
  }

  public static async cancelIrn(ctx: TenantContext, irn: string, reason: string, remarks: string) {
    return AuthorizationPipeline.execute(
      {
        ctx,
        requiredFeature: Feature.E_INVOICE,
        requiredPermission: Permission.EINVOICE_CANCEL,
        auditAction: 'EINVOICE_CANCEL',
        auditModule: 'E-Invoice',
      },
      async () => {
        const provider = ComplianceGatewayRouter.getProvider();
        const success = await provider.cancelIRN(irn, reason, remarks);

        if (!success) {
          throw new Error('Failed to cancel IRN via Compliance Gateway');
        }

        return { irn, status: 'CANCELLED', cancelledAt: new Date().toISOString() };
      }
    );
  }
}
