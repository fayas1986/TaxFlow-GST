import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Calculator, Search, Percent, ArrowRight, CheckCircle2, Copy, 
  Filter, ShieldCheck, AlertCircle, IndianRupee, Layers, 
  Sparkles, RefreshCw, FileText, Check, BookOpen, Info,
  ArrowDownRight, Tag, HelpCircle, ArrowUpRight, Scale, Globe, Zap
} from 'lucide-react';
import { HSN_DIRECTORY } from '../data/hsnData';
import { HSNCode } from '../types';
import { STATUTORY_SCHEDULES } from '../services/gstEngine/taxCalculator';
import SmartTaxRateClassifier from '../components/SmartTaxRateClassifier';
import { GlobalTaxRatesLookup } from '../components/GlobalTaxRatesLookup';

// Official GST Portal & CBIC Statutory Slabs Metadata
export const STATUTORY_SLAB_INFO: Record<number, { 
  name: string; 
  badge: string; 
  schedule: string; 
  isStandard?: boolean; 
  isCore?: boolean;
  desc: string;
  cgst: number;
  sgst: number;
}> = {
  0: { 
    name: '0% Nil / Exempt', 
    badge: 'Nil / Exempt', 
    schedule: 'Nil-Rated', 
    desc: 'Essential unbranded food, fresh farm produce, healthcare, education, exports under LUT',
    cgst: 0, 
    sgst: 0 
  },
  0.25: { 
    name: '0.25% Diamonds', 
    badge: 'Diamonds', 
    schedule: 'Schedule V', 
    desc: 'Rough & cut/polished diamonds, precious & semi-precious stones',
    cgst: 0.125, 
    sgst: 0.125 
  },
  3: { 
    name: '3% Precious Metals', 
    badge: 'Gold / Bullion', 
    schedule: 'Schedule IV', 
    desc: 'Gold, silver, platinum bars, coins, bullion, and articles of jewelry',
    cgst: 1.5, 
    sgst: 1.5 
  },
  5: { 
    name: '5% Merit Rate', 
    badge: 'Merit', 
    schedule: 'Schedule I', 
    isCore: true,
    desc: 'Mass essentials, packaged cereals, edible oils, tea, transport, apparel ≤ ₹1,000',
    cgst: 2.5, 
    sgst: 2.5 
  },
  6: { 
    name: '6% Concessional', 
    badge: 'Bricks (No ITC)', 
    schedule: 'Notif. 02/2022', 
    desc: 'Special composition rate for building bricks and earthen tiles without ITC benefit',
    cgst: 3, 
    sgst: 3 
  },
  12: { 
    name: '12% Standard Lower', 
    badge: 'Standard Lower', 
    schedule: 'Schedule II', 
    isCore: true,
    desc: 'Pharma medicaments, medical diagnostic kits, apparel > ₹1,000, works contracts',
    cgst: 6, 
    sgst: 6 
  },
  18: { 
    name: '18% Standard Rate', 
    badge: 'Standard Rate', 
    schedule: 'Schedule III', 
    isStandard: true, 
    isCore: true,
    desc: 'Official statutory benchmark rate for majority of goods, IT/software, electronics & services',
    cgst: 9, 
    sgst: 9 
  },
  28: { 
    name: '28% Demerit / Max', 
    badge: 'Luxury / Demerit', 
    schedule: 'Schedule VII', 
    isCore: true,
    desc: 'Motor vehicles, cement, air conditioning, aerated drinks, betting/gaming (+ Cess)',
    cgst: 14, 
    sgst: 14 
  },
};

