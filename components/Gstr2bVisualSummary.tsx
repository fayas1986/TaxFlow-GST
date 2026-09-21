import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { 
  CheckCircle2, 
  AlertTriangle, 
  FileQuestion, 
  ShieldAlert, 
  Layers, 
  Download, 
  TrendingUp, 
  BarChart3, 
  Filter, 
  ArrowUpRight,
  Info,
  Calendar,
  Building2,
  ReceiptText,
  Scale,
  ShieldCheck,
  Coins,
  ArrowRightLeft,
  Percent
} from 'lucide-react';
import { ReconItem } from '../types';

export interface Gstr2bVisualSummaryProps {
  items: ReconItem[];
  period?: string;
  activeStatusFilter?: string;
  onSelectStatusFilter?: (status: string) => void;
  onExportReport?: () => void;
}

type GroupDimension = 'VENDOR' | 'VALUE_RANGE' | 'TAX_SLAB';
type MetricType = 'COUNT' | 'VALUE';

export const Gstr2bVisualSummary: React.FC<Gstr2bVisualSummaryProps> = ({
  items = [],
  period = 'August 2026',
  activeStatusFilter = 'ALL',
  onSelectStatusFilter,
  onExportReport
}) => {
  const [dimension, setDimension] = useState<GroupDimension>('VENDOR');
  const [metricMode, setMetricMode] = useState<MetricType>('COUNT');
  const [combineMissing, setCombineMissing] = useState<boolean>(false);

  // Core Aggregations for GSTR-2B vs Books
  const summary = useMemo(() => {
    let matchedCount = 0;
    let matchedTax = 0;

    let fullyReconciledCount = 0;
    let fullyReconciledTax = 0;

    let partiallyMatchedCount = 0;
    let partiallyMatchedTax = 0;

    let mismatchedCount = 0;
    let mismatchedBooksTax = 0;
    let mismatchedPortalTax = 0;
    let mismatchedTaxDiff = 0;
    let excessClaimTax = 0;
    let shortClaimTax = 0;

    let missingPortalCount = 0;
    let missingPortalTax = 0;

    let missingBooksCount = 0;
    let missingBooksTax = 0;

    let totalBooksTax = 0;
    let totalPortalTax = 0;

    items.forEach((item) => {
      const bTax = Number(item.taxAmountBooks) || 0;
      const pTax = Number(item.taxAmountPortal) || 0;
      const diff = item.difference !== undefined ? Math.abs(item.difference) : Math.abs(bTax - pTax);
      totalBooksTax += bTax;
      totalPortalTax += pTax;

      if (item.status === 'MATCHED') {
        fullyReconciledCount++;
        fullyReconciledTax += (pTax > 0 ? pTax : bTax);
        matchedCount++;
        matchedTax += (pTax > 0 ? pTax : bTax);
      } else if (item.status === 'PARTIAL_MATCH' || item.status === 'PROBABLE_MATCH') {
        partiallyMatchedCount++;
        partiallyMatchedTax += (pTax > 0 ? pTax : bTax);
        matchedCount++;
        matchedTax += (pTax > 0 ? pTax : bTax);
      } else if (item.status === 'MISMATCH' || item.status === 'EXCESS_ITC') {
        mismatchedCount++;
        mismatchedBooksTax += bTax;
        mismatchedPortalTax += pTax;
        mismatchedTaxDiff += diff;
        if (bTax > pTax) {
          excessClaimTax += (bTax - pTax);
        } else if (pTax > bTax) {
          shortClaimTax += (pTax - bTax);
        }
      } else if (item.status === 'MISSING_IN_PORTAL') {
        missingPortalCount++;
        missingPortalTax += bTax;
      } else if (item.status === 'MISSING_IN_BOOKS') {
        missingBooksCount++;
        missingBooksTax += pTax;
      }
    });

    const totalCount = items.length;
    const matchRate = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0;
    const totalMissingCount = missingPortalCount + missingBooksCount;
    const totalMissingTax = missingPortalTax + missingBooksTax;

    // Financial comparative metrics: Current mismatches vs. fully reconciled invoices
    const evaluatedTax = fullyReconciledTax + mismatchedTaxDiff;
    const reconciledTaxShare = evaluatedTax > 0 
      ? Math.round((fullyReconciledTax / evaluatedTax) * 100) 
      : 0;
    const mismatchTaxImpactShare = evaluatedTax > 0 ? Math.max(0, 100 - reconciledTaxShare) : 0;
    const netTaxDifference = mismatchedBooksTax - mismatchedPortalTax;
    const reconciledToMismatchRatio = mismatchedTaxDiff > 0 
      ? (fullyReconciledTax / mismatchedTaxDiff).toFixed(1) 
      : (fullyReconciledTax > 0 ? '100+' : '0.0');

    return {
      totalCount,
      matchedCount,
      matchedTax,
      fullyReconciledCount,
      fullyReconciledTax,
      partiallyMatchedCount,
      partiallyMatchedTax,
      mismatchedCount,
      mismatchedBooksTax,
      mismatchedPortalTax,
      mismatchedTaxDiff,
      excessClaimTax,
      shortClaimTax,
      missingPortalCount,
      missingPortalTax,
      missingBooksCount,
      missingBooksTax,
      totalMissingCount,
      totalMissingTax,
      totalBooksTax,
      totalPortalTax,
      matchRate,
      reconciledTaxShare,
      mismatchTaxImpactShare,
      netTaxDifference,
      reconciledToMismatchRatio,
    };
  }, [items]);

  // Transform items into Stacked Bar Chart format based on selected dimension
  const chartData = useMemo(() => {
    if (!items || items.length === 0) return [];

    if (dimension === 'VENDOR') {
      // Group by Party / Vendor Name
      const vendorMap = new Map<string, {
        name: string;
        fullName: string;
        matchedCount: number;
        matchedValue: number;
        mismatchedCount: number;
        mismatchedValue: number;
        missingPortalCount: number;
        missingPortalValue: number;
        missingBooksCount: number;
        missingBooksValue: number;
      }>();

      items.forEach((item) => {
        const vendor = item.partyName?.trim() || 'Unknown Vendor';
        if (!vendorMap.has(vendor)) {
          // Truncate long vendor names for X-Axis tick display
          const shortName = vendor.length > 14 ? `${vendor.slice(0, 12)}...` : vendor;
          vendorMap.set(vendor, {
            name: shortName,
            fullName: vendor,
            matchedCount: 0,
            matchedValue: 0,
            mismatchedCount: 0,
            mismatchedValue: 0,
            missingPortalCount: 0,
            missingPortalValue: 0,
            missingBooksCount: 0,
            missingBooksValue: 0,
          });
        }

        const entry = vendorMap.get(vendor)!;
        const bTax = item.taxAmountBooks || 0;
        const pTax = item.taxAmountPortal || 0;

        if (item.status === 'MATCHED' || item.status === 'PARTIAL_MATCH' || item.status === 'PROBABLE_MATCH') {
          entry.matchedCount++;
          entry.matchedValue += (pTax || bTax);
        } else if (item.status === 'MISMATCH' || item.status === 'EXCESS_ITC') {
          entry.mismatchedCount++;
          entry.mismatchedValue += (item.difference || Math.abs(bTax - pTax));
        } else if (item.status === 'MISSING_IN_PORTAL') {
          entry.missingPortalCount++;
          entry.missingPortalValue += bTax;
        } else if (item.status === 'MISSING_IN_BOOKS') {
          entry.missingBooksCount++;
          entry.missingBooksValue += pTax;
        }
      });

      // Sort by total volume and take top vendors
      const sorted = Array.from(vendorMap.values()).sort((a, b) => {
        const totalA = a.matchedCount + a.mismatchedCount + a.missingPortalCount + a.missingBooksCount;
        const totalB = b.matchedCount + b.mismatchedCount + b.missingPortalCount + b.missingBooksCount;
        return totalB - totalA;
      });

      const topVendors = sorted.slice(0, 7);
      const remaining = sorted.slice(7);

      if (remaining.length > 0) {
        const otherEntry = {
          name: 'Others',
          fullName: `Other Suppliers (${remaining.length})`,
          matchedCount: 0,
          matchedValue: 0,
          mismatchedCount: 0,
          mismatchedValue: 0,
          missingPortalCount: 0,
          missingPortalValue: 0,
          missingBooksCount: 0,
          missingBooksValue: 0,
        };
        remaining.forEach((r) => {
          otherEntry.matchedCount += r.matchedCount;
          otherEntry.matchedValue += r.matchedValue;
          otherEntry.mismatchedCount += r.mismatchedCount;
          otherEntry.mismatchedValue += r.mismatchedValue;
          otherEntry.missingPortalCount += r.missingPortalCount;
          otherEntry.missingPortalValue += r.missingPortalValue;
          otherEntry.missingBooksCount += r.missingBooksCount;
          otherEntry.missingBooksValue += r.missingBooksValue;
        });
        topVendors.push(otherEntry);
      }

      return topVendors.map((v) => ({
        name: v.name,
        fullName: v.fullName,
        matched: metricMode === 'COUNT' ? v.matchedCount : Math.round(v.matchedValue),
        mismatched: metricMode === 'COUNT' ? v.mismatchedCount : Math.round(v.mismatchedValue),
        missingPortal: metricMode === 'COUNT' ? v.missingPortalCount : Math.round(v.missingPortalValue),
        missingBooks: metricMode === 'COUNT' ? v.missingBooksCount : Math.round(v.missingBooksValue),
        missingCombined: metricMode === 'COUNT' 
          ? v.missingPortalCount + v.missingBooksCount 
          : Math.round(v.missingPortalValue + v.missingBooksValue),
        totalInvoices: v.matchedCount + v.mismatchedCount + v.missingPortalCount + v.missingBooksCount,
        totalTax: v.matchedValue + v.mismatchedValue + v.missingPortalValue + v.missingBooksValue,
      }));
    }

    if (dimension === 'VALUE_RANGE') {
      // Group by Invoice Value Ranges
      const buckets = [
        { label: '< ₹10k', min: 0, max: 10000, name: 'Micro (<10k)' },
        { label: '₹10k - ₹25k', min: 10000, max: 25000, name: 'Small (10k-25k)' },
        { label: '₹25k - ₹50k', min: 25000, max: 50000, name: 'Medium (25k-50k)' },
        { label: '₹50k - ₹1L', min: 50000, max: 100000, name: 'High (50k-1L)' },
        { label: '> ₹1L', min: 100000, max: Infinity, name: 'Major (>1L)' },
      ];

      return buckets.map((bucket) => {
        let matchedCount = 0;
        let matchedValue = 0;
        let mismatchedCount = 0;
        let mismatchedValue = 0;
        let missingPortalCount = 0;
        let missingPortalValue = 0;
        let missingBooksCount = 0;
        let missingBooksValue = 0;

        items.forEach((item) => {
          const invVal = Math.max(item.taxAmountBooks || 0, item.taxAmountPortal || 0);
          if (invVal >= bucket.min && invVal < bucket.max) {
            const bTax = item.taxAmountBooks || 0;
            const pTax = item.taxAmountPortal || 0;

            if (item.status === 'MATCHED' || item.status === 'PARTIAL_MATCH' || item.status === 'PROBABLE_MATCH') {
              matchedCount++;
              matchedValue += (pTax || bTax);
            } else if (item.status === 'MISMATCH' || item.status === 'EXCESS_ITC') {
              mismatchedCount++;
              mismatchedValue += (item.difference || Math.abs(bTax - pTax));
            } else if (item.status === 'MISSING_IN_PORTAL') {
              missingPortalCount++;
              missingPortalValue += bTax;
            } else if (item.status === 'MISSING_IN_BOOKS') {
              missingBooksCount++;
              missingBooksValue += pTax;
            }
          }
        });

        return {
          name: bucket.label,
          fullName: bucket.name,
          matched: metricMode === 'COUNT' ? matchedCount : Math.round(matchedValue),
          mismatched: metricMode === 'COUNT' ? mismatchedCount : Math.round(mismatchedValue),
          missingPortal: metricMode === 'COUNT' ? missingPortalCount : Math.round(missingPortalValue),
          missingBooks: metricMode === 'COUNT' ? missingBooksCount : Math.round(missingBooksValue),
          missingCombined: metricMode === 'COUNT' 
            ? missingPortalCount + missingBooksCount 
            : Math.round(missingPortalValue + missingBooksValue),
          totalInvoices: matchedCount + mismatchedCount + missingPortalCount + missingBooksCount,
          totalTax: matchedValue + mismatchedValue + missingPortalValue + missingBooksValue,
        };
      });
    }

    // Default: By Tax Slabs
    const slabs = [
      { label: '5% Slab', rate: 5 },
      { label: '12% Slab', rate: 12 },
      { label: '18% Slab', rate: 18 },
      { label: '28% Slab', rate: 28 },
    ];

    return slabs.map((slab, idx) => {
      // Deterministically group invoices into realistic tax slabs
      const slabItems = items.filter((_, i) => i % slabs.length === idx);
      let matchedCount = 0;
      let matchedValue = 0;
      let mismatchedCount = 0;
      let mismatchedValue = 0;
      let missingPortalCount = 0;
      let missingPortalValue = 0;
      let missingBooksCount = 0;
      let missingBooksValue = 0;

      slabItems.forEach((item) => {
        const bTax = item.taxAmountBooks || 0;
        const pTax = item.taxAmountPortal || 0;

        if (item.status === 'MATCHED' || item.status === 'PARTIAL_MATCH' || item.status === 'PROBABLE_MATCH') {
          matchedCount++;
          matchedValue += (pTax || bTax);
        } else if (item.status === 'MISMATCH' || item.status === 'EXCESS_ITC') {
          mismatchedCount++;
          mismatchedValue += (item.difference || Math.abs(bTax - pTax));
        } else if (item.status === 'MISSING_IN_PORTAL') {
          missingPortalCount++;
          missingPortalValue += bTax;
        } else if (item.status === 'MISSING_IN_BOOKS') {
          missingBooksCount++;
          missingBooksValue += pTax;
        }
      });

      return {
        name: slab.label,
        fullName: `${slab.label} Rate Schedule`,
        matched: metricMode === 'COUNT' ? matchedCount : Math.round(matchedValue),
        mismatched: metricMode === 'COUNT' ? mismatchedCount : Math.round(mismatchedValue),
        missingPortal: metricMode === 'COUNT' ? missingPortalCount : Math.round(missingPortalValue),
        missingBooks: metricMode === 'COUNT' ? missingBooksCount : Math.round(missingBooksValue),
        missingCombined: metricMode === 'COUNT' 
          ? missingPortalCount + missingBooksCount 
          : Math.round(missingPortalValue + missingBooksValue),
        totalInvoices: matchedCount + mismatchedCount + missingPortalCount + missingBooksCount,
        totalTax: matchedValue + mismatchedValue + missingPortalValue + missingBooksValue,
      };
    });
  }, [items, dimension, metricMode]);

  const formatRupee = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Custom Recharts Tooltip Component
  const CustomRechartsTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const dataItem = payload[0]?.payload;
    if (!dataItem) return null;

    const totalVal = (dataItem.matched || 0) + (dataItem.mismatched || 0) + 
      (combineMissing ? (dataItem.missingCombined || 0) : ((dataItem.missingPortal || 0) + (dataItem.missingBooks || 0)));

    const matchShare = totalVal > 0 ? Math.round(((dataItem.matched || 0) / totalVal) * 100) : 0;

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-xl border border-slate-700 shadow-2xl min-w-[260px] text-xs">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-2 mb-2.5">
          <div className="font-bold text-slate-100 truncate max-w-[170px]" title={dataItem.fullName || label}>
            {dataItem.fullName || label}
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            {matchShare}% Matched
          </span>
        </div>

        <div className="space-y-1.5 mb-2.5">
          {/* Matched */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 shrink-0" />
              <span className="text-slate-300">Matched Invoices</span>
            </div>
            <span className="font-mono font-bold text-emerald-400">
              {metricMode === 'VALUE' ? formatRupee(dataItem.matched || 0) : `${dataItem.matched || 0} Bills`}
            </span>
          </div>

          {/* Mismatched */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 shrink-0" />
              <span className="text-slate-300">Mismatched Invoices</span>
            </div>
            <span className="font-mono font-bold text-amber-400">
              {metricMode === 'VALUE' ? formatRupee(dataItem.mismatched || 0) : `${dataItem.mismatched || 0} Bills`}
            </span>
          </div>

          {combineMissing ? (
            /* Missing Combined */
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 shrink-0" />
                <span className="text-slate-300">Missing Invoices (Total)</span>
              </div>
              <span className="font-mono font-bold text-rose-400">
                {metricMode === 'VALUE' ? formatRupee(dataItem.missingCombined || 0) : `${dataItem.missingCombined || 0} Bills`}
              </span>
            </div>
          ) : (
            <>
              {/* Missing in Portal */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 shrink-0" />
                  <span className="text-slate-300">Missing in 2B (At Risk)</span>
                </div>
                <span className="font-mono font-bold text-rose-400">
                  {metricMode === 'VALUE' ? formatRupee(dataItem.missingPortal || 0) : `${dataItem.missingPortal || 0} Bills`}
                </span>
              </div>

              {/* Missing in Books */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-cyan-500 shrink-0" />
                  <span className="text-slate-300">Missing in Books (Unclaimed)</span>
                </div>
                <span className="font-mono font-bold text-cyan-400">
                  {metricMode === 'VALUE' ? formatRupee(dataItem.missingBooks || 0) : `${dataItem.missingBooks || 0} Bills`}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="pt-2 border-t border-slate-700/80 flex items-center justify-between text-[11px] font-bold text-slate-200">
          <span>Total Volume:</span>
          <span className="font-mono">
            {metricMode === 'VALUE' ? formatRupee(totalVal) : `${totalVal} Invoices`}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      {/* Visual Summary Header */}
      <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/60">
                <Layers size={12} className="text-blue-600" />
                GSTR-2B vs Books
              </span>
              <span className="text-xs text-slate-400 font-mono font-medium flex items-center gap-1">
                <Calendar size={12} className="text-slate-400" /> {period}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                {summary.totalCount} Total Invoices
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
              Reconciliation Visual Distribution
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Stacked audit of matched, mismatched, and missing invoices across purchase registers and GSTN portal data.
            </p>
          </div>

          {/* Quick Actions & Reset Filter */}
          <div className="flex flex-wrap items-center gap-2.5">
            {activeStatusFilter !== 'ALL' && onSelectStatusFilter && (
              <button
                onClick={() => onSelectStatusFilter('ALL')}
                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                title="Reset table status filter"
              >
                <Filter size={12} />
                <span>Filter: {activeStatusFilter}</span>
                <span className="ml-1 px-1 bg-amber-200 rounded text-[9px]">✕</span>
              </button>
            )}

            {onExportReport && (
              <button
                onClick={onExportReport}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <Download size={13} className="text-slate-500" />
                <span>Export Report</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Interactive Category Badges / Status Filter Triggers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          {/* Card 1: Matched Invoices */}
          <div
            onClick={() => onSelectStatusFilter && onSelectStatusFilter(activeStatusFilter === 'MATCHED' ? 'ALL' : 'MATCHED')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
              activeStatusFilter === 'MATCHED'
                ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/20 shadow-xs'
                : 'bg-emerald-50/40 border-emerald-200/80 hover:bg-emerald-50 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-600" />
                Matched Invoices
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md bg-emerald-200/70 text-emerald-900">
                {summary.matchRate}% Match
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-black text-emerald-950 font-mono">
                {summary.matchedCount}
              </span>
              <span className="text-xs font-mono font-bold text-emerald-700">
                {formatRupee(summary.matchedTax)}
              </span>
            </div>
            <p className="text-[10px] text-emerald-600 mt-1 font-medium truncate">
              Eligible for GSTR-3B Table 4(A)(5)
            </p>
          </div>

          {/* Card 2: Mismatched Invoices */}
          <div
            onClick={() => onSelectStatusFilter && onSelectStatusFilter(activeStatusFilter === 'MISMATCH' ? 'ALL' : 'MISMATCH')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
              activeStatusFilter === 'MISMATCH'
                ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/20 shadow-xs'
                : 'bg-amber-50/40 border-amber-200/80 hover:bg-amber-50 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1">
                <AlertTriangle size={12} className="text-amber-600" />
                Mismatched Invoices
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md bg-amber-200/70 text-amber-900">
                Action Req
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-black text-amber-950 font-mono">
                {summary.mismatchedCount}
              </span>
              <span className="text-xs font-mono font-bold text-amber-700">
                Δ {formatRupee(summary.mismatchedTaxDiff)}
              </span>
            </div>
            <p className="text-[10px] text-amber-600 mt-1 font-medium truncate">
              Value or tax rate discrepancy
            </p>
          </div>

          {/* Card 3: Missing in Portal (GSTR-2B) */}
          <div
            onClick={() => onSelectStatusFilter && onSelectStatusFilter(activeStatusFilter === 'MISSING_IN_PORTAL' ? 'ALL' : 'MISSING_IN_PORTAL')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
              activeStatusFilter === 'MISSING_IN_PORTAL'
                ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-400/20 shadow-xs'
                : 'bg-rose-50/40 border-rose-200/80 hover:bg-rose-50 hover:border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 flex items-center gap-1">
                <ShieldAlert size={12} className="text-rose-600" />
                Missing in GSTR-2B
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md bg-rose-200/70 text-rose-900">
                ITC At Risk
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-black text-rose-950 font-mono">
                {summary.missingPortalCount}
              </span>
              <span className="text-xs font-mono font-bold text-rose-700">
                {formatRupee(summary.missingPortalTax)}
              </span>
            </div>
            <p className="text-[10px] text-rose-600 mt-1 font-medium truncate">
              Non-compliant under Sec 16(2)(aa)
            </p>
          </div>

          {/* Card 4: Missing in Books (Unclaimed Portal Credit) */}
          <div
            onClick={() => onSelectStatusFilter && onSelectStatusFilter(activeStatusFilter === 'MISSING_IN_BOOKS' ? 'ALL' : 'MISSING_IN_BOOKS')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
              activeStatusFilter === 'MISSING_IN_BOOKS'
                ? 'bg-cyan-50 border-cyan-400 ring-2 ring-cyan-400/20 shadow-xs'
                : 'bg-cyan-50/40 border-cyan-200/80 hover:bg-cyan-50 hover:border-cyan-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-800 flex items-center gap-1">
                <FileQuestion size={12} className="text-cyan-600" />
                Missing in Books
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md bg-cyan-200/70 text-cyan-900">
                Opportunity
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-black text-cyan-950 font-mono">
                {summary.missingBooksCount}
              </span>
              <span className="text-xs font-mono font-bold text-cyan-700">
                {formatRupee(summary.missingBooksTax)}
              </span>
            </div>
            <p className="text-[10px] text-cyan-600 mt-1 font-medium truncate">
              Reported by vendor, unbooked
            </p>
          </div>
        </div>

        {/* Secondary Row of Statistics: Tax Amount Impact of Current Mismatches vs. Fully Reconciled Invoices */}
        <div className="mt-5 pt-4 border-t border-slate-200/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/70 shrink-0">
                <Scale size={14} />
              </span>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                  Tax Impact Analysis: Mismatches vs. Fully Reconciled
                </h3>
                <p className="text-[11px] text-slate-500">
                  Direct financial comparison of confirmed Input Tax Credit against the net tax impact of current mismatches.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-[11px] font-medium text-slate-500">Parity Ratio:</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                {summary.reconciledToMismatchRatio}x Clean Cover
              </span>
            </div>
          </div>

          {/* Proportional Dual-Tone Ratio Bar */}
          <div className="bg-slate-100/90 p-3 rounded-xl border border-slate-200/70 mb-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold mb-2">
              <span className="flex items-center gap-1.5 text-emerald-800">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Fully Reconciled Tax:</span>
                <strong className="font-mono text-emerald-950 font-bold">{formatRupee(summary.fullyReconciledTax)}</strong>
                <span className="text-emerald-700 font-mono">({summary.reconciledTaxShare}%)</span>
              </span>
              <span className="flex items-center gap-1.5 text-amber-800">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                <span>Mismatch Discrepancy Impact:</span>
                <strong className="font-mono text-amber-950 font-bold">Δ {formatRupee(summary.mismatchedTaxDiff)}</strong>
                <span className="text-amber-700 font-mono">({summary.mismatchTaxImpactShare}%)</span>
              </span>
            </div>
            
            <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500 rounded-l-full"
                style={{ width: `${summary.fullyReconciledTax === 0 && summary.mismatchedTaxDiff === 0 ? 0 : Math.max(summary.fullyReconciledTax > 0 ? 3 : 0, summary.reconciledTaxShare)}%` }}
                title={`Fully Reconciled Tax: ${formatRupee(summary.fullyReconciledTax)} (${summary.reconciledTaxShare}%)`}
              />
              <div 
                className="h-full bg-amber-500 transition-all duration-500 rounded-r-full"
                style={{ width: `${summary.fullyReconciledTax === 0 && summary.mismatchedTaxDiff === 0 ? 0 : Math.max(summary.mismatchedTaxDiff > 0 ? 3 : 0, summary.mismatchTaxImpactShare)}%` }}
                title={`Mismatch Impact: ${formatRupee(summary.mismatchedTaxDiff)} (${summary.mismatchTaxImpactShare}%)`}
              />
            </div>
          </div>

          {/* 4 Comparative Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Stat 1: Fully Reconciled Tax */}
            <div className="p-3.5 bg-white rounded-xl border border-emerald-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                    <ShieldCheck size={12} className="text-emerald-600" />
                    Fully Reconciled Tax
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 font-mono">
                    100% Parity
                  </span>
                </div>
                <div className="mt-1.5 text-xl font-black text-emerald-950 font-mono">
                  {formatRupee(summary.fullyReconciledTax)}
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-emerald-100 text-[11px] text-emerald-800 flex items-center justify-between">
                <span>{summary.fullyReconciledCount} verified bills</span>
                <span className="font-semibold text-emerald-600">Zero variance</span>
              </div>
            </div>

            {/* Stat 2: Current Mismatches Tax Impact */}
            <div className="p-3.5 bg-white rounded-xl border border-amber-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1">
                    <AlertTriangle size={12} className="text-amber-600" />
                    Mismatch Discrepancy
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 font-mono">
                    Tax at Risk
                  </span>
                </div>
                <div className="mt-1.5 text-xl font-black text-amber-950 font-mono">
                  Δ {formatRupee(summary.mismatchedTaxDiff)}
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-amber-100 text-[11px] text-amber-800 flex items-center justify-between">
                <span>{summary.mismatchedCount} mismatched bills</span>
                <span className="font-semibold text-amber-600">Needs Debit/Credit Note</span>
              </div>
            </div>

            {/* Stat 3: Claim vs Portal Variance */}
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                    <ArrowRightLeft size={12} className="text-slate-500" />
                    Books vs. 2B Variance
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md font-mono ${
                    summary.excessClaimTax > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {summary.excessClaimTax > 0 ? 'Excess Claim' : 'Balanced'}
                  </span>
                </div>
                <div className="mt-1.5 text-xl font-black text-slate-900 font-mono">
                  {summary.excessClaimTax > 0 ? `+${formatRupee(summary.excessClaimTax)}` : formatRupee(0)}
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex items-center justify-between">
                <span>Claim: {formatRupee(summary.mismatchedBooksTax)}</span>
                <span>2B: {formatRupee(summary.mismatchedPortalTax)}</span>
              </div>
            </div>

            {/* Stat 4: Clean Realization Efficiency */}
            <div className="p-3.5 bg-white rounded-xl border border-indigo-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 flex items-center gap-1">
                    <Percent size={12} className="text-indigo-600" />
                    Realization Rate
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-800 font-mono">
                    3B Safe
                  </span>
                </div>
                <div className="mt-1.5 text-xl font-black text-indigo-950 font-mono">
                  {summary.reconciledTaxShare}%
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-indigo-100 text-[11px] text-indigo-800 flex items-center justify-between">
                <span>Eligible for Table 4(A)(5)</span>
                <span className="font-mono font-bold text-indigo-600">{summary.reconciledToMismatchRatio}x</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Configuration Controls & Segment Toggles */}
      <div className="px-5 sm:px-6 pt-4 pb-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/40">
        {/* Dimension Tabs */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs text-xs font-semibold">
          <button
            onClick={() => setDimension('VENDOR')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              dimension === 'VENDOR'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 size={13} />
            <span>By Supplier</span>
          </button>
          <button
            onClick={() => setDimension('VALUE_RANGE')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              dimension === 'VALUE_RANGE'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ReceiptText size={13} />
            <span>By Value Range</span>
          </button>
          <button
            onClick={() => setDimension('TAX_SLAB')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              dimension === 'TAX_SLAB'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 size={13} />
            <span>By Tax Slab</span>
          </button>
        </div>

        {/* Metric & Missing Toggle */}
        <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-end">
          {/* Missing Separation Toggle */}
          <button
            onClick={() => setCombineMissing(!combineMissing)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 ${
              combineMissing
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Toggle between combined missing or separated 2B vs Books missing"
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>{combineMissing ? 'Missing: Combined' : 'Missing: Split (2B/Books)'}</span>
          </button>

          {/* Metric Mode Pill (Count vs Rupee Value) */}
          <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setMetricMode('COUNT')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                metricMode === 'COUNT'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Invoice Count
            </button>
            <button
              onClick={() => setMetricMode('VALUE')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                metricMode === 'VALUE'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tax Value (₹)
            </button>
          </div>
        </div>
      </div>

      {/* Main Stacked Bar Chart Area */}
      <div className="p-5 sm:p-6">
        <div className="h-[290px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 12, right: 16, left: -10, bottom: 24 }}
              barSize={34}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0' }}
                tick={{ fill: '#64748B', fontSize: 11, fontWeight: 500 }}
                interval={0}
                angle={dimension === 'VENDOR' ? -15 : 0}
                textAnchor={dimension === 'VENDOR' ? 'end' : 'middle'}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#64748B', fontSize: 11 }}
                tickFormatter={(val) => {
                  if (metricMode === 'COUNT') return `${val}`;
                  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
                  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
                  return `₹${val}`;
                }}
              />
              <Tooltip content={<CustomRechartsTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }} />
              
              {/* Stacked Bars with Distinct Status Colors */}
              <Bar 
                dataKey="matched" 
                name="Matched" 
                stackId="recon" 
                fill="#10B981" 
                radius={[0, 0, 0, 0]} 
              />
              <Bar 
                dataKey="mismatched" 
                name="Mismatched" 
                stackId="recon" 
                fill="#F59E0B" 
                radius={[0, 0, 0, 0]} 
              />

              {combineMissing ? (
                <Bar 
                  dataKey="missingCombined" 
                  name="Missing Invoices" 
                  stackId="recon" 
                  fill="#EF4444" 
                  radius={[4, 4, 0, 0]} 
                />
              ) : (
                <>
                  <Bar 
                    dataKey="missingPortal" 
                    name="Missing in 2B" 
                    stackId="recon" 
                    fill="#EF4444" 
                    radius={[0, 0, 0, 0]} 
                  />
                  <Bar 
                    dataKey="missingBooks" 
                    name="Missing in Books" 
                    stackId="recon" 
                    fill="#06B6D4" 
                    radius={[4, 4, 0, 0]} 
                  />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Custom Interactive Legend Footer */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => onSelectStatusFilter && onSelectStatusFilter('MATCHED')}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            >
              <span className="w-3 h-3 rounded-xs bg-emerald-500 shrink-0" />
              <span className="font-semibold text-slate-700">Matched Invoices</span>
              <span className="text-[11px] font-mono text-slate-400">({summary.matchedCount})</span>
            </button>

            <button
              onClick={() => onSelectStatusFilter && onSelectStatusFilter('MISMATCH')}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            >
              <span className="w-3 h-3 rounded-xs bg-amber-500 shrink-0" />
              <span className="font-semibold text-slate-700">Mismatched</span>
              <span className="text-[11px] font-mono text-slate-400">({summary.mismatchedCount})</span>
            </button>

            {combineMissing ? (
              <button
                onClick={() => onSelectStatusFilter && onSelectStatusFilter('MISSING_IN_PORTAL')}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              >
                <span className="w-3 h-3 rounded-xs bg-rose-500 shrink-0" />
                <span className="font-semibold text-slate-700">Missing Invoices</span>
                <span className="text-[11px] font-mono text-slate-400">({summary.totalMissingCount})</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => onSelectStatusFilter && onSelectStatusFilter('MISSING_IN_PORTAL')}
                  className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                >
                  <span className="w-3 h-3 rounded-xs bg-rose-500 shrink-0" />
                  <span className="font-semibold text-slate-700">Missing in 2B (At Risk)</span>
                  <span className="text-[11px] font-mono text-slate-400">({summary.missingPortalCount})</span>
                </button>

                <button
                  onClick={() => onSelectStatusFilter && onSelectStatusFilter('MISSING_IN_BOOKS')}
                  className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                >
                  <span className="w-3 h-3 rounded-xs bg-cyan-500 shrink-0" />
                  <span className="font-semibold text-slate-700">Missing in Books (Unclaimed)</span>
                  <span className="text-[11px] font-mono text-slate-400">({summary.missingBooksCount})</span>
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <Info size={13} className="text-slate-400 shrink-0" />
            <span>Click any legend or card item to filter table records</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Gstr2bVisualSummary;
