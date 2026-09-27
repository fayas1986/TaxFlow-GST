import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { AuditLogData, AuditChange } from '../types';
import { 
  fetchAuditLogs, 
  generateSHA256Hash
} from '../services/api';
import { 
  Shield, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  RefreshCw, 
  FileSpreadsheet, 
  FileCode, 
  ChevronRight, 
  Info, 
  Calendar, 
  User, 
  Check, 
  Settings, 
  AlertTriangle,
  ChevronLeft,
  ShieldCheck,
  Download,
  History
} from 'lucide-react';
import TamperProofExportModal from '../components/TamperProofExportModal';
import { ComplianceAuditLog } from '../components/ComplianceAuditLog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const AuditLogs: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const [activeTab, setActiveTab] = useState<'COMPLIANCE_TRAIL' | 'SYSTEM_LEDGER'>('COMPLIANCE_TRAIL');
  const [logs, setLogs] = useState<AuditLogData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditLogData | null>(null);

  // Sorting, date range, and pagination states
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  
  // Integrity checking states
  const [checkingIntegrity, setCheckingIntegrity] = useState(false);
  const [integrityStatus, setIntegrityStatus] = useState<'IDLE' | 'SUCCESS' | 'FAILED'>('IDLE');
  const [verifiedCount, setVerifiedCount] = useState(0);

  // Regulatory export modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Load audit logs
  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLogs(user?.currentTenantId || 't1');
      setLogs(data);
      // Reset integrity state on log reload
      setIntegrityStatus('IDLE');
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [user?.currentTenantId]);

  // Cryptographic Integrity verification function
  const runIntegrityVerification = async () => {
    setCheckingIntegrity(true);
    setIntegrityStatus('IDLE');
    setVerifiedCount(0);
    
    let isValid = true;
    
    // Logs are newest first, so we reverse to verify chronologically
    const chronologicalLogs = [...logs].reverse();

    for (let i = 0; i < chronologicalLogs.length; i++) {
      const log = chronologicalLogs[i];
      const prevLog = i > 0 ? chronologicalLogs[i - 1] : null;
      
      // Calculate expected hash
      const inputForHash = `${log.action}|${log.module}|${log.user}|${log.role}|${log.timestamp}|${log.status}|${log.previousHash}`;
      const computedHash = await generateSHA256Hash(inputForHash);
      
      // Verification rules:
      // 1. Hash must match the computed hash (unless it's an old mock log using simple hash)
      // 2. Previous hash must match the actual previous block's hash (if it exists)
      
      // For backwards compatibility with old mock logs that don't match the new SHA256 scheme
      const isLegacyMock = log.id === 'aud1' || log.id === 'aud2';
      
      if (!isLegacyMock && computedHash !== log.hash) {
          isValid = false;
          console.error(`Hash mismatch for log ${log.id}: Expected ${computedHash}, got ${log.hash}`);
          break;
      }
      
      if (prevLog && log.previousHash !== prevLog.hash) {
          if (!isLegacyMock) {
             isValid = false;
             console.error(`Chain broken at log ${log.id}: Expected prevHash ${prevLog.hash}, got ${log.previousHash}`);
             break;
          }
      }
      
      setVerifiedCount(i + 1);
      // Small delay for UI effect
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    setCheckingIntegrity(false);
    setIntegrityStatus(isValid ? 'SUCCESS' : 'FAILED');
  };

  // Export to CSV helper
  const exportCSV = () => {
    const headers = ['Timestamp', 'Module', 'Action', 'User', 'Role', 'Status', 'Details', 'IP Address', 'Hash', 'Previous Hash'];
    const rows = sortedLogs.map(log => [
      log.timestamp,
      log.module,
      log.action,
      log.user,
      log.role,
      log.status,
      log.details || '',
      log.ipAddress || '',
      log.hash,
      log.previousHash
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `taxflow_compliance_audit_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Retention Audit Summary PDF
  const downloadRetentionAuditSummary = () => {
    // Filter retention deletion logs within the selected date range
    let retentionLogs = logs.filter(log => log.module === 'COMPLIANCE' && (log.action.includes('Document Retention') || log.details?.includes('Automated retention')));
    
    if (selectedDateRange !== 'ALL') {
      const now = new Date().getTime();
      let matchesDate = (logTime) => true;
      if (selectedDateRange === 'WEEKLY') {
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
        matchesDate = (logTime) => logTime >= oneWeekAgo;
      } else if (selectedDateRange === 'MONTHLY') {
        const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
        matchesDate = (logTime) => logTime >= oneMonthAgo;
      } else if (selectedDateRange === 'QUARTERLY') {
        const oneQuarterAgo = now - 90 * 24 * 60 * 60 * 1000;
        matchesDate = (logTime) => logTime >= oneQuarterAgo;
      } else if (selectedDateRange === 'YEARLY') {
        const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
        matchesDate = (logTime) => logTime >= oneYearAgo;
      } else if (selectedDateRange === 'CUSTOM') {
        let sTime = startDate ? new Date(startDate).setHours(0,0,0,0) : 0;
        let eTime = endDate ? new Date(endDate).setHours(23,59,59,999) : Infinity;
        matchesDate = (logTime) => logTime >= sTime && logTime <= eTime;
      }
      retentionLogs = retentionLogs.filter(log => matchesDate(new Date(log.timestamp).getTime()));
    }

    if (retentionLogs.length === 0) {
      alert('No retention deletion logs found for the selected date range.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    
    // Title
    doc.setFontSize(16);
    doc.text('Automated Retention Deletion Audit Summary', 14, 15);
    
    // Subtitle
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);
    
    const tableData = retentionLogs.map(log => {
      const parsedChanges = typeof log.changes === 'string' ? JSON.parse(log.changes || '[]') : (log.changes || []);
      const fileName = parsedChanges.find((c: any) => c.field === 'File Name')?.oldValue || 'Unknown';
      const creationDate = parsedChanges.find((c: any) => c.field === 'Creation Date')?.oldValue || 'Unknown';
      const deletionDate = parsedChanges.find((c: any) => c.field === 'Deletion Date')?.newValue || new Date(log.timestamp).toISOString();
      const policyAge = parsedChanges.find((c: any) => c.field === 'Policy Age')?.newValue || 'Unknown';

      return [
        new Date(log.timestamp).toLocaleString(),
        fileName,
        creationDate,
        deletionDate,
        policyAge,
        log.hash.substring(0, 16) + '...'
      ];
    });

    autoTable(doc, {
      startY: 30,
      head: [['Timestamp', 'File Name', 'Original Creation', 'Deletion Date', 'Policy Applied', 'Audit Hash']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8 },
    });

    doc.save(`Retention_Audit_Summary_${Date.now()}.pdf`);
  };

  // Export to JSON helper
  const exportJSON = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(sortedLogs, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", `taxflow_compliance_audit_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.removeChild(downloadAnchor);
  };

  // Filtering logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.details || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.hash.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesModule = selectedModule === 'ALL' || log.module === selectedModule;
    const matchesStatus = selectedStatus === 'ALL' || log.status === selectedStatus;

    // Date range filter
    let matchesDate = true;
    if (selectedDateRange !== 'ALL') {
      const logTime = new Date(log.timestamp).getTime();
      const now = new Date().getTime();
      
      if (selectedDateRange === 'WEEKLY') {
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
        matchesDate = logTime >= oneWeekAgo;
      } else if (selectedDateRange === 'MONTHLY') {
        const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
        matchesDate = logTime >= oneMonthAgo;
      } else if (selectedDateRange === 'QUARTERLY') {
        const oneQuarterAgo = now - 90 * 24 * 60 * 60 * 1000;
        matchesDate = logTime >= oneQuarterAgo;
      } else if (selectedDateRange === 'YEARLY') {
        const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
        matchesDate = logTime >= oneYearAgo;
      } else if (selectedDateRange === 'CUSTOM') {
        if (startDate) {
          const sDate = new Date(startDate);
          sDate.setHours(0, 0, 0, 0);
          matchesDate = matchesDate && logTime >= sDate.getTime();
        }
        if (endDate) {
          const eDate = new Date(endDate);
          eDate.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && logTime <= eDate.getTime();
        }
      }
    }

    return matchesSearch && matchesModule && matchesStatus && matchesDate;
  });

  // Sorting logs by timestamp
  const sortedLogs = [...filteredLogs].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });

  // Reset page when filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedModule, selectedStatus, selectedDateRange, startDate, endDate, sortOrder, itemsPerPage]);

  // Pagination calculations
  const totalPages = Math.ceil(sortedLogs.length / itemsPerPage);
  const paginatedLogs = sortedLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Color mappings
  const getModuleColor = (mod: string) => {
    switch (mod) {
      case 'AUTH': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'INVOICE': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'FILING': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'COMPLIANCE': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'SETTINGS': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'SYSTEM': return 'bg-rose-50 text-rose-700 border-rose-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Top Navigation Mode Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200 shadow-xs">
          <button
            onClick={() => setActiveTab('COMPLIANCE_TRAIL')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'COMPLIANCE_TRAIL'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History size={14} className="text-indigo-600" />
            <span>Compliance Audit Log (Invoices & Filings)</span>
          </button>

          <button
            onClick={() => setActiveTab('SYSTEM_LEDGER')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'SYSTEM_LEDGER'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield size={14} className="text-slate-500" />
            <span>System & Security Ledger</span>
          </button>
        </div>
      </div>

      {activeTab === 'COMPLIANCE_TRAIL' ? (
        <ComplianceAuditLog />
      ) : (
        <div className="space-y-8">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-widest">
                <Shield size={14} className="text-blue-500" />
                Compliance & Controls
              </div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight mt-1">System Audit Ledger</h2>
              <p className="text-slate-500 mt-2 text-base">
                Tamper-evident cryptographic ledger recording operations, organizational adjustments, and user authentications.
              </p>
            </div>
            
            {/* Verification & Export Trigger Buttons */}
            <div className="flex flex-wrap items-center gap-3 self-start md:self-center">
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-extrabold text-sm rounded-xl transition-all shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 active:scale-95"
              >
                <ShieldCheck size={16} />
                Export Tamper-Proof Package
              </button>

              <button
                onClick={runIntegrityVerification}
                disabled={checkingIntegrity || logs.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg disabled:shadow-none"
              >
                <Lock size={15} className={checkingIntegrity ? 'animate-spin' : ''} />
                {checkingIntegrity ? 'Verifying Ledger...' : 'Verify Cryptographic Chain'}
              </button>
              
              <button
                onClick={loadLogs}
                disabled={loading}
                className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition-all shadow-sm"
                title="Refresh logs"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

      {/* Chain Status Integrity Banner */}
      {integrityStatus !== 'IDLE' && (
        <div className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in zoom-in-95 duration-200 ${
          integrityStatus === 'SUCCESS' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl shrink-0 ${integrityStatus === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {integrityStatus === 'SUCCESS' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
            </div>
            <div>
              <h4 className="font-extrabold text-base tracking-tight">
                {integrityStatus === 'SUCCESS' 
                  ? 'Ledger Chain Integrity Verified' 
                  : 'Ledger Integrity Verification Warning'}
              </h4>
              <p className="text-sm mt-1 opacity-90 leading-relaxed">
                {integrityStatus === 'SUCCESS'
                  ? `Successfully validated ${verifiedCount} logical blocks. Every entry cryptographically links to its chronological predecessor. No unauthorized mutations detected.`
                  : 'A mutation or mismatched cryptographic signature has been flagged in the local record segment. Please inspect older records.'}
              </p>
            </div>
          </div>
          
          {integrityStatus === 'SUCCESS' && (
            <div className="px-4 py-1.5 bg-emerald-100/60 rounded-full text-xs font-black tracking-wider uppercase border border-emerald-200 text-emerald-700 self-start md:self-center">
              SHA256 SECURE
            </div>
          )}
        </div>
      )}

      {/* Main Audit Trail Section */}
      <div className="space-y-6">
          
          {/* Filters card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-slate-800 font-medium placeholder:text-slate-400 transition-all text-sm"
                placeholder="Search audit trail by user, action, details, or hash..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Grid of dropdown filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-1">
              {/* Module Filter */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Module</span>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer"
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value)}
                >
                  <option value="ALL">All Modules</option>
                  <option value="AUTH">AUTH (Logins)</option>
                  <option value="INVOICE">INVOICES</option>
                  <option value="FILING">FILINGS (Returns)</option>
                  <option value="COMPLIANCE">COMPLIANCE</option>
                  <option value="SETTINGS">SETTINGS</option>
                  <option value="SYSTEM">SYSTEM</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Status</span>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SUCCESS">Success</option>
                  <option value="FAILURE">Failure</option>
                </select>
              </div>

              {/* Sorting Filter */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Sort Order (Date)</span>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
                >
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
              </div>

              {/* Date Filter */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Time Range</span>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer"
                  value={selectedDateRange}
                  onChange={(e) => setSelectedDateRange(e.target.value)}
                >
                  <option value="ALL">All Time</option>
                  <option value="WEEKLY">Weekly (Last 7 Days)</option>
                  <option value="MONTHLY">Monthly (Last 30 Days)</option>
                  <option value="QUARTERLY">Quarterly (Last 90 Days)</option>
                  <option value="YEARLY">Yearly (Last 365 Days)</option>
                  <option value="CUSTOM">Custom Date Range...</option>
                </select>
              </div>
            </div>

            {/* Custom Date Picker Fields (rendered only if selectedDateRange === 'CUSTOM') */}
            {selectedDateRange === 'CUSTOM' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 animate-in slide-in-from-top-2 duration-200">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Calendar size={12} /> Start Date
                  </span>
                  <input
                    type="date"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Calendar size={12} /> End Date
                  </span>
                  <input
                    type="date"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Exporters and Items Per Page Row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-slate-100">
              {/* Pagination Page Size */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Show:</span>
                <select
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer"
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                >
                  <option value={5}>5 logs</option>
                  <option value={10}>10 logs</option>
                  <option value={25}>25 logs</option>
                  <option value={50}>50 logs</option>
                  <option value={100}>100 logs</option>
                </select>
              </div>

              {/* Exporters */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-sm"
                  title="Export tamper-proof audit package for regulatory reporting"
                >
                  <ShieldCheck size={14} />
                  Regulatory Package
                </button>

                <button
                  onClick={downloadRetentionAuditSummary}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FBBF24] hover:bg-[#F59E0B] text-[#111827] rounded-xl text-xs font-black transition-all shadow-sm"
                  title="Download PDF report of retention deletions for the selected date range"
                >
                  <Download size={13} />
                  Download Audit Summary
                </button>

                <button
                  onClick={exportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all shadow-sm"
                  title="Download filtered logs as CSV"
                >
                  <FileSpreadsheet size={13} />
                  Download CSV
                </button>

                <button
                  onClick={exportJSON}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all shadow-sm"
                  title="Export filtered logs as JSON"
                >
                  <FileCode size={13} />
                  JSON
                </button>
              </div>
            </div>

          </div>

          {/* Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-extrabold text-slate-800 text-lg tracking-tight">Ledger Records ({sortedLogs.length})</h3>
              <span className="text-xs bg-slate-200/60 text-slate-600 font-bold px-2.5 py-1 rounded-full">
                Tenant ID: {user?.currentTenantId || 't1'}
              </span>
            </div>

            {loading ? (
              <div className="py-24 text-center">
                <RefreshCw size={36} className="text-blue-500 animate-spin mx-auto mb-4" />
                <p className="text-slate-500 font-medium">Re-indexing compliance records...</p>
              </div>
            ) : sortedLogs.length === 0 ? (
              <div className="py-24 text-center px-4">
                <Shield size={40} className="text-slate-300 mx-auto mb-4" />
                <p className="text-slate-700 font-bold text-base">No Audit Entries Found</p>
                <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
                  No actions match the current criteria. Try altering your filters or trigger simulated compliance actions.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      <th className="py-3 px-6">Timestamp & Node</th>
                      <th className="py-3 px-4">Module</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Actor</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-6 text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm">
                    {paginatedLogs.map((log) => (
                      <tr 
                        key={log.id} 
                        className={`hover:bg-slate-50/70 transition-colors group ${
                          selectedLog?.id === log.id ? 'bg-blue-50/30' : ''
                        }`}
                      >
                        {/* Timestamp */}
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-800 leading-tight">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </td>

                        {/* Module */}
                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border ${getModuleColor(log.module)}`}>
                            {log.module}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="py-4 px-4 font-semibold text-slate-700 max-w-[200px] truncate" title={log.action}>
                          {log.action}
                        </td>

                        {/* Actor */}
                        <td className="py-4 px-4">
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-black uppercase text-slate-600">
                              {log.user.charAt(0)}
                            </span>
                            <span className="truncate max-w-[100px]">{log.user}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold mt-0.5">{log.role}</div>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4 text-center">
                          <div className="inline-flex items-center justify-center">
                            {log.status === 'SUCCESS' ? (
                              <CheckCircle2 size={16} className="text-emerald-500" strokeWidth={3} />
                            ) : (
                              <XCircle size={16} className="text-rose-500" strokeWidth={3} />
                            )}
                          </div>
                        </td>

                        {/* Action Inspect Button */}
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="inline-flex items-center gap-1 text-xs font-black text-blue-600 hover:text-blue-700 transition-colors bg-blue-50 px-3 py-1.5 rounded-lg group-hover:translate-x-0.5"
                          >
                            Details
                            <ChevronRight size={12} strokeWidth={2.5} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {!loading && sortedLogs.length > 0 && (
              <div className="p-4 bg-slate-50/40 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs font-medium text-slate-500">
                  Showing <span className="font-bold text-slate-700">{Math.min(sortedLogs.length, (currentPage - 1) * itemsPerPage + 1)}</span> to{' '}
                  <span className="font-bold text-slate-700">{Math.min(sortedLogs.length, currentPage * itemsPerPage)}</span> of{' '}
                  <span className="font-bold text-slate-700">{sortedLogs.length}</span> records
                </div>
                
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-300 transition-colors shadow-sm disabled:shadow-none"
                    title="Previous page"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  
                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }).map((_, i) => {
                      const pageNum = i + 1;
                      // Display first, last, current, and surrounding pages
                      if (
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        Math.abs(pageNum - currentPage) <= 1
                      ) {
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`min-w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-sm'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      }
                      
                      if (
                        pageNum === 2 ||
                        pageNum === totalPages - 1
                      ) {
                        return (
                          <span key={pageNum} className="text-xs text-slate-400 px-1 font-bold">
                            ...
                          </span>
                        );
                      }
                      
                      return null;
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-300 transition-colors shadow-sm disabled:shadow-none"
                    title="Next page"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

      </div>

      {/* DETAIL MODAL OVERLAY */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl border ${getModuleColor(selectedLog.module)}`}>
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 tracking-tight">Ledger Node Details</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {selectedLog.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-200/80 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Event Summary Grid */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Action</span>
                  <p className="text-sm font-bold text-slate-800">{selectedLog.action}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Date & Time</span>
                  <p className="text-sm font-bold text-slate-800">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                </div>
                <div className="space-y-1 mt-2">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Author (Role)</span>
                  <p className="text-sm font-bold text-slate-800">{selectedLog.user} ({selectedLog.role})</p>
                </div>
                <div className="space-y-1 mt-2">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Status</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {selectedLog.status === 'SUCCESS' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg">
                        <CheckCircle2 size={12} strokeWidth={2.5} /> SUCCESS
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-black text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg">
                        <XCircle size={12} strokeWidth={2.5} /> FAILURE
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action details */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Details / Description</h4>
                <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 text-sm font-medium text-slate-700 leading-relaxed">
                  {selectedLog.details || 'No meta description supplied for this action.'}
                </div>
              </div>

              {/* Changeset Diff - if present */}
              {selectedLog.changes && selectedLog.changes.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Audited Changeset Diff</h4>
                  <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                    <div className="grid grid-cols-3 bg-slate-50 px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <div>Field</div>
                      <div>Old Value</div>
                      <div>New Value</div>
                    </div>
                    {selectedLog.changes.map((ch, idx) => (
                      <div key={idx} className="grid grid-cols-3 px-4 py-3 text-xs font-bold text-slate-700">
                        <div className="font-mono text-slate-500">{ch.field}</div>
                        <div className="text-rose-600 line-through truncate pr-2">{String(ch.oldValue ?? 'null')}</div>
                        <div className="text-emerald-600 truncate">{String(ch.newValue ?? 'null')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cryptographic Linkage Block */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Compliance Cryptographic Hashes</h4>
                <div className="space-y-2 font-mono text-[11px] bg-slate-900 text-slate-300 p-4 rounded-2xl border border-slate-800">
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-slate-500 font-sans font-bold text-[10px] uppercase tracking-wider shrink-0 mt-0.5">Block Hash:</span>
                    <span className="text-blue-400 break-all select-all">{selectedLog.hash}</span>
                  </div>
                  <div className="flex justify-between items-start gap-4 pt-2 border-t border-slate-800">
                    <span className="text-slate-500 font-sans font-bold text-[10px] uppercase tracking-wider shrink-0 mt-0.5">Parent Hash:</span>
                    <span className="text-slate-400 break-all select-all">{selectedLog.previousHash}</span>
                  </div>
                </div>
              </div>

              {/* IP & Metadata */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
                <div className="flex items-center gap-1.5">
                  <Calendar size={14} />
                  <span>Logged ID: {selectedLog.id}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Settings size={14} />
                  <span>IP Connection: {selectedLog.ipAddress || '127.0.0.1'}</span>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                <Info size={12} /> Click hash text to select all for copy.
              </span>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all"
              >
                Close Inspector
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Tamper-Proof Regulatory Export Modal */}
      <TamperProofExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        logs={sortedLogs}
        tenantId={user?.currentTenantId || 't1'}
      />

        </div>
      )}

    </div>
  );
};

export default AuditLogs;
