const fs = require('fs');

const code = `import React, { useState, useMemo } from 'react';
import { 
  LineChart, 
  TrendingUp, 
  Calendar,
  AlertTriangle,
  Download,
  Sliders,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

const mockForecastData = [
  { month: 'Apr 2026', actual: 420000, projected: 410000 },
  { month: 'May 2026', actual: 450000, projected: 430000 },
  { month: 'Jun 2026', actual: 480000, projected: 460000 },
  { month: 'Jul 2026', actual: 510000, projected: 500000 },
  { month: 'Aug 2026', actual: 490000, projected: 520000 },
  { month: 'Sep 2026', projected: 540000 },
  { month: 'Oct 2026', projected: 570000 },
  { month: 'Nov 2026', projected: 590000 },
  { month: 'Dec 2026', projected: 620000 },
  { month: 'Jan 2027', projected: 650000 },
  { month: 'Feb 2027', projected: 680000 },
  { month: 'Mar 2027', projected: 720000 }
];

const TaxForecastingPage: React.FC = () => {
  const [isSimulatorMode, setIsSimulatorMode] = useState(false);
  const [revenueAdjustment, setRevenueAdjustment] = useState(0); // Percentage -50 to +50

  const chartData = useMemo(() => {
    if (!isSimulatorMode || revenueAdjustment === 0) return mockForecastData;

    return mockForecastData.map(data => {
      // Apply the what-if adjustment to projected liability only
      const adjustmentFactor = 1 + (revenueAdjustment / 100);
      return {
        ...data,
        projected: Math.round(data.projected * adjustmentFactor)
      };
    });
  }, [isSimulatorMode, revenueAdjustment]);

  const projectedTotal = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.projected, 0);
  }, [chartData]);
  
  const originalProjectedTotal = useMemo(() => {
     return mockForecastData.reduce((sum, item) => sum + item.projected, 0);
  }, []);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <TrendingUp size={24} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tax Forecasting</h1>
          </div>
          <p className="text-slate-500 mt-1 ml-12">Projected vs Actual Tax Liabilities for FY 2026-27</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
            <Download size={16} /> Export Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center transition-all duration-300">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-2">
            <LineChart size={16} /> Projected FY Liability
            {isSimulatorMode && revenueAdjustment !== 0 && (
              <span className="ml-auto bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-bold">
                SIMULATED
              </span>
            )}
          </div>
          <div className="text-3xl font-bold text-slate-900">
            ₹ {(projectedTotal / 100000).toFixed(1)}M
          </div>
          <div className="text-sm font-medium text-emerald-600 mt-2 flex items-center gap-1">
             {isSimulatorMode && revenueAdjustment !== 0 ? (
               <>
                 <TrendingUp size={14} className={revenueAdjustment < 0 ? "rotate-180 text-amber-500" : ""} />
                 <span className={revenueAdjustment < 0 ? "text-amber-600" : ""}>
                   {revenueAdjustment > 0 ? "+" : ""}{((projectedTotal - originalProjectedTotal) / 100000).toFixed(1)}M variance
                 </span>
               </>
             ) : (
               <>
                 <TrendingUp size={14} /> +12.4% vs last FY
               </>
             )}
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-2">
            <Calendar size={16} /> Actual Paid (YTD)
          </div>
          <div className="text-3xl font-bold text-slate-900">₹ 23.5M</div>
          <div className="text-sm font-medium text-slate-500 mt-2">
            Apr 2026 - Aug 2026
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-2">
            <AlertTriangle size={16} /> Variance (YTD)
          </div>
          <div className="text-3xl font-bold text-amber-600">₹ 0.3M</div>
          <div className="text-sm font-medium text-slate-500 mt-2">
            Below projection by 1.3%
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 relative z-10 gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Liability Trend Analysis</h2>
            <p className="text-sm text-slate-500">Comparing projected tax outflow against actual payments</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
             <div className="flex items-center gap-2 mr-4">
               <span className="flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                 <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Actual
               </span>
               <span className="flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                 <span className="w-2 h-2 rounded-full bg-slate-300"></span> Projected
               </span>
             </div>
             
             <button 
               onClick={() => setIsSimulatorMode(!isSimulatorMode)}
               className={\`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all \${
                 isSimulatorMode 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
               }\`}
             >
               <Sliders size={16} /> What-If Simulator
             </button>
          </div>
        </div>

        <AnimatePresence>
          {isSimulatorMode && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-8 bg-indigo-50/50 border border-indigo-100 rounded-xl p-5 overflow-hidden"
            >
              <div className="flex flex-col md:flex-row gap-6 items-center">
                <div className="flex-1 w-full">
                  <div className="flex items-center justify-between mb-2">
                     <label className="text-sm font-bold text-slate-800">Projected Revenue Adjustment</label>
                     <span className={\`text-sm font-bold px-2 py-0.5 rounded \${
                       revenueAdjustment > 0 ? 'bg-emerald-100 text-emerald-700' : 
                       revenueAdjustment < 0 ? 'bg-amber-100 text-amber-700' : 
                       'bg-slate-200 text-slate-700'
                     }\`}>
                       {revenueAdjustment > 0 ? '+' : ''}{revenueAdjustment}%
                     </span>
                  </div>
                  <input 
                    type="range" 
                    min="-50" 
                    max="50" 
                    step="5"
                    value={revenueAdjustment}
                    onChange={(e) => setRevenueAdjustment(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-xs font-medium text-slate-500 mt-2">
                    <span>-50%</span>
                    <span>0%</span>
                    <span>+50%</span>
                  </div>
                </div>
                <div className="w-full md:w-auto p-4 bg-white rounded-lg border border-indigo-100 shadow-sm">
                   <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Simulated Variance</div>
                   <div className={\`text-xl font-bold \${
                     revenueAdjustment > 0 ? 'text-emerald-600' : 
                     revenueAdjustment < 0 ? 'text-amber-600' : 
                     'text-slate-700'
                   }\`}>
                     {revenueAdjustment === 0 ? '₹0' : (
                        \`\${revenueAdjustment > 0 ? '+' : ''}₹\${((projectedTotal - originalProjectedTotal) / 100000).toFixed(1)}M\`
                     )}
                   </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="h-[400px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isSimulatorMode && revenueAdjustment !== 0 ? "#8b5cf6" : "#94a3b8"} stopOpacity={0.2}/>
                  <stop offset="95%" stopColor={isSimulatorMode && revenueAdjustment !== 0 ? "#8b5cf6" : "#94a3b8"} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="month" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#64748b' }}
                dy={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickFormatter={(value) => \`₹\${(value / 100000).toFixed(1)}L\`}
                dx={-10}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => [\`₹\${value.toLocaleString()}\`, '']}
              />
              <Area 
                type="monotone" 
                dataKey="projected" 
                stroke={isSimulatorMode && revenueAdjustment !== 0 ? "#8b5cf6" : "#94a3b8"}
                strokeWidth={2}
                strokeDasharray="5 5"
                fillOpacity={1} 
                fill="url(#colorProjected)" 
                name={isSimulatorMode && revenueAdjustment !== 0 ? "Simulated Projection" : "Projected"}
                animationDuration={500}
              />
              <Area 
                type="monotone" 
                dataKey="actual" 
                stroke="#6366f1" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorActual)" 
                name="Actual"
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default TaxForecastingPage;
`;
fs.writeFileSync('pages/TaxForecastingPage.tsx', code);
console.log("UPDATED");
