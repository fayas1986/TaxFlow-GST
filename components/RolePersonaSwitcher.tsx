import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, switchRole } from '../store/store';
import { UserRole } from '../types';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  UserCheck, 
  Users, 
  Check, 
  ChevronDown, 
  Sparkles, 
  Key, 
  Lock, 
  Eye, 
  FileEdit, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  X,
  ExternalLink
} from 'lucide-react';

interface RolePersonaSwitcherProps {
  onNavigate?: (path: string) => void;
}

interface RoleConfig {
  role: UserRole;
  label: string;
  shortLabel: string;
  defaultUserName: string;
  defaultEmail: string;
  colorScheme: {
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    accentColor: string;
    iconBg: string;
  };
  department: string;
  workflowScope: string;
  powers: string[];
  restrictions: string[];
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  [UserRole.SUPER_ADMIN]: {
    role: UserRole.SUPER_ADMIN,
    label: 'Super Admin (System Architect)',
    shortLabel: 'Super Admin',
    defaultUserName: 'Vikram Malhotra (Super Admin)',
    defaultEmail: 'superadmin@taxflow.com',
    colorScheme: {
      badgeBg: 'bg-purple-50',
      badgeText: 'text-purple-700',
      badgeBorder: 'border-purple-200',
      accentColor: 'text-purple-600',
      iconBg: 'bg-purple-100'
    },
    department: 'Enterprise IT & Governance',
    workflowScope: 'Unrestricted global sovereignty, system parameters, multi-tenant & API gateway configuration.',
    powers: [
      'Full CRUD across all 25+ enterprise modules',
      'System Settings & Master Integrations config',
      'Override approval hierarchies & sign-offs',
      'Full raw audit logs & immutable ledger inspection'
    ],
    restrictions: ['None (Superuser privilege)']
  },
  [UserRole.ADMIN]: {
    role: UserRole.ADMIN,
    label: 'Enterprise Admin / CFO',
    shortLabel: 'Enterprise Admin',
    defaultUserName: 'Vikram Malhotra (CFO / Admin)',
    defaultEmail: 'admin@taxflow.com',
    colorScheme: {
      badgeBg: 'bg-slate-900',
      badgeText: 'text-white',
      badgeBorder: 'border-slate-800',
      accentColor: 'text-slate-900',
      iconBg: 'bg-slate-800'
    },
    department: 'Executive Finance & Tax Head',
    workflowScope: 'Complete business & tax administration, Tier-2 executive sign-off, system integrations.',
    powers: [
      'Authorize high-value statutory returns (> ₹1,00,000)',
      'Manage organization entities, GSTINs & branches',
      'ERP integrations & webhook configuration',
      'Security audit logs & system preferences'
    ],
    restrictions: ['Cannot bypass immutable multi-factor signatures']
  },
  [UserRole.FINANCE_MANAGER]: {
    role: UserRole.FINANCE_MANAGER,
    label: 'Finance Manager / Signatory',
    shortLabel: 'Finance Manager',
    defaultUserName: 'Anish Kapoor (Finance Manager)',
    defaultEmail: 'finance.manager@taxflow.com',
    colorScheme: {
      badgeBg: 'bg-indigo-50',
      badgeText: 'text-indigo-700',
      badgeBorder: 'border-indigo-200',
      accentColor: 'text-indigo-600',
      iconBg: 'bg-indigo-100'
    },
    department: 'Corporate Tax & Treasury',
    workflowScope: 'Tier-1 & Tier-2 review, tax liability sign-off, statutory return authorization & tax forecasting.',
    powers: [
      'Approve & sign-off GSTR-1, GSTR-3B & refund requests',
      'Access Tax Forecasting & Predictive Liabilities',
      'Authorize invoice release & e-way bill generation',
      'Manage entity branches & party master governance'
    ],
    restrictions: ['Cannot modify direct system API keys or raw integration webhooks']
  },
  [UserRole.ACCOUNTANT]: {
    role: UserRole.ACCOUNTANT,
    label: 'Senior Tax Accountant / Preparer',
    shortLabel: 'Tax Accountant',
    defaultUserName: 'Rohan Verma (Senior Accountant)',
    defaultEmail: 'accountant@taxflow.com',
    colorScheme: {
      badgeBg: 'bg-emerald-50',
      badgeText: 'text-emerald-700',
      badgeBorder: 'border-emerald-200',
      accentColor: 'text-emerald-600',
      iconBg: 'bg-emerald-100'
    },
    department: 'Tax Operations & Compliance',
    workflowScope: 'Operational tax accounting, data entry, reconciliation, drafting returns and submitting for approval.',
    powers: [
      'Create and edit sales & purchase invoices',
      'Generate E-Invoices (IRN) & E-Way Bills',
      'Run 2A/2B Automated Reconciliation & fix breaks',
      'Prepare draft GSTR-1 / GSTR-3B computations & raise approval packets'
    ],
    restrictions: [
      'Cannot approve high-value returns or execute live GSTN payment',
      'Restricted from system settings, integrations & audit log management'
    ]
  },
  [UserRole.AUDITOR]: {
    role: UserRole.AUDITOR,
    label: 'Statutory / Internal Auditor',
    shortLabel: 'Tax Auditor',
    defaultUserName: 'Priya Nair (Tax Auditor)',
    defaultEmail: 'auditor@taxflow.com',
    colorScheme: {
      badgeBg: 'bg-amber-50',
      badgeText: 'text-amber-800',
      badgeBorder: 'border-amber-200',
      accentColor: 'text-amber-600',
      iconBg: 'bg-amber-100'
    },
    department: 'Independent Internal & Statutory Audit',
    workflowScope: 'Non-disruptive compliance oversight, audit trail verification, anomaly observation & risk analysis.',
    powers: [
      'Inspect tamper-proof audit trails & electronic logs',
      'Access Compliance Archive, Regulatory Intelligence & Risk Dashboard',
      'Attach independent Auditor Remarks & Observations to approval requests',
      'Download SOC-2 & GSTN compliance reports'
    ],
    restrictions: [
      'Strictly Read-Only for operational transactions',
      'Cannot create invoices, modify ledgers or submit statutory filings'
    ]
  },
  [UserRole.VIEWER]: {
    role: UserRole.VIEWER,
    label: 'Executive Stakeholder / Viewer',
    shortLabel: 'Executive Viewer',
    defaultUserName: 'Kavita Sen (Executive Viewer)',
    defaultEmail: 'viewer@taxflow.com',
    colorScheme: {
      badgeBg: 'bg-sky-50',
      badgeText: 'text-sky-700',
      badgeBorder: 'border-sky-200',
      accentColor: 'text-sky-600',
      iconBg: 'bg-sky-100'
    },
    department: 'Board & Executive Oversight',
    workflowScope: 'High-level business analytics, executive dashboards, rates lookup and summary reporting.',
    powers: [
      'View Control Tower, Executive Dashboard & Tax Rates',
      'Access read-only analytics, refund statuses & summary reports'
    ],
    restrictions: [
      'Strictly Read-Only across all modules',
      'No access to approval workflows, calculations, filings, or settings'
    ]
  }
};

