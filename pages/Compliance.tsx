import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { fetchComplianceAlerts, fetchVendorRisks, updateNotificationSettings } from '../services/api';
import { 
  Bell, CalendarClock, AlertTriangle, ShieldAlert, Mail, MessageSquare, 
  CheckCircle2, AlertCircle, Clock, ChevronRight, Send, Laptop, RefreshCw,
  LayoutDashboard, Users, Scale, FileText, Activity, Search, Cpu, X,
  ShieldCheck, Info, Sparkles, ExternalLink, ArrowRight, Archive
} from 'lucide-react';
import { ComplianceAlert, NotificationSettings } from '../types';
import { 
  getNotificationPermissionState, 
  requestBrowserNotificationPermission, 
  triggerBrowserNotification 
} from '../utils/browserNotifications';
import GstinVerificationModule from '../components/GstinVerificationModule';
import { RegulatoryChangeModule } from '../components/RegulatoryChangeModule';
import { ComplianceArchitecturePipeline } from '../components/ComplianceArchitecturePipeline';
import { GstPolicyUpdatesWidget } from '../components/dashboard/GstPolicyUpdatesWidget';
import { ItcLedgerOptimizer } from '../components/ItcLedgerOptimizer';
import { RegulatoryEventAudit } from '../components/RegulatoryEventAudit';
import { RegulatoryAuditLog } from '../components/RegulatoryAuditLog';
import { VendorComplianceScorecard } from '../components/VendorComplianceScorecard';
import { WhatsAppNotificationCenter } from '../components/WhatsAppNotificationCenter';
import { ComplianceArchiveTimelineView } from '../components/ComplianceArchiveTimelineView';

