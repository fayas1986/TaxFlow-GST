import React, { useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, switchTenant, setSelectedGstin, setSelectedBranch } from '../../store/store';
import { Tenant, UserRole } from '../../types';
import { subscriptionManager } from '../../src/core/billing/SubscriptionManager';
import { 
  Layers, Building, CheckCircle2, TrendingUp, ShieldCheck, 
  ArrowUpRight, IndianRupee, Percent, Plus, MapPin, GitBranch, Check,
  Search, Filter, ChevronRight, ChevronDown, ChevronUp, Sparkles, Building2, AlertTriangle,
  Lock, Crown, Zap, Shield
} from 'lucide-react';

interface GstinEntitySwitcherProps {
  availableTenants: Tenant[];
  selectedEntityId: string; // 'AGGREGATE' or specific tenantId
  onSelectEntity: (id: string) => void;
  allTenantStats: { [tenantId: string]: any };
}

export const GstinEntitySwitcher: React.FC<GstinEntitySwitcherProps> = ({
  availableTenants = [],
  selectedEntityId,
  onSelectEntity,
  allTenantStats
}) => {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const selectedGstin = useSelector((state: RootState) => state.org.selectedGstin);
  const selectedBranchId = useSelector((state: RootState) => state.org.selectedBranchId);
  const gstinsByTenant = useSelector((state: RootState) => state.org.gstinsByTenant);
  const branchesByTenant = useSelector((state: RootState) => state.org.branchesByTenant);

  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  const subProfile = subscriptionManager.getUserSubscriptionProfile(user?.role, user?.currentTenantId);
  const canGroup = isSuperAdmin || (subProfile.canGroupConsolidation && availableTenants.length > 1);
  const isStarterPlan = !isSuperAdmin && subProfile.maxCompanies <= 1;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [isExpanded, setIsExpanded] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  
  // Calculate aggregate metrics
  let totalSales = 0;
  let totalLiability = 0;
  let totalItc = 0;
  
  Object.keys(allTenantStats).forEach(tid => {
    const s = allTenantStats[tid];
    if (s) {
      totalSales += s.sales || 0;
      totalLiability += s.liability || 0;
      totalItc += s.itc || 0;
    }
  });

  const handleSelect = (id: string) => {
    if (id === 'AGGREGATE' && !canGroup) {
      setUpgradeMessage('Consolidated Group Reporting requires a Business Growth or Enterprise plan.');
      setTimeout(() => setUpgradeMessage(null), 4000);
      return;
    }
    onSelectEntity(id);
    if (id !== 'AGGREGATE') {
      // Keep global tenant state in sync for multi-page continuity
      dispatch(switchTenant(id));
      dispatch(setSelectedGstin('ALL'));
      dispatch(setSelectedBranch('ALL'));
    }
  };

  const currentGstins = selectedEntityId !== 'AGGREGATE' 
    ? (gstinsByTenant[selectedEntityId] || [])
    : [];
  const currentBranches = selectedEntityId !== 'AGGREGATE'
    ? (branchesByTenant[selectedEntityId] || [])
    : [];

  // Allowed operating tenants based on quota
  const accessibleTenants = useMemo(() => {
    if (isSuperAdmin || subProfile.canGroupConsolidation) {
      return availableTenants;
    }
    return availableTenants.slice(0, subProfile.maxCompanies);
  }, [availableTenants, isSuperAdmin, subProfile]);

  // Sectors for quick filter
  const sectors = useMemo(() => {
    const s = new Set<string>();
    accessibleTenants.forEach(t => {
      if (t.sector) s.add(t.sector);
    });
    return Array.from(s);
  }, [accessibleTenants]);

  // Filtered tenants
  const filteredTenants = useMemo(() => {
    return accessibleTenants.filter(t => {
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
  }, [accessibleTenants, searchQuery, selectedSector]);

  // Display subset or full set based on expand/search state
  const displayedTenants = useMemo(() => {
    if (searchQuery.trim() || selectedSector !== 'ALL' || isExpanded) {
      return filteredTenants;
    }
    return filteredTenants.slice(0, 3);
  }, [filteredTenants, searchQuery, selectedSector, isExpanded]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers className="text-indigo-600" size={18} /> Entity & Multi-GSTIN Enterprise Switchboard
            </h3>
            <span className="text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
              {availableTenants.length} Entities Mapped
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Toggle between corporate aggregate views or specific state-wise GSTIN nodes and regional branches for granular transactional analysis.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500">Active Scope:</span>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
            selectedEntityId === 'AGGREGATE' && selectedGstin === 'ALL' && selectedBranchId === 'ALL'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
            {selectedEntityId === 'AGGREGATE' ? 'Consolidated Group View' : `Active Node: ${availableTenants.find(t => t.id === selectedEntityId)?.name || selectedEntityId}`}
          </span>
          {selectedGstin !== 'ALL' && (
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-mono font-bold">
              {selectedGstin}
            </span>
          )}
          {selectedBranchId !== 'ALL' && (
            <span className="px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1">
              <MapPin size={11} /> Branch Filter Active
            </span>
          )}
        </div>
      </div>

      {/* Search & Category Filter Toolbar for 10+ Entities */}
      {availableTenants.length > 3 && (
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter by name, GSTIN (e.g. 27...), state, or sector..."
              className="w-full pl-9 pr-3 py-1.5 bg-white text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedSector('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all ${
                selectedSector === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              All Sectors
            </button>
            {sectors.slice(0, 4).map(sec => (
              <button
                key={sec}
                onClick={() => setSelectedSector(sec)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all ${
                  selectedSector === sec
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                }`}
              >
                {sec}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid of Switcher Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* CARD 1: AGGREGATE ACCOUNT VIEW OR SINGLE ORG UPGRADE PROMO */}
        {canGroup ? (
          <div 
            onClick={() => {
              handleSelect('AGGREGATE');
              dispatch(setSelectedGstin('ALL'));
              dispatch(setSelectedBranch('ALL'));
            }}
            className={`cursor-pointer rounded-xl p-4 sm:p-5 border-2 transition-all relative overflow-hidden flex flex-col justify-between ${
              selectedEntityId === 'AGGREGATE' && selectedGstin === 'ALL'
                ? 'border-indigo-600 bg-indigo-50/30 shadow-md ring-1 ring-indigo-600'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 bg-white'
            }`}
          >
            {selectedEntityId === 'AGGREGATE' && selectedGstin === 'ALL' && (
              <div className="absolute top-3 right-3 text-indigo-600">
                <CheckCircle2 size={18} className="fill-indigo-100" />
              </div>
            )}
            
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <Layers size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Aggregate View</h4>
                  <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">ALL {availableTenants.length} MAPPED ENTITIES</p>
                </div>
              </div>

              <div className="pt-2 grid grid-cols-2 gap-2 border-t border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Group Sales</span>
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900">₹{totalSales.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Avg Compliance</span>
                  <span className="text-xs sm:text-sm font-extrabold text-emerald-600 flex items-center gap-1">
                    <ShieldCheck size={13} /> 98.4%
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Consolidated Rollup</span>
              <span className="text-indigo-600 flex items-center gap-0.5 font-bold">Focus &rarr;</span>
            </div>
          </div>
        ) : null}

        {/* CARDS 2+: INDIVIDUAL GSTIN TENANTS */}
        {displayedTenants.map((tenant) => {
          const stats = allTenantStats[tenant.id] || { sales: 0, liability: 0, itc: 0 };
          const salesContr = tenant.revenueContributionPct || (totalSales > 0 ? Math.round((stats.sales / totalSales) * 100) : 0);
          const isSelected = selectedEntityId === tenant.id;
          const score = tenant.complianceScore || 98;
          const tenantGstinList = gstinsByTenant[tenant.id] || [];

          return (
            <div 
              key={tenant.id}
              onClick={() => handleSelect(tenant.id)}
              className={`cursor-pointer rounded-xl p-4 sm:p-5 border-2 transition-all relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? 'border-blue-600 bg-blue-50/30 shadow-md ring-1 ring-blue-600'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 bg-white'
              }`}
            >
              {isSelected && (
                <div className="absolute top-3 right-3 text-blue-600">
                  <CheckCircle2 size={18} className="fill-blue-100" />
                </div>
              )}

              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                    isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}>
                    {tenant.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 pr-4">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate" title={tenant.name}>{tenant.name}</h4>
                    <p className="text-[10px] text-slate-500 font-mono tracking-wider truncate">{tenant.gstin}</p>
                  </div>
                </div>

                <div className="pt-2 grid grid-cols-2 gap-2 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Gross Sales</span>
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                      ₹{stats.sales > 0 ? stats.sales.toLocaleString('en-IN') : (tenant.annualTurnover ? (tenant.annualTurnover / 12).toLocaleString('en-IN') : '1.5M')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Rating</span>
                    <span className={`text-xs sm:text-sm font-extrabold flex items-center gap-1 ${
                      score >= 97 ? 'text-emerald-600' : 'text-amber-600'
                    }`}>
                      <ShieldCheck size={13} /> {score}%
                    </span>
                  </div>
                </div>

                {/* Contribution visualizer */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400">
                    <span>{canGroup ? 'GROUP SHARE' : 'TURNOVER ALLOCATION'}</span>
                    <span className="text-slate-700">{canGroup ? `${salesContr}%` : '100% (Primary)'}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isSelected ? 'bg-blue-600' : 'bg-indigo-500'
                      }`}
                      style={{ width: canGroup ? `${salesContr}%` : '100%' }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500">
                <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">
                  {subProfile.canMultiGstin && tenantGstinList.length > 0 
                    ? `${tenantGstinList.length} GSTINs` 
                    : `${tenant.stateCode} Primary HQ (1 GSTIN)`}
                </span>
                <span className="text-blue-600 hover:underline text-xs flex items-center gap-0.5 font-bold">
                  {isSelected ? 'Active' : 'Select'} &rarr;
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {upgradeMessage && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-900 flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-600 shrink-0" />
            <span>{upgradeMessage}</span>
          </div>
          <button 
            onClick={() => setUpgradeMessage(null)}
            className="text-indigo-600 hover:text-indigo-900 text-xs font-bold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Expand/Collapse Toggle for 10+ Entities */}
      {accessibleTenants.length > 3 && !searchQuery && selectedSector === 'ALL' && (
        <div className="text-center pt-1 border-t border-slate-100">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200/80 transition-all shadow-xs"
          >
            {isExpanded ? (
              <>
                <ChevronUp size={15} />
                <span>Show Fewer Entities</span>
              </>
            ) : (
              <>
                <ChevronDown size={15} />
                <span>View All {accessibleTenants.length} Corporate Operating Subsidiaries</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* State-Wise Registrations & Branch Quick Filters if an entity is focused */}
      {selectedEntityId !== 'AGGREGATE' && currentGstins.length > 0 && (
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
              <Building size={14} className="text-indigo-600" />
              State GSTIN Registrations ({subProfile.canMultiGstin ? currentGstins.length : 1} Active)
            </span>
            {selectedGstin !== 'ALL' && (
              <button 
                onClick={() => {
                  dispatch(setSelectedGstin('ALL'));
                  dispatch(setSelectedBranch('ALL'));
                }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
              >
                Clear GSTIN Filter (Show All)
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                dispatch(setSelectedGstin('ALL'));
                dispatch(setSelectedBranch('ALL'));
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                selectedGstin === 'ALL'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Layers size={13} />
              <span>All Registered States</span>
            </button>

            {currentGstins
              .filter((g, idx) => subProfile.canMultiGstin || g.isPrimary || idx === 0)
              .map((g) => {
                const isGstinActive = selectedGstin === g.gstin;

                return (
                  <button
                    key={g.id}
                    onClick={() => {
                      dispatch(setSelectedGstin(g.gstin));
                      dispatch(setSelectedBranch('ALL'));
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                      isGstinActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-mono">{g.stateCode}</span>
                    <span>{g.stateName}</span>
                    {g.isPrimary && <span className={`text-[9px] px-1 rounded ${isGstinActive ? 'bg-indigo-800 text-indigo-200' : 'bg-amber-100 text-amber-800'}`}>HQ</span>}
                    {isGstinActive && <Check size={12} strokeWidth={3} />}
                  </button>
                );
              })}
          </div>

          {/* Regional Branches Under Selected Registration */}
          {currentBranches.length > 0 && (
            <div className="pt-2 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <MapPin size={12} /> Regional Branches:
              </span>
              <button
                onClick={() => dispatch(setSelectedBranch('ALL'))}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  selectedBranchId === 'ALL'
                    ? 'bg-slate-800 text-white font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Branches
              </button>
              {currentBranches
                .filter(b => selectedGstin === 'ALL' || b.gstin === selectedGstin)
                .filter((branch, idx) => subProfile.canMultiBranch || idx === 0)
                .map((branch) => {
                  return (
                    <button
                      key={branch.id}
                      onClick={() => {
                        dispatch(setSelectedBranch(branch.id));
                        if (selectedGstin === 'ALL' && branch.gstin) {
                          dispatch(setSelectedGstin(branch.gstin));
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 transition-all ${
                        selectedBranchId === branch.id
                          ? 'bg-indigo-50 text-indigo-900 border border-indigo-200 font-bold shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>{branch.name}</span>
                      <span className="text-[10px] opacity-70">({branch.code})</span>
                    </button>
                  );
                })
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
};
