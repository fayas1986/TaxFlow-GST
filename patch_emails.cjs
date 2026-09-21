const fs = require('fs');
let file = fs.readFileSync('pages/DocumentVaultPage.tsx', 'utf-8');

// 1. In handleUploadSubmit, after saveToStorage(updated);
file = file.replace(
  `    saveToStorage(updated);\n    setSelectedDoc(newDoc); // highlight it right away by opening the inspector!`,
  `    saveToStorage(updated);\n    if (newDoc.status === 'PENDING_ACTION') {\n      dispatchEmailNotification('Action Required: ' + newDoc.title, 'A new document requires review before ' + newDoc.replyDeadline + '. Reference: ' + newDoc.refNumber, 'auditor@vault.local');\n    }\n    setSelectedDoc(newDoc); // highlight it right away by opening the inspector!`
);

// 2. In handleUploadSubmit for INVOICE EXTRACT
file = file.replace(
  `    saveToStorage(updated);\n\n    // Reset Form`,
  `    saveToStorage(updated);\n    if (newDoc.status === 'PENDING_ACTION') {\n      dispatchEmailNotification('Action Required: ' + newDoc.title, 'A scanned invoice requires review before ' + newDoc.replyDeadline + '. Reference: ' + newDoc.refNumber, 'auditor@vault.local');\n    }\n\n    // Reset Form`
);

// 3. In handleAddComment
file = file.replace(
  `      const updated = { ...d, comments: updatedComments };\n      if (selectedDoc?.id === docId) {\n        setSelectedDoc(updated);\n      }\n      return updated;`,
  `      const updated = { ...d, comments: updatedComments };\n      if (selectedDoc?.id === docId) {\n        setSelectedDoc(updated);\n      }\n      dispatchEmailNotification('New Comment on Document', 'A new comment was added to a document by ' + newComment.authorName + ': "' + newComment.content + '"', 'team@vault.local');\n      return updated;`
);

// 4. In autoTagDocument
file = file.replace(
  `      return { ...doc, tags: Array.from(newTags), activityLog: [newActivity, ...(doc.activityLog || [])] };\n    }\n    \n    return { ...doc, tags: Array.from(newTags) };`,
  `      dispatchEmailNotification('Document Tagged: ' + doc.title, 'Document was auto-tagged with new AI content rules. New tags: ' + Array.from(newTags).join(', '), 'team@vault.local');\n      return { ...doc, tags: Array.from(newTags), activityLog: [newActivity, ...(doc.activityLog || [])] };\n    }\n    \n    return { ...doc, tags: Array.from(newTags) };`
);

fs.writeFileSync('pages/DocumentVaultPage.tsx', file);
