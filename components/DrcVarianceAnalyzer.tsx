import React, { useState } from 'react';
import { 
  FileWarning, FileText, CheckCircle2, ArrowRight,
  Calculator, AlertTriangle, Scale, ShieldAlert,
  Search, ExternalLink, Activity
} from 'lucide-react';
import { motion } from 'framer-motion';

export const DrcVarianceAnalyzer: React.FC = () => {
  const [activeForm, setActiveForm] = useState<'DRC_01B' | 'DRC_01C'>('DRC_01B');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      setShowResults(true);
    }, 1500);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Scale className="text-rose-600" />
            DRC-01B / DRC-01C Variance Analyzer
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Detect anomalies between GSTR-1, GSTR-3B, and GSTR-2B before receiving automated notices.
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => { setActiveForm('DRC_01B'); setShowResults(false); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeForm === 'DRC_01B' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            DRC-01B (Liability)
          </button>
          <button 
            onClick={() => { setActiveForm('DRC_01C'); setShowResults(false); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeForm === 'DRC_01C' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            DRC-01C (ITC)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Input Parameters */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-black text-slate-800 border-b border-slate-200 pb-2">Analysis Period</h3>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Return Period</label>
              <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:border-rose-500">
                <option>March 2026</option>
                <option>February 2026</option>
                <option>January 2026</option>
              </select>
            </div>
            
            <button 
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all shadow-md ${
                activeForm === 'DRC_01B' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
              } disabled:opacity-70`}
            >
              {isAnalyzing ? <Activity size={18} className="animate-spin" /> : <Calculator size={18} />}
              {isAnalyzing ? 'Scanning Returns...' : `Run ${activeForm} Analysis`}
            </button>
          </div>
          
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-800">
            <h4 className="flex items-center gap-2 font-bold text-sm mb-2">
              <ShieldAlert size={16} /> Rule Background
            </h4>
            <p className="text-xs leading-relaxed">
              {activeForm === 'DRC_01B' 
                ? "Form DRC-01B is auto-generated when output tax liability in GSTR-1 exceeds liability reported in GSTR-3B by specified limits. You must pay the difference or explain."
                : "Form DRC-01C is auto-generated when ITC claimed in GSTR-3B exceeds ITC available in GSTR-2B by a specified percentage/amount. You must reverse ITC or explain."
              }
            </p>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-8">
          {!showResults && !isAnalyzing && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <Scale size={48} className="mb-4 text-slate-300" />
              <p className="font-medium text-center max-w-sm">Select a return period and run the analysis to identify potential DRC triggers before you file.</p>
            </div>
          )}

          {isAnalyzing && (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
              <div className="w-16 h-16 border-4 border-slate-100 border-t-rose-500 rounded-full animate-spin mb-4"></div>
              <p className="font-bold">Comparing Return Data...</p>
            </div>
          )}

          {showResults && activeForm === 'DRC_01B' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex items-center justify-between bg-rose-50 border border-rose-200 p-5 rounded-2xl">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-rose-100 text-rose-700 rounded-xl"><AlertTriangle size={24} /></div>
                  <div>
                    <h3 className="text-lg font-black text-rose-900 tracking-tight">DRC-01B Trigger Detected</h3>
                    <p className="text-rose-700 text-sm font-medium mt-0.5">Variance exceeds permissible limits (Rule 88C)</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-rose-600 uppercase tracking-widest">Excess Liability</p>
                  <p className="text-2xl font-black text-rose-900">{formatCurrency(450000)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Liability in GSTR-1</p>
                  <p className="text-xl font-black text-slate-800">{formatCurrency(1550000)}</p>
                </div>
                <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Liability in GSTR-3B</p>
                  <p className="text-xl font-black text-slate-800">{formatCurrency(1100000)}</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-50 p-4 border-b border-slate-200 font-bold text-slate-700">Detailed Tax Head Variance</div>
                <table className="w-full text-sm">
                  <thead className="bg-white text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="p-3 text-left font-bold">Tax Head</th>
                      <th className="p-3 text-right font-bold">GSTR-1 (₹)</th>
                      <th className="p-3 text-right font-bold">GSTR-3B (₹)</th>
                      <th className="p-3 text-right font-bold">Variance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    <tr>
                      <td className="p-3 font-bold text-slate-700 font-sans">IGST</td>
                      <td className="p-3 text-right">8,00,000</td>
                      <td className="p-3 text-right">5,00,000</td>
                      <td className="p-3 text-right font-bold text-rose-600">3,00,000</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-slate-700 font-sans">CGST</td>
                      <td className="p-3 text-right">3,75,000</td>
                      <td className="p-3 text-right">3,00,000</td>
                      <td className="p-3 text-right font-bold text-rose-600">75,000</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-slate-700 font-sans">SGST</td>
                      <td className="p-3 text-right">3,75,000</td>
                      <td className="p-3 text-right">3,00,000</td>
                      <td className="p-3 text-right font-bold text-rose-600">75,000</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex gap-4">
                 <button className="flex-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 py-3 rounded-xl font-bold transition-all shadow-sm">
                   Generate Draft Reply (Part B)
                 </button>
                 <button className="flex-1 bg-rose-600 text-white hover:bg-rose-700 py-3 rounded-xl font-bold transition-all shadow-md">
                   Pay Difference via DRC-03
                 </button>
              </div>
            </motion.div>
          )}

          {showResults && activeForm === 'DRC_01C' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 p-5 rounded-2xl">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl"><AlertTriangle size={24} /></div>
                  <div>
                    <h3 className="text-lg font-black text-indigo-900 tracking-tight">DRC-01C Trigger Detected</h3>
                    <p className="text-indigo-700 text-sm font-medium mt-0.5">Excess ITC Claimed (Rule 88D)</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Excess ITC</p>
                  <p className="text-2xl font-black text-indigo-900">{formatCurrency(125000)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">ITC in GSTR-3B</p>
                  <p className="text-xl font-black text-slate-800">{formatCurrency(950000)}</p>
                </div>
                <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">ITC in GSTR-2B</p>
                    <p className="text-xl font-black text-slate-800">{formatCurrency(825000)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400">Variance %</p>
                    <p className="text-sm font-black text-rose-600">+15.15%</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                 <h4 className="font-bold text-slate-800 text-sm">Action Required</h4>
                 <p className="text-sm text-slate-600">The variance exceeds the prescribed threshold. To avoid DRC-01C issuance and potential suspension of GSTR-1 filing, you must either:</p>
                 <div className="flex flex-col gap-3">
                   <label className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-500">
                     <input type="radio" name="drc01c_action" className="mt-1 accent-indigo-600" />
                     <div>
                       <span className="block font-bold text-slate-800 text-sm">Reverse Excess ITC</span>
                       <span className="block text-xs text-slate-500">Reverse {formatCurrency(125000)} along with applicable interest in the next GSTR-3B.</span>
                     </div>
                   </label>
                   <label className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-500">
                     <input type="radio" name="drc01c_action" className="mt-1 accent-indigo-600" />
                     <div>
                       <span className="block font-bold text-slate-800 text-sm">Explain Variance (Part B)</span>
                       <span className="block text-xs text-slate-500">Submit justification (e.g., typographical error, import of goods not in 2B).</span>
                     </div>
                   </label>
                 </div>
                 <div className="pt-2 flex justify-end">
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-md transition-all">
                      Proceed
                    </button>
                 </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};
