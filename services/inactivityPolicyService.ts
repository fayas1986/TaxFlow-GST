// Departmental Session Inactivity Policy Management Service
// Allows Admins to define custom session inactivity thresholds, warning durations, 
// and security lock mechanisms per department (Finance, Tax, Audit, Operations, etc.)

import { DepartmentCode } from '../types';

export interface DepartmentInactivityPolicy {
  departmentCode: DepartmentCode | 'DEFAULT_GLOBAL';
  departmentName: string;
  inactivityTimeoutMinutes: number; // Inactivity threshold in minutes (1 to 120)
  warningDurationSeconds: number; // Countdown warning duration in seconds (15 to 300)
  enforcePasswordReauth: boolean; // Require password/PIN to unlock session
  autoSaveDraftsOnLock: boolean; // Automatically persist un-saved forms/inputs on lock
  isEnabled: boolean; // Policy master toggle
  riskLevel: 'HIGH_STRICT' | 'STANDARD' | 'LENIENT';
  updatedAt: string;
  updatedBy: string;
  description: string;
  maxExtensionsAllowed: number; // Max session extensions allowed before forcing fresh login
}

export interface InactivityPolicyPreset {
  id: string;
  name: string;
  badge: string;
  timeoutMinutes: number;
  warningSeconds: number;
  enforceReauth: boolean;
  description: string;
}

export interface PolicyChangeAuditLog {
  id: string;
  timestamp: string;
  actorName: string;
  departmentCode: string;
  action: string;
  oldTimeoutMinutes: number;
  newTimeoutMinutes: number;
  details: string;
}

const STORAGE_KEY = 'TF_INACTIVITY_DEPARTMENT_POLICIES_v1';
const AUDIT_STORAGE_KEY = 'TF_INACTIVITY_POLICY_AUDIT_LOGS_v1';

// Preset Templates
export const INACTIVITY_PRESETS: InactivityPolicyPreset[] = [
  {
    id: 'BANKING_STRICT',
    name: 'Banking & High Compliance Standard',
    badge: '5 Mins • Strict',
    timeoutMinutes: 5,
    warningSeconds: 30,
    enforceReauth: true,
    description: 'Mandatory for high-value financial execution, audit logging, and sensitive tax filing access.'
  },
  {
    id: 'STANDARD_ENTERPRISE',
    name: 'Standard Enterprise Policy',
    badge: '14 Mins • Balanced',
    timeoutMinutes: 14,
    warningSeconds: 60,
    enforceReauth: false,
    description: 'Balanced security threshold suitable for daily accounting, invoice entry, and reconciliation.'
  },
  {
    id: 'FLEXIBLE_OPERATIONS',
    name: 'Extended Operations & Field Policy',
    badge: '30 Mins • Lenient',
    timeoutMinutes: 30,
    warningSeconds: 120,
    enforceReauth: false,
    description: 'Optimized for high-volume invoice scanning, warehouse dispatch, and vendor onboarding.'
  }
];