export const RolePersonaSwitcher: React.FC<RolePersonaSwitcherProps> = ({ onNavigate }) => {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const [isOpen, setIsOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentRole = user?.role || UserRole.ADMIN;
  const activeConfig = ROLE_CONFIGS[currentRole] || ROLE_CONFIGS[UserRole.ADMIN];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRoleSelect = (role: UserRole) => {
    dispatch(switchRole(role));
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Real-time Role Switcher Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-full border transition-all shadow-xs group select-none ${activeConfig.colorScheme.badgeBg} ${activeConfig.colorScheme.badgeBorder} ${activeConfig.colorScheme.badgeText} hover:ring-2 hover:ring-indigo-100`}
        title="Real-time Role & Workflow Persona Selector"
      >
        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
          currentRole === UserRole.ADMIN 
            ? 'bg-slate-800 text-white' 
            : activeConfig.colorScheme.iconBg
        }`}>
          <Shield size={13} className={currentRole === UserRole.ADMIN ? 'text-blue-400' : activeConfig.colorScheme.accentColor} />
        </div>

        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black tracking-tight leading-none">
              {activeConfig.shortLabel}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Active RBAC State" />
          </div>
          <span className="text-[9px] opacity-75 font-mono leading-none mt-0.5 uppercase tracking-wider">
            Realtime RBAC
          </span>
        </div>

        <ChevronDown size={13} className="opacity-60 group-hover:opacity-100 transition-opacity ml-0.5" />
      </button>

      {/* Role Selector Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-3 w-88 bg-white rounded-2xl shadow-2xl border border-slate-100 py-3 animate-in fade-in zoom-in-95 duration-150 origin-top-right ring-1 ring-black/5 z-[9999]">
          <div className="px-4 pb-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                Real-Time Role Switcher
              </span>
              <p className="text-[11px] text-slate-500 font-medium">
                Test and simulate different organizational roles
              </p>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                setIsDetailModalOpen(true);
              }}
              className="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold flex items-center gap-1 hover:underline"
              title="View Complete RBAC Governance Matrix"
            >
              <HelpCircle size={13} />
              Policy Info
            </button>
          </div>

          <div className="p-2 space-y-1 max-h-[360px] overflow-y-auto">
            {Object.values(ROLE_CONFIGS).map((config) => {
              const isSelected = config.role === currentRole;
              return (
                <button
                  key={config.role}
                  onClick={() => handleRoleSelect(config.role)}
                  className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-3 border ${
                    isSelected 
                      ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950 shadow-xs' 
                      : 'hover:bg-slate-50 border-transparent text-slate-700'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${config.colorScheme.iconBg}`}>
                    <Shield size={16} className={config.colorScheme.accentColor} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {config.label}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] bg-indigo-600 text-white font-black px-1.5 py-0.2 rounded-full uppercase">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      {config.department}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                      {config.defaultEmail}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-mono">
              Role switches sync instantly to Redux & Router
            </span>
            {onNavigate && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onNavigate('/approvals');
                }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                Approvals & RBAC <ExternalLink size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* RBAC Governance Policy Details Modal */}
      {isDetailModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99999] animate-in fade-in duration-200">
          <div className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Enterprise Role & Workflow Governance</h3>
                  <p className="text-xs text-slate-300">Real-time RBAC boundary definitions across all TaxFlow modules</p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-relaxed font-medium">
                <strong>Real-Time Access Control:</strong> When you switch roles in the header, the entire application immediately updates its navigation menu, route protections, inline edit permissions, approval review actions, and filing triggers without needing a session restart.
              </div>

              <div className="space-y-3">
                {Object.values(ROLE_CONFIGS).map(cfg => (
                  <div key={cfg.role} className={`p-4 rounded-xl border ${cfg.role === currentRole ? 'bg-slate-50 border-indigo-300 ring-2 ring-indigo-50' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-extrabold uppercase ${cfg.colorScheme.badgeBg} ${cfg.colorScheme.badgeText}`}>
                          {cfg.label}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">({cfg.department})</span>
                      </div>
                      {cfg.role === currentRole ? (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check size={11} /> CURRENT ACTIVE
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            dispatch(switchRole(cfg.role));
                            setIsDetailModalOpen(false);
                          }}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          Switch to this role →
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 mb-2 leading-relaxed">
                      {cfg.workflowScope}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2.5 bg-emerald-50/60 border border-emerald-100 rounded-lg">
                        <span className="font-bold text-emerald-900 block mb-1">Key Workflow Powers:</span>
                        <ul className="space-y-1 text-emerald-800">
                          {cfg.powers.map((p, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <CheckCircle2 size={12} className="text-emerald-600 shrink-0 mt-0.5" />
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-2.5 bg-rose-50/60 border border-rose-100 rounded-lg">
                        <span className="font-bold text-rose-900 block mb-1">Workflow Restrictions:</span>
                        <ul className="space-y-1 text-rose-800">
                          {cfg.restrictions.map((r, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <AlertCircle size={12} className="text-rose-600 shrink-0 mt-0.5" />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all"
              >
                Close Governance Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
