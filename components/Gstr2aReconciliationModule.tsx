import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  CheckCircle2, XCircle, AlertTriangle, HelpCircle, ArrowRightLeft, 
  ShieldAlert, RefreshCw, Filter, Download, ExternalLink, Mail, Send,
  FileSpreadsheet, Upload, Sliders, Check, Info, AlertCircle, Copy,
  Eye, FileText, ChevronRight, ChevronsLeft, ChevronsRight, ChevronLeft,
  ArrowRight, ShieldCheck, Landmark, Layers, Sparkles, Building2, Calendar,
  UploadCloud, Trash2, FileCheck, AlertOctagon, FileUp
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GSTR2AReconEngine, 
  GSTR2AReconConfig, 
  DEFAULT_GSTR2A_RECON_CONFIG, 
  GSTR2AReconciliationItem, 
  GSTR2AReconSummary, 
  PurchaseRegisterInvoice, 
  GSTR2AGovtRecord,
  GSTR2ADiscrepancyType 
} from '../services/gstEngine/gstr2aReconEngine';
import { exportToCSV } from '../utils/export';
import ReconciliationSummary, { TaxHeadBreakdown } from './ReconciliationSummary';

interface Gstr2aReconciliationModuleProps {
  tenantId?: string;
  initialPeriod?: string;
}

