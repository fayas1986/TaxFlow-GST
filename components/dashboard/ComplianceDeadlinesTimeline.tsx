import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ReferenceLine, Cell 
} from 'recharts';
import { 
  Calendar, Clock, AlertTriangle, CheckCircle2, ArrowRight, 
  ShieldAlert, DollarSign, TrendingUp, Filter, Sparkles, 
  Layers, ExternalLink, FileText, ChevronRight, Info
} from 'lucide-react';
import { motion } from 'motion/react';
import { FilingRecord } from '../../types';

export interface ComplianceDeadlinesTimelineProps {
  tenantId?: string;
  entityName?: string;
  isAggregate?: boolean;
  filings?: FilingRecord[];
  allTenantFilings?: Record<string, FilingRecord[]>;
  availableTenants?: { id: string; name: string; gstin: string }[];
  onNavigate?: (path: string) => void;
}

export interface MilestoneItem {
  id: string;
  code: string;
  title: string;
  formType: string;
  sectionRef: string;
  period: string;
  dueDateStr: string; // YYYY-MM-DD
  dueDateFormatted: string;
  daysRemaining: number;
  status: 'OVERDUE' | 'URGENT' | 'DUE_SOON' | 'SCHEDULED' | 'FILED';
  category: 'MONTHLY_RETURN' | 'TAX_SETTLEMENT' | 'RECONCILIATION' | 'COMPOSITION' | 'ANNUAL_AUDIT';
  estimatedLiability: number; // in ₹
  lateFeeDaily: number;
  description: string;
  actionLabel: string;
  actionPath: string;
  filedDate?: string;
  arn?: string;
  tenantName?: string;
}

