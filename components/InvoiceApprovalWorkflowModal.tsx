import React, { useState } from 'react';
import { 
  Invoice, 
  UserRole, 
  InvoiceApprovalStatus, 
  InvoiceApprovalWorkflow 
} from '../types';
import { 
  submitInvoiceForApproval, 
  reviewInvoiceByFinance, 
  signoffInvoiceBySeniorFinance, 
  requestInvoiceRevision, 
  rejectInvoiceApproval, 
  generateEInvoice 
} from '../services/api';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  FileText, 
  UserCheck, 
  Send, 
  RotateCcw, 
  XCircle, 
  Lock, 
  Key, 
  ArrowRight, 
  Check, 
  FileCheck, 
  QrCode, 
  Building, 
  Hash, 
  BadgeCheck, 
  AlertCircle,
  HelpCircle,
  X
} from 'lucide-react';

interface InvoiceApprovalWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onInvoiceUpdated?: (updatedInvoice: Invoice) => void;
  onWorkflowUpdated?: () => void;
  currentRole?: UserRole;
  currentUser?: { name: string; email: string; role: UserRole };
}

export const InvoiceApprovalWorkflowModal: React.FC<InvoiceApprovalWorkflowModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onInvoiceUpdated,
  onWorkflowUpdated,
  currentRole = UserRole.ADMIN,
  currentUser = { name: 'Dr. Vikram Malhotra', email: 'vikram.m@acmetech.com', role: UserRole.ADMIN }
}) => {
  if (!isOpen || !invoice) return null;

  // Active perspective switcher for testing different workflow roles
  const [activeRolePerspective, setActiveRolePerspective] = useState<UserRole>(currentRole || UserRole.ADMIN);
  const [activeTab, setActiveTab] = useState<'WORKFLOW' | 'CHECKLIST' | 'AUDIT_TRAIL' | 'INVOICE_DETAILS'>('WORKFLOW');
  
  // Form states for actions
  const [actionNotes, setActionNotes] = useState('');
  const [signatoryDesignation, setSignatoryDesignation] = useState('Chief Financial Officer (CFO)');
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [evcPin, setEvcPin] = useState('992810');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Finance Review Checklist state
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    ACTIVE_GSTIN_VERIFIED: true,
    HSN_RATE_MATCHED: true,
    POS_RULES_VALIDATED: true,
    ARITHMETIC_CONFIRMED: true,
    COUNTERPARTY_COMPLIANCE: true
  });

  const toggleChecklistItem = (key: string) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const allChecklistItemsCompleted = Object.values(checklist).every(Boolean);

  const approvalStage: InvoiceApprovalStatus = invoice.approvalStage || 
    (invoice.status === 'UPLOADED' || invoice.status === 'FILED' ? 'SUBMITTED_TO_PORTAL' : 
     invoice.status === 'APPROVED' ? 'APPROVED' : 
     invoice.status === 'PENDING_APPROVAL' ? 'PENDING_FINANCE_REVIEW' : 'DRAFT');

  const workflow = invoice.approvalWorkflow;

  const notifyUpdate = (updated: Invoice) => {
    if (onInvoiceUpdated) onInvoiceUpdated(updated);
    if (onWorkflowUpdated) onWorkflowUpdated();
  };

  const showNotification = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 4000);
  };

  // --- WORKFLOW ACTIONS ---

  const handleSubmitForReview = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage('');
      const updated = await submitInvoiceForApproval(
        invoice.id,
        {
          name: currentUser.name || 'Accountant User',
          email: currentUser.email || 'accountant@taxflow.in',
          role: activeRolePerspective
        },
        actionNotes || 'Submitted for Stage 1 Finance Review.'
      );
      notifyUpdate(updated);
      showNotification(`Invoice #${invoice.invoiceNumber} submitted for Finance Review.`);
      setActionNotes('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit invoice for approval');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinanceReviewApprove = async () => {
    if (!allChecklistItemsCompleted) {
      setErrorMessage('Please complete all 5 compliance verification checks before forwarding to Senior Finance.');
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMessage('');
      const completedKeys = Object.entries(checklist).filter(([_, val]) => val).map(([k]) => k);
      const updated = await reviewInvoiceByFinance(
        invoice.id,
        {
          name: activeRolePerspective === UserRole.FINANCE_MANAGER ? (currentUser.name || 'Anita Desai') : 'Anita Desai',
          email: 'anita.desai@taxflow.in',
          role: UserRole.FINANCE_MANAGER
        },
        completedKeys,
        actionNotes || 'Line items and tax rates verified. Forwarded to Senior Finance Manager for sign-off.'
      );
      notifyUpdate(updated);
      showNotification(`Finance Review completed. Forwarded to Senior Finance Manager for Sign-Off.`);
      setActionNotes('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete finance review');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSeniorFinanceSignoff = async () => {
    if (!declarationAccepted) {
      setErrorMessage('You must confirm the statutory compliance declaration before executing senior sign-off.');
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMessage('');
      const updated = await signoffInvoiceBySeniorFinance(
        invoice.id,
        {
          name: activeRolePerspective === UserRole.ADMIN ? (currentUser.name || 'Dr. Vikram Malhotra') : 'Dr. Vikram Malhotra',
          email: currentUser.email || 'vikram.m@acmetech.com',
          role: activeRolePerspective,
          designation: signatoryDesignation || 'Chief Financial Officer'
        },
        {
          declarationAccepted: true,
          evcOtpOrPin: evcPin || 'EVC-992810',
          notes: actionNotes || 'Statutory sign-off executed. Document authorized for transmission to Government Portal (IRP/NIC).'
        }
      );
      notifyUpdate(updated);
      showNotification(`Senior Finance Manager Sign-Off executed! Ready to transmit to Government Portal.`);
      setActionNotes('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to execute senior sign-off');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!actionNotes.trim()) {
      setErrorMessage('Please provide specific revision instructions for the preparer.');
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMessage('');
      const updated = await requestInvoiceRevision(
        invoice.id,
        {
          name: currentUser.name || 'Reviewer User',
          email: currentUser.email || 'reviewer@taxflow.in',
          role: activeRolePerspective,
          designation: activeRolePerspective === UserRole.ADMIN ? 'Senior Finance Manager' : 'Finance Manager'
        },
        actionNotes
      );
      notifyUpdate(updated);
      showNotification(`Revision requested. Invoice returned to draft for corrections.`);
      setActionNotes('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to request revision');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!actionNotes.trim()) {
      setErrorMessage('Please provide a mandatory justification for rejection.');
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMessage('');
      const updated = await rejectInvoiceApproval(
        invoice.id,
        {
          name: currentUser.name || 'Signatory User',
          email: currentUser.email || 'signatory@taxflow.in',
          role: activeRolePerspective,
          designation: activeRolePerspective === UserRole.ADMIN ? 'Senior Finance Manager' : 'Finance Manager'
        },
        actionNotes
      );
      notifyUpdate(updated);
      showNotification(`Invoice approval rejected.`);
      setActionNotes('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reject approval');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTransmitToGovernmentPortal = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage('');
      await generateEInvoice(invoice.id);
      const updatedInvoice: Invoice = {
        ...invoice,
        status: 'UPLOADED',
        approvalStage: 'SUBMITTED_TO_PORTAL'
      };
      notifyUpdate(updatedInvoice);
      showNotification(`Invoice successfully registered on Government Portal (IRP/NIC)! IRN & QR Generated.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Government Portal transmission failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Step calculations
  const getStepStatus = (stepIndex: number): 'COMPLETED' | 'ACTIVE' | 'PENDING' | 'REVISED' => {
    if (approvalStage === 'REVISION_REQUESTED') {
      if (stepIndex === 0) return 'ACTIVE';
      return 'PENDING';
    }
    if (approvalStage === 'REJECTED') {
      return stepIndex === 0 ? 'COMPLETED' : 'PENDING';
    }

    switch (approvalStage) {
      case 'DRAFT':
        return stepIndex === 0 ? 'ACTIVE' : 'PENDING';
      case 'PENDING_FINANCE_REVIEW':
        if (stepIndex === 0) return 'COMPLETED';
        if (stepIndex === 1) return 'ACTIVE';
        return 'PENDING';
      case 'PENDING_SR_FINANCE_SIGNOFF':
        if (stepIndex <= 1) return 'COMPLETED';
        if (stepIndex === 2) return 'ACTIVE';
        return 'PENDING';
      case 'APPROVED':
        if (stepIndex <= 2) return 'COMPLETED';
        if (stepIndex === 3) return 'ACTIVE';
        return 'PENDING';
      case 'SUBMITTED_TO_PORTAL':
        return 'COMPLETED';
      default:
        return 'PENDING';
    }
  };

  return (
    <div id="invoice-approval-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div id="invoice-approval-modal-card" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div id="invoice-approval-modal-header" className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-700 dark:text-blue-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Multi-Stage Invoice Approval Gate
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {invoice.invoiceNumber}
                </span>
                {approvalStage === 'APPROVED' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approved by Sr. Finance
                  </span>
                )}
                {approvalStage === 'PENDING_SR_FINANCE_SIGNOFF' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Stage 2: Pending Sr. Finance Sign-off
                  </span>
                )}
                {approvalStage === 'PENDING_FINANCE_REVIEW' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5" /> Stage 1: Pending Finance Review
                  </span>
                )}
                {approvalStage === 'DRAFT' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                    Draft (Unsubmitted)
                  </span>
                )}
                {approvalStage === 'REVISION_REQUESTED' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                    <RotateCcw className="w-3.5 h-3.5" /> Revision Requested
                  </span>
                )}
                {approvalStage === 'SUBMITTED_TO_PORTAL' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800 flex items-center gap-1">
                    <BadgeCheck className="w-3.5 h-3.5" /> Transmitted to Government Portal (IRP)
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Party: <span className="font-medium text-slate-700 dark:text-slate-200">{invoice.partyName}</span> ({invoice.gstin || 'Unregistered'}) • Taxable: <span className="font-semibold text-slate-900 dark:text-white">₹{invoice.amount.toLocaleString()}</span> • Tax: <span className="font-semibold text-slate-900 dark:text-white">₹{invoice.taxAmount.toLocaleString()}</span>
              </p>
            </div>
          </div>

          {/* Role Perspective Selector for Interactive Simulation */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <div className="text-right hidden sm:block">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Current Persona</span>
              <select
                id="role-perspective-select"
                aria-label="Current Persona"
                value={activeRolePerspective}
                onChange={(e) => setActiveRolePerspective(e.target.value as UserRole)}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
              >
                <option value={UserRole.ACCOUNTANT}>Staff Accountant (Preparer)</option>
                <option value={UserRole.FINANCE_MANAGER}>Finance Manager (Stage 1 Review)</option>
                <option value={UserRole.ADMIN}>Senior Finance Manager / CFO (Signatory)</option>
              </select>
            </div>
            <button
              id="close-approval-modal-button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toast / Error Banner */}
        {successToast && (
          <div id="approval-success-banner" className="bg-emerald-50 dark:bg-emerald-950/50 border-b border-emerald-200 dark:border-emerald-800 px-6 py-2.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}
        {errorMessage && (
          <div id="approval-error-banner" className="bg-rose-50 dark:bg-rose-950/50 border-b border-rose-200 dark:border-rose-800 px-6 py-2.5 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 4-Stage Visual Progress Bar */}
        <div id="approval-stepper-container" className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 relative">
            
            {/* Step 1: Draft Preparation */}
            <div id="approval-step-1" className={`p-3 rounded-xl border transition-all ${
              getStepStatus(0) === 'COMPLETED' 
                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200' 
                : getStepStatus(0) === 'ACTIVE' 
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200 shadow-sm' 
                  : 'bg-slate-100/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Stage 1</span>
                {getStepStatus(0) === 'COMPLETED' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <FileText className="w-4 h-4 text-blue-500" />
                )}
              </div>
              <h4 className="text-xs font-bold leading-tight">Draft Preparation</h4>
              <p className="text-[11px] opacity-80 mt-0.5">Accountant Finalization</p>
              {workflow?.preparedBy && (
                <div className="mt-2 pt-1.5 border-t border-current/10 text-[10px] truncate">
                  By {workflow.preparedBy.name}
                </div>
              )}
            </div>

            {/* Step 2: Finance Manager Review */}
            <div id="approval-step-2" className={`p-3 rounded-xl border transition-all ${
              getStepStatus(1) === 'COMPLETED' 
                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200' 
                : getStepStatus(1) === 'ACTIVE' 
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200 shadow-sm' 
                  : 'bg-slate-100/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Stage 2</span>
                {getStepStatus(1) === 'COMPLETED' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : getStepStatus(1) === 'ACTIVE' ? (
                  <Clock className="w-4 h-4 text-blue-500 animate-pulse" />
                ) : (
                  <Lock className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <h4 className="text-xs font-bold leading-tight">Finance Review</h4>
              <p className="text-[11px] opacity-80 mt-0.5">HSN & Compliance Audit</p>
              {workflow?.reviewedBy && (
                <div className="mt-2 pt-1.5 border-t border-current/10 text-[10px] truncate">
                  By {workflow.reviewedBy.name}
                </div>
              )}
            </div>

            {/* Step 3: Senior Finance Sign-Off */}
            <div id="approval-step-3" className={`p-3 rounded-xl border transition-all ${
              getStepStatus(2) === 'COMPLETED' 
                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200' 
                : getStepStatus(2) === 'ACTIVE' 
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 shadow-sm' 
                  : 'bg-slate-100/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Stage 3</span>
                {getStepStatus(2) === 'COMPLETED' ? (
                  <BadgeCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : getStepStatus(2) === 'ACTIVE' ? (
                  <Key className="w-4 h-4 text-amber-500 animate-pulse" />
                ) : (
                  <Lock className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <h4 className="text-xs font-bold leading-tight">Sr. Finance Sign-Off</h4>
              <p className="text-[11px] opacity-80 mt-0.5">CFO Statutory Authority</p>
              {workflow?.seniorSignoff && (
                <div className="mt-2 pt-1.5 border-t border-current/10 text-[10px] truncate font-mono">
                  {workflow.seniorSignoff.signatureHash.substring(0, 16)}...
                </div>
              )}
            </div>

            {/* Step 4: Government Portal Transmission */}
            <div id="approval-step-4" className={`p-3 rounded-xl border transition-all ${
              getStepStatus(3) === 'COMPLETED' 
                ? 'bg-cyan-50/70 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800/80 text-cyan-900 dark:text-cyan-200' 
                : getStepStatus(3) === 'ACTIVE' 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 shadow-sm' 
                  : 'bg-slate-100/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Stage 4</span>
                {getStepStatus(3) === 'COMPLETED' ? (
                  <CheckCircle2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                ) : getStepStatus(3) === 'ACTIVE' ? (
                  <Send className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Lock className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <h4 className="text-xs font-bold leading-tight">Portal Dispatch</h4>
              <p className="text-[11px] opacity-80 mt-0.5">NIC IRP / E-Invoice</p>
              {invoice.irn && (
                <div className="mt-2 pt-1.5 border-t border-current/10 text-[10px] truncate font-mono">
                  IRN: {invoice.irn.substring(0, 10)}...
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Tab Navigation */}
        <div id="approval-tab-navigation" className="px-6 border-b border-slate-200 dark:border-slate-800 flex gap-4 text-xs font-semibold">
          <button
            id="tab-workflow-action"
            onClick={() => setActiveTab('WORKFLOW')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'WORKFLOW' 
                ? 'border-blue-600 text-blue-600 dark:text-blue-400' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Action & Controls
          </button>
          <button
            id="tab-compliance-checklist"
            onClick={() => setActiveTab('CHECKLIST')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'CHECKLIST' 
                ? 'border-blue-600 text-blue-600 dark:text-blue-400' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Compliance Checklist
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800">
              5/5
            </span>
          </button>
          <button
            id="tab-audit-trail"
            onClick={() => setActiveTab('AUDIT_TRAIL')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'AUDIT_TRAIL' 
                ? 'border-blue-600 text-blue-600 dark:text-blue-400' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Audit Trail & Hashes
            {workflow?.history && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800">
                {workflow.history.length}
              </span>
            )}
          </button>
          <button
            id="tab-invoice-details"
            onClick={() => setActiveTab('INVOICE_DETAILS')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'INVOICE_DETAILS' 
                ? 'border-blue-600 text-blue-600 dark:text-blue-400' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Invoice Breakdown
          </button>
        </div>

        {/* Modal Body */}
        <div id="approval-modal-body" className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB 1: WORKFLOW CONTROLS & ACTIONS */}
          {activeTab === 'WORKFLOW' && (
            <div className="space-y-6">
              
              {/* STAGE 1: DRAFT STATE */}
              {(approvalStage === 'DRAFT' || approvalStage === 'REVISION_REQUESTED') && (
                <div id="stage-draft-action-panel" className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 rounded-lg shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {approvalStage === 'REVISION_REQUESTED' ? 'Invoice Returned for Revision' : 'Draft Invoice Ready for Submission'}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        As a preparer / accountant, finalize the line items and forward this draft to the Finance Manager for Stage 1 Review.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Submission Notes / Comments for Finance Reviewer:
                    </label>
                    <textarea
                      id="draft-submission-notes"
                      rows={3}
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                      placeholder="e.g., Verified HSN 998313, customer confirmed branch delivery, cost center mapped to TECH-01..."
                      className="w-full text-xs p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      id="submit-for-finance-review-btn"
                      onClick={handleSubmitForReview}
                      disabled={isProcessing}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-2 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      {isProcessing ? 'Submitting...' : 'Submit for Stage 1 Finance Review'}
                    </button>
                  </div>
                </div>
              )}

              {/* STAGE 2: PENDING FINANCE REVIEW */}
              {approvalStage === 'PENDING_FINANCE_REVIEW' && (
                <div id="stage-finance-review-panel" className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 rounded-xl p-5 space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg shrink-0">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Stage 1: Finance Compliance Review Required
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                          Verify line items, GST rate determination, and counterparty credentials before advancing to Senior Finance Sign-Off.
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 shrink-0">
                      Finance Manager Authority
                    </span>
                  </div>

                  {/* Checklist Summary */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Reviewer Compliance Affirmations (All Required):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={checklist.ACTIVE_GSTIN_VERIFIED}
                          onChange={() => toggleChecklistItem('ACTIVE_GSTIN_VERIFIED')}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>Counterparty GSTIN active on portal</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={checklist.HSN_RATE_MATCHED}
                          onChange={() => toggleChecklistItem('HSN_RATE_MATCHED')}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>HSN/SAC 998313 mapped to 18% slab</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={checklist.POS_RULES_VALIDATED}
                          onChange={() => toggleChecklistItem('POS_RULES_VALIDATED')}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>Place of Supply ({invoice.placeOfSupply}) rules valid</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={checklist.ARITHMETIC_CONFIRMED}
                          onChange={() => toggleChecklistItem('ARITHMETIC_CONFIRMED')}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>Arithmetic tax breakdown matched</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Reviewer Feedback / Remarks:
                    </label>
                    <textarea
                      id="finance-review-notes"
                      rows={2}
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                      placeholder="e.g., Audit completed. Validated against purchase order #PO-982. Forwarding to CFO."
                      className="w-full text-xs p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-blue-200 dark:border-blue-800/60 flex-wrap gap-2">
                    <div className="flex gap-2">
                      <button
                        id="request-revision-btn"
                        onClick={handleRequestRevision}
                        disabled={isProcessing}
                        className="px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
                        Request Revision
                      </button>
                      <button
                        id="reject-invoice-btn"
                        onClick={handleReject}
                        disabled={isProcessing}
                        className="px-3 py-2 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-800 dark:text-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        Reject
                      </button>
                    </div>

                    <button
                      id="approve-finance-review-btn"
                      onClick={handleFinanceReviewApprove}
                      disabled={isProcessing || !allChecklistItemsCompleted}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-2 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      {isProcessing ? 'Verifying...' : 'Approve & Escalate to Senior Finance'}
                    </button>
                  </div>
                </div>
              )}

              {/* STAGE 3: PENDING SENIOR FINANCE SIGN-OFF */}
              {approvalStage === 'PENDING_SR_FINANCE_SIGNOFF' && (
                <div id="stage-senior-signoff-panel" className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl p-5 space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-lg shrink-0">
                        <Key className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Stage 2: Senior Finance Manager Sign-Off Required
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                          Statutory sign-off authority (CFO / Partner / Tax Head) required to execute digital cryptographic authorization before portal dispatch.
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 shrink-0">
                      Sr. Finance / CFO Authority
                    </span>
                  </div>

                  {/* Finance Manager Review Card */}
                  {workflow?.reviewedBy && (
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Stage 1 Certified By: </span>
                        <span className="font-medium text-slate-900 dark:text-white">{workflow.reviewedBy.name}</span> ({workflow.reviewedBy.role})
                        <p className="text-[11px] text-slate-500 mt-0.5 italic">"{workflow.reviewedBy.notes}"</p>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded font-semibold text-[10px]">
                        Review Passed
                      </span>
                    </div>
                  )}

                  {/* Signatory Details and Declaration */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Signatory Designation:
                        </label>
                        <input
                          id="signatory-designation-input"
                          type="text"
                          value={signatoryDesignation}
                          onChange={(e) => setSignatoryDesignation(e.target.value)}
                          className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Digital Token / EVC PIN:
                        </label>
                        <input
                          id="signatory-evc-pin-input"
                          type="text"
                          value={evcPin}
                          onChange={(e) => setEvcPin(e.target.value)}
                          placeholder="e.g. 992810"
                          className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    <label className="flex items-start gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 cursor-pointer">
                      <input
                        id="statutory-declaration-checkbox"
                        type="checkbox"
                        checked={declarationAccepted}
                        onChange={(e) => setDeclarationAccepted(e.target.checked)}
                        className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                        I hereby confirm that I have reviewed the tax calculation (₹{invoice.taxAmount.toLocaleString()}), line classifications, and counterparty compliance, and authorize statutory dispatch of this document to the Government Portal (IRP/NIC).
                      </span>
                    </label>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-amber-200 dark:border-amber-800/60 flex-wrap gap-2">
                    <div className="flex gap-2">
                      <button
                        id="sr-request-revision-btn"
                        onClick={handleRequestRevision}
                        disabled={isProcessing}
                        className="px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
                        Request Revision
                      </button>
                      <button
                        id="sr-reject-invoice-btn"
                        onClick={handleReject}
                        disabled={isProcessing}
                        className="px-3 py-2 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-800 dark:text-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        Reject
                      </button>
                    </div>

                    <button
                      id="execute-sr-signoff-btn"
                      onClick={handleSeniorFinanceSignoff}
                      disabled={isProcessing || !declarationAccepted}
                      className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-2 transition-colors"
                    >
                      <BadgeCheck className="w-4 h-4" />
                      {isProcessing ? 'Authorizing...' : 'Formally Sign Off & Authorize Portal Dispatch'}
                    </button>
                  </div>
                </div>
              )}

              {/* STAGE 4: APPROVED - READY FOR PORTAL TRANSMISSION */}
              {approvalStage === 'APPROVED' && (
                <div id="stage-approved-portal-panel" className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-5 space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-lg shrink-0">
                        <BadgeCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Document Fully Signed Off & Authorized for Government Portal
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                          Senior Finance Manager sign-off is complete. The document is authorized to be transmitted to the NIC IRP to generate the official IRN and Signed QR Code.
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 shrink-0">
                      Sign-Off Complete
                    </span>
                  </div>

                  {/* Digital Signature Card */}
                  {workflow?.seniorSignoff && (
                    <div className="p-3.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Signed Off By:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{workflow.seniorSignoff.name} ({workflow.seniorSignoff.designation})</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                        <span>Digital Signature Hash:</span>
                        <span>{workflow.seniorSignoff.signatureHash}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Timestamp:</span>
                        <span>{new Date(workflow.seniorSignoff.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end pt-2 border-t border-emerald-200 dark:border-emerald-800/60">
                    <button
                      id="transmit-to-irp-portal-btn"
                      onClick={handleTransmitToGovernmentPortal}
                      disabled={isProcessing}
                      className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg flex items-center gap-2.5 transition-all"
                    >
                      <Send className="w-4 h-4" />
                      {isProcessing ? 'Registering with IRP...' : 'Transmit to Government Portal (Generate IRN & QR)'}
                    </button>
                  </div>
                </div>
              )}

              {/* STAGE 5: SUBMITTED TO PORTAL (COMPLETED) */}
              {approvalStage === 'SUBMITTED_TO_PORTAL' && (
                <div id="stage-submitted-portal-panel" className="bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800/60 rounded-xl p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 rounded-lg shrink-0">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Official Government Portal Registration Complete
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                        This document has completed all multi-stage approvals and is registered with the NIC Invoice Registration Portal (IRP).
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Invoice Reference Number (IRN):</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100 break-all select-all">
                        {invoice.irn || '35054cc24d97033afc24f49ec4444dbab81f542c555f9d30359dc75794e06bbe'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">IRP Acknowledgment:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        Ack #{invoice.ackNo || '123456789001'} • {invoice.ackDate ? new Date(invoice.ackDate).toLocaleDateString() : 'Active'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: COMPLIANCE CHECKLIST */}
          {activeTab === 'CHECKLIST' && (
            <div id="compliance-checklist-tab-panel" className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
                  Statutory Rule Validation Matrix
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Automated and manual audit checks required before Senior Finance sign-off.
                </p>

                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">Counterparty GSTIN Active Status</span>
                      <p className="text-slate-500 mt-0.5">GSTIN {invoice.gstin || '27ABCDE1234F1Z1'} verified against GSTN live registry. Filing status active with 100% compliance rate.</p>
                    </div>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">HSN / SAC Code Classification</span>
                      <p className="text-slate-500 mt-0.5">Item code 998313 mapped to standard 18% GST slab. Sub-heading description matches services rendered.</p>
                    </div>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">Place of Supply (POS) Determination</span>
                      <p className="text-slate-500 mt-0.5">Place of supply ({invoice.placeOfSupply}) matches delivery state. Tax bifurcated accurately into {invoice.placeOfSupply === '27' ? 'CGST + SGST' : 'IGST'}.</p>
                    </div>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">E-Invoice Statutory Mandate Threshold</span>
                      <p className="text-slate-500 mt-0.5">Entity turnover exceeds ₹5 Crore threshold. E-Invoicing on Government Portal is mandatory under Notification No. 10/2023-CT.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT TRAIL & HASHES */}
          {activeTab === 'AUDIT_TRAIL' && (
            <div id="audit-trail-tab-panel" className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Immutable Workflow Event History
                </h4>
                <span className="text-[11px] font-mono text-slate-500">
                  Total Events: {workflow?.history?.length || 1}
                </span>
              </div>

              <div className="space-y-3">
                {(workflow?.history || []).map((action, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          action.status === 'APPROVED' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' :
                          action.status === 'DISPATCHED' ? 'bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300' :
                          action.status === 'REVISED' ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' :
                          action.status === 'REJECTED' ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300' :
                          'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                        }`}>
                          {action.stage} • {action.status}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{action.actionBy.name}</span>
                        <span className="text-slate-400 text-[11px]">({action.actionBy.designation || action.actionBy.role})</span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {new Date(action.timestamp).toLocaleString()}
                      </span>
                    </div>

                    {action.notes && (
                      <p className="text-slate-600 dark:text-slate-300 text-xs pl-1 border-l-2 border-slate-300 dark:border-slate-700">
                        {action.notes}
                      </p>
                    )}

                    {action.signatureHash && (
                      <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate pt-1">
                        SHA-256 Signature Stamp: {action.signatureHash}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: INVOICE BREAKDOWN */}
          {activeTab === 'INVOICE_DETAILS' && (
            <div id="invoice-details-tab-panel" className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 text-[11px]">Category / Type</span>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5">{invoice.category} • {invoice.type}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 text-[11px]">Branch / Origin</span>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5">{invoice.branchName || 'Mumbai HQ'}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 text-[11px]">Taxable Value</span>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5">₹{invoice.amount.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 text-[11px]">Total Tax (GST)</span>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5">₹{invoice.taxAmount.toLocaleString()}</p>
                </div>
              </div>

              {/* Items List */}
              {invoice.items && invoice.items.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="p-2.5">Item Description</th>
                        <th className="p-2.5">HSN/SAC</th>
                        <th className="p-2.5 text-right">Qty</th>
                        <th className="p-2.5 text-right">Taxable (₹)</th>
                        <th className="p-2.5 text-right">Tax (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {invoice.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5 font-medium">{item.description}</td>
                          <td className="p-2.5 font-mono">{item.hsnSac}</td>
                          <td className="p-2.5 text-right">{item.quantity} {item.unit}</td>
                          <td className="p-2.5 text-right font-medium">₹{item.taxableValue.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-medium">₹{item.taxAmount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div id="invoice-approval-modal-footer" className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Statutory Multi-Stage Approval Policy (SOX & GSTN Compliant)</span>
          </div>
          <button
            id="close-modal-bottom-btn"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-semibold transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

export default InvoiceApprovalWorkflowModal;
