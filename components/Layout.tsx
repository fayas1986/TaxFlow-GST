import React, { useState, useRef, useEffect } from 'react';
import { Languages, 
  LayoutDashboard, 
  FileText, 
  RefreshCw, 
  Send, 
  Settings, 
  LogOut, 
  Menu,
  Building2,
  PieChart,
  ChevronDown,
  Check,
  Blocks,
  Calculator,
  Bell,
  Search,
  WifiOff,
  CloudCog,
  X,
  ArrowRight,
  AlertTriangle,
  History,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  Users,
  Cloud,
  CloudUpload,
  QrCode,
  Truck,
  Layers,
  MapPin,
  GitBranch,
  Filter,
  Radio,
  Cpu,
  TrendingUp,
  Landmark,
  BookOpen,
  Calendar,
  Percent,
  Archive,
  BarChart3,
  Database,
  Crown,
  Gauge,
  Zap,
  Sparkles,
  Lock
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, logout, switchTenant, setSelectedGstin, setSelectedBranch } from '../store/store';
import { UserRole } from '../types';
import NotificationCenter from './NotificationCenter';
import { useWorkspaceSync } from './WorkspaceSyncContext';
import { useTranslation, Language } from '../utils/i18n';
import QuickTaxCalculator from './QuickTaxCalculator';
import { entitlementService } from '../src/core/entitlements/entitlementService';
import { Feature, PlanCode, PLANS_CATALOG } from '../src/core/entitlements/types';
import { subscriptionManager, AccessLevel } from '../src/core/billing/SubscriptionManager';
import { BillingService } from '../src/core/billing';
import { InstantUpgradeModal, FEATURE_ENTITLEMENT_DETAILS } from './PlanGuard';

