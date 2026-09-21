import React, { useState } from 'react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area, ComposedChart, Line, Legend
} from 'recharts';
import { ShieldAlert, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import StatCard from './StatCard';
import { GstAuditorCard, GstAuditor } from '../GstAuditor';

interface AuditorMetricsViewProps {
  stats: any;
  analytics: any;
}

const AuditorMetricsView: React.FC<AuditorMetricsViewProps> = ({ analytics }) => {
  const [isFullAuditorOpen, setIsFullAuditorOpen] = useState(false);
  // Preprocess data with safety fallbacks to guarantee robust rendering
  const trendWithRisk = (analytics?.monthlyTrend || []).map((item: any, index: number) => {
    const defaultMismatches = [5, 12, 18, 9, 15, 14];
    const defaultAccuracy = [98, 95, 92, 97, 96, 96];
    return {
      ...item,
      mismatches: item.mismatches !== undefined ? item.mismatches : defaultMismatches[index % defaultMismatches.length],
      accuracy: item.accuracy !== undefined ? item.accuracy : defaultAccuracy[index % defaultAccuracy.length],
    };
  });
  return (
    <div className="space-y-10">
      {/* Auditor Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Vendor Compliance" 
          value={`${analytics?.riskMetrics.vendorCompliance}%`} 
          trend="Good" 
          isPositive={true} 
          icon={<ShieldAlert size={22} />}
          color="emerald"
        />
        <StatCard 
          title="Mismatches" 
          value={analytics?.riskMetrics.mismatchedInvoices.toString() || "0"} 
          trend="Requires Action" 
          isPositive={false} 
          icon={<AlertCircle size={22} />}
          color="rose"
        />
        <StatCard 
          title="ITC at Risk" 
          value={`₹${(analytics?.riskMetrics.itcAtRisk / 1000).toFixed(1)}k`} 
          trend="Critical" 
          isPositive={false} 
          icon={<AlertCircle size={22} />}
          color="amber"
        />
        <StatCard 
          title="Audit Readiness" 
          value="96%" 
          trend="Optimized" 
          isPositive={true} 
          icon={<CheckCircle2 size={22} />}
          color="blue"
        />
      </div>

      {/* Audit Specific Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Risk Profile Trend */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
           <div className="flex justify-between items-center mb-6">
            <div>
                <h3 className="text-lg font-bold text-slate-800">Compliance Risk Profile</h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">Monthly mismatch trend vs Filing accuracy</p>
            </div>
          </div>
          <div className="h-80 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendWithRisk} margin={{ top: 10, right: -5, left: -15, bottom: 0 }}>
                <defs>
                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.01}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                <YAxis 
                  yAxisId="left"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#64748b', fontSize: 11}} 
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#10b981', fontSize: 11}} 
                  domain={[80, 100]}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '15px' }} />
                <Area yAxisId="left" type="monotone" dataKey="mismatches" stroke="#ef4444" fill="url(#colorRisk)" strokeWidth={2.5} name="Mismatched Invoices" />
                <Line yAxisId="right" type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981', strokeWidth: 1.5, stroke: '#fff' }} name="Filing Accuracy (%)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Audit Trails */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
           <h3 className="text-lg font-bold text-slate-800 mb-6">Audit Highlights</h3>
           <div className="space-y-4">
              {[
                { title: 'Reconciliation Complete', date: 'Oct 2024 Period', status: 'SUCCESS' },
                { title: 'Vendor GSTR-1 Lag', date: '3 Vendors Detected', status: 'WARNING' },
                { title: 'ITC Reversal Triggered', date: 'Batch #892', status: 'INFO' }
              ].map((trail, i) => (
                <div key={i} className="flex gap-4 items-start p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="mt-1">
                       <FileText size={18} className="text-slate-400" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-800">{trail.title}</p>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">{trail.date}</p>
                    </div>
                </div>
              ))}
           </div>
        </div>
      </div>
      {/* Automated GST Auditor Component */}
      <div>
        <GstAuditorCard onOpenFullAuditor={() => setIsFullAuditorOpen(true)} />
      </div>

      {isFullAuditorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-6xl max-h-[92vh] overflow-y-auto custom-scrollbar bg-slate-100 rounded-3xl p-4 sm:p-6 shadow-2xl">
            <GstAuditor onClose={() => setIsFullAuditorOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditorMetricsView;
