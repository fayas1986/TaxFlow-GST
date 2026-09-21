import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Upload, FileSpreadsheet, AlertCircle, Loader2, CheckCircle2, 
  Download, Info, Filter, Search, ArrowRight, FileText, Check, AlertTriangle, RefreshCw,
  ArrowRightLeft, Database, Sparkles, HelpCircle, Landmark, ShieldCheck, ShieldAlert, CheckSquare, Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ImportLog, 
  Invoice, 
  ReconMatchResult, 
  AutoReconcileSummary, 
  BankStatementTransaction, 
  ReconItem 
} from '../types';
import { 
  parseCsvText, 
  validateCsvInvoices, 
  ParsedCsvRow, 
  SAMPLE_INVOICE_CSV,
  GST_STATE_CODES
} from '../utils/csvImportValidator';
import { 
  loadCustomers, 
  loadVendors, 
  createCustomer, 
  createVendor 
} from '../services/partyMasterService';
import { 
  parseBankCsv, 
  runAutoReconcile 
} from '../utils/autoReconcileEngine';

export const SAMPLE_BANK_STATEMENT_CSV = `TxnDate,Description,Amount,Type,GSTIN,PartyName,RefNo
2026-06-15,NEFT-ACME SUPPLIERS-27ABCDE1234F1Z1-INV/2026/089,18000,DEBIT,27ABCDE1234F1Z1,Acme Corp,N1652098442
2026-06-18,RTGS-GLOBAL LOGISTICS LTD-27GHIJK5678L1Z2-PAYMENT FOR INV-102,12500,DEBIT,27GHIJK5678L1Z2,Global Logistics,R20260618099
2026-06-21,UPI-TECHSUPPLIES INDIA-27MNOPQ9012R1Z3-REF 449201,4500,DEBIT,27MNOPQ9012R1Z3,TechSupplies,UPI202606214492
2026-06-28,NEFT-ALPHA TRADERS-27XYZAB1234C1Z5-SALES RECEIPT,54000,CREDIT,27XYZAB1234C1Z5,Alpha Traders,N20260628990
2026-06-30,ACH-OMEGA INFRASTRUCTURE-27DEFGH5678I1Z6,14200,CREDIT,27DEFGH5678I1Z6,Omega Infra,ACH7712093`;

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File, validInvoices?: ParsedCsvRow[], totalCount?: number, failureCount?: number) => Promise<ImportLog>;
  invoices?: Invoice[];
  onReconcileApply?: (reconciledItems: { invoiceId: string; refNo?: string }[]) => Promise<void> | void;
}

const TARGET_FIELDS = [
  { key: 'invoiceNumber', label: 'Invoice Number', required: true, desc: 'GST Rule 46 compliant unique number identifier.', alternates: ['invoicenumber', 'invoiceno', 'invno', 'number', 'invoice', 'id'] },
  { key: 'date', label: 'Invoice Date', required: true, desc: 'Date of issue (YYYY-MM-DD or DD/MM/YYYY).', alternates: ['date', 'invoicedate', 'invdate', 'billingdate', 'issue_date'] },
  { key: 'partyName', label: 'Party Name', required: true, desc: 'Legal trade name of the client, customer or vendor.', alternates: ['partyname', 'party', 'customer', 'vendor', 'party_name', 'client', 'name'] },
  { key: 'gstin', label: 'Party GSTIN', required: false, desc: '15-character Tax ID. Left empty for B2C consumer invoices.', alternates: ['gstin', 'gstnumber', 'partygstin', 'gst', 'taxid'] },
  { key: 'placeOfSupply', label: 'Place of Supply (POS)', required: false, desc: '2-digit state prefix code (e.g. 27 Maharashtra, 07 Delhi).', alternates: ['placeofsupply', 'pos', 'state', 'statecode', 'billing_state'] },
  { key: 'totalAmount', label: 'Taxable Amount / Subtotal', required: true, desc: 'Net taxable transaction value before GST taxes.', alternates: ['totalamount', 'amount', 'taxablevalue', 'subtotal', 'value', 'net_amount'] },
  { key: 'taxAmount', label: 'Tax Amount (GST)', required: false, desc: 'Integrated, Central, or State tax amount. Default is 18%.', alternates: ['taxamount', 'tax', 'gstamount', 'tax_value'] },
  { key: 'category', label: 'Transaction Category', required: false, desc: 'SALES or PURCHASE. Defaults to SALES.', alternates: ['category', 'invoicecategory', 'typecategory', 'direction'] },
  { key: 'type', label: 'Filing Type', required: false, desc: 'B2B, B2C, or EXPORT. Auto-detected from GSTIN if blank.', alternates: ['type', 'invoicetype', 'supplytype', 'invoice_type'] },
];