// Initial Default Policies for all departments
const DEFAULT_POLICIES: DepartmentInactivityPolicy[] = [
  {
    departmentCode: 'FINANCE',
    departmentName: 'Finance & Treasury',
    inactivityTimeoutMinutes: 10,
    warningDurationSeconds: 60,
    enforcePasswordReauth: true,
    autoSaveDraftsOnLock: true,
    isEnabled: true,
    riskLevel: 'HIGH_STRICT',
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Security Admin',
    description: 'Strict 10-minute lock policy to protect cash disbursements and bank reconciliations.',
    maxExtensionsAllowed: 3
  },
  {
    departmentCode: 'TAX',
    departmentName: 'GST Tax Compliance',
    inactivityTimeoutMinutes: 10,
    warningDurationSeconds: 60,
    enforcePasswordReauth: true,
    autoSaveDraftsOnLock: true,
    isEnabled: true,
    riskLevel: 'HIGH_STRICT',
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Security Admin',
    description: 'High protection for GSTR-1 & GSTR-3B filing sessions and e-Way bill authorization.',
    maxExtensionsAllowed: 3
  },
  {
    departmentCode: 'AUDIT',
    departmentName: 'Audit & Legal Controls',
    inactivityTimeoutMinutes: 5,
    warningDurationSeconds: 30,
    enforcePasswordReauth: true,
    autoSaveDraftsOnLock: true,
    isEnabled: true,
    riskLevel: 'HIGH_STRICT',
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Security Admin',
    description: 'Banking grade 5-minute strict timeout for un-tampered audit evidence inspection.',
    maxExtensionsAllowed: 2
  },
  {
    departmentCode: 'TREASURY',
    departmentName: 'Treasury & Cash Management',
    inactivityTimeoutMinutes: 8,
    warningDurationSeconds: 45,
    enforcePasswordReauth: true,
    autoSaveDraftsOnLock: true,
    isEnabled: true,
    riskLevel: 'HIGH_STRICT',
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Security Admin',
    description: 'Protects fund transfer pipelines and banking ledger views.',
    maxExtensionsAllowed: 3
  },
  {
    departmentCode: 'OPERATIONS',
    departmentName: 'Operations & Dispatch',
    inactivityTimeoutMinutes: 20,
    warningDurationSeconds: 90,
    enforcePasswordReauth: false,
    autoSaveDraftsOnLock: true,
    isEnabled: true,
    riskLevel: 'LENIENT',
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Security Admin',
    description: 'Lenient 20-minute threshold to prevent disruptions during warehouse entry.',
    maxExtensionsAllowed: 5
  },
  {
    departmentCode: 'SALES',
    departmentName: 'Sales & Billing',
    inactivityTimeoutMinutes: 25,
    warningDurationSeconds: 90,
    enforcePasswordReauth: false,
    autoSaveDraftsOnLock: true,
    isEnabled: true,
    riskLevel: 'LENIENT',
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Security Admin',
    description: 'Permits continuous customer invoice generation and POS terminal activity.',
    maxExtensionsAllowed: 5
  },
  {
    departmentCode: 'PROCUREMENT',
    departmentName: 'Procurement & Vendor Desk',
    inactivityTimeoutMinutes: 15,
    warningDurationSeconds: 60,
    enforcePasswordReauth: false,
    autoSaveDraftsOnLock: true,
    isEnabled: true,
    riskLevel: 'STANDARD',
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Security Admin',
    description: 'Standard 15-minute policy for PO creation and vendor invoice matching.',
    maxExtensionsAllowed: 4
  },
  {
    departmentCode: 'HR_ADMIN',
    departmentName: 'HR & Platform Administration',
    inactivityTimeoutMinutes: 12,
    warningDurationSeconds: 60,
    enforcePasswordReauth: true,
    autoSaveDraftsOnLock: true,
    isEnabled: true,
    riskLevel: 'STANDARD',
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Security Admin',
    description: 'Secures employee PII and system configuration interfaces.',
    maxExtensionsAllowed: 4
  },
  {
    departmentCode: 'DEFAULT_GLOBAL',
    departmentName: 'Default Fallback Policy',
    inactivityTimeoutMinutes: 14,
    warningDurationSeconds: 60,
    enforcePasswordReauth: false,
    autoSaveDraftsOnLock: true,
    isEnabled: true,
    riskLevel: 'STANDARD',
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Security Admin',
    description: 'Global fallback policy applied to unassigned or guest users.',
    maxExtensionsAllowed: 4
  }
];

// Memory cache
let inMemoryPolicies: DepartmentInactivityPolicy[] | null = null;
let inMemoryAuditLogs: PolicyChangeAuditLog[] | null = null;

export const loadDepartmentInactivityPolicies = (): DepartmentInactivityPolicy[] => {
  if (inMemoryPolicies) return inMemoryPolicies;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: DepartmentInactivityPolicy[] = JSON.parse(raw);
      // Ensure all standard departments exist in loaded state
      const merged = DEFAULT_POLICIES.map(def => {
        const found = parsed.find(p => p.departmentCode === def.departmentCode);
        return found ? { ...def, ...found } : def;
      });
      inMemoryPolicies = merged;
      return merged;
    }
  } catch (e) {
    console.error('Failed to load inactivity policies from storage:', e);
  }

  inMemoryPolicies = [...DEFAULT_POLICIES];
  return inMemoryPolicies;
};

export const getPolicyForDepartment = (deptCode?: DepartmentCode | string): DepartmentInactivityPolicy => {
  const policies = loadDepartmentInactivityPolicies();
  if (!deptCode) {
    return policies.find(p => p.departmentCode === 'DEFAULT_GLOBAL') || DEFAULT_POLICIES[DEFAULT_POLICIES.length - 1];
  }

  const match = policies.find(p => p.departmentCode === deptCode && p.isEnabled);
  if (match) return match;

  return policies.find(p => p.departmentCode === 'DEFAULT_GLOBAL') || DEFAULT_POLICIES[DEFAULT_POLICIES.length - 1];
};

