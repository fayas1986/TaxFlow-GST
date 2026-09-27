/**
 * Multi-GSTIN Management Module
 */
import { TenantContext } from '../../core/tenancy/types';
import { tenantService } from '../../core/tenancy/tenantService';

export class GstinModule {
  public static listGstins(ctx: TenantContext) {
    const all = tenantService.getTenantGstins(ctx.tenantId);
    if (ctx.assignedGstinIds && ctx.assignedGstinIds !== 'ALL') {
      return all.filter(g => ctx.assignedGstinIds!.includes(g.id) || ctx.assignedGstinIds!.includes(g.gstin));
    }
    return all;
  }
}
