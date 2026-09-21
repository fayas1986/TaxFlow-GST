const fs = require('fs');
const file = 'pages/Integrations.tsx';
let content = fs.readFileSync(file, 'utf8');

const qbSyncLogic = `
  const handleManualSync = () => {
    setIsSyncing(true);
    
    if (activeIntegration?.id === 'qb') {
      addLog('QUICKBOOKS: Starting manual sync for Invoices & Tax Liability.');
      setTimeout(() => addLog('QUICKBOOKS: Pulling 25 new commercial invoices from QBO...'), 500);
      setTimeout(() => addLog('QUICKBOOKS: Pushing Tax Liability Journal Entry for August...'), 1200);
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
        } else {
          addLog('Sync Completed successfully.');
        }
        setIntegrations(prev => prev.map(item => 
            item.id === activeIntegration?.id ? { ...item, lastSync: 'Just now' } : item
        ));
    }, 2000);
  };
`;

const originalSyncLogic = `  const handleManualSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
        setIsSyncing(false);
        setIntegrations(prev => prev.map(item => 
            item.id === activeIntegration?.id ? { ...item, lastSync: 'Just now' } : item
        ));
    }, 2000);
  };`;

content = content.replace(originalSyncLogic, qbSyncLogic);
fs.writeFileSync(file, content);
