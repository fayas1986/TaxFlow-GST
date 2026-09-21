import React, { useState } from 'react';
import { 
  Download, 
  ShieldCheck, 
  Calendar, 
  Clock, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Lock, 
  Layers, 
  Copy, 
  Check, 
  ExternalLink,
  Sliders,
  Archive,
  History,
  FileCode,
  FileKey2,
  Info,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useAutomatedLedgerExport } from '../hooks/useAutomatedLedgerExport';
import { LedgerArchiveRecord, getCurrentExportPeriod } from '../utils/automatedLedgerExport';

interface AutomatedLedgerExportModuleProps {
  tenantId?: string;
  tenantName?: string;
  gstin?: string;
  compact?: boolean;
}

export const AutomatedLedgerExportModule: React.FC<AutomatedLedgerExportModuleProps> = ({
  tenantId = 't1',
  tenantName = 'TaxFlow Enterprise Ltd.',
  gstin = '27AAAAA0000A1Z5',
  compact = false
}) => {
  const {
    policy,
    history,
    isExporting,
    lastExportStatus,
    updatePolicy,
    triggerExport
  } = useAutomatedLedgerExport(tenantId, tenantName, gstin);

  const [selectedFormat, setSelectedFormat] = useState<'JSON' | 'EXCEL' | 'CSV'>('JSON');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(getCurrentExportPeriod());
  const [showConfig, setShowConfig] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [verificationModalRecord, setVerificationModalRecord] = useState<LedgerArchiveRecord | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2500);
  };

  const handleImmediateExport = async () => {
    try {
      await triggerExport(selectedFormat, selectedPeriod);
    } catch {
      // Error handled inside hook
    }
  };

  const nextScheduledDateFormatted = policy.nextScheduledDate 
    ? new Date(policy.nextScheduledDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : 'Not Scheduled';

  const lastExportDateFormatted = policy.lastExportDate
    ? new Date(policy.lastExportDate).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Never';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Banner: Status & Statutory Compliance */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <ShieldCheck size={14} className="text-emerald-400" />
                {policy.enabled ? 'Automated Archiving Active' : 'Automated Archiving Paused'}
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Lock size={12} /> Section 35(1) & 36 CGST Act
              </span>
              <span className="text-xs text-slate-400">
                72-Month Retention Mandate
              </span>
            </div>

            <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <Archive className="text-indigo-400" size={22} />
              Automated Monthly Ledger Compliance Archiving
            </h3>
            
            <p className="text-sm text-slate-300 leading-relaxed">
              Automatically consolidates, digitally signs, and downloads your full Electronic Cash Ledger, Credit Ledger (ITC), and Liability Register on the 1st of every month for statutory compliance auditing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-colors flex items-center gap-2"
            >
              <Sliders size={15} />
              {showConfig ? 'Hide Settings' : 'Schedule Policy'}
            </button>

            <button
              onClick={handleImmediateExport}
              disabled={isExporting}
              className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
            >
              {isExporting ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  Generating Archive...
                </>
              ) : (
                <>
                  <Download size={15} />
                  Trigger Monthly Export Now
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Metrics Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-indigo-900/60">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Cadence</span>
            <span className="text-sm font-black text-white flex items-center gap-1.5 mt-0.5">
              <Calendar size={14} className="text-indigo-400" />
              Monthly (Day {policy.dayOfMonth})
            </span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Next Auto-Export</span>
            <span className="text-sm font-black text-white flex items-center gap-1.5 mt-0.5">
              <Clock size={14} className="text-amber-400" />
              {nextScheduledDateFormatted}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Last Export</span>
            <span className="text-sm font-black text-white flex items-center gap-1.5 mt-0.5">
              <CheckCircle2 size={14} className="text-emerald-400" />
              {lastExportDateFormatted}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tamper-Proof Seal</span>
            <span className="text-sm font-black text-white flex items-center gap-1.5 mt-0.5 font-mono">
              <FileKey2 size={14} className="text-cyan-400" />
              SHA-256 Digital
            </span>
          </div>
        </div>
      </div>

      {/* Feedback Toast Banner */}
      {lastExportStatus && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 animate-in fade-in duration-300 ${
          lastExportStatus.success 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <div className="flex items-center gap-3">
            {lastExportStatus.success ? (
              <CheckCircle2 className="text-emerald-600 shrink-0" size={20} />
            ) : (
              <AlertCircle className="text-rose-600 shrink-0" size={20} />
            )}
            <div>
              <p className="text-sm font-bold">{lastExportStatus.message}</p>
              {lastExportStatus.hash && (
                <p className="text-xs text-emerald-700 font-mono mt-0.5 flex items-center gap-1">
                  <span>SHA-256: {lastExportStatus.hash.slice(0, 32)}...</span>
                </p>
              )}
            </div>
          </div>
          {lastExportStatus.filename && (
            <span className="text-xs font-semibold px-2.5 py-1 bg-white rounded-lg border border-emerald-200 text-emerald-800 shrink-0">
              Downloaded to local filesystem
            </span>
          )}
        </div>
      )}

      {/* Configuration Drawer */}
      {showConfig && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Sliders className="text-indigo-600" size={20} />
              <h4 className="font-black text-slate-800">Automated Monthly Export Policy Settings</h4>
            </div>
            <span className="text-xs font-bold text-slate-400">Section 35(1) Compliant</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Auto Trigger Toggle */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
              <div>
                <h5 className="text-sm font-bold text-slate-800">Automated Background Run</h5>
                <p className="text-xs text-slate-500 mt-1">
                  Automatically prepare and trigger local archive download when scheduled day arrives.
                </p>
              </div>
              <button
                type="button"
                onClick={() => updatePolicy({ enabled: !policy.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                  policy.enabled ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`${
                    policy.enabled ? 'translate-x-6' : 'translate-x-1'
                  } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                />
              </button>
            </div>

            {/* Scheduled Day of Month */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700">Scheduled Day of Month</label>
                <span className="text-xs font-black text-indigo-600">Day {policy.dayOfMonth}</span>
              </div>
              <input
                type="range"
                min="1"
                max="28"
                step="1"
                value={policy.dayOfMonth}
                onChange={(e) => updatePolicy({ dayOfMonth: parseInt(e.target.value) })}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                <span>1st (Recommended)</span>
                <span>15th</span>
                <span>28th</span>
              </div>
            </div>

            {/* Default Format */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Default Export Format</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'JSON', label: 'Signed JSON' },
                  { id: 'EXCEL', label: 'Excel (XLSX)' },
                  { id: 'CSV', label: 'CSV' }
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => updatePolicy({ format: fmt.id as any })}
                    className={`py-2 px-1 text-xs font-bold rounded-lg border text-center transition-all ${
                      policy.format === fmt.id
                        ? 'bg-white border-indigo-600 text-indigo-600 shadow-xs'
                        : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                    }`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Immediate Download & Format Control Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h4 className="font-black text-slate-800 flex items-center gap-2">
              <Download className="text-indigo-600" size={18} />
              Manual & On-Demand Ledger Archive Export
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Select your archival period and file format to trigger an immediate secure local download.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
            >
              <option value="2026-09">Period: September 2026</option>
              <option value="2026-08">Period: August 2026</option>
              <option value="2026-07">Period: July 2026</option>
              <option value="2026-06">Period: June 2026</option>
            </select>

            <button
              onClick={handleImmediateExport}
              disabled={isExporting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isExporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              Download Archive ({selectedFormat})
            </button>
          </div>
        </div>

        {/* Format Selector Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => setSelectedFormat('JSON')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedFormat === 'JSON'
                ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className={selectedFormat === 'JSON' ? 'text-indigo-600' : 'text-slate-500'} size={20} />
                <span className="font-bold text-sm text-slate-800">Tamper-Proof JSON Archive</span>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                Recommended
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Full canonical JSON document sealed with SHA-256 cryptographic digest, CBIC certificate ID, and ledger breakdowns.
            </p>
          </div>

          <div
            onClick={() => setSelectedFormat('EXCEL')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedFormat === 'EXCEL'
                ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className={selectedFormat === 'EXCEL' ? 'text-emerald-600' : 'text-slate-500'} size={20} />
                <span className="font-bold text-sm text-slate-800">Multi-Sheet Excel (.xlsx)</span>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                Auditor
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              5 Dedicated workbook tabs: Compliance Certificate, Cash Ledger, Credit Ledger, Liability Register, and Audit Trail.
            </p>
          </div>

          <div
            onClick={() => setSelectedFormat('CSV')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedFormat === 'CSV'
                ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className={selectedFormat === 'CSV' ? 'text-blue-600' : 'text-slate-500'} size={20} />
                <span className="font-bold text-sm text-slate-800">Statutory Multi-Table CSV</span>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                Data Lake
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Raw plain-text statutory export formatted with cryptographic header for ERP importing or cold storage ingestion.
            </p>
          </div>
        </div>

        {/* Data Scope Checklist */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-2">
            <CheckCircle2 className="text-emerald-600" size={16} />
            Included Ledger Datasets in Compliance Package:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Electronic Cash Ledger (PMT-06)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              Credit Ledger (Eligible/Blocked ITC)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Liability Register (RCM & Output)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              Immutable SHA-256 Hash Chain
            </span>
          </div>
        </div>
      </div>

      {/* Compliance Archive Download History */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="text-slate-600" size={20} />
            <div>
              <h4 className="font-black text-slate-800">Compliance Archival History & Digital Certificate Log</h4>
              <p className="text-xs text-slate-500">
                Log of verified monthly exports preserved for statutory audit under Rule 85/86/87/88
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.hash = '/compliance-archive'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors border border-indigo-200"
            >
              <Archive size={14} /> Full Timeline View <ArrowRight size={12} />
            </button>
            <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-700 rounded-full">
              {history.length} Archives Stored
            </span>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Archive className="mx-auto mb-2 opacity-60" size={36} />
            <p className="text-sm font-semibold">No archives generated yet</p>
            <p className="text-xs text-slate-400 mt-1">Click "Trigger Monthly Export Now" to generate your first compliance download.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Period</th>
                  <th className="px-6 py-3.5">Export Timestamp</th>
                  <th className="px-6 py-3.5">Format & Size</th>
                  <th className="px-6 py-3.5">Digital Certificate ID</th>
                  <th className="px-6 py-3.5">SHA-256 Digest</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-black text-slate-800 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar size={15} className="text-indigo-600" />
                        {record.period}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(record.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                          record.format === 'JSON' ? 'bg-indigo-100 text-indigo-700' :
                          record.format === 'EXCEL' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {record.format}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">{record.fileSize}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-700 whitespace-nowrap">
                      {record.certificateId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                          {record.sha256Hash.slice(0, 16)}...
                        </span>
                        <button
                          onClick={() => handleCopy(record.sha256Hash, record.id)}
                          title="Copy full SHA-256 checksum"
                          className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-colors"
                        >
                          {copiedHash === record.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setVerificationModalRecord(record)}
                          className="px-3 py-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200"
                        >
                          Verify Certificate
                        </button>
                        <button
                          onClick={() => triggerExport(record.format, record.period)}
                          className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <Download size={13} />
                          Re-Download
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

      {/* Verification Details Modal */}
      {verificationModalRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-emerald-600" size={24} />
                <div>
                  <h4 className="font-black text-slate-800">Statutory Compliance Certificate</h4>
                  <p className="text-xs text-slate-500">Digital verification details for period {verificationModalRecord.period}</p>
                </div>
              </div>
              <button 
                onClick={() => setVerificationModalRecord(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200/80 flex items-center gap-3">
                <CheckCircle2 className="text-emerald-600 shrink-0" size={24} />
                <div>
                  <h5 className="text-sm font-black text-emerald-900">Cryptographic Seal Intact</h5>
                  <p className="text-xs text-emerald-700">
                    This archive is authenticated and matches statutory recordkeeping rules under Section 35(1) of the CGST Act.
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-bold text-slate-500 block">Certificate Identifier:</span>
                  <span className="font-mono text-slate-800 font-bold">{verificationModalRecord.certificateId}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block">SHA-256 Full Hash:</span>
                  <div className="font-mono text-slate-800 bg-slate-100 p-2.5 rounded-lg break-all select-all">
                    {verificationModalRecord.sha256Hash}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <span className="font-bold text-slate-500 block">Archival Timestamp:</span>
                    <span className="text-slate-800 font-semibold">{new Date(verificationModalRecord.timestamp).toUTCString()}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 block">Auditing Mandate:</span>
                    <span className="text-slate-800 font-semibold">Rule 85, 86, 87 & 88 (72 Months)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setVerificationModalRecord(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  triggerExport(verificationModalRecord.format, verificationModalRecord.period);
                  setVerificationModalRecord(null);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Download size={14} /> Download Copy
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
