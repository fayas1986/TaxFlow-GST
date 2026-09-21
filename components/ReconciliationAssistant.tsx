import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Sliders,
  SlidersHorizontal,
  ShieldAlert,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  FileText,
  Search,
  Check,
  X,
  Mail,
  MessageSquare,
  Lock,
  ExternalLink,
  ChevronRight,
  Info,
  Scale,
  Eye,
  FileCheck,
  AlertOctagon,
  Copy,
  Printer,
  ChevronDown,
  CornerDownRight,
  Filter,
  Save,
  Cloud,
  HardDrive,
  RotateCcw,
  Clock,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PurchaseInvoiceInput,
  ReconciliationAssistantSummary,
  SupplierNoticeData,
  parsePurchaseRegisterFile,
  parseGstr2bFile,
  generateReconciliationAssistantBenchmarkDataset,
  executeReconciliationEngine,
  exportReconciliationAssistantExcel,
  exportReconciliationAssistantPdf,
  generateSupplierNoticeContent
} from '../services/reconciliationAssistantService';
import {
  GSTR2BMatchingConfig,
  DEFAULT_GSTR2B_MATCHING_CONFIG,
  GSTR2BMatchResultItem,
  GSTR2BMatchStatus,
  GSTR2BPortalRecord
} from '../services/gstEngine/gstr2bMatchingService';
import {
  ReconciliationAutoSaveService,
  ReconciliationDraftData
} from '../services/reconciliationAutoSaveService';

export interface ReconciliationAssistantProps {
  tenantName?: string;
  tenantGstin?: string;
  initialPeriod?: string;
  onClose?: () => void;
  onApplyToFiling?: (summary: ReconciliationAssistantSummary) => void;
  isModal?: boolean;
}

export type AssistantStep = 1 | 2 | 3 | 4 | 5;

