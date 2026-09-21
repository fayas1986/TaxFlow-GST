const fs = require('fs');
let code = fs.readFileSync('components/BulkImportModal.tsx', 'utf-8');
code = code.replace("const headers = validRows[0].map(", "const headers = (validRows[0] as any[]).map(");
fs.writeFileSync('components/BulkImportModal.tsx', code);
