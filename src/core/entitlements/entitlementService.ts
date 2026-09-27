/**
 * Central Entitlement Service
 * Resolves feature access dynamically without hard-coding plans into components or business logic.
 */

import { Feature, PlanCode, Plan, TenantSubscription, PLANS_CATALOG, DEFAULT_PLANS_CATALOG, PlanLimits } from './types';

class EntitlementService {
  private subscriptions: Map<string, TenantSubscription> = new Map();
  private plansCatalog: Map<PlanCode, Plan> = new Map();
  private planListeners: Set<() => void> = new Set();

  constructor() {
    this.initializePlansCatalog();
    this.loadFromStorage();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'taxflow_plans_catalog') {
          this.initializePlansCatalog();
          this.notifyPlanListeners();
        }
      });
      window.addEventListener('taxflow:plans_catalog_updated', () => {
        this.initializePlansCatalog();
        this.notifyPlanListeners();
      });
    }
  }

  public subscribeToPlans(callback: () => void): () => void {
    this.planListeners.add(callback);
    return () => {
      this.planListeners.delete(callback);
    };
  }

  private notifyPlanListeners() {
    this.planListeners.forEach(cb => {
      try { cb(); } catch (e) { console.error('Error in plan listener', e); }
    });
  }

  private saveToStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const subsArray = Array.from(this.subscriptions.values());
        window.localStorage.setItem('taxflow_tenant_subscriptions', JSON.stringify(subsArray));
        window.dispatchEvent(new CustomEvent('taxflow:subscription_updated', { detail: subsArray }));
      }
    } catch (e) {
      console.warn('Could not save subscriptions to localStorage', e);
    }
  }

  private loadFromStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('taxflow_tenant_subscriptions');
        if (saved) {
          const subs: TenantSubscription[] = JSON.parse(saved);
          subs.forEach(s => this.subscriptions.set(s.tenantId, s));
          return;
        }
      }
    } catch (e) {
      console.warn('Could not load subscriptions from localStorage', e);
    }
    this.seedDefaultSubscriptions();
  }

  private initializePlansCatalog() {
    const source = DEFAULT_PLANS_CATALOG || PLANS_CATALOG;
    (Object.values(source) as Plan[]).forEach((p: Plan) => {
      this.plansCatalog.set(p.code, JSON.parse(JSON.stringify(p)));
    });

    // Load any super admin customized plans from localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedPlans = window.localStorage.getItem('taxflow_plans_catalog');
        if (savedPlans) {
          const plans: Plan[] = JSON.parse(savedPlans);
          plans.forEach(p => {
            this.plansCatalog.set(p.code, p);
            if (PLANS_CATALOG[p.code]) {
              PLANS_CATALOG[p.code] = p;
            }
          });
        }
      }
    } catch (e) {
      console.warn('Could not load customized plans from localStorage', e);
    }
  }

  private seedDefaultSubscriptions() {
    // Tenant 1: Enterprise Multi-Entity
    const s1: TenantSubscription = {
      id: 'sub-t1',
      tenantId: 't1',
      planId: PlanCode.ENTERPRISE,
      status: 'ACTIVE',
      startDate: '2025-01-10T00:00:00.000Z',
      renewalDate: '2027-01-10T00:00:00.000Z',
      billingCycle: 'ANNUAL',
      limits: this.getPlan(PlanCode.ENTERPRISE)?.limits || PLANS_CATALOG[PlanCode.ENTERPRISE].limits
    };

    // Tenant 2: Professional Compliance
    const s2: TenantSubscription = {
      id: 'sub-t2',
      tenantId: 't2',
      planId: PlanCode.PROFESSIONAL,
      status: 'ACTIVE',
      startDate: '2025-02-15T00:00:00.000Z',
      renewalDate: '2027-02-15T00:00:00.000Z',
      billingCycle: 'ANNUAL',
      limits: this.getPlan(PlanCode.PROFESSIONAL)?.limits || PLANS_CATALOG[PlanCode.PROFESSIONAL].limits
    };

    // Tenant 3: Business Growth
    const s3: TenantSubscription = {
      id: 'sub-t3',
      tenantId: 't3',
      planId: PlanCode.BUSINESS,
      status: 'ACTIVE',
      startDate: '2025-03-01T00:00:00.000Z',
      renewalDate: '2027-03-01T00:00:00.000Z',
      billingCycle: 'ANNUAL',
      limits: this.getPlan(PlanCode.BUSINESS)?.limits || PLANS_CATALOG[PlanCode.BUSINESS].limits
    };

    // Tenant 4: Starter SME
    const s4: TenantSubscription = {
      id: 'sub-t4',
      tenantId: 't4',
      planId: PlanCode.STARTER,
      status: 'SUSPENDED',
      startDate: '2024-01-01T00:00:00.000Z',
      renewalDate: '2025-12-31T00:00:00.000Z',
      billingCycle: 'ANNUAL',
      limits: this.getPlan(PlanCode.STARTER)?.limits || PLANS_CATALOG[PlanCode.STARTER].limits
    };

    this.subscriptions.set(s1.tenantId, s1);
    this.subscriptions.set(s2.tenantId, s2);
    this.subscriptions.set(s3.tenantId, s3);
    this.subscriptions.set(s4.tenantId, s4);
  }

  // --- PLANS CATALOG MANAGEMENT (SUPER ADMIN) ---

  public getAllPlans(): Plan[] {
    return Array.from(this.plansCatalog.values());
  }

  public getPlan(planCode: PlanCode): Plan | null {
    return this.plansCatalog.get(planCode) || null;
  }

  /**
   * Super Admin action: Customize plan pricing, limits, and module features
   */
  public updatePlan(planCode: PlanCode, updates: Partial<Plan>): Plan {
    const existing = this.plansCatalog.get(planCode);
    if (!existing) {
      throw new Error(`Plan not found in catalog: ${planCode}`);
    }

    const updated: Plan = {
      ...existing,
      ...updates,
      code: planCode, // protect code identity
      limits: updates.limits ? { ...existing.limits, ...updates.limits } : existing.limits,
      features: updates.features ? Array.from(new Set(updates.features)) : existing.features
    };

    this.plansCatalog.set(planCode, updated);

    // Synchronize also the global exported object for backwards compatibility
    if (PLANS_CATALOG[planCode]) {
      PLANS_CATALOG[planCode] = updated;
    }

    // Persist to localStorage and dispatch custom event
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const allPlans = Array.from(this.plansCatalog.values());
        window.localStorage.setItem('taxflow_plans_catalog', JSON.stringify(allPlans));
        window.dispatchEvent(new CustomEvent('taxflow:plans_catalog_updated', { detail: updated }));
      }
    } catch (e) {
      console.warn('Could not save customized plans to localStorage', e);
    }

    return updated;
  }

  /**
   * Reset plans catalog to system defaults
   */
  public resetPlansToDefault(): Plan[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('taxflow_plans_catalog');
        window.dispatchEvent(new CustomEvent('taxflow:plans_catalog_updated', { detail: null }));
      }
    } catch (e) {}
    this.initializePlansCatalog();
    return this.getAllPlans();
  }

  // --- TENANT SUBSCRIPTION & CUSTOM OVERRIDES ---

  /**
   * Check if a tenant's subscription includes a given Feature
   */
  public hasFeature(tenantId: string, feature: Feature): boolean {
    const sub = this.subscriptions.get(tenantId);
    if (!sub || sub.status !== 'ACTIVE') {
      return false;
    }

    // Check custom overrides first
    if (sub.customFeatureOverrides?.disabledFeatures?.includes(feature)) {
      return false;
    }
    if (sub.customFeatureOverrides?.enabledFeatures?.includes(feature)) {
      return true;
    }

    const plan = this.getPlan(sub.planId) || PLANS_CATALOG[sub.planId];
    if (!plan) return false;

    return plan.features.includes(feature);
  }

  /**
   * Strictly assert that a tenant possesses the specified Feature entitlement.
   * Throws 403 Forbidden if not entitled.
   */
  public requireFeature(tenantId: string, feature: Feature): void {
    if (!this.hasFeature(tenantId, feature)) {
      const sub = this.getSubscription(tenantId);
      const planName = sub?.planId || 'UNKNOWN';
      throw new Error(`403 Forbidden [Plan Entitlement]: Feature '${feature}' is not included in tenant's current plan (${planName}). Upgrade plan to access this module.`);
    }
  }

  /**
   * Get all active entitlements for a tenant
   */
  public getEntitlements(tenantId: string): Feature[] {
    const sub = this.subscriptions.get(tenantId);
    if (!sub || sub.status !== 'ACTIVE') {
      return [];
    }

    const plan = this.getPlan(sub.planId) || PLANS_CATALOG[sub.planId];
    if (!plan) return [];

    let features = [...plan.features];

    if (sub.customFeatureOverrides?.enabledFeatures) {
      features = Array.from(new Set([...features, ...sub.customFeatureOverrides.enabledFeatures]));
    }
    if (sub.customFeatureOverrides?.disabledFeatures) {
      features = features.filter(f => !sub.customFeatureOverrides!.disabledFeatures!.includes(f));
    }

    return features;
  }

  /**
   * Get tenant subscription and limits
   */
  public getSubscription(tenantId: string): TenantSubscription | null {
    return this.subscriptions.get(tenantId) || null;
  }

  public getAllSubscriptions(): TenantSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  public getPlanLimits(tenantId: string): PlanLimits {
    const sub = this.subscriptions.get(tenantId);
    if (!sub) {
      const starter = this.getPlan(PlanCode.STARTER) || PLANS_CATALOG[PlanCode.STARTER];
      return starter.limits;
    }
    return sub.limits;
  }

  public getMaxCompanies(tenantId: string): number {
    return this.getPlanLimits(tenantId).maxCompanies || 1;
  }

  public getMaxGstins(tenantId: string): number {
    return this.getPlanLimits(tenantId).maxGstins || 1;
  }

  public canAddCompany(tenantId: string, currentCompanyCount: number): boolean {
    const max = this.getMaxCompanies(tenantId);
    return currentCompanyCount < max;
  }

  public canAddGstin(tenantId: string, currentGstinCount: number): boolean {
    const max = this.getMaxGstins(tenantId);
    return currentGstinCount < max;
  }

  public createSubscription(
    tenantId: string, 
    planCode: PlanCode = PlanCode.STARTER, 
    billingCycle: 'MONTHLY' | 'ANNUAL' = 'ANNUAL'
  ): TenantSubscription {
    const plan = this.getPlan(planCode) || PLANS_CATALOG[planCode] || PLANS_CATALOG[PlanCode.STARTER];
    const durationDays = billingCycle === 'ANNUAL' ? 365 : 30;
    const sub: TenantSubscription = {
      id: `sub-${tenantId}-${Date.now().toString(36)}`,
      tenantId,
      planId: plan.code,
      status: 'ACTIVE',
      startDate: new Date().toISOString(),
      renewalDate: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString(),
      billingCycle,
      limits: plan.limits
    };
    this.subscriptions.set(tenantId, sub);
    this.saveToStorage();
    return sub;
  }

  public updateSubscriptionPlan(tenantId: string, newPlanCode: PlanCode): TenantSubscription {
    const current = this.subscriptions.get(tenantId);
    const plan = this.getPlan(newPlanCode) || PLANS_CATALOG[newPlanCode];
    if (!plan) throw new Error(`Unknown plan code: ${newPlanCode}`);

    const updated: TenantSubscription = {
      id: current?.id || `sub-${tenantId}`,
      tenantId,
      planId: newPlanCode,
      status: 'ACTIVE',
      startDate: current?.startDate || new Date().toISOString(),
      renewalDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      billingCycle: current?.billingCycle || 'ANNUAL',
      limits: plan.limits,
      customFeatureOverrides: current?.customFeatureOverrides,
      customMonthlyPrice: current?.customMonthlyPrice,
      customAnnualPrice: current?.customAnnualPrice,
      customPlanName: current?.customPlanName,
      customNotes: current?.customNotes
    };

    this.subscriptions.set(tenantId, updated);
    this.saveToStorage();
    return updated;
  }

  /**
   * Super Admin action: Customize an individual organization's plan, module overrides, and bespoke pricing
   */
  public customizeTenantSubscription(
    tenantId: string, 
    overrides: {
      planId?: PlanCode;
      enabledFeatures?: Feature[];
      disabledFeatures?: Feature[];
      customMonthlyPrice?: number;
      customAnnualPrice?: number;
      customPlanName?: string;
      customNotes?: string;
      customLimits?: Partial<PlanLimits>;
    }
  ): TenantSubscription {
    let current = this.subscriptions.get(tenantId);
    if (!current) {
      current = this.createSubscription(tenantId, overrides.planId || PlanCode.STARTER);
    }

    const targetPlanCode = overrides.planId || current.planId;
    const basePlan = this.getPlan(targetPlanCode) || PLANS_CATALOG[targetPlanCode];

    const updated: TenantSubscription = {
      ...current,
      planId: targetPlanCode,
      limits: overrides.customLimits 
        ? { ...(basePlan?.limits || current.limits), ...overrides.customLimits }
        : (basePlan?.limits || current.limits),
      customFeatureOverrides: {
        enabledFeatures: overrides.enabledFeatures !== undefined 
          ? overrides.enabledFeatures 
          : current.customFeatureOverrides?.enabledFeatures || [],
        disabledFeatures: overrides.disabledFeatures !== undefined 
          ? overrides.disabledFeatures 
          : current.customFeatureOverrides?.disabledFeatures || []
      },
      customMonthlyPrice: overrides.customMonthlyPrice !== undefined 
        ? overrides.customMonthlyPrice 
        : current.customMonthlyPrice,
      customAnnualPrice: overrides.customAnnualPrice !== undefined 
        ? overrides.customAnnualPrice 
        : current.customAnnualPrice,
      customPlanName: overrides.customPlanName !== undefined 
        ? overrides.customPlanName 
        : current.customPlanName,
      customNotes: overrides.customNotes !== undefined 
        ? overrides.customNotes 
        : current.customNotes
    };

    this.subscriptions.set(tenantId, updated);
    this.saveToStorage();
    return updated;
  }
}

export const entitlementService = new EntitlementService();
