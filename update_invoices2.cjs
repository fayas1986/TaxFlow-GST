const fs = require('fs');
let code = fs.readFileSync('pages/Invoices.tsx', 'utf-8');

// 1. Import AutoCategorizationRulesModal
const importTarget = "import { CurrencyConverterModule } from '../components/CurrencyConverterModule';";
const importReplacement = importTarget + "\nimport { AutoCategorizationRulesModal } from '../components/AutoCategorizationRulesModal';";
if (code.includes(importTarget)) {
    code = code.replace(importTarget, importReplacement);
} else {
    console.log("FAILED to find importTarget");
}

// 2. Add state
const stateTarget = "const [isCurrencyConverterOpen, setIsCurrencyConverterOpen] = useState(false);";
const stateReplacement = stateTarget + "\n  const [isAutoCatRulesOpen, setIsAutoCatRulesOpen] = useState(false);";
if (code.includes(stateTarget)) {
    code = code.replace(stateTarget, stateReplacement);
} else {
    console.log("FAILED to find stateTarget");
}

// 3. Add button in the header
const buttonTarget = `<button onClick={() => setIsCurrencyConverterOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
              <Globe size={16} className="text-blue-500"/> FX
            </button>`;
const buttonReplacement = `<button onClick={() => setIsAutoCatRulesOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
              <Zap size={16} className="text-indigo-500"/> Rules
            </button>\n            ` + buttonTarget;
if (code.includes(buttonTarget)) {
    code = code.replace(buttonTarget, buttonReplacement);
} else {
    console.log("FAILED to find buttonTarget");
}

// 4. Add modal
const modalTarget = `      <AnimatePresence>
        {isCurrencyConverterOpen && (`;
const modalReplacement = `      <AutoCategorizationRulesModal 
        isOpen={isAutoCatRulesOpen} 
        onClose={() => setIsAutoCatRulesOpen(false)} 
      />\n\n` + modalTarget;
if (code.includes(modalTarget)) {
    code = code.replace(modalTarget, modalReplacement);
} else {
    console.log("FAILED to find modalTarget");
}

fs.writeFileSync('pages/Invoices.tsx', code);
console.log("INVOICES UPDATED");
