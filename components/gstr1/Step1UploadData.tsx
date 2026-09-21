import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  UploadCloud, FileSpreadsheet, RefreshCw, FileDown, CheckCircle2, 
  Loader2, Search, Filter, Trash2, Edit2, ArrowRight, Database,
  Sparkles, Check, AlertCircle, Layers, FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Invoice } from '../../types';
import { Gstr1WizardSharedProps } from './types';

export const Step1UploadData: React.FC<Gstr1WizardSharedProps> = ({
  invoices,
  activeInvoices,
  excludedInvoices,
  tenantId,
  currentTenant,
  totalTaxableValue,
  totalTaxValue,
  totalInvoiceValue,
  onUpdateInvoices,
  onToggleExcludeInvoice,
  onEditInvoice,
  onNavigateStep
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadedFileInvoices, setUploadedFileInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'B2B' | 'B2C' | 'EXPORT'>('ALL');
  const [activeSubTab, setActiveSubTab] = useState<'INTAKE' | 'INVOICES_PREVIEW'>('INTAKE');
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = (file: File) => {
    setUploadProgress(15);
    setUploadMessage(`Reading "${file.name}"...`);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        setUploadProgress(45);
        setUploadMessage('Parsing sheet columns and tax rates...');
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        setUploadProgress(75);
        setUploadMessage('Structuring outward sales transactions...');
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet) as any[];

        if (!rows || rows.length === 0) {
          throw new Error('Spreadsheet appears to be empty.');
        }

        const mappedInvoices: Invoice[] = rows.map((row, i) => {
          const invNum = row['Invoice Number'] || row['Invoice No'] || row['InvoiceNo'] || `INV/2026/UPL-${1000 + i}`;
          const party = row['Party Name'] || row['Receiver Name'] || row['Customer'] || 'Direct Retail Walk-in';
          const gstin = (row['Receiver GSTIN'] || row['GSTIN'] || row['Party GSTIN'] || '').toString().trim().toUpperCase();
          const taxableVal = parseFloat(row['Taxable Value'] || row['Value'] || row['Amount'] || '5000');
          const taxRt = parseFloat(row['Tax Rate'] || row['GST Rate'] || row['Rate'] || '18');
          const taxAmt = taxableVal * (taxRt / 100);
          const pos = (row['Place of Supply'] || row['POS'] || currentTenant.stateCode).toString().padStart(2, '0');
          const isIntra = pos === currentTenant.stateCode;
          const hsn = (row['HSN/SAC Code'] || row['HSN'] || row['SAC'] || '998311').toString().trim();
          const uqc = (row['UQC'] || row['Unit'] || 'NOS').toString().trim();
          const qty = parseFloat(row['Quantity'] || row['Qty'] || '1');
          const date = row['Invoice Date'] || row['Date'] || '2026-08-10';

          return {
            id: `upl-${Date.now()}-${i}`,
            tenantId,
            invoiceNumber: invNum,
            partyName: party,
            gstin,
            placeOfSupply: pos,
            date,
            amount: taxableVal,
            taxAmount: taxAmt,
            taxDetails: {
              taxableValue: taxableVal,
              cgst: isIntra ? taxAmt / 2 : 0,
              sgst: isIntra ? taxAmt / 2 : 0,
              igst: !isIntra ? taxAmt : 0,
              utgst: 0,
              cess: 0
            },
            type: gstin ? 'B2B' : 'B2C',
            category: 'SALES',
            docType: 'INVOICE',
            status: 'UPLOADED',
            items: [
              {
                id: `itm-${Date.now()}-${i}`,
                description: row['Description'] || 'Outward taxable supply of goods/services',
                hsnSac: hsn,
                quantity: qty,
                unit: uqc,
                rate: taxableVal,
                taxRate: taxRt,
                taxableValue: taxableVal,
                taxAmount: taxAmt
              }
            ]
          };
        });

        setTimeout(() => {
          setUploadProgress(100);
          setUploadedFileInvoices(mappedInvoices);
          setUploadMessage(`Successfully parsed ${mappedInvoices.length} transactions from "${file.name}"!`);
        }, 800);
      } catch (err: any) {
        console.error('File parsing error:', err);
        setUploadProgress(null);
        setUploadMessage(`Parsing failed: ${err.message || 'Invalid spreadsheet structure'}`);
      }
    };

    reader.onerror = () => {
      setUploadProgress(null);
      setUploadMessage('Failed to read file from disk.');
    };

    reader.readAsBinaryString(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleCommitUploaded = () => {
    if (uploadedFileInvoices.length > 0) {
      onUpdateInvoices([...uploadedFileInvoices, ...invoices]);
      setUploadedFileInvoices([]);
      setUploadProgress(null);
      setUploadMessage('');
      setActiveSubTab('INVOICES_PREVIEW');
    }
  };

  const handleDownloadTemplate = () => {
    const sampleRows = [
      {
        "Invoice Number": "INV/2026/0801",
        "Invoice Date": "2026-08-04",
        "Party Name": "Tata Consultancy Services Ltd",
        "Receiver GSTIN": "27AAACT2727Q1ZW",
        "Place of Supply": "27",
        "HSN/SAC Code": "998313",
        "Description": "IT infrastructure consulting & cloud setup",
        "Quantity": 1,
        "UQC": "SAC",
        "Taxable Value": 350000,
        "Tax Rate": 18,
        "Reverse Charge": "N"
      },
      {
        "Invoice Number": "INV/2026/0802",
        "Invoice Date": "2026-08-07",
        "Party Name": "Infosys Technologies Ltd",
        "Receiver GSTIN": "29AABCI1234B1Z8",
        "Place of Supply": "29",
        "HSN/SAC Code": "998314",
        "Description": "Software engineering modules & testing",
        "Quantity": 2,
        "UQC": "SAC",
        "Taxable Value": 280000,
        "Tax Rate": 18,
        "Reverse Charge": "N"
      },
      {
        "Invoice Number": "INV/2026/0803",
        "Invoice Date": "2026-08-11",
        "Party Name": "Rahul Sharma (Direct Walk-in)",
        "Receiver GSTIN": "",
        "Place of Supply": "27",
        "HSN/SAC Code": "847130",
        "Description": "High-performance enterprise laptop terminals",
        "Quantity": 4,
        "UQC": "NOS",
        "Taxable Value": 180000,
        "Tax Rate": 18,
        "Reverse Charge": "N"
      },
      {
        "Invoice Number": "INV/2026/0804",
        "Invoice Date": "2026-08-14",
        "Party Name": "Reliance Retail Hypermarkets",
        "Receiver GSTIN": "27AAACR1034D1Z2",
        "Place of Supply": "27",
        "HSN/SAC Code": "8471",
        "Description": "Network routers and switch gear",
        "Quantity": 10,
        "UQC": "NOS",
        "Taxable Value": 120000,
        "Tax Rate": 18,
        "Reverse Charge": "N"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "GSTR1_Sales");
    XLSX.writeFile(wb, "GSTR1_Sales_Upload_Template.xlsx");
  };

  const handleLoadSampleDataset = () => {
    // Loads realistic dataset containing sample scenarios including known audit discrepancies for Step 3 demonstration
    const sampleDataset: Invoice[] = [
      {
        id: `demo-${Date.now()}-1`,
        tenantId,
        invoiceNumber: 'INV/2026/0911',
        partyName: 'Reliance Retail Industries Ltd',
        gstin: '27AAACR1034D1Z2',
        placeOfSupply: '27',
        date: '2026-08-02',
        amount: 450000,
        taxAmount: 81000,
        taxDetails: { taxableValue: 450000, cgst: 40500, sgst: 40500, igst: 0, utgst: 0, cess: 0 },
        type: 'B2B',
        category: 'SALES',
        docType: 'INVOICE',
        status: 'UPLOADED',
        items: [{ id: 'itm-d1', description: 'Enterprise Rack Servers & Blades', hsnSac: '84713010', quantity: 3, unit: 'NOS', rate: 150000, taxRate: 18, taxableValue: 450000, taxAmount: 81000 }]
      },
      {
        id: `demo-${Date.now()}-2`,
        tenantId,
        invoiceNumber: 'INV/2026/0912',
        partyName: 'Wipro Digital Services',
        gstin: '29AABCW9928K1Z5',
        placeOfSupply: '29',
        date: '2026-08-06',
        amount: 320000,
        taxAmount: 57600,
        taxDetails: { taxableValue: 320000, cgst: 0, sgst: 0, igst: 57600, utgst: 0, cess: 0 },
        type: 'B2B',
        category: 'SALES',
        docType: 'INVOICE',
        status: 'UPLOADED',
        items: [{ id: 'itm-d2', description: 'Cloud Architecture & DevOps Consulting', hsnSac: '998314', quantity: 1, unit: 'SAC', rate: 320000, taxRate: 18, taxableValue: 320000, taxAmount: 57600 }]
      },
      {
        id: `demo-${Date.now()}-3`,
        tenantId,
        invoiceNumber: 'INV/2026/0913',
        partyName: 'Zenith Global Technologies',
        gstin: '', // Flagged in Step 3: B2B without GSTIN!
        placeOfSupply: '27',
        date: '2026-08-09',
        amount: 85000,
        taxAmount: 15300,
        taxDetails: { taxableValue: 85000, cgst: 7650, sgst: 7650, igst: 0, utgst: 0, cess: 0 },
        type: 'B2B',
        category: 'SALES',
        docType: 'INVOICE',
        status: 'UPLOADED',
        items: [{ id: 'itm-d3', description: 'Security Firewall Licensing', hsnSac: '998313', quantity: 2, unit: 'NOS', rate: 42500, taxRate: 18, taxableValue: 85000, taxAmount: 15300 }]
      },
      {
        id: `demo-${Date.now()}-4`,
        tenantId,
        invoiceNumber: 'INV/2026/0914',
        partyName: 'Acro Precision Instruments',
        gstin: '07AAACA1122C1Z4',
        placeOfSupply: '', // Flagged in Step 3: Missing POS!
        date: '2026-08-12',
        amount: 140000,
        taxAmount: 25200,
        taxDetails: { taxableValue: 140000, cgst: 0, sgst: 0, igst: 25200, utgst: 0, cess: 0 },
        type: 'B2B',
        category: 'SALES',
        docType: 'INVOICE',
        status: 'UPLOADED',
        items: [{ id: 'itm-d4', description: 'Precision Diagnostic Sensors', hsnSac: '903180', quantity: 5, unit: 'NOS', rate: 28000, taxRate: 18, taxableValue: 140000, taxAmount: 25200 }]
      },
      {
        id: `demo-${Date.now()}-5`,
        tenantId,
        invoiceNumber: 'INV/2026/0915',
        partyName: 'Sunil Mehta (Direct Retail)',
        gstin: '',
        placeOfSupply: '27',
        date: '2026-08-16',
        amount: 42000,
        taxAmount: 7560,
        taxDetails: { taxableValue: 42000, cgst: 3780, sgst: 3780, igst: 0, utgst: 0, cess: 0 },
        type: 'B2C',
        category: 'SALES',
        docType: 'INVOICE',
        status: 'UPLOADED',
        items: [{ id: 'itm-d5', description: 'Ergonomic Standing Desks', hsnSac: '', quantity: 2, unit: 'NOS', rate: 21000, taxRate: 18, taxableValue: 42000, taxAmount: 7560 }] // Flagged: Missing HSN!
      },
      {
        id: `demo-${Date.now()}-6`,
        tenantId,
        invoiceNumber: 'INV/2026/0916',
        partyName: 'Starlight Retail Store',
        gstin: '',
        placeOfSupply: '27',
        date: '2026-08-18',
        amount: 60000,
        taxAmount: 9800, // Discrepancy! 60,000 * 18% = 10,800
        taxDetails: { taxableValue: 60000, cgst: 4900, sgst: 4900, igst: 0, utgst: 0, cess: 0 },
        type: 'B2C',
        category: 'SALES',
        docType: 'INVOICE',
        status: 'UPLOADED',
        items: [{ id: 'itm-d6', description: 'Office Storage Metal Cabinets', hsnSac: '940310', quantity: 3, unit: 'NOS', rate: 20000, taxRate: 18, taxableValue: 60000, taxAmount: 9800 }]
      }
    ];

    onUpdateInvoices(sampleDataset);
    setActiveSubTab('INVOICES_PREVIEW');
  };

  const handleSystemSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      if (invoices.length === 0) {
        handleLoadSampleDataset();
      }
    }, 700);
  };

  // Filtered invoices for preview tab
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          inv.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (inv.gstin && inv.gstin.toLowerCase().includes(searchQuery.toLowerCase()));
    if (typeFilter === 'ALL') return matchesSearch;
    return matchesSearch && inv.type === typeFilter;
  });

  const b2bCount = activeInvoices.filter(i => i.type === 'B2B').length;
  const b2cCount = activeInvoices.filter(i => i.type === 'B2C').length;
  const expCount = activeInvoices.filter(i => i.type === 'EXPORT').length;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-6"
    >
      {/* Top Banner & Context */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">
              Step 1 of 4: Intake & Register
            </span>
            <span className="text-xs font-semibold text-slate-400">GSTR-1 Outward Supplies</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-1">Upload Outward Sales Data</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Ingest outward sales invoices for taxpayer <span className="font-mono font-bold text-slate-800">{currentTenant.gstin}</span> via ERP sync, file upload, or sample template.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
            title="Download Excel outward sales template with sample columns"
          >
            <FileDown size={14} className="text-blue-600" />
            Download Excel Template
          </button>
          <button
            onClick={handleLoadSampleDataset}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
            title="Load sample dataset with realistic B2B, B2C, and audit scenarios"
          >
            <Sparkles size={14} className="text-amber-300" />
            Load Sample Sales Dataset
          </button>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Invoices</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-mono font-black text-slate-900">{activeInvoices.length}</span>
            <span className="text-[11px] font-semibold text-slate-500">records</span>
          </div>
          <div className="flex gap-2 text-[10px] text-slate-500 mt-1 font-semibold">
            <span>{b2bCount} B2B</span> • <span>{b2cCount} B2C</span> • <span>{expCount} Exp</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Taxable Turnover</span>
          <div className="text-2xl font-mono font-black text-slate-900 mt-1">
            ₹{totalTaxableValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">Subject to GST</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Output GST Total</span>
          <div className="text-2xl font-mono font-black text-blue-600 mt-1">
            ₹{totalTaxValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-slate-400 font-semibold mt-1 block">CGST + SGST + IGST</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gross Invoice Value</span>
          <div className="text-2xl font-mono font-black text-slate-900 mt-1">
            ₹{totalInvoiceValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-slate-400 font-semibold mt-1 block">Turnover + Tax Liability</span>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex bg-slate-200/70 p-1 rounded-xl max-w-md">
        <button
          onClick={() => setActiveSubTab('INTAKE')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeSubTab === 'INTAKE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UploadCloud size={14} /> Data Intake Channels
        </button>
        <button
          onClick={() => setActiveSubTab('INVOICES_PREVIEW')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeSubTab === 'INVOICES_PREVIEW' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers size={14} /> Loaded Invoices ({activeInvoices.length})
        </button>
      </div>

      {activeSubTab === 'INTAKE' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Intake Methods */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Select Sales Data Intake Method</h3>
                <p className="text-slate-500 text-xs mt-0.5">Choose how you want to bring transactions into the GSTR-1 wizard workspace.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Method 1: ERP Sync */}
                <button
                  onClick={handleSystemSync}
                  disabled={isSyncing}
                  className="border border-slate-200 hover:border-blue-500 hover:bg-blue-50/20 text-left p-5 rounded-xl transition-all group relative overflow-hidden text-slate-800"
                >
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''} />
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs">Live ERP / Database Sync</h4>
                  <p className="text-slate-500 text-[11px] mt-1 leading-relaxed">
                    Pull current sales register transactions from TaxFlow cloud billing database.
                  </p>
                  <span className="inline-block mt-3 text-[10px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                    Direct Sync
                  </span>
                </button>

                {/* Method 2: Manual Spreadsheet Picker */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-slate-200 hover:border-amber-500 hover:bg-amber-50/20 text-left p-5 rounded-xl transition-all group relative overflow-hidden text-slate-800"
                >
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <FileSpreadsheet size={20} />
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs">Browse Sales Spreadsheet</h4>
                  <p className="text-slate-500 text-[11px] mt-1 leading-relaxed">
                    Select exported sales Excel (.xlsx, .xls) or GST portal offline tool CSV files.
                  </p>
                  <span className="inline-block mt-3 text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                    Excel / CSV
                  </span>
                </button>
              </div>

              {/* Drag & Drop Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/50 scale-[0.99]'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/60'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                />
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  <UploadCloud size={24} />
                </div>
                <h4 className="font-bold text-slate-800 text-xs">Drag and drop your outward sales file here</h4>
                <p className="text-slate-500 text-[11px] mt-1">Supports standard Excel (.xlsx, .xls) & CSV files</p>
                <span className="mt-3 px-3 py-1 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg shadow-sm">
                  Or click to browse files
                </span>
              </div>

              {/* Upload Progress / Status */}
              {uploadProgress !== null && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 animate-in fade-in">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      {uploadProgress < 100 ? (
                        <Loader2 size={13} className="animate-spin text-blue-600" />
                      ) : (
                        <CheckCircle2 size={13} className="text-emerald-600" />
                      )}
                      {uploadMessage}
                    </span>
                    <span className="font-mono font-bold text-slate-600">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Parsed Staging Preview (if file parsed) */}
              {uploadedFileInvoices.length > 0 && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 animate-in fade-in">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-900">
                        {uploadedFileInvoices.length} Transactions Staged for Integration
                      </span>
                    </div>
                    <button
                      onClick={handleCommitUploaded}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1 active:scale-95"
                    >
                      <Check size={14} /> Add to Wizard Workspace
                    </button>
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Click "Add to Wizard Workspace" to merge these records with your current filing dataset.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Ingestion Guide & Next Step */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm">Filing Period & Taxpayer Profile</h3>
              
              <div className="space-y-2 text-xs divide-y divide-slate-100">
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Taxpayer GSTIN</span>
                  <span className="font-mono font-bold text-slate-900">{currentTenant.gstin}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Legal Name</span>
                  <span className="font-semibold text-slate-800">{currentTenant.name}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Principal State Code</span>
                  <span className="font-mono font-bold text-slate-800">{currentTenant.stateCode} (Maharashtra)</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Return Form</span>
                  <span className="font-bold text-blue-600">GSTR-1 (Outward Supplies)</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText size={14} className="text-blue-600" />
                  What happens after upload?
                </h4>
                <ul className="text-[11px] text-slate-600 space-y-1.5 list-disc list-inside leading-relaxed">
                  <li><strong>Step 2:</strong> Table 12 consolidates HSN/SAC outward categories automatically.</li>
                  <li><strong>Step 3:</strong> The pre-filing audit detects missing GSTINs, HSN codes, and POS discrepancies with 1-click auto-rectification.</li>
                  <li><strong>Step 4:</strong> Official GSTN JSON offline payload is compiled and ready for portal upload.</li>
                </ul>
              </div>

              <button
                onClick={() => onNavigateStep(1)}
                disabled={activeInvoices.length === 0}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                Continue to Step 2: Review HSN/SAC Summaries <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Invoices Preview Table */
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Loaded Sales Invoices</h3>
              <span className="text-xs bg-slate-100 font-mono font-bold text-slate-700 px-2.5 py-0.5 rounded-full">
                {filteredInvoices.length} of {invoices.length} Records
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search invoice, customer, GSTIN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
                {(['ALL', 'B2B', 'B2C', 'EXPORT'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-2.5 py-1 rounded ${
                      typeFilter === t ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer / Party</th>
                  <th className="px-4 py-3">Customer GSTIN</th>
                  <th className="px-4 py-3 text-center">POS</th>
                  <th className="px-4 py-3 text-center">Type</th>
                  <th className="px-4 py-3 text-right">Taxable (₹)</th>
                  <th className="px-4 py-3 text-right">GST Output (₹)</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredInvoices.map(inv => {
                  const isExcluded = excludedInvoices.has(inv.id);
                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isExcluded ? 'opacity-40 bg-slate-50/70' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={!isExcluded}
                          onChange={() => onToggleExcludeInvoice(inv.id)}
                          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          title="Include in return"
                        />
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-900">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-500">{inv.date}</td>
                      <td className="px-4 py-2.5 max-w-[180px] truncate">{inv.partyName}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px]">
                        {inv.gstin ? (
                          <span className="text-blue-700 font-bold">{inv.gstin}</span>
                        ) : (
                          <span className="text-slate-400 italic">Unregistered (B2C)</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono font-bold">
                        {inv.placeOfSupply || <span className="text-rose-500">Missing</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          inv.type === 'B2B' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                          inv.type === 'EXPORT' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                          'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {inv.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-800">
                        ₹{(inv.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-blue-600">
                        ₹{(inv.taxAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => onEditInvoice(inv)}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded-lg transition-colors"
                          title="Edit transaction details"
                        >
                          <Edit2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      No invoices found matching current filter. Load sample data or sync ERP.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-slate-500">
              {activeInvoices.length} included in current filing session
            </span>
            <button
              onClick={() => onNavigateStep(1)}
              disabled={activeInvoices.length === 0}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 active:scale-95"
            >
              Next: Review HSN/SAC Summaries <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};
