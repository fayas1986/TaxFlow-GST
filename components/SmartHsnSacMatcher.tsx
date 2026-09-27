import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Search,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Calculator,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  BookOpen,
  Layers,
  Tag,
  Download,
  Upload,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Bookmark,
  BookmarkCheck,
  Info,
  Scale,
  Percent,
  CheckCheck,
  HelpCircle,
  FileText,
  Clock,
  Trash2,
  Filter,
  X,
  Building2,
  Truck,
  Cpu,
  ShieldAlert,
  ArrowUpRight,
  ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { matchHsnSacCode, batchMatchHsnSacCodes } from '../services/api';
import { HsnSacMatchResult, BatchHsnMatchItem, AlternativeHsnCandidate } from '../types';
import { HSN_DIRECTORY } from '../data/hsnData';

// Preset sample enterprise search queries for quick testing
const QUICK_SAMPLE_QUERIES = [
  {
    label: '💻 Cloud SaaS & Hosting',
    query: 'Cloud hosting compute instances with SSD volumes and managed DevOps APIs',
    category: 'SERVICES' as const
  },
  {
    label: '💊 Prescription Oncology Drugs',
    query: 'Chemotherapy injection vials and life-saving oncology capsules',
    category: 'GOODS' as const
  },
  {
    label: '⚖️ High Court Legal Advocacy',
    query: 'Senior advocate arbitration representation and court litigation consultancy',
    category: 'SERVICES' as const
  },
  {
    label: '🚗 Electric Car (EV)',
    query: 'Electric passenger car propelled solely by lithium-ion traction battery',
    category: 'GOODS' as const
  },
  {
    label: '🚛 Road Freight Logistics (GTA)',
    query: 'Goods transport agency containerized road freight carriage with consignment note',
    category: 'SERVICES' as const
  },
  {
    label: '🌾 Pre-packaged Basmati Rice',
    query: 'Aged basmati rice in 10kg branded sealed retail bags with metrology label',
    category: 'GOODS' as const
  },
  {
    label: '👕 Cotton Knitted T-Shirts',
    query: 'Readymade round neck cotton knitted t-shirts for retail fashion sales',
    category: 'GOODS' as const
  },
  {
    label: '⚙️ Industrial Hydraulic Valves',
    query: 'High-pressure cast steel hydraulic directional control valves and actuators',
    category: 'GOODS' as const
  }
];

const DEFAULT_BATCH_ITEMS = [
  { id: 'item-1', query: 'MacBook Pro 16-inch M3 Max laptop computer', unitPrice: 249000, quantity: 5, category: 'GOODS' as const },
  { id: 'item-2', query: 'AWS Cloud EC2 server hosting & database storage subscription', unitPrice: 85000, quantity: 1, category: 'SERVICES' as const },
  { id: 'item-3', query: 'Senior advocate court appearance and legal opinion fee', unitPrice: 150000, quantity: 1, category: 'SERVICES' as const },
  { id: 'item-4', query: 'Paracetamol 650mg anti-pyretic formulation tablets (box of 100)', unitPrice: 450, quantity: 200, category: 'GOODS' as const },
  { id: 'item-5', query: 'Goods transport road freight from Mumbai to Delhi warehouse', unitPrice: 42000, quantity: 2, category: 'SERVICES' as const },
  { id: 'item-6', query: 'Electric vehicle 4-wheeler passenger motor car (EV)', unitPrice: 1650000, quantity: 1, category: 'GOODS' as const }
];

interface SmartHsnSacMatcherProps {
  initialQuery?: string;
  onSelectCode?: (code: string, match: HsnSacMatchResult) => void;
  compactMode?: boolean;
}

