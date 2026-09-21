import React, { useState, useEffect } from 'react';
import { 
  Image as ImageIcon, 
  Upload, 
  FileText, 
  CheckCircle2, 
  Trash2, 
  Palette, 
  Building2, 
  Sparkles, 
  Layout, 
  Eye, 
  Download, 
  Check, 
  Sliders, 
  ShieldCheck, 
  FileCode2,
  Lock,
  Printer
} from 'lucide-react';
import { generateGstSummaryPdf } from '../utils/pdfReportGenerator';

export type ReportThemeKey = 'CORPORATE' | 'MINIMALIST' | 'MODERN';
export type FontScaleKey = 'COMPACT' | 'STANDARD' | 'COMFORTABLE';

export interface ReportThemeOption {
  id: ReportThemeKey;
  name: string;
  tagline: string;
  description: string;
  icon: React.FC<{ size?: number; className?: string }>;
  primaryColorHex: string;
  accentColorHex: string;
  badgeBg: string;
  badgeText: string;
  headerStyleName: string;
  tableBorderType: string;
  previewColors: string[];
}

export const REPORT_THEMES: ReportThemeOption[] = [
  {
    id: 'CORPORATE',
    name: 'Corporate Executive',
    tagline: 'Formal, structured & high-contrast navy',
    description: 'Traditional financial layout featuring deep navy header banners, crisp table grids, serif accent headings, and formal executive styling.',
    icon: Building2,
    primaryColorHex: '#0f172a',
    accentColorHex: '#1e3a8a',
    badgeBg: 'bg-slate-900',
    badgeText: 'text-white',
    headerStyleName: 'Navy Solid Banner & Formal Serif',
    tableBorderType: 'Full Double-Grid Borders',
    previewColors: ['#0f172a', '#1e3a8a', '#475569', '#f8fafc']
  },
  {
    id: 'MINIMALIST',
    name: 'Minimalist Clean',
    tagline: 'Clutter-free, subtle slate & monochrome',
    description: 'Sleek, lightweight design prioritizing clean typography and generous whitespace with hairline dividers and zero unnecessary containers.',
    icon: Sparkles,
    primaryColorHex: '#334155',
    accentColorHex: '#64748b',
    badgeBg: 'bg-slate-200',
    badgeText: 'text-slate-800',
    headerStyleName: 'Hairline Accent & Clean Sans',
    tableBorderType: 'Borderless Hairline Rows',
    previewColors: ['#334155', '#64748b', '#94a3b8', '#ffffff']
  },
  {
    id: 'MODERN',
    name: 'Modern Tech',
    tagline: 'Contemporary indigo gradient & pill tags',
    description: 'Vibrant indigo header accents, pill tags, rounded metric highlight boxes, and modern tabular styling for executive dashboards.',
    icon: Palette,
    primaryColorHex: '#4f46e5',
    accentColorHex: '#2563eb',
    badgeBg: 'bg-indigo-600',
    badgeText: 'text-white',
    headerStyleName: 'Indigo Gradient & Pill Cards',
    tableBorderType: 'Rounded Light Striped Table',
    previewColors: ['#4f46e5', '#2563eb', '#10b981', '#f0fdf4']
  }
];

