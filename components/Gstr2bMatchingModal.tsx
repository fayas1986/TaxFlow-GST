import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, RefreshCw, CheckCircle2, AlertTriangle, ShieldAlert, ShieldCheck, 
  Search, Filter, Download, Send, ArrowRight, Layers, FileSpreadsheet, 
  HelpCircle, Sliders, Check, Info, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  runGstr2bMatchingService
} from '../services/api';
import { 
  GSTR2BMatchResultItem, 
  GSTR2BMatchingSummary, 
  GSTR2BMatchStatus, 
  DEFAULT_GSTR2B_MATCHING_CONFIG 
} from '../services/gstEngine/gstr2bMatchingService';
import { exportToCSV } from '../utils/export';

interface Gstr2bMatchingModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
}

export const Gstr2bMatchingModal: React.FC<Gstr2bMatchingModalProps> = ({
  isOpen,
  onClose,
  tenantId
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [matchResults, setMatchResults] = useState<GSTR2BMatchResultItem[]>([]);
  const [summary, setSummary] = useState<GSTR2BMatchingSummary | null>(null);

  // Configuration State
  const [taxTolerance, setTaxTolerance] = useState<number>(DEFAULT_GSTR2B_MATCHING_CONFIG.taxAmountTolerance ?? 10);
  const [dateTolerance, setDateTolerance] = useState<number>(DEFAULT_GSTR2B_MATCHING_CONFIG.dateToleranceDays ?? 7);
  const [taxableValueTolerance, setTaxableValueTolerance] = useState<number>(DEFAULT_GSTR2B_MATCHING_CONFIG.taxableValueTolerance ?? 100);
  const [fuzzyInvoiceMatch, setFuzzyInvoiceMatch] = useState<boolean>(true);

  // Filter State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [noticeSentIds, setNoticeSentIds] = useState<Set<string>>(new Set());
  const [noticeSuccessMessage, setNoticeSuccessMessage] = useState<string | null>(null);

  const fetchMatching = async () => {
    setIsLoading(true);
    try {
      const data = await runGstr2bMatchingService(tenantId, undefined, {
        taxAmountTolerance: taxTolerance,
        dateToleranceDays: dateTolerance,
        taxableValueTolerance: taxableValueTolerance,
        fuzzyInvoiceMatching: fuzzyInvoiceMatch,
        enforceGstinStrictMatch: true
      });
      setMatchResults(data.results);
      setSummary(data.summary);
    } catch (err) {
      console.error('Failed to run GSTR-2B matching service', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMatching();
    }
  }, [isOpen]);

  const filteredResults = useMemo(() => {
    return matchResults.filter(item => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const party = (item.purchaseRecord?.partyName || item.gstr2bRecord?.supplierName || '').toLowerCase();
        const gstin = (item.purchaseRecord?.gstin || item.gstr2bRecord?.gstin || '').toLowerCase();
        const invNo = (item.purchaseRecord?.invoiceNumber || item.gstr2bRecord?.invoiceNumber || '').toLowerCase();
        if (!party.includes(q) && !gstin.includes(q) && !invNo.includes(q)) return false;
      }
      return true;
    });
  }, [matchResults, statusFilter, searchQuery]);

  const handleSendVendorNotice = (item: GSTR2BMatchResultItem) => {
    const vendorName = item.purchaseRecord?.partyName || item.gstr2bRecord?.supplierName || 'Supplier';
    const invNo = item.purchaseRecord?.invoiceNumber || item.gstr2bRecord?.invoiceNumber || '';
    setNoticeSentIds(prev => new Set(prev).add(item.id));
    setNoticeSuccessMessage(`Official GSTR-1 Amendment & Filing Notice sent to ${vendorName} for Invoice ${invNo}.`);
    setTimeout(() => setNoticeSuccessMessage(null), 5000);
  };

  const handleBulkSendNotices = () => {
    const discrepancyItems = matchResults.filter(r => r.status === 'MISSING_IN_GSTR2B' || r.status === 'AMOUNT_MISMATCH');
    const newSent = new Set(noticeSentIds);
    discrepancyItems.forEach(item => newSent.add(item.id));
    setNoticeSentIds(newSent);
    setNoticeSuccessMessage(`Bulk compliance notice dispatched to ${discrepancyItems.length} suppliers with GSTR-2B discrepancies.`);
    setTimeout(() => setNoticeSuccessMessage(null), 5000);
  };

  const handleExportReport = () => {
    const exportData = filteredResults.map(item => ({
      'Match Status': item.status,
      'Match Score %': `${item.matchingScore}%`,
      'Books Invoice No': item.purchaseRecord?.invoiceNumber || 'N/A',
      'Books Invoice Date': item.purchaseRecord?.date || 'N/A',
      'Books Party Name': item.purchaseRecord?.partyName || 'N/A',
      'Books GSTIN': item.purchaseRecord?.gstin || 'N/A',
      'Books Tax (₹)': item.purchaseRecord?.taxAmount || 0,
      'GSTR-2B Invoice No': item.gstr2bRecord?.invoiceNumber || 'N/A',
      'GSTR-2B Filing Period': item.gstr2bRecord?.gstr1FilingPeriod || 'N/A',
      'GSTR-2B Supplier': item.gstr2bRecord?.supplierName || 'N/A',
      'GSTR-2B Tax (₹)': item.gstr2bRecord?.totalTax || 0,
      'Tax Variance (₹)': item.taxDifference,
      'Discrepancy Category': item.discrepancyCategory,
      'Statutory Rule': item.statutoryClause,
      'Recommended Resolution': item.recommendedAction
    }));

    exportToCSV(exportData, `GSTR2B_vs_PurchaseRegister_Discrepancies_${new Date().toISOString().split('T')[0]}`, 'en');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Layers size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">GSTR-2B vs. Purchase Register Matching Engine</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 uppercase tracking-widest">
                  Rule 36(4) Compliant
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Automated statutory matching between internal accounting books & supplier GSTR-1/2B filings.
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Notice Success Toast */}
        {noticeSuccessMessage && (
          <div className="bg-emerald-600 text-white px-6 py-2.5 text-xs font-bold flex items-center justify-between gap-2 shadow-inner">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{noticeSuccessMessage}</span>
            </div>
            <button onClick={() => setNoticeSuccessMessage(null)} className="text-emerald-200 hover:text-white">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Analytics Dashboard Grid */}
        {summary && (
          <div className="p-6 bg-slate-50 border-b border-slate-200 grid grid-cols-2 md:grid-cols-5 gap-4 shrink-0">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Purchase Tax (Books)</p>
              <p className="text-xl font-black text-slate-900 mt-1 font-mono">₹{summary.totalBooksTaxAmount.toLocaleString()}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{summary.totalPurchaseInvoices} Purchase Invoices</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total GSTR-2B Tax (Portal)</p>
              <p className="text-xl font-black text-indigo-700 mt-1 font-mono">₹{summary.totalGstr2bTaxAmount.toLocaleString()}</p>
              <p className="text-[11px] text-indigo-500 mt-0.5 font-medium">{summary.totalGstr2bInvoices} Portal Records</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Claimable ITC (Reconciled)</p>
              <p className="text-xl font-black text-emerald-700 mt-1 font-mono">₹{summary.claimableItcAmount.toLocaleString()}</p>
              <p className="text-[11px] text-emerald-600 mt-0.5 font-medium flex items-center gap-1">
                <ShieldCheck size={12} /> {summary.exactMatchesCount} Fully Matched
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/40 shadow-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-800">At-Risk / Discrepancy ITC</p>
              <p className="text-xl font-black text-rose-700 mt-1 font-mono">₹{summary.atRiskItcAmount.toLocaleString()}</p>
              <p className="text-[11px] text-rose-600 mt-0.5 font-medium flex items-center gap-1">
                <ShieldAlert size={12} /> {summary.discrepanciesCount + summary.missingInGstr2bCount} Items Need Action
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">GSTR-2B Match Rate</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-2xl font-black text-slate-800">{summary.reconciliationMatchRate}%</span>
                  <div className={`w-3 h-3 rounded-full ${summary.reconciliationMatchRate >= 80 ? 'bg-emerald-500' : summary.reconciliationMatchRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}></div>
                </div>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                <div 
                  className={`h-full transition-all duration-500 ${summary.reconciliationMatchRate >= 80 ? 'bg-emerald-500' : summary.reconciliationMatchRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                  style={{ width: `${summary.reconciliationMatchRate}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Settings & Parameters Bar */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Sliders size={14} className="text-indigo-600" />
              <span>Matching Rules:</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              <span className="text-slate-500 font-medium">Tax Amount Tolerance:</span>
              <input 
                type="number" 
                value={taxTolerance}
                onChange={(e) => setTaxTolerance(Number(e.target.value))}
                className="w-16 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-slate-800 font-bold font-mono outline-none focus:border-indigo-500"
              />
              <span className="text-slate-400 font-bold">₹</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              <span className="text-slate-500 font-medium">Date Window:</span>
              <input 
                type="number" 
                value={dateTolerance}
                onChange={(e) => setDateTolerance(Number(e.target.value))}
                className="w-14 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-slate-800 font-bold font-mono outline-none focus:border-indigo-500"
              />
              <span className="text-slate-500">Days</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              <span className="text-slate-500 font-medium">Value Tolerance:</span>
              <input 
                type="number" 
                value={taxableValueTolerance}
                onChange={(e) => setTaxableValueTolerance(Number(e.target.value))}
                className="w-16 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-slate-800 font-bold font-mono outline-none focus:border-indigo-500"
              />
              <span className="text-slate-400 font-bold">₹</span>
            </div>

            <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg cursor-pointer">
              <input 
                type="checkbox" 
                checked={fuzzyInvoiceMatch}
                onChange={(e) => setFuzzyInvoiceMatch(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-semibold text-slate-700">Lenient Inv # Syntax</span>
            </label>

            <button 
              onClick={fetchMatching}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 font-bold rounded-lg transition-colors active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} /> Re-Run Engine
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleBulkSendNotices}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 font-bold rounded-lg transition-colors shadow-xs"
            >
              <Send size={13} className="text-amber-600" /> Notify All Suppliers
            </button>
            <button 
              onClick={handleExportReport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 font-bold rounded-lg transition-colors shadow-xs"
            >
              <Download size={13} /> Export Report
            </button>
          </div>
        </div>

        {/* Filter Pills & Search */}
        <div className="px-6 py-3 bg-slate-50/70 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
            {[
              { id: 'ALL', label: 'All Records' },
              { id: 'EXACT_MATCH', label: 'Matched' },
              { id: 'AMOUNT_MISMATCH', label: 'Tax Mismatch' },
              { id: 'SECTION_17_5_BLOCKED', label: 'Sec 17(5) Blocked' },
              { id: 'MISSING_IN_GSTR2B', label: 'Missing in GSTR-2B' },
              { id: 'MISSING_IN_BOOKS', label: 'Missing in Books' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search vendor, invoice, GSTIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Results Data Table */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/40">
          {isLoading ? (
            <div className="p-16 text-center flex flex-col items-center justify-center text-slate-500">
              <RefreshCw size={32} className="animate-spin text-indigo-600 mb-3" />
              <p className="font-bold text-slate-700">Executing Multi-Vector GSTR-2B Matching Algorithm...</p>
              <p className="text-xs text-slate-400 mt-1">Comparing CGST, SGST, IGST tax components & Rule 36(4) provisions</p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
              <AlertCircle size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-700">No matching records found</p>
              <p className="text-xs text-slate-400 mt-1">Try resetting the filter criteria or adjustments.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredResults.map((item) => {
                const isNoticeSent = noticeSentIds.has(item.id);
                const isExact = item.status === 'EXACT_MATCH';
                const isBlocked = item.status === 'SECTION_17_5_BLOCKED';
                const isMissing2B = item.status === 'MISSING_IN_GSTR2B';
                const isMissingBooks = item.status === 'MISSING_IN_BOOKS';

                return (
                  <div 
                    key={item.id}
                    className={`bg-white rounded-xl border p-4 shadow-xs transition-all hover:shadow-md ${
                      isExact ? 'border-slate-200' :
                      isBlocked ? 'border-rose-300 bg-rose-50/10' :
                      isMissing2B ? 'border-amber-300 bg-amber-50/10' :
                      isMissingBooks ? 'border-purple-300 bg-purple-50/10' : 'border-indigo-200'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left Status & Classification */}
                      <div className="flex items-start gap-3 max-w-xs">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                          isExact ? 'bg-emerald-100 text-emerald-700' :
                          isBlocked ? 'bg-rose-100 text-rose-700' :
                          isMissing2B ? 'bg-amber-100 text-amber-700' :
                          isMissingBooks ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {isExact ? <CheckCircle2 size={18} /> :
                           isBlocked ? <ShieldAlert size={18} /> :
                           isMissing2B ? <AlertTriangle size={18} /> :
                           isMissingBooks ? <FileSpreadsheet size={18} /> : <Info size={18} />}
                        </div>

                         <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              isExact ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                              isBlocked ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                              isMissing2B ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                              isMissingBooks ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}>
                              {item.status.replace(/_/g, ' ')}
                            </span>
                            {item.matchLevel && (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border tracking-wider ${
                                item.matchLevel === 1 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                item.matchLevel === 2 ? 'bg-teal-100 text-teal-800 border-teal-200' :
                                item.matchLevel === 3 ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
                                item.matchLevel === 4 ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                'bg-rose-100 text-rose-800 border-rose-200'
                              }`}>
                                Level {item.matchLevel} Match
                              </span>
                            )}
                            <span className="text-[11px] font-mono font-extrabold text-slate-500">
                              {item.matchingScore}% Match
                            </span>
                          </div>

                          <p className="text-xs font-bold text-slate-800 mt-1">{item.discrepancyCategory}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{item.statutoryClause}</p>
                        </div>
                      </div>

                      {/* Middle Comparison Grid: Purchase Register vs GSTR-2B */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                        {/* Books / Purchase Register Column */}
                        <div className="border-r border-slate-200/80 pr-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
                            <FileSpreadsheet size={11} className="text-slate-600" /> Internal Purchase Register
                          </p>
                          {item.purchaseRecord ? (
                            <div className="mt-1 space-y-0.5">
                              <div className="font-bold text-slate-900 flex items-center justify-between">
                                <span>{item.purchaseRecord.invoiceNumber}</span>
                                <span className="font-mono text-slate-700">₹{item.purchaseRecord.taxAmount.toLocaleString()} Tax</span>
                              </div>
                              <div className="text-[11px] text-slate-600 flex items-center justify-between">
                                <span className="truncate max-w-[140px]">{item.purchaseRecord.partyName}</span>
                                <span className="text-slate-400">{item.purchaseRecord.date}</span>
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">{item.purchaseRecord.gstin}</div>
                            </div>
                          ) : (
                            <p className="text-xs italic text-rose-500 font-semibold mt-2">Not recorded in internal purchase books</p>
                          )}
                        </div>

                        {/* GSTR-2B Portal Column */}
                        <div className="pl-1">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 flex items-center gap-1">
                            <Layers size={11} className="text-indigo-600" /> Supplier GSTR-2B Filing
                          </p>
                          {item.gstr2bRecord ? (
                            <div className="mt-1 space-y-0.5">
                              <div className="font-bold text-indigo-950 flex items-center justify-between">
                                <span>{item.gstr2bRecord.invoiceNumber}</span>
                                <span className="font-mono text-indigo-700">₹{item.gstr2bRecord.totalTax.toLocaleString()} Tax</span>
                              </div>
                              <div className="text-[11px] text-slate-600 flex items-center justify-between">
                                <span className="truncate max-w-[140px]">{item.gstr2bRecord.supplierName}</span>
                                <span className="text-indigo-500 font-semibold">Period: {item.gstr2bRecord.gstr1FilingPeriod || 'GSTR-2B'}</span>
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">{item.gstr2bRecord.gstin}</div>
                            </div>
                          ) : (
                            <p className="text-xs italic text-amber-600 font-semibold mt-2">Unfiled by vendor in GSTR-1 / 2B</p>
                          )}
                        </div>
                      </div>

                      {/* Right Recommended Resolution & Action */}
                      <div className="flex flex-col justify-between gap-2 max-w-xs shrink-0">
                        <div className="p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100 text-[11px] text-indigo-950">
                          <span className="font-bold text-indigo-900 block mb-0.5">Actionable Guidance:</span>
                          <p className="leading-tight">{item.recommendedAction}</p>
                        </div>

                        {!isExact && (
                          <div className="flex items-center gap-2 justify-end">
                            {isMissing2B || item.status === 'AMOUNT_MISMATCH' ? (
                              <button
                                onClick={() => handleSendVendorNotice(item)}
                                disabled={isNoticeSent}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                                  isNoticeSent
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-600 text-white hover:bg-amber-700 shadow-xs active:scale-95'
                                }`}
                              >
                                {isNoticeSent ? <Check size={12} /> : <Send size={12} />}
                                {isNoticeSent ? 'Notice Dispatched' : 'Send Vendor Notice'}
                              </button>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 5-Way Alignment Check Status */}
                    {item.fiveWayMatch && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-[11px]">
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1">
                          <Layers size={11} className="text-slate-400" />
                          5-Way Verification Alignment:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {/* 1. Supplier GSTIN */}
                          <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1.5 font-medium ${
                            item.fiveWayMatch.gstinMatched 
                              ? 'bg-emerald-50/70 text-emerald-700 border-emerald-200/50' 
                              : 'bg-rose-50/70 text-rose-700 border-rose-200/50'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${item.fiveWayMatch.gstinMatched ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                            GSTIN Match: {item.fiveWayMatch.gstinMatched ? 'Yes' : 'No'}
                          </span>

                          {/* 2. Invoice Number */}
                          <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1.5 font-medium ${
                            item.fiveWayMatch.invoiceNoMatched === 'EXACT' 
                              ? 'bg-emerald-50/70 text-emerald-700 border-emerald-200/50' 
                              : item.fiveWayMatch.invoiceNoMatched === 'FUZZY'
                              ? 'bg-amber-50/70 text-amber-700 border-amber-200/50'
                              : 'bg-rose-50/70 text-rose-700 border-rose-200/50'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              item.fiveWayMatch.invoiceNoMatched === 'EXACT' ? 'bg-emerald-500' 
                              : item.fiveWayMatch.invoiceNoMatched === 'FUZZY' ? 'bg-amber-500' : 'bg-rose-500'
                            }`}></span>
                            Invoice No: {item.fiveWayMatch.invoiceNoMatched === 'EXACT' ? 'Exact' : item.fiveWayMatch.invoiceNoMatched === 'FUZZY' ? 'Fuzzy' : 'Mismatch'}
                          </span>

                          {/* 3. Invoice Date */}
                          <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1.5 font-medium ${
                            item.fiveWayMatch.dateMatched === 'EXACT' 
                              ? 'bg-emerald-50/70 text-emerald-700 border-emerald-200/50' 
                              : item.fiveWayMatch.dateMatched === 'TOLERANCE'
                              ? 'bg-amber-50/70 text-amber-700 border-amber-200/50'
                              : 'bg-rose-50/70 text-rose-700 border-rose-200/50'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              item.fiveWayMatch.dateMatched === 'EXACT' ? 'bg-emerald-500' 
                              : item.fiveWayMatch.dateMatched === 'TOLERANCE' ? 'bg-amber-500' : 'bg-rose-500'
                            }`}></span>
                            Invoice Date: {item.fiveWayMatch.dateMatched === 'EXACT' ? 'Exact' : item.fiveWayMatch.dateMatched === 'TOLERANCE' ? 'Within Tolerance' : 'Mismatch'}
                          </span>

                          {/* 4. Taxable Value */}
                          <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1.5 font-medium ${
                            item.fiveWayMatch.taxableValueMatched === 'EXACT' 
                              ? 'bg-emerald-50/70 text-emerald-700 border-emerald-200/50' 
                              : item.fiveWayMatch.taxableValueMatched === 'TOLERANCE'
                              ? 'bg-amber-50/70 text-amber-700 border-amber-200/50'
                              : 'bg-rose-50/70 text-rose-700 border-rose-200/50'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              item.fiveWayMatch.taxableValueMatched === 'EXACT' ? 'bg-emerald-500' 
                              : item.fiveWayMatch.taxableValueMatched === 'TOLERANCE' ? 'bg-amber-500' : 'bg-rose-500'
                            }`}></span>
                            Taxable Value: {item.fiveWayMatch.taxableValueMatched === 'EXACT' ? 'Exact' : item.fiveWayMatch.taxableValueMatched === 'TOLERANCE' ? 'Within Tolerance' : 'Mismatch'}
                          </span>

                          {/* 5. Tax Amount */}
                          <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1.5 font-medium ${
                            item.fiveWayMatch.taxAmountMatched === 'EXACT' 
                              ? 'bg-emerald-50/70 text-emerald-700 border-emerald-200/50' 
                              : item.fiveWayMatch.taxAmountMatched === 'TOLERANCE'
                              ? 'bg-amber-50/70 text-amber-700 border-amber-200/50'
                              : 'bg-rose-50/70 text-rose-700 border-rose-200/50'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              item.fiveWayMatch.taxAmountMatched === 'EXACT' ? 'bg-emerald-500' 
                              : item.fiveWayMatch.taxAmountMatched === 'TOLERANCE' ? 'bg-amber-500' : 'bg-rose-500'
                            }`}></span>
                            Tax Amount: {item.fiveWayMatch.taxAmountMatched === 'EXACT' ? 'Exact' : item.fiveWayMatch.taxAmountMatched === 'TOLERANCE' ? 'Within Tolerance' : 'Mismatch'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <div className="text-slate-500 font-medium flex items-center gap-2">
            <Info size={14} className="text-indigo-600" />
            <span>GSTR-2B matching results dynamically feed GSTR-3B Table 4 ITC auto-computation.</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-sm"
          >
            Close Engine
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Gstr2bMatchingModal;
