import React, { useMemo } from 'react';
import { 
  X, AlertTriangle, ShieldAlert, CheckCircle2, 
  BarChart2, FileWarning, Search, ChevronRight, Activity, Percent
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Invoice } from '../types';

interface DataQualityOverlayProps {
  invoices: Invoice[];
  isOpen: boolean;
  onClose: () => void;
}

interface Anomaly {
  id: string;
  invoiceNumber: string;
  partyName: string;
  type: 'CRITICAL' | 'WARNING';
  issue: string;
}

export const DataQualityOverlay: React.FC<DataQualityOverlayProps> = ({ invoices, isOpen, onClose }) => {
  const anomalies = useMemo(() => {
    if (!invoices) return [];
    const issues: Anomaly[] = [];

    invoices.forEach(inv => {
      // 1. GSTIN format check
      if (inv.gstin && inv.gstin.trim() !== '') {
        const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        if (!gstinRegex.test(inv.gstin)) {
          issues.push({
            id: `${inv.id}-gstin`,
            invoiceNumber: inv.invoiceNumber,
            partyName: inv.partyName,
            type: 'CRITICAL',
            issue: `Invalid GSTIN format: ${inv.gstin}`
          });
        }
      } else if (inv.type === 'B2B') {
        issues.push({
          id: `${inv.id}-gstin-missing`,
          invoiceNumber: inv.invoiceNumber,
          partyName: inv.partyName,
          type: 'CRITICAL',
          issue: `Missing GSTIN for B2B transaction`
        });
      }

      // 2. Negative Amounts
      if (inv.amount < 0 && inv.docType !== 'CREDIT_NOTE') {
        issues.push({
          id: `${inv.id}-amt`,
          invoiceNumber: inv.invoiceNumber,
          partyName: inv.partyName,
          type: 'CRITICAL',
          issue: `Negative taxable amount (${inv.amount}) for standard invoice`
        });
      }

      // 3. Tax Rate mismatch
      if (inv.items) {
        inv.items.forEach((item, idx) => {
          if (!item.hsnSac || item.hsnSac.length < 4) {
            issues.push({
              id: `${inv.id}-hsn-${idx}`,
              invoiceNumber: inv.invoiceNumber,
              partyName: inv.partyName,
              type: 'WARNING',
              issue: `Missing or invalid HSN/SAC code (Item ${idx+1})`
            });
          }

          const expectedTax = (item.taxableValue * item.taxRate) / 100;
          if (Math.abs(expectedTax - item.taxAmount) > 2) {
             issues.push({
              id: `${inv.id}-taxcalc-${idx}`,
              invoiceNumber: inv.invoiceNumber,
              partyName: inv.partyName,
              type: 'CRITICAL',
              issue: `Tax Calculation Mismatch: Expected ${expectedTax.toFixed(2)}, Found ${item.taxAmount}`
            });
          }
        });
      }
    });

    return issues;
  }, [invoices]);

  const criticalCount = anomalies.filter(a => a.type === 'CRITICAL').length;
  const warningCount = anomalies.filter(a => a.type === 'WARNING').length;
  const healthScore = invoices.length > 0 ? Math.max(0, 100 - (criticalCount * 5 + warningCount * 2)) : 100;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-lg bg-slate-50 shadow-2xl z-50 flex flex-col border-l border-slate-200"
          >
            {/* Header */}
            <div className="bg-white px-6 py-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Activity className="text-indigo-600" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800 tracking-tight">Data Quality Dashboard</h2>
                  <p className="text-xs text-slate-500 font-semibold">Real-time Anomaly Detection</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Score Cards */}
            <div className="p-6 bg-white border-b border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800">Overall Health Score</h3>
                <div className={`px-2.5 py-1 rounded-md text-xs font-black ${
                  healthScore >= 90 ? 'bg-emerald-100 text-emerald-700' :
                  healthScore >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {healthScore}%
                </div>
              </div>
              
              <div className="w-full bg-slate-100 rounded-full h-2 mb-6 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${
                    healthScore >= 90 ? 'bg-emerald-500' :
                    healthScore >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${healthScore}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldAlert size={16} className="text-rose-600" />
                    <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Critical Issues</span>
                  </div>
                  <span className="text-2xl font-black text-rose-700">{criticalCount}</span>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={16} className="text-amber-600" />
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Warnings</span>
                  </div>
                  <span className="text-2xl font-black text-amber-700">{warningCount}</span>
                </div>
              </div>
            </div>

            {/* Anomaly List */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Detected Anomalies ({anomalies.length})</h3>
              
              {anomalies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-2xl border border-slate-200 border-dashed">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 size={32} className="text-emerald-500" />
                  </div>
                  <h4 className="font-bold text-slate-800 mb-1">Pristine Data Quality</h4>
                  <p className="text-sm text-slate-500 max-w-[250px]">No structural anomalies or contradictory fields detected in your imported invoices.</p>
                </div>
              ) : (
                anomalies.map(anomaly => (
                  <div 
                    key={anomaly.id}
                    className={`p-4 rounded-xl border flex items-start gap-3 shadow-sm bg-white hover:shadow-md transition-shadow ${
                      anomaly.type === 'CRITICAL' ? 'border-l-4 border-l-rose-500 border-y-slate-200 border-r-slate-200' : 'border-l-4 border-l-amber-500 border-y-slate-200 border-r-slate-200'
                    }`}
                  >
                    <div className={`mt-0.5 ${anomaly.type === 'CRITICAL' ? 'text-rose-500' : 'text-amber-500'}`}>
                      {anomaly.type === 'CRITICAL' ? <ShieldAlert size={18} /> : <AlertTriangle size={18} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-sm text-slate-800">{anomaly.invoiceNumber}</span>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                          anomaly.type === 'CRITICAL' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {anomaly.type}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-500 mb-1.5">{anomaly.partyName}</p>
                      <p className="text-sm text-slate-700 font-medium bg-slate-50 p-2 rounded-lg border border-slate-100">{anomaly.issue}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
