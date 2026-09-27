import { create } from 'zustand';
import { GstinRegistrationItem, BranchDetailsItem } from '../../types';
import { ENTERPRISE_GSTINS_BY_TENANT, ENTERPRISE_BRANCHES_BY_TENANT } from '../fixtures/enterpriseTenants';
import { safeStorage } from '../../utils/safeStorage';

interface OrgState {
  selectedGstin: string;
  selectedBranchId: string;
  gstinsByTenant: Record<string, GstinRegistrationItem[]>;
  branchesByTenant: Record<string, BranchDetailsItem[]>;

  setSelectedGstin: (gstin: string) => void;
  setSelectedBranch: (branchId: string) => void;
  setGstinsForTenant: (tenantId: string, gstins: GstinRegistrationItem[]) => void;
  setBranchesForTenant: (tenantId: string, branches: BranchDetailsItem[]) => void;
  addGstinRegistration: (tenantId: string, gstin: GstinRegistrationItem) => void;
  addBranch: (tenantId: string, branch: BranchDetailsItem) => void;
  deleteGstinRegistration: (tenantId: string, gstinId: string) => void;
  deleteBranch: (tenantId: string, branchId: string) => void;
  resetOrgSelections: () => void;
}

const getInitialOrgState = () => {
  try {
    const savedGstins = safeStorage.getItem('TF_ORG_GSTINS');
    const savedBranches = safeStorage.getItem('TF_ORG_BRANCHES');
    const savedSelectedGstin = safeStorage.getItem('TF_SELECTED_GSTIN') || 'ALL';
    const savedSelectedBranch = safeStorage.getItem('TF_SELECTED_BRANCH') || 'ALL';

    const parsedGstins = savedGstins ? JSON.parse(savedGstins) : {};
    const parsedBranches = savedBranches ? JSON.parse(savedBranches) : {};

    return {
      selectedGstin: savedSelectedGstin,
      selectedBranchId: savedSelectedBranch,
      gstinsByTenant: { ...ENTERPRISE_GSTINS_BY_TENANT, ...parsedGstins },
      branchesByTenant: { ...ENTERPRISE_BRANCHES_BY_TENANT, ...parsedBranches },
    };
  } catch (e) {
    return {
      selectedGstin: 'ALL',
      selectedBranchId: 'ALL',
      gstinsByTenant: ENTERPRISE_GSTINS_BY_TENANT,
      branchesByTenant: ENTERPRISE_BRANCHES_BY_TENANT,
    };
  }
};

const initial = getInitialOrgState();

export const useOrgStore = create<OrgState>((set, get) => ({
  selectedGstin: initial.selectedGstin,
  selectedBranchId: initial.selectedBranchId,
  gstinsByTenant: initial.gstinsByTenant,
  branchesByTenant: initial.branchesByTenant,

  setSelectedGstin: (gstin: string) => {
    safeStorage.setItem('TF_SELECTED_GSTIN', gstin);
    set({ selectedGstin: gstin });
  },

  setSelectedBranch: (branchId: string) => {
    safeStorage.setItem('TF_SELECTED_BRANCH', branchId);
    set({ selectedBranchId: branchId });
  },

  setGstinsForTenant: (tenantId: string, gstins: GstinRegistrationItem[]) => {
    const next = { ...get().gstinsByTenant, [tenantId]: gstins };
    safeStorage.setItem('TF_ORG_GSTINS', JSON.stringify(next));
    set({ gstinsByTenant: next });
  },

  setBranchesForTenant: (tenantId: string, branches: BranchDetailsItem[]) => {
    const next = { ...get().branchesByTenant, [tenantId]: branches };
    safeStorage.setItem('TF_ORG_BRANCHES', JSON.stringify(next));
    set({ branchesByTenant: next });
  },

  addGstinRegistration: (tenantId: string, gstin: GstinRegistrationItem) => {
    const current = get().gstinsByTenant[tenantId] || [];
    const next = { ...get().gstinsByTenant, [tenantId]: [...current, gstin] };
    safeStorage.setItem('TF_ORG_GSTINS', JSON.stringify(next));
    set({ gstinsByTenant: next });
  },

  addBranch: (tenantId: string, branch: BranchDetailsItem) => {
    const current = get().branchesByTenant[tenantId] || [];
    const next = { ...get().branchesByTenant, [tenantId]: [...current, branch] };
    safeStorage.setItem('TF_ORG_BRANCHES', JSON.stringify(next));
    set({ branchesByTenant: next });
  },

  deleteGstinRegistration: (tenantId: string, gstinId: string) => {
    const current = get().gstinsByTenant[tenantId] || [];
    const filtered = current.filter((g) => g.id !== gstinId);
    const next = { ...get().gstinsByTenant, [tenantId]: filtered };
    safeStorage.setItem('TF_ORG_GSTINS', JSON.stringify(next));
    set({ gstinsByTenant: next });
  },

  deleteBranch: (tenantId: string, branchId: string) => {
    const current = get().branchesByTenant[tenantId] || [];
    const filtered = current.filter((b) => b.id !== branchId);
    const next = { ...get().branchesByTenant, [tenantId]: filtered };
    safeStorage.setItem('TF_ORG_BRANCHES', JSON.stringify(next));
    set({ branchesByTenant: next });
  },

  resetOrgSelections: () => {
    safeStorage.setItem('TF_SELECTED_GSTIN', 'ALL');
    safeStorage.setItem('TF_SELECTED_BRANCH', 'ALL');
    set({ selectedGstin: 'ALL', selectedBranchId: 'ALL' });
  },
}));
