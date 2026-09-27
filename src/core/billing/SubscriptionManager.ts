/**
 * SubscriptionManager Service
 * Links user account roles and active billing plans to restricted access levels.
 * Selectively governs UI module visibility, feature authorization, and advanced analytics vs. basic filing gating.
 */

import { UserRole } from '../../../types';
import { Feature, PlanCode, Plan, TenantSubscription, PLANS_CATALOG } from '../entitlements/types';
import { entitlementService } from '../entitlements/entitlementService';
import { globalModuleRegistry } from '../entitlements/globalModuleRegistry';
import { Role, Permission, roleHasPermission, getPermissionsForRole } from '../permissions/types';
import { useState, useEffect } from 'react';

/**
 * High-level Tiered Access Levels linking Billing Plans & User Roles
 */
export enum AccessLevel {
  /** Viewer or read-only accounts across enabled plan features */
  RESTRICTED_VIEWER = 'RESTRICTED_VIEWER',
  /** Starter SME: Basic Invoicing, purchases, standard GSTR filing, single-entity */
  BASIC_OPERATIONAL = 'BASIC_OPERATIONAL',
  /** Business Growth: E-Way bills, 2B vs Purchase Auto-Reconciliation, up to 3 entities */
  STANDARD_COMPLIANCE = 'STANDARD_COMPLIANCE',
  /** Professional: E-Invoicing IRN/QR, ITC Optimizer, Multi-State GSTINs, Automation */
  ADVANCED_TAX_ENGINE = 'ADVANCED_TAX_ENGINE',
  /** Enterprise: Predictive Tax Analytics, AI Copilot, ERP Integrations, Conglomerate rollups, Granular RBAC */
  ENTERPRISE_ANALYTICS = 'ENTERPRISE_ANALYTICS',
  /** Super Admin: Unrestricted platform-wide administrative bypass */
  SUPER_ADMIN_UNRESTRICTED = 'SUPER_ADMIN_UNRESTRICTED'
}

/**
 * Access metadata detailing module gating and upgrade requirements
 */
export interface ModuleAccessCheck {
  granted: boolean;
  reason?: string;
  requiredPlan?: PlanCode;
  requiredRole?: UserRole[];
  requiredFeature?: Feature;
  isUpgradeRequired?: boolean;
}

/**
 * Comprehensive Subscription & Access profile for a user context
 */
export interface UserSubscriptionProfile {
  userRole: UserRole;
  tenantId: string;
  planCode: PlanCode;
  planName: string;
  accessLevel: AccessLevel;
  isSuperAdmin: boolean;
  isReadOnly: boolean;
  
  // Specific Module Access Flags
  canBasicFiling: boolean;
  canAdvancedAnalytics: boolean;
  canReconciliation: boolean;
  canEInvoicing: boolean;
  canEWayBill: boolean;
  canItcOptimization: boolean;
  canAiInsights: boolean;
  canErpIntegrations: boolean;
  canGroupConsolidation: boolean;
  canMultiGstin: boolean;
  canMultiBranch: boolean;
  canAuditLogs: boolean;
  canAdvancedRbac: boolean;
  canCloudBackups: boolean;
  canWhatsappAlerts: boolean;
  canDatabaseSync: boolean;
  canManageUsers: boolean;
  canManageOrganization: boolean;

  // Limits
  maxCompanies: number;
  maxGstins: number;
  maxBranches: number;
  monthlyInvoiceVolume: number;
}

export class SubscriptionManagerService {
  /**
   * Determine the effective AccessLevel based on User Account Type + Active Billing Plan
   */
  public getEffectiveAccessLevel(
    role: UserRole = UserRole.VIEWER,
    tenantId: string = 't1'
  ): AccessLevel {
    if (role === UserRole.SUPER_ADMIN) {
      return AccessLevel.SUPER_ADMIN_UNRESTRICTED;
    }

    if (role === UserRole.VIEWER || role === UserRole.AUDITOR || role === UserRole.CUSTOMER) {
      return AccessLevel.RESTRICTED_VIEWER;
    }

    const sub = entitlementService.getSubscription(tenantId);
    const planId = sub?.planId || PlanCode.STARTER;

    switch (planId) {
      case PlanCode.ENTERPRISE:
      case PlanCode.ENTERPRISE_PLUS:
        return AccessLevel.ENTERPRISE_ANALYTICS;
      case PlanCode.PROFESSIONAL:
        return AccessLevel.ADVANCED_TAX_ENGINE;
      case PlanCode.BUSINESS:
        return AccessLevel.STANDARD_COMPLIANCE;
      case PlanCode.STARTER:
      default:
        return AccessLevel.BASIC_OPERATIONAL;
    }
  }

