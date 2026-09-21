const fs = require('fs');
const file = 'pages/Integrations.tsx';
let content = fs.readFileSync(file, 'utf8');

const qbConnection = `
    if (activeIntegration.id === 'qb') {
      return (
        <div className="space-y-4 pt-2 text-xs">
          <div className="p-4 bg-green-50/70 border border-green-200/80 rounded-xl flex items-start gap-3">
            <div className="p-2 bg-green-100 text-green-700 rounded-lg shrink-0">
              <Server size={18} />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 text-xs">Intuit QuickBooks Online Connector</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Connects via Intuit Developer OAuth 2.0 to securely sync Invoices, Expenses, and General Ledger (Tax Liability) reports.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Globe size={12} /> Environment
              </label>
              <select 
                value={qbEnvironment} 
                onChange={(e) => setQbEnvironment(e.target.value as any)} 
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:border-green-500 focus:outline-none"
              >
                <option value="Production">Production</option>
                <option value="Sandbox">Sandbox</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Database size={12} /> Realm ID (Company ID)
              </label>
              <input 
                value={qbRealmId} 
                onChange={(e) => setQbRealmId(e.target.value)} 
                placeholder="e.g. 193514... (Optional)" 
                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs font-semibold focus:border-green-500 focus:outline-none" 
              />
            </div>
          </div>

          {/* Test Connection Button / Status */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Connection Status</p>
                {qbTestResult ? (
                  <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                    <CheckCircle2 size={12} /> Connected to {qbTestResult.companyName} ({qbTestResult.latencyMs}ms)
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Not authenticated</p>
                )}
              </div>
              <button 
                type="button"
                onClick={handleTestQbConnection}
                disabled={qbTesting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2"
              >
                {qbTesting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Authenticate with Intuit
              </button>
            </div>
          </div>
        </div>
      );
    }
`;

content = content.replace(
  "if (activeIntegration.id === 'dynamics') {",
  qbConnection + "\n    if (activeIntegration.id === 'dynamics') {"
);

fs.writeFileSync(file, content);
