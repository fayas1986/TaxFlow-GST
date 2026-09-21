const fs = require('fs');
let code = fs.readFileSync('pages/Invoices.tsx', 'utf-8');

const importI18n = "import { useTranslation } from '../utils/i18n';";
if (!code.includes(importI18n)) {
    code = code.replace("import { exportToCSV } from '../utils/export';", "import { exportToCSV } from '../utils/export';\n" + importI18n);
}

const componentStart = "const Invoices: React.FC = () => {";
const langHook = "  const { language } = useTranslation();\n";
if (!code.includes(langHook)) {
    code = code.replace(componentStart, componentStart + "\n" + langHook);
}

const exportCall = "exportToCSV(dataToExport, `TaxFlow_Invoices_${activeCategory}_${new Date().toISOString().split('T')[0]}`);";
const exportCallNew = "exportToCSV(dataToExport, `TaxFlow_Invoices_${activeCategory}_${new Date().toISOString().split('T')[0]}`, language);";

if (code.includes(exportCall)) {
    code = code.replace(exportCall, exportCallNew);
}

fs.writeFileSync('pages/Invoices.tsx', code);
