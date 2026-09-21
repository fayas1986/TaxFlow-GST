import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  RefreshCw, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  Download, 
  AlertCircle, 
  CheckCircle2, 
  Landmark, 
  HelpCircle,
  TrendingUp,
  FileCheck
} from 'lucide-react';
import { RefundStatCards } from '../components/refunds/RefundStatCards';
import { PortalConnectionBanner } from '../components/refunds/PortalConnectionBanner';
import { RefundClaimsList } from '../components/refunds/RefundClaimsList';
import { RefundClaimDetailsModal } from '../components/refunds/RefundClaimDetailsModal';
import { NewRefundEstimatorModal } from '../components/refunds/NewRefundEstimatorModal';
import { RefundService, ItcRefundClaim } from '../services/refundService';

export const RefundStatusDashboard: React.FC = () => {
  const [claims, setClaims] = useState<ItcRefundClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [lastSyncedTime, setLastSyncedTime] = useState('');
  const [selectedClaim, setSelectedClaim] = useState<ItcRefundClaim | null>(null);
  const [isNewClaimModalOpen, setIsNewClaimModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: 'SUCCESS' | 'INFO'; message: string } | null>(null);

  useEffect(() => {
    loadClaims();
  }, []);

  const loadClaims = async () => {
    setIsLoading(true);
    try {
      const data = await RefundService.fetchClaims();
      setClaims(data);
      setLastSyncedTime(data[0]?.portalSync?.lastSyncedAt || 'Real-Time');
    } catch (err) {
      console.error('Failed to load refund claims', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncPortals = async () => {
    setIsSyncing(true);
    setNotification(null);
    try {
      const result = await RefundService.syncWithGovernmentPortals();
      setClaims(result.updatedClaims);
      setSyncLogs(result.syncLog);
      setLastSyncedTime(result.updatedClaims[0]?.portalSync?.lastSyncedAt || 'Just Now');
      
      setNotification({
        type: 'SUCCESS',
        message: `Successfully synchronized ${result.syncedCount} refund claims with GST Common Portal, ICEGATE & PFMS.`
      });

      setTimeout(() => {
        setNotification(null);
      }, 5000);
    } catch (err) {
      console.error('Failed to sync portals', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSearchArn = async (arn: string) => {
    const found = await RefundService.getClaimByArn(arn);
    if (found) {
      setSelectedClaim(found);
      setNotification({
        type: 'INFO',
        message: `Found statutory claim record for ARN ${found.arn}. Opened detailed inspector.`
      });
    } else {
      alert(`No refund claim found matching ARN: "${arn}". Ensure the ARN format is correct (e.g., AA2706260018921).`);
    }
  };

  const handleClaimUpdated = (updated: ItcRefundClaim) => {
    setClaims(prev => prev.map(c => c.id === updated.id ? updated : c));
    setSelectedClaim(updated);
  };

  const handleClaimCreated = (newClaim: ItcRefundClaim) => {
    setClaims(prev => [newClaim, ...prev]);
    setSelectedClaim(newClaim);
    setNotification({
      type: 'SUCCESS',
      message: `Form GST RFD-01 created successfully! Application Reference Number: ${newClaim.arn}`
    });
  };

  const handleExportCsv = () => {
    if (claims.length === 0) return;

    const headers = ['ARN', 'GSTIN', 'Legal Name', 'Tax Period', 'Category', 'Filing Date', 'Claimed Amount (INR)', 'Disbursed Amount (INR)', 'Status', 'SLA Days Elapsed', 'Assigned Officer'];
    const rows = claims.map(c => [
      `"${c.arn}"`,
      `"${c.gstin}"`,
      `"${c.legalName}"`,
      `"${c.taxPeriod}"`,
      `"${c.category}"`,
      `"${c.filingDate}"`,
      c.amountClaimed.total,
      c.amountDisbursed,
      `"${c.status}"`,
      c.sla.daysElapsed,
      `"${c.jurisdiction.assignedOfficerName}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GST_ITC_Refund_Register_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
              Statutory Compliance • Section 54 / 56
            </span>
            <span className="text-xs text-slate-400 font-medium">• Live Government Integration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
            ITC Refund Status Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time tracking of pending input tax credit claims across GST Common Portal, ICEGATE Customs, and PFMS banking clearance.
          </p>
        </div>

        {/* Quick Top Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncPortals}
            disabled={isSyncing}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center gap-2"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin text-blue-600' : 'text-slate-500'} />
            {isSyncing ? 'Syncing...' : 'Poll Portals'}
          </button>

          <button
            onClick={() => setIsNewClaimModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            <Sparkles size={14} />
            <span>New Claim (RFD-01)</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between text-blue-900 text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-blue-700 hover:text-blue-900">
            &times;
          </button>
        </div>
      )}

      {/* Government Portal Live Connection Banner */}
      <PortalConnectionBanner
        isSyncing={isSyncing}
        onSync={handleSyncPortals}
        syncLogs={syncLogs}
        lastSyncedTime={lastSyncedTime}
        onSearchArn={handleSearchArn}
      />

      {/* Executive Key Metric Cards */}
      <RefundStatCards claims={claims} />

      {/* Main Claims List & Filter Grid */}
      <RefundClaimsList
        claims={claims}
        onSelectClaim={(claim) => setSelectedClaim(claim)}
        onOpenNewClaimModal={() => setIsNewClaimModalOpen(true)}
        onExportCsv={handleExportCsv}
      />

      {/* Claim Deep-Dive Inspector Modal */}
      {selectedClaim && (
        <RefundClaimDetailsModal
          claim={selectedClaim}
          onClose={() => setSelectedClaim(null)}
          onClaimUpdated={handleClaimUpdated}
        />
      )}

      {/* New Refund Application & Formula Estimator Modal */}
      {isNewClaimModalOpen && (
        <NewRefundEstimatorModal
          onClose={() => setIsNewClaimModalOpen(false)}
          onClaimCreated={handleClaimCreated}
        />
      )}
    </div>
  );
};

export default RefundStatusDashboard;
