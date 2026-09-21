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
  Table2,
  BarChart3,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  IndianRupee,
  Layers,
  Building2,
  Calendar,
  Download,
  FileDown,
  Filter,
  CheckCircle2,
  Scale,
  Sparkles,
  Percent,
  Info,
  ArrowRight
} from 'lucide-react';
import { generateMonthlyGstrSummaryPdf } from '../../utils/pdfReportGenerator';

export interface MonthlyGstSummaryDataPoint {
  name: string;
  sales: number;
  purchase: number;
  liability: number;
  itc: number;
  outputLiability?: number;
  mismatches?: number;
  accuracy?: number;
}

interface MonthlyGstSummaryTableWithChartProps {
  data: MonthlyGstSummaryDataPoint[];
  timeRange?: string;
  isAggregate?: boolean;
  entityName?: string;
  gstin?: string;
}

type ChartMetricMode = 'TAX_LIABILITY_ITC' | 'SALES_PURCHASES' | 'ALL_METRICS' | 'NET_LIABILITY_ONLY';

export const MonthlyGstSummaryTableWithChart: React.FC<MonthlyGstSummaryTableWithChartProps> = ({
  data = [],
  timeRange = 'MONTHLY',
  isAggregate = false,
  entityName = 'Enterprise Organization',
  gstin
}) => {
  const [metricMode, setMetricMode] = useState<ChartMetricMode>('TAX_LIABILITY_ITC');
  const [hoveredPeriod, setHoveredPeriod] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState<'CHRONOLOGICAL' | 'SALES_DESC' | 'LIABILITY_DESC' | 'ITC_DESC'>('CHRONOLOGICAL');

  const isWeekly = timeRange === 'WEEKLY';
  const isQuarterly = timeRange === 'QUARTERLY';
  const periodTypeLabel = isWeekly ? 'Week' : isQuarterly ? 'Quarter' : 'Month';
  const varianceAcronym = isWeekly ? 'WoW' : isQuarterly ? 'QoQ' : 'MoM';

  // Process data with calculated ratios and period-over-period differences
  const processedData = useMemo(() => {
    return data.map((item, idx) => {
      const grossOutput = item.outputLiability ?? Math.round(item.sales * 0.18);
      const netLiability = item.liability ?? Math.max(0, grossOutput - item.itc);
      const itcCoverage = grossOutput > 0 ? Math.min(100, Math.round((item.itc / grossOutput) * 100)) : 0;
      const profitMargin = item.sales > 0 ? Math.round(((item.sales - item.purchase) / item.sales) * 100) : 0;

      const prevItem = idx > 0 ? data[idx - 1] : null;
      const prevSales = prevItem ? prevItem.sales : item.sales;
      const salesGrowth = prevItem && prevSales > 0 ? ((item.sales - prevSales) / prevSales) * 100 : 0;

      const prevLiability = prevItem ? prevItem.liability : item.liability;
      const liabilityChange = prevItem && prevLiability > 0 ? ((item.liability - prevLiability) / prevLiability) * 100 : 0;

      const prevItc = prevItem ? prevItem.itc : item.itc;
      const itcGrowth = prevItem && prevItc > 0 ? ((item.itc - prevItc) / prevItc) * 100 : 0;

      return {
        ...item,
        grossOutput,
        netLiability,
        itcCoverage,
        profitMargin,
        salesGrowth: parseFloat(salesGrowth.toFixed(1)),
        liabilityChange: parseFloat(liabilityChange.toFixed(1)),
        itcGrowth: parseFloat(itcGrowth.toFixed(1)),
        status: itcCoverage >= 70 ? 'Optimal' : itcCoverage >= 40 ? 'Balanced' : 'High Outflow'
      };
    });
  }, [data]);

  // Sort data for table display if requested, while preserving chart chronological order
  const tableDisplayData = useMemo(() => {
    const list = [...processedData];
    if (selectedSort === 'SALES_DESC') {
      return list.sort((a, b) => b.sales - a.sales);
    }
    if (selectedSort === 'LIABILITY_DESC') {
      return list.sort((a, b) => b.netLiability - a.netLiability);
    }
    if (selectedSort === 'ITC_DESC') {
      return list.sort((a, b) => b.itc - a.itc);
    }
    return list; // Chronological default
  }, [processedData, selectedSort]);

  // Aggregate totals across all monitored periods
  const totalSales = processedData.reduce((acc, curr) => acc + (curr.sales || 0), 0);
  const totalPurchases = processedData.reduce((acc, curr) => acc + (curr.purchase || 0), 0);
  const totalGrossOutput = processedData.reduce((acc, curr) => acc + (curr.grossOutput || 0), 0);
  const totalItc = processedData.reduce((acc, curr) => acc + (curr.itc || 0), 0);
  const totalNetLiability = processedData.reduce((acc, curr) => acc + (curr.netLiability || 0), 0);
  const avgPeriodLiability = processedData.length > 0 ? Math.round(totalNetLiability / processedData.length) : 0;
  const avgPeriodSales = processedData.length > 0 ? Math.round(totalSales / processedData.length) : 0;
  const aggregateItcCoverage = totalGrossOutput > 0 ? Math.round((totalItc / totalGrossOutput) * 100) : 0;

  // Key period milestones
  const peakSalesPeriod = [...processedData].sort((a, b) => b.sales - a.sales)[0];
  const peakLiabilityPeriod = [...processedData].sort((a, b) => b.netLiability - a.netLiability)[0];
  const mostEfficientPeriod = [...processedData].sort((a, b) => b.itcCoverage - a.itcCoverage)[0];

  // Helper function to export table as CSV
  const handleExportCsv = () => {
    const headers = ['Tax Period', 'Total Sales (₹)', 'Purchases (₹)', 'Gross Output Tax (₹)', 'Eligible ITC (₹)', 'Net Liability (₹)', 'ITC Coverage (%)', `${varianceAcronym} Liability Change (%)`, 'Status'];
    const rows = processedData.map(d => [
      d.name,
      d.sales,
      d.purchase,
      d.grossOutput,
      d.itc,
      d.netLiability,
      `${d.itcCoverage}%`,
      `${d.liabilityChange}%`,
      d.status
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Monthly_GST_Summary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper function to export table as official Monthly GSTR Summary PDF
  const handleExportPdf = () => {
    generateMonthlyGstrSummaryPdf({
      period: isWeekly ? 'Weekly Reconciliation' : isQuarterly ? 'Quarterly Summary FY 2026-27' : 'September 2026',
      entityName: entityName,
      gstin: gstin,
      isAggregate: isAggregate,
      trendData: processedData,
    });
  };

  // Custom polished Tooltip for the Recharts Bar Chart
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0]?.payload;
      if (!dataPoint) return null;

      const isLiabilityUp = dataPoint.liabilityChange > 0;
      const isSalesUp = dataPoint.salesGrowth > 0;

      return (
        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700/80 text-xs min-w-[260px] space-y-3 backdrop-blur-md z-50">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-blue-400" />
              <span className="font-extrabold text-slate-200 text-sm tracking-tight">{label} Summary</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-bold">
              {dataPoint.status}
            </span>
          </div>

          <div className="space-y-2 font-medium">
            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500"></span>
                Total Sales:
              </span>
              <span className="font-mono font-bold text-white">₹{dataPoint.sales.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-teal-500"></span>
                Inward Purchases:
              </span>
              <span className="font-mono font-bold text-teal-300">₹{dataPoint.purchase.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-400"></span>
                Gross Output Tax:
              </span>
              <span className="font-mono font-bold text-indigo-300">₹{dataPoint.grossOutput.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                Eligible ITC Offset:
              </span>
              <span className="font-mono font-bold text-emerald-400">₹{dataPoint.itc.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between items-center text-amber-300 pt-1.5 border-t border-slate-800 font-bold">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span>
                Net Tax Liability:
              </span>
              <span className="font-mono text-amber-400 text-sm">₹{dataPoint.netLiability.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-1.5 bg-slate-800/80 rounded-lg">
              <span className="text-slate-400 block text-[9px] uppercase font-bold">ITC Offset Ratio</span>
              <span className="font-mono font-bold text-emerald-400">{dataPoint.itcCoverage}%</span>
            </div>
            <div className="p-1.5 bg-slate-800/80 rounded-lg">
              <span className="text-slate-400 block text-[9px] uppercase font-bold">{varianceAcronym} Liability</span>
              <span className={`font-mono font-bold flex items-center gap-0.5 ${isLiabilityUp ? 'text-rose-400' : 'text-emerald-400'}`}>
                {isLiabilityUp ? '+' : ''}{dataPoint.liabilityChange}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="monthly-gst-summary-section" className="bg-white rounded-2xl p-6 md:p-8 shadow-xs border border-slate-200 space-y-8">
      {/* 1. SECTION HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-xl border border-blue-200 shadow-xs flex items-center justify-center shrink-0">
            <Table2 size={20} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                {periodTypeLabel}ly GST Summary
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isAggregate
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                {isAggregate ? 'Consolidated Multi-Entity Rollup' : entityName}
              </span>
              {gstin && !isAggregate && (
                <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {gstin}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Detailed statutory ledger table and comparative multi-period visualization of sales, purchases, ITC offsets, and net tax liabilities.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Table Sort Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
            <Filter size={13} className="ml-2 text-slate-400" />
            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value as any)}
              className="bg-transparent text-slate-800 text-xs font-bold focus:outline-none pr-2 cursor-pointer py-1"
            >
              <option value="CHRONOLOGICAL">Sort: Chronological</option>
              <option value="SALES_DESC">Sort: Highest Sales</option>
              <option value="LIABILITY_DESC">Sort: Highest Liability</option>
              <option value="ITC_DESC">Sort: Highest ITC</option>
            </select>
          </div>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
            title="Export Monthly GST Summary Table as CSV"
          >
            <Download size={14} className="text-blue-600" />
            <span>Export CSV</span>
          </button>

          <button
            id="monthly-gst-summary-download-pdf-btn"
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
            title="Download Monthly GSTR Summary Report as PDF"
          >
            <FileDown size={14} />
            <span>Download Report (PDF)</span>
          </button>
        </div>
      </div>

      {/* 2. THE SUMMARY TABLE */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Sparkles size={14} className="text-amber-500" />
            <span>Tax Period Ledger & Compliance Metrics</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Showing {processedData.length} monitored tax periods ({timeRange.toLowerCase()} cadence)
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Tax Period</th>
                <th className="py-3 px-4 text-right">Gross Sales (₹)</th>
                <th className="py-3 px-4 text-right">Inward Purchases (₹)</th>
                <th className="py-3 px-4 text-right">Gross Output Tax (₹)</th>
                <th className="py-3 px-4 text-right text-emerald-700">Eligible ITC (₹)</th>
                <th className="py-3 px-4 text-right text-amber-700">Net Liability (₹)</th>
                <th className="py-3 px-4 text-center">ITC Coverage</th>
                <th className="py-3 px-4 text-center">{varianceAcronym} Liability Δ</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {tableDisplayData.map((row, idx) => {
                const isHovered = hoveredPeriod === row.name;
                const isIncrease = row.liabilityChange > 0;
                const isZero = row.liabilityChange === 0;

                return (
                  <tr
                    key={idx}
                    onMouseEnter={() => setHoveredPeriod(row.name)}
                    onMouseLeave={() => setHoveredPeriod(null)}
                    className={`transition-colors cursor-pointer ${
                      isHovered ? 'bg-blue-50/70' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Tax Period */}
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          isHovered ? 'bg-blue-600 ring-2 ring-blue-200' : 'bg-slate-300'
                        }`} />
                        <span>{row.name}</span>
                      </div>
                    </td>

                    {/* Gross Sales */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      ₹{row.sales.toLocaleString('en-IN')}
                    </td>

                    {/* Purchases */}
                    <td className="py-3.5 px-4 text-right font-mono text-slate-700 font-medium">
                      ₹{row.purchase.toLocaleString('en-IN')}
                    </td>

                    {/* Gross Output Tax */}
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-indigo-700">
                      ₹{row.grossOutput.toLocaleString('en-IN')}
                    </td>

                    {/* Eligible ITC */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30">
                      ₹{row.itc.toLocaleString('en-IN')}
                    </td>

                    {/* Net Tax Liability */}
                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-amber-700 bg-amber-50/30">
                      ₹{row.netLiability.toLocaleString('en-IN')}
                    </td>

                    {/* ITC Coverage Ratio */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                          <div
                            className={`h-full rounded-full ${
                              row.itcCoverage >= 70 ? 'bg-emerald-500' : row.itcCoverage >= 40 ? 'bg-blue-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, row.itcCoverage)}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-[11px] text-slate-700">{row.itcCoverage}%</span>
                      </div>
                    </td>

                    {/* Period-over-Period Liability Change */}
                    <td className="py-3.5 px-4 text-center">
                      {row.liabilityChange !== 0 ? (
                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isIncrease
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {isIncrease ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                          {isIncrease ? `+${row.liabilityChange}%` : `${row.liabilityChange}%`}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[10px]">Baseline</span>
                      )}
                    </td>

                    {/* Compliance Status Badge */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        row.status === 'Optimal'
                          ? 'bg-emerald-100 text-emerald-800'
                          : row.status === 'Balanced'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Total / Aggregate Summary Footer */}
            <tfoot>
              <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-950 text-[11px]">
                <td className="py-3.5 px-4 font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={14} className="text-blue-400" />
                  <span>Consolidated Total</span>
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-black text-blue-300">
                  ₹{totalSales.toLocaleString('en-IN')}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                  ₹{totalPurchases.toLocaleString('en-IN')}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-indigo-300">
                  ₹{totalGrossOutput.toLocaleString('en-IN')}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-emerald-300 font-black">
                  ₹{totalItc.toLocaleString('en-IN')}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-amber-300 font-black text-xs">
                  ₹{totalNetLiability.toLocaleString('en-IN')}
                </td>
                <td className="py-3.5 px-4 text-center font-mono text-emerald-400">
                  {aggregateItcCoverage}% Avg
                </td>
                <td className="py-3.5 px-4 text-center text-slate-400 text-[10px]">
                  Avg ₹{avgPeriodLiability.toLocaleString('en-IN')}
                </td>
                <td className="py-3.5 px-4 text-center">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] uppercase font-bold">
                    Reconciled
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 3. RECHARTS BAR CHART COMPONENT DIRECTLY BELOW THE SUMMARY TABLE */}
      <div className="space-y-4 pt-4 border-t border-slate-200/80">
        {/* Chart Header & Comparison Mode Selectors */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs shrink-0">
              <BarChart3 size={18} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                Comparative {periodTypeLabel}-by-{periodTypeLabel} Bar Chart
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 uppercase">
                  Recharts Visualizer
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Side-by-side comparison across tax periods to identify seasonal peaks, credit surpluses, and net tax outflows.
              </p>
            </div>
          </div>

          {/* Metric Comparison Mode Selector */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200/80 shadow-xs flex-wrap">
            {[
              { id: 'TAX_LIABILITY_ITC', label: 'Liability vs. ITC Offset' },
              { id: 'SALES_PURCHASES', label: 'Sales vs. Purchases' },
              { id: 'ALL_METRICS', label: 'All Metrics Grouped' },
              { id: 'NET_LIABILITY_ONLY', label: 'Net Payable Outflow' }
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setMetricMode(mode.id as ChartMetricMode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  metricMode === mode.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recharts Bar Chart Canvas */}
        <div className="h-80 sm:h-96 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={processedData}
              margin={{ top: 20, right: 20, left: 10, bottom: 5 }}
            >
              <defs>
                {/* Sales Gradient */}
                <linearGradient id="barGradSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.8} />
                </linearGradient>
                {/* Purchase Gradient */}
                <linearGradient id="barGradPurchase" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity={0.8} />
                </linearGradient>
                {/* Gross Output Gradient */}
                <linearGradient id="barGradGrossOutput" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#4338ca" stopOpacity={0.8} />
                </linearGradient>
                {/* ITC Credit Gradient */}
                <linearGradient id="barGradItc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#047857" stopOpacity={0.8} />
                </linearGradient>
                {/* Net Liability Gradient */}
                <linearGradient id="barGradNetLiability" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#b45309" stopOpacity={0.85} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={(val) => {
                  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
                  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
                  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
                  return `₹${val}`;
                }}
              />
              <Tooltip content={<CustomBarTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Legend
                wrapperStyle={{ paddingTop: '16px' }}
                iconType="circle"
                formatter={(value) => <span className="text-xs font-bold text-slate-700">{value}</span>}
              />

              {/* Benchmark Reference Lines */}
              {metricMode === 'NET_LIABILITY_ONLY' && (
                <ReferenceLine
                  y={avgPeriodLiability}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{
                    value: `Avg Liability: ₹${avgPeriodLiability.toLocaleString('en-IN')}`,
                    fill: '#b45309',
                    fontSize: 11,
                    position: 'insideTopRight',
                    fontWeight: 700
                  }}
                />
              )}

              {metricMode === 'SALES_PURCHASES' && (
                <ReferenceLine
                  y={avgPeriodSales}
                  stroke="#3b82f6"
                  strokeDasharray="4 4"
                  label={{
                    value: `Avg Sales: ₹${avgPeriodSales.toLocaleString('en-IN')}`,
                    fill: '#1d4ed8',
                    fontSize: 11,
                    position: 'insideTopRight',
                    fontWeight: 700
                  }}
                />
              )}

              {/* RENDER BARS ACCORDING TO SELECTED METRIC MODE */}
              {metricMode === 'TAX_LIABILITY_ITC' && (
                <>
                  <Bar
                    dataKey="grossOutput"
                    name="Gross Output Tax"
                    fill="url(#barGradGrossOutput)"
                    radius={[6, 6, 0, 0]}
                    barSize={20}
                  />
                  <Bar
                    dataKey="itc"
                    name="Eligible ITC Offset"
                    fill="url(#barGradItc)"
                    radius={[6, 6, 0, 0]}
                    barSize={20}
                  />
                  <Bar
                    dataKey="netLiability"
                    name="Net Tax Liability"
                    fill="url(#barGradNetLiability)"
                    radius={[6, 6, 0, 0]}
                    barSize={20}
                  />
                </>
              )}

              {metricMode === 'SALES_PURCHASES' && (
                <>
                  <Bar
                    dataKey="sales"
                    name="Gross Sales (Outward)"
                    fill="url(#barGradSales)"
                    radius={[6, 6, 0, 0]}
                    barSize={24}
                  />
                  <Bar
                    dataKey="purchase"
                    name="Inward Purchases"
                    fill="url(#barGradPurchase)"
                    radius={[6, 6, 0, 0]}
                    barSize={24}
                  />
                </>
              )}

              {metricMode === 'ALL_METRICS' && (
                <>
                  <Bar
                    dataKey="sales"
                    name="Sales"
                    fill="url(#barGradSales)"
                    radius={[4, 4, 0, 0]}
                    barSize={14}
                  />
                  <Bar
                    dataKey="purchase"
                    name="Purchases"
                    fill="url(#barGradPurchase)"
                    radius={[4, 4, 0, 0]}
                    barSize={14}
                  />
                  <Bar
                    dataKey="itc"
                    name="ITC Offset"
                    fill="url(#barGradItc)"
                    radius={[4, 4, 0, 0]}
                    barSize={14}
                  />
                  <Bar
                    dataKey="netLiability"
                    name="Net Liability"
                    fill="url(#barGradNetLiability)"
                    radius={[4, 4, 0, 0]}
                    barSize={14}
                  />
                </>
              )}

              {metricMode === 'NET_LIABILITY_ONLY' && (
                <Bar
                  dataKey="netLiability"
                  name="Net Tax Liability Payable"
                  fill="url(#barGradNetLiability)"
                  radius={[8, 8, 0, 0]}
                  barSize={36}
                >
                  {processedData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        hoveredPeriod === entry.name
                          ? '#d97706'
                          : entry.netLiability > avgPeriodLiability
                          ? '#f59e0b'
                          : '#fbbf24'
                      }
                    />
                  ))}
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 4. PERIOD-OVER-PERIOD COMPARISON INSIGHT STRIP */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Peak Sales Period */}
          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/70 flex items-center justify-between hover:border-slate-300 transition-colors">
            <div>
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                Peak Sales {periodTypeLabel}
              </span>
              <span className="text-sm font-extrabold text-slate-900 font-mono">
                {peakSalesPeriod?.name || 'N/A'} (₹{(peakSalesPeriod?.sales || 0).toLocaleString('en-IN')})
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shadow-xs shrink-0">
              <TrendingUp size={18} />
            </div>
          </div>

          {/* Peak ITC Offset Efficiency */}
          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/70 flex items-center justify-between hover:border-slate-300 transition-colors">
            <div>
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                Peak ITC Offset Efficiency
              </span>
              <span className="text-sm font-extrabold text-emerald-900 font-mono">
                {mostEfficientPeriod?.name || 'N/A'} ({mostEfficientPeriod?.itcCoverage || 0}% coverage)
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shadow-xs shrink-0">
              <CheckCircle2 size={18} />
            </div>
          </div>

          {/* Peak Tax Outflow Period */}
          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/70 flex items-center justify-between hover:border-slate-300 transition-colors">
            <div>
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                Highest Net Liability
              </span>
              <span className="text-sm font-extrabold text-amber-950 font-mono">
                {peakLiabilityPeriod?.name || 'N/A'} (₹{(peakLiabilityPeriod?.netLiability || 0).toLocaleString('en-IN')})
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shadow-xs shrink-0">
              <Scale size={18} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyGstSummaryTableWithChart;
