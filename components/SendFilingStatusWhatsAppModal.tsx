import React, { useState, useEffect } from 'react';
import { 
  X, MessageSquare, Send, CheckCircle2, AlertCircle, 
  Loader2, ShieldCheck, CheckCheck, Phone, User, FileText, 
  Sparkles, ExternalLink, RefreshCw 
} from 'lucide-react';
import { sendFilingStatusWhatsAppNotification, fetchWhatsAppGatewayStatus } from '../services/api';
import { WhatsAppGatewayStatus, FilingStatusWhatsAppParams } from '../types';

interface SendFilingStatusWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  filing: {
    returnType: string;
    period: string;
    status: string;
    arn?: string;
    filedDate?: string;
    taxLiability?: number;
    recipientPhone?: string;
    clientName?: string;
    recipientGstin?: string;
  } | null;
  onSuccess?: () => void;
}

export const SendFilingStatusWhatsAppModal: React.FC<SendFilingStatusWhatsAppModalProps> = ({
  isOpen,
  onClose,
  filing,
  onSuccess
}) => {
  if (!isOpen || !filing) return null;

  const [clientName, setClientName] = useState(filing.clientName || 'Acme Industrial Corp');
  const [recipientPhone, setRecipientPhone] = useState(filing.recipientPhone || '+919876543210');
  const [recipientGstin, setRecipientGstin] = useState(filing.recipientGstin || '27AABCU9603R1ZM');
  const [status, setStatus] = useState<'FILED' | 'PENDING' | 'OVERDUE' | 'DRAFT_READY' | 'REJECTED'>(
    (filing.status?.toUpperCase() as any) || 'FILED'
  );
  const [arn, setArn] = useState(filing.arn || `AA27082600${Math.floor(10000 + Math.random() * 90000)}`);
  const [taxLiability, setTaxLiability] = useState(filing.taxLiability || 145200);
  const [customNotes, setCustomNotes] = useState('');
  const [includeReceiptLink, setIncludeReceiptLink] = useState(true);

  const [gatewayStatus, setGatewayStatus] = useState<WhatsAppGatewayStatus | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sentResult, setSentResult] = useState<{ messageId?: string; simulated?: boolean } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchWhatsAppGatewayStatus().then(setGatewayStatus).catch(() => {});
  }, []);

  const handleSend = async () => {
    if (!recipientPhone || recipientPhone.trim().length < 10) {
      setErrorMessage('Please enter a valid mobile number with country code (e.g. +919876543210)');
      return;
    }

    setIsSending(true);
    setErrorMessage(null);

    try {
      const res = await sendFilingStatusWhatsAppNotification({
        returnType: filing.returnType,
        period: filing.period,
        status,
        arn: status === 'FILED' ? arn : undefined,
        filedDate: filing.filedDate || new Date().toLocaleDateString('en-GB'),
        taxLiability: Number(taxLiability) || 0,
        clientName,
        recipientPhone: recipientPhone.trim(),
        recipientGstin,
        customNotes: customNotes || undefined,
        includeReceiptLink
      });

      setSentResult({
        messageId: res.messageId,
        simulated: res.simulated
      });

      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch WhatsApp notification via Twilio');
    } finally {
      setIsSending(false);
    }
  };

  // Compute live message body preview
  const generatePreview = () => {
    const appUrl = 'https://taxflow.app';
    const gstinStr = recipientGstin ? ` (GSTIN: ${recipientGstin})` : '';
    const formattedTax = `₹${Number(taxLiability || 0).toLocaleString('en-IN')}`;

    if (status === 'FILED') {
      return `🎉 *GST RETURN FILED & ACKNOWLEDGED*\n\nDear *${clientName}*${gstinStr},\n\nYour *${filing.returnType}* return for tax period *${filing.period}* has been *SUCCESSFULLY FILED & ACKNOWLEDGED* by the GST Portal.\n\n🔖 *Application Reference Number (ARN):* ${arn}\n📅 *Filing Date:* ${filing.filedDate || new Date().toLocaleDateString('en-GB')}\n💵 *Tax Liability Cleared:* ${formattedTax}\n🛡️ *Verification:* Authorized Digital EVC / DSC Verified\n${customNotes ? `\n📝 *Accountant Remarks:* ${customNotes}\n` : ''}\n📄 Download Official Acknowledgment Receipt: ${appUrl}/filing?arn=${arn}\n\n_TaxFlow Statutory Filing Notification Gateway_`;
    }

    if (status === 'DRAFT_READY') {
      return `📋 *GST RETURN DRAFT READY FOR REVIEW*\n\nDear *${clientName}*${gstinStr},\n\nYour *${filing.returnType}* draft return for tax period *${filing.period}* has been compiled from sales registers and is ready for client review.\n\n📊 *Estimated Tax Liability:* ${formattedTax}\n${customNotes ? `\n📝 *Accountant Remarks:* ${customNotes}\n` : ''}\n🛡️ *Next Step:* Please review the compiled summary and authorize digital submission (DSC / EVC OTP).\n\n👉 Review & Authorize on TaxFlow: ${appUrl}/filing`;
    }

    if (status === 'OVERDUE') {
      return `🚨 *URGENT: STATUTORY GST FILING OVERDUE*\n\nDear *${clientName}*${gstinStr},\n\nYour *${filing.returnType}* return for *${filing.period}* is *OVERDUE*.\n\n⚠️ *Statutory Note:* Late fees of ₹50/day and 18% p.a. interest under Section 47/50 apply.\n${customNotes ? `\n📝 *Accountant Remarks:* ${customNotes}\n` : ''}\n👉 Authorize immediate submission: ${appUrl}/filing`;
    }

    return `📋 *GST FILING STATUS UPDATE*\n\nDear *${clientName}*${gstinStr},\n\nYour *${filing.returnType}* return for *${filing.period}* is currently in *${status}* state.\n\n📊 *Tax Liability:* ${formattedTax}\n${customNotes ? `\n📝 *Accountant Remarks:* ${customNotes}\n` : ''}\n👉 View Details: ${appUrl}/filing`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col my-8">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
              <MessageSquare size={24} className="text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight">
                  Send WhatsApp Filing Status Update
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  Twilio API
                </span>
              </div>
              <p className="text-xs text-emerald-100/80">
                Notify client on WhatsApp with official ARN acknowledgment and statutory return summary
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-emerald-200 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Gateway Telemetry Status Bar */}
        <div className="bg-emerald-50/70 border-b border-emerald-100 px-6 py-2.5 flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${gatewayStatus?.configured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="font-semibold">
              Gateway Mode:{' '}
              <strong>
                {gatewayStatus?.configured ? 'Live Twilio Production' : 'Twilio Development Sandbox (High-Fidelity Simulation)'}
              </strong>
            </span>
          </div>
          <span className="text-[11px] text-emerald-600 font-mono">
            Sender: {gatewayStatus?.fromNumber || 'whatsapp:+14155238886'}
          </span>
        </div>

        {/* Success confirmation view */}
        {sentResult ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCheck size={36} />
            </div>
            <h4 className="text-xl font-bold text-slate-900">
              WhatsApp Notification Dispatched!
            </h4>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Statutory filing update for <strong>{filing.returnType} ({filing.period})</strong> has been successfully sent to{' '}
              <span className="font-mono font-bold text-emerald-700">{recipientPhone}</span>.
            </p>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl max-w-md mx-auto text-left text-xs font-mono space-y-1">
              <div className="text-slate-500">Twilio Message SID:</div>
              <div className="text-slate-900 font-bold">{sentResult.messageId}</div>
              <div className="text-[11px] text-slate-400">Status: DELIVERED • EVC / DSC Verified</div>
            </div>

            <div className="pt-4 flex justify-center gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Main Configuration Grid */
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto max-h-[65vh]">
            {/* Form Column */}
            <div className="space-y-4">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Recipient Mobile Number (WhatsApp) *
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="+919876543210"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Ensure the number includes country code (+91 for India)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Client Legal Name
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Client GSTIN
                  </label>
                  <input
                    type="text"
                    value={recipientGstin}
                    onChange={(e) => setRecipientGstin(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono uppercase text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Filing Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="FILED">FILED (Acknowledged)</option>
                    <option value="DRAFT_READY">DRAFT READY (Review)</option>
                    <option value="OVERDUE">OVERDUE (Urgent)</option>
                    <option value="PENDING">PENDING</option>
                    <option value="REJECTED">REJECTED (Errors)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Tax Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={taxLiability}
                    onChange={(e) => setTaxLiability(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {status === 'FILED' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Application Reference Number (ARN) *
                  </label>
                  <input
                    type="text"
                    value={arn}
                    onChange={(e) => setArn(e.target.value)}
                    placeholder="AA2708260012345"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Accountant Custom Notes (Optional)
                </label>
                <textarea
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="e.g. Verified with books. GSTR-2B ITC fully availed."
                  rows={2}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="includeReceiptLink"
                  checked={includeReceiptLink}
                  onChange={(e) => setIncludeReceiptLink(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="includeReceiptLink" className="text-xs text-slate-700 font-medium">
                  Include instant receipt download link in message
                </label>
              </div>
            </div>

            {/* Live WhatsApp Speech Bubble Preview Column */}
            <div className="bg-slate-100 rounded-2xl p-4 flex flex-col justify-between border border-slate-200/80">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                      TF
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">TaxFlow Compliance Bot</h5>
                      <span className="text-[10px] text-emerald-600 font-semibold">Verified WhatsApp Business</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* WhatsApp Chat Bubble */}
                <div className="bg-[#e7fedb] border border-[#d3f7be] rounded-2xl rounded-tl-none p-3.5 shadow-sm text-slate-800 text-xs font-sans whitespace-pre-wrap leading-relaxed">
                  {generatePreview()}
                  <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-slate-400">
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <CheckCheck size={14} className="text-sky-500" />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 mt-4 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Target: <strong>{recipientPhone || 'Not set'}</strong>
                </span>
                <button
                  onClick={handleSend}
                  disabled={isSending || !recipientPhone}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
                >
                  {isSending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Sending via Twilio...
                    </>
                  ) : (
                    <>
                      <Send size={14} /> Send WhatsApp Alert
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
