import React, { useState } from 'react';
import {
  FileDown,
  X,
  Calendar,
  Building2,
  CheckCircle2,
  Sliders,
  Layers,
  Sparkles,
  ShieldCheck,
  Download,
  FileText,
  Palette,
  Eye,
  Loader2,
  UserCheck
} from 'lucide-react';
import { Tenant, TaxComputationSummary } from '../types';
import { generateMonthlyGstrSummaryPdf } from '../utils/pdfReportGenerator';

interface MonthlyGstrReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTenant?: Tenant | null;
  availableTenants?: Tenant[];
  isAggregate?: boolean;
  stats?: any;
  analytics?: any;
  computationData?: TaxComputationSummary | null;
  defaultPeriod?: string;
}

export const MonthlyGstrReportModal: React.FC<MonthlyGstrReportModalProps> = ({
  isOpen,
  onClose,
  currentTenant,
  availableTenants = [],
  isAggregate = false,
  stats,
  analytics,
  computationData,
  defaultPeriod = 'September 2026'
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>(defaultPeriod);
  const [selectedEntityId, setSelectedEntityId] = useState<string>(isAggregate ? 'AGGREGATE' : (currentTenant?.id || 't1'));
  const [theme, setTheme] = useState<'MODERN' | 'CORPORATE' | 'MINIMALIST'>('MODERN');
  const [signatoryName, setSignatoryName] = useState<string>('Rajesh Sharma');
  const [signatoryDesignation, setSignatoryDesignation] = useState<string>('Chief Compliance Officer & Authorized Signatory');
  
  // Section inclusion flags
  const [includeGstr1, setIncludeGstr1] = useState<boolean>(true);
  const [includeGstr3b, setIncludeGstr3b] = useState<boolean>(true);
  const [includeTrend, setIncludeTrend] = useState<boolean>(true);
  const [includeSubsidiaryMatrix, setIncludeSubsidiaryMatrix] = useState<boolean>(true);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const availablePeriods = [
    'September 2026',
    'August 2026',
    'July 2026',
    'June 2026',
    'May 2026',
    'April 2026',
    'Q1 FY 2026-27',
    'Q2 FY 2026-27'
  ];

  const isCurrentAggregate = selectedEntityId === 'AGGREGATE';
  const activeTenant = availableTenants.find(t => t.id === selectedEntityId) || currentTenant;

  // Process trend data from analytics if available
  const trendData = analytics?.monthlyData || [
    { name: 'May 2026', sales: 16500000, purchase: 11000000, liability: 990000, itc: 1980000, outputLiability: 2970000, status: 'Optimal' },
    { name: 'Jun 2026', sales: 17200000, purchase: 11500000, liability: 1032000, itc: 2070000, outputLiability: 3096000, status: 'Optimal' },
    { name: 'Jul 2026', sales: 15800000, purchase: 10200000, liability: 948000, itc: 1836000, outputLiability: 2844000, status: 'Optimal' },
    { name: 'Aug 2026', sales: 18100000, purchase: 12100000, liability: 1086000, itc: 2178000, outputLiability: 3258000, status: 'Optimal' },
    { name: 'Sep 2026', sales: 18500000, purchase: 12200000, liability: 1132000, itc: 2196000, outputLiability: 3330000, status: 'Optimal' },
  ];

  // Calculate live preview metrics
  const estSales = stats?.totalSales || 18500000;
  const estOutput = stats?.totalLiability || Math.round(estSales * 0.18);
  const estItc = stats?.totalItc || Math.round(estOutput * 0.65);
  const estNetCash = Math.max(0, estOutput - estItc);

  const handleDownload = () => {
    setIsGenerating(true);
    setDownloadSuccess(null);

    setTimeout(() => {
      try {
        const fileName = generateMonthlyGstrSummaryPdf({
          period: selectedPeriod,
          tenant: isCurrentAggregate ? null : activeTenant,
          computationData: computationData,
          trendData: trendData,
          isAggregate: isCurrentAggregate,
          availableTenants: availableTenants,
          theme: theme,
          signatoryName: signatoryName,
          signatoryDesignation: signatoryDesignation,
          entityName: isCurrentAggregate ? 'Enterprise Organization (Consolidated Group)' : activeTenant?.name,
          gstin: isCurrentAggregate ? undefined : activeTenant?.gstin,
          stateCode: isCurrentAggregate ? undefined : activeTenant?.stateCode,
          includeGstr1: includeGstr1,
          includeGstr3b: includeGstr3b,
          includeComparativeTrend: includeTrend,
          includeSubsidiaryMatrix: includeSubsidiaryMatrix,
        });

        setDownloadSuccess(fileName || 'Report generated');
      } catch (err) {
        console.error('Failed to export PDF:', err);
      } finally {
        setIsGenerating(false);
      }
    }, 450);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div 
        id="monthly-gstr-report-modal"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400">
              <FileDown size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                <span>Monthly GSTR Summary PDF Export</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Form GSTR-1 & 3B
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">
                Generate statutory reconciliation reports with table-wise tax offsets and digital verification.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[calc(85vh-140px)] overflow-y-auto text-slate-800">
          {/* Quick Success Toast if downloaded */}
          {downloadSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 animate-in slide-in-from-top-2">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <div className="flex-1 font-medium">
                <span className="font-bold">Download Complete:</span> <span className="font-mono text-emerald-900">{downloadSuccess}</span> has been saved to your device.
              </div>
            </div>
          )}

          {/* 1. Entity & Period Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Period Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={13} className="text-blue-600" />
                <span>Return Tax Period</span>
              </label>
              <select
                id="report-period-select"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
              >
                {availablePeriods.map((p) => (
                  <option key={p} value={p}>
                    {p} {p === 'September 2026' ? '(Active Filing Period)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Entity Scope Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 size={13} className="text-indigo-600" />
                <span>Target Entity Scope</span>
              </label>
              <select
                id="report-entity-select"
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
              >
                <option value="AGGREGATE">Consolidated Enterprise Group (All {availableTenants.length || 12} Companies)</option>
                {availableTenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.gstin})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Live Statutory Metrics Highlight Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-500" />
                <span>Report Financial Highlights ({selectedPeriod})</span>
              </span>
              <span className="text-[11px] font-mono text-slate-500 font-semibold">
                {isCurrentAggregate ? 'Multi-Entity Group Rollup' : `${activeTenant?.name || 'Selected Entity'}`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Gross Sales</div>
                <div className="text-sm font-black text-slate-900 mt-1">₹ {estSales.toLocaleString('en-IN')}</div>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Gross Output Tax</div>
                <div className="text-sm font-black text-slate-900 mt-1">₹ {estOutput.toLocaleString('en-IN')}</div>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Eligible ITC</div>
                <div className="text-sm font-black text-emerald-600 mt-1">₹ {estItc.toLocaleString('en-IN')}</div>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Net Cash Payable</div>
                <div className="text-sm font-black text-blue-600 mt-1">₹ {estNetCash.toLocaleString('en-IN')}</div>
              </div>
            </div>
          </div>

          {/* 3. Section Toggles */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={13} className="text-slate-500" />
              <span>Report Sections to Include</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={includeGstr1}
                  onChange={(e) => setIncludeGstr1(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-900">Form GSTR-1 Outward Register</div>
                  <div className="text-slate-500 text-[11px]">B2B Table 4A, B2C Table 5 & 7, Exports 6A, Credit Notes 9B</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={includeGstr3b}
                  onChange={(e) => setIncludeGstr3b(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-900">Form GSTR-3B Tax Offset Matrix</div>
                  <div className="text-slate-500 text-[11px]">Table 3.1 Supplies, Table 4 ITC, Table 6.1 Cash/Credit Discharge</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={includeTrend}
                  onChange={(e) => setIncludeTrend(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-900">Comparative Trend Analysis</div>
                  <div className="text-slate-500 text-[11px]">Multi-month historical ledger & ITC coverage comparisons</div>
                </div>
              </label>

              {isCurrentAggregate && (
                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={includeSubsidiaryMatrix}
                    onChange={(e) => setIncludeSubsidiaryMatrix(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                  />
                  <div className="text-xs">
                    <div className="font-bold text-slate-900">Operating Subsidiary Breakdown</div>
                    <div className="text-slate-500 text-[11px]">GSTIN list with estimated turnover and net liability contribution</div>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* 4. Styling Theme & Signatory */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            {/* Visual Theme */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Palette size={13} className="text-indigo-600" />
                <span>Document Theme</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'MODERN', label: 'Modern Indigo' },
                  { id: 'CORPORATE', label: 'Corporate Navy' },
                  { id: 'MINIMALIST', label: 'Minimalist Slate' }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id as any)}
                    className={`py-2 px-2 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      theme === t.id
                        ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Authorized Signatory */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck size={13} className="text-emerald-600" />
                <span>Authorized Signatory</span>
              </label>
              <input
                type="text"
                value={signatoryName}
                onChange={(e) => setSignatoryName(e.target.value)}
                placeholder="Signatory Name"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Includes cryptographic SHA-256 validation seal for GST compliance</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="modal-download-pdf-btn"
              type="button"
              disabled={isGenerating}
              onClick={handleDownload}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-sm active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download size={15} />
                  <span>Download Report</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
