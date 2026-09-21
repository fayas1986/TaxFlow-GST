const fs = require('fs');
const file = 'pages/DocumentVaultPage.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldTabs = `            {[
              { id: 'ALL', label: 'All Documents', count: documents.length, icon: FileText },
              { id: 'CERTIFICATE', label: 'GST Certificates', count: totalCertificates, icon: Award },
              { id: 'AUDIT_REPORT', label: 'Audit Reports', count: totalAudits, icon: ClipboardList },
              { id: 'CORRESPONDENCE', label: 'Official Correspondence', count: documents.filter(d => d.category === 'CORRESPONDENCE').length, icon: Mail },
              { id: 'OTHER', label: 'Other Appendices', count: documents.filter(d => d.category === 'OTHER').length, icon: FileText }
            ].map(cat => (`;

const newTabs = `            {[
              { id: 'ALL', label: 'All Documents', count: documents.length, icon: FileText },
              { id: 'CERTIFICATE', label: 'GST Certificates', count: totalCertificates, icon: Award },
              { id: 'AUDIT_REPORT', label: 'Audit Reports', count: totalAudits, icon: ClipboardList },
              { id: 'CORRESPONDENCE', label: 'Official Correspondence', count: documents.filter(d => d.category === 'CORRESPONDENCE').length, icon: Mail },
              { id: 'INVOICE', label: 'Invoices', count: documents.filter(d => d.category === 'INVOICE').length, icon: FileText },
              { id: 'OTHER', label: 'Other Appendices', count: documents.filter(d => d.category === 'OTHER').length, icon: FileText }
            ].map(cat => (`;

content = content.replace(oldTabs, newTabs);
fs.writeFileSync(file, content);
