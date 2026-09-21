const fs = require('fs');
let code = fs.readFileSync('utils/csvImportValidator.ts', 'utf-8');

// Add import
if (!code.includes('GSTRuleEngine')) {
    code = code.replace("import { Invoice, TaxBreakdown } from '../types';", "import { Invoice, TaxBreakdown } from '../types';\nimport { GSTRuleEngine } from '../services/gstEngine/ruleEngine';");
}

const gstinRegexFunc = /export const validateGstin = \(gstin: string\): \{ isValid: boolean; error\?: string; stateName\?: string \} => \{[\s\S]*?\n\};\n/g;

const replacement = `export const validateGstin = (gstin: string): { isValid: boolean; error?: string; stateName?: string } => {
  const cleaned = gstin.trim().toUpperCase();
  if (!cleaned) {
    return { isValid: false, error: 'GSTIN cannot be empty' };
  }

  // Use Tax Engine Rule
  if (!GSTRuleEngine.validateGSTIN(cleaned)) {
    return { isValid: false, error: 'Invalid GSTIN structure (Failed GST Tax Engine Validation)' };
  }

  const stateCode = cleaned.substring(0, 2);
  if (!GST_STATE_CODES[stateCode]) {
    return { isValid: false, error: \`Invalid GST state code prefix '\${stateCode}'\` };
  }

  return { isValid: true, stateName: GST_STATE_CODES[stateCode] };
};
`;

code = code.replace(gstinRegexFunc, replacement);
fs.writeFileSync('utils/csvImportValidator.ts', code);
console.log("UPDATED");
