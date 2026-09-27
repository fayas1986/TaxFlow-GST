/**
 * Branch Management Module
 */
import { TenantContext } from '../../core/tenancy/types';
import { tenantService } from '../../core/tenancy/tenantService';

export class BranchesModule {
  public static listBranches(ctx: TenantContext) {
    const all = tenantService.getTenantBranches(ctx.tenantId);
    if (ctx.assignedBranchIds && ctx.assignedBranchIds !== 'ALL') {
      return all.filter(b => ctx.assignedBranchIds!.includes(b.id) || ctx.assignedBranchIds!.includes(b.branchCode));
    }
    return all;
  }
}
