const fs = require('fs');
let file = fs.readFileSync('pages/DocumentVaultPage.tsx', 'utf-8');

file = file.replace(
  `    setDocuments(updatedDocuments);\n    saveToStorage(updatedDocuments);\n    setSelectedDoc(updatedDoc);\n  };`,
  `    setDocuments(updatedDocuments);\n    saveToStorage(updatedDocuments);\n    setSelectedDoc(updatedDoc);\n    dispatchEmailNotification('Document Version Restored', 'Document "' + updatedDoc.title + '" was restored to an older version.', 'team@vault.local');\n  };`
);

fs.writeFileSync('pages/DocumentVaultPage.tsx', file);
