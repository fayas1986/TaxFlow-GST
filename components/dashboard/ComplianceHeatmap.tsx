import React, { useState } from 'react';
import { 
  Flame, Calendar, AlertTriangle, ShieldCheck, Activity, ChevronLeft, 
  ChevronRight, ArrowRight, TrendingUp, Filter, Sparkles, CheckCircle2 
} from 'lucide-react';

interface HeatmapDay {
  dayNum: number;
  dateStr: string;
  invoiceCount: number;
  riskScore: number; // 0 - 100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'NONE';
  totalValue: number;
  gstLiability: number;
  anomalies: string[];
}

export const ComplianceHeatmap: React.FC = () => {
  const [selectedDay, setSelectedDay] = useState<number>(17); // August 17, 2026 is today
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');

  // Generate high-fidelity calendar days for August 2026 (Starts on Saturday, 31 days)
  const heatmapData: HeatmapDay[] = [
    { dayNum: 1, dateStr: '2026-08-01', invoiceCount: 14, riskScore: 12, riskLevel: 'LOW', totalValue: 850000, gstLiability: 153000, anomalies: [] },
    { dayNum: 2, dateStr: '2026-08-02', invoiceCount: 0, riskScore: 0, riskLevel: 'NONE', totalValue: 0, gstLiability: 0, anomalies: [] },
    { dayNum: 3, dateStr: '2026-08-03', invoiceCount: 22, riskScore: 45, riskLevel: 'MEDIUM', totalValue: 1240000, gstLiability: 223200, anomalies: ['Supplier GSTIN suspended (IndoTech Hardware)'] },
    { dayNum: 4, dateStr: '2026-08-04', invoiceCount: 18, riskScore: 8, riskLevel: 'LOW', totalValue: 980000, gstLiability: 176400, anomalies: [] },
    { dayNum: 5, dateStr: '2026-08-05', invoiceCount: 31, riskScore: 15, riskLevel: 'LOW', totalValue: 2150000, gstLiability: 387000, anomalies: [] },
    { dayNum: 6, dateStr: '2026-08-06', invoiceCount: 9, riskScore: 78, riskLevel: 'HIGH', totalValue: 1450000, gstLiability: 261000, anomalies: ['E-Invoice IRN missing for transaction above ₹5L threshold'] },
    { dayNum: 7, dateStr: '2026-08-07', invoiceCount: 12, riskScore: 24, riskLevel: 'LOW', totalValue: 620000, gstLiability: 111600, anomalies: [] },
    { dayNum: 8, dateStr: '2026-08-08', invoiceCount: 5, riskScore: 5, riskLevel: 'LOW', totalValue: 180000, gstLiability: 32400, anomalies: [] },
    { dayNum: 9, dateStr: '2026-08-09', invoiceCount: 0, riskScore: 0, riskLevel: 'NONE', totalValue: 0, gstLiability: 0, anomalies: [] },
    { dayNum: 10, dateStr: '2026-08-10', invoiceCount: 42, riskScore: 32, riskLevel: 'MEDIUM', totalValue: 3120000, gstLiability: 561600, anomalies: ['GSTR-2B reconciliation mismatch on ₹15,000 tax split'] },
    { dayNum: 11, dateStr: '2026-08-11', invoiceCount: 19, riskScore: 14, riskLevel: 'LOW', totalValue: 1100000, gstLiability: 198000, anomalies: [] },
    { dayNum: 12, dateStr: '2026-08-12', invoiceCount: 25, riskScore: 92, riskLevel: 'HIGH', totalValue: 4800000, gstLiability: 864000, anomalies: ['E-Way bill expired mid-transit on cargo shipment', 'Section 17(5) Blocked ITC audit alert'] },
    { dayNum: 13, dateStr: '2026-08-13', invoiceCount: 14, riskScore: 11, riskLevel: 'LOW', totalValue: 730000, gstLiability: 131400, anomalies: [] },
    { dayNum: 14, dateStr: '2026-08-14', invoiceCount: 20, riskScore: 18, riskLevel: 'LOW', totalValue: 1050000, gstLiability: 189000, anomalies: [] },
    { dayNum: 15, dateStr: '2026-08-15', invoiceCount: 2, riskScore: 0, riskLevel: 'LOW', totalValue: 50000, gstLiability: 9000, anomalies: [] },
    { dayNum: 16, dateStr: '2026-08-16', invoiceCount: 0, riskScore: 0, riskLevel: 'NONE', totalValue: 0, gstLiability: 0, anomalies: [] },
    { dayNum: 17, dateStr: '2026-08-17', invoiceCount: 28, riskScore: 48, riskLevel: 'MEDIUM', totalValue: 1940000, gstLiability: 349200, anomalies: ['Transporter assignment pending for inter-state cargo'] },
    { dayNum: 18, dateStr: '2026-08-18', invoiceCount: 15, riskScore: 10, riskLevel: 'LOW', totalValue: 800000, gstLiability: 144000, anomalies: [] },
    { dayNum: 19, dateStr: '2026-08-19', invoiceCount: 22, riskScore: 12, riskLevel: 'LOW', totalValue: 1400000, gstLiability: 252000, anomalies: [] },
    { dayNum: 20, dateStr: '2026-08-20', invoiceCount: 34, riskScore: 55, riskLevel: 'MEDIUM', totalValue: 2600000, gstLiability: 468000, anomalies: ['GSTR-2B matching rate discrepancies'] },
    { dayNum: 21, dateStr: '2026-08-21', invoiceCount: 17, riskScore: 14, riskLevel: 'LOW', totalValue: 920000, gstLiability: 165600, anomalies: [] },
    { dayNum: 22, dateStr: '2026-08-22', invoiceCount: 8, riskScore: 5, riskLevel: 'LOW', totalValue: 340000, gstLiability: 61200, anomalies: [] },
    { dayNum: 23, dateStr: '2026-08-23', invoiceCount: 0, riskScore: 0, riskLevel: 'NONE', totalValue: 0, gstLiability: 0, anomalies: [] },
    { dayNum: 24, dateStr: '2026-08-24', invoiceCount: 39, riskScore: 19, riskLevel: 'LOW', totalValue: 2850000, gstLiability: 513000, anomalies: [] },
    { dayNum: 25, dateStr: '2026-08-25', invoiceCount: 27, riskScore: 81, riskLevel: 'HIGH', totalValue: 3900000, gstLiability: 702000, anomalies: ['Mandatory IRN e-invoice payload schema validation failure'] },
    { dayNum: 26, dateStr: '2026-08-26', invoiceCount: 21, riskScore: 15, riskLevel: 'LOW', totalValue: 1150000, gstLiability: 207000, anomalies: [] },
    { dayNum: 27, dateStr: '2026-08-27', invoiceCount: 16, riskScore: 12, riskLevel: 'LOW', totalValue: 880000, gstLiability: 158400, anomalies: [] },
    { dayNum: 28, dateStr: '2026-08-28', invoiceCount: 30, riskScore: 40, riskLevel: 'MEDIUM', totalValue: 2100000, gstLiability: 378000, anomalies: ['Supplier default warnings detected'] },
    { dayNum: 29, dateStr: '2026-08-29', invoiceCount: 11, riskScore: 8, riskLevel: 'LOW', totalValue: 490000, gstLiability: 88200, anomalies: [] },
    { dayNum: 30, dateStr: '2026-08-30', invoiceCount: 1, riskScore: 0, riskLevel: 'LOW', totalValue: 20000, gstLiability: 3600, anomalies: [] },
    { dayNum: 31, dateStr: '2026-08-31', invoiceCount: 45, riskScore: 25, riskLevel: 'MEDIUM', totalValue: 3500000, gstLiability: 630000, anomalies: ['Filing deadline reconciliation alert'] }
  ];

  // August 2026 calendar placeholder offset (August 1, 2026 starts on a Saturday)
  // Calendar offset of 5 days: Sun(0), Mon(1), Tue(2), Wed(3), Thu(4), Fri(5), Sat(6)
  const firstDayOffset = 6; 
  const blankCells = Array(firstDayOffset).fill(null);

  const selectedDayData = heatmapData.find(d => d.dayNum === selectedDay) || heatmapData[16];

  // Calculate high risk calendar stats
  const totalMonthInvoices = heatmapData.reduce((acc, d) => acc + d.invoiceCount, 0);
  const avgRiskScore = Math.round(heatmapData.reduce((acc, d) => acc + d.riskScore, 0) / heatmapData.filter(d => d.invoiceCount > 0).length);

  // Return background gradient color-coding based on compliance risk indices
  const getHeatmapColor = (day: HeatmapDay) => {
    if (day.invoiceCount === 0) return 'bg-slate-50 border-slate-100 hover:bg-slate-100/70 text-slate-300';
    
    // Check if day does not pass the filter
    if (riskFilter !== 'ALL' && day.riskLevel !== riskFilter) {
      return 'bg-slate-100/50 border-slate-200/50 text-slate-400 opacity-40';
    }

    if (day.riskLevel === 'HIGH') {
      return 'bg-rose-500 hover:bg-rose-600 border-rose-400 text-white shadow-sm shadow-rose-500/20';
    }
    if (day.riskLevel === 'MEDIUM') {
      return 'bg-amber-400 hover:bg-amber-500 border-amber-300 text-slate-900 shadow-sm shadow-amber-400/20';
    }
    return 'bg-emerald-500 hover:bg-emerald-600 border-emerald-400 text-white shadow-sm shadow-emerald-500/20';
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
      
      {/* Header and Filter triggers */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-rose-550/10 text-rose-600 bg-rose-50 rounded-lg shrink-0">
              <Flame size={18} className="animate-pulse text-rose-500" />
            </span>
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              Compliance Risk & Volumetric Heatmap
            </h3>
            <span className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-100 text-rose-700 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full">
              <Sparkles size={10} /> Live Risk Audit
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Color-coded calendar mapping billing intensity against statutory risk metrics over the active month.
          </p>
        </div>

        {/* Legend/Filters */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200/60 text-[10px] font-extrabold shrink-0">
          <button 
            onClick={() => setRiskFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${riskFilter === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            All
          </button>
          <button 
            onClick={() => setRiskFilter('HIGH')}
            className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${riskFilter === 'HIGH' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 hover:text-rose-600'}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> High Risk
          </button>
          <button 
            onClick={() => setRiskFilter('MEDIUM')}
            className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${riskFilter === 'MEDIUM' ? 'bg-amber-400 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-amber-600'}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Medium Risk
          </button>
          <button 
            onClick={() => setRiskFilter('LOW')}
            className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${riskFilter === 'LOW' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-emerald-600'}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Safe
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Hand: Interactive Calendar Layout */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between text-xs font-black text-slate-800 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Calendar size={14} className="text-slate-500" /> August 2026
            </span>
            <span className="text-[10px] text-slate-400 font-bold">
              Select any day to inspect validation details
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2.5 text-center">
            {/* Weekdays */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-[10px] font-black uppercase text-slate-400 tracking-wider py-1">
                {d}
              </div>
            ))}

            {/* Offset Blank Cells */}
            {blankCells.map((_, idx) => (
              <div key={`blank-${idx}`} className="aspect-square bg-slate-50/20 border border-transparent rounded-xl" />
            ))}

            {/* Heatmap Day Cells */}
            {heatmapData.map((day) => {
              const colorBg = getHeatmapColor(day);
              const isSelected = selectedDay === day.dayNum;

              return (
                <button
                  key={day.dayNum}
                  onClick={() => setSelectedDay(day.dayNum)}
                  className={`aspect-square rounded-xl border flex flex-col items-center justify-between p-1.5 transition-all relative select-none ${colorBg} ${
                    isSelected 
                      ? 'ring-4 ring-indigo-600/25 scale-105 border-indigo-600 z-10' 
                      : 'border-transparent hover:scale-[1.02]'
                  }`}
                >
                  <span className="text-[11px] font-extrabold font-mono self-start">
                    {day.dayNum}
                  </span>
                  
                  {day.invoiceCount > 0 && (
                    <span className="text-[8px] font-black tracking-tight mt-1 px-1 rounded-md bg-black/10">
                      {day.invoiceCount}tx
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Summary Strip */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-150 grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-slate-500">
            <div>
              Total Invoices: <span className="font-mono text-slate-900 font-extrabold block text-xs">{totalMonthInvoices} Bills</span>
            </div>
            <div className="border-x border-slate-200">
              Avg Month Risk Index: <span className="font-mono text-slate-900 font-extrabold block text-xs">{avgRiskScore}%</span>
            </div>
            <div>
              Active exceptions: <span className="font-mono text-rose-600 font-extrabold block text-xs">
                {heatmapData.reduce((acc, d) => acc + d.anomalies.length, 0)} Flags
              </span>
            </div>
          </div>
        </div>

        {/* Right Hand: Selected Day Inspector Detail */}
        <div className="lg:col-span-4 bg-slate-50 rounded-2xl p-5 border border-slate-150 flex flex-col justify-between space-y-4">
          
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
              <div>
                <span className="text-[9px] uppercase font-black tracking-wider text-slate-400 block">Inspection Detail</span>
                <h4 className="font-extrabold text-slate-800 text-sm">August {selectedDay}, 2026</h4>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                selectedDayData.riskLevel === 'HIGH' 
                  ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                  : selectedDayData.riskLevel === 'MEDIUM' 
                  ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                  : selectedDayData.riskLevel === 'NONE'
                  ? 'bg-slate-100 text-slate-400'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}>
                {selectedDayData.riskLevel} Risk
              </span>
            </div>

            {/* Volume statistics list */}
            {selectedDayData.invoiceCount === 0 ? (
              <div className="text-center py-8 text-slate-400 italic text-[11px] space-y-1">
                <ShieldCheck size={28} className="mx-auto text-slate-300" />
                <p>No transactions billed on this date.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                    <span className="text-slate-400 font-bold block text-[9px]">INVOICE VOLUME</span>
                    <strong className="text-slate-900 font-black text-xs font-mono">{selectedDayData.invoiceCount} Transactions</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                    <span className="text-slate-400 font-bold block text-[9px]">COMPLIANCE INDEX</span>
                    <strong className={`font-black text-xs font-mono block ${
                      selectedDayData.riskLevel === 'HIGH' ? 'text-rose-600' : selectedDayData.riskLevel === 'MEDIUM' ? 'text-amber-600' : 'text-emerald-600'
                    }`}>{selectedDayData.riskScore}%</strong>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-3 border border-slate-200/60 space-y-1.5 text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Taxable Value:</span>
                    <span className="font-mono text-slate-800 font-bold">₹{selectedDayData.totalValue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Calculated GST:</span>
                    <span className="font-mono text-indigo-700 font-extrabold">₹{selectedDayData.gstLiability.toLocaleString()}</span>
                  </div>
                </div>

                {/* Anomalies Exception list block */}
                {selectedDayData.anomalies.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400 flex items-center gap-1">
                      <AlertTriangle size={11} className="text-rose-500 shrink-0" /> Anomalies Flagged ({selectedDayData.anomalies.length})
                    </span>
                    <div className="space-y-1.5">
                      {selectedDayData.anomalies.map((anom, idx) => (
                        <div key={idx} className="p-2 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg text-[10px] leading-relaxed font-medium">
                          {anom}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick link button */}
          {selectedDayData.invoiceCount > 0 && (
            <div className="pt-2">
              <button className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5">
                Inspect Transactions <ArrowRight size={12} />
              </button>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
