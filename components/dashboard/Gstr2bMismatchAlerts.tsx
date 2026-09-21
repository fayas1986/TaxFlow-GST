import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ShieldAlert, AlertTriangle, CheckCircle2, RefreshCw, ChevronRight, 
  ArrowRightLeft, Send, Check, X, FileSearch, Sparkles, ExternalLink
} from 'lucide-react';
import { fetchReconData } from '../../services/api';
import { ReconItem } from '../../types';

interface Gstr2bMismatchAlertsProps {
  tenantId: string;
}

export const Gstr2bMismatchAlerts: React.FC<Gstr2bMismatchAlertsProps> = ({ tenantId }) => {
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Query Purchase Reconciliation data representing the imported bills vs GSTR-2B portal data
  const { data: reconItems, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['reconData', 'PURCHASE', tenantId],
    queryFn: () => fetchReconData('PURCHASE', tenantId)
  });

  // Filter out actual compliance anomalies or mismatches
  const localMismatches = useMemo(() => {
    if (!reconItems) return [];
    return reconItems.filter(item => 
      item.status === 'MISMATCH' || 
      item.status === 'MISSING_IN_BOOKS' || 
      item.status === 'MISSING_IN_PORTAL' || 
      item.status === 'EXCESS_ITC'
    );
  }, [reconItems]);

  const activeMismatches = localMismatches.filter(item => !resolvedIds.includes(item.id));

  const handleQuickResolve = (id: string, solutionType: 'ACCEPT_PORTAL' | 'ACCEPT_BOOKS' | 'SEND_VENDOR_REMINDER') => {
    setActioningId(id);
    
    // Simulate real-time API sync and resolution ledger tracking
    setTimeout(() => {
      setResolvedIds(prev => [...prev, id]);
      setActioningId(null);
      
      let msg = "";
      if (solutionType === 'ACCEPT_PORTAL') {
        msg = "Adjusted local ITC ledger to align with official GSTR-2B filing.";
      } else if (solutionType === 'ACCEPT_BOOKS') {
        msg = "Flagged invoice to support manual vendor GSTR-1 amendment.";
      } else {
        msg = "Automated email & portal notification pushed to vendor requesting GSTR-1 upload.";
      }
      setActionMessage(msg);
      setTimeout(() => setActionMessage(null), 4000);
    }, 1200);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-center gap-2">
        <RefreshCw size={16} className="animate-spin text-indigo-600" />
        <span className="text-xs text-slate-500 font-bold">Scanning GSTR-2B portal mismatch ledger...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-6 space-y-4">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg shrink-0">
              <ShieldAlert size={18} className="animate-pulse" />
            </span>
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              GSTR-2B Portal Mismatch Detector
            </h3>
            {activeMismatches.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 animate-bounce">
                {activeMismatches.length} Active Mismatch
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Automated background agent compares uploaded purchase register bills with real-time official GSTR-2B filings from the GSTN portal.
          </p>
        </div>

        <button 
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-700 font-extrabold text-xs rounded-xl border border-slate-200/80 transition-all flex items-center gap-1.5 self-start sm:self-center"
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} /> Force Portal Fetch
        </button>
      </div>

      {/* Status messages / Toast inside container */}
      {actionMessage && (
        <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-950 rounded-xl text-xs font-bold animate-in fade-in slide-in-from-top-1 flex items-center gap-2">
          <Sparkles size={14} className="text-indigo-600" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Main Alerts List */}
      {activeMismatches.length === 0 ? (
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center space-y-2">
          <CheckCircle2 size={36} className="text-emerald-500 mx-auto" />
          <h4 className="font-extrabold text-slate-800 text-sm">GSTR-2B Reconciliation 100% Matching</h4>
          <p className="text-[11px] text-slate-500 max-w-md mx-auto">
            Excellent! All uploaded purchase register items perfectly correspond with tax records uploaded by your supplier network to GSTR-2B. No ITC is currently at risk.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeMismatches.map((item) => {
            const isMissingInPortal = item.status === 'MISSING_IN_PORTAL';
            const isMissingInBooks = item.status === 'MISSING_IN_BOOKS';
            const isDiff = item.status === 'MISMATCH' || item.status === 'EXCESS_ITC';

            return (
              <div 
                key={item.id}
                className="bg-slate-50/50 hover:bg-slate-50 transition-all border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between space-y-4"
              >
                {/* Item Header */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-slate-800 font-black text-xs">
                      {item.invoiceNumber}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                      isMissingInPortal 
                        ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                        : isMissingInBooks 
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}>
                      {item.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <h5 className="font-black text-slate-800 text-xs truncate">{item.partyName}</h5>
                    <p className="text-[10px] text-slate-400 font-mono">{item.gstin || 'GSTIN UNKNOWN'}</p>
                  </div>
                </div>

                {/* Audit Grid */}
                <div className="bg-white rounded-xl border border-slate-200/60 p-2.5 grid grid-cols-2 gap-2 text-center text-[10px]">
                  <div className="border-r border-slate-100">
                    <span className="text-slate-400 font-medium block">Local Books</span>
                    <strong className="font-mono text-slate-800 text-xs">
                      ₹{item.taxAmountBooks?.toLocaleString() || '0'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block">GSTR-2B Portal</span>
                    <strong className="font-mono text-slate-800 text-xs">
                      ₹{item.taxAmountPortal?.toLocaleString() || '0'}
                    </strong>
                  </div>
                </div>

                {/* Conflict Detail and Suggested action */}
                <div className="text-[11px] text-slate-500 leading-normal bg-white rounded-xl p-2.5 border border-slate-100">
                  <span className="font-bold text-slate-700 block mb-0.5">Discrepancy:</span>
                  {isMissingInPortal && "Supplier hasn't uploaded invoice to GSTR-1 yet. ₹" + (item.taxAmountBooks || 0).toLocaleString() + " ITC currently blocked."}
                  {isMissingInBooks && "Unclaimed supplier credit detected in GSTR-2B. Potential ₹" + (item.taxAmountPortal || 0).toLocaleString() + " cash-flow saving."}
                  {isDiff && `Tax discrepancy flagged. Portal claims ₹${item.taxAmountPortal?.toLocaleString()} but local register lists ₹${item.taxAmountBooks?.toLocaleString()}.`}
                </div>

                {/* Immediate Action Row */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[9px] text-rose-600 font-black tracking-tight uppercase animate-pulse shrink-0">
                    ITC AT RISK: ₹{(item.difference || Math.abs((item.taxAmountBooks || 0) - (item.taxAmountPortal || 0))).toLocaleString()}
                  </span>

                  <div className="flex gap-1">
                    {/* Accept Official Portal amount (resolve local book mismatch) */}
                    <button
                      onClick={() => handleQuickResolve(item.id, 'ACCEPT_PORTAL')}
                      disabled={actioningId !== null}
                      className="p-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg transition-colors"
                      title="Update Books to Portal Values"
                    >
                      <Check size={12} />
                    </button>

                    {/* Dispute & send dynamic vendor GSTR-1 filing push */}
                    {isMissingInPortal && (
                      <button
                        onClick={() => handleQuickResolve(item.id, 'SEND_VENDOR_REMINDER')}
                        disabled={actioningId !== null}
                        className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-[10px] font-bold flex items-center gap-1 shrink-0"
                        title="Ping vendor for fast GSTR-1 return upload"
                      >
                        <Send size={10} /> Ping Vendor
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
