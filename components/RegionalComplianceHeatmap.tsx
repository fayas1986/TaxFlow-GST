import React, { useState, useMemo } from 'react';
import { 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  Search, 
  Filter, 
  Layers, 
  RefreshCw, 
  Download, 
  ArrowUpRight, 
  ShieldAlert, 
  Activity, 
  FileText, 
  SlidersHorizontal,
  X,
  Building2,
  Database,
  Check,
  Zap,
  ChevronRight,
  Info,
  Radio,
  Eye,
  Scale
} from 'lucide-react';
import { INITIAL_INDIA_GST_STATE_DATA, StateGstData } from '../data/indiaGstStateData';
import GeoGstMapVisualization from './GeoGstMapVisualization';

export type HeatmapMetricKey = 'errorRate' | 'pendingRecon' | 'complianceScore' | 'taxLiability' | 'activeGstins';

export interface ExtendedStateData extends StateGstData {
  errorRate: number; // % of total invoices with validation/GST errors
  pendingReconCount: number; // number of invoices pending GSTR-2B recon
  pendingReconValue: number; // in INR
  gstinList: Array<{
    gstin: string;
    tradeName: string;
    type: 'SEZ' | 'REGULAR' | 'COMPOSITION' | 'ISD';
    errorCount: number;
    pendingReconValue: number;
    status: 'ACTIVE' | 'SUSPENDED' | 'PROVISIONAL';
  }>;
  recentErrors: Array<{
    code: string;
    description: string;
    category: 'POS_MISMATCH' | 'HSN_INVALID' | 'ITC_DISCREPANCY' | 'EWAY_EXPIRED' | 'IRN_MISSING';
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    count: number;
  }>;
}

// Enhance initial state data with error rates and pending recon metrics
const ENHANCED_STATE_DATA: Record<string, ExtendedStateData> = Object.entries(INITIAL_INDIA_GST_STATE_DATA).reduce((acc, [code, item]) => {
  // Generate deterministic realistic metrics based on state code
  const codeNum = parseInt(code, 10) || 10;
  
  // Higher error rates for certain states to demonstrate visual contrast in heatmap
  const isHighRisk = ['09', '10', '19', '21', '08'].includes(code);
  const isMediumRisk = ['07', '24', '33', '36', '06'].includes(code);

  const errorRate = isHighRisk 
    ? parseFloat((5.8 + (codeNum % 4) * 0.9).toFixed(2))
    : isMediumRisk 
    ? parseFloat((2.6 + (codeNum % 3) * 0.6).toFixed(2))
    : parseFloat((0.4 + (codeNum % 3) * 0.4).toFixed(2));

  const pendingReconCount = Math.floor(item.activeGstins * (isHighRisk ? 3.5 : isMediumRisk ? 2.1 : 0.8));
  const pendingReconValue = Math.floor(item.taxLiability * (isHighRisk ? 0.38 : isMediumRisk ? 0.22 : 0.08));

  const gstinList = [
    {
      gstin: `${code}AAAAA${codeNum}000A1Z${(codeNum % 9) + 1}`,
      tradeName: `${item.stateName} Primary Enterprise HQ`,
      type: 'REGULAR' as const,
      errorCount: isHighRisk ? 42 : isMediumRisk ? 12 : 2,
      pendingReconValue: Math.floor(pendingReconValue * 0.5),
      status: 'ACTIVE' as const
    },
    {
      gstin: `${code}BBBBB${codeNum + 1}111B1Z${((codeNum + 2) % 9) + 1}`,
      tradeName: `${item.stateName} Manufacturing & Logistics Unit`,
      type: 'REGULAR' as const,
      errorCount: isHighRisk ? 28 : isMediumRisk ? 8 : 1,
      pendingReconValue: Math.floor(pendingReconValue * 0.3),
      status: 'ACTIVE' as const
    },
    {
      gstin: `${code}CCCCC${codeNum + 2}222C1Z${((codeNum + 4) % 9) + 1}`,
      tradeName: `${item.stateName} SEZ Export Zone Facility`,
      type: 'SEZ' as const,
      errorCount: isHighRisk ? 15 : isMediumRisk ? 3 : 0,
      pendingReconValue: Math.floor(pendingReconValue * 0.2),
      status: 'ACTIVE' as const
    }
  ];

  const recentErrors = [
    {
      code: 'ERR-POS-201',
      description: 'Place of Supply (POS) state code mismatch between Invoice & Customer Master',
      category: 'POS_MISMATCH' as const,
      severity: 'HIGH' as const,
      count: isHighRisk ? 34 : 8
    },
    {
      code: 'ERR-ITC-404',
      description: 'GSTR-2B Auto-Drafted ITC not found in Supplier GSTR-1 filings',
      category: 'ITC_DISCREPANCY' as const,
      severity: 'HIGH' as const,
      count: isHighRisk ? 56 : 14
    },
    {
      code: 'ERR-HSN-102',
      description: 'HSN/SAC 6-digit mandatory code format invalid for >₹5 Cr turnover GSTIN',
      category: 'HSN_INVALID' as const,
      severity: 'MEDIUM' as const,
      count: isHighRisk ? 18 : 5
    },
    {
      code: 'ERR-EWAY-305',
      description: 'E-Way Bill validity expired prior to inward gate-entry confirmation',
      category: 'EWAY_EXPIRED' as const,
      severity: 'MEDIUM' as const,
      count: isHighRisk ? 12 : 3
    }
  ];

  acc[code] = {
    ...item,
    errorRate,
    pendingReconCount,
    pendingReconValue,
    gstinList,
    recentErrors
  };

  return acc;
}, {} as Record<string, ExtendedStateData>);

