/**
 * TaxFlow Global Entity Context & UI Store (Zustand)
 * 
 * Manages client-side tenant context, period selection, and UI preferences.
 * Adheres strictly to rule #17: Server state belongs in TanStack Query;
 * Zustand ONLY manages client/UI state (entity, period, preferences).
 */

import { create } from 'zustand';
import { ActiveEntityContext } from '../api/contracts';
import { enterpriseApiClient } from '../../services/api/enterpriseApiClient';
import { DEMO_ENTITY_FIXTURE, DEMO_TAX_PERIOD_FIXTURE } from '../fixtures/demoEntityContext';

export interface UiPreferences {
  theme: 'dark' | 'light' | 'system';
  density: 'comfortable' | 'compact';
  language: string;
  auditDrawerOpen: boolean;
  explainerDrawerOpen: boolean;
}

export interface NavigationState {
  activeRoute: string;
  sidebarCollapsed: boolean;
}

export interface EntityContextState {
  // Session & Entity Context
  activeHoldingGroupId: string | null;
  activeCompanyId: string | null;
  activeGstin: string | null;
  activeBranchId: string | null;
  activePeriod: string;
  isDemoMode: boolean;

  // UI State
  uiPreferences: UiPreferences;
  navigationState: NavigationState;

  // Actions
  setEntityContext: (context: Partial<ActiveEntityContext>) => void;
  setActivePeriod: (period: string) => void;
  setDemoMode: (enabled: boolean) => void;
  setUiPreferences: (prefs: Partial<UiPreferences>) => void;
  setNavigationState: (nav: Partial<NavigationState>) => void;
  resetContext: () => void;
}

export const useEntityContextStore = create<EntityContextState>((set, get) => ({
  // Initialize with null or demo fallback if demo mode
  activeHoldingGroupId: DEMO_ENTITY_FIXTURE.groupId,
  activeCompanyId: DEMO_ENTITY_FIXTURE.companyId,
  activeGstin: DEMO_ENTITY_FIXTURE.gstinId,
  activeBranchId: DEMO_ENTITY_FIXTURE.branchId || 'BR-001',
  activePeriod: DEMO_TAX_PERIOD_FIXTURE,
  isDemoMode: true,

  uiPreferences: {
    theme: 'dark',
    density: 'comfortable',
    language: 'en',
    auditDrawerOpen: false,
    explainerDrawerOpen: false,
  },

  navigationState: {
    activeRoute: '/control-tower',
    sidebarCollapsed: false,
  },

  setEntityContext: (context) => {
    set((state) => {
      const nextGroup = context.groupId !== undefined ? context.groupId : state.activeHoldingGroupId;
      const nextCompany = context.companyId !== undefined ? context.companyId : state.activeCompanyId;
      const nextGstin = context.gstinId !== undefined ? context.gstinId : state.activeGstin;
      const nextBranch = context.branchId !== undefined ? context.branchId : state.activeBranchId;

      // Sync with the singleton EnterpriseApiClient
      if (nextGroup && nextCompany && nextGstin) {
        enterpriseApiClient.setEntityContext({
          groupId: nextGroup,
          companyId: nextCompany,
          gstinId: nextGstin,
          branchId: nextBranch || undefined,
        });
      }

      return {
        activeHoldingGroupId: nextGroup,
        activeCompanyId: nextCompany,
        activeGstin: nextGstin,
        activeBranchId: nextBranch,
      };
    });
  },

  setActivePeriod: (period: string) => {
    set({ activePeriod: period });
    enterpriseApiClient.setActivePeriod(period);
  },

  setDemoMode: (enabled: boolean) => {
    set({ isDemoMode: enabled });
  },

  setUiPreferences: (prefs) => {
    set((state) => ({
      uiPreferences: { ...state.uiPreferences, ...prefs },
    }));
  },

  setNavigationState: (nav) => {
    set((state) => ({
      navigationState: { ...state.navigationState, ...nav },
    }));
  },

  resetContext: () => {
    set({
      activeHoldingGroupId: null,
      activeCompanyId: null,
      activeGstin: null,
      activeBranchId: null,
      isDemoMode: false,
    });
  },
}));
