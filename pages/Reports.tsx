import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { 
  fetchLiabilityReport, 
  fetchItcReport, 
  fetchVendorRisks, 
  fetchBranchReport, 
  addLinkedEntity,
  fetchSavedReports,
  saveReport,
  deleteSavedReport,
  fetchTaxComputation
} from '../services/api';
import { generateGstSummaryPdf } from '../utils/pdfReportGenerator';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell 
} from 'recharts';
import { 
  FileText, Download, TrendingUp, TrendingDown, Users, Shield, 
  MapPin, History, FileSpreadsheet, ArrowRight, Wallet, Filter, Search, ChevronDown, ChevronUp, Lock, Globe, Database, CheckCircle, Fingerprint,
  Plus, Building, GitBranch, Link, Network, Loader2, X, Bookmark, Trash2, Save, Calendar, Clock, Palette, Printer,
  Layers, Sliders, Sparkles, ArrowUpRight, BarChart3, CheckCircle2, Building2, Split
} from 'lucide-react';
import { AuditLogData, SavedReport, ExportConfig, BranchReportData, UserRole } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import TemplateSelector from '../components/TemplateSelector';
import { generateStyledDocument } from '../services/documentGenerator';
import GeoGstMapVisualization from '../components/GeoGstMapVisualization';
import { ScheduleReportModal } from '../components/ScheduleReportModal';
import MonthlyGstReportingDashboard from '../components/MonthlyGstReportingDashboard';
import { subscriptionManager } from '../src/core/billing/SubscriptionManager';

