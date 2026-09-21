import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { 
  ShieldCheck, FileText, Calendar, Bell, ShieldAlert, CheckCircle2,
  AlertCircle, ChevronRight, RefreshCw, Layers, ArrowUpRight, Check, Play,
  Settings, History, Info, BookOpen, User, Sparkles, Clock, Globe
} from 'lucide-react';
import { RegulatoryDeadlineTimeline } from './RegulatoryDeadlineTimeline';
import { GlobalTaxRatesLookup } from './GlobalTaxRatesLookup';

interface LifecycleStage {
  name: 'GOVT_CHANGE' | 'RECORD_CREATED' | 'IMPACT_ANALYSIS' | 'RULE_UPDATE' | 'AUTOMATED_TESTS' | 'SANDBOX_VALIDATION' | 'REGRESSION_TESTING' | 'UAT' | 'PRODUCTION_RELEASE';
  label: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'FAILED';
  description: string;
  completedAt?: string;
  completedBy?: string;
}

interface RegulatoryChange {
  id: string;
  title: string;
  category: 'NOTIFICATION' | 'CIRCULAR' | 'ADVISORY' | 'RATE_CHANGE' | 'HSN_CHANGE' | 'VALIDATION_CHANGE' | 'FILING_CHANGE';
  source: string;
  effectiveDate: string;
  ruleVersion: string;
  description: string;
  status: 'PENDING' | 'APPLIED';
  impactScore: 'HIGH' | 'MEDIUM' | 'LOW';
  impactAnalysis: string;
  lifecycle: LifecycleStage[];
  ruleChangePayload: {
    einvoiceThreshold?: number;
    blockedItcKeywords?: string[];
    hsnRateOverrides?: { [hsn: string]: number };
    dueDateExtensions?: { [returnType: string]: string };
  };
  comparison?: {
    previous: {
      title: string;
      details: Array<{ key: string; value: string }>;
    };
    updated: {
      title: string;
      details: Array<{ key: string; value: string }>;
    };
  };
  appliedAt?: string;
  appliedBy?: string;
}

interface RegulatoryConfig {
  einvoiceThreshold: number;
  blockedItcKeywords: string[];
  hsnRateOverrides: { [hsn: string]: number };
  dueDateExtensions: { [returnType: string]: string };
}

