const fs = require('fs');
const file = 'pages/Integrations.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/\\n    if \(activeIntegration.id === 'qb'\) \{/g, "\n    if (activeIntegration.id === 'qb') {");

fs.writeFileSync(file, content);
