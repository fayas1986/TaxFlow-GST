import React, { useState } from 'react';
import { UserRole } from '../../types';
import { 
  DelegationOfAuthority, 
  loadDelegations, 
  saveDelegations, 
  createDelegation, 
  toggleDelegation 
} from '../../services/approvalWorkflowService';
import { ShieldCheck, UserPlus, CheckCircle2, Clock, X, AlertCircle } from 'lucide-react';

interface DelegationManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserRole: UserRole;
  onDelegationsUpdated: () => void;
  onShowToast: (msg: string) => void;
}

export const DelegationManagerModal: React.FC<DelegationManagerModalProps> = ({
  isOpen,
  onClose,
  currentUserRole,
  onDelegationsUpdated,
  onShowToast
}) => {
  const [delegations, setDelegations] = useState<DelegationOfAuthority[]>(loadDelegations());
  const [showAddForm, setShowAddForm] = useState(false);

  // New Delegation Form State
  const [delegatedToRole, setDelegatedToRole] = useState<UserRole>(UserRole.ACCOUNTANT);
  const [delegatedToName, setDelegatedToName] = useState('Rohan Sharma');
  const [delegatedToEmail, setDelegatedToEmail] = useState('rohan.accountant@taxflow.in');
  const [maxApprovalLimit, setMaxApprovalLimit] = useState(200000);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
  const [reason, setReason] = useState('Acting interim approval authority during audit period.');

  if (!isOpen) return null;

  const handleToggle = (id: string) => {
    const updated = toggleDelegation(id);
    setDelegations(updated);
    onDelegationsUpdated();
    onShowToast('Updated delegation status');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegatedToName.trim() || !delegatedToEmail.trim()) {
      onShowToast('Please fill all required fields');
      return;
    }

    createDelegation({
      delegatorRole: currentUserRole,
      delegatorName: currentUserRole === UserRole.FINANCE_MANAGER ? 'Anish Kapoor (FM)' : 'Tax Head / Admin',
      delegatedToRole,
      delegatedToName,
      delegatedToEmail,
      maxApprovalLimit: Number(maxApprovalLimit),
      startDate,
      endDate,
      isActive: true,
      reason
    });

    const refreshed = loadDelegations();
    setDelegations(refreshed);
    setShowAddForm(false);
    onDelegationsUpdated();
    onShowToast(`Created Delegation of Authority to ${delegatedToName}`);
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-2xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-2xl">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Delegation of Authority (DOA)</h3>
              <p className="text-xs text-slate-500">Temporarily delegate approval powers with defined monetary limits</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* ACTIVE DELEGATIONS LIST */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Active Delegations</h4>
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
            >
              <UserPlus size={14} /> {showAddForm ? 'Cancel Form' : 'Add Delegation'}
            </button>
          </div>

          {delegations.length === 0 ? (
            <p className="text-xs text-slate-400 p-4 bg-slate-50 rounded-2xl text-center">No active delegations configured.</p>
          ) : (
            delegations.map(del => (
              <div key={del.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900">{del.delegatedToName}</span>
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 font-mono text-[10px] rounded-md font-bold">
                      {del.delegatedToRole}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      del.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {del.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Delegator: <strong>{del.delegatorName}</strong> &bull; Max Cap: <strong className="font-mono text-emerald-700">₹{del.maxApprovalLimit.toLocaleString('en-IN')}</strong>
                  </p>
                  <p className="text-slate-500 text-[11px] flex items-center gap-1">
                    <Clock size={12} /> Valid: {del.startDate} to {del.endDate}
                  </p>
                  <p className="text-slate-700 italic text-[11px]">"{del.reason}"</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggle(del.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    del.isActive 
                      ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' 
                      : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  }`}
                >
                  {del.isActive ? 'Revoke' : 'Activate'}
                </button>
              </div>
            ))
          )}
        </div>

        {/* ADD DELEGATION FORM */}
        {showAddForm && (
          <form onSubmit={handleCreate} className="p-5 bg-indigo-50/70 border border-indigo-200 rounded-3xl space-y-3 text-xs">
            <h4 className="font-extrabold text-indigo-950 flex items-center gap-1.5">
              <UserPlus size={16} className="text-indigo-600" /> Delegate Authority Grant
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Delegatee Name</label>
                <input
                  type="text"
                  value={delegatedToName}
                  onChange={(e) => setDelegatedToName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Delegatee Email</label>
                <input
                  type="email"
                  value={delegatedToEmail}
                  onChange={(e) => setDelegatedToEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-slate-900 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Delegatee Role</label>
                <select
                  value={delegatedToRole}
                  onChange={(e) => setDelegatedToRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl font-bold text-slate-900"
                >
                  <option value={UserRole.ACCOUNTANT}>Staff Accountant</option>
                  <option value={UserRole.FINANCE_MANAGER}>Finance Manager</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Max Approval Cap (INR)</label>
                <input
                  type="number"
                  value={maxApprovalLimit}
                  onChange={(e) => setMaxApprovalLimit(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl font-mono font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Business Reason</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Leave coverage, audit surge"
                className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-slate-900"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl transition-all shadow-md mt-2"
            >
              Grant Delegation Authorization
            </button>
          </form>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