export const SmartHsnSacMatcher: React.FC<SmartHsnSacMatcherProps> = ({
  initialQuery = '',
  onSelectCode,
  compactMode = false
}) => {
  const navigate = useNavigate();

  // Mode Selection
  const [activeMode, setActiveMode] = useState<'SINGLE' | 'BATCH' | 'HIERARCHY'>('SINGLE');

  // Single Search State
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [categoryPreference, setCategoryPreference] = useState<'ALL' | 'GOODS' | 'SERVICES'>('ALL');
  const [turnoverBracket, setTurnoverBracket] = useState<'UNDER_5CR' | 'ABOVE_5CR' | 'EXPORTS'>('ABOVE_5CR');
  const [isLoading, setIsLoading] = useState(false);
  const [matchResult, setMatchResult] = useState<HsnSacMatchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>('Initializing...');

  // Copy feedback state
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Saved / Favorite Codes
  const [bookmarkedCodes, setBookmarkedCodes] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('taxflow_hsn_bookmarks');
      return saved ? JSON.parse(saved) : ['8471 30 10', '9983 14', '9982 11'];
    } catch {
      return ['8471 30 10', '9983 14'];
    }
  });

  // Recent Matches History
  const [recentMatches, setRecentMatches] = useState<HsnSacMatchResult[]>(() => {
    try {
      const saved = localStorage.getItem('taxflow_ai_hsn_matches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Batch Matching State
  const [batchInputText, setBatchInputText] = useState<string>(() => {
    return DEFAULT_BATCH_ITEMS.map(i => `${i.query} | ${i.unitPrice} | ${i.quantity}`).join('\n');
  });
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [batchSummary, setBatchSummary] = useState<any>(null);

  // Expanded Nodes in Hierarchy View
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'ch-84': true,
    'ch-99': true,
    'hd-8471': true,
    'hd-9983': true
  });

  // Auto-trigger search if initialQuery provided
  useEffect(() => {
    if (initialQuery && initialQuery.trim().length > 2 && !matchResult) {
      handleMatch(initialQuery);
    }
  }, [initialQuery]);

  // Execute AI Semantic Match
  const handleMatch = async (queryToMatch?: string) => {
    const q = (queryToMatch || searchQuery).trim();
    if (!q) {
      setSearchError('Please enter a product name, commodity description, or service details to match.');
      return;
    }

    setIsLoading(true);
    setSearchError(null);
    setLoadingStep('Analyzing Trade Characteristics & Commercial Keywords...');

    const stepTimer1 = setTimeout(() => {
      setLoadingStep('Matching WCO Harmonized System & CBIC Chapter Headings...');
    }, 600);

    const stepTimer2 = setTimeout(() => {
      setLoadingStep('Evaluating General Interpretation Rules (GRI) & Tax Rates...');
    }, 1300);

    try {
      const result = await matchHsnSacCode({
        description: q,
        categoryPreference,
        turnoverBracket
      });

      setMatchResult(result);

      // Save to recent matches
      setRecentMatches(prev => {
        const filtered = prev.filter(p => p.cleanCode !== result.cleanCode);
        const updated = [result, ...filtered].slice(0, 15);
        try {
          localStorage.setItem('taxflow_ai_hsn_matches', JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed saving recent match', e);
        }
        return updated;
      });
    } catch (err: any) {
      console.error('HSN/SAC Match failed:', err);
      setSearchError(err.message || 'Failed to match HSN/SAC code. Please try again.');
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setIsLoading(false);
    }
  };

  // Toggle Bookmark
  const toggleBookmark = (code: string) => {
    setBookmarkedCodes(prev => {
      const next = prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code];
      try {
        localStorage.setItem('taxflow_hsn_bookmarks', JSON.stringify(next));
      } catch (e) {
        console.warn('Failed bookmarking code', e);
      }
      return next;
    });
  };

  // Handle 1-Click Copy
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code.replace(/\s+/g, ''));
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopySummary = (res: HsnSacMatchResult) => {
    const summaryText = `[HSN/SAC CLASSIFICATION DOSSIER]
Matched Code: ${res.matchedCode} (${res.codeType})
Commodity: ${res.commodityName}
Official Description: ${res.officialDescription}
GST Rate: ${res.gstRate}% (CGST: ${res.rateBreakdown.cgst}%, SGST: ${res.rateBreakdown.sgst}%, IGST: ${res.rateBreakdown.igst}%)
Chapter: ${res.chapter.code} - ${res.chapter.title}
Heading: ${res.heading.code} - ${res.heading.title}
Unit Quantity Code (UQC): ${res.uqc}
Confidence: ${res.matchConfidence}% (${res.confidenceLevel})
Reverse Charge (RCM): ${res.statutoryNotes.rcmApplicable ? 'YES - Applicable under Sec 9(3)' : 'NO - Normal Forward Charge'}
ITC Eligibility: ${res.statutoryNotes.itcEligibility}
Classification Rationale: ${res.semanticRationale}
GRI Rules Applied: ${res.griClassificationRulesApplied.join(', ')}`;

    navigator.clipboard.writeText(summaryText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // Batch Matching Handler
  const handleRunBatchMatch = async () => {
    const lines = batchInputText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    const items: BatchHsnMatchItem[] = lines.map((line, idx) => {
      const parts = line.split('|').map(p => p.trim());
      const query = parts[0] || line;
      const unitPrice = parts[1] ? parseFloat(parts[1]) : 1000;
      const quantity = parts[2] ? parseFloat(parts[2]) : 1;
      return {
        id: `batch-${idx + 1}`,
        query,
        unitPrice: isNaN(unitPrice) ? 1000 : unitPrice,
        quantity: isNaN(quantity) ? 1 : quantity
      };
    });

    setIsBatchLoading(true);
    try {
      const response = await batchMatchHsnSacCodes(items, turnoverBracket);
      setBatchResults(response.results);
      setBatchSummary(response.summary);
    } catch (err: any) {
      alert('Batch match error: ' + (err.message || 'Failed to match batch items'));
    } finally {
      setIsBatchLoading(false);
    }
  };

  // Export Batch Results to Excel
  const handleExportBatchExcel = () => {
    if (batchResults.length === 0) return;

    const exportData = batchResults.map((r, i) => ({
      'S.No': i + 1,
      'Query Description': r.userQuery,
      'Matched Code': r.matchedCode,
      'Code Type': r.codeType,
      'Commodity Name': r.commodityName,
      'Official Tariff Description': r.officialDescription,
      'Chapter': `${r.chapter?.code} - ${r.chapter?.title}`,
      'GST Rate (%)': r.gstRate,
      'CGST (%)': r.rateBreakdown?.cgst,
      'SGST (%)': r.rateBreakdown?.sgst,
      'IGST (%)': r.rateBreakdown?.igst,
      'UQC Unit': r.uqc,
      'Confidence (%)': r.matchConfidence,
      'RCM Applicable': r.statutoryNotes?.rcmApplicable ? 'YES' : 'NO',
      'ITC Eligibility': r.statutoryNotes?.itcEligibility,
      'Semantic Rationale': r.semanticRationale
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AI_HSN_SAC_Matches');
    XLSX.writeFile(wb, `HSN_SAC_AI_Classification_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="w-full space-y-6">
      {/* Header Banner */}
      {!compactMode && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-900/50">
          <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute right-40 bottom-0 w-64 h-64 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                Gemini 2.5 Flash • CBIC & WCO Standardized Tariff Engine
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                Intelligent HSN / SAC Semantic Matcher
              </h2>
              <p className="text-slate-300 text-sm sm:text-base max-w-2xl mt-1.5 leading-relaxed">
                Matches complex, natural-language, or vendor product descriptions to exact standardized 4/6/8-digit HSN (Goods) and 6-digit SAC (Services) codes with statutory General Interpretation Rules (GRI) and tax breakdown.
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/80 self-start md:self-center shrink-0">
              <button
                onClick={() => setActiveMode('SINGLE')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  activeMode === 'SINGLE'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                Live AI Matcher
              </button>
              <button
                onClick={() => setActiveMode('BATCH')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  activeMode === 'BATCH'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Batch Catalog Matcher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 1: SINGLE ITEM LIVE INTELLIGENT MATCHING */}
      {/* ========================================================================= */}
      {activeMode === 'SINGLE' && (
        <div className="space-y-6">
          {/* Search Box & Controls Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-600" />
                Describe the Product, Commodity, or Service
              </label>

              {/* Turnover Bracket Toggle for Mandated Digits */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Turnover Rule:</span>
                <select
                  value={turnoverBracket}
                  onChange={(e) => setTurnoverBracket(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ABOVE_5CR">&gt; ₹5 Cr (6-Digit Mandatory)</option>
                  <option value="UNDER_5CR">&lt; ₹5 Cr (4-Digit B2B Minimum)</option>
                  <option value="EXPORTS">Export / Import (8-Digit Mandatory)</option>
                </select>
              </div>
            </div>

            {/* Input with embedded actions */}
            <div className="relative">
              <textarea
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleMatch();
                  }
                }}
                rows={2}
                placeholder="e.g., Enterprise cloud computing hosting with SSD volumes, or Unbranded fresh whole wheat grains, or Legal advocacy in high court tribunal..."
                className="w-full pl-4 pr-32 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-300 focus:border-indigo-500 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
              />

              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-all"
                    title="Clear input"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleMatch()}
                  disabled={isLoading || !searchQuery.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Matching...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Match Code
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Category Preference Filter & Quick Presets */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Filter:</span>
                {(['ALL', 'GOODS', 'SERVICES'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryPreference(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      categoryPreference === cat
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat === 'ALL' ? 'All (Goods & Services)' : cat === 'GOODS' ? 'Goods (HSN)' : 'Services (SAC)'}
                  </button>
                ))}
              </div>

              <div className="text-xs text-slate-400">
                Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded-md text-[10px] font-mono text-slate-600">Enter ↵</kbd> to match
              </div>
            </div>

            {/* Quick Sample Queries */}
            <div className="pt-2 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-500" />
                Try Industry Presets:
              </div>
              <div className="flex flex-wrap gap-2">
                {QUICK_SAMPLE_QUERIES.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSearchQuery(preset.query);
                      setCategoryPreference(preset.category);
                      handleMatch(preset.query);
                    }}
                    className="px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 transition-all text-left flex items-center gap-1.5"
                  >
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Loading Animation Indicator */}
          {isLoading && (
            <div className="bg-white rounded-2xl p-8 border border-indigo-100 shadow-xs text-center space-y-4 animate-pulse">
              <div className="w-14 h-14 mx-auto bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                <Sparkles className="w-7 h-7 animate-spin" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-800">Analyzing Tariff Schedule...</h4>
                <p className="text-xs text-indigo-600 font-medium mt-1">{loadingStep}</p>
              </div>
              <div className="max-w-md mx-auto h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 w-2/3 animate-pulse" />
              </div>
            </div>
          )}

          {/* Error Banner */}
          {searchError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <div className="text-xs font-medium">{searchError}</div>
            </div>
          )}

          {/* Primary Match Result Card */}
          {matchResult && !isLoading && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0 transition-all">
              {/* Card Hero Header */}
              <div className="p-6 sm:p-7 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white relative overflow-hidden">
                <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
                  {/* Left: Code & Commodity Title */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className={`px-3 py-1 rounded-full text-xs font-extrabold tracking-wider uppercase flex items-center gap-1.5 ${
                        matchResult.codeType === 'HSN'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}>
                        {matchResult.codeType === 'HSN' ? <Layers className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                        {matchResult.codeType === 'HSN' ? 'HSN (Goods Tariff)' : 'SAC (Services Tariff)'}
                      </span>

                      {/* Confidence Meter Badge */}
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-amber-400" />
                        {matchResult.matchConfidence}% Match Confidence ({matchResult.confidenceLevel.replace('_', ' ')})
                      </span>

                      {/* UQC Unit */}
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-700/60 text-slate-300 border border-slate-600">
                        UQC: <strong className="text-white">{matchResult.uqc}</strong>
                      </span>
                    </div>

                    {/* Standard Formatted Code with Huge Glow Typography */}
                    <div className="flex items-baseline gap-4 flex-wrap">
                      <h3 className="text-3xl sm:text-4xl font-mono font-extrabold tracking-tight text-white flex items-center gap-3">
                        {matchResult.matchedCode}
                      </h3>

                      <button
                        onClick={() => handleCopyCode(matchResult.matchedCode)}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:scale-95 border border-white/20 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Copy Code"
                      >
                        {copiedCode ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-300">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy for ERP / Portal
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => toggleBookmark(matchResult.matchedCode)}
                        className={`p-2 rounded-lg border transition-all cursor-pointer ${
                          bookmarkedCodes.includes(matchResult.matchedCode)
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                            : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                        }`}
                        title="Bookmark this code"
                      >
                        {bookmarkedCodes.includes(matchResult.matchedCode) ? (
                          <BookmarkCheck className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Bookmark className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Trade Commodity Name */}
                    <div className="text-lg sm:text-xl font-bold text-indigo-100">
                      {matchResult.commodityName}
                    </div>

                    <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed italic border-l-2 border-indigo-400 pl-3">
                      "{matchResult.officialDescription}"
                    </p>
                  </div>

                  {/* Right: Statutory Tax Slab Pillar */}
                  <div className="bg-slate-800/90 border border-slate-700 p-4 rounded-xl shrink-0 min-w-[200px] text-center space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Standard GST Slab
                    </div>
                    <div className="text-3xl sm:text-4xl font-black text-emerald-400">
                      {matchResult.gstRate}%
                    </div>
                    <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-700/80 text-[11px]">
                      <div>
                        <div className="text-slate-400">CGST</div>
                        <div className="font-bold text-white">{matchResult.rateBreakdown.cgst}%</div>
                      </div>
                      <div>
                        <div className="text-slate-400">SGST</div>
                        <div className="font-bold text-white">{matchResult.rateBreakdown.sgst}%</div>
                      </div>
                      <div>
                        <div className="text-slate-400">IGST</div>
                        <div className="font-bold text-white">{matchResult.rateBreakdown.igst}%</div>
                      </div>
                    </div>

                    {/* RCM Alert Badge if applicable */}
                    {matchResult.statutoryNotes.rcmApplicable && (
                      <div className="mt-2 px-2 py-1 bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded text-[10px] font-bold uppercase tracking-wider">
                        ⚡ Reverse Charge (RCM)
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Main Content Body */}
              <div className="p-6 sm:p-7 space-y-6">
                {/* 1. Interactive 4-Level Tariff Hierarchy Tree */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200/90 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      Statutory Tariff Decomposition & Hierarchy
                    </h4>
                    <span className="text-[11px] font-medium text-slate-500">
                      {matchResult.mandatoryDigitsNotice}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {matchResult.hierarchy && matchResult.hierarchy.map((node, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 p-2.5 rounded-lg transition-all ${
                          i === matchResult.hierarchy.length - 1
                            ? 'bg-indigo-50 border border-indigo-200 text-indigo-950 font-semibold'
                            : 'bg-white border border-slate-200 text-slate-700'
                        }`}
                        style={{ marginLeft: `${i * 12}px` }}
                      >
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono font-bold text-[11px] shrink-0">
                          {node.digits}-Digit ({node.code})
                        </span>
                        <div className="space-y-0.5">
                          <span className="text-[10px] uppercase font-bold text-slate-400 mr-2">
                            {node.level}
                          </span>
                          <span className="font-medium">{node.title}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Grid: AI Semantic Rationale & GRI Interpretation Rules */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Semantic Reasoning */}
                  <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      AI Semantic Matching Rationale
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {matchResult.semanticRationale}
                    </p>
                    {matchResult.synonyms && matchResult.synonyms.length > 0 && (
                      <div className="pt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-slate-400">Trade Synonyms:</span>
                        {matchResult.synonyms.map((s, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px]">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* General Interpretation Rules (GRI) */}
                  <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <Scale className="w-4 h-4 text-emerald-600" />
                      General Rules for Interpretation (GRI) Applied
                    </h4>
                    <ul className="space-y-1.5 text-xs text-slate-600">
                      {matchResult.griClassificationRulesApplied && matchResult.griClassificationRulesApplied.map((rule, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>

                    {/* ITC & RCM Statutory Notes */}
                    <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">ITC Eligibility:</span>
                        <span className={`font-bold ${
                          matchResult.statutoryNotes.itcEligibility === 'ELIGIBLE' ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {matchResult.statutoryNotes.itcEligibility}
                        </span>
                      </div>
                      {matchResult.statutoryNotes.itcNote && (
                        <p className="text-[11px] text-slate-500 italic">
                          {matchResult.statutoryNotes.itcNote}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Disambiguation Matrix: Alternative Candidate Codes */}
                {matchResult.alternativeCandidates && matchResult.alternativeCandidates.length > 0 && (
                  <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-amber-600" />
                        Disambiguation Matrix: Alternative Candidate Codes
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        Compare adjacent tariff codes depending on specific trade scenarios
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {matchResult.alternativeCandidates.map((alt, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleMatch(alt.title)}
                          className="p-3.5 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 rounded-xl transition-all cursor-pointer space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs text-indigo-700 px-2 py-0.5 bg-indigo-100/70 rounded">
                              {alt.code} ({alt.gstRate}%)
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                              {alt.category}
                            </span>
                          </div>
                          <div className="font-bold text-xs text-slate-800">
                            {alt.title}
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2">
                            {alt.description}
                          </p>
                          <div className="text-[11px] text-amber-800 bg-amber-50/80 border border-amber-200/60 p-1.5 rounded font-medium">
                            <strong>Use When:</strong> {alt.distinctionCriteria}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Actions Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleCopySummary(matchResult)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <FileText className="w-3.5 h-3.5" />}
                      {copiedSummary ? 'Dossier Copied!' : 'Copy Full Classification Dossier'}
                    </button>

                    <button
                      onClick={() => {
                        navigate(`/rate-calculator?hsn=${encodeURIComponent(matchResult.cleanCode)}&rate=${matchResult.gstRate}`);
                      }}
                      className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      Calculate Tax in Rate Calculator
                    </button>

                    {onSelectCode && (
                      <button
                        onClick={() => onSelectCode(matchResult.matchedCode, matchResult)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Apply Code to Form
                      </button>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400">
                    Analyzed at {new Date(matchResult.analyzedAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent AI Matches Section */}
          {recentMatches.length > 0 && !matchResult && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  Recent Semantic Matches
                </h4>
                <button
                  onClick={() => {
                    setRecentMatches([]);
                    localStorage.removeItem('taxflow_ai_hsn_matches');
                  }}
                  className="text-xs text-slate-400 hover:text-rose-600 transition-all flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Clear History
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {recentMatches.slice(0, 6).map((m, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setSearchQuery(m.userQuery || m.commodityName);
                      setMatchResult(m);
                    }}
                    className="p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl transition-all cursor-pointer space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-indigo-700">
                        {m.matchedCode}
                      </span>
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                        {m.gstRate}%
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-800 truncate">
                      {m.commodityName}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {m.userQuery}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: BATCH SKU / LINE ITEM CLASSIFIER */}
      {/* ========================================================================= */}
      {activeMode === 'BATCH' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                  Bulk Catalog & Inventory HSN/SAC Matcher
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Paste SKU or product descriptions (one per line, format: Description | Unit Price | Qty)
                </p>
              </div>

              <button
                onClick={handleRunBatchMatch}
                disabled={isBatchLoading}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isBatchLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processing Batch...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Match All Items
                  </>
                )}
              </button>
            </div>

            <textarea
              value={batchInputText}
              onChange={(e) => setBatchInputText(e.target.value)}
              rows={6}
              placeholder="Description | Unit Price | Quantity"
              className="w-full p-4 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Batch Results Grid */}
          {batchResults.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Batch Classification Results ({batchResults.length} Items)
                  </h4>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                    <span>Avg Confidence: <strong>{batchSummary?.avgConfidence}%</strong></span>
                    <span>Goods: <strong>{batchSummary?.goodsCount}</strong></span>
                    <span>Services: <strong>{batchSummary?.servicesCount}</strong></span>
                  </div>
                </div>

                <button
                  onClick={handleExportBatchExcel}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export to Excel (.xlsx)
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-3">#</th>
                      <th className="p-3">Input Description</th>
                      <th className="p-3">Matched Code</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Tariff Commodity</th>
                      <th className="p-3 text-center">GST Rate</th>
                      <th className="p-3 text-center">UQC</th>
                      <th className="p-3 text-center">Confidence</th>
                      <th className="p-3">RCM / ITC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                    {batchResults.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-all">
                        <td className="p-3 text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-semibold text-slate-900 max-w-[200px] truncate" title={item.userQuery}>
                          {item.userQuery}
                        </td>
                        <td className="p-3 font-mono font-bold text-indigo-700">
                          {item.matchedCode}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.codeType === 'GOODS' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {item.codeType}
                          </span>
                        </td>
                        <td className="p-3 text-slate-800 max-w-[200px] truncate" title={item.commodityName}>
                          {item.commodityName}
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-800 font-bold rounded">
                            {item.gstRate}%
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono">{item.uqc}</td>
                        <td className="p-3 text-center">
                          <span className="font-bold text-emerald-700">{item.matchConfidence}%</span>
                        </td>
                        <td className="p-3 text-[11px]">
                          {item.statutoryNotes?.rcmApplicable ? (
                            <span className="text-amber-700 font-bold">RCM Applicable</span>
                          ) : (
                            <span className="text-slate-500">Standard Forward</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SmartHsnSacMatcher;