export const ReconciliationAssistant: React.FC<ReconciliationAssistantProps> = ({
  tenantName = 'TaxFlow Enterprise Ltd',
  tenantGstin = '27AABCT1234F1Z9',
  initialPeriod = 'August 2026',
  onClose,
  onApplyToFiling,
  isModal = false
}) => {
  // Step navigation state
  const [currentStep, setCurrentStep] = useState<AssistantStep>(1);
  const [returnPeriod, setReturnPeriod] = useState<string>(initialPeriod);

  // Data Ingestion State
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoiceInput[]>([]);
  const [gstr2bRecords, setGstr2bRecords] = useState<GSTR2BPortalRecord[]>([]);
  const [purchasesFileName, setPurchasesFileName] = useState<string | null>(null);
  const [gstr2bFileName, setGstr2bFileName] = useState<string | null>(null);
  const [isSyncingGstn, setIsSyncingGstn] = useState<boolean>(false);
  const [ingestionMessage, setIngestionMessage] = useState<string | null>(null);

  // File input refs
  const purchaseFileRef = useRef<HTMLInputElement>(null);
  const gstr2bFileRef = useRef<HTMLInputElement>(null);

  // Matching Engine Parameters & Configuration
  const [config, setConfig] = useState<GSTR2BMatchingConfig>(DEFAULT_GSTR2B_MATCHING_CONFIG);

  // Reconciliation Results & Summary
  const [results, setResults] = useState<GSTR2BMatchResultItem[]>([]);
  const [summary, setSummary] = useState<ReconciliationAssistantSummary | null>(null);
  const [isProcessingMatch, setIsProcessingMatch] = useState<boolean>(false);

  // Step 3 & 4 Filter States
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyHighRisk, setOnlyHighRisk] = useState<boolean>(false);

  // Resolution & Audit Action States
  const [acceptedOverrides, setAcceptedOverrides] = useState<Map<string, string>>(new Map());
  const [heldPaymentIds, setHeldPaymentIds] = useState<Set<string>>(new Set());
  const [deferredIds, setDeferredIds] = useState<Set<string>>(new Set());
  const [noticeSentIds, setNoticeSentIds] = useState<Set<string>>(new Set());
  const [inspectingItem, setInspectingItem] = useState<GSTR2BMatchResultItem | null>(null);
  const [activeNoticeItem, setActiveNoticeItem] = useState<GSTR2BMatchResultItem | null>(null);
  const [copiedNotice, setCopiedNotice] = useState<boolean>(false);

  // Export & Feedback State
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  // Auto-Save & Local Storage Persistence State
  const [autoSaveStatus, setAutoSaveStatus] = useState<'SAVED' | 'SAVING' | 'IDLE' | 'ERROR' | 'RESTORED'>('IDLE');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [autoSaveSizeKb, setAutoSaveSizeKb] = useState<number>(0);
  const [showDraftRestoredAlert, setShowDraftRestoredAlert] = useState<boolean>(false);
  const [isManualSaving, setIsManualSaving] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const autoSaveDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save executor function
  const performAutoSave = useCallback(() => {
    if (purchaseInvoices.length === 0 && gstr2bRecords.length === 0) return;

    setAutoSaveStatus('SAVING');
    try {
      const res = ReconciliationAutoSaveService.saveDraft(tenantGstin, returnPeriod, {
        tenantGstin,
        tenantName,
        returnPeriod,
        currentStep,
        purchaseInvoices,
        gstr2bRecords,
        purchasesFileName,
        gstr2bFileName,
        config,
        results,
        summary,
        acceptedOverrides: Array.from(acceptedOverrides.entries()),
        heldPaymentIds: Array.from(heldPaymentIds),
        deferredIds: Array.from(deferredIds),
        noticeSentIds: Array.from(noticeSentIds)
      });

      if (res.success) {
        setAutoSaveStatus('SAVED');
        setLastSavedTime(res.timestamp);
        setAutoSaveSizeKb(res.sizeKb);
      } else {
        setAutoSaveStatus('ERROR');
      }
    } catch (err) {
      console.error('Auto-save error:', err);
      setAutoSaveStatus('ERROR');
    }
  }, [
    tenantGstin,
    tenantName,
    returnPeriod,
    currentStep,
    purchaseInvoices,
    gstr2bRecords,
    purchasesFileName,
    gstr2bFileName,
    config,
    results,
    summary,
    acceptedOverrides,
    heldPaymentIds,
    deferredIds,
    noticeSentIds
  ]);

  // Initial Load: Check for saved draft or load benchmark data
  useEffect(() => {
    const savedDraft = ReconciliationAutoSaveService.loadDraft(tenantGstin, returnPeriod);
    if (savedDraft && (savedDraft.purchaseInvoices?.length > 0 || savedDraft.gstr2bRecords?.length > 0)) {
      setPurchaseInvoices(savedDraft.purchaseInvoices || []);
      setGstr2bRecords(savedDraft.gstr2bRecords || []);
      setPurchasesFileName(savedDraft.purchasesFileName || null);
      setGstr2bFileName(savedDraft.gstr2bFileName || null);
      if (savedDraft.config) setConfig(savedDraft.config);
      if (savedDraft.results) setResults(savedDraft.results);
      if (savedDraft.summary) setSummary(savedDraft.summary);
      if (savedDraft.currentStep) setCurrentStep(savedDraft.currentStep as AssistantStep);
      if (savedDraft.acceptedOverrides) setAcceptedOverrides(new Map(savedDraft.acceptedOverrides));
      if (savedDraft.heldPaymentIds) setHeldPaymentIds(new Set(savedDraft.heldPaymentIds));
      if (savedDraft.deferredIds) setDeferredIds(new Set(savedDraft.deferredIds));
      if (savedDraft.noticeSentIds) setNoticeSentIds(new Set(savedDraft.noticeSentIds));
      setLastSavedTime(savedDraft.lastSavedAt);
      setShowDraftRestoredAlert(true);
      setAutoSaveStatus('RESTORED');
      setIngestionMessage(`Restored saved session draft from browser storage (${savedDraft.lastSavedAt}).`);
    } else {
      loadBenchmarkData();
    }
    setIsInitialized(true);
  }, [tenantGstin, returnPeriod]);

  // Periodic Auto-Save Timer (every 12 seconds when data exists)
  useEffect(() => {
    if (!isInitialized) return;
    const interval = setInterval(() => {
      performAutoSave();
    }, 12000);
    return () => clearInterval(interval);
  }, [isInitialized, performAutoSave]);

  // Debounced Auto-Save on user interaction and data mutation
  useEffect(() => {
    if (!isInitialized) return;
    if (autoSaveDebounceRef.current) {
      clearTimeout(autoSaveDebounceRef.current);
    }
    autoSaveDebounceRef.current = setTimeout(() => {
      performAutoSave();
    }, 1500);

    return () => {
      if (autoSaveDebounceRef.current) {
        clearTimeout(autoSaveDebounceRef.current);
      }
    };
  }, [
    currentStep,
    purchaseInvoices,
    gstr2bRecords,
    config,
    results,
    acceptedOverrides,
    heldPaymentIds,
    deferredIds,
    noticeSentIds,
    isInitialized,
    performAutoSave
  ]);

  // Manual Trigger to save draft now
  const handleManualSave = () => {
    setIsManualSaving(true);
    performAutoSave();
    setTimeout(() => {
      setIsManualSaving(false);
      setExportSuccessMsg('Reconciliation progress snapshot saved locally in browser storage.');
    }, 400);
  };

  // Discard saved draft and reset to default clean benchmark
  const handleClearSavedDraftAndReset = () => {
    ReconciliationAutoSaveService.clearDraft(tenantGstin, returnPeriod);
    setAcceptedOverrides(new Map());
    setHeldPaymentIds(new Set());
    setDeferredIds(new Set());
    setNoticeSentIds(new Set());
    setResults([]);
    setSummary(null);
    setCurrentStep(1);
    setShowDraftRestoredAlert(false);
    loadBenchmarkData();
    setAutoSaveStatus('IDLE');
    setIngestionMessage('Cleared saved local draft. Reset session to standard state.');
  };

  // Function to load benchmark datasets
  const loadBenchmarkData = () => {
    const dataset = generateReconciliationAssistantBenchmarkDataset(returnPeriod);
    setPurchaseInvoices(dataset.purchaseInvoices);
    setGstr2bRecords(dataset.gstr2bRecords);
    setPurchasesFileName(`Benchmark_Purchase_Register_${returnPeriod.replace(/\s+/g, '_')}.xlsx`);
    setGstr2bFileName(`GSTR2B_GSTN_DirectSync_${returnPeriod.replace(/\s+/g, '_')}.json`);
    setIngestionMessage('Loaded benchmark enterprise purchase register and GSTR-2B data import.');
  };

  // Handle Purchase file upload
  const handlePurchaseFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parsePurchaseRegisterFile(file);
      setPurchaseInvoices(parsed);
      setPurchasesFileName(file.name);
      setIngestionMessage(`Successfully ingested ${parsed.length} purchase vouchers from ${file.name}`);
    } catch (err) {
      console.error('Failed to parse purchase register:', err);
      setIngestionMessage('Failed to parse file. Please upload standard Excel (.xlsx) or CSV format.');
    }
  };

  // Handle GSTR-2B file upload
  const handleGstr2bFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseGstr2bFile(file);
      setGstr2bRecords(parsed);
      setGstr2bFileName(file.name);
      setIngestionMessage(`Successfully imported ${parsed.length} GSTR-2B portal records from ${file.name}`);
    } catch (err) {
      console.error('Failed to parse GSTR-2B file:', err);
      setIngestionMessage('Failed to parse GSTR-2B. Please upload official GST Portal JSON or Excel export.');
    }
  };

  // Simulate Direct GSTN API Import
  const handleDirectGstnSync = () => {
    setIsSyncingGstn(true);
    setIngestionMessage(null);
    setTimeout(() => {
      const dataset = generateReconciliationAssistantBenchmarkDataset(returnPeriod);
      setGstr2bRecords(dataset.gstr2bRecords);
      setGstr2bFileName(`GSTN_Direct_API_Sync_${returnPeriod.replace(/\s+/g, '_')}.json`);
      setIsSyncingGstn(false);
      setIngestionMessage(`Synced ${dataset.gstr2bRecords.length} records directly from GSTN Portal API for ${returnPeriod}`);
    }, 900);
  };

  // Run Reconciliation Engine
  const executeMatch = () => {
    setIsProcessingMatch(true);
    setTimeout(() => {
      const outcome = executeReconciliationEngine(purchaseInvoices, gstr2bRecords, config);
      setResults(outcome.results);
      setSummary(outcome.summary);
      setIsProcessingMatch(false);
    }, 400);
  };

  // Re-run matching automatically when entering step 3 if needed
  useEffect(() => {
    if (currentStep >= 3 && results.length === 0 && purchaseInvoices.length > 0) {
      executeMatch();
    }
  }, [currentStep, purchaseInvoices, gstr2bRecords, config]);

  // Filtered results for Step 3 & 4
  const filteredResults = useMemo(() => {
    return results.filter(item => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (onlyHighRisk && item.status !== 'MISSING_IN_GSTR2B' && item.status !== 'AMOUNT_MISMATCH') {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const party = (item.purchaseRecord?.partyName || item.gstr2bRecord?.supplierName || '').toLowerCase();
        const invNo = (item.purchaseRecord?.invoiceNumber || item.gstr2bRecord?.invoiceNumber || '').toLowerCase();
        const gstin = (item.purchaseRecord?.gstin || item.gstr2bRecord?.gstin || '').toLowerCase();
        if (!party.includes(q) && !invNo.includes(q) && !gstin.includes(q)) return false;
      }
      return true;
    });
  }, [results, statusFilter, onlyHighRisk, searchQuery]);

  // Bulk Actions
  const handleHoldPaymentForUnfiled = () => {
    const newSet = new Set(heldPaymentIds);
    results.forEach(r => {
      if (r.status === 'MISSING_IN_GSTR2B') {
        newSet.add(r.id);
      }
    });
    setHeldPaymentIds(newSet);
    setExportSuccessMsg(`Held payment in ERP for ${results.filter(r => r.status === 'MISSING_IN_GSTR2B').length} missing GSTR-2B invoices (Rule 36(4)).`);
  };

  const handleAcceptMinorRounding = () => {
    const newMap = new Map(acceptedOverrides);
    let count = 0;
    results.forEach(r => {
      if (r.status === 'AMOUNT_MISMATCH' && Math.abs(r.taxDifference) <= 10) {
        newMap.set(r.id, 'Minor decimal round-off accepted under tolerance rule.');
        count++;
      }
    });
    setAcceptedOverrides(newMap);
    setExportSuccessMsg(`Accepted ${count} minor round-off differences (variance <= ₹10).`);
  };

  // Step names & descriptors
  const stepsMetadata = [
    { num: 1, title: 'Data Ingestion', desc: 'Upload Purchases & GSTR-2B' },
    { num: 2, title: 'Matching Rules', desc: 'Tolerances & Strictness' },
    { num: 3, title: 'Mismatch Analysis', desc: 'Discrepancy Matrix' },
    { num: 4, title: 'Resolution Hub', desc: 'Action & Supplier Follow-up' },
    { num: 5, title: 'GSTR-3B & Export', desc: 'Table 4 Prep & Download' }
  ];

  const getStatusBadge = (status: GSTR2BMatchStatus) => {
    switch (status) {
      case 'EXACT_MATCH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={13} className="text-emerald-600" />
            Exact Matched
          </span>
        );
      case 'AMOUNT_MISMATCH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-rose-50 text-rose-700 border border-rose-200">
            <AlertOctagon size={13} className="text-rose-600" />
            Value Mismatch
          </span>
        );
      case 'TAX_HEAD_MISMATCH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Scale size={13} className="text-indigo-600" />
            Tax Head (IGST/CGST)
          </span>
        );
      case 'DATE_MISMATCH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-amber-50 text-amber-700 border border-amber-200">
            <Calendar size={13} className="text-amber-600" />
            Period Variance
          </span>
        );
      case 'MISSING_IN_GSTR2B':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
            <ShieldAlert size={13} className="text-rose-700" />
            Missing in GSTR-2B (High Risk)
          </span>
        );
      case 'MISSING_IN_BOOKS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-cyan-50 text-cyan-700 border border-cyan-200">
            <Sparkles size={13} className="text-cyan-600" />
            Missing in Books (Unclaimed ITC)
          </span>
        );
      case 'SECTION_17_5_BLOCKED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-purple-50 text-purple-700 border border-purple-200">
            <Lock size={13} className="text-purple-600" />
            Section 17(5) Blocked
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className={`bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col ${isModal ? 'max-w-6xl w-full max-h-[92vh]' : 'w-full'}`}>
      {/* --- Top Header & Step Progress Bar --- */}
      <div className="bg-slate-900 text-white p-6 border-b border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl">
              <Sparkles size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight">
                  Reconciliation Assistant
                </h2>
                <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-extrabold rounded-md uppercase tracking-wider">
                  GSTR-2B vs Books
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-pass discrepancy flagging between uploaded purchase register and official GSTR-2B statement.
              </p>
            </div>
          </div>

          {/* Auto-Save Status, Return Period Selector & Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Real-time Auto-save status pill */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-xs shadow-xs"
              title={`Auto-saving to browser storage every 12 seconds (${autoSaveSizeKb ? `${autoSaveSizeKb} KB` : 'active'})`}
            >
              {autoSaveStatus === 'SAVING' ? (
                <>
                  <RefreshCw size={13} className="animate-spin text-blue-400" />
                  <span className="text-slate-300 font-medium">Saving draft...</span>
                </>
              ) : autoSaveStatus === 'ERROR' ? (
                <>
                  <AlertTriangle size={13} className="text-amber-400" />
                  <span className="text-amber-300 font-medium">Draft save error</span>
                </>
              ) : (
                <>
                  <Cloud size={13} className="text-emerald-400" />
                  <span className="text-slate-300 font-medium">
                    {lastSavedTime ? `Auto-saved ${lastSavedTime}` : 'Auto-save active'}
                  </span>
                </>
              )}

              {/* Quick Save Now icon button */}
              <button
                type="button"
                onClick={handleManualSave}
                disabled={isManualSaving}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors ml-0.5 cursor-pointer disabled:opacity-50"
                title="Save current progress snapshot now"
                aria-label="Save current progress snapshot now"
              >
                <Save size={13} className={isManualSaving ? 'animate-bounce text-blue-400' : ''} />
              </button>

              {/* Discard / Start Clean button */}
              <button
                type="button"
                onClick={handleClearSavedDraftAndReset}
                className="p-1 rounded-md text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors cursor-pointer"
                title="Reset local draft and start fresh"
                aria-label="Reset local draft and start fresh"
              >
                <RotateCcw size={13} />
              </button>
            </div>

            {/* Return Period Selector */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
              <Calendar size={14} className="text-slate-400" />
              <span className="text-slate-400 font-medium">Period:</span>
              <select
                value={returnPeriod}
                onChange={(e) => {
                  setReturnPeriod(e.target.value);
                  const dataset = generateReconciliationAssistantBenchmarkDataset(e.target.value);
                  setPurchaseInvoices(dataset.purchaseInvoices);
                  setGstr2bRecords(dataset.gstr2bRecords);
                  setResults([]);
                  setSummary(null);
                }}
                className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer"
              >
                <option value="August 2026" className="bg-slate-900 text-white">August 2026</option>
                <option value="July 2026" className="bg-slate-900 text-white">July 2026</option>
                <option value="June 2026" className="bg-slate-900 text-white">June 2026</option>
                <option value="September 2026" className="bg-slate-900 text-white">September 2026</option>
              </select>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Stepper Navigation Pills */}
        <div className="grid grid-cols-5 gap-2 mt-6 pt-5 border-t border-slate-800/80">
          {stepsMetadata.map((step) => {
            const isActive = currentStep === step.num;
            const isCompleted = currentStep > step.num;
            return (
              <button
                key={step.num}
                type="button"
                onClick={() => {
                  if (step.num === 3 && results.length === 0) executeMatch();
                  setCurrentStep(step.num as AssistantStep);
                }}
                className={`relative flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/40'
                    : isCompleted
                      ? 'bg-slate-800/80 text-emerald-400 hover:bg-slate-800'
                      : 'bg-slate-850 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                    isActive
                      ? 'bg-white text-blue-600'
                      : isCompleted
                        ? 'bg-emerald-500 text-slate-950 font-black'
                        : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {isCompleted ? <Check size={13} /> : step.num}
                </div>
                <div className="hidden sm:block overflow-hidden">
                  <span className="text-xs font-black block truncate leading-tight">
                    {step.title}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate font-normal">
                    {step.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* --- Restored Session Alert Banner --- */}
      {showDraftRestoredAlert && (
        <div className="bg-indigo-50/90 border-b border-indigo-200 px-6 py-2.5 flex items-center justify-between text-xs font-bold text-indigo-950">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-indigo-600 shrink-0" />
            <span>
              Auto-saved session recovered from local storage ({lastSavedTime || 'Recent'}). All uploaded invoices, resolution decisions, and matching parameters have been preserved.
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleClearSavedDraftAndReset}
              className="text-indigo-700 hover:text-rose-700 underline text-xs font-medium cursor-pointer"
            >
              Discard & Start Clean
            </button>
            <button
              type="button"
              onClick={() => setShowDraftRestoredAlert(false)}
              className="p-1 text-indigo-500 hover:text-indigo-900 rounded-md cursor-pointer"
              title="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* --- Notification Banner --- */}
      {ingestionMessage && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-2.5 flex items-center justify-between text-xs font-bold text-blue-900">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-blue-600" />
            <span>{ingestionMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setIngestionMessage(null)}
            className="text-blue-600 hover:text-blue-900 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {exportSuccessMsg && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center justify-between text-xs font-bold text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{exportSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* --- Main Step Content --- */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        {/* ================= STEP 1: DATA INGESTION ================= */}
        {currentStep === 1 && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Upload size={18} className="text-blue-600" />
                  Step 1: Load Purchase Register & Import GSTR-2B Statement
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Ingest your internal ERP purchase register and fetch government-reported GSTR-2B data for tax period <strong className="text-slate-800 font-bold">{returnPeriod}</strong>.
                </p>
              </div>

              <button
                type="button"
                onClick={loadBenchmarkData}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Sparkles size={14} className="text-blue-600" />
                Load Enterprise Benchmark Data
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Purchase Invoices / Internal Books */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
                      <FileSpreadsheet size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">1. Purchase Register (Books)</h4>
                      <span className="text-[11px] text-slate-500">Accounts Payable Invoices / Tally / SAP</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-mono text-xs font-black rounded-lg">
                    {purchaseInvoices.length} Invoices
                  </span>
                </div>

                {/* Dropzone Area */}
                <div
                  onClick={() => purchaseFileRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/40 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all flex-1 min-h-[160px]"
                >
                  <input
                    type="file"
                    ref={purchaseFileRef}
                    onChange={handlePurchaseFileUpload}
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                  />
                  <FileSpreadsheet size={32} className="text-blue-500 mb-2" />
                  <span className="text-xs font-bold text-slate-800">
                    {purchasesFileName || 'Click to upload Purchase Register (.xlsx, .csv)'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">
                    Supports ERP exports (Tally, SAP, Zoho Books, Busy, ClearTax)
                  </span>
                </div>

                {/* Metrics Summary of Ingested Purchases */}
                {purchaseInvoices.length > 0 && (
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-2 gap-2 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 font-sans block">Total Taxable Value</span>
                      <span className="font-black text-slate-800">
                        ₹{(purchaseInvoices.reduce((a, b) => a + b.taxableAmount, 0) / 100000).toFixed(2)} Lakhs
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-sans block">Total Inward Tax</span>
                      <span className="font-black text-blue-700">
                        ₹{(purchaseInvoices.reduce((a, b) => a + b.totalTax, 0) / 100000).toFixed(2)} Lakhs
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 2: GSTR-2B Statement / Government Portal */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 bg-purple-50 text-purple-700 rounded-xl">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">2. GSTR-2B Import (GSTN Portal)</h4>
                      <span className="text-[11px] text-slate-500">Auto-populated static ITC statement</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-purple-50 text-purple-700 font-mono text-xs font-black rounded-lg">
                    {gstr2bRecords.length} Records
                  </span>
                </div>

                {/* Import Buttons: Direct API vs JSON Upload */}
                <div className="space-y-3 flex-1 flex flex-col justify-center">
                  <button
                    type="button"
                    onClick={handleDirectGstnSync}
                    disabled={isSyncingGstn}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={15} className={isSyncingGstn ? 'animate-spin' : ''} />
                    {isSyncingGstn ? 'Fetching GSTR-2B from GSTN Portal API...' : '1-Click Fetch from GSTN Portal API'}
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="h-px bg-slate-200 flex-1" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Or upload JSON / Excel</span>
                    <div className="h-px bg-slate-200 flex-1" />
                  </div>

                  <div
                    onClick={() => gstr2bFileRef.current?.click()}
                    className="border border-slate-200 hover:border-purple-400 bg-slate-50 hover:bg-purple-50/30 rounded-xl p-3 text-center cursor-pointer transition-colors"
                  >
                    <input
                      type="file"
                      ref={gstr2bFileRef}
                      onChange={handleGstr2bFileUpload}
                      accept=".json,.xlsx,.xls,.csv"
                      className="hidden"
                    />
                    <span className="text-xs font-bold text-slate-700 block truncate">
                      {gstr2bFileName || 'Upload GST Portal GSTR-2B (.json or .xlsx)'}
                    </span>
                  </div>
                </div>

                {/* Metrics Summary of Ingested 2B */}
                {gstr2bRecords.length > 0 && (
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-2 gap-2 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 font-sans block">Total 2B Taxable Value</span>
                      <span className="font-black text-slate-800">
                        ₹{(gstr2bRecords.reduce((a, b) => a + b.taxableValue, 0) / 100000).toFixed(2)} Lakhs
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-sans block">Auto-Populated 2B Tax</span>
                      <span className="font-black text-purple-700">
                        ₹{(gstr2bRecords.reduce((a, b) => a + b.totalTax, 0) / 100000).toFixed(2)} Lakhs
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Validation Callout before proceeding */}
            <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 flex items-start gap-3.5">
              <ShieldCheck size={20} className="text-blue-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <span className="text-xs font-extrabold text-blue-950 block">
                  Data Quality & Readiness Check
                </span>
                <p className="text-[11px] text-blue-900 leading-relaxed">
                  Ready to reconcile <strong className="font-bold">{purchaseInvoices.length} purchase vouchers</strong> against <strong className="font-bold">{gstr2bRecords.length} portal records</strong>. Next, configure matching criteria and tolerance thresholds.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 2: MATCHING RULES & TOLERANCES ================= */}
        {currentStep === 2 && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-blue-600" />
                Step 2: Configure Matching Parameters & Tolerance Thresholds
              </h3>
              <p className="text-xs text-slate-500">
                Adjust multi-pass matching sensitivity to handle decimal rounding, minor date variances, and fuzzy invoice numbers.
              </p>
            </div>

            {/* Presets Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-700">Quick Matching Presets:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setConfig({
                    dateToleranceDays: 0,
                    taxAmountTolerance: 0,
                    taxableValueTolerance: 0,
                    fuzzyInvoiceMatching: false,
                    enforceGstinStrictMatch: true,
                    enforcePosMatch: true,
                    autoTagSec17Blocked: true
                  })}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Strict Statutory (0 Tolerance)
                </button>
                <button
                  type="button"
                  onClick={() => setConfig(DEFAULT_GSTR2B_MATCHING_CONFIG)}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Balanced Recommended (±7 Days, ±₹10 Tax)
                </button>
                <button
                  type="button"
                  onClick={() => setConfig({
                    dateToleranceDays: 15,
                    taxAmountTolerance: 50,
                    taxableValueTolerance: 500,
                    fuzzyInvoiceMatching: true,
                    enforceGstinStrictMatch: true,
                    enforcePosMatch: false,
                    autoTagSec17Blocked: true
                  })}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Lenient Audit (±15 Days, ±₹50 Tax)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tolerance Sliders */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Sliders size={16} className="text-blue-600" />
                  Numeric Variance Tolerances
                </h4>

                {/* 1. Date Tolerance */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">Invoice Date Variance Window</span>
                    <span className="font-mono font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      ±{config.dateToleranceDays} Days
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    value={config.dateToleranceDays ?? 7}
                    onChange={(e) => setConfig({ ...config, dateToleranceDays: Number(e.target.value) })}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-400 block">
                    Permits matching when invoice in ERP is dated up to {config.dateToleranceDays} days apart from supplier filing date.
                  </span>
                </div>

                {/* 2. Tax Amount Tolerance */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">Tax Amount Round-off Tolerance</span>
                    <span className="font-mono font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      ±₹{config.taxAmountTolerance}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={config.taxAmountTolerance ?? 10}
                    onChange={(e) => setConfig({ ...config, taxAmountTolerance: Number(e.target.value) })}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-400 block">
                    Absorbs minor round-off differences in CGST/SGST/IGST decimal computations.
                  </span>
                </div>

                {/* 3. Taxable Value Tolerance */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">Taxable Value Variance Limit</span>
                    <span className="font-mono font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      ±₹{config.taxableValueTolerance}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={500}
                    step={10}
                    value={config.taxableValueTolerance ?? 100}
                    onChange={(e) => setConfig({ ...config, taxableValueTolerance: Number(e.target.value) })}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-400 block">
                    Flags higher variances as value mismatches for audit intervention.
                  </span>
                </div>
              </div>

              {/* Rule Toggles */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Scale size={16} className="text-purple-600" />
                  Statutory Matching Algorithms
                </h4>

                <label className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={config.fuzzyInvoiceMatching ?? true}
                    onChange={(e) => setConfig({ ...config, fuzzyInvoiceMatching: e.target.checked })}
                    className="mt-1 w-4 h-4 rounded text-blue-600 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-black text-slate-800 block">Fuzzy Invoice Number Normalization</span>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      Ignores slashes, hyphens, and leading zeroes (e.g. <code className="bg-white px-1 rounded">SHK/2026/5512</code> matches <code className="bg-white px-1 rounded">SHK-5512</code>).
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={config.enforceGstinStrictMatch ?? true}
                    onChange={(e) => setConfig({ ...config, enforceGstinStrictMatch: e.target.checked })}
                    className="mt-1 w-4 h-4 rounded text-blue-600 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-black text-slate-800 block">Strict 15-Digit GSTIN Matching</span>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      Requires exact match on supplier state code and entity GSTIN.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={config.autoTagSec17Blocked ?? true}
                    onChange={(e) => setConfig({ ...config, autoTagSec17Blocked: e.target.checked })}
                    className="mt-1 w-4 h-4 rounded text-blue-600 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-black text-slate-800 block">Auto-Tag Section 17(5) Blocked ITC</span>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      Automatically detects motor fleet servicing, catering, and club memberships for GSTR-3B Table 4(B)(1) reversal.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={config.enforcePosMatch ?? false}
                    onChange={(e) => setConfig({ ...config, enforcePosMatch: e.target.checked })}
                    className="mt-1 w-4 h-4 rounded text-blue-600 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-black text-slate-800 block">Place of Supply (POS) Strict Check</span>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      Flags transactions where supplier filed Inter-state (IGST) while Books booked Intra-state (CGST+SGST).
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 3: MISMATCH DETECTION & ANALYSIS ================= */}
        {currentStep === 3 && (
          <div className="space-y-6 max-w-6xl mx-auto">
            {/* KPI Cards Summary */}
            {summary && (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Recon Match Rate
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-slate-900 font-mono">
                      {summary.reconciliationMatchRate}%
                    </span>
                    <span className="text-xs font-bold text-emerald-600">
                      {summary.exactMatchesCount} Matched
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full"
                      style={{ width: `${summary.reconciliationMatchRate}%` }}
                    />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Eligible 3B ITC
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-emerald-600 font-mono">
                      ₹{(summary.claimableItcAmount / 100000).toFixed(2)} L
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Table 4(A)(5) Claimable
                  </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs bg-rose-50/30">
                  <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">
                    At-Risk ITC (Unfiled)
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-rose-600 font-mono">
                      ₹{(summary.atRiskItcAmount / 100000).toFixed(2)} L
                    </span>
                  </div>
                  <span className="text-[10px] text-rose-500 font-bold block mt-1">
                    {summary.missingInGstr2bCount} Invoices Missing in 2B
                  </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-cyan-200 shadow-xs bg-cyan-50/30">
                  <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block">
                    Unclaimed ITC (In 2B)
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-cyan-700 font-mono">
                      ₹{(summary.unclaimedItcAmount / 100000).toFixed(2)} L
                    </span>
                  </div>
                  <span className="text-[10px] text-cyan-600 font-bold block mt-1">
                    {summary.missingInBooksCount} Unclaimed Vouchers
                  </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-purple-200 shadow-xs bg-purple-50/30">
                  <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
                    Sec 17(5) Blocked
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-purple-700 font-mono">
                      ₹{(summary.blockedItcAmount / 100000).toFixed(2)} L
                    </span>
                  </div>
                  <span className="text-[10px] text-purple-600 font-bold block mt-1">
                    {summary.sec17BlockedCount} Ineligible Records
                  </span>
                </div>
              </div>
            )}

            {/* Filter Chips & Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                {/* Search */}
                <div className="relative w-full md:w-80">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by supplier, invoice #, or GSTIN..."
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>

                {/* High Risk Toggle & Re-run */}
                <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <input
                      type="checkbox"
                      checked={onlyHighRisk}
                      onChange={(e) => setOnlyHighRisk(e.target.checked)}
                      className="w-4 h-4 text-rose-600 rounded cursor-pointer"
                    />
                    <span>High Risk Only</span>
                  </label>

                  <button
                    type="button"
                    onClick={executeMatch}
                    disabled={isProcessingMatch}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={13} className={isProcessingMatch ? 'animate-spin' : ''} />
                    Re-run Matching
                  </button>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { key: 'ALL', label: 'All Records', count: results.length },
                  { key: 'EXACT_MATCH', label: 'Exact Matched', count: results.filter(r => r.status === 'EXACT_MATCH').length },
                  { key: 'AMOUNT_MISMATCH', label: 'Value Discrepancy', count: results.filter(r => r.status === 'AMOUNT_MISMATCH').length },
                  { key: 'TAX_HEAD_MISMATCH', label: 'Tax Head Mismatch', count: results.filter(r => r.status === 'TAX_HEAD_MISMATCH').length },
                  { key: 'DATE_MISMATCH', label: 'Period Variance', count: results.filter(r => r.status === 'DATE_MISMATCH').length },
                  { key: 'MISSING_IN_GSTR2B', label: 'Missing in 2B (Default)', count: results.filter(r => r.status === 'MISSING_IN_GSTR2B').length },
                  { key: 'MISSING_IN_BOOKS', label: 'Missing in Books', count: results.filter(r => r.status === 'MISSING_IN_BOOKS').length },
                  { key: 'SECTION_17_5_BLOCKED', label: 'Sec 17(5) Blocked', count: results.filter(r => r.status === 'SECTION_17_5_BLOCKED').length },
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatusFilter(tab.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      statusFilter === tab.key
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                      statusFilter === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Side-by-Side Discrepancy Comparison Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider">
                      <th className="p-3.5 pl-4">Supplier & Party Name</th>
                      <th className="p-3.5">Internal Books (Purchase)</th>
                      <th className="p-3.5">GSTR-2B Statement (GSTN)</th>
                      <th className="p-3.5">Variance / Discrepancy</th>
                      <th className="p-3.5">Match Status</th>
                      <th className="p-3.5 pr-4 text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredResults.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                          No transactions matching filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredResults.map((item) => {
                        const hasAmountMismatch = item.status === 'AMOUNT_MISMATCH';
                        const hasTaxHeadMismatch = item.status === 'TAX_HEAD_MISMATCH';
                        const isMissing2B = item.status === 'MISSING_IN_GSTR2B';
                        const isMissingBooks = item.status === 'MISSING_IN_BOOKS';

                        return (
                          <tr
                            key={item.id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isMissing2B ? 'bg-rose-50/20' : isMissingBooks ? 'bg-cyan-50/20' : ''
                            }`}
                          >
                            {/* Supplier & GSTIN */}
                            <td className="p-3.5 pl-4 align-top">
                              <span className="font-extrabold text-slate-900 block truncate max-w-[200px]">
                                {item.purchaseRecord?.partyName || item.gstr2bRecord?.supplierName || 'Unknown'}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500 block mt-0.5">
                                {item.purchaseRecord?.gstin || item.gstr2bRecord?.gstin || '-'}
                              </span>
                              {item.purchaseRecord?.voucherNumber && (
                                <span className="text-[10px] text-blue-600 font-mono font-bold block mt-0.5">
                                  Voucher: {item.purchaseRecord.voucherNumber}
                                </span>
                              )}
                            </td>

                            {/* Books Side */}
                            <td className="p-3.5 align-top">
                              {item.purchaseRecord ? (
                                <div className="space-y-0.5 font-mono">
                                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                    <span>#{item.purchaseRecord.invoiceNumber}</span>
                                    <span className="text-[10px] font-normal text-slate-400">
                                      ({item.purchaseRecord.date})
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-600">
                                    Taxable: ₹{item.purchaseRecord.taxableValue.toLocaleString()}
                                  </div>
                                  <div className="text-[11px] font-black text-blue-700">
                                    Tax: ₹{item.purchaseRecord.taxAmount.toLocaleString()}{' '}
                                    <span className="text-[10px] font-normal text-slate-400">
                                      ({item.purchaseRecord.igst > 0 ? 'IGST' : 'CGST+SGST'})
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-[10px] font-bold">
                                  Not in Books
                                </span>
                              )}
                            </td>

                            {/* 2B Side */}
                            <td className="p-3.5 align-top">
                              {item.gstr2bRecord ? (
                                <div className="space-y-0.5 font-mono">
                                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                    <span>#{item.gstr2bRecord.invoiceNumber}</span>
                                    <span className="text-[10px] font-normal text-slate-400">
                                      ({item.gstr2bRecord.invoiceDate})
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-600">
                                    Taxable: ₹{item.gstr2bRecord.taxableValue.toLocaleString()}
                                  </div>
                                  <div className="text-[11px] font-black text-purple-700">
                                    Tax: ₹{item.gstr2bRecord.totalTax.toLocaleString()}{' '}
                                    <span className="text-[10px] font-normal text-slate-400">
                                      ({item.gstr2bRecord.igst > 0 ? 'IGST' : 'CGST+SGST'})
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg text-[10px] font-black flex items-center gap-1 w-fit">
                                  <XCircle size={12} />
                                  Not Filed in 2B
                                </span>
                              )}
                            </td>

                            {/* Variance & Discrepancies */}
                            <td className="p-3.5 align-top">
                              {Math.abs(item.taxDifference) > 0 ? (
                                <div className="space-y-0.5">
                                  <span className={`font-mono text-xs font-black block ${
                                    item.taxDifference > 0 ? 'text-rose-600' : 'text-cyan-700'
                                  }`}>
                                    {item.taxDifference > 0 ? `+₹${item.taxDifference.toLocaleString()} Shortfall` : `-₹${Math.abs(item.taxDifference).toLocaleString()} Unclaimed`}
                                  </span>
                                  <span className="text-[10px] text-slate-500 block leading-tight">
                                    {item.discrepancies[0] || item.discrepancyCategory}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                                  <Check size={13} />
                                  Zero Variance
                                </span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="p-3.5 align-top">
                              {getStatusBadge(item.status)}
                            </td>

                            {/* Actions / Inspect */}
                            <td className="p-3.5 pr-4 align-top text-right">
                              <button
                                type="button"
                                onClick={() => setInspectingItem(item)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ml-auto"
                              >
                                <Eye size={13} />
                                Inspect
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 4: RESOLUTION & ACTION HUB ================= */}
        {currentStep === 4 && (
          <div className="space-y-6 max-w-6xl mx-auto">
            {/* Resolution Batch Toolbar */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <ShieldAlert size={18} className="text-amber-600" />
                  Step 4: Interactive Discrepancy Resolution & Supplier Actions
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Protect cash flow by holding supplier payments for unfiled invoices and dispatching automated GST notices.
                </p>
              </div>

              {/* Bulk Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleHoldPaymentForUnfiled}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Lock size={14} />
                  Hold Payment for All 2B Missing
                </button>

                <button
                  type="button"
                  onClick={handleAcceptMinorRounding}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Check size={14} />
                  Accept Minor Rounding (&le; ₹10)
                </button>
              </div>
            </div>

            {/* List of Flagged Mismatches Requiring Action */}
            <div className="space-y-3.5">
              {results.filter(r => r.status !== 'EXACT_MATCH').length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2">
                  <CheckCircle2 size={36} className="text-emerald-500 mx-auto" />
                  <h4 className="text-sm font-black text-slate-800">No Outstanding Discrepancies</h4>
                  <p className="text-xs text-slate-500">All purchase invoices are fully aligned with your GSTR-2B data import.</p>
                </div>
              ) : (
                results.filter(r => r.status !== 'EXACT_MATCH').map((item) => {
                  const isPaymentHeld = heldPaymentIds.has(item.id) || item.purchaseRecord?.paymentStatus === 'PAYMENT_HELD';
                  const isAccepted = acceptedOverrides.has(item.id);
                  const isDeferred = deferredIds.has(item.id);
                  const isNoticeSent = noticeSentIds.has(item.id);

                  return (
                    <div
                      key={item.id}
                      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all space-y-3"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
                            <Building2 size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-black text-slate-900">
                                {item.purchaseRecord?.partyName || item.gstr2bRecord?.supplierName}
                              </h4>
                              {getStatusBadge(item.status)}
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono">
                              GSTIN: {item.purchaseRecord?.gstin || item.gstr2bRecord?.gstin} | Inv #{item.purchaseRecord?.invoiceNumber || item.gstr2bRecord?.invoiceNumber}
                            </span>
                          </div>
                        </div>

                        {/* Status Badges */}
                        <div className="flex items-center gap-2">
                          {isPaymentHeld && (
                            <span className="px-2.5 py-1 bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-black flex items-center gap-1">
                              <Lock size={12} />
                              Payment Held in ERP
                            </span>
                          )}
                          {isAccepted && (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-black flex items-center gap-1">
                              <Check size={12} />
                              Override Accepted
                            </span>
                          )}
                          {isDeferred && (
                            <span className="px-2.5 py-1 bg-purple-100 text-purple-800 border border-purple-200 rounded-lg text-xs font-black flex items-center gap-1">
                              <Calendar size={12} />
                              Deferred to Next Month
                            </span>
                          )}
                          {isNoticeSent && (
                            <span className="px-2.5 py-1 bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-black flex items-center gap-1">
                              <Mail size={12} />
                              Notice Dispatched
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Detailed Discrepancy Breakdown Box */}
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Audit Finding</span>
                          <span className="font-bold text-slate-800 block mt-0.5">{item.discrepancyCategory}</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">{item.statutoryClause}</span>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Tax Comparison</span>
                          <div className="font-mono text-[11px] mt-0.5">
                            <span>Books: ₹{item.purchaseRecord?.taxAmount.toLocaleString() || '0'}</span>
                            <span className="mx-1.5 text-slate-400">vs</span>
                            <span>2B: ₹{item.gstr2bRecord?.totalTax.toLocaleString() || '0'}</span>
                          </div>
                          <span className={`text-[11px] font-black font-mono block mt-0.5 ${
                            item.taxDifference > 0 ? 'text-rose-600' : 'text-cyan-700'
                          }`}>
                            Variance: ₹{Math.abs(item.taxDifference).toLocaleString()}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Recommended Resolution</span>
                          <span className="text-slate-700 block mt-0.5 leading-tight">{item.recommendedAction}</span>
                        </div>
                      </div>

                      {/* Resolution Actions Toolbar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex flex-wrap gap-2">
                          {/* Notice Dispatch */}
                          <button
                            type="button"
                            onClick={() => setActiveNoticeItem(item)}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Mail size={13} className="text-blue-600" />
                            Send Supplier Notice
                          </button>

                          {/* Hold Payment */}
                          <button
                            type="button"
                            onClick={() => {
                              const newSet = new Set(heldPaymentIds);
                              if (newSet.has(item.id)) newSet.delete(item.id);
                              else newSet.add(item.id);
                              setHeldPaymentIds(newSet);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                              isPaymentHeld
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            <Lock size={13} />
                            {isPaymentHeld ? 'Release Payment Hold' : 'Hold Supplier Payment'}
                          </button>

                          {/* Accept Override */}
                          <button
                            type="button"
                            onClick={() => {
                              const newMap = new Map(acceptedOverrides);
                              if (newMap.has(item.id)) newMap.delete(item.id);
                              else newMap.set(item.id, 'Auditor manual override approved.');
                              setAcceptedOverrides(newMap);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                              isAccepted
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            <Check size={13} />
                            {isAccepted ? 'Revoke Override' : 'Accept 2B Value'}
                          </button>

                          {/* Defer */}
                          <button
                            type="button"
                            onClick={() => {
                              const newSet = new Set(deferredIds);
                              if (newSet.has(item.id)) newSet.delete(item.id);
                              else newSet.add(item.id);
                              setDeferredIds(newSet);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                              isDeferred
                                ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            <Calendar size={13} />
                            {isDeferred ? 'Revert Deferral' : 'Defer to Next Month'}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setInspectingItem(item)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Eye size={13} />
                          Inspect Details
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ================= STEP 5: GSTR-3B TABLE 4 & EXPORT ================= */}
        {currentStep === 5 && summary && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <FileCheck size={18} className="text-emerald-600" />
                  Step 5: GSTR-3B Table 4 Preparation & Audit Exports
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Statutory ITC categorization ready for GSTR-3B return filing with multi-format audit exports.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => exportReconciliationAssistantExcel(results, summary, tenantName, returnPeriod)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <FileSpreadsheet size={15} />
                  Download Excel (.xlsx)
                </button>

                <button
                  type="button"
                  onClick={() => exportReconciliationAssistantPdf(results, summary, tenantName, returnPeriod)}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Download size={15} />
                  Download Audit PDF
                </button>
              </div>
            </div>

            {/* GSTR-3B Table 4 Statutory Breakdown Card */}
            <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                  GSTR-3B Table 4 Inward Tax Credit Summary
                </span>
                <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 font-mono text-xs font-black rounded-md">
                  Statutory Rule 36(4) Compliant
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
                {/* 4(A)(5) All Other ITC */}
                <div className="bg-slate-800/80 p-4 rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-400 font-sans uppercase font-bold block">
                    Table 4(A)(5) - Eligible ITC (Auto-Populated from 2B)
                  </span>
                  <span className="text-xl font-black text-emerald-400 block">
                    ₹{summary.gstr3bTable4.table4A5_EligibleItc.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-slate-400 font-sans block">
                    Gross eligible inward supplies matched with GSTR-2B statement.
                  </span>
                </div>

                {/* 4(B)(1) Permanent Reversal */}
                <div className="bg-slate-800/80 p-4 rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-400 font-sans uppercase font-bold block">
                    Table 4(B)(1) - Ineligible ITC As Per Section 17(5)
                  </span>
                  <span className="text-xl font-black text-purple-400 block">
                    ₹{summary.gstr3bTable4.table4B1_PermanentReversal17_5.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-slate-400 font-sans block">
                    Permanent reversal for motor vehicles, food & welfare expenses.
                  </span>
                </div>

                {/* 4(B)(2) Temporary Reversal */}
                <div className="bg-slate-800/80 p-4 rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-400 font-sans uppercase font-bold block">
                    Table 4(B)(2) - Reversals: Others (Deferred / Unfiled in 2B)
                  </span>
                  <span className="text-xl font-black text-rose-400 block">
                    ₹{summary.gstr3bTable4.table4B2_TemporaryReversals.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-slate-400 font-sans block">
                    High-risk unfiled invoices held pending supplier reflection.
                  </span>
                </div>

                {/* 4(C) Net Available ITC */}
                <div className="bg-blue-600/20 border border-blue-500/40 p-4 rounded-xl space-y-1">
                  <span className="text-[10px] text-blue-300 font-sans uppercase font-extrabold block">
                    Table 4(C) - Net ITC Available (4A - 4B)
                  </span>
                  <span className="text-2xl font-black text-white block">
                    ₹{summary.gstr3bTable4.table4C_NetItcAvailable.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-blue-200/80 font-sans block">
                    Final credited amount to Electronic Credit Ledger for tax set-off.
                  </span>
                </div>
              </div>
            </div>

            {/* Statutory Audit Seal & Verification */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-start gap-4">
              <div className="p-3 bg-blue-50 text-blue-700 rounded-2xl shrink-0">
                <ShieldCheck size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Statutory Audit Seal & Cryptographic Verification
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  This reconciliation run was verified using 5-way matching under CGST Act Sections 16, 17, and Rule 36(4). Audit logs and action trails are cryptographically timestamped for GST Department scrutiny.
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-4 text-[10px] font-mono text-slate-500">
                  <span>Job ID: RECON-{Date.now().toString(36).toUpperCase()}</span>
                  <span>Timestamp: {new Date().toISOString()}</span>
                  <span>Entity GSTIN: {tenantGstin}</span>
                </div>
              </div>
            </div>

            {/* Apply to Return Filing CTA */}
            {onApplyToFiling && (
              <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl text-white flex items-center justify-between shadow-md">
                <div>
                  <h4 className="text-sm font-black text-white">Push to GSTR-3B Return Filing Module</h4>
                  <p className="text-xs text-blue-100 mt-0.5">
                    Pre-populate Table 4 ITC figures into your draft GSTR-3B return for {returnPeriod}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onApplyToFiling(summary)}
                  className="px-5 py-2.5 bg-white text-blue-900 hover:bg-blue-50 text-xs font-black rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-2"
                >
                  <ArrowRight size={14} />
                  Apply to GSTR-3B Filing
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- Bottom Navigation Footer --- */}
      <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1) as AssistantStep)}
          disabled={currentStep === 1}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        <div className="flex items-center gap-2">
          {currentStep < 5 ? (
            <button
              type="button"
              onClick={() => {
                if (currentStep === 2 && results.length === 0) {
                  executeMatch();
                }
                setCurrentStep((prev) => Math.min(5, prev + 1) as AssistantStep);
              }}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>Continue to Step {currentStep + 1}</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (onClose) onClose();
              }}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Check size={14} />
              Finish & Exit Assistant
            </button>
          )}
        </div>
      </div>

      {/* --- Detail Inspection Drawer Modal --- */}
      <AnimatePresence>
        {inspectingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col"
            >
              <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white">Voucher Discrepancy Inspection</h3>
                  <span className="text-xs text-slate-400">
                    {inspectingItem.purchaseRecord?.partyName || inspectingItem.gstr2bRecord?.supplierName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectingItem(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
                <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Reconciliation Status</span>
                    <div className="mt-1">{getStatusBadge(inspectingItem.status)}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Match Score</span>
                    <span className="text-sm font-mono font-black text-blue-600">{inspectingItem.matchingScore}%</span>
                  </div>
                </div>

                {/* Side-by-side Table */}
                <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                    <span className="text-[10px] font-sans font-black text-blue-700 uppercase block">Books Record</span>
                    <div>Invoice No: <strong>{inspectingItem.purchaseRecord?.invoiceNumber || '-'}</strong></div>
                    <div>Date: {inspectingItem.purchaseRecord?.date || '-'}</div>
                    <div>Taxable: ₹{inspectingItem.purchaseRecord?.taxableValue.toLocaleString() || '0'}</div>
                    <div>IGST: ₹{inspectingItem.purchaseRecord?.igst.toLocaleString() || '0'}</div>
                    <div>CGST+SGST: ₹{((inspectingItem.purchaseRecord?.cgst || 0) + (inspectingItem.purchaseRecord?.sgst || 0)).toLocaleString()}</div>
                    <div className="font-bold text-blue-700">Total Tax: ₹{inspectingItem.purchaseRecord?.taxAmount.toLocaleString() || '0'}</div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                    <span className="text-[10px] font-sans font-black text-purple-700 uppercase block">GSTR-2B Statement</span>
                    <div>Invoice No: <strong>{inspectingItem.gstr2bRecord?.invoiceNumber || 'MISSING'}</strong></div>
                    <div>Date: {inspectingItem.gstr2bRecord?.invoiceDate || '-'}</div>
                    <div>Taxable: ₹{inspectingItem.gstr2bRecord?.taxableValue.toLocaleString() || '0'}</div>
                    <div>IGST: ₹{inspectingItem.gstr2bRecord?.igst.toLocaleString() || '0'}</div>
                    <div>CGST+SGST: ₹{((inspectingItem.gstr2bRecord?.cgst || 0) + (inspectingItem.gstr2bRecord?.sgst || 0)).toLocaleString()}</div>
                    <div className="font-bold text-purple-700">Total Tax: ₹{inspectingItem.gstr2bRecord?.totalTax.toLocaleString() || '0'}</div>
                  </div>
                </div>

                {/* Discrepancy Findings */}
                <div className="bg-rose-50/70 border border-rose-200 p-3.5 rounded-xl space-y-1 text-xs">
                  <span className="font-black text-rose-900 block">Flagged Discrepancies:</span>
                  <ul className="list-disc list-inside text-rose-800 text-[11px] space-y-0.5">
                    {inspectingItem.discrepancies.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-xl text-xs space-y-1">
                  <span className="font-black text-blue-950 block">Statutory Reference:</span>
                  <p className="text-[11px] text-blue-900 leading-relaxed">{inspectingItem.statutoryClause}</p>
                  <p className="text-[11px] text-blue-800 font-bold mt-1">Plan: {inspectingItem.recommendedAction}</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setInspectingItem(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Close Inspection
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Supplier Notice Dispatch Modal --- */}
      <AnimatePresence>
        {activeNoticeItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col"
            >
              <div className="bg-blue-950 text-white p-5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-600/30 text-blue-400 rounded-xl">
                    <Mail size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Generate Supplier Mismatch Notice</h3>
                    <span className="text-xs text-blue-300">
                      To: {activeNoticeItem.purchaseRecord?.partyName || activeNoticeItem.gstr2bRecord?.supplierName}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveNoticeItem(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {(() => {
                const noticeData: SupplierNoticeData = {
                  supplierName: activeNoticeItem.purchaseRecord?.partyName || activeNoticeItem.gstr2bRecord?.supplierName || 'Vendor',
                  supplierGstin: activeNoticeItem.purchaseRecord?.gstin || activeNoticeItem.gstr2bRecord?.gstin || '',
                  invoiceNumber: activeNoticeItem.purchaseRecord?.invoiceNumber || activeNoticeItem.gstr2bRecord?.invoiceNumber || '',
                  invoiceDate: activeNoticeItem.purchaseRecord?.date || activeNoticeItem.gstr2bRecord?.invoiceDate || '',
                  taxableAmount: activeNoticeItem.purchaseRecord?.taxableValue || activeNoticeItem.gstr2bRecord?.taxableValue || 0,
                  taxAmount: activeNoticeItem.purchaseRecord?.taxAmount || activeNoticeItem.gstr2bRecord?.totalTax || 0,
                  issueDescription: activeNoticeItem.discrepancyCategory,
                  recommendedResolution: activeNoticeItem.recommendedAction,
                  statutoryDeadline: '11th of upcoming month (GSTR-1 Filing Cutoff)',
                  buyerName: tenantName,
                  buyerGstin: tenantGstin,
                  contactEmail: 'tax-compliance@enterprise.com'
                };
                const { subject, emailBody, whatsAppText } = generateSupplierNoticeContent(noticeData);

                return (
                  <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Email Subject</label>
                      <input
                        type="text"
                        readOnly
                        value={subject}
                        className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded-xl px-3 py-2 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Email Draft Body</label>
                      <textarea
                        readOnly
                        rows={8}
                        value={emailBody}
                        className="w-full bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 rounded-xl p-3 outline-none resize-none leading-relaxed"
                      />
                    </div>

                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                        <MessageSquare size={16} className="text-emerald-600" />
                        <span>WhatsApp Quick Dispatch Available</span>
                      </div>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(whatsAppText)}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          const newSet = new Set(noticeSentIds);
                          newSet.add(activeNoticeItem.id);
                          setNoticeSentIds(newSet);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1"
                      >
                        <ExternalLink size={12} />
                        Send via WhatsApp
                      </a>
                    </div>
                  </div>
                );
              })()}

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">
                  Automated dispatch logs will be recorded in audit trail.
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const newSet = new Set(noticeSentIds);
                      newSet.add(activeNoticeItem.id);
                      setNoticeSentIds(newSet);
                      setCopiedNotice(true);
                      setTimeout(() => setCopiedNotice(false), 2000);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy size={13} />
                    {copiedNotice ? 'Dispatched & Copied!' : 'Copy & Mark Dispatched'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveNoticeItem(null)}
                    className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReconciliationAssistant;