export const saveDepartmentInactivityPolicy = (
  updatedPolicy: DepartmentInactivityPolicy,
  actorName: string = 'Security Admin'
): DepartmentInactivityPolicy[] => {
  const current = loadDepartmentInactivityPolicies();
  const existingIndex = current.findIndex(p => p.departmentCode === updatedPolicy.departmentCode);

  const oldTimeout = existingIndex !== -1 ? current[existingIndex].inactivityTimeoutMinutes : updatedPolicy.inactivityTimeoutMinutes;

  const policyToSave: DepartmentInactivityPolicy = {
    ...updatedPolicy,
    updatedAt: new Date().toISOString(),
    updatedBy: actorName
  };

  let newPolicies: DepartmentInactivityPolicy[];
  if (existingIndex !== -1) {
    newPolicies = [...current];
    newPolicies[existingIndex] = policyToSave;
  } else {
    newPolicies = [...current, policyToSave];
  }

  inMemoryPolicies = newPolicies;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPolicies));
  } catch (e) {
    console.error('Failed to save inactivity policies:', e);
  }

  // Audit Log Entry
  addPolicyAuditLog({
    id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    actorName,
    departmentCode: updatedPolicy.departmentCode,
    action: `Updated Inactivity Threshold for ${updatedPolicy.departmentName}`,
    oldTimeoutMinutes: oldTimeout,
    newTimeoutMinutes: updatedPolicy.inactivityTimeoutMinutes,
    details: `Timeout set to ${updatedPolicy.inactivityTimeoutMinutes} mins (Warning: ${updatedPolicy.warningDurationSeconds}s, Re-auth: ${updatedPolicy.enforcePasswordReauth ? 'YES' : 'NO'}).`
  });

  // Notify active listeners (e.g., InactivityTracker component)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('inactivity-policy-updated', {
      detail: { departmentCode: updatedPolicy.departmentCode, policy: policyToSave }
    }));
  }

  return newPolicies;
};

export const applyPresetToAllDepartments = (
  preset: InactivityPolicyPreset,
  actorName: string = 'Security Admin'
): DepartmentInactivityPolicy[] => {
  const current = loadDepartmentInactivityPolicies();
  const updated = current.map(p => ({
    ...p,
    inactivityTimeoutMinutes: preset.timeoutMinutes,
    warningDurationSeconds: preset.warningSeconds,
    enforcePasswordReauth: preset.enforceReauth,
    updatedAt: new Date().toISOString(),
    updatedBy: actorName
  }));

  inMemoryPolicies = updated;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to apply preset to all departments:', e);
  }

  addPolicyAuditLog({
    id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    actorName,
    departmentCode: 'ALL_DEPARTMENTS',
    action: `Applied Bulk Preset: ${preset.name}`,
    oldTimeoutMinutes: 0,
    newTimeoutMinutes: preset.timeoutMinutes,
    details: `Bulk threshold applied: ${preset.timeoutMinutes} mins across all departments.`
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('inactivity-policy-updated', { detail: { bulk: true } }));
  }

  return updated;
};

export const resetInactivityPoliciesToDefault = (): DepartmentInactivityPolicy[] => {
  inMemoryPolicies = [...DEFAULT_POLICIES];
  localStorage.removeItem(STORAGE_KEY);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('inactivity-policy-updated', { detail: { reset: true } }));
  }

  return inMemoryPolicies;
};

export const loadPolicyAuditLogs = (): PolicyChangeAuditLog[] => {
  if (inMemoryAuditLogs) return inMemoryAuditLogs;
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (raw) {
      inMemoryAuditLogs = JSON.parse(raw);
      return inMemoryAuditLogs || [];
    }
  } catch (e) {
    console.error('Failed to load policy audit logs:', e);
  }
  inMemoryAuditLogs = [];
  return [];
};

const addPolicyAuditLog = (log: PolicyChangeAuditLog) => {
  const logs = loadPolicyAuditLogs();
  const updated = [log, ...logs].slice(0, 50); // Keep last 50 entries
  inMemoryAuditLogs = updated;
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to persist audit log:', e);
  }
};
