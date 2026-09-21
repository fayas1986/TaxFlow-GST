import React, { useState } from 'react';
import { useWorkspaceSync } from './WorkspaceSyncContext';
import { 
  Cloud, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ToggleLeft, 
  ToggleRight, 
  Play, 
  History, 
  AlertTriangle,
  HardDriveDownload,
  Terminal,
  Layers,
  Database
} from 'lucide-react';

interface WorkspaceSyncSettingsTabProps {
  setToastMessage: (msg: string | null) => void;
}

const WorkspaceSyncSettingsTab: React.FC<WorkspaceSyncSettingsTabProps> = ({ setToastMessage }) => {
  const {
    isSyncing,
    lastSynced,
    syncEnabled,
    setSyncEnabled,
    syncInterval,
    setSyncInterval,
    syncLogs,
    triggerManualSync,
    restoreFormInputs
  } = useWorkspaceSync();

  const [isSyncingLocal, setIsSyncingLocal] = useState(false);

  const handleManualSyncClick = async () => {
    setIsSyncingLocal(true);
    try {
      await triggerManualSync();
      setToastMessage('Workspace synchronized with enterprise cloud store!');
    } catch (err) {
      setToastMessage('Synchronization failed. Cached locally.');
    } finally {
      setIsSyncingLocal(false);
    }
  };

  const activeDraftKeys = Object.keys(restoreFormInputs || {});

  return (
    <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Cloud size={20} className="text-blue-500" />
          Automated Workspace Sync (Fault-Tolerance)
        </h3>
        <span className="text-[10px] bg-indigo-50 border border-indigo-100/60 text-indigo-600 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
          Active-Active Sync
        </span>
      </div>

      <p className="text-sm text-slate-500 leading-relaxed">
        To prevent data loss from browser crashes, accidental tab closures, or sudden reloads, TaxFlow periodically captures draft form data and dashboard states to a secure server-side storage map linked to your user account.
      </p>

      {/* Main Settings Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Status indicator */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between shadow-lg md:col-span-1">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl"></div>
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2">
              <Cloud size={22} className={syncEnabled ? "text-indigo-400 animate-pulse" : "text-slate-500"} />
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Sync Engine</span>
            </div>
            
            <div>
              <p className="text-2xl font-black text-white">
                {syncEnabled ? 'ONLINE' : 'PAUSED'}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                {lastSynced ? `Last: ${new Date(lastSynced).toLocaleTimeString()}` : 'No backups saved yet'}
              </p>
            </div>
          </div>

          <button
            onClick={handleManualSyncClick}
            disabled={isSyncing || isSyncingLocal}
            className="mt-6 w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-55 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-blue-500/10"
          >
            <RefreshCw size={14} className={isSyncing || isSyncingLocal ? "animate-spin" : ""} />
            Sync Now
          </button>
        </div>

        {/* Configurations */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 md:col-span-2 space-y-5">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Configurations</h4>
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <p className="text-sm font-bold text-slate-800">Auto-Sync Workspace State</p>
              <p className="text-xs text-slate-400 mt-0.5">Captures form drafts automatically in the background</p>
            </div>
            <button 
              onClick={() => {
                setSyncEnabled(!syncEnabled);
                setToastMessage(`Workspace sync ${!syncEnabled ? 'enabled' : 'paused'}`);
              }}
              className="text-slate-600 hover:text-slate-900 transition-colors"
            >
              {syncEnabled ? (
                <ToggleRight className="text-blue-600 w-12 h-12" strokeWidth={1.5} />
              ) : (
                <ToggleLeft className="text-slate-300 w-12 h-12" strokeWidth={1.5} />
              )}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-800">Synchronization Frequency</p>
              <p className="text-xs text-slate-400 mt-0.5">How often changes are committed to the cloud vault</p>
            </div>
            <select
              value={syncInterval}
              disabled={!syncEnabled}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setSyncInterval(val);
                setToastMessage(`Sync interval updated to ${val / 1000}s`);
              }}
              className="h-10 px-4 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500 bg-white"
            >
              <option value="5000">Real-time (Every 5 seconds)</option>
              <option value="15000">Balanced (Every 15 seconds)</option>
              <option value="60000">Eco-mode (Every 1 minute)</option>
              <option value="300000">Manual Only (Disable background timer)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active Form Drafts Summary */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Active Forms Cached in Workspace State</h4>
        
        {activeDraftKeys.length === 0 ? (
          <div className="text-center p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
            <Layers size={24} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs text-slate-500 font-bold">No active draft inputs detected.</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Start entering values on the Quick Tax Estimator or similar screens to see live sync tracking.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeDraftKeys.map((key) => {
              const displayName = key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
              const draftData = restoreFormInputs[key];
              return (
                <div key={key} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-500">
                      <Terminal size={14} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800">{displayName}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                        Snapshot: {JSON.stringify(draftData).substring(0, 80)}...
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-green-100">
                    Protected
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sync history logs */}
      <div className="space-y-3">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <History size={14} />
          Real-time Sync Log History
        </h4>

        {syncLogs.length === 0 ? (
          <div className="text-center p-8 bg-white border border-slate-200/80 rounded-2xl">
            <Clock size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs text-slate-500 font-bold">No synchronization records yet.</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Sync logs will populate in real-time as background auto-saves occur.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden divide-y divide-slate-100">
            {syncLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-xs">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    {log.status === 'SUCCESS' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-800 font-mono text-[11px]">
                        {log.id}
                      </span>
                      {log.version && (
                        <span className="bg-indigo-50 text-indigo-600 text-[9px] px-1.5 py-0.2 rounded font-bold">
                          v{log.version}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                      {new Date(log.timestamp).toLocaleString()} • {log.size || '0.25 KB'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  {log.status === 'SUCCESS' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-100">
                      SUCCESS
                    </span>
                  ) : (
                    <div className="space-y-0.5 flex flex-col items-end">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-rose-50 text-rose-700 border border-rose-100">
                        FAILED
                      </span>
                      {log.details && (
                        <p className="text-[9px] text-rose-500 font-bold max-w-[200px] truncate">
                          {log.details}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspaceSyncSettingsTab;
