import React, { useState } from 'react';
import { MessageSquare, Send, CheckCircle2, AlertCircle, X, ShieldAlert, Sparkles, Loader2, DollarSign, Calendar, Copy, Check } from 'lucide-react';
import { Invoice } from '../types';
import { sendInvoiceStatusWhatsAppNotification } from '../services/api';

interface SendInvoiceWhatsAppModalProps {
  invoice: Invoice;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SendInvoiceWhatsAppModal: React.FC<SendInvoiceWhatsAppModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [phone, setPhone] = useState((invoice as any).billingAddress?.phone || (invoice as any).phone || '+919876543210');
  const [notificationType, setNotificationType] = useState<'INVOICE_ISSUED' | 'PAYMENT_REMINDER' | 'PAYMENT_OVERDUE' | 'PAYMENT_RECEIVED' | 'E_INVOICE_GENERATED'>(
    invoice.status === 'PAID' ? 'PAYMENT_RECEIVED' :
    (invoice.status as string) === 'OVERDUE' ? 'PAYMENT_OVERDUE' :
    invoice.status === 'DRAFT' || invoice.status === 'PENDING' ? 'INVOICE_ISSUED' : 'PAYMENT_REMINDER'
  );
  const [customNote, setCustomNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [statusResult, setStatusResult] = useState<{ success: boolean; messageId?: string; simulated?: boolean; error?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isOverdue = (invoice.status as string) === 'OVERDUE' || (invoice.dueDate && new Date(invoice.dueDate) < new Date() && invoice.status !== 'PAID');
  const daysOverdue = isOverdue && invoice.dueDate 
    ? Math.max(1, Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  // Generate real-time WhatsApp preview
  const generatePreview = () => {
    const formattedAmount = `₹${Number(invoice.amount || 0).toLocaleString('en-IN')}`;
    const clientName = invoice.partyName || 'Valued Client';
    const invNo = invoice.invoiceNumber;
    const dueDate = invoice.dueDate || 'Immediate';
    const appBaseUrl = 'https://taxflow.app';

    switch (notificationType) {
      case 'INVOICE_ISSUED':
        return `🧾 *INVOICE NOTIFICATION: ISSUED*\n\nDear *${clientName}*,\n\nInvoice *${invNo}* for *${formattedAmount}* has been *ISSUED* and is awaiting your review.\n\n📅 *Invoice Date:* ${invoice.date}\n⏳ *Due Date:* ${dueDate}\n${invoice.irn ? `🔐 *NIC E-Invoice IRN:* ${invoice.irn.substring(0, 16)}... (Verified)\n` : ''}💳 *UPI VPA:* upi@taxflow.hdfc\n\n📄 View Invoice & Receipt: ${appBaseUrl}/invoices?inv=${invNo}\n\n${customNote ? `💬 *Note:* ${customNote}\n\n` : ''}Thank you for your business!`;

      case 'PAYMENT_REMINDER':
        return `🔔 *PAYMENT DUE REMINDER*\n\nDear *${clientName}*,\n\nThis is a friendly reminder regarding pending payment for Invoice *${invNo}* amounting to *${formattedAmount}*.\n\n⏳ *Due Date:* *${dueDate}*\n\n💳 *Payment Details:*\n• Bank: HDFC Bank Ltd\n• A/C No: 50200084729182\n• IFSC: HDFC0000240\n• UPI ID: taxflow@hdfcbank\n\n📄 Review Invoice details: ${appBaseUrl}/invoices?inv=${invNo}\n\n${customNote ? `💬 *Note:* ${customNote}\n\n` : ''}If you have already processed this payment, kindly disregard this notice.`;

      case 'PAYMENT_OVERDUE':
        return `🚨 *PAYMENT OVERDUE NOTICE*\n\nDear *${clientName}*,\n\nThis is an urgent notice regarding overdue payment for Invoice *${invNo}* amounting to *${formattedAmount}*.\n\n⚠️ *Status:* Overdue by *${daysOverdue} days* (Due on ${dueDate}). Please settle immediately to avoid late interest charges under statutory terms.\n\n💳 *Payment Details:*\n• Bank: HDFC Bank Ltd\n• A/C No: 50200084729182\n• IFSC: HDFC0000240\n• UPI ID: taxflow@hdfcbank\n\n📄 Review Invoice details: ${appBaseUrl}/invoices?inv=${invNo}\n\n${customNote ? `💬 *Note:* ${customNote}\n\n` : ''}Thank you for your prompt attention.`;

      case 'PAYMENT_RECEIVED':
        return `✅ *PAYMENT RECEIVED ACKNOWLEDGEMENT*\n\nDear *${clientName}*,\n\nWe have successfully received your payment of *${formattedAmount}* for Invoice *${invNo}*.\n\n💳 *Payment Method:* Online / Bank Transfer\n🔖 *Transaction Ref:* TXN${Date.now().toString().slice(-8)}\n📅 *Receipt Date:* ${new Date().toLocaleDateString('en-GB')}\n⚖️ *Remaining Balance:* ₹0.00 (Fully Settled)\n\n📥 Download Payment Receipt: ${appBaseUrl}/invoices?inv=${invNo}&receipt=true\n\nThank you for partnering with us!`;

      case 'E_INVOICE_GENERATED':
        return `⚡ *E-INVOICE GENERATED & REGISTERED*\n\nDear *${clientName}*,\n\nE-Invoice for *${invNo}* (*${formattedAmount}*) has been generated and validated with the Goods and Services Tax Network (GSTN).\n\n🔑 *IRN:* ${invoice.irn ? invoice.irn.substring(0, 24) : 'e7f8a9b2c3d4e5f67890abcdef'}...\n📄 *Ack Number:* 112458923019\n📅 *Ack Date:* ${new Date().toLocaleDateString('en-GB')}\n\n🔗 View QR & Download Tax Invoice: ${appBaseUrl}/e-invoice`;

      default:
        return '';
    }
  };

  const handleSend = async () => {
    if (!phone || phone.trim().length < 10) {
      alert('Please enter a valid WhatsApp mobile number with country code (e.g. +919876543210).');
      return;
    }

    setIsSending(true);
    setStatusResult(null);

    try {
      const res = await sendInvoiceStatusWhatsAppNotification({
        invoiceNumber: invoice.invoiceNumber,
        partyName: invoice.partyName,
        recipientPhone: phone.trim(),
        amount: invoice.amount,
        status: invoice.status,
        dueDate: invoice.dueDate,
        date: invoice.date,
        notificationType,
        irn: invoice.irn,
        customNote: customNote.trim() || undefined,
        isOverdue: notificationType === 'PAYMENT_OVERDUE' || isOverdue,
        daysOverdue
      });

      setStatusResult({
        success: true,
        messageId: res.messageId,
        simulated: res.simulated
      });

      if (onSuccess) {
        setTimeout(() => onSuccess(), 1200);
      }
    } catch (err: any) {
      console.error('Failed to dispatch invoice WhatsApp notification:', err);
      setStatusResult({
        success: false,
        error: err.message || 'Failed to dispatch WhatsApp notification via Twilio service.'
      });
    } finally {
      setIsSending(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatePreview());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl">
              <MessageSquare size={22} className="text-white fill-white/20" />
            </div>
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                Send WhatsApp Invoice Notification
              </h3>
              <p className="text-xs text-emerald-100">
                Routed via Configured Twilio WhatsApp Gateway
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Target Invoice Banner */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono">
                  {invoice.invoiceNumber}
                </span>
                <span className="text-sm font-bold text-slate-900">{invoice.partyName}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Invoice Date: {invoice.date} | Due: {invoice.dueDate || 'Immediate'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-slate-900">
                ₹{Number(invoice.amount || 0).toLocaleString('en-IN')}
              </div>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                invoice.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                (invoice.status as string) === 'OVERDUE' ? 'bg-rose-100 text-rose-800' :
                'bg-amber-100 text-amber-800'
              }`}>
                Status: {invoice.status}
              </span>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  Recipient WhatsApp Mobile Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                />
                <p className="text-[11px] text-slate-400">Include country code prefix (+91 for India).</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Notification Purpose / Template</label>
                <select
                  value={notificationType}
                  onChange={(e) => setNotificationType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium"
                >
                  <option value="INVOICE_ISSUED">🧾 Invoice Issued & Summary</option>
                  <option value="PAYMENT_REMINDER">🔔 Payment Due Reminder</option>
                  <option value="PAYMENT_OVERDUE">🚨 Urgent Payment Overdue Notice</option>
                  <option value="PAYMENT_RECEIVED">✅ Payment Received Acknowledgement</option>
                  <option value="E_INVOICE_GENERATED">⚡ E-Invoice Registered with IRN</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Custom Message Note (Optional)</span>
                <span className="text-[10px] text-slate-400">Appended to the WhatsApp text</span>
              </label>
              <input
                type="text"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="e.g. Please approve and share the transaction ref."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
              />
            </div>
          </div>

          {/* WhatsApp Message Preview Bubble */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-emerald-500" /> WhatsApp Live Chat Preview
              </label>
              <button
                type="button"
                onClick={copyToClipboard}
                className="text-xs font-semibold text-slate-500 hover:text-emerald-600 flex items-center gap-1 transition-colors"
              >
                {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy Text'}
              </button>
            </div>

            {/* WhatsApp Phone Mock Bubble */}
            <div className="p-4 bg-[#E5DDD5] rounded-2xl border border-slate-200/80 shadow-inner">
              <div className="max-w-md bg-white rounded-2xl rounded-tl-sm p-4 shadow-sm text-xs text-slate-800 space-y-2 relative border border-emerald-900/5">
                <div className="whitespace-pre-wrap font-sans leading-relaxed">
                  {generatePreview()}
                </div>
                <div className="text-[10px] text-slate-400 text-right font-medium">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                </div>
              </div>
            </div>
          </div>

          {/* Status feedback */}
          {statusResult && (
            <div className={`p-4 rounded-2xl border flex items-start gap-3 animate-in fade-in duration-200 ${
              statusResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              {statusResult.success ? (
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="text-xs space-y-1">
                <p className="font-bold">
                  {statusResult.success ? 'WhatsApp Notification Dispatched Successfully!' : 'Dispatch Failed'}
                </p>
                {statusResult.success ? (
                  <p className="text-emerald-700">
                    Message SID: <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-200">{statusResult.messageId}</code>
                    {statusResult.simulated && ' (Dispatched via Twilio WhatsApp Sandbox / Simulation)'}
                  </p>
                ) : (
                  <p className="text-rose-700">{statusResult.error}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || !phone}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {isSending ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Dispatching...
              </>
            ) : (
              <>
                <Send size={16} /> Send via Twilio WhatsApp
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
