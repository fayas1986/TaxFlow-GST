import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, FileText, ShieldCheck, Calendar, Calculator, Download } from 'lucide-react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { TaxComputationSummary } from '../types';
import { generateGstSummaryPdf } from '../utils/pdfReportGenerator';

interface TaxSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: TaxComputationSummary | null;
  period: string;
}

const TaxSummaryModal: React.FC<TaxSummaryModalProps> = ({ isOpen, onClose, data, period }) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const currentTenant = user?.availableTenants.find(t => t.id === user.currentTenantId);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    if (data) {
      generateGstSummaryPdf(data, period, currentTenant);
    }
  };

  if (!data) return null;

  const totalOutput = data.outputLiability.igst + data.outputLiability.cgst + data.outputLiability.sgst;
  const totalItc = data.inputTaxCredit.igst + data.inputTaxCredit.cgst + data.inputTaxCredit.sgst;
  const totalNet = data.netPayable.igst + data.netPayable.cgst + data.netPayable.sgst;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm no-print"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-full border border-slate-200"
          >
            {/* Header - No Print */}
            <div className="px-8 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10 no-print">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                  <FileText size={18} />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Tax Summary Preview</h3>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleDownloadPdf}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                >
                  <Download size={16} /> Download PDF Report
                </button>
                <button 
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition-all shadow-md"
                >
                  <Printer size={16} /> Print Report
                </button>
                <button 
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 sm:p-12 bg-slate-50/30 custom-scrollbar">
              <div className="max-w-3xl mx-auto bg-white p-10 shadow-sm border border-slate-100 rounded-2xl print:shadow-none print:border-none print:p-0">
                
                {/* Report Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-10">
                  <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-1">TaxFlow Summary</h1>
                    <p className="text-slate-500 font-bold text-sm tracking-widest uppercase flex items-center gap-2">
                      <Calendar size={14}/> {period}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Generated On</p>
                    <p className="text-sm font-bold text-slate-900">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>

                {/* Main Figures Grid */}
                <div className="grid grid-cols-2 gap-8 mb-12">
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Total Output Tax</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-slate-400">₹</span>
                      <span className="text-3xl font-black text-slate-900 tabular-nums">
                        {totalOutput.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                  <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <p className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest mb-3">Total Input Tax Credit</p>
                    <div className="flex items-baseline gap-1 text-emerald-700">
                      <span className="text-sm font-bold opacity-60">₹</span>
                      <span className="text-3xl font-black tabular-nums">
                        {totalItc.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Net Liability Section */}
                <div className="bg-slate-900 text-white p-8 rounded-2xl mb-12 relative overflow-hidden">
                  <div className="relative z-10">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Net Tax Payable (After ITC)</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-slate-400">₹</span>
                      <span className="text-5xl font-black tracking-tighter tabular-nums">
                        {totalNet.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="mt-6 flex items-center gap-2 text-emerald-400 text-sm font-bold">
                      <ShieldCheck size={18}/>
                      <span>Verified for Compliance Readiness</span>
                    </div>
                  </div>
                  <Calculator size={120} className="absolute -bottom-6 -right-6 text-white/5 rotate-12" />
                </div>

                {/* Breakdown Table */}
                <div className="space-y-6">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-2">Tax Component Breakdown</h4>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="pb-4">Component</th>
                        <th className="pb-4 text-right">IGST</th>
                        <th className="pb-4 text-right">CGST</th>
                        <th className="pb-4 text-right">SGST</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      <tr>
                        <td className="py-4 text-sm font-bold text-slate-600">Output Liability</td>
                        <td className="py-4 text-sm font-bold text-slate-900 text-right">{data.outputLiability.igst.toLocaleString('en-IN')}</td>
                        <td className="py-4 text-sm font-bold text-slate-900 text-right">{data.outputLiability.cgst.toLocaleString('en-IN')}</td>
                        <td className="py-4 text-sm font-bold text-slate-900 text-right">{data.outputLiability.sgst.toLocaleString('en-IN')}</td>
                      </tr>
                      <tr>
                        <td className="py-4 text-sm font-bold text-slate-600">ITC Available</td>
                        <td className="py-4 text-sm font-bold text-emerald-600 text-right">({data.inputTaxCredit.igst.toLocaleString('en-IN')})</td>
                        <td className="py-4 text-sm font-bold text-emerald-600 text-right">({data.inputTaxCredit.cgst.toLocaleString('en-IN')})</td>
                        <td className="py-4 text-sm font-bold text-emerald-600 text-right">({data.inputTaxCredit.sgst.toLocaleString('en-IN')})</td>
                      </tr>
                      <tr className="bg-slate-50/50">
                        <td className="py-4 px-2 text-sm font-black text-slate-900">Net Payable</td>
                        <td className="py-4 px-2 text-sm font-black text-slate-900 text-right">{data.netPayable.igst.toLocaleString('en-IN')}</td>
                        <td className="py-4 px-2 text-sm font-black text-slate-900 text-right">{data.netPayable.cgst.toLocaleString('en-IN')}</td>
                        <td className="py-4 px-2 text-sm font-black text-slate-900 text-right">{data.netPayable.sgst.toLocaleString('en-IN')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer Disclaimer */}
                <div className="mt-16 pt-8 border-t border-slate-100 flex flex-col items-center">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-slate-900 rounded flex items-center justify-center text-[10px] font-black text-white">TF</div>
                    <span className="text-xs font-black text-slate-900 tracking-tight">TaxFlow Compliance Platform</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium max-w-sm text-center leading-relaxed">
                    This is a computer-generated summary for internal use and reconciliation purposes. Please verify figures with official government portals before final filing.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
          
          <style>{`
            @media print {
              .no-print { display: none !important; }
              body { background: white !important; margin: 0; padding: 0; }
              .custom-scrollbar::-webkit-scrollbar { display: none; }
              @page { margin: 1cm; }
            }
          `}</style>
        </div>
      )}
    </AnimatePresence>
  );
};

export default TaxSummaryModal;
