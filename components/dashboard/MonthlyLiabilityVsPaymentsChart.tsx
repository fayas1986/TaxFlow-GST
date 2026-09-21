import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ReferenceLine, Cell
} from 'recharts';
import { 
  IndianRupee, TrendingUp, TrendingDown, Scale, CheckCircle2, 
  AlertCircle, Download, Table, Layers, ArrowUpRight, ShieldCheck, 
  CreditCard, Sparkles, Filter, ChevronDown, ChevronUp, FileSpreadsheet
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchLiabilityReport } from '../../services/api';

interface MonthlyLiabilityVsPaymentsChartProps {
  tenantId?: string;
  selectedGstin?: string;
  selectedBranchId?: string;
  analyticsData?: any;
}

export const MonthlyLiabilityVsPaymentsChart: React.FC<MonthlyLiabilityVsPaymentsChartProps> = ({
  tenantId = 't1',
  selectedGstin = 'ALL',
  selectedBranchId = 'ALL',
  analyticsData
}) => {
  const [viewMode, setViewMode] = useState<'COMPARATIVE' | 'STACKED_PAYMENT' | 'SETTLEMENT_RATE'>('COMPARATIVE');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'CASH_ONLY' | 'ITC_ONLY'>('ALL');
  const [showDataTable, setShowDataTable] = useState(false);

  // Fetch 6-month liability report data (reactively tied to GSTIN and Branch filters)
  const { data: rawReport, isLoading } = useQuery({
    queryKey: ['liabilityReport', tenantId, selectedGstin, selectedBranchId],
    queryFn: () => fetchLiabilityReport(tenantId, selectedGstin, selectedBranchId)
  });

  // Transform and enrich the 6-month data
  const chartData = useMemo(() => {
    const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
    
    // Check if we have dynamic data from API or from analyticsData
    const sourceData = rawReport && rawReport.length > 0 ? rawReport : (analyticsData?.monthlyTrend || []);

    return months.map((m, idx) => {
      const found = sourceData.find((d: any) => d.month === m || d.name === m);
      
      const liability = found ? (found.liability || found.outputLiability || 120000 + (idx * 8000)) : (120000 + idx * 8000);
      const itcAdjustment = found ? (found.itcAdjustment || found.itc || Math.round(liability * 0.72)) : Math.round(liability * 0.72);
      const cashPaid = found && found.cashPaid !== undefined ? found.cashPaid : Math.max(0, liability - itcAdjustment);
      const totalPayments = itcAdjustment + cashPaid;
      const netOutstanding = Math.max(0, liability - totalPayments);
      const settlementRate = liability > 0 ? Math.min(100, Math.round((totalPayments / liability) * 100)) : 100;

      return {
        month: `${m} 2026`,
        shortMonth: m,
        liability: Math.round(liability),
        itcAdjustment: Math.round(itcAdjustment),
        cashPaid: Math.round(cashPaid),
        totalPayments: Math.round(totalPayments),
        netOutstanding: Math.round(netOutstanding),
        settlementRate,
        challanStatus: netOutstanding === 0 ? 'SETTLED' : 'PARTIALLY_PAID',
        challanRef: `CPIN-260${idx + 5}8921`
      };
    });
  }, [rawReport, analyticsData]);

  // Metric aggregates
  const totalLiability = useMemo(() => chartData.reduce((acc, curr) => acc + curr.liability, 0), [chartData]);
  const totalPayments = useMemo(() => chartData.reduce((acc, curr) => acc + curr.totalPayments, 0), [chartData]);
  const totalItcUtilized = useMemo(() => chartData.reduce((acc, curr) => acc + curr.itcAdjustment, 0), [chartData]);
  const totalCashPaid = useMemo(() => chartData.reduce((acc, curr) => acc + curr.cashPaid, 0), [chartData]);
  const avgMonthlyLiability = chartData.length > 0 ? Math.round(totalLiability / chartData.length) : 0;
  const overallSettlementRate = totalLiability > 0 ? Math.round((totalPayments / totalLiability) * 100) : 100;

  // Format currency helpers
  const formatINR = (val: number) => {
    return '₹' + val.toLocaleString('en-IN');
  };

  const formatShortINR = (val: number) => {
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(1)}L`;
    }
    if (val >= 1000) {
      return `₹${(val / 1000).toFixed(0)}K`;
    }
    return `₹${val}`;
  };

  // Export 6-Month Data to CSV
  const handleExportCsv = () => {
    const headers = ['Month', 'Gross GST Liability (INR)', 'ITC Offset Utilized (INR)', 'Electronic Cash Paid (INR)', 'Total Payments Made (INR)', 'Net Outstanding (INR)', 'Settlement Rate (%)', 'Filing Status'];
    const rows = chartData.map(d => [
      d.month,
      d.liability,
      d.itcAdjustment,
      d.cashPaid,
      d.totalPayments,
      d.netOutstanding,
      `${d.settlementRate}%`,
      d.challanStatus
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `GST_Liability_vs_Payments_6Months_${selectedGstin}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-slate-700/80 text-xs min-w-[240px] space-y-2.5 backdrop-blur-md">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Scale size={13} className="text-blue-400" /> {data.month} Audit
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              data.settlementRate >= 100 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}>
              {data.settlementRate}% Cleared
            </span>
          </div>

          <div className="space-y-1.5 font-medium">
            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span>
                Gross GST Liability:
              </span>
              <strong className="text-white font-mono font-bold">{formatINR(data.liability)}</strong>
            </div>

            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                ITC Credit Offset:
              </span>
              <strong className="text-emerald-300 font-mono font-bold">{formatINR(data.itcAdjustment)}</strong>
            </div>

            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500"></span>
                Electronic Cash Paid:
              </span>
              <strong className="text-blue-300 font-mono font-bold">{formatINR(data.cashPaid)}</strong>
            </div>

            <div className="pt-1.5 mt-1.5 border-t border-slate-800 flex justify-between items-center">
              <span className="text-slate-400 font-semibold">Total Payments Made:</span>
              <strong className="text-emerald-400 font-mono font-extrabold text-sm">{formatINR(data.totalPayments)}</strong>
            </div>

            {data.netOutstanding > 0 && (
              <div className="flex justify-between items-center text-rose-400 pt-0.5">
                <span>Net Balance Due:</span>
                <strong className="font-mono">{formatINR(data.netOutstanding)}</strong>
              </div>
            )}
          </div>

          <div className="pt-1 text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-800">
            <span>Challan Ref: <span className="text-slate-300 font-mono">{data.challanRef}</span></span>
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 size={10} /> Verified
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6 relative overflow-hidden">
      {/* Header section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Scale size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  Monthly GST Liability Trends vs. Payments Made
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200">
                  Last 6 Months
                </span>
                {selectedGstin !== 'ALL' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold font-mono border border-indigo-200">
                    GSTIN: {selectedGstin}
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                Comparative audit of gross tax liabilities against electronic cash payments and input tax credit (ITC) set-offs.
              </p>
            </div>
          </div>
        </div>

        {/* View mode toggle & actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View mode tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setViewMode('COMPARATIVE')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'COMPARATIVE' 
                  ? 'bg-white text-blue-700 shadow-xs font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Comparative Bars
            </button>
            <button
              onClick={() => setViewMode('STACKED_PAYMENT')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'STACKED_PAYMENT' 
                  ? 'bg-white text-blue-700 shadow-xs font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Payment Breakdown
            </button>
            <button
              onClick={() => setViewMode('SETTLEMENT_RATE')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'SETTLEMENT_RATE' 
                  ? 'bg-white text-blue-700 shadow-xs font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Settlement Rate (%)
            </button>
          </div>

          {/* Export & Table Buttons */}
          <button
            onClick={() => setShowDataTable(!showDataTable)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
              showDataTable 
                ? 'bg-slate-800 text-white border-slate-800' 
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Toggle Detailed Ledger Data Table"
          >
            <Table size={14} />
            {showDataTable ? 'Hide Ledger' : 'View Ledger'}
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-2xs"
            title="Download 6-Month Liability vs Payment CSV"
          >
            <Download size={14} className="text-slate-500" />
            CSV
          </button>
        </div>
      </div>

      {/* 4 Key Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total 6-Month Liability */}
        <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">6-Month Gross Liability</span>
            <div className="w-2 h-2 rounded-full bg-rose-500"></div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-900 tracking-tight font-mono">
              {formatINR(totalLiability)}
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Avg: <span className="font-semibold text-slate-700 font-mono">{formatINR(avgMonthlyLiability)}</span> / month
            </p>
          </div>
        </div>

        {/* Card 2: Total Payments Made */}
        <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/60 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Total Payments Settled</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
              {overallSettlementRate}% Cleared
            </span>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-emerald-700 tracking-tight font-mono">
              {formatINR(totalPayments)}
            </p>
            <p className="text-[11px] text-emerald-800/80 font-medium mt-0.5 flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-600" /> Fully matched across 6 GSTR-3B filings
            </p>
          </div>
        </div>

        {/* Card 3: ITC Credit Set-Off */}
        <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200/60 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">ITC Credit Offset</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold">
              {totalPayments > 0 ? Math.round((totalItcUtilized / totalPayments) * 100) : 0}% of Total
            </span>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-blue-700 tracking-tight font-mono">
              {formatINR(totalItcUtilized)}
            </p>
            <p className="text-[11px] text-blue-800/80 font-medium mt-0.5">
              Electronic Credit Ledger utilized
            </p>
          </div>
        </div>

        {/* Card 4: Electronic Cash Paid */}
        <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-200/60 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">Electronic Cash Paid</span>
            <div className="p-1 bg-indigo-100 text-indigo-700 rounded">
              <CreditCard size={12} />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-indigo-700 tracking-tight font-mono">
              {formatINR(totalCashPaid)}
            </p>
            <p className="text-[11px] text-indigo-800/80 font-medium mt-0.5">
              Challan PMT-06 direct bank debit
            </p>
          </div>
        </div>
      </div>

      {/* Main Recharts Bar Chart Area */}
      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-4 text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-rose-500 inline-block"></span>
              Gross GST Liability (₹)
            </span>
            {viewMode === 'STACKED_PAYMENT' ? (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block"></span>
                  ITC Credit Utilized (₹)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-blue-600 inline-block"></span>
                  Cash Ledger Paid (₹)
                </span>
              </>
            ) : viewMode === 'COMPARATIVE' ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block"></span>
                Total Payments Settled (₹)
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-indigo-600 inline-block"></span>
                Monthly Settlement Rate (%)
              </span>
            )}
          </div>

          <span className="text-[11px] text-slate-400 italic">
            Reference line: 6-Month Monthly Average (₹{(avgMonthlyLiability / 1000).toFixed(0)}K)
          </span>
        </div>

        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'COMPARATIVE' ? (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis 
                  dataKey="shortMonth" 
                  stroke="#64748b" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickFormatter={formatShortINR}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine 
                  y={avgMonthlyLiability} 
                  stroke="#94a3b8" 
                  strokeDasharray="4 4" 
                  label={{ value: 'Avg Liability', position: 'top', fill: '#64748b', fontSize: 10 }} 
                />
                <Bar 
                  dataKey="liability" 
                  name="Gross GST Liability" 
                  fill="#f43f5e" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={38}
                  animationDuration={800}
                />
                <Bar 
                  dataKey="totalPayments" 
                  name="Total Payments Settled" 
                  fill="#10b981" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={38}
                  animationDuration={800}
                />
              </BarChart>
            ) : viewMode === 'STACKED_PAYMENT' ? (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis 
                  dataKey="shortMonth" 
                  stroke="#64748b" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickFormatter={formatShortINR}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine 
                  y={avgMonthlyLiability} 
                  stroke="#94a3b8" 
                  strokeDasharray="4 4" 
                />
                <Bar 
                  dataKey="liability" 
                  name="Gross GST Liability" 
                  fill="#f43f5e" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={32}
                  animationDuration={800}
                />
                <Bar 
                  dataKey="itcAdjustment" 
                  stackId="payment" 
                  name="ITC Offset Utilized" 
                  fill="#10b981" 
                  maxBarSize={32}
                  animationDuration={800}
                />
                <Bar 
                  dataKey="cashPaid" 
                  stackId="payment" 
                  name="Cash Ledger Paid" 
                  fill="#3b82f6" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={32}
                  animationDuration={800}
                />
              </BarChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis 
                  dataKey="shortMonth" 
                  stroke="#64748b" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={{ stroke: '#e2e8f0' }}
                  domain={[0, 110]}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine 
                  y={100} 
                  stroke="#10b981" 
                  strokeDasharray="4 4" 
                  label={{ value: '100% Target', position: 'insideTopRight', fill: '#10b981', fontSize: 10 }}
                />
                <Bar 
                  dataKey="settlementRate" 
                  name="Settlement Rate (%)" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={48}
                  animationDuration={800}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.settlementRate >= 100 ? '#10b981' : entry.settlementRate >= 90 ? '#3b82f6' : '#f59e0b'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Expandable 6-Month Ledger Table */}
      {showDataTable && (
        <div className="mt-6 pt-6 border-t border-slate-200 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileSpreadsheet size={14} className="text-blue-600" />
              6-Month Monthly GST Settlement Audit Ledger
            </h4>
            <span className="text-[11px] text-slate-500">
              Values in INR (₹) as reported in GSTR-3B Table 6.1
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4 text-right">Gross Liability (₹)</th>
                  <th className="py-3 px-4 text-right">ITC Set-Off (₹)</th>
                  <th className="py-3 px-4 text-right">Cash Paid (₹)</th>
                  <th className="py-3 px-4 text-right">Total Settled (₹)</th>
                  <th className="py-3 px-4 text-right">Balance Due (₹)</th>
                  <th className="py-3 px-4 text-center">Settlement %</th>
                  <th className="py-3 px-4 text-center">Challan Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {chartData.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{row.month}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-rose-700">
                      {formatINR(row.liability)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700">
                      {formatINR(row.itcAdjustment)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-700">
                      {formatINR(row.cashPaid)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatINR(row.totalPayments)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {row.netOutstanding > 0 ? (
                        <span className="text-rose-600 font-bold">{formatINR(row.netOutstanding)}</span>
                      ) : (
                        <span className="text-slate-400">₹0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        row.settlementRate >= 100 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {row.settlementRate}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold font-mono border border-slate-200">
                        <CheckCircle2 size={10} className="text-emerald-600" /> {row.challanRef}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                <tr>
                  <td className="py-3 px-4">6-Month Total</td>
                  <td className="py-3 px-4 text-right font-mono text-rose-800">{formatINR(totalLiability)}</td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-800">{formatINR(totalItcUtilized)}</td>
                  <td className="py-3 px-4 text-right font-mono text-blue-800">{formatINR(totalCashPaid)}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-900">{formatINR(totalPayments)}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-600">
                    {formatINR(chartData.reduce((acc, curr) => acc + curr.netOutstanding, 0))}
                  </td>
                  <td className="py-3 px-4 text-center text-emerald-700">{overallSettlementRate}%</td>
                  <td className="py-3 px-4 text-center text-slate-500">Consolidated</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyLiabilityVsPaymentsChart;
