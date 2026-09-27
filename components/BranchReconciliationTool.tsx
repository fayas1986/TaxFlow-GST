import React, { useState, useMemo, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  Landmark, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  HelpCircle, 
  ArrowRightLeft, 
  Filter, 
  Search, 
  Upload, 
  Download, 
  RefreshCw, 
  Sparkles, 
  Layers, 
  ChevronRight, 
  ShieldCheck, 
  FileText, 
  Sliders, 
  Check, 
  X, 
  ArrowUpRight, 
  Clock, 
  DollarSign, 
  Info, 
  Send, 
  FileSpreadsheet, 
  Printer, 
  Zap, 
  AlertCircle,
  TrendingUp,
  Tag,
  BookOpen
} from 'lucide-react';
import { RootState, setSelectedBranch } from '../store/store';
import { BranchDetailsItem, Invoice, UserRole, BankStatementTransaction, BranchReconMatch, BranchDiscrepancyType } from '../types';
import { fetchInvoices } from '../services/api';
import { subscriptionManager } from '../src/core/billing/SubscriptionManager';
import { PlanCode } from '../src/core/entitlements/types';
import { 
  runBranchReconciliation, 
  BRANCH_BANK_ACCOUNTS, 
  SEED_BRANCH_BANK_TRANSACTIONS, 
  DEFAULT_BRANCH_RECON_CONFIG, 
  BranchReconFilterConfig,
  BranchBankAccount
} from '../services/branchReconciliationService';
import { parseBankCsv } from '../utils/autoReconcileEngine';
import { exportToCSV } from '../utils/export';

export interface BranchReconciliationToolProps {
  initialBranchId?: string;
  onNavigateToBranchManager?: () => void;
  className?: string;
}

