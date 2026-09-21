import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { Sparkles, RotateCcw, X, AlertTriangle } from 'lucide-react';

export interface WorkspaceSyncLog {
  id: string;
  timestamp: string;
  size: string;
  version: number;
  status: 'SUCCESS' | 'FAILED' | 'SYNCING';
  details?: string;
}

interface WorkspaceSyncContextType {
  isSyncing: boolean;
  lastSynced: string | null;
  syncEnabled: boolean;
  setSyncEnabled: (enabled: boolean) => void;
  syncInterval: number;
  setSyncInterval: (ms: number) => void;
  syncLogs: WorkspaceSyncLog[];
  triggerManualSync: () => Promise<void>;
  registerDraftField: (formKey: string, data: any) => void;
  clearDraft: (formKey: string) => void;
  formInputs: Record<string, any>;
  restoreFormInputs: Record<string, any>;
  showRecoveryPrompt: boolean;
  onAcceptRecovery: () => void;
  onDiscardRecovery: () => void;
  currentActiveTab: string;
  setCurrentActiveTab: (tab: string) => void;
}

const WorkspaceSyncContext = createContext<WorkspaceSyncContextType | undefined>(undefined);

export const useWorkspaceSync = () => {
  const context = useContext(WorkspaceSyncContext);
  if (!context) {
    throw new Error('useWorkspaceSync must be used within a WorkspaceSyncProvider');
  }
  return context;
};

interface WorkspaceSyncProviderProps {
  children: React.ReactNode;
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

export const WorkspaceSyncProvider: React.FC<WorkspaceSyncProviderProps> = ({
  children,
  currentPath = typeof window !== 'undefined' ? window.location.pathname : '/',
  onNavigate = (path: string) => {
    if (typeof window !== 'undefined') window.history.pushState(null, '', path);
  }
}) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const currentTenantId = user?.currentTenantId || 't1';
  const userId = user?.id || 'demo-user';

  // Core Sync States
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [syncInterval, setSyncInterval] = useState(15000); // 15 seconds default
  const [syncLogs, setSyncLogs] = useState<WorkspaceSyncLog[]>([]);

