import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  trend: string;
  isPositive: boolean;
  icon: React.ReactNode;
  color?: string;
  subtitle?: string;
}

const colorStyles: Record<string, { bgIcon: string; badge: string; accentBorder: string }> = {
  blue: {
    bgIcon: 'bg-blue-900 text-white shadow-blue-900/10',
    badge: 'bg-blue-50 text-blue-800 border-blue-200',
    accentBorder: 'bg-blue-600',
  },
  emerald: {
    bgIcon: 'bg-emerald-800 text-white shadow-emerald-900/10',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    accentBorder: 'bg-emerald-600',
  },
  amber: {
    bgIcon: 'bg-amber-800 text-white shadow-amber-900/10',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    accentBorder: 'bg-amber-500',
  },
  rose: {
    bgIcon: 'bg-rose-900 text-white shadow-rose-900/10',
    badge: 'bg-rose-50 text-rose-800 border-rose-200',
    accentBorder: 'bg-rose-600',
  },
  indigo: {
    bgIcon: 'bg-indigo-900 text-white shadow-indigo-900/10',
    badge: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    accentBorder: 'bg-indigo-600',
  },
  slate: {
    bgIcon: 'bg-slate-900 text-white shadow-slate-900/10',
    badge: 'bg-slate-100 text-slate-800 border-slate-200',
    accentBorder: 'bg-slate-700',
  }
};

const StatCard: React.FC<StatCardProps> = ({ title, value, trend, isPositive, icon, color = 'slate', subtitle }) => {
  const currentStyle = colorStyles[color] || colorStyles.slate;

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all duration-200 group relative overflow-hidden flex flex-col justify-between min-h-[176px]">
      {/* Corporate Top Accent Line */}
      <div className={`absolute top-0 inset-x-0 h-1 ${currentStyle.accentBorder}`}></div>
      
      <div>
        <div className="flex justify-between items-start mb-3 relative z-10">
          <div className={`w-11 h-11 rounded-xl ${currentStyle.bgIcon} flex items-center justify-center shadow-xs shrink-0`}>
            {icon}
          </div>
          
          <div className={`flex items-center gap-1.5 text-[11px] font-bold tracking-wide px-2.5 py-1 rounded-lg border whitespace-nowrap ${
              isPositive 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            <span>{trend}</span>
          </div>
        </div>

        <div className="space-y-1 relative z-10">
          <h3 className="text-slate-500 text-[11px] font-bold tracking-wider uppercase">{title}</h3>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">{value}</div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-medium flex items-center justify-between gap-2">
        <span className="truncate">{subtitle || 'Consolidated metric overview'}</span>
        <span className="text-slate-400 font-bold shrink-0 text-[10px] uppercase">MoM</span>
      </div>
    </div>
  );
};

export default StatCard;
