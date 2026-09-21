import React, { useState, useEffect } from 'react';
import { 
  FileText, CalendarDays, CheckCircle2, ChevronRight, RefreshCw, 
  ArrowRight, ShieldCheck, Download, AlertTriangle, FileCheck, 
  Calculator, Upload, Play, Building, Info, TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Gstr9Wizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [financialYear, setFinancialYear] = useState('2025-2026');
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);

  // Mock Annual Data
  const annualData = {
    totalTurnover: 125000000,
    taxableTurnover: 110000000,
    totalOutputTax: 19800000,
    totalItcClaimed: 18200000,
    itcAsPer2A: 18450000,
    auditedTurnover: 125500000,
  };

  const steps = [
    { id: 1, title: 'Consolidation', desc: 'Auto-fetch monthly GSTR-1/3B' },
    { id: 2, title: 'GSTR-9 Tables', desc: 'Liability & ITC Recon (Table 4-8)' },
    { id: 3, title: 'GSTR-9C Audit', desc: 'Financials Reconciliation' },
    { id: 4, title: 'Filing & Export', desc: 'Generate JSON Payload' }
  ];

  const handleStartExtraction = () => {
    setIsProcessing(true);
    setExtractionProgress(0);
    
    const interval = setInterval(() => {
      setExtractionProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsProcessing(false);
          setCurrentStep(2);
          return 100;
        }
        return prev + 15;
      });
    }, 400);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-left animate-in fade-in slide-in-from-bottom-2 mt-6">
      
      {/* Wizard Header */}
      <div className="bg-slate-50 border-b border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <FileCheck className="text-indigo-600" />
            GSTR-9 & 9C Annual Returns Wizard
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Automated compilation of annual returns by extracting data from monthly filings and audited financials.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500 uppercase">Financial Year</label>
          <select 
            value={financialYear}
            onChange={(e) => setFinancialYear(e.target.value)}
            className="bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          >
            <option value="2024-2025">FY 2024-25</option>
            <option value="2025-2026">FY 2025-26</option>
          </select>
        </div>
      </div>

      {/* Stepper Navigation */}
      <div className="flex overflow-x-auto border-b border-slate-100">
        {steps.map((step, idx) => (
          <div 
            key={step.id} 
            className={`flex-1 min-w-[200px] flex items-center gap-3 p-4 border-b-2 transition-all ${
              currentStep === step.id 
                ? 'border-indigo-600 bg-indigo-50/30' 
                : currentStep > step.id 
                  ? 'border-emerald-500 cursor-pointer hover:bg-slate-50' 
                  : 'border-transparent opacity-50'
            }`}
            onClick={() => currentStep > step.id && setCurrentStep(step.id)}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
              currentStep > step.id ? 'bg-emerald-100 text-emerald-700' : 
              currentStep === step.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-200 text-slate-500'
            }`}>
              {currentStep > step.id ? <CheckCircle2 size={16} /> : step.id}
            </div>
            <div>
              <p className={`text-sm font-bold ${currentStep === step.id ? 'text-indigo-900' : 'text-slate-700'}`}>{step.title}</p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">{step.desc}</p>
            </div>
            {idx < steps.length - 1 && <ChevronRight className="ml-auto text-slate-300" size={16} />}
          </div>
        ))}
      </div>

      {/* Step Content Area */}
      <div className="p-6 md:p-8 bg-slate-50/50 min-h-[400px]">
        <AnimatePresence mode="wait">
          
          {/* STEP 1: Consolidation */}
          {currentStep === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-3xl mx-auto text-center space-y-6 pt-8"
            >
              <div className="w-24 h-24 mx-auto bg-indigo-100 rounded-full flex items-center justify-center shadow-inner">
                <RefreshCw size={48} className={`text-indigo-600 ${isProcessing ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Consolidate Monthly Data</h3>
                <p className="text-slate-500 font-medium mt-2 max-w-lg mx-auto">
                  TaxFlow will automatically aggregate all filed GSTR-1, GSTR-3B, and GSTR-2A/2B records for {financialYear} to pre-fill your GSTR-9.
                </p>
              </div>

              {isProcessing ? (
                <div className="w-full max-w-md mx-auto space-y-2 mt-8">
                  <div className="flex justify-between text-xs font-bold text-slate-600">
                    <span>Extracting 12 months of filings...</span>
                    <span>{Math.min(100, extractionProgress)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
                    <div 
                      className="bg-indigo-600 h-3 rounded-full transition-all duration-300 ease-out" 
                      style={{ width: `${Math.min(100, extractionProgress)}%` }}
                    ></div>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={handleStartExtraction}
                  className="mt-8 inline-flex items-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 transition-all hover:scale-105"
                >
                  <Play size={18} fill="currentColor" /> Start Auto-Compilation
                </button>
              )}
            </motion.div>
          )}

          {/* STEP 2: GSTR-9 Tables */}
          {currentStep === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-black text-slate-800">Auto-Drafted GSTR-9 Summary</h3>
                  <p className="text-sm text-slate-500">Based on consolidated GSTR-1 and GSTR-3B data.</p>
                </div>
                <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 size={14} /> 12/12 Months Synced
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                  <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">Outward Supplies (Table 4)</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm font-bold text-slate-700">Taxable Value</span>
                      <span className="font-mono text-sm font-black">{formatCurrency(annualData.taxableTurnover)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm font-bold text-slate-700">Total Output Tax</span>
                      <span className="font-mono text-sm font-black text-rose-600">{formatCurrency(annualData.totalOutputTax)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                  <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">ITC Reconciliation (Table 8)</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm font-bold text-slate-700">ITC Claimed (3B)</span>
                      <span className="font-mono text-sm font-black">{formatCurrency(annualData.totalItcClaimed)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-indigo-100">
                      <span className="text-sm font-bold text-slate-700 flex items-center gap-1"><ShieldCheck size={14} className="text-emerald-500"/> ITC as per 2A</span>
                      <span className="font-mono text-sm font-black text-emerald-600">{formatCurrency(annualData.itcAsPer2A)}</span>
                    </div>
                  </div>
                  <div className="pt-2 text-[10px] font-bold text-emerald-600 flex items-center gap-1 justify-end">
                    <TrendingUp size={12}/> Net Unclaimed ITC: {formatCurrency(annualData.itcAsPer2A - annualData.totalItcClaimed)}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button 
                  onClick={() => setCurrentStep(3)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition-all"
                >
                  Proceed to GSTR-9C <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: GSTR-9C */}
          {currentStep === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-black text-slate-800">GSTR-9C: Reconciliation Statement</h3>
                  <p className="text-sm text-slate-500">Reconcile GST turnover with Audited Financial Statements.</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="p-4 font-bold text-xs uppercase tracking-wider">Parameter</th>
                      <th className="p-4 font-bold text-xs uppercase tracking-wider text-right">Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50">
                      <td className="p-4 font-medium text-slate-700 flex items-center gap-2">
                        <Building size={16} className="text-slate-400" />
                        Turnover as per Audited Financials
                      </td>
                      <td className="p-4 text-right">
                        <input type="text" className="w-32 text-right font-mono font-bold bg-slate-50 border border-slate-200 rounded p-1.5 outline-none focus:border-indigo-500" defaultValue={formatCurrency(annualData.auditedTurnover).replace('₹', '').trim()} />
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-4 font-medium text-slate-700">Less: Unbilled revenue at beginning of Financial Year</td>
                      <td className="p-4 text-right font-mono text-slate-500">0</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-4 font-medium text-slate-700">Add: Unbilled revenue at end of Financial Year</td>
                      <td className="p-4 text-right font-mono text-slate-500">0</td>
                    </tr>
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td className="p-4 font-black text-slate-800">Adjusted Annual Turnover</td>
                      <td className="p-4 text-right font-mono font-black text-slate-800">{formatCurrency(annualData.auditedTurnover)}</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-black text-slate-800">Turnover as per GSTR-9 (Table 5N)</td>
                      <td className="p-4 text-right font-mono font-black text-indigo-600">{formatCurrency(annualData.totalTurnover)}</td>
                    </tr>
                    <tr className="bg-rose-50/50">
                      <td className="p-4 font-bold text-rose-700 flex items-center gap-2">
                        <AlertTriangle size={16} /> Unreconciled Difference
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-rose-600">
                        {formatCurrency(annualData.auditedTurnover - annualData.totalTurnover)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
                <Info className="text-amber-600 shrink-0 mt-0.5" size={18} />
                <p className="text-xs font-medium text-amber-800">
                  <strong className="block mb-1">Difference Detected</strong>
                  Please provide reasons for the un-reconciled difference of {formatCurrency(annualData.auditedTurnover - annualData.totalTurnover)} before generating the final JSON payload.
                </p>
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-100">
                <button 
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-2.5 text-slate-600 hover:text-slate-800 text-sm font-bold transition-all"
                >
                  Back
                </button>
                <button 
                  onClick={() => setCurrentStep(4)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition-all"
                >
                  Confirm & Next <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: Export */}
          {currentStep === 4 && (
            <motion.div 
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center space-y-6 pt-6"
            >
              <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center shadow-inner mb-4">
                <CheckCircle2 size={40} className="text-emerald-600" />
              </div>
              
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">Ready for Filing</h3>
              <p className="text-slate-500 font-medium max-w-md mx-auto">
                GSTR-9 and GSTR-9C data compilation is complete. Generate the JSON payload to directly upload to the GST Portal.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 pt-6">
                <button className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold transition-all shadow-sm">
                  <FileText size={18} /> Download Draft PDF
                </button>
                <button className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-200 hover:scale-105">
                  <Download size={18} /> Generate JSON Payload
                </button>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-100">
                <button 
                  onClick={() => {
                    setCurrentStep(1);
                    setExtractionProgress(0);
                  }}
                  className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-2 mx-auto"
                >
                  <RefreshCw size={14} /> Start Over
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};
