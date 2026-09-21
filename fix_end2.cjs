const fs = require('fs');
let content = fs.readFileSync('pages/Integrations.tsx', 'utf8');

content = content.replace(/\n};\nexport default Integrations;\n*$/, '\nexport default Integrations;\n');

fs.writeFileSync('pages/Integrations.tsx', content);
