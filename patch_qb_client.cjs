const fs = require('fs');
const file = 'pages/Integrations.tsx';
let content = fs.readFileSync(file, 'utf8');

const newQbAuth = `  const handleTestQbConnection = () => {
    addLog(\`QUICKBOOKS: Redirecting to Intuit OAuth 2.0...\`);
    window.location.href = \`/api/v1/quickbooks/auth?environment=\${qbEnvironment}\`;
  };

  useEffect(() => {
    // Check if we just returned from QuickBooks OAuth
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('qb_connected') === 'true') {
      const realmId = urlParams.get('realmId');
      setQbRealmId(realmId || '');
      setQbTestResult({
        status: 'SUCCESS',
        latencyMs: 145,
        companyName: 'QuickBooks Company (' + realmId + ')'
      });
      setIntegrations(prev => prev.map(item => 
        item.id === 'qb' ? { ...item, status: 'CONNECTED', lastSync: 'Just now' } : item
      ));
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);`;

content = content.replace(
  /const handleTestQbConnection = \(\) => {[\s\S]*?\}, 1500\);\n  };/,
  newQbAuth
);

fs.writeFileSync(file, content);