export const RegionalComplianceHeatmap: React.FC = () => {
  const [selectedMetric, setSelectedMetric] = useState<HeatmapMetricKey>('errorRate');
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'GRID' | 'MAP'>('GRID');
  const [selectedState, setSelectedState] = useState<ExtendedStateData | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconSuccessMsg, setReconSuccessMsg] = useState<string | null>(null);

  const allStatesList = useMemo(() => Object.values(ENHANCED_STATE_DATA), []);

  const filteredStates = useMemo(() => {
    return allStatesList.filter((st) => {
      const matchesZone = selectedZone === 'ALL' || st.zone === selectedZone;
      const matchesSearch =
        st.stateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.stateCode.includes(searchQuery);
      return matchesZone && matchesSearch;
    });
  }, [allStatesList, selectedZone, searchQuery]);

  // Aggregate KPI Calculations
  const stats = useMemo(() => {
    const list = allStatesList;
    const totalStates = list.length;
    const highRiskCount = list.filter((s) => s.errorRate >= 4.0 || s.pendingReconValue >= 15000000).length;
    const totalPendingReconValue = list.reduce((sum, s) => sum + s.pendingReconValue, 0);
    const totalPendingInvoices = list.reduce((sum, s) => sum + s.pendingReconCount, 0);
    const avgErrorRate = list.reduce((sum, s) => sum + s.errorRate, 0) / (totalStates || 1);
    const avgCompliance = list.reduce((sum, s) => sum + s.complianceScore, 0) / (totalStates || 1);

    const sortedByError = [...list].sort((a, b) => b.errorRate - a.errorRate);
    const highestRiskState = sortedByError[0];

    return {
      totalStates,
      highRiskCount,
      totalPendingReconValue,
      totalPendingInvoices,
      avgErrorRate,
      avgCompliance,
      highestRiskState
    };
  }, [allStatesList]);

  // Determine intensity color styling based on active metric
  const getIntensityStyle = (state: ExtendedStateData) => {
    if (selectedMetric === 'errorRate') {
      if (state.errorRate >= 5.0) {
        return {
          cardBg: 'bg-rose-950/40 border-rose-500/60 text-rose-200 hover:border-rose-400',
          badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          intensityLabel: 'CRITICAL ERROR RATE',
          intensityColor: '#ef4444'
        };
      } else if (state.errorRate >= 2.5) {
        return {
          cardBg: 'bg-amber-950/40 border-amber-500/60 text-amber-200 hover:border-amber-400',
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          intensityLabel: 'MODERATE ERRORS',
          intensityColor: '#f59e0b'
        };
      } else {
        return {
          cardBg: 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200 hover:border-emerald-400',
          badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          intensityLabel: 'LOW ERROR RATE',
          intensityColor: '#10b981'
        };
      }
    } else if (selectedMetric === 'pendingRecon') {
      if (state.pendingReconValue >= 18000000) {
        return {
          cardBg: 'bg-rose-950/40 border-rose-500/60 text-rose-200 hover:border-rose-400',
          badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          intensityLabel: 'HEAVY RECON BACKLOG',
          intensityColor: '#f43f5e'
        };
      } else if (state.pendingReconValue >= 8000000) {
        return {
          cardBg: 'bg-amber-950/40 border-amber-500/60 text-amber-200 hover:border-amber-400',
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          intensityLabel: 'PENDING RECON',
          intensityColor: '#eab308'
        };
      } else {
        return {
          cardBg: 'bg-blue-950/30 border-blue-500/40 text-blue-200 hover:border-blue-400',
          badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
          intensityLabel: 'RECON UP-TO-DATE',
          intensityColor: '#3b82f6'
        };
      }
    } else if (selectedMetric === 'complianceScore') {
      if (state.complianceScore < 90) {
        return {
          cardBg: 'bg-rose-950/40 border-rose-500/60 text-rose-200 hover:border-rose-400',
          badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          intensityLabel: 'POOR SCORE (<90%)',
          intensityColor: '#f43f5e'
        };
      } else if (state.complianceScore < 96) {
        return {
          cardBg: 'bg-amber-950/40 border-amber-500/60 text-amber-200 hover:border-amber-400',
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          intensityLabel: 'FAIR SCORE (90-95%)',
          intensityColor: '#f59e0b'
        };
      } else {
        return {
          cardBg: 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200 hover:border-emerald-400',
          badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          intensityLabel: 'OPTIMAL (>96%)',
          intensityColor: '#10b981'
        };
      }
    } else {
      return {
        cardBg: 'bg-slate-800/80 border-slate-700 text-slate-200 hover:border-slate-500',
        badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
        intensityLabel: 'STANDARD METRIC',
        intensityColor: '#6366f1'
      };
    }
  };

  const handleRunStateReconciliation = (stateName: string) => {
    setIsReconciling(true);
    setReconSuccessMsg(null);
    setTimeout(() => {
      setIsReconciling(false);
      setReconSuccessMsg(`Automated GSTR-2B vs ERP reconciliation completed for ${stateName}. 14 mismatch exceptions auto-resolved!`);
      setTimeout(() => setReconSuccessMsg(null), 5000);
    }, 1200);
  };

  return (
    <div className="space-y-6 font-sans text-slate-100">
      {/* KPI Header Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: High Risk States */}
        <div className="bg-slate-800/90 rounded-2xl border border-rose-500/40 p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-rose-400">
              <ShieldAlert size={16} /> High Risk States
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              CRITICAL ATTENTION
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-3xl font-black text-white font-mono">
              {stats.highRiskCount} <span className="text-sm text-slate-400 font-sans font-medium">/ {stats.totalStates}</span>
            </div>
            <div className="text-[11px] text-rose-400 font-bold flex items-center gap-1">
              Top: {stats.highestRiskState?.stateName} ({stats.highestRiskState?.errorRate}%)
            </div>
          </div>
          <div className="mt-2 text-[10px] text-slate-400">
            States exceeding 4% error threshold or ₹1.5 Cr pending recon backlog.
          </div>
        </div>

        {/* KPI 2: Pending Recon Backlog */}
        <div className="bg-slate-800/90 rounded-2xl border border-amber-500/40 p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-amber-400">
              <Scale size={16} /> Pending Recon Value
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              GSTR-2B VS ERP
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-3xl font-black text-amber-300 font-mono">
              ₹{(stats.totalPendingReconValue / 10000000).toFixed(2)} <span className="text-sm font-sans font-medium text-slate-400">Cr</span>
            </div>
            <div className="text-[11px] text-amber-400 font-mono font-bold">
              {stats.totalPendingInvoices.toLocaleString()} inv
            </div>
          </div>
          <div className="mt-2 text-[10px] text-slate-400">
            Unclaimed ITC awaiting supplier GSTR-1 filing reconciliation.
          </div>
        </div>

        {/* KPI 3: National Avg Error Rate */}
        <div className="bg-slate-800/90 rounded-2xl border border-slate-700/80 p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-blue-400">
              <Activity size={16} /> National Error Rate
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              AVERAGE
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-3xl font-black text-white font-mono">
              {stats.avgErrorRate.toFixed(2)}%
            </div>
            <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-0.5">
              <TrendingUp size={12} /> -0.4% MoM
            </div>
          </div>
          <div className="mt-2 text-[10px] text-slate-400">
            Invoices flagged with POS, HSN, or Tax Calculation exceptions.
          </div>
        </div>

        {/* KPI 4: Overall Compliance Health */}
        <div className="bg-slate-800/90 rounded-2xl border border-emerald-500/40 p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 size={16} /> Compliance Health
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              SCORE
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-3xl font-black text-emerald-400 font-mono">
              {stats.avgCompliance.toFixed(1)}%
            </div>
            <div className="text-[11px] text-emerald-400 font-bold font-mono">
              14/15 A Grade
            </div>
          </div>
          <div className="mt-2 text-[10px] text-slate-400">
            Weighted index of timely filing, accuracy, & GSTR-2B compliance.
          </div>
        </div>
      </div>

      {/* Reconcile Notification Alert Banner */}
      {reconSuccessMsg && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-500/60 rounded-xl text-emerald-200 text-xs font-bold flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <span>{reconSuccessMsg}</span>
          </div>
          <button onClick={() => setReconSuccessMsg(null)} className="text-emerald-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Control Toolbar: Heatmap Metric Selectors & Filters */}
      <div className="p-5 bg-slate-800/80 rounded-2xl border border-slate-700/80 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-md">
        {/* Metric Mode Selectors */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <SlidersHorizontal size={13} className="text-blue-400" />
            Heatmap Intensity Metric
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'errorRate', label: 'Error Rate (%)', icon: ShieldAlert, color: 'hover:text-rose-300' },
              { id: 'pendingRecon', label: 'Pending Recon (₹)', icon: Scale, color: 'hover:text-amber-300' },
              { id: 'complianceScore', label: 'Compliance Score', icon: CheckCircle2, color: 'hover:text-emerald-300' },
              { id: 'taxLiability', label: 'Tax Liability (₹)', icon: Building2, color: 'hover:text-indigo-300' }
            ].map((m) => {
              const Icon = m.icon;
              const isActive = selectedMetric === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMetric(m.id as HeatmapMetricKey)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-400 shadow-md'
                      : 'bg-slate-900/60 text-slate-300 border-slate-700 hover:bg-slate-700/50'
                  }`}
                >
                  <Icon size={13} />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* View Switcher, Zone Filter, & Search */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Zone Filter */}
          <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700 px-3 py-1.5 rounded-xl">
            <Filter size={13} className="text-slate-400" />
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-200 outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-800">All Zones ({allStatesList.length})</option>
              <option value="NORTH" className="bg-slate-800">North Zone</option>
              <option value="SOUTH" className="bg-slate-800">South Zone</option>
              <option value="WEST" className="bg-slate-800">West Zone</option>
              <option value="EAST" className="bg-slate-800">East Zone</option>
              <option value="CENTRAL" className="bg-slate-800">Central Zone</option>
              <option value="NORTHEAST" className="bg-slate-800">North-East Zone</option>
            </select>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter state name / code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-900/60 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500 w-44"
            />
          </div>

          {/* Grid vs Map View Toggle */}
          <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('GRID')}
              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'GRID' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers size={13} /> Grid Heatmap
            </button>
            <button
              type="button"
              onClick={() => setViewMode('MAP')}
              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'MAP' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapPin size={13} /> Map View
            </button>
          </div>
        </div>
      </div>

      {/* Intensity Legend Bar */}
      <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60 flex flex-wrap items-center justify-between text-xs gap-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Intensity Gradient:</span>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-emerald-500"></span>
            <span className="text-[11px] text-slate-300 font-bold mr-2">Optimal / Low Risk</span>
            
            <span className="w-3 h-3 rounded-sm bg-amber-500"></span>
            <span className="text-[11px] text-slate-300 font-bold mr-2">Moderate / Pending Alert</span>

            <span className="w-3 h-3 rounded-sm bg-rose-500"></span>
            <span className="text-[11px] text-slate-300 font-bold">Critical Error / Recon Backlog</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 font-mono">
          Showing <strong>{filteredStates.length}</strong> of {allStatesList.length} GSTIN state jurisdictions
        </div>
      </div>

      {/* VIEW MODE 1: GRID HEATMAP CARDS */}
      {viewMode === 'GRID' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredStates.map((st) => {
            const style = getIntensityStyle(st);
            return (
              <div
                key={st.stateCode}
                onClick={() => setSelectedState(st)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-md flex flex-col justify-between group relative overflow-hidden ${style.cardBg}`}
              >
                {/* Header: State Code & Name */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded font-mono font-black text-xs bg-slate-900/80 text-white border border-slate-700">
                        {st.stateCode}
                      </span>
                      <h4 className="font-bold text-sm text-white group-hover:text-blue-300 transition-colors truncate max-w-[120px]">
                        {st.stateName}
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-1">
                      {st.zone} Zone • {st.activeGstins} GSTINs
                    </span>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${style.badgeBg}`}>
                    {st.errorRate >= 4.0 ? 'HIGH RISK' : st.errorRate >= 2.0 ? 'MODERATE' : 'OPTIMAL'}
                  </span>
                </div>

                {/* Primary Metric Highlights */}
                <div className="mt-4 space-y-2 pt-3 border-t border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium">Error Rate:</span>
                    <span className={`font-mono font-bold text-xs ${st.errorRate >= 4.0 ? 'text-rose-400' : st.errorRate >= 2.0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {st.errorRate}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium">Pending Recon:</span>
                    <span className="font-mono font-bold text-xs text-amber-300">
                      ₹{(st.pendingReconValue / 100000).toFixed(1)} L
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium">Tax Liability:</span>
                    <span className="font-mono font-bold text-xs text-slate-200">
                      ₹{(st.taxLiability / 100000).toFixed(1)} L
                    </span>
                  </div>
                </div>

                {/* Bottom Bar: Compliance Bar */}
                <div className="mt-4 space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>Score: {st.complianceScore}%</span>
                    <span>{st.pendingReturns} Pending Returns</span>
                  </div>
                  <div className="w-full bg-slate-900/80 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${st.complianceScore}%`,
                        backgroundColor: style.intensityColor
                      }}
                    ></div>
                  </div>
                </div>

                {/* Hover CTA Indicator */}
                <div className="mt-3 text-[10px] text-blue-400 font-bold flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  Inspect GSTINs <ChevronRight size={12} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: D3 MAP VISUALIZATION */}
      {viewMode === 'MAP' && (
        <div className="p-6 bg-slate-800/80 rounded-2xl border border-slate-700/80 shadow-xl">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-700">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <MapPin size={16} className="text-blue-400" />
                Interactive India Geographic Compliance Heatmap
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Hover over state polygons to view regional metrics. Click to isolate state GSTIN data.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
              Choropleth Rendering Engine
            </span>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-700 p-2 overflow-hidden">
            <GeoGstMapVisualization
              height={560}
              onStateSelect={(st) => {
                const ext = ENHANCED_STATE_DATA[st.stateCode];
                if (ext) setSelectedState(ext);
              }}
            />
          </div>
        </div>
      )}

      {/* STATE DEEP-DIVE MODAL / INSPECTION DRAWER */}
      {selectedState && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto font-sans flex flex-col">
            {/* Modal Header */}
            <div className="p-6 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-lg bg-blue-600 text-white font-mono font-black text-sm shadow-md">
                  {selectedState.stateCode}
                </span>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-wide flex items-center gap-2">
                    {selectedState.stateName} GSTIN Compliance Dossier
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedState.zone} Jurisdiction • Primary GSTIN: <span className="font-mono text-blue-300 font-bold">{selectedState.primaryGstin || 'N/A'}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedState(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* State Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Error Rate</div>
                  <div className={`text-xl font-black font-mono mt-1 ${selectedState.errorRate >= 4.0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {selectedState.errorRate}%
                  </div>
                </div>

                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Pending Recon</div>
                  <div className="text-xl font-black font-mono text-amber-300 mt-1">
                    ₹{(selectedState.pendingReconValue / 100000).toFixed(1)} L
                  </div>
                </div>

                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Total Tax Liability</div>
                  <div className="text-xl font-black font-mono text-slate-200 mt-1">
                    ₹{(selectedState.taxLiability / 100000).toFixed(1)} L
                  </div>
                </div>

                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Compliance Score</div>
                  <div className="text-xl font-black font-mono text-emerald-400 mt-1">
                    {selectedState.complianceScore}%
                  </div>
                </div>
              </div>

              {/* Active GSTIN Entities Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Building2 size={15} className="text-blue-400" />
                  Active Registered GSTIN Entities in {selectedState.stateName}
                </h4>

                <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-800/40">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-800 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-700">
                      <tr>
                        <th className="p-3">GSTIN & Unit Name</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Active Errors</th>
                        <th className="p-3">Pending Recon</th>
                        <th className="p-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-200">
                      {selectedState.gstinList.map((g, i) => (
                        <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                          <td className="p-3">
                            <div className="font-mono font-bold text-blue-300">{g.gstin}</div>
                            <div className="text-[10px] text-slate-400">{g.tradeName}</div>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-700 text-slate-300">
                              {g.type}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`font-mono font-bold ${g.errorCount > 10 ? 'text-rose-400' : 'text-slate-300'}`}>
                              {g.errorCount} exceptions
                            </span>
                          </td>
                          <td className="p-3 font-mono text-amber-300">
                            ₹{(g.pendingReconValue / 100000).toFixed(1)} L
                          </td>
                          <td className="p-3 text-right">
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              {g.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Validation Error Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert size={15} className="text-rose-400" />
                  Top Exception Categories Flagged in {selectedState.stateName}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedState.recentErrors.map((err, i) => (
                    <div key={i} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 flex items-start gap-3">
                      <div className={`p-2 rounded-lg text-xs font-black shrink-0 ${err.severity === 'HIGH' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                        {err.count}x
                      </div>
                      <div>
                        <div className="font-mono text-xs font-bold text-blue-300 flex items-center gap-2">
                          {err.code}
                          <span className="text-[9px] font-sans px-1.5 py-0.2 bg-slate-700 text-slate-300 rounded font-normal">
                            {err.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          {err.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="p-5 bg-slate-800/90 border-t border-slate-700 flex flex-wrap items-center justify-between gap-3 sticky bottom-0 z-10">
              <div className="text-xs text-slate-400">
                Data refreshed in real-time via GSP / NIC API webhook.
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleRunStateReconciliation(selectedState.stateName)}
                  disabled={isReconciling}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isReconciling ? 'animate-spin' : ''} />
                  {isReconciling ? 'Running Recon...' : `Run GSTR-2B Recon for ${selectedState.stateName}`}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedState(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegionalComplianceHeatmap;
