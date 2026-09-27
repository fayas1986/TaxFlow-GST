import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ReferenceLine, 
  Cell 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Layers, 
  Scale, 
  IndianRupee, 
  ArrowRight, 
  FileText, 
  Download,
  FileDown,
  Loader2,
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Filter
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchLiabilityReport } from '../../services/api';
import { exportGstLiabilityReportToPdf } from '../../utils/exportGstLiabilityPdf';

export interface MonthlyGstLiabilityTrendsBarChartProps {
  tenantId?: string;
  selectedGstin?: string;
  selectedBranchId?: string;
  analyticsData?: any;
  isAggregate?: boolean;
  entityName?: string;
  onNavigateToReturns?: () => void;
  onNavigateToComputation?: () => void;
}

export type LiabilityBarViewMode = 'OVERVIEW_GROUPED' | 'TAX_HEADS_STACKED' | 'NET_CASH_FOCUS';

export const MonthlyGstLiabilityTrendsBarChart: React.FC<MonthlyGstLiabilityTrendsBarChartProps> = ({
  tenantId = 't1',
  selectedGstin = 'ALL',
  selectedBranchId = 'ALL',
  analyticsData,
  isAggregate = false,
  entityName,
  onNavigateToReturns,
  onNavigateToComputation
}) => {
  const [viewMode, setViewMode] = useState<LiabilityBarViewMode>('OVERVIEW_GROUPED');
  const [showBaselineAverage, setShowBaselineAverage] = useState<boolean>(true);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [pdfExportToast, setPdfExportToast] = useState<string | null>(null);

  // Fetch 6-month liability report data (reactively tied to tenant, GSTIN and Branch filters)
  const { data: rawReport, isLoading } = useQuery({
    queryKey: ['liabilityReport', tenantId, selectedGstin, selectedBranchId],
    queryFn: () => fetchLiabilityReport(tenantId, selectedGstin, selectedBranchId),
    enabled: !isAggregate
  });

  // Format currency helpers
  const formatINR = (val: number) => {
    return '₹' + Math.round(val).toLocaleString('en-IN');
  };

  const formatShortINR = (val: number) => {
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)}Cr`;
    }
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(1)}L`;
    }
    if (val >= 1000) {
      return `₹${(val / 1000).toFixed(0)}K`;
    }
    return `₹${val}`;
  };

  // Build and enrich the monthly trend dataset
  const monthlyData = useMemo(() => {
    const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
    const sourceData = rawReport && rawReport.length > 0 ? rawReport : (analyticsData?.monthlyTrend || []);

    const baseLiabilities = [185000, 210000, 245000, 230000, 280000, 315000];

    return months.map((m, idx) => {
      const found = sourceData.find((d: any) => d.month === m || d.name === m);
      
      const grossLiability = found 
        ? (found.outputLiability || found.liability || baseLiabilities[idx]) 
        : baseLiabilities[idx];

      const itcClaimed = found
        ? (found.itcAdjustment || found.itc || Math.round(grossLiability * 0.72))
        : Math.round(grossLiability * 0.72);

      const netCashPayable = Math.max(0, grossLiability - itcClaimed);
      const itcCoveragePct = grossLiability > 0 ? Math.min(100, Math.round((itcClaimed / grossLiability) * 100)) : 100;

      // Statutory tax head splits
      const igst = Math.round(grossLiability * 0.52);
      const cgst = Math.round(grossLiability * 0.24);
      const sgst = Math.round(grossLiability * 0.24);

      const prevGross = idx > 0 
        ? (sourceData[idx - 1]?.outputLiability || sourceData[idx - 1]?.liability || baseLiabilities[idx - 1]) 
        : baseLiabilities[0];
      const momGrowthRate = idx > 0 ? Number((((grossLiability - prevGross) / prevGross) * 100).toFixed(1)) : 0;

      return {
        month: `${m} 2026`,
        shortMonth: m,
        grossLiability: Math.round(grossLiability),
        itcClaimed: Math.round(itcClaimed),
        netCashPayable: Math.round(netCashPayable),
        itcCoveragePct,
        igst,
        cgst,
        sgst,
        momGrowthRate,
        isProjected: idx === months.length - 1
      };
    });
  }, [rawReport, analyticsData]);

  // Aggregate Key Performance Indicators (KPIs)
  const totalGrossLiability = useMemo(() => monthlyData.reduce((acc, curr) => acc + curr.grossLiability, 0), [monthlyData]);
  const totalItcClaimed = useMemo(() => monthlyData.reduce((acc, curr) => acc + curr.itcClaimed, 0), [monthlyData]);
  const totalNetCashPayable = useMemo(() => monthlyData.reduce((acc, curr) => acc + curr.netCashPayable, 0), [monthlyData]);
  const averageMonthlyLiability = useMemo(() => Math.round(totalGrossLiability / (monthlyData.length || 1)), [totalGrossLiability, monthlyData]);
  const overallItcCoverageRate = useMemo(() => totalGrossLiability > 0 ? Math.round((totalItcClaimed / totalGrossLiability) * 100) : 0, [totalGrossLiability, totalItcClaimed]);

  const latestMonth = monthlyData[monthlyData.length - 1];
  const previousMonth = monthlyData[monthlyData.length - 2];
  const latestMoMGrowth = previousMonth 
    ? (((latestMonth.grossLiability - previousMonth.grossLiability) / previousMonth.grossLiability) * 100).toFixed(1)
    : '0.0';

  // Find the selected or latest month for the interactive side inspection panel
  const activeInspectMonth = useMemo(() => {
    if (selectedMonthKey) {
      return monthlyData.find(d => d.month === selectedMonthKey) || latestMonth;
    }
    return latestMonth;
  }, [selectedMonthKey, monthlyData, latestMonth]);

  // Export dataset to CSV
  const handleExportCsv = () => {
    const headers = ['Month', 'Gross GST Liability (INR)', 'ITC Offset Utilized (INR)', 'Net Cash Payable (INR)', 'ITC Offset Ratio (%)', 'IGST (INR)', 'CGST (INR)', 'SGST (INR)', 'MoM Growth (%)'];
    const rows = monthlyData.map(d => [
      d.month,
      d.grossLiability,
      d.itcClaimed,
      d.netCashPayable,
      d.itcCoveragePct,
      d.igst,
      d.cgst,
      d.sgst,
      d.momGrowthRate
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GST_Liability_Trends_${isAggregate ? 'Group_Consolidated' : tenantId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export current GST liability visual report using html2canvas and jsPDF
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      setPdfExportToast('Capturing report canvas with html2canvas & generating PDF...');
      const fileName = await exportGstLiabilityReportToPdf({
        elementId: 'monthly-gst-liability-trends-bar-chart',
        reportTitle: 'Monthly GST Liability Trends & Performance Analytics',
        entityName: isAggregate ? (entityName || 'Consolidated Enterprise Group') : (entityName || `Entity ${tenantId}`),
        gstin: selectedGstin !== 'ALL' ? selectedGstin : (isAggregate ? 'Pan-India Multi-GSTIN' : '27AAAAA0000A1Z5'),
        period: latestMonth?.month || 'September 2026',
      });
      setPdfExportToast(`Exported: ${fileName}`);
      setTimeout(() => setPdfExportToast(null), 4500);
    } catch (err: any) {
      console.error('Failed to export liability report to PDF:', err);
      setPdfExportToast('Failed to export PDF. Please retry.');
      setTimeout(() => setPdfExportToast(null), 4000);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Custom Recharts Tooltip
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 text-slate-100 p-4 rounded-xl border border-slate-700 shadow-2xl backdrop-blur-md min-w-[240px] text-xs">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-2.5">
            <span className="font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-1.5">
              <BarChart3 size={13} className="text-blue-400" />
              {label}
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${data.momGrowthRate >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
              {data.momGrowthRate >= 0 ? `+${data.momGrowthRate}% MoM` : `${data.momGrowthRate}% MoM`}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Gross Output Liability:</span>
              <span className="font-mono font-bold text-amber-400 text-sm">
                {formatINR(data.grossLiability)}
              </span>
            </div>

            <div className="flex justify-between items-center text-indigo-300">
              <span className="text-slate-400">ITC Input Offset:</span>
              <span className="font-mono font-bold">
                {formatINR(data.itcClaimed)} ({data.itcCoveragePct}%)
              </span>
            </div>

            <div className="flex justify-between items-center text-emerald-300 border-t border-slate-800 pt-1.5 mt-1">
              <span className="text-slate-300 font-medium">Net Cash Outflow:</span>
              <span className="font-mono font-bold text-emerald-400">
                {formatINR(data.netCashPayable)}
              </span>
            </div>

            {viewMode === 'TAX_HEADS_STACKED' && (
              <div className="pt-2 mt-2 border-t border-slate-800 space-y-1 text-[11px] font-mono">
                <div className="flex justify-between text-indigo-300">
                  <span>IGST (52%):</span>
                  <span>{formatINR(data.igst)}</span>
                </div>
                <div className="flex justify-between text-blue-300">
                  <span>CGST (24%):</span>
                  <span>{formatINR(data.cgst)}</span>
                </div>
                <div className="flex justify-between text-sky-300">
                  <span>SGST (24%):</span>
                  <span>{formatINR(data.sgst)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="monthly-gst-liability-trends-bar-chart" className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
      {/* Header with Title and View Switcher */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
              <BarChart3 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Monthly GST Liability Trends
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  · {isAggregate ? (entityName || 'Consolidated Group') : (entityName || `Entity ${tenantId}`)}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-100 font-mono">
                  6-Month Performance
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Comparative Recharts bar visualization tracking gross tax liabilities, ITC absorption curves, and net cash outlays.
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented View Mode Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode('OVERVIEW_GROUPED')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'OVERVIEW_GROUPED'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Gross vs ITC vs Cash
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TAX_HEADS_STACKED')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'TAX_HEADS_STACKED'
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tax Heads (Stacked)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('NET_CASH_FOCUS')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'NET_CASH_FOCUS'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Net Cash Outflow
            </button>
          </div>

          {/* Average Baseline Toggle */}
          <button
            type="button"
            onClick={() => setShowBaselineAverage(!showBaselineAverage)}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              showBaselineAverage
                ? 'bg-slate-800 text-white border-slate-700 font-bold'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Scale size={13} />
            {showBaselineAverage ? '6-Mo Avg On' : '6-Mo Avg Off'}
          </button>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="p-1.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Export 6-Month Liability Trend to CSV"
          >
            <Download size={15} />
          </button>

          {/* Export PDF Button (using html2canvas + jsPDF) */}
          <button
            id="bar-chart-export-pdf-btn"
            type="button"
            disabled={isExportingPdf}
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Export Current GST Liability Report to PDF (html2canvas & jsPDF)"
          >
            {isExportingPdf ? (
              <Loader2 size={13} className="animate-spin text-blue-600" />
            ) : (
              <FileDown size={13} className="text-blue-600" />
            )}
            <span>{isExportingPdf ? 'Exporting PDF...' : 'Export PDF'}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
          <span className="text-[11px] font-semibold text-slate-500 block">
            6-Month Gross Liability
          </span>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1 tabular-nums">
            {formatINR(totalGrossLiability)}
          </div>
          <span className="text-xs text-slate-500 mt-0.5 block font-medium">
            Cumulated Outward Supply Tax
          </span>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
          <span className="text-[11px] font-semibold text-slate-500 block">
            Total ITC Absorption
          </span>
          <div className="text-xl font-bold text-indigo-700 font-mono mt-1 tabular-nums flex items-baseline gap-1.5">
            <span>{formatINR(totalItcClaimed)}</span>
            <span className="text-xs font-semibold text-indigo-600">({overallItcCoverageRate}%)</span>
          </div>
          <span className="text-xs text-slate-500 mt-0.5 block font-medium">
            Offset via Input Tax Credit
          </span>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
          <span className="text-[11px] font-semibold text-slate-500 block">
            Net Electronic Cash Paid
          </span>
          <div className="text-xl font-bold text-emerald-700 font-mono mt-1 tabular-nums">
            {formatINR(totalNetCashPayable)}
          </div>
          <span className="text-xs text-slate-500 mt-0.5 block font-medium">
            Challan Outflow via PMT-06 / 3B
          </span>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
          <span className="text-[11px] font-semibold text-slate-500 block">
            MoM Liability Velocity
          </span>
          <div className={`text-xl font-bold font-mono mt-1 flex items-center gap-1.5 tabular-nums ${Number(latestMoMGrowth) >= 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {Number(latestMoMGrowth) >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            <span>{Number(latestMoMGrowth) >= 0 ? `+${latestMoMGrowth}%` : `${latestMoMGrowth}%`}</span>
          </div>
          <span className="text-xs text-slate-500 mt-0.5 block font-medium">
            Latest vs Previous Period
          </span>
        </div>
      </div>

      {/* Main Bar Chart Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <div className="lg:col-span-3 h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'OVERVIEW_GROUPED' ? (
              <BarChart
                data={monthlyData}
                margin={{ top: 15, right: 20, left: 10, bottom: 5 }}
                onClick={(e) => {
                  if (e && e.activeLabel !== undefined && e.activeLabel !== null) {
                    setSelectedMonthKey(String(e.activeLabel));
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  tickFormatter={formatShortINR}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Legend 
                  verticalAlign="top" 
                  align="right" 
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: 12, fontSize: 12, fontWeight: 600 }}
                />
                
                {/* Gross Output Liability Bar */}
                <Bar 
                  dataKey="grossLiability" 
                  name="Gross Output Liability" 
                  fill="#f59e0b" 
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                >
                  {monthlyData.map((entry, index) => (
                    <Cell 
                      key={`gross-${index}`} 
                      fill={selectedMonthKey === entry.month ? '#d97706' : '#f59e0b'}
                    />
                  ))}
                </Bar>

                {/* ITC Input Credit Offset Bar */}
                <Bar 
                  dataKey="itcClaimed" 
                  name="ITC Offset Claimed" 
                  fill="#6366f1" 
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                >
                  {monthlyData.map((entry, index) => (
                    <Cell 
                      key={`itc-${index}`} 
                      fill={selectedMonthKey === entry.month ? '#4f46e5' : '#6366f1'}
                    />
                  ))}
                </Bar>

                {/* Net Cash Payable Bar */}
                <Bar 
                  dataKey="netCashPayable" 
                  name="Net Cash Payable" 
                  fill="#10b981" 
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                >
                  {monthlyData.map((entry, index) => (
                    <Cell 
                      key={`cash-${index}`} 
                      fill={selectedMonthKey === entry.month ? '#059669' : '#10b981'}
                    />
                  ))}
                </Bar>

                {/* 6-Month Baseline Average Reference Line */}
                {showBaselineAverage && (
                  <ReferenceLine 
                    y={averageMonthlyLiability} 
                    stroke="#64748b" 
                    strokeDasharray="4 4"
                    label={{ 
                      value: `Avg: ${formatShortINR(averageMonthlyLiability)}`, 
                      position: 'top', 
                      fill: '#64748b', 
                      fontSize: 11,
                      fontWeight: 600
                    }}
                  />
                )}
              </BarChart>
            ) : viewMode === 'TAX_HEADS_STACKED' ? (
              <BarChart
                data={monthlyData}
                margin={{ top: 15, right: 20, left: 10, bottom: 5 }}
                onClick={(e) => {
                  if (e && e.activeLabel !== undefined && e.activeLabel !== null) {
                    setSelectedMonthKey(String(e.activeLabel));
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  tickFormatter={formatShortINR}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Legend 
                  verticalAlign="top" 
                  align="right" 
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: 12, fontSize: 12, fontWeight: 600 }}
                />

                {/* Stacked Heads: IGST, CGST, SGST */}
                <Bar dataKey="igst" name="IGST (Inter-State)" stackId="a" fill="#6366f1" maxBarSize={38} />
                <Bar dataKey="cgst" name="CGST (Central)" stackId="a" fill="#0284c7" maxBarSize={38} />
                <Bar dataKey="sgst" name="SGST (State)" stackId="a" fill="#0d9488" radius={[4, 4, 0, 0]} maxBarSize={38} />

                {showBaselineAverage && (
                  <ReferenceLine 
                    y={averageMonthlyLiability} 
                    stroke="#64748b" 
                    strokeDasharray="4 4"
                    label={{ 
                      value: `Avg: ${formatShortINR(averageMonthlyLiability)}`, 
                      position: 'top', 
                      fill: '#64748b', 
                      fontSize: 11,
                      fontWeight: 600
                    }}
                  />
                )}
              </BarChart>
            ) : (
              <BarChart
                data={monthlyData}
                margin={{ top: 15, right: 20, left: 10, bottom: 5 }}
                onClick={(e) => {
                  if (e && e.activeLabel !== undefined && e.activeLabel !== null) {
                    setSelectedMonthKey(String(e.activeLabel));
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  tickFormatter={formatShortINR}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Legend 
                  verticalAlign="top" 
                  align="right" 
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: 12, fontSize: 12, fontWeight: 600 }}
                />

                <Bar 
                  dataKey="netCashPayable" 
                  name="Net Cash Ledger Liability" 
                  fill="#059669" 
                  radius={[6, 6, 0, 0]}
                  maxBarSize={44}
                >
                  {monthlyData.map((entry, index) => (
                    <Cell 
                      key={`cash-focus-${index}`} 
                      fill={selectedMonthKey === entry.month ? '#047857' : '#059669'}
                    />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Side Performance Inspector & Month Deep-Dive */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Period Inspection
              </span>
              <h4 className="text-sm font-bold text-slate-900 font-mono">
                {activeInspectMonth.month}
              </h4>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${activeInspectMonth.momGrowthRate >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
              {activeInspectMonth.momGrowthRate >= 0 ? `+${activeInspectMonth.momGrowthRate}%` : `${activeInspectMonth.momGrowthRate}%`}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Gross Output Tax:</span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {formatINR(activeInspectMonth.grossLiability)}
              </span>
            </div>

            <div className="flex justify-between items-center text-indigo-700">
              <span className="text-slate-600">ITC Absorbed:</span>
              <span className="font-mono font-bold tabular-nums">
                {formatINR(activeInspectMonth.itcClaimed)}
              </span>
            </div>

            <div className="flex justify-between items-center text-emerald-700 font-bold border-t border-slate-200 pt-1.5">
              <span>Cash Outflow:</span>
              <span className="font-mono tabular-nums">
                {formatINR(activeInspectMonth.netCashPayable)}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>ITC Utilization Ratio:</span>
                <span className="font-mono font-bold text-slate-800">{activeInspectMonth.itcCoveragePct}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${activeInspectMonth.itcCoveragePct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-1 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                if (onNavigateToComputation) onNavigateToComputation();
                else window.location.hash = '#/computation';
              }}
              className="w-full py-1.5 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Verify Computation</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Insights Footer */}
      <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-blue-950">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-blue-600 shrink-0" />
          <span>
            Input tax credits currently absorb <strong>{overallItcCoverageRate}%</strong> of aggregate gross output tax liabilities, maintaining average monthly electronic cash payments at <strong>{formatINR(totalNetCashPayable / 6)}</strong>.
          </span>
        </div>
        <button 
          type="button"
          onClick={() => {
            if (onNavigateToReturns) onNavigateToReturns();
            else window.location.hash = '#/filing';
          }}
          className="text-blue-900 font-bold underline hover:text-blue-700 text-xs shrink-0 flex items-center gap-1 cursor-pointer self-end sm:self-auto"
        >
          File GSTR-3B Return <ArrowRight size={12} />
        </button>
      </div>

      {/* PDF Export Status Toast Notification */}
      {pdfExportToast && (
        <div className="p-3 bg-slate-900 text-slate-100 rounded-xl border border-blue-500/40 text-xs flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span className="font-medium">{pdfExportToast}</span>
          </div>
          <button
            onClick={() => setPdfExportToast(null)}
            className="text-slate-400 hover:text-white text-xs underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};

export default MonthlyGstLiabilityTrendsBarChart;
