import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { Tenant, TenantContext as CoreTenantContext, TenantGstin, TenantBranch, CreateTenantParams } from './types';
import { tenantService } from './tenantService';
import { Feature, TenantSubscription, PlanCode, PLANS_CATALOG } from '../entitlements/types';
import { entitlementService } from '../entitlements/entitlementService';
import { TenantUsage } from '../usage/types';
import { usageService } from '../usage/usageService';
import { Permission, roleHasPermission } from '../permissions/types';
import { MultiTenantSecurityTestSuite, MultiTenantTestSuiteSummary } from '../tests/multiTenantIsolation.test';
import { ServerTenantAuthMiddlewareTestSuite, MiddlewareTestResult } from '../tests/serverTenantAuthMiddleware.test';

export interface MiddlewareTestSuiteSummary {
  passedCount: number;
  failedCount: number;
  totalCount: number;
  allPassed: boolean;
  results: MiddlewareTestResult[];
}

export interface TenantContextState {
  tenant: Tenant | null;
  tenantContext: CoreTenantContext | null;
  availableTenants: Tenant[];
  subscription: TenantSubscription | null;
  entitlements: Feature[];
  usage: TenantUsage | null;
  gstins: TenantGstin[];
  branches: TenantBranch[];
  isLoading: boolean;
  switchTenant: (tenantId: string) => void;
  createTenant: (params: CreateTenantParams) => Promise<{ tenant: Tenant; subscription: TenantSubscription | null }>;
  hasFeature: (feature: Feature) => boolean;
  checkPermission: (permission: Permission) => boolean;
  runIsolationTests: () => Promise<MultiTenantTestSuiteSummary>;
  testResults: MultiTenantTestSuiteSummary | null;
  runMiddlewareTests: () => Promise<MiddlewareTestSuiteSummary>;
  middlewareTestResults: MiddlewareTestSuiteSummary | null;
}

const TenantReactContext = createContext<TenantContextState | undefined>(undefined);

export const TenantContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const userTenantId = useAuthStore((state) => state.user?.currentTenantId);
  const authSwitchTenant = useAuthStore((state) => state.switchTenant);

  const [currentTenantId, setCurrentTenantId] = useState<string>(userTenantId || 't1');
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantContext, setTenantContext] = useState<CoreTenantContext | null>(null);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [entitlements, setEntitlements] = useState<Feature[]>([]);
  const [usage, setUsage] = useState<TenantUsage | null>(null);
  const [gstins, setGstins] = useState<TenantGstin[]>([]);
  const [branches, setBranches] = useState<TenantBranch[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [testResults, setTestResults] = useState<MultiTenantTestSuiteSummary | null>(null);
  const [middlewareTestResults, setMiddlewareTestResults] = useState<MiddlewareTestSuiteSummary | null>(null);

  // Sync state if authStore currentTenantId changes
  useEffect(() => {
    if (userTenantId && userTenantId !== currentTenantId) {
      setCurrentTenantId(userTenantId);
    }
  }, [userTenantId]);

  const loadTenantData = useCallback((tenantId: string) => {
    setIsLoading(true);
    try {
      const authorized = tenantService.getUserAuthorizedTenants('u-fayas', 'fayasamd@gmail.com');
      const selectable = authorized.length > 0
        ? authorized
        : tenantService.getAllTenants().filter(t => !t.isDeleted && t.status === 'ACTIVE');
      setAvailableTenants(selectable);

      const resolvedTenant = tenantService.getTenant(tenantId);
      setTenant(resolvedTenant);

      const ctx = tenantService.resolveTenantContext({
        userId: 'u-fayas',
        userEmail: 'fayasamd@gmail.com',
        requestedTenantId: tenantId
      });
      setTenantContext(ctx);

      const sub = entitlementService.getSubscription(tenantId);
      setSubscription(sub);

      const ent = entitlementService.getEntitlements(tenantId);
      setEntitlements(ent);

      const usg = usageService.getTenantUsage(tenantId);
      setUsage(usg);

      const gList = tenantService.getTenantGstins(tenantId);
      setGstins(gList);

      const bList = tenantService.getTenantBranches(tenantId);
      setBranches(bList);
    } catch (err: any) {
      console.warn('[TenantContext] Failed to resolve tenant context:', err?.message || err);
      // Fallback safely to primary authorized tenant (t1) so UI stays valid
      const authorized = tenantService.getUserAuthorizedTenants('u-fayas', 'fayasamd@gmail.com');
      const fallbackId = authorized[0]?.id || 't1';
      if (tenantId !== fallbackId) {
        setCurrentTenantId(fallbackId);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTenantData(currentTenantId);
  }, [currentTenantId, loadTenantData]);

  const switchTenant = useCallback((tenantId: string) => {
    setCurrentTenantId(tenantId);
    authSwitchTenant(tenantId);
  }, [authSwitchTenant]);

  const createTenant = useCallback(async (params: CreateTenantParams): Promise<{ tenant: Tenant; subscription: TenantSubscription | null }> => {
    setIsLoading(true);
    try {
      const result = tenantService.createTenant({
        ...params,
        creatorUserId: 'u-fayas',
        creatorEmail: 'fayasamd@gmail.com',
        creatorName: 'Fayas M'
      });
      // Refresh authorized tenant list
      const authorized = tenantService.getUserAuthorizedTenants('u-fayas', 'fayasamd@gmail.com');
      const selectable = authorized.length > 0
        ? authorized
        : tenantService.getAllTenants().filter(t => !t.isDeleted && t.status === 'ACTIVE');
      setAvailableTenants(selectable);

      // Automatically switch to the newly created tenant
      switchTenant(result.tenant.id);

      const sub = entitlementService.getSubscription(result.tenant.id);
      return { tenant: result.tenant, subscription: sub };
    } finally {
      setIsLoading(false);
    }
  }, [switchTenant]);

  const hasFeature = useCallback((feature: Feature): boolean => {
    if (!currentTenantId) return false;
    return entitlementService.hasFeature(currentTenantId, feature);
  }, [currentTenantId]);

  const checkPermission = useCallback((permission: Permission): boolean => {
    if (!tenantContext) return false;
    return roleHasPermission(tenantContext.role, permission, tenantContext.isReadOnly);
  }, [tenantContext]);

  const runIsolationTests = useCallback(async (): Promise<MultiTenantTestSuiteSummary> => {
    const summary = await MultiTenantSecurityTestSuite.runAllTests();
    setTestResults(summary);
    return summary;
  }, []);

  const runMiddlewareTests = useCallback(async (): Promise<MiddlewareTestSuiteSummary> => {
    const summary = await ServerTenantAuthMiddlewareTestSuite.runAllTests();
    setMiddlewareTestResults(summary);
    return summary;
  }, []);

  return (
    <TenantReactContext.Provider
      value={{
        tenant,
        tenantContext,
        availableTenants,
        subscription,
        entitlements,
        usage,
        gstins,
        branches,
        isLoading,
        switchTenant,
        createTenant,
        hasFeature,
        checkPermission,
        runIsolationTests,
        testResults,
        runMiddlewareTests,
        middlewareTestResults
      }}
    >
      {children}
    </TenantReactContext.Provider>
  );
};

export function useTenantContext(): TenantContextState {
  const context = useContext(TenantReactContext);
  if (!context) {
    throw new Error('useTenantContext must be used within a TenantContextProvider');
  }
  return context;
}

/**
 * Convenient hook for components to check feature entitlement cleanly
 * without referencing plans or hardcoded strings
 */
export function useEntitlement(feature: Feature): boolean {
  const { hasFeature } = useTenantContext();
  return hasFeature(feature);
}
