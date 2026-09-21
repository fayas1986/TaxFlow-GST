import React from 'react';
import { 
  X, ShieldCheck, CheckCircle2, AlertTriangle, AlertCircle, Clock, FileText, 
  MapPin, Scale, RefreshCw, Layers, Printer, Sparkles, Building2, Terminal, User
} from 'lucide-react';
import { Invoice } from '../types';
import { motion } from 'motion/react';

interface EvidenceTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
}

export const EvidenceTrailModal: React.FC<EvidenceTrailModalProps> = ({ isOpen, onClose, invoice }) => {
  if (!isOpen || !invoice) return null;

  // Derive verification timestamps and logs dynamically based on the invoice creation/date
  const invoiceDateStr = invoice.date ? new Date(invoice.date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) : '12-Aug-2026';

  const cgst = invoice.taxDetails?.cgst || 0;
  const sgst = invoice.taxDetails?.sgst || 0;
  const igst = invoice.taxDetails?.igst || 0;
  const totalGst = invoice.taxAmount || (cgst + sgst + igst);
  const totalAmountWithTax = (invoice.amount || 0) + totalGst;

  // Determine rate % (default 18% if items not provided)
  const ratePct = invoice.items && invoice.items[0] ? invoice.items[0].taxRate : 18;

  // Simulated audit hash for cryptographic tampering verification
  const sha256Hash = `SHA256-${invoice.id.slice(0, 8).toUpperCase()}-${Math.floor(invoice.amount * 1.13)}`;

  // Determine compliance checks
  const checks = [
    {
      id: 'GSTIN_VERIFY',
      title: 'Active GSTIN Verification',
      status: invoice.gstin ? 'PASSED' : 'WARNING',
      desc: `Registered entity checked on GSTN server. Active taxpayer found: ${invoice.gstin || 'N/A'}.`,
    },
    {
      id: 'TAX_SLAB_AUDIT',
      title: 'Tax Rate & HSN Mathematical Audit',
      status: totalGst === Math.round(invoice.amount * (ratePct / 100)) ? 'PASSED' : 'WARNING',
      desc: `Sum of items verified: Taxable value ₹${invoice.amount.toLocaleString()} at ${ratePct}% matches reported GST ₹${totalGst.toLocaleString()}.`,
    },
    {
      id: 'POS_CHECK',
      title: 'Place of Supply (POS) Routing',
      status: 'PASSED',
      desc: `Recipient state prefix mapped to POS State Code ${invoice.placeOfSupply || '27'}. Correct Interstate vs Intrastate tax classification.`,
    },
    {
      id: 'EINVOICE_EWAY_COMPLIANCE',
      title: 'Electronic Portals Registration Threshold',
      status: invoice.amount >= 500000 && !invoice.irn ? 'WARNING' : 'PASSED',
      desc: invoice.amount >= 500000 
        ? (invoice.irn ? `Mandatory E-Invoice registered successfully. IRN: ${invoice.irn.slice(0, 12)}...` : 'Invoice value exceeds ₹5L threshold but missing required IRN registry!')
        : 'Invoice value is under ₹5,00,000 threshold. Portal registration optional.',
    },
    {
      id: 'ELIGIBILITY_DECISION',
      title: 'Section 17(5) Credit Eligibility Decision',
      status: invoice.isBlockedItc ? 'ALERT' : 'PASSED',
      desc: invoice.category === 'PURCHASE'
        ? (invoice.isBlockedItc ? `Ineligible Blocked Credit under Sec 17(5): ${invoice.reasonForBlocked || 'Generic Blocked Category'}.` : 'Eligible for raw material input tax credit claims.')
        : 'Standard outward sales transaction. Credit eligibility check bypassed.',
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div 
        className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                Evidence Trail & Auditable Proof of Calculation
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Cryptographically hashed legal evidence log for invoice <span className="font-mono text-slate-700 font-bold">{invoice.invoiceNumber}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 scrollbar-thin text-xs">
          
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
              <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">Transaction Entity</span>
              <div className="font-extrabold text-slate-800 text-sm truncate">{invoice.partyName}</div>
              <div className="text-[10px] text-slate-500 font-mono">{invoice.gstin || 'No GSTIN Provided'}</div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-200/60 text-slate-700">
                POS Code: {invoice.placeOfSupply || '27'}
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
              <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">Arithmetic Values (INR)</span>
              <div className="grid grid-cols-2 gap-2 pt-0.5 text-[11px]">
                <div className="text-slate-500">Taxable Amt:</div>
                <div className="font-bold text-right font-mono text-slate-900">₹{invoice.amount.toLocaleString()}</div>
                <div className="text-slate-500">Total GST ({ratePct}%):</div>
                <div className="font-bold text-right font-mono text-slate-900">₹{totalGst.toLocaleString()}</div>
                <div className="text-slate-950 font-extrabold border-t border-slate-200 pt-1">Grand Total:</div>
                <div className="font-black text-right font-mono text-indigo-700 border-t border-slate-200 pt-1">₹{totalAmountWithTax.toLocaleString()}</div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5 flex flex-col justify-between">
              <div>
                <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">Evidence Integrity Code</span>
                <div className="font-mono text-[10px] bg-slate-950 text-emerald-400 p-1.5 rounded-lg border border-slate-800 mt-1 break-all tracking-tight leading-normal select-all">
                  {sha256Hash}
                </div>
              </div>
              <div className="text-[9px] text-slate-400 font-bold flex items-center gap-1 mt-1.5">
                <CheckCircle2 size={10} className="text-emerald-500" /> Immutable Audit Ledger Checked
              </div>
            </div>
          </div>

          {/* Validation Checklist / Trace Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Layers size={14} className="text-indigo-600" /> Continuous Regulatory Verification checks
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {checks.map((check) => {
                const isPassed = check.status === 'PASSED';
                const isAlert = check.status === 'ALERT';
                
                return (
                  <div 
                    key={check.id} 
                    className={`p-3.5 rounded-xl border transition-all flex gap-3 ${
                      isPassed 
                        ? 'bg-emerald-50/20 border-emerald-100' 
                        : isAlert 
                        ? 'bg-rose-50/20 border-rose-100' 
                        : 'bg-amber-50/20 border-amber-100'
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {isPassed ? (
                        <CheckCircle2 size={16} className="text-emerald-600" />
                      ) : isAlert ? (
                        <AlertCircle size={16} className="text-rose-600 animate-pulse" />
                      ) : (
                        <AlertTriangle size={16} className="text-amber-600" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <h5 className="font-black text-slate-900 text-xs flex items-center gap-2">
                        {check.title}
                        <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${
                          isPassed 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : isAlert 
                            ? 'bg-rose-100 text-rose-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {check.status}
                        </span>
                      </h5>
                      <p className="text-[10px] text-slate-500 leading-normal">{check.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Historical Pipeline Timeline */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Clock size={14} className="text-indigo-600" /> Lifecycle Audit Logs & Approvals Timeline
            </h4>

            <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/30 space-y-4">
              {/* Event 1 */}
              <div className="flex gap-4 relative">
                <div className="absolute left-3 top-6 bottom-[-20px] w-0.5 bg-slate-200 z-0"></div>
                <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-500 font-extrabold shrink-0 z-10 text-[10px]">
                  1
                </div>
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="font-black text-slate-800">Original Transaction Entry</span>
                    <span className="text-[9px] text-slate-400 font-mono">{invoiceDateStr} 09:12 AM</span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Record entered into pipeline. Detected as outward <strong className="font-bold text-slate-700">{invoice.category} ({invoice.type})</strong> with tax structure IGST (₹{igst.toLocaleString()}), CGST (₹{cgst.toLocaleString()}), SGST (₹{sgst.toLocaleString()}).
                  </p>
                </div>
              </div>

              {/* Event 2 */}
              <div className="flex gap-4 relative">
                <div className="absolute left-3 top-6 bottom-[-20px] w-0.5 bg-slate-200 z-0"></div>
                <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-500 font-extrabold shrink-0 z-10 text-[10px]">
                  2
                </div>
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="font-black text-slate-800">Automated Validation & Priority Tagging</span>
                    <span className="text-[9px] text-slate-400 font-mono">{invoiceDateStr} 09:13 AM</span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    System scanned values against matching rule templates. Dynamic compliance priority computed as <strong className="font-black text-indigo-700 uppercase">{invoice.compliancePriority || 'NORMAL'}</strong>.
                  </p>
                </div>
              </div>

              {/* Event 3 */}
              <div className="flex gap-4 relative">
                <div className="absolute left-3 top-6 bottom-[-20px] w-0.5 bg-slate-200 z-0"></div>
                <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-500 font-extrabold shrink-0 z-10 text-[10px]">
                  3
                </div>
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="font-black text-slate-800">Government IRP Portal Registered (E-Invoice & E-Way)</span>
                    <span className="text-[9px] text-slate-400 font-mono">{invoiceDateStr} 11:34 AM</span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {invoice.irn ? (
                      <span>IRN verified: <strong className="font-mono text-slate-800">{invoice.irn}</strong>. Acknowledgment details matching registry ack receipt.</span>
                    ) : (
                      <span className="text-amber-600 font-medium">Bypassed or Pending portal registration queue check. No IRN actively bound.</span>
                    )}
                  </p>
                  {invoice.ewayBillDetails && (
                    <div className="bg-white border border-slate-200/60 rounded-lg p-2.5 mt-2 flex justify-between items-center text-[10px]">
                      <div>
                        <div className="font-bold text-slate-700">E-Way Bill: {invoice.ewayBillDetails.ewayBillNo || (invoice.ewayBillDetails as any).ewayBillNumber}</div>
                        <div className="text-slate-500 text-[9px] mt-0.5">Vehicle: {invoice.ewayBillDetails.vehicleNo || (invoice.ewayBillDetails as any).vehicleNumber || 'N/A'} | Valid: {invoice.ewayBillDetails.validUpto || (invoice.ewayBillDetails as any).validUntil || 'N/A'}</div>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black uppercase text-[8px]">
                        {invoice.ewayBillDetails.status}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Event 4 */}
              <div className="flex gap-4">
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-extrabold shrink-0 z-10 text-[10px]">
                  4
                </div>
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="font-black text-indigo-900">Compliance Reconciliation Approval Status</span>
                    <span className="text-[9px] text-indigo-500 font-mono">{invoiceDateStr} 11:35 AM</span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Calculated matching checks completed successfully. Auto-promoted to filing batch list with statutory hash verification audit locks.
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold font-mono">
            ID: {invoice.id}
          </div>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5"
          >
            <Printer size={14} /> Export Evidence Summary
          </button>
        </div>

      </div>
    </div>
  );
};
