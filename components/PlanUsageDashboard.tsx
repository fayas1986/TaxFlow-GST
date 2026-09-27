import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { 
  FileText, 
  QrCode, 
  Truck, 
  RefreshCw, 
  Users, 
  Building2, 
  HardDrive, 
  Sparkles, 
  Cpu, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowUpRight, 
  Zap, 
  TrendingUp, 
  Clock, 
  Shield, 
  Layers, 
  Plus, 
  Check, 
  Lock, 
  Crown, 
  ChevronRight, 
  Info, 
  Gauge, 
  RotateCcw, 
  Sliders, 
  X,
  CreditCard,
  Percent,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { usageService, POPULAR_ADD_ONS } from '../src/core/entitlements/usageService';
import { entitlementService } from '../src/core/entitlements/entitlementService';
import { 
  PlanCode, 
  Plan, 
  UsageMetricItem, 
  TenantUsageSummary, 
  PlanAddOn,
  Feature,
  PLANS_CATALOG 
} from '../src/core/entitlements/types';

interface PlanUsageDashboardProps {
  onNavigateToSettings?: () => void;
  showToast?: (message: string) => void;
  compactMode?: boolean;
}

export const PlanUsageDashboard: React.FC<PlanUsageDashboardProps> = ({
  onNavigateToSettings,
  showToast,
  compactMode = false,
}) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const tenantId = user?.currentTenantId || 't1';

  const [summary, setSummary] = useState<TenantUsageSummary>(() => usageService.getTenantUsageSummary(tenantId));
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isAddonModalOpen, setIsAddonModalOpen] = useState(false);
  const [selectedAddon, setSelectedAddon] = useState<PlanAddOn | null>(null);
  const [addonQuantity, setAddonQuantity] = useState(1);
  const [billingInterval, setBillingInterval] = useState<'MONTHLY' | 'ANNUAL'>('ANNUAL');
  const [isProcessingUpgrade, setIsProcessingUpgrade] = useState(false);
  const [activePlanTab, setActivePlanTab] = useState<PlanCode>(summary.plan.code);
  const [showSimulateDrawer, setShowSimulateDrawer] = useState(false);

  // Live Catalog State synchronized automatically with Super Admin updates
  const [allPlans, setAllPlans] = useState<Plan[]>(() => entitlementService.getAllPlans());

  // Subscribe to real-time changes
  useEffect(() => {
    const unsubUsage = usageService.subscribe(() => {
      setSummary(usageService.getTenantUsageSummary(tenantId));
    });
    const unsubPlans = entitlementService.subscribeToPlans(() => {
      setAllPlans(entitlementService.getAllPlans());
      setSummary(usageService.getTenantUsageSummary(tenantId));
    });
    setSummary(usageService.getTenantUsageSummary(tenantId));
    return () => {
      unsubUsage();
      unsubPlans();
    };
  }, [tenantId]);

  const filteredMetrics = useMemo(() => {
    if (selectedCategory === 'ALL') return summary.metrics;
    if (selectedCategory === 'NEAR_LIMIT') {
      return summary.metrics.filter(m => m.percentage >= 70);
    }
    return summary.metrics.filter(m => m.category === selectedCategory);
  }, [summary.metrics, selectedCategory]);

  const handleUpgradePlan = (targetPlanCode: PlanCode) => {
    setIsProcessingUpgrade(true);
    setTimeout(() => {
      usageService.upgradePlan(tenantId, targetPlanCode);
      setIsProcessingUpgrade(false);
      setIsUpgradeModalOpen(false);
      const planName = entitlementService.getPlan(targetPlanCode)?.name || targetPlanCode;
      if (showToast) {
        showToast(`🎉 Subscription successfully updated to ${planName}! All quotas and module entitlements refreshed.`);
      }
    }, 600);
  };

  const handleBuyAddon = () => {
    if (!selectedAddon) return;
    usageService.purchaseAddOn(tenantId, selectedAddon.id, addonQuantity);
    setIsAddonModalOpen(false);
    if (showToast) {
      showToast(`✅ Successfully provisioned ${selectedAddon.name} (x${addonQuantity}) for your tenant!`);
    }
    setSelectedAddon(null);
    setAddonQuantity(1);
  };

  const handleSimulateSurge = () => {
    usageService.simulateSurge(tenantId);
    if (showToast) {
      showToast('⚡ Simulated usage surge applied. Gauges updated to demonstrate threshold warnings.');
    }
  };

  const handleResetCycle = () => {
    usageService.resetMonthlyUsageCycle(tenantId);
    if (showToast) {
      showToast('🔄 Monthly cycle consumption reset for demonstration.');
    }
  };

  const getMetricIcon = (iconName: string) => {
    switch (iconName) {
      case 'FileText': return <FileText size={18} />;
      case 'QrCode': return <QrCode size={18} />;
      case 'Truck': return <Truck size={18} />;
      case 'RefreshCw': return <RefreshCw size={18} />;
      case 'Users': return <Users size={18} />;
      case 'Building2': return <Building2 size={18} />;
      case 'HardDrive': return <HardDrive size={18} />;
      case 'Sparkles': return <Sparkles size={18} />;
      case 'Cpu': return <Cpu size={18} />;
      default: return <Gauge size={18} />;
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(num);
  };

  const formatStorage = (mb: number) => {
    if (mb >= 1048576) {
      return `${(mb / 1048576).toFixed(1)} TB`;
    }
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  const getStatusColor = (status: UsageMetricItem['status'], pct: number) => {
    if (status === 'EXCEEDED' || pct >= 100) {
      return {
        bar: 'bg-rose-500',
        text: 'text-rose-700',
        badgeBg: 'bg-rose-50 border-rose-200 text-rose-700',
        iconBg: 'bg-rose-100 text-rose-600',
      };
    }
    if (status === 'CRITICAL' || pct >= 90) {
      return {
        bar: 'bg-amber-500',
        text: 'text-amber-700',
        badgeBg: 'bg-amber-50 border-amber-200 text-amber-700',
        iconBg: 'bg-amber-100 text-amber-600',
      };
    }
    if (status === 'WARNING' || pct >= 70) {
      return {
        bar: 'bg-blue-500',
        text: 'text-blue-700',
        badgeBg: 'bg-blue-50 border-blue-200 text-blue-700',
        iconBg: 'bg-blue-100 text-blue-600',
      };
    }
    return {
      bar: 'bg-emerald-500',
      text: 'text-emerald-700',
      badgeBg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      iconBg: 'bg-emerald-100 text-emerald-600',
    };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Plan Header Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-80 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Crown size={13} className="text-amber-400" />
                Current Active Plan
              </span>

              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Subscription Active
              </span>

              <span className="px-3 py-1 bg-slate-800/80 text-slate-300 border border-slate-700 rounded-full text-xs font-medium">
                {summary.subscription.billingCycle} Billing
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {summary.plan.name}
              </h1>
              <span className="text-sm font-medium text-slate-400">
                ₹{formatNumber(summary.subscription.billingCycle === 'ANNUAL' ? summary.plan.annualPriceInr / 12 : summary.plan.monthlyPriceInr)}/month
              </span>
            </div>

            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              {summary.plan.description}
            </p>

            {/* Billing Cycle Progress */}
            <div className="pt-2 max-w-lg">
              <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5 font-medium">
                <span className="flex items-center gap-1 text-slate-300">
                  <Clock size={13} className="text-indigo-400" />
                  Cycle Reset in <strong className="text-white font-bold">{summary.billingPeriod.daysRemaining} days</strong>
                </span>
                <span>{summary.billingPeriod.progressPct}% of 30-Day Period</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-blue-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${summary.billingPeriod.progressPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0">
            <button
              onClick={() => setIsUpgradeModalOpen(true)}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 group"
            >
              <Zap size={16} className="text-amber-300 group-hover:rotate-12 transition-transform" />
              Upgrade Plan Tier
              <ArrowUpRight size={15} />
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setIsAddonModalOpen(true)}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
              >
                <Plus size={14} className="text-indigo-400" />
                Add-On Quota
              </button>

              <button
                onClick={() => setShowSimulateDrawer(!showSimulateDrawer)}
                title="Simulation Controls"
                className="p-2.5 bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-600 rounded-xl transition-all"
              >
                <Sliders size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Simulation Bar (Collapsible) */}
        {showSimulateDrawer && (
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Info size={14} className="text-indigo-400" />
              <span>Usage Simulation Suite (Instant sandbox stress-testing for quota gauges)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSimulateSurge}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all"
              >
                <Zap size={13} />
                Simulate 92% Peak Surge
              </button>
              <button
                onClick={handleResetCycle}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all"
              >
                <RotateCcw size={13} />
                Reset Cycle
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upgrade Recommendation Alert (When approaching threshold or on non-enterprise plan) */}
      {summary.recommendedUpgradePlan && (
        <div className={`p-5 rounded-2xl border transition-all ${
          summary.overallHealth === 'CRITICAL' 
            ? 'bg-rose-50/80 border-rose-200' 
            : summary.overallHealth === 'WARNING' 
            ? 'bg-amber-50/80 border-amber-200' 
            : 'bg-indigo-50/60 border-indigo-100'
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                summary.overallHealth === 'CRITICAL' 
                  ? 'bg-rose-100 text-rose-600' 
                  : summary.overallHealth === 'WARNING' 
                  ? 'bg-amber-100 text-amber-600' 
                  : 'bg-indigo-100 text-indigo-600'
              }`}>
                {summary.overallHealth === 'CRITICAL' ? (
                  <AlertCircle size={22} />
                ) : (
                  <Sparkles size={22} />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    {summary.overallHealth === 'CRITICAL'
                      ? `Quota Warning: ${summary.highestConsumedMetric.label} at ${summary.highestConsumedMetric.percentage}%`
                      : `Recommended Upgrade: Unlock ${summary.recommendedUpgradePlan.name}`}
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-white border border-slate-200 text-slate-700 shadow-2xs">
                    Next Tier
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {summary.overallHealth === 'CRITICAL' 
                    ? `You have reached ${summary.highestConsumedMetric.percentage}% of your ${summary.highestConsumedMetric.label.toLowerCase()} limit. Upgrade to ${summary.recommendedUpgradePlan.name} to avoid processing throttling.`
                    : `Scale your operations with ${formatNumber(summary.recommendedUpgradePlan.limits.monthlyInvoiceVolume)} monthly invoices, ${summary.recommendedUpgradePlan.limits.maxUsers} user seats, and expanded enterprise tools.`
                  }
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsUpgradeModalOpen(true)}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shrink-0 flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <span>Explore {summary.recommendedUpgradePlan.name}</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80">
          {[
            { id: 'ALL', label: 'All Resources' },
            { id: 'NEAR_LIMIT', label: 'High Utilization (≥70%)', count: summary.metrics.filter(m => m.percentage >= 70).length },
            { id: 'LEDGER', label: 'Ledger & Sales' },
            { id: 'COMPLIANCE', label: 'GSTN & E-Way' },
            { id: 'INFRASTRUCTURE', label: 'Seats & Storage' },
            { id: 'INTELLIGENCE', label: 'AI & APIs' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                selectedCategory === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  selectedCategory === tab.id ? 'bg-amber-100 text-amber-800' : 'bg-amber-200 text-amber-900'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="text-xs font-semibold text-slate-500 flex items-center gap-2 self-end sm:self-auto">
          <span>Tracking <strong>{filteredMetrics.length}</strong> metrics</span>
        </div>
      </div>

      {/* Usage Metric Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredMetrics.map(metric => {
          const colors = getStatusColor(metric.status, metric.percentage);
          const isStorage = metric.id === 'storage';

          return (
            <div 
              key={metric.id}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
            >
              <div>
                {/* Metric Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${colors.iconBg} transition-transform group-hover:scale-105`}>
                      {getMetricIcon(metric.iconName)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        {metric.label}
                      </h4>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        {metric.category}
                      </span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${colors.badgeBg} flex items-center gap-1 shrink-0`}>
                    {metric.isUnlimited ? (
                      'Unlimited'
                    ) : (
                      `${metric.percentage}%`
                    )}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-500 mb-4 leading-relaxed min-h-[32px]">
                  {metric.description}
                </p>

                {/* Numeric Usage Counters */}
                <div className="flex items-baseline justify-between mb-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-slate-900">
                      {isStorage ? formatStorage(metric.current) : formatNumber(metric.current)}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      / {metric.isUnlimited ? '∞ Unlimited' : (isStorage ? formatStorage(metric.limit) : `${formatNumber(metric.limit)} ${metric.unit}`)}
                    </span>
                  </div>

                  {!metric.isUnlimited && (
                    <span className="text-[11px] font-semibold text-slate-500">
                      {metric.limit - metric.current > 0 
                        ? `${isStorage ? formatStorage(metric.limit - metric.current) : formatNumber(metric.limit - metric.current)} left`
                        : '0 remaining'}
                    </span>
                  )}
                </div>

                {/* Visual Progress Bar */}
                <div className="w-full bg-slate-100 rounded-full h-2.5 p-0.5 overflow-hidden relative">
                  <div 
                    className={`h-full rounded-full transition-all duration-700 ${colors.bar}`}
                    style={{ width: `${Math.min(100, metric.percentage)}%` }}
                  />
                </div>
              </div>

              {/* Metric Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <TrendingUp size={12} className="text-slate-400" />
                  {metric.trendLabel || 'Updated in real-time'}
                </span>

                <button
                  onClick={() => {
                    const matchedAddon = POPULAR_ADD_ONS.find(a => 
                      (metric.id === 'invoices' && a.category === 'INVOICES') ||
                      (metric.id === 'users' && a.category === 'USERS') ||
                      (metric.id === 'storage' && a.category === 'STORAGE') ||
                      (metric.id === 'ai' && a.category === 'AI') ||
                      (metric.id === 'gstin' && a.category === 'GSTIN')
                    );
                    if (matchedAddon) {
                      setSelectedAddon(matchedAddon);
                      setIsAddonModalOpen(true);
                    } else {
                      setIsUpgradeModalOpen(true);
                    }
                  }}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5 transition-colors"
                >
                  <Plus size={12} />
                  Add Capacity
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quota Add-On Quick Packs Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Zap size={18} className="text-amber-500" />
              On-Demand Quota Boost Packs
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Need extra capacity without moving to a higher subscription tier? Add modular capacity packs instantly.
            </p>
          </div>

          <button
            onClick={() => setIsUpgradeModalOpen(true)}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 self-start sm:self-auto"
          >
            Compare Full Tier Features
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 pt-1">
          {POPULAR_ADD_ONS.map(addon => (
            <div 
              key={addon.id}
              className="p-4 bg-slate-50/80 hover:bg-indigo-50/40 border border-slate-200/80 hover:border-indigo-200 rounded-2xl transition-all flex flex-col justify-between group"
            >
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 block mb-1">
                  {addon.category}
                </span>
                <h4 className="text-xs font-bold text-slate-900 leading-snug">
                  {addon.name}
                </h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                  {addon.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-slate-900">
                    ₹{formatNumber(addon.monthlyPriceInr)}
                  </span>
                  <span className="text-[10px] text-slate-400">/mo</span>
                </div>

                <button
                  onClick={() => {
                    setSelectedAddon(addon);
                    setIsAddonModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-200 hover:border-indigo-600 rounded-xl text-xs font-bold transition-all shadow-2xs group-hover:bg-indigo-600 group-hover:text-white"
                >
                  Add +
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* UPGRADE PLAN TIERS MODAL */}
      {/* ========================================================================= */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 sm:p-8 bg-slate-900 text-white relative shrink-0">
              <div className="absolute top-0 right-0 w-80 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-center justify-between">
                <div>
                  <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider rounded-full inline-flex items-center gap-1.5 mb-2">
                    <Crown size={12} className="text-amber-400" />
                    Subscription Upgrade Center
                  </span>
                  <h2 className="text-2xl font-black tracking-tight">
                    Scale Your GST Compliance Engine
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">
                    Choose the plan that fits your corporate transaction volume, e-invoicing scale, and enterprise multi-entity architecture.
                  </p>
                </div>

                <button
                  onClick={() => setIsUpgradeModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Billing Toggle (Monthly vs Annual) */}
              <div className="mt-6 flex items-center gap-3">
                <div className="bg-slate-800 p-1 rounded-xl flex items-center border border-slate-700">
                  <button
                    onClick={() => setBillingInterval('MONTHLY')}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      billingInterval === 'MONTHLY'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Monthly Billing
                  </button>
                  <button
                    onClick={() => setBillingInterval('ANNUAL')}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      billingInterval === 'ANNUAL'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Annual Billing
                    <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black rounded uppercase">
                      2 Mo Free
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Plans Comparison */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {allPlans.map(plan => {
                  const isCurrent = plan.code === summary.plan.code;
                  const price = billingInterval === 'ANNUAL' ? Math.round(plan.annualPriceInr / 12) : plan.monthlyPriceInr;

                  return (
                    <div
                      key={plan.code}
                      className={`rounded-2xl p-5 border flex flex-col justify-between transition-all relative ${
                        isCurrent
                          ? 'border-indigo-600 bg-indigo-50/20 ring-2 ring-indigo-600/20'
                          : plan.code === PlanCode.ENTERPRISE
                          ? 'border-amber-300 bg-amber-50/10'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {isCurrent && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-sm">
                          Current Plan
                        </span>
                      )}

                      {plan.code === PlanCode.ENTERPRISE && !isCurrent && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-sm">
                          Most Popular
                        </span>
                      )}

                      <div>
                        <h3 className="text-base font-black text-slate-900">
                          {plan.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 min-h-[36px] leading-relaxed">
                          {plan.description}
                        </p>

                        <div className="my-4 pt-3 border-t border-slate-100">
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-slate-900">
                              ₹{formatNumber(billingInterval === 'ANNUAL' ? plan.annualPriceInr : plan.monthlyPriceInr)}
                            </span>
                            <span className="text-xs font-bold text-slate-600">
                              {billingInterval === 'ANNUAL' ? '/yr' : '/mo'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-slate-500 font-medium">
                              {billingInterval === 'ANNUAL' 
                                ? `~₹${formatNumber(Math.round(plan.annualPriceInr / 12))}/mo • Billed Annually` 
                                : 'Billed Monthly'}
                            </span>
                            {billingInterval === 'ANNUAL' && (
                              <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded">
                                Annual Plan
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Limit Highlights */}
                        <div className="space-y-2 py-3 border-t border-slate-100 text-xs">
                          <div className="flex justify-between items-center text-slate-700 font-medium">
                            <span className="text-slate-500">Monthly Invoices:</span>
                            <span className="font-bold">{formatNumber(plan.limits.monthlyInvoiceVolume)}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-700 font-medium">
                            <span className="text-slate-500">Team Seats:</span>
                            <span className="font-bold">{plan.limits.maxUsers} Users</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-700 font-medium">
                            <span className="text-slate-500">State GSTINs:</span>
                            <span className="font-bold">{plan.limits.maxGstins} States</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-700 font-medium">
                            <span className="text-slate-500">Cloud Storage:</span>
                            <span className="font-bold">{formatStorage(plan.limits.storageMb)}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-700 font-medium">
                            <span className="text-slate-500">IRP E-Invoicing:</span>
                            <span className="font-bold">{plan.limits.monthlyEinvoiceVolume > 0 ? formatNumber(plan.limits.monthlyEinvoiceVolume) : '—'}</span>
                          </div>
                        </div>

                        {/* Features Checkmark */}
                        <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                          {plan.features.slice(0, 5).map(f => (
                            <div key={f} className="flex items-center gap-2">
                              <Check size={13} className="text-emerald-500 shrink-0" />
                              <span className="truncate">{f.replace(/_/g, ' ').toUpperCase()}</span>
                            </div>
                          ))}
                          {plan.features.length > 5 && (
                            <p className="text-[10px] text-indigo-600 font-semibold pt-1">
                              +{plan.features.length - 5} additional enterprise features
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="pt-5 mt-4 border-t border-slate-100">
                        {isCurrent ? (
                          <button
                            disabled
                            className="w-full py-2.5 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl cursor-not-allowed text-center"
                          >
                            Active Subscription
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpgradePlan(plan.code)}
                            disabled={isProcessingUpgrade}
                            className={`w-full py-2.5 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 ${
                              plan.code === PlanCode.ENTERPRISE
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
                                : 'bg-slate-900 hover:bg-slate-800 text-white'
                            }`}
                          >
                            {isProcessingUpgrade ? 'Switching...' : `Switch to ${plan.name.split(' ')[0]}`}
                            <ArrowUpRight size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 shrink-0">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-slate-400" />
                <span>Enterprise SLA Guarantee • Instant Plan Activation • Prorated Billing</span>
              </div>

              <button
                onClick={() => setIsUpgradeModalOpen(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold rounded-xl transition-all"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD-ON QUANTITY PURCHASE MODAL */}
      {/* ========================================================================= */}
      {isAddonModalOpen && selectedAddon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block mb-1">
                  Add-On Capacity Provisioning
                </span>
                <h3 className="text-lg font-black">{selectedAddon.name}</h3>
              </div>
              <button
                onClick={() => setIsAddonModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-xs text-slate-600 leading-relaxed">
                {selectedAddon.description}. This quota expansion is added directly on top of your current plan limits.
              </p>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Pack Unit Increment:</span>
                  <strong className="text-slate-900 font-bold">
                    +{formatNumber(selectedAddon.unitIncrement)} {selectedAddon.unitLabel}
                  </strong>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Monthly Price per Pack:</span>
                  <strong className="text-indigo-600 font-black">₹{formatNumber(selectedAddon.monthlyPriceInr)} / mo</strong>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Quantity of Packs:</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAddonQuantity(Math.max(1, addonQuantity - 1))}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-all"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-black text-slate-900 text-sm">
                      {addonQuantity}
                    </span>
                    <button
                      onClick={() => setAddonQuantity(addonQuantity + 1)}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-all"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                    Total Additional Capacity
                  </span>
                  <span className="text-sm font-black text-indigo-950">
                    +{formatNumber(selectedAddon.unitIncrement * addonQuantity)} {selectedAddon.unitLabel}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-500 block">Total Recurring</span>
                  <span className="text-base font-black text-indigo-600">
                    ₹{formatNumber(selectedAddon.monthlyPriceInr * addonQuantity)}/mo
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsAddonModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleBuyAddon}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <Check size={14} />
                Confirm & Activate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanUsageDashboard;