export const RegulatoryChangeModule: React.FC = () => {
  const queryClient = useQueryClient();
  const user = useSelector((state: RootState) => state.auth.user);
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'BOARD' | 'LIVE_RULES' | 'TIMELINE' | 'AUDIT_TRAIL' | 'GLOBAL_RATES'>('BOARD');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // AI Predictive Impact Analysis State
  const [turnover, setTurnover] = useState<string>('65000000'); // ₹6.5 Crores
  const [purchases, setPurchases] = useState<string>('Solar Components, Sustainable Sourcing, Electrical Inverters');
  const [itcMonthly, setItcMonthly] = useState<string>('250000');
  const [taxLiability, setTaxLiability] = useState<string>('400000');
  const [isCustomizingProfile, setIsCustomizingProfile] = useState<boolean>(false);
  const [isAnalyzingImpact, setIsAnalyzingImpact] = useState<boolean>(false);
  const [impactResult, setImpactResult] = useState<any | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Reactive clean-up on circular selection shift
  React.useEffect(() => {
    setImpactResult(null);
    setAnalysisError(null);
    setIsAnalyzingImpact(false);
  }, [selectedChangeId]);

  const handleAnalyzePredictiveImpact = async (changeRecord: RegulatoryChange) => {
    setIsAnalyzingImpact(true);
    setAnalysisError(null);
    setImpactResult(null);

    try {
      const purchaseList = purchases.split(',').map(p => p.trim()).filter(Boolean);
      const res = await fetch('/api/ai/predictive-impact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          turnover: Number(turnover),
          purchases: purchaseList,
          itcMonthly: Number(itcMonthly),
          taxLiability: Number(taxLiability),
          hsnProfile: ['8504', '8541'], // Solar/Electrical cells
          rule: changeRecord
        })
      });

      if (!res.ok) {
        throw new Error('Predictive analysis engine responded with an error status.');
      }

      const data = await res.json();
      setImpactResult(data);
    } catch (err: any) {
      console.error(err);
      setAnalysisError(err.message || 'An unexpected error occurred during impact estimation.');
    } finally {
      setIsAnalyzingImpact(false);
    }
  };

  // Fetch Regulatory Changes
  const { data: changesData, isLoading: changesLoading } = useQuery({
    queryKey: ['regulatoryChanges'],
    queryFn: async () => {
      const res = await fetch('/api/v1/compliance/regulatory/changes');
      if (!res.ok) throw new Error('Failed to fetch regulatory changes');
      const data = await res.json();
      return data.changes as RegulatoryChange[];
    }
  });

  // Fetch Live Active Rules Configuration
  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ['regulatoryConfig'],
    queryFn: async () => {
      const res = await fetch('/api/v1/compliance/regulatory/config');
      if (!res.ok) throw new Error('Failed to fetch regulatory config');
      const data = await res.json();
      return data.config as RegulatoryConfig;
    }
  });

  // Mutation to Apply Regulatory Patch
  const applyPatchMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch('/api/v1/compliance/regulatory/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          userId: user?.id || 'sys-admin',
          userName: user?.name || 'Compliance Officer'
        })
      });
      if (!res.ok) throw new Error('Failed to apply regulatory patch');
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['regulatoryChanges'] });
      queryClient.invalidateQueries({ queryKey: ['regulatoryConfig'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
      
      const patch = changesData?.find(c => c.id === variables);
      setToastMessage(`🎉 Regulatory Patch for "${patch?.title}" successfully implemented! Dynamic tax rules have been hot-reloaded.`);
      setTimeout(() => setToastMessage(null), 6000);

      // Automated dispatch of Slack Notification Alert
      const savedWebhook = localStorage.getItem('taxflow_slack_webhook_url');
      const savedEnabled = localStorage.getItem('taxflow_slack_events_enabled');
      if (savedWebhook && savedEnabled !== 'false' && patch) {
        fetch('/api/v1/compliance/slack/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhookUrl: savedWebhook,
            event: {
              title: `Statutory Rule Deployed: ${patch.title}`,
              description: `A regulatory intelligence compliance patch has been successfully deployed and live-reloaded into production. Description: ${patch.description}`,
              category: patch.category,
              impactScore: patch.impactScore,
              effectiveDate: patch.effectiveDate,
              ruleVersion: patch.ruleVersion || 'v1.0.0',
              source: patch.source
            }
          })
        }).catch(err => console.error('Slack auto-dispatch error:', err));
      }
    }
  });

  if (changesLoading || configLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-500">
        <RefreshCw className="animate-spin mr-2" /> Loading statutory regulations and tax parameters...
      </div>
    );
  }

  const changes = changesData || [];
  const activeConfig = configData;
  const selectedChange = changes.find(c => c.id === selectedChangeId) || changes[0];

  const pendingCount = changes.filter(c => c.status === 'PENDING').length;
  const appliedCount = changes.filter(c => c.status === 'APPLIED').length;

  const getImpactBadgeColor = (score: string) => {
    switch (score) {
      case 'HIGH': return 'bg-red-50 text-red-700 border-red-200';
      case 'MEDIUM': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'LOW': return 'bg-sky-50 text-sky-700 border-sky-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'NOTIFICATION': return 'CBIC Official Notification';
      case 'CIRCULAR': return 'Statutory Circular';
      case 'ADVISORY': return 'GSTN Council Advisory';
      case 'RATE_CHANGE': return 'GST Rate Amendment';
      case 'HSN_CHANGE': return 'HSN/SAC Classification Update';
      case 'VALIDATION_CHANGE': return 'IRP/API Validation Update';
      case 'FILING_CHANGE': return 'Portal Filing Schedule Extension';
      default: return cat;
    }
  };

  const handleApplyPatch = (id: string) => {
    applyPatchMutation.mutate(id);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      
      {/* Dynamic Toast Feedback banner */}
      {toastMessage && (
        <div className="bg-emerald-50 border-2 border-emerald-300 text-emerald-800 px-4 py-3 rounded-xl flex items-start gap-3 shadow-md animate-in fade-in slide-in-from-top-4 duration-500">
          <Sparkles className="text-emerald-600 mt-0.5 shrink-0" size={20} />
          <div>
            <span className="font-extrabold text-sm block">Compliance Engine Patched Successfully</span>
            <span className="text-xs font-semibold">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header and Statistics */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <ShieldCheck className="text-indigo-600" size={22} /> GST Regulatory Change Management
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Stay aligned with current GST Council notifications, review operational impact, and hot-reload active audit engine validation rules.
          </p>
        </div>

        {/* Counts indicators */}
        <div className="flex items-center gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-1.5 text-center">
            <span className="text-[10px] font-bold text-amber-600 block uppercase tracking-wider">Unapplied changes</span>
            <span className="text-sm font-extrabold text-amber-700">{pendingCount} Actionable</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-1.5 text-center">
            <span className="text-[10px] font-bold text-emerald-600 block uppercase tracking-wider">Active statutory rules</span>
            <span className="text-sm font-extrabold text-emerald-700">{appliedCount} Applied</span>
          </div>
        </div>
      </div>

      {/* Sub tabs Navigation */}
      <div className="flex bg-slate-100 p-1 rounded-xl max-w-xl overflow-x-auto whitespace-nowrap">
        <button 
          onClick={() => setActiveTab('BOARD')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'BOARD' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen size={14} /> Regulatory board
        </button>
        <button 
          onClick={() => setActiveTab('LIVE_RULES')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'LIVE_RULES' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings size={14} /> Active compliance parameters
        </button>
        <button 
          onClick={() => setActiveTab('TIMELINE')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'TIMELINE' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock size={14} /> Compliance timeline
        </button>
        <button 
          onClick={() => setActiveTab('AUDIT_TRAIL')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'AUDIT_TRAIL' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History size={14} /> System patch ledger
        </button>
        <button 
          onClick={() => setActiveTab('GLOBAL_RATES')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'GLOBAL_RATES' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Globe size={14} /> Global Tax Rates
        </button>
      </div>

      {/* TAB 1: REGULATORY BOARD */}
      {activeTab === 'BOARD' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          
          {/* Left panel: list of updates */}
          <div className="lg:col-span-2 space-y-3 max-h-[500px] overflow-y-auto pr-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Statutory Notifications Timeline</div>
            {changes.map((item) => {
              const isSelected = selectedChange?.id === item.id;
              return (
                <div 
                  key={item.id}
                  onClick={() => setSelectedChangeId(item.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-indigo-600 bg-indigo-50/10 shadow-sm' 
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                      item.status === 'APPLIED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {item.status === 'APPLIED' ? 'Applied' : 'Pending Action'}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${getImpactBadgeColor(item.impactScore)}`}>
                      {item.impactScore} Impact
                    </span>
                  </div>

                  <h4 className="text-xs font-extrabold text-slate-800 line-clamp-2">{item.title}</h4>
                  
                  <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                    <span>{item.source.split(' ')[0]} {item.source.split(' ').slice(-1)}</span>
                    <span className="flex items-center gap-1 font-mono"><Calendar size={10}/> {item.effectiveDate}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right panel: detail of selected update */}
          <div className="lg:col-span-3 border border-slate-200 rounded-xl p-5 bg-slate-50/30 flex flex-col justify-between">
            {selectedChange ? (
              <div className="space-y-5">
                
                {/* Notification context */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider">
                      {getCategoryLabel(selectedChange.category)}
                    </span>
                    <span className="text-slate-300">&bull;</span>
                    <span className="text-xs font-bold text-slate-500 font-mono">{selectedChange.source}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{selectedChange.title}</h3>
                </div>

                {/* Description and Date */}
                <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Info size={14} className="text-slate-400" /> CBIC Executive Summary
                  </h4>
                  <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                    {selectedChange.description}
                  </p>
                  <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Effective Date:</span>
                    <span className="font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{selectedChange.effectiveDate}</span>
                  </div>
                </div>

                {/* Impact Analysis Scan */}
                <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-4 space-y-2.5">
                  <h4 className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                    <ShieldAlert size={14} className="text-amber-600" /> Operational Impact scan
                  </h4>
                  <p className="text-xs text-amber-950 font-semibold leading-relaxed">
                    {selectedChange.impactAnalysis}
                  </p>
                </div>

                {/* Side-by-Side Comparison view for HSN or Validation change records */}
                {selectedChange.comparison && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[11px] font-black text-slate-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <Layers size={13} className="text-indigo-600" />
                        Rule Comparison Schema (Before vs After)
                      </span>
                      <span className="bg-indigo-100 text-indigo-800 text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                        {selectedChange.category === 'HSN_CHANGE' ? 'HSN Revision' : 'Validation Delta'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: Previous Rule */}
                      <div className="bg-rose-50/30 border border-rose-100 rounded-2xl p-4 space-y-3 shadow-sm">
                        <div className="flex items-center gap-2 border-b border-rose-100/50 pb-2">
                          <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
                            <AlertCircle size={14} />
                          </div>
                          <div>
                            <h5 className="text-[11px] font-extrabold text-rose-900 uppercase tracking-wide">Previous Rule</h5>
                            <p className="text-[10px] text-rose-700 font-semibold truncate max-w-[200px]">
                              {selectedChange.comparison.previous.title}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {selectedChange.comparison.previous.details.map((detail, index) => (
                            <div key={index} className="flex justify-between items-center gap-1 text-[11px] border-b border-rose-100/30 pb-1.5 last:border-0 last:pb-0">
                              <span className="text-slate-500 font-bold">{detail.key}</span>
                              <span className="font-mono text-[11px] text-rose-700 bg-rose-100/50 px-2 py-0.5 rounded-md font-semibold text-right">
                                {detail.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right: Updated Rule */}
                      <div className="bg-emerald-50/30 border border-emerald-100 rounded-2xl p-4 space-y-3 shadow-sm">
                        <div className="flex items-center gap-2 border-b border-emerald-100/50 pb-2">
                          <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                            <CheckCircle2 size={14} />
                          </div>
                          <div>
                            <h5 className="text-[11px] font-extrabold text-emerald-900 uppercase tracking-wide">Updated Rule</h5>
                            <p className="text-[10px] text-emerald-700 font-semibold truncate max-w-[200px]">
                              {selectedChange.comparison.updated.title}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {selectedChange.comparison.updated.details.map((detail, index) => (
                            <div key={index} className="flex justify-between items-center gap-1 text-[11px] border-b border-emerald-100/30 pb-1.5 last:border-0 last:pb-0">
                              <span className="text-slate-600 font-bold">{detail.key}</span>
                              <span className="font-mono text-[11px] text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md font-bold text-right">
                                {detail.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI-Powered Predictive Impact Simulator */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                        <Sparkles size={16} className="text-indigo-600 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                          AI Predictive Impact Simulator
                        </h4>
                        <p className="text-[10px] text-slate-500 font-semibold">
                          Estimate corporate financial liability change before deployment
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCustomizingProfile(!isCustomizingProfile)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <Settings size={12} />
                      {isCustomizingProfile ? 'Hide Profile' : 'Configure Profile'}
                    </button>
                  </div>

                  {/* Profile Form (collapsible) */}
                  {isCustomizingProfile && (
                    <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 text-left">
                      <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                        Corporate Profile & Simulation Parameters
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">
                            Annual Turnover (INR)
                          </label>
                          <input
                            type="number"
                            value={turnover}
                            onChange={(e) => setTurnover(e.target.value)}
                            placeholder="e.g. 65000000"
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">
                            Monthly Tax Liability (INR)
                          </label>
                          <input
                            type="number"
                            value={taxLiability}
                            onChange={(e) => setTaxLiability(e.target.value)}
                            placeholder="e.g. 400000"
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">
                            Monthly ITC Pool (INR)
                          </label>
                          <input
                            type="number"
                            value={itcMonthly}
                            onChange={(e) => setItcMonthly(e.target.value)}
                            placeholder="e.g. 250000"
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">
                            Key Purchase Profiles
                          </label>
                          <input
                            type="text"
                            value={purchases}
                            onChange={(e) => setPurchases(e.target.value)}
                            placeholder="e.g. Solar panels, Electric components"
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Trigger Action */}
                  {!impactResult && !isAnalyzingImpact && (
                    <button
                      type="button"
                      onClick={() => handleAnalyzePredictiveImpact(selectedChange)}
                      className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 hover:text-indigo-900 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                    >
                      <Sparkles size={13} className="text-indigo-600 animate-bounce" />
                      Run AI Predictive Liability Analysis
                    </button>
                  )}

                  {/* Loading State */}
                  {isAnalyzingImpact && (
                    <div className="bg-white border border-slate-200/60 rounded-xl p-5 text-center space-y-3.5 shadow-inner">
                      <RefreshCw className="animate-spin text-indigo-600 mx-auto" size={24} />
                      <div className="space-y-1">
                        <div className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                          AI Financial Simulation Running
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold animate-pulse">
                          Scanning tax circulars, computing ITC differentials, and estimating working capital offsets...
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Error State */}
                  {analysisError && (
                    <div className="bg-red-50 border border-red-100 text-red-800 rounded-xl p-3.5 flex items-start gap-2.5 text-xs">
                      <AlertCircle className="text-red-500 shrink-0" size={16} />
                      <div className="space-y-1">
                        <div className="font-extrabold text-red-900 uppercase">Analysis Engine Offline</div>
                        <p className="text-[11px] text-red-700 leading-relaxed font-medium">{analysisError}</p>
                      </div>
                    </div>
                  )}

                  {/* Analysis Output Dashboard */}
                  {impactResult && (
                    <div className="bg-white border border-indigo-100 rounded-2xl p-4 space-y-4 text-left shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            SIMULATED FINANCIAL FORECAST
                          </span>
                        </div>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wide ${
                          impactResult.impactSeverity === 'HIGH' 
                            ? 'bg-rose-100 text-rose-800' 
                            : impactResult.impactSeverity === 'MEDIUM' 
                              ? 'bg-amber-100 text-amber-800' 
                              : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {impactResult.impactSeverity} SEVERITY RISK
                        </span>
                      </div>

                      {/* Main KPI blocks */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1">
                          <span className="text-[9px] font-extrabold text-slate-400 uppercase">
                            Monthly Cash Outflow Change
                          </span>
                          <div className="flex items-baseline gap-1">
                            <span className={`text-lg font-black tracking-tight ${
                              impactResult.estimatedMonthlyImpactInr > 0 
                                ? 'text-rose-600' 
                                : impactResult.estimatedMonthlyImpactInr < 0 
                                  ? 'text-emerald-600' 
                                  : 'text-slate-600'
                            }`}>
                              {impactResult.estimatedMonthlyImpactInr > 0 ? '+' : ''}
                              ₹{impactResult.estimatedMonthlyImpactInr.toLocaleString('en-IN')}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">/ month</span>
                          </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1">
                          <span className="text-[9px] font-extrabold text-slate-400 uppercase">
                            Estimated Tax Liability Delta
                          </span>
                          <div className="flex items-baseline gap-1">
                            <span className={`text-lg font-black tracking-tight ${
                              impactResult.financialDeltaPercent > 0 
                                ? 'text-rose-600' 
                                : impactResult.financialDeltaPercent < 0 
                                  ? 'text-emerald-600' 
                                  : 'text-slate-600'
                            }`}>
                              {impactResult.financialDeltaPercent > 0 ? '+' : ''}
                              {impactResult.financialDeltaPercent}%
                            </span>
                            <span className={`text-[9px] font-extrabold font-mono uppercase ${
                              impactResult.liabilityTrend === 'INCREASE' 
                                ? 'text-rose-500' 
                                : impactResult.liabilityTrend === 'DECREASE' 
                                  ? 'text-emerald-500' 
                                  : 'text-slate-500'
                            }`}>
                              {impactResult.liabilityTrend}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Justification summary */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase">
                          Executive Analysis
                        </span>
                        <p className="text-[11px] text-slate-700 font-medium leading-relaxed bg-indigo-50/20 border border-indigo-50 rounded-xl p-3">
                          {impactResult.justification}
                        </p>
                      </div>

                      {/* Risk Drivers */}
                      {impactResult.riskDrivers && impactResult.riskDrivers.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase">
                            Primary Risk Drivers Detected
                          </span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {impactResult.riskDrivers.map((driver: any, idx: number) => (
                              <div key={idx} className="border border-slate-150 rounded-xl p-3 space-y-1.5 text-left">
                                <div className="flex items-center justify-between">
                                  <h5 className="text-[10px] font-extrabold text-slate-900 uppercase">
                                    {driver.title}
                                  </h5>
                                  <span className="bg-slate-100 text-slate-600 text-[8px] font-black px-1.5 py-0.5 rounded font-mono">
                                    {driver.mitigationTimeDays}d SLA
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-normal font-semibold">
                                  {driver.description}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Strategic Advisories */}
                      {impactResult.strategicAdvisories && impactResult.strategicAdvisories.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase">
                            Strategic Advisory Action Roadmap
                          </span>
                          <div className="space-y-2">
                            {impactResult.strategicAdvisories.map((adv: any, idx: number) => (
                              <div key={idx} className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 flex items-start gap-2.5 text-left">
                                <div className="p-1 bg-white border border-slate-100 rounded-lg text-indigo-600 shrink-0 mt-0.5 font-bold text-[9px] font-mono w-5 h-5 flex items-center justify-center">
                                  {idx + 1}
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h5 className="text-[11px] font-extrabold text-slate-800 uppercase">
                                      {adv.step}
                                    </h5>
                                    <span className={`text-[7px] font-black px-1.5 py-0.2 rounded uppercase ${
                                      adv.priority === 'HIGH' 
                                        ? 'bg-rose-100 text-rose-800' 
                                        : adv.priority === 'MEDIUM' 
                                          ? 'bg-amber-100 text-amber-800' 
                                          : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                      {adv.priority} priority
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 leading-normal font-semibold">
                                    {adv.actionableDetail}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Re-simulate Button */}
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => handleAnalyzePredictiveImpact(selectedChange)}
                          disabled={isAnalyzingImpact}
                          className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-1.5 transition-all"
                        >
                          <RefreshCw size={10} className={isAnalyzingImpact ? 'animate-spin' : ''} />
                          Re-simulate
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Rule Change Payload Diff */}
                <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-[10px] space-y-2.5">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 border-b border-slate-800 pb-2">
                    <span>TAX RULE ENGINE DIFF (SCHEMA MODIFICATION)</span>
                    <span className="text-yellow-400 font-bold uppercase">JSON schema patch</span>
                  </div>
                  <div className="space-y-1.5 overflow-x-auto">
                    {selectedChange.ruleChangePayload.einvoiceThreshold !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">- threshold_limit: 5</span>
                        <span className="text-emerald-400">+ threshold_limit: {selectedChange.ruleChangePayload.einvoiceThreshold} (₹ Crores)</span>
                      </div>
                    )}
                    {selectedChange.ruleChangePayload.blockedItcKeywords !== undefined && (
                      <div>
                        <span className="text-slate-400">Appending restricted keywords to Section 17(5) validation register:</span>
                        <div className="pl-3 text-emerald-400 mt-1">
                          {selectedChange.ruleChangePayload.blockedItcKeywords.map(kw => `+ "${kw}"`).join('\n')}
                        </div>
                      </div>
                    )}
                    {selectedChange.ruleChangePayload.hsnRateOverrides !== undefined && (
                      <div>
                        <span className="text-slate-400">Updating active HSN Tax Rates:</span>
                        <div className="pl-3 text-emerald-400 mt-1">
                          {Object.entries(selectedChange.ruleChangePayload.hsnRateOverrides).map(([hsn, rate]) => (
                            `+ HSN ${hsn} Rate override -> ${rate}%`
                          )).join('\n')}
                        </div>
                      </div>
                    )}
                    {selectedChange.ruleChangePayload.dueDateExtensions !== undefined && (
                      <div>
                        <span className="text-slate-400">Modifying statutory timeline thresholds:</span>
                        <div className="pl-3 text-emerald-400 mt-1">
                          {Object.entries(selectedChange.ruleChangePayload.dueDateExtensions).map(([ret, date]) => (
                            `+ ${ret} target date override -> "${date}"`
                          )).join('\n')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Visual Change Lifecycle Tracker */}
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 space-y-4">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                    <span className="flex items-center gap-1.5"><History size={12} className="text-indigo-600" /> Compliance Change Lifecycle Tracing</span>
                    <span className="text-indigo-600 font-mono font-bold">Rule Version: {selectedChange.ruleVersion || 'v1.0.0'}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-[220px] overflow-y-auto pr-1">
                    {selectedChange.lifecycle?.map((stage, idx) => {
                      const isCompleted = stage.status === 'COMPLETED';
                      const isInProgress = stage.status === 'IN_PROGRESS';

                      return (
                        <div 
                          key={stage.name} 
                          className={`p-2.5 rounded-lg border text-left transition-all ${
                            isCompleted 
                              ? 'bg-emerald-50/30 border-emerald-100' 
                              : isInProgress 
                                ? 'bg-amber-50/40 border-amber-200 ring-2 ring-amber-100' 
                                : 'bg-slate-50/50 border-slate-200/60 opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] font-bold text-slate-400 font-mono">0{idx + 1}</span>
                            <span className={`text-[8px] font-black px-1.5 py-0.2 rounded uppercase ${
                              isCompleted 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : isInProgress 
                                  ? 'bg-amber-100 text-amber-800' 
                                  : 'bg-slate-200 text-slate-600'
                            }`}>
                              {stage.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="text-[11px] font-bold text-slate-800 line-clamp-1">{stage.label}</div>
                          <div className="text-[9px] text-slate-500 line-clamp-1 mt-0.5 leading-tight">{stage.description}</div>
                          {stage.completedAt && (
                            <div className="text-[8px] text-slate-400 font-mono font-semibold mt-1">Completed: {stage.completedAt}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Apply Control Button */}
                <div className="pt-2">
                  {selectedChange.status === 'APPLIED' ? (
                    <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl px-4 py-3 flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-1.5"><CheckCircle2 className="text-emerald-600" size={16}/> Statutory Patch Implemented</span>
                      <span className="text-slate-500 font-normal">Applied by: {selectedChange.appliedBy}</span>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleApplyPatch(selectedChange.id)}
                      disabled={applyPatchMutation.isPending}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                    >
                      {applyPatchMutation.isPending ? (
                        <>
                          <RefreshCw className="animate-spin" size={16} /> Recompiling core rule systems...
                        </>
                      ) : (
                        <>
                          <Play size={16} className="fill-current" /> Deploy compliance patch & hot-reload rules
                        </>
                      )}
                    </button>
                  )}
                </div>

              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">Select a regulatory update from the board.</div>
            )}
          </div>

        </div>
      )}

      {/* TAB 2: LIVE RULES PARAMETERS */}
      {activeTab === 'LIVE_RULES' && activeConfig && (
        <div className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
            <Info className="text-indigo-600 shrink-0 mt-0.5" size={18} />
            <p className="text-xs text-slate-600 font-semibold leading-relaxed">
              These are the current active statutory compliance parameters evaluated by the <strong>GSTRuleEngine</strong>. 
              Applying regulatory patches above adds keywords, overrides rates, or shifts thresholds instantly without code recompilation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* Box 1: E-Invoice Threshold */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">E-Invoicing limit</span>
              <span className="text-xl font-extrabold text-slate-900">₹{activeConfig.einvoiceThreshold} Crores</span>
              <span className="text-[10px] text-slate-500 block font-medium">Aggregate corporate turnover threshold.</span>
            </div>

            {/* Box 2: Blocked ITC Keywords */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Blocked ITC Keywords</span>
              <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto">
                {activeConfig.blockedItcKeywords.map((kw, i) => (
                  <span key={i} className="text-[10px] font-bold bg-red-50 text-red-700 border border-red-100 px-1.5 py-0.5 rounded">
                    {kw}
                  </span>
                ))}
              </div>
              <span className="text-[10px] text-slate-400 block font-semibold pt-1">Parsed under Section 17(5).</span>
            </div>

            {/* Box 3: HSN Rate Overrides */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">HSN Rate Overrides</span>
              <div className="space-y-1 text-xs font-semibold max-h-[80px] overflow-y-auto">
                {Object.entries(activeConfig.hsnRateOverrides).map(([hsn, rate]) => (
                  <div key={hsn} className="flex justify-between border-b border-slate-50 pb-1">
                    <span className="font-mono text-slate-500">HSN {hsn}</span>
                    <span className="text-slate-900 font-bold">{rate}% Override</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Box 4: Due Dates */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Due dates targets</span>
              <div className="space-y-1 text-xs font-semibold">
                {Object.entries(activeConfig.dueDateExtensions).map(([ret, date]) => (
                  <div key={ret} className="flex justify-between border-b border-slate-50 pb-1">
                    <span className="text-slate-500">{ret}</span>
                    <span className="text-slate-900 font-bold truncate max-w-[120px]" title={date}>{date}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 3: VISUAL TIMELINE */}
      {activeTab === 'TIMELINE' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Clock className="text-indigo-600" size={16} /> Statutory Compliance & Regulatory Event Stream (FY 2026-27)
            </h4>
            <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold font-mono">
              Current Period: August 2026
            </span>
          </div>
          <RegulatoryDeadlineTimeline dynamicChanges={changes} />
        </div>
      )}

      {/* TAB 5: GLOBAL TAX RATES */}
      {activeTab === 'GLOBAL_RATES' && (
        <GlobalTaxRatesLookup />
      )}
      
      {/* TAB 4: SYSTEM PATCH LEDGER */}
      {activeTab === 'AUDIT_TRAIL' && (
        <div className="space-y-4">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Regulatory Installation logs</div>
          
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Regulatory Patch ID</th>
                  <th className="px-5 py-3">Statutory Notification Title</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3 font-mono">Date Applied</th>
                  <th className="px-5 py-3">Authorized Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {changes.filter(c => c.status === 'APPLIED').length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                      No compliance patches applied yet. Execute a patch from the Regulatory Board to establish an audit ledger.
                    </td>
                  </tr>
                ) : (
                  changes.filter(c => c.status === 'APPLIED').map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono font-bold text-indigo-600">{item.id.toUpperCase()}</td>
                      <td className="px-5 py-3 text-slate-900">{item.title}</td>
                      <td className="px-5 py-3">
                        <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                          {getCategoryLabel(item.category)}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-slate-500">
                        {item.appliedAt ? new Date(item.appliedAt).toLocaleString() : 'N/A'}
                      </td>
                      <td className="px-5 py-3 text-slate-900 flex items-center gap-1.5">
                        <div className="w-5 h-5 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center text-[9px] font-extrabold text-slate-700">
                          {item.appliedBy ? item.appliedBy.charAt(0).toUpperCase() : 'C'}
                        </div>
                        <span className="truncate max-w-[120px]">{item.appliedBy || 'System Automated'}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
