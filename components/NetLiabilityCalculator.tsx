import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Calculator, CheckCircle2, ArrowRight, RefreshCw, Download, 
  Sparkles, ShieldCheck, HelpCircle, Info, Sliders, FileSpreadsheet,
  ArrowDownRight, Layers, DollarSign, Wallet
} from 'lucide-react';
import { fetchInvoices, fetchReconData } from '../services/api';
import { exportToCSV } from '../utils/export';

interface NetLiabilityCalculatorProps {
  tenantId: string;
  period?: string;
  onApplyTo3B?: () => void;
}

export const NetLiabilityCalculator: React.FC<NetLiabilityCalculatorProps> = ({
  tenantId,
  period = 'July 2024',
  onApplyTo3B
}) => {
  // Pending Credits Inputs (Opening Balances & Pending Credit Notes)
  const [openingIgst, setOpeningIgst] = useState<number>(28000);
  const [openingCgst, setOpeningCgst] = useState<number>(14500);
  const [openingSgst, setOpeningSgst] = useState<number>(14500);
  const [pendingCreditNotes, setPendingCreditNotes] = useState<number>(8000);

  // Filters
  const [onlyMatched, setOnlyMatched] = useState<boolean>(true);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [isCalculated, setIsCalculated] = useState<boolean>(true);
  const [notification, setNotification] = useState<string | null>(null);

  // Fetch Invoices & Recon Data
  const { data: invoices = [], isLoading: isInvoicesLoading, refetch: refetchInvoices } = useQuery({
    queryKey: ['invoices', tenantId],
    queryFn: () => fetchInvoices(tenantId)
  });

  const { data: reconItems = [], isLoading: isReconLoading, refetch: refetchRecon } = useQuery({
    queryKey: ['reconData', 'PURCHASE', tenantId],
    queryFn: () => fetchReconData('PURCHASE', tenantId)
  });

  const isSyncing = isInvoicesLoading || isReconLoading;

  const handleRefreshSync = async () => {
    await Promise.all([refetchInvoices(), refetchRecon()]);
    setNotification('Successfully synced latest reconciled invoice records!');
    setTimeout(() => setNotification(null), 3000);
  };

  // Compute Output Liability & Reconciled Purchase ITC
  const calculation = useMemo(() => {
    // 1. Output Tax Liability from Sales Invoices
    const salesInvoices = invoices.filter(inv => inv.category === 'SALES' && inv.status !== 'FAILED');
    
    let outIgst = 0;
    let outCgst = 0;
    let outSgst = 0;
    let outRcmIgst = 0;
    let outRcmCgst = 0;
    let outRcmSgst = 0;

    salesInvoices.forEach(inv => {
      outIgst += inv.taxDetails?.igst || 0;
      outCgst += inv.taxDetails?.cgst || 0;
      outSgst += inv.taxDetails?.sgst || 0;
    });

    // 2. Reconciled Purchase ITC
    const purchaseInvoices = invoices.filter(inv => inv.category === 'PURCHASE' && inv.status !== 'FAILED' && !inv.isBlockedItc);
    
    // Matched recon invoice numbers set
    const matchedInvoiceNumbers = new Set(
      reconItems.filter(r => r.status === 'MATCHED').map(r => r.invoiceNumber)
    );

    let reconPurchaseIgst = 0;
    let reconPurchaseCgst = 0;
    let reconPurchaseSgst = 0;
    let matchedCount = 0;
    let totalPurchaseCount = purchaseInvoices.length;

    purchaseInvoices.forEach(inv => {
      const isMatched = matchedInvoiceNumbers.has(inv.invoiceNumber) || inv.status === 'FILED' || inv.status === 'UPLOADED';
      
      if (!onlyMatched || isMatched) {
        if (isMatched) matchedCount++;
        reconPurchaseIgst += inv.taxDetails?.igst || 0;
        reconPurchaseCgst += inv.taxDetails?.cgst || 0;
        reconPurchaseSgst += inv.taxDetails?.sgst || 0;
      }

      if (inv.isRcm) {
        outRcmIgst += inv.taxDetails?.igst || 0;
        outRcmCgst += inv.taxDetails?.cgst || 0;
        outRcmSgst += inv.taxDetails?.sgst || 0;
      }
    });

    // Total Output Liability (including RCM payable in cash)
    const grossOutIgst = outIgst + outRcmIgst;
    const grossOutCgst = outCgst + outRcmCgst;
    const grossOutSgst = outSgst + outRcmSgst;
    const grossOutTotal = grossOutIgst + grossOutCgst + grossOutSgst;

    // Pending Credits Distribution
    const pendingIgstCredit = openingIgst + Math.round(pendingCreditNotes * 0.5);
    const pendingCgstCredit = openingCgst + Math.round(pendingCreditNotes * 0.25);
    const pendingSgstCredit = openingSgst + Math.round(pendingCreditNotes * 0.25);

    // Total Available Credit per head
    const totalAvailIgst = reconPurchaseIgst + pendingIgstCredit;
    const totalAvailCgst = reconPurchaseCgst + pendingCgstCredit;
    const totalAvailSgst = reconPurchaseSgst + pendingSgstCredit;
    const totalAvailTotal = totalAvailIgst + totalAvailCgst + totalAvailSgst;

    // --- RULE 88A SET-OFF ALGORITHM ---
    // Step 1: Utilize IGST Credit against Output IGST first
    const setOff_igst_igst = Math.min(totalAvailIgst, grossOutIgst);
    let rem_cred_igst = totalAvailIgst - setOff_igst_igst;
    let rem_out_igst = grossOutIgst - setOff_igst_igst;

    // Utilize remaining IGST Credit against Output CGST, then Output SGST
    const setOff_igst_cgst = Math.min(rem_cred_igst, grossOutCgst);
    rem_cred_igst -= setOff_igst_cgst;
    let rem_out_cgst = grossOutCgst - setOff_igst_cgst;

    const setOff_igst_sgst = Math.min(rem_cred_igst, grossOutSgst);
    rem_cred_igst -= setOff_igst_sgst;
    let rem_out_sgst = grossOutSgst - setOff_igst_sgst;

    // Step 2: Utilize CGST Credit against remaining CGST Output, then remaining IGST Output
    const setOff_cgst_cgst = Math.min(totalAvailCgst, rem_out_cgst);
    let rem_cred_cgst = totalAvailCgst - setOff_cgst_cgst;
    rem_out_cgst -= setOff_cgst_cgst;

    const setOff_cgst_igst = Math.min(rem_cred_cgst, rem_out_igst);
    rem_cred_cgst -= setOff_cgst_igst;
    rem_out_igst -= setOff_cgst_igst;

    // Step 3: Utilize SGST Credit against remaining SGST Output, then remaining IGST Output
    const setOff_sgst_sgst = Math.min(totalAvailSgst, rem_out_sgst);
    let rem_cred_sgst = totalAvailSgst - setOff_sgst_sgst;
    rem_out_sgst -= setOff_sgst_sgst;

    const setOff_sgst_igst = Math.min(rem_cred_sgst, rem_out_igst);
    rem_cred_sgst -= setOff_sgst_igst;
    rem_out_igst -= setOff_sgst_igst;

    // Summary Totals
    const totalSetOffIgst = setOff_igst_igst + setOff_cgst_igst + setOff_sgst_igst;
    const totalSetOffCgst = setOff_igst_cgst + setOff_cgst_cgst;
    const totalSetOffSgst = setOff_igst_sgst + setOff_sgst_sgst;
    const grandTotalSetOff = totalSetOffIgst + totalSetOffCgst + totalSetOffSgst;

    const netCashIgst = Math.max(0, rem_out_igst);
    const netCashCgst = Math.max(0, rem_out_cgst);
    const netCashSgst = Math.max(0, rem_out_sgst);
    const netCashTotal = netCashIgst + netCashCgst + netCashSgst;

    const closingIgst = Math.max(0, rem_cred_igst);
    const closingCgst = Math.max(0, rem_cred_cgst);
    const closingSgst = Math.max(0, rem_cred_sgst);
    const closingTotal = closingIgst + closingCgst + closingSgst;

    return {
      salesInvoiceCount: salesInvoices.length,
      matchedPurchaseCount: matchedCount,
      totalPurchaseCount,
      grossOutIgst,
      grossOutCgst,
      grossOutSgst,
      grossOutTotal,
      reconPurchaseIgst,
      reconPurchaseCgst,
      reconPurchaseSgst,
      pendingIgstCredit,
      pendingCgstCredit,
      pendingSgstCredit,
      totalAvailIgst,
      totalAvailCgst,
      totalAvailSgst,
      totalAvailTotal,
      setOff_igst_igst,
      setOff_igst_cgst,
      setOff_igst_sgst,
      setOff_cgst_cgst,
      setOff_cgst_igst,
      setOff_sgst_sgst,
      setOff_sgst_igst,
      totalSetOffIgst,
      totalSetOffCgst,
      totalSetOffSgst,
      grandTotalSetOff,
      netCashIgst,
      netCashCgst,
      netCashSgst,
      netCashTotal,
      closingIgst,
      closingCgst,
      closingSgst,
      closingTotal
    };
  }, [invoices, reconItems, onlyMatched, openingIgst, openingCgst, openingSgst, pendingCreditNotes]);

  const handleExportCSV = () => {
    const data = [
      { Category: 'Gross Output Liability', IGST: calculation.grossOutIgst, CGST: calculation.grossOutCgst, SGST: calculation.grossOutSgst, Total: calculation.grossOutTotal },
      { Category: 'Reconciled Purchase ITC', IGST: calculation.reconPurchaseIgst, CGST: calculation.reconPurchaseCgst, SGST: calculation.reconPurchaseSgst, Total: calculation.reconPurchaseIgst + calculation.reconPurchaseCgst + calculation.reconPurchaseSgst },
      { Category: 'Pending Credits & Opening Balances', IGST: calculation.pendingIgstCredit, CGST: calculation.pendingCgstCredit, SGST: calculation.pendingSgstCredit, Total: calculation.pendingIgstCredit + calculation.pendingCgstCredit + calculation.pendingSgstCredit },
      { Category: 'Total Available Credit', IGST: calculation.totalAvailIgst, CGST: calculation.totalAvailCgst, SGST: calculation.totalAvailSgst, Total: calculation.totalAvailTotal },
      { Category: 'Credit Set-Off Utilized', IGST: calculation.totalSetOffIgst, CGST: calculation.totalSetOffCgst, SGST: calculation.totalSetOffSgst, Total: calculation.grandTotalSetOff },
      { Category: 'NET CASH PAYABLE', IGST: calculation.netCashIgst, CGST: calculation.netCashCgst, SGST: calculation.netCashSgst, Total: calculation.netCashTotal },
      { Category: 'CLOSING CREDIT CARRYFORWARD', IGST: calculation.closingIgst, CGST: calculation.closingCgst, SGST: calculation.closingSgst, Total: calculation.closingTotal }
    ];
    exportToCSV(data, `Net_GST_Liability_Computation_${period.replace(/\s+/g, '_')}`);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 size={18} className="text-emerald-600"/>
            {notification}
          </div>
          <button onClick={() => setNotification(null)} className="text-xs font-bold text-emerald-700 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Header & Badges */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Calculator size={22} />
            </span>
            <div>
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                Automated Net GST Liability Engine
                <span className="text-[10px] font-black uppercase bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full tracking-wider">Rule 88A Compliant</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Auto-calculated from reconciled sales ({calculation.salesInvoiceCount} inv), purchase data ({calculation.matchedPurchaseCount} matched), and ledger pending credits for <span className="font-semibold text-slate-700">{period}</span>.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleRefreshSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
            title="Refresh Reconciled Invoices"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Syncing...' : 'Sync Reconciled'}
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold rounded-xl transition-all"
            title="Download CSV Statement"
          >
            <Download size={14} /> Export CSV
          </button>

          {onApplyTo3B && (
            <button
              onClick={onApplyTo3B}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold rounded-xl transition-all shadow-md active:scale-95"
            >
              <Sparkles size={14} /> Apply to GSTR-3B Draft
            </button>
          )}
        </div>
      </div>

      {/* Pending Credits & Adjustment Inputs */}
      <div className="bg-slate-50/80 rounded-xl p-5 border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200/60 pb-3">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-indigo-600" />
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Pending Credits & Opening Ledger Adjustments
            </h4>
          </div>
          
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 font-medium">
            <input 
              type="checkbox" 
              checked={onlyMatched} 
              onChange={(e) => setOnlyMatched(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <span>Strict Mode (Only Matched Reconciled Invoices)</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
              Opening IGST Credit (₹)
            </label>
            <input 
              type="number"
              value={openingIgst}
              onChange={(e) => setOpeningIgst(Number(e.target.value) || 0)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
            />
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
              Opening CGST Credit (₹)
            </label>
            <input 
              type="number"
              value={openingCgst}
              onChange={(e) => setOpeningCgst(Number(e.target.value) || 0)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
            />
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
              Opening SGST Credit (₹)
            </label>
            <input 
              type="number"
              value={openingSgst}
              onChange={(e) => setOpeningSgst(Number(e.target.value) || 0)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
            />
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
              Pending Credit Notes / Adj (₹)
            </label>
            <input 
              type="number"
              value={pendingCreditNotes}
              onChange={(e) => setPendingCreditNotes(Number(e.target.value) || 0)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      {/* Main Breakdown Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/80 text-slate-600 text-xs font-bold border-b border-slate-200 uppercase tracking-wider">
              <th className="py-3.5 px-6">Tax Computation Head</th>
              <th className="py-3.5 px-6 text-right">IGST (₹)</th>
              <th className="py-3.5 px-6 text-right">CGST (₹)</th>
              <th className="py-3.5 px-6 text-right">SGST (₹)</th>
              <th className="py-3.5 px-6 text-right font-black text-slate-800">Total (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm font-medium">
            {/* Row 1: Gross Output Liability */}
            <tr className="hover:bg-slate-50/80 transition-colors">
              <td className="py-3.5 px-6 text-slate-800 font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                Gross Output Tax Liability
              </td>
              <td className="py-3.5 px-6 text-right font-mono text-slate-700">₹ {calculation.grossOutIgst.toLocaleString()}</td>
              <td className="py-3.5 px-6 text-right font-mono text-slate-700">₹ {calculation.grossOutCgst.toLocaleString()}</td>
              <td className="py-3.5 px-6 text-right font-mono text-slate-700">₹ {calculation.grossOutSgst.toLocaleString()}</td>
              <td className="py-3.5 px-6 text-right font-mono font-bold text-rose-700">₹ {calculation.grossOutTotal.toLocaleString()}</td>
            </tr>

            {/* Row 2: Reconciled Purchase ITC */}
            <tr className="hover:bg-slate-50/80 transition-colors bg-emerald-50/20">
              <td className="py-3.5 px-6 text-slate-800 font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Reconciled Current Month ITC
              </td>
              <td className="py-3.5 px-6 text-right font-mono text-emerald-700">₹ {calculation.reconPurchaseIgst.toLocaleString()}</td>
              <td className="py-3.5 px-6 text-right font-mono text-emerald-700">₹ {calculation.reconPurchaseCgst.toLocaleString()}</td>
              <td className="py-3.5 px-6 text-right font-mono text-emerald-700">₹ {calculation.reconPurchaseSgst.toLocaleString()}</td>
              <td className="py-3.5 px-6 text-right font-mono font-bold text-emerald-700">
                ₹ {(calculation.reconPurchaseIgst + calculation.reconPurchaseCgst + calculation.reconPurchaseSgst).toLocaleString()}
              </td>
            </tr>

            {/* Row 3: Pending Credits & Ledger Adjustments */}
            <tr className="hover:bg-slate-50/80 transition-colors bg-indigo-50/20">
              <td className="py-3.5 px-6 text-slate-700 font-medium pl-8 flex items-center gap-2">
                <Layers size={14} className="text-indigo-500" />
                (+) Pending Balances & Credit Notes
              </td>
              <td className="py-3.5 px-6 text-right font-mono text-slate-600">₹ {calculation.pendingIgstCredit.toLocaleString()}</td>
              <td className="py-3.5 px-6 text-right font-mono text-slate-600">₹ {calculation.pendingCgstCredit.toLocaleString()}</td>
              <td className="py-3.5 px-6 text-right font-mono text-slate-600">₹ {calculation.pendingSgstCredit.toLocaleString()}</td>
              <td className="py-3.5 px-6 text-right font-mono text-slate-700 font-bold">
                ₹ {(calculation.pendingIgstCredit + calculation.pendingCgstCredit + calculation.pendingSgstCredit).toLocaleString()}
              </td>
            </tr>

            {/* Row 4: Total Available ITC */}
            <tr className="bg-slate-50 font-bold border-t border-slate-200">
              <td className="py-3.5 px-6 text-slate-800 uppercase tracking-wider text-xs">
                Total Available Input Tax Credit
              </td>
              <td className="py-3.5 px-6 text-right font-mono text-slate-800">₹ {calculation.totalAvailIgst.toLocaleString()}</td>
              <td className="py-3.5 px-6 text-right font-mono text-slate-800">₹ {calculation.totalAvailCgst.toLocaleString()}</td>
              <td className="py-3.5 px-6 text-right font-mono text-slate-800">₹ {calculation.totalAvailSgst.toLocaleString()}</td>
              <td className="py-3.5 px-6 text-right font-mono font-black text-indigo-700">₹ {calculation.totalAvailTotal.toLocaleString()}</td>
            </tr>

            {/* Row 5: Set-Off Credit Applied */}
            <tr className="hover:bg-slate-50/80 transition-colors">
              <td className="py-3.5 px-6 text-slate-600 italic">
                (-) ITC Set-Off Credit Utilized
              </td>
              <td className="py-3.5 px-6 text-right font-mono text-indigo-600">- ₹ {calculation.totalSetOffIgst.toLocaleString()}</td>
              <td className="py-3.5 px-6 text-right font-mono text-indigo-600">- ₹ {calculation.totalSetOffCgst.toLocaleString()}</td>
              <td className="py-3.5 px-6 text-right font-mono text-indigo-600">- ₹ {calculation.totalSetOffSgst.toLocaleString()}</td>
              <td className="py-3.5 px-6 text-right font-mono font-bold text-indigo-600">- ₹ {calculation.grandTotalSetOff.toLocaleString()}</td>
            </tr>

            {/* Highlighted Result 1: NET CASH PAYABLE */}
            <tr className="bg-amber-500/10 border-t-2 border-amber-300 font-bold text-amber-950">
              <td className="py-4 px-6 flex items-center gap-2 text-base">
                <Wallet size={20} className="text-amber-600" />
                NET GST PAYABLE IN CASH
              </td>
              <td className="py-4 px-6 text-right font-mono text-base">₹ {calculation.netCashIgst.toLocaleString()}</td>
              <td className="py-4 px-6 text-right font-mono text-base">₹ {calculation.netCashCgst.toLocaleString()}</td>
              <td className="py-4 px-6 text-right font-mono text-base">₹ {calculation.netCashSgst.toLocaleString()}</td>
              <td className="py-4 px-6 text-right font-mono text-lg font-black text-amber-700">
                ₹ {calculation.netCashTotal.toLocaleString()}
              </td>
            </tr>

            {/* Highlighted Result 2: CLOSING CREDIT CARRYFORWARD */}
            <tr className="bg-emerald-50 border-t border-emerald-200 font-bold text-emerald-950">
              <td className="py-4 px-6 flex items-center gap-2 text-base">
                <ShieldCheck size={20} className="text-emerald-600" />
                CLOSING ITC BALANCE CARRYFORWARD
              </td>
              <td className="py-4 px-6 text-right font-mono text-base text-emerald-800">₹ {calculation.closingIgst.toLocaleString()}</td>
              <td className="py-4 px-6 text-right font-mono text-base text-emerald-800">₹ {calculation.closingCgst.toLocaleString()}</td>
              <td className="py-4 px-6 text-right font-mono text-base text-emerald-800">₹ {calculation.closingSgst.toLocaleString()}</td>
              <td className="py-4 px-6 text-right font-mono text-lg font-black text-emerald-800">
                ₹ {calculation.closingTotal.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Accordion / Explanation Toggle */}
      <div className="pt-2">
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <HelpCircle size={15} />
          {showExplanation ? 'Hide Statutory Set-Off Rules Breakdown' : 'View Statutory Set-Off (Rule 88A) Breakdown Step-by-Step'}
        </button>

        {showExplanation && (
          <div className="mt-4 p-5 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-3 text-xs text-slate-700 animate-in fade-in">
            <h5 className="font-bold text-indigo-900 flex items-center gap-2">
              <Info size={16} className="text-indigo-600" />
              Statutory Set-Off Priority Logic (Section 49 / 49A / 49B & Rule 88A)
            </h5>
            <ul className="space-y-2 list-disc list-inside text-slate-600 leading-relaxed">
              <li>
                <span className="font-bold text-slate-800">Step 1 (IGST Credit):</span> Total available IGST Credit (₹{calculation.totalAvailIgst.toLocaleString()}) was applied to IGST liability first (₹{calculation.setOff_igst_igst.toLocaleString()}).
                {calculation.setOff_igst_cgst > 0 && ` Remaining IGST credit was cross-utilized against CGST liability (₹${calculation.setOff_igst_cgst.toLocaleString()}).`}
                {calculation.setOff_igst_sgst > 0 && ` Further remaining IGST credit was cross-utilized against SGST liability (₹${calculation.setOff_igst_sgst.toLocaleString()}).`}
              </li>
              <li>
                <span className="font-bold text-slate-800">Step 2 (CGST Credit):</span> CGST Credit (₹{calculation.totalAvailCgst.toLocaleString()}) was applied to remaining CGST liability (₹{calculation.setOff_cgst_cgst.toLocaleString()}).
                {calculation.setOff_cgst_igst > 0 && ` Remaining CGST credit was applied to IGST liability (₹${calculation.setOff_cgst_igst.toLocaleString()}).`}
              </li>
              <li>
                <span className="font-bold text-slate-800">Step 3 (SGST Credit):</span> SGST Credit (₹{calculation.totalAvailSgst.toLocaleString()}) was applied to remaining SGST liability (₹{calculation.setOff_sgst_sgst.toLocaleString()}).
                {calculation.setOff_sgst_igst > 0 && ` Remaining SGST credit was applied to IGST liability (₹${calculation.setOff_sgst_igst.toLocaleString()}).`}
              </li>
              <li className="text-amber-800 font-semibold">
                * Note: CGST Credit can NEVER be used to pay SGST liability, and SGST Credit can NEVER be used to pay CGST liability.
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetLiabilityCalculator;
