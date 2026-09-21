const fs = require('fs');
let file = fs.readFileSync('pages/Invoices.tsx', 'utf-8');

file = file.replace(
  `<CurrencyConverterModule />`,
  `<CurrencyConverterModule invoices={invoices || []} />`
);

fs.writeFileSync('pages/Invoices.tsx', file);
console.log("Invoices patched");
