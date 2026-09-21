import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { 
  fetchInvoices, 
  generateEInvoice, 
  cancelEInvoice, 
  updateInvoice,
  logAuditAction
} from '../services/api';
import { 
  QrCode, Zap, X, ShieldAlert, CheckCircle2, AlertCircle, FileText, Download, Printer, 
  Upload, Search, FileSpreadsheet, RefreshCw, ChevronRight, History, Calendar, Trash2, 
  Edit3, Sliders, ChevronDown, Check, ArrowRight, Eye, AlertTriangle, ShieldCheck, DownloadCloud
} from 'lucide-react';
import { Invoice, InvoiceItem, UserRole } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { EInvoiceQrCodeModal } from '../components/EInvoiceQrCodeModal';
import { EInvoicePagination } from '../components/EInvoicePagination';

export default function EInvoicePage() {
  const queryClient = useQueryClient();
  const user = useSelector((state: RootState) => state.auth.user);
  const tenantId = user?.currentTenantId || 't1';
  const canEdit = user?.role === UserRole.ADMIN || user?.role === UserRole.ACCOUNTANT;

  // Query Invoices
  const { data: invoices = [], isLoading, refetch } = useQuery<Invoice[]>({ 
    queryKey: ['invoices', tenantId], 
    queryFn: () => fetchInvoices(tenantId) 
  });

  // State Management
  const [activeTab, setActiveTab] = useState<'CONSOLE' | 'REGISTRY' | 'BULK' | 'LOOKUP' | 'CONNECTIVITY'>('CONSOLE');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'CANCELLED' | 'PENDING' | 'FAILED'>('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // IRP API Settings States
  const [gspProvider, setGspProvider] = useState<string>(localStorage.getItem('irp_gsp_provider') || 'MasterIndia');
  const [irpEnv, setIrpEnv] = useState<'SANDBOX' | 'PRODUCTION'>((localStorage.getItem('irp_env') as any) || 'SANDBOX');
  const [gspUsername, setGspUsername] = useState<string>(localStorage.getItem('irp_gsp_username') || 'taxflow_gsp_user');
  const [gspPassword, setGspPassword] = useState<string>(localStorage.getItem('irp_gsp_password') || '••••••••••••');
  const [clientId, setClientId] = useState<string>(localStorage.getItem('irp_client_id') || 'cid_nic_taxflow_9012');
  const [clientSecret, setClientSecret] = useState<string>(localStorage.getItem('irp_client_secret') || '••••••••••••••••••••••••');
  const [irpSimStatus, setIrpSimStatus] = useState<'ONLINE' | 'MAINTENANCE' | 'OFFLINE'>('ONLINE');
  const [isBypassCancellationLimit, setIsBypassCancellationLimit] = useState<boolean>(localStorage.getItem('irp_bypass_cancellation_limit') === 'true');

  // IRP Connection Diagnostics
  const [isTestingHandshake, setIsTestingHandshake] = useState<boolean>(false);
  const [testHandshakeSteps, setTestHandshakeSteps] = useState<string[]>([]);
  const [testHandshakeResult, setTestHandshakeResult] = useState<'SUCCESS' | 'ERROR' | null>(null);
  const [apiLatency, setApiLatency] = useState<number | null>(Number(localStorage.getItem('irp_api_latency')) || null);
  const [lastVerifiedTime, setLastVerifiedTime] = useState<string>(localStorage.getItem('irp_last_verified') || '');

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('irp_gsp_provider', gspProvider);
    localStorage.setItem('irp_env', irpEnv);
    localStorage.setItem('irp_gsp_username', gspUsername);
    localStorage.setItem('irp_gsp_password', gspPassword);
    localStorage.setItem('irp_client_id', clientId);
    localStorage.setItem('irp_client_secret', clientSecret);
    localStorage.setItem('irp_bypass_cancellation_limit', String(isBypassCancellationLimit));
    showToast('IRP Gateway Credentials Saved Successfully!');
  };

  const handleTestHandshake = async () => {
    setIsTestingHandshake(true);
    setTestHandshakeResult(null);
    setTestHandshakeSteps([]);
    
    const steps = [
      "Contacting GSP Node: resolving DNS...",
      "Initiating secure handshake (TLS 1.3)...",
      "Sending Client Credentials to IRP Identity Server...",
      "Verifying client whitelist status...",
      "Obtaining signed bearer token...",
      "Pinging NIC E-Invoice endpoint..."
    ];

    for (let i = 0; i < steps.length; i++) {
      setTestHandshakeSteps(prev => [...prev, steps[i]]);
      await new Promise(resolve => setTimeout(resolve, 450));
    }

    if (irpSimStatus === 'OFFLINE') {
      setTestHandshakeResult('ERROR');
      showToast('Connection Failed: IRP Gateway is currently OFFLINE.', 'ERROR');
    } else if (irpSimStatus === 'MAINTENANCE') {
      setTestHandshakeResult('ERROR');
      showToast('Connection Timeout: IRP Gateway is undergoing Scheduled Maintenance.', 'ERROR');
    } else {
      const latency = Math.floor(40 + Math.random() * 80);
      const timeStr = new Date().toLocaleString();
      setApiLatency(latency);
      setLastVerifiedTime(timeStr);
      localStorage.setItem('irp_api_latency', String(latency));
      localStorage.setItem('irp_last_verified', timeStr);
      setTestHandshakeResult('SUCCESS');
      showToast('IRP Connection Handshake Successful! Latency: ' + latency + 'ms');
    }
    setIsTestingHandshake(false);
  };

  // Helper to decode signed QR JWT
  const decodeQRJwt = (jwt: string) => {
    try {
      if (!jwt || !jwt.includes('.')) return null;
      const parts = jwt.split('.');
      if (parts.length !== 3) return null;
      const payloadB64 = parts[1];
      const decodedStr = typeof window !== 'undefined' 
        ? decodeURIComponent(escape(atob(payloadB64)))
        : Buffer.from(payloadB64, 'base64').toString();
      return JSON.parse(decodedStr);
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  // Helper to check elapsed time since IRN registration (GST 24h cancellation limit)
  const getIrnCancellationTimeStatus = (invoice: Invoice) => {
    if (!invoice.ackDate || invoice.irnStatus === 'CANCELLED') return null;
    const elapsedMs = Date.now() - new Date(invoice.ackDate).getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    const hoursLeft = Math.max(0, 24 - elapsedHours);
    
    return {
      elapsedHours: Number(elapsedHours.toFixed(1)),
      hoursLeft: Number(hoursLeft.toFixed(1)),
      isExpired: elapsedHours > 24
    };
  };
  
  // Modal states
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('DUPLICATE');
  const [cancelRemarks, setCancelRemarks] = useState('');
  const [isRetryModalOpen, setIsRetryModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isStatutoryQrModalOpen, setIsStatutoryQrModalOpen] = useState(false);
  const [statutoryQrInvoice, setStatutoryQrInvoice] = useState<Invoice | null>(null);

  const openStatutoryQrModal = (inv: Invoice) => {
    setStatutoryQrInvoice(inv);
    setIsStatutoryQrModalOpen(true);
  };
  
  // Retry form states
  const [retryInvoiceId, setRetryInvoiceId] = useState('');
  const [retryGstin, setRetryGstin] = useState('');
  const [retryHsn, setRetryHsn] = useState('');
  const [retryStateCode, setRetryStateCode] = useState('');
  
  // Bulk CSV Upload State
  const [bulkFiles, setBulkFiles] = useState<File | null>(null);
  const [bulkParsedData, setBulkParsedData] = useState<any[]>([]);
  const [isBulkValidating, setIsBulkValidating] = useState(false);
  const [bulkUploadStep, setBulkUploadStep] = useState<1 | 2>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search IRN State (Lookup Tab)
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<Invoice | null>(null);
  const [lookupError, setLookupError] = useState('');

  // Toast / Status Message
  const [toastMsg, setToastMsg] = useState<{ type: 'SUCCESS' | 'ERROR'; text: string } | null>(null);

  const showToast = (text: string, type: 'SUCCESS' | 'ERROR' = 'SUCCESS') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Mutate Generate IRN
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const { mutate: generateIrn } = useMutation({
    mutationFn: generateEInvoice,
    onMutate: (id) => setGeneratingId(id),
    onSuccess: (data, id) => {
      setGeneratingId(null);
      queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      showToast('E-Invoice generated successfully! IRN & QR Code registered.');
      // Update local state if preview is open
      const updatedInv = invoices.find(i => i.id === id);
      if (updatedInv) {
        setSelectedInvoice({ ...updatedInv, ...data, irnStatus: 'ACTIVE', status: 'UPLOADED' });
      }
    },
    onError: (err: any, id) => {
      setGeneratingId(null);
      queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      showToast(err.message || 'Failed to generate E-Invoice', 'ERROR');
    }
  });

  // Mutate Cancel IRN
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { mutate: cancelIrn } = useMutation({
    mutationFn: ({ invoiceId, reason, remarks }: { invoiceId: string; reason: string; remarks: string }) => 
      cancelEInvoice(invoiceId, reason, remarks),
    onMutate: () => setCancellingId(selectedInvoice?.id || null),
    onSuccess: (data) => {
      setCancellingId(null);
      setIsCancelModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      showToast('IRN cancelled successfully on the IRP Gateway.');
      setSelectedInvoice(data.invoice);
    },
    onError: (err: any) => {
      setCancellingId(null);
      showToast(err.message || 'Failed to cancel E-Invoice', 'ERROR');
    }
  });

  // Mutate Retry Generate IRN (Fix & Generate)
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const handleResolveAndRetry = async (e: React.FormEvent) => {
    e.preventDefault();
    setRetryingId(retryInvoiceId);
    try {
      // 1. Update invoice details in the backend/localStorage
      await updateInvoice(retryInvoiceId, {
        gstin: retryGstin,
        placeOfSupply: retryStateCode,
        // Update first item's HSN for simplicity
        items: selectedInvoice?.items?.map((it, idx) => idx === 0 ? { ...it, hsnSac: retryHsn } : it)
      }, 'Resolved compliance errors for E-Invoice');

      // 2. Trigger IRN Generation
      generateIrn(retryInvoiceId);
      setIsRetryModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to update invoice data', 'ERROR');
    } finally {
      setRetryingId(null);
    }
  };

  // Open Retry modal with loaded fields
  const openRetryModal = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setRetryInvoiceId(inv.id);
    setRetryGstin(inv.gstin || '');
    setRetryHsn(inv.items?.[0]?.hsnSac || '998313');
    setRetryStateCode(inv.placeOfSupply || '27');
    setIsRetryModalOpen(true);
  };

  // Invoices filtered by E-Invoice eligibility (B2B or EXPORT, sales only)
  const eligibleInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const isSales = inv.category === 'SALES';
      const isEligibleType = inv.type === 'B2B' || inv.type === 'EXPORT';
      return isSales && isEligibleType;
    });
  }, [invoices]);

  // Dynamic Metrics calculations
  const metrics = useMemo(() => {
    let totalEligible = eligibleInvoices.length;
    let activeIrns = 0;
    let cancelledIrns = 0;
    let failedIrns = 0;
    let pendingIrns = 0;

    eligibleInvoices.forEach(inv => {
      if (inv.status === 'FAILED') {
        failedIrns++;
      } else if (inv.status === 'UPLOADED') {
        if (inv.irnStatus === 'CANCELLED') {
          cancelledIrns++;
        } else {
          activeIrns++;
        }
      } else {
        pendingIrns++;
      }
    });

    return { totalEligible, activeIrns, cancelledIrns, failedIrns, pendingIrns };
  }, [eligibleInvoices]);

  // Registry List with Search + Status Filters
  const registryInvoices = useMemo(() => {
    return eligibleInvoices.filter(inv => {
      // 1. Search Query
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.partyName.toLowerCase().includes(q) ||
        (inv.gstin && inv.gstin.toLowerCase().includes(q)) ||
        (inv.irn && inv.irn.toLowerCase().includes(q));

      // 2. Status Filter
      let matchesStatus = false;
      if (statusFilter === 'ALL') {
        matchesStatus = true;
      } else if (statusFilter === 'ACTIVE') {
        matchesStatus = inv.status === 'UPLOADED' && inv.irnStatus !== 'CANCELLED';
      } else if (statusFilter === 'CANCELLED') {
        matchesStatus = inv.status === 'UPLOADED' && inv.irnStatus === 'CANCELLED';
      } else if (statusFilter === 'FAILED') {
        matchesStatus = inv.status === 'FAILED';
      } else if (statusFilter === 'PENDING') {
        matchesStatus = inv.status === 'PENDING';
      }

      return matchesSearch && matchesStatus;
    });
  }, [eligibleInvoices, searchQuery, statusFilter]);

  // Registry Pagination State
  const [registryCurrentPage, setRegistryCurrentPage] = useState(1);
  const [registryPageSize, setRegistryPageSize] = useState(10);

  // Auto-reset page when registry search query, status filter, or page size changes
  useEffect(() => {
    setRegistryCurrentPage(1);
  }, [searchQuery, statusFilter, registryPageSize]);

  const registryTotalItems = registryInvoices.length;
  const registryTotalPages = Math.max(1, Math.ceil(registryTotalItems / registryPageSize));
  const safeRegistryCurrentPage = Math.min(Math.max(1, registryCurrentPage), registryTotalPages);

  const paginatedRegistryInvoices = useMemo(() => {
    const start = (safeRegistryCurrentPage - 1) * registryPageSize;
    return registryInvoices.slice(start, start + registryPageSize);
  }, [registryInvoices, safeRegistryCurrentPage, registryPageSize]);

  // Console (Pending Actions) Invoices & Pagination State
  const consoleInvoices = useMemo(() => {
    return eligibleInvoices.filter(i => i.status === 'PENDING' || i.status === 'FAILED');
  }, [eligibleInvoices]);

  const [consoleCurrentPage, setConsoleCurrentPage] = useState(1);
  const [consolePageSize, setConsolePageSize] = useState(10);

  useEffect(() => {
    setConsoleCurrentPage(1);
  }, [consolePageSize]);

  const consoleTotalItems = consoleInvoices.length;
  const consoleTotalPages = Math.max(1, Math.ceil(consoleTotalItems / consolePageSize));
  const safeConsoleCurrentPage = Math.min(Math.max(1, consoleCurrentPage), consoleTotalPages);

  const paginatedConsoleInvoices = useMemo(() => {
    const start = (safeConsoleCurrentPage - 1) * consolePageSize;
    return consoleInvoices.slice(start, start + consolePageSize);
  }, [consoleInvoices, safeConsoleCurrentPage, consolePageSize]);

  // Interactive IRN Lookup Search
  const handleIRNLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError('');
    setLookupResult(null);

    const query = lookupQuery.trim();
    if (!query) {
      setLookupError('Please enter a search query.');
      return;
    }

    const found = eligibleInvoices.find(inv => 
      inv.invoiceNumber.toUpperCase() === query.toUpperCase() ||
      inv.irn === query ||
      (inv.ackNo && inv.ackNo === query)
    );

    if (found) {
      setLookupResult(found);
      showToast('E-Invoice match found in local registry!');
    } else {
      setLookupError('No matching E-Invoice found. Ensure the IRN is 64-characters or invoice number is correct.');
    }
  };

  // CSV Drag and Drop Parsers
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkFiles(file);
    setIsBulkValidating(true);

    // Simulate CSV parsing & row validation
    setTimeout(() => {
      const mockCsvRows = [
        { invoiceNumber: 'INV-2026-9011', partyName: 'Saraswat Logistics Ltd', gstin: '27SARA1234F1Z8', state: '27', amount: 45000, hsn: '996511', status: 'VALID', errors: [] },
        { invoiceNumber: 'INV-2026-9012', partyName: 'Alpha Tech Corp', gstin: 'INVALID-GSTIN-9', state: '29', amount: 120000, hsn: '998313', status: 'INVALID', errors: ['Invalid GSTIN length', 'Unregistered Party'] },
        { invoiceNumber: 'INV-2026-9013', partyName: 'Zenith Global Inc', gstin: '07ZENITH3421A1Z5', state: '07', amount: 84000, hsn: '998314', status: 'VALID', errors: [] },
        { invoiceNumber: 'INV-2026-9014', partyName: 'Sai Catering Services', gstin: '27SAICAT4321B1Z9', state: '27', amount: 15400, hsn: '', status: 'INVALID', errors: ['Missing HSN/SAC Code'] },
        { invoiceNumber: 'INV-2026-9015', partyName: 'Global Exporters LLC', gstin: '', state: '96', amount: 310000, hsn: '998315', status: 'VALID', errors: [] } // Export has empty gstin, valid
      ];

      setBulkParsedData(mockCsvRows);
      setIsBulkValidating(false);
      setBulkUploadStep(2);
      showToast(`Parsed ${mockCsvRows.length} rows. 3 Valid, 2 Invalid documents.`);
    }, 1500);
  };

  const executeBulkGeneration = async () => {
    setIsBulkValidating(true);
    let successCount = 0;
    
    // Process only valid ones
    const validRows = bulkParsedData.filter(r => r.status === 'VALID');
    
    for (const row of validRows) {
      try {
        // Create matching sales invoice structure
        const taxDetails = {
          taxableValue: row.amount,
          igst: row.state === '27' ? 0 : row.amount * 0.18,
          cgst: row.state === '27' ? row.amount * 0.09 : 0,
          sgst: row.state === '27' ? row.amount * 0.09 : 0,
          utgst: 0,
          cess: 0
        };

        const newInvoice: Partial<Invoice> = {
          tenantId,
          invoiceNumber: row.invoiceNumber,
          partyName: row.partyName,
          gstin: row.gstin,
          placeOfSupply: row.state,
          date: new Date().toISOString().split('T')[0],
          amount: row.amount,
          taxAmount: row.amount * 0.18,
          taxDetails,
          type: row.gstin ? 'B2B' : 'EXPORT',
          category: 'SALES',
          docType: 'INVOICE',
          items: [{
            id: 'item-1',
            description: 'Software Integration Services',
            hsnSac: row.hsn || '998313',
            quantity: 1,
            unit: 'PCS',
            rate: row.amount,
            taxRate: 18,
            taxableValue: row.amount,
            taxAmount: row.amount * 0.18
          }]
        };

        const saved = await updateInvoice(`inv-${Date.now()}`, newInvoice, 'Bulk E-Invoice Upload');
        await generateEInvoice(saved.id);
        successCount++;
      } catch (e) {
        console.error(e);
      }
    }

    setIsBulkValidating(false);
    refetch();
    showToast(`Bulk Upload complete! Generated E-Invoices for ${successCount} valid documents.`);
    setBulkUploadStep(1);
    setBulkFiles(null);
    setBulkParsedData([]);
    setActiveTab('CONSOLE');
  };

  // Printable tax invoice mockup
  const handlePrint = () => {
    window.print();
  };

  // Download Signed Invoice Schema JSON file helper
  const downloadSignedJson = (inv: Invoice) => {
    const signedPayload = {
      Version: "1.1",
      Irn: inv.irn,
      AckNo: inv.ackNo,
      AckDt: inv.ackDate,
      DocumentDetails: {
        DocumentType: inv.docType,
        DocumentNumber: inv.invoiceNumber,
        DocumentDate: inv.date
      },
      SellerDetails: {
        Gstin: tenantId === 't1' ? '27ABCDE1234F1Z5' : '04XYZZZ9876L1Z1',
        LegalName: tenantId === 't1' ? 'Acme Corp' : 'Globex Inc',
        StateCode: tenantId === 't1' ? '27' : '04'
      },
      BuyerDetails: {
        Gstin: inv.gstin || 'URP',
        LegalName: inv.partyName,
        PlaceOfSupply: inv.placeOfSupply
      },
      ValueDetails: {
        TotalTaxableValue: inv.amount,
        TotalTaxAmount: inv.taxAmount,
        TotalInvoiceAmount: inv.amount + inv.taxAmount,
        Breakdown: inv.taxDetails
      }
    };

    const blob = new Blob([JSON.stringify(signedPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Signed_EInvoice_${inv.invoiceNumber}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded signed JSON for ${inv.invoiceNumber}`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 pb-12">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-xl border flex items-center gap-3 ${
              toastMsg.type === 'ERROR' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'
            }`}
          >
            {toastMsg.type === 'ERROR' ? <AlertCircle size={20} className="text-red-600" /> : <CheckCircle2 size={20} className="text-green-600" />}
            <span className="text-xs font-bold">{toastMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <QrCode className="text-blue-600" size={28} />
            <span>E-Invoice Gateway (IRP)</span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Generate, track, and cancel GST Invoice Reference Numbers (IRN) with full real-time compliance.
          </p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto overflow-x-auto">
          {[
            { id: 'CONSOLE', label: 'E-Invoice Console' },
            { id: 'REGISTRY', label: 'IRN Registry' },
            { id: 'BULK', label: 'Bulk Generation' },
            { id: 'LOOKUP', label: 'Search & Verification' },
            { id: 'CONNECTIVITY', label: 'IRP Gateway Settings' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-white text-blue-600 shadow-xs border border-slate-200/50' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Metric Cards Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active IRNs', count: metrics.activeIrns, sub: 'Legally Valid', color: 'text-green-600 border-green-200 bg-green-50/40' },
          { label: 'Cancelled IRNs', count: metrics.cancelledIrns, sub: 'Revoked on Gateway', color: 'text-amber-600 border-amber-200 bg-amber-50/40' },
          { label: 'Failed IRNs', count: metrics.failedIrns, sub: 'Needs In-Line Fix', color: 'text-red-600 border-red-200 bg-red-50/40' },
          { label: 'Pending IRNs', count: metrics.pendingIrns, sub: 'Awaiting Generation', color: 'text-blue-600 border-blue-200 bg-blue-50/40' }
        ].map((met, idx) => (
          <div key={idx} className={`p-4 rounded-xl border shadow-xs flex items-center justify-between ${met.color}`}>
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{met.label}</span>
              <p className="text-2xl font-black text-slate-800">{met.count}</p>
              <p className="text-[10px] font-bold text-slate-400">{met.sub}</p>
            </div>
            <div className="p-2 bg-white rounded-lg border border-slate-200/40 shadow-xs">
              <QrCode size={20} className="text-slate-400" />
            </div>
          </div>
        ))}
      </div>

      {/* MAIN CONTAINER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* TAB 1: CONSOLE VIEW */}
        {activeTab === 'CONSOLE' && (
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">Pending Actions</h3>
                <p className="text-xs text-slate-500 mt-0.5">Generate IRN or resolve errors for sales documents.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // Quick batch generate all eligible pendings
                    const pendingIds = eligibleInvoices.filter(i => i.status === 'PENDING').map(i => i.id);
                    if (pendingIds.length === 0) {
                      showToast('No pending invoices to generate E-Invoices for.', 'ERROR');
                      return;
                    }
                    pendingIds.forEach(id => generateIrn(id));
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Zap size={14} />
                  <span>Auto-Generate All Pending</span>
                </button>
              </div>
            </div>

            {consoleInvoices.length === 0 ? (
              <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <ShieldCheck size={40} className="text-green-500 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700 mt-3">All Invoices Fully Registered</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">There are no pending or failed sales invoices awaiting E-Invoicing actions.</p>
              </div>
            ) : (
              <div className="overflow-hidden border border-slate-200 rounded-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-200">
                        <th className="p-4 uppercase tracking-wider">Doc Number / Date</th>
                        <th className="p-4 uppercase tracking-wider">Party / GSTIN</th>
                        <th className="p-4 uppercase tracking-wider">Place of Supply</th>
                        <th className="p-4 uppercase tracking-wider text-right">Taxable / Tax Amount</th>
                        <th className="p-4 uppercase tracking-wider">E-Invoice Status</th>
                        <th className="p-4 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedConsoleInvoices.map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-bold">
                            <p className="text-slate-800">{inv.invoiceNumber}</p>
                            <p className="text-slate-400 text-[10px]">{inv.date}</p>
                          </td>
                          <td className="p-4">
                            <p className="font-bold text-slate-800">{inv.partyName}</p>
                            <p className="font-mono text-slate-400 text-[10px]">{inv.gstin || 'EXPORT (UNREGISTERED)'}</p>
                          </td>
                          <td className="p-4">
                            <span className="font-semibold text-slate-700">{inv.placeOfSupply || 'Export'}</span>
                          </td>
                          <td className="p-4 text-right font-bold">
                            <p className="text-slate-800">₹{inv.amount.toLocaleString()}</p>
                            <p className="text-slate-400 text-[10px]">₹{inv.taxAmount.toLocaleString()}</p>
                          </td>
                          <td className="p-4">
                            {inv.status === 'FAILED' ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-200">
                                  <AlertTriangle size={10} />
                                  FAILED
                                </span>
                                <p className="text-[10px] text-red-600 font-semibold max-w-[200px] truncate" title={inv.irnError}>
                                  {inv.irnError}
                                </p>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-700 border border-blue-200">
                                <RefreshCw size={10} className="animate-spin" />
                                PENDING IRP
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right space-x-2">
                            <button
                              onClick={() => openStatutoryQrModal(inv)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1 inline-flex shadow-2xs"
                              title="Generate and inspect compliant QR Code"
                            >
                              <QrCode size={12} className="text-blue-600" />
                              <span>QR Code</span>
                            </button>
                            {inv.status === 'FAILED' ? (
                              <button
                                onClick={() => openRetryModal(inv)}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-extrabold text-[11px] rounded-lg shadow-xs transition-colors flex items-center gap-1 inline-flex"
                              >
                                <Edit3 size={11} />
                                <span>Resolve & Retry</span>
                              </button>
                            ) : (
                              <button
                                disabled={generatingId === inv.id}
                                onClick={() => generateIrn(inv.id)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white font-extrabold text-[11px] rounded-lg shadow-xs transition-colors flex items-center gap-1 inline-flex"
                              >
                                {generatingId === inv.id ? (
                                  <RefreshCw size={11} className="animate-spin" />
                                ) : (
                                  <Zap size={11} />
                                )}
                                <span>Generate IRN</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <EInvoicePagination
                  currentPage={consoleCurrentPage}
                  totalItems={consoleTotalItems}
                  pageSize={consolePageSize}
                  onPageChange={setConsoleCurrentPage}
                  onPageSizeChange={setConsolePageSize}
                  itemLabel="pending actions"
                  pageSizeOptions={[5, 10, 20, 50]}
                />
              </div>
            )}
          </div>
        )}

        {/* TAB 2: REGISTRY */}
        {activeTab === 'REGISTRY' && (
          <div className="p-6 space-y-4">
            {/* Search Filters Row */}
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Invoice, Party, GSTIN, or IRN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 h-10 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <span className="text-xs font-bold text-slate-400">IRN Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active / Signed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="FAILED">Failed</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>
            </div>

            {registryInvoices.length === 0 ? (
              <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <AlertCircle size={40} className="text-slate-400 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700 mt-3">No Records Found</h4>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search keywords.</p>
              </div>
            ) : (
              <div className="overflow-hidden border border-slate-200 rounded-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-200">
                        <th className="p-4 uppercase tracking-wider">Doc Number</th>
                        <th className="p-4 uppercase tracking-wider">Party / GSTIN</th>
                        <th className="p-4 uppercase tracking-wider">IRN Hash (64-Char)</th>
                        <th className="p-4 uppercase tracking-wider text-right">Invoice Value</th>
                        <th className="p-4 uppercase tracking-wider">Status</th>
                        <th className="p-4 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedRegistryInvoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-bold">
                          <p className="text-slate-800">{inv.invoiceNumber}</p>
                          <p className="text-slate-400 text-[10px]">{inv.date}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-slate-800">{inv.partyName}</p>
                          <p className="font-mono text-slate-400 text-[10px]">{inv.gstin || 'EXPORT'}</p>
                        </td>
                        <td className="p-4">
                          {inv.irn ? (
                            <div className="flex items-center gap-1.5 max-w-[200px]">
                              <p className="font-mono text-[10px] text-slate-600 truncate">{inv.irn}</p>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(inv.irn || '');
                                  showToast('IRN copied to clipboard');
                                }}
                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                                title="Copy full IRN"
                              >
                                <FileText size={12} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-300 font-bold">---</span>
                          )}
                        </td>
                        <td className="p-4 text-right font-bold text-slate-800">
                          ₹{(inv.amount + inv.taxAmount).toLocaleString()}
                        </td>
                        <td className="p-4">
                          {inv.status === 'UPLOADED' && inv.irnStatus !== 'CANCELLED' ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-green-100 text-green-700 border border-green-200">
                                <CheckCircle2 size={10} />
                                ACTIVE (SIGNED)
                              </span>
                              {(() => {
                                const timeStatus = getIrnCancellationTimeStatus(inv);
                                if (timeStatus) {
                                  if (timeStatus.isExpired) {
                                    return <p className="text-[9px] text-slate-400 font-bold flex items-center gap-0.5">🔒 Cancel window closed</p>;
                                  } else {
                                    return <p className="text-[9px] text-amber-600 font-extrabold animate-pulse flex items-center gap-0.5">⏰ {timeStatus.hoursLeft}h left to cancel</p>;
                                  }
                                }
                                return null;
                              })()}
                            </div>
                          ) : inv.status === 'UPLOADED' && inv.irnStatus === 'CANCELLED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-200">
                              <X size={10} />
                              CANCELLED
                            </span>
                          ) : inv.status === 'FAILED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-200">
                              <AlertTriangle size={10} />
                              FAILED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                              <Calendar size={10} />
                              PENDING
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right space-x-1.5">
                          <button
                            onClick={() => openStatutoryQrModal(inv)}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 shadow-2xs"
                            title="Generate & Inspect Statutory QR Code (Rule 48(4))"
                          >
                            <QrCode size={13} />
                            <span className="hidden xl:inline text-[10px]">QR Code</span>
                          </button>
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all"
                            title="View E-Invoice Details"
                          >
                            <Eye size={13} />
                          </button>

                          {inv.irn && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedInvoice(inv);
                                  setIsQrModalOpen(true);
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all"
                                title="Print QR Code"
                              >
                                <Printer size={13} />
                              </button>
                              <button
                                onClick={() => downloadSignedJson(inv)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all"
                                title="Download Signed JSON"
                              >
                                <Download size={13} />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <EInvoicePagination
                currentPage={registryCurrentPage}
                totalItems={registryTotalItems}
                pageSize={registryPageSize}
                onPageChange={setRegistryCurrentPage}
                onPageSizeChange={setRegistryPageSize}
                itemLabel="e-invoices"
                pageSizeOptions={[5, 10, 20, 50, 100]}
              />
            </div>
          )}
        </div>
      )}

        {/* TAB 3: BULK GENERATION */}
        {activeTab === 'BULK' && (
          <div className="p-6 space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-base font-bold text-slate-800">Bulk E-Invoice Upload</h3>
              <p className="text-xs text-slate-500 mt-0.5">Import multiple invoices via CSV and batch generate IRN/E-Invoices.</p>
            </div>

            {bulkUploadStep === 1 ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleCSVUpload}
                  accept=".csv,.json"
                  className="hidden"
                />
                <div className="bg-blue-50 p-4 rounded-full inline-flex text-blue-600 group-hover:scale-105 transition-transform duration-200 shadow-inner">
                  <Upload size={32} />
                </div>
                <h4 className="font-bold text-slate-800 text-sm mt-4">Drag and Drop CSV or JSON files</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Vite-compliant file parser verifies HSN structure, party GSTINs, and tax values before queuing IRN.
                </p>
                <button
                  type="button"
                  className="mt-6 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-sm"
                >
                  Browse File
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="text-blue-600" size={18} />
                    <span className="text-xs font-bold text-slate-800">{bulkFiles?.name}</span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-black">
                      {bulkParsedData.filter(r => r.status === 'VALID').length} Eligible Row(s)
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setBulkUploadStep(1)}
                      className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
                    >
                      Cancel Import
                    </button>
                    <button
                      onClick={executeBulkGeneration}
                      disabled={isBulkValidating || bulkParsedData.filter(r => r.status === 'VALID').length === 0}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center gap-1.5"
                    >
                      {isBulkValidating ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Zap size={14} />
                      )}
                      <span>Bulk Generate E-Invoices</span>
                    </button>
                  </div>
                </div>

                {/* Pre-validation Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Doc No</th>
                        <th className="p-3">Party Name</th>
                        <th className="p-3">GSTIN</th>
                        <th className="p-3 text-right">Value (₹)</th>
                        <th className="p-3">HSN Code</th>
                        <th className="p-3">Import Pre-Validation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bulkParsedData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/20">
                          <td className="p-3 font-bold text-slate-800">{row.invoiceNumber}</td>
                          <td className="p-3 text-slate-600 font-medium">{row.partyName}</td>
                          <td className="p-3 font-mono text-[10px] text-slate-500">{row.gstin || 'EXPORT (URP)'}</td>
                          <td className="p-3 text-right font-bold text-slate-800">₹{row.amount.toLocaleString()}</td>
                          <td className="p-3 font-mono text-slate-500">{row.hsn || <span className="text-red-500 font-bold">MISSING</span>}</td>
                          <td className="p-3">
                            {row.status === 'VALID' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                                <CheckCircle2 size={10} /> Valid Record
                              </span>
                            ) : (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                  <AlertCircle size={10} /> Errors Found
                                </span>
                                {row.errors.map((err: string, i: number) => (
                                  <p key={i} className="text-[10px] text-red-500 font-bold pl-1">* {err}</p>
                                ))}
                              </div>
                            )}
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

        {/* TAB 4: LOOKUP & SEARCH */}
        {activeTab === 'LOOKUP' && (
          <div className="p-6 space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-base font-bold text-slate-800">Verify IRN Details</h3>
              <p className="text-xs text-slate-500 mt-0.5">Query the IRP registry by entering a 64-character IRN hash or Tax Document Number.</p>
            </div>

            <form onSubmit={handleIRNLookup} className="flex gap-2 max-w-xl">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter IRN Hash (e.g., 35054cc...) or Invoice No..."
                  value={lookupQuery}
                  onChange={(e) => setLookupQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 h-10 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-blue-500 transition-colors font-mono"
                />
              </div>
              <button
                type="submit"
                className="px-6 h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all whitespace-nowrap"
              >
                Search Registry
              </button>
            </form>

            {/* Error Message */}
            {lookupError && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs font-bold flex items-center gap-2 max-w-xl">
                <AlertCircle size={16} className="text-red-600" />
                <span>{lookupError}</span>
              </div>
            )}

            {/* Search Result */}
            {lookupResult && (
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 max-w-3xl">
                <div className="flex justify-between items-start border-b border-slate-200 pb-4 flex-wrap gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Matched Document Details</h4>
                    <p className="text-lg font-black text-slate-800 mt-0.5">{lookupResult.invoiceNumber}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                    lookupResult.irnStatus === 'CANCELLED' 
                      ? 'bg-amber-100 text-amber-700 border-amber-200' 
                      : 'bg-green-100 text-green-700 border-green-200'
                  }`}>
                    {lookupResult.irnStatus === 'CANCELLED' ? 'CANCELLED (VOID)' : 'ACTIVE (SIGNED)'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="font-bold text-slate-400">Seller GSTIN</p>
                    <p className="font-mono font-black text-slate-700 mt-0.5">{tenantId === 't1' ? '27ABCDE1234F1Z5' : '04XYZZZ9876L1Z1'}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-400">Buyer / Party Legal Name</p>
                    <p className="font-bold text-slate-700 mt-0.5">{lookupResult.partyName}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-400">Buyer GSTIN</p>
                    <p className="font-mono font-black text-slate-700 mt-0.5">{lookupResult.gstin || 'URP'}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-400">Place of Supply</p>
                    <p className="font-bold text-slate-700 mt-0.5">{lookupResult.placeOfSupply || 'Export Out of India'}</p>
                  </div>
                  <div className="sm:col-span-2 border-t border-slate-200/50 pt-4">
                    <p className="font-bold text-slate-400">Signed IRN (64-character payload)</p>
                    <p className="font-mono text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 mt-1 select-all break-all leading-relaxed">
                      {lookupResult.irn}
                    </p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-400">Ack No.</p>
                    <p className="font-semibold text-slate-700 mt-0.5">{lookupResult.ackNo}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-400">Ack Date</p>
                    <p className="font-semibold text-slate-700 mt-0.5">{lookupResult.ackDate ? new Date(lookupResult.ackDate).toLocaleString() : '---'}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 justify-end">
                  <button
                    onClick={() => openStatutoryQrModal(lookupResult)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold shadow-sm flex items-center gap-1.5"
                  >
                    <QrCode size={14} className="text-blue-400" />
                    <span>Statutory QR Code</span>
                  </button>
                  <button
                    onClick={() => downloadSignedJson(lookupResult)}
                    className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1"
                  >
                    <DownloadCloud size={14} />
                    <span>Download signed JSON</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedInvoice(lookupResult);
                      setIsQrModalOpen(true);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold shadow-sm flex items-center gap-1"
                  >
                    <Printer size={14} />
                    <span>Print QR & Invoice</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* DETAILED VIEW DRAWER (SIDE MODAL) */}
      <AnimatePresence>
        {selectedInvoice && !isCancelModalOpen && !isQrModalOpen && (
          <div className="fixed inset-0 z-[100] overflow-hidden flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedInvoice(null)}
              className="absolute inset-0 bg-black/60"
            />
            {/* Drawer Content */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col z-50 text-xs"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div>
                  <span className="text-[10px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {selectedInvoice.type} Document
                  </span>
                  <h3 className="text-lg font-black text-slate-800 mt-1">{selectedInvoice.invoiceNumber}</h3>
                </div>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Drawer Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* 1. IRN / Ack Summary */}
                {selectedInvoice.irn ? (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-200/50 pb-2 flex-wrap gap-2">
                      <span className="font-extrabold text-slate-800">E-Invoice Registration Info</span>
                      <div className="flex items-center gap-1.5">
                        {/* Time status warning */}
                        {(() => {
                          const timeStatus = getIrnCancellationTimeStatus(selectedInvoice);
                          if (!timeStatus) return null;
                          if (timeStatus.isExpired) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[9px] font-extrabold border border-slate-200" title="Prohibits standard Gateway Cancellation">
                                <AlertTriangle size={8} /> 24h Window Expired
                              </span>
                            );
                          } else {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-black border border-amber-200 animate-pulse">
                                <AlertCircle size={8} /> {timeStatus.hoursLeft}h Left to Cancel
                              </span>
                            );
                          }
                        })()}
                        
                        {selectedInvoice.irnStatus !== 'CANCELLED' && (
                          <button
                            onClick={async () => {
                              try {
                                const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
                                await updateInvoice(selectedInvoice.id, { ackDate: twoDaysAgo }, 'Simulated time travel for E-Invoice');
                                queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
                                setSelectedInvoice(prev => prev ? { ...prev, ackDate: twoDaysAgo } : null);
                                showToast('Time travel successful! Registration shifted to 48 hours ago.');
                              } catch (err: any) {
                                showToast(err.message || 'Time travel failed', 'ERROR');
                              }
                            }}
                            className="px-2 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-[9px] font-bold cursor-pointer"
                            title="Set Ack Date to 48 hours ago to test the 24-hour block"
                          >
                            ⏰ Set past 24h
                          </button>
                        )}

                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                          selectedInvoice.irnStatus === 'CANCELLED' 
                            ? 'bg-amber-100 text-amber-700 border-amber-200' 
                            : 'bg-green-100 text-green-700 border-green-200'
                        }`}>
                          {selectedInvoice.irnStatus === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-slate-400 font-bold">Ack Number</p>
                        <p className="text-slate-800 font-extrabold">{selectedInvoice.ackNo}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-bold">Ack Date</p>
                        <p className="text-slate-800 font-extrabold">
                          {selectedInvoice.ackDate ? new Date(selectedInvoice.ackDate).toLocaleString() : '---'}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2">
                      <p className="text-slate-400 font-bold">Signed IRN Hash</p>
                      <p className="font-mono text-[10px] bg-white p-2 border border-slate-200 rounded-lg text-slate-600 select-all break-all leading-relaxed">
                        {selectedInvoice.irn}
                      </p>
                    </div>

                    {selectedInvoice.irnStatus === 'CANCELLED' && (
                      <div className="border-t border-red-100 pt-2 bg-red-50/50 -mx-4 -mb-4 p-4 rounded-b-xl border">
                        <p className="text-red-800 font-extrabold flex items-center gap-1 text-[10px]">
                          <AlertTriangle size={12} />
                          IRN CANCELLED DETAILS
                        </p>
                        <p className="text-slate-600 font-bold mt-1">Reason: <span className="uppercase">{selectedInvoice.irnCancellationReason}</span></p>
                        {selectedInvoice.irnCancellationRemarks && (
                          <p className="text-slate-500 font-medium mt-0.5">Remarks: {selectedInvoice.irnCancellationRemarks}</p>
                        )}
                        <p className="text-slate-400 text-[10px] mt-1">Cancelled At: {selectedInvoice.irnCancelledAt ? new Date(selectedInvoice.irnCancelledAt).toLocaleString() : '---'}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-3">
                    <AlertTriangle className="text-amber-600 shrink-0" size={20} />
                    <div>
                      <p className="font-extrabold text-amber-800">IRN Not Registered</p>
                      <p className="text-slate-600 text-[11px] mt-0.5">This document hasn't been synced to the IRP E-invoice Portal yet.</p>
                    </div>
                  </div>
                )}

                {/* Visual IRN Hashing Lineage (Collapsible Inspector) */}
                {selectedInvoice.irn && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <h5 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wide flex items-center gap-1">
                      <Zap size={14} className="text-blue-600" />
                      <span>IRN Hashing Lineage (NIC Standard)</span>
                    </h5>
                    <p className="text-[10px] text-slate-500 leading-normal font-semibold">
                      The official GST Invoice Reference Number (IRN) is calculated by concatenating Supplier GSTIN, Financial Year, Document Type, and Invoice Number, then executing a 256-bit secure cryptographic SHA-256 hash.
                    </p>
                    
                    <div className="space-y-2 text-[10px] font-mono leading-relaxed bg-white p-3 border border-slate-200 rounded-lg">
                      <div className="grid grid-cols-3 border-b border-slate-100 pb-1 text-slate-400 font-bold">
                        <span>Parameter</span>
                        <span className="col-span-2">Value Used</span>
                      </div>
                      <div className="grid grid-cols-3">
                        <span className="text-slate-400">1. Supplier GSTIN:</span>
                        <span className="col-span-2 text-slate-800 font-bold">
                          {selectedInvoice.supplierGstin || (selectedInvoice.tenantId === 't1' ? '27ABCDE1234F1Z5' : '04XYZZZ9876L1Z1')}
                        </span>
                      </div>
                      <div className="grid grid-cols-3">
                        <span className="text-slate-400">2. Financial Year:</span>
                        <span className="col-span-2 text-slate-800 font-bold">
                          {(() => {
                            const d = new Date(selectedInvoice.date);
                            const m = d.getMonth() + 1;
                            const y = d.getFullYear();
                            return m >= 4 ? `${y}-${(y + 1).toString().substring(2)}` : `${y - 1}-${y.toString().substring(2)}`;
                          })()}
                        </span>
                      </div>
                      <div className="grid grid-cols-3">
                        <span className="text-slate-400">3. Document Type:</span>
                        <span className="col-span-2 text-slate-800 font-extrabold">{selectedInvoice.docType || 'INV'}</span>
                      </div>
                      <div className="grid grid-cols-3 border-b border-slate-100 pb-1">
                        <span className="text-slate-400">4. Invoice No:</span>
                        <span className="col-span-2 text-slate-800 font-bold">{selectedInvoice.invoiceNumber}</span>
                      </div>
                      
                      <div className="pt-1.5 space-y-1">
                        <p className="text-slate-400 font-bold">Concatenated Input String:</p>
                        <p className="p-2 bg-slate-50 rounded border border-slate-200/50 text-slate-600 font-bold select-all break-all leading-normal text-[9px]">
                          {(() => {
                            const sg = selectedInvoice.supplierGstin || (selectedInvoice.tenantId === 't1' ? '27ABCDE1234F1Z5' : '04XYZZZ9876L1Z1');
                            const d = new Date(selectedInvoice.date);
                            const m = d.getMonth() + 1;
                            const y = d.getFullYear();
                            const fy = m >= 4 ? `${y}-${(y + 1).toString().substring(2)}` : `${y - 1}-${y.toString().substring(2)}`;
                            const dt = selectedInvoice.docType || 'INV';
                            return `${sg}${fy}${dt}${selectedInvoice.invoiceNumber}`;
                          })()}
                        </p>
                      </div>

                      <div className="pt-1.5 space-y-1">
                        <p className="text-slate-400 font-bold">SHA-256 Digest Output (IRN):</p>
                        <p className="p-2 bg-blue-50/50 text-blue-900 rounded border border-blue-100 font-black select-all break-all leading-normal text-[9px]">
                          {selectedInvoice.irn}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Customer & Place of Supply */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Party / Transaction Info</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-slate-400 font-bold">Party Name</p>
                      <p className="text-slate-700 font-extrabold mt-0.5">{selectedInvoice.partyName}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-bold">Party GSTIN</p>
                      <p className="font-mono font-extrabold text-slate-700 mt-0.5">{selectedInvoice.gstin || 'EXPORT (UNREGISTERED)'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-bold">Place Of Supply</p>
                      <p className="text-slate-700 font-bold mt-0.5">{selectedInvoice.placeOfSupply || 'Export'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-bold">Document Type</p>
                      <p className="text-slate-700 font-bold mt-0.5 uppercase">{selectedInvoice.docType}</p>
                    </div>
                  </div>
                </div>

                {/* 3. Items breakdown */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Line Items</h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 text-slate-500 font-bold">
                        <tr>
                          <th className="p-3">Description</th>
                          <th className="p-3">HSN</th>
                          <th className="p-3 text-right">Taxable</th>
                          <th className="p-3 text-right">GST</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedInvoice.items?.map((it, idx) => (
                          <tr key={idx}>
                            <td className="p-3 font-semibold text-slate-700">{it.description}</td>
                            <td className="p-3 font-mono text-slate-500">{it.hsnSac}</td>
                            <td className="p-3 text-right font-bold text-slate-700">₹{it.taxableValue.toLocaleString()}</td>
                            <td className="p-3 text-right font-bold text-slate-700">{it.taxRate}%</td>
                          </tr>
                        )) || (
                          <tr>
                            <td colSpan={4} className="p-3 text-center text-slate-400">No items registered</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. Totals Summary */}
                <div className="border-t border-slate-100 pt-4 space-y-2">
                  <div className="flex justify-between font-bold text-slate-500">
                    <span>Taxable Amount</span>
                    <span>₹{selectedInvoice.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-500">
                    <span>Integrated Tax (IGST)</span>
                    <span>₹{(selectedInvoice.taxDetails?.igst || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-500">
                    <span>Central + State (CGST + SGST)</span>
                    <span>₹{((selectedInvoice.taxDetails?.cgst || 0) + (selectedInvoice.taxDetails?.sgst || 0)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-slate-800 border-t border-slate-200 pt-2">
                    <span>Invoice Grand Total</span>
                    <span>₹{(selectedInvoice.amount + selectedInvoice.taxAmount).toLocaleString()}</span>
                  </div>
                </div>

                {/* 5. IRN History timeline */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <History size={14} />
                    <span>IRN Gateway Timeline</span>
                  </h4>
                  <div className="relative border-l-2 border-slate-100 ml-2 pl-4 py-1 space-y-4">
                    {selectedInvoice.irnHistory?.map((hist, i) => (
                      <div key={i} className="relative">
                        <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-blue-600 border border-white" />
                        <div>
                          <p className="font-extrabold text-slate-800">{hist.action.replace('_', ' ')}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{new Date(hist.timestamp).toLocaleString()} | {hist.user}</p>
                          {hist.details && (
                            <p className="text-[10px] text-slate-500 font-medium bg-slate-50 p-2 border border-slate-100 rounded-lg mt-1">{hist.details}</p>
                          )}
                        </div>
                      </div>
                    )) || (
                      <div className="relative">
                        <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-slate-300 border border-white" />
                        <p className="text-slate-400 font-bold">Awaiting primary Gateway transaction log...</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Drawer Footer Actions */}
              <div className="p-6 border-t border-slate-200 bg-slate-50 flex gap-2 justify-end flex-wrap">
                <button
                  onClick={() => openStatutoryQrModal(selectedInvoice)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <QrCode size={14} className="text-blue-400" />
                  <span>Statutory QR Code</span>
                </button>
                {selectedInvoice.irn ? (
                  <>
                    {selectedInvoice.irnStatus !== 'CANCELLED' && (
                      <button
                        onClick={() => setIsCancelModalOpen(true)}
                        className="px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 rounded-xl font-bold"
                      >
                        Cancel IRN (IRP Gateway)
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setIsQrModalOpen(true);
                      }}
                      className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-bold flex items-center gap-1.5"
                    >
                      <Printer size={14} />
                      <span>Print Tax Invoice</span>
                    </button>
                    <button
                      onClick={() => downloadSignedJson(selectedInvoice)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-extrabold shadow-sm flex items-center gap-1.5"
                    >
                      <Download size={14} />
                      <span>Download JSON</span>
                    </button>
                  </>
                ) : (
                  <button
                    disabled={generatingId === selectedInvoice.id}
                    onClick={() => generateIrn(selectedInvoice.id)}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white rounded-xl font-extrabold shadow-md flex items-center gap-1.5"
                  >
                    {generatingId === selectedInvoice.id ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Zap size={14} />
                    )}
                    <span>Generate IRN</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CANCELLATION MODAL */}
      <AnimatePresence>
        {isCancelModalOpen && selectedInvoice && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCancelModalOpen(false)}
              className="absolute inset-0 bg-black/60"
            />
            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-slate-200 z-50 text-xs space-y-4"
            >
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-1.5">
                  <X className="text-red-500" size={18} />
                  <span>Cancel Registered IRN</span>
                </h3>
                <button onClick={() => setIsCancelModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>

              {/* GST Rule reminder banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 font-bold leading-relaxed">
                ⚠️ GST India compliance rule: IRNs can only be cancelled within 24 hours of generation. After 24 hours, cancellation is blocked and an Amendment/Credit Note must be issued.
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500">Cancellation Reason *</label>
                  <select
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-700 outline-hidden"
                  >
                    <option value="DUPLICATE">1. Duplicate generation</option>
                    <option value="DATA_ENTRY_ERROR">2. Data entry mistake in values</option>
                    <option value="ORDER_CANCELLED">3. Order / Contract cancelled</option>
                    <option value="OTHER">4. Other reasons</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500">Remarks (Minimum 5 characters) *</label>
                  <textarea
                    placeholder="Provide detailed remarks..."
                    value={cancelRemarks}
                    onChange={(e) => setCancelRemarks(e.target.value)}
                    rows={3}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-700 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-100 pt-4">
                <button
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl font-bold hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  onClick={() => cancelIrn({ invoiceId: selectedInvoice.id, reason: cancelReason, remarks: cancelRemarks })}
                  disabled={cancellingId === selectedInvoice.id || cancelRemarks.length < 5}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-300 text-white rounded-xl font-extrabold shadow-sm flex items-center gap-1"
                >
                  {cancellingId === selectedInvoice.id ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                  <span>Void & Cancel IRN</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RESOLVE & RETRY INLINE MODAL */}
      <AnimatePresence>
        {isRetryModalOpen && selectedInvoice && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRetryModalOpen(false)}
              className="absolute inset-0 bg-black/60"
            />
            {/* Modal Body */}
            <motion.form
              onSubmit={handleResolveAndRetry}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-slate-200 z-50 text-xs space-y-4"
            >
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-1.5">
                  <Sliders className="text-blue-600" size={18} />
                  <span>In-Line Pre-Validation Audit</span>
                </h3>
                <button type="button" onClick={() => setIsRetryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>

              {/* Auto suggestion alerts based on error */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-800 font-bold space-y-1">
                <p className="flex items-center gap-1">
                  <AlertCircle size={14} className="text-red-600" />
                  IRP Pre-Validation Fail Reason:
                </p>
                <p className="font-mono text-[10px] text-red-700 bg-white p-2 rounded-lg border border-red-100 mt-1 leading-relaxed">
                  {selectedInvoice.irnError || 'IRP Gateway: Schema Pre-validation error.'}
                </p>
              </div>

              {/* Input corrections */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500">Correct Customer GSTIN (15-Characters)</label>
                  <input
                    type="text"
                    required
                    value={retryGstin}
                    onChange={(e) => setRetryGstin(e.target.value.toUpperCase())}
                    placeholder="Enter valid GSTIN..."
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-700 outline-hidden focus:border-blue-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400">Must match state code of Place of Supply.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-500">HSN/SAC Code</label>
                    <input
                      type="text"
                      required
                      value={retryHsn}
                      onChange={(e) => setRetryHsn(e.target.value)}
                      placeholder="e.g. 998313"
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-700 outline-hidden focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-500">Place of Supply (State)</label>
                    <input
                      type="text"
                      required
                      value={retryStateCode}
                      onChange={(e) => setRetryStateCode(e.target.value)}
                      placeholder="e.g. 27"
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-700 outline-hidden focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsRetryModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl font-bold hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={retryingId === selectedInvoice.id}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-extrabold shadow-sm flex items-center gap-1"
                >
                  {retryingId === selectedInvoice.id ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <Zap size={12} />
                  )}
                  <span>Validate & Regenerate</span>
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* PRINT QR CODE & TAX INVOICE MODAL */}
      <AnimatePresence>
        {isQrModalOpen && selectedInvoice && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 print:p-0 print:absolute print:inset-0">
            {/* Backdrop */}
            <div
              onClick={() => setIsQrModalOpen(false)}
              className="absolute inset-0 bg-black/60 print:hidden"
            />
            {/* Modal Body */}
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6 border border-slate-200 z-50 text-xs space-y-6 print:shadow-none print:border-none print:rounded-none">
              
              {/* Modal controls */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 print:hidden">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-1">
                  <Printer className="text-blue-600" size={18} />
                  <span>Official IRP Tax Invoice Print Preview</span>
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrint}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-lg flex items-center gap-1 text-[11px]"
                  >
                    <Printer size={13} /> Print
                  </button>
                  <button onClick={() => setIsQrModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* PRINT CONTAINER */}
              <div className="relative border border-slate-300 p-6 space-y-4 rounded-xl print:border-none print:p-0 overflow-hidden" id="print-area">
                {/* Cancelled Watermark Stamp */}
                {selectedInvoice.irnStatus === 'CANCELLED' && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-10 opacity-[0.08]">
                    <div className="text-red-600 border-[16px] border-red-600 text-6xl font-black px-12 py-6 rounded-3xl transform -rotate-45 uppercase tracking-widest whitespace-nowrap">
                      VOID / CANCELLED
                    </div>
                  </div>
                )}
                {/* Header Row */}
                <div className="flex justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h1 className="text-sm font-black text-slate-800">TAX INVOICE</h1>
                    <p className="text-slate-500 font-bold mt-1">Rule 54 - GST e-Invoicing Compliance</p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-slate-800">Acme Corporation</p>
                    <p className="text-slate-400">GSTIN: 27ABCDE1234F1Z5</p>
                    <p className="text-slate-400">Maharashtra (27)</p>
                  </div>
                </div>

                {/* Buyer / Invoice info */}
                <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <p className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Bill To / Buyer</p>
                    <p className="font-extrabold text-slate-800 mt-1">{selectedInvoice.partyName}</p>
                    <p className="text-slate-500 mt-0.5">GSTIN: {selectedInvoice.gstin || 'URP'}</p>
                    <p className="text-slate-500">Place of Supply: {selectedInvoice.placeOfSupply}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-slate-500">Invoice No: <span className="font-extrabold text-slate-800">{selectedInvoice.invoiceNumber}</span></p>
                    <p className="text-slate-500">Invoice Date: <span className="font-semibold text-slate-800">{selectedInvoice.date}</span></p>
                    <p className="text-slate-500">Ack No: <span className="font-semibold text-slate-800">{selectedInvoice.ackNo}</span></p>
                    <p className="text-slate-500">Ack Date: <span className="font-semibold text-slate-800">{selectedInvoice.ackDate ? new Date(selectedInvoice.ackDate).toISOString().split('T')[0] : '---'}</span></p>
                  </div>
                </div>

                {/* QR Code and IRN Block */}
                <div className="flex flex-col sm:flex-row gap-6 items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="bg-white p-2 rounded-lg border border-slate-300">
                    <QRCodeSVG 
                      value={selectedInvoice.qrCodeUrl || `IRN:${selectedInvoice.irn}|ACK:${selectedInvoice.ackNo}|DATE:${selectedInvoice.ackDate}`} 
                      size={120} 
                    />
                  </div>
                  <div className="flex-1 space-y-2 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="text-green-600 shrink-0" size={16} />
                      <span className="font-black text-green-700">IRP Authenticated Signed QR Code</span>
                    </div>
                    <p className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">Invoice Reference Number (IRN)</p>
                    <p className="font-mono text-[10px] text-slate-600 bg-white p-2 border border-slate-200 rounded-lg select-all break-all leading-normal">
                      {selectedInvoice.irn}
                    </p>
                  </div>
                </div>

                {/* IRP QR Code Decoder Panel */}
                {selectedInvoice.qrCodeUrl && selectedInvoice.qrCodeUrl.includes('.') && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden print:hidden bg-slate-50/60 text-[11px] space-y-3 p-4">
                    <div className="flex justify-between items-center border-b border-slate-200/60 pb-2 flex-wrap gap-2">
                      <span className="font-black text-slate-800 uppercase tracking-wide flex items-center gap-1">
                        <ShieldCheck size={15} className="text-green-600" />
                        <span>IRP Signed QR Decoder & Audit</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black bg-green-100 text-green-700 border border-green-200">
                        Verified Key: NIC_RS256_V1
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-500 leading-normal font-semibold">
                      This e-invoice QR code contains a Base64-encoded JWT payload signed using the private key of the IRP Portal (NIC India). Below is the raw parsed metadata extracted directly from the digital signature.
                    </p>

                    {(() => {
                      const decoded = decodeQRJwt(selectedInvoice.qrCodeUrl);
                      if (!decoded) return <p className="text-red-500 font-bold font-mono">Error: Invalid Signed JWT Structure.</p>;
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 bg-white p-3 rounded-lg border border-slate-200/80 text-[11px] font-mono leading-relaxed text-slate-600">
                          <div>
                            <span className="text-slate-400">Supplier GSTIN:</span> <span className="text-slate-800 font-extrabold">{decoded.sellerGstin}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Buyer GSTIN:</span> <span className="text-slate-800 font-extrabold">{decoded.buyerGstin}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Invoice Number:</span> <span className="text-slate-800 font-bold">{decoded.docNo}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Invoice Date:</span> <span className="text-slate-800 font-bold">{decoded.docDt}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Total Value (INR):</span> <span className="text-slate-800 font-black">₹{decoded.totVal?.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Item Count:</span> <span className="text-slate-800 font-semibold">{decoded.itemCount} item(s)</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Principal HSN:</span> <span className="text-slate-800 font-bold">{decoded.mainHsn}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Ack Number:</span> <span className="text-slate-800 font-bold">{decoded.ackNo}</span>
                          </div>
                          <div className="sm:col-span-2 border-t border-slate-100 pt-2 text-[10px] leading-normal text-slate-400 flex flex-col gap-1">
                            <div>
                              <span className="font-bold text-slate-500">IRN Signature payload (SHA256withRSA):</span>
                            </div>
                            <div className="bg-slate-50 p-2 border border-slate-200/50 rounded break-all select-all text-slate-500 text-[9px] leading-normal">
                              {selectedInvoice.qrCodeUrl}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Items breakdown */}
                <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 text-slate-500 font-bold">
                      <tr>
                        <th className="p-3">Description</th>
                        <th className="p-3">HSN/SAC</th>
                        <th className="p-3 text-right">Taxable Value</th>
                        <th className="p-3 text-right">GST Rate</th>
                        <th className="p-3 text-right">CGST + SGST</th>
                        <th className="p-3 text-right">IGST</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedInvoice.items?.map((it, idx) => (
                        <tr key={idx}>
                          <td className="p-3 font-semibold text-slate-700">{it.description}</td>
                          <td className="p-3 font-mono text-slate-500">{it.hsnSac}</td>
                          <td className="p-3 text-right font-bold text-slate-700">₹{it.taxableValue.toLocaleString()}</td>
                          <td className="p-3 text-right font-bold text-slate-700">{it.taxRate}%</td>
                          <td className="p-3 text-right font-bold text-slate-700">
                            ₹{selectedInvoice.placeOfSupply === '27' ? (it.taxableValue * (it.taxRate / 100)).toLocaleString() : '0'}
                          </td>
                          <td className="p-3 text-right font-bold text-slate-700">
                            ₹{selectedInvoice.placeOfSupply !== '27' ? (it.taxableValue * (it.taxRate / 100)).toLocaleString() : '0'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals Table */}
                <div className="flex justify-end pt-4">
                  <div className="w-full sm:w-80 space-y-2 border-t border-slate-200 pt-2 text-xs">
                    <div className="flex justify-between font-bold text-slate-500">
                      <span>Total Taxable Value</span>
                      <span>₹{selectedInvoice.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-500">
                      <span>Total Tax Amount (GST)</span>
                      <span>₹{selectedInvoice.taxAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-slate-800 border-t border-slate-300 pt-1.5">
                      <span>Grand Total (INR)</span>
                      <span>₹{(selectedInvoice.amount + selectedInvoice.taxAmount).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Footer notes */}
                <div className="text-[9px] text-slate-400 mt-6 pt-4 border-t border-slate-200 text-center leading-normal">
                  This is a digitally signed computer generated tax document certified by the National Informatics Centre (NIC) IRP portal. No physical signatures are required.
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
      {/* STATUTORY E-INVOICE QR CODE GENERATOR & AUDIT MODAL */}
      <EInvoiceQrCodeModal
        isOpen={isStatutoryQrModalOpen}
        onClose={() => {
          setIsStatutoryQrModalOpen(false);
          setStatutoryQrInvoice(null);
        }}
        invoice={statutoryQrInvoice}
        tenantGstin={tenantId === 't1' ? '27ABCDE1234F1Z5' : '04XYZZZ9876L1Z1'}
        onGenerateIrn={(id) => generateIrn(id)}
      />
    </div>
  );
}
