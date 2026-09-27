import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { 
  fetchFilingHistory, 
  fetchReturnDraft, 
  submitReturn, 
  syncFilingStatus, 
  fetchFilingVersions, 
  createFilingVersion, 
  revertFilingVersion,
  createFilingRecord
} from '../services/api';
import { 
  Check, ChevronRight, AlertCircle, Loader2, FileText, Calendar, 
  Download, UploadCloud, RefreshCw, FileCheck, Shield, ChevronLeft, Eye, Lock,
  CalendarDays, ArrowUpRight, Bell, Laptop, History, GitCompare, GitCommit, GitBranch,
  Edit, Save, RotateCcw, PlusCircle, X, ChevronDown, CheckCircle2, Sparkles, ShieldCheck,
  MessageSquare, Building2
} from 'lucide-react';
import { FilingRecord, ReturnFormType, FilingVersion, FilingDataSummary } from '../types';
import FilingCalendar from '../components/FilingCalendar';
import { Gstr1Wizard } from '../components/Gstr1Wizard';
import { OtherReturnsWizard } from '../components/OtherReturnsWizard';
import { Gstr9Wizard } from '../components/Gstr9Wizard';
import { GstSandboxEnvironment } from '../components/GstSandboxEnvironment';
import { Gstr1TaxRateChart } from '../components/Gstr1TaxRateChart';
import { AutomatedGstFilingWizard } from '../components/AutomatedGstFilingWizard';
import { GstReturnFilingWizard } from '../components/GstReturnFilingWizard';
import { SendFilingStatusWhatsAppModal } from '../components/SendFilingStatusWhatsAppModal';
import { BranchManagerModal } from '../components/BranchManagerModal';
import { 
  requestBrowserNotificationPermission, 
  triggerBrowserNotification, 
  getNotificationPermissionState 
} from '../utils/browserNotifications';

