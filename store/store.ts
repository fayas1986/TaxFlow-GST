import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User, Tenant, GstinRegistrationItem, BranchDetailsItem, UserRole } from '../types';
import { ENTERPRISE_GROUP_TENANTS, ENTERPRISE_GSTINS_BY_TENANT, ENTERPRISE_BRANCHES_BY_TENANT } from '../src/fixtures/enterpriseTenants';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

const defaultEnterpriseUser: User = {
  id: 'u1',
  name: 'Vikram Malhotra (CFO / Admin)',
  email: 'admin@taxflow.com',
  role: UserRole.ADMIN,
  primaryDepartment: 'TAX',
  currentTenantId: 't1',
  availableTenants: ENTERPRISE_GROUP_TENANTS,
};

const getInitialAuthState = (): AuthState => {
  try {
    const savedUser = localStorage.getItem('TF_AUTH_USER');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      if (parsed && parsed.id) {
        return {
          user: parsed,
          isAuthenticated: true,
        };
      }
    }
  } catch (e) {
    console.error('Failed to load saved auth user:', e);
  }

  return {
    user: defaultEnterpriseUser,
    isAuthenticated: true,
  };
};

const initialAuthState: AuthState = getInitialAuthState();

const authSlice = createSlice({
  name: 'auth',
  initialState: initialAuthState,
  reducers: {
    login: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      try {
        localStorage.setItem('TF_AUTH_USER', JSON.stringify(action.payload));
      } catch (e) {}
    },
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      try {
        localStorage.removeItem('TF_AUTH_USER');
      } catch (e) {}
    },
    switchRole: (state, action: PayloadAction<UserRole>) => {
      if (state.user) {
        state.user.role = action.payload;
        if (action.payload === UserRole.ADMIN || action.payload === UserRole.SUPER_ADMIN) {
          state.user.name = 'Vikram Malhotra (CFO / Admin)';
          state.user.email = 'admin@taxflow.com';
        } else if (action.payload === UserRole.FINANCE_MANAGER) {
          state.user.name = 'Anish Kapoor (Finance Manager)';
          state.user.email = 'finance.manager@taxflow.com';
        } else if (action.payload === UserRole.ACCOUNTANT) {
          state.user.name = 'Rohan Verma (Senior Accountant)';
          state.user.email = 'accountant@taxflow.com';
        } else if (action.payload === UserRole.AUDITOR) {
          state.user.name = 'Priya Nair (Tax Auditor)';
          state.user.email = 'auditor@taxflow.com';
        } else if (action.payload === UserRole.VIEWER) {
          state.user.name = 'Kavita Sen (Executive Viewer)';
          state.user.email = 'viewer@taxflow.com';
        }
        try {
          localStorage.setItem('TF_AUTH_USER', JSON.stringify(state.user));
        } catch (e) {}
      }
    },
    switchUserPersona: (state, action: PayloadAction<{ name: string; email: string; role: UserRole }>) => {
      if (state.user) {
        state.user.role = action.payload.role;
        state.user.name = action.payload.name;
        state.user.email = action.payload.email;
        try {
          localStorage.setItem('TF_AUTH_USER', JSON.stringify(state.user));
        } catch (e) {}
      }
    },
    switchTenant: (state, action: PayloadAction<string>) => {
      if (state.user) {
        // Verify user has access to this tenant
        const hasAccess = state.user.availableTenants.some(t => t.id === action.payload);
        if (hasAccess) {
          state.user.currentTenantId = action.payload;
          try {
            localStorage.setItem('TF_AUTH_USER', JSON.stringify(state.user));
          } catch (e) {}
        }
      }
    },
    updateProfile: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        try {
          localStorage.setItem('TF_AUTH_USER', JSON.stringify(state.user));
        } catch (e) {}
      }
    },
    addTenant: (state, action: PayloadAction<Tenant>) => {
      if (state.user) {
        state.user.availableTenants.push(action.payload);
        try {
          localStorage.setItem('TF_AUTH_USER', JSON.stringify(state.user));
        } catch (e) {}
      }
    }
  },
});

// --- ORGANIZATIONAL MULTI-GSTIN & BRANCH SLICE ---

interface OrgState {
  selectedGstin: string; // 'ALL' | specific GSTIN (e.g. '27ABCDE1234F1Z5')
  selectedBranchId: string; // 'ALL' | specific branch ID (e.g. 'b1')
  gstinsByTenant: Record<string, GstinRegistrationItem[]>;
  branchesByTenant: Record<string, BranchDetailsItem[]>;
}

const defaultGstins: Record<string, GstinRegistrationItem[]> = ENTERPRISE_GSTINS_BY_TENANT;
const defaultBranches: Record<string, BranchDetailsItem[]> = ENTERPRISE_BRANCHES_BY_TENANT;