export const Gstr2aReconciliationModule: React.FC<Gstr2aReconciliationModuleProps> = ({
  tenantId = 't1',
  initialPeriod = '08/2026'
}) => {
  // Period Selection
  const [selectedPeriod, setSelectedPeriod] = useState<string>(initialPeriod);
  
  // Data Sources State
  const [purchaseRegister, setPurchaseRegister] = useState<PurchaseRegisterInvoice[]>([]);
  const [govtGstr2a, setGovtGstr2a] = useState<GSTR2AGovtRecord[]>([]);
  const [isSyncingGstn, setIsSyncingGstn] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Configuration State
  const [config, setConfig] = useState<GSTR2AReconConfig>(DEFAULT_GSTR2A_RECON_CONFIG);
  const [showConfigDrawer, setShowConfigDrawer] = useState<boolean>(false);

  // Filter & Search State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyDiscrepancies, setOnlyDiscrepancies] = useState<boolean>(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [jumpPageInput, setJumpPageInput] = useState<string>('');

  // Modal State
  const [inspectingItem, setInspectingItem] = useState<GSTR2AReconciliationItem | null>(null);
  const [vendorNoticeItem, setVendorNoticeItem] = useState<GSTR2AReconciliationItem | null>(null);
  const [noticeSentIds, setNoticeSentIds] = useState<Set<string>>(new Set());
  const [paymentHeldIds, setPaymentHeldIds] = useState<Set<string>>(new Set());
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Ingestion & Upload State
  const [uploadModalOpen, setUploadModalOpen] = useState<'PR' | '2A' | null>(null);
  const [uploadActiveTab, setUploadActiveTab] = useState<'FILE' | 'GUIDE'>('FILE');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isProcessingUpload, setIsProcessingUpload] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [parsedPreviewPr, setParsedPreviewPr] = useState<PurchaseRegisterInvoice[] | null>(null);
  const [parsedPreviewGovt, setParsedPreviewGovt] = useState<GSTR2AGovtRecord[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize and update with benchmark or period data
  useEffect(() => {
    const { purchaseRegister: pr, govtGstr2a: govt } = GSTR2AReconEngine.generateSampleData(selectedPeriod);
    setPurchaseRegister(pr);
    setGovtGstr2a(govt);
  }, [selectedPeriod]);

  const loadBenchmarkDataset = () => {
    const { purchaseRegister: pr, govtGstr2a: govt } = GSTR2AReconEngine.generateSampleData(selectedPeriod);
    setPurchaseRegister(pr);
    setGovtGstr2a(govt);
    setCopyFeedback(`Benchmark dataset for ${selectedPeriod} loaded (${pr.length} books, ${govt.length} 2A records).`);
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  // Helper parsers for user uploaded files
  const parsePrFile = async (file: File): Promise<PurchaseRegisterInvoice[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const isJson = file.name.endsWith('.json');

      reader.onload = (e) => {
        try {
          let rawRows: any[] = [];
          if (isJson) {
            const parsed = JSON.parse(e.target?.result as string);
            rawRows = Array.isArray(parsed) ? parsed : (parsed.invoices || parsed.items || parsed.records || []);
          } else {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.SheetNames[0];
            rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
          }

          if (!rawRows || rawRows.length === 0) {
            throw new Error('The uploaded file contains no data rows.');
          }

          const parsedItems: PurchaseRegisterInvoice[] = rawRows.map((row, idx) => {
            const getVal = (regex: RegExp, fallback: any = '') => {
              const k = Object.keys(row).find(key => regex.test(key));
              return k !== undefined ? row[k] : fallback;
            };

            const invoiceNumber = String(getVal(/inv.*no|bill.*no|invoice.*number|voucher.*no|invnum/i, `INV-${idx + 1}`)).trim();
            const date = String(getVal(/date|dt/i, new Date().toISOString().split('T')[0])).trim();
            const supplierGstin = String(getVal(/gstin|ctin|vendor.*gstin|supplier.*gst/i, '27AAACT2727Q1ZW')).trim().toUpperCase();
            const supplierName = String(getVal(/party.*name|vendor.*name|supplier.*name|supplier/i, `Supplier ${idx + 1}`)).trim();
            const placeOfSupply = String(getVal(/pos|place.*supply/i, supplierGstin.slice(0, 2) || '27')).trim();
            const taxableValue = Number(getVal(/taxable|base.*amt|txval/i, 0)) || 0;
            const cgst = Number(getVal(/cgst|central.*tax/i, 0)) || 0;
            const sgst = Number(getVal(/sgst|state.*tax/i, 0)) || 0;
            const igst = Number(getVal(/igst|integrated.*tax/i, 0)) || 0;
            const cess = Number(getVal(/cess/i, 0)) || 0;
            const totalTax = Number(getVal(/total.*tax|tax.*amount/i, cgst + sgst + igst + cess)) || (cgst + sgst + igst + cess);
            const totalAmount = Number(getVal(/total.*amount|invoice.*value|grand.*total|val/i, taxableValue + totalTax)) || (taxableValue + totalTax);

            return {
              id: `pr-upload-${Date.now()}-${idx}`,
              invoiceNumber,
              date,
              supplierGstin,
              supplierName,
              placeOfSupply,
              taxableValue,
              cgst,
              sgst,
              igst,
              cess,
              totalTax,
              totalAmount,
              docType: 'INVOICE',
              paymentStatus: 'PAID',
              internalVoucherNo: `VCH-${idx + 1}`
            };
          });

          resolve(parsedItems);
        } catch (err: any) {
          reject(err);
        }
      };

      if (isJson) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  };

  const parseGovtFile = async (file: File): Promise<GSTR2AGovtRecord[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const isJson = file.name.endsWith('.json');

      reader.onload = (e) => {
        try {
          const records: GSTR2AGovtRecord[] = [];

          if (isJson) {
            const parsed = JSON.parse(e.target?.result as string);
            if (parsed.b2b && Array.isArray(parsed.b2b)) {
              parsed.b2b.forEach((supplier: any, sIdx: number) => {
                const ctin = (supplier.ctin || '27AAACT2727Q1ZW').toUpperCase();
                const tradeName = supplier.cname || `Supplier ${ctin.slice(0, 8)}`;
                const invoices = supplier.inv || [];
                invoices.forEach((inv: any, iIdx: number) => {
                  let txval = 0, igst = 0, cgst = 0, sgst = 0, cess = 0;
                  if (Array.isArray(inv.itms)) {
                    inv.itms.forEach((itm: any) => {
                      const det = itm.itm_det || itm;
                      txval += Number(det.txval || 0);
                      igst += Number(det.iamt || 0);
                      cgst += Number(det.camt || 0);
                      sgst += Number(det.samt || 0);
                      cess += Number(det.csamt || 0);
                    });
                  }
                  const totalTax = igst + cgst + sgst + cess;
                  const totalInvoiceValue = Number(inv.val || txval + totalTax);

                  records.push({
                    id: `gstr2a-json-${sIdx}-${iIdx}`,
                    supplierGstin: ctin,
                    supplierTradeName: tradeName,
                    supplierLegalName: tradeName,
                    invoiceNumber: String(inv.inum || `INV-${iIdx + 1}`),
                    invoiceDate: String(inv.idt || new Date().toISOString().split('T')[0]),
                    invoiceType: inv.inv_typ || 'B2B',
                    placeOfSupply: String(inv.pos || ctin.slice(0, 2)),
                    taxableValue: txval || Number(inv.val || 0),
                    cgst,
                    sgst,
                    igst,
                    cess,
                    totalTax,
                    totalInvoiceValue,
                    gstr1FilingStatus: 'FILED',
                    gstr1FilingDate: new Date().toISOString().split('T')[0],
                    gstr1FilingPeriod: selectedPeriod,
                    gstr3bFilingStatus: 'FILED',
                    source: 'GSTR-1'
                  });
                });
              });
            } else if (Array.isArray(parsed)) {
              parsed.forEach((item: any, idx: number) => {
                const ctin = String(item.supplierGstin || item.ctin || '27AAACT2727Q1ZW').toUpperCase();
                const tradeName = item.supplierTradeName || item.partyName || `Supplier ${ctin.slice(0, 8)}`;
                records.push({
                  id: `gstr2a-custom-${idx}`,
                  supplierGstin: ctin,
                  supplierTradeName: tradeName,
                  supplierLegalName: tradeName,
                  invoiceNumber: String(item.invoiceNumber || item.inum || `INV-${idx + 1}`),
                  invoiceDate: String(item.invoiceDate || item.idt || new Date().toISOString().split('T')[0]),
                  invoiceType: item.invoiceType || 'B2B',
                  placeOfSupply: String(item.placeOfSupply || item.pos || ctin.slice(0, 2)),
                  taxableValue: Number(item.taxableValue || item.txval || 0),
                  cgst: Number(item.cgst || item.camt || 0),
                  sgst: Number(item.sgst || item.samt || 0),
                  igst: Number(item.igst || item.iamt || 0),
                  cess: Number(item.cess || item.csamt || 0),
                  totalTax: Number(item.totalTax || (Number(item.cgst || 0) + Number(item.sgst || 0) + Number(item.igst || 0))),
                  totalInvoiceValue: Number(item.totalInvoiceValue || item.val || 0),
                  gstr1FilingStatus: item.gstr1FilingStatus || 'FILED',
                  gstr1FilingPeriod: item.gstr1FilingPeriod || selectedPeriod,
                  gstr3bFilingStatus: item.gstr3bFilingStatus || 'FILED',
                  source: 'GSTR-1'
                });
              });
            }
          } else {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.SheetNames[0];
            const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);

            rows.forEach((row, idx) => {
              const getVal = (regex: RegExp, fallback: any = '') => {
                const k = Object.keys(row).find(key => regex.test(key));
                return k !== undefined ? row[k] : fallback;
              };

              const ctin = String(getVal(/gstin|ctin/i, '27AAACT2727Q1ZW')).trim().toUpperCase();
              const tradeName = String(getVal(/name|trade|legal|party/i, `Portal Vendor ${idx + 1}`)).trim();
              const invNum = String(getVal(/inv.*no|inum|invoice/i, `INV-${idx + 1}`)).trim();
              const date = String(getVal(/date|idt|dt/i, new Date().toISOString().split('T')[0])).trim();
              const taxable = Number(getVal(/taxable|txval|base/i, 0)) || 0;
              const cgst = Number(getVal(/cgst|camt/i, 0)) || 0;
              const sgst = Number(getVal(/sgst|samt/i, 0)) || 0;
              const igst = Number(getVal(/igst|iamt/i, 0)) || 0;
              const cess = Number(getVal(/cess|csamt/i, 0)) || 0;
              const totalTax = Number(getVal(/total.*tax|tax/i, cgst + sgst + igst + cess)) || (cgst + sgst + igst + cess);
              const totalVal = Number(getVal(/total.*val|invoice.*val|val/i, taxable + totalTax)) || (taxable + totalTax);

              records.push({
                id: `gstr2a-sheet-${idx}`,
                supplierGstin: ctin,
                supplierTradeName: tradeName,
                supplierLegalName: tradeName,
                invoiceNumber: invNum,
                invoiceDate: date,
                invoiceType: 'B2B',
                placeOfSupply: String(getVal(/pos|place/i, ctin.slice(0, 2) || '27')),
                taxableValue: taxable,
                cgst,
                sgst,
                igst,
                cess,
                totalTax,
                totalInvoiceValue: totalVal,
                gstr1FilingStatus: 'FILED',
                gstr1FilingDate: date,
                gstr1FilingPeriod: selectedPeriod,
                gstr3bFilingStatus: 'FILED',
                source: 'GSTR-1'
              });
            });
          }

          if (records.length === 0) {
            throw new Error('No valid GSTR-2A records could be identified.');
          }

          resolve(records);
        } catch (err: any) {
          reject(err);
        }
      };

      if (isJson) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  };

  const handleFileSelection = async (file: File) => {
    setUploadFile(file);
    setUploadError(null);
    setIsProcessingUpload(true);
    setParsedPreviewPr(null);
    setParsedPreviewGovt(null);

    try {
      if (uploadModalOpen === 'PR') {
        const prItems = await parsePrFile(file);
        setParsedPreviewPr(prItems);
      } else if (uploadModalOpen === '2A') {
        const govtItems = await parseGovtFile(file);
        setParsedPreviewGovt(govtItems);
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to parse file. Please verify columns and file format.');
    } finally {
      setIsProcessingUpload(false);
    }
  };

  const handleApplyUploadedData = () => {
    if (uploadModalOpen === 'PR' && parsedPreviewPr && parsedPreviewPr.length > 0) {
      setPurchaseRegister(parsedPreviewPr);
      setCopyFeedback(`Successfully ingested ${parsedPreviewPr.length} Purchase Register invoices!`);
      setTimeout(() => setCopyFeedback(null), 4000);
      setUploadModalOpen(null);
      setUploadFile(null);
      setParsedPreviewPr(null);
    } else if (uploadModalOpen === '2A' && parsedPreviewGovt && parsedPreviewGovt.length > 0) {
      setGovtGstr2a(parsedPreviewGovt);
      setCopyFeedback(`Successfully ingested ${parsedPreviewGovt.length} GSTR-2A Government Portal records!`);
      setTimeout(() => setCopyFeedback(null), 4000);
      setUploadModalOpen(null);
      setUploadFile(null);
      setParsedPreviewGovt(null);
    }
  };

  const downloadSamplePrTemplate = () => {
    const sample = [
      {
        'Invoice Number': 'TSL/2026/0892',
        'Invoice Date': '2026-08-04',
        'Supplier GSTIN': '27AAACT2727Q1ZW',
        'Supplier Name': 'Tata Steel Limited',
        'Place of Supply': '27',
        'Taxable Value': 500000,
        'CGST': 45000,
        'SGST': 45000,
        'IGST': 0,
        'Cess': 0,
        'Total Tax': 90000,
        'Total Amount': 590000
      },
      {
        'Invoice Number': 'INF-2026-9041',
        'Invoice Date': '2026-08-08',
        'Supplier GSTIN': '29AABCI1234K1ZV',
        'Supplier Name': 'Infosys BPM Solutions Ltd',
        'Place of Supply': '27',
        'Taxable Value': 180000,
        'CGST': 0,
        'SGST': 0,
        'IGST': 32400,
        'Cess': 0,
        'Total Tax': 32400,
        'Total Amount': 212400
      }
    ];
    exportToCSV(sample, `Purchase_Register_Template_${selectedPeriod.replace('/', '-')}`);
  };

  const downloadSampleGstr2aTemplate = () => {
    const sample = [
      {
        'GSTIN of Supplier': '27AAACT2727Q1ZW',
        'Trade/Legal Name': 'Tata Steel Limited',
        'Invoice number': 'TSL/2026/0892',
        'Invoice Date': '2026-08-04',
        'Place of supply': '27-Maharashtra',
        'Taxable Value': 500000,
        'Integrated Tax': 0,
        'Central Tax': 45000,
        'State/UT Tax': 45000,
        'Cess': 0,
        'Total Tax': 90000,
        'Invoice Value': 590000,
        'GSTR-1 Filing Status': 'FILED',
        'GSTR-1 Filing Period': selectedPeriod
      }
    ];
    exportToCSV(sample, `GSTR2A_Portal_Template_${selectedPeriod.replace('/', '-')}`);
  };

  // Run Reconciliation Engine
  const { items: reconItems, summary } = useMemo(() => {
    return GSTR2AReconEngine.reconcile(purchaseRegister, govtGstr2a, config);
  }, [purchaseRegister, govtGstr2a, config]);

  // Comparative Tax Head Breakdown for ReconciliationSummary
  const booksBreakdown: TaxHeadBreakdown = useMemo(() => {
    return {
      igst: purchaseRegister.reduce((sum, p) => sum + (p.igst || 0), 0),
      cgst: purchaseRegister.reduce((sum, p) => sum + (p.cgst || 0), 0),
      sgst: purchaseRegister.reduce((sum, p) => sum + (p.sgst || 0), 0),
      cess: purchaseRegister.reduce((sum, p) => sum + (p.cess || 0), 0),
      total: summary.totalPrTax,
      taxable: summary.totalPrTaxable,
      count: summary.totalPrInvoices
    };
  }, [purchaseRegister, summary]);

  const gstr2aBreakdown: TaxHeadBreakdown = useMemo(() => {
    return {
      igst: govtGstr2a.reduce((sum, g) => sum + (g.igst || 0), 0),
      cgst: govtGstr2a.reduce((sum, g) => sum + (g.cgst || 0), 0),
      sgst: govtGstr2a.reduce((sum, g) => sum + (g.sgst || 0), 0),
      cess: govtGstr2a.reduce((sum, g) => sum + (g.cess || 0), 0),
      total: summary.totalGovtTax,
      taxable: summary.totalGovtTaxable,
      count: summary.totalGovtInvoices
    };
  }, [govtGstr2a, summary]);

  // Apply User Filters
  const filteredItems = useMemo(() => {
    return reconItems.filter(item => {
      // Only Discrepancies toggle
      if (onlyDiscrepancies && (item.discrepancyType === 'EXACT_MATCH' || item.discrepancyType === 'MATCH_WITH_TOLERANCE')) {
        return false;
      }

      // Status Pill Filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'DISCREPANCIES') {
          if (item.discrepancyType === 'EXACT_MATCH' || item.discrepancyType === 'MATCH_WITH_TOLERANCE') return false;
        } else if (item.discrepancyType !== statusFilter) {
          return false;
        }
      }

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const prInv = item.purchaseInvoice?.invoiceNumber.toLowerCase() || '';
        const govtInv = item.govtRecord?.invoiceNumber.toLowerCase() || '';
        const prParty = item.purchaseInvoice?.supplierName.toLowerCase() || '';
        const govtParty = item.govtRecord?.supplierTradeName.toLowerCase() || '';
        const prGstin = item.purchaseInvoice?.supplierGstin.toLowerCase() || '';
        const govtGstin = item.govtRecord?.supplierGstin.toLowerCase() || '';

        const matches = 
          prInv.includes(q) || 
          govtInv.includes(q) || 
          prParty.includes(q) || 
          govtParty.includes(q) || 
          prGstin.includes(q) || 
          govtGstin.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [reconItems, statusFilter, searchQuery, onlyDiscrepancies]);

  // Auto reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, onlyDiscrepancies, pageSize]);

  // Pagination slicing
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, safeCurrentPage, pageSize]);

  const startRecord = filteredItems.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endRecord = Math.min(safeCurrentPage * pageSize, filteredItems.length);

  // Sync with GSTN Government Portal
  const handleSyncWithGstn = () => {
    setIsSyncingGstn(true);
    setSyncMessage('Connecting to GSTN Production API / GSP Gateway...');

    setTimeout(() => {
      setSyncMessage(`Downloading GSTR-2A inward supply stream for Period ${selectedPeriod}...`);
    }, 900);

    setTimeout(() => {
      // Reload or refresh portal data with simulated live updates
      loadBenchmarkDataset();
      setIsSyncingGstn(false);
      setSyncMessage(`Successfully synchronized GSTR-2A data from GSTN for Period ${selectedPeriod}!`);
      setTimeout(() => setSyncMessage(null), 4000);
    }, 2000);
  };

  // Actions
  const handleHoldPayment = (id: string) => {
    setPaymentHeldIds(prev => new Set(prev).add(id));
    if (inspectingItem && inspectingItem.id === id) {
      setInspectingItem(prev => prev ? { ...prev, actionTaken: 'PAYMENT_HELD' } : null);
    }
  };

  const handleResolveItem = (id: string) => {
    setResolvedIds(prev => new Set(prev).add(id));
    if (inspectingItem && inspectingItem.id === id) {
      setInspectingItem(prev => prev ? { ...prev, actionTaken: 'FORCE_MATCHED' } : null);
    }
  };

  const handleSendNotice = (item: GSTR2AReconciliationItem) => {
    setVendorNoticeItem(item);
  };

  const handleConfirmSendNotice = () => {
    if (!vendorNoticeItem) return;
    setNoticeSentIds(prev => new Set(prev).add(vendorNoticeItem.id));
    setCopyFeedback('Official GST Compliance Notice dispatched via email & logged to audit trail.');
    setTimeout(() => {
      setCopyFeedback(null);
      setVendorNoticeItem(null);
    }, 1800);
  };

  const handleBulkSendNotices = () => {
    const actionable = reconItems.filter(
      r => r.discrepancyType === 'MISSING_IN_GSTR2A' || 
           r.discrepancyType === 'TAX_AMOUNT_MISMATCH' || 
           r.discrepancyType === 'TAXABLE_VALUE_MISMATCH' ||
           r.discrepancyType === 'TAX_HEAD_MISMATCH'
    );
    const newSent = new Set(noticeSentIds);
    actionable.forEach(r => newSent.add(r.id));
    setNoticeSentIds(newSent);
    setCopyFeedback(`Bulk discrepancy notice dispatched to ${actionable.length} suppliers.`);
    setTimeout(() => setCopyFeedback(null), 4000);
  };

  // Export to Excel / CSV
  const handleExportReconciliation = () => {
    const exportData = filteredItems.map(item => {
      const pr = item.purchaseInvoice;
      const govt = item.govtRecord;
      return {
        'Status': item.discrepancyType,
        'Statutory Note': item.statutoryNote,
        'PR Invoice No': pr?.invoiceNumber || 'MISSING',
        'PR Date': pr?.date || 'N/A',
        'Supplier Name (PR)': pr?.supplierName || 'N/A',
        'Supplier GSTIN (PR)': pr?.supplierGstin || 'N/A',
        'PR Taxable Value': pr?.taxableValue || 0,
        'PR Total Tax': pr?.totalTax || 0,
        'PR IGST': pr?.igst || 0,
        'PR CGST': pr?.cgst || 0,
        'PR SGST': pr?.sgst || 0,
        'Govt Invoice No': govt?.invoiceNumber || 'MISSING',
        'Govt Date': govt?.invoiceDate || 'N/A',
        'Govt Supplier Name': govt?.supplierTradeName || 'N/A',
        'Govt Supplier GSTIN': govt?.supplierGstin || 'N/A',
        'Govt Taxable Value': govt?.taxableValue || 0,
        'Govt Total Tax': govt?.totalTax || 0,
        'Govt IGST': govt?.igst || 0,
        'Govt CGST': govt?.cgst || 0,
        'Govt SGST': govt?.sgst || 0,
        'Tax Difference (Books - Govt)': item.taxDifference,
        'Govt GSTR-1 Status': govt?.gstr1FilingStatus || 'N/A',
        'Govt Filing Period': govt?.gstr1FilingPeriod || 'N/A',
        'Action Status': resolvedIds.has(item.id) 
          ? 'RESOLVED' 
          : noticeSentIds.has(item.id) 
            ? 'NOTICE_SENT' 
            : paymentHeldIds.has(item.id) 
              ? 'PAYMENT_HELD' 
              : 'OPEN'
      };
    });

    exportToCSV(exportData, `GSTR2A_vs_PurchaseRegister_Recon_${selectedPeriod.replace('/', '-')}_${new Date().toISOString().split('T')[0]}`);
  };

  // Helper for Status Configuration
  const getDiscrepancyBadge = (type: GSTR2ADiscrepancyType) => {
    switch (type) {
      case 'EXACT_MATCH':
        return {
          label: 'Exact Match',
          bgColor: 'bg-emerald-50 border-emerald-200 text-emerald-700',
          dotColor: 'bg-emerald-500',
          icon: CheckCircle2
        };
      case 'MATCH_WITH_TOLERANCE':
        return {
          label: 'Matched (Tolerance)',
          bgColor: 'bg-teal-50 border-teal-200 text-teal-700',
          dotColor: 'bg-teal-500',
          icon: Check
        };
      case 'TAXABLE_VALUE_MISMATCH':
        return {
          label: 'Value Discrepancy',
          bgColor: 'bg-amber-50 border-amber-200 text-amber-700',
          dotColor: 'bg-amber-500',
          icon: AlertTriangle
        };
      case 'TAX_AMOUNT_MISMATCH':
        return {
          label: 'Tax Mismatch',
          bgColor: 'bg-rose-50 border-rose-200 text-rose-700',
          dotColor: 'bg-rose-500',
          icon: AlertTriangle
        };
      case 'TAX_HEAD_MISMATCH':
        return {
          label: 'POS / Head Mismatch',
          bgColor: 'bg-orange-50 border-orange-200 text-orange-700',
          dotColor: 'bg-orange-500',
          icon: ArrowRightLeft
        };
      case 'MISSING_IN_GSTR2A':
        return {
          label: 'Missing in GSTR-2A',
          bgColor: 'bg-red-50 border-red-200 text-red-700 font-bold',
          dotColor: 'bg-red-600',
          icon: XCircle
        };
      case 'MISSING_IN_PURCHASE_REGISTER':
        return {
          label: 'Missing in Books (Unclaimed)',
          bgColor: 'bg-cyan-50 border-cyan-200 text-cyan-700 font-bold',
          dotColor: 'bg-cyan-500',
          icon: AlertCircle
        };
      case 'PROBABLE_MATCH':
        return {
          label: 'Probable Match (Format)',
          bgColor: 'bg-purple-50 border-purple-200 text-purple-700',
          dotColor: 'bg-purple-500',
          icon: Sparkles
        };
      case 'SUPPLIER_GSTR1_NOT_FILED':
        return {
          label: 'Supplier GSTR-1 Not Filed',
          bgColor: 'bg-yellow-50 border-yellow-200 text-yellow-800',
          dotColor: 'bg-yellow-500',
          icon: HelpCircle
        };
      case 'DATE_MISMATCH':
        return {
          label: 'Date Variance',
          bgColor: 'bg-blue-50 border-blue-200 text-blue-700',
          dotColor: 'bg-blue-500',
          icon: Calendar
        };
      default:
        return {
          label: type,
          bgColor: 'bg-slate-100 border-slate-200 text-slate-700',
          dotColor: 'bg-slate-400',
          icon: Info
        };
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Synchronization Alert Banner */}
      <AnimatePresence>
        {syncMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between text-sm text-blue-900 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <RefreshCw size={18} className="animate-spin text-blue-600" />
              <span className="font-semibold">{syncMessage}</span>
            </div>
            <button 
              onClick={() => setSyncMessage(null)}
              className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-white px-2.5 py-1 rounded-lg border border-blue-200"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Copy/Action Feedback Toast */}
      <AnimatePresence>
        {copyFeedback && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm"
          >
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{copyFeedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Header & Period Toolbar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black tracking-wider uppercase bg-blue-100 text-blue-800 border border-blue-200">
              Statutory ITC Audit
            </span>
            <span className="text-xs font-medium text-slate-400">
              CGST Sec 16(2)(aa) & Rule 36(4) Compliant
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1.5 flex items-center gap-2">
            GSTR-2A vs Purchase Register Reconciliation
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Compare uploaded internal purchase bills against Government GSTN reported data to detect missing bills, rate disparities, and tax head conflicts.
          </p>
        </div>

        {/* Period Selector & Primary Actions */}
        <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
          {/* Return Period Picker */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-2xs">
            <Calendar size={15} className="text-slate-500 ml-2" />
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none pr-3 py-1 cursor-pointer"
            >
              <option value="08/2026">August 2026 (Active Month)</option>
              <option value="07/2026">July 2026</option>
              <option value="06/2026">June 2026</option>
              <option value="Q1-2026">Q1 (Apr - Jun 2026)</option>
              <option value="FY-2026-27">Full Year 2026-27</option>
            </select>
          </div>

          {/* Upload Purchase Register Button */}
          <button
            onClick={() => {
              setUploadModalOpen('PR');
              setUploadFile(null);
              setUploadError(null);
              setParsedPreviewPr(null);
              setParsedPreviewGovt(null);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-2xs"
            title="Upload Purchase Register (Excel, CSV, JSON)"
          >
            <Upload size={13} className="text-emerald-600" />
            <span>Upload Books</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-black">
              {purchaseRegister.length}
            </span>
          </button>

          {/* Upload GSTR-2A Portal Button */}
          <button
            onClick={() => {
              setUploadModalOpen('2A');
              setUploadFile(null);
              setUploadError(null);
              setParsedPreviewPr(null);
              setParsedPreviewGovt(null);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-2xs"
            title="Upload GSTR-2A GSTN Portal JSON or Excel"
          >
            <FileSpreadsheet size={13} className="text-blue-600" />
            <span>Upload GSTR-2A</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 font-black">
              {govtGstr2a.length}
            </span>
          </button>

          {/* Sync GSTN Portal Button */}
          <button
            onClick={handleSyncWithGstn}
            disabled={isSyncingGstn}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50"
            title="Fetch live inward supplies data from GSTN Portal"
          >
            <RefreshCw size={14} className={isSyncingGstn ? 'animate-spin' : ''} />
            <span>{isSyncingGstn ? 'Syncing...' : 'Sync GSTN Portal'}</span>
          </button>

          {/* Matching Tolerance Settings Toggle */}
          <button
            onClick={() => setShowConfigDrawer(!showConfigDrawer)}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition-all shadow-2xs ${
              showConfigDrawer 
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Sliders size={14} />
            <span>Tolerances</span>
          </button>

          {/* Export Report Button */}
          <button
            onClick={handleExportReconciliation}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors shadow-2xs"
            title="Export detailed reconciliation report to CSV/Excel"
          >
            <Download size={14} className="text-blue-600" />
            <span>Export Statement</span>
          </button>
        </div>
      </div>

      {/* Tolerance Configurator Drawer (Collapsible) */}
      <AnimatePresence>
        {showConfigDrawer && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm bg-gradient-to-r from-slate-50 to-indigo-50/40">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <div className="flex items-center gap-2">
                  <Sliders size={16} className="text-indigo-600" />
                  <h2 className="text-sm font-bold text-slate-900">Reconciliation Tolerance & Matching Rules</h2>
                </div>
                <button
                  onClick={() => setConfig(DEFAULT_GSTR2A_RECON_CONFIG)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                >
                  Reset Defaults
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                {/* Tax Amount Tolerance */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-700">Tax Tolerance (₹)</span>
                    <span className="font-mono font-black text-indigo-600">₹{config.taxAmountTolerance}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={config.taxAmountTolerance}
                    onChange={(e) => setConfig({ ...config, taxAmountTolerance: Number(e.target.value) })}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Acceptable tax rounding variance (e.g. ₹10)</p>
                </div>

                {/* Taxable Value Tolerance */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-700">Taxable Value Tolerance</span>
                    <span className="font-mono font-black text-indigo-600">₹{config.taxableValueTolerance}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="500"
                    step="10"
                    value={config.taxableValueTolerance}
                    onChange={(e) => setConfig({ ...config, taxableValueTolerance: Number(e.target.value) })}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Variance for freight/discount rounding</p>
                </div>

                {/* Date Tolerance Days */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-700">Date Window (Days)</span>
                    <span className="font-mono font-black text-indigo-600">±{config.dateToleranceDays} Days</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="1"
                    value={config.dateToleranceDays}
                    onChange={(e) => setConfig({ ...config, dateToleranceDays: Number(e.target.value) })}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Accounts for transit or bill booking delays</p>
                </div>

                {/* Lenient Invoice Number Matching */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-700">Lenient Invoice # Match</p>
                      <p className="text-[10px] text-slate-400">Ignores slashes, hyphens, leading 0s</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.lenientInvoiceNumberMatch}
                      onChange={(e) => setConfig({ ...config, lenientInvoiceNumberMatch: e.target.checked })}
                      className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                    />
                  </div>
                  <div className="mt-2 text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-100 font-mono">
                    e.g. "INV-042" matches "INV/2026/42"
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comprehensive Comparative Reconciliation Summary Component */}
      <ReconciliationSummary
        itcClaimedBooks={booksBreakdown}
        itcAvailableGstr2a={gstr2aBreakdown}
        period={selectedPeriod}
        booksCount={summary.totalPrInvoices}
        gstr2aCount={summary.totalGovtInvoices}
        booksTaxable={summary.totalPrTaxable}
        gstr2aTaxable={summary.totalGovtTaxable}
        itcAtRisk={summary.itcAtRiskAmount}
        unclaimedItc={summary.unclaimedItcAmount}
        onExportReport={handleExportReconciliation}
        onViewDiscrepancies={() => setOnlyDiscrepancies(true)}
      />

      {/* Operational KPI Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: ITC At Risk (Critical: Missing in 2A / Vendor Default) */}
        <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">ITC At Risk</span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-200 text-rose-800">
              {summary.missingInGovtCount} Missing In 2A
            </span>
          </div>
          <div className="mt-3">
            <p className="text-xl font-black text-rose-700 font-mono">
              ₹{summary.itcAtRiskAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-rose-600 mt-0.5 font-medium truncate">
              Sec 16(2)(aa) non-compliant
            </p>
          </div>
        </div>

        {/* Card 2: Unclaimed ITC (Opportunity: Missing in Books) */}
        <div className="bg-cyan-50/70 p-4 rounded-2xl border border-cyan-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-800">Unclaimed ITC</span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-cyan-200 text-cyan-900">
              {summary.missingInPrCount} Missing In Books
            </span>
          </div>
          <div className="mt-3">
            <p className="text-xl font-black text-cyan-800 font-mono">
              ₹{summary.unclaimedItcAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-cyan-700 mt-0.5 font-medium truncate">
              Available on GSTN portal
            </p>
          </div>
        </div>

        {/* Card 3: Discrepant Invoices Requiring Action */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Action Required</span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              {summary.valueMismatchesCount + summary.taxHeadMismatchesCount + summary.missingInGovtCount} Cases
            </span>
          </div>
          <div className="mt-3">
            <p className="text-xl font-black text-slate-900 font-mono">
              {summary.valueMismatchesCount + summary.taxHeadMismatchesCount + summary.missingInGovtCount} Invoices
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
              Tax rate, value, or filing mismatches
            </p>
          </div>
        </div>

        {/* Card 4: Match Rate Percentage */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-4 rounded-2xl text-white shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300">Match Rate</span>
            <span className="text-xs font-bold text-emerald-400 font-mono">{summary.matchRatePercentage}%</span>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-400 rounded-full transition-all duration-500" 
                style={{ width: `${summary.matchRatePercentage}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-2 truncate">
              {summary.exactMatchesCount + summary.toleranceMatchesCount} matched of {summary.totalPrInvoices} bills
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Controls & Category Filters */}
      <div className="space-y-3">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar text-xs font-bold select-none">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Items ({reconItems.length})
          </button>

          <button
            onClick={() => setStatusFilter('DISCREPANCIES')}
            className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'DISCREPANCIES'
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50'
            }`}
          >
            <AlertTriangle size={13} />
            <span>All Discrepancies ({reconItems.length - (summary.exactMatchesCount + summary.toleranceMatchesCount)})</span>
          </button>

          <button
            onClick={() => setStatusFilter('MISSING_IN_GSTR2A')}
            className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'MISSING_IN_GSTR2A'
                ? 'bg-red-700 text-white border-red-700 shadow-xs'
                : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100/60'
            }`}
          >
            <XCircle size={13} />
            <span>Missing in 2A ({summary.missingInGovtCount})</span>
          </button>

          <button
            onClick={() => setStatusFilter('MISSING_IN_PURCHASE_REGISTER')}
            className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'MISSING_IN_PURCHASE_REGISTER'
                ? 'bg-cyan-700 text-white border-cyan-700 shadow-xs'
                : 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100/60'
            }`}
          >
            <AlertCircle size={13} />
            <span>Missing in Books ({summary.missingInPrCount})</span>
          </button>

          <button
            onClick={() => setStatusFilter('TAXABLE_VALUE_MISMATCH')}
            className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 ${
              statusFilter === 'TAXABLE_VALUE_MISMATCH'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
            }`}
          >
            Value Mismatch ({summary.valueMismatchesCount})
          </button>

          <button
            onClick={() => setStatusFilter('TAX_HEAD_MISMATCH')}
            className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 ${
              statusFilter === 'TAX_HEAD_MISMATCH'
                ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                : 'bg-white text-orange-700 border-orange-200 hover:bg-orange-50'
            }`}
          >
            POS / Head Mismatch ({summary.taxHeadMismatchesCount})
          </button>

          <button
            onClick={() => setStatusFilter('SUPPLIER_GSTR1_NOT_FILED')}
            className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 ${
              statusFilter === 'SUPPLIER_GSTR1_NOT_FILED'
                ? 'bg-yellow-600 text-white border-yellow-600 shadow-xs'
                : 'bg-white text-yellow-800 border-yellow-200 hover:bg-yellow-50'
            }`}
          >
            GSTR-1 Not Filed ({summary.supplierNotFiledCount})
          </button>

          <button
            onClick={() => setStatusFilter('PROBABLE_MATCH')}
            className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 ${
              statusFilter === 'PROBABLE_MATCH'
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
            }`}
          >
            Probable / Fuzzy ({summary.probableMatchesCount})
          </button>

          <button
            onClick={() => setStatusFilter('EXACT_MATCH')}
            className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 ${
              statusFilter === 'EXACT_MATCH'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            Exact Matched ({summary.exactMatchesCount})
          </button>
        </div>

        {/* Search Bar & Action Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-lg">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by invoice number, supplier name, GSTIN..."
                className="w-full h-10 pl-9 pr-4 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
              />
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick Toggle for Discrepancies Only */}
            <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer select-none transition-all shadow-2xs shrink-0 ${
              onlyDiscrepancies
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
              <input
                type="checkbox"
                checked={onlyDiscrepancies}
                onChange={(e) => setOnlyDiscrepancies(e.target.checked)}
                className="rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
              />
              <span>Only Discrepancies</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            {/* Bulk Notice Dispatch */}
            <button
              onClick={handleBulkSendNotices}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              title="Dispatches discrepancy notice to all suppliers with missing or mismatched invoices"
            >
              <Mail size={13} className="text-indigo-300" />
              <span>Bulk Send Notices</span>
            </button>

            {/* Reload Benchmark Scenario */}
            <button
              onClick={loadBenchmarkDataset}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5"
              title="Reset data to benchmark test scenarios"
            >
              <RefreshCw size={13} className="text-slate-500" />
              <span>Reload Benchmark</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Reconciliation Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">Supplier / Vendor</th>
                <th className="py-3.5 px-4">Books Invoice (PR)</th>
                <th className="py-3.5 px-4">GSTR-2A Portal Invoice</th>
                <th className="py-3.5 px-4 text-right">Taxable Comparison</th>
                <th className="py-3.5 px-4 text-right">Tax Comparison (Books vs 2A)</th>
                <th className="py-3.5 px-4 text-center">Discrepancy Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <AlertTriangle size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-sm text-slate-600">No reconciliation records match your filter criteria.</p>
                    <p className="text-xs text-slate-400 mt-1">Try broadening your search query or reset the category filters.</p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const badge = getDiscrepancyBadge(item.discrepancyType);
                  const isNoticeSent = noticeSentIds.has(item.id);
                  const isPaymentHeld = paymentHeldIds.has(item.id);
                  const isResolved = resolvedIds.has(item.id);

                  const pr = item.purchaseInvoice;
                  const govt = item.govtRecord;

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-slate-50/75 transition-colors group ${
                        item.discrepancyType === 'MISSING_IN_GSTR2A' ? 'bg-red-50/15' : 
                        item.discrepancyType === 'MISSING_IN_PURCHASE_REGISTER' ? 'bg-cyan-50/15' : ''
                      }`}
                    >
                      {/* Column 1: Supplier / Vendor */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-bold text-slate-900">
                          {pr?.supplierName || govt?.supplierTradeName || 'Unknown Supplier'}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <span>{pr?.supplierGstin || govt?.supplierGstin}</span>
                        </div>
                        {govt && (
                          <div className="mt-1 flex items-center gap-1">
                            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                              govt.gstr1FilingStatus === 'FILED' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-red-100 text-red-800 animate-pulse'
                            }`}>
                              GSTR-1: {govt.gstr1FilingStatus}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono">{govt.gstr1FilingPeriod}</span>
                          </div>
                        )}
                      </td>

                      {/* Column 2: Books Invoice (Purchase Register) */}
                      <td className="py-3.5 px-4 align-top font-mono">
                        {pr ? (
                          <>
                            <div className="font-bold text-slate-900">{pr.invoiceNumber}</div>
                            <div className="text-[11px] text-slate-500">{pr.date}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {pr.igst > 0 ? 'Inter-State (IGST)' : 'Intra-State (CGST+SGST)'}
                            </div>
                          </>
                        ) : (
                          <span className="inline-block px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 font-bold text-[10px]">
                            NOT IN BOOKS
                          </span>
                        )}
                      </td>

                      {/* Column 3: GSTR-2A Portal Invoice */}
                      <td className="py-3.5 px-4 align-top font-mono">
                        {govt ? (
                          <>
                            <div className="font-bold text-blue-900">{govt.invoiceNumber}</div>
                            <div className="text-[11px] text-slate-500">{govt.invoiceDate}</div>
                            <div className="text-[10px] text-blue-600 mt-0.5">
                              {govt.igst > 0 ? 'IGST' : 'CGST+SGST'} • {govt.source}
                            </div>
                          </>
                        ) : (
                          <span className="inline-block px-2 py-1 rounded bg-red-50 border border-red-200 text-red-800 font-bold text-[10px]">
                            NOT IN GSTR-2A
                          </span>
                        )}
                      </td>

                      {/* Column 4: Taxable Value Comparison */}
                      <td className="py-3.5 px-4 align-top text-right font-mono">
                        <div className="text-slate-900">
                          {pr ? `₹${pr.taxableValue.toLocaleString('en-IN')}` : '—'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Govt: {govt ? `₹${govt.taxableValue.toLocaleString('en-IN')}` : '—'}
                        </div>
                        {item.taxableDifference !== 0 && (
                          <div className={`text-[10px] font-bold mt-0.5 ${
                            item.taxableDifference > 0 ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                            {item.taxableDifference > 0 ? '+' : ''}₹{item.taxableDifference.toLocaleString('en-IN')}
                          </div>
                        )}
                      </td>

                      {/* Column 5: Tax Amount Comparison */}
                      <td className="py-3.5 px-4 align-top text-right font-mono">
                        <div className="font-bold text-slate-900">
                          {pr ? `₹${pr.totalTax.toLocaleString('en-IN')}` : '—'}
                        </div>
                        <div className="text-[11px] text-blue-700">
                          Govt: {govt ? `₹${govt.totalTax.toLocaleString('en-IN')}` : '—'}
                        </div>
                        {item.taxDifference !== 0 && (
                          <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.taxDifference > 0 
                              ? 'bg-rose-100 text-rose-800' 
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {item.taxDifference > 0 ? '+₹' : '-₹'}{Math.abs(item.taxDifference).toLocaleString('en-IN')}
                          </span>
                        )}
                      </td>

                      {/* Column 6: Discrepancy Status */}
                      <td className="py-3.5 px-4 align-top text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] border shadow-2xs ${badge.bgColor}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                          <span>{badge.label}</span>
                        </span>

                        <div className="mt-1.5 text-[10px] text-slate-500 max-w-[200px] mx-auto text-left leading-tight truncate" title={item.statutoryNote}>
                          {item.statutoryNote}
                        </div>

                        {/* Status Badges */}
                        <div className="flex items-center justify-center gap-1 mt-1">
                          {isNoticeSent && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                              Notice Sent
                            </span>
                          )}
                          {isPaymentHeld && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                              Payment Held
                            </span>
                          )}
                          {isResolved && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              Resolved
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 7: Actions */}
                      <td className="py-3.5 px-4 align-top text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setInspectingItem(item)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Side-by-Side Deep Field Inspection"
                          >
                            <Eye size={15} />
                          </button>

                          {(item.discrepancyType !== 'EXACT_MATCH' && item.discrepancyType !== 'MATCH_WITH_TOLERANCE') && (
                            <button
                              onClick={() => handleSendNotice(item)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Generate Official Vendor Notice"
                            >
                              <Mail size={15} />
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

        {/* Table Pagination Bar */}
        {filteredItems.length > 0 && (
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 select-none">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800 outline-none cursor-pointer"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <span>
                Showing <strong className="text-slate-800 font-mono">{startRecord}</strong> to{' '}
                <strong className="text-slate-800 font-mono">{endRecord}</strong> of{' '}
                <strong className="text-slate-800 font-mono">{filteredItems.length}</strong> items
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage <= 1}
                  className="p-1.5 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="First Page"
                >
                  <ChevronsLeft size={13} />
                </button>
                <button
                  onClick={() => setCurrentPage(safeCurrentPage - 1)}
                  disabled={safeCurrentPage <= 1}
                  className="p-1.5 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Previous Page"
                >
                  <ChevronLeft size={13} />
                </button>
                <span className="px-2 text-xs font-bold text-slate-700 font-mono">
                  Page {safeCurrentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(safeCurrentPage + 1)}
                  disabled={safeCurrentPage >= totalPages}
                  className="p-1.5 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Next Page"
                >
                  <ChevronRight size={13} />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safeCurrentPage >= totalPages}
                  className="p-1.5 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Last Page"
                >
                  <ChevronsRight size={13} />
                </button>
              </div>

              {/* Direct Jump to Page Input */}
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                <span className="text-[11px] text-slate-400">Go to:</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={jumpPageInput}
                  onChange={(e) => setJumpPageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = parseInt(jumpPageInput, 10);
                      if (!isNaN(val) && val >= 1 && val <= totalPages) {
                        setCurrentPage(val);
                        setJumpPageInput('');
                      }
                    }
                  }}
                  placeholder="#"
                  className="w-11 h-7 text-center font-mono font-bold text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => {
                    const val = parseInt(jumpPageInput, 10);
                    if (!isNaN(val) && val >= 1 && val <= totalPages) {
                      setCurrentPage(val);
                      setJumpPageInput('');
                    }
                  }}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold"
                >
                  Go
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Side-by-Side Deep Field Inspection Modal */}
      <AnimatePresence>
        {inspectingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
                    <ArrowRightLeft size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Side-by-Side Discrepancy Inspection
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Comparing Books (PR) vs Government GSTR-2A Portal
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getDiscrepancyBadge(inspectingItem.discrepancyType).bgColor}`}>
                    {getDiscrepancyBadge(inspectingItem.discrepancyType).label}
                  </span>
                  <button
                    onClick={() => setInspectingItem(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 text-xs">
                {/* Statutory Advisory Callout */}
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <ShieldCheck size={16} className="text-blue-600" />
                    <span>Statutory Audit Note (CGST Sec 16(2)(aa))</span>
                  </div>
                  <p className="text-xs text-blue-800 mt-1">
                    {inspectingItem.statutoryNote}
                  </p>
                </div>

                {/* Side-by-Side Comparison Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                        <th className="py-2.5 px-4 w-1/3">Data Attribute</th>
                        <th className="py-2.5 px-4 w-1/3 text-slate-900">
                          Purchase Register (Books)
                        </th>
                        <th className="py-2.5 px-4 w-1/3 text-blue-800">
                          GSTR-2A Government Portal
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {/* Supplier Name */}
                      <tr>
                        <td className="py-2.5 px-4 font-sans font-semibold text-slate-500">Supplier Name</td>
                        <td className="py-2.5 px-4 font-sans font-bold text-slate-900">
                          {inspectingItem.purchaseInvoice?.supplierName || '—'}
                        </td>
                        <td className="py-2.5 px-4 font-sans font-bold text-blue-900">
                          {inspectingItem.govtRecord?.supplierTradeName || '—'}
                        </td>
                      </tr>

                      {/* GSTIN */}
                      <tr>
                        <td className="py-2.5 px-4 font-sans font-semibold text-slate-500">Supplier GSTIN</td>
                        <td className="py-2.5 px-4 text-slate-800">
                          {inspectingItem.purchaseInvoice?.supplierGstin || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-blue-800">
                          {inspectingItem.govtRecord?.supplierGstin || '—'}
                        </td>
                      </tr>

                      {/* Invoice Number */}
                      <tr className={inspectingItem.purchaseInvoice?.invoiceNumber !== inspectingItem.govtRecord?.invoiceNumber ? 'bg-amber-50/50' : ''}>
                        <td className="py-2.5 px-4 font-sans font-semibold text-slate-500">Invoice Number</td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">
                          {inspectingItem.purchaseInvoice?.invoiceNumber || 'MISSING IN BOOKS'}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-blue-900">
                          {inspectingItem.govtRecord?.invoiceNumber || 'MISSING IN GSTR-2A'}
                        </td>
                      </tr>

                      {/* Invoice Date */}
                      <tr>
                        <td className="py-2.5 px-4 font-sans font-semibold text-slate-500">Invoice Date</td>
                        <td className="py-2.5 px-4 text-slate-800">
                          {inspectingItem.purchaseInvoice?.date || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-blue-800">
                          {inspectingItem.govtRecord?.invoiceDate || '—'}
                        </td>
                      </tr>

                      {/* Place of Supply */}
                      <tr className={inspectingItem.discrepancies.some(d => d.field === 'placeOfSupply') ? 'bg-rose-50/60' : ''}>
                        <td className="py-2.5 px-4 font-sans font-semibold text-slate-500">Place of Supply</td>
                        <td className="py-2.5 px-4 text-slate-800">
                          {inspectingItem.purchaseInvoice?.placeOfSupply || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-blue-800">
                          {inspectingItem.govtRecord?.placeOfSupply || '—'}
                        </td>
                      </tr>

                      {/* Taxable Value */}
                      <tr className={inspectingItem.discrepancies.some(d => d.field === 'taxableValue') ? 'bg-rose-50/60' : ''}>
                        <td className="py-2.5 px-4 font-sans font-semibold text-slate-500">Taxable Value</td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">
                          {inspectingItem.purchaseInvoice ? `₹${inspectingItem.purchaseInvoice.taxableValue.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-blue-900">
                          {inspectingItem.govtRecord ? `₹${inspectingItem.govtRecord.taxableValue.toLocaleString('en-IN')}` : '—'}
                        </td>
                      </tr>

                      {/* IGST */}
                      <tr>
                        <td className="py-2.5 px-4 font-sans font-semibold text-slate-500">Integrated Tax (IGST)</td>
                        <td className="py-2.5 px-4 text-slate-800">
                          ₹{(inspectingItem.purchaseInvoice?.igst || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-4 text-blue-800">
                          ₹{(inspectingItem.govtRecord?.igst || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>

                      {/* CGST */}
                      <tr>
                        <td className="py-2.5 px-4 font-sans font-semibold text-slate-500">Central Tax (CGST)</td>
                        <td className="py-2.5 px-4 text-slate-800">
                          ₹{(inspectingItem.purchaseInvoice?.cgst || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-4 text-blue-800">
                          ₹{(inspectingItem.govtRecord?.cgst || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>

                      {/* SGST */}
                      <tr>
                        <td className="py-2.5 px-4 font-sans font-semibold text-slate-500">State Tax (SGST)</td>
                        <td className="py-2.5 px-4 text-slate-800">
                          ₹{(inspectingItem.purchaseInvoice?.sgst || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-4 text-blue-800">
                          ₹{(inspectingItem.govtRecord?.sgst || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>

                      {/* Total Tax */}
                      <tr className="bg-slate-50 font-bold">
                        <td className="py-2.5 px-4 font-sans text-slate-800">Total Tax Amount</td>
                        <td className="py-2.5 px-4 text-slate-900">
                          ₹{(inspectingItem.purchaseInvoice?.totalTax || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-4 text-blue-900">
                          ₹{(inspectingItem.govtRecord?.totalTax || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>

                      {/* GSTR-1 Filing Status */}
                      <tr>
                        <td className="py-2.5 px-4 font-sans font-semibold text-slate-500">Supplier GSTR-1 Status</td>
                        <td className="py-2.5 px-4 font-sans text-slate-400">N/A (Recorded in Books)</td>
                        <td className="py-2.5 px-4 font-sans">
                          {inspectingItem.govtRecord ? (
                            <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
                              inspectingItem.govtRecord.gstr1FilingStatus === 'FILED' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {inspectingItem.govtRecord.gstr1FilingStatus} ({inspectingItem.govtRecord.gstr1FilingPeriod})
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Discrepancy Breakdown List */}
                {inspectingItem.discrepancies.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-800 mb-2 font-sans">Detected Field Discrepancies</h4>
                    <div className="space-y-2">
                      {inspectingItem.discrepancies.map((d, idx) => (
                        <div 
                          key={idx}
                          className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                            d.status === 'CRITICAL' 
                              ? 'bg-rose-50 border-rose-200 text-rose-900' 
                              : d.status === 'WARNING' 
                                ? 'bg-amber-50 border-amber-200 text-amber-900' 
                                : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        >
                          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <span className="font-bold">{d.fieldName}: </span>
                            <span>{d.explanation}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="p-5 border-t border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleHoldPayment(inspectingItem.id)}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors"
                  >
                    {paymentHeldIds.has(inspectingItem.id) ? 'Payment Held ✓' : 'Hold Vendor Payment'}
                  </button>

                  <button
                    onClick={() => handleResolveItem(inspectingItem.id)}
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors"
                  >
                    {resolvedIds.has(inspectingItem.id) ? 'Resolved ✓' : 'Mark Resolved / Force Match'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const item = inspectingItem;
                      setInspectingItem(null);
                      handleSendNotice(item);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <Mail size={14} />
                    <span>Send Discrepancy Notice</span>
                  </button>

                  <button
                    onClick={() => setInspectingItem(null)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Vendor Notice Generation Modal */}
      <AnimatePresence>
        {vendorNoticeItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col"
            >
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                    <Mail size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Official GST Discrepancy Notice</h3>
                    <p className="text-[11px] text-slate-400">Formal communication for Supplier Action</p>
                  </div>
                </div>
                <button
                  onClick={() => setVendorNoticeItem(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs overflow-y-auto max-h-[60vh]">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 font-mono text-slate-700 space-y-3 leading-relaxed">
                  <p>
                    <strong>To:</strong> Accounts Department, {vendorNoticeItem.purchaseInvoice?.supplierName || vendorNoticeItem.govtRecord?.supplierTradeName}
                  </p>
                  <p>
                    <strong>Supplier GSTIN:</strong> {vendorNoticeItem.purchaseInvoice?.supplierGstin || vendorNoticeItem.govtRecord?.supplierGstin}
                  </p>
                  <p>
                    <strong>Subject:</strong> URGENT: Statutory GST Discrepancy Notice - Invoice {vendorNoticeItem.purchaseInvoice?.invoiceNumber || vendorNoticeItem.govtRecord?.invoiceNumber}
                  </p>
                  <hr className="border-slate-200 my-2" />
                  <p>Dear Supplier Partner,</p>
                  <p>
                    During our monthly statutory reconciliation under Section 16(2)(aa) of the CGST Act for the period <strong>{selectedPeriod}</strong>, we observed a critical compliance discrepancy regarding the following inward supply:
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-2 text-slate-800">
                    <li><strong>Invoice Number:</strong> {vendorNoticeItem.purchaseInvoice?.invoiceNumber || vendorNoticeItem.govtRecord?.invoiceNumber}</li>
                    <li><strong>Invoice Date:</strong> {vendorNoticeItem.purchaseInvoice?.date || vendorNoticeItem.govtRecord?.invoiceDate}</li>
                    <li><strong>Recorded Books Tax:</strong> ₹{(vendorNoticeItem.purchaseInvoice?.totalTax || 0).toLocaleString('en-IN')}</li>
                    <li><strong>Government Portal Tax:</strong> ₹{(vendorNoticeItem.govtRecord?.totalTax || 0).toLocaleString('en-IN')}</li>
                    <li><strong>Variance / Disparity:</strong> ₹{Math.abs(vendorNoticeItem.taxDifference).toLocaleString('en-IN')}</li>
                  </ul>
                  <p className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-rose-900 font-sans">
                    <strong>Statutory Impact:</strong> Due to this discrepancy, we are unable to claim our eligible Input Tax Credit (ITC). Kindly upload or rectify this invoice in your upcoming GSTR-1 return (or file an amendment under Table 9A) at the earliest to prevent holding of invoice payment disbursements.
                  </p>
                  <p>
                    Please acknowledge receipt and provide the GSTR-1 ARN filing reference once amended.
                  </p>
                  <p>
                    Sincerely,<br />
                    Finance & Indirect Taxation Team
                  </p>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`URGENT: Statutory GST Discrepancy Notice for Invoice ${vendorNoticeItem.purchaseInvoice?.invoiceNumber || vendorNoticeItem.govtRecord?.invoiceNumber}`);
                    setCopyFeedback('Notice text copied to clipboard.');
                    setTimeout(() => setCopyFeedback(null), 3000);
                  }}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <Copy size={13} />
                  <span>Copy Text</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setVendorNoticeItem(null)}
                    className="px-3 py-2 text-slate-600 hover:text-slate-800 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmSendNotice}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <Send size={13} />
                    <span>Send Notice via Email</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* File Ingestion & Upload Modal for Books and GSTR-2A */}
      <AnimatePresence>
        {uploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${uploadModalOpen === 'PR' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                    {uploadModalOpen === 'PR' ? <UploadCloud size={20} /> : <FileSpreadsheet size={20} />}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      {uploadModalOpen === 'PR' ? 'Upload Purchase Register (Books)' : 'Upload Government GSTR-2A Inward Supplies'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {uploadModalOpen === 'PR' 
                        ? 'Ingest your internal ERP or Accounting Purchase Register (Excel, CSV, or JSON)'
                        : 'Ingest raw GSTN Portal downloads (GSTR-2A JSON or portal Excel export)'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setUploadModalOpen(null);
                    setUploadFile(null);
                    setParsedPreviewPr(null);
                    setParsedPreviewGovt(null);
                    setUploadError(null);
                  }}
                  className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <XCircle size={18} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-100 px-5 pt-2 gap-4 bg-slate-50/30">
                <button
                  onClick={() => setUploadActiveTab('FILE')}
                  className={`pb-2.5 text-xs font-bold transition-all border-b-2 ${
                    uploadActiveTab === 'FILE'
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Upload File
                </button>
                <button
                  onClick={() => setUploadActiveTab('GUIDE')}
                  className={`pb-2.5 text-xs font-bold transition-all border-b-2 ${
                    uploadActiveTab === 'GUIDE'
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Format Guide & Templates
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
                {uploadActiveTab === 'FILE' ? (
                  <>
                    {/* Drag & Drop Upload Zone */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/30 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv,.json"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelection(file);
                        }}
                      />
                      <div className="p-3.5 rounded-2xl bg-white shadow-xs text-blue-600 group-hover:scale-110 transition-transform mb-3 border border-slate-100">
                        <UploadCloud size={28} />
                      </div>
                      <p className="text-sm font-bold text-slate-800 mb-1">
                        {uploadFile ? uploadFile.name : 'Click to select or drag and drop file'}
                      </p>
                      <p className="text-xs text-slate-400">
                        Supported formats: Excel (.xlsx, .xls), CSV (.csv), or GST Portal JSON (.json)
                      </p>
                    </div>

                    {/* Loading State */}
                    {isProcessingUpload && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3 text-xs text-blue-800">
                        <RefreshCw size={16} className="animate-spin text-blue-600" />
                        <span>Parsing and validating document rows...</span>
                      </div>
                    )}

                    {/* Error State */}
                    {uploadError && (
                      <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800">
                        <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Failed to parse file</p>
                          <p className="text-rose-600 mt-0.5">{uploadError}</p>
                        </div>
                      </div>
                    )}

                    {/* Parsed Preview State */}
                    {uploadModalOpen === 'PR' && parsedPreviewPr && parsedPreviewPr.length > 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                            <FileCheck size={16} className="text-emerald-600" />
                            <span>Successfully parsed {parsedPreviewPr.length} invoices from Purchase Register</span>
                          </div>
                          <span className="text-[11px] font-mono text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded font-bold">
                            Total Value: ₹{parsedPreviewPr.reduce((s, i) => s + i.totalAmount, 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="max-h-40 overflow-y-auto bg-white rounded-lg border border-emerald-200/60 text-[11px]">
                          <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                              <tr>
                                <th className="p-2">Invoice #</th>
                                <th className="p-2">Supplier GSTIN</th>
                                <th className="p-2">Date</th>
                                <th className="p-2 text-right">Taxable</th>
                                <th className="p-2 text-right">Total Tax</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {parsedPreviewPr.slice(0, 5).map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 font-mono">
                                  <td className="p-2 text-slate-800">{row.invoiceNumber}</td>
                                  <td className="p-2 text-slate-600">{row.supplierGstin}</td>
                                  <td className="p-2 text-slate-600">{row.date}</td>
                                  <td className="p-2 text-right text-slate-800">₹{row.taxableValue.toLocaleString('en-IN')}</td>
                                  <td className="p-2 text-right text-emerald-700 font-bold">₹{row.totalTax.toLocaleString('en-IN')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {parsedPreviewPr.length > 5 && (
                          <p className="text-[11px] text-slate-500 italic text-center">
                            + {parsedPreviewPr.length - 5} more invoices will be imported
                          </p>
                        )}
                      </div>
                    )}

                    {uploadModalOpen === '2A' && parsedPreviewGovt && parsedPreviewGovt.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-blue-800 font-bold text-xs">
                            <FileCheck size={16} className="text-blue-600" />
                            <span>Successfully parsed {parsedPreviewGovt.length} records from GSTR-2A</span>
                          </div>
                          <span className="text-[11px] font-mono text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded font-bold">
                            Total Tax: ₹{parsedPreviewGovt.reduce((s, i) => s + i.totalTax, 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="max-h-40 overflow-y-auto bg-white rounded-lg border border-blue-200/60 text-[11px]">
                          <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                              <tr>
                                <th className="p-2">Invoice #</th>
                                <th className="p-2">Supplier Trade Name</th>
                                <th className="p-2">GSTIN</th>
                                <th className="p-2 text-right">Taxable</th>
                                <th className="p-2 text-right">Total Tax</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {parsedPreviewGovt.slice(0, 5).map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 font-mono">
                                  <td className="p-2 text-slate-800">{row.invoiceNumber}</td>
                                  <td className="p-2 text-slate-600">{row.supplierTradeName}</td>
                                  <td className="p-2 text-slate-600">{row.supplierGstin}</td>
                                  <td className="p-2 text-right text-slate-800">₹{row.taxableValue.toLocaleString('en-IN')}</td>
                                  <td className="p-2 text-right text-blue-700 font-bold">₹{row.totalTax.toLocaleString('en-IN')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {parsedPreviewGovt.length > 5 && (
                          <p className="text-[11px] text-slate-500 italic text-center">
                            + {parsedPreviewGovt.length - 5} more records will be imported
                          </p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  /* Format Guide & Templates */
                  <div className="space-y-4 text-xs">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <h4 className="font-bold text-slate-900 text-xs">Expected Column Headers in Spreadsheet / CSV</h4>
                      <p className="text-slate-600">
                        The ingestion parser automatically recognizes standard ERP and GST portal columns regardless of capitalization or naming variations:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-slate-700">
                        <li><strong>Invoice Number:</strong> Invoice Number, Inv No, Bill No, Voucher No</li>
                        <li><strong>Invoice Date:</strong> Date, Invoice Date, Inv Date (YYYY-MM-DD)</li>
                        <li><strong>Supplier GSTIN:</strong> Supplier GSTIN, GSTIN, Vendor GSTIN, CTIN</li>
                        <li><strong>Supplier Name:</strong> Supplier Name, Vendor Name, Party Name</li>
                        <li><strong>Taxable Value:</strong> Taxable Value, Taxable Amount, Base Amount</li>
                        <li><strong>Tax Heads:</strong> CGST, SGST, IGST, Cess, Total Tax</li>
                      </ul>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                      <div>
                        <p className="font-bold text-indigo-950 text-xs">Download Sample Template</p>
                        <p className="text-indigo-700 text-[11px]">Use these standardized files as a reference for your data.</p>
                      </div>
                      <button
                        onClick={uploadModalOpen === 'PR' ? downloadSamplePrTemplate : downloadSampleGstr2aTemplate}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-2xs"
                      >
                        <Download size={13} />
                        <span>Download CSV Template</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <button
                  onClick={() => {
                    setUploadModalOpen(null);
                    setUploadFile(null);
                    setParsedPreviewPr(null);
                    setParsedPreviewGovt(null);
                    setUploadError(null);
                  }}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-bold"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={uploadModalOpen === 'PR' ? downloadSamplePrTemplate : downloadSampleGstr2aTemplate}
                    className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                  >
                    <Download size={13} />
                    <span>Download Template</span>
                  </button>

                  <button
                    onClick={handleApplyUploadedData}
                    disabled={
                      (uploadModalOpen === 'PR' && (!parsedPreviewPr || parsedPreviewPr.length === 0)) ||
                      (uploadModalOpen === '2A' && (!parsedPreviewGovt || parsedPreviewGovt.length === 0))
                    }
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={14} />
                    <span>Apply & Reconcile Now</span>
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

export default Gstr2aReconciliationModule;
