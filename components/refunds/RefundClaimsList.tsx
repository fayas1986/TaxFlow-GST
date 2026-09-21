import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  FileText, 
  ArrowRight, 
  Building2, 
  Landmark, 
  ShieldAlert, 
  Download, 
  Eye, 
  ChevronRight,
  Sparkles,
  Layers,
  ArrowUpRight,
  TrendingUp,
  XCircle,
  FileCheck,
  Printer,
  FileDown
} from 'lucide-react';
import { ItcRefundClaim, RefundCategory, RefundProcessingStatus } from '../../services/refundService';
import { RefundDossierGenerator } from '../../services/refundDossierGenerator';
import { TxCompliancePagination } from '../TxCompliancePagination';

interface RefundClaimsListProps {
  claims: ItcRefundClaim[];
  onSelectClaim: (claim: ItcRefundClaim) => void;
  onOpenNewClaimModal: () => void;
  onExportCsv: () => void;
}

export const RefundClaimsList: React.FC<RefundClaimsListProps> = ({
  claims,
  onSelectClaim,
  onOpenNewClaimModal,
  onExportCsv
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatusGroup, setSelectedStatusGroup] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS'>('TABLE');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const getCategoryBadge = (cat: RefundCategory) => {
    switch (cat) {
      case 'EXPORT_WITHOUT_TAX':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            Export (LUT)
          </span>
        );
      case 'INVERTED_DUTY_STRUCTURE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            Inverted Duty (IDS)
          </span>
        );
      case 'SEZ_WITHOUT_TAX':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
            SEZ Supplies
          </span>
        );
      case 'EXCESS_CASH_LEDGER':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Cash Ledger Excess
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">
            {cat.replace(/_/g, ' ')}
          </span>
        );
    }
  };

  const getStatusBadge = (status: RefundProcessingStatus) => {
    switch (status) {
      case 'RFD05_DISBURSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 size={13} className="text-emerald-700" /> Disbursed (PFMS)
          </span>
        );
      case 'RFD06_SANCTIONED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
            <FileCheck size={13} /> Final Sanction Order
          </span>
        );
      case 'RFD04_PROVISIONALLY_SANCTIONED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
            <TrendingUp size={13} /> 90% Provisionally Sanctioned
          </span>
        );
      case 'UNDER_SCRUTINY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-blue-50 text-blue-700 border border-blue-200">
            <Clock size={13} /> Under Verification
          </span>
        );
      case 'RFD02_ACKNOWLEDGED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-slate-100 text-slate-700 border border-slate-200">
            RFD-02 Acknowledged
          </span>
        );
      case 'RFD01_FILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-slate-100 text-slate-600 border border-slate-200">
            RFD-01 Filed
          </span>
        );
      case 'RFD03_DEFICIENCY_MEMO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
            <AlertTriangle size={13} className="text-amber-700" /> Deficiency Memo (Action Due)
          </span>
        );
      case 'RFD08_SCN_ISSUED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-rose-100 text-rose-900 border border-rose-300 animate-pulse">
            <ShieldAlert size={13} className="text-rose-700" /> SCN Issued (Reply Due)
          </span>
        );
      case 'RFD09_REPLY_SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-purple-50 text-purple-700 border border-purple-200">
            Taxpayer Reply Filed
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle size={13} /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const getSlaBadge = (claim: ItcRefundClaim) => {
    const { sla } = claim;
    if (claim.status === 'RFD05_DISBURSED') {
      return (
        <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
          <CheckCircle2 size={12} /> Closed in {sla.daysElapsed} days
        </span>
      );
    }

    if (sla.isInterestApplicable) {
      return (
        <div className="flex flex-col">
          <span className="text-[11px] font-black text-rose-700 flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
            <AlertTriangle size={11} /> {sla.daysElapsed}d (Delay: +{sla.daysElapsed - 60}d)
          </span>
          <span className="text-[10px] font-bold text-rose-600 mt-0.5">
            +₹{sla.accruedInterest.toLocaleString('en-IN')} (6% Sec 56)
          </span>
        </div>
      );
    }

    if (sla.urgencyLevel === 'OVERDUE' || sla.urgencyLevel === 'ATTENTION') {
      return (
        <div className="flex flex-col">
          <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
            {sla.daysRemaining} days remaining
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 font-medium">
            Elapsed: {sla.daysElapsed} / 60d limit
          </span>
        </div>
      );
    }

    return (
      <div className="flex flex-col">
        <span className="text-[11px] font-bold text-slate-700">
          {sla.daysRemaining} days remaining
        </span>
        <span className="text-[10px] text-slate-400 font-medium">
          Elapsed: {sla.daysElapsed} / 60d
        </span>
      </div>
    );
  };

  const filteredClaims = useMemo(() => {
    return claims.filter((c) => {
      // Search
      const searchMatch =
        searchTerm === '' ||
        c.arn.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.legalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.taxPeriod.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.jurisdiction.assignedOfficerName.toLowerCase().includes(searchTerm.toLowerCase());

      // Category
      const categoryMatch = selectedCategory === 'ALL' || c.category === selectedCategory;

      // Status Group
      let statusMatch = true;
      if (selectedStatusGroup === 'ACTION_REQUIRED') {
        statusMatch = c.status === 'RFD03_DEFICIENCY_MEMO' || c.status === 'RFD08_SCN_ISSUED';
      } else if (selectedStatusGroup === 'IN_PROGRESS') {
        statusMatch =
          c.status === 'RFD01_FILED' ||
          c.status === 'RFD02_ACKNOWLEDGED' ||
          c.status === 'UNDER_SCRUTINY' ||
          c.status === 'RFD04_PROVISIONALLY_SANCTIONED' ||
          c.status === 'RFD09_REPLY_SUBMITTED' ||
          c.status === 'RFD06_SANCTIONED';
      } else if (selectedStatusGroup === 'DISBURSED') {
        statusMatch = c.status === 'RFD05_DISBURSED';
      } else if (selectedStatusGroup === 'SLA_OVERDUE') {
        statusMatch = c.sla.isInterestApplicable;
      }

      return searchMatch && categoryMatch && statusMatch;
    });
  }, [claims, searchTerm, selectedCategory, selectedStatusGroup]);

  const totalPages = Math.max(1, Math.ceil(filteredClaims.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedClaims = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredClaims.slice(start, start + pageSize);
  }, [filteredClaims, safeCurrentPage, pageSize]);

  return (
    <div className="space-y-4">
      {/* Control Bar: Search, Filters, New Application, Export */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Search & Category Filter */}
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ARN, Tax Period, Category, or Officer..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all font-medium text-slate-800 placeholder-slate-400"
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-hidden focus:border-blue-500"
          >
            <option value="ALL">All Categories</option>
            <option value="EXPORT_WITHOUT_TAX">Export without Tax (LUT)</option>
            <option value="INVERTED_DUTY_STRUCTURE">Inverted Duty Structure (IDS)</option>
            <option value="SEZ_WITHOUT_TAX">SEZ Unit / Developer</option>
            <option value="EXCESS_CASH_LEDGER">Electronic Cash Ledger Excess</option>
          </select>

          {/* Status Group Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'ACTION_REQUIRED', label: 'Notices / Action Required' },
              { id: 'IN_PROGRESS', label: 'Processing' },
              { id: 'DISBURSED', label: 'Disbursed' },
              { id: 'SLA_OVERDUE', label: 'SLA Delay (>60d)' }
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => {
                  setSelectedStatusGroup(st.id);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                  selectedStatusGroup === st.id
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onExportCsv}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 border border-slate-200"
            title="Export Statutory Refund Register"
          >
            <Download size={14} /> Export Register
          </button>

          <button
            onClick={onOpenNewClaimModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
          >
            <Sparkles size={14} /> New Refund Claim (RFD-01)
          </button>
        </div>
      </div>

      {/* Claims Table View */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/90">
              <tr>
                <th className="px-6 py-4">Filing Details & ARN</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Claim & Disbursed Amount</th>
                <th className="px-6 py-4">Processing Status</th>
                <th className="px-6 py-4">Statutory SLA (Sec 54/56)</th>
                <th className="px-6 py-4">Proper Officer / Ward</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedClaims.length > 0 ? (
                paginatedClaims.map((claim) => (
                  <tr
                    key={claim.id}
                    onClick={() => onSelectClaim(claim)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  >
                    {/* Filing Details & ARN */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-bold text-blue-600 group-hover:text-blue-700 flex items-center gap-1">
                          {claim.arn}
                          <ArrowUpRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                        <span className="text-xs font-bold text-slate-800 mt-0.5">
                          {claim.taxPeriod} ({claim.financialYear})
                        </span>
                        <span className="text-[11px] text-slate-400 mt-0.5">
                          Filed on: {claim.filingDate}
                        </span>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-6 py-4">
                      {getCategoryBadge(claim.category)}
                      {claim.icegate && (
                        <div className="text-[10px] text-cyan-700 font-bold mt-1">
                          ICEGATE: {claim.icegate.egmMatched}/{claim.icegate.totalShippingBills} SB Matched
                        </div>
                      )}
                    </td>

                    {/* Claim & Disbursed Amount */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900">
                          {formatCurrency(claim.amountClaimed.total)}
                        </span>
                        {claim.amountDisbursed > 0 ? (
                          <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                            <CheckCircle2 size={11} /> Disbursed: {formatCurrency(claim.amountDisbursed)}
                          </span>
                        ) : claim.amountProvisionallySanctioned ? (
                          <span className="text-[11px] font-bold text-indigo-600 mt-0.5">
                            90% Sanctioned: {formatCurrency(claim.amountProvisionallySanctioned.total)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                            IGST: {formatCurrency(claim.amountClaimed.igst)} | CG+SG: {formatCurrency(claim.amountClaimed.cgst + claim.amountClaimed.sgst)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Processing Status & Progress */}
                    <td className="px-6 py-4">
                      <div className="space-y-1.5">
                        {getStatusBadge(claim.status)}
                        {/* Stage Progress Bar */}
                        <div className="w-36 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              claim.status === 'RFD05_DISBURSED'
                                ? 'bg-emerald-500'
                                : claim.status === 'RFD03_DEFICIENCY_MEMO' || claim.status === 'RFD08_SCN_ISSUED'
                                ? 'bg-amber-500'
                                : 'bg-blue-600'
                            }`}
                            style={{ width: `${claim.stageProgressPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Statutory SLA */}
                    <td className="px-6 py-4">
                      {getSlaBadge(claim)}
                    </td>

                    {/* Proper Officer / Ward */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col max-w-[180px]">
                        <span className="text-xs font-bold text-slate-800 truncate" title={claim.jurisdiction.assignedOfficerName}>
                          {claim.jurisdiction.assignedOfficerName}
                        </span>
                        <span className="text-[10px] text-slate-500 truncate" title={claim.jurisdiction.division}>
                          {claim.jurisdiction.division}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {claim.banking.bankName.split(' ')[0]} ({claim.banking.accountNumberMasked.slice(-4)})
                        </span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            RefundDossierGenerator.printRefundDossier(claim);
                          }}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-xs transition-colors border border-slate-200 cursor-pointer shadow-2xs"
                          title="Quick Print Dossier (PDF)"
                          aria-label="Quick Print Dossier"
                        >
                          <Printer size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectClaim(claim);
                          }}
                          className="px-3 py-1.5 bg-slate-50 group-hover:bg-blue-600 group-hover:text-white rounded-xl text-slate-700 text-xs font-bold transition-all border border-slate-200 group-hover:border-blue-600 shadow-2xs cursor-pointer"
                        >
                          Inspect
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <AlertTriangle size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-700">No refund claims match the selected criteria.</p>
                    <p className="text-xs text-slate-400 mt-1">Try resetting the search query or category filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredClaims.length > 0 && (
          <TxCompliancePagination
            currentPage={safeCurrentPage}
            totalItems={filteredClaims.length}
            pageSize={pageSize}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            itemLabel="refund claims"
            pageSizeOptions={[5, 10, 20, 50]}
          />
        )}
      </div>
    </div>
  );
};
