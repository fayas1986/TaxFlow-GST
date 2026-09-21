import React, { useState } from 'react';
import { 
  Calendar, CheckCircle2, Clock, AlertTriangle, ArrowRight, 
  ChevronRight, Sparkles, Filter, HelpCircle, ShieldAlert, FileText 
} from 'lucide-react';

interface RegulatoryChange {
  id: string;
  title: string;
  category: 'NOTIFICATION' | 'CIRCULAR' | 'ADVISORY' | 'RATE_CHANGE' | 'HSN_CHANGE' | 'VALIDATION_CHANGE' | 'FILING_CHANGE';
  source: string;
  effectiveDate: string;
  description: string;
  status: 'PENDING' | 'APPLIED';
  impactScore: 'HIGH' | 'MEDIUM' | 'LOW';
  impactAnalysis: string;
  ruleChangePayload: any;
  appliedAt?: string;
  appliedBy?: string;
}

interface TimelineItem {
  id: string;
  title: string;
  date: string;
  type: 'UPCOMING' | 'ENACTED';
  category: 'NOTIFICATION' | 'CIRCULAR' | 'ADVISORY' | 'RATE_CHANGE' | 'HSN_CHANGE' | 'VALIDATION_CHANGE' | 'FILING_CHANGE' | 'DUE_DATE' | 'ITC_POLICY' | 'AUDIT';
  impactScore: 'HIGH' | 'MEDIUM' | 'LOW';
  source: string;
  description: string;
  payloadDescription?: string;
  operator?: string;
}

interface RegulatoryDeadlineTimelineProps {
  dynamicChanges: RegulatoryChange[];
}

