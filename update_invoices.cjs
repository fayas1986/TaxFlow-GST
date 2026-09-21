const fs = require('fs');
let code = fs.readFileSync('pages/Invoices.tsx', 'utf-8');

// 1. Import CurrencyConverterModule
const importTarget = "import { EvidenceTrailModal } from '../components/EvidenceTrailModal';";
const importReplacement = importTarget + "\nimport { CurrencyConverterModule } from '../components/CurrencyConverterModule';";
if (code.includes(importTarget)) {
    code = code.replace(importTarget, importReplacement);
}

// 2. Add state for CurrencyConverterModal
const stateTarget = "const [isEvidenceTrailOpen, setIsEvidenceTrailOpen] = useState(false);";
const stateReplacement = stateTarget + "\n  const [isCurrencyConverterOpen, setIsCurrencyConverterOpen] = useState(false);";
if (code.includes(stateTarget)) {
    code = code.replace(stateTarget, stateReplacement);
}

// 3. Add button in the header
const buttonTarget = `<button onClick={() => setIsImportModalOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
              <FileSpreadsheet size={16} className="text-emerald-600"/> Import
            </button>`;
const buttonReplacement = `<button onClick={() => setIsCurrencyConverterOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
              <Globe size={16} className="text-blue-500"/> FX
            </button>\n            ` + buttonTarget;
if (code.includes(buttonTarget)) {
    code = code.replace(buttonTarget, buttonReplacement);
}

// 4. Add the modal at the bottom before closing </div>
const modalTarget = `      <AnimatePresence>
        {showTemplateSelector && (`;
const modalReplacement = `      <AnimatePresence>
        {isCurrencyConverterOpen && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
               <motion.div 
                   initial={{ opacity: 0, scale: 0.95, y: 20 }}
                   animate={{ opacity: 1, scale: 1, y: 0 }}
                   exit={{ opacity: 0, scale: 0.95, y: 20 }}
                   className="w-full max-w-md"
               >
                   <div className="flex justify-end mb-2">
                       <button onClick={() => setIsCurrencyConverterOpen(false)} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md">
                           <X size={20} />
                       </button>
                   </div>
                   <CurrencyConverterModule />
               </motion.div>
           </div>
        )}
      </AnimatePresence>\n\n` + modalTarget;
if (code.includes(modalTarget)) {
    code = code.replace(modalTarget, modalReplacement);
}

fs.writeFileSync('pages/Invoices.tsx', code);
console.log("INVOICES UPDATED");
