const fs = require('fs');
let code = fs.readFileSync('pages/Reconciliation.tsx', 'utf-8');

const importTemplate = "import TemplateSelector from '../components/TemplateSelector';\nimport { generateStyledDocument } from '../services/documentGenerator';\nimport { ExportConfig } from '../types';";
if (!code.includes("TemplateSelector")) {
    code = code.replace("import CollaborationBar", importTemplate + "\nimport CollaborationBar");
}

const componentStartMatch = code.match(/const Reconciliation: React\.FC = \(\) => {/);
if (componentStartMatch && !code.includes("showTemplateSelector")) {
    const stateHook = "  const [showTemplateSelector, setShowTemplateSelector] = useState(false);\n";
    code = code.replace(componentStartMatch[0], componentStartMatch[0] + "\n" + stateHook);
}

const handleProfExport = `  const handleProfessionalExport = (config: ExportConfig) => {
    const dataToExport = filteredItems.map(item => ({
        invoiceNumber: item.invoiceNumber,
        partyName: item.partyName,
        type: item.type,
        amount: item.amountBooks,
        taxAmount: item.taxAmountBooks,
        status: item.status
    }));
    generateStyledDocument({ invoices: dataToExport }, config);
    setShowTemplateSelector(false);
  };
`;

if (!code.includes("handleProfessionalExport")) {
    code = code.replace("const handleExport = () => {", handleProfExport + "\n  const handleExport = () => {");
}

const exportButtons = `<div className="flex gap-2">
            <button 
              onClick={() => setShowTemplateSelector(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-all shadow-sm"
            >
              <FileText size={16} /> Export PDF
            </button>
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
            >
              <Download size={16} className="text-blue-600" /> Export CSV
            </button>
          </div>`;

// Replace the existing handleExport button
const oldExportBtn = `<button 
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            >
              <Download size={16} className="text-blue-600"/> Export
            </button>`;

if (code.includes(oldExportBtn)) {
    code = code.replace(oldExportBtn, exportButtons);
}

// Ensure FileText icon is imported
if (!code.includes("FileText")) {
    code = code.replace("LayoutList, PieChart,", "LayoutList, PieChart, FileText,");
}

// Add the modal rendering
const modalCode = `      <AnimatePresence>
        {showTemplateSelector && (
          <TemplateSelector 
            isOpen={showTemplateSelector}
            onClose={() => setShowTemplateSelector(false)}
            onExport={handleProfessionalExport}
            category="REPORT"
            title={\`Reconciliation Report - \${activeTab}\`}
          />
        )}
      </AnimatePresence>`;

if (!code.includes("<TemplateSelector")) {
    code = code.replace("{/* Collaboration Bar */}", modalCode + "\n\n      {/* Collaboration Bar */}");
}

fs.writeFileSync('pages/Reconciliation.tsx', code);
