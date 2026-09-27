/**
 * E-Way Bill Generation Module
 */
import { TenantContext } from '../../core/tenancy/types';
import { AuthorizationPipeline } from '../../infrastructure/security/idorProtection';
import { Feature } from '../../core/entitlements/types';
import { Permission } from '../../core/permissions/types';

export class EWayBillModule {
  public static generateEWayBill(ctx: TenantContext, params: { invoiceId: string; vehicleNo: string; distanceKm: number }) {
    return AuthorizationPipeline.execute(
      {
        ctx,
        requiredFeature: Feature.E_WAY_BILL,
        requiredPermission: Permission.EWAYBILL_GENERATE,
        auditAction: 'EWAYBILL_GENERATE',
        auditModule: 'E-WayBill'
      },
      () => {
        return {
          ewayBillNo: `EWB-${ctx.tenantId.toUpperCase()}-${Date.now().toString().slice(-8)}`,
          vehicleNo: params.vehicleNo,
          validUpto: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
          status: 'ACTIVE'
        };
      }
    );
  }
}
