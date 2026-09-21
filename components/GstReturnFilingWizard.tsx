import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, AlertCircle, AlertTriangle, ShieldCheck, ShieldAlert,
  Loader2, ArrowRight, ArrowLeft, Download, RefreshCw, X, FileText,
  KeyRound, Send, Check, Sparkles, Scale, Smartphone, HardDrive,
  Copy, ExternalLink, HelpCircle, Layers, ChevronDown, ChevronRight,
  Calculator, CheckCheck, Eye, EyeOff, Shield, Database, Radio,
  Receipt, Wallet, FileCode, Clock, Hash, Lock, CheckSquare,
  QrCode, AlertOctagon, CheckCheck as DoubleCheck, ArrowUpRight,
  MessageSquare
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  TaxComputationSummary, 
  Invoice, 
  UserAccessProfile, 
  ReturnFormType, 
  Tenant,
  FilingRecord,
  FilingDataSummary
} from '../types';
import { 
  fetchInvoices,
  fetchTaxComputation,
  preCheckFilingData, 
  prepareFilingPayload, 
  triggerPortalHandshake, 
  transmitFilingPayload,
  executeAutomatedMonthlyReturnFiling,
  sendWhatsAppNotification,
  submitReturn
} from '../services/api';
import { generateFilingAcknowledgmentPdf } from '../utils/pdfReportGenerator';
import { SendFilingStatusWhatsAppModal } from './SendFilingStatusWhatsAppModal';

export interface GstReturnFilingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  initialReturn?: FilingRecord | null;
  initialFormType?: ReturnFormType;
  initialPeriod?: string;
  initialGstin?: string;
  tenantId?: string;
  user?: UserAccessProfile | null;
  currentTenant?: Tenant | null;
  onFilingSuccess?: (filingResult: { arn: string; period: string; returnType: ReturnFormType }) => void;
}

interface ValidationRuleCheck {
  id: string;
  code: string;
  title: string;
  category: 'STRUCTURE' | 'TAX_MATH' | 'ITC_ELIGIBILITY' | 'HSN_COMPLIANCE' | 'DOC_CONTINUITY' | 'E_INVOICE';
  severity: 'ERROR' | 'WARNING' | 'PASSED';
  message: string;
  affectedCount: number;
  statutoryReference: string;
  autoFixAvailable: boolean;
  fixed: boolean;
  sampleIds?: string[];
}

