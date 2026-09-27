/**
 * Tenant Organisation Module
 */
import { TenantContext, CreateTenantParams } from '../../core/tenancy/types';
import { tenantService } from '../../core/tenancy/tenantService';
import { entitlementService } from '../../core/entitlements/entitlementService';
import { PLANS_CATALOG, PlanCode } from '../../core/entitlements/types';

export class OrganisationModule {
  public static getOrganisationProfile(ctx: TenantContext) {
    const tenant = tenantService.getTenant(ctx.tenantId);
    if (!tenant) throw new Error(`Organisation not found for tenant: ${ctx.tenantId}`);
    return tenant;
  }

  public static getOrganisationSubscription(ctx: TenantContext) {
    return entitlementService.getSubscription(ctx.tenantId);
  }

  public static getOrganisationEntitlements(ctx: TenantContext) {
    return entitlementService.getEntitlements(ctx.tenantId);
  }

  public static createTenantOrganisation(params: CreateTenantParams) {
    return tenantService.createTenant(params);
  }

  public static listUserOrganisations(userId: string) {
    return tenantService.getUserTenants(userId);
  }

  public static switchOrganisation(userId: string, targetTenantId: string, userEmail?: string) {
    return tenantService.switchTenant(userId, targetTenantId, userEmail);
  }

  public static getPlansCatalog() {
    return PLANS_CATALOG;
  }
}
