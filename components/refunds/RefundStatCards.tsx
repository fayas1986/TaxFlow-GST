import React from 'react';
import { 
  IndianRupee, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  ShieldCheck, 
  Landmark,
  FileSpreadsheet
} from 'lucide-react';
import { ItcRefundClaim } from '../../services/refundService';

interface RefundStatCardsProps {
  claims: ItcRefundClaim[];
}

export const RefundStatCards: React.FC<RefundStatCardsProps> = ({ claims }) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const totalClaimed = claims.reduce((acc, c) => acc + c.amountClaimed.total, 0);
  const totalDisbursed = claims.reduce((acc, c) => acc + c.amountDisbursed, 0);
  
  const pendingClaims = claims.filter(c => c.status !== 'RFD05_DISBURSED' && c.status !== 'REJECTED');
  const totalUnderProcessing = pendingClaims.reduce((acc, c) => acc + (c.amountClaimed.total - c.amountDisbursed), 0);
  
  const actionRequiredClaims = claims.filter(c => c.status === 'RFD03_DEFICIENCY_MEMO' || c.status === 'RFD08_SCN_ISSUED');
  const actionRequiredAmount = actionRequiredClaims.reduce((acc, c) => acc + c.amountClaimed.total, 0);

  const overdueClaims = claims.filter(c => c.sla.urgencyLevel === 'CRITICAL_INTEREST_DUE' || c.sla.urgencyLevel === 'OVERDUE');
  const accruedInterestTotal = claims.reduce((acc, c) => acc + c.sla.accruedInterest, 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Claimed Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Total ITC Claimed
          </span>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <FileSpreadsheet size={20} />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatCurrency(totalClaimed)}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-[11px]">
              {claims.length} Applications
            </span>
            <span>across all tax periods</span>
          </div>
        </div>
      </div>

      {/* Disbursed Amount Card */}
      <div className="bg-white rounded-2xl p-5 border border-emerald-200/90 shadow-xs hover:shadow-md transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            PFMS Disbursed (Credited)
          </span>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Landmark size={20} />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black text-emerald-700 tracking-tight">
            {formatCurrency(totalDisbursed)}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[11px]">
              <CheckCircle2 size={11} /> {Math.round((totalDisbursed / (totalClaimed || 1)) * 100)}% Realized
            </span>
            <span>Direct to Bank Account</span>
          </div>
        </div>
      </div>

      {/* Under Processing Card */}
      <div className="bg-white rounded-2xl p-5 border border-indigo-200/90 shadow-xs hover:shadow-md transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
            Under Active Processing
          </span>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <Clock size={20} />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black text-indigo-900 tracking-tight">
            {formatCurrency(totalUnderProcessing)}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[11px]">
              {pendingClaims.length} Claims Active
            </span>
            <span>RFD-02 / RFD-04 Stage</span>
          </div>
        </div>
      </div>

      {/* Notices / Action Required Card */}
      <div className={`bg-white rounded-2xl p-5 border shadow-xs hover:shadow-md transition-all ${
        actionRequiredClaims.length > 0 ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
            Action Required / Notices
          </span>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
            actionRequiredClaims.length > 0 
              ? 'bg-amber-100 text-amber-700 border-amber-200' 
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            <AlertTriangle size={20} />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black text-amber-900 tracking-tight">
            {actionRequiredClaims.length} Notices
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="text-amber-700 font-bold text-[11px]">
              {formatCurrency(actionRequiredAmount)}
            </span>
            <span>(RFD-03 / RFD-08 SCN)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
