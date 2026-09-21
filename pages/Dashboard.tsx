import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, switchTenant, setSelectedGstin, setSelectedBranch } from '../store/store';
import { fetchDashboardStats, fetchDashboardAnalytics, fetchFilingHistory } from '../services/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Line, ComposedChart, AreaChart, Area
} from 'recharts';
import { 
  Calendar as CalendarIcon, Bell, Shield, Globe, Loader2, User, Camera, Sparkles, CheckCircle2,
  Building2, Layers, ArrowRight, ArrowLeft, FileDown, Download
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { createInvoice } from '../services/api';
import DocumentCameraScanner, { ExtractedInvoiceData } from '../components/DocumentCameraScanner';
import { UserRole, Tenant } from '../types';
import { motion } from 'framer-motion';
import { MonthlyGstrReportModal } from '../components/MonthlyGstrReportModal';
import AdminFinancialView from '../components/dashboard/AdminFinancialView';
import AuditorMetricsView from '../components/dashboard/AuditorMetricsView';
import GenericOverview from '../components/dashboard/GenericOverview';
import ComplianceHighlights from '../components/dashboard/ComplianceHighlights';
import VisualAnalyticsDashboard from '../components/dashboard/VisualAnalyticsDashboard';
import TaxLiabilityMlForecast from '../components/dashboard/TaxLiabilityMlForecast';
import { TaxLiabilityProjectionCard } from '../components/dashboard/TaxLiabilityProjectionCard';
import { TaxLiabilityProjectionChart } from '../components/dashboard/TaxLiabilityProjectionChart';
import PortalLatencyWidget from '../components/dashboard/PortalLatencyWidget';
import ExecutiveDashboardSuite from '../components/dashboard/ExecutiveDashboardSuite';
import { GstinEntitySwitcher } from '../components/dashboard/GstinEntitySwitcher';
import { ComplianceControlTower } from '../components/dashboard/ComplianceControlTower';
import { RealTimePipelineVisualizer } from '../components/dashboard/RealTimePipelineVisualizer';
import { Gstr2bMismatchAlerts } from '../components/dashboard/Gstr2bMismatchAlerts';
import { ComplianceHeatmap } from '../components/dashboard/ComplianceHeatmap';
import { MonthlyLiabilityVsPaymentsChart } from '../components/dashboard/MonthlyLiabilityVsPaymentsChart';
import { MonthlyOutputTaxLiabilityTrendChart } from '../components/dashboard/MonthlyOutputTaxLiabilityTrendChart';
import { ExecutiveKpiSummary } from '../components/dashboard/ExecutiveKpiSummary';
import { ProactiveAlertsService } from '../components/dashboard/ProactiveAlertsService';
import { GstPolicyUpdatesWidget } from '../components/dashboard/GstPolicyUpdatesWidget';
import { SubsidiaryPerformanceMatrix } from '../components/dashboard/SubsidiaryPerformanceMatrix';
import { IndividualCompanyHeader } from '../components/dashboard/IndividualCompanyHeader';
import { ComplianceDeadlinesTimeline } from '../components/dashboard/ComplianceDeadlinesTimeline';
import { ReconciledVsUnreconciledChart } from '../components/dashboard/ReconciledVsUnreconciledChart';
import { GstAuditorCard, GstAuditor } from '../components/GstAuditor';
import { ENTERPRISE_GROUP_TENANTS } from '../src/fixtures/enterpriseTenants';

const Dashboard: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const selectedGstin = useSelector((state: RootState) => state.org.selectedGstin);
  const selectedBranchId = useSelector((state: RootState) => state.org.selectedBranchId);
  const gstinsByTenant = useSelector((state: RootState) => state.org.gstinsByTenant);
  const branchesByTenant = useSelector((state: RootState) => state.org.branchesByTenant);

  const tenantId = user?.currentTenantId || 't1';
  const availableTenants: Tenant[] = (user?.availableTenants && user.availableTenants.length >= ENTERPRISE_GROUP_TENANTS.length)
    ? user.availableTenants
    : ENTERPRISE_GROUP_TENANTS;
  
  // RBAC: Can see sensitive financial actions
  const canAct = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ADMIN || user?.role === UserRole.FINANCE_MANAGER || user?.role === UserRole.ACCOUNTANT;

  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  // Top-level Dashboard View Mode: 'GROUP_LEVEL' (Consolidated) vs 'INDIVIDUAL_COMPANY'
  const [dashboardViewMode, setDashboardViewMode] = useState<'GROUP_LEVEL' | 'INDIVIDUAL_COMPANY'>('GROUP_LEVEL');

  // Filter State
  const [timeRange, setTimeRange] = useState('MONTHLY');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [selectedEntityId, setSelectedEntityId] = useState<string>('AGGREGATE');
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [dashboardScanToast, setDashboardScanToast] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isAuditorModalOpen, setIsAuditorModalOpen] = useState<boolean>(false);

  const handleOpenCompanyDashboard = (targetTenantId: string) => {
    setSelectedEntityId(targetTenantId);
    setDashboardViewMode('INDIVIDUAL_COMPANY');
    dispatch(switchTenant(targetTenantId));
    const tGstins = gstinsByTenant[targetTenantId] || [];
    dispatch(setSelectedGstin(tGstins[0]?.gstin || 'ALL'));
    dispatch(setSelectedBranch('ALL'));
  };

  const handleSwitchToGroupDashboard = () => {
    setDashboardViewMode('GROUP_LEVEL');
    setSelectedEntityId('AGGREGATE');
    dispatch(setSelectedGstin('ALL'));
    dispatch(setSelectedBranch('ALL'));
  };

  const handleSelectCompany = (targetTenantId: string) => {
    setSelectedEntityId(targetTenantId);
    dispatch(switchTenant(targetTenantId));
    const tGstins = gstinsByTenant[targetTenantId] || [];
    dispatch(setSelectedGstin(tGstins[0]?.gstin || 'ALL'));
    dispatch(setSelectedBranch('ALL'));
  };

  const handleDashboardInvoiceExtracted = async (extractedData: ExtractedInvoiceData, createDirectly?: boolean) => {
    if (createDirectly) {
      try {
        const newInv: any = {
          tenantId,
          gstin: extractedData.partyGstin || selectedGstin || '27AAAAA0000A1Z5',
          branchId: selectedBranchId || 'b1',
          category: extractedData.category || 'PURCHASE',
          docType: 'INVOICE',
          invoiceNumber: extractedData.invoiceNumber || `REC-${Date.now().toString().slice(-6)}`,
          date: extractedData.date || new Date().toISOString().split('T')[0],
          partyName: extractedData.partyName || 'Scanned Vendor Entity',
          partyGstin: extractedData.partyGstin || '27AABCU9632R1ZT',
          placeOfSupply: extractedData.placeOfSupply || '27',
          items: (extractedData.items || []).map((item, idx) => ({
            id: (Date.now() + idx).toString(),
            description: item.description || 'Scanned Line Item',
            hsnSac: item.hsnSac || '998313',
            quantity: item.quantity || 1,
            unit: item.unit || 'PCS',
            rate: item.rate || 0,
            taxRate: item.gstRate || 18,
            taxableValue: (item.quantity || 1) * (item.rate || 0),
            taxAmount: (item.quantity || 1) * (item.rate || 0) * ((item.gstRate || 18) / 100)
          })),
          taxableValue: extractedData.taxableValue || 10000,
          cgst: extractedData.cgst || 900,
          sgst: extractedData.sgst || 900,
          igst: extractedData.igst || 0,
          totalGst: extractedData.totalGst || 1800,
          totalAmount: extractedData.totalAmount || 11800,
          status: 'APPROVED',
          isRcm: false,
          isBlockedItc: false,
          isImport: false,
          isSez: false,
          vaultSynced: true,
          documentVaultId: `DOC-VAULT-${Date.now().toString().slice(-6)}`
        };

        await createInvoice(newInv);
        queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
        queryClient.invalidateQueries({ queryKey: ['allTenantsStats'] });
        setDashboardScanToast(`Invoice #${newInv.invoiceNumber} scanned & committed to compliance vault!`);
        setTimeout(() => setDashboardScanToast(null), 5000);
      } catch (err) {
        console.error('Failed to create scanned invoice from dashboard:', err);
      }
    } else {
      window.location.href = '/invoices';
    }
  };

  // Sync state if header switcher switches the current tenant globally
  useEffect(() => {
    if (tenantId && dashboardViewMode === 'INDIVIDUAL_COMPANY') {
      setSelectedEntityId(tenantId);
    }
  }, [tenantId, dashboardViewMode]);

  const tenantIdsKey = useMemo(() => availableTenants.map(t => t.id).join(','), [availableTenants]);

  // Query Stats for ALL available entities (aware of time range, selected GSTIN, and Branch)
  const allTenantsStatsQuery = useQuery({
    queryKey: ['allTenantsStats', tenantIdsKey, timeRange, selectedGstin, selectedBranchId],
    queryFn: async () => {
      const entries = await Promise.all(
        availableTenants.map(async (tenant) => {
          const s = await fetchDashboardStats(tenant.id, timeRange, selectedGstin, selectedBranchId);
          return { id: tenant.id, stats: s };
        })
      );
      return entries.reduce((acc, curr) => {
        acc[curr.id] = curr.stats;
        return acc;
      }, {} as { [id: string]: any });
    },
    enabled: availableTenants.length > 0
  });

  // Query Analytics for ALL available entities (aware of selected GSTIN and Branch)
  const allTenantsAnalyticsQuery = useQuery({
    queryKey: ['allTenantsAnalytics', tenantIdsKey, timeRange, selectedGstin, selectedBranchId],
    queryFn: async () => {
      const entries = await Promise.all(
        availableTenants.map(async (tenant) => {
          const a = await fetchDashboardAnalytics(tenant.id, timeRange, selectedGstin, selectedBranchId);
          return { id: tenant.id, analytics: a };
        })
      );
      return entries.reduce((acc, curr) => {
        acc[curr.id] = curr.analytics;
        return acc;
      }, {} as { [id: string]: any });
    },
    enabled: availableTenants.length > 0
  });

  // Query Filing History for ALL available entities
  const allTenantsFilingsQuery = useQuery({
    queryKey: ['allTenantsFilings', tenantIdsKey],
    queryFn: async () => {
      const entries = await Promise.all(
        availableTenants.map(async (tenant) => {
          const f = await fetchFilingHistory(tenant.id);
          return { id: tenant.id, filings: f };
        })
      );
      return entries.reduce((acc, curr) => {
        acc[curr.id] = curr.filings;
        return acc;
      }, {} as { [id: string]: any });
    },
    enabled: availableTenants.length > 0
  });

  const getChartTitle = () => {
      switch(timeRange) {
          case 'WEEKLY': return 'Weekly Trend';
          case 'QUARTERLY': return 'Quarterly Performance';
          case 'YEARLY': return 'Annual Summary';
          case 'CUSTOM': return 'Custom Range Analysis';
          default: return 'Monthly GST Summary';
      }
  };

  const isStatsLoading = allTenantsStatsQuery.isLoading && !allTenantsStatsQuery.data;
  const isAnalyticsLoading = allTenantsAnalyticsQuery.isLoading && !allTenantsAnalyticsQuery.data;
  const isFetchingFilters = allTenantsStatsQuery.isFetching || allTenantsAnalyticsQuery.isFetching;

  if (isStatsLoading || isAnalyticsLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-500">
        <Loader2 className="animate-spin mr-2" /> 
        Loading aggregate and entity performance portfolios...
      </div>
    );
  }

  const statsMap = allTenantsStatsQuery.data || {};
  const analyticsMap = allTenantsAnalyticsQuery.data || {};
  const filingsMap = allTenantsFilingsQuery.data || {};

  // Compute active stats
  let activeStats: any = null;
  if (selectedEntityId === 'AGGREGATE') {
    let sales = 0;
    let purchases = 0;
    let liability = 0;
    let itc = 0;
    Object.values(statsMap).forEach((s: any) => {
      sales += s?.sales || 0;
      purchases += s?.purchases || 0;
      liability += s?.liability || 0;
      itc += s?.itc || 0;
    });
    activeStats = { sales, purchases, liability, itc };
  } else {
    activeStats = statsMap[selectedEntityId] || { sales: 0, purchases: 0, liability: 0, itc: 0 };
  }

  // Compute active filings
  let activeFilings: any[] = [];
  if (selectedEntityId === 'AGGREGATE') {
    Object.values(filingsMap).forEach((list: any) => {
      if (Array.isArray(list)) {
        activeFilings = [...activeFilings, ...list];
      }
    });
    // Sort combined filings by due date
    activeFilings.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  } else {
    activeFilings = filingsMap[selectedEntityId] || [];
  }

  // Compute active analytics
  let activeAnalytics: any = null;
  if (selectedEntityId === 'AGGREGATE') {
    // Dynamically retrieve period names from first populated entity or fallback based on timeRange
    const sampleAnalytics: any = Object.values(analyticsMap).find((an: any) => an?.monthlyTrend && an.monthlyTrend.length > 0);
    const dynamicPeriods: string[] = sampleAnalytics?.monthlyTrend?.map((t: any) => t.name) || 
      (timeRange === 'WEEKLY' ? ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'] :
       timeRange === 'QUARTERLY' ? ['Q3 FY25', 'Q4 FY25', 'Q1 FY26', 'Q2 FY26'] :
       ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']);

    const trendMap = dynamicPeriods.reduce((acc, p) => {
      acc[p] = { name: p, sales: 0, purchase: 0, liability: 0, itc: 0, outputLiability: 0, mismatches: 0, accuracySum: 0, count: 0 };
      return acc;
    }, {} as Record<string, any>);

    let totalCashLedger = 0;
    let totalCreditLedger = 0;
    let totalMismatchedInvoices = 0;
    let totalItcAtRisk = 0;
    let complianceSum = 0;
    let complianceCount = 0;

    Object.values(analyticsMap).forEach((an: any) => {
      if (an) {
        if (Array.isArray(an.monthlyTrend)) {
          an.monthlyTrend.forEach((t: any) => {
            if (!trendMap[t.name]) {
              trendMap[t.name] = { name: t.name, sales: 0, purchase: 0, liability: 0, itc: 0, outputLiability: 0, mismatches: 0, accuracySum: 0, count: 0 };
            }
            trendMap[t.name].sales += t.sales || 0;
            trendMap[t.name].purchase += t.purchase || 0;
            trendMap[t.name].liability += t.liability || 0;
            trendMap[t.name].itc += t.itc || 0;
            trendMap[t.name].outputLiability += t.outputLiability || 0;
            trendMap[t.name].mismatches += t.mismatches || 0;
            trendMap[t.name].accuracySum += t.accuracy || 0;
            trendMap[t.name].count += 1;
          });
        }
        if (Array.isArray(an.utilization)) {
          an.utilization.forEach((u: any) => {
            if (u.name === 'Cash Ledger') totalCashLedger += u.value || 0;
            if (u.name === 'Credit Ledger') totalCreditLedger += u.value || 0;
          });
        }
        if (an.riskMetrics) {
          totalMismatchedInvoices += an.riskMetrics.mismatchedInvoices || 0;
          totalItcAtRisk += an.riskMetrics.itcAtRisk || 0;
          complianceSum += an.riskMetrics.vendorCompliance || 0;
          complianceCount += 1;
        }
      }
    });

    const monthlyTrend = dynamicPeriods.map(p => {
      const val = trendMap[p] || { sales: 0, purchase: 0, liability: 0, itc: 0, outputLiability: 0, mismatches: 0, accuracySum: 96, count: 1 };
      return {
        name: p,
        sales: val.sales,
        purchase: val.purchase,
        liability: val.liability,
        itc: val.itc,
        outputLiability: val.outputLiability,
        mismatches: val.mismatches,
        accuracy: val.count > 0 ? Math.round(val.accuracySum / val.count) : 96
      };
    });

    const utilization = [
      { name: 'Cash Ledger', value: totalCashLedger, color: '#0088FE' },
      { name: 'Credit Ledger', value: totalCreditLedger, color: '#00C49F' }
    ];

    const riskMetrics = {
      mismatchedInvoices: totalMismatchedInvoices,
      itcAtRisk: totalItcAtRisk,
      vendorCompliance: complianceCount > 0 ? Math.round(complianceSum / complianceCount) : 85
    };

    activeAnalytics = { monthlyTrend, utilization, riskMetrics };
  } else {
    activeAnalytics = analyticsMap[selectedEntityId] || null;
  }

  const fallbackCompany: Tenant = { id: 't1', name: 'Acme Corp', gstin: '27ABCDE1234F1Z5', stateCode: '27', address: '101, Business Park, Mumbai, Maharashtra' };
  const currentCompany = availableTenants.find(t => t.id === (selectedEntityId === 'AGGREGATE' ? tenantId : selectedEntityId)) || availableTenants[0] || fallbackCompany;

  let totalGroupSales = 0;
  Object.values(statsMap).forEach((s: any) => {
    totalGroupSales += s?.sales || 0;
  });

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Enhanced Executive Welcome Banner */}
      <div className="bg-white text-slate-900 p-6 lg:p-8 rounded-2xl relative overflow-hidden flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shadow-xs border border-slate-200">
        
        <div className="flex items-center gap-5 relative z-10">
           <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-2xl shadow-sm shrink-0">
              {dashboardViewMode === 'GROUP_LEVEL' ? <Layers size={26} /> : (currentCompany.name.charAt(0) || 'U')}
           </div>
           <div>
              <div className="flex items-center gap-2 mb-1">
                 <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${
                   dashboardViewMode === 'GROUP_LEVEL'
                     ? 'bg-blue-50 text-blue-700 border-blue-200/80'
                     : 'bg-indigo-50 text-indigo-700 border-indigo-200/80'
                 }`}>
                    {dashboardViewMode === 'GROUP_LEVEL' ? 'Enterprise Group Portal' : `${currentCompany.name} Workspace`}
                 </span>
                 <span className="text-slate-500 text-xs font-medium ml-2">
                   {dashboardViewMode === 'GROUP_LEVEL' ? `${availableTenants.length} Subsidiaries Consolidated` : currentCompany.gstin}
                 </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-2 mb-1.5 leading-tight">
                {dashboardViewMode === 'GROUP_LEVEL' ? 'Group Level Executive Dashboard' : `${currentCompany.name} Dashboard`}
              </h2>
              <p className="text-slate-500 text-sm font-medium flex items-center gap-2">
                <CalendarIcon size={14} className="text-slate-400" />
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                <span className="text-slate-300">•</span>
                <span className="text-slate-700 font-semibold">
                  {dashboardViewMode === 'GROUP_LEVEL' ? 'Consolidated Multi-Entity Overview' : `Active Registered State: ${currentCompany.stateCode}`}
                </span>
              </p>
           </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto relative z-10">
           <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
             <div className="flex flex-1 lg:flex-none gap-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                {['WEEKLY', 'MONTHLY', 'QUARTERLY'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                      timeRange === range 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {isFetchingFilters && timeRange === range ? (
                      <Loader2 size={12} className="animate-spin text-white" />
                    ) : null}
                    <span>{range}</span>
                  </button>
                ))}
             </div>

             {/* Download Monthly GSTR Summary Report Button */}
             <button
               id="dashboard-download-report-btn"
               onClick={() => setIsReportModalOpen(true)}
               className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer whitespace-nowrap"
               title="Download Monthly GSTR Summary Report (PDF)"
             >
               <FileDown size={15} />
               <span>Download Report</span>
             </button>
           </div>
        </div>
      </div>

      {/* Primary Dashboard Mode Selector: Group Level vs Individual Company */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-xs overflow-hidden">
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-xl border border-slate-200 w-full xl:w-auto overflow-x-auto shrink-0">
          <button
            onClick={handleSwitchToGroupDashboard}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold tracking-wide whitespace-nowrap transition-all ${
              dashboardViewMode === 'GROUP_LEVEL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Layers size={16} />
            <span>Group Level Dashboard (Consolidated)</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ml-1 ${
              dashboardViewMode === 'GROUP_LEVEL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {availableTenants.length} Companies
            </span>
          </button>

          <button
            onClick={() => {
              if (dashboardViewMode !== 'INDIVIDUAL_COMPANY') {
                const targetId = selectedEntityId === 'AGGREGATE' ? (availableTenants[0]?.id || 't1') : selectedEntityId;
                handleOpenCompanyDashboard(targetId);
              }
            }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold tracking-wide whitespace-nowrap transition-all ${
              dashboardViewMode === 'INDIVIDUAL_COMPANY'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Building2 size={16} />
            <span>Individual Company Dashboard</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ml-1 ${
              dashboardViewMode === 'INDIVIDUAL_COMPANY' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {currentCompany?.name || 'Company'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3 px-3 text-xs text-slate-500 truncate">
          <span className="hidden xl:inline font-medium truncate">
            {dashboardViewMode === 'GROUP_LEVEL' 
              ? `Consolidated multi-entity intelligence across ${availableTenants.length} operating subsidiaries`
              : `Isolated compliance workspace, 2B mismatch alerts, and branch ledgers for ${currentCompany?.name}`}
          </span>
        </div>
      </div>

      <ProactiveAlertsService />

      {/* ========================================================================= */}
      {/* 1. DEDICATED GROUP LEVEL DASHBOARD (CONSOLIDATED)                          */}
      {/* ========================================================================= */}
      {dashboardViewMode === 'GROUP_LEVEL' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Real-time GST Policy Updates & Council Digest */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <GstPolicyUpdatesWidget />
          </div>

          {/* Corporate System Integrity Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center gap-3.5 shadow-xs hover:border-slate-300 transition-colors">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shrink-0"></div>
              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">Group Backup Active</span>
                <span className="text-[10px] text-slate-500 font-medium">Multi-entity snapshot: 2 mins ago</span>
              </div>
            </div>
            <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center gap-3.5 shadow-xs hover:border-slate-300 transition-colors">
              <Shield size={18} className="text-blue-600 shrink-0" />
              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">256-Bit SSL Encrypted</span>
                <span className="text-[10px] text-slate-500 font-medium">SOC-2 Type II Consolidated Ledger</span>
              </div>
            </div>
            <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center gap-3.5 shadow-xs hover:border-slate-300 transition-colors">
              <Globe size={18} className="text-emerald-600 shrink-0" />
              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">GSTN API Connection</span>
                <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Live & Verified ({availableTenants.length} Companies)
                </span>
              </div>
            </div>
          </div>

          {/* Group Consolidated Financial Suite (Total Sales, ITC, Net Liability, Dynamic Profit Margin, Monthly Chart, Settlement Mix) */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <AdminFinancialView 
              stats={activeStats} 
              analytics={activeAnalytics} 
              getChartTitle={getChartTitle} 
              timeRange={timeRange}
              selectedEntityId="AGGREGATE"
              onSelectEntity={handleOpenCompanyDashboard}
              availableTenants={availableTenants}
              allTenantStats={statsMap}
              allTenantAnalytics={analyticsMap}
              hideInternalScopeSwitcher={true}
            />
          </div>

          {/* Visual Recharts Compliance Deadlines & Return Filing Milestones Timeline (Consolidated Group Scope) */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <ComplianceDeadlinesTimeline 
              tenantId="AGGREGATE"
              entityName="Enterprise Group (Consolidated)"
              isAggregate={true}
              filings={activeFilings || []}
              allTenantFilings={filingsMap}
              availableTenants={availableTenants}
              onNavigate={(path) => {
                window.location.hash = path;
              }}
            />
          </div>

          {/* Visual Recharts Reconciled vs Unreconciled Invoices & Potential Tax Gap Exposure */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <ReconciledVsUnreconciledChart 
              tenantId={tenantId}
              selectedGstin="ALL"
              period="Current Period (Q2 FY 2026-27)"
              onNavigateToRecon={() => {
                window.location.hash = '#/reconciliation';
              }}
            />
          </div>

          {/* Automated GST Compliance Auditor Dashboard Card */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <GstAuditorCard 
              tenantId={tenantId} 
              onOpenFullAuditor={() => setIsAuditorModalOpen(true)} 
            />
          </div>

          {/* Subsidiary Operating Performance Matrix (Direct comparison of all companies + Jump to Company Dashboard CTA) */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <SubsidiaryPerformanceMatrix 
              availableTenants={availableTenants}
              allTenantStats={statsMap}
              allTenantAnalytics={analyticsMap}
              allTenantFilings={filingsMap}
              onSelectCompany={handleOpenCompanyDashboard}
            />
          </div>

          {/* Group Tax Liability Machine Learning Forecasting & Outflow Projections */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <TaxLiabilityMlForecast tenantId="t1" analyticsData={activeAnalytics} />
          </div>

          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <TaxLiabilityProjectionCard 
              tenantId="t1"
              selectedGstin="ALL"
              selectedBranchId="ALL"
              analyticsData={activeAnalytics}
              onNavigateToForecasting={() => {
                window.location.hash = '#/tax-forecast';
              }}
            />
          </div>

          {/* Real-Time External GST Portal Connection Monitor */}
          <PortalLatencyWidget />

          {/* Shared Compliance & Risk Highlights */}
          <div className="pt-4 border-t border-slate-100/60">
            <ComplianceHighlights analytics={activeAnalytics} filings={activeFilings} />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DEDICATED INDIVIDUAL COMPANY DASHBOARD                                  */}
      {/* ========================================================================= */}
      {dashboardViewMode === 'INDIVIDUAL_COMPANY' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Individual Company Operational Header & Switcher */}
          <IndividualCompanyHeader 
            currentTenant={currentCompany}
            availableTenants={availableTenants}
            onSelectTenant={handleSelectCompany}
            onSwitchToGroupDashboard={handleSwitchToGroupDashboard}
            tenantStats={statsMap[currentCompany.id]}
            totalGroupSales={totalGroupSales}
          />

          {/* Company GSTIN & Branch Performance Switcher */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <GstinEntitySwitcher 
              availableTenants={[currentCompany]}
              selectedEntityId={currentCompany.id}
              onSelectEntity={handleSelectCompany}
              allTenantStats={statsMap}
            />
          </div>

          {/* Company-Specific Financial Suite */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <AdminFinancialView 
              stats={activeStats} 
              analytics={activeAnalytics} 
              getChartTitle={getChartTitle} 
              timeRange={timeRange}
              selectedEntityId={currentCompany.id}
              onSelectEntity={handleSelectCompany}
              availableTenants={availableTenants}
              allTenantStats={statsMap}
              allTenantAnalytics={analyticsMap}
              hideInternalScopeSwitcher={true}
            />
          </div>

          {/* Executive Key Performance Indicators (KPIs) for this company */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <ExecutiveKpiSummary 
              stats={activeStats}
              analytics={activeAnalytics}
              filings={activeFilings}
              selectedEntityId={currentCompany.id}
              timeRange={timeRange}
              onNavigate={(path) => {
                window.location.hash = path;
              }}
            />
          </div>

          {/* Visual Recharts Reconciled vs Unreconciled Invoices & Potential Tax Gap Exposure */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <ReconciledVsUnreconciledChart 
              tenantId={currentCompany.id}
              selectedGstin={selectedGstin}
              period="Current Period (Q2 FY 2026-27)"
              onNavigateToRecon={() => {
                window.location.hash = '#/reconciliation';
              }}
            />
          </div>

          {/* Automated GST Compliance Auditor Dashboard Card for Individual Company */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <GstAuditorCard 
              tenantId={currentCompany.id} 
              onOpenFullAuditor={() => setIsAuditorModalOpen(true)} 
            />
          </div>

          {/* Automated GSTR-2B Mismatch Detection Alert System for this company */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <Gstr2bMismatchAlerts tenantId={currentCompany.id} />
          </div>

          {/* Compliance Control Tower Console for this company */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <ComplianceControlTower 
              tenantId={currentCompany.id}
              stats={activeStats}
              analytics={activeAnalytics}
            />
          </div>

          {/* Real-Time Transaction Pipeline Monitor */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <RealTimePipelineVisualizer tenantId={currentCompany.id} />
          </div>

          {/* Compliance Risk & Volumetric Heatmap */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <ComplianceHeatmap />
          </div>

          {/* Tax Liability Projection Card for this company */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <TaxLiabilityProjectionCard 
              tenantId={currentCompany.id}
              selectedGstin={selectedGstin}
              selectedBranchId={selectedBranchId}
              analyticsData={activeAnalytics}
              onNavigateToForecasting={() => {
                window.location.hash = '#/tax-forecast';
              }}
            />
          </div>

          {/* 6-Month Monthly Output Tax Liability Trends */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <MonthlyOutputTaxLiabilityTrendChart 
              tenantId={currentCompany.id}
              selectedGstin={selectedGstin}
              selectedBranchId={selectedBranchId}
              analyticsData={activeAnalytics}
            />
          </div>

          {/* 6-Month GST Liability Trends vs. Payments Made */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <MonthlyLiabilityVsPaymentsChart 
              tenantId={currentCompany.id}
              selectedGstin={selectedGstin}
              selectedBranchId={selectedBranchId}
              analyticsData={activeAnalytics}
            />
          </div>

          {/* Visual Recharts Compliance Deadlines & Return Filing Milestones Timeline (Company Scope) */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <ComplianceDeadlinesTimeline 
              tenantId={currentCompany.id}
              entityName={currentCompany.name}
              isAggregate={false}
              filings={activeFilings || []}
              availableTenants={availableTenants}
              onNavigate={(path) => {
                window.location.hash = path;
              }}
            />
          </div>

          {/* Complete Executive GST Features Suite for this company */}
          <ExecutiveDashboardSuite 
            tenantId={currentCompany.id}
            stats={activeStats}
            analytics={activeAnalytics}
            filings={activeFilings || []}
          />

          {/* Role-Specific Metric Overview */}
          {user?.role === UserRole.AUDITOR && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
              <AuditorMetricsView 
                stats={activeStats} 
                analytics={activeAnalytics} 
              />
            </div>
          )}
          
          {(user?.role === UserRole.ACCOUNTANT || user?.role === UserRole.VIEWER) && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
              <GenericOverview 
                stats={activeStats} 
                analytics={activeAnalytics} 
                filings={activeFilings}
                canAct={canAct}
              />
            </div>
          )}

          {/* Visual Analytics Dashboard */}
          <VisualAnalyticsDashboard stats={activeStats} analytics={activeAnalytics} />

          {/* Real-Time External GST Portal Latency Monitor */}
          <PortalLatencyWidget />

          {/* Compliance & Risk Highlights */}
          <div className="pt-4 border-t border-slate-100/60">
            <ComplianceHighlights analytics={activeAnalytics} filings={activeFilings} />
          </div>
        </div>
      )}

      {/* Camera OCR Scanner Modal */}
      <DocumentCameraScanner
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onInvoiceExtracted={handleDashboardInvoiceExtracted}
        defaultCategory="PURCHASE"
      />

      {/* Monthly GSTR Summary Report PDF Export Modal */}
      <MonthlyGstrReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        currentTenant={currentCompany}
        availableTenants={availableTenants}
        isAggregate={dashboardViewMode === 'GROUP_LEVEL'}
        stats={activeStats}
        analytics={activeAnalytics}
        defaultPeriod={timeRange === 'QUARTERLY' ? 'Q2 FY 2026-27' : 'September 2026'}
      />

      {/* Full GST Auditor Suite Modal */}
      {isAuditorModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-6xl max-h-[92vh] overflow-y-auto custom-scrollbar bg-slate-100 rounded-3xl p-4 sm:p-6 shadow-2xl">
            <GstAuditor 
              tenantId={dashboardViewMode === 'GROUP_LEVEL' ? 't1' : currentCompany.id} 
              onClose={() => setIsAuditorModalOpen(false)} 
            />
          </div>
        </div>
      )}

      {/* Dashboard Scan Success Notification Toast */}
      {dashboardScanToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-500/50 text-emerald-300 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{dashboardScanToast}</span>
        </div>
      )}
    </div>
  );
};

export default Dashboard;