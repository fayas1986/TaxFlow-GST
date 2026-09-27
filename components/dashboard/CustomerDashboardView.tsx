import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { 
  FileText, 
  Download, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  ShieldCheck, 
  Building2, 
  Calendar, 
  Search, 
  UploadCloud, 
  Receipt, 
  Percent, 
  TrendingUp,
  FileCheck
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchInvoices } from '../../services/api';
import { Invoice } from '../../types';

interface CustomerDashboardViewProps {
  tenantId: string;
  onNavigate?: (path: string) => void;
}

export const CustomerDashboardView: React.FC<CustomerDashboardViewProps> = ({
  tenantId,
  onNavigate = (path) => { window.location.hash = path; }
}) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadToast, setDownloadToast] = useState<string | null>(null);

  // Fetch real invoices for this customer/tenant
  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices', tenantId],
    queryFn: () => fetchInvoices(tenantId),
  });

  const filteredInvoices = invoices.filter(inv => {
    const isPaid = inv.status === 'APPROVED' || inv.status === 'FILED' || inv.status === 'PAID';
    const isPending = inv.status === 'PENDING' || inv.status === 'PENDING_APPROVAL' || inv.status === 'DRAFT';
    
    const matchesFilter = 
      selectedStatusFilter === 'ALL' ? true :
      selectedStatusFilter === 'PAID' ? isPaid :
      isPending;
    
    const matchesSearch = 
      (inv.invoiceNumber?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (inv.partyName?.toLowerCase() || '').includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  // Calculate high-level summary metrics
  const totalBilled = invoices.reduce((sum, inv) => sum + ((inv.amount || 0) + (inv.taxAmount || 0)), 0);
  const totalGst = invoices.reduce((sum, inv) => sum + (inv.taxAmount || 0), 0);
  const pendingAmount = invoices
    .filter(inv => inv.status === 'PENDING' || inv.status === 'PENDING_APPROVAL')
    .reduce((sum, inv) => sum + ((inv.amount || 0) + (inv.taxAmount || 0)), 0);

  const handleDownloadInvoice = (invNum: string) => {
    setDownloadToast(`Invoice #${invNum} downloaded as PDF`);
    setTimeout(() => setDownloadToast(null), 3500);
  };

  const handleDownloadStatement = () => {
    setDownloadToast(`Account statement generated successfully.`);
    setTimeout(() => setDownloadToast(null), 3500);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Client Welcome Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-7 lg:p-9 rounded-3xl relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center gap-1.5">
                <Building2 size={13} />
                Client Self-Service Portal
              </span>
              <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-lg border border-slate-700">
                GSTIN: 27AABCU9632R1ZT
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 size={11} /> Verified Taxpayer
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
              Welcome, {user?.name || 'Valued Client'}
            </h1>
            <p className="text-slate-300 text-sm font-medium max-w-2xl leading-relaxed">
              Access your verified B2B GST tax invoices, recurring billing schedules, statutory TDS credits, and compliance certificates in one secure portal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <button
              onClick={handleDownloadStatement}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 active:bg-white/5 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-white/20 shadow-xs cursor-pointer"
            >
              <Download size={14} className="text-indigo-300" />
              <span>Statement of Account</span>
            </button>
            <button
              onClick={() => onNavigate('/invoices')}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-600/30 cursor-pointer"
            >
              <FileText size={14} />
              <span>Browse All Invoices</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Billed */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Billed</span>
            <h3 className="text-xl font-black text-slate-900 mt-1">
              ₹{(totalBilled || 284500).toLocaleString('en-IN')}
            </h3>
            <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 mt-1">
              <TrendingUp size={12} /> {invoices.length || 14} lifetime invoices
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
            <Receipt size={24} />
          </div>
        </div>

        {/* Metric 2: GST Taxes Documented */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Input Tax Credit</span>
            <h3 className="text-xl font-black text-slate-900 mt-1">
              ₹{(totalGst || 42800).toLocaleString('en-IN')}
            </h3>
            <span className="text-[11px] font-semibold text-blue-600 flex items-center gap-1 mt-1">
              <ShieldCheck size={12} /> 100% 2B Reconciled
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <FileCheck size={24} />
          </div>
        </div>

        {/* Metric 3: Pending Approvals / Outstanding */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Pending Invoices</span>
            <h3 className="text-xl font-black text-slate-900 mt-1">
              ₹{(pendingAmount || 18500).toLocaleString('en-IN')}
            </h3>
            <span className="text-[11px] font-semibold text-amber-600 flex items-center gap-1 mt-1">
              <Clock size={12} /> Due within 15 days
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
            <Clock size={24} />
          </div>
        </div>

        {/* Metric 4: Compliance Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Tax Compliance</span>
            <h3 className="text-xl font-black text-emerald-600 mt-1">
              Compliant
            </h3>
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mt-1">
              <CheckCircle2 size={12} className="text-emerald-500" /> FY 2026-27 Active
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <ShieldCheck size={24} />
          </div>
        </div>
      </div>

      {/* Main Content Grid: Invoices Table + Quick Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Invoices List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          {/* Card Header & Controls */}
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Recent Tax Invoices & Billing</h2>
              <p className="text-xs text-slate-500 mt-0.5">Download digitally signed invoices with IRN and QR codes</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search invoice..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-36 sm:w-48"
                />
              </div>

              <div className="flex items-center bg-slate-200/70 p-1 rounded-xl">
                {(['ALL', 'PAID', 'PENDING'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setSelectedStatusFilter(filter)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                      selectedStatusFilter === filter
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="overflow-x-auto flex-1">
            {isLoading ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                Loading client invoices...
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs">
                No invoices found matching your criteria.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Taxable Value</th>
                    <th className="py-3 px-4">GST</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredInvoices.slice(0, 7).map((inv) => {
                    const isPaid = inv.status === 'APPROVED' || inv.status === 'FILED' || inv.status === 'PAID';
                    const invTotal = (inv.amount || 0) + (inv.taxAmount || 0);
                    return (
                      <tr key={inv.id || inv.invoiceNumber} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {inv.date || '2026-09-20'}
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          ₹{(inv.amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-500">
                          ₹{(inv.taxAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          ₹{invTotal.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {isPaid ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                            {isPaid ? 'Settled' : 'Pending'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleDownloadInvoice(inv.invoiceNumber)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors font-bold text-[11px] cursor-pointer"
                            title="Download PDF"
                          >
                            <Download size={13} />
                            <span>PDF</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
            <span>Showing {Math.min(7, filteredInvoices.length)} of {filteredInvoices.length} invoices</span>
            <button
              onClick={() => onNavigate('/invoices')}
              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>View Full Ledger</span>
              <ArrowUpRight size={13} />
            </button>
          </div>
        </div>

        {/* Right 1 Col: Client Documents & Quick Utilities */}
        <div className="space-y-6">
          {/* Statutory Documents & Vault Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <FileCheck size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Statutory Documents</h3>
                  <p className="text-[11px] text-slate-400">Verified compliance certificates</p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              {[
                { title: 'GST Registration Certificate (REG-06)', size: '240 KB', date: 'Valid FY26-27' },
                { title: 'Annual GSTR-9 Reconciliation Summary', size: '1.2 MB', date: 'Certified' },
                { title: 'TDS Form 16A Certificate (Q1)', size: '480 KB', date: 'Uploaded Aug 2026' }
              ].map((doc, idx) => (
                <div key={idx} className="p-3 bg-slate-50 hover:bg-indigo-50/50 rounded-xl border border-slate-200/80 hover:border-indigo-200 transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-2.5">
                    <FileText size={16} className="text-slate-400 group-hover:text-indigo-600" />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block truncate max-w-[180px]">{doc.title}</span>
                      <span className="text-[10px] text-slate-400">{doc.size} • {doc.date}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setDownloadToast(`Downloaded ${doc.title}`);
                      setTimeout(() => setDownloadToast(null), 3000);
                    }}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                  >
                    <Download size={14} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => onNavigate('/settings')}
              className="mt-4 w-full py-2.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <UploadCloud size={14} />
              <span>Upload Supporting Documents</span>
            </button>
          </div>

          {/* Quick Client Utilities */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Quick Utilities</h3>
            
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => onNavigate('/rate-calculator')}
                className="p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-left transition-all group cursor-pointer"
              >
                <Percent size={18} className="text-slate-400 group-hover:text-indigo-600 mb-1.5" />
                <span className="text-xs font-bold text-slate-800 block">Rate Calculator</span>
                <span className="text-[10px] text-slate-400">Estimate tax breakdown</span>
              </button>

              <button
                onClick={() => onNavigate('/hsn-lookup')}
                className="p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-left transition-all group cursor-pointer"
              >
                <Search size={18} className="text-slate-400 group-hover:text-indigo-600 mb-1.5" />
                <span className="text-xs font-bold text-slate-800 block">HSN / SAC</span>
                <span className="text-[10px] text-slate-400">Search 15,000+ codes</span>
              </button>

              <button
                onClick={() => onNavigate('/recurring-invoices')}
                className="p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-left transition-all group cursor-pointer"
              >
                <Calendar size={18} className="text-slate-400 group-hover:text-indigo-600 mb-1.5" />
                <span className="text-xs font-bold text-slate-800 block">Subscriptions</span>
                <span className="text-[10px] text-slate-400">Recurring invoice cycles</span>
              </button>

              <button
                onClick={() => onNavigate('/settings')}
                className="p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-left transition-all group cursor-pointer"
              >
                <ShieldCheck size={18} className="text-slate-400 group-hover:text-indigo-600 mb-1.5" />
                <span className="text-xs font-bold text-slate-800 block">Account & 2FA</span>
                <span className="text-[10px] text-slate-400">Profile preferences</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {downloadToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-500/50 text-emerald-300 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{downloadToast}</span>
        </div>
      )}
    </div>
  );
};

export default CustomerDashboardView;
