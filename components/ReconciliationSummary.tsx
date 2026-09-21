import React, { useState } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  HelpCircle, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  FileText, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  Info,
  Scale,
  Building2,
  Landmark,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface TaxHeadBreakdown {
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  total: number;
  taxable?: number;
  count?: number;
}

export interface ReconciliationSummaryProps {
  /** Total ITC Claimed in Internal Purchase Register (Books) */
  itcClaimedBooks: number | TaxHeadBreakdown;
  /** Total ITC Available in Government Portal (GSTR-2A) */
  itcAvailableGstr2a: number | TaxHeadBreakdown;
  /** Active Return Period (e.g., '08/2026') */
  period?: string;
  /** Invoices/Records counts */
  booksCount?: number;
  gstr2aCount?: number;
  /** Taxable amounts */
  booksTaxable?: number;
  gstr2aTaxable?: number;
  /** Precalculated amounts if already computed */
  itcAtRisk?: number;
  unclaimedItc?: number;
  /** Optional click callbacks */
  onViewDiscrepancies?: () => void;
  onExportReport?: () => void;
  /** Custom additional styling class */
  className?: string;
}

export const ReconciliationSummary: React.FC<ReconciliationSummaryProps> = ({
  itcClaimedBooks,
  itcAvailableGstr2a,
  period = 'Active Period',
  booksCount,
  gstr2aCount,
  booksTaxable,
  gstr2aTaxable,
  itcAtRisk,
  unclaimedItc,
  onViewDiscrepancies,
  onExportReport,
  className = ''
}) => {
  const [showHeadWiseDetails, setShowHeadWiseDetails] = useState<boolean>(false);

  // Normalize numbers whether objects or raw numbers are passed
  const booksTax: TaxHeadBreakdown = typeof itcClaimedBooks === 'number'
    ? { igst: 0, cgst: 0, sgst: 0, cess: 0, total: itcClaimedBooks }
    : itcClaimedBooks;

  const gstr2aTax: TaxHeadBreakdown = typeof itcAvailableGstr2a === 'number'
    ? { igst: 0, cgst: 0, sgst: 0, cess: 0, total: itcAvailableGstr2a }
    : itcAvailableGstr2a;

  const totalBooks = booksTax.total;
  const totalGstr2a = gstr2aTax.total;

  // Variance = Books Claimed - GSTR-2A Available
  // Positive (> 0): Claimed more in books than available in 2A -> Exposure / Risk under Sec 16(2)(aa)
  // Negative (< 0): Claimed less in books than available in 2A -> Unclaimed ITC opportunity
  // Zero: Perfectly reconciled
  const netVariance = totalBooks - totalGstr2a;
  const absVariance = Math.abs(netVariance);

  // Percentage variance based on GSTR-2A base
  const variancePercentage = totalGstr2a > 0 
    ? ((netVariance / totalGstr2a) * 100)
    : (totalBooks > 0 ? 100 : 0);

  const formattedPercentage = Math.abs(variancePercentage).toFixed(2);

  // Status Categorization
  const isExactMatch = absVariance <= 5; // within 5 rupee tolerance
  const isExcessClaim = netVariance > 5;
  const isUnclaimedOpportunity = netVariance < -5;

  // Visual meter calculations
  const maxScale = Math.max(totalBooks, totalGstr2a, 1);
  const booksRatio = Math.min(100, Math.round((totalBooks / maxScale) * 100));
  const gstr2aRatio = Math.min(100, Math.round((totalGstr2a / maxScale) * 100));

  // Threshold check for DRC-01B (variance > 10% or > ₹25,000 as per GST rules)
  const isDrc01bTriggerRisk = isExcessClaim && (variancePercentage > 10 || absVariance > 25000);

  // Head-wise variance breakdown
  const taxHeads = [
    {
      label: 'Integrated Tax (IGST)',
      short: 'IGST',
      books: booksTax.igst,
      gstr2a: gstr2aTax.igst,
      diff: booksTax.igst - gstr2aTax.igst
    },
    {
      label: 'Central Tax (CGST)',
      short: 'CGST',
      books: booksTax.cgst,
      gstr2a: gstr2aTax.cgst,
      diff: booksTax.cgst - gstr2aTax.cgst
    },
    {
      label: 'State / UT Tax (SGST)',
      short: 'SGST',
      books: booksTax.sgst,
      gstr2a: gstr2aTax.sgst,
      diff: booksTax.sgst - gstr2aTax.sgst
    },
    {
      label: 'Compensation Cess',
      short: 'CESS',
      books: booksTax.cess,
      gstr2a: gstr2aTax.cess,
      diff: booksTax.cess - gstr2aTax.cess
    }
  ];

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {/* Component Top Banner & Title */}
      <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                <Scale size={12} className="text-indigo-600" />
                Reconciliation Summary
              </span>
              <span className="text-xs text-slate-400 font-mono font-medium">
                Period: {period}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-1">
              Comparative ITC Audit: GSTR-2A vs Books
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive variance audit between Input Tax Credit reported on the GSTN portal and internal books of accounts.
            </p>
          </div>

          {/* Quick Stat Pill & Actions */}
          <div className="flex items-center gap-2.5 self-start md:self-center">
            {onExportReport && (
              <button
                onClick={onExportReport}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <Download size={13} className="text-slate-500" />
                <span>Export Audit</span>
              </button>
            )}
            <button
              onClick={() => setShowHeadWiseDetails(!showHeadWiseDetails)}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <Layers size={13} className="text-indigo-600" />
              <span>{showHeadWiseDetails ? 'Hide Tax Heads' : 'View Tax Heads'}</span>
              {showHeadWiseDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Comparative Display & Variance Indicator */}
      <div className="p-5 sm:p-6 space-y-6">
        {/* Comparative Columns Layout with Visual Center Variance Widget */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          
          {/* Column 1: ITC Claimed (Books) */}
          <div className="lg:col-span-4 bg-slate-50/70 rounded-2xl p-5 border border-slate-200/80 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-800" />
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-200 text-slate-800 rounded-lg">
                    <Building2 size={15} />
                  </div>
                  <span className="text-xs font-black tracking-wider uppercase text-slate-700">
                    ITC Claimed (Books)
                  </span>
                </div>
                {booksCount !== undefined && (
                  <span className="text-xs font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {booksCount} Invoices
                  </span>
                )}
              </div>

              <div className="mt-4">
                <div className="text-2xl sm:text-3xl font-black text-slate-950 font-mono tracking-tight">
                  ₹{totalBooks.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                  <span>Taxable Base:</span>
                  <span className="font-mono font-bold text-slate-700">
                    ₹{(booksTaxable ?? booksTax.taxable ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </p>
              </div>
            </div>

            {/* Sub-bar showing Books relative strength */}
            <div className="mt-5 pt-4 border-t border-slate-200/60">
              <div className="flex justify-between items-center text-[11px] mb-1.5">
                <span className="text-slate-500 font-medium">Recorded in Purchase Register</span>
                <span className="font-mono font-bold text-slate-700">{booksRatio}%</span>
              </div>
              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-slate-800 rounded-full transition-all duration-500" 
                  style={{ width: `${booksRatio}%` }}
                />
              </div>
            </div>
          </div>

          {/* Column 2: Center Visual Variance Indicator Gauge */}
          <div className={`lg:col-span-4 rounded-2xl p-5 border flex flex-col justify-between items-center text-center relative overflow-hidden transition-all ${
            isExactMatch
              ? 'bg-emerald-50/50 border-emerald-200'
              : isExcessClaim
                ? 'bg-rose-50/60 border-rose-200'
                : 'bg-teal-50/60 border-teal-200'
          }`}>
            <div className="w-full flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Variance Status
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                isExactMatch 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : isExcessClaim 
                    ? 'bg-rose-100 text-rose-800' 
                    : 'bg-teal-100 text-teal-800'
              }`}>
                {isExactMatch ? (
                  <>
                    <CheckCircle2 size={11} /> Reconciled
                  </>
                ) : isExcessClaim ? (
                  <>
                    <AlertTriangle size={11} /> Overclaimed
                  </>
                ) : (
                  <>
                    <TrendingUp size={11} /> Unclaimed Opportunity
                  </>
                )}
              </span>
            </div>

            {/* Central Metric */}
            <div className="my-3 flex flex-col items-center">
              <div className="flex items-center gap-2">
                {isExcessClaim ? (
                  <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
                    <ArrowUpRight size={22} className="stroke-[2.5]" />
                  </div>
                ) : isUnclaimedOpportunity ? (
                  <div className="p-2 rounded-xl bg-teal-100 text-teal-700">
                    <ArrowDownRight size={22} className="stroke-[2.5]" />
                  </div>
                ) : (
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                    <CheckCircle2 size={22} className="stroke-[2.5]" />
                  </div>
                )}

                <div className="text-left">
                  <div className="text-xs font-semibold text-slate-500">
                    {isExcessClaim ? 'Excess in Books' : isUnclaimedOpportunity ? 'Unclaimed in Books' : 'Net Difference'}
                  </div>
                  <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                    isExactMatch 
                      ? 'text-emerald-700' 
                      : isExcessClaim 
                        ? 'text-rose-700' 
                        : 'text-teal-800'
                  }`}>
                    {isExcessClaim ? '+' : isUnclaimedOpportunity ? '-' : ''}₹{absVariance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>

              {/* Percentage Badge */}
              <div className={`mt-2.5 px-3 py-1 rounded-full text-xs font-black font-mono inline-flex items-center gap-1 border ${
                isExactMatch
                  ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                  : isExcessClaim
                    ? 'bg-rose-100/90 border-rose-300 text-rose-900'
                    : 'bg-teal-100/90 border-teal-300 text-teal-900'
              }`}>
                <span>{isExcessClaim ? '+' : isUnclaimedOpportunity ? '-' : '±'}{formattedPercentage}%</span>
                <span className="text-[10px] font-normal opacity-80">variance</span>
              </div>
            </div>

            {/* Dynamic Visual Variance Scale Indicator */}
            <div className="w-full pt-3 border-t border-slate-200/50">
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold mb-1">
                <span>GSTR-2A Baseline</span>
                <span>Books Claim Ratio</span>
              </div>
              
              {/* Split Balance Track */}
              <div className="relative h-3 w-full bg-slate-200 rounded-full overflow-hidden flex items-center">
                {/* 50% Center Marker */}
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-400 z-10 -translate-x-1/2" />
                
                {/* Visual Fill */}
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${
                    isExactMatch 
                      ? 'bg-emerald-500' 
                      : isExcessClaim 
                        ? 'bg-rose-500' 
                        : 'bg-teal-600'
                  }`}
                  style={{ 
                    width: `${Math.min(100, Math.max(10, Math.round((totalBooks / (totalGstr2a || 1)) * 50)))}%` 
                  }}
                />
              </div>

              <p className="text-[10px] text-slate-500 mt-1.5 font-medium">
                {isExactMatch 
                  ? 'Input Tax Credit completely matched with GST portal data' 
                  : isExcessClaim 
                    ? 'Claim exceeds portal: Verify vendor GSTR-1 filings' 
                    : 'Portal has extra credit: Check missing purchase invoices'}
              </p>
            </div>
          </div>

          {/* Column 3: ITC Available (GSTR-2A) */}
          <div className="lg:col-span-4 bg-blue-50/50 rounded-2xl p-5 border border-blue-200/80 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1.5 h-full bg-blue-600" />
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                    <Landmark size={15} />
                  </div>
                  <span className="text-xs font-black tracking-wider uppercase text-blue-900">
                    ITC Available (GSTR-2A)
                  </span>
                </div>
                {gstr2aCount !== undefined && (
                  <span className="text-xs font-mono font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md border border-blue-200">
                    {gstr2aCount} Records
                  </span>
                )}
              </div>

              <div className="mt-4">
                <div className="text-2xl sm:text-3xl font-black text-blue-950 font-mono tracking-tight">
                  ₹{totalGstr2a.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
                <p className="text-xs text-blue-700/80 mt-1 flex items-center gap-1.5">
                  <span>Taxable Base:</span>
                  <span className="font-mono font-bold text-blue-900">
                    ₹{(gstr2aTaxable ?? gstr2aTax.taxable ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </p>
              </div>
            </div>

            {/* Sub-bar showing 2A relative strength */}
            <div className="mt-5 pt-4 border-t border-blue-200/60">
              <div className="flex justify-between items-center text-[11px] mb-1.5">
                <span className="text-blue-700/80 font-medium">Reported by Suppliers on GSTN</span>
                <span className="font-mono font-bold text-blue-900">{gstr2aRatio}%</span>
              </div>
              <div className="h-2 w-full bg-blue-200/60 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all duration-500" 
                  style={{ width: `${gstr2aRatio}%` }}
                />
              </div>
            </div>
          </div>

        </div>

        {/* Statutory Compliance Indicator Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Tile 1: Sec 16(2)(aa) Compliance */}
          <div className="p-3.5 rounded-xl border bg-slate-50 border-slate-200/80 flex items-start gap-3">
            <div className={`p-2 rounded-lg shrink-0 ${isExcessClaim ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
              <ShieldAlert size={16} />
            </div>
            <div>
              <div className="font-bold text-slate-800">CGST Sec 16(2)(aa) Mandate</div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isExcessClaim 
                  ? `₹${absVariance.toLocaleString('en-IN')} claimed in books without portal reflection poses reversal & interest exposure.`
                  : 'All recorded ITC is backed by counterpart supplier GSTR-1 filings.'}
              </p>
            </div>
          </div>

          {/* Tile 2: Rule 88C Notice Risk Check */}
          <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
            isDrc01bTriggerRisk 
              ? 'bg-rose-50 border-rose-200 text-rose-900' 
              : 'bg-slate-50 border-slate-200/80 text-slate-700'
          }`}>
            <div className={`p-2 rounded-lg shrink-0 ${
              isDrc01bTriggerRisk ? 'bg-rose-200 text-rose-900' : 'bg-slate-200 text-slate-700'
            }`}>
              <AlertTriangle size={16} />
            </div>
            <div>
              <div className="font-bold">
                {isDrc01bTriggerRisk ? 'DRC-01B Notice Risk' : 'Rule 88C Automated Threshold'}
              </div>
              <p className="text-[11px] opacity-80 mt-0.5">
                {isDrc01bTriggerRisk
                  ? `Variance exceeds 10% or ₹25,000 threshold. System may generate automated Form DRC-01B.`
                  : 'Variance remains within automated scrutiny tolerances.'}
              </p>
            </div>
          </div>

          {/* Tile 3: Net Cash & Working Capital Opportunity */}
          <div className="p-3.5 rounded-xl border bg-slate-50 border-slate-200/80 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="font-bold text-slate-800">Working Capital Impact</div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isUnclaimedOpportunity 
                  ? `₹${absVariance.toLocaleString('en-IN')} available on GSTN portal can reduce cash liability in Table 4 of GSTR-3B.`
                  : (itcAtRisk && itcAtRisk > 0)
                    ? `₹${itcAtRisk.toLocaleString('en-IN')} recommended to withhold from vendor payments until filed.`
                    : 'Tax positions synchronized for accurate cash ledger utilization.'}
              </p>
            </div>
          </div>
        </div>

        {/* Collapsible Head-Wise Detailed Variance Table */}
        <AnimatePresence>
          {showHeadWiseDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-2">
                <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Layers size={14} className="text-indigo-600" />
                      Head-wise Tax Variance Breakdown (IGST, CGST, SGST, Cess)
                    </span>
                    <span className="text-[11px] text-slate-400">Values in Indian Rupees (₹)</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4 font-bold">Tax Head</th>
                          <th className="py-2.5 px-4 font-bold text-right">ITC Available (GSTR-2A)</th>
                          <th className="py-2.5 px-4 font-bold text-right">ITC Claimed (Books)</th>
                          <th className="py-2.5 px-4 font-bold text-right">Variance (Books - 2A)</th>
                          <th className="py-2.5 px-4 font-bold text-center">Variance Indicator</th>
                          <th className="py-2.5 px-4 font-bold">Audit Remark</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-slate-800">
                        {taxHeads.map((head, idx) => {
                          const isMatch = Math.abs(head.diff) <= 2;
                          const isOver = head.diff > 2;
                          return (
                            <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-2.5 px-4 font-sans font-bold text-slate-900">
                                {head.label}
                              </td>
                              <td className="py-2.5 px-4 text-right text-blue-700 font-bold">
                                ₹{head.gstr2a.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </td>
                              <td className="py-2.5 px-4 text-right text-slate-900 font-bold">
                                ₹{head.books.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </td>
                              <td className={`py-2.5 px-4 text-right font-black ${
                                isMatch 
                                  ? 'text-emerald-600' 
                                  : isOver 
                                    ? 'text-rose-600' 
                                    : 'text-teal-700'
                              }`}>
                                {isOver ? '+' : head.diff < -2 ? '-' : ''}₹{Math.abs(head.diff).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </td>
                              <td className="py-2.5 px-4 text-center font-sans">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isMatch 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : isOver 
                                      ? 'bg-rose-100 text-rose-800' 
                                      : 'bg-teal-100 text-teal-800'
                                }`}>
                                  {isMatch ? 'Matched' : isOver ? 'Overclaim' : 'Unclaimed'}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 font-sans text-[11px] text-slate-500">
                                {isMatch 
                                  ? 'No adjustment needed' 
                                  : isOver 
                                    ? 'Requires reconciliation or vendor filing' 
                                    : 'Eligible for GSTR-3B credit'}
                              </td>
                            </tr>
                          );
                        })}

                        {/* Grand Total Row */}
                        <tr className="bg-slate-100/70 font-bold text-slate-900 border-t-2 border-slate-200">
                          <td className="py-3 px-4 font-sans font-black">
                            Total Tax Variance
                          </td>
                          <td className="py-3 px-4 text-right text-blue-800 font-black">
                            ₹{totalGstr2a.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-950 font-black">
                            ₹{totalBooks.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                          <td className={`py-3 px-4 text-right font-black ${
                            isExactMatch ? 'text-emerald-700' : isExcessClaim ? 'text-rose-700' : 'text-teal-800'
                          }`}>
                            {isExcessClaim ? '+' : isUnclaimedOpportunity ? '-' : ''}₹{absVariance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-3 px-4 text-center font-sans">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              isExactMatch ? 'bg-emerald-200 text-emerald-900' : isExcessClaim ? 'bg-rose-200 text-rose-900' : 'bg-teal-200 text-teal-900'
                            }`}>
                              {isExactMatch ? 'In Sync' : isExcessClaim ? `+${formattedPercentage}%` : `-${formattedPercentage}%`}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-sans text-[11px] font-bold text-slate-700">
                            {isExactMatch ? 'Complete Match' : isExcessClaim ? 'Hold Excess ITC' : 'Claim In 3B'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default ReconciliationSummary;
