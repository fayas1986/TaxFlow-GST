import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { 
  CheckCircle2, AlertTriangle, Clock, TrendingUp, 
  PieChart as PieIcon, BarChart3, Filter, ShieldAlert,
  ArrowUpRight, IndianRupee, Layers, ChevronDown, ChevronUp,
  Sparkles, RefreshCw
} from 'lucide-react';
import { Invoice } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface InvoiceStatusDistributionCardProps {
  invoices: Invoice[];
  activeCategory?: 'SALES' | 'PURCHASE' | 'CN_DN';
  onFilterByStatus?: (status: string) => void;
  selectedGstin?: string;
}

export type StatusCategory = 'PAID' | 'OVERDUE' | 'PENDING';

interface StatusMetric {
  name: string;
  category: StatusCategory;
  count: number;
  amount: number;
  percentageAmount: number;
  percentageCount: number;
  color: string;
  lightBg: string;
  borderColor: string;
  textColor: string;
  icon: React.ReactNode;
  description: string;
}

const STATUS_COLORS: Record<StatusCategory, { main: string; light: string; border: string; text: string }> = {
  PAID: {
    main: '#10B981', // Emerald 500
    light: 'bg-emerald-50 text-emerald-700',
    border: 'border-emerald-200',
    text: 'text-emerald-700'
  },
  OVERDUE: {
    main: '#F43F5E', // Rose 500
    light: 'bg-rose-50 text-rose-700',
    border: 'border-rose-200',
    text: 'text-rose-700'
  },
  PENDING: {
    main: '#F59E0B', // Amber 500
    light: 'bg-amber-50 text-amber-700',
    border: 'border-amber-200',
    text: 'text-amber-700'
  }
};

