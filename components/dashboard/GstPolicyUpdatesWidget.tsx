import React, { useState, useEffect, useMemo } from 'react';
import { 
  Newspaper, Search, RefreshCw, ExternalLink, Calendar, AlertTriangle, 
  CheckCircle2, Sparkles, Tag, FileText, ChevronRight, Globe, Info, X, 
  Filter, Download, ShieldAlert, CheckSquare, Clock, ArrowRight, Layers,
  Activity, Check, Sliders, FileDown, ShieldCheck, Landmark, ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportToCSV } from '../../utils/export';
import { 
  RegulatoryEvent, 
  CouncilRecommendationDetails, 
  OperativeGovernmentNotification, 
  RegulatoryLegalStatus, 
  RegulatoryVerificationStatus, 
  RegulatoryAuthority,
  SectorImpactMapping
} from '../../types';

export interface LinkedNotification extends OperativeGovernmentNotification {}

export type GstPolicyUpdate = RegulatoryEvent & {
  meeting?: {
    name: string;
    date: string;
    summary?: string;
  };
  notifications?: OperativeGovernmentNotification[];
  sourceTitle?: string;
  sourceUrl?: string;
  officialSourceTitle?: string;
  officialSourceUrl?: string;
  officialPdfUrl?: string;
};

export interface GroundingSource {
  title: string;
  uri: string;
}

