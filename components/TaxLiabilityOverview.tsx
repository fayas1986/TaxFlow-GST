import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, PieChart, Pie, Cell, RadialBarChart, RadialBar 
} from 'recharts';
import { 
  Info, TrendingUp, DollarSign, Award, ShieldAlert, Percent, 
  Layers, BarChart3, PieChart as PieIcon, RefreshCw, IndianRupee 
} from 'lucide-react';
import { TaxComputationSummary } from '../types';

interface TaxLiabilityOverviewProps {
  data: TaxComputationSummary;
  period: string;
}

export const TaxLiabilityOverview: React.FC<TaxLiabilityOverviewProps> = ({ data, period }) => {
  const [activeChartTab, setActiveChartTab] = useState<'COMPARISON' | 'DONUT' | 'NET_PAYABLE'>('COMPARISON');

  const { outputLiability, inputTaxCredit, rcmLiability, netPayable } = data;

  // 1. Structure data for Side-by-Side Comparison (IGST, CGST, SGST, UTGST)
  const comparisonData = [
    {
      name: 'IGST',
      'Output Liability': outputLiability.igst + rcmLiability.igst,
      'Input Tax Credit': inputTaxCredit.igst,
      'Net Payable': netPayable.igst,
    },
    {
      name: 'CGST',
      'Output Liability': outputLiability.cgst + rcmLiability.cgst,
      'Input Tax Credit': inputTaxCredit.cgst,
      'Net Payable': netPayable.cgst,
    },
    {
      name: 'SGST',
      'Output Liability': outputLiability.sgst + rcmLiability.sgst,
      'Input Tax Credit': inputTaxCredit.sgst,
      'Net Payable': netPayable.sgst,
    },
    {
      name: 'UTGST/Cess',
      'Output Liability': outputLiability.utgst + rcmLiability.utgst + outputLiability.cess + rcmLiability.cess,
      'Input Tax Credit': inputTaxCredit.utgst + inputTaxCredit.cess,
      'Net Payable': netPayable.utgst + netPayable.cess,
    }
  ];

  // 2. Structure data for Donut Chart (Output Liability Composition)
  const totalOutput = 
    (outputLiability.igst + rcmLiability.igst) + 
    (outputLiability.cgst + rcmLiability.cgst) + 
    (outputLiability.sgst + rcmLiability.sgst) + 
    (outputLiability.utgst + rcmLiability.utgst + outputLiability.cess + rcmLiability.cess);

  const donutData = [
    { name: 'IGST (Inter-State)', value: outputLiability.igst + rcmLiability.igst, color: '#3b82f6' }, // Blue
    { name: 'CGST (Central)', value: outputLiability.cgst + rcmLiability.cgst, color: '#f59e0b' }, // Amber
    { name: 'SGST (State)', value: outputLiability.sgst + rcmLiability.sgst, color: '#10b981' }, // Emerald
    { name: 'UTGST & Cess', value: outputLiability.utgst + rcmLiability.utgst + outputLiability.cess + rcmLiability.cess, color: '#8b5cf6' }, // Purple
  ].filter(item => item.value > 0);

  // 3. Structure data for Net Payable Analysis
  const netPayableData = [
    { name: 'IGST', value: netPayable.igst, color: '#2563eb' },
    { name: 'CGST', value: netPayable.cgst, color: '#d97706' },
    { name: 'SGST', value: netPayable.sgst, color: '#059669' },
    { name: 'UTGST/Cess', value: netPayable.utgst + netPayable.cess, color: '#7c3aed' },
  ];

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  // Custom tooltips to present clean figures
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 shadow-xl text-xs space-y-1.5 font-sans">
          <p className="font-extrabold text-slate-300 uppercase tracking-wide border-b border-slate-800 pb-1 mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }}></span>
                {entry.name}:
              </span>
              <span className="font-mono font-bold text-white">{formatCurrency(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div id="tax-liability-overview" className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      
      {/* Component Header with Controls */}
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Tax Liability Overview</h3>
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full font-bold text-[10px] tracking-wide uppercase">
              {period}
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Granular breakdown of output tax liabilities, adjusted inputs (ITC), and final cash ledger offsets.
          </p>
        </div>

        {/* Chart view selectors */}
        <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 text-xs font-bold border border-slate-200/40">
          <button
            onClick={() => setActiveChartTab('COMPARISON')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeChartTab === 'COMPARISON'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 size={13} />
            Comparison
          </button>
          <button
            onClick={() => setActiveChartTab('DONUT')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeChartTab === 'DONUT'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <PieIcon size={13} />
            Composition
          </button>
          <button
            onClick={() => setActiveChartTab('NET_PAYABLE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeChartTab === 'NET_PAYABLE'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <IndianRupee size={13} />
            Net Payable
          </button>
        </div>
      </div>

      {/* Main Graph Content Area */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart Canvas */}
        <div className="lg:col-span-2 bg-slate-50/50 rounded-2xl border border-slate-100 p-4 h-[320px] flex items-center justify-center relative">
          
          {activeChartTab === 'COMPARISON' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={comparisonData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#64748b" 
                  fontSize={11} 
                  fontWeight={600}
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10} 
                  fontWeight={500}
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(v) => `₹${v >= 100000 ? (v / 100000).toFixed(1) + 'L' : v}`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  iconType="circle" 
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', fontWeight: 600, color: '#475569' }} 
                />
                <Bar dataKey="Output Liability" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={30} />
                <Bar dataKey="Input Tax Credit" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                <Bar dataKey="Net Payable" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {activeChartTab === 'DONUT' && (
            <div className="w-full h-full flex flex-col sm:flex-row items-center justify-center gap-6">
              <div className="w-48 h-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [formatCurrency(value), 'Liability']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="space-y-2 flex-1 max-w-xs text-xs">
                <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Liability Share</p>
                <div className="space-y-1.5">
                  {donutData.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                        <span className="font-semibold text-slate-700">{item.name.split(' ')[0]}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-extrabold text-slate-900 block">{formatCurrency(item.value)}</span>
                        <span className="text-[9px] text-slate-400 font-bold block">
                          {((item.value / totalOutput) * 100).toFixed(1)}% of total
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeChartTab === 'NET_PAYABLE' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={netPayableData}
                margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#64748b" 
                  fontSize={11} 
                  fontWeight={600}
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10} 
                  fontWeight={500}
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(v) => `₹${v}`}
                />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Net Cash Outflow']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                />
                <Bar 
                  dataKey="value" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={45}
                >
                  {netPayableData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

        </div>

        {/* Summary side bar metrics */}
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-4">
            <h4 className="font-black text-slate-800 text-xs flex items-center gap-1.5">
              <Info size={14} className="text-blue-500" />
              Quick Statistics
            </h4>

            {/* Metric Row 1: Total Output */}
            <div className="flex items-center justify-between py-2.5 border-b border-slate-200/60">
              <div className="space-y-0.5">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Gross Output Tax</span>
                <span className="text-slate-700 font-semibold block text-xs">Total liability calculated</span>
              </div>
              <span className="font-mono font-black text-slate-900 text-sm">
                {formatCurrency(totalOutput)}
              </span>
            </div>

            {/* Metric Row 2: Eligible ITC */}
            <div className="flex items-center justify-between py-2.5 border-b border-slate-200/60">
              <div className="space-y-0.5">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Eligible Input Credit</span>
                <span className="text-slate-700 font-semibold block text-xs">Available for set-off</span>
              </div>
              <span className="font-mono font-black text-emerald-600 text-sm">
                {formatCurrency(inputTaxCredit.igst + inputTaxCredit.cgst + inputTaxCredit.sgst + inputTaxCredit.utgst)}
              </span>
            </div>

            {/* Metric Row 3: Net Cash Outflow */}
            <div className="flex items-center justify-between py-2.5">
              <div className="space-y-0.5">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Net Cash Payable</span>
                <span className="text-slate-700 font-semibold block text-xs">Estimated ledger balance</span>
              </div>
              <span className="font-mono font-black text-amber-600 text-sm">
                {formatCurrency(netPayable.igst + netPayable.cgst + netPayable.sgst + netPayable.utgst + netPayable.cess)}
              </span>
            </div>
          </div>

          {/* Warning / Advisory box */}
          <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-2xl text-blue-900 text-[11px] leading-relaxed flex items-start gap-2.5">
            <ShieldAlert size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-blue-950 block mb-0.5">Automated Set-Off Validation</span>
              These computations adhere to Chapter IX of the CGST Act. The IGST balance is exhaustively utilized before allocating CGST and SGST pools.
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default TaxLiabilityOverview;
