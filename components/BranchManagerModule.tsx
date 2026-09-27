import React, { useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Building2, 
  MapPin, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Filter, 
  Layers, 
  FileText, 
  ArrowRight, 
  ChevronRight, 
  DollarSign, 
  PieChart, 
  Sliders, 
  Check, 
  X, 
  Lock, 
  ArrowUpRight, 
  Briefcase, 
  ShieldCheck, 
  Send, 
  RefreshCw, 
  Tag, 
  UserCheck, 
  Calendar,
  Building,
  Sparkles,
  Info,
  Landmark
} from 'lucide-react';
import { RootState, setSelectedBranch, addBranch, deleteBranch, setBranchesForTenant } from '../store/store';
import { BranchDetailsItem, Invoice, FilingRecord, UserRole } from '../types';
import { fetchInvoices, updateInvoice, fetchFilingHistory } from '../services/api';
import { subscriptionManager } from '../src/core/billing/SubscriptionManager';
import { PlanCode } from '../src/core/entitlements/types';
import BranchReconciliationTool from './BranchReconciliationTool';

export interface BranchManagerModuleProps {
  tenantId?: string;
  onClose?: () => void;
  isModal?: boolean;
  initialTab?: 'BRANCHES' | 'INVOICES' | 'FILINGS' | 'ANALYTICS' | 'RECONCILIATION';
}

