import React, { useState, useEffect } from 'react';
import { 
  Clock, ShieldAlert, ShieldCheck, Lock, Save, RefreshCw, AlertTriangle, 
  CheckCircle2, Sparkles, Building2, Users, Sliders, History, FileText, 
  Zap, Play, Eye, RotateCcw, Shield, Layers, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DepartmentInactivityPolicy, InactivityPolicyPreset, PolicyChangeAuditLog,
  INACTIVITY_PRESETS, loadDepartmentInactivityPolicies, saveDepartmentInactivityPolicy, 
  applyPresetToAllDepartments, resetInactivityPoliciesToDefault, loadPolicyAuditLogs 
} from '../services/inactivityPolicyService';
import { DepartmentCode } from '../types';

interface InactivityPolicyConfiguratorProps {
  onShowToast?: (message: string) => void;
  adminName?: string;
}

export const InactivityPolicyConfigurator: React.FC<InactivityPolicyConfiguratorProps> = ({
  onShowToast,
  adminName = 'Security Admin'
}) => {
  const [policies, setPolicies] = useState<DepartmentInactivityPolicy[]>(loadDepartmentInactivityPolicies);
  const [selectedDeptCode, setSelectedDeptCode] = useState<DepartmentCode | 'DEFAULT_GLOBAL'>('FINANCE');
  const [auditLogs, setAuditLogs] = useState<PolicyChangeAuditLog[]>(loadPolicyAuditLogs);
  const [isSaving, setIsSaving] = useState(false);
  const [showSimulatedWarning, setShowSimulatedWarning] = useState(false);
  const [simulatedCountdown, setSimulatedCountdown] = useState(60);

  // Active Policy for the selected department
  const activePolicy = policies.find(p => p.departmentCode === selectedDeptCode) || policies[0];

  // Form State for editing active policy
  const [editedPolicy, setEditedPolicy] = useState<DepartmentInactivityPolicy>(activePolicy);

  // Sync edited policy when department selection changes
  useEffect(() => {
    const policy = policies.find(p => p.departmentCode === selectedDeptCode);
    if (policy) {
      setEditedPolicy(policy);
    }
  }, [selectedDeptCode, policies]);

  // Handle Save Policy for Selected Department
  const handleSaveCurrentPolicy = () => {
    setIsSaving(true);
    setTimeout(() => {
      const updated = saveDepartmentInactivityPolicy(editedPolicy, adminName);
      setPolicies(updated);
      setAuditLogs(loadPolicyAuditLogs());
      setIsSaving(false);
      if (onShowToast) {
        onShowToast(`Inactivity policy for "${editedPolicy.departmentName}" updated to ${editedPolicy.inactivityTimeoutMinutes} mins!`);
      }
    }, 400);
  };

  // Handle Bulk Preset Application
  const handleApplyPresetToAll = (preset: InactivityPolicyPreset) => {
    if (window.confirm(`Apply preset "${preset.name}" (${preset.timeoutMinutes} mins) to ALL departments?`)) {
      const updated = applyPresetToAllDepartments(preset, adminName);
      setPolicies(updated);
      setAuditLogs(loadPolicyAuditLogs());
      if (onShowToast) {
        onShowToast(`Applied ${preset.name} (${preset.timeoutMinutes}m) to all departments!`);
      }
    }
  };

  // Handle Reset All
  const handleResetDefaults = () => {
    if (window.confirm('Reset all department inactivity policies to system default standards?')) {
      const defaults = resetInactivityPoliciesToDefault();
      setPolicies(defaults);
      setAuditLogs(loadPolicyAuditLogs());
      if (onShowToast) {
        onShowToast('All department inactivity thresholds reset to default compliance values.');
      }
    }
  };

  // Quick Minute Set Helper
  const setQuickMinutes = (mins: number) => {
    setEditedPolicy(prev => ({
      ...prev,
      inactivityTimeoutMinutes: mins
    }));
  };

  return (
    <div className="space-y-6 font-sans">
      {/* HEADER BANNER */}
      <div className="p-6 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-2xl flex items-center justify-center shadow-inner">
              <Clock size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-white tracking-tight">Departmental Session Inactivity Policies</h2>
                <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold rounded-full uppercase">
                  ISO 27001 &amp; GSTN Compliant
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Configure custom session inactivity timeout limits, countdown warnings, and re-authentication rules per department.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5"
            >
              <RotateCcw size={14} /> Reset Defaults
            </button>
          </div>
        </div>
      </div>

      {/* GLOBAL PRESET QUICK BAR */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={15} className="text-blue-600" /> Apply Quick Security Policy Presets to All Departments
          </span>
          <span className="text-[10px] font-mono font-bold text-slate-400">1-Click Admin Enforcement</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {INACTIVITY_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleApplyPresetToAll(preset)}
              className="p-3.5 bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 rounded-xl text-left transition-all group flex flex-col justify-between shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {preset.name}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-mono font-extrabold rounded-md border border-slate-200">
                    {preset.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-normal leading-snug">{preset.description}</p>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-blue-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Apply to All Departments</span>
                <Zap size={13} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* MAIN TWO-COLUMN CONFIGURATOR GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT 4-COLS: DEPARTMENT SELECTOR NAV */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between px-2 pb-2 border-b border-slate-100">
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 size={15} className="text-blue-600" /> Departments ({policies.length})
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Select to Edit</span>
          </div>

          <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
            {policies.map((p) => {
              const isSelected = p.departmentCode === selectedDeptCode;
              return (
                <button
                  key={p.departmentCode}
                  type="button"
                  onClick={() => setSelectedDeptCode(p.departmentCode)}
                  className={`w-full text-left p-3 rounded-xl transition-all border flex items-center justify-between ${
                    isSelected 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20' 
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold truncate">{p.departmentName}</span>
                      {p.departmentCode === 'DEFAULT_GLOBAL' && (
                        <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                          GLOBAL
                        </span>
                      )}
                    </div>
                    <div className={`text-[11px] font-mono flex items-center gap-2 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                      <span>Timeout: <strong>{p.inactivityTimeoutMinutes}m</strong></span>
                      <span>&bull;</span>
                      <span>Warning: {p.warningDurationSeconds}s</span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-black shrink-0 ${
                    p.riskLevel === 'HIGH_STRICT' 
                      ? (isSelected ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-800 border border-rose-200')
                      : p.riskLevel === 'STANDARD'
                      ? (isSelected ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-800 border border-amber-200')
                      : (isSelected ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-800 border border-emerald-200')
                  }`}>
                    {p.inactivityTimeoutMinutes}m
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT 8-COLS: SELECTED DEPARTMENT EDITOR */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            {/* Header of Active Department */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900">{editedPolicy.departmentName}</h3>
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded-lg border border-slate-200 uppercase">
                    Code: {editedPolicy.departmentCode}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Configure security lock thresholds and behavior for this department</p>
              </div>

              {/* Master Department Toggle */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-extrabold text-slate-700">Policy Enabled:</span>
                <button
                  type="button"
                  onClick={() => setEditedPolicy(prev => ({ ...prev, isEnabled: !prev.isEnabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editedPolicy.isEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editedPolicy.isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {/* Slider 1: Inactivity Timeout Minutes */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Clock size={16} className="text-blue-600" /> Inactivity Lock Timeout Threshold
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">Duration of idle time before triggering the security alert countdown modal</p>
                </div>

                <div className="flex items-baseline gap-1 bg-white px-3.5 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                  <span className="text-xl font-black font-mono text-blue-600">{editedPolicy.inactivityTimeoutMinutes}</span>
                  <span className="text-xs font-bold text-slate-500">Minutes</span>
                </div>
              </div>

              {/* Quick Step Buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-[11px] font-bold text-slate-500 self-center mr-1">Quick Sets:</span>
                {[3, 5, 10, 14, 20, 30, 45, 60].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setQuickMinutes(m)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                      editedPolicy.inactivityTimeoutMinutes === m
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>

              {/* Slider Input */}
              <div className="space-y-1 pt-1">
                <input
                  type="range"
                  min="1"
                  max="60"
                  step="1"
                  value={editedPolicy.inactivityTimeoutMinutes}
                  onChange={(e) => setEditedPolicy({ ...editedPolicy, inactivityTimeoutMinutes: parseInt(e.target.value) || 1 })}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-400 font-bold">
                  <span>1 Minute (Ultra Strict)</span>
                  <span>15 Mins (Standard)</span>
                  <span>60 Mins (Max)</span>
                </div>
              </div>
            </div>

            {/* Slider 2: Countdown Warning Duration Seconds */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <ShieldAlert size={16} className="text-amber-600" /> Countdown Warning Duration
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">Seconds given to user on screen to click "Stay Logged In" before automatic logout</p>
                </div>

                <div className="flex items-baseline gap-1 bg-white px-3.5 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                  <span className="text-xl font-black font-mono text-amber-600">{editedPolicy.warningDurationSeconds}</span>
                  <span className="text-xs font-bold text-slate-500">Seconds</span>
                </div>
              </div>

              <div className="space-y-1">
                <input
                  type="range"
                  min="15"
                  max="180"
                  step="15"
                  value={editedPolicy.warningDurationSeconds}
                  onChange={(e) => setEditedPolicy({ ...editedPolicy, warningDurationSeconds: parseInt(e.target.value) || 15 })}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-400 font-bold">
                  <span>15 Seconds</span>
                  <span>60 Seconds (Standard)</span>
                  <span>180 Seconds</span>
                </div>
              </div>
            </div>

            {/* Additional Security Rule Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Toggle 1: Enforce Re-authentication */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock size={15} className="text-rose-600" /> Require Password Re-auth
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditedPolicy(prev => ({ ...prev, enforcePasswordReauth: !prev.enforcePasswordReauth }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${editedPolicy.enforcePasswordReauth ? 'bg-rose-600' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${editedPolicy.enforcePasswordReauth ? 'translate-x-4.5' : 'translate-x-1'}`} />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 font-normal">Requires re-entering user password/PIN when extending locked session.</p>
              </div>

              {/* Toggle 2: Auto-Save Form Drafts */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={15} className="text-emerald-600" /> Auto-Save Draft Inputs
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditedPolicy(prev => ({ ...prev, autoSaveDraftsOnLock: !prev.autoSaveDraftsOnLock }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${editedPolicy.autoSaveDraftsOnLock ? 'bg-emerald-600' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${editedPolicy.autoSaveDraftsOnLock ? 'translate-x-4.5' : 'translate-x-1'}`} />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 font-normal">Automatically preserves active invoice drafts and form inputs during lock.</p>
              </div>
            </div>

            {/* Custom Description Text */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                Policy Description &amp; Rationale
              </label>
              <input
                type="text"
                value={editedPolicy.description}
                onChange={(e) => setEditedPolicy({ ...editedPolicy, description: e.target.value })}
                placeholder="Explain the security reasoning for this department's timeout policy..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Save Policy Button */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('trigger-inactivity-warning-demo'));
                }}
                className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Eye size={15} className="text-blue-600" /> Test Inactivity Warning Modal
              </button>

              <button
                type="button"
                onClick={handleSaveCurrentPolicy}
                disabled={isSaving}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2 active:scale-98"
              >
                {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                <span>Save Department Policy</span>
              </button>
            </div>
          </div>

          {/* AUDIT LOG HISTORY TRAIL */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <History size={16} className="text-blue-600" /> Policy Change Audit History Log
              </h4>
              <span className="text-[10px] font-mono text-slate-400">Security Audit Trail</span>
            </div>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium text-center py-4">No recent policy modifications recorded.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {auditLogs.slice(0, 10).map((log) => (
                  <div key={log.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-800">{log.action}</p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">{log.details}</p>
                    </div>
                    <div className="text-right shrink-0 text-[10px] font-mono text-slate-400">
                      <p className="font-bold text-slate-600">{log.actorName}</p>
                      <p>{new Date(log.timestamp).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SIMULATED PREVIEW MODAL */}
      <AnimatePresence>
        {showSimulatedWarning && (
          <div className="fixed inset-0 z-[10000] overflow-y-auto p-4 flex min-h-screen items-center justify-center bg-slate-950/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 text-center my-auto max-h-[92vh] flex flex-col"
            >
              <div className="shrink-0 bg-gradient-to-r from-amber-500 to-orange-600 text-white p-3.5 font-bold text-xs flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShieldAlert size={15} /> Admin Simulated Preview Modal
                </span>
                <span className="font-mono bg-black/20 px-2 py-0.5 rounded text-[10px]">
                  Dept: {editedPolicy.departmentName}
                </span>
              </div>

              <div className="p-5 sm:p-6 space-y-3.5 overflow-y-auto">
                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
                  <Clock size={28} />
                </div>

                <h3 className="text-lg font-extrabold text-slate-900">
                  Inactivity Alert Preview ({editedPolicy.inactivityTimeoutMinutes} Min Threshold)
                </h3>

                <p className="text-xs text-slate-600 leading-relaxed">
                  "You have been inactive for over <strong>{editedPolicy.inactivityTimeoutMinutes} minutes</strong> under the <strong>{editedPolicy.departmentName} Security Policy</strong>. Your session will automatically lock in <strong>{editedPolicy.warningDurationSeconds} seconds</strong>."
                </p>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Re-authentication Required:</span>
                    <span className="font-mono font-extrabold text-slate-900">{editedPolicy.enforcePasswordReauth ? 'YES (Password/PIN Prompt)' : 'NO (1-Click Extend)'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Auto-Save Form Inputs:</span>
                    <span className="font-mono font-extrabold text-emerald-600">{editedPolicy.autoSaveDraftsOnLock ? 'ENABLED' : 'DISABLED'}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSimulatedWarning(false)}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs font-extrabold shadow-md hover:bg-blue-500 cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InactivityPolicyConfigurator;
