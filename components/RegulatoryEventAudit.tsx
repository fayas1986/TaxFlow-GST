import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, FileText, Calendar, Bell, ShieldAlert, CheckCircle2,
  AlertCircle, ChevronRight, RefreshCw, Layers, Check, Play,
  Settings, History, Info, BookOpen, User, Sparkles, Clock, Globe,
  ThumbsUp, ThumbsDown, Edit3, Save, Search, HelpCircle, ArrowRight,
  FileCheck, ExternalLink, AlertTriangle, Plus, ClipboardList
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { verifyCbicEvent, CbicOfficialNotification } from '../services/cbicValidationService';

interface OperativeNotification {
  notificationNumber: string;
  notificationDate: string;
  effectiveDate: string;
  provisions: string;
  impactedCategory: string;
  officialPdfUrl?: string;
}

interface RegulatoryEvent {
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

// Canonical documents in the registry for cross-referencing reference
const CBIC_OFFICIAL_REGISTRY = [
  {
    key: 'S.O. 4220(E)',
    canonicalSubject: 'GST Appellate Tribunal (GSTAT) Appeal Filing Window & Timelines',
    category: 'CIRCULAR',
    documentType: 'STATUTORY_ORDER',
    officialPdfUrl: 'https://cbic-gst.gov.in/pdf/so-4220-e-gstat-timelines.pdf',
    description: 'Statutory transitional appeal filing window before GSTAT up to 30 June 2026.'
  },
  {
    key: '01/2025-Central Tax (Rate)',
    canonicalSubject: 'Abolition of 12% & 28% slabs; re-alignment to 5% and 18% schedules',
    category: 'RATE_REVISION',
    documentType: 'GAZETTE_NOTIFICATION',
    officialPdfUrl: 'https://cbic-gst.gov.in/pdf/notif-01-2025-ct-rate.pdf',
    description: 'Abolishes the 12% & 28% rate slabs, restructuring items to 5% and 18% schedules.'
  },
  {
    key: '02/2025-Central Tax (Rate)',
    canonicalSubject: 'Special 40% GST Rate Schedule for Specified Luxury and Sin Goods',
    category: 'RATE_REVISION',
    documentType: 'GAZETTE_NOTIFICATION',
    officialPdfUrl: 'https://cbic-gst.gov.in/pdf/notif-02-2025-ct-rate.pdf',
    description: 'Creates a special 40% GST rate bracket for premium automobiles, aerated drinks, and tobacco products.'
  },
  {
    key: '03/2025-Central Tax (Rate)',
    canonicalSubject: 'Exemption on Individual Health and Life Insurance Premiums',
    category: 'RATE_REVISION',
    documentType: 'GAZETTE_NOTIFICATION',
    officialPdfUrl: 'https://cbic-gst.gov.in/pdf/notif-03-2025-ct-rate.pdf',
    description: 'Exempts co-contributions on life and health insurance premiums from GST.'
  },
  {
    key: '10/2026-Central Tax',
    canonicalSubject: 'Lowering Aggregate Annual Turnover threshold for mandatory e-invoicing to ₹5Cr',
    category: 'E_INVOICING',
    documentType: 'GAZETTE_NOTIFICATION',
    officialPdfUrl: 'https://cbic-gst.gov.in/pdf/notif-10-2026-einvoice-5cr.pdf',
    description: 'Lowers the applicability threshold for mandatory IRN generation from ₹10Cr to ₹5Cr AATO.'
  },
  {
    key: 'Circular No. 256/02/2026-Central Tax',
    canonicalSubject: 'GSTAT Departmental Appeals regarding Common Adjudicating Authorities in DGGI Cases',
    category: 'CIRCULAR',
    documentType: 'CIRCULAR',
    officialPdfUrl: 'https://cbic-gst.gov.in/pdf/circular-256-02-2026.pdf',
    description: 'Sets guidelines for departmental appeals and centralized common jurisdiction.'
  },
  {
    key: 'Circular No. 240/2026-Central Tax',
    canonicalSubject: 'Technology-enforced regulatory structure and automatic filing lockouts (GST 2.0)',
    category: 'COMPLIANCE_DEADLINE',
    documentType: 'CIRCULAR',
    officialPdfUrl: 'https://cbic-gst.gov.in/pdf/circular-240-2026-gst-framework.pdf',
    description: 'Enforces rigid technology locks on non-compliant returns and tax mismatches.'
  }
];

export const RegulatoryEventAudit: React.FC = () => {
  const queryClient = useQueryClient();
  const user = useSelector((state: RootState) => state.auth.user);
  const userEmail = user?.email || 'admin@taxflow.com';

  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'TEST_INJECT'>('PENDING');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [mismatchEvent, setMismatchEvent] = useState<RegulatoryEvent | null>(null);
  
  // Custom CBIC alignment validation conflict state
  const [conflictDetails, setConflictDetails] = useState<{
    notificationNumber: string;
    message: string;
    canonicalSubject?: string;
    officialPdfUrl?: string;
    category?: string;
    provisionsSummary?: string;
    isSimulation?: boolean;
  } | null>(null);
  
  // Editing state for active audit workspace
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<RegulatoryEvent['category']>('CIRCULAR');
  const [editReference, setEditReference] = useState('');
  const [editNotifNumber, setEditNotifNumber] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editEffectiveDate, setEditEffectiveDate] = useState('');
  const [editActionRequired, setEditActionRequired] = useState('');
  const [editPdfUrl, setEditPdfUrl] = useState('');

