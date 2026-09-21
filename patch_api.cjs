const fs = require('fs');
const file = 'services/api.ts';
let content = fs.readFileSync(file, 'utf8');

// The exact string inside createInvoice
const target = `    ...invoiceData as Invoice,
    id: \`inv-\${Date.now()}\`,
    status: 'PENDING',`;

const replacement = `    ...invoiceData as Invoice,
    id: \`inv-\${Date.now()}\`,
    status: invoiceData.status || 'DRAFT',`;

content = content.replace(target, replacement);
fs.writeFileSync(file, content);
