import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { useNavigate } from 'react-router-dom';
import { 
  Gauge, 
  FileText, 
  Zap, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  Sparkles, 
  X, 
  Layers, 
  ArrowUpRight,
  TrendingUp,
  Clock
} from 'lucide-react';
import { usageService } from '../src/core/entitlements/usageService';
import { entitlementService } from '../src/core/entitlements/entitlementService';
import { PlanCode, TenantUsageSummary, UsageMetricItem } from '../src/core/entitlements/types';
import { subscriptionManager } from '../src/core/billing/SubscriptionManager';

export interface PlanUsageBannerProps {
  onNavigate?: (path: string) => void;
  onOpenUpgradeModal?: () => void;
  className?: string;
  allowDismiss?: boolean;
}

export const PlanUsageBanner: React.FC<PlanUsageBannerProps> = ({
  onNavigate,
  onOpenUpgradeModal,
  className = '',
  allowDismiss = true
}) => {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const tenantId = user?.currentTenantId || 't1';

  const [summary, setSummary] = useState<TenantUsageSummary>(() => 
    usageService.getTenantUsageSummary(tenantId)
  );
  const [isDismissed, setIsDismissed] = useState(false);

  // Subscribe to real-time consumption and quota adjustments
  useEffect(() => {
    const unsub = usageService.subscribe(() => {
      setSummary(usageService.getTenantUsageSummary(tenantId));
    });
    setSummary(usageService.getTenantUsageSummary(tenantId));
    return unsub;
  }, [tenantId]);

  // Reset dismissal state when tenant or plan changes
  useEffect(() => {
    setIsDismissed(false);
  }, [tenantId, summary.plan.code]);

  // Check if current plan is an unlimited enterprise tier
  const isUnlimitedEnterprise = useMemo(() => {
    // 1. Enterprise Plus is explicitly unlimited across all metrics
    if (summary.plan.code === PlanCode.ENTERPRISE_PLUS) {
      return true;
    }

    // 2. Custom or Enterprise plans where invoice volume is practically unlimited
    const invoiceLimit = summary.plan.limits?.monthlyInvoiceVolume ?? 0;
    if (invoiceLimit >= 999999 || invoiceLimit === 0 && summary.plan.code === PlanCode.ENTERPRISE) {
      return true;
    }

    // 3. If all core operational metrics are flagged as isUnlimited
    const coreMetrics = summary.metrics.filter(m => m.id === 'invoices');
    if (coreMetrics.length > 0 && coreMetrics.every(m => m.isUnlimited)) {
      return true;
    }

    return false;
  }, [summary]);

  // Find primary invoice metric
  const invoiceMetric = useMemo(() => {
    return summary.metrics.find(m => m.id === 'invoices') || {
      id: 'invoices',
      label: 'Monthly Invoices Processed',
      current: 0,
      limit: summary.plan.limits?.monthlyInvoiceVolume || 500,
      unit: 'Invoices',
      percentage: 0,
      status: 'HEALTHY' as const,
      isUnlimited: false
    };
  }, [summary.metrics, summary.plan.limits]);

  // Secondary metrics for quick preview (e.g. AI queries, E-Invoices, E-Way bills if available)
  const secondaryMetric = useMemo(() => {
    const candidate = summary.metrics.find(m => 
      m.id !== 'invoices' && m.limit > 0 && !m.isUnlimited && (m.percentage >= 70 || m.id === 'ai' || m.id === 'einvoice')
    );
    return candidate || summary.metrics.find(m => m.id === 'ai');
  }, [summary.metrics]);

  // If user is on an unlimited enterprise tier, dynamically hide the banner
  if (isUnlimitedEnterprise) {
    return null;
  }

  // If user dismissed it and it's not critical (percentage < 90), keep hidden
  if (isDismissed && invoiceMetric.percentage < 90) {
    return null;
  }

  const handleAction = () => {
    if (onOpenUpgradeModal) {
      onOpenUpgradeModal();
    } else if (onNavigate) {
      onNavigate('/plan-usage');
    } else {
      navigate('/plan-usage');
    }
  };

  const percentage = Math.min(100, invoiceMetric.percentage);
  const isNearLimit = percentage >= 70;
  const isCritical = percentage >= 90;
  const isExceeded = invoiceMetric.status === 'EXCEEDED' || percentage >= 100;

  // Visual status stylings
  let statusBadgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
  let progressBgColor = 'bg-blue-600';
  let bannerBorderColor = 'border-slate-200';
  let bannerBg = 'bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white';

  if (isExceeded) {
    statusBadgeColor = 'bg-rose-500 text-white border-rose-600';
    progressBgColor = 'bg-rose-500';
    bannerBorderColor = 'border-rose-500/30';
    bannerBg = 'bg-gradient-to-r from-slate-950 via-rose-950/80 to-slate-900 text-white';
  } else if (isCritical) {
    statusBadgeColor = 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold';
    progressBgColor = 'bg-amber-400';
    bannerBorderColor = 'border-amber-500/30';
    bannerBg = 'bg-gradient-to-r from-slate-950 via-amber-950/60 to-slate-900 text-white';
  } else if (isNearLimit) {
    statusBadgeColor = 'bg-amber-100 text-amber-900 border-amber-300';
    progressBgColor = 'bg-amber-400';
  }

  return (
    <div 
      className={`relative overflow-hidden rounded-2xl p-4 md:p-5 shadow-lg border ${bannerBorderColor} ${bannerBg} transition-all duration-300 ${className}`}
      role="region"
      aria-label="Plan Quota and Usage Status"
    >
      {/* Background ambient glow */}
      <div className="absolute top-0 right-1/4 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />
      {isCritical && (
        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
      )}

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left column: Plan info and metrics summary */}
        <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
          <div className={`p-2.5 rounded-xl shrink-0 flex items-center justify-center ${
            isExceeded ? 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/40' :
            isCritical ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40' :
            'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40'
          }`}>
            {isExceeded ? (
              <AlertCircle size={22} className="animate-pulse" />
            ) : isCritical ? (
              <AlertTriangle size={22} />
            ) : (
              <Gauge size={22} />
            )}
          </div>

          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                {summary.plan.name}
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs font-bold text-slate-200">
                Live Quota Status
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusBadgeColor}`}>
                {isExceeded ? 'Quota Exceeded' : isCritical ? 'Critical (≥90%)' : isNearLimit ? '70% Reached' : 'Healthy'}
              </span>
              {summary.billingPeriod?.daysRemaining > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium ml-auto lg:ml-0">
                  <Clock size={11} /> {summary.billingPeriod.daysRemaining} days left in cycle
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <div className="flex items-center gap-1.5">
                <FileText size={14} className="text-slate-400" />
                <span className="text-sm font-extrabold text-white">
                  {invoiceMetric.current.toLocaleString()} / {invoiceMetric.limit.toLocaleString()} {invoiceMetric.unit}
                </span>
                <span className={`text-xs font-bold ${isCritical ? 'text-amber-300' : 'text-slate-300'}`}>
                  ({percentage}%)
                </span>
              </div>

              {secondaryMetric && secondaryMetric.limit > 0 && (
                <div className="hidden md:flex items-center gap-1 text-xs text-slate-400 border-l border-slate-700 pl-3">
                  <span>{secondaryMetric.label.split(' ')[0]}:</span>
                  <span className="font-semibold text-slate-200">
                    {secondaryMetric.current} / {secondaryMetric.limit}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center/Right: Progress bar and action button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:gap-4 shrink-0">
          <div className="w-full sm:w-48 md:w-56 space-y-1.5">
            <div className="flex justify-between text-[11px] font-bold">
              <span className="text-slate-400">Monthly Usage</span>
              <span className={isCritical ? 'text-amber-300 font-extrabold' : 'text-slate-200'}>
                {invoiceMetric.limit - invoiceMetric.current > 0 
                  ? `${(invoiceMetric.limit - invoiceMetric.current).toLocaleString()} remaining` 
                  : '0 slots remaining'}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-800/80 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${progressBgColor}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAction}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap ${
                isExceeded || isCritical
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-400/20'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20 hover:shadow-blue-500/30'
              }`}
            >
              <Zap size={14} className={isCritical ? 'fill-current' : ''} />
              <span>{isExceeded || isCritical ? 'Upgrade Plan' : 'View Quotas'}</span>
              <ChevronRight size={13} strokeWidth={3} />
            </button>

            {allowDismiss && !isCritical && (
              <button
                onClick={() => setIsDismissed(true)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors cursor-pointer"
                title="Dismiss quota banner"
                aria-label="Dismiss banner"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanUsageBanner;
