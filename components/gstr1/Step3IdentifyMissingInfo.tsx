import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, CheckCircle2, ShieldAlert, ArrowRight, ArrowLeft, 
  Wrench, Edit3, Filter, Sparkles, AlertCircle, Info, RefreshCw,
  Search, Check, ShieldCheck, ChevronRight
} from 'lucide-react';
import { Invoice } from '../../types';
import { MissingInfoIssue, Gstr1WizardSharedProps } from './types';

export const Step3IdentifyMissingInfo: React.FC<Gstr1WizardSharedProps> = ({
  activeInvoices,
  currentTenant,
  onUpdateInvoices,
  onEditInvoice,
  onNavigateStep
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'GSTIN' | 'HSN' | 'POS' | 'TAX_MATH'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  // Run Real-Time Compliance Diagnostic Engine across all active invoices
  const issues: MissingInfoIssue[] = useMemo(() => {
    const list: MissingInfoIssue[] = [];
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    const validPosRegex = /^(0[1-9]|[1-2][0-9]|3[0-8])$/;

    activeInvoices.forEach(inv => {
      // Check 1: Missing or Malformed GSTIN on B2B supplies
      if (inv.type === 'B2B') {
        if (!inv.gstin || inv.gstin.trim() === '') {
          list.push({
            id: `${inv.id}-missing-gstin`,
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            partyName: inv.partyName,
            date: inv.date,
            amount: inv.amount,
            taxAmount: inv.taxAmount,
            type: inv.type,
            field: 'GSTIN',
            title: 'Missing Customer GSTIN on B2B Supply',
            description: `Invoice ${inv.invoiceNumber} is marked as B2B but lacks recipient GSTIN. GSTR-1 portal rejects Table 4 records without a 15-character GSTIN.`,
            portalImpact: 'Table 4 (B2B) Schema Rejection',
            severity: 'CRITICAL',
            autoFixType: 'CONVERT_TO_B2C',
            autoFixLabel: 'Convert to B2C Small (Table 7)'
          });
        } else if (!gstinRegex.test(inv.gstin.trim())) {
          list.push({
            id: `${inv.id}-invalid-gstin`,
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            partyName: inv.partyName,
            date: inv.date,
            amount: inv.amount,
            taxAmount: inv.taxAmount,
            type: inv.type,
            field: 'GSTIN',
            title: 'Malformed Recipient GSTIN Format',
            description: `GSTIN "${inv.gstin}" fails standard 15-character GSTIN format validation.`,
            portalImpact: 'Table 4 (B2B) Validation Error',
            severity: 'CRITICAL'
          });
        }
      }

      // Check 2: Missing or Incomplete HSN/SAC Code (< 4 digits)
      const items = inv.items && inv.items.length > 0 ? inv.items : [];
      if (items.length === 0) {
        list.push({
          id: `${inv.id}-no-hsn`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          partyName: inv.partyName,
          date: inv.date,
          amount: inv.amount,
          taxAmount: inv.taxAmount,
          type: inv.type,
          field: 'HSN',
          title: 'Missing HSN/SAC Code',
          description: `No HSN or SAC classification found for ${inv.invoiceNumber}. Minimum 4 digits required by Table 12 mandate.`,
          portalImpact: 'Table 12 HSN Summary Error',
          severity: 'CRITICAL',
          autoFixType: 'ASSIGN_DEFAULT_HSN',
          autoFixLabel: 'Assign Default SAC (998311 - Professional Services)'
        });
      } else {
        let flaggedHsn = false;
        items.forEach((itm, idx) => {
          const code = itm.hsnSac ? itm.hsnSac.toString().trim() : '';
          if (!code || code.length < 4 || !/^\d+$/.test(code)) {
            if (!flaggedHsn) {
              flaggedHsn = true;
              list.push({
                id: `${inv.id}-itm-${idx}-invalid-hsn`,
                invoiceId: inv.id,
                invoiceNumber: inv.invoiceNumber,
                partyName: inv.partyName,
                date: inv.date,
                amount: inv.amount,
                taxAmount: inv.taxAmount,
                type: inv.type,
                field: 'HSN',
                title: 'Incomplete or Missing HSN/SAC Code',
                description: `Line item "${itm.description || 'Outward Goods'}" has invalid HSN/SAC "${code || 'EMPTY'}". Minimum 4-digit code required.`,
                portalImpact: 'Table 12 HSN Rejection',
                severity: 'CRITICAL',
                autoFixType: 'ASSIGN_DEFAULT_HSN',
                autoFixLabel: 'Assign Default HSN (847130 - Computing Devices)'
              });
            }
          }
        });
      }

      // Check 3: Missing or Invalid Place of Supply (POS)
      const pos = inv.placeOfSupply ? inv.placeOfSupply.trim() : '';
      if (!pos || !validPosRegex.test(pos)) {
        const hasStateFromGstin = inv.gstin && /^[0-9]{2}/.test(inv.gstin.trim());
        const derivedState = hasStateFromGstin ? inv.gstin.trim().substring(0, 2) : currentTenant.stateCode;
        list.push({
          id: `${inv.id}-missing-pos`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          partyName: inv.partyName,
          date: inv.date,
          amount: inv.amount,
          taxAmount: inv.taxAmount,
          type: inv.type,
          field: 'POS',
          title: 'Missing or Invalid Place of Supply (POS)',
          description: `Place of Supply "${pos || 'EMPTY'}" is missing. A valid 2-digit Indian state code (01-38) is required to determine IGST vs CGST/SGST.`,
          portalImpact: 'Tax Head Routing Defect',
          severity: 'CRITICAL',
          autoFixType: hasStateFromGstin ? 'SET_POS_FROM_GSTIN' : 'SET_DEFAULT_POS',
          autoFixLabel: hasStateFromGstin ? `Auto-set POS to State ${derivedState} (from GSTIN)` : `Default POS to ${currentTenant.stateCode} (Home State)`
        });
      }

      // Check 4: Tax Math / Calculation & Rounding Discrepancies
      const taxable = inv.amount || 0;
      const expectedTax = Math.round((taxable * 0.18) * 100) / 100;
      const actualTax = inv.taxAmount || 0;
      const taxDiff = Math.abs(expectedTax - actualTax);
      const isIntra = inv.placeOfSupply === currentTenant.stateCode;
      const cgst = inv.taxDetails?.cgst || 0;
      const sgst = inv.taxDetails?.sgst || 0;
      const unequalSplit = isIntra && Math.abs(cgst - sgst) > 1.0;

      if (taxDiff > 5 || unequalSplit) {
        list.push({
          id: `${inv.id}-tax-math`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          partyName: inv.partyName,
          date: inv.date,
          amount: inv.amount,
          taxAmount: inv.taxAmount,
          type: inv.type,
          field: 'TAX_MATH',
          title: 'GST Calculation or Split Discrepancy',
          description: unequalSplit 
            ? `Intra-state supply has unequal CGST (₹${cgst}) and SGST (₹${sgst}). Equal 50:50 distribution required.`
            : `Invoice recorded tax (₹${actualTax.toLocaleString()}) deviates from standard computed tax (₹${expectedTax.toLocaleString()}) by ₹${taxDiff.toFixed(2)}.`,
          portalImpact: 'Cross-Table Reciprocity Variance',
          severity: 'WARNING',
          autoFixType: 'RECALCULATE_TAX',
          autoFixLabel: 'Recalculate & Rebalance Output GST'
        });
      }
    });

    return list;
  }, [activeInvoices, currentTenant]);

  // Active issues excluding those dismissed in UI
  const activeIssues = issues.filter(issue => !resolvedIds.has(issue.id));
  const criticalCount = activeIssues.filter(i => i.severity === 'CRITICAL').length;
  const warningCount = activeIssues.filter(i => i.severity === 'WARNING').length;

  // Filter by category and search
  const filteredIssues = activeIssues.filter(issue => {
    const matchesCat = selectedCategory === 'ALL' || issue.field === selectedCategory;
    const matchesSearch = issue.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          issue.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          issue.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // 1-Click Auto Fix Handler
  const handleAutoFixSingle = (issue: MissingInfoIssue) => {
    const updatedInvoices = activeInvoices.map(inv => {
      if (inv.id !== issue.invoiceId) return inv;

      if (issue.autoFixType === 'CONVERT_TO_B2C') {
        return {
          ...inv,
          type: 'B2C' as const,
          gstin: ''
        };
      }

      if (issue.autoFixType === 'ASSIGN_DEFAULT_HSN') {
        const isServices = (inv.partyName || '').toLowerCase().includes('consult') || (inv.amount || 0) < 100000;
        const newCode = isServices ? '998311' : '847130';
        const newDesc = isServices ? 'Professional and Management Consulting Services' : 'Electronic Data Processing Computing Equipment';
        const newItems = (inv.items && inv.items.length > 0)
          ? inv.items.map(itm => ({ ...itm, hsnSac: newCode, description: itm.description || newDesc }))
          : [{
              id: `itm-fix-${Date.now()}`,
              description: newDesc,
              hsnSac: newCode,
              quantity: 1,
              unit: isServices ? 'SAC' : 'NOS',
              rate: inv.amount || 1000,
              taxRate: 18,
              taxableValue: inv.amount || 1000,
              taxAmount: (inv.amount || 1000) * 0.18
            }];
        return {
          ...inv,
          items: newItems
        };
      }

      if (issue.autoFixType === 'SET_POS_FROM_GSTIN') {
        const derived = (inv.gstin && inv.gstin.length >= 2) ? inv.gstin.substring(0, 2) : currentTenant.stateCode;
        const isIntra = derived === currentTenant.stateCode;
        const taxAmt = inv.taxAmount || 0;
        return {
          ...inv,
          placeOfSupply: derived,
          taxDetails: {
            taxableValue: inv.amount || 0,
            cgst: isIntra ? taxAmt / 2 : 0,
            sgst: isIntra ? taxAmt / 2 : 0,
            igst: !isIntra ? taxAmt : 0,
            utgst: 0,
            cess: 0
          }
        };
      }

      if (issue.autoFixType === 'SET_DEFAULT_POS') {
        const pos = currentTenant.stateCode;
        const taxAmt = inv.taxAmount || 0;
        return {
          ...inv,
          placeOfSupply: pos,
          taxDetails: {
            taxableValue: inv.amount || 0,
            cgst: taxAmt / 2,
            sgst: taxAmt / 2,
            igst: 0,
            utgst: 0,
            cess: 0
          }
        };
      }

      if (issue.autoFixType === 'RECALCULATE_TAX') {
        const taxable = inv.amount || 0;
        const taxAmt = Math.round(taxable * 0.18 * 100) / 100;
        const isIntra = inv.placeOfSupply === currentTenant.stateCode;
        return {
          ...inv,
          taxAmount: taxAmt,
          taxDetails: {
            taxableValue: taxable,
            cgst: isIntra ? taxAmt / 2 : 0,
            sgst: isIntra ? taxAmt / 2 : 0,
            igst: !isIntra ? taxAmt : 0,
            utgst: 0,
            cess: 0
          }
        };
      }

      return inv;
    });

    onUpdateInvoices(updatedInvoices);
    setResolvedIds(prev => new Set([...prev, issue.id]));
  };

  // Batch Auto-Resolve All Feasible Issues
  const handleAutoResolveAll = () => {
    let currentInvs = [...activeInvoices];

    activeIssues.forEach(issue => {
      if (!issue.autoFixType) return;

      currentInvs = currentInvs.map(inv => {
        if (inv.id !== issue.invoiceId) return inv;

        if (issue.autoFixType === 'CONVERT_TO_B2C') {
          return { ...inv, type: 'B2C' as const, gstin: '' };
        }
        if (issue.autoFixType === 'ASSIGN_DEFAULT_HSN') {
          const isServices = (inv.partyName || '').toLowerCase().includes('consult') || (inv.amount || 0) < 100000;
          const newCode = isServices ? '998311' : '847130';
          const newDesc = isServices ? 'Professional Consulting Services' : 'Electronic Data Equipment';
          return {
            ...inv,
            items: (inv.items && inv.items.length > 0)
              ? inv.items.map(i => ({ ...i, hsnSac: newCode, description: i.description || newDesc }))
              : [{
                  id: `itm-fix-${Date.now()}`,
                  description: newDesc,
                  hsnSac: newCode,
                  quantity: 1,
                  unit: isServices ? 'SAC' : 'NOS',
                  rate: inv.amount || 1000,
                  taxRate: 18,
                  taxableValue: inv.amount || 1000,
                  taxAmount: (inv.amount || 1000) * 0.18
                }]
          };
        }
        if (issue.autoFixType === 'SET_POS_FROM_GSTIN') {
          const derived = (inv.gstin && inv.gstin.length >= 2) ? inv.gstin.substring(0, 2) : currentTenant.stateCode;
          const isIntra = derived === currentTenant.stateCode;
          const taxAmt = inv.taxAmount || 0;
          return {
            ...inv,
            placeOfSupply: derived,
            taxDetails: {
              taxableValue: inv.amount || 0,
              cgst: isIntra ? taxAmt / 2 : 0,
              sgst: isIntra ? taxAmt / 2 : 0,
              igst: !isIntra ? taxAmt : 0,
              utgst: 0,
              cess: 0
            }
          };
        }
        if (issue.autoFixType === 'SET_DEFAULT_POS') {
          const pos = currentTenant.stateCode;
          const taxAmt = inv.taxAmount || 0;
          return {
            ...inv,
            placeOfSupply: pos,
            taxDetails: {
              taxableValue: inv.amount || 0,
              cgst: taxAmt / 2,
              sgst: taxAmt / 2,
              igst: 0,
              utgst: 0,
              cess: 0
            }
          };
        }
        if (issue.autoFixType === 'RECALCULATE_TAX') {
          const taxable = inv.amount || 0;
          const taxAmt = Math.round(taxable * 0.18 * 100) / 100;
          const isIntra = inv.placeOfSupply === currentTenant.stateCode;
          return {
            ...inv,
            taxAmount: taxAmt,
            taxDetails: {
              taxableValue: taxable,
              cgst: isIntra ? taxAmt / 2 : 0,
              sgst: isIntra ? taxAmt / 2 : 0,
              igst: !isIntra ? taxAmt : 0,
              utgst: 0,
              cess: 0
            }
          };
        }
        return inv;
      });
    });

    onUpdateInvoices(currentInvs);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-6"
    >
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">
              Step 3 of 4: Pre-Filing Audit
            </span>
            <span className="text-xs font-semibold text-slate-400">GST Portal Validation Rules</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-1">Identify & Rectify Missing Information</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Automated compliance scanner flags missing GSTINs, unmapped HSN codes, blank POS entries, and tax split discrepancies before JSON generation.
          </p>
        </div>

        {activeIssues.length > 0 && (
          <button
            onClick={handleAutoResolveAll}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95 self-start md:self-auto"
          >
            <Sparkles size={14} className="text-amber-300" />
            Auto-Resolve All Feasible Issues
          </button>
        )}
      </div>

      {/* Compliance Health Banner */}
      {criticalCount > 0 ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-900">
                {criticalCount} Critical Validation Discrepanc{criticalCount > 1 ? 'ies' : 'y'} Detected
              </h3>
              <p className="text-xs text-rose-700 mt-0.5">
                These defects will cause portal JSON rejection. Resolve them using the 1-click auto-fix actions or inline editing below.
              </p>
            </div>
          </div>
          <span className="bg-rose-100 text-rose-800 text-xs font-mono font-bold px-3 py-1 rounded-full shrink-0">
            Action Required Before JSON Export
          </span>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-900">
                All Outward Transactions Validated &amp; Compliant!
              </h3>
              <p className="text-xs text-emerald-700 mt-0.5">
                Zero critical defects found across {activeInvoices.length} transactions. Your dataset is 100% ready for GST Portal offline JSON export.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateStep(3)}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 active:scale-95"
          >
            Proceed to Step 4: Generate JSON <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Invoices Scanned</span>
          <div className="text-2xl font-mono font-black text-slate-900 mt-1">
            {activeInvoices.length}
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">Full Outward Ledger</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Discrepancies</span>
          <div className="text-2xl font-mono font-black text-slate-900 mt-1">
            {activeIssues.length}
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">Across all diagnostic categories</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Critical Blockers</span>
          <div className={`text-2xl font-mono font-black mt-1 ${criticalCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {criticalCount}
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">Requires fix for Table 4/12</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Advisory Warnings</span>
          <div className="text-2xl font-mono font-black text-amber-600 mt-1">
            {warningCount}
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">Tax split &amp; rounding notices</span>
        </div>
      </div>

      {/* Issues Diagnostic Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(['ALL', 'GSTIN', 'HSN', 'POS', 'TAX_MATH'] as const).map(cat => {
              const catCount = cat === 'ALL' 
                ? activeIssues.length 
                : activeIssues.filter(i => i.field === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    selectedCategory === cat 
                      ? 'bg-slate-900 text-white shadow-sm' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>
                    {cat === 'ALL' ? 'All Issues' :
                     cat === 'GSTIN' ? 'Missing GSTIN' :
                     cat === 'HSN' ? 'Missing HSN/SAC' :
                     cat === 'POS' ? 'Missing POS' : 'Tax Math Mismatch'}
                  </span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    selectedCategory === cat ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {catCount}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search flagged invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Issues List Cards */}
        <div className="space-y-3">
          <AnimatePresence>
            {filteredIssues.map(issue => {
              const targetInv = activeInvoices.find(i => i.id === issue.invoiceId);
              return (
                <motion.div
                  key={issue.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className={`border rounded-xl p-4 transition-all ${
                    issue.severity === 'CRITICAL' 
                      ? 'border-rose-200 bg-rose-50/20 hover:bg-rose-50/40' 
                      : 'border-amber-200 bg-amber-50/20 hover:bg-amber-50/40'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          issue.severity === 'CRITICAL' 
                            ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {issue.severity}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {issue.invoiceNumber}
                        </span>
                        <span className="text-xs text-slate-500 font-semibold">• {issue.partyName}</span>
                        <span className="text-[11px] font-mono text-slate-400">• {issue.date}</span>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {issue.portalImpact}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <AlertCircle size={14} className={issue.severity === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'} />
                        {issue.title}
                      </h4>

                      <p className="text-[11px] text-slate-600 leading-relaxed max-w-3xl">
                        {issue.description}
                      </p>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-2 shrink-0">
                      {targetInv && (
                        <button
                          onClick={() => onEditInvoice(targetInv)}
                          className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg shadow-xs transition-all flex items-center gap-1 active:scale-95"
                          title="Open inline invoice editor"
                        >
                          <Edit3 size={13} /> Edit
                        </button>
                      )}

                      {issue.autoFixType && (
                        <button
                          onClick={() => handleAutoFixSingle(issue)}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-all flex items-center gap-1 active:scale-95"
                          title="Apply standard GST statutory fix"
                        >
                          <Wrench size={13} /> {issue.autoFixLabel || '1-Click Auto-Fix'}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredIssues.length === 0 && (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <CheckCircle2 size={36} className="text-emerald-500 mx-auto stroke-[1.5]" />
              <p className="text-xs font-bold text-slate-700">No issues found in this category.</p>
              <p className="text-[11px] text-slate-400">All outward records comply with GST Portal requirements.</p>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
          <button
            onClick={() => onNavigateStep(1)}
            className="px-5 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
          >
            <ArrowLeft size={14} /> Back: Review HSN/SAC Summaries
          </button>
          
          <button
            onClick={() => onNavigateStep(3)}
            className={`px-6 py-2.5 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95 ${
              criticalCount > 0 
                ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {criticalCount > 0 ? (
              <>Proceed with {criticalCount} Warnings <ChevronRight size={14} /></>
            ) : (
              <>Next: Generate Final JSON <ArrowRight size={14} /></>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};
