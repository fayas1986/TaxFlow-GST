import React from 'react';
import { PlanUsageDashboard } from '../components/PlanUsageDashboard';
import { Shield, Sparkles, HelpCircle } from 'lucide-react';

export const PlanUsagePage: React.FC = () => {
  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/80">
              Subscription & Quota Management
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Plan Entitlements & Live Usage
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor real-time consumption against statutory limits, invoices filed, user seats, and cloud vault storage.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync Active
          </div>
        </div>
      </div>

      {/* Main Usage Dashboard Component */}
      <PlanUsageDashboard />
    </div>
  );
};

export default PlanUsagePage;
