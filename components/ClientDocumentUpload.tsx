import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Upload,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Search,
  Filter,
  Trash2,
  Eye,
  ArrowRight,
  RefreshCw,
  Clock,
  Layers,
  Building2,
  Camera,
  Check,
  X,
  Copy,
  ExternalLink,
  ChevronDown,
  Info,
  ShieldAlert,
  Percent,
  IndianRupee,
  FileSpreadsheet,
  Download,
  Send,
  HelpCircle,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CustomerMaster,
  loadCustomers
} from '../services/partyMasterService';
import {
  ClientUploadedDocument,
  ClientDocType,
  ClientDocStatus,
  DocumentCategorizationCheck,
  ExtractedDocLineItem
} from '../types';
import {
  fetchClientDocuments,
  uploadAndCategorizeClientDocument,
  previewCategorizeClientDocument,
  verifyAndPushClientDocument,
  deleteClientDocument
} from '../services/api';

interface ClientDocumentUploadProps {
  initialClientId?: string;
  onDocumentUploaded?: (doc: ClientUploadedDocument) => void;
  showHeader?: boolean;
}

export const ClientDocumentUpload: React.FC<ClientDocumentUploadProps> = ({
  initialClientId,
  onDocumentUploaded,
  showHeader = true
}) => {
  // Client selection state
  const [customers, setCustomers] = useState<CustomerMaster[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId || '');
  const [clientSearch, setClientSearch] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  // Upload Form State
  const [documentType, setDocumentType] = useState<ClientDocType>('PURCHASE_BILL');
  const [financialPeriod, setFinancialPeriod] = useState('October 2026');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [counterpartyName, setCounterpartyName] = useState('');
  const [counterpartyGstin, setCounterpartyGstin] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('27');
  const [itemDescription, setItemDescription] = useState('');
  const [claimedTaxRate, setClaimedTaxRate] = useState<number>(18);
  const [taxableAmount, setTaxableAmount] = useState<number>(50000);
  const [notes, setNotes] = useState('');

  // Line items state
  const [lineItems, setLineItems] = useState<Array<{
    description: string;
    hsnSac: string;
    quantity: number;
    unit: string;
    rate: number;
    taxRate: number;
    taxableValue: number;
  }>>([
    {
      description: 'Cloud Infrastructure & High-Availability Hosting',
      hsnSac: '998315',
      quantity: 1,
      unit: 'NOS',
      rate: 50000,
      taxRate: 18,
      taxableValue: 50000
    }
  ]);

  // File Upload & Drag State
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Processing & Categorization State
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [liveCategorization, setLiveCategorization] = useState<DocumentCategorizationCheck | null>(null);
  const [discrepancyAlerts, setDiscrepancyAlerts] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Document Vault / History State
  const [uploadedDocs, setUploadedDocs] = useState<ClientUploadedDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'ALL' | 'PURCHASE_BILL' | 'SALES_INVOICE' | 'FLAGGED'>('ALL');
  const [historySearch, setHistorySearch] = useState('');
  const [viewingDoc, setViewingDoc] = useState<ClientUploadedDocument | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Load clients
  useEffect(() => {
    const loaded = loadCustomers();
    setCustomers(loaded);
    if (!selectedClientId && loaded.length > 0) {
      setSelectedClientId(loaded[0].id);
      setPlaceOfSupply(loaded[0].stateCode || '27');
    }
  }, [initialClientId]);

  const selectedClient = useMemo(() => {
    return customers.find(c => c.id === selectedClientId) || customers[0] || null;
  }, [customers, selectedClientId]);

  // Fetch client documents whenever selected client changes
  const loadDocuments = async () => {
    if (!selectedClient) return;
    setIsLoadingDocs(true);
    try {
      const res = await fetchClientDocuments({ clientId: selectedClient.id });
      if (res && res.documents) {
        setUploadedDocs(res.documents);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (selectedClient) {
      loadDocuments();
      setPlaceOfSupply(selectedClient.stateCode || '27');
    }
  }, [selectedClient?.id]);

  // Preset Template loader
  const loadPresetTemplate = (type: 'AWS_CLOUD' | 'LEGAL_RCM' | 'STEEL_RAW' | 'MOTOR_CAR' | 'EXPORT_CONSULTING') => {
    switch (type) {
      case 'AWS_CLOUD':
        setDocumentType('PURCHASE_BILL');
        setCounterpartyName('Amazon Web Services India Pvt Ltd');
        setCounterpartyGstin('27AAACA9999P1Z1');
        setItemDescription('Enterprise Cloud Computing, Elastic Compute & S3 Hosting Services');
        setClaimedTaxRate(18);
        setTaxableAmount(75000);
        setLineItems([
          {
            description: 'AWS Enterprise Cloud Compute & Elastic Storage',
            hsnSac: '998315',
            quantity: 1,
            unit: 'MONTH',
            rate: 75000,
            taxRate: 18,
            taxableValue: 75000
          }
        ]);
        break;
      case 'LEGAL_RCM':
        setDocumentType('PURCHASE_BILL');
        setCounterpartyName('Apex Legal Advocates & Solicitors');
        setCounterpartyGstin('27AAAPA4444L1Z8');
        setItemDescription('Legal Representation and Advisory Services before High Court');
        setClaimedTaxRate(18);
        setTaxableAmount(120000);
        setLineItems([
          {
            description: 'Legal Consultancy & Court Representation Retainer',
            hsnSac: '998211',
            quantity: 1,
            unit: 'SRV',
            rate: 120000,
            taxRate: 18,
            taxableValue: 120000
          }
        ]);
        break;
      case 'STEEL_RAW':
        setDocumentType('PURCHASE_BILL');
        setCounterpartyName('Tata Steel Manufacturing Limited');
        setCounterpartyGstin('27AAACT2727Q1ZW');
        setItemDescription('Semi-finished Steel Billets & Structural MS Angles');
        setClaimedTaxRate(18);
        setTaxableAmount(350000);
        setLineItems([
          {
            description: 'Semi-finished products of iron or non-alloy steel (Billets)',
            hsnSac: '720719',
            quantity: 10,
            unit: 'MT',
            rate: 35000,
            taxRate: 18,
            taxableValue: 350000
          }
        ]);
        break;
      case 'MOTOR_CAR':
        setDocumentType('PURCHASE_BILL');
        setCounterpartyName('Mercedes-Benz Dealership Mumbai');
        setCounterpartyGstin('27AAACM8888D1Z2');
        setItemDescription('Luxury Executive Passenger Motor Vehicle (Capacity < 13 persons)');
        setClaimedTaxRate(28);
        setTaxableAmount(4500000);
        setLineItems([
          {
            description: 'Motor vehicles for transport of persons (Executive Sedan)',
            hsnSac: '870323',
            quantity: 1,
            unit: 'UNIT',
            rate: 4500000,
            taxRate: 28,
            taxableValue: 4500000
          }
        ]);
        break;
      case 'EXPORT_CONSULTING':
        setDocumentType('SALES_INVOICE');
        setCounterpartyName('Global Tech Ventures Inc, California USA');
        setCounterpartyGstin('UNREGISTERED_FOREIGN');
        setItemDescription('Export of Software Engineering & Architectural Advisory Services under LUT');
        setClaimedTaxRate(0);
        setTaxableAmount(250000);
        setLineItems([
          {
            description: 'Software Engineering Architecture & Design (Zero-rated LUT)',
            hsnSac: '998314',
            quantity: 1,
            unit: 'MONTH',
            rate: 250000,
            taxRate: 0,
            taxableValue: 250000
          }
        ]);
        break;
    }
  };

  // Run categorization check on change
  const runCategorizationCheck = async () => {
    setIsCategorizing(true);
    setErrorMessage(null);
    try {
      const desc = itemDescription || lineItems[0]?.description || 'General Business Supply';
      const preview = await previewCategorizeClientDocument({
        documentType,
        fileName: selectedFile?.name || 'document_upload.pdf',
        description: desc,
        claimedTaxRate,
        lineItems,
        clientStateCode: selectedClient?.stateCode || '27',
        placeOfSupply
      });

      setLiveCategorization(preview.categorization);
      setDiscrepancyAlerts(preview.discrepancies || []);
    } catch (err: any) {
      console.error('Categorization check failed:', err);
    } finally {
      setIsCategorizing(false);
    }
  };

  // Debounced auto-check
  useEffect(() => {
    const timer = setTimeout(() => {
      runCategorizationCheck();
    }, 600);
    return () => clearTimeout(timer);
  }, [itemDescription, claimedTaxRate, documentType, placeOfSupply, selectedClientId]);

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setFileDataUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // If invoice number is empty, auto-generate from file name
    if (!invoiceNumber) {
      const cleaned = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '-').toUpperCase();
      setInvoiceNumber(cleaned.slice(0, 16) || `INV-${Date.now().toString().slice(-6)}`);
    }
  };

  // Add line item
  const handleAddLineItem = () => {
    setLineItems(prev => [
      ...prev,
      {
        description: 'Additional Taxable Supply Line Item',
        hsnSac: '998313',
        quantity: 1,
        unit: 'NOS',
        rate: 10000,
        taxRate: 18,
        taxableValue: 10000
      }
    ]);
  };

  const handleRemoveLineItem = (idx: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleLineItemChange = (idx: number, field: string, value: any) => {
    setLineItems(prev => {
      const copy = [...prev];
      const item = { ...copy[idx], [field]: value };
      if (field === 'quantity' || field === 'rate') {
        item.taxableValue = (Number(item.quantity) || 1) * (Number(item.rate) || 0);
      }
      copy[idx] = item;
      return copy;
    });
  };

  // Submit and Upload Document
  const handleUploadDocument = async () => {
    if (!selectedClient) {
      setErrorMessage('Please select a registered client profile first.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const totalTaxable = lineItems.reduce((acc, i) => acc + (Number(i.taxableValue) || 0), 0);
      const desc = itemDescription || lineItems[0]?.description || 'Business Transaction Supply';

      const payload = {
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        clientGstin: selectedClient.gstin,
        clientStateCode: selectedClient.stateCode || '27',
        documentType,
        fileName: selectedFile?.name || `${documentType.toLowerCase()}_${Date.now()}.pdf`,
        fileSize: selectedFile?.size || 1024 * 450,
        fileType: selectedFile?.type || 'application/pdf',
        fileDataUrl,
        financialPeriod,
        invoiceNumber: invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
        invoiceDate,
        counterpartyName: counterpartyName || (documentType === 'PURCHASE_BILL' ? 'Vendor Supplier Ltd' : 'Client Customer Enterprise'),
        counterpartyGstin: counterpartyGstin || '27AABCT1332M1Z2',
        placeOfSupply,
        description: desc,
        claimedTaxRate,
        lineItems,
        notes
      };

      const result = await uploadAndCategorizeClientDocument(payload);
      if (result.success) {
        setSuccessMessage(`Document successfully uploaded and categorized! Status: ${result.document.uploadStatus}`);
        setUploadedDocs(prev => [result.document, ...prev]);
        if (onDocumentUploaded) {
          onDocumentUploaded(result.document);
        }
        // Reset file selection
        setSelectedFile(null);
        setFileDataUrl('');
        setInvoiceNumber('');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload document.');
    } finally {
      setIsUploading(false);
    }
  };

  // Verify and sync to main invoice ledger
  const handleVerifyAndSync = async (docId: string) => {
    try {
      const res = await verifyAndPushClientDocument(docId);
      if (res.success) {
        setUploadedDocs(prev => prev.map(d => d.id === docId ? res.document : d));
        if (viewingDoc && viewingDoc.id === docId) {
          setViewingDoc(res.document);
        }
        setSuccessMessage(`Document verified and added to main GST invoice register!`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to verify and push document.');
    }
  };

  // Delete document
  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document from the client profile?')) return;
    try {
      await deleteClientDocument(docId);
      setUploadedDocs(prev => prev.filter(d => d.id !== docId));
      if (viewingDoc && viewingDoc.id === docId) {
        setViewingDoc(null);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete document.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Filtered documents
  const filteredDocs = useMemo(() => {
    return uploadedDocs.filter(d => {
      if (activeHistoryTab === 'PURCHASE_BILL' && d.documentType !== 'PURCHASE_BILL') return false;
      if (activeHistoryTab === 'SALES_INVOICE' && d.documentType !== 'SALES_INVOICE') return false;
      if (activeHistoryTab === 'FLAGGED' && d.uploadStatus !== 'FLAGGED_ANOMALY') return false;
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        return (
          d.fileName.toLowerCase().includes(q) ||
          d.invoiceNumber?.toLowerCase().includes(q) ||
          d.counterpartyName?.toLowerCase().includes(q) ||
          d.categorization.suggestedHsnSac.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [uploadedDocs, activeHistoryTab, historySearch]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      {showHeader && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden border border-slate-800">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-bold border border-blue-400/30">
                <ShieldCheck size={14} className="text-blue-400" />
                <span>Client Document Vault & Smart GST Categorization Engine</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                Client Document Upload & Automated GST Classification
              </h1>
              <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
                Registered clients securely upload purchase and sales invoices directly to their profile. 
                Our AI tariff matcher instantly analyzes items, validates statutory HSN/SAC codes, flags tax rate discrepancies, and checks Section 17(5) ITC eligibility in real time.
              </p>
            </div>

            {/* Quick Profile Summary Badge */}
            {selectedClient && (
              <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 min-w-[280px] space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-semibold">Active Client Profile</span>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full font-bold text-[10px]">
                    {selectedClient.status}
                  </span>
                </div>
                <div className="font-bold text-white text-base truncate">{selectedClient.name}</div>
                <div className="text-xs text-blue-200 font-mono flex items-center justify-between">
                  <span>GSTIN: {selectedClient.gstin}</span>
                  <span className="text-[10px] bg-blue-900/60 px-1.5 py-0.5 rounded">State {selectedClient.stateCode}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notifications */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between text-emerald-800 text-sm font-semibold animate-fadeIn">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-900">
            <X size={16} />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between text-rose-800 text-sm font-semibold animate-fadeIn">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-900">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Client Profile Selector & Quick Preset Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Registered Client Selector */}
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 size={14} className="text-blue-600" />
              <span>Select Registered Client Profile:</span>
            </label>
            <div className="relative">
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all cursor-pointer"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.gstin}) - {c.city}, {c.state}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Scenario Fill Buttons */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              <span>Load Sample Verification Scenarios:</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => loadPresetTemplate('AWS_CLOUD')}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-all"
              >
                AWS Cloud (18% ITC)
              </button>
              <button
                type="button"
                onClick={() => loadPresetTemplate('LEGAL_RCM')}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-all"
              >
                Legal Fees (RCM 9(3))
              </button>
              <button
                type="button"
                onClick={() => loadPresetTemplate('STEEL_RAW')}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all"
              >
                Steel Billets (HSN 7207)
              </button>
              <button
                type="button"
                onClick={() => loadPresetTemplate('MOTOR_CAR')}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all"
              >
                Motor Car (Sec 17(5) Blocked)
              </button>
              <button
                type="button"
                onClick={() => loadPresetTemplate('EXPORT_CONSULTING')}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all"
              >
                Zero-Rated Export (LUT)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Grid: Upload Form + Live AI Categorization Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload Form & Dropzone (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
                  <Upload size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upload Document Dossier</h3>
                  <p className="text-xs text-slate-500">Attach invoice, bill, or receipt for automated GST verification</p>
                </div>
              </div>

              {/* Document Type Selector */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDocumentType('PURCHASE_BILL')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    documentType === 'PURCHASE_BILL'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Purchase / Inward
                </button>
                <button
                  type="button"
                  onClick={() => setDocumentType('SALES_INVOICE')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    documentType === 'SALES_INVOICE'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sales / Outward
                </button>
              </div>
            </div>

            {/* Drag & Drop File Upload Area */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-blue-500 bg-blue-50/60 scale-[1.01]'
                  : selectedFile
                  ? 'border-emerald-400 bg-emerald-50/40'
                  : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/80'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv"
                onChange={handleFileInput}
                className="hidden"
              />

              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl shadow-sm">
                    <FileText size={28} />
                  </div>
                  <div className="font-bold text-slate-800 text-sm truncate max-w-sm">
                    {selectedFile.name}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || 'Document'}
                  </div>
                  <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full mt-1">
                    <CheckCircle2 size={12} /> Ready for Automated GST Check
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-slate-100 text-slate-500 rounded-2xl">
                    <Upload size={28} />
                  </div>
                  <div className="font-bold text-slate-800 text-sm">
                    Drag and drop file here, or <span className="text-blue-600 underline">browse files</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Supports Tax Invoices, Purchase Bills, Debit Notes in PDF, JPG, PNG, XLSX (Max 25MB)
                  </p>
                </div>
              )}
            </div>

            {/* Document Header Metadata Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">Invoice / Bill Number</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-2026-0982"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">Invoice Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  {documentType === 'PURCHASE_BILL' ? 'Supplier / Vendor Name' : 'Recipient Customer Name'}
                </label>
                <input
                  type="text"
                  value={counterpartyName}
                  onChange={(e) => setCounterpartyName(e.target.value)}
                  placeholder="e.g. Acme Technologies Pvt Ltd"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  {documentType === 'PURCHASE_BILL' ? 'Supplier GSTIN' : 'Recipient GSTIN'}
                </label>
                <input
                  type="text"
                  value={counterpartyGstin}
                  onChange={(e) => setCounterpartyGstin(e.target.value)}
                  placeholder="e.g. 27AAACA9999P1Z1"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">Place of Supply (State Code)</label>
                <select
                  value={placeOfSupply}
                  onChange={(e) => setPlaceOfSupply(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="27">27 - Maharashtra (Intra-state if Client is 27)</option>
                  <option value="29">29 - Karnataka (Inter-state IGST)</option>
                  <option value="07">07 - Delhi (Inter-state IGST)</option>
                  <option value="33">33 - Tamil Nadu (Inter-state IGST)</option>
                  <option value="36">36 - Telangana (Inter-state IGST)</option>
                  <option value="24">24 - Gujarat (Inter-state IGST)</option>
                  <option value="99">99 - Other Territory / Special Zone</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">Financial Compliance Period</label>
                <input
                  type="text"
                  value={financialPeriod}
                  onChange={(e) => setFinancialPeriod(e.target.value)}
                  placeholder="e.g. October 2026"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Line Items & Supply Description */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag size={14} className="text-indigo-600" />
                  <span>Document Line Items & Trade Descriptions</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddLineItem}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  + Add Line Item
                </button>
              </div>

              <div className="space-y-2">
                {lineItems.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">Item #{idx + 1}</span>
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(idx)}
                          className="text-rose-500 hover:text-rose-700 text-xs cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => {
                          handleLineItemChange(idx, 'description', e.target.value);
                          if (idx === 0) setItemDescription(e.target.value);
                        }}
                        placeholder="Product / Service item description..."
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">HSN/SAC</span>
                        <input
                          type="text"
                          value={item.hsnSac}
                          onChange={(e) => handleLineItemChange(idx, 'hsnSac', e.target.value)}
                          placeholder="e.g. 998315"
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono text-xs font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">Qty</span>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleLineItemChange(idx, 'quantity', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">Rate ₹</span>
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) => handleLineItemChange(idx, 'rate', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">Tax %</span>
                        <select
                          value={item.taxRate}
                          onChange={(e) => {
                            const r = Number(e.target.value);
                            handleLineItemChange(idx, 'taxRate', r);
                            if (idx === 0) setClaimedTaxRate(r);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-xs font-bold text-slate-800"
                        >
                          <option value="0">0%</option>
                          <option value="0.25">0.25%</option>
                          <option value="3">3%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={runCategorizationCheck}
                disabled={isCategorizing}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw size={14} className={isCategorizing ? 'animate-spin text-blue-600' : ''} />
                <span>{isCategorizing ? 'Categorizing...' : 'Re-run GST Check'}</span>
              </button>

              <button
                type="button"
                onClick={handleUploadDocument}
                disabled={isUploading}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Uploading & Classifying...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Securely Upload to Client Profile</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Real-Time Automated GST Categorization Check Dossier (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5 sticky top-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Automated Categorization Result</h4>
                  <p className="text-[11px] text-slate-500">Grounded against Gemini & CBIC GST Tariff Engine</p>
                </div>
              </div>

              {isCategorizing ? (
                <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[11px] font-bold animate-pulse flex items-center gap-1">
                  <RefreshCw size={12} className="animate-spin" /> Analyzing...
                </span>
              ) : liveCategorization ? (
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold flex items-center gap-1">
                  <CheckCircle2 size={12} /> {liveCategorization.confidenceScore}% Confidence
                </span>
              ) : null}
            </div>

            {liveCategorization ? (
              <div className="space-y-4 text-xs">
                {/* Status & Discrepancy Alerts Banner */}
                {discrepancyAlerts.length > 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-amber-900 text-xs">
                      <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                      <span>{discrepancyAlerts.length} Discrepancy Flag(s) Detected:</span>
                    </div>
                    <ul className="space-y-1 pl-6 list-disc text-amber-800 text-[11px]">
                      {discrepancyAlerts.map((alert, i) => (
                        <li key={i}>{alert}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-2.5 text-emerald-800 font-bold text-xs">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    <span>Statutory GST Compliant • No Rate Discrepancies Found</span>
                  </div>
                )}

                {/* Primary Categorization Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                      Suggested HSN / SAC
                    </span>
                    <span className="text-base font-black font-mono text-slate-900">
                      {liveCategorization.suggestedHsnSac}
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate mt-0.5">
                      {liveCategorization.hsnSacTitle}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                      Statutory GST Rate
                    </span>
                    <span className="text-base font-black text-blue-600">
                      {liveCategorization.suggestedGstRate}%
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Schedule: {liveCategorization.chapter || 'Tariff Slabs'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                      ITC Admissibility
                    </span>
                    <span
                      className={`text-xs font-black inline-flex items-center gap-1 ${
                        liveCategorization.itcEligibility === 'ELIGIBLE'
                          ? 'text-emerald-700'
                          : liveCategorization.itcEligibility === 'BLOCKED_17_5'
                          ? 'text-rose-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {liveCategorization.itcEligibility === 'ELIGIBLE' ? (
                        <>
                          <CheckCircle2 size={12} /> 100% Eligible
                        </>
                      ) : liveCategorization.itcEligibility === 'BLOCKED_17_5' ? (
                        <>
                          <ShieldAlert size={12} /> Sec 17(5) Blocked
                        </>
                      ) : (
                        'Conditional ITC'
                      )}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                      Reverse Charge (RCM)
                    </span>
                    <span
                      className={`text-xs font-black ${
                        liveCategorization.rcmApplicable ? 'text-amber-700' : 'text-slate-700'
                      }`}
                    >
                      {liveCategorization.rcmApplicable ? 'Yes • Sec 9(3) RCM' : 'No • Forward Charge'}
                    </span>
                  </div>
                </div>

                {/* Accounting & GL Code Mapping */}
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-indigo-950 font-bold text-xs">
                    <span>Accounting Ledger & GL Code:</span>
                    <span className="font-mono text-[11px] bg-indigo-200/60 px-2 py-0.5 rounded">
                      {liveCategorization.glCode}
                    </span>
                  </div>
                  <div className="text-slate-600 text-[11px]">
                    Mapped Expense Category: <strong className="text-slate-800">{liveCategorization.expenseCategory}</strong>
                  </div>
                  {liveCategorization.itcReasoning && (
                    <p className="text-[11px] text-slate-500 italic mt-1">
                      {liveCategorization.itcReasoning}
                    </p>
                  )}
                </div>

                {/* Tax Breakdown Preview */}
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span>Tax Computation Breakdown:</span>
                    <span>Total Tax: ₹{((lineItems.reduce((acc, i) => acc + (i.taxableValue || 0), 0) * liveCategorization.suggestedGstRate) / 100).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                    <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block">CGST</span>
                      <span className="font-bold text-slate-800">
                        {placeOfSupply === (selectedClient?.stateCode || '27')
                          ? `${liveCategorization.suggestedGstRate / 2}%`
                          : '₹0'}
                      </span>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block">SGST</span>
                      <span className="font-bold text-slate-800">
                        {placeOfSupply === (selectedClient?.stateCode || '27')
                          ? `${liveCategorization.suggestedGstRate / 2}%`
                          : '₹0'}
                      </span>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block">IGST</span>
                      <span className="font-bold text-slate-800">
                        {placeOfSupply !== (selectedClient?.stateCode || '27')
                          ? `${liveCategorization.suggestedGstRate}%`
                          : '₹0'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 space-y-2 text-slate-400">
                <Sparkles size={32} className="mx-auto text-slate-300" />
                <p className="text-xs font-semibold">Enter line item descriptions or select a preset to trigger automated GST classification.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Client Document History & Vault Dossier */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 text-slate-700 rounded-2xl">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Client Profile Document Repository ({uploadedDocs.length})
              </h3>
              <p className="text-xs text-slate-500">
                History of all purchase and sales documents securely uploaded for {selectedClient?.name || 'this client'}
              </p>
            </div>
          </div>

          {/* Search & Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search file, invoice #, HSN..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setActiveHistoryTab('ALL')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeHistoryTab === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveHistoryTab('PURCHASE_BILL')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeHistoryTab === 'PURCHASE_BILL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Purchase
              </button>
              <button
                onClick={() => setActiveHistoryTab('SALES_INVOICE')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeHistoryTab === 'SALES_INVOICE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Sales
              </button>
              <button
                onClick={() => setActiveHistoryTab('FLAGGED')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeHistoryTab === 'FLAGGED' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Flagged
              </button>
            </div>
          </div>
        </div>

        {/* Documents Table */}
        {isLoadingDocs ? (
          <div className="text-center py-12 space-y-2">
            <RefreshCw size={24} className="animate-spin text-blue-600 mx-auto" />
            <p className="text-xs text-slate-500 font-semibold">Loading client document vault...</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-12 space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <FileText size={32} className="mx-auto text-slate-400" />
            <div className="text-sm font-bold text-slate-700">No documents uploaded yet</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Use the upload form above to attach purchase and sales documents directly to this client's profile.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
                  <th className="py-3 px-3">Document Details</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Counterparty</th>
                  <th className="py-3 px-3">Taxable & Tax</th>
                  <th className="py-3 px-3">GST Classification</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-all">
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                          <FileText size={16} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs truncate max-w-[180px]">
                            {doc.fileName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {doc.invoiceNumber} • {new Date(doc.uploadedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          doc.documentType === 'PURCHASE_BILL'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {doc.documentType === 'PURCHASE_BILL' ? 'Purchase Bill' : 'Sales Invoice'}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800 truncate max-w-[150px]">
                        {doc.counterpartyName || '—'}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {doc.counterpartyGstin || 'Unregistered'}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">
                        ₹{(doc.totalTaxableAmount || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Tax: ₹{(doc.totalTaxAmount || 0).toLocaleString('en-IN')}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                          {doc.categorization.suggestedHsnSac}
                        </span>
                        <span className="font-bold text-blue-600 text-[11px]">
                          {doc.categorization.suggestedGstRate}%
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                        {doc.categorization.expenseCategory}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                          doc.uploadStatus === 'VERIFIED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : doc.uploadStatus === 'FLAGGED_ANOMALY'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {doc.uploadStatus === 'VERIFIED' ? (
                          <>
                            <CheckCircle2 size={10} /> Verified
                          </>
                        ) : doc.uploadStatus === 'FLAGGED_ANOMALY' ? (
                          <>
                            <AlertTriangle size={10} /> Discrepancy
                          </>
                        ) : (
                          'Categorized'
                        )}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingDoc(doc)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer"
                          title="View Full Document Dossier"
                        >
                          <Eye size={14} />
                        </button>

                        {!doc.isPushedToInvoiceRegister && (
                          <button
                            type="button"
                            onClick={() => handleVerifyAndSync(doc.id)}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="Verify and sync to main Invoice Ledger"
                          >
                            <Check size={12} /> Sync
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteDoc(doc.id)}
                          className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all cursor-pointer"
                          title="Delete Document"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Document Detail Modal */}
      <AnimatePresence>
        {viewingDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-100 text-blue-700 rounded-2xl">
                    <FileText size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{viewingDoc.fileName}</h3>
                    <p className="text-xs text-slate-500">
                      Uploaded by {viewingDoc.uploadedBy} on {new Date(viewingDoc.uploadedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingDoc(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Categorization & Discrepancy Alerts in Modal */}
              {viewingDoc.categorization.discrepancyAlerts && viewingDoc.categorization.discrepancyAlerts.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-900 text-xs">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                    <span>Statutory GST Discrepancy Warnings</span>
                  </div>
                  <ul className="space-y-1 pl-6 list-disc text-amber-800 text-xs">
                    {viewingDoc.categorization.discrepancyAlerts.map((alert, i) => (
                      <li key={i}>{alert}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Core Attributes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block">Invoice #</span>
                  <span className="font-bold text-slate-800">{viewingDoc.invoiceNumber}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block">Invoice Date</span>
                  <span className="font-bold text-slate-800">{viewingDoc.invoiceDate}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block">Taxable Total</span>
                  <span className="font-bold text-slate-900">₹{viewingDoc.totalTaxableAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block">GST Total</span>
                  <span className="font-bold text-blue-600">₹{viewingDoc.totalTaxAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Line items list */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Line Items</h4>
                <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/70 text-slate-600 text-[10px] uppercase font-bold">
                      <tr>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3">HSN/SAC</th>
                        <th className="py-2.5 px-3">Qty</th>
                        <th className="py-2.5 px-3">Taxable</th>
                        <th className="py-2.5 px-3">Rate</th>
                        <th className="py-2.5 px-3">Tax</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/50">
                      {viewingDoc.items.map((item, i) => (
                        <tr key={i}>
                          <td className="py-2.5 px-3 font-medium text-slate-800">{item.description}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{item.hsnSac}</td>
                          <td className="py-2.5 px-3 text-slate-600">{item.quantity}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">₹{item.taxableValue.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3 font-bold text-blue-600">{item.taxRate}%</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">₹{(item.taxAmount || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal footer actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setViewingDoc(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Close
                </button>

                <div className="flex items-center gap-2">
                  {!viewingDoc.isPushedToInvoiceRegister ? (
                    <button
                      type="button"
                      onClick={() => handleVerifyAndSync(viewingDoc.id)}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 size={16} />
                      <span>Verify & Sync to Invoices Register</span>
                    </button>
                  ) : (
                    <span className="px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      <span>Already Synced to Register</span>
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClientDocumentUpload;
