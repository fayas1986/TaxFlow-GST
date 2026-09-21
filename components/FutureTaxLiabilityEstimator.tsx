import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, Cell
} from 'recharts';
import { 
  Calculator, Sparkles, TrendingUp, TrendingDown,
  ShieldAlert, DollarSign, Activity, FileText, ArrowRight,
  Target, Info, AlertTriangle, Layers
} from 'lucide-react';

interface FutureTaxLiabilityEstimatorProps {
  tenantId: string;
}

export const FutureTaxLiabilityEstimator: React.FC<FutureTaxLiabilityEstimatorProps> = ({ tenantId }) => {
  // Quarterly Simulation Inputs
  const [projectedSales, setProjectedSales] = useState<number>(15000000);
  const [averageSalesRate, setAverageSalesRate] = useState<number>(18); // 18% default
  
  const [projectedExpenses, setProjectedExpenses] = useState<number>(8500000);
  const [averageExpenseRate, setAverageExpenseRate] = useState<number>(18);
  const [itcEligibilityPercent, setItcEligibilityPercent] = useState<number>(90); // 10% blocked/unmatched
  
  const [openingItcBalance, setOpeningItcBalance] = useState<number>(250000);
  
  const [rcmPurchases, setRcmPurchases] = useState<number>(500000); // 18% standard for RCM
  
  // Computations
  const simulation = useMemo(() => {
    // 1. Output Liability Calculation
    const grossOutputTax = Math.round(projectedSales * (averageSalesRate / 100));
    
    // 2. RCM Liability (Payable in Cash)
    const rcmLiability = Math.round(rcmPurchases * 0.18);
    
    // Total Output Tax (including RCM)
    const totalOutputLiability = grossOutputTax + rcmLiability;

    // 3. ITC Calculation
    const grossInputTax = Math.round(projectedExpenses * (averageExpenseRate / 100));
    // Calculate eligible ITC based on eligibility percentage (factors in 17(5) and 2B mismatches)
    const eligiblePurchasesItc = Math.round(grossInputTax * (itcEligibilityPercent / 100));
    // RCM paid in cash becomes eligible ITC
    const totalEligibleItc = eligiblePurchasesItc + rcmLiability + openingItcBalance;

    // 4. Net Outgo (Cash Liability)
    // Regular tax outgo (Output Tax - Total Eligible ITC)
    const netRegularTaxOutgo = Math.max(0, grossOutputTax - totalEligibleItc);
    
    // Total Cash Outgo = Net Regular Tax + RCM (must be paid in cash)
    const totalCashOutgo = netRegularTaxOutgo + rcmLiability;
    
    // Remaining ITC Carry Forward
    const itcCarryForward = Math.max(0, totalEligibleItc - grossOutputTax);

    return {
      grossOutputTax,
      rcmLiability,
      totalOutputLiability,
      grossInputTax,
      eligiblePurchasesItc,
      totalEligibleItc,
      netRegularTaxOutgo,
      totalCashOutgo,
      itcCarryForward,
      blockedItc: grossInputTax - eligiblePurchasesItc
    };
  }, [projectedSales, averageSalesRate, projectedExpenses, averageExpenseRate, itcEligibilityPercent, openingItcBalance, rcmPurchases]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  // Chart Data Preparation
  const chartData = [
    {
      name: 'Gross Liability',
      Output: simulation.grossOutputTax,
      RCM: simulation.rcmLiability,
      ITC: 0,
      Cash: 0
    },
    {
      name: 'Input Tax Credit',
      Output: 0,
      RCM: 0,
      ITC: simulation.totalEligibleItc,
      Cash: 0
    },
    {
      name: 'Final Cash Outgo',
      Output: 0,
      RCM: 0,
      ITC: 0,
      Cash: simulation.totalCashOutgo
    }
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Calculator className="text-indigo-600" />
            What-If Quarterly Tax Estimator
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Input projected sales and expenses to estimate your GST cash outgo for the upcoming quarter.
          </p>
        </div>
        <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-xs font-bold border border-indigo-100 flex items-center gap-2">
          <Target size={14} /> Upcoming Quarter Projections
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Input Controls */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-5">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
              <TrendingUp className="text-emerald-600" size={16} /> Projected Revenue
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block">Estimated Quarterly Sales (₹)</label>
                <input 
                  type="number" 
                  value={projectedSales}
                  onChange={(e) => setProjectedSales(Number(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block">Average Output GST Rate (%)</label>
                <div className="flex gap-2">
                  {[5, 12, 18, 28].map(rate => (
                    <button
                      key={rate}
                      onClick={() => setAverageSalesRate(rate)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        averageSalesRate === rate 
                          ? 'bg-indigo-600 text-white border-indigo-600' 
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-5">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
              <TrendingDown className="text-rose-600" size={16} /> Projected Expenses & ITC
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block">Estimated Quarterly Expenses (₹)</label>
                <input 
                  type="number" 
                  value={projectedExpenses}
                  onChange={(e) => setProjectedExpenses(Number(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 flex justify-between">
                  <span>ITC Eligibility / Matching Rate</span>
                  <span className="text-indigo-600">{itcEligibilityPercent}%</span>
                </label>
                <input 
                  type="range" 
                  min="50" max="100" step="1"
                  value={itcEligibilityPercent}
                  onChange={(e) => setItcEligibilityPercent(Number(e.target.value))}
                  className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 mt-1">Factors in Sec 17(5) blocked credits and GSTR-2B vendor mismatches.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
              <Layers className="text-blue-600" size={16} /> Additional Parameters
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Opening ITC Balance (₹)</label>
                <input 
                  type="number" 
                  value={openingItcBalance}
                  onChange={(e) => setOpeningItcBalance(Number(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">RCM Purchases (₹)</label>
                <input 
                  type="number" 
                  value={rcmPurchases}
                  onChange={(e) => setRcmPurchases(Number(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Results & Visualization */}
        <div className="lg:col-span-7 flex flex-col space-y-6">
          
          {/* Top Result Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-rose-600 mb-1 flex items-center gap-1.5">
                <DollarSign size={14} /> Estimated Cash Outgo
              </h3>
              <p className="text-3xl font-black text-slate-900 tracking-tight">
                {formatCurrency(simulation.totalCashOutgo)}
              </p>
              <div className="mt-3 text-[10px] font-bold text-rose-700/80 space-y-1">
                <div className="flex justify-between">
                  <span>Regular GST Payable:</span>
                  <span>{formatCurrency(simulation.netRegularTaxOutgo)}</span>
                </div>
                <div className="flex justify-between">
                  <span>RCM Liability (Cash):</span>
                  <span>{formatCurrency(simulation.rcmLiability)}</span>
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-wider text-emerald-600 mb-1 flex items-center gap-1.5">
                  <ShieldAlert size={14} /> Total Eligible ITC
                </h3>
                <p className="text-3xl font-black text-slate-900 tracking-tight">
                  {formatCurrency(simulation.totalEligibleItc)}
                </p>
              </div>
              <div className="mt-3 text-[10px] font-bold text-emerald-700/80">
                {simulation.itcCarryForward > 0 ? (
                  <span className="flex items-center gap-1">
                    <ArrowRight size={12} /> C/F to Next Quarter: {formatCurrency(simulation.itcCarryForward)}
                  </span>
                ) : (
                  <span className="text-slate-500">ITC Fully Utilized</span>
                )}
              </div>
            </div>
          </div>

          {/* Graphical Visualization */}
          <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm min-h-[300px] flex flex-col">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-6">Liability vs. Credit Waterfall</h3>
            <div className="flex-1 w-full min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                    tickFormatter={(value) => `₹${(value / 100000).toFixed(1)}L`}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [formatCurrency(value), undefined]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 600, paddingTop: '15px' }} />
                  <Bar dataKey="Output" stackId="a" fill="#ef4444" radius={[0, 0, 4, 4]} name="Regular Output Tax" />
                  <Bar dataKey="RCM" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} name="RCM Liability" />
                  <Bar dataKey="ITC" fill="#10b981" radius={[4, 4, 0, 0]} name="Eligible ITC" />
                  <Bar dataKey="Cash" fill="#6366f1" radius={[4, 4, 0, 0]} name="Cash Outgo" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
