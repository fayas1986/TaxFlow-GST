const fs = require('fs');
let file = fs.readFileSync('pages/DocumentVaultPage.tsx', 'utf-8');

// 1. Add import for logAuditAction
file = file.replace(
  `import { localDb } from '../utils/localDb';`,
  `import { localDb } from '../utils/localDb';\nimport { logAuditAction } from '../services/api';`
);

// 2. Add handleExecuteRetention inside the component
const executionFunc = `
  const handleExecuteRetention = async () => {
    const flaggedDocs = documents.filter(isRetentionFlagged);
    if (flaggedDocs.length === 0) {
      alert('No documents are currently flagged for retention.');
      return;
    }

    const confirmMsg = \`Are you sure you want to \${retentionPolicy.action.toLowerCase()} \${flaggedDocs.length} document(s)? This action will be securely logged in the global audit trail.\`;
    if (!confirm(confirmMsg)) return;

    // Log each removal to the global audit trail
    for (const doc of flaggedDocs) {
      await logAuditAction(
        \`Document Retention \${retentionPolicy.action === 'ARCHIVE' ? 'Archived' : 'Deleted'}\`,
        'COMPLIANCE',
        \`Automated retention service processed document: \${doc.title} (\${doc.refNumber})\`,
        [
          { field: 'File Name', oldValue: doc.title, newValue: 'REMOVED' },
          { field: 'Original Creation Date', oldValue: doc.issueDate, newValue: '-' },
          { field: 'Deletion Date', oldValue: '-', newValue: new Date().toISOString() },
          { field: 'Retention Policy', oldValue: '-', newValue: \`\${retentionPolicy.years} Years\` }
        ]
      );
    }

    const remainingDocs = documents.filter(doc => !isRetentionFlagged(doc));
    setDocuments(remainingDocs);
    saveToStorage(remainingDocs);
    
    if (selectedDoc && isRetentionFlagged(selectedDoc)) {
      setSelectedDoc(null);
    }
    
    setIsRetentionModalOpen(false);
    dispatchEmailNotification(
      \`Retention Policy Executed\`, 
      \`Successfully \${retentionPolicy.action.toLowerCase()}d \${flaggedDocs.length} aging document(s).\`,
      'compliance-team@vault.local'
    );
  };
`;
file = file.replace(
  `  const [tagSearchMode, setTagSearchMode] = useState<'AND' | 'OR'>('OR');`,
  executionFunc + `\n  const [tagSearchMode, setTagSearchMode] = useState<'AND' | 'OR'>('OR');`
);

// 3. Add the "Execute" button in the modal footer
const originalFooter = `              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setIsRetentionModalOpen(false)}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                >
                  Save Policy Config
                </button>
              </div>`;
              
const updatedFooter = `              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                <button 
                  onClick={handleExecuteRetention}
                  className="px-4 py-2 text-rose-600 hover:bg-rose-50 font-bold text-xs rounded-xl transition-all flex items-center gap-2"
                  title="Manually trigger the retention policy"
                >
                  <AlertTriangle size={14} /> Execute Policy Now
                </button>
                <button 
                  onClick={() => setIsRetentionModalOpen(false)}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                >
                  Save Policy Config
                </button>
              </div>`;
              
file = file.replace(originalFooter, updatedFooter);

fs.writeFileSync('pages/DocumentVaultPage.tsx', file);