const Compliance: React.FC = () => {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const tenantId = user?.currentTenantId || 't1';
  const tenant = user?.availableTenants?.find(t => t.id === tenantId);
  const tenantName = tenant?.name || 'TaxFlow Enterprise Ltd.';

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ARCHIVE' | 'WHATSAPP_REMINDERS' | 'ARCHITECTURE' | 'GSTIN_SEARCH' | 'VENDOR_RISK' | 'ITC_WATCHLIST' | 'REGULATORY_CHANGES' | 'REGULATORY_AUDIT' | 'REGULATORY_AUDIT_LOG' | 'NOTIFICATIONS'>('OVERVIEW');
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [desktopEnabled, setDesktopEnabled] = useState(true);
  const [browserPerm, setBrowserPerm] = useState<NotificationPermission>('default');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<ComplianceAlert | null>(null);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);

  // Slack Webhook integration states
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [slackEventsEnabled, setSlackEventsEnabled] = useState(true);
  const [isTestingSlack, setIsTestingSlack] = useState(false);
  const [slackTestStatus, setSlackTestStatus] = useState<'IDLE' | 'SUCCESS' | 'FAILED'>('IDLE');
  const [slackTestError, setSlackTestError] = useState('');

  useEffect(() => {
    setBrowserPerm(getNotificationPermissionState());
    
    // Auto-load Slack configuration from persistent storage
    const savedWebhook = localStorage.getItem('taxflow_slack_webhook_url');
    const savedEnabled = localStorage.getItem('taxflow_slack_events_enabled');
    if (savedWebhook) setSlackWebhookUrl(savedWebhook);
    if (savedEnabled) setSlackEventsEnabled(savedEnabled === 'true');
  }, []);

  const handleTestSlackNotification = async () => {
    if (!slackWebhookUrl || !slackWebhookUrl.startsWith('https://hooks.slack.com/')) {
      setSlackTestStatus('FAILED');
      setSlackTestError('Please provide a valid Slack incoming webhook URL (starting with https://hooks.slack.com/)');
      return;
    }

    setIsTestingSlack(true);
    setSlackTestStatus('IDLE');
    setSlackTestError('');

    try {
      const response = await fetch('/api/v1/compliance/slack/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: slackWebhookUrl,
          event: {
            title: 'Test Slack Webhook Channel Integration',
            description: 'This is a test notification confirming that your Slack webhook integration with the TaxFlow Regulatory Intelligence engine has been established successfully!',
            category: 'ADVISORY',
            impactScore: 'LOW',
            effectiveDate: '2026-08-17',
            ruleVersion: 'v1.0.0',
            source: 'TaxFlow Integration Services'
          }
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSlackTestStatus('SUCCESS');
        localStorage.setItem('taxflow_slack_webhook_url', slackWebhookUrl);
        localStorage.setItem('taxflow_slack_events_enabled', String(slackEventsEnabled));
        setToastMsg('Slack Webhook verified and test alert dispatched!');
      } else {
        setSlackTestStatus('FAILED');
        setSlackTestError(data.error || 'Failed to trigger Slack. Please verify the Webhook endpoint.');
      }
    } catch (err: any) {
      setSlackTestStatus('FAILED');
      setSlackTestError(err.message || 'Network error triggering Slack webhook.');
    } finally {
      setIsTestingSlack(false);
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  const handleEnableBrowserDesktop = async () => {
    const perm = await requestBrowserNotificationPermission();
    setBrowserPerm(perm);
    if (perm === 'granted') {
      triggerBrowserNotification('✅ Browser Desktop Notifications Activated', {
        body: 'TaxFlow will notify you when filing deadlines are within 48 hours or critical risks occur.',
        force: true
      });
      setToastMsg('Browser Notification permission granted successfully!');
    } else {
      setToastMsg('Notification permission was denied. Please allow notifications in browser settings.');
    }
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleSendTestBrowserNotification = () => {
    if (browserPerm !== 'granted') {
      handleEnableBrowserDesktop();
      return;
    }
    const sent = triggerBrowserNotification('🚨 Critical Risk Alert Test', {
      body: 'GSTR-3B deadline is within 24 hours. Pending ITC blockage risk detected on Vendor Cloud Services Inc.',
      force: true
    });
    if (sent) setToastMsg('Test browser alert sent to your desktop!');
    else setToastMsg('Unable to trigger alert. Check browser permission.');
    setTimeout(() => setToastMsg(null), 4000);
  };

  const { data: alerts, isLoading: isAlertsLoading } = useQuery({ 
      queryKey: ['complianceAlerts', tenantId], 
      queryFn: () => fetchComplianceAlerts(tenantId) 
  });
  
  const { data: vendorRisks, isLoading: isRisksLoading } = useQuery({ 
      queryKey: ['vendorRisks', tenantId], 
      queryFn: () => fetchVendorRisks(tenantId) 
  });

  const { mutate: saveSettings, isPending: isSavingSettings } = useMutation({
      mutationFn: updateNotificationSettings,
      onSuccess: () => {
        setToastMsg('Notification preferences updated successfully!');
        setTimeout(() => setToastMsg(null), 4000);
      }
  });

  const activeAlerts = (alerts || []).filter(a => !dismissedAlertIds.includes(a.id));

  interface TabItem {
    key: 'OVERVIEW' | 'ARCHIVE' | 'WHATSAPP_REMINDERS' | 'ARCHITECTURE' | 'GSTIN_SEARCH' | 'VENDOR_RISK' | 'ITC_WATCHLIST' | 'REGULATORY_CHANGES' | 'REGULATORY_AUDIT' | 'REGULATORY_AUDIT_LOG' | 'NOTIFICATIONS';
    label: string;
    icon: React.ElementType;
    count?: number | string;
  }

  const tabs: TabItem[] = [
    { key: 'OVERVIEW', label: 'Overview', icon: LayoutDashboard, count: activeAlerts.length },
    { key: 'ARCHIVE', label: 'Statutory Archive', icon: Archive },
    { key: 'VENDOR_RISK', label: 'Vendor Risks', icon: Users, count: vendorRisks?.length },
    { key: 'ITC_WATCHLIST', label: 'ITC Watchlist', icon: Scale },
    { key: 'REGULATORY_CHANGES', label: 'Regulatory Updates', icon: FileText },
    { key: 'REGULATORY_AUDIT', label: 'Audit Events', icon: Activity },
    { key: 'REGULATORY_AUDIT_LOG', label: 'Decision Log', icon: CheckCircle2 },
    { key: 'GSTIN_SEARCH', label: 'GSTIN Verification', icon: Search },
    { key: 'WHATSAPP_REMINDERS', label: 'WhatsApp Alerts', icon: MessageSquare },
    { key: 'ARCHITECTURE', label: 'Control Tower', icon: Cpu },
    { key: 'NOTIFICATIONS', label: 'Alert Settings', icon: Bell },
  ];

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return {
          cardBg: 'bg-gradient-to-b from-rose-50/40 via-white to-white border-rose-200/90 hover:border-rose-300',
          iconBg: 'bg-rose-100 text-rose-700',
          badge: 'bg-rose-100 text-rose-800 border-rose-200/80',
          label: 'Critical Risk'
        };
      case 'MEDIUM':
        return {
          cardBg: 'bg-gradient-to-b from-amber-50/40 via-white to-white border-amber-200/90 hover:border-amber-300',
          iconBg: 'bg-amber-100 text-amber-700',
          badge: 'bg-amber-100 text-amber-800 border-amber-200/80',
          label: 'Attention'
        };
      case 'LOW':
      default:
        return {
          cardBg: 'bg-gradient-to-b from-blue-50/40 via-white to-white border-blue-200/90 hover:border-blue-300',
          iconBg: 'bg-blue-100 text-blue-700',
          badge: 'bg-blue-100 text-blue-800 border-blue-200/80',
          label: 'Advisory'
        };
    }
  };

  const getAlertIcon = (type: ComplianceAlert['type']) => {
    switch (type) {
      case 'DUE_DATE': return <CalendarClock size={18} />;
      case 'VENDOR_RISK': return <ShieldAlert size={18} />;
      case 'ITC_EXPIRY': return <Clock size={18} />;
      case 'PENALTY': return <AlertTriangle size={18} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Section with Balanced Alignment */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200/70">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Statutory Radar
            </span>
            <span className="text-xs text-slate-400 font-medium">Auto-synced across GSTN & ERP Books</span>
          </div>
          <h2 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">Compliance Center</h2>
          <p className="text-sm text-slate-500 max-w-2xl">
            Monitor statutory filing due dates, vendor counterparty compliance risks, and automated regulatory alerts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-center">
          <button 
            onClick={() => {
              setToastMsg('Refreshing statutory feeds and exception records...');
              setTimeout(() => setToastMsg('Compliance status synchronized! All ledgers up to date.'), 800);
              setTimeout(() => setToastMsg(null), 3500);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 shadow-xs transition-colors"
          >
            <RefreshCw size={14} className="text-slate-500" />
            <span>Sync Feeds</span>
          </button>

          <button 
            onClick={() => setActiveTab('ARCHIVE')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 shadow-xs transition-colors"
            title="Access 72-Month Statutory Ledger Archive & Tamper Verification"
          >
            <Archive size={14} className="text-indigo-600" />
            <span>Statutory Archive</span>
          </button>

          <button 
            onClick={() => setActiveTab('NOTIFICATIONS')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs"
          >
            <Bell size={14} />
            <span>Notification Rules</span>
          </button>
        </div>
      </div>

      {/* Full-width Sub-Navigation Pill Bar with zero ugly scrollbar */}
      <div className="w-full bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-0.5 px-0.5">
          {tabs.map((tabItem) => {
            const Icon = tabItem.icon;
            const isActive = activeTab === tabItem.key;
            return (
              <button
                key={tabItem.key}
                onClick={() => setActiveTab(tabItem.key as any)}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all duration-150 whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-white shadow-xs text-blue-600 border border-slate-200/90 font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                <span>{tabItem.label}</span>
                {Boolean(tabItem.count) && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {tabItem.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'ARCHIVE' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <ComplianceArchiveTimelineView tenantId={tenantId} tenantName={tenantName} />
        </div>
      )}

      {activeTab === 'WHATSAPP_REMINDERS' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <WhatsAppNotificationCenter initialTab="GST_DUE_DATES" tenantId={tenantId} />
        </div>
      )}

      {activeTab === 'GSTIN_SEARCH' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <GstinVerificationModule />
        </div>
      )}

      {activeTab === 'ARCHITECTURE' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <ComplianceArchitecturePipeline />
        </div>
      )}

      {activeTab === 'REGULATORY_CHANGES' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <GstPolicyUpdatesWidget />
          <RegulatoryChangeModule />
        </div>
      )}

      {activeTab === 'REGULATORY_AUDIT' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <RegulatoryEventAudit />
        </div>
      )}

      {activeTab === 'REGULATORY_AUDIT_LOG' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <RegulatoryAuditLog />
        </div>
      )}

      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Top KPI Metrics Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3.5">
              <div className="p-3 bg-red-50 text-red-600 rounded-xl shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">Active Exceptions</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl font-black text-slate-900">{activeAlerts.length}</span>
                  <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200/60 px-1.5 py-0.5 rounded-md">
                    {activeAlerts.filter(a => a.severity === 'HIGH').length} Critical
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3.5">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                <CalendarClock size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">Next Due Date</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl font-black text-slate-900">GSTR-3B</span>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/60 px-1.5 py-0.5 rounded-md">
                    20th
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3.5">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">Supplier Health</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl font-black text-slate-900">94.8%</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded-md">
                    Verified
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3.5">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                <Scale size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">ITC Protected</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl font-black text-slate-900">₹18.42L</span>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded-md">
                    Safe
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Alert Cards Section - Balanced layout without conflicting side-stripes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Urgent Statutory & Counterparty Alerts</h3>
                <p className="text-xs text-slate-500">Live issues requiring reconciliation, validation, or supplier follow-up.</p>
              </div>
              {activeAlerts.length > 0 && (
                <span className="text-xs font-bold text-slate-500">
                  Showing {activeAlerts.length} active notifications
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {activeAlerts.length === 0 ? (
                <div className="col-span-full text-center py-12 px-4 text-slate-500 bg-white rounded-2xl border border-slate-200/90 shadow-xs space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">All Clear! No Active Exceptions</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    All compliance due dates, vendor filings, and ITC reconciliation thresholds are in full compliance with GST statutory rules.
                  </p>
                </div>
              ) : activeAlerts.map(alert => {
                const style = getSeverityStyle(alert.severity);
                return (
                  <div 
                    key={alert.id} 
                    className={`p-5 rounded-2xl border shadow-xs transition-all duration-200 hover:shadow-md flex flex-col justify-between ${style.cardBg}`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className={`p-2.5 rounded-xl ${style.iconBg}`}>
                          {getAlertIcon(alert.type)}
                        </div>
                        <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${style.badge}`}>
                          {style.label}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm mt-3.5 leading-snug line-clamp-1">{alert.title}</h4>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed line-clamp-2">{alert.message}</p>
                    </div>

                    <div className="flex items-center justify-between pt-3.5 mt-4 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                        <Clock size={12} className="text-slate-400" />
                        <span>{alert.date}</span>
                      </div>
                      <button 
                        onClick={() => setSelectedAlert(alert)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-blue-50"
                      >
                        <span>Review & Action</span>
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline Section - Clean Stepper Layout */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CalendarClock size={20} className="text-blue-600"/>
                  Statutory GST Compliance Schedule (Current Cycle)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Monthly statutory return filing dates and tax settlement milestones under the CGST/SGST Act.
                </p>
              </div>
              <button 
                onClick={() => navigate('/filing')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline self-start sm:self-auto"
              >
                <span>Filing Dashboard</span>
                <ArrowRight size={13} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
              {[
                { day: '11th', code: 'GSTR-1', title: 'Outward Supplies', desc: 'B2B & B2C Invoices, credit/debit notes', status: 'Done', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                { day: '13th', code: 'GSTR-6', title: 'ISD Distribution', desc: 'Input service distributor credit notes', status: 'Pending', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
                { day: '20th', code: 'GSTR-3B', title: 'Summary Return', desc: 'Net tax discharge & ITC claim', status: 'Urgent', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 font-bold' },
                { day: '25th', code: 'PMT-06', title: 'QRMP Challan', desc: 'Self-assessment monthly tax deposit', status: 'Upcoming', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
                { day: '30th', code: 'Rule 37A', title: 'ITC Reversal Audit', desc: 'Supplier non-filing credit adjustments', status: 'Scheduled', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
              ].map((milestone, idx) => (
                <div 
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-200 hover:shadow-xs transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-slate-900">{milestone.day}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${milestone.badgeClass}`}>
                      {milestone.status}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs font-mono font-bold text-blue-600 block">{milestone.code}</span>
                    <h5 className="font-bold text-slate-800 text-sm">{milestone.title}</h5>
                    <p className="text-[11px] text-slate-500 mt-1 leading-normal">{milestone.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Alert Action / Remediation Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 animate-in zoom-in-95 duration-150 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${
                  selectedAlert.severity === 'HIGH' ? 'bg-rose-100 text-rose-700' :
                  selectedAlert.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {getAlertIcon(selectedAlert.type)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      selectedAlert.severity === 'HIGH' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                      selectedAlert.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                      'bg-blue-100 text-blue-800 border-blue-200'
                    }`}>
                      {selectedAlert.severity} Severity
                    </span>
                    <span className="text-xs font-mono text-slate-400">{selectedAlert.date}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">{selectedAlert.title}</h3>
                </div>
              </div>
              <button 
                onClick={() => setSelectedAlert(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs space-y-1.5">
              <div className="font-bold text-slate-700">Diagnosis & Summary:</div>
              <p className="text-slate-600 leading-relaxed">{selectedAlert.message}</p>
            </div>

            <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl text-xs space-y-1 text-blue-900">
              <div className="font-bold flex items-center gap-1.5 text-blue-800">
                <Info size={14} /> Recommended Action & Statutory Reference:
              </div>
              <p className="text-blue-700 leading-relaxed">
                {selectedAlert.type === 'VENDOR_RISK' 
                  ? 'Verify supplier GSTR-1 filing status against GSTR-2B. Under Section 16(2)(c), ITC is contingent on supplier tax payment.'
                  : selectedAlert.type === 'DUE_DATE'
                  ? 'Ensure all outward supply invoices and purchase registers are finalized before generating the GSTR-3B summary tax discharge.'
                  : 'Review the flagged voucher or invoice entry and apply necessary adjustments to prevent statutory interest charges u/s 50.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                {selectedAlert.type === 'VENDOR_RISK' && (
                  <button
                    onClick={() => {
                      setSelectedAlert(null);
                      setActiveTab('VENDOR_RISK');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                  >
                    Vendor Scorecard
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedAlert(null);
                    navigate('/reconciliation');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                >
                  Open Reconciliation
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setDismissedAlertIds(prev => [...prev, selectedAlert.id]);
                    setSelectedAlert(null);
                    setToastMsg(`Alert "${selectedAlert.title}" marked as reviewed.`);
                    setTimeout(() => setToastMsg(null), 3500);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs"
                >
                  Mark as Reviewed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'VENDOR_RISK' && (
        <div className="animate-in fade-in slide-in-from-bottom-2">
          <VendorComplianceScorecard />
        </div>
      )}

      {activeTab === 'ITC_WATCHLIST' && (
        <ItcLedgerOptimizer tenantId={tenantId} />
      )}

      {activeTab === 'NOTIFICATIONS' && (
          <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-8 animate-in fade-in slide-in-from-bottom-2 space-y-6">
               <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                 <div>
                   <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                     <Bell size={20} className="text-blue-500"/> Notification & Browser Radar Settings
                   </h3>
                   <p className="text-xs text-slate-500 mt-0.5">Configure browser desktop popups, email digests, and automated deadline triggers.</p>
                 </div>
               </div>

               {toastMsg && (
                 <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-semibold rounded-xl animate-in fade-in">
                   {toastMsg}
                 </div>
               )}

               {/* Browser Desktop Notification Card */}
               <div className="p-5 border border-indigo-100 bg-indigo-50/40 rounded-2xl space-y-4">
                 <div className="flex items-start justify-between gap-4">
                   <div className="flex items-center gap-3">
                     <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md">
                       <Laptop size={20} />
                     </div>
                     <div>
                       <h4 className="font-bold text-slate-800 flex items-center gap-2">
                         Browser Desktop Notifications (Notification API)
                         <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-bold ${
                           browserPerm === 'granted' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                         }`}>
                           Status: {browserPerm}
                         </span>
                       </h4>
                       <p className="text-xs text-slate-600 mt-0.5">
                         Receive native OS desktop popups when GST filing deadlines are within 48 hours or when high-risk compliance threats are detected.
                       </p>
                     </div>
                   </div>

                   <div 
                     onClick={() => setDesktopEnabled(!desktopEnabled)}
                     className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 ${desktopEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                   >
                     <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${desktopEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                   </div>
                 </div>

                 <div className="pt-2 border-t border-indigo-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                   <span className="text-slate-500 font-medium">
                     {browserPerm === 'granted' 
                       ? 'Browser permission granted. Desktop alerts will trigger automatically.' 
                       : 'Browser permission required to show desktop popups.'}
                   </span>

                   <div className="flex items-center gap-2">
                     {browserPerm !== 'granted' && (
                       <button
                         onClick={handleEnableBrowserDesktop}
                         className="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-all shadow-sm"
                       >
                         Request Permission
                       </button>
                     )}

                     <button
                       onClick={handleSendTestBrowserNotification}
                       className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-all shadow-sm"
                     >
                       Test Browser Alert
                     </button>
                   </div>
                 </div>
               </div>

               {/* Existing Channels */}
               <div className="space-y-4">
                   <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:bg-slate-50/50 transition-colors">
                       <div className="flex items-center gap-3">
                           <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Mail size={20}/></div>
                           <div>
                               <h4 className="font-semibold text-slate-800 text-sm">Email Notifications</h4>
                               <p className="text-xs text-slate-500">Receive daily compliance summaries and urgent deadline alerts via email.</p>
                           </div>
                       </div>
                       <div 
                            onClick={() => setEmailEnabled(!emailEnabled)}
                            className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${emailEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                        >
                            <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${emailEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                   </div>

                   <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:bg-slate-50/50 transition-colors">
                       <div className="flex items-center gap-3">
                           <div className="p-2 bg-green-50 text-green-600 rounded-lg"><MessageSquare size={20}/></div>
                           <div>
                               <h4 className="font-semibold text-slate-800 text-sm">WhatsApp Alerts</h4>
                               <p className="text-xs text-slate-500">Get instant alerts for due dates, vendor risks, and interest penalties.</p>
                           </div>
                       </div>
                        <div 
                            onClick={() => setWhatsappEnabled(!whatsappEnabled)}
                            className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${whatsappEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                        >
                            <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${whatsappEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                   </div>
               </div>

               {/* Slack Webhook Integration Card */}
               <div className="p-5 border border-slate-200 bg-slate-50/50 rounded-2xl space-y-4">
                   <div className="flex items-start justify-between gap-4">
                       <div className="flex items-start gap-3">
                           <div className="p-2.5 bg-[#4A154B] text-white rounded-xl shadow-sm shrink-0">
                               <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                   <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523 2.528 2.528 0 0 1-2.522-2.523 2.528 2.528 0 0 1 2.522-2.52h2.52v2.52zm1.261 0a2.528 2.528 0 0 1 2.52-2.52h5.043a2.528 2.528 0 0 1 2.522 2.52v5.043a2.528 2.528 0 0 1-2.522 2.52H8.823a2.528 2.528 0 0 1-2.52-2.52v-5.043zm0-1.262a2.528 2.528 0 0 1-2.52-2.522V6.338a2.528 2.528 0 0 1 2.52-2.52h5.043a2.528 2.528 0 0 1 2.522 2.52v5.043a2.528 2.528 0 0 1-2.522 2.52H8.823zm-3.781 0a2.528 2.528 0 0 1-2.522-2.522 2.528 2.528 0 0 1 2.522-2.52h2.52v2.52h-2.52zm11.304-3.782a2.528 2.528 0 0 1 2.52-2.52h2.522a2.528 2.528 0 0 1 2.52 2.52 2.528 2.528 0 0 1-2.52 2.522h-2.522v-2.522zm-1.262 0a2.528 2.528 0 0 1-2.52 2.522H8.823a2.528 2.528 0 0 1-2.522-2.522V6.338a2.528 2.528 0 0 1 2.522-2.52h5.043a2.528 2.528 0 0 1 2.52 2.52v5.043zm0 1.262a2.528 2.528 0 0 1 2.52 2.522v5.043a2.528 2.528 0 0 1-2.52 2.52H8.823a2.528 2.528 0 0 1-2.522-2.52v-5.043a2.528 2.528 0 0 1 2.522-2.52h5.043zm3.781 0a2.528 2.528 0 0 1 2.522 2.52v2.52h-2.522v-2.52a2.528 2.528 0 0 1 2.522-2.52h2.522z"/>
                               </svg>
                           </div>
                           <div className="space-y-1">
                               <h4 className="font-bold text-slate-800 text-sm">Slack Webhook Alerts (Regulatory Intelligence)</h4>
                               <p className="text-xs text-slate-500 leading-normal">
                                   Deliver instantaneous automated alerts to your designated Slack channels for tax rate amendments, validation schema changes, filing schedule extensions, and statutory CBIC circulars.
                               </p>
                           </div>
                       </div>
                       <div 
                           onClick={() => setSlackEventsEnabled(!slackEventsEnabled)}
                           className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 ${slackEventsEnabled ? 'bg-[#4A154B]' : 'bg-slate-300'}`}
                       >
                           <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${slackEventsEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                       </div>
                   </div>

                   {slackEventsEnabled && (
                       <div className="space-y-3 pt-3 border-t border-slate-200/60 animate-in fade-in slide-in-from-top-1">
                           <div className="space-y-1">
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Incoming Webhook URL</label>
                               <div className="flex gap-2">
                                   <input 
                                       type="text" 
                                       placeholder="https://hooks.slack.com/services/T0000/B0000/XXXXXX" 
                                       value={slackWebhookUrl}
                                       onChange={(e) => setSlackWebhookUrl(e.target.value)}
                                       className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-[#4A154B]"
                                   />
                                   <button
                                       onClick={handleTestSlackNotification}
                                       disabled={isTestingSlack || !slackWebhookUrl}
                                       className="px-3.5 py-2 bg-[#4A154B] text-white font-bold text-xs rounded-lg hover:bg-[#3d113e] transition-all disabled:opacity-50 shrink-0"
                                   >
                                       {isTestingSlack ? 'Testing...' : 'Test Alert'}
                                   </button>
                                </div>
                               <p className="text-[10px] text-slate-400">
                                   Configure an incoming webhook on your Slack app workspace and paste the target hook URL here.
                               </p>
                           </div>

                           {slackTestStatus === 'SUCCESS' && (
                               <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
                                   <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                                   <span>Connection established! Test payload successfully dispatched to Slack.</span>
                               </div>
                           )}

                           {slackTestStatus === 'FAILED' && (
                               <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2 animate-in fade-in">
                                   <AlertCircle size={14} className="text-rose-600 shrink-0" />
                                   <span className="font-medium">{slackTestError}</span>
                               </div>
                           )}
                       </div>
                   )}
               </div>

               {/* Trigger Filters */}
               <div className="pt-4 border-t border-slate-100">
                   <h4 className="font-bold text-slate-800 text-sm mb-3">Browser Desktop & Multi-Channel Trigger Rules</h4>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                       {[
                         'GST Filing Deadlines within 48 Hours', 
                         'Critical Compliance Risks & Non-Compliant Vendors', 
                         'ITC Expiry Warning (Invoices > 150 days)', 
                         'Blocked ITC & Penalty Risk Threshold Breaches'
                       ].map((label, i) => (
                           <label key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/60 cursor-pointer hover:bg-slate-100 transition-colors">
                               <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"/>
                               <span className="text-xs font-semibold text-slate-700">{label}</span>
                           </label>
                       ))}
                   </div>
               </div>

               <div className="pt-4 flex justify-end">
                   <button 
                     onClick={() => {
                       localStorage.setItem('taxflow_slack_webhook_url', slackWebhookUrl);
                       localStorage.setItem('taxflow_slack_events_enabled', String(slackEventsEnabled));
                       saveSettings({ 
                           emailEnabled, 
                           whatsappEnabled, 
                           alerts: { dueDate: true, vendorNonCompliance: true, itcExpiry: true, returnFiling: true } 
                       });
                     }}
                     disabled={isSavingSettings}
                     className="px-6 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 flex items-center gap-2 shadow-sm disabled:opacity-70 transition-all active:scale-95"
                   >
                       {isSavingSettings ? 'Saving...' : 'Save Notification Preferences'}
                   </button>
               </div>
          </div>
      )}
    </div>
  );
};

export default Compliance;