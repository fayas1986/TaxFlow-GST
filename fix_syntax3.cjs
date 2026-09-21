const fs = require('fs');
const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/\\n  \/\/ --- QUICKBOOKS ONLINE OAUTH 2.0 ENDPOINTS ---/g, "\n  // --- QUICKBOOKS ONLINE OAUTH 2.0 ENDPOINTS ---");
content = content.replace(/\\n  \/\/ --- AI DOCUMENT TRANSLATION ENDPOINT ---/g, "\n  // --- AI DOCUMENT TRANSLATION ENDPOINT ---");

fs.writeFileSync(file, content);
