const fs = require('fs');
let code = fs.readFileSync('components/RegulatoryChangeModule.tsx', 'utf-8');

// 1. Import
const importTarget = "import { RegulatoryDeadlineTimeline } from './RegulatoryDeadlineTimeline';";
const importReplacement = importTarget + "\nimport { GlobalTaxRatesLookup } from './GlobalTaxRatesLookup';";
if (code.includes(importTarget)) {
    code = code.replace(importTarget, importReplacement);
}

// 2. Add TAB State
const stateTarget = "const [activeTab, setActiveTab] = useState<'BOARD' | 'LIVE_RULES' | 'TIMELINE' | 'AUDIT_TRAIL'>('BOARD');";
const stateReplacement = "const [activeTab, setActiveTab] = useState<'BOARD' | 'LIVE_RULES' | 'TIMELINE' | 'AUDIT_TRAIL' | 'GLOBAL_RATES'>('BOARD');";
if (code.includes(stateTarget)) {
    code = code.replace(stateTarget, stateReplacement);
}

// 3. Add Button for Tab
const buttonTarget = `<button 
          onClick={() => setActiveTab('AUDIT_TRAIL')}
          className={\`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 \${
            activeTab === 'AUDIT_TRAIL' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:text-slate-900'
          }\`}
        >
          <History size={14} /> System patch ledger
        </button>`;

const buttonReplacement = buttonTarget + `
        <button 
          onClick={() => setActiveTab('GLOBAL_RATES')}
          className={\`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 \${
            activeTab === 'GLOBAL_RATES' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:text-slate-900'
          }\`}
        >
          <Globe size={14} /> Global Tax Rates
        </button>`;

if (code.includes(buttonTarget)) {
    code = code.replace(buttonTarget, buttonReplacement);
} else {
    console.log("Could not find button target");
}

// 4. Add the Globe icon to imports
const lucideImports = "BookOpen, User, Sparkles, Clock";
const lucideReplacements = lucideImports + ", Globe";
if (code.includes(lucideImports)) {
    code = code.replace(lucideImports, lucideReplacements);
}

// 5. Add Tab content
const contentTarget = "{/* TAB 4: SYSTEM PATCH LEDGER */}";
const contentReplacement = `{/* TAB 5: GLOBAL TAX RATES */}
      {activeTab === 'GLOBAL_RATES' && (
        <GlobalTaxRatesLookup />
      )}
      
      ` + contentTarget;

if (code.includes(contentTarget)) {
    code = code.replace(contentTarget, contentReplacement);
}

fs.writeFileSync('components/RegulatoryChangeModule.tsx', code);
console.log("REGULATORY MODULE UPDATED");
