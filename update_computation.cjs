const fs = require('fs');
let code = fs.readFileSync('pages/Computation.tsx', 'utf-8');

const importTarget = "import { ProactiveTaxAlerts } from '../components/ProactiveTaxAlerts';";
const importReplacement = importTarget + "\nimport { CurrencyConverterModule } from '../components/CurrencyConverterModule';";

if (code.includes(importTarget)) {
    code = code.replace(importTarget, importReplacement);
}

const toolsTarget = "<Calculator size={15} /> RCM Calculator\n                     </button>";
const toolsReplacement = toolsTarget + `
                     <button
                          onClick={() => setActiveToolSubTab('CURRENCY' as any)}
                          className={\`flex-1 py-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 \${activeToolSubTab === 'CURRENCY' as any ? 'bg-white shadow-xs text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-700'}\`}
                     >
                          <Globe size={15} /> FX Converter
                     </button>`;

if (code.includes(toolsTarget)) {
    code = code.replace(toolsTarget, toolsReplacement);
}

const panelTarget = "{activeToolSubTab === 'PENALTY' && (";
const panelReplacement = `{activeToolSubTab === 'CURRENCY' as any && (
                     <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <CurrencyConverterModule />
                     </div>
                )}

                {activeToolSubTab === 'PENALTY' && (`;

if (code.includes(panelTarget)) {
    code = code.replace(panelTarget, panelReplacement);
}

fs.writeFileSync('pages/Computation.tsx', code);
console.log("COMPUTATION UPDATED");
