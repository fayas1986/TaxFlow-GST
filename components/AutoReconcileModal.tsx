import React, { useState, useRef } from 'react';
import { 
  X, CheckCircle2, AlertTriangle, AlertCircle, HelpCircle, 
  ArrowRightLeft, FileSpreadsheet, Upload, Download, RefreshCw, 
  Sliders, Search, Check, ThumbsUp, ThumbsDown, ArrowRight, ShieldCheck, Landmark, Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReconItem, BankStatementTransaction, ReconMatchResult, AutoReconcileSummary } from '../types';
import { 
  runAutoReconcile, 
  MOCK_BANK_TRANSACTIONS, 
  parseBankCsv, 
  DEFAULT_CONFIG, 
  AutoReconcileConfig 
} from '../utils/autoReconcileEngine';

interface AutoReconcileModalProps {
  isOpen: boolean;
  onClose: () => void;
  reconItems: ReconItem[];
  activeTab: 'PURCHASE' | 'SALES';
  onApplyResults: (updatedItems: ReconItem[]) => void;
}

const AutoReconcileModal: React.FC<AutoReconcileModalProps> = ({
  isOpen,
  onClose,
  reconItems,
  activeTab,
  onApplyResults
}) => {
  const [sourceType, setSourceType] = useState<'LIVE_FEED' | 'UPLOAD_CSV'>('LIVE_FEED');
  const [bankTxns, setBankTxns] = useState<BankStatementTransaction[]>(MOCK_BANK_TRANSACTIONS);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Matching configuration
  const [config, setConfig] = useState<AutoReconcileConfig>(DEFAULT_CONFIG);
  const [showSettings, setShowSettings] = useState(false);

  // Engine Execution State
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<AutoReconcileSummary | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'EXACT' | 'FLAGGED' | 'UNMATCHED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Editable local match items for review
  const [matchList, setMatchList] = useState<ReconMatchResult[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseBankCsv(text);
      if (parsed.length > 0) {
        setBankTxns(parsed);
      } else {
        alert('Could not parse transactions from CSV. Please check file format.');
      }
    };
    reader.readAsText(file);
  };

  const handleRunAutoReconcile = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const res = runAutoReconcile(reconItems, bankTxns, activeTab, config);
      setSummary(res);
      setMatchList(res.matches);
      setIsProcessing(false);
    }, 600);
  };

  const handleApproveMatch = (matchId: string) => {
    setMatchList(prev => prev.map(m => {
      if (m.id === matchId) {
        return {
          ...m,
          status: 'MANUAL_APPROVED',
          confidence: 'EXACT',
          discrepancyReasons: ['Manually verified & approved by accountant']
        };
      }
      return m;
    }));
  };

  const handleRejectMatch = (matchId: string) => {
    setMatchList(prev => prev.map(m => {
      if (m.id === matchId) {
        return {
          ...m,
          status: 'DISPUTED',
          confidence: 'DISCREPANCY',
          discrepancyReasons: [...m.discrepancyReasons, 'Flagged as mismatch by reviewer']
        };
      }
      return m;
    }));
  };

  const handleApplyToRegister = () => {
    // Map match results back to ReconItems
    const updatedReconItems: ReconItem[] = reconItems.map(item => {
      const match = matchList.find(m => m.reconItemId === item.id);
      if (!match) return item;

      if (match.status === 'AUTO_MATCHED' || match.status === 'MANUAL_APPROVED') {
        return {
          ...item,
          status: 'MATCHED',
          taxAmountPortal: match.bankTxn?.amount || item.taxAmountBooks,
          difference: 0
        };
      } else if (match.confidence === 'UNMATCHED') {
        return {
          ...item,
          status: activeTab === 'PURCHASE' ? 'MISSING_IN_PORTAL' : 'MISSING_IN_BOOKS',
          difference: item.taxAmountBooks
        };
      } else {
        return {
          ...item,
          status: 'MISMATCH',
          taxAmountPortal: match.bankTxn?.amount || 0,
          difference: Math.abs(item.taxAmountBooks - (match.bankTxn?.amount || 0))
        };
      }
    });

    onApplyResults(updatedReconItems);
    onClose();
  };

  const filteredMatches = matchList.filter(m => {
    if (activeFilter === 'EXACT' && m.confidence !== 'EXACT') return false;
    if (activeFilter === 'FLAGGED' && (m.confidence !== 'DISCREPANCY' && m.confidence !== 'PROBABLE')) return false;
    if (activeFilter === 'UNMATCHED' && m.confidence !== 'UNMATCHED') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchInv = m.invoiceNumber.toLowerCase().includes(q);
      const matchParty = m.partyName.toLowerCase().includes(q);
      const matchGstin = m.gstin?.toLowerCase().includes(q);
      return matchInv || matchParty || matchGstin;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <ArrowRightLeft size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">Auto-Reconcile Invoices with Bank Statements</h3>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                  {activeTab === 'PURCHASE' ? 'ITC / Purchase Register' : 'Sales Output Register'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Automated multi-attribute matching across Date, Amount & GSTIN with discrepancy flagging
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Step 1: Configuration & Bank Feed Selector */}
          {!summary && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  onClick={() => { setSourceType('LIVE_FEED'); setBankTxns(MOCK_BANK_TRANSACTIONS); }}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${
                    sourceType === 'LIVE_FEED' 
                      ? 'border-indigo-600 bg-indigo-50/40 shadow-sm' 
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl shrink-0">
                    <Landmark size={24} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 text-sm">Connected Bank Feed</h4>
                      {sourceType === 'LIVE_FEED' && <CheckCircle2 size={18} className="text-indigo-600" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Direct API synchronization with HDFC Corporate Bank & ICICI Commercial Accounts ({MOCK_BANK_TRANSACTIONS.length} statement records ready)
                    </p>
                  </div>
                </div>

                <div 
                  onClick={() => { setSourceType('UPLOAD_CSV'); fileInputRef.current?.click(); }}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${
                    sourceType === 'UPLOAD_CSV' 
                      ? 'border-indigo-600 bg-indigo-50/40 shadow-sm' 
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    accept=".csv,.txt"
                  />
                  <div className="p-3 bg-blue-100 text-blue-700 rounded-xl shrink-0">
                    <FileSpreadsheet size={24} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 text-sm">Upload Bank Statement CSV</h4>
                      {sourceType === 'UPLOAD_CSV' && <CheckCircle2 size={18} className="text-indigo-600" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {uploadedFileName ? `File: ${uploadedFileName} (${bankTxns.length} txns)` : 'Import statement CSV with Date, Description, Amount & GSTIN columns'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Advanced Matching Settings Panel */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders size={18} className="text-indigo-600" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Reconciliation Matching Rules & Tolerances
                    </h4>
                  </div>
                  <button 
                    onClick={() => setShowSettings(!showSettings)}
                    className="text-xs text-indigo-600 font-bold hover:underline"
                  >
                    {showSettings ? 'Hide Parameters' : 'Adjust Rules'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1">
                    <label className="font-bold text-slate-800 block">Date Tolerance (Days)</label>
                    <input 
                      type="number" 
                      value={config.dateToleranceDays}
                      onChange={(e) => setConfig({ ...config, dateToleranceDays: parseInt(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                    <p className="text-[10px] text-slate-500">Flags delay if difference exceeds days</p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1">
                    <label className="font-bold text-slate-800 block">Amount Discrepancy Tolerance (₹)</label>
                    <input 
                      type="number" 
                      value={config.amountTolerance}
                      onChange={(e) => setConfig({ ...config, amountTolerance: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                    <p className="text-[10px] text-slate-500">Allows small rounding difference</p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-2">
                    <label className="font-bold text-slate-800 block">GSTIN Validation</label>
                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input 
                        type="checkbox"
                        checked={config.requireGstinMatch}
                        onChange={(e) => setConfig({ ...config, requireGstinMatch: e.target.checked })}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-700 font-semibold">Strict GSTIN Narration Match</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Ready State Prompt */}
              <div className="p-6 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-sm">Ready to execute Auto-Reconciliation</h4>
                  <p className="text-xs text-slate-600">
                    Engine will compare <span className="font-bold text-slate-900">{reconItems.length} invoices</span> from your register against <span className="font-bold text-slate-900">{bankTxns.length} bank statement records</span>.
                  </p>
                </div>
                <button 
                  onClick={handleRunAutoReconcile}
                  disabled={isProcessing}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 shadow-md shadow-indigo-100 flex items-center gap-2 shrink-0 transition-all"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Running Matching Engine...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      Run Auto-Reconcile Engine
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Auto-Reconciliation Discrepancy Dashboard */}
          {summary && (
            <div className="space-y-6">
              {/* Summary Metrics Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Auto-Matched</span>
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  </div>
                  <p className="text-2xl font-black text-emerald-900 mt-1">{summary.exactMatchesCount}</p>
                  <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">Exact Amount & Date match</p>
                </div>

                <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">Flagged Discrepancies</span>
                    <AlertTriangle size={18} className="text-amber-600" />
                  </div>
                  <p className="text-2xl font-black text-amber-900 mt-1">{summary.flaggedDiscrepanciesCount}</p>
                  <p className="text-[11px] font-semibold text-amber-700 mt-0.5">Requires manual review</p>
                </div>

                <div className="p-4 bg-rose-50/80 border border-rose-200 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-800">Unmatched Invoices</span>
                    <AlertCircle size={18} className="text-rose-600" />
                  </div>
                  <p className="text-2xl font-black text-rose-900 mt-1">{summary.unmatchedCount}</p>
                  <p className="text-[11px] font-semibold text-rose-700 mt-0.5">Missing in bank statement</p>
                </div>

                <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800">Total Variance</span>
                    <Building2 size={18} className="text-indigo-600" />
                  </div>
                  <p className="text-2xl font-black text-indigo-950 mt-1">
                    ₹{summary.discrepancyAmount.toLocaleString()}
                  </p>
                  <p className="text-[11px] font-semibold text-indigo-700 mt-0.5">Variance across register</p>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                  <button
                    onClick={() => setActiveFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    All Results ({matchList.length})
                  </button>
                  <button
                    onClick={() => setActiveFilter('EXACT')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeFilter === 'EXACT' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Matched ({summary.exactMatchesCount})
                  </button>
                  <button
                    onClick={() => setActiveFilter('FLAGGED')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeFilter === 'FLAGGED' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Flagged Discrepancies ({summary.flaggedDiscrepanciesCount})
                  </button>
                  <button
                    onClick={() => setActiveFilter('UNMATCHED')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeFilter === 'UNMATCHED' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Unmatched ({summary.unmatchedCount})
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Filter by invoice, party, GSTIN..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Side-by-Side Comparison Cards */}
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {filteredMatches.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 border border-slate-200 rounded-2xl">
                    No matching reconciliation records found for this filter.
                  </div>
                ) : (
                  filteredMatches.map(m => {
                    const isExact = m.confidence === 'EXACT' || m.status === 'MANUAL_APPROVED';
                    const isDiscrepancy = m.confidence === 'DISCREPANCY' || m.confidence === 'PROBABLE';
                    const isUnmatched = m.confidence === 'UNMATCHED';

                    return (
                      <div 
                        key={m.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isExact 
                            ? 'bg-emerald-50/20 border-emerald-200/80' 
                            : isDiscrepancy 
                            ? 'bg-amber-50/30 border-amber-200' 
                            : 'bg-rose-50/20 border-rose-200'
                        }`}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                          {/* Invoice Register Details (Col 1-5) */}
                          <div className="md:col-span-5 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Invoice Record ({activeTab})
                              </span>
                              <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                                {m.invoiceNumber}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-800 truncate max-w-[160px]">{m.partyName}</span>
                              <span className="font-mono font-black text-slate-900">₹{m.invoiceAmount.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                              <span>GSTIN: {m.gstin || 'B2C'}</span>
                              <span>Date: {m.date}</span>
                            </div>
                          </div>

                          {/* Match Score & Status Badge (Col 6-7) */}
                          <div className="md:col-span-2 flex flex-col items-center justify-center text-center px-2 py-1 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                            <div className="flex items-center gap-1 font-black text-xs">
                              {isExact ? (
                                <span className="text-emerald-700 flex items-center gap-1">
                                  <CheckCircle2 size={14} /> 100% Match
                                </span>
                              ) : isDiscrepancy ? (
                                <span className="text-amber-700 flex items-center gap-1">
                                  <AlertTriangle size={14} /> {m.matchScore}% Score
                                </span>
                              ) : (
                                <span className="text-rose-700 flex items-center gap-1">
                                  <X size={14} /> Unmatched
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
                              {m.status === 'MANUAL_APPROVED' ? 'Approved' : m.status}
                            </span>
                          </div>

                          {/* Bank Statement Entry Details (Col 8-12) */}
                          <div className="md:col-span-5 space-y-1 pl-0 md:pl-2 border-t md:border-t-0 md:border-l border-slate-200 pt-2 md:pt-0">
                            {m.bankTxn ? (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    Bank Statement ({m.bankTxn.bankName})
                                  </span>
                                  <span className="font-mono text-xs font-bold text-slate-900">
                                    ₹{m.bankTxn.amount.toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-[11px] font-mono text-slate-700 truncate" title={m.bankTxn.description}>
                                  {m.bankTxn.description}
                                </p>
                                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                                  <span>Ref: {m.bankTxn.refNo}</span>
                                  <span>Date: {m.bankTxn.txnDate}</span>
                                </div>
                              </>
                            ) : (
                              <div className="p-3 text-center text-xs text-rose-600 font-bold bg-rose-50/50 rounded-xl">
                                ❌ No matching bank payment transaction found
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Discrepancy Reasons & Action Buttons */}
                        {m.discrepancyReasons.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <div className="space-y-0.5 text-xs">
                              {m.discrepancyReasons.map((reason, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-900">
                                  <AlertCircle size={12} className="text-amber-600 shrink-0" />
                                  <span>{reason}</span>
                                </div>
                              ))}
                            </div>

                            {/* Manual Review Actions */}
                            {m.status !== 'MANUAL_APPROVED' && (
                              <div className="flex items-center gap-2 shrink-0">
                                <button 
                                  onClick={() => handleApproveMatch(m.id)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs"
                                  title="Approve match and clear discrepancy"
                                >
                                  <ThumbsUp size={12} /> Approve
                                </button>
                                <button 
                                  onClick={() => handleRejectMatch(m.id)}
                                  className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1"
                                  title="Flag as disputed mismatch"
                                >
                                  <ThumbsDown size={12} /> Dispute
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          {summary ? (
            <>
              <p className="text-xs text-slate-500 font-medium">
                Summary: <span className="font-bold text-emerald-700">{summary.exactMatchesCount} matched</span>, <span className="font-bold text-amber-700">{summary.flaggedDiscrepanciesCount} flagged</span>, <span className="font-bold text-rose-700">{summary.unmatchedCount} unmatched</span>
              </p>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSummary(null)} 
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
                >
                  Re-run with new rules
                </button>
                <button 
                  onClick={handleApplyToRegister}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-md shadow-indigo-100 flex items-center gap-2 transition-all"
                >
                  Apply Auto-Reconciliation to Register
                  <ArrowRight size={14} />
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button 
                onClick={onClose} 
                className="px-6 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AutoReconcileModal;
