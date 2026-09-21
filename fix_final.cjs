const fs = require('fs');
const file = 'pages/Integrations.tsx';
let content = fs.readFileSync(file, 'utf8');

// I know that the file currently ends at the end of `renderLogsTab()` function which I overwrote.
const logsTabEnd = content.indexOf('export default Integrations;');
const mainComponentReturn = `  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden text-slate-800">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 relative">
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">Integrations Hub</h1>
            <div className="h-5 w-px bg-slate-300"></div>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100 flex items-center gap-1">
              <Database size={12} /> Data Sync Active
            </span>
          </div>
          <div className="flex items-center gap-4">
             <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
               <Bell size={18} />
               <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
             </button>
             <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-white text-xs font-bold shadow-sm">
               FM
             </div>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Connected Ecosystem</h2>
                <p className="text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
                  Connect your ERP and accounting systems to automatically sync invoices, validate GSTINs, and generate statutory tax reports.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Search apps..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 shadow-sm" />
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-sm transition-colors">
                  <Plus size={16} /> Add App
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {integrations.map(integration => (
                 <div key={integration.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow relative overflow-hidden group">
                   <div className="flex items-start justify-between mb-4">
                      <div className={\`w-12 h-12 rounded-xl \${integration.iconColor} flex items-center justify-center text-white text-lg font-black shadow-inner\`}>
                         {integration.initials}
                      </div>
                      <div className="flex items-center gap-2">
                        {integration.status === 'CONNECTED' ? (
                           <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> Connected
                           </span>
                        ) : (
                           <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                             Disconnected
                           </span>
                        )}
                      </div>
                   </div>
                   <h3 className="font-bold text-slate-900 text-base">{integration.name}</h3>
                   <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-2">{integration.description}</p>
                   
                   <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                     <div className="text-[10px] font-semibold text-slate-400">
                        {integration.status === 'CONNECTED' ? \`Last sync: \${integration.lastSync}\` : 'Never synced'}
                     </div>
                     <button 
                       onClick={() => openConnectModal(integration.id, integration.status === 'CONNECTED' ? 'SYNC' : 'CONNECTION')}
                       className={\`text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors \${integration.status === 'CONNECTED' ? 'text-slate-700 hover:bg-slate-100' : 'text-blue-700 bg-blue-50 hover:bg-blue-100'}\`}
                     >
                       {integration.status === 'CONNECTED' ? 'Configure' : 'Connect'}
                     </button>
                   </div>
                 </div>
              ))}
            </div>

            {/* Trace Explorer Section */}
            <div className="mt-8 pt-8 border-t border-slate-200">
               <div className="flex items-center justify-between mb-6">
                 <div>
                    <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                      <Activity size={20} className="text-blue-600" /> Distributed Tracing & Diagnostics
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">Monitor end-to-end API latencies, data pipelines, and ERP connector health.</p>
                 </div>
               </div>
               
               <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[400px]">
                  {/* Traces List Sidebar */}
                  <div className="w-full md:w-80 border-r border-slate-200 bg-slate-50/50 flex flex-col">
                     <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between sticky top-0">
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Recent Executions</span>
                       <button className="text-slate-400 hover:text-slate-700 transition-colors"><RefreshCw size={14} /></button>
                     </div>
                     <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                       {mockTraces.map((trace) => (
                         <div 
                           key={trace.id} 
                           onClick={() => setSelectedTraceId(trace.id)}
                           className={\`p-4 cursor-pointer transition-colors \${selectedTraceId === trace.id ? 'bg-white border-l-2 border-l-blue-600 shadow-sm' : 'hover:bg-white border-l-2 border-l-transparent'}\`}
                         >
                           <div className="flex items-center justify-between mb-1">
                             <span className="text-[10px] font-mono text-slate-400">{trace.id}</span>
                             <span className="text-[10px] font-semibold text-slate-500">{trace.timestamp}</span>
                           </div>
                           <h4 className="text-xs font-bold text-slate-800 truncate mb-2">{trace.name}</h4>
                           <div className="flex items-center gap-3">
                             <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-600">
                               <Clock size={12} className="text-slate-400" /> {trace.durationMs}ms
                             </span>
                             <span className={\`text-[10px] font-bold uppercase tracking-wider \${trace.spans.some(s => s.status === 'ERROR') ? 'text-rose-600' : 'text-emerald-600'}\`}>
                               {trace.spans.some(s => s.status === 'ERROR') ? 'Failed' : 'Success'}
                             </span>
                           </div>
                         </div>
                       ))}
                     </div>
                  </div>
                  
                  {/* Trace Waterfall Chart */}
                  <div className="flex-1 bg-white p-6 flex flex-col">
                     <div className="mb-6 flex items-start justify-between">
                       <div>
                         <h3 className="text-sm font-bold text-slate-900">{activeTrace.name}</h3>
                         <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs text-slate-500 font-mono">Trace ID: {activeTrace.id}</span>
                            <span className="text-xs text-slate-500">Duration: <strong>{activeTrace.durationMs}ms</strong></span>
                            <span className="text-xs text-slate-500">Spans: <strong>{activeTrace.spans.length}</strong></span>
                         </div>
                       </div>
                       <div className="flex gap-2">
                          <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors">Export JSON</button>
                       </div>
                     </div>
                     
                     {/* Waterfall Visualization */}
                     <div className="flex-1 border border-slate-200 rounded-xl bg-slate-50 p-4 overflow-y-auto overflow-x-hidden relative">
                        <div className="flex text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-2 mb-4 sticky top-0 bg-slate-50 z-10">
                           <div className="w-1/3">Service & Operation</div>
                           <div className="w-2/3 pl-4 relative">
                              <span>Timeline (0ms - {activeTrace.durationMs}ms)</span>
                           </div>
                        </div>
                        <div className="space-y-4">
                           {activeTrace.spans.map((span, i) => {
                             const leftPercent = (span.offsetMs / activeTrace.durationMs) * 100;
                             const widthPercent = Math.max((span.durationMs / activeTrace.durationMs) * 100, 0.5);
                             return (
                               <div key={i} className="group relative">
                                 <div className="flex items-center text-xs">
                                   <div className="w-1/3 pr-4 truncate">
                                     <div className="font-bold text-slate-700 truncate">{span.service}</div>
                                     <div className="text-[10px] text-slate-500 truncate mt-0.5">{span.operation}</div>
                                   </div>
                                   <div className="w-2/3 relative h-8 bg-slate-100 rounded border border-slate-200 overflow-hidden">
                                     <div 
                                       className={\`absolute top-1 bottom-1 rounded-sm shadow-sm transition-all flex items-center px-2 text-[8px] font-bold text-white overflow-hidden \${span.status === 'ERROR' ? 'bg-rose-500' : 'bg-blue-500'}\`}
                                       style={{ left: \`\${leftPercent}%\`, width: \`\${widthPercent}%\` }}
                                     >
                                       {widthPercent > 10 && \`\${span.durationMs}ms\`}
                                     </div>
                                   </div>
                                 </div>
                                 <div className="ml-[33%] mt-2 pl-4 space-y-1">
                                    {span.logs.map((log, li) => (
                                      <div key={li} className="text-[10px] font-mono text-slate-500 flex items-center gap-2">
                                        <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                        {log}
                                      </div>
                                    ))}
                                 </div>
                               </div>
                             );
                           })}
                        </div>
                     </div>
                  </div>
               </div>
            </div>

          </div>
        </main>
      </div>

      {/* Configuration Modal */}
      {modalState.isOpen && activeIntegration && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-4">
                <div className={\`w-12 h-12 rounded-xl \${activeIntegration.iconColor} flex items-center justify-center text-white text-xl font-black shadow-sm\`}>
                  {activeIntegration.initials}
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">{activeIntegration.name} Configuration</h2>
                  <p className="text-xs text-slate-500 font-medium">Manage connection, sync rules, and data mapping.</p>
                </div>
              </div>
              <button onClick={closeConnectModal} className="p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {activeIntegration.status === 'CONNECTED' ? (
              <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                <div className="w-full md:w-56 bg-slate-50 border-r border-slate-100 flex flex-row md:flex-col p-2 md:p-4 gap-1 md:gap-2 overflow-x-auto md:overflow-visible shrink-0">
                  <button 
                    onClick={() => setActiveTab('CONNECTION')}
                    className={\`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap \${activeTab === 'CONNECTION' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-100'}\`}
                  >
                    <Server size={14} /> Connection
                  </button>
                  <button 
                    onClick={() => setActiveTab('SYNC')}
                    className={\`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap \${activeTab === 'SYNC' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-100'}\`}
                  >
                    <RefreshCw size={14} /> Sync Settings
                  </button>
                  <button 
                    onClick={() => setActiveTab('MAPPING')}
                    className={\`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap \${activeTab === 'MAPPING' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-100'}\`}
                  >
                    <Database size={14} /> Field Mapping
                  </button>
                  <button 
                    onClick={() => setActiveTab('LOGS')}
                    className={\`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap \${activeTab === 'LOGS' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-100'}\`}
                  >
                    <Activity size={14} /> Sync Logs
                  </button>
                  
                  <div className="mt-auto hidden md:block pt-4">
                    <button 
                      onClick={() => handleDisconnect(activeIntegration.id)}
                      className="flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg w-full transition-colors"
                    >
                      <Trash2 size={14} /> Disconnect ERP
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-white">
                  {activeTab === 'CONNECTION' && renderConnectionTab()}
                  {activeTab === 'SYNC' && renderSyncSettingsTab()}
                  {activeTab === 'MAPPING' && renderMappingTab()}
                  {activeTab === 'LOGS' && renderLogsTab()}
                </div>
              </div>
            ) : (
              <div className="flex-1 p-6 flex flex-col items-center justify-center text-center bg-slate-50">
                <div className={\`w-20 h-20 rounded-2xl \${activeIntegration.iconColor} flex items-center justify-center text-white text-3xl font-black shadow-lg mb-6\`}>
                  {activeIntegration.initials}
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 mb-2">Connect to {activeIntegration.name}</h3>
                <p className="text-sm text-slate-500 mb-8 max-w-md leading-relaxed">
                  Authorize TaxFlow to securely access your data to automate compliance, fetch invoices, and push journal entries.
                </p>
                <form onSubmit={handleSubmitConnection} className="w-full max-w-sm space-y-4">
                  <button 
                    type="submit" 
                    disabled={isConnecting}
                    className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {isConnecting ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                    {isConnecting ? 'Authenticating...' : 'Secure OAuth Login'}
                  </button>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5">
                    <Lock size={10} /> 256-bit AES Encryption
                  </p>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default Integrations;`;

content = content.substring(0, logsTabEnd) + mainComponentReturn;
fs.writeFileSync(file, content);
