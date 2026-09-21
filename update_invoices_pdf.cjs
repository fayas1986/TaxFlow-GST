const fs = require('fs');
let code = fs.readFileSync('pages/Invoices.tsx', 'utf-8');

const oldHandle = `  const handleProfessionalExport = (config: ExportConfig) => {
    if (!selectedInvoice) return;
    const doc = generateStyledDocument(selectedInvoice, config);
    console.log('Generating styled invoice:', doc);
    alert(\`Success! Generating "\${doc.template.name}" \${config.paperSize} invoice for \${selectedInvoice.invoiceNumber}.\`);
  };`;

const newHandle = `  const handleProfessionalExport = (config: ExportConfig) => {
    if (!selectedInvoice) return;
    generateStyledDocument(selectedInvoice, config);
    setShowTemplateSelector(false);
  };`;

if (code.includes(oldHandle)) {
    code = code.replace(oldHandle, newHandle);
}

fs.writeFileSync('pages/Invoices.tsx', code);
