import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { switchTenant, setSelectedGstin, setSelectedBranch } from '../../store/store';
import { Tenant } from '../../types';
import { 
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, AreaChart, Area, ReferenceLine, Legend
} from 'recharts';
import { 
  IndianRupee, ArrowDownRight, ArrowUpRight, AlertCircle, MoreHorizontal,
  TrendingUp, TrendingDown, Percent, Sparkles, Activity, ShieldCheck, Scale, RefreshCw,
  Building2, Layers, CheckCircle2, ChevronRight, ArrowRight, Eye, Building
} from 'lucide-react';
import StatCard from './StatCard';
import MonthlyGstSummaryTableWithChart from './MonthlyGstSummaryTableWithChart';

interface AdminFinancialViewProps {
  stats: any;
  analytics: any;
  getChartTitle: () => string;
  timeRange?: string;
  selectedEntityId?: string;
  onSelectEntity?: (id: string) => void;
  availableTenants?: Tenant[];
  allTenantStats?: { [tenantId: string]: any };
  allTenantAnalytics?: { [tenantId: string]: any };
  hideInternalScopeSwitcher?: boolean;
}

const AdminFinancialView: React.FC<AdminFinancialViewProps> = ({ 
  stats, 
  analytics, 
  getChartTitle,
  timeRange = 'MONTHLY',
  selectedEntityId = 'AGGREGATE',
  onSelectEntity,
  availableTenants = [],
  allTenantStats = {},
  allTenantAnalytics = {},
  hideInternalScopeSwitcher = false
}) => {
  const dispatch = useDispatch();
  const [liabilityViewMode, setLiabilityViewMode] = useState<'COMBINED' | 'NET_ONLY' | 'MOM_CHANGE'>('COMBINED');

  const isWeekly = timeRange === 'WEEKLY';
  const isQuarterly = timeRange === 'QUARTERLY';
  const periodLabel = isWeekly ? 'Week' : isQuarterly ? 'Quarter' : 'Month';
  const popAcronym = isWeekly ? 'WoW' : isQuarterly ? 'QoQ' : 'MoM';

  const isAggregate = !selectedEntityId || selectedEntityId === 'AGGREGATE';
  const currentTenant = availableTenants.find(t => t.id === selectedEntityId);

  // Group totals across all available entities
  let totalGroupSales = 0;
  let totalGroupPurchases = 0;
  let totalGroupLiability = 0;
  let totalGroupItc = 0;

  availableTenants.forEach(t => {
    const s = allTenantStats[t.id];
    if (s) {
      totalGroupSales += s.sales || 0;
      totalGroupPurchases += s.purchases || 0;
      totalGroupLiability += s.liability || 0;
      totalGroupItc += s.itc || 0;
    }
  });

  // Calculate current entity share if viewing individual company
  const activeSales = stats?.sales || 0;
  const activePurchases = stats?.purchases || 0;
  const activeLiability = stats?.liability || 0;
  const activeItc = stats?.itc || 0;

  const salesShare = totalGroupSales > 0 ? Math.round((activeSales / totalGroupSales) * 100) : 0;
  const itcShare = totalGroupItc > 0 ? Math.round((activeItc / totalGroupItc) * 100) : 0;
  const liabilityShare = totalGroupLiability > 0 ? Math.round((activeLiability / totalGroupLiability) * 100) : 0;

  // Dynamic profit margin computation
  const profitMarginNum = activeSales > 0 ? (((activeSales - activePurchases) / activeSales) * 100) : 24.5;
  const profitMarginStr = profitMarginNum.toFixed(1) + '%';
  const isProfitPositive = profitMarginNum >= 0;

  const handleSelectScope = (id: string) => {
    if (onSelectEntity) {
      onSelectEntity(id);
    }
    if (id !== 'AGGREGATE') {
      dispatch(switchTenant(id));
      dispatch(setSelectedGstin('ALL'));
      dispatch(setSelectedBranch('ALL'));
    }
  };

  // Process Month-over-Month Tax Liability Data
  const rawTrend = analytics?.monthlyTrend || [];
  const processedData = rawTrend.map((item: any, idx: number) => {
    const prevLiability = idx > 0 ? rawTrend[idx - 1].liability : item.liability;
    const momChange = idx > 0 ? item.liability - prevLiability : 0;
    const momChangePct = idx > 0 && prevLiability > 0 
      ? ((item.liability - prevLiability) / prevLiability) * 100 
      : 0;
    const itcRatio = item.outputLiability > 0 
      ? Math.min(100, Math.round((item.itc / item.outputLiability) * 100))
      : 0;

    return {
      ...item,
      momChange,
      momChangePct: parseFloat(momChangePct.toFixed(1)),
      itcRatio
    };
  });

  // Calculate summary metrics for the trend
  const totalLiabilitySum = processedData.reduce((acc: number, curr: any) => acc + (curr.liability || 0), 0);
  const avgLiability = processedData.length > 0 ? Math.round(totalLiabilitySum / processedData.length) : 0;
  
  const latestMonth = processedData.length > 0 ? processedData[processedData.length - 1] : null;
  const previousMonth = processedData.length > 1 ? processedData[processedData.length - 2] : null;
  
  const peakMonth = processedData.length > 0 
    ? [...processedData].sort((a, b) => b.liability - a.liability)[0] 
    : null;

  const totalOutputSum = processedData.reduce((acc: number, curr: any) => acc + (curr.outputLiability || 0), 0);
  const totalItcSum = processedData.reduce((acc: number, curr: any) => acc + (curr.itc || 0), 0);
  const overallItcOffsetPct = totalOutputSum > 0 ? Math.round((totalItcSum / totalOutputSum) * 100) : 0;

  // Custom Recharts Tooltip for Tax Liability Trend
  const CustomLiabilityTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const isIncrease = dataPoint.momChange > 0;
      const isZero = dataPoint.momChange === 0;

      return (
        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700/80 text-xs min-w-[220px] space-y-2.5 backdrop-blur-md">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <span className="font-black text-slate-300 uppercase tracking-widest text-[11px]">{label} Liability Summary</span>
            {dataPoint.momChange !== undefined && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                isIncrease 
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                  : isZero
                  ? 'bg-slate-800 text-slate-400'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {isIncrease ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {isIncrease ? `+₹${dataPoint.momChange.toLocaleString()} (+${dataPoint.momChangePct}%)` : `${dataPoint.momChange.toLocaleString()} (${dataPoint.momChangePct}%)`}
              </span>
            )}
          </div>

          <div className="space-y-1.5 font-medium">
            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                Net Tax Liability:
              </span>
              <strong className="text-amber-300 font-mono font-bold">₹{(dataPoint.liability || 0).toLocaleString()}</strong>
            </div>

            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
                Gross Output Tax:
              </span>
              <strong className="text-white font-mono font-bold">₹{(dataPoint.outputLiability || 0).toLocaleString()}</strong>
            </div>

            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                ITC Utilized Offset:
              </span>
              <strong className="text-emerald-300 font-mono font-bold">₹{(dataPoint.itc || 0).toLocaleString()}</strong>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-400">
            <span>ITC Liability Offset Ratio:</span>
            <span className="font-bold text-emerald-400">{dataPoint.itcRatio}%</span>
          </div>
        </div>
      );
    };
    return null;
  };

  return (
    <div className="space-y-8">
      {/* Entity Scope Control & Corporate Consolidation Switchboard */}
      {!hideInternalScopeSwitcher && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl ${isAggregate ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-blue-600 text-white shadow-blue-200'} shadow-md shrink-0 mt-0.5`}>
                {isAggregate ? <Layers size={22} /> : <Building2 size={22} />}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    {isAggregate ? 'Consolidated Group Financials' : `${currentTenant?.name || 'Company'} Financial Suite`}
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    isAggregate 
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {isAggregate ? `Group Level (${availableTenants.length} Companies)` : 'Individual Company'}
                  </span>
                  {!isAggregate && currentTenant && (
                    <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {currentTenant.gstin}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {isAggregate 
                    ? `Aggregated multi-entity metrics for all ${availableTenants.length} companies: ${availableTenants.map(t => t.name).join(', ')}.`
                    : `Discrete ledger and GST compliance metrics for ${currentTenant?.name || 'selected company'} (${currentTenant?.address || currentTenant?.stateCode || ''}).`}
                </p>
              </div>
            </div>

            {/* Scope Toggle Buttons */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 flex-wrap">
              <button
                onClick={() => handleSelectScope('AGGREGATE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isAggregate
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Layers size={13} />
                <span>Consolidated Group ({availableTenants.length})</span>
              </button>

              {availableTenants.map(t => {
                const isSelected = !isAggregate && selectedEntityId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleSelectScope(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <Building size={13} />
                    <span>{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Consolidated Company Contribution Breakdown Strip */}
          {isAggregate && availableTenants.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Scale size={13} className="text-indigo-600" />
                  Individual Company Contributions to Consolidated Totals
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  Click any company card to filter into its individual view
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {availableTenants.map(t => {
                  const s = allTenantStats[t.id] || { sales: 0, liability: 0, itc: 0 };
                  const compSalesShare = totalGroupSales > 0 ? Math.round((s.sales / totalGroupSales) * 100) : 0;
                  const compLiabShare = totalGroupLiability > 0 ? Math.round((s.liability / totalGroupLiability) * 100) : 0;

                  return (
                    <div
                      key={t.id}
                      onClick={() => handleSelectScope(t.id)}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-indigo-50/50 hover:border-indigo-300 cursor-pointer transition-all group flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="truncate">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 transition-colors truncate">
                              {t.name}
                            </span>
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-white border border-slate-200 text-slate-600 shrink-0">
                              {t.stateCode || 'IN'}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 block truncate">{t.gstin}</span>
                        </div>
                        <span className="text-[11px] font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                          View <ChevronRight size={12} />
                        </span>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 grid grid-cols-3 gap-1 text-center">
                        <div className="text-left">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Sales</span>
                          <span className="text-xs font-extrabold text-slate-800 font-mono">₹{(s.sales || 0).toLocaleString('en-IN')}</span>
                          <span className="text-[9px] font-bold text-indigo-600 block">{compSalesShare}%</span>
                        </div>
                        <div className="text-left">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">ITC</span>
                          <span className="text-xs font-extrabold text-emerald-700 font-mono">₹{(s.itc || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="text-left">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Liability</span>
                          <span className="text-xs font-extrabold text-amber-700 font-mono">₹{(s.liability || 0).toLocaleString('en-IN')}</span>
                          <span className="text-[9px] font-bold text-slate-500 block">{compLiabShare}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Individual Entity Context Banner */}
          {!isAggregate && currentTenant && (
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50/60 -mx-5 -mb-5 p-3.5 rounded-b-2xl border-t border-blue-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
                <div className="text-xs text-blue-900">
                  Viewing individual data for <span className="font-bold text-blue-950">{currentTenant.name}</span>. Contributing{' '}
                  <strong className="font-mono text-blue-700">{salesShare}%</strong> of group sales (₹{activeSales.toLocaleString('en-IN')} / ₹{totalGroupSales.toLocaleString('en-IN')})
                  and <strong className="font-mono text-blue-700">{liabilityShare}%</strong> of group liability.
                </div>
              </div>
              <button
                onClick={() => handleSelectScope('AGGREGATE')}
                className="text-xs font-bold text-blue-700 hover:text-blue-900 underline flex items-center gap-1 shrink-0"
              >
                ← Back to Consolidated Group
              </button>
            </div>
          )}
        </div>
      )}

      {/* Financial Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Sales" 
          value={`₹${activeSales.toLocaleString('en-IN')}`} 
          trend={isWeekly ? "3.2%" : isQuarterly ? "18.4%" : "12.5%"} 
          isPositive={true} 
          icon={<IndianRupee size={22} />}
          color="blue"
          subtitle={isAggregate ? `Group total (${timeRange.toLowerCase()}) across ${availableTenants.length} companies` : `${salesShare}% of Group Total (₹${totalGroupSales.toLocaleString('en-IN')})`}
        />
        <StatCard 
          title="ITC Available" 
          value={`₹${activeItc.toLocaleString('en-IN')}`} 
          trend={isWeekly ? "1.8%" : isQuarterly ? "7.6%" : "5.2%"} 
          isPositive={true} 
          icon={<ArrowDownRight size={22} />}
          color="emerald"
          subtitle={isAggregate ? `Combined credit (${timeRange.toLowerCase()}) across ${availableTenants.length} companies` : `${itcShare}% of Group ITC (₹${totalGroupItc.toLocaleString('en-IN')})`}
        />
        <StatCard 
          title="Net Liability" 
          value={`₹${activeLiability.toLocaleString('en-IN')}`} 
          trend={isWeekly ? "0.9%" : isQuarterly ? "4.1%" : "2.4%"} 
          isPositive={false} 
          icon={<ArrowUpRight size={22} />}
          color="amber"
          subtitle={isAggregate ? `Consolidated tax liability (${timeRange.toLowerCase()}) across group` : `${liabilityShare}% of Group Liability (₹${totalGroupLiability.toLocaleString('en-IN')})`}
        />
        <StatCard 
          title="Profit Margin" 
          value={profitMarginStr} 
          trend="3.1%" 
          isPositive={isProfitPositive} 
          icon={<AlertCircle size={22} />}
          color="blue"
          subtitle={isAggregate ? `Consolidated group gross margin (${timeRange.toLowerCase()})` : `${currentTenant?.name || 'Company'} discrete gross margin`}
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Trend Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-800">
                  {getChartTitle ? `${getChartTitle()} — ${isAggregate ? 'Consolidated Group' : currentTenant?.name || 'Individual Entity'}` : (isAggregate ? `${periodLabel}ly GST Summary — Consolidated Group` : `${periodLabel}ly GST Summary — ${currentTenant?.name || 'Individual Entity'}`)}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  isAggregate ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  {isAggregate ? 'Group Rollup' : currentTenant?.gstin || 'Individual'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {isAggregate 
                  ? `Consolidated revenue, purchases, and net liability trends across all ${availableTenants.length} entities (${timeRange.toLowerCase()} scope)`
                  : `${periodLabel}ly financial and tax compliance trajectory for ${currentTenant?.name || 'selected entity'}`}
              </p>
            </div>
            <div className="flex gap-4 items-center shrink-0">
              <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  <span className="text-xs font-semibold text-slate-600">Sales</span>
              </div>
              <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-semibold text-slate-600">Purchase</span>
              </div>
              <div className="flex items-center gap-2">
                  <span className="w-3.5 h-1 bg-slate-800 rounded-full"></span>
                  <span className="text-xs font-semibold text-slate-600">Net Liability</span>
              </div>
            </div>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={analytics?.monthlyTrend || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorPurchase" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="sales" fill="url(#colorSales)" radius={[4, 4, 0, 0]} barSize={12} name="Sales" />
                <Bar dataKey="purchase" fill="url(#colorPurchase)" radius={[4, 4, 0, 0]} barSize={12} name="Purchase" />
                <Line type="monotone" dataKey="liability" stroke="#1e293b" strokeWidth={3} dot={{r: 4, fill: '#1e293b', strokeWidth: 2, stroke: '#fff'}} name="Net Liability" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Utilization Mix */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between relative overflow-hidden">
          <div className="flex justify-between items-start mb-2 z-10">
             <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-800">Settlement Mix</h3>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    {isAggregate ? 'Group Total' : currentTenant?.name || 'Entity'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  {isAggregate ? `Consolidated Cash vs Credit Ledger (${availableTenants.length} Companies)` : `Cash vs Credit Ledger (${currentTenant?.name || 'Selected Entity'})`}
                </p>
             </div>
             <button className="text-slate-400 hover:text-slate-600"><MoreHorizontal size={18}/></button>
          </div>
          
          <div className="h-64 relative flex-1 z-10">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics?.utilization || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  cornerRadius={6}
                >
                  {(analytics?.utilization || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Paid</span>
                <span className="text-2xl font-bold text-slate-800">
                    ₹{(((analytics?.utilization || []).reduce((acc: number, curr: any) => acc + curr.value, 0)) / 1000).toFixed(1)}k
                </span>
            </div>
          </div>
          
          <div className="space-y-2.5 z-10 pt-2 border-t border-slate-100">
              {(analytics?.utilization || []).map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70">
                      <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shadow-xs" style={{backgroundColor: item.color}}></div>
                          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{item.name}</span>
                      </div>
                      <span className="font-bold text-slate-900 text-sm font-mono">₹{item.value.toLocaleString()}</span>
                  </div>
              ))}
          </div>
        </div>
      </div>

      {/* ENHANCED SECTION: PERIOD-OVER-PERIOD TAX LIABILITY TREND LINE CHART */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xs border border-slate-200 space-y-6">
        {/* Header & Control Options */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0 shadow-xs">
              <TrendingUp size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-slate-900">
                  {isWeekly ? 'Week-over-Week Tax Liability Trend' : isQuarterly ? 'Quarter-over-Quarter Tax Liability Trend' : 'Month-over-Month Tax Liability Trend'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                  {popAcronym} Insights
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Track {periodLabel.toLowerCase()}-over-{periodLabel.toLowerCase()} tax liability trajectories, gross output tax vs. ITC credit offsets, and percentage variations.
              </p>
            </div>
          </div>

          {/* View Filter Mode Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200/80">
            {[
              { id: 'COMBINED', label: 'Liability & Offsets' },
              { id: 'NET_ONLY', label: 'Net Liability Trend' },
              { id: 'MOM_CHANGE', label: `${popAcronym} % Variance` }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setLiabilityViewMode(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  liabilityViewMode === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Metrics Highlight Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/70 flex flex-col justify-between min-h-[105px]">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Latest Net Liability</span>
            <div className="flex items-baseline justify-between my-1">
              <span className="text-xl font-black text-slate-900 font-mono">
                ₹{(latestMonth?.liability || 0).toLocaleString()}
              </span>
              {latestMonth && latestMonth.momChangePct !== 0 && (
                <span className={`text-xs font-extrabold flex items-center gap-0.5 ${
                  latestMonth.momChangePct > 0 ? 'text-amber-600' : 'text-emerald-600'
                }`}>
                  {latestMonth.momChangePct > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {Math.abs(latestMonth.momChangePct)}%
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Vs. previous {periodLabel.toLowerCase()} (₹{(previousMonth?.liability || 0).toLocaleString()})</p>
          </div>

          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/70 flex flex-col justify-between min-h-[105px]">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Average {isWeekly ? 'Weekly' : isQuarterly ? 'Quarterly' : 'Monthly'} Liability</span>
            <div className="flex items-baseline justify-between my-1">
              <span className="text-xl font-black text-slate-900 font-mono">
                ₹{avgLiability.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Baseline</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Across {processedData.length} monitored {isWeekly ? 'weeks' : isQuarterly ? 'quarters' : 'periods'}</p>
          </div>

          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/70 flex flex-col justify-between min-h-[105px]">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Peak Liability {periodLabel}</span>
            <div className="flex items-baseline justify-between my-1">
              <span className="text-xl font-black text-slate-900 font-mono truncate mr-2">
                {peakMonth ? peakMonth.name : 'N/A'}
              </span>
              <span className="text-xs font-extrabold text-rose-600 font-mono shrink-0">
                ₹{(peakMonth?.liability || 0).toLocaleString()}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Highest tax outflow period</p>
          </div>

          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/70 flex flex-col justify-between min-h-[105px]">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Overall ITC Offset Ratio</span>
            <div className="flex items-baseline justify-between my-1">
              <span className="text-xl font-black text-emerald-600 font-mono">
                {overallItcOffsetPct}%
              </span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                High Coverage
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">ITC claimed vs. total output tax</p>
          </div>
        </div>

        {/* Recharts Trend Line Chart */}
        <div className="h-80 w-full relative pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {liabilityViewMode === 'MOM_CHANGE' ? (
              <AreaChart data={processedData} margin={{ top: 15, right: 15, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="momVarianceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} unit="%" />
                <Tooltip content={<CustomLiabilityTooltip />} />
                <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="4 4" />
                <Area 
                  type="monotone" 
                  dataKey="momChangePct" 
                  name="MoM Change %" 
                  stroke="#f59e0b" 
                  strokeWidth={3} 
                  fill="url(#momVarianceGrad)" 
                  dot={{ r: 5, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 8, strokeWidth: 0 }}
                />
              </AreaChart>
            ) : (
              <ComposedChart data={processedData} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="netLiabilityArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.01}/>
                  </linearGradient>
                  <linearGradient id="grossOutputGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip content={<CustomLiabilityTooltip />} />
                <ReferenceLine y={avgLiability} stroke="#94a3b8" strokeDasharray="5 5" label={{ value: `Avg: ₹${avgLiability}`, fill: '#64748b', fontSize: 11, position: 'insideTopRight' }} />
                
                {/* Area under Net Tax Liability Line */}
                <Area type="monotone" dataKey="liability" fill="url(#netLiabilityArea)" stroke="none" />

                {liabilityViewMode === 'COMBINED' && (
                  <>
                    {/* Gross Output Liability Line */}
                    <Line 
                      type="monotone" 
                      dataKey="outputLiability" 
                      name="Gross Output Tax" 
                      stroke="#6366f1" 
                      strokeWidth={2.5} 
                      strokeDasharray="4 4"
                      dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} 
                    />
                    {/* ITC Offset Line */}
                    <Line 
                      type="monotone" 
                      dataKey="itc" 
                      name="ITC Utilized Offset" 
                      stroke="#10b981" 
                      strokeWidth={2.5} 
                      dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} 
                    />
                  </>
                )}

                {/* Primary Net Tax Liability Trend Line */}
                <Line 
                  type="monotone" 
                  dataKey="liability" 
                  name="Net Tax Liability" 
                  stroke="#d97706" 
                  strokeWidth={3.5} 
                  dot={{ r: 6, fill: '#d97706', strokeWidth: 3, stroke: '#ffffff' }} 
                  activeDot={{ r: 9, fill: '#b45309', strokeWidth: 3, stroke: '#ffffff' }}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Legend & Month-by-Month Variance Strip */}
        <div className="pt-3 border-t border-slate-100 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 font-medium">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-1 bg-amber-600 rounded-full"></span>
                <span className="font-bold text-slate-800">Net Tax Liability</span>
              </div>
              {liabilityViewMode === 'COMBINED' && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-1 border-b-2 border-dashed border-indigo-500"></span>
                    <span className="font-bold text-slate-800">Gross Output Tax</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-1 bg-emerald-500 rounded-full"></span>
                    <span className="font-bold text-slate-800">ITC Credit Offset</span>
                  </div>
                </>
              )}
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-1 border-b-2 border-dashed border-slate-400"></span>
                <span className="text-slate-500">{periodLabel}ly Avg (₹{avgLiability})</span>
              </div>
            </div>

            <span className="text-[11px] text-slate-400 italic">
              Hover over points to view exact {popAcronym} breakdown
            </span>
          </div>

          {/* Month-by-Month Delta Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
            {processedData.map((m: any, idx: number) => {
              const isIncrease = m.momChange > 0;
              const isZero = m.momChange === 0;

              return (
                <div key={idx} className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/70 flex flex-col justify-between min-h-[82px] hover:border-slate-300 transition-colors">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-black text-slate-700 uppercase">{m.name}</span>
                    {idx > 0 ? (
                      <span className={`font-extrabold text-[10px] flex items-center gap-0.5 ${
                        isIncrease ? 'text-amber-600' : isZero ? 'text-slate-400' : 'text-emerald-600'
                      }`}>
                        {isIncrease ? '▲' : isZero ? '•' : '▼'} {Math.abs(m.momChangePct)}%
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-400 font-bold uppercase">Base</span>
                    )}
                  </div>
                  <p className="text-xs font-mono font-bold text-slate-900 my-0.5">
                    ₹{m.liability.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-400 flex justify-between font-mono">
                    <span>ITC: ₹{m.itc.toLocaleString()}</span>
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* DEDICATED MONTHLY GST SUMMARY TABLE & DIRECT RECHARTS BAR CHART COMPARISON */}
      <MonthlyGstSummaryTableWithChart
        data={analytics?.monthlyTrend || []}
        timeRange={timeRange}
        isAggregate={isAggregate}
        entityName={currentTenant?.name || 'Company'}
        gstin={currentTenant?.gstin}
      />
    </div>
  );
};

export default AdminFinancialView;