interface LayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentPath, onNavigate }) => {
  const dispatch = useDispatch();
  const { 
    isSyncing: isWorkspaceSyncing, 
    lastSynced: lastWorkspaceSynced,
    formInputs,
    triggerManualSync,
    syncLogs
  } = useWorkspaceSync();
  const user = useSelector((state: RootState) => state.auth.user);
  const { language, setLanguage, t } = useTranslation();
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const selectedGstin = useSelector((state: RootState) => state.org.selectedGstin);
  const selectedBranchId = useSelector((state: RootState) => state.org.selectedBranchId);
  const gstinsByTenant = useSelector((state: RootState) => state.org.gstinsByTenant);
  const branchesByTenant = useSelector((state: RootState) => state.org.branchesByTenant);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTenantMenuOpen, setIsTenantMenuOpen] = useState(false);
  const [isGstinMenuOpen, setIsGstinMenuOpen] = useState(false);
  const [isSyncMenuOpen, setIsSyncMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  
  // Command Palette State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  
  const tenantMenuRef = useRef<HTMLDivElement>(null);
  const gstinMenuRef = useRef<HTMLDivElement>(null);
  const syncMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Connection Status Listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsSyncing(true);
      // Simulate sync delay visually
      setTimeout(() => setIsSyncing(false), 2500);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Global Hotkey for Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when search opens
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isSearchOpen]);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tenantMenuRef.current && !tenantMenuRef.current.contains(event.target as Node)) {
        setIsTenantMenuOpen(false);
      }
      if (gstinMenuRef.current && !gstinMenuRef.current.contains(event.target as Node)) {
        setIsGstinMenuOpen(false);
      }
      if (syncMenuRef.current && !syncMenuRef.current.contains(event.target as Node)) {
        setIsSyncMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Real-time synchronization with subscription and plan changes
  const [subVersion, setSubVersion] = useState(0);
  useEffect(() => {
    const handleSubUpdate = () => {
      setSubVersion(v => v + 1);
    };
    window.addEventListener('taxflow:subscription_updated', handleSubUpdate);
    return () => window.removeEventListener('taxflow:subscription_updated', handleSubUpdate);
  }, []);

  const currentTenant = user?.availableTenants.find(t => t.id === user.currentTenantId);
  const currentTenantGstins = gstinsByTenant[user?.currentTenantId || 't1'] || [];
  const currentTenantBranches = branchesByTenant[user?.currentTenantId || 't1'] || [];
  
  const currentSelectedGstinObj = currentTenantGstins.find(g => g.gstin === selectedGstin);
  const currentSelectedBranchObj = currentTenantBranches.find(b => b.id === selectedBranchId);

  const tenantSubscription = entitlementService.getSubscription(user?.currentTenantId || 't1');
  const activePlan = tenantSubscription ? entitlementService.getPlan(tenantSubscription.planId) : null;
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  const isCustomer = user?.role === UserRole.CUSTOMER;

  const subProfile = subscriptionManager.getUserSubscriptionProfile(user?.role, user?.currentTenantId || 't1');
  const maxAllowedCompanies = subProfile.maxCompanies;
  const maxAllowedGstins = subProfile.maxGstins;
  const canMultiGstin = subProfile.canMultiGstin;

  // Filter branches based on selected GSTIN if one is chosen
  const visibleBranches = selectedGstin === 'ALL'
    ? currentTenantBranches
    : currentTenantBranches.filter(b => b.gstin === selectedGstin);

  // Role & Plan Based Menu Configuration - Real-Time Workflow RBAC
  const allMenuItems: Array<{
    label: string;
    icon: any;
    path: string;
    roles: UserRole[];
    feature?: Feature;
  }> = [
    { label: t('nav.super_admin'), icon: Crown, path: '/super-admin', roles: [UserRole.SUPER_ADMIN] },
    { label: t('nav.dashboard'), icon: LayoutDashboard, path: '/', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER, UserRole.CUSTOMER] },
    { label: t('nav.organization'), icon: Building2, path: '/organization', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER] },
    { label: t('nav.parties'), icon: Users, path: '/parties', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER] },
    { label: t('nav.invoices'), icon: FileText, path: '/invoices', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER, UserRole.CUSTOMER], feature: Feature.INVOICES },
    { label: t('nav.recurring_invoices'), icon: Calendar, path: '/recurring-invoices', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER, UserRole.CUSTOMER], feature: Feature.INVOICES },
    { label: t('nav.einvoice'), icon: QrCode, path: '/einvoice', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER], feature: Feature.E_INVOICE },
    { label: t('nav.ewaybill'), icon: Truck, path: '/ewaybill', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER], feature: Feature.E_WAY_BILL },
    { label: t('nav.compliance'), icon: Bell, path: '/compliance', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER] },
    { label: t('nav.compliance_archive'), icon: Archive, path: '/compliance-archive', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER], feature: Feature.AUTOMATION },
    { label: t('nav.tx_compliance'), icon: ShieldCheck, path: '/transaction-compliance', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.VIEWER], feature: Feature.ITC },
    { label: t('nav.smart_classifier'), icon: Sparkles, path: '/smart-classifier', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER] },
    { label: t('nav.rate_calculator'), icon: Percent, path: '/rate-calculator', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER, UserRole.CUSTOMER] },
    { label: t('nav.hsn_lookup'), icon: Search, path: '/hsn-lookup', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER, UserRole.CUSTOMER] },
    { label: t('nav.computation'), icon: Calculator, path: '/computation', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT], feature: Feature.GST_RETURNS },
    { label: t('nav.reconciliation'), icon: RefreshCw, path: '/reconciliation', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR], feature: Feature.RECONCILIATION },
    { label: t('nav.data_quality'), icon: Cpu, path: '/data-quality', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER], feature: Feature.ADVANCED_RBAC },
    { label: t('nav.exceptions'), icon: AlertTriangle, path: '/exceptions', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR], feature: Feature.RECONCILIATION },
    { label: t('nav.filing'), icon: Send, path: '/filing', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT], feature: Feature.GST_RETURNS },
    { label: t('nav.approvals'), icon: UserCheck, path: '/approvals', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR], feature: Feature.ADVANCED_RBAC },
    { label: t('nav.risk'), icon: AlertTriangle, path: '/risk-analysis', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.AUDITOR], feature: Feature.AI },
    { label: t('nav.tax_forecast'), icon: TrendingUp, path: '/tax-forecasting', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER], feature: Feature.AI },
    { label: t('nav.vault'), icon: ShieldCheck, path: '/vault', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER, UserRole.CUSTOMER], feature: Feature.ADVANCED_RBAC },
    { label: t('nav.refunds'), icon: Landmark, path: '/refunds', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER], feature: Feature.AUTOMATION },
    { label: t('nav.regulatory_intel'), icon: BookOpen, path: '/regulatory-intelligence', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER], feature: Feature.AI },
    { label: t('nav.reports'), icon: PieChart, path: '/reports', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER, UserRole.CUSTOMER] },
    { label: t('nav.tenancy'), icon: Database, path: '/tenancy', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER], feature: Feature.ADVANCED_RBAC },
    { label: t('nav.plan_usage'), icon: Gauge, path: '/plan-usage', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER] },
    { label: t('nav.integrations'), icon: Blocks, path: '/integrations', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN], feature: Feature.ERP_INTEGRATION },
    { label: t('nav.audit'), icon: History, path: '/audit', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.AUDITOR], feature: Feature.AUDIT_LOGS },
    { label: t('nav.settings'), icon: Settings, path: '/settings', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER, UserRole.CUSTOMER] },
  ];

  // Instant Upgrade Modal state
  const [upgradeModal, setUpgradeModal] = useState<{
    isOpen: boolean;
    targetPlan: PlanCode;
    targetPlanName: string;
    featureTitle: string;
    featureDetails: any;
    currentPlanName: string;
  } | null>(null);
  const [isUpgradingPlan, setIsUpgradingPlan] = useState(false);
  const [isPlanTierMenuOpen, setIsPlanTierMenuOpen] = useState(false);
  const planTierMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutsidePlanMenu(event: MouseEvent) {
      if (planTierMenuRef.current && !planTierMenuRef.current.contains(event.target as Node)) {
        setIsPlanTierMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutsidePlanMenu);
    return () => document.removeEventListener("mousedown", handleClickOutsidePlanMenu);
  }, []);

  const handleQuickSwitchPlan = (planCode: PlanCode) => {
    setIsUpgradingPlan(true);
    setTimeout(() => {
      BillingService.setPlan(user?.currentTenantId || 't1', planCode);
      window.dispatchEvent(new CustomEvent('taxflow:subscription_updated'));
      setIsUpgradingPlan(false);
      setIsPlanTierMenuOpen(false);
      setUpgradeModal(null);
    }, 350);
  };

  const menuItems = allMenuItems.filter(item => {
    if (!user) return false;
    // Super Admin has universal platform bypass
    if (isSuperAdmin) return true;
    // Super Admin Command is strictly forbidden for non-Super Admin
    if (item.path === '/super-admin') return false;
    // Role-based visibility: hide items forbidden by role
    if (!item.roles.includes(user.role)) return false;

    // Filter out modules that are not entitled for the active subscription plan
    if (item.feature) {
      const accessCheck = subscriptionManager.checkModuleAccess(
        user.role,
        user.currentTenantId || 't1',
        item.feature,
        item.roles
      );
      if (!accessCheck.granted) {
        return false;
      }
    }

    return true;
  }).map(item => {
    return {
      ...item,
      isLocked: false,
      lockReason: undefined,
      requiredPlan: PlanCode.STARTER,
      requiredPlanName: 'Starter',
      featureDetail: null
    };
  });

  const handleLogout = () => {
    dispatch(logout());
    onNavigate('/login');
  };

  const handleTenantSwitch = (tenantId: string) => {
    dispatch(switchTenant(tenantId));
    setIsTenantMenuOpen(false);
  };

  const handleNavItemClick = (item: typeof menuItems[0]) => {
    if (item.isLocked) {
      setUpgradeModal({
        isOpen: true,
        targetPlan: item.requiredPlan,
        targetPlanName: item.requiredPlanName,
        featureTitle: item.label,
        featureDetails: item.featureDetail,
        currentPlanName: subProfile.planName
      });
    } else {
      onNavigate(item.path);
    }
  };

  // Filter menu items for global search
  const filteredNavItems = menuItems.filter(item => 
    item.label.toLowerCase().includes(globalSearchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`bg-[#090D16] text-white transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'w-72' : 'w-20'
        } flex flex-col relative z-30 shadow-2xl border-r border-slate-800/80`}
      >
        {/* Sidebar Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-800/80 bg-[#090D16]">
          {isSidebarOpen ? (
            <div className="flex items-center gap-3">
               <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/30">
                  <Building2 size={20}/> 
               </div>
               <div className="flex flex-col">
                  <span 
                    onClick={() => onNavigate('/')}
                    className="font-extrabold text-lg tracking-tight text-white leading-none cursor-pointer hover:text-indigo-300 transition-colors"
                  >
                    TaxFlow
                  </span>
                  <button 
                    onClick={() => onNavigate(isSuperAdmin ? '/super-admin' : isCustomer ? '/settings' : '/plan-usage')}
                    className="text-[10px] font-bold tracking-wider uppercase text-indigo-400 mt-1 flex items-center gap-1 hover:text-indigo-300 transition-colors text-left"
                    title={isCustomer ? 'Client Portal' : "View subscription plan and live usage quotas"}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    {isSuperAdmin ? 'SUPER ADMIN COMMAND' : isCustomer ? 'CLIENT PORTAL' : (activePlan?.name ? activePlan.name.toUpperCase() : 'ENTERPRISE GST')}
                  </button>
               </div>
            </div>
          ) : (
             <div className="w-9 h-9 mx-auto rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/30">
                <Building2 size={20}/> 
             </div>
          )}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title={isSidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
          >
            <Menu size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto sidebar-scrollbar">
          {menuItems.map((item) => {
            const isActive = item.path === '/reconciliation' 
              ? currentPath.startsWith('/reconciliation')
              : currentPath === item.path || (item.path === '/' && (currentPath === '/dashboard' || currentPath === ''));
            const isSuperAdmin = item.path === '/super-admin';
            return (
              <button
                key={item.path}
                onClick={() => handleNavItemClick(item)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 group relative cursor-pointer ${
                  isActive 
                    ? isSuperAdmin
                      ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold shadow-md shadow-amber-600/20 border border-amber-500/40'
                      : 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-bold shadow-md shadow-indigo-600/25 border border-indigo-500/40'
                    : item.isLocked
                      ? 'text-slate-500 hover:bg-slate-900/60 hover:text-slate-300 opacity-75 hover:opacity-100'
                      : isSuperAdmin
                        ? 'text-amber-400/90 hover:bg-amber-950/40 hover:text-amber-300 font-semibold'
                        : 'text-slate-400 hover:bg-slate-900/90 hover:text-slate-100'
                } ${!isSidebarOpen && 'justify-center px-2'}`}
                title={!isSidebarOpen ? `${item.label}${item.isLocked ? ` (Requires ${item.requiredPlanName})` : ''}` : undefined}
              >
                <item.icon 
                  size={19} 
                  className={`shrink-0 transition-colors ${
                    isActive 
                      ? 'text-white' 
                      : item.isLocked
                        ? 'text-slate-500 group-hover:text-amber-400'
                        : isSuperAdmin 
                          ? 'text-amber-400 group-hover:text-amber-300' 
                          : 'text-slate-400 group-hover:text-slate-200'
                  }`} 
                />
                
                {isSidebarOpen && (
                  <span className={`text-xs font-semibold truncate tracking-wide ${
                    isActive 
                      ? 'text-white' 
                      : item.isLocked
                        ? 'text-slate-400 group-hover:text-slate-200'
                        : isSuperAdmin 
                          ? 'text-amber-300' 
                          : 'text-slate-300 group-hover:text-white'
                  }`}>
                    {item.label}
                  </span>
                )}

                {isSidebarOpen && isSuperAdmin && !isActive && (
                  <span className="ml-auto text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                    Admin
                  </span>
                )}

                {isSidebarOpen && item.isLocked && !isSuperAdmin && (
                  <span className="ml-auto text-[9px] font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-300/90 px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                    <Lock size={9} />
                    {item.requiredPlanName}
                  </span>
                )}

                {/* Active Indicator for collapsed state */}
                {!isSidebarOpen && isActive && (
                   <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-r-full ${isSuperAdmin ? 'bg-amber-400' : 'bg-indigo-500'}`} />
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile Section */}
        <div className="p-4 border-t border-slate-800/80 bg-[#090D16]">
          <div className={`flex items-center gap-3 p-2 rounded-xl transition-colors hover:bg-slate-900 ${!isSidebarOpen && 'justify-center'}`}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-700 flex items-center justify-center text-sm font-bold text-white shadow-inner shrink-0">
              {user?.name.charAt(0)}
            </div>
            {isSidebarOpen && (
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold truncate text-white">{user?.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-mono text-indigo-400 truncate uppercase">{isCustomer ? 'Client Portal' : user?.role.toLowerCase()}</span>
                  {!isCustomer && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30 truncate">
                      {subProfile.planName}
                    </span>
                  )}
                </div>
              </div>
            )}
            {isSidebarOpen && (
              <button 
                onClick={handleLogout} 
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-[#F8FAFC]">
        {/* Background Pattern */}
        <div className="absolute inset-0 z-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

        {/* Connectivity Status Banner */}
        {!isOnline && (
            <div className="bg-rose-600 text-white px-4 py-2 text-center text-sm font-bold flex items-center justify-center gap-2 shadow-md relative z-30 animate-in slide-in-from-top-full">
                <WifiOff size={16}/> You are currently offline. Changes will be synced when connection is restored.
            </div>
        )}
        {isOnline && isSyncing && (
            <div className="bg-indigo-600 text-white px-4 py-2 text-center text-sm font-bold flex items-center justify-center gap-2 shadow-md relative z-30 animate-in slide-in-from-top-full">
                <CloudCog size={16} className="animate-spin"/> Syncing offline data...
            </div>
        )}

        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200/80 flex items-center justify-between px-8 z-20 sticky top-0 shadow-xs">
          <div className="flex items-center gap-4 min-w-0">
             <h1 className="text-[22px] font-extrabold text-slate-900 tracking-tight truncate">
                {isCustomer && (currentPath === '/' || currentPath === '/dashboard')
                  ? 'Client Portal'
                  : (allMenuItems.find(m => m.path === currentPath)?.label || 'Overview')}
             </h1>
          </div>
          
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Interactive Offline Sync Status Widget (Internal/Staff only when active) */}
            {!isCustomer && (
              <div className="relative" ref={syncMenuRef}>
                <button 
                  onClick={() => setIsSyncMenuOpen(!isSyncMenuOpen)}
                  className={`h-10 flex items-center gap-2 px-3.5 border text-xs font-bold rounded-full transition-all shadow-xs cursor-pointer select-none shrink-0 ${
                    !isOnline 
                      ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100/75 animate-pulse' 
                      : isWorkspaceSyncing 
                        ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100/75' 
                        : 'bg-[#ECFDF5] border-[#A7F3D0] text-[#047857] hover:bg-[#D1FAE5]'
                  }`}
                  title="Click to view Offline Sync Status & Queue details"
                >
                  {!isOnline ? (
                    <>
                      <WifiOff size={14} className="text-amber-500 shrink-0" />
                      <span>Offline ({Object.keys(formInputs || {}).length} Unsaved)</span>
                    </>
                  ) : isWorkspaceSyncing ? (
                    <>
                      <CloudUpload size={14} className="text-blue-500 animate-pulse shrink-0" />
                      <span>Auto-saving...</span>
                    </>
                  ) : (
                    <>
                      <Cloud size={14} className="text-emerald-500 shrink-0" />
                      <span>Synced & Secure</span>
                    </>
                  )}
                  <ChevronDown size={13} className="text-slate-400 group-hover:text-slate-600 transition-colors ml-0.5" />
                </button>

                {/* Offline Sync Status Dropdown Drawer */}
                {isSyncMenuOpen && (
                  <div className="absolute right-0 top-full mt-3 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 py-4 px-4 animate-in fade-in zoom-in-95 duration-150 origin-top-right ring-1 ring-black/5 z-[9999]">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-400">Sync Monitor</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'}`} />
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{isOnline ? 'Online' : 'Offline Mode'}</span>
                      </div>
                    </div>

                    {/* Network state feedback */}
                    <div className={`p-3 rounded-xl mb-3 text-xs leading-relaxed font-medium ${
                      !isOnline 
                        ? 'bg-amber-50/70 border border-amber-100 text-amber-800' 
                        : 'bg-emerald-50/70 border border-emerald-100 text-emerald-800'
                    }`}>
                      {!isOnline ? (
                        <p>
                          Your internet connection is temporarily offline. All actions and draft form edits are stored securely in local browser cache and will auto-sync the moment your connection recovers.
                        </p>
                      ) : (
                        <p>
                          Connected to secure servers. Your current workspace states, draft logs, and audit trails are fully synced.
                        </p>
                      )}
                    </div>

                    {/* Pending Queue Listing */}
                    <div className="space-y-2 mb-4">
                      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex justify-between">
                        <span>Pending Sync Queue</span>
                        <span>{Object.keys(formInputs || {}).length} item(s)</span>
                      </span>
                      {Object.keys(formInputs || {}).length === 0 ? (
                        <div className="text-center py-4 text-slate-400 font-medium text-[11px] bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          No pending operations
                        </div>
                      ) : (
                        <div className="max-h-[150px] overflow-y-auto space-y-1.5 pr-1">
                          {Object.keys(formInputs || {}).map((key) => {
                            const displayName = key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                            return (
                              <div key={key} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg text-[11px] font-bold">
                                <span className="text-slate-700 truncate max-w-[180px]">{displayName}</span>
                                <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100/60 font-black flex items-center gap-1 shrink-0">
                                  <span className="w-1 h-1 rounded-full bg-amber-500 animate-ping" />
                                  Offline Edit
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Sync logs timeline */}
                    {syncLogs && syncLogs.length > 0 && (
                      <div className="space-y-2 mb-4">
                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Recent Cloud Logs</span>
                        <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-1">
                          {syncLogs.slice(0, 3).map((log) => (
                            <div key={log.id} className="flex justify-between items-center text-[10px] text-slate-500">
                              <span className="truncate max-w-[140px] font-mono">{new Date(log.timestamp).toLocaleTimeString()} ({log.size})</span>
                              <span className={`px-1.5 py-0.5 rounded font-bold ${
                                log.status === 'SUCCESS' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
                              }`}>{log.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Force sync action */}
                    {isOnline && (
                      <button
                        onClick={async () => {
                          try {
                            await triggerManualSync();
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        disabled={isWorkspaceSyncing}
                        className="w-full py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-100 text-slate-600 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={isWorkspaceSyncing ? 'animate-spin' : ''} />
                        {isWorkspaceSyncing ? 'Syncing Now...' : 'Force Sync Verification'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Quick Tax Calculator Trigger */}
            <button
              onClick={() => setIsCalculatorOpen(true)}
              className="w-10 h-10 flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-full transition-all shadow-xs shrink-0 cursor-pointer group"
              title="Quick Tax Calculator"
            >
              <Calculator size={17} className="group-hover:scale-105 transition-transform text-slate-700" />
            </button>

            {/* Language Switcher */}
            <div className="relative" ref={langMenuRef}>
              <button
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 hover:border-slate-300 transition-all shadow-xs shrink-0 cursor-pointer"
                title="Change Language"
              >
                <Languages size={17} />
              </button>
              
              {isLangMenuOpen && (
                <div className="absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Interface Language</span>
                  </div>
                  <div className="p-1">
                    {[
                      { code: 'en', name: 'English' },
                      { code: 'hi', name: 'हिन्दी (Hindi)' },
                      { code: 'gu', name: 'ગુજરાતી (Gujarati)' },
                      { code: 'mr', name: 'मराठी (Marathi)' },
                      { code: 'ta', name: 'தமிழ் (Tamil)' },
                      { code: 'te', name: 'తెలుగు (Telugu)' }
                    ].map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code as any);
                          setIsLangMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between transition-colors ${language === lang.code ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-100'}`}
                      >
                        {lang.name}
                        {language === lang.code && <Check size={14} className="text-blue-600" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <NotificationCenter tenantId={user?.currentTenantId || 't1'} onNavigate={onNavigate} />

            {/* Tenant Display (Static for Starter Plan, Switcher for Multi-Entity) */}
            {maxAllowedCompanies <= 1 && !isSuperAdmin ? (
              <div className="h-10 flex items-center gap-2.5 px-3 rounded-full border border-slate-200 bg-white shadow-xs shrink-0">
                <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                  {currentTenant?.name.charAt(0) || 'A'}
                </div>
                <div className="flex flex-col text-left justify-center mr-1">
                  <span className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[120px]">{currentTenant?.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono leading-tight">PAN: {currentTenant?.gstin.substring(2, 12)}</span>
                </div>
              </div>
            ) : (
              <div className="relative" ref={tenantMenuRef}>
                <button 
                  onClick={() => setIsTenantMenuOpen(!isTenantMenuOpen)}
                  className="h-10 flex items-center gap-2.5 pl-1.5 pr-3 rounded-full border border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50/60 transition-all shadow-xs group cursor-pointer shrink-0"
                  title="Switch Corporate Entity"
                >
                  <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                      {currentTenant?.name.charAt(0)}
                  </div>
                  <div className="flex flex-col text-left justify-center mr-1">
                    <span className="text-xs font-bold text-slate-800 leading-tight group-hover:text-blue-700 transition-colors truncate max-w-[120px]">{currentTenant?.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono leading-tight">PAN: {currentTenant?.gstin.substring(2, 12)}</span>
                  </div>
                  <ChevronDown size={13} className="text-slate-400 group-hover:text-blue-500 transition-colors shrink-0"/>
                </button>

                {/* Dropdown */}
                {isTenantMenuOpen && (
                  <div className="absolute right-0 top-full mt-3 w-84 bg-white rounded-2xl shadow-xl border border-slate-100 py-3 animate-in fade-in zoom-in-95 duration-150 origin-top-right ring-1 ring-black/5 z-50">
                    <div className="px-5 py-2 border-b border-slate-50 mb-2 flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Switch Organization</p>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                        {Math.min(user?.availableTenants.length || 1, maxAllowedCompanies)} of {maxAllowedCompanies === 999 ? '∞' : maxAllowedCompanies} Allowed
                      </span>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto px-2">
                      {user?.availableTenants.slice(0, maxAllowedCompanies).map(tenant => {
                        const sub = entitlementService.getSubscription(tenant.id);
                        const plan = sub ? entitlementService.getPlan(sub.planId) : null;
                        const isCurrent = tenant.id === user.currentTenantId;

                        return (
                          <button
                            key={tenant.id}
                            onClick={() => handleTenantSwitch(tenant.id)}
                            className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group mb-1 ${
                              isCurrent ? 'bg-blue-50/80 border border-blue-100' : 'hover:bg-slate-50 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                               <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${isCurrent ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                                   {tenant.name.charAt(0)}
                               </div>
                               <div>
                                  <div className="flex items-center gap-2">
                                    <p className={`text-sm font-semibold ${isCurrent ? 'text-blue-900' : 'text-slate-700 group-hover:text-slate-900'}`}>
                                      {tenant.name}
                                    </p>
                                    {plan && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                        {plan.name.split(' ')[0]}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 font-mono">{tenant.gstin}</p>
                               </div>
                            </div>
                            {isCurrent && (
                              <div className="bg-blue-100 p-1 rounded-full">
                                <Check size={12} className="text-blue-600" strokeWidth={3} />
                              </div>
                            )}
                          </button>
                        );
                      })}

                      {/* Show upgrade prompt if there are more group companies than allowed on current plan */}
                      {!isSuperAdmin && user?.availableTenants && user.availableTenants.length > maxAllowedCompanies && (
                        <div className="p-3 my-1 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center">
                          <p className="text-xs text-slate-600 font-medium">
                            +{user.availableTenants.length - maxAllowedCompanies} more group entities available
                          </p>
                          <button
                            onClick={() => {
                              setIsTenantMenuOpen(false);
                              onNavigate('/plan-usage');
                            }}
                            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-extrabold text-blue-600 hover:text-blue-700 cursor-pointer"
                          >
                            <Sparkles size={11} /> Upgrade for Multi-Entity Conglomerate Access
                          </button>
                        </div>
                      )}
                    </div>
                    {user?.role === UserRole.ADMIN && (
                      <div className="border-t border-slate-50 mt-2 pt-2 px-4 pb-1">
                         <button onClick={() => onNavigate('/organization')} className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-600 py-2 rounded-lg hover:bg-slate-50 transition-colors border border-dashed border-slate-200 hover:border-blue-200 cursor-pointer">
                          <Settings size={14}/> Manage Organizations & Branches
                         </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* GSTIN / Branch Display (Single State Tag for Starter, Switcher for Multi-GSTIN/Branch) */}
            {!isSuperAdmin && !canMultiGstin && !subProfile.canMultiBranch && maxAllowedGstins <= 1 ? (
              <div className="h-10 flex items-center gap-2 px-3 rounded-full border border-slate-200 bg-slate-50/80 text-slate-700 shadow-xs shrink-0">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                  <Check size={12} />
                </div>
                <div className="flex flex-col text-left justify-center">
                  <span className="text-xs font-bold text-slate-800 leading-tight">
                    {currentSelectedGstinObj?.stateName || 'Maharashtra'} ({currentSelectedGstinObj?.stateCode || currentTenant?.gstin.slice(0, 2) || '27'})
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono leading-tight">
                    {currentTenant?.gstin}
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative" ref={gstinMenuRef}>
                <button 
                  onClick={() => setIsGstinMenuOpen(!isGstinMenuOpen)}
                  className={`h-10 flex items-center gap-2.5 px-3 rounded-full border transition-all shadow-xs group cursor-pointer shrink-0 ${
                    selectedGstin === 'ALL' && selectedBranchId === 'ALL'
                      ? 'bg-slate-50/80 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-slate-700'
                      : 'bg-[#EEF2FF] border-[#C7D2FE] text-[#312E81] hover:bg-[#E0E7FF]'
                  }`}
                  title="Switch active GSTIN Registration and Branch"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                    selectedGstin === 'ALL' && selectedBranchId === 'ALL'
                      ? 'bg-slate-200/80 text-slate-700'
                      : 'bg-[#4F46E5] text-white shadow-xs'
                  }`}>
                    <Layers size={12} />
                  </div>
                  
                  <div className="flex flex-col text-left justify-center mr-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold leading-tight text-[#1E3A8A]">
                        {selectedGstin === 'ALL' 
                          ? 'All GSTINs' 
                          : `${currentSelectedGstinObj?.stateName || 'State'} (${currentSelectedGstinObj?.stateCode || selectedGstin.slice(0, 2)})`
                        }
                      </span>
                      {selectedGstin !== 'ALL' && currentSelectedGstinObj?.isPrimary && (
                        <span className="text-[8px] bg-indigo-200/80 text-indigo-800 font-bold px-1 rounded">HQ</span>
                      )}
                    </div>
                    
                    <span className="text-[10px] text-slate-500 font-mono leading-tight flex items-center gap-1">
                      {selectedGstin === 'ALL' ? (
                        <span>{currentTenantGstins.length} States • {currentTenantBranches.length} Branches</span>
                      ) : (
                        <>
                          <span>{selectedGstin}</span>
                          {selectedBranchId !== 'ALL' && currentSelectedBranchObj && (
                            <span className="text-indigo-600 font-sans font-semibold"> • {currentSelectedBranchObj.name}</span>
                          )}
                        </>
                      )}
                    </span>
                  </div>

                  <ChevronDown size={13} className="text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
                </button>

                {/* GSTIN & Branch Selector Dropdown */}
                {isGstinMenuOpen && (
                  <div className="absolute right-0 top-full mt-3 w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 py-3.5 px-3 animate-in fade-in zoom-in-95 duration-150 origin-top-right ring-1 ring-black/5 z-50">
                    <div className="flex items-center justify-between px-2 pb-2.5 border-b border-slate-100 mb-2">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                          <Building2 size={13} className="text-indigo-600" />
                          GST Registration & Branch
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">Filter all analytics, reports & invoices</p>
                      </div>
                      <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                        {Math.min(currentTenantGstins.length, maxAllowedGstins)} of {maxAllowedGstins === 999 ? '∞' : maxAllowedGstins} GSTIN Allowed
                      </span>
                    </div>

                    <div className="max-h-[380px] overflow-y-auto space-y-3 pr-1">
                      {/* OPTION: Consolidated All GSTINs (Only if plan allows multi-GSTIN) */}
                      {canMultiGstin && currentTenantGstins.length > 1 && (
                        <div>
                          <button
                            onClick={() => {
                              dispatch(setSelectedGstin('ALL'));
                              dispatch(setSelectedBranch('ALL'));
                              setIsGstinMenuOpen(false);
                            }}
                            className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between border ${
                              selectedGstin === 'ALL' && selectedBranchId === 'ALL'
                                ? 'bg-indigo-50/90 border-indigo-200 text-indigo-900 shadow-sm'
                                : 'hover:bg-slate-50 border-slate-100 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                                selectedGstin === 'ALL' && selectedBranchId === 'ALL' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                              }`}>
                                <Layers size={16} />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-900">All GSTIN Registrations</span>
                                  <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-bold uppercase">Consolidated</span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5">Aggregate rollup across all states and branches</p>
                              </div>
                            </div>
                            {selectedGstin === 'ALL' && selectedBranchId === 'ALL' && (
                              <div className="bg-indigo-600 text-white p-1 rounded-full">
                                <Check size={12} strokeWidth={3} />
                              </div>
                            )}
                          </button>
                        </div>
                      )}

                      {/* SECTION: Specific GSTIN Registrations */}
                      <div>
                        <div className="flex items-center justify-between px-1 mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            State Registrations ({Math.min(currentTenantGstins.length, maxAllowedGstins)} Active)
                          </span>
                          {!canMultiGstin && (
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Single State Quota
                            </span>
                          )}
                        </div>

                        <div className="space-y-1">
                          {currentTenantGstins.slice(0, maxAllowedGstins).map(g => {
                            const isSelected = selectedGstin === g.gstin;
                            const stateBranches = currentTenantBranches.filter(b => b.gstin === g.gstin);

                            return (
                              <div key={g.gstin} className="rounded-xl border border-slate-100 bg-white overflow-hidden shadow-xs">
                                <button
                                  onClick={() => {
                                    dispatch(setSelectedGstin(g.gstin));
                                    dispatch(setSelectedBranch('ALL'));
                                    setIsGstinMenuOpen(false);
                                  }}
                                  className={`w-full text-left p-2.5 flex items-center justify-between transition-all ${
                                    isSelected && selectedBranchId === 'ALL'
                                      ? 'bg-blue-50/80 text-blue-900 font-semibold'
                                      : 'hover:bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                                      isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      {g.stateCode}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-bold text-slate-900">{g.stateName}</span>
                                        {g.isPrimary && (
                                          <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1 py-0.2 rounded font-bold">Principal Place / HQ</span>
                                        )}
                                      </div>
                                      <span className="text-[11px] font-mono text-slate-500">{g.gstin}</span>
                                    </div>
                                  </div>
                                  {isSelected && selectedBranchId === 'ALL' && (
                                    <div className="bg-blue-600 text-white p-1 rounded-full">
                                      <Check size={11} strokeWidth={3} />
                                    </div>
                                  )}
                                </button>

                                {/* Branch List for this GSTIN */}
                                {subProfile.canMultiBranch && stateBranches.length > 0 && (
                                  <div className="bg-slate-50/60 px-3 py-1.5 border-t border-slate-100 space-y-1">
                                    <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                      <span>Branches ({stateBranches.length})</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1">
                                      {stateBranches.map(branch => {
                                        const isBranchActive = selectedGstin === g.gstin && selectedBranchId === branch.id;
                                        return (
                                          <button
                                            key={branch.id}
                                            onClick={() => {
                                              dispatch(setSelectedGstin(g.gstin));
                                              dispatch(setSelectedBranch(branch.id));
                                              setIsGstinMenuOpen(false);
                                            }}
                                            className={`text-left text-xs px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors ${
                                              isBranchActive
                                                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                                                : 'hover:bg-slate-200/60 text-slate-600'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2">
                                              <MapPin size={11} className={isBranchActive ? 'text-indigo-200' : 'text-slate-400'} />
                                              <span>{branch.name}</span>
                                              <span className={`text-[10px] px-1 rounded ${isBranchActive ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200 text-slate-600'}`}>
                                                {branch.type || branch.code}
                                              </span>
                                            </div>
                                            {isBranchActive && <Check size={11} strokeWidth={3} />}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="hidden md:flex h-10 items-center gap-1.5 px-3.5 bg-white text-slate-700 text-xs font-bold rounded-full border border-slate-200 shadow-xs shrink-0">
              <span className="text-slate-500 font-semibold">FY</span>
              <span className="inline-flex items-center gap-1 text-slate-800 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                2026–27
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto scroll-smooth">
          <div className="p-8 max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </div>
      </main>

      {/* Command Palette Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                <div className="flex items-center px-4 py-3 border-b border-slate-100 bg-white">
                    <Search size={20} className="text-slate-400 mr-3"/>
                    <input
                        ref={searchInputRef}
                        className="flex-1 text-lg placeholder:text-slate-400 outline-none text-slate-800 bg-transparent h-10"
                        placeholder="Search for pages, reports, or actions..."
                        value={globalSearchQuery}
                        onChange={(e) => setGlobalSearchQuery(e.target.value)}
                    />
                    <button onClick={() => setIsSearchOpen(false)} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                        <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded border border-slate-200">ESC</span>
                    </button>
                </div>
                
                <div className="max-h-[60vh] overflow-y-auto p-2">
                    <p className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Navigation</p>
                    {filteredNavItems.length > 0 ? (
                        filteredNavItems.map((item) => (
                            <button
                                key={item.path}
                                onClick={() => {
                                    onNavigate(item.path);
                                    setIsSearchOpen(false);
                                    setGlobalSearchQuery('');
                                }}
                                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left group"
                            >
                                <div className="p-2 bg-slate-100 text-slate-500 rounded-lg group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                    <item.icon size={18}/>
                                </div>
                                <span className="font-medium text-slate-700 group-hover:text-slate-900">{item.label}</span>
                                <ArrowRight size={16} className="ml-auto text-slate-300 opacity-0 group-hover:opacity-100 transition-all"/>
                            </button>
                        ))
                    ) : (
                        <div className="px-3 py-4 text-center text-slate-500 text-sm">
                            No results found.
                        </div>
                    )}
                </div>
                <div className="bg-slate-50 border-t border-slate-100 px-4 py-2 flex justify-between items-center text-xs text-slate-400">
                    <span><strong>ProTip:</strong> Use ↑↓ to navigate</span>
                    <span>TaxFlow Command</span>
                </div>
            </div>
        </div>
      )}

      {/* Quick Tax Calculator Drawer */}
      <QuickTaxCalculator isOpen={isCalculatorOpen} onClose={() => setIsCalculatorOpen(false)} />

      {/* Global Plan Upgrade Modal */}
      {upgradeModal && (
        <InstantUpgradeModal 
          isOpen={upgradeModal.isOpen}
          onClose={() => setUpgradeModal(null)}
          targetPlan={upgradeModal.targetPlan}
          targetPlanName={upgradeModal.targetPlanName}
          featureTitle={upgradeModal.featureTitle}
          featureDetails={upgradeModal.featureDetails}
          currentPlanName={upgradeModal.currentPlanName}
          onConfirm={() => handleQuickSwitchPlan(upgradeModal.targetPlan)}
          isUpgrading={isUpgradingPlan}
        />
      )}
    </div>
  );
};

export default Layout;