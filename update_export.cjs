const fs = require('fs');

let i18n = fs.readFileSync('utils/i18n.tsx', 'utf-8');
if (i18n.includes("const translations: Record<Language, Translations>")) {
    i18n = i18n.replace("const translations:", "export const translations:");
    fs.writeFileSync('utils/i18n.tsx', i18n);
}

let exportTs = fs.readFileSync('utils/export.ts', 'utf-8');
if (!exportTs.includes('translations')) {
    exportTs = `import { Language, translations } from './i18n';\n\n` + exportTs;
    
    // Modify signature
    exportTs = exportTs.replace("export const exportToCSV = (data: any[], fileName: string) => {", "export const exportToCSV = (data: any[], fileName: string, language: Language = 'en') => {");
    
    // Modify headers translation
    const oldHeadersLogic = "const headers = Object.keys(data[0]);";
    const newHeadersLogic = `const headers = Object.keys(data[0]);\n  const translatedHeaders = headers.map(h => translations[language]?.[h] || translations['en']?.[h] || h);`;
    
    exportTs = exportTs.replace(oldHeadersLogic, newHeadersLogic);
    
    const pushHeadersOld = "csvRows.push(headers.join(','));";
    const pushHeadersNew = "csvRows.push(translatedHeaders.join(','));";
    
    exportTs = exportTs.replace(pushHeadersOld, pushHeadersNew);
    fs.writeFileSync('utils/export.ts', exportTs);
}
