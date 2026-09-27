/**
 * Customer Usage & Quota Tracking Service
 * Computes live metric consumption against active subscription plan limits.
 */

import { entitlementService } from './entitlementService';
import { 
  PlanCode, 
  Plan, 
  PlanLimits, 
  UsageMetricItem, 
  TenantUsageSummary, 
  PlanAddOn,
  PLANS_CATALOG 
} from './types';

export const POPULAR_ADD_ONS: PlanAddOn[] = [
  {
    id: 'addon-invoices-1k',
    name: 'Invoice Boost Pack (+1,000)',
    category: 'INVOICES',
    description: 'Add 1,000 monthly invoice processing and validation slots',
    unitIncrement: 1000,
    unitLabel: 'Invoices / Month',
    monthlyPriceInr: 999,
    annualPriceInr: 9990,
  },
  {
    id: 'addon-users-5',
    name: 'Team Expansion Pack (+5 Seats)',
    category: 'USERS',
    description: 'Add 5 concurrent role-based user licenses to your organization',
    unitIncrement: 5,
    unitLabel: 'User Seats',
    monthlyPriceInr: 1499,
    annualPriceInr: 14990,
  },
  {
    id: 'addon-storage-10gb',
    name: 'Cloud Vault Expansion (+10 GB)',
    category: 'STORAGE',
    description: 'Extend statutory 8-year document retention archive storage',
    unitIncrement: 10240, // 10 GB in MB
    unitLabel: 'GB Storage',
    monthlyPriceInr: 499,
    annualPriceInr: 4990,
  },
  {
    id: 'addon-ai-250',
    name: 'AI Risk Copilot Pack (+250 Queries)',
    category: 'AI',
    description: 'Enhance automated anomaly diagnosis and tax liability forecasts',
    unitIncrement: 250,
    unitLabel: 'AI Queries / Month',
    monthlyPriceInr: 799,
    annualPriceInr: 7990,
  },
  {
    id: 'addon-gstin-1',
    name: 'State GSTIN Registration (+1 GSTIN)',
    category: 'GSTIN',
    description: 'Expand multi-state compliance filing to one additional state',
    unitIncrement: 1,
    unitLabel: 'State GSTIN',
    monthlyPriceInr: 1999,
    annualPriceInr: 19990,
  },
];

interface TenantDynamicUsage {
  invoicesProcessed: number;
  einvoicesGenerated: number;
  ewayBillsGenerated: number;
  reconciliationDocs: number;
  aiQueriesUsed: number;
  apiCallsMade: number;
  storageMbUsed: number;
  customPurchasedAddOns: Record<string, number>; // addonId -> quantity
}

const STORAGE_KEY = 'taxflow_tenant_usage_v1';

