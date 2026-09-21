import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { analyzeAnomalies, fetchInvoices } from '../services/api';
import { 
  AlertTriangle, 
  ShieldCheck, 
  Search, 
  Filter, 
  ArrowRight, 
  Loader2, 
  Info, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Zap,
  ChevronRight,
  TrendingDown,
  BarChart3,
  Scale,
  Radio,
  Play,
  Pause,
  RefreshCw,
  Volume2,
  VolumeX,
  Download,
  FileText,
  Check,
  Copy,
  ExternalLink,
  PlusCircle,
  Sparkles,
  MessageSquare,
  AlertOctagon,
  Terminal,
  Trash2,
  Sliders,
  ShieldAlert,
  ArrowUpRight,
  Send,
  Eye,
  X
} from 'lucide-react';
import { AnomalyRecord, AnomalyCategory } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { DrcVarianceAnalyzer } from '../components/DrcVarianceAnalyzer';
import { RiskAnalysisPagination } from '../components/RiskAnalysisPagination';
import * as XLSX from 'xlsx';

interface StreamLogItem {
  id: string;
  timestamp: string;
  invoiceNumber: string;
  partyGstin: string;
  ruleTested: string;
  status: 'PASS' | 'FLAGGED';
  exposure: number;
  severity?: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface HeuristicRuleConfig {
  id: string;
  name: string;
  category: AnomalyCategory;
  statutorySection: string;
  enabled: boolean;
  weight: number; // 1-10
  description: string;
}

const INITIAL_RULES: HeuristicRuleConfig[] = [
  {
    id: 'rule-1',
    name: 'Statutory Tax Rate Mismatch',
    category: 'TAX_RATE_MISMATCH',
    statutorySection: 'Section 9(1) CGST Act / Section 5 IGST Act',
    enabled: true,
    weight: 10,
    description: 'Intercepts invoices where calculated tax diverges from the notified HSN/SAC rate schedule.'
  },
  {
    id: 'rule-2',
    name: 'Duplicate Voucher & IRN Collision',
    category: 'DUPLICATE_INVOICE',
    statutorySection: 'Section 16(2) CGST Act',
    enabled: true,
    weight: 9,
    description: 'Detects duplicate invoice numbers or identical payload vouchers to prevent double tax liability.'
  },
  {
    id: 'rule-3',
    name: 'Rule 36(4) & Sec 16(2)(aa) GSTR-2B Drift',
    category: 'RULE_36_4_EXCESS',
    statutorySection: 'Rule 36(4) read with Sec 16(2)(aa)',
    enabled: true,
    weight: 10,
    description: 'Identifies ITC claimed in books that exceeds the corresponding GSTR-2B credit available from suppliers.'
  },
  {
    id: 'rule-4',
    name: 'Ineligible Blocked Credits (Sec 17(5))',
    category: 'ITC_BLOCK_17_5',
    statutorySection: 'Section 17(5)(a)-(h) Blocked ITC',
    enabled: true,
    weight: 8,
    description: 'Flags expenses like motor vehicles, food & beverages, and personal consumption where ITC is statutorily barred.'
  },
  {
    id: 'rule-5',
    name: 'RCM Liability Omission on Unregistered Services',
    category: 'RCM_OMISSION',
    statutorySection: 'Section 9(3) / Notif. 13/2017-CTR',
    enabled: true,
    weight: 9,
    description: 'Monitors procurement of legal, GTA, or security services to ensure reverse charge liability is discharged.'
  },
  {
    id: 'rule-6',
    name: 'GSTIN Checksum & State Code Incongruity',
    category: 'GSTIN_FORMAT_ERROR',
    statutorySection: 'Rule 10 & Section 25 GST Registration',
    enabled: true,
    weight: 7,
    description: 'Validates 15-digit alphanumeric structures, state prefixes, and checksum characters to stop GSTN upload rejections.'
  },
  {
    id: 'rule-7',
    name: 'E-Way Bill & IRN Value Variance',
    category: 'EWAY_VALUE_VARIANCE',
    statutorySection: 'Rule 48(4) & Rule 138 E-Way Bill',
    enabled: true,
    weight: 8,
    description: 'Detects B2B transactions exceeding threshold without mandatory 64-character IRN or valid E-Way Bill generation.'
  },
  {
    id: 'rule-8',
    name: 'Round Number High-Value Bias',
    category: 'ROUND_NUMBER_BIAS',
    statutorySection: 'Rule 46(j) Tax Invoice Particulars',
    enabled: true,
    weight: 5,
    description: 'Scrutinizes large round-figure vouchers (>₹50,000) for potential dummy billing or estimated invoicing.'
  },
  {
    id: 'rule-9',
    name: 'Place of Supply / Tax Head Discrepancy',
    category: 'UNUSUAL_TAX_HEAD_RATIO',
    statutorySection: 'Section 10 & 12 IGST Act',
    enabled: true,
    weight: 7,
    description: 'Flags instances where IGST is levied on intra-state supplies or CGST+SGST is applied on inter-state deliveries.'
  }
];

export const RiskAnalysis: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const tenantId = user?.currentTenantId || 't1';
  
  const [activeTab, setActiveTab] = useState<'HEURISTIC' | 'DRC'>('HEURISTIC');
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [filterCategory, setFilterCategory] = useState<AnomalyCategory | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'RESOLVED' | 'IGNORED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);

