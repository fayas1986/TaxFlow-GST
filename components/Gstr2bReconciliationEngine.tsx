import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, RefreshCw, Filter, Download,
  Send, Layers, FileSpreadsheet, Upload, Sliders, Check, Info, AlertCircle,
  Copy, Eye, FileText, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight,
  ArrowRight, ShieldCheck, ShieldAlert, Landmark, Building2, Calendar,
  SlidersHorizontal, ExternalLink, FileDown, Receipt, Mail, MessageSquare,
  HelpCircle, X, ArrowUpRight, Lock, Scale, AlertOctagon, Sparkles, CheckCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GSTR2BMatchingService,
  GSTR2BMatchingConfig,
  DEFAULT_GSTR2B_MATCHING_CONFIG,
  GSTR2BMatchResultItem,
  GSTR2BMatchingSummary,
  GSTR2BPortalRecord,
  InternalLedgerEntry,
  GSTR2BMatchStatus
} from '../services/gstEngine/gstr2bMatchingService';
import { exportToCSV } from '../utils/export';
import { sendReconciliationMismatchWhatsAppAlert } from '../services/api';
import ReconciliationAssistant from './ReconciliationAssistant';

export interface Gstr2bReconciliationEngineProps {
  tenantId?: string;
  initialPeriod?: string;
  onNavigateToReturns?: () => void;
}

