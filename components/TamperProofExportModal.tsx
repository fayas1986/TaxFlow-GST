import React, { useState } from 'react';
import { 
  ShieldCheck, 
  FileSpreadsheet, 
  FileText, 
  Lock, 
  UserCheck, 
  Building2, 
  FileKey2, 
  CheckCircle2, 
  Download, 
  X, 
  Upload, 
  AlertTriangle,
  Info,
  Hash,
  Sparkles,
  Calendar,
  Layers
} from 'lucide-react';
import { AuditLogData } from '../types';
import { 
  exportTamperProofAuditLogs, 
  computeSHA256, 
  RegulatoryAuditorInfo, 
  verifyUploadedAuditFile, 
  VerificationResult 
} from '../utils/tamperProofExport';

interface TamperProofExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditLogData[];
  tenantId: string;
  tenantName?: string;
}

export const TamperProofExportModal: React.FC<TamperProofExportModalProps> = ({
  isOpen,
  onClose,
  logs,
  tenantId,
  tenantName = 'TaxFlow Enterprise'
}) => {
  const [activeTab, setActiveTab] = useState<'EXPORT' | 'VERIFY'>('EXPORT');
  const [exportFormat, setExportFormat] = useState<'CSV' | 'EXCEL'>('EXCEL');
  const [includeFieldDeltas, setIncludeFieldDeltas] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Auditor Metadata State
  const [auditorInfo, setAuditorInfo] = useState<RegulatoryAuditorInfo>({
    auditorName: '',
    designation: 'Senior Compliance Auditor',
    regulatoryBody: 'Central Board of Indirect Taxes and Customs (CBIC)',
    auditPurpose: 'Statutory GST Audit & Regulatory Filing Verification',
    referenceNumber: `GST-AUD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  });

  // Verification state
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);

    try {
      await exportTamperProofAuditLogs({
        logs,
        format: exportFormat,
        tenantId,
        tenantName,
        auditorInfo,
        includeFieldDeltas
      });

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileUploadAndVerify = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVerifying(true);
    setVerificationResult(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        const result = await verifyUploadedAuditFile(content);
        setVerificationResult(result);
        setVerifying(false);
      };
      reader.readAsText(file);
    } catch (err: any) {
      setVerificationResult({
        isValid: false,
        recordCount: 0,
        message: `Verification Error: ${err?.message || 'File processing failed'}`
      });
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl text-indigo-400">
              <ShieldCheck size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black tracking-tight text-white">Regulatory Audit Log Export Package</h3>
                <span className="px-2 py-0.5 text-[10px] font-black bg-amber-400 text-slate-950 rounded-full uppercase tracking-wider">
                  Tamper-Proof
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate cryptographically signed compliance ledgers for statutory authorities, tax officials, and external auditors.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('EXPORT')}
            className={`flex items-center gap-2 px-5 py-3 rounded-t-xl font-extrabold text-xs transition-all border-b-2 ${
              activeTab === 'EXPORT'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            }`}
          >
            <Download size={15} />
            Export Regulatory Package ({logs.length} Records)
          </button>

          <button
            onClick={() => setActiveTab('VERIFY')}
            className={`flex items-center gap-2 px-5 py-3 rounded-t-xl font-extrabold text-xs transition-all border-b-2 ${
              activeTab === 'VERIFY'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            }`}
          >
            <Lock size={15} />
            Verify File Authenticity
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 dark:text-slate-100">
          
          {activeTab === 'EXPORT' && (
            <div className="space-y-6">
              
              {/* Format Selector Cards */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                  1. Select Export Format
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Excel Option */}
                  <div 
                    onClick={() => setExportFormat('EXCEL')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${
                      exportFormat === 'EXCEL'
                        ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-600 dark:border-indigo-400 shadow-md'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className={`p-3 rounded-xl shrink-0 ${exportFormat === 'EXCEL' ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      <FileSpreadsheet size={24} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Regulatory Excel (.xlsx/.xls)</h4>
                        {exportFormat === 'EXCEL' && <CheckCircle2 size={16} className="text-indigo-600 dark:text-indigo-400" />}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Styled XML spreadsheet with header certificate badge, formatted table columns, color badges, and auditor sign-off box.
                      </p>
                    </div>
                  </div>

                  {/* CSV Option */}
                  <div 
                    onClick={() => setExportFormat('CSV')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${
                      exportFormat === 'CSV'
                        ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-600 dark:border-indigo-400 shadow-md'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className={`p-3 rounded-xl shrink-0 ${exportFormat === 'CSV' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      <FileText size={24} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Tamper-Proof CSV (.csv)</h4>
                        {exportFormat === 'CSV' && <CheckCircle2 size={16} className="text-indigo-600 dark:text-indigo-400" />}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Standard CSV with embedded SHA-256 header manifest comments, strict string escaping, and cryptographic footer seal.
                      </p>
                    </div>
                  </div>

                </div>
              </div>

              {/* Regulatory Sign-off Metadata */}
              <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <UserCheck size={16} className="text-indigo-500" />
                    2. Auditor Sign-Off & Regulatory Authority Metadata
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                    Optional Official Details
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Auditor / Officer Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rajesh Kumar"
                      value={auditorInfo.auditorName}
                      onChange={(e) => setAuditorInfo({ ...auditorInfo, auditorName: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Designation / Role
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Chief GST Compliance Officer"
                      value={auditorInfo.designation}
                      onChange={(e) => setAuditorInfo({ ...auditorInfo, designation: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Regulatory Body / Authority
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. CBIC / State Tax Dept"
                      value={auditorInfo.regulatoryBody}
                      onChange={(e) => setAuditorInfo({ ...auditorInfo, regulatoryBody: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Reference / Order Number
                    </label>
                    <input
                      type="text"
                      value={auditorInfo.referenceNumber}
                      onChange={(e) => setAuditorInfo({ ...auditorInfo, referenceNumber: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Inclusion Options */}
              <div className="space-y-3">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
                  3. Granular Data & Security Inclusions
                </label>

                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeFieldDeltas}
                      onChange={(e) => setIncludeFieldDeltas(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                        Include Granular Field Deltas (Old Value vs New Value)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Exports line-item value modifications (e.g., rate adjustments, tax overrides, user role edits).
                      </p>
                    </div>
                  </label>

                  <div className="flex items-center gap-3 p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-200/50 dark:border-indigo-800/40">
                    <Lock size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <div>
                      <span className="text-xs font-extrabold text-indigo-950 dark:text-indigo-200">
                        Cryptographic SHA-256 Ledger Linkage Always Included
                      </span>
                      <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
                        Includes current entry hash and previous block hash pointers for cryptographic chain-of-custody verification.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'VERIFY' && (
            <div className="space-y-6">
              
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
                <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto">
                  <FileKey2 size={32} />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Verify Exported Audit Log Package</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                    Upload an exported CSV or Excel audit ledger file to inspect its embedded SHA-256 cryptographic seal and confirm zero unauthorized tampering.
                  </p>
                </div>

                <label className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-all shadow-md hover:shadow-indigo-500/20">
                  <Upload size={16} />
                  Choose File to Inspect (.csv / .xls)
                  <input
                    type="file"
                    accept=".csv, .xls, .xlsx, .txt"
                    onChange={handleFileUploadAndVerify}
                    className="hidden"
                  />
                </label>
              </div>

              {verifying && (
                <div className="p-6 text-center bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Computing SHA-256 Hashes & Verifying Certificate Seal...</p>
                </div>
              )}

              {verificationResult && (
                <div className={`p-6 rounded-2xl border space-y-4 animate-in zoom-in-95 duration-200 ${
                  verificationResult.isValid
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-200'
                }`}>
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-2xl shrink-0 ${verificationResult.isValid ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                      {verificationResult.isValid ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                    </div>
                    <div>
                      <h4 className="font-black text-base">
                        {verificationResult.isValid ? 'Tamper-Proof Audit Package Validated' : 'Verification Mismatch Detected'}
                      </h4>
                      <p className="text-xs mt-1 leading-relaxed opacity-90">
                        {verificationResult.message}
                      </p>
                    </div>
                  </div>

                  {verificationResult.isValid && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/60 text-xs font-mono">
                      <div>
                        <span className="text-[10px] font-sans font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Certificate ID</span>
                        <span className="font-bold">{verificationResult.certId}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Auditor Reference</span>
                        <span className="font-bold">{verificationResult.auditorName}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-[10px] font-sans font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">SHA-256 Digest Match</span>
                        <span className="font-bold break-all text-[11px] text-emerald-800 dark:text-emerald-300">{verificationResult.recordedHash}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Lock size={14} className="text-emerald-500" />
            <span>SHA-256 Sealed & Dynamic Merkle Root</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Cancel
            </button>

            {activeTab === 'EXPORT' && (
              <button
                onClick={handleExport}
                disabled={isExporting || logs.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {isExporting ? (
                  <>Generating Sealed Package...</>
                ) : exportSuccess ? (
                  <>
                    <CheckCircle2 size={16} />
                    Exported Successfully!
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Download {exportFormat} Audit Package
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default TamperProofExportModal;
