const fs = require('fs');
let content = fs.readFileSync('pages/Integrations.tsx', 'utf8');

const handleManualSyncStart = content.indexOf('  const handleManualSync = () => {');
const headerContent = content.substring(0, handleManualSyncStart);

const handleManualSync = `  const handleManualSync = () => {
    setIsSyncing(true);
    
    if (activeIntegration?.id === 'qb') {
      addLog('QUICKBOOKS: Starting manual sync for Invoices & Tax Liability.');
      setTimeout(() => addLog('QUICKBOOKS: Pulling 25 new commercial invoices from QBO...'), 500);
      setTimeout(() => addLog('QUICKBOOKS: Pushing Tax Liability Journal Entry for August...'), 1200);
    } else if (activeIntegration?.id === 'xero') {
      addLog('XERO: Starting manual sync for Invoices & Tax Liability.');
      setTimeout(() => addLog('XERO: Pulling 32 new commercial invoices from Xero API...'), 500);
      setTimeout(() => addLog('XERO: Pushing Manual Journal Entry for August Tax Liability...'), 1200);
    } else if (activeIntegration?.id === 'tally') {
      addLog('TALLY_PRIME: Starting manual sync over ODBC.');
    } else if (activeIntegration?.id === 'dynamics') {
      addLog('DYNAMICS_BC: Starting manual sync over OData v4 REST.');
    } else if (activeIntegration?.id === 'dynamics_fo') {
      addLog('DYNAMICS_FO: Starting manual sync over DMF batch.');
    } else {
      addLog('Starting manual sync.');
    }
    
    setTimeout(() => {
        setIsSyncing(false);
        if (activeIntegration?.id === 'qb') {
          addLog('QUICKBOOKS: Sync Completed successfully.');
        } else if (activeIntegration?.id === 'xero') {
          addLog('XERO: Sync Completed successfully.');
        } else {
          addLog('Sync Completed successfully.');
        }
        setIntegrations(prev => prev.map(item => 
            item.id === activeIntegration?.id ? { ...item, lastSync: 'Just now' } : item
        ));
    }, 2000);
  };

  const handleSubmitConnection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIntegration) return;
    
    setIsConnecting(true);
    setTimeout(() => {
      setIntegrations(prev => prev.map(item => 
        item.id === activeIntegration.id ? { ...item, status: 'CONNECTED', lastSync: 'Just now' } : item
      ));
      setIsConnecting(false);
      
      if (activeIntegration.status !== 'CONNECTED') {
          setActiveTab('SYNC');
      } else {
          closeConnectModal();
      }
    }, 1500);
  };
`;

const tabsCode = content.substring(
  content.indexOf('  function renderConnectionTab() {'),
  content.indexOf('  function renderMappingTab() {')
);

const renderMappingTab = `  function renderMappingTab() {
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

const renderLogsTab = `  function renderLogsTab() {
    if (activeIntegration?.id === 'qb') {
      return (
        <div className="space-y-4 pt-2 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-800">QuickBooks Online Sync Logs</h4>
              <p className="text-[11px] text-slate-500">Invoice Pulls & Tax Liability Journal Entry Pushes</p>
            </div>
            <button 
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="text-[10px] flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3.5 py-2 rounded-xl font-bold uppercase tracking-wider disabled:opacity-50 transition-all shadow-sm"
            >
              {isSyncing ? <Loader2 size={12} className="animate-spin stroke-[3]" /> : <RefreshCw size={12} className="stroke-[3]" />}
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
          <div className="bg-slate-900 rounded-xl overflow-hidden shadow-inner">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950/50">
               <span className="text-[10px] font-mono text-slate-400">api.intuit.com/v3/company</span>
               <span className="flex items-center gap-2">
                 <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Live</span>
               </span>
            </div>
            <div className="p-4 h-64 overflow-y-auto font-mono text-[10px] space-y-2 text-slate-300">
               {systemLogs.length === 0 ? (
                 <p className="text-slate-600 italic">No sync activity recorded.</p>
               ) : (
                 systemLogs.filter(log => log.includes('QUICKBOOKS')).map((log, i) => {
                   const timeMatch = log.match(/\\[(.*?)\\]/);
                   const time = timeMatch ? timeMatch[1] : new Date().toLocaleTimeString();
                   const message = log.replace(/\\[.*?\\]\\s*/, '');
                   return (
                   <div key={i} className="flex items-start gap-3 border-l-2 border-slate-700 pl-3">
                     <span className="text-slate-500 whitespace-nowrap">[{time}]</span>
                     <span className={message.includes('ERROR') ? 'text-rose-400' : message.includes('successfully') || message.includes('Completed') ? 'text-emerald-400' : 'text-slate-300'}>{message}</span>
                   </div>
                 )})
               )}
            </div>
          </div>
        </div>
      );
    }
    
    if (activeIntegration?.id === 'xero') {
      return (
        <div className="space-y-4 pt-2 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-800">Xero Integration Sync Logs</h4>
              <p className="text-[11px] text-slate-500">Invoice Pulls & Tax Liability Manual Journal Pushes</p>
            </div>
            <button 
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="text-[10px] flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white px-3.5 py-2 rounded-xl font-bold uppercase tracking-wider disabled:opacity-50 transition-all shadow-sm"
            >
              {isSyncing ? <Loader2 size={12} className="animate-spin stroke-[3]" /> : <RefreshCw size={12} className="stroke-[3]" />}
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
          <div className="bg-slate-900 rounded-xl overflow-hidden shadow-inner">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950/50">
               <span className="text-[10px] font-mono text-slate-400">api.xero.com/api.xro/2.0</span>
               <span className="flex items-center gap-2">
                 <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono"><div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div> Live</span>
               </span>
            </div>
            <div className="p-4 h-64 overflow-y-auto font-mono text-[10px] space-y-2 text-slate-300">
               {systemLogs.length === 0 ? (
                 <p className="text-slate-600 italic">No sync activity recorded.</p>
               ) : (
                 systemLogs.filter(log => log.includes('XERO')).map((log, i) => {
                   const timeMatch = log.match(/\\[(.*?)\\]/);
                   const time = timeMatch ? timeMatch[1] : new Date().toLocaleTimeString();
                   const message = log.replace(/\\[.*?\\]\\s*/, '');
                   return (
                   <div key={i} className="flex items-start gap-3 border-l-2 border-slate-700 pl-3">
                     <span className="text-slate-500 whitespace-nowrap">[{time}]</span>
                     <span className={message.includes('ERROR') ? 'text-rose-400' : message.includes('successfully') || message.includes('Completed') ? 'text-emerald-400' : 'text-slate-300'}>{message}</span>
                   </div>
                 )})
               )}
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="space-y-4 pt-2 text-xs">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-800">Integration Sync Logs</h4>
            <p className="text-[11px] text-slate-500">Real-time sync activity and errors</p>
          </div>
          <button 
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="text-[10px] flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl font-bold uppercase tracking-wider disabled:opacity-50 transition-all shadow-sm"
          >
            {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
        <div className="bg-slate-900 rounded-xl overflow-hidden shadow-inner">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950/50">
             <span className="text-[10px] font-mono text-slate-400">Terminal</span>
             <span className="flex items-center gap-2">
               <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Live</span>
             </span>
          </div>
          <div className="p-4 h-64 overflow-y-auto font-mono text-[10px] space-y-2 text-slate-300">
             {systemLogs.length === 0 ? (
               <p className="text-slate-600 italic">No sync activity recorded.</p>
             ) : (
               systemLogs.map((log, i) => {
                 const timeMatch = log.match(/\\[(.*?)\\]/);
                 const time = timeMatch ? timeMatch[1] : new Date().toLocaleTimeString();
                 const message = log.replace(/\\[.*?\\]\\s*/, '');
                 return (
                 <div key={i} className="flex items-start gap-3 border-l-2 border-slate-700 pl-3">
                   <span className="text-slate-500 whitespace-nowrap">[{time}]</span>
                   <span className={message.includes('ERROR') ? 'text-rose-400' : message.includes('successfully') || message.includes('Completed') ? 'text-emerald-400' : 'text-slate-300'}>{message}</span>
                 </div>
               )})
             )}
          </div>
        </div>
      </div>
    );
  }
`;

const mainReturn = `  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden text-slate-800">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 relative">
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">Integrations Hub</h1>
            <div className="h-5 w-px bg-slate-300"></div>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100 flex items-center gap-1">
              <Database size={12} /> Data Sync Active
            </span>
          </div>
          <div className="flex items-center gap-4">
             <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
               <Bell size={18} />
               <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
             </button>
             <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-white text-xs font-bold shadow-sm">
               FM
             </div>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Connected Ecosystem</h2>
                <p className="text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
                  Connect your ERP and accounting systems to automatically sync invoices, validate GSTINs, and generate statutory tax reports.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Search apps..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 shadow-sm" />
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-sm transition-colors">
                  <Plus size={16} /> Add App
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {integrations.map(integration => (
                 <div key={integration.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow relative overflow-hidden group">
                   <div className="flex items-start justify-between mb-4">
                      <div className={\`w-12 h-12 rounded-xl \${integration.iconColor} flex items-center justify-center text-white text-lg font-black shadow-inner\`}>
                         {integration.initials}
                      </div>
                      <div className="flex items-center gap-2">
                        {integration.status === 'CONNECTED' ? (
                           <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> Connected
                           </span>
                        ) : (
                           <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                             Disconnected
                           </span>
                        )}
                      </div>
                   </div>
                   <h3 className="font-bold text-slate-900 text-base">{integration.name}</h3>
                   <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-2">{integration.description}</p>
                   
                   <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                     <div className="text-[10px] font-semibold text-slate-400">
                        {integration.status === 'CONNECTED' ? \`Last sync: \${integration.lastSync}\` : 'Never synced'}
                     </div>
                     <button 
                       onClick={() => openConnectModal(integration.id, integration.status === 'CONNECTED' ? 'SYNC' : 'CONNECTION')}
                       className={\`text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors \${integration.status === 'CONNECTED' ? 'text-slate-700 hover:bg-slate-100' : 'text-blue-700 bg-blue-50 hover:bg-blue-100'}\`}
                     >
                       {integration.status === 'CONNECTED' ? 'Configure' : 'Connect'}
                     </button>
                   </div>
                 </div>
              ))}
            </div>

            {/* Trace Explorer Section */}
            <div className="mt-8 pt-8 border-t border-slate-200">
               <div className="flex items-center justify-between mb-6">
                 <div>
                    <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                      <Activity size={20} className="text-blue-600" /> Distributed Tracing & Diagnostics
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">Monitor end-to-end API latencies, data pipelines, and ERP connector health.</p>
                 </div>
               </div>
               
               <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[400px]">
                  {/* Traces List Sidebar */}
                  <div className="w-full md:w-80 border-r border-slate-200 bg-slate-50/50 flex flex-col">
                     <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between sticky top-0">
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Recent Executions</span>
                       <button className="text-slate-400 hover:text-slate-700 transition-colors"><RefreshCw size={14} /></button>
                     </div>
                     <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                       {mockTraces.map((trace) => (
                         <div 
                           key={trace.id} 
                           onClick={() => setSelectedTraceId(trace.id)}
                           className={\`p-4 cursor-pointer transition-colors \${selectedTraceId === trace.id ? 'bg-white border-l-2 border-l-blue-600 shadow-sm' : 'hover:bg-white border-l-2 border-l-transparent'}\`}
                         >
                           <div className="flex items-center justify-between mb-1">
                             <span className="text-[10px] font-mono text-slate-400">{trace.id}</span>
                             <span className="text-[10px] font-semibold text-slate-500">{trace.timestamp}</span>
                           </div>
                           <h4 className="text-xs font-bold text-slate-800 truncate mb-2">{trace.name}</h4>
                           <div className="flex items-center gap-3">
                             <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-600">
                               <Clock size={12} className="text-slate-400" /> {trace.durationMs}ms
                             </span>
                             <span className={\`text-[10px] font-bold uppercase tracking-wider \${trace.spans.some(s => s.status === 'ERROR') ? 'text-rose-600' : 'text-emerald-600'}\`}>
                               {trace.spans.some(s => s.status === 'ERROR') ? 'Failed' : 'Success'}
                             </span>
                           </div>
                         </div>
                       ))}
                     </div>
                  </div>
                  
                  {/* Trace Waterfall Chart */}
                  <div className="flex-1 bg-white p-6 flex flex-col">
                     <div className="mb-6 flex items-start justify-between">
                       <div>
                         <h3 className="text-sm font-bold text-slate-900">{activeTrace.name}</h3>
                         <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs text-slate-500 font-mono">Trace ID: {activeTrace.id}</span>
                            <span className="text-xs text-slate-500">Duration: <strong>{activeTrace.durationMs}ms</strong></span>
                            <span className="text-xs text-slate-500">Spans: <strong>{activeTrace.spans.length}</strong></span>
                         </div>
                       </div>
                       <div className="flex gap-2">
                          <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors">Export JSON</button>
                       </div>
                     </div>
                     
                     {/* Waterfall Visualization */}
                     <div className="flex-1 border border-slate-200 rounded-xl bg-slate-50 p-4 overflow-y-auto overflow-x-hidden relative">
                        <div className="flex text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-2 mb-4 sticky top-0 bg-slate-50 z-10">
                           <div className="w-1/3">Service & Operation</div>
                           <div className="w-2/3 pl-4 relative">
                              <span>Timeline (0ms - {activeTrace.durationMs}ms)</span>
                           </div>
                        </div>
                        <div className="space-y-4">
                           {activeTrace.spans.map((span, i) => {
                             const leftPercent = (span.offsetMs / activeTrace.durationMs) * 100;
                             const widthPercent = Math.max((span.durationMs / activeTrace.durationMs) * 100, 0.5);
                             return (
                               <div key={i} className="group relative">
                                 <div className="flex items-center text-xs">
                                   <div className="w-1/3 pr-4 truncate">
                                     <div className="font-bold text-slate-700 truncate">{span.service}</div>
                                     <div className="text-[10px] text-slate-500 truncate mt-0.5">{span.operation}</div>
                                   </div>
                                   <div className="w-2/3 relative h-8 bg-slate-100 rounded border border-slate-200 overflow-hidden">
                                     <div 
                                       className={\`absolute top-1 bottom-1 rounded-sm shadow-sm transition-all flex items-center px-2 text-[8px] font-bold text-white overflow-hidden \${span.status === 'ERROR' ? 'bg-rose-500' : 'bg-blue-500'}\`}
                                       style={{ left: \`\${leftPercent}%\`, width: \`\${widthPercent}%\` }}
                                     >
                                       {widthPercent > 10 && \`\${span.durationMs}ms\`}
                                     </div>
                                   </div>
                                 </div>
                                 <div className="ml-[33%] mt-2 pl-4 space-y-1">
                                    {span.logs.map((log, li) => (
                                      <div key={li} className="text-[10px] font-mono text-slate-500 flex items-center gap-2">
                                        <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                        {log}
                                      </div>
                                    ))}
                                 </div>
                               </div>
                             );
                           })}
                        </div>
                     </div>
                  </div>
               </div>
            </div>

          </div>
        </main>
      </div>

      {/* Configuration Modal */}
      {modalState.isOpen && activeIntegration && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-4">
                <div className={\`w-12 h-12 rounded-xl \${activeIntegration.iconColor} flex items-center justify-center text-white text-xl font-black shadow-sm\`}>
                  {activeIntegration.initials}
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">{activeIntegration.name} Configuration</h2>
                  <p className="text-xs text-slate-500 font-medium">Manage connection, sync rules, and data mapping.</p>
                </div>
              </div>
              <button onClick={closeConnectModal} className="p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {activeIntegration.status === 'CONNECTED' ? (
              <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                <div className="w-full md:w-56 bg-slate-50 border-r border-slate-100 flex flex-row md:flex-col p-2 md:p-4 gap-1 md:gap-2 overflow-x-auto md:overflow-visible shrink-0">
                  <button 
                    onClick={() => setActiveTab('CONNECTION')}
                    className={\`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap \${activeTab === 'CONNECTION' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-100'}\`}
                  >
                    <Server size={14} /> Connection
                  </button>
                  <button 
                    onClick={() => setActiveTab('SYNC')}
                    className={\`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap \${activeTab === 'SYNC' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-100'}\`}
                  >
                    <RefreshCw size={14} /> Sync Settings
                  </button>
                  <button 
                    onClick={() => setActiveTab('MAPPING')}
                    className={\`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap \${activeTab === 'MAPPING' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-100'}\`}
                  >
                    <Database size={14} /> Field Mapping
                  </button>
                  <button 
                    onClick={() => setActiveTab('LOGS')}
                    className={\`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap \${activeTab === 'LOGS' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-100'}\`}
                  >
                    <Activity size={14} /> Sync Logs
                  </button>
                  
                  <div className="mt-auto hidden md:block pt-4">
                    <button 
                      onClick={() => handleDisconnect(activeIntegration.id)}
                      className="flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg w-full transition-colors"
                    >
                      <Trash2 size={14} /> Disconnect ERP
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-white">
                  {activeTab === 'CONNECTION' && renderConnectionTab()}
                  {activeTab === 'SYNC' && renderSyncSettingsTab()}
                  {activeTab === 'MAPPING' && renderMappingTab()}
                  {activeTab === 'LOGS' && renderLogsTab()}
                </div>
              </div>
            ) : (
              <div className="flex-1 p-6 flex flex-col items-center justify-center text-center bg-slate-50">
                <div className={\`w-20 h-20 rounded-2xl \${activeIntegration.iconColor} flex items-center justify-center text-white text-3xl font-black shadow-lg mb-6\`}>
                  {activeIntegration.initials}
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 mb-2">Connect to {activeIntegration.name}</h3>
                <p className="text-sm text-slate-500 mb-8 max-w-md leading-relaxed">
                  Authorize TaxFlow to securely access your data to automate compliance, fetch invoices, and push journal entries.
                </p>
                <form onSubmit={handleSubmitConnection} className="w-full max-w-sm space-y-4">
                  <button 
                    type="submit" 
                    disabled={isConnecting}
                    className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {isConnecting ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                    {isConnecting ? 'Authenticating...' : 'Secure OAuth Login'}
                  </button>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5">
                    <Lock size={10} /> 256-bit AES Encryption
                  </p>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default Integrations;
`;

const finalFile = headerContent + handleManualSync + '\n' + tabsCode + '\n' + renderMappingTab + '\n' + renderLogsTab + '\n' + mainReturn;

fs.writeFileSync('pages/Integrations.tsx', finalFile);
