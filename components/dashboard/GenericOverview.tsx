import React from 'react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';
import { Calendar, Clock, CheckCircle2, Activity, ArrowUpRight } from 'lucide-react';
import StatCard from './StatCard';

interface GenericOverviewProps {
  stats: any;
  analytics: any;
  filings: any;
  canAct: boolean;
}

const GenericOverview: React.FC<GenericOverviewProps> = ({ stats, filings, canAct, analytics }) => {
  return (
    <div className="space-y-10">
      {/* Basic Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Sales" 
          value={`₹${(stats?.sales || 0).toLocaleString()}`} 
          trend="12.5%" 
          isPositive={true} 
          icon={<Activity size={22} />}
          color="blue"
        />
        <StatCard 
          title="ITC Available" 
          value={`₹${(stats?.itc || 0).toLocaleString()}`} 
          trend="5.2%" 
          isPositive={true} 
          icon={<CheckCircle2 size={22} />}
          color="emerald"
        />
        <StatCard 
          title="Compliance Score" 
          value="92/100" 
          trend="Stable" 
          isPositive={true} 
          icon={<Activity size={22} />}
          color="blue"
        />
        <StatCard 
          title="Next Deadline" 
          value="15 Nov" 
          trend="GSTR-3B" 
          isPositive={true} 
          icon={<Calendar size={22} />}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Operational Feed */}
        <div className="lg:col-span-2 space-y-8">
            {/* Trend Summary */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
               <h3 className="text-lg font-bold text-slate-800 mb-6">Filing Performance</h3>
               <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics?.monthlyTrend || []}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                       <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                       <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                       <Tooltip />
                       <Area type="monotone" dataKey="sales" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Recent Updates</h3>
                <div className="space-y-6">
                    {[
                      { title: 'GSTR-1 Filed', time: '2h ago', color: 'bg-blue-500', sub: 'Oct 2024 Return' },
                      { title: 'ITC Reconciled', time: '1d ago', color: 'bg-emerald-500', sub: 'Batch #4092' }
                    ].map((item, i) => (
                      <div key={i} className="flex gap-4 items-start group">
                          <div className={`w-2 h-2 rounded-full ${item.color} mt-2 shadow-sm`}></div>
                          <div className="flex-1">
                              <p className="text-sm font-bold text-slate-800">{item.title}</p>
                              <div className="flex justify-between items-center mt-1">
                                <p className="text-xs text-slate-500 font-medium">{item.sub}</p>
                                <p className="text-[10px] text-slate-400">{item.time}</p>
                              </div>
                          </div>
                      </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-8">
            {/* Filing Deadlines */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col relative overflow-hidden group">
               <h3 className="font-bold text-lg text-slate-900 mb-6">Upcoming Filings</h3>
               <div className="space-y-4 flex-1">
                   {filings
                      ?.filter((f: any) => f.status !== 'FILED')
                      .slice(0, 3)
                      .map((filing: any) => {
                          const daysLeft = Math.ceil((new Date(filing.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                          return (
                            <div key={filing.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{filing.type}</p>
                                        <p className="text-sm font-bold text-slate-800">{filing.period}</p>
                                    </div>
                                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${daysLeft <= 3 ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {daysLeft}d
                                    </div>
                                </div>
                            </div>
                          );
                      })
                   }
               </div>
               <button 
                  onClick={() => window.location.hash = '#/filing'}
                  className="w-full mt-6 pt-3 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors flex items-center justify-center gap-2 group/btn"
                >
                   View Calendar <ArrowUpRight size={16} />
               </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default GenericOverview;
