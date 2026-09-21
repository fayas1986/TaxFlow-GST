import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, ShieldAlert, CheckCircle2, AlertTriangle, Play, RefreshCw, 
  Send, Bell, Activity, Layers, HelpCircle, Laptop, Clock, ArrowDown,
  Sparkles, Check, AlertCircle, Terminal, HelpCircle as HelpIcon, FileText
} from 'lucide-react';

export const ComplianceArchitecturePipeline: React.FC = () => {
  const [simulationStep, setSimulationStep] = useState<number>(-1);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Simulation inputs
  const [txType, setTxType] = useState<'SALES' | 'PURCHASE'>('SALES');
  const [txAmount, setTxAmount] = useState<number>(650000);
  const [txHsn, setTxHsn] = useState<string>('8471');
  const [hasIrn, setHasIrn] = useState<boolean>(false);
  const [supplierStatus, setSupplierStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE');

  const traditionalSteps = [
    { id: 1, label: 'Month End Closes', desc: 'Books of accounts are locked' },
    { id: 2, label: 'Download Data', desc: 'Manual CSV exports from ERPs' },
    { id: 3, label: 'Reconcile', desc: 'GSTR-2B matched after deadline' },
    { id: 4, label: 'Calculate GST', desc: 'Compute output & input offsets' },
    { id: 5, label: 'Prepare Return', desc: 'Compile drafts for filing' },
    { id: 6, label: 'File GST Return', desc: 'Filing done; errors become notices' }
  ];

  const realTimeSteps = [
    { id: 0, label: 'Transaction Created', desc: 'Immediate API trigger on billing entry', detail: 'Captures data instantly' },
    { id: 1, label: 'GST Validation', desc: 'Check active status & registration', detail: 'Validates legal credentials' },
    { id: 2, label: 'Tax Determination', desc: 'HSN code rate compliance mapping', detail: 'Verifies correct tax slabs' },
    { id: 3, label: 'Compliance Check', desc: 'Cross-checks state codes & values', detail: 'Prevents intra/inter-state errors' },
    { id: 4, label: 'E-Invoice / E-Way Bill Check', desc: 'Verifies IRN & threshold rules', detail: 'Ensures mandatory compliance' },
    { id: 5, label: 'ITC / RCM Impact', desc: 'Lock provisional working capital', detail: 'Flags direct cash outflow items' },
    { id: 6, label: 'Risk Evaluation', desc: 'Evaluate supplier risk rating', detail: 'Quantifies compliance hazards' },
    { id: 7, label: 'Exception Created', desc: 'Generate system-wide warnings', detail: 'Logs operational compliance failures' },
    { id: 8, label: 'Tax Team Notification', desc: 'Instant Slack, WhatsApp & Email alerts', detail: 'Fires alerts for same-day resolution' }
  ];

  const startSimulation = () => {
    setIsSimulating(true);
    setSimulationStep(0);
    setSimulationLogs(['[INFO] Initialize real-time pipeline audit execution...']);
  };

  useEffect(() => {
    if (!isSimulating || simulationStep < 0) return;

    if (simulationStep >= realTimeSteps.length) {
      setIsSimulating(false);
      return;
    }

    const timer = setTimeout(() => {
      const step = realTimeSteps[simulationStep];
      let logMsg = '';

      switch (simulationStep) {
        case 0:
          logMsg = `[TXN] Transaction detected: ${txType} of ₹${txAmount.toLocaleString()} under HSN ${txHsn}.`;
          break;
        case 1:
          logMsg = supplierStatus === 'ACTIVE'
            ? `[PASS] GSTIN status validated. Party is active and registered.`
            : `[WARN] GSTIN status suspended! Vendor cannot pass input credit to you.`;
          break;
        case 2:
          logMsg = `[PASS] Tax slab verification: HSN ${txHsn} standard rate of 18% matches invoice amount.`;
          break;
        case 3:
          logMsg = `[PASS] Place of supply matches GST state prefix code.`;
          break;
        case 4:
          if (txAmount >= 500000 && !hasIrn) {
            logMsg = `[FAIL] E-Invoice Exception: Invoice value ₹${txAmount.toLocaleString()} exceeds statutory threshold (₹5L) but lack registered IRN!`;
          } else {
            logMsg = `[PASS] E-invoice rules checked. IRN compliance verified successfully.`;
          }
          break;
        case 5:
          logMsg = txType === 'PURCHASE'
            ? `[INFO] Calculated Eligible ITC of ₹${Math.round(txAmount * 0.18).toLocaleString()} mapped to provisional ledger.`
            : `[INFO] Mapped direct cash outflow liability of ₹${Math.round(txAmount * 0.18).toLocaleString()}.`;
          break;
        case 6:
          logMsg = supplierStatus === 'SUSPENDED' || (txAmount >= 500000 && !hasIrn)
            ? `[FAIL] Combined audit risk score evaluated as HIGH RISK.`
            : `[PASS] Compliance health score: 100% compliant.`;
          break;
        case 7:
          if (supplierStatus === 'SUSPENDED' || (txAmount >= 500000 && !hasIrn)) {
            logMsg = `[WARN] Exception record ANOM-702 created. Lock state in validation queue.`;
          } else {
            logMsg = `[INFO] No active exceptions logged. Auto-passing to filing draft.`;
          }
          break;
        case 8:
          if (supplierStatus === 'SUSPENDED' || (txAmount >= 500000 && !hasIrn)) {
            logMsg = `[ALERT] Tax team notified via Slack & Browser Desktop notification! Resolved today, avoiding penalty.`;
          } else {
            logMsg = `[PASS] Standard transaction report appended to live filing dashboard.`;
          }
          break;
      }

      setSimulationLogs(prev => [...prev, logMsg]);
      setSimulationStep(prev => prev + 1);
    }, 1200);

    return () => clearTimeout(timer);
  }, [isSimulating, simulationStep, txType, txAmount, txHsn, hasIrn, supplierStatus]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Informative Header card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-12 -translate-y-12">
          <Layers size={320} className="text-white" />
        </div>
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full">
            <Sparkles size={11} /> Architectural Upgrade
          </div>
          <h3 className="text-xl font-black tracking-tight">Continuous Real-Time Compliance Control Tower</h3>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Discovering tax anomalies after the period closes leaks working capital and triggers regulatory interest penalties. Transitioning to a continuous validation model catches exceptions the same day they are billed.
          </p>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Traditional Month End Pipeline */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-1.5 bg-slate-100 text-slate-500 rounded-lg">
              <Clock size={16} />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">Traditional Month-End Batching</h4>
              <p className="text-[10px] text-slate-400">Post-Facto Error Resolution Flow</p>
            </div>
          </div>

          <div className="space-y-2">
            {traditionalSteps.map((step, idx) => (
              <div key={step.id} className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100 relative">
                <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 font-extrabold flex items-center justify-center text-xs">
                  {step.id}
                </div>
                <div>
                  <h5 className="text-xs font-black text-slate-700">{step.label}</h5>
                  <p className="text-[10px] text-slate-400 mt-0.5">{step.desc}</p>
                </div>
                {idx < traditionalSteps.length - 1 && (
                  <div className="absolute left-6 bottom-[-14px] w-0.5 h-3 bg-slate-200 z-10"></div>
                )}
              </div>
            ))}
          </div>

          <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 leading-normal font-medium flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>
              <strong>Major Downside:</strong> Compliance anomalies (like supplier default or HSN rate mismatches) are only detected after books are locked, requiring tedious ledger reversals or paying costly portal penalties.
            </span>
          </div>
        </div>

        {/* Recommended Continuous Validation Control Tower */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Layers size={16} />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-indigo-900 uppercase tracking-wider">Recommended Control Tower</h4>
              <p className="text-[10px] text-indigo-400">Continuous Transaction Audit & Action Flow</p>
            </div>
          </div>

          <div className="space-y-2">
            {realTimeSteps.map((step, idx) => {
              const isActive = simulationStep === idx;
              const isPast = simulationStep > idx;

              return (
                <div 
                  key={step.id} 
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all relative ${
                    isActive 
                      ? 'bg-indigo-50/70 border-indigo-200 ring-2 ring-indigo-600/10' 
                      : isPast 
                      ? 'bg-slate-50/50 border-slate-100' 
                      : 'bg-white border-transparent'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full font-extrabold flex items-center justify-center text-xs transition-colors ${
                    isActive 
                      ? 'bg-indigo-600 text-white' 
                      : isPast 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    {isPast ? <Check size={12} /> : step.id}
                  </div>
                  <div>
                    <h5 className={`text-xs font-black ${isActive ? 'text-indigo-900' : isPast ? 'text-slate-700' : 'text-slate-400'}`}>{step.label}</h5>
                    <p className={`text-[10px] mt-0.5 ${isActive ? 'text-indigo-500' : isPast ? 'text-slate-400' : 'text-slate-300'}`}>{step.desc}</p>
                  </div>
                  {idx < realTimeSteps.length - 1 && (
                    <div className={`absolute left-5.5 bottom-[-14px] w-0.5 h-3 z-10 ${isPast ? 'bg-emerald-400' : 'bg-slate-100'}`}></div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 leading-normal font-medium flex items-start gap-2">
            <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
            <span>
              <strong>Continuous Advantage:</strong> Every invoice is audited on entry. Exception codes are routed to team workflows, allowing remediation *weeks before* standard tax return periods close.
            </span>
          </div>
        </div>

      </div>

      {/* Transaction Pipeline Simulator sandbox */}
      <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl overflow-hidden p-6 space-y-6">
        <div>
          <h4 className="text-sm font-black uppercase tracking-wider text-slate-200">Interactive Pipeline Simulator</h4>
          <p className="text-xs text-slate-400 mt-1">Inject transactions with specific features and trace how the Control Tower handles them step-by-step.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Simulation Inputs Left Side */}
          <div className="lg:col-span-5 space-y-4">
            
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 text-xs">
              
              {/* Type selector */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Transaction Type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTxType('SALES')}
                    className={`flex-1 py-1.5 rounded font-black border transition-all ${
                      txType === 'SALES' 
                        ? 'bg-indigo-600 text-white border-indigo-500' 
                        : 'bg-transparent border-slate-800 text-slate-400'
                    }`}
                  >
                    Sales Invoice
                  </button>
                  <button
                    onClick={() => setTxType('PURCHASE')}
                    className={`flex-1 py-1.5 rounded font-black border transition-all ${
                      txType === 'PURCHASE' 
                        ? 'bg-emerald-600 text-white border-emerald-500' 
                        : 'bg-transparent border-slate-800 text-slate-400'
                    }`}
                  >
                    Purchase Bill
                  </button>
                </div>
              </div>

              {/* Amount slider */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Invoice Amount</span>
                  <span className="font-mono text-white font-bold">₹{txAmount.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="50000"
                  max="1200000"
                  step="50000"
                  value={txAmount}
                  onChange={(e) => setTxAmount(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-1 bg-slate-800 rounded"
                />
                <p className="text-[9px] text-slate-500">Value of ₹5L+ mandates electronic registration on IRP portals.</p>
              </div>

              {/* HSN Slab */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">HSN Classification</label>
                <select
                  value={txHsn}
                  onChange={(e) => setTxHsn(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 rounded font-bold"
                >
                  <option value="8471">HSN 8471 (Computers & HW - 18%)</option>
                  <option value="9983">HSN 9983 (Software Consulting - 18%)</option>
                  <option value="9963">HSN 9963 (Beverages/Catering - Sec 17 Blocked)</option>
                </select>
              </div>

              {/* IRN Toggle */}
              <div className="flex items-center justify-between text-[10px] py-1">
                <span className="text-slate-400 font-bold uppercase tracking-wider">Registered with E-Invoice IRN</span>
                <button
                  onClick={() => setHasIrn(!hasIrn)}
                  className={`px-3 py-1 rounded text-[10px] font-black transition-colors ${
                    hasIrn ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {hasIrn ? 'IRN Present' : 'No IRN'}
                </button>
              </div>

              {/* Vendor status Toggle */}
              <div className="flex items-center justify-between text-[10px] py-1">
                <span className="text-slate-400 font-bold uppercase tracking-wider">Supplier GSTR-3B Status</span>
                <button
                  onClick={() => setSupplierStatus(supplierStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}
                  className={`px-3 py-1 rounded text-[10px] font-black transition-colors ${
                    supplierStatus === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {supplierStatus}
                </button>
              </div>

            </div>

            <button
              onClick={startSimulation}
              disabled={isSimulating}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <Play size={14} /> Inject Transaction & Audit Live
            </button>
          </div>

          {/* Simulation Output Terminal Right Side */}
          <div className="lg:col-span-7 space-y-3 flex flex-col h-[340px]">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Terminal size={14} className="text-indigo-400 animate-pulse" /> Live Terminal Audit Trace
            </span>
            <div className="bg-slate-950 rounded-xl p-4 flex-1 font-mono text-[11px] overflow-y-auto border border-slate-800 text-slate-300 space-y-1.5 scrollbar-thin">
              {simulationLogs.map((log, idx) => {
                let colorClass = 'text-slate-300';
                if (log.startsWith('[FAIL]')) colorClass = 'text-rose-400 font-bold';
                else if (log.startsWith('[WARN]')) colorClass = 'text-amber-400 font-bold';
                else if (log.startsWith('[PASS]')) colorClass = 'text-emerald-400 font-semibold';
                else if (log.startsWith('[ALERT]')) colorClass = 'text-indigo-400 font-black animate-pulse';

                return (
                  <div key={idx} className={`${colorClass} leading-normal`}>
                    {log}
                  </div>
                );
              })}
              {isSimulating && (
                <div className="text-indigo-500 text-xs flex items-center gap-1.5 animate-pulse">
                  <RefreshCw size={12} className="animate-spin" /> Control Tower Core evaluating current node...
                </div>
              )}
              {simulationLogs.length === 0 && (
                <div className="text-slate-600 italic flex flex-col items-center justify-center h-full space-y-2">
                  <span>Terminal ready. Click "Inject Transaction & Audit Live" to run validation engine.</span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};