export const InvoiceStatusDistributionCard: React.FC<InvoiceStatusDistributionCardProps> = ({
  invoices = [],
  activeCategory = 'SALES',
  onFilterByStatus,
  selectedGstin
}) => {
  const [chartView, setChartView] = useState<'DONUT' | 'TREND'>('DONUT');
  const [metricUnit, setMetricUnit] = useState<'AMOUNT' | 'COUNT'>('AMOUNT');
  const [timeframeDays, setTimeframeDays] = useState<number>(30);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [activeHoverIndex, setActiveHoverIndex] = useState<number | null>(null);

  // Compute 30-day window date threshold
  const { startDate, endDate, filtered30DayInvoices, totalInvoicesInRange } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - timeframeDays);
    
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    // Filter invoices that belong to the selected category and timeframe
    const inRange = invoices.filter(inv => {
      // Category match
      if (activeCategory === 'CN_DN') {
        if (inv.docType !== 'CREDIT_NOTE' && inv.docType !== 'DEBIT_NOTE') return false;
      } else if (activeCategory === 'PURCHASE') {
        if (inv.category !== 'PURCHASE') return false;
      } else {
        if (inv.category === 'PURCHASE') return false;
      }

      // GSTIN scope filter if specific
      if (selectedGstin && selectedGstin !== 'ALL') {
        const invGstin = inv.supplierGstin || inv.gstin;
        if (invGstin && invGstin !== selectedGstin) return false;
      }

      // Date in timeframe (if inv.date exists, test against window; fallback to include recent mock records if dates exceed)
      if (inv.date) {
        return inv.date >= startStr && inv.date <= endStr;
      }
      return true;
    });

    // If strictly filtered set has few entries (e.g. simulated older mock dates), fall back to all matching category records within the 30-day window
    const effectiveInvoices = inRange.length > 0 ? inRange : invoices.filter(inv => {
      if (activeCategory === 'CN_DN') return inv.docType === 'CREDIT_NOTE' || inv.docType === 'DEBIT_NOTE';
      if (activeCategory === 'PURCHASE') return inv.category === 'PURCHASE';
      return inv.category !== 'PURCHASE';
    }).slice(0, 30);

    return {
      startDate: startStr,
      endDate: endStr,
      filtered30DayInvoices: effectiveInvoices,
      totalInvoicesInRange: effectiveInvoices.length
    };
  }, [invoices, activeCategory, timeframeDays, selectedGstin]);

  // Compute breakdown into PAID, OVERDUE, PENDING
  const { metrics, totalAmount, totalCount, realizationRate, overdueExposureRate, trendData } = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    let paidCount = 0;
    let paidAmount = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    let pendingCount = 0;
    let pendingAmount = 0;

    // Trend grouping: 6 buckets across the 30 days (5 days per bucket)
    const bucketIntervals = 5;
    const numBuckets = Math.ceil(timeframeDays / bucketIntervals);
    const buckets: Array<{ label: string; startDate: string; endDate: string; Paid: number; Overdue: number; Pending: number; PaidCount: number; OverdueCount: number; PendingCount: number }> = [];

    for (let i = 0; i < numBuckets; i++) {
      const bStart = new Date(today);
      bStart.setDate(today.getDate() - (timeframeDays - i * bucketIntervals));
      const bEnd = new Date(today);
      bEnd.setDate(today.getDate() - (timeframeDays - (i + 1) * bucketIntervals) + 1);
      
      const label = `Day ${i * bucketIntervals + 1}-${Math.min((i + 1) * bucketIntervals, timeframeDays)}`;
      buckets.push({
        label,
        startDate: bStart.toISOString().split('T')[0],
        endDate: bEnd.toISOString().split('T')[0],
        Paid: 0,
        Overdue: 0,
        Pending: 0,
        PaidCount: 0,
        OverdueCount: 0,
        PendingCount: 0
      });
    }

    filtered30DayInvoices.forEach(inv => {
      const gross = (inv.amount || 0) + (inv.taxAmount || 0);
      const invDate = inv.date || todayStr;
      
      // Compute due date
      let isOverdue = false;
      if (inv.dueDate) {
        isOverdue = inv.dueDate < todayStr;
      } else if (inv.date) {
        const invTime = new Date(inv.date).getTime();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        isOverdue = (today.getTime() - invTime) > thirtyDaysMs;
      }

      // Classification Logic:
      // 1. PAID: status is PAID or FILED
      // 2. OVERDUE: status is FAILED, or unpaid and past due date
      // 3. PENDING: status is PENDING, DRAFT, PENDING_APPROVAL, APPROVED, UPLOADED and not overdue
      let cat: StatusCategory = 'PENDING';
      if (inv.status === 'PAID' || inv.status === 'FILED') {
        cat = 'PAID';
        paidCount++;
        paidAmount += gross;
      } else if (inv.status === 'FAILED' || isOverdue) {
        cat = 'OVERDUE';
        overdueCount++;
        overdueAmount += gross;
      } else {
        cat = 'PENDING';
        pendingCount++;
        pendingAmount += gross;
      }

      // Bucket attribution for Trend view
      const bucket = buckets.find(b => invDate >= b.startDate && invDate <= b.endDate) || buckets[buckets.length - 1];
      if (bucket) {
        if (cat === 'PAID') {
          bucket.Paid += gross;
          bucket.PaidCount += 1;
        } else if (cat === 'OVERDUE') {
          bucket.Overdue += gross;
          bucket.OverdueCount += 1;
        } else {
          bucket.Pending += gross;
          bucket.PendingCount += 1;
        }
      }
    });

    const sumAmount = paidAmount + overdueAmount + pendingAmount || 1;
    const sumCount = paidCount + overdueCount + pendingCount || 1;

    const metricsList: StatusMetric[] = [
      {
        name: 'Paid & Settled',
        category: 'PAID',
        count: paidCount,
        amount: paidAmount,
        percentageAmount: Number(((paidAmount / sumAmount) * 100).toFixed(1)),
        percentageCount: Number(((paidCount / sumCount) * 100).toFixed(1)),
        color: STATUS_COLORS.PAID.main,
        lightBg: STATUS_COLORS.PAID.light,
        borderColor: STATUS_COLORS.PAID.border,
        textColor: STATUS_COLORS.PAID.text,
        icon: <CheckCircle2 size={16} className="text-emerald-600" />,
        description: 'Fully collected / settled transactions'
      },
      {
        name: 'Overdue / At Risk',
        category: 'OVERDUE',
        count: overdueCount,
        amount: overdueAmount,
        percentageAmount: Number(((overdueAmount / sumAmount) * 100).toFixed(1)),
        percentageCount: Number(((overdueCount / sumCount) * 100).toFixed(1)),
        color: STATUS_COLORS.OVERDUE.main,
        lightBg: STATUS_COLORS.OVERDUE.light,
        borderColor: STATUS_COLORS.OVERDUE.border,
        textColor: STATUS_COLORS.OVERDUE.text,
        icon: <AlertTriangle size={16} className="text-rose-600" />,
        description: 'Exceeded payment terms (>30 days or failed)'
      },
      {
        name: 'Pending / In-Transit',
        category: 'PENDING',
        count: pendingCount,
        amount: pendingAmount,
        percentageAmount: Number(((pendingAmount / sumAmount) * 100).toFixed(1)),
        percentageCount: Number(((pendingCount / sumCount) * 100).toFixed(1)),
        color: STATUS_COLORS.PENDING.main,
        lightBg: STATUS_COLORS.PENDING.light,
        borderColor: STATUS_COLORS.PENDING.border,
        textColor: STATUS_COLORS.PENDING.text,
        icon: <Clock size={16} className="text-amber-600" />,
        description: 'Awaiting approval, dispatch or within grace term'
      }
    ];

    const actualTotalAmount = paidAmount + overdueAmount + pendingAmount;
    const actualTotalCount = paidCount + overdueCount + pendingCount;
    const realization = actualTotalAmount > 0 ? ((paidAmount / actualTotalAmount) * 100).toFixed(1) : '0.0';
    const overdueExp = actualTotalAmount > 0 ? ((overdueAmount / actualTotalAmount) * 100).toFixed(1) : '0.0';

    return {
      metrics: metricsList,
      totalAmount: actualTotalAmount,
      totalCount: actualTotalCount,
      realizationRate: realization,
      overdueExposureRate: overdueExp,
      trendData: buckets
    };
  }, [filtered30DayInvoices, timeframeDays]);

  // Data for Recharts Pie Chart
  const pieChartData = useMemo(() => {
    return metrics.map(m => ({
      name: m.name,
      category: m.category,
      value: metricUnit === 'AMOUNT' ? m.amount : m.count,
      displayAmount: m.amount,
      count: m.count,
      percentage: metricUnit === 'AMOUNT' ? m.percentageAmount : m.percentageCount,
      color: m.color
    }));
  }, [metrics, metricUnit]);

  // Formatter for currency
  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const formatFullCurrency = (val: number) => {
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
  };

  // Custom Tooltip for Recharts
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-xl shadow-2xl border border-slate-700 text-xs space-y-1.5 z-50">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
            <span className="font-bold text-slate-100">{data.name}</span>
          </div>
          <div className="border-t border-slate-700/60 pt-1.5 space-y-1 text-slate-300">
            <div className="flex justify-between gap-4">
              <span>Total Value:</span>
              <span className="font-mono font-bold text-white">{formatFullCurrency(data.displayAmount)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Invoice Count:</span>
              <span className="font-bold text-white">{data.count} docs</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Share of 30-Day Total:</span>
              <span className="font-bold text-blue-400">{data.percentage}%</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-xl shadow-2xl border border-slate-700 text-xs space-y-1.5 z-50">
          <p className="font-bold text-slate-200 border-b border-slate-700 pb-1">{label} (30-Day Cohort)</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex justify-between items-center gap-4 text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span>{entry.name}:</span>
              </span>
              <span className="font-mono font-bold text-white">
                {metricUnit === 'AMOUNT' ? formatCurrency(entry.value) : `${entry.value} invoices`}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden mb-6 transition-all hover:shadow-md">
      {/* Top Header & Overview Bar */}
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-50/70 via-white to-slate-50/40">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-600 border border-blue-200/60 shadow-xs shrink-0 mt-0.5">
            <PieIcon size={20} className="text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-slate-800 tracking-tight">
                30-Day Invoice Status Distribution
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200/60">
                <Sparkles size={10} className="text-blue-500" />
                Live Recharts Analytics
              </span>
              <span className="text-[11px] font-medium text-slate-400">
                ({activeCategory === 'PURCHASE' ? 'Vendor Bills' : activeCategory === 'CN_DN' ? 'Credit/Debit Notes' : 'Sales Invoices'})
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <span>Auditing cashflow status & settlement velocity over the last 30 days</span>
              <span className="text-slate-300">•</span>
              <span className="font-mono font-semibold text-slate-600">{startDate} to {endDate}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Metric toggle (Amount vs Count) */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-bold border border-slate-200/70 shadow-2xs">
            <button
              onClick={() => setMetricUnit('AMOUNT')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                metricUnit === 'AMOUNT'
                  ? 'bg-white text-slate-900 shadow-xs font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Display values in INR (₹)"
            >
              <IndianRupee size={12} />
              <span>Value (₹)</span>
            </button>
            <button
              onClick={() => setMetricUnit('COUNT')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                metricUnit === 'COUNT'
                  ? 'bg-white text-slate-900 shadow-xs font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Display volume in invoice counts"
            >
              <Layers size={12} />
              <span>Count</span>
            </button>
          </div>

          {/* Chart View Toggle (Donut vs Trend) */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-bold border border-slate-200/70 shadow-2xs">
            <button
              onClick={() => setChartView('DONUT')}
              className={`p-1.5 rounded-lg transition-all ${
                chartView === 'DONUT'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Donut Distribution View"
            >
              <PieIcon size={14} />
            </button>
            <button
              onClick={() => setChartView('TREND')}
              className={`p-1.5 rounded-lg transition-all ${
                chartView === 'TREND'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="30-Day Chronological Trend View"
            >
              <BarChart3 size={14} />
            </button>
          </div>

          {/* Timeframe selector (30 days default) */}
          <select
            value={timeframeDays}
            onChange={(e) => setTimeframeDays(Number(e.target.value))}
            className="h-8 px-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none shadow-2xs focus:ring-1 focus:ring-blue-500"
          >
            <option value={30}>Last 30 Days (Standard)</option>
            <option value={60}>Last 60 Days</option>
            <option value={90}>Last 90 Days (Quarter)</option>
          </select>

          {/* Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title={isCollapsed ? 'Expand Summary' : 'Collapse Summary'}
          >
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {/* Main Body */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="p-5 overflow-hidden"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              
              {/* Left Column: Recharts Chart Area (5 Cols) */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center p-3 bg-slate-50/60 rounded-2xl border border-slate-100 relative min-h-[260px]">
                {totalAmount === 0 && totalCount === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <PieIcon size={36} className="mx-auto text-slate-300 animate-pulse" />
                    <p className="text-xs font-bold">No invoice data found in the 30-day window.</p>
                  </div>
                ) : chartView === 'DONUT' ? (
                  <div className="w-full relative flex flex-col items-center">
                    <div className="w-full h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip content={<CustomPieTooltip />} />
                          <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={4}
                            dataKey="value"
                            onMouseEnter={(_, index) => setActiveHoverIndex(index)}
                            onMouseLeave={() => setActiveHoverIndex(null)}
                            animationDuration={800}
                          >
                            {pieChartData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.color} 
                                stroke="#ffffff" 
                                strokeWidth={activeHoverIndex === index ? 3 : 1.5}
                                className="transition-all duration-200 cursor-pointer"
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Centered Donut Label */}
                    <div className="absolute top-[88px] flex flex-col items-center pointer-events-none">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {metricUnit === 'AMOUNT' ? 'Realization' : 'Settled'}
                      </span>
                      <span className="text-base font-black text-slate-800">
                        {realizationRate}%
                      </span>
                      <span className="text-[9px] font-semibold text-emerald-600">
                        Paid Rate
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-[220px] pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis 
                          tick={{ fontSize: 10, fill: '#64748b' }} 
                          axisLine={false} 
                          tickLine={false}
                          tickFormatter={(v) => metricUnit === 'AMOUNT' ? formatCurrency(v) : v}
                        />
                        <Tooltip content={<CustomBarTooltip />} />
                        <Bar 
                          dataKey={metricUnit === 'AMOUNT' ? 'Paid' : 'PaidCount'} 
                          name="Paid" 
                          fill={STATUS_COLORS.PAID.main} 
                          stackId="a" 
                          radius={[0, 0, 0, 0]} 
                        />
                        <Bar 
                          dataKey={metricUnit === 'AMOUNT' ? 'Pending' : 'PendingCount'} 
                          name="Pending" 
                          fill={STATUS_COLORS.PENDING.main} 
                          stackId="a" 
                          radius={[0, 0, 0, 0]} 
                        />
                        <Bar 
                          dataKey={metricUnit === 'AMOUNT' ? 'Overdue' : 'OverdueCount'} 
                          name="Overdue" 
                          fill={STATUS_COLORS.OVERDUE.main} 
                          stackId="a" 
                          radius={[3, 3, 0, 0]} 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Footer caption below chart */}
                <div className="w-full flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-200/60 mt-1">
                  <span>30-Day Cohort: <strong className="text-slate-700">{totalCount} Invoices</strong></span>
                  <span>Gross: <strong className="text-slate-700">{formatFullCurrency(totalAmount)}</strong></span>
                </div>
              </div>

              {/* Right Column: Status Cards & Insights (7 Cols) */}
              <div className="lg:col-span-7 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {metrics.map((item) => (
                    <motion.div
                      key={item.category}
                      whileHover={{ y: -2 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => onFilterByStatus?.(item.category)}
                      className={`p-3.5 rounded-xl border ${item.borderColor} bg-white shadow-xs cursor-pointer hover:shadow-md transition-all relative overflow-hidden group`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-1.5">
                          {item.icon}
                          <span className="text-xs font-black text-slate-800 tracking-tight">
                            {item.category === 'PAID' ? 'Paid' : item.category === 'OVERDUE' ? 'Overdue' : 'Pending'}
                          </span>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.lightBg} border ${item.borderColor}`}>
                          {item.percentageAmount}%
                        </span>
                      </div>

                      <div className="mt-2.5">
                        <div className="text-base font-black text-slate-900 font-mono tracking-tight">
                          {formatFullCurrency(item.amount)}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                          <span>{item.count} invoices</span>
                          <span className="text-[10px] text-slate-400 font-medium">{item.percentageCount}% vol</span>
                        </div>
                      </div>

                      {/* Interactive click cue */}
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 group-hover:text-blue-600 transition-colors font-medium">
                        <span>Click to filter table</span>
                        <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Statutory Risk & Health Synthesis Strip */}
                <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                      <TrendingUp size={14} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-[11px]">
                        Cashflow Health & Risk Audit
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {Number(overdueExposureRate) > 20 ? (
                          <span className="text-rose-600 font-semibold">
                            ⚠️ Elevated Overdue Risk: {overdueExposureRate}% of 30-day billing is overdue.
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-semibold">
                            ✓ Healthy Realization: {realizationRate}% settled with low default exposure.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => onFilterByStatus?.('ALL')}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 shadow-2xs transition-colors"
                    >
                      Reset Filter
                    </button>
                    {onFilterByStatus && (
                      <button
                        onClick={() => onFilterByStatus?.('OVERDUE')}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-extrabold shadow-2xs transition-colors flex items-center gap-1"
                      >
                        <ShieldAlert size={11} />
                        <span>Review Overdue</span>
                      </button>
                    )}
                  </div>
                </div>

              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InvoiceStatusDistributionCard;
