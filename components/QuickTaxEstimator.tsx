import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, IndianRupee, Info, TrendingUp, ArrowRight, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspaceSync } from './WorkspaceSyncContext';

const QuickTaxEstimator: React.FC = () => {
  const { registerDraftField, restoreFormInputs } = useWorkspaceSync();
  const savedEstimator = restoreFormInputs['quick-tax-estimator'] || {};

  const [revenue, setRevenue] = useState<number>(() => {
    return savedEstimator.revenue !== undefined ? savedEstimator.revenue : 0;
  });
  const [expenses, setExpenses] = useState<number>(() => {
    return savedEstimator.expenses !== undefined ? savedEstimator.expenses : 0;
  });
  const [taxRate, setTaxRate] = useState<number>(() => {
    return savedEstimator.taxRate !== undefined ? savedEstimator.taxRate : 18;
  });
  
  const forecast = useMemo(() => {
    const outputTax = revenue * (taxRate / 100);
    const inputTaxCredit = expenses * (taxRate / 100); // Simplified assumption that expenses have same tax rate
    const netLiability = Math.max(0, outputTax - inputTaxCredit);
    const margin = revenue - expenses - netLiability;
    
    return {
      outputTax,
      inputTaxCredit,
      netLiability,
      margin
    };
  }, [revenue, expenses, taxRate]);

  const taxRates = [5, 12, 18, 28];

  return (
    <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 flex flex-col relative overflow-hidden h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
          <Calculator size={20} />
        </div>
        <div>
          <h3 className="font-bold text-lg text-slate-900">Quick Tax Estimator</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Forecast Monthly Liability</p>
        </div>
      </div>

      <div className="space-y-5 flex-1">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Projected Revenue</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₹</span>
              <input 
                type="number" 
                value={revenue || ''} 
                onChange={(e) => setRevenue(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full h-10 pl-7 pr-3 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Projected Expenses</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₹</span>
              <input 
                type="number" 
                value={expenses || ''} 
                onChange={(e) => setExpenses(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full h-10 pl-7 pr-3 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">GST Slab (%)</label>
          <div className="flex gap-2">
            {taxRates.map((rate) => (
              <button
                key={rate}
                onClick={() => setTaxRate(rate)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all border ${
                  taxRate === rate 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100 scale-105' 
                  : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200'
                }`}
              >
                {rate}%
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl p-5 mt-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Zap size={48} className="text-white" />
          </div>
          
          <div className="space-y-4 relative z-10">
            <div className="flex justify-between items-end border-b border-white/10 pb-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Est. Liability</p>
                <h4 className="text-2xl font-black text-indigo-400">₹{forecast.netLiability.toLocaleString('en-IN')}</h4>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Output Tax</p>
                <p className="text-xs font-bold text-white">₹{forecast.outputTax.toLocaleString('en-IN')}</p>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-emerald-500/20 text-emerald-400 rounded">
                  <TrendingUp size={12} />
                </div>
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">Est. Net Margin</span>
              </div>
              <span className="text-sm font-black text-emerald-400">₹{forecast.margin.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 p-3 bg-indigo-50 rounded-xl border border-indigo-100 flex items-start gap-3">
        <Info size={14} className="text-indigo-600 shrink-0 mt-0.5" />
        <p className="text-[10px] text-indigo-700 leading-relaxed font-medium">
          Estimates assume all expenses are GST-eligible and fall under the same selected tax bracket. Actual ITC may vary based on blocked credit rules.
        </p>
      </div>
    </div>
  );
};

export default QuickTaxEstimator;