  /**
   * Check if a specific module/feature is accessible given the user role and active tenant subscription
   */
  public checkModuleAccess(
    role: UserRole = UserRole.VIEWER,
    tenantId: string = 't1',
    feature?: Feature,
    allowedRoles?: UserRole[]
  ): ModuleAccessCheck {
    // 1. Super Admin bypasses all checks
    if (role === UserRole.SUPER_ADMIN) {
      return { granted: true };
    }

    // 2. Verify Role Permissions if role whitelist is provided
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      return {
        granted: false,
        reason: `Your user role (${role}) does not have permission to access this module.`,
        requiredRole: allowedRoles,
        isUpgradeRequired: false
      };
    }

    // 3. If no specific feature flag is associated with the module, access is granted (e.g. basic dashboard)
    if (!feature) {
      return { granted: true };
    }

    // 4. Global Kill-Switch Check
    if (!globalModuleRegistry.isFeatureGloballyAvailable(feature)) {
      return {
        granted: false,
        reason: 'This module is temporarily undergoing maintenance or is globally disabled.',
        isUpgradeRequired: false
      };
    }

    // 5. Subscription Plan Feature Entitlement Check
    const hasEntitlement = entitlementService.hasFeature(tenantId, feature);
    if (!hasEntitlement) {
      const globalModule = globalModuleRegistry.getModule(feature);
      const minPlan = globalModule?.minPlanTier || PlanCode.PROFESSIONAL;
      const sub = entitlementService.getSubscription(tenantId);
      const currentPlan = sub?.planId || PlanCode.STARTER;

      return {
        granted: false,
        reason: `Feature '${feature}' requires ${minPlan} plan (Current: ${currentPlan}). Upgrade to unlock.`,
        requiredPlan: minPlan,
        requiredFeature: feature,
        isUpgradeRequired: true
      };
    }

