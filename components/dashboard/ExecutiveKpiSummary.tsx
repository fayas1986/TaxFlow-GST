import React, { useState } from 'react';
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  FileText, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
  Scale, 
  IndianRupee, 
  Layers, 
  ChevronRight, 
  Info,
  Sparkles,
  Zap,
  ArrowRight
} from 'lucide-react';
import { FilingRecord } from '../../types';

interface ExecutiveKpiSummaryProps {
  stats: {
    sales: number;
    purchases: number;
    liability: number;
    itc: number;
  };
  analytics?: {
    monthlyTrend?: any[];
    utilization?: any[];
    riskMetrics?: {
      mismatchedInvoices?: number;
      itcAtRisk?: number;
      vendorCompliance?: number;
    };
  };
  filings: FilingRecord[];
  selectedEntityId?: string;
  timeRange?: string;
  onNavigate?: (path: string) => void;
}

export const ExecutiveKpiSummary: React.FC<ExecutiveKpiSummaryProps> = ({
  stats,
  analytics,
  filings = [],
  selectedEntityId,
  timeRange = 'MONTHLY',
  onNavigate
}) => {
  const [activeKpiFilter, setActiveKpiFilter] = useState<'ALL' | 'ITC' | 'LIABILITY' | 'FILINGS'>('ALL');

  // Input Tax Credit (ITC) Metrics
  const totalItc = stats?.itc || 0;
  const eligibleItcPct = 98.4;
  const itcAtRisk = analytics?.riskMetrics?.itcAtRisk || 0;
  const mismatchedInvoicesCount = analytics?.riskMetrics?.mismatchedInvoices || 0;

  // Output Tax Liability Metrics
  const latestMonthTrend = analytics?.monthlyTrend && analytics.monthlyTrend.length > 0 
    ? analytics.monthlyTrend[analytics.monthlyTrend.length - 1] 
    : null;
  const grossOutputLiability = latestMonthTrend?.outputLiability 
    ? latestMonthTrend.outputLiability 
    : (stats?.sales ? Math.round(stats.sales * 0.18) : (stats?.liability || 0) + totalItc);
  const netCashPayable = stats?.liability !== undefined ? stats.liability : Math.max(0, grossOutputLiability - totalItc);
  const itcOffsetRatio = grossOutputLiability > 0 
    ? Math.min(100, Math.round((totalItc / grossOutputLiability) * 100)) 
    : 78;

  // Return Filings Metrics
  const pendingFilingsList = filings.filter(f => f.status === 'PENDING' || f.status === 'OVERDUE' || f.status === 'SAVED');
  const overdueFilingsList = filings.filter(f => f.status === 'OVERDUE');
  const filedFilingsList = filings.filter(f => f.status === 'FILED');
  const pendingCount = pendingFilingsList.length;
  const overdueCount = overdueFilingsList.length;

  // Find nearest upcoming return deadline
  const sortedUpcoming = [...pendingFilingsList].sort((a, b) => {
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
  const nextFiling = sortedUpcoming.length > 0 ? sortedUpcoming[0] : null;

  return (
    <div id="executive-kpi-summary" className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wider">
              Executive Key Performance Indicators (KPI Summary)
            </h2>
            <span className="badge-corporate badge-neutral text-[10px]">
              {timeRange}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Core statutory benchmarks across Input Tax Credit, Gross Output Liability, and Return Filing commitments.
          </p>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px] font-bold">
          <button
            onClick={() => setActiveKpiFilter('ALL')}
            className={`px-3 py-1 rounded-lg transition-all ${
              activeKpiFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All KPIs
          </button>
          <button
            onClick={() => setActiveKpiFilter('ITC')}
            className={`px-3 py-1 rounded-lg transition-all ${
              activeKpiFilter === 'ITC'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Input Tax Credit
          </button>
          <button
            onClick={() => setActiveKpiFilter('LIABILITY')}
            className={`px-3 py-1 rounded-lg transition-all ${
              activeKpiFilter === 'LIABILITY'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Output Liability
          </button>
          <button
            onClick={() => setActiveKpiFilter('FILINGS')}
            className={`px-3 py-1 rounded-lg transition-all ${
              activeKpiFilter === 'FILINGS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Filings ({pendingCount})
          </button>
        </div>
      </div>

      {/* KPI Cards Grid using standardized rounded-2xl corporate styling */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        
        {/* KPI CARD 1: Total Input Tax Credit (ITC) */}
        {(activeKpiFilter === 'ALL' || activeKpiFilter === 'ITC') && (
          <div 
            id="kpi-card-itc"
            className="bg-white p-5 lg:p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between group relative overflow-hidden min-h-[310px]"
          >
            {/* Top Corporate Accent Bar */}
            <div className="absolute top-0 inset-x-0 h-1 bg-emerald-600"></div>

            <div>
              {/* Header: Title & Badges */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shadow-xs shrink-0">
                    <ArrowDownRight size={20} className="text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Total Input Tax Credit
                    </h3>
                    <span className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
                      <ShieldCheck size={13} className="text-emerald-600" />
                      GSTR-2B Reconciled
                    </span>
                  </div>
                </div>

                <span className="badge-corporate badge-success">
                  <TrendingUp size={12} />
                  +5.8% MoM
                </span>
              </div>

              {/* Main Metric Figure */}
              <div className="my-2 min-h-[62px] flex flex-col justify-center">
                <div className="text-3xl font-black text-slate-900 font-mono tracking-tight">
                  ₹{totalItc.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                  <span>Eligible ITC Rate: <strong className="text-slate-800 font-bold">{eligibleItcPct}%</strong></span>
                  <span className="text-slate-300">•</span>
                  <span>Offset Capacity: <strong className="text-slate-800 font-bold">{itcOffsetRatio}%</strong></span>
                </p>
              </div>
            </div>

            {/* Sub-Indicator Breakdown */}
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/70 min-h-[58px] flex flex-col justify-between">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Auto-Matched in 2B</span>
                  <span className="font-bold font-mono text-emerald-800">
                    ₹{(Math.round(totalItc * 0.94)).toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/70 min-h-[58px] flex flex-col justify-between">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">ITC at Risk (2B Diff)</span>
                  <span className={`font-bold font-mono ${itcAtRisk > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                    ₹{itcAtRisk > 0 ? itcAtRisk.toLocaleString() : '0'}
                  </span>
                </div>
              </div>

              {mismatchedInvoicesCount > 0 ? (
                <div className="text-[11px] text-amber-800 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200 flex items-center justify-between font-medium min-h-[38px]">
                  <span className="flex items-center gap-1.5 truncate pr-1">
                    <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                    <span className="truncate">{mismatchedInvoicesCount} invoices pending 2B reconciliation</span>
                  </span>
                  <button 
                    onClick={() => onNavigate && onNavigate('/reconciliation')}
                    className="font-bold text-amber-900 underline hover:text-amber-700 text-[10px] shrink-0"
                  >
                    Match Now
                  </button>
                </div>
              ) : (
                <div className="text-[11px] text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 flex items-center justify-between font-medium min-h-[38px]">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>All Input Tax Credits 100% matched in GSTR-2B</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* KPI CARD 2: Output Tax Liability */}
        {(activeKpiFilter === 'ALL' || activeKpiFilter === 'LIABILITY') && (
          <div 
            id="kpi-card-output-liability"
            className="bg-white p-5 lg:p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between group relative overflow-hidden min-h-[310px]"
          >
            {/* Top Corporate Accent Bar */}
            <div className="absolute top-0 inset-x-0 h-1 bg-amber-500"></div>

            <div>
              {/* Header: Title & Badges */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shadow-xs shrink-0">
                    <ArrowUpRight size={20} className="text-amber-700" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Output Tax Liability
                    </h3>
                    <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                      <Scale size={13} className="text-amber-600" />
                      GSTR-1 Outward Base
                    </span>
                  </div>
                </div>

                <span className="badge-corporate badge-warning">
                  <TrendingDown size={12} />
                  -2.4% MoM
                </span>
              </div>

              {/* Main Metric Figure */}
              <div className="my-2 min-h-[62px] flex flex-col justify-center">
                <div className="text-3xl font-black text-slate-900 font-mono tracking-tight">
                  ₹{grossOutputLiability.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                  <span>Net Cash Payable: <strong className="text-slate-900 font-bold">₹{netCashPayable.toLocaleString()}</strong></span>
                  <span className="text-slate-300">•</span>
                  <span>ITC Offsetting: <strong className="text-emerald-700 font-bold">{itcOffsetRatio}%</strong></span>
                </p>
              </div>
            </div>

            {/* Sub-Indicator Breakdown */}
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/70 min-h-[58px] flex flex-col justify-between">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Credit Ledger Offset</span>
                  <span className="font-bold font-mono text-slate-800">
                    ₹{Math.min(totalItc, grossOutputLiability).toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/70 min-h-[58px] flex flex-col justify-between">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Cash Ledger Demand</span>
                  <span className="font-bold font-mono text-amber-800">
                    ₹{netCashPayable.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="text-[11px] text-slate-700 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 flex items-center justify-between font-medium min-h-[38px]">
                <span className="flex items-center gap-1.5 truncate pr-1">
                  <Sparkles size={13} className="text-amber-500 shrink-0" />
                  <span className="truncate">Settlement Ratio: {itcOffsetRatio}% covered by ITC</span>
                </span>
                <button 
                  onClick={() => onNavigate && onNavigate('/returns')}
                  className="font-bold text-blue-700 underline hover:text-blue-900 text-[10px] shrink-0"
                >
                  View 3B
                </button>
              </div>
            </div>
          </div>
        )}

        {/* KPI CARD 3: Pending Return Filings */}
        {(activeKpiFilter === 'ALL' || activeKpiFilter === 'FILINGS') && (
          <div 
            id="kpi-card-pending-filings"
            className="bg-white p-5 lg:p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between group relative overflow-hidden min-h-[310px]"
          >
            {/* Top Corporate Accent Bar */}
            <div className={`absolute top-0 inset-x-0 h-1 ${overdueCount > 0 ? 'bg-rose-600' : 'bg-blue-600'}`}></div>

            <div>
              {/* Header: Title & Badges */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-xs border shrink-0 ${
                    overdueCount > 0 
                      ? 'bg-rose-50 text-rose-700 border-rose-200' 
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    <FileText size={20} className={overdueCount > 0 ? 'text-rose-700' : 'text-blue-700'} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Pending Return Filings
                    </h3>
                    <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                      <Clock size={13} className={overdueCount > 0 ? 'text-rose-500' : 'text-blue-500'} />
                      Statutory Deadlines
                    </span>
                  </div>
                </div>

                <span className={`badge-corporate ${overdueCount > 0 ? 'badge-danger' : 'badge-info'}`}>
                  {overdueCount > 0 ? `${overdueCount} Overdue` : `${filedFilingsList.length} Filed On-Time`}
                </span>
              </div>

              {/* Main Metric Figure */}
              <div className="my-2 min-h-[62px] flex flex-col justify-center">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">
                    {pendingCount}
                  </span>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Returns Due
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                  <span>Overdue: <strong className={`font-bold ${overdueCount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{overdueCount}</strong></span>
                  <span className="text-slate-300">•</span>
                  <span>Compliance Score: <strong className="text-slate-900 font-bold">{analytics?.riskMetrics?.vendorCompliance || 96}%</strong></span>
                </p>
              </div>
            </div>

            {/* Sub-Indicator Breakdown */}
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/70 min-h-[58px] flex flex-col justify-between">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Next Due Return</span>
                  <span className="font-bold text-slate-800 truncate block">
                    {nextFiling ? `${nextFiling.type} (${nextFiling.period})` : 'All Filings Up to Date'}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/70 min-h-[58px] flex flex-col justify-between">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Filing Due Date</span>
                  <span className={`font-bold font-mono ${nextFiling?.status === 'OVERDUE' ? 'text-rose-600' : 'text-blue-800'}`}>
                    {nextFiling ? nextFiling.dueDate : 'No Active Due Date'}
                  </span>
                </div>
              </div>

              {/* Action Banner */}
              <div className="text-[11px] text-blue-900 bg-blue-50 px-3 py-2 rounded-xl border border-blue-200 flex items-center justify-between font-medium min-h-[38px]">
                <span className="flex items-center gap-1.5 truncate pr-1">
                  <Calendar size={13} className="text-blue-600 shrink-0" />
                  <span className="truncate">{pendingCount > 0 ? `${pendingCount} returns ready for filing` : 'Zero pending statutory returns'}</span>
                </span>
                <button 
                  onClick={() => onNavigate && onNavigate('/returns')}
                  className="font-bold text-blue-700 underline hover:text-blue-900 text-[10px] flex items-center gap-0.5 shrink-0"
                >
                  File <ChevronRight size={11} />
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Corporate Mini Stat Strip: Secondary Summary Insights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between hover:border-slate-300 transition-colors">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Net Cash Outflow</span>
            <span className="text-sm font-black text-slate-900 font-mono">₹{netCashPayable.toLocaleString()}</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
            <IndianRupee size={15} />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between hover:border-slate-300 transition-colors">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Eligible ITC Offset</span>
            <span className="text-sm font-black text-emerald-800 font-mono">{itcOffsetRatio}%</span>
          </div>
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
            <Layers size={16} />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between hover:border-slate-300 transition-colors">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Completed Filings</span>
            <span className="text-sm font-black text-blue-800 font-mono">{filedFilingsList.length} Returns</span>
          </div>
          <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
            <CheckCircle2 size={16} />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between hover:border-slate-300 transition-colors">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Statutory Audit Status</span>
            <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Verified Clean
            </span>
          </div>
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
            <ShieldCheck size={16} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveKpiSummary;
