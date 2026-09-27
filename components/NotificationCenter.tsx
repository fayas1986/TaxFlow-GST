import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Bell, BellOff, ShieldAlert, CalendarClock, CheckCircle2, 
  AlertTriangle, RefreshCw, ExternalLink, Sparkles, Volume2, VolumeX,
  Settings2, Clock, Check, ShieldCheck, Lock, Crown, ChevronRight,
  Filter, Eye, EyeOff, Search, Trash2, ArrowUpRight, Zap, AlertOctagon,
  FileCheck2, Activity, Info
} from 'lucide-react';
import { fetchFilingHistory, fetchComplianceAlerts, fetchVendorRisks } from '../services/api';
import { 
  getNotificationPermissionState, 
  requestBrowserNotificationPermission, 
  triggerBrowserNotification, 
  scanAndNotifyComplianceDeadlines,
  NotificationAlertItem,
  checkNotificationSupport,
  playNotificationChime
} from '../utils/browserNotifications';
import { PlanGuard, usePlanGuard, InstantUpgradeModal, PLAN_DISPLAY_NAMES } from './PlanGuard';
import { PlanCode, Feature } from '../src/core/entitlements/types';
import { BillingService } from '../src/core/billing';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';

interface NotificationCenterProps {
  tenantId: string;
  onNavigate: (path: string) => void;
}

const EMPTY_FILINGS: any[] = [];
const EMPTY_ALERTS: any[] = [];
const EMPTY_VENDOR_RISKS: any[] = [];