class UsageService {
  private tenantUsages: Map<string, TenantDynamicUsage> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          Object.keys(parsed).forEach(tenantId => {
            this.tenantUsages.set(tenantId, parsed[tenantId]);
          });
        }
      }
    } catch {
      // Fallback
    }

    // Initialize defaults if not present
    if (!this.tenantUsages.has('t1')) {
      this.tenantUsages.set('t1', {
        invoicesProcessed: 34200,
        einvoicesGenerated: 18450,
        ewayBillsGenerated: 14200,
        reconciliationDocs: 31500,
        aiQueriesUsed: 1420,
        apiCallsMade: 42150,
        storageMbUsed: 42800, // ~42.8 GB
        customPurchasedAddOns: {}
      });
    }

    if (!this.tenantUsages.has('t2')) {
      this.tenantUsages.set('t2', {
        invoicesProcessed: 8920,
        einvoicesGenerated: 4280,
        ewayBillsGenerated: 4100,
        reconciliationDocs: 9100,
        aiQueriesUsed: 460,
        apiCallsMade: 8900,
        storageMbUsed: 18200, // ~18.2 GB
        customPurchasedAddOns: {}
      });
    }

    if (!this.tenantUsages.has('t3')) {
      this.tenantUsages.set('t3', {
        invoicesProcessed: 2180,
        einvoicesGenerated: 460,
        ewayBillsGenerated: 890,
        reconciliationDocs: 2320,
        aiQueriesUsed: 88,
        apiCallsMade: 920,
        storageMbUsed: 4600, // ~4.6 GB
        customPurchasedAddOns: {}
      });
    }

    if (!this.tenantUsages.has('t4')) {
      this.tenantUsages.set('t4', {
        invoicesProcessed: 485,
        einvoicesGenerated: 0,
        ewayBillsGenerated: 0,
        reconciliationDocs: 0,
        aiQueriesUsed: 18,
        apiCallsMade: 0,
        storageMbUsed: 980, // ~980 MB
        customPurchasedAddOns: {}
      });
    }
  }

  private persist() {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        const obj: Record<string, TenantDynamicUsage> = {};
        this.tenantUsages.forEach((val, key) => {
          obj[key] = val;
        });
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
      }
    } catch {
      // Ignore
    }
    this.notifyListeners();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(cb => cb());
  }

  private getOrCreateUsage(tenantId: string): TenantDynamicUsage {
    if (!this.tenantUsages.has(tenantId)) {
      this.tenantUsages.set(tenantId, {
        invoicesProcessed: 120,
        einvoicesGenerated: 45,
        ewayBillsGenerated: 30,
        reconciliationDocs: 150,
        aiQueriesUsed: 10,
        apiCallsMade: 50,
        storageMbUsed: 250,
        customPurchasedAddOns: {}
      });
      this.persist();
    }
    return this.tenantUsages.get(tenantId)!;
  }

  /**
   * Get total effective limits for a tenant including purchased add-ons
   */
  public getEffectiveLimits(tenantId: string): PlanLimits {
    const sub = entitlementService.getSubscription(tenantId);
    const planCode = sub?.planId || PlanCode.STARTER;
    const baseLimits = sub?.limits || entitlementService.getPlan(planCode)?.limits || PLANS_CATALOG[planCode].limits;
    const usage = this.getOrCreateUsage(tenantId);

    const effective: PlanLimits = { ...baseLimits };

    Object.entries(usage.customPurchasedAddOns || {}).forEach(([addonId, qty]) => {
      if (qty <= 0) return;
      const addon = POPULAR_ADD_ONS.find(a => a.id === addonId);
      if (!addon) return;

      if (addon.category === 'INVOICES') {
        effective.monthlyInvoiceVolume += addon.unitIncrement * qty;
      } else if (addon.category === 'USERS') {
        effective.maxUsers += addon.unitIncrement * qty;
      } else if (addon.category === 'STORAGE') {
        effective.storageMb += addon.unitIncrement * qty;
      } else if (addon.category === 'AI') {
        effective.monthlyAiRequests += addon.unitIncrement * qty;
      } else if (addon.category === 'GSTIN') {
        effective.maxGstins += addon.unitIncrement * qty;
      }
    });

    return effective;
  }

  /**
   * Calculate live usage breakdown and summary for the tenant
   */
  public getTenantUsageSummary(tenantId: string): TenantUsageSummary {
    const sub = entitlementService.getSubscription(tenantId) || entitlementService.createSubscription(tenantId, PlanCode.STARTER);
    const plan = entitlementService.getPlan(sub.planId) || PLANS_CATALOG[sub.planId] || PLANS_CATALOG[PlanCode.STARTER];
    const limits = this.getEffectiveLimits(tenantId);
    const usage = this.getOrCreateUsage(tenantId);

    // Calculate billing period progression
    const startDate = new Date(sub.startDate || Date.now() - 15 * 24 * 60 * 60 * 1000);
    const renewalDate = new Date(sub.renewalDate || Date.now() + 15 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const totalDuration = Math.max(1, renewalDate.getTime() - startDate.getTime());
    const elapsed = Math.max(0, now.getTime() - startDate.getTime());
    const daysRemaining = Math.max(0, Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const totalDays = Math.ceil(totalDuration / (1000 * 60 * 60 * 24));
    const billingProgressPct = Math.min(100, Math.round((elapsed / totalDuration) * 100));

    // Determine current user & GSTIN counts based on tenant
    const activeUsersCount = tenantId === 't1' ? 8 : tenantId === 't2' ? 5 : tenantId === 't3' ? 3 : 2;
    const activeGstinCount = tenantId === 't1' ? 4 : tenantId === 't2' ? 2 : 1;
    const activeBranchCount = tenantId === 't1' ? 12 : tenantId === 't2' ? 4 : tenantId === 't3' ? 2 : 1;

    const buildMetric = (
      id: string,
      label: string,
      category: UsageMetricItem['category'],
      current: number,
      limit: number,
      unit: string,
      desc: string,
      iconName: string,
      trendLabel?: string
    ): UsageMetricItem => {
      const isUnlimited = limit >= 999999 || limit === 0 && plan.code === PlanCode.ENTERPRISE_PLUS;
      const percentage = isUnlimited ? Math.min(100, Math.round((current / 100000) * 100)) : limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 100;
      
      let status: UsageMetricItem['status'] = 'HEALTHY';
      if (!isUnlimited) {
        if (current >= limit && limit > 0) status = 'EXCEEDED';
        else if (percentage >= 90) status = 'CRITICAL';
        else if (percentage >= 70) status = 'WARNING';
      }

      return {
        id,
        label,
        category,
        current,
        limit,
        unit,
        percentage,
        status,
        description: desc,
        iconName,
        trendLabel,
        isUnlimited
      };
    };

    const metrics: UsageMetricItem[] = [
      buildMetric(
        'invoices',
        'Monthly Invoices Processed',
        'LEDGER',
        usage.invoicesProcessed,
        limits.monthlyInvoiceVolume,
        'Invoices',
        'Outward sales & inward expense invoices created this billing cycle',
        'FileText',
        '+14% vs last cycle'
      ),
      buildMetric(
        'einvoice',
        'IRP E-Invoices Generated',
        'COMPLIANCE',
        usage.einvoicesGenerated,
        limits.monthlyEinvoiceVolume,
        'IRN Generations',
        'Government IRP digitally signed e-invoices with QR verification',
        'QrCode',
        '+8% vs last cycle'
      ),
      buildMetric(
        'ewaybill',
        'NIC E-Way Bills Issued',
        'COMPLIANCE',
        usage.ewayBillsGenerated,
        limits.monthlyEwayBills,
        'E-Way Bills',
        'Consignment logistics dispatch and vehicle transit passes',
        'Truck',
        '+12% vs last cycle'
      ),
      buildMetric(
        'reconciliation',
        '2B Reconciliation Documents',
        'COMPLIANCE',
        usage.reconciliationDocs,
        limits.monthlyReconciliationDocuments,
        'Matched Records',
        'Auto-reconciled GSTR-2B purchase ledger entries and anomaly checks',
        'RefreshCw',
        '+22% vs last cycle'
      ),
      buildMetric(
        'users',
        'Team Member Seats',
        'INFRASTRUCTURE',
        activeUsersCount,
        limits.maxUsers,
        'Active Users',
        'Provisioned role-based user accounts and department operators',
        'Users',
        'No change'
      ),
      buildMetric(
        'gstin',
        'State GSTIN Registrations',
        'INFRASTRUCTURE',
        activeGstinCount,
        limits.maxGstins,
        'State GSTINs',
        'Active state tax identification numbers configured in tenant',
        'Building2',
        '1 State Added'
      ),
      buildMetric(
        'storage',
        'Document Vault Cloud Storage',
        'INFRASTRUCTURE',
        usage.storageMbUsed,
        limits.storageMb,
        'MB',
        '8-Year statutory tamper-proof invoice, e-way bill & return archive',
        'HardDrive',
        '+2.1 GB this month'
      ),
      buildMetric(
        'ai',
        'AI Risk & Forecasting Queries',
        'INTELLIGENCE',
        usage.aiQueriesUsed,
        limits.monthlyAiRequests,
        'AI Queries',
        'Automated tax anomaly diagnosis, liability forecasting and audit checks',
        'Sparkles',
        '+34% vs last cycle'
      ),
      buildMetric(
        'api',
        'Developer REST API Calls',
        'INTELLIGENCE',
        usage.apiCallsMade,
        limits.monthlyApiCalls,
        'API Calls',
        'ERP sync webhooks, ingestion pipeline and programmatic queries',
        'Cpu',
        '+18% vs last cycle'
      ),
    ];

    // Find highest consumed metric (excluding unlimited metrics)
    const activeScored = metrics.filter(m => !m.isUnlimited && m.limit > 0);
    const sorted = [...activeScored].sort((a, b) => b.percentage - a.percentage);
    const highestConsumedMetric = sorted[0] || metrics[0];

    // Overall health determination
    let overallHealth: TenantUsageSummary['overallHealth'] = 'HEALTHY';
    if (metrics.some(m => m.status === 'EXCEEDED' || m.status === 'CRITICAL')) {
      overallHealth = 'CRITICAL';
    } else if (metrics.some(m => m.status === 'WARNING')) {
      overallHealth = 'WARNING';
    }

    // Determine recommended upgrade plan
    let recommendedUpgradePlan: Plan | undefined = undefined;
    const planOrder = [PlanCode.STARTER, PlanCode.BUSINESS, PlanCode.PROFESSIONAL, PlanCode.ENTERPRISE, PlanCode.ENTERPRISE_PLUS];
    const currentIndex = planOrder.indexOf(plan.code);
    if (currentIndex >= 0 && currentIndex < planOrder.length - 1) {
      const nextCode = planOrder[currentIndex + 1];
      recommendedUpgradePlan = entitlementService.getPlan(nextCode) || PLANS_CATALOG[nextCode];
    }

    return {
      tenantId,
      plan,
      subscription: sub,
      metrics,
      billingPeriod: {
        startDate: startDate.toISOString(),
        renewalDate: renewalDate.toISOString(),
        daysRemaining,
        totalDays,
        progressPct: billingProgressPct,
      },
      overallHealth,
      highestConsumedMetric,
      recommendedUpgradePlan,
    };
  }

  /**
   * Purchase an Add-On for a tenant
   */
  public purchaseAddOn(tenantId: string, addonId: string, quantity: number = 1): TenantUsageSummary {
    const usage = this.getOrCreateUsage(tenantId);
    const currentQty = usage.customPurchasedAddOns[addonId] || 0;
    usage.customPurchasedAddOns[addonId] = currentQty + quantity;
    this.persist();
    return this.getTenantUsageSummary(tenantId);
  }

  /**
   * Record incremental usage event
   */
  public recordUsage(tenantId: string, metric: keyof Omit<TenantDynamicUsage, 'customPurchasedAddOns'>, amount: number = 1): void {
    const usage = this.getOrCreateUsage(tenantId);
    usage[metric] = (usage[metric] || 0) + amount;
    this.persist();
  }

  /**
   * Instant plan upgrade with immediate entitlement refresh
   */
  public upgradePlan(tenantId: string, newPlanCode: PlanCode): TenantUsageSummary {
    entitlementService.updateSubscriptionPlan(tenantId, newPlanCode);
    this.persist();
    return this.getTenantUsageSummary(tenantId);
  }

  /**
   * Reset billing cycle metrics for simulation
   */
  public resetMonthlyUsageCycle(tenantId: string): TenantUsageSummary {
    const usage = this.getOrCreateUsage(tenantId);
    usage.invoicesProcessed = Math.round(usage.invoicesProcessed * 0.05);
    usage.einvoicesGenerated = Math.round(usage.einvoicesGenerated * 0.05);
    usage.ewayBillsGenerated = Math.round(usage.ewayBillsGenerated * 0.05);
    usage.reconciliationDocs = Math.round(usage.reconciliationDocs * 0.05);
    usage.aiQueriesUsed = Math.round(usage.aiQueriesUsed * 0.05);
    usage.apiCallsMade = Math.round(usage.apiCallsMade * 0.05);
    this.persist();
    return this.getTenantUsageSummary(tenantId);
  }

  /**
   * Simulate a surge in usage to demonstrate warning / critical triggers
   */
  public simulateSurge(tenantId: string): TenantUsageSummary {
    const usage = this.getOrCreateUsage(tenantId);
    const limits = this.getEffectiveLimits(tenantId);
    
    // Push invoice and storage to 92% capacity
    usage.invoicesProcessed = Math.round(limits.monthlyInvoiceVolume * 0.92);
    usage.storageMbUsed = Math.round(limits.storageMb * 0.88);
    usage.aiQueriesUsed = Math.round(limits.monthlyAiRequests * 0.95);
    if (limits.monthlyEinvoiceVolume > 0) {
      usage.einvoicesGenerated = Math.round(limits.monthlyEinvoiceVolume * 0.91);
    }
    this.persist();
    return this.getTenantUsageSummary(tenantId);
  }
}

export const usageService = new UsageService();