    return { granted: true };
  }

  /**
   * Check whether Advanced Predictive Analytics & Risk Forecasting is enabled
   * Requires ENTERPRISE or PROFESSIONAL plan (or explicit AI feature entitlement) and an analytical role.
   */
  public hasAdvancedAnalytics(
    role: UserRole = UserRole.VIEWER,
    tenantId: string = 't1'
  ): boolean {
    if (role === UserRole.SUPER_ADMIN) return true;

    // Advanced analytics requires AI or high-tier financial intelligence access
    const hasAiEntitlement = entitlementService.hasFeature(tenantId, Feature.AI);
    const sub = entitlementService.getSubscription(tenantId);
    const isHighTier = sub?.planId === PlanCode.ENTERPRISE || sub?.planId === PlanCode.PROFESSIONAL;

    return hasAiEntitlement || isHighTier;
  }

  /**
   * Check whether Basic GST Returns Filing is enabled
   * Available on all active plans including Starter SME
   */
  public hasBasicFiling(
    role: UserRole = UserRole.VIEWER,
    tenantId: string = 't1'
  ): boolean {
    if (role === UserRole.SUPER_ADMIN) return true;
    return entitlementService.hasFeature(tenantId, Feature.GST_RETURNS) || entitlementService.hasFeature(tenantId, Feature.INVOICES);
  }

  /**
   * Check whether Multi-Entity Group Level Consolidation is enabled
   * Restricted on Starter SME (single company), available on Business/Enterprise
   */
  public hasGroupConsolidation(
    role: UserRole = UserRole.VIEWER,
    tenantId: string = 't1'
  ): boolean {
    if (role === UserRole.SUPER_ADMIN) return true;
    const limits = entitlementService.getPlanLimits(tenantId);
    const maxCompanies = limits.maxCompanies || 1;
    const sub = entitlementService.getSubscription(tenantId);
    return maxCompanies > 1 && sub?.planId !== PlanCode.STARTER;
  }

  /**
   * Check whether 2B vs Purchase Auto-Reconciliation is enabled
   */
  public hasReconciliation(
    role: UserRole = UserRole.VIEWER,
    tenantId: string = 't1'
  ): boolean {
    if (role === UserRole.SUPER_ADMIN) return true;
    return entitlementService.hasFeature(tenantId, Feature.RECONCILIATION);
  }

  /**
   * Get complete user subscription & access profile
   */
  public getUserSubscriptionProfile(
    role: UserRole = UserRole.VIEWER,
    tenantId: string = 't1'
  ): UserSubscriptionProfile {
    const isSuperAdmin = role === UserRole.SUPER_ADMIN;
    const isReadOnly = role === UserRole.VIEWER || role === UserRole.AUDITOR;

    const sub = entitlementService.getSubscription(tenantId);
    const planCode = sub?.planId || PlanCode.STARTER;
    const plan = entitlementService.getPlan(planCode) || PLANS_CATALOG[planCode] || PLANS_CATALOG[PlanCode.STARTER];
    const limits = sub?.limits || plan.limits;

    const accessLevel = this.getEffectiveAccessLevel(role, tenantId);

    return {
      userRole: role,
      tenantId,
      planCode,
      planName: sub?.customPlanName || plan.name,
      accessLevel,
      isSuperAdmin,
      isReadOnly,

      canBasicFiling: isSuperAdmin || this.hasBasicFiling(role, tenantId),
      canAdvancedAnalytics: isSuperAdmin || this.hasAdvancedAnalytics(role, tenantId),
      canReconciliation: isSuperAdmin || entitlementService.hasFeature(tenantId, Feature.RECONCILIATION),
      canEInvoicing: isSuperAdmin || entitlementService.hasFeature(tenantId, Feature.E_INVOICE),
      canEWayBill: isSuperAdmin || entitlementService.hasFeature(tenantId, Feature.E_WAY_BILL),
      canItcOptimization: isSuperAdmin || entitlementService.hasFeature(tenantId, Feature.ITC),
      canAiInsights: isSuperAdmin || entitlementService.hasFeature(tenantId, Feature.AI),
      canErpIntegrations: isSuperAdmin || entitlementService.hasFeature(tenantId, Feature.ERP_INTEGRATION),
      canGroupConsolidation: isSuperAdmin || this.hasGroupConsolidation(role, tenantId),
      canMultiGstin: isSuperAdmin || (limits.maxGstins > 1 && entitlementService.hasFeature(tenantId, Feature.MULTI_GSTIN)),
      canMultiBranch: isSuperAdmin || (limits.maxBranches > 1 && entitlementService.hasFeature(tenantId, Feature.MULTI_BRANCH)),
      canAuditLogs: isSuperAdmin || (sub?.planId !== PlanCode.STARTER && entitlementService.hasFeature(tenantId, Feature.AUDIT_LOGS)),
      canAdvancedRbac: isSuperAdmin || entitlementService.hasFeature(tenantId, Feature.ADVANCED_RBAC),
      canCloudBackups: isSuperAdmin || entitlementService.hasFeature(tenantId, Feature.CLOUD_BACKUPS),
      canWhatsappAlerts: isSuperAdmin || entitlementService.hasFeature(tenantId, Feature.WHATSAPP_ALERTS),
      canDatabaseSync: isSuperAdmin || (sub?.planId === PlanCode.ENTERPRISE || sub?.planId === PlanCode.ENTERPRISE_PLUS || entitlementService.hasFeature(tenantId, Feature.DATABASE_SYNC)),
      canManageUsers: isSuperAdmin,
      canManageOrganization: isSuperAdmin || role === UserRole.ADMIN,

      maxCompanies: isSuperAdmin ? 999 : (limits.maxCompanies || 1),
      maxGstins: isSuperAdmin ? 999 : (limits.maxGstins || 1),
      maxBranches: isSuperAdmin ? 999 : (limits.maxBranches || 1),
      monthlyInvoiceVolume: isSuperAdmin ? 1000000 : (limits.monthlyInvoiceVolume || 500)
    };
  }

  /**
   * Filter an array of navigation items based on User Role + Active Billing Plan
   */
  public filterNavigationItems<T extends { roles?: UserRole[]; feature?: Feature; path: string }>(
    items: T[],
    role: UserRole = UserRole.VIEWER,
    tenantId: string = 't1'
  ): T[] {
    if (role === UserRole.SUPER_ADMIN) {
      return items;
    }

    return items.filter(item => {
      // 1. Check role permission
      if (item.roles && !item.roles.includes(role)) {
        return false;
      }

      // 2. Check feature plan entitlement
      if (item.feature && !entitlementService.hasFeature(tenantId, item.feature)) {
        return false;
      }

      return true;
    });
  }
}

export const subscriptionManager = new SubscriptionManagerService();

/**
 * React Hook for dynamic subscription & restricted access level resolution
 */
export function useSubscriptionAccess(role: UserRole = UserRole.VIEWER, tenantId: string = 't1'): UserSubscriptionProfile {
  const [profile, setProfile] = useState<UserSubscriptionProfile>(() =>
    subscriptionManager.getUserSubscriptionProfile(role, tenantId)
  );

  useEffect(() => {
    const updateProfile = () => {
      setProfile(subscriptionManager.getUserSubscriptionProfile(role, tenantId));
    };

    updateProfile();

    if (typeof window !== 'undefined') {
      window.addEventListener('taxflow:subscription_updated', updateProfile);
      return () => {
        window.removeEventListener('taxflow:subscription_updated', updateProfile);
      };
    }
  }, [role, tenantId]);

  return profile;
}
