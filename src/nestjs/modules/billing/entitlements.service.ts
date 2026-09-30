import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { Feature, PlanCode, DEFAULT_PLANS_CATALOG, PlanLimits } from '../../../core/entitlements/types';
import { UsageMetric } from '../../../core/usage/types';
import { SubscriptionStatus } from '@prisma/client';

export type LimitStatus = 'ALLOWED' | 'SOFT_WARNING' | 'HARD_LIMIT_EXCEEDED' | 'FEATURE_DISABLED';

export interface LimitCheckResult {
  allowed: boolean;
  status: LimitStatus;
  current: number;
  limit: number;
  remaining: number;
  requestedDelta: number;
  reason?: string;
}

@Injectable()
export class EntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Single authoritative feature access check.
   */
  async checkFeatureAccess(tenantId: string, feature: Feature): Promise<{ allowed: boolean; reason?: string }> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    // Default to STARTER if no explicit subscription
    const planCode = (subscription?.planCode as PlanCode) || PlanCode.STARTER;
    const status = subscription?.status || SubscriptionStatus.TRIAL;

    if (status === SubscriptionStatus.SUSPENDED || status === SubscriptionStatus.EXPIRED || status === SubscriptionStatus.CANCELLED) {
      return {
        allowed: false,
        reason: `Subscription is in terminal state: ${status}. Please renew your subscription to access features.`,
      };
    }

    const catalogPlan = DEFAULT_PLANS_CATALOG[planCode] || DEFAULT_PLANS_CATALOG[PlanCode.STARTER];
    const isFeatureInPlan = catalogPlan.features.includes(feature);

    // Check custom feature overrides if present
    const customFeatures = (subscription?.customFeatures as any) || {};
    if (customFeatures.disabledFeatures?.includes(feature)) {
      return { allowed: false, reason: `Feature ${feature} is explicitly disabled for this tenant.` };
    }
    if (customFeatures.enabledFeatures?.includes(feature)) {
      return { allowed: true };
    }

    if (!isFeatureInPlan) {
      return {
        allowed: false,
        reason: `Feature '${feature}' is not included in your ${catalogPlan.name} plan. Please upgrade your plan.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Single authoritative usage limit check.
   */
  async checkUsageLimit(tenantId: string, metric: UsageMetric, delta: number = 1): Promise<LimitCheckResult> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const planCode = (subscription?.planCode as PlanCode) || PlanCode.STARTER;
    const status = subscription?.status || SubscriptionStatus.TRIAL;

    if (status === SubscriptionStatus.SUSPENDED || status === SubscriptionStatus.EXPIRED) {
      return {
        allowed: false,
        status: 'FEATURE_DISABLED',
        current: 0,
        limit: 0,
        remaining: 0,
        requestedDelta: delta,
        reason: `Subscription is ${status}. Access restricted.`,
      };
    }

    const catalogPlan = DEFAULT_PLANS_CATALOG[planCode] || DEFAULT_PLANS_CATALOG[PlanCode.STARTER];
    const limits: PlanLimits = { ...catalogPlan.limits, ...((subscription?.customLimits as any) || {}) };

    const limitValue = this.getLimitForMetric(metric, limits);

    // Fetch current usage count
    const now = new Date();
    const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const usageRecord = await this.prisma.usageCounterRecord.findUnique({
      where: {
        tenantId_periodKey_metric: {
          tenantId,
          periodKey,
          metric: String(metric),
        },
      },
    });

    const current = usageRecord ? Number(usageRecord.currentValue) : 0;
    const isUnlimited = limitValue >= 99999;

    if (isUnlimited) {
      return {
        allowed: true,
        status: 'ALLOWED',
        current,
        limit: limitValue,
        remaining: 999999,
        requestedDelta: delta,
      };
    }

    const remaining = Math.max(0, limitValue - current);
    const projected = current + delta;

    if (projected > limitValue) {
      return {
        allowed: false,
        status: 'HARD_LIMIT_EXCEEDED',
        current,
        limit: limitValue,
        remaining,
        requestedDelta: delta,
        reason: `Quota exceeded for ${metric}. Used ${current}/${limitValue}, requested +${delta}. Upgrade your plan for higher quota.`,
      };
    }

    const usageRatio = projected / limitValue;
    const isWarning = usageRatio >= 0.8;

    return {
      allowed: true,
      status: isWarning ? 'SOFT_WARNING' : 'ALLOWED',
      current,
      limit: limitValue,
      remaining: limitValue - projected,
      requestedDelta: delta,
      reason: isWarning ? `Warning: ${metric} usage has reached ${(usageRatio * 100).toFixed(0)}% of quota limit.` : undefined,
    };
  }

  /**
   * Enforce Hard Limit: Throws ForbiddenException if feature or limit check fails.
   */
  async enforceHardLimit(tenantId: string, feature: Feature, metric?: UsageMetric, delta: number = 1) {
    const featCheck = await this.checkFeatureAccess(tenantId, feature);
    if (!featCheck.allowed) {
      throw new ForbiddenException(featCheck.reason || `Access denied to feature ${feature}`);
    }

    if (metric) {
      const limitCheck = await this.checkUsageLimit(tenantId, metric, delta);
      if (!limitCheck.allowed) {
        throw new ForbiddenException(limitCheck.reason || `Quota limit exceeded for metric ${metric}`);
      }
    }
  }

  private getLimitForMetric(metric: UsageMetric, limits: PlanLimits): number {
    switch (metric) {
      case UsageMetric.INVOICE_DOCUMENTS:
        return limits.monthlyInvoiceVolume;
      case UsageMetric.E_INVOICE_DOCUMENTS:
        return limits.monthlyEinvoiceVolume;
      case UsageMetric.EWAY_BILLS:
        return limits.monthlyEwayBills;
      case UsageMetric.RECONCILIATION_DOCUMENTS:
        return limits.monthlyReconciliationDocuments;
      case UsageMetric.AI_REQUESTS:
        return limits.monthlyAiRequests;
      case UsageMetric.API_CALLS:
        return limits.monthlyApiCalls;
      case UsageMetric.USERS:
        return limits.maxUsers;
      case UsageMetric.GSTINS:
        return limits.maxGstins;
      case UsageMetric.BRANCHES:
        return limits.maxBranches;
      case UsageMetric.STORAGE_BYTES:
        return limits.storageMb * 1024 * 1024;
      default:
        return 1000;
    }
  }
}
