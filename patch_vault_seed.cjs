const fs = require('fs');
const file = 'pages/DocumentVaultPage.tsx';
let content = fs.readFileSync(file, 'utf8');

const foreignInvoice = `  {
    id: 'doc-foreign-1',
    title: 'Facture Commerciale - Acme SAS France',
    refNumber: 'INV-FR-2026-0892',
    category: 'INVOICE',
    issueDate: '2026-08-20',
    uploadDate: '2026-08-22',
    status: 'ACTIVE',
    tags: ['Cross-Border', 'France', 'Import'],
    description: 'Facture commerciale pour services de conseil numérique.\\nMontant Total: €12,500.00\\nTVA: €2,500.00\\nMontant Net: €15,000.00\\nVeuillez régler ce montant sous 30 jours. Coordonnées bancaires jointes.',
    fileSize: '1.2 MB',
    fileType: 'application/pdf',
    sha256Hash: 'e4d909c290d0fb1ca068ffaddf22cbd0a245582f3c7e47be48',
    authorityName: 'Acme SAS France',
    isConfidential: false,
    activityLog: [
      { date: '2026-08-22 10:15', action: 'Invoice Uploaded via Cross-Border Portal', user: 'System' }
    ]
  },`;

content = content.replace(
  'const DEFAULT_DOCUMENTS: DocumentRecord[] = [',
  'const DEFAULT_DOCUMENTS: DocumentRecord[] = [\n' + foreignInvoice
);

fs.writeFileSync(file, content);
