import React, { useState, useMemo, useEffect } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  X,
  Sliders,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  Palette,
  Eye,
  Loader2,
  RefreshCw,
  Maximize2,
  FileCheck,
  Check,
  AlertCircle
} from 'lucide-react';
import { FinancialYearReportingSummary } from '../types/monthlyReporting';
import {
  FINANCIAL_YEARS,
  GSTIN_ENTITIES,
  getMonthlyGstReportingData,
  exportMonthlyReportToExcel,
  exportMonthlyReportToCsv,
} from '../services/monthlyGstReportingService';
import {
  MonthlyLiabilityPdfOptions,
  downloadMonthlyLiabilityPdf,
  getMonthlyLiabilityPdfDataUri,
  getMonthlyLiabilityPdfBlob,
} from '../utils/monthlyLiabilityPdfExporter';

export interface MonthlyGstLiabilityExportProps {
  initialSummary?: FinancialYearReportingSummary;
  isOpen: boolean;
  onClose: () => void;
  tenantName?: string;
}

export const MonthlyGstLiabilityExportModal: React.FC<MonthlyGstLiabilityExportProps> = ({
  initialSummary,
  isOpen,
  onClose,
  tenantName = 'TaxFlow Enterprise Ltd',
}) => {
  // Config state
  const [selectedFy, setSelectedFy] = useState<string>(initialSummary?.financialYear || '2026-27');
  const [selectedGstin, setSelectedGstin] = useState<string>(initialSummary?.selectedGstin || 'ALL');
  const [selectedQuarter, setSelectedQuarter] = useState<'ALL' | 'Q1' | 'Q2' | 'Q3' | 'Q4'>(
    initialSummary?.selectedQuarter || 'ALL'
  );
  
  // Presentation & Design
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [theme, setTheme] = useState<'MODERN' | 'CORPORATE' | 'MINIMALIST'>('MODERN');
  const [fontScale, setFontScale] = useState<'COMPACT' | 'STANDARD' | 'COMFORTABLE'>('STANDARD');
  const [watermark, setWatermark] = useState<boolean>(false);
  const [watermarkText, setWatermarkText] = useState<string>('CONFIDENTIAL');

  // Content Inclusions
  const [includeKpiSummary, setIncludeKpiSummary] = useState<boolean>(true);
  const [includeMonthlyMatrix, setIncludeMonthlyMatrix] = useState<boolean>(true);
  const [includeTaxHeadsBreakdown, setIncludeTaxHeadsBreakdown] = useState<boolean>(true);
  const [includeItcBreakdown, setIncludeItcBreakdown] = useState<boolean>(true);
  const [includeStatutoryNotes, setIncludeStatutoryNotes] = useState<boolean>(true);
  const [includeSignature, setIncludeSignature] = useState<boolean>(true);

  // Signatory & Entity details
  const [customEntityName, setCustomEntityName] = useState<string>(tenantName);
  const [signatoryName, setSignatoryName] = useState<string>('Rajesh Sharma');
  const [signatoryDesignation, setSignatoryDesignation] = useState<string>(
    'Chief Compliance Officer & Authorized Signatory'
  );

  // Active Tab: Config vs Live Preview
  const [activeTab, setActiveTab] = useState<'CONFIG' | 'PREVIEW'>('CONFIG');

  // Action states
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  // Compute live dataset
  const activeSummary = useMemo(() => {
    return getMonthlyGstReportingData(selectedFy, selectedGstin, 't1', selectedQuarter);
  }, [selectedFy, selectedGstin, selectedQuarter]);

  const activeEntityObj = useMemo(() => {
    return GSTIN_ENTITIES.find(e => e.gstin === selectedGstin) || GSTIN_ENTITIES[0];
  }, [selectedGstin]);

  // Construct PDF Options
  const pdfOptions: MonthlyLiabilityPdfOptions = useMemo(() => ({
    summary: activeSummary,
    orientation,
    theme,
    fontScale,
    entityName: activeEntityObj.name,
    gstin: activeEntityObj.gstin,
    tenantName: customEntityName || tenantName,
    signatoryName,
    signatoryDesignation,
    includeKpiSummary,
    includeMonthlyMatrix,
    includeTaxHeadsBreakdown,
    includeItcBreakdown,
    includeStatutoryNotes,
    includeSignature,
    watermarkText: watermark ? watermarkText : null,
  }), [
    activeSummary,
    orientation,
    theme,
    fontScale,
    activeEntityObj,
    customEntityName,
    tenantName,
    signatoryName,
    signatoryDesignation,
    includeKpiSummary,
    includeMonthlyMatrix,
    includeTaxHeadsBreakdown,
    includeItcBreakdown,
    includeStatutoryNotes,
    includeSignature,
    watermark,
    watermarkText,
  ]);

  // Generate Preview when tab is set to PREVIEW
  useEffect(() => {
    if (activeTab === 'PREVIEW' && isOpen) {
      setPreviewLoading(true);
      const timer = setTimeout(() => {
        try {
          const uri = getMonthlyLiabilityPdfDataUri(pdfOptions);
          setPreviewUri(uri);
        } catch (err) {
          console.error('Failed to generate PDF preview:', err);
        } finally {
          setPreviewLoading(false);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeTab, isOpen, pdfOptions]);

  if (!isOpen) return null;

  const handleDownloadPdf = () => {
    setIsGenerating(true);
    setDownloadSuccessMessage(null);

    setTimeout(() => {
      try {
        const fileName = downloadMonthlyLiabilityPdf(pdfOptions);
        setDownloadSuccessMessage(`Successfully generated ${fileName}`);
      } catch (error) {
        console.error('PDF generation error:', error);
      } finally {
        setIsGenerating(false);
      }
    }, 400);
  };

  const handleExportExcel = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        exportMonthlyReportToExcel(activeSummary, activeEntityObj.name);
        setDownloadSuccessMessage(`Excel workbook exported successfully.`);
      } catch (err) {
        console.error(err);
      } finally {
        setIsGenerating(false);
      }
    }, 300);
  };

  const handleExportCsv = () => {
    exportMonthlyReportToCsv(activeSummary);
    setDownloadSuccessMessage('CSV report exported.');
  };

  const handlePrint = () => {
    const blob = getMonthlyLiabilityPdfBlob(pdfOptions);
    const blobUrl = URL.createObjectURL(blob);
    const printWindow = window.open(blobUrl);
    if (printWindow) {
      printWindow.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl">
              <Download size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">Monthly GST Liability & ITC PDF Exporter</h3>
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-extrabold rounded-md uppercase tracking-wider">
                  vendor-exports Bundle
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate audit-ready, statutory compliant PDF reports summarizing monthly outward liabilities and GSTR-2B input tax credits.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl text-xs font-bold text-slate-300 mr-2">
              <button
                type="button"
                onClick={() => setActiveTab('CONFIG')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'CONFIG' ? 'bg-blue-600 text-white font-extrabold shadow-sm' : 'hover:text-white'
                }`}
              >
                <Sliders size={13} />
                Options & Scope
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('PREVIEW')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'PREVIEW' ? 'bg-blue-600 text-white font-extrabold shadow-sm' : 'hover:text-white'
                }`}
              >
                <Eye size={13} />
                Live Preview
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {downloadSuccessMessage && (
            <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-900 text-xs font-bold">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span>{downloadSuccessMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setDownloadSuccessMessage(null)}
                className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {activeTab === 'CONFIG' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Scope & Report Settings (7 Cols) */}
              <div className="lg:col-span-7 space-y-6">
                {/* 1. Report Scope & Period */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Calendar size={15} className="text-blue-600" />
                    1. Reporting Scope & Financial Period
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">
                        Financial Year
                      </label>
                      <select
                        value={selectedFy}
                        onChange={(e) => setSelectedFy(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-xs font-extrabold text-slate-800 rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 cursor-pointer"
                      >
                        {FINANCIAL_YEARS.map(f => (
                          <option key={f.id} value={f.id}>{f.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">
                        Entity / GSTIN Scope
                      </label>
                      <select
                        value={selectedGstin}
                        onChange={(e) => setSelectedGstin(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-xs font-extrabold text-slate-800 rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 cursor-pointer"
                      >
                        {GSTIN_ENTITIES.map(e => (
                          <option key={e.gstin} value={e.gstin}>
                            {e.name} ({e.state})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">
                      Quarterly / Horizon Filter
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(['ALL', 'Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setSelectedQuarter(q)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            selectedQuarter === q
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {q === 'ALL' ? 'Full FY (All 12 Months)' : `Quarter ${q}`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. Format & Theme Customization */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Palette size={15} className="text-purple-600" />
                    2. Layout & Typography Styles
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Orientation */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">
                        Orientation
                      </label>
                      <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => setOrientation('landscape')}
                          className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                            orientation === 'landscape' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                          }`}
                        >
                          Landscape (Matrix)
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrientation('portrait')}
                          className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                            orientation === 'portrait' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                          }`}
                        >
                          Portrait
                        </button>
                      </div>
                    </div>

                    {/* Theme */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">
                        Visual Theme
                      </label>
                      <select
                        value={theme}
                        onChange={(e) => setTheme(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded-xl px-3 py-2 outline-none cursor-pointer"
                      >
                        <option value="MODERN">Modern Slate & Indigo</option>
                        <option value="CORPORATE">Corporate Navy</option>
                        <option value="MINIMALIST">Clean Monochrome</option>
                      </select>
                    </div>

                    {/* Font Density */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">
                        Font Scale
                      </label>
                      <select
                        value={fontScale}
                        onChange={(e) => setFontScale(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded-xl px-3 py-2 outline-none cursor-pointer"
                      >
                        <option value="STANDARD">Standard (8pt)</option>
                        <option value="COMPACT">Compact Dense (7pt)</option>
                        <option value="COMFORTABLE">Comfortable (9pt)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. Section Inclusions */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Layers size={15} className="text-emerald-600" />
                    3. Report Sections & Statutory Modules
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={includeKpiSummary}
                        onChange={(e) => setIncludeKpiSummary(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-700">Executive KPI Summary Box</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={includeMonthlyMatrix}
                        onChange={(e) => setIncludeMonthlyMatrix(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-700">12-Month Liability vs ITC Matrix</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={includeTaxHeadsBreakdown}
                        onChange={(e) => setIncludeTaxHeadsBreakdown(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-700">Tax Heads (IGST/CGST/SGST/Cess)</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={includeItcBreakdown}
                        onChange={(e) => setIncludeItcBreakdown(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-700">Section 17(5) Blocked ITC Audit</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={includeStatutoryNotes}
                        onChange={(e) => setIncludeStatutoryNotes(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-700">Statutory Legal References & Rule 88A</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={includeSignature}
                        onChange={(e) => setIncludeSignature(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-700">Digital Verification Stamp & Signature</span>
                    </label>
                  </div>
                </div>

                {/* 4. Signatory & Watermark */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck size={15} className="text-amber-600" />
                    4. Signatory Metadata & Security Watermark
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Signatory Full Name
                      </label>
                      <input
                        type="text"
                        value={signatoryName}
                        onChange={(e) => setSignatoryName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded-xl px-3 py-2 outline-none focus:border-blue-500"
                        placeholder="e.g. Rajesh Sharma"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Signatory Designation
                      </label>
                      <input
                        type="text"
                        value={signatoryDesignation}
                        onChange={(e) => setSignatoryDesignation(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded-xl px-3 py-2 outline-none focus:border-blue-500"
                        placeholder="e.g. Chief Compliance Officer"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={watermark}
                        onChange={(e) => setWatermark(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                      />
                      <span>Enable Watermark</span>
                    </label>

                    {watermark && (
                      <input
                        type="text"
                        value={watermarkText}
                        onChange={(e) => setWatermarkText(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-800 rounded-lg px-2.5 py-1 outline-none w-48"
                        placeholder="CONFIDENTIAL"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Live Summary Metrics & Actions (5 Cols) */}
              <div className="lg:col-span-5 space-y-6">
                {/* Data Overview Card */}
                <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                      Report Dataset Metrics
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[11px] font-mono font-bold">
                      {activeSummary.monthlyRecords.length} Months
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 font-mono">
                    <div className="bg-slate-800/80 p-3 rounded-xl">
                      <span className="text-[10px] text-slate-400 block uppercase font-sans font-bold">Total Turnover</span>
                      <span className="text-sm font-extrabold text-white">
                        ₹{(activeSummary.totalTurnover / 10000000).toFixed(2)} Cr
                      </span>
                    </div>

                    <div className="bg-slate-800/80 p-3 rounded-xl">
                      <span className="text-[10px] text-slate-400 block uppercase font-sans font-bold">Gross Output Tax</span>
                      <span className="text-sm font-extrabold text-rose-400">
                        ₹{(activeSummary.totalGrossLiability / 100000).toFixed(2)} L
                      </span>
                    </div>

                    <div className="bg-slate-800/80 p-3 rounded-xl">
                      <span className="text-[10px] text-slate-400 block uppercase font-sans font-bold">Available 2B ITC</span>
                      <span className="text-sm font-extrabold text-emerald-400">
                        ₹{(activeSummary.totalAvailableItc / 100000).toFixed(2)} L
                      </span>
                    </div>

                    <div className="bg-slate-800/80 p-3 rounded-xl">
                      <span className="text-[10px] text-slate-400 block uppercase font-sans font-bold">Net Cash Paid</span>
                      <span className="text-sm font-extrabold text-blue-400">
                        ₹{(activeSummary.totalPaidViaCash / 100000).toFixed(2)} L
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">ITC Coverage Efficiency</span>
                    <span className="text-emerald-400 font-extrabold font-mono">{activeSummary.overallItcCoverage}%</span>
                  </div>
                </div>

                {/* Primary Export Actions */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">
                    Download & Dispatch Actions
                  </h4>

                  {/* Primary PDF Download Button */}
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={isGenerating}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Generating Statutory PDF...
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        Download Statutory PDF Report
                      </>
                    )}
                  </button>

                  {/* Secondary Format Buttons */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={handleExportExcel}
                      disabled={isGenerating}
                      className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FileSpreadsheet size={14} className="text-emerald-600" />
                      Excel (.xlsx)
                    </button>

                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FileText size={14} className="text-slate-600" />
                      CSV Dataset
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Printer size={14} className="text-slate-600" />
                      Print Document
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('PREVIEW')}
                      className="py-2.5 px-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye size={14} className="text-blue-600" />
                      View Preview
                    </button>
                  </div>
                </div>

                {/* Audit Certificate Badge */}
                <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-start gap-3">
                  <div className="p-2 bg-blue-600 text-white rounded-xl shrink-0 mt-0.5">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-blue-950 block">Statutory Audit-Proof Guarantee</span>
                    <p className="text-[11px] text-blue-800/80 mt-0.5 leading-relaxed">
                      Generated documents adhere strictly to GST Portal Table 4 eligibility criteria, Rule 88A tax settlement hierarchy, and Section 16(2)(aa) 2B mandates.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Tab: Live Interactive PDF Preview */
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-slate-900 flex items-center gap-2">
                    <Eye size={16} className="text-blue-600" />
                    Live Generated PDF Preview
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    ({orientation.toUpperCase()} • {theme} • {selectedFy})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewLoading(true);
                      setTimeout(() => {
                        setPreviewUri(getMonthlyLiabilityPdfDataUri(pdfOptions));
                        setPreviewLoading(false);
                      }, 100);
                    }}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer text-xs font-bold flex items-center gap-1.5"
                    title="Refresh Preview"
                  >
                    <RefreshCw size={13} className={previewLoading ? 'animate-spin' : ''} />
                    Refresh
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Download size={14} />
                    Download PDF
                  </button>
                </div>
              </div>

              {/* Preview Canvas / Iframe */}
              <div className="bg-slate-200 rounded-2xl border border-slate-300 h-[620px] overflow-hidden flex items-center justify-center relative shadow-inner">
                {previewLoading ? (
                  <div className="flex flex-col items-center gap-2.5 text-slate-600">
                    <Loader2 size={28} className="animate-spin text-blue-600" />
                    <span className="text-xs font-bold">Rendering High-Resolution PDF...</span>
                  </div>
                ) : previewUri ? (
                  <iframe
                    src={previewUri}
                    title="PDF Preview"
                    className="w-full h-full border-0 rounded-2xl"
                  />
                ) : (
                  <div className="text-slate-500 text-xs font-bold">Unable to render preview. Click download instead.</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium">
            Powered by TaxFlow <span className="font-bold text-slate-700">vendor-exports</span> bundle engine.
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download size={14} />
              Export PDF Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export interface MonthlyGstLiabilityExportButtonProps {
  summary?: FinancialYearReportingSummary;
  tenantName?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  label?: string;
}

export const MonthlyGstLiabilityExportButton: React.FC<MonthlyGstLiabilityExportButtonProps> = ({
  summary,
  tenantName = 'TaxFlow Enterprise Ltd',
  className = '',
  variant = 'primary',
  label = 'Export PDF Report'
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  let variantStyle = 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs';
  if (variant === 'secondary') {
    variantStyle = 'bg-slate-800 hover:bg-slate-900 text-white shadow-xs';
  } else if (variant === 'outline') {
    variantStyle = 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs';
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${variantStyle} ${className}`}
        title="Generate and Download Monthly GST Liability & ITC PDF Report"
      >
        <Download size={14} />
        {label}
      </button>

      <MonthlyGstLiabilityExportModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        initialSummary={summary}
        tenantName={tenantName}
      />
    </>
  );
};

export default MonthlyGstLiabilityExportModal;
