import React from 'react';
import { 
  FileText, ShieldAlert, Activity, ArrowUpRight, 
  CheckCircle2, Briefcase, ChevronRight, AlertCircle 
} from 'lucide-react';

interface ComplianceHighlightsProps {
  analytics?: any;
  filings?: any;
}

const ComplianceHighlights: React.FC<ComplianceHighlightsProps> = ({ analytics, filings }) => {
  // Use real data from analytics/filings if available, otherwise fall back to screenshot high-fidelity defaults
  const vendorCompliance = analytics?.riskMetrics?.vendorCompliance ?? 82;
  const mismatches = analytics?.riskMetrics?.mismatchedInvoices ?? 14;
  const itcAtRiskVal = analytics?.riskMetrics?.itcAtRisk ?? 45600;
  
  // Format ITC at Risk (e.g., 45600 -> "₹45.6k")
  const formattedItcAtRisk = itcAtRiskVal >= 1000 
    ? `₹${(itcAtRiskVal / 1000).toFixed(1)}k` 
    : `₹${itcAtRiskVal}`;

  // Get GSTR-1 and GSTR-3B statuses
  const gstr1 = filings?.find((f: any) => f.type === 'GSTR-1') || { status: 'FILED', period: 'Oct 2024', filedDate: '11th Nov 2024' };
  const gstr3b = filings?.find((f: any) => f.type === 'GSTR-3B') || { status: 'PENDING', period: 'Oct 2024', dueDate: '20th Nov' };

  return (
    <div id="compliance-highlights-section" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      
      {/* CARD 1: Filing Status */}
      <div id="filing-status-card" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all duration-200 min-h-[370px]">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100/80 shrink-0 shadow-xs">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Filing Status</h3>
                <span className="text-[11px] font-medium text-slate-500">Statutory Return Periods</span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              FY 2026-27
            </span>
          </div>

          {/* Sub-cards Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* GSTR-1 Box */}
            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70 relative flex flex-col justify-between min-h-[105px]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">GSTR-1</span>
                  <div className="w-5 h-5 rounded-full bg-emerald-100/80 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 size={12} strokeWidth={2.5} />
                  </div>
                </div>
                <p className="text-2xl font-black text-emerald-600 mt-1">Filed</p>
              </div>
              <p className="text-[10px] text-slate-400 font-bold mt-2">11th Nov 2024</p>
            </div>

            {/* GSTR-3B Box */}
            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70 relative flex flex-col justify-between min-h-[105px]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">GSTR-3B</span>
                  <div className="w-5 h-5 rounded-full bg-amber-100/80 flex items-center justify-center text-amber-600">
                    <Briefcase size={11} strokeWidth={2.5} />
                  </div>
                </div>
                <p className="text-2xl font-black text-amber-600 mt-1">Pending</p>
              </div>
              <p className="text-[10px] text-slate-400 font-bold mt-2">Due: 20th Nov</p>
            </div>
          </div>
        </div>

        {/* View Detailed Report Link */}
        <button 
          onClick={() => window.location.hash = '#/filing'}
          className="w-full mt-5 pt-3.5 border-t border-slate-100 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors flex items-center justify-center gap-1.5 group"
        >
          <span>View Detailed Filing Status</span>
          <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
      </div>


      {/* CARD 2: Risk Meter */}
      <div id="risk-meter-card" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all duration-200 min-h-[370px]">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100/80 shrink-0 shadow-xs">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Risk Meter</h3>
                <span className="text-[11px] font-medium text-slate-500">Audit & Exposure Index</span>
              </div>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              vendorCompliance >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {vendorCompliance >= 80 ? 'Healthy' : 'Needs Review'}
            </span>
          </div>

          {/* Compliance Meter */}
          <div className="space-y-1.5 mb-4 p-3 bg-slate-50/70 rounded-xl border border-slate-200/60">
            <div className="flex justify-between items-center text-xs font-bold text-slate-700">
              <span>Vendor Compliance Rate</span>
              <span className="font-mono text-slate-900">{vendorCompliance}%</span>
            </div>
            
            {/* Custom styled progress bar */}
            <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${vendorCompliance}%` }}
              ></div>
            </div>
          </div>

          {/* Two-Column Mini Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Mismatches container */}
            <div className="border border-slate-200/70 bg-slate-50/80 p-3 rounded-xl flex flex-col items-center justify-center text-center min-h-[72px]">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Mismatches</span>
              <span className="text-2xl font-black text-rose-600 tracking-tight font-mono">{mismatches}</span>
            </div>

            {/* ITC Risk container */}
            <div className="border border-slate-200/70 bg-slate-50/80 p-3 rounded-xl flex flex-col items-center justify-center text-center min-h-[72px]">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">ITC Risk</span>
              <span className="text-2xl font-black text-amber-600 tracking-tight font-mono">{formattedItcAtRisk}</span>
            </div>
          </div>
        </div>

        {/* Action button matching Card 1 and Card 3 */}
        <button 
          onClick={() => window.location.hash = '#/reconciliation'}
          className="w-full mt-5 pt-3.5 border-t border-slate-100 text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors flex items-center justify-center gap-1.5 group"
        >
          <span>Launch Risk Audit Center</span>
          <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
      </div>


      {/* CARD 3: Live Feed */}
      <div id="live-feed-card" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all duration-200 min-h-[370px]">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100/80 shrink-0 shadow-xs">
                <Activity size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Live Activity Feed</h3>
                <span className="text-[11px] font-medium text-slate-500">Real-Time Operational Audit</span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Live
            </span>
          </div>

          {/* Live Timeline list */}
          <div className="relative pl-5 space-y-4">
            {/* Vertical Timeline Connector Line */}
            <div className="absolute left-1.5 top-1.5 bottom-1.5 w-0.5 bg-slate-200"></div>

            {/* Feed Item 1 */}
            <div className="relative flex items-start justify-between gap-2 group">
              <div className="absolute -left-5 top-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-blue-500 shadow-xs z-10"></div>
              
              <div className="flex-1 min-w-0 pr-1">
                <h4 className="text-xs font-bold text-slate-800 leading-tight truncate">GSTR-1 Filed Successfully</h4>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">Oct 2024 Return</p>
              </div>
              
              <span className="text-[10px] bg-slate-100 font-bold text-slate-500 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
                2h ago
              </span>
            </div>

            {/* Feed Item 2 */}
            <div className="relative flex items-start justify-between gap-2 group">
              <div className="absolute -left-5 top-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-amber-500 shadow-xs z-10"></div>
              
              <div className="flex-1 min-w-0 pr-1">
                <h4 className="text-xs font-bold text-slate-800 leading-tight truncate">Vendor Mismatch Alert</h4>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">Cloud Services (₹45k)</p>
              </div>
              
              <span className="text-[10px] bg-slate-100 font-bold text-slate-500 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
                5h ago
              </span>
            </div>

            {/* Feed Item 3 */}
            <div className="relative flex items-start justify-between gap-2 group">
              <div className="absolute -left-5 top-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-emerald-500 shadow-xs z-10"></div>
              
              <div className="flex-1 min-w-0 pr-1">
                <h4 className="text-xs font-bold text-slate-800 leading-tight truncate">E-Invoices Generated</h4>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">Batch #4092 • 15 Invoices</p>
              </div>
              
              <span className="text-[10px] bg-slate-100 font-bold text-slate-500 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
                1d ago
              </span>
            </div>
          </div>
        </div>

        {/* View Complete Audit Trail */}
        <button 
          onClick={() => window.location.hash = '#/audit'}
          className="w-full mt-5 pt-3.5 border-t border-slate-100 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center justify-center gap-1.5 group"
        >
          <span>View Complete Audit Trail</span>
          <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
      </div>

    </div>
  );
};

export default ComplianceHighlights;