const BulkImportModal: React.FC<BulkImportModalProps> = ({ 
  isOpen, 
  onClose, 
  onImport,
  invoices = [],
  onReconcileApply
}) => {
  const [importMode, setImportMode] = useState<'INVOICES' | 'BANK_RECONCILIATION'>('INVOICES');
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<'UPLOAD' | 'MAPPING' | 'VALIDATION' | 'BANK_RECON_PREVIEW' | 'SUCCESS'>('UPLOAD');
  
  // Invoice Import States
  const [parsedRows, setParsedRows] = useState<ParsedCsvRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportLog | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto Field Mapping states
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({
    invoiceNumber: '',
    date: '',
    partyName: '',
    gstin: '',
    placeOfSupply: '',
    totalAmount: '',
    taxAmount: '',
    category: '',
    type: ''
  });

  const [detectedNewParties, setDetectedNewParties] = useState<{ name: string; gstin: string; type: 'CUSTOMER' | 'VENDOR' }[]>([]);
  
  // Bank Reconciliation States
  const [bankTxns, setBankTxns] = useState<BankStatementTransaction[]>([]);
  const [reconSummary, setReconSummary] = useState<AutoReconcileSummary | null>(null);
  const [reconMatchList, setReconMatchList] = useState<ReconMatchResult[]>([]);
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set());
  const [reconCategoryFilter, setReconCategoryFilter] = useState<'ALL' | 'EXACT' | 'FLAGGED' | 'UNMATCHED'>('ALL');

  // Interactive Preview Filters
  const [filterTab, setFilterTab] = useState<'ALL' | 'VALID' | 'ERRORS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state on open/close
  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setStep('UPLOAD');
      setParsedRows([]);
      setImportResult(null);
      setError(null);
      setSearchQuery('');
      setFilterTab('ALL');
      setRawHeaders([]);
      setRawRows([]);
      setDetectedNewParties([]);
      setBankTxns([]);
      setReconSummary(null);
      setReconMatchList([]);
      setSelectedMatchIds(new Set());
      setReconCategoryFilter('ALL');
    }
  }, [isOpen]);

  const findBestMatch = (alternates: string[], headers: string[]): string => {
    for (const alt of alternates) {
      const match = headers.find(h => {
        const cleanedH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanedAlt = alt.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanedH === cleanedAlt || cleanedH.includes(cleanedAlt) || cleanedAlt.includes(cleanedH);
      });
      if (match) return match;
    }
    return '';
  };

  const processFile = (selectedFile: File) => {
    const isExcel = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');
    const isCSV = selectedFile.name.endsWith('.csv') || selectedFile.name.endsWith('.txt') || selectedFile.type === 'text/csv';

    if (!isCSV && !isExcel) {
      setError('Please upload a valid CSV (.csv) or Excel (.xlsx) file.');
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setError(null);
    setIsParsing(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        
        // Dynamically import xlsx for client-side processing
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to array of arrays for headers, and array of objects for data
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
        
        if (rawData.length < 2) {
          setError('The file is empty or missing data rows.');
          return;
        }

        const validRows = rawData.filter((row: any) => row && row.some && row.some((cell: any) => cell !== undefined && cell !== null && cell !== ''));
        
        if (validRows.length < 2) {
            setError('The file is empty or missing data rows.');
            return;
        }

        if (importMode === 'BANK_RECONCILIATION') {
          // Process as Bank Statement
          let bankTransactions: BankStatementTransaction[] = [];
          
          if (isCSV) {
            const csvText = XLSX.utils.sheet_to_csv(worksheet);
            bankTransactions = parseBankCsv(csvText);
          } else {
            // Excel row mapping for bank statement
            const headers = (validRows[0] as any[]).map((h: any) => String(h || '').toLowerCase());
            const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('txn'));
            const descIdx = headers.findIndex(h => h.includes('desc') || h.includes('particulars') || h.includes('narration'));
            const amtIdx = headers.findIndex(h => h.includes('amount') || h.includes('val') || h.includes('debit') || h.includes('credit'));
            const typeIdx = headers.findIndex(h => h.includes('type') || h.includes('cr/dr'));
            const gstinIdx = headers.findIndex(h => h.includes('gstin') || h.includes('gst'));
            const refIdx = headers.findIndex(h => h.includes('ref') || h.includes('utr') || h.includes('chq'));

            for (let i = 1; i < validRows.length; i++) {
              const row = validRows[i] as any[];
              if (!row || row.length === 0) continue;
              
              const dateVal = dateIdx >= 0 ? String(row[dateIdx] || '') : new Date().toISOString().split('T')[0];
              const descVal = descIdx >= 0 ? String(row[descIdx] || '') : String(row[1] || 'Bank Statement Entry');
              const rawAmtStr = amtIdx >= 0 ? String(row[amtIdx] || '0') : '0';
              const rawAmt = parseFloat(rawAmtStr.replace(/[^0-9.-]/g, '')) || 0;
              const typeVal = typeIdx >= 0 && String(row[typeIdx] || '').toUpperCase().includes('CR') ? 'CREDIT' : 'DEBIT';
              const gstinVal = gstinIdx >= 0 ? String(row[gstinIdx] || '') : undefined;
              const refVal = refIdx >= 0 ? String(row[refIdx] || '') : `UTR-${100000 + i}`;

              bankTransactions.push({
                id: `bt-xls-${i}-${Date.now()}`,
                txnDate: dateVal,
                description: descVal,
                amount: Math.abs(rawAmt),
                type: typeVal,
                gstin: gstinVal,
                refNo: refVal,
                bankName: 'Uploaded Statement',
                accountNumber: 'Bank Account'
              });
            }
          }

          if (bankTransactions.length === 0) {
            setError('Could not extract valid bank transactions from file.');
            return;
          }

          setBankTxns(bankTransactions);

          // Perform Auto Reconciliation Engine matching against system invoices
          const reconItems: ReconItem[] = invoices.map(inv => {
            const total = inv.amount + inv.taxAmount;
            return {
              id: inv.id,
              type: inv.category === 'PURCHASE' ? 'PURCHASE' : 'SALES',
              invoiceNumber: inv.invoiceNumber,
              gstin: inv.gstin,
              partyName: inv.partyName,
              date: inv.date,
              taxAmountBooks: total,
              taxAmountPortal: total,
              difference: 0,
              status: 'MATCHED',
              riskScore: 0,
              suggestedAction: 'Match against Bank Statement'
            };
          });

          const reconRes = runAutoReconcile(reconItems, bankTransactions, 'PURCHASE', {
            dateToleranceDays: 7,
            amountTolerance: 100,
            requireGstinMatch: false
          });

          setReconSummary(reconRes);
          setReconMatchList(reconRes.matches);
          
          // Pre-select exact and probable matches for rapid batch approval
          const autoSelectIds = new Set(
            reconRes.matches
              .filter(m => m.confidence === 'EXACT' || m.confidence === 'PROBABLE')
              .map(m => m.id)
          );
          setSelectedMatchIds(autoSelectIds);

          setStep('BANK_RECON_PREVIEW');
        } else {
          // Standard Invoice Import Flow
          const headers = (validRows[0] as any[]).map((h: any) => h ? String(h).toLowerCase().replace(/[^a-z0-9]/g, '') : '');
          setRawHeaders(headers);

          const rows = [];
          for (let i = 1; i < validRows.length; i++) {
            const values = validRows[i];
            const rowObj: Record<string, string> = {};
            headers.forEach((header, idx) => {
               if (header) {
                   rowObj[header] = values[idx] ? String(values[idx]).trim() : '';
               }
            });
            rows.push(rowObj);
          }

          setRawRows(rows);

          // Auto Map
          const initialMap: Record<string, string> = {};
          TARGET_FIELDS.forEach(field => {
            initialMap[field.key] = findBestMatch(field.alternates, headers);
          });

          setFieldMappings(initialMap);
          setStep('MAPPING');
        }
      } catch (err) {
        console.error(err);
        setError('Error reading and processing file structure.');
      } finally {
        setIsParsing(false);
      }
    };
    
    reader.onerror = () => {
      setError('Error reading file from disk.');
      setIsParsing(false);
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const applyMappingsAndValidate = () => {
    const mappedRowsForValidation = rawRows.map(row => {
      const transformedRow: Record<string, string> = {};
      transformedRow['invoicenumber'] = row[fieldMappings.invoiceNumber] || '';
      transformedRow['date'] = row[fieldMappings.date] || '';
      transformedRow['partyname'] = row[fieldMappings.partyName] || '';
      transformedRow['gstin'] = row[fieldMappings.gstin] || '';
      transformedRow['placeofsupply'] = row[fieldMappings.placeOfSupply] || '';
      transformedRow['totalamount'] = row[fieldMappings.totalAmount] || '';
      transformedRow['taxamount'] = row[fieldMappings.taxAmount] || '';
      transformedRow['category'] = row[fieldMappings.category] || '';
      transformedRow['type'] = row[fieldMappings.type] || '';
      return transformedRow;
    });

    const validated = validateCsvInvoices(mappedRowsForValidation);
    setParsedRows(validated);

    // Filter New Parties
    const existingCustomers = loadCustomers();
    const existingVendors = loadVendors();

    const newPartiesList: { name: string; gstin: string; type: 'CUSTOMER' | 'VENDOR' }[] = [];
    const seenPartyGstins = new Set<string>();

    validated.forEach(row => {
      if (!row.isValid || !row.partyName) return;
      const cleanGstin = (row.gstin || '').trim().toUpperCase();
      const isPurchase = row.category === 'PURCHASE';

      if (isPurchase) {
        const exists = existingVendors.some(v => v.gstin === cleanGstin || v.name.toLowerCase() === row.partyName.toLowerCase());
        if (!exists && cleanGstin && !seenPartyGstins.has(cleanGstin)) {
          seenPartyGstins.add(cleanGstin);
          newPartiesList.push({ name: row.partyName, gstin: cleanGstin, type: 'VENDOR' });
        }
      } else {
        const exists = existingCustomers.some(c => c.gstin === cleanGstin || c.name.toLowerCase() === row.partyName.toLowerCase());
        if (!exists && cleanGstin && !seenPartyGstins.has(cleanGstin)) {
          seenPartyGstins.add(cleanGstin);
          newPartiesList.push({ name: row.partyName, gstin: cleanGstin, type: 'CUSTOMER' });
        }
      }
    });

    setDetectedNewParties(newPartiesList);
    setStep('VALIDATION');
  };

  const handleSubmitInvoices = async () => {
    if (!file) return;
    const validRows = parsedRows.filter(r => r.isValid);
    const failedCount = parsedRows.length - validRows.length;

    setIsImporting(true);
    setError(null);
    try {
      detectedNewParties.forEach(party => {
        if (party.type === 'CUSTOMER') {
          createCustomer({
            name: party.name,
            tradeName: party.name,
            gstin: party.gstin,
            pan: party.gstin ? party.gstin.substring(2, 12) : '',
            address: 'Registered during bulk file import',
            city: 'Mumbai',
            pincode: '400001',
            state: 'Maharashtra',
            stateCode: party.gstin ? party.gstin.substring(0, 2) : '27',
            contact: {
              name: 'Finance Manager',
              email: 'accounts@' + party.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com',
              phone: '+91 98300 11223'
            },
            creditTerms: 'NET_30',
            status: 'ACTIVE'
          });
        } else {
          createVendor({
            name: party.name,
            tradeName: party.name,
            gstin: party.gstin,
            pan: party.gstin ? party.gstin.substring(2, 12) : '',
            address: 'Registered during bulk file import',
            city: 'Mumbai',
            pincode: '400001',
            state: 'Maharashtra',
            stateCode: party.gstin ? party.gstin.substring(0, 2) : '27',
            contact: {
              name: 'Billing Contact',
              email: 'billing@' + party.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com',
              phone: '+91 98450 44556'
            },
            reverseCharge: false,
            compositionScheme: false,
            msmeStatus: 'NON_MSME',
            vendorCategories: ['General Suppliers'],
            creditTerms: 'NET_30',
            status: 'ACTIVE'
          });
        }
      });

      const log = await onImport(file, validRows, parsedRows.length, failedCount);
      setImportResult(log);
      setStep('SUCCESS');
    } catch (err) {
      console.error('Import error:', err);
      setError('Failed to complete bulk import. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleApplyBankReconciliation = async () => {
    if (selectedMatchIds.size === 0) {
      setError('Please select at least one matched invoice to apply reconciliation.');
      return;
    }

    setIsImporting(true);
    try {
      const itemsToApply: { invoiceId: string; refNo?: string }[] = [];
      reconMatchList.forEach(m => {
        if (selectedMatchIds.has(m.id)) {
          itemsToApply.push({
            invoiceId: m.reconItemId,
            refNo: m.bankTxn?.refNo || `UTR-${Date.now().toString().slice(-8)}`
          });
        }
      });

      if (onReconcileApply) {
        await onReconcileApply(itemsToApply);
      }

      setImportResult({
        id: `recon-log-${Date.now()}`,
        tenantId: 'default-tenant',
        fileName: file?.name || 'Bank Statement',
        timestamp: new Date().toISOString(),
        totalCount: reconMatchList.length,
        successCount: itemsToApply.length,
        failureCount: reconMatchList.length - itemsToApply.length,
        status: 'COMPLETED',
        processedFileUrl: ''
      });
      setStep('SUCCESS');
    } catch (err) {
      console.error(err);
      setError('Failed to apply bank statement reconciliation.');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const templateText = importMode === 'BANK_RECONCILIATION' ? SAMPLE_BANK_STATEMENT_CSV : SAMPLE_INVOICE_CSV;
    const fileName = importMode === 'BANK_RECONCILIATION' 
      ? 'taxflow_bank_statement_template.csv'
      : 'taxflow_gst_invoice_import_template.csv';

    const blob = new Blob([templateText], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const toggleSelectMatch = (matchId: string) => {
    const next = new Set(selectedMatchIds);
    if (next.has(matchId)) next.delete(matchId);
    else next.add(matchId);
    setSelectedMatchIds(next);
  };

  const toggleSelectAllMatches = () => {
    const filteredMatches = reconMatchList.filter(m => {
      if (reconCategoryFilter === 'EXACT') return m.confidence === 'EXACT';
      if (reconCategoryFilter === 'FLAGGED') return m.confidence === 'DISCREPANCY' || m.confidence === 'PROBABLE';
      if (reconCategoryFilter === 'UNMATCHED') return m.confidence === 'UNMATCHED';
      return true;
    });

    const allFilteredSelected = filteredMatches.every(m => selectedMatchIds.has(m.id));
    const next = new Set(selectedMatchIds);
    filteredMatches.forEach(m => {
      if (allFilteredSelected) next.delete(m.id);
      else next.add(m.id);
    });
    setSelectedMatchIds(next);
  };

  if (!isOpen) return null;

  // Filtered rows for invoice import preview grid
  const validCount = parsedRows.filter(r => r.isValid).length;
  const errorCount = parsedRows.length - validCount;

  const displayInvoiceRows = parsedRows.filter(row => {
    if (filterTab === 'VALID' && !row.isValid) return false;
    if (filterTab === 'ERRORS' && row.isValid) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchInv = row.invoiceNumber.toLowerCase().includes(q);
      const matchParty = row.partyName.toLowerCase().includes(q);
      const matchGstin = row.gstin.toLowerCase().includes(q);
      return matchInv || matchParty || matchGstin;
    }
    return true;
  });

  const displayReconMatches = reconMatchList.filter(m => {
    if (reconCategoryFilter === 'EXACT' && m.confidence !== 'EXACT') return false;
    if (reconCategoryFilter === 'FLAGGED' && (m.confidence !== 'DISCREPANCY' && m.confidence !== 'PROBABLE')) return false;
    if (reconCategoryFilter === 'UNMATCHED' && m.confidence !== 'UNMATCHED') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchInv = m.invoiceNumber.toLowerCase().includes(q);
      const matchParty = m.partyName.toLowerCase().includes(q);
      const matchGstin = (m.gstin || '').toLowerCase().includes(q);
      const matchRef = (m.bankTxn?.refNo || '').toLowerCase().includes(q);
      return matchInv || matchParty || matchGstin || matchRef;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${importMode === 'BANK_RECONCILIATION' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
              {importMode === 'BANK_RECONCILIATION' ? <Landmark size={22} /> : <FileSpreadsheet size={22} />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {importMode === 'BANK_RECONCILIATION' ? 'Bank Statement Rapid Reconciliation Utility' : 'CSV Bulk-Import Wizard'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {importMode === 'BANK_RECONCILIATION' 
                  ? 'Drag & drop bank statement CSV/Excel to auto-match payment receipts against invoices' 
                  : 'Drag & drop Excel/CSV files with auto column-mapping and Party Master auto-population'}
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

        {/* Mode Segmented Switcher & Stepper */}
        {step === 'UPLOAD' && (
          <div className="px-6 py-3 bg-slate-100/70 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setImportMode('INVOICES')}
                className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  importMode === 'INVOICES' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet size={14} /> Bulk Invoices Import
              </button>
              <button
                type="button"
                onClick={() => setImportMode('BANK_RECONCILIATION')}
                className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  importMode === 'BANK_RECONCILIATION' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Landmark size={14} /> Bank Statement Reconciliation
              </button>
            </div>

            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
              <Sparkles size={13} className="text-amber-500" />
              {importMode === 'BANK_RECONCILIATION' ? 'Matches UTR, GSTIN & Amount' : 'Auto Schema Mapping Active'}
            </span>
          </div>
        )}

        {step !== 'UPLOAD' && step !== 'SUCCESS' && (
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-start gap-4 text-xs font-bold shrink-0">
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400">
              1. File Drop
            </span>
            <ArrowRight size={12} className="text-slate-300" />
            <span className={`px-2.5 py-1 rounded-lg ${step === 'MAPPING' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
              2. {importMode === 'BANK_RECONCILIATION' ? 'Bank Statement Parsing' : 'Field Mapping'}
            </span>
            <ArrowRight size={12} className="text-slate-300" />
            <span className={`px-2.5 py-1 rounded-lg ${(step === 'VALIDATION' || step === 'BANK_RECON_PREVIEW') ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
              3. {importMode === 'BANK_RECONCILIATION' ? 'Rapid Reconciliation Preview' : 'Verification & Compliance'}
            </span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-semibold">
              <AlertCircle size={18} className="shrink-0 text-rose-600" />
              <p>{error}</p>
            </div>
          )}

          {/* STEP 1: UPLOAD DROPZONE */}
          {step === 'UPLOAD' && (
            <div className="space-y-6">
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer ${
                  file 
                    ? 'border-blue-300 bg-blue-50/30' 
                    : importMode === 'BANK_RECONCILIATION'
                    ? 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/40'
                    : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/60'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept=".csv,.txt,.xlsx,.xls"
                />
                <div className={`p-4 rounded-full border shadow-sm ${importMode === 'BANK_RECONCILIATION' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                  {isParsing ? <Loader2 size={36} className="animate-spin" /> : (importMode === 'BANK_RECONCILIATION' ? <Landmark size={36} /> : <Upload size={36} />)}
                </div>
                <div className="text-center space-y-1">
                  <p className="text-base font-bold text-slate-800">
                    {isParsing 
                      ? 'Processing Worksheet...' 
                      : importMode === 'BANK_RECONCILIATION'
                      ? 'Drop Bank Statement CSV or Excel here for Rapid Reconciliation'
                      : 'Drop CSV or Excel Invoice Spreadsheet here'}
                  </p>
                  <p className="text-xs text-slate-500 font-medium">
                    {importMode === 'BANK_RECONCILIATION'
                      ? 'Supports HDFC, ICICI, SBI, Axis corporate bank statements (.csv, .xlsx)'
                      : 'Supports native .xlsx, .xls, .csv or .txt corporate templates'}
                  </p>
                </div>
                <div className="flex gap-2 mt-2">
                  <span className="text-[10px] font-black px-2 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200 uppercase">CSV</span>
                  <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded border border-emerald-200 uppercase">Excel (.xlsx)</span>
                  <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded border border-indigo-200 uppercase">
                    {importMode === 'BANK_RECONCILIATION' ? 'Auto Match' : 'Auto Map'}
                  </span>
                </div>
              </div>

              {/* Instructions and Sample Template */}
              <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Info size={18} className="text-blue-600 animate-pulse" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                      {importMode === 'BANK_RECONCILIATION' ? 'Bank Reconciliation Matching Protocol' : 'Intelligent Ingestion System Rules'}
                    </h4>
                  </div>
                  <button 
                    onClick={downloadTemplate}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-300 text-blue-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                  >
                    <Download size={14} /> Download {importMode === 'BANK_RECONCILIATION' ? 'Bank CSV' : 'Sample CSV'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600">
                  {importMode === 'BANK_RECONCILIATION' ? (
                    <>
                      <div className="p-3 bg-white rounded-xl border border-slate-200/60">
                        <span className="font-bold text-slate-800 block mb-1">⚡ Automatic UTR Match</span>
                        Extracts UTR numbers, NEFT/RTGS transaction dates, and credit/debit totals automatically.
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-slate-200/60">
                        <span className="font-bold text-slate-800 block mb-1">🎯 Tolerance Engine</span>
                        Flags date delays or minor payment variances (e.g. cash discounts or bank charges) for quick approval.
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-slate-200/60">
                        <span className="font-bold text-slate-800 block mb-1">✅ Batch Status Update</span>
                        One click updates matched invoices to PAID with recorded bank payment references.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-3 bg-white rounded-xl border border-slate-200/60">
                        <span className="font-bold text-slate-800 block mb-1">💡 Smart Schema Detection</span>
                        Upload any custom internal sheet. Our AI matches column layouts automatically.
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-slate-200/60">
                        <span className="font-bold text-slate-800 block mb-1">👥 Party Master Sync</span>
                        If an invoice features a missing client/vendor, we auto-create their records dynamically.
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-slate-200/60">
                        <span className="font-bold text-slate-800 block mb-1">🛡️ Integrity Assurance</span>
                        Runs real-time GSTIN state prefix analysis and compliant transaction formatting on-the-fly.
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: INTERACTIVE FIELD MAPPING (FOR INVOICE IMPORT) */}
          {step === 'MAPPING' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50/50 border border-blue-200/60 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Dynamic Column Mapping Workspace</h4>
                    <p className="text-xs text-slate-500 font-medium">Verify how the file columns map to standard invoice schemas.</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-blue-700 bg-blue-100/60 px-2.5 py-1 rounded-lg">
                  {rawHeaders.length} Columns Detected
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TARGET_FIELDS.map((field) => {
                  const currentValue = fieldMappings[field.key] || '';
                  const isMapped = currentValue !== '';
                  const isAutoMapped = isMapped && field.alternates.some(alt => currentValue.toLowerCase().replace(/[^a-z0-9]/g, '').includes(alt.toLowerCase().replace(/[^a-z0-9]/g, '')));

                  return (
                    <div 
                      key={field.key}
                      className={`p-4 rounded-2xl border transition-all ${
                        isMapped 
                          ? 'bg-white border-slate-200/80 hover:border-slate-300' 
                          : field.required 
                          ? 'bg-rose-50/30 border-rose-200' 
                          : 'bg-slate-50/50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-800">{field.label}</span>
                            {field.required && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded">
                                Required
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 leading-normal mt-0.5">{field.desc}</p>
                        </div>

                        <div>
                          {isMapped ? (
                            isAutoMapped ? (
                              <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 whitespace-nowrap">
                                Auto Mapped
                              </span>
                            ) : (
                              <span className="text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 whitespace-nowrap">
                                Custom Override
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] font-black bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200 whitespace-nowrap">
                              Unmapped
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="relative mt-2">
                        <select
                          value={currentValue}
                          onChange={(e) => setFieldMappings({ ...fieldMappings, [field.key]: e.target.value })}
                          className={`w-full text-xs font-semibold bg-slate-50 hover:bg-slate-100/80 border rounded-xl py-2 pl-3 pr-8 focus:outline-none transition-all ${
                            isMapped ? 'border-slate-200 text-slate-700' : 'border-rose-300 text-rose-700 bg-rose-50/10'
                          }`}
                        >
                          <option value="">-- Choose file column --</option>
                          {rawHeaders.map((header, i) => (
                            <option key={i} value={header}>{header}</option>
                          ))}
                        </select>
                        <ArrowRightLeft size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3A: BANK RECONCILIATION PREVIEW WORKSPACE */}
          {step === 'BANK_RECON_PREVIEW' && reconSummary && (
            <div className="space-y-4">
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4">
                  <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Exact Matches</span>
                  <p className="text-xl font-black text-emerald-900 mt-1">{reconSummary.exactMatchesCount}</p>
                  <p className="text-[11px] text-emerald-700 font-medium">Auto-verified amount & date</p>
                </div>

                <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4">
                  <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Flagged / Variances</span>
                  <p className="text-xl font-black text-amber-900 mt-1">{reconSummary.flaggedDiscrepanciesCount}</p>
                  <p className="text-[11px] text-amber-700 font-medium">Minor date/amount tolerance</p>
                </div>

                <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-4">
                  <span className="text-[10px] font-black uppercase text-rose-700 tracking-wider">Unmatched Invoices</span>
                  <p className="text-xl font-black text-rose-900 mt-1">{reconSummary.unmatchedCount}</p>
                  <p className="text-[11px] text-rose-700 font-medium">Missing bank statement debit</p>
                </div>

                <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4">
                  <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">Selected for Batch</span>
                  <p className="text-xl font-black text-indigo-900 mt-1">{selectedMatchIds.size}</p>
                  <p className="text-[11px] text-indigo-700 font-medium">Ready to mark PAID</p>
                </div>
              </div>

              {/* Filter Tabs & Search Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                  <button
                    onClick={() => setReconCategoryFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      reconCategoryFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    All Matches ({reconMatchList.length})
                  </button>
                  <button
                    onClick={() => setReconCategoryFilter('EXACT')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      reconCategoryFilter === 'EXACT' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Exact ({reconSummary.exactMatchesCount})
                  </button>
                  <button
                    onClick={() => setReconCategoryFilter('FLAGGED')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      reconCategoryFilter === 'FLAGGED' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Flagged ({reconSummary.flaggedDiscrepanciesCount})
                  </button>
                  <button
                    onClick={() => setReconCategoryFilter('UNMATCHED')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      reconCategoryFilter === 'UNMATCHED' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Unmatched ({reconSummary.unmatchedCount})
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search invoice, party, UTR..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Reconciliation Results Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">
                        <button onClick={toggleSelectAllMatches} className="text-slate-500 hover:text-slate-800">
                          <CheckSquare size={16} />
                        </button>
                      </th>
                      <th className="py-2.5 px-3">Invoice & Party</th>
                      <th className="py-2.5 px-3">Bank Statement Narration</th>
                      <th className="py-2.5 px-3 text-right">Invoice / Bank Amt</th>
                      <th className="py-2.5 px-3">Match Confidence</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium">
                    {displayReconMatches.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400">
                          No matching reconciliation entries.
                        </td>
                      </tr>
                    ) : (
                      displayReconMatches.map((item) => {
                        const isSelected = selectedMatchIds.has(item.id);

                        return (
                          <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/20' : ''}`}>
                            <td className="py-3 px-3 text-center">
                              <button onClick={() => toggleSelectMatch(item.id)} className="text-slate-600 hover:text-indigo-600">
                                {isSelected ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} className="text-slate-300" />}
                              </button>
                            </td>

                            <td className="py-3 px-3">
                              <p className="font-bold text-slate-900">{item.invoiceNumber}</p>
                              <p className="text-[11px] text-slate-500 truncate max-w-[150px]">{item.partyName}</p>
                              <p className="text-[10px] text-slate-400 font-mono">Date: {item.date}</p>
                            </td>

                            <td className="py-3 px-3 max-w-[220px]">
                              {item.bankTxn ? (
                                <div>
                                  <p className="text-xs font-semibold text-slate-800 truncate" title={item.bankTxn.description}>
                                    {item.bankTxn.description}
                                  </p>
                                  <p className="text-[10px] font-mono text-indigo-700 font-bold mt-0.5">
                                    Ref: {item.bankTxn.refNo} ({item.bankTxn.txnDate})
                                  </p>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">No Bank Entry Found</span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right font-mono">
                              <p className="font-bold text-slate-900">₹{item.invoiceAmount.toLocaleString()}</p>
                              {item.bankTxn && (
                                <p className={`text-[11px] font-bold ${item.invoiceAmount === item.bankTxn.amount ? 'text-emerald-600' : 'text-amber-600'}`}>
                                  Bank: ₹{item.bankTxn.amount.toLocaleString()}
                                </p>
                              )}
                            </td>

                            <td className="py-3 px-3">
                              {item.confidence === 'EXACT' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 size={11} /> 100% Exact Match
                                </span>
                              )}
                              {item.confidence === 'PROBABLE' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  <Sparkles size={11} /> High Match ({item.matchScore}%)
                                </span>
                              )}
                              {item.confidence === 'DISCREPANCY' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200" title={item.discrepancyReasons.join('; ')}>
                                  <AlertTriangle size={11} /> Variance ({item.matchScore}%)
                                </span>
                              )}
                              {item.confidence === 'UNMATCHED' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  <AlertCircle size={11} /> Unmatched
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => toggleSelectMatch(item.id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                {isSelected ? 'Selected' : 'Select'}
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
          )}

          {/* STEP 3B: INVOICE VALIDATION PREVIEW */}
          {step === 'VALIDATION' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-50 border border-slate-200/80 rounded-2xl gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{file?.name}</p>
                    <p className="text-[11px] text-slate-500">{parsedRows.length} total rows processed through column mapping</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    {validCount} Valid
                  </div>
                  {errorCount > 0 && (
                    <div className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                      <AlertCircle size={14} className="text-rose-600" />
                      {errorCount} Errors
                    </div>
                  )}

                  {/* ITC Eligibility Automated Tagging Summary */}
                  {parsedRows.some(r => r.category === 'PURCHASE') && (
                    <div className="flex items-center gap-1.5 pl-2 border-l border-slate-300">
                      <span className="px-2.5 py-1 bg-teal-50 text-teal-800 border border-teal-200 rounded-xl text-[11px] font-bold flex items-center gap-1">
                        <ShieldCheck size={13} className="text-teal-600" />
                        ITC Eligible: {parsedRows.filter(r => r.category === 'PURCHASE' && !r.isBlockedItc).length}
                      </span>
                      {parsedRows.filter(r => r.category === 'PURCHASE' && r.isBlockedItc).length > 0 && (
                        <span className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-[11px] font-bold flex items-center gap-1">
                          <ShieldAlert size={13} className="text-rose-600" />
                          ITC Blocked: {parsedRows.filter(r => r.category === 'PURCHASE' && r.isBlockedItc).length}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {detectedNewParties.length > 0 && (
                <div className="p-4 bg-emerald-50/50 border border-emerald-200/70 rounded-2xl space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
                      <Database size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles size={14} className="animate-pulse text-emerald-600" />
                        Party Master Sync: {detectedNewParties.length} New Entities Discovered
                      </h4>
                      <p className="text-xs text-emerald-700 font-medium leading-relaxed mt-0.5">
                        These clients/vendors are missing from your database and will be auto-created in Party Master upon import.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Invoice No</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Party Name</th>
                      <th className="py-2.5 px-3">GSTIN</th>
                      <th className="py-2.5 px-3 text-right">Taxable Amt</th>
                      <th className="py-2.5 px-3">ITC Classification</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium">
                    {displayInvoiceRows.map((row) => (
                      <tr key={row.rowIndex} className={`hover:bg-slate-50/80 transition-colors ${!row.isValid ? 'bg-rose-50/20' : ''}`}>
                        <td className="py-2.5 px-3 font-mono text-slate-400">{row.rowIndex}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{row.invoiceNumber || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{row.date || '—'}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 truncate max-w-[140px]">{row.partyName || '—'}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-800 font-bold">{row.gstin || 'B2C Consumer'}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">₹{row.totalAmount.toLocaleString()}</td>
                        <td className="py-2.5 px-3">
                          {row.category === 'PURCHASE' ? (
                            !row.isBlockedItc ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200" title={row.itcReason}>
                                <ShieldCheck size={11} className="text-teal-600" /> ITC Eligible
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200" title={`${row.itcStatutoryClause}: ${row.itcReason}`}>
                                <ShieldAlert size={11} className="text-rose-600" /> Non-Eligible (Blocked)
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              Output Tax
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                              <CheckCircle2 size={12} /> Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/60">
                              <AlertCircle size={12} /> Invalid
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS RESULT SCREEN */}
          {step === 'SUCCESS' && importResult && (
            <div className="py-6 flex flex-col items-center text-center space-y-6">
              <div className="w-16 h-16 rounded-full flex items-center justify-center bg-emerald-100 text-emerald-600 animate-bounce">
                <CheckCircle2 size={40} />
              </div>
              
              <div className="space-y-1">
                <h4 className="text-xl font-bold text-slate-900">
                  {importMode === 'BANK_RECONCILIATION' ? 'Bank Reconciliation Completed!' : 'Bulk Import Completed!'}
                </h4>
                <p className="text-slate-500 text-xs">
                  Processed file: <span className="font-bold text-slate-700">{importResult.fileName}</span>
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 w-full p-4 bg-slate-50 rounded-2xl border border-slate-200">
                 <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Records</p>
                    <p className="text-xl font-black text-slate-800">{importResult.totalCount}</p>
                 </div>
                 <div className="space-y-1 border-x border-slate-200">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      {importMode === 'BANK_RECONCILIATION' ? 'Invoices Reconciled' : 'Invoices Imported'}
                    </p>
                    <p className="text-xl font-black text-emerald-600">{importResult.successCount}</p>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      {importMode === 'BANK_RECONCILIATION' ? 'Payment Status' : 'Parties Created'}
                    </p>
                    <p className="text-xl font-black text-indigo-600">
                      {importMode === 'BANK_RECONCILIATION' ? 'PAID' : detectedNewParties.length}
                    </p>
                 </div>
              </div>

              <div className="w-full text-left p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-medium leading-relaxed space-y-1">
                {importMode === 'BANK_RECONCILIATION' ? (
                  <p>✅ <span className="font-bold">{importResult.successCount} invoices</span> have been marked as PAID/RECONCILED with recorded bank statement UTR references.</p>
                ) : (
                  <p>✅ <span className="font-bold">{importResult.successCount} valid invoices</span> have been committed to the Invoice ledger.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          {step === 'UPLOAD' && (
            <div className="w-full flex justify-between items-center">
              {importMode === 'INVOICES' ? (
                <button 
                  onClick={() => {
                    const blob = new Blob([SAMPLE_INVOICE_CSV], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'invoice_import_template.csv';
                    a.click();
                    window.URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-xl transition-colors shadow-sm"
                  title="Download a pre-formatted CSV template with standard headers"
                >
                  <Download size={14} />
                  Download Template
                </button>
              ) : <div />}
              <button 
                onClick={onClose} 
                className="px-5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {step === 'MAPPING' && (
            <>
              <button 
                onClick={() => { setStep('UPLOAD'); setFile(null); }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
              >
                Back to Upload
              </button>
              <button 
                onClick={applyMappingsAndValidate}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
              >
                Validate Column Mapping
                <ArrowRight size={14} />
              </button>
            </>
          )}

          {step === 'BANK_RECON_PREVIEW' && (
            <>
              <button 
                onClick={() => { setStep('UPLOAD'); setFile(null); }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
              >
                Upload Different File
              </button>
              <button 
                onClick={handleApplyBankReconciliation}
                disabled={selectedMatchIds.size === 0 || isImporting}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50 transition-all"
              >
                {isImporting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                Apply Rapid Reconciliation ({selectedMatchIds.size} Invoices)
              </button>
            </>
          )}

          {step === 'VALIDATION' && (
            <>
              <button 
                onClick={() => { setStep('MAPPING'); }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
              >
                Back to Mapping
              </button>
              <button 
                onClick={handleSubmitInvoices}
                disabled={validCount === 0 || isImporting}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50 transition-all"
              >
                {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Check size={14} />}
                Commit {validCount} Invoices
              </button>
            </>
          )}

          {step === 'SUCCESS' && (
            <div className="w-full flex justify-end">
              <button 
                onClick={onClose} 
                className="px-8 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-sm"
              >
                Close & View Updated Invoices
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default BulkImportModal;
