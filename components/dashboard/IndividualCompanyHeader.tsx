import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { Tenant, UserRole } from '../../types';
import { subscriptionManager } from '../../src/core/billing/SubscriptionManager';
import { 
  Building2, Layers, CheckCircle2, ChevronRight, ArrowLeft, 
  MapPin, ShieldCheck, TrendingUp, Filter, Sparkles, Building, Globe, Crown
} from 'lucide-react';
import { OperatingCompanySwitcher } from './OperatingCompanySwitcher';

interface IndividualCompanyHeaderProps {
  currentTenant: Tenant;
  availableTenants: Tenant[];
  onSelectTenant: (tenantId: string) => void;
  onSwitchToGroupDashboard: () => void;
  tenantStats: any;
  totalGroupSales: number;
}

export const IndividualCompanyHeader: React.FC<IndividualCompanyHeaderProps> = ({
  currentTenant,
  availableTenants,
  onSelectTenant,
  onSwitchToGroupDashboard,
  tenantStats,
  totalGroupSales
}) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  const subProfile = subscriptionManager.getUserSubscriptionProfile(user?.role, currentTenant.id);
  const canGroup = isSuperAdmin || (subProfile.canGroupConsolidation && availableTenants.length > 1);

  const currentSales = tenantStats?.sales || 0;
  const calculatedSalesShare = totalGroupSales > 0 ? Math.round((currentSales / totalGroupSales) * 100) : 0;
  const salesShare = currentTenant.revenueContributionPct || calculatedSalesShare;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
      {/* Top Breadcrumb & Switch To Group Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {canGroup ? (
            <>
              <button
                onClick={onSwitchToGroupDashboard}
                className="font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 transition-colors group cursor-pointer"
              >
                <Layers size={14} className="text-slate-400 group-hover:text-indigo-600" />
                <span>Group Level Dashboard</span>
              </button>
              <ChevronRight size={14} className="text-slate-300" />
            </>
          ) : (
            <>
              <span className="font-bold text-slate-500 flex items-center gap-1.5">
                <Building2 size={14} className="text-slate-400" />
                <span>Operating Workspace</span>
              </span>
              <ChevronRight size={14} className="text-slate-300" />
            </>
          )}
          <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            Individual Company View
          </span>
          <ChevronRight size={14} className="text-slate-300" />
          <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
            {currentTenant.name}
          </span>
        </div>

        {canGroup && (
          <button
            onClick={onSwitchToGroupDashboard}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200/80 transition-all shadow-xs shrink-0 cursor-pointer"
          >
            <ArrowLeft size={13} />
            <span>Back to Group Consolidated View</span>
          </button>
        )}
      </div>

      {/* Main Company Identity & Scalable Operating Company Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-blue-500/20 shrink-0">
            {currentTenant.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {currentTenant.name}
              </h2>

              {currentTenant.entityType && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                  {currentTenant.entityType}
                </span>
              )}

              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                GSTIN: {currentTenant.gstin}
              </span>

              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 size={11} /> {currentTenant.filingStatus === 'NEEDS_ATTENTION' ? 'Review Period' : 'Active Filer'}
              </span>

              {currentTenant.isSez && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center gap-1">
                  <Globe size={11} /> SEZ Developer / Unit
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1">
                <MapPin size={13} className="text-slate-400" />
                {currentTenant.address || 'Corporate Registered Office'}
              </span>
              <span className="font-mono text-slate-400">
                State: {currentTenant.stateName || currentTenant.stateCode} ({currentTenant.stateCode})
              </span>
              {currentTenant.sector && (
                <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold">
                  {currentTenant.sector}
                </span>
              )}
              {canGroup ? (
                <span className="flex items-center gap-1 text-blue-700 font-bold bg-blue-50/80 px-2 py-0.5 rounded border border-blue-100">
                  <TrendingUp size={12} />
                  {salesShare}% of Group Revenue
                </span>
              ) : (
                <span className="flex items-center gap-1 text-slate-700 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  <ShieldCheck size={12} className="text-emerald-600" />
                  Primary Operating Entity (Single Org Quota)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Scalable Operating Company Switcher supporting 10+ Entities */}
        <OperatingCompanySwitcher
          currentTenant={currentTenant}
          availableTenants={availableTenants}
          onSelectTenant={onSelectTenant}
          onSwitchToGroupDashboard={onSwitchToGroupDashboard}
          tenantStats={tenantStats}
          totalGroupSales={totalGroupSales}
        />
      </div>
    </div>
  );
};

