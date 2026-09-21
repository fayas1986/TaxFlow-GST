const fs = require('fs');

function updateFile(filePath, exportCallRegex, exportCallNewFunc) {
    let code = fs.readFileSync(filePath, 'utf-8');
    const importI18n = "import { useTranslation } from '../utils/i18n';";
    if (!code.includes(importI18n)) {
        code = code.replace("import { exportToCSV } from '../utils/export';", "import { exportToCSV } from '../utils/export';\n" + importI18n);
    }
    
    let componentStartMatch = code.match(/const [A-Za-z0-9_]+: React\.FC = \(\) => {/);
    if (componentStartMatch) {
        const langHook = "  const { language } = useTranslation();\n";
        if (!code.includes(langHook)) {
            code = code.replace(componentStartMatch[0], componentStartMatch[0] + "\n" + langHook);
        }
    }
    
    code = code.replace(exportCallRegex, exportCallNewFunc);
    fs.writeFileSync(filePath, code);
}

// update ExceptionInboxPage.tsx
updateFile('pages/ExceptionInboxPage.tsx', 
    /exportToCSV\(exportData, `gst-exceptions-report-\${new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]}`\);/g, 
    "exportToCSV(exportData, `gst-exceptions-report-${new Date().toISOString().split('T')[0]}`, language);"
);

// update Reconciliation.tsx
updateFile('pages/Reconciliation.tsx', 
    /exportToCSV\(dataToExport, `TaxFlow_Recon_\${activeTab}_\${new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]}`\);/g, 
    "exportToCSV(dataToExport, `TaxFlow_Recon_${activeTab}_${new Date().toISOString().split('T')[0]}`, language);"
);

