import React, { useState, useMemo } from 'react';
import { Tenant } from '../../types';
import { 
  Building, CheckCircle2, AlertTriangle, ArrowRight, TrendingUp, 
  ShieldCheck, ArrowUpRight, Scale, Layers, Search, Filter
} from 'lucide-react';

interface SubsidiaryPerformanceMatrixProps {
  availableTenants: Tenant[];
  allTenantStats: { [tenantId: string]: any };
  allTenantAnalytics: { [tenantId: string]: any };
  allTenantFilings: { [tenantId: string]: any[] };
  onSelectCompany: (tenantId: string) => void;
}

export const SubsidiaryPerformanceMatrix: React.FC<SubsidiaryPerformanceMatrixProps> = ({
  availableTenants,
  allTenantStats,
  allTenantAnalytics,
  allTenantFilings,
  onSelectCompany
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');

  // Compute group totals
  let totalSales = 0;
  let totalLiability = 0;
  let totalItc = 0;

  availableTenants.forEach(t => {
    const s = allTenantStats[t.id];
    if (s) {
      totalSales += s.sales || 0;
      totalLiability += s.liability || 0;
      totalItc += s.itc || 0;
    }
  });

  const sectors = useMemo(() => {
    const s = new Set<string>();
    availableTenants.forEach(t => {
      if (t.sector) s.add(t.sector);
    });
    return Array.from(s);
  }, [availableTenants]);

  const filteredTenants = useMemo(() => {
    return availableTenants.filter(t => {
      if (selectedSector !== 'ALL' && t.sector !== selectedSector) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        t.name.toLowerCase().includes(q) ||
        t.gstin.toLowerCase().includes(q) ||
        (t.stateName || '').toLowerCase().includes(q) ||
        t.stateCode.toLowerCase().includes(q) ||
        (t.sector || '').toLowerCase().includes(q)
      );
    });
  }, [availableTenants, searchQuery, selectedSector]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
            <Scale size={22} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              Subsidiary Operating Performance Matrix
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {availableTenants.length} Companies
              </span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Cross-company comparison of revenue contribution, ITC utilization, tax obligations, and compliance health.
            </p>
          </div>
        </div>

        {/* Search input if 5+ entities */}
        {availableTenants.length > 4 && (
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search companies, GSTIN, states..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
          </div>
        )}
      </div>

      {/* Sector filter tabs if present */}
      {sectors.length > 0 && availableTenants.length > 4 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Filter size={11} /> Sector:
          </span>
          <button
            onClick={() => setSelectedSector('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all ${
              selectedSector === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 border border-slate-200/60'
            }`}
          >
            All Sectors ({availableTenants.length})
          </button>
          {sectors.map(sec => {
            const count = availableTenants.filter(t => t.sector === sec).length;
            return (
              <button
                key={sec}
                onClick={() => setSelectedSector(sec)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all ${
                  selectedSector === sec
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 border border-slate-200/60'
                }`}
              >
                {sec} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Desktop Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider bg-slate-50/50">
              <th className="py-3 px-4 rounded-l-xl">Company & GSTIN</th>
              <th className="py-3 px-4">State & Region</th>
              <th className="py-3 px-4">Gross Sales (% Share)</th>
              <th className="py-3 px-4">ITC Available</th>
              <th className="py-3 px-4">Net Liability</th>
              <th className="py-3 px-4">Filing Status</th>
              <th className="py-3 px-4">Compliance Health</th>
              <th className="py-3 px-4 text-right rounded-r-xl">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTenants.map((tenant, idx) => {
              const stats = allTenantStats[tenant.id] || { sales: 0, liability: 0, itc: 0 };
              const salesShare = tenant.revenueContributionPct || (totalSales > 0 ? Math.round((stats.sales / totalSales) * 100) : 0);
              const liabilityShare = totalLiability > 0 ? Math.round((stats.liability / totalLiability) * 100) : 0;
              const filings = allTenantFilings[tenant.id] || [];
              const pendingFilings = filings.filter((f: any) => f.status !== 'FILED');
              const healthScore = tenant.complianceScore || (idx === 0 ? 98 : 94);

              return (
                <tr 
                  key={tenant.id}
                  className="hover:bg-indigo-50/30 transition-colors group cursor-pointer"
                  onClick={() => onSelectCompany(tenant.id)}
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xs">
                        <Building size={16} />
                      </div>
                      <div>
                        <span className="font-extrabold text-slate-900 block group-hover:text-indigo-700 transition-colors text-sm">
                          {tenant.name}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 font-medium">{tenant.gstin}</span>
                      </div>
                    </div>
                  </td>

                  <td className="py-4 px-4">
                    <span className="font-medium text-slate-700 block">{tenant.stateName || tenant.address?.split(',')[1] || 'Headquarters'}</span>
                    <span className="text-[10px] font-mono text-slate-400">Code: {tenant.stateCode}</span>
                  </td>

                  <td className="py-4 px-4">
                    <span className="font-mono font-extrabold text-slate-900 block text-sm">
                      ₹{(stats.sales || 0).toLocaleString('en-IN')}
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${salesShare}%` }}></div>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-600">{salesShare}%</span>
                    </div>
                  </td>

                  <td className="py-4 px-4">
                    <span className="font-mono font-extrabold text-emerald-700 block">
                      ₹{(stats.itc || 0).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Input Tax Credit</span>
                  </td>

                  <td className="py-4 px-4">
                    <span className="font-mono font-extrabold text-amber-800 block">
                      ₹{(stats.liability || 0).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">{liabilityShare}% of Group Net</span>
                  </td>

                  <td className="py-4 px-4">
                    {pendingFilings.length === 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={11} /> Returns Filed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle size={11} /> {pendingFilings.length} In Progress
                      </span>
                    )}
                  </td>

                  <td className="py-4 px-4">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-emerald-600" />
                      <span className="font-mono font-bold text-slate-800">{healthScore}%</span>
                      <span className="text-[10px] text-emerald-600 font-semibold">(Optimal)</span>
                    </div>
                  </td>

                  <td className="py-4 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCompany(tenant.id);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-indigo-600 text-slate-700 hover:text-white transition-all shadow-xs group-hover:bg-indigo-600 group-hover:text-white"
                    >
                      <span>Open Company Dashboard</span>
                      <ArrowRight size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cross-Entity Summary Callout */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <Layers size={16} className="text-indigo-600 shrink-0" />
          <span>
            Group Consolidated Rollup: <strong className="text-slate-900">₹{totalSales.toLocaleString('en-IN')}</strong> total revenue across {availableTenants.length} operating subsidiaries with <strong className="text-slate-900">₹{totalLiability.toLocaleString('en-IN')}</strong> combined net tax obligation.
          </span>
        </div>
        <span className="text-[11px] font-bold text-slate-500 shrink-0">
          Click any company to open its isolated operational dashboard
        </span>
      </div>
    </div>
  );
};
