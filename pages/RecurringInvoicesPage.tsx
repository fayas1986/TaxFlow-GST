import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Building2,
  FileText,
  IndianRupee,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  Trash2,
  Edit,
  Download,
  Copy,
  Check,
  ChevronRight,
  Mail,
  MessageSquare,
  QrCode,
  ShieldCheck,
  HelpCircle,
  BarChart3,
  Scale
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  getRecurringProfiles,
  getRecurringModuleSummary,
  getRecurringTaxLiabilityProjection,
  createRecurringProfile,
  updateRecurringProfile,
  deleteRecurringProfile,
  triggerRecurringInvoice,
  batchGenerateRecurringInvoices
} from '../services/api';
import {
  RecurringInvoiceProfile,
  RecurringPeriodTaxLiability,
  RecurringModuleSummary
} from '../types';
import RecurringInvoiceModal from '../components/RecurringInvoiceModal';

export const RecurringInvoicesPage: React.FC = () => {
  const navigate = useNavigate();

  // Active View Tab
  const [activeTab, setActiveTab] = useState<'PROFILES' | 'TAX_LIABILITY' | 'EXECUTION_LOGS'>('PROFILES');

  // Data state
  const [profiles, setProfiles] = useState<RecurringInvoiceProfile[]>([]);
  const [summary, setSummary] = useState<RecurringModuleSummary | null>(null);
  const [liabilityProjections, setLiabilityProjections] = useState<RecurringPeriodTaxLiability[]>([]);
  const [quarterlyProjections, setQuarterlyProjections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');
  const [frequencyFilter, setFrequencyFilter] = useState<'ALL' | 'MONTHLY' | 'QUARTERLY' | 'BI_ANNUAL' | 'ANNUAL'>('ALL');
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');

  // Modals & Triggers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<RecurringInvoiceProfile | null>(null);
  const [triggerResultModal, setTriggerResultModal] = useState<{
    isOpen: boolean;
    invoice: any;
    executionLog: any;
    profileName: string;
  } | null>(null);

  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Fetch all recurring profiles and projections
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [profilesRes, summaryRes, projectionRes] = await Promise.all([
        getRecurringProfiles({ status: statusFilter, frequency: frequencyFilter, search: searchQuery }),
        getRecurringModuleSummary(),
        getRecurringTaxLiabilityProjection()
      ]);

      setProfiles(profilesRes.profiles || []);
      setSummary(summaryRes);
      setLiabilityProjections(projectionRes.monthlyLiabilityProjections || []);
      setQuarterlyProjections(projectionRes.quarterlyLiabilityProjections || []);
    } catch (err: any) {
      console.error('Failed to load recurring billing data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, frequencyFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Toggle Profile Status (Pause/Resume)
  const handleToggleStatus = async (profile: RecurringInvoiceProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = profile.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await updateRecurringProfile(profile.id, { status: newStatus });
      showToast(`Contract ${profile.profileName} is now ${newStatus}`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  // Delete Profile
  const handleDeleteProfile = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete recurring billing contract "${name}"?`)) {
      return;
    }
    try {
      await deleteRecurringProfile(id);
      showToast(`Contract "${name}" deleted.`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete profile');
    }
  };

  // Trigger Individual Run
  const handleTriggerRun = async (profile: RecurringInvoiceProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsProcessingAction(true);
    try {
      const res = await triggerRecurringInvoice(profile.id);
      setTriggerResultModal({
        isOpen: true,
        invoice: res.invoice,
        executionLog: res.executionLog,
        profileName: profile.profileName
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to trigger recurring invoice');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Batch Trigger All Pending Runs
  const handleBatchGenerate = async () => {
    if (!window.confirm('Run batch generation for all active schedules due for billing?')) return;
    setIsProcessingAction(true);
    try {
      const res = await batchGenerateRecurringInvoices();
      showToast(`Batch execution complete! Generated ${res.batchCount} invoices with ₹${res.totalTaxLiabilityGenerated.toLocaleString('en-IN')} total tax liability.`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to run batch generation');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Save (Create / Edit) Profile
  const handleSaveProfile = async (data: Partial<RecurringInvoiceProfile>) => {
    if (editingProfile) {
      await updateRecurringProfile(editingProfile.id, data);
      showToast(`Contract "${data.profileName}" updated successfully.`);
    } else {
      await createRecurringProfile(data);
      showToast(`Recurring contract "${data.profileName}" successfully configured.`);
    }
    setEditingProfile(null);
    loadData();
  };

  // Export Tax Liability Forecast to Excel
  const handleExportLiabilityExcel = () => {
    if (liabilityProjections.length === 0) return;

    const dataRows = liabilityProjections.map((m) => ({
      'Tax Period': m.periodLabel,
      'Quarter': m.quarterLabel,
      'Total Invoices': m.invoiceCount,
      'Unique Clients': m.clientCount,
      'Taxable Turnover (₹)': m.totalTaxableValue,
      'CGST Output (₹)': m.totalCgstLiability,
      'SGST Output (₹)': m.totalSgstLiability,
      'IGST Output (₹)': m.totalIgstLiability,
      'Total Output GST (₹)': m.totalTaxLiability,
      'Gross Revenue with Tax (₹)': m.totalGrossRevenue,
      'GSTR-1 Due Date': m.gstr1DueDate,
      'GSTR-3B Due Date': m.gstr3bDueDate
    }));

    const ws = XLSX.utils.json_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tax_Liability_Forecast');
    XLSX.writeFile(wb, `Recurring_GST_Liability_Forecast_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // All execution logs flattened
  const allExecutionLogs = useMemo(() => {
    const logs: Array<any & { profileName: string; partyName: string }> = [];
    profiles.forEach((p) => {
      (p.executionLogs || []).forEach((log) => {
        logs.push({
          ...log,
          profileName: p.profileName,
          partyName: p.partyName
        });
      });
    });
    return logs.sort((a, b) => new Date(b.generatedDate).getTime() - new Date(a.generatedDate).getTime());
  }, [profiles]);

  return (
    <div className="w-full space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-20 right-8 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-indigo-500/40 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{successToast}</span>
        </div>
      )}

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-900/50">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-60 bottom-0 w-64 h-64 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold mb-3">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              Automated Billing & Tax Schedule Engine
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Recurring Invoices & Periodic Tax Automation
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl mt-1.5 leading-relaxed">
              Schedule monthly or quarterly recurring contracts for repeat clients. System automatically forecasts forward CGST, SGST, and IGST tax liabilities for upcoming GSTR-1 and GSTR-3B tax periods.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleBatchGenerate}
              disabled={isProcessingAction}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProcessingAction ? 'animate-spin' : ''}`} />
              Run Due Batches
            </button>

            <button
              onClick={() => {
                setEditingProfile(null);
                setIsCreateModalOpen(true);
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              New Recurring Schedule
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Profiles */}
        <div className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Contracts</span>
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {summary?.activeProfiles || profiles.filter((p) => p.status === 'ACTIVE').length}
            <span className="text-xs font-semibold text-slate-400 ml-2">/ {profiles.length} total</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>Automated recurring schedule</span>
          </div>
        </div>

        {/* Monthly Projected Taxable Revenue (MRR) */}
        <div className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Projected Monthly Base</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            ₹{(summary?.monthlyRecurringRevenue || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Monthly recurring taxable revenue
          </div>
        </div>

        {/* Monthly Output Tax Liability */}
        <div className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Monthly Output GST</span>
            <IndianRupee className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-700 font-mono">
            ₹{(summary?.monthlyProjectedTax || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Projected GSTR-3B liability/mo
          </div>
        </div>

        {/* Quarterly Projected Tax Liability */}
        <div className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Quarterly GST Liability</span>
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-700 font-mono">
            ₹{(summary?.quarterlyProjectedTax || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Projected per quarter (3 months)
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab('PROFILES')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'PROFILES'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Active Schedules ({profiles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('TAX_LIABILITY')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'TAX_LIABILITY'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Forward Tax Liability Projections</span>
        </button>

        <button
          onClick={() => setActiveTab('EXECUTION_LOGS')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'EXECUTION_LOGS'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Generated Invoices History ({allExecutionLogs.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: RECURRING BILLING PROFILES */}
      {/* ========================================================================= */}
      {activeTab === 'PROFILES' && (
        <div className="space-y-5">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by contract name, client, GSTIN..."
                  className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-bold">Status:</span>
                {(['ALL', 'ACTIVE', 'PAUSED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      statusFilter === st ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st === 'ALL' ? 'All' : st === 'ACTIVE' ? 'Active' : 'Paused'}
                  </button>
                ))}
              </div>

              {/* Frequency Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-bold">Frequency:</span>
                {(['ALL', 'MONTHLY', 'QUARTERLY'] as const).map((freq) => (
                  <button
                    key={freq}
                    onClick={() => setFrequencyFilter(freq)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      frequencyFilter === freq ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {freq === 'ALL' ? 'All' : freq === 'MONTHLY' ? 'Monthly' : 'Quarterly'}
                  </button>
                ))}
              </div>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 font-bold">
              <button
                onClick={() => setViewMode('CARDS')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === 'CARDS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Cards
              </button>
              <button
                onClick={() => setViewMode('TABLE')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === 'TABLE' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Table
              </button>
            </div>
          </div>

          {/* Cards View */}
          {viewMode === 'CARDS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 relative overflow-hidden"
                >
                  {/* Status Banner stripe */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1.5 ${
                      profile.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-400'
                    }`}
                  />

                  <div className="space-y-3 pt-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                            profile.frequency === 'MONTHLY'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {profile.frequency}
                        </span>
                        <h3 className="text-sm font-extrabold text-slate-900 mt-1.5 line-clamp-1">
                          {profile.profileName}
                        </h3>
                        <p className="text-xs text-slate-600 font-semibold">{profile.partyName}</p>
                      </div>

                      <button
                        onClick={(e) => handleToggleStatus(profile, e)}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          profile.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        }`}
                        title={profile.status === 'ACTIVE' ? 'Pause Schedule' : 'Resume Schedule'}
                      >
                        {profile.status === 'ACTIVE' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Client GSTIN:</span>
                        <span className="font-mono font-bold text-slate-800">{profile.gstin}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Place of Supply:</span>
                        <span className="font-semibold text-slate-700">
                          State {profile.placeOfSupply} ({profile.isInterstate ? 'IGST' : 'CGST+SGST'})
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Next Run Date:</span>
                        <span className="font-bold text-indigo-700 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {profile.nextRunDate}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Cycles Generated:</span>
                        <span className="font-bold text-slate-800">{profile.cyclesCompleted} cycles</span>
                      </div>
                    </div>

                    {/* Tax Breakdown Strip */}
                    <div className="grid grid-cols-2 gap-2 pt-1 text-center">
                      <div className="p-2 bg-slate-100/70 rounded-lg">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Taxable Base</div>
                        <div className="text-xs font-black text-slate-900 font-mono">
                          ₹{profile.taxableAmount.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="p-2 bg-indigo-50/80 rounded-lg border border-indigo-100">
                        <div className="text-[10px] text-indigo-500 uppercase font-bold">GST Liability</div>
                        <div className="text-xs font-black text-indigo-700 font-mono">
                          ₹{profile.totalTaxAmount.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingProfile(profile);
                          setIsCreateModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Edit Schedule"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => handleDeleteProfile(profile.id, profile.profileName, e)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Profile"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={(e) => handleTriggerRun(profile, e)}
                      disabled={isProcessingAction}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Sparkles className="w-3 h-3" />
                      Generate Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Table View */}
          {viewMode === 'TABLE' && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-3.5">Contract Profile</th>
                      <th className="p-3.5">Client & GSTIN</th>
                      <th className="p-3.5">Frequency</th>
                      <th className="p-3.5">Next Run Date</th>
                      <th className="p-3.5 text-right">Taxable Value</th>
                      <th className="p-3.5 text-right">Output GST</th>
                      <th className="p-3.5 text-right">Gross Total</th>
                      <th className="p-3.5 text-center">Status</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {profiles.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-all">
                        <td className="p-3.5 font-bold text-slate-900">{p.profileName}</td>
                        <td className="p-3.5">
                          <div className="font-semibold text-slate-800">{p.partyName}</div>
                          <div className="font-mono text-[11px] text-slate-400">{p.gstin}</div>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded">
                            {p.frequency}
                          </span>
                        </td>
                        <td className="p-3.5 font-semibold text-slate-700">{p.nextRunDate}</td>
                        <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                          ₹{p.taxableAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-indigo-600">
                          ₹{p.totalTaxAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3.5 text-right font-mono font-black text-slate-900">
                          ₹{p.totalInvoiceAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => handleTriggerRun(p, e)}
                              className="px-2.5 py-1 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-all text-[11px]"
                            >
                              Generate
                            </button>
                            <button
                              onClick={() => {
                                setEditingProfile(p);
                                setIsCreateModalOpen(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-700"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: FORWARD TAX LIABILITY PROJECTIONS */}
      {/* ========================================================================= */}
      {activeTab === 'TAX_LIABILITY' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  Automated Forward GST Liability Timeline (FY 2026-27)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Calculates upcoming monthly and quarterly tax liability cash flows generated from active recurring client contracts.
                </p>
              </div>

              <button
                onClick={handleExportLiabilityExcel}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-center"
              >
                <Download className="w-3.5 h-3.5" />
                Export Projection (.xlsx)
              </button>
            </div>

            {/* Monthly Horizon Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {liabilityProjections.map((month) => (
                <div
                  key={month.periodKey}
                  className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/90 hover:border-indigo-300 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
                        {month.quarterLabel.split(' ')[0]}
                      </span>
                      <h4 className="text-sm font-black text-slate-900">{month.periodLabel}</h4>
                    </div>
                    <span className="px-2 py-1 bg-white border border-slate-200 text-slate-800 text-xs font-mono font-bold rounded-lg">
                      {month.invoiceCount} Invoices
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Taxable Base:</span>
                      <span className="font-mono font-bold text-slate-900">
                        ₹{month.totalTaxableValue.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-100 text-center text-[11px]">
                      <div>
                        <div className="text-slate-400">CGST</div>
                        <div className="font-mono font-bold text-emerald-700">
                          ₹{month.totalCgstLiability.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">SGST</div>
                        <div className="font-mono font-bold text-emerald-700">
                          ₹{month.totalSgstLiability.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">IGST</div>
                        <div className="font-mono font-bold text-indigo-700">
                          ₹{month.totalIgstLiability.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 font-bold">
                      <span className="text-indigo-900">Total Output GST:</span>
                      <span className="font-mono text-indigo-700 text-sm">
                        ₹{month.totalTaxLiability.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Statutory Due Dates */}
                  <div className="text-[11px] space-y-1 text-slate-500 bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100/70">
                    <div className="flex items-center justify-between">
                      <span>GSTR-1 Due Date:</span>
                      <strong className="text-slate-800">{month.gstr1DueDate}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>GSTR-3B Tax Due Date:</span>
                      <strong className="text-indigo-800">{month.gstr3bDueDate}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: GENERATED INVOICES EXECUTION HISTORY */}
      {/* ========================================================================= */}
      {activeTab === 'EXECUTION_LOGS' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-0">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              Audit Log of Automatically Generated Recurring Invoices
            </h3>
            <span className="text-xs text-slate-400">{allExecutionLogs.length} total generated</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3.5">Invoice #</th>
                  <th className="p-3.5">Billing Contract</th>
                  <th className="p-3.5">Client</th>
                  <th className="p-3.5">Period</th>
                  <th className="p-3.5 text-right">Taxable Value</th>
                  <th className="p-3.5 text-right">GST Liability</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Generated Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {allExecutionLogs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-all">
                    <td className="p-3.5 font-mono font-bold text-indigo-700">
                      {log.invoiceNumber}
                    </td>
                    <td className="p-3.5 font-bold text-slate-900">{log.profileName}</td>
                    <td className="p-3.5 text-slate-700">{log.partyName}</td>
                    <td className="p-3.5 font-semibold text-slate-800">{log.period}</td>
                    <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                      ₹{log.taxableAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-indigo-600">
                      ₹{log.totalTax.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                        {log.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right text-slate-500">
                      {new Date(log.generatedDate).toLocaleDateString('en-GB')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal for Creating / Editing Recurring Schedule */}
      <RecurringInvoiceModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingProfile(null);
        }}
        onSave={handleSaveProfile}
        initialData={editingProfile}
      />

      {/* Modal showing Trigger Execution Result */}
      {triggerResultModal && triggerResultModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Recurring Invoice Generated</h3>
              <p className="text-xs text-slate-500">
                Invoice for contract <strong>{triggerResultModal.profileName}</strong> has been generated and queued for dispatch.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl space-y-2 text-xs border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Invoice Number:</span>
                <span className="font-mono font-bold text-indigo-700">
                  {triggerResultModal.invoice.invoiceNumber}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Billing Period:</span>
                <span className="font-bold text-slate-800">
                  {triggerResultModal.executionLog.period}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Taxable Value:</span>
                <span className="font-mono font-bold text-slate-900">
                  ₹{triggerResultModal.invoice.amount.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total GST Calculated:</span>
                <span className="font-mono font-bold text-indigo-600">
                  ₹{triggerResultModal.invoice.taxAmount.toLocaleString('en-IN')}
                </span>
              </div>
              {triggerResultModal.invoice.irn && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-400">E-Invoice IRN:</span>
                  <span className="font-mono text-[10px] text-emerald-700 font-bold">
                    {triggerResultModal.invoice.irn.substring(0, 16)}...
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setTriggerResultModal(null)}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Close & Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecurringInvoicesPage;