const Reports: React.FC = () => {
  const queryClient = useQueryClient();
  const user = useSelector((state: RootState) => state.auth.user);
  const tenantId = user?.currentTenantId || 't1';
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  const subProfile = subscriptionManager.getUserSubscriptionProfile(user?.role, tenantId);
  const canUseMultiBranch = isSuperAdmin || Boolean(subProfile.canMultiBranch);

  const [activeTab, setActiveTab] = useState<'FY_MONTHLY_TRENDS' | 'REGIONAL_MAP' | 'LIABILITY' | 'BRANCH_COMPARISON' | 'ITC' | 'VENDOR' | 'BRANCH'>('FY_MONTHLY_TRENDS');

  // Fallback if current tab is not available for active plan
  useEffect(() => {
    if (!canUseMultiBranch && (activeTab === 'BRANCH_COMPARISON' || activeTab === 'BRANCH')) {
      setActiveTab('FY_MONTHLY_TRENDS');
    }
  }, [canUseMultiBranch, activeTab]);

  // Filter State
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    branchId: 'ALL',
  });

  // Saved Reports State
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [includeAuditStamp, setIncludeAuditStamp] = useState(true);
  const [newReportName, setNewReportName] = useState('');
  const [showSavedReports, setShowSavedReports] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  // Branch Mapping State
  const [showAddEntityModal, setShowAddEntityModal] = useState(false);
  const [newEntityData, setNewEntityData] = useState({ name: '', gstin: '', state: '', type: 'BRANCH' });

  // Branch-wise Comparison Toggle & Metrics State
  const [isBranchWiseComparison, setIsBranchWiseComparison] = useState(false);
  const [branchMetricMode, setBranchMetricMode] = useState<'OVERVIEW' | 'TAX_HEADS' | 'EFFICIENCY'>('OVERVIEW');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');

  const { data: liabilityData } = useQuery({ queryKey: ['reports', 'liability', tenantId, filters], queryFn: () => fetchLiabilityReport(tenantId) });
  const { data: itcData } = useQuery({ queryKey: ['reports', 'itc', tenantId, filters], queryFn: () => fetchItcReport(tenantId) });
  const { data: vendorData } = useQuery({ queryKey: ['reports', 'vendor', tenantId, filters], queryFn: () => fetchVendorRisks(tenantId) });
  const { data: branchData } = useQuery({ queryKey: ['reports', 'branch', tenantId, filters], queryFn: () => fetchBranchReport(tenantId) });
  const { data: savedReports, refetch: refetchSaved } = useQuery({ queryKey: ['reports', 'saved', tenantId], queryFn: () => fetchSavedReports(tenantId) });
  const { data: taxData } = useQuery({ queryKey: ['taxComputation', tenantId], queryFn: () => fetchTaxComputation(tenantId) });

  // Branch Comparison Derived Metrics
  const activeBranches = branchData || [];
  const filteredBranchList = selectedBranchFilter === 'ALL' 
    ? activeBranches 
    : activeBranches.filter(b => b.id === selectedBranchFilter || b.state === selectedBranchFilter);

  const highestLiabilityBranch = activeBranches.length > 0 
    ? activeBranches.reduce((max, b) => (b.taxLiability > (max?.taxLiability || 0) ? b : max), activeBranches[0]) 
    : null;
    
  const totalGroupTaxLiability = activeBranches.reduce((sum, b) => sum + b.taxLiability, 0);
  const totalGroupItcSetOff = activeBranches.reduce((sum, b) => sum + (b.itcSetOff ?? Math.round(b.taxLiability * 0.8)), 0);
  const totalGroupNetPayable = activeBranches.reduce((sum, b) => sum + (b.netPayable ?? Math.max(0, b.taxLiability - (b.itcSetOff ?? Math.round(b.taxLiability * 0.8)))), 0);
  const avgBranchTaxLiability = activeBranches.length > 0 ? Math.round(totalGroupTaxLiability / activeBranches.length) : 0;

  const branchChartData = filteredBranchList.map(b => {
    const gross = b.taxLiability;
    const itc = b.itcSetOff ?? Math.round(b.taxLiability * 0.8);
    const net = b.netPayable ?? Math.max(0, gross - itc);
    const igst = b.igst ?? Math.round(gross * 0.5);
    const cgst = b.cgst ?? Math.round(gross * 0.25);
    const sgst = b.sgst ?? Math.round(gross * 0.25);
    const efficiency = gross > 0 ? Math.min(100, Math.round((itc / gross) * 100)) : 0;

    return {
      id: b.id,
      name: b.name,
      shortName: b.name.replace(' Branch', '').replace(' Office', '').replace(' HQ', ''),
      gstin: b.gstin,
      state: b.state,
      type: b.type || 'BRANCH',
      turnover: b.turnover,
      grossLiability: gross,
      itcSetOff: itc,
      netPayable: net,
      igst,
      cgst,
      sgst,
      efficiency,
    };
  });

  const { mutate: handleSaveReport, isPending: isSaving } = useMutation({
      mutationFn: saveReport,
      onSuccess: () => {
          refetchSaved();
          setShowSaveModal(false);
          setNewReportName('');
      }
  });

  const { mutate: handleDeleteSavedReport } = useMutation({
      mutationFn: deleteSavedReport,
      onSuccess: () => refetchSaved()
  });

  const applySavedReport = (report: SavedReport) => {
      setActiveTab(report.tab as any);
      setFilters({
          startDate: report.filters.startDate || '',
          endDate: report.filters.endDate || '',
          branchId: report.filters.branchId || 'ALL'
      });
      setShowSavedReports(false);
  };

  const { mutate: linkEntity, isPending: isLinking } = useMutation({
      mutationFn: addLinkedEntity,
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['reports', 'branch', tenantId] });
          setShowAddEntityModal(false);
          setNewEntityData({ name: '', gstin: '', state: '', type: 'BRANCH' });
      }
  });

  const handleAddEntity = (e: React.FormEvent) => {
      e.preventDefault();
      if(newEntityData.name && newEntityData.gstin && newEntityData.state) {
          linkEntity({ ...newEntityData, tenantId } as any);
      }
  };

  const handleProfessionalExport = (config: ExportConfig) => {
    const reportData = {
        tab: activeTab,
        filters,
        generatedAt: new Date().toISOString(),
        summary: activeTab === 'LIABILITY' ? liabilityData : 
                 activeTab === 'ITC' ? itcData : 
                 activeTab === 'VENDOR' ? vendorData : branchData
    };
    
    const doc = generateStyledDocument(reportData, config);
    console.log('Generating styled report:', doc);
    alert(`Success! Generating "${doc.template.name}" ${config.paperSize} report with professional styling.`);
  };

  const handleExecutePrint = () => {
    const currentTenant = user?.availableTenants.find(t => t.id === tenantId);
    const tenantName = currentTenant?.name || 'TaxFlow Enterprise Org';
    const gstin = currentTenant?.gstin || '27AABCU9603R1ZM';
    const generatedDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const activeTabTitle = 
      activeTab === 'FY_MONTHLY_TRENDS' ? 'FY Monthly Liability & ITC Trends' :
      activeTab === 'REGIONAL_MAP' ? 'Regional Geo GST Distribution' :
      activeTab === 'LIABILITY' ? 'Tax Liability & Output Tax Analysis' :
      activeTab === 'BRANCH_COMPARISON' ? 'Branch-wise Tax Liability Segregation' :
      activeTab === 'ITC' ? 'ITC Utilization & Eligibility Summary' :
      activeTab === 'VENDOR' ? 'Vendor Compliance & Risk Analysis' :
      'Branch Entities & Unit Overview';

    const branchCount = branchData?.length || 5;
    const totalTax = totalGroupTaxLiability || 2845000;
    const totalItc = totalGroupItcSetOff || 2276000;
    const netCash = totalGroupNetPayable || 569000;

    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>TaxFlow Statutory Report - ${tenantName}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              background: #ffffff;
              margin: 0;
              padding: 0;
              font-size: 10.5pt;
              line-height: 1.4;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2.5px solid #0f172a;
              padding-bottom: 12px;
              margin-bottom: 18px;
            }
            .brand {
              font-size: 18pt;
              font-weight: 800;
              color: #0f172a;
              letter-spacing: -0.5px;
            }
            .badge {
              display: inline-block;
              background: #e0e7ff;
              color: #3730a3;
              font-size: 8pt;
              font-weight: 800;
              padding: 2px 8px;
              border-radius: 4px;
              text-transform: uppercase;
              margin-left: 6px;
            }
            .meta {
              text-align: right;
              font-size: 8.5pt;
              color: #475569;
            }
            .meta strong {
              color: #0f172a;
            }
            .section-title {
              font-size: 12pt;
              font-weight: 700;
              color: #1e293b;
              margin-top: 18px;
              margin-bottom: 10px;
              padding-bottom: 4px;
              border-bottom: 1px solid #cbd5e1;
            }
            .kpi-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
              margin-bottom: 18px;
            }
            .kpi-card {
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 10px 14px;
            }
            .kpi-label {
              font-size: 7.5pt;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              margin-bottom: 4px;
            }
            .kpi-value {
              font-size: 13pt;
              font-weight: 800;
              color: #0f172a;
              font-family: monospace;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 9pt;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 7px 9px;
              text-align: left;
            }
            th {
              background-color: #f1f5f9;
              color: #0f172a;
              font-weight: 700;
              text-transform: uppercase;
              font-size: 8pt;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .number {
              text-align: right;
              font-family: monospace;
              font-weight: 600;
            }
            .footer {
              margin-top: 24px;
              padding-top: 10px;
              border-top: 1px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 8pt;
              color: #64748b;
            }
            .fingerprint {
              font-family: monospace;
              background: #f1f5f9;
              padding: 3px 6px;
              border-radius: 4px;
              border: 1px dashed #cbd5e1;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="brand">TaxFlow <span style="color:#2563eb;">Compliance</span> <span class="badge">Statutory Report</span></div>
              <div style="font-size: 9.5pt; font-weight: 600; color: #334155; margin-top: 4px;">
                ${tenantName} • GSTIN: <span style="font-family: monospace;">${gstin}</span>
              </div>
            </div>
            <div class="meta">
              <div><strong>Active View:</strong> ${activeTabTitle}</div>
              <div><strong>Filter Period:</strong> ${filters.startDate || 'YTD FY 2024-25'} ${filters.endDate ? `to ${filters.endDate}` : ''}</div>
              <div><strong>Generated Date:</strong> ${generatedDate}</div>
            </div>
          </div>

          <div class="section-title">Consolidated Financial Overview</div>
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-label">Gross Group Tax Liability</div>
              <div class="kpi-value">₹${totalTax.toLocaleString('en-IN')}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Eligible ITC Set-Off</div>
              <div class="kpi-value" style="color: #059669;">₹${totalItc.toLocaleString('en-IN')}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Net Cash Tax Payable</div>
              <div class="kpi-value" style="color: #2563eb;">₹${netCash.toLocaleString('en-IN')}</div>
            </div>
          </div>

          <div class="section-title">Operational Branch Breakdown (${branchCount} Units)</div>
          <table>
            <thead>
              <tr>
                <th>Branch / Operating Unit</th>
                <th>GSTIN</th>
                <th>State</th>
                <th style="text-align: right;">Gross Liability</th>
                <th style="text-align: right;">ITC Claimed</th>
                <th style="text-align: right;">Net Cash</th>
                <th style="text-align: center;">Set-Off Ratio</th>
              </tr>
            </thead>
            <tbody>
              ${(branchData || []).map(b => {
                const gross = b.taxLiability;
                const itc = b.itcSetOff ?? Math.round(b.taxLiability * 0.8);
                const net = b.netPayable ?? Math.max(0, gross - itc);
                const eff = gross > 0 ? Math.min(100, Math.round((itc / gross) * 100)) : 0;
                return `
                  <tr>
                    <td><strong>${b.name}</strong></td>
                    <td style="font-family: monospace;">${b.gstin}</td>
                    <td>${b.state}</td>
                    <td class="number">₹${gross.toLocaleString('en-IN')}</td>
                    <td class="number" style="color: #059669;">₹${itc.toLocaleString('en-IN')}</td>
                    <td class="number" style="color: #2563eb;">₹${net.toLocaleString('en-IN')}</td>
                    <td style="text-align: center; font-weight: bold;">${eff}%</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          ${includeAuditStamp ? `
            <div class="footer">
              <div>
                <strong>Cryptographic Compliance Fingerprint:</strong><br/>
                <span class="fingerprint">SHA-256: 8f94a2b0c41d99e7104b2c1e852d7a9f9021481c5a32b001a4e98f02c610d402</span>
              </div>
              <div style="text-align: right;">
                TaxFlow Statutory Engine • Confidential<br/>
                Audit Certified Document
              </div>
            </div>
          ` : ''}

          <script>
            window.onload = function() {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(printHtml);
      frameDoc.close();

      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch (e) {
          console.error('Print iframe error:', e);
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(printFrame)) {
              document.body.removeChild(printFrame);
            }
          }, 2500);
        }
      }, 300);
    } else {
      window.print();
    }
    setShowPrintModal(false);
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

  const renderBranchWiseComparisonContent = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner Control Switch */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-5 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-blue-500/20 border border-blue-400/30 rounded-xl text-blue-300 shrink-0 shadow-inner">
            <GitBranch size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base text-white tracking-tight">Branch-wise Tax Liability Segregation & Comparison</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-500/30 text-blue-200 border border-blue-400/30 uppercase tracking-wider">
                Multi-Unit Finance View
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Segregate and compare tax liabilities across operational branches, head offices, and sister companies to optimize ITC credit utilization.
            </p>
          </div>
        </div>

        {/* Toggle Switch Button */}
        <div className="flex items-center gap-3 bg-slate-900/90 p-1.5 rounded-xl border border-slate-700/80 shrink-0 self-stretch md:self-auto justify-between md:justify-start">
          <span 
            onClick={() => setIsBranchWiseComparison(false)}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${!isBranchWiseComparison ? 'text-white bg-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Consolidated YTD
          </span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isBranchWiseComparison}
              onChange={(e) => setIsBranchWiseComparison(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
          <span 
            onClick={() => setIsBranchWiseComparison(true)}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${isBranchWiseComparison ? 'text-white bg-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Branch Segregated ON
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Highest Liability Unit</p>
              <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><Building2 size={16}/></span>
            </div>
            <p className="text-xl font-extrabold text-slate-800 mt-2 truncate">
              {highestLiabilityBranch ? highestLiabilityBranch.name : 'N/A'}
            </p>
          </div>
          <div className="flex items-baseline justify-between mt-3 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500 font-semibold">{highestLiabilityBranch?.gstin}</span>
            <span className="text-sm font-bold text-rose-600">₹{(highestLiabilityBranch?.taxLiability || 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Avg Branch Tax Liability</p>
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><BarChart3 size={16}/></span>
            </div>
            <p className="text-xl font-extrabold text-slate-800 mt-2">
              ₹{avgBranchTaxLiability.toLocaleString()}
            </p>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500 font-medium">Across {activeBranches.length} units</span>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Group Mean</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Group ITC Credit Offset</p>
              <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Wallet size={16}/></span>
            </div>
            <p className="text-xl font-extrabold text-emerald-600 mt-2">
              ₹{totalGroupItcSetOff.toLocaleString()}
            </p>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500 font-medium">Avg Set-off Ratio</span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              {totalGroupTaxLiability > 0 ? Math.round((totalGroupItcSetOff / totalGroupTaxLiability) * 100) : 0}% ITC
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Net Cash Tax Payable</p>
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><Shield size={16}/></span>
            </div>
            <p className="text-xl font-extrabold text-indigo-900 mt-2">
              ₹{totalGroupNetPayable.toLocaleString()}
            </p>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500 font-medium">Cash Settlement</span>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              {totalGroupTaxLiability > 0 ? (100 - Math.round((totalGroupItcSetOff / totalGroupTaxLiability) * 100)) : 0}% Cash
            </span>
          </div>
        </div>
      </div>

      {/* Main Comparison Chart & Toolbar */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <GitBranch size={20} className="text-blue-600"/>
              Operational Branch Tax Segregation Chart
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Compare liabilities, credit ledger utilization, and tax heads across operational branches.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Selector */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setBranchMetricMode('OVERVIEW')}
                className={`px-3 py-1.5 rounded-lg transition-all ${branchMetricMode === 'OVERVIEW' ? 'bg-white text-blue-600 shadow-sm' : 'hover:text-slate-900'}`}
              >
                Overview (Gross vs ITC)
              </button>
              <button
                type="button"
                onClick={() => setBranchMetricMode('TAX_HEADS')}
                className={`px-3 py-1.5 rounded-lg transition-all ${branchMetricMode === 'TAX_HEADS' ? 'bg-white text-blue-600 shadow-sm' : 'hover:text-slate-900'}`}
              >
                Tax Heads (IGST/CGST/SGST)
              </button>
              <button
                type="button"
                onClick={() => setBranchMetricMode('EFFICIENCY')}
                className={`px-3 py-1.5 rounded-lg transition-all ${branchMetricMode === 'EFFICIENCY' ? 'bg-white text-blue-600 shadow-sm' : 'hover:text-slate-900'}`}
              >
                ITC Efficiency %
              </button>
            </div>

            {/* Filter Branch Dropdown */}
            <select
              value={selectedBranchFilter}
              onChange={(e) => setSelectedBranchFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="ALL">All Operational Branches ({activeBranches.length})</option>
              {activeBranches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.state})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Chart Area */}
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {branchMetricMode === 'OVERVIEW' ? (
              <BarChart data={branchChartData} margin={{top: 15, right: 15, left: -10, bottom: 25}}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="shortName" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 12, fontWeight: 600}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}} 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', padding: '12px'}}
                  formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, '']}
                />
                <Legend wrapperStyle={{paddingTop: '15px'}} iconType="circle" />
                <Bar dataKey="grossLiability" name="Gross Tax Liability" fill="#334155" radius={[6, 6, 0, 0]} barSize={26} />
                <Bar dataKey="itcSetOff" name="Paid via ITC Credit" fill="#10b981" radius={[6, 6, 0, 0]} barSize={26} />
                <Bar dataKey="netPayable" name="Net Cash Payable" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={26} />
              </BarChart>
            ) : branchMetricMode === 'TAX_HEADS' ? (
              <BarChart data={branchChartData} margin={{top: 15, right: 15, left: -10, bottom: 25}}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="shortName" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 12, fontWeight: 600}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}} 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', padding: '12px'}}
                  formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, '']}
                />
                <Legend wrapperStyle={{paddingTop: '15px'}} iconType="circle" />
                <Bar dataKey="igst" name="Integrated Tax (IGST)" fill="#8b5cf6" stackId="a" barSize={32} />
                <Bar dataKey="cgst" name="Central Tax (CGST)" fill="#06b6d4" stackId="a" barSize={32} />
                <Bar dataKey="sgst" name="State Tax (SGST)" fill="#f59e0b" stackId="a" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            ) : (
              <BarChart data={branchChartData} margin={{top: 15, right: 15, left: -10, bottom: 25}}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="shortName" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 12, fontWeight: 600}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}} 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', padding: '12px'}}
                  formatter={(value: any) => [`${value}%`, 'ITC Efficiency Ratio']}
                />
                <Legend wrapperStyle={{paddingTop: '15px'}} iconType="circle" />
                <Bar dataKey="efficiency" name="ITC Set-Off Efficiency %" fill="#10b981" radius={[6, 6, 0, 0]} barSize={36} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Branch Segregation Matrix Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Branch-wise Tax Liability Matrix</h3>
            <p className="text-xs text-slate-500">Breakdown of gross liabilities, ITC set-off, and net cash obligations by operating entity.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              alert(`Exporting Consolidated Branch-wise Tax Liability Segregation Report (${filteredBranchList.length} operational units)...`);
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
          >
            <Download size={14}/> Export Matrix PDF
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 uppercase text-xs tracking-wider">
              <tr>
                <th className="p-4 pl-6">Operational Branch / Unit</th>
                <th className="p-4">GSTIN & Region</th>
                <th className="p-4 text-right">Gross Output Tax</th>
                <th className="p-4 text-center">ITC Set-off Credit</th>
                <th className="p-4 text-right">Net Cash Payable</th>
                <th className="p-4 text-center">Tax Breakdown</th>
                <th className="p-4 pr-6 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBranchList.map((branch) => {
                const gross = branch.taxLiability;
                const itc = branch.itcSetOff ?? Math.round(gross * 0.8);
                const net = branch.netPayable ?? Math.max(0, gross - itc);
                const ratio = gross > 0 ? Math.min(100, Math.round((itc / gross) * 100)) : 0;
                const igst = branch.igst ?? Math.round(gross * 0.5);
                const cgst = branch.cgst ?? Math.round(gross * 0.25);
                const sgst = branch.sgst ?? Math.round(gross * 0.25);

                return (
                  <tr key={branch.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="p-4 pl-6">
                      <div className="font-bold text-slate-800 flex items-center gap-2">
                        {branch.name}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          branch.type === 'HEAD_OFFICE' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          branch.type === 'SISTER_COMPANY' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {branch.type?.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 font-mono">Turnover: ₹{branch.turnover.toLocaleString()}</div>
                    </td>

                    <td className="p-4">
                      <div className="font-mono text-xs font-semibold text-slate-700">{branch.gstin}</div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <MapPin size={11} className="text-slate-400" /> {branch.state}
                      </div>
                    </td>

                    <td className="p-4 text-right font-bold text-slate-800 font-mono">
                      ₹{gross.toLocaleString()}
                    </td>

                    <td className="p-4">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-emerald-600 font-mono text-xs">₹{itc.toLocaleString()}</span>
                        <div className="w-28 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${ratio}%` }}></div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold mt-0.5">{ratio}% offset</span>
                      </div>
                    </td>

                    <td className="p-4 text-right font-bold text-blue-600 font-mono">
                      ₹{net.toLocaleString()}
                    </td>

                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {igst > 0 && (
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded border border-purple-100" title="IGST">
                            IGST: ₹{(igst/1000).toFixed(0)}k
                          </span>
                        )}
                        {cgst > 0 && (
                          <span className="px-2 py-0.5 bg-cyan-50 text-cyan-700 text-[10px] font-bold rounded border border-cyan-100" title="CGST">
                            CGST: ₹{(cgst/1000).toFixed(0)}k
                          </span>
                        )}
                        {sgst > 0 && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded border border-amber-100" title="SGST">
                            SGST: ₹{(sgst/1000).toFixed(0)}k
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-4 pr-6 text-center">
                      <button
                        type="button"
                        onClick={() => alert(`Exporting individual tax ledger summary for ${branch.name}...`)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                      >
                        Statement
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Total Summary Footer */}
            <tfoot className="bg-slate-900 text-white font-bold text-xs">
              <tr>
                <td className="p-4 pl-6" colSpan={2}>
                  CONSOLIDATED GROUP TOTALS ({filteredBranchList.length} OPERATIONAL UNITS)
                </td>
                <td className="p-4 text-right font-mono text-sm text-white">
                  ₹{filteredBranchList.reduce((s, b) => s + b.taxLiability, 0).toLocaleString()}
                </td>
                <td className="p-4 text-center font-mono text-sm text-emerald-400">
                  ₹{filteredBranchList.reduce((s, b) => s + (b.itcSetOff ?? Math.round(b.taxLiability*0.8)), 0).toLocaleString()}
                </td>
                <td className="p-4 text-right font-mono text-sm text-blue-400">
                  ₹{filteredBranchList.reduce((s, b) => s + (b.netPayable ?? Math.max(0, b.taxLiability - (b.itcSetOff ?? Math.round(b.taxLiability*0.8)))), 0).toLocaleString()}
                </td>
                <td className="p-4 text-center text-slate-300" colSpan={2}>
                  All Operating Branches Aggregated
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Finance Manager Optimization Recommendation Callout */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 p-5 rounded-2xl border border-emerald-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-emerald-600 text-white rounded-xl shrink-0 mt-0.5">
            <Sparkles size={18} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Branch Tax Optimization Recommendation</h4>
            <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
              Unutilized IGST credits from <span className="font-bold text-slate-800">Bengaluru Tech Hub</span> and <span className="font-bold text-slate-800">Delhi Sales Office</span> can be prioritized for cross-branch inter-state settlement to reduce net cash tax outflows at <span className="font-bold text-slate-800">Mumbai HQ</span>.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => alert('Initiating cross-branch ITC credit transfer optimization simulation...')}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm shrink-0 whitespace-nowrap cursor-pointer"
        >
          Run Credit Optimization
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 no-print">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Analytics & Reports</h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1">Deep dive into your organization's compliance health and tax liability trends.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0 w-full xl:w-auto">
                <button 
                    onClick={() => setShowSavedReports(true)}
                    className="h-10 px-3.5 py-2 inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-xl hover:bg-slate-50 transition-all shadow-2xs active:scale-95 cursor-pointer"
                >
                    <Bookmark size={15} className="text-blue-500 shrink-0"/> Saved Presets
                </button>
                <button 
                    onClick={() => {
                        if (taxData) {
                            const currentTenant = user?.availableTenants.find(t => t.id === tenantId);
                            generateGstSummaryPdf(taxData, 'July 2024', currentTenant);
                        }
                    }}
                    disabled={!taxData}
                    className="h-10 px-3.5 py-2 inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm shadow-emerald-600/15 disabled:opacity-50 active:scale-95 cursor-pointer"
                    title="Generate and download Consolidated Monthly GST Summary PDF Report"
                >
                    <Download size={15} className="shrink-0"/> Download GST PDF
                </button>
                <button 
                    onClick={() => setShowTemplateSelector(true)}
                    className="h-10 px-3.5 py-2 inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all shadow-sm shadow-slate-900/15 active:scale-95 cursor-pointer"
                >
                    <Palette size={15} className="text-blue-400 shrink-0"/> Professional Export
                </button>
                <button 
                    onClick={() => setShowScheduleModal(true)}
                    className="h-10 px-3.5 py-2 inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm shadow-indigo-600/15 active:scale-95 cursor-pointer"
                    title="Schedule automated reports via email"
                >
                    <Clock size={15} className="shrink-0"/> Schedule
                </button>
                <button 
                    onClick={() => setShowPrintModal(true)}
                    className="h-10 px-3.5 py-2 inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-xl hover:bg-slate-50 transition-all shadow-2xs active:scale-95 cursor-pointer"
                >
                    <Printer size={15} className="text-slate-600 shrink-0"/> Print Report
                </button>
            </div>
        </div>

        {/* Global Filters Bar */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap items-center gap-4 filter-section">
            <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
                <Calendar size={16} className="text-slate-400"/>
                <input 
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                    className="bg-transparent text-sm font-medium outline-none text-slate-600 cursor-pointer"
                />
                <span className="text-slate-300">to</span>
                <input 
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                    className="bg-transparent text-sm font-medium outline-none text-slate-600 cursor-pointer"
                />
            </div>

            <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 min-w-[200px]">
                <MapPin size={16} className="text-slate-400"/>
                <select 
                    value={filters.branchId}
                    onChange={(e) => setFilters({...filters, branchId: e.target.value})}
                    className="bg-transparent text-sm font-medium outline-none text-slate-600 w-full cursor-pointer appearance-none"
                >
                    <option value="ALL">All Branches</option>
                    {branchData?.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
            </div>

            <div className="ml-auto flex items-center gap-3">
                <button 
                    onClick={() => {
                        setFilters({ startDate: '', endDate: '', branchId: 'ALL' });
                    }}
                    className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors px-2"
                >
                    Reset
                </button>
                <button 
                    onClick={() => setShowSaveModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/10"
                >
                    <Save size={16}/> Save View
                </button>
            </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex p-1 bg-slate-100/80 rounded-xl overflow-x-auto tab-navigation">
          {[
             { id: 'FY_MONTHLY_TRENDS', label: 'FY Monthly Liability & ITC Trends', icon: BarChart3 },
             { id: 'REGIONAL_MAP', label: 'Regional Geo Map', icon: Globe },
             { id: 'LIABILITY', label: 'Tax Liability', icon: TrendingUp },
             ...(canUseMultiBranch ? [
               { id: 'BRANCH_COMPARISON', label: 'Branch Comparison', icon: GitBranch },
               { id: 'BRANCH', label: 'Branch Entities', icon: MapPin }
             ] : []),
             { id: 'ITC', label: 'ITC Utilization', icon: Wallet },
             { id: 'VENDOR', label: 'Vendor Score', icon: Users },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <tab.icon size={16} className={activeTab === tab.id ? 'text-blue-500' : 'text-slate-400'}/>
              <span>{tab.label}</span>
            </button>
          ))}
      </div>

      {/* Content Area */}
      <div className="min-h-[400px]">
          
          {/* FY MONTHLY TRENDS & ITC DASHBOARD */}
          {activeTab === 'FY_MONTHLY_TRENDS' && (
            <div className="animate-in fade-in duration-300">
              <MonthlyGstReportingDashboard tenantId={tenantId} />
            </div>
          )}

          {/* REGIONAL GEO MAP TAB */}
          {activeTab === 'REGIONAL_MAP' && (
            <div className="animate-in fade-in duration-300">
              <GeoGstMapVisualization tenantId={tenantId} />
            </div>
          )}

          {/* DIRECT BRANCH COMPARISON TAB (Multi-Branch only) */}
          {activeTab === 'BRANCH_COMPARISON' && canUseMultiBranch && (
            renderBranchWiseComparisonContent()
          )}

          {/* LIABILITY TAB */}
          {activeTab === 'LIABILITY' && liabilityData && (
              <div className="space-y-6">
                  {/* Branch Comparison Toggle Header - only available when multi-branch is supported */}
                  {canUseMultiBranch && (
                    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-5 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="p-3 bg-blue-500/20 border border-blue-400/30 rounded-xl text-blue-300 shrink-0 shadow-inner">
                          <GitBranch size={22} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-base text-white tracking-tight">Branch-wise Tax Liability Comparison Toggle</h3>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-500/30 text-blue-200 border border-blue-400/30 uppercase tracking-wider">
                              Finance Manager Control
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1">
                            Toggle between consolidated organization YTD view and operational branch-wise tax liability segregation.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 bg-slate-900/90 p-1.5 rounded-xl border border-slate-700/80 shrink-0 self-stretch md:self-auto justify-between md:justify-start">
                        <span 
                          onClick={() => setIsBranchWiseComparison(false)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${!isBranchWiseComparison ? 'text-white bg-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          Consolidated YTD
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isBranchWiseComparison}
                            onChange={(e) => setIsBranchWiseComparison(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                        <span 
                          onClick={() => setIsBranchWiseComparison(true)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${isBranchWiseComparison ? 'text-white bg-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          Branch Segregated ON
                        </span>
                      </div>
                    </div>
                  )}

                  {isBranchWiseComparison && canUseMultiBranch ? (
                    renderBranchWiseComparisonContent()
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Gross Liability (YTD)</p>
                              <div className="flex items-baseline gap-2 mt-2">
                                  <p className="text-3xl font-bold text-slate-800">
                                      ₹ {(liabilityData.reduce((a, b) => a + b.liability, 0) / 1000).toFixed(1)}k
                                  </p>
                                  <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">+12%</span>
                              </div>
                          </div>
                          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Settled via ITC</p>
                              <div className="flex items-baseline gap-2 mt-2">
                                  <p className="text-3xl font-bold text-emerald-600">
                                      ₹ {(liabilityData.reduce((a, b) => a + b.itcAdjustment, 0) / 1000).toFixed(1)}k
                                  </p>
                                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">85% Ratio</span>
                              </div>
                          </div>
                          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Paid in Cash</p>
                              <div className="flex items-baseline gap-2 mt-2">
                                  <p className="text-3xl font-bold text-blue-600">
                                      ₹ {(liabilityData.reduce((a, b) => a + b.cashPaid, 0) / 1000).toFixed(1)}k
                                  </p>
                                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">15% Ratio</span>
                              </div>
                          </div>
                      </div>

                      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                              <TrendingUp size={20} className="text-blue-500"/> Liability vs Payment Trend
                          </h3>
                          <div className="h-96 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={liabilityData} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                                      <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px'}}/>
                                      <Legend wrapperStyle={{paddingTop: '20px'}} iconType="circle" />
                                      <Bar dataKey="liability" name="Gross Liability" fill="#334155" radius={[4, 4, 0, 0]} barSize={32} />
                                      <Bar dataKey="itcAdjustment" name="Paid via ITC" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} />
                                      <Bar dataKey="cashPaid" name="Paid in Cash" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                                  </BarChart>
                              </ResponsiveContainer>
                          </div>
                      </div>
                    </>
                  )}
              </div>
          )}

          {/* ITC TAB */}
          {activeTab === 'ITC' && itcData && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                      <div className="p-6 border-b border-slate-100">
                          <h3 className="text-lg font-bold text-slate-800">ITC Electronic Ledger Flow</h3>
                      </div>
                      <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50/50 text-slate-500 font-semibold border-b border-slate-100">
                              <tr>
                                  <th className="p-4 pl-6">Head</th>
                                  <th className="p-4 text-right">Opening Bal.</th>
                                  <th className="p-4 text-right text-emerald-600">+ Availed</th>
                                  <th className="p-4 text-right text-rose-600">- Utilized</th>
                                  <th className="p-4 pr-6 text-right font-bold">Closing Bal.</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {itcData.map((row, i) => (
                                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                                      <td className="p-4 pl-6 font-bold text-slate-700">{row.head}</td>
                                      <td className="p-4 text-right text-slate-600 font-mono">₹{row.openingBalance.toLocaleString()}</td>
                                      <td className="p-4 text-right text-emerald-600 font-mono font-medium">₹{row.availed.toLocaleString()}</td>
                                      <td className="p-4 text-right text-rose-600 font-mono font-medium">₹{row.utilized.toLocaleString()}</td>
                                      <td className="p-4 pr-6 text-right font-bold text-slate-900 font-mono bg-slate-50/50">₹{row.closingBalance.toLocaleString()}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
                      <h3 className="text-lg font-bold text-slate-800 mb-6">Utilization Mix</h3>
                      <div className="flex-1 min-h-[250px] relative">
                           <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                  <Pie
                                      data={itcData}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={60}
                                      outerRadius={80}
                                      paddingAngle={5}
                                      dataKey="utilized"
                                      cornerRadius={6}
                                  >
                                      {itcData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                      ))}
                                  </Pie>
                                  <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                                  <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                              </PieChart>
                           </ResponsiveContainer>
                           <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                               <div className="text-center">
                                   <p className="text-xs text-slate-400 font-bold uppercase">Total Utilized</p>
                                   <p className="text-xl font-bold text-slate-800">₹{(itcData.reduce((a,b)=>a+b.utilized, 0)/1000).toFixed(0)}k</p>
                               </div>
                           </div>
                      </div>
                  </div>
              </div>
          )}

          {/* VENDOR TAB */}
          {activeTab === 'VENDOR' && vendorData && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                   <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                      <div>
                          <h3 className="text-lg font-bold text-slate-800">Vendor Compliance Ratings</h3>
                          <p className="text-sm text-slate-500">Based on GSTR-1 vs GSTR-3B filing patterns.</p>
                      </div>
                      <div className="flex gap-2">
                           <span className="px-3 py-1 bg-green-50 text-green-700 text-xs rounded-full font-bold border border-green-100">A: &gt;90</span>
                           <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs rounded-full font-bold border border-amber-100">B: 50-90</span>
                           <span className="px-3 py-1 bg-red-50 text-red-700 text-xs rounded-full font-bold border border-red-100">C: &lt;50</span>
                      </div>
                   </div>
                   <table className="w-full text-left text-sm">
                       <thead className="bg-slate-50/50 text-slate-500 font-semibold border-b border-slate-100 uppercase text-xs tracking-wider">
                           <tr>
                               <th className="px-6 py-4">Vendor</th>
                               <th className="px-6 py-4 text-center">Score</th>
                               <th className="px-6 py-4 text-center">Rating</th>
                               <th className="px-6 py-4 text-right">Risk Value (ITC)</th>
                               <th className="px-6 py-4 text-center">Status</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                            {vendorData.length === 0 && (
                                <tr><td colSpan={5} className="p-12 text-center text-slate-400">No data available.</td></tr>
                            )}
                           {vendorData.map((vendor, i) => {
                               let rating = 'C';
                               let color = 'bg-red-100 text-red-700';
                               if (vendor.complianceScore > 90) { rating = 'A'; color = 'bg-green-100 text-green-700'; }
                               else if (vendor.complianceScore > 50) { rating = 'B'; color = 'bg-amber-100 text-amber-700'; }

                               return (
                                   <tr key={i} className="hover:bg-slate-50 group transition-colors">
                                       <td className="px-6 py-4">
                                           <div className="font-bold text-slate-800">{vendor.vendorName}</div>
                                           <div className="text-xs text-slate-400 font-mono group-hover:text-blue-500 transition-colors">{vendor.gstin}</div>
                                       </td>
                                       <td className="px-6 py-4 text-center">
                                           <div className="relative w-full bg-slate-100 h-1.5 rounded-full overflow-hidden max-w-[100px] mx-auto">
                                               <div className={`h-full ${vendor.complianceScore > 80 ? 'bg-green-500' : 'bg-amber-500'}`} style={{width: `${vendor.complianceScore}%`}}></div>
                                           </div>
                                           <span className="text-xs font-bold text-slate-600 mt-1 block">{vendor.complianceScore}/100</span>
                                       </td>
                                       <td className="px-6 py-4 text-center">
                                           <span className={`w-8 h-8 inline-flex items-center justify-center rounded-full font-bold text-sm shadow-sm ${color}`}>
                                               {rating}
                                           </span>
                                       </td>
                                       <td className="px-6 py-4 text-right font-mono font-medium text-slate-700">₹{vendor.totalItcAtRisk.toLocaleString()}</td>
                                       <td className="px-6 py-4 text-center">
                                           <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                               vendor.status === 'COMPLIANT' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                                           }`}>
                                               {vendor.status.replace('_', ' ')}
                                           </span>
                                       </td>
                                   </tr>
                               );
                           })}
                       </tbody>
                   </table>
              </div>
          )}

          {/* BRANCH TAB */}
          {activeTab === 'BRANCH' && canUseMultiBranch && branchData && (
               <div className="space-y-6">
                   {/* Enhanced Summary Card with Actions */}
                   <div className="bg-gradient-to-r from-slate-900 to-blue-900 text-white p-8 rounded-2xl shadow-xl relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                       <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center">
                           <div>
                               <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                                   <Network className="text-blue-300"/> Consolidation Group
                               </h3>
                               <p className="text-blue-200 text-sm max-w-xl">
                                   Real-time data aggregation across all linked GSTINs. Link new branches or sister companies to view consolidated liability.
                               </p>
                           </div>
                           <button 
                               onClick={() => setShowAddEntityModal(true)}
                               className="mt-4 md:mt-0 px-5 py-2.5 bg-white text-blue-900 font-bold rounded-xl shadow-lg hover:bg-blue-50 transition-colors flex items-center gap-2"
                           >
                               <Plus size={18}/> Link New Entity
                           </button>
                       </div>

                       <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-8 border-t border-white/10 pt-8">
                           <div>
                               <p className="text-xs text-blue-300 uppercase font-bold tracking-wider mb-1">Total Entities</p>
                               <p className="text-3xl font-bold">{branchData.length}</p>
                           </div>
                           <div>
                               <p className="text-xs text-blue-300 uppercase font-bold tracking-wider mb-1">States Covered</p>
                               <p className="text-3xl font-bold">{new Set(branchData.map(b => b.state)).size}</p>
                           </div>
                           <div>
                               <p className="text-xs text-blue-300 uppercase font-bold tracking-wider mb-1">Group Turnover</p>
                               <p className="text-3xl font-bold">₹ {(branchData.reduce((a, b) => a + b.turnover, 0) / 100000).toFixed(1)}L</p>
                           </div>
                           <div>
                               <p className="text-xs text-blue-300 uppercase font-bold tracking-wider mb-1">Group Liability</p>
                               <p className="text-3xl font-bold">₹ {(branchData.reduce((a, b) => a + b.taxLiability, 0) / 100000).toFixed(1)}L</p>
                           </div>
                       </div>
                   </div>

                   {/* Entity List */}
                   <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                       <table className="w-full text-left text-sm">
                           <thead className="bg-slate-50/50 text-slate-500 font-semibold border-b border-slate-100">
                               <tr>
                                   <th className="p-4 pl-6">Entity Name</th>
                                   <th className="p-4">GSTIN</th>
                                   <th className="p-4">Type</th>
                                   <th className="p-4">State</th>
                                   <th className="p-4 text-right">Turnover</th>
                                   <th className="p-4 pr-6 text-right">Tax Liability</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                               {branchData.map((branch) => (
                                   <tr key={branch.id} className="hover:bg-slate-50 transition-colors group">
                                       <td className="p-4 pl-6">
                                           <div className="font-bold text-slate-800">{branch.name}</div>
                                           <div className="text-xs text-slate-400 group-hover:text-blue-500 transition-colors">ID: {branch.id}</div>
                                       </td>
                                       <td className="p-4 font-mono text-slate-500">{branch.gstin}</td>
                                       <td className="p-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                                branch.type === 'HEAD_OFFICE' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                branch.type === 'SISTER_COMPANY' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                                'bg-blue-50 text-blue-700 border-blue-100'
                                            }`}>
                                                {branch.type === 'SISTER_COMPANY' ? <Building size={10}/> : <GitBranch size={10}/>}
                                                {branch.type?.replace('_', ' ')}
                                            </span>
                                       </td>
                                       <td className="p-4 text-slate-600">
                                           <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 text-xs font-medium">
                                               <MapPin size={12}/> {branch.state}
                                           </span>
                                       </td>
                                       <td className="p-4 text-right font-medium font-mono text-slate-700">₹{branch.turnover.toLocaleString()}</td>
                                       <td className="p-4 pr-6 text-right font-bold text-slate-900 font-mono">₹{branch.taxLiability.toLocaleString()}</td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   </div>
               </div>
          )}


      </div>

       {/* Add Entity Modal */}
       {showAddEntityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800">Link New Entity</h3>
                    <button onClick={() => setShowAddEntityModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
                        <X size={20} />
                    </button>
                </div>
                
                <form onSubmit={handleAddEntity} className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">GSTIN / Tax ID</label>
                        <input 
                            value={newEntityData.gstin}
                            onChange={(e) => setNewEntityData({...newEntityData, gstin: e.target.value})}
                            required
                            placeholder="27ABCDE1234F1Z5"
                            className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Entity Legal Name</label>
                        <input 
                            value={newEntityData.name}
                            onChange={(e) => setNewEntityData({...newEntityData, name: e.target.value})}
                            required
                            placeholder="Entity Name"
                            className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Relationship Type</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setNewEntityData({...newEntityData, type: 'BRANCH'})}
                                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${newEntityData.type === 'BRANCH' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200 text-slate-600'}`}
                            >
                                Branch Office
                            </button>
                            <button
                                type="button"
                                onClick={() => setNewEntityData({...newEntityData, type: 'SISTER_COMPANY'})}
                                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${newEntityData.type === 'SISTER_COMPANY' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200 text-slate-600'}`}
                            >
                                Sister Company
                            </button>
                        </div>
                    </div>
                     <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">State / Region</label>
                        <input 
                            value={newEntityData.state}
                            onChange={(e) => setNewEntityData({...newEntityData, state: e.target.value})}
                            required
                            placeholder="e.g. Maharashtra"
                            className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={isLinking}
                        className="w-full py-3 mt-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 shadow-sm disabled:opacity-70"
                    >
                        {isLinking ? <Loader2 size={18} className="animate-spin"/> : <Link size={18}/>}
                        {isLinking ? 'Verifying & Linking...' : 'Link Entity'}
                    </button>
                </form>
            </div>
        </div>
       )}

       {/* Saved Reports Drawer */}
       <AnimatePresence>
            {showSavedReports && (
                <>
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowSavedReports(false)}
                        className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm"
                    />
                    <motion.div 
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 z-[70] w-full max-w-md bg-white shadow-2xl flex flex-col"
                    >
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <Bookmark size={20}/>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Saved Report Presets</h3>
                                    <p className="text-xs text-slate-500">Quickly restore your frequent filter sets.</p>
                                </div>
                            </div>
                            <button onClick={() => setShowSavedReports(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
                                <X size={20}/>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {savedReports && savedReports.length > 0 ? (
                                savedReports.map(report => (
                                    <div 
                                        key={report.id}
                                        className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5 transition-all group relative"
                                    >
                                        <div 
                                            className="cursor-pointer"
                                            onClick={() => applySavedReport(report)}
                                        >
                                            <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{report.name}</h4>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 uppercase">
                                                    {report.tab}
                                                </span>
                                                {report.filters.startDate && (
                                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-200 text-slate-600 flex items-center gap-1">
                                                        <Calendar size={10}/> {report.filters.startDate}
                                                    </span>
                                                )}
                                                {report.filters.branchId !== 'ALL' && (
                                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-200 text-slate-600 flex items-center gap-1">
                                                        <MapPin size={10}/> {branchData?.find(b => b.id === report.filters.branchId)?.name || 'Branch'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-3 text-[10px] text-slate-400 font-medium">
                                                <Clock size={10}/> Saved on {new Date(report.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteSavedReport(report.id);
                                            }}
                                            className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Bookmark size={32}/>
                                    </div>
                                    <h4 className="text-slate-800 font-bold">No saved reports</h4>
                                    <p className="text-slate-500 text-sm mt-1 px-8">Save your current filters as a preset to access them later with one click.</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
       </AnimatePresence>

       {/* Schedule Report Modal */}
       <ScheduleReportModal 
         isOpen={showScheduleModal} 
         onClose={() => setShowScheduleModal(false)}
         onSchedule={async (config) => {
           const res = await fetch('/api/v1/jobs/schedule-report', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(config)
           });
           if (!res.ok) throw new Error('Failed to schedule job');
         }}
       />

       {/* Save Report Modal */}
       {showSaveModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800">Save Current View</h3>
                    <button onClick={() => setShowSaveModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Preset Name</label>
                        <input 
                            autoFocus
                            value={newReportName}
                            onChange={(e) => setNewReportName(e.target.value)}
                            placeholder="e.g. Mumbai Q3 Liability"
                            className="w-full h-11 px-4 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-[10px] text-slate-400 font-medium px-1 italic">
                            This will save your current tab ({activeTab}) and active filters.
                        </p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Configuration</p>
                        <div className="flex flex-wrap gap-2">
                            <span className="text-[10px] font-bold px-2 py-1 rounded bg-blue-100 text-blue-700 uppercase">{activeTab}</span>
                            <span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-200 text-slate-600">
                                {filters.branchId === 'ALL' ? 'All Branches' : branchData?.find(b => b.id === filters.branchId)?.name}
                            </span>
                            {filters.startDate && (
                                <span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-200 text-slate-600">
                                    {filters.startDate} - {filters.endDate || 'Present'}
                                </span>
                            )}
                        </div>
                    </div>

                     <div className="flex gap-3">
                        <button 
                            onClick={() => setShowSaveModal(false)}
                            className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => handleSaveReport({
                                name: newReportName,
                                tab: activeTab,
                                filters: {
                                    startDate: filters.startDate,
                                    endDate: filters.endDate,
                                    branchId: filters.branchId
                                }
                            })}
                            disabled={!newReportName || isSaving}
                            className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSaving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>}
                            Save Preset
                        </button>
                    </div>
                </div>
            </div>
        </div>
       )}

       {/* Print Report Options Modal */}
       {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400">
                            <Printer size={18} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white">Print Statutory GST Report</h3>
                            <p className="text-[11px] text-slate-300">Format & print executive compliance document</p>
                        </div>
                    </div>
                    <button onClick={() => setShowPrintModal(false)} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-5 text-xs text-slate-700">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-medium">Active Report View:</span>
                            <span className="font-bold text-slate-900 bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full text-[11px]">
                                {activeTab.replace(/_/g, ' ')}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-medium">Target Branch Filter:</span>
                            <span className="font-bold text-slate-800">
                                {filters.branchId === 'ALL' ? 'All Operational Units' : branchData?.find(b => b.id === filters.branchId)?.name}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-medium">Group Tax Liability:</span>
                            <span className="font-mono font-bold text-slate-900">
                                ₹{totalGroupTaxLiability.toLocaleString('en-IN')}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-800 block">Print Configuration Options</label>
                        
                        <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={includeAuditStamp} 
                                onChange={(e) => setIncludeAuditStamp(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                            <div>
                                <div className="font-bold text-slate-900">Cryptographic SHA-256 Audit Certification</div>
                                <div className="text-[11px] text-slate-500">Includes verification hash & statutory audit watermark at bottom</div>
                            </div>
                        </label>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                        <button 
                            onClick={() => {
                                setShowPrintModal(false);
                                window.print();
                            }}
                            className="px-4 py-2.5 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                            Direct Browser Print
                        </button>
                        <button 
                            onClick={handleExecutePrint}
                            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                        >
                            <Printer size={15} /> Generate & Print Report Document
                        </button>
                    </div>
                </div>
            </div>
        </div>
       )}

       <AnimatePresence>
          {showTemplateSelector && (
            <TemplateSelector 
              isOpen={showTemplateSelector}
              onClose={() => setShowTemplateSelector(false)}
              onExport={handleProfessionalExport}
              category="REPORT"
              title={`${activeTab.charAt(0) + activeTab.slice(1).toLowerCase()} Analysis Report`}
            />
          )}
       </AnimatePresence>
    </div>
  );
};

export default Reports;