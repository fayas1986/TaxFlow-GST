import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { startReconciliationJob, getReconciliationJobStatus, fetchReconData } from '../services/api';
import { 
  CheckCircle2, XCircle, AlertTriangle, HelpCircle, ArrowRightLeft, 
  ShieldAlert, RefreshCw, Filter, Download, ExternalLink, ThumbsUp, ThumbsDown,
  LayoutList, PieChart, FileText, Search, BrainCircuit, Users, Landmark, ShieldCheck, Layers,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Sparkles
} from 'lucide-react';
import { ReconItem, ReconStatus, UserRole } from '../types';
import { exportToCSV } from '../utils/export';
import { useTranslation } from '../utils/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import TemplateSelector from '../components/TemplateSelector';
import { generateStyledDocument } from '../services/documentGenerator';
import { ExportConfig } from '../types';
import CollaborationBar from '../components/CollaborationBar';
import AutoReconcileModal from '../components/AutoReconcileModal';
import Gstr2bMatchingModal from '../components/Gstr2bMatchingModal';
import Gstr2aReconciliationModule from '../components/Gstr2aReconciliationModule';
import Gstr2bVisualSummary from '../components/Gstr2bVisualSummary';
import Gstr2bReconciliationEngine from '../components/Gstr2bReconciliationEngine';
import ReconciliationAssistant from '../components/ReconciliationAssistant';
import { Socket } from 'socket.io-client';

interface ReconciliationProps {
  defaultTab?: 'GSTR2A' | 'PURCHASE' | 'SALES' | 'ASSISTANT';
}

