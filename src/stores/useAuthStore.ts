import { create } from 'zustand';
import { User, Tenant, UserRole } from '../../types';
import { ENTERPRISE_GROUP_TENANTS } from '../fixtures/enterpriseTenants';
import { safeStorage } from '../../utils/safeStorage';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;

  login: (user: User) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  switchUserPersona: (persona: { name: string; email: string; role: UserRole }) => void;
  switchTenant: (tenantId: string) => void;
  updateProfile: (profile: Partial<User>) => void;
  addTenant: (tenant: Tenant) => void;
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

const getInitialUser = (): { user: User | null; isAuthenticated: boolean } => {
  try {
    const savedUser = safeStorage.getItem('TF_AUTH_USER');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      if (parsed && parsed.id) {
        return { user: parsed, isAuthenticated: true };
      }
    }
  } catch (e) {
    console.error('Failed to load saved auth user:', e);
  }
  return { user: defaultEnterpriseUser, isAuthenticated: true };
};

const initial = getInitialUser();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initial.user,
  isAuthenticated: initial.isAuthenticated,

  login: (user: User) => {
    safeStorage.setItem('TF_AUTH_USER', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    safeStorage.removeItem('TF_AUTH_USER');
    set({ user: null, isAuthenticated: false });
  },

  switchRole: (role: UserRole) => {
    const currentUser = get().user;
    if (!currentUser) return;

    const updated = { ...currentUser, role };
    if (role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN) {
      updated.name = 'Vikram Malhotra (CFO / Admin)';
      updated.email = 'admin@taxflow.com';
    } else if (role === UserRole.FINANCE_MANAGER) {
      updated.name = 'Anish Kapoor (Finance Manager)';
      updated.email = 'finance.manager@taxflow.com';
    } else if (role === UserRole.ACCOUNTANT) {
      updated.name = 'Rohan Verma (Senior Accountant)';
      updated.email = 'accountant@taxflow.com';
    } else if (role === UserRole.AUDITOR) {
      updated.name = 'Priya Nair (Tax Auditor)';
      updated.email = 'auditor@taxflow.com';
    } else if (role === UserRole.VIEWER) {
      updated.name = 'Kavita Sen (Executive Viewer)';
      updated.email = 'viewer@taxflow.com';
    } else if (role === UserRole.CUSTOMER) {
      updated.name = 'Ananya Sen (Client Representative)';
      updated.email = 'client@acmeventures.com';
    }

    safeStorage.setItem('TF_AUTH_USER', JSON.stringify(updated));
    set({ user: updated });
  },

  switchUserPersona: (persona) => {
    const currentUser = get().user;
    if (!currentUser) return;

    const updated = { ...currentUser, role: persona.role, name: persona.name, email: persona.email };
    safeStorage.setItem('TF_AUTH_USER', JSON.stringify(updated));
    set({ user: updated });
  },

  switchTenant: (tenantId: string) => {
    const currentUser = get().user;
    if (!currentUser) return;

    const hasAccess = currentUser.availableTenants.some((t) => t.id === tenantId);
    if (hasAccess) {
      const updated = { ...currentUser, currentTenantId: tenantId };
      safeStorage.setItem('TF_AUTH_USER', JSON.stringify(updated));
      set({ user: updated });
    }
  },

  updateProfile: (profilePartial) => {
    const currentUser = get().user;
    if (!currentUser) return;

    const updated = { ...currentUser, ...profilePartial };
    safeStorage.setItem('TF_AUTH_USER', JSON.stringify(updated));
    set({ user: updated });
  },

  addTenant: (newTenant: Tenant) => {
    const currentUser = get().user;
    if (!currentUser) return;

    const updatedTenants = [...currentUser.availableTenants, newTenant];
    const updated = { ...currentUser, availableTenants: updatedTenants };
    safeStorage.setItem('TF_AUTH_USER', JSON.stringify(updated));
    set({ user: updated });
  },
}));