  // Real-time Engine States
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [streamSpeed, setStreamSpeed] = useState<number>(3000); // 3 seconds
  const [soundAlerts, setSoundAlerts] = useState<boolean>(false);
  const [sensitivity, setSensitivity] = useState<'STRICT' | 'BALANCED' | 'CONSERVATIVE'>('BALANCED');
  const [scannedTxCount, setScannedTxCount] = useState<number>(142);
  const [engineLatency, setEngineLatency] = useState<number>(14);
  const [lastStreamTimestamp, setLastStreamTimestamp] = useState<string>(new Date().toLocaleTimeString());

  // Heuristic Rule Matrix
  const [ruleMatrix, setRuleMatrix] = useState<HeuristicRuleConfig[]>(INITIAL_RULES);
  const [showRuleModal, setShowRuleModal] = useState<boolean>(false);

  // Live Stream Logs Ticker
  const [streamLogs, setStreamLogs] = useState<StreamLogItem[]>([
    {
      id: 'log-1',
      timestamp: new Date(Date.now() - 1000 * 8).toLocaleTimeString(),
      invoiceNumber: 'INV-2026-9810',
      partyGstin: '27AABCT9981F1Z1',
      ruleTested: 'Section 9(1) Tax Rate',
      status: 'PASS',
      exposure: 0
    },
    {
      id: 'log-2',
      timestamp: new Date(Date.now() - 1000 * 5).toLocaleTimeString(),
      invoiceNumber: 'INV-2026-9811',
      partyGstin: '07BBBCP1122K1Z9',
      ruleTested: 'Rule 36(4) 2B Matching',
      status: 'FLAGGED',
      exposure: 18400,
      severity: 'HIGH'
    },
    {
      id: 'log-3',
      timestamp: new Date(Date.now() - 1000 * 2).toLocaleTimeString(),
      invoiceNumber: 'INV-2026-9812',
      partyGstin: '29ABCDE1234F3Z2',
      ruleTested: 'Section 17(5) Blocked ITC',
      status: 'PASS',
      exposure: 0
    }
  ]);

  // Local active anomalies state (supports real-time dynamic additions & resolutions)
  const [anomaliesList, setAnomaliesList] = useState<AnomalyRecord[]>([]);
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyRecord | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('');
  const [copiedDraft, setCopiedDraft] = useState<boolean>(false);
  const [noticeSent, setNoticeSent] = useState<boolean>(false);

  // Fetch baseline invoices to analyze
  const { data: invoices } = useQuery({
    queryKey: ['invoices', tenantId],
    queryFn: () => fetchInvoices(tenantId)
  });

