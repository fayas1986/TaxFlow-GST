import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, BookOpen, Percent, ShieldCheck, AlertCircle, FileText, 
  Copy, Check, Bookmark, BookmarkCheck, Download, Filter, 
  Sparkles, Scale, RefreshCw, ChevronRight, X, ExternalLink,
  Layers, Tag, Info, ArrowUpRight, CheckCircle2, IndianRupee,
  Building2, Truck, Activity, Cpu, Briefcase, HelpCircle,
  Clock, ArrowRight, ShieldAlert, FileCheck2, Lightbulb, Trash2, History
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { HSN_DIRECTORY, HSN_SECTOR_LIST } from '../data/hsnData';
import { GOVERNMENT_NOTIFICATIONS, GST_EXEMPTIONS_CATALOG } from '../data/gstNotificationsData';
import { HSNCode, GovernmentNotification, GstExemptionItem } from '../types';
import { STATUTORY_SLAB_INFO } from './GstRateCalculatorPage';
import SmartTaxRateClassifier from '../components/SmartTaxRateClassifier';
import SmartHsnSacMatcher from '../components/SmartHsnSacMatcher';

export interface RecentHsnSearchItem {
  id: string;
  query: string;
  timestamp: number;
}


const DEFAULT_RECENT_SEARCHES: RecentHsnSearchItem[] = [
  { id: 'sh-1', query: '8471', timestamp: Date.now() - 1000 * 60 * 15 },
  { id: 'sh-2', query: '9983', timestamp: Date.now() - 1000 * 60 * 45 },
  { id: 'sh-3', query: '3004', timestamp: Date.now() - 1000 * 60 * 120 },
  { id: 'sh-4', query: 'Laptops', timestamp: Date.now() - 1000 * 60 * 360 },
  { id: 'sh-5', query: 'Legal Consultancy', timestamp: Date.now() - 1000 * 60 * 720 },
  { id: 'sh-6', query: 'Solar Modules', timestamp: Date.now() - 1000 * 60 * 1440 },
];

const POPULAR_SEARCH_SUGGESTIONS = [
  '8471 (Computers)', '9983 (IT / Legal)', '3004 (Medicines)', '8703 (Motor Vehicles)', 
  '9965 (Freight Transport)', '6109 (Apparel / T-shirts)', '1006 (Rice & Grains)'
];

