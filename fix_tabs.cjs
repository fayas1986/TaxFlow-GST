const fs = require('fs');
const file = 'pages/Integrations.tsx';
let content = fs.readFileSync(file, 'utf8');

// We will do some surgery
// 1. handleManualSync
const handleManualSyncStart = content.indexOf('  const handleManualSync = () => {');
const handleManualSyncEnd = content.indexOf('  const handleSubmitConnection = (e: React.FormEvent) => {');
const newHandleManualSync = `  const handleManualSync = () => {
    setIsSyncing(true);
    
    if (activeIntegration?.id === 'qb') {
      addLog('QUICKBOOKS: Starting manual sync for Invoices & Tax Liability.');
      setTimeout(() => addLog('QUICKBOOKS: Pulling 25 new commercial invoices from QBO...'), 500);
      setTimeout(() => addLog('QUICKBOOKS: Pushing Tax Liability Journal Entry for August...'), 1200);
    } else if (activeIntegration?.id === 'xero') {
      addLog('XERO: Starting manual sync for Invoices & Tax Liability.');
      setTimeout(() => addLog('XERO: Pulling 32 new commercial invoices from Xero API...'), 500);
      setTimeout(() => addLog('XERO: Pushing Manual Journal Entry for August Tax Liability...'), 1200);
    } else if (activeIntegration?.id === 'tally') {
      addLog('TALLY_PRIME: Starting manual sync over ODBC.');
    } else if (activeIntegration?.id === 'dynamics') {
      addLog('DYNAMICS_BC: Starting manual sync over OData v4 REST.');
    } else if (activeIntegration?.id === 'dynamics_fo') {
      addLog('DYNAMICS_FO: Starting manual sync over DMF batch.');
    } else {
      addLog('Starting manual sync.');
    }
    
    setTimeout(() => {
        setIsSyncing(false);
        if (activeIntegration?.id === 'qb') {
          addLog('QUICKBOOKS: Sync Completed successfully.');
        } else if (activeIntegration?.id === 'xero') {
          addLog('XERO: Sync Completed successfully.');
        } else {
          addLog('Sync Completed successfully.');
        }
        setIntegrations(prev => prev.map(item => 
            item.id === activeIntegration?.id ? { ...item, lastSync: 'Just now' } : item
        ));
    }, 2000);
  };

`;
content = content.substring(0, handleManualSyncStart) + newHandleManualSync + content.substring(handleManualSyncEnd);

fs.writeFileSync(file, content);