export const GstRateCalculatorPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine initial active tab based on pathname and search query
  const getInitialTab = (): 'CALCULATOR' | 'AI_CLASSIFIER' | 'DIRECTORY' | 'GLOBAL_RATES' => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    if (tabParam === 'ai' || tabParam === 'classifier') return 'AI_CLASSIFIER';
    if (tabParam === 'directory') return 'DIRECTORY';
    if (tabParam === 'global') return 'GLOBAL_RATES';
    if (tabParam === 'calculator') return 'CALCULATOR';

    if (location.pathname.includes('/smart-classifier') || location.pathname.includes('/tax-classifier')) {
      return 'AI_CLASSIFIER';
    }
    return 'CALCULATOR';
  };

  // Active Main Navigation Tab
  const [activeMainTab, setActiveMainTab] = useState<'AI_CLASSIFIER' | 'CALCULATOR' | 'DIRECTORY' | 'GLOBAL_RATES'>(getInitialTab);

  // Sync tab with URL pathname changes
  useEffect(() => {
    setActiveMainTab(getInitialTab());
  }, [location.pathname, location.search]);

  // Calculator Form State
  const [selectedHsnId, setSelectedHsnId] = useState<string>('hsn-8471'); // default to 8471 Laptops (18%)
  const [hsnSearchQuery, setHsnSearchQuery] = useState<string>('');
  const [customTaxRate, setCustomTaxRate] = useState<number | null>(null);
  const [calculationMode, setCalculationMode] = useState<'EXCLUSIVE' | 'INCLUSIVE'>('EXCLUSIVE');
  const [amountMode, setAmountMode] = useState<'TOTAL' | 'QTY_RATE'>('TOTAL');
  const [taxableAmount, setTaxableAmount] = useState<string>('50000');
  const [quantity, setQuantity] = useState<string>('1');
  const [unitRate, setUnitRate] = useState<string>('50000');
  const [supplyType, setSupplyType] = useState<'INTRA' | 'INTER'>('INTRA');
  const [isUnionTerritory, setIsUnionTerritory] = useState<boolean>(false);
  const [applyCess, setApplyCess] = useState<boolean>(true);
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  // Handle incoming prefill state from Quick Tax Calculator or other pages
  useEffect(() => {
    const navState = location.state as { prefilledAmount?: string; prefilledHsnCode?: string; isInterstate?: boolean } | null;
    if (navState) {
      if (navState.prefilledAmount) {
        setTaxableAmount(navState.prefilledAmount);
        setAmountMode('TOTAL');
      }
      if (navState.prefilledHsnCode) {
        const found = HSN_DIRECTORY.find(item => item.code === navState.prefilledHsnCode);
        if (found) {
          setSelectedHsnId(found.id);
        }
      }
      if (typeof navState.isInterstate === 'boolean') {
        setSupplyType(navState.isInterstate ? 'INTER' : 'INTRA');
      }
    }
  }, [location.state]);

  // Directory Search & Filter State
  const [directorySearch, setDirectorySearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'GOODS' | 'SERVICES' | 'RCM' | 'CESS'>('ALL');
  const [slabFilter, setSlabFilter] = useState<number | 'ALL'>('ALL');

  // Currently selected HSN record
  const selectedItem: HSNCode = useMemo(() => {
    return HSN_DIRECTORY.find(item => item.id === selectedHsnId || item.code === selectedHsnId) || HSN_DIRECTORY[0];
  }, [selectedHsnId]);

  // Filtered HSN directory for instant search box inside calculator
  const matchingHsnItems = useMemo(() => {
    if (!hsnSearchQuery.trim()) return [];
    const q = hsnSearchQuery.toLowerCase().trim();
    return HSN_DIRECTORY.filter(item => 
      item.code.toLowerCase().includes(q) || 
      item.description.toLowerCase().includes(q) ||
      (item.chapter && item.chapter.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [hsnSearchQuery]);

  // Effective Tax Rate
  const effectiveTaxRate = customTaxRate !== null ? customTaxRate : selectedItem.taxRate;
  const effectiveCessRate = (applyCess && selectedItem.cessRate) ? selectedItem.cessRate : 0;

  // Amount computation
  const rawInputAmount = useMemo(() => {
    if (amountMode === 'QTY_RATE') {
      const q = parseFloat(quantity) || 0;
      const r = parseFloat(unitRate) || 0;
      return q * r;
    }
    return parseFloat(taxableAmount) || 0;
  }, [amountMode, quantity, unitRate, taxableAmount]);

  // Calculation Results
  const calculationResult = useMemo(() => {
    const rate = effectiveTaxRate;
    const cess = effectiveCessRate;
    const totalTaxPct = rate + cess;

    if (calculationMode === 'EXCLUSIVE') {
      // Amount entered is Taxable / Net Amount
      const netTaxable = rawInputAmount;
      const totalTax = (netTaxable * rate) / 100;
      const cessAmount = (netTaxable * cess) / 100;
      const grossAmount = netTaxable + totalTax + cessAmount;

      const cgst = supplyType === 'INTRA' ? totalTax / 2 : 0;
      const sgstOrUtgst = supplyType === 'INTRA' ? totalTax / 2 : 0;
      const igst = supplyType === 'INTER' ? totalTax : 0;

      return {
        netTaxable,
        rate,
        cessRate: cess,
        totalTax,
        cessAmount,
        grossAmount,
        cgst,
        sgstOrUtgst,
        igst,
        cgstRate: supplyType === 'INTRA' ? rate / 2 : 0,
        sgstRate: supplyType === 'INTRA' ? rate / 2 : 0,
        igstRate: supplyType === 'INTER' ? rate : 0,
      };
    } else {
      // Inclusive Mode: Amount entered is Gross Amount (MRP)
      const grossAmount = rawInputAmount;
      const netTaxable = totalTaxPct > 0 ? (grossAmount / (1 + totalTaxPct / 100)) : grossAmount;
      const totalTax = (netTaxable * rate) / 100;
      const cessAmount = (netTaxable * cess) / 100;

      const cgst = supplyType === 'INTRA' ? totalTax / 2 : 0;
      const sgstOrUtgst = supplyType === 'INTRA' ? totalTax / 2 : 0;
      const igst = supplyType === 'INTER' ? totalTax : 0;

      return {
        netTaxable,
        rate,
        cessRate: cess,
        totalTax,
        cessAmount,
        grossAmount,
        cgst,
        sgstOrUtgst,
        igst,
        cgstRate: supplyType === 'INTRA' ? rate / 2 : 0,
        sgstRate: supplyType === 'INTRA' ? rate / 2 : 0,
        igstRate: supplyType === 'INTER' ? rate : 0,
      };
    }
  }, [rawInputAmount, effectiveTaxRate, effectiveCessRate, calculationMode, supplyType]);

  // Filtered HSN directory list
  const filteredDirectory = useMemo(() => {
    return HSN_DIRECTORY.filter(item => {
      // Category filter
      if (categoryFilter === 'GOODS' && item.category !== 'GOODS') return false;
      if (categoryFilter === 'SERVICES' && item.category !== 'SERVICES') return false;
      if (categoryFilter === 'RCM' && !item.rcmApplicable) return false;
      if (categoryFilter === 'CESS' && (!item.cessRate || item.cessRate <= 0)) return false;

      // Slab filter
      if (slabFilter !== 'ALL' && item.taxRate !== slabFilter) return false;

      // Search query
      if (directorySearch.trim()) {
        const query = directorySearch.toLowerCase();
        const matchesCode = item.code.toLowerCase().includes(query);
        const matchesDesc = item.description.toLowerCase().includes(query);
        const matchesChapter = item.chapter ? item.chapter.toLowerCase().includes(query) : false;
        const matchesConditions = item.conditions ? item.conditions.toLowerCase().includes(query) : false;
        return matchesCode || matchesDesc || matchesChapter || matchesConditions;
      }

      return true;
    });
  }, [categoryFilter, slabFilter, directorySearch]);

  const handleSelectHsn = (item: HSNCode) => {
    setSelectedHsnId(item.id || item.code);
    setCustomTaxRate(null);
    // Smooth scroll to calculator on mobile/desktop
    const calcElement = document.getElementById('gst-calculator-tool-box');
    if (calcElement) {
      calcElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const copyBreakdownToClipboard = () => {
    const formatted = `--- TaxFlow GST Computation Breakdown ---
HSN/SAC Code: ${selectedItem.code} (${selectedItem.category})
Description: ${selectedItem.description}
Supply Type: ${supplyType === 'INTRA' ? (isUnionTerritory ? 'Intra-State (UTGST + CGST)' : 'Intra-State (CGST + SGST)') : 'Inter-State (IGST)'}
Computation Mode: ${calculationMode === 'EXCLUSIVE' ? 'Base + GST (Exclusive)' : 'MRP / Gross (Inclusive)'}
Taxable Net Amount: ₹${calculationResult.netTaxable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
Applicable GST Rate: ${calculationResult.rate}%
${supplyType === 'INTRA' 
  ? `CGST (${calculationResult.cgstRate}%): ₹${calculationResult.cgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}\n${isUnionTerritory ? 'UTGST' : 'SGST'} (${calculationResult.sgstRate}%): ₹${calculationResult.sgstOrUtgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
  : `IGST (${calculationResult.igstRate}%): ₹${calculationResult.igst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}
${calculationResult.cessRate > 0 ? `Compensation Cess (${calculationResult.cessRate}%): ₹${calculationResult.cessAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}\n` : ''}Total Invoice Amount: ₹${calculationResult.grossAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
Generated via TaxFlow Enterprise GST Rate Engine`;

    navigator.clipboard.writeText(formatted);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 3000);
  };

  const handleCreateInvoiceFromCalc = () => {
    const draftLineItem = {
      id: `draft-calc-${Date.now()}`,
      description: selectedItem.description || 'Goods / Services Item',
      hsnSac: selectedItem.code || '',
      quantity: amountMode === 'QTY_RATE' ? (parseFloat(quantity) || 1) : 1,
      unit: 'PCS',
      rate: amountMode === 'QTY_RATE' ? (parseFloat(unitRate) || 0) : calculationResult.netTaxable,
      taxRate: effectiveTaxRate,
      taxableValue: calculationResult.netTaxable,
      taxAmount: calculationResult.totalTax,
      cgst: calculationResult.cgst,
      sgst: calculationResult.sgstOrUtgst,
      igst: calculationResult.igst,
      total: calculationResult.grossAmount,
      isInterstate: supplyType === 'INTER',
    };

    try {
      sessionStorage.setItem('taxflow_quick_tax_draft_item', JSON.stringify(draftLineItem));
    } catch (e) {
      console.warn(e);
    }

    navigate('/invoices', {
      state: {
        openDraft: true,
        prefilledDraftItem: draftLineItem,
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-16">
      {/* Header Banner */}
      <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-50/70 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute right-32 bottom-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
                <Calculator size={22} />
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  GST Rate & HSN/SAC Calculator
                </h1>
                <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-extrabold uppercase tracking-wider border border-blue-200">
                  Statutory 2026 Engine
                </span>
              </div>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed">
              Determine statutory GST tax slabs, calculate CGST, SGST, UTGST, and IGST breakdowns, simulate inclusive/exclusive values, and look up verified HSN/SAC classifications across Goods and Services.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveMainTab('AI_CLASSIFIER')}
              className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer ${
                activeMainTab === 'AI_CLASSIFIER'
                  ? 'bg-indigo-600 text-white shadow-indigo-200'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
              }`}
            >
              <Sparkles size={15} />
              <span>AI Smart Classifier</span>
            </button>
            <button
              onClick={() => setActiveMainTab('CALCULATOR')}
              className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer ${
                activeMainTab === 'CALCULATOR'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Calculator size={15} />
              <span>Statutory Calculator</span>
            </button>
            <button
              onClick={() => setActiveMainTab('GLOBAL_RATES')}
              className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer ${
                activeMainTab === 'GLOBAL_RATES'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Globe size={15} />
              <span>Global Tax Rates</span>
            </button>
            <button
              onClick={() => navigate('/hsn-lookup')}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/80 transition-all flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Search size={15} className="text-slate-600" />
              <span>HSN / SAC Center</span>
            </button>
            <button
              onClick={copyBreakdownToClipboard}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/80 transition-all flex items-center gap-2 shadow-xs cursor-pointer"
            >
              {copiedNotification ? (
                <>
                  <Check size={16} className="text-emerald-600" />
                  <span className="text-emerald-600">Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy size={16} className="text-slate-600" />
                  <span>Copy Calculation</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab View Rendering */}
      {activeMainTab === 'AI_CLASSIFIER' && (
        <div className="space-y-6">
          <SmartTaxRateClassifier
            onSelectRate={(classified) => {
              const matchedHsn = HSN_DIRECTORY.find(h => h.code === classified.hsnSacCode);
              if (matchedHsn) {
                setSelectedHsnId(matchedHsn.id);
              }
              if (classified.inputContext?.price) {
                setTaxableAmount(String(classified.inputContext.price));
              }
              if (classified.inputContext?.isInterstate !== undefined) {
                setSupplyType(classified.inputContext.isInterstate ? 'INTER' : 'INTRA');
              }
            }}
            onApplyToInvoice={(classified) => {
              const draftLineItem = {
                id: `draft-ai-${Date.now()}`,
                description: classified.description || classified.hsnSacTitle,
                hsnSac: classified.hsnSacCode,
                quantity: 1,
                unit: 'PCS',
                rate: classified.inputContext?.price || 10000,
                taxRate: classified.suggestedRate,
                taxableValue: classified.inputContext?.price || 10000,
                taxAmount: ((classified.inputContext?.price || 10000) * classified.suggestedRate) / 100,
                cgst: classified.cgstRate ? ((classified.inputContext?.price || 10000) * classified.cgstRate) / 100 : 0,
                sgst: classified.sgstRate ? ((classified.inputContext?.price || 10000) * classified.sgstRate) / 100 : 0,
                igst: classified.igstRate ? ((classified.inputContext?.price || 10000) * classified.igstRate) / 100 : 0,
                total: (classified.inputContext?.price || 10000) * (1 + (classified.suggestedRate + (classified.cessRate || 0)) / 100),
                isInterstate: supplyType === 'INTER',
              };

              try {
                sessionStorage.setItem('taxflow_quick_tax_draft_item', JSON.stringify(draftLineItem));
              } catch (e) {
                console.warn(e);
              }

              navigate('/invoices', {
                state: {
                  openDraft: true,
                  prefilledDraftItem: draftLineItem,
                }
              });
            }}
          />
        </div>
      )}

      {activeMainTab === 'GLOBAL_RATES' && (
        <div className="space-y-6">
          <GlobalTaxRatesLookup />
        </div>
      )}

      {(activeMainTab === 'CALCULATOR' || activeMainTab === 'DIRECTORY') && (
      <>
      {/* Main Two-Column Layout: Calculator & Selected HSN Details */}
      <div id="gst-calculator-tool-box" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Calculator Inputs */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <h2 className="text-base font-bold text-slate-800">
                  Tax Calculation Parameters
                </h2>
              </div>
              <button
                onClick={() => {
                  setTaxableAmount('50000');
                  setCalculationMode('EXCLUSIVE');
                  setSupplyType('INTRA');
                  setIsUnionTerritory(false);
                  setCustomTaxRate(null);
                  setApplyCess(true);
                }}
                className="text-xs text-slate-500 hover:text-blue-600 font-semibold flex items-center gap-1 transition-colors"
              >
                <RefreshCw size={13} />
                <span>Reset</span>
              </button>
            </div>

            {/* 1. HSN / SAC Code Selector Dropdown with Instant Autocomplete Search */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag size={13} className="text-blue-600" />
                  HSN / SAC Classification & Tariff Code
                </label>
                <span className="text-[11px] font-bold text-slate-500">
                  {selectedItem.category === 'GOODS' ? 'Goods (HSN)' : 'Services (SAC)'}
                </span>
              </div>

              {/* Quick Search Input for HSN / Product */}
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={hsnSearchQuery}
                  onChange={(e) => setHsnSearchQuery(e.target.value)}
                  placeholder="Quick search HSN/SAC by code or keyword (e.g. 8471, Laptop, 9983, Legal)..."
                  className="w-full h-10 pl-9 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                />
                {hsnSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setHsnSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Search Suggestions Dropdown if query present */}
              {matchingHsnItems.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 space-y-1 z-20 relative">
                  <span className="text-[10px] font-bold text-slate-400 uppercase px-2 py-0.5 block">Suggested Matches:</span>
                  {matchingHsnItems.map(item => (
                    <button
                      key={item.id || item.code}
                      type="button"
                      onClick={() => {
                        setSelectedHsnId(item.id || item.code);
                        setCustomTaxRate(null);
                        setHsnSearchQuery('');
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-blue-50/70 transition-colors flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                          {item.code}
                        </span>
                        <span className="text-slate-800 font-medium truncate">{item.description}</span>
                      </div>
                      <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[10px] shrink-0">
                        {item.taxRate}%
                      </span>
                    </button>
                  ))}
                </div>
              )}
              
              <div className="relative">
                <select
                  value={selectedHsnId}
                  onChange={(e) => {
                    setSelectedHsnId(e.target.value);
                    setCustomTaxRate(null);
                  }}
                  className="w-full h-11 px-3.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none cursor-pointer"
                >
                  {HSN_DIRECTORY.map((hsn) => (
                    <option key={hsn.id || `${hsn.code}-${hsn.taxRate}`} value={hsn.id || hsn.code}>
                      [{hsn.code}] {hsn.description.slice(0, 60)}{hsn.description.length > 60 ? '...' : ''} — {hsn.taxRate}% {hsn.category}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <Filter size={16} />
                </div>
              </div>
            </div>

            {/* 2. Amount Input & Calculation Mode (Inclusive vs Exclusive) */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <IndianRupee size={13} className="text-blue-600" />
                  Transaction Amount
                </label>

                {/* Exclusive vs Inclusive Switch */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setCalculationMode('EXCLUSIVE')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      calculationMode === 'EXCLUSIVE'
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Exclusive (Base + GST)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalculationMode('INCLUSIVE')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      calculationMode === 'INCLUSIVE'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Inclusive (MRP / Total)
                  </button>
                </div>
              </div>

              {/* Amount Mode Toggle: Total or Qty x Rate */}
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 pb-1">
                <button
                  type="button"
                  onClick={() => setAmountMode('TOTAL')}
                  className={`px-3 py-1 rounded-lg border text-[11px] transition-all ${
                    amountMode === 'TOTAL' 
                      ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Direct Total Value
                </button>
                <button
                  type="button"
                  onClick={() => setAmountMode('QTY_RATE')}
                  className={`px-3 py-1 rounded-lg border text-[11px] transition-all ${
                    amountMode === 'QTY_RATE' 
                      ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Quantity × Unit Price
                </button>
              </div>

              {amountMode === 'TOTAL' ? (
                <div className="space-y-2">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={taxableAmount}
                      onChange={(e) => setTaxableAmount(e.target.value)}
                      placeholder="e.g. 50000"
                      className="w-full h-12 pl-8 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-base font-extrabold text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition-all font-mono"
                    />
                  </div>
                  
                  {/* Quick Preset Amount Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Presets:</span>
                    {['10000', '25000', '50000', '100000', '500000'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setTaxableAmount(preset)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono transition-all border ${
                          taxableAmount === preset 
                            ? 'bg-slate-900 text-white border-slate-900' 
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        ₹{(parseInt(preset) / 1000)}k
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">
                      Quantity ({selectedItem.uqc || 'NOS'})
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">
                      Unit Rate (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={unitRate}
                        onChange={(e) => setUnitRate(e.target.value)}
                        className="w-full h-11 pl-7 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Tax Slabs & Rate Adjustment */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Percent size={13} className="text-blue-600" />
                  Statutory GST Slab
                </label>
                <div className="flex items-center gap-2">
                  {effectiveTaxRate === 18 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200 animate-pulse">
                      Official Standard Benchmark
                    </span>
                  )}
                  <span className="text-xs font-black text-blue-600 font-mono">
                    {effectiveTaxRate}% GST
                  </span>
                </div>
              </div>

              {/* Slabs Pill Selection */}
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                {[0, 0.25, 3, 5, 6, 12, 18, 28].map((slab) => {
                  const meta = STATUTORY_SLAB_INFO[slab];
                  const isSelected = effectiveTaxRate === slab;
                  return (
                    <button
                      key={slab}
                      type="button"
                      onClick={() => setCustomTaxRate(slab)}
                      title={`${meta?.name}: ${meta?.desc}`}
                      className={`py-2 px-1 rounded-xl text-xs font-extrabold transition-all border flex flex-col items-center justify-center cursor-pointer relative ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-500/20'
                          : slab === 18
                          ? 'bg-blue-50/60 hover:bg-blue-100/60 text-blue-900 border-blue-200'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-0.5">
                        {slab}%
                      </span>
                      <span className={`text-[8px] font-bold tracking-tight ${
                        isSelected ? 'text-blue-100' : slab === 18 ? 'text-blue-700 font-black' : 'text-slate-500'
                      }`}>
                        {slab === 0 ? 'Nil' : slab === 18 ? 'Standard' : slab === 28 ? 'Demerit' : meta?.badge || 'Tier'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Statutory Schedule & Component Breakdown Note */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50/80 px-3 py-1.5 rounded-lg border border-slate-200/70">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span>Schedule: <strong className="text-slate-700">{STATUTORY_SLAB_INFO[effectiveTaxRate]?.schedule || 'Statutory'}</strong> ({STATUTORY_SLAB_INFO[effectiveTaxRate]?.name})</span>
                </span>
                <span className="font-mono text-[10px] font-bold text-slate-600">
                  {supplyType === 'INTRA' 
                    ? `CGST ${(effectiveTaxRate / 2)}% + ${isUnionTerritory ? 'UTGST' : 'SGST'} ${(effectiveTaxRate / 2)}%` 
                    : `IGST ${effectiveTaxRate}%`}
                </span>
              </div>
            </div>

            {/* 4. Supply Nature: Intra-State vs Inter-State */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Jurisdiction Scope
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSupplyType('INTRA')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      supplyType === 'INTRA'
                        ? 'bg-blue-50/70 border-blue-500/80 text-blue-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs font-extrabold block">Intra-State</span>
                    <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                      {isUnionTerritory ? 'CGST + UTGST' : 'CGST + SGST'} (50:50)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSupplyType('INTER')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      supplyType === 'INTER'
                        ? 'bg-blue-50/70 border-blue-500/80 text-blue-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs font-extrabold block">Inter-State</span>
                    <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                      IGST (100% Integrated)
                    </span>
                  </button>
                </div>
              </div>

              {/* Special statutory modifiers (UTGST & Cess) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Statutory Provisions
                </label>
                <div className="space-y-2">
                  {supplyType === 'INTRA' && (
                    <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={isUnionTerritory}
                        onChange={(e) => setIsUnionTerritory(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-semibold text-slate-700">
                        Supply in Union Territory (Apply UTGST)
                      </span>
                    </label>
                  )}

                  {selectedItem.cessRate && selectedItem.cessRate > 0 ? (
                    <label className="flex items-center gap-2 p-2 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyCess}
                        onChange={(e) => setApplyCess(e.target.checked)}
                        className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs font-semibold text-amber-900">
                        Include Compensation Cess ({selectedItem.cessRate}%)
                      </span>
                    </label>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Instant Computation Breakdown Result Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-blue-600" />
                <span className="text-xs font-extrabold uppercase tracking-widest text-slate-700">
                  Computation Summary
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider border border-blue-200">
                {calculationMode}
              </span>
            </div>

            {/* Total Gross Invoice Value Display */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Invoice Gross Value
              </span>
              <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono tracking-tight flex items-baseline gap-1">
                <span className="text-xl font-normal text-slate-500">₹</span>
                {calculationResult.grossAmount.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <span className="text-xs text-slate-500 font-medium block">
                Effective Total Tax: ₹{(calculationResult.totalTax + calculationResult.cessAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })} ({((calculationResult.rate + calculationResult.cessRate)).toFixed(1)}%)
              </span>
            </div>

            {/* Line Item Breakdown */}
            <div className="space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/70 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Taxable Net Value</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  ₹{calculationResult.netTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {supplyType === 'INTRA' ? (
                <>
                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      CGST ({calculationResult.cgstRate}%)
                    </span>
                    <span className="font-mono font-bold text-emerald-600">
                      +₹{calculationResult.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                      {isUnionTerritory ? 'UTGST' : 'SGST'} ({calculationResult.sgstRate}%)
                    </span>
                    <span className="font-mono font-bold text-emerald-600">
                      +₹{calculationResult.sgstOrUtgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                    IGST ({calculationResult.igstRate}%)
                  </span>
                  <span className="font-mono font-bold text-emerald-600">
                    +₹{calculationResult.igst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {calculationResult.cessRate > 0 && (
                <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5">
                  <span className="text-amber-700 flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Compensation Cess ({calculationResult.cessRate}%)
                  </span>
                  <span className="font-mono font-bold text-amber-700">
                    +₹{calculationResult.cessAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>

            {/* Selected Classification Card Details */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono font-extrabold text-blue-600 text-sm">
                  {selectedItem.code}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                  selectedItem.category === 'GOODS' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-purple-100 text-purple-700 border border-purple-200'
                }`}>
                  {selectedItem.category}
                </span>
              </div>
              <p className="text-slate-700 text-xs line-clamp-2">
                {selectedItem.description}
              </p>
              {selectedItem.conditions && (
                <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200/60">
                  Note: {selectedItem.conditions}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {selectedItem.rcmApplicable && (
                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">
                    RCM Applicable
                  </span>
                )}
                {selectedItem.itcEligibility && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    selectedItem.itcEligibility === 'ELIGIBLE' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : selectedItem.itcEligibility === 'INELIGIBLE'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    ITC: {selectedItem.itcEligibility}
                  </span>
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={copyBreakdownToClipboard}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Copy size={15} />
                <span>Copy Summary</span>
              </button>
              <button
                onClick={handleCreateInvoiceFromCalc}
                className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm cursor-pointer"
                title="Create Invoice with this calculation"
              >
                <span>Draft Invoice</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Slab Comparative Simulator Table */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Comparative GST Slabs Simulation for ₹{rawInputAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ({calculationMode === 'EXCLUSIVE' ? 'Base Amount' : 'MRP / Gross'})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Jurisdiction: <strong>{supplyType === 'INTRA' ? (isUnionTerritory ? 'CGST + UTGST' : 'CGST + SGST') : 'IGST'}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[0, 3, 5, 12, 18, 28].map((slab) => {
            const isCurrent = effectiveTaxRate === slab;
            let net = 0;
            let tax = 0;
            let gross = 0;

            if (calculationMode === 'EXCLUSIVE') {
              net = rawInputAmount;
              tax = (net * slab) / 100;
              gross = net + tax;
            } else {
              gross = rawInputAmount;
              net = slab > 0 ? (gross / (1 + slab / 100)) : gross;
              tax = (net * slab) / 100;
            }

            return (
              <div
                key={slab}
                onClick={() => setCustomTaxRate(slab)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                  isCurrent 
                    ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-xs' 
                    : 'bg-slate-50/60 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-black font-mono ${isCurrent ? 'text-blue-700' : 'text-slate-800'}`}>
                      {slab}% GST
                    </span>
                    {isCurrent && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {slab === 0 ? 'Nil / Exempt' : slab === 18 ? 'Standard Benchmark' : slab === 28 ? 'Luxury / Demerit' : `${STATUTORY_SLAB_INFO[slab]?.badge || 'Slab'}`}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/60 space-y-1 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Tax:</span>
                    <span className="font-bold text-slate-900">₹{Math.round(tax).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 font-bold">
                    <span>Total:</span>
                    <span className={isCurrent ? 'text-blue-700' : 'text-slate-900'}>₹{Math.round(gross).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full Statutory Directory & Searchable Tariff Master */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <BookOpen size={20} className="text-blue-600" />
              Statutory HSN & SAC Tariff Directory
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Search by HSN/SAC code, product name, or statutory chapter to determine applicable GST slabs and compliance conditions.
            </p>
          </div>
          
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <span>Showing {filteredDirectory.length} of {HSN_DIRECTORY.length} Codes</span>
          </div>
        </div>

        {/* Directory Filters & Search Bar */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={directorySearch}
              onChange={(e) => setDirectorySearch(e.target.value)}
              placeholder="Search by HSN/SAC code (e.g. 8471, 9983), item name, or service category..."
              className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
            {directorySearch && (
              <button
                onClick={() => setDirectorySearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold overflow-x-auto">
            {(['ALL', 'GOODS', 'SERVICES', 'RCM', 'CESS'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  categoryFilter === cat
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {cat === 'ALL' ? 'All Codes' : cat === 'GOODS' ? 'Goods (HSN)' : cat === 'SERVICES' ? 'Services (SAC)' : cat === 'RCM' ? 'RCM' : 'Cess Items'}
              </button>
            ))}
          </div>

          {/* Slab Rate Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold overflow-x-auto">
            <span className="text-[10px] uppercase text-slate-400 px-2">Slab:</span>
            {(['ALL', 0, 0.25, 3, 5, 6, 12, 18, 28] as const).map((slab) => (
              <button
                key={slab.toString()}
                onClick={() => setSlabFilter(slab)}
                title={slab === 'ALL' ? 'All Slabs' : slab === 18 ? '18% Standard Statutory Benchmark Slab' : `${slab}% Slab`}
                className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap text-xs transition-all cursor-pointer ${
                  slabFilter === slab
                    ? 'bg-blue-600 text-white shadow-sm font-black'
                    : slab === 18
                    ? 'text-blue-800 bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {slab === 'ALL' ? 'All' : slab === 18 ? '18% (Std)' : `${slab}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Directory Table / Cards */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Code & Type</th>
                  <th className="py-3 px-4">Chapter & Description</th>
                  <th className="py-3 px-3 text-center">Tax Rate</th>
                  <th className="py-3 px-3 text-center">Statutory ITC</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredDirectory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <HelpCircle size={28} className="text-slate-300" />
                        <p className="font-semibold text-slate-600 text-sm">No HSN or SAC codes match your search</p>
                        <p className="text-xs text-slate-400">Try searching for generic keywords like "Computer", "Consulting", "Rice", or "Transport"</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDirectory.map((item) => {
                    const isSelected = selectedHsnId === item.id || selectedHsnId === item.code;
                    return (
                      <tr 
                        key={item.id || `${item.code}-${item.taxRate}`}
                        className={`hover:bg-blue-50/40 transition-colors ${
                          isSelected ? 'bg-blue-50/60 font-semibold' : ''
                        }`}
                      >
                        {/* Code & Type */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-extrabold text-xs px-2 py-1 bg-slate-100 rounded-lg text-slate-900 border border-slate-200">
                              {item.code}
                            </span>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                              item.category === 'GOODS' 
                                ? 'bg-sky-100 text-sky-700' 
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {item.category}
                            </span>
                          </div>
                        </td>

                        {/* Description & Chapter */}
                        <td className="py-3 px-4 max-w-md">
                          <div className="space-y-1">
                            <p className="text-slate-900 font-medium leading-snug">
                              {item.description}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                              {item.chapter && (
                                <span className="font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                  Ch: {item.chapter}
                                </span>
                              )}
                              {item.conditions && (
                                <span className="text-slate-500 italic line-clamp-1 max-w-xs">
                                  {item.conditions}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Tax Rate & Special Flags */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-black font-mono ${
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
                            {item.cessRate && item.cessRate > 0 && (
                              <span className="text-[9px] font-extrabold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                                +{item.cessRate}% Cess
                              </span>
                            )}
                            {item.rcmApplicable && (
                              <span className="text-[9px] font-extrabold text-amber-800 bg-amber-200/80 px-1.5 py-0.5 rounded">
                                RCM
                              </span>
                            )}
                          </div>
                        </td>

                        {/* ITC Eligibility */}
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.itcEligibility === 'ELIGIBLE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.itcEligibility === 'INELIGIBLE'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {item.itcEligibility || 'ELIGIBLE'}
                          </span>
                        </td>

                        {/* Action: Use in Calculator */}
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleSelectHsn(item)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700'
                            }`}
                          >
                            {isSelected ? (
                              <>
                                <CheckCircle2 size={13} />
                                <span>Selected</span>
                              </>
                            ) : (
                              <>
                                <Calculator size={13} />
                                <span>Calculate</span>
                              </>
                            )}
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
      </div>

      {/* Statutory GST Slabs Reference Guide Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <Scale size={22} className="text-blue-600" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-slate-900">
                  Statutory GST Rate Slabs & Tariff Architecture
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-200">
                  CBIC & GST Portal Aligned
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Official Indian GST schedules per Central Goods and Services Tax Act, 2017 & Rate Notifications.
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 font-medium">
            Standard Default Rate: <strong className="text-blue-700 font-extrabold">18% (Schedule III)</strong>
          </div>
        </div>

        {/* 1. Core 4-Tier Standard Structure */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700">
              Primary 4-Tier Standard Slabs
            </span>
            <span className="text-[11px] text-slate-400">
              General commercial goods & registered taxable services
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 5% Merit Slab */}
            <div className="p-4 bg-teal-50/50 border border-teal-200 rounded-2xl space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-base font-black text-teal-900">5% Merit Slab</span>
                <span className="text-[10px] font-bold bg-teal-200/60 text-teal-900 px-2 py-0.5 rounded">
                  Schedule I
                </span>
              </div>
              <p className="text-xs text-teal-800 leading-relaxed">
                Packaged branded food items, edible oils, tea, transport services (air economy/cab), life saving medicines, apparel/footwear up to ₹1,000.
              </p>
              <div className="text-[10px] font-mono text-teal-700 pt-1 border-t border-teal-200/60 font-semibold">
                CGST 2.5% + SGST 2.5% | IGST 5%
              </div>
            </div>

            {/* 12% Standard Lower */}
            <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-base font-black text-blue-900">12% Standard Lower</span>
                <span className="text-[10px] font-bold bg-blue-200/60 text-blue-900 px-2 py-0.5 rounded">
                  Schedule II
                </span>
              </div>
              <p className="text-xs text-blue-800 leading-relaxed">
                Formulated pharma medicaments, diagnostic kits, apparel & footwear above ₹1,000, business class air tickets, government civil works contracts.
              </p>
              <div className="text-[10px] font-mono text-blue-700 pt-1 border-t border-blue-200/60 font-semibold">
                CGST 6% + SGST 6% | IGST 12%
              </div>
            </div>

            {/* 18% Standard Benchmark */}
            <div className="p-4 bg-indigo-50/60 border-2 border-indigo-400/80 rounded-2xl space-y-2 shadow-xs relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-black text-indigo-950">18% Standard Rate</span>
                </div>
                <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded">
                  Schedule III • Benchmark
                </span>
              </div>
              <p className="text-xs text-indigo-900 leading-relaxed font-medium">
                Official statutory benchmark rate for IT software, electronics, capital machinery, banking, telecom, hospitality, and over 70% of commercial supplies.
              </p>
              <div className="text-[10px] font-mono text-indigo-800 pt-1 border-t border-indigo-200/80 font-bold">
                CGST 9% + SGST 9% | IGST 18%
              </div>
            </div>

            {/* 28% Luxury & Demerit */}
            <div className="p-4 bg-rose-50/50 border border-rose-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-base font-black text-rose-900">28% Luxury / Demerit</span>
                <span className="text-[10px] font-bold bg-rose-200/60 text-rose-900 px-2 py-0.5 rounded">
                  Schedule VII
                </span>
              </div>
              <p className="text-xs text-rose-800 leading-relaxed">
                Motor cars, motorcycles, air conditioners, cement, aerated beverages, pan masala, and online gaming (with applicable Compensation Cess).
              </p>
              <div className="text-[10px] font-mono text-rose-700 pt-1 border-t border-rose-200/60 font-semibold">
                CGST 14% + SGST 14% | IGST 28%
              </div>
            </div>
          </div>
        </div>

        {/* 2. Special Statutory Commodity Slabs */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700">
              Special Statutory Slabs & Exemptions
            </span>
            <span className="text-[11px] text-slate-400">
              Commodity-specific rates and concessional notifications
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 0% Nil / Exempt */}
            <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-emerald-900">0% Nil / Exempt</span>
                <span className="text-[10px] font-bold bg-emerald-200/60 text-emerald-900 px-2 py-0.5 rounded">
                  Exempt / LUT
                </span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Fresh vegetables, unbranded grains, milk, salt, healthcare, schooling, and zero-rated export supplies under Letter of Undertaking (LUT).
              </p>
            </div>

            {/* 0.25% Diamonds */}
            <div className="p-4 bg-cyan-50/50 border border-cyan-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-cyan-900">0.25% Diamonds</span>
                <span className="text-[10px] font-bold bg-cyan-200/60 text-cyan-900 px-2 py-0.5 rounded">
                  Schedule V
                </span>
              </div>
              <p className="text-xs text-cyan-800 leading-relaxed">
                Cut & polished diamonds, rough diamonds, precious & semi-precious stones (CGST 0.125% + SGST 0.125%).
              </p>
            </div>

            {/* 3% Gold */}
            <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-amber-900">3% Gold & Bullion</span>
                <span className="text-[10px] font-bold bg-amber-200/60 text-amber-900 px-2 py-0.5 rounded">
                  Schedule IV
                </span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Gold, silver, platinum bars, coins, bullion, and articles of jewelry (CGST 1.5% + SGST 1.5%).
              </p>
            </div>

            {/* 6% Bricks Scheme */}
            <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-purple-900">6% Concessional</span>
                <span className="text-[10px] font-bold bg-purple-200/60 text-purple-900 px-2 py-0.5 rounded">
                  Notif. 02/2022
                </span>
              </div>
              <p className="text-xs text-purple-800 leading-relaxed">
                Special concessional rate for brick kilns, building bricks, and earthen roofing tiles without ITC benefit.
              </p>
            </div>
          </div>
        </div>

        {/* HSN Invoicing Compliance Threshold Guide */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
          <div className="space-y-1">
            <span className="font-extrabold text-slate-800 block">
              Mandatory HSN Digit Rules on Tax Invoices (Rule 46 of CGST Rules):
            </span>
            <p className="text-slate-600">
              • Aggregate Turnover &gt; ₹5.00 Crore: <strong>6-digit HSN / SAC</strong> is mandatory on all B2B and export invoices.<br />
              • Aggregate Turnover ≤ ₹5.00 Crore: <strong>4-digit HSN</strong> mandatory on B2B invoices (optional for B2C).
            </p>
          </div>
          <button
            onClick={() => {
              navigate('/tax-forecasting');
            }}
            className="px-4 py-2 bg-white border border-slate-300 hover:border-slate-400 font-bold text-slate-700 rounded-xl transition-all whitespace-nowrap shadow-xs cursor-pointer"
          >
            Explore Tax Forecasting →
          </button>
        </div>
      </div>
      </>
      )}
    </div>
  );
};

export default GstRateCalculatorPage;