export const BranchReconciliationTool: React.FC<BranchReconciliationToolProps> = ({
  initialBranchId,
  onNavigateToBranchManager,
  className = ''
}) => {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const tenantId = user?.currentTenantId || 't1';
  const selectedBranchIdFromStore = useSelector((state: RootState) => state.org.selectedBranchId);
  const branchesByTenant = useSelector((state: RootState) => state.org.branchesByTenant);

  const branches: BranchDetailsItem[] = useMemo(() => {
    return branchesByTenant[tenantId] || [];
  }, [branchesByTenant, tenantId]);

  // Plan Entitlements & Starter Detection
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  const subProfile = subscriptionManager.getUserSubscriptionProfile(user?.role, tenantId);
  const canMultiBranch = isSuperAdmin || Boolean(subProfile.canMultiBranch);
  const isStarterPlan = !isSuperAdmin && (!canMultiBranch || subProfile.planCode === PlanCode.STARTER || subProfile.maxBranches <= 1);

  // Selected Branch State
  // Starter plans are locked to their single designated branch or first available branch
  const activeBranchId = useMemo(() => {
    if (isStarterPlan) {
      return branches[0]?.id || 'b1';
    }
    if (initialBranchId) return initialBranchId;
    if (selectedBranchIdFromStore && selectedBranchIdFromStore !== 'ALL') {
      return selectedBranchIdFromStore;
    }
    return branches[0]?.id || 'b1';
  }, [isStarterPlan, branches, initialBranchId, selectedBranchIdFromStore]);

  const [currentBranchId, setCurrentBranchId] = useState<string>(activeBranchId);

  // Synchronize state when store or branches update
  React.useEffect(() => {
    if (activeBranchId && activeBranchId !== currentBranchId) {
      setCurrentBranchId(activeBranchId);
    }
  }, [activeBranchId]);

  const activeBranchDetails = useMemo(() => {
    if (currentBranchId === 'ALL') return undefined;
    return branches.find(b => b.id === currentBranchId) || branches[0];
  }, [branches, currentBranchId]);

  // UI View Modes: Starter plan defaults to SIMPLIFIED, but can toggle
  const [viewMode, setViewMode] = useState<'SIMPLIFIED' | 'ADVANCED'>(isStarterPlan ? 'SIMPLIFIED' : 'SIMPLIFIED');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTabFilter, setActiveTabFilter] = useState<'ALL' | 'DISCREPANCIES' | 'RECONCILED' | 'MISSING_IN_BANK' | 'UNMATCHED_BANK'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'SALES' | 'PURCHASE'>('ALL');

  // Bank Statement State
  const [bankTxns, setBankTxns] = useState<BankStatementTransaction[]>(SEED_BRANCH_BANK_TRANSACTIONS);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Engine Running State
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeResolutionModal, setActiveResolutionModal] = useState<BranchReconMatch | null>(null);
  const [adjustmentNote, setAdjustmentNote] = useState('');

  // Fetch Invoices for tenant
  const { data: invoices = [], isLoading: isLoadingInvoices, refetch: refetchInvoices } = useQuery({
    queryKey: ['invoices', tenantId],
    queryFn: () => fetchInvoices(tenantId, 'ALL', 'ALL')
  });

  // Active Bank Accounts for Branch
  const branchBankAccounts: BranchBankAccount[] = useMemo(() => {
    if (currentBranchId === 'ALL') {
      return Object.values(BRANCH_BANK_ACCOUNTS).flat();
    }
    return BRANCH_BANK_ACCOUNTS[currentBranchId] || [
      {
        branchId: currentBranchId,
        branchName: activeBranchDetails?.name || 'Branch Main Account',
        bankName: 'HDFC Corporate Commercial',
        accountNumber: '502000' + (activeBranchDetails?.code?.replace(/[^0-9]/g, '') || '9921'),
        ifscCode: 'HDFC0000014',
        accountType: 'CURRENT',
        openingBalance: 1500000,
        currentBalance: 1845000
      }
    ];
  }, [currentBranchId, activeBranchDetails]);

  // Matching Configuration
  const [config, setConfig] = useState<BranchReconFilterConfig>(DEFAULT_BRANCH_RECON_CONFIG);

  // Compute Reconciliation Results
  const reconSummary = useMemo(() => {
    return runBranchReconciliation(
      currentBranchId,
      invoices,
      bankTxns,
      { ...config, categoryFilter },
      activeBranchDetails
    );
  }, [currentBranchId, invoices, bankTxns, config, categoryFilter, activeBranchDetails]);

  // Local Match Overrides (e.g. user accepted or adjusted matches)
  const [resolvedMatches, setResolvedMatches] = useState<Record<string, Partial<BranchReconMatch>>>({});

  const displayMatches = useMemo(() => {
    let list = reconSummary.matches.map(m => {
      if (resolvedMatches[m.id]) {
        return { ...m, ...resolvedMatches[m.id] };
      }
      return m;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(m => 
        (m.invoiceNumber && m.invoiceNumber.toLowerCase().includes(q)) ||
        (m.partyName && m.partyName.toLowerCase().includes(q)) ||
        (m.partyGstin && m.partyGstin.toLowerCase().includes(q)) ||
        (m.bankTxn?.description && m.bankTxn.description.toLowerCase().includes(q)) ||
        (m.bankTxn?.refNo && m.bankTxn.refNo.toLowerCase().includes(q))
      );
    }

    if (activeTabFilter === 'DISCREPANCIES') {
      list = list.filter(m => m.status === 'PENDING' || m.confidence === 'DISCREPANCY' || m.confidence === 'UNMATCHED');
    } else if (activeTabFilter === 'RECONCILED') {
      list = list.filter(m => m.status === 'RECONCILED' || m.status === 'RESOLVED_ADJUSTMENT');
    } else if (activeTabFilter === 'MISSING_IN_BANK') {
      list = list.filter(m => m.discrepancyType === 'MISSING_IN_BANK');
    } else if (activeTabFilter === 'UNMATCHED_BANK') {
      list = list.filter(m => m.discrepancyType === 'UNMATCHED_BANK_TXN');
    }

    return list;
  }, [reconSummary.matches, resolvedMatches, searchQuery, activeTabFilter]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleBranchChange = (branchId: string) => {
    setCurrentBranchId(branchId);
    dispatch(setSelectedBranch(branchId));
    showToast(`Switched view to ${branchId === 'ALL' ? 'Consolidated All Branches' : branches.find(b => b.id === branchId)?.name || branchId}`);
  };

  const handleRunAutoMatch = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      showToast(`⚡ Automated branch matching completed: ${reconSummary.reconciledCount} matches validated!`);
    }, 600);
  };

  // Quick 1-Click Resolve Exact & Tolerance Matches for Starter Plan
  const handleStarterQuickFixAll = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const updates: Record<string, Partial<BranchReconMatch>> = {};
      reconSummary.matches.forEach(m => {
        if (m.discrepancyType === 'TDS_ROUNDOFF' || m.discrepancyType === 'TIMING_DELAY') {
          updates[m.id] = {
            status: 'RESOLVED_ADJUSTMENT',
            resolutionNote: 'Auto-resolved via Starter 1-Click Reconcile: TDS / Minor timing tolerance accepted.',
            resolvedAt: new Date().toISOString(),
            resolvedBy: user?.name || 'Accountant'
          };
        }
      });
      setResolvedMatches(prev => ({ ...prev, ...updates }));
      setIsProcessing(false);
      showToast('🎉 All minor round-offs and timing variations reconciled with 1 click!');
    }, 500);
  };

  const handleAcceptMatch = (match: BranchReconMatch) => {
    setResolvedMatches(prev => ({
      ...prev,
      [match.id]: {
        status: 'RECONCILED',
        confidence: 'EXACT',
        resolutionNote: 'Manually verified and confirmed by branch accountant.',
        resolvedAt: new Date().toISOString(),
        resolvedBy: user?.name || 'Branch Accountant'
      }
    }));
    showToast(`Invoice ${match.invoiceNumber || 'entry'} marked as reconciled.`);
  };

  const handleOpenAdjustmentModal = (match: BranchReconMatch) => {
    setActiveResolutionModal(match);
    setAdjustmentNote(
      match.discrepancyType === 'TDS_ROUNDOFF' 
        ? `Post ₹${match.discrepancyAmount.toFixed(2)} to TDS Receivable / Rounding off Ledger.`
        : `Approved variance of ₹${match.discrepancyAmount.toFixed(2)} with vendor acknowledgement.`
    );
  };

  const handleSaveAdjustment = () => {
    if (!activeResolutionModal) return;
    setResolvedMatches(prev => ({
      ...prev,
      [activeResolutionModal.id]: {
        status: 'RESOLVED_ADJUSTMENT',
        confidence: 'PROBABLE',
        resolutionNote: adjustmentNote || 'Adjustment posted to branch books.',
        resolvedAt: new Date().toISOString(),
        resolvedBy: user?.name || 'Branch Accountant'
      }
    }));
    setActiveResolutionModal(null);
    showToast(`Adjustment posted for ${activeResolutionModal.invoiceNumber || 'transaction'}.`);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseBankCsv(text);
      if (parsed.length > 0) {
        // Tag parsed transactions with current branch
        const branchTagged = parsed.map(t => ({
          ...t,
          branchId: currentBranchId === 'ALL' ? 'b1' : currentBranchId,
          branchName: activeBranchDetails?.name || 'Branch Account'
        }));
        setBankTxns(prev => [...branchTagged, ...prev]);
        showToast(`Uploaded ${parsed.length} bank transactions for ${activeBranchDetails?.name || 'branch'}.`);
      } else {
        alert('Could not parse transactions from CSV. Please verify file columns.');
      }
    };
    reader.readAsText(file);
  };

  const handleExportBRS = () => {
    const data = displayMatches.map(m => ({
      'Branch Name': m.branchName,
      'Cost Center': m.costCenter || 'N/A',
      'Invoice Number': m.invoiceNumber || 'N/A',
      'Invoice Date': m.invoiceDate || 'N/A',
      'Invoice Amount (₹)': m.invoiceAmount ? m.invoiceAmount.toFixed(2) : '0.00',
      'Party Name': m.partyName || m.bankTxn?.partyName || 'N/A',
      'Bank Ref / Description': m.bankTxn?.description || 'Missing in Bank',
      'Bank Amount (₹)': m.bankTxn?.amount ? m.bankTxn.amount.toFixed(2) : '0.00',
      'Variance Amount (₹)': m.discrepancyAmount.toFixed(2),
      'Discrepancy Category': m.discrepancyType.replace(/_/g, ' '),
      'Reconciliation Status': m.status,
      'Match Score (%)': `${m.matchScore}%`,
      'Action Notes': m.resolutionNote || m.suggestedAction
    }));

    exportToCSV(data, `TaxFlow_Branch_BRS_${activeBranchDetails?.code || currentBranchId}_${new Date().toISOString().split('T')[0]}`);
    showToast('📥 Branch Reconciliation Statement (BRS) downloaded successfully.');
  };

  const getDiscrepancyBadge = (type: BranchDiscrepancyType, status: BranchReconMatch['status']) => {
    if (status === 'RECONCILED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 size={13} className="text-emerald-600" />
          Reconciled
        </span>
      );
    }
    if (status === 'RESOLVED_ADJUSTMENT') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-blue-50 text-blue-700 border border-blue-200">
          <Check size={13} className="text-blue-600" />
          Adjusted / TDS
        </span>
      );
    }

    switch(type) {
      case 'AMOUNT_VARIANCE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle size={13} className="text-amber-600" />
            Amount Variance
          </span>
        );
      case 'TIMING_DELAY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Clock size={13} className="text-indigo-600" />
            Settlement Delay
          </span>
        );
      case 'TDS_ROUNDOFF':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-cyan-50 text-cyan-700 border border-cyan-200">
            <DollarSign size={13} className="text-cyan-600" />
            TDS / Round-off
          </span>
        );
      case 'MISSING_IN_BANK':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle size={13} className="text-rose-600" />
            Missing in Bank
          </span>
        );
      case 'UNMATCHED_BANK_TXN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-purple-50 text-purple-700 border border-purple-200">
            <Landmark size={13} className="text-purple-600" />
            Direct Bank Entry
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-slate-100 text-slate-700 border border-slate-200">
            <HelpCircle size={13} />
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className={`space-y-6 animate-in fade-in duration-300 ${className}`}>
      {/* Toast Alert Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 right-5 z-[200] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 text-xs font-bold flex items-center gap-2"
          >
            <Sparkles size={16} className="text-blue-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner & Branch Selector */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-6 relative z-10">
          
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
                <Landmark size={12} className="text-blue-600" />
                Branch Reconciliation Tool
              </span>
              
              {isStarterPlan ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 size={11} />
                  Starter Plan Mode (Single Branch)
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                  <Layers size={11} />
                  Multi-Branch Enterprise Engine
                </span>
              )}

              <span className="text-xs text-slate-400 font-medium">
                FY 2026-27 • Automated Bank vs Ledger Matching
              </span>
            </div>

            <div className="flex items-center gap-3">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                <span>Branch Bank Reconciliation</span>
                {isProcessing && <RefreshCw size={18} className="animate-spin text-blue-600" />}
              </h2>
            </div>

            <p className="text-slate-500 text-sm max-w-3xl leading-relaxed">
              Automatically match sales and purchase invoices against bank transactions specific to each branch, detecting TDS deductions, settlement timing delays, and uncredited deposits in real-time.
            </p>
          </div>

          {/* Action & View Switchers */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                onClick={() => setViewMode('SIMPLIFIED')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  viewMode === 'SIMPLIFIED'
                    ? 'bg-white shadow-xs text-blue-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Easy-to-read cards with plain English explanations"
              >
                <Sparkles size={14} className={viewMode === 'SIMPLIFIED' ? 'text-blue-600' : 'text-slate-400'} />
                <span>Simplified View</span>
                {isStarterPlan && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full font-black bg-emerald-100 text-emerald-800">
                    STARTER
                  </span>
                )}
              </button>

              <button
                onClick={() => setViewMode('ADVANCED')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  viewMode === 'ADVANCED'
                    ? 'bg-white shadow-xs text-blue-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Full audit table with GL accounts & side-by-side transaction grid"
              >
                <Sliders size={14} className={viewMode === 'ADVANCED' ? 'text-blue-600' : 'text-slate-400'} />
                <span>Detailed Audit View</span>
              </button>
            </div>

            {/* Auto Match Button */}
            <button
              onClick={handleRunAutoMatch}
              disabled={isProcessing}
              className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Zap size={14} />
              <span>{isProcessing ? 'Matching...' : 'Auto-Match'}</span>
            </button>

            {/* Export BRS Button */}
            <button
              onClick={handleExportBRS}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all flex items-center gap-1.5 border border-slate-200"
              title="Download official Bank Reconciliation Statement"
            >
              <Download size={14} className="text-slate-500" />
              <span>Export BRS</span>
            </button>

            {/* Upload Statement Button */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleCsvUpload} 
              accept=".csv" 
              className="hidden" 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all flex items-center gap-1.5 border border-slate-200"
              title="Upload bank statement CSV"
            >
              <Upload size={14} className="text-slate-500" />
              <span>Upload CSV</span>
            </button>
          </div>
        </div>

        {/* Branch Selection Bar */}
        <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mr-1">
              <Building2 size={14} className="text-slate-400" />
              Active Branch:
            </span>

            {isStarterPlan ? (
              // Clean non-cluttered badge for Starter plan
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-black text-slate-800">
                  {activeBranchDetails?.name || 'Mumbai HQ Office'}
                </span>
                <span className="text-[10px] font-bold text-slate-400 px-1.5 py-0.5 bg-white rounded-md border border-slate-200">
                  {activeBranchDetails?.code || 'MH-HQ-01'}
                </span>
                {activeBranchDetails?.costCenterCode && (
                  <span className="text-[10px] font-bold text-blue-700 px-1.5 py-0.5 bg-blue-50 rounded-md border border-blue-100">
                    {activeBranchDetails.costCenterCode}
                  </span>
                )}
              </div>
            ) : (
              // Multi-branch selector pills for Enterprise / Pro
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => handleBranchChange('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    currentBranchId === 'ALL'
                      ? 'bg-slate-900 text-white font-black shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>All Branches (Consolidated)</span>
                </button>

                {branches.map(branch => (
                  <button
                    key={branch.id}
                    onClick={() => handleBranchChange(branch.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      currentBranchId === branch.id
                        ? 'bg-blue-600 text-white font-black shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{branch.name}</span>
                    <span className={`text-[10px] px-1 py-0.2 rounded-md ${
                      currentBranchId === branch.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {branch.code}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Linked Bank Accounts Info */}
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
            <Landmark size={13} className="text-slate-400" />
            <span className="font-semibold text-slate-700">
              {branchBankAccounts[0]?.bankName || 'HDFC Corporate BKC'}
            </span>
            <span className="text-slate-400 font-mono text-[11px]">
              ({branchBankAccounts[0]?.accountNumber || '••• 8821'})
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards: Reconciliation Metrics for Branch */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Book vs Bank Balance Card */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Branch Invoices Total</p>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <FileText size={16} />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-900 tracking-tight">
              ₹ {reconSummary.totalInvoicesAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1">
              <span>{reconSummary.totalInvoicesCount} invoices recorded in branch register</span>
            </p>
          </div>
        </div>

        {/* Bank Cleared Amount */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bank Cleared Total</p>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Landmark size={16} />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-emerald-600 tracking-tight">
              ₹ {reconSummary.totalBankTxnsAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {reconSummary.totalBankTxnsCount} bank transactions in feed
            </p>
          </div>
        </div>

        {/* Reconciled Match Rate */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reconciliation Rate</p>
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <TrendingUp size={16} />
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-center gap-3">
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {reconSummary.reconciliationRatePct}%
              </p>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500" 
                  style={{ width: `${reconSummary.reconciliationRatePct}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {reconSummary.reconciledCount} of {reconSummary.totalInvoicesCount} invoices reconciled
            </p>
          </div>
        </div>

        {/* Discrepancies at Risk */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Actionable Discrepancies</p>
            <span className={`p-2 rounded-xl ${reconSummary.discrepancyCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <AlertTriangle size={16} />
            </span>
          </div>
          <div className="mt-2">
            <p className={`text-2xl font-black tracking-tight ${reconSummary.discrepancyCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {reconSummary.discrepancyCount} Flagged
            </p>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              ₹ {reconSummary.discrepancyAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} net difference
            </p>
          </div>
        </div>
      </div>

      {/* Starter Plan 1-Click Quick Fix Banner */}
      {isStarterPlan && reconSummary.discrepancyCount > 0 && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-md relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1 z-10 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                Starter SME Assistant
              </span>
              <span className="text-xs text-slate-300 font-medium">
                1-Click Reconciliation
              </span>
            </div>
            <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              <span>Auto-Resolve Minor TDS & Timing Discrepancies</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Found minor standard TDS deductions and bank clearing lags within allowable statutory limits. Click below to automatically accept and balance your branch ledger in one go.
            </p>
          </div>

          <button
            onClick={handleStarterQuickFixAll}
            disabled={isProcessing}
            className="px-5 py-3 rounded-2xl bg-white text-slate-900 hover:bg-blue-50 active:scale-95 font-black text-xs shadow-lg transition-all flex items-center gap-2 z-10 shrink-0"
          >
            <Sparkles size={15} className="text-blue-600" />
            <span>Auto-Resolve All Allowable Discrepancies</span>
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Invoice #, Party, GSTIN, or Bank Narration..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
            <button
              onClick={() => setCategoryFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                categoryFilter === 'ALL' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setCategoryFilter('SALES')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                categoryFilter === 'SALES' ? 'bg-white shadow-xs text-blue-700 font-black' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Sales Receipts
            </button>
            <button
              onClick={() => setCategoryFilter('PURCHASE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                categoryFilter === 'PURCHASE' ? 'bg-white shadow-xs text-blue-700 font-black' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Vendor Payments
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setActiveTabFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTabFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({reconSummary.matches.length})
            </button>

            <button
              onClick={() => setActiveTabFilter('DISCREPANCIES')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                activeTabFilter === 'DISCREPANCIES'
                  ? 'bg-amber-600 text-white font-black shadow-xs'
                  : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle size={12} />
              <span>Discrepancies ({reconSummary.discrepancyCount})</span>
            </button>

            <button
              onClick={() => setActiveTabFilter('RECONCILED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                activeTabFilter === 'RECONCILED'
                  ? 'bg-emerald-600 text-white font-black shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 size={12} />
              <span>Reconciled ({reconSummary.reconciledCount})</span>
            </button>

            <button
              onClick={() => setActiveTabFilter('MISSING_IN_BANK')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                activeTabFilter === 'MISSING_IN_BANK'
                  ? 'bg-rose-600 text-white font-black shadow-xs'
                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <AlertCircle size={12} />
              <span>Missing in Bank ({reconSummary.unmatchedInvoicesCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Reconciliation View */}
      {viewMode === 'SIMPLIFIED' ? (
        // ==========================================
        // SIMPLIFIED VIEW (Optimized for Starter Plans)
        // ==========================================
        <div className="space-y-3">
          {displayMatches.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                <Search size={24} />
              </div>
              <h4 className="text-base font-bold text-slate-800">No reconciliation records match your filter</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try switching branch, clearing search, or running Auto-Match with relaxed date/amount tolerances.
              </p>
            </div>
          ) : (
            displayMatches.map((match) => {
              const isReconciled = match.status === 'RECONCILED' || match.status === 'RESOLVED_ADJUSTMENT';
              const isDiscrepancy = !isReconciled && (match.confidence === 'DISCREPANCY' || match.confidence === 'UNMATCHED');

              return (
                <div 
                  key={match.id}
                  className={`bg-white rounded-3xl p-5 md:p-6 shadow-sm border transition-all ${
                    isReconciled 
                      ? 'border-emerald-100 hover:border-emerald-200' 
                      : isDiscrepancy 
                        ? 'border-amber-200/80 bg-amber-50/20 hover:border-amber-300' 
                        : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    
                    {/* Left: Invoice and Party Information */}
                    <div className="space-y-1.5 flex-1 min-w-[260px]">
                      <div className="flex flex-wrap items-center gap-2">
                        {match.invoiceNumber ? (
                          <span className="text-sm font-black text-slate-900">
                            {match.invoiceNumber}
                          </span>
                        ) : (
                          <span className="text-xs font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                            Direct Bank Transaction
                          </span>
                        )}

                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                          match.category === 'SALES' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'
                        }`}>
                          {match.category === 'SALES' ? 'Customer Invoice' : 'Vendor Bill'}
                        </span>

                        {match.costCenter && (
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            {match.costCenter}
                          </span>
                        )}

                        {getDiscrepancyBadge(match.discrepancyType, match.status)}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span className="font-bold text-slate-900">
                          {match.partyName || match.bankTxn?.partyName || 'Counterparty'}
                        </span>
                        {match.partyGstin && (
                          <span className="text-slate-400 font-mono text-[11px]">
                            GSTIN: {match.partyGstin}
                          </span>
                        )}
                        {match.invoiceDate && (
                          <span className="text-slate-400">
                            Date: {match.invoiceDate}
                          </span>
                        )}
                      </div>

                      {/* Discrepancy Plain English Description */}
                      <div className="pt-1">
                        {match.discrepancyReasons.map((reason, idx) => (
                          <p key={idx} className="text-xs text-slate-600 flex items-start gap-1.5 font-medium">
                            <span className="text-blue-500 mt-0.5">•</span>
                            <span>{reason}</span>
                          </p>
                        ))}
                      </div>
                    </div>

                    {/* Middle: Amount Comparison Box */}
                    <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Invoice Value</p>
                        <p className="text-sm font-black text-slate-900">
                          {match.invoiceAmount ? `₹ ${match.invoiceAmount.toLocaleString()}` : '—'}
                        </p>
                      </div>

                      <ArrowRightLeft size={14} className="text-slate-400" />

                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bank Cleared</p>
                        <p className="text-sm font-black text-emerald-700">
                          {match.bankTxn?.amount ? `₹ ${match.bankTxn.amount.toLocaleString()}` : 'Not In Bank'}
                        </p>
                      </div>

                      {match.discrepancyAmount > 0 && match.status !== 'RECONCILED' && (
                        <div className="pl-2 border-l border-slate-200">
                          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Variance</p>
                          <p className="text-sm font-black text-amber-600">
                            ₹ {match.discrepancyAmount.toFixed(0)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Right: 1-Click Action Resolution Buttons */}
                    <div className="flex items-center gap-2 shrink-0 w-full lg:w-auto justify-end">
                      {isReconciled ? (
                        <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200">
                          <CheckCircle2 size={15} />
                          <span>Balanced & Verified</span>
                        </div>
                      ) : (
                        <>
                          {/* 1-Click Accept Match */}
                          {match.bankTxn && (
                            <button
                              onClick={() => handleAcceptMatch(match)}
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5"
                              title="Accept this bank transaction as matching invoice"
                            >
                              <Check size={13} />
                              <span>Accept Match</span>
                            </button>
                          )}

                          {/* Post Adjustment / TDS Note */}
                          <button
                            onClick={() => handleOpenAdjustmentModal(match)}
                            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all flex items-center gap-1.5 border border-slate-200"
                            title="Post TDS or round-off adjustment entry"
                          >
                            <DollarSign size={13} className="text-slate-500" />
                            <span>Post Adjustment</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        // ==========================================
        // DETAILED AUDIT VIEW (For Pro / Enterprise)
        // ==========================================
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Invoice Details</th>
                  <th className="py-3 px-4">Branch & Cost Center</th>
                  <th className="py-3 px-4 text-right">Invoice Amount</th>
                  <th className="py-3 px-4">Matched Bank Narration</th>
                  <th className="py-3 px-4 text-right">Bank Amount</th>
                  <th className="py-3 px-4 text-right">Variance</th>
                  <th className="py-3 px-4">Discrepancy Category</th>
                  <th className="py-3 px-4">Match Score</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayMatches.map(match => (
                  <tr key={match.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-black text-slate-900">{match.invoiceNumber || 'Bank Deposit/Debit'}</div>
                      <div className="text-slate-500 text-[11px]">{match.partyName || match.bankTxn?.partyName || 'N/A'}</div>
                      {match.invoiceDate && <div className="text-slate-400 text-[10px]">{match.invoiceDate}</div>}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800">{match.branchName}</div>
                      <div className="text-blue-600 font-mono text-[10px]">{match.costCenter || 'N/A'}</div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-black text-slate-900">
                      {match.invoiceAmount ? `₹ ${match.invoiceAmount.toLocaleString()}` : '—'}
                    </td>

                    <td className="py-3.5 px-4 max-w-xs">
                      {match.bankTxn ? (
                        <div>
                          <div className="font-semibold text-slate-800 truncate" title={match.bankTxn.description}>
                            {match.bankTxn.description}
                          </div>
                          <div className="text-slate-400 text-[10px] font-mono">
                            Ref: {match.bankTxn.refNo} • {match.bankTxn.txnDate}
                          </div>
                        </div>
                      ) : (
                        <span className="text-rose-600 font-bold text-[11px]">Unrecorded in Statement</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-black text-emerald-700">
                      {match.bankTxn ? `₹ ${match.bankTxn.amount.toLocaleString()}` : '—'}
                    </td>

                    <td className="py-3.5 px-4 text-right font-black">
                      {match.discrepancyAmount > 0 ? (
                        <span className="text-amber-600">₹ {match.discrepancyAmount.toFixed(2)}</span>
                      ) : (
                        <span className="text-emerald-600">₹ 0.00</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {getDiscrepancyBadge(match.discrepancyType, match.status)}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${match.matchScore >= 80 ? 'bg-emerald-500' : match.matchScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            style={{ width: `${match.matchScore}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-black text-slate-700">{match.matchScore}%</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {match.status === 'RECONCILED' ? (
                        <span className="text-emerald-600 text-xs font-bold">✓ Reconciled</span>
                      ) : (
                        <button
                          onClick={() => handleOpenAdjustmentModal(match)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px]"
                        >
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjustment & Discrepancy Resolution Modal */}
      <AnimatePresence>
        {activeResolutionModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <DollarSign size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Post Reconciliation Adjustment</h3>
                    <p className="text-xs text-slate-400">Branch: {activeResolutionModal.branchName}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveResolutionModal(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Summary of Variance */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Invoice Number:</span>
                  <span className="font-bold text-slate-900">{activeResolutionModal.invoiceNumber || 'Bank Deposit'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Party / Counterparty:</span>
                  <span className="font-bold text-slate-900">{activeResolutionModal.partyName || activeResolutionModal.bankTxn?.partyName || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Invoice Book Value:</span>
                  <span className="font-bold text-slate-900">₹ {activeResolutionModal.invoiceAmount?.toLocaleString() || '0.00'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Bank Cleared Value:</span>
                  <span className="font-bold text-emerald-700">₹ {activeResolutionModal.bankTxn?.amount.toLocaleString() || '0.00'}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 text-amber-700 font-bold">
                  <span>Variance Amount:</span>
                  <span>₹ {activeResolutionModal.discrepancyAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Adjustment Note Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Adjustment Ledger & Accounting Note:
                </label>
                <textarea
                  rows={3}
                  value={adjustmentNote}
                  onChange={(e) => setAdjustmentNote(e.target.value)}
                  placeholder="Enter TDS Section (e.g. 194C / 194J), bank charge ledger code, or discount note..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveResolutionModal(null)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAdjustment}
                  className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>Confirm & Reconcile</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BranchReconciliationTool;
