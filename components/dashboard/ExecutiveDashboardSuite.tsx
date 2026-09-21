import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, AlertTriangle, Calendar as CalendarIcon, Clock, 
  ArrowUpRight, ArrowDownRight, IndianRupee, FileText, CheckCircle2, 
  ExternalLink, Bell, RefreshCw, Wallet, CreditCard, ChevronRight, 
  Layers, AlertCircle, Info, Sparkles, Filter, ShieldAlert, Download,
  Pin, PinOff, Sliders
} from 'lucide-react';
import { FilingRecord, ComplianceAlert } from '../../types';
import FilingCalendar from '../FilingCalendar';
import { triggerBrowserNotification } from '../../utils/browserNotifications';

interface DashboardWidget {
  id: string;
  title: string;
  value: string;
  trend: string;
  isPositive: boolean;
  color: 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'slate';
  icon: any;
  subtitle: string;
  category: string;
  description: string;
}

interface ExecutiveDashboardSuiteProps {
  tenantId: string;
  stats: any;
  analytics: any;
  filings: FilingRecord[];
  alerts?: ComplianceAlert[];
  onNavigate?: (path: string) => void;
}

export const ExecutiveDashboardSuite: React.FC<ExecutiveDashboardSuiteProps> = ({
  tenantId,
  stats,
  analytics,
  filings = [],
  alerts = [],
  onNavigate
}) => {
  const [selectedTab, setSelectedTab] = useState<'ALL' | 'FINANCIAL' | 'CALENDAR' | 'FILINGS'>('ALL');
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [dismissedNotifs, setDismissedNotifs] = useState<string[]>([]);

  const [pinnedWidgetIds, setPinnedWidgetIds] = useState<string[]>([]);
  const [isCustomizingWidgets, setIsCustomizingWidgets] = useState<boolean>(false);

  // Load custom pinned widgets from localStorage or default to initial set
  useEffect(() => {
    const saved = localStorage.getItem(`TF_PINNED_WIDGETS_${tenantId}`);
    if (saved) {
      try {
        setPinnedWidgetIds(JSON.parse(saved));
      } catch (err) {
        setPinnedWidgetIds(['monthly-liability', 'pending-approvals', 'eligible-itc', 'compliance-score']);
      }
    } else {
      setPinnedWidgetIds(['monthly-liability', 'pending-approvals', 'eligible-itc', 'compliance-score']);
    }
  }, [tenantId]);

  const toggleWidgetPin = (id: string) => {
    let updated: string[];
    if (pinnedWidgetIds.includes(id)) {
      updated = pinnedWidgetIds.filter(wId => wId !== id);
    } else {
      updated = [...pinnedWidgetIds, id];
    }
    setPinnedWidgetIds(updated);
    localStorage.setItem(`TF_PINNED_WIDGETS_${tenantId}`, JSON.stringify(updated));
  };

  // Calculate compliance score
  const isT2 = tenantId === 't2';
  const complianceScore = isT2 ? 82 : 94;
  const scoreLabel = complianceScore >= 90 ? 'EXCELLENT' : complianceScore >= 75 ? 'GOOD' : 'NEEDS ATTENTION';
  const scoreColor = complianceScore >= 90 ? 'emerald' : complianceScore >= 75 ? 'amber' : 'rose';

  // Ledgers Mock Data based on tenant
  const cashLedger = {
    igst: isT2 ? 24000 : 12500,
    cgst: isT2 ? 12000 : 6000,
    sgst: isT2 ? 12000 : 6000,
    total: isT2 ? 48000 : 24500
  };

  const creditLedger = {
    igst: isT2 ? 185000 : 112000,
    cgst: isT2 ? 62000 : 36700,
    sgst: isT2 ? 62000 : 36700,
    total: isT2 ? 309000 : 185400
  };

  const itcBreakdown = {
    eligible: stats?.itc || 98000,
    blocked: isT2 ? 24500 : 12400,
    ineligible: 4200,
    reconciled: Math.round((stats?.itc || 98000) * 0.88)
  };

  const taxLiability = {
    igst: Math.round((stats?.liability || 124000) * 0.55),
    cgst: Math.round((stats?.liability || 124000) * 0.225),
    sgst: Math.round((stats?.liability || 124000) * 0.225),
    total: stats?.liability || 124000
  };

  const availableWidgets: DashboardWidget[] = [
    {
      id: 'monthly-liability',
      title: 'Monthly Liability Overview',
      value: `₹${(stats?.liability || 124000).toLocaleString('en-IN')}`,
      trend: '₹14,500 due',
      isPositive: false,
      color: 'amber',
      icon: IndianRupee,
      subtitle: 'Output Tax GST Payable',
      category: 'Financial',
      description: 'Current active month estimated tax obligation to file GSTR-3B.'
    },
    {
      id: 'pending-approvals',
      title: 'Pending Approvals Count',
      value: isT2 ? '5 Pending' : '3 Pending',
      trend: '2 High Risk',
      isPositive: false,
      color: 'rose',
      icon: ShieldAlert,
      subtitle: 'Requires Digital Signature (DSC)',
      category: 'Compliance',
      description: 'Invoices, e-way bills or filing drafts requiring accountant approval.'
    },
    {
      id: 'eligible-itc',
      title: 'Eligible ITC Pool',
      value: `₹${(stats?.itc || 185400).toLocaleString('en-IN')}`,
      trend: '+12.4% MoM',
      isPositive: true,
      color: 'emerald',
      icon: CreditCard,
      subtitle: 'Auto-Drafted from GSTR-2B',
      category: 'Financial',
      description: 'Input Tax Credit calculated from compliant supplier GSTR-1 filings.'
    },
    {
      id: 'blocked-itc',
      title: 'Blocked / Ineligible ITC',
      value: `₹${(isT2 ? 24500 : 12400).toLocaleString('en-IN')}`,
      trend: '-2.4% MoM',
      isPositive: true,
      color: 'slate',
      icon: AlertTriangle,
      subtitle: 'Under Section 17(5)',
      category: 'Compliance',
      description: 'Input credit restricted due to blocked categories or default vendors.'
    },
    {
      id: 'compliance-score',
      title: 'GST Compliance Health',
      value: `${complianceScore}/100`,
      trend: 'Excellent Rating',
      isPositive: true,
      color: 'indigo',
      icon: ShieldCheck,
      subtitle: 'GSTR Filing Scorecard',
      category: 'Compliance',
      description: 'Overall corporate tax health scoring based on timeline accuracy.'
    },
    {
      id: 'cash-ledger',
      title: 'Electronic Cash Ledger',
      value: `₹${cashLedger.total.toLocaleString('en-IN')}`,
      trend: 'Sufficient Balance',
      isPositive: true,
      color: 'blue',
      icon: Wallet,
      subtitle: 'Pre-deposit balance at GSTN',
      category: 'Financial',
      description: 'Real-time cash ledger pool for setting off remaining liabilities.'
    },
    {
      id: 'active-eway',
      title: 'Active E-Way Bills',
      value: isT2 ? '18 Consignments' : '14 Active',
      trend: '3 expiring soon',
      isPositive: false,
      color: 'indigo',
      icon: Layers,
      subtitle: 'RFID & GPS Tracked',
      category: 'Logistics',
      description: 'In-transit consignments requiring valid e-way bill verification.'
    }
  ];

  // Filter filings for upcoming and recent
  const pendingFilings = filings.filter(f => f.status === 'PENDING' || f.status === 'OVERDUE');
  const recentFiled = filings.filter(f => f.status === 'FILED').slice(0, 5);

  // Notifications feed
  const defaultNotifications = [
    {
      id: 'n1',
      title: 'GSTR-3B Return Due in 48 Hours',
      message: 'GSTR-3B for July 2026 is due on July 27, 2026. Net liability payable: ₹1,24,000.',
      type: 'DEADLINE',
      severity: 'HIGH',
      timestamp: '10 mins ago',
      actionUrl: '/filing'
    },
    {
      id: 'n2',
      title: 'GSTR-2B Auto-Drafted Statement Available',
      message: 'GSTR-2B for July 2026 is now available. Eligible ITC of ₹85,600 ready for offset.',
      type: 'PORTAL',
      severity: 'INFO',
      timestamp: '2 hours ago',
      actionUrl: '/reconciliation'
    },
    {
      id: 'n3',
      title: 'Vendor Non-Compliance Alert',
      message: 'Vendor "Apex Distributors" has not filed GSTR-1. ₹18,400 ITC blocked in GSTR-2B.',
      type: 'RISK',
      severity: 'HIGH',
      timestamp: '1 day ago',
      actionUrl: '/compliance'
    },
    {
      id: 'n4',
      title: 'GST Council Rate Update Advisory',
      message: 'New HSN classification rules effective from Aug 1, 2026 for IT Hardware items.',
      type: 'SYSTEM',
      severity: 'MEDIUM',
      timestamp: '2 days ago',
      actionUrl: '/reports'
    }
  ];

  const visibleNotifications = defaultNotifications.filter(n => !dismissedNotifs.includes(n.id));

  // Pending Actions
  const pendingActionsList = [
    {
      id: 'pa1',
      title: 'File GSTR-3B Monthly Return',
      description: 'July 2026 period return with net liability ₹1,24,000.',
      severity: 'HIGH',
      actionText: 'File Now',
      path: '/filing'
    },
    {
      id: 'pa2',
      title: 'Reconcile 3 Purchase Invoices',
      description: 'GSTR-2B mismatch detected for vendor invoices amounting to ₹34,200.',
      severity: 'MEDIUM',
      actionText: 'Reconcile',
      path: '/reconciliation'
    },
    {
      id: 'pa3',
      title: 'Resolve Vendor Risk Flag',
      description: 'Vendor "Summit Logistics" score dropped below 50% due to delayed GSTR-3B.',
      severity: 'HIGH',
      actionText: 'Inspect Vendor',
      path: '/compliance'
    }
  ];

  const handleNavigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.hash = path;
  };

  return (
    <div className="space-y-8">
      {/* Header section with category tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="text-indigo-600" size={20} /> Executive GST Compliance Dashboard
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">Real-time Ledgers, Compliance Score, Return Status & Deadlines</p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          {[
            { id: 'ALL', label: 'Overview Grid' },
            { id: 'FINANCIAL', label: 'Ledgers & Tax' },
            { id: 'CALENDAR', label: 'Compliance Calendar' },
            { id: 'FILINGS', label: 'Filing History' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedTab === tab.id 
                  ? 'bg-white text-indigo-700 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customizable Summary Cards (Widgets) Panel */}
      {(selectedTab === 'ALL' || selectedTab === 'FINANCIAL') && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 text-left">
            <div>
              <span className="text-xs font-black text-indigo-600 uppercase tracking-wider block">
                Dashboard Customization
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5 flex items-center gap-2">
                📌 Pinned Metric Cards ({pinnedWidgetIds.length})
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Pin your most important financial indicators & compliance counters to the top of your workspace.</p>
            </div>
            <button
              onClick={() => setIsCustomizingWidgets(!isCustomizingWidgets)}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100/80 px-3.5 py-2 rounded-xl transition-all self-stretch sm:self-auto justify-center"
            >
              <Sliders size={14} />
              {isCustomizingWidgets ? 'Close Layout Studio' : 'Customize Summary Cards'}
            </button>
          </div>

          {/* Customize Layout Studio */}
          {isCustomizingWidgets && (
            <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-5 space-y-4 text-left animate-in fade-in duration-200">
              <div className="space-y-0.5">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">Configure Active Widgets</span>
                <h4 className="text-sm font-extrabold text-slate-900">Summary Card Studio</h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  Toggle the pin status of each metrics card to update your executive dashboard. Changes are saved automatically.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableWidgets.map(widget => {
                  const isPinned = pinnedWidgetIds.includes(widget.id);
                  const Icon = widget.icon;
                  return (
                    <div 
                      key={widget.id}
                      className={`p-4 rounded-xl border transition-all flex items-start gap-3 justify-between bg-white ${
                        isPinned ? 'border-indigo-300 ring-2 ring-indigo-500/5 shadow-xs' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-xl text-white shrink-0 ${
                          widget.color === 'blue' ? 'bg-blue-600 shadow-sm shadow-blue-500/20' :
                          widget.color === 'emerald' ? 'bg-emerald-600 shadow-sm shadow-emerald-500/20' :
                          widget.color === 'amber' ? 'bg-amber-500 shadow-sm shadow-amber-500/20' :
                          widget.color === 'rose' ? 'bg-rose-600 shadow-sm shadow-rose-500/20' :
                          widget.color === 'indigo' ? 'bg-indigo-600 shadow-sm shadow-indigo-500/20' : 
                          'bg-slate-700 shadow-sm shadow-slate-500/20'
                        }`}>
                          <Icon size={16} />
                        </div>
                        <div className="space-y-0.5 text-left">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">{widget.category}</span>
                          <h5 className="text-xs font-bold text-slate-900 leading-tight">{widget.title}</h5>
                          <p className="text-[10px] text-slate-500 leading-normal font-medium max-w-[200px]">{widget.description}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleWidgetPin(widget.id)}
                        className={`p-1.5 rounded-lg transition-all shrink-0 ${
                          isPinned 
                            ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100' 
                            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100/50'
                        }`}
                        title={isPinned ? 'Unpin from dashboard' : 'Pin to dashboard'}
                      >
                        {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dynamic Grid of Pinned Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {pinnedWidgetIds.map(id => {
              const widget = availableWidgets.find(w => w.id === id);
              if (!widget) return null;
              const Icon = widget.icon;
              return (
                <div 
                  key={widget.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all duration-200 group relative overflow-hidden flex flex-col justify-between text-left"
                >
                  {/* Top colored accent indicator */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${
                    widget.color === 'blue' ? 'bg-blue-600' :
                    widget.color === 'emerald' ? 'bg-emerald-600' :
                    widget.color === 'amber' ? 'bg-amber-500' :
                    widget.color === 'rose' ? 'bg-rose-600' :
                    widget.color === 'indigo' ? 'bg-indigo-600' : 'bg-slate-700'
                  }`}></div>

                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-2.5 rounded-xl text-white shadow-xs ${
                        widget.color === 'blue' ? 'bg-blue-600 shadow-sm shadow-blue-500/10' :
                        widget.color === 'emerald' ? 'bg-emerald-600 shadow-sm shadow-emerald-500/10' :
                        widget.color === 'amber' ? 'bg-amber-500 shadow-sm shadow-amber-500/10' :
                        widget.color === 'rose' ? 'bg-rose-600 shadow-sm shadow-rose-500/10' :
                        widget.color === 'indigo' ? 'bg-indigo-600 shadow-sm shadow-indigo-500/10' : 
                        'bg-slate-700 shadow-sm shadow-slate-500/10'
                      }`}>
                        <Icon size={16} />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleWidgetPin(widget.id)}
                          className="sm:opacity-0 sm:group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded-md transition-all border border-transparent hover:border-slate-100"
                          title="Unpin Widget"
                        >
                          <PinOff size={13} />
                        </button>
                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-md border ${
                          widget.isPositive 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                            : 'bg-rose-50 text-rose-800 border-rose-100'
                        }`}>
                          {widget.trend}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-slate-400 text-[10px] font-black tracking-wider uppercase">{widget.title}</h3>
                      <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">{widget.value}</div>
                      <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">{widget.subtitle}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {pinnedWidgetIds.length === 0 && (
              <div className="col-span-full bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-8 text-center space-y-3">
                <Sliders size={28} className="text-slate-400 mx-auto" />
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-800 uppercase block">No Pinned Summary Widgets</span>
                  <p className="text-[11px] text-slate-400 font-medium">Configure and pin summary cards to quickly monitor tax and logistics activities.</p>
                </div>
                <button
                  onClick={() => setIsCustomizingWidgets(true)}
                  className="mx-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs"
                >
                  Configure Summary Cards
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {(selectedTab === 'ALL' || selectedTab === 'FINANCIAL') && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* FEATURE 1: GST Compliance Score */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-6 rounded-2xl shadow-lg border border-slate-700 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <ShieldCheck size={120} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-indigo-400" /> 1. Compliance Score
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  complianceScore >= 90 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {scoreLabel}
                </span>
              </div>

              <div className="flex items-baseline gap-3 my-2">
                <span className="text-4xl font-black tracking-tight text-white">{complianceScore}</span>
                <span className="text-lg font-bold text-slate-400">/ 100</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-700/60 rounded-full h-2.5 my-3 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${
                    complianceScore >= 90 ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                  style={{ width: `${complianceScore}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 font-medium mt-4 pt-3 border-t border-slate-700/80">
                <div>On-Time Filing: <strong className="text-white">98%</strong></div>
                <div>Recon Match: <strong className="text-white">92%</strong></div>
                <div>Vendor Health: <strong className="text-white">89%</strong></div>
                <div>Penalties: <strong className="text-emerald-400">₹0</strong></div>
              </div>
            </div>

            <button
              onClick={() => setActiveModal('SCORE_AUDIT')}
              className="mt-4 text-xs font-bold text-indigo-300 hover:text-white flex items-center justify-between pt-2 group-hover:translate-x-1 transition-transform"
            >
              <span>View Score Audit Breakdown</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* FEATURE 8: Cash Ledger Balance */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-300 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet size={16} className="text-indigo-600" /> 8. Electronic Cash Ledger
                </span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-mono text-[10px] font-bold rounded-md">
                  Active
                </span>
              </div>

              <p className="text-3xl font-black text-slate-900 tracking-tight my-1">
                ₹{cashLedger.total.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 font-medium mb-4">Available cash for tax dues & interest</p>

              <div className="space-y-1.5 text-xs border-t border-slate-100 pt-3">
                <div className="flex justify-between font-mono text-slate-600">
                  <span>IGST Cash:</span>
                  <span className="font-bold text-slate-800">₹{cashLedger.igst.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-mono text-slate-600">
                  <span>CGST Cash:</span>
                  <span className="font-bold text-slate-800">₹{cashLedger.cgst.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-mono text-slate-600">
                  <span>SGST Cash:</span>
                  <span className="font-bold text-slate-800">₹{cashLedger.sgst.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleNavigate('/computation')}
              className="mt-4 w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1"
            >
              Deposit Cash (Challan) &rarr;
            </button>
          </div>

          {/* FEATURE 9: Electronic Credit Ledger */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-emerald-300 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard size={16} className="text-emerald-600" /> 9. Credit Ledger (ITC)
                </span>
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-mono text-[10px] font-bold rounded-md">
                  Set-off Ready
                </span>
              </div>

              <p className="text-3xl font-black text-slate-900 tracking-tight my-1">
                ₹{creditLedger.total.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 font-medium mb-4">Accumulated ITC available for tax offset</p>

              <div className="space-y-1.5 text-xs border-t border-slate-100 pt-3">
                <div className="flex justify-between font-mono text-slate-600">
                  <span>IGST Credit:</span>
                  <span className="font-bold text-slate-800">₹{creditLedger.igst.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-mono text-slate-600">
                  <span>CGST Credit:</span>
                  <span className="font-bold text-slate-800">₹{creditLedger.cgst.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-mono text-slate-600">
                  <span>SGST Credit:</span>
                  <span className="font-bold text-slate-800">₹{creditLedger.sgst.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleNavigate('/computation')}
              className="mt-4 w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1"
            >
              View Set-off Rules &rarr;
            </button>
          </div>

          {/* FEATURE 6: Tax Liability Summary */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-amber-300 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <IndianRupee size={16} className="text-amber-600" /> 6. Tax Liability Summary
                </span>
                <span className="px-2 py-0.5 bg-amber-50 text-amber-800 font-mono text-[10px] font-bold rounded-md">
                  July 2026
                </span>
              </div>

              <p className="text-3xl font-black text-slate-900 tracking-tight my-1">
                ₹{taxLiability.total.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 font-medium mb-4">Net liability output for current period</p>

              <div className="space-y-1.5 text-xs border-t border-slate-100 pt-3">
                <div className="flex justify-between font-mono text-slate-600">
                  <span>Output IGST:</span>
                  <span className="font-bold text-slate-800">₹{taxLiability.igst.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-mono text-slate-600">
                  <span>Output CGST:</span>
                  <span className="font-bold text-slate-800">₹{taxLiability.cgst.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-mono text-slate-600">
                  <span>Output SGST:</span>
                  <span className="font-bold text-slate-800">₹{taxLiability.sgst.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleNavigate('/computation')}
              className="mt-4 w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1"
            >
              Liability Breakdown &rarr;
            </button>
          </div>
        </div>
      )}

      {/* SECOND ROW: Upcoming Due Dates, Pending Actions, Filing Status, ITC Card */}
      {selectedTab === 'ALL' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* FEATURE 2 & 3: Filing Status & Upcoming Due Dates */}
          <div className="lg:col-span-2 space-y-6">
            {/* FEATURE 3: Upcoming Due Dates */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">3. Upcoming Due Dates Radar</h3>
                    <p className="text-xs text-slate-500">Critical deadlines for the next 30 days</p>
                  </div>
                </div>

                <button
                  onClick={() => handleNavigate('/filing')}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  Filing Hub &rarr;
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pendingFilings.map((filing) => {
                  const target = new Date(filing.dueDate);
                  target.setHours(23, 59, 59, 999);
                  const diffHours = (target.getTime() - Date.now()) / (1000 * 60 * 60);
                  const is48h = diffHours <= 48 && diffHours >= 0;
                  const isOverdue = diffHours < 0;

                  return (
                    <div
                      key={filing.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isOverdue 
                          ? 'bg-rose-50/50 border-rose-200' 
                          : is48h 
                            ? 'bg-amber-50/50 border-amber-200 shadow-sm' 
                            : 'bg-slate-50/50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-800">{filing.type}</span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          isOverdue 
                            ? 'bg-rose-600 text-white animate-pulse' 
                            : is48h 
                              ? 'bg-amber-600 text-white animate-pulse' 
                              : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {isOverdue ? 'OVERDUE' : is48h ? '🚨 Due <= 48h' : 'Upcoming'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 font-medium">Period: <strong className="text-slate-800">{filing.period}</strong></p>
                      <p className="text-xs text-slate-600 font-medium mt-0.5">Due Date: <strong className="text-slate-800">{filing.dueDate}</strong></p>

                      <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 font-mono">
                          {isOverdue ? `${Math.abs(Math.round(diffHours))}h overdue` : `${Math.round(diffHours)}h left`}
                        </span>

                        <button
                          onClick={() => handleNavigate('/filing')}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-lg transition-colors"
                        >
                          File Return
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* FEATURE 2: Filing Status Breakdown */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">2. Current Return Filing Status</h3>
                    <p className="text-xs text-slate-500">Live compliance status across active GST returns</p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {filings.slice(0, 4).map((f) => (
                  <div key={f.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl text-xs font-bold ${
                        f.status === 'FILED' ? 'bg-emerald-100 text-emerald-800' : f.status === 'OVERDUE' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {f.type}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{f.period}</p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {f.arn ? `ARN: ${f.arn}` : `Due Date: ${f.dueDate}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {f.taxLiability && (
                        <span className="text-xs font-bold font-mono text-slate-700 hidden sm:inline">
                          ₹{f.taxLiability.toLocaleString()}
                        </span>
                      )}

                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        f.status === 'FILED' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : f.status === 'OVERDUE' 
                            ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {f.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Pending Actions & GST Notifications */}
          <div className="space-y-6">
            {/* FEATURE 4: Pending Actions */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">4. Pending Actions</h3>
                    <p className="text-xs text-slate-500">Action items requiring immediate resolution</p>
                  </div>
                </div>

                <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-full">
                  {pendingActionsList.length} Pending
                </span>
              </div>

              <div className="space-y-3">
                {pendingActionsList.map((action) => (
                  <div key={action.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-800">{action.title}</h4>
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded">
                        {action.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">{action.description}</p>
                    <button
                      onClick={() => handleNavigate(action.path)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 pt-1"
                    >
                      {action.actionText} &rarr;
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* FEATURE 10: GST Notifications Feed */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Bell size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">10. GST Notifications</h3>
                    <p className="text-xs text-slate-500">Live GST portal & compliance advisories</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto">
                {visibleNotifications.map((notif) => (
                  <div key={notif.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{notif.title}</span>
                      <span className="text-[9px] text-slate-400 font-mono">{notif.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">{notif.message}</p>
                    <div className="flex items-center justify-between pt-1 text-[10px]">
                      <span className="font-bold text-indigo-600 hover:underline cursor-pointer" onClick={() => handleNavigate(notif.actionUrl)}>
                        Open Module &rarr;
                      </span>
                      <button
                        onClick={() => setDismissedNotifs([...dismissedNotifs, notif.id])}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* THIRD ROW: Feature 7 (ITC breakdown), Feature 5 (Recent Filings Table), Feature 11 (Compliance Calendar) */}
      {(selectedTab === 'ALL' || selectedTab === 'FILINGS') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* FEATURE 7: Input Tax Credit (ITC) Breakdown Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">7. Input Tax Credit (ITC) Matrix</h3>
                  <p className="text-xs text-slate-500">Eligible, blocked & reconciled ITC</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-emerald-800 font-bold uppercase">Eligible ITC</p>
                  <p className="text-lg font-black text-emerald-900">₹{itcBreakdown.eligible.toLocaleString()}</p>
                </div>
                <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 font-mono text-[10px] font-bold rounded">
                  Available
                </span>
              </div>

              <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-rose-800 font-bold uppercase">Blocked ITC (Sec 17(5))</p>
                  <p className="text-lg font-black text-rose-900">₹{itcBreakdown.blocked.toLocaleString()}</p>
                </div>
                <span className="px-2 py-0.5 bg-rose-200 text-rose-900 font-mono text-[10px] font-bold rounded">
                  Ineligible
                </span>
              </div>

              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-indigo-800 font-bold uppercase">GSTR-2B Reconciled ITC</p>
                  <p className="text-lg font-black text-indigo-900">₹{itcBreakdown.reconciled.toLocaleString()}</p>
                </div>
                <span className="px-2 py-0.5 bg-indigo-200 text-indigo-900 font-mono text-[10px] font-bold rounded">
                  88% Matched
                </span>
              </div>
            </div>

            <button
              onClick={() => handleNavigate('/reconciliation')}
              className="w-full py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors"
            >
              Open Reconciliation Hub &rarr;
            </button>
          </div>

          {/* FEATURE 5: Recent Filings List */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">5. Recent Filings History</h3>
                  <p className="text-xs text-slate-500">Verified GST returns filed with ACK / ARN</p>
                </div>
              </div>

              <button
                onClick={() => handleNavigate('/filing')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
              >
                View All Filings &rarr;
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                    <th className="py-2.5">Return Type</th>
                    <th className="py-2.5">Period</th>
                    <th className="py-2.5">ARN / Ack No</th>
                    <th className="py-2.5">Filed Date</th>
                    <th className="py-2.5">Tax Paid</th>
                    <th className="py-2.5 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {recentFiled.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 font-bold text-slate-900">{f.type}</td>
                      <td className="py-3">{f.period}</td>
                      <td className="py-3 font-mono text-[11px] text-indigo-600">{f.arn || 'ARN-PENDING'}</td>
                      <td className="py-3 text-slate-500">{f.filedDate || '2026-07-20'}</td>
                      <td className="py-3 font-mono font-bold text-slate-800">₹{(f.taxLiability || 12400).toLocaleString()}</td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => alert(`Downloading ARN Acknowledgement receipt for ${f.type} (${f.period})`)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[10px] rounded-lg inline-flex items-center gap-1 transition-colors"
                        >
                          <Download size={10} /> Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* FEATURE 11: Compliance Calendar View */}
      {(selectedTab === 'ALL' || selectedTab === 'CALENDAR') && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <CalendarIcon size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">11. GST Compliance Calendar</h3>
                <p className="text-xs text-slate-500">Interactive monthly return schedule and statutory deadline tracker</p>
              </div>
            </div>
          </div>

          <FilingCalendar filings={filings} />
        </div>
      )}

      {/* Modal: Score Audit Breakdown */}
      {activeModal === 'SCORE_AUDIT' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 border border-slate-200 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="text-indigo-600" size={20} /> GST Compliance Score Audit (94/100)
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex justify-between">
                <span>Timely Return Filings (GSTR-1 & 3B):</span>
                <strong className="text-emerald-800">40 / 40 Points</strong>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex justify-between">
                <span>GSTR-2B Invoice Reconciliation Match:</span>
                <strong className="text-emerald-800">28 / 30 Points</strong>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex justify-between">
                <span>Vendor Compliance Health Index:</span>
                <strong className="text-emerald-800">18 / 20 Points</strong>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex justify-between">
                <span>Zero Late Filing Penalty History:</span>
                <strong className="text-emerald-800">8 / 10 Points</strong>
              </div>
            </div>

            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-900 font-medium">
              💡 <strong>Optimization Tip:</strong> Reconcile remaining 3 pending purchase invoices to achieve a perfect 100/100 compliance score.
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutiveDashboardSuite;