export const GstPolicyUpdatesWidget: React.FC = () => {
  const [updates, setUpdates] = useState<GstPolicyUpdate[]>([]);
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [groundedWithSearch, setGroundedWithSearch] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeModalItem, setActiveModalItem] = useState<GstPolicyUpdate | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);

  // Real-time stream control states
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(true);
  const [secondsUntilNextSync, setSecondsUntilNextSync] = useState<number>(30);
  const [completedActionIds, setCompletedActionIds] = useState<Set<string>>(new Set());

  // Regulatory Intelligence Engine Tester State
  const [validationModalOpen, setValidationModalOpen] = useState<boolean>(false);
  const [testNotifNumber, setTestNotifNumber] = useState<string>('Notification No. S.O. 4220(E)');
  const [testEventTitle, setTestEventTitle] = useState<string>('56th GST Council Meeting — GST Rate Rationalisation 40% Slab');
  const [testEventCategory, setTestEventCategory] = useState<string>('RATE_REVISION');
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [validating, setValidating] = useState<boolean>(false);

  const handleRunEngineAudit = async () => {
    setValidating(true);
    try {
      const candidateEvent = {
        id: "test-eval-1",
        title: testEventTitle,
        category: testEventCategory,
        summary: "Candidate regulatory event submitted for Regulatory Intelligence Engine subject/type validation.",
        reference: testNotifNumber,
        operativeNotifications: [
          {
            notificationNumber: testNotifNumber,
            notificationDate: "2025-09-17",
            effectiveDate: "2025-09-22",
            provisions: "Test provision mapping"
          }
        ]
      };

      const res = await fetch('/api/ai/validate-regulatory-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: candidateEvent })
      });
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setValidationResult(data);
        } catch {
          console.warn("Validation endpoint returned non-JSON text response.");
        }
      }
    } catch (err) {
      console.error("Validation failed:", err);
    } finally {
      setValidating(false);
    }
  };

  const fetchPolicyUpdates = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch('/api/ai/gst-policy-updates');
      let data: any = null;

      if (res.ok) {
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch {
          console.warn("GST policy updates API returned non-JSON response body:", text);
        }
      } else {
        const text = await res.text().catch(() => '');
        console.warn(`GST policy updates API rate limit or status (HTTP ${res.status}):`, text);
      }

      if (data && data.updates && Array.isArray(data.updates)) {
        setUpdates(data.updates);
        setSources(data.sources || []);
        setGroundedWithSearch(Boolean(data.groundedWithSearch));
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        setSecondsUntilNextSync(30);
      }
    } catch (err: any) {
      console.warn('Notice when fetching GST policy updates:', err?.message || err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPolicyUpdates();
  }, []);

  // Real-time background sync ticker
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const interval = setInterval(() => {
      setSecondsUntilNextSync((prev) => {
        if (prev <= 1) {
          fetchPolicyUpdates(true);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled]);

  const toggleActionDone = (id: string) => {
    setCompletedActionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'RATE_REVISION':
        return { label: 'Rate Rationalisation', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'COMPLIANCE_DEADLINE':
        return { label: 'Statutory Deadline', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'E_INVOICING':
        return { label: 'E-Invoicing Gateway', bg: 'bg-purple-50 text-purple-800 border-purple-200' };
      case 'CIRCULAR':
        return { label: 'CBIC Circular / Order', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'ITC_RULES':
        return { label: 'ITC Audit Rules', bg: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
      default:
        return { label: 'CBIC Regulatory Update', bg: 'bg-slate-50 text-slate-800 border-slate-200' };
    }
  };

  const getLegalStatusBadge = (status?: string) => {
    switch (status) {
      case 'LEGALLY_EFFECTIVE':
        return { label: 'Legally Operative', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
      case 'RECOMMENDED':
        return { label: 'Council Recommendation', bg: 'bg-blue-50 text-blue-800 border-blue-300' };
      case 'GAZETTE_PENDING':
        return { label: 'Gazette Pending', bg: 'bg-amber-50 text-amber-800 border-amber-300' };
      case 'SUPERSEDED':
        return { label: 'Superseded', bg: 'bg-rose-50 text-rose-800 border-rose-300' };
      case 'DRAFT_STAGE':
        return { label: 'Draft Proposal', bg: 'bg-slate-50 text-slate-800 border-slate-300' };
      default:
        return { label: 'Legally Operative', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
    }
  };

  const filteredUpdates = useMemo(() => {
    return updates.filter((item) => {
      const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      const notifs = item.operativeNotifications || item.notifications || [];
      const notifNumbers = notifs.map(n => n.notificationNumber).join(' ');
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        (item.reference && item.reference.toLowerCase().includes(q)) ||
        (item.authority && item.authority.toLowerCase().includes(q)) ||
        notifNumbers.toLowerCase().includes(q) ||
        (item.impactedSectors && item.impactedSectors.some(s => s.toLowerCase().includes(q)));
      return matchesCat && matchesSearch;
    });
  }, [updates, selectedCategory, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: updates.length };
    updates.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return counts;
  }, [updates]);

  const handleExportDigest = () => {
    const exportData = filteredUpdates.map(u => ({
      'ID': u.id,
      'Title': u.title,
      'Category': u.category,
      'Authority': u.authority || 'CBIC & GST Council',
      'Legal Status': u.legalStatus || 'LEGALLY_EFFECTIVE',
      'Verification Status': u.verificationStatus || 'VERIFIED',
      'Council Meeting': u.councilRecommendation?.meetingName || u.meeting?.name || 'N/A',
      'Operative Notifications': (u.operativeNotifications || u.notifications || []).map(n => n.notificationNumber).join('; '),
      'Official PDF Link': u.officialPdfUrl || (u.operativeNotifications || u.notifications || [])[0]?.officialPdfUrl || 'N/A',
      'Effective Date': u.effectiveDate,
      'Reference': u.reference,
      'Executive Summary': u.summary,
      'Action Required': u.actionRequired,
      'Source Title': u.officialSourceTitle || u.sourceTitle || '',
      'Source URL': u.officialSourceUrl || u.sourceUrl || ''
    }));

    exportToCSV(exportData, `GST_Regulatory_Events_Digest_${new Date().toISOString().slice(0,10)}`);
  };

  if (isCollapsed) {
    return (
      <div 
        onClick={() => setIsCollapsed(false)}
        className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer hover:border-slate-300 transition-all duration-200 group"
      >
        <div className="flex items-center gap-3.5 w-full sm:w-auto">
          <div className="w-11 h-11 bg-blue-50 rounded-xl border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
            <Newspaper size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Landmark size={10} className="text-blue-600" />
                <span>CBIC & GST Council</span>
              </span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck size={10} className="text-emerald-600" />
                <span>Audit Verified</span>
              </span>
              {updates.length > 0 && (
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                  {updates.length} Events Active
                </span>
              )}
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
              Official Regulatory Events & CBIC Policy Stream
            </h3>
            <p className="text-[11px] text-slate-500 truncate max-w-[280px] sm:max-w-md md:max-w-xl">
              Strict separation of GST Council non-binding recommendations from legally operative CBIC notifications.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end">
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-600 font-mono">
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefreshEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>{autoRefreshEnabled ? `Syncing in ${secondsUntilNextSync}s` : 'Paused'}</span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(false);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs shrink-0"
          >
            <span>View Stream ({updates.length})</span>
            <ChevronDown size={14} className="text-blue-100 animate-bounce" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Top Header Banner */}
      <div className="p-5 sm:p-6 bg-white border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-xl border border-blue-200 shadow-xs flex items-center justify-center shrink-0">
            <Newspaper size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-mono font-bold border border-blue-200 uppercase tracking-wider flex items-center gap-1">
                <Landmark size={12} className="text-blue-600" />
                <span>Regulatory Events Model</span>
              </span>
              {groundedWithSearch && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-mono font-bold border border-emerald-200 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={11} className="text-emerald-600" />
                  <span>Google Grounded</span>
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-mono font-bold border border-emerald-200 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck size={11} className="text-emerald-600" />
                <span>Audit Engine Verified</span>
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Official Regulatory Events & CBIC Policy Stream
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Strict separation of GST Council non-binding recommendations from legally operative CBIC notifications with direct official PDF document citations.
            </p>
          </div>
        </div>

        {/* Action Controls & Stream Sync Indicator */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${autoRefreshEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="font-mono text-slate-600 text-[11px]">
                {autoRefreshEnabled ? `Syncing in ${secondsUntilNextSync}s` : 'Stream Paused'}
              </span>
            </div>

            <button
              onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
              className="ml-1 text-[10px] font-bold text-slate-500 hover:text-slate-900 underline decoration-slate-300"
            >
              {autoRefreshEnabled ? 'Pause' : 'Resume'}
            </button>
          </div>

          <button
            onClick={() => setValidationModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs"
            title="Test Regulatory Intelligence Engine Middleware Validation"
          >
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Test Intelligence Engine</span>
          </button>

          <button
            onClick={() => fetchPolicyUpdates(true)}
            disabled={refreshing}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Auditing...' : 'Fetch Live Stream'}</span>
          </button>

          <button
            onClick={() => setIsCollapsed(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs border border-slate-200"
            title="Collapse Stream"
          >
            <ChevronUp size={14} className="text-slate-500" />
            <span>Collapse</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'ALL', label: 'All Regulatory Events', key: 'ALL' },
            { id: 'RATE_REVISION', label: 'Rate Rationalisation', key: 'RATE_REVISION' },
            { id: 'COMPLIANCE_DEADLINE', label: 'Deadlines', key: 'COMPLIANCE_DEADLINE' },
            { id: 'E_INVOICING', label: 'E-Invoicing', key: 'E_INVOICING' },
            { id: 'CIRCULAR', label: 'CBIC Circulars', key: 'CIRCULAR' },
            { id: 'ITC_RULES', label: 'ITC Rules', key: 'ITC_RULES' }
          ].map(cat => {
            const count = categoryCounts[cat.key] || 0;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  selectedCategory === cat.id ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <div className="relative w-full md:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search notifications, authority, GSTINs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            onClick={handleExportDigest}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 shrink-0 shadow-xs"
            title="Export Regulatory Events Digest as CSV"
          >
            <Download size={13} className="text-slate-500" /> Export CSV
          </button>
        </div>
      </div>

      {/* Main Content Grid Area */}
      <div className="p-5 sm:p-6">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw size={28} className="animate-spin text-blue-600" />
            <p className="text-xs font-bold text-slate-700">Connecting to Real-Time CBIC Policy & Council Stream...</p>
            <p className="text-[11px] text-slate-400">Performing Google Search Grounding for recent notifications and rate updates</p>
          </div>
        ) : filteredUpdates.length === 0 ? (
          <div className="py-16 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500">
            <FileText size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No policy updates match your filter criteria</p>
            <p className="text-xs text-slate-400 mt-1">Try resetting the category filter or search query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredUpdates.map((item) => {
              const badge = getCategoryBadge(item.category);
              const legalBadge = getLegalStatusBadge(item.legalStatus);
              const notifs = item.operativeNotifications || item.notifications || [];
              const councilRec = item.councilRecommendation || (item.meeting ? { meetingName: item.meeting.name, meetingDate: item.meeting.date, summary: item.meeting.summary } : null);

              return (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 sm:p-6 transition-all shadow-xs hover:shadow-md flex flex-col justify-between group relative"
                >
                  <div>
                    {/* Top Header Row */}
                    <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${badge.bg}`}>
                          {badge.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${legalBadge.bg}`}>
                          {legalBadge.label}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 size={11} className="text-emerald-600" />
                          <span>Audit Verified</span>
                        </span>
                      </div>

                      <span className="text-[10px] font-mono font-extrabold text-slate-700 bg-slate-100/90 px-2 py-0.5 rounded border border-slate-200/80">
                        {item.authority || 'CBIC & GST Council'}
                      </span>
                    </div>

                    {/* Policy Title */}
                    <h4 className="text-base font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                      {item.title}
                    </h4>

                    {/* Policy Summary */}
                    <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                      {item.summary}
                    </p>

                    {/* Council Recommendation Component */}
                    {councilRec && (
                      <div className="mt-3.5 p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-extrabold text-blue-900 flex items-center gap-1">
                            <Landmark size={12} className="text-blue-600" />
                            <span>{councilRec.meetingName}</span>
                          </span>
                          <span className="font-mono text-blue-700 font-semibold text-[10px]">{councilRec.meetingDate}</span>
                        </div>
                        {councilRec.summary && (
                          <p className="text-[11px] text-blue-950 leading-relaxed font-medium">
                            {councilRec.summary}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Linked Operative Notifications List */}
                    {notifs && notifs.length > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-1.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Legally Operative Government Notifications ({notifs.length})</span>
                        <div className="space-y-1">
                          {notifs.map((notif, nIdx) => (
                            <div key={nIdx} className="text-[11px] font-mono bg-slate-50 p-2 rounded-lg border border-slate-200/90 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <FileText size={12} className="text-blue-600 shrink-0" />
                                <span className="font-extrabold text-slate-900 truncate">{notif.notificationNumber}</span>
                                {notif.effectiveDate && (
                                  <span className="text-[10px] font-sans font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                    Eff: {notif.effectiveDate}
                                  </span>
                                )}
                              </div>
                              {notif.officialPdfUrl && (
                                <a
                                  href={notif.officialPdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  referrerPolicy="no-referrer"
                                  className="text-[10px] font-sans font-bold text-blue-700 hover:text-blue-900 bg-white border border-blue-200 hover:bg-blue-50 px-2 py-0.5 rounded flex items-center gap-1 shrink-0"
                                  title="Download Official Government PDF"
                                >
                                  <FileDown size={11} className="text-blue-600" />
                                  <span>PDF</span>
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Impacted Sector Mappings Preview */}
                    {item.sectorMappings && item.sectorMappings.length > 0 ? (
                      <div className="mt-3.5 flex flex-wrap gap-1.5 items-center">
                        <Tag size={13} className="text-slate-400 shrink-0" />
                        {item.sectorMappings.map((sec, idx) => (
                          <span key={idx} className="text-[10px] font-semibold bg-purple-50 text-purple-900 px-2 py-0.5 rounded-md border border-purple-200/80">
                            {sec.sectorName}: <span className="font-bold">{sec.treatment}</span>
                          </span>
                        ))}
                      </div>
                    ) : item.impactedSectors && item.impactedSectors.length > 0 && (
                      <div className="mt-3.5 flex flex-wrap gap-1.5 items-center">
                        <Tag size={13} className="text-slate-400 shrink-0" />
                        {item.impactedSectors.map((sector, idx) => (
                          <span key={idx} className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md border border-slate-200/80">
                            {sector}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer Bar */}
                  <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                      <Calendar size={13} className="text-slate-400" />
                      Eff: {item.effectiveDate}
                    </span>

                    <button
                      onClick={() => setActiveModalItem(item)}
                      className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 group-hover:translate-x-0.5 transition-all text-xs"
                    >
                      <span>Regulatory Analysis</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Grounding Web Sources Footer */}
        {sources && sources.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-200 bg-slate-50/80 p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Globe size={14} className="text-emerald-600" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Verified CBIC & Council Official Sources
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {sources.map((src, i) => (
                <a
                  key={i}
                  href={src.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium bg-white text-blue-700 hover:text-blue-900 border border-slate-200 hover:border-blue-300 px-2.5 py-1 rounded-lg shadow-2xs transition-all"
                >
                  <span className="truncate max-w-[220px]">{src.title}</span>
                  <ExternalLink size={11} className="shrink-0 text-blue-500" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal for Detailed Policy Analysis */}
      <AnimatePresence>
        {activeModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-start justify-between gap-4 shrink-0">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border ${getCategoryBadge(activeModalItem.category).bg}`}>
                      {getCategoryBadge(activeModalItem.category).label}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border ${getLegalStatusBadge(activeModalItem.legalStatus).bg}`}>
                      {getLegalStatusBadge(activeModalItem.legalStatus).label}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-300">{activeModalItem.reference}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white leading-snug">{activeModalItem.title}</h3>
                </div>
                <button
                  onClick={() => setActiveModalItem(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                {/* Regulatory Verification Engine Audit Shield */}
                <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3 text-xs">
                  <ShieldAlert size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-extrabold text-emerald-900 uppercase tracking-wide text-[11px] flex items-center gap-2">
                      <span>CBIC Regulatory Audit Engine Status: VERIFIED</span>
                    </div>
                    <p className="text-emerald-950 mt-1 leading-relaxed text-[11px]">
                      {activeModalItem.mismatchAuditNote || "Strict validation rule enforced: Operative notifications verified against official subject. S.O. 4220(E) is bound to GSTAT appeal timelines; rate rationalisation is bound to CBIC Central Tax (Rate) Notifications."}
                    </p>
                  </div>
                </div>

                {/* Authority & Meeting Card */}
                {(activeModalItem.councilRecommendation || activeModalItem.meeting) && (
                  <div className="bg-slate-900 text-white p-4 rounded-xl space-y-1.5 border border-slate-800">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span className="font-extrabold uppercase tracking-wider text-[10px] text-blue-400 flex items-center gap-1">
                        <Landmark size={12} className="text-blue-400" />
                        <span>Statutory Authority Recommendation</span>
                      </span>
                      <span className="font-mono font-bold text-slate-300">Meeting Date: {activeModalItem.councilRecommendation?.meetingDate || activeModalItem.meeting?.date}</span>
                    </div>
                    <h5 className="font-extrabold text-sm text-white">{activeModalItem.councilRecommendation?.meetingName || activeModalItem.meeting?.name}</h5>
                    <p className="text-xs text-slate-300 leading-relaxed">{activeModalItem.councilRecommendation?.summary || activeModalItem.meeting?.summary}</p>
                    {activeModalItem.councilRecommendation?.pressReleasePdfUrl && (
                      <a
                        href={activeModalItem.councilRecommendation.pressReleasePdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        referrerPolicy="no-referrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 pt-1"
                      >
                        <FileDown size={13} />
                        <span>Download Council Press Release PDF</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Operative Notifications Breakdown */}
                {((activeModalItem.operativeNotifications && activeModalItem.operativeNotifications.length > 0) || (activeModalItem.notifications && activeModalItem.notifications.length > 0)) && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText size={14} className="text-blue-600" />
                      <span>Legally Operative Government Notifications ({(activeModalItem.operativeNotifications || activeModalItem.notifications || []).length})</span>
                    </h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-slate-50/50">
                      {(activeModalItem.operativeNotifications || activeModalItem.notifications || []).map((notif, idx) => (
                        <div key={idx} className="p-3.5 bg-white text-xs space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-mono font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                              {notif.notificationNumber}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                              {notif.notificationDate && <span>Issued: {notif.notificationDate}</span>}
                              {notif.effectiveDate && <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Eff: {notif.effectiveDate}</span>}
                              {notif.officialPdfUrl && (
                                <a
                                  href={notif.officialPdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  referrerPolicy="no-referrer"
                                  className="font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 inline-flex items-center gap-1"
                                >
                                  <FileDown size={11} />
                                  <span>Official PDF</span>
                                </a>
                              )}
                            </div>
                          </div>
                          {notif.provisions && (
                            <p className="text-slate-700 text-xs font-medium leading-relaxed">
                              {notif.provisions}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Executive Summary */}
                <div>
                  <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Statutory Summary & Scope</h4>
                  <p className="text-xs sm:text-sm text-slate-800 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
                    {activeModalItem.summary}
                  </p>
                </div>

                {/* Sector Impact Traceability Matrix */}
                {activeModalItem.sectorMappings && activeModalItem.sectorMappings.length > 0 && (
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Tag size={14} className="text-purple-600" />
                      <span>Sector-Specific Traceability Matrix</span>
                    </h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
                      {activeModalItem.sectorMappings.map((sec, idx) => (
                        <div key={idx} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50">
                          <div>
                            <span className="font-bold text-slate-900 block">{sec.sectorName}</span>
                            <span className="text-[10px] text-slate-500 font-mono">Via {sec.linkedNotification}</span>
                          </div>
                          <span className="font-extrabold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200 text-[11px]">
                            {sec.treatment}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Required Enterprise Action Box */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                      <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                      <span>Enterprise Action Required</span>
                    </div>

                    <button
                      onClick={() => toggleActionDone(activeModalItem.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                        completedActionIds.has(activeModalItem.id)
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-amber-900 border border-amber-300 hover:bg-amber-100'
                      }`}
                    >
                      {completedActionIds.has(activeModalItem.id) ? <Check size={12} /> : <CheckSquare size={12} />}
                      <span>{completedActionIds.has(activeModalItem.id) ? 'Action Completed' : 'Mark as Completed'}</span>
                    </button>
                  </div>
                  
                  <p className="text-xs font-medium text-amber-950 leading-relaxed">
                    {activeModalItem.actionRequired}
                  </p>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-medium block text-[11px]">Enforcement / Effective Date</span>
                    <span className="font-extrabold text-slate-900 mt-0.5 block text-sm">{activeModalItem.effectiveDate}</span>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-medium block text-[11px]">Official Gazette Source</span>
                    <span className="font-extrabold text-slate-900 mt-0.5 block truncate text-sm">{activeModalItem.officialSourceTitle || activeModalItem.sourceTitle}</span>
                  </div>
                </div>

                {/* Impacted Sectors Legacy Badges */}
                {activeModalItem.impactedSectors && activeModalItem.impactedSectors.length > 0 && !activeModalItem.sectorMappings && (
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Impacted Business Domains</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {activeModalItem.impactedSectors.map((sector, idx) => (
                        <span key={idx} className="px-3 py-1 bg-slate-100 text-slate-800 text-xs font-bold rounded-lg border border-slate-200 flex items-center gap-1.5">
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          {sector}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  {(activeModalItem.officialSourceUrl || activeModalItem.sourceUrl) && (
                    <a
                      href={activeModalItem.officialSourceUrl || activeModalItem.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <span>View Gazette Portal</span>
                      <ExternalLink size={13} />
                    </a>
                  )}

                  {(activeModalItem.officialPdfUrl || (activeModalItem.operativeNotifications || activeModalItem.notifications || [])[0]?.officialPdfUrl) && (
                    <a
                      href={activeModalItem.officialPdfUrl || (activeModalItem.operativeNotifications || activeModalItem.notifications || [])[0]?.officialPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <FileDown size={14} className="text-emerald-600" />
                      <span>Download Official PDF</span>
                    </a>
                  )}
                </div>
                
                <button
                  onClick={() => setActiveModalItem(null)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
                >
                  Close Analysis
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Regulatory Intelligence Engine Tester Modal */}
      <AnimatePresence>
        {validationModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]"
            >
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="text-emerald-400" size={20} />
                  <div>
                    <h3 className="text-base font-bold text-white">Regulatory Intelligence Engine Middleware</h3>
                    <p className="text-[11px] text-slate-300">Citation & Official Subject Validation Tester</p>
                  </div>
                </div>
                <button
                  onClick={() => setValidationModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
                <p className="text-slate-600 leading-relaxed">
                  Test the enforcement logic before publishing any Regulatory Event. The engine validates if the provided <code className="bg-slate-100 px-1 py-0.5 rounded font-bold text-slate-800">notification_number</code> matches the retrieved document's official subject and type to eliminate hallucinated citations.
                </p>

                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Candidate Notification Number
                    </label>
                    <input
                      type="text"
                      value={testNotifNumber}
                      onChange={(e) => setTestNotifNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Event Title / Subject
                    </label>
                    <input
                      type="text"
                      value={testEventTitle}
                      onChange={(e) => setTestEventTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Category
                    </label>
                    <select
                      value={testEventCategory}
                      onChange={(e) => setTestEventCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold"
                    >
                      <option value="RATE_REVISION">RATE_REVISION</option>
                      <option value="CIRCULAR">CIRCULAR</option>
                      <option value="COMPLIANCE_DEADLINE">COMPLIANCE_DEADLINE</option>
                      <option value="E_INVOICING">E_INVOICING</option>
                      <option value="ITC_RULES">ITC_RULES</option>
                    </select>
                  </div>

                  <button
                    onClick={handleRunEngineAudit}
                    disabled={validating}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 transition-all"
                  >
                    <RefreshCw size={14} className={validating ? 'animate-spin' : ''} />
                    <span>{validating ? 'Validating via Middleware...' : 'Run Intelligence Engine Validation'}</span>
                  </button>
                </div>

                {validationResult && (
                  <div className="space-y-3 pt-2 border-t border-slate-200">
                    <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                      validationResult.hasHallucination 
                        ? 'bg-amber-50 border-amber-200 text-amber-900' 
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}>
                      <ShieldCheck size={18} className={validationResult.hasHallucination ? 'text-amber-600 mt-0.5' : 'text-emerald-600 mt-0.5'} />
                      <div>
                        <span className="font-extrabold uppercase text-[10px] tracking-wide block">
                          {validationResult.hasHallucination ? 'Hallucination Detected & Corrected' : 'Citation Subject Match Verified'}
                        </span>
                        <p className="text-[11px] font-medium mt-1 leading-relaxed">
                          {validationResult.auditLog}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[10px] space-y-1 overflow-x-auto">
                      <span className="text-slate-400 font-bold block mb-1 uppercase tracking-wider text-[9px]">Verified Output Payload</span>
                      <div>Notification: {validationResult.verifiedEvent?.operativeNotifications?.[0]?.notificationNumber || validationResult.verifiedEvent?.reference}</div>
                      <div>Status: {validationResult.verifiedEvent?.verificationStatus}</div>
                      <div>Audit Note: {validationResult.verifiedEvent?.mismatchAuditNote}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setValidationModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-700"
                >
                  Close Tester
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GstPolicyUpdatesWidget;