  // Live validation feedback
  const [isValidating, setIsValidating] = useState(false);
  const [validationFeedback, setValidationFeedback] = useState<{
    isValid: boolean;
    hasHallucination: boolean;
    auditLog: string;
  } | null>(null);

  // Custom simulation event states
  const [simTitle, setSimTitle] = useState('');
  const [simCategory, setSimCategory] = useState<RegulatoryEvent['category']>('CIRCULAR');
  const [simReference, setSimReference] = useState('');
  const [simNotifNumber, setSimNotifNumber] = useState('');
  const [simSummary, setSimSummary] = useState('');
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch all audit list events
  const { data: auditData, isLoading: isAuditLoading, refetch: refetchAuditList } = useQuery({
    queryKey: ['regulatoryAuditEvents'],
    queryFn: async () => {
      const res = await fetch('/api/v1/compliance/regulatory/audit/events');
      if (!res.ok) throw new Error('Failed to fetch audit events');
      const data = await res.json();
      return data.events as RegulatoryEvent[];
    }
  });

  const filteredEvents = React.useMemo(() => {
    if (!auditData) return [];
    return auditData.filter(evt => evt.approvalStatus === activeTab);
  }, [auditData, activeTab]);

  const selectedEvent = React.useMemo(() => {
    if (!auditData || !selectedEventId) return null;
    return auditData.find(evt => evt.id === selectedEventId) || null;
  }, [auditData, selectedEventId]);

  // Set form inputs when an event is selected
  useEffect(() => {
    if (selectedEvent) {
      setEditTitle(selectedEvent.title);
      setEditCategory(selectedEvent.category);
      setEditReference(selectedEvent.reference);
      const notifNum = selectedEvent.operativeNotifications?.[0]?.notificationNumber || selectedEvent.reference || '';
      setEditNotifNumber(notifNum);
      setEditSummary(selectedEvent.summary);
      setEditEffectiveDate(selectedEvent.effectiveDate);
      setEditActionRequired(selectedEvent.actionRequired || '');
      setEditPdfUrl(selectedEvent.officialPdfUrl || 'https://cbic-gst.gov.in/pdf/gazette-notification.pdf');
      setValidationFeedback(null);
    } else {
      setEditTitle('');
      setEditReference('');
      setEditNotifNumber('');
      setEditSummary('');
      setEditEffectiveDate('');
      setEditActionRequired('');
      setEditPdfUrl('');
      setValidationFeedback(null);
    }
  }, [selectedEvent, selectedEventId]);

  // Trigger live engine validation
  const handleLiveEngineValidate = async () => {
    if (!editTitle || !editNotifNumber) {
      showToast('Title and Notification Number are required for validation', 'error');
      return;
    }

    setIsValidating(true);
    setValidationFeedback(null);

    try {
      const payload = {
        title: editTitle,
        category: editCategory,
        reference: editReference,
        summary: editSummary,
        operativeNotifications: [
          {
            notificationNumber: editNotifNumber,
            notificationDate: editEffectiveDate,
            effectiveDate: editEffectiveDate,
            provisions: editSummary,
            impactedCategory: editCategory,
            officialPdfUrl: editPdfUrl
          }
        ],
        effectiveDate: editEffectiveDate,
        officialPdfUrl: editPdfUrl
      };

      const res = await fetch('/api/v1/compliance/regulatory/audit/events/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Live validation engine failed');
      const data = await res.json();
      
      setValidationFeedback({
        isValid: data.isValid,
        hasHallucination: data.hasHallucination,
        auditLog: data.auditLog
      });

      // Update local inputs with any engine-corrected variables (e.g. anti-hallucination re-mappings)
      if (data.verifiedEvent) {
        if (data.verifiedEvent.reference && data.verifiedEvent.reference !== editReference) {
          setEditReference(data.verifiedEvent.reference);
        }
        if (data.verifiedEvent.operativeNotifications?.[0]?.notificationNumber && data.verifiedEvent.operativeNotifications[0].notificationNumber !== editNotifNumber) {
          setEditNotifNumber(data.verifiedEvent.operativeNotifications[0].notificationNumber);
        }
        if (data.verifiedEvent.officialPdfUrl && data.verifiedEvent.officialPdfUrl !== editPdfUrl) {
          setEditPdfUrl(data.verifiedEvent.officialPdfUrl);
        }
      }

      showToast('Regulatory verification check complete', 'info');
    } catch (err: any) {
      showToast(err.message || 'Validation error', 'error');
    } finally {
      setIsValidating(false);
    }
  };

