const fs = require('fs');
const file = 'pages/Integrations.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/\\n  \/\/ QuickBooks Online State/g, '\n  // QuickBooks Online State');

fs.writeFileSync(file, content);
