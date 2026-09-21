import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Sliders, Calculator, TrendingDown, TrendingUp, Sparkles, 
  ShieldAlert, DollarSign, CheckCircle2, AlertTriangle, RefreshCw, 
  ArrowRight, FileText, Layers, Info, RotateCcw, HelpCircle, 
  Lightbulb, Plus, Minus, Scale, Percent, Save, Download, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, ReferenceLine } from 'recharts';
import { fetchTaxComputation, fetchInvoices } from '../services/api';
import { exportToCSV } from '../utils/export';

interface WhatIfSimulationToolProps {
  tenantId: string;
  baselineData?: any;
  onApplyScenario?: (simulatedTax: any) => void;
}

export const WhatIfSimulationTool: React.FC<WhatIfSimulationToolProps> = ({
  tenantId,
  baselineData,
  onApplyScenario
}) => {
  // Fetch default computation if baselineData not provided
  const { data: fetchedTaxData, isLoading } = useQuery({
    queryKey: ['taxComputation', tenantId],
    queryFn: () => fetchTaxComputation(tenantId),
    enabled: !baselineData
  });

  const actualData = baselineData || fetchedTaxData;

  // Base values from actual data
  const baseSalesTaxable = actualData ? 3250000 : 3000000;
  const baseOutputIgst = actualData?.outputLiability?.igst || 315000;
  const baseOutputCgst = actualData?.outputLiability?.cgst || 135000;
  const baseOutputSgst = actualData?.outputLiability?.sgst || 135000;
  const baseOutputTotal = baseOutputIgst + baseOutputCgst + baseOutputSgst;

  const baseItcIgst = actualData?.inputTaxCredit?.igst || 240000;
  const baseItcCgst = actualData?.inputTaxCredit?.cgst || 110000;
  const baseItcSgst = actualData?.inputTaxCredit?.sgst || 110000;
  const baseItcBlocked = actualData?.inputTaxCredit?.blocked || 25000;
  const baseItcTotal = baseItcIgst + baseItcCgst + baseItcSgst;

  // --- DRAFT INVOICES SANDBOX STATE & QUERY ---
  const { data: invoices, isLoading: isInvoicesLoading } = useQuery({
    queryKey: ['invoices', tenantId],
    queryFn: () => fetchInvoices(tenantId)
  });

  const [adjustedInvoices, setAdjustedInvoices] = useState<Record<string, { taxRate?: number; isBlockedItc?: boolean }>>({});

  const sandboxAdjustments = useMemo(() => {
    if (!invoices) return { outputIgst: 0, outputCgst: 0, outputSgst: 0, outputTotal: 0, itcIgst: 0, itcCgst: 0, itcSgst: 0, itcTotal: 0, modifiedCount: 0 };
    
    let outputIgst = 0;
    let outputCgst = 0;
    let outputSgst = 0;
    let outputTotal = 0;

    let itcIgst = 0;
    let itcCgst = 0;
    let itcSgst = 0;
    let itcTotal = 0;

    let modifiedCount = 0;

    invoices.forEach(inv => {
      const adj = adjustedInvoices[inv.id];
      if (!adj) return;

      modifiedCount++;
      const originalTax = inv.taxAmount;
      const originalRate = inv.items && inv.items[0] ? inv.items[0].taxRate : 18;
      
      let simulatedTax = originalTax;
      if (adj.taxRate !== undefined && adj.taxRate !== originalRate) {
        simulatedTax = Math.round(inv.amount * (adj.taxRate / 100));
      }

      const isIgst = inv.taxDetails?.igst > 0 || (inv.placeOfSupply && inv.placeOfSupply !== '27');

      if (inv.category === 'SALES') {
        const delta = simulatedTax - originalTax;
        outputTotal += delta;
        if (isIgst) {
          outputIgst += delta;
        } else {
          outputCgst += Math.round(delta / 2);
          outputSgst += Math.round(delta / 2);
        }
      } else if (inv.category === 'PURCHASE') {
        const originalIsBlocked = inv.isBlockedItc ?? false;
        const simulatedIsBlocked = adj.isBlockedItc !== undefined ? adj.isBlockedItc : originalIsBlocked;

        const originalItc = originalIsBlocked ? 0 : originalTax;
        const simulatedItc = simulatedIsBlocked ? 0 : simulatedTax;

        const delta = simulatedItc - originalItc;
        itcTotal += delta;
        if (isIgst) {
          itcIgst += delta;
        } else {
          itcCgst += Math.round(delta / 2);
          itcSgst += Math.round(delta / 2);
        }
      }
    });

    return { outputIgst, outputCgst, outputSgst, outputTotal, itcIgst, itcCgst, itcSgst, itcTotal, modifiedCount };
  }, [invoices, adjustedInvoices]);

  // --- SIMULATION ADJUSTMENT CONTROLS STATE ---
  // Sales & Output Tax Controls
  const [salesVolumePct, setSalesVolumePct] = useState<number>(0); // -50% to +50%
  const [unbilledSalesValue, setUnbilledSalesValue] = useState<number>(0);
  const [rcmPurchaseValue, setRcmPurchaseValue] = useState<number>(0);
  const [avgGstRate, setAvgGstRate] = useState<number>(18); // 5, 12, 18, 28%

  // Purchase & ITC Claim Controls
  const [purchaseItcPct, setPurchaseItcPct] = useState<number>(0); // -50% to +50%
  const [sec17BlockedPct, setSec17BlockedPct] = useState<number>(5); // % of ITC to block under 17(5)
  const [vendorRiskHaircutPct, setVendorRiskHaircutPct] = useState<number>(0); // % withheld due to 2B mismatch
  const [openingCreditIgst, setOpeningCreditIgst] = useState<number>(25000);
  const [openingCreditCgst, setOpeningCreditCgst] = useState<number>(12000);
  const [openingCreditSgst, setOpeningCreditSgst] = useState<number>(12000);
  const [pendingCreditNotes, setPendingCreditNotes] = useState<number>(10000);

  // Active Preset Flag
  const [activePreset, setActivePreset] = useState<string>('BASELINE');
  const [isSavedAlert, setIsSavedAlert] = useState<boolean>(false);

  // Quick Preset Scenarios
  const applyPreset = (presetKey: string) => {
    setActivePreset(presetKey);
    switch (presetKey) {
      case 'BASELINE':
        setSalesVolumePct(0);
        setUnbilledSalesValue(0);
        setRcmPurchaseValue(0);
        setAvgGstRate(18);
        setPurchaseItcPct(0);
        setSec17BlockedPct(5);
        setVendorRiskHaircutPct(0);
        setOpeningCreditIgst(25000);
        setOpeningCreditCgst(12000);
        setOpeningCreditSgst(12000);
        setPendingCreditNotes(10000);
        break;
      case 'REVENUE_SPIKE':
        setSalesVolumePct(25);
        setUnbilledSalesValue(250000);
        setPurchaseItcPct(10);
        setSec17BlockedPct(5);
        setVendorRiskHaircutPct(0);
        break;
      case 'VENDOR_DEFAULT_RISK':
        setSalesVolumePct(0);
        setVendorRiskHaircutPct(15); // 15% ITC lost to non-filing vendors
        setSec17BlockedPct(8);
        break;
      case 'CONSERVATIVE_AUDIT':
        setSalesVolumePct(0);
        setSec17BlockedPct(15); // Strict 17(5) reversal
        setVendorRiskHaircutPct(10);
        setPendingCreditNotes(0);
        break;
      case 'MAX_ITC_CLAIM':
        setSalesVolumePct(0);
        setPurchaseItcPct(15);
        setSec17BlockedPct(0);
        setVendorRiskHaircutPct(0);
        setPendingCreditNotes(25000);
        break;
      default:
        break;
    }
  };

  // --- REAL-TIME SIMULATION ENGINE ---
  const simulation = useMemo(() => {
    // 1. Output Tax Calculations
    const salesVolumeMultiplier = 1 + salesVolumePct / 100;
    const simSalesTaxable = Math.round((baseSalesTaxable * salesVolumeMultiplier) + unbilledSalesValue);
    
    // Scale Output Liability proportionally with sales volume, and add draft sales invoice sandbox adjustments
    const simOutputIgst = Math.round(baseOutputIgst * salesVolumeMultiplier + (unbilledSalesValue * 0.18 * 0.5)) + sandboxAdjustments.outputIgst;
    const simOutputCgst = Math.round(baseOutputCgst * salesVolumeMultiplier + (unbilledSalesValue * 0.18 * 0.25)) + sandboxAdjustments.outputCgst;
    const simOutputSgst = Math.round(baseOutputSgst * salesVolumeMultiplier + (unbilledSalesValue * 0.18 * 0.25)) + sandboxAdjustments.outputSgst;

    // RCM Output Tax (payable in cash, then claimable as ITC)
    const simRcmIgst = Math.round(rcmPurchaseValue * 0.18 * 0.5);
    const simRcmCgst = Math.round(rcmPurchaseValue * 0.18 * 0.25);
    const simRcmSgst = Math.round(rcmPurchaseValue * 0.18 * 0.25);
    const simRcmTotal = simRcmIgst + simRcmCgst + simRcmSgst;

    const simGrossOutputIgst = simOutputIgst + simRcmIgst;
    const simGrossOutputCgst = simOutputCgst + simRcmCgst;
    const simGrossOutputSgst = simOutputSgst + simRcmSgst;
    const simGrossOutputTotal = simGrossOutputIgst + simGrossOutputCgst + simGrossOutputSgst;

    // 2. Input Tax Credit (ITC) Calculations
    const purchaseItcMultiplier = 1 + purchaseItcPct / 100;
    const rawItcIgst = (baseItcIgst * purchaseItcMultiplier) + (simRcmIgst) + sandboxAdjustments.itcIgst;
    const rawItcCgst = (baseItcCgst * purchaseItcMultiplier) + (simRcmCgst) + sandboxAdjustments.itcCgst;
    const rawItcSgst = (baseItcSgst * purchaseItcMultiplier) + (simRcmSgst) + sandboxAdjustments.itcSgst;
    const rawItcTotal = rawItcIgst + rawItcCgst + rawItcSgst;

    // Deduct Blocked ITC under Sec 17(5)
    const blockedItcAmount = Math.round(rawItcTotal * (sec17BlockedPct / 100));
    const eligibleFactorAfterBlock = 1 - (sec17BlockedPct / 100);

    // Deduct Vendor Default Risk Haircut (2B Mismatch)
    const vendorRiskHaircutAmount = Math.round(rawItcTotal * (vendorRiskHaircutPct / 100));
    const eligibleFactorAfterVendorRisk = 1 - (vendorRiskHaircutPct / 100);

    const netPurchasesItcIgst = Math.max(0, Math.round(rawItcIgst * eligibleFactorAfterBlock * eligibleFactorAfterVendorRisk));
    const netPurchasesItcCgst = Math.max(0, Math.round(rawItcCgst * eligibleFactorAfterBlock * eligibleFactorAfterVendorRisk));
    const netPurchasesItcSgst = Math.max(0, Math.round(rawItcSgst * eligibleFactorAfterBlock * eligibleFactorAfterVendorRisk));

    // Add Opening Balances & Pending Credit Notes
    const totalAvailIgst = netPurchasesItcIgst + openingCreditIgst + Math.round(pendingCreditNotes * 0.5);
    const totalAvailCgst = netPurchasesItcCgst + openingCreditCgst + Math.round(pendingCreditNotes * 0.25);
    const totalAvailSgst = netPurchasesItcSgst + openingCreditSgst + Math.round(pendingCreditNotes * 0.25);
    const totalAvailCreditTotal = totalAvailIgst + totalAvailCgst + totalAvailSgst;

    // --- RULE 88A SET-OFF ALGORITHM ---
    // Step 1: IGST Credit Set-off
    const setOff_igst_igst = Math.min(totalAvailIgst, simGrossOutputIgst);
    let rem_cred_igst = totalAvailIgst - setOff_igst_igst;
    let rem_out_igst = simGrossOutputIgst - setOff_igst_igst;

    const setOff_igst_cgst = Math.min(rem_cred_igst, simGrossOutputCgst);
    rem_cred_igst -= setOff_igst_cgst;
    let rem_out_cgst = simGrossOutputCgst - setOff_igst_cgst;

    const setOff_igst_sgst = Math.min(rem_cred_igst, simGrossOutputSgst);
    rem_cred_igst -= setOff_igst_sgst;
    let rem_out_sgst = simGrossOutputSgst - setOff_igst_sgst;

    // Step 2: CGST Credit Set-off
    const setOff_cgst_cgst = Math.min(totalAvailCgst, rem_out_cgst);
    let rem_cred_cgst = totalAvailCgst - setOff_cgst_cgst;
    rem_out_cgst -= setOff_cgst_cgst;

    const setOff_cgst_igst = Math.min(rem_cred_cgst, rem_out_igst);
    rem_cred_cgst -= setOff_cgst_igst;
    rem_out_igst -= setOff_cgst_igst;

    // Step 3: SGST Credit Set-off
    const setOff_sgst_sgst = Math.min(totalAvailSgst, rem_out_sgst);
    let rem_cred_sgst = totalAvailSgst - setOff_sgst_sgst;
    rem_out_sgst -= setOff_sgst_sgst;

    const setOff_sgst_igst = Math.min(rem_cred_sgst, rem_out_igst);
    rem_cred_sgst -= setOff_sgst_igst;
    rem_out_igst -= setOff_sgst_igst;

    // Final Net Cash Payable
    const netCashIgst = rem_out_igst;
    const netCashCgst = rem_out_cgst;
    const netCashSgst = rem_out_sgst;
    const totalSimNetCashPayable = netCashIgst + netCashCgst + netCashSgst;

    // Carry Forward Credit
    const totalCarryForwardCredit = rem_cred_igst + rem_cred_cgst + rem_cred_sgst;

    // BASELINE NET CASH PAYABLE FOR COMPARISON
    // (Simple baseline math)
    const baseAvailTotal = baseItcTotal + openingCreditIgst + openingCreditCgst + openingCreditSgst + pendingCreditNotes - baseItcBlocked;
    const baseBaselineNetCash = Math.max(0, baseOutputTotal - baseAvailTotal);

    // Delta Calculations
    const cashOutflowDelta = totalSimNetCashPayable - baseBaselineNetCash;
    const outputTaxDelta = simGrossOutputTotal - baseOutputTotal;
    const availItcDelta = totalAvailCreditTotal - baseAvailTotal;

    return {
      simSalesTaxable,
      simGrossOutputIgst,
      simGrossOutputCgst,
      simGrossOutputSgst,
      simGrossOutputTotal,
      simRcmTotal,
      
      blockedItcAmount,
      vendorRiskHaircutAmount,
      totalAvailIgst,
      totalAvailCgst,
      totalAvailSgst,
      totalAvailCreditTotal,

      // Setoff breakdown
      setOff_igst_igst,
      setOff_igst_cgst,
      setOff_igst_sgst,
      setOff_cgst_cgst,
      setOff_cgst_igst,
      setOff_sgst_sgst,
      setOff_sgst_igst,

      netCashIgst,
      netCashCgst,
      netCashSgst,
      totalSimNetCashPayable,
      totalCarryForwardCredit,

      // Comparison deltas
      baseBaselineNetCash,
      cashOutflowDelta,
      outputTaxDelta,
      availItcDelta
    };
  }, [
    baseSalesTaxable, baseOutputIgst, baseOutputCgst, baseOutputSgst, baseOutputTotal,
    baseItcIgst, baseItcCgst, baseItcSgst, baseItcBlocked, baseItcTotal,
    salesVolumePct, unbilledSalesValue, rcmPurchaseValue, avgGstRate,
    purchaseItcPct, sec17BlockedPct, vendorRiskHaircutPct,
    openingCreditIgst, openingCreditCgst, openingCreditSgst, pendingCreditNotes, sandboxAdjustments
  ]);

  // Chart Comparison Data
  const chartData = [
    {
      metric: 'Gross Output Tax',
      Baseline: baseOutputTotal,
      Simulated: simulation.simGrossOutputTotal,
    },
    {
      metric: 'Available ITC',
      Baseline: baseItcTotal + openingCreditIgst + openingCreditCgst + openingCreditSgst,
      Simulated: simulation.totalAvailCreditTotal,
    },
    {
      metric: 'Net Cash Outflow',
      Baseline: simulation.baseBaselineNetCash,
      Simulated: simulation.totalSimNetCashPayable,
    },
    {
      metric: 'Carry Forward Credit',
      Baseline: Math.max(0, (baseItcTotal + openingCreditIgst + openingCreditCgst + openingCreditSgst) - baseOutputTotal),
      Simulated: simulation.totalCarryForwardCredit,
    }
  ];

  const handleExportScenario = () => {
    const reportData = [
      { Parameter: 'Simulation Scenario Preset', Value: activePreset },
      { Parameter: 'Sales Revenue Taxable (Simulated)', Value: `₹${simulation.simSalesTaxable.toLocaleString()}` },
      { Parameter: 'Gross Output Tax Liability', Value: `₹${simulation.simGrossOutputTotal.toLocaleString()}` },
      { Parameter: 'Raw Inward ITC Available', Value: `₹${(baseItcTotal * (1 + purchaseItcPct / 100)).toLocaleString()}` },
      { Parameter: 'Section 17(5) Blocked Reversal', Value: `₹${simulation.blockedItcAmount.toLocaleString()}` },
      { Parameter: 'Vendor Non-Filing Withholding', Value: `₹${simulation.vendorRiskHaircutAmount.toLocaleString()}` },
      { Parameter: 'Total Claimable ITC (incl Opening Bal)', Value: `₹${simulation.totalAvailCreditTotal.toLocaleString()}` },
      { Parameter: 'Simulated Net Cash Liability', Value: `₹${simulation.totalSimNetCashPayable.toLocaleString()}` },
      { Parameter: 'Carry Forward Credit Balance', Value: `₹${simulation.totalCarryForwardCredit.toLocaleString()}` },
      { Parameter: 'Net Cash Impact vs Baseline', Value: `₹${simulation.cashOutflowDelta.toLocaleString()}` }
    ];

    exportToCSV(reportData, `GST_WhatIf_Simulation_${activePreset}_${new Date().toISOString().slice(0, 10)}`);
  };

  const handleApplyScenario = () => {
    setIsSavedAlert(true);
    if (onApplyScenario) {
      onApplyScenario(simulation);
    }
    setTimeout(() => setIsSavedAlert(false), 3500);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden space-y-6">
      {/* Simulation Header */}
      <div className="p-6 md:p-8 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 right-1/3 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30 backdrop-blur-md shrink-0">
                <Sliders size={26} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl md:text-2xl font-black tracking-tight text-white">
                    'What-if' GST Liability & Credit Simulator
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                    Live Engine
                  </span>
                </div>
                <p className="text-slate-400 text-xs md:text-sm font-medium mt-0.5">
                  Adjust invoice inputs, vendor compliance assumptions, and credit claims to forecast total GST cash outflows before filing GSTR-3B.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleExportScenario}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <Download size={14} /> Export CSV
              </button>
              <button
                onClick={() => applyPreset('BASELINE')}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          </div>

          {/* Quick Scenario Preset Selector Bar */}
          <div className="pt-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Sparkles size={12} className="text-amber-400" /> One-Click Simulation Presets:
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'BASELINE', label: 'Actual Baseline', icon: CheckCircle2, color: 'hover:border-slate-400' },
                { id: 'REVENUE_SPIKE', label: '🚀 +25% Sales Growth', icon: TrendingUp, color: 'hover:border-emerald-400' },
                { id: 'VENDOR_DEFAULT_RISK', label: '⚠️ 15% Vendor 2B Default', icon: AlertTriangle, color: 'hover:border-amber-400' },
                { id: 'CONSERVATIVE_AUDIT', label: '🛡️ Sec 17(5) Reversal (15%)', icon: ShieldAlert, color: 'hover:border-rose-400' },
                { id: 'MAX_ITC_CLAIM', label: '⚡ Max ITC Optimization', icon: Sparkles, color: 'hover:border-blue-400' }
              ].map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    activePreset === preset.id
                      ? 'bg-amber-400 text-slate-950 font-black border-amber-300 shadow-md scale-105'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-800 ' + preset.color
                  }`}
                >
                  <preset.icon size={13} />
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Controls & Results Section */}
      <div className="p-6 md:p-8 space-y-8">
        {/* KPI Difference Header Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Simulated Net Cash Outflow */}
          <div className="p-5 rounded-2xl bg-slate-900 text-white shadow-md border border-slate-800 space-y-2 relative overflow-hidden">
            <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Simulated Cash Outflow</span>
              <Calculator size={16} className="text-amber-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-amber-300">
                ₹{simulation.totalSimNetCashPayable.toLocaleString()}
              </span>
              <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                simulation.cashOutflowDelta < 0 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                  : simulation.cashOutflowDelta > 0 
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {simulation.cashOutflowDelta < 0 ? <ArrowDownRight size={13} /> : simulation.cashOutflowDelta > 0 ? <ArrowUpRight size={13} /> : null}
                {simulation.cashOutflowDelta === 0 ? 'No Change' : `₹${Math.abs(simulation.cashOutflowDelta).toLocaleString()}`}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {simulation.cashOutflowDelta < 0 
                ? '🎉 Projected cash savings vs baseline' 
                : simulation.cashOutflowDelta > 0 
                ? '⚠️ Additional cash required at filing' 
                : 'Matches current return computation'}
            </p>
          </div>

          {/* Gross Output Liability */}
          <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-indigo-700 uppercase tracking-wider">
              <span>Gross Output Tax</span>
              <DollarSign size={16} className="text-indigo-600" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-indigo-950">
                ₹{simulation.simGrossOutputTotal.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-indigo-600">
                {salesVolumePct > 0 ? `+${salesVolumePct}% sales` : `${salesVolumePct}% sales`}
              </span>
            </div>
            <p className="text-[11px] text-indigo-600/80 font-medium">
              Base: ₹{baseOutputTotal.toLocaleString()} (Sales + RCM)
            </p>
          </div>

          {/* Total Claimable ITC */}
          <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-emerald-700 uppercase tracking-wider">
              <span>Claimable Input Credit</span>
              <ShieldAlert size={16} className="text-emerald-600" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-emerald-950">
                ₹{simulation.totalAvailCreditTotal.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                After Reversals
              </span>
            </div>
            <p className="text-[11px] text-emerald-600/80 font-medium">
              Sec 17(5) Blocked: -₹{simulation.blockedItcAmount.toLocaleString()}
            </p>
          </div>

          {/* Carry Forward Credit */}
          <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-blue-700 uppercase tracking-wider">
              <span>Credit Carry Forward</span>
              <Layers size={16} className="text-blue-600" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-blue-950">
                ₹{simulation.totalCarryForwardCredit.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-blue-600">Electronic Ledger</span>
            </div>
            <p className="text-[11px] text-blue-600/80 font-medium">
              Unutilized credit available for next month
            </p>
          </div>
        </div>

        {/* TWO-COLUMN INTERACTIVE INPUT SLIDERS & FIELD CONTROLS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* COLUMN 1: Outward Supplies & Output Tax Adjustments */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80 space-y-6">
            <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
              <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl font-bold">
                <TrendingUp size={18} />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-base">Outward Supplies & Output Tax Inputs</h4>
                <p className="text-xs text-slate-500">Adjust revenue forecast, GST slab mix, and unbilled sales</p>
              </div>
            </div>

            {/* Control 1: Sales Revenue Volume Shift Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                <label className="flex items-center gap-1.5">
                  <span>Sales Volume Delta (%):</span>
                  <span title="Simulates a percentage change in outward taxable sales revenue.">
                    <Info size={13} className="text-slate-400" />
                  </span>
                </label>
                <span className={`font-mono text-sm ${salesVolumePct > 0 ? 'text-emerald-600' : salesVolumePct < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {salesVolumePct > 0 ? `+${salesVolumePct}%` : `${salesVolumePct}%`}
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                step="5"
                value={salesVolumePct}
                onChange={(e) => {
                  setSalesVolumePct(Number(e.target.value));
                  setActivePreset('CUSTOM');
                }}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>-50% (Downturn)</span>
                <span>0% (Actual baseline)</span>
                <span>+50% (Spike)</span>
              </div>
            </div>

            {/* Control 2: Unbilled / Pending Outward Sales (₹ Value Input) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex justify-between items-center">
                <span>Unbilled / Pending Outward Sales (₹):</span>
                <span className="text-[10px] text-slate-400">Add late-issued invoices</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono font-bold">₹</span>
                <input
                  type="number"
                  step="10000"
                  value={unbilledSalesValue}
                  onChange={(e) => {
                    setUnbilledSalesValue(Math.max(0, Number(e.target.value)));
                    setActivePreset('CUSTOM');
                  }}
                  placeholder="e.g. 150000"
                  className="w-full h-10 pl-7 pr-3 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Control 3: RCM Inward Taxable Purchase Value */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex justify-between items-center">
                <span>RCM Inward Purchases (Reverse Charge Taxable ₹):</span>
                <span className="text-[10px] text-amber-600 font-bold">Paid in Cash, Claimed as ITC</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono font-bold">₹</span>
                <input
                  type="number"
                  step="5000"
                  value={rcmPurchaseValue}
                  onChange={(e) => {
                    setRcmPurchaseValue(Math.max(0, Number(e.target.value)));
                    setActivePreset('CUSTOM');
                  }}
                  placeholder="e.g. 50000"
                  className="w-full h-10 pl-7 pr-3 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Output Tax Breakdown Preview */}
            <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 text-xs space-y-2">
              <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">Projected Output Liability:</span>
              <div className="grid grid-cols-3 gap-2 text-center font-mono font-bold">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-sans">IGST</span>
                  ₹{simulation.simGrossOutputIgst.toLocaleString()}
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-sans">CGST</span>
                  ₹{simulation.simGrossOutputCgst.toLocaleString()}
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-sans">SGST</span>
                  ₹{simulation.simGrossOutputSgst.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* COLUMN 2: Inward Supplies & Input Tax Credit (ITC) Claims */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80 space-y-6">
            <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl font-bold">
                <ShieldAlert size={18} />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-base">Inward Purchases & ITC Claim Controls</h4>
                <p className="text-xs text-slate-500">Simulate vendor risk haircuts, Sec 17(5) reversals, and opening credits</p>
              </div>
            </div>

            {/* Control 1: Raw Inward ITC Claim Volume Adjustment */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                <label>Purchases ITC Volume Adjustment (%):</label>
                <span className={`font-mono text-sm ${purchaseItcPct > 0 ? 'text-emerald-600' : purchaseItcPct < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {purchaseItcPct > 0 ? `+${purchaseItcPct}%` : `${purchaseItcPct}%`}
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                step="5"
                value={purchaseItcPct}
                onChange={(e) => {
                  setPurchaseItcPct(Number(e.target.value));
                  setActivePreset('CUSTOM');
                }}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>-50% (Lower claims)</span>
                <span>0% (Actual)</span>
                <span>+50% (Higher claims)</span>
              </div>
            </div>

            {/* Control 2: Section 17(5) Blocked ITC Reversal % Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                <label className="flex items-center gap-1">
                  <span>Sec 17(5) Ineligible Blocked ITC Reversal:</span>
                  <span title="Motor vehicles, food/catering, personal consumption, lost goods blocked credit reversal.">
                    <Info size={13} className="text-slate-400" />
                  </span>
                </label>
                <span className="font-mono text-sm text-rose-600">
                  {sec17BlockedPct}% (-₹{simulation.blockedItcAmount.toLocaleString()})
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={sec17BlockedPct}
                onChange={(e) => {
                  setSec17BlockedPct(Number(e.target.value));
                  setActivePreset('CUSTOM');
                }}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0% (No reversal)</span>
                <span>15% (Audit standard)</span>
                <span>30% (High risk)</span>
              </div>
            </div>

            {/* Control 3: Vendor Default Risk / Rule 36(4) Haircut % Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                <label className="flex items-center gap-1">
                  <span>Vendor GSTR-2B Non-Filing Haircut (%):</span>
                  <span title="Simulates ITC withheld or unreflected in GSTR-2B due to non-filing vendors.">
                    <Info size={13} className="text-slate-400" />
                  </span>
                </label>
                <span className="font-mono text-sm text-amber-600">
                  {vendorRiskHaircutPct}% (-₹{simulation.vendorRiskHaircutAmount.toLocaleString()})
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="5"
                value={vendorRiskHaircutPct}
                onChange={(e) => {
                  setVendorRiskHaircutPct(Number(e.target.value));
                  setActivePreset('CUSTOM');
                }}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0% (100% compliant)</span>
                <span>15% (Moderate default)</span>
                <span>30% (High non-filers)</span>
              </div>
            </div>

            {/* Control 4: Opening Credit Balances & Credit Notes */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Opening IGST Credit (₹)</label>
                <input
                  type="number"
                  value={openingCreditIgst}
                  onChange={(e) => {
                    setOpeningCreditIgst(Math.max(0, Number(e.target.value)));
                    setActivePreset('CUSTOM');
                  }}
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Pending Credit Notes (₹)</label>
                <input
                  type="number"
                  value={pendingCreditNotes}
                  onChange={(e) => {
                    setPendingCreditNotes(Math.max(0, Number(e.target.value)));
                    setActivePreset('CUSTOM');
                  }}
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* COMPARISON RECHARTS VISUALIZATION CHART */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h4 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Scale size={18} className="text-amber-500" /> Scenario Visual Comparison: Baseline vs Simulated
              </h4>
              <p className="text-xs text-slate-500">Visualizing the financial shift across Gross Output, Inward Credit, and Net Cash Outflow.</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-400"></span> Actual Baseline</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500"></span> Simulated Scenario</span>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 15, right: 15, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="metric" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }} dy={5} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, '']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="Baseline" fill="#94a3b8" radius={[6, 6, 0, 0]} barSize={28} />
                <Bar dataKey="Simulated" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* DRAFT INVOICES SANDBOX CONTROLS */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
          <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                  <FileText size={16} />
                </span>
                <h4 className="font-extrabold text-slate-900 text-base">
                  Draft Invoices Sandbox
                </h4>
                {sandboxAdjustments.modifiedCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 animate-pulse">
                    {sandboxAdjustments.modifiedCount} Adjusted
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Simulate adjusting tax slabs or credit eligibility on specific draft invoices to calculate the precise monthly cash impact.
              </p>
            </div>

            {/* Clear Sandbox Adjustments */}
            {sandboxAdjustments.modifiedCount > 0 && (
              <button
                onClick={() => setAdjustedInvoices({})}
                className="text-xs text-rose-600 hover:text-rose-700 font-extrabold flex items-center gap-1 transition-colors self-start sm:self-center"
              >
                <RefreshCw size={12} className="animate-spin-slow" /> Reset Invoice Edits
              </button>
            )}
          </div>

          <div className="p-6">
            {isInvoicesLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <RefreshCw className="animate-spin text-slate-400" size={32} />
                <span className="text-xs font-bold text-slate-500">Loading draft invoices from pipeline...</span>
              </div>
            ) : !invoices || invoices.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs font-medium">
                No draft invoices found for the current workspace.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Scrollable table container */}
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                        <th className="py-3 px-4">Invoice No / Party</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4 text-right">Taxable Value</th>
                        <th className="py-3 px-4 text-center">Tax Slab (Adjustable)</th>
                        <th className="py-3 px-4 text-right">Calculated GST</th>
                        <th className="py-3 px-4 text-center">Eligibility / ITC Claims</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoices.map((inv) => {
                        const adj = adjustedInvoices[inv.id] || {};
                        const originalRate = inv.items && inv.items[0] ? inv.items[0].taxRate : 18;
                        const activeRate = adj.taxRate !== undefined ? adj.taxRate : originalRate;
                        
                        const isOriginalBlocked = inv.isBlockedItc ?? false;
                        const isActiveBlocked = adj.isBlockedItc !== undefined ? adj.isBlockedItc : isOriginalBlocked;

                        // Calculated values
                        const currentGst = adj.taxRate !== undefined && adj.taxRate !== originalRate 
                          ? Math.round(inv.amount * (adj.taxRate / 100))
                          : inv.taxAmount;

                        return (
                          <tr key={inv.id} className={`hover:bg-slate-50/50 transition-colors ${adj.taxRate !== undefined || adj.isBlockedItc !== undefined ? 'bg-amber-50/30' : ''}`}>
                            {/* Number & Party */}
                            <td className="py-3 px-4">
                              <div className="font-extrabold text-slate-900 font-mono">{inv.invoiceNumber}</div>
                              <div className="text-slate-500 text-[11px] font-medium mt-0.5">{inv.partyName}</div>
                            </td>

                            {/* Category Badge */}
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                inv.category === 'SALES' 
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' 
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              }`}>
                                {inv.category}
                              </span>
                            </td>

                            {/* Taxable Value */}
                            <td className="py-3 px-4 text-right font-bold font-mono text-slate-900">
                              ₹{inv.amount.toLocaleString()}
                            </td>

                            {/* Adjustable Tax Slab */}
                            <td className="py-3 px-4 text-center">
                              <select
                                value={activeRate}
                                onChange={(e) => {
                                  const rateVal = Number(e.target.value);
                                  setAdjustedInvoices(prev => ({
                                    ...prev,
                                    [inv.id]: {
                                      ...prev[inv.id],
                                      taxRate: rateVal
                                    }
                                  }));
                                  setActivePreset('CUSTOM');
                                }}
                                className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                              >
                                <option value={5}>5% (Low Slab)</option>
                                <option value={12}>12% (Standard)</option>
                                <option value={18}>18% (Standard)</option>
                                <option value={28}>28% (Luxury)</option>
                              </select>
                            </td>

                            {/* Calculated GST Amount */}
                            <td className="py-3 px-4 text-right">
                              <div className="font-bold font-mono text-slate-900">
                                ₹{currentGst.toLocaleString()}
                              </div>
                              {currentGst !== inv.taxAmount && (
                                <div className="text-[10px] font-bold text-amber-600 font-mono">
                                  {currentGst > inv.taxAmount ? '+' : ''}₹{(currentGst - inv.taxAmount).toLocaleString()}
                                </div>
                              )}
                            </td>

                            {/* Eligibility Toggle */}
                            <td className="py-3 px-4 text-center">
                              {inv.category === 'PURCHASE' ? (
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => {
                                      setAdjustedInvoices(prev => ({
                                        ...prev,
                                        [inv.id]: {
                                          ...prev[inv.id],
                                          isBlockedItc: !isActiveBlocked
                                        }
                                      }));
                                      setActivePreset('CUSTOM');
                                    }}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                      isActiveBlocked
                                        ? 'bg-rose-50 border-rose-200 text-rose-700 font-extrabold'
                                        : 'bg-emerald-50 border-emerald-200 text-emerald-700 font-extrabold'
                                    }`}
                                  >
                                    {isActiveBlocked ? '❌ Ineligible - Sec 17(5)' : '✅ Eligible ITC Claim'}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px] font-medium">N/A (Sales Outflow)</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Live Sandbox Analytics Banner */}
                <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-indigo-950">
                  <div className="flex items-center gap-2">
                    <span className="p-1 bg-indigo-100 text-indigo-700 rounded-md shrink-0">
                      <Scale size={14} />
                    </span>
                    <span>
                      Cumulative Sandbox Impact: Sales GST Delta: <strong className="font-mono text-indigo-900">{sandboxAdjustments.outputTotal >= 0 ? '+' : ''}₹{sandboxAdjustments.outputTotal.toLocaleString()}</strong> | Purchases Eligible ITC Delta: <strong className="font-mono text-emerald-700">{sandboxAdjustments.itcTotal >= 0 ? '+' : ''}₹{sandboxAdjustments.itcTotal.toLocaleString()}</strong>
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-100/50 px-2.5 py-1 rounded-lg">
                    Cascading Instantly
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RULE 88A SIMULATED CREDIT SET-OFF BREAKDOWN MATRIX */}
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div>
              <h4 className="font-extrabold text-amber-400 text-base flex items-center gap-2">
                <Calculator size={18} /> Rule 88A Set-off Execution Matrix (Simulated)
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">Automated priority utilization: IGST Credit first, followed by CGST & SGST credits.</p>
            </div>
            <span className="text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2.5 py-1 rounded-full uppercase tracking-wider">
              Optimal Priority
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase font-black tracking-widest">
                  <th className="py-2.5 px-3">Credit Head</th>
                  <th className="py-2.5 px-3">Available Credit</th>
                  <th className="py-2.5 px-3 text-right">Paid to IGST</th>
                  <th className="py-2.5 px-3 text-right">Paid to CGST</th>
                  <th className="py-2.5 px-3 text-right">Paid to SGST</th>
                  <th className="py-2.5 px-3 text-right font-bold text-amber-300">Remaining Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                <tr>
                  <td className="py-2.5 px-3 font-sans font-bold text-amber-400">IGST Credit</td>
                  <td className="py-2.5 px-3 font-bold">₹{simulation.totalAvailIgst.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-400">₹{simulation.setOff_igst_igst.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-400">₹{simulation.setOff_igst_cgst.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-400">₹{simulation.setOff_igst_sgst.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-300">
                    ₹{(simulation.totalAvailIgst - simulation.setOff_igst_igst - simulation.setOff_igst_cgst - simulation.setOff_igst_sgst).toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-sans font-bold text-indigo-400">CGST Credit</td>
                  <td className="py-2.5 px-3 font-bold">₹{simulation.totalAvailCgst.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-400">₹{simulation.setOff_cgst_igst.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-400">₹{simulation.setOff_cgst_cgst.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-slate-600">Blocked</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-300">
                    ₹{(simulation.totalAvailCgst - simulation.setOff_cgst_cgst - simulation.setOff_cgst_igst).toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-sans font-bold text-indigo-400">SGST Credit</td>
                  <td className="py-2.5 px-3 font-bold">₹{simulation.totalAvailSgst.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-400">₹{simulation.setOff_sgst_igst.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-slate-600">Blocked</td>
                  <td className="py-2.5 px-3 text-right text-emerald-400">₹{simulation.setOff_sgst_sgst.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-300">
                    ₹{(simulation.totalAvailSgst - simulation.setOff_sgst_sgst - simulation.setOff_sgst_igst).toLocaleString()}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-700 font-bold font-mono text-sm bg-slate-950/50">
                  <td className="py-3 px-3 font-sans text-rose-400">Net Cash Required (Post Set-off)</td>
                  <td className="py-3 px-3 text-slate-400">Cash Ledger</td>
                  <td className="py-3 px-3 text-right text-rose-300">₹{simulation.netCashIgst.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right text-rose-300">₹{simulation.netCashCgst.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right text-rose-300">₹{simulation.netCashSgst.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right text-amber-400 font-extrabold text-base">
                    ₹{simulation.totalSimNetCashPayable.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* SMART COMPLIANCE & CASH FLOW INSIGHTS */}
        <div className="bg-amber-50/80 border border-amber-200/80 p-5 rounded-2xl flex flex-col md:flex-row items-start gap-4">
          <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl font-bold shrink-0 mt-0.5">
            <Lightbulb size={22} />
          </div>
          <div className="space-y-1.5 flex-1">
            <h5 className="font-extrabold text-amber-950 text-sm flex items-center justify-between">
              <span>Simulation Executive Insights & Compliance Safeguards</span>
              {isSavedAlert && (
                <span className="text-xs bg-emerald-600 text-white px-2.5 py-0.5 rounded-full font-bold animate-in fade-in">
                  Target return updated!
                </span>
              )}
            </h5>
            <ul className="text-xs text-amber-900 space-y-1 list-disc list-inside font-medium leading-relaxed">
              {vendorRiskHaircutPct > 0 && (
                <li>
                  <strong className="text-amber-950">Rule 36(4) Risk Alert:</strong> Withholding {vendorRiskHaircutPct}% ITC protects against unreflected vendor invoices, keeping ₹{simulation.vendorRiskHaircutAmount.toLocaleString()} safe from demand notices.
                </li>
              )}
              {sec17BlockedPct > 0 && (
                <li>
                  <strong className="text-amber-950">Section 17(5) Reversal:</strong> Reversing {sec17BlockedPct}% ineligible ITC saves potential 24% p.a. interest penalties during GST audit.
                </li>
              )}
              {simulation.cashOutflowDelta < 0 && (
                <li>
                  <strong className="text-emerald-800">Cashflow Optimization:</strong> This scenario reduces your net cash outflow by ₹{Math.abs(simulation.cashOutflowDelta).toLocaleString()} compared to actual baseline.
                </li>
              )}
              <li>
                <strong className="text-amber-950">Rule 88A Compliance:</strong> IGST credit is 100% exhausted before applying CGST and SGST credits to maximize working capital.
              </li>
            </ul>
          </div>

          <div className="shrink-0 self-center md:self-end pt-2 md:pt-0">
            <button
              onClick={handleApplyScenario}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-300 font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 active:scale-95"
            >
              <Save size={15} /> Apply as Return Target
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatIfSimulationTool;
