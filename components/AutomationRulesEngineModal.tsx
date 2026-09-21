import React, { useState, useEffect } from 'react';
import { 
  Sliders, Zap, Plus, Trash2, Edit3, CheckCircle2, Play, Power, 
  AlertCircle, Sparkles, X, ChevronRight, Tag, Building2, UserCheck, 
  ShieldAlert, ArrowRight, Layers, RefreshCw, HelpCircle, Check, Search, Filter
} from 'lucide-react';
import { 
  AutomationRule, AutomationRuleCondition, AutomationRuleAction 
} from '../types';
import { 
  fetchAutomationRules, saveAutomationRule, deleteAutomationRule, 
  toggleAutomationRule, runAllAutomationRulesOnTenantInvoices 
} from '../services/api';

interface AutomationRulesEngineModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  onRulesApplied?: () => void;
}

const COST_CENTER_OPTIONS = [
  'IT Infrastructure',
  'Supply Chain & Logistics',
  'Sales & Marketing',
  'Corporate Admin',
  'R&D & Engineering',
  'Employee Welfare & Perks',
  'Legal & Professional Fees'
];

const PRESET_RULE_TEMPLATES: Array<{
  name: string;
  description: string;
  category: 'ALL' | 'PURCHASE' | 'SALES';
  conditions: AutomationRuleCondition[];
  actions: AutomationRuleAction[];
}> = [
  {
    name: 'Cloud Subscriptions & SaaS Auto-Categorization',
    description: 'Auto-assign Cost Center "IT Infrastructure" & tag "Cloud-Services" for vendors containing AWS, Azure, Google, or Software.',
    category: 'PURCHASE',
    conditions: [{ field: 'vendorName', operator: 'contains', value: 'Software' }],
    actions: [
      { type: 'ASSIGN_COST_CENTER', value: 'IT Infrastructure' },
      { type: 'AUTO_TAG', value: 'Cloud-Services' },
      { type: 'AUTO_TAG', value: 'Software-Sub' }
    ]
  },
  {
    name: 'Goods Transport Agency (GTA) RCM Flagging',
    description: 'Auto-flag Reverse Charge (RCM) and assign Cost Center "Supply Chain" when vendor is a Freight or Transport agency.',
    category: 'PURCHASE',
    conditions: [{ field: 'vendorName', operator: 'contains', value: 'Transport' }],
    actions: [
      { type: 'SET_RCM', value: 'true' },
      { type: 'ASSIGN_COST_CENTER', value: 'Supply Chain & Logistics' },
      { type: 'AUTO_TAG', value: 'RCM-Applicable' }
    ]
  },
  {
    name: 'High-Value Invoice Audit Priority',
    description: 'Tag invoices above ₹1,00,000 as High-Value and assign to Senior Tax Manager for priority verification.',
    category: 'ALL',
    conditions: [{ field: 'minAmount', operator: 'greaterThan', value: 100000 }],
    actions: [
      { type: 'SET_PRIORITY', value: 'HIGH' },
      { type: 'ASSIGN_REVIEWER', value: 'Senior Tax Manager' },
      { type: 'AUTO_TAG', value: 'High-Value-Audit' }
    ]
  },
  {
    name: 'Food & Catering Blocked ITC Reversal',
    description: 'Auto-flag Section 17(5) Blocked ITC for food delivery, restaurant, and catering expenses.',
    category: 'PURCHASE',
    conditions: [{ field: 'vendorName', operator: 'contains', value: 'Catering' }],
    actions: [
      { type: 'FLAG_BLOCKED_ITC', value: 'Section 17(5): Food & Catering Expenses' },
      { type: 'ASSIGN_COST_CENTER', value: 'Employee Welfare & Perks' },
      { type: 'AUTO_TAG', value: 'Blocked-ITC' }
    ]
  }
];