const getInitialOrgState = (): OrgState => {
  try {
    const savedGstins = localStorage.getItem('TF_ORG_GSTINS');
    const savedBranches = localStorage.getItem('TF_ORG_BRANCHES');
    const savedSelectedGstin = localStorage.getItem('TF_SELECTED_GSTIN') || 'ALL';
    const savedSelectedBranch = localStorage.getItem('TF_SELECTED_BRANCH') || 'ALL';

    const parsedGstins = savedGstins ? JSON.parse(savedGstins) : {};
    const parsedBranches = savedBranches ? JSON.parse(savedBranches) : {};

    return {
      selectedGstin: savedSelectedGstin,
      selectedBranchId: savedSelectedBranch,
      gstinsByTenant: { ...defaultGstins, ...parsedGstins },
      branchesByTenant: { ...defaultBranches, ...parsedBranches }
    };
  } catch (e) {
    return {
      selectedGstin: 'ALL',
      selectedBranchId: 'ALL',
      gstinsByTenant: defaultGstins,
      branchesByTenant: defaultBranches
    };
  }
};

const initialOrgState: OrgState = getInitialOrgState();

const orgSlice = createSlice({
  name: 'org',
  initialState: initialOrgState,
  reducers: {
    setSelectedGstin: (state, action: PayloadAction<string>) => {
      state.selectedGstin = action.payload;
      try {
        localStorage.setItem('TF_SELECTED_GSTIN', action.payload);
      } catch (e) {}
    },
    setSelectedBranch: (state, action: PayloadAction<string>) => {
      state.selectedBranchId = action.payload;
      try {
        localStorage.setItem('TF_SELECTED_BRANCH', action.payload);
      } catch (e) {}
    },
    setGstinsForTenant: (state, action: PayloadAction<{ tenantId: string; gstins: GstinRegistrationItem[] }>) => {
      state.gstinsByTenant[action.payload.tenantId] = action.payload.gstins;
      try {
        localStorage.setItem('TF_ORG_GSTINS', JSON.stringify(state.gstinsByTenant));
      } catch (e) {}
    },
    setBranchesForTenant: (state, action: PayloadAction<{ tenantId: string; branches: BranchDetailsItem[] }>) => {
      state.branchesByTenant[action.payload.tenantId] = action.payload.branches;
      try {
        localStorage.setItem('TF_ORG_BRANCHES', JSON.stringify(state.branchesByTenant));
      } catch (e) {}
    },
    addGstinRegistration: (state, action: PayloadAction<{ tenantId: string; gstin: GstinRegistrationItem }>) => {
      const { tenantId, gstin } = action.payload;
      if (!state.gstinsByTenant[tenantId]) {
        state.gstinsByTenant[tenantId] = [];
      }
      state.gstinsByTenant[tenantId].push(gstin);
      try {
        localStorage.setItem('TF_ORG_GSTINS', JSON.stringify(state.gstinsByTenant));
      } catch (e) {}
    },
    addBranch: (state, action: PayloadAction<{ tenantId: string; branch: BranchDetailsItem }>) => {
      const { tenantId, branch } = action.payload;
      if (!state.branchesByTenant[tenantId]) {
        state.branchesByTenant[tenantId] = [];
      }
      state.branchesByTenant[tenantId].push(branch);
      try {
        localStorage.setItem('TF_ORG_BRANCHES', JSON.stringify(state.branchesByTenant));
      } catch (e) {}
    },
    deleteGstinRegistration: (state, action: PayloadAction<{ tenantId: string; gstinId: string }>) => {
      const { tenantId, gstinId } = action.payload;
      if (state.gstinsByTenant[tenantId]) {
        state.gstinsByTenant[tenantId] = state.gstinsByTenant[tenantId].filter(g => g.id !== gstinId);
        try {
          localStorage.setItem('TF_ORG_GSTINS', JSON.stringify(state.gstinsByTenant));
        } catch (e) {}
      }
    },
    deleteBranch: (state, action: PayloadAction<{ tenantId: string; branchId: string }>) => {
      const { tenantId, branchId } = action.payload;
      if (state.branchesByTenant[tenantId]) {
        state.branchesByTenant[tenantId] = state.branchesByTenant[tenantId].filter(b => b.id !== branchId);
        try {
          localStorage.setItem('TF_ORG_BRANCHES', JSON.stringify(state.branchesByTenant));
        } catch (e) {}
      }
    }
  },
  extraReducers: (builder) => {
    builder.addCase(authSlice.actions.switchTenant, (state) => {
      // When switching tenant, reset selectedGstin to ALL so the user sees aggregate or they can pick specific GSTIN
      state.selectedGstin = 'ALL';
      state.selectedBranchId = 'ALL';
      try {
        localStorage.setItem('TF_SELECTED_GSTIN', 'ALL');
        localStorage.setItem('TF_SELECTED_BRANCH', 'ALL');
      } catch (e) {}
    });
  }
});

export const { login, logout, switchRole, switchUserPersona, switchTenant, updateProfile, addTenant } = authSlice.actions;
export const { 
  setSelectedGstin, 
  setSelectedBranch, 
  setGstinsForTenant, 
  setBranchesForTenant, 
  addGstinRegistration, 
  addBranch,
  deleteGstinRegistration,
  deleteBranch 
} = orgSlice.actions;

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    org: orgSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;