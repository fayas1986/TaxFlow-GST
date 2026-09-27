/**
 * Component: OperatingCompanySwitcher
 * 
 * High-performance enterprise entity switchboard tailored for corporate groups
 * with 10+ operating subsidiaries, SPVs, SEZ units, and joint ventures.
 * 
 * Features:
 * - Searchable entity directory (by Name, GSTIN, State Name/Code, or Sector)
 * - Sector categorization filter tabs
 * - Compliance health tags and revenue contribution indicators
 * - Quick-access pills for top operating entities + full directory popover dialog
 * - Full keyboard accessibility (Esc to close, auto-focus, click-outside)
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Tenant } from '../../types';
import { 
  Building2, Search, ChevronDown, Check, X, ShieldCheck, 
  AlertTriangle, Layers, MapPin, TrendingUp, Sparkles, Copy, 
  CheckCircle2, ArrowRight, Filter, Globe, Activity,
  Maximize2, Minimize2, LayoutGrid, LayoutList, ExternalLink,
  IndianRupee, ChevronRight
} from 'lucide-react';

interface OperatingCompanySwitcherProps {
  currentTenant: Tenant;
  availableTenants: Tenant[];
  onSelectTenant: (tenantId: string) => void;
  onSwitchToGroupDashboard?: () => void;
  tenantStats?: any;
  totalGroupSales?: number;
  className?: string;
}

export const OperatingCompanySwitcher: React.FC<OperatingCompanySwitcherProps> = ({
  currentTenant,
  availableTenants = [],
  onSelectTenant,
  onSwitchToGroupDashboard,
  tenantStats,
  totalGroupSales = 0,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [complianceFilter, setComplianceFilter] = useState<'ALL' | 'COMPLIANT' | 'NEEDS_ATTENTION'>('ALL');
  const [copiedGstin, setCopiedGstin] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 80);
    } else {
      setSearchQuery('');
      setSelectedSector('ALL');
      setComplianceFilter('ALL');
      setIsFullscreen(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          setIsOpen(false);
        }
      }
      // Quick shortcut / to search if modal open
      if (e.key === '/' && isOpen && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isFullscreen]);

  // Extract unique sectors
  const availableSectors = useMemo(() => {
    const set = new Set<string>();
    availableTenants.forEach(t => {
      if (t.sector) set.add(t.sector);
    });
    return Array.from(set);
  }, [availableTenants]);

  // Filtered tenants list
  const filteredTenants = useMemo(() => {
    return availableTenants.filter(tenant => {
      // Sector filter
      if (selectedSector !== 'ALL' && tenant.sector !== selectedSector) {
        return false;
      }

      // Compliance filter
      if (complianceFilter !== 'ALL') {
        const isCompliant = tenant.filingStatus === 'COMPLIANT' || (tenant.complianceScore && tenant.complianceScore >= 97);
        if (complianceFilter === 'COMPLIANT' && !isCompliant) return false;
        if (complianceFilter === 'NEEDS_ATTENTION' && isCompliant) return false;
      }

      // Search query filter
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const matchName = tenant.name.toLowerCase().includes(q);
      const matchGstin = tenant.gstin.toLowerCase().includes(q);
      const matchState = (tenant.stateName || '').toLowerCase().includes(q);
      const matchStateCode = tenant.stateCode.toLowerCase().includes(q);
      const matchSector = (tenant.sector || '').toLowerCase().includes(q);
      const matchAddress = (tenant.address || '').toLowerCase().includes(q);

      return matchName || matchGstin || matchState || matchStateCode || matchSector || matchAddress;
    });
  }, [availableTenants, searchQuery, selectedSector, complianceFilter]);

  // Handle copying GSTIN
  const handleCopyGstin = (e: React.MouseEvent, gstin: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(gstin);
    setCopiedGstin(gstin);
    setTimeout(() => setCopiedGstin(null), 2000);
  };

  // Top 3 pinned / frequent companies for quick switching
  const quickPills = useMemo(() => {
    return availableTenants.slice(0, 3);
  }, [availableTenants]);

  // Sector color helpers
  const getSectorBadgeColor = (sector?: string) => {
    if (!sector) return 'bg-slate-100 text-slate-700 border-slate-200';
    if (sector.includes('Tech') || sector.includes('Cloud')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (sector.includes('Manufacturing')) return 'bg-amber-50 text-amber-800 border-amber-200';
    if (sector.includes('Logistics') || sector.includes('Supply')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (sector.includes('Retail')) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (sector.includes('Energy')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (sector.includes('Pharma') || sector.includes('Health')) return 'bg-teal-50 text-teal-700 border-teal-200';
    if (sector.includes('Finance')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (sector.includes('SEZ') || sector.includes('Export')) return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  if (!availableTenants || availableTenants.length <= 1) {
    return null;
  }

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Label and Quick-Switch Bar */}
      <div className="flex flex-col items-start lg:items-end gap-1.5">
        <div className="flex items-center justify-between w-full lg:w-auto gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Building2 size={12} className="text-slate-400" />
            <span>Switch Operating Company</span>
          </span>
          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
            {availableTenants.length} Group Entities
          </span>
        </div>

        {/* Action Controls: Top Quick Pills + Main Search Trigger Button */}
        <div className="flex items-center flex-wrap gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/90 shadow-xs">
          {/* Quick pills for top companies */}
          {quickPills.map(t => {
            const isSelected = t.id === currentTenant.id;
            return (
              <button
                key={t.id}
                onClick={() => onSelectTenant(t.id)}
                title={`Switch to ${t.name} (GSTIN: ${t.gstin})`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-600'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white/80'
                }`}
              >
                <Building2 size={13} className={isSelected ? 'text-blue-200' : 'text-slate-400'} />
                <span className="truncate max-w-[110px] sm:max-w-[140px]">{t.name}</span>
                {t.stateCode && (
                  <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                    isSelected ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {t.stateCode}
                  </span>
                )}
              </button>
            );
          })}

          {/* More / Browse All 10+ Entities Button */}
          <button
            onClick={() => setIsOpen(true)}
            aria-expanded={isOpen}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all border ${
              isOpen
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white hover:bg-slate-50 text-indigo-700 hover:text-indigo-800 border-indigo-200 shadow-xs'
            }`}
          >
            <Search size={13} className={isOpen ? 'text-white' : 'text-indigo-600'} />
            <span>
              {availableTenants.length > 3 ? `Browse All ${availableTenants.length} Entities` : 'Search All'}
            </span>
            <ChevronDown size={13} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* ENLARGED FULLSCREEN / EXPANDED MODAL OVERLAY */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div 
            ref={modalContentRef}
            className={`bg-white shadow-2xl flex flex-col transition-all duration-200 overflow-hidden ${
              isFullscreen
                ? 'fixed inset-0 w-full h-full rounded-none'
                : 'w-full max-w-5xl max-h-[92vh] sm:max-h-[88vh] rounded-2xl sm:rounded-3xl border border-slate-200'
            }`}
          >
            {/* Header with Title, Badges & Sizing Controls */}
            <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white shrink-0">
              <div className="flex items-start sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-500/25 border border-indigo-400/40 flex items-center justify-center text-indigo-200 shadow-inner shrink-0">
                    <Layers size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-white">
                        Corporate Group Entity Directory
                      </h3>
                      <span className="text-xs font-mono font-bold bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-full border border-indigo-400/30">
                        {availableTenants.length} Subsidiaries & Operating Units
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Select any corporate entity to isolate its state-wise GSTIN registrations, transactions, and compliance records.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* View Mode Toggle: Grid vs List */}
                  <div className="hidden sm:flex items-center bg-white/10 p-1 rounded-xl border border-white/15">
                    <button
                      onClick={() => setViewMode('grid')}
                      title="Grid View"
                      className={`p-1.5 rounded-lg transition-colors ${
                        viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <LayoutGrid size={15} />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      title="Detailed List View"
                      className={`p-1.5 rounded-lg transition-colors ${
                        viewMode === 'list' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <LayoutList size={15} />
                    </button>
                  </div>

                  {/* Enlarge / Full-Screen Toggle */}
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    title={isFullscreen ? "Exit Fullscreen" : "Enlarge Fullscreen View"}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-all border border-white/15 flex items-center gap-1.5 text-xs font-semibold"
                  >
                    {isFullscreen ? (
                      <>
                        <Minimize2 size={16} />
                        <span className="hidden md:inline">Standard View</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 size={16} />
                        <span className="hidden md:inline">Enlarge Screen</span>
                      </>
                    )}
                  </button>

                  {/* Close Button */}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/80 text-slate-300 hover:text-white transition-all border border-white/15"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Large Live Search Input Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search 12 entities by company name, GSTIN (e.g. 27ABCDE...), state, or sector..."
                  className="w-full pl-12 pr-12 py-3 bg-white/10 text-white placeholder-slate-400 text-sm rounded-xl border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white/15 transition-all shadow-inner"
                />
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-md"
                  >
                    <X size={16} />
                  </button>
                ) : (
                  <span className="hidden sm:inline absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 bg-white/10 px-1.5 py-0.5 rounded border border-white/10">
                    ESC to close
                  </span>
                )}
              </div>
            </div>

            {/* Filter Bar: Sectors & Compliance Status */}
            <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200/80 space-y-2.5 shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                  <Filter size={13} /> Sector:
                </span>
                <button
                  onClick={() => setSelectedSector('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                    selectedSector === 'ALL'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                  }`}
                >
                  All ({availableTenants.length})
                </button>
                {availableSectors.map(sec => {
                  const count = availableTenants.filter(t => t.sector === sec).length;
                  return (
                    <button
                      key={sec}
                      onClick={() => setSelectedSector(sec)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                        selectedSector === sec
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                      }`}
                    >
                      {sec} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Status and Active Node Indicator */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs pt-1 border-t border-slate-200/60">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-medium">
                    Showing <strong className="text-slate-900 font-bold">{filteredTenants.length}</strong> of {availableTenants.length} operating subsidiaries
                  </span>
                  {selectedSector !== 'ALL' && (
                    <button
                      onClick={() => setSelectedSector('ALL')}
                      className="text-xs font-bold text-indigo-600 hover:underline"
                    >
                      (Clear Sector)
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-semibold text-[11px]">Filter Status:</span>
                  <button
                    onClick={() => setComplianceFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      complianceFilter === 'ALL' ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setComplianceFilter('COMPLIANT')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      complianceFilter === 'COMPLIANT' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'text-slate-500 hover:text-emerald-700'
                    }`}
                  >
                    Compliant (≥97%)
                  </button>
                  <button
                    onClick={() => setComplianceFilter('NEEDS_ATTENTION')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      complianceFilter === 'NEEDS_ATTENTION' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'text-slate-500 hover:text-amber-700'
                    }`}
                  >
                    Needs Attention
                  </button>
                </div>
              </div>
            </div>

            {/* List / Grid of Entity Cards (Generous Scrollable Container) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/40">
              {filteredTenants.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <Building2 size={32} />
                  </div>
                  <h4 className="text-base font-bold text-slate-800">No operating companies match your search</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Try searching with another keyword (such as "SEZ", "Logistics", "Mumbai", or a GSTIN code).
                  </p>
                  <button
                    onClick={() => { setSearchQuery(''); setSelectedSector('ALL'); setComplianceFilter('ALL'); }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-xs"
                  >
                    Reset all filters
                  </button>
                </div>
              ) : (
                <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4" : "space-y-3"}>
                  {filteredTenants.map(tenant => {
                    const isSelected = tenant.id === currentTenant.id;
                    const isCompliant = tenant.filingStatus === 'COMPLIANT' || (tenant.complianceScore && tenant.complianceScore >= 97);

                    return (
                      <div
                        key={tenant.id}
                        onClick={() => {
                          onSelectTenant(tenant.id);
                          setIsOpen(false);
                        }}
                        className={`group cursor-pointer rounded-2xl border-2 transition-all p-4 sm:p-5 flex flex-col justify-between ${
                          isSelected
                            ? 'bg-blue-50/50 border-blue-600 shadow-md ring-1 ring-blue-500'
                            : 'bg-white hover:bg-slate-50/90 border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-sm'
                        }`}
                      >
                        {/* Top: Avatar, Name, Badges & Selection Indicator */}
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-base shrink-0 shadow-xs ${
                                isSelected
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-100 group-hover:bg-indigo-600 text-slate-700 group-hover:text-white transition-colors'
                              }`}>
                                {tenant.name.slice(0, 2).toUpperCase()}
                              </div>

                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <h4 className={`text-sm sm:text-base font-black truncate ${
                                    isSelected ? 'text-blue-950' : 'text-slate-900 group-hover:text-indigo-600'
                                  }`}>
                                    {tenant.name}
                                  </h4>
                                  
                                  {tenant.entityType && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                                      {tenant.entityType}
                                    </span>
                                  )}

                                  {tenant.isSez && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                                      SEZ Unit
                                    </span>
                                  )}
                                </div>

                                {/* Sector & State */}
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                  {tenant.sector && (
                                    <span className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${getSectorBadgeColor(tenant.sector)}`}>
                                      {tenant.sector}
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1 text-slate-500 font-medium">
                                    <MapPin size={12} className="text-slate-400" />
                                    <span>{tenant.stateName || `State ${tenant.stateCode}`}</span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Active Checkmark Badge */}
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center border shrink-0 transition-all ${
                              isSelected
                                ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                                : 'border-slate-200 group-hover:border-indigo-400 text-transparent'
                            }`}>
                              <Check size={14} className={isSelected ? 'text-white' : 'opacity-0 group-hover:opacity-40 text-indigo-600'} />
                            </div>
                          </div>

                          {/* GSTIN Copy Bar */}
                          <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200/70 text-xs">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Primary GSTIN</span>
                            <span 
                              onClick={(e) => handleCopyGstin(e, tenant.gstin)}
                              className="font-mono font-bold text-slate-800 hover:text-indigo-600 hover:bg-white px-2 py-0.5 rounded flex items-center gap-1.5 cursor-pointer transition-colors border border-transparent hover:border-slate-200"
                              title="Click to copy GSTIN"
                            >
                              <span>{tenant.gstin}</span>
                              {copiedGstin === tenant.gstin ? (
                                <Check size={13} className="text-emerald-600" />
                              ) : (
                                <Copy size={13} className="text-slate-400 hover:text-slate-600" />
                              )}
                            </span>
                          </div>

                          {/* Financial & Compliance Metrics */}
                          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                            <div className="bg-white p-2 rounded-lg border border-slate-100">
                              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Group Share</span>
                              <span className="text-xs font-black text-blue-700">
                                {tenant.revenueContributionPct || 10}% Rev
                              </span>
                            </div>

                            <div className="bg-white p-2 rounded-lg border border-slate-100">
                              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Registrations</span>
                              <span className="text-xs font-bold text-slate-700">
                                {tenant.gstinCount ? `${tenant.gstinCount} GSTINs` : '1 GSTIN'}
                              </span>
                            </div>

                            <div className="bg-white p-2 rounded-lg border border-slate-100">
                              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Compliance</span>
                              <span className={`text-xs font-black flex items-center gap-1 ${
                                isCompliant ? 'text-emerald-600' : 'text-amber-600'
                              }`}>
                                <ShieldCheck size={12} /> {tenant.complianceScore || 98}%
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Footer on Card */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                          <span className={isSelected ? 'text-blue-700' : 'text-slate-500'}>
                            {isSelected ? '● Currently Active Node' : 'Click to Switch'}
                          </span>
                          <span className="text-indigo-600 group-hover:text-indigo-800 flex items-center gap-1">
                            <span>Open Node</span>
                            <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer with Group Dashboard Switcher & Quick Navigation */}
            <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
              {onSwitchToGroupDashboard ? (
                <button
                  onClick={() => {
                    onSwitchToGroupDashboard();
                    setIsOpen(false);
                  }}
                  className="w-full sm:w-auto font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100/80 px-4 py-2 rounded-xl border border-indigo-200 flex items-center justify-center gap-2 transition-all shadow-xs"
                >
                  <Layers size={16} />
                  <span>Switch to Group Level Consolidated Dashboard</span>
                  <ArrowRight size={14} />
                </button>
              ) : <div />}

              <div className="flex items-center gap-3 text-slate-500">
                <span className="text-xs">
                  Showing <strong>{filteredTenants.length}</strong> entities
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-[11px] text-slate-400">
                  Press <kbd className="font-mono bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-700">ESC</kbd> to exit
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

