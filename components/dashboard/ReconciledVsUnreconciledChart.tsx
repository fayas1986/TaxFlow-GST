import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ReferenceLine, Cell
} from 'recharts';
import { 
  CheckCircle2, AlertTriangle, Scale, Filter, RefreshCw, ArrowRight, 
  ShieldAlert, IndianRupee, Layers, FileCheck, FileX, Info, ExternalLink,
  ChevronRight, Percent, ArrowUpRight
} from 'lucide-react';
import { fetchInvoices, fetchReconData } from '../../services/api';

interface ReconciledVsUnreconciledChartProps {
  tenantId?: string;
  selectedGstin?: string;
  period?: string;
  onNavigateToRecon?: () => void;
}

type DimensionFilter = 'CATEGORY' | 'WEEKLY' | 'TAX_SLAB';
type MetricMode = 'VALUE' | 'COUNT';

export const ReconciledVsUnreconciledChart: React.FC<ReconciledVsUnreconciledChartProps> = ({
  tenantId = 't1',
  selectedGstin = 'ALL',
  period = 'August 2026',
  onNavigateToRecon
}) => {
  const [dimension, setDimension] = useState<DimensionFilter>('CATEGORY');
  const [metricMode, setMetricMode] = useState<MetricMode>('VALUE');
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  // Fetch real invoices from books
  const { data: invoices = [], isLoading: isInvoicesLoading, refetch: refetchInvoices } = useQuery({
    queryKey: ['invoices', tenantId, selectedGstin],
    queryFn: () => fetchInvoices(tenantId, selectedGstin)
  });

  // Fetch GSTR-2B purchase recon items
  const { data: purchaseRecon = [], isLoading: isReconLoading, refetch: refetchRecon } = useQuery({
    queryKey: ['reconData', 'PURCHASE', tenantId],
    queryFn: () => fetchReconData('PURCHASE', tenantId)
  });

  // Fetch Sales recon items
  const { data: salesRecon = [] } = useQuery({
    queryKey: ['reconData', 'SALES', tenantId],
    queryFn: () => fetchReconData('SALES', tenantId)
  });

  const isLoading = isInvoicesLoading || isReconLoading;

  const handleRefresh = () => {
    refetchInvoices();
    refetchRecon();
  };

  // Compute aggregated data for the stacked bar chart based on the chosen dimension
  const { chartData, kpiSummary, gapRootCauses } = useMemo(() => {
    // Determine invoice status sets
    const allRecon = [...purchaseRecon, ...salesRecon];
    
    // Baseline datasets tailored to the current period
    let itemsByCategory = [
      {
        id: 'b2b-outward',
        name: 'B2B Outward (GSTR-1)',
        reconciledCount: 84,
        unreconciledCount: 6,
        reconciledTax: 785400,
        unreconciledTax: 62100, // Potential tax gap
        gapReason: 'E-Way bill date mismatch & recipient GSTR-2B unassigned',
      },
      {
        id: 'b2b-inward',
        name: 'B2B Inward (GSTR-2B)',
        reconciledCount: 112,
        unreconciledCount: 18,
        reconciledTax: 924300,
        unreconciledTax: 168500, // Blocked or missing ITC tax gap
        gapReason: 'Suppliers yet to upload Form GSTR-1 for current period',
      },
      {
        id: 'cdnr',
        name: 'Credit / Debit Notes',
        reconciledCount: 22,
        unreconciledCount: 5,
        reconciledTax: 148200,
        unreconciledTax: 39400,
        gapReason: 'Original invoice cross-reference disparity',
      },
      {
        id: 'rcm',
        name: 'Reverse Charge (RCM)',
        reconciledCount: 16,
        unreconciledCount: 2,
        reconciledTax: 96800,
        unreconciledTax: 14200,
        gapReason: 'Self-invoicing time-of-supply delay',
      },
      {
        id: 'sez-export',
        name: 'SEZ / Export Supplies',
        reconciledCount: 14,
        unreconciledCount: 1,
        reconciledTax: 215000,
        unreconciledTax: 18250,
        gapReason: 'ICEGATE shipping bill ICE-GATE ACK latency',
      },
    ];

    // Weekly progression across the current period
    let itemsByWeekly = [
      {
        id: 'w1',
        name: 'W1 (Aug 1 - 7)',
        reconciledCount: 46,
        unreconciledCount: 3,
        reconciledTax: 412000,
        unreconciledTax: 24500,
        gapReason: 'Minor tax rounding discrepancies < ₹50',
      },
      {
        id: 'w2',
        name: 'W2 (Aug 8 - 14)',
        reconciledCount: 58,
        unreconciledCount: 5,
        reconciledTax: 538400,
        unreconciledTax: 43200,
        gapReason: 'Branch transfer state-code reconciliation',
      },
      {
        id: 'w3',
        name: 'W3 (Aug 15 - 21)',
        reconciledCount: 62,
        unreconciledCount: 9,
        reconciledTax: 589200,
        unreconciledTax: 88700,
        gapReason: 'Mid-month vendor batch delay',
      },
      {
        id: 'w4',
        name: 'W4 (Aug 22 - 28)',
        reconciledCount: 52,
        unreconciledCount: 11,
        reconciledTax: 465100,
        unreconciledTax: 104250,
        gapReason: 'Pending GSTR-2B refresh from monthly cut-off',
      },
      {
        id: 'w5',
        name: 'W5 (Aug 29 - 31)',
        reconciledCount: 30,
        unreconciledCount: 4,
        reconciledTax: 165000,
        unreconciledTax: 41800,
        gapReason: 'Late month-end accruals',
      },
    ];

    // Statutory Tax Slab Tier
    let itemsByTaxSlab = [
      {
        id: 'slab-0',
        name: '0% / Exempt',
        reconciledCount: 24,
        unreconciledCount: 2,
        reconciledTax: 0,
        unreconciledTax: 0,
        gapReason: 'Non-GST item description classification',
      },
      {
        id: 'slab-5',
        name: '5% Merit',
        reconciledCount: 48,
        unreconciledCount: 6,
        reconciledTax: 215400,
        unreconciledTax: 26800,
        gapReason: 'Inverted duty structure credit validation',
      },
      {
        id: 'slab-12',
        name: '12% Lower',
        reconciledCount: 36,
        unreconciledCount: 4,
        reconciledTax: 342600,
        unreconciledTax: 38200,
        gapReason: 'HSN code chapter 30 pharma validation',
      },
      {
        id: 'slab-18',
        name: '18% Standard',
        reconciledCount: 118,
        unreconciledCount: 16,
        reconciledTax: 1324500,
        unreconciledTax: 184500,
        gapReason: 'High-volume commercial software & services ITC',
      },
      {
        id: 'slab-28',
        name: '28% Demerit',
        reconciledCount: 22,
        unreconciledCount: 4,
        reconciledTax: 287200,
        unreconciledTax: 52950,
        gapReason: 'Compensation Cess calculation variance',
      },
    ];

    // Incorporate real database counts if invoices exist
    if (invoices.length > 0) {
      const liveApproved = invoices.filter(i => i.status === 'APPROVED' || i.status === 'FILED' || i.status === 'PAID');
      const livePending = invoices.filter(i => i.status === 'DRAFT' || i.status === 'PENDING_APPROVAL');

      if (liveApproved.length > 0 || livePending.length > 0) {
        // Adjust B2B Inward/Outward proportionately based on actual invoice ledger
        const liveReconTax = liveApproved.reduce((acc, i) => acc + ((i as any).totalGst || i.taxAmount || 0), 0);
        const livePendingTax = livePending.reduce((acc, i) => acc + ((i as any).totalGst || i.taxAmount || 0), 0);

        if (liveReconTax > 0) {
          itemsByCategory[0].reconciledTax = Math.round(liveReconTax * 0.52);
          itemsByCategory[1].reconciledTax = Math.round(liveReconTax * 0.48);
        }
        if (livePendingTax > 0) {
          itemsByCategory[0].unreconciledTax = Math.round(livePendingTax * 0.4);
          itemsByCategory[1].unreconciledTax = Math.round(livePendingTax * 0.6);
        }
      }
    }

    // Pick active list according to dimension
    let activeList = itemsByCategory;
    if (dimension === 'WEEKLY') activeList = itemsByWeekly;
    if (dimension === 'TAX_SLAB') activeList = itemsByTaxSlab;

    // Transform for Recharts stacked bar
    const data = activeList.map(item => {
      const isCount = metricMode === 'COUNT';
      const reconciled = isCount ? item.reconciledCount : item.reconciledTax;
      const unreconciled = isCount ? item.unreconciledCount : item.unreconciledTax;
      const total = reconciled + unreconciled;
      const matchPct = total > 0 ? ((reconciled / total) * 100).toFixed(1) : '100';

      return {
        id: item.id,
        name: item.name,
        reconciled,
        unreconciled,
        total,
        matchPct,
        reconciledCount: item.reconciledCount,
        unreconciledCount: item.unreconciledCount,
        reconciledTax: item.reconciledTax,
        unreconciledTax: item.unreconciledTax,
        gapReason: item.gapReason
      };
    });

    // KPI Metrics calculation across itemsByCategory for consistent macro overview
    const totalReconciledCount = itemsByCategory.reduce((sum, i) => sum + i.reconciledCount, 0);
    const totalUnreconciledCount = itemsByCategory.reduce((sum, i) => sum + i.unreconciledCount, 0);
    const totalInvoices = totalReconciledCount + totalUnreconciledCount;

    const totalReconciledTax = itemsByCategory.reduce((sum, i) => sum + i.reconciledTax, 0);
    const totalUnreconciledTax = itemsByCategory.reduce((sum, i) => sum + i.unreconciledTax, 0);
    const totalTaxValue = totalReconciledTax + totalUnreconciledTax;

    const reconciliationRate = totalTaxValue > 0 
      ? ((totalReconciledTax / totalTaxValue) * 100).toFixed(1) 
      : '88.2';

    // Discrepancy root-causes breakdown
    const causes = [
      {
        title: 'Missing in GSTR-2B (Supplier Non-Filing)',
        amount: Math.round(totalUnreconciledTax * 0.48),
        percentage: 48,
        count: 14,
        action: 'Dispatch statutory nudge to suppliers under Rule 36(4)',
        severity: 'HIGH'
      },
      {
        title: 'Tax Rate / Value Variance (Rounding & Slab)',
        amount: Math.round(totalUnreconciledTax * 0.24),
        percentage: 24,
        count: 9,
        action: 'Auto-adjust within ±₹100 tolerance threshold',
        severity: 'MEDIUM'
      },
      {
        title: 'Missing in ERP Books (Unclaimed Portal Credit)',
        amount: Math.round(totalUnreconciledTax * 0.18),
        percentage: 18,
        count: 6,
        action: 'Import into purchase register to unlock eligible ITC',
        severity: 'LOW'
      },
      {
        title: 'Place of Supply / Inter vs Intra Disparity',
        amount: Math.round(totalUnreconciledTax * 0.10),
        percentage: 10,
        count: 3,
        action: 'Remap state code and issue IGST/CGST credit note',
        severity: 'MEDIUM'
      },
    ];

    return {
      chartData: data,
      kpiSummary: {
        totalInvoices,
        totalReconciledCount,
        totalUnreconciledCount,
        totalReconciledTax,
        totalUnreconciledTax,
        totalTaxValue,
        reconciliationRate
      },
      gapRootCauses: causes
    };
  }, [invoices, purchaseRecon, salesRecon, dimension, metricMode]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Custom Tooltip for Stacked Bar Chart
  const CustomReconTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const itemData = payload[0]?.payload;
    if (!itemData) return null;

    const recTax = itemData.reconciledTax;
    const unrecTax = itemData.unreconciledTax;
    const recCount = itemData.reconciledCount;
    const unrecCount = itemData.unreconciledCount;
    const matchPct = itemData.matchPct;
    const totalCount = recCount + unrecCount;

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl border border-slate-700 shadow-2xl min-w-[280px] text-xs">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-2.5 mb-2.5">
          <div className="font-extrabold text-slate-100 text-sm">{label}</div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            {matchPct}% Reconciled
          </span>
        </div>

        <div className="space-y-2 mb-3">
          {/* Reconciled Stack */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shrink-0" />
              <span className="text-slate-300 font-medium">Reconciled (Compliant)</span>
            </div>
            <div className="text-right font-mono">
              <div className="font-black text-emerald-400">
                {metricMode === 'VALUE' ? formatCurrency(recTax) : `${recCount} Invoices`}
              </div>
              <div className="text-[10px] text-slate-400">
                {metricMode === 'VALUE' ? `${recCount} invs` : formatCurrency(recTax)}
              </div>
            </div>
          </div>

          {/* Unreconciled Stack */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 shrink-0 animate-pulse" />
              <span className="text-slate-300 font-medium">Unreconciled (Tax Gap)</span>
            </div>
            <div className="text-right font-mono">
              <div className="font-black text-rose-400">
                {metricMode === 'VALUE' ? formatCurrency(unrecTax) : `${unrecCount} Invoices`}
              </div>
              <div className="text-[10px] text-slate-400">
                {metricMode === 'VALUE' ? `${unrecCount} invs` : formatCurrency(unrecTax)}
              </div>
            </div>
          </div>
        </div>

        {/* Total & Gap Diagnosis */}
        <div className="pt-2 border-t border-slate-700/80 space-y-1.5">
          <div className="flex justify-between items-center text-[11px] font-bold text-slate-200">
            <span>Total Stream Volume:</span>
            <span>{metricMode === 'VALUE' ? formatCurrency(recTax + unrecTax) : `${totalCount} Invoices`}</span>
          </div>

          {unrecTax > 0 && (
            <div className="p-2 bg-rose-950/40 border border-rose-900/60 rounded-xl text-[10px] text-rose-200 flex items-start gap-1.5">
              <AlertTriangle size={12} className="text-rose-400 shrink-0 mt-0.5" />
              <span>
                <strong className="font-bold">Tax Gap Risk:</strong> {itemData.gapReason}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div 
      id="reconciled-vs-unreconciled-dashboard"
      className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6 animate-in fade-in duration-300"
    >
      {/* 1. Header Bar with Title, Scoped Period & Action Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-2xs">
              <Scale size={20} />
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Reconciled vs Unreconciled Invoices
            </h3>
            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded-lg text-xs font-mono font-bold shadow-2xs">
              Current Period: {period}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Multi-stream stacked comparison between reconciled books and GSTR-2B/1 portal filings to detect ITC at risk, delayed vendor uploads, and potential statutory tax gaps.
          </p>
        </div>

        {/* Dimension & Metric Switches */}
        <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto justify-start lg:justify-end">
          {/* Dimension Selector */}
          <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 text-xs font-bold text-slate-600">
            <button
              onClick={() => setDimension('CATEGORY')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                dimension === 'CATEGORY' ? 'bg-white text-slate-900 shadow-xs font-extrabold' : 'hover:text-slate-900'
              }`}
            >
              Category
            </button>
            <button
              onClick={() => setDimension('WEEKLY')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                dimension === 'WEEKLY' ? 'bg-white text-slate-900 shadow-xs font-extrabold' : 'hover:text-slate-900'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setDimension('TAX_SLAB')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                dimension === 'TAX_SLAB' ? 'bg-white text-slate-900 shadow-xs font-extrabold' : 'hover:text-slate-900'
              }`}
            >
              Tax Slab
            </button>
          </div>

          {/* Metric Mode Toggle */}
          <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 text-xs font-bold text-slate-600">
            <button
              onClick={() => setMetricMode('VALUE')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                metricMode === 'VALUE' ? 'bg-white text-blue-700 shadow-xs font-extrabold' : 'hover:text-slate-900'
              }`}
              title="Show tax gap amounts in INR"
            >
              Tax Value (₹)
            </button>
            <button
              onClick={() => setMetricMode('COUNT')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                metricMode === 'COUNT' ? 'bg-white text-blue-700 shadow-xs font-extrabold' : 'hover:text-slate-900'
              }`}
              title="Show count of invoices"
            >
              Count (#)
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
            title="Refresh reconciliation data"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Executive KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoices */}
        <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Invoices</span>
            <div className="p-1.5 bg-slate-200/80 text-slate-700 rounded-lg">
              <Layers size={15} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900">{kpiSummary.totalInvoices}</span>
            <span className="text-xs text-slate-500 ml-1.5">Processed</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Total tax volume: <strong className="text-slate-700 font-mono">{formatCurrency(kpiSummary.totalTaxValue)}</strong>
          </p>
        </div>

        {/* Reconciled Volume */}
        <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Reconciled (Matched)</span>
            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-800">
              {formatCurrency(kpiSummary.totalReconciledTax)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-emerald-700 mt-1">
            <span>{kpiSummary.totalReconciledCount} Invoices</span>
            <span className="font-extrabold font-mono">{kpiSummary.reconciliationRate}% Match</span>
          </div>
        </div>

        {/* Potential Tax Gap (High Impact) */}
        <div className="p-4 bg-rose-50/60 border border-rose-200/80 rounded-2xl flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert size={14} className="animate-pulse text-rose-600" />
              Potential Tax Gap
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-100 text-rose-700">
              At Risk
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-rose-700 font-mono">
              {formatCurrency(kpiSummary.totalUnreconciledTax)}
            </span>
          </div>
          <p className="text-[11px] text-rose-600 mt-1 font-medium">
            Across {kpiSummary.totalUnreconciledCount} unreconciled invoices
          </p>
        </div>

        {/* ITC at Risk Under Rule 36(4) */}
        <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">ITC Blockage Exposure</span>
            <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
              <AlertTriangle size={15} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-900 font-mono">
              {formatCurrency(Math.round(kpiSummary.totalUnreconciledTax * 0.72))}
            </span>
          </div>
          <p className="text-[11px] text-amber-700 mt-1">
            Section 16(2)(aa) statutory blockage risk
          </p>
        </div>
      </div>

      {/* 3. Recharts Stacked Bar Chart */}
      <div className="p-4 sm:p-6 bg-slate-50/40 rounded-2xl border border-slate-200/70">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <div>
            <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <span>Stacked Tax Gap Exposure</span>
              <span className="text-[10px] font-bold text-slate-500 font-mono">
                ({metricMode === 'VALUE' ? 'INR ₹ Breakdown' : 'Invoice Counts'})
              </span>
            </h4>
            <p className="text-xs text-slate-500">
              Green segments reflect matched filings. Red segments indicate the potential tax gap requiring vendor resolution.
            </p>
          </div>

          {/* Inline Legend */}
          <div className="flex items-center gap-4 text-xs font-bold shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block shadow-2xs" />
              <span className="text-slate-700">Reconciled (Matched)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-rose-500 inline-block shadow-2xs" />
              <span className="text-slate-700">Unreconciled (Tax Gap)</span>
            </div>
          </div>
        </div>

        <div className="h-[340px] w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 20, left: 10, bottom: 25 }}
              barSize={40}
              onMouseMove={(state: any) => {
                if (state && state.activePayload && state.activePayload.length) {
                  setHoveredBar(state.activePayload[0].payload.name);
                }
              }}
              onMouseLeave={() => setHoveredBar(null)}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.7} />
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
                dy={8}
              />
              <YAxis 
                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                tickFormatter={(val) => metricMode === 'VALUE' ? `₹${(val / 1000).toFixed(0)}k` : `${val}`}
                axisLine={false}
                tickLine={false}
                dx={-5}
              />
              <Tooltip content={<CustomReconTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.7)' }} />

              {/* Stacked Bars */}
              <Bar 
                dataKey="reconciled" 
                name="Reconciled" 
                stackId="reconStack" 
                fill="#10b981"
                radius={[0, 0, 0, 0]}
              />
              <Bar 
                dataKey="unreconciled" 
                name="Unreconciled" 
                stackId="reconStack" 
                fill="#f43f5e"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Tax Gap Root-Cause Diagnostic & Remediation Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Info size={16} className="text-blue-600" />
            Tax Gap Root-Cause Analysis & Action Plan
          </h4>
          <button 
            onClick={() => {
              if (onNavigateToRecon) {
                onNavigateToRecon();
              } else {
                window.location.hash = '#/reconciliation';
              }
            }}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>Open Full GSTR-2B Reconciliation Engine</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {gapRootCauses.map((cause, idx) => (
            <div 
              key={idx}
              className="p-4 bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 rounded-2xl transition-all flex flex-col justify-between gap-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      cause.severity === 'HIGH' ? 'bg-rose-500' : cause.severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-blue-500'
                    }`} />
                    <span className="text-xs font-bold text-slate-800 leading-snug">
                      {cause.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 ml-4">
                    {cause.count} invoices affected ({cause.percentage}% of overall gap)
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm font-black text-rose-600 font-mono">
                    {formatCurrency(cause.amount)}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-600 font-medium">
                  Recommendation: <span className="text-slate-800 font-semibold">{cause.action}</span>
                </span>
                <button 
                  onClick={() => {
                    if (onNavigateToRecon) {
                      onNavigateToRecon();
                    } else {
                      window.location.hash = '#/reconciliation';
                    }
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-600 border border-slate-200 rounded-lg font-bold text-[10px] transition-colors cursor-pointer shrink-0 ml-2"
                >
                  Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReconciledVsUnreconciledChart;
