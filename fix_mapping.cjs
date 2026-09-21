const fs = require('fs');
const file = 'pages/Integrations.tsx';
let content = fs.readFileSync(file, 'utf8');

const mappingStart = content.indexOf('  function renderMappingTab() {');
const mappingEnd = content.indexOf('  function renderLogsTab() {');

// The original mapping tab had:
// qb mapping
// xero mapping
// dynamics mapping (BC)
// dynamics_fo mapping
// tally mapping
let newMapping = `  function renderMappingTab() {
    if (activeIntegration?.id === 'qb') {
      return (
        <div className="space-y-6 pt-2">
          <FieldMappingConfiguration erpType="QUICKBOOKS" />
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

    if (activeIntegration?.id === 'xero') {
      return (
        <div className="space-y-6 pt-2">
          <FieldMappingConfiguration erpType="XERO" />
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileCheck size={14} className="text-cyan-600" />
              Xero Chart of Accounts & Tax Rates Mapping
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Map Xero Tax Rates and General Ledger Accounts (e.g., 820 - GST) to statutory TaxFlow GST definitions for automated Manual Journal creation.
            </p>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">TaxFlow Statutory Type</th>
                    <th className="p-3">Xero GL Account / Tax Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {['Output CGST Payable', 'Output SGST Payable', 'Output IGST Payable', 'Input CGST Receivable', 'Input SGST Receivable', 'Input IGST Receivable'].map((taxHead, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-bold text-slate-700">{taxHead}</td>
                      <td className="p-3">
                        <select className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:border-cyan-500 focus:outline-none">
                          <option>Select Xero Account</option>
                          <option>820 - GST (Current Liability)</option>
                          <option>821 - CGST Payable (Current Liability)</option>
                          <option>822 - SGST Payable (Current Liability)</option>
                          <option>823 - IGST Payable (Current Liability)</option>
                          <option>824 - GST Clearing (Current Asset)</option>
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

    if (activeIntegration?.id === 'tally') {
      return (
        <div className="space-y-6 pt-2">
          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-2.5 text-amber-800 text-xs leading-relaxed font-semibold">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600"/>
            <p>Carefully audit mappings before syncing. Mapped values route directly to final GSTR submission draft sheets.</p>
          </div>
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">TAXFLOW SCHEMA</th>
                  <th className="p-3">SOURCE ERP COLUMN</th>
                  <th className="p-3 w-10 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {Object.entries(tallySchemaMappings).map(([appField, erpTag], i) => (
                  <tr key={i} className="group hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {appField}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-mono text-[11px] shadow-2xs focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500">
                        <Database size={13} className="text-emerald-600 shrink-0"/>
                        <input
                          value={erpTag}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTallySchemaMappings(prev => ({ ...prev, [appField]: val }));
                          }}
                          className="w-full bg-transparent border-none p-0 focus:outline-none font-mono text-[11px] text-slate-900 font-semibold"
                        />
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <Settings size={14} className="text-slate-400 group-hover:text-emerald-600 cursor-pointer transition-colors inline-block"/>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pt-4 border-t border-slate-200">
            <FieldMappingConfiguration erpType="TALLY_PRIME" />
          </div>
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileCheck size={14} className="text-emerald-600" />
              Tally Prime GST Ledger & Tax Rate Mapping Matrix
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Map Tally Prime GST Ledgers (e.g., Output CGST, Input IGST) to statutory TaxFlow GST rate categories for GSTR-1, GSTR-3B & GSTR-2B filing.
            </p>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Tally Prime Ledger Name</th>
                    <th className="p-3">TaxFlow Statutory Tax Rate Slab</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {Object.entries(tallyTaxLedgerMap).map(([tallyLedger, mappedTax], i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-bold font-mono text-emerald-700">{tallyLedger}</td>
                      <td className="p-3">
                        <select 
                          value={mappedTax}
                          onChange={(e) => setTallyTaxLedgerMap(prev => ({ ...prev, [tallyLedger]: e.target.value }))}
                          className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="18% IGST (Inter-State)">18% IGST (Inter-State)</option>
                          <option value="9% CGST (18% Intra-State)">9% CGST (18% Intra-State)</option>
                          <option value="9% SGST (18% Intra-State)">9% SGST (18% Intra-State)</option>
                          <option value="12% IGST (Inter-State)">12% IGST (Inter-State)</option>
                          <option value="6% CGST (12% Intra-State)">6% CGST (12% Intra-State)</option>
                          <option value="6% SGST (12% Intra-State)">6% SGST (12% Intra-State)</option>
                          <option value="18% Input IGST">18% Input IGST</option>
                          <option value="9% Input CGST">9% Input CGST</option>
                          <option value="9% Input SGST">9% Input SGST</option>
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

    if (activeIntegration?.id === 'dynamics') {
      return (
        <div className="space-y-6 pt-2">
          <FieldMappingConfiguration erpType="DYNAMICS_BC" />
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileCheck size={14} className="text-indigo-600" />
              Business Central Tax Group Mapping Matrix
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Map Business Central VAT/GST Tax Groups to statutory TaxFlow GST rate categories.
            </p>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Business Central Tax Group Code</th>
                    <th className="p-3">TaxFlow Statutory Tax Slab</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {Object.entries(bcTaxGroupMap).map(([bcGroup, mappedTax], i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-bold font-mono text-indigo-700">{bcGroup}</td>
                      <td className="p-3">
                        <select 
                          value={mappedTax}
                          onChange={(e) => setBcTaxGroupMap(prev => ({ ...prev, [bcGroup]: e.target.value }))}
                          className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                        >
                          <option value="18% CGST+SGST (9%+9%)">18% CGST + SGST (9% + 9%)</option>
                          <option value="18% IGST">18% IGST</option>
                          <option value="12% CGST+SGST (6%+6%)">12% CGST + SGST (6% + 6%)</option>
                          <option value="12% IGST">12% IGST</option>
                          <option value="5% CGST+SGST (2.5%+2.5%)">5% CGST + SGST (2.5% + 2.5%)</option>
                          <option value="Exempt / Zero Rated">Exempt / Zero Rated</option>
                          <option value="Export Under LUT (0%)">Export Under LUT (0%)</option>
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

    if (activeIntegration?.id === 'dynamics_fo') {
      return (
        <div className="space-y-6 pt-2">
          <FieldMappingConfiguration erpType="DYNAMICS_FO" />
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileCheck size={14} className="text-emerald-600" />
              D365 F&O Tax Item Group & Tax Code Mapping Matrix
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Map D365 F&O Tax Groups & Tax Item Groups to statutory TaxFlow GST rate categories.
            </p>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">F&O Tax Item Group Code</th>
                    <th className="p-3">TaxFlow Statutory Tax Slab</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {Object.entries(foTaxGroupMap).map(([foGroup, mappedTax], i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-bold font-mono text-emerald-700">{foGroup}</td>
                      <td className="p-3">
                        <select 
                          value={mappedTax}
                          onChange={(e) => setFoTaxGroupMap(prev => ({ ...prev, [foGroup]: e.target.value }))}
                          className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="18% CGST+SGST (9%+9%)">18% CGST + SGST (9% + 9%)</option>
                          <option value="18% IGST">18% IGST</option>
                          <option value="12% CGST+SGST (6%+6%)">12% CGST + SGST (6% + 6%)</option>
                          <option value="12% IGST">12% IGST</option>
                          <option value="Exempt / Zero Rated">Exempt / Zero Rated</option>
                          <option value="Export Under LUT (0%)">Export Under LUT (0%)</option>
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
    
    return (
      <div className="space-y-6 pt-2">
        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-2.5 text-amber-800 text-xs leading-relaxed font-semibold">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600"/>
          <p>Carefully audit mappings before syncing. Mapped values route directly to final GSTR submission draft sheets.</p>
        </div>
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                      <th className="p-3">TaxFlow Schema</th>
                      <th className="p-3">Source ERP Column</th>
                      <th className="p-3 w-10"></th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                  {[
                      { app: 'Invoice Number', erp: 'voucher_number' },
                      { app: 'Invoice Date', erp: 'doc_date' },
                      { app: 'Customer GSTIN', erp: 'party_gstin_id' },
                      { app: 'Taxable Value', erp: 'assessable_amt' },
                      { app: 'Tax Amount', erp: 'total_tax_amt' },
                      { app: 'Place of Supply', erp: 'state_code' },
                  ].map((row, i) => (
                      <tr key={i} className="group hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-800">{row.app}</td>
                          <td className="p-3">
                              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 font-mono text-[10px]">
                                  <Database size={12} className="text-slate-400"/> {row.erp}
                              </div>
                          </td>
                          <td className="p-3 text-right">
                               <Settings size={14} className="text-slate-400 group-hover:text-slate-800 cursor-pointer"/>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
        </div>
        <button type="button" className="text-xs text-slate-900 font-bold uppercase tracking-wider hover:underline flex items-center gap-1">
          + Map Custom Column Schema
        </button>
      </div>
    );
  }

`;
content = content.substring(0, mappingStart) + newMapping + content.substring(mappingEnd);
fs.writeFileSync(file, content);
