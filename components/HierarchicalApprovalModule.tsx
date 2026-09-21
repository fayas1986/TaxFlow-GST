import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { UserRole } from '../types';
import { 
  ShieldCheck, ShieldAlert, CheckCircle2, AlertCircle, Clock, 
  FileText, Plus, Search, Lock, Sparkles, Check, X,
  Sliders, MessageSquare, ExternalLink, Users, Eye, Key, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ApprovalRequest, ApprovalStatus, ApprovalRequestType, PriorityLevel,
  loadApprovalRequests, saveApprovalRequests, createApprovalRequest, 
  updateApprovalStatus, loadPolicyConfig, savePolicyConfig, 
  loadDelegations, ROLE_APPROVAL_PERMISSIONS, resetApprovalDataToSeed 
} from '../services/approvalWorkflowService';
import { BottleneckAnalyticsView } from './BottleneckAnalyticsView';
import { ApprovalRbacMatrixTab } from './approval/ApprovalRbacMatrixTab';
import { ApprovalRequestInspector } from './approval/ApprovalRequestInspector';

interface HierarchicalApprovalModuleProps {
  onGoToFilingPortal?: (gstin: string, returnType: string) => void;
}

export const HierarchicalApprovalModule: React.FC<HierarchicalApprovalModuleProps> = ({
  onGoToFilingPortal
}) => {
  const currentUser = useSelector((state: RootState) => state.auth.user);
  
  // Role Perspective Switcher
  const [activeRolePerspective, setActiveRolePerspective] = useState<UserRole>(
    currentUser?.role || UserRole.FINANCE_MANAGER
  );

  // Active Tab State
  const [activeTab, setActiveTab] = useState<'INBOX' | 'CREATE_REQUEST' | 'ALL_REQUESTS' | 'RBAC_MATRIX' | 'POLICY_MATRIX' | 'BOTTLENECK_ANALYTICS'>('INBOX');

  // Approval Requests List
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Delegations State
  const [delegations, setDelegations] = useState(loadDelegations());

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // EVC / DSC Modal State
  const [isEvcModalOpen, setIsEvcModalOpen] = useState(false);
  const [evcOtpInput, setEvcOtpInput] = useState('');
  const [evcError, setEvcError] = useState('');
  const [pendingActionReq, setPendingActionReq] = useState<ApprovalRequest | null>(null);

  // Action Reason Dialog
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    type: 'APPROVE' | 'REQUEST_REVISION' | 'REJECT' | 'ESCALATE' | 'DISPATCH_TO_GSTN';
    request: ApprovalRequest | null;
  }>({ isOpen: false, type: 'APPROVE', request: null });
  const [actionNote, setActionNote] = useState('');

  // Policy Config State
  const [policyConfig, setPolicyConfig] = useState(loadPolicyConfig());

  // New Request Form State
  const [newReqType, setNewReqType] = useState<ApprovalRequestType>('GSTR3B_FILING');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTaxPeriod, setNewTaxPeriod] = useState('June 2026');
  const [newGstin, setNewGstin] = useState('27ABCDE1234F1Z5');
  const [newBranch, setNewBranch] = useState('Mumbai HQ Branch');
  const [newPriority, setNewPriority] = useState<PriorityLevel>('HIGH');
  const [newCgst, setNewCgst] = useState<number>(120000);
  const [newSgst, setNewSgst] = useState<number>(120000);
  const [newIgst, setNewIgst] = useState<number>(350000);
  const [newCess, setNewCess] = useState<number>(10000);
  const [newDocName, setNewDocName] = useState('GSTR3B_June_Reconciliation_Working.xlsx');

  // Load data on mount and sync with active authenticated role
  useEffect(() => {
    refreshRequests();
  }, []);

  useEffect(() => {
    if (currentUser?.role) {
      setActiveRolePerspective(currentUser.role);
    }
  }, [currentUser?.role]);

  const refreshRequests = () => {
    const list = loadApprovalRequests();
    setRequests(list);
    setDelegations(loadDelegations());
    if (selectedRequest) {
      const refreshedSel = list.find(r => r.id === selectedRequest.id);
      if (refreshedSel) setSelectedRequest(refreshedSel);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filter requests based on tab, RBAC role, and search filters
  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      req.requestNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.gstin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.submittedBy.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || req.requestType === typeFilter;

    if (activeTab === 'INBOX') {
      // Perspective matching based on RBAC role
      if (activeRolePerspective === UserRole.ACCOUNTANT) {
        // Accountant sees items needing their revision or drafts
        return matchesSearch && matchesStatus && matchesType && (req.status === 'REVISION_REQUESTED' || req.status === 'DRAFT' || req.submittedBy.email === (currentUser?.email || 'rohan.accountant@taxflow.in'));
      } else if (activeRolePerspective === UserRole.FINANCE_MANAGER) {
        // Finance manager sees items pending FM review
        return matchesSearch && matchesStatus && matchesType && req.status === 'PENDING_FINANCE_MANAGER';
      } else if (activeRolePerspective === UserRole.ADMIN || activeRolePerspective === UserRole.SUPER_ADMIN) {
        // Tax Head / Admin sees items pending Tax Head review or all actionable pending items
        return matchesSearch && matchesStatus && matchesType && (req.status === 'PENDING_TAX_HEAD' || req.status === 'PENDING_FINANCE_MANAGER' || req.status === 'APPROVED');
      } else if (activeRolePerspective === UserRole.AUDITOR) {
        // Auditor sees all items requiring compliance assurance
        return matchesSearch && matchesStatus && matchesType;
      } else {
        // Viewer sees overview
        return matchesSearch && matchesStatus && matchesType;
      }
    }

    return matchesSearch && matchesStatus && matchesType;
  });

  // Calculate Metrics
  const pendingFmCount = requests.filter(r => r.status === 'PENDING_FINANCE_MANAGER').length;
  const pendingTaxHeadCount = requests.filter(r => r.status === 'PENDING_TAX_HEAD').length;
  const revisionCount = requests.filter(r => r.status === 'REVISION_REQUESTED').length;
  const approvedReadyCount = requests.filter(r => r.status === 'APPROVED').length;
  const totalValuePending = requests
    .filter(r => r.status.startsWith('PENDING'))
    .reduce((acc, r) => acc + r.taxAmount.totalTax, 0);

  // Active Role Capability
  const activeRolePerm = ROLE_APPROVAL_PERMISSIONS[activeRolePerspective] || ROLE_APPROVAL_PERMISSIONS[UserRole.VIEWER];

  // Handle Form Submit for New Request
  const handleCreateNewRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      showToast('Please enter a request title');
      return;
    }

    const totalTax = Number(newCgst) + Number(newSgst) + Number(newIgst) + Number(newCess);

    const created = createApprovalRequest(
      {
        requestType: newReqType,
        title: newTitle,
        description: newDesc || `Approval request for ${newReqType} (${newTaxPeriod})`,
        taxPeriod: newTaxPeriod,
        gstin: newGstin,
        branchName: newBranch,
        financialYear: '2026-27',
        priority: newPriority,
        taxAmount: {
          cgst: Number(newCgst),
          sgst: Number(newSgst),
          igst: Number(newIgst),
          cess: Number(newCess),
          totalTax
        },
        dueByDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
        supportingDocCount: 1,
        supportingDocName: newDocName,
        riskScore: totalTax > policyConfig.singleStageLimit ? 78 : 95,
        riskChecks: [
          { id: '1', category: 'ITC_VARIANCE', label: 'Draft Reconciliation Check', status: 'PASS', details: 'Automated 2B comparison generated' },
          { id: '2', category: 'DEADLINE_RISK', label: 'Filing Statutory Window', status: 'PASS', details: '3 days remaining before portal due date' }
        ]
      },
      {
        name: currentUser?.name || (activeRolePerspective === UserRole.ACCOUNTANT ? 'Rohan Sharma' : 'Active User'),
        email: currentUser?.email || (activeRolePerspective === UserRole.ACCOUNTANT ? 'rohan.accountant@taxflow.in' : 'user@taxflow.in'),
        role: activeRolePerspective
      }
    );

    refreshRequests();
    showToast(`Created Approval Request #${created.requestNumber}`);
    setActiveTab('INBOX');
    setSelectedRequest(created);
  };

  // Open Action Modal
  const openActionModal = (
    type: 'APPROVE' | 'REQUEST_REVISION' | 'REJECT' | 'ESCALATE' | 'DISPATCH_TO_GSTN',
    req: ApprovalRequest
  ) => {
    if (type === 'DISPATCH_TO_GSTN' && policyConfig.enforceEvcOtpSignoff) {
      setPendingActionReq(req);
      setEvcOtpInput('');
      setEvcError('');
      setIsEvcModalOpen(true);
      return;
    }

    setActionModal({ isOpen: true, type, request: req });
    setActionNote('');
  };

  // Execute Action
  const handleExecuteAction = () => {
    if (!actionModal.request) return;

    try {
      const updated = updateApprovalStatus(
        actionModal.request.id,
        actionModal.type,
        {
          name: currentUser?.name || 'Reviewer User',
          email: currentUser?.email || 'reviewer@taxflow.in',
          role: activeRolePerspective
        },
        actionNote
      );

      refreshRequests();
      setSelectedRequest(updated);
      setActionModal({ isOpen: false, type: 'APPROVE', request: null });
      showToast(`Workflow status updated to [${updated.status}]`);
    } catch (err: any) {
      showToast(err.message || 'Action failed');
    }
  };

  // Execute EVC Dispatch
  const handleExecuteEvcDispatch = () => {
    if (evcOtpInput !== '123456' && evcOtpInput !== '999999') {
      setEvcError('Invalid EVC OTP. For demo test, enter 123456 or 999999');
      return;
    }

    if (!pendingActionReq) return;

    const updated = updateApprovalStatus(
      pendingActionReq.id,
      'DISPATCH_TO_GSTN',
      {
        name: currentUser?.name || 'Authorized Signatory',
        email: currentUser?.email || 'signatory@taxflow.in',
        role: activeRolePerspective
      },
      'EVC OTP Authorized & Signed via Authorized Signatory DSC'
    );

    refreshRequests();
    setSelectedRequest(updated);
    setIsEvcModalOpen(false);
    showToast(`Successfully dispatched #${updated.requestNumber} to GSTN Portal with ARN ${updated.portalSubmissionArn}`);
  };

  // Save Policy Config
  const handleSavePolicy = () => {
    savePolicyConfig(policyConfig);
    showToast('Updated Hierarchical Approval Policy Settings');
  };

  // Export Approval Certificate
  const handleDownloadApprovalCertificate = (req: ApprovalRequest) => {
    const certText = `
===================================================================
           TAXFLOW GST COMPLIANCE - APPROVAL CERTIFICATE
===================================================================
Request Number  : ${req.requestNumber}
Title           : ${req.title}
GSTIN           : ${req.gstin}
Tax Period      : ${req.taxPeriod}
Branch / Unit   : ${req.branchName}
-------------------------------------------------------------------
FINANCIAL LIABILITY SUMMARY:
  - CGST Tax    : ₹${req.taxAmount.cgst.toLocaleString('en-IN')}
  - SGST Tax    : ₹${req.taxAmount.sgst.toLocaleString('en-IN')}
  - IGST Tax    : ₹${req.taxAmount.igst.toLocaleString('en-IN')}
  - Cess        : ₹${req.taxAmount.cess.toLocaleString('en-IN')}
  - TOTAL VALUE : ₹${req.taxAmount.totalTax.toLocaleString('en-IN')}
-------------------------------------------------------------------
APPROVAL HIERARCHY AUDIT TRAIL:
  1. Submitted By : ${req.submittedBy.name} (${req.submittedBy.role}) at ${req.submittedBy.timestamp}
  ${req.reviewedBy ? `2. Reviewed By  : ${req.reviewedBy.name} (${req.reviewedBy.role}) at ${req.reviewedBy.timestamp}` : ''}
  ${req.approvedByTaxHead ? `3. Tax Head Sign: ${req.approvedByTaxHead.name} (${req.approvedByTaxHead.role}) at ${req.approvedByTaxHead.timestamp}` : ''}
-------------------------------------------------------------------
STATUS          : ${req.status}
EVC SIGNATURE   : ${req.digitalSignatureHash || 'VERIFIED_DIGITAL_LOCK_HASH_8A912'}
PORTAL ARN      : ${req.portalSubmissionArn || 'N/A'}
GENERATED DATE  : ${new Date().toISOString()}
===================================================================
`;

    const blob = new Blob([certText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `APPROVAL_CERTIFICATE_${req.requestNumber}.txt`;
    link.click();
    showToast(`Downloaded Approval Audit Certificate for #${req.requestNumber}`);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* TOAST POPUP */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-8 z-[1000] px-4 py-3 bg-slate-900 text-white font-bold text-xs rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2"
          >
            <Sparkles size={16} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER BANNER WITH RBAC ROLE SWITCHER */}
      <div className="p-6 bg-white text-slate-900 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50/70 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="p-3.5 bg-blue-50 border border-blue-200 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
              <ShieldCheck size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Hierarchical Approval Workflow</h2>
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-mono font-bold rounded-full uppercase">
                  RBAC &amp; Four-Eyes Governance
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Role-based approval pipelines for Preparers (Accountants), L1 Reviewers (Finance Managers), L2 Authorities (Tax Heads), and Independent Auditors.
              </p>
            </div>
          </div>

          {/* RBAC ROLE PERSPECTIVE SWITCHER */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>RBAC Perspective Role</span>
              <span className="text-blue-600 font-mono font-bold">Live Simulation</span>
            </label>
            <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
              <button
                type="button"
                onClick={() => setActiveRolePerspective(UserRole.ACCOUNTANT)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeRolePerspective === UserRole.ACCOUNTANT 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Accountant
              </button>
              <button
                type="button"
                onClick={() => setActiveRolePerspective(UserRole.FINANCE_MANAGER)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeRolePerspective === UserRole.FINANCE_MANAGER 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Finance Mgr (L1)
              </button>
              <button
                type="button"
                onClick={() => setActiveRolePerspective(UserRole.ADMIN)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeRolePerspective === UserRole.ADMIN || activeRolePerspective === UserRole.SUPER_ADMIN
                    ? 'bg-purple-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Tax Head (L2)
              </button>
              <button
                type="button"
                onClick={() => setActiveRolePerspective(UserRole.AUDITOR)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeRolePerspective === UserRole.AUDITOR 
                    ? 'bg-teal-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Auditor
              </button>
              <button
                type="button"
                onClick={() => setActiveRolePerspective(UserRole.VIEWER)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeRolePerspective === UserRole.VIEWER 
                    ? 'bg-slate-800 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Viewer
              </button>
            </div>
          </div>
        </div>

        {/* ACTIVE ROLE PERMISSION BADGE */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-600 flex-wrap">
            <span className="font-extrabold text-slate-900">Active Authority:</span>
            <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-mono font-bold border border-blue-200">{activeRolePerm.roleLabel}</span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-slate-500">{activeRolePerm.description}</span>
          </div>

          <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-bold">
            Sign-off Limit: {activeRolePerm.maxSingleSignoffAmount === 0 ? (activeRolePerm.canApproveL2 ? 'Unlimited' : '₹0') : `₹${activeRolePerm.maxSingleSignoffAmount.toLocaleString('en-IN')}`}
          </span>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="p-3.5 bg-slate-50 hover:bg-white rounded-2xl border border-slate-200 shadow-xs transition-all">
            <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Pending FM (L1)</p>
            <p className="text-2xl font-black text-amber-600 font-mono mt-0.5">{pendingFmCount}</p>
          </div>
          <div className="p-3.5 bg-slate-50 hover:bg-white rounded-2xl border border-slate-200 shadow-xs transition-all">
            <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Escalated Tax Head (L2)</p>
            <p className="text-2xl font-black text-purple-600 font-mono mt-0.5">{pendingTaxHeadCount}</p>
          </div>
          <div className="p-3.5 bg-slate-50 hover:bg-white rounded-2xl border border-slate-200 shadow-xs transition-all">
            <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Approved &amp; Ready</p>
            <p className="text-2xl font-black text-emerald-600 font-mono mt-0.5">{approvedReadyCount}</p>
          </div>
          <div className="p-3.5 bg-slate-50 hover:bg-white rounded-2xl border border-slate-200 shadow-xs transition-all">
            <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Tax Liability in Pipeline</p>
            <p className="text-2xl font-black text-blue-600 font-mono mt-0.5">₹{totalValuePending.toLocaleString('en-IN')}</p>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex flex-wrap gap-2 mt-6">
          <button
            type="button"
            onClick={() => setActiveTab('INBOX')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'INBOX'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60'
            }`}
          >
            <Clock size={15} /> Action Queue ({filteredRequests.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('CREATE_REQUEST');
              setNewTitle(`GSTR-3B Filing Approval - ${newTaxPeriod} (${newBranch})`);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'CREATE_REQUEST'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60'
            }`}
          >
            <Plus size={15} /> Submit New Approval
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ALL_REQUESTS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'ALL_REQUESTS'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60'
            }`}
          >
            <FileText size={15} /> Full Audit History ({requests.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('RBAC_MATRIX')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'RBAC_MATRIX'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60'
            }`}
          >
            <ShieldCheck size={15} /> RBAC &amp; Delegation Matrix
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('POLICY_MATRIX')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'POLICY_MATRIX'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60'
            }`}
          >
            <Sliders size={15} /> Threshold Policies
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BOTTLENECK_ANALYTICS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'BOTTLENECK_ANALYTICS'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60'
            }`}
          >
            <Clock size={15} /> SLA Analytics
          </button>
        </div>
      </div>

      {/* MAIN CONTAINER: TAB CONTENTS */}
      {activeTab === 'INBOX' || activeTab === 'ALL_REQUESTS' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT 7 COLS: REQUEST LIST WITH FILTERS */}
          <div className="lg:col-span-7 space-y-4">
            {/* Search and Filters */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center justify-between">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search approval #, GSTIN, title..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING_FINANCE_MANAGER">Pending Finance Mgr (L1)</option>
                <option value="PENDING_TAX_HEAD">Pending Tax Head (L2)</option>
                <option value="REVISION_REQUESTED">Revision Requested</option>
                <option value="APPROVED">Approved</option>
                <option value="SUBMITTED_TO_GSTN">Submitted to GSTN</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700"
              >
                <option value="ALL">All Request Types</option>
                <option value="GSTR1_FILING">GSTR-1 Return</option>
                <option value="GSTR3B_FILING">GSTR-3B Return</option>
                <option value="GSTR9_ANNUAL">GSTR-9 Annual</option>
                <option value="ITC_RECON_ADJUSTMENT">ITC Adjustment</option>
                <option value="RCM_LIABILITY_ADJUSTMENT">RCM Liability</option>
              </select>
            </div>

            {/* REQUEST CARDS LIST */}
            <div className="space-y-3">
              {filteredRequests.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
                  <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-3" />
                  <p className="text-sm font-extrabold text-slate-800">Queue is Clear</p>
                  <p className="text-xs text-slate-500 mt-1">
                    No pending approval requests matching your current RBAC filter perspective.
                  </p>
                </div>
              ) : (
                filteredRequests.map((req) => {
                  const isSelected = selectedRequest?.id === req.id;
                  const isOverThreshold = req.taxAmount.totalTax > policyConfig.singleStageLimit;

                  return (
                    <div
                      key={req.id}
                      onClick={() => setSelectedRequest(req)}
                      className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-blue-50/70 border-blue-500 shadow-md ring-2 ring-blue-400/30' 
                          : 'bg-white border-slate-200 hover:border-blue-300 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded-md">
                              {req.requestNumber}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono font-black ${
                              req.priority === 'URGENT_DUE_SOON' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                              req.priority === 'HIGH' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {req.priority.replace(/_/g, ' ')}
                            </span>
                            {isOverThreshold && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                L2 Dual Sign-Off
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-extrabold text-slate-900 mt-2">{req.title}</h4>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>GSTIN: <strong className="font-mono text-slate-700">{req.gstin}</strong></span>
                            <span>&bull;</span>
                            <span>Branch: <strong>{req.branchName}</strong></span>
                          </p>
                        </div>

                        {/* Status Badge */}
                        <div className="text-right shrink-0">
                          <span className={`px-3 py-1 rounded-full text-[11px] font-bold font-mono inline-flex items-center gap-1 ${
                            req.status === 'PENDING_FINANCE_MANAGER' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                            req.status === 'PENDING_TAX_HEAD' ? 'bg-purple-100 text-purple-900 border border-purple-300' :
                            req.status === 'REVISION_REQUESTED' ? 'bg-rose-100 text-rose-900 border border-rose-300' :
                            req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                            'bg-blue-100 text-blue-900 border border-blue-300'
                          }`}>
                            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                            {req.status.replace(/_/g, ' ')}
                          </span>
                          <p className="text-[10px] text-slate-400 mt-1.5 font-mono">
                            Due: {req.dueByDate}
                          </p>
                        </div>
                      </div>

                      {/* Tax Breakdown Preview Bar */}
                      <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-4 text-slate-600 font-mono">
                          <span>CGST: ₹{req.taxAmount.cgst.toLocaleString('en-IN')}</span>
                          <span>SGST: ₹{req.taxAmount.sgst.toLocaleString('en-IN')}</span>
                          <span>IGST: ₹{req.taxAmount.igst.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="font-extrabold font-mono text-slate-900 text-sm">
                          Total: ₹{req.taxAmount.totalTax.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT 5 COLS: DETAILED REVIEW INSPECTOR PANEL */}
          <div className="lg:col-span-5">
            {selectedRequest ? (
              <ApprovalRequestInspector
                request={selectedRequest}
                activeRolePerspective={activeRolePerspective}
                currentUserEmail={currentUser?.email || (activeRolePerspective === UserRole.ACCOUNTANT ? 'rohan.accountant@taxflow.in' : 'reviewer@taxflow.in')}
                currentUserName={currentUser?.name || 'TaxFlow User'}
                policyConfig={policyConfig}
                delegations={delegations}
                onOpenActionModal={openActionModal}
                onDownloadCertificate={handleDownloadApprovalCertificate}
                onShowToast={showToast}
                onRefreshRequests={refreshRequests}
              />
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400">
                <FileText size={48} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm font-bold text-slate-700">Select an Approval Request</p>
                <p className="text-xs mt-1">Click any item on the left to inspect detailed tax breakdowns, RBAC authorization assessment, and audit trail.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* TAB: CREATE NEW APPROVAL REQUEST */}
      {activeTab === 'CREATE_REQUEST' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 max-w-3xl mx-auto shadow-sm space-y-6">
          <div>
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Plus size={22} className="text-blue-600" /> Submit New Return or Reconciliation Approval
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Accountants and Finance Managers can submit drafted tax returns for hierarchical Four-Eyes review.
            </p>
          </div>

          <form onSubmit={handleCreateNewRequest} className="space-y-4 text-xs font-bold text-slate-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1">Approval Request Type</label>
                <select
                  value={newReqType}
                  onChange={(e) => setNewReqType(e.target.value as ApprovalRequestType)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                >
                  <option value="GSTR3B_FILING">GSTR-3B Monthly Return Filing</option>
                  <option value="GSTR1_FILING">GSTR-1 Outward Supplies Filing</option>
                  <option value="GSTR9_ANNUAL">GSTR-9 Annual Return</option>
                  <option value="ITC_RECON_ADJUSTMENT">ITC Mismatch Adjustment</option>
                  <option value="RCM_LIABILITY_ADJUSTMENT">RCM Liability Self-Invoice</option>
                </select>
              </div>

              <div>
                <label className="block mb-1">Tax Period</label>
                <input
                  type="text"
                  value={newTaxPeriod}
                  onChange={(e) => setNewTaxPeriod(e.target.value)}
                  placeholder="e.g. June 2026"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block mb-1">Request Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. GSTR-3B June 2026 Return Approval - MH Branch"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1">Target GSTIN</label>
                <input
                  type="text"
                  value={newGstin}
                  onChange={(e) => setNewGstin(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block mb-1">Branch / Location</label>
                <input
                  type="text"
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                />
              </div>
            </div>

            {/* TAX AMOUNT INPUT GRID */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <label className="block text-slate-900 uppercase font-black tracking-wider text-[11px]">Tax Amounts (INR)</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 font-sans">CGST</span>
                  <input
                    type="number"
                    value={newCgst}
                    onChange={(e) => setNewCgst(Number(e.target.value))}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-sans">SGST</span>
                  <input
                    type="number"
                    value={newSgst}
                    onChange={(e) => setNewSgst(Number(e.target.value))}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-sans">IGST</span>
                  <input
                    type="number"
                    value={newIgst}
                    onChange={(e) => setNewIgst(Number(e.target.value))}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-sans">CESS</span>
                  <input
                    type="number"
                    value={newCess}
                    onChange={(e) => setNewCess(Number(e.target.value))}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-blue-100/70 border border-blue-200 rounded-xl flex items-center justify-between text-blue-950 font-mono">
                <span>Calculated Total Tax:</span>
                <span className="text-base font-black">₹{(newCgst + newSgst + newIgst + newCess).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div>
              <label className="block mb-1">Justification &amp; Notes</label>
              <textarea
                rows={3}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Explain the background or reconciliation methodology..."
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
              />
            </div>

            <div className="pt-3">
              <button
                type="submit"
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm rounded-2xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
              >
                <Plus size={18} /> Submit for Hierarchical Review
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB: RBAC MATRIX & GOVERNANCE */}
      {activeTab === 'RBAC_MATRIX' && (
        <ApprovalRbacMatrixTab
          activeRolePerspective={activeRolePerspective}
          onShowToast={showToast}
        />
      )}

      {/* TAB: POLICY MATRIX & THRESHOLDS */}
      {activeTab === 'POLICY_MATRIX' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 max-w-3xl mx-auto shadow-sm space-y-6">
          <div>
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Sliders size={22} className="text-indigo-600" /> Approval Threshold &amp; Four-Eyes Settings
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Configure threshold limits for single-stage vs two-stage escalation rules. (Restricted to Admin / Super Admin)
            </p>
          </div>

          <div className="space-y-4 text-xs font-bold text-slate-700">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <label className="block text-slate-900 font-extrabold">Single-Stage Finance Manager Approval Cap (INR)</label>
              <p className="text-[11px] text-slate-500">Items below this amount require only 1 Finance Manager signoff. Items exceeding this amount are automatically escalated to Tax Head / Partner.</p>
              <input
                type="number"
                disabled={activeRolePerspective !== UserRole.ADMIN && activeRolePerspective !== UserRole.SUPER_ADMIN}
                value={policyConfig.singleStageLimit}
                onChange={(e) => setPolicyConfig({ ...policyConfig, singleStageLimit: Number(e.target.value) })}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <p className="font-extrabold text-slate-900">Enforce Two-Stage Approval Hierarchy</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Require dual authorization (FM + Tax Head) for high liability returns.</p>
              </div>
              <input
                type="checkbox"
                disabled={activeRolePerspective !== UserRole.ADMIN && activeRolePerspective !== UserRole.SUPER_ADMIN}
                checked={policyConfig.requireTwoStageApproval}
                onChange={(e) => setPolicyConfig({ ...policyConfig, requireTwoStageApproval: e.target.checked })}
                className="w-5 h-5 accent-blue-600"
              />
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <p className="font-extrabold text-slate-900">Enforce EVC OTP / DSC Confirmation</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Require 6-digit EVC OTP authentication when submitting returns to GSTN portal.</p>
              </div>
              <input
                type="checkbox"
                disabled={activeRolePerspective !== UserRole.ADMIN && activeRolePerspective !== UserRole.SUPER_ADMIN}
                checked={policyConfig.enforceEvcOtpSignoff}
                onChange={(e) => setPolicyConfig({ ...policyConfig, enforceEvcOtpSignoff: e.target.checked })}
                className="w-5 h-5 accent-blue-600"
              />
            </div>

            {(activeRolePerspective === UserRole.ADMIN || activeRolePerspective === UserRole.SUPER_ADMIN) && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSavePolicy}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all"
                >
                  Save Governance Policies
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'BOTTLENECK_ANALYTICS' && (
        <BottleneckAnalyticsView requests={requests} onShowToast={showToast} />
      )}

      {/* ACTION DIALOG MODAL */}
      {actionModal.isOpen && actionModal.request && (
        <div className="fixed inset-0 z-[1100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <h4 className="text-lg font-black text-slate-900">
              Confirm Action: {actionModal.type.replace(/_/g, ' ')}
            </h4>
            <p className="text-xs text-slate-600">
              Applying review decision on request <strong>{actionModal.request.requestNumber}</strong> ({actionModal.request.title}).
            </p>

            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Reviewer Feedback / Note</label>
              <textarea
                rows={3}
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Enter justification or instructions for the accountant..."
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionModal({ isOpen: false, type: 'APPROVE', request: null })}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteAction}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md"
              >
                Confirm Decision
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EVC / DSC OTP MODAL */}
      {isEvcModalOpen && pendingActionReq && (
        <div className="fixed inset-0 z-[1100] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="p-3 bg-blue-50 text-blue-700 rounded-2xl w-fit">
              <Lock size={28} />
            </div>
            <div>
              <h4 className="text-lg font-black text-slate-900">EVC Digital Authorization</h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Enter the 6-digit EVC OTP sent to Authorized Signatory phone for <strong>{pendingActionReq.gstin}</strong>.
              </p>
            </div>

            <div>
              <input
                type="text"
                value={evcOtpInput}
                onChange={(e) => setEvcOtpInput(e.target.value)}
                placeholder="Enter 6-digit OTP (demo: 123456)"
                className="w-full px-4 py-3 bg-slate-50 border-2 border-blue-500 rounded-2xl font-mono text-center text-lg font-black text-slate-900 tracking-widest focus:outline-hidden"
                maxLength={6}
              />
              {evcError && <p className="text-[11px] text-rose-600 font-bold mt-1">{evcError}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEvcModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteEvcDispatch}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md"
              >
                Verify &amp; Dispatch to GSTN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HierarchicalApprovalModule;
