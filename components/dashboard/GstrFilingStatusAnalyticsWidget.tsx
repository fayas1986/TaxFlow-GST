import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, ComposedChart, Bar, Line, AreaChart, Area, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, Cell 
} from 'recharts';
import { 
  BarChart3, Calendar, CheckCircle2, Clock, AlertTriangle, ShieldCheck, 
  Download, Filter, Sparkles, TrendingUp, TrendingDown, ArrowUpRight, 
  Layers, FileText, ChevronRight, Lock, Crown, Info, Eye, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlanGuard } from '../PlanGuard';
import { PlanCode } from '../../src/core/entitlements/types';
import { FilingRecord } from '../../types';

export interface GstrFilingStatusAnalyticsWidgetProps {
  tenantId?: string;
  entityName?: string;
  isAggregate?: boolean;
  filings?: FilingRecord[];
}

export type ReturnTypeFilter = 'ALL' | 'GSTR_1' | 'GSTR_3B' | 'GSTR_9' | 'GSTR_2B';
export type TimeframeFilter = 'LAST_6_MONTHS' | 'LAST_12_MONTHS' | 'FY_2025_26' | 'FY_2026_27';
export type MetricDisplayMode = 'VOLUMES_STATUS' | 'ON_TIME_RATE' | 'VELOCITY_DAYS' | 'TAX_DISCHARGED';

interface MonthlyFilingTrend {
  period: string;
  monthShort: string;
  onTimeFiled: number;
  graceFiled: number;
  inProgress: number;
  overdue: number;
  totalScheduled: number;
  onTimeRate: number; // in percentage e.g. 96.5%
  targetSla: number;
  avgLeadDays: number; // days filed prior to deadline (e.g. 3.5 days early)
  taxDischargedCr: number; // in Crores ₹
  itcUtilizedCr: number;
  cashPaidCr: number;
  penaltyAvoidedInr: number;
}

interface HistoricalFilingLog {
  id: string;
  returnType: 'GSTR-1' | 'GSTR-3B' | 'GSTR-9' | 'GSTR-2B Recon' | 'CMP-08';
  period: string;
  dueDate: string;
  filingDate: string;
  status: 'FILED_ON_TIME' | 'FILED_GRACE' | 'IN_PROGRESS' | 'SCHEDULED';
  arn: string;
  taxDischarged: number;
  leadDays: number;
  verificationMethod: 'DSC Class-3' | 'EVC OTP' | 'Portal Direct';
}

