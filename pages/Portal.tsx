import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchInvoice } from '../services/api';
import { Invoice } from '../types';
import { 
  ShieldCheck, FileText, IndianRupee, Printer, 
  Download, CheckCircle2, Clock, AlertCircle,
  Building, User, Calendar
} from 'lucide-react';

const Portal: React.FC = () => {
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    // Get ID from hash: #/portal/inv-t1-0
    const hash = window.location.hash;
    const parts = hash.split('/');
    if (parts.length >= 3 && parts[1] === 'portal') {
      setInvoiceId(parts[2]);
    }
  }, []);

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['invoice-portal', invoiceId],
    queryFn: () => invoiceId ? fetchInvoice(invoiceId) : Promise.resolve(null),
    enabled: !!invoiceId
  });

  if (!invoiceId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 text-center max-w-md">
          <AlertCircle size={48} className="text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800">Invalid Portal Link</h1>
          <p className="text-slate-500 mt-2">The link you followed is missing a valid invoice identifier.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Verifying Invoice Details...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 text-center max-w-md">
          <AlertCircle size={48} className="text-rose-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800">Invoice Not Found</h1>
          <p className="text-slate-500 mt-2">We couldn't retrieve the details for this invoice. It may have been deleted or the link is incorrect.</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FILED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'UPLOADED': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'FAILED': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20">
              <ShieldCheck size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">TaxFlow Portal</h1>
              <p className="text-slate-500 text-sm font-medium">Verified Invoice & Payment Status</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
            >
              <Printer size={18} /> Print
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10">
              <Download size={18} /> PDF
            </button>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          {/* Status Banner */}
          <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Invoice Number</p>
              <h2 className="text-3xl font-black tracking-tight">{invoice.invoiceNumber}</h2>
            </div>
            <div className={`px-6 py-2 rounded-full border text-sm font-black uppercase tracking-widest flex items-center gap-2 ${getStatusColor(invoice.status)}`}>
              {invoice.status === 'FILED' ? <CheckCircle2 size={16} /> : <Clock size={16} />}
              {invoice.status === 'FILED' ? 'Verified & Filed' : 'Processing'}
            </div>
          </div>

          <div className="p-8 md:p-12">
            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Building size={14} /> Issuer Details
                  </h3>
                  <p className="text-xl font-bold text-slate-800">TaxFlow Solutions Ltd</p>
                  <p className="text-slate-500 mt-1">27ABCDE1234F1Z5</p>
                  <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                    123 Business Park, Mumbai, MH<br />
                    India - 400001
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <User size={14} /> Recipient Details
                  </h3>
                  <p className="text-xl font-bold text-slate-800">{invoice.partyName}</p>
                  <p className="text-slate-500 mt-1">{invoice.gstin || 'Consumer'}</p>
                  <p className="text-slate-500 text-sm mt-2">
                    Place of Supply: State Code {invoice.placeOfSupply}
                  </p>
                </div>

                <div className="flex gap-8">
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Date</h3>
                    <p className="font-bold text-slate-800">{invoice.date}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Due Date</h3>
                    <p className="font-bold text-slate-800">Net 30</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="mb-12">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <FileText size={14} /> Line Items
              </h3>
              <div className="border border-slate-100 rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Taxable Value</th>
                      <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Tax</th>
                      <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {invoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-800">{item.description}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">HSN: {item.hsnSac}</p>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-600">₹{item.taxableValue.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-medium text-slate-600">₹{item.taxAmount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-800">₹{(item.taxableValue + item.taxAmount).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-full md:w-80 space-y-4">
                <div className="flex justify-between text-sm text-slate-500 font-medium">
                  <span>Subtotal</span>
                  <span>₹{invoice.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-500 font-medium">
                  <span>Total Tax</span>
                  <span>₹{invoice.taxAmount.toLocaleString()}</span>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-lg font-black text-slate-900 uppercase tracking-tighter">Grand Total</span>
                  <span className="text-2xl font-black text-blue-600">₹{(invoice.amount + invoice.taxAmount).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Verification Footer */}
          <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <ShieldCheck size={24} />
              </div>
              <div>
                <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Digitally Verified</p>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Authenticated via TaxFlow IRN Bridge</p>
              </div>
            </div>
            {invoice.irn && (
              <div className="text-[10px] text-slate-400 font-mono break-all max-w-md">
                IRN: {invoice.irn}
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-8">
          This is a read-only document generated by TaxFlow Compliance SaaS for verification purposes.
        </p>
      </div>
    </div>
  );
};

export default Portal;
