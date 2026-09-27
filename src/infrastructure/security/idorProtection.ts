/**
 * Enterprise Multi-Tenant Authorization Pipeline & IDOR Protection Framework
 * Strictly enforces the 7-stage authorization and tenancy lifecycle check:
 * 
 * 1. Authentication Check
 * 2. Tenant Membership Verification
 * 3. Role Resolution
 * 4. Permission Check (with read-only enforcement)
 * 5. Plan Entitlement (Feature Flagging)
 * 6. Usage Limit Check (Metering)
 * 7. Business Operation Execution
 */

import { TenantContext } from '../../core/tenancy/types';
import { Permission, roleHasPermission } from '../../core/permissions/types';
import { Feature } from '../../core/entitlements/types';
import { UsageMetric } from '../../core/usage/types';
import { entitlementService } from '../../core/entitlements/entitlementService';
import { usageService } from '../../core/usage/usageService';
import { auditService } from '../../core/audit/auditService';

export interface AuthorizeOptions {
  ctx: TenantContext;
  requiredPermission?: Permission;
  requiredFeature?: Feature;
  usageMetricToConsume?: {
    metric: UsageMetric;
    amount?: number;
  };
  resourceOwnerTenantId?: string;
  targetBranchId?: string;
  auditAction?: string;
  auditModule?: string;
}

export class AuthorizationPipeline {
  /**
   * Execute full 7-stage authorization pipeline
   */
  public static execute<T>(
    options: AuthorizeOptions,
    businessOperation: () => T
  ): T {
    const {
      ctx,
      requiredPermission,
      requiredFeature,
      usageMetricToConsume,
      resourceOwnerTenantId,
      targetBranchId,
      auditAction,
      auditModule
    } = options;

    // Stage 1: Authentication Check
    if (!ctx.userId) {
      throw new Error('401 Unauthorized: Valid user session required');
    }

    // Stage 2: Tenant Membership & IDOR Check
    if (!ctx.tenantId) {
      throw new Error('400 Bad Request: Active tenant context required');
    }

    if (resourceOwnerTenantId && resourceOwnerTenantId !== ctx.tenantId) {
      throw new Error(
        `403 Forbidden [IDOR Blocked]: Resource belongs to tenant '${resourceOwnerTenantId}', but session is active for tenant '${ctx.tenantId}'. Access denied.`
      );
    }

    // Branch-level Isolation Check
    if (targetBranchId && ctx.assignedBranchIds && ctx.assignedBranchIds !== 'ALL') {
      if (!ctx.assignedBranchIds.includes(targetBranchId)) {
        throw new Error(
          `403 Forbidden: User not authorized for branch '${targetBranchId}'. Allowed branches: ${ctx.assignedBranchIds.join(', ')}`
        );
      }
    }

    // Stage 3 & 4: Role & Permission Check (with read-only guard)
    if (requiredPermission) {
      const allowed = roleHasPermission(ctx.role, requiredPermission, ctx.isReadOnly);
      if (!allowed) {
        if (ctx.isReadOnly) {
          throw new Error(`403 Forbidden: User is in read-only mode and cannot perform mutating action '${requiredPermission}'`);
        }
        throw new Error(`403 Forbidden: Role '${ctx.role}' lacks required permission '${requiredPermission}'`);
      }
    }

    // Stage 5: Plan Entitlement (Feature Flagging)
    if (requiredFeature) {
      const isFeatureEnabled = entitlementService.hasFeature(ctx.tenantId, requiredFeature);
      if (!isFeatureEnabled) {
        throw new Error(
          `403 Forbidden [Plan Entitlement]: Feature '${requiredFeature}' is not included in tenant's current plan (${ctx.plan}). Upgrade plan to access this module.`
        );
      }
    }

    // Stage 6: Usage Limit Check (Metering)
    if (usageMetricToConsume) {
      const delta = usageMetricToConsume.amount || 1;
      const usageCheck = usageService.checkUsage(ctx.tenantId, usageMetricToConsume.metric, delta);
      if (!usageCheck.allowed) {
        throw new Error(
          `429 Too Many Requests [Quota Exceeded]: ${usageCheck.reason}`
        );
      }
    }

    // Stage 7: Business Operation Execution
    const result = businessOperation();

    // Consume usage post-success
    if (usageMetricToConsume) {
      usageService.recordUsage(ctx.tenantId, usageMetricToConsume.metric, usageMetricToConsume.amount || 1);
    }

    // Record audit event if requested
    if (auditAction && auditModule) {
      auditService.logEvent(ctx, {
        action: auditAction,
        module: auditModule,
        resourceType: 'ENTITY',
        resourceId: 'OP_SUCCESS'
      });
    }

    return result;
  }
}