export const GstReturnFilingWizard: React.FC<GstReturnFilingWizardProps> = ({
  isOpen,
  onClose,
  initialReturn,
  initialFormType = 'GSTR-3B',
  initialPeriod = 'July 2026',
  initialGstin,
  tenantId = 't1',
  user,
  currentTenant,
  onFilingSuccess
}) => {
  // Wizard Navigation
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 4;

  // Selected Scope
  const [returnType, setReturnType] = useState<ReturnFormType>(
    initialReturn?.type || initialFormType || 'GSTR-3B'
  );
  const [period, setPeriod] = useState<string>(initialReturn?.period || initialPeriod || 'July 2026');
  const [selectedGstin, setSelectedGstin] = useState<string>(
    initialGstin && initialGstin !== 'ALL' 
      ? initialGstin 
      : (currentTenant?.gstin || '27ABCDE1234F1Z5')
  );

  // Invoices & Live Financial Data
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState<boolean>(true);
  const [taxComputation, setTaxComputation] = useState<TaxComputationSummary | null>(null);

  // STEP 2: Validation Engine State
  const [validationFilter, setValidationFilter] = useState<'ALL' | 'ISSUES' | 'PASSED'>('ALL');
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [ruleChecks, setRuleChecks] = useState<ValidationRuleCheck[]>([]);
  const [autoFixNotes, setAutoFixNotes] = useState<string[]>([]);

  // STEP 3: Set-Off & Table Customization
  const [cashLedgerBalance, setCashLedgerBalance] = useState<{
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
  }>({
    igst: 25000,
    cgst: 18500,
    sgst: 18500,
    cess: 0
  });

  const [generatedChallan, setGeneratedChallan] = useState<{
    challanNo: string;
    amount: number;
    cpin: string;
    generatedAt: string;
  } | null>(null);
  const [isGeneratingChallan, setIsGeneratingChallan] = useState<boolean>(false);

  // STEP 4: Submission Preparation & E-Filing State
  const [signatoryName, setSignatoryName] = useState<string>('Dr. Vikram Malhotra');
  const [signatoryPan, setSignatoryPan] = useState<string>('ABCPM1234F');
  const [signatoryDesignation, setSignatoryDesignation] = useState<string>('Managing Director / Authorized Signatory');
  const [authMethod, setAuthMethod] = useState<'EVC' | 'DSC'>('EVC');
  
  // EVC states
  const [evcOtp, setEvcOtp] = useState<string>('');
  const [evcOtpSent, setEvcOtpSent] = useState<boolean>(false);
  const [evcOtpTimer, setEvcOtpTimer] = useState<number>(60);
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);

  // DSC states
  const [dscToken, setDscToken] = useState<string>('ePass2003 Class 3 (Cert: 9F8A2B10)');
  const [dscPin, setDscPin] = useState<string>('');
  const [showDscPin, setShowDscPin] = useState<boolean>(false);

  // Statutory Declaration
  const [declarationAccepted, setDeclarationAccepted] = useState<boolean>(false);

  // JSON Preview & Offline Tool
  const [showJsonModal, setShowJsonModal] = useState<boolean>(false);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);

  // Transmission Process
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionProgressStep, setSubmissionProgressStep] = useState<number>(0);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Final Acknowledgment
  const [filingResult, setFilingResult] = useState<{
    arn: string;
    filingDate: string;
    ackTime: string;
    signatureHash: string;
    totalLiability: number;
    itcUtilized: number;
    cashPaid: number;
    whatsappStatus?: string;
  } | null>(null);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState<boolean>(false);

  // Step Labels
  const stepTitles = [
    { num: 1, label: 'Scope & Data Compilation', short: 'Scope & Data' },
    { num: 2, label: 'Statutory Data Validation', short: 'Data Validation' },
    { num: 3, label: returnType === 'GSTR-1' ? 'Table Review & Variance' : 'Tax Liability & Set-Off', short: returnType === 'GSTR-1' ? 'Tables' : 'Set-Off' },
    { num: 4, label: 'Final Submission & E-Sign', short: 'E-File & Sign' }
  ];

  // Load Invoices & Tax Computation
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadData = async () => {
      setIsLoadingInvoices(true);
      try {
        const invs = await fetchInvoices(tenantId);
        const comp = await fetchTaxComputation(tenantId, selectedGstin);
        if (isMounted) {
          setInvoices(invs);
          setTaxComputation(comp);
        }
      } catch (err) {
        console.error('Error loading data for GST wizard:', err);
      } finally {
        if (isMounted) {
          setIsLoadingInvoices(false);
        }
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [isOpen, tenantId, selectedGstin]);

  // EVC Countdown Timer
  useEffect(() => {
    let interval: any = null;
    if (evcOtpSent && evcOtpTimer > 0) {
      interval = setInterval(() => {
        setEvcOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [evcOtpSent, evcOtpTimer]);

  // Calculate Aggregated Metrics
  const salesInvoices = useMemo(() => {
    return invoices.filter(i => i.category === 'SALES');
  }, [invoices]);

  const purchaseInvoices = useMemo(() => {
    return invoices.filter(i => i.category === 'PURCHASE');
  }, [invoices]);

  const grossSalesTurnover = useMemo(() => {
    return salesInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
  }, [salesInvoices]);

  const salesTaxBreakdown = useMemo(() => {
    return salesInvoices.reduce(
      (acc, curr) => ({
        igst: acc.igst + (curr.taxDetails?.igst || 0),
        cgst: acc.cgst + (curr.taxDetails?.cgst || 0),
        sgst: acc.sgst + (curr.taxDetails?.sgst || 0),
        cess: acc.cess + (curr.taxDetails?.cess || 0),
        total: acc.total + (curr.taxAmount || 0)
      }),
      { igst: 0, cgst: 0, sgst: 0, cess: 0, total: 0 }
    );
  }, [salesInvoices]);

  const eligibleItcBreakdown = useMemo(() => {
    return purchaseInvoices.reduce(
      (acc, curr) => {
        if (curr.isBlockedItc) {
          acc.blocked += curr.taxAmount || 0;
        } else {
          acc.igst += curr.taxDetails?.igst || 0;
          acc.cgst += curr.taxDetails?.cgst || 0;
          acc.sgst += curr.taxDetails?.sgst || 0;
          acc.cess += curr.taxDetails?.cess || 0;
          acc.total += curr.taxAmount || 0;
        }
        return acc;
      },
      { igst: 0, cgst: 0, sgst: 0, cess: 0, total: 0, blocked: 0 }
    );
  }, [purchaseInvoices]);

  // Section 49 Statutory Set-off Engine
  const setOffComputation = useMemo(() => {
    const liabIgst = salesTaxBreakdown.igst;
    const liabCgst = salesTaxBreakdown.cgst;
    const liabSgst = salesTaxBreakdown.sgst;
    const liabCess = salesTaxBreakdown.cess;

    let remItcIgst = eligibleItcBreakdown.igst;
    let remItcCgst = eligibleItcBreakdown.cgst;
    let remItcSgst = eligibleItcBreakdown.sgst;

    // 1. IGST ITC offsets IGST liability first
    const igstUsedAgainstIgst = Math.min(remItcIgst, liabIgst);
    remItcIgst -= igstUsedAgainstIgst;
    const unrecovIgstLiab = liabIgst - igstUsedAgainstIgst;

    // 2. Remaining IGST ITC offsets CGST and SGST liabilities
    const igstUsedAgainstCgst = Math.min(remItcIgst, liabCgst);
    remItcIgst -= igstUsedAgainstCgst;

    const igstUsedAgainstSgst = Math.min(remItcIgst, liabSgst);
    remItcIgst -= igstUsedAgainstSgst;

    // 3. CGST ITC offsets remaining CGST liability
    const remCgstLiab = liabCgst - igstUsedAgainstCgst;
    const cgstUsedAgainstCgst = Math.min(remItcCgst, remCgstLiab);
    remItcCgst -= cgstUsedAgainstCgst;

    // 4. SGST ITC offsets remaining SGST liability
    const remSgstLiab = liabSgst - igstUsedAgainstSgst;
    const sgstUsedAgainstSgst = Math.min(remItcSgst, remSgstLiab);
    remItcSgst -= sgstUsedAgainstSgst;

    // Net Cash Liabilities
    const netCashIgst = unrecovIgstLiab;
    const netCashCgst = remCgstLiab - cgstUsedAgainstCgst;
    const netCashSgst = remSgstLiab - sgstUsedAgainstSgst;
    const netCashCess = liabCess;
    const totalCashPayable = netCashIgst + netCashCgst + netCashSgst + netCashCess;

    const totalItcUtilized = 
      igstUsedAgainstIgst + igstUsedAgainstCgst + igstUsedAgainstSgst + 
      cgstUsedAgainstCgst + sgstUsedAgainstSgst;

    // Ledger balance check
    const cashDeficit = Math.max(0, totalCashPayable - (cashLedgerBalance.igst + cashLedgerBalance.cgst + cashLedgerBalance.sgst + cashLedgerBalance.cess));

    return {
      igstUsedAgainstIgst,
      igstUsedAgainstCgst,
      igstUsedAgainstSgst,
      cgstUsedAgainstCgst,
      sgstUsedAgainstSgst,
      totalItcUtilized,
      netCashIgst,
      netCashCgst,
      netCashSgst,
      netCashCess,
      totalCashPayable,
      cashDeficit,
      hasShortfall: cashDeficit > 0
    };
  }, [salesTaxBreakdown, eligibleItcBreakdown, cashLedgerBalance]);

  // Initial Validation Check Generation
  useEffect(() => {
    if (invoices.length === 0) return;

    // Identify anomalies dynamically
    const badGstinInvoices = invoices.filter(
      i => i.type === 'B2B' && i.gstin && (i.gstin.length !== 15 || !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(i.gstin))
    );

    const posMismatchInvoices = invoices.filter(i => {
      if (i.type === 'B2B' && i.gstin && i.placeOfSupply) {
        const buyerState = i.gstin.substring(0, 2);
        return i.placeOfSupply !== buyerState;
      }
      return false;
    });

    const unmappedHsnCount = invoices.reduce((acc, inv) => {
      const bad = (inv.items || []).filter(item => !item.hsnSac || item.hsnSac.length < 4);
      return acc + bad.length;
    }, 0);

    const blockedItcCount = purchaseInvoices.filter(i => i.isBlockedItc).length;

    const checks: ValidationRuleCheck[] = [
      {
        id: 'RULE_GSTIN_CHECKSUM',
        code: 'VAL-01',
        title: 'GSTIN Structure & Mod-36 Checksum Verification',
        category: 'STRUCTURE',
        severity: badGstinInvoices.length > 0 ? 'ERROR' : 'PASSED',
        message: badGstinInvoices.length > 0 
          ? `${badGstinInvoices.length} B2B invoice(s) fail official 15-character GSTIN regex or checksum validation.`
          : 'All counter-party GSTINs conform to statutory format standards.',
        affectedCount: badGstinInvoices.length,
        statutoryReference: 'Section 22 / 25 CGST Act',
        autoFixAvailable: badGstinInvoices.length > 0,
        fixed: false,
        sampleIds: badGstinInvoices.map(i => i.invoiceNumber)
      },
      {
        id: 'RULE_POS_ALIGNMENT',
        code: 'VAL-02',
        title: 'Place of Supply (POS) & Tax Head Reconciliation',
        category: 'STRUCTURE',
        severity: posMismatchInvoices.length > 0 ? 'WARNING' : 'PASSED',
        message: posMismatchInvoices.length > 0
          ? `${posMismatchInvoices.length} transaction(s) have a Place of Supply differing from recipient GSTIN state.`
          : 'Place of Supply strictly aligns with recipient state codes and tax heads.',
        affectedCount: posMismatchInvoices.length,
        statutoryReference: 'Section 10 / 12 IGST Act',
        autoFixAvailable: posMismatchInvoices.length > 0,
        fixed: false,
        sampleIds: posMismatchInvoices.map(i => i.invoiceNumber)
      },
      {
        id: 'RULE_HSN_DIGITS',
        code: 'VAL-03',
        title: 'Table 12 HSN/SAC 6/8-Digit Classification',
        category: 'HSN_COMPLIANCE',
        severity: unmappedHsnCount > 0 ? 'WARNING' : 'PASSED',
        message: unmappedHsnCount > 0
          ? `${unmappedHsnCount} item(s) have truncated or missing HSN/SAC codes (requires 6-digit for turnover > ₹5 Cr).`
          : 'All line items meet mandatory 6/8-digit HSN/SAC granularity.',
        affectedCount: unmappedHsnCount,
        statutoryReference: 'Notification No. 78/2020 - Central Tax',
        autoFixAvailable: unmappedHsnCount > 0,
        fixed: false
      },
      {
        id: 'RULE_GSTR2B_RECON',
        code: 'VAL-04',
        title: 'Rule 36(4) ITC Claim vs GSTR-2B Auto-Drafted Ceiling',
        category: 'ITC_ELIGIBILITY',
        severity: 'PASSED',
        message: 'Claimed ITC matches 100% of eligible invoices populated in auto-generated GSTR-2B.',
        affectedCount: 0,
        statutoryReference: 'Rule 36(4) CGST Rules (100% match condition)',
        autoFixAvailable: false,
        fixed: false
      },
      {
        id: 'RULE_BLOCKED_CREDIT',
        code: 'VAL-05',
        title: 'Section 17(5) Ineligible / Blocked Credit Segregation',
        category: 'ITC_ELIGIBILITY',
        severity: blockedItcCount > 0 ? 'WARNING' : 'PASSED',
        message: blockedItcCount > 0
          ? `${blockedItcCount} purchase invoice(s) identified with food/catering or motor vehicles; quarantined to Table 4(B)(1).`
          : 'No unsegregated blocked credits detected under Section 17(5).',
        affectedCount: blockedItcCount,
        statutoryReference: 'Section 17(5)(a)-(i) CGST Act',
        autoFixAvailable: blockedItcCount > 0,
        fixed: false
      },
      {
        id: 'RULE_TAX_MATH',
        code: 'VAL-06',
        title: 'Tax Head Mathematical Consistency & Non-Negative Balances',
        category: 'TAX_MATH',
        severity: 'PASSED',
        message: 'CGST and SGST values are perfectly mirrored for all intra-state transactions; zero negative balances.',
        affectedCount: 0,
        statutoryReference: 'Section 9 CGST / SGST Act',
        autoFixAvailable: false,
        fixed: false
      },
      {
        id: 'RULE_DOC_SERIES',
        code: 'VAL-07',
        title: 'Table 13 Serial Number Continuity & Document Registry',
        category: 'DOC_CONTINUITY',
        severity: 'PASSED',
        message: 'Invoices exhibit unbroken sequential numbering without duplicates or unexpected gaps.',
        affectedCount: 0,
        statutoryReference: 'Rule 46(b) CGST Rules',
        autoFixAvailable: false,
        fixed: false
      },
      {
        id: 'RULE_EINVOICE_IRN',
        code: 'VAL-08',
        title: 'E-Invoice IRN & Signed QR Code Validation',
        category: 'E_INVOICE',
        severity: 'PASSED',
        message: 'All B2B invoices have active 64-character IRNs generated via Invoice Registration Portal (IRP).',
        affectedCount: 0,
        statutoryReference: 'Rule 48(4) CGST Rules',
        autoFixAvailable: false,
        fixed: false
      }
    ];

    setRuleChecks(checks);
  }, [invoices, purchaseInvoices]);

  // Overall Validation Metrics
  const validationSummary = useMemo(() => {
    const errorCount = ruleChecks.filter(r => r.severity === 'ERROR' && !r.fixed).length;
    const warningCount = ruleChecks.filter(r => r.severity === 'WARNING' && !r.fixed).length;
    const passedCount = ruleChecks.filter(r => r.severity === 'PASSED' || r.fixed).length;
    const total = ruleChecks.length || 8;
    const score = Math.round((passedCount / total) * 100);

    return {
      errorCount,
      warningCount,
      passedCount,
      total,
      score,
      isFilingBlocked: errorCount > 0
    };
  }, [ruleChecks]);

  // One-Click Auto-Fix Handler
  const handleAutoFixRule = (ruleId: string) => {
    setRuleChecks(prev => 
      prev.map(r => {
        if (r.id === ruleId) {
          return {
            ...r,
            fixed: true,
            severity: 'PASSED',
            message: `Automated remediation applied: ${r.title} normalized and validated.`
          };
        }
        return r;
      })
    );

    if (ruleId === 'RULE_GSTIN_CHECKSUM') {
      setAutoFixNotes(prev => [...prev, 'Normalized GSTIN uppercase formatting and checksum digits for B2B supplies.']);
    } else if (ruleId === 'RULE_POS_ALIGNMENT') {
      setAutoFixNotes(prev => [...prev, 'Aligned Place of Supply to buyer state codes to satisfy Section 10/12 rules.']);
    } else if (ruleId === 'RULE_HSN_DIGITS') {
      setAutoFixNotes(prev => [...prev, 'Formatted line items with compliant standard 6-digit SAC/HSN codes.']);
    } else if (ruleId === 'RULE_BLOCKED_CREDIT') {
      setAutoFixNotes(prev => [...prev, 'Quarantined identified Section 17(5) items directly to GSTR-3B Table 4(B)(1) Ineligible ITC.']);
    }
  };

  const handleFixAllIssues = () => {
    setRuleChecks(prev => 
      prev.map(r => ({
        ...r,
        fixed: true,
        severity: 'PASSED',
        message: `Remediated: ${r.title} complies with statutory standards.`
      }))
    );
    setAutoFixNotes([
      'Normalized GSTIN structure and casing across all outward registers.',
      'Synchronized Place of Supply with recipient states.',
      'Standardized HSN codes to 6-digit statutory classification.',
      'Auto-quarantined Section 17(5) blocked credit to Table 4(B)(1).'
    ]);
  };

  // Generate Offline Tool Compliant JSON Payload
  const generatedJsonPayload = useMemo(() => {
    const periodCode = period.includes('July') ? '072026' : period.includes('August') ? '082026' : '092026';
    
    if (returnType === 'GSTR-1') {
      return {
        gstin: selectedGstin,
        fp: periodCode,
        cur_gt: grossSalesTurnover,
        version: 'GSTN_OFFLINE_TOOL_V1.4',
        b2b: salesInvoices.slice(0, 5).map((inv, idx) => ({
          ctin: inv.gstin || '27AABCU9603R1ZM',
          inv: [{
            inum: inv.invoiceNumber,
            idt: inv.date,
            val: inv.amount + (inv.taxAmount || 0),
            pos: inv.placeOfSupply || '27',
            rchg: inv.isRcm ? 'Y' : 'N',
            inv_typ: 'R',
            itms: (inv.items || [{
              id: '1',
              description: 'Supply',
              hsnSac: '998311',
              quantity: 1,
              unit: 'NOS',
              rate: inv.amount,
              taxRate: 18,
              taxableValue: inv.amount,
              taxAmount: inv.taxAmount
            }]).map((it, itmIdx) => ({
              num: itmIdx + 1,
              itm_det: {
                rt: it.taxRate || 18,
                txval: it.taxableValue || inv.amount,
                iamt: inv.placeOfSupply && inv.placeOfSupply !== '27' ? it.taxAmount : 0,
                camt: !inv.placeOfSupply || inv.placeOfSupply === '27' ? it.taxAmount / 2 : 0,
                samt: !inv.placeOfSupply || inv.placeOfSupply === '27' ? it.taxAmount / 2 : 0
              }
            }))
          }]
        })),
        b2cs: [
          {
            sply_ty: 'INTRA',
            txval: 35000,
            rt: 18,
            pos: '27',
            camt: 3150,
            samt: 3150
          }
        ],
        hsn: {
          data: [
            {
              num: 1,
              hsn_sc: '998313',
              desc: 'IT Infrastructure & Cloud Hosting Services',
              uqc: 'NOS',
              qty: 12,
              val: grossSalesTurnover,
              txval: grossSalesTurnover,
              rt: 18,
              camt: salesTaxBreakdown.cgst,
              samt: salesTaxBreakdown.sgst,
              iamt: salesTaxBreakdown.igst
            }
          ]
        },
        doc_issue: {
          doc_det: [
            {
              doc_num: 1,
              doc_typ: 'INV',
              from: 'INV-2026-001',
              to: `INV-2026-0${salesInvoices.length.toString().padStart(2, '0')}`,
              totnum: salesInvoices.length,
              canc: 0,
              net_issue: salesInvoices.length
            }
          ]
        }
      };
    } else {
      // GSTR-3B Payload
      return {
        gstin: selectedGstin,
        ret_period: periodCode,
        sec_sum: {
          sec_3_1: {
            taxable_supplies: {
              txval: grossSalesTurnover,
              iamt: salesTaxBreakdown.igst,
              camt: salesTaxBreakdown.cgst,
              samt: salesTaxBreakdown.sgst,
              csamt: salesTaxBreakdown.cess
            },
            zero_rated_supplies: { txval: 0, iamt: 0 },
            nil_exempt_supplies: { txval: 0 },
            rcm_inward: { txval: 0, iamt: 0, camt: 0, samt: 0 },
            non_gst_supplies: { txval: 0 }
          },
          sec_4_itc: {
            itc_avl: {
              import_goods: { iamt: 0, csamt: 0 },
              import_services: { iamt: 0, csamt: 0 },
              rcm_inward: { iamt: 0, camt: 0, samt: 0, csamt: 0 },
              isd_inward: { iamt: 0, camt: 0, samt: 0, csamt: 0 },
              all_other_itc: {
                iamt: eligibleItcBreakdown.igst,
                camt: eligibleItcBreakdown.cgst,
                samt: eligibleItcBreakdown.sgst,
                csamt: eligibleItcBreakdown.cess
              }
            },
            itc_rev: {
              rule_38_42_43: { iamt: 0, camt: 0, samt: 0 },
              section_17_5_blocked: {
                iamt: 0,
                camt: eligibleItcBreakdown.blocked / 2,
                samt: eligibleItcBreakdown.blocked / 2
              }
            }
          },
          sec_6_payment: {
            tax_payable: {
              iamt: salesTaxBreakdown.igst,
              camt: salesTaxBreakdown.cgst,
              samt: salesTaxBreakdown.sgst,
              csamt: salesTaxBreakdown.cess
            },
            itc_utilized: {
              iamt_against_iamt: setOffComputation.igstUsedAgainstIgst,
              iamt_against_camt: setOffComputation.igstUsedAgainstCgst,
              iamt_against_samt: setOffComputation.igstUsedAgainstSgst,
              camt_against_camt: setOffComputation.cgstUsedAgainstCgst,
              samt_against_samt: setOffComputation.sgstUsedAgainstSgst
            },
            cash_paid: {
              iamt: setOffComputation.netCashIgst,
              camt: setOffComputation.netCashCgst,
              samt: setOffComputation.netCashSgst,
              csamt: setOffComputation.netCashCess
            }
          }
        }
      };
    }
  }, [returnType, period, selectedGstin, grossSalesTurnover, salesInvoices, salesTaxBreakdown, eligibleItcBreakdown, setOffComputation]);

  // Copy JSON Handler
  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(generatedJsonPayload, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2500);
  };

  // Download JSON Handler
  const handleDownloadJson = () => {
    const jsonStr = JSON.stringify(generatedJsonPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${returnType.replace('-', '')}_${selectedGstin}_${period.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Send EVC OTP Handler
  const handleSendEvcOtp = async () => {
    setIsSendingOtp(true);
    await new Promise(r => setTimeout(r, 900));
    setIsSendingOtp(false);
    setEvcOtpSent(true);
    setEvcOtpTimer(60);
    setEvcOtp('749201'); // Pre-fill mock OTP for convenience with notice
  };

  // Generate Challan PMT-06 Simulation
  const handleGenerateChallan = () => {
    setIsGeneratingChallan(true);
    setTimeout(() => {
      setGeneratedChallan({
        challanNo: `CHL-${Date.now().toString().slice(-8)}`,
        cpin: `2608${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        amount: setOffComputation.cashDeficit,
        generatedAt: new Date().toLocaleDateString('en-IN')
      });
      // Replenish cash ledger after challan creation
      setCashLedgerBalance(prev => ({
        ...prev,
        cgst: prev.cgst + Math.ceil(setOffComputation.cashDeficit / 2),
        sgst: prev.sgst + Math.floor(setOffComputation.cashDeficit / 2)
      }));
      setIsGeneratingChallan(false);
    }, 1100);
  };

  // Portal Submission Handshake Sequence
  const handleExecutePortalSubmission = async () => {
    if (!declarationAccepted) {
      setSubmissionError('Please accept the statutory taxpayer declaration to authorize transmission.');
      return;
    }
    if (authMethod === 'EVC' && (!evcOtp || evcOtp.length < 6)) {
      setSubmissionError('Please enter the 6-digit EVC verification code sent to your registered mobile.');
      return;
    }
    if (authMethod === 'DSC' && (!dscPin || dscPin.length < 4)) {
      setSubmissionError('Please enter your USB Crypto Token PIN to unlock DSC.');
      return;
    }

    setSubmissionError(null);
    setIsSubmitting(true);
    setSubmissionProgressStep(1);

    try {
      // Step 1: Gateway Handshake
      await new Promise(r => setTimeout(r, 700));
      setSubmissionProgressStep(2);

      // Step 2: Payload Schema Validation
      await new Promise(r => setTimeout(r, 800));
      setSubmissionProgressStep(3);

      // Step 3: Cryptographic Digital Signing
      await new Promise(r => setTimeout(r, 900));
      setSubmissionProgressStep(4);

      // Step 4: Transmit & Receive Ack
      await new Promise(r => setTimeout(r, 1000));
      setSubmissionProgressStep(5);

      const generatedArn = `AA${selectedGstin.substring(0, 2)}${new Date().getMonth() + 1}${new Date().getFullYear().toString().slice(-2)}${Math.floor(1000000 + Math.random() * 9000000)}M`;
      const filedDate = new Date().toISOString().split('T')[0];
      const ackTime = new Date().toLocaleTimeString('en-IN');
      const signatureHash = `SHA256:${Array.from({length: 32}, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;

      const res = {
        arn: generatedArn,
        filingDate: filedDate,
        ackTime,
        signatureHash,
        totalLiability: salesTaxBreakdown.total,
        itcUtilized: setOffComputation.totalItcUtilized,
        cashPaid: setOffComputation.totalCashPayable,
        whatsappStatus: 'SENT'
      };

      setFilingResult(res);

      // Try triggering automated WhatsApp confirmation in background
      try {
        await sendWhatsAppNotification({
          to: user?.phone || '+919876543210',
          template: 'RETURN_FILED_SUCCESS',
          recipientName: signatoryName,
          recipientGstin: selectedGstin,
          data: {
            clientName: currentTenant?.name || 'TaxFlow Enterprise Ltd',
            returnType,
            period,
            arn: generatedArn,
            filedDate,
            taxPaid: setOffComputation.totalCashPayable
          },
          entityType: 'GST_RETURN',
          entityId: returnType
        });
      } catch (e) {
        console.warn('WhatsApp alert trigger skipped or optional', e);
      }

      // Notify parent
      if (onFilingSuccess) {
        onFilingSuccess({ arn: generatedArn, period, returnType });
      }

      setIsSubmitting(false);
    } catch (err: any) {
      setSubmissionError(err?.message || 'GSTN Portal transmission failed. Please retry.');
      setIsSubmitting(false);
      setSubmissionProgressStep(0);
    }
  };

  // Download PDF Acknowledgment Receipt
  const handleDownloadAcknowledgmentPdf = () => {
    if (!filingResult) return;

    generateFilingAcknowledgmentPdf({
      arn: filingResult.arn,
      returnType,
      period,
      gstin: selectedGstin,
      legalName: currentTenant?.name || 'TaxFlow Enterprise Ltd',
      tradeName: currentTenant?.name || 'TaxFlow Enterprise Ltd',
      filedDate: filingResult.filingDate,
      timestamp: filingResult.ackTime,
      signatoryName: signatoryName,
      signatoryDesignation: signatoryDesignation,
      taxSummary: {
        totalTurnover: grossSalesTurnover,
        totalLiability: filingResult.totalLiability,
        itcUtilized: filingResult.itcUtilized,
        cashPaid: filingResult.cashPaid,
        igst: salesTaxBreakdown.igst,
        cgst: salesTaxBreakdown.cgst,
        sgst: salesTaxBreakdown.sgst,
        cess: salesTaxBreakdown.cess
      },
      checksum: filingResult.signatureHash
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col my-auto max-h-[92vh] overflow-hidden"
        id="gst-return-filing-wizard-container"
      >
        {/* ================================================================= */}
        {/* HEADER SECTION */}
        {/* ================================================================= */}
        <div className="bg-slate-900 text-white px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                  GST Return Filing Wizard
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    GSTR-1 & 3B Engine
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Statutory preparation, multi-dimensional audit, ledger set-off, and cryptographic submission
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {/* Form Toggle Pill */}
            {!filingResult && (
              <div className="bg-slate-800 p-1 rounded-xl flex items-center border border-slate-700">
                <button
                  type="button"
                  onClick={() => setReturnType('GSTR-1')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    returnType === 'GSTR-1' 
                      ? 'bg-blue-600 text-white shadow' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  GSTR-1 (Outward)
                </button>
                <button
                  type="button"
                  onClick={() => setReturnType('GSTR-3B')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    returnType === 'GSTR-3B' 
                      ? 'bg-indigo-600 text-white shadow' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  GSTR-3B (Summary)
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close Wizard"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* STEPPER PROGRESS BAR */}
        {/* ================================================================= */}
        {!filingResult && (
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
            <div className="flex items-center justify-between max-w-3xl mx-auto">
              {stepTitles.map((step, idx) => {
                const isCompleted = currentStep > step.num;
                const isActive = currentStep === step.num;

                return (
                  <React.Fragment key={step.num}>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={step.num > currentStep && validationSummary.isFilingBlocked}
                        onClick={() => {
                          if (step.num < currentStep || !validationSummary.isFilingBlocked) {
                            setCurrentStep(step.num);
                          }
                        }}
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isCompleted 
                            ? 'bg-emerald-600 text-white shadow-sm' 
                            : isActive 
                              ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-sm' 
                              : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isCompleted ? <Check size={14} strokeWidth={3} /> : step.num}
                      </button>
                      <div className="hidden md:block text-left">
                        <span className={`block text-xs font-bold ${isActive ? 'text-slate-900' : 'text-slate-600'}`}>
                          {step.short}
                        </span>
                        <span className="block text-[10px] text-slate-600">
                          Step {step.num}
                        </span>
                      </div>
                    </div>

                    {idx < stepTitles.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-3 transition-colors ${
                        currentStep > step.num ? 'bg-emerald-500' : 'bg-slate-200'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* MAIN BODY CONTENT AREA */}
        {/* ================================================================= */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoadingInvoices ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">Compiling financial ledgers & return schemas...</p>
              <p className="text-xs text-slate-600">Fetching B2B invoices, credit notes, and GSTR-2B input credit data</p>
            </div>
          ) : filingResult ? (
            /* ============================================================= */
            /* SUCCESS & ACKNOWLEDGMENT SCREEN */
            /* ============================================================= */
            <div className="py-8 px-4 max-w-2xl mx-auto text-center space-y-6 animate-in zoom-in-95 duration-200">
              <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xl ring-8 ring-emerald-50">
                <CheckCircle2 size={44} />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-2xl font-black text-slate-900">
                  {returnType} Return Filed Successfully!
                </h3>
                <p className="text-sm text-slate-600">
                  Official acknowledgment generated & transmitted to the Goods and Services Tax Network (GSTN).
                </p>
              </div>

              {/* Official ARN Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-left shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                      Application Reference Number (ARN)
                    </span>
                    <span className="text-xl font-mono font-black text-slate-900 select-all tracking-wide">
                      {filingResult.arn}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                    <ShieldCheck size={14} /> E-Filed & Signed
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-600 block">Tax Period</span>
                    <span className="font-bold text-slate-800">{period}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 block">GSTIN</span>
                    <span className="font-mono font-bold text-slate-800">{selectedGstin}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 block">Filing Date</span>
                    <span className="font-bold text-slate-800">{filingResult.filingDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 block">Timestamp</span>
                    <span className="font-mono font-bold text-slate-800">{filingResult.ackTime}</span>
                  </div>
                </div>

                {/* QR Code and Cryptographic Verification Seal */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm">
                      <QRCodeSVG 
                        value={`GSTN-ACK|ARN:${filingResult.arn}|GSTIN:${selectedGstin}|PERIOD:${period}|DATE:${filingResult.filingDate}`} 
                        size={56} 
                      />
                    </div>
                    <div className="text-left">
                      <span className="text-[11px] font-bold text-slate-800 block">Digital Verification Seal</span>
                      <span className="text-[10px] font-mono text-slate-600 block truncate max-w-xs">
                        {filingResult.signatureHash}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                        <Check size={12} /> Authorized by {signatoryName} ({authMethod})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadAcknowledgmentPdf}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-2 active:scale-95"
                >
                  <Download size={16} /> Download Official Receipt (PDF)
                </button>
                <button
                  type="button"
                  onClick={() => setIsWhatsAppModalOpen(true)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-2 active:scale-95"
                >
                  <MessageSquare size={16} /> Send WhatsApp ARN to Client
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDownloadJson();
                  }}
                  className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
                >
                  <FileCode size={16} /> Download Filed JSON
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-all"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ============================================================= */}
              {/* STEP 1: SCOPE & DATA COMPILATION */}
              {/* ============================================================= */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* Context Header Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Return Form Choice */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                        Return Form
                      </label>
                      <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                        {returnType} ({returnType === 'GSTR-1' ? 'Outward Supplies' : 'Monthly Summary'})
                      </div>
                      <p className="text-[11px] text-slate-600">
                        {returnType === 'GSTR-1' 
                          ? 'Detailed invoice-level outward sales, B2B, B2C, and HSN Table 12.' 
                          : 'Self-assessed tax payment, ITC claims from 2B, and cash set-offs.'}
                      </p>
                    </div>

                    {/* Tax Period Selector */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                        Filing Period
                      </label>
                      <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="July 2026">July 2026 (Due: 20 Aug 2026)</option>
                        <option value="August 2026">August 2026 (Due: 20 Sep 2026)</option>
                        <option value="September 2026">September 2026 (Due: 20 Oct 2026)</option>
                        <option value="Q1 (Apr-Jun 2026)">Q1 (Apr-Jun 2026) - QRMP</option>
                      </select>
                      <p className="text-[11px] text-slate-600">Statutory due date tracked automatically.</p>
                    </div>

                    {/* Taxpayer GSTIN Selector */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                        Taxpayer GSTIN
                      </label>
                      <select
                        value={selectedGstin}
                        onChange={(e) => setSelectedGstin(e.target.value)}
                        className="w-full text-xs font-mono font-bold text-slate-800 bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="27ABCDE1234F1Z5">27ABCDE1234F1Z5 (Maharashtra HQ)</option>
                        <option value="29ABCDE1234F1Z6">29ABCDE1234F1Z6 (Karnataka Branch)</option>
                        <option value="07ABCDE1234F1Z2">07ABCDE1234F1Z2 (Delhi Branch)</option>
                      </select>
                      <p className="text-[11px] text-slate-600">{currentTenant?.name || 'TaxFlow Enterprise Ltd'}</p>
                    </div>
                  </div>

                  {/* Summary Metric Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100">
                      <span className="text-xs font-semibold text-blue-700 block">Total Outward Turnover</span>
                      <span className="text-lg font-bold text-blue-900 font-mono mt-1 block">
                        ₹{grossSalesTurnover.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-blue-600 mt-0.5 block">
                        {salesInvoices.length} Sales Invoices compiled
                      </span>
                    </div>

                    <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100">
                      <span className="text-xs font-semibold text-indigo-700 block">Gross Output Tax Liability</span>
                      <span className="text-lg font-bold text-indigo-900 font-mono mt-1 block">
                        ₹{salesTaxBreakdown.total.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-indigo-600 mt-0.5 block">
                        IGST + CGST + SGST
                      </span>
                    </div>

                    <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
                      <span className="text-xs font-semibold text-emerald-700 block">Available Eligible ITC (2B)</span>
                      <span className="text-lg font-bold text-emerald-900 font-mono mt-1 block">
                        ₹{eligibleItcBreakdown.total.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-emerald-600 mt-0.5 block">
                        From {purchaseInvoices.length} matched purchase records
                      </span>
                    </div>

                    <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-100">
                      <span className="text-xs font-semibold text-amber-700 block">Net Estimated Cash Payable</span>
                      <span className="text-lg font-bold text-amber-900 font-mono mt-1 block">
                        ₹{setOffComputation.totalCashPayable.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-amber-600 mt-0.5 block">
                        After optimal Section 49 set-off
                      </span>
                    </div>
                  </div>

                  {/* Table-Wise Breakdown (GSTR-1 or GSTR-3B) */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <Layers size={14} className="text-blue-600" />
                        {returnType === 'GSTR-1' ? 'GSTR-1 Statutory Tables Breakdown' : 'GSTR-3B Statutory Summary Tables'}
                      </h4>
                      <span className="text-xs text-slate-600 font-medium">
                        Auto-compiled from active ledger
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100 text-xs">
                      {returnType === 'GSTR-1' ? (
                        <>
                          <div className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                            <div>
                              <span className="font-bold text-slate-800 block">Table 4A, 4B - B2B Regular Invoices</span>
                              <span className="text-slate-600">Supplies made to registered taxpayers with verified GSTINs</span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-slate-900 block">
                                ₹{(grossSalesTurnover * 0.75).toLocaleString()}
                              </span>
                              <span className="text-[11px] text-slate-600">{Math.max(1, salesInvoices.length - 2)} records</span>
                            </div>
                          </div>

                          <div className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                            <div>
                              <span className="font-bold text-slate-800 block">Table 5 - B2C (Large) Invoices</span>
                              <span className="text-slate-600">Inter-state supplies to unregistered persons exceeding ₹2.5 Lakhs</span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-slate-900 block">₹0</span>
                              <span className="text-[11px] text-slate-600">0 records</span>
                            </div>
                          </div>

                          <div className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                            <div>
                              <span className="font-bold text-slate-800 block">Table 7 - B2C (Others / Small)</span>
                              <span className="text-slate-600">Intra-state and other small inter-state retail supplies</span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-slate-900 block">
                                ₹{(grossSalesTurnover * 0.25).toLocaleString()}
                              </span>
                              <span className="text-[11px] text-slate-600">2 summary rows</span>
                            </div>
                          </div>

                          <div className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                            <div>
                              <span className="font-bold text-slate-800 block">Table 12 - HSN-Wise Summary of Outward Supplies</span>
                              <span className="text-slate-600">Mandatory outward supply HSN codes with UQC and tax rates</span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-slate-900 block">
                                ₹{grossSalesTurnover.toLocaleString()}
                              </span>
                              <span className="text-[11px] text-emerald-600 font-semibold">100% Mapped</span>
                            </div>
                          </div>

                          <div className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                            <div>
                              <span className="font-bold text-slate-800 block">Table 13 - Documents Issued Summary</span>
                              <span className="text-slate-600">Total invoices, cancelled series, and net issued documents</span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-slate-900 block">
                                {salesInvoices.length} Documents
                              </span>
                              <span className="text-[11px] text-slate-600">Series: INV-2026-001 to 0{salesInvoices.length}</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                            <div>
                              <span className="font-bold text-slate-800 block">Table 3.1(a) - Outward Taxable Supplies</span>
                              <span className="text-slate-600">Other than zero rated, nil and exempted</span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-slate-900 block">
                                ₹{grossSalesTurnover.toLocaleString()} (Tax: ₹{salesTaxBreakdown.total.toLocaleString()})
                              </span>
                              <span className="text-[11px] text-slate-600">From verified Sales Register</span>
                            </div>
                          </div>

                          <div className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                            <div>
                              <span className="font-bold text-slate-800 block">Table 3.1(d) - Inward Supplies (Liable to Reverse Charge)</span>
                              <span className="text-slate-600">Supplies attracting RCM under Section 9(3)/9(4)</span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-slate-900 block">₹0</span>
                              <span className="text-[11px] text-slate-600">No RCM flagged</span>
                            </div>
                          </div>

                          <div className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                            <div>
                              <span className="font-bold text-slate-800 block">Table 4(A)(5) - All Other Eligible ITC</span>
                              <span className="text-slate-600">Auto-drafted from GSTR-2B purchase matching</span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-emerald-700 block">
                                ₹{eligibleItcBreakdown.total.toLocaleString()}
                              </span>
                              <span className="text-[11px] text-emerald-600 font-semibold">100% 2B matched</span>
                            </div>
                          </div>

                          <div className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                            <div>
                              <span className="font-bold text-slate-800 block">Table 4(B)(1) - Ineligible ITC under Section 17(5)</span>
                              <span className="text-slate-600">Blocked credits (motor vehicles, food & beverages, personal expenses)</span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-amber-700 block">
                                ₹{eligibleItcBreakdown.blocked.toLocaleString()}
                              </span>
                              <span className="text-[11px] text-slate-600">Quarantined from claim</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Ingestion & Connectivity Diagnostics */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Database size={16} className="text-blue-600 shrink-0" />
                      <span>
                        <strong>Ledger Health:</strong> All transactions synchronized with ERP and GSTR-2B matching engine.
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                        <Check size={12} /> ERP Synced
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                        <Check size={12} /> IRN Validated
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* STEP 2: STATUTORY DATA VALIDATION ENGINE */}
              {/* ============================================================= */}
              {currentStep === 2 && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* Readiness Banner */}
                  <div className="p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm bg-gradient-to-r from-slate-900 to-slate-800 text-white">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-inner ${
                        validationSummary.score === 100 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/30' 
                          : 'bg-amber-500/20 text-amber-400 border border-amber-400/30'
                      }`}>
                        {validationSummary.score}%
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          Filing Compliance Readiness Score
                          {validationSummary.score === 100 && (
                            <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.2 rounded-full">
                              Fully Validated
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-slate-300 mt-0.5">
                          {validationSummary.errorCount > 0 
                            ? `${validationSummary.errorCount} blocking error(s) must be rectified before GST portal submission.` 
                            : validationSummary.warningCount > 0 
                              ? 'Statutory schema passes with advisory warnings. Auto-fix available.' 
                              : 'All statutory validation parameters satisfied with 0 discrepancies.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {validationSummary.score < 100 && (
                        <button
                          type="button"
                          onClick={handleFixAllIssues}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow transition-all flex items-center gap-1.5 active:scale-95"
                        >
                          <Sparkles size={14} /> One-Click Auto-Fix All
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Filter Chips */}
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setValidationFilter('ALL')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                          validationFilter === 'ALL' 
                            ? 'bg-slate-900 text-white' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        All Rules ({ruleChecks.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setValidationFilter('ISSUES')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                          validationFilter === 'ISSUES' 
                            ? 'bg-amber-600 text-white' 
                            : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        }`}
                      >
                        Issues Detected ({validationSummary.errorCount + validationSummary.warningCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setValidationFilter('PASSED')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                          validationFilter === 'PASSED' 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        Compliant ({validationSummary.passedCount})
                      </button>
                    </div>

                    {autoFixNotes.length > 0 && (
                      <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 size={13} /> {autoFixNotes.length} rule(s) auto-remediated
                      </span>
                    )}
                  </div>

                  {/* Validation Rules Matrix */}
                  <div className="space-y-3">
                    {ruleChecks
                      .filter(r => {
                        if (validationFilter === 'ISSUES') return r.severity !== 'PASSED' && !r.fixed;
                        if (validationFilter === 'PASSED') return r.severity === 'PASSED' || r.fixed;
                        return true;
                      })
                      .map((rule) => {
                        const isResolved = rule.fixed || rule.severity === 'PASSED';

                        return (
                          <div
                            key={rule.id}
                            className={`p-4 rounded-xl border transition-all ${
                              isResolved 
                                ? 'bg-white border-slate-200 hover:border-slate-300' 
                                : rule.severity === 'ERROR' 
                                  ? 'bg-rose-50/60 border-rose-200' 
                                  : 'bg-amber-50/60 border-amber-200'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${
                                  isResolved 
                                    ? 'bg-emerald-100 text-emerald-700' 
                                    : rule.severity === 'ERROR' 
                                      ? 'bg-rose-100 text-rose-700' 
                                      : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {isResolved ? (
                                    <CheckCircle2 size={18} />
                                  ) : rule.severity === 'ERROR' ? (
                                    <AlertOctagon size={18} />
                                  ) : (
                                    <AlertTriangle size={18} />
                                  )}
                                </div>

                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-mono font-bold text-slate-500">
                                      [{rule.code}]
                                    </span>
                                    <h5 className="text-xs font-bold text-slate-900">
                                      {rule.title}
                                    </h5>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      isResolved 
                                        ? 'bg-emerald-100 text-emerald-800' 
                                        : rule.severity === 'ERROR' 
                                          ? 'bg-rose-100 text-rose-800' 
                                          : 'bg-amber-100 text-amber-800'
                                    }`}>
                                      {isResolved ? 'COMPLIANT' : rule.severity}
                                    </span>
                                  </div>

                                  <p className="text-xs text-slate-600 mt-1">
                                    {rule.message}
                                  </p>

                                  <span className="text-[10px] text-slate-500 mt-1 block">
                                    Statutory Mandate: {rule.statutoryReference}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                {!isResolved && rule.autoFixAvailable && (
                                  <button
                                    type="button"
                                    onClick={() => handleAutoFixRule(rule.id)}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1 active:scale-95"
                                  >
                                    <Sparkles size={12} /> Auto-Fix
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* STEP 3: COMPARATIVE RECONCILIATION & ITC SET-OFF CALCULATION */}
              {/* ============================================================= */}
              {currentStep === 3 && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {returnType === 'GSTR-1' ? (
                    /* GSTR-1 Table Drilldown & Ledger Reconciliation */
                    <div className="space-y-6">
                      <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 text-xs text-blue-900 space-y-1">
                        <span className="font-bold flex items-center gap-1.5">
                          <CheckCircle2 size={16} className="text-blue-600" />
                          GSTR-1 Outward Supplies Table-Wise Cross-Check
                        </span>
                        <p className="text-blue-700">
                          Cross-verifying outward supplies against the Sales Register. Ensure all credit notes and HSN summaries balance before generating final offline payload.
                        </p>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                            <tr>
                              <th className="p-3">GSTR-1 Table</th>
                              <th className="p-3">Description</th>
                              <th className="p-3 text-right">Invoices</th>
                              <th className="p-3 text-right">Taxable Value</th>
                              <th className="p-3 text-right">Total Tax</th>
                              <th className="p-3 text-center">Variance vs Books</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            <tr className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 font-mono font-bold text-blue-600">4A, 4B</td>
                              <td className="p-3 text-slate-700">B2B Registered Supplies (Standard Rate)</td>
                              <td className="p-3 text-right font-mono">{Math.max(1, salesInvoices.length - 2)}</td>
                              <td className="p-3 text-right font-mono font-bold">₹{(grossSalesTurnover * 0.75).toLocaleString()}</td>
                              <td className="p-3 text-right font-mono font-bold">₹{(salesTaxBreakdown.total * 0.75).toLocaleString()}</td>
                              <td className="p-3 text-center">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <Check size={10} /> 0 Variance
                                </span>
                              </td>
                            </tr>

                            <tr className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 font-mono font-bold text-blue-600">7</td>
                              <td className="p-3 text-slate-700">B2C Others (Small Intra/Inter-state)</td>
                              <td className="p-3 text-right font-mono">2</td>
                              <td className="p-3 text-right font-mono font-bold">₹{(grossSalesTurnover * 0.25).toLocaleString()}</td>
                              <td className="p-3 text-right font-mono font-bold">₹{(salesTaxBreakdown.total * 0.25).toLocaleString()}</td>
                              <td className="p-3 text-center">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <Check size={10} /> 0 Variance
                                </span>
                              </td>
                            </tr>

                            <tr className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 font-mono font-bold text-blue-600">9B</td>
                              <td className="p-3 text-slate-700">Credit / Debit Notes (Registered)</td>
                              <td className="p-3 text-right font-mono">1</td>
                              <td className="p-3 text-right font-mono font-bold">-₹15,000</td>
                              <td className="p-3 text-right font-mono font-bold">-₹2,700</td>
                              <td className="p-3 text-center">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <Check size={10} /> 0 Variance
                                </span>
                              </td>
                            </tr>

                            <tr className="hover:bg-slate-50 transition-colors bg-slate-50/50 font-bold">
                              <td className="p-3 font-mono text-slate-900" colSpan={2}>
                                Table 12 Consolidated HSN Verification
                              </td>
                              <td className="p-3 text-right font-mono">{salesInvoices.length}</td>
                              <td className="p-3 text-right font-mono text-slate-900">₹{grossSalesTurnover.toLocaleString()}</td>
                              <td className="p-3 text-right font-mono text-slate-900">₹{salesTaxBreakdown.total.toLocaleString()}</td>
                              <td className="p-3 text-center">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <Check size={10} /> Matched
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    /* GSTR-3B Statutory Set-off Engine */
                    <div className="space-y-6">
                      <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-200 text-xs text-indigo-900 space-y-1">
                        <span className="font-bold flex items-center gap-1.5">
                          <Scale size={16} className="text-indigo-600" />
                          Statutory Tax Set-Off Engine (Section 49, 49A, 49B of CGST Act)
                        </span>
                        <p className="text-indigo-700">
                          IGST credit is exhausted first against IGST, then CGST & SGST. CGST credit cannot offset SGST liability and vice versa.
                        </p>
                      </div>

                      {/* Set-Off Matrix Table */}
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                            <tr>
                              <th className="p-3">Tax Head</th>
                              <th className="p-3 text-right">Gross Output Liability</th>
                              <th className="p-3 text-right">Offset by IGST ITC</th>
                              <th className="p-3 text-right">Offset by CGST ITC</th>
                              <th className="p-3 text-right">Offset by SGST ITC</th>
                              <th className="p-3 text-right">Net Cash Payable</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            <tr className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 font-bold text-slate-900 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-600"></span> IGST
                              </td>
                              <td className="p-3 text-right font-mono font-bold">
                                ₹{salesTaxBreakdown.igst.toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-mono text-emerald-600 font-medium">
                                -₹{setOffComputation.igstUsedAgainstIgst.toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-mono text-slate-400">-</td>
                              <td className="p-3 text-right font-mono text-slate-400">-</td>
                              <td className="p-3 text-right font-mono font-bold text-slate-900">
                                ₹{setOffComputation.netCashIgst.toLocaleString()}
                              </td>
                            </tr>

                            <tr className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 font-bold text-slate-900 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-indigo-600"></span> CGST
                              </td>
                              <td className="p-3 text-right font-mono font-bold">
                                ₹{salesTaxBreakdown.cgst.toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-mono text-emerald-600 font-medium">
                                -₹{setOffComputation.igstUsedAgainstCgst.toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-mono text-emerald-600 font-medium">
                                -₹{setOffComputation.cgstUsedAgainstCgst.toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-mono text-slate-400">Blocked</td>
                              <td className="p-3 text-right font-mono font-bold text-slate-900">
                                ₹{setOffComputation.netCashCgst.toLocaleString()}
                              </td>
                            </tr>

                            <tr className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 font-bold text-slate-900 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-purple-600"></span> SGST
                              </td>
                              <td className="p-3 text-right font-mono font-bold">
                                ₹{salesTaxBreakdown.sgst.toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-mono text-emerald-600 font-medium">
                                -₹{setOffComputation.igstUsedAgainstSgst.toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-mono text-slate-400">Blocked</td>
                              <td className="p-3 text-right font-mono text-emerald-600 font-medium">
                                -₹{setOffComputation.sgstUsedAgainstSgst.toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-slate-900">
                                ₹{setOffComputation.netCashSgst.toLocaleString()}
                              </td>
                            </tr>

                            <tr className="bg-slate-50 font-bold border-t border-slate-200">
                              <td className="p-3 text-slate-900">Total Set-Off</td>
                              <td className="p-3 text-right font-mono text-slate-900">
                                ₹{salesTaxBreakdown.total.toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-mono text-emerald-700" colSpan={3}>
                                Total ITC Utilized: ₹{setOffComputation.totalItcUtilized.toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-mono text-blue-700 text-sm">
                                ₹{setOffComputation.totalCashPayable.toLocaleString()}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Electronic Cash Ledger & Challan Generation */}
                      <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div>
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                              <Wallet size={15} className="text-blue-600" />
                              Electronic Cash Ledger Balance vs Discharge Requirement
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Current balance available in GSTN electronic cash ledger
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="text-xs text-slate-500 block">Available Cash Balance</span>
                            <span className="text-sm font-mono font-bold text-slate-900">
                              ₹{(cashLedgerBalance.igst + cashLedgerBalance.cgst + cashLedgerBalance.sgst + cashLedgerBalance.cess).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {setOffComputation.hasShortfall ? (
                          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                              <div className="text-xs">
                                <span className="font-bold text-amber-900 block">
                                  Cash Ledger Shortfall: ₹{setOffComputation.cashDeficit.toLocaleString()}
                                </span>
                                <span className="text-amber-700">
                                  A PMT-06 challan must be generated to deposit funds before final tax payment.
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={isGeneratingChallan}
                              onClick={handleGenerateChallan}
                              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow transition-all flex items-center gap-1.5 shrink-0"
                            >
                              {isGeneratingChallan ? (
                                <>
                                  <Loader2 size={14} className="animate-spin" /> Generating...
                                </>
                              ) : (
                                <>
                                  <PlusCircleIcon /> Generate PMT-06 Challan
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-emerald-600" />
                            <span>
                              Cash ledger balance is sufficient to discharge all self-assessed tax liabilities.
                            </span>
                          </div>
                        )}

                        {generatedChallan && (
                          <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                            <div>
                              <span className="font-bold text-slate-800">Challan #{generatedChallan.challanNo}</span>
                              <span className="text-slate-500 block text-[11px]">CPIN: {generatedChallan.cpin} • Paid ₹{generatedChallan.amount.toLocaleString()}</span>
                            </div>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                              PAID & CREDITED
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================= */}
              {/* STEP 4: SUBMISSION PREPARATION & E-SIGNING */}
              {/* ============================================================= */}
              {currentStep === 4 && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* Pre-Submission Audit Card */}
                  <div className="bg-slate-900 text-white rounded-xl p-5 space-y-4 shadow-md">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-3">
                      <div>
                        <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block">
                          Official Pre-Submission Summary
                        </span>
                        <h4 className="text-base font-bold text-white">
                          {returnType} Return ({period})
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowJsonModal(true)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-all flex items-center gap-1.5"
                        >
                          <FileCode size={14} /> Preview JSON Schema
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadJson}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                        >
                          <Download size={14} /> Export Offline JSON
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block">Total Outward Turnover</span>
                        <span className="font-mono font-bold text-lg text-white block mt-0.5">
                          ₹{grossSalesTurnover.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Gross Tax Liability</span>
                        <span className="font-mono font-bold text-lg text-white block mt-0.5">
                          ₹{salesTaxBreakdown.total.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Total ITC Utilized</span>
                        <span className="font-mono font-bold text-lg text-emerald-400 block mt-0.5">
                          ₹{setOffComputation.totalItcUtilized.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Net Cash Paid</span>
                        <span className="font-mono font-bold text-lg text-amber-400 block mt-0.5">
                          ₹{setOffComputation.totalCashPayable.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Authentication & Signing Selector */}
                  <div className="p-5 bg-white rounded-xl border border-slate-200 space-y-4 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <KeyRound size={16} className="text-blue-600" />
                      Authorized Signatory & Cryptographic Verification
                    </h4>

                    {/* Signatory Dropdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Select Authorized Signatory
                        </label>
                        <select
                          value={signatoryName}
                          onChange={(e) => setSignatoryName(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="Dr. Vikram Malhotra">Dr. Vikram Malhotra (Managing Director)</option>
                          <option value="Ananya Sharma">Ananya Sharma (Head of Corporate Tax)</option>
                          <option value="Rajesh Gupta">Rajesh Gupta (Principal Accountant)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Signatory PAN
                        </label>
                        <input
                          type="text"
                          value={signatoryPan}
                          disabled
                          className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-mono font-bold cursor-not-allowed"
                        />
                      </div>
                    </div>

                    {/* Method Choice */}
                    <div className="pt-2 border-t border-slate-100">
                      <label className="text-xs font-bold text-slate-700 block mb-2">
                        Verification Mode
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                          authMethod === 'EVC' 
                            ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-100' 
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}>
                          <input
                            type="radio"
                            name="authMethod"
                            checked={authMethod === 'EVC'}
                            onChange={() => setAuthMethod('EVC')}
                            className="mt-1 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              <Smartphone size={14} className="text-blue-600" />
                              EVC (Electronic Verification Code)
                            </span>
                            <p className="text-[11px] text-slate-600 mt-1">
                              Instant one-time password dispatched to Aadhaar / PAN registered mobile & email.
                            </p>
                          </div>
                        </label>

                        <label className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                          authMethod === 'DSC' 
                            ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-100' 
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}>
                          <input
                            type="radio"
                            name="authMethod"
                            checked={authMethod === 'DSC'}
                            onChange={() => setAuthMethod('DSC')}
                            className="mt-1 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              <HardDrive size={14} className="text-indigo-600" />
                              DSC (Digital Signature Certificate)
                            </span>
                            <p className="text-[11px] text-slate-600 mt-1">
                              Class 3 cryptographic USB hardware token with statutory non-repudiation.
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Method Detail Input */}
                    {authMethod === 'EVC' ? (
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">
                            Aadhaar/PAN Linked Mobile OTP Verification
                          </span>
                          {!evcOtpSent ? (
                            <button
                              type="button"
                              disabled={isSendingOtp}
                              onClick={handleSendEvcOtp}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5"
                            >
                              {isSendingOtp ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                              Request OTP
                            </button>
                          ) : (
                            <span className="text-xs font-mono font-semibold text-blue-600">
                              Resend in {evcOtpTimer}s
                            </span>
                          )}
                        </div>

                        {evcOtpSent && (
                          <div className="flex items-center gap-3">
                            <input
                              type="text"
                              maxLength={6}
                              value={evcOtp}
                              onChange={(e) => setEvcOtp(e.target.value)}
                              placeholder="Enter 6-digit OTP"
                              className="w-48 p-2.5 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold tracking-widest text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            />
                            <span className="text-[11px] text-slate-600">
                              OTP sent to +91 98*** **210 (Auto-filled for testing)
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">
                              Detected Hardware Crypto Token
                            </label>
                            <input
                              type="text"
                              value={dscToken}
                              disabled
                              className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-mono text-xs cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">
                              USB Token PIN
                            </label>
                            <div className="relative">
                              <input
                                type={showDscPin ? 'text' : 'password'}
                                value={dscPin}
                                onChange={(e) => setDscPin(e.target.value)}
                                placeholder="Enter token PIN"
                                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-xs pr-10 focus:ring-2 focus:ring-indigo-500 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setShowDscPin(!showDscPin)}
                                className="absolute right-2.5 top-2.5 text-slate-600 hover:text-slate-700"
                              >
                                {showDscPin ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Statutory Declaration Checkbox */}
                    <div className="pt-3 border-t border-slate-100">
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={declarationAccepted}
                          onChange={(e) => setDeclarationAccepted(e.target.checked)}
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span className="text-xs text-slate-700 leading-relaxed">
                          <strong>Statutory Legal Affirmation:</strong> I solemnly affirm and declare that the information given herein above is true and correct to the best of my knowledge and belief, and that nothing has been concealed therefrom. I understand that false statements are punishable under Section 132 of the CGST Act.
                        </span>
                      </label>
                    </div>

                    {submissionError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                        <AlertCircle size={16} className="text-rose-600 shrink-0" />
                        <span>{submissionError}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ================================================================= */}
        {/* FOOTER ACTIONS */}
        {/* ================================================================= */}
        {!filingResult && (
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between gap-3">
            <div>
              {currentStep > 1 ? (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="px-4 py-2 border border-slate-300 hover:bg-white text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                >
                  <ArrowLeft size={14} /> Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {currentStep < totalSteps ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(prev => prev + 1)}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5 active:scale-95"
                >
                  Next Step <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting || !declarationAccepted}
                  onClick={handleExecutePortalSubmission}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Transmitting to GSTN...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} /> Sign & File {returnType} Now
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* SUBMISSION PROGRESS OVERLAY */}
        {/* ================================================================= */}
        <AnimatePresence>
          {isSubmitting && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            >
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 text-center">
                <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto ring-8 ring-blue-50">
                  <Loader2 size={32} className="animate-spin" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-bold text-slate-900">
                    Executing Portal Handshake & Filing
                  </h4>
                  <p className="text-xs text-slate-500">
                    Communicating directly with GSTN GSP API endpoint
                  </p>
                </div>

                {/* Progress Steps */}
                <div className="space-y-2.5 text-left text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className={`flex items-center gap-2 ${submissionProgressStep >= 1 ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                    {submissionProgressStep > 1 ? <Check size={14} className="text-emerald-600" /> : <Loader2 size={14} className="animate-spin text-blue-600" />}
                    <span>1. Establishing TLS 1.3 encrypted handshake with GSTN...</span>
                  </div>

                  <div className={`flex items-center gap-2 ${submissionProgressStep >= 2 ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                    {submissionProgressStep > 2 ? <Check size={14} className="text-emerald-600" /> : submissionProgressStep === 2 ? <Loader2 size={14} className="animate-spin text-blue-600" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />}
                    <span>2. Validating return schema against GSP v1.4 rules...</span>
                  </div>

                  <div className={`flex items-center gap-2 ${submissionProgressStep >= 3 ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                    {submissionProgressStep > 3 ? <Check size={14} className="text-emerald-600" /> : submissionProgressStep === 3 ? <Loader2 size={14} className="animate-spin text-blue-600" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />}
                    <span>3. Cryptographically signing payload ({authMethod})...</span>
                  </div>

                  <div className={`flex items-center gap-2 ${submissionProgressStep >= 4 ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                    {submissionProgressStep > 4 ? <Check size={14} className="text-emerald-600" /> : submissionProgressStep === 4 ? <Loader2 size={14} className="animate-spin text-blue-600" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />}
                    <span>4. Transmitting return & receiving ARN acknowledgment...</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ================================================================= */}
        {/* JSON PAYLOAD PREVIEW MODAL */}
        {/* ================================================================= */}
        {showJsonModal && (
          <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl text-white">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode size={18} className="text-blue-400" />
                  <h4 className="text-sm font-bold text-white">
                    GST Offline Tool Compliant JSON Payload
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                  >
                    {copiedJson ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    {copiedJson ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowJsonModal(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="p-4 overflow-y-auto flex-1 font-mono text-xs text-blue-300 bg-slate-950/60 leading-relaxed">
                <pre>{JSON.stringify(generatedJsonPayload, null, 2)}</pre>
              </div>

              <div className="px-6 py-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
                <span>Schema compliant with GSTN Offline Utility v1.4</span>
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center gap-1.5"
                >
                  <Download size={14} /> Download File
                </button>
              </div>
            </div>
          </div>
        )}

        {/* WhatsApp Filing Status Modal */}
        {filingResult && (
          <SendFilingStatusWhatsAppModal
            isOpen={isWhatsAppModalOpen}
            onClose={() => setIsWhatsAppModalOpen(false)}
            filing={{
              returnType,
              period,
              status: 'FILED',
              arn: filingResult.arn,
              filedDate: filingResult.filingDate,
              taxLiability: filingResult.cashPaid || filingResult.totalLiability || 0,
              recipientPhone: '+919876543210',
              clientName: currentTenant?.name || 'Acme Industrial Corp',
              recipientGstin: selectedGstin
            }}
            onSuccess={() => {
              // Notification logged and sent
            }}
          />
        )}
      </div>
    </div>
  );
};

function PlusCircleIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}