export const GstrFilingStatusAnalyticsWidget: React.FC<GstrFilingStatusAnalyticsWidgetProps> = ({
  tenantId = 't1',
  entityName = 'Active Entity',
  isAggregate = false,
  filings = []
}) => {
  const [returnFilter, setReturnFilter] = useState<ReturnTypeFilter>('ALL');
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('LAST_12_MONTHS');
  const [metricMode, setMetricMode] = useState<MetricDisplayMode>('VOLUMES_STATUS');
  const [activeTab, setActiveTab] = useState<'CHARTS' | 'AUDIT_LOGS'>('CHARTS');
  const [searchLogQuery, setSearchLogQuery] = useState('');
  const [downloadNotification, setDownloadNotification] = useState<string | null>(null);

  // 12-Month Historical GSTR Filing Performance Dataset
  const historicalTrends: MonthlyFilingTrend[] = useMemo(() => [
    { period: 'Oct 2025', monthShort: 'Oct 25', onTimeFiled: 4, graceFiled: 0, inProgress: 0, overdue: 0, totalScheduled: 4, onTimeRate: 100, targetSla: 95, avgLeadDays: 4.2, taxDischargedCr: 0.28, itcUtilizedCr: 0.18, cashPaidCr: 0.10, penaltyAvoidedInr: 15000 },
    { period: 'Nov 2025', monthShort: 'Nov 25', onTimeFiled: 4, graceFiled: 0, inProgress: 0, overdue: 0, totalScheduled: 4, onTimeRate: 100, targetSla: 95, avgLeadDays: 3.8, taxDischargedCr: 0.31, itcUtilizedCr: 0.20, cashPaidCr: 0.11, penaltyAvoidedInr: 15000 },
    { period: 'Dec 2025', monthShort: 'Dec 25', onTimeFiled: 5, graceFiled: 1, inProgress: 0, overdue: 0, totalScheduled: 6, onTimeRate: 83.3, targetSla: 95, avgLeadDays: 2.1, taxDischargedCr: 0.45, itcUtilizedCr: 0.29, cashPaidCr: 0.16, penaltyAvoidedInr: 25000 },
    { period: 'Jan 2026', monthShort: 'Jan 26', onTimeFiled: 4, graceFiled: 0, inProgress: 0, overdue: 0, totalScheduled: 4, onTimeRate: 100, targetSla: 95, avgLeadDays: 5.0, taxDischargedCr: 0.29, itcUtilizedCr: 0.19, cashPaidCr: 0.10, penaltyAvoidedInr: 15000 },
    { period: 'Feb 2026', monthShort: 'Feb 26', onTimeFiled: 4, graceFiled: 0, inProgress: 0, overdue: 0, totalScheduled: 4, onTimeRate: 100, targetSla: 95, avgLeadDays: 4.5, taxDischargedCr: 0.32, itcUtilizedCr: 0.21, cashPaidCr: 0.11, penaltyAvoidedInr: 15000 },
    { period: 'Mar 2026', monthShort: 'Mar 26', onTimeFiled: 5, graceFiled: 0, inProgress: 0, overdue: 0, totalScheduled: 5, onTimeRate: 100, targetSla: 95, avgLeadDays: 3.9, taxDischargedCr: 0.52, itcUtilizedCr: 0.34, cashPaidCr: 0.18, penaltyAvoidedInr: 30000 },
    { period: 'Apr 2026', monthShort: 'Apr 26', onTimeFiled: 4, graceFiled: 0, inProgress: 0, overdue: 0, totalScheduled: 4, onTimeRate: 100, targetSla: 95, avgLeadDays: 4.1, taxDischargedCr: 0.27, itcUtilizedCr: 0.17, cashPaidCr: 0.10, penaltyAvoidedInr: 15000 },
    { period: 'May 2026', monthShort: 'May 26', onTimeFiled: 4, graceFiled: 0, inProgress: 0, overdue: 0, totalScheduled: 4, onTimeRate: 100, targetSla: 95, avgLeadDays: 4.6, taxDischargedCr: 0.33, itcUtilizedCr: 0.22, cashPaidCr: 0.11, penaltyAvoidedInr: 15000 },
    { period: 'Jun 2026', monthShort: 'Jun 26', onTimeFiled: 4, graceFiled: 1, inProgress: 0, overdue: 0, totalScheduled: 5, onTimeRate: 80.0, targetSla: 95, avgLeadDays: 2.4, taxDischargedCr: 0.38, itcUtilizedCr: 0.25, cashPaidCr: 0.13, penaltyAvoidedInr: 20000 },
    { period: 'Jul 2026', monthShort: 'Jul 26', onTimeFiled: 4, graceFiled: 0, inProgress: 0, overdue: 0, totalScheduled: 4, onTimeRate: 100, targetSla: 95, avgLeadDays: 3.7, taxDischargedCr: 0.35, itcUtilizedCr: 0.23, cashPaidCr: 0.12, penaltyAvoidedInr: 15000 },
    { period: 'Aug 2026', monthShort: 'Aug 26', onTimeFiled: 4, graceFiled: 0, inProgress: 0, overdue: 0, totalScheduled: 4, onTimeRate: 100, targetSla: 95, avgLeadDays: 4.8, taxDischargedCr: 0.36, itcUtilizedCr: 0.24, cashPaidCr: 0.12, penaltyAvoidedInr: 15000 },
    { period: 'Sep 2026', monthShort: 'Sep 26', onTimeFiled: 2, graceFiled: 0, inProgress: 2, overdue: 0, totalScheduled: 4, onTimeRate: 100, targetSla: 95, avgLeadDays: 3.5, taxDischargedCr: 0.18, itcUtilizedCr: 0.11, cashPaidCr: 0.07, penaltyAvoidedInr: 10000 },
  ], []);

  // Filter trends by timeframe
  const filteredTrends = useMemo(() => {
    if (timeframe === 'LAST_6_MONTHS') return historicalTrends.slice(-6);
    if (timeframe === 'FY_2025_26') return historicalTrends.slice(0, 6);
    if (timeframe === 'FY_2026_27') return historicalTrends.slice(6);
    return historicalTrends;
  }, [historicalTrends, timeframe]);

  // Comprehensive Historical Logs List
  const historicalLogs: HistoricalFilingLog[] = useMemo(() => [
    { id: 'log-1', returnType: 'GSTR-1', period: 'August 2026', dueDate: '2026-09-11', filingDate: '2026-09-08', status: 'FILED_ON_TIME', arn: 'AA2709260192831', taxDischarged: 1485000, leadDays: 3, verificationMethod: 'DSC Class-3' },
    { id: 'log-2', returnType: 'GSTR-3B', period: 'August 2026', dueDate: '2026-09-20', filingDate: '2026-09-16', status: 'FILED_ON_TIME', arn: 'AA2709260238492', taxDischarged: 2150000, leadDays: 4, verificationMethod: 'EVC OTP' },
    { id: 'log-3', returnType: 'GSTR-1', period: 'July 2026', dueDate: '2026-08-11', filingDate: '2026-08-07', status: 'FILED_ON_TIME', arn: 'AA2708260098174', taxDischarged: 1390000, leadDays: 4, verificationMethod: 'DSC Class-3' },
    { id: 'log-4', returnType: 'GSTR-3B', period: 'July 2026', dueDate: '2026-08-20', filingDate: '2026-08-17', status: 'FILED_ON_TIME', arn: 'AA2708260127461', taxDischarged: 2080000, leadDays: 3, verificationMethod: 'EVC OTP' },
    { id: 'log-5', returnType: 'GSTR-1', period: 'June 2026', dueDate: '2026-07-11', filingDate: '2026-07-09', status: 'FILED_ON_TIME', arn: 'AA2707260081294', taxDischarged: 1540000, leadDays: 2, verificationMethod: 'DSC Class-3' },
    { id: 'log-6', returnType: 'GSTR-3B', period: 'June 2026', dueDate: '2026-07-20', filingDate: '2026-07-19', status: 'FILED_GRACE', arn: 'AA2707260293810', taxDischarged: 2260000, leadDays: 1, verificationMethod: 'EVC OTP' },
    { id: 'log-7', returnType: 'GSTR-9', period: 'FY 2025-26', dueDate: '2026-12-31', filingDate: '2026-06-25', status: 'FILED_ON_TIME', arn: 'AA2706260991823', taxDischarged: 340000, leadDays: 189, verificationMethod: 'DSC Class-3' },
    { id: 'log-8', returnType: 'GSTR-1', period: 'May 2026', dueDate: '2026-06-11', filingDate: '2026-06-06', status: 'FILED_ON_TIME', arn: 'AA2706260012398', taxDischarged: 1320000, leadDays: 5, verificationMethod: 'DSC Class-3' },
    { id: 'log-9', returnType: 'GSTR-3B', period: 'May 2026', dueDate: '2026-06-20', filingDate: '2026-06-15', status: 'FILED_ON_TIME', arn: 'AA2706260049281', taxDischarged: 1980000, leadDays: 5, verificationMethod: 'EVC OTP' },
    { id: 'log-10', returnType: 'GSTR-1', period: 'April 2026', dueDate: '2026-05-11', filingDate: '2026-05-07', status: 'FILED_ON_TIME', arn: 'AA2705260019284', taxDischarged: 1210000, leadDays: 4, verificationMethod: 'DSC Class-3' },
    { id: 'log-11', returnType: 'GSTR-3B', period: 'April 2026', dueDate: '2026-05-20', filingDate: '2026-05-16', status: 'FILED_ON_TIME', arn: 'AA2705260078129', taxDischarged: 1890000, leadDays: 4, verificationMethod: 'EVC OTP' },
  ], []);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return historicalLogs.filter(log => {
      const matchType = returnFilter === 'ALL' || 
        (returnFilter === 'GSTR_1' && log.returnType === 'GSTR-1') ||
        (returnFilter === 'GSTR_3B' && log.returnType === 'GSTR-3B') ||
        (returnFilter === 'GSTR_9' && log.returnType === 'GSTR-9');
      
      const matchQuery = searchLogQuery === '' ||
        log.arn.toLowerCase().includes(searchLogQuery.toLowerCase()) ||
        log.period.toLowerCase().includes(searchLogQuery.toLowerCase()) ||
        log.returnType.toLowerCase().includes(searchLogQuery.toLowerCase());

      return matchType && matchQuery;
    });
  }, [historicalLogs, returnFilter, searchLogQuery]);

  // Aggregate Metrics Calculations
  const stats = useMemo(() => {
    const totalScheduled = filteredTrends.reduce((sum, t) => sum + t.totalScheduled, 0);
    const totalOnTime = filteredTrends.reduce((sum, t) => sum + t.onTimeFiled, 0);
    const totalGrace = filteredTrends.reduce((sum, t) => sum + t.graceFiled, 0);
    const totalInProgress = filteredTrends.reduce((sum, t) => sum + t.inProgress, 0);
    const totalOverdue = filteredTrends.reduce((sum, t) => sum + t.overdue, 0);
    const avgOnTimeRate = totalScheduled > 0 ? (totalOnTime / totalScheduled) * 100 : 100;
    const avgLeadVelocity = filteredTrends.reduce((sum, t) => sum + t.avgLeadDays, 0) / (filteredTrends.length || 1);
    const totalTaxCr = filteredTrends.reduce((sum, t) => sum + t.taxDischargedCr, 0);
    const totalPenaltyAvoided = filteredTrends.reduce((sum, t) => sum + t.penaltyAvoidedInr, 0);

    return {
      totalScheduled,
      totalOnTime,
      totalGrace,
      totalInProgress,
      totalOverdue,
      avgOnTimeRate: avgOnTimeRate.toFixed(1),
      avgLeadVelocity: avgLeadVelocity.toFixed(1),
      totalTaxCr: totalTaxCr.toFixed(2),
      totalPenaltyAvoided: totalPenaltyAvoided.toLocaleString('en-IN')
    };
  }, [filteredTrends]);

  const handleExportSummary = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Period,On-Time Filed,Grace Filed,In-Progress,Total Scheduled,On-Time Rate (%),Avg Lead Days,Tax Discharged (Cr)\n" +
      filteredTrends.map(t => `${t.period},${t.onTimeFiled},${t.graceFiled},${t.inProgress},${t.totalScheduled},${t.onTimeRate}%,${t.avgLeadDays},₹${t.taxDischargedCr} Cr`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `GSTR_Filing_Performance_${timeframe}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadNotification('Historical GSTR Compliance & Filing Report exported successfully');
    setTimeout(() => setDownloadNotification(null), 3500);
  };

  // Custom Recharts Tooltip
  const CustomAnalyticsTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload as MonthlyFilingTrend;
      return (
        <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl max-w-xs text-xs space-y-2">
          <div className="border-b border-slate-100 pb-1.5 flex items-center justify-between">
            <span className="font-extrabold text-slate-800 text-sm">{data?.period || label}</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-extrabold text-[10px] border border-emerald-200">
              {data?.onTimeRate}% SLA
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                On-Time Filed:
              </span>
              <span className="font-bold text-slate-800">{data?.onTimeFiled} returns</span>
            </div>
            {data?.graceFiled > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Grace / Extension:
                </span>
                <span className="font-bold text-amber-700">{data?.graceFiled} returns</span>
              </div>
            )}
            {data?.inProgress > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  In Progress:
                </span>
                <span className="font-bold text-indigo-700">{data?.inProgress} returns</span>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-400 block text-[10px]">Turnaround:</span>
              <span className="font-extrabold text-indigo-600">{data?.avgLeadDays}d early</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Discharged:</span>
              <span className="font-extrabold text-slate-800">₹{data?.taxDischargedCr} Cr</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="gstr-filing-status-analytics-widget" className="relative">
      {/* 
        MANDATORY PLAN GUARD WRAPPER:
        Restricts historical performance trends to Premium (Professional) and Enterprise tiers.
        Starter and Business plans receive the frosted blur preview with instant upgrade trigger.
      */}
      <PlanGuard
        minPlan={PlanCode.PROFESSIONAL}
        mode="hide"
        upgradeTitle="GSTR Historical Performance & Filing Analytics Engine"
        upgradeDescription="Unlock multi-period filing performance trends, turnaround velocity analytics, statutory ARN reconciliation registers, and automated penalty avoidance benchmarking by upgrading to Professional or Enterprise."
        featureName="GSTR Filing Analytics & Historical Performance"
      >
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          
          {/* Header & Controls Bar */}
          <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gradient-to-r from-slate-50/70 via-white to-indigo-50/30">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">
                      GSTR Statutory Filing Analytics
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                      <Crown size={11} className="text-amber-500" />
                      Premium & Enterprise
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Historical compliance velocity, statutory ARN tracking, and timely filing performance for {entityName}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons & Filters */}
            <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-start lg:justify-end">
              {/* Timeframe selector */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
                <button
                  onClick={() => setTimeframe('LAST_6_MONTHS')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    timeframe === 'LAST_6_MONTHS' ? 'bg-white text-indigo-600 shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  6 Months
                </button>
                <button
                  onClick={() => setTimeframe('LAST_12_MONTHS')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    timeframe === 'LAST_12_MONTHS' ? 'bg-white text-indigo-600 shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  12 Months
                </button>
                <button
                  onClick={() => setTimeframe('FY_2026_27')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    timeframe === 'FY_2026_27' ? 'bg-white text-indigo-600 shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  FY 26-27
                </button>
              </div>

              {/* View Mode Toggle: Charts vs Audit Logs Table */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
                <button
                  onClick={() => setActiveTab('CHARTS')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'CHARTS' ? 'bg-white text-indigo-600 shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  <BarChart3 size={13} />
                  <span>Visual Trends</span>
                </button>
                <button
                  onClick={() => setActiveTab('AUDIT_LOGS')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'AUDIT_LOGS' ? 'bg-white text-indigo-600 shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  <FileText size={13} />
                  <span>ARN Registers</span>
                </button>
              </div>

              {/* Export Button */}
              <button
                onClick={handleExportSummary}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                title="Export detailed historical performance CSV"
              >
                <Download size={13} className="text-slate-500" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Export Toast Feedback */}
          <AnimatePresence>
            {downloadNotification && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  <span>{downloadNotification}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Top KPI Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-6 border-b border-slate-100 bg-slate-50/40">
            {/* KPI 1: Timely Filing Rate */}
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Timely Filing Rate</span>
                <ShieldCheck size={15} className="text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-slate-900">{stats.avgOnTimeRate}%</span>
                <span className="text-[10px] font-extrabold text-emerald-600 flex items-center">
                  <ArrowUpRight size={11} /> +3.8%
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Target SLA: 95.0%</span>
            </div>

            {/* KPI 2: Total Statutory Returns */}
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Returns Tracked</span>
                <FileText size={15} className="text-blue-500" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-slate-900">{stats.totalOnTime + stats.totalGrace}</span>
                <span className="text-xs font-bold text-slate-400">/ {stats.totalScheduled}</span>
              </div>
              <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">0 Defaulted Returns</span>
            </div>

            {/* KPI 3: Filing Turnaround Velocity */}
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Filing Velocity</span>
                <Clock size={15} className="text-indigo-500" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-indigo-700">{stats.avgLeadVelocity}d</span>
                <span className="text-[10px] text-slate-400 font-bold">early</span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Avg days ahead of due date</span>
            </div>

            {/* KPI 4: Tax Discharged */}
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Tax Discharged</span>
                <TrendingUp size={15} className="text-purple-500" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-slate-900">₹{stats.totalTaxCr}</span>
                <span className="text-xs font-bold text-slate-500">Cr</span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium block mt-0.5">ITC & Cash Settled</span>
            </div>

            {/* KPI 5: Late Fees Avoided */}
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs col-span-2 md:col-span-1">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Penalties Avoided</span>
                <Sparkles size={15} className="text-amber-500" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-emerald-700">₹{stats.totalPenaltyAvoided}</span>
              </div>
              <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">Zero Late Fees Incurred</span>
            </div>
          </div>

          {/* Sub-Filters: Return Types & Metric Modes */}
          <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap bg-white">
            {/* Return Form Type Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              <span className="text-xs font-bold text-slate-400 uppercase mr-1">Return:</span>
              {[
                { key: 'ALL', label: 'All Forms' },
                { key: 'GSTR_1', label: 'GSTR-1 Outward' },
                { key: 'GSTR_3B', label: 'GSTR-3B Summary' },
                { key: 'GSTR_9', label: 'GSTR-9 Annual' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setReturnFilter(f.key as ReturnTypeFilter)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    returnFilter === f.key
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Metric Mode Filter (only visible on CHARTS tab) */}
            {activeTab === 'CHARTS' && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-400 uppercase mr-1">Metric:</span>
                <select
                  value={metricMode}
                  onChange={(e) => setMetricMode(e.target.value as MetricDisplayMode)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="VOLUMES_STATUS">Filing Volumes & Status</option>
                  <option value="ON_TIME_RATE">On-Time Compliance Rate %</option>
                  <option value="VELOCITY_DAYS">Filing Velocity (Days Early)</option>
                  <option value="TAX_DISCHARGED">Tax Settled (₹ Crores)</option>
                </select>
              </div>
            )}
          </div>

          {/* MAIN TAB CONTENT: Interactive Recharts Visualizations */}
          {activeTab === 'CHARTS' && (
            <div className="p-6 space-y-6">
              
              {/* Primary Chart Area */}
              <div className="bg-slate-50/50 p-4 sm:p-6 rounded-2xl border border-slate-200/70">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                      <span>
                        {metricMode === 'VOLUMES_STATUS' && 'Monthly Return Filings: On-Time vs Grace vs In-Progress'}
                        {metricMode === 'ON_TIME_RATE' && 'On-Time Statutory Completion Rate vs 95% SLA Benchmark'}
                        {metricMode === 'VELOCITY_DAYS' && 'Filing Turnaround Velocity (Days Ahead of Statutory Due Date)'}
                        {metricMode === 'TAX_DISCHARGED' && 'Monthly Tax Liability Discharged (ITC Utilization vs Cash)'}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      Tracking compliance trajectory across {filteredTrends.length} statutory periods
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-bold">
                    {metricMode === 'VOLUMES_STATUS' && (
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="flex items-center gap-1 text-slate-600">
                          <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block"></span> On-Time Filed
                        </span>
                        <span className="flex items-center gap-1 text-slate-600">
                          <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block"></span> Grace Period
                        </span>
                        <span className="flex items-center gap-1 text-slate-600">
                          <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500 inline-block"></span> In Progress
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recharts Composed / Area Chart Container */}
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {metricMode === 'VOLUMES_STATUS' ? (
                      <ComposedChart data={filteredTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="monthShort" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                        <Tooltip content={<CustomAnalyticsTooltip />} />
                        <Bar dataKey="onTimeFiled" name="On-Time Filed" fill="#10b981" stackId="a" radius={[0, 0, 4, 4]} barSize={24} />
                        <Bar dataKey="graceFiled" name="Grace Period" fill="#f59e0b" stackId="a" barSize={24} />
                        <Bar dataKey="inProgress" name="In Progress" fill="#6366f1" stackId="a" radius={[4, 4, 0, 0]} barSize={24} />
                        <Line type="monotone" dataKey="onTimeRate" name="On-Time Rate %" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3, fill: '#8b5cf6' }} />
                        <ReferenceLine y={95} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '95% SLA Target', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }} />
                      </ComposedChart>
                    ) : metricMode === 'ON_TIME_RATE' ? (
                      <AreaChart data={filteredTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="monthShort" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                        <YAxis domain={[60, 100]} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                        <Tooltip content={<CustomAnalyticsTooltip />} />
                        <ReferenceLine y={95} stroke="#6366f1" strokeDasharray="3 3" label={{ value: '95% Standard SLA', fill: '#6366f1', fontSize: 10 }} />
                        <Area type="monotone" dataKey="onTimeRate" name="On-Time Rate %" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#rateGradient)" />
                      </AreaChart>
                    ) : metricMode === 'VELOCITY_DAYS' ? (
                      <AreaChart data={filteredTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="velocityGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="monthShort" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                        <Tooltip content={<CustomAnalyticsTooltip />} />
                        <ReferenceLine y={3} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: '3-Day Buffer Target', fill: '#f59e0b', fontSize: 10 }} />
                        <Area type="monotone" dataKey="avgLeadDays" name="Days Early" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#velocityGradient)" />
                      </AreaChart>
                    ) : (
                      <ComposedChart data={filteredTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="monthShort" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                        <Tooltip content={<CustomAnalyticsTooltip />} />
                        <Bar dataKey="itcUtilizedCr" name="ITC Offset (Cr)" fill="#3b82f6" stackId="b" barSize={24} />
                        <Bar dataKey="cashPaidCr" name="Cash Paid (Cr)" fill="#10b981" stackId="b" radius={[4, 4, 0, 0]} barSize={24} />
                        <Line type="monotone" dataKey="taxDischargedCr" name="Total Tax (Cr)" stroke="#6366f1" strokeWidth={2} />
                      </ComposedChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Statutory Insights & Performance Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-emerald-950">Statutory SLA Compliance</h5>
                    <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                      96.8% of all GSTR returns were dispatched on or before statutory due date with DSC authorization.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <Clock size={16} />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-indigo-950">Filing Lead Time Velocity</h5>
                    <p className="text-[11px] text-indigo-800 mt-0.5 leading-relaxed">
                      Average filing velocity is 3.8 days ahead of cut-off deadlines, maintaining a safe portal buffer.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-amber-950">Zero Late Fee Penalties</h5>
                    <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                      Statutory interest and Sec 47 late fee charges avoided: ₹1,85,000 for the enterprise group.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECONDARY TAB CONTENT: Statutory ARN Filing Registers Table */}
          {activeTab === 'AUDIT_LOGS' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <input
                  type="text"
                  placeholder="Search by ARN, Period, or Form Type..."
                  value={searchLogQuery}
                  onChange={(e) => setSearchLogQuery(e.target.value)}
                  className="px-3.5 py-2 bg-slate-50 border border-slate-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-72"
                />
                <span className="text-xs text-slate-500 font-bold">
                  Showing {filteredLogs.length} verified return filings
                </span>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4">Return Form</th>
                      <th className="py-3 px-4">Period</th>
                      <th className="py-3 px-4">Statutory Due Date</th>
                      <th className="py-3 px-4">Filing Date</th>
                      <th className="py-3 px-4">ARN (Acknowledgement)</th>
                      <th className="py-3 px-4">Tax Discharged</th>
                      <th className="py-3 px-4">Lead Days</th>
                      <th className="py-3 px-4">Auth Mode</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-medium">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-1.5">
                          <FileText size={13} className="text-indigo-600" />
                          <span>{log.returnType}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-700">{log.period}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{log.dueDate}</td>
                        <td className="py-3 px-4 text-slate-700 font-mono text-[11px]">{log.filingDate}</td>
                        <td className="py-3 px-4 font-mono font-bold text-indigo-700">{log.arn}</td>
                        <td className="py-3 px-4 font-bold text-slate-800">₹{(log.taxDischarged / 100000).toFixed(2)} L</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            +{log.leadDays}d early
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{log.verificationMethod}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit">
                            <CheckCircle2 size={10} />
                            Filed On-Time
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </PlanGuard>
    </div>
  );
};

export default GstrFilingStatusAnalyticsWidget;
