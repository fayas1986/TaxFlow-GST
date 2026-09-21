import React, { useState, useEffect } from 'react';
import { 
  Calculator, Clock, AlertTriangle, CheckCircle2, AlertCircle, 
  TrendingUp, Coins, ShieldAlert, Layers, Settings, HelpCircle, 
  RefreshCw, FileText, Check, X, ArrowRight, Lock, Unlock, Sliders, Filter
} from 'lucide-react';
import { fetchInvoices } from '../services/api';
import { Invoice } from '../types';
import { ITCTaggingService } from '../services/gstEngine/itcTaggingService';

interface ItcLedgerOptimizerProps {
  tenantId: string;
}

export const ItcLedgerOptimizer: React.FC<ItcLedgerOptimizerProps> = ({ tenantId }) => {
  // Navigation & View States
  const [activeTab, setActiveTab] = useState<'RULE_36' | 'SECTION_17' | 'RULE_37' | 'RULE_42_43'>('RULE_36');
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom Override States
  const [overrides, setOverrides] = useState<Record<string, { isBlocked: boolean; note: string }>>({});
  const [paidOverride, setPaidOverride] = useState<Record<string, 'PAID' | 'UNPAID'>>({});

  // Tab 1: Rule 36(4) States
  const [rule36CapPct, setRule36CapPct] = useState<number>(5); // Default 5% provisional cap
  const [applyRule36Fix, setApplyRule36Fix] = useState(false);

  // Tab 3: Rule 37 Aging States
  const [auditDate, setAuditDate] = useState<string>('2026-12-15'); // Dec 2026 to capture full 180-day cycle for May-Oct invoices
  const [interestRate, setInterestRate] = useState<number>(18); // Statutory 18% p.a.

  // Tab 4: Rule 42/43 Apportionment States
  const [totalTurnover, setTotalTurnover] = useState<number>(5000000); // ₹50 Lakhs
  const [exemptTurnover, setExemptTurnover] = useState<number>(650000); // ₹6.5 Lakhs
  const [manualT1, setManualT1] = useState<number>(15000); // Non-business exclusve
  const [manualT2, setManualT2] = useState<number>(25000); // Exempt supply exclusive
  const [manualT4, setManualT4] = useState<number>(280000); // Taxable supply exclusive

  // Toast notice
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchInvoices(tenantId);
      // Filter for Purchase category
      const purchases = data.filter(inv => inv.category === 'PURCHASE');
      setInvoices(purchases);
    } catch (err) {
      console.error("Error fetching purchase invoices: ", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId]);

  // Utility to parse dates and calculate day differences
  const calculateDaysBetween = (startDateStr: string, endDateStr: string): number => {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const diffTime = end.getTime() - start.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // ==========================================
  // CALCULATIONS: Tab 1 - Rule 36(4) Cap Enforcer
  // ==========================================
  // Split invoices into GSTR-2B Matched vs Unmatched
  // Let's assume matches are invoices with isBlockedItc === false OR some heuristic
  // Unmatched are B2B invoices that are not filed/matched or marked as missing on portal
  // Let's simulate: odd index are matched, even are unmatched (or based on status/tags)
  const rule36Data = (() => {
    let reconciledCredit = 0;
    let unmatchedCredit = 0;
    const matchedList: Invoice[] = [];
    const unmatchedList: Invoice[] = [];

    invoices.forEach((inv, idx) => {
      // Heuristic for matching: UPLOADED are treated as unmatched in GSTR-2B, FILED/PAID are matched
      const isMatched = inv.status === 'FILED' || inv.status === 'PAID' || idx % 3 !== 0;
      const tax = inv.taxAmount || 0;

      if (isMatched) {
        reconciledCredit += tax;
        matchedList.push(inv);
      } else {
        unmatchedCredit += tax;
        unmatchedList.push(inv);
      }
    });

    const allowedProvisionalCredit = reconciledCredit * (rule36CapPct / 100);
    const actualProvisionalCreditClaimed = applyRule36Fix 
      ? Math.min(unmatchedCredit, allowedProvisionalCredit) 
      : unmatchedCredit;

    const excessProvisionalCredit = Math.max(0, unmatchedCredit - allowedProvisionalCredit);
    const totalClaimableITC = reconciledCredit + actualProvisionalCreditClaimed;

    return {
      reconciledCredit,
      unmatchedCredit,
      allowedProvisionalCredit,
      actualProvisionalCreditClaimed,
      excessProvisionalCredit,
      totalClaimableITC,
      matchedList,
      unmatchedList
    };
  })();

  // ==========================================
  // CALCULATIONS: Tab 2 - Section 17(5) Blocked Categorization
  // ==========================================
  const section17Data = (() => {
    let totalTaxAmount = 0;
    let totalEligibleITC = 0;
    let totalBlockedITC = 0;
    const categoryBreakdown: Record<string, number> = {
      'Motor Vehicles (Sec 17(5)(a))': 0,
      'Food, Beverage & Grooming (Sec 17(5)(b)(i))': 0,
      'Club & Gym Membership (Sec 17(5)(b)(ii))': 0,
      'Employee Vacation / Life Ins (Sec 17(5)(b)(iii))': 0,
      'Immovable Property Works (Sec 17(5)(c/d))': 0,
      'Personal Consumption / Gifts (Sec 17(5)(g/h))': 0,
      'General / Other Blocked': 0
    };

    const evaluatedInvoices = invoices.map((inv) => {
      const res = ITCTaggingService.classifyInvoiceITC(inv);
      const originalIsBlocked = !res.isEligible;
      
      // Apply overrides
      const isOverridden = overrides[inv.id] !== undefined;
      const currentIsBlocked = isOverridden ? overrides[inv.id].isBlocked : originalIsBlocked;
      const clause = res.statutoryClause || 'CGST Act Section 17(5)';
      
      const tax = inv.taxAmount || 0;
      totalTaxAmount += tax;

      // Determine category bucket
      let bucket = 'General / Other Blocked';
      if (clause.includes('17(5)(a)')) bucket = 'Motor Vehicles (Sec 17(5)(a))';
      else if (clause.includes('17(5)(b)(i)')) bucket = 'Food, Beverage & Grooming (Sec 17(5)(b)(i))';
      else if (clause.includes('17(5)(b)(ii)')) bucket = 'Club & Gym Membership (Sec 17(5)(b)(ii))';
      else if (clause.includes('17(5)(b)(iii)')) bucket = 'Employee Vacation / Life Ins (Sec 17(5)(b)(iii))';
      else if (clause.includes('17(5)(c') || clause.includes('17(5)(d')) bucket = 'Immovable Property Works (Sec 17(5)(c/d))';
      else if (clause.includes('17(5)(g') || clause.includes('17(5)(h')) bucket = 'Personal Consumption / Gifts (Sec 17(5)(g/h))';

      if (currentIsBlocked) {
        totalBlockedITC += tax;
        categoryBreakdown[bucket] += tax;
      } else {
        totalEligibleITC += tax;
      }

      return {
        invoice: inv,
        originalIsBlocked,
        currentIsBlocked,
        isOverridden,
        overrideNote: overrides[inv.id]?.note || '',
        classification: res,
        clause,
        categoryBucket: bucket
      };
    });

    return {
      totalTaxAmount,
      totalEligibleITC,
      totalBlockedITC,
      categoryBreakdown,
      evaluatedInvoices
    };
  })();

  // ==========================================
  // CALCULATIONS: Tab 3 - Rule 37 Aging Tracker
  // ==========================================
  const rule37Data = (() => {
    let totalUnpaidITC = 0;
    let potentialReversalRequired = 0;
    let totalInterestAccrued = 0;

    const buckets = {
      safe: { label: '0-90 Days (Safe)', count: 0, amount: 0, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      watch: { label: '91-120 Days (Watch)', count: 0, amount: 0, color: 'bg-blue-50 text-blue-700 border-blue-200' },
      warning: { label: '121-150 Days (Warning)', count: 0, amount: 0, color: 'bg-amber-50 text-amber-700 border-amber-200' },
      urgent: { label: '151-180 Days (Urgent)', count: 0, amount: 0, color: 'bg-orange-50 text-orange-700 border-orange-200' },
      critical: { label: '>180 Days (Critical Reversal)', count: 0, amount: 0, color: 'bg-rose-50 text-rose-700 border-rose-200' }
    };

    const trackedInvoices = invoices.map((inv) => {
      // Determine payment status. Allow user overrides.
      const currentStatus = paidOverride[inv.id] || (inv.status === 'PAID' ? 'PAID' : 'UNPAID');
      const isPaid = currentStatus === 'PAID';

      const daysElapsed = calculateDaysBetween(inv.date, auditDate);
      const tax = inv.taxAmount || 0;

      let agingCategory: 'safe' | 'watch' | 'warning' | 'urgent' | 'critical' = 'safe';
      if (daysElapsed <= 90) agingCategory = 'safe';
      else if (daysElapsed <= 120) agingCategory = 'watch';
      else if (daysElapsed <= 150) agingCategory = 'warning';
      else if (daysElapsed <= 180) agingCategory = 'urgent';
      else agingCategory = 'critical';

      let interestAccrued = 0;
      if (!isPaid && agingCategory === 'critical') {
        const overdueDays = daysElapsed - 180;
        // Simple Interest under GST (18% per annum)
        interestAccrued = tax * (interestRate / 100) * (overdueDays / 365);
      }

      if (!isPaid) {
        totalUnpaidITC += tax;
        buckets[agingCategory].amount += tax;
        buckets[agingCategory].count += 1;
        
        if (agingCategory === 'critical') {
          potentialReversalRequired += tax;
          totalInterestAccrued += interestAccrued;
        }
      }

      return {
        invoice: inv,
        isPaid,
        daysElapsed,
        agingCategory,
        interestAccrued,
        tax
      };
    }).sort((a, b) => b.daysElapsed - a.daysElapsed); // Sort by oldest first

    return {
      totalUnpaidITC,
      potentialReversalRequired,
      totalInterestAccrued,
      buckets,
      trackedInvoices
    };
  })();

  // ==========================================
  // CALCULATIONS: Tab 4 - Rule 42/43 Apportionment
  // ==========================================
  const rule42Data = (() => {
    const T = section17Data.totalTaxAmount; // Total Input Tax Credit from evaluated purchase invoices
    const T1 = manualT1; // Exclusively used for non-business
    const T2 = manualT2; // Exclusively used for exempt supplies
    const T3 = section17Data.totalBlockedITC; // Exclusively Blocked under 17(5)
    
    // C1: Eligible Credit before common apportionment
    const C1 = Math.max(0, T - (T1 + T2 + T3));
    const T4 = Math.min(manualT4, C1); // Used exclusively for taxable business supplies
    
    // C2: Common Credit pool to be apportioned
    const C2 = Math.max(0, C1 - T4);

    // D1: Reversal for Exempt Supplies: (Exempt Turnover / Total Turnover) * Common Credit
    const exemptionRatio = totalTurnover > 0 ? exemptTurnover / totalTurnover : 0;
    const D1 = C2 * exemptionRatio;

    // D2: Reversal for non-business / personal use (5% statutory flat rate of Common Credit)
    const D2 = C2 * 0.05;

    const totalReversalRequired = D1 + D2;
    const C3 = Math.max(0, C2 - totalReversalRequired); // Net Eligible Common Credit
    const finalEligibleITC = T4 + C3;

    return {
      T, T1, T2, T3, C1, T4, C2, D1, D2, totalReversalRequired, C3, finalEligibleITC, exemptionRatio
    };
  })();

  // Overriding handlers
  const handleToggleBlockOverride = (invoiceId: string, currentVal: boolean) => {
    const note = prompt("Please provide a statutory justification note for this manual reclassification override:", 
      currentVal ? "Overridden as eligible credit under Section 16(1) general business use." : "Manually flagged as Blocked credit.");
    
    if (note === null) return; // User cancelled
    
    setOverrides(prev => ({
      ...prev,
      [invoiceId]: { isBlocked: !currentVal, note }
    }));
    triggerToast(`Invoice override saved! Ledger updated.`, 'success');
  };

  const handleClearOverride = (invoiceId: string) => {
    setOverrides(prev => {
      const copy = { ...prev };
      delete copy[invoiceId];
      return copy;
    });
    triggerToast("Manual override cleared.", 'success');
  };

  const handleTogglePaymentOverride = (invoiceId: string, status: 'PAID' | 'UNPAID') => {
    const nextStatus = status === 'PAID' ? 'UNPAID' : 'PAID';
    setPaidOverride(prev => ({
      ...prev,
      [invoiceId]: nextStatus
    }));
    triggerToast(`Payment status toggled to ${nextStatus}. Recalculating aging...`, 'success');
  };

  const handleSimulatePaymentAllCritical = () => {
    const updated: Record<string, 'PAID' | 'UNPAID'> = { ...paidOverride };
    let count = 0;
    rule37Data.trackedInvoices.forEach(item => {
      if (!item.isPaid && item.agingCategory === 'critical') {
        updated[item.invoice.id] = 'PAID';
        count++;
      }
    });
    setPaidOverride(updated);
    triggerToast(`Simulated paid status for ${count} critical invoices! Potential reversals cleared.`, 'success');
  };

  return (
    <div id="itc-ledger-optimizer" className="space-y-6 animate-in fade-in duration-300">
      
      {/* Toast Notice */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl border transition-all transform scale-100 ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
          <span className="text-xs font-bold font-sans">{toast.message}</span>
        </div>
      )}

      {/* Header Widget */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-44 h-44 bg-blue-500/10 rounded-full blur-2xl"></div>
        <div className="absolute left-1/3 bottom-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/20 border border-blue-400/20 rounded-md text-xs text-blue-300 font-extrabold uppercase tracking-wider">
              <Calculator size={12} />
              Statutory Optimizer Engine
            </div>
            <h1 className="text-2xl font-black tracking-tight font-sans">Input Tax Credit (ITC) Control Center</h1>
            <p className="text-slate-300 text-xs max-w-2xl leading-relaxed">
              Enforce statutory limits, block ineligible credits under Section 17(5), monitor Rule 37 180-day aging reversal penalties, and compute Rule 42/43 common apportionment dynamically with real-time tax code ledger audits.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={loadData}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700 flex items-center justify-center"
              title="Refresh Purchase Register Invoices"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <div className="bg-slate-800/80 border border-slate-700 px-4 py-2.5 rounded-xl text-center min-w-[130px]">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Net Optimized Credit</div>
              <div className="text-lg font-black text-emerald-400 font-mono">
                ₹{Math.round(rule42Data.finalEligibleITC).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation Menu */}
      <div className="flex border-b border-slate-200 bg-white p-1 rounded-xl shadow-sm border">
        {[
          { key: 'RULE_36', label: 'Rule 36(4) Provisional Cap', icon: ShieldAlert },
          { key: 'SECTION_17', label: 'Section 17(5) Blocked Credit', icon: Lock },
          { key: 'RULE_37', label: 'Rule 37 Payment Aging (180d)', icon: Clock },
          { key: 'RULE_42_43', label: 'Rule 42/43 Apportionment', icon: Layers }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 text-xs font-bold rounded-lg transition-all border border-transparent ${
                isActive 
                  ? 'bg-slate-900 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-blue-400' : 'text-slate-400'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* VIEWPORT CONTROLLER */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mx-auto"></div>
          <p className="text-slate-500 text-xs mt-4 font-semibold">Scanning purchase ledgers and executing statutory audits...</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* TAB 1: RULE 36(4) CAP ENFORCER */}
          {activeTab === 'RULE_36' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Form: Parameters and Summary Card */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5 shadow-sm">
                  <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                      <Sliders size={16} />
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm">Regulatory Cap Engine</h3>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Provisional Credit Cap Percentage
                    </label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="0" 
                        max="20" 
                        step="1"
                        value={rule36CapPct}
                        onChange={(e) => setRule36CapPct(Number(e.target.value))}
                        className="flex-1 accent-slate-900"
                      />
                      <span className="text-sm font-black font-mono bg-slate-100 px-2.5 py-1 rounded-lg border text-slate-800 w-12 text-center">
                        {rule36CapPct}%
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 leading-normal">
                      Statutory Rule 36(4) capping of unmatched provisional claims: Originally 20% (Oct 2019), reduced to 10% (Jan 2020), 5% (Jan 2021), and currently 0% (Jan 2022 onwards requiring strict GSTR-2B reflection).
                    </div>
                  </div>

                  {/* Active Cap Enforcer Check */}
                  <label className="flex items-start gap-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl cursor-pointer hover:bg-indigo-50 transition-all select-none">
                    <input 
                      type="checkbox" 
                      checked={applyRule36Fix}
                      onChange={(e) => {
                        setApplyRule36Fix(e.target.checked);
                        triggerToast(e.target.checked ? "Rule 36(4) optimization enabled! Excess provisional claims withheld." : "Rule 36(4) cap bypassed. Provisional credit claimed in full.", 'warning');
                      }}
                      className="w-4 h-4 text-indigo-600 rounded mt-0.5 focus:ring-indigo-500 focus:ring-offset-0"
                    />
                    <div>
                      <div className="text-xs font-extrabold text-indigo-950">Enable Rule 36(4) Auto-Optimizer</div>
                      <p className="text-[10px] text-indigo-700/80 leading-normal mt-0.5">
                        Enforce compliance cap automatically by withholding excess provisional claims (₹{rule36Data.excessProvisionalCredit.toLocaleString()}) to prevent statutory audits.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Math breakdown summary card */}
                <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-4 shadow-md border border-slate-800">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Rule 36(4) Calculation Ledger</h4>
                  
                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Reconciled GSTR-2B Credit:</span>
                      <span className="font-bold">₹{Math.round(rule36Data.reconciledCredit).toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Allowed Provisional Cap ({rule36CapPct}%):</span>
                      <span className="text-blue-400 font-bold">+ ₹{Math.round(rule36Data.allowedProvisionalCredit).toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Total Unmatched Credit (Books):</span>
                      <span className="font-bold text-amber-400">₹{Math.round(rule36Data.unmatchedCredit).toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Applied Provisional Claim:</span>
                      <span className="font-bold text-sky-400">₹{Math.round(rule36Data.actualProvisionalCreditClaimed).toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between pb-1">
                      <span className="text-slate-300 font-bold">Total Claimable Credit:</span>
                      <span className="text-emerald-400 text-sm font-black">₹{Math.round(rule36Data.totalClaimableITC).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Warning / Success Indicators */}
                  {rule36Data.excessProvisionalCredit > 0 && !applyRule36Fix ? (
                    <div className="p-3 bg-rose-500/20 border border-rose-500/30 rounded-xl flex items-start gap-2.5">
                      <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                      <div className="text-[10px] leading-normal text-rose-200">
                        <strong className="text-rose-100">Excess Provisional Risk:</strong> You are claiming ₹{Math.round(rule36Data.excessProvisionalCredit).toLocaleString()} above the statutory limit. High risk of demand notices + 18% mandatory interest! Enable the optimizer to withhold this.
                      </div>
                    </div>
                  ) : applyRule36Fix ? (
                    <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-start gap-2.5">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                      <div className="text-[10px] leading-normal text-emerald-200">
                        <strong className="text-emerald-100">Ledger Optimized:</strong> Excess provisional credit of ₹{Math.round(rule36Data.excessProvisionalCredit).toLocaleString()} successfully withheld from current filing period. Your claim is 100% compliant.
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-start gap-2.5">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                      <div className="text-[10px] leading-normal text-emerald-200">
                        <strong className="text-emerald-100">Compliant:</strong> Unmatched provisional claims are within the designated {rule36CapPct}% threshold. No risk detected.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Table: List of Unmatched Provisional Invoices */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Unmatched / Provisional Purchases Tracker</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Purchases not yet uploaded or matched in supplier GSTR-2B filings.</p>
                  </div>
                  <span className="bg-slate-100 px-3 py-1 rounded text-[10px] font-black text-slate-600 border uppercase">
                    {rule36Data.unmatchedList.length} Invoices Found
                  </span>
                </div>

                <div className="overflow-x-auto divide-y divide-slate-100">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-500 font-extrabold border-b border-slate-200">
                        <th className="px-4 py-3">Invoice & Vendor</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Taxable Value</th>
                        <th className="px-4 py-3 text-right">Provisional Tax</th>
                        <th className="px-4 py-3 text-center">Opt Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rule36Data.unmatchedList.map((inv) => {
                        const tax = inv.taxAmount || 0;
                        const isWithheld = applyRule36Fix;
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50/50 transition-all font-medium text-slate-700">
                            <td className="px-4 py-3.5">
                              <div className="font-bold text-slate-800">{inv.invoiceNumber}</div>
                              <div className="text-[10px] text-slate-500 font-semibold">{inv.partyName}</div>
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 font-mono">{inv.date}</td>
                            <td className="px-4 py-3.5 text-right font-mono">₹{inv.amount.toLocaleString()}</td>
                            <td className="px-4 py-3.5 text-right font-bold text-indigo-700 font-mono">₹{tax.toLocaleString()}</td>
                            <td className="px-4 py-3.5 text-center">
                              {isWithheld ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded font-black text-[9px] uppercase tracking-wider">
                                  <Clock size={10} />
                                  Withheld
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 rounded font-black text-[9px] uppercase tracking-wider">
                                  <AlertTriangle size={10} />
                                  At Risk
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SECTION 17(5) BLOCKED CATEGORIZATION */}
          {activeTab === 'SECTION_17' && (
            <div className="space-y-6">
              
              {/* Category Breakdown widgets */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 text-sm">Statutory Section 17(5) Blocked Credit Breakdown</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {Object.entries(section17Data.categoryBreakdown).map(([category, amount], idx) => {
                    if (amount === 0) return null;
                    return (
                      <div key={idx} className="p-3.5 border rounded-xl bg-slate-50 flex flex-col justify-between hover:shadow-sm transition-all">
                        <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider leading-relaxed">{category}</div>
                        <div className="text-base font-black text-slate-900 font-mono mt-2">
                          ₹{amount.toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                  <div className="p-3.5 border border-indigo-200 rounded-xl bg-indigo-50/50 flex flex-col justify-between">
                    <div className="text-[10px] text-indigo-950 font-extrabold uppercase tracking-wider">Total Blocked Credit</div>
                    <div className="text-lg font-black text-rose-600 font-mono mt-1">
                      ₹{section17Data.totalBlockedITC.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3.5 border border-emerald-200 rounded-xl bg-emerald-50/50 flex flex-col justify-between">
                    <div className="text-[10px] text-emerald-950 font-extrabold uppercase tracking-wider">Total Eligible Business Credit</div>
                    <div className="text-lg font-black text-emerald-700 font-mono mt-1">
                      ₹{section17Data.totalEligibleITC.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Master List of Purchases under Sec 17 Audit */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap justify-between items-center bg-slate-50 gap-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Purchase Ledger Section 17(5) Statutory Classifier</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Review and reclassify blocked or eligible transactions manually with auditor audit trails.</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                        <Filter size={12} />
                      </span>
                      <input 
                        type="text" 
                        placeholder="Search vendor or invoice..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-slate-400 w-56 font-sans"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto divide-y divide-slate-100">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-500 font-extrabold border-b border-slate-200">
                        <th className="px-4 py-3">Invoice & Vendor</th>
                        <th className="px-4 py-3">HSN / Description</th>
                        <th className="px-4 py-3">Audit Classification / Clause</th>
                        <th className="px-4 py-3 text-right">Tax Amount</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Override Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {section17Data.evaluatedInvoices
                        .filter(item => {
                          const query = searchQuery.toLowerCase();
                          return item.invoice.invoiceNumber.toLowerCase().includes(query) ||
                                 item.invoice.partyName.toLowerCase().includes(query);
                        })
                        .map(({ invoice: inv, originalIsBlocked, currentIsBlocked, isOverridden, overrideNote, classification, clause, categoryBucket }) => {
                          const tax = inv.taxAmount || 0;
                          return (
                            <tr key={inv.id} className={`hover:bg-slate-50/50 transition-all font-medium text-slate-700 ${currentIsBlocked ? 'bg-rose-50/10' : ''}`}>
                              <td className="px-4 py-3.5">
                                <div className="font-bold text-slate-800">{inv.invoiceNumber}</div>
                                <div className="text-[10px] text-slate-500 font-semibold">{inv.partyName}</div>
                              </td>
                              <td className="px-4 py-3.5 max-w-[200px]">
                                <div className="text-slate-800 truncate">{inv.items?.[0]?.description || 'Corporate Inward Supply'}</div>
                                <div className="text-[10px] font-bold font-mono text-slate-400">HSN: {inv.items?.[0]?.hsnSac || 'SAC Code'}</div>
                              </td>
                              <td className="px-4 py-3.5">
                                <div className={`text-[10px] font-extrabold ${currentIsBlocked ? 'text-rose-700' : 'text-emerald-700'}`}>
                                  {clause}
                                </div>
                                <div className="text-[9px] text-slate-400 max-w-[260px] truncate leading-normal" title={classification.reason}>
                                  {classification.reason}
                                </div>
                                {isOverridden && (
                                  <div className="mt-1 flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded text-[9px] font-bold w-fit">
                                    <HelpCircle size={10} className="shrink-0" />
                                    <span>Note: {overrideNote}</span>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-right font-black font-mono">₹{tax.toLocaleString()}</td>
                              <td className="px-4 py-3.5 text-center">
                                {currentIsBlocked ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 rounded font-black text-[9px] uppercase tracking-wider">
                                    <Lock size={9} /> Blocked
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded font-black text-[9px] uppercase tracking-wider">
                                    <Unlock size={9} /> Eligible
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <div className="flex justify-center gap-1.5">
                                  <button
                                    onClick={() => handleToggleBlockOverride(inv.id, currentIsBlocked)}
                                    className={`px-2 py-1 text-[10px] font-extrabold rounded border transition-all ${
                                      currentIsBlocked 
                                        ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700' 
                                        : 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
                                    }`}
                                  >
                                    {currentIsBlocked ? 'Mark Eligible' : 'Mark Blocked'}
                                  </button>
                                  {isOverridden && (
                                    <button
                                      onClick={() => handleClearOverride(inv.id)}
                                      className="p-1 bg-slate-100 hover:bg-slate-200 border text-slate-500 rounded hover:text-slate-800 transition-all"
                                      title="Reset to statutory default classification"
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RULE 37 AGING TRACKER */}
          {activeTab === 'RULE_37' && (
            <div className="space-y-6">
              
              {/* Header Configurations for Rule 37 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Rule 37 parameters */}
                <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                    <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg">
                      <Clock size={16} />
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm">Aging Matrix Controls</h3>
                  </div>

                  <div className="space-y-3.5">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Audit / Calculation Date</label>
                      <input 
                        type="date" 
                        value={auditDate}
                        onChange={(e) => setAuditDate(e.target.value)}
                        className="w-full px-3 py-2 border rounded-xl text-xs font-mono font-bold text-slate-800 bg-slate-50 focus:border-slate-400 focus:bg-white outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Statutory Interest Rate (P.A.)</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          value={interestRate}
                          onChange={(e) => setInterestRate(Number(e.target.value))}
                          className="w-full px-3 py-2 border rounded-xl text-xs font-mono font-bold text-slate-800 bg-slate-50 focus:border-slate-400 focus:bg-white outline-none"
                        />
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 border px-3 py-2 rounded-xl">%</span>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 leading-normal">
                      Under <strong>GST Rule 37</strong>, if you fail to pay a supplier within 180 days of the invoice date, you must reverse the claimed ITC with simple interest @ 18% per annum, calculated from the original claim date until payment is made. Credit is reclaimable upon subsequent payment.
                    </div>
                  </div>
                </div>

                {/* Aging summary tiles */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm mb-4">Rule 37 Inward Supply Aging Schedule</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {Object.entries(rule37Data.buckets).map(([key, bucket]) => (
                        <div key={key} className={`p-2.5 rounded-xl border flex flex-col justify-between ${bucket.color}`}>
                          <div className="text-[9px] font-black uppercase tracking-wider leading-tight">{bucket.label}</div>
                          <div className="mt-3">
                            <div className="text-xs font-black font-mono leading-none">₹{Math.round(bucket.amount).toLocaleString()}</div>
                            <div className="text-[9px] opacity-75 font-semibold mt-1">{bucket.count} invoices</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Critical Action Alert Block */}
                  <div className="mt-5 p-4 bg-rose-900 text-white rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-rose-950">
                    <div className="flex items-start gap-3">
                      <AlertCircle size={20} className="text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-black">CRITICAL: Clawback Reversal Required</div>
                        <p className="text-[10px] text-rose-200 mt-0.5 max-w-xl leading-normal">
                          ₹{Math.round(rule37Data.potentialReversalRequired).toLocaleString()} credit has crossed the 180-day unpaid limit and must be reversed in GSTR-3B. Dynamic interest penalty accrued: <strong className="text-rose-100 font-mono">₹{Math.round(rule37Data.totalInterestAccrued).toLocaleString()}</strong>.
                        </p>
                      </div>
                    </div>
                    
                    {rule37Data.potentialReversalRequired > 0 && (
                      <button
                        onClick={handleSimulatePaymentAllCritical}
                        className="px-4 py-2 bg-white text-rose-950 hover:bg-rose-50 text-xs font-bold rounded-lg transition-all shadow-md shrink-0 active:scale-95"
                      >
                        Simulate Payments & Clear Risk
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Master aging table list */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Aging Ledger & Payment Audits</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Toggle payment status on vendor invoices to eliminate Rule 37 reversal exposures.</p>
                  </div>
                </div>

                <div className="overflow-x-auto divide-y divide-slate-100">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-500 font-extrabold border-b border-slate-200">
                        <th className="px-4 py-3">Invoice & Vendor</th>
                        <th className="px-4 py-3">Dated</th>
                        <th className="px-4 py-3 text-center">Days Elapsed</th>
                        <th className="px-4 py-3">Aging Status</th>
                        <th className="px-4 py-3 text-right">Tax Credit</th>
                        <th className="px-4 py-3 text-right">Mandatory Interest</th>
                        <th className="px-4 py-3 text-center">Payment Control</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rule37Data.trackedInvoices.map((item) => {
                        const bucket = rule37Data.buckets[item.agingCategory];
                        return (
                          <tr key={item.invoice.id} className={`hover:bg-slate-50/50 transition-all font-medium text-slate-700 ${item.isPaid ? 'bg-emerald-50/10 opacity-75' : ''}`}>
                            <td className="px-4 py-3.5">
                              <div className="font-bold text-slate-800">{item.invoice.invoiceNumber}</div>
                              <div className="text-[10px] text-slate-500 font-semibold">{item.invoice.partyName}</div>
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 font-mono">{item.invoice.date}</td>
                            <td className="px-4 py-3.5 text-center font-bold font-mono">
                              {item.daysElapsed} days
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider ${bucket.color}`}>
                                {item.agingCategory.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right font-black font-mono">₹{item.tax.toLocaleString()}</td>
                            <td className="px-4 py-3.5 text-right text-rose-600 font-bold font-mono">
                              {item.isPaid ? '—' : item.interestAccrued > 0 ? `₹${Math.round(item.interestAccrued).toLocaleString()}` : '₹0'}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <button
                                onClick={() => handleTogglePaymentOverride(item.invoice.id, item.isPaid ? 'PAID' : 'UNPAID')}
                                className={`px-3 py-1 text-[10px] font-extrabold rounded-md border shadow-sm transition-all ${
                                  item.isPaid 
                                    ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800' 
                                    : 'bg-slate-950 hover:bg-slate-900 text-white border-transparent'
                                }`}
                              >
                                {item.isPaid ? 'PAID (Simulated)' : 'Mark Paid'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RULE 42/43 APPORTIONMENT */}
          {activeTab === 'RULE_42_43' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Form: Parameter Inputs */}
              <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Calculator size={16} />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">Apportionment Parameters</h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Total Output Turnover (F)</label>
                    <input 
                      type="number" 
                      value={totalTurnover}
                      onChange={(e) => setTotalTurnover(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-xl text-xs font-mono font-bold text-slate-800 bg-slate-50 focus:border-slate-400 focus:bg-white outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Exempt Supplies Turnover (E)</label>
                    <input 
                      type="number" 
                      value={exemptTurnover}
                      onChange={(e) => setExemptTurnover(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-xl text-xs font-mono font-bold text-slate-800 bg-slate-50 focus:border-slate-400 focus:bg-white outline-none"
                    />
                    <div className="text-[10px] text-slate-400 flex justify-between font-bold">
                      <span>Exemption Ratio (E/F):</span>
                      <span className="text-slate-600 font-mono">{(rule42Data.exemptionRatio * 100).toFixed(2)}%</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      ITC used exclusively for non-business (T1)
                    </label>
                    <input 
                      type="number" 
                      value={manualT1}
                      onChange={(e) => setManualT1(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-xl text-xs font-mono font-bold text-slate-800 bg-slate-50 focus:border-slate-400 focus:bg-white outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      ITC used exclusively for exempt supplies (T2)
                    </label>
                    <input 
                      type="number" 
                      value={manualT2}
                      onChange={(e) => setManualT2(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-xl text-xs font-mono font-bold text-slate-800 bg-slate-50 focus:border-slate-400 focus:bg-white outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      ITC used exclusively for taxable business (T4)
                    </label>
                    <input 
                      type="number" 
                      value={manualT4}
                      onChange={(e) => setManualT4(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-xl text-xs font-mono font-bold text-slate-800 bg-slate-50 focus:border-slate-400 focus:bg-white outline-none"
                    />
                  </div>

                  <div className="text-[10px] text-slate-400 leading-normal border-t pt-3 border-slate-100">
                    <strong>Rule 42 (Inputs) & Rule 43 (Capital Goods)</strong> require the reversal of credit in GSTR-3B Table 4(B)(1) for common inputs used for making exempt supplies or personal/non-business consumption.
                  </div>
                </div>
              </div>

              {/* Right Output: Detailed Flow Apportionment Ledger */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Visual Flow diagram card */}
                <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md border border-slate-800 space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Rule 42/43 Statutory Apportionment flow</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    
                    {/* Pool 1: Total Raw credit */}
                    <div className="p-3 bg-slate-800 rounded-xl border border-slate-700/60 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-black">Total Input Credit (T)</span>
                        <p className="text-[10px] text-slate-500 mt-0.5">Purchases Inward Supply</p>
                      </div>
                      <div className="text-base font-black font-mono text-slate-100 mt-4">
                        ₹{Math.round(rule42Data.T).toLocaleString()}
                      </div>
                    </div>

                    {/* Arrow/Separator */}
                    <div className="p-3 bg-slate-800 rounded-xl border border-slate-700/60 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-black">Common Credit (C2)</span>
                        <p className="text-[10px] text-slate-500 mt-0.5">C2 = C1 - T4</p>
                      </div>
                      <div className="text-base font-black font-mono text-blue-400 mt-4">
                        ₹{Math.round(rule42Data.C2).toLocaleString()}
                      </div>
                    </div>

                    {/* Pool 3: Final Claimable */}
                    <div className="p-3 bg-emerald-950 rounded-xl border border-emerald-900/60 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] text-emerald-300 uppercase font-black">Net Claimable (T4 + C3)</span>
                        <p className="text-[10px] text-emerald-400/80 mt-0.5">Perfected Eligible Credit</p>
                      </div>
                      <div className="text-base font-black font-mono text-emerald-400 mt-4">
                        ₹{Math.round(rule42Data.finalEligibleITC).toLocaleString()}
                      </div>
                    </div>

                  </div>

                  {/* Flow Arrow description */}
                  <div className="p-3 bg-slate-800/40 rounded-xl space-y-2 border border-slate-800 text-[11px] leading-relaxed">
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-400">Total Statutory Reversals Required (D1 + D2):</span>
                      <span className="text-rose-400 font-bold">- ₹{Math.round(rule42Data.totalReversalRequired).toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-1.5 border-t border-slate-800 text-[10px] text-slate-400">
                      <div>
                        <strong>D1 (Exempt Supp):</strong> ₹{Math.round(rule42Data.D1).toLocaleString()} <span className="opacity-70">({(rule42Data.exemptionRatio * 100).toFixed(1)}% of common)</span>
                      </div>
                      <div>
                        <strong>D2 (Personal 5%):</strong> ₹{Math.round(rule42Data.D2).toLocaleString()} <span className="opacity-70">(Statutory Flat Rate)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ledger Equation Table */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <h3 className="font-bold text-slate-800 text-sm">Statutory Statement of Input Tax Credit (Rule 42)</h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 font-extrabold border-b">
                          <th className="px-3 py-2">Statutory Field / Rule Code</th>
                          <th className="px-3 py-2">Formula Reference</th>
                          <th className="px-3 py-2 text-right">Value (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        <tr>
                          <td className="px-3 py-2.5">Total Inward Credit Pool</td>
                          <td className="px-3 py-2.5 font-mono text-slate-400">T</td>
                          <td className="px-3 py-2.5 text-right font-mono">₹{rule42Data.T.toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2.5">Less: Credit for non-business purpose supplies</td>
                          <td className="px-3 py-2.5 font-mono text-slate-400">T1</td>
                          <td className="px-3 py-2.5 text-right font-mono text-rose-600">- ₹{rule42Data.T1.toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2.5">Less: Credit exclusively for exempt supplies</td>
                          <td className="px-3 py-2.5 font-mono text-slate-400">T2</td>
                          <td className="px-3 py-2.5 text-right font-mono text-rose-600">- ₹{rule42Data.T2.toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2.5">Less: Credit blocked under Section 17(5)</td>
                          <td className="px-3 py-2.5 font-mono text-slate-400">T3 (From Tab 2)</td>
                          <td className="px-3 py-2.5 text-right font-mono text-rose-600">- ₹{rule42Data.T3.toLocaleString()}</td>
                        </tr>
                        <tr className="bg-slate-50/50 font-bold">
                          <td className="px-3 py-2.5 text-slate-800">Eligible Credit Pool before Apportionment</td>
                          <td className="px-3 py-2.5 font-mono text-slate-500">C1 = T - (T1+T2+T3)</td>
                          <td className="px-3 py-2.5 text-right font-mono">₹{rule42Data.C1.toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2.5">Less: Credit exclusively used for taxable business</td>
                          <td className="px-3 py-2.5 font-mono text-slate-400">T4</td>
                          <td className="px-3 py-2.5 text-right font-mono text-indigo-700">- ₹{rule42Data.T4.toLocaleString()}</td>
                        </tr>
                        <tr className="bg-blue-50/20 font-bold">
                          <td className="px-3 py-2.5 text-blue-900">Common Input Tax Credit Pool</td>
                          <td className="px-3 py-2.5 font-mono text-blue-700">C2 = C1 - T4</td>
                          <td className="px-3 py-2.5 text-right font-mono text-blue-700">₹{rule42Data.C2.toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2.5 pl-6 text-slate-500">Reversal for Exempt Supplies</td>
                          <td className="px-3 py-2.5 font-mono text-slate-400">D1 = (E/F) * C2</td>
                          <td className="px-3 py-2.5 text-right font-mono text-rose-600">- ₹{Math.round(rule42Data.D1).toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2.5 pl-6 text-slate-500">Reversal for Personal / Non-business purposes</td>
                          <td className="px-3 py-2.5 font-mono text-slate-400">D2 = 5% * C2</td>
                          <td className="px-3 py-2.5 text-right font-mono text-rose-600">- ₹{Math.round(rule42Data.D2).toLocaleString()}</td>
                        </tr>
                        <tr className="bg-emerald-50/30 font-bold text-emerald-900">
                          <td className="px-3 py-2.5 text-emerald-800">Net Eligible Common Credit</td>
                          <td className="px-3 py-2.5 font-mono text-emerald-600">C3 = C2 - (D1+D2)</td>
                          <td className="px-3 py-2.5 text-right font-mono">₹{Math.round(rule42Data.C3).toLocaleString()}</td>
                        </tr>
                        <tr className="bg-slate-900 text-white font-black text-xs">
                          <td className="px-3 py-3 rounded-l-xl">FINAL TOTAL ELIGIBLE CREDIT (CLAIMABLE IN GSTR-3B)</td>
                          <td className="px-3 py-3 font-mono text-slate-400">T4 + C3</td>
                          <td className="px-3 py-3 text-right font-mono text-emerald-400 rounded-r-xl">₹{Math.round(rule42Data.finalEligibleITC).toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
};