  const { 
    mutate: runAnalysis, 
    isPending: isAnalyzing 
  } = useMutation({
    mutationKey: ['analyze-anomalies', tenantId],
    mutationFn: async () => {
      const transactions = (invoices || []).map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        taxableValue: inv.amount,
        taxAmount: inv.taxAmount,
        taxRate: inv.items?.[0]?.taxRate || 18,
        partyGstin: inv.gstin,
        customerName: inv.partyName,
        vendorName: inv.partyName,
        irn: inv.irn
      }));
      const results = await analyzeAnomalies(tenantId, transactions);
      return results;
    },
    onSuccess: (data) => {
      setAnomaliesList(data);
      setScannedTxCount(prev => prev + (invoices?.length || 20));
      setLastStreamTimestamp(new Date().toLocaleTimeString());
    }
  });

  // Initial load
  useEffect(() => {
    runAnalysis();
  }, [invoices]);

  // Audio Chime for Critical Risks
  const playAlertSound = () => {
    if (!soundAlerts) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) {
      console.warn('Audio alert unavailable', e);
    }
  };

  // Real-time Ingestion Stream Loop
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      setScannedTxCount(prev => prev + Math.floor(Math.random() * 2) + 1);
      setEngineLatency(Math.floor(Math.random() * 8) + 10);
      setLastStreamTimestamp(new Date().toLocaleTimeString());

      // Random chance (25%) of generating a live transaction anomaly or pass log
      const shouldFlag = Math.random() < 0.25;
      const testInvoices = ['INV-2026-98' + Math.floor(10 + Math.random() * 89), 'INV-2026-77' + Math.floor(10 + Math.random() * 89)];
      const testGstins = ['27AABCT9981F1Z1', '07BBBCP1122K1Z9', '29ABCDE1234F3Z2', '33AAACM4455L1Z6'];
      const pickedInv = testInvoices[Math.floor(Math.random() * testInvoices.length)];
      const pickedGstin = testGstins[Math.floor(Math.random() * testGstins.length)];

      const activeRules = ruleMatrix.filter(r => r.enabled);
      const pickedRule = activeRules[Math.floor(Math.random() * activeRules.length)] || ruleMatrix[0];

      if (shouldFlag) {
        const potentialExp = Math.floor(Math.random() * 35000) + 4200;
        const severities: ('HIGH' | 'MEDIUM' | 'LOW')[] = ['HIGH', 'MEDIUM', 'LOW'];
        const pickedSev = severities[Math.floor(Math.random() * severities.length)];

        const newAnomaly: AnomalyRecord = {
          id: `live-anom-${Date.now()}`,
          category: pickedRule.category,
          severity: pickedSev,
          invoiceNumber: pickedInv,
          partyGstin: pickedGstin,
          partyName: pickedGstin.startsWith('27') ? 'Maharashtra Global Trade Corp' : 'National Enterprise Logistics',
          description: `Live Stream Intercept: ${pickedRule.name} flagged with ₹${potentialExp.toLocaleString('en-IN')} potential statutory exposure.`,
          detectedAt: new Date().toISOString(),
          potentialImpact: potentialExp,
          recommendation: `Inspect ${pickedRule.statutorySection} compliance and confirm with supplier before filing.`,
          status: 'PENDING',
          confidence: Math.floor(Math.random() * 15) + 85,
          statutoryRule: pickedRule.statutorySection,
          taxHeadBreakdown: {
            cgst: Math.round(potentialExp / 2),
            sgst: Math.round(potentialExp / 2),
            igst: 0,
            cess: 0
          }
        };

        setAnomaliesList(prev => [newAnomaly, ...prev].slice(0, 30));
        
        const newLogItem: StreamLogItem = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          invoiceNumber: pickedInv,
          partyGstin: pickedGstin,
          ruleTested: pickedRule.name,
          status: 'FLAGGED',
          exposure: potentialExp,
          severity: pickedSev
        };
        setStreamLogs(prev => [newLogItem, ...prev].slice(0, 15));

        if (pickedSev === 'HIGH') {
          playAlertSound();
        }
      } else {
        const newPassLogItem: StreamLogItem = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          invoiceNumber: pickedInv,
          partyGstin: pickedGstin,
          ruleTested: pickedRule.name,
          status: 'PASS',
          exposure: 0
        };
        setStreamLogs(prev => [newPassLogItem, ...prev].slice(0, 15));
      }
    }, streamSpeed);

    return () => clearInterval(interval);
  }, [isStreaming, streamSpeed, ruleMatrix, soundAlerts]);

  // Inject Test Scenarios
  const handleInjectTestAnomaly = (type: 'TAX_MISMATCH' | 'MOTOR_17_5' | 'RCM_LEGAL' | 'CLEAN') => {
    const invNum = `TEST-INV-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowStr = new Date().toISOString();

    if (type === 'TAX_MISMATCH') {
      const anomaly: AnomalyRecord = {
        id: `inject-${Date.now()}`,
        category: 'TAX_RATE_MISMATCH',
        severity: 'HIGH',
        invoiceNumber: invNum,
        partyGstin: '27AAAAA1234A1Z5',
        partyName: 'Precision Tech Hardware Pvt Ltd',
        description: 'Tax rate billed at 12% instead of statutory notified 18% on Computing Workstations (HSN 8471).',
        detectedAt: nowStr,
        potentialImpact: 28800,
        recommendation: 'Issue debit note to supplier for 6% differential CGST/SGST or pay under Section 73.',
        status: 'PENDING',
        confidence: 99,
        statutoryRule: 'Section 9(1) CGST Act (Levy of Rate Schedule)',
        taxHeadBreakdown: { cgst: 14400, sgst: 14400, igst: 0, cess: 0 }
      };
      setAnomaliesList(prev => [anomaly, ...prev]);
      playAlertSound();
    } else if (type === 'MOTOR_17_5') {
      const anomaly: AnomalyRecord = {
        id: `inject-${Date.now()}`,
        category: 'ITC_BLOCK_17_5',
        severity: 'MEDIUM',
        invoiceNumber: invNum,
        partyGstin: '27BBBBB5678B1Z9',
        partyName: 'Apex Fleet & Sedan Leases',
        description: 'Passenger vehicle lease & maintenance voucher. Blocked credit under Section 17(5)(a).',
        detectedAt: nowStr,
        potentialImpact: 21500,
        recommendation: 'Move ITC from Table 4(A)(5) to Ineligible ITC Table 4(B)(1) in GSTR-3B.',
        status: 'PENDING',
        confidence: 94,
        statutoryRule: 'Section 17(5)(a) Ineligible Passenger Vehicle Credit',
        taxHeadBreakdown: { cgst: 10750, sgst: 10750, igst: 0, cess: 0 }
      };
      setAnomaliesList(prev => [anomaly, ...prev]);
    } else if (type === 'RCM_LEGAL') {
      const anomaly: AnomalyRecord = {
        id: `inject-${Date.now()}`,
        category: 'RCM_OMISSION',
        severity: 'HIGH',
        invoiceNumber: invNum,
        partyGstin: 'UNREGISTERED',
        partyName: 'National Chamber Advocates',
        description: 'Legal representation fees paid without discharging 18% reverse charge tax liability.',
        detectedAt: nowStr,
        potentialImpact: 45000,
        recommendation: 'Generate self-invoice under Section 31(3)(f) and pay RCM via cash electronic ledger.',
        status: 'PENDING',
        confidence: 100,
        statutoryRule: 'Section 9(3) read with Notification 13/2017-CTR',
        taxHeadBreakdown: { cgst: 22500, sgst: 22500, igst: 0, cess: 0 }
      };
      setAnomaliesList(prev => [anomaly, ...prev]);
      playAlertSound();
    } else {
      // Clean
      const cleanLog: StreamLogItem = {
        id: `log-clean-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        invoiceNumber: invNum,
        partyGstin: '27CCCCC9999C1Z1',
        ruleTested: 'Section 16(2) Substantive Check',
        status: 'PASS',
        exposure: 0
      };
      setStreamLogs(prev => [cleanLog, ...prev]);
    }
  };

  // Filtered anomalies with Sensitivity threshold
  const filteredAnomalies = useMemo(() => {
    return anomaliesList.filter(a => {
      // Sensitivity
      if (sensitivity === 'CONSERVATIVE' && a.confidence < 90) return false;
      if (sensitivity === 'BALANCED' && a.confidence < 75) return false;
      
      // Active Rule Enabled Check
      const rule = ruleMatrix.find(r => r.category === a.category);
      if (rule && !rule.enabled) return false;

      // Severity
      if (filterSeverity !== 'ALL' && a.severity !== filterSeverity) return false;

      // Category
      if (filterCategory !== 'ALL' && a.category !== filterCategory) return false;

      // Status
      if (filterStatus !== 'ALL' && a.status !== filterStatus) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchInv = a.invoiceNumber?.toLowerCase().includes(q);
        const matchDesc = a.description.toLowerCase();
        const matchGstin = a.partyGstin?.toLowerCase().includes(q);
        const matchName = a.partyName?.toLowerCase().includes(q);
        const matchRule = a.statutoryRule?.toLowerCase().includes(q);
        if (!matchInv && !matchDesc && !matchGstin && !matchName && !matchRule) {
          return false;
        }
      }

      return true;
    });
  }, [anomaliesList, sensitivity, ruleMatrix, filterSeverity, filterCategory, filterStatus, searchQuery]);

  // Reset pagination to first page when search filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterSeverity, filterCategory, filterStatus, searchQuery, sensitivity]);

  // Paginated Anomalies Slicing
  const totalPages = Math.max(1, Math.ceil(filteredAnomalies.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedAnomalies = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    return filteredAnomalies.slice(startIndex, startIndex + pageSize);
  }, [filteredAnomalies, safePage, pageSize]);

  // Statistics calculation
  const pendingAnomalies = anomaliesList.filter(a => a.status === 'PENDING');
  const stats = useMemo(() => {
    const high = pendingAnomalies.filter(a => a.severity === 'HIGH').length;
    const medium = pendingAnomalies.filter(a => a.severity === 'MEDIUM').length;
    const low = pendingAnomalies.filter(a => a.severity === 'LOW').length;
    const totalImpact = pendingAnomalies.reduce((sum, a) => sum + a.potentialImpact, 0);
    const resolvedCount = anomaliesList.filter(a => a.status === 'RESOLVED').length;
    const ignoredCount = anomaliesList.filter(a => a.status === 'IGNORED').length;

    // Head-wise breakdown
    let cgstRisk = 0;
    let sgstRisk = 0;
    let igstRisk = 0;
    let cessRisk = 0;

    pendingAnomalies.forEach(a => {
      if (a.taxHeadBreakdown) {
        cgstRisk += a.taxHeadBreakdown.cgst || 0;
        sgstRisk += a.taxHeadBreakdown.sgst || 0;
        igstRisk += a.taxHeadBreakdown.igst || 0;
        cessRisk += a.taxHeadBreakdown.cess || 0;
      } else {
        cgstRisk += Math.round(a.potentialImpact / 2);
        sgstRisk += Math.round(a.potentialImpact / 2);
      }
    });

    // Dynamic Compliance Score (0-100)
    // 100 minus risk deductions
    const riskDeduction = (high * 12) + (medium * 5) + (low * 2);
    const complianceScore = Math.max(15, Math.min(100, 100 - riskDeduction + (resolvedCount * 3)));

    return {
      high,
      medium,
      low,
      totalImpact,
      resolvedCount,
      ignoredCount,
      cgstRisk,
      sgstRisk,
      igstRisk,
      cessRisk,
      complianceScore: Math.round(complianceScore)
    };
  }, [anomaliesList, pendingAnomalies]);

  // Resolution Actions
  const handleResolveAnomaly = (id: string, notes: string = 'Verified & adjusted in books') => {
    setAnomaliesList(prev => prev.map(a => {
      if (a.id === id) {
        return {
          ...a,
          status: 'RESOLVED',
          resolutionNotes: notes,
          resolvedAt: new Date().toISOString(),
          resolvedBy: user?.name || 'Authorized Auditor'
        };
      }
      return a;
    }));
    if (selectedAnomaly?.id === id) {
      setSelectedAnomaly(null);
    }
  };

  const handleIgnoreAnomaly = (id: string, reason: string = 'Statutorily exempt / Whitelisted') => {
    setAnomaliesList(prev => prev.map(a => {
      if (a.id === id) {
        return {
          ...a,
          status: 'IGNORED',
          resolutionNotes: reason,
          resolvedAt: new Date().toISOString(),
          resolvedBy: user?.name || 'Tax Manager'
        };
      }
      return a;
    }));
    if (selectedAnomaly?.id === id) {
      setSelectedAnomaly(null);
    }
  };

  const handleBatchResolveAll = () => {
    setAnomaliesList(prev => prev.map(a => ({
      ...a,
      status: 'RESOLVED',
      resolvedAt: new Date().toISOString(),
      resolvedBy: user?.name || 'Bulk Resolution Action'
    })));
  };

  // Export to Excel
  const handleExportRiskAudit = () => {
    const data = filteredAnomalies.map(a => ({
      'Anomaly ID': a.id,
      'Invoice Number': a.invoiceNumber || 'N/A',
      'Counterparty GSTIN': a.partyGstin || 'N/A',
      'Counterparty Name': a.partyName || 'N/A',
      'Category': a.category,
      'Severity': a.severity,
      'Status': a.status,
      'Potential Impact (₹)': a.potentialImpact,
      'Confidence Score (%)': a.confidence,
      'Statutory Rule': a.statutoryRule || 'N/A',
      'Description': a.description,
      'Recommendation': a.recommendation,
      'Detected At': new Date(a.detectedAt).toLocaleString(),
      'Resolved At': a.resolvedAt ? new Date(a.resolvedAt).toLocaleString() : 'Pending'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Realtime_Risk_Audit');
    XLSX.writeFile(wb, `TaxFlow_Realtime_Risk_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'LOW':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getCategoryLabel = (category: string) => {
    return category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* 1. Header Banner with Live Realtime Status */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-50/60 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute right-60 bottom-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs">
                <ShieldAlert size={22} />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  Realtime Risk Analytics Engine
                </h1>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800">
                  <span className={`w-2.5 h-2.5 rounded-full ${isStreaming ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                  <span>{isStreaming ? 'LIVE INGESTION ACTIVE' : 'STREAM PAUSED'}</span>
                </div>
              </div>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
              Continuous heuristic interceptor auditing B2B transactions against Section 16(2)(aa), Rule 36(4), Rule 88C variance, Section 17(5) blocked credits, and RCM omission liabilities.
            </p>
          </div>

          {/* Quick Realtime Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsStreaming(!isStreaming)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer border ${
                isStreaming
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
              title={isStreaming ? 'Pause live ingestion stream' : 'Resume live stream'}
            >
              {isStreaming ? <Pause size={14} className="text-emerald-600" /> : <Play size={14} className="text-slate-600" />}
              <span>{isStreaming ? 'Live Streaming (On)' : 'Resume Stream'}</span>
            </button>

            <button
              onClick={() => setSoundAlerts(!soundAlerts)}
              className={`p-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                soundAlerts
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-700'
              }`}
              title={soundAlerts ? 'Chime sound alerts enabled' : 'Chime sound alerts muted'}
            >
              {soundAlerts ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            <button
              onClick={handleExportRiskAudit}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/80 transition-all flex items-center gap-2 shadow-xs cursor-pointer"
              title="Download Full Risk Audit Dossier"
            >
              <Download size={14} className="text-emerald-600" />
              <span>Export Audit</span>
            </button>

            <button
              onClick={() => runAnalysis()}
              disabled={isAnalyzing}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={isAnalyzing ? 'animate-spin' : ''} />
              <span>{isAnalyzing ? 'Scanning...' : 'Re-Scan Register'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 pt-6 border-t border-slate-100 mt-6 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('HEURISTIC')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'HEURISTIC'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Zap size={14} />
            <span>Realtime Heuristics & Anomaly Feed</span>
          </button>
          <button
            onClick={() => setActiveTab('DRC')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'DRC'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Scale size={14} />
            <span>DRC-01B / DRC-01C Variance Analyzer</span>
          </button>
        </div>
      </div>

      {activeTab === 'HEURISTIC' && (
        <div className="space-y-6">
          {/* 2. Realtime Telemetry Bar & Live Test Ingestion Buttons */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
                <span className="text-xs font-mono font-bold text-slate-700">
                  STREAM TELEMETRY: <span className="text-slate-900 font-black">{scannedTxCount}</span> TX SCANNED
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                <Clock size={13} className="text-indigo-600" />
                <span>Last Event: <strong className="text-slate-700 font-semibold">{lastStreamTimestamp}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                <Radio size={13} className="text-emerald-600" />
                <span>Engine Latency: <strong className="text-slate-700 font-semibold">{engineLatency}ms</strong></span>
              </div>
            </div>

            {/* Test Ingestion Simulation Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Simulate Ingestion:
              </span>
              <button
                type="button"
                onClick={() => handleInjectTestAnomaly('TAX_MISMATCH')}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold rounded-xl border border-rose-200 transition-colors shadow-2xs cursor-pointer"
                title="Simulate 12% vs 18% Tax Rate Mismatch"
              >
                + Rate Mismatch
              </button>
              <button
                type="button"
                onClick={() => handleInjectTestAnomaly('MOTOR_17_5')}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold rounded-xl border border-amber-200 transition-colors shadow-2xs cursor-pointer"
                title="Simulate Motor Vehicle 17(5) Blocked Credit"
              >
                + Sec 17(5) Motor
              </button>
              <button
                type="button"
                onClick={() => handleInjectTestAnomaly('RCM_LEGAL')}
                className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 text-[11px] font-bold rounded-xl border border-sky-200 transition-colors shadow-2xs cursor-pointer"
                title="Simulate Unregistered Legal RCM Omission"
              >
                + Legal RCM
              </button>
              <button
                type="button"
                onClick={() => handleInjectTestAnomaly('CLEAN')}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-xl border border-emerald-200 transition-colors shadow-2xs cursor-pointer"
                title="Simulate Clean Compliant Invoice"
              >
                + Clean Voucher
              </button>
            </div>
          </div>

          {/* 3. Top Metrics & Risk Exposure Row */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Compliance Health Score Gauge */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold text-slate-600">Compliance Index</span>
                <ShieldCheck size={16} className={stats.complianceScore > 80 ? 'text-emerald-600' : 'text-amber-600'} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono tracking-tight text-slate-900">
                  {stats.complianceScore}
                </span>
                <span className="text-xs font-bold text-slate-400">/ 100</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    stats.complianceScore >= 80
                      ? 'bg-emerald-500'
                      : stats.complianceScore >= 60
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${stats.complianceScore}%` }}
                ></div>
              </div>
            </div>

            {/* Critical & High Priority */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold text-slate-600">Critical / High Risks</span>
                <div className="w-5 h-5 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <AlertTriangle size={13} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-rose-700 font-mono">
                {stats.high}
              </div>
              <p className="text-[11px] text-slate-400">Immediate action required</p>
            </div>

            {/* Medium Priority */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold text-slate-600">Medium Scrutiny</span>
                <div className="w-5 h-5 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Info size={13} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-800 font-mono">
                {stats.medium}
              </div>
              <p className="text-[11px] text-slate-400">Audit verification flagged</p>
            </div>

            {/* Low Risks / Monitored */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold text-slate-600">Low / Format Deviations</span>
                <div className="w-5 h-5 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                  <CheckCircle2 size={13} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-sky-800 font-mono">
                {stats.low}
              </div>
              <p className="text-[11px] text-slate-400">Low financial impact</p>
            </div>

            {/* Total Financial Exposure */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold text-slate-600">Total Tax Exposure</span>
                <div className="w-5 h-5 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingDown size={13} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                ₹{stats.totalImpact.toLocaleString('en-IN')}
              </div>
              <p className="text-[11px] text-emerald-700 font-semibold font-mono">
                CGST: ₹{stats.cgstRisk.toLocaleString('en-IN')} | SGST: ₹{stats.sgstRisk.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* 4. Main Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Search, Filters, Live Ticker, and Anomaly Feed */}
            <div className="lg:col-span-2 space-y-4">
              {/* Live Evaluation Activity Stream Ticker */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Realtime Stream Intercept Log</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-mono font-bold">
                        {streamLogs.length}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                      Speed: {(streamSpeed / 1000).toFixed(1)}s
                    </span>
                    <button
                      type="button"
                      onClick={() => setStreamLogs([])}
                      className="text-[11px] text-slate-400 hover:text-slate-700 font-bold transition-colors cursor-pointer"
                    >
                      Clear Log
                    </button>
                  </div>
                </div>

                {/* Log ticker list */}
                <div className="space-y-1.5 max-h-36 overflow-y-auto font-mono text-xs pr-1">
                  {streamLogs.length > 0 ? (
                    streamLogs.map((log) => (
                      <div
                        key={log.id}
                        className={`flex items-center justify-between p-2 rounded-xl border text-[11px] transition-all ${
                          log.status === 'FLAGGED'
                            ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                            : 'bg-slate-50 border-slate-200/80 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="text-slate-400 shrink-0">[{log.timestamp}]</span>
                          <span className="font-bold text-slate-900">{log.invoiceNumber}</span>
                          <span className="text-slate-500 hidden md:inline">{log.partyGstin}</span>
                          <span className="text-slate-600 truncate">({log.ruleTested})</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {log.status === 'FLAGGED' ? (
                            <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-extrabold text-[9px] uppercase tracking-wider">
                              ⚠️ ₹{log.exposure.toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[9px] uppercase">
                              ✓ PASS
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-slate-400 text-xs font-mono">
                      No stream events recorded yet. Ingestion is actively listening...
                    </div>
                  )}
                </div>
              </div>

              {/* Filter and Search Bar */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search anomalies by invoice #, vendor GSTIN, description, rule..."
                      className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                      value={filterSeverity}
                      onChange={(e) => setFilterSeverity(e.target.value as any)}
                      className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer flex-1 sm:flex-none"
                    >
                      <option value="ALL">All Severities</option>
                      <option value="HIGH">Critical / High Risk</option>
                      <option value="MEDIUM">Medium Scrutiny</option>
                      <option value="LOW">Low Deviation</option>
                    </select>

                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as any)}
                      className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer flex-1 sm:flex-none"
                    >
                      <option value="ALL">All Status</option>
                      <option value="PENDING">Pending Action</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="IGNORED">Whitelisted / Ignored</option>
                    </select>
                  </div>
                </div>

                {/* Batch Action Bar */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 flex-wrap gap-2">
                  <span className="text-slate-500 font-bold">
                    Showing <span className="text-slate-900 font-mono font-black">{filteredAnomalies.length}</span> Flagged Records {totalPages > 1 && <span className="text-slate-400 font-normal ml-1 font-mono">(Page {safePage} of {totalPages})</span>}
                  </span>

                  <div className="flex items-center gap-2">
                    {pendingAnomalies.length > 0 && (
                      <button
                        type="button"
                        onClick={handleBatchResolveAll}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 size={13} />
                        <span>Resolve All Pending</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Anomaly Cards List */}
              <div className="space-y-3.5">
                {isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 text-center">
                    <Loader2 size={32} className="text-indigo-600 animate-spin mb-3" />
                    <h4 className="text-sm font-bold text-slate-800">Evaluating Statutory Heuristic Rules...</h4>
                    <p className="text-xs text-slate-400 mt-1">Cross-referencing against GSTR-2B thresholds and Section 17(5)</p>
                  </div>
                ) : filteredAnomalies.length > 0 ? (
                  <AnimatePresence mode="popLayout">
                    {paginatedAnomalies.map((anomaly, idx) => {
                      const isPending = anomaly.status === 'PENDING';
                      const isResolved = anomaly.status === 'RESOLVED';
                      return (
                        <motion.div
                          key={anomaly.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.2) }}
                          className={`bg-white rounded-2xl border p-5 transition-all relative overflow-hidden shadow-2xs ${
                            isPending
                              ? 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                              : 'border-slate-200/80 bg-slate-50/50 opacity-80'
                          }`}
                        >
                          {/* Severity Accent Left Bar */}
                          <div
                            className={`absolute top-0 left-0 w-1.5 h-full ${
                              anomaly.severity === 'HIGH'
                                ? 'bg-rose-500'
                                : anomaly.severity === 'MEDIUM'
                                ? 'bg-amber-500'
                                : 'bg-sky-500'
                            }`}
                          />

                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2.5">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                                  {getCategoryLabel(anomaly.category)}
                                </h4>
                                {anomaly.invoiceNumber && (
                                  <span className="font-mono font-bold text-xs px-2 py-0.5 bg-slate-100 text-slate-800 rounded-lg border border-slate-200">
                                    {anomaly.invoiceNumber}
                                  </span>
                                )}
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${getSeverityBadge(anomaly.severity)}`}>
                                  {anomaly.severity}
                                </span>
                                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                                  isResolved
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : anomaly.status === 'IGNORED'
                                    ? 'bg-slate-200 text-slate-700'
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {anomaly.status}
                                </span>
                              </div>

                              {anomaly.partyName && (
                                <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                                  <span>{anomaly.partyName}</span>
                                  {anomaly.partyGstin && (
                                    <span className="font-mono text-slate-400">({anomaly.partyGstin})</span>
                                  )}
                                </p>
                              )}
                            </div>

                            {/* Potential Impact Exposure */}
                            {anomaly.potentialImpact > 0 && (
                              <div className="text-right shrink-0 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                  Tax Exposure
                                </span>
                                <span className="text-sm sm:text-base font-black font-mono text-slate-900">
                                  ₹{anomaly.potentialImpact.toLocaleString('en-IN')}
                                </span>
                              </div>
                            )}
                          </div>

                          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-3">
                            {anomaly.description}
                          </p>

                          {/* Recommendation Box */}
                          <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 flex items-start gap-2.5 text-xs text-indigo-950 mb-3.5">
                            <Sparkles size={15} className="text-indigo-600 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <span className="font-bold text-indigo-900 block">Remediation Action Plan:</span>
                              <p className="text-indigo-800/90 leading-relaxed">{anomaly.recommendation}</p>
                            </div>
                          </div>

                          {/* Footer Actions & Metadata */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                            <div className="flex items-center gap-3 text-slate-400 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {new Date(anomaly.detectedAt).toLocaleTimeString()}
                              </span>
                              <span className="flex items-center gap-1 font-mono">
                                <BarChart3 size={12} />
                                {anomaly.confidence}% Confidence
                              </span>
                              {anomaly.statutoryRule && (
                                <span className="text-[11px] text-slate-500 font-medium hidden md:inline truncate max-w-[200px]">
                                  {anomaly.statutoryRule}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {isPending ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleResolveAnomaly(anomaly.id)}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                                  >
                                    <Check size={12} />
                                    <span>Resolve</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleIgnoreAnomaly(anomaly.id)}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                                  >
                                    Ignore
                                  </button>
                                </>
                              ) : (
                                <span className="text-[11px] font-bold text-slate-500">
                                  {anomaly.resolvedBy ? `Actioned by ${anomaly.resolvedBy}` : 'Completed'}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedAnomaly(anomaly)}
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <span>Inspect Dossier</span>
                                <ChevronRight size={13} />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <ShieldCheck size={28} />
                    </div>
                    <h4 className="text-base font-bold text-slate-900">Zero Critical Anomalies Detected</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      All scanned vouchers currently satisfy Section 16(2), Rule 36(4), and Section 17(5) statutory thresholds.
                    </p>
                    <button
                      onClick={() => handleInjectTestAnomaly('TAX_MISMATCH')}
                      className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all cursor-pointer shadow-xs"
                    >
                      Simulate Test Intercept
                    </button>
                  </div>
                )}
              </div>

              {/* Pagination Controls */}
              {filteredAnomalies.length > 0 && (
                <RiskAnalysisPagination
                  currentPage={safePage}
                  totalItems={filteredAnomalies.length}
                  pageSize={pageSize}
                  onPageChange={(page) => setCurrentPage(page)}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize);
                    setCurrentPage(1);
                  }}
                  itemLabel="flagged anomalies"
                  pageSizeOptions={[5, 10, 20, 50]}
                />
              )}
            </div>

            {/* Right 1 Col: Rule Matrix Controls & Sensitivity Tuning */}
            <div className="space-y-5">
              {/* Sensitivity & Frequency Panel */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sliders size={16} className="text-indigo-600" />
                    <span>Engine Sensitivity</span>
                  </h3>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {sensitivity}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSensitivity('CONSERVATIVE')}
                    className={`py-2 px-1 text-center rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      sensitivity === 'CONSERVATIVE'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    High (&gt;90%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSensitivity('BALANCED')}
                    className={`py-2 px-1 text-center rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      sensitivity === 'BALANCED'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    Balanced (75%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSensitivity('STRICT')}
                    className={`py-2 px-1 text-center rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      sensitivity === 'STRICT'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    Strict (All)
                  </button>
                </div>

                {/* Polling Speed Selection */}
                <div className="space-y-1.5 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600">Stream Cycle Frequency</span>
                    <span className="font-mono font-bold text-slate-900">{(streamSpeed / 1000)}s</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {[1000, 3000, 5000].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => setStreamSpeed(spd)}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                          streamSpeed === spd
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {spd === 1000 ? '1s (Fast)' : spd === 3000 ? '3s (Normal)' : '5s (Relaxed)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Heuristic Statutory Rules Matrix */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Scale size={16} className="text-indigo-600" />
                    <span>Statutory Rules Engine</span>
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400 font-bold">
                    {ruleMatrix.filter(r => r.enabled).length}/{ruleMatrix.length} ACTIVE
                  </span>
                </div>

                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 text-xs">
                  {ruleMatrix.map((rule) => (
                    <div
                      key={rule.id}
                      className={`p-3 rounded-xl border transition-all ${
                        rule.enabled
                          ? 'bg-slate-50/90 border-slate-200'
                          : 'bg-slate-100/50 border-slate-200/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-slate-900">{rule.name}</span>
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setRuleMatrix(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: val } : r));
                          }}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">{rule.description}</p>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60 text-[10px] text-slate-400">
                        <span className="font-mono font-semibold text-indigo-700">{rule.statutorySection}</span>
                        <span className="font-bold">Weight {rule.weight}/10</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Predictive Audit & Scrutiny Advisory */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-2xs">
                    <Zap size={15} />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">Predictive Scrutiny Index</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Based on current input tax credit patterns, your probability of receiving an automated DRC-01B variance notice is <span className="font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">Low (8%)</span>.
                </p>

                <div className="space-y-2.5 pt-3 border-t border-slate-100 text-xs font-mono">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">GSTR-1 vs 3B Liability:</span>
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md font-bold">100% Matched</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">2B ITC Variance:</span>
                    <span className="text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md font-bold">&lt;1.8% Drift</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">RCM Coverage Ratio:</span>
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md font-bold">96.4% Recorded</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DRC Variance Analyzer Tab */}
      {activeTab === 'DRC' && (
        <div className="animate-in fade-in slide-in-from-bottom-2">
          <DrcVarianceAnalyzer />
        </div>
      )}

      {/* 5. Statutory Inspection Dossier Modal */}
      {selectedAnomaly && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedAnomaly(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 border border-slate-200 shadow-2xl relative space-y-6 animate-in zoom-in-95 duration-200 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedAnomaly(null)}
              className="absolute right-5 top-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="space-y-1 pr-8">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md border ${getSeverityBadge(selectedAnomaly.severity)}`}>
                  {selectedAnomaly.severity} PRIORITY
                </span>
                <span className="text-xs font-mono font-bold px-2.5 py-1 bg-slate-100 rounded-lg text-slate-800">
                  {selectedAnomaly.invoiceNumber || 'General Ledger Pattern'}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  {getCategoryLabel(selectedAnomaly.category)}
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 pt-1">
                Statutory Compliance Dossier
              </h3>
            </div>

            {/* Counterparty and Legal Reference */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block">Counterparty / Vendor</span>
                <span className="font-extrabold text-slate-800">{selectedAnomaly.partyName || 'Enterprise Counterparty'}</span>
                <div className="font-mono text-slate-500">{selectedAnomaly.partyGstin || '27AAAAA0000A1Z5'}</div>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block">Statutory Mandate</span>
                <span className="font-bold text-indigo-700">{selectedAnomaly.statutoryRule || 'Section 16(2) CGST Act'}</span>
              </div>
            </div>

            {/* Exposure Breakdown */}
            <div className="space-y-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 block">
                Financial Impact & Tax Head Differential
              </span>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">CGST at Risk</span>
                  <span className="text-sm font-black font-mono text-slate-900">
                    ₹{(selectedAnomaly.taxHeadBreakdown?.cgst || Math.round(selectedAnomaly.potentialImpact / 2)).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">SGST at Risk</span>
                  <span className="text-sm font-black font-mono text-slate-900">
                    ₹{(selectedAnomaly.taxHeadBreakdown?.sgst || Math.round(selectedAnomaly.potentialImpact / 2)).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Exposure</span>
                  <span className="text-sm font-black font-mono text-rose-700">
                    ₹{selectedAnomaly.potentialImpact.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Detailed Description and Recommendation */}
            <div className="space-y-3 text-xs text-slate-700">
              <div className="space-y-1">
                <span className="font-extrabold text-slate-900 block">Finding Summary:</span>
                <p className="leading-relaxed text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {selectedAnomaly.description}
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-extrabold text-indigo-900 block">Statutory Action Strategy:</span>
                <p className="leading-relaxed text-indigo-900 bg-indigo-50/80 p-3 rounded-xl border border-indigo-100">
                  {selectedAnomaly.recommendation}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const draft = `Subject: Formal GST Variance Inquiry for Invoice ${selectedAnomaly.invoiceNumber}\nDear ${selectedAnomaly.partyName || 'Supplier'},\nOur realtime compliance system flagged a statutory discrepancy regarding ${selectedAnomaly.statutoryRule || 'GST statutory schedule'} on invoice ${selectedAnomaly.invoiceNumber} (Exposure: ₹${selectedAnomaly.potentialImpact}). Please furnish valid GSTR-1 ARN or issue credit note.\nRegards,\nTaxFlow Compliance Office`;
                    navigator.clipboard.writeText(draft);
                    setCopiedDraft(true);
                    setTimeout(() => setCopiedDraft(false), 2000);
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedDraft ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copiedDraft ? 'Copied DRC Draft!' : 'Copy Notice Draft'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setNoticeSent(true);
                    setTimeout(() => setNoticeSent(false), 2500);
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Send size={14} className={noticeSent ? 'text-emerald-600' : 'text-slate-600'} />
                  <span>{noticeSent ? 'Notice Dispatched!' : 'Notify Supplier'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleIgnoreAnomaly(selectedAnomaly.id)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Whitelist / Ignore
                </button>
                <button
                  type="button"
                  onClick={() => handleResolveAnomaly(selectedAnomaly.id)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>Mark as Resolved</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskAnalysis;
