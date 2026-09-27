import { configureStore } from '@reduxjs/toolkit';
import { User, Tenant, GstinRegistrationItem, BranchDetailsItem, UserRole } from '../types';
import { useAuthStore } from '../src/stores/useAuthStore';
import { useOrgStore } from '../src/stores/useOrgStore';

export interface RootState {
  auth: {
    user: User | null;
    isAuthenticated: boolean;
  };
  org: {
    selectedGstin: string;
    selectedBranchId: string;
    gstinsByTenant: Record<string, GstinRegistrationItem[]>;
    branchesByTenant: Record<string, BranchDetailsItem[]>;
  };
}

export const login = (user: User) => ({ type: 'auth/login', payload: user });
export const logout = () => ({ type: 'auth/logout' });
export const switchRole = (role: UserRole) => ({ type: 'auth/switchRole', payload: role });
export const switchUserPersona = (persona: { name: string; email: string; role: UserRole }) => ({
  type: 'auth/switchUserPersona',
  payload: persona,
});
export const switchTenant = (tenantId: string) => ({ type: 'auth/switchTenant', payload: tenantId });
export const updateProfile = (profile: Partial<User>) => ({ type: 'auth/updateProfile', payload: profile });
export const addTenant = (tenant: Tenant) => ({ type: 'auth/addTenant', payload: tenant });

export const setSelectedGstin = (gstin: string) => ({ type: 'org/setSelectedGstin', payload: gstin });
export const setSelectedBranch = (branchId: string) => ({ type: 'org/setSelectedBranch', payload: branchId });
export const setGstinsForTenant = (payload: { tenantId: string; gstins: GstinRegistrationItem[] }) => ({
  type: 'org/setGstinsForTenant',
  payload,
});
export const setBranchesForTenant = (payload: { tenantId: string; branches: BranchDetailsItem[] }) => ({
  type: 'org/setBranchesForTenant',
  payload,
});
export const addGstinRegistration = (payload: { tenantId: string; gstin: GstinRegistrationItem }) => ({
  type: 'org/addGstinRegistration',
  payload,
});
export const addBranch = (payload: { tenantId: string; branch: BranchDetailsItem }) => ({
  type: 'org/addBranch',
  payload,
});
export const deleteGstinRegistration = (payload: { tenantId: string; gstinId: string }) => ({
  type: 'org/deleteGstinRegistration',
  payload,
});
export const deleteBranch = (payload: { tenantId: string; branchId: string }) => ({
  type: 'org/deleteBranch',
  payload,
});

function syncZustandState(): RootState {
  const authState = useAuthStore.getState();
  const orgState = useOrgStore.getState();
  return {
    auth: {
      user: authState.user,
      isAuthenticated: authState.isAuthenticated,
    },
    org: {
      selectedGstin: orgState.selectedGstin,
      selectedBranchId: orgState.selectedBranchId,
      gstinsByTenant: orgState.gstinsByTenant,
      branchesByTenant: orgState.branchesByTenant,
    },
  };
}

function rootReducer(state: RootState = syncZustandState(), action: any): RootState {
  if (action && action.type) {
    const authStore = useAuthStore.getState();
    const orgStore = useOrgStore.getState();

    switch (action.type) {
      case 'auth/login':
        authStore.login(action.payload);
        break;
      case 'auth/logout':
        authStore.logout();
        break;
      case 'auth/switchRole':
        authStore.switchRole(action.payload);
        break;
      case 'auth/switchUserPersona':
        authStore.switchUserPersona(action.payload);
        break;
      case 'auth/switchTenant':
        authStore.switchTenant(action.payload);
        orgStore.resetOrgSelections();
        break;
      case 'auth/updateProfile':
        authStore.updateProfile(action.payload);
        break;
      case 'auth/addTenant':
        authStore.addTenant(action.payload);
        break;
      case 'org/setSelectedGstin':
        orgStore.setSelectedGstin(action.payload);
        break;
      case 'org/setSelectedBranch':
        orgStore.setSelectedBranch(action.payload);
        break;
      case 'org/setGstinsForTenant':
        orgStore.setGstinsForTenant(action.payload.tenantId, action.payload.gstins);
        break;
      case 'org/setBranchesForTenant':
        orgStore.setBranchesForTenant(action.payload.tenantId, action.payload.branches);
        break;
      case 'org/addGstinRegistration':
        orgStore.addGstinRegistration(action.payload.tenantId, action.payload.gstin);
        break;
      case 'org/addBranch':
        orgStore.addBranch(action.payload.tenantId, action.payload.branch);
        break;
      case 'org/deleteGstinRegistration':
        orgStore.deleteGstinRegistration(action.payload.tenantId, action.payload.gstinId);
        break;
      case 'org/deleteBranch':
        orgStore.deleteBranch(action.payload.tenantId, action.payload.branchId);
        break;
    }
  }
  return syncZustandState();
}

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

useAuthStore.subscribe(() => {
  store.dispatch({ type: '__ZUSTAND_SYNC__' });
});
useOrgStore.subscribe(() => {
  store.dispatch({ type: '__ZUSTAND_SYNC__' });
});

export function useSelector<T>(selector: (state: RootState) => T): T {
  return selector(syncZustandState());
}

export function useDispatch() {
  return store.dispatch;
}

export type AppDispatch = typeof store.dispatch;