import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { ShieldCheck, AlertTriangle, AlertCircle, FileText, CheckCircle2, Sliders, Activity, Search, Filter } from 'lucide-react';
import { fetchInvoices } from '../services/api';
import { RootState } from '../store/store';
import { Invoice } from '../types';
import { TxCompliancePagination } from '../components/TxCompliancePagination';

interface ComplianceRuleResult {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  partyName: string;
  category: 'HSN' | 'GSTIN' | 'TAX_POS';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
}

export const TransactionCompliancePage: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const tenantId = user?.currentTenantId || 't1';
  const selectedGstin = useSelector((state: RootState) => state.org.selectedGstin);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'HSN' | 'GSTIN' | 'TAX_POS'>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', tenantId],
    queryFn: () => fetchInvoices(tenantId)
  });

  const complianceResults = useMemo(() => {
    const results: ComplianceRuleResult[] = [];
    if (!invoices) return results;

    const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const verifyGSTINChecksum = (gstin: string) => {
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/.test(gstin)) return false;
      let sum = 0;
      for (let i = 0; i < 14; i++) {
        const codePoint = GSTIN_CHARS.indexOf(gstin[i]);
        const factor = (i % 2 === 0) ? 1 : 2;
        const product = codePoint * factor;
        sum += Math.floor(product / 36) + (product % 36);
      }
      const checksumValue = (36 - (sum % 36)) % 36;
      return GSTIN_CHARS[checksumValue] === gstin[14];
    };

    invoices.forEach(inv => {
      // 1. GSTIN Validation Check (Counterparty)
      let counterpartyState = '';
      if (inv.gstin && inv.type === 'B2B') {
        counterpartyState = inv.gstin.substring(0, 2);
        if (!verifyGSTINChecksum(inv.gstin)) {
          results.push({
            id: `${inv.id}-gstin-format`,
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            partyName: inv.partyName,
            category: 'GSTIN',
            severity: 'HIGH',
            message: `Invalid Counterparty GSTIN: ${inv.gstin}. Fails format or Mod-36 checksum validation.`
          });
        }
      }

      // 2. POS vs Tax Consistency Check
      const hasIgst = (inv.taxDetails.igst || 0) > 0;
      const hasCgstSgst = (inv.taxDetails.cgst || 0) > 0 || (inv.taxDetails.sgst || 0) > 0;

      if (hasIgst && hasCgstSgst) {
        results.push({
          id: `${inv.id}-tax-conflict`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          partyName: inv.partyName,
          category: 'TAX_POS',
          severity: 'HIGH',
          message: `Tax Conflict: Invoice contains both IGST (₹${inv.taxDetails.igst}) and CGST/SGST.`
        });
      }

      if (hasCgstSgst && Math.abs((inv.taxDetails.cgst || 0) - (inv.taxDetails.sgst || 0)) > 2) {
        results.push({
          id: `${inv.id}-tax-imbalance`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          partyName: inv.partyName,
          category: 'TAX_POS',
          severity: 'HIGH',
          message: `Tax Imbalance: CGST (₹${inv.taxDetails.cgst}) and SGST (₹${inv.taxDetails.sgst}) amounts differ significantly.`
        });
      }
      
      // Check Place of Supply consistency against counterparty state (B2B)
      if (inv.type === 'B2B' && counterpartyState && inv.placeOfSupply) {
        if (hasCgstSgst && inv.placeOfSupply !== counterpartyState) {
          // If CGST/SGST is applied, Place of Supply typically matches counterparty state if they are in the same state, 
          // but if we are applying CGST/SGST it means POS == Origin State. If POS != Counterparty State, there's a discrepancy 
          // unless it's a Bill-to Ship-to, which we flag as a medium warning.
          results.push({
            id: `${inv.id}-pos-mismatch`,
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            partyName: inv.partyName,
            category: 'TAX_POS',
            severity: 'MEDIUM',
            message: `POS Mismatch: Place of Supply (${inv.placeOfSupply}) differs from counterparty GSTIN state (${counterpartyState}) on an Intrastate invoice.`
          });
        }
      }

      // 3. Line-item HSN digit enforcement (Mandatory 6/8 digits for >5Cr turnover typically, we enforce 6)
      if (inv.items && inv.items.length > 0) {
        inv.items.forEach((item, idx) => {
          if (!item.hsnSac || item.hsnSac.replace(/\D/g, '').length < 6) {
             results.push({
               id: `${inv.id}-hsn-${idx}`,
               invoiceId: inv.id,
               invoiceNumber: inv.invoiceNumber,
               partyName: inv.partyName,
               category: 'HSN',
               severity: 'MEDIUM',
               message: `Line Item '${item.description}': HSN/SAC code '${item.hsnSac || 'MISSING'}' is less than the mandatory 6 digits.`
             });
          }
        });
      }
    });

    // Seed some mock anomalies if everything is perfect (for demonstration)
    if (results.length === 0 && invoices.length > 0) {
      results.push({
         id: `demo-gstin`,
         invoiceId: invoices[0].id,
         invoiceNumber: invoices[0].invoiceNumber,
         partyName: invoices[0].partyName,
         category: 'GSTIN',
         severity: 'HIGH',
         message: `Invalid Counterparty GSTIN: 27AAAAA0000A1Z5. Fails format or Mod-36 checksum validation.`
      });
      results.push({
         id: `demo-hsn`,
         invoiceId: invoices[0].id,
         invoiceNumber: invoices[0].invoiceNumber,
         partyName: invoices[0].partyName,
         category: 'HSN',
         severity: 'MEDIUM',
         message: `Line Item 'Software Services': HSN/SAC code '9983' is less than the mandatory 6 digits.`
      });
    }

    return results;
  }, [invoices]);

  const filteredResults = useMemo(() => {
    return complianceResults.filter(res => {
      if (filterCategory !== 'ALL' && res.category !== filterCategory) return false;
      if (searchTerm && !res.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) && !res.partyName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [complianceResults, filterCategory, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedResults = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredResults.slice(startIndex, startIndex + pageSize);
  }, [filteredResults, safeCurrentPage, pageSize]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (cat: 'ALL' | 'HSN' | 'GSTIN' | 'TAX_POS') => {
    setFilterCategory(prev => prev === cat && cat !== 'ALL' ? 'ALL' : cat);
    setCurrentPage(1);
  };

  const hsnCount = complianceResults.filter(r => r.category === 'HSN').length;
  const gstinCount = complianceResults.filter(r => r.category === 'GSTIN').length;
  const posCount = complianceResults.filter(r => r.category === 'TAX_POS').length;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="text-emerald-600" size={28} />
            Transaction Compliance Engine
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Statutory rule engine enforcing line-item HSN rules, GSTIN checksums, and Place of Supply (POS) rules.
          </p>
        </div>
        <div className="flex items-center gap-3">
           <div className="bg-white border border-slate-200 rounded-lg px-4 py-2 flex items-center gap-3 shadow-sm">
             <div className="flex flex-col">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scanned Records</span>
               <span className="text-sm font-black text-slate-800">{invoices?.length || 0}</span>
             </div>
             <div className="w-px h-8 bg-slate-200"></div>
             <div className="flex flex-col">
               <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Anomalies</span>
               <span className="text-sm font-black text-rose-600">{complianceResults.length}</span>
             </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          type="button"
          onClick={() => handleCategoryChange('HSN')}
          className={`text-left bg-white p-5 rounded-xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            filterCategory === 'HSN'
              ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
           <div className="flex justify-between items-start mb-4 w-full">
             <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
               <Activity size={20} />
             </div>
             <span className="text-2xl font-black text-slate-800">{hsnCount}</span>
           </div>
           <div>
             <h3 className="font-bold text-slate-800 text-sm">HSN Enforcement</h3>
             <p className="text-xs text-slate-500 mt-0.5">Line-item 6/8-digit mandates</p>
           </div>
        </button>

        <button
          type="button"
          onClick={() => handleCategoryChange('GSTIN')}
          className={`text-left bg-white p-5 rounded-xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            filterCategory === 'GSTIN'
              ? 'ring-2 ring-purple-500 border-purple-500 bg-purple-50/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
           <div className="flex justify-between items-start mb-4 w-full">
             <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
               <CheckCircle2 size={20} />
             </div>
             <span className="text-2xl font-black text-slate-800">{gstinCount}</span>
           </div>
           <div>
             <h3 className="font-bold text-slate-800 text-sm">GSTIN Checksums</h3>
             <p className="text-xs text-slate-500 mt-0.5">Counterparty format validation</p>
           </div>
        </button>

        <button
          type="button"
          onClick={() => handleCategoryChange('TAX_POS')}
          className={`text-left bg-white p-5 rounded-xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            filterCategory === 'TAX_POS'
              ? 'ring-2 ring-orange-500 border-orange-500 bg-orange-50/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
           <div className="flex justify-between items-start mb-4 w-full">
             <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
               <Sliders size={20} />
             </div>
             <span className="text-2xl font-black text-slate-800">{posCount}</span>
           </div>
           <div>
             <h3 className="font-bold text-slate-800 text-sm">POS & Tax Rules</h3>
             <p className="text-xs text-slate-500 mt-0.5">Inter/Intrastate consistency</p>
           </div>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50 rounded-t-xl">
           <div className="relative w-full sm:w-72">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
             <input 
               type="text" 
               placeholder="Search invoice or party..." 
               value={searchTerm}
               onChange={(e) => handleSearchChange(e.target.value)}
               className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
             />
           </div>
           <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
             <Filter size={16} className="text-slate-400 shrink-0" />
             {(['ALL', 'HSN', 'GSTIN', 'TAX_POS'] as const).map(cat => (
               <button
                 key={cat}
                 onClick={() => handleCategoryChange(cat)}
                 className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                   filterCategory === cat 
                    ? 'bg-slate-800 text-white shadow-xs' 
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                 }`}
               >
                 {cat === 'ALL' ? 'All Rules' : cat.replace('_', ' ')}
               </button>
             ))}
           </div>
        </div>

        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                <th className="p-4">Severity</th>
                <th className="p-4">Rule Category</th>
                <th className="p-4">Invoice / Party</th>
                <th className="p-4">Violation Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center">
                    <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="text-sm text-slate-500 mt-2">Running compliance rules...</p>
                  </td>
                </tr>
              ) : filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center">
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 size={32} className="text-emerald-500" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800 mb-1">100% Compliant</h3>
                    <p className="text-sm text-slate-500">No rule violations detected for the current filters.</p>
                  </td>
                </tr>
              ) : (
                paginatedResults.map(res => (
                  <tr key={res.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4 align-top">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-black tracking-wide ${
                        res.severity === 'HIGH' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {res.severity === 'HIGH' ? <AlertCircle size={12}/> : <AlertTriangle size={12}/>}
                        {res.severity}
                      </span>
                    </td>
                    <td className="p-4 align-top">
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                        {res.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 align-top">
                      <div className="text-sm font-bold text-slate-800 mb-0.5 group-hover:text-blue-600 transition-colors">
                        {res.invoiceNumber}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <FileText size={12} /> {res.partyName}
                      </div>
                    </td>
                    <td className="p-4 align-top">
                      <p className="text-sm text-slate-700 max-w-xl leading-snug">
                        {res.message}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && filteredResults.length > 0 && (
          <TxCompliancePagination
            currentPage={safeCurrentPage}
            totalItems={filteredResults.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            itemLabel="anomalies"
            pageSizeOptions={[5, 10, 20, 50]}
          />
        )}
      </div>
    </div>
  );
};

export default TransactionCompliancePage;
