import React, { useState } from 'react';
import { UserRole } from '../../types';
import { 
  ROLE_APPROVAL_PERMISSIONS, 
  DelegationOfAuthority,
  loadDelegations 
} from '../../services/approvalWorkflowService';
import { 
  ShieldCheck, Shield, CheckCircle2, XCircle, Users, 
  Lock, Key, FileCheck, ArrowUpRight, Sliders, AlertTriangle
} from 'lucide-react';
import { DelegationManagerModal } from './DelegationManagerModal';

interface ApprovalRbacMatrixTabProps {
  activeRolePerspective: UserRole;
  onShowToast: (msg: string) => void;
}

export const ApprovalRbacMatrixTab: React.FC<ApprovalRbacMatrixTabProps> = ({
  activeRolePerspective,
  onShowToast
}) => {
  const [isDoaModalOpen, setIsDoaModalOpen] = useState(false);
  const [delegations, setDelegations] = useState<DelegationOfAuthority[]>(loadDelegations());

  const roles = [
    UserRole.ACCOUNTANT,
    UserRole.FINANCE_MANAGER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.AUDITOR,
    UserRole.VIEWER
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* RBAC GOVERNANCE HEADER */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <ShieldCheck size={22} />
            </span>
            <h3 className="text-xl font-black text-slate-900">Role-Based Access Control (RBAC) Governance</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Enforces strict statutory sign-off limits, Separation of Duties (SoD) Four-Eyes rules, and temporary Delegation of Authority (DOA).
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsDoaModalOpen(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all shrink-0"
        >
          <Users size={16} /> Manage Delegation of Authority ({delegations.filter(d => d.isActive).length})
        </button>
      </div>

      {/* FOUR-EYES & SOD PRINCIPLE EXPLANATION CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-1.5">
          <div className="flex items-center gap-2 text-blue-900 font-extrabold text-xs">
            <CheckCircle2 size={16} className="text-blue-600" />
            <span>Four-Eyes Principle (SoD)</span>
          </div>
          <p className="text-[11px] text-blue-800 leading-relaxed">
            Preparers (Accountants) are strictly barred from approving their own drafted returns. Every filing requires independent review by a distinct Finance Manager.
          </p>
        </div>

        <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-1.5">
          <div className="flex items-center gap-2 text-purple-900 font-extrabold text-xs">
            <Sliders size={16} className="text-purple-600" />
            <span>Two-Stage Threshold Escalation</span>
          </div>
          <p className="text-[11px] text-purple-800 leading-relaxed">
            Filings with net tax liabilities exceeding ₹5,00,000 automatically escalate to Tax Head / Partner (L2 Authority) for dual authorization before portal dispatch.
          </p>
        </div>

        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-xs">
            <FileCheck size={16} className="text-emerald-600" />
            <span>Auditor Independence</span>
          </div>
          <p className="text-[11px] text-emerald-800 leading-relaxed">
            External and internal auditors possess immutable read-only assurance access to inspect cryptographic SHA-256 certificate hashes and log compliance notes.
          </p>
        </div>
      </div>

      {/* RBAC PERMISSION MATRIX TABLE */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Key size={18} className="text-indigo-600" /> Granular Role Approval Capabilities
          </h4>
          <span className="text-[11px] font-mono text-slate-400">
            Active Workspace Perspective: <strong className="text-indigo-600 uppercase">{activeRolePerspective}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider font-mono">
                <th className="py-3 px-4">Role &amp; Tier</th>
                <th className="py-3 px-3 text-center">Draft &amp; Submit</th>
                <th className="py-3 px-3 text-center">L1 Review (≤₹5L)</th>
                <th className="py-3 px-3 text-center">L2 Sign-Off (&gt;₹5L)</th>
                <th className="py-3 px-3 text-center">Revise / Reject</th>
                <th className="py-3 px-3 text-center">GSTN EVC Lock</th>
                <th className="py-3 px-3 text-center">Policy Config</th>
                <th className="py-3 px-3 text-center">Audit Remarks</th>
                <th className="py-3 px-4">Max Single Cap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roles.map(r => {
                const perm = ROLE_APPROVAL_PERMISSIONS[r];
                const isCurrentRole = activeRolePerspective === r;

                return (
                  <tr 
                    key={r}
                    className={`transition-colors ${
                      isCurrentRole ? 'bg-indigo-50/60 font-semibold' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isCurrentRole ? 'bg-indigo-600 animate-ping' : 'bg-slate-300'}`} />
                        <div>
                          <p className="font-extrabold text-slate-900 text-xs">{perm.roleLabel}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{r}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center">
                      {perm.canDraft ? (
                        <CheckCircle2 size={16} className="text-emerald-600 mx-auto" />
                      ) : (
                        <XCircle size={16} className="text-slate-300 mx-auto" />
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      {perm.canApproveL1 ? (
                        <CheckCircle2 size={16} className="text-emerald-600 mx-auto" />
                      ) : (
                        <XCircle size={16} className="text-slate-300 mx-auto" />
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      {perm.canApproveL2 ? (
                        <CheckCircle2 size={16} className="text-purple-600 mx-auto" />
                      ) : (
                        <XCircle size={16} className="text-slate-300 mx-auto" />
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      {perm.canRequestRevision ? (
                        <CheckCircle2 size={16} className="text-amber-600 mx-auto" />
                      ) : (
                        <XCircle size={16} className="text-slate-300 mx-auto" />
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      {perm.canDispatchToGstn ? (
                        <CheckCircle2 size={16} className="text-blue-600 mx-auto" />
                      ) : (
                        <XCircle size={16} className="text-slate-300 mx-auto" />
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      {perm.canModifyPolicy ? (
                        <CheckCircle2 size={16} className="text-indigo-600 mx-auto" />
                      ) : (
                        <XCircle size={16} className="text-slate-300 mx-auto" />
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      {perm.canAuditAndRemark ? (
                        <CheckCircle2 size={16} className="text-teal-600 mx-auto" />
                      ) : (
                        <XCircle size={16} className="text-slate-300 mx-auto" />
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {perm.maxSingleSignoffAmount === 0 
                        ? (perm.canApproveL2 ? 'Unlimited' : 'None (₹0)')
                        : `₹${perm.maxSingleSignoffAmount.toLocaleString('en-IN')}`
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ACTIVE DELEGATIONS SUMMARY CARD */}
      <div className="p-5 bg-slate-900 text-white rounded-3xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-black text-indigo-400 uppercase tracking-wider font-mono">Active Delegation Summary</p>
          <p className="text-sm font-bold text-slate-200">
            {delegations.filter(d => d.isActive).length} delegations currently active across branches.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsDoaModalOpen(true)}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors border border-slate-700"
        >
          View &amp; Edit Delegations
        </button>
      </div>

      <DelegationManagerModal
        isOpen={isDoaModalOpen}
        onClose={() => setIsDoaModalOpen(false)}
        currentUserRole={activeRolePerspective}
        onDelegationsUpdated={() => setDelegations(loadDelegations())}
        onShowToast={onShowToast}
      />
    </div>
  );
};