const AutomationRulesEngineModal: React.FC<AutomationRulesEngineModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  onRulesApplied
}) => {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'PURCHASE' | 'SALES'>('ALL');

  // Rule Form State
  const [isEditing, setIsEditing] = useState(false);
  const [currentRule, setCurrentRule] = useState<Partial<AutomationRule> | null>(null);

  // Batch Execution Summary State
  const [isExecutingBatch, setIsExecutingBatch] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    totalInvoicesEvaluated: number;
    totalInvoicesModified: number;
    rulesExecutedCount: number;
    details: Array<{ invoiceNumber: string; vendor: string; rules: string[]; actions: string[] }>;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadRules();
    }
  }, [isOpen, tenantId]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await fetchAutomationRules(tenantId);
      setRules(data);
    } catch (err) {
      console.error('Failed to load automation rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (ruleId: string) => {
    try {
      const updated = await toggleAutomationRule(ruleId);
      setRules(prev => prev.map(r => r.id === ruleId ? updated : r));
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this automation rule?')) return;
    try {
      await deleteAutomationRule(ruleId);
      setRules(prev => prev.filter(r => r.id !== ruleId));
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const handleOpenCreateModal = (preset?: typeof PRESET_RULE_TEMPLATES[0]) => {
    if (preset) {
      setCurrentRule({
        name: preset.name,
        description: preset.description,
        category: preset.category,
        isActive: true,
        conditions: [...preset.conditions],
        actions: [...preset.actions]
      });
    } else {
      setCurrentRule({
        name: '',
        description: '',
        category: 'PURCHASE',
        isActive: true,
        conditions: [{ field: 'vendorName', operator: 'contains', value: '' }],
        actions: [{ type: 'ASSIGN_COST_CENTER', value: 'IT Infrastructure' }]
      });
    }
    setIsEditing(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRule || !currentRule.name) return;

    try {
      const saved = await saveAutomationRule(tenantId, currentRule);
      setRules(prev => {
        const exists = prev.some(r => r.id === saved.id);
        if (exists) return prev.map(r => r.id === saved.id ? saved : r);
        return [saved, ...prev];
      });
      setIsEditing(false);
      setCurrentRule(null);
    } catch (err) {
      console.error('Failed to save rule:', err);
    }
  };

  const handleRunBatchEngine = async () => {
    setIsExecutingBatch(true);
    setExecutionResult(null);
    try {
      const result = await runAllAutomationRulesOnTenantInvoices(tenantId);
      setExecutionResult(result);
      if (onRulesApplied) onRulesApplied();
      await loadRules();
    } catch (err) {
      console.error('Failed to execute batch rules engine:', err);
    } finally {
      setIsExecutingBatch(false);
    }
  };

  // Add / Remove Condition
  const addCondition = () => {
    if (!currentRule) return;
    const conds = currentRule.conditions || [];
    setCurrentRule({
      ...currentRule,
      conditions: [...conds, { field: 'vendorName', operator: 'contains', value: '' }]
    });
  };

  const removeCondition = (idx: number) => {
    if (!currentRule || !currentRule.conditions) return;
    const conds = currentRule.conditions.filter((_, i) => i !== idx);
    setCurrentRule({ ...currentRule, conditions: conds });
  };

  // Add / Remove Action
  const addAction = () => {
    if (!currentRule) return;
    const acts = currentRule.actions || [];
    setCurrentRule({
      ...currentRule,
      actions: [...acts, { type: 'AUTO_TAG', value: '' }]
    });
  };

  const removeAction = (idx: number) => {
    if (!currentRule || !currentRule.actions) return;
    const acts = currentRule.actions.filter((_, i) => i !== idx);
    setCurrentRule({ ...currentRule, actions: acts });
  };

  const filteredRules = rules.filter(rule => {
    const matchesCategory = categoryFilter === 'ALL' || rule.category === 'ALL' || rule.category === categoryFilter;
    const matchesSearch = rule.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (rule.description && rule.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const activeRulesCount = rules.filter(r => r.isActive).length;
  const totalExecutions = rules.reduce((acc, r) => acc + (r.executionCount || 0), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden text-slate-100 my-auto flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <Zap size={22} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                Invoice Automation Rules Engine
                <span className="text-[10px] font-extrabold bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Smart Workflows
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Automate vendor tagging, cost center allocation, RCM flagging, & ITC eligibility for recurring invoices
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
            title="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* STATS SUMMARY BAR */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400">Total Configured Rules</p>
                <h4 className="text-xl font-bold text-white mt-1">{rules.length} Rules</h4>
              </div>
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                <Sliders size={20} />
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400">Active Rules Running</p>
                <h4 className="text-xl font-bold text-emerald-400 mt-1">{activeRulesCount} Active</h4>
              </div>
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <Power size={20} />
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400">Automated Executions</p>
                <h4 className="text-xl font-bold text-amber-400 mt-1">{totalExecutions} Times</h4>
              </div>
              <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                <Sparkles size={20} />
              </div>
            </div>
          </div>

          {/* MAIN ACTIONS & FILTER BAR */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
            
            {/* Search & Category Filter */}
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search rules by vendor, tag, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 font-medium focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Categories</option>
                <option value="PURCHASE">Purchase Invoices</option>
                <option value="SALES">Sales Invoices</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={handleRunBatchEngine}
                disabled={isExecutingBatch}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isExecutingBatch ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Evaluating Rules...
                  </>
                ) : (
                  <>
                    <Play size={14} /> Run Engine Now
                  </>
                )}
              </button>

              <button
                onClick={() => handleOpenCreateModal()}
                className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95"
              >
                <Plus size={16} /> Create Custom Rule
              </button>
            </div>

          </div>

          {/* BATCH EXECUTION RESULT BANNER */}
          {executionResult && (
            <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/40 p-5 rounded-2xl space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Batch Rules Execution Completed</h4>
                    <p className="text-xs text-slate-300">
                      Evaluated <strong>{executionResult.totalInvoicesEvaluated}</strong> invoices. Automatically updated <strong>{executionResult.totalInvoicesModified}</strong> invoices with tags & cost centers!
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setExecutionResult(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Detail List of Invoices Modified */}
              {executionResult.details.length > 0 && (
                <div className="bg-slate-950/80 rounded-xl border border-slate-800/80 p-3 max-h-40 overflow-y-auto space-y-2 text-xs">
                  {executionResult.details.map((item, idx) => (
                    <div key={idx} className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-900/60 rounded-lg border border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-amber-400 font-bold">{item.invoiceNumber}</span>
                        <span className="text-slate-400">• {item.vendor}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.actions.map((act, aIdx) => (
                          <span key={aIdx} className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">
                            {act}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PRESET QUICK RULE TEMPLATES SUGGESTION */}
          {rules.length < 6 && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} /> Quick Preset Rule Templates
                </h4>
                <span className="text-[10px] text-slate-400">Click to import rule</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRESET_RULE_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleOpenCreateModal(tmpl)}
                    className="p-3 bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/40 rounded-xl text-left transition-all group flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-200 group-hover:text-amber-300 transition-colors">
                        {tmpl.name}
                      </div>
                      <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {tmpl.description}
                      </div>
                    </div>
                    <Plus size={14} className="text-slate-500 group-hover:text-amber-400 shrink-0 mt-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* RULES LIST */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Configured Automation Rules ({filteredRules.length})</span>
              <span className="text-[11px] text-slate-500 font-normal">Active rules apply automatically on scan/creation</span>
            </h4>

            {filteredRules.length === 0 ? (
              <div className="bg-slate-950 p-8 rounded-xl border border-slate-800 text-center space-y-3">
                <Sliders size={32} className="mx-auto text-slate-600" />
                <h4 className="font-bold text-sm text-slate-300">No Automation Rules Found</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Create custom rules to automatically set cost centers, assign tags, flag RCM liability, or mark blocked ITC for your vendor invoices.
                </p>
                <button
                  onClick={() => handleOpenCreateModal()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md inline-flex items-center gap-1.5"
                >
                  <Plus size={14} /> Create First Rule
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`bg-slate-950 p-5 rounded-2xl border transition-all ${
                      rule.isActive 
                        ? 'border-slate-800 hover:border-slate-700 shadow-md' 
                        : 'border-slate-800/50 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center gap-3">
                        {/* Active Toggle Switch */}
                        <button
                          onClick={() => handleToggleActive(rule.id)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            rule.isActive ? 'bg-emerald-500' : 'bg-slate-800'
                          }`}
                          title={rule.isActive ? 'Disable rule' : 'Enable rule'}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow-lg ring-0 transition duration-200 ease-in-out ${
                              rule.isActive ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-white">{rule.name}</h4>
                            <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                              rule.category === 'PURCHASE' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                              rule.category === 'SALES' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                              'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}>
                              {rule.category}
                            </span>
                          </div>
                          {rule.description && (
                            <p className="text-xs text-slate-400 mt-0.5">{rule.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 ml-auto sm:ml-0">
                        <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                          Executed {rule.executionCount || 0}x
                        </span>

                        <button
                          onClick={() => {
                            setCurrentRule({ ...rule });
                            setIsEditing(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                          title="Edit rule"
                        >
                          <Edit3 size={15} />
                        </button>

                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-all"
                          title="Delete rule"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Conditions vs Actions Flow Display */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 text-xs">
                      {/* IF CONDITIONS */}
                      <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                          IF (Conditions)
                        </span>
                        <div className="space-y-1">
                          {rule.conditions.map((cond, cIdx) => (
                            <div key={cIdx} className="text-slate-300 flex items-center gap-1.5 font-mono bg-slate-950 px-2 py-1 rounded border border-slate-800">
                              <span className="text-indigo-400">{cond.field}</span>
                              <span className="text-slate-500">{cond.operator}</span>
                              <span className="text-amber-300 font-bold">"{cond.value}"</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* THEN ACTIONS */}
                      <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                          THEN (Actions)
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {rule.actions.map((act, aIdx) => (
                            <span key={aIdx} className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1">
                              {act.type === 'AUTO_TAG' && <Tag size={12} className="text-amber-400" />}
                              {act.type === 'ASSIGN_COST_CENTER' && <Building2 size={12} className="text-indigo-400" />}
                              {act.type === 'ASSIGN_REVIEWER' && <UserCheck size={12} className="text-teal-400" />}
                              {act.type === 'FLAG_BLOCKED_ITC' && <ShieldAlert size={12} className="text-rose-400" />}
                              <span>{act.type}: <strong>{act.value}</strong></span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between shrink-0">
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <HelpCircle size={14} className="text-amber-400" />
            Rules automatically evaluate when scanning physical invoices with Camera or creating manual entries.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all"
          >
            Done
          </button>
        </div>

      </div>

      {/* SUB-MODAL: CREATE / EDIT AUTOMATION RULE FORM */}
      {isEditing && currentRule && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden text-slate-100 p-6 space-y-6 my-auto">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Sliders size={18} className="text-amber-400" />
                {currentRule.id ? 'Edit Automation Rule' : 'Create Custom Automation Rule'}
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-5 text-xs">
              
              {/* Basic Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">Rule Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AWS & Cloud Subscription Auto-Tagging"
                    value={currentRule.name || ''}
                    onChange={(e) => setCurrentRule({ ...currentRule, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">Description (Optional)</label>
                  <input
                    type="text"
                    placeholder="Brief details on what this rule automates"
                    value={currentRule.description || ''}
                    onChange={(e) => setCurrentRule({ ...currentRule, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Apply To Category</label>
                  <select
                    value={currentRule.category || 'PURCHASE'}
                    onChange={(e) => setCurrentRule({ ...currentRule, category: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="ALL">All Categories (Purchase & Sales)</option>
                    <option value="PURCHASE">Purchase / Vendor Invoices</option>
                    <option value="SALES">Sales Invoices</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Status</label>
                  <select
                    value={currentRule.isActive ? 'true' : 'false'}
                    onChange={(e) => setCurrentRule({ ...currentRule, isActive: e.target.value === 'true' })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="true">Active (Automated)</option>
                    <option value="false">Paused</option>
                  </select>
                </div>
              </div>

              {/* IF CONDITIONS BUILDER */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-amber-400 uppercase tracking-wider text-[11px] flex items-center gap-1">
                    IF (Invoice Matches Conditions)
                  </h4>
                  <button
                    type="button"
                    onClick={addCondition}
                    className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Condition
                  </button>
                </div>

                {(currentRule.conditions || []).map((cond, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={cond.field}
                      onChange={(e) => {
                        const updated = [...(currentRule.conditions || [])];
                        updated[idx].field = e.target.value as any;
                        setCurrentRule({ ...currentRule, conditions: updated });
                      }}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    >
                      <option value="vendorName">Vendor / Party Name</option>
                      <option value="gstin">GSTIN Number</option>
                      <option value="minAmount">Min Amount (₹)</option>
                      <option value="maxAmount">Max Amount (₹)</option>
                      <option value="hsnSac">HSN/SAC Code</option>
                    </select>

                    <select
                      value={cond.operator}
                      onChange={(e) => {
                        const updated = [...(currentRule.conditions || [])];
                        updated[idx].operator = e.target.value as any;
                        setCurrentRule({ ...currentRule, conditions: updated });
                      }}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    >
                      <option value="contains">contains</option>
                      <option value="equals">equals</option>
                      <option value="startsWith">startsWith</option>
                      <option value="greaterThan">greaterThan</option>
                      <option value="lessThan">lessThan</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Value to match"
                      value={cond.value || ''}
                      onChange={(e) => {
                        const updated = [...(currentRule.conditions || [])];
                        updated[idx].value = e.target.value;
                        setCurrentRule({ ...currentRule, conditions: updated });
                      }}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-500"
                    />

                    {(currentRule.conditions || []).length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCondition(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* THEN ACTIONS BUILDER */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-emerald-400 uppercase tracking-wider text-[11px] flex items-center gap-1">
                    THEN (Execute Actions)
                  </h4>
                  <button
                    type="button"
                    onClick={addAction}
                    className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Action
                  </button>
                </div>

                {(currentRule.actions || []).map((act, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={act.type}
                      onChange={(e) => {
                        const updated = [...(currentRule.actions || [])];
                        updated[idx].type = e.target.value as any;
                        if (e.target.value === 'ASSIGN_COST_CENTER') updated[idx].value = COST_CENTER_OPTIONS[0];
                        setCurrentRule({ ...currentRule, actions: updated });
                      }}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    >
                      <option value="ASSIGN_COST_CENTER">Assign Cost Center</option>
                      <option value="AUTO_TAG">Auto Tag Invoice</option>
                      <option value="SET_RCM">Set Reverse Charge (RCM)</option>
                      <option value="FLAG_BLOCKED_ITC">Flag Blocked ITC Sec 17(5)</option>
                      <option value="ASSIGN_REVIEWER">Assign Reviewer</option>
                      <option value="SET_PRIORITY">Set Compliance Priority</option>
                    </select>

                    {act.type === 'ASSIGN_COST_CENTER' ? (
                      <select
                        value={act.value || COST_CENTER_OPTIONS[0]}
                        onChange={(e) => {
                          const updated = [...(currentRule.actions || [])];
                          updated[idx].value = e.target.value;
                          setCurrentRule({ ...currentRule, actions: updated });
                        }}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                      >
                        {COST_CENTER_OPTIONS.map((cc, i) => (
                          <option key={i} value={cc}>{cc}</option>
                        ))}
                      </select>
                    ) : act.type === 'SET_RCM' ? (
                      <select
                        value={act.value || 'true'}
                        onChange={(e) => {
                          const updated = [...(currentRule.actions || [])];
                          updated[idx].value = e.target.value;
                          setCurrentRule({ ...currentRule, actions: updated });
                        }}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                      >
                        <option value="true">Enable RCM (True)</option>
                        <option value="false">Disable RCM (False)</option>
                      </select>
                    ) : act.type === 'SET_PRIORITY' ? (
                      <select
                        value={act.value || 'HIGH'}
                        onChange={(e) => {
                          const updated = [...(currentRule.actions || [])];
                          updated[idx].value = e.target.value;
                          setCurrentRule({ ...currentRule, actions: updated });
                        }}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                      >
                        <option value="HIGH">High Priority</option>
                        <option value="NORMAL">Normal Priority</option>
                        <option value="LOW">Low Priority</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="Action Value / Label"
                        value={act.value || ''}
                        onChange={(e) => {
                          const updated = [...(currentRule.actions || [])];
                          updated[idx].value = e.target.value;
                          setCurrentRule({ ...currentRule, actions: updated });
                        }}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-500"
                      />
                    )}

                    {(currentRule.actions || []).length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAction(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black rounded-xl shadow-lg"
                >
                  Save Automation Rule
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};

export default AutomationRulesEngineModal;
