import React, { useState } from 'react';
import { UserRole } from '../../types';
import { 
  ApprovalRequest, 
  ApprovalThresholdConfig,
  DelegationOfAuthority,
  validateApprovalActionPermission,
  addAuditorObservation
} from '../../services/approvalWorkflowService';
import { 
  ShieldCheck, ShieldAlert, CheckCircle2, AlertCircle, Clock, 
  FileText, Download, Check, RefreshCw, Lock, MessageSquare, 
  AlertTriangle, Shield, Send, ArrowUpRight, HelpCircle
} from 'lucide-react';

interface ApprovalRequestInspectorProps {
  request: ApprovalRequest;
  activeRolePerspective: UserRole;
  currentUserEmail?: string;
  currentUserName?: string;
  policyConfig: ApprovalThresholdConfig;
  delegations: DelegationOfAuthority[];
  onOpenActionModal: (type: 'APPROVE' | 'REQUEST_REVISION' | 'REJECT' | 'ESCALATE' | 'DISPATCH_TO_GSTN', req: ApprovalRequest) => void;
  onDownloadCertificate: (req: ApprovalRequest) => void;
  onShowToast: (msg: string) => void;
  onRefreshRequests: () => void;
}

export const ApprovalRequestInspector: React.FC<ApprovalRequestInspectorProps> = ({
  request,
  activeRolePerspective,
  currentUserEmail = 'user@taxflow.in',
  currentUserName = 'Active User',
  policyConfig,
  delegations,
  onOpenActionModal,
  onDownloadCertificate,
  onShowToast,
  onRefreshRequests
}) => {
  // Auditor observation text state
  const [auditorRemark, setAuditorRemark] = useState('');
  const [isAuditorSubmitting, setIsAuditorSubmitting] = useState(false);

  // Validate action permissions using RBAC engine
  const approveValidation = validateApprovalActionPermission(
    activeRolePerspective,
    'APPROVE',
    request,
    currentUserEmail,
    policyConfig,
    delegations
  );

  const revisionValidation = validateApprovalActionPermission(
    activeRolePerspective,
    'REQUEST_REVISION',
    request,
    currentUserEmail,
    policyConfig,
    delegations
  );

  const dispatchValidation = validateApprovalActionPermission(
    activeRolePerspective,
    'DISPATCH_TO_GSTN',
    request,
    currentUserEmail,
    policyConfig,
    delegations
  );

  const isHighValue = request.taxAmount.totalTax > policyConfig.singleStageLimit;
  const isAuthor = currentUserEmail && request.submittedBy.email && currentUserEmail.toLowerCase() === request.submittedBy.email.toLowerCase();

  const handleAddAuditorRemark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditorRemark.trim()) {
      onShowToast('Please write an audit remark');
      return;
    }

    setIsAuditorSubmitting(true);
    try {
      addAuditorObservation(
        request.id,
        {
          name: currentUserName,
          email: currentUserEmail,
          role: activeRolePerspective
        },
        auditorRemark
      );
      setAuditorRemark('');
      onRefreshRequests();
      onShowToast('Added official Auditor Compliance Observation');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to add remark');
    } finally {
      setIsAuditorSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-md space-y-6 sticky top-6">
      {/* HEADER & CERTIFICATE DOWNLOAD */}
      <div className="flex items-start justify-between border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-black text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-md">
              {request.requestNumber}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              request.status.startsWith('PENDING') ? 'bg-amber-100 text-amber-800' :
              request.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
              request.status === 'SUBMITTED_TO_GSTN' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {request.status.replace(/_/g, ' ')}
            </span>
          </div>
          <h3 className="text-base font-black text-slate-900 mt-2">{request.title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Submitted by <strong>{request.submittedBy.name}</strong> ({request.submittedBy.role})
          </p>
        </div>

        <button
          type="button"
          onClick={() => onDownloadCertificate(request)}
          className="p-2.5 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors shrink-0"
          title="Download Cryptographic Audit Certificate"
        >
          <Download size={18} />
        </button>
      </div>

      {/* RBAC GOVERNANCE & SOD STATUS BANNER */}
      <div className="p-3.5 rounded-2xl border text-xs space-y-1.5 bg-slate-50 border-slate-200">
        <div className="flex items-center justify-between">
          <span className="font-extrabold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
            <ShieldCheck size={14} className="text-indigo-600" /> RBAC Authorization Assessment
          </span>
          <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
            Role: {activeRolePerspective}
          </span>
        </div>

        {/* Four-Eyes SoD check warning */}
        {isAuthor && (
          <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] font-semibold flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            <span>Separation of Duties (SoD): As the preparer, you cannot self-approve this submission.</span>
          </div>
        )}

        {/* High-value dual sign-off notification */}
        {isHighValue && (
          <div className="p-2 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 text-[11px] flex items-center justify-between">
            <span className="font-bold flex items-center gap-1.5">
              <Shield size={14} className="text-purple-600 shrink-0" />
              High Value (&gt; ₹5L): Requires Dual Sign-Off (FM + Tax Head)
            </span>
            <span className="text-[10px] font-mono bg-purple-200/80 px-1.5 py-0.5 rounded-md">Tier 2</span>
          </div>
        )}

        {/* Active Delegation notice */}
        {approveValidation.hasDelegation && (
          <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-[11px] font-bold flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
            <span>{approveValidation.reason}</span>
          </div>
        )}
      </div>

      {/* TAX LIABILITY BREAKDOWN */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px]">Financial Tax Liability</span>
          <span className="font-mono font-extrabold text-blue-700">{request.taxPeriod}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2 bg-white rounded-xl border border-slate-200">
            <p className="text-[10px] text-slate-400 font-sans font-bold">CGST</p>
            <p className="font-extrabold text-slate-900 mt-0.5">₹{request.taxAmount.cgst.toLocaleString('en-IN')}</p>
          </div>
          <div className="p-2 bg-white rounded-xl border border-slate-200">
            <p className="text-[10px] text-slate-400 font-sans font-bold">SGST</p>
            <p className="font-extrabold text-slate-900 mt-0.5">₹{request.taxAmount.sgst.toLocaleString('en-IN')}</p>
          </div>
          <div className="p-2 bg-white rounded-xl border border-slate-200">
            <p className="text-[10px] text-slate-400 font-sans font-bold">IGST</p>
            <p className="font-extrabold text-slate-900 mt-0.5">₹{request.taxAmount.igst.toLocaleString('en-IN')}</p>
          </div>
          <div className="p-2 bg-white rounded-xl border border-slate-200">
            <p className="text-[10px] text-slate-400 font-sans font-bold">Cess</p>
            <p className="font-extrabold text-slate-900 mt-0.5">₹{request.taxAmount.cess.toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="p-3 bg-blue-600 text-white rounded-xl flex items-center justify-between font-mono">
          <span className="text-xs font-bold uppercase font-sans">Total Tax Due</span>
          <span className="text-base font-black">₹{request.taxAmount.totalTax.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* PRE-FILING RISK CHECKS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
            <ShieldAlert size={14} className="text-indigo-600" /> Statutory Risk Checks
          </span>
          <span className="font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[10px]">
            Score: {request.riskScore}/100
          </span>
        </div>

        <div className="space-y-1.5">
          {request.riskChecks.map(check => (
            <div key={check.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-start gap-2">
              <CheckCircle2 size={15} className={check.status === 'PASS' ? 'text-emerald-600 shrink-0 mt-0.5' : 'text-amber-600 shrink-0 mt-0.5'} />
              <div>
                <p className="font-bold text-slate-800">{check.label}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{check.details}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SEQUENTIAL AUDIT TRAIL */}
      <div className="space-y-3">
        <h4 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <MessageSquare size={14} className="text-blue-600" /> Sequential Audit Trail ({request.comments?.length || 0})
        </h4>

        <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
          {(request.comments || []).map(c => (
            <div key={c.id} className={`p-3 rounded-xl border text-xs space-y-1 ${
              c.actionTaken === 'AUDIT_OBSERVATION' 
                ? 'bg-teal-50 border-teal-200' 
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                  {c.authorName} 
                  <span className="font-mono text-[10px] text-slate-500 font-normal">({c.authorRole})</span>
                </span>
                <span className="text-slate-400 font-mono text-[10px]">{new Date(c.timestamp).toLocaleDateString()}</span>
              </div>
              <p className="text-slate-700 text-xs">{c.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AUDITOR OBSERVATION INPUT (FOR AUDITOR / ADMIN ROLES) */}
      {(activeRolePerspective === UserRole.AUDITOR || activeRolePerspective === UserRole.ADMIN) && (
        <form onSubmit={handleAddAuditorRemark} className="p-3.5 bg-teal-50/80 border border-teal-200 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-teal-700" /> Log Official Auditor Observation
            </span>
          </div>
          <textarea
            rows={2}
            value={auditorRemark}
            onChange={(e) => setAuditorRemark(e.target.value)}
            placeholder="Record compliance verification remarks or audit findings..."
            className="w-full p-2.5 bg-white border border-teal-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
          />
          <button
            type="submit"
            disabled={isAuditorSubmitting}
            className="w-full py-2 bg-teal-700 hover:bg-teal-600 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
          >
            <Send size={14} /> Append Audit Observation
          </button>
        </form>
      )}

      {/* REVIEWER ACTION BUTTONS WITH RBAC ENFORCEMENT */}
      <div className="pt-4 border-t border-slate-200 space-y-2">
        <p className="text-[11px] font-bold text-slate-500 uppercase flex items-center justify-between">
          <span>Reviewer Execution Actions</span>
          <span className="font-mono text-[10px] text-slate-400">RBAC Guarded</span>
        </p>

        <div className="grid grid-cols-2 gap-2">
          {/* PENDING APPROVAL STAGES */}
          {request.status.startsWith('PENDING') && (
            <>
              {/* APPROVE BUTTON */}
              <button
                type="button"
                disabled={!approveValidation.allowed}
                onClick={() => onOpenActionModal('APPROVE', request)}
                className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 shadow-md ${
                  approveValidation.allowed
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
                title={approveValidation.reason || 'Approve Request'}
              >
                {approveValidation.allowed ? (
                  <>
                    <Check size={16} /> Approve ({activeRolePerspective === UserRole.ADMIN ? 'L2 Sign-off' : 'L1 Review'})
                  </>
                ) : (
                  <>
                    <Lock size={14} /> Approve (Restricted)
                  </>
                )}
              </button>

              {/* REQUEST REVISION BUTTON */}
              <button
                type="button"
                disabled={!revisionValidation.allowed}
                onClick={() => onOpenActionModal('REQUEST_REVISION', request)}
                className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 shadow-md ${
                  revisionValidation.allowed
                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
                title={revisionValidation.reason || 'Request Revision'}
              >
                <RefreshCw size={15} /> Request Revision
              </button>

              {/* ESCALATE ACTION (FOR FINANCE MANAGERS FACING OVER-LIMIT FILINGS) */}
              {activeRolePerspective === UserRole.FINANCE_MANAGER && isHighValue && !request.escalatedToTaxHead && (
                <button
                  type="button"
                  onClick={() => onOpenActionModal('ESCALATE', request)}
                  className="col-span-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-extrabold text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  <ArrowUpRight size={16} /> Escalate to Tax Head / Partner (Exceeds ₹5L)
                </button>
              )}
            </>
          )}

          {/* APPROVED STAGE -> GSTN PORTAL DISPATCH */}
          {request.status === 'APPROVED' && (
            <button
              type="button"
              disabled={!dispatchValidation.allowed}
              onClick={() => onOpenActionModal('DISPATCH_TO_GSTN', request)}
              className={`col-span-2 px-4 py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg ${
                dispatchValidation.allowed
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
              title={dispatchValidation.reason || 'EVC / DSC Sign & Dispatch to GSTN Portal'}
            >
              <Lock size={16} /> EVC / DSC Sign &amp; Dispatch to GSTN Portal
            </button>
          )}

          {/* ALREADY SUBMITTED STAGE */}
          {request.status === 'SUBMITTED_TO_GSTN' && (
            <div className="col-span-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-bold flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <span>Submitted to GST Portal with ARN {request.portalSubmissionArn}</span>
            </div>
          )}
        </div>

        {/* Helper message if restricted */}
        {!approveValidation.allowed && (
          <p className="text-[10px] text-slate-500 italic mt-1 text-center">
            {approveValidation.reason}
          </p>
        )}
      </div>
    </div>
  );
};
