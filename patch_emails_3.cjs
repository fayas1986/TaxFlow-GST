const fs = require('fs');
let file = fs.readFileSync('pages/DocumentVaultPage.tsx', 'utf-8');

file = file.replace(
  `    setDocuments(updatedDocuments);\n    saveToStorage(updatedDocuments);\n    setSelectedDoc(updatedDoc);\n    \n    // Reset file input`,
  `    setDocuments(updatedDocuments);\n    saveToStorage(updatedDocuments);\n    setSelectedDoc(updatedDoc);\n    dispatchEmailNotification('Document Updated: ' + updatedDoc.title, 'A new version of this document has been uploaded.', 'team@vault.local');\n    \n    // Reset file input`
);

fs.writeFileSync('pages/DocumentVaultPage.tsx', file);
