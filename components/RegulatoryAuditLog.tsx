import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  History, Calendar, User, Search, RefreshCw, CheckCircle2, 
  XCircle, Filter, BookOpen, AlertTriangle, ChevronDown, ChevronUp, FileText, ExternalLink
} from 'lucide-react';

export interface OperativeNotification {
  notificationNumber: string;
  notificationDate: string;
  effectiveDate: string;
  provisions: string;
  impactedCategory: string;
  officialPdfUrl?: string;
}

export interface RegulatoryEvent {
  id: string;
  title: string;
  category: 'RATE_REVISION' | 'COMPLIANCE_DEADLINE' | 'E_INVOICING' | 'ITC_RULES' | 'CIRCULAR';
  authority: string;
  legalStatus: string;
  verificationStatus: 'VERIFIED' | 'FLAGGED_MISMATCH';
  approvalStatus: 'APPROVED' | 'PENDING' | 'REJECTED';
  summary: string;
  reference: string;
  mismatchAuditNote?: string;
  effectiveDate: string;
  operativeNotifications?: OperativeNotification[];
  impactedSectors?: string[];
  actionRequired?: string;
  officialSourceTitle?: string;
  officialSourceUrl?: string;
  officialPdfUrl?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export const RegulatoryAuditLog: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'REJECTED'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Fetch all audit list events (includes APPROVED, REJECTED, PENDING)
  const { data: auditData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['regulatoryAuditEvents'],
    queryFn: async () => {
      const res = await fetch('/api/v1/compliance/regulatory/audit/events');
      if (!res.ok) throw new Error('Failed to fetch audit events');
      const data = await res.json();
      return data.events as RegulatoryEvent[];
    }
  });

  // Filter for approved or rejected events (since the component is specifically for APPROVED or REJECTED decisions)
  const decisionsOnly = React.useMemo(() => {
    if (!auditData) return [];
    return auditData.filter(evt => evt.approvalStatus === 'APPROVED' || evt.approvalStatus === 'REJECTED');
  }, [auditData]);

  // Sort decisions chronologically (newest decision first)
  const sortedDecisions = React.useMemo(() => {
    return [...decisionsOnly].sort((a, b) => {
      const dateA = a.reviewedAt ? new Date(a.reviewedAt).getTime() : 0;
      const dateB = b.reviewedAt ? new Date(b.reviewedAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [decisionsOnly]);

  // Apply search & category filters
  const filteredDecisions = React.useMemo(() => {
    return sortedDecisions.filter(evt => {
      const matchesSearch = 
        evt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (evt.reviewedBy && evt.reviewedBy.toLowerCase().includes(searchTerm.toLowerCase())) ||
        evt.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        evt.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = 
        statusFilter === 'ALL' || 
        evt.approvalStatus === statusFilter;

      const matchesCategory = 
        categoryFilter === 'ALL' || 
        evt.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [sortedDecisions, searchTerm, statusFilter, categoryFilter]);

  const toggleExpand = (id: string) => {
    setExpandedEventId(prev => prev === id ? null : id);
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'RATE_REVISION': return 'Rate Revision';
      case 'COMPLIANCE_DEADLINE': return 'Compliance Deadline';
      case 'E_INVOICING': return 'e-Invoicing';
      case 'ITC_RULES': return 'ITC Rules';
      case 'CIRCULAR': return 'Circular / Advisory';
      default: return cat;
    }
  };

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return 'N/A';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Description & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 border border-slate-200 rounded-2xl shadow-sm">
        <div className="space-y-1 max-w-xl text-left">
          <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-sm uppercase tracking-wider">
            <History size={16} />
            <span>Official Regulatory Audit Trail</span>
          </div>
          <h3 className="text-lg font-black text-slate-800">Regulatory Decision Log</h3>
          <p className="text-slate-500 text-xs font-medium leading-relaxed">
            Chronological audit ledger capturing Gazette notifications, CBIC policy updates, and ITC guidelines reviewed by compliance managers. Maintains cryptographic verification status and auditor accountability signatures.
          </p>
        </div>
        
        <button 
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
          className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-all border border-indigo-200 flex items-center gap-2 self-start md:self-center disabled:opacity-50"
        >
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
          <span>Refresh Trail</span>
        </button>
      </div>

      {/* Decision Summary Counts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl text-left flex items-start gap-3">
          <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Approved Notifications</div>
            <div className="text-xl font-black text-slate-800">
              {decisionsOnly.filter(e => e.approvalStatus === 'APPROVED').length}
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Successfully verified and published to client portal</p>
          </div>
        </div>

        <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-xl text-left flex items-start gap-3">
          <div className="p-2 bg-rose-100 text-rose-800 rounded-lg">
            <XCircle size={16} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Withheld / Rejected</div>
            <div className="text-xl font-black text-slate-800">
              {decisionsOnly.filter(e => e.approvalStatus === 'REJECTED').length}
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Withheld due to CBIC mismatch or lack of statutory basis</p>
          </div>
        </div>

        <div className="bg-indigo-50/40 border border-indigo-100/60 p-4 rounded-xl text-left flex items-start gap-3">
          <div className="p-2 bg-indigo-100/80 text-indigo-800 rounded-lg">
            <Filter size={16} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Decisions Logged</div>
            <div className="text-xl font-black text-slate-800">
              {decisionsOnly.length}
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Total finalized administrative overrides</p>
          </div>
        </div>
      </div>

      {/* Filters & Search Control Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title, reference number, or auditor..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Status Select */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mr-2">Decision</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none py-2 cursor-pointer"
            >
              <option value="ALL">All Overrides</option>
              <option value="APPROVED">Approved Only</option>
              <option value="REJECTED">Rejected Only</option>
            </select>
          </div>

          {/* Category Select */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mr-2">Category</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none py-2 cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              <option value="RATE_REVISION">Rate Revision</option>
              <option value="COMPLIANCE_DEADLINE">Compliance Deadline</option>
              <option value="E_INVOICING">e-Invoicing</option>
              <option value="ITC_RULES">ITC Rules</option>
              <option value="CIRCULAR">Circulars</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Audit Timeline / List Container */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-left">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen size={14} className="text-indigo-600" />
            Audit Override Timeline
          </h4>
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
            Showing {filteredDecisions.length} Decisions
          </span>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <RefreshCw size={36} className="animate-spin text-indigo-600" />
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Retrieving Audit Trail...</p>
          </div>
        ) : filteredDecisions.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <History size={48} className="mx-auto text-slate-300" />
            <div className="space-y-1">
              <p className="text-slate-800 text-xs font-bold">No Audit Decisions Found</p>
              <p className="text-slate-400 text-[11px] max-w-xs mx-auto">
                {searchTerm || statusFilter !== 'ALL' || categoryFilter !== 'ALL' 
                  ? 'Try relaxing your filter parameters or query terms.' 
                  : 'Approve or reject pending events inside the "Audit Queue" to populate this ledger.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="relative border-l-2 border-slate-100 ml-4 pl-8 space-y-8 py-3">
              {filteredDecisions.map((evt) => {
                const isApproved = evt.approvalStatus === 'APPROVED';
                const isExpanded = expandedEventId === evt.id;
                const hasMismatch = evt.verificationStatus === 'FLAGGED_MISMATCH';

                return (
                  <div key={evt.id} className="relative group">
                    
                    {/* Status Circle Timeline Dot */}
                    <div className={`absolute -left-[41px] top-1 w-6 h-6 rounded-full border-2 bg-white flex items-center justify-center z-10 transition-transform group-hover:scale-105 shadow-sm ${
                      isApproved 
                        ? 'border-emerald-500 text-emerald-600' 
                        : 'border-rose-500 text-rose-600'
                    }`}>
                      {isApproved ? (
                        <CheckCircle2 size={13} strokeWidth={2.5} />
                      ) : (
                        <XCircle size={13} strokeWidth={2.5} />
                      )}
                    </div>

                    {/* Timeline Node Card */}
                    <div className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-5 hover:bg-white hover:border-slate-300 transition-all shadow-sm">
                      
                      {/* Top Header - Event Category & Status Flags */}
                      <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                            evt.category === 'RATE_REVISION' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                            evt.category === 'COMPLIANCE_DEADLINE' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                            evt.category === 'E_INVOICING' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' :
                            evt.category === 'ITC_RULES' ? 'bg-purple-50 border-purple-200 text-purple-700' :
                            'bg-slate-50 border-slate-200 text-slate-700'
                          }`}>
                            {getCategoryLabel(evt.category)}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono font-bold">
                            Ref: {evt.reference}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isApproved ? (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-lg uppercase tracking-wider flex items-center gap-1">
                              Approved
                            </span>
                          ) : (
                            <span className="text-[10px] bg-rose-100 text-rose-800 font-extrabold px-2.5 py-0.5 rounded-lg uppercase tracking-wider flex items-center gap-1">
                              Rejected
                            </span>
                          )}

                          {isApproved && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border uppercase tracking-wider ${
                              hasMismatch 
                                ? 'bg-orange-50 text-orange-700 border-orange-200' 
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {evt.verificationStatus}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Main Title & Summary */}
                      <div className="space-y-1.5 mb-4">
                        <h5 className="font-bold text-slate-800 text-sm tracking-tight">{evt.title}</h5>
                        <p className="text-slate-500 text-xs font-medium leading-relaxed">{evt.summary}</p>
                      </div>

                      {/* Audit Verification Trail Sub-Block */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3.5 border-t border-slate-200/80 text-[11px] font-semibold text-slate-600">
                        
                        {/* Auditor signature info */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-slate-400">
                            <User size={13} />
                            <span>Audit Authorization</span>
                          </div>
                          <div className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-1">
                            <p className="text-slate-800 font-black">{evt.reviewedBy || 'System'}</p>
                            <p className="text-slate-400 text-[10px] font-medium flex items-center gap-1">
                              <Calendar size={11} />
                              {formatTimestamp(evt.reviewedAt)}
                            </p>
                          </div>
                        </div>

                        {/* Regulatory source & details */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-slate-400">
                            <FileText size={13} />
                            <span>Statutory Source Reference</span>
                          </div>
                          <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex justify-between items-center">
                            <div>
                              <p className="text-slate-800 font-bold">{evt.authority}</p>
                              <p className="text-slate-400 text-[10px] font-medium">Effective: {evt.effectiveDate}</p>
                            </div>
                            {evt.officialPdfUrl && (
                              <a 
                                href={evt.officialPdfUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100"
                              >
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                        </div>

                      </div>

                      {/* Expandable validation & provisions details */}
                      {isExpanded ? (
                        <div className="mt-4 pt-4 border-t border-dashed border-slate-200 text-xs space-y-3 animate-in fade-in slide-in-from-top-1">
                          
                          {/* Engine Mismatch Notes */}
                          {evt.mismatchAuditNote && (
                            <div className="p-3 bg-amber-50/50 border border-amber-200 text-amber-800 rounded-xl space-y-1">
                              <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider text-amber-700">
                                <AlertTriangle size={13} />
                                <span>Regulatory Matching Discrepancy Record</span>
                              </div>
                              <p className="text-[11px] leading-relaxed font-semibold">{evt.mismatchAuditNote}</p>
                            </div>
                          )}

                          {/* Operative Provisions */}
                          {evt.operativeNotifications && evt.operativeNotifications.length > 0 && (
                            <div className="space-y-2">
                              <h6 className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">Operative Provisions Included</h6>
                              <div className="space-y-2">
                                {evt.operativeNotifications.map((notif, idx) => (
                                  <div key={idx} className="bg-white border border-slate-200 p-3 rounded-xl space-y-1">
                                    <div className="flex justify-between text-[11px] font-extrabold text-slate-700">
                                      <span>Notification {notif.notificationNumber}</span>
                                      <span className="text-slate-400">Date: {notif.notificationDate}</span>
                                    </div>
                                    <p className="text-slate-500 font-medium leading-relaxed text-[11px]">{notif.provisions}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Action Recommended */}
                          {evt.actionRequired && (
                            <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Action Required for Tenant Compliance</span>
                              <p className="text-slate-700 font-semibold leading-relaxed text-[11px]">{evt.actionRequired}</p>
                            </div>
                          )}
                          
                        </div>
                      ) : null}

                      {/* Expand Toggle Button */}
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => toggleExpand(evt.id)}
                          className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                        >
                          <span>{isExpanded ? 'Collapse Details' : 'Verify Full Provisions'}</span>
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
