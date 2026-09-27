import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Search,
  Percent,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Calculator,
  FileText,
  HelpCircle,
  RefreshCw,
  Scale,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  Tag,
  ArrowUpRight,
  Info,
  Download,
  ListFilter,
  Plus,
  Trash2,
  FileSpreadsheet,
  Zap,
  Bookmark,
  Building2,
  Receipt,
  Cpu,
  Truck,
  Stethoscope,
  Shirt,
  SunMedium,
  Wine,
  Gem,
  Utensils
} from 'lucide-react';
import { classifyTaxRate, batchClassifyTaxRates } from '../services/api';
import { SmartTaxClassificationResult, BatchTaxClassificationItem, BatchTaxClassificationResponse } from '../types';
import { safeStorage } from '../utils/safeStorage';

export interface SmartTaxRateClassifierProps {
  initialDescription?: string;
  initialPrice?: number;
  isCompact?: boolean;
  onSelectRate?: (result: SmartTaxClassificationResult) => void;
  onApplyToInvoice?: (result: SmartTaxClassificationResult) => void;
  className?: string;
}

// Preset Industry Templates for Instant Testing
const SECTOR_PLAYBOOKS = [
  {
    id: 'it-saas',
    sector: 'IT & Cloud SaaS',
    icon: Cpu,
    title: 'Enterprise Cloud SaaS Subscription',
    description: 'Annual Enterprise SaaS Cloud Platform Subscription with 99.9% SLA & Technical Support',
    price: 150000,
    expectedRate: 18,
    hsnSac: '998314',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  {
    id: 'garment-low',
    sector: 'Textiles & Apparel',
    icon: Shirt,
    title: "Cotton Casual T-Shirt (≤ ₹1,000)",
    description: "100% Combed Cotton Men's Crew Neck T-Shirt in Retail Polybag",
    price: 799,
    expectedRate: 5,
    hsnSac: '6203',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  {
    id: 'garment-high',
    sector: 'Textiles & Apparel',
    icon: Shirt,
    title: "Formal Designer Blazer (> ₹1,000)",
    description: "Premium Wool Blend Men's Tailored Two-Piece Suit Blazer",
    price: 4500,
    expectedRate: 12,
    hsnSac: '6203',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  },
  {
    id: 'legal-rcm',
    sector: 'Professional & Legal',
    icon: Scale,
    title: 'Legal Representation by Senior Advocate',
    description: 'Legal representation before National Company Law Appellate Tribunal (NCLAT) by Senior Counsel',
    price: 85000,
    expectedRate: 18,
    hsnSac: '998211',
    isRcm: true,
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  {
    id: 'solar-energy',
    sector: 'Clean Tech & Renewable',
    icon: SunMedium,
    title: 'Grid-Tied Solar Inverter 10kW',
    description: 'Three-Phase High Efficiency Grid-Tied Solar Photovoltaic String Inverter 10kW with MPPT',
    price: 68000,
    expectedRate: 12,
    hsnSac: '8466',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  {
    id: 'pharma-formulation',
    sector: 'Healthcare & Pharma',
    icon: Stethoscope,
    title: 'Diagnostic Rapid Blood Test Kits',
    description: 'In-Vitro Clinical Diagnostic Rapid Antigen Immunoassay Reagents and Testing Cartridges',
    price: 12500,
    expectedRate: 12,
    hsnSac: '3004',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200'
  },
  {
    id: 'ev-mobility',
    sector: 'Automotive & EV',
    icon: Zap,
    title: 'Commercial Electric Cargo 3-Wheeler',
    description: 'Battery-Powered Pure Electric Light Commercial Vehicle (EV) with 8kWh Lithium Iron Phosphate Pack',
    price: 285000,
    expectedRate: 5,
    hsnSac: '8703',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  {
    id: 'food-packaged',
    sector: 'Food & FMCG',
    icon: Utensils,
    title: 'Packaged Basmati Rice (5kg)',
    description: 'Pre-packaged and labelled Extra Long Grain Premium Basmati Rice 5kg under Legal Metrology Act',
    price: 650,
    expectedRate: 5,
    hsnSac: '1006',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  {
    id: 'luxury-car',
    sector: 'Demerit & Luxury',
    icon: Wine,
    title: 'Luxury SUV Passenger Motor Car',
    description: '3000cc Turbocharged Petrol Motor Car with seating capacity of 5 passengers',
    price: 6500000,
    expectedRate: 28,
    hsnSac: '8703',
    hasCess: true,
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200'
  },
  {
    id: 'bullion-gold',
    sector: 'Gems & Jewelry',
    icon: Gem,
    title: '999 Fine Gold Bullion Bar 50g',
    description: '24 Karat Certified 99.9% Purity Investment Grade Gold Bullion Cast Bar',
    price: 360000,
    expectedRate: 3,
    hsnSac: '7108',
    badgeColor: 'bg-yellow-50 text-yellow-800 border-yellow-200'
  }
];

const HISTORY_STORAGE_KEY = 'TF_SMART_CLASSIFIER_HISTORY';

export const SmartTaxRateClassifier: React.FC<SmartTaxRateClassifierProps> = ({
  initialDescription = '',
  initialPrice,
  isCompact = false,
  onSelectRate,
  onApplyToInvoice,
  className = ''
}) => {
  const navigate = useNavigate();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'SINGLE' | 'BATCH' | 'PLAYBOOKS' | 'HISTORY'>('SINGLE');

  // Single Classification Inputs
  const [description, setDescription] = useState<string>(initialDescription || 'Enterprise Cloud SaaS Subscription with SLA');
  const [price, setPrice] = useState<string>(initialPrice ? String(initialPrice) : '100000');
  const [supplyType, setSupplyType] = useState<'INTRA' | 'INTER'>('INTRA');
  const [isB2B, setIsB2B] = useState<boolean>(true);
  const [customContext, setCustomContext] = useState<string>('');

  // Classification Execution State
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SmartTaxClassificationResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // History State
  const [history, setHistory] = useState<SmartTaxClassificationResult[]>(() => {
    try {
      const stored = safeStorage.getItem(HISTORY_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Batch Classification State
  const [batchRows, setBatchRows] = useState<BatchTaxClassificationItem[]>([
    { id: 'b1', description: 'Cloud Data Storage & Kubernetes Hosting', price: 75000, quantity: 1 },
    { id: 'b2', description: "100% Cotton Printed Casual Shirts under ₹1,000", price: 850, quantity: 20 },
    { id: 'b3', description: 'Legal Consultancy Services by Advocate Firm', price: 40000, quantity: 1 },
    { id: 'b4', description: 'Solar Inverter 5kW Grid-Tied Unit', price: 45000, quantity: 2 },
    { id: 'b5', description: 'Aerated Carbonated Soft Drinks in Cans (300ml)', price: 40, quantity: 500 }
  ]);
  const [batchLoading, setBatchLoading] = useState<boolean>(false);
  const [batchResponse, setBatchResponse] = useState<BatchTaxClassificationResponse | null>(null);

  // Auto-run initial classification on mount if initialDescription is provided or defaults
  useEffect(() => {
    handleClassify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveToHistory = (item: SmartTaxClassificationResult) => {
    setHistory(prev => {
      const filtered = prev.filter(h => h.description.toLowerCase() !== item.description.toLowerCase());
      const updated = [item, ...filtered].slice(0, 30);
      try {
        safeStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save classifier history:', err);
      }
      return updated;
    });
  };

  const handleClassify = async (overrideDesc?: string, overridePrice?: number) => {
    const descToUse = overrideDesc !== undefined ? overrideDesc : description;
    const priceToUse = overridePrice !== undefined ? overridePrice : parseFloat(price) || undefined;

    if (!descToUse || !descToUse.trim()) {
      setError('Please provide a product or service description to analyze.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await classifyTaxRate({
        description: descToUse.trim(),
        price: priceToUse,
        isInterstate: supplyType === 'INTER',
        b2b: isB2B,
        customNote: customContext
      });

      setResult(res);
      saveToHistory(res);
      if (onSelectRate) {
        onSelectRate(res);
      }
    } catch (err: any) {
      console.error('Tax rate classification error:', err);
      setError(err.message || 'Failed to analyze statutory tax rate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSelectPlaybook = (playbook: typeof SECTOR_PLAYBOOKS[0]) => {
    setDescription(playbook.description);
    setPrice(String(playbook.price));
    setActiveTab('SINGLE');
    handleClassify(playbook.description, playbook.price);
  };

  const handleRunBatch = async () => {
    if (batchRows.length === 0) return;
    setBatchLoading(true);
    try {
      const res = await batchClassifyTaxRates(batchRows);
      setBatchResponse(res);
    } catch (err: any) {
      console.error('Batch classification error:', err);
      alert('Batch classification failed: ' + (err.message || 'Unknown error'));
    } finally {
      setBatchLoading(false);
    }
  };

  const addBatchRow = () => {
    setBatchRows(prev => [
      ...prev,
      { id: `b-${Date.now()}`, description: '', price: 1000, quantity: 1 }
    ]);
  };

  const updateBatchRow = (index: number, field: keyof BatchTaxClassificationItem, value: any) => {
    setBatchRows(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const removeBatchRow = (index: number) => {
    setBatchRows(prev => prev.filter((_, i) => i !== index));
  };

  // Calculations on the current result
  const calculatedAmounts = useMemo(() => {
    if (!result) return null;
    const baseAmount = parseFloat(price) || 0;
    const rate = result.suggestedRate;
    const cess = result.cessRate || 0;
    const isInter = supplyType === 'INTER';

    const totalTaxAmount = (baseAmount * rate) / 100;
    const cessAmount = (baseAmount * cess) / 100;
    const grossAmount = baseAmount + totalTaxAmount + cessAmount;

    return {
      taxableAmount: baseAmount,
      cgstAmount: isInter ? 0 : totalTaxAmount / 2,
      sgstAmount: isInter ? 0 : totalTaxAmount / 2,
      igstAmount: isInter ? totalTaxAmount : 0,
      cessAmount,
      totalTaxAmount,
      grossAmount
    };
  }, [result, price, supplyType]);

  const getRateBadgeColor = (rate: number) => {
    switch (rate) {
      case 0:
        return 'bg-slate-100 text-slate-800 border-slate-300';
      case 0.25:
      case 3:
        return 'bg-amber-50 text-amber-800 border-amber-300';
      case 5:
        return 'bg-emerald-50 text-emerald-700 border-emerald-300';
      case 12:
        return 'bg-blue-50 text-blue-700 border-blue-300';
      case 18:
        return 'bg-indigo-50 text-indigo-700 border-indigo-300';
      case 28:
      case 40:
        return 'bg-rose-50 text-rose-700 border-rose-300';
      default:
        return 'bg-indigo-50 text-indigo-700 border-indigo-300';
    }
  };

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-bold tracking-wide uppercase">
                <Sparkles size={13} className="text-indigo-300 animate-pulse" />
                Gemini 3.8 Flash Engine
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold">
                <ShieldCheck size={13} />
                Statutory GST Schedules
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Smart Tax Rate Classifier
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Natural language AI analyzer grounded in CBIC Gazette notifications, HSN/SAC chapter tariffs, and Section 16/17(5) statutory tax rules.
            </p>
          </div>

          {/* Top Quick Navigation Tabs */}
          <div className="flex items-center bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/80 backdrop-blur-sm self-start md:self-auto">
            <button
              onClick={() => setActiveTab('SINGLE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'SINGLE'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Zap size={13} />
              Live Classifier
            </button>
            <button
              onClick={() => setActiveTab('BATCH')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'BATCH'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <FileSpreadsheet size={13} />
              Batch Line Items
            </button>
            <button
              onClick={() => setActiveTab('PLAYBOOKS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'PLAYBOOKS'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Building2 size={13} />
              Sector Playbooks
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'HISTORY'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Bookmark size={13} />
              History ({history.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="p-6">
        {activeTab === 'SINGLE' && (
          <div className="space-y-6">
            {/* Input Form Card */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Product / Service Description Input */}
                <div className="lg:col-span-7 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <FileText size={14} className="text-indigo-600" />
                      Product Name or Service Description
                    </label>
                    <span className="text-xs text-slate-400">Natural language or invoice line text</span>
                  </div>
                  <div className="relative">
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="e.g., Annual Enterprise SaaS Cloud Subscription with SLA & 24/7 technical support..."
                      rows={3}
                      className="w-full text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl p-3.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs resize-none"
                    />
                  </div>

                  {/* Quick sample chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
                      <Tag size={12} /> Try Sample:
                    </span>
                    {[
                      'Cotton T-Shirt ₹799',
                      'Legal Services by Advocate',
                      'Packaged Basmati Rice 5kg',
                      'Solar PV Inverter 10kW',
                      'Luxury SUV Motor Car'
                    ].map((sample, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setDescription(sample);
                          handleClassify(sample);
                        }}
                        className="text-xs bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 px-2.5 py-1 rounded-lg transition-all"
                      >
                        {sample}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Adjusters & Context Column */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Unit Price Input */}
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1 mb-1.5">
                        Unit Value (₹)
                        <span title="Triggers statutory value threshold rules">
                          <Info size={12} className="text-slate-400" />
                        </span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                        <input
                          type="number"
                          value={price}
                          onChange={e => setPrice(e.target.value)}
                          placeholder="100000"
                          className="w-full text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-xl pl-7 pr-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Supply Type Toggle */}
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1 mb-1.5">
                        Supply Movement
                      </label>
                      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/70 rounded-xl border border-slate-300">
                        <button
                          type="button"
                          onClick={() => setSupplyType('INTRA')}
                          className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                            supplyType === 'INTRA'
                              ? 'bg-white text-indigo-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Intra (CGST)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSupplyType('INTER')}
                          className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                            supplyType === 'INTER'
                              ? 'bg-white text-indigo-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Inter (IGST)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* B2B / B2C Toggle */}
                  <div className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Building2 size={13} className="text-slate-500" />
                      Recipient Entity
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsB2B(true)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-md ${
                          isB2B ? 'bg-indigo-100 text-indigo-800' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        B2B Registered
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsB2B(false)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-md ${
                          !isB2B ? 'bg-indigo-100 text-indigo-800' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        B2C Consumer
                      </button>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => handleClassify()}
                    disabled={loading || !description.trim()}
                    className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Analyzing Statutory CBIC Slabs...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Classify GST Tax Rate
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start gap-3">
                <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">Classification Notice</h4>
                  <p className="text-xs text-rose-700 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* AI Classification Result Display */}
            {result && (
              <div className="space-y-5 animate-fadeIn">
                {/* Top Rate & HSN Hero Card */}
                <div className="bg-white border-2 border-indigo-200/90 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                    {/* Left: Tax Rate & Slab */}
                    <div className="flex items-start gap-5">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-24 h-24 rounded-2xl border-2 flex flex-col items-center justify-center shadow-inner ${getRateBadgeColor(
                            result.suggestedRate
                          )}`}
                        >
                          <span className="text-3xl font-black tracking-tight">{result.suggestedRate}%</span>
                          <span className="text-xs font-extrabold uppercase tracking-wider">GST RATE</span>
                        </div>
                        {result.cessRate > 0 && (
                          <span className="mt-1 px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold rounded-md">
                            +{result.cessRate}% Cess
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                            {result.slabName}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {result.category}
                          </span>
                          {result.rcmApplicable && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                              <Scale size={11} /> Reverse Charge (RCM)
                            </span>
                          )}
                          <span className="px-2 py-0.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md flex items-center gap-1">
                            <CheckCircle2 size={12} /> {result.confidenceScore}% Confidence
                          </span>
                        </div>

                        <h3 className="text-xl font-black text-slate-900 tracking-tight">
                          {result.hsnSacTitle}
                        </h3>

                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            {result.category === 'SERVICES' ? 'SAC' : 'HSN'} {result.hsnSacCode}
                          </span>
                          <button
                            onClick={() => handleCopy(result.hsnSacCode, 'hsn')}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            {copiedField === 'hsn' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                            {copiedField === 'hsn' ? 'Copied' : 'Copy Code'}
                          </button>
                          <span className="text-slate-300">•</span>
                          <span className="text-xs text-slate-500">{result.chapter}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Quick Action Controls */}
                    <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
                      <button
                        onClick={() => {
                          navigate('/rate-calculator', {
                            state: {
                              prefilledAmount: price,
                              prefilledHsnCode: result.hsnSacCode,
                              isInterstate: supplyType === 'INTER'
                            }
                          });
                        }}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Calculator size={14} />
                        Simulate in Rate Calculator
                      </button>
                      <button
                        onClick={() => {
                          if (onApplyToInvoice) {
                            onApplyToInvoice(result);
                          } else {
                            navigate('/invoices');
                          }
                        }}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Receipt size={14} />
                        Apply to Invoice Voucher
                      </button>
                      <button
                        onClick={() => {
                          const textToCopy = `HSN/SAC: ${result.hsnSacCode}\nRate: ${result.suggestedRate}%\nSlab: ${result.slabName}\nSchedule: ${result.statutorySchedule}\nReasoning: ${result.reasoning}`;
                          handleCopy(textToCopy, 'summary');
                        }}
                        className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        {copiedField === 'summary' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        {copiedField === 'summary' ? 'Summary Copied' : 'Copy Statutory Memo'}
                      </button>
                    </div>
                  </div>

                  {/* Statutory Reasoning Box */}
                  <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-8 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700">
                        <Scale size={14} className="text-indigo-600" />
                        Statutory Determination & Gazette Citation
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed font-medium">
                        {result.reasoning}
                      </p>
                      <div className="text-xs text-indigo-700 bg-indigo-50/70 border border-indigo-100 rounded-lg p-2.5 font-semibold">
                        <span className="font-bold">Official Statutory Schedule:</span> {result.statutorySchedule}
                      </div>
                    </div>

                    {/* ITC & Compliance Badges */}
                    <div className="md:col-span-4 space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                      <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                        <span>Input Tax Credit (ITC)</span>
                        <span
                          className={`px-2 py-0.5 text-xs font-black rounded-md ${
                            result.itcEligibility === 'ELIGIBLE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : result.itcEligibility === 'BLOCKED_17_5'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {result.itcEligibility === 'ELIGIBLE'
                            ? '100% Eligible'
                            : result.itcEligibility === 'BLOCKED_17_5'
                            ? 'Section 17(5) Blocked'
                            : 'Conditional ITC'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        {result.itcReasoning ||
                          (result.itcEligibility === 'ELIGIBLE'
                            ? 'Full credit can be claimed in GSTR-3B subject to 2B matching.'
                            : 'Credit is blocked under Section 17(5) of the CGST Act.')}
                      </p>
                    </div>
                  </div>

                  {/* Conditions & Threshold Caveats */}
                  {result.conditionsOrExceptions && (
                    <div className="mt-4 p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                      <AlertTriangle size={15} className="text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Threshold & Classification Caveat: </span>
                        {result.conditionsOrExceptions}
                      </div>
                    </div>
                  )}
                </div>

                {/* Tax Breakdown Matrix & Alternative Rates */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Tax Breakdown Card */}
                  {calculatedAmounts && (
                    <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-3">
                        <Calculator size={14} className="text-indigo-600" />
                        Tax Computation Breakdown (for ₹{calculatedAmounts.taxableAmount.toLocaleString('en-IN')})
                      </h4>

                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                          <div className="text-xs text-slate-500 font-bold uppercase">CGST ({result.cgstRate}%)</div>
                          <div className="text-base font-black text-slate-900 mt-0.5">
                            ₹{calculatedAmounts.cgstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </div>
                        </div>

                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                          <div className="text-xs text-slate-500 font-bold uppercase">SGST ({result.sgstRate}%)</div>
                          <div className="text-base font-black text-slate-900 mt-0.5">
                            ₹{calculatedAmounts.sgstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </div>
                        </div>

                        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center">
                          <div className="text-xs text-indigo-600 font-bold uppercase">IGST ({result.igstRate}%)</div>
                          <div className="text-base font-black text-indigo-900 mt-0.5">
                            ₹{calculatedAmounts.igstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3.5 bg-slate-900 text-white rounded-xl">
                        <div>
                          <div className="text-xs text-slate-400 font-semibold uppercase">Total Invoice Value (Gross)</div>
                          <div className="text-lg font-black text-white">
                            ₹{calculatedAmounts.grossAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-emerald-400 font-semibold">Total GST Component</div>
                          <div className="text-sm font-black text-emerald-300">
                            +₹{calculatedAmounts.totalTaxAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Alternative Rate Schedules & Conditions */}
                  <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Layers size={14} className="text-indigo-600" />
                      Conditional Variations & Alternative Rates
                    </h4>

                    {result.alternativeRates && result.alternativeRates.length > 0 ? (
                      <div className="space-y-2">
                        {result.alternativeRates.map((alt, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-slate-900 text-xs">{alt.condition}</span>
                              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-800">
                                {alt.rate}%
                              </span>
                            </div>
                            {alt.schedule && <div className="text-xs text-slate-500">Ref: {alt.schedule}</div>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl">
                        No conditional slab variations found. This item is subject to uniform statutory rates.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BATCH CLASSIFICATION TAB */}
        {activeTab === 'BATCH' && (
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Batch Document / Line Items Classifier</h3>
                  <p className="text-xs text-slate-500">
                    Analyze multiple invoice lines or purchase order descriptions simultaneously to extract GST rates and HSN codes.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={addBatchRow}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} /> Add Line
                  </button>
                  <button
                    onClick={handleRunBatch}
                    disabled={batchLoading || batchRows.length === 0}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    {batchLoading ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    Classify {batchRows.length} Items
                  </button>
                </div>
              </div>

              {/* Batch Table */}
              <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-black uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3">Item / Service Description</th>
                      <th className="p-3 w-28 text-right">Unit Price (₹)</th>
                      <th className="p-3 w-20 text-center">Qty</th>
                      <th className="p-3 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batchRows.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50/80">
                        <td className="p-3 text-center text-slate-400 font-mono font-bold">{idx + 1}</td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={row.description}
                            onChange={e => updateBatchRow(idx, 'description', e.target.value)}
                            placeholder="e.g. IT Consulting / Cotton Fabric / Solar Panels..."
                            className="w-full px-2.5 py-1.5 text-xs text-slate-900 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            value={row.price || ''}
                            onChange={e => updateBatchRow(idx, 'price', parseFloat(e.target.value) || 0)}
                            className="w-full text-right px-2.5 py-1.5 text-xs text-slate-900 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            value={row.quantity || 1}
                            onChange={e => updateBatchRow(idx, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-full text-center px-2 py-1.5 text-xs text-slate-900 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => removeBatchRow(idx)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Batch Response Results */}
            {batchResponse && (
              <div className="space-y-4 animate-fadeIn">
                {/* Batch Metrics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
                    <div className="text-xs font-bold text-slate-500 uppercase">Total Items Classified</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">{batchResponse.summary.totalItems}</div>
                  </div>
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
                    <div className="text-xs font-bold text-slate-500 uppercase">Avg AI Confidence</div>
                    <div className="text-2xl font-black text-emerald-600 mt-1">
                      {batchResponse.summary.avgConfidence}%
                    </div>
                  </div>
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
                    <div className="text-xs font-bold text-slate-500 uppercase">Total Taxable Value</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">
                      ₹{batchResponse.summary.totalTaxableAmount?.toLocaleString('en-IN') || 0}
                    </div>
                  </div>
                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl shadow-xs">
                    <div className="text-xs font-bold text-indigo-700 uppercase">Estimated Total GST</div>
                    <div className="text-2xl font-black text-indigo-950 mt-1">
                      ₹{batchResponse.summary.totalEstimatedTax?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || 0}
                    </div>
                  </div>
                </div>

                {/* Batch Results Table */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="p-3">Item Description</th>
                        <th className="p-3 text-center">HSN/SAC</th>
                        <th className="p-3 text-center">GST Rate</th>
                        <th className="p-3 text-right">Taxable</th>
                        <th className="p-3 text-right">GST Amount</th>
                        <th className="p-3 text-center">ITC Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {batchResponse.results.map((res: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3 font-semibold text-slate-900">{res.description}</td>
                          <td className="p-3 text-center font-mono font-bold text-indigo-600">{res.hsnSacCode}</td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full font-black text-xs ${getRateBadgeColor(
                                res.suggestedRate
                              )}`}
                            >
                              {res.suggestedRate}%
                            </span>
                          </td>
                          <td className="p-3 text-right font-medium text-slate-700">
                            ₹{(res.taxableAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-700">
                            ₹{(res.estimatedTax || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 text-xs font-bold rounded-md ${
                                res.itcEligibility === 'ELIGIBLE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {res.itcEligibility === 'ELIGIBLE' ? 'Eligible' : 'Blocked'}
                            </span>
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

        {/* SECTOR PLAYBOOKS TAB */}
        {activeTab === 'PLAYBOOKS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Statutory Sector Playbooks & Test Queries</h3>
                <p className="text-xs text-slate-500">
                  Pre-configured enterprise scenarios covering statutory thresholds, RCM, and demerit luxury schedules.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SECTOR_PLAYBOOKS.map(pb => {
                const IconComponent = pb.icon;
                return (
                  <div
                    key={pb.id}
                    onClick={() => handleSelectPlaybook(pb)}
                    className="p-4 bg-white hover:bg-slate-50/90 border border-slate-200 hover:border-indigo-300 rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                          <IconComponent size={14} className="text-indigo-600" />
                          {pb.sector}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-black border ${pb.badgeColor}`}>
                          {pb.expectedRate}% GST
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                        {pb.title}
                      </h4>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">{pb.description}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span className="font-mono font-semibold">HSN {pb.hsnSac}</span>
                      <span className="text-indigo-600 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Classify <ArrowRight size={12} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'HISTORY' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Recent AI Tax Classifications</h3>
                <p className="text-xs text-slate-500">
                  Local cache of recently analyzed documents, statutory schedules, and rate findings.
                </p>
              </div>
              {history.length > 0 && (
                <button
                  onClick={() => {
                    setHistory([]);
                    safeStorage.removeItem(HISTORY_STORAGE_KEY);
                  }}
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1"
                >
                  <Trash2 size={13} /> Clear History
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl">
                <Bookmark size={28} className="mx-auto text-slate-400 mb-2" />
                <h4 className="text-sm font-bold text-slate-700">No Classification History Yet</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Run a single or batch classification to automatically store audit trails here.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3">Description</th>
                      <th className="p-3 text-center">HSN/SAC</th>
                      <th className="p-3 text-center">Suggested Rate</th>
                      <th className="p-3">Schedule</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-slate-900 max-w-xs truncate">{item.description}</td>
                        <td className="p-3 text-center font-mono font-bold text-indigo-600">{item.hsnSacCode}</td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full font-black text-xs ${getRateBadgeColor(
                              item.suggestedRate
                            )}`}
                          >
                            {item.suggestedRate}%
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 text-xs truncate max-w-xs">{item.statutorySchedule}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => {
                              setDescription(item.description);
                              setResult(item);
                              setActiveTab('SINGLE');
                            }}
                            className="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 rounded-lg"
                          >
                            View Result
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartTaxRateClassifier;
