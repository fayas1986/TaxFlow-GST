import React, { useState, useMemo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { useQuery } from '@tanstack/react-query';
import { fetchInvoices } from '../services/api';
import { Invoice, UserRole } from '../types';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  Calendar,
  AlertTriangle,
  Download,
  Sliders,
  Info,
  Banknote,
  Percent,
  TrendingDown,
  Sparkles,
  RefreshCw,
  Layers,
  BarChart3,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Save,
  Trash2,
  RotateCcw,
  Zap,
  Building2,
  Briefcase,
  Lightbulb,
  FileSpreadsheet,
  PieChart as PieChartIcon
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Legend,
  ReferenceLine
} from 'recharts';

export interface MonthlyForecastRecord {
  month: string;
  monthIndex: number;
  dueDate: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  isHistorical: boolean;
  turnover: number;
  projectedTurnover: number;
  
  // Tax Heads
  igstLiability: number;
  cgstLiability: number;
  sgstLiability: number;
  cessLiability: number;
  grossLiability: number;
  
  // ITC
  availableItc: number;
  capexItc: number;
  totalItcOffset: number;
  
  // Net Challan (Cash Ledger Payout)
  netCashOutflow: number;
  baselineCashOutflow: number;
  actualPaidOutflow?: number;
  
  // Risk & Health
  liquidityStrain: 'LOW' | 'MODERATE' | 'HIGH';
  advisoryNote: string;
}

interface SavedScenario {
  id: string;
  name: string;
  createdAt: string;
  revenueAdjustment: number;
  itcEfficiency: number;
  costInflation: number;
  rcmBurden: number;
  capexAmountQ2: number;
  capexAmountQ3: number;
  interstateRatio: number;
}

const PRESET_SCENARIOS = [
  {
    id: 'baseline',
    name: 'Baseline (Current Run-Rate)',
    description: 'Current sales momentum and standard ITC reconciliation rate',
    icon: RotateCcw,
    params: {
      revenueAdjustment: 0,
      itcEfficiency: 0,
      costInflation: 0,
      rcmBurden: 0,
      capexAmountQ2: 0,
      capexAmountQ3: 0,
      interstateRatio: 45
    }
  },
  {
    id: 'hyper_growth',
    name: 'Aggressive Expansion (+35%)',
    description: 'Surge in outward sales with ₹50L CapEx asset procurement in Q2',
    icon: TrendingUp,
    params: {
      revenueAdjustment: 35,
      itcEfficiency: 8,
      costInflation: 10,
      rcmBurden: 5,
      capexAmountQ2: 5000000,
      capexAmountQ3: 0,
      interstateRatio: 55
    }
  },
  {
    id: 'supply_squeeze',
    name: 'Supply Chain Stress Test',
    description: 'Lower revenues (-15%), input cost inflation (+12%), and 15% ITC vendor non-filing leakage',
    icon: AlertTriangle,
    params: {
      revenueAdjustment: -15,
      itcEfficiency: -15,
      costInflation: 12,
      rcmBurden: 10,
      capexAmountQ2: 0,
      capexAmountQ3: 0,
      interstateRatio: 40
    }
  },
  {
    id: 'optimal_tax_shield',
    name: 'Optimal ITC Maximizer',
    description: '100% 2B reconciliation, 0% blocked credit loss, and automated RCM settlement',
    icon: ShieldCheck,
    params: {
      revenueAdjustment: 10,
      itcEfficiency: 20,
      costInflation: 2,
      rcmBurden: -5,
      capexAmountQ2: 2500000,
      capexAmountQ3: 2500000,
      interstateRatio: 45
    }
  }
];