export const RegulatoryDeadlineTimeline: React.FC<RegulatoryDeadlineTimelineProps> = ({ dynamicChanges }) => {
  const [filterType, setFilterType] = useState<'ALL' | 'UPCOMING' | 'ENACTED'>('ALL');
  const [selectedItem, setSelectedItem] = useState<TimelineItem | null>(null);

  // Hardcoded standard statutory events for FY 2026-27 to make a dense, real timeline
  const baseStatutoryEvents: TimelineItem[] = [
    {
      id: 'stat-01',
      title: 'Monthly GSTR-1 Return Filing Submission',
      date: '2026-08-11',
      type: 'ENACTED',
      category: 'DUE_DATE',
      impactScore: 'MEDIUM',
      source: 'Section 37 of CGST Act',
      description: 'Monthly outward supplies return submission deadline for multi-state corporate entities. Automated reconciliation ledger locked successfully.',
      payloadDescription: 'Outward invoices processed: 1,420; Total tax output verified: ₹48.5 Lakhs.',
      operator: 'Automated System Job'
    },
    {
      id: 'stat-02',
      title: 'Section 16(4) ITC Claim Cutoff Rule Enforcement',
      date: '2026-11-30',
      type: 'UPCOMING',
      category: 'ITC_POLICY',
      impactScore: 'HIGH',
      source: 'GST Amendment Act, Sec 16(4)',
      description: 'Strict absolute deadline for claiming any eligible Input Tax Credit (ITC) pertaining to invoices raised during the preceding Financial Year (FY 2025-26).',
      payloadDescription: 'Auto-scans will run on November 1st to highlight any un-reconciled purchase invoices from prior FY.',
    },
    {
      id: 'stat-03',
      title: 'Mandatory GSTR-9 / GSTR-9C Annual Return & Reconciliation Statement',
      date: '2026-12-31',
      type: 'UPCOMING',
      category: 'DUE_DATE',
      impactScore: 'HIGH',
      source: 'Notification No. 18/2026 - Central Tax',
      description: 'Statutory compliance deadline to upload certified GSTR-9 and reconciliation audit report GSTR-9C for corporate entities with turnover > ₹5 Crores.',
      payloadDescription: 'Direct portal API handshake enables real-time auto-compilation of draft GSTR-9 from sales and purchase histories.',
    },
    {
      id: 'stat-04',
      title: 'Q2 Corporate Tax Deducted at Source (TDS) Filing under Section 51',
      date: '2026-10-10',
      type: 'UPCOMING',
      category: 'DUE_DATE',
      impactScore: 'LOW',
      source: 'CBIC TDS Portal Register',
      description: 'Filing of GSTR-7 return to declare and deposit GST TDS collected on government contracts or state supplies during the July-September quarter.',
      payloadDescription: 'Relevant mostly to public infrastructure sales divisions.'
    }
  ];

  // Convert current server-side dynamic regulatory changes state into timeline format
  const dynamicTimelineItems: TimelineItem[] = dynamicChanges.map(change => {
    const isApplied = change.status === 'APPLIED';
    return {
      id: change.id,
      title: change.title,
      // For a nicer cronological display in this current local time of Aug 2026, keep dates consistent
      date: change.effectiveDate,
      type: isApplied ? 'ENACTED' : 'UPCOMING',
      category: change.category,
      impactScore: change.impactScore,
      source: change.source,
      description: change.description,
      payloadDescription: isApplied 
        ? `Applied as part of active rule engine validation. Authorized Operator: ${change.appliedBy || 'System'}.` 
        : `Pending dynamic activation. Operational scan highlights: "${change.impactAnalysis}"`,
      operator: change.appliedBy
    };
  });

  // Combine and sort chronological timeline items
  const allTimelineItems = [...baseStatutoryEvents, ...dynamicTimelineItems].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const filteredItems = allTimelineItems.filter(item => {
    if (filterType === 'ALL') return true;
    return item.type === filterType;
  });

  const getCategoryTheme = (cat: string) => {
    switch (cat) {
      case 'NOTIFICATION': return { label: 'Notification', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', iconColor: 'text-indigo-500' };
      case 'CIRCULAR': return { label: 'Circular', bg: 'bg-sky-50 text-sky-700 border-sky-200', iconColor: 'text-sky-500' };
      case 'ADVISORY': return { label: 'Advisory', bg: 'bg-teal-50 text-teal-700 border-teal-200', iconColor: 'text-teal-500' };
      case 'RATE_CHANGE': return { label: 'Rate Change', bg: 'bg-purple-50 text-purple-700 border-purple-200', iconColor: 'text-purple-500' };
      case 'HSN_CHANGE': return { label: 'HSN Change', bg: 'bg-rose-50 text-rose-700 border-rose-200', iconColor: 'text-rose-500' };
      case 'VALIDATION_CHANGE': return { label: 'Validation Change', bg: 'bg-blue-50 text-blue-700 border-blue-200', iconColor: 'text-blue-500' };
      case 'FILING_CHANGE': return { label: 'Filing Change', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', iconColor: 'text-emerald-500' };
      case 'DUE_DATE': return { label: 'Due Date', bg: 'bg-violet-50 text-violet-700 border-violet-200', iconColor: 'text-violet-500' };
      case 'ITC_POLICY': return { label: 'Section 17(5) ITC', bg: 'bg-amber-50 text-amber-700 border-amber-200', iconColor: 'text-amber-500' };
      default: return { label: 'Statutory Change', bg: 'bg-slate-100 text-slate-700 border-slate-200', iconColor: 'text-slate-500' };
    }
  };

  const getImpactColor = (score: string) => {
    switch (score) {
      case 'HIGH': return 'bg-red-50 text-red-700 border-red-200';
      case 'MEDIUM': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'LOW': return 'bg-sky-50 text-sky-700 border-sky-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      
      {/* Timeline flow panel */}
      <div className="xl:col-span-2 space-y-4">
        
        {/* Filter bar */}
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl p-3">
          <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
            <Filter size={14} className="text-indigo-600" /> Filter Compliance Stream:
          </span>
          <div className="flex bg-slate-200/60 p-0.5 rounded-lg text-[10px] font-extrabold text-slate-600">
            <button 
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-md transition-all ${filterType === 'ALL' ? 'bg-white text-indigo-700 shadow-sm' : 'hover:text-slate-900'}`}
            >
              All Events ({allTimelineItems.length})
            </button>
            <button 
              onClick={() => setFilterType('UPCOMING')}
              className={`px-3 py-1.5 rounded-md transition-all ${filterType === 'UPCOMING' ? 'bg-white text-indigo-700 shadow-sm' : 'hover:text-slate-900'}`}
            >
              Upcoming Deadlines ({allTimelineItems.filter(i => i.type === 'UPCOMING').length})
            </button>
            <button 
              onClick={() => setFilterType('ENACTED')}
              className={`px-3 py-1.5 rounded-md transition-all ${filterType === 'ENACTED' ? 'bg-white text-indigo-700 shadow-sm' : 'hover:text-slate-900'}`}
            >
              Enacted Changes ({allTimelineItems.filter(i => i.type === 'ENACTED').length})
            </button>
          </div>
        </div>

        {/* Visual Stream */}
        <div className="relative border-l-2 border-indigo-100 pl-6 ml-4 space-y-6">
          {filteredItems.map((item, index) => {
            const isSelected = selectedItem?.id === item.id;
            const theme = getCategoryTheme(item.category);
            const isEnacted = item.type === 'ENACTED';

            return (
              <div 
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`relative group bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md ${
                  isSelected 
                    ? 'border-indigo-600 bg-indigo-50/5 shadow-sm scale-[1.01]' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Timeline node icon */}
                <div className={`absolute -left-[35px] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 bg-white flex items-center justify-center transition-all ${
                  isEnacted 
                    ? 'border-emerald-500 text-emerald-500 ring-4 ring-emerald-50' 
                    : 'border-amber-400 text-amber-500 ring-4 ring-amber-50'
                }`}>
                  {isEnacted ? <CheckCircle2 size={12} className="fill-current text-white" /> : <Clock size={12} />}
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      {item.date}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${theme.bg}`}>
                      {theme.label}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${getImpactColor(item.impactScore)}`}>
                      {item.impactScore} Impact
                    </span>
                  </div>

                  <span className={`text-[9px] font-extrabold tracking-wide uppercase font-mono ${isEnacted ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {isEnacted ? 'Enacted statutory rule' : 'Upcoming target deadline'}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                  {item.title}
                </h4>
                <p className="text-xs text-slate-500 font-medium line-clamp-2 mt-1 leading-relaxed">
                  {item.description}
                </p>

                <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 font-semibold border-t border-slate-50 pt-2">
                  <span className="truncate max-w-[150px] font-mono">{item.source}</span>
                  <span className="text-indigo-600 flex items-center gap-1 font-bold group-hover:translate-x-0.5 transition-transform">
                    Inspect event details <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* Side Details Panel */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between min-h-[400px]">
        {selectedItem ? (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-3 duration-300">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${getCategoryTheme(selectedItem.category).bg}`}>
                  {getCategoryTheme(selectedItem.category).label}
                </span>
                <span className="text-slate-300">&bull;</span>
                <span className="text-xs font-mono font-semibold text-slate-500">{selectedItem.date}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 leading-snug">{selectedItem.title}</h3>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/60 p-4 space-y-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-50 pb-2">
                <FileText size={12} className="text-slate-400" /> CBIC Reference context
              </div>
              <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                {selectedItem.description}
              </p>
              <div className="pt-2 flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Authority/Gazette Source:</span>
                <span className="font-mono text-indigo-600 text-[11px]">{selectedItem.source}</span>
              </div>
            </div>

            <div className={`rounded-xl border p-4 space-y-2 ${
              selectedItem.type === 'ENACTED' 
                ? 'bg-emerald-50/40 border-emerald-200/60 text-emerald-950' 
                : 'bg-amber-50/40 border-amber-200/60 text-amber-950'
            }`}>
              <div className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                {selectedItem.type === 'ENACTED' ? (
                  <>
                    <CheckCircle2 size={13} className="text-emerald-600" /> Active System Status
                  </>
                ) : (
                  <>
                    <AlertTriangle size={13} className="text-amber-600" /> Preparation & Checklist
                  </>
                )}
              </div>
              <p className="text-xs font-semibold leading-relaxed text-slate-600">
                {selectedItem.payloadDescription}
              </p>
              {selectedItem.operator && (
                <div className="pt-2 border-t border-slate-200/40 text-[10px] font-mono text-slate-400 flex justify-between">
                  <span>Enacting operator:</span>
                  <span className="font-bold text-slate-700">{selectedItem.operator}</span>
                </div>
              )}
            </div>

            <div className="bg-indigo-50/30 border border-indigo-100 rounded-xl p-3 text-[10px] font-semibold text-indigo-950 flex items-start gap-2.5">
              <Sparkles className="text-indigo-600 shrink-0 mt-0.5" size={14} />
              <p className="leading-normal">
                {selectedItem.type === 'ENACTED' 
                  ? 'This statutory event is active and validated by your GSTRuleEngine during all document uploads.'
                  : 'Preparing early: Auto-draft registers and reconcilers are configured to align before this target date.'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
            <HelpCircle size={36} className="text-slate-300 stroke-[1.5]" />
            <div>
              <p className="text-xs font-extrabold text-slate-600">No event selected</p>
              <p className="text-[10px] text-slate-400 font-medium max-w-[200px] mx-auto mt-0.5">
                Click on any timeline node to view active rulesets, CBIC references, or audit operator logs.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