export const HsnSacLookupPage: React.FC = () => {
  // Navigation tabs within HSN/SAC Center
  const [activeTab, setActiveTab] = useState<'AI_MATCHER' | 'AI_CLASSIFIER' | 'DIRECTORY' | 'NOTIFICATIONS' | 'EXEMPTIONS' | 'CALCULATOR'>('AI_MATCHER');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'GOODS' | 'SERVICES' | 'EXEMPT' | 'RCM' | 'CESS' | 'SPECIAL' | 'FAVORITES'>('ALL');
  const [selectedSector, setSelectedSector] = useState<string>('All Sectors');
  const [selectedSlab, setSelectedSlab] = useState<number | 'ALL'>('ALL');
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS'>('TABLE');
  const [turnoverBracket, setTurnoverBracket] = useState<'UNDER_5CR' | 'ABOVE_5CR' | 'EXPORTS'>('ABOVE_5CR');

  // Recent Search History state stored in localStorage
  const [searchHistory, setSearchHistory] = useState<RecentHsnSearchItem[]>(() => {
    try {
      const saved = localStorage.getItem('taxflow_hsn_search_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed reading search history from localStorage', e);
    }
    return DEFAULT_RECENT_SEARCHES;
  });

  // Function to save or bump a query in search history
  const saveSearchToHistory = (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed || trimmed.length < 2) return;

    setSearchHistory((prev) => {
      const filtered = prev.filter(
        (item) => item.query.toLowerCase() !== trimmed.toLowerCase()
      );
      const updated: RecentHsnSearchItem[] = [
        {
          id: `sh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          query: trimmed,
          timestamp: Date.now(),
        },
        ...filtered,
      ].slice(0, 10);

      try {
        localStorage.setItem('taxflow_hsn_search_history', JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed saving search history to localStorage', err);
      }
      return updated;
    });
  };

  // Debounced auto-save of active search query to history
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return;
    const timer = setTimeout(() => {
      saveSearchToHistory(searchQuery);
    }, 1200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectRecentSearch = (queryText: string) => {
    // If it has descriptive text like "8471 (Computers)", strip bracketed notes if needed or search clean term
    const cleanQuery = queryText.includes('(') ? queryText.split('(')[0].trim() : queryText.trim();
    setSearchQuery(cleanQuery);
    saveSearchToHistory(cleanQuery);
    if (activeTab !== 'DIRECTORY') {
      setActiveTab('DIRECTORY');
    }
  };

  const handleRemoveHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem('taxflow_hsn_search_history', JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed saving search history', err);
      }
      return updated;
    });
  };

  const handleClearAllHistory = () => {
    setSearchHistory([]);
    try {
      localStorage.removeItem('taxflow_hsn_search_history');
    } catch (err) {
      console.warn('Failed clearing search history', err);
    }
  };

  // Bookmarks / Favorites saved to local storage
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('taxflow_hsn_bookmarks');
      return saved ? JSON.parse(saved) : ['hsn-8471', 'sac-9983', 'hsn-3004-cancer'];
    } catch {
      return ['hsn-8471', 'sac-9983'];
    }
  });

  // Selected HSN for Dossier Modal
  const [selectedDossierItem, setSelectedDossierItem] = useState<HSNCode | null>(null);

  // Selected Notification for Detail Modal
  const [selectedNotif, setSelectedNotif] = useState<GovernmentNotification | null>(null);

  // Notification search
  const [notifSearch, setNotifSearch] = useState<string>('');
  const [notifFilter, setNotifFilter] = useState<'ALL' | 'RATE_CHANGE' | 'EXEMPTION' | 'RCM'>('ALL');

  // Exemption search
  const [exemptionSearch, setExemptionSearch] = useState<string>('');

  // Quick Calculator State for Modal & Tab
  const [calcHsn, setCalcHsn] = useState<HSNCode>(HSN_DIRECTORY[0]);
  const [calcAmount, setCalcAmount] = useState<string>('100000');
  const [calcMode, setCalcMode] = useState<'EXCLUSIVE' | 'INCLUSIVE'>('EXCLUSIVE');
  const [calcSupply, setCalcSupply] = useState<'INTRA' | 'INTER'>('INTRA');
  const [calcUtgst, setCalcUtgst] = useState<boolean>(false);
  const [copiedState, setCopiedState] = useState<boolean>(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const handleCopyCode = (code: string, id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => {
      setCopiedCodeId((current) => (current === id ? null : current));
    }, 1800);
  };

  // Sync bookmarks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('taxflow_hsn_bookmarks', JSON.stringify(bookmarkedIds));
    } catch (e) {
      console.error('Failed saving bookmarks', e);
    }
  }, [bookmarkedIds]);

  const toggleBookmark = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setBookmarkedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Filtered HSN / SAC Directory
  const filteredDirectory = useMemo(() => {
    return HSN_DIRECTORY.filter(item => {
      const itemId = item.id || item.code;

      // Category Facet Filter
      if (selectedCategory === 'GOODS' && item.category !== 'GOODS') return false;
      if (selectedCategory === 'SERVICES' && item.category !== 'SERVICES') return false;
      if (selectedCategory === 'EXEMPT' && item.taxRate !== 0 && !item.isExempt) return false;
      if (selectedCategory === 'RCM' && !item.rcmApplicable) return false;
      if (selectedCategory === 'CESS' && (!item.cessRate || item.cessRate <= 0)) return false;
      if (selectedCategory === 'SPECIAL' && ![0.25, 3, 6].includes(item.taxRate)) return false;
      if (selectedCategory === 'FAVORITES' && !bookmarkedIds.includes(itemId)) return false;

      // Sector Filter
      if (selectedSector !== 'All Sectors' && item.sector !== selectedSector) return false;

      // Slab Filter
      if (selectedSlab !== 'ALL' && item.taxRate !== selectedSlab) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = item.code.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchChapter = item.chapter ? item.chapter.toLowerCase().includes(q) : false;
        const matchConditions = item.conditions ? item.conditions.toLowerCase().includes(q) : false;
        const matchSector = item.sector ? item.sector.toLowerCase().includes(q) : false;
        const matchNotification = item.notificationNo ? item.notificationNo.toLowerCase().includes(q) : false;
        const matchKeywords = item.keywords ? item.keywords.some(k => k.toLowerCase().includes(q)) : false;

        return matchCode || matchDesc || matchChapter || matchConditions || matchSector || matchNotification || matchKeywords;
      }

      return true;
    });
  }, [selectedCategory, selectedSector, selectedSlab, searchQuery, bookmarkedIds]);

  // Filtered Notifications
  const filteredNotifications = useMemo(() => {
    return GOVERNMENT_NOTIFICATIONS.filter(notif => {
      if (notifFilter !== 'ALL' && notif.category !== notifFilter) return false;
      if (notifSearch.trim()) {
        const q = notifSearch.toLowerCase();
        return (
          notif.notificationNo.toLowerCase().includes(q) ||
          notif.title.toLowerCase().includes(q) ||
          notif.summary.toLowerCase().includes(q) ||
          notif.gstCouncilMeeting?.toLowerCase().includes(q) ||
          notif.impactedHsnCodes.some(c => c.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [notifFilter, notifSearch]);

  // Filtered Exemptions
  const filteredExemptions = useMemo(() => {
    if (!exemptionSearch.trim()) return GST_EXEMPTIONS_CATALOG;
    const q = exemptionSearch.toLowerCase();
    return GST_EXEMPTIONS_CATALOG.filter(ex => 
      ex.heading.toLowerCase().includes(q) ||
      ex.hsnSacCode.toLowerCase().includes(q) ||
      ex.scopeOfExemption.toLowerCase().includes(q) ||
      ex.statutoryConditions.toLowerCase().includes(q) ||
      ex.notificationReference.toLowerCase().includes(q)
    );
  }, [exemptionSearch]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = HSN_DIRECTORY.length;
    const goodsCount = HSN_DIRECTORY.filter(i => i.category === 'GOODS').length;
    const servicesCount = HSN_DIRECTORY.filter(i => i.category === 'SERVICES').length;
    const exemptCount = HSN_DIRECTORY.filter(i => i.taxRate === 0 || i.isExempt).length;
    const rcmCount = HSN_DIRECTORY.filter(i => i.rcmApplicable).length;
    return { total, goodsCount, servicesCount, exemptCount, rcmCount };
  }, []);

  // Tax Calculation logic for selected / quick item
  const calcResult = useMemo(() => {
    const rawAmount = parseFloat(calcAmount) || 0;
    const rate = calcHsn.taxRate;
    const cessRate = calcHsn.cessRate || 0;
    const totalRate = rate + cessRate;

    if (calcMode === 'EXCLUSIVE') {
      const taxable = rawAmount;
      const taxVal = (taxable * rate) / 100;
      const cessVal = (taxable * cessRate) / 100;
      const grossVal = taxable + taxVal + cessVal;
      const cgst = calcSupply === 'INTRA' ? taxVal / 2 : 0;
      const sgst = calcSupply === 'INTRA' ? taxVal / 2 : 0;
      const igst = calcSupply === 'INTER' ? taxVal : 0;

      return { taxable, taxVal, cessVal, grossVal, cgst, sgst, igst, rate, cessRate };
    } else {
      const grossVal = rawAmount;
      const taxable = totalRate > 0 ? (grossVal / (1 + totalRate / 100)) : grossVal;
      const taxVal = (taxable * rate) / 100;
      const cessVal = (taxable * cessRate) / 100;
      const cgst = calcSupply === 'INTRA' ? taxVal / 2 : 0;
      const sgst = calcSupply === 'INTRA' ? taxVal / 2 : 0;
      const igst = calcSupply === 'INTER' ? taxVal : 0;

      return { taxable, taxVal, cessVal, grossVal, cgst, sgst, igst, rate, cessRate };
    }
  }, [calcHsn, calcAmount, calcMode, calcSupply]);

  // Export to Excel handler
  const exportToExcel = () => {
    const dataToExport = filteredDirectory.map(item => ({
      'HSN / SAC Code': item.code,
      'Classification Type': item.category,
      'Sector / Industry': item.sector || 'General',
      'Description': item.description,
      'GST Slab Rate (%)': item.taxRate,
      'Cess Rate (%)': item.cessRate || 0,
      'RCM Applicable': item.rcmApplicable ? 'Yes' : 'No',
      'ITC Eligibility': item.itcEligibility || 'ELIGIBLE',
      'Statutory Schedule': item.schedule || 'General',
      'Notification Ref': item.notificationNo || 'N/A',
      'Conditions / Notes': item.conditions || item.exemptionCondition || 'Standard'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'HSN_SAC_Directory');
    XLSX.writeFile(workbook, `GST_HSN_SAC_Directory_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const copyDossierQuote = (item: HSNCode) => {
    const text = `--- TaxFlow Statutory HSN/SAC Tariff Quote ---
Code: ${item.code} (${item.category})
Description: ${item.description}
Sector: ${item.sector || 'General'}
GST Rate: ${item.taxRate}% ${item.schedule ? `[${item.schedule}]` : ''}
${item.cessRate ? `Compensation Cess: ${item.cessRate}%\n` : ''}ITC Status: ${item.itcEligibility || 'ELIGIBLE'}
${item.rcmApplicable ? 'Reverse Charge Mechanism (RCM): YES (Recipient liable under Sec 9(3))\n' : ''}${item.notificationNo ? `Notification: ${item.notificationNo}\n` : ''}${item.conditions ? `Conditions: ${item.conditions}\n` : ''}Generated via TaxFlow GST Statutory Engine`;

    navigator.clipboard.writeText(text);
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* 1. Header Banner & Quick Navigation Tabs */}
      <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-50/70 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute right-40 bottom-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
                <BookOpen size={22} />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  HSN & SAC Statutory Master
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider border border-emerald-200">
                  54th GST Council Updated
                </span>
              </div>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
              Explore official Indian GST tariff classifications, statutory rate slabs, latest CBIC Gazette notifications, reverse charge liabilities, and Section 11 exemptions.
            </p>
          </div>

          {/* Action Tools */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={exportToExcel}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/80 transition-all flex items-center gap-2 shadow-xs cursor-pointer"
              title="Download Filtered Results to Excel"
            >
              <Download size={15} className="text-emerald-600" />
              <span>Export to Excel</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('CALCULATOR');
              }}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Percent size={15} />
              <span>Tax Calculator</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 pt-6 border-t border-slate-100 mt-6 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('AI_MATCHER')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'AI_MATCHER'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xs'
                : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            <Sparkles size={14} className={activeTab === 'AI_MATCHER' ? 'text-white' : 'text-indigo-600'} />
            <span>AI Code Matcher (Gemini)</span>
          </button>
          <button
            onClick={() => setActiveTab('AI_CLASSIFIER')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'AI_CLASSIFIER'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Percent size={14} className={activeTab === 'AI_CLASSIFIER' ? 'text-white' : 'text-indigo-600'} />
            <span>AI Rate Classifier</span>
          </button>
          <button
            onClick={() => setActiveTab('DIRECTORY')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'DIRECTORY'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Search size={14} />
            <span>Tariff Directory ({filteredDirectory.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('NOTIFICATIONS')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'NOTIFICATIONS'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sparkles size={14} className={activeTab === 'NOTIFICATIONS' ? 'text-white' : 'text-amber-500'} />
            <span>Council Notifications & Circulars ({GOVERNMENT_NOTIFICATIONS.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('EXEMPTIONS')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'EXEMPTIONS'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck size={14} className={activeTab === 'EXEMPTIONS' ? 'text-white' : 'text-emerald-600'} />
            <span>Exemptions & Concessions ({GST_EXEMPTIONS_CATALOG.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('CALCULATOR')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'CALCULATOR'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <IndianRupee size={14} />
            <span>Interactive Tax Engine</span>
          </button>
        </div>
      </div>

      {activeTab === 'AI_MATCHER' && (
        <div className="space-y-6">
          <SmartHsnSacMatcher initialQuery={searchQuery} />
        </div>
      )}

      {activeTab === 'AI_CLASSIFIER' && (
        <div className="space-y-6">
          <SmartTaxRateClassifier />
        </div>
      )}

      {activeTab !== 'AI_MATCHER' && activeTab !== 'AI_CLASSIFIER' && (
      <>
      {/* 2. Top Summary KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
            Total Classified Codes
          </span>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {metrics.total}
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Goods (HSN) & Services (SAC)
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600 block">
            Goods (HSN)
          </span>
          <div className="text-2xl font-black text-sky-900 font-mono">
            {metrics.goodsCount}
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Chapters 01 to 98
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 block">
            Services (SAC)
          </span>
          <div className="text-2xl font-black text-purple-900 font-mono">
            {metrics.servicesCount}
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Section 99 Headings
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 block">
            0% Nil / Exempt Items
          </span>
          <div className="text-2xl font-black text-emerald-900 font-mono">
            {metrics.exemptCount}
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Section 11 Reliefs
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 block">
            RCM Subjected (Sec 9(3))
          </span>
          <div className="text-2xl font-black text-amber-900 font-mono">
            {metrics.rcmCount}
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Recipient Taxable
          </span>
        </div>
      </div>

      {/* 3. TAB 1: MAIN HSN / SAC DIRECTORY & SMART SEARCH */}
      {activeTab === 'DIRECTORY' && (
        <div className="space-y-6">
          {/* Search, Filter & Sector Controls */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
            {/* Primary Search Bar */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveSearchToHistory(searchQuery);
                    }
                  }}
                  placeholder="Search by HSN/SAC code (e.g. 8471, 9983, 3004), product, brand, service or notification..."
                  className="w-full h-12 pl-11 pr-10 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Sector / Industry Filter */}
              <div className="w-full md:w-64">
                <select
                  value={selectedSector}
                  onChange={(e) => setSelectedSector(e.target.value)}
                  className="w-full h-12 px-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
                >
                  {HSN_SECTOR_LIST.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
                <button
                  onClick={() => setViewMode('TABLE')}
                  className={`px-3 py-2 rounded-xl transition-all ${
                    viewMode === 'TABLE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Table View
                </button>
                <button
                  onClick={() => setViewMode('CARDS')}
                  className={`px-3 py-2 rounded-xl transition-all ${
                    viewMode === 'CARDS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Cards View
                </button>
              </div>
            </div>

            {/* Recent Search History Section */}
            <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-5 h-5 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
                    <Clock size={12} />
                  </div>
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>Recent Searches</span>
                    {searchHistory.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-extrabold font-mono">
                        {searchHistory.length}
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    • Click any query to quickly re-run lookup
                  </span>
                </div>

                {searchHistory.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleClearAllHistory}
                    className="text-[11px] font-bold text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Clear all recent search queries"
                  >
                    <Trash2 size={12} />
                    <span>Clear History</span>
                  </button>
                ) : (
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Suggested Lookups
                  </span>
                )}
              </div>

              {/* Pills / Chips */}
              <div className="flex flex-wrap items-center gap-2">
                {searchHistory.length > 0 ? (
                  searchHistory.map((item) => {
                    const isActive = searchQuery.trim().toLowerCase() === item.query.trim().toLowerCase();
                    const isCode = /^\d{2,8}$/.test(item.query.trim());
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectRecentSearch(item.query)}
                        className={`group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-xl text-xs font-semibold cursor-pointer transition-all border ${
                          isActive
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-bold'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                        title={`Re-run search for "${item.query}"`}
                      >
                        {isCode ? (
                          <span className={`text-[9px] font-black uppercase px-1 py-0.5 rounded font-mono ${
                            isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-600'
                          }`}>
                            CODE
                          </span>
                        ) : (
                          <Search size={11} className={isActive ? 'text-blue-200' : 'text-slate-400'} />
                        )}
                        <span className="max-w-[160px] truncate">{item.query}</span>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveHistoryItem(item.id, e)}
                          className={`p-0.5 rounded-md transition-colors ml-0.5 ${
                            isActive ? 'text-white/80 hover:text-white hover:bg-blue-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/80'
                          }`}
                          title="Remove from history"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {POPULAR_SEARCH_SUGGESTIONS.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => handleSelectRecentSearch(sug)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200 text-xs font-medium transition-colors"
                      >
                        <Search size={11} className="text-slate-400" />
                        <span>{sug}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* AI Semantic Match Quick Action Banner */}
            {searchQuery && searchQuery.trim().length >= 2 && (
              <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 border border-indigo-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Sparkles size={18} className="animate-pulse" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-indigo-950 flex items-center gap-2">
                      <span>Need exact statutory classification for "{searchQuery}"?</span>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-200/70 text-indigo-800 text-[10px] font-extrabold uppercase">
                        Gemini AI
                      </span>
                    </div>
                    <p className="text-[11px] text-indigo-800/80 mt-0.5">
                      Intelligently match commercial trade keywords to 4/6/8-digit tariff items with General Interpretation Rules (GRI).
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('AI_MATCHER')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Sparkles size={13} />
                  <span>Match with Gemini AI</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            )}

            {/* Faceted Filters Pill Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              {/* Classification Facet */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold py-1">
                {[
                  { id: 'ALL', label: 'All Classifications' },
                  { id: 'GOODS', label: 'Goods (HSN)' },
                  { id: 'SERVICES', label: 'Services (SAC)' },
                  { id: 'EXEMPT', label: '0% Nil / Exempt' },
                  { id: 'RCM', label: 'RCM Liable' },
                  { id: 'CESS', label: 'Compensation Cess' },
                  { id: 'SPECIAL', label: 'Special (0.25%, 3%, 6%)' },
                  { id: 'FAVORITES', label: `★ Bookmarked (${bookmarkedIds.length})` },
                ].map((facet) => (
                  <button
                    key={facet.id}
                    onClick={() => setSelectedCategory(facet.id as any)}
                    className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                      selectedCategory === facet.id
                        ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                        : 'bg-slate-100 hover:bg-slate-200/70 text-slate-600'
                    }`}
                  >
                    {facet.label}
                  </button>
                ))}
              </div>

              {/* Tax Slab Filter */}
              <div className="flex items-center gap-1 text-xs font-bold">
                <span className="text-[10px] uppercase text-slate-400 font-extrabold mr-1">Slab:</span>
                {(['ALL', 0, 0.25, 3, 5, 6, 12, 18, 28] as const).map((slab) => (
                  <button
                    key={slab.toString()}
                    onClick={() => setSelectedSlab(slab)}
                    className={`px-2 py-1 rounded-lg text-xs transition-all ${
                      selectedSlab === slab
                        ? 'bg-slate-900 text-white font-black'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                    }`}
                  >
                    {slab === 'ALL' ? 'All' : `${slab}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Turnover Compliance Rule Invoicing Banner */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Lightbulb size={16} className="text-amber-500 shrink-0" />
                <span className="text-slate-700">
                  <strong>Rule 46 Invoicing Mandate:</strong> Businesses with Aggregate Turnover &gt; ₹5 Cr require <strong>6 digits</strong> on tax invoices; ≤ ₹5 Cr requires <strong>4 digits</strong>.
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-bold">
                <button
                  onClick={() => setTurnoverBracket('ABOVE_5CR')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    turnoverBracket === 'ABOVE_5CR' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  &gt; ₹5 Cr (6 Digits)
                </button>
                <button
                  onClick={() => setTurnoverBracket('UNDER_5CR')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    turnoverBracket === 'UNDER_5CR' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  ≤ ₹5 Cr (4 Digits)
                </button>
              </div>
            </div>
          </div>

          {/* Results Table or Cards */}
          {viewMode === 'TABLE' ? (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-12 text-center">★</th>
                      <th className="py-3.5 px-4">HSN/SAC Code</th>
                      <th className="py-3.5 px-4">Sector & Description</th>
                      <th className="py-3.5 px-3 text-center">GST Rate</th>
                      <th className="py-3.5 px-3 text-center">RCM & Cess</th>
                      <th className="py-3.5 px-3 text-center">ITC Status</th>
                      <th className="py-3.5 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredDirectory.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-slate-400">
                          <div className="flex flex-col items-center gap-2">
                            <HelpCircle size={32} className="text-slate-300" />
                            <p className="font-bold text-slate-700 text-sm">No HSN or SAC codes match your filters</p>
                            <p className="text-xs text-slate-400">Try searching for generic terms like "Laptop", "Advocate", "Cancer", or "Freight"</p>
                            <button
                              onClick={() => {
                                setSearchQuery('');
                                setSelectedCategory('ALL');
                                setSelectedSector('All Sectors');
                                setSelectedSlab('ALL');
                              }}
                              className="mt-2 px-3.5 py-1.5 bg-blue-50 text-blue-600 font-bold rounded-xl text-xs hover:bg-blue-100"
                            >
                              Reset All Filters
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredDirectory.map((item) => {
                        const itemId = item.id || item.code;
                        const isBookmarked = bookmarkedIds.includes(itemId);

                        return (
                          <tr 
                            key={itemId}
                            onClick={() => setSelectedDossierItem(item)}
                            className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                          >
                            {/* Bookmark Toggle */}
                            <td className="py-3.5 px-4 text-center" onClick={(e) => toggleBookmark(itemId, e)}>
                              <button
                                className={`p-1 rounded-lg transition-colors ${
                                  isBookmarked ? 'text-amber-500' : 'text-slate-300 group-hover:text-slate-400'
                                }`}
                                title={isBookmarked ? 'Remove Bookmark' : 'Add to Bookmarks'}
                              >
                                {isBookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                              </button>
                            </td>

                            {/* Code & Category */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono font-extrabold text-sm px-2.5 py-1 bg-slate-100 rounded-xl text-slate-900 border border-slate-200/80">
                                    {item.code}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => handleCopyCode(item.code, itemId, e)}
                                    className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                      copiedCodeId === itemId
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-2xs'
                                        : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-800'
                                    }`}
                                    title={`Copy code ${item.code} to clipboard`}
                                  >
                                    {copiedCodeId === itemId ? (
                                      <>
                                        <Check size={12} className="text-emerald-600" />
                                        <span className="text-[10px] text-emerald-700 font-extrabold">Copied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy size={12} />
                                        <span className="text-[10px]">Copy</span>
                                      </>
                                    )}
                                  </button>
                                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                                    item.category === 'GOODS' ? 'bg-sky-100 text-sky-800' : 'bg-purple-100 text-purple-800'
                                  }`}>
                                    {item.category}
                                  </span>
                                </div>
                                {item.schedule && (
                                  <span className="text-[10px] text-slate-400 block font-medium">
                                    {item.schedule}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Sector & Description */}
                            <td className="py-3.5 px-4 max-w-lg">
                              <div className="space-y-1">
                                {item.sector && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                                    {item.sector}
                                  </span>
                                )}
                                <p className="text-slate-900 font-semibold leading-snug">
                                  {item.description}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 pt-0.5">
                                  {item.chapter && (
                                    <span className="text-slate-500">
                                      Chapter: <strong>{item.chapter}</strong>
                                    </span>
                                  )}
                                  {item.notificationNo && (
                                    <span className="text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                                      {item.notificationNo}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Tax Rate */}
                            <td className="py-3.5 px-3 text-center">
                              <span className={`px-2.5 py-1 rounded-xl text-xs font-black font-mono inline-block ${
                                item.taxRate === 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.taxRate <= 5
                                  ? 'bg-teal-100 text-teal-800'
                                  : item.taxRate === 12
                                  ? 'bg-blue-100 text-blue-800'
                                  : item.taxRate === 18
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {item.taxRate}%
                              </span>
                            </td>

                            {/* RCM & Cess */}
                            <td className="py-3.5 px-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                {item.rcmApplicable ? (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-extrabold text-[10px] rounded-md border border-amber-200">
                                    RCM (Sec 9(3))
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400">Forward</span>
                                )}
                                {item.cessRate && item.cessRate > 0 ? (
                                  <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 text-[9px] font-black rounded">
                                    +{item.cessRate}% Cess
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            {/* ITC Eligibility */}
                            <td className="py-3.5 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                item.itcEligibility === 'ELIGIBLE'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : item.itcEligibility === 'INELIGIBLE'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {item.itcEligibility || 'ELIGIBLE'}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => handleCopyCode(item.code, itemId, e)}
                                  className={`px-2.5 py-1.5 text-xs font-bold rounded-xl transition-all border flex items-center gap-1 cursor-pointer ${
                                    copiedCodeId === itemId
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-2xs'
                                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200/60 text-slate-700'
                                  }`}
                                  title={`Copy code ${item.code} for invoice`}
                                >
                                  {copiedCodeId === itemId ? (
                                    <Check size={12} className="text-emerald-600" />
                                  ) : (
                                    <Copy size={12} />
                                  )}
                                  <span>{copiedCodeId === itemId ? 'Copied' : 'Copy'}</span>
                                </button>
                                <button
                                  onClick={() => setSelectedDossierItem(item)}
                                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                                  title="View Statutory Dossier"
                                >
                                  Dossier
                                </button>
                                <button
                                  onClick={() => {
                                    setCalcHsn(item);
                                    setActiveTab('CALCULATOR');
                                  }}
                                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                                  title="Calculate Tax"
                                >
                                  Calculate
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Cards View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDirectory.map((item) => {
                const itemId = item.id || item.code;
                const isBookmarked = bookmarkedIds.includes(itemId);

                return (
                  <div
                    key={itemId}
                    onClick={() => setSelectedDossierItem(item)}
                    className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-extrabold text-base px-2.5 py-1 bg-slate-100 rounded-xl text-slate-900 border border-slate-200">
                            {item.code}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyCode(item.code, itemId, e)}
                            className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              copiedCodeId === itemId
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-2xs'
                                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-800'
                            }`}
                            title={`Copy code ${item.code} to clipboard`}
                          >
                            {copiedCodeId === itemId ? (
                              <>
                                <Check size={12} className="text-emerald-600" />
                                <span className="text-[10px] text-emerald-700 font-extrabold">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span className="text-[10px]">Copy</span>
                              </>
                            )}
                          </button>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                            item.category === 'GOODS' ? 'bg-sky-100 text-sky-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {item.category}
                          </span>
                        </div>
                        <button
                          onClick={(e) => toggleBookmark(itemId, e)}
                          className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                            isBookmarked ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-slate-500'
                          }`}
                        >
                          {isBookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                        </button>
                      </div>

                      {item.sector && (
                        <span className="inline-block text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg">
                          {item.sector}
                        </span>
                      )}

                      <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">
                        {item.description}
                      </h3>

                      {item.chapter && (
                        <p className="text-[11px] text-slate-400">
                          {item.chapter}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2.5 py-1 rounded-xl text-xs font-black font-mono ${
                            item.taxRate === 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.taxRate === 18
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {item.taxRate}% GST
                          </span>
                          {item.cessRate && item.cessRate > 0 ? (
                            <span className="text-[9px] font-black text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                              +{item.cessRate}% Cess
                            </span>
                          ) : null}
                        </div>

                        {item.rcmApplicable && (
                          <span className="text-[10px] font-extrabold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                            RCM
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDossierItem(item);
                          }}
                          className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                        >
                          View Dossier
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCalcHsn(item);
                            setActiveTab('CALCULATOR');
                          }}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                        >
                          Calculate
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. TAB 2: LATEST GOVERNMENT NOTIFICATIONS & COUNCIL DECISIONS */}
      {activeTab === 'NOTIFICATIONS' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <Sparkles size={20} className="text-amber-500" />
                  CBIC Gazette Notifications & Council Decisions
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official statutory amendments impacting rate slabs, RCM mandates, and exemptions across Indian GST jurisprudence.
                </p>
              </div>

              {/* Search */}
              <div className="relative w-full md:w-80">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={notifSearch}
                  onChange={(e) => setNotifSearch(e.target.value)}
                  placeholder="Search notification no, title, or HSN code..."
                  className="w-full h-11 pl-10 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold pt-2 border-t border-slate-100">
              {(['ALL', 'RATE_CHANGE', 'EXEMPTION', 'RCM'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setNotifFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    notifFilter === cat
                      ? 'bg-slate-900 text-white shadow-xs font-black'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'ALL' ? 'All Notifications' : cat === 'RATE_CHANGE' ? 'Rate Rationalizations' : cat === 'EXEMPTION' ? 'Exemption Notifications' : 'RCM Mandates'}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => setSelectedNotif(notif)}
                className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-black text-xs px-2.5 py-1 rounded-xl bg-blue-50 text-blue-800 border border-blue-200">
                      {notif.notificationNo}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                      notif.category === 'RATE_CHANGE' 
                        ? 'bg-amber-100 text-amber-800' 
                        : notif.category === 'EXEMPTION'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {notif.category}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-slate-900 text-base leading-snug">
                    {notif.title}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {notif.summary}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-1 font-medium">
                    <Clock size={13} className="text-slate-400" />
                    <span>Effective: <strong>{notif.effectiveDate}</strong></span>
                  </div>
                  <span className="font-bold text-blue-600 flex items-center gap-1 group-hover:underline">
                    Read Legal Scope <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. TAB 3: STATUTORY EXEMPTIONS CATALOG */}
      {activeTab === 'EXEMPTIONS' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <ShieldCheck size={20} className="text-emerald-600" />
                  Section 11 Statutory Exemptions & Relief Directory
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Comprehensive listing of unconditional and conditional zero-rate exemptions under Notifications 12/2017 & 02/2017.
                </p>
              </div>

              {/* Search */}
              <div className="relative w-full md:w-80">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={exemptionSearch}
                  onChange={(e) => setExemptionSearch(e.target.value)}
                  placeholder="Search exemptions by keyword or clause..."
                  className="w-full h-11 pl-10 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredExemptions.map((ex) => (
              <div key={ex.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-xs px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200">
                    HSN/SAC: {ex.hsnSacCode}
                  </span>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {ex.category}
                  </span>
                </div>

                <h3 className="font-extrabold text-slate-900 text-base">
                  {ex.heading}
                </h3>

                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {ex.scopeOfExemption}
                </p>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-start gap-1.5">
                    <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
                    <span><strong>Statutory Condition:</strong> {ex.statutoryConditions}</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-rose-700">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span><strong>ITC Restriction:</strong> {ex.itcImpact}</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex items-center justify-between font-mono">
                  <span>{ex.notificationReference}</span>
                  <span className="text-slate-400 font-semibold">{ex.applicableLawClause}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. TAB 4: INTERACTIVE TAX ENGINE / CALCULATOR */}
      {activeTab === 'CALCULATOR' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Input parameters */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Percent size={18} className="text-blue-600" />
                <h2 className="text-base font-extrabold text-slate-900">
                  GST Calculation Simulator
                </h2>
              </div>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-xl">
                {calcHsn.category}
              </span>
            </div>

            {/* Select HSN */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select HSN / SAC Code
              </label>
              <select
                value={calcHsn.id || calcHsn.code}
                onChange={(e) => {
                  const found = HSN_DIRECTORY.find(i => (i.id || i.code) === e.target.value);
                  if (found) setCalcHsn(found);
                }}
                className="w-full h-12 px-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
              >
                {HSN_DIRECTORY.map((item) => (
                  <option key={item.id || item.code} value={item.id || item.code}>
                    [{item.code}] {item.description.slice(0, 65)}... — {item.taxRate}%
                  </option>
                ))}
              </select>
            </div>

            {/* Amount & Mode */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Transaction Amount (₹)
                </label>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
                  <button
                    onClick={() => setCalcMode('EXCLUSIVE')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      calcMode === 'EXCLUSIVE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Base + GST (Exclusive)
                  </button>
                  <button
                    onClick={() => setCalcMode('INCLUSIVE')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      calcMode === 'INCLUSIVE' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    MRP / Total (Inclusive)
                  </button>
                </div>
              </div>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  value={calcAmount}
                  onChange={(e) => setCalcAmount(e.target.value)}
                  placeholder="e.g. 100000"
                  className="w-full h-12 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-base font-extrabold text-slate-900 outline-none focus:border-blue-500 focus:bg-white font-mono"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {['10000', '50000', '100000', '500000', '1000000'].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setCalcAmount(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                      calcAmount === preset ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    ₹{(parseInt(preset) / 1000)}k
                  </button>
                ))}
              </div>
            </div>

            {/* Jurisdiction Scope */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Supply Jurisdiction
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCalcSupply('INTRA')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    calcSupply === 'INTRA' ? 'bg-blue-50 border-blue-500 text-blue-900' : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <span className="text-xs font-extrabold block">Intra-State Supply</span>
                  <span className="text-[10px] text-slate-500">CGST (50%) + SGST (50%)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCalcSupply('INTER')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    calcSupply === 'INTER' ? 'bg-blue-50 border-blue-500 text-blue-900' : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <span className="text-xs font-extrabold block">Inter-State Supply</span>
                  <span className="text-[10px] text-slate-500">IGST (100% Integrated)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Output Breakdown */}
          <div className="lg:col-span-5 bg-white text-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <span className="text-xs font-extrabold uppercase tracking-widest text-slate-700">
                Tax Breakdown Output
              </span>
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase border border-blue-200">
                {calcMode}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Invoice Gross Value
              </span>
              <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono tracking-tight flex items-baseline gap-1">
                <span className="text-xl font-normal text-slate-500">₹</span>
                {calcResult.grossVal.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Taxable Net Value</span>
                <span className="font-bold text-slate-900">
                  ₹{calcResult.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {calcSupply === 'INTRA' ? (
                <>
                  <div className="flex items-center justify-between border-t border-slate-200/80 pt-2.5 text-emerald-700 font-semibold">
                    <span className="text-slate-600 font-normal">CGST ({(calcResult.rate / 2)}%)</span>
                    <span>+₹{calcResult.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200/80 pt-2.5 text-emerald-700 font-semibold">
                    <span className="text-slate-600 font-normal">SGST ({(calcResult.rate / 2)}%)</span>
                    <span>+₹{calcResult.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between border-t border-slate-200/80 pt-2.5 text-emerald-700 font-semibold">
                  <span className="text-slate-600 font-normal">IGST ({calcResult.rate}%)</span>
                  <span>+₹{calcResult.igst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}

              {calcResult.cessVal > 0 && (
                <div className="flex items-center justify-between border-t border-slate-200/80 pt-2.5 text-amber-700 font-semibold">
                  <span className="text-slate-600 font-normal">Compensation Cess ({calcResult.cessRate}%)</span>
                  <span>+₹{calcResult.cessVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => copyDossierQuote(calcHsn)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {copiedState ? <Check size={16} className="text-white" /> : <Copy size={16} />}
              <span>{copiedState ? 'Copied Calculation!' : 'Copy Statutory Quote'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 7. STATUTORY TARIFF DOSSIER MODAL */}
      {selectedDossierItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Close button */}
            <button
              onClick={() => setSelectedDossierItem(null)}
              className="absolute right-5 top-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="space-y-2 pr-8">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-black text-lg px-3 py-1 bg-slate-900 text-white rounded-xl">
                  {selectedDossierItem.code}
                </span>
                <button
                  type="button"
                  onClick={(e) => handleCopyCode(selectedDossierItem.code, 'dossier-code', e)}
                  className={`px-2.5 py-1 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    copiedCodeId === 'dossier-code'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  }`}
                  title="Copy HSN/SAC code to clipboard"
                >
                  {copiedCodeId === 'dossier-code' ? (
                    <>
                      <Check size={13} className="text-emerald-600" />
                      <span className="text-emerald-700 font-extrabold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
                <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-lg ${
                  selectedDossierItem.category === 'GOODS' ? 'bg-sky-100 text-sky-800' : 'bg-purple-100 text-purple-800'
                }`}>
                  {selectedDossierItem.category}
                </span>
                {selectedDossierItem.sector && (
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                    {selectedDossierItem.sector}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 leading-tight">
                {selectedDossierItem.description}
              </h2>
            </div>

            {/* Rate & Slabs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">GST Slab Rate</span>
                <span className="text-xl font-black text-slate-900 font-mono">{selectedDossierItem.taxRate}%</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Intra (CGST + SGST)</span>
                <span className="text-sm font-black text-slate-800 font-mono">{(selectedDossierItem.taxRate / 2)}% + {(selectedDossierItem.taxRate / 2)}%</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Inter-State (IGST)</span>
                <span className="text-sm font-black text-slate-800 font-mono">{selectedDossierItem.taxRate}%</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Cess Rate</span>
                <span className="text-sm font-black text-amber-700 font-mono">{selectedDossierItem.cessRate ? `${selectedDossierItem.cessRate}%` : '0%'}</span>
              </div>
            </div>

            {/* Legal & Compliance Provisions */}
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 space-y-1">
                <span className="font-extrabold text-blue-900 flex items-center gap-1.5">
                  <BookOpen size={14} />
                  Statutory Schedule & Notification
                </span>
                <p className="text-blue-800 font-medium">
                  {selectedDossierItem.schedule || 'Statutory Master'} • {selectedDossierItem.notificationNo || 'Base CGST Notification'}
                </p>
              </div>

              {selectedDossierItem.conditions && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Info size={14} className="text-blue-600" />
                    Classification Scope & Conditions
                  </span>
                  <p className="text-slate-600">
                    {selectedDossierItem.conditions}
                  </p>
                </div>
              )}

              {selectedDossierItem.rcmApplicable && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-1 text-amber-900">
                  <span className="font-extrabold flex items-center gap-1.5">
                    <AlertCircle size={14} className="text-amber-700" />
                    Reverse Charge Liability (Section 9(3))
                  </span>
                  <p className="text-xs">
                    Tax liability must be discharged directly by the registered recipient in cash via Electronic Cash Ledger.
                  </p>
                </div>
              )}

              {/* Rate History if available */}
              {selectedDossierItem.rateHistory && selectedDossierItem.rateHistory.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="font-extrabold text-slate-800 text-xs block">
                    Statutory Rate Amendment Timeline
                  </span>
                  <div className="space-y-1.5">
                    {selectedDossierItem.rateHistory.map((hist, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/60 text-[11px]">
                        <span className="font-semibold text-slate-700">{hist.description}</span>
                        <span className="font-mono font-black text-blue-700">{hist.effectiveDate}: {hist.newRate}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center gap-3 border-t border-slate-100">
              <button
                onClick={() => copyDossierQuote(selectedDossierItem)}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {copiedState ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                <span>{copiedState ? 'Copied Quote!' : 'Copy Statutory Quote'}</span>
              </button>
              <button
                onClick={() => {
                  setCalcHsn(selectedDossierItem);
                  setSelectedDossierItem(null);
                  setActiveTab('CALCULATOR');
                }}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-md"
              >
                Open in Calculator
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. NOTIFICATION DETAIL MODAL */}
      {selectedNotif && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-5 relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedNotif(null)}
              className="absolute right-5 top-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="space-y-1 pr-8">
              <span className="font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800">
                {selectedNotif.notificationNo}
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 pt-1">
                {selectedNotif.title}
              </h2>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>GST Council Meeting: <strong>{selectedNotif.gstCouncilMeeting || 'Council Notification'}</strong></span>
                <span>Effective Date: <strong>{selectedNotif.effectiveDate}</strong></span>
              </div>
              {selectedNotif.relevantSection && (
                <div className="text-slate-500">
                  Enabling Provision: <strong>{selectedNotif.relevantSection}</strong>
                </div>
              )}
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <h4 className="font-extrabold text-slate-900 text-sm">Detailed Statutory Scope</h4>
              <p className="leading-relaxed">{selectedNotif.detailedNotes}</p>

              <div className="pt-2">
                <span className="font-bold text-slate-800 block mb-1.5">Impacted HSN / SAC Classifications:</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedNotif.impactedHsnCodes.map((code) => (
                    <button
                      key={code}
                      onClick={() => {
                        handleSelectRecentSearch(code);
                        setSelectedNotif(null);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white font-mono font-bold text-xs text-slate-800 transition-colors cursor-pointer"
                    >
                      Code {code} →
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedNotif(null)}
                className="px-5 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800"
              >
                Close Notification
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default HsnSacLookupPage;
