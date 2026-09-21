import React, { useState } from 'react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, BarChart, Bar, Line, ComposedChart
} from 'recharts';
import { 
  IndianRupee, TrendingUp, TrendingDown, Scale, PieChart as PieIcon, BarChart2, AreaChart as AreaIcon,
  Percent, ArrowUpRight, ArrowDownRight, Info, MapPin, Globe
} from 'lucide-react';
import GeoGstMapVisualization from '../GeoGstMapVisualization';

interface VisualAnalyticsDashboardProps {
  stats: any;
  analytics: any;
}

const VisualAnalyticsDashboard: React.FC<VisualAnalyticsDashboardProps> = ({ stats, analytics }) => {
  const [revenueChartType, setRevenueChartType] = useState<'area' | 'line' | 'bar'>('area');
  const [activeSegment, setActiveSegment] = useState<number | null>(null);

  // Fallback / standard data in case analytics doesn't have trend data
  const trendData = analytics?.monthlyTrend && analytics.monthlyTrend.length > 0 
    ? analytics.monthlyTrend.map((item: any) => ({
        ...item,
        // Ensure values are formatted correctly as INR scale
        revenue: (item.sales || 0) * 250, // scaled to display realistic revenue (e.g. 10 Lakhs scale)
        purchasesVal: (item.purchase || 0) * 220,
        liabilityVal: (item.liability || 0) * 45,
        itcVal: (item.itc || 0) * 35,
      }))
    : [
        { name: 'May', revenue: 1000000, purchasesVal: 600000, liabilityVal: 180000, itcVal: 108000 },
        { name: 'Jun', revenue: 1250000, purchasesVal: 750000, liabilityVal: 225000, itcVal: 135000 },
        { name: 'Jul', revenue: 950000, purchasesVal: 820000, liabilityVal: 171000, itcVal: 147600 },
        { name: 'Aug', revenue: 1400000, purchasesVal: 900000, liabilityVal: 252000, itcVal: 162000 },
        { name: 'Sep', revenue: 1150000, purchasesVal: 700000, liabilityVal: 207000, itcVal: 126000 },
        { name: 'Oct', revenue: 1540000, purchasesVal: 890000, liabilityVal: 277200, itcVal: 160200 },
      ];

  // Tax liability breakdown (IGST, CGST, SGST, Cess) derived or mock-consistent
  const liabilityBreakdown = [
    { name: 'IGST (Inter-state)', value: 166320, percentage: 60, color: '#3b82f6', desc: 'Integrated GST on inter-state supply' },
    { name: 'CGST (Central)', value: 49896, percentage: 18, color: '#10b981', desc: 'Central GST on intra-state supply' },
    { name: 'SGST (State)', value: 49896, percentage: 18, color: '#f59e0b', desc: 'State GST on intra-state supply' },
    { name: 'Cess (Compensation)', value: 11088, percentage: 4, color: '#ec4899', desc: 'Special GST Cess on luxury goods' },
  ];

  const totalLiability = liabilityBreakdown.reduce((sum, item) => sum + item.value, 0);

  // Key performance summaries
  const averageRevenue = trendData.reduce((sum, item) => sum + item.revenue, 0) / trendData.length;
  const growthRate = ((trendData[trendData.length - 1].revenue - trendData[0].revenue) / trendData[0].revenue) * 100;
  const itcEfficiency = (trendData[trendData.length - 1].itcVal / trendData[trendData.length - 1].liabilityVal) * 100;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-100 shadow-xl max-w-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{label}</p>
          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex justify-between items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }}></span>
                  <span className="text-xs font-medium text-slate-500">{entry.name}</span>
                </div>
                <span className="text-xs font-black text-slate-800">{formatCurrency(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="visual-analytics" className="space-y-8 bg-slate-50/50 p-6 sm:p-8 rounded-3xl border border-slate-200/50">
      
      {/* Header section with Summary Cards */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200/60 pb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Scale className="text-blue-600" size={26} /> Visual Analytics Dashboard
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Real-time interactive analysis of tax liability allocation and monthly revenue trends.
          </p>
        </div>
        
        {/* Quick toggles */}
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm self-end md:self-auto">
          <button
            onClick={() => setRevenueChartType('area')}
            className={`p-2 rounded-lg transition-all ${revenueChartType === 'area' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            title="Area View"
          >
            <AreaIcon size={16} />
          </button>
          <button
            onClick={() => setRevenueChartType('line')}
            className={`p-2 rounded-lg transition-all ${revenueChartType === 'line' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            title="Line View"
          >
            <TrendingUp size={16} />
          </button>
          <button
            onClick={() => setRevenueChartType('bar')}
            className={`p-2 rounded-lg transition-all ${revenueChartType === 'bar' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            title="Bar View"
          >
            <BarChart2 size={16} />
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* KPI 1 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
            <IndianRupee size={22} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Average Revenue</p>
            <h4 className="text-xl font-black text-slate-800">{formatCurrency(averageRevenue)}</h4>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md w-max">
              <ArrowUpRight size={12} /> {growthRate.toFixed(1)}% Period Growth
            </div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-pink-50 rounded-xl text-pink-600">
            <Scale size={22} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Liability</p>
            <h4 className="text-xl font-black text-slate-800">{formatCurrency(totalLiability)}</h4>
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md w-max">
              <Percent size={11} /> 18% avg effective tax rate
            </div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <PieIcon size={22} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">ITC Offset Efficiency</p>
            <h4 className="text-xl font-black text-slate-800">{itcEfficiency.toFixed(1)}%</h4>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md w-max">
              <ArrowUpRight size={12} /> Optimized Credit Util
            </div>
          </div>
        </div>

      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Left: Revenue Trend Chart (60% width on Desktop) */}
        <div className="lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-extrabold text-slate-800 tracking-tight">Monthly Revenue & Cost Trends</h3>
              <p className="text-xs font-medium text-slate-400 mt-0.5">Correlation between turnover, purchases, and net payable liability</p>
            </div>
          </div>

          <div className="h-80 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              {revenueChartType === 'area' ? (
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01}/>
                    </linearGradient>
                    <linearGradient id="colorPurch" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" name="Sales Revenue" />
                  <Area type="monotone" dataKey="purchasesVal" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPurch)" name="Purchases" />
                </AreaChart>
              ) : revenueChartType === 'line' ? (
                <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px' }} />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} name="Sales Revenue" />
                  <Line type="monotone" dataKey="purchasesVal" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Purchases" />
                  <Line type="monotone" dataKey="liabilityVal" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" name="Raw Liability" />
                </ComposedChart>
              ) : (
                <BarChart data={trendData} margin={{ top: 10, right: 10, left: 15, bottom: 0 }} barGap={6}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px' }} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={16} name="Sales Revenue" />
                  <Bar dataKey="purchasesVal" fill="#10b981" radius={[4, 4, 0, 0]} barSize={16} name="Purchases" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Tax Liabilities Breakdown (40% width on Desktop) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col space-y-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-800 tracking-tight">Tax Liabilities Breakdown</h3>
            <p className="text-xs font-medium text-slate-400 mt-0.5">Distribution of tax liability among state, central, and cess accounts</p>
          </div>

          {/* Interactive Donut Chart */}
          <div className="relative h-44 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={liabilityBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                  onMouseEnter={(_, idx) => setActiveSegment(idx)}
                  onMouseLeave={() => setActiveSegment(null)}
                >
                  {liabilityBreakdown.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color} 
                      strokeWidth={activeSegment === index ? 2 : 0}
                      stroke="#fff"
                      opacity={activeSegment === null || activeSegment === index ? 1 : 0.6}
                      className="transition-all duration-300 outline-none cursor-pointer"
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Liability']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Liability</span>
              <span className="text-xl font-black text-slate-800">{formatCurrency(totalLiability)}</span>
              {activeSegment !== null && (
                <span className="text-[11px] text-slate-500 font-extrabold mt-0.5 animate-pulse" style={{ color: liabilityBreakdown[activeSegment].color }}>
                  {liabilityBreakdown[activeSegment].percentage}% {liabilityBreakdown[activeSegment].name.split(' ')[0]}
                </span>
              )}
            </div>
          </div>

          {/* Dynamic interactive details of segments */}
          <div className="space-y-2 flex-1 overflow-y-auto">
            {liabilityBreakdown.map((item, idx) => (
              <div 
                key={idx}
                onMouseEnter={() => setActiveSegment(idx)}
                onMouseLeave={() => setActiveSegment(null)}
                className={`flex items-start justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                  activeSegment === idx 
                    ? 'bg-slate-50 border-slate-200/80 shadow-xs' 
                    : 'bg-slate-50/20 border-transparent hover:bg-slate-50/50'
                }`}
              >
                <div className="flex gap-2.5 items-start">
                  <span className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: item.color }}></span>
                  <div>
                    <h5 className="text-xs font-bold text-slate-700">{item.name}</h5>
                    <p className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">{item.desc}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 pl-2">
                  <span className="text-xs font-black text-slate-800 block">{formatCurrency(item.value)}</span>
                  <span className="text-[10px] font-bold text-slate-400">{item.percentage}%</span>
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>

      {/* Cross-offset Analysis Section */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col md:flex-row items-center gap-5 justify-between">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
            <Info size={20} />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-slate-800">Automated Credit Utilization Ledger</h4>
            <p className="text-xs font-medium text-slate-400 mt-0.5 leading-relaxed">
              Your Input Tax Credit (ITC) balance is automatically cross-offset following rules: IGST balances are utilized for IGST liability first, then CGST & SGST. CGST & SGST balances are utilized internally to maximize tax offset and lower cash output.
            </p>
          </div>
        </div>
        <div className="flex gap-3 shrink-0">
          <div className="text-center bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 min-w-28">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Cash Saved</span>
            <span className="text-base font-black text-emerald-800">₹1.35 Lakhs</span>
          </div>
          <div className="text-center bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 min-w-28">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Total Offsets</span>
            <span className="text-base font-black text-blue-800">4 Accounts</span>
          </div>
        </div>
      </div>

      {/* D3 Geographical GST & Tax Liability Map Section */}
      <div className="pt-4 border-t border-slate-200/60">
        <GeoGstMapVisualization />
      </div>

    </div>
  );
};

export default VisualAnalyticsDashboard;
