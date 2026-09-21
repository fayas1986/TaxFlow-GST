import React, { useState } from 'react';
import { 
  ArrowRight, AlertTriangle, CheckCircle2, Clock, Sparkles, RefreshCw, 
  Truck, FileText, Layers, Activity, ChevronRight, Check, AlertCircle, Play
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchInvoices } from '../../services/api';

interface PipelineInvoice {
  id: string;
  invoiceNumber: string;
  partyName: string;
  amount: number;
  taxAmount: number;
  category: 'SALES' | 'PURCHASE';
  stuckStep: 'EWAY_BILL' | 'HSN_MATCH' | 'IRN_REGISTER' | 'VENDOR_3B_FILING';
  stuckReason: string;
  steps: {
    id: string;
    label: string;
    status: 'PASSED' | 'STUCK' | 'PENDING';
    updatedAt: string;
    desc: string;
  }[];
}

export const RealTimePipelineVisualizer: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const [selectedTxId, setSelectedTxId] = useState<string>('tx-1');
  
  // Local state to simulate resolving the stuck status on the fly
  const [resolvedIds, setResolvedIds] = useState<Record<string, boolean>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Mock a set of high-fidelity transactions currently flowing or stuck in the real-time compliance pipeline
  const initialTransactions: PipelineInvoice[] = [
    {
      id: 'tx-1',
      invoiceNumber: 'INV-2026-9041',
      partyName: 'Apex Logistics Systems Ltd',
      amount: 680000,
      taxAmount: 122400,
      category: 'SALES',
      stuckStep: 'EWAY_BILL',
      stuckReason: 'Mandatory E-Way Bill missing for inter-state goods shipment exceeding ₹50,000 threshold.',
      steps: [
        { id: '1', label: 'Validation', status: 'PASSED', updatedAt: '08:42 AM', desc: 'Party GSTIN & POS code verified' },
        { id: '2', label: 'Tax Code Audit', status: 'PASSED', updatedAt: '08:43 AM', desc: 'HSN 8708 slab audited at 18%' },
        { id: '3', label: 'IRN E-Invoice', status: 'PASSED', updatedAt: '08:45 AM', desc: 'IRN generated: 4920aa841e...' },
        { id: '4', label: 'E-Way Bill', status: 'STUCK', updatedAt: 'Pending', desc: 'Awaiting Transporter Assignment' },
        { id: '5', label: 'Filing Ready', status: 'PENDING', updatedAt: 'Pending', desc: 'Pending promotion to GSTR-1 batch' },
      ]
    },
    {
      id: 'tx-2',
      invoiceNumber: 'INV-2026-9088',
      partyName: 'IndoTech Hardware Corp',
      amount: 450000,
      taxAmount: 54000,
      category: 'PURCHASE',
      stuckStep: 'HSN_MATCH',
      stuckReason: 'Tax slab mismatch detected: Bill claims 12% GST standard but statutory HSN 8471 demands 18% standard rate.',
      steps: [
        { id: '1', label: 'Validation', status: 'PASSED', updatedAt: '09:12 AM', desc: 'Party GSTIN & status active' },
        { id: '2', label: 'Tax Code Audit', status: 'STUCK', updatedAt: 'Pending', desc: 'HSN 8471 rate discrepancy flagged' },
        { id: '3', label: 'IRN E-Invoice', status: 'PENDING', updatedAt: 'Pending', desc: 'Awaiting HSN approval' },
        { id: '4', label: 'E-Way Bill', status: 'PENDING', updatedAt: 'Pending', desc: 'Blocked by validation' },
        { id: '5', label: 'Filing Ready', status: 'PENDING', updatedAt: 'Pending', desc: 'Pending matching confirmation' },
      ]
    },
    {
      id: 'tx-3',
      invoiceNumber: 'INV-2026-9122',
      partyName: 'Sai Catering Services',
      amount: 120000,
      taxAmount: 21600,
      category: 'PURCHASE',
      stuckStep: 'IRN_REGISTER',
      stuckReason: 'Section 17(5) blocked credit risk. Purchase relates to corporate food services which must be flagged as non-eligible ITC.',
      steps: [
        { id: '1', label: 'Validation', status: 'PASSED', updatedAt: '10:05 AM', desc: 'Supplier status registered' },
        { id: '2', label: 'Tax Code Audit', status: 'PASSED', updatedAt: '10:06 AM', desc: 'HSN 9963 mapped at 18%' },
        { id: '3', label: 'ITC Eligibility', status: 'STUCK', updatedAt: 'Pending', desc: 'Sec 17(5) blocked credit flagged' },
        { id: '4', label: 'E-Way Bill', status: 'PASSED', updatedAt: '10:08 AM', desc: 'Bypassed (Not goods shipment)' },
        { id: '5', label: 'Filing Ready', status: 'PENDING', updatedAt: 'Pending', desc: 'Blocked for ITC ledger adjustment' },
      ]
    }
  ];

  const currentTx = initialTransactions.find(t => t.id === selectedTxId) || initialTransactions[0];
  const isResolved = resolvedIds[currentTx.id];

  const triggerResolution = () => {
    setResolvingId(currentTx.id);
    setTimeout(() => {
      setResolvedIds(prev => ({ ...prev, [currentTx.id]: true }));
      setResolvingId(null);
    }, 1500);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-6 p-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
              <Activity size={18} className="animate-pulse" />
            </span>
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              Real-Time Compliance Pipeline Monitor
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700">
              Live Pipeline
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Real-time visual state tracking. Identify and resolve compliance exceptions before the transaction locks into static ledger batches.
          </p>
        </div>

        {/* Reset Actions */}
        {Object.keys(resolvedIds).length > 0 && (
          <button
            onClick={() => setResolvedIds({})}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-extrabold flex items-center gap-1 transition-colors"
          >
            <RefreshCw size={12} /> Reset Pipeline States
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Stuck Transactions Queue */}
        <div className="lg:col-span-4 space-y-3">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            Pipeline Exception Queue ({initialTransactions.length - Object.keys(resolvedIds).length} unresolved)
          </span>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {initialTransactions.map((tx) => {
              const txResolved = resolvedIds[tx.id];
              const isSelected = tx.id === selectedTxId;

              return (
                <button
                  key={tx.id}
                  onClick={() => setSelectedTxId(tx.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col space-y-2 ${
                    isSelected 
                      ? 'bg-slate-50 border-indigo-500 shadow-sm' 
                      : 'bg-white border-slate-100 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-slate-800 text-xs">
                      {tx.invoiceNumber}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                      txResolved 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-amber-100 text-amber-800 animate-pulse'
                    }`}>
                      {txResolved ? 'RESOLVED' : 'STUCK'}
                    </span>
                  </div>

                  <div className="text-[11px] font-bold text-slate-700 truncate">
                    {tx.partyName}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100/60">
                    <span>Value: <strong className="font-mono text-slate-800">₹{tx.amount.toLocaleString()}</strong></span>
                    <span className="text-indigo-600 font-extrabold text-[9px] flex items-center gap-0.5">
                      View State <ChevronRight size={10} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Interactive Process Flow Map */}
        <div className="lg:col-span-8 bg-slate-50 rounded-2xl p-5 border border-slate-150 flex flex-col justify-between space-y-6">
          
          {/* Header of Visualizer Pane */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-200/60 pb-3">
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected State Flow Map</div>
              <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                {currentTx.invoiceNumber} — {currentTx.partyName}
                <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                  currentTx.category === 'SALES' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {currentTx.category}
                </span>
              </h4>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Tax</div>
              <div className="font-mono font-bold text-slate-900 text-sm">₹{currentTx.taxAmount.toLocaleString()}</div>
            </div>
          </div>

          {/* Flow steps progress rendering */}
          <div className="space-y-4">
            
            {/* Horizontal Flow Nodes */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 relative py-2">
              {currentTx.steps.map((step, idx) => {
                // If resolved, any previous STUCK or PENDING becomes PASSED
                const isStepStuck = step.status === 'STUCK' && !isResolved;
                const isStepPassed = step.status === 'PASSED' || (isResolved && step.status !== 'PENDING') || (isResolved && step.id === '5');
                const isStepPending = !isStepPassed && !isStepStuck;

                return (
                  <React.Fragment key={step.id}>
                    {/* Node */}
                    <div className="flex flex-row md:flex-col items-center gap-3 md:gap-2 text-center relative z-10 w-full md:w-auto">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all ${
                        isStepPassed 
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/10' 
                          : isStepStuck 
                          ? 'bg-amber-500 text-white animate-pulse ring-4 ring-amber-500/10' 
                          : 'bg-slate-200 text-slate-400'
                      }`}>
                        {isStepPassed ? <Check size={14} /> : isStepStuck ? <AlertTriangle size={14} /> : step.id}
                      </div>

                      <div className="text-left md:text-center space-y-0.5">
                        <div className={`text-xs font-black ${
                          isStepPassed ? 'text-slate-800' : isStepStuck ? 'text-amber-800 font-extrabold' : 'text-slate-400'
                        }`}>
                          {step.label}
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium md:max-w-[110px] truncate md:whitespace-normal line-clamp-1">
                          {isStepStuck ? 'Blocked Node' : step.desc}
                        </div>
                      </div>
                    </div>

                    {/* Connecting line */}
                    {idx < currentTx.steps.length - 1 && (
                      <div className={`hidden md:block flex-1 h-0.5 transition-colors ${
                        isStepPassed ? 'bg-emerald-400' : 'bg-slate-200'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

          </div>

          {/* Stuck Reason & Quick Resolver Panel */}
          <div className={`p-4 rounded-xl border transition-all ${
            isResolved 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-950' 
              : 'bg-amber-50/50 border-amber-200 text-amber-950'
          }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-1.5 font-extrabold text-xs">
                  {isResolved ? (
                    <>
                      <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                      <span className="text-emerald-900 font-black">Compliance Exceptions Cleared</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={14} className="text-amber-600 shrink-0" />
                      <span className="text-amber-900 font-black">Validation Failure Resolution Pending</span>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 leading-normal max-w-xl">
                  {isResolved 
                    ? `Resolution logged successfully. The transaction has been validated and promoted to the standard GSTR-1 draft return with statutory signatures.`
                    : currentTx.stuckReason
                  }
                </p>
              </div>

              {/* Resolution trigger button */}
              {!isResolved && (
                <button
                  onClick={triggerResolution}
                  disabled={resolvingId !== null}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 disabled:opacity-50 shadow-md shadow-amber-500/10 shrink-0 self-start sm:self-center"
                >
                  {resolvingId === currentTx.id ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" /> Resolving...
                    </>
                  ) : (
                    <>
                      <Play size={12} /> Auto-Resolve Issue
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
