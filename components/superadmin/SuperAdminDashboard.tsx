import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Building2,
  Users,
  TrendingUp,
  CreditCard,
  Layers,
  Radio,
  RefreshCw,
  Plus,
  Sliders,
  AlertTriangle,
  Zap,
  CheckCircle2,
  XCircle,
  Database,
  Lock,
  Unlock,
  Eye,
  Edit3,
  Search,
  ExternalLink,
  ChevronRight,
  Server,
  Activity,
  DollarSign,
  ArrowUpRight,
  Check,
  X,
  Sparkles,
  Info,
  Clock,
  Globe,
  SlidersHorizontal,
  Flame,
  FileSpreadsheet,
  Crown,
  Coins,
  Shield,
  FileCheck,
  MapPin,
  CheckSquare,
  Square,
  Building,
  ArrowRight
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { tenantService } from '../../src/core/tenancy/tenantService';
import { entitlementService } from '../../src/core/entitlements/entitlementService';
import { Feature, PlanCode, Plan, PLANS_CATALOG } from '../../src/core/entitlements/types';
import { GlobalModuleConfig, DEFAULT_GLOBAL_MODULES } from '../../src/core/entitlements/globalModuleRegistry';
import { Tenant } from '../../src/core/tenancy/types';

// All 15 system features with friendly names and categories
const ALL_SYSTEM_FEATURES: Array<{ feature: Feature; label: string; desc: string; category: string }> = [
  { feature: Feature.INVOICES, label: 'B2B/B2C Invoicing & Sales', desc: 'Standard tax invoices, credit/debit notes & bill of supply', category: 'Core Invoicing' },
  { feature: Feature.PURCHASES, label: 'Purchase Register & Inward Supply', desc: 'Inward supplies, 2B matching & purchase register', category: 'Core Invoicing' },
  { feature: Feature.E_INVOICE, label: 'E-Invoicing & Live IRN', desc: 'Direct NIC/IRP integration with real-time QR generation', category: 'Statutory' },
  { feature: Feature.E_WAY_BILL, label: 'E-Way Bill Generation', desc: 'Part-A/Part-B movement slips & multi-vehicle tracking', category: 'Statutory' },
  { feature: Feature.GST_RETURNS, label: 'GST Returns (GSTR-1, 3B, 9)', desc: 'Table 4-13 JSON exports, auto-reconciliation & live filing', category: 'Filing & Returns' },
  { feature: Feature.RECONCILIATION, label: 'Automated 2B ITC Matching Engine', desc: 'Multi-rule automated matching, vendor mismatch triage', category: 'Reconciliation' },
  { feature: Feature.ITC, label: 'ITC Ledger & Section 16/17 Opt', desc: 'Ineligible ITC blockage, Rule 42/43 reversals & ledger tracking', category: 'Compliance' },
  { feature: Feature.AI, label: 'GenAI Tax Assistant & HSN Co-Pilot', desc: 'Regulatory query resolution & automated HSN classification', category: 'AI & Intelligence' },
  { feature: Feature.AUTOMATION, label: 'Auto-Recon Rules & Batch Jobs', desc: 'Automated rule triggers, tolerance thresholds & scheduled batch runs', category: 'Automation' },
  { feature: Feature.MULTI_GSTIN, label: 'Multi-GSTIN Pan-India Matrix', desc: 'Pan-India registration dashboard & cross-state reporting', category: 'Enterprise' },
  { feature: Feature.MULTI_BRANCH, label: 'Multi-Branch Hierarchy', desc: 'Head office, branch, warehouse, SEZ units isolation', category: 'Enterprise' },
  { feature: Feature.ERP_INTEGRATION, label: 'ERP Connectors (SAP, Oracle, Tally)', desc: 'Bidirectional sync with ERPs and legacy accounting systems', category: 'Integration' },
  { feature: Feature.API, label: 'Public Developer REST APIs', desc: 'High-throughput secure API access for programmatic invoice generation', category: 'Integration' },
  { feature: Feature.WEBHOOKS, label: 'Real-time Event Webhooks', desc: 'Instant dispatch of IRN generated, filing completed, and reconciliation alerts', category: 'Integration' },
  { feature: Feature.ADVANCED_RBAC, label: 'Granular Role-Based Access (RBAC)', desc: 'Custom roles, state/branch scoping & audit trails', category: 'Security' }
];