  // Draft Data States
  const [formInputs, setFormInputs] = useState<Record<string, any>>({});
  const [restoreFormInputs, setRestoreFormInputs] = useState<Record<string, any>>({});
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false);
  const pendingCloudStateRef = useRef<any>(null);

  // Active Tab Sync
  const [currentActiveTab, setCurrentActiveTab] = useState(currentPath);
  const currentActiveTabRef = useRef(currentActiveTab);
  currentActiveTabRef.current = currentActiveTab;

  const formInputsRef = useRef(formInputs);
  formInputsRef.current = formInputs;

  // Track path updates
  useEffect(() => {
    setCurrentActiveTab(currentPath);
  }, [currentPath]);

  // Read logs from server
  const fetchSyncLogs = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/workspace/sync/logs?userId=${userId}&tenantId=${currentTenantId}`);
      if (res.ok) {
        const logs = await res.json();
        setSyncLogs(logs);
      }
    } catch (err) {
      console.warn('Workspace sync logs fetch bypassed temporarily', err);
    }
  }, [userId, currentTenantId]);

  // Trigger server cloud sync
  const triggerManualSync = useCallback(async () => {
    if (!syncEnabled) return;
    setIsSyncing(true);

    const payload = {
      activeTab: currentActiveTabRef.current,
      formInputs: formInputsRef.current,
      timestamp: new Date().toISOString()
    };

    // Keep locally in localStorage as quick backup
    localStorage.setItem(`taxflow-workspace-${userId}-${currentTenantId}`, JSON.stringify(payload));

    try {
      const res = await fetch('/api/workspace/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          tenantId: currentTenantId,
          payload
        })
      });

      if (res.ok) {
        const data = await res.json();
        setLastSynced(data.timestamp);
        fetchSyncLogs();
      } else {
        throw new Error('Server responded with error');
      }
    } catch (err) {
      console.warn('Workspace sync failed, fallback to local cache', err);
      // Append a local failure log
      const failedLog: WorkspaceSyncLog = {
        id: `sync-fail-${Math.random().toString(36).substring(2, 9)}`,
        timestamp: new Date().toISOString(),
        size: `${(JSON.stringify(payload).length / 1024).toFixed(2)} KB`,
        version: 0,
        status: 'FAILED',
        details: 'Server unreachable. State cached in local browser storage.'
      };
      setSyncLogs(prev => [failedLog, ...prev].slice(0, 50));
    } finally {
      setIsSyncing(false);
    }
  }, [userId, currentTenantId, syncEnabled, fetchSyncLogs]);

  // Register draft fields dynamically
  const registerDraftField = useCallback((formKey: string, data: any) => {
    setFormInputs(prev => {
      // Avoid infinite cycles if value is identical
      if (JSON.stringify(prev[formKey]) === JSON.stringify(data)) return prev;
      return { ...prev, [formKey]: data };
    });
  }, []);

  // Clear draft when form submitted/cancelled
  const clearDraft = useCallback((formKey: string) => {
    setFormInputs(prev => {
      const updated = { ...prev };
      delete updated[formKey];
      return updated;
    });
    setRestoreFormInputs(prev => {
      const updated = { ...prev };
      delete updated[formKey];
      return updated;
    });
  }, []);

  // Check for crash recovery / cloud state on startup or login
  useEffect(() => {
    if (!userId) return;

    const checkRecoveryState = async () => {
      try {
        const res = await fetch(`/api/workspace/sync?userId=${userId}&tenantId=${currentTenantId}`);
        if (res.ok) {
          const cloudData = await res.json();
          const localStr = localStorage.getItem(`taxflow-workspace-${userId}-${currentTenantId}`);
          const localData = localStr ? JSON.parse(localStr) : null;

          // Select the newest backup
          let newestBackup = null;
          if (cloudData.found && localData) {
            newestBackup = new Date(cloudData.timestamp) > new Date(localData.timestamp) ? cloudData.payload : localData;
          } else if (cloudData.found) {
            newestBackup = cloudData.payload;
          } else if (localData) {
            newestBackup = localData;
          }

          // If there is active form data inside the backup, prompt the user for recovery
          if (newestBackup && newestBackup.formInputs && Object.keys(newestBackup.formInputs).length > 0) {
            pendingCloudStateRef.current = newestBackup;
            setShowRecoveryPrompt(true);
          }
        }
      } catch (err) {
        console.warn('Workspace recovery state query bypassed temporarily', err);
      }
    };

    checkRecoveryState();
    fetchSyncLogs();
  }, [userId, currentTenantId, fetchSyncLogs]);

  // Periodic Auto-Sync Timer
  useEffect(() => {
    if (!syncEnabled || !userId) return;

    const intervalId = setInterval(() => {
      triggerManualSync();
    }, syncInterval);

    return () => clearInterval(intervalId);
  }, [syncEnabled, syncInterval, triggerManualSync, userId]);

  const onAcceptRecovery = useCallback(() => {
    if (pendingCloudStateRef.current) {
      const state = pendingCloudStateRef.current;
      if (state.formInputs) {
        setFormInputs(state.formInputs);
        setRestoreFormInputs(state.formInputs);
      }
      if (state.activeTab && state.activeTab !== currentPath) {
        onNavigate(state.activeTab);
      }
    }
    setShowRecoveryPrompt(false);
  }, [currentPath, onNavigate]);

  const onDiscardRecovery = useCallback(() => {
    // Delete local and trigger a clear on cloud
    localStorage.removeItem(`taxflow-workspace-${userId}-${currentTenantId}`);
    setShowRecoveryPrompt(false);
    pendingCloudStateRef.current = null;
    setFormInputs({});
    setRestoreFormInputs({});
  }, [userId, currentTenantId]);

  return (
    <WorkspaceSyncContext.Provider
      value={{
        isSyncing,
        lastSynced,
        syncEnabled,
        setSyncEnabled,
        syncInterval,
        setSyncInterval,
        syncLogs,
        triggerManualSync,
        registerDraftField,
        clearDraft,
        formInputs,
        restoreFormInputs,
        showRecoveryPrompt,
        onAcceptRecovery,
        onDiscardRecovery,
        currentActiveTab,
        setCurrentActiveTab
      }}
    >
      {children}
      {showRecoveryPrompt && (
        <div className="fixed bottom-6 right-6 z-[9999] w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-5 animate-in slide-in-from-bottom-8 duration-500 flex flex-col gap-4 text-xs">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100/60 shrink-0">
              <Sparkles size={18} className="text-indigo-600 animate-pulse" />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-sm text-slate-900 tracking-tight">Unsaved Work Restorable</h4>
                <button 
                  onClick={onDiscardRecovery} 
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                  title="Dismiss and Discard"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="text-slate-500 leading-relaxed text-[11px]">
                We found a cloud-synced draft from your previous session (e.g., prior to browser exit or crash).
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1.5 text-[11px] font-medium text-slate-700">
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span>Recoverable Components</span>
              <span>Cloud Copy</span>
            </div>
            {Object.keys(formInputs).map((key) => {
              const displayName = key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className="truncate max-w-[180px] font-bold text-slate-800">
                    {displayName || key}
                  </span>
                  <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md font-bold">
                    Draft Present
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onAcceptRecovery}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95"
            >
              <RotateCcw size={14} />
              Restore Session
            </button>
            <button
              onClick={onDiscardRecovery}
              className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-rose-600 hover:border-rose-100 rounded-xl font-bold transition-all text-center active:scale-95"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </WorkspaceSyncContext.Provider>
  );
};