  // Approve and Publish mutation
  const approveMutation = useMutation({
    mutationFn: async (payload: { id: string; updatedEvent: any }) => {
      const res = await fetch('/api/v1/compliance/regulatory/audit/events/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: payload.id,
          updatedEvent: payload.updatedEvent,
          approvedBy: userEmail
        })
      });
      if (!res.ok) throw new Error('Approval request failed');
      return res.json();
    },
    onSuccess: (data) => {
      showToast(`Successfully authorized and published: ${data.event.title}`, 'success');
      setSelectedEventId(null);
      refetchAuditList();
      // Invalidate normal policy queries so dashboard widgets update instantly
      queryClient.invalidateQueries({ queryKey: ['regulatoryChanges'] });
      queryClient.invalidateQueries({ queryKey: ['gstPolicyUpdates'] });
    },
    onError: (err: any) => {
      showToast(err.message, 'error');
    }
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch('/api/v1/compliance/regulatory/audit/events/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, approvedBy: userEmail })
      });
      if (!res.ok) throw new Error('Rejection request failed');
      return res.json();
    },
    onSuccess: () => {
      showToast('Event rejected and withheld from publication', 'info');
      setSelectedEventId(null);
      refetchAuditList();
    },
    onError: (err: any) => {
      showToast(err.message, 'error');
    }
  });

  // Submit Simulated Raw Event
  const injectMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch('/api/v1/compliance/regulatory/audit/events/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (errData && errData.conflict) {
          throw errData;
        }
        throw new Error('Injected submission failed');
      }
      return res.json();
    },
    onSuccess: () => {
      showToast('Simulated unverified regulatory update queued successfully!', 'success');
      setSimTitle('');
      setSimReference('');
      setSimNotifNumber('');
      setSimSummary('');
      setActiveTab('PENDING');
      refetchAuditList();
    },
    onError: (err: any) => {
      if (err && err.conflict) {
        setConflictDetails({
          notificationNumber: err.notifNum || simNotifNumber,
          message: err.error || err.message,
          canonicalSubject: err.canonicalDetails?.canonicalSubject || '',
          officialPdfUrl: err.canonicalDetails?.officialPdfUrl || '',
          category: err.canonicalDetails?.category || '',
          provisionsSummary: err.canonicalDetails?.provisionsSummary || '',
          isSimulation: true
        });
        showToast('Conflict Detected: Verification failed prior to queueing', 'error');
      } else {
        showToast(err.message || 'Submission failed', 'error');
      }
    }
  });

  const handleSimInject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simTitle || !simNotifNumber) {
      showToast('Simulated event requires a Title and Notification Number', 'error');
      return;
    }

    const payload = {
      title: simTitle,
      category: simCategory,
      reference: simReference || simNotifNumber,
      summary: simSummary || 'No summary provided.',
      operativeNotifications: [
        {
          notificationNumber: simNotifNumber,
          notificationDate: new Date().toISOString().split('T')[0],
          effectiveDate: new Date().toISOString().split('T')[0],
          provisions: simSummary || 'Pending audit classification',
          impactedCategory: simCategory,
          officialPdfUrl: 'https://cbic-gst.gov.in/pdf/gazette-notification.pdf'
        }
      ],
      effectiveDate: new Date().toISOString().split('T')[0]
    };

    injectMutation.mutate(payload);
  };

  const handleApproveAction = () => {
    if (!selectedEventId) return;

    // Cross-verify candidate fields with official CBIC records before saving or publishing
    const verification = verifyCbicEvent(editNotifNumber, editTitle + " " + editSummary, editCategory);
    
    if (verification.hasConflict) {
      setConflictDetails({
        notificationNumber: editNotifNumber,
        message: verification.message,
        canonicalSubject: verification.canonicalDetails?.canonicalSubject,
        officialPdfUrl: verification.canonicalDetails?.officialPdfUrl,
        category: verification.canonicalDetails?.category,
        provisionsSummary: verification.canonicalDetails?.provisionsSummary
      });
      showToast('Conflict Detected: Citation mismatch with official CBIC guidelines', 'error');
      return;
    }

    const payloadEvent = {
      title: editTitle,
      category: editCategory,
      reference: editReference || editNotifNumber,
      summary: editSummary,
      effectiveDate: editEffectiveDate,
      actionRequired: editActionRequired,
      officialPdfUrl: editPdfUrl,
      operativeNotifications: [
        {
          notificationNumber: editNotifNumber,
          notificationDate: editEffectiveDate,
          effectiveDate: editEffectiveDate,
          provisions: editSummary,
          impactedCategory: editCategory,
          officialPdfUrl: editPdfUrl
        }
      ]
    };

    approveMutation.mutate({
      id: selectedEventId,
      updatedEvent: payloadEvent
    });
  };

  // Quick auto-fix helper
  const applyRegistryFix = (regItem: typeof CBIC_OFFICIAL_REGISTRY[0]) => {
    setEditNotifNumber(regItem.key);
    setEditReference(regItem.canonicalSubject);
    setEditCategory(regItem.category as any);
    setEditPdfUrl(regItem.officialPdfUrl);
    showToast(`Cross-referenced and aligned with official registry record: ${regItem.key}`, 'info');
  };

  return (
    <div className="bg-slate-50 min-height-screen py-4 space-y-6">
      
      {/* Toast Alert overlay */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-5 duration-300">
          <div className={`p-4 rounded-xl shadow-lg flex items-center gap-3 border ${
            toast.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : toast.type === 'error' 
              ? 'bg-rose-50 text-rose-800 border-rose-200' 
              : 'bg-indigo-50 text-indigo-800 border-indigo-200'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-600"/> : <AlertTriangle size={18} className="text-rose-600"/>}
            <span className="text-xs font-black uppercase tracking-wide">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">Regulatory Event Audit Workspace</h3>
          </div>
          <p className="text-slate-500 text-xs font-medium max-w-2xl">
            Authorize incoming gazette notifications and CBIC policy advisories. Ensure citation references, official PDF links, and statutory dates are correctly mapped and audited prior to public publication.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-indigo-100 text-indigo-800 font-extrabold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
            <User size={12}/> Auditor Mode Active
          </span>
          <button 
            onClick={() => { refetchAuditList(); showToast('Re-fetched live incoming stream', 'info'); }}
            className="p-2 text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all"
            title="Refresh Stream"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Top Filter Tabs & Quick Stats */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 border-b border-slate-200 pb-2">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl self-start">
          <button
            onClick={() => { setActiveTab('PENDING'); setSelectedEventId(null); }}
            className={`px-4 py-2 text-xs font-black uppercase rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'PENDING' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock size={14}/>
            Audit Queue
            {auditData && auditData.filter(e => e.approvalStatus === 'PENDING').length > 0 && (
              <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {auditData.filter(e => e.approvalStatus === 'PENDING').length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('APPROVED'); setSelectedEventId(null); }}
            className={`px-4 py-2 text-xs font-black uppercase rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'APPROVED' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 size={14}/>
            Approved & Posted
          </button>
          <button
            onClick={() => { setActiveTab('REJECTED'); setSelectedEventId(null); }}
            className={`px-4 py-2 text-xs font-black uppercase rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'REJECTED' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ThumbsDown size={14}/>
            Rejected / Shelved
          </button>
          <button
            onClick={() => { setActiveTab('TEST_INJECT'); setSelectedEventId(null); }}
            className={`px-4 py-2 text-xs font-black uppercase rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'TEST_INJECT' ? 'bg-white text-indigo-700 shadow-sm border border-indigo-200' : 'text-indigo-500 hover:text-indigo-800 hover:bg-indigo-50'
            }`}
          >
            <Plus size={14}/>
            Simulator Ingestion
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-1"><BookOpen size={13} className="text-slate-400"/> CBIC Registry Count: <strong>{CBIC_OFFICIAL_REGISTRY.length}</strong></span>
          <span className="flex items-center gap-1"><Layers size={13} className="text-slate-400"/> Total Historical Events: <strong>{auditData?.length || 0}</strong></span>
        </div>
      </div>

      {activeTab !== 'TEST_INJECT' ? (
        <div className="space-y-6">
          
          {/* Main Table for Regulatory Events */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <ClipboardList size={14} className="text-indigo-600" />
                {activeTab === 'PENDING' ? 'Pending Audit Queue Table' : activeTab === 'APPROVED' ? 'Approved & Published Gazette Registry Table' : 'Withheld / Shelved Notifications Table'}
              </h4>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                Showing {filteredEvents.length} Records
              </span>
            </div>

            {isAuditLoading ? (
              <div className="flex justify-center py-20">
                <RefreshCw size={32} className="animate-spin text-indigo-500" />
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <ClipboardList size={44} className="mx-auto text-slate-300" />
                <div className="space-y-1">
                  <p className="text-slate-800 text-xs font-bold">No Records in {activeTab} Queue</p>
                  <p className="text-slate-400 text-[11px] max-w-xs mx-auto">All incoming scrapings are currently verified and published to the client dashboard.</p>
                </div>
                {activeTab === 'PENDING' && (
                  <button 
                    onClick={() => setActiveTab('TEST_INJECT')}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-[10px] px-3.5 py-1.5 rounded-lg uppercase tracking-wide border border-indigo-100 transition-all"
                  >
                    Inject Simulated Scraped Event
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <th className="px-6 py-3">Authority</th>
                      <th className="px-6 py-3">Document Title</th>
                      <th className="px-6 py-3">Notification Number</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredEvents.map(evt => {
                      const hasMismatch = evt.verificationStatus === 'FLAGGED_MISMATCH';
                      const isSelected = evt.id === selectedEventId;
                      const notifNum = evt.operativeNotifications?.[0]?.notificationNumber || evt.reference || 'N/A';

                      return (
                        <tr 
                          key={evt.id}
                          className={`hover:bg-slate-50/50 transition-all cursor-pointer ${
                            isSelected ? 'bg-indigo-50/40' : ''
                          }`}
                          onClick={() => setSelectedEventId(evt.id)}
                        >
                          {/* Authority */}
                          <td className="px-6 py-4.5 align-middle">
                            <span className="font-extrabold text-slate-700 bg-slate-100 px-2 py-1 rounded text-[10px] uppercase tracking-wide">
                              {evt.authority || 'CBIC'}
                            </span>
                          </td>

                          {/* Document Title */}
                          <td className="px-6 py-4.5 max-w-md">
                            <div className="space-y-1">
                              <span className="font-bold text-slate-800 text-xs hover:text-indigo-600 transition-colors block">
                                {evt.title}
                              </span>
                              <p className="text-slate-400 text-[10px] font-medium leading-relaxed line-clamp-2">
                                {evt.summary}
                              </p>
                              {evt.impactedSectors && evt.impactedSectors.length > 0 && (
                                <div className="flex gap-1 flex-wrap pt-1">
                                  {evt.impactedSectors.map((sec, i) => (
                                    <span key={i} className="text-[8px] font-black uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                      {sec}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Notification Number */}
                          <td className="px-6 py-4.5 align-middle">
                            <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                              {notifNum}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4.5 align-middle">
                            {evt.approvalStatus === 'PENDING' ? (
                              <span className={`text-[9px] font-black inline-flex items-center gap-1 px-2.5 py-1 rounded-md ${
                                hasMismatch ? 'text-rose-700 bg-rose-50 border border-rose-100' : 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                              }`}>
                                {hasMismatch ? <AlertTriangle size={11} className="text-rose-500"/> : <CheckCircle2 size={11} className="text-emerald-500"/>}
                                {hasMismatch ? 'Conflict Flagged' : 'Auto-Verified'}
                              </span>
                            ) : (
                              <span className={`text-[9px] font-black inline-flex items-center gap-1 px-2.5 py-1 rounded-md ${
                                evt.approvalStatus === 'APPROVED' ? 'text-emerald-700 bg-emerald-50 border border-emerald-100' : 'text-rose-700 bg-rose-50 border border-rose-100'
                              }`}>
                                {evt.approvalStatus === 'APPROVED' ? <CheckCircle2 size={11} className="text-emerald-500"/> : <AlertCircle size={11} className="text-rose-500"/>}
                                {evt.approvalStatus}
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4.5 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                            {evt.approvalStatus === 'PENDING' ? (
                              <div className="flex gap-1.5 justify-end">
                                <button
                                  type="button"
                                  onClick={() => setSelectedEventId(evt.id)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-all"
                                  title="Review & Manual Edit"
                                >
                                  <Edit3 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => rejectMutation.mutate(evt.id)}
                                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-wide rounded-lg border border-rose-100 transition-all flex items-center gap-1"
                                >
                                  <ThumbsDown size={11} /> Reject
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Trigger verification workflow
                                    const hasMismatch = evt.verificationStatus === 'FLAGGED_MISMATCH';
                                    if (hasMismatch) {
                                      setMismatchEvent(evt);
                                    } else {
                                      const payloadEvent = {
                                        title: evt.title,
                                        category: evt.category,
                                        reference: evt.reference || notifNum,
                                        summary: evt.summary,
                                        effectiveDate: evt.effectiveDate,
                                        actionRequired: evt.actionRequired || 'Verify compliance metrics',
                                        officialPdfUrl: evt.officialPdfUrl || 'https://cbic-gst.gov.in/pdf/gazette-notification.pdf',
                                        operativeNotifications: [
                                          {
                                            notificationNumber: notifNum,
                                            notificationDate: evt.effectiveDate,
                                            effectiveDate: evt.effectiveDate,
                                            provisions: evt.summary,
                                            impactedCategory: evt.category,
                                            officialPdfUrl: evt.officialPdfUrl || 'https://cbic-gst.gov.in/pdf/gazette-notification.pdf'
                                          }
                                        ]
                                      };
                                      approveMutation.mutate({
                                        id: evt.id,
                                        updatedEvent: payloadEvent
                                      });
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-sm transition-all flex items-center gap-1 active:scale-95"
                                >
                                  <FileCheck size={11} /> Approve
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2 justify-end text-slate-400 text-[10px] font-bold">
                                {evt.reviewedBy && (
                                  <span className="bg-slate-50 border border-slate-100 px-2 py-1 rounded">
                                    Signed: {evt.reviewedBy}
                                  </span>
                                )}
                                {evt.reviewedAt && (
                                  <span className="bg-slate-50 border border-slate-100 px-2 py-1 rounded font-mono">
                                    {new Date(evt.reviewedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Interactive Collision Fix Modal / Overlay */}
          {mismatchEvent && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 animate-in zoom-in-95 duration-200 text-left space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <AlertTriangle className="text-rose-600" size={24} />
                  <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">CBIC Validation Mismatch Alert</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  The Regulatory Intelligence Engine detected a mismatch between the candidate update and the official CBIC Gazettes.
                </p>
                
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl space-y-2">
                  <span className="text-[10px] bg-rose-200 text-rose-800 font-bold px-2 py-0.5 rounded uppercase tracking-wider">Mismatch Detail</span>
                  <p className="text-[11px] font-medium text-rose-900 leading-relaxed">
                    {mismatchEvent.mismatchAuditNote || "Candidate citation conflicts with the canonical CBIC document registry subject matter."}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Candidate Details</span>
                  <div className="grid grid-cols-2 gap-2 font-semibold">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase">Title</span>
                      <span className="text-slate-700 line-clamp-1">{mismatchEvent.title}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase">Notification</span>
                      <span className="text-slate-700 font-mono">{mismatchEvent.operativeNotifications?.[0]?.notificationNumber || mismatchEvent.reference}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setMismatchEvent(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-black uppercase text-slate-600 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // Find correct registry item to align
                      let alignedKey = "02/2025-Central Tax (Rate)";
                      let alignedSubject = "Special 40% GST Rate Schedule for Specified Luxury and Sin Goods";
                      let alignedPdf = "https://cbic-gst.gov.in/pdf/notif-02-2025-ct-rate.pdf";
                      let alignedCategory = "RATE_REVISION" as const;

                      if (mismatchEvent.title.toLowerCase().includes("solar")) {
                        alignedKey = "01/2025-Central Tax (Rate)";
                        alignedSubject = "Abolition of 12% & 28% slabs; re-alignment to 5% and 18% schedules";
                        alignedPdf = "https://cbic-gst.gov.in/pdf/notif-01-2025-ct-rate.pdf";
                      }

                      const updatedEvent = {
                        ...mismatchEvent,
                        title: mismatchEvent.title,
                        category: alignedCategory,
                        reference: alignedSubject,
                        verificationStatus: "VERIFIED" as const,
                        mismatchAuditNote: `HALLUCINATION DETECTED & CORRECTED: Auto-aligned with official registry document ${alignedKey}.`,
                        officialPdfUrl: alignedPdf,
                        operativeNotifications: [
                          {
                            notificationNumber: alignedKey,
                            notificationDate: mismatchEvent.effectiveDate,
                            effectiveDate: mismatchEvent.effectiveDate,
                            provisions: mismatchEvent.summary,
                            impactedCategory: alignedCategory,
                            officialPdfUrl: alignedPdf
                          }
                        ]
                      };

                      approveMutation.mutate({
                        id: mismatchEvent.id,
                        updatedEvent: updatedEvent
                      });
                      setMismatchEvent(null);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 shadow"
                  >
                    <FileCheck size={14}/> Auto-Align & Approve
                  </button>
                  <button
                    onClick={() => {
                      const updatedEvent = {
                        ...mismatchEvent,
                        verificationStatus: "VERIFIED" as const,
                        mismatchAuditNote: "Approved forcefully by auditor without CBIC alignment corrections."
                      };
                      approveMutation.mutate({
                        id: mismatchEvent.id,
                        updatedEvent: updatedEvent
                      });
                      setMismatchEvent(null);
                    }}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-black uppercase text-center rounded-xl"
                  >
                    Force Approve Raw
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Custom Validation Conflict Detected Modal */}
          {conflictDetails && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 animate-in zoom-in-95 duration-200 text-left space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <AlertTriangle className="text-rose-600 animate-pulse" size={24} />
                  <h3 className="text-base font-black text-rose-800 uppercase tracking-wide">Statutory Conflict Detected</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  Our validation service utility cross-verified this entry with the canonical CBIC Gazettes. A severe alignment conflict was detected before saving or publishing.
                </p>
                
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl space-y-2">
                  <span className="text-[10px] bg-rose-200 text-rose-800 font-bold px-2 py-0.5 rounded uppercase tracking-wider">Conflict Detail</span>
                  <p className="text-[11px] font-semibold text-rose-950 leading-relaxed">
                    {conflictDetails.message}
                  </p>
                </div>

                {conflictDetails.canonicalSubject && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Official Canonical Gazette Entry</span>
                    <div className="space-y-1 font-semibold text-slate-700">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase">Official Subject</span>
                        <span>{conflictDetails.canonicalSubject}</span>
                      </div>
                      {conflictDetails.provisionsSummary && (
                        <div className="pt-1">
                          <span className="text-slate-400 block text-[9px] uppercase">Canonical Provisions</span>
                          <span className="text-[11px] font-medium text-slate-500">{conflictDetails.provisionsSummary}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setConflictDetails(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-black uppercase text-slate-600 rounded-xl"
                  >
                    Keep Editing
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Apply CBIC realignment fix
                      if (conflictDetails.canonicalSubject) {
                        if (conflictDetails.isSimulation) {
                          setSimReference(conflictDetails.canonicalSubject);
                          if (conflictDetails.category) {
                            setSimCategory(conflictDetails.category as any);
                          }
                          if (conflictDetails.provisionsSummary) {
                            setSimSummary(conflictDetails.provisionsSummary);
                          }
                          showToast("Aligned simulator inputs with certified CBIC data.", "success");
                        } else {
                          setEditReference(conflictDetails.canonicalSubject);
                          if (conflictDetails.category) {
                            setEditCategory(conflictDetails.category as any);
                          }
                          if (conflictDetails.officialPdfUrl) {
                            setEditPdfUrl(conflictDetails.officialPdfUrl);
                          }
                          if (conflictDetails.provisionsSummary) {
                            setEditSummary(conflictDetails.provisionsSummary);
                          }
                          showToast("Aligned candidate details with certified CBIC data.", "success");
                        }
                      }
                      setConflictDetails(null);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 shadow"
                  >
                    <CheckCircle2 size={14}/> Correct & Align Details
                  </button>
                  {!conflictDetails.isSimulation && (
                    <button
                      type="button"
                      onClick={() => {
                        // Force approve overriding the conflict
                        const payloadEvent = {
                          title: editTitle,
                          category: editCategory,
                          reference: editReference || editNotifNumber,
                          summary: editSummary,
                          effectiveDate: editEffectiveDate,
                          actionRequired: editActionRequired,
                          officialPdfUrl: editPdfUrl,
                          verificationStatus: "FLAGGED_MISMATCH" as const,
                          mismatchAuditNote: "Approved forcefully by auditor with known validation conflicts.",
                          operativeNotifications: [
                            {
                              notificationNumber: editNotifNumber,
                              notificationDate: editEffectiveDate,
                              effectiveDate: editEffectiveDate,
                              provisions: editSummary,
                              impactedCategory: editCategory,
                              officialPdfUrl: editPdfUrl
                            }
                          ]
                        };
                        approveMutation.mutate({
                          id: selectedEventId!,
                          updatedEvent: payloadEvent
                        });
                        setConflictDetails(null);
                      }}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-black uppercase text-center rounded-xl"
                    >
                      Override & Publish
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Collateral Segment: Editing Detail Panel (Only opens when row selected and in Pending Tab) */}
          {selectedEvent && activeTab === 'PENDING' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-5 duration-300">
              
              {/* LEFT COLUMN: CBIC Registry Guidance */}
              <div className="lg:col-span-4 space-y-4 text-left">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100">
                    <BookOpen size={16} className="text-indigo-500" />
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide font-sans">CBIC Official Gazette Registry</h4>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                    The following reference documents are certified to contain canonical statutory values. Align conflicting candidate updates instantly using the quick shortcuts.
                  </p>
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {CBIC_OFFISTRY_LIST()}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Interactive Auditor Correction Form */}
              <div className="lg:col-span-8">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-left space-y-6">
                  
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-indigo-600 font-black uppercase tracking-wider block">Auditor Correction Board</span>
                      <h4 className="font-bold text-slate-800 text-sm leading-snug">{selectedEvent.title}</h4>
                    </div>
                    <span className="text-[9px] font-black bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200 uppercase">
                      Draft State
                    </span>
                  </div>

                  {selectedEvent.verificationStatus === 'FLAGGED_MISMATCH' && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
                      <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="text-[10px] text-rose-800 font-extrabold uppercase tracking-wide">Automatic Verification Conflict Detected</span>
                        <p className="text-[11px] text-rose-700 leading-relaxed font-semibold">
                          {selectedEvent.mismatchAuditNote || 'Candidate citation reference clashes with the CBIC official catalog. Correct before publishing.'}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1 col-span-2">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">
                        Regulatory Update Title
                      </label>
                      <input 
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">
                        Notification / Circular Code
                      </label>
                      <input 
                        type="text"
                        value={editNotifNumber}
                        onChange={(e) => setEditNotifNumber(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">
                        Statutory Category
                      </label>
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value as any)}
                        className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                      >
                        <option value="CIRCULAR">Circular / Advisory</option>
                        <option value="RATE_REVISION">Rate Revision</option>
                        <option value="E_INVOICING">E-Invoicing Rules</option>
                        <option value="COMPLIANCE_DEADLINE">Compliance / Deadline</option>
                        <option value="ITC_RULES">ITC Rules</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">
                        Effective Date
                      </label>
                      <input 
                        type="date"
                        value={editEffectiveDate}
                        onChange={(e) => setEditEffectiveDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">
                        Canonical Document Subject
                      </label>
                      <input 
                        type="text"
                        value={editReference}
                        onChange={(e) => setEditReference(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1 col-span-2">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">
                        Gazette PDF URL Link
                      </label>
                      <input 
                        type="text"
                        value={editPdfUrl}
                        onChange={(e) => setEditPdfUrl(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono text-slate-600 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1 col-span-2">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">
                        Detailed Provisions Summary
                      </label>
                      <textarea
                        rows={3}
                        value={editSummary}
                        onChange={(e) => setEditSummary(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1 col-span-2">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">
                        Action Required for Corporates
                      </label>
                      <input 
                        type="text"
                        value={editActionRequired}
                        onChange={(e) => setEditActionRequired(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Validation Feedback Logs */}
                  {validationFeedback && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10.5px] font-mono leading-relaxed space-y-1">
                      <div className="flex justify-between items-center font-black uppercase text-[10px]">
                        <span className="text-slate-500">Live Gazetted Feed Audit log</span>
                        <span className={validationFeedback.isValid ? 'text-emerald-600' : 'text-amber-600'}>
                          {validationFeedback.isValid ? 'Verified Aligned' : 'Conflict Detected'}
                        </span>
                      </div>
                      <p className="text-slate-600">{validationFeedback.auditLog}</p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleLiveEngineValidate}
                      disabled={isValidating}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-xs font-black uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all text-slate-700"
                    >
                      <RefreshCw size={13} className={isValidating ? 'animate-spin' : ''} />
                      {isValidating ? 'Evaluating...' : 'Re-Validate with Gazette Engine'}
                    </button>

                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => { setSelectedEventId(null); }}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-black uppercase rounded-xl transition-all text-slate-600"
                      >
                        Close Panel
                      </button>
                      <button
                        type="button"
                        onClick={handleApproveAction}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-xl transition-all flex items-center gap-1.5 shadow"
                      >
                        <FileCheck size={13} /> Save & Approve
                      </button>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

        </div>
      ) : (
        /* INGESTION SIMULATION VIEW */
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-3xl mx-auto text-left space-y-6 animate-in fade-in duration-200">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-600" />
            <h4 className="font-black text-slate-800 text-sm uppercase tracking-wide">Regulatory Intelligence Parser Simulator</h4>
          </div>
          
          <p className="text-xs text-slate-500 leading-relaxed font-semibold">
            Simulate our automated crawler and CBIC PDF scrapers discovering new regulatory announcements. Submit a raw candidate here to see it land in the administrator queue for manual audit review!
          </p>

          <form onSubmit={handleSimInject} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 col-span-2">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">
                  Candidate Regulatory Title
                </label>
                <input 
                  type="text"
                  required
                  value={simTitle}
                  onChange={(e) => setSimTitle(e.target.value)}
                  placeholder="e.g. Rate Rationalisation slab adjustment on solar inverters"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">
                  Proposed Notification Number
                </label>
                <input 
                  type="text"
                  required
                  value={simNotifNumber}
                  onChange={(e) => setSimNotifNumber(e.target.value)}
                  placeholder="e.g. S.O. 4220(E) or 02/2025-Central Tax (Rate)"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">
                  Topic Category Classification
                </label>
                <select
                  value={simCategory}
                  onChange={(e) => setSimCategory(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value="CIRCULAR">Circular / Advisory</option>
                  <option value="RATE_REVISION">Rate Revision</option>
                  <option value="E_INVOICING">E-Invoicing Rules</option>
                  <option value="COMPLIANCE_DEADLINE">Compliance / Deadline</option>
                  <option value="ITC_RULES">ITC Rules</option>
                </select>
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">
                  Secondary Source Citation
                </label>
                <input 
                  type="text"
                  value={simReference}
                  onChange={(e) => setSimReference(e.target.value)}
                  placeholder="e.g. 56th GST Council meeting decisions"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">
                  Announced Provisions / Raw Text Scraped
                </label>
                <textarea
                  rows={4}
                  value={simSummary}
                  onChange={(e) => setSimSummary(e.target.value)}
                  placeholder="Copy raw text here..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTab('PENDING')}
                className="px-4 py-2 text-xs font-black uppercase text-slate-500 hover:text-slate-800 transition-colors"
              >
                Back to Queue
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2"
              >
                <Plus size={14}/> Inject Raw Update Into Pipeline
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );

  function CBIC_OFFISTRY_LIST() {
    return CBIC_OFFICIAL_REGISTRY.map(reg => (
      <div 
        key={reg.key}
        className="p-2.5 bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded-xl text-left text-[10px] leading-normal transition-all relative group"
      >
        <div className="flex justify-between items-start gap-2 mb-1">
          <strong className="font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
            {reg.key}
          </strong>
          {activeTab === 'PENDING' && selectedEventId && (
            <button
              onClick={() => applyRegistryFix(reg)}
              className="opacity-0 group-hover:opacity-100 bg-white hover:bg-indigo-600 text-indigo-600 hover:text-white font-black text-[8px] uppercase tracking-wider px-2 py-0.5 rounded border border-indigo-200 shadow-sm transition-all absolute right-2 top-2"
            >
              Apply Fix
            </button>
          )}
        </div>
        <p className="font-bold text-slate-700 mb-0.5 line-clamp-1">{reg.canonicalSubject}</p>
        <p className="text-[9px] text-slate-400 font-medium line-clamp-1">{reg.description}</p>
      </div>
    ));
  }
};
