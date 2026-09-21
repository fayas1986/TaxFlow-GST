const fs = require('fs');
const file = 'pages/Integrations.tsx';
let content = fs.readFileSync(file, 'utf8');

const xeroEffect = `    if (urlParams.get('xero_connected') === 'true') {
      setIntegrations(prev => prev.map(item => 
        item.id === 'xero' ? { ...item, status: 'CONNECTED', lastSync: 'Just now' } : item
      ));
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }`;

content = content.replace(
  '// Clean up URL\n      window.history.replaceState({}, document.title, window.location.pathname);\n    }',
  '// Clean up URL\n      window.history.replaceState({}, document.title, window.location.pathname);\n    }\n' + xeroEffect
);

fs.writeFileSync(file, content);