export const Gstr2bReconciliationEngine: React.FC<Gstr2bReconciliationEngineProps> = ({
  tenantId = 't1',
  initialPeriod = 'August 2026',
  onNavigateToReturns
}) => {
  // --- Core State ---
  const [selectedPeriod, setSelectedPeriod] = useState<string>(initialPeriod);
  const [internalLedger, setInternalLedger] = useState<InternalLedgerEntry[]>([]);
  const [gstr2bRecords, setGstr2bRecords] = useState<GSTR2BPortalRecord[]>([]);
  const [reconResults, setReconResults] = useState<GSTR2BMatchResultItem[]>([]);
  const [reconSummary, setReconSummary] = useState<GSTR2BMatchingSummary | null>(null);
  const [showAssistantModal, setShowAssistantModal] = useState<boolean>(false);

  // Engine execution state
  const [isReconciling, setIsReconciling] = useState<boolean>(false);
  const [reconProgress, setReconProgress] = useState<number>(100);
  const [isSyncingGstn, setIsSyncingGstn] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Configuration Drawer State
  const [config, setConfig] = useState<GSTR2BMatchingConfig>(DEFAULT_GSTR2B_MATCHING_CONFIG);
  const [showConfigDrawer, setShowConfigDrawer] = useState<boolean>(false);

  // Filter & Search State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState<string>('ALL');
  const [onlyHighRisk, setOnlyHighRisk] = useState<boolean>(false);
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [jumpPageInput, setJumpPageInput] = useState<string>('');

  // Modals & Action States
  const [inspectingItem, setInspectingItem] = useState<GSTR2BMatchResultItem | null>(null);
  const [noticeItem, setNoticeItem] = useState<GSTR2BMatchResultItem | null>(null);
  const [noticeSentIds, setNoticeSentIds] = useState<Set<string>>(new Set());
  const [paymentHeldIds, setPaymentHeldIds] = useState<Set<string>>(new Set());
  const [acceptedOverrides, setAcceptedOverrides] = useState<Map<string, string>>(new Map());
  const [deferredIds, setDeferredIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [overrideRemark, setOverrideRemark] = useState<string>('');

  // Ingestion Modal State
  const [uploadModalOpen, setUploadModalOpen] = useState<'LEDGER' | '2B' | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isProcessingUpload, setIsProcessingUpload] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Load Initial Benchmark Data for Period ---
  useEffect(() => {
    const dataset = GSTR2BMatchingService.generatePeriodDataset(selectedPeriod);
    setInternalLedger(dataset.ledgerEntries);
    setGstr2bRecords(dataset.gstr2bRecords);

    // Initial run
    const outcome = GSTR2BMatchingService.reconcileLedgerWith2B(
      dataset.ledgerEntries,
      dataset.gstr2bRecords,
      config
    );
    setReconResults(outcome.results);
    setReconSummary(outcome.summary);
  }, [selectedPeriod]);

  // --- Execute Reconciliation with Live Animation ---
  const runReconciliation = (
    customLedger = internalLedger,
    custom2b = gstr2bRecords,
    customConfig = config
  ) => {
    setIsReconciling(true);
    setReconProgress(15);

    setTimeout(() => {
      setReconProgress(60);
      setTimeout(() => {
        const outcome = GSTR2BMatchingService.reconcileLedgerWith2B(
          customLedger,
          custom2b,
          customConfig
        );
        setReconResults(outcome.results);
        setReconSummary(outcome.summary);
        setReconProgress(100);
        setIsReconciling(false);
      }, 250);
    }, 200);
  };

  // Re-run whenever config changes
  const handleApplyConfig = () => {
    runReconciliation(internalLedger, gstr2bRecords, config);
    setShowConfigDrawer(false);
    setSyncFeedback('Matching rules updated and reconciliation recomputed.');
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  // GSTN Live Sync Simulation
  const handleSyncGstn = () => {
    setIsSyncingGstn(true);
    setTimeout(() => {
      setIsSyncingGstn(false);
      setSyncFeedback(
        `Direct GSP Sync Successful: Pulled latest statutory GSTR-2B records for ${selectedPeriod} from GSTN Portal.`
      );
      setTimeout(() => setSyncFeedback(null), 5000);
      runReconciliation();
    }, 1200);
  };

  // Load Benchmark Dataset
  const handleResetBenchmark = () => {
    const dataset = GSTR2BMatchingService.generatePeriodDataset(selectedPeriod);
    setInternalLedger(dataset.ledgerEntries);
    setGstr2bRecords(dataset.gstr2bRecords);
    runReconciliation(dataset.ledgerEntries, dataset.gstr2bRecords, config);
    setSyncFeedback(`Default statutory benchmark dataset loaded for ${selectedPeriod}.`);
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  // --- Unique Ledger Accounts for Filtering ---
  const availableLedgerAccounts = useMemo(() => {
    const set = new Set<string>();
    internalLedger.forEach(l => {
      if (l.ledgerAccount) set.add(l.ledgerAccount);
    });
    return Array.from(set);
  }, [internalLedger]);

  // --- Filtered and Processed Results ---
  const filteredResults = useMemo(() => {
    return reconResults.filter(item => {
      // 1. Status Filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'DISCREPANCIES') {
          if (item.status === 'EXACT_MATCH') return false;
        } else if (item.status !== statusFilter) {
          return false;
        }
      }

      // 2. High Risk Toggle
      if (onlyHighRisk) {
        if (
          item.status !== 'MISSING_IN_GSTR2B' &&
          item.status !== 'AMOUNT_MISMATCH' &&
          item.status !== 'SECTION_17_5_BLOCKED'
        ) {
          return false;
        }
      }

      // 3. Ledger Account Filter
      if (selectedLedgerAccount !== 'ALL') {
        if (item.purchaseRecord?.ledgerAccount !== selectedLedgerAccount) {
          return false;
        }
      }

      // 4. Amount Range Filter
      const itemTax = item.purchaseRecord?.taxAmount ?? item.gstr2bRecord?.totalTax ?? 0;
      if (minAmount && itemTax < parseFloat(minAmount)) return false;
      if (maxAmount && itemTax > parseFloat(maxAmount)) return false;

      // 5. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const party = (
          item.purchaseRecord?.partyName ||
          item.gstr2bRecord?.supplierName ||
          ''
        ).toLowerCase();
        const gstin = (
          item.purchaseRecord?.gstin ||
          item.gstr2bRecord?.gstin ||
          ''
        ).toLowerCase();
        const invNo = (
          item.purchaseRecord?.invoiceNumber ||
          item.gstr2bRecord?.invoiceNumber ||
          ''
        ).toLowerCase();
        const voucher = (item.purchaseRecord?.voucherNumber || '').toLowerCase();
        if (
          !party.includes(q) &&
          !gstin.includes(q) &&
          !invNo.includes(q) &&
          !voucher.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    reconResults,
    statusFilter,
    onlyHighRisk,
    selectedLedgerAccount,
    minAmount,
    maxAmount,
    searchQuery
  ]);

  // --- Pagination Math ---
  const totalItems = filteredResults.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedResults = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * pageSize;
    return filteredResults.slice(startIdx, startIdx + pageSize);
  }, [filteredResults, safeCurrentPage, pageSize]);

  const startRecord = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endRecord = Math.min(safeCurrentPage * pageSize, totalItems);

  // --- Actions Handlers ---
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleToggleHoldPayment = (id: string) => {
    setPaymentHeldIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleDeferItc = (id: string) => {
    setDeferredIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAcceptOverride = (id: string, remark: string) => {
    setAcceptedOverrides(prev => {
      const next = new Map(prev);
      next.set(id, remark || 'CA / Auditor manual tolerance acceptance');
      return next;
    });
    setOverrideRemark('');
    setInspectingItem(null);
    setSyncFeedback('Manual audit override approved and recorded with audit remark.');
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  const handleSendSupplierNotice = async (item: GSTR2BMatchResultItem) => {
    setNoticeSentIds(prev => new Set(prev).add(item.id));
    setNoticeItem(null);
    const partyName = item.purchaseRecord?.partyName || item.gstr2bRecord?.supplierName || 'Valued Supplier';
    const gstin = item.purchaseRecord?.gstin || item.gstr2bRecord?.gstin || '27AABCU9603R1ZM';
    const invNo = item.purchaseRecord?.invoiceNumber || item.gstr2bRecord?.invoiceNumber || 'INV-REF';

    try {
      await sendReconciliationMismatchWhatsAppAlert({
        recipientPhone: '+919876543210',
        recipientName: partyName,
        recipientGstin: gstin,
        period: selectedPeriod,
        mismatchCount: 1,
        taxImpact: item.taxDifference || 0,
        invoiceNumber: invNo,
        vendorName: partyName,
        topReason: (item.discrepancies && item.discrepancies.length > 0) ? item.discrepancies.join(', ') : (item.discrepancyCategory || `Mismatch on invoice ${invNo}`)
      });
      setSyncFeedback(
        `Statutory WhatsApp notice transmitted to ${partyName} via Twilio Gateway.`
      );
    } catch (err: any) {
      setSyncFeedback(
        `Notice recorded for ${partyName} (WhatsApp dispatch queued).`
      );
    }
    setTimeout(() => setSyncFeedback(null), 4500);
  };

  const handleBulkSendNotices = () => {
    const unfiledOrMismatch = reconResults.filter(
      r => r.status === 'MISSING_IN_GSTR2B' || r.status === 'AMOUNT_MISMATCH'
    );
    setNoticeSentIds(prev => {
      const next = new Set(prev);
      unfiledOrMismatch.forEach(item => next.add(item.id));
      return next;
    });
    setSyncFeedback(`Bulk compliance notices dispatched to ${unfiledOrMismatch.length} suppliers.`);
    setTimeout(() => setSyncFeedback(null), 4500);
  };

  const handleBulkAutoResolveRounding = () => {
    let resolvedCount = 0;
    const newOverrides = new Map(acceptedOverrides);
    reconResults.forEach(item => {
      if (item.status === 'AMOUNT_MISMATCH' && item.taxDifference <= config.taxAmountTolerance!) {
        newOverrides.set(item.id, `Auto-resolved: Variance ₹${item.taxDifference.toFixed(2)} is within ₹${config.taxAmountTolerance} statutory threshold`);
        resolvedCount++;
      }
    });
    setAcceptedOverrides(newOverrides);
    setSyncFeedback(`Bulk Auto-Resolve applied: ${resolvedCount} rounding discrepancies approved within statutory tolerance.`);
    setTimeout(() => setSyncFeedback(null), 4500);
  };

  // --- Export Suite ---
  const handleExportCSV = () => {
    const data = filteredResults.map((item, idx) => ({
      'S.No': idx + 1,
      'Internal Voucher': item.purchaseRecord?.voucherNumber || 'N/A',
      'Books Invoice No': item.purchaseRecord?.invoiceNumber || 'N/A',
      'Books Invoice Date': item.purchaseRecord?.date || 'N/A',
      'Supplier Name': item.purchaseRecord?.partyName || item.gstr2bRecord?.supplierName || 'N/A',
      'Supplier GSTIN': item.purchaseRecord?.gstin || item.gstr2bRecord?.gstin || 'N/A',
      'Ledger Account': item.purchaseRecord?.ledgerAccount || 'General Purchase',
      'Books Taxable (INR)': item.purchaseRecord?.taxableValue ?? 0,
      'Books CGST (INR)': item.purchaseRecord?.cgst ?? 0,
      'Books SGST (INR)': item.purchaseRecord?.sgst ?? 0,
      'Books IGST (INR)': item.purchaseRecord?.igst ?? 0,
      'Books Total Tax (INR)': item.purchaseRecord?.taxAmount ?? 0,
      '2B Invoice No': item.gstr2bRecord?.invoiceNumber || 'MISSING IN 2B',
      '2B Invoice Date': item.gstr2bRecord?.invoiceDate || 'N/A',
      '2B Taxable (INR)': item.gstr2bRecord?.taxableValue ?? 0,
      '2B CGST (INR)': item.gstr2bRecord?.cgst ?? 0,
      '2B SGST (INR)': item.gstr2bRecord?.sgst ?? 0,
      '2B IGST (INR)': item.gstr2bRecord?.igst ?? 0,
      '2B Total Tax (INR)': item.gstr2bRecord?.totalTax ?? 0,
      'Tax Variance (INR)': item.taxDifference ?? 0,
      'Recon Status': item.status,
      'Discrepancy Category': item.discrepancyCategory,
      'Statutory Clause': item.statutoryClause,
      'Payment Status': paymentHeldIds.has(item.id) ? 'PAYMENT HELD' : item.purchaseRecord?.paymentStatus || 'PAID',
      'Audit Override': acceptedOverrides.get(item.id) || 'PENDING'
    }));

    exportToCSV(data, `GSTR2B_vs_InternalLedger_Reconciliation_${selectedPeriod.replace(/\s+/g, '_')}`);
  };

  const handleExportXLSX = () => {
    const wsData = [
      ['TAXFLOW COMPLIANCE SAAS - GSTR-2B VS INTERNAL LEDGER RECONCILIATION STATEMENT'],
      [`Tax Period: ${selectedPeriod}`, `Report Generated: ${new Date().toLocaleString()}`, `Tenant ID: ${tenantId}`],
      [],
      [
        'S.No',
        'Voucher No',
        'Ledger Invoice No',
        'Invoice Date',
        'Supplier Name',
        'Supplier GSTIN',
        'Ledger Account',
        'Books Taxable',
        'Books Tax Amount',
        '2B Invoice No',
        '2B Filing Date',
        '2B Tax Amount',
        'Tax Variance',
        'Reconciliation Status',
        'Statutory Clause',
        'Action State'
      ],
      ...filteredResults.map((item, idx) => [
        idx + 1,
        item.purchaseRecord?.voucherNumber || 'N/A',
        item.purchaseRecord?.invoiceNumber || 'MISSING',
        item.purchaseRecord?.date || 'N/A',
        item.purchaseRecord?.partyName || item.gstr2bRecord?.supplierName || 'N/A',
        item.purchaseRecord?.gstin || item.gstr2bRecord?.gstin || 'N/A',
        item.purchaseRecord?.ledgerAccount || 'General',
        item.purchaseRecord?.taxableValue ?? 0,
        item.purchaseRecord?.taxAmount ?? 0,
        item.gstr2bRecord?.invoiceNumber || 'MISSING IN 2B',
        item.gstr2bRecord?.gstr1FilingDate || 'N/A',
        item.gstr2bRecord?.totalTax ?? 0,
        item.taxDifference ?? 0,
        item.status,
        item.statutoryClause,
        acceptedOverrides.has(item.id)
          ? 'AUDIT OVERRIDE'
          : paymentHeldIds.has(item.id)
          ? 'PAYMENT HELD'
          : deferredIds.has(item.id)
          ? 'ITC DEFERRED'
          : 'ACTIVE'
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'GSTR-2B Reconciliation');
    XLSX.writeFile(wb, `GSTR2B_Ledger_Reconciliation_${selectedPeriod.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape', 'pt', 'a4');

    // Header
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 65, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('GSTR-2B vs INTERNAL LEDGER RECONCILIATION STATEMENT', 40, 32);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Period: ${selectedPeriod}  |  Generated on: ${new Date().toLocaleDateString('en-IN')}  |  Tenant: ${tenantId}`,
      40,
      48
    );

    // Summary Box
    doc.setFillColor(248, 250, 252);
    doc.rect(40, 80, doc.internal.pageSize.getWidth() - 80, 50, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(40, 80, doc.internal.pageSize.getWidth() - 80, 50, 'S');

    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Total Books Tax: Rs. ${reconSummary?.totalBooksTaxAmount.toLocaleString() || '0'}`,
      55,
      102
    );
    doc.text(
      `GSTR-2B Eligible Tax: Rs. ${reconSummary?.totalGstr2bTaxAmount.toLocaleString() || '0'}`,
      230,
      102
    );
    doc.text(
      `Claimable ITC: Rs. ${reconSummary?.claimableItcAmount.toLocaleString() || '0'}`,
      420,
      102
    );
    doc.text(
      `At-Risk ITC: Rs. ${reconSummary?.atRiskItcAmount.toLocaleString() || '0'}`,
      580,
      102
    );
    doc.text(
      `Match Rate: ${reconSummary?.reconciliationMatchRate || 0}%`,
      720,
      102
    );

    // Table
    const tableData = filteredResults.map((item, idx) => [
      idx + 1,
      item.purchaseRecord?.invoiceNumber || item.gstr2bRecord?.invoiceNumber || '-',
      (item.purchaseRecord?.partyName || item.gstr2bRecord?.supplierName || '-').substring(0, 24),
      item.purchaseRecord?.gstin || item.gstr2bRecord?.gstin || '-',
      item.purchaseRecord?.taxAmount ? `Rs. ${item.purchaseRecord.taxAmount.toLocaleString()}` : '-',
      item.gstr2bRecord?.totalTax ? `Rs. ${item.gstr2bRecord.totalTax.toLocaleString()}` : 'UNFILED',
      item.taxDifference ? `Rs. ${item.taxDifference.toLocaleString()}` : '-',
      item.status.replace(/_/g, ' '),
      acceptedOverrides.has(item.id)
        ? 'OVERRIDE'
        : paymentHeldIds.has(item.id)
        ? 'PAYMENT HELD'
        : 'ACTIVE'
    ]);

    autoTable(doc, {
      startY: 145,
      head: [
        [
          '#',
          'Invoice No',
          'Supplier Name',
          'GSTIN',
          'Books Tax',
          '2B Tax',
          'Variance',
          'Recon Status',
          'Review State'
        ]
      ],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 4
      },
      margin: { left: 40, right: 40 }
    });

    doc.save(`GSTR2B_Reconciliation_Certificate_${selectedPeriod.replace(/\s+/g, '_')}.pdf`);
  };

  // Helper for status badge styling
  const getStatusBadge = (status: GSTR2BMatchStatus, item: GSTR2BMatchResultItem) => {
    if (acceptedOverrides.has(item.id)) {
      return {
        bg: 'bg-indigo-50 border-indigo-200 text-indigo-800',
        label: 'CA OVERRIDE (ACCEPTED)',
        icon: ShieldCheck
      };
    }
    switch (status) {
      case 'EXACT_MATCH':
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
          label: '5-WAY EXACT MATCH',
          icon: CheckCircle2
        };
      case 'AMOUNT_MISMATCH':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-800',
          label: 'AMOUNT VARIANCE',
          icon: AlertTriangle
        };
      case 'TAX_HEAD_MISMATCH':
        return {
          bg: 'bg-purple-50 border-purple-200 text-purple-800',
          label: 'TAX HEAD MISMATCH',
          icon: AlertCircle
        };
      case 'DATE_MISMATCH':
        return {
          bg: 'bg-blue-50 border-blue-200 text-blue-800',
          label: 'FILING DELAY / DATE',
          icon: Calendar
        };
      case 'MISSING_IN_GSTR2B':
        return {
          bg: 'bg-rose-50 border-rose-200 text-rose-800',
          label: 'MISSING IN 2B (AT RISK)',
          icon: XCircle
        };
      case 'MISSING_IN_BOOKS':
        return {
          bg: 'bg-teal-50 border-teal-200 text-teal-800',
          label: 'MISSING IN BOOKS (UNRECORDED)',
          icon: Info
        };
      case 'SECTION_17_5_BLOCKED':
        return {
          bg: 'bg-orange-50 border-orange-200 text-orange-800',
          label: 'SEC 17(5) BLOCKED',
          icon: AlertOctagon
        };
      default:
        return {
          bg: 'bg-slate-50 border-slate-200 text-slate-700',
          label: status,
          icon: Info
        };
    }
  };

  return (
    <div id="gstr2b-reconciliation-engine-root" className="space-y-6">
      {/* --- TOP CONTROL BAR & PERIOD SELECTOR --- */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                Rule 60(7) & Section 16(2)(aa) Engine
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Automated GSTR-2B vs Internal Ledger Reconciliation
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5 mt-1">
              Automated GSTR-2B Reconciliation Engine
              {isReconciling && <RefreshCw size={18} className="animate-spin text-indigo-600" />}
            </h1>
            <p className="text-slate-500 text-xs md:text-sm mt-0.5 max-w-2xl">
              Cross-reconciles internal ERP purchase voucher accounts with government-reported GSTR-2B
              inward supply data, isolating ITC discrepancies and unfiled supplier liabilities.
            </p>
          </div>

          {/* Action Buttons & Period Dropdown */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Period Picker */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
              <Calendar size={15} className="text-indigo-600" />
              <select
                id="select-tax-period"
                value={selectedPeriod}
                onChange={e => setSelectedPeriod(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer pr-2"
              >
                <option value="August 2026">August 2026</option>
                <option value="July 2026">July 2026</option>
                <option value="June 2026">June 2026</option>
                <option value="May 2026">May 2026</option>
                <option value="FY 2026-27 (Q1)">FY 2026-27 (Q1)</option>
              </select>
            </div>

            {/* Sync with GSTN */}
            <button
              id="btn-sync-gstn"
              onClick={handleSyncGstn}
              disabled={isSyncingGstn}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all disabled:opacity-50"
              title="Pull latest GSTR-2B statement from GSTN GSP Gateway"
            >
              <RefreshCw size={14} className={isSyncingGstn ? 'animate-spin text-indigo-600' : ''} />
              {isSyncingGstn ? 'Syncing...' : 'Sync GSTN GSP'}
            </button>

            {/* Configure Rules */}
            <button
              id="btn-config-rules"
              onClick={() => setShowConfigDrawer(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all"
            >
              <SlidersHorizontal size={14} className="text-slate-600" />
              Rules & Tolerances
            </button>

            {/* Reconciliation Assistant Wizard */}
            <button
              id="btn-launch-recon-assistant"
              onClick={() => setShowAssistantModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-100 transition-all cursor-pointer"
              title="Launch step-by-step guided Reconciliation Assistant"
            >
              <Sparkles size={14} />
              Reconciliation Assistant
            </button>

            {/* Run Reconcile Engine */}
            <button
              id="btn-run-auto-reconcile"
              onClick={() => runReconciliation()}
              disabled={isReconciling}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-100 transition-all active:scale-98"
            >
              <RefreshCw size={14} className={isReconciling ? 'animate-spin' : ''} />
              {isReconciling ? `Matching (${reconProgress}%)...` : 'Re-Run Engine'}
            </button>
          </div>
        </div>

        {/* Live Notification Banner */}
        {syncFeedback && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{syncFeedback}</span>
            </div>
            <button onClick={() => setSyncFeedback(null)} className="text-emerald-700 hover:text-emerald-900">
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* --- EXECUTIVE KPI CARDS --- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Books Total Tax */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Books Ledger Tax</span>
          <div className="text-lg font-black text-slate-900 font-mono">
            ₹{(reconSummary?.totalBooksTaxAmount || 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-500 block">
            {reconSummary?.totalPurchaseInvoices || 0} Purchase Vouchers
          </span>
        </div>

        {/* GSTR-2B Tax */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">GSTR-2B Statement</span>
          <div className="text-lg font-black text-indigo-700 font-mono">
            ₹{(reconSummary?.totalGstr2bTaxAmount || 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-500 block">
            {reconSummary?.totalGstr2bInvoices || 0} Auto-populated
          </span>
        </div>

        {/* Claimable ITC (Sec 16 Compliant) */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Claimable ITC (Table 4A)</span>
          <div className="text-lg font-black text-emerald-700 font-mono">
            ₹{(reconSummary?.claimableItcAmount || 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-emerald-600 block">
            {reconSummary?.exactMatchesCount || 0} Reconciled Vouchers
          </span>
        </div>

        {/* At-Risk ITC (Missing in 2B) */}
        <div className="bg-white p-4 rounded-2xl border border-rose-200/80 bg-rose-50/20 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">ITC At Risk u/s 16(2)(aa)</span>
          <div className="text-lg font-black text-rose-600 font-mono">
            ₹{(reconSummary?.atRiskItcAmount || 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-rose-600 block">
            {reconSummary?.missingInGstr2bCount || 0} Unfiled by Vendor
          </span>
        </div>

        {/* Missing in Books (Unrecorded) */}
        <div className="bg-white p-4 rounded-2xl border border-teal-200/80 bg-teal-50/20 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Missing in Books</span>
          <div className="text-lg font-black text-teal-700 font-mono">
            {reconSummary?.missingInBooksCount || 0} Invoices
          </div>
          <span className="text-[11px] text-teal-600 block">Unclaimed Tax Credit</span>
        </div>

        {/* Match Rate Progress */}
        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Recon Rate</span>
            <span className="text-sm font-black text-emerald-400 font-mono">{reconSummary?.reconciliationMatchRate || 0}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${reconSummary?.reconciliationMatchRate || 0}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 block truncate">
            {reconSummary?.exactMatchesCount || 0} matched of {(reconSummary?.totalPurchaseInvoices || 0) + (reconSummary?.missingInBooksCount || 0)}
          </span>
        </div>
      </div>

      {/* --- FILTER & SEARCH BAR --- */}
      <div className="bg-white p-4 rounded-2xl shadow-2xs border border-slate-200 space-y-3">
        {/* Top Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Records ({reconResults.length})
          </button>
          <button
            onClick={() => setStatusFilter('EXACT_MATCH')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              statusFilter === 'EXACT_MATCH'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            Exact Matches ({reconResults.filter(r => r.status === 'EXACT_MATCH').length})
          </button>
          <button
            onClick={() => setStatusFilter('DISCREPANCIES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              statusFilter === 'DISCREPANCIES'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
          >
            All Discrepancies ({reconResults.filter(r => r.status !== 'EXACT_MATCH').length})
          </button>
          <button
            onClick={() => setStatusFilter('MISSING_IN_GSTR2B')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              statusFilter === 'MISSING_IN_GSTR2B'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-rose-50 text-rose-900 hover:bg-rose-100'
            }`}
          >
            Missing in 2B ({reconResults.filter(r => r.status === 'MISSING_IN_GSTR2B').length})
          </button>
          <button
            onClick={() => setStatusFilter('AMOUNT_MISMATCH')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              statusFilter === 'AMOUNT_MISMATCH'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            Amount Variance ({reconResults.filter(r => r.status === 'AMOUNT_MISMATCH').length})
          </button>
          <button
            onClick={() => setStatusFilter('TAX_HEAD_MISMATCH')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              statusFilter === 'TAX_HEAD_MISMATCH'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
            }`}
          >
            Tax Head (POS) ({reconResults.filter(r => r.status === 'TAX_HEAD_MISMATCH').length})
          </button>
          <button
            onClick={() => setStatusFilter('MISSING_IN_BOOKS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              statusFilter === 'MISSING_IN_BOOKS'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
            }`}
          >
            Missing in Books ({reconResults.filter(r => r.status === 'MISSING_IN_BOOKS').length})
          </button>
          <button
            onClick={() => setStatusFilter('SECTION_17_5_BLOCKED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              statusFilter === 'SECTION_17_5_BLOCKED'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-orange-50 text-orange-800 hover:bg-orange-100'
            }`}
          >
            Sec 17(5) Blocked ({reconResults.filter(r => r.status === 'SECTION_17_5_BLOCKED').length})
          </button>
        </div>

        {/* Search, Secondary Filters & Export Suite */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <input
                id="input-recon-search"
                type="text"
                placeholder="Search vendor, invoice no, GSTIN, voucher..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <Filter size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Ledger Account Filter */}
            <select
              id="select-ledger-account"
              value={selectedLedgerAccount}
              onChange={e => setSelectedLedgerAccount(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none"
            >
              <option value="ALL">All Ledger Accounts</option>
              {availableLedgerAccounts.map(acc => (
                <option key={acc} value={acc}>{acc}</option>
              ))}
            </select>

            {/* High Risk Toggle */}
            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyHighRisk}
                onChange={e => setOnlyHighRisk(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>High-Risk Only</span>
            </label>
          </div>

          {/* Bulk & Export Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-bulk-resolve-rounding"
              onClick={handleBulkAutoResolveRounding}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 transition-colors"
              title={`Auto-approve discrepancies below ₹${config.taxAmountTolerance} threshold`}
            >
              Bulk Auto-Resolve (≤ ₹{config.taxAmountTolerance})
            </button>

            <button
              id="btn-bulk-notices"
              onClick={handleBulkSendNotices}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold rounded-xl border border-indigo-200 transition-colors flex items-center gap-1.5"
              title="Send compliance demand notices to all unfiled suppliers"
            >
              <Mail size={13} />
              Dispatch Supplier Notices
            </button>

            {/* Export Dropdown / Buttons */}
            <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
              <button
                id="btn-export-xlsx"
                onClick={handleExportXLSX}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                title="Export Excel Worksheet (.xlsx)"
              >
                <FileSpreadsheet size={15} />
              </button>
              <button
                id="btn-export-csv"
                onClick={handleExportCSV}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                title="Export CSV (.csv)"
              >
                <FileDown size={15} />
              </button>
              <button
                id="btn-export-pdf"
                onClick={handleExportPDF}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-indigo-700 rounded-xl transition-colors"
                title="Export Statutory Audit PDF Certificate"
              >
                <FileText size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- MAIN RECONCILIATION TABLE --- */}
      <div className="bg-white rounded-2xl shadow-2xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10.5px]">
              <tr>
                <th className="px-4 py-3.5">Internal Books (Voucher & Inv)</th>
                <th className="px-4 py-3.5">Supplier & GSTIN</th>
                <th className="px-4 py-3.5">Ledger Account</th>
                <th className="px-4 py-3.5 text-right">Books Tax</th>
                <th className="px-4 py-3.5 text-right">GSTR-2B Tax</th>
                <th className="px-4 py-3.5 text-right">Tax Variance</th>
                <th className="px-4 py-3.5 text-center">5-Way Checks</th>
                <th className="px-4 py-3.5">Recon Status</th>
                <th className="px-4 py-3.5 text-right">Review Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {paginatedResults.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 bg-slate-50/40">
                    <AlertCircle size={28} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-600">No reconciliation records match current criteria.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try resetting filters or changing period.</p>
                  </td>
                </tr>
              ) : (
                paginatedResults.map(item => {
                  const badge = getStatusBadge(item.status, item);
                  const isOverridden = acceptedOverrides.has(item.id);
                  const isHeld = paymentHeldIds.has(item.id);
                  const isNoticeSent = noticeSentIds.has(item.id);
                  const isDeferred = deferredIds.has(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        item.status === 'MISSING_IN_GSTR2B'
                          ? 'bg-rose-50/20'
                          : item.status === 'AMOUNT_MISMATCH'
                          ? 'bg-amber-50/20'
                          : ''
                      }`}
                    >
                      {/* Books Inv Details */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 font-mono">
                          {item.purchaseRecord?.invoiceNumber || (
                            <span className="text-rose-600 font-sans font-bold">MISSING IN BOOKS</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                          <span>{item.purchaseRecord?.date || 'N/A'}</span>
                          {item.purchaseRecord?.voucherNumber && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-indigo-600 font-semibold">
                                {item.purchaseRecord.voucherNumber}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Supplier & GSTIN */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900 truncate max-w-[180px]" title={item.purchaseRecord?.partyName || item.gstr2bRecord?.supplierName}>
                          {item.purchaseRecord?.partyName || item.gstr2bRecord?.supplierName || 'N/A'}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <code className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1 py-0.2 rounded">
                            {item.purchaseRecord?.gstin || item.gstr2bRecord?.gstin || 'N/A'}
                          </code>
                          <button
                            onClick={() => handleCopy(item.purchaseRecord?.gstin || item.gstr2bRecord?.gstin || '', `gstin-${item.id}`)}
                            className="text-slate-400 hover:text-slate-700 p-0.5"
                            title="Copy GSTIN"
                          >
                            {copiedId === `gstin-${item.id}` ? (
                              <Check size={11} className="text-emerald-600" />
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Ledger Account */}
                      <td className="px-4 py-3.5">
                        <span className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                          {item.purchaseRecord?.ledgerAccount || 'General Account'}
                        </span>
                      </td>

                      {/* Books Tax */}
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-800">
                        {item.purchaseRecord ? `₹${item.purchaseRecord.taxAmount.toLocaleString()}` : '-'}
                      </td>

                      {/* 2B Tax */}
                      <td className="px-4 py-3.5 text-right font-mono font-bold">
                        {item.gstr2bRecord ? (
                          <span className="text-indigo-700">₹{item.gstr2bRecord.totalTax.toLocaleString()}</span>
                        ) : (
                          <span className="text-rose-600 font-sans font-bold text-[11px]">UNFILED</span>
                        )}
                      </td>

                      {/* Variance */}
                      <td className="px-4 py-3.5 text-right font-mono font-bold">
                        {item.taxDifference > 0 ? (
                          <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            ₹{item.taxDifference.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-emerald-700">₹0</span>
                        )}
                      </td>

                      {/* 5-Way Match Mini Pills */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              item.fiveWayMatch?.gstinMatched ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                            title={`GSTIN: ${item.fiveWayMatch?.gstinMatched ? 'Matched' : 'Mismatch'}`}
                          />
                          <span
                            className={`w-2 h-2 rounded-full ${
                              item.fiveWayMatch?.invoiceNoMatched === 'EXACT'
                                ? 'bg-emerald-500'
                                : item.fiveWayMatch?.invoiceNoMatched === 'FUZZY'
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            title={`Inv No: ${item.fiveWayMatch?.invoiceNoMatched}`}
                          />
                          <span
                            className={`w-2 h-2 rounded-full ${
                              item.fiveWayMatch?.dateMatched === 'EXACT'
                                ? 'bg-emerald-500'
                                : item.fiveWayMatch?.dateMatched === 'TOLERANCE'
                                ? 'bg-blue-500'
                                : 'bg-rose-500'
                            }`}
                            title={`Date: ${item.fiveWayMatch?.dateMatched}`}
                          />
                          <span
                            className={`w-2 h-2 rounded-full ${
                              item.fiveWayMatch?.taxAmountMatched === 'EXACT'
                                ? 'bg-emerald-500'
                                : item.fiveWayMatch?.taxAmountMatched === 'TOLERANCE'
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            title={`Tax: ${item.fiveWayMatch?.taxAmountMatched}`}
                          />
                        </div>
                      </td>

                      {/* Recon Status Badge */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${badge.bg}`}
                          >
                            <badge.icon size={11} />
                            {badge.label}
                          </span>
                          {isHeld && (
                            <span className="block text-[9px] font-bold text-rose-700 uppercase">
                              • Payment Frozen in ERP
                            </span>
                          )}
                          {isDeferred && (
                            <span className="block text-[9px] font-bold text-indigo-700 uppercase">
                              • ITC Deferred to Next Month
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Review Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`btn-inspect-${item.id}`}
                            onClick={() => setInspectingItem(item)}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold transition-colors"
                            title="Inspect Side-by-Side Discrepancy & Resolution"
                          >
                            Review
                          </button>

                          {item.status !== 'EXACT_MATCH' && !isOverridden && (
                            <button
                              id={`btn-notice-${item.id}`}
                              onClick={() => setNoticeItem(item)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isNoticeSent
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'hover:bg-slate-100 text-slate-600'
                              }`}
                              title={isNoticeSent ? 'Notice Already Sent' : 'Generate & Send Vendor Notice'}
                            >
                              <Send size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* --- PAGINATION CONTROLS --- */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500 font-medium">
            <span>
              Showing <strong className="text-slate-900 font-mono font-bold">{startRecord}</strong> to{' '}
              <strong className="text-slate-900 font-mono font-bold">{endRecord}</strong> of{' '}
              <strong className="text-slate-900 font-mono font-bold">{totalItems}</strong> entries
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage <= 1}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronsLeft size={15} />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={safeCurrentPage <= 1}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={15} />
            </button>

            <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-800 shadow-2xs">
              {safeCurrentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={15} />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage >= totalPages}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronsRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* --- SIDEBAR CONFIGURATION DRAWER --- */}
      <AnimatePresence>
        {showConfigDrawer && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-2xs flex justify-end">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white w-full max-w-md h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <Sliders className="text-indigo-600" size={20} />
                    <h2 className="text-lg font-black text-slate-900">Reconciliation Rules</h2>
                  </div>
                  <button
                    onClick={() => setShowConfigDrawer(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Tax Amount Tolerance Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-slate-700">Tax Variance Tolerance (₹)</span>
                    <span className="font-mono font-bold text-indigo-700">₹{config.taxAmountTolerance}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="500"
                    step="5"
                    value={config.taxAmountTolerance ?? 10}
                    onChange={e => setConfig({ ...config, taxAmountTolerance: Number(e.target.value) })}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400">
                    Allows minor statutory rounding variances up to ₹{config.taxAmountTolerance} without flagging as hard error.
                  </p>
                </div>

                {/* Date Tolerance Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-slate-700">Date Discrepancy Tolerance (Days)</span>
                    <span className="font-mono font-bold text-indigo-700">{config.dateToleranceDays} Days</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="1"
                    value={config.dateToleranceDays ?? 7}
                    onChange={e => setConfig({ ...config, dateToleranceDays: Number(e.target.value) })}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400">
                    Tolerates supplier GSTR-1 delayed filing within {config.dateToleranceDays} calendar days.
                  </p>
                </div>

                {/* Taxable Value Tolerance */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-slate-700">Taxable Value Variance (₹)</span>
                    <span className="font-mono font-bold text-indigo-700">₹{config.taxableValueTolerance}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    step="25"
                    value={config.taxableValueTolerance ?? 100}
                    onChange={e => setConfig({ ...config, taxableValueTolerance: Number(e.target.value) })}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                {/* Toggle Rules */}
                <div className="space-y-3 pt-2 border-t border-slate-100 text-xs">
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                    <div>
                      <span className="font-bold text-slate-800 block">Fuzzy Invoice Number Matching</span>
                      <span className="text-[10px] text-slate-400">Normalizes prefixes, slashes, and leading zeros</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.fuzzyInvoiceMatching ?? true}
                      onChange={e => setConfig({ ...config, fuzzyInvoiceMatching: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                    <div>
                      <span className="font-bold text-slate-800 block">Enforce Strict GSTIN Matching</span>
                      <span className="text-[10px] text-slate-400">Only matches records with identical 15-digit GSTIN</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.enforceGstinStrictMatch ?? true}
                      onChange={e => setConfig({ ...config, enforceGstinStrictMatch: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                    <div>
                      <span className="font-bold text-slate-800 block">Auto-Tag Section 17(5) Blocked Credit</span>
                      <span className="text-[10px] text-slate-400">Automates ineligible credit tagging for motor vehicles & catering</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.autoTagSec17Blocked ?? true}
                      onChange={e => setConfig({ ...config, autoTagSec17Blocked: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                  </label>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  onClick={handleResetBenchmark}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  Reset Defaults
                </button>
                <button
                  id="btn-apply-config"
                  onClick={handleApplyConfig}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-98"
                >
                  Apply & Re-Reconcile
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- SIDE-BY-SIDE DISCREPANCY INSPECTION MODAL --- */}
      {inspectingItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 space-y-6 my-auto max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Statutory Discrepancy Inspection
                  </span>
                  <span className="text-xs text-slate-400">
                    Ref: {inspectingItem.id}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  {inspectingItem.purchaseRecord?.partyName || inspectingItem.gstr2bRecord?.supplierName || 'Supplier Discrepancy Review'}
                </h3>
              </div>
              <button
                onClick={() => setInspectingItem(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            {/* Side-by-Side Comparison Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Internal Ledger Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-900 border-b border-slate-200 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Building2 size={14} className="text-indigo-600" /> Internal Accounting Ledger
                  </span>
                  <span className="text-indigo-700 font-mono">{inspectingItem.purchaseRecord?.voucherNumber || 'No Voucher'}</span>
                </div>

                <div className="space-y-1.5 text-slate-600">
                  <div className="flex justify-between">
                    <span>Invoice Number:</span>
                    <strong className="text-slate-900 font-mono">{inspectingItem.purchaseRecord?.invoiceNumber || 'MISSING'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Invoice Date:</span>
                    <span className="text-slate-800">{inspectingItem.purchaseRecord?.date || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GSTIN:</span>
                    <code className="text-slate-800 font-mono">{inspectingItem.purchaseRecord?.gstin || 'N/A'}</code>
                  </div>
                  <div className="flex justify-between">
                    <span>Ledger Account:</span>
                    <span className="text-slate-800 font-medium">{inspectingItem.purchaseRecord?.ledgerAccount || 'General'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxable Amount:</span>
                    <span className="font-mono font-bold text-slate-900">₹{inspectingItem.purchaseRecord?.taxableValue.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200">
                    <span className="font-bold text-slate-900">Total Tax Booked:</span>
                    <span className="font-mono font-black text-slate-900">₹{inspectingItem.purchaseRecord?.taxAmount.toLocaleString() || 0}</span>
                  </div>
                </div>
              </div>

              {/* GSTR-2B Portal Card */}
              <div className="p-4 rounded-xl bg-indigo-50/40 border border-indigo-100 space-y-2.5 text-xs">
                <div className="flex items-center justify-between font-bold text-indigo-950 border-b border-indigo-200 pb-2">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-indigo-700" /> Government GSTR-2B
                  </span>
                  <span className="text-emerald-700 font-bold">
                    {inspectingItem.gstr2bRecord ? 'AUTO-POPULATED' : 'NOT REPORTED'}
                  </span>
                </div>

                <div className="space-y-1.5 text-slate-600">
                  <div className="flex justify-between">
                    <span>2B Invoice Number:</span>
                    <strong className="text-slate-900 font-mono">{inspectingItem.gstr2bRecord?.invoiceNumber || 'UNFILED'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>2B Invoice Date:</span>
                    <span className="text-slate-800">{inspectingItem.gstr2bRecord?.invoiceDate || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GSTR-1 Filing Date:</span>
                    <span className="text-slate-800">{inspectingItem.gstr2bRecord?.gstr1FilingDate || 'NOT FILED'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Place of Supply:</span>
                    <span className="text-slate-800">{inspectingItem.gstr2bRecord?.placeOfSupply || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>2B Taxable Amount:</span>
                    <span className="font-mono font-bold text-slate-900">₹{inspectingItem.gstr2bRecord?.taxableValue.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-indigo-200">
                    <span className="font-bold text-indigo-950">GSTR-2B Tax Credit:</span>
                    <span className="font-mono font-black text-indigo-700">₹{inspectingItem.gstr2bRecord?.totalTax.toLocaleString() || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Discrepancy & Statutory Remedy Box */}
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertTriangle size={15} />
                <span>Statutory Rule: {inspectingItem.statutoryClause}</span>
              </div>
              <p className="leading-relaxed">{inspectingItem.recommendedAction}</p>
            </div>

            {/* CA Manual Override / Review Action Section */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-800 block">CA / Auditor Override & Action Protocol:</span>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  placeholder="Enter audit remarks or tolerance reason..."
                  value={overrideRemark}
                  onChange={e => setOverrideRemark(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  id="btn-force-accept-override"
                  onClick={() => handleAcceptOverride(inspectingItem.id, overrideRemark)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs"
                >
                  Accept & Force Match
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() => handleToggleHoldPayment(inspectingItem.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    paymentHeldIds.has(inspectingItem.id)
                      ? 'bg-rose-100 border-rose-300 text-rose-800'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {paymentHeldIds.has(inspectingItem.id) ? 'Payment Frozen (Active)' : 'Freeze Vendor Payment'}
                </button>

                <button
                  onClick={() => handleToggleDeferItc(inspectingItem.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    deferredIds.has(inspectingItem.id)
                      ? 'bg-indigo-100 border-indigo-300 text-indigo-800'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {deferredIds.has(inspectingItem.id) ? 'ITC Deferred (Active)' : 'Defer ITC to Next Month'}
                </button>

                <button
                  onClick={() => {
                    setNoticeItem(inspectingItem);
                    setInspectingItem(null);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  Send Supplier Legal Notice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- SUPPLIER LEGAL NOTICE & COMMUNICATION MODAL --- */}
      {noticeItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 space-y-5 my-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Mail className="text-indigo-600" size={20} />
                <h3 className="text-base font-black text-slate-900">
                  Statutory GSTR-1 Amendment & Filing Demand
                </h3>
              </div>
              <button
                onClick={() => setNoticeItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200 text-slate-700">
              <p><strong>To:</strong> {noticeItem.purchaseRecord?.partyName || noticeItem.gstr2bRecord?.supplierName}</p>
              <p><strong>GSTIN:</strong> {noticeItem.purchaseRecord?.gstin || noticeItem.gstr2bRecord?.gstin}</p>
              <p><strong>Invoice Reference:</strong> {noticeItem.purchaseRecord?.invoiceNumber || noticeItem.gstr2bRecord?.invoiceNumber} (Date: {noticeItem.purchaseRecord?.date || noticeItem.gstr2bRecord?.invoiceDate})</p>
              <p><strong>Tax Discrepancy Amount:</strong> ₹{noticeItem.taxDifference.toLocaleString()}</p>
            </div>

            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 text-[11.5px] text-indigo-950 leading-relaxed font-mono whitespace-pre-wrap">
              {`Dear Accounts / Tax Team,

We are reconciling our Purchase Register with statutory GSTR-2B for ${selectedPeriod}. Invoice ${
                noticeItem.purchaseRecord?.invoiceNumber || ''
              } dated ${noticeItem.purchaseRecord?.date || ''} for Tax Amount ₹${(
                noticeItem.purchaseRecord?.taxAmount || 0
              ).toLocaleString()} has not been properly auto-populated in our GSTR-2B statement.

Under Section 16(2)(aa) of CGST Act, our Input Tax Credit (ITC) is blocked. Please ensure this invoice is uploaded in your GSTR-1 before the 11th of the upcoming month or amend the tax head / invoice value accordingly to avoid payment withholding.

Regards,
Tax & Compliance Department
${tenantId}`}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Statutory Notice: Invoice ${noticeItem.purchaseRecord?.invoiceNumber} for ₹${noticeItem.purchaseRecord?.taxAmount} is missing in GSTR-2B. Please file GSTR-1 immediately to avoid ITC blockage.`
                  );
                  setSyncFeedback('Notice text copied to clipboard for WhatsApp / Email.');
                  setTimeout(() => setSyncFeedback(null), 3000);
                }}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Copy Text
              </button>

              <button
                id="btn-dispatch-single-notice"
                onClick={() => handleSendSupplierNotice(noticeItem)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-98"
              >
                Dispatch Official Notice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- RECONCILIATION ASSISTANT MODAL --- */}
      {showAssistantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-6xl max-h-[92vh] flex flex-col">
            <ReconciliationAssistant
              tenantName={tenantId === 't1' ? 'TaxFlow Enterprise Ltd' : `Entity ${tenantId}`}
              initialPeriod={selectedPeriod}
              isModal={true}
              onClose={() => setShowAssistantModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Gstr2bReconciliationEngine;
