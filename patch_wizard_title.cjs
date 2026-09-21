const fs = require('fs');
let file = fs.readFileSync('components/BulkImportModal.tsx', 'utf-8');

file = file.replace(
  `Bulk Invoice Ingestion Hub`,
  `CSV Bulk-Import Wizard`
);

fs.writeFileSync('components/BulkImportModal.tsx', file);
console.log("Wizard title patched!");