interface SuperAdminDashboardProps {
  onNavigate?: (path: string) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onNavigate }) => {
  // Navigation Sub-Tab State
  const [activeTab, setActiveTab] = useState<'plan_studio' | 'telemetry' | 'modules' | 'audit_trail'>('plan_studio');

  // Live Data States
  const [statsData, setStatsData] = useState<any>(() => tenantService.getTenantCreationAnalytics());
  const [globalModules, setGlobalModules] = useState<GlobalModuleConfig[]>(() => DEFAULT_GLOBAL_MODULES);
  const [plansCatalog, setPlansCatalog] = useState<Plan[]>(() => entitlementService.getAllPlans());
  const [allTenants, setAllTenants] = useState<Tenant[]>(() => tenantService.getAllTenants());
  
  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; action: string; user: string; details: string; timestamp: string }>>([
    {
      id: 'log-init-1',
      action: 'Super Admin Session Initialized',
      user: 'Super Admin',
      details: 'Connected to real-time cluster with root tenant orchestration privileges.',
      timestamp: new Date().toISOString()
    }
  ]);

  // UI Interactive States
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString());
  const [searchQuery, setSearchQuery] = useState('');
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<GlobalModuleConfig | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // --- SECTION 1: GLOBAL PLAN EDITOR STATE ---
  const [selectedPlanCode, setSelectedPlanCode] = useState<PlanCode>(PlanCode.BUSINESS);
  const [planEditorForm, setPlanEditorForm] = useState<Plan>(() => {
    const p = entitlementService.getPlan(PlanCode.BUSINESS) || PLANS_CATALOG[PlanCode.BUSINESS];
    return JSON.parse(JSON.stringify(p));
  });
  const [isPlanDirty, setIsPlanDirty] = useState(false);

  // --- SECTION 2: TENANT-SPECIFIC BESPOKE PRICING STATE ---
  const [selectedTenantForCustom, setSelectedTenantForCustom] = useState<string>(allTenants[0]?.id || 't1');
  const [tenantCustomForm, setTenantCustomForm] = useState(() => {
    const sub = entitlementService.getSubscription(allTenants[0]?.id || 't1');
    return {
      planId: sub?.planId || PlanCode.BUSINESS,
      customMonthlyPrice: sub?.customMonthlyPrice !== undefined ? sub.customMonthlyPrice : '',
      customAnnualPrice: sub?.customAnnualPrice !== undefined ? sub.customAnnualPrice : '',
      customPlanName: sub?.customPlanName || '',
      customNotes: sub?.customNotes || '',
      enabledFeatures: sub?.customFeatureOverrides?.enabledFeatures || [],
      disabledFeatures: sub?.customFeatureOverrides?.disabledFeatures || []
    };
  });

  // --- NEW TENANT PROVISIONING FORM STATE ---
  const [provisionForm, setProvisionForm] = useState({
    legalName: '',
    tradeName: '',
    pan: '',
    sector: 'Technology & Cloud SaaS',
    stateCode: '27',
    stateName: 'Maharashtra',
    planCode: PlanCode.ENTERPRISE,
    adminName: 'Operations Lead',
    adminEmail: 'ops@acme.internal'
  });
  const [isSubmittingTenant, setIsSubmittingTenant] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Sync selected plan with editor form (avoid overwriting while user is editing)
  useEffect(() => {
    const p = plansCatalog.find(plan => plan.code === selectedPlanCode) || plansCatalog[0];
    if (p && !isPlanDirty) {
      setPlanEditorForm(JSON.parse(JSON.stringify(p)));
    }
  }, [selectedPlanCode, plansCatalog, isPlanDirty]);

  // Sync tenant bespoke form when selected tenant changes
  useEffect(() => {
    const sub = entitlementService.getSubscription(selectedTenantForCustom);
    setTenantCustomForm({
      planId: sub?.planId || PlanCode.BUSINESS,
      customMonthlyPrice: sub?.customMonthlyPrice !== undefined ? sub.customMonthlyPrice : '',
      customAnnualPrice: sub?.customAnnualPrice !== undefined ? sub.customAnnualPrice : '',
      customPlanName: sub?.customPlanName || '',
      customNotes: sub?.customNotes || '',
      enabledFeatures: sub?.customFeatureOverrides?.enabledFeatures || [],
      disabledFeatures: sub?.customFeatureOverrides?.disabledFeatures || []
    });
  }, [selectedTenantForCustom]);

  // Real-time WebSocket connection setup
  useEffect(() => {
    const socket = io({
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('superadmin-get-stats');
      socket.emit('superadmin-get-modules');
      socket.emit('superadmin-get-plans');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('superadmin-stats-updated', (payload: any) => {
      if (payload?.stats) {
        setStatsData(payload.stats);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    });

    socket.on('global-modules-updated', (payload: any) => {
      if (payload?.modules) {
        setGlobalModules(payload.modules);
        setLastUpdated(new Date().toLocaleTimeString());
        if (payload.updatedModule) {
          showToast(`Module '${payload.updatedModule.name}' updated platform-wide`, 'info');
        }
      }
    });

    socket.on('plans-catalog-updated', (payload: any) => {
      if (payload?.plans) {
        setPlansCatalog(payload.plans);
        setLastUpdated(new Date().toLocaleTimeString());
        if (payload.updatedPlan) {
          showToast(`Pricing Plan '${payload.updatedPlan.name}' updated platform-wide`, 'success');
        }
      }
    });

    socket.on('tenant-created', (payload: any) => {
      showToast(`New Organization '${payload?.tenant?.legalName}' provisioned successfully!`, 'success');
      setAllTenants(tenantService.getAllTenants());
      refreshData();
    });

    socket.on('superadmin-audit-log', (logEntry: any) => {
      setAuditLogs(prev => [logEntry, ...prev.slice(0, 49)]);
    });

    socket.on('superadmin-error', (err: any) => {
      showToast(err.message || 'Operation failed', 'error');
    });

    // Auto-refresh interval
    const interval = setInterval(() => {
      refreshData();
    }, 15000);

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, []);

  const refreshData = () => {
    try {
      const freshStats = tenantService.getTenantCreationAnalytics();
      setStatsData(freshStats);
      const freshPlans = entitlementService.getAllPlans();
      setPlansCatalog(freshPlans);
      setAllTenants(tenantService.getAllTenants());
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('superadmin-get-stats');
        socketRef.current.emit('superadmin-get-modules');
        socketRef.current.emit('superadmin-get-plans');
      }
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      console.warn('Error refreshing superadmin data:', e);
    }
  };

  // --- HANDLER: SAVE PLAN TO CATALOG ---
  const handleSavePlanToCatalog = async () => {
    try {
      const sanitizedForm: Plan = {
        ...planEditorForm,
        monthlyPriceInr: Number(planEditorForm.monthlyPriceInr) || 0,
        annualPriceInr: Number(planEditorForm.annualPriceInr) || 0,
        limits: {
          ...planEditorForm.limits,
          maxUsers: Number(planEditorForm.limits.maxUsers) || 1,
          maxCompanies: Number(planEditorForm.limits.maxCompanies) || 1,
          maxGstins: Number(planEditorForm.limits.maxGstins) || 1,
          maxBranches: Number(planEditorForm.limits.maxBranches) || 1,
          monthlyInvoiceVolume: Number(planEditorForm.limits.monthlyInvoiceVolume) || 100,
          monthlyEinvoiceVolume: Number(planEditorForm.limits.monthlyEinvoiceVolume) || 0,
          monthlyAiRequests: Number(planEditorForm.limits.monthlyAiRequests) || 0
        }
      };

      // Update in entitlementService (persists to localStorage & triggers event)
      const updated = entitlementService.updatePlan(selectedPlanCode, sanitizedForm);
      
      // Update local state catalog and current editor
      const allUpdatedPlans = entitlementService.getAllPlans();
      setPlansCatalog(allUpdatedPlans);
      setPlanEditorForm(JSON.parse(JSON.stringify(updated)));
      setIsPlanDirty(false);

      if (socketRef.current && isConnected) {
        socketRef.current.emit('superadmin-update-plan', {
          planCode: selectedPlanCode,
          updates: sanitizedForm,
          user: { name: 'Super Admin', email: 'superadmin@taxflow.internal' }
        });
      }

      try {
        await fetch(`/api/v1/admin/plans/${selectedPlanCode}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sanitizedForm)
        });
      } catch (e) {
        // Fallback local
      }

      showToast(`Plan '${updated.name}' price updated to ₹${updated.monthlyPriceInr.toLocaleString('en-IN')}/mo (₹${updated.annualPriceInr.toLocaleString('en-IN')}/yr) & broadcasted platform-wide!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save plan', 'error');
    }
  };

  // --- HANDLER: RESET PLANS CATALOG ---
  const handleResetPlansCatalog = async () => {
    if (!window.confirm('Reset all subscription plans and pricing matrices back to system factory defaults?')) return;
    try {
      if (socketRef.current && isConnected) {
        socketRef.current.emit('superadmin-reset-plans', { user: { name: 'Super Admin' } });
      }
      try {
        await fetch('/api/v1/admin/plans/reset', { method: 'POST' });
      } catch (e) {
        // Fallback local
      }
      const resetPlans = entitlementService.resetPlansToDefault();
      setPlansCatalog(resetPlans);
      const currentSelected = resetPlans.find(p => p.code === selectedPlanCode) || resetPlans[0];
      setPlanEditorForm(JSON.parse(JSON.stringify(currentSelected)));
      setIsPlanDirty(false);
      showToast('All plans restored to factory defaults and broadcasted!', 'success');
    } catch (err: any) {
      showToast('Plan reset completed', 'info');
    }
  };

  // --- HANDLER: TOGGLE FEATURE IN PLAN ---
  const togglePlanFeature = (feature: Feature) => {
    const currentFeatures = planEditorForm.features;
    let nextFeatures: Feature[];
    if (currentFeatures.includes(feature)) {
      nextFeatures = currentFeatures.filter(f => f !== feature);
    } else {
      nextFeatures = [...currentFeatures, feature];
    }
    setPlanEditorForm({
      ...planEditorForm,
      features: nextFeatures
    });
    setIsPlanDirty(true);
  };

  // --- HANDLER: SAVE BESPOKE TENANT CONTRACT ---
  const handleSaveTenantCustomPackage = async () => {
    try {
      const overrides = {
        planId: tenantCustomForm.planId,
        customPlanName: tenantCustomForm.customPlanName || undefined,
        customMonthlyPrice: tenantCustomForm.customMonthlyPrice !== '' ? Number(tenantCustomForm.customMonthlyPrice) : undefined,
        customAnnualPrice: tenantCustomForm.customAnnualPrice !== '' ? Number(tenantCustomForm.customAnnualPrice) : undefined,
        customNotes: tenantCustomForm.customNotes || undefined,
        enabledFeatures: tenantCustomForm.enabledFeatures,
        disabledFeatures: tenantCustomForm.disabledFeatures
      };

      if (socketRef.current && isConnected) {
        socketRef.current.emit('superadmin-customize-tenant-plan', {
          tenantId: selectedTenantForCustom,
          overrides,
          user: { name: 'Super Admin' }
        });
      }

      try {
        await fetch(`/api/v1/admin/tenants/${selectedTenantForCustom}/custom-plan`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(overrides)
        });
      } catch (e) {
        // Fallback local
      }

      const updatedSub = entitlementService.customizeTenantSubscription(selectedTenantForCustom, overrides);
      const targetTenant = allTenants.find(t => t.id === selectedTenantForCustom);
      showToast(`Custom contract pricing applied to '${targetTenant?.legalName || selectedTenantForCustom}'!`, 'success');
      refreshData();
    } catch (err: any) {
      showToast(err.message || 'Failed to apply custom package', 'error');
    }
  };

  // --- HANDLER: TOGGLE BESPOKE FEATURE OVERRIDE ---
  const handleToggleCustomFeature = (feature: Feature, mode: 'GRANT' | 'REVOKE' | 'DEFAULT') => {
    let nextEnabled = [...tenantCustomForm.enabledFeatures];
    let nextDisabled = [...tenantCustomForm.disabledFeatures];

    if (mode === 'GRANT') {
      if (!nextEnabled.includes(feature)) nextEnabled.push(feature);
      nextDisabled = nextDisabled.filter(f => f !== feature);
    } else if (mode === 'REVOKE') {
      if (!nextDisabled.includes(feature)) nextDisabled.push(feature);
      nextEnabled = nextEnabled.filter(f => f !== feature);
    } else {
      nextEnabled = nextEnabled.filter(f => f !== feature);
      nextDisabled = nextDisabled.filter(f => f !== feature);
    }

    setTenantCustomForm({
      ...tenantCustomForm,
      enabledFeatures: nextEnabled,
      disabledFeatures: nextDisabled
    });
  };

  // --- HANDLER: PROVISION NEW TENANT ---
  const handleProvisionTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provisionForm.legalName || !provisionForm.pan) {
      showToast('Please provide Legal Entity Name and PAN', 'error');
      return;
    }

    setIsSubmittingTenant(true);
    try {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('superadmin-create-tenant', {
          tenantData: {
            legalName: provisionForm.legalName,
            tradeName: provisionForm.tradeName || provisionForm.legalName,
            pan: provisionForm.pan.toUpperCase(),
            sector: provisionForm.sector,
            stateCode: provisionForm.stateCode,
            stateName: provisionForm.stateName,
            planCode: provisionForm.planCode,
            isolationMode: 'ROW_LEVEL_SECURITY'
          },
          user: { name: 'Super Admin', email: 'superadmin@taxflow.internal' }
        });
      } else {
        const created = tenantService.createTenant({
          legalName: provisionForm.legalName,
          tradeName: provisionForm.tradeName || provisionForm.legalName,
          pan: provisionForm.pan.toUpperCase(),
          sector: provisionForm.sector,
          stateCode: provisionForm.stateCode,
          stateName: provisionForm.stateName,
          planCode: provisionForm.planCode
        });
        showToast(`Organization '${created.tenant.legalName}' provisioned!`, 'success');
        refreshData();
      }

      setIsProvisionModalOpen(false);
      setProvisionForm({
        legalName: '',
        tradeName: '',
        pan: '',
        sector: 'Technology & Cloud SaaS',
        stateCode: '27',
        stateName: 'Maharashtra',
        planCode: PlanCode.ENTERPRISE,
        adminName: 'Operations Lead',
        adminEmail: 'ops@acme.internal'
      });
    } catch (err: any) {
      showToast(err.message || 'Failed to create organization', 'error');
    } finally {
      setIsSubmittingTenant(false);
    }
  };

  // --- HANDLER: TOGGLE KILL SWITCH ---
  const handleToggleKillSwitch = (feature: Feature, currentKillSwitch: boolean) => {
    const nextState = !currentKillSwitch;
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('superadmin-toggle-killswitch', {
        feature,
        killSwitch: nextState,
        user: { name: 'Super Admin' }
      });
    } else {
      setGlobalModules(prev =>
        prev.map(m => (m.feature === feature ? { ...m, globalKillSwitch: nextState, status: nextState ? 'DISABLED' : 'ACTIVE' } : m))
      );
      showToast(`Feature ${feature} killswitch set to ${nextState}`, 'info');
    }
  };

  // Filtered tenants list
  const filteredTenants = (statsData?.recentTenants || allTenants || []).filter((t: any) =>
    (t.legalName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.pan || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.sector || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.planCode || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeKillSwitches = globalModules.filter(m => m.globalKillSwitch || m.status === 'DISABLED');

  return (
    <div id="super-admin-root" className="min-h-full bg-slate-50 text-slate-900 p-6 md:p-8 space-y-6 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          id="superadmin-toast"
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border text-xs font-bold animate-in slide-in-from-bottom-5 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-emerald-900/10'
              : toastMessage.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-300 shadow-rose-900/10'
              : 'bg-indigo-50 text-indigo-900 border-indigo-300 shadow-indigo-900/10'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />}
          {toastMessage.type === 'error' && <AlertTriangle size={18} className="text-rose-600 shrink-0" />}
          {toastMessage.type === 'info' && <Info size={18} className="text-indigo-600 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* SUPER ADMIN COMMAND HEADER - CRISP WHITE THEME */}
      <div id="superadmin-header" className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20 border border-amber-400">
            <Crown size={26} className="stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Super Admin Command
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                <Crown size={11} className="text-amber-600" /> ROOT PRIVILEGES
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                {isConnected ? 'LIVE SYNC ACTIVE' : 'CONNECTING...'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Unified Platform Orchestration · Super Plan Studio · Real-Time Creation Telemetry · Global Governance
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            id="superadmin-btn-refresh"
            onClick={refreshData}
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all cursor-pointer"
            title="Refresh Real-Time Telemetry"
          >
            <RefreshCw size={16} />
          </button>

          <button
            id="superadmin-btn-provision-open"
            onClick={() => setIsProvisionModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Provision Organization</span>
          </button>
        </div>
      </div>

      {/* Emergency Active Kill-Switch Warning Banner */}
      {activeKillSwitches.length > 0 && (
        <div id="superadmin-killswitch-banner" className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-4 text-rose-900">
          <div className="flex items-center gap-3">
            <Flame size={20} className="text-rose-600 shrink-0 animate-bounce" />
            <div>
              <p className="text-xs font-bold text-rose-900">
                ATTENTION: {activeKillSwitches.length} System Feature(s) Under Emergency Platform Kill-Switch
              </p>
              <p className="text-[11px] text-rose-700">
                {activeKillSwitches.map(m => m.name).join(' • ')} are disabled across all tenant workspaces.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('modules')}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            Manage Modules
          </button>
        </div>
      )}

      {/* SUB-MODULE NAVIGATION TABS - WHITE THEME */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-none">
        {/* Tab 1: Super Plan Studio */}
        <button
          id="tab-btn-plan-studio"
          onClick={() => setActiveTab('plan_studio')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'plan_studio'
              ? 'bg-amber-500 text-slate-950 shadow-md ring-1 ring-amber-400'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Crown size={16} className={activeTab === 'plan_studio' ? 'text-slate-950' : 'text-amber-500'} />
          <span>Super Admin • Plan Studio</span>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-black uppercase ${
            activeTab === 'plan_studio' ? 'bg-slate-950 text-amber-300' : 'bg-amber-100 text-amber-900'
          }`}>
            LIVE SYNC
          </span>
        </button>

        {/* Tab 2: Real-time Telemetry */}
        <button
          id="tab-btn-telemetry"
          onClick={() => setActiveTab('telemetry')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'telemetry'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <TrendingUp size={16} className={activeTab === 'telemetry' ? 'text-white' : 'text-indigo-600'} />
          <span>Creation & Revenue Telemetry</span>
        </button>

        {/* Tab 3: Global Modules & Killswitches */}
        <button
          id="tab-btn-modules"
          onClick={() => setActiveTab('modules')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'modules'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers size={16} className={activeTab === 'modules' ? 'text-white' : 'text-blue-600'} />
          <span>Global Module Matrix & Killswitches</span>
          {activeKillSwitches.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          )}
        </button>

        {/* Tab 4: Audit Trail */}
        <button
          id="tab-btn-audit"
          onClick={() => setActiveTab('audit_trail')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'audit_trail'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Clock size={16} className={activeTab === 'audit_trail' ? 'text-white' : 'text-slate-600'} />
          <span>Platform Audit Trail</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SUPER ADMIN • PLAN STUDIO (PRICING MATRIX & BESPOKE PACKAGING)      */}
      {/* ========================================================================= */}
      {activeTab === 'plan_studio' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Platform Super Admin Authority Banner */}
          <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-slate-950 p-6 md:p-8 rounded-2xl shadow-md border border-amber-400/50 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-slate-950 text-amber-300 border border-slate-900 flex items-center gap-1.5">
                  <Crown size={12} className="text-amber-400" /> SUPER ADMIN CORE PRIVILEGES
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-white/90 text-slate-900 border border-white flex items-center gap-1">
                  <Zap size={12} className="text-amber-600" /> REAL-TIME WEBSOCKET BROADCAST ACTIVE
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-slate-950 tracking-tight flex items-center gap-2">
                Plan Packaging, Pricing Matrix & Module Studio
              </h2>
              <p className="text-xs text-slate-900 font-medium max-w-2xl leading-relaxed">
                As Super Admin, customize global subscription plan tiers, configure dynamic INR pricing, enable/disable modules per tier, and create bespoke customized packaging for individual client organizations in real-time.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setIsProvisionModalOpen(true)}
                className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 text-amber-300 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus size={16} /> Quick Provision Organization
              </button>
              <button
                onClick={handleResetPlansCatalog}
                className="px-4 py-2.5 bg-white hover:bg-amber-50 text-slate-900 font-bold text-xs rounded-xl border border-amber-300 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <RefreshCw size={14} /> Reset Defaults
              </button>
            </div>
          </div>

          {/* SECTION 1: GLOBAL PLAN CATALOG & PRICING MATRIX CUSTOMIZER */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="text-amber-600" size={20} />
                  1. Tiered Subscription Plan & Price Customizer
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select a plan to adjust its monthly/annual price, statutory limit quotas, and enabled modules in real-time.
                </p>
              </div>

              {isPlanDirty && (
                <div className="flex items-center gap-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-300 px-3 py-1.5 rounded-xl animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Unsaved Changes in {planEditorForm.name}
                </div>
              )}
            </div>

            {/* Plan Selector Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {plansCatalog.map((plan) => {
                const isSelected = selectedPlanCode === plan.code;
                return (
                  <button
                    key={plan.code}
                    onClick={() => {
                      setSelectedPlanCode(plan.code);
                      setPlanEditorForm(JSON.parse(JSON.stringify(plan)));
                      setIsPlanDirty(false);
                    }}
                    className={`p-4 rounded-2xl text-left transition-all border relative cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-amber-500/50'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-full ${
                        isSelected ? 'bg-amber-400 text-slate-950' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {plan.code}
                      </span>
                      {isSelected && <Check size={14} className="text-amber-400" />}
                    </div>
                    <h4 className="text-xs font-bold truncate">{plan.name}</h4>
                    <p className={`text-xs font-mono font-extrabold mt-1 ${isSelected ? 'text-amber-300' : 'text-indigo-600'}`}>
                      ₹{plan.annualPriceInr.toLocaleString('en-IN')}<span className="text-[10px] font-normal opacity-75">/yr</span>
                    </p>
                    <p className={`text-[10px] mt-0.5 opacity-70 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                      {plan.features.length} Modules Included • Annual Plan
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Plan Details & Pricing Form */}
            <div className="bg-slate-50/80 rounded-2xl p-6 border border-slate-200 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Plan Display Name</label>
                  <input
                    type="text"
                    value={planEditorForm.name}
                    onChange={(e) => {
                      setPlanEditorForm({ ...planEditorForm, name: e.target.value });
                      setIsPlanDirty(true);
                    }}
                    className="w-full h-10 px-3 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-indigo-900 font-extrabold">
                      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] uppercase font-black">Annual Plan</span>
                      Annual Price (INR ₹ / Year)
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold">Standard Billing</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400 font-mono">₹</span>
                    <input
                      type="number"
                      min={0}
                      value={planEditorForm.annualPriceInr}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : Number(e.target.value);
                        setPlanEditorForm(prev => ({ 
                          ...prev, 
                          annualPriceInr: val,
                          monthlyPriceInr: Math.round(val / 12)
                        }));
                        setIsPlanDirty(true);
                      }}
                      className="w-full h-10 pl-7 pr-3 bg-white text-slate-900 border-2 border-indigo-200 focus:border-indigo-600 rounded-xl text-xs font-mono font-black focus:ring-2 focus:ring-amber-500 outline-none shadow-2xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Monthly Equivalent (INR ₹)</span>
                    <span className="text-[10px] text-slate-400 font-mono">(₹{planEditorForm.annualPriceInr ? Math.round(planEditorForm.annualPriceInr / 12).toLocaleString('en-IN') : 0}/mo)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400 font-mono">₹</span>
                    <input
                      type="number"
                      min={0}
                      value={planEditorForm.monthlyPriceInr}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : Number(e.target.value);
                        setPlanEditorForm(prev => ({ 
                          ...prev, 
                          monthlyPriceInr: val
                        }));
                        setIsPlanDirty(true);
                      }}
                      className="w-full h-10 pl-7 pr-3 bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Plan Description / Value Proposition</label>
                <input
                  type="text"
                  value={planEditorForm.description}
                  onChange={(e) => {
                    setPlanEditorForm({ ...planEditorForm, description: e.target.value });
                    setIsPlanDirty(true);
                  }}
                  className="w-full h-10 px-3 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Document Quotas & Limit Customization */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-indigo-600" /> Plan Limits & Monthly Document Quotas
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-[10px] text-slate-500 block font-semibold">Max Users</span>
                    <input
                      type="number"
                      min={1}
                      value={planEditorForm.limits.maxUsers}
                      onChange={(e) => {
                        setPlanEditorForm({
                          ...planEditorForm,
                          limits: { ...planEditorForm.limits, maxUsers: Number(e.target.value) }
                        });
                        setIsPlanDirty(true);
                      }}
                      className="w-full h-8 mt-1 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-[10px] text-slate-500 block font-semibold">Max GSTINs</span>
                    <input
                      type="number"
                      min={1}
                      value={planEditorForm.limits.maxGstins}
                      onChange={(e) => {
                        setPlanEditorForm({
                          ...planEditorForm,
                          limits: { ...planEditorForm.limits, maxGstins: Number(e.target.value) }
                        });
                        setIsPlanDirty(true);
                      }}
                      className="w-full h-8 mt-1 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-[10px] text-slate-500 block font-semibold">Max Branches</span>
                    <input
                      type="number"
                      min={1}
                      value={planEditorForm.limits.maxBranches}
                      onChange={(e) => {
                        setPlanEditorForm({
                          ...planEditorForm,
                          limits: { ...planEditorForm.limits, maxBranches: Number(e.target.value) }
                        });
                        setIsPlanDirty(true);
                      }}
                      className="w-full h-8 mt-1 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-[10px] text-slate-500 block font-semibold">Monthly Invoices</span>
                    <input
                      type="number"
                      min={100}
                      value={planEditorForm.limits.monthlyInvoiceVolume}
                      onChange={(e) => {
                        setPlanEditorForm({
                          ...planEditorForm,
                          limits: { ...planEditorForm.limits, monthlyInvoiceVolume: Number(e.target.value), maxInvoicesPerMonth: Number(e.target.value) }
                        });
                        setIsPlanDirty(true);
                      }}
                      className="w-full h-8 mt-1 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-[10px] text-slate-500 block font-semibold">Monthly E-Invoices</span>
                    <input
                      type="number"
                      min={0}
                      value={planEditorForm.limits.monthlyEinvoiceVolume}
                      onChange={(e) => {
                        setPlanEditorForm({
                          ...planEditorForm,
                          limits: { ...planEditorForm.limits, monthlyEinvoiceVolume: Number(e.target.value), maxEInvoicesPerMonth: Number(e.target.value) }
                        });
                        setIsPlanDirty(true);
                      }}
                      className="w-full h-8 mt-1 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-[10px] text-slate-500 block font-semibold">AI Tax Requests/mo</span>
                    <input
                      type="number"
                      min={0}
                      value={planEditorForm.limits.monthlyAiRequests}
                      onChange={(e) => {
                        setPlanEditorForm({
                          ...planEditorForm,
                          limits: { ...planEditorForm.limits, monthlyAiRequests: Number(e.target.value), maxAiCallsPerMonth: Number(e.target.value) }
                        });
                        setIsPlanDirty(true);
                      }}
                      className="w-full h-8 mt-1 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Module Entitlement Toggle Matrix */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={14} className="text-amber-600" /> Entitled Modules in {planEditorForm.name} ({planEditorForm.features.length}/{ALL_SYSTEM_FEATURES.length})
                  </h4>
                  <span className="text-[11px] text-slate-500">Click any card to toggle feature inclusion</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {ALL_SYSTEM_FEATURES.map((item) => {
                    const isEnabled = planEditorForm.features.includes(item.feature);
                    return (
                      <div
                        key={item.feature}
                        onClick={() => togglePlanFeature(item.feature)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                          isEnabled
                            ? 'bg-white border-emerald-500/50 shadow-sm ring-1 ring-emerald-500/20'
                            : 'bg-slate-100/70 border-slate-200 opacity-60 hover:opacity-80'
                        }`}
                      >
                        <div className="mt-0.5">
                          {isEnabled ? (
                            <CheckSquare className="text-emerald-600" size={18} />
                          ) : (
                            <Square className="text-slate-400" size={18} />
                          )}
                        </div>
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-slate-900 truncate">{item.label}</span>
                            <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                              isEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {item.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-tight">{item.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Save Plan Button */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    const original = plansCatalog.find(p => p.code === selectedPlanCode);
                    if (original) setPlanEditorForm(JSON.parse(JSON.stringify(original)));
                    setIsPlanDirty(false);
                  }}
                  disabled={!isPlanDirty}
                  className="px-4 py-2.5 text-slate-600 hover:text-slate-900 font-bold text-xs disabled:opacity-40 cursor-pointer"
                >
                  Discard Changes
                </button>
                <button
                  type="button"
                  onClick={handleSavePlanToCatalog}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer border border-amber-400"
                >
                  <Zap size={16} /> Save Plan & Broadcast Realtime (WebSockets)
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 2: TENANT-SPECIFIC BESPOKE MODULE OVERRIDES & CONTRACT PRICING */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Coins className="text-indigo-600" size={20} />
                  2. Organization-Specific Bespoke Pricing & Module Overrides
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Super Admin override: Grant customized module access or negotiate bespoke rates for specific client organizations.
                </p>
              </div>

              {/* Tenant Selector */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl">
                <span className="text-xs font-bold text-slate-600">Select Organization:</span>
                <select
                  value={selectedTenantForCustom}
                  onChange={(e) => setSelectedTenantForCustom(e.target.value)}
                  className="bg-transparent text-xs font-bold text-indigo-700 focus:outline-none cursor-pointer"
                >
                  {allTenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.tradeName || t.legalName} ({t.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-slate-50/80 rounded-2xl p-6 border border-slate-200 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Base Subscription Plan</label>
                  <select
                    value={tenantCustomForm.planId}
                    onChange={(e) => setTenantCustomForm({ ...tenantCustomForm, planId: e.target.value as PlanCode })}
                    className="w-full h-10 px-3 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {plansCatalog.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name} (₹{p.monthlyPriceInr}/mo)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Custom Contract Plan Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Enterprise Custom"
                    value={tenantCustomForm.customPlanName}
                    onChange={(e) => setTenantCustomForm({ ...tenantCustomForm, customPlanName: e.target.value })}
                    className="w-full h-10 px-3 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Bespoke Monthly Price (₹)</label>
                  <input
                    type="number"
                    placeholder="Leave empty to use base plan"
                    value={tenantCustomForm.customMonthlyPrice}
                    onChange={(e) => setTenantCustomForm({ ...tenantCustomForm, customMonthlyPrice: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full h-10 px-3 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Bespoke Annual Price (₹)</label>
                  <input
                    type="number"
                    placeholder="Leave empty to use base plan"
                    value={tenantCustomForm.customAnnualPrice}
                    onChange={(e) => setTenantCustomForm({ ...tenantCustomForm, customAnnualPrice: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full h-10 px-3 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Module Granular Overrides for this Tenant */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <SlidersHorizontal size={14} className="text-indigo-600" /> Module Access Overrides for this Organization
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {ALL_SYSTEM_FEATURES.map((item) => {
                    const isBaseEnabled = (plansCatalog.find(p => p.code === tenantCustomForm.planId)?.features || []).includes(item.feature);
                    const isExplicitlyGranted = tenantCustomForm.enabledFeatures.includes(item.feature);
                    const isExplicitlyRevoked = tenantCustomForm.disabledFeatures.includes(item.feature);
                    const effectiveActive = (isBaseEnabled && !isExplicitlyRevoked) || isExplicitlyGranted;

                    return (
                      <div
                        key={item.feature}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                          effectiveActive
                            ? 'bg-white border-indigo-200 shadow-sm'
                            : 'bg-slate-100/80 border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{item.label}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            Base: {isBaseEnabled ? 'Included' : 'Not Included'} · Effective: {effectiveActive ? 'ACTIVE' : 'LOCKED'}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleCustomFeature(item.feature, 'GRANT')}
                            className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                              isExplicitlyGranted
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-200 text-slate-700 hover:bg-emerald-100 hover:text-emerald-800'
                            }`}
                          >
                            Grant
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleCustomFeature(item.feature, 'REVOKE')}
                            className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                              isExplicitlyRevoked
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-200 text-slate-700 hover:bg-rose-100 hover:text-rose-800'
                            }`}
                          >
                            Revoke
                          </button>
                          {(isExplicitlyGranted || isExplicitlyRevoked) && (
                            <button
                              type="button"
                              onClick={() => handleToggleCustomFeature(item.feature, 'DEFAULT')}
                              className="px-1.5 py-1 text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                              title="Reset to Base Plan Default"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Contract Notes / Terms of Engagement</label>
                <input
                  type="text"
                  placeholder="e.g. Approved by Finance Board on Q3 enterprise discount schedule"
                  value={tenantCustomForm.customNotes}
                  onChange={(e) => setTenantCustomForm({ ...tenantCustomForm, customNotes: e.target.value })}
                  className="w-full h-10 px-3 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Save Tenant Custom Contract Button */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleSaveTenantCustomPackage}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Check size={16} /> Save Bespoke Contract for this Organization
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: REAL-TIME TELEMETRY & TENANT VELOCITY                               */}
      {/* ========================================================================= */}
      {activeTab === 'telemetry' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Top KPI Metrics Grid */}
          <div id="superadmin-kpis" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Total Organizations */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Organizations</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
                  <Building2 size={16} />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{statsData?.summary?.totalTenants || allTenants.length}</span>
                <span className="text-xs font-bold text-emerald-600 flex items-center">
                  <ArrowUpRight size={12} /> +{statsData?.summary?.growthRatePct || 28.5}%
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2.5">
                <span>Active: <strong className="text-emerald-600">{statsData?.summary?.activeTenants || allTenants.length - 1}</strong></span>
                <span>New Today: <strong className="text-blue-600">+{statsData?.summary?.newTenantsToday || 1}</strong></span>
                <span>Suspended: <strong className="text-rose-600">{statsData?.summary?.suspendedTenants || 0}</strong></span>
              </div>
            </div>

            {/* KPI 2: Live Monthly Recurring Revenue (MRR) */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Platform MRR (INR)</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                  <DollarSign size={16} />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  ₹{(statsData?.summary?.monthlyRecurringRevenueInr || 87997).toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-slate-500 font-medium">/ month</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2.5">
                <span>ARR: <strong className="text-emerald-600">₹{((statsData?.summary?.annualRunRateInr || 1055964) / 100000).toFixed(2)} L</strong></span>
                <span>ARPU: <strong className="text-slate-800">₹{(statsData?.summary?.averageRevenuePerTenantInr || 21999).toLocaleString('en-IN')}</strong></span>
              </div>
            </div>

            {/* KPI 3: Managed Footprint */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Managed Footprint</span>
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200">
                  <Globe size={16} />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{statsData?.summary?.totalGstins || 5}</span>
                <span className="text-xs text-purple-600 font-bold">Registered GSTINs</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2.5">
                <span>Operating Branches: <strong className="text-slate-800">{statsData?.summary?.totalBranches || 7}</strong></span>
                <span>Active Users: <strong className="text-slate-800">{statsData?.summary?.totalUsers || 12}</strong></span>
              </div>
            </div>

            {/* KPI 4: System Health SLA */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">System SLA & Health</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                  <Activity size={16} />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{statsData?.summary?.systemHealthPct || 99.98}%</span>
                <span className="text-xs font-bold text-emerald-600">SLA Met</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2.5">
                <span>Active Modules: <strong className="text-emerald-600">{globalModules.filter(m => m.status === 'ACTIVE').length}/{globalModules.length}</strong></span>
                <span>Sockets: <strong className="text-blue-600">{statsData?.summary?.activeWebSockets || 14} Live</strong></span>
              </div>
            </div>
          </div>

          {/* 30-Day Growth Velocity & Plan Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 30-Day Tenant Growth Velocity Chart */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp size={18} className="text-blue-600" />
                    30-Day Tenant Creation Velocity & Cumulative Trajectory
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Real-time daily provisioning trajectory & active state registrations</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-indigo-600" />
                    <span>Cumulative Total</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-emerald-500" />
                    <span>Daily Registrations</span>
                  </div>
                </div>
              </div>

              {/* Bar Visualizer */}
              <div className="h-56 w-full pt-4 flex flex-col justify-end">
                <div className="flex-1 flex items-end justify-between gap-1 border-b border-slate-200 pb-2">
                  {(statsData?.timeline30Days || []).map((tPoint: any, idx: number) => {
                    const maxVal = Math.max(5, statsData?.summary?.totalTenants || 4);
                    const barHeightPct = Math.max(12, (tPoint.cumulativeTenants / maxVal) * 100);
                    const isToday = idx === (statsData?.timeline30Days || []).length - 1;

                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-[10px] font-mono px-2 py-1 rounded shadow-xl pointer-events-none z-20 whitespace-nowrap">
                          <span>{tPoint.label}: {tPoint.cumulativeTenants} Tenants</span>
                          <span className="text-emerald-400">MRR: ₹{tPoint.mrrInr?.toLocaleString('en-IN')}</span>
                        </div>

                        <div
                          style={{ height: `${barHeightPct}%` }}
                          className={`w-full rounded-t transition-all duration-300 ${
                            isToday
                              ? 'bg-gradient-to-t from-indigo-600 to-indigo-400 shadow-md shadow-indigo-500/20'
                              : tPoint.newTenants > 0
                              ? 'bg-gradient-to-t from-indigo-500 to-indigo-300'
                              : 'bg-slate-200 hover:bg-slate-300'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 pt-2">
                  <span>30 Days Ago</span>
                  <span>15 Days Ago</span>
                  <span className="text-indigo-600 font-bold">Today (Real-Time)</span>
                </div>
              </div>
            </div>

            {/* Plan Tier Distribution */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard size={18} className="text-emerald-600" />
                  Subscription Plan Spread
                </h3>
                <span className="text-[11px] font-mono text-slate-500 font-bold">Live Yield</span>
              </div>

              <div className="space-y-3.5 pt-2">
                {(statsData?.planDistribution || []).map((pDist: any) => (
                  <div key={pDist.planCode} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pDist.color }} />
                        <span className="font-bold text-slate-800">{pDist.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-500">{pDist.count} orgs ({pDist.percentage}%)</span>
                        <span className="font-mono font-bold text-emerald-600">₹{pDist.monthlyRevenueInr.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(4, pDist.percentage)}%`,
                          backgroundColor: pDist.color
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Searchable Multi-Tenant Roster */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building2 size={18} className="text-indigo-600" />
                  Multi-Tenant Organization Roster
                </h3>
                <p className="text-xs text-slate-500">Live directory of all tenant instances, registered jurisdictions and plans</p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by legal name, PAN, state..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Organization & Domain</th>
                    <th className="py-3 px-4">Permanent PAN</th>
                    <th className="py-3 px-4">Jurisdiction & Sector</th>
                    <th className="py-3 px-4">Plan Tier</th>
                    <th className="py-3 px-4">GSTINs / Branches</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Provisioned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No organizations match the search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map((t: any) => (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{t.legalName}</span>
                            {t.id === 't1' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                                HQ ROOT
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5">{t.subdomain || t.id}.taxflow.io</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                          {t.pan}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-slate-800 font-medium">{t.stateName || 'State'} (Code {t.stateCode})</div>
                          <div className="text-[11px] text-slate-500">{t.sector || 'General Enterprise'}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            t.planCode === PlanCode.ENTERPRISE || t.planCode === PlanCode.ENTERPRISE_PLUS
                              ? 'bg-purple-100 text-purple-800 border-purple-200'
                              : t.planCode === PlanCode.PROFESSIONAL
                              ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                              : t.planCode === PlanCode.BUSINESS
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {t.planName || t.planCode}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700">
                          <span>{t.gstinCount || 1} GSTINs</span>
                          <span className="text-slate-400"> / {t.branchCount || 1} branches</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            t.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : t.status === 'TRIAL'
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-rose-100 text-rose-800 border-rose-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${t.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                          {new Date(t.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: GLOBAL MODULE ACCESS & KILL-SWITCHES                                */}
      {/* ========================================================================= */}
      {activeTab === 'modules' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers size={20} className="text-indigo-600" />
                  Global Module Access Matrix & Emergency Kill-Switches
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Control platform-wide module availability, minimum required plan tiers, maintenance statuses, and emergency isolation.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (confirm('Reset all global modules to standard factory defaults?')) {
                      if (socketRef.current) socketRef.current.emit('superadmin-reset-modules', { user: { name: 'Super Admin' } });
                    }
                  }}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
                >
                  Reset All to Defaults
                </button>
              </div>
            </div>

            {/* Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {globalModules.map(module => {
                const isKillSwitched = module.globalKillSwitch || module.status === 'DISABLED';
                return (
                  <div
                    key={module.feature}
                    className={`p-5 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                      isKillSwitched
                        ? 'bg-rose-50/50 border-rose-200 shadow-rose-900/5'
                        : module.status === 'BETA'
                        ? 'bg-amber-50/50 border-amber-200'
                        : module.status === 'MAINTENANCE'
                        ? 'bg-cyan-50/50 border-cyan-200'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          {module.category}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${
                            module.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : module.status === 'BETA'
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : module.status === 'MAINTENANCE'
                              ? 'bg-cyan-100 text-cyan-800 border-cyan-200'
                              : 'bg-rose-100 text-rose-800 border-rose-200'
                          }`}
                        >
                          {module.status}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 mt-2 leading-tight">
                        {module.name}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {module.description}
                      </p>

                      <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                        <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="block text-[9px] text-slate-400 uppercase font-semibold">Min Tier</span>
                          <span className="block text-[10px] font-extrabold text-purple-700 truncate">
                            {module.minPlanTier}
                          </span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="block text-[9px] text-slate-400 uppercase font-semibold">SLA</span>
                          <span className="block text-[10px] font-extrabold text-emerald-600">
                            {module.uptimePct}%
                          </span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="block text-[9px] text-slate-400 uppercase font-semibold">Latency</span>
                          <span className="block text-[10px] font-extrabold text-indigo-600">
                            {module.avgLatencyMs}ms
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setEditingModule(JSON.parse(JSON.stringify(module)))}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
                      >
                        <Edit3 size={13} />
                        <span>Configure</span>
                      </button>

                      <button
                        onClick={() => handleToggleKillSwitch(module.feature, Boolean(module.globalKillSwitch))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                          isKillSwitched
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                        }`}
                        title={isKillSwitched ? 'Re-enable module platform-wide' : 'Emergency platform kill-switch'}
                      >
                        {isKillSwitched ? <Unlock size={13} /> : <Lock size={13} />}
                        <span>{isKillSwitched ? 'Unlock' : 'Kill'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PLATFORM AUDIT TRAIL                                               */}
      {/* ========================================================================= */}
      {activeTab === 'audit_trail' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Clock size={18} className="text-indigo-600" />
                  Platform Administrative Audit Trail
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Immutable record of all tenant provisioning, pricing overrides, module kill-switches, and plan catalog modifications.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">{auditLogs.length} Events Logged</span>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/60 transition-colors px-2 rounded-xl">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{log.action}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {log.user}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px]">{log.details}</p>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()} · {new Date(log.timestamp).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PROVISION NEW ORGANIZATION */}
      {isProvisionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Provision New Organization</h3>
                  <p className="text-[11px] text-slate-500">Root tenant creation with isolated RLS database container</p>
                </div>
              </div>
              <button
                onClick={() => setIsProvisionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleProvisionTenant} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Legal Entity Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Technologies India Private Limited"
                  value={provisionForm.legalName}
                  onChange={e => setProvisionForm({ ...provisionForm, legalName: e.target.value })}
                  className="w-full h-10 px-3 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Permanent PAN *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="AAAAA0000A"
                    value={provisionForm.pan}
                    onChange={e => setProvisionForm({ ...provisionForm, pan: e.target.value.toUpperCase() })}
                    className="w-full h-10 px-3 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Initial Subscription Plan</label>
                  <select
                    value={provisionForm.planCode}
                    onChange={e => setProvisionForm({ ...provisionForm, planCode: e.target.value as PlanCode })}
                    className="w-full h-10 px-3 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {plansCatalog.map(p => (
                      <option key={p.code} value={p.code}>
                        {p.name} (₹{p.monthlyPriceInr}/mo)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">State Jurisdiction</label>
                  <select
                    value={provisionForm.stateCode}
                    onChange={e => {
                      const code = e.target.value;
                      const name = code === '27' ? 'Maharashtra' : code === '29' ? 'Karnataka' : code === '07' ? 'Delhi' : 'Tamil Nadu';
                      setProvisionForm({ ...provisionForm, stateCode: code, stateName: name });
                    }}
                    className="w-full h-10 px-3 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="27">Maharashtra (27)</option>
                    <option value="29">Karnataka (29)</option>
                    <option value="07">Delhi (07)</option>
                    <option value="33">Tamil Nadu (33)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Industry Sector</label>
                  <input
                    type="text"
                    value={provisionForm.sector}
                    onChange={e => setProvisionForm({ ...provisionForm, sector: e.target.value })}
                    className="w-full h-10 px-3 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsProvisionModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTenant}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  <Plus size={16} />
                  <span>{isSubmittingTenant ? 'Provisioning...' : 'Provision Organization'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT MODULE CONFIGURATION */}
      {editingModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Configure Module: {editingModule.name}</h3>
              </div>
              <button
                onClick={() => setEditingModule(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Operational Status</label>
                <select
                  value={editingModule.status}
                  onChange={e => setEditingModule({ ...editingModule, status: e.target.value as any })}
                  className="w-full h-10 px-3 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="ACTIVE">ACTIVE (Production Ready)</option>
                  <option value="BETA">BETA (Early Access)</option>
                  <option value="MAINTENANCE">MAINTENANCE (Temporary Read-Only)</option>
                  <option value="DISABLED">DISABLED (Full Kill-Switch)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Minimum Required Plan Tier</label>
                <select
                  value={editingModule.minPlanTier}
                  onChange={e => setEditingModule({ ...editingModule, minPlanTier: e.target.value as any })}
                  className="w-full h-10 px-3 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value={PlanCode.STARTER}>STARTER</option>
                  <option value={PlanCode.BUSINESS}>BUSINESS</option>
                  <option value={PlanCode.PROFESSIONAL}>PROFESSIONAL</option>
                  <option value={PlanCode.ENTERPRISE}>ENTERPRISE</option>
                  <option value={PlanCode.ENTERPRISE_PLUS}>ENTERPRISE PLUS</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingModule(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (socketRef.current && socketRef.current.connected) {
                      socketRef.current.emit('superadmin-update-module', {
                        feature: editingModule.feature,
                        updates: editingModule,
                        user: { name: 'Super Admin' }
                      });
                    } else {
                      setGlobalModules(prev => prev.map(m => (m.feature === editingModule.feature ? editingModule : m)));
                    }
                    showToast(`Module '${editingModule.name}' updated!`, 'success');
                    setEditingModule(null);
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
