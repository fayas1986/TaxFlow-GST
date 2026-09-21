const fs = require('fs');
let file = fs.readFileSync('pages/AuditLogs.tsx', 'utf-8');

// Add imports
file = file.replace(
  `import TamperProofExportModal from '../components/TamperProofExportModal';`,
  `import TamperProofExportModal from '../components/TamperProofExportModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';`
);

// Add the download function
const downloadFunc = `  // Download Retention Audit Summary PDF
  const downloadRetentionAuditSummary = () => {
    // Filter retention deletion logs within the selected date range
    let retentionLogs = logs.filter(log => log.module === 'COMPLIANCE' && (log.action.includes('Document Retention') || log.details?.includes('Automated retention')));
    
    if (selectedDateRange !== 'ALL') {
      const now = new Date().getTime();
      let matchesDate = (logTime) => true;
      if (selectedDateRange === 'WEEKLY') {
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
        matchesDate = (logTime) => logTime >= oneWeekAgo;
      } else if (selectedDateRange === 'MONTHLY') {
        const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
        matchesDate = (logTime) => logTime >= oneMonthAgo;
      } else if (selectedDateRange === 'QUARTERLY') {
        const oneQuarterAgo = now - 90 * 24 * 60 * 60 * 1000;
        matchesDate = (logTime) => logTime >= oneQuarterAgo;
      } else if (selectedDateRange === 'YEARLY') {
        const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
        matchesDate = (logTime) => logTime >= oneYearAgo;
      } else if (selectedDateRange === 'CUSTOM') {
        let sTime = startDate ? new Date(startDate).setHours(0,0,0,0) : 0;
        let eTime = endDate ? new Date(endDate).setHours(23,59,59,999) : Infinity;
        matchesDate = (logTime) => logTime >= sTime && logTime <= eTime;
      }
      retentionLogs = retentionLogs.filter(log => matchesDate(new Date(log.timestamp).getTime()));
    }

    if (retentionLogs.length === 0) {
      alert('No retention deletion logs found for the selected date range.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    
    // Title
    doc.setFontSize(16);
    doc.text('Automated Retention Deletion Audit Summary', 14, 15);
    
    // Subtitle
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(\`Generated on: \${new Date().toLocaleString()}\`, 14, 22);
    
    const tableData = retentionLogs.map(log => {
      const parsedChanges = typeof log.changes === 'string' ? JSON.parse(log.changes || '[]') : (log.changes || []);
      const fileName = parsedChanges.find((c: any) => c.field === 'File Name')?.oldValue || 'Unknown';
      const creationDate = parsedChanges.find((c: any) => c.field === 'Creation Date')?.oldValue || 'Unknown';
      const deletionDate = parsedChanges.find((c: any) => c.field === 'Deletion Date')?.newValue || new Date(log.timestamp).toISOString();
      const policyAge = parsedChanges.find((c: any) => c.field === 'Policy Age')?.newValue || 'Unknown';

      return [
        new Date(log.timestamp).toLocaleString(),
        fileName,
        creationDate,
        deletionDate,
        policyAge,
        log.hash.substring(0, 16) + '...'
      ];
    });

    autoTable(doc, {
      startY: 30,
      head: [['Timestamp', 'File Name', 'Original Creation', 'Deletion Date', 'Policy Applied', 'Audit Hash']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8 },
    });

    doc.save(\`Retention_Audit_Summary_\${Date.now()}.pdf\`);
  };
`;

file = file.replace(
  `  // Export to JSON helper`,
  downloadFunc + `\n  // Export to JSON helper`
);

// Add the button
const buttonJSX = `                <button
                  onClick={downloadRetentionAuditSummary}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FBBF24] hover:bg-[#F59E0B] text-[#111827] rounded-xl text-xs font-black transition-all shadow-sm"
                  title="Download PDF report of retention deletions for the selected date range"
                >
                  <Download size={13} />
                  Download Audit Summary
                </button>

                <button`;

file = file.replace(
  `                <button
                  onClick={exportCSV}`,
  buttonJSX.replace('                <button', '                <button\n                  onClick={exportCSV}')
);

fs.writeFileSync('pages/AuditLogs.tsx', file);
console.log("AuditLogs.tsx patched with PDF download!");