export const BranchManagerModule: React.FC<BranchManagerModuleProps> = ({
  tenantId: propTenantId,
  onClose,
  isModal = false,
  initialTab = 'BRANCHES'
}) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const user = useSelector((state: RootState) => state.auth.user);
  const tenantId = propTenantId || user?.currentTenantId || 't1';
  const selectedBranchId = useSelector((state: RootState) => state.org.selectedBranchId);
  const branchesByTenant = useSelector((state: RootState) => state.org.branchesByTenant);
  const gstinsByTenant = useSelector((state: RootState) => state.org.gstinsByTenant);

  const branches = useMemo(() => branchesByTenant[tenantId] || [], [branchesByTenant, tenantId]);
  const gstins = useMemo(() => gstinsByTenant[tenantId] || [], [gstinsByTenant, tenantId]);

  // Plan Entitlements & Starter Mode
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  const subProfile = subscriptionManager.getUserSubscriptionProfile(user?.role, tenantId);
  const canMultiBranch = isSuperAdmin || Boolean(subProfile.canMultiBranch);
  const isStarterPlan = !isSuperAdmin && (!canMultiBranch || subProfile.planCode === PlanCode.STARTER || subProfile.maxBranches <= 1);

  // Queries for Invoices and Filings
  const { data: invoices = [], isLoading: isLoadingInvoices } = useQuery({
    queryKey: ['invoices', tenantId],
    queryFn: () => fetchInvoices(tenantId, 'ALL', 'ALL')
  });

  const { data: filings = [], isLoading: isLoadingFilings } = useQuery({
    queryKey: ['filings', tenantId],
    queryFn: () => fetchFilingHistory(tenantId)
  });

  // State
  const [activeTab, setActiveTab] = useState<'BRANCHES' | 'INVOICES' | 'FILINGS' | 'ANALYTICS' | 'RECONCILIATION'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranchId, setFilterBranchId] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Branch Modal Form State
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchDetailsItem | null>(null);
  const [branchFormData, setBranchFormData] = useState({
    name: '',
    code: '',
    type: 'HEAD_OFFICE' as BranchDetailsItem['type'],
    address: '',
    stateCode: '27',
    stateName: 'Maharashtra',
    gstin: gstins[0]?.gstin || '27ABCDE1234F1Z5',
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    annualTurnoverContributionPct: 25,
    costCenterCode: '',
    costCenterName: '',
    description: '',
    budgetAllocation: 50000000
  });

  // Batch Reallocation Modal State
  const [isBatchReallocateOpen, setIsBatchReallocateOpen] = useState(false);
  const [targetBatchBranchId, setTargetBatchBranchId] = useState<string>(branches[0]?.id || '');
  const [isReallocating, setIsReallocating] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Compute enriched branch list with live invoice and filing counts
  const enrichedBranches = useMemo(() => {
    return branches.map(b => {
      const branchInvoices = invoices.filter(i => i.branchId === b.id || (!i.branchId && b.type === 'HEAD_OFFICE'));
      const branchFilings = filings.filter(f => f.branchId === b.id || (!f.branchId && b.type === 'HEAD_OFFICE'));
      const turnoverSum = branchInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      const taxSum = branchInvoices.reduce((sum, inv) => sum + (inv.taxAmount || 0), 0);

      return {
        ...b,
        activeInvoicesCount: branchInvoices.length,
        activeFilingsCount: branchFilings.length,
        taxableTurnoverSum: turnoverSum,
        taxSum: taxSum
      };
    });
  }, [branches, invoices, filings]);

  // If Starter plan, restrict view to only the single primary/default branch
  const displayedBranches = useMemo(() => {
    if (isStarterPlan) {
      // Return primary branch or first registered branch only
      const primary = enrichedBranches.find(b => b.type === 'HEAD_OFFICE') || enrichedBranches[0];
      return primary ? [primary] : [];
    }
    return enrichedBranches.filter(b => {
      const matchSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.costCenterCode && b.costCenterCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        b.stateName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = filterType === 'ALL' || b.type === filterType;
      return matchSearch && matchType;
    });
  }, [enrichedBranches, isStarterPlan, searchQuery, filterType]);

  // Filtered invoices for the association tab
  const displayedInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (isStarterPlan) {
        // Starter accounts only see invoices for their primary branch/registered GSTIN
        const primaryBranch = displayedBranches[0];
        if (!primaryBranch) return true;
        return inv.branchId === primaryBranch.id || !inv.branchId;
      }

      const matchBranch = filterBranchId === 'ALL' || 
        inv.branchId === filterBranchId || 
        (!inv.branchId && filterBranchId === branches.find(b => b.type === 'HEAD_OFFICE')?.id);

      const matchSearch = inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.costCenter && inv.costCenter.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchBranch && matchSearch;
    });
  }, [invoices, isStarterPlan, displayedBranches, filterBranchId, branches, searchQuery]);

  // Filtered filings for the association tab
  const displayedFilings = useMemo(() => {
    return filings.filter(f => {
      if (isStarterPlan) {
        const primaryBranch = displayedBranches[0];
        if (!primaryBranch) return true;
        return f.branchId === primaryBranch.id || !f.branchId;
      }

      const matchBranch = filterBranchId === 'ALL' || 
        f.branchId === filterBranchId || 
        (!f.branchId && filterBranchId === branches.find(b => b.type === 'HEAD_OFFICE')?.id);

      const matchSearch = f.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.period.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.costCenter && f.costCenter.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchBranch && matchSearch;
    });
  }, [filings, isStarterPlan, displayedBranches, filterBranchId, branches, searchQuery]);

  // Open Create/Edit Modal
  const handleOpenCreateModal = () => {
    setEditingBranch(null);
    setBranchFormData({
      name: '',
      code: `BR-${branches.length + 1}`,
      type: 'REGIONAL_OFFICE',
      address: '',
      stateCode: gstins[0]?.stateCode || '27',
      stateName: gstins[0]?.stateName || 'Maharashtra',
      gstin: gstins[0]?.gstin || '',
      contactPerson: '',
      contactEmail: '',
      contactPhone: '',
      status: 'ACTIVE',
      annualTurnoverContributionPct: 15,
      costCenterCode: `CC-DIV-${100 + branches.length + 1}`,
      costCenterName: 'Regional Business Division',
      description: '',
      budgetAllocation: 25000000
    });
    setIsBranchModalOpen(true);
  };

  const handleOpenEditModal = (branch: BranchDetailsItem) => {
    setEditingBranch(branch);
    setBranchFormData({
      name: branch.name,
      code: branch.code,
      type: branch.type,
      address: branch.address,
      stateCode: branch.stateCode,
      stateName: branch.stateName,
      gstin: branch.gstin,
      contactPerson: branch.contactPerson,
      contactEmail: branch.contactEmail,
      contactPhone: branch.contactPhone,
      status: branch.status,
      annualTurnoverContributionPct: branch.annualTurnoverContributionPct,
      costCenterCode: branch.costCenterCode || '',
      costCenterName: branch.costCenterName || '',
      description: branch.description || '',
      budgetAllocation: branch.budgetAllocation || 25000000
    });
    setIsBranchModalOpen(true);
  };

  // Save Branch Handler
  const handleSaveBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchFormData.name.trim() || !branchFormData.code.trim()) {
      alert('Please fill in required fields (Branch Name and Code).');
      return;
    }

    if (editingBranch) {
      // Update existing branch
      const updated = branches.map(b => b.id === editingBranch.id ? { ...b, ...branchFormData } : b);
      dispatch(setBranchesForTenant({ tenantId, branches: updated }));
      showToast(`Branch "${branchFormData.name}" updated successfully!`);
    } else {
      // Create new branch
      const newBranch: BranchDetailsItem = {
        id: `b-${Date.now()}`,
        ...branchFormData
      };
      dispatch(addBranch({ tenantId, branch: newBranch }));
      showToast(`Branch "${newBranch.name}" created successfully!`);
    }

    setIsBranchModalOpen(false);
  };

  // Delete Branch Handler
  const handleDeleteBranch = (branchId: string, branchName: string) => {
    if (branches.length <= 1) {
      alert('An organization must retain at least one registered office branch.');
      return;
    }
    if (!confirm(`Are you sure you want to remove branch "${branchName}"? Invoices linked to this branch will default to the Head Office.`)) {
      return;
    }
    dispatch(deleteBranch({ tenantId, branchId }));
    showToast(`Branch "${branchName}" removed.`);
  };

  // Single Invoice Branch Re-allocation
  const handleAssignInvoiceBranch = async (invoiceId: string, newBranchId: string) => {
    const targetBranch = branches.find(b => b.id === newBranchId);
    if (!targetBranch) return;

    try {
      await updateInvoice(invoiceId, {
        branchId: targetBranch.id,
        branchName: targetBranch.name,
        costCenter: targetBranch.costCenterCode || targetBranch.code
      }, `Branch Re-allocation: Assigned to ${targetBranch.name} (${targetBranch.costCenterCode || targetBranch.code})`);

      queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      showToast(`Invoice associated with ${targetBranch.name} (${targetBranch.costCenterCode || targetBranch.code})`);
    } catch (err: any) {
      alert(err.message || 'Failed to re-allocate invoice branch.');
    }
  };

  // Batch Invoice Branch Re-allocation
  const handleBatchReallocateInvoices = async () => {
    if (selectedInvoiceIds.size === 0) return;
    const targetBranch = branches.find(b => b.id === targetBatchBranchId);
    if (!targetBranch) return;

    setIsReallocating(true);
    try {
      const ids = Array.from(selectedInvoiceIds);
      for (const id of ids) {
        await updateInvoice(id, {
          branchId: targetBranch.id,
          branchName: targetBranch.name,
          costCenter: targetBranch.costCenterCode || targetBranch.code
        }, `Batch Re-allocation: Assigned to ${targetBranch.name}`);
      }

      queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      showToast(`Successfully re-allocated ${ids.length} invoices to ${targetBranch.name}!`);
      setSelectedInvoiceIds(new Set());
      setIsBatchReallocateOpen(false);
    } catch (err: any) {
      alert('Failed during batch re-allocation.');
    } finally {
      setIsReallocating(false);
    }
  };

  const toggleSelectInvoice = (id: string) => {
    const next = new Set(selectedInvoiceIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedInvoiceIds(next);
  };

  const toggleSelectAllInvoices = () => {
    if (selectedInvoiceIds.size === displayedInvoices.length) {
      setSelectedInvoiceIds(new Set());
    } else {
      setSelectedInvoiceIds(new Set(displayedInvoices.map(i => i.id)));
    }
  };

  return (
    <div className={`space-y-6 ${isModal ? 'p-2' : ''}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[120] animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="bg-slate-900 text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span className="text-xs font-bold text-slate-100">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 rounded-2xl shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1">
              <MapPin size={11} /> {isStarterPlan ? 'Single Branch Entity' : 'Multi-Branch Cost Centers'}
            </span>
            {isStarterPlan && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                Starter Plan
              </span>
            )}
          </div>
          <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            <Building2 size={24} className="text-blue-400" />
            {isStarterPlan ? 'Branch Details & Assigned Records' : 'Branch & Cost Center Manager'}
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            {isStarterPlan
              ? 'View invoices and statutory filings associated with your primary registered business branch and place of supply.'
              : 'Allocate invoices, purchase registers, and GST filings across different organizational branches and cost centers for segregated compliance.'}
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3 shrink-0">
          {!isStarterPlan && canMultiBranch && (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-blue-600/30 active:scale-95 cursor-pointer"
            >
              <Plus size={15} />
              <span>Add New Branch</span>
            </button>
          )}

          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs (Cleaned for Starter Plan) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('BRANCHES')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'BRANCHES'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Building2 size={14} />
            <span>{isStarterPlan ? 'Branch Profile' : 'Branches & Cost Centers'}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-700">
              {displayedBranches.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('INVOICES')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'INVOICES'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <FileText size={14} />
            <span>Associated Invoices</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-700">
              {displayedInvoices.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('FILINGS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'FILINGS'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Calendar size={14} />
            <span>GST Returns & Filings</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-700">
              {displayedFilings.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('RECONCILIATION')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'RECONCILIATION'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Landmark size={14} />
            <span>Branch Reconciliation</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
              BANK MATCH
            </span>
          </button>

          {!isStarterPlan && (
            <button
              onClick={() => setActiveTab('ANALYTICS')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ANALYTICS'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <PieChart size={14} />
              <span>Financial Turnover Rollup</span>
            </button>
          )}
        </div>

        {/* Global search & branch switcher filter for multi-branch */}
        {!isStarterPlan && activeTab !== 'BRANCHES' && (
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by invoice, party, or code..."
                className="h-9 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 w-64"
              />
            </div>

            <select
              value={filterBranchId}
              onChange={(e) => setFilterBranchId(e.target.value)}
              className="h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">All Branches & Cost Centers</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.costCenterCode || b.code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: BRANCHES & COST CENTERS LIST */}
      {activeTab === 'BRANCHES' && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2">
              <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
                <span>{isStarterPlan ? 'Operating Branch' : 'Active Branches'}</span>
                <Building2 size={16} className="text-blue-500" />
              </div>
              <div className="text-2xl font-black text-slate-900">{displayedBranches.length}</div>
              <p className="text-[11px] text-slate-500">
                {isStarterPlan ? 'Registered Primary Head Office' : `${branches.filter(b => b.status === 'ACTIVE').length} operational units`}
              </p>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2">
              <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
                <span>Associated Invoices</span>
                <FileText size={16} className="text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {invoices.length.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-500">
                {isStarterPlan ? 'Mapped to primary branch ledger' : 'Distributed across cost centers'}
              </p>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2">
              <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
                <span>GST Returns Mapped</span>
                <Calendar size={16} className="text-indigo-500" />
              </div>
              <div className="text-2xl font-black text-slate-900">{filings.length}</div>
              <p className="text-[11px] text-slate-500">Monthly & Annual Return periods</p>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2">
              <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
                <span>Primary GSTIN Registration</span>
                <ShieldCheck size={16} className="text-amber-500" />
              </div>
              <div className="text-xs font-mono font-black text-slate-800 truncate">
                {displayedBranches[0]?.gstin || gstins[0]?.gstin || '27ABCDE1234F1Z5'}
              </div>
              <p className="text-[11px] text-slate-500">State: {displayedBranches[0]?.stateName || 'Maharashtra (27)'}</p>
            </div>
          </div>

          {/* Branch Grid Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {displayedBranches.map(branch => (
              <div 
                key={branch.id} 
                className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-sm text-slate-900">{branch.name}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                          branch.type === 'HEAD_OFFICE' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                          branch.type === 'SEZ_UNIT' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                          branch.type === 'FACTORY' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {branch.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="font-mono font-bold text-slate-600">Code: {branch.code}</span>
                        <span>•</span>
                        <span>{branch.stateName} ({branch.stateCode})</span>
                      </div>
                    </div>
                  </div>

                  {!isStarterPlan && canMultiBranch && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(branch)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Edit Branch & Cost Center"
                      >
                        <Edit3 size={15} />
                      </button>
                      {branch.type !== 'HEAD_OFFICE' && (
                        <button
                          onClick={() => handleDeleteBranch(branch.id, branch.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove Branch"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Cost Center & Details Bar */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-bold flex items-center gap-1.5">
                      <Tag size={12} className="text-indigo-500" /> Cost Center ID:
                    </span>
                    <span className="font-mono font-extrabold text-indigo-950 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      {branch.costCenterCode || `CC-${branch.code}`}
                    </span>
                  </div>

                  {branch.costCenterName && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Department Division:</span>
                      <span className="font-bold text-slate-700">{branch.costCenterName}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Assigned GSTIN:</span>
                    <span className="font-mono font-bold text-slate-800">{branch.gstin}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Address:</span>
                    <span className="text-slate-600 truncate max-w-[240px]" title={branch.address}>
                      {branch.address}
                    </span>
                  </div>
                </div>

                {/* Associated Records Counters */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Attached Invoices</div>
                      <div className="text-sm font-extrabold text-slate-800">
                        {branch.activeInvoicesCount || 0} Records
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setFilterBranchId(branch.id);
                        setActiveTab('INVOICES');
                      }}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>View</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Return Filings</div>
                      <div className="text-sm font-extrabold text-slate-800">
                        {branch.activeFilingsCount || 0} Periods
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setFilterBranchId(branch.id);
                        setActiveTab('FILINGS');
                      }}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>View</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>

                {/* Branch Bank Reconciliation Action */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                    <Landmark size={12} className="text-slate-400" />
                    Bank Statement Auto-Match
                  </span>
                  <button
                    onClick={() => {
                      setFilterBranchId(branch.id);
                      dispatch(setSelectedBranch(branch.id));
                      setActiveTab('RECONCILIATION');
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>Reconcile Branch</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: INVOICE ASSOCIATION & RE-ALLOCATION */}
      {activeTab === 'INVOICES' && (
        <div className="space-y-4">
          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2">
              {!isStarterPlan && (
                <button
                  onClick={toggleSelectAllInvoices}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                >
                  {selectedInvoiceIds.size === displayedInvoices.length && displayedInvoices.length > 0 ? 'Deselect All' : 'Select All'}
                </button>
              )}
              <span className="text-xs text-slate-500">
                Showing <strong className="text-slate-800">{displayedInvoices.length}</strong> associated invoices
              </span>
            </div>

            {!isStarterPlan && selectedInvoiceIds.size > 0 && (
              <div className="flex items-center gap-2 animate-in fade-in">
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                  {selectedInvoiceIds.size} selected
                </span>
                <button
                  onClick={() => setIsBatchReallocateOpen(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Sliders size={13} />
                  <span>Re-allocate to Branch</span>
                </button>
              </div>
            )}
          </div>

          {/* Invoices Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    {!isStarterPlan && <th className="p-3.5 w-10"></th>}
                    <th className="p-3.5">Invoice #</th>
                    <th className="p-3.5">Counterparty</th>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5 text-right">Taxable Value</th>
                    <th className="p-3.5 text-right">Tax Amount</th>
                    <th className="p-3.5">Assigned Branch</th>
                    <th className="p-3.5">Cost Center</th>
                    {!isStarterPlan && <th className="p-3.5 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center p-12 text-slate-500">
                        No invoices match the selected branch criteria.
                      </td>
                    </tr>
                  ) : (
                    displayedInvoices.map(inv => {
                      const isSelected = selectedInvoiceIds.has(inv.id);
                      const invBranch = branches.find(b => b.id === inv.branchId) || branches[0];

                      return (
                        <tr key={inv.id} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                          {!isStarterPlan && (
                            <td className="p-3.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectInvoice(inv.id)}
                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                              />
                            </td>
                          )}
                          <td className="p-3.5 font-mono font-bold text-slate-900">
                            {inv.invoiceNumber}
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-800">{inv.partyName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{inv.gstin || 'B2C / Unregistered'}</div>
                          </td>
                          <td className="p-3.5 text-slate-600 whitespace-nowrap">
                            {inv.date}
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                            ₹{inv.amount.toLocaleString()}
                          </td>
                          <td className="p-3.5 text-right font-mono font-semibold text-blue-600">
                            ₹{inv.taxAmount.toLocaleString()}
                          </td>
                          <td className="p-3.5">
                            <span className="font-bold text-slate-800 flex items-center gap-1">
                              <Building2 size={13} className="text-slate-400" />
                              {inv.branchName || invBranch?.name || 'Mumbai HQ Office'}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className="font-mono font-bold text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                              {inv.costCenter || invBranch?.costCenterCode || 'CC-MUM-101'}
                            </span>
                          </td>
                          {!isStarterPlan && (
                            <td className="p-3.5 text-right">
                              <select
                                value={inv.branchId || branches[0]?.id}
                                onChange={(e) => handleAssignInvoiceBranch(inv.id, e.target.value)}
                                className="h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
                              >
                                {branches.map(b => (
                                  <option key={b.id} value={b.id}>
                                    {b.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GST FILING ASSOCIATION */}
      {activeTab === 'FILINGS' && (
        <div className="space-y-4">
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Statutory Return Mappings</h4>
              <p className="text-xs text-slate-500">
                GST returns are attributed to state branch jurisdictions and cost centers for jurisdictional filing compliance.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
              {displayedFilings.length} Filings
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedFilings.map(filing => {
              const filingBranch = branches.find(b => b.id === filing.branchId) || branches[0];

              return (
                <div key={filing.id} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg font-black text-xs bg-blue-50 text-blue-700 border border-blue-100">
                      {filing.type}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      filing.status === 'FILED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      filing.status === 'OVERDUE' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {filing.status}
                    </span>
                  </div>

                  <div>
                    <h5 className="font-extrabold text-sm text-slate-900">{filing.period}</h5>
                    <p className="text-xs text-slate-500">Financial Year: {filing.fy}</p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Due Date:</span>
                      <span className="font-bold text-slate-700">{filing.dueDate}</span>
                    </div>
                    {filing.taxLiability && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Tax Liability:</span>
                        <span className="font-mono font-bold text-slate-900">₹{filing.taxLiability.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-t border-slate-200/60 pt-1.5">
                      <span className="text-slate-500">Branch Attribution:</span>
                      <span className="font-bold text-indigo-900">{filing.branchName || filingBranch?.name || 'Mumbai HQ'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Cost Center:</span>
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded">
                        {filing.costCenter || filingBranch?.costCenterCode || 'CC-MUM-101'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: FINANCIAL TURNOVER ROLLUP (Only for multi-branch) */}
      {!isStarterPlan && activeTab === 'ANALYTICS' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <PieChart size={16} className="text-indigo-600" />
              Branch & Cost Center Financial Contributions
            </h3>

            <div className="space-y-4">
              {displayedBranches.map(branch => {
                const pct = branch.annualTurnoverContributionPct || 20;
                return (
                  <div key={branch.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-slate-900">{branch.name}</span>
                        <span className="text-slate-400 font-mono ml-2">({branch.costCenterCode || branch.code})</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-black text-slate-800">
                          ₹{((branch as any).taxableTurnoverSum || 0).toLocaleString()} Taxable
                        </span>
                        <span className="text-slate-400 ml-2 font-bold">({pct}% target)</span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: BRANCH BANK RECONCILIATION */}
      {activeTab === 'RECONCILIATION' && (
        <div className="space-y-4">
          <BranchReconciliationTool 
            initialBranchId={filterBranchId !== 'ALL' ? filterBranchId : (selectedBranchId !== 'ALL' ? selectedBranchId : undefined)}
          />
        </div>
      )}

      {/* Add / Edit Branch Modal */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Building2 size={18} className="text-blue-600" />
                {editingBranch ? 'Edit Branch & Cost Center' : 'Register New Organizational Branch'}
              </h3>
              <button
                onClick={() => setIsBranchModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBranch} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Branch Name *</label>
                  <input
                    required
                    value={branchFormData.name}
                    onChange={(e) => setBranchFormData({ ...branchFormData, name: e.target.value })}
                    placeholder="e.g. Hyderabad Regional Office"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Branch Code *</label>
                  <input
                    required
                    value={branchFormData.code}
                    onChange={(e) => setBranchFormData({ ...branchFormData, code: e.target.value })}
                    placeholder="e.g. TS-HYD-05"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Cost Center Code</label>
                  <input
                    value={branchFormData.costCenterCode}
                    onChange={(e) => setBranchFormData({ ...branchFormData, costCenterCode: e.target.value })}
                    placeholder="e.g. CC-HYD-105"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Cost Center Division</label>
                  <input
                    value={branchFormData.costCenterName}
                    onChange={(e) => setBranchFormData({ ...branchFormData, costCenterName: e.target.value })}
                    placeholder="e.g. South Tech Development"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Branch Unit Type</label>
                  <select
                    value={branchFormData.type}
                    onChange={(e) => setBranchFormData({ ...branchFormData, type: e.target.value as any })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="HEAD_OFFICE">Head Office</option>
                    <option value="REGIONAL_OFFICE">Regional Office</option>
                    <option value="FACTORY">Factory / Manufacturing</option>
                    <option value="WAREHOUSE">Warehouse / Depot</option>
                    <option value="SEZ_UNIT">SEZ Export Unit</option>
                    <option value="RETAIL_STORE">Retail Store</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Linked GSTIN</label>
                  <select
                    value={branchFormData.gstin}
                    onChange={(e) => setBranchFormData({ ...branchFormData, gstin: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {gstins.map(g => (
                      <option key={g.id} value={g.gstin}>
                        {g.gstin} ({g.stateName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Physical Address</label>
                <textarea
                  rows={2}
                  value={branchFormData.address}
                  onChange={(e) => setBranchFormData({ ...branchFormData, address: e.target.value })}
                  placeholder="e.g. Hitec City Phase 2, Madhapur, Hyderabad, TS"
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBranchModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer"
                >
                  {editingBranch ? 'Save Changes' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Reallocation Modal */}
      {isBatchReallocateOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Sliders size={18} className="text-blue-600" />
              Batch Re-allocate {selectedInvoiceIds.size} Invoices
            </h3>
            <p className="text-xs text-slate-500">
              Select the destination branch and cost center for the selected invoices.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Destination Branch</label>
              <select
                value={targetBatchBranchId}
                onChange={(e) => setTargetBatchBranchId(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.costCenterCode || b.code}) - {b.stateName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsBatchReallocateOpen(false)}
                disabled={isReallocating}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchReallocateInvoices}
                disabled={isReallocating}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                {isReallocating ? 'Re-allocating...' : 'Confirm Re-allocation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchManagerModule;
