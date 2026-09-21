const fs = require('fs');
const file = 'pages/Integrations.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Xero to integrations list
const qbIntegrationsObj = `{ id: 'qb', name: 'QuickBooks', description: 'Connect your QuickBooks Online account.', status: 'DISCONNECTED', iconColor: 'bg-green-500', initials: 'QB', type: 'OAUTH' },`;
const xeroIntegrationsObj = `{ id: 'qb', name: 'QuickBooks', description: 'Connect your QuickBooks Online account.', status: 'DISCONNECTED', iconColor: 'bg-green-500', initials: 'QB', type: 'OAUTH' },\n    { id: 'xero', name: 'Xero Accounting', description: 'Automated invoice and tax rate sync via Xero OAuth 2.0 API.', status: 'DISCONNECTED', iconColor: 'bg-cyan-500', initials: 'XR', type: 'OAUTH' },`;
content = content.replace(qbIntegrationsObj, xeroIntegrationsObj);

// 2. Add Xero state variables
const xeroState = `
  // Xero State
  const [xeroTenantId, setXeroTenantId] = useState('');
  const [xeroSyncInvoices, setXeroSyncInvoices] = useState(true);
  
  const handleTestXeroConnection = () => {
    addLog('XERO: Redirecting to Xero OAuth 2.0...');
    window.location.href = '/api/v1/xero/auth';
  };
`;

content = content.replace(
  '  // QuickBooks Online State',
  xeroState + '\\n  // QuickBooks Online State'
);

// 3. Add Xero Connection Tab
const xeroConnectionTab = `
    if (activeIntegration.id === 'xero') {
      return (
        <div className="space-y-4 pt-2 text-xs">
          <div className="p-4 bg-cyan-50/70 border border-cyan-200/80 rounded-xl flex items-start gap-3">
            <div className="p-2 bg-cyan-100 text-cyan-700 rounded-lg shrink-0">
              <Server size={18} />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 text-xs">Xero OAuth 2.0 Connector</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Connects to Xero to sync invoices and chart of accounts mapping for TaxFlow liability.
              </p>
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Connection Status</p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Not authenticated</p>
              </div>
              <button 
                type="button"
                onClick={handleTestXeroConnection}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-[11px] uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2"
              >
                <RefreshCw size={14} />
                Connect to Xero
              </button>
            </div>
          </div>
        </div>
      );
    }
`;

content = content.replace(
  "if (activeIntegration.id === 'qb') {",
  xeroConnectionTab + "\\n    if (activeIntegration.id === 'qb') {"
);

fs.writeFileSync(file, content);
