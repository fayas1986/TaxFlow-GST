import React, { useState } from 'react';
import { 
  RefreshCw, 
  CheckCircle2, 
  ShieldCheck, 
  Radio, 
  ExternalLink, 
  Terminal, 
  Search, 
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Globe,
  Landmark,
  Ship,
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface PortalConnectionBannerProps {
  isSyncing: boolean;
  onSync: () => void;
  syncLogs: string[];
  lastSyncedTime: string;
  onSearchArn: (arn: string) => void;
}

export const PortalConnectionBanner: React.FC<PortalConnectionBannerProps> = ({
  isSyncing,
  onSync,
  syncLogs,
  lastSyncedTime,
  onSearchArn
}) => {
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [arnInput, setArnInput] = useState('');

  const handleArnSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (arnInput.trim()) {
      onSearchArn(arnInput.trim());
    }
  };

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg border border-slate-800 relative overflow-hidden">
      {/* Subtle Background Glow */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-emerald-600/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        {/* Left Side: Status & Gateways */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              <Radio size={12} className="animate-pulse" />
              Live Government Gateway Active
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Last Poll: <strong className="text-slate-200">{lastSyncedTime || 'Real-Time'}</strong>
            </span>
          </div>

          <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
            Government Portal ITC Refund Processor
          </h2>

          {/* Active Gateways Badges */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
            <div className="flex items-center gap-1.5 text-slate-300 font-medium bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
              <Globe size={13} className="text-blue-400" />
              <span>GSTN Common Portal API</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>

            <div className="flex items-center gap-1.5 text-slate-300 font-medium bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
              <Ship size={13} className="text-cyan-400" />
              <span>ICEGATE Customs EDI (Exports)</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>

            <div className="flex items-center gap-1.5 text-slate-300 font-medium bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
              <Landmark size={13} className="text-amber-400" />
              <span>PFMS Banking Clearing</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
          </div>
        </div>

        {/* Right Side: Direct ARN Fetch & Sync Buttons */}
        <div className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Quick ARN Fetcher Form */}
          <form onSubmit={handleArnSearchSubmit} className="relative flex-1 sm:w-64">
            <input
              type="text"
              placeholder="Fetch ARN (e.g. AA2708...)"
              value={arnInput}
              onChange={(e) => setArnInput(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-800/90 border border-slate-700 text-white placeholder-slate-400 rounded-xl focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono font-medium"
            />
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            {arnInput && (
              <button
                type="submit"
                className="absolute right-2 top-2 p-1 text-slate-400 hover:text-white"
                title="Lookup ARN"
              >
                <ArrowRight size={12} />
              </button>
            )}
          </form>

          {/* Sync All Button */}
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0 border border-blue-400/30"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Polling Portals...' : 'Sync Portal Status'}
          </button>

          {/* Toggle Sync Logs */}
          <button
            onClick={() => setIsLogOpen(!isLogOpen)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5 shrink-0"
            title="Toggle Live Sync Terminal Logs"
          >
            <Terminal size={14} />
            <span className="hidden sm:inline">Audit Logs</span>
            {isLogOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Expandable Live Sync Audit Terminal */}
      {isLogOpen && (
        <div className="mt-4 pt-4 border-t border-slate-800/90 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-800/80 text-[10px] font-bold uppercase tracking-wider">
              <span>GSTN / ICEGATE / PFMS Polling Stream</span>
              <span className="text-emerald-400">Response: 200 OK</span>
            </div>
            {syncLogs && syncLogs.length > 0 ? (
              syncLogs.map((log, i) => (
                <div key={i} className="leading-relaxed flex items-start gap-2">
                  <span className="text-blue-400 select-none">&gt;</span>
                  <span className={log.includes('ACTION_REQUIRED') || log.includes('DEFICIENCY') ? 'text-amber-300' : 'text-slate-300'}>
                    {log}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-slate-500 py-1 italic">
                Portal handshake initialized. Click &ldquo;Sync Portal Status&rdquo; to pull real-time updates from government refund registers.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
