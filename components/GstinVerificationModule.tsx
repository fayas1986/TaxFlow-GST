import React, { useState, useEffect } from 'react';
import { 
  Search, ShieldCheck, ShieldAlert, CheckCircle2, AlertCircle, Clock, 
  Building2, MapPin, FileText, Download, Bookmark, Star, Upload, Sparkles, 
  RefreshCw, Check, Copy, ExternalLink, HelpCircle, Layers, ArrowUpRight, 
  ChevronRight, Filter, AlertTriangle, UserCheck, Calendar, Shield, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  validateGstinFormat, validatePanFormat, verifyGstinOrPan, 
  processBulkGstinValidation, loadSearchHistory, saveSearchHistory, 
  loadBookmarks, toggleBookmark, STATE_CODES_MAP, PAN_ENTITY_TYPES,
  GstinVerificationDetails, BulkValidationReport 
} from '../services/gstinVerificationService';

interface GstinVerificationModuleProps {
  onSelectVendorGstin?: (gstin: string, legalName: string) => void;
}

export const GstinVerificationModule: React.FC<GstinVerificationModuleProps> = ({
  onSelectVendorGstin
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'SINGLE_VERIFY' | 'BULK_VERIFY' | 'STATE_CODES' | 'PAN_CHECKER' | 'BOOKMARKS'>('SINGLE_VERIFY');

  // Search Input State
  const [searchQuery, setSearchQuery] = useState('27ABCDE1234F1Z5');
  const [isSearching, setIsSearching] = useState(false);
  const [verificationResult, setVerificationResult] = useState<GstinVerificationDetails | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Live Real-Time Format Validation on Typing
  const liveFormatCheck = validateGstinFormat(searchQuery);

  // History & Bookmarks
  const [searchHistory, setSearchHistory] = useState<string[]>(loadSearchHistory);
  const [bookmarks, setBookmarks] = useState<string[]>(loadBookmarks);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Bulk Verification State
  const [bulkTextInput, setBulkTextInput] = useState(
    "27ABCDE1234F1Z5\n07AAAAA0000A1Z5\n29AAACW9876K1Z2\n33AABCB1234H1Z9\n99INVALID123\n19BBBBB1111B1Z8"
  );
  const [bulkReport, setBulkReport] = useState<BulkValidationReport | null>(null);

  // Standalone PAN Checker State
  const [panQuery, setPanQuery] = useState('ABCDE1234F');

  // State Code Filter
  const [stateCodeFilter, setStateCodeFilter] = useState('');

  // Auto-search default GSTIN on mount
  useEffect(() => {
    handleExecuteSearch('27ABCDE1234F1Z5');
  }, []);

  // Execute GSTIN Verification Search
  const handleExecuteSearch = async (targetGstin?: string) => {
    const q = (targetGstin || searchQuery).trim().toUpperCase();
    if (!q) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const result = await verifyGstinOrPan(q);
      setVerificationResult(result);
      // Save search history
      saveSearchHistory([q]);
      setSearchHistory(loadSearchHistory());
    } catch (err: any) {
      setVerificationResult(null);
      setSearchError(err.message || 'Verification failed. Please check the GSTIN structure.');
    } finally {
      setIsSearching(false);
    }
  };

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Bookmark toggle helper
  const handleToggleBookmark = (gstin: string) => {
    const isNowBookmarked = toggleBookmark(gstin);
    setBookmarks(loadBookmarks());
    showToast(isNowBookmarked ? `Bookmarked ${gstin}` : `Removed ${gstin} from bookmarks`);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Execute Bulk Validation
  const handleRunBulkValidation = () => {
    const lines = bulkTextInput.split('\n');
    const report = processBulkGstinValidation(lines);
    setBulkReport(report);
    showToast(`Validated ${report.totalCount} GSTINs (${report.validCount} Valid, ${report.invalidCount} Invalid)`);
  };

  // Download Bulk Results CSV
  const handleDownloadBulkCsv = () => {
    if (!bulkReport) return;
    const csvRows = [
      ['Input GSTIN', 'Format Valid', 'Checksum Valid', 'Registration Status', 'Legal Name', 'State', 'PAN', 'Risk Level', 'Error Message'],
      ...bulkReport.items.map(item => [
        item.inputGstin,
        item.isValidFormat ? 'YES' : 'NO',
        item.isValidChecksum ? 'YES' : 'NO',
        item.gstinStatus || 'N/A',
        `"${item.legalName || ''}"`,
        `"${item.stateName || ''}"`,
        item.pan || 'N/A',
        item.riskLevel || 'N/A',
        `"${item.errorMessage || ''}"`
      ])
    ];

    const csvContent = csvRows.map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `GSTIN_Bulk_Verification_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* TOAST POPUP */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-8 z-[1000] px-4 py-3 bg-slate-900 text-white font-bold text-xs rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2"
          >
            <Sparkles size={16} className="text-amber-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODULE HEADER BANNER */}
      <div className="p-6 bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
              <ShieldCheck size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-white tracking-tight">GSTIN Verification &amp; Taxpayer Search</h2>
                <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold rounded-full uppercase">
                  GSTN API v2.0
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Real-time 15-digit GSTIN validation, PAN extraction, state code mapping, business constitution, return filing history, and batch compliance checking.
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 bg-slate-800/80 p-3 rounded-2xl border border-slate-700/50 text-xs">
            <div className="px-3 border-r border-slate-700">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Algorithm</p>
              <p className="font-mono font-extrabold text-blue-400">Modulus-36</p>
            </div>
            <div className="px-3 border-r border-slate-700">
              <p className="text-[10px] text-slate-400 font-bold uppercase">State Directory</p>
              <p className="font-mono font-extrabold text-emerald-400">38 Codes</p>
            </div>
            <div className="px-3">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Batch Limits</p>
              <p className="font-mono font-extrabold text-amber-400">100+ GSTINs</p>
            </div>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('SINGLE_VERIFY')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'SINGLE_VERIFY'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Search size={15} /> Single GSTIN Verification
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BULK_VERIFY')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'BULK_VERIFY'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Upload size={15} /> Bulk GST Validation
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('STATE_CODES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'STATE_CODES'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <MapPin size={15} /> State Code Directory
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PAN_CHECKER')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'PAN_CHECKER'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <UserCheck size={15} /> PAN Structure Inspector
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BOOKMARKS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'BOOKMARKS'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Bookmark size={15} /> Saved GSTINs ({bookmarks.length})
          </button>
        </div>
      </div>

      {/* TAB 1: SINGLE GSTIN VERIFICATION */}
      {activeTab === 'SINGLE_VERIFY' && (
        <div className="space-y-6">
          {/* SEARCH BAR & REAL-TIME STRUCTURE DECOMPOSITION */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Search size={16} className="text-blue-600" /> Enter 15-Digit GSTIN Number
              </span>
              <span className="text-[11px] font-mono text-slate-400">Format: 27AAAAA0000A1Z5</span>
            </label>

            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.toUpperCase().trim())}
                  onKeyDown={(e) => e.key === 'Enter' && handleExecuteSearch()}
                  placeholder="e.g. 27ABCDE1234F1Z5..."
                  className="w-full h-13 pl-4 pr-12 bg-slate-50 border-2 border-slate-300 focus:border-blue-600 rounded-2xl text-base font-mono font-bold tracking-wider text-slate-900 focus:outline-hidden"
                  maxLength={15}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 font-mono text-xs font-bold text-slate-400">
                  <span>{searchQuery.length}/15</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleExecuteSearch()}
                disabled={isSearching || searchQuery.length < 15}
                className="px-8 h-13 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm rounded-2xl transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSearching ? <RefreshCw size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                <span>Verify Taxpayer</span>
              </button>
            </div>

            {/* REAL-TIME STRUCTURAL ANATOMY DECOMPOSITION CARD */}
            {searchQuery.length > 0 && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={14} className="text-blue-600" /> Real-Time GSTIN Structural Breakdown
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-black ${
                    liveFormatCheck.isValid ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}>
                    {liveFormatCheck.isValid ? 'VALID STRUCTURE' : 'INVALID STRUCTURE'}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-2 font-mono text-center">
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-lg font-black text-blue-700">{searchQuery.substring(0, 2) || '--'}</p>
                    <p className="text-[10px] font-sans font-bold text-blue-900 mt-0.5">State Code</p>
                    <p className="text-[9px] font-sans text-blue-600 truncate">{STATE_CODES_MAP[searchQuery.substring(0, 2)]?.name || 'Invalid'}</p>
                  </div>

                  <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl col-span-2">
                    <p className="text-lg font-black text-indigo-700">{searchQuery.substring(2, 12) || '----------'}</p>
                    <p className="text-[10px] font-sans font-bold text-indigo-900 mt-0.5">Embedded PAN</p>
                    <p className="text-[9px] font-sans text-indigo-600 truncate">
                      {PAN_ENTITY_TYPES[searchQuery[5]]?.label || 'Entity Inspection'}
                    </p>
                  </div>

                  <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl">
                    <p className="text-lg font-black text-purple-700">{searchQuery[12] || '-'}</p>
                    <p className="text-[10px] font-sans font-bold text-purple-900 mt-0.5">Entity No</p>
                    <p className="text-[9px] font-sans text-purple-600">Reg Count</p>
                  </div>

                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-lg font-black text-emerald-700">{searchQuery[14] || '-'}</p>
                    <p className="text-[10px] font-sans font-bold text-emerald-900 mt-0.5">Checksum</p>
                    <p className="text-[9px] font-sans text-emerald-600">Mod-36</p>
                  </div>
                </div>

                {!liveFormatCheck.isValid && searchQuery.length === 15 && (
                  <p className="text-xs text-rose-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle size={14} /> {liveFormatCheck.reason}
                  </p>
                )}
              </div>
            )}

            {/* QUICK HISTORY CHIPS */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Recent Searches:</span>
              {searchHistory.map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setSearchQuery(g);
                    handleExecuteSearch(g);
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-mono font-bold transition-all border border-slate-200"
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* VERIFICATION ERROR NOTICE */}
          {searchError && (
            <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-medium flex items-start gap-3">
              <AlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-sm text-rose-900">Verification Failure</p>
                <p className="mt-0.5">{searchError}</p>
              </div>
            </div>
          )}

          {/* VERIFICATION RESULT DETAILS CARD */}
          {verificationResult && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
              {/* Header Status Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-black text-slate-900 font-mono tracking-tight">{verificationResult.gstin}</h3>
                    <button
                      type="button"
                      onClick={() => handleCopy(verificationResult.gstin, 'GSTIN')}
                      className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-lg transition-colors"
                      title="Copy GSTIN"
                    >
                      {copiedText === 'GSTIN' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleBookmark(verificationResult.gstin)}
                      className={`p-1.5 rounded-lg transition-colors border ${
                        bookmarks.includes(verificationResult.gstin)
                          ? 'bg-amber-50 text-amber-600 border-amber-300'
                          : 'bg-slate-100 text-slate-400 hover:text-slate-700 border-slate-200'
                      }`}
                      title="Save GSTIN"
                    >
                      <Star size={16} className={bookmarks.includes(verificationResult.gstin) ? 'fill-amber-400' : ''} />
                    </button>
                  </div>

                  <p className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                    <Building2 size={18} className="text-blue-600" />
                    {verificationResult.legalName}
                  </p>
                  <p className="text-xs text-slate-500">Trade Name: <strong>{verificationResult.tradeName}</strong></p>
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-3 py-1.5 rounded-xl text-xs font-black font-mono flex items-center gap-1.5 border ${
                    verificationResult.registrationStatus === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${verificationResult.registrationStatus === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                    {verificationResult.registrationStatus}
                  </span>

                  <span className="px-3 py-1.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold font-mono">
                    {verificationResult.taxpayerType} Taxpayer
                  </span>

                  <span className="px-3 py-1.5 bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold font-mono">
                    Score: {verificationResult.complianceRating}/100
                  </span>
                </div>
              </div>

              {/* 3-COLUMN METRICS GRID */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* COL 1: PAN & STATE */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck size={15} className="text-blue-600" /> Embedded PAN Verification
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">VERIFIED</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">PAN Number:</span>
                      <span className="font-mono font-extrabold text-slate-900">{verificationResult.pan}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">Entity Type:</span>
                      <span className="font-extrabold text-blue-700">{verificationResult.panEntityType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">State Name:</span>
                      <span className="font-bold text-slate-800">{verificationResult.stateName} (Code {verificationResult.stateCode})</span>
                    </div>
                  </div>
                </div>

                {/* COL 2: CONSTITUTION & JURISDICTION */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 size={15} className="text-indigo-600" /> Constitution &amp; Jurisdiction
                    </span>
                    <span className="text-[10px] font-mono text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded">OFFICIAL</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">Constitution:</span>
                      <span className="font-extrabold text-slate-900">{verificationResult.constitutionOfBusiness}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">Reg Date:</span>
                      <span className="font-mono font-bold text-slate-800">{verificationResult.registrationDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">Center Jurisdiction:</span>
                      <span className="font-mono text-[10px] font-bold text-slate-700 truncate max-w-[140px]">{verificationResult.centerJurisdiction}</span>
                    </div>
                  </div>
                </div>

                {/* COL 3: E-WAY BILL & COMPLIANCE RATING */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield size={15} className="text-emerald-600" /> E-Way Bill &amp; Compliance Risk
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">PERMITTED</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">e-Way Bill Blocking:</span>
                      <span className="font-bold text-emerald-600">UNBLOCKED / Active</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">Checksum Modulus-36:</span>
                      <span className="font-mono font-bold text-emerald-600">
                        {verificationResult.isValidChecksum ? 'PASSED (Match)' : 'FAILED'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">Additional Premises:</span>
                      <span className="font-bold text-slate-800">{verificationResult.additionalAddressesCount} Branches</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PRINCIPAL PLACE OF BUSINESS ADDRESS */}
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-2">
                <p className="text-xs font-extrabold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin size={15} className="text-blue-600" /> Principal Place of Business Address
                </p>
                <p className="text-xs text-slate-700 font-medium">
                  {verificationResult.principalAddress.buildingName}, {verificationResult.principalAddress.street}, {verificationResult.principalAddress.city}, {verificationResult.principalAddress.district}, {verificationResult.principalAddress.state} - <strong>{verificationResult.principalAddress.pincode}</strong> ({verificationResult.principalAddress.locationType})
                </p>
              </div>

              {/* RETURN FILING COMPLIANCE TRACKER TABLE */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Calendar size={16} className="text-blue-600" /> GSTR-1 &amp; GSTR-3B Return Filing History
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">Last 6 Tax Periods</span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-extrabold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Tax Period</th>
                        <th className="p-3">Return Type</th>
                        <th className="p-3">Filing Date</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">ARN Reference</th>
                        <th className="p-3 text-right">Delay (Days)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {verificationResult.filingHistory.slice(0, 8).map((record, i) => (
                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-bold text-slate-800">{record.taxPeriod}</td>
                          <td className="p-3 font-mono font-bold text-blue-700">{record.returnType}</td>
                          <td className="p-3 font-mono text-slate-600">{record.filingDate}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              record.status === 'FILED' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : record.status === 'DELAYED'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {record.status}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-[11px] text-slate-500">{record.arn}</td>
                          <td className="p-3 text-right font-mono font-bold">
                            {record.delayDays > 0 ? (
                              <span className="text-amber-600">+{record.delayDays} days</span>
                            ) : (
                              <span className="text-emerald-600">On Time</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BULK GST VALIDATION */}
      {activeTab === 'BULK_VERIFY' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Upload size={20} className="text-blue-600" /> Batch GSTIN Processor
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Paste up to 100+ GSTIN numbers (one per line) or upload CSV for automated format &amp; checksum verification.</p>
              </div>

              <button
                type="button"
                onClick={handleRunBulkValidation}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-blue-600/20 flex items-center gap-2"
              >
                <Zap size={16} /> Execute Batch Check
              </button>
            </div>

            <textarea
              rows={6}
              value={bulkTextInput}
              onChange={(e) => setBulkTextInput(e.target.value)}
              placeholder="Paste GSTIN numbers here (one per line)..."
              className="w-full p-4 bg-slate-50 border border-slate-300 rounded-2xl font-mono text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* BULK RESULTS REPORT */}
          {bulkReport && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <h4 className="text-base font-black text-slate-900">Batch Verification Summary Report</h4>
                  <p className="text-xs text-slate-500">Processed {bulkReport.totalCount} records at {new Date(bulkReport.timestamp).toLocaleTimeString()}</p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadBulkCsv}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                >
                  <Download size={15} /> Export Verification Report (CSV)
                </button>
              </div>

              {/* STATS TILES */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Total GSTINs</p>
                  <p className="text-xl font-black font-mono text-slate-900">{bulkReport.totalCount}</p>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                  <p className="text-[10px] font-bold text-emerald-800 uppercase">Valid Format</p>
                  <p className="text-xl font-black font-mono text-emerald-700">{bulkReport.validCount}</p>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-center">
                  <p className="text-[10px] font-bold text-rose-800 uppercase">Invalid Format</p>
                  <p className="text-xl font-black font-mono text-rose-700">{bulkReport.invalidCount}</p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-center">
                  <p className="text-[10px] font-bold text-blue-800 uppercase">Active Taxpayers</p>
                  <p className="text-xl font-black font-mono text-blue-700">{bulkReport.activeCount}</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-center">
                  <p className="text-[10px] font-bold text-amber-800 uppercase">High Risk / Cancelled</p>
                  <p className="text-xl font-black font-mono text-amber-700">{bulkReport.highRiskCount}</p>
                </div>
              </div>

              {/* TABLE */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-extrabold border-b border-slate-200">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">GSTIN Number</th>
                      <th className="p-3">Structure</th>
                      <th className="p-3">Checksum</th>
                      <th className="p-3">Legal Name</th>
                      <th className="p-3">State</th>
                      <th className="p-3 text-right">Risk Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {bulkReport.items.map((item, index) => (
                      <tr key={item.id} className="hover:bg-slate-50/80">
                        <td className="p-3 text-slate-400">{index + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{item.inputGstin}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isValidFormat ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {item.isValidFormat ? 'VALID' : 'INVALID'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isValidChecksum ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {item.isValidChecksum ? 'MATCH' : 'MISMATCH'}
                          </span>
                        </td>
                        <td className="p-3 font-sans font-bold text-slate-800">{item.legalName || item.errorMessage || 'N/A'}</td>
                        <td className="p-3 font-sans text-slate-600">{item.stateName || 'N/A'}</td>
                        <td className="p-3 text-right">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.riskLevel === 'LOW_RISK' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {item.riskLevel || 'UNKNOWN'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: STATE CODE DIRECTORY */}
      {activeTab === 'STATE_CODES' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <MapPin size={20} className="text-blue-600" /> Official Indian GST State Code Mapping (38 States/UTs)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Every 15-digit GSTIN begins with a 2-digit numerical state code assigned by the GST Council.</p>
            </div>

            <input
              type="text"
              value={stateCodeFilter}
              onChange={(e) => setStateCodeFilter(e.target.value)}
              placeholder="Filter state or code..."
              className="px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.values(STATE_CODES_MAP)
              .filter(s => s.name.toLowerCase().includes(stateCodeFilter.toLowerCase()) || s.code.includes(stateCodeFilter))
              .map(state => (
                <div key={state.code} className="p-3.5 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 rounded-2xl transition-all flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 bg-blue-600 text-white font-mono font-black text-sm rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                      {state.code}
                    </span>
                    <div>
                      <p className="text-xs font-extrabold text-slate-900">{state.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{state.type} &bull; {state.zone} Zone</p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 4: PAN STRUCTURE INSPECTOR */}
      {activeTab === 'PAN_CHECKER' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <UserCheck size={20} className="text-indigo-600" /> Standalone PAN Structure Inspector
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Extract entity classification (Individual, Company, HUF, Firm, Trust, Local Authority) from any 10-character PAN.</p>
          </div>

          <div className="flex items-center gap-3 max-w-lg">
            <input
              type="text"
              value={panQuery}
              onChange={(e) => setPanQuery(e.target.value.toUpperCase().trim())}
              placeholder="e.g. ABCDE1234F"
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-300 rounded-2xl font-mono text-sm font-extrabold text-slate-900 tracking-wider focus:outline-hidden focus:border-indigo-600"
              maxLength={10}
            />
          </div>

          {/* PAN ANATOMY DECOMPOSITION */}
          {panQuery.length === 10 && (
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-800 uppercase tracking-wider">PAN Anatomical Breakdown: {panQuery}</span>
                <span className={`px-2.5 py-0.5 rounded font-mono text-[10px] ${validatePanFormat(panQuery).isValid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {validatePanFormat(panQuery).isValid ? 'VALID PAN FORMAT' : 'INVALID STRUCTURE'}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-3 text-center font-mono">
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <p className="text-base font-black text-slate-900">{panQuery.substring(0, 3)}</p>
                  <p className="text-[10px] font-sans font-bold text-slate-500">Alphabetic Series</p>
                </div>

                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <p className="text-base font-black text-indigo-700">{panQuery[3] || '-'}</p>
                  <p className="text-[10px] font-sans font-bold text-indigo-900">Entity Category</p>
                  <p className="text-[9px] font-sans text-indigo-600 truncate">{PAN_ENTITY_TYPES[panQuery[3]]?.label || 'Unassigned'}</p>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <p className="text-base font-black text-slate-900">{panQuery[4] || '-'}</p>
                  <p className="text-[10px] font-sans font-bold text-slate-500">Surname First Character</p>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <p className="text-base font-black text-slate-900">{panQuery.substring(5, 9)}</p>
                  <p className="text-[10px] font-sans font-bold text-slate-500">Sequential Number</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: BOOKMARKED GSTINS */}
      {activeTab === 'BOOKMARKS' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Bookmark size={20} className="text-amber-500" /> Saved / Bookmarked GSTIN Directory ({bookmarks.length})
          </h3>

          {bookmarks.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">No bookmarked GSTINs saved yet. Click the star icon on any taxpayer report to bookmark.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {bookmarks.map((gstin) => (
                <div key={gstin} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="font-mono font-black text-sm text-slate-900">{gstin}</p>
                    <p className="text-xs text-slate-500 font-bold mt-0.5">State: {STATE_CODES_MAP[gstin.substring(0, 2)]?.name || 'India'}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery(gstin);
                      setActiveTab('SINGLE_VERIFY');
                      handleExecuteSearch(gstin);
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold transition-all"
                  >
                    Inspect
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GstinVerificationModule;
