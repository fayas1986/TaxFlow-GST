import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, FileText, CheckCircle2, AlertCircle, ChevronRight, Save, Play } from 'lucide-react';
import * as XLSX from 'xlsx';

interface BulkImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (invoices: any[]) => void;
}

export default function InvoiceBulkImportWizard({ isOpen, onClose, onImportComplete }: BulkImportWizardProps) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const REQUIRED_FIELDS = [
    { key: 'invoiceNumber', label: 'Invoice Number' },
    { key: 'date', label: 'Date (YYYY-MM-DD)' },
    { key: 'partyName', label: 'Party Name' },
    { key: 'taxableValue', label: 'Taxable Value' },
  ];

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFile(file);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      if (data.length < 2) {
        setErrors(['File must contain a header row and at least one data row.']);
        return;
      }

      const headers = data[0] as string[];
      const rows = data.slice(1).map(row => {
        const obj: any = {};
        headers.forEach((header, idx) => {
          obj[header] = (row as any)[idx];
        });
        return obj;
      });

      setParsedData(rows);
      
      // Auto-map based on similar names
      const initialMapping: Record<string, string> = {};
      REQUIRED_FIELDS.forEach(field => {
        const match = headers.find(h => h.toLowerCase().includes(field.label.split(' ')[0].toLowerCase()));
        if (match) initialMapping[field.key] = match;
      });
      setMapping(initialMapping);
      setStep(2);
    };
    reader.readAsBinaryString(file);
  };

  const processImport = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const importedInvoices = parsedData.map(row => {
        return {
          invoiceNumber: String(row[mapping.invoiceNumber] || ''),
          date: row[mapping.date] || new Date().toISOString().split('T')[0],
          partyName: row[mapping.partyName] || 'Unknown Party',
          partyGstin: row[mapping.partyGstin] || '',
          taxableValue: parseFloat(row[mapping.taxableValue]) || 0,
          cgst: parseFloat(row[mapping.cgst]) || 0,
          sgst: parseFloat(row[mapping.sgst]) || 0,
          igst: parseFloat(row[mapping.igst]) || 0,
          totalAmount: parseFloat(row[mapping.totalAmount]) || 0,
          status: 'DRAFT'
        };
      }).filter(inv => inv.invoiceNumber && inv.partyName);

      onImportComplete(importedInvoices);
      setIsProcessing(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50 shrink-0">
          <div>
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Upload size={20} className="text-blue-600" />
              Bulk Invoice Import
            </h3>
            <p className="text-sm text-slate-500 mt-1">Upload and map your CSV data</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {step === 1 && (
            <div className="flex flex-col items-center justify-center py-12">
              <div 
                className="w-full max-w-md border-2 border-dashed border-blue-200 rounded-2xl p-8 flex flex-col items-center justify-center bg-blue-50/50 hover:bg-blue-50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  accept=".csv, .xlsx" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                />
                <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                  <FileText size={32} className="text-blue-600" />
                </div>
                <h4 className="text-lg font-bold text-slate-800 mb-2">Select CSV / Excel File</h4>
                <p className="text-sm text-slate-500 text-center mb-6">
                  Upload your transaction data to map and import into the vault.
                </p>
                <button className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-blue-700 transition-all">
                  Browse Files
                </button>
              </div>
              {errors.length > 0 && (
                <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm flex items-start gap-2 w-full max-w-md">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <div>{errors[0]}</div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800">Map Columns</h4>
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                  {parsedData.length} Rows Detected
                </span>
              </div>
              <div className="space-y-4">
                {REQUIRED_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50">
                    <span className="text-sm font-semibold text-slate-700">{field.label} <span className="text-red-500">*</span></span>
                    <select 
                      className="w-1/2 p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      value={mapping[field.key] || ''}
                      onChange={(e) => setMapping({...mapping, [field.key]: e.target.value})}
                    >
                      <option value="">-- Select Column --</option>
                      {Object.keys(parsedData[0] || {}).map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {step === 2 && (
          <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex items-center justify-between">
            <button 
              onClick={() => { setStep(1); setFile(null); }} 
              className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-all"
            >
              Back
            </button>
            <button 
              onClick={processImport} 
              disabled={isProcessing || !mapping.invoiceNumber}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {isProcessing ? 'Importing...' : 'Start Import'} <Play size={16} />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
