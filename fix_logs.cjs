const fs = require('fs');
const file = 'pages/Integrations.tsx';
let content = fs.readFileSync(file, 'utf8');

const logsStart = content.indexOf('  function renderLogsTab() {');
const logsEnd = content.indexOf('  return (', logsStart);

let newLogs = `  function renderLogsTab() {
    if (activeIntegration?.id === 'qb') {
      return (
        <div className="space-y-4 pt-2 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-800">QuickBooks Online Sync Logs</h4>
              <p className="text-[11px] text-slate-500">Invoice Pulls & Tax Liability Journal Entry Pushes</p>
            </div>
            <button 
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="text-[10px] flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3.5 py-2 rounded-xl font-bold uppercase tracking-wider disabled:opacity-50 transition-all shadow-sm"
            >
              {isSyncing ? <Loader2 size={12} className="animate-spin stroke-[3]" /> : <RefreshCw size={12} className="stroke-[3]" />}
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
          <div className="bg-slate-900 rounded-xl overflow-hidden shadow-inner">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950/50">
               <span className="text-[10px] font-mono text-slate-400">api.intuit.com/v3/company</span>
               <span className="flex items-center gap-2">
                 <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Live</span>
               </span>
            </div>
            <div className="p-4 h-64 overflow-y-auto font-mono text-[10px] space-y-2 text-slate-300">
               {systemLogs.length === 0 ? (
                 <p className="text-slate-600 italic">No sync activity recorded.</p>
               ) : (
                 systemLogs.filter(log => log.includes('QUICKBOOKS')).map((log, i) => {
                   const timeMatch = log.match(/\\[(.*?)\\]/);
                   const time = timeMatch ? timeMatch[1] : new Date().toLocaleTimeString();
                   const message = log.replace(/\\[.*?\\]\\s*/, '');
                   return (
                   <div key={i} className="flex items-start gap-3 border-l-2 border-slate-700 pl-3">
                     <span className="text-slate-500 whitespace-nowrap">[{time}]</span>
                     <span className={message.includes('ERROR') ? 'text-rose-400' : message.includes('successfully') || message.includes('Completed') ? 'text-emerald-400' : 'text-slate-300'}>{message}</span>
                   </div>
                 )})
               )}
            </div>
          </div>
        </div>
      );
    }
    
    if (activeIntegration?.id === 'xero') {
      return (
        <div className="space-y-4 pt-2 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-800">Xero Integration Sync Logs</h4>
              <p className="text-[11px] text-slate-500">Invoice Pulls & Tax Liability Manual Journal Pushes</p>
            </div>
            <button 
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="text-[10px] flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white px-3.5 py-2 rounded-xl font-bold uppercase tracking-wider disabled:opacity-50 transition-all shadow-sm"
            >
              {isSyncing ? <Loader2 size={12} className="animate-spin stroke-[3]" /> : <RefreshCw size={12} className="stroke-[3]" />}
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
          <div className="bg-slate-900 rounded-xl overflow-hidden shadow-inner">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950/50">
               <span className="text-[10px] font-mono text-slate-400">api.xero.com/api.xro/2.0</span>
               <span className="flex items-center gap-2">
                 <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono"><div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div> Live</span>
               </span>
            </div>
            <div className="p-4 h-64 overflow-y-auto font-mono text-[10px] space-y-2 text-slate-300">
               {systemLogs.length === 0 ? (
                 <p className="text-slate-600 italic">No sync activity recorded.</p>
               ) : (
                 systemLogs.filter(log => log.includes('XERO')).map((log, i) => {
                   const timeMatch = log.match(/\\[(.*?)\\]/);
                   const time = timeMatch ? timeMatch[1] : new Date().toLocaleTimeString();
                   const message = log.replace(/\\[.*?\\]\\s*/, '');
                   return (
                   <div key={i} className="flex items-start gap-3 border-l-2 border-slate-700 pl-3">
                     <span className="text-slate-500 whitespace-nowrap">[{time}]</span>
                     <span className={message.includes('ERROR') ? 'text-rose-400' : message.includes('successfully') || message.includes('Completed') ? 'text-emerald-400' : 'text-slate-300'}>{message}</span>
                   </div>
                 )})
               )}
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="space-y-4 pt-2 text-xs">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-800">Integration Sync Logs</h4>
            <p className="text-[11px] text-slate-500">Real-time sync activity and errors</p>
          </div>
          <button 
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="text-[10px] flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl font-bold uppercase tracking-wider disabled:opacity-50 transition-all shadow-sm"
          >
            {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
        <div className="bg-slate-900 rounded-xl overflow-hidden shadow-inner">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950/50">
             <span className="text-[10px] font-mono text-slate-400">Terminal</span>
             <span className="flex items-center gap-2">
               <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Live</span>
             </span>
          </div>
          <div className="p-4 h-64 overflow-y-auto font-mono text-[10px] space-y-2 text-slate-300">
             {systemLogs.length === 0 ? (
               <p className="text-slate-600 italic">No sync activity recorded.</p>
             ) : (
               systemLogs.map((log, i) => {
                 const timeMatch = log.match(/\\[(.*?)\\]/);
                 const time = timeMatch ? timeMatch[1] : new Date().toLocaleTimeString();
                 const message = log.replace(/\\[.*?\\]\\s*/, '');
                 return (
                 <div key={i} className="flex items-start gap-3 border-l-2 border-slate-700 pl-3">
                   <span className="text-slate-500 whitespace-nowrap">[{time}]</span>
                   <span className={message.includes('ERROR') ? 'text-rose-400' : message.includes('successfully') || message.includes('Completed') ? 'text-emerald-400' : 'text-slate-300'}>{message}</span>
                 </div>
               )})
             )}
          </div>
        </div>
      </div>
    );
  }

`;
content = content.substring(0, logsStart) + newLogs + content.substring(logsEnd);
fs.writeFileSync(file, content);
