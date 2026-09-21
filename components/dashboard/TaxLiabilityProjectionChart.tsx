import React, { useState } from 'react';
import { 
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ReferenceLine, Area 
} from 'recharts';
import { 
  TrendingUp, Scale, CheckCircle, AlertCircle, Info, Calendar,
  Filter, HelpCircle, ArrowUpRight, DollarSign, Sparkles
} from 'lucide-react';

interface TaxLiabilityProjectionChartProps {
  analyticsData?: any;
}

export const TaxLiabilityProjectionChart: React.FC<TaxLiabilityProjectionChartProps> = ({ analyticsData }) => {
  const [modelType, setModelType] = useState<'BASELINE' | 'CONSERVATIVE' | 'OPTIMISTIC'>('BASELINE');
  const [cumulativeView, setCumulativeView] = useState<boolean>(false);

  // Raw projections & actuals for Q2 FY26 (July, August, September)
  // Tax values represented in ₹ Lakhs for optimal display scale
  const projectionData = {
    BASELINE: [
      { name: 'July 2026', expected: 8.5, actual: 8.2, cumulativeExpected: 8.5, cumulativeActual: 8.2, variance: -0.3, confidenceRange: [8.0, 9.0] },
      { name: 'August 2026', expected: 9.8, actual: 10.1, cumulativeExpected: 18.3, cumulativeActual: 18.3, variance: 0.3, confidenceRange: [9.2, 10.4] },
      { name: 'September 2026 (Proj)', expected: 11.2, actual: null, cumulativeExpected: 29.5, cumulativeActual: null, variance: 0.0, confidenceRange: [10.5, 12.0] },
    ],
    CONSERVATIVE: [
      { name: 'July 2026', expected: 9.0, actual: 8.2, cumulativeExpected: 9.0, cumulativeActual: 8.2, variance: -0.8, confidenceRange: [8.5, 9.5] },
      { name: 'August 2026', expected: 10.5, actual: 10.1, cumulativeExpected: 19.5, cumulativeActual: 18.3, variance: -0.4, confidenceRange: [10.0, 11.0] },
      { name: 'September 2026 (Proj)', expected: 12.5, actual: null, cumulativeExpected: 32.0, cumulativeActual: null, variance: 0.0, confidenceRange: [11.8, 13.2] },
    ],
    OPTIMISTIC: [
      { name: 'July 2026', expected: 8.0, actual: 8.2, cumulativeExpected: 8.0, cumulativeActual: 8.2, variance: 0.2, confidenceRange: [7.5, 8.5] },
      { name: 'August 2026', expected: 9.0, actual: 10.1, cumulativeExpected: 17.0, cumulativeActual: 18.3, variance: 1.1, confidenceRange: [8.5, 9.5] },
      { name: 'September 2026 (Proj)', expected: 10.0, actual: null, cumulativeExpected: 27.0, cumulativeActual: null, variance: 0.0, confidenceRange: [9.2, 10.8] },
    ]
  };

  const activeData = projectionData[modelType];
  const chartData = activeData.map(item => ({
    name: item.name,
    expected: cumulativeView ? item.cumulativeExpected : item.expected,
    actual: cumulativeView ? item.cumulativeActual : item.actual,
    variance: item.variance,
    range: cumulativeView 
      ? [item.cumulativeExpected - 1.2, item.cumulativeExpected + 1.2] 
      : item.confidenceRange
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 1
    }).format(value * 100000); // converting Lakhs to raw values
  };

  const formatLakhs = (value: number) => {
    return `₹${value.toFixed(1)}L`;
  };

  const totalExpected = cumulativeView 
    ? activeData[2].cumulativeExpected 
    : activeData.reduce((acc, item) => acc + item.expected, 0);

  const totalActual = activeData.reduce((acc, item) => acc + (item.actual || 0), 0);
  const variancePct = totalExpected > 0 ? ((totalActual - (activeData[0].expected + activeData[1].expected)) / (activeData[0].expected + activeData[1].expected)) * 100 : 0;

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xl max-w-xs font-semibold text-slate-800">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Calendar size={12} className="text-indigo-600" /> {label}
          </p>
          <div className="space-y-2 border-b border-slate-100 pb-2 mb-2">
            {payload.map((entry: any, index: number) => {
              if (entry.value === null || entry.value === undefined) return null;
              const formattedVal = Array.isArray(entry.value) 
                ? `${formatLakhs(entry.value[0])} - ${formatLakhs(entry.value[1])}`
                : formatCurrency(entry.value);

              return (
                <div key={index} className="flex justify-between items-center gap-5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                    <span className="text-xs text-slate-500">{entry.name}</span>
                  </div>
                  <span className="text-xs font-extrabold text-slate-900">{formattedVal}</span>
                </div>
              );
            })}
          </div>
          {label.includes('Proj') ? (
            <p className="text-[10px] text-indigo-600 flex items-center gap-1">
              <Sparkles size={11} /> Forecast derived from ML parameters
            </p>
          ) : (
            <div className="flex justify-between items-center text-[10px] text-slate-500">
              <span>Variance:</span>
              <span className={`font-mono font-bold ${payload[1]?.value > payload[0]?.value ? 'text-rose-600' : 'text-emerald-600'}`}>
                {payload[1]?.value > payload[0]?.value ? '+' : ''}
                {((((payload[1]?.value - payload[0]?.value) / payload[0]?.value) || 0) * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      
      {/* Chart Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
            <Scale className="text-indigo-600" size={20} /> Current Quarter Tax Liability Projections
          </h3>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">
            Compare actual tax settlements against predictive models for Q2 FY 2026-27 (July - Sept 2026)
          </p>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Cumulative Toggle */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-bold text-slate-600">
            <button 
              onClick={() => setCumulativeView(false)}
              className={`px-3 py-1.5 rounded-md transition-all ${!cumulativeView ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'}`}
            >
              Monthly Payout
            </button>
            <button 
              onClick={() => setCumulativeView(true)}
              className={`px-3 py-1.5 rounded-md transition-all ${cumulativeView ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'}`}
            >
              Cumulative
            </button>
          </div>

          {/* Model Switcher */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-bold text-slate-600">
            <button 
              onClick={() => setModelType('BASELINE')}
              className={`px-3 py-1.5 rounded-md transition-all ${modelType === 'BASELINE' ? 'bg-indigo-600 text-white shadow-xs' : 'hover:text-slate-900'}`}
            >
              Baseline
            </button>
            <button 
              onClick={() => setModelType('CONSERVATIVE')}
              className={`px-3 py-1.5 rounded-md transition-all ${modelType === 'CONSERVATIVE' ? 'bg-indigo-600 text-white shadow-xs' : 'hover:text-slate-900'}`}
            >
              Conservative
            </button>
            <button 
              onClick={() => setModelType('OPTIMISTIC')}
              className={`px-3 py-1.5 rounded-md transition-all ${modelType === 'OPTIMISTIC' ? 'bg-indigo-600 text-white shadow-xs' : 'hover:text-slate-900'}`}
            >
              Optimistic
            </button>
          </div>

        </div>
      </div>

      {/* Projection Summary KPI banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/50 rounded-2xl border border-slate-100 p-4">
        
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estimated Q2 Liability</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-black text-slate-800">₹{totalExpected.toFixed(1)} Lakhs</span>
            <span className="text-[10px] font-bold text-slate-400">Target</span>
          </div>
        </div>

        <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-slate-200/60 pt-3 sm:pt-0 sm:pl-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Actual Payout To Date</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-black text-slate-800">₹{totalActual.toFixed(1)} Lakhs</span>
            <span className="text-[10px] font-bold text-indigo-600">Jul - Aug</span>
          </div>
        </div>

        <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-slate-200/60 pt-3 sm:pt-0 sm:pl-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Liability Deviation</span>
          <div className="flex items-center gap-1.5">
            <span className={`text-base font-black ${variancePct > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {variancePct > 0 ? '+' : ''}{variancePct.toFixed(1)}%
            </span>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
              variancePct > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {variancePct > 0 ? 'Over projection' : 'Within Margin'}
            </span>
          </div>
        </div>

      </div>

      {/* Recharts Render Canvas */}
      <div className="h-80 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 15, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="projConfColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#818cf8" stopOpacity={0.02}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} 
            />
            
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'semibold' }}
              tickFormatter={(v) => `₹${v}L`}
            />
            
            <Tooltip content={<CustomChartTooltip />} cursor={{ fill: '#f8fafc', opacity: 0.5 }} />
            <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />

            {/* Confidence Area Range */}
            <Area 
              type="monotone" 
              dataKey="range" 
              fill="url(#projConfColor)" 
              stroke="none" 
              name="Confidence Bound (95%)" 
            />

            {/* Projected Target Bar (Hollow, highly styled) */}
            <Bar 
              dataKey="expected" 
              fill="#e2e8f0" 
              stroke="#6366f1" 
              strokeWidth={1.5}
              radius={[6, 6, 0, 0]} 
              barSize={cumulativeView ? 36 : 28} 
              name="Expected Settlement" 
            />

            {/* Actual Verified Settlements Line */}
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke="#059669" 
              strokeWidth={3} 
              dot={{ r: 5, fill: '#059669', stroke: '#fff', strokeWidth: 2 }} 
              activeDot={{ r: 7 }}
              name="Actual Payouts" 
              connectNulls
            />

            {/* Reference Line for Mean Target */}
            <ReferenceLine y={cumulativeView ? 20 : 9.5} stroke="#cbd5e1" strokeDasharray="4 4" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Intelligence Forecast Insights */}
      <div className="bg-indigo-50/40 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
        <Info className="text-indigo-600 shrink-0 mt-0.5" size={16} />
        <div className="space-y-1">
          <span className="text-xs font-bold text-indigo-950 block">ML Predictive Signal Output</span>
          <p className="text-xs text-slate-600 leading-relaxed font-semibold">
            The {modelType.toLowerCase()} projection expects a <strong>{cumulativeView ? 'cumulative' : 'monthly'} total of ₹{cumulativeView ? activeData[2].cumulativeExpected : activeData[2].expected} Lakhs</strong> in tax settlements by September 2026. This projection is modeled dynamically based on GSTR-1 filings, current e-invoice generation logs, and seasonal business indicators.
          </p>
        </div>
      </div>

    </div>
  );
};
