const fs = require('fs');
let file = fs.readFileSync('pages/Invoices.tsx', 'utf-8');

// Remove from the filters bar
const oldImportBtn = `<button onClick={() => setIsImportModalOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
              <FileSpreadsheet size={16} className="text-emerald-600"/> Import
            </button>`;

file = file.replace(oldImportBtn, "");

// Add to the main action bar
const newInvoiceBtn = `<button onClick={() => setIsCreateModalOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all active:scale-95">
              <Plus size={18} /> New {activeCategory === 'CN_DN' ? 'Note' : 'Invoice'}
            </button>`;

const bulkImportWizardBtn = `<button 
              onClick={() => setIsImportModalOpen(true)} 
              className="flex items-center justify-center gap-2 px-4 py-2 bg-[#FBBF24] hover:bg-[#F59E0B] text-[#111827] rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95"
              title="Bulk import batch transaction data via CSV"
            >
              <FileSpreadsheet size={16} /> Bulk Import CSV Wizard
            </button>
            <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all active:scale-95">
              <Plus size={18} /> New {activeCategory === 'CN_DN' ? 'Note' : 'Invoice'}
            </button>`;

file = file.replace(newInvoiceBtn, bulkImportWizardBtn);

fs.writeFileSync('pages/Invoices.tsx', file);
console.log("Bulk Import Wizard button added!");
