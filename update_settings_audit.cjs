const fs = require('fs');
let code = fs.readFileSync('pages/Settings.tsx', 'utf-8');

const importAuditLogs = "import { AuditLogs } from '../components/organization/AuditLogs';";
if (!code.includes("import { AuditLogs }")) {
    code = code.replace("import UserAccessManagement from '../components/organization/UserAccessManagement';", "import UserAccessManagement from '../components/organization/UserAccessManagement';\n" + importAuditLogs);
}

const auditTabStart = "{activeTab === 'AUDIT' && (";
const auditTabEnd = "          {activeTab === 'PRIVACY' && (";

if (code.includes(auditTabStart) && code.includes(auditTabEnd)) {
    const beforeAudit = code.substring(0, code.indexOf(auditTabStart));
    const afterAudit = code.substring(code.indexOf(auditTabEnd));
    
    const newAuditTab = `{activeTab === 'AUDIT' && (
             <AuditLogs 
               auditLogs={auditLogs} 
               isAuditLoading={isAuditLoading} 
               onExport={handleExportAuditLogs} 
             />
          )}
          `;
          
    code = beforeAudit + newAuditTab + afterAudit;
}

fs.writeFileSync('pages/Settings.tsx', code);
