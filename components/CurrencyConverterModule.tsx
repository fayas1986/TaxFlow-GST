import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Globe, ArrowRightLeft, Loader2, RefreshCw } from 'lucide-react';
import { fetchExchangeRates } from '../services/api';

import { Invoice } from '../types';

export const CurrencyConverterModule: React.FC<{ invoices?: Invoice[] }> = ({ invoices = [] }) => {
  const [baseAmount, setBaseAmount] = useState<number | ''>(1000);
  const [targetCurrency, setTargetCurrency] = useState('USD');
  const [isSwapped, setIsSwapped] = useState(false); // false: INR -> Foreign, true: Foreign -> INR

  const { data: ratesData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['exchangeRates'],
    queryFn: fetchExchangeRates,
  });

  const exchangeRates = ratesData?.rates || {};

  const currentExchangeRate = useMemo(() => {
    return exchangeRates[targetCurrency] || 1;
  }, [targetCurrency, exchangeRates]);

  const convertedAmount = useMemo(() => {
    if (baseAmount === '') return 0;
    if (isSwapped) {
      // Foreign -> INR
      return baseAmount * (1 / currentExchangeRate);
    } else {
      // INR -> Foreign
      return baseAmount * currentExchangeRate;
    }
  }, [baseAmount, currentExchangeRate, isSwapped]);

  return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
              <Globe size={18} />
            </div>
            <h3 className="font-bold text-slate-800">FX Currency Converter</h3>
          </div>
          <button 
             onClick={() => refetch()}
             disabled={isFetching}
             className="text-slate-400 hover:text-slate-600 transition-colors"
          >
             <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
        
        <div className="p-5 space-y-5">
          <p className="text-sm text-slate-500">Toggle between functional currency (INR) and foreign currencies for international transactions.</p>
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {!isSwapped ? 'Functional (INR)' : targetCurrency}
              </label>
              <div className="relative">
                <input 
                  type="number"
                  value={baseAmount}
                  onChange={(e) => setBaseAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full h-11 px-3 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <button 
               onClick={() => setIsSwapped(!isSwapped)}
               className="mt-5 p-2.5 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 hover:text-slate-700 transition-all shadow-sm"
            >
               <ArrowRightLeft size={16} />
            </button>

            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                   {isSwapped ? 'Functional (INR)' : 'Foreign Currency'}
                 </label>
                 {!isSwapped && (
                   <select 
                      value={targetCurrency}
                      onChange={(e) => setTargetCurrency(e.target.value)}
                      className="text-xs font-bold text-blue-600 bg-transparent outline-none cursor-pointer"
                   >
                     <option value="USD">USD ($)</option>
                     <option value="EUR">EUR (€)</option>
                     <option value="GBP">GBP (£)</option>
                     <option value="AED">AED (د.إ)</option>
                     <option value="SGD">SGD ($)</option>
                   </select>
                 )}
                 {isSwapped && (
                    <span className="text-xs font-bold text-blue-600">INR (₹)</span>
                 )}
              </div>
              <div className="relative">
                 {isSwapped && (
                   <select 
                      value={targetCurrency}
                      onChange={(e) => setTargetCurrency(e.target.value)}
                      className="absolute right-0 top-0 h-11 px-2 text-xs font-bold text-slate-600 bg-slate-50 border-l border-slate-200 rounded-r-lg outline-none cursor-pointer"
                   >
                     <option value="USD">USD</option>
                     <option value="EUR">EUR</option>
                     <option value="GBP">GBP</option>
                     <option value="AED">AED</option>
                     <option value="SGD">SGD</option>
                   </select>
                 )}
                <div className="w-full h-11 px-3 flex items-center bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 overflow-hidden">
                   {isLoading ? (
                      <Loader2 size={16} className="animate-spin text-slate-400" />
                   ) : (
                      <span className="truncate">
                        {isSwapped ? '₹' : ''}
                        {convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {!isSwapped && ` ${targetCurrency}`}
                      </span>
                   )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-100">
             <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-indigo-800">Real-time Rate</span>
                <span className="font-mono text-indigo-900 font-bold">
                   1 {targetCurrency} = ₹{(1 / currentExchangeRate).toFixed(3)}
                </span>
             </div>
             <div className="flex justify-between items-center text-[10px] text-indigo-500 mt-1.5 font-medium">
                <span>Auto-updated via API</span>
                <span>{new Date().toLocaleTimeString()}</span>
             </div>
          </div>

          {invoices.length > 0 && (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Foreign Currency Exposure</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {invoices.filter(inv => inv.currency && inv.currency !== 'INR' && inv.status !== 'PAID').map(inv => {
                  const rateToInr = exchangeRates[inv.currency!] || 1;
                  // If rateToInr is X, then 1 INR = X Foreign, so 1 Foreign = 1 / X INR
                  const inrValue = (inv.originalAmount || inv.amount) * (1 / rateToInr);
                  return (
                    <div key={inv.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">{inv.invoiceNumber}</span>
                        <span className="text-[10px] text-slate-500 font-medium">{inv.partyName}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-bold text-slate-900">{inv.currency} {(inv.originalAmount || inv.amount).toLocaleString()}</span>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 rounded mt-0.5">₹{inrValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  );
                })}
                {invoices.filter(inv => inv.currency && inv.currency !== 'INR' && inv.status !== 'PAID').length === 0 && (
                  <div className="text-xs text-slate-500 text-center py-2">No outstanding foreign currency invoices.</div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
  );
};
