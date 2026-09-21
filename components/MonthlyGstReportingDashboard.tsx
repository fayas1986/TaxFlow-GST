import React, { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, Shield, AlertTriangle, Download,
  FileSpreadsheet, Printer, Calendar, MapPin, Sliders, CheckCircle2,
  Clock, ArrowUpRight, ArrowDownRight, Info, Eye, Layers, Sparkles,
  ChevronRight, RefreshCw, Filter, FileText, CheckCircle, Database,
  Activity, DollarSign, Percent, BarChart3, HelpCircle, X
} from 'lucide-react';
import {
  FINANCIAL_YEARS,
  GSTIN_ENTITIES,
  getMonthlyGstReportingData,
  getCumulativeTrajectory,
  exportMonthlyReportToExcel,
  exportMonthlyReportToCsv,
  exportMonthlyReportToPdf
} from '../services/monthlyGstReportingService';
import { MonthlyGstLiabilityData, FinancialYearReportingSummary } from '../types/monthlyReporting';
import { MonthlyGstLiabilityExportModal } from './MonthlyGstLiabilityExportComponent';
import { motion, AnimatePresence } from 'motion/react';

interface MonthlyGstReportingDashboardProps {
  tenantId?: string;
  initialFy?: string;
}

export const MonthlyGstReportingDashboard: React.FC<MonthlyGstReportingDashboardProps> = ({
  tenantId: propTenantId,
  initialFy = '2026-27'
}) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const activeTenantId = propTenantId || user?.currentTenantId || 't1';
  const currentTenant = user?.availableTenants.find(t => t.id === activeTenantId);

  // Filter States
  const [selectedFy, setSelectedFy] = useState<string>(initialFy);
  const [selectedGstin, setSelectedGstin] = useState<string>('ALL');
  const [selectedQuarter, setSelectedQuarter] = useState<'ALL' | 'Q1' | 'Q2' | 'Q3' | 'Q4'>('ALL');
  const [viewMode, setViewMode] = useState<'OVERVIEW' | 'TAX_HEADS' | 'ITC_COMPOSITION' | 'CUMULATIVE' | 'LEDGER_FLOW'>('OVERVIEW');
  const [comparisonSubMode, setComparisonSubMode] = useState<'GROUPED_COMPARE' | 'SETTLEMENT_FLOW' | 'NET_GAP' | 'HEAD_TO_HEAD'>('GROUPED_COMPARE');
  const [showProjections, setShowProjections] = useState<boolean>(true);
  
  // Simulator State (Supplier GSTR-2B Delay Risk Simulation)
  const [showSimulator, setShowSimulator] = useState<boolean>(false);
  const [supplierDelayPercent, setSupplierDelayPercent] = useState<number>(10); // 10% default simulation

  // Month Detail Drawer Modal
  const [selectedMonthDetail, setSelectedMonthDetail] = useState<MonthlyGstLiabilityData | null>(null);

  // PDF Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Compute Base Summary
  const rawSummary: FinancialYearReportingSummary = useMemo(() => {
    return getMonthlyGstReportingData(selectedFy, selectedGstin, activeTenantId, selectedQuarter);
  }, [selectedFy, selectedGstin, activeTenantId, selectedQuarter]);

  // Adjust for simulation if enabled
  const summary: FinancialYearReportingSummary = useMemo(() => {
    if (!showSimulator || supplierDelayPercent === 0) return rawSummary;

    const delayFraction = supplierDelayPercent / 100;
    let runningBalance = rawSummary.openingFyBalance;

    const simulatedMonths = rawSummary.monthlyRecords.map(m => {
      // Simulating delayed GSTR-2B filing by vendors
      const delayedItc = Math.round(m.availableItc * (1 - delayFraction));
      const delayedNetItc = Math.round(m.netItcClaimed * (1 - delayFraction));
      
      const totalPool = runningBalance + delayedNetItc;
      const simPaidViaItc = Math.min(totalPool, Math.round(m.grossLiability * (0.85 - delayFraction * 0.5)));
      const simPaidViaCash = Math.max(0, m.grossLiability - simPaidViaItc);
      const simClosing = Math.max(0, totalPool - simPaidViaItc);
      runningBalance = simClosing;

      return {
        ...m,
        availableItc: delayedItc,
        netItcClaimed: delayedNetItc,
        paidViaItc: simPaidViaItc,
        paidViaCash: simPaidViaCash,
        itcUtilizationRate: m.grossLiability > 0 ? Math.round((simPaidViaItc / m.grossLiability) * 100) : 0,
        cashPaidRate: m.grossLiability > 0 ? Math.round((simPaidViaCash / m.grossLiability) * 100) : 0,
        closingCreditBalance: simClosing,
      };
    });

    const totalPaidViaItc = simulatedMonths.reduce((s, r) => s + r.paidViaItc, 0);
    const totalPaidViaCash = simulatedMonths.reduce((s, r) => s + r.paidViaCash, 0);
    const totalAvailableItc = simulatedMonths.reduce((s, r) => s + r.availableItc, 0);

    return {
      ...rawSummary,
      totalAvailableItc,
      totalPaidViaItc,
      totalPaidViaCash,
      overallItcCoverage: rawSummary.totalGrossLiability > 0 ? Math.round((totalPaidViaItc / rawSummary.totalGrossLiability) * 100) : 0,
      monthlyRecords: simulatedMonths
    };
  }, [rawSummary, showSimulator, supplierDelayPercent]);

  // Cumulative Trajectory
  const cumulativeData = useMemo(() => {
    return getCumulativeTrajectory(summary.monthlyRecords);
  }, [summary.monthlyRecords]);

  // Selected Entity Name
  const entityName = GSTIN_ENTITIES.find(e => e.gstin === selectedGstin)?.name || selectedGstin;

  // Chart Data preparation
  const chartData = summary.monthlyRecords.map(m => ({
    month: m.shortMonth,
    monthName: m.monthName,
    quarter: m.quarter,
    isProjected: m.isProjected,
    // Output Liability
    grossLiability: m.grossLiability,
    outputIgst: m.outputIgst,
    outputCgst: m.outputCgst,
    outputSgst: m.outputSgst,
    outputCess: m.outputCess,
    // Inward ITC
    availableItc: m.availableItc,
    itcInputs: m.itcInputs,
    itcCapitalGoods: m.itcCapitalGoods,
    itcServices: m.itcServices,
    itcIgst: m.itcIgst,
    itcCgst: m.itcCgst,
    itcSgst: m.itcSgst,
    ineligibleItc17_5: m.ineligibleItc17_5,
    itcReversals: m.itcReversals,
    netItcClaimed: m.netItcClaimed,
    // Payment Discharge
    paidViaItc: m.paidViaItc,
    paidViaCash: m.paidViaCash,
    // Direct ITC vs Liability Comparison Metrics
    netTaxPayable: Math.max(0, m.grossLiability - m.availableItc),
    itcSurplus: Math.max(0, m.availableItc - m.grossLiability),
    netDelta: m.grossLiability - m.availableItc, // positive = cash liability to pay, negative = credit surplus
    itcToLiabilityRatio: m.grossLiability > 0 ? Math.round((m.availableItc / m.grossLiability) * 100) : 0,
    // Rates & Balances
    itcUtilizationRate: m.itcUtilizationRate,
    cashPaidRate: m.cashPaidRate,
    closingCreditBalance: m.closingCreditBalance,
    openingCreditBalance: m.openingCreditBalance,
    turnover: m.taxableTurnover
  }));

  // Handlers
  const handleExportExcel = () => {
    exportMonthlyReportToExcel(summary, entityName);
  };

  const handleExportCsv = () => {
    exportMonthlyReportToCsv(summary);
  };

  const handleExportPdf = () => {
    setIsExportModalOpen(true);
  };

  const selectedFyObj = FINANCIAL_YEARS.find(f => f.id === selectedFy);

  return (
    <div id="monthly-gst-reporting-dashboard" className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Control Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/20 border border-blue-400/30 rounded-2xl text-blue-300 shrink-0 shadow-inner">
              <BarChart3 size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Monthly GST Liability & ITC Trends
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-500/30 text-blue-200 border border-blue-400/30 uppercase tracking-wider">
                  {selectedFyObj?.isCurrent ? 'Current FY 2026-27' : `Historical ${selectedFy}`}
                </span>
                {showSimulator && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500/30 text-amber-200 border border-amber-400/30 uppercase tracking-wider flex items-center gap-1">
                    <Sliders size={12} /> Stress Simulation Active ({supplierDelayPercent}%)
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Fiscal year analytics visualizing monthly outward GST liability, inward GSTR-2B credit generation, Section 17(5) blocked ITC, and Electronic Credit vs Cash Ledger discharge trajectory.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 no-print shrink-0">
            <button
              type="button"
              onClick={() => setShowSimulator(prev => !prev)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                showSimulator
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
              }`}
              title="Toggle Working Capital & Delayed ITC Risk Simulator"
            >
              <Sliders size={14} />
              {showSimulator ? 'Close Simulator' : 'Scenario Simulator'}
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Export complete 12-month reconciliation to Excel"
            >
              <FileSpreadsheet size={14} />
              Excel (.xlsx)
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Download Executive Summary PDF Report"
            >
              <Download size={14} />
              Statutory PDF
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              title="Print View"
            >
              <Printer size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Simulator Panel (When activated) */}
      <AnimatePresence>
        {showSimulator && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 rounded-2xl border border-amber-300/60 bg-amber-50/40">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl shrink-0 mt-0.5 font-bold shadow-sm">
                    <Sliders size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      Supplier Compliance & Working Capital Stress Simulator
                      <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-200 text-amber-900 rounded-md">
                        Section 16(2)(aa) Rule Engine
                      </span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                      Simulate the cash flow impact when suppliers delay uploading invoices in GSTR-1, causing provisional ITC blockage in GSTR-2B and shifting tax discharge from Electronic Credit Ledger to Cash Ledger.
                    </p>
                  </div>
                </div>

                {/* Slider Control */}
                <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-sm flex items-center gap-4 w-full md:w-auto shrink-0">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>Supplier Delay Rate:</span>
                      <span className="text-amber-600 font-extrabold">{supplierDelayPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="35"
                      step="5"
                      value={supplierDelayPercent}
                      onChange={(e) => setSupplierDelayPercent(parseInt(e.target.value, 10))}
                      className="w-48 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                      <span>0% (Full 2B)</span>
                      <span>15%</span>
                      <span>35% (Severe)</span>
                    </div>
                  </div>

                  <div className="pl-3 border-l border-slate-200 text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Extra Cash Burden</span>
                    <span className="text-sm font-extrabold text-rose-600 font-mono">
                      +₹{((summary.totalPaidViaCash - rawSummary.totalPaidViaCash) / 100000).toFixed(2)}L
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
        {/* Left Side Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Financial Year Selector */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <Calendar size={15} className="text-slate-500" />
            <span className="text-xs font-bold text-slate-500 uppercase">FY:</span>
            <select
              value={selectedFy}
              onChange={(e) => setSelectedFy(e.target.value)}
              className="bg-transparent text-xs font-extrabold text-slate-800 outline-none cursor-pointer"
            >
              {FINANCIAL_YEARS.map(f => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* GSTIN / Entity Selector */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <MapPin size={15} className="text-slate-500" />
            <span className="text-xs font-bold text-slate-500 uppercase">Scope:</span>
            <select
              value={selectedGstin}
              onChange={(e) => setSelectedGstin(e.target.value)}
              className="bg-transparent text-xs font-extrabold text-slate-800 outline-none cursor-pointer max-w-[210px] truncate"
            >
              {GSTIN_ENTITIES.map(e => (
                <option key={e.gstin} value={e.gstin}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quarter Filter Pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
            {(['ALL', 'Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => (
              <button
                key={q}
                type="button"
                onClick={() => setSelectedQuarter(q)}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedQuarter === q
                    ? 'bg-white text-blue-600 shadow-xs font-extrabold'
                    : 'hover:text-slate-900'
                }`}
              >
                {q === 'ALL' ? 'Full 12M' : q}
              </button>
            ))}
          </div>
        </div>

        {/* Right Side View Mode Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
            <button
              type="button"
              onClick={() => setViewMode('OVERVIEW')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'OVERVIEW' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Liability vs ITC
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TAX_HEADS')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'TAX_HEADS' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Tax Heads
            </button>
            <button
              type="button"
              onClick={() => setViewMode('ITC_COMPOSITION')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'ITC_COMPOSITION' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              ITC Composition & 17(5)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('CUMULATIVE')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'CUMULATIVE' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Cumulative YTD
            </button>
          </div>
        </div>
      </div>

      {/* Financial Year Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Total Taxable Turnover */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-slate-100 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-[11px] font-black uppercase tracking-wider">Taxable Turnover</span>
              <span className="p-1.5 bg-slate-100 text-slate-700 rounded-lg"><Activity size={14} /></span>
            </div>
            <p className="text-xl font-black text-slate-900 mt-2 font-mono">
              ₹{(summary.totalTurnover / 10000000).toFixed(2)} Cr
            </p>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-[11px]">
            <span className="text-slate-500 font-medium">Blended Tax Rate</span>
            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">~18.0%</span>
          </div>
        </div>

        {/* Total Gross Output Liability */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-[11px] font-black uppercase tracking-wider">Gross Output Tax</span>
              <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><TrendingUp size={14} /></span>
            </div>
            <p className="text-xl font-black text-rose-600 mt-2 font-mono">
              ₹{(summary.totalGrossLiability / 100000).toFixed(2)} L
            </p>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-[11px]">
            <span className="text-slate-500 font-medium">Monthly Avg</span>
            <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md font-mono">
              ₹{(summary.totalGrossLiability / (summary.monthlyRecords.length * 100000)).toFixed(2)}L/mo
            </span>
          </div>
        </div>

        {/* Total Available Inward ITC */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-[11px] font-black uppercase tracking-wider">Available ITC (2B)</span>
              <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Wallet size={14} /></span>
            </div>
            <p className="text-xl font-black text-emerald-600 mt-2 font-mono">
              ₹{(summary.totalAvailableItc / 100000).toFixed(2)} L
            </p>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-[11px]">
            <span className="text-slate-500 font-medium">Gross Avail Rate</span>
            <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">94.2%</span>
          </div>
        </div>

        {/* Paid via Electronic Credit Ledger */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-[11px] font-black uppercase tracking-wider">Settled via ITC</span>
              <span className="p-1.5 bg-teal-50 text-teal-600 rounded-lg"><CheckCircle2 size={14} /></span>
            </div>
            <p className="text-xl font-black text-teal-700 mt-2 font-mono">
              ₹{(summary.totalPaidViaItc / 100000).toFixed(2)} L
            </p>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-[11px]">
            <span className="text-slate-500 font-medium">Coverage Ratio</span>
            <span className="font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
              {summary.overallItcCoverage}%
            </span>
          </div>
        </div>

        {/* Net Cash Paid (Challan) */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-[11px] font-black uppercase tracking-wider">Net Cash Tax Paid</span>
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><DollarSign size={14} /></span>
            </div>
            <p className="text-xl font-black text-blue-600 mt-2 font-mono">
              ₹{(summary.totalPaidViaCash / 100000).toFixed(2)} L
            </p>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-[11px]">
            <span className="text-slate-500 font-medium">Cash Ratio</span>
            <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
              {100 - summary.overallItcCoverage}% Cash
            </span>
          </div>
        </div>

        {/* Blocked ITC u/s 17(5) */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-[11px] font-black uppercase tracking-wider">Blocked u/s 17(5)</span>
              <span className="p-1.5 bg-amber-50 text-amber-700 rounded-lg"><AlertTriangle size={14} /></span>
            </div>
            <p className="text-xl font-black text-amber-700 mt-2 font-mono">
              ₹{(summary.totalIneligibleItc / 1000).toFixed(0)} k
            </p>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-[11px]">
            <span className="text-slate-500 font-medium">Ineligible %</span>
            <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
              {summary.totalAvailableItc > 0 ? ((summary.totalIneligibleItc / summary.totalAvailableItc) * 100).toFixed(1) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Main Visual Charts Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-6">
        {/* Chart Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              {viewMode === 'OVERVIEW' && (
                <>
                  <TrendingUp size={20} className="text-blue-600" />
                  {comparisonSubMode === 'GROUPED_COMPARE' && 'Input Tax Credit (ITC) vs. Output Tax Liability Comparison'}
                  {comparisonSubMode === 'NET_GAP' && 'Monthly Net Tax Gap (Cash Liability vs. Credit Surplus)'}
                  {comparisonSubMode === 'SETTLEMENT_FLOW' && 'Statutory Tax Liability Discharge Flow (ITC vs. Cash)'}
                  {comparisonSubMode === 'HEAD_TO_HEAD' && 'Tax Head-by-Head Comparison (IGST, CGST, SGST)'}
                </>
              )}
              {viewMode === 'TAX_HEADS' && <><Layers size={20} className="text-purple-600" /> Monthly Tax Head Segregation (IGST, CGST, SGST, Cess)</>}
              {viewMode === 'ITC_COMPOSITION' && <><Wallet size={20} className="text-emerald-600" /> Inward ITC Breakdown & Section 17(5) Blocked Credits</>}
              {viewMode === 'CUMULATIVE' && <><Activity size={20} className="text-indigo-600" /> Financial Year Cumulative Trajectory (YTD)</>}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {viewMode === 'OVERVIEW' && 'Interactive comparison of outward supply tax liability against GSTR-2B eligible ITC credits, net payable cash obligations, and set-off efficiency.'}
              {viewMode === 'TAX_HEADS' && 'Integrated Tax (inter-state), Central Tax, and State Tax monthly distributions for outward supplies.'}
              {viewMode === 'ITC_COMPOSITION' && 'Detailed breakdown of Inputs, Capital Goods, and Input Services alongside statutory Blocked Ineligible ITC u/s 17(5).'}
              {viewMode === 'CUMULATIVE' && 'Cumulative year-to-date trajectory of total taxable turnover, gross tax, ITC accrued, and net cash paid.'}
            </p>
          </div>

          {/* Sub-mode Toggles when in Overview */}
          {viewMode === 'OVERVIEW' && (
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setComparisonSubMode('GROUPED_COMPARE')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  comparisonSubMode === 'GROUPED_COMPARE' ? 'bg-white text-blue-600 shadow-xs font-extrabold' : 'hover:text-slate-900'
                }`}
              >
                Side-by-Side Dual Bars
              </button>
              <button
                type="button"
                onClick={() => setComparisonSubMode('NET_GAP')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  comparisonSubMode === 'NET_GAP' ? 'bg-white text-blue-600 shadow-xs font-extrabold' : 'hover:text-slate-900'
                }`}
              >
                Net Differential Gap
              </button>
              <button
                type="button"
                onClick={() => setComparisonSubMode('SETTLEMENT_FLOW')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  comparisonSubMode === 'SETTLEMENT_FLOW' ? 'bg-white text-blue-600 shadow-xs font-extrabold' : 'hover:text-slate-900'
                }`}
              >
                Set-off & Discharge
              </button>
              <button
                type="button"
                onClick={() => setComparisonSubMode('HEAD_TO_HEAD')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  comparisonSubMode === 'HEAD_TO_HEAD' ? 'bg-white text-blue-600 shadow-xs font-extrabold' : 'hover:text-slate-900'
                }`}
              >
                Head-to-Head Heads
              </button>
            </div>
          )}
        </div>

        {/* Chart Canvas */}
        <div className="h-[420px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'OVERVIEW' ? (
              comparisonSubMode === 'GROUPED_COMPARE' ? (
                <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }}
                    dy={10}
                  />
                  <YAxis
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(val) => `₹${(val / 100000).toFixed(1)}L`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 150]}
                    tick={{ fill: '#8b5cf6', fontSize: 11 }}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{
                      borderRadius: '16px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                      padding: '14px',
                      backgroundColor: '#ffffff'
                    }}
                    formatter={(value: any, name: any) => {
                      if (name === 'ITC to Liability Ratio') return [`${value}%`, name];
                      return [`₹${Number(value).toLocaleString()} (${((Number(value) / 100000).toFixed(2))} L)`, name];
                    }}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload;
                      return `${item?.monthName || label} (${item?.isProjected ? 'Model Projection' : 'Statutory Filed'})`;
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                  
                  {/* Gross Output Tax Bar */}
                  <Bar
                    yAxisId="left"
                    dataKey="grossLiability"
                    name="Output Tax Liability"
                    fill="#e11d48"
                    radius={[6, 6, 0, 0]}
                    barSize={20}
                  />

                  {/* Available ITC Bar */}
                  <Bar
                    yAxisId="left"
                    dataKey="availableItc"
                    name="Input Tax Credit (ITC)"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                    barSize={20}
                  />

                  {/* Net Cash Tax to Pay */}
                  <Bar
                    yAxisId="left"
                    dataKey="paidViaCash"
                    name="Net Cash Tax Paid"
                    fill="#2563eb"
                    radius={[6, 6, 0, 0]}
                    barSize={20}
                  />

                  {/* ITC to Liability Ratio % Line */}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="itcToLiabilityRatio"
                    name="ITC to Liability Ratio"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#8b5cf6' }}
                  />
                </ComposedChart>
              ) : comparisonSubMode === 'NET_GAP' ? (
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(val) => `₹${(val / 100000).toFixed(1)}L`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', padding: '14px' }}
                    formatter={(val: any, name: any) => [`₹${Number(val).toLocaleString()} (${((Number(val)/100000).toFixed(2))}L)`, name]}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                  <ReferenceLine y={0} stroke="#94a3b8" />
                  <Bar dataKey="grossLiability" name="Output Liability" fill="#e11d48" barSize={22} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="availableItc" name="Available ITC" fill="#10b981" barSize={22} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="netTaxPayable" name="Net Cash Shortfall" fill="#f59e0b" barSize={22} radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : comparisonSubMode === 'HEAD_TO_HEAD' ? (
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(val) => `₹${(val / 100000).toFixed(1)}L`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', padding: '14px' }}
                    formatter={(val: any, name: any) => [`₹${Number(val).toLocaleString()}`, name]}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                  <Bar dataKey="outputIgst" name="Output IGST" fill="#e11d48" barSize={16} />
                  <Bar dataKey="itcIgst" name="ITC IGST" fill="#10b981" barSize={16} />
                  <Bar dataKey="outputCgst" name="Output CGST/SGST" fill="#d97706" barSize={16} />
                  <Bar dataKey="itcCgst" name="ITC CGST/SGST" fill="#06b6d4" barSize={16} />
                </BarChart>
              ) : (
                <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(val) => `₹${(val / 100000).toFixed(1)}L`}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{
                      borderRadius: '16px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                      padding: '14px',
                      backgroundColor: '#ffffff'
                    }}
                    formatter={(value: any, name: any) => [
                      `₹${Number(value).toLocaleString()} (${((Number(value) / 100000).toFixed(2))} Lakhs)`,
                      name
                    ]}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                  <Bar dataKey="grossLiability" name="Gross Output Liability" fill="#334155" radius={[6, 6, 0, 0]} barSize={24} />
                  <Bar dataKey="paidViaItc" name="Discharged via ITC Credit" fill="#10b981" radius={[6, 6, 0, 0]} barSize={24} />
                  <Bar dataKey="paidViaCash" name="Net Cash Paid (Challan)" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={24} />
                  <Line type="monotone" dataKey="availableItc" name="Available Inward ITC (2B)" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6' }} />
                </ComposedChart>
              )
            ) : viewMode === 'TAX_HEADS' ? (
              <BarChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={(val) => `₹${(val / 100000).toFixed(1)}L`}
                />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    padding: '14px'
                  }}
                  formatter={(value: any, name: any) => [`₹${Number(value).toLocaleString()}`, name]}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                <Bar dataKey="outputIgst" name="Integrated Tax (IGST)" fill="#8b5cf6" stackId="a" barSize={34} />
                <Bar dataKey="outputCgst" name="Central Tax (CGST)" fill="#06b6d4" stackId="a" barSize={34} />
                <Bar dataKey="outputSgst" name="State Tax (SGST)" fill="#f59e0b" stackId="a" barSize={34} />
                <Bar dataKey="outputCess" name="GST Cess" fill="#ec4899" stackId="a" radius={[6, 6, 0, 0]} barSize={34} />
              </BarChart>
            ) : viewMode === 'ITC_COMPOSITION' ? (
              <BarChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={(val) => `₹${(val / 100000).toFixed(1)}L`}
                />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    padding: '14px'
                  }}
                  formatter={(value: any, name: any) => [`₹${Number(value).toLocaleString()}`, name]}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                <Bar dataKey="itcInputs" name="Eligible Inputs" fill="#10b981" stackId="a" barSize={34} />
                <Bar dataKey="itcServices" name="Input Services" fill="#06b6d4" stackId="a" barSize={34} />
                <Bar dataKey="itcCapitalGoods" name="Capital Goods" fill="#3b82f6" stackId="a" barSize={34} />
                <Bar dataKey="ineligibleItc17_5" name="Blocked u/s 17(5)" fill="#f43f5e" stackId="a" radius={[6, 6, 0, 0]} barSize={34} />
              </BarChart>
            ) : (
              <AreaChart data={cumulativeData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                <defs>
                  <linearGradient id="colorCumTurnover" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#64748b" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCumLiability" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCumItc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={(val) => `₹${val}L`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    padding: '14px'
                  }}
                  formatter={(value: any, name: any) => [`₹${Number(value)} Lakhs`, name]}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                <Area
                  type="monotone"
                  dataKey="cumLiability"
                  name="Cumulative Gross Output Tax (₹ Lakhs)"
                  stroke="#e11d48"
                  fillOpacity={1}
                  fill="url(#colorCumLiability)"
                  strokeWidth={2.5}
                />
                <Area
                  type="monotone"
                  dataKey="cumItc"
                  name="Cumulative Available ITC (₹ Lakhs)"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorCumItc)"
                  strokeWidth={2.5}
                />
                <Line
                  type="monotone"
                  dataKey="cumCash"
                  name="Cumulative Cash Paid (₹ Lakhs)"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Secondary Analytics: ITC Efficiency Trend & Electronic Credit Ledger Trajectory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly ITC Coverage Rate % */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Percent size={18} className="text-emerald-600" />
                Monthly ITC Set-Off Efficiency %
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Proportion of output tax settled via Electronic Credit Ledger vs Cash.
              </p>
            </div>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-extrabold text-xs rounded-lg border border-emerald-200">
              FY Mean: {summary.overallItcCoverage}%
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis domain={[50, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'ITC Utilization %']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                />
                <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Target 80%', fill: '#d97706', fontSize: 10 }} />
                <Line
                  type="monotone"
                  dataKey="itcUtilizationRate"
                  name="ITC Offset %"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#10b981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Electronic Credit Ledger Closing Balances */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Database size={18} className="text-indigo-600" />
                Electronic Credit Ledger Closing Balances
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Available unutilized ITC carried forward to subsequent tax periods.
              </p>
            </div>
            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-extrabold text-xs rounded-lg border border-indigo-200">
              Closing: ₹{(summary.closingFyBalance / 100000).toFixed(2)}L
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 10 }}>
                <defs>
                  <linearGradient id="colorCreditBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Closing Credit Ledger Balance']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                />
                <Area
                  type="monotone"
                  dataKey="closingCreditBalance"
                  name="Closing Balance (₹)"
                  stroke="#6366f1"
                  fill="url(#colorCreditBalance)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Month-by-Month Detailed Statutory Audit Matrix Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <FileText size={20} className="text-blue-600" />
              Month-by-Month Statutory Audit Schedule ({summary.financialYear})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive GSTR-1, GSTR-2B, and GSTR-3B Table 4 & Table 6.1 settlement audit log.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" /> Export Schedule (.xlsx)
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={14} /> CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-100 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="p-4 pl-6">Tax Period</th>
                <th className="p-4">Statutory Status</th>
                <th className="p-4 text-right">Taxable Turnover</th>
                <th className="p-4 text-right">Gross Output Tax</th>
                <th className="p-4 text-right">Available ITC (2B)</th>
                <th className="p-4 text-right">Blocked u/s 17(5)</th>
                <th className="p-4 text-right">Paid via ITC</th>
                <th className="p-4 text-right">Paid in Cash</th>
                <th className="p-4 text-center">Coverage</th>
                <th className="p-4 text-right">Closing Balance</th>
                <th className="p-4 pr-6 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.monthlyRecords.map((m) => {
                return (
                  <tr
                    key={m.monthKey}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => setSelectedMonthDetail(m)}
                  >
                    <td className="p-4 pl-6">
                      <div className="font-extrabold text-slate-900 flex items-center gap-2">
                        {m.monthName}
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                          {m.quarter}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {m.arn ? `ARN: ${m.arn}` : m.isProjected ? 'Forecast model' : 'Draft stage'}
                      </div>
                    </td>

                    <td className="p-4">
                      {m.filingStatus === 'FILED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200">
                          <CheckCircle2 size={12} /> Filed on {m.gstr3bFilingDate?.split('-')[2]}th
                        </span>
                      ) : m.filingStatus === 'AUTO_DRAFTED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-200">
                          <Clock size={12} /> Auto-Drafted (2B)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg border border-slate-200">
                          <Activity size={12} /> Model Projection
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-right font-bold text-slate-800 font-mono">
                      ₹{(m.taxableTurnover / 100000).toFixed(2)} L
                    </td>

                    <td className="p-4 text-right font-extrabold text-rose-600 font-mono">
                      ₹{(m.grossLiability / 100000).toFixed(2)} L
                    </td>

                    <td className="p-4 text-right font-extrabold text-emerald-600 font-mono">
                      ₹{(m.availableItc / 100000).toFixed(2)} L
                    </td>

                    <td className="p-4 text-right font-bold text-amber-700 font-mono text-xs">
                      ₹{(m.ineligibleItc17_5 / 1000).toFixed(0)} k
                    </td>

                    <td className="p-4 text-right font-extrabold text-teal-700 font-mono">
                      ₹{(m.paidViaItc / 100000).toFixed(2)} L
                    </td>

                    <td className="p-4 text-right font-extrabold text-blue-600 font-mono">
                      ₹{(m.paidViaCash / 100000).toFixed(2)} L
                    </td>

                    <td className="p-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                        m.itcUtilizationRate >= 85 ? 'bg-emerald-100 text-emerald-800' :
                        m.itcUtilizationRate >= 75 ? 'bg-blue-100 text-blue-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {m.itcUtilizationRate}%
                      </span>
                    </td>

                    <td className="p-4 text-right font-mono font-bold text-slate-700 text-xs">
                      ₹{(m.closingCreditBalance / 100000).toFixed(2)} L
                    </td>

                    <td className="p-4 pr-6 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMonthDetail(m);
                        }}
                        className="px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Total Footer */}
            <tfoot className="bg-slate-900 text-white font-extrabold text-xs">
              <tr>
                <td className="p-4 pl-6" colSpan={2}>
                  TOTALS FOR {summary.financialYear} ({summary.monthlyRecords.length} MONTHS)
                </td>
                <td className="p-4 text-right font-mono text-sm text-white">
                  ₹{(summary.totalTurnover / 10000000).toFixed(2)} Cr
                </td>
                <td className="p-4 text-right font-mono text-sm text-rose-400">
                  ₹{(summary.totalGrossLiability / 100000).toFixed(2)} L
                </td>
                <td className="p-4 text-right font-mono text-sm text-emerald-400">
                  ₹{(summary.totalAvailableItc / 100000).toFixed(2)} L
                </td>
                <td className="p-4 text-right font-mono text-sm text-amber-300">
                  ₹{(summary.totalIneligibleItc / 1000).toFixed(0)} k
                </td>
                <td className="p-4 text-right font-mono text-sm text-teal-300">
                  ₹{(summary.totalPaidViaItc / 100000).toFixed(2)} L
                </td>
                <td className="p-4 text-right font-mono text-sm text-blue-400">
                  ₹{(summary.totalPaidViaCash / 100000).toFixed(2)} L
                </td>
                <td className="p-4 text-center font-mono text-sm text-white">
                  {summary.overallItcCoverage}%
                </td>
                <td className="p-4 text-right font-mono text-sm text-slate-300">
                  ₹{(summary.closingFyBalance / 100000).toFixed(2)} L
                </td>
                <td className="p-4 pr-6 text-center text-slate-400">
                  -
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Month Detail Drawer Modal */}
      <AnimatePresence>
        {selectedMonthDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-xl font-black">{selectedMonthDetail.monthName} Tax Audit Breakdown</h3>
                    <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 rounded-full text-xs font-bold border border-blue-400/30">
                      {selectedMonthDetail.quarter}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    GSTR-1 Outward Supplies vs GSTR-2B Inward Credits & Table 6.1 Set-off Analysis
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMonthDetail(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6">
                {/* 3-Column Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-rose-50 rounded-xl border border-rose-200">
                    <span className="text-[11px] font-extrabold text-rose-700 uppercase">Gross Output Tax</span>
                    <p className="text-xl font-black text-rose-800 mt-1 font-mono">
                      ₹{selectedMonthDetail.grossLiability.toLocaleString()}
                    </p>
                    <span className="text-[11px] text-rose-600 mt-1 block">From ₹{(selectedMonthDetail.taxableTurnover/100000).toFixed(2)}L Turnover</span>
                  </div>

                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <span className="text-[11px] font-extrabold text-emerald-700 uppercase">Settled via ITC</span>
                    <p className="text-xl font-black text-emerald-800 mt-1 font-mono">
                      ₹{selectedMonthDetail.paidViaItc.toLocaleString()}
                    </p>
                    <span className="text-[11px] text-emerald-600 mt-1 block">{selectedMonthDetail.itcUtilizationRate}% Coverage</span>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <span className="text-[11px] font-extrabold text-blue-700 uppercase">Paid in Cash</span>
                    <p className="text-xl font-black text-blue-800 mt-1 font-mono">
                      ₹{selectedMonthDetail.paidViaCash.toLocaleString()}
                    </p>
                    <span className="text-[11px] text-blue-600 mt-1 block">{selectedMonthDetail.cashPaidRate}% of Liability</span>
                  </div>
                </div>

                {/* Tax Head Breakdowns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Outward Tax Heads */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-rose-600" /> Outward Tax Heads (GSTR-1)
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="font-semibold text-slate-600">Integrated Tax (IGST):</span>
                        <span className="font-mono font-bold text-slate-900">₹{selectedMonthDetail.outputIgst.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="font-semibold text-slate-600">Central Tax (CGST):</span>
                        <span className="font-mono font-bold text-slate-900">₹{selectedMonthDetail.outputCgst.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="font-semibold text-slate-600">State Tax (SGST):</span>
                        <span className="font-mono font-bold text-slate-900">₹{selectedMonthDetail.outputSgst.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="font-semibold text-slate-600">GST Cess:</span>
                        <span className="font-mono font-bold text-slate-900">₹{selectedMonthDetail.outputCess.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Inward ITC Heads & Blocked */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                      <Wallet size={14} className="text-emerald-600" /> Inward ITC Breakdown (GSTR-2B)
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="font-semibold text-slate-600">Inputs (Goods):</span>
                        <span className="font-mono font-bold text-emerald-700">₹{selectedMonthDetail.itcInputs.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="font-semibold text-slate-600">Input Services:</span>
                        <span className="font-mono font-bold text-emerald-700">₹{selectedMonthDetail.itcServices.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="font-semibold text-slate-600">Capital Goods:</span>
                        <span className="font-mono font-bold text-emerald-700">₹{selectedMonthDetail.itcCapitalGoods.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-1 text-rose-600 font-bold">
                        <span>Blocked u/s 17(5):</span>
                        <span className="font-mono">₹{selectedMonthDetail.ineligibleItc17_5.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ledger Transition */}
                <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 font-bold block">Opening Credit Ledger</span>
                    <span className="font-mono font-extrabold text-slate-800 text-sm">
                      ₹{selectedMonthDetail.openingCreditBalance.toLocaleString()}
                    </span>
                  </div>
                  <ChevronRight size={18} className="text-indigo-400" />
                  <div>
                    <span className="text-emerald-700 font-bold block">+ Availed in Period</span>
                    <span className="font-mono font-extrabold text-emerald-700 text-sm">
                      +₹{selectedMonthDetail.netItcClaimed.toLocaleString()}
                    </span>
                  </div>
                  <ChevronRight size={18} className="text-indigo-400" />
                  <div>
                    <span className="text-rose-700 font-bold block">- Utilized in 3B</span>
                    <span className="font-mono font-extrabold text-rose-700 text-sm">
                      -₹{selectedMonthDetail.paidViaItc.toLocaleString()}
                    </span>
                  </div>
                  <ChevronRight size={18} className="text-indigo-400" />
                  <div>
                    <span className="text-indigo-900 font-bold block">= Closing Ledger</span>
                    <span className="font-mono font-extrabold text-indigo-900 text-sm">
                      ₹{selectedMonthDetail.closingCreditBalance.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedMonthDetail(null)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Close Inspection
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Monthly GST Liability & ITC PDF Export Modal */}
      <MonthlyGstLiabilityExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        initialSummary={summary}
        tenantName={currentTenant?.name || 'TaxFlow Enterprise Ltd'}
      />
    </div>
  );
};

export default MonthlyGstReportingDashboard;
