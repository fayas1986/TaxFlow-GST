const fs = require('fs');
const file = 'pages/Integrations.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add missing state
content = content.replace(
  'const [xeroSyncInvoices, setXeroSyncInvoices] = useState(true);',
  'const [xeroSyncInvoices, setXeroSyncInvoices] = useState(true);\n  const [xeroSyncTaxLiability, setXeroSyncTaxLiability] = useState(true);'
);

// 2. Add Xero Sync Settings
const xeroSyncSettings = `
        {activeIntegration?.id === 'xero' && (
          <div className="flex items-center justify-between p-4 border border-cyan-200 rounded-xl bg-cyan-50/50">
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-cyan-900 flex items-center gap-2">
                 <BarChart3 size={14} className="text-cyan-700"/> Sync General Ledger & Tax Liability
              </h4>
              <p className="text-[11px] text-cyan-700 mt-1 font-medium leading-relaxed">
                Automatically push Tax Liability Reports and Manual Journals directly to Xero.
              </p>
            </div>
            <div 
                onClick={() => setXeroSyncTaxLiability(!xeroSyncTaxLiability)}
                className={\`w-11 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 \${xeroSyncTaxLiability ? 'bg-cyan-600' : 'bg-cyan-200'}\`}
            >
                <div className={\`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 \${xeroSyncTaxLiability ? 'translate-x-5' : 'translate-x-0'}\`}></div>
            </div>
          </div>
        )}
`;
content = content.replace(
  '{activeIntegration?.id === \'qb\' && (',
  xeroSyncSettings + "\\n        {activeIntegration?.id === 'qb' && ("
);

// 3. Add Xero Mapping Tab
const xeroMapping = `
    if (activeIntegration?.id === 'xero') {
      return (
        <div className="space-y-6 pt-2">
          {/* Custom ERP Field Mapping Configuration Engine */}
          <FieldMappingConfiguration erpType="XERO" />

          {/* Xero Chart of Accounts Mapping */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileCheck size={14} className="text-cyan-600" />
              Xero Chart of Accounts & Tax Rates Mapping
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Map Xero Tax Rates and General Ledger Accounts (e.g., 820 - GST) to statutory TaxFlow GST definitions for automated Manual Journal creation.
            </p>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">TaxFlow Statutory Type</th>
                    <th className="p-3">Xero GL Account / Tax Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {['Output CGST Payable', 'Output SGST Payable', 'Output IGST Payable', 'Input CGST Receivable', 'Input SGST Receivable', 'Input IGST Receivable'].map((taxHead, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-bold text-slate-700">{taxHead}</td>
                      <td className="p-3">
                        <select className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:border-cyan-500 focus:outline-none">
                          <option>Select Xero Account</option>
                          <option>820 - GST (Current Liability)</option>
                          <option>821 - CGST Payable (Current Liability)</option>
                          <option>822 - SGST Payable (Current Liability)</option>
                          <option>823 - IGST Payable (Current Liability)</option>
                          <option>824 - GST Clearing (Current Asset)</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }
`;

content = content.replace(
  "if (activeIntegration?.id === 'qb') {",
  xeroMapping + "\\n    if (activeIntegration?.id === 'qb') {"
);

// 4. Add Xero Logs Tab
const xeroLogs = `
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
`;

content = content.replace(
  "if (activeIntegration?.id === 'qb') {",
  xeroLogs + "\\n    if (activeIntegration?.id === 'qb') {"
);

// 5. Update manual sync logic for Xero
const xeroSyncLogic = `
    } else if (activeIntegration?.id === 'xero') {
      addLog('XERO: Starting manual sync for Invoices & Tax Liability.');
      setTimeout(() => addLog('XERO: Pulling 32 new commercial invoices from Xero API...'), 500);
      setTimeout(() => addLog('XERO: Pushing Manual Journal Entry for August Tax Liability...'), 1200);
`;

content = content.replace(
  "} else if (activeIntegration?.id === 'tally') {",
  xeroSyncLogic.trim() + " } else if (activeIntegration?.id === 'tally') {"
);

const xeroSyncSuccess = `
        } else if (activeIntegration?.id === 'xero') {
          addLog('XERO: Sync Completed successfully.');
`;

content = content.replace(
  "} else {\\n          addLog('Sync Completed successfully.');",
  xeroSyncSuccess.trim() + " } else {\\n          addLog('Sync Completed successfully.');"
);

fs.writeFileSync(file, content);
