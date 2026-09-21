const fs = require('fs');
const file = 'pages/Integrations.tsx';
let content = fs.readFileSync(file, 'utf8');

const qbMapping = `
    if (activeIntegration?.id === 'qb') {
      return (
        <div className="space-y-6 pt-2">
          {/* Custom ERP Field Mapping Configuration Engine */}
          <FieldMappingConfiguration erpType="QUICKBOOKS" />

          {/* QuickBooks Tax Agency & GL Account Mapping */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileCheck size={14} className="text-green-600" />
              QuickBooks Chart of Accounts & Tax Agency Mapping
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Map QuickBooks Tax Rates, Agencies, and General Ledger Accounts to statutory TaxFlow GST definitions for automated Journal Entry creation.
            </p>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">TaxFlow Statutory Type</th>
                    <th className="p-3">QuickBooks GL Account / Tax Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {['Output CGST Payable', 'Output SGST Payable', 'Output IGST Payable', 'Input CGST Receivable', 'Input SGST Receivable', 'Input IGST Receivable'].map((taxHead, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-bold text-slate-700">{taxHead}</td>
                      <td className="p-3">
                        <select className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:border-green-500 focus:outline-none">
                          <option>Select QuickBooks Account</option>
                          <option>2101 - CGST Payable (Current Liabilities)</option>
                          <option>2102 - SGST Payable (Current Liabilities)</option>
                          <option>2103 - IGST Payable (Current Liabilities)</option>
                          <option>1201 - Input CGST (Current Assets)</option>
                          <option>1202 - Input SGST (Current Assets)</option>
                          <option>1203 - Input IGST (Current Assets)</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }
`;

content = content.replace(
  "if (activeIntegration?.id === 'dynamics_fo') {",
  qbMapping + "\n    if (activeIntegration?.id === 'dynamics_fo') {"
);

fs.writeFileSync(file, content);