const Reconciliation: React.FC<ReconciliationProps> = ({ defaultTab }) => {
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const { language } = useTranslation();

  const user = useSelector((state: RootState) => state.auth.user);
  const tenantId = user?.currentTenantId || 't1';
  
  // RBAC: Admin, Accountant, and Auditor can perform actions. Viewers are read-only.
  const canAction = user?.role !== UserRole.VIEWER;

  const urlTab = searchParams.get('tab')?.toLowerCase();
  const resolvedInitialTab: 'GSTR2A' | 'PURCHASE' | 'SALES' | 'ASSISTANT' = 
    urlTab === 'assistant' || defaultTab === 'ASSISTANT'
      ? 'ASSISTANT'
      : urlTab === 'gstr2a' || defaultTab === 'GSTR2A'
        ? 'GSTR2A'
        : urlTab === 'purchase' || defaultTab === 'PURCHASE'
          ? 'PURCHASE'
          : urlTab === 'sales' || defaultTab === 'SALES'
            ? 'SALES'
            : 'PURCHASE';

  const [activeTab, setActiveTab] = useState<'GSTR2A' | 'PURCHASE' | 'SALES' | 'ASSISTANT'>(resolvedInitialTab);

  // Synchronize active tab whenever URL searchParams or defaultTab prop updates
  useEffect(() => {
    const currentTabParam = searchParams.get('tab')?.toLowerCase();
    if (currentTabParam === 'assistant' || defaultTab === 'ASSISTANT') {
      setActiveTab('ASSISTANT');
    } else if (currentTabParam === 'gstr2a' || defaultTab === 'GSTR2A') {
      setActiveTab('GSTR2A');
    } else if (currentTabParam === 'purchase' || defaultTab === 'PURCHASE') {
      setActiveTab('PURCHASE');
    } else if (currentTabParam === 'sales' || defaultTab === 'SALES') {
      setActiveTab('SALES');
    }
  }, [searchParams, defaultTab]);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isAutoReconcileOpen, setIsAutoReconcileOpen] = useState(false);
  const [isGstr2bMatchingOpen, setIsGstr2bMatchingOpen] = useState(false);
  
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<{ status: string; progress: number } | null>(null);
  const [localItems, setLocalItems] = useState<ReconItem[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [jumpPageInput, setJumpPageInput] = useState<string>('');

  const subTab = activeTab === 'SALES' ? 'SALES' : 'PURCHASE';

  const handleApplyAutoReconcileResults = (updatedItems: ReconItem[]) => {
    setLocalItems(updatedItems);
    if (socket) {
      updatedItems.forEach(item => {
        socket.emit('sheet-update', {
          roomId: `recon-${subTab}-${tenantId}`,
          data: item
        });
      });
    }
  };

  const { data: initialItems, isLoading, refetch, isFetching } = useQuery({ 
    queryKey: ['reconData', subTab, tenantId], 
    queryFn: () => fetchReconData(subTab, tenantId),
    enabled: activeTab !== 'GSTR2A'
  });

  // Sync query data to local state
  useEffect(() => {
    if (initialItems) {
      setLocalItems(initialItems);
    }
  }, [initialItems]);

  const handleRemoteUpdate = useCallback((updatedItem: ReconItem) => {
    setLocalItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
  }, []);

  const emitUpdate = (item: ReconItem) => {
    if (socket) {
      socket.emit('sheet-update', {
        roomId: `recon-${subTab}-${tenantId}`,
        data: item
      });
    }
  };

  const handleAction = (itemId: string, newStatus: ReconStatus) => {
    if (!canAction) return;
    
    setLocalItems(prev => {
      const updated = prev.map(item => {
        if (item.id === itemId) {
          const newItem = { ...item, status: newStatus };
          emitUpdate(newItem);
          return newItem;
        }
        return item;
      });
      return updated;
    });
  };

  const startJob = async () => {
    const id = await startReconciliationJob(tenantId, subTab);
    setJobId(id);
    setJobStatus({ status: 'PROCESSING', progress: 0 });
  };

  // Poll for job status
  useEffect(() => {
    let interval: any;
    if (jobId && jobStatus?.status === 'PROCESSING') {
      interval = setInterval(async () => {
        const status = await getReconciliationJobStatus(jobId);
        setJobStatus(status);
        if (status.status === 'COMPLETED') {
          refetch();
          // Reset job after a delay
          setTimeout(() => {
            setJobId(null);
            setJobStatus(null);
          }, 3000);
          clearInterval(interval);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [jobId, jobStatus]);

  const getStatusConfig = (status: ReconStatus) => {
    switch(status) {
      case 'MATCHED': 
        return { color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: CheckCircle2, label: 'Matched' };
      case 'PARTIAL_MATCH':
        return { color: 'text-blue-700 bg-blue-50 border-blue-200', icon: HelpCircle, label: 'Partial' };
      case 'MISMATCH':
        return { color: 'text-red-700 bg-red-50 border-red-200', icon: XCircle, label: 'Mismatch' };
      case 'MISSING_IN_BOOKS':
        return { color: 'text-orange-700 bg-orange-50 border-orange-200', icon: AlertTriangle, label: activeTab === 'PURCHASE' ? 'Missing in Books' : 'Missing in SR' };
      case 'MISSING_IN_PORTAL':
        return { color: 'text-purple-700 bg-purple-50 border-purple-200', icon: ExternalLink, label: activeTab === 'PURCHASE' ? 'Missing in 2B' : 'Missing in GSTR-1' };
      case 'EXCESS_ITC':
        return { color: 'text-rose-800 bg-rose-100 border-rose-200', icon: ShieldAlert, label: 'Excess ITC' };
      case 'PROBABLE_MATCH':
        return { color: 'text-cyan-700 bg-cyan-50 border-cyan-200', icon: ArrowRightLeft, label: 'Probable' };
      default:
        return { color: 'text-slate-600 bg-slate-100', icon: HelpCircle, label: status };
    }
  };

  const filteredItems = useMemo(() => {
    return localItems.filter(item => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      
      if (searchQuery) {
        const lower = searchQuery.toLowerCase();
        const match = item.invoiceNumber.toLowerCase().includes(lower) || 
                      item.partyName.toLowerCase().includes(lower) || 
                      (item.gstin && item.gstin.toLowerCase().includes(lower));
        if (!match) return false;
      }
      
      if (startDate && item.date < startDate) return false;
      if (endDate && item.date > endDate) return false;
      
      const amount = Math.max(item.taxAmountBooks || 0, item.taxAmountPortal || 0);
      if (minAmount && amount < parseFloat(minAmount)) return false;
      if (maxAmount && amount > parseFloat(maxAmount)) return false;
      
      return true;
    });
  }, [localItems, statusFilter, searchQuery, startDate, endDate, minAmount, maxAmount]);

  // Reset pagination to page 1 on filter, search, or tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, startDate, endDate, minAmount, maxAmount, activeTab]);

  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startRecord = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endRecord = Math.min(safeCurrentPage * pageSize, totalItems);

  const paginatedItems = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, safeCurrentPage, pageSize]);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const delta = 1;
    const range: (number | string)[] = [];
    const left = Math.max(2, safeCurrentPage - delta);
    const right = Math.min(totalPages - 1, safeCurrentPage + delta);

    range.push(1);
    if (left > 2) range.push('...');
    for (let i = left; i <= right; i++) {
      range.push(i);
    }
    if (right < totalPages - 1) range.push('...');
    range.push(totalPages);
    return range;
  }, [totalPages, safeCurrentPage]);

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(jumpPageInput.trim(), 10);
    if (!isNaN(val) && val >= 1 && val <= totalPages) {
      setCurrentPage(val);
      setJumpPageInput('');
    }
  };
  
  const stats = useMemo(() => {
    return localItems.reduce((acc, item) => {
      if (item.status === 'MATCHED') acc.matched++;
      else if (item.status === 'MISMATCH' || item.status.includes('MISSING')) acc.mismatched++;
      if (item.difference) acc.totalDiff += item.difference;
      return acc;
    }, { matched: 0, mismatched: 0, totalDiff: 0 });
  }, [localItems]);

    const handleProfessionalExport = (config: ExportConfig) => {
    const dataToExport = filteredItems.map(item => ({
        invoiceNumber: item.invoiceNumber,
        partyName: item.partyName,
        type: item.type,
        amount: item.taxAmountBooks,
        taxAmount: item.taxAmountBooks,
        status: item.status
    }));
    generateStyledDocument({ invoices: dataToExport }, config);
    setShowTemplateSelector(false);
  };

  const handleExport = () => {
      const dataToExport = filteredItems.map(item => ({
          'Invoice Number': item.invoiceNumber,
          'Date': item.date,
          'Party Name': item.partyName,
          'GSTIN': item.gstin,
          'Tax Amount Books': item.taxAmountBooks,
          'Tax Amount Portal': item.taxAmountPortal,
          'Difference': item.difference,
          'Status': item.status
      }));
      exportToCSV(dataToExport, `TaxFlow_Recon_${activeTab}_${new Date().toISOString().split('T')[0]}`, language);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
            <AnimatePresence>
        {showTemplateSelector && (
          <TemplateSelector 
            isOpen={showTemplateSelector}
            onClose={() => setShowTemplateSelector(false)}
            onExport={handleProfessionalExport}
            category="REPORT"
            title={`Reconciliation Report - ${activeTab}`}
          />
        )}
      </AnimatePresence>

      {/* Collaboration Bar */}
      {user && activeTab !== 'GSTR2A' && (
        <CollaborationBar 
          roomId={`recon-${subTab}-${tenantId}`}
          user={{ id: user.id, name: user.name }}
          onRemoteUpdate={handleRemoteUpdate}
          onSocketReady={setSocket}
        />
      )}

      {/* Header Area */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
              TaxFlow Reconciliation Hub
            </span>
            <span className="text-xs text-slate-400">
              {activeTab === 'GSTR2A' 
                ? 'Government-Reported Inward Supplies vs Purchase Register' 
                : activeTab === 'PURCHASE' 
                  ? 'GSTR-2B Static Monthly ITC Claim' 
                  : 'GSTR-1 Outward Sales Audit'}
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 mt-1">
            {activeTab === 'GSTR2A' 
              ? 'GSTR-2A vs Purchase Register' 
              : activeTab === 'PURCHASE' 
                ? 'GSTR-2B vs Books (ITC Claim)' 
                : 'GSTR-1 vs Sales Register'}
            {isFetching && activeTab !== 'GSTR2A' && <RefreshCw size={16} className="animate-spin text-blue-500"/>}
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {activeTab === 'GSTR2A'
              ? 'Automated multi-attribute discrepancy highlighting between uploaded purchase invoices and government-reported data.'
              : activeTab === 'PURCHASE' 
                ? 'Real-time comparison between GSTR-2B static monthly statement and Purchase Register.' 
                : activeTab === 'ASSISTANT'
                  ? 'Step-by-step guided reconciliation wizard flagging mismatches between purchases & GSTR-2B.'
                  : 'Real-time comparison between GSTR-1 filed return and Sales Register.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl flex-wrap gap-1">
          <button 
            onClick={() => { setActiveTab('ASSISTANT'); setSearchParams({ tab: 'assistant' }); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'ASSISTANT' 
                ? 'bg-blue-600 shadow-xs text-white font-black' 
                : 'text-slate-600 hover:text-slate-900 bg-blue-50/50'
            }`}
          >
            <Sparkles size={14} className={activeTab === 'ASSISTANT' ? 'text-white' : 'text-blue-600'} />
            <span>Reconciliation Assistant</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
              activeTab === 'ASSISTANT' ? 'bg-white/20 text-white' : 'bg-blue-200 text-blue-900'
            }`}>
              STEP-BY-STEP
            </span>
          </button>

          <button 
            onClick={() => { setActiveTab('PURCHASE'); setSearchParams({ tab: 'purchase' }); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'PURCHASE' 
                ? 'bg-white shadow-xs text-blue-700 font-black' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <RefreshCw size={14} className={activeTab === 'PURCHASE' ? 'text-blue-600' : 'text-slate-400'} />
            <span>GSTR-2B vs Books (ITC)</span>
          </button>

          <button 
            onClick={() => { setActiveTab('GSTR2A'); setSearchParams({ tab: 'gstr2a' }); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'GSTR2A' 
                ? 'bg-white shadow-xs text-blue-700 font-black' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert size={14} className={activeTab === 'GSTR2A' ? 'text-blue-600' : 'text-slate-400'} />
            <span>GSTR-2A vs Purchase Register</span>
          </button>
          
          <button 
            onClick={() => { setActiveTab('SALES'); setSearchParams({ tab: 'sales' }); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'SALES' 
                ? 'bg-white shadow-xs text-blue-700 font-black' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowRightLeft size={14} className={activeTab === 'SALES' ? 'text-blue-600' : 'text-slate-400'} />
            <span>GSTR-1 vs Sales</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'ASSISTANT' ? (
        <ReconciliationAssistant tenantName={user?.name || 'TaxFlow Enterprise Ltd'} />
      ) : activeTab === 'GSTR2A' ? (
        <Gstr2aReconciliationModule tenantId={tenantId} />
      ) : activeTab === 'PURCHASE' ? (
        <Gstr2bReconciliationEngine tenantId={tenantId} />
      ) : (
        <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Discrepancy</p>
            <p className={`text-2xl font-bold mt-2 ${Math.abs(stats.totalDiff) > 0 ? 'text-rose-600' : 'text-green-600'}`}>
              ₹ {Math.abs(stats.totalDiff).toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1 font-medium">{stats.totalDiff > 0 ? 'Tax Shortfall in Books' : stats.totalDiff < 0 ? 'Excess Claimed in Books' : 'Perfect Match'}</p>
          </div>
          <div className="absolute top-0 right-0 p-4 opacity-5">
             <LayoutList size={64}/>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Match Rate</p>
          <div className="flex items-center gap-3 mt-2">
             <span className="text-2xl font-bold text-slate-800">{localItems.length ? Math.round((stats.matched / localItems.length)*100) : 0}%</span>
             <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                 <div className="h-full bg-green-500 rounded-full" style={{width: `${localItems.length ? Math.round((stats.matched / localItems.length)*100) : 0}%`}}></div>
             </div>
          </div>
          <p className="text-xs text-slate-400 mt-1">{stats.matched} matched invoices</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
           <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Action Required</p>
           <p className="text-2xl font-bold text-slate-800 mt-2">{stats.mismatched}</p>
           <p className="text-xs text-rose-500 mt-1 font-medium">Critical Mismatches</p>
        </div>

        <div 
          className="bg-gradient-to-br from-indigo-600 to-blue-700 p-5 rounded-2xl shadow-lg text-white relative overflow-hidden group cursor-pointer" 
          onClick={jobStatus?.status === 'PROCESSING' ? undefined : startJob}
        >
           <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-5 -mt-5 group-hover:scale-110 transition-transform"></div>
           <p className="text-xs text-indigo-100 font-bold uppercase tracking-wider relative z-10">
            {jobStatus?.status === 'PROCESSING' ? 'Processing Engine' : 'Engine Status'}
           </p>
           <div className="flex items-center gap-2 mt-3 relative z-10">
             {jobStatus?.status === 'PROCESSING' ? (
                <RefreshCw className="animate-spin" size={20}/>
             ) : jobStatus?.status === 'COMPLETED' ? (
                <CheckCircle2 size={20} className="text-emerald-300"/>
             ) : (
                <BrainCircuit size={20}/>
             )}
             <span className="font-bold">
                {jobStatus?.status === 'PROCESSING' ? `Matching... ${jobStatus.progress}%` : 
                 jobStatus?.status === 'COMPLETED' ? 'Match Complete!' : 'Run Auto-Match'}
             </span>
           </div>
           {jobStatus?.status === 'PROCESSING' ? (
             <div className="w-full bg-white/20 h-1.5 rounded-full mt-3 relative z-10 overflow-hidden">
                <div className="h-full bg-white transition-all duration-500" style={{ width: `${jobStatus.progress}%` }}></div>
             </div>
           ) : (
             <p className="text-xs text-indigo-200 mt-2 relative z-10">Click for Deep Reconciliation</p>
           )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <div className="flex items-center gap-2">
            <div className="relative">
                <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="pl-9 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none cursor-pointer shadow-sm hover:border-slate-300 transition-colors min-w-[180px]"
                >
                    <option value="ALL">All Statuses</option>
                    <option value="MATCHED">Matched</option>
                    <option value="MISMATCH">Mismatch</option>
                    <option value="MISSING_IN_PORTAL">Missing in Portal</option>
                    <option value="MISSING_IN_BOOKS">Missing in Books</option>
                    <option value="EXCESS_ITC">Excess ITC Risk</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none border-l border-slate-200 pl-2">
                    <PieChart size={14} className="text-slate-400"/>
                </div>
            </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
             <div className="relative group flex-1 sm:flex-initial">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"/>
                <input 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search invoice, vendor..." 
                    className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full sm:w-64 transition-all shadow-sm"
                />
             </div>
             
             <button 
                onClick={() => setIsGstr2bMatchingOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-all shadow-md active:scale-95"
                title="Execute automated statutory matching for GSTR-2B vs Purchase Register"
              >
                <Layers size={16} className="text-indigo-400" /> GSTR-2B Match Engine
              </button>

              <button 
                onClick={() => setIsAutoReconcileOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
              >
                <Landmark size={16} /> Auto-Reconcile Bank
              </button>

              <button 
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} 
                className={`flex items-center justify-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-semibold transition-all shadow-sm ${showAdvancedFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
              >
                <Filter size={16} className={showAdvancedFilters ? 'text-indigo-600' : 'text-slate-500'}/> Filters
                {(startDate || endDate || minAmount || maxAmount) && (
                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></span>
                )}
              </button>

            <button 
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                onClick={handleExport}
            >
                <Download size={16} className="text-blue-600"/> Export Report
            </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <AnimatePresence>
        {showAdvancedFilters && (
            <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
            >
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl grid grid-cols-1 md:grid-cols-4 gap-6 relative">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date From</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-lg text-sm outline-none focus:border-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date To</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-lg text-sm outline-none focus:border-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Min Tax Amount</label>
                        <input type="number" placeholder="0" value={minAmount} onChange={e => setMinAmount(e.target.value)} className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-lg text-sm outline-none focus:border-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Max Tax Amount</label>
                        <div className="relative">
                            <input type="number" placeholder="Any" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-lg text-sm outline-none focus:border-blue-500" />
                            {(startDate || endDate || minAmount || maxAmount) && (
                                <button 
                                    onClick={() => { setStartDate(''); setEndDate(''); setMinAmount(''); setMaxAmount(''); }} 
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-600 hover:text-red-500 transition-colors"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Main Data Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
             <div className="p-20 text-center flex flex-col items-center justify-center text-slate-500">
                 <RefreshCw className="animate-spin text-blue-500 mb-4" size={32}/>
                 <p className="font-medium">Running reconciliation engine...</p>
                 <p className="text-xs mt-2">Comparing 1000+ line items</p>
             </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Invoice Details</th>
                <th className="px-6 py-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">{(activeTab as string) === 'PURCHASE' ? 'Vendor' : 'Customer'}</th>
                <th className="px-6 py-4 font-semibold text-slate-600 text-right text-xs uppercase tracking-wider">
                    {(activeTab as string) === 'PURCHASE' ? 'Books (PR)' : 'Books (SR)'}
                </th>
                <th className="px-6 py-4 font-semibold text-slate-600 text-right text-xs uppercase tracking-wider">
                    {(activeTab as string) === 'PURCHASE' ? 'Portal (2B)' : 'Portal (GSTR1)'}
                </th>
                <th className="px-6 py-4 font-semibold text-slate-600 text-right text-xs uppercase tracking-wider">Diff</th>
                <th className="px-6 py-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 font-semibold text-slate-600 text-xs uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems?.length === 0 && (
                  <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400 bg-slate-50/30">
                          <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                              <Search size={20}/>
                          </div>
                          <p>No records found matching filters.</p>
                      </td>
                  </tr>
              )}
              {paginatedItems.map((item) => {
                const statusConfig = getStatusConfig(item.status);
                const Icon = statusConfig.icon;
                
                return (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">INV</div>
                          <div>
                              {item.invoiceNumber}
                              <div className="text-[11px] text-slate-400 font-mono font-normal mt-0.5">{item.date}</div>
                          </div>
                      </div>
                  </td>
                  <td className="px-6 py-4">
                      <div className="text-slate-800 font-medium truncate max-w-[150px]" title={item.partyName}>{item.partyName}</div>
                      <div className="text-[11px] text-slate-400 font-mono bg-slate-50 inline-block px-1 rounded border border-slate-100 mt-1">{item.gstin}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-700 text-right font-mono font-medium">
                      {item.taxAmountBooks > 0 ? `₹${item.taxAmountBooks.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-6 py-4 text-slate-700 text-right font-mono font-medium">
                      {item.taxAmountPortal > 0 ? `₹${item.taxAmountPortal.toLocaleString()}` : '-'}
                  </td>
                  <td className={`px-6 py-4 text-right font-mono font-bold ${
                    Math.abs(item.difference) > 0 ? 'text-red-600 bg-red-50 rounded px-2' : 'text-slate-300'
                  }`}>
                    {Math.abs(item.difference) > 0 ? `₹${item.difference.toFixed(2)}` : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${statusConfig.color}`}>
                        <Icon size={12} className="shrink-0" strokeWidth={3}/> {statusConfig.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {canAction && item.status !== 'MATCHED' ? (
                        <div className="flex justify-end items-center gap-2">
                             <button 
                                onClick={() => handleAction(item.id, 'MATCHED')}
                                className="p-1.5 text-green-600 bg-green-50 border border-green-200 hover:bg-green-100 rounded-lg transition-colors" 
                                title="Accept"
                             >
                                <ThumbsUp size={14}/>
                             </button>
                             <button 
                                onClick={() => handleAction(item.id, 'MISMATCH')}
                                className="p-1.5 text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg transition-colors" 
                                title="Dispute"
                             >
                                <ThumbsDown size={14}/>
                             </button>
                        </div>
                    ) : item.status === 'MATCHED' ? (
                        <span className="text-emerald-500"><CheckCircle2 size={18} className="ml-auto opacity-50"/></span>
                    ) : null}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
        )}

        {/* Table Pagination Bar */}
        {!isLoading && totalItems > 0 && (
          <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-200 flex flex-col lg:flex-row items-center justify-between gap-4 text-xs text-slate-500 select-none">
            {/* Left: Rows Per Page & Record Range */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-600">Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs cursor-pointer hover:border-slate-300 transition-colors"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="h-4 w-px bg-slate-200 hidden sm:block" />

              <span className="font-medium text-slate-600">
                Showing <strong className="text-slate-900 font-mono font-bold">{startRecord}</strong> to{' '}
                <strong className="text-slate-900 font-mono font-bold">{endRecord}</strong> of{' '}
                <strong className="text-slate-900 font-mono font-bold">{totalItems}</strong> invoices
              </span>
            </div>

            {/* Right: Navigation Controls & Quick Jump */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Pagination Page Buttons */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage <= 1}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="First Page"
                >
                  <ChevronsLeft size={15} />
                </button>
                <button
                  onClick={() => setCurrentPage(safeCurrentPage - 1)}
                  disabled={safeCurrentPage <= 1}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft size={15} />
                </button>

                {/* Page Number Pills */}
                <div className="flex items-center gap-1 px-1">
                  {pageNumbers.map((pageNum, idx) => {
                    if (pageNum === '...') {
                      return (
                        <span key={`ellipsis-${idx}`} className="px-1.5 text-slate-400 font-bold">
                          …
                        </span>
                      );
                    }
                    const isCurrent = pageNum === safeCurrentPage;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum as number)}
                        className={`min-w-[28px] h-7 px-2 text-xs font-mono font-bold rounded-lg transition-all ${
                          isCurrent
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(safeCurrentPage + 1)}
                  disabled={safeCurrentPage >= totalPages}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Next Page"
                >
                  <ChevronRight size={15} />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safeCurrentPage >= totalPages}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Last Page"
                >
                  <ChevronsRight size={15} />
                </button>
              </div>

              {/* Direct Page Jump Input */}
              {totalPages > 1 && (
                <form onSubmit={handleJumpSubmit} className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                  <span className="text-xs text-slate-400 font-medium">Go to:</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    placeholder={`${safeCurrentPage}`}
                    value={jumpPageInput}
                    onChange={(e) => setJumpPageInput(e.target.value)}
                    className="w-12 h-7 px-1.5 text-center bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
                  />
                  <button
                    type="submit"
                    disabled={!jumpPageInput.trim()}
                    className="h-7 px-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs transition-colors"
                  >
                    Go
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {/* Auto-Reconcile Modal */}
      <AutoReconcileModal
        isOpen={isAutoReconcileOpen}
        onClose={() => setIsAutoReconcileOpen(false)}
        reconItems={localItems}
        activeTab={subTab}
        onApplyResults={handleApplyAutoReconcileResults}
      />

      {/* GSTR-2B vs Purchase Register Automated Matching Service Modal */}
      <Gstr2bMatchingModal
        isOpen={isGstr2bMatchingOpen}
        onClose={() => setIsGstr2bMatchingOpen(false)}
        tenantId={tenantId}
      />
    </div>
  );
};


export default Reconciliation;