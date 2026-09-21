import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchInvoices, updateInvoice } from '../services/api';
import { Invoice, InvoiceItem } from '../types';
import { 
  ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, XCircle, 
  RefreshCw, Download, Filter, Search, Sparkles, Zap, ChevronRight, 
  Info, Check, FileText, ArrowUpRight, HelpCircle, Eye, AlertCircle,
  FileSpreadsheet, SlidersHorizontal, Layers, Activity
} from 'lucide-react';

export type AuditSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type AuditRuleCategory = 
  | 'INVALID_GSTIN'
  | 'INVALID_TAX_SLAB'
  | 'POS_TAX_TYPE_MISMATCH'
  | 'CALCULATION_MISMATCH'
  | 'MISSING_EINVOICE'
  | 'MISSING_EWAY_BILL'
  | 'BLOCKED_ITC_CLAIM'
  | 'OUTDATED_DATE';

export interface AuditFinding {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  partyName: string;
  gstin: string;
  invoiceDate: string;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  category: AuditRuleCategory;
  severity: AuditSeverity;
  ruleTitle: string;
  description: string;
  recommendation: string;
  autoFixAvailable: boolean;
  actSection?: string;
  details?: {
    expectedValue?: string | number;
    foundValue?: string | number;
    variance?: number;
  };
}

export interface AuditSummary {
  totalAudited: number;
  cleanCount: number;
  flaggedCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  complianceScore: number; // 0 - 100
  taxAtRisk: number;
  breakdown: Record<AuditRuleCategory, number>;
}

// Valid Indian State Codes (GSTIN first 2 digits)
const VALID_STATE_CODES = new Set([
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
  '31', '32', '33', '34', '35', '36', '37', '38', '97', '99'
]);

// Valid Indian GST Tax Rate Slabs (%)
const VALID_TAX_SLABS = [0, 0.25, 3, 5, 12, 18, 28];

// 15-character GSTIN Regex
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Perform automated compliance audit rules on an invoice array.
 */
export const runGstAuditEngine = (invoices: Invoice[]): { findings: AuditFinding[]; summary: AuditSummary } => {
  const findings: AuditFinding[] = [];
  let criticalCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  let taxAtRisk = 0;

  const breakdown: Record<AuditRuleCategory, number> = {
    INVALID_GSTIN: 0,
    INVALID_TAX_SLAB: 0,
    POS_TAX_TYPE_MISMATCH: 0,
    CALCULATION_MISMATCH: 0,
    MISSING_EINVOICE: 0,
    MISSING_EWAY_BILL: 0,
    BLOCKED_ITC_CLAIM: 0,
    OUTDATED_DATE: 0,
  };

  const flaggedInvoiceIds = new Set<string>();

  invoices.forEach((inv) => {
    let invoiceHasIssues = false;
    const taxableVal = inv.amount || 0;
    const reportedTax = inv.taxAmount || 0;
    const totalVal = taxableVal + reportedTax;

    // ----------------------------------------------------------------------
    // RULE 1: GSTIN Format & State Code Validation
    // ----------------------------------------------------------------------
    if (inv.gstin && inv.gstin.toUpperCase() !== 'URP' && inv.gstin.toUpperCase() !== 'CONSUMER') {
      const cleanGstin = inv.gstin.trim().toUpperCase();
      const stateCode = cleanGstin.substring(0, 2);

      if (!GSTIN_REGEX.test(cleanGstin)) {
        invoiceHasIssues = true;
        breakdown.INVALID_GSTIN++;
        criticalCount++;
        taxAtRisk += reportedTax;
        findings.push({
          id: `f-${inv.id}-gstin-fmt`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          partyName: inv.partyName,
          gstin: inv.gstin,
          invoiceDate: inv.date,
          taxableAmount: taxableVal,
          taxAmount: reportedTax,
          totalAmount: totalVal,
          category: 'INVALID_GSTIN',
          severity: 'CRITICAL',
          ruleTitle: 'Mismatched GSTIN Format Standard',
          description: `GSTIN '${inv.gstin}' fails the 15-character alphanumeric checksum standard (2 State Digits + 10 PAN + 1 Entity Code + 'Z' + Check Digit).`,
          recommendation: 'Verify vendor GSTIN on GST Portal and update to valid 15-digit structure before filing GSTR-1/3B.',
          autoFixAvailable: false,
          actSection: 'Section 25 of CGST Act / Rule 8',
          details: { expectedValue: '15-Char Alphanumeric GSTIN', foundValue: inv.gstin }
        });
      } else if (!VALID_STATE_CODES.has(stateCode)) {
        invoiceHasIssues = true;
        breakdown.INVALID_GSTIN++;
        criticalCount++;
        taxAtRisk += reportedTax;
        findings.push({
          id: `f-${inv.id}-gstin-state`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          partyName: inv.partyName,
          gstin: inv.gstin,
          invoiceDate: inv.date,
          taxableAmount: taxableVal,
          taxAmount: reportedTax,
          totalAmount: totalVal,
          category: 'INVALID_GSTIN',
          severity: 'CRITICAL',
          ruleTitle: 'Invalid State Code in GSTIN Prefix',
          description: `First 2 digits '${stateCode}' of GSTIN '${inv.gstin}' do not represent a valid Indian State or Union Territory code.`,
          recommendation: 'Correct the state code prefix to match the registered business location.',
          autoFixAvailable: false,
          actSection: 'GST State Code Matrix (01-38)',
          details: { expectedValue: 'Valid State Code 01-38', foundValue: stateCode }
        });
      }
    }

    // ----------------------------------------------------------------------
    // RULE 2: Invalid Tax Rate Slab Validation
    // ----------------------------------------------------------------------
    const items = inv.items && inv.items.length > 0 
      ? inv.items 
      : [{ taxRate: taxableVal > 0 ? Math.round((reportedTax / taxableVal) * 100) : 18 }];

    items.forEach((item, idx) => {
      const rate = item.taxRate !== undefined ? item.taxRate : 18;
      if (!VALID_TAX_SLABS.includes(rate)) {
        invoiceHasIssues = true;
        breakdown.INVALID_TAX_SLAB++;
        criticalCount++;
        taxAtRisk += item.taxAmount || reportedTax;
        findings.push({
          id: `f-${inv.id}-tax-slab-${idx}`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          partyName: inv.partyName,
          gstin: inv.gstin,
          invoiceDate: inv.date,
          taxableAmount: taxableVal,
          taxAmount: reportedTax,
          totalAmount: totalVal,
          category: 'INVALID_TAX_SLAB',
          severity: 'CRITICAL',
          ruleTitle: 'Non-Standard Tax Rate Slab Detected',
          description: `Applied GST rate of ${rate}% is not a recognized statutory GST slab (0%, 0.25%, 3%, 5%, 12%, 18%, 28%).`,
          recommendation: `Align item GST rate with official schedule slabs. Closest standard slab is ${rate < 9 ? 5 : rate < 15 ? 12 : 18}%.`,
          autoFixAvailable: true,
          actSection: 'Section 9 of CGST Act / Rate Schedules',
          details: { expectedValue: '0%, 0.25%, 3%, 5%, 12%, 18%, 28%', foundValue: `${rate}%` }
        });
      }
    });

    // ----------------------------------------------------------------------
    // RULE 3: POS (Place of Supply) & Tax Type Misalignment
    // ----------------------------------------------------------------------
    if (inv.gstin && inv.gstin.length >= 2 && inv.placeOfSupply) {
      const supplierState = inv.gstin.substring(0, 2);
      const posState = inv.placeOfSupply.trim();
      const isIntraState = supplierState === posState;

      const cgst = inv.taxDetails?.cgst || 0;
      const sgst = inv.taxDetails?.sgst || 0;
      const igst = inv.taxDetails?.igst || 0;

      if (isIntraState && igst > 0 && (cgst === 0 && sgst === 0)) {
        invoiceHasIssues = true;
        breakdown.POS_TAX_TYPE_MISMATCH++;
        criticalCount++;
        taxAtRisk += igst;
        findings.push({
          id: `f-${inv.id}-pos-mismatch-intra`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          partyName: inv.partyName,
          gstin: inv.gstin,
          invoiceDate: inv.date,
          taxableAmount: taxableVal,
          taxAmount: reportedTax,
          totalAmount: totalVal,
          category: 'POS_TAX_TYPE_MISMATCH',
          severity: 'CRITICAL',
          ruleTitle: 'Intra-State Supply Charged with IGST',
          description: `Supplier state code '${supplierState}' matches Place of Supply '${posState}' (Intra-State), but IGST (₹${igst.toLocaleString('en-IN')}) was charged instead of CGST + SGST.`,
          recommendation: 'Reclassify tax heads into equal CGST + SGST components to prevent portal mismatch notices.',
          autoFixAvailable: true,
          actSection: 'Section 7 / 8 of IGST Act',
          details: { expectedValue: 'CGST + SGST', foundValue: 'IGST Only' }
        });
      } else if (!isIntraState && (cgst > 0 || sgst > 0) && igst === 0) {
        invoiceHasIssues = true;
        breakdown.POS_TAX_TYPE_MISMATCH++;
        criticalCount++;
        taxAtRisk += (cgst + sgst);
        findings.push({
          id: `f-${inv.id}-pos-mismatch-inter`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          partyName: inv.partyName,
          gstin: inv.gstin,
          invoiceDate: inv.date,
          taxableAmount: taxableVal,
          taxAmount: reportedTax,
          totalAmount: totalVal,
          category: 'POS_TAX_TYPE_MISMATCH',
          severity: 'CRITICAL',
          ruleTitle: 'Inter-State Supply Charged with CGST + SGST',
          description: `Supplier state code '${supplierState}' differs from Place of Supply '${posState}' (Inter-State), but CGST/SGST (₹${(cgst + sgst).toLocaleString('en-IN')}) was charged instead of IGST.`,
          recommendation: 'Reclassify tax under IGST. Wrongly paid tax under CGST/SGST cannot be adjusted against IGST without refund claim.',
          autoFixAvailable: true,
          actSection: 'Section 7 of IGST Act / Section 77 CGST Act',
          details: { expectedValue: 'IGST', foundValue: 'CGST + SGST' }
        });
      }
    }

    // ----------------------------------------------------------------------
    // RULE 4: Mathematical Computation Variance
    // ----------------------------------------------------------------------
    const effRate = items[0]?.taxRate !== undefined ? items[0].taxRate : 18;
    const expectedTax = Math.round((taxableVal * effRate) / 100);
    const taxVariance = Math.abs(reportedTax - expectedTax);

    if (taxableVal > 0 && reportedTax > 0 && taxVariance > 2.00) {
      invoiceHasIssues = true;
      breakdown.CALCULATION_MISMATCH++;
      warningCount++;
      findings.push({
        id: `f-${inv.id}-math-tax`,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        partyName: inv.partyName,
        gstin: inv.gstin,
        invoiceDate: inv.date,
        taxableAmount: taxableVal,
        taxAmount: reportedTax,
        totalAmount: totalVal,
        category: 'CALCULATION_MISMATCH',
        severity: 'WARNING',
        ruleTitle: 'Tax Amount Calculation Variance',
        description: `Reported tax (₹${reportedTax.toLocaleString('en-IN')}) differs from calculated value (₹${expectedTax.toLocaleString('en-IN')}) at ${effRate}% GST by ₹${taxVariance.toFixed(2)}.`,
        recommendation: 'Recalculate invoice item tax amounts to match standard rounding regulations.',
        autoFixAvailable: true,
        actSection: 'Section 170 of CGST Act (Rounding of Tax)',
        details: { expectedValue: `₹${expectedTax}`, foundValue: `₹${reportedTax}`, variance: taxVariance }
      });
    }

    // ----------------------------------------------------------------------
    // RULE 5: Missing E-Invoice (IRN) on B2B Invoices > ₹5 Cr Limit
    // ----------------------------------------------------------------------
    if (inv.type === 'B2B' && inv.category === 'SALES' && taxableVal >= 500000 && !inv.irn) {
      invoiceHasIssues = true;
      breakdown.MISSING_EINVOICE++;
      warningCount++;
      findings.push({
        id: `f-${inv.id}-einv-missing`,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        partyName: inv.partyName,
        gstin: inv.gstin,
        invoiceDate: inv.date,
        taxableAmount: taxableVal,
        taxAmount: reportedTax,
        totalAmount: totalVal,
        category: 'MISSING_EINVOICE',
        severity: 'WARNING',
        ruleTitle: 'E-Invoice IRN Mandatory Missing',
        description: `B2B sales invoice of ₹${taxableVal.toLocaleString('en-IN')} requires a 64-character IRN and QR Code under Rule 48(4) E-Invoicing mandate.`,
        recommendation: 'Generate E-Invoice via IRP portal immediately. Invoices without IRN are legally invalid in the recipient\'s hands.',
        autoFixAvailable: false,
        actSection: 'Rule 48(4) of CGST Rules',
        details: { expectedValue: '64-Char Hex IRN', foundValue: 'Missing / Draft' }
      });
    }

    // ----------------------------------------------------------------------
    // RULE 6: Missing E-Way Bill for High Value Goods (> ₹50,000)
    // ----------------------------------------------------------------------
    if (totalVal > 50000 && !inv.ewayBillDetails?.ewayBillNo) {
      invoiceHasIssues = true;
      breakdown.MISSING_EWAY_BILL++;
      infoCount++;
      findings.push({
        id: `f-${inv.id}-ewb-missing`,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        partyName: inv.partyName,
        gstin: inv.gstin,
        invoiceDate: inv.date,
        taxableAmount: taxableVal,
        taxAmount: reportedTax,
        totalAmount: totalVal,
        category: 'MISSING_EWAY_BILL',
        severity: 'INFO',
        ruleTitle: 'E-Way Bill Requirement Inspection',
        description: `Invoice value ₹${totalVal.toLocaleString('en-IN')} exceeds ₹50,000 threshold. If goods transportation is involved, an E-Way Bill is mandatory.`,
        recommendation: 'Generate E-Way Bill or tag as "Service Exemption" if non-goods invoice.',
        autoFixAvailable: false,
        actSection: 'Rule 138 of CGST Rules',
        details: { expectedValue: '12-Digit E-Way Bill No', foundValue: 'None' }
      });
    }

    // ----------------------------------------------------------------------
    // RULE 7: Blocked ITC Section 17(5)
    // ----------------------------------------------------------------------
    if (inv.category === 'PURCHASE' && inv.isBlockedItc === false) {
      const party = inv.partyName.toLowerCase();
      if (party.includes('motors') || party.includes('catering') || party.includes('club') || party.includes('personal')) {
        invoiceHasIssues = true;
        breakdown.BLOCKED_ITC_CLAIM++;
        warningCount++;
        findings.push({
          id: `f-${inv.id}-blocked-itc`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          partyName: inv.partyName,
          gstin: inv.gstin,
          invoiceDate: inv.date,
          taxableAmount: taxableVal,
          taxAmount: reportedTax,
          totalAmount: totalVal,
          category: 'BLOCKED_ITC_CLAIM',
          severity: 'WARNING',
          ruleTitle: 'Potential Ineligible ITC Claim (Section 17(5))',
          description: `Vendor '${inv.partyName}' appears to relate to motor vehicles, food catering, or personal consumption where ITC is blocked under CGST Act.`,
          recommendation: 'Reclassify ITC as "Blocked ITC under Sec 17(5)" in GSTR-3B Table 4(B)(1) to avoid interest penalties.',
          autoFixAvailable: true,
          actSection: 'Section 17(5) of CGST Act',
          details: { expectedValue: 'Blocked ITC', foundValue: 'Eligible ITC' }
        });
      }
    }

    if (invoiceHasIssues) {
      flaggedInvoiceIds.add(inv.id);
    }
  });

  const totalAudited = invoices.length || 1;
  const flaggedCount = flaggedInvoiceIds.size;
  const cleanCount = Math.max(0, totalAudited - flaggedCount);
  const complianceScore = Math.min(100, Math.max(0, Math.round((cleanCount / totalAudited) * 100)));

  return {
    findings,
    summary: {
      totalAudited: invoices.length,
      cleanCount,
      flaggedCount,
      criticalCount,
      warningCount,
      infoCount,
      complianceScore,
      taxAtRisk,
      breakdown,
    }
  };
};

/**
 * Summarized GST Auditor Dashboard Card
 */
export const GstAuditorCard: React.FC<{
  tenantId?: string;
  onOpenFullAuditor?: () => void;
}> = ({ tenantId = 't1', onOpenFullAuditor }) => {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  const { data: invoices = [], isLoading, refetch } = useQuery({
    queryKey: ['invoices-audit-card', tenantId],
    queryFn: () => fetchInvoices(tenantId),
    staleTime: 30000,
  });

  const { findings, summary } = useMemo(() => {
    return runGstAuditEngine(invoices);
  }, [invoices]);

  const handleRefreshAudit = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const filteredFindings = useMemo(() => {
    if (selectedCategoryFilter === 'ALL') return findings;
    if (selectedCategoryFilter === 'CRITICAL') return findings.filter(f => f.severity === 'CRITICAL');
    return findings.filter(f => f.category === selectedCategoryFilter);
  }, [findings, selectedCategoryFilter]);

  // Grade color scheme
  const getGradeBadge = (score: number) => {
    if (score >= 90) return { label: 'Grade A+ Compliant', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (score >= 75) return { label: 'Grade B (Minor Issues)', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'Grade C (High Risk)', color: 'bg-rose-50 text-rose-700 border-rose-200' };
  };

  const grade = getGradeBadge(summary.complianceScore);

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0 shadow-xs">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Automated GST Auditor</h3>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${grade.color}`}>
                {grade.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Real-time invoice rule engine &amp; tax compliance verification</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshAudit}
            disabled={isRefreshing || isLoading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all disabled:opacity-50"
            title="Re-run Audit Scan"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-indigo-600' : ''} />
          </button>
          
          {onOpenFullAuditor && (
            <button
              onClick={onOpenFullAuditor}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              <span>Full Audit Suite</span>
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4">
        <div className="p-3 bg-slate-50/80 border border-slate-100 rounded-xl">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Audited Invoices</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-black text-slate-900">{summary.totalAudited}</span>
            <span className="text-[10px] text-emerald-600 font-bold">({summary.cleanCount} Clean)</span>
          </div>
        </div>

        <div className="p-3 bg-rose-50/60 border border-rose-100/80 rounded-xl">
          <span className="text-[10px] font-extrabold text-rose-500 uppercase tracking-wider block">Critical Errors</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-black text-rose-700">{summary.criticalCount}</span>
            <span className="text-[10px] text-rose-600 font-medium">Strict Compliance</span>
          </div>
        </div>

        <div className="p-3 bg-amber-50/60 border border-amber-100/80 rounded-xl">
          <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider block">Warnings</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-black text-amber-800">{summary.warningCount}</span>
            <span className="text-[10px] text-amber-700 font-medium">Review Needed</span>
          </div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-white">
          <span className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-wider block">Tax at Risk</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg font-black text-white">₹{summary.taxAtRisk.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Audit Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none pt-1">
        <button
          onClick={() => setSelectedCategoryFilter('ALL')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
            selectedCategoryFilter === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All ({findings.length})
        </button>

        <button
          onClick={() => setSelectedCategoryFilter('CRITICAL')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
            selectedCategoryFilter === 'CRITICAL'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
          }`}
        >
          Critical ({summary.criticalCount})
        </button>

        <button
          onClick={() => setSelectedCategoryFilter('INVALID_GSTIN')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
            selectedCategoryFilter === 'INVALID_GSTIN'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
          }`}
        >
          Mismatched GSTIN ({summary.breakdown.INVALID_GSTIN})
        </button>

        <button
          onClick={() => setSelectedCategoryFilter('INVALID_TAX_SLAB')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
            selectedCategoryFilter === 'INVALID_TAX_SLAB'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
          }`}
        >
          Invalid Slabs ({summary.breakdown.INVALID_TAX_SLAB})
        </button>

        <button
          onClick={() => setSelectedCategoryFilter('POS_TAX_TYPE_MISMATCH')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
            selectedCategoryFilter === 'POS_TAX_TYPE_MISMATCH'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
          }`}
        >
          POS Mismatches ({summary.breakdown.POS_TAX_TYPE_MISMATCH})
        </button>

        <button
          onClick={() => setSelectedCategoryFilter('CALCULATION_MISMATCH')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
            selectedCategoryFilter === 'CALCULATION_MISMATCH'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
          }`}
        >
          Math Variances ({summary.breakdown.CALCULATION_MISMATCH})
        </button>
      </div>

      {/* Top Anomalies Preview List */}
      <div className="mt-3 space-y-2 max-h-64 overflow-y-auto sidebar-scrollbar pr-1">
        {filteredFindings.length === 0 ? (
          <div className="p-6 bg-emerald-50/50 border border-emerald-100 rounded-xl text-center">
            <CheckCircle2 size={28} className="text-emerald-500 mx-auto mb-2" />
            <p className="text-xs font-extrabold text-emerald-900">Zero Compliance Anomalies Detected</p>
            <p className="text-[11px] text-emerald-700 mt-0.5">All audited invoices pass GSTIN structure, statutory tax slabs, and Place of Supply rules.</p>
          </div>
        ) : (
          filteredFindings.slice(0, 4).map((item) => (
            <div 
              key={item.id}
              className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="flex items-start gap-2.5">
                {item.severity === 'CRITICAL' ? (
                  <XCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                ) : item.severity === 'WARNING' ? (
                  <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                ) : (
                  <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                )}
                
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900">{item.ruleTitle}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded font-semibold">
                      Inv #{item.invoiceNumber}
                    </span>
                    <span className="text-[10px] text-slate-500">({item.partyName})</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">{item.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <span className="text-[11px] font-extrabold text-slate-800">
                  ₹{item.taxAmount.toLocaleString('en-IN')}
                </span>
                {onOpenFullAuditor && (
                  <button
                    onClick={onOpenFullAuditor}
                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Inspect Finding"
                  >
                    <ChevronRight size={15} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Card Footer Action Bar */}
      {findings.length > 4 && onOpenFullAuditor && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 text-[11px]">
            Showing 4 of <strong>{findings.length}</strong> total compliance findings
          </span>
          <button
            onClick={onOpenFullAuditor}
            className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 transition-colors"
          >
            <span>View All Findings</span>
            <ArrowUpRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Full Interactive GST Auditor Component View
 */
export const GstAuditor: React.FC<{
  tenantId?: string;
  onClose?: () => void;
}> = ({ tenantId = 't1', onClose }) => {
  const queryClient = useQueryClient();
  const [activeSeverity, setActiveSeverity] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>('ALL');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFinding, setSelectedFinding] = useState<AuditFinding | null>(null);
  const [fixingFindingId, setFixingFindingId] = useState<string | null>(null);
  const [fixSuccessToast, setFixSuccessToast] = useState<string | null>(null);

  const { data: invoices = [], isLoading, refetch } = useQuery({
    queryKey: ['invoices-full-audit', tenantId],
    queryFn: () => fetchInvoices(tenantId),
  });

  const { findings, summary } = useMemo(() => {
    return runGstAuditEngine(invoices);
  }, [invoices]);

  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (activeSeverity !== 'ALL' && f.severity !== activeSeverity) return false;
      if (activeCategory !== 'ALL' && f.category !== activeCategory) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return (
          f.invoiceNumber.toLowerCase().includes(q) ||
          f.partyName.toLowerCase().includes(q) ||
          f.gstin.toLowerCase().includes(q) ||
          f.ruleTitle.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [findings, activeSeverity, activeCategory, searchQuery]);

  // One-click Auto Fix Handler
  const handleAutoFixFinding = async (finding: AuditFinding) => {
    setFixingFindingId(finding.id);
    try {
      const invToUpdate = invoices.find(i => i.id === finding.invoiceId);
      if (invToUpdate) {
        let updatedPayload: Partial<Invoice> = {};

        if (finding.category === 'POS_TAX_TYPE_MISMATCH') {
          // Reclassify IGST vs CGST/SGST
          const supplierState = invToUpdate.gstin ? invToUpdate.gstin.substring(0, 2) : '27';
          const posState = invToUpdate.placeOfSupply || '27';
          const isIntra = supplierState === posState;
          const totalTax = invToUpdate.taxAmount || 0;

          if (isIntra) {
            updatedPayload.taxDetails = {
              taxableValue: invToUpdate.taxDetails?.taxableValue || invToUpdate.amount || 0,
              cgst: Math.round(totalTax / 2),
              sgst: Math.round(totalTax / 2),
              igst: 0,
              utgst: 0,
              cess: invToUpdate.taxDetails?.cess || 0,
            };
          } else {
            updatedPayload.taxDetails = {
              taxableValue: invToUpdate.taxDetails?.taxableValue || invToUpdate.amount || 0,
              cgst: 0,
              sgst: 0,
              igst: totalTax,
              utgst: 0,
              cess: invToUpdate.taxDetails?.cess || 0,
            };
          }
        } else if (finding.category === 'INVALID_TAX_SLAB') {
          // Reset tax rates to nearest slab 18%
          if (invToUpdate.items && invToUpdate.items.length > 0) {
            updatedPayload.items = invToUpdate.items.map(item => ({
              ...item,
              taxRate: 18,
              taxAmount: Math.round((item.taxableValue || item.rate) * 0.18)
            }));
            updatedPayload.taxAmount = updatedPayload.items.reduce((s, i) => s + i.taxAmount, 0);
          }
        } else if (finding.category === 'BLOCKED_ITC_CLAIM') {
          updatedPayload.isBlockedItc = true;
          updatedPayload.reasonForBlocked = 'Section 17(5) Motor Vehicles / Personal Consumption';
        }

        await updateInvoice(finding.invoiceId, updatedPayload);
        await refetch();
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        setFixSuccessToast(`Auto-corrected invoice #${finding.invoiceNumber} successfully!`);
        setTimeout(() => setFixSuccessToast(null), 4000);
      }
    } catch (e) {
      console.error('Failed auto fix:', e);
    } finally {
      setFixingFindingId(null);
      setSelectedFinding(null);
    }
  };

  // Export CSV
  const handleExportAuditCsv = () => {
    const headers = ['Finding ID', 'Severity', 'Rule Category', 'Invoice Number', 'Party Name', 'GSTIN', 'Invoice Date', 'Taxable Amount', 'Tax Amount', 'Rule Title', 'Description', 'Recommendation', 'Act Section'];
    const rows = filteredFindings.map(f => [
      f.id,
      f.severity,
      f.category,
      f.invoiceNumber,
      `"${f.partyName}"`,
      f.gstin,
      f.invoiceDate,
      f.taxableAmount,
      f.taxAmount,
      `"${f.ruleTitle}"`,
      `"${f.description}"`,
      `"${f.recommendation}"`,
      `"${f.actSection || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GST_Audit_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {fixSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-emerald-900 text-white rounded-2xl shadow-2xl border border-emerald-700 flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-200">
          <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{fixSuccessToast}</span>
        </div>
      )}

      {/* Main Header Banner */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-white relative overflow-hidden shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-inner">
                <ShieldAlert size={26} />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-white">Automated GST Audit Suite</h2>
                <p className="text-xs text-slate-400 mt-0.5">Automated validation of GSTIN structures, tax slab compliance, Place of Supply, and Section 17(5) claims</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportAuditCsv}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-bold transition-all"
            >
              <Download size={15} />
              <span>Export Audit CSV</span>
            </button>

            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
              <span>Re-Run Audit Engine</span>
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-2.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
              >
                <XCircle size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Audit Metrics Summary Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Compliance Score</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-2xl font-black ${summary.complianceScore >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {summary.complianceScore}%
              </span>
              <span className="text-xs text-slate-400 font-medium">({summary.cleanCount}/{summary.totalAudited} Clean)</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Critical Mismatches</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-rose-400">{summary.criticalCount}</span>
              <span className="text-xs text-slate-400 font-medium">Strict Exceptions</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Audit Warnings</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-amber-400">{summary.warningCount}</span>
              <span className="text-xs text-slate-400 font-medium">Secondary Risk</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Tax Exposure</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-indigo-300">₹{summary.taxAtRisk.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Severity Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(['ALL', 'CRITICAL', 'WARNING', 'INFO'] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setActiveSeverity(sev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeSeverity === sev
                  ? sev === 'CRITICAL' ? 'bg-rose-600 text-white' 
                    : sev === 'WARNING' ? 'bg-amber-600 text-white'
                    : sev === 'INFO' ? 'bg-blue-600 text-white'
                    : 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {sev === 'ALL' ? `All Findings (${findings.length})` 
               : sev === 'CRITICAL' ? `Critical (${summary.criticalCount})`
               : sev === 'WARNING' ? `Warnings (${summary.warningCount})`
               : `Info (${summary.infoCount})`}
            </button>
          ))}
        </div>

        {/* Rule Category Select & Search Input */}
        <div className="flex items-center gap-3">
          <select
            value={activeCategory}
            onChange={(e) => setActiveCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Audit Rule Categories</option>
            <option value="INVALID_GSTIN">Mismatched GSTIN Format</option>
            <option value="INVALID_TAX_SLAB">Invalid Tax Rate Slabs</option>
            <option value="POS_TAX_TYPE_MISMATCH">Place of Supply (POS) Mismatch</option>
            <option value="CALCULATION_MISMATCH">Math Calculation Variances</option>
            <option value="MISSING_EINVOICE">Missing E-Invoice IRN</option>
            <option value="MISSING_EWAY_BILL">Missing E-Way Bill</option>
            <option value="BLOCKED_ITC_CLAIM">Blocked ITC Sec 17(5)</option>
          </select>

          <div className="relative flex-1 md:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice, vendor, GSTIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Findings Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Severity</th>
                <th className="py-3.5 px-4">Rule Category</th>
                <th className="py-3.5 px-4">Invoice # &amp; Date</th>
                <th className="py-3.5 px-4">Vendor / Party Name</th>
                <th className="py-3.5 px-4">GSTIN</th>
                <th className="py-3.5 px-4 text-right">Taxable Value</th>
                <th className="py-3.5 px-4 text-right">Tax Amount</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredFindings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
                    <p className="font-extrabold text-slate-800 text-sm">No Compliance Findings Found</p>
                    <p className="text-xs text-slate-500 mt-0.5">No audit anomalies match your current filters.</p>
                  </td>
                </tr>
              ) : (
                filteredFindings.map((finding) => (
                  <tr key={finding.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      {finding.severity === 'CRITICAL' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 font-extrabold rounded-full text-[10px]">
                          <XCircle size={12} /> CRITICAL
                        </span>
                      ) : finding.severity === 'WARNING' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 font-extrabold rounded-full text-[10px]">
                          <AlertTriangle size={12} /> WARNING
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 font-extrabold rounded-full text-[10px]">
                          <Info size={12} /> INFO
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{finding.ruleTitle}</span>
                      <span className="text-[10px] text-slate-400">{finding.actSection || 'CGST Act'}</span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-indigo-600 block">{finding.invoiceNumber}</span>
                      <span className="text-[10px] text-slate-400">{finding.invoiceDate}</span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-800 block truncate max-w-[140px]">{finding.partyName}</span>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {finding.gstin}
                    </td>

                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      ₹{finding.taxableAmount.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3 px-4 text-right font-extrabold text-rose-600">
                      ₹{finding.taxAmount.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedFinding(finding)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1"
                        >
                          <Eye size={13} />
                          <span>Inspect</span>
                        </button>

                        {finding.autoFixAvailable && (
                          <button
                            onClick={() => handleAutoFixFinding(finding)}
                            disabled={fixingFindingId === finding.id}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 disabled:opacity-50"
                          >
                            <Sparkles size={12} />
                            <span>Auto Fix</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Finding Inspection Drawer Modal */}
      {selectedFinding && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  selectedFinding.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-600'
                  : selectedFinding.severity === 'WARNING' ? 'bg-amber-100 text-amber-600'
                  : 'bg-blue-100 text-blue-600'
                }`}>
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">{selectedFinding.ruleTitle}</h3>
                  <p className="text-xs text-slate-500 font-mono">Invoice #{selectedFinding.invoiceNumber} • {selectedFinding.partyName}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedFinding(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block mb-1">Diagnostic Detail</span>
                <p className="text-slate-800 font-medium leading-relaxed">{selectedFinding.description}</p>
              </div>

              <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl">
                <span className="font-bold text-indigo-700 uppercase tracking-wider text-[10px] block mb-1">Statutory Recommendation</span>
                <p className="text-indigo-950 font-medium leading-relaxed">{selectedFinding.recommendation}</p>
                {selectedFinding.actSection && (
                  <span className="inline-block mt-2 font-mono text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold">
                    Statute: {selectedFinding.actSection}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-slate-100/80 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-bold block">Vendor GSTIN</span>
                  <span className="font-mono font-bold text-slate-800 text-xs">{selectedFinding.gstin}</span>
                </div>

                <div className="p-3 bg-slate-100/80 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-bold block">Reported Tax Amount</span>
                  <span className="font-extrabold text-rose-600 text-xs">₹{selectedFinding.taxAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedFinding(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
              >
                Close
              </button>

              {selectedFinding.autoFixAvailable && (
                <button
                  onClick={() => handleAutoFixFinding(selectedFinding)}
                  disabled={fixingFindingId === selectedFinding.id}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles size={14} />
                  <span>Execute Auto-Fix</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GstAuditor;
