import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  Percent, 
  ShieldCheck, 
  Scale, 
  FileText, 
  Download, 
  Layers, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  RefreshCw, 
  Sliders, 
  Sparkles, 
  Search,
  Building2,
  DollarSign,
  Info
} from 'lucide-react';
import { 
  STATUTORY_SCHEDULES, 
  THRESHOLD_RULES, 
  CESS_SCHEDULES, 
  GSTTaxCalculator,
  StatutoryLiabilityComputationResult,
  LineItemTaxCalculation
} from '../services/gstEngine/taxCalculator';
import { Invoice } from '../types';

interface MultiTierTaxEngineModuleProps {
  invoices: Invoice[];
  currentTenantGstin?: string;
  onApplyToDraftFiling?: (result: StatutoryLiabilityComputationResult) => void;
}

export const MultiTierTaxEngineModule: React.FC<MultiTierTaxEngineModuleProps> = ({
  invoices,
  currentTenantGstin = '27ABCDE1234F1Z5',
  onApplyToDraftFiling
}) => {
  const [activeTab, setActiveTab] = useState<'SCHEDULE_EXPLORER' | 'VALUE_THRESHOLD' | 'LIABILITY_ENGINE'>('LIABILITY_ENGINE');
  const [searchTerm, setSearchTerm] = useState('');

  // Interactive Line Item Simulator State
  const [simItemName, setSimItemName] = useState('Cotton Apparel & Readymade Shirts');
  const [simHsn, setSimHsn] = useState('6109');
  const [simBaseRate, setSimBaseRate] = useState<number>(12);
  const [simUnitPrice, setSimUnitPrice] = useState<number>(850); // Under 1000 threshold
  const [simQuantity, setSimQuantity] = useState<number>(50);
  const [simSupplierState, setSimSupplierState] = useState('27'); // MH
  const [simPosState, setSimPosState] = useState('27'); // MH (Intra-state)
  const [simIsSez, setSimIsSez] = useState(false);
  const [simIsExport, setSimIsExport] = useState(false);
  const [simCessPercent, setSimCessPercent] = useState<number>(0);
  const [simSpecificCess, setSimSpecificCess] = useState<number>(0);

  // Automated Liability Engine Inputs State
  const [openingIgst, setOpeningIgst] = useState<number>(125000);
  const [openingCgst, setOpeningCgst] = useState<number>(45000);
  const [openingSgst, setOpeningSgst] = useState<number>(45000);
  const [delayDays, setDelayDays] = useState<number>(0);

  // Compute Line Item Simulation
  const lineItemCalc: LineItemTaxCalculation = useMemo(() => {
    const totalTaxable = simUnitPrice * simQuantity;
    return GSTTaxCalculator.calculateLineItem(
      totalTaxable,
      simBaseRate,
      simHsn,
      simUnitPrice,
      simQuantity,
      simSupplierState,
      simPosState,
      simIsSez,
      false,
      simIsExport,
      simCessPercent,
      simSpecificCess
    );
  }, [simUnitPrice, simQuantity, simBaseRate, simHsn, simSupplierState, simPosState, simIsSez, simIsExport, simCessPercent, simSpecificCess]);

  // Compute Automated Tax Liability
  const liabilityResult: StatutoryLiabilityComputationResult = useMemo(() => {
    const outward = invoices.filter(i => i.category === 'SALES');
    const inward = invoices.filter(i => i.category === 'PURCHASE');
    return GSTTaxCalculator.calculateAutomatedTaxLiability(
      outward,
      inward,
      { igst: openingIgst, cgst: openingCgst, sgst: openingSgst },
      'July 2026',
      delayDays
    );
  }, [invoices, openingIgst, openingCgst, openingSgst, delayDays]);

  // Filtered statutory schedules
  const filteredSchedules = useMemo(() => {
    if (!searchTerm) return STATUTORY_SCHEDULES;
    const term = searchTerm.toLowerCase();
    return STATUTORY_SCHEDULES.filter(s => 
      s.label.toLowerCase().includes(term) ||
      s.category.toLowerCase().includes(term) ||
      s.description.toLowerCase().includes(term) ||
      s.examples.some(e => e.toLowerCase().includes(term))
    );
  }, [searchTerm]);

  const handleExportCertificate = () => {
    const reportText = `
GST STATUTORY TAX LIABILITY & RULE 88A SET-OFF AUDIT CERTIFICATE
===================================================================
GSTIN: ${currentTenantGstin}
Filing Period: ${liabilityResult.period}
Generated Date: ${new Date().toLocaleString()}

1. GROSS OUTPUT TAX LIABILITY
-----------------------------
Gross Taxable Value: ₹${liabilityResult.grossOutputTax.taxableValue.toLocaleString()}
- IGST: ₹${liabilityResult.grossOutputTax.igst.toLocaleString()}
- CGST: ₹${liabilityResult.grossOutputTax.cgst.toLocaleString()}
- SGST: ₹${liabilityResult.grossOutputTax.sgst.toLocaleString()}
- UTGST: ₹${liabilityResult.grossOutputTax.utgst.toLocaleString()}
- Compensation Cess: ₹${liabilityResult.grossOutputTax.cess.toLocaleString()}

2. MANDATORY REVERSE CHARGE (RCM) CASH LIABILITY
------------------------------------------------
- Inward RCM Taxable Value: ₹${liabilityResult.rcmLiability.taxableValue.toLocaleString()}
- Mandatory RCM Cash Payable: ₹${liabilityResult.rcmLiability.cashPayableMandatory.toLocaleString()}

3. INPUT TAX CREDIT (ITC) POSITION
----------------------------------
- Eligible Purchase ITC: ₹${liabilityResult.eligibleInputTaxCredit.igst + liabilityResult.eligibleInputTaxCredit.cgst + liabilityResult.eligibleInputTaxCredit.sgst}
- Section 17(5) Blocked ITC Reversal: ₹${liabilityResult.ineligibleBlockedItc.toLocaleString()}
- Total Available IGST Credit: ₹${liabilityResult.netAvailableItc.igst.toLocaleString()}
- Total Available CGST Credit: ₹${liabilityResult.netAvailableItc.cgst.toLocaleString()}
- Total Available SGST Credit: ₹${liabilityResult.netAvailableItc.sgst.toLocaleString()}

4. RULE 88A SET-OFF WATERFALL MATRIX
------------------------------------
- IGST Credit -> IGST Output: ₹${liabilityResult.setOffMatrix.igst_igst.toLocaleString()}
- IGST Credit -> CGST Output: ₹${liabilityResult.setOffMatrix.igst_cgst.toLocaleString()}
- IGST Credit -> SGST Output: ₹${liabilityResult.setOffMatrix.igst_sgst.toLocaleString()}
- CGST Credit -> CGST Output: ₹${liabilityResult.setOffMatrix.cgst_cgst.toLocaleString()}
- SGST Credit -> SGST Output: ₹${liabilityResult.setOffMatrix.sgst_sgst.toLocaleString()}
- Total Statutory Credit Discharged: ₹${liabilityResult.setOffMatrix.grandTotalSetOff.toLocaleString()}

5. NET CASH OUTFLOW & COMPLIANCE SUMMARY
-----------------------------------------
- Regular Net Cash Tax Payable: ₹${liabilityResult.netCashPayable.totalCashPayable.toLocaleString()}
- Mandatory RCM Cash: ₹${liabilityResult.rcmLiability.cashPayableMandatory.toLocaleString()}
- Statutory Delay Interest (Sec 50 @ 18% p.a.): ₹${liabilityResult.statutoryInterestSec50.toLocaleString()}
- Statutory Late Fees (Sec 47): ₹${liabilityResult.statutoryLateFees.toLocaleString()}
- TOTAL MANDATORY CASH OUTFLOW: ₹${liabilityResult.totalOutflowRequired.toLocaleString()}
- Closing Electronic Credit Ledger Carryforward: ₹${liabilityResult.closingCreditLedger.totalCarryforward.toLocaleString()}
===================================================================
Certified by TaxFlow GST Compliance Audit Engine.
    `;

    const blob = new Blob([reportText.trim()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GST_Statutory_Tax_Liability_${liabilityResult.period.replace(' ', '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header Bar */}
      <div className="p-6 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Statutory GST Engine 2.0
            </span>
            <span className="text-xs text-slate-400">Rule 88A & Section 49 Compliant</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Multi-Tier Statutory Rate & Liability Engine</h2>
          <p className="text-sm text-slate-300 mt-0.5">
            Automated statutory rate computation, dynamic value thresholds, compensation cess schedules, and Rule 88A tax set-off waterfall.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={handleExportCertificate}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-sm font-semibold transition border border-slate-700 shadow-sm"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            Audit Certificate
          </button>
          {onApplyToDraftFiling && (
            <button
              onClick={() => onApplyToDraftFiling(liabilityResult)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition shadow-md shadow-indigo-600/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              Apply to GSTR-3B Draft
            </button>
          )}
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="border-b border-slate-200 bg-slate-50/80 px-6 pt-3 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('LIABILITY_ENGINE')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'LIABILITY_ENGINE'
              ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg shadow-xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 rounded-t-lg'
          }`}
        >
          <Scale className="w-4 h-4" />
          Automated Net Tax Liability & Rule 88A Waterfall
        </button>

        <button
          onClick={() => setActiveTab('SCHEDULE_EXPLORER')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'SCHEDULE_EXPLORER'
              ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg shadow-xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 rounded-t-lg'
          }`}
        >
          <Percent className="w-4 h-4" />
          Statutory Schedule Tiers (0% - 28%)
        </button>

        <button
          onClick={() => setActiveTab('VALUE_THRESHOLD')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'VALUE_THRESHOLD'
              ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg shadow-xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 rounded-t-lg'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Value Threshold & Cess Simulator
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="p-6">
        {/* TAB 1: AUTOMATED NET LIABILITY ENGINE */}
        {activeTab === 'LIABILITY_ENGINE' && (
          <div className="space-[#12]">
            {/* Input Adjustment Bar */}
            <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-5 mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-900 text-base">Filing Controls & Electronic Ledger Balances</h3>
                </div>
                <span className="text-xs text-indigo-700 bg-indigo-100 px-3 py-1 rounded-full font-medium">
                  Dynamic Set-Off Simulator
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Opening IGST Credit Ledger
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm">₹</span>
                    <input
                      type="number"
                      value={openingIgst}
                      onChange={(e) => setOpeningIgst(Number(e.target.value) || 0)}
                      className="w-full pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Opening CGST Credit Ledger
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm">₹</span>
                    <input
                      type="number"
                      value={openingCgst}
                      onChange={(e) => setOpeningCgst(Number(e.target.value) || 0)}
                      className="w-full pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Opening SGST Credit Ledger
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm">₹</span>
                    <input
                      type="number"
                      value={openingSgst}
                      onChange={(e) => setOpeningSgst(Number(e.target.value) || 0)}
                      className="w-full pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Filing Delay (Days)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={delayDays}
                      min={0}
                      onChange={(e) => setDelayDays(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400">Sec 50 Interest</span>
                  </div>
                </div>
              </div>
            </div>

            {/* High-Level Statutory Computation Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Gross Output Tax</span>
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-700">
                    <Calculator className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-slate-900">
                  ₹{(liabilityResult.grossOutputTax.igst + liabilityResult.grossOutputTax.cgst + liabilityResult.grossOutputTax.sgst + liabilityResult.grossOutputTax.utgst + liabilityResult.grossOutputTax.cess).toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Taxable Sales: ₹{liabilityResult.grossOutputTax.taxableValue.toLocaleString()}
                </p>
              </div>

              <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Net Available ITC</span>
                  <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-emerald-900">
                  ₹{(liabilityResult.netAvailableItc.igst + liabilityResult.netAvailableItc.cgst + liabilityResult.netAvailableItc.sgst).toLocaleString()}
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  Blocked Reversal: ₹{liabilityResult.ineligibleBlockedItc.toLocaleString()}
                </p>
              </div>

              <div className="p-5 rounded-xl border border-indigo-200 bg-indigo-50/40 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Rule 88A Credit Used</span>
                  <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-indigo-900">
                  ₹{liabilityResult.setOffMatrix.grandTotalSetOff.toLocaleString()}
                </p>
                <p className="text-xs text-indigo-700 mt-1">
                  Credit Discharged 100% Compliant
                </p>
              </div>

              <div className="p-5 rounded-xl border border-rose-200 bg-rose-50/40 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">Total Mandatory Cash</span>
                  <div className="p-2 bg-rose-100 rounded-lg text-rose-700">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-rose-900">
                  ₹{liabilityResult.totalOutflowRequired.toLocaleString()}
                </p>
                <p className="text-xs text-rose-700 mt-1">
                  Regular Tax + RCM + Interest
                </p>
              </div>
            </div>

            {/* Rule 88A Set-off Matrix Waterfall */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Scale className="w-5 h-5 text-indigo-600" />
                    Statutory Rule 88A Set-off Waterfall Matrix
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Order of utilization: IGST credit must be fully exhausted against IGST, CGST & SGST before CGST/SGST credits can be utilized.
                  </p>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">
                  Rule 88A Enforcement Active
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 text-xs uppercase font-bold border-b border-slate-200">
                      <th className="py-3 px-4">Tax Head</th>
                      <th className="py-3 px-4 text-right">Output Tax Liability</th>
                      <th className="py-3 px-4 text-right">Total Avail. Credit</th>
                      <th className="py-3 px-4 text-right">Set-off vs IGST</th>
                      <th className="py-3 px-4 text-right">Set-off vs CGST</th>
                      <th className="py-3 px-4 text-right">Set-off vs SGST</th>
                      <th className="py-3 px-4 text-right font-black text-rose-700">Net Cash Payable</th>
                      <th className="py-3 px-4 text-right font-black text-emerald-700">Carryforward Ledger</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm text-slate-800">
                    <tr className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-bold text-indigo-900 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                        IGST (Integrated)
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold">
                        ₹{(liabilityResult.grossOutputTax.igst + liabilityResult.rcmLiability.igst).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-emerald-700">
                        ₹{liabilityResult.netAvailableItc.igst.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium bg-indigo-50/50 text-indigo-900">
                        ₹{liabilityResult.setOffMatrix.igst_igst.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium bg-indigo-50/50 text-indigo-900">
                        ₹{liabilityResult.setOffMatrix.igst_cgst.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium bg-indigo-50/50 text-indigo-900">
                        ₹{liabilityResult.setOffMatrix.igst_sgst.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-rose-700">
                        ₹{liabilityResult.netCashPayable.igst.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-700">
                        ₹{liabilityResult.closingCreditLedger.igst.toLocaleString()}
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-bold text-blue-900 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                        CGST (Central)
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold">
                        ₹{(liabilityResult.grossOutputTax.cgst + liabilityResult.rcmLiability.cgst).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-emerald-700">
                        ₹{liabilityResult.netAvailableItc.cgst.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium bg-blue-50/50 text-blue-900">
                        ₹{liabilityResult.setOffMatrix.cgst_igst.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium bg-blue-50/50 text-blue-900">
                        ₹{liabilityResult.setOffMatrix.cgst_cgst.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-400 bg-slate-100/50">
                        N/A
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-rose-700">
                        ₹{liabilityResult.netCashPayable.cgst.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-700">
                        ₹{liabilityResult.closingCreditLedger.cgst.toLocaleString()}
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-bold text-purple-900 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                        SGST / UTGST (State)
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold">
                        ₹{(liabilityResult.grossOutputTax.sgst + liabilityResult.rcmLiability.sgst).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-emerald-700">
                        ₹{liabilityResult.netAvailableItc.sgst.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium bg-purple-50/50 text-purple-900">
                        ₹{liabilityResult.setOffMatrix.sgst_igst.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-400 bg-slate-100/50">
                        N/A
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium bg-purple-50/50 text-purple-900">
                        ₹{liabilityResult.setOffMatrix.sgst_sgst.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-rose-700">
                        ₹{liabilityResult.netCashPayable.sgst.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-700">
                        ₹{liabilityResult.closingCreditLedger.sgst.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-bold text-sm">
                      <td className="py-3.5 px-4">TOTALS</td>
                      <td className="py-3.5 px-4 text-right">
                        ₹{(liabilityResult.grossOutputTax.igst + liabilityResult.grossOutputTax.cgst + liabilityResult.grossOutputTax.sgst + liabilityResult.rcmLiability.cashPayableMandatory).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right text-emerald-400">
                        ₹{(liabilityResult.netAvailableItc.igst + liabilityResult.netAvailableItc.cgst + liabilityResult.netAvailableItc.sgst).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right text-indigo-300">
                        ₹{(liabilityResult.setOffMatrix.igst_igst + liabilityResult.setOffMatrix.cgst_igst + liabilityResult.setOffMatrix.sgst_igst).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right text-indigo-300">
                        ₹{(liabilityResult.setOffMatrix.igst_cgst + liabilityResult.setOffMatrix.cgst_cgst).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right text-indigo-300">
                        ₹{(liabilityResult.setOffMatrix.igst_sgst + liabilityResult.setOffMatrix.sgst_sgst).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right text-rose-300 font-black">
                        ₹{liabilityResult.netCashPayable.totalCashPayable.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right text-emerald-300 font-black">
                        ₹{liabilityResult.closingCreditLedger.totalCarryforward.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Reverse Charge & Late Fee Statutory Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Mandatory RCM Breakdown */}
              <div className="p-5 border border-amber-200 bg-amber-50/30 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h4 className="font-bold text-amber-900 text-base">Section 9(3) Reverse Charge (RCM) Position</h4>
                </div>
                <p className="text-xs text-amber-800 mb-4">
                  RCM liability must be paid strictly in cash via Electronic Cash Ledger. Equivalent ITC becomes available in the same month after cash payment.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-amber-200/60">
                    <span className="text-slate-600">RCM Inward Taxable Value</span>
                    <span className="font-semibold text-slate-900">₹{liabilityResult.rcmLiability.taxableValue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-amber-200/60">
                    <span className="text-slate-600">RCM IGST / CGST / SGST</span>
                    <span className="font-semibold text-slate-900">₹{liabilityResult.rcmLiability.cashPayableMandatory.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2 font-bold text-amber-900 text-base">
                    <span>Mandatory RCM Cash Outflow</span>
                    <span>₹{liabilityResult.rcmLiability.cashPayableMandatory.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Statutory Late Fees & Interest */}
              <div className="p-5 border border-rose-200 bg-rose-50/30 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-5 h-5 text-rose-600" />
                  <h4 className="font-bold text-rose-900 text-base">Statutory Delayed Filing Penalty & Interest</h4>
                </div>
                <p className="text-xs text-rose-800 mb-4">
                  Section 50 charges 18% p.a. interest on net cash tax liability. Section 47 levies ₹50/day late fee for delayed filing.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-rose-200/60">
                    <span className="text-slate-600">Delayed Days</span>
                    <span className="font-semibold text-slate-900">{delayDays} Days</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-rose-200/60">
                    <span className="text-slate-600">Section 50 Interest (@ 18% p.a.)</span>
                    <span className="font-semibold text-rose-700">₹{liabilityResult.statutoryInterestSec50.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-rose-200/60">
                    <span className="text-slate-600">Section 47 Late Fees (₹50/day)</span>
                    <span className="font-semibold text-rose-700">₹{liabilityResult.statutoryLateFees.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2 font-bold text-rose-900 text-base">
                    <span>Total Penalty & Interest</span>
                    <span>₹{(liabilityResult.statutoryInterestSec50 + liabilityResult.statutoryLateFees).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STATUTORY SCHEDULE TIERS */}
        {activeTab === 'SCHEDULE_EXPLORER' && (
          <div>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Statutory GST Schedule Directory (0% - 28%)</h3>
                <p className="text-xs text-slate-500">
                  Comprehensive 10-tier statutory schedule schedule matrix as per CGST Act & CBIC Notifications.
                </p>
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search rates, HSN, categories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSchedules.map((tier) => (
                <div
                  key={tier.rate}
                  className={`p-5 rounded-2xl border transition shadow-xs hover:shadow-md ${tier.color}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-black">{tier.rate}% GST</span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/80 border border-current shadow-2xs">
                      {tier.label}
                    </span>
                  </div>

                  <h4 className="font-bold text-base mb-1">{tier.category}</h4>
                  <p className="text-xs opacity-90 mb-3 leading-relaxed">{tier.description}</p>

                  <div className="bg-white/60 rounded-xl p-3 text-xs border border-current/20">
                    <span className="font-semibold text-slate-800 block mb-1">Key Statutory Commodities & Services:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                      {tier.examples.map((ex, idx) => (
                        <li key={idx}>{ex}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: VALUE THRESHOLD & CESS SIMULATOR */}
        {activeTab === 'VALUE_THRESHOLD' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Interactive Line Item Simulator */}
            <div className="lg:col-span-7 bg-slate-50/80 border border-slate-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calculator className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">Interactive Line Item Tax Rate Simulator</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Item Description</label>
                  <input
                    type="text"
                    value={simItemName}
                    onChange={(e) => setSimItemName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">HSN / SAC Code</label>
                  <input
                    type="text"
                    value={simHsn}
                    onChange={(e) => setSimHsn(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white font-medium"
                    placeholder="e.g. 6109, 6402, 9963, 8703"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">Try '6109' (Apparel), '6402' (Footwear), '9963' (Hotel)</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Base Statutory Rate %</label>
                  <select
                    value={simBaseRate}
                    onChange={(e) => setSimBaseRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white font-medium"
                  >
                    <option value={0}>0% (Nil / Exempt)</option>
                    <option value={0.1}>0.1% (Merchant Export)</option>
                    <option value={0.25}>0.25% (Diamonds)</option>
                    <option value={1}>1% (Composition)</option>
                    <option value={3}>3% (Precious Metals)</option>
                    <option value={5}>5% (Essential/Apparel)</option>
                    <option value={6}>6% (Bricks)</option>
                    <option value={12}>12% (Standard Lower)</option>
                    <option value={18}>18% (Standard Upper)</option>
                    <option value={28}>28% (Luxury/Automobile)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    value={simUnitPrice}
                    onChange={(e) => setSimUnitPrice(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={simQuantity}
                    min={1}
                    onChange={(e) => setSimQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier State</label>
                  <input
                    type="text"
                    value={simSupplierState}
                    onChange={(e) => setSimSupplierState(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Place of Supply (POS)</label>
                  <input
                    type="text"
                    value={simPosState}
                    onChange={(e) => setSimPosState(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ad Valorem Cess %</label>
                  <input
                    type="number"
                    value={simCessPercent}
                    onChange={(e) => setSimCessPercent(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white font-medium"
                    placeholder="e.g. 15, 22"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Specific Cess / Unit (₹)</label>
                  <input
                    type="number"
                    value={simSpecificCess}
                    onChange={(e) => setSimSpecificCess(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white font-medium"
                    placeholder="e.g. 400 for Coal"
                  />
                </div>
              </div>

              {/* Special Flags */}
              <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-200">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simIsSez}
                    onChange={(e) => setSimIsSez(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  SEZ Unit Supply
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simIsExport}
                    onChange={(e) => setSimIsExport(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  Export Supply (Zero-Rated LUT)
                </label>
              </div>
            </div>

            {/* Right Column: Calculated Results */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider">Calculated Line Breakdown</span>
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>

                <div className="space-y-3 border-b border-slate-800 pb-4 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Total Taxable Value</span>
                    <span className="font-bold text-white">₹{lineItemCalc.taxableValue.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Effective Statutory Rate</span>
                    <span className="font-bold text-emerald-400">{lineItemCalc.applicableRate}%</span>
                  </div>

                  {lineItemCalc.isThresholdApplied && (
                    <div className="p-3 rounded-xl bg-indigo-950/80 border border-indigo-700/50 text-xs text-indigo-200">
                      <Info className="w-3.5 h-3.5 text-indigo-400 inline-block mr-1.5" />
                      {lineItemCalc.effectiveRateNote}
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-sm border-b border-slate-800 pb-4 mb-4">
                  {lineItemCalc.igst > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-300">IGST ({lineItemCalc.igstRate}%)</span>
                      <span className="font-semibold text-white">₹{lineItemCalc.igst.toLocaleString()}</span>
                    </div>
                  )}

                  {lineItemCalc.cgst > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-300">CGST ({lineItemCalc.cgstRate}%)</span>
                      <span className="font-semibold text-white">₹{lineItemCalc.cgst.toLocaleString()}</span>
                    </div>
                  )}

                  {lineItemCalc.sgst > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-300">SGST ({lineItemCalc.sgstRate}%)</span>
                      <span className="font-semibold text-white">₹{lineItemCalc.sgst.toLocaleString()}</span>
                    </div>
                  )}

                  {lineItemCalc.totalCess > 0 && (
                    <div className="flex justify-between text-amber-300">
                      <span>Compensation Cess</span>
                      <span className="font-semibold">₹{lineItemCalc.totalCess.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold">Total Line Invoice Amount</span>
                    <p className="text-2xl font-black text-white">₹{lineItemCalc.totalInvoiceAmount.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 uppercase font-semibold">Total Tax</span>
                    <p className="text-lg font-bold text-emerald-400">₹{lineItemCalc.totalTax.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Statutory Threshold Rules Directory Reference */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h4 className="font-bold text-slate-900 text-sm mb-3">Statutory Value Threshold Rules Directory</h4>
                <div className="space-y-3">
                  {THRESHOLD_RULES.map((rule, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <div className="flex justify-between font-bold text-slate-800 mb-1">
                        <span>{rule.categoryName} (HSN {rule.hsnPrefix}*)</span>
                        <span className="text-indigo-600">Threshold: ₹{rule.thresholdAmount.toLocaleString()}</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed">{rule.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