const TaxForecastingPage: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const { selectedGstin, selectedBranchId } = useSelector((state: RootState) => state.org);
  const tenantId = user?.currentTenantId || 't1';
  const activeTenantObj = user?.availableTenants?.find(t => t.id === tenantId);

  // Live Query from Invoices API
  const { data: invoices = [], isLoading: isLoadingInvoices, refetch: refetchInvoices } = useQuery({
    queryKey: ['invoices', tenantId, selectedGstin, selectedBranchId],
    queryFn: () => fetchInvoices(tenantId, selectedGstin, selectedBranchId)
  });

  // Active View & Filters
  const [activeTab, setActiveTab] = useState<'waterfall' | 'tax_heads' | 'liquidity' | 'schedule'>('waterfall');
  const [horizonFilter, setHorizonFilter] = useState<'12_MONTHS' | 'FY26_27' | 'Q1_Q2' | 'Q3_Q4'>('12_MONTHS');
  const [isSimulatorMode, setIsSimulatorMode] = useState<boolean>(false);

  // Dynamic Simulation Parameters
  const [revenueAdjustment, setRevenueAdjustment] = useState<number>(0); // -50% to +100%
  const [itcEfficiency, setItcEfficiency] = useState<number>(0); // -25% to +25%
  const [costInflation, setCostInflation] = useState<number>(0); // -10% to +30%
  const [rcmBurden, setRcmBurden] = useState<number>(0); // 0% to +50%
  const [capexAmountQ2, setCapexAmountQ2] = useState<number>(0); // in ₹ (e.g., 0 to 1,00,00,000)
  const [capexAmountQ3, setCapexAmountQ3] = useState<number>(0); // in ₹
  const [interstateRatio, setInterstateRatio] = useState<number>(45); // % of IGST vs CGST/SGST

  // Saved Scenarios
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(() => {
    try {
      const stored = localStorage.getItem('taxflow_saved_scenarios');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [newScenarioName, setNewScenarioName] = useState<string>('');
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [activePresetId, setActivePresetId] = useState<string>('baseline');

  // Compute live invoice metrics as foundation
  const baseLiveMetrics = useMemo(() => {
    const validInvoices = invoices.filter(inv => inv.status !== 'FAILED');
    const salesInvoices = validInvoices.filter(inv => inv.category === 'SALES');
    const purchaseInvoices = validInvoices.filter(inv => inv.category === 'PURCHASE');

    const totalSalesTurnover = salesInvoices.reduce((acc, inv) => acc + (inv.amount || 0), 0);
    const totalSalesTax = salesInvoices.reduce((acc, inv) => acc + (inv.taxAmount || 0), 0);
    const totalPurchaseAmount = purchaseInvoices.reduce((acc, inv) => acc + (inv.amount || 0), 0);
    const totalPurchaseItc = purchaseInvoices.reduce((acc, inv) => {
      if (inv.isBlockedItc) return acc;
      return acc + (inv.taxAmount || 0);
    }, 0);

    // Monthly run-rate baseline (fallback to sensible enterprise default if empty)
    const monthlyAvgTurnover = totalSalesTurnover > 0 ? totalSalesTurnover / Math.max(1, salesInvoices.length / 5) : 5800000;
    const monthlyAvgTax = totalSalesTax > 0 ? totalSalesTax / Math.max(1, salesInvoices.length / 5) : 1044000;
    const monthlyAvgItc = totalPurchaseItc > 0 ? totalPurchaseItc / Math.max(1, purchaseInvoices.length / 5) : 522000;

    return {
      monthlyAvgTurnover,
      monthlyAvgTax,
      monthlyAvgItc,
      totalInvoicesCount: validInvoices.length,
      salesCount: salesInvoices.length,
      purchaseCount: purchaseInvoices.length
    };
  }, [invoices]);

  // Generate 12-Month Realistic Forecast Model
  const fullForecastSchedule: MonthlyForecastRecord[] = useMemo(() => {
    const monthsMeta = [
      { name: 'Apr 2026', due: '20 May 2026', q: 'Q1' as const, isHist: true, seasonality: 0.92, actualPaid: 420000 },
      { name: 'May 2026', due: '20 Jun 2026', q: 'Q1' as const, isHist: true, seasonality: 0.95, actualPaid: 450000 },
      { name: 'Jun 2026', due: '20 Jul 2026', q: 'Q1' as const, isHist: true, seasonality: 1.02, actualPaid: 480000 },
      { name: 'Jul 2026', due: '20 Aug 2026', q: 'Q2' as const, isHist: true, seasonality: 1.05, actualPaid: 510000 },
      { name: 'Aug 2026', due: '20 Sep 2026', q: 'Q2' as const, isHist: true, seasonality: 1.08, actualPaid: 490000 },
      { name: 'Sep 2026', due: '20 Oct 2026', q: 'Q2' as const, isHist: false, seasonality: 1.15 },
      { name: 'Oct 2026', due: '20 Nov 2026', q: 'Q3' as const, isHist: false, seasonality: 1.28 }, // Festive Spike
      { name: 'Nov 2026', due: '20 Dec 2026', q: 'Q3' as const, isHist: false, seasonality: 1.22 }, // Festive Continuation
      { name: 'Dec 2026', due: '20 Jan 2027', q: 'Q3' as const, isHist: false, seasonality: 1.18 }, // Year-end sales
      { name: 'Jan 2027', due: '20 Feb 2027', q: 'Q4' as const, isHist: false, seasonality: 1.06 },
      { name: 'Feb 2027', due: '20 Mar 2027', q: 'Q4' as const, isHist: false, seasonality: 1.12 },
      { name: 'Mar 2027', due: '20 Apr 2027', q: 'Q4' as const, isHist: false, seasonality: 1.40 }  // FY Closing Peak
    ];

    const revMultiplier = 1 + (revenueAdjustment / 100);
    const itcMultiplier = 1 + (itcEfficiency / 100);
    const inflationMultiplier = 1 + (costInflation / 100);
    const rcmMultiplier = 1 + (rcmBurden / 100);

    return monthsMeta.map((m, idx) => {
      const baseTurnover = baseLiveMetrics.monthlyAvgTurnover * m.seasonality;
      const simTurnover = Math.round(baseTurnover * revMultiplier);

      // Baseline Outflow calculation (before simulation)
      const baseGrossTax = Math.round(baseTurnover * 0.18);
      const baseItc = Math.round(baseTurnover * 0.10);
      const baselineCashOutflow = Math.max(0, baseGrossTax - baseItc);

      // Simulated Gross Liability (18% blended rate)
      const grossLiability = Math.round(simTurnover * 0.18);

      // Tax Head Disaggregation
      const igstShare = interstateRatio / 100;
      const intraShare = (1 - igstShare) / 2;
      const igstLiability = Math.round(grossLiability * igstShare);
      const cgstLiability = Math.round(grossLiability * intraShare);
      const sgstLiability = Math.round(grossLiability * intraShare);
      const cessLiability = simTurnover > 8000000 ? Math.round(simTurnover * 0.015) : 0;
      const totalGrossLiability = igstLiability + cgstLiability + sgstLiability + cessLiability;

      // Available Operational ITC (scales with input purchase cost & inflation & matching efficiency)
      const baseOperationalPurchase = simTurnover * 0.58 * inflationMultiplier;
      const availableItc = Math.round(baseOperationalPurchase * 0.18 * itcMultiplier);

      // CapEx Influx in Q2 (spread across Sep) and Q3 (spread across Nov)
      let capexItc = 0;
      if (m.q === 'Q2' && m.name === 'Sep 2026' && capexAmountQ2 > 0) {
        capexItc = Math.round(capexAmountQ2 * 0.18);
      } else if (m.q === 'Q3' && m.name === 'Nov 2026' && capexAmountQ3 > 0) {
        capexItc = Math.round(capexAmountQ3 * 0.18);
      }

      // RCM addition to net cash payment (must be paid in cash first, then claimed)
      const rcmAddition = Math.round(grossLiability * 0.04 * (rcmMultiplier - 1));

      const totalItcOffset = Math.min(totalGrossLiability, availableItc + capexItc);
      const netCashOutflow = Math.max(0, (totalGrossLiability - totalItcOffset) + Math.max(0, rcmAddition));

      // Liquidity strain calculation
      let liquidityStrain: 'LOW' | 'MODERATE' | 'HIGH' = 'LOW';
      if (netCashOutflow > 750000) {
        liquidityStrain = 'HIGH';
      } else if (netCashOutflow > 450000) {
        liquidityStrain = 'MODERATE';
      }

      // Advisory notes
      let advisoryNote = 'Standard operational cash flow window.';
      if (m.name === 'Oct 2026') {
        advisoryNote = 'Festive inventory surge: reconcile GSTR-2B by 14th to prevent cash lockup.';
      } else if (m.name === 'Mar 2027') {
        advisoryNote = 'Financial year-end reconciliation: verify RCM reversals & Rule 42 adjustments.';
      } else if (capexItc > 0) {
        advisoryNote = `CapEx credit of ₹${(capexItc / 100000).toFixed(1)}L effectively shields cash ledger this month!`;
      } else if (liquidityStrain === 'HIGH') {
        advisoryNote = 'High cash challan expected: allocate treasury buffer 48h prior to due date.';
      }

      return {
        month: m.name,
        monthIndex: idx,
        dueDate: m.due,
        quarter: m.q,
        isHistorical: m.isHist,
        turnover: baseTurnover,
        projectedTurnover: simTurnover,
        igstLiability,
        cgstLiability,
        sgstLiability,
        cessLiability,
        grossLiability: totalGrossLiability,
        availableItc,
        capexItc,
        totalItcOffset,
        netCashOutflow,
        baselineCashOutflow,
        actualPaidOutflow: m.actualPaid,
        liquidityStrain,
        advisoryNote
      };
    });
  }, [baseLiveMetrics, revenueAdjustment, itcEfficiency, costInflation, rcmBurden, capexAmountQ2, capexAmountQ3, interstateRatio]);

  // Filtered dataset according to Horizon
  const displayedSchedule = useMemo(() => {
    switch (horizonFilter) {
      case 'FY26_27':
        return fullForecastSchedule;
      case 'Q1_Q2':
        return fullForecastSchedule.filter(d => d.quarter === 'Q1' || d.quarter === 'Q2');
      case 'Q3_Q4':
        return fullForecastSchedule.filter(d => d.quarter === 'Q3' || d.quarter === 'Q4');
      case '12_MONTHS':
      default:
        return fullForecastSchedule;
    }
  }, [fullForecastSchedule, horizonFilter]);

  // Aggregated KPI Totals
  const aggregateMetrics = useMemo(() => {
    const totalSimulatedCashOutflow = displayedSchedule.reduce((acc, curr) => acc + curr.netCashOutflow, 0);
    const totalBaselineCashOutflow = displayedSchedule.reduce((acc, curr) => acc + curr.baselineCashOutflow, 0);
    const totalGrossLiability = displayedSchedule.reduce((acc, curr) => acc + curr.grossLiability, 0);
    const totalItcCreditClaimed = displayedSchedule.reduce((acc, curr) => acc + curr.totalItcOffset, 0);
    const totalTurnover = displayedSchedule.reduce((acc, curr) => acc + curr.projectedTurnover, 0);
    const totalActualYtd = displayedSchedule.reduce((acc, curr) => acc + (curr.actualPaidOutflow || 0), 0);

    const varianceFromBaseline = totalSimulatedCashOutflow - totalBaselineCashOutflow;
    const variancePercentage = totalBaselineCashOutflow > 0 
      ? ((varianceFromBaseline / totalBaselineCashOutflow) * 100) 
      : 0;

    // Peak cash month
    const peakMonth = [...displayedSchedule].sort((a, b) => b.netCashOutflow - a.netCashOutflow)[0];

    // Recommended Treasury Reserve Buffer (125% of next month's projected outflow)
    const nextMonthOutflow = displayedSchedule.find(d => !d.isHistorical)?.netCashOutflow || 540000;
    const recommendedBuffer = Math.round(nextMonthOutflow * 1.25);

    return {
      totalSimulatedCashOutflow,
      totalBaselineCashOutflow,
      totalGrossLiability,
      totalItcCreditClaimed,
      totalTurnover,
      totalActualYtd,
      varianceFromBaseline,
      variancePercentage,
      peakMonth,
      recommendedBuffer
    };
  }, [displayedSchedule]);

  // Apply Preset Scenario
  const applyPreset = (presetId: string) => {
    const preset = PRESET_SCENARIOS.find(p => p.id === presetId);
    if (preset) {
      setActivePresetId(preset.id);
      setRevenueAdjustment(preset.params.revenueAdjustment);
      setItcEfficiency(preset.params.itcEfficiency);
      setCostInflation(preset.params.costInflation);
      setRcmBurden(preset.params.rcmBurden);
      setCapexAmountQ2(preset.params.capexAmountQ2);
      setCapexAmountQ3(preset.params.capexAmountQ3);
      setInterstateRatio(preset.params.interstateRatio);
      setIsSimulatorMode(true);
    }
  };

  // Save Scenario to Local Storage
  const handleSaveScenario = () => {
    if (!newScenarioName.trim()) return;
    const newScenario: SavedScenario = {
      id: 'sc_' + Date.now(),
      name: newScenarioName.trim(),
      createdAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      revenueAdjustment,
      itcEfficiency,
      costInflation,
      rcmBurden,
      capexAmountQ2,
      capexAmountQ3,
      interstateRatio
    };

    const updated = [newScenario, ...savedScenarios];
    setSavedScenarios(updated);
    localStorage.setItem('taxflow_saved_scenarios', JSON.stringify(updated));
    setNewScenarioName('');
    setShowSaveModal(false);
  };

  // Load Saved Scenario
  const handleLoadScenario = (sc: SavedScenario) => {
    setRevenueAdjustment(sc.revenueAdjustment);
    setItcEfficiency(sc.itcEfficiency);
    setCostInflation(sc.costInflation);
    setRcmBurden(sc.rcmBurden);
    setCapexAmountQ2(sc.capexAmountQ2);
    setCapexAmountQ3(sc.capexAmountQ3);
    setInterstateRatio(sc.interstateRatio);
    setActivePresetId(sc.id);
    setIsSimulatorMode(true);
  };

  // Delete Scenario
  const handleDeleteScenario = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = savedScenarios.filter(s => s.id !== id);
    setSavedScenarios(filtered);
    localStorage.setItem('taxflow_saved_scenarios', JSON.stringify(filtered));
  };

  // Reset Simulator
  const handleResetSimulator = () => {
    setRevenueAdjustment(0);
    setItcEfficiency(0);
    setCostInflation(0);
    setRcmBurden(0);
    setCapexAmountQ2(0);
    setCapexAmountQ3(0);
    setInterstateRatio(45);
    setActivePresetId('baseline');
    setIsSimulatorMode(false);
  };

  // Export to Excel (Full multi-sheet model)
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Monthly Forecast Schedule
    const scheduleRows = displayedSchedule.map(s => ({
      'Month': s.month,
      'Filing Due Date': s.dueDate,
      'Quarter': s.quarter,
      'Projected Outward Turnover (₹)': s.projectedTurnover,
      'IGST Liability (₹)': s.igstLiability,
      'CGST Liability (₹)': s.cgstLiability,
      'SGST Liability (₹)': s.sgstLiability,
      'Cess (₹)': s.cessLiability,
      'Total Gross Output Tax (₹)': s.grossLiability,
      'Eligible Input Tax Credit (₹)': s.availableItc,
      'CapEx ITC Injection (₹)': s.capexItc,
      'Total ITC Offset (₹)': s.totalItcOffset,
      'Net Cash Challan Payout (₹)': s.netCashOutflow,
      'Baseline Cash Outflow (₹)': s.baselineCashOutflow,
      'Liquidity Strain': s.liquidityStrain,
      'Advisory Action': s.advisoryNote
    }));
    const ws1 = XLSX.utils.json_to_sheet(scheduleRows);
    XLSX.utils.book_append_sheet(wb, ws1, 'Forecast Schedule');

    // Sheet 2: Executive Summary & Assumptions
    const summaryRows = [
      { Parameter: 'Tenant Name', Value: activeTenantObj?.name || 'TaxFlow Enterprise' },
      { Parameter: 'GSTIN', Value: selectedGstin || 'All Group GSTINs' },
      { Parameter: 'Horizon', Value: horizonFilter },
      { Parameter: 'Total Projected Turnover', Value: `₹ ${(aggregateMetrics.totalTurnover / 100000).toFixed(2)} Lakhs` },
      { Parameter: 'Total Gross Tax Liability', Value: `₹ ${(aggregateMetrics.totalGrossLiability / 100000).toFixed(2)} Lakhs` },
      { Parameter: 'Total ITC Credit Shield', Value: `₹ ${(aggregateMetrics.totalItcCreditClaimed / 100000).toFixed(2)} Lakhs` },
      { Parameter: 'Net Cash Outflow (Challan)', Value: `₹ ${(aggregateMetrics.totalSimulatedCashOutflow / 100000).toFixed(2)} Lakhs` },
      { Parameter: 'Recommended Treasury Buffer', Value: `₹ ${(aggregateMetrics.recommendedBuffer / 100000).toFixed(2)} Lakhs` },
      { Parameter: 'Revenue Growth Assumption', Value: `${revenueAdjustment}%` },
      { Parameter: 'ITC Efficiency Assumption', Value: `${itcEfficiency}%` },
      { Parameter: 'Cost Inflation Assumption', Value: `${costInflation}%` },
      { Parameter: 'CapEx Influx Q2', Value: `₹ ${capexAmountQ2.toLocaleString('en-IN')}` },
      { Parameter: 'CapEx Influx Q3', Value: `₹ ${capexAmountQ3.toLocaleString('en-IN')}` }
    ];
    const ws2 = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Executive Assumptions');

    XLSX.writeFile(wb, `TaxFlow_Forecast_Model_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 pb-28 animate-in fade-in">
      
      {/* Top Banner & Context Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gradient-to-tr from-indigo-600 to-blue-600 text-white rounded-xl shadow-md shadow-indigo-100 shrink-0 mt-0.5">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Tax Forecasting & Predictive Cash Model</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Ingested ({baseLiveMetrics.totalInvoicesCount} Invoices)
              </span>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mt-1">
              Multi-horizon GST liability projections, 2B tax credit optimization, and working capital scenario simulator for {activeTenantObj?.name || 'Group Enterprise'}.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => refetchInvoices()}
            className="p-2.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
            title="Refresh Live Data"
          >
            <RefreshCw size={16} className={isLoadingInvoices ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => setIsSimulatorMode(!isSimulatorMode)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs ${
              isSimulatorMode 
                ? 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700' 
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Sliders size={16} /> 
            {isSimulatorMode ? 'Active What-If Mode' : 'Open What-If Simulator'}
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm"
          >
            <FileSpreadsheet size={16} className="text-emerald-400" /> Export Excel Model
          </button>
        </div>
      </div>

      {/* Preset Scenario Quick-Bar */}
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-500" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-700">
              1-Click Enterprise Scenario Presets
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-medium">Horizon:</span>
            <div className="inline-flex p-0.5 bg-white border border-slate-200 rounded-lg text-xs font-bold shadow-2xs">
              {(['12_MONTHS', 'FY26_27', 'Q1_Q2', 'Q3_Q4'] as const).map(h => (
                <button
                  key={h}
                  onClick={() => setHorizonFilter(h)}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    horizonFilter === h 
                      ? 'bg-slate-900 text-white shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {h === '12_MONTHS' ? '12M Rolling' : h === 'FY26_27' ? 'FY 26-27' : h}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {PRESET_SCENARIOS.map(preset => {
            const IconComponent = preset.icon;
            const isActive = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden group ${
                  isActive 
                    ? 'bg-white border-indigo-500 shadow-sm ring-2 ring-indigo-50' 
                    : 'bg-white/70 border-slate-200/80 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <IconComponent size={14} className={isActive ? 'text-indigo-600' : 'text-slate-500 group-hover:text-slate-700'} />
                    <span className="text-xs font-bold text-slate-900">{preset.name}</span>
                  </div>
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed font-medium">
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive What-If Simulator Panel */}
      <AnimatePresence>
        {isSimulatorMode && (
          <motion.div
            initial={{ height: 0, opacity: 0, scale: 0.98 }}
            animate={{ height: 'auto', opacity: 1, scale: 1 }}
            exit={{ height: 0, opacity: 0, scale: 0.98 }}
            className="overflow-hidden"
          >
            <div className="bg-white text-slate-900 rounded-2xl p-5 md:p-6 shadow-xs border border-slate-200/80 relative space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600 shrink-0">
                    <Sliders size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Real-Time What-If Sensitivity Simulator</h3>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">Adjust revenue trajectories, ITC realization rates, inflation and CapEx to see instantaneous cash impact.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSaveModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    <Save size={13} /> Save Scenario
                  </button>

                  <button
                    onClick={handleResetSimulator}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs"
                  >
                    <RotateCcw size={13} /> Reset Baseline
                  </button>
                </div>
              </div>

              {/* Slider Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                
                {/* 1. Revenue Growth Slider */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <TrendingUp size={14} className="text-indigo-600" /> Revenue Growth Rate
                    </label>
                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-md shadow-2xs ${
                      revenueAdjustment > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      revenueAdjustment < 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                      'bg-white text-slate-700 border border-slate-200'
                    }`}>
                      {revenueAdjustment > 0 ? '+' : ''}{revenueAdjustment}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-50"
                    max="100"
                    step="5"
                    value={revenueAdjustment}
                    onChange={(e) => {
                      setRevenueAdjustment(parseInt(e.target.value));
                      setActivePresetId('custom');
                    }}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 font-semibold uppercase">
                    <span>-50%</span>
                    <span>0% (Base)</span>
                    <span>+100%</span>
                  </div>
                </div>

                {/* 2. ITC Optimization & 2B Matching Rate */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Percent size={14} className="text-emerald-600" /> ITC 2B Optimization Rate
                    </label>
                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-md shadow-2xs ${
                      itcEfficiency > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      itcEfficiency < 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                      'bg-white text-slate-700 border border-slate-200'
                    }`}>
                      {itcEfficiency > 0 ? '+' : ''}{itcEfficiency}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-25"
                    max="25"
                    step="1"
                    value={itcEfficiency}
                    onChange={(e) => {
                      setItcEfficiency(parseInt(e.target.value));
                      setActivePresetId('custom');
                    }}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 font-semibold uppercase">
                    <span>-25% (Leakage)</span>
                    <span>0% (Standard)</span>
                    <span>+25% (Optimal)</span>
                  </div>
                </div>

                {/* 3. Input Cost Inflation Slider */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Briefcase size={14} className="text-amber-600" /> Input Cost & Raw Inflation
                    </label>
                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-md shadow-2xs ${
                      costInflation > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-white text-slate-700 border border-slate-200'
                    }`}>
                      {costInflation > 0 ? '+' : ''}{costInflation}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-10"
                    max="30"
                    step="2"
                    value={costInflation}
                    onChange={(e) => {
                      setCostInflation(parseInt(e.target.value));
                      setActivePresetId('custom');
                    }}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 font-semibold uppercase">
                    <span>-10%</span>
                    <span>0%</span>
                    <span>+30%</span>
                  </div>
                </div>

                {/* 4. CapEx Influx in Q2 */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Building2 size={14} className="text-sky-600" /> Q2 CapEx Asset Purchase
                    </label>
                    <span className="text-xs font-black px-2.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-md shadow-2xs">
                      ₹ {(capexAmountQ2 / 100000).toFixed(1)}L
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10000000"
                    step="500000"
                    value={capexAmountQ2}
                    onChange={(e) => {
                      setCapexAmountQ2(parseInt(e.target.value));
                      setActivePresetId('custom');
                    }}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 font-semibold uppercase">
                    <span>₹0</span>
                    <span>₹50 Lakhs</span>
                    <span>₹1.00 Cr</span>
                  </div>
                </div>

                {/* 5. CapEx Influx in Q3 */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Building2 size={14} className="text-purple-600" /> Q3 CapEx Asset Purchase
                    </label>
                    <span className="text-xs font-black px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-md shadow-2xs">
                      ₹ {(capexAmountQ3 / 100000).toFixed(1)}L
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10000000"
                    step="500000"
                    value={capexAmountQ3}
                    onChange={(e) => {
                      setCapexAmountQ3(parseInt(e.target.value));
                      setActivePresetId('custom');
                    }}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 font-semibold uppercase">
                    <span>₹0</span>
                    <span>₹50 Lakhs</span>
                    <span>₹1.00 Cr</span>
                  </div>
                </div>

                {/* 6. Inter-State IGST Ratio */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Layers size={14} className="text-pink-600" /> Interstate Sales Ratio (IGST)
                    </label>
                    <span className="text-xs font-black px-2.5 py-0.5 bg-pink-50 text-pink-700 border border-pink-200 rounded-md shadow-2xs">
                      {interstateRatio}% IGST / {100 - interstateRatio}% CGST+SGST
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={interstateRatio}
                    onChange={(e) => {
                      setInterstateRatio(parseInt(e.target.value));
                      setActivePresetId('custom');
                    }}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-pink-500"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 font-semibold uppercase">
                    <span>10% (Local)</span>
                    <span>45% (Balanced)</span>
                    <span>90% (Export/Interstate)</span>
                  </div>
                </div>

              </div>

              {/* Saved Scenarios Quick List */}
              {savedScenarios.length > 0 && (
                <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Custom Saved Scenarios:</span>
                  {savedScenarios.map(sc => (
                    <div
                      key={sc.id}
                      onClick={() => handleLoadScenario(sc)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all border ${
                        activePresetId === sc.id
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <span>{sc.name}</span>
                      <button
                        onClick={(e) => handleDeleteScenario(sc.id, e)}
                        className="text-slate-400 hover:text-rose-600 p-0.5 transition-colors"
                        title="Delete scenario"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        
        {/* Card 1: Projected Net Cash Challan Outflow */}
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -z-0 opacity-60" />
          <div className="relative z-10">
            <div className="flex items-center justify-between text-slate-500 text-xs font-black uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1.5">
                <Banknote size={15} className="text-indigo-600" /> Net Cash Outflow
              </span>
              {isSimulatorMode && (
                <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded font-black">
                  SIMULATED
                </span>
              )}
            </div>

            <div className="text-3xl font-black text-slate-900 tracking-tight mt-1">
              ₹ {(aggregateMetrics.totalSimulatedCashOutflow / 100000).toFixed(2)}L
            </div>

            <div className="text-xs font-bold mt-2 flex items-center gap-1">
              {aggregateMetrics.varianceFromBaseline !== 0 ? (
                <>
                  {aggregateMetrics.varianceFromBaseline > 0 ? (
                    <ArrowUpRight size={14} className="text-rose-600 shrink-0" />
                  ) : (
                    <ArrowDownRight size={14} className="text-emerald-600 shrink-0" />
                  )}
                  <span className={aggregateMetrics.varianceFromBaseline > 0 ? "text-rose-600" : "text-emerald-600"}>
                    {aggregateMetrics.varianceFromBaseline > 0 ? '+' : ''}{(aggregateMetrics.varianceFromBaseline / 100000).toFixed(2)}L vs Baseline ({aggregateMetrics.variancePercentage.toFixed(1)}%)
                  </span>
                </>
              ) : (
                <span className="text-slate-500 font-medium">Standard baseline run-rate</span>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>Actual Paid (YTD):</span>
            <strong className="text-slate-800">₹ {(aggregateMetrics.totalActualYtd / 100000).toFixed(2)}L</strong>
          </div>
        </div>

        {/* Card 2: Total Input Tax Credit Shield */}
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-0 opacity-60" />
          <div className="relative z-10">
            <div className="flex items-center justify-between text-slate-500 text-xs font-black uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-emerald-600" /> ITC Credit Shield
              </span>
              <span className="text-[10px] text-emerald-700 bg-emerald-100 font-black px-2 py-0.5 rounded">
                OFFSET
              </span>
            </div>

            <div className="text-3xl font-black text-emerald-700 tracking-tight mt-1">
              ₹ {(aggregateMetrics.totalItcCreditClaimed / 100000).toFixed(2)}L
            </div>

            <p className="text-xs text-slate-500 font-medium mt-2">
              Off-sets <strong className="text-slate-800">{((aggregateMetrics.totalItcCreditClaimed / Math.max(1, aggregateMetrics.totalGrossLiability)) * 100).toFixed(1)}%</strong> of gross output liability.
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>CapEx ITC Included:</span>
            <strong className="text-emerald-700">+₹ {(((capexAmountQ2 + capexAmountQ3) * 0.18) / 100000).toFixed(2)}L</strong>
          </div>
        </div>

        {/* Card 3: Gross Tax Liability */}
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -z-0 opacity-60" />
          <div className="relative z-10">
            <div className="flex items-center justify-between text-slate-500 text-xs font-black uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1.5">
                <BarChart3 size={15} className="text-amber-600" /> Gross Tax Liability
              </span>
            </div>

            <div className="text-3xl font-black text-slate-900 tracking-tight mt-1">
              ₹ {(aggregateMetrics.totalGrossLiability / 100000).toFixed(2)}L
            </div>

            <p className="text-xs text-slate-500 font-medium mt-2">
              On ₹ {(aggregateMetrics.totalTurnover / 100000).toFixed(1)}L projected outward sales turnover.
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>Effective Tax Rate:</span>
            <strong className="text-slate-800">18.0% GST</strong>
          </div>
        </div>

        {/* Card 4: Recommended Treasury Working Capital Buffer */}
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-sky-50 rounded-bl-full -z-0 opacity-60" />
          <div className="relative z-10">
            <div className="flex items-center justify-between text-slate-500 text-xs font-black uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1.5">
                <DollarSign size={15} className="text-sky-600" /> Treasury Buffer
              </span>
              <span className="text-[10px] text-sky-700 bg-sky-100 font-black px-2 py-0.5 rounded">
                RECOMMENDED
              </span>
            </div>

            <div className="text-3xl font-black text-sky-700 tracking-tight mt-1">
              ₹ {(aggregateMetrics.recommendedBuffer / 100000).toFixed(2)}L
            </div>

            <p className="text-xs text-slate-500 font-medium mt-2">
              Maintain in Cash Ledger by the 18th of next month to prevent interest (Sec 50).
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>Peak Month:</span>
            <strong className="text-rose-600 font-bold">{aggregateMetrics.peakMonth?.month} (₹{(aggregateMetrics.peakMonth?.netCashOutflow / 100000).toFixed(1)}L)</strong>
          </div>
        </div>

      </div>

      {/* Main Visualizations & Analytics Suite */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        
        {/* Tab Navigation Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
              <PieChartIcon size={18} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Predictive Visualization & Cash Outflow Matrix
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Live interactive multi-channel forecast reflecting real GST 2B reconciliation & liability offsets
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('waterfall')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'waterfall' 
                  ? 'bg-white text-indigo-600 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Waterfall & Cash Net
            </button>
            <button
              onClick={() => setActiveTab('tax_heads')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'tax_heads' 
                  ? 'bg-white text-indigo-600 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tax Heads Breakdown
            </button>
            <button
              onClick={() => setActiveTab('liquidity')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'liquidity' 
                  ? 'bg-white text-indigo-600 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Working Capital Gauge
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'schedule' 
                  ? 'bg-white text-indigo-600 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Granular Table Schedule
            </button>
          </div>
        </div>

        {/* Chart View Content */}
        <div className="p-4 sm:p-6">
          {activeTab === 'waterfall' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 px-2">
                <span className="font-bold text-slate-700">Monthly Net Cash Challan Outflow (Area) vs Gross Liability & Available ITC (Bars)</span>
                <span className="font-medium text-indigo-600">Peak month: {aggregateMetrics.peakMonth?.month}</span>
              </div>

              <div className="h-[420px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={displayedSchedule}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorSimulatedCash" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="colorActualOutflow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0284c7" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                      tickFormatter={(value) => `₹${(value / 100000).toFixed(0)}L`}
                      dx={10}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '16px', 
                        border: '1px solid #e2e8f0', 
                        boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                        padding: '16px',
                        fontSize: '12px'
                      }}
                      labelStyle={{ fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}
                      formatter={(value: any, name: any) => [
                        <span className="font-bold text-slate-900" key="val">₹{Number(value).toLocaleString('en-IN')}</span>, 
                        <span className="text-slate-500 font-semibold" key="lbl">{name}</span>
                      ]}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      iconType="circle"
                      wrapperStyle={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}
                    />

                    {/* Stacked Bars for Gross Liability Components */}
                    <Bar 
                      dataKey="totalItcOffset" 
                      stackId="a" 
                      fill="#10b981" 
                      radius={[0, 0, 4, 4]} 
                      barSize={24}
                      name="Eligible ITC Offset"
                      opacity={0.35}
                    />
                    <Bar 
                      dataKey="netCashOutflow" 
                      stackId="a" 
                      fill="#f43f5e" 
                      radius={[4, 4, 0, 0]} 
                      name="Cash Ledger Challan"
                      opacity={0.3}
                    />

                    {/* Baseline vs Simulated Net Cash Lines */}
                    <Area 
                      type="monotone" 
                      dataKey="netCashOutflow" 
                      stroke="#6366f1" 
                      strokeWidth={3.5}
                      fill="url(#colorSimulatedCash)" 
                      name={isSimulatorMode ? "Simulated Net Cash Outflow" : "Baseline Net Cash Outflow"}
                      animationDuration={600}
                    />

                    <Area 
                      type="monotone" 
                      dataKey="actualPaidOutflow" 
                      stroke="#0284c7" 
                      strokeWidth={3}
                      fill="url(#colorActualOutflow)" 
                      name="Actual Paid Outflow (YTD)"
                      animationDuration={600}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'tax_heads' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 px-2">
                <span className="font-bold text-slate-700">Projected Tax Liability Disaggregated by Government Tax Head</span>
                <span className="font-medium text-slate-600">Interstate IGST Ratio: {interstateRatio}%</span>
              </div>

              <div className="h-[420px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={displayedSchedule}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                      tickFormatter={(value) => `₹${(value / 100000).toFixed(0)}L`}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', padding: '16px', fontSize: '12px' }}
                      formatter={(value: any, name: any) => [
                        <span className="font-bold text-slate-900" key="v">₹{Number(value).toLocaleString('en-IN')}</span>,
                        <span className="text-slate-500 font-medium" key="n">{name}</span>
                      ]}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                    <Bar dataKey="igstLiability" name="IGST (Integrated Tax)" fill="#6366f1" stackId="heads" />
                    <Bar dataKey="cgstLiability" name="CGST (Central Tax)" fill="#0ea5e9" stackId="heads" />
                    <Bar dataKey="sgstLiability" name="SGST (State Tax)" fill="#10b981" stackId="heads" />
                    <Bar dataKey="cessLiability" name="Compensation Cess" fill="#f59e0b" stackId="heads" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'liquidity' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-1">
                    <CheckCircle2 size={15} /> Optimal Liquidity Window
                  </div>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    Months where Available ITC exceeds 70% of gross liability. Working capital strain is minimal.
                  </p>
                  <div className="mt-2 text-base font-black text-emerald-900">
                    {displayedSchedule.filter(s => s.liquidityStrain === 'LOW').length} Months
                  </div>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center gap-2 text-amber-800 font-bold text-xs mb-1">
                    <AlertTriangle size={15} /> Moderate Strain Window
                  </div>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Outflow between ₹4.5L - ₹7.5L. Ensure supplier bills are paid by 10th to claim ITC before 14th cutoff.
                  </p>
                  <div className="mt-2 text-base font-black text-amber-900">
                    {displayedSchedule.filter(s => s.liquidityStrain === 'MODERATE').length} Months
                  </div>
                </div>

                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-xs mb-1">
                    <Zap size={15} /> High Working Capital Strain
                  </div>
                  <p className="text-xs text-rose-700 leading-relaxed">
                    Outflow exceeds ₹7.5L. Allocate overdraft / credit line 5 business days prior to statutory due date.
                  </p>
                  <div className="mt-2 text-base font-black text-rose-900">
                    {displayedSchedule.filter(s => s.liquidityStrain === 'HIGH').length} Months
                  </div>
                </div>
              </div>

              {/* Liquidity Timeline Progress */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Monthly Working Capital Readiness Timeline
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {displayedSchedule.map((item) => (
                    <div 
                      key={item.month} 
                      className={`p-3 rounded-xl border text-center transition-all ${
                        item.liquidityStrain === 'HIGH' 
                          ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-2xs' 
                          : item.liquidityStrain === 'MODERATE'
                          ? 'bg-amber-50 border-amber-300 text-amber-900'
                          : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    >
                      <span className="text-xs font-black block">{item.month}</span>
                      <span className="text-[10px] opacity-75 font-mono block mt-0.5">{item.dueDate}</span>
                      <div className="mt-2 font-mono font-bold text-xs">
                        ₹{(item.netCashOutflow / 100000).toFixed(1)}L
                      </div>
                      <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        item.liquidityStrain === 'HIGH' ? 'bg-rose-200 text-rose-900' :
                        item.liquidityStrain === 'MODERATE' ? 'bg-amber-200 text-amber-900' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {item.liquidityStrain}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider">
                    <th className="py-3 px-3">Month</th>
                    <th className="py-3 px-3">Due Date</th>
                    <th className="py-3 px-3 text-right">Projected Sales</th>
                    <th className="py-3 px-3 text-right">Gross Tax</th>
                    <th className="py-3 px-3 text-right">ITC Offset</th>
                    <th className="py-3 px-3 text-right">Net Cash Challan</th>
                    <th className="py-3 px-3 text-center">Strain</th>
                    <th className="py-3 px-3">Actionable Advisory</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {displayedSchedule.map((row) => (
                    <tr key={row.month} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                        {row.isHistorical && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Historical Paid" />}
                        {row.month}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500">{row.dueDate}</td>
                      <td className="py-3 px-3 text-right font-mono">₹ {(row.projectedTurnover / 100000).toFixed(2)}L</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">₹ {(row.grossLiability / 100000).toFixed(2)}L</td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-600 font-bold">
                        - ₹ {(row.totalItcOffset / 100000).toFixed(2)}L
                        {row.capexItc > 0 && <span className="block text-[9px] text-sky-600 font-normal">incl. ₹{(row.capexItc/100000).toFixed(1)}L CapEx</span>}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-rose-600 bg-rose-50/30">
                        ₹ {(row.netCashOutflow / 100000).toFixed(2)}L
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          row.liquidityStrain === 'HIGH' ? 'bg-rose-100 text-rose-700' :
                          row.liquidityStrain === 'MODERATE' ? 'bg-amber-100 text-amber-800' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {row.liquidityStrain}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-[11px] max-w-xs truncate" title={row.advisoryNote}>
                        {row.advisoryNote}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* AI Liquidity & Strategic Tax Compliance Advisor */}
      <div className="bg-white text-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start gap-4 sm:gap-5">
        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600 shrink-0">
          <Lightbulb size={24} />
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black tracking-tight text-slate-900">AI Liquidity & Working Capital Optimization Advisory</h3>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full font-bold uppercase">
              Rule 88A & Section 49 Optimized
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs text-slate-600">
            <div className="flex items-start gap-2.5 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="text-slate-900">Cross-Utilization Priority:</strong> Apply 100% of IGST input credits first against IGST output, then equally across CGST and SGST to minimize electronic cash ledger challan generation.
              </p>
            </div>

            <div className="flex items-start gap-2.5 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 size={16} className="text-sky-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="text-slate-900">CapEx Credit Window:</strong> If planned asset acquisition is shifted to Q2 (Sep), the resultant ₹{(((capexAmountQ2 || 2500000) * 0.18) / 100000).toFixed(1)}L ITC will eliminate October festive challan spikes completely.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Save Scenario Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Save Custom Forecast Scenario</h3>
            <p className="text-xs text-slate-500">
              Save current simulation parameters (Revenue {revenueAdjustment}%, ITC {itcEfficiency}%, CapEx ₹{(capexAmountQ2/100000).toFixed(0)}L) for future recall.
            </p>

            <input
              type="text"
              placeholder="e.g., Board Review Scenario FY27"
              value={newScenarioName}
              onChange={(e) => setNewScenarioName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              autoFocus
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveScenario}
                disabled={!newScenarioName.trim()}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-xs"
              >
                Save Scenario
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TaxForecastingPage;