export const DocumentStylingConfig: React.FC<{ setToastMessage: (msg: string) => void }> = ({ setToastMessage }) => {
  // Local state for branding
  const [logo, setLogo] = useState<string | null>(null);
  const [letterhead, setLetterhead] = useState<string | null>(null);

  // Local state for Report Styling Theme
  const [selectedTheme, setSelectedTheme] = useState<ReportThemeKey>('MODERN');
  const [fontScale, setFontScale] = useState<FontScaleKey>('STANDARD');
  const [enableWatermark, setEnableWatermark] = useState<boolean>(true);
  const [enableFooter, setEnableFooter] = useState<boolean>(true);
  const [disclaimerText, setDisclaimerText] = useState<string>(
    'This tax document is system-generated and verified against GSTR-1 & GSTR-3B registers.'
  );

  useEffect(() => {
    setLogo(localStorage.getItem('company_logo'));
    setLetterhead(localStorage.getItem('company_letterhead'));

    const savedTheme = (localStorage.getItem('report_theme') as ReportThemeKey) || 'MODERN';
    setSelectedTheme(savedTheme);

    const savedFont = (localStorage.getItem('report_font_scale') as FontScaleKey) || 'STANDARD';
    setFontScale(savedFont);

    const savedWatermark = localStorage.getItem('report_watermark');
    if (savedWatermark !== null) setEnableWatermark(savedWatermark === 'true');

    const savedFooter = localStorage.getItem('report_footer');
    if (savedFooter !== null) setEnableFooter(savedFooter === 'true');

    const savedDisclaimer = localStorage.getItem('report_disclaimer');
    if (savedDisclaimer) setDisclaimerText(savedDisclaimer);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'letterhead') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'logo') {
          setLogo(reader.result as string);
        } else {
          setLetterhead(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveAll = () => {
    if (logo) localStorage.setItem('company_logo', logo);
    else localStorage.removeItem('company_logo');

    if (letterhead) localStorage.setItem('company_letterhead', letterhead);
    else localStorage.removeItem('company_letterhead');

    localStorage.setItem('report_theme', selectedTheme);
    localStorage.setItem('report_font_scale', fontScale);
    localStorage.setItem('report_watermark', enableWatermark ? 'true' : 'false');
    localStorage.setItem('report_footer', enableFooter ? 'true' : 'false');
    localStorage.setItem('report_disclaimer', disclaimerText);

    setToastMessage(`Report styling preferences saved successfully! (${selectedTheme} theme active)`);
  };

  const handleGenerateSamplePdf = () => {
    handleSaveAll();
    const mockData: any = {
      period: 'July 2026',
      outputLiability: { taxableValue: 12500000, igst: 1250000, cgst: 500000, sgst: 500000, utgst: 0, cess: 0 },
      rcmLiability: { taxableValue: 400000, igst: 36000, cgst: 18000, sgst: 18000, utgst: 0, cess: 0 },
      inputTaxCredit: { taxableValue: 9800000, igst: 980000, cgst: 390000, sgst: 390000, utgst: 0, cess: 0, blocked: 25000 },
      netPayable: { igst: 270000, cgst: 110000, sgst: 110000, utgst: 0, cess: 0 },
      gstr1Mapping: [
        { table: '4A', description: 'B2B Regular Invoices', source: 'ERP_SALES', taxableValue: 10000000, liability: 1800000 },
        { table: '5A', description: 'B2C Large Interstate Supplies', source: 'ERP_SALES', taxableValue: 2500000, liability: 450000 }
      ],
      gstr3bMapping: [
        { table: '3.1(a)', description: 'Outward Taxable Supplies', source: 'GSTR_1', taxableValue: 12500000, liability: 2250000 },
        { table: '4(A)(5)', description: 'All Other ITC Available', source: 'GSTR_2B', taxableValue: 9800000, liability: 1760000 }
      ]
    };

    const mockTenant = {
      id: 't1',
      name: 'Acme Enterprise Global Pvt Ltd',
      gstin: '27ABCDE1234F1Z5',
      address: 'Suite 402, Trade Tower, Bandra Kurla Complex, Mumbai, Maharashtra 400051',
      stateCode: '27'
    };

    generateGstSummaryPdf(mockData, 'July 2026', mockTenant);
    setToastMessage(`Sample PDF Tax Report generated using ${selectedTheme} theme!`);
  };

  const activeThemeObj = REPORT_THEMES.find(t => t.id === selectedTheme) || REPORT_THEMES[2];

  return (
    <div className="max-w-5xl space-y-10 font-sans">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
          <Palette size={22} className="text-blue-600" />
          PDF Tax Report Styling & Themes
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Customize the visual branding, color palettes, typography, and page headers for all generated PDF tax reports, GSTR summaries, and audit exports.
        </p>
      </div>

      {/* SECTION 1: PREDEFINED THEME SELECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Layout size={15} className="text-indigo-600" />
            1. Select Predefined Professional Theme
          </h4>
          <span className="text-[11px] font-mono text-indigo-600 font-bold bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
            Active Theme: {activeThemeObj.name}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {REPORT_THEMES.map((theme) => {
            const Icon = theme.icon;
            const isSelected = selectedTheme === theme.id;
            return (
              <div
                key={theme.id}
                onClick={() => setSelectedTheme(theme.id)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between relative overflow-hidden group ${
                  isSelected
                    ? 'bg-slate-900 text-white border-blue-500 ring-2 ring-blue-500/50 shadow-lg scale-[1.02]'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                {/* Selected Checkmark Badge */}
                {isSelected && (
                  <div className="absolute top-3 right-3 bg-blue-500 text-white p-1 rounded-full shadow-md">
                    <Check size={14} strokeWidth={3} />
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className={`p-2 rounded-xl ${isSelected ? 'bg-slate-800 text-blue-400' : 'bg-slate-100 text-slate-700'}`}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <h5 className="font-bold text-sm">{theme.name}</h5>
                      <span className={`text-[10px] font-bold block ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                        {theme.tagline}
                      </span>
                    </div>
                  </div>

                  <p className={`text-xs leading-relaxed mb-4 ${isSelected ? 'text-slate-300' : 'text-slate-600'}`}>
                    {theme.description}
                  </p>
                </div>

                {/* Color Swatch Bar */}
                <div className="pt-3 border-t border-slate-200/20 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className={isSelected ? 'text-slate-400' : 'text-slate-500'}>Palette:</span>
                    <span className={isSelected ? 'text-slate-300 font-bold' : 'text-slate-700 font-bold'}>
                      {theme.primaryColorHex}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {theme.previewColors.map((hex, idx) => (
                      <span
                        key={idx}
                        className="w-5 h-5 rounded-md border border-white/20 shadow-xs inline-block"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: LIVE INTERACTIVE PREVIEW CANVAS */}
      <div className="p-6 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-blue-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider">
              Live PDF Report Interactive Preview ({activeThemeObj.name})
            </h4>
          </div>

          <button
            type="button"
            onClick={handleGenerateSamplePdf}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md transition-all"
          >
            <Download size={13} /> Download Sample PDF
          </button>
        </div>

        {/* Mock A4 Paper Preview Box */}
        <div className="bg-white text-slate-900 rounded-xl p-6 shadow-2xl font-sans max-w-3xl mx-auto space-y-5 border border-slate-300">
          {/* Mock Header Banner */}
          <div
            className="p-4 rounded-lg flex items-center justify-between text-white"
            style={{ backgroundColor: activeThemeObj.primaryColorHex }}
          >
            <div>
              <span className="text-[10px] font-mono tracking-widest font-bold uppercase block opacity-80">
                TAXFLOW COMPLIANCE PLATFORM
              </span>
              <h5 className="text-sm font-black uppercase tracking-wide mt-0.5">
                Consolidated Monthly GST Report
              </h5>
            </div>
            <div className="text-right font-mono text-[10px] opacity-90">
              <div>Return Period: July 2026</div>
              <div>Generated: 26 Aug 2026</div>
            </div>
          </div>

          {/* Taxpayer Meta Block */}
          <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-200">
            <div>
              <div className="font-black text-slate-800 text-sm">Acme Enterprise Global Pvt Ltd</div>
              <div className="text-slate-500 font-mono text-[11px]">GSTIN: 27ABCDE1234F1Z5 • State: Maharashtra (27)</div>
            </div>
            <span
              className="px-2.5 py-1 rounded text-[10px] font-bold font-mono text-white"
              style={{ backgroundColor: activeThemeObj.accentColorHex }}
            >
              STATUS: VERIFIED COMPLIANT
            </span>
          </div>

          {/* Sample Key Metrics Grid */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[9px] font-bold text-slate-400 block uppercase">Gross Output</span>
              <span className="font-bold font-mono text-slate-800 text-xs">₹ 22,50,000</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[9px] font-bold text-slate-400 block uppercase">RCM Liability</span>
              <span className="font-bold font-mono text-amber-600 text-xs">₹ 72,000</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[9px] font-bold text-slate-400 block uppercase">Eligible ITC</span>
              <span className="font-bold font-mono text-emerald-600 text-xs">₹ 17,60,000</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[9px] font-bold text-slate-400 block uppercase">Net Cash Payable</span>
              <span className="font-bold font-mono text-blue-600 text-xs">₹ 4,90,000</span>
            </div>
          </div>

          {/* Sample Table Mock */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              1. Component Tax Breakdown
            </span>
            <div className="border border-slate-200 rounded-lg overflow-hidden text-[11px]">
              <table className="w-full text-left">
                <thead
                  className="text-white font-bold"
                  style={{ backgroundColor: activeThemeObj.accentColorHex }}
                >
                  <tr>
                    <th className="p-2">Tax Head</th>
                    <th className="p-2 text-right">Taxable Value</th>
                    <th className="p-2 text-right">IGST</th>
                    <th className="p-2 text-right">CGST</th>
                    <th className="p-2 text-right">Net Tax</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-slate-700">
                  <tr className="bg-white">
                    <td className="p-2 font-sans font-bold">Output Sales (Outward)</td>
                    <td className="p-2 text-right">₹ 1,25,000</td>
                    <td className="p-2 text-right">₹ 12,500</td>
                    <td className="p-2 text-right">₹ 5,000</td>
                    <td className="p-2 text-right font-bold">₹ 22,500</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 font-sans font-bold">Input Tax Credit (Inward)</td>
                    <td className="p-2 text-right">₹ 98,000</td>
                    <td className="p-2 text-right">₹ 9,800</td>
                    <td className="p-2 text-right">₹ 3,900</td>
                    <td className="p-2 text-right font-bold text-emerald-600">₹ 17,600</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Mock Watermark / Footer */}
          {enableWatermark && (
            <div className="text-center text-[9px] font-mono text-rose-500/70 font-bold uppercase tracking-widest pt-1">
              *** CONFIDENTIAL — INTERNAL TAX AUDIT ***
            </div>
          )}

          {enableFooter && (
            <div className="pt-3 border-t border-slate-200 flex justify-between text-[9px] text-slate-400 font-mono">
              <span>{disclaimerText}</span>
              <span>Page 1 of 1</span>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: COMPANY BRANDING (LOGO & LETTERHEAD) */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <ImageIcon size={15} className="text-blue-500" />
          2. Organization Branding & Watermark Assets
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Logo Upload */}
          <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm space-y-3">
            <h5 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ImageIcon size={16} className="text-slate-500" /> Company Logo
            </h5>
            {logo ? (
              <div className="relative border border-slate-200 rounded-xl p-4 flex items-center justify-center bg-slate-50">
                <img src={logo} alt="Company Logo" className="max-h-20 object-contain" />
                <button
                  type="button"
                  onClick={() => setLogo(null)}
                  className="absolute top-2 right-2 p-1.5 bg-rose-100 text-rose-600 rounded-full hover:bg-rose-200 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors group">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-xs text-slate-400 group-hover:text-blue-500 mb-2 transition-colors">
                  <Upload size={18} />
                </div>
                <span className="text-xs font-bold text-slate-700">Upload Company Logo</span>
                <span className="text-[10px] text-slate-500 mt-0.5">PNG, JPG up to 1MB</span>
                <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={(e) => handleFileUpload(e, 'logo')} />
              </label>
            )}
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Renders on the top left of every generated report header.
            </p>
          </div>

          {/* Letterhead Banner */}
          <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm space-y-3">
            <h5 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileText size={16} className="text-slate-500" /> Letterhead Header Banner
            </h5>
            {letterhead ? (
              <div className="relative border border-slate-200 rounded-xl p-4 flex items-center justify-center bg-slate-50">
                <img src={letterhead} alt="Company Letterhead" className="max-h-20 w-full object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={() => setLetterhead(null)}
                  className="absolute top-2 right-2 p-1.5 bg-rose-100 text-rose-600 rounded-full hover:bg-rose-200 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors group">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-xs text-slate-400 group-hover:text-blue-500 mb-2 transition-colors">
                  <Upload size={18} />
                </div>
                <span className="text-xs font-bold text-slate-700">Upload Letterhead Header Banner</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Recommended 2100x300px (PNG/JPG)</span>
                <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={(e) => handleFileUpload(e, 'letterhead')} />
              </label>
            )}
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Full-width graphic banner at the top of statutory tax filings.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 4: ADVANCED FORMATTING PREFERENCES */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-5">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <Sliders size={15} className="text-indigo-600" />
          3. Document Formatting & Security Preferences
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Font Scaling */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">Report Font Scaling</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'COMPACT', label: 'Compact (8pt)' },
                { id: 'STANDARD', label: 'Standard (10pt)' },
                { id: 'COMFORTABLE', label: 'Comfortable (12pt)' }
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFontScale(f.id as FontScaleKey)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                    fontScale === f.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles: Watermark & Footer */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Confidential Watermark</span>
                <span className="text-[10px] text-slate-500">Prints internal audit stamp on PDF</span>
              </div>
              <button
                type="button"
                onClick={() => setEnableWatermark(!enableWatermark)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  enableWatermark ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span className={`${enableWatermark ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Footer & Page Numbers</span>
                <span className="text-[10px] text-slate-500">Includes system timestamp & disclaimer</span>
              </div>
              <button
                type="button"
                onClick={() => setEnableFooter(!enableFooter)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  enableFooter ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span className={`${enableFooter ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
              </button>
            </div>
          </div>
        </div>

        {/* Disclaimer Text Input */}
        <div className="space-y-1.5 pt-2">
          <label className="text-xs font-bold text-slate-700 block">Custom Report Footer Disclaimer</label>
          <input
            type="text"
            value={disclaimerText}
            onChange={(e) => setDisclaimerText(e.target.value)}
            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-sans"
          />
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={handleGenerateSamplePdf}
          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition-colors flex items-center gap-2"
        >
          <Printer size={16} />
          Test & Download Sample PDF
        </button>

        <button
          type="button"
          onClick={handleSaveAll}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
        >
          <CheckCircle2 size={18} />
          Save Report Styling Preferences
        </button>
      </div>
    </div>
  );
};

export default DocumentStylingConfig;
