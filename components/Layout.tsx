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
  Percent,
  Archive,
  BarChart3
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, logout, switchTenant, setSelectedGstin, setSelectedBranch } from '../store/store';
import { UserRole } from '../types';
import NotificationCenter from './NotificationCenter';
import { useWorkspaceSync } from './WorkspaceSyncContext';
import { useTranslation, Language } from '../utils/i18n';
import QuickTaxCalculator from './QuickTaxCalculator';

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

  const currentTenant = user?.availableTenants.find(t => t.id === user.currentTenantId);
  const currentTenantGstins = gstinsByTenant[user?.currentTenantId || 't1'] || [];
  const currentTenantBranches = branchesByTenant[user?.currentTenantId || 't1'] || [];
  
  const currentSelectedGstinObj = currentTenantGstins.find(g => g.gstin === selectedGstin);
  const currentSelectedBranchObj = currentTenantBranches.find(b => b.id === selectedBranchId);

  // Filter branches based on selected GSTIN if one is chosen
  const visibleBranches = selectedGstin === 'ALL'
    ? currentTenantBranches
    : currentTenantBranches.filter(b => b.gstin === selectedGstin);

  // Role Based Menu Configuration - Real-Time Workflow RBAC
  const allMenuItems = [
    { label: t('nav.dashboard'), icon: LayoutDashboard, path: '/', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER] },
    { label: t('nav.control_tower'), icon: Radio, path: '/control-tower', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER] },
    { label: t('nav.organization'), icon: Building2, path: '/organization', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER] },
    { label: t('nav.parties'), icon: Users, path: '/parties', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER] },
    { label: t('nav.invoices'), icon: FileText, path: '/invoices', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER] },
    { label: t('nav.einvoice'), icon: QrCode, path: '/einvoice', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER] },
    { label: t('nav.ewaybill'), icon: Truck, path: '/ewaybill', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER] },
    { label: t('nav.compliance'), icon: Bell, path: '/compliance', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER] },
    { label: 'Compliance Archive', icon: Archive, path: '/compliance-archive', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER] },
    { label: t('nav.tx_compliance'), icon: ShieldCheck, path: '/transaction-compliance', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.VIEWER] },
    { label: t('nav.rate_calculator'), icon: Percent, path: '/rate-calculator', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER] },
    { label: 'HSN / SAC Lookup', icon: Search, path: '/hsn-lookup', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER] },
    { label: t('nav.computation'), icon: Calculator, path: '/computation', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT] },
    { label: t('nav.reconciliation'), icon: RefreshCw, path: '/reconciliation', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR] },
    { label: t('nav.data_quality'), icon: Cpu, path: '/data-quality', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER] },
    { label: t('nav.exceptions'), icon: AlertTriangle, path: '/exceptions', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR] },
    { label: t('nav.filing'), icon: Send, path: '/filing', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT] },
    { label: t('nav.approvals'), icon: UserCheck, path: '/approvals', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR] },
    { label: t('nav.risk'), icon: AlertTriangle, path: '/risk-analysis', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.AUDITOR] },
    { label: t('nav.tax_forecast'), icon: TrendingUp, path: '/tax-forecasting', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER] },
    { label: t('nav.vault'), icon: ShieldCheck, path: '/vault', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER] },
    { label: t('nav.refunds'), icon: Landmark, path: '/refunds', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER] },
    { label: 'Regulatory Intelligence', icon: BookOpen, path: '/regulatory-intelligence', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER] },
    { label: t('nav.reports'), icon: PieChart, path: '/reports', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER] },
    { label: t('nav.integrations'), icon: Blocks, path: '/integrations', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
    { label: t('nav.audit'), icon: History, path: '/audit', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.AUDITOR] },
    { label: t('nav.settings'), icon: Settings, path: '/settings', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  ];

  const menuItems = allMenuItems.filter(item => user && item.roles.includes(user.role));

  const handleLogout = () => {
    dispatch(logout());
    onNavigate('/login');
  };

  const handleTenantSwitch = (tenantId: string) => {
    dispatch(switchTenant(tenantId));
    setIsTenantMenuOpen(false);
    // onNavigate('/'); // Removed to stay on current page context
  };

  // Filter menu items for global search
  const filteredNavItems = menuItems.filter(item => 
    item.label.toLowerCase().includes(globalSearchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`bg-slate-950 text-white transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'w-72' : 'w-20'
        } flex flex-col relative z-30 shadow-xl border-r border-slate-800/80`}
      >
        {/* Sidebar Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-800/80 bg-slate-950">
          {isSidebarOpen ? (
            <div className="flex items-center gap-3">
               <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md border border-blue-400/30">
                  <Building2 size={20}/> 
               </div>
               <div className="flex flex-col">
                  <span className="font-extrabold text-lg tracking-tight text-white leading-none">
                    TaxFlow
                  </span>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-blue-400 mt-1">
                    ENTERPRISE GST
                  </span>
               </div>
            </div>
          ) : (
             <div className="w-9 h-9 mx-auto rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md border border-blue-400/30">
                <Building2 size={20}/> 
             </div>
          )}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Menu size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto sidebar-scrollbar">
          {menuItems.map((item) => {
            const isActive = item.path === '/reconciliation' 
              ? currentPath.startsWith('/reconciliation')
              : currentPath === item.path || (item.path === '/' && (currentPath === '/dashboard' || currentPath === ''));
            return (
              <button
                key={item.path}
                onClick={() => onNavigate(item.path)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-all duration-150 group relative ${
                  isActive 
                    ? 'bg-blue-600/90 text-white font-bold shadow-sm border border-blue-500/40' 
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                } ${!isSidebarOpen && 'justify-center px-2'}`}
                title={!isSidebarOpen ? item.label : undefined}
              >
                <item.icon 
                  size={19} 
                  className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} 
                />
                
                {isSidebarOpen && (
                  <span className={`text-xs font-semibold truncate tracking-wide ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                    {item.label}
                  </span>
                )}

                {/* Active Indicator for collapsed state */}
                {!isSidebarOpen && isActive && (
                   <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-blue-500 rounded-r-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile Section */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950">
          <div className={`flex items-center gap-3 p-2 rounded-xl transition-colors hover:bg-slate-900 ${!isSidebarOpen && 'justify-center'}`}>
            <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-white shadow-inner shrink-0">
              {user?.name.charAt(0)}
            </div>
            {isSidebarOpen && (
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold truncate text-white">{user?.name}</p>
                <p className="text-[10px] font-mono text-slate-400 truncate uppercase">{user?.role.toLowerCase()}</p>
              </div>
            )}
            {isSidebarOpen && (
              <button 
                onClick={handleLogout} 
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
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
        <div className="absolute inset-0 z-0 opacity-[0.015] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

        {/* Connectivity Status Banner */}
        {!isOnline && (
            <div className="bg-red-500 text-white px-4 py-2 text-center text-sm font-bold flex items-center justify-center gap-2 shadow-md relative z-30 animate-in slide-in-from-top-full">
                <WifiOff size={16}/> You are currently offline. Changes will be synced when connection is restored.
            </div>
        )}
        {isOnline && isSyncing && (
            <div className="bg-blue-500 text-white px-4 py-2 text-center text-sm font-bold flex items-center justify-center gap-2 shadow-md relative z-30 animate-in slide-in-from-top-full">
                <CloudCog size={16} className="animate-spin"/> Syncing offline data...
            </div>
        )}

        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-20 sticky top-0 shadow-sm">
          <div className="flex items-center gap-4">
             <h1 className="text-[26px] font-extrabold text-[#0F172A] tracking-tight">
                {allMenuItems.find(m => m.path === currentPath)?.label || 'Overview'}
             </h1>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Interactive Offline Sync Status Widget */}
            <div className="relative" ref={syncMenuRef}>
              <button 
                onClick={() => setIsSyncMenuOpen(!isSyncMenuOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 border text-xs font-bold rounded-full transition-all shadow-sm cursor-pointer select-none ${
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
                    <WifiOff size={13} className="text-amber-500 shrink-0" />
                    <span>Offline ({Object.keys(formInputs || {}).length} Unsaved)</span>
                  </>
                ) : isWorkspaceSyncing ? (
                  <>
                    <CloudUpload size={13} className="text-blue-500 animate-pulse shrink-0" />
                    <span>Auto-saving...</span>
                  </>
                ) : (
                  <>
                    <Cloud size={13} className="text-emerald-500 shrink-0" />
                    <span>Synced & Secure</span>
                  </>
                )}
                <ChevronDown size={12} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
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

            {/* Quick Tax Calculator Trigger */}
            <button
              onClick={() => setIsCalculatorOpen(true)}
              className="relative w-11 h-11 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-full transition-all group"
              title="Quick Tax Calculator"
            >
              <Calculator size={18} className="group-hover:scale-110 transition-transform" />
            </button>

            
            {/* Language Switcher */}
            <div className="relative" ref={langMenuRef}>
              <button
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="w-11 h-11 flex items-center justify-center rounded-full bg-[#F8FAFC] border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                title="Change Language"
              >
                <Languages size={18} />
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

            {/* Tenant Switcher */}
            <div className="relative" ref={tenantMenuRef}>
              <button 
                onClick={() => setIsTenantMenuOpen(!isTenantMenuOpen)}
                className="flex items-center gap-3 pl-1 pr-3 py-1.5 rounded-full border border-slate-200 bg-white hover:border-blue-200 hover:ring-2 hover:ring-blue-50 transition-all shadow-sm group"
                title="Switch Corporate Entity"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                    {currentTenant?.name.charAt(0)}
                </div>
                <div className="flex flex-col items-start mr-2">
                  <span className="text-sm font-bold text-slate-800 leading-none group-hover:text-blue-700 transition-colors">{currentTenant?.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono leading-none mt-1">PAN: {currentTenant?.gstin.substring(2, 12)}</span>
                </div>
                <ChevronDown size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors"/>
              </button>

              {/* Dropdown */}
              {isTenantMenuOpen && (
                <div className="absolute right-0 top-full mt-3 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 py-3 animate-in fade-in zoom-in-95 duration-150 origin-top-right ring-1 ring-black/5 z-50">
                  <div className="px-5 py-2 border-b border-slate-50 mb-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Switch Organization</p>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto px-2">
                    {user?.availableTenants.map(tenant => (
                      <button
                        key={tenant.id}
                        onClick={() => handleTenantSwitch(tenant.id)}
                        className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group mb-1 ${
                          tenant.id === user.currentTenantId ? 'bg-blue-50/80 border border-blue-100' : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                           <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${tenant.id === user.currentTenantId ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                               {tenant.name.charAt(0)}
                           </div>
                           <div>
                              <p className={`text-sm font-semibold ${tenant.id === user.currentTenantId ? 'text-blue-900' : 'text-slate-700 group-hover:text-slate-900'}`}>
                                {tenant.name}
                              </p>
                              <p className="text-xs text-slate-500 font-mono">{tenant.gstin}</p>
                           </div>
                        </div>
                        {tenant.id === user.currentTenantId && (
                          <div className="bg-blue-100 p-1 rounded-full">
                            <Check size={12} className="text-blue-600" strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  {user?.role === UserRole.ADMIN && (
                    <div className="border-t border-slate-50 mt-2 pt-2 px-4 pb-1">
                       <button onClick={() => onNavigate('/organization')} className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-600 py-2 rounded-lg hover:bg-slate-50 transition-colors border border-dashed border-slate-200 hover:border-blue-200">
                        <Settings size={14}/> Manage Organizations & Branches
                       </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Multi-Branch / Multi-Registration GSTIN Switcher */}
            <div className="relative" ref={gstinMenuRef}>
              <button 
                onClick={() => setIsGstinMenuOpen(!isGstinMenuOpen)}
                className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border transition-all shadow-sm group ${
                  selectedGstin === 'ALL' && selectedBranchId === 'ALL'
                    ? 'bg-slate-50/80 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-slate-700'
                    : 'bg-[#EEF2FF] border-[#C7D2FE] text-[#312E81] hover:bg-[#E0E7FF]'
                }`}
                title="Switch active GSTIN Registration and Branch"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                  selectedGstin === 'ALL' && selectedBranchId === 'ALL'
                    ? 'bg-slate-200/80 text-slate-700'
                    : 'bg-[#4F46E5] text-white shadow-sm'
                }`}>
                  <Layers size={14} />
                </div>
                
                <div className="flex flex-col items-start text-left mr-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-extrabold leading-none text-[#1E3A8A]">
                      {selectedGstin === 'ALL' 
                        ? 'All GSTINs (Consolidated)' 
                        : `${currentSelectedGstinObj?.stateName || 'State'} (${currentSelectedGstinObj?.stateCode || selectedGstin.slice(0, 2)})`
                      }
                    </span>
                    {selectedGstin !== 'ALL' && currentSelectedGstinObj?.isPrimary && (
                      <span className="text-[9px] bg-indigo-200/80 text-indigo-800 font-bold px-1 rounded">HQ</span>
                    )}
                  </div>
                  
                  <span className="text-[10px] text-slate-500 font-mono leading-none mt-1 flex items-center gap-1">
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

                <ChevronDown size={14} className="text-slate-400 group-hover:text-indigo-600 transition-colors ml-1" />
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
                      {currentTenantGstins.length} GSTINs Active
                    </span>
                  </div>

                  <div className="max-h-[380px] overflow-y-auto space-y-3 pr-1">
                    {/* OPTION: Consolidated All GSTINs */}
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

                    {/* SECTION: Specific GSTIN Registrations */}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-1.5 block">
                        State Registrations ({currentTenantGstins.length})
                      </span>
                      <div className="space-y-1.5">
                        {currentTenantGstins.map(g => {
                          const isGstinSelected = selectedGstin === g.gstin;
                          const branchCount = currentTenantBranches.filter(b => b.gstin === g.gstin).length;

                          return (
                            <button
                              key={g.id}
                              onClick={() => {
                                dispatch(setSelectedGstin(g.gstin));
                                dispatch(setSelectedBranch('ALL'));
                                setIsGstinMenuOpen(false);
                              }}
                              className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between border ${
                                isGstinSelected
                                  ? 'bg-indigo-50/90 border-indigo-200 text-indigo-900 shadow-sm'
                                  : 'hover:bg-slate-50 border-slate-100 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold font-mono ${
                                  isGstinSelected ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {g.stateCode}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-slate-900">{g.stateName}</span>
                                    {g.isPrimary && (
                                      <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1 rounded">HQ</span>
                                    )}
                                    {g.registrationType === 'SEZ_UNIT' && (
                                      <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1 rounded">SEZ</span>
                                    )}
                                  </div>
                                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">{g.gstin}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded font-medium border border-slate-100">
                                  {branchCount} {branchCount === 1 ? 'branch' : 'branches'}
                                </span>
                                {isGstinSelected && (
                                  <div className="bg-indigo-600 text-white p-1 rounded-full">
                                    <Check size={12} strokeWidth={3} />
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* SECTION: Branch Specific Filter */}
                    {visibleBranches.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between px-1 mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Branch Unit Filter
                          </span>
                          {selectedBranchId !== 'ALL' && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                dispatch(setSelectedBranch('ALL'));
                              }}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                            >
                              Reset to All Branches
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-1">
                          <button
                            onClick={() => {
                              dispatch(setSelectedBranch('ALL'));
                              setIsGstinMenuOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between ${
                              selectedBranchId === 'ALL'
                                ? 'bg-slate-100 text-slate-900 font-bold'
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <span>All Branches {selectedGstin !== 'ALL' ? 'in this State' : 'in Organization'}</span>
                            {selectedBranchId === 'ALL' && <Check size={12} className="text-indigo-600" />}
                          </button>
                          {visibleBranches.map(branch => (
                            <button
                              key={branch.id}
                              onClick={() => {
                                dispatch(setSelectedBranch(branch.id));
                                if (selectedGstin === 'ALL' && branch.gstin) {
                                  dispatch(setSelectedGstin(branch.gstin));
                                }
                                setIsGstinMenuOpen(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between ${
                                selectedBranchId === branch.id
                                  ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-100'
                                  : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <MapPin size={11} className="text-slate-400 shrink-0" />
                                <span className="truncate">{branch.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">({branch.code})</span>
                              </div>
                              {selectedBranchId === branch.id && <Check size={12} className="text-indigo-600 shrink-0" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer link to manage organization branches */}
                  <div className="border-t border-slate-100 mt-2.5 pt-2 px-1">
                    <button
                      onClick={() => {
                        setIsGstinMenuOpen(false);
                        onNavigate('/organization');
                      }}
                      className="w-full py-2 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 border border-slate-200/80 hover:border-indigo-200"
                    >
                      <GitBranch size={13} /> Manage Multi-Branch Registrations
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="hidden md:flex flex-col items-center justify-center px-4 py-1.5 bg-white text-slate-700 text-xs font-bold rounded-full border border-slate-200 text-center leading-tight">
              <span>FY</span><span><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>2024-25</span>
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
    </div>
  );
};

export default Layout;