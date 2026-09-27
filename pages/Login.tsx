import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { login } from '../store/store';
import { performLogin } from '../services/api';
import { io } from 'socket.io-client';
import { 
  Building2, 
  ArrowRight, 
  Lock, 
  Mail, 
  ShieldCheck, 
  Crown, 
  Server, 
  ShieldAlert, 
  Layers, 
  Zap, 
  CheckCircle2, 
  ArrowUpRight,
  Database,
  Sparkles,
  Users,
  Check,
  Cpu,
  FileCheck2,
  TrendingUp,
  Shield,
  Calendar
} from 'lucide-react';
import { UserRole } from '../types';
import { entitlementService } from '../src/core/entitlements/entitlementService';
import { PlanCode, Plan, Feature, DEFAULT_PLANS_CATALOG } from '../src/core/entitlements/types';

interface LoginProps {
  onLoginSuccess?: (role?: UserRole) => void;
}

type LoginPortalMode = 'ORGANIZATION' | 'SUPER_ADMIN';

interface PlanOption {
  code: PlanCode;
  title: string;
  tagline: string;
  price: string;
  annualPriceInr: number;
  monthlyPriceInr: number;
  monthlyEquivalent: string;
  badge: string;
  color: string;
  activeBorder: string;
  activeBg: string;
  keyFeatures: string[];
  maxSeats: number;
}

const PLAN_VISUAL_META: Record<PlanCode, {
  badge: string;
  color: string;
  activeBorder: string;
  activeBg: string;
  defaultFeatures: string[];
}> = {
  [PlanCode.STARTER]: {
    badge: 'Starter',
    color: 'text-sky-600',
    activeBorder: 'border-sky-500 ring-2 ring-sky-500/20',
    activeBg: 'bg-sky-50/60',
    defaultFeatures: ['Invoicing & Purchases', 'GSTR-1 & 3B Filing', 'Tax Rate Calculator', 'Basic Reports']
  },
  [PlanCode.BUSINESS]: {
    badge: 'Popular',
    color: 'text-indigo-600',
    activeBorder: 'border-indigo-500 ring-2 ring-indigo-500/20',
    activeBg: 'bg-indigo-50/60',
    defaultFeatures: ['E-Way Bill Logistics', 'Auto 2B Reconciliation', 'ITC Optimization', 'Multi-Branch Network']
  },
  [PlanCode.PROFESSIONAL]: {
    badge: 'Advanced',
    color: 'text-purple-600',
    activeBorder: 'border-purple-500 ring-2 ring-purple-500/20',
    activeBg: 'bg-purple-50/60',
    defaultFeatures: ['IRP E-Invoicing + QR', 'Multi-GSTIN Consolidation', 'Compliance Automation', 'Granular RBAC']
  },
  [PlanCode.ENTERPRISE]: {
    badge: 'Full Suite',
    color: 'text-emerald-600',
    activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/20',
    activeBg: 'bg-emerald-50/60',
    defaultFeatures: ['AI Risk & Forecasting', 'SAP / Oracle / Tally ERP', 'Regulatory Intelligence', 'REST APIs & Webhooks']
  },
  [PlanCode.ENTERPRISE_PLUS]: {
    badge: 'Dedicated',
    color: 'text-amber-600',
    activeBorder: 'border-amber-500 ring-2 ring-amber-500/20',
    activeBg: 'bg-amber-50/60',
    defaultFeatures: ['Dedicated Postgres Cluster', 'Unlimited Scale & Seats', '24/7 SLA Guarantee', 'Custom AI Fine-Tuning']
  }
};

const FEATURE_LABELS: Record<string, string> = {
  invoices: 'Invoicing & Purchases',
  purchases: 'Purchase Register',
  e_invoice: 'IRP E-Invoicing + QR',
  eway_bill: 'E-Way Bill Logistics',
  gst_returns: 'GSTR-1 & 3B Filing',
  reconciliation: 'Auto 2B Reconciliation',
  itc: 'ITC Optimization',
  ai: 'GenAI Tax Assistant & Co-Pilot',
  automation: 'Compliance Automation',
  multi_gstin: 'Multi-GSTIN Consolidation',
  multi_branch: 'Multi-Branch Network',
  erp_integration: 'SAP / Oracle / Tally ERP',
  api: 'REST APIs & Webhooks',
  webhooks: 'Real-Time Event Webhooks',
  advanced_rbac: 'Granular RBAC',
  audit_logs: 'Audit Logs & Trails',
  cloud_backups: 'Cloud Vault Backups',
  whatsapp_alerts: 'Twilio WhatsApp Alerts',
  database_sync: 'Postgres Database Sync'
};

interface DemoRoleProfile {
  email: string;
  role: UserRole;
  title: string;
  badge: string;
  description: string;
}

const PLAN_DEMO_ROLES: Record<PlanCode, { maxSeatsText: string; roles: DemoRoleProfile[]; upgradeHint?: string }> = {
  [PlanCode.STARTER]: {
    maxSeatsText: '2 Seats Included',
    upgradeHint: 'Auditor & Granular RBAC available in Professional & Enterprise',
    roles: [
      {
        email: 'admin@taxflow.com',
        role: UserRole.ADMIN,
        title: 'Admin Profile',
        badge: 'Owner / Ops',
        description: 'Single-state sales & purchase management'
      },
      {
        email: 'accountant@taxflow.com',
        role: UserRole.ACCOUNTANT,
        title: 'Accountant Profile',
        badge: 'GSTR Filing',
        description: 'Standard GSTR-1 & 3B return preparation'
      }
    ]
  },
  [PlanCode.BUSINESS]: {
    maxSeatsText: '5 Seats Included',
    upgradeHint: 'Statutory Auditor Sign-off available in Professional',
    roles: [
      {
        email: 'admin@taxflow.com',
        role: UserRole.ADMIN,
        title: 'Admin Profile',
        badge: 'Branch & Ops',
        description: 'E-Way bill logistics & multi-branch admin'
      },
      {
        email: 'accountant@taxflow.com',
        role: UserRole.ACCOUNTANT,
        title: 'Accountant Profile',
        badge: 'Reconciliation',
        description: 'Auto 2B matching & ITC optimization'
      },
      {
        email: 'viewer@taxflow.com',
        role: UserRole.VIEWER,
        title: 'Viewer Profile',
        badge: 'Read Only',
        description: 'Audit report & tax summary viewer'
      }
    ]
  },
  [PlanCode.PROFESSIONAL]: {
    maxSeatsText: '15 Seats • Granular RBAC',
    roles: [
      {
        email: 'admin@taxflow.com',
        role: UserRole.ADMIN,
        title: 'Admin Profile',
        badge: 'Multi-State Ops',
        description: 'Multi-GSTIN management & automation rules'
      },
      {
        email: 'accountant@taxflow.com',
        role: UserRole.ACCOUNTANT,
        title: 'Accountant Profile',
        badge: 'IRN & Filing',
        description: 'IRP E-Invoicing & ITC tagging'
      },
      {
        email: 'auditor@taxflow.com',
        role: UserRole.AUDITOR,
        title: 'Auditor Profile',
        badge: 'Statutory Sign-Off',
        description: 'Multi-stage sign-off & audit inspection'
      },
      {
        email: 'viewer@taxflow.com',
        role: UserRole.VIEWER,
        title: 'Viewer Profile',
        badge: 'Read Only',
        description: 'Cross-state tax summary view'
      }
    ]
  },
  [PlanCode.ENTERPRISE]: {
    maxSeatsText: '50 Seats • Enterprise RBAC',
    roles: [
      {
        email: 'admin@taxflow.com',
        role: UserRole.ADMIN,
        title: 'Group Controller',
        badge: 'Conglomerate HQ',
        description: 'Holding company rollups & ERP configuration'
      },
      {
        email: 'accountant@taxflow.com',
        role: UserRole.ACCOUNTANT,
        title: 'Lead Tax Manager',
        badge: 'AI Tax Engine',
        description: 'Predictive forecasting & multi-entity filings'
      },
      {
        email: 'auditor@taxflow.com',
        role: UserRole.AUDITOR,
        title: 'Statutory Auditor',
        badge: 'Forensic Audit',
        description: 'Immutable ledger audits & verification'
      },
      {
        email: 'viewer@taxflow.com',
        role: UserRole.VIEWER,
        title: 'Executive Viewer',
        badge: 'CFO Suite',
        description: 'Risk dashboard & corporate reporting'
      }
    ]
  },
  [PlanCode.ENTERPRISE_PLUS]: {
    maxSeatsText: 'Unlimited Seats • Dedicated RBAC',
    roles: [
      {
        email: 'admin@taxflow.com',
        role: UserRole.ADMIN,
        title: 'Group Controller',
        badge: 'HQ Ops',
        description: 'Enterprise group administration'
      },
      {
        email: 'accountant@taxflow.com',
        role: UserRole.ACCOUNTANT,
        title: 'Lead Tax Manager',
        badge: 'AI Tax Engine',
        description: 'Multi-entity filings'
      },
      {
        email: 'auditor@taxflow.com',
        role: UserRole.AUDITOR,
        title: 'Statutory Auditor',
        badge: 'Audit',
        description: 'Full compliance inspection'
      },
      {
        email: 'viewer@taxflow.com',
        role: UserRole.VIEWER,
        title: 'Executive Viewer',
        badge: 'Read Only',
        description: 'Corporate reporting'
      }
    ]
  }
};

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const dispatch = useDispatch();
  const [portalMode, setPortalMode] = useState<LoginPortalMode>('ORGANIZATION');
  const [selectedPlanCode, setSelectedPlanCode] = useState<PlanCode>(PlanCode.BUSINESS);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Live Catalog State synchronized automatically with Super Admin updates
  const [catalog, setCatalog] = useState<Plan[]>(() => entitlementService.getAllPlans());

  useEffect(() => {
    const syncCatalog = () => {
      const current = entitlementService.getAllPlans();
      setCatalog([...current]);
    };

    // 1. Subscribe to entitlement service internal state changes
    const unsub = entitlementService.subscribeToPlans(syncCatalog);

    // 2. Listen to custom DOM events dispatched by super admin changes
    const handlePlansUpdated = () => {
      syncCatalog();
    };
    window.addEventListener('taxflow:plans_catalog_updated', handlePlansUpdated);
    window.addEventListener('storage', (e) => {
      if (e.key === 'taxflow_plans_catalog') {
        syncCatalog();
      }
    });
    window.addEventListener('focus', syncCatalog);

    // 3. Socket.io listener for real-time super admin broadcasts
    let socket: any = null;
    try {
      socket = io({ transports: ['websocket', 'polling'] });
      socket.on('superadmin-update-plan', (data: any) => {
        if (data?.planCode && data?.updates) {
          entitlementService.updatePlan(data.planCode, data.updates);
        }
        syncCatalog();
      });
      socket.on('superadmin-reset-plans', () => {
        entitlementService.resetPlansToDefault();
        syncCatalog();
      });
    } catch (e) {
      // socket fallback
    }

    return () => {
      unsub();
      window.removeEventListener('taxflow:plans_catalog_updated', handlePlansUpdated);
      window.removeEventListener('focus', syncCatalog);
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  // Compute dynamic plan options based on the live catalog
  const planOptions: PlanOption[] = useMemo(() => {
    // Targeted order of display: STARTER -> BUSINESS -> PROFESSIONAL -> ENTERPRISE
    const targetCodes = [
      PlanCode.STARTER,
      PlanCode.BUSINESS,
      PlanCode.PROFESSIONAL,
      PlanCode.ENTERPRISE
    ];

    return targetCodes.map(code => {
      const plan = catalog.find(p => p.code === code) || entitlementService.getPlan(code) || DEFAULT_PLANS_CATALOG[code];
      const meta = PLAN_VISUAL_META[code] || PLAN_VISUAL_META[PlanCode.STARTER];
      
      const annualPrice = plan?.annualPriceInr !== undefined && plan.annualPriceInr !== null
        ? Number(plan.annualPriceInr)
        : (Number(plan?.monthlyPriceInr || 0) * 12);

      const monthlyPrice = Number(plan?.monthlyPriceInr || 0);
      const monthlyEquiv = Math.round(annualPrice / 12);

      // Key features derived from enabled feature flags
      let keyFeatures: string[] = [];
      if (plan?.features && plan.features.length > 0) {
        keyFeatures = plan.features.slice(0, 4).map(f => FEATURE_LABELS[f] || String(f));
      } else {
        keyFeatures = meta.defaultFeatures;
      }

      return {
        code,
        title: plan?.name || meta.badge,
        tagline: plan?.description || 'GST Compliance & Filing Suite',
        price: `₹${annualPrice.toLocaleString('en-IN')}/yr`,
        annualPriceInr: annualPrice,
        monthlyPriceInr: monthlyPrice,
        monthlyEquivalent: `₹${monthlyEquiv.toLocaleString('en-IN')}/mo`,
        badge: meta.badge,
        color: meta.color,
        activeBorder: meta.activeBorder,
        activeBg: meta.activeBg,
        keyFeatures,
        maxSeats: plan?.limits?.maxUsers || (code === PlanCode.STARTER ? 2 : code === PlanCode.BUSINESS ? 5 : code === PlanCode.PROFESSIONAL ? 15 : 50)
      };
    });
  }, [catalog]);

  const handleCredentialsSubmit = async (e: React.FormEvent, customEmail?: string, overridePlan?: PlanCode) => {
    if (e) e.preventDefault();
    const loginEmail = customEmail || email;
    if (!loginEmail) {
      setError('Please provide a valid email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await performLogin(loginEmail, password || 'password');
      if (response.user) {
        // If customer portal, apply the selected plan entitlement to the user's current tenant
        if (response.user.role !== UserRole.SUPER_ADMIN) {
          const targetPlan = overridePlan || selectedPlanCode;
          const tenantId = response.user.currentTenantId || 't1';
          entitlementService.updateSubscriptionPlan(tenantId, targetPlan);
        }

        dispatch(login(response.user));
        onLoginSuccess?.(response.user.role);
      } else {
        setError('Invalid credentials for selected portal.');
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = (roleEmail: string, mode: LoginPortalMode = 'ORGANIZATION', plan?: PlanCode) => {
    setEmail(roleEmail);
    setPassword('password');
    setPortalMode(mode);
    const chosenPlan = plan || selectedPlanCode;
    handleCredentialsSubmit(undefined as any, roleEmail, chosenPlan);
  };

  const isSuperAdminMode = portalMode === 'SUPER_ADMIN';
  const currentPlanMeta = planOptions.find(p => p.code === selectedPlanCode) || planOptions[1] || planOptions[0];

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-indigo-500 selection:text-white">
      {/* Background Decorative Lighting */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
      <div className={`absolute -top-40 -left-40 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-colors duration-700 ${isSuperAdminMode ? 'bg-amber-600/20' : 'bg-blue-600/20'}`}></div>
      <div className={`absolute -bottom-40 -right-40 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-colors duration-700 ${isSuperAdminMode ? 'bg-indigo-600/25' : 'bg-indigo-600/20'}`}></div>

      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200/80 relative z-10 transition-all duration-300">
        
        {/* Portal Mode Selector Header Tabs */}
        <div className="bg-slate-900/95 p-2 border-b border-slate-800 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setPortalMode('ORGANIZATION');
              setError('');
              if (email === 'superadmin@taxflow.com') setEmail('');
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              !isSuperAdminMode 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Building2 size={15} />
            <span>Company & Client Portal</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPortalMode('SUPER_ADMIN');
              setError('');
              setEmail('superadmin@taxflow.com');
              setPassword('password');
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 relative ${
              isSuperAdminMode 
                ? 'bg-gradient-to-r from-amber-600 to-indigo-600 text-white shadow-md' 
                : 'text-amber-400/90 hover:text-amber-300 hover:bg-slate-800/60'
            }`}
          >
            <Crown size={15} className={isSuperAdminMode ? 'text-amber-200' : 'text-amber-400'} />
            <span>SaaS Super Admin</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded-full font-black bg-amber-400/20 text-amber-300 border border-amber-400/40 uppercase">
              Owner
            </span>
          </button>
        </div>

        {/* Dynamic Top Banner */}
        <div className={`p-6 text-center relative overflow-hidden border-b transition-all duration-300 ${
          isSuperAdminMode 
            ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-amber-900/40 text-amber-50' 
            : 'bg-slate-900 border-slate-800 text-white'
        }`}>
          <div className="relative z-10 flex flex-col items-center">
            {isSuperAdminMode ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 border border-amber-300/40 mb-3 transform hover:scale-105 transition-transform">
                  <Crown className="w-7 h-7 text-amber-100" />
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center gap-1">
                    <Sparkles size={11} className="text-amber-300" /> SaaS Master Control Tower
                  </span>
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight">TaxFlow SaaS Owner</h1>
                <p className="text-slate-400 text-xs font-medium mt-1 max-w-sm">
                  Universal governance for multi-tenant companies, Neon database clusters, billing quotas, and platform configurations.
                </p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md border border-blue-400/30 mb-3">
                  <Building2 className="w-7 h-7" />
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight">TaxFlow Enterprise</h1>
                <p className="text-slate-400 text-xs font-medium mt-1">
                  GST Compliance, Dynamic Plan Entitlements & Tax Engine
                </p>
              </>
            )}
          </div>
        </div>
        
        <div className="p-6 sm:p-7">
          {error && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2.5 animate-in fade-in">
              <ShieldAlert size={16} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Super Admin Specialized Feature Badges */}
          {isSuperAdminMode && (
            <div className="mb-5 p-3.5 rounded-xl bg-amber-500/5 border border-amber-200/80">
              <div className="text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Crown size={13} className="text-amber-700" /> SaaS Owner Master Privileges
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 font-medium">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                  <span>Control All Companies</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                  <span>Postgres Neon Multi-Tenant</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                  <span>Plan & Quota Gating</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                  <span>Twilio WhatsApp Alerts</span>
                </div>
              </div>
            </div>
          )}

          {/* CUSTOMER PORTAL: SELECT PLAN TIER BEFORE LOGIN */}
          {!isSuperAdminMode && (
            <div className="mb-6 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap size={14} className="text-indigo-600" />
                  Select Subscription Plan Tier
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <Calendar size={10} className="text-emerald-600" /> Annual Plan
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {currentPlanMeta.title} • {currentPlanMeta.price}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                Only the modules entitled under your selected plan will be accessible upon login. Prices and tiers are synchronized live with Super Admin configurations.
              </p>

              {/* Dynamic Plan Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {planOptions.map((plan) => {
                  const isSelected = selectedPlanCode === plan.code;
                  return (
                    <button
                      key={plan.code}
                      type="button"
                      onClick={() => setSelectedPlanCode(plan.code)}
                      className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                        isSelected 
                          ? `${plan.activeBorder} ${plan.activeBg} shadow-sm` 
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/80'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-black uppercase px-1.5 py-0.2 rounded ${
                            isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {plan.badge}
                          </span>
                          {isSelected && <Check size={13} className="text-indigo-600" strokeWidth={3} />}
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 leading-tight line-clamp-1">{plan.title}</h4>
                        <div className="mt-1">
                          <p className="text-xs font-black text-slate-900 font-mono">{plan.price}</p>
                          <p className="text-[9px] text-slate-400 font-mono font-medium">({plan.monthlyEquivalent})</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Plan Entitlement Preview Box */}
              <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/80 text-[11px] space-y-1.5">
                <div className="flex items-center justify-between text-slate-700 font-bold">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    Included Modules in {currentPlanMeta.title}:
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 font-normal truncate max-w-[200px]">
                    {currentPlanMeta.tagline}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {currentPlanMeta.keyFeatures.map((feat, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[10px] font-medium shadow-2xs flex items-center gap-1">
                      <Check size={10} className="text-emerald-600" />
                      {feat}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={(e) => handleCredentialsSubmit(e)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                {isSuperAdminMode ? 'SaaS Master Account Email' : 'Work Email'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isSuperAdminMode ? 'superadmin@taxflow.com' : 'name@company.com'}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all text-sm font-medium placeholder:text-slate-400"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {isSuperAdminMode ? 'Master Security Key / Password' : 'Password'}
                </label>
                {isSuperAdminMode && (
                  <span className="text-[10px] text-amber-800 font-bold bg-amber-100/80 px-2 py-0.5 rounded-md">
                    Universal Root Bypass
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all text-sm font-medium placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className={`w-full font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-md text-sm ${
                  isSuperAdminMode
                    ? 'bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 hover:from-slate-800 hover:to-indigo-900 text-amber-300 border border-amber-400/30 cursor-pointer'
                    : 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
                }`}
              >
                {loading ? (
                  'Authenticating Access...'
                ) : isSuperAdminMode ? (
                  <>
                    <Crown size={16} className="text-amber-400" />
                    <span>Sign In to SaaS Owner Console</span>
                    <ArrowRight size={16} />
                  </>
                ) : (
                  <>
                    <span>Sign In with {currentPlanMeta.title}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
            
            {/* Super Admin Quick Launch Profile */}
            {isSuperAdminMode ? (
              <div className="pt-4 border-t border-slate-100 mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    SaaS Owner Demo Access
                  </p>
                  <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Ready
                  </span>
                </div>
                
                <button 
                  type="button" 
                  onClick={() => demoLogin('superadmin@taxflow.com', 'SUPER_ADMIN')} 
                  className="w-full p-3 bg-gradient-to-r from-amber-50 to-indigo-50/60 hover:from-amber-100/80 hover:to-indigo-100/80 border border-amber-300/80 rounded-xl text-left transition-all group flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center font-black shadow-sm group-hover:scale-105 transition-transform">
                      <Crown size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        Platform Super Admin (SaaS Owner)
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-200 text-amber-900">
                          ROOT
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Instant master access to control all enrolled companies & settings
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                </button>
              </div>
            ) : (
              /* Executive Demo Profiles for Company Portal - Dynamically Aligned to Selected Plan */
              <div className="pt-4 border-t border-slate-100 mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Instant Demo Sign-In
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 font-medium">
                      Plan: <strong className="text-indigo-600">{currentPlanMeta.title}</strong>
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      {currentPlanMeta.maxSeats} Seats Included
                    </span>
                  </div>
                </div>
                <div className={`grid gap-2 ${
                  (PLAN_DEMO_ROLES[selectedPlanCode]?.roles.length || 2) === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'
                }`}>
                  {(PLAN_DEMO_ROLES[selectedPlanCode]?.roles || PLAN_DEMO_ROLES[PlanCode.STARTER].roles).map((demoItem, idx) => (
                    <button 
                      key={idx}
                      type="button" 
                      onClick={() => demoLogin(demoItem.email, 'ORGANIZATION')} 
                      className="text-xs py-2 px-2.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-lg text-slate-700 font-semibold transition-all text-left flex flex-col justify-between group cursor-pointer"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-slate-800 group-hover:text-blue-700">{demoItem.title}</span>
                        <span className="text-[9px] text-slate-400 group-hover:text-blue-600 font-bold">{demoItem.badge}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-normal truncate mt-0.5">{demoItem.description}</span>
                    </button>
                  ))}
                </div>

                {PLAN_DEMO_ROLES[selectedPlanCode]?.upgradeHint && (
                  <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between px-1">
                    <span>ℹ️ {PLAN_DEMO_ROLES[selectedPlanCode]?.upgradeHint}</span>
                  </div>
                )}
              </div>
            )}
          </form>

          {/* Footer Security Badges */}
          <div className="mt-6 text-center pt-3 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium">
            <ShieldCheck size={14} className="text-emerald-600" /> 
            <span>SOC-2 Type II Certified & GSTN Encrypted Authentication</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