export const ComplianceDeadlinesTimeline: React.FC<ComplianceDeadlinesTimelineProps> = ({
  tenantId = 't1',
  entityName = 'Active Subsidiary',
  isAggregate = false,
  filings = [],
  allTenantFilings = {},
  availableTenants = [],
  onNavigate
}) => {
  const [timeHorizon, setTimeHorizon] = useState<'30_DAYS' | '90_DAYS' | 'ALL'>('90_DAYS');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'RETURNS' | 'SETTLEMENTS' | 'AUDITS'>('ALL');
  const [activeTab, setActiveTab] = useState<'TIMELINE_CHART' | 'STEPPER_CARDS'>('TIMELINE_CHART');
  const [hoveredMilestone, setHoveredMilestone] = useState<string | null>(null);

  // Simulated base reference date (Current App Local Time: Sep 12, 2026)
  const baseDate = useMemo(() => new Date('2026-09-12T00:00:00Z'), []);

  // Consolidate filings if in aggregate mode
  const effectiveFilings = useMemo(() => {
    if (isAggregate && allTenantFilings && Object.keys(allTenantFilings).length > 0) {
      let combined: FilingRecord[] = [];
      Object.values(allTenantFilings).forEach(list => {
        if (Array.isArray(list)) combined = [...combined, ...list];
      });
      return combined;
    }
    return filings;
  }, [isAggregate, allTenantFilings, filings]);

  // Master statutory GST milestone specifications for FY 2026-27
  const rawMilestones: MilestoneItem[] = useMemo(() => {
    const rawList: Omit<MilestoneItem, 'daysRemaining' | 'status' | 'dueDateFormatted'>[] = [
      {
        id: 'ms-gstr1-aug',
        code: 'GSTR-1',
        title: 'Monthly Outward Supplies Return',
        formType: 'GSTR-1',
        sectionRef: 'Sec 37(1) CGST',
        period: 'August 2026',
        dueDateStr: '2026-09-11',
        category: 'MONTHLY_RETURN',
        estimatedLiability: 148000,
        lateFeeDaily: 50,
        description: 'Statement of outward taxable supplies to B2B, B2CL, exports, and credit/debit notes.',
        actionLabel: 'File GSTR-1',
        actionPath: '#/filing'
      },
      {
        id: 'ms-iff-q2m2',
        code: 'IFF',
        title: 'QRMP Invoice Furnishing Facility',
        formType: 'IFF',
        sectionRef: 'Rule 59(2)',
        period: 'August 2026',
        dueDateStr: '2026-09-13',
        category: 'MONTHLY_RETURN',
        estimatedLiability: 42000,
        lateFeeDaily: 0,
        description: 'Optional B2B outward invoice upload for quarterly scheme filers (Cutoff for 2B entry).',
        actionLabel: 'Upload Invoices',
        actionPath: '#/invoices'
      },
      {
        id: 'ms-gstr2b-aug',
        code: 'GSTR-2B',
        title: 'Auto-Drafted ITC Lock & Reco Cutoff',
        formType: 'GSTR-2B',
        sectionRef: 'Rule 60(7)',
        period: 'August 2026',
        dueDateStr: '2026-09-14',
        category: 'RECONCILIATION',
        estimatedLiability: 0,
        lateFeeDaily: 0,
        description: 'Static auto-generated Input Tax Credit statement locks. Reconcile with ERP purchase ledger.',
        actionLabel: 'Reconcile 2B',
        actionPath: '#/reconciliation'
      },
      {
        id: 'ms-gstr3b-aug',
        code: 'GSTR-3B',
        title: 'Monthly Summary & Cash Tax Discharge',
        formType: 'GSTR-3B',
        sectionRef: 'Sec 39 CGST',
        period: 'August 2026',
        dueDateStr: '2026-09-20',
        category: 'TAX_SETTLEMENT',
        estimatedLiability: 215000,
        lateFeeDaily: 50,
        description: 'Mandatory discharge of output tax liability using available ITC and cash ledger offsets.',
        actionLabel: 'Discharge Tax',
        actionPath: '#/filing'
      },
      {
        id: 'ms-gstr7-sep',
        code: 'GSTR-7/8',
        title: 'TDS & TCS Monthly Return',
        formType: 'GSTR-7',
        sectionRef: 'Sec 51 & 52',
        period: 'September 2026',
        dueDateStr: '2026-10-10',
        category: 'TAX_SETTLEMENT',
        estimatedLiability: 28000,
        lateFeeDaily: 50,
        description: 'Tax deducted at source on government contracts and e-commerce transactions.',
        actionLabel: 'View Deductions',
        actionPath: '#/filing'
      },
      {
        id: 'ms-gstr1-sep',
        code: 'GSTR-1',
        title: 'Q2 Concluding Outward Supplies',
        formType: 'GSTR-1',
        sectionRef: 'Sec 37(1)',
        period: 'September 2026',
        dueDateStr: '2026-10-11',
        category: 'MONTHLY_RETURN',
        estimatedLiability: 185000,
        lateFeeDaily: 50,
        description: 'End-of-quarter comprehensive sales statement; reconciliation of cumulative Q2 turnover.',
        actionLabel: 'Prepare Q2 Return',
        actionPath: '#/filing'
      },
      {
        id: 'ms-cmp08-q2',
        code: 'CMP-08',
        title: 'Composition Scheme Quarterly Statement',
        formType: 'CMP-08',
        sectionRef: 'Rule 62',
        period: 'Jul - Sep 2026',
        dueDateStr: '2026-10-18',
        category: 'COMPOSITION',
        estimatedLiability: 35000,
        lateFeeDaily: 50,
        description: 'Quarterly self-assessed tax payment statement for composition operating branches.',
        actionLabel: 'File Statement',
        actionPath: '#/filing'
      },
      {
        id: 'ms-gstr3b-sep',
        code: 'GSTR-3B',
        title: 'Q2 Half-Year Statutory Tax Settlement',
        formType: 'GSTR-3B',
        sectionRef: 'Sec 39 CGST',
        period: 'September 2026',
        dueDateStr: '2026-10-20',
        category: 'TAX_SETTLEMENT',
        estimatedLiability: 242000,
        lateFeeDaily: 50,
        description: 'Quarter 2 final tax payment; reconciliation of reverse charge and ITC utilization.',
        actionLabel: 'Settle Q2 Tax',
        actionPath: '#/filing'
      },
      {
        id: 'ms-sec16-cutoff',
        code: 'SEC-16(4)',
        title: 'FY 25-26 Annual ITC Limitation Cutoff',
        formType: 'SEC-16(4)',
        sectionRef: 'Sec 16(4) Limitation',
        period: 'FY 2025-26',
        dueDateStr: '2026-11-30',
        category: 'ANNUAL_AUDIT',
        estimatedLiability: 0,
        lateFeeDaily: 0,
        description: 'Absolute statutory time-bar deadline to claim any unavailed ITC pertaining to FY 2025-26.',
        actionLabel: 'Review Unclaimed ITC',
        actionPath: '#/reconciliation'
      },
      {
        id: 'ms-gstr9-annual',
        code: 'GSTR-9 / 9C',
        title: 'Consolidated Annual Return & Audit Reconciliation',
        formType: 'GSTR-9',
        sectionRef: 'Sec 44 CGST',
        period: 'FY 2025-26',
        dueDateStr: '2026-12-31',
        category: 'ANNUAL_AUDIT',
        estimatedLiability: 380000,
        lateFeeDaily: 200,
        description: 'Audited annual return and reconciliation statement for corporate taxpayers > ₹5 Cr turnover.',
        actionLabel: 'Open Audit Workpaper',
        actionPath: '#/reports'
      }
    ];

    return rawList.map(item => {
      const dueDate = new Date(`${item.dueDateStr}T00:00:00Z`);
      const diffTime = dueDate.getTime() - baseDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Check if actual matching filing exists in store
      const matchingFiling = effectiveFilings.find(f => 
        (f.type === item.formType || f.type.replace('-', '') === item.formType.replace('-', '')) &&
        (f.period.toLowerCase().includes(item.period.toLowerCase().split(' ')[0]) || f.dueDate === item.dueDateStr)
      );

      let status: 'OVERDUE' | 'URGENT' | 'DUE_SOON' | 'SCHEDULED' | 'FILED';
      let filedDate: string | undefined;
      let arn: string | undefined;

      if (matchingFiling?.status === 'FILED') {
        status = 'FILED';
        filedDate = matchingFiling.filedDate || '2026-08-10';
        arn = matchingFiling.arn || 'AA2708260012345';
      } else if (diffDays < 0) {
        status = 'OVERDUE';
      } else if (diffDays <= 2) {
        status = 'URGENT';
      } else if (diffDays <= 9) {
        status = 'DUE_SOON';
      } else {
        status = 'SCHEDULED';
      }

      const formatted = dueDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });

      return {
        ...item,
        daysRemaining: diffDays,
        status,
        dueDateFormatted: formatted,
        filedDate,
        arn,
        tenantName: isAggregate ? 'All Consolidated Subsidiaries' : entityName
      };
    });
  }, [baseDate, effectiveFilings, isAggregate, entityName]);

  // Filtered milestones based on controls
  const filteredMilestones = useMemo(() => {
    return rawMilestones.filter(m => {
      // Horizon filter
      if (timeHorizon === '30_DAYS' && m.daysRemaining > 30) return false;
      if (timeHorizon === '90_DAYS' && m.daysRemaining > 90) return false;

      // Category filter
      if (categoryFilter === 'RETURNS' && m.category !== 'MONTHLY_RETURN') return false;
      if (categoryFilter === 'SETTLEMENTS' && m.category !== 'TAX_SETTLEMENT') return false;
      if (categoryFilter === 'AUDITS' && m.category !== 'ANNUAL_AUDIT') return false;

      return true;
    });
  }, [rawMilestones, timeHorizon, categoryFilter]);

  // Chart data for Recharts
  const chartData = useMemo(() => {
    return filteredMilestones.map(m => {
      const shortLabel = `${m.dueDateStr.slice(5).replace('-', '/')}\n${m.code}`;
      const liabilityLakhs = Number((m.estimatedLiability / 100000).toFixed(2));
      
      // Color coding for Recharts bar
      let barColor = '#6366f1'; // indigo
      if (m.status === 'FILED') barColor = '#10b981'; // emerald
      else if (m.status === 'OVERDUE') barColor = '#ef4444'; // red
      else if (m.status === 'URGENT') barColor = '#f43f5e'; // rose
      else if (m.status === 'DUE_SOON') barColor = '#f59e0b'; // amber
      else if (m.daysRemaining > 45) barColor = '#64748b'; // slate

      return {
        id: m.id,
        name: m.code,
        shortLabel,
        fullTitle: m.title,
        dueDateStr: m.dueDateStr,
        dueDateFormatted: m.dueDateFormatted,
        daysRemaining: m.daysRemaining,
        // Visual floor at 0 for bar height, with negative indicator in tooltip
        displayDays: Math.max(0, m.daysRemaining),
        isOverdue: m.daysRemaining < 0,
        liabilityLakhs,
        estimatedLiability: m.estimatedLiability,
        status: m.status,
        barColor,
        category: m.category,
        lateFeeDaily: m.lateFeeDaily,
        sectionRef: m.sectionRef
      };
    });
  }, [filteredMilestones]);

  // Aggregated KPIs
  const nextUrgentMilestone = useMemo(() => {
    return filteredMilestones.find(m => m.status === 'URGENT' || m.status === 'DUE_SOON' || m.status === 'OVERDUE') || filteredMilestones[0];
  }, [filteredMilestones]);

  const totalUpcomingLiability = useMemo(() => {
    return filteredMilestones
      .filter(m => m.status !== 'FILED')
      .reduce((acc, m) => acc + m.estimatedLiability, 0);
  }, [filteredMilestones]);

  const totalActionRequired = useMemo(() => {
    return filteredMilestones.filter(m => m.status === 'OVERDUE' || m.status === 'URGENT' || m.status === 'DUE_SOON').length;
  }, [filteredMilestones]);

  const handleAction = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.hash = path;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider border border-indigo-200/60 flex items-center gap-1.5">
              <Calendar size={11} className="text-indigo-600" />
              Statutory Compliance Timeline
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              Ref: 12 Sep 2026 (Live Pulse)
            </span>
          </div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            GST Return Deadlines & Compliance Milestones
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Visual milestone horizon tracking filing windows, auto-drafted ITC cutoffs, and statutory cash settlement dates
          </p>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Horizon Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setTimeHorizon('30_DAYS')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                timeHorizon === '30_DAYS'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Next 30 Days
            </button>
            <button
              onClick={() => setTimeHorizon('90_DAYS')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                timeHorizon === '90_DAYS'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Next 90 Days
            </button>
            <button
              onClick={() => setTimeHorizon('ALL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                timeHorizon === 'ALL'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All FY Milestones
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setActiveTab('TIMELINE_CHART')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeTab === 'TIMELINE_CHART'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Recharts Timeline
            </button>
            <button
              onClick={() => setActiveTab('STEPPER_CARDS')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeTab === 'STEPPER_CARDS'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Milestone Cards ({filteredMilestones.length})
            </button>
          </div>
        </div>
      </div>

      {/* KPI Highlights Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Next Imminent Deadline */}
        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Next Critical Deadline
            </span>
            <Clock size={15} className="text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900">
              {nextUrgentMilestone?.code || 'GSTR-3B'}
            </span>
            <span className="text-xs font-semibold text-slate-600">
              ({nextUrgentMilestone?.dueDateFormatted.slice(0, 6)})
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
              nextUrgentMilestone?.daysRemaining && nextUrgentMilestone.daysRemaining < 0
                ? 'bg-red-100 text-red-700'
                : nextUrgentMilestone?.daysRemaining && nextUrgentMilestone.daysRemaining <= 3
                ? 'bg-rose-100 text-rose-700'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {nextUrgentMilestone?.daysRemaining !== undefined && nextUrgentMilestone.daysRemaining < 0
                ? `Overdue by ${Math.abs(nextUrgentMilestone.daysRemaining)} days`
                : `Due in ${nextUrgentMilestone?.daysRemaining} days`}
            </span>
            <span className="text-[10px] text-slate-500 font-medium truncate">
              {nextUrgentMilestone?.sectionRef}
            </span>
          </div>
        </div>

        {/* Card 2: Estimated Statutory Cash Outflow */}
        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Horizon Tax Outflow
            </span>
            <DollarSign size={15} className="text-indigo-600" />
          </div>
          <div className="text-xl font-black text-slate-900">
            ₹ {(totalUpcomingLiability / 100000).toFixed(2)} Lakhs
          </div>
          <p className="mt-2 text-[10px] text-slate-500 font-medium">
            Across {filteredMilestones.filter(m => m.status !== 'FILED').length} pending filing windows
          </p>
        </div>

        {/* Card 3: Pending Action Count */}
        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Urgent Action Items
            </span>
            <AlertTriangle size={15} className="text-rose-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-rose-600">
              {totalActionRequired}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Milestones Due &lt; 10 Days
            </span>
          </div>
          <p className="mt-2 text-[10px] text-slate-500 font-medium">
            Requires verification before statutory portal cutoff
          </p>
        </div>

        {/* Card 4: Statutory Penalty Protection */}
        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Late Fee Protection
            </span>
            <ShieldAlert size={15} className="text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-600 flex items-center gap-1.5">
            <span>₹ 0 Late Fees</span>
          </div>
          <p className="mt-2 text-[10px] text-slate-500 font-medium">
            Sec 47 & 50 compliance protection active
          </p>
        </div>
      </div>

      {/* Category Pills Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider shrink-0 flex items-center gap-1">
          <Filter size={12} /> Filter:
        </span>
        {[
          { key: 'ALL', label: 'All Categories' },
          { key: 'RETURNS', label: 'Outward Returns (GSTR-1/IFF)' },
          { key: 'SETTLEMENTS', label: 'Tax Payments (GSTR-3B/TDS)' },
          { key: 'AUDITS', label: 'Audits & Limitations (16(4)/GSTR-9)' }
        ].map(cat => (
          <button
            key={cat.key}
            onClick={() => setCategoryFilter(cat.key as any)}
            className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
              categoryFilter === cat.key
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ======================================================================= */}
      {/* 1. VISUAL RECHARTS TIMELINE COMPOSED CHART                               */}
      {/* ======================================================================= */}
      {activeTab === 'TIMELINE_CHART' && (
        <div className="space-y-4">
          <div className="bg-white text-slate-900 p-5 rounded-[1.5rem] border border-slate-200 relative overflow-hidden shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
                <h4 className="text-[17px] font-extrabold text-[#0F172A] tracking-tight">
                  Chronological Milestone Horizon & Estimated Outflows
                </h4>
              </div>
              <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-indigo-500 inline-block"></span>
                  Days Until Deadline (Bar)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1 rounded-full bg-purple-400 inline-block"></span>
                  Statutory Tax Outflow (₹ Lakhs)
                </span>
              </div>
            </div>

            {/* Recharts Composed Chart */}
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 10, bottom: 25 }}
                  onMouseMove={(e: any) => {
                    if (e && e.activePayload && e.activePayload[0]) {
                      setHoveredMilestone(e.activePayload[0].payload.id);
                    }
                  }}
                  onMouseLeave={() => setHoveredMilestone(null)}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                  
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                    stroke="#475569"
                    interval={0}
                  />

                  {/* Left Axis: Days to Deadline */}
                  <YAxis 
                    yAxisId="left"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    stroke="#475569"
                    unit=" d"
                    domain={[0, 'auto']}
                  />

                  {/* Right Axis: Tax Outflow in Lakhs */}
                  <YAxis 
                    yAxisId="right" 
                    orientation="right"
                    tick={{ fill: '#c084fc', fontSize: 10 }}
                    stroke="#a855f7"
                    unit=" L"
                    domain={[0, 'auto']}
                  />

                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-700 shadow-2xl text-xs space-y-2 max-w-xs">
                          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                            <span className="font-extrabold text-white text-sm">
                              {data.name} • {data.sectionRef}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                              data.status === 'FILED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                              data.status === 'OVERDUE' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                              data.status === 'URGENT' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                              'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                            }`}>
                              {data.status}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-300 font-medium">
                            {data.fullTitle}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800/80">
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase">Statutory Due Date</span>
                              <span className="font-bold text-white">{data.dueDateFormatted}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase">Days Remaining</span>
                              <span className={`font-bold ${data.daysRemaining <= 3 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                {data.daysRemaining < 0 
                                  ? `${Math.abs(data.daysRemaining)} Days Overdue` 
                                  : `${data.daysRemaining} Days`}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase">Estimated Tax Outflow</span>
                              <span className="font-bold text-purple-300">₹ {data.estimatedLiability.toLocaleString('en-IN')}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase">Daily Late Fee Risk</span>
                              <span className="font-bold text-amber-300">{data.lateFeeDaily > 0 ? `₹${data.lateFeeDaily}/day` : 'None'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />

                  {/* Reference Line for Current Local Time Baseline */}
                  <ReferenceLine 
                    yAxisId="left" 
                    y={3} 
                    stroke="#f43f5e" 
                    strokeDasharray="4 4" 
                    label={{ value: 'Urgent Threshold (3 Days)', fill: '#f43f5e', fontSize: 9, position: 'insideBottomRight' }} 
                  />

                  {/* Days to Deadline Bar with Dynamic Color Coding */}
                  <Bar 
                    yAxisId="left" 
                    dataKey="displayDays" 
                    name="Days Remaining"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={38}
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.barColor}
                        opacity={hoveredMilestone && hoveredMilestone !== entry.id ? 0.45 : 1}
                      />
                    ))}
                  </Bar>

                  {/* Statutory Tax Liability Curve Line */}
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="liabilityLakhs" 
                    name="Est. Outflow (₹ L)" 
                    stroke="#c084fc" 
                    strokeWidth={2.5}
                    dot={{ fill: '#c084fc', r: 4 }}
                    activeDot={{ r: 6, fill: '#ffffff', stroke: '#c084fc', strokeWidth: 2 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Visual Color Legend Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  Completed / Filed
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  Urgent (&lt; 3 Days)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  Due Soon (4-10 Days)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                  Scheduled Window
                </span>
              </div>
              <span className="text-[10px] text-slate-500 italic">
                *Click any milestone below to navigate directly to the filing workspace
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 2. CHRONOLOGICAL MILESTONE STEPPER CARDS                                 */}
      {/* ======================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Layers size={13} className="text-indigo-600" />
            Active Compliance Horizon Pipeline ({filteredMilestones.length} Events)
          </h4>
          <span className="text-[11px] text-slate-500 font-medium">
            Entity Scope: <strong className="text-slate-800">{isAggregate ? 'Consolidated Group Portfolio' : entityName}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filteredMilestones.map((m) => {
            const isImminent = m.status === 'URGENT' || m.status === 'OVERDUE';
            return (
              <div
                key={m.id}
                className={`p-4 rounded-xl border transition-all relative flex flex-col justify-between ${
                  m.status === 'FILED'
                    ? 'bg-slate-50/70 border-slate-200'
                    : isImminent
                    ? 'bg-rose-50/30 border-rose-200/80 shadow-xs hover:border-rose-300'
                    : m.status === 'DUE_SOON'
                    ? 'bg-amber-50/20 border-amber-200/80 hover:border-amber-300 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-indigo-300 shadow-xs'
                }`}
              >
                <div>
                  {/* Top Form Badge & Countdown */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2.5 py-0.5 rounded-md text-xs font-black tracking-wide ${
                        m.status === 'FILED' ? 'bg-emerald-100 text-emerald-800' :
                        isImminent ? 'bg-rose-600 text-white' :
                        m.status === 'DUE_SOON' ? 'bg-amber-500 text-white' :
                        'bg-indigo-600 text-white'
                      }`}>
                        {m.code}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 font-bold">
                        {m.period}
                      </span>
                    </div>

                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      m.status === 'FILED' ? 'bg-emerald-100 text-emerald-800' :
                      m.status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                      m.status === 'URGENT' ? 'bg-rose-100 text-rose-800' :
                      m.status === 'DUE_SOON' ? 'bg-amber-100 text-amber-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {m.status === 'FILED' ? (
                        <>
                          <CheckCircle2 size={11} className="text-emerald-600" />
                          Filed ({m.arn?.slice(0, 8)}...)
                        </>
                      ) : m.status === 'OVERDUE' ? (
                        <>
                          <AlertTriangle size={11} className="text-red-600" />
                          Overdue ({Math.abs(m.daysRemaining)}d)
                        </>
                      ) : (
                        <>
                          <Clock size={11} className={isImminent ? 'text-rose-600' : 'text-slate-500'} />
                          {m.daysRemaining === 0 ? 'Due Today' : `In ${m.daysRemaining} days`}
                        </>
                      )}
                    </span>
                  </div>

                  {/* Title & Section */}
                  <h5 className="text-xs font-bold text-slate-900 line-clamp-1 mb-1">
                    {m.title}
                  </h5>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                    {m.description}
                  </p>
                </div>

                {/* Bottom Meta & Action */}
                <div className="pt-3 border-t border-slate-100/90 flex items-center justify-between gap-2 mt-auto">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Due Date</span>
                    <span className="text-xs font-bold text-slate-800">{m.dueDateFormatted}</span>
                  </div>

                  {m.estimatedLiability > 0 && (
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-medium">Est. Liability</span>
                      <span className="text-xs font-bold text-indigo-700">₹ {(m.estimatedLiability / 1000).toFixed(0)}k</span>
                    </div>
                  )}

                  <button
                    onClick={() => handleAction(m.actionPath)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                      m.status === 'FILED'
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        : isImminent
                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                    }`}
                  >
                    <span>{m.actionLabel}</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ComplianceDeadlinesTimeline;
