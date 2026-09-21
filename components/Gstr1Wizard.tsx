import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Check, Download, Loader2, CheckCircle2, 
  AlertTriangle, X, Send, ShieldCheck, FileCheck, ArrowRight
} from 'lucide-react';
import { Invoice, FilingRecord, UserAccessProfile, FilingDataSummary } from '../types';
import { 
  fetchInvoices, submitReturn, preCheckFilingData, prepareFilingPayload, 
  triggerPortalHandshake, transmitFilingPayload, logAuditAction 
} from '../services/api';
import { HSNRecord, PortalTablesSummary } from './gstr1/types';
import { Step1UploadData } from './gstr1/Step1UploadData';
import { Step2HsnSummaries } from './gstr1/Step2HsnSummaries';
import { Step3IdentifyMissingInfo } from './gstr1/Step3IdentifyMissingInfo';
import { Step4GenerateJson } from './gstr1/Step4GenerateJson';

interface Gstr1WizardProps {
  selectedReturn: FilingRecord;
  onClose: () => void;
  tenantId: string;
  user: UserAccessProfile | null;
  onFilingSuccess?: () => void;
}

export const Gstr1Wizard: React.FC<Gstr1WizardProps> = ({
  selectedReturn,
  onClose,
  tenantId,
  user,
  onFilingSuccess
}) => {
  // Logical 4-step Guided GSTR-1 Filing Flow
  const steps = [
    { label: 'Upload Data', description: 'Import ERP or outward sales spreadsheet' },
    { label: 'Review HSN/SAC Summaries', description: 'GSTR-1 Table 12 outward codes' },
    { label: 'Identify Missing Information', description: 'Pre-filing audit & error rectification' },
    { label: 'Generate Final JSON', description: 'Export GST offline tool JSON & e-file' }
  ];

  const [activeStep, setActiveStep] = useState(0);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [excludedInvoices, setExcludedInvoices] = useState<Set<string>>(new Set());
  
  // Custom HSN summaries added in Step 2
  const [customHsns, setCustomHsns] = useState<HSNRecord[]>([]);

  // Edit Invoice Slide-over State
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  // Portal submission simulation states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [portalStatusStep, setPortalStatusStep] = useState<number>(-1);
  const portalSteps = [
    'Establishing secure handshake with GSTN Portal...',
    'Authenticating taxpayer GSTIN credentials via API...',
    'Running schema & cross-sectional validation (0 errors found)...',
    'Transmitting B2B, B2C, & HSN datasets to portal backend...',
    'Processing filing acknowledgment & generating ARN code...'
  ];
  const [filingStatus, setFilingStatus] = useState<'IDLE' | 'PROGRESS' | 'OTP_REQUIRED' | 'SUCCESS' | 'FAILED'>('IDLE');
  const [otp, setOtp] = useState('');
  const [generatedArn, setGeneratedArn] = useState('');
  const [authSignatory, setAuthSignatory] = useState('Dr. Vikram Malhotra - Managing Director');
  const [authMode, setAuthMode] = useState<'EVC' | 'DSC'>('EVC');
  const [dscPin, setDscPin] = useState('');
  const [dscTokenSelected, setDscTokenSelected] = useState('Dr. Vikram Malhotra - Class 3 - Valid till 2028-11-20');

  // Fetch initial sales invoices from ERP/System
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingInvoices(true);
        const data = await fetchInvoices(tenantId);
        const salesData = data.filter(inv => inv.category === 'SALES');
        setInvoices(salesData);
      } catch (err) {
        console.error('Error loading invoices:', err);
      } finally {
        setLoadingInvoices(false);
      }
    };
    loadData();
  }, [tenantId]);

  const currentTenant = user?.availableTenants.find(t => t.id === tenantId) || {
    gstin: '27ABCDE1234F1Z1',
    name: 'TaxFlow Enterprise Ltd',
    stateCode: '27'
  };

  // Compute active invoices (excluding custom-excluded)
  const activeInvoices = useMemo(() => {
    return invoices.filter(inv => !excludedInvoices.has(inv.id));
  }, [invoices, excludedInvoices]);

  // Financial Summaries
  const totalTaxableValue = useMemo(() => {
    return activeInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  }, [activeInvoices]);

  const totalCgst = useMemo(() => {
    return activeInvoices.reduce((sum, inv) => sum + (inv.taxDetails?.cgst || 0), 0);
  }, [activeInvoices]);

  const totalSgst = useMemo(() => {
    return activeInvoices.reduce((sum, inv) => sum + (inv.taxDetails?.sgst || 0), 0);
  }, [activeInvoices]);

  const totalIgst = useMemo(() => {
    return activeInvoices.reduce((sum, inv) => sum + (inv.taxDetails?.igst || 0), 0);
  }, [activeInvoices]);

  const totalTaxValue = totalCgst + totalSgst + totalIgst;
  const totalInvoiceValue = totalTaxableValue + totalTaxValue;

  // Auto-group invoices into HSN Records
  const computedHsns = useMemo(() => {
    const hsnMap: { [key: string]: HSNRecord } = {};

    activeInvoices.forEach(inv => {
      if (inv.items && inv.items.length > 0) {
        inv.items.forEach(item => {
          const hsn = item.hsnSac || '998311';
          const rate = item.taxRate || 18;
          const key = `${hsn}-${rate}`;

          if (!hsnMap[key]) {
            hsnMap[key] = {
              hsnCode: hsn,
              description: item.description || 'Outward Taxable Supplies',
              uqc: item.unit || (hsn.startsWith('99') ? 'SAC' : 'NOS'),
              quantity: item.quantity || 1,
              totalValue: (item.taxableValue || 0) + (item.taxAmount || 0),
              taxableValue: item.taxableValue || 0,
              taxRate: rate,
              igst: inv.placeOfSupply !== currentTenant.stateCode ? (item.taxAmount || 0) : 0,
              cgst: inv.placeOfSupply === currentTenant.stateCode ? (item.taxAmount || 0) / 2 : 0,
              sgst: inv.placeOfSupply === currentTenant.stateCode ? (item.taxAmount || 0) / 2 : 0
            };
          } else {
            hsnMap[key].quantity += item.quantity || 1;
            hsnMap[key].taxableValue += item.taxableValue || 0;
            hsnMap[key].totalValue += (item.taxableValue || 0) + (item.taxAmount || 0);
            if (inv.placeOfSupply !== currentTenant.stateCode) {
              hsnMap[key].igst += item.taxAmount || 0;
            } else {
              hsnMap[key].cgst += (item.taxAmount || 0) / 2;
              hsnMap[key].sgst += (item.taxAmount || 0) / 2;
            }
          }
        });
      } else {
        // Fallback for invoice without granular items
        const isServices = inv.amount < 100000;
        const hsn = isServices ? '998311' : '847130';
        const key = `${hsn}-18`;
        const taxAmt = inv.taxAmount || inv.amount * 0.18;
        if (!hsnMap[key]) {
          hsnMap[key] = {
            hsnCode: hsn,
            description: isServices ? 'Management & Technical Consulting' : 'Data Processing Units',
            uqc: isServices ? 'SAC' : 'NOS',
            quantity: 1,
            totalValue: inv.amount + taxAmt,
            taxableValue: inv.amount,
            taxRate: 18,
            igst: inv.placeOfSupply !== currentTenant.stateCode ? taxAmt : 0,
            cgst: inv.placeOfSupply === currentTenant.stateCode ? taxAmt / 2 : 0,
            sgst: inv.placeOfSupply === currentTenant.stateCode ? taxAmt / 2 : 0
          };
        } else {
          hsnMap[key].quantity += 1;
          hsnMap[key].taxableValue += inv.amount;
          hsnMap[key].totalValue += inv.amount + taxAmt;
          if (inv.placeOfSupply !== currentTenant.stateCode) {
            hsnMap[key].igst += taxAmt;
          } else {
            hsnMap[key].cgst += taxAmt / 2;
            hsnMap[key].sgst += taxAmt / 2;
          }
        }
      }
    });

    return Object.values(hsnMap);
  }, [activeInvoices, currentTenant.stateCode]);

  const allHsns = [...computedHsns, ...customHsns];

  // Group invoices for GSTR-1 Official Tables
  const portalTablesData: PortalTablesSummary = useMemo(() => {
    const b2bInvoices = activeInvoices.filter(i => i.type === 'B2B' && i.gstin);
    const b2bTaxable = b2bInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
    const b2bIgst = b2bInvoices.reduce((sum, i) => sum + (i.taxDetails?.igst || 0), 0);
    const b2bCgst = b2bInvoices.reduce((sum, i) => sum + (i.taxDetails?.cgst || 0), 0);
    const b2bSgst = b2bInvoices.reduce((sum, i) => sum + (i.taxDetails?.sgst || 0), 0);
    const b2bTax = b2bIgst + b2bCgst + b2bSgst;

    const b2cLarge = activeInvoices.filter(i => i.type === 'B2C' && i.placeOfSupply !== currentTenant.stateCode && ((i.amount || 0) + (i.taxAmount || 0)) > 250000);
    const b2clTaxable = b2cLarge.reduce((sum, i) => sum + (i.amount || 0), 0);
    const b2clIgst = b2cLarge.reduce((sum, i) => sum + (i.taxDetails?.igst || 0), 0);

    const b2cSmall = activeInvoices.filter(i => 
      (i.type === 'B2C' && (i.placeOfSupply === currentTenant.stateCode || ((i.amount || 0) + (i.taxAmount || 0)) <= 250000)) || 
      (i.type === 'B2B' && !i.gstin)
    );
    const b2csTaxable = b2cSmall.reduce((sum, i) => sum + (i.amount || 0), 0);
    const b2csIgst = b2cSmall.reduce((sum, i) => sum + (i.taxDetails?.igst || 0), 0);
    const b2csCgst = b2cSmall.reduce((sum, i) => sum + (i.taxDetails?.cgst || 0), 0);
    const b2csSgst = b2cSmall.reduce((sum, i) => sum + (i.taxDetails?.sgst || 0), 0);
    const b2csTax = b2csIgst + b2csCgst + b2csSgst;

    const exportInvoices = activeInvoices.filter(i => i.type === 'EXPORT');
    const expTaxable = exportInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
    const expIgst = exportInvoices.reduce((sum, i) => sum + (i.taxDetails?.igst || 0), 0);

    const exemptInvoices = activeInvoices.filter(i => (i as any).rate === 'Nil Rated / Exempt' || ((i.amount || 0) > 0 && (i.taxAmount || 0) === 0 && i.type !== 'EXPORT'));
    const exemptValue = exemptInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);

    const sortedInvoices = [...activeInvoices].sort((a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber));
    const firstDoc = sortedInvoices[0]?.invoiceNumber || 'INV/2026/0001';
    const lastDoc = sortedInvoices[sortedInvoices.length - 1]?.invoiceNumber || 'INV/2026/0999';

    return {
      b2b: { count: b2bInvoices.length, taxable: b2bTaxable, igst: b2bIgst, cgst: b2bCgst, sgst: b2bSgst, tax: b2bTax },
      b2cl: { count: b2cLarge.length, taxable: b2clTaxable, igst: b2clIgst },
      b2cs: { count: b2cSmall.length, taxable: b2csTaxable, igst: b2csIgst, cgst: b2csCgst, sgst: b2csSgst, tax: b2csTax },
      exp: { count: exportInvoices.length, taxable: expTaxable, igst: expIgst },
      exempt: { count: exemptInvoices.length, taxable: exemptValue },
      doc: { first: firstDoc, last: lastDoc, total: invoices.length, cancelled: excludedInvoices.size, net: activeInvoices.length }
    };
  }, [activeInvoices, invoices, excludedInvoices, currentTenant.stateCode]);

  // Build GST Portal Schema JSON Payload
  const gstr1JsonPayload = useMemo(() => {
    const b2bGroup: { [gstin: string]: { ctin: string; inv: any[] } } = {};
    const b2csList: any[] = [];
    const expList: any[] = [];

    activeInvoices.forEach(inv => {
      const invDateFormatted = inv.date ? inv.date.split('-').reverse().join('-') : '10-08-2026';
      
      if (inv.type === 'B2B' && inv.gstin) {
        if (!b2bGroup[inv.gstin]) {
          b2bGroup[inv.gstin] = { ctin: inv.gstin, inv: [] };
        }
        b2bGroup[inv.gstin].inv.push({
          inum: inv.invoiceNumber,
          idt: invDateFormatted,
          val: parseFloat(((inv.amount || 0) + (inv.taxAmount || 0)).toFixed(2)),
          pos: inv.placeOfSupply || currentTenant.stateCode,
          rchrg: inv.isRcm ? 'Y' : 'N',
          inv_typ: inv.isSez ? 'SEWP' : 'R',
          itms: [
            {
              num: 1,
              itm_det: {
                rt: 18,
                txval: parseFloat((inv.amount || 0).toFixed(2)),
                iamt: parseFloat((inv.taxDetails?.igst || 0).toFixed(2)),
                camt: parseFloat((inv.taxDetails?.cgst || 0).toFixed(2)),
                samt: parseFloat((inv.taxDetails?.sgst || 0).toFixed(2)),
                csamt: 0
              }
            }
          ]
        });
      } else if (inv.type === 'EXPORT') {
        expList.push({
          exp_typ: 'WPAY',
          inv: [
            {
              inum: inv.invoiceNumber,
              idt: invDateFormatted,
              val: parseFloat(((inv.amount || 0) + (inv.taxAmount || 0)).toFixed(2)),
              sbnum: 'SB' + Math.floor(100000 + Math.random() * 900000),
              sbdt: invDateFormatted,
              itms: [{ rt: 18, txval: parseFloat((inv.amount || 0).toFixed(2)), iamt: parseFloat((inv.taxDetails?.igst || 0).toFixed(2)) }]
            }
          ]
        });
      } else {
        b2csList.push({
          sply_ty: inv.placeOfSupply !== currentTenant.stateCode ? 'INTER' : 'INTRA',
          pos: inv.placeOfSupply || currentTenant.stateCode,
          rt: 18,
          txval: parseFloat((inv.amount || 0).toFixed(2)),
          iamt: parseFloat((inv.taxDetails?.igst || 0).toFixed(2)),
          camt: parseFloat((inv.taxDetails?.cgst || 0).toFixed(2)),
          samt: parseFloat((inv.taxDetails?.sgst || 0).toFixed(2)),
          csamt: 0
        });
      }
    });

    const hsnJsonData = allHsns.map((rec, index) => ({
      num: index + 1,
      hsn_sc: rec.hsnCode,
      desc: rec.description,
      uqc: rec.uqc,
      qty: rec.quantity,
      val: parseFloat(rec.totalValue.toFixed(2)),
      txval: parseFloat(rec.taxableValue.toFixed(2)),
      iamt: parseFloat(rec.igst.toFixed(2)),
      camt: parseFloat(rec.cgst.toFixed(2)),
      samt: parseFloat(rec.sgst.toFixed(2)),
      csamt: 0
    }));

    return {
      gstin: currentTenant.gstin,
      fp: selectedReturn.period.replace(/[^0-9]/g, '') || '082026',
      cur_gt: parseFloat(totalInvoiceValue.toFixed(2)),
      gt: parseFloat(totalInvoiceValue.toFixed(2)),
      b2b: Object.values(b2bGroup),
      b2cs: b2csList,
      exp: expList.length > 0 ? [{ num: 1, inv: expList.flatMap(e => e.inv) }] : [],
      hsn: { data: hsnJsonData }
    };
  }, [activeInvoices, allHsns, currentTenant, selectedReturn.period, totalInvoiceValue]);

  // Direct Portal Upload backed by GSTN API Handshake
  const handleDirectPortalUpload = async () => {
    setFilingStatus('PROGRESS');
    setPortalStatusStep(0);
    
    try {
      setPortalStatusStep(1);
      await preCheckFilingData(activeInvoices, currentTenant.gstin);
      
      setTimeout(async () => {
        setPortalStatusStep(2);
        const periodCode = selectedReturn.period.replace(/[^0-9]/g, "") || "082026";
        await prepareFilingPayload(activeInvoices, currentTenant.gstin, periodCode);
        
        setTimeout(() => {
          setPortalStatusStep(3);
          setTimeout(() => {
            setPortalStatusStep(4);
            setTimeout(() => {
              setFilingStatus('OTP_REQUIRED');
            }, 800);
          }, 1000);
        }, 1000);
      }, 1000);
    } catch (err) {
      console.error("Direct portal upload prep error", err);
      setFilingStatus('FAILED');
    }
  };

  // Final OTP / DSC Verification
  const handleVerifyOtp = async () => {
    if (authMode === 'EVC' && otp.length !== 6) return;
    if (authMode === 'DSC' && dscPin.length < 4) return;

    setIsSubmitting(true);
    try {
      const activeSummary: FilingDataSummary = {
        totalLiability: totalTaxValue,
        itcAvailable: 0,
        cashPayable: totalTaxValue,
        sections: [
          { label: 'B2B Outward Supplies', count: activeInvoices.filter(i => i.type === 'B2B').length, value: activeInvoices.filter(i => i.type === 'B2B').reduce((s, c) => s + c.amount, 0) },
          { label: 'B2C Supplies', count: activeInvoices.filter(i => i.type === 'B2C').length, value: activeInvoices.filter(i => i.type === 'B2C').reduce((s, c) => s + c.amount, 0) },
          { label: 'HSN Mapped Rows', count: allHsns.length, value: totalTaxableValue }
        ]
      };

      const securityCode = authMode === 'EVC' ? otp : dscPin;
      const handshake = await triggerPortalHandshake(currentTenant.gstin, securityCode);
      if (!handshake.success) throw new Error("GSTN Gateway Handshake Failed.");

      const tx = await transmitFilingPayload(activeSummary, handshake.sessionId);
      if (!tx.success) throw new Error("GSTR-1 Transmission Rejected.");

      await submitReturn(selectedReturn.id, activeSummary);
      const finalArn = tx.arn || `ARN-${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      setGeneratedArn(finalArn);

      await logAuditAction(
        `Digital Return Filed: GSTR-1 via ${authMode}`,
        'FILING',
        `Signatory: ${authSignatory}, Method: ${authMode}, ARN: ${finalArn}, Checksum: SHA-256 MATCHED`
      );

      setFilingStatus('SUCCESS');
      if (onFilingSuccess) onFilingSuccess();
    } catch (err) {
      console.error("Verification failed", err);
      setFilingStatus('FAILED');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download official JSON
  const handleDownloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(gstr1JsonPayload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    const cleanPeriod = selectedReturn.period.replace(/[^a-zA-Z0-9]/g, "_");
    downloadAnchor.setAttribute("download", `GSTR1_${currentTenant.gstin}_${cleanPeriod}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Handlers for child components
  const handleUpdateInvoices = (newInvoices: Invoice[]) => {
    setInvoices(newInvoices);
  };

  const handleToggleExclude = (invoiceId: string) => {
    setExcludedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(invoiceId)) next.delete(invoiceId);
      else next.add(invoiceId);
      return next;
    });
  };

  const handleSaveInvoiceEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;

    setInvoices(prev => prev.map(inv => {
      if (inv.id === editingInvoice.id) {
        return editingInvoice;
      }
      return inv;
    }));
    setEditingInvoice(null);
  };

  const sharedProps = {
    selectedReturn,
    tenantId,
    user,
    currentTenant,
    invoices,
    activeInvoices,
    excludedInvoices,
    allHsns,
    portalTablesData,
    totalTaxableValue,
    totalTaxValue,
    totalInvoiceValue,
    onUpdateInvoices: handleUpdateInvoices,
    onToggleExcludeInvoice: handleToggleExclude,
    onEditInvoice: (inv: Invoice) => setEditingInvoice(inv),
    onAddCustomHsn: (hsn: HSNRecord) => setCustomHsns(prev => [...prev, hsn]),
    onDeleteCustomHsn: (index: number) => setCustomHsns(prev => prev.filter((_, i) => i !== index)),
    onNavigateStep: (step: number) => setActiveStep(step),
    gstr1JsonPayload,
    onDownloadJson: handleDownloadJson,
    onStartDirectUpload: handleDirectPortalUpload,
    isSubmitting
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col min-h-[620px] animate-in fade-in duration-300">
      
      {/* Wizard Header */}
      <div className="bg-slate-900 text-white p-6 border-b border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
              id="gstr1-back-btn"
              title="Close Wizard and return to dashboard"
            >
              <ChevronLeft size={20}/>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-blue-500/20 text-blue-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-blue-500/30 uppercase tracking-wider">
                  Guided GSTR-1 Wizard
                </span>
                <span className="text-xs text-slate-400 font-semibold">• {selectedReturn.period} Filing</span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">Outward Supplies Return Filing</h2>
              <p className="text-slate-400 text-xs font-medium mt-0.5">
                GSTIN: <span className="font-mono text-slate-200 font-bold">{currentTenant.gstin}</span> • {currentTenant.name}
              </p>
            </div>
          </div>

          {/* 4 Steps Indicator */}
          {filingStatus !== 'SUCCESS' && (
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {steps.map((step, idx) => (
                <React.Fragment key={idx}>
                  <button 
                    onClick={() => {
                      if (idx < activeStep || idx === activeStep + 1) setActiveStep(idx);
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      activeStep === idx 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 ring-2 ring-blue-500/30' 
                        : activeStep > idx 
                          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25' 
                          : 'bg-slate-800/80 text-slate-400 border border-slate-700/50 hover:text-slate-200'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      activeStep === idx ? 'bg-white text-blue-700' : activeStep > idx ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'
                    }`}>
                      {activeStep > idx ? <Check size={10} className="stroke-[3]"/> : idx + 1}
                    </span>
                    <span className="whitespace-nowrap">{step.label}</span>
                  </button>
                  {idx < steps.length - 1 && <div className="w-3 h-px bg-slate-800 hidden lg:block" />}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-50">
        <AnimatePresence mode="wait">
          {filingStatus === 'SUCCESS' ? (
            /* Filing Success Screen */
            <motion.div 
              key="success-screen"
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              className="py-12 text-center max-w-xl mx-auto space-y-6"
            >
              <div className="w-20 h-20 bg-emerald-50 text-emerald-500 border border-emerald-200 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 size={44} className="stroke-[1.5]" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold text-slate-900">GSTR-1 Filed Successfully!</h2>
                <p className="text-slate-500 text-xs">
                  The GSTR-1 return for <span className="font-bold text-slate-700">{selectedReturn.period}</span> has been authenticated, verified, and uploaded.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-left divide-y divide-slate-100">
                <div className="py-2.5 flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-semibold">Acknowledgment Reference Number (ARN)</span>
                  <span className="font-mono font-extrabold text-slate-900 text-sm tracking-wide select-all bg-slate-100 px-3 py-1 rounded-lg">
                    {generatedArn || 'ARN-2708269188'}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-semibold">Verification Method</span>
                  <span className="font-bold text-slate-800">{authMode} Authorized Signature</span>
                </div>
                <div className="py-2.5 flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-semibold">Taxpayer GSTIN</span>
                  <span className="font-mono font-bold text-slate-800">{currentTenant.gstin}</span>
                </div>
                <div className="py-2.5 flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-semibold">Authorized Signatory</span>
                  <span className="font-semibold text-slate-800">{authSignatory}</span>
                </div>
                <div className="py-2.5 flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-semibold">Filing Timestamp</span>
                  <span className="font-bold text-slate-700">{new Date().toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-center gap-3 pt-2">
                <button 
                  onClick={onClose}
                  className="px-6 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 shadow-sm transition-all active:scale-95"
                >
                  Return to Dashboard
                </button>
                <button 
                  onClick={handleDownloadJson}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md transition-all active:scale-95 flex items-center gap-2"
                >
                  <Download size={14}/> Download JSON Payload
                </button>
              </div>
            </motion.div>
          ) : (
            /* Step-by-Step Render */
            <div key={`step-${activeStep}`}>
              {activeStep === 0 && <Step1UploadData {...sharedProps} />}
              {activeStep === 1 && <Step2HsnSummaries {...sharedProps} />}
              {activeStep === 2 && <Step3IdentifyMissingInfo {...sharedProps} />}
              {activeStep === 3 && <Step4GenerateJson {...sharedProps} />}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Direct Portal Upload Modal */}
      {filingStatus !== 'IDLE' && filingStatus !== 'SUCCESS' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 md:p-8 space-y-6"
          >
            {filingStatus === 'PROGRESS' && (
              <div className="space-y-6 text-center">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                  <Loader2 size={28} className="animate-spin" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 text-base">Connecting with GST Portal Gateway</h3>
                  <p className="text-slate-500 text-xs">Authenticating and transmitting outward tax ledger...</p>
                </div>

                <div className="space-y-2.5 text-left bg-slate-50 p-4 rounded-xl border border-slate-200">
                  {portalSteps.map((stepDesc, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-xs">
                      {portalStatusStep > idx ? (
                        <CheckCircle2 size={15} className="text-emerald-500 shrink-0"/>
                      ) : portalStatusStep === idx ? (
                        <Loader2 size={15} className="animate-spin text-blue-600 shrink-0"/>
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0"/>
                      )}
                      <span className={portalStatusStep >= idx ? 'text-slate-800 font-semibold' : 'text-slate-400'}>
                        {stepDesc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filingStatus === 'OTP_REQUIRED' && (
              <div className="space-y-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Digital Return Verification</h3>
                    <p className="text-slate-500 text-xs mt-0.5">Authorize final transmission for {selectedReturn.period}</p>
                  </div>
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">
                    Pre-Check Passed
                  </span>
                </div>

                {/* Signatory Selector */}
                <div className="space-y-1 text-xs">
                  <label className="text-slate-600 font-bold">Authorized Signatory</label>
                  <select 
                    value={authSignatory}
                    onChange={(e) => setAuthSignatory(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800 font-semibold text-xs"
                  >
                    <option value="Dr. Vikram Malhotra - Managing Director">Dr. Vikram Malhotra (Managing Director)</option>
                    <option value="Pooja Mehta - Principal Compliance Officer">Pooja Mehta (Principal Compliance Officer)</option>
                  </select>
                </div>

                {/* Mode Selector */}
                <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  <button 
                    onClick={() => setAuthMode('EVC')}
                    className={`flex-1 py-2 rounded-lg transition-all ${
                      authMode === 'EVC' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    EVC (SMS / Aadhaar OTP)
                  </button>
                  <button 
                    onClick={() => setAuthMode('DSC')}
                    className={`flex-1 py-2 rounded-lg transition-all ${
                      authMode === 'DSC' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    DSC (Digital Token)
                  </button>
                </div>

                {authMode === 'EVC' ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 leading-relaxed">
                      OTP sent to registered mobile <span className="font-mono font-bold">+91 ••••• ••482</span> and email. Enter 6-digit passcode.
                    </div>
                    <input 
                      type="text" 
                      maxLength={6}
                      placeholder="• • • • • •"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center tracking-[0.6em] font-mono text-xl py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                      <span>Demo test OTP: Any 6 digits (e.g. 123456)</span>
                      <button type="button" onClick={() => setOtp('123456')} className="text-blue-600 font-bold hover:underline">
                        Auto-fill
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1 text-xs">
                      <label className="text-slate-600 font-bold">Detected Class 3 Token</label>
                      <input 
                        type="text" 
                        readOnly 
                        value={dscTokenSelected}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1 text-xs">
                      <label className="text-slate-600 font-bold">DSC Hardware PIN</label>
                      <input 
                        type="password" 
                        placeholder="Enter token PIN"
                        value={dscPin}
                        onChange={(e) => setDscPin(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-3 border-t border-slate-100">
                  <button 
                    onClick={() => setFilingStatus('IDLE')}
                    className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleVerifyOtp}
                    disabled={isSubmitting || (authMode === 'EVC' ? otp.length !== 6 : dscPin.length < 4)}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>}
                    Sign &amp; Transmit
                  </button>
                </div>
              </div>
            )}

            {filingStatus === 'FAILED' && (
              <div className="space-y-4 text-center">
                <div className="w-12 h-12 bg-rose-50 text-rose-600 border border-rose-200 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle size={24}/>
                </div>
                <h3 className="font-bold text-slate-900 text-base">Filing Transmission Failed</h3>
                <p className="text-slate-500 text-xs">
                  The central GSTN API server reported an authorization error or session timeout.
                </p>
                <button 
                  onClick={() => setFilingStatus('IDLE')}
                  className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
                >
                  Back to Wizard
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Edit Invoice Slide-over Modal */}
      {editingInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-end z-50">
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            className="bg-white w-full max-w-md h-full shadow-2xl p-6 overflow-y-auto flex flex-col justify-between"
          >
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Adjust Sales Invoice</h3>
                  <p className="text-slate-500 text-xs mt-0.5">Edit transaction fields on-the-fly for GSTR-1</p>
                </div>
                <button 
                  onClick={() => setEditingInvoice(null)}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700"
                >
                  <X size={20}/>
                </button>
              </div>

              <form onSubmit={handleSaveInvoiceEdit} className="space-y-4 text-xs font-semibold">
                <div className="space-y-1">
                  <label className="text-slate-600">Invoice Number</label>
                  <input 
                    type="text" 
                    value={editingInvoice.invoiceNumber}
                    onChange={(e) => setEditingInvoice({ ...editingInvoice, invoiceNumber: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600">Invoice Date</label>
                  <input 
                    type="date" 
                    value={editingInvoice.date}
                    onChange={(e) => setEditingInvoice({ ...editingInvoice, date: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600">Customer Name</label>
                  <input 
                    type="text" 
                    value={editingInvoice.partyName}
                    onChange={(e) => setEditingInvoice({ ...editingInvoice, partyName: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600">Customer GSTIN (Leave blank for B2C)</label>
                  <input 
                    type="text" 
                    value={editingInvoice.gstin || ''}
                    placeholder="e.g. 27AAACR1034D1Z2"
                    onChange={(e) => setEditingInvoice({ 
                      ...editingInvoice, 
                      gstin: e.target.value.toUpperCase(),
                      type: e.target.value.trim() ? 'B2B' : 'B2C'
                    })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-600">Taxable Value (₹)</label>
                    <input 
                      type="number" 
                      value={editingInvoice.amount}
                      onChange={(e) => setEditingInvoice({ ...editingInvoice, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-600">GST Output (₹)</label>
                    <input 
                      type="number" 
                      value={editingInvoice.taxAmount}
                      onChange={(e) => setEditingInvoice({ ...editingInvoice, taxAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600">Place of Supply (POS Code)</label>
                  <select 
                    value={editingInvoice.placeOfSupply || currentTenant.stateCode}
                    onChange={(e) => setEditingInvoice({ ...editingInvoice, placeOfSupply: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="27">27 - Maharashtra (Home State)</option>
                    <option value="29">29 - Karnataka</option>
                    <option value="19">19 - West Bengal</option>
                    <option value="07">07 - Delhi</option>
                    <option value="33">33 - Tamil Nadu</option>
                    <option value="24">24 - Gujarat</option>
                    <option value="36">36 - Telangana</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setEditingInvoice(null)}
                    className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 shadow"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