const Filing: React.FC = () => {
  const queryClient = useQueryClient();
  const user = useSelector((state: RootState) => state.auth.user);
  const tenantId = user?.currentTenantId || 't1';

  const { data: filings, isLoading } = useQuery({ 
      queryKey: ['filings', tenantId], 
      queryFn: () => fetchFilingHistory(tenantId) 
  });

  // State
  const [activeTab, setActiveTab] = useState<'MONTHLY' | 'ANNUAL' | 'CALENDAR' | 'SANDBOX'>('MONTHLY');
  const [selectedReturn, setSelectedReturn] = useState<FilingRecord | null>(null);
  const [isAutomatedWizardOpen, setIsAutomatedWizardOpen] = useState(false);
  const [wizardPeriod, setWizardPeriod] = useState('July 2026');
  const [isBranchManagerOpen, setIsBranchManagerOpen] = useState(false);

  // GSTR-1 / 3B Multi-Step Guided Filing Wizard State
  const [isGstFilingWizardOpen, setIsGstFilingWizardOpen] = useState(false);
  const [gstFilingWizardReturn, setGstFilingWizardReturn] = useState<FilingRecord | null>(null);
  const [gstFilingWizardType, setGstFilingWizardType] = useState<ReturnFormType>('GSTR-3B');
  const [gstFilingWizardPeriod, setGstFilingWizardPeriod] = useState<string>('July 2026');
  const [whatsAppFilingRecord, setWhatsAppFilingRecord] = useState<FilingRecord | null>(null);
  
  // Wizard State
  const [wizardStep, setWizardStep] = useState(0);
  const [otp, setOtp] = useState('');

  // Version Control & Comparison States
  const [activeSummary, setActiveSummary] = useState<FilingDataSummary | null>(null);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [draftChangeSummary, setDraftChangeSummary] = useState('');
  const [compareBaseId, setCompareBaseId] = useState<string | null>(null);
  const [compareTargetId, setCompareTargetId] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [versionFeedback, setVersionFeedback] = useState<{ type: 'SUCCESS' | 'ERROR'; message: string } | null>(null);

  // New Return Initiation States
  const [isInitiating, setIsInitiating] = useState(false);
  const [newReturnType, setNewReturnType] = useState<ReturnFormType>('GSTR-3B');
  const [newReturnPeriod, setNewReturnPeriod] = useState('July 2026');
  const [newReturnFY, setNewReturnFY] = useState('2026-27');
  const [newReturnDueDate, setNewReturnDueDate] = useState('2026-08-20');
  
  // Tax Rate Chart Selection
  const [selectedTaxRate, setSelectedTaxRate] = useState<string | null>(null);

  const MOCK_INVOICES = [
    { id: 'INV-2026-001', date: '2026-08-01', customer: 'TechCorp Pvt Ltd', taxableValue: 15000, rate: '18% Rate', tax: 2700, total: 17700 },
    { id: 'INV-2026-002', date: '2026-08-03', customer: 'Global Traders', taxableValue: 45000, rate: '5% Rate', tax: 2250, total: 47250 },
    { id: 'INV-2026-003', date: '2026-08-05', customer: 'Acme Corp', taxableValue: 20000, rate: '12% Rate', tax: 2400, total: 22400 },
    { id: 'INV-2026-004', date: '2026-08-08', customer: 'Nexus Solutions', taxableValue: 120000, rate: '18% Rate', tax: 21600, total: 141600 },
    { id: 'INV-2026-005', date: '2026-08-10', customer: 'Alpha Industries', taxableValue: 35000, rate: '28% Rate', tax: 9800, total: 44800 },
    { id: 'INV-2026-006', date: '2026-08-12', customer: 'Local Retailers', taxableValue: 8000, rate: 'Nil Rated / Exempt', tax: 0, total: 8000 },
    { id: 'INV-2026-007', date: '2026-08-15', customer: 'TechCorp Pvt Ltd', taxableValue: 75000, rate: '18% Rate', tax: 13500, total: 88500 },
    { id: 'INV-2026-008', date: '2026-08-18', customer: 'Omega Enterprises', taxableValue: 65000, rate: '12% Rate', tax: 7800, total: 72800 },
    { id: 'INV-2026-009', date: '2026-08-20', customer: 'Global Traders', taxableValue: 4000, rate: 'Nil Rated / Exempt', tax: 0, total: 4000 },
  ];

  const filteredInvoices = MOCK_INVOICES.filter(inv => inv.rate === selectedTaxRate);

  // Initiate New Filing Mutation
  const { mutate: addFilingRecord, isPending: isAddingFiling } = useMutation({
      mutationFn: createFilingRecord,
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['filings', tenantId] });
          setIsInitiating(false);
      }
  });

  // Draft Data Query
  const { data: draftData, isLoading: isDraftLoading } = useQuery({
      queryKey: ['draft', selectedReturn?.id],
      queryFn: () => selectedReturn ? fetchReturnDraft(selectedReturn.type, selectedReturn.period) : null,
      enabled: !!selectedReturn
  });

  // Version Control History Query
  const { data: versions, refetch: refetchVersions, isLoading: isVersionsLoading } = useQuery({
      queryKey: ['filingVersions', selectedReturn?.id],
      queryFn: () => selectedReturn ? fetchFilingVersions(selectedReturn.id, selectedReturn.type, selectedReturn.period) : null,
      enabled: !!selectedReturn
  });

  // Automatically initialize active summary from latest version or default draft
  useEffect(() => {
      if (versions && versions.length > 0) {
          if (!activeSummary) {
              setActiveSummary(versions[0].summary);
          }
      } else if (draftData && !activeSummary) {
          setActiveSummary(draftData.summary);
      }
  }, [versions, draftData, activeSummary]);

  // Dismiss version feedback after a delay
  useEffect(() => {
      if (versionFeedback) {
          const timer = setTimeout(() => setVersionFeedback(null), 5000);
          return () => clearTimeout(timer);
      }
  }, [versionFeedback]);

  // Save/Commit Version Mutation
  const { mutate: saveVersion, isPending: isSavingVersion } = useMutation({
      mutationFn: ({ status, summary, changeSummary }: { status: 'DRAFT' | 'SUBMITTED' | 'PRE-VALIDATION'; summary: FilingDataSummary; changeSummary: string }) => 
          createFilingVersion(selectedReturn!.id, status, changeSummary, summary, user?.name || 'Admin User'),
      onSuccess: (newVer) => {
          queryClient.invalidateQueries({ queryKey: ['filingVersions', selectedReturn?.id] });
          setActiveSummary(newVer.summary);
          setIsEditingDraft(false);
          setDraftChangeSummary('');
          setVersionFeedback({ type: 'SUCCESS', message: 'New filing draft version committed successfully!' });
      },
      onError: (err: any) => {
          setVersionFeedback({ type: 'ERROR', message: err.message || 'Failed to save version.' });
      }
  });

  // Revert/Restore Version Mutation
  const { mutate: revertVersion, isPending: isRevertingVersion } = useMutation({
      mutationFn: (versionId: string) => revertFilingVersion(selectedReturn!.id, versionId),
      onSuccess: (newVer) => {
          queryClient.invalidateQueries({ queryKey: ['filingVersions', selectedReturn?.id] });
          setActiveSummary(newVer.summary);
          setVersionFeedback({ type: 'SUCCESS', message: `Draft restored to Version v${newVer.version - 1}! A new draft revision v${newVer.version} has been created.` });
      },
      onError: (err: any) => {
          setVersionFeedback({ type: 'ERROR', message: err.message || 'Failed to revert version.' });
      }
  });

  // Submit Mutation
  const { mutate: fileReturn, isPending: isFiling, error: filingError } = useMutation({
      mutationFn: (variables: { id: string; summary?: FilingDataSummary }) => submitReturn(variables.id, variables.summary),
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['filings', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['filingVersions', selectedReturn?.id] });
          setWizardStep(4); // Success Step
      },
      onError: (err) => {
          // Error handling is managed by displaying the error message in the wizard
      }
  });

  // Real-time Sync Mutation
  const { mutate: syncStatus, isPending: isSyncing } = useMutation({
      mutationFn: syncFilingStatus,
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['filings', tenantId] });
      }
  });

  const handleStartFiling = (record: FilingRecord) => {
      setSelectedReturn(record);
      setWizardStep(0);
      setOtp('');
      setActiveSummary(null);
      setIsEditingDraft(false);
      setDraftChangeSummary('');
      setCompareBaseId(null);
      setCompareTargetId(null);
      setIsComparing(false);
  };

  const handleCloseWizard = () => {
      setSelectedReturn(null);
      setWizardStep(0);
      setActiveSummary(null);
      setIsEditingDraft(false);
      setDraftChangeSummary('');
      setCompareBaseId(null);
      setCompareTargetId(null);
      setIsComparing(false);
      setVersionFeedback(null);
  };

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'FILED': return 'bg-green-100 text-green-700 border-green-200';
          case 'PENDING': return 'bg-blue-50 text-blue-700 border-blue-200';
          case 'OVERDUE': return 'bg-red-50 text-red-700 border-red-200';
          case 'SAVED': return 'bg-amber-50 text-amber-700 border-amber-200';
          default: return 'bg-slate-100 text-slate-700';
      }
  };

  const renderDashboard = () => {
      const filteredFilings = filings?.filter(f => {
          if (activeTab === 'MONTHLY') return f.type !== 'GSTR-9' && f.type !== 'GSTR-9C';
          return f.type === 'GSTR-9' || f.type === 'GSTR-9C';
      });

      // Filings due within 48 hours or overdue
      const imminent48hFilings = filings?.filter(f => {
          if (f.status === 'FILED') return false;
          const target = new Date(f.dueDate);
          target.setHours(23, 59, 59, 999);
          const diffHours = (target.getTime() - Date.now()) / (1000 * 60 * 60);
          return diffHours <= 48;
      }) || [];

      return (
          <div className="space-y-6">
              {/* 48-Hour Deadline Warning Banner */}
              {imminent48hFilings.length > 0 && (
                  <div className="p-4 bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in">
                      <div className="flex items-start gap-3">
                          <div className="p-2 bg-rose-600 text-white rounded-xl shadow-md shrink-0">
                              <Bell size={20} className="animate-bounce" />
                          </div>
                          <div>
                              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                  🚨 Urgent Filing Deadline Notice ({imminent48hFilings.length} Return{imminent48hFilings.length > 1 ? 's' : ''} Due &le; 48 Hours)
                              </h4>
                              <p className="text-xs text-slate-600 mt-1">
                                  {imminent48hFilings.map(f => `${f.type} (${f.period}) due ${f.dueDate}`).join(' • ')}.
                                  File now to avoid GST interest penalties and late filing fees.
                              </p>
                          </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                          <button
                              onClick={async () => {
                                  const perm = await requestBrowserNotificationPermission();
                                  if (perm === 'granted') {
                                      const imminent = imminent48hFilings[0];
                                      triggerBrowserNotification(`🚨 GST Filing Deadline: ${imminent.type}`, {
                                          body: `${imminent.type} for ${imminent.period} is due on ${imminent.dueDate}. Click to file now.`,
                                          force: true,
                                          onClickUrl: '#/filing'
                                      });
                                  }
                              }}
                              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                          >
                              <Laptop size={14} /> Desktop Notification
                          </button>
                      </div>
                  </div>
              )}

               <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <div>
                      <h2 className="text-2xl font-bold text-slate-800">GST Returns Dashboard</h2>
                      <div className="flex items-center gap-2 mt-1">
                          <p className="text-slate-500">Track and file your {activeTab.toLowerCase()} returns.</p>
                          <button 
                            onClick={() => syncStatus()} 
                            disabled={isSyncing}
                            className="text-xs text-blue-600 flex items-center gap-1 hover:underline disabled:opacity-50"
                          >
                             <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''}/> Sync Status
                          </button>
                      </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                      <button 
                          onClick={() => {
                              setGstFilingWizardReturn(null);
                              setGstFilingWizardType('GSTR-3B');
                              setGstFilingWizardPeriod('July 2026');
                              setIsGstFilingWizardOpen(true);
                          }}
                          className="px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold rounded-lg shadow-md transition-all flex items-center gap-2 active:scale-95"
                          title="Open Unified Multi-Step GST Return Filing Wizard (GSTR-1 & GSTR-3B)"
                          id="launch-gst-return-filing-wizard-btn"
                      >
                          <ShieldCheck size={16} /> GSTR-1 / 3B Filing Wizard
                      </button>

                      <button 
                          onClick={() => {
                              const gstr1 = filings?.find(f => f.type === 'GSTR-1' && f.status !== 'FILED') || filings?.find(f => f.type === 'GSTR-1');
                              if (gstr1) {
                                  handleStartFiling(gstr1);
                              } else {
                                  handleStartFiling({
                                      id: `gstr1-${Date.now()}`,
                                      type: 'GSTR-1',
                                      period: 'August 2026',
                                      fy: '2026-27',
                                      dueDate: '2026-09-11',
                                      status: 'PENDING',
                                      taxLiability: 0
                                  });
                              }
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-md transition-all flex items-center gap-2 active:scale-95"
                          title="Open Guided GSTR-1 Filing Wizard (Upload, HSN, Diagnostics, JSON)"
                          id="launch-guided-gstr1-btn"
                      >
                          <Sparkles size={16} /> Guided GSTR-1 Wizard
                      </button>

                      <button 
                          onClick={() => setIsAutomatedWizardOpen(true)}
                          className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-bold rounded-lg shadow-md transition-all flex items-center gap-2 active:scale-95"
                          title="Launch Official Automated GST Return Filing Flow"
                      >
                          <FileCheck size={16} /> Automated GST Filing Wizard
                      </button>

                      <button 
                          onClick={() => {
                              setIsInitiating(!isInitiating);
                          }}
                          className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5"
                      >
                          <PlusCircle size={16} /> Prepare New Return
                      </button>

                      <button 
                          onClick={() => setIsBranchManagerOpen(true)}
                          className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5"
                          title="Allocate & audit GST filings across branches or cost centers"
                      >
                          <Building2 size={16} className="text-amber-600" /> Branch Filings
                      </button>

                      <div className="flex bg-slate-100 p-1 rounded-lg">
                          <button 
                              onClick={() => setActiveTab('MONTHLY')} 
                              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'MONTHLY' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                              Monthly / Quarterly
                          </button>
                          <button 
                              onClick={() => setActiveTab('ANNUAL')} 
                              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'ANNUAL' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                              Annual Returns
                          </button>
                          <button 
                              onClick={() => setActiveTab('CALENDAR')} 
                              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'CALENDAR' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                              Calendar View
                          </button>
                          <button 
                              onClick={() => setActiveTab('SANDBOX')} 
                              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'SANDBOX' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                              Validation Sandbox
                          </button>
                      </div>
                  </div>
              </div>

              {isInitiating && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 animate-in slide-in-from-top-4 duration-200">
                      <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200">
                          <div>
                              <h3 className="text-base font-bold text-slate-900">Prepare Return Draft</h3>
                              <p className="text-xs text-slate-500">Initiate a compliance drafting workspace for any GST form type</p>
                          </div>
                          <button onClick={() => setIsInitiating(false)} className="p-1 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
                              <X size={18}/>
                          </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Return Form Type</label>
                              <select 
                                  value={newReturnType}
                                  onChange={(e) => {
                                      const type = e.target.value as ReturnFormType;
                                      setNewReturnType(type);
                                      // Auto adjust tab and period defaults
                                      if (type === 'GSTR-9' || type === 'GSTR-9C') {
                                          setNewReturnPeriod('FY 2025-26');
                                          setNewReturnFY('2025-26');
                                          setNewReturnDueDate('2026-12-31');
                                      } else if (type === 'CMP-08') {
                                          setNewReturnPeriod('Apr-Jun 2026');
                                          setNewReturnFY('2026-27');
                                          setNewReturnDueDate('2026-07-18');
                                      } else {
                                          setNewReturnPeriod('July 2026');
                                          setNewReturnFY('2026-27');
                                          setNewReturnDueDate('2026-08-20');
                                      }
                                  }}
                                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                              >
                                  <option value="GSTR-3B">GSTR-3B (Summary Tax Return)</option>
                                  <option value="GSTR-1">GSTR-1 (Outward Supplies Return)</option>
                                  <option value="CMP-08">CMP-08 (Composition Statement)</option>
                                  <option value="GSTR-9">GSTR-9 (Annual return)</option>
                                  <option value="GSTR-9C">GSTR-9C (Reconciliation Statement)</option>
                                  <option value="ITC-04">ITC-04 (Job Work Ledger Return)</option>
                                  <option value="GSTR-7">GSTR-7 (TDS Return)</option>
                                  <option value="GSTR-8">GSTR-8 (TCS Return)</option>
                                  <option value="GSTR-6">GSTR-6 (ISD Return)</option>
                                  <option value="GSTR-5">GSTR-5 (Non-Resident Taxable Return)</option>
                                  <option value="GSTR-5A">GSTR-5A (OIDAR Services Return)</option>
                              </select>
                          </div>

                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Period / Tax Period</label>
                              <input 
                                  type="text"
                                  value={newReturnPeriod}
                                  onChange={(e) => setNewReturnPeriod(e.target.value)}
                                  placeholder="e.g. July 2026"
                                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                          </div>

                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fiscal Year</label>
                              <input 
                                  type="text"
                                  value={newReturnFY}
                                  onChange={(e) => setNewReturnFY(e.target.value)}
                                  placeholder="e.g. 2026-27"
                                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                          </div>

                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Statutory Due Date</label>
                              <input 
                                  type="date"
                                  value={newReturnDueDate}
                                  onChange={(e) => setNewReturnDueDate(e.target.value)}
                                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                          </div>
                      </div>

                      <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-slate-200">
                          <button 
                              onClick={() => setIsInitiating(false)}
                              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                          >
                              Cancel
                          </button>
                          <button 
                              onClick={() => {
                                  const taxLiability = (newReturnType === 'GSTR-3B' || newReturnType === 'CMP-08' || newReturnType === 'GSTR-9' || newReturnType === 'GSTR-9C') ? 145000 : undefined;
                                  addFilingRecord({
                                      tenantId,
                                      type: newReturnType,
                                      period: newReturnPeriod,
                                      fy: newReturnFY,
                                      status: 'PENDING',
                                      dueDate: newReturnDueDate,
                                      taxLiability
                                  });
                                  if (newReturnType === 'GSTR-9' || newReturnType === 'GSTR-9C') {
                                      setActiveTab('ANNUAL');
                                  } else {
                                      setActiveTab('MONTHLY');
                                  }
                              }}
                              disabled={isAddingFiling}
                              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow transition-colors flex items-center gap-2"
                          >
                              {isAddingFiling && <Loader2 size={16} className="animate-spin" />}
                              Create Drafting Session
                          </button>
                      </div>
                  </div>
              )}

              {activeTab === 'SANDBOX' && (
                  <GstSandboxEnvironment />
              )}

              {activeTab === 'CALENDAR' && (
                  <FilingCalendar filings={filings || []} />
              )}

              {activeTab === 'ANNUAL' && (
                  <Gstr9Wizard />
              )}

              {activeTab === 'MONTHLY' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                      <div className="lg:col-span-1">
                          <Gstr1TaxRateChart 
                            selectedRate={selectedTaxRate}
                            onSelectRate={setSelectedTaxRate}
                          />
                      </div>
                      <div className="lg:col-span-2 bg-slate-50 border border-slate-200 border-dashed rounded-xl p-6 flex flex-col justify-center">
                          {selectedTaxRate ? (
                              <div className="h-full flex flex-col animate-in fade-in duration-300">
                                  <div className="flex justify-between items-center mb-4">
                                      <h4 className="text-sm font-bold text-slate-800">
                                          Invoices for {selectedTaxRate}
                                      </h4>
                                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                                          {filteredInvoices.length} Records
                                      </span>
                                  </div>
                                  <div className="flex-1 overflow-auto max-h-[260px] rounded-lg border border-slate-200 bg-white shadow-sm">
                                      <table className="w-full text-left text-xs">
                                          <thead className="bg-slate-100 sticky top-0 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                                              <tr>
                                                  <th className="p-3">Invoice #</th>
                                                  <th className="p-3">Date</th>
                                                  <th className="p-3">Customer</th>
                                                  <th className="p-3 text-right">Taxable</th>
                                                  <th className="p-3 text-right">Tax Amt</th>
                                                  <th className="p-3 text-right">Total</th>
                                              </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100">
                                              {filteredInvoices.map(inv => (
                                                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                                      <td className="p-3 font-mono text-slate-900 font-medium">{inv.id}</td>
                                                      <td className="p-3 text-slate-500 font-mono">{inv.date}</td>
                                                      <td className="p-3 text-slate-700">{inv.customer}</td>
                                                      <td className="p-3 text-right font-mono text-slate-700">₹{inv.taxableValue.toLocaleString()}</td>
                                                      <td className="p-3 text-right font-mono text-slate-700">₹{inv.tax.toLocaleString()}</td>
                                                      <td className="p-3 text-right font-mono font-bold text-slate-900">₹{inv.total.toLocaleString()}</td>
                                                  </tr>
                                              ))}
                                              {filteredInvoices.length === 0 && (
                                                  <tr>
                                                      <td colSpan={6} className="p-8 text-center text-slate-500">
                                                          No invoices found for this tax rate.
                                                      </td>
                                                  </tr>
                                              )}
                                          </tbody>
                                      </table>
                                  </div>
                              </div>
                          ) : (
                              <div className="text-center">
                                  <h4 className="text-sm font-bold text-slate-700 mb-2">Monthly Compliance Overview</h4>
                                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                                      Your GSTR-1 outward supplies for the current period are visualized on the left. 
                                      Click on any tax rate segment in the chart to instantly filter and review the corresponding B2B invoices and credit notes before generating the final summary.
                                  </p>
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {(activeTab === 'MONTHLY' || activeTab === 'ANNUAL') && (
                isLoading ? (
                  <div className="text-center py-12 text-slate-500"><Loader2 className="animate-spin mx-auto mb-2"/> Loading returns...</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredFilings?.map(record => (
                          <div key={record.id} className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow p-6 flex flex-col relative overflow-hidden group">
                              <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-5 ${getStatusColor(record.status).split(' ')[0].replace('bg-', 'bg-current')}`}></div>
                              
                              <div className="flex justify-between items-start mb-4">
                                  <div className="flex items-center gap-3">
                                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${
                                          record.type.includes('9') ? 'bg-amber-100 text-amber-600' : 
                                          record.type.includes('1') ? 'bg-blue-100 text-blue-600' : 
                                          'bg-purple-100 text-purple-600'
                                      }`}>
                                          {record.type.replace('GSTR-', '')}
                                      </div>
                                      <div>
                                          <h3 className="font-bold text-slate-800">{record.type}</h3>
                                          <p className="text-xs text-slate-500">{record.period}</p>
                                      </div>
                                  </div>
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(record.status)}`}>
                                      {record.status}
                                  </span>
                              </div>

                              <div className="space-y-3 flex-1">
                                  {record.branchName && (
                                      <div className="flex items-center justify-between text-[11px] font-semibold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/80">
                                          <div className="flex items-center gap-1.5 truncate">
                                              <Building2 size={12} className="text-amber-600 shrink-0" />
                                              <span className="truncate">{record.branchName}</span>
                                          </div>
                                          {record.costCenter && (
                                              <span className="font-mono text-[9px] font-bold text-amber-700 ml-1 shrink-0">{record.costCenter}</span>
                                          )}
                                      </div>
                                  )}
                                  <div className="flex justify-between text-sm">
                                      <span className="text-slate-500">Due Date</span>
                                      <span className={`font-medium ${record.status === 'OVERDUE' ? 'text-red-600' : 'text-slate-700'}`}>
                                          {record.dueDate}
                                      </span>
                                  </div>
                                  {record.status === 'FILED' && (
                                      <div className="flex justify-between text-sm">
                                          <span className="text-slate-500">Filed On</span>
                                          <span className="font-medium text-slate-700">{record.filedDate}</span>
                                      </div>
                                  )}
                                  {record.taxLiability && (
                                      <div className="flex justify-between text-sm pt-2 border-t border-slate-100">
                                          <span className="text-slate-500">Liability</span>
                                          <span className="font-bold text-slate-800">₹{record.taxLiability.toLocaleString()}</span>
                                      </div>
                                  )}
                              </div>

                              <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
                                  {record.type.includes('9') && record.status !== 'FILED' && (
                                      <button className="w-full py-2 flex items-center justify-center gap-2 text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg text-xs font-medium transition-colors border border-slate-200">
                                          <Download size={14}/> Auto-Compute JSON
                                      </button>
                                  )}
                                  
                                  {record.status === 'FILED' ? (
                                      <div className="flex gap-2">
                                          <button 
                                              onClick={() => alert(`Official Filing ARN: ${record.arn || 'AA270826001234F'}`)}
                                              className="flex-1 py-2 flex items-center justify-center gap-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-semibold transition-colors border border-blue-200"
                                          >
                                              <Download size={14}/> Download ARN
                                          </button>
                                          <button 
                                              onClick={() => setWhatsAppFilingRecord(record)}
                                              className="flex-1 py-2 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm active:scale-95"
                                              title="Send Filing Status & ARN to Client WhatsApp"
                                          >
                                              <MessageSquare size={13} /> WhatsApp
                                          </button>
                                      </div>
                                  ) : (
                                      <div className="flex gap-2">
                                          <button 
                                              onClick={() => {
                                                  if (record.type === 'GSTR-1' || record.type === 'GSTR-3B') {
                                                      setGstFilingWizardReturn(record);
                                                      setGstFilingWizardType(record.type);
                                                      setGstFilingWizardPeriod(record.period);
                                                      setIsGstFilingWizardOpen(true);
                                                  } else {
                                                      handleStartFiling(record);
                                                  }
                                              }}
                                              className={`flex-1 py-2 flex items-center justify-center gap-1.5 text-white rounded-lg text-sm font-medium transition-colors shadow-sm ${
                                                  record.type.includes('9') ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-900 hover:bg-slate-800'
                                              }`}
                                              title="Open Multi-Step Guided Filing Wizard"
                                          >
                                              {record.type.includes('9') ? 'Prepare Annual Return' : 'File with Wizard'} <ChevronRight size={15}/>
                                          </button>
                                          {record.type !== 'GSTR-9' && record.type !== 'GSTR-9C' && (
                                              <button
                                                  onClick={() => handleStartFiling(record)}
                                                  className="px-3 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg text-xs font-bold transition-colors"
                                                  title="Open Classic Inline Draft & Version Compare"
                                              >
                                                  Draft
                                              </button>
                                          )}
                                      </div>
                                  )}
                              </div>
                          </div>
                      ))}
                      
                      {filteredFilings?.length === 0 && (
                          <div className="col-span-full py-12 text-center bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                              <p className="text-slate-500">No {activeTab.toLowerCase()} returns found for the selected period.</p>
                          </div>
                      )}
                  </div>
                )
              )}
          </div>
      );
  };

  const handleSectionChange = (index: number, field: 'count' | 'value', valStr: string) => {
      if (!activeSummary) return;
      const val = parseFloat(valStr) || 0;
      const newSections = [...activeSummary.sections];
      newSections[index] = {
          ...newSections[index],
          [field]: val
      };
      
      // Auto-recalculate Total Liability by summing the sections
      const newTotalLiability = newSections.reduce((sum, sec) => sum + sec.value, 0);
      const newCashPayable = Math.max(0, newTotalLiability - activeSummary.itcAvailable);
      
      setActiveSummary({
          ...activeSummary,
          sections: newSections,
          totalLiability: newTotalLiability,
          cashPayable: newCashPayable
      });
  };

  const handleItcChange = (valStr: string) => {
      if (!activeSummary) return;
      const val = parseFloat(valStr) || 0;
      const newCashPayable = Math.max(0, activeSummary.totalLiability - val);
      
      setActiveSummary({
          ...activeSummary,
          itcAvailable: val,
          cashPayable: newCashPayable
      });
  };

  const getDiffValue = (valA: number, valB: number) => {
      const diff = valB - valA;
      if (diff === 0) return { text: 'No change', color: 'text-slate-400 border-slate-100 bg-slate-50', isIncrease: false, isDecrease: false, raw: 0 };
      const prefix = diff > 0 ? '+' : '';
      const color = diff > 0 ? 'text-emerald-700 bg-emerald-50/70 border-emerald-200' : 'text-rose-700 bg-rose-50/70 border-rose-200';
      return {
          text: `${prefix}₹${diff.toLocaleString()}`,
          color,
          isIncrease: diff > 0,
          isDecrease: diff < 0,
          raw: diff
      };
  };

  const getDiffCount = (countA: number, countB: number) => {
      const diff = countB - countA;
      if (diff === 0) return { text: 'No change', color: 'text-slate-400', raw: 0 };
      const prefix = diff > 0 ? '+' : '';
      const color = diff > 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold';
      return {
          text: `${prefix}${diff}`,
          color,
          raw: diff
      };
  };

  const renderWizardStep = () => {
      if (!selectedReturn || !draftData) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto"/> Loading data...</div>;

      switch(wizardStep) {
          case 0: // Data Summary
              return (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                      {/* Left Column - Main Draft / Comparison / Editor */}
                      <div className="lg:col-span-7 space-y-6">
                          {!isComparing ? (
                              <div className="space-y-6">
                                  {isEditingDraft ? (
                                      <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start gap-3 text-amber-900 text-sm shadow-sm animate-in fade-in duration-200">
                                          <Edit size={18} className="shrink-0 mt-0.5 text-amber-600"/>
                                          <div>
                                              <p className="font-semibold">Filing Draft Modification Mode</p>
                                              <p className="text-amber-800 text-xs mt-0.5">
                                                  You are editing return values inline. Recalculations happen automatically. Commit your changes below to lock in a new draft version.
                                              </p>
                                          </div>
                                      </div>
                                  ) : (
                                      <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex justify-between items-center text-blue-800 text-sm shadow-sm">
                                          <div className="flex items-start gap-3">
                                              <RefreshCw className="shrink-0 mt-0.5 text-blue-500" size={18}/>
                                              <p>
                                                  Data auto-drafted from your registers. 
                                                  Last updated: <strong>Just now</strong>.
                                              </p>
                                          </div>
                                          <button 
                                              onClick={() => setIsEditingDraft(true)}
                                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                                          >
                                              <Edit size={12}/> Edit Draft
                                          </button>
                                      </div>
                                  )}

                                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                      <div className="bg-slate-50/70 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
                                          <span className="font-bold text-slate-700 text-sm">Active Return Draft Data</span>
                                          {versions && versions.length > 0 && (
                                              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full font-bold">
                                                  Currently viewing: v{versions[0].summary === activeSummary ? versions[0].version : 'Custom Draft'} {versions[0].summary === activeSummary && ' (Latest)'}
                                              </span>
                                          )}
                                      </div>
                                      <table className="w-full text-sm">
                                          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                                              <tr>
                                                  <th className="px-6 py-4 text-left">Section</th>
                                                  <th className="px-6 py-4 text-center">Count</th>
                                                  <th className="px-6 py-4 text-right">Taxable Value</th>
                                                  {!isEditingDraft && <th className="px-6 py-4 text-right">Action</th>}
                                              </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100">
                                              {(activeSummary || draftData.summary).sections.map((sec: any, i: number) => (
                                                  <tr key={i} className="hover:bg-slate-50/40">
                                                      <td className="px-6 py-4 font-semibold text-slate-800">{sec.label}</td>
                                                      <td className="px-6 py-4 text-center text-slate-600">
                                                          {isEditingDraft ? (
                                                              <input 
                                                                  type="number"
                                                                  value={sec.count}
                                                                  onChange={(e) => handleSectionChange(i, 'count', e.target.value)}
                                                                  className="w-16 px-2 py-1 text-center border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none font-bold text-slate-800"
                                                              />
                                                          ) : (
                                                              sec.count
                                                          )}
                                                      </td>
                                                      <td className="px-6 py-4 text-right font-mono">
                                                          {isEditingDraft ? (
                                                              <div className="inline-flex items-center gap-1 justify-end">
                                                                  <span className="text-slate-400">₹</span>
                                                                  <input 
                                                                      type="number"
                                                                      value={sec.value}
                                                                      onChange={(e) => handleSectionChange(i, 'value', e.target.value)}
                                                                      className="w-28 px-2 py-1 text-right border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none font-bold text-slate-800 font-mono"
                                                                  />
                                                              </div>
                                                          ) : (
                                                              `₹${sec.value.toLocaleString()}`
                                                          )}
                                                      </td>
                                                      {!isEditingDraft && (
                                                          <td className="px-6 py-4 text-right">
                                                              <button className="text-blue-600 hover:underline text-xs font-semibold">View Invoices</button>
                                                          </td>
                                                      )}
                                                  </tr>
                                              ))}
                                          </tbody>
                                          <tfoot className="bg-slate-50 border-t border-slate-200 text-sm font-semibold text-slate-800">
                                              <tr className="border-b border-slate-100">
                                                  <td className="px-6 py-3">Total Tax Liability</td>
                                                  <td className="px-6 py-3 text-center">-</td>
                                                  <td className="px-6 py-3 text-right font-mono">₹{(activeSummary || draftData.summary).totalLiability.toLocaleString()}</td>
                                                  {!isEditingDraft && <td className="px-6 py-3"></td>}
                                              </tr>
                                              <tr className="border-b border-slate-100">
                                                  <td className="px-6 py-3">ITC Offsets (Available credit)</td>
                                                  <td className="px-6 py-3 text-center">-</td>
                                                  <td className="px-6 py-3 text-right font-mono text-emerald-600">
                                                      {isEditingDraft ? (
                                                          <div className="inline-flex items-center gap-1 justify-end">
                                                              <span className="text-slate-400">-₹</span>
                                                              <input 
                                                                  type="number"
                                                                  value={(activeSummary || draftData.summary).itcAvailable}
                                                                  onChange={(e) => handleItcChange(e.target.value)}
                                                                  className="w-28 px-2 py-1 text-right border border-slate-300 rounded text-emerald-600 focus:ring-1 focus:ring-blue-500 outline-none font-bold font-mono"
                                                              />
                                                          </div>
                                                      ) : (
                                                          `-₹${((activeSummary || draftData.summary).itcAvailable || 0).toLocaleString()}`
                                                      )}
                                                  </td>
                                                  {!isEditingDraft && <td className="px-6 py-3"></td>}
                                              </tr>
                                              <tr className="bg-slate-100 font-bold text-slate-900 border-t border-slate-200">
                                                  <td className="px-6 py-4">Net Cash Payable</td>
                                                  <td className="px-6 py-4 text-center">-</td>
                                                  <td className="px-6 py-4 text-right font-mono text-blue-700">₹{(activeSummary || draftData.summary).cashPayable.toLocaleString()}</td>
                                                  {!isEditingDraft && <td className="px-6 py-4"></td>}
                                              </tr>
                                          </tfoot>
                                      </table>
                                  </div>

                                  {/* Editing Actions Panel */}
                                  {isEditingDraft && (
                                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm animate-in slide-in-from-bottom duration-200">
                                          <div className="flex items-center gap-2 text-slate-700 font-bold">
                                              <GitCommit size={18} className="text-blue-600 animate-pulse"/>
                                              <h4>Commit Changes to Version History</h4>
                                          </div>
                                          <p className="text-xs text-slate-500">
                                              Provide a short description explaining why this return adjustment is being made. This is stored securely in the return's version log.
                                          </p>
                                          <div className="space-y-2">
                                              <input 
                                                  type="text"
                                                  placeholder="e.g., Adjusted credit note balances after internal audit validation"
                                                  value={draftChangeSummary}
                                                  onChange={(e) => setDraftChangeSummary(e.target.value)}
                                                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-700"
                                              />
                                          </div>
                                          <div className="flex justify-end gap-3">
                                              <button 
                                                  type="button"
                                                  onClick={() => {
                                                      setIsEditingDraft(false);
                                                      setDraftChangeSummary('');
                                                      if (versions && versions.length > 0) {
                                                          setActiveSummary(versions[0].summary);
                                                      } else {
                                                          setActiveSummary(draftData.summary);
                                                      }
                                                  }}
                                                  className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-100 text-sm font-semibold text-slate-600 transition-colors"
                                              >
                                                  Discard Changes
                                              </button>
                                              <button 
                                                  type="button"
                                                  disabled={isSavingVersion || !draftChangeSummary.trim()}
                                                  onClick={() => {
                                                      if (activeSummary) {
                                                          saveVersion({ status: 'DRAFT', summary: activeSummary, changeSummary: draftChangeSummary });
                                                      }
                                                  }}
                                                  className="px-5 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center gap-2 shadow transition-all active:scale-95"
                                              >
                                                  {isSavingVersion ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                                                  Commit & Save Version
                                              </button>
                                          </div>
                                      </div>
                                  )}
                              </div>
                          ) : (
                              <div className="space-y-6">
                                  <div className="flex justify-between items-center bg-slate-900 text-white p-4 rounded-xl shadow-md">
                                      <div className="flex items-center gap-3">
                                          <GitCompare size={22} className="text-blue-400"/>
                                          <div>
                                              <h3 className="font-bold text-base">Filing Version Comparison</h3>
                                              <p className="text-xs text-slate-300">Comparing return draft records side-by-side</p>
                                          </div>
                                      </div>
                                      <button 
                                          onClick={() => setIsComparing(false)}
                                          className="p-1 hover:bg-white/10 rounded-full transition-colors"
                                          title="Close Comparison"
                                      >
                                          <X size={20}/>
                                      </button>
                                  </div>

                                  {/* Dropdowns to select which versions to compare */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-200 p-4 rounded-xl">
                                      <div className="space-y-1">
                                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Base Version (Before)</label>
                                          <div className="relative">
                                              <select 
                                                  value={compareBaseId || ''} 
                                                  onChange={(e) => setCompareBaseId(e.target.value)}
                                                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none font-semibold text-slate-700"
                                              >
                                                  {versions?.map(v => (
                                                      <option key={v.id} value={v.id}>
                                                          Version v{v.version} — {v.status} ({v.modifiedBy}, {new Date(v.timestamp).toLocaleDateString()})
                                                      </option>
                                                  ))}
                                              </select>
                                              <ChevronDown className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16}/>
                                          </div>
                                      </div>

                                      <div className="space-y-1">
                                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Version (After)</label>
                                          <div className="relative">
                                              <select 
                                                  value={compareTargetId || ''} 
                                                  onChange={(e) => setCompareTargetId(e.target.value)}
                                                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none font-semibold text-slate-700"
                                              >
                                                  {versions?.map(v => (
                                                      <option key={v.id} value={v.id}>
                                                          Version v{v.version} — {v.status} ({v.modifiedBy}, {new Date(v.timestamp).toLocaleDateString()})
                                                      </option>
                                                  ))}
                                              </select>
                                              <ChevronDown className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16}/>
                                          </div>
                                      </div>
                                  </div>

                                  {/* Comparative metrics */}
                                  {(() => {
                                      const baseVerObj = versions?.find(v => v.id === compareBaseId) || versions?.[versions.length - 1];
                                      const targetVerObj = versions?.find(v => v.id === compareTargetId) || versions?.[0];
                                      
                                      if (!baseVerObj || !targetVerObj) return <div className="text-center py-6 text-slate-500">Select versions to compare</div>;

                                      const diffLiability = getDiffValue(baseVerObj.summary.totalLiability, targetVerObj.summary.totalLiability);
                                      const diffItc = getDiffValue(baseVerObj.summary.itcAvailable, targetVerObj.summary.itcAvailable);
                                      const diffCash = getDiffValue(baseVerObj.summary.cashPayable, targetVerObj.summary.cashPayable);

                                      const uniqueLabels = Array.from(new Set([
                                          ...baseVerObj.summary.sections.map(s => s.label),
                                          ...targetVerObj.summary.sections.map(s => s.label)
                                      ]));

                                      return (
                                          <div className="space-y-6">
                                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                  <div className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col justify-between shadow-sm">
                                                      <span className="text-xs font-bold text-slate-500 uppercase">Total Liability</span>
                                                      <div className="my-2 flex flex-col">
                                                          <span className="text-[11px] text-slate-400">v{baseVerObj.version}: <span className="font-mono">₹{baseVerObj.summary.totalLiability.toLocaleString()}</span></span>
                                                          <span className="text-base font-extrabold text-slate-800 font-mono mt-0.5">v{targetVerObj.version}: ₹{targetVerObj.summary.totalLiability.toLocaleString()}</span>
                                                      </div>
                                                      <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold inline-block self-start ${diffLiability.color}`}>
                                                          {diffLiability.text}
                                                      </span>
                                                  </div>

                                                  <div className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col justify-between shadow-sm">
                                                      <span className="text-xs font-bold text-slate-500 uppercase">ITC Offset</span>
                                                      <div className="my-2 flex flex-col">
                                                          <span className="text-[11px] text-slate-400">v{baseVerObj.version}: <span className="font-mono">₹{baseVerObj.summary.itcAvailable.toLocaleString()}</span></span>
                                                          <span className="text-base font-extrabold text-slate-800 font-mono mt-0.5">v{targetVerObj.version}: ₹{targetVerObj.summary.itcAvailable.toLocaleString()}</span>
                                                      </div>
                                                      <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold inline-block self-start ${diffItc.color}`}>
                                                          {diffItc.text}
                                                      </span>
                                                  </div>

                                                  <div className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col justify-between shadow-sm">
                                                      <span className="text-xs font-bold text-slate-500 uppercase">Net Cash Payable</span>
                                                      <div className="my-2 flex flex-col">
                                                          <span className="text-[11px] text-slate-400">v{baseVerObj.version}: <span className="font-mono">₹{baseVerObj.summary.cashPayable.toLocaleString()}</span></span>
                                                          <span className="text-base font-extrabold text-slate-800 font-mono mt-0.5">v{targetVerObj.version}: ₹{targetVerObj.summary.cashPayable.toLocaleString()}</span>
                                                      </div>
                                                      <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold inline-block self-start ${diffCash.color}`}>
                                                          {diffCash.text}
                                                      </span>
                                                  </div>
                                              </div>

                                              {/* Detailed sections diff table */}
                                              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                                  <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 font-bold text-slate-700 text-sm">
                                                      Detailed Section-Level Variance
                                                  </div>
                                                  <table className="w-full text-sm">
                                                      <thead className="bg-slate-100/55 text-slate-500 font-bold border-b border-slate-200 text-xs uppercase">
                                                          <tr>
                                                              <th className="px-5 py-3 text-left">Section</th>
                                                              <th className="px-5 py-3 text-right">Base Version v{baseVerObj.version}</th>
                                                              <th className="px-5 py-3 text-right">Target Version v{targetVerObj.version}</th>
                                                              <th className="px-5 py-3 text-right">Variance / Impact</th>
                                                          </tr>
                                                      </thead>
                                                      <tbody className="divide-y divide-slate-100">
                                                          {uniqueLabels.map((lbl, idx) => {
                                                              const baseSec = baseVerObj.summary.sections.find(s => s.label === lbl) || { label: lbl, count: 0, value: 0 };
                                                              const targetSec = targetVerObj.summary.sections.find(s => s.label === lbl) || { label: lbl, count: 0, value: 0 };
                                                              
                                                              const diffVal = getDiffValue(baseSec.value, targetSec.value);
                                                              const diffCt = getDiffCount(baseSec.count, targetSec.count);

                                                              return (
                                                                  <tr key={idx} className="hover:bg-slate-50/50">
                                                                      <td className="px-5 py-4 font-bold text-slate-800">{lbl}</td>
                                                                      <td className="px-5 py-4 text-right font-mono">
                                                                          <div className="text-slate-800 font-medium">₹{baseSec.value.toLocaleString()}</div>
                                                                          <div className="text-[11px] text-slate-400">Count: {baseSec.count}</div>
                                                                      </td>
                                                                      <td className="px-5 py-4 text-right font-mono">
                                                                          <div className="text-slate-800 font-bold">₹{targetSec.value.toLocaleString()}</div>
                                                                          <div className="text-[11px] text-slate-500">Count: {targetSec.count}</div>
                                                                      </td>
                                                                      <td className="px-5 py-4 text-right font-mono">
                                                                          <div className={`text-xs font-bold ${diffVal.raw > 0 ? 'text-emerald-600' : diffVal.raw < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                                                              {diffVal.text}
                                                                          </div>
                                                                          <div className="text-[11px] text-slate-400">
                                                                              Count: <span className={diffCt.color}>{diffCt.text}</span>
                                                                          </div>
                                                                      </td>
                                                                  </tr>
                                                              );
                                                          })}
                                                      </tbody>
                                                  </table>
                                              </div>
                                          </div>
                                      );
                                  })()}
                              </div>
                          )}
                      </div>

                      {/* Right Column - Version History Controls */}
                      <div className="lg:col-span-5 space-y-6">
                          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm flex flex-col">
                              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                  <div className="flex items-center gap-2 text-slate-800 font-bold">
                                      <History size={18} className="text-slate-500"/>
                                      <h3>Filing Version Log</h3>
                                  </div>
                                  <span className="text-xs text-slate-600 font-bold bg-slate-100 px-2.5 py-1 rounded-full">
                                      {versions?.length || 0} Revisions
                                  </span>
                              </div>

                              {versionFeedback && (
                                  <div className={`p-3 rounded-lg text-xs font-semibold border flex items-center gap-2 animate-in fade-in slide-in-from-top-1 ${
                                      versionFeedback.type === 'SUCCESS' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                                  }`}>
                                      {versionFeedback.type === 'SUCCESS' ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>}
                                      <span>{versionFeedback.message}</span>
                                  </div>
                              )}

                              <div className="overflow-y-auto space-y-3 pr-1 max-h-[500px]">
                                  {isVersionsLoading ? (
                                      <div className="text-center py-12 text-slate-400">
                                          <Loader2 className="animate-spin mx-auto mb-2" size={20}/>
                                          Loading revision history...
                                      </div>
                                  ) : versions && versions.length > 0 ? (
                                      versions.map((v) => {
                                          const isActive = activeSummary && JSON.stringify(activeSummary) === JSON.stringify(v.summary);
                                          
                                          return (
                                              <div 
                                                  key={v.id} 
                                                  className={`p-4 rounded-xl border text-sm transition-all duration-200 relative flex flex-col gap-2 ${
                                                      isActive 
                                                          ? 'bg-blue-50/75 border-blue-300 ring-2 ring-blue-500/10' 
                                                          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                                                  }`}
                                              >
                                                  {/* Header info */}
                                                  <div className="flex justify-between items-start gap-2">
                                                      <div className="flex items-center gap-2">
                                                          <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md ${
                                                              isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                                                          }`}>
                                                              v{v.version}
                                                          </span>
                                                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider uppercase ${
                                                              v.status === 'SUBMITTED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                                              v.status === 'PRE-VALIDATION' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                                              'bg-slate-100 text-slate-600 border border-slate-200'
                                                          }`}>
                                                              {v.status}
                                                          </span>
                                                      </div>
                                                      <span className="text-[10px] text-slate-400 font-medium">
                                                          {new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(v.timestamp).toLocaleDateString()}
                                                      </span>
                                                  </div>

                                                  {/* Author */}
                                                  <div className="text-xs text-slate-500">
                                                      Modified by: <span className="font-semibold text-slate-700">{v.modifiedBy}</span>
                                                  </div>

                                                  {/* Summary Description */}
                                                  <p className="text-xs text-slate-600 font-medium italic bg-slate-50 px-2 py-1.5 rounded border border-slate-100">
                                                      "{v.changeSummary}"
                                                  </p>

                                                  {/* Core metrics peek */}
                                                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[10px] text-slate-500 font-semibold">
                                                      <div>Liability: <span className="font-mono text-slate-700 font-bold">₹{v.summary.totalLiability.toLocaleString()}</span></div>
                                                      <div>Cash: <span className="font-mono text-slate-700 font-bold">₹{v.summary.cashPayable.toLocaleString()}</span></div>
                                                  </div>

                                                  {/* Hover Actions */}
                                                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-1">
                                                      <button
                                                          type="button"
                                                          onClick={() => {
                                                              setCompareBaseId(v.id);
                                                              setCompareTargetId(versions[0].id);
                                                              setIsComparing(true);
                                                          }}
                                                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 transition-all"
                                                          title="Compare this version"
                                                      >
                                                          <GitCompare size={12}/> Compare
                                                      </button>
                                                      
                                                      {!isActive && (
                                                          <button
                                                              type="button"
                                                              disabled={isRevertingVersion}
                                                              onClick={() => revertVersion(v.id)}
                                                              className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs flex items-center gap-1 transition-all disabled:opacity-50"
                                                              title="Restore draft to this version"
                                                          >
                                                              <RotateCcw size={12}/> Restore
                                                          </button>
                                                      )}
                                                  </div>
                                              </div>
                                          );
                                      })
                                  ) : (
                                      <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                                          <GitBranch className="mx-auto mb-2 text-slate-300" size={24}/>
                                          No revision history found.
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                  </div>
              );
          
          case 1: // Validation & Preview
               return (
                  <div className="space-y-8 py-4">
                      <div className="text-center space-y-2">
                           <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                               <FileCheck size={32}/>
                           </div>
                           <h3 className="text-xl font-bold text-slate-800">Validation Successful</h3>
                           <p className="text-slate-500 max-w-md mx-auto">
                               Your return data has been validated against the GST portal rules. No errors found.
                           </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                          <button className="flex items-center justify-center gap-2 p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors group">
                              <div className="bg-slate-100 p-2 rounded-lg group-hover:bg-white transition-colors">
                                <Eye size={20} className="text-slate-600"/>
                              </div>
                              <span className="font-medium text-slate-700">Preview Draft JSON</span>
                          </button>
                          <button className="flex items-center justify-center gap-2 p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors group">
                              <div className="bg-slate-100 p-2 rounded-lg group-hover:bg-white transition-colors">
                                <FileText size={20} className="text-slate-600"/>
                              </div>
                              <span className="font-medium text-slate-700">Download Summary PDF</span>
                          </button>
                      </div>

                      <div className="flex items-center gap-3 p-4 bg-amber-50 text-amber-800 rounded-lg text-sm border border-amber-200 max-w-2xl mx-auto">
                           <AlertCircle size={20} className="shrink-0"/>
                           <p>Please review the preview carefully. Once filed, {selectedReturn.type} cannot be revised for the same period.</p>
                      </div>
                  </div>
               );

          case 2: // E-Verification
              return (
                  <div className="py-6 max-w-md mx-auto space-y-6">
                      <div className="text-center">
                          <div className="inline-flex p-3 bg-blue-50 text-blue-600 rounded-full mb-4">
                              <Lock size={24}/>
                          </div>
                          <h3 className="text-xl font-bold text-slate-800">E-Verification</h3>
                          <p className="text-slate-500 text-sm mt-1">
                              Enter the OTP sent to registered mobile number ending with <strong>*******8821</strong>
                          </p>
                      </div>

                      <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">One Time Password</label>
                          <input 
                              type="text" 
                              value={otp}
                              onChange={(e) => setOtp(e.target.value)}
                              placeholder="Enter 6-digit OTP" 
                              className="w-full text-center text-2xl tracking-[0.5em] p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                              maxLength={6}
                          />
                      </div>

                      <div className="flex justify-between items-center text-sm">
                           <span className="text-slate-500">Didn't receive code?</span>
                           <button className="text-blue-600 font-medium hover:underline">Resend OTP</button>
                      </div>
                  </div>
              );

          case 4: // Success
              return (
                  <div className="py-12 text-center space-y-6 animate-in zoom-in duration-300">
                      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600 mb-2">
                          <Check size={40} strokeWidth={3} />
                      </div>
                      <div>
                          <h2 className="text-2xl font-bold text-slate-800">Filing Successful!</h2>
                          <p className="text-slate-500 mt-1">Your return for {selectedReturn.period} has been successfully filed.</p>
                      </div>
                      
                      <div className="bg-slate-50 inline-block px-6 py-4 rounded-xl border border-slate-200 text-left min-w-[300px]">
                          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">ARN (Ack. Ref. Number)</div>
                          <div className="text-xl font-mono font-bold text-slate-800 tracking-wide select-all">
                              {filings?.find(f => f.id === selectedReturn.id)?.arn || 'Generating...'}
                          </div>
                      </div>

                      <div className="flex justify-center gap-4 pt-4">
                          <button 
                            onClick={handleCloseWizard}
                            className="px-6 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
                          >
                              Back to Dashboard
                          </button>
                          <button className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 shadow-sm">
                              <Download size={18}/> Download Receipt
                          </button>
                      </div>
                  </div>
              );

          default: return null;
      }
  };

  const steps = ['Data Summary', 'Validation', 'E-Verify'];

  return (
    <div className="max-w-6xl mx-auto">
        {!selectedReturn ? renderDashboard() : selectedReturn.type === 'GSTR-1' ? (
            <Gstr1Wizard 
                selectedReturn={selectedReturn} 
                onClose={handleCloseWizard} 
                tenantId={tenantId} 
                user={user as any}
                onFilingSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['filings', tenantId] });
                }}
            />
        ) : (
            <OtherReturnsWizard 
                selectedReturn={selectedReturn} 
                onClose={handleCloseWizard} 
                tenantId={tenantId} 
                user={user as any}
                onFilingSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['filings', tenantId] });
                }}
            />
        )}

        {/* Automated GST Return Filing Wizard */}
        {isAutomatedWizardOpen && (
            <AutomatedGstFilingWizard 
                isOpen={isAutomatedWizardOpen}
                onClose={() => setIsAutomatedWizardOpen(false)}
                tenantId={tenantId}
                user={user as any}
                currentTenant={user?.availableTenants.find(t => t.id === tenantId)}
                initialPeriod={wizardPeriod}
                onFilingSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['filings', tenantId] });
                }}
            />
        )}

        {/* Multi-Step Guided GST Return Filing Wizard (GSTR-1 & GSTR-3B) */}
        {isGstFilingWizardOpen && (
            <GstReturnFilingWizard
                isOpen={isGstFilingWizardOpen}
                onClose={() => {
                    setIsGstFilingWizardOpen(false);
                    setGstFilingWizardReturn(null);
                }}
                initialReturn={gstFilingWizardReturn}
                initialFormType={gstFilingWizardType}
                initialPeriod={gstFilingWizardPeriod}
                initialGstin={user?.availableTenants?.find(t => t.id === tenantId)?.gstin || '27ABCDE1234F1Z5'}
                tenantId={tenantId}
                user={user as any}
                currentTenant={user?.availableTenants.find(t => t.id === tenantId)}
                onFilingSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['filings', tenantId] });
                }}
            />
        )}
        {/* WhatsApp Filing Status Modal */}
        {whatsAppFilingRecord && (
            <SendFilingStatusWhatsAppModal
                isOpen={!!whatsAppFilingRecord}
                onClose={() => setWhatsAppFilingRecord(null)}
                filing={{
                    returnType: whatsAppFilingRecord.type,
                    period: whatsAppFilingRecord.period,
                    status: whatsAppFilingRecord.status,
                    arn: whatsAppFilingRecord.arn,
                    filedDate: whatsAppFilingRecord.filedDate,
                    taxLiability: whatsAppFilingRecord.taxLiability,
                    recipientPhone: '+919876543210',
                    clientName: user?.availableTenants.find(t => t.id === tenantId)?.name || 'Acme Industrial Corp',
                    recipientGstin: user?.availableTenants.find(t => t.id === tenantId)?.gstin || '27ABCDE1234F1Z5'
                }}
                onSuccess={() => {
                    setWhatsAppFilingRecord(null);
                }}
            />
        )}

        {/* Branch Manager & Cost Center Allocation Modal */}
        {isBranchManagerOpen && (
            <BranchManagerModal
                isOpen={isBranchManagerOpen}
                onClose={() => setIsBranchManagerOpen(false)}
                tenantId={tenantId}
                initialTab="FILINGS"
            />
        )}
    </div>
  );
};

export default Filing;