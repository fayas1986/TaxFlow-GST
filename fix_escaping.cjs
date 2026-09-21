const fs = require('fs');
let content = fs.readFileSync('pages/Integrations.tsx', 'utf8');

content = content.replace(/\\`/g, '`').replace(/\\\$/g, '$');

fs.writeFileSync('pages/Integrations.tsx', content);
