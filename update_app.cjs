const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

const importTarget = "import { WorkspaceSyncProvider } from './components/WorkspaceSyncContext';";
const importReplacement = importTarget + "\nimport { LanguageProvider } from './utils/i18n';";

if (code.includes(importTarget)) {
    code = code.replace(importTarget, importReplacement);
} else {
    console.log("Failed to find importTarget");
}

const wrapperTarget = "<WorkspaceSyncProvider currentPath={location} onNavigate={navigate}>";
const wrapperReplacement = "<LanguageProvider>\n      " + wrapperTarget;

if (code.includes(wrapperTarget)) {
    code = code.replace(wrapperTarget, wrapperReplacement);
} else {
    console.log("Failed to find wrapperTarget");
}

const wrapperEndTarget = "</WorkspaceSyncProvider>";
const wrapperEndReplacement = wrapperEndTarget + "\n      </LanguageProvider>";

if (code.includes(wrapperEndTarget)) {
    code = code.replace(wrapperEndTarget, wrapperEndReplacement);
} else {
    console.log("Failed to find wrapperEndTarget");
}

fs.writeFileSync('App.tsx', code);
console.log("APP UPDATED");
