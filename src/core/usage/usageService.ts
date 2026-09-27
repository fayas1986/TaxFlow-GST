/**
 * Central Usage Tracking & Quota Enforcement Service
 * Separates feature access from usage limits.
 */

import { UsageMetric, TenantUsage, UsageCheckResult, MetricUsage } from './types';
import { entitlementService } from '../entitlements/entitlementService';

class UsageService {
  // tenantId -> current period usage
  private usageStore: Map<string, Record<UsageMetric, number>> = new Map();

  constructor() {
    this.seedDefaultUsage();
  }

  private seedDefaultUsage() {
    // Tenant 1 (Enterprise): Generous headroom
    this.usageStore.set('t1', {
      [UsageMetric.INVOICE_DOCUMENTS]: 1420,
      [UsageMetric.E_INVOICE_DOCUMENTS]: 890,
      [UsageMetric.EWAY_BILLS]: 410,
      [UsageMetric.RECONCILIATION_DOCUMENTS]: 3420,
      [UsageMetric.AI_REQUESTS]: 112,
      [UsageMetric.API_CALLS]: 4210,
      [UsageMetric.USERS]: 8,
      [UsageMetric.GSTINS]: 3,
      [UsageMetric.BRANCHES]: 6,
      [UsageMetric.STORAGE_BYTES]: 1024 * 1024 * 450 // 450 MB
    });

    // Tenant 2 (Professional): Normal usage
    this.usageStore.set('t2', {
      [UsageMetric.INVOICE_DOCUMENTS]: 820,
      [UsageMetric.E_INVOICE_DOCUMENTS]: 410,
      [UsageMetric.EWAY_BILLS]: 260,
      [UsageMetric.RECONCILIATION_DOCUMENTS]: 1940,
      [UsageMetric.AI_REQUESTS]: 45,
      [UsageMetric.API_CALLS]: 1250,
      [UsageMetric.USERS]: 4,
      [UsageMetric.GSTINS]: 2,
      [UsageMetric.BRANCHES]: 3,
      [UsageMetric.STORAGE_BYTES]: 1024 * 1024 * 180
    });

    // Tenant 3 (Business Growth): High usage near reconciliation limit (2500 max)
    this.usageStore.set('t3', {
      [UsageMetric.INVOICE_DOCUMENTS]: 2480,
      [UsageMetric.E_INVOICE_DOCUMENTS]: 495,
      [UsageMetric.EWAY_BILLS]: 980,
      [UsageMetric.RECONCILIATION_DOCUMENTS]: 2495, // Near 2500 limit
      [UsageMetric.AI_REQUESTS]: 95,
      [UsageMetric.API_CALLS]: 980,
      [UsageMetric.USERS]: 5,
      [UsageMetric.GSTINS]: 2,
      [UsageMetric.BRANCHES]: 4,
      [UsageMetric.STORAGE_BYTES]: 1024 * 1024 * 900
    });

    // Tenant 4 (Starter SME): Low or exhausted quota
    this.usageStore.set('t4', {
      [UsageMetric.INVOICE_DOCUMENTS]: 500, // At limit
      [UsageMetric.E_INVOICE_DOCUMENTS]: 0,
      [UsageMetric.EWAY_BILLS]: 0,
      [UsageMetric.RECONCILIATION_DOCUMENTS]: 0,
      [UsageMetric.AI_REQUESTS]: 20, // At limit
      [UsageMetric.API_CALLS]: 0,
      [UsageMetric.USERS]: 2,
      [UsageMetric.GSTINS]: 1,
      [UsageMetric.BRANCHES]: 1,
      [UsageMetric.STORAGE_BYTES]: 1024 * 1024 * 100
    });
  }

