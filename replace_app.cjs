const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

const permTarget = "'/risk-analysis': [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN],";
const permReplacement = permTarget + "\n  '/tax-forecasting': [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN],";

if (code.includes(permTarget)) {
    code = code.replace(permTarget, permReplacement);
}

const routeTarget = "case '/risk-analysis':\n        return <RiskAnalysis />;";
const routeReplacement = routeTarget + "\n      case '/tax-forecasting':\n        return <TaxForecastingPage />;";

if (code.includes(routeTarget)) {
    code = code.replace(routeTarget, routeReplacement);
}

const importTarget = "import RiskAnalysis from './pages/RiskAnalysis';";
const importReplacement = importTarget + "\nimport TaxForecastingPage from './pages/TaxForecastingPage';";

if (code.includes(importTarget)) {
    code = code.replace(importTarget, importReplacement);
}

fs.writeFileSync('App.tsx', code);
console.log("REPLACED");