type FilterTab = 'ALL' | 'DEADLINES' | 'VENDOR_RISKS' | 'TAX_AUDIT_AI';

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ tenantId, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM'>('ALL');
  const [audioChimeEnabled, setAudioChimeEnabled] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [previewEnterpriseTeaser, setPreviewEnterpriseTeaser] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentUser = useSelector((state: RootState) => state.auth.user);

  // Plan entitlement check using PlanGuard suite
  const planGuard = usePlanGuard({ 
    tenantId, 
    feature: Feature.AI, 
    minPlan: PlanCode.ENTERPRISE 
  });
  const isEnterprise = planGuard.isAllowed || planGuard.currentPlan === PlanCode.ENTERPRISE || planGuard.currentPlan === PlanCode.ENTERPRISE_PLUS;

  // Gracefully fallback if non-enterprise user is on enterprise-only tab
  useEffect(() => {
    if (!isEnterprise && activeTab === 'TAX_AUDIT_AI') {
      setActiveTab('ALL');
    }
  }, [isEnterprise, activeTab]);

  // Fetch Filings, Alerts, and Vendor Risks
  const { data: filings, refetch: refetchFilings } = useQuery({
    queryKey: ['filingHistory', tenantId],
    queryFn: () => fetchFilingHistory(tenantId)
  });

  const { data: alerts, refetch: refetchAlerts } = useQuery({
    queryKey: ['complianceAlerts', tenantId],
    queryFn: () => fetchComplianceAlerts(tenantId)
  });

  const { data: vendorRisks, refetch: refetchVendorRisks } = useQuery({
    queryKey: ['vendorRisks', tenantId],
    queryFn: () => fetchVendorRisks(tenantId)
  });

  // State for all scanned raw alerts
  const [rawAlerts, setRawAlerts] = useState<NotificationAlertItem[]>([]);

  // Update permission state on mount
  useEffect(() => {
    setPermissionState(getNotificationPermissionState());
  }, []);

  // Run automated scan when filings, alerts, or tenantId changes
  useEffect(() => {
    let isCancelled = false;
    const runScan = async () => {
      const result = await scanAndNotifyComplianceDeadlines(
        filings || EMPTY_FILINGS, 
        alerts || EMPTY_ALERTS, 
        vendorRisks || EMPTY_VENDOR_RISKS
      );
      if (!isCancelled) {
        const combined = [
          ...result.deadlineAlerts, 
          ...result.riskAlerts,
          ...(result.enterpriseAuditAlerts || [])
        ];
        setRawAlerts(combined);
      }
    };
    runScan();
    return () => {
      isCancelled = true;
    };
  }, [tenantId, filings, alerts, vendorRisks]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Browser Permission Request
  const handleRequestPermission = async () => {
    const perm = await requestBrowserNotificationPermission();
    setPermissionState(perm);
    if (perm === 'granted') {
      if (audioChimeEnabled) playNotificationChime();
      triggerBrowserNotification('✅ Desktop Notifications Enabled', {
        body: 'TaxFlow will now alert you when GST filing deadlines are within 48 hours or critical audit risks occur.',
        force: true
      });
      setScanMessage('Browser notification permission granted successfully!');
    } else if (perm === 'denied') {
      setScanMessage('Notification permission denied. Please allow notifications in browser settings.');
    }
    setTimeout(() => setScanMessage(null), 4000);
  };

  // Trigger test alert
  const handleTestNotification = () => {
    if (permissionState !== 'granted') {
      handleRequestPermission();
      return;
    }
    if (audioChimeEnabled) playNotificationChime();
    const success = triggerBrowserNotification('🚨 GST Deadline & Audit Radar Test', {
      body: 'GSTR-3B Return for July 2026 is due in 24 hours. Net payable liability: ₹1,24,000.',
      force: true,
      onClickUrl: '#/filing'
    });
    if (success) {
      setScanMessage('Test notification dispatched to your desktop!');
    } else {
      setScanMessage('Could not send notification. Please check browser permissions.');
    }
    setTimeout(() => setScanMessage(null), 4000);
  };

  // Manual Scan
  const handleManualScan = async () => {
    setIsScanning(true);
    await Promise.all([refetchFilings(), refetchAlerts(), refetchVendorRisks()]);
    const result = await scanAndNotifyComplianceDeadlines(
      filings || EMPTY_FILINGS, 
      alerts || EMPTY_ALERTS, 
      vendorRisks || EMPTY_VENDOR_RISKS, 
      { forceDesktopAlert: true }
    );
    const combined = [
      ...result.deadlineAlerts, 
      ...result.riskAlerts,
      ...(result.enterpriseAuditAlerts || [])
    ];
    setRawAlerts(combined);
    setIsScanning(false);
    if (audioChimeEnabled) playNotificationChime();

    if (result.notificationsSentCount > 0) {
      setScanMessage(`Dispatched ${result.notificationsSentCount} browser alert(s) to desktop!`);
    } else if (combined.length > 0) {
      setScanMessage(`Scanned ${combined.length} compliance items. Radar is live and synchronized.`);
    } else {
      setScanMessage('All compliance deadlines, vendor risk checks, and audit factors are clean.');
    }
    setTimeout(() => setScanMessage(null), 4000);
  };

  // Dismiss single alert
  const handleDismissAlert = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDismissedIds(prev => new Set(prev).add(id));
  };

  // Toggle read status
  const handleToggleRead = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Mark all as read
  const handleMarkAllRead = () => {
    const allIds = rawAlerts.map(a => a.id);
    setReadIds(new Set(allIds));
    setScanMessage('All notifications marked as read.');
    setTimeout(() => setScanMessage(null), 3000);
  };

  // Clear all non-critical dismissed
  const handleClearDismissed = () => {
    const visibleIds = visibleAlerts.map(a => a.id);
    setDismissedIds(prev => {
      const next = new Set(prev);
      visibleIds.forEach(id => next.add(id));
      return next;
    });
  };

  // =========================================================================
  // STRICT PLAN-BASED FILTERING: HIDE PREMIUM ALERTS FOR STARTER PLANS
  // =========================================================================
  const entitledAlerts = useMemo(() => {
    return rawAlerts.filter(item => {
      if (dismissedIds.has(item.id)) return false;

      // Check if this is an enterprise-only alert (like Tax Audit Risk Score)
      const requiresEnterprise = item.minPlan === PlanCode.ENTERPRISE || item.isPremiumOnly;

      if (requiresEnterprise) {
        // Strict Gating: If user is on Starter / Non-Enterprise plan, DO NOT show in main stream unless preview is enabled
        return isEnterprise || previewEnterpriseTeaser;
      }

      return true;
    });
  }, [rawAlerts, dismissedIds, isEnterprise, previewEnterpriseTeaser]);

  // Count strictly unread, entitled notifications for the Bell Badge
  const unreadEntitledCount = useMemo(() => {
    return entitledAlerts.filter(a => !readIds.has(a.id)).length;
  }, [entitledAlerts, readIds]);

  // Tab counts
  const deadlineCount = useMemo(() => entitledAlerts.filter(a => a.type === 'DEADLINE_48H').length, [entitledAlerts]);
  const vendorRiskCount = useMemo(() => entitledAlerts.filter(a => a.type === 'CRITICAL_RISK').length, [entitledAlerts]);
  const taxAuditRiskCount = useMemo(() => rawAlerts.filter(a => (a.minPlan === PlanCode.ENTERPRISE || a.isPremiumOnly) && !dismissedIds.has(a.id)).length, [rawAlerts, dismissedIds]);

  // Filtered alerts for active tab, search, and severity
  const visibleAlerts = useMemo(() => {
    return entitledAlerts.filter(item => {
      // Tab filter
      if (activeTab === 'DEADLINES' && item.type !== 'DEADLINE_48H') return false;
      if (activeTab === 'VENDOR_RISKS' && item.type !== 'CRITICAL_RISK') return false;
      if (activeTab === 'TAX_AUDIT_AI') {
        const isAudit = item.minPlan === PlanCode.ENTERPRISE || item.isPremiumOnly || item.type === 'TAX_AUDIT_RISK' || item.type === 'AI_ANOMALY';
        if (!isAudit) return false;
      }

      // Severity filter
      if (severityFilter !== 'ALL' && item.severity !== severityFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesBody = item.body.toLowerCase().includes(q);
        const matchesModule = item.sourceModule?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesBody && !matchesModule) return false;
      }

      return true;
    });
  }, [entitledAlerts, activeTab, severityFilter, searchQuery]);

  // Specific featured Tax Audit Risk Alert for highlighted top card
  const featuredAuditAlert = useMemo(() => {
    return rawAlerts.find(a => a.type === 'TAX_AUDIT_RISK' && a.taxAuditScore !== undefined);
  }, [rawAlerts]);

  return (
    <div className="relative" ref={dropdownRef} id="taxflow-notification-center">
      {/* Trigger Button */}
      <button
        id="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-10 h-10 flex items-center justify-center rounded-full border transition-all shadow-xs group focus:outline-none cursor-pointer shrink-0 ${
          unreadEntitledCount > 0 
            ? 'bg-white border-slate-300 text-slate-800 hover:border-indigo-400 hover:bg-indigo-50/40' 
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
        }`}
        title="Compliance Deadlines & Tax Audit Risk Notifications"
        aria-label="Compliance Notifications"
      >
        <Bell size={17} className="group-hover:scale-105 transition-transform text-slate-700" />
        
        {unreadEntitledCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 min-w-[18px] px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white ring-2 ring-white animate-pulse">
            {unreadEntitledCount > 9 ? '9+' : unreadEntitledCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div 
          id="notification-center-dropdown"
          className="absolute right-0 top-full mt-3 w-[440px] max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-right flex flex-col max-h-[85vh]"
        >
          {/* Top Dark Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                <Bell size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black tracking-tight text-white">Compliance & Audit Radar</h4>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                    isEnterprise 
                      ? 'bg-purple-950/80 text-purple-300 border-purple-800' 
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}>
                    {planGuard.currentPlanName}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Automated GSTR Deadlines & Audit Anomaly Watch</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setAudioChimeEnabled(!audioChimeEnabled)}
                className={`p-1.5 rounded-lg transition-colors text-xs ${audioChimeEnabled ? 'text-indigo-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
                title={audioChimeEnabled ? 'Audio Chime Enabled' : 'Audio Chime Muted'}
              >
                {audioChimeEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>

              <button
                onClick={handleManualScan}
                disabled={isScanning}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Rescan Compliance & Audit Radar"
              >
                <RefreshCw size={15} className={isScanning ? 'animate-spin text-indigo-400' : ''} />
              </button>
            </div>
          </div>

          {/* Desktop Permission Strip */}
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                permissionState === 'granted' 
                  ? 'bg-emerald-500 ring-2 ring-emerald-200' 
                  : permissionState === 'denied' 
                    ? 'bg-rose-500' 
                    : 'bg-amber-500 animate-ping'
              }`} />
              <span className="font-semibold text-slate-700 text-[11px]">
                Desktop Alerts: <span className="font-mono uppercase font-bold text-slate-900">{permissionState}</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {permissionState !== 'granted' ? (
                <button
                  onClick={handleRequestPermission}
                  className="px-2.5 py-1 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-all text-[11px] shadow-2xs"
                >
                  Enable Desktop
                </button>
              ) : (
                <button
                  onClick={handleTestNotification}
                  className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-md transition-all text-[10px]"
                >
                  Test Alert
                </button>
              )}
            </div>
          </div>

          {/* Toast Notification Banner */}
          {scanMessage && (
            <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 text-[11px] font-medium text-indigo-900 flex items-center justify-between animate-in fade-in shrink-0">
              <span className="flex items-center gap-1.5">
                <Sparkles size={12} className="text-indigo-600" />
                {scanMessage}
              </span>
            </div>
          )}

          {/* Filter Tabs Header */}
          <div className="px-3 pt-2.5 pb-2 bg-white border-b border-slate-100 flex items-center gap-1 shrink-0 overflow-x-auto">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All ({entitledAlerts.length})
            </button>

            <button
              onClick={() => setActiveTab('DEADLINES')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'DEADLINES'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CalendarClock size={12} />
              Deadlines ({deadlineCount})
            </button>

            <button
              onClick={() => setActiveTab('VENDOR_RISKS')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'VENDOR_RISKS'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ShieldAlert size={12} />
              Vendor Risk ({vendorRiskCount})
            </button>

            {isEnterprise && (
              <button
                onClick={() => setActiveTab('TAX_AUDIT_AI')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                  activeTab === 'TAX_AUDIT_AI'
                    ? 'bg-purple-700 text-white shadow-2xs'
                    : 'text-purple-700 bg-purple-50 hover:bg-purple-100'
                }`}
              >
                <Zap size={12} className="text-purple-600 fill-purple-600" />
                Tax Audit & AI
              </button>
            )}
          </div>

          {/* Quick Search & Control Sub-bar */}
          <div className="px-3 py-1.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
            <div className="relative flex-1">
              <Search size={12} className="absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter alerts by keyword..."
                className="w-full pl-7 pr-2 py-1 bg-white border border-slate-200 rounded-md text-[11px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400"
              />
            </div>

            <div className="flex items-center gap-1">
              {unreadEntitledCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="px-2 py-1 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 rounded transition-colors whitespace-nowrap"
                  title="Mark all as read"
                >
                  Mark All Read
                </button>
              )}
            </div>
          </div>

          {/* Main Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            
            {/* =========================================================================
                FEATURED TAX AUDIT RISK SCORE CARD (Guarded for Enterprise Plans)
               ========================================================================= */}
            {activeTab === 'TAX_AUDIT_AI' ? (
              <PlanGuard
                feature={Feature.AI}
                minPlan={PlanCode.ENTERPRISE}
                mode="upgrade-card"
                upgradeTitle="Tax Audit Risk Score & DRC-01A Radar"
                upgradeDescription="Predictive GST audit exposure scoring, automated NIC E-Way vs GSTR-1 anomaly detection, and Section 16(4) reversal intelligence are available exclusively on the Enterprise Multi-Entity Plan."
                className="my-1"
              >
                {/* Enterprise View: Rich Interactive Tax Audit Risk Score Widget */}
                {featuredAuditAlert && (
                  <div className="p-3.5 bg-linear-to-br from-purple-900 to-slate-900 rounded-xl text-white shadow-md border border-purple-500/40 relative overflow-hidden">
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-purple-500/10 rounded-full blur-xl pointer-events-none" />
                    
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-purple-500/30 text-purple-300 rounded-lg border border-purple-400/40">
                          <AlertOctagon size={16} />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono font-black uppercase tracking-wider text-purple-300 block">
                            Enterprise Audit Engine
                          </span>
                          <h5 className="text-xs font-black text-white">Tax Audit Risk Score (DRC-01A)</h5>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 bg-rose-500/30 text-rose-300 border border-rose-400/40 rounded-full text-[10px] font-mono font-black">
                          Score: {featuredAuditAlert.taxAuditScore}/100
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-purple-100 leading-relaxed mb-3">
                      {featuredAuditAlert.body}
                    </p>

                    {/* Anomaly Factors Breakdown */}
                    {featuredAuditAlert.anomalyFactors && (
                      <div className="p-2 bg-slate-950/60 rounded-lg border border-purple-500/20 mb-3 space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-purple-400 block mb-1">
                          Key Audit Risk Drivers:
                        </span>
                        {featuredAuditAlert.anomalyFactors.map((factor, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 text-[10px] text-slate-300">
                            <span className="text-purple-400 mt-0.5">•</span>
                            <span>{factor}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-purple-500/20 text-xs">
                      <div>
                        <span className="text-[10px] text-purple-300 block">Est. Exposure</span>
                        <span className="text-xs font-mono font-bold text-rose-300">
                          ₹{(featuredAuditAlert.potentialImpact || 185400).toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setIsOpen(false);
                            onNavigate('/compliance');
                          }}
                          className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-[11px] transition-all flex items-center gap-1 shadow-sm"
                        >
                          Run Defense <ArrowUpRight size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </PlanGuard>
            ) : null}

            {/* Plan-Guard Banner for Starter SME when on 'ALL' tab to transparently inform user */}
            {!isEnterprise && activeTab === 'ALL' && (
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg shrink-0">
                    <ShieldCheck size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-800 truncate">Starter Plan Filter Active</p>
                    <p className="text-[10px] text-slate-500">Premium audit risk scores are hidden from this view.</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsUpgradeModalOpen(true)}
                  className="px-2 py-1 bg-white hover:bg-indigo-50 border border-slate-200 text-indigo-700 font-bold rounded-lg text-[10px] shrink-0 transition-colors shadow-2xs"
                >
                  Upgrade Tier
                </button>
              </div>
            )}

            {/* Notification Items List */}
            {visibleAlerts.length === 0 ? (
              <div className="py-10 text-center px-4">
                <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
                <p className="text-xs font-bold text-slate-800">
                  {activeTab === 'TAX_AUDIT_AI' && !isEnterprise 
                    ? 'Enterprise Plan Required for Audit Risk Score' 
                    : 'All Monitored Items Are Clean'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                  {activeTab === 'TAX_AUDIT_AI' && !isEnterprise
                    ? 'Upgrade to Enterprise Multi-Entity to unlock real-time tax audit risk scores, DRC-01A predictions, and Section 16(4) clawback monitoring.'
                    : 'No pending critical deadlines or high-risk vendor alerts detected for the active period.'}
                </p>
              </div>
            ) : (
              visibleAlerts.map((item) => {
                const isRead = readIds.has(item.id);
                const isAuditRisk = item.type === 'TAX_AUDIT_RISK' || item.type === 'AI_ANOMALY';

                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border transition-all flex items-start gap-3 group relative ${
                      isRead 
                        ? 'bg-white border-slate-100 opacity-75 hover:opacity-100' 
                        : isAuditRisk
                          ? 'bg-purple-50/50 border-purple-200/90 shadow-2xs'
                          : item.type === 'DEADLINE_48H'
                            ? 'bg-rose-50/40 border-rose-200/80 shadow-2xs'
                            : 'bg-amber-50/30 border-amber-200/80 shadow-2xs'
                    }`}
                  >
                    {/* Icon Badge */}
                    <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                      isAuditRisk
                        ? 'bg-purple-100 text-purple-700 border border-purple-200'
                        : item.type === 'DEADLINE_48H'
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : 'bg-amber-100 text-amber-700 border border-amber-200'
                    }`}>
                      {isAuditRisk ? (
                        <Zap size={16} />
                      ) : item.type === 'DEADLINE_48H' ? (
                        <CalendarClock size={16} />
                      ) : (
                        <ShieldAlert size={16} />
                      )}
                    </div>

                    {/* Alert Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className={`text-xs font-bold truncate ${isRead ? 'text-slate-700' : 'text-slate-900'}`}>
                            {item.title}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded ${
                            item.severity === 'CRITICAL'
                              ? 'bg-rose-600 text-white'
                              : item.severity === 'HIGH'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                          }`}>
                            {item.severity}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-600 leading-relaxed">{item.body}</p>

                      {/* Source Module & Timestamps */}
                      <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400">
                        <div className="flex items-center gap-2">
                          <span className="font-mono flex items-center gap-1">
                            <Clock size={10} /> {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {item.sourceModule && (
                            <span className="font-medium text-slate-500 hidden sm:inline">• {item.sourceModule}</span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => handleToggleRead(item.id, e)}
                            className="text-slate-400 hover:text-slate-700 text-[10px] font-medium"
                            title={isRead ? 'Mark as unread' : 'Mark as read'}
                          >
                            {isRead ? 'Unread' : 'Read'}
                          </button>

                          <button
                            onClick={(e) => handleDismissAlert(item.id, e)}
                            className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                            title="Dismiss notification"
                          >
                            <Trash2 size={11} />
                          </button>

                          {item.actionUrl && (
                            <button
                              onClick={() => {
                                setIsOpen(false);
                                onNavigate(item.actionUrl!);
                              }}
                              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 ml-1"
                            >
                              Action <ExternalLink size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Navigation Strip */}
          <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-medium shrink-0">
            <button
              onClick={() => {
                setIsOpen(false);
                onNavigate('/compliance');
              }}
              className="text-slate-600 hover:text-indigo-600 font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              Compliance Radar &rarr;
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                onNavigate('/filing');
              }}
              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              File Returns &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Upgrade Modal Integration */}
      <InstantUpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        onConfirm={() => {
          BillingService.upgradePlan(tenantId, PlanCode.ENTERPRISE);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('taxflow:subscription_updated', {
              detail: { tenantId, planId: PlanCode.ENTERPRISE }
            }));
          }
          setIsUpgradeModalOpen(false);
        }}
        currentPlanName={planGuard.currentPlanName}
        targetPlan={PlanCode.ENTERPRISE}
        targetPlanName="Enterprise Multi-Entity"
        featureTitle="Tax Audit Risk Score & DRC-01A Radar"
        featureDescription="Unlock continuous machine learning audit exposure scoring, automated Section 16(4) clawback alerts, and NIC E-Way discrepancy monitoring."
        featureBullets={[
          'Predictive DRC-01A tax notice scoring & audit risk index',
          'NIC E-Way Bill vs GSTR-1 turnover variance tracking',
          'Section 16(4) & Rule 86B cash ledger compliance alerts',
          'Automated audit defense replies and tax discrepancy logs'
        ]}
      />
    </div>
  );
};

export default NotificationCenter;
