const fs = require('fs');
let code = fs.readFileSync('components/Layout.tsx', 'utf-8');

const targetLine = "{ label: 'Risk Analysis', icon: AlertTriangle, path: '/risk-analysis', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.FINANCE_MANAGER] },";
const replacement = targetLine + "\n    { label: 'Tax Forecasting', icon: TrendingUp, path: '/tax-forecasting', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.FINANCE_MANAGER] },";

if (code.includes(targetLine)) {
    code = code.replace(targetLine, replacement);
    
    if (!code.includes('TrendingUp')) {
        code = code.replace("import {", "import {\n  TrendingUp,");
    }
    
    fs.writeFileSync('components/Layout.tsx', code);
    console.log("REPLACED");
} else {
    console.log("NOT FOUND");
}