  private getLimitForMetric(tenantId: string, metric: UsageMetric): number {
    const limits = entitlementService.getPlanLimits(tenantId);
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
        return 0;
    }
  }

  private getTenantMetricStore(tenantId: string): Record<UsageMetric, number> {
    let store = this.usageStore.get(tenantId);
    if (!store) {
      store = {
        [UsageMetric.INVOICE_DOCUMENTS]: 0,
        [UsageMetric.E_INVOICE_DOCUMENTS]: 0,
        [UsageMetric.EWAY_BILLS]: 0,
        [UsageMetric.RECONCILIATION_DOCUMENTS]: 0,
        [UsageMetric.AI_REQUESTS]: 0,
        [UsageMetric.API_CALLS]: 0,
        [UsageMetric.USERS]: 0,
        [UsageMetric.GSTINS]: 0,
        [UsageMetric.BRANCHES]: 0,
        [UsageMetric.STORAGE_BYTES]: 0
      };
      this.usageStore.set(tenantId, store);
    }
    return store;
  }

  /**
   * Check whether tenant has sufficient quota remaining for the metric
   */
  public checkUsage(tenantId: string, metric: UsageMetric, requestedDelta = 1): UsageCheckResult {
    const tenantMetrics = this.getTenantMetricStore(tenantId);

    const current = tenantMetrics[metric] || 0;
    const limit = this.getLimitForMetric(tenantId, metric);
    const projected = current + requestedDelta;
    const remaining = Math.max(0, limit - current);

    if (projected > limit) {
      return {
        allowed: false,
        metric,
        current,
        limit,
        remaining,
        requestedDelta,
        reason: `Monthly quota exceeded for ${metric}. Plan limit: ${limit.toLocaleString()}, Current: ${current.toLocaleString()}, Requested: +${requestedDelta.toLocaleString()}`
      };
    }

    return {
      allowed: true,
      metric,
      current,
      limit,
      remaining,
      requestedDelta
    };
  }

  /**
   * Strict enforcement: Throws 429 Quota Exceeded if quota is insufficient
   */
  public requireQuota(tenantId: string, metric: UsageMetric, requestedDelta = 1): void {
    const result = this.checkUsage(tenantId, metric, requestedDelta);
    if (!result.allowed) {
      throw new Error(`429 Too Many Requests [Quota Exceeded]: ${result.reason}`);
    }
  }

  /**
   * Record consumption of quota
   */
  public recordUsage(tenantId: string, metric: UsageMetric, amount = 1): void {
    const tenantMetrics = this.getTenantMetricStore(tenantId);
    tenantMetrics[metric] = (tenantMetrics[metric] || 0) + amount;
    this.usageStore.set(tenantId, tenantMetrics);
  }

  /**
   * Return full usage breakdown for tenant dashboard/monitoring
   */
  public getTenantUsage(tenantId: string): TenantUsage {
    const tenantMetrics = this.getTenantMetricStore(tenantId);
    const metricsRecord: Record<UsageMetric, MetricUsage> = {} as any;

    for (const metric of Object.values(UsageMetric)) {
      const current = tenantMetrics[metric] || 0;
      const limit = this.getLimitForMetric(tenantId, metric);
      const remaining = Math.max(0, limit - current);
      const usagePercentage = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
      const isExceeded = current >= limit;

      metricsRecord[metric] = {
        current,
        limit,
        remaining,
        usagePercentage,
        isExceeded
      };
    }

    const now = new Date();
    const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return {
      tenantId,
      billingPeriod,
      metrics: metricsRecord,
      updatedAt: now.toISOString(),
      invoicesCount: tenantMetrics[UsageMetric.INVOICE_DOCUMENTS],
      eInvoicesCount: tenantMetrics[UsageMetric.E_INVOICE_DOCUMENTS],
      ewayBillsCount: tenantMetrics[UsageMetric.EWAY_BILLS],
      reconciliationCount: tenantMetrics[UsageMetric.RECONCILIATION_DOCUMENTS],
      aiRequestsCount: tenantMetrics[UsageMetric.AI_REQUESTS],
      apiCallsCount: tenantMetrics[UsageMetric.API_CALLS],
      usersCount: tenantMetrics[UsageMetric.USERS],
      gstinsCount: tenantMetrics[UsageMetric.GSTINS],
      branchesCount: tenantMetrics[UsageMetric.BRANCHES],
      storageMb: Math.round((tenantMetrics[UsageMetric.STORAGE_BYTES] || 0) / (1024 * 1024))
    };
  }
}

export const usageService = new UsageService();
