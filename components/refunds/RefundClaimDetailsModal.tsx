import React, { useState } from 'react';
import { 
  X, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Landmark, 
  Building2, 
  User, 
  Calendar, 
  ArrowRight, 
  Download, 
  Send, 
  ShieldCheck, 
  RefreshCw, 
  Printer, 
  FileCode, 
  Paperclip, 
  ExternalLink,
  Info,
  CheckCircle,
  HelpCircle,
  FileBadge,
  Maximize2,
  Minimize2,
  FileDown,
  Sparkles,
  Eye
} from 'lucide-react';
import { 
  ItcRefundClaim, 
  RefundCategory, 
  StatutoryDocument, 
  RefundTimelineEvent,
  RefundService 
} from '../../services/refundService';
import { RefundDossierGenerator } from '../../services/refundDossierGenerator';

interface RefundClaimDetailsModalProps {
  claim: ItcRefundClaim;
  onClose: () => void;
  onClaimUpdated: (updated: ItcRefundClaim) => void;
}

export const RefundClaimDetailsModal: React.FC<RefundClaimDetailsModalProps> = ({
  claim,
  onClose,
  onClaimUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'TIMELINE' | 'TAX_BREAKDOWN' | 'BANKING' | 'DOCUMENTS' | 'NOTICES'>('TIMELINE');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [scnReplyText, setScnReplyText] = useState('');
  const [deficiencyNotes, setDeficiencyNotes] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const handlePrintDossier = () => {
    setIsPrinting(true);
    setActionSuccessMsg(`Statutory Refund Dossier prepared for ARN ${claim.arn}. Opening print dialog & generating certified document.`);
    try {
      RefundDossierGenerator.printRefundDossier(claim);
    } catch (err) {
      console.error('Error printing dossier', err);
      RefundDossierGenerator.downloadRefundDossierPDF(claim);
    } finally {
      setTimeout(() => setIsPrinting(false), 1200);
      setTimeout(() => setActionSuccessMsg(''), 5000);
    }
  };

  const handleDownloadDossierPdf = () => {
    setIsDownloading(true);
    setActionSuccessMsg(`Downloading official Form GST RFD Dossier PDF (ARN: ${claim.arn})...`);
    try {
      RefundDossierGenerator.downloadRefundDossierPDF(claim);
    } catch (err) {
      console.error('Error downloading dossier PDF', err);
    } finally {
      setTimeout(() => setIsDownloading(false), 1000);
      setTimeout(() => setActionSuccessMsg(''), 5000);
    }
  };

  const handleDownloadDoc = (doc: StatutoryDocument) => {
    setActionSuccessMsg(`Generating & downloading authenticated Form GST ${doc.type} (${doc.title})...`);
    try {
      RefundDossierGenerator.downloadSingleDocumentPDF(claim, doc);
    } catch (err) {
      console.error('Error downloading document', err);
    }
    setTimeout(() => setActionSuccessMsg(''), 4000);
  };

  const handleScnReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scnReplyText.trim()) return;

    setIsSubmittingAction(true);
    try {
      const updated = await RefundService.submitReplyToScn(
        claim.id,
        scnReplyText,
        ['Realization_FIRC_Certificate.pdf', 'Service_Agreement_Annexure_B.pdf', 'CA_Realization_Certificate.pdf']
      );
      onClaimUpdated(updated);
      setActionSuccessMsg('Form GST RFD-09 Taxpayer Reply successfully signed via EVC and transmitted to Common Portal!');
      setScnReplyText('');
    } catch (err) {
      console.error('Error submitting SCN reply', err);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleDeficiencySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deficiencyNotes.trim()) return;

    setIsSubmittingAction(true);
    try {
      const updated = await RefundService.submitDeficiencyRectification(claim.id, deficiencyNotes);
      onClaimUpdated(updated);
      setActionSuccessMsg('Rectified Form GST RFD-01 along with missing SEZ endorsements submitted to Proper Officer!');
      setDeficiencyNotes('');
    } catch (err) {
      console.error('Error submitting deficiency rectifications', err);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center ${
      isMaximized ? 'p-0' : 'p-2 sm:p-4 md:p-6'
    } overflow-y-auto`}>
      <div className={`bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col transition-all duration-200 ${
        isMaximized 
          ? 'w-full h-full max-w-none max-h-none rounded-none' 
          : 'w-[98vw] max-w-7xl h-[95vh] max-h-[95vh]'
      }`}>
        
        {/* Modal Top Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-start justify-between relative overflow-hidden shrink-0">
          <div className="space-y-1.5 z-10 max-w-4xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-xs font-black bg-blue-500/20 text-blue-300 border border-blue-400/30 px-3 py-1 rounded-lg">
                ARN: {claim.arn}
              </span>
              <span className="text-xs font-bold text-slate-300">
                {claim.taxPeriod} ({claim.financialYear})
              </span>
              <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 font-semibold">
                {claim.category.replace(/_/g, ' ')}
              </span>
              <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-lg font-bold">
                {claim.status.replace(/_/g, ' ')}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2 pt-0.5">
              {claim.legalName} <span className="text-sm font-normal text-slate-400">({claim.gstin})</span>
            </h2>
            <div className="text-xs sm:text-sm text-slate-400 flex flex-wrap items-center gap-2">
              <span>Jurisdiction: <strong className="text-slate-300">{claim.jurisdiction.commissionerate}</strong></span>
              <span>•</span>
              <span>Division: <strong className="text-slate-300">{claim.jurisdiction.division}</strong></span>
              <span>•</span>
              <span>Officer: <strong className="text-slate-200">{claim.jurisdiction.assignedOfficerName}, {claim.jurisdiction.officerDesignation}</strong></span>
            </div>
          </div>

          {/* Header Controls: Maximize & Close */}
          <div className="flex items-center gap-2 z-10 shrink-0">
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={isMaximized ? "Restore default window" : "Maximize to fullscreen"}
              aria-label={isMaximized ? "Restore window" : "Maximize screen"}
            >
              {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Close modal"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Live SLA & Progress Metric Ribbon */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold shrink-0">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Total Claimed</span>
              <span className="text-base font-black text-slate-900 font-mono">{formatCurrency(claim.amountClaimed.total)}</span>
            </div>
            <div className="h-7 w-px bg-slate-200 hidden sm:block" />
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Disbursed (PFMS)</span>
              <span className="text-base font-black text-emerald-700 font-mono">{formatCurrency(claim.amountDisbursed)}</span>
            </div>
            <div className="h-7 w-px bg-slate-200 hidden sm:block" />
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Statutory SLA (Sec 54)</span>
              <span className={`text-xs font-black ${claim.sla.isInterestApplicable ? 'text-rose-700' : 'text-slate-800'}`}>
                {claim.sla.daysElapsed} days elapsed ({claim.sla.daysRemaining}d left)
                {claim.sla.isInterestApplicable && ` • +₹${claim.sla.accruedInterest.toLocaleString('en-IN')} Interest Accrued`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Gateway Status:</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-bold border border-emerald-200">
              <CheckCircle2 size={13} className="text-emerald-600" /> GSTN Synced ({claim.portalSync.lastSyncedAt})
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200 px-6 bg-white flex items-center gap-2 overflow-x-auto shrink-0">
          {[
            { id: 'TIMELINE', label: 'Audit & Lifecycle Timeline', icon: Clock },
            { id: 'TAX_BREAKDOWN', label: 'Tax Heads & Orders Breakdown', icon: FileText },
            { id: 'BANKING', label: 'PFMS & Banking Clearance', icon: Landmark },
            { id: 'DOCUMENTS', label: `Statutory Documents (${claim.documents.length})`, icon: FileCode },
            { 
              id: 'NOTICES', 
              label: claim.status === 'RFD03_DEFICIENCY_MEMO' || claim.status === 'RFD08_SCN_ISSUED' 
                ? 'Action / Notice Desk ⚠️' 
                : 'Notice & Compliance Desk', 
              icon: AlertTriangle 
            }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3.5 px-3.5 font-bold text-xs sm:text-sm border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                    : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-slate-50/60 space-y-6">
          {actionSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between text-emerald-900 text-xs sm:text-sm font-bold animate-in fade-in shadow-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle size={18} className="text-emerald-600 shrink-0" />
                <span>{actionSuccessMsg}</span>
              </div>
              <button onClick={() => setActionSuccessMsg('')} className="text-emerald-700 hover:text-emerald-900 cursor-pointer p-1">
                <X size={16} />
              </button>
            </div>
          )}

          {/* TAB 1: AUDIT & TIMELINE */}
          {activeTab === 'TIMELINE' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Clock size={18} className="text-blue-600" />
                    Statutory Progression & Portal Event Trail
                  </h3>
                  <span className="text-xs font-bold text-slate-400">
                    {claim.timeline.length} Registered Milestones
                  </span>
                </div>
                
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {claim.timeline.map((event, idx) => (
                    <div key={event.id} className="relative group">
                      {/* Node Bullet */}
                      <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center bg-white ${
                        event.status === 'COMPLETED'
                          ? 'border-emerald-500 text-emerald-600'
                          : event.status === 'ACTION_REQUIRED'
                          ? 'border-amber-500 text-amber-600'
                          : event.status === 'IN_PROGRESS'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-slate-300 text-slate-400'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          event.status === 'COMPLETED' ? 'bg-emerald-500' :
                          event.status === 'ACTION_REQUIRED' ? 'bg-amber-500' :
                          event.status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-slate-300'
                        }`} />
                      </div>

                      <div className="bg-slate-50 hover:bg-slate-100/90 rounded-2xl p-4 sm:p-5 border border-slate-200/90 transition-colors">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className="text-sm font-black text-slate-900">{event.title}</span>
                            {event.formRef && (
                              <span className="font-mono text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md border border-blue-200">
                                {event.formRef}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-semibold text-slate-400">{event.timestamp}</span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-600 mt-2 font-medium leading-relaxed">
                          {event.description}
                        </p>
                        <div className="text-xs text-slate-500 font-bold mt-3 flex items-center gap-1.5">
                          <User size={13} className="text-slate-400" />
                          <span>Actor / Authority: {event.actor}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Portal Remarks Box */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black text-blue-900 uppercase tracking-wider">Government Portal Raw Dispatch Note</h4>
                    <p className="text-xs sm:text-sm text-blue-800 mt-1 font-medium leading-relaxed">
                      {claim.portalSync.currentRemarks}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TAX HEADS BREAKDOWN */}
          {activeTab === 'TAX_BREAKDOWN' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <FileText size={18} className="text-blue-600" />
                    Statutory Tax Head Reconciliation Matrix (Form GST RFD-01 / RFD-06)
                  </h3>
                  <button
                    onClick={handleDownloadDossierPdf}
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 transition-colors"
                  >
                    <FileDown size={14} /> Export Statement PDF
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] sm:text-xs tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3.5">Tax Head</th>
                        <th className="px-4 py-3.5 text-right">Amount Claimed (₹)</th>
                        <th className="px-4 py-3.5 text-right">Provisional Sanction (90%)</th>
                        <th className="px-4 py-3.5 text-right">Final Sanction Order</th>
                        <th className="px-4 py-3.5 text-right">Disbursed (PFMS)</th>
                        <th className="px-4 py-3.5 text-right">Variance / Rejection</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      <tr className="hover:bg-slate-50/80">
                        <td className="px-4 py-3.5 font-bold text-slate-900">IGST (Integrated Tax)</td>
                        <td className="px-4 py-3.5 font-mono text-right">{formatCurrency(claim.amountClaimed.igst)}</td>
                        <td className="px-4 py-3.5 font-mono text-right text-indigo-700">
                          {claim.amountProvisionallySanctioned ? formatCurrency(claim.amountProvisionallySanctioned.igst) : '—'}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-right text-emerald-700">
                          {claim.amountFinalSanctioned ? formatCurrency(claim.amountFinalSanctioned.igst) : '—'}
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-right text-emerald-700">
                          {formatCurrency(claim.amountDisbursed > 0 ? (claim.amountFinalSanctioned?.igst || claim.amountProvisionallySanctioned?.igst || claim.amountClaimed.igst) : 0)}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-right text-slate-500">₹0</td>
                      </tr>
                      <tr className="hover:bg-slate-50/80">
                        <td className="px-4 py-3.5 font-bold text-slate-900">CGST (Central Tax)</td>
                        <td className="px-4 py-3.5 font-mono text-right">{formatCurrency(claim.amountClaimed.cgst)}</td>
                        <td className="px-4 py-3.5 font-mono text-right text-indigo-700">
                          {claim.amountProvisionallySanctioned ? formatCurrency(claim.amountProvisionallySanctioned.cgst) : '—'}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-right text-emerald-700">
                          {claim.amountFinalSanctioned ? formatCurrency(claim.amountFinalSanctioned.cgst) : '—'}
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-right text-emerald-700">
                          {formatCurrency(claim.amountDisbursed > 0 ? (claim.amountFinalSanctioned?.cgst || claim.amountClaimed.cgst) : 0)}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-right text-slate-500">₹0</td>
                      </tr>
                      <tr className="hover:bg-slate-50/80">
                        <td className="px-4 py-3.5 font-bold text-slate-900">SGST (State Tax)</td>
                        <td className="px-4 py-3.5 font-mono text-right">{formatCurrency(claim.amountClaimed.sgst)}</td>
                        <td className="px-4 py-3.5 font-mono text-right text-indigo-700">
                          {claim.amountProvisionallySanctioned ? formatCurrency(claim.amountProvisionallySanctioned.sgst) : '—'}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-right text-emerald-700">
                          {claim.amountFinalSanctioned ? formatCurrency(claim.amountFinalSanctioned.sgst) : '—'}
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-right text-emerald-700">
                          {formatCurrency(claim.amountDisbursed > 0 ? (claim.amountFinalSanctioned?.sgst || claim.amountClaimed.sgst) : 0)}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-right text-slate-500">₹0</td>
                      </tr>
                      <tr className="hover:bg-slate-50/80">
                        <td className="px-4 py-3.5 font-bold text-slate-900">Compensation Cess</td>
                        <td className="px-4 py-3.5 font-mono text-right">{formatCurrency(claim.amountClaimed.cess)}</td>
                        <td className="px-4 py-3.5 font-mono text-right text-indigo-700">—</td>
                        <td className="px-4 py-3.5 font-mono text-right text-emerald-700">—</td>
                        <td className="px-4 py-3.5 font-mono font-bold text-right text-emerald-700">₹0</td>
                        <td className="px-4 py-3.5 font-mono text-right text-slate-500">₹0</td>
                      </tr>
                    </tbody>
                    <tfoot className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-200">
                      <tr>
                        <td className="px-4 py-4 text-sm font-black">Total Net Refund Claim</td>
                        <td className="px-4 py-4 font-mono text-base text-right font-black text-slate-900">{formatCurrency(claim.amountClaimed.total)}</td>
                        <td className="px-4 py-4 font-mono text-base text-right font-black text-indigo-700">
                          {claim.amountProvisionallySanctioned ? formatCurrency(claim.amountProvisionallySanctioned.total) : '—'}
                        </td>
                        <td className="px-4 py-4 font-mono text-base text-right font-black text-emerald-700">
                          {claim.amountFinalSanctioned ? formatCurrency(claim.amountFinalSanctioned.total) : '—'}
                        </td>
                        <td className="px-4 py-4 font-mono text-base text-right font-black text-emerald-700">
                          {formatCurrency(claim.amountDisbursed)}
                        </td>
                        <td className="px-4 py-4 font-mono text-base text-right font-black text-slate-600">₹0</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PFMS & BANKING CLEARANCE */}
          {activeTab === 'BANKING' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                <h3 className="text-base font-black text-slate-900 mb-5 flex items-center gap-2">
                  <Landmark size={18} className="text-emerald-600" />
                  Public Financial Management System (PFMS) Banking Pipeline
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                    <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">Beneficiary Bank Account</span>
                    <div className="text-base font-black text-slate-900">{claim.banking.bankName}</div>
                    <div className="text-xs sm:text-sm text-slate-700 font-mono">Account No: <strong>{claim.banking.accountNumberMasked}</strong></div>
                    <div className="text-xs sm:text-sm text-slate-700 font-mono">IFSC Code: <strong>{claim.banking.ifsc}</strong></div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg mt-1">
                      <ShieldCheck size={14} className="text-emerald-600" /> PFMS Account Status: {claim.banking.pfmsStatus}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                    <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">Payment Order & Advice (RFD-05)</span>
                    <div className="text-xs sm:text-sm text-slate-700">
                      Payment Order No: <strong className="font-mono text-slate-900">{claim.banking.paymentOrderNumber || 'Awaited / In Process'}</strong>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-700">
                      CBS Batch Reference: <strong className="font-mono text-slate-900">{claim.banking.cbsReferenceNumber || 'Pending CBS Dispatch'}</strong>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-700">
                      Banking UTR No: <strong className="font-mono text-blue-700 font-bold">{claim.banking.utrNumber || 'Pending Bank Settlement'}</strong>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-700">
                      Credit Date: <strong className="text-emerald-700 font-bold">{claim.banking.disbursedDate || 'Not Disbursed Yet'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: STATUTORY DOCUMENTS */}
          {activeTab === 'DOCUMENTS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs sm:text-sm text-slate-600 font-medium">
                  Authenticated electronic statutory documents and certified annexures associated with ARN {claim.arn}:
                </p>
                <button
                  onClick={handleDownloadDossierPdf}
                  className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 flex items-center gap-1.5 transition-colors"
                >
                  <FileDown size={14} /> Download Complete Dossier
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {claim.documents.map((doc) => (
                  <div key={doc.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-blue-400 transition-all flex items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-md border border-blue-200">
                          {doc.type}
                        </span>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                          <ShieldCheck size={11} /> Authenticated
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-900 mt-1">{doc.title}</h4>
                      <p className="text-xs text-slate-500 font-mono">Ref: {doc.documentNumber}</p>
                      <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2 pt-1 font-medium">
                        <span>Issued: {doc.issuedDate}</span>
                        <span>•</span>
                        <span>Authority: {doc.issuedBy}</span>
                        <span>•</span>
                        <span>Size: {doc.fileSize}</span>
                      </div>
                      {doc.remarks && (
                        <p className="text-xs text-amber-800 font-medium bg-amber-50 p-2 rounded-xl mt-1.5 border border-amber-200">
                          {doc.remarks}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleDownloadDoc(doc)}
                      className="p-3 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 transition-colors shrink-0 cursor-pointer shadow-2xs"
                      title={`Download official authenticated ${doc.title} (PDF)`}
                      aria-label="Download Document"
                    >
                      <Download size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: NOTICES & ACTIONS */}
          {activeTab === 'NOTICES' && (
            <div className="space-y-6">
              {/* If SCN is issued */}
              {claim.scnDetails && (
                <div className="bg-rose-50/70 rounded-2xl p-6 border border-rose-300 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle size={20} className="text-rose-600" />
                      <h4 className="text-base font-black text-rose-950">Show Cause Notice (Form GST RFD-08) Active</h4>
                    </div>
                    <span className="font-mono text-xs font-bold text-rose-800 bg-rose-200/60 px-2.5 py-1 rounded-lg">
                      {claim.scnDetails.scnNumber}
                    </span>
                  </div>

                  <div className="bg-white rounded-xl p-5 border border-rose-200 text-xs sm:text-sm space-y-3 text-slate-800">
                    <div>
                      <span className="text-slate-500 font-bold uppercase text-xs tracking-wider">Grounds of Proposed Rejection:</span>
                      <p className="font-medium text-slate-900 mt-1 leading-relaxed">{claim.scnDetails.groundsForRejection}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs sm:text-sm">
                      <div>Proposed Rejection: <strong className="text-rose-700 font-mono font-bold">{formatCurrency(claim.scnDetails.proposedRejectionAmount)}</strong></div>
                      <div>Reply Due Date: <strong className="text-slate-900">{claim.scnDetails.replyDueDate}</strong></div>
                      <div>Hearing Date: <strong>{claim.scnDetails.hearingDate || 'None requested'}</strong></div>
                    </div>
                  </div>

                  {/* SCN Reply Composer */}
                  {claim.status === 'RFD08_SCN_ISSUED' ? (
                    <form onSubmit={handleScnReplySubmit} className="space-y-3 bg-white p-5 rounded-2xl border border-rose-200">
                      <label className="text-xs sm:text-sm font-black text-slate-900 block">
                        Draft Taxpayer Reply (Form GST RFD-09) & Upload Clarification Annexures
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Enter comprehensive legal response and reconciliation rationale explaining why the realization condition stands satisfied under Rule 96A..."
                        value={scnReplyText}
                        onChange={(e) => setScnReplyText(e.target.value)}
                        className="w-full p-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 font-medium text-slate-800"
                        required
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                          <Paperclip size={14} />
                          <span>3 Realization & FIRC documents attached</span>
                        </div>
                        <button
                          type="submit"
                          disabled={isSubmittingAction || !scnReplyText.trim()}
                          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <Send size={14} />
                          {isSubmittingAction ? 'Signing & Submitting...' : 'Sign with EVC & Submit RFD-09'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 text-xs sm:text-sm font-bold text-emerald-900 flex items-center gap-2">
                      <CheckCircle2 size={18} className="text-emerald-600" />
                      <span>Taxpayer reply Form GST RFD-09 was submitted on {claim.scnDetails.replyFiledDate}. Officer review pending.</span>
                    </div>
                  )}
                </div>
              )}

              {/* If Deficiency Memo is issued */}
              {claim.deficiencyDetails && (
                <div className="bg-amber-50/70 rounded-2xl p-6 border border-amber-300 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle size={20} className="text-amber-700" />
                      <h4 className="text-base font-black text-amber-950">Deficiency Memo (Form GST RFD-03) Active</h4>
                    </div>
                    <span className="font-mono text-xs sm:text-sm font-bold text-amber-800 bg-amber-200/60 px-3 py-1 rounded-lg">
                      {claim.deficiencyDetails.memoNumber}
                    </span>
                  </div>

                  <div className="bg-white rounded-xl p-5 border border-amber-200 text-xs sm:text-sm space-y-3 text-slate-800">
                    <div>
                      <span className="text-slate-500 font-bold uppercase text-xs tracking-wider">Officer Deficiency Finding:</span>
                      <p className="font-medium text-slate-900 mt-1 leading-relaxed">{claim.deficiencyDetails.reason}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-100">
                      <span className="text-slate-500 font-bold uppercase text-xs tracking-wider">Actionable Rectifications:</span>
                      <ul className="list-disc list-inside space-y-1.5 mt-1 text-slate-700 font-medium">
                        {claim.deficiencyDetails.requiredRectifications.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {claim.status === 'RFD03_DEFICIENCY_MEMO' ? (
                    <form onSubmit={handleDeficiencySubmit} className="space-y-3 bg-white p-5 rounded-2xl border border-amber-200">
                      <label className="text-xs sm:text-sm font-black text-slate-900 block">
                        Submit Rectification Dossier & Fresh Form GST RFD-01
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Detail the endorsements appended and corrections made to the statement..."
                        value={deficiencyNotes}
                        onChange={(e) => setDeficiencyNotes(e.target.value)}
                        className="w-full p-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 font-medium text-slate-800"
                        required
                      />
                      <button
                        type="submit"
                        disabled={isSubmittingAction || !deficiencyNotes.trim()}
                        className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <Send size={14} />
                        {isSubmittingAction ? 'Transmitting...' : 'Submit Rectified RFD-01'}
                      </button>
                    </form>
                  ) : null}
                </div>
              )}

              {!claim.scnDetails && !claim.deficiencyDetails && (
                <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center space-y-3">
                  <CheckCircle2 size={42} className="mx-auto text-emerald-500" />
                  <h4 className="text-base font-black text-slate-900">Zero Outstanding Notices or Deficiencies</h4>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                    This refund claim is progressing without any statutory objections or show cause notices from the jurisdictional tax office.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Cryptographic SHA-256 Validated • Statutory Form Series 54/56</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              id="btn-download-dossier-pdf"
              onClick={handleDownloadDossierPdf}
              disabled={isDownloading}
              className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center gap-2 border border-blue-200 cursor-pointer disabled:opacity-50"
              title="Download Certified Statutory PDF Dossier"
            >
              <FileDown size={16} />
              {isDownloading ? 'Generating PDF...' : 'Download Dossier PDF'}
            </button>
            <button
              id="btn-print-refund-dossier"
              onClick={handlePrintDossier}
              disabled={isPrinting}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center gap-2 border border-slate-300 cursor-pointer disabled:opacity-50"
              title="Print certified statutory dossier"
            >
              <Printer size={16} />
              {isPrinting ? 'Preparing Print...' : 'Print Dossier'}
            </button>
            <button
              id="btn-close-refund-modal"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
export default RefundClaimDetailsModal;

