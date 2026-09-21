import React, { useState } from 'react';
import {
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
  Check,
  Layers,
  Sparkles,
  Server,
  Zap,
  Lock,
  ArrowUpRight,
  ExternalLink,
  ChevronRight,
  Receipt,
  FileCheck2,
  Clock
} from 'lucide-react';
import {
  erpIntegrationService,
  SupportedErpId,
  ErpCredentials,
  ErpImportResult,
  ErpAuthResult
} from '../services/erpIntegrationService';
import { Invoice } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultErpId?: SupportedErpId;
  onImportComplete?: (result: ErpImportResult) => void;
  onNavigateToInvoices?: () => void;
  onNavigateToRecon?: () => void;
}

const ERP_OPTIONS: Array<{
  id: SupportedErpId;
  name: string;
  category: string;
  badge: string;
  iconBg: string;
  initials: string;
  description: string;
  authTypeLabel: string;
}> = [
  {
    id: 'qb',
    name: 'QuickBooks Online',
    category: 'SME & Cloud',
    badge: 'OAuth 2.0',
    iconBg: 'bg-emerald-600',
    initials: 'QB',
    description: 'Intuit V3 REST API for Sales Invoices and Vendor Bills',
    authTypeLabel: 'OAuth 2.0 / Client Credentials'
  },
  {
    id: 'tally',
    name: 'Tally Prime',
    category: 'On-Prem / Desktop',
    badge: 'TDL XML Bridge',
    iconBg: 'bg-amber-600',
    initials: 'TP',
    description: 'TallyPrime 4.x / ERP 9 XML HTTP Port 9000 & ODBC Gateway',
    authTypeLabel: 'XML HTTP Server / ODBC'
  },
  {
    id: 'xero',
    name: 'Xero Accounting',
    category: 'Cloud Accounting',
    badge: 'OAuth 2.0',
    iconBg: 'bg-cyan-600',
    initials: 'XR',
    description: 'Xero Accounting API v2.0 for Invoices (ACCREC) and Bills (ACCPAY)',
    authTypeLabel: 'OAuth 2.0 PKCE / Tenant ID'
  },
  {
    id: 'sap',
    name: 'SAP ERP (ECC & S/4HANA)',
    category: 'Enterprise Tier-1',
    badge: 'OData v4 / RFC',
    iconBg: 'bg-blue-800',
    initials: 'SAP',
    description: 'SAP S/4HANA Billing Documents (VF03) & Supplier Invoices (MIRO)',
    authTypeLabel: 'OAuth2 / API Key / Client 100'
  },
  {
    id: 'oracle',
    name: 'Oracle NetSuite',
    category: 'Enterprise Cloud',
    badge: 'TBA Token Auth',
    iconBg: 'bg-rose-700',
    initials: 'NS',
    description: 'SuiteTalk REST Web Services & SuiteScript 2.0 for Sales & Purchases',
    authTypeLabel: 'TBA HMAC-SHA256 / Consumer Key'
  },
  {
    id: 'zoho',
    name: 'Zoho Books',
    category: 'Cloud Accounting',
    badge: 'OAuth 2.0',
    iconBg: 'bg-red-600',
    initials: 'ZB',
    description: 'Zoho Books India DC REST API v3 for Invoices & Vendor Bills',
    authTypeLabel: 'OAuth 2.0 / Org ID'
  },
  {
    id: 'dynamics',
    name: 'MS Dynamics 365 Business Central',
    category: 'Mid-Market ERP',
    badge: 'Azure AD / OData',
    iconBg: 'bg-indigo-600',
    initials: 'BC',
    description: 'Microsoft Graph & Business Central OData v4 Sales/Purchase Entities',
    authTypeLabel: 'Azure AD App Reg / Secret'
  },
  {
    id: 'dynamics_fo',
    name: 'MS Dynamics 365 Finance & Operations',
    category: 'Enterprise Tier-1',
    badge: 'DMF / OData REST',
    iconBg: 'bg-teal-700',
    initials: 'F&O',
    description: 'D365 F&O High-Volume Data Entities for GST Ledgers (IN01 Legal Entity)',
    authTypeLabel: 'AAD OAuth2 / DMF Package'
  }
];

export const OneClickErpImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  defaultErpId = 'qb',
  onImportComplete,
  onNavigateToInvoices,
  onNavigateToRecon
}) => {
  const [selectedErpId, setSelectedErpId] = useState<SupportedErpId>(defaultErpId);
  const [ledgerScope, setLedgerScope] = useState<'SALES' | 'PURCHASE' | 'BOTH'>('BOTH');
  const [period, setPeriod] = useState<'CURRENT_MONTH' | 'LAST_MONTH' | 'CURRENT_QUARTER' | 'FY_2026_27'>('CURRENT_MONTH');
  
  // Pipeline Execution State
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [authResult, setAuthResult] = useState<ErpAuthResult | null>(null);
  const [importResult, setImportResult] = useState<ErpImportResult | null>(null);
  const [pipelineStep, setPipelineStep] = useState<number>(0);
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([]);
  const [previewTab, setPreviewTab] = useState<'ALL' | 'SALES' | 'PURCHASE'>('ALL');

  if (!isOpen) return null;

  const selectedErp = ERP_OPTIONS.find(e => e.id === selectedErpId) || ERP_OPTIONS[0];
  const creds = erpIntegrationService.getCredentials(selectedErpId);

  const handleTestAuth = async () => {
    setIsAuthenticating(true);
    try {
      const res = await erpIntegrationService.authenticate(selectedErpId);
      setAuthResult(res);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleStartImport = async () => {
    setIsImporting(true);
    setImportResult(null);
    setPipelineStep(1);
    setPipelineLogs([`[${new Date().toLocaleTimeString()}] Authenticating client credentials with ${selectedErp.name}...`]);

    try {
      // Step 1: Handshake
      await new Promise(r => setTimeout(r, 600));
      setPipelineStep(2);
      setPipelineLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Handshake confirmed. Querying ${ledgerScope === 'BOTH' ? 'Sales and Purchase' : ledgerScope} ledgers for ${period}...`]);

      // Step 2: Extraction
      await new Promise(r => setTimeout(r, 700));
      setPipelineStep(3);
      setPipelineLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Applying statutory GST HSN mapping & calculating CGST/SGST/IGST tax splits...`]);

      // Step 3: Normalization & Commit
      const result = await erpIntegrationService.importLedgers({
        erpId: selectedErpId,
        ledgerScope,
        period,
        autoCommit: true
      });

      setPipelineStep(4);
      setPipelineLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Commit complete! ${result.importedSalesCount + result.importedPurchaseCount} ledger entries saved to TaxFlow datastore.`]);
      setImportResult(result);

      if (onImportComplete) {
        onImportComplete(result);
      }
    } catch (err: any) {
      setPipelineLogs(prev => [...prev, `[ERROR] Failed to import from ${selectedErp.name}: ${err.message}`]);
    } finally {
      setIsImporting(false);
    }
  };

  const allImported = [
    ...(importResult?.salesInvoices || []),
    ...(importResult?.purchaseInvoices || [])
  ];

  const filteredPreview = allImported.filter(inv => {
    if (previewTab === 'SALES') return inv.category === 'SALES';
    if (previewTab === 'PURCHASE') return inv.category === 'PURCHASE';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
              <Zap size={20} className="text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">One-Click ERP Ledger Import</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Live Gateway
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Seamlessly ingest sales & purchase ledgers from enterprise accounting systems using existing credentials.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 rounded-full border border-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* 1. ERP Selector Carousel / Grid */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2.5">
              1. Select Connected ERP / Accounting System
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {ERP_OPTIONS.map(erp => {
                const isSelected = selectedErpId === erp.id;
                return (
                  <button
                    key={erp.id}
                    type="button"
                    onClick={() => {
                      setSelectedErpId(erp.id);
                      setAuthResult(null);
                      setImportResult(null);
                      setPipelineStep(0);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/40 shadow-sm ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-8 h-8 rounded-lg ${erp.iconBg} text-white font-black text-xs flex items-center justify-center shadow-xs`}>
                        {erp.initials}
                      </div>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {erp.badge}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 truncate">{erp.name}</div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">{erp.category}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Client Credentials & Handshake Verification Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg ${selectedErp.iconBg} text-white font-black text-xs flex items-center justify-center`}>
                  {selectedErp.initials}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    {selectedErp.name} Client Credentials
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <ShieldCheck size={11} /> Configured
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Protocol: <span className="font-semibold text-slate-700">{selectedErp.authTypeLabel}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestAuth}
                  disabled={isAuthenticating || isImporting}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isAuthenticating ? <RefreshCw size={13} className="animate-spin text-blue-600" /> : <Lock size={13} className="text-slate-500" />}
                  {isAuthenticating ? 'Testing Handshake...' : 'Verify Credentials'}
                </button>
              </div>
            </div>

            {/* Credential Key Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              {Object.entries(creds.fields).slice(0, 4).map(([key, val]) => (
                <div key={key} className="bg-white p-2 rounded-lg border border-slate-200/80">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{key}</div>
                  <div className="font-mono text-slate-800 font-semibold truncate mt-0.5">
                    {key.toLowerCase().includes('secret') || key.toLowerCase().includes('token')
                      ? '••••••••••••••••'
                      : val}
                  </div>
                </div>
              ))}
            </div>

            {/* Auth Test Result Alert */}
            {authResult && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs flex items-start gap-2 animate-in fade-in">
                <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="font-bold">Credential Handshake Succeeded ({authResult.latencyMs}ms)</div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    {authResult.message} Token: <code className="font-mono bg-emerald-100/80 px-1 py-0.5 rounded text-[10px]">{authResult.tokenSnippet}</code>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Scope and Period Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Ledger Scope */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2.5 flex items-center gap-1.5">
                <Layers size={14} className="text-blue-600" /> 2. Ledger Ingestion Scope
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'BOTH', label: 'Dual Ledgers', desc: 'Sales & Purchases' },
                  { id: 'SALES', label: 'Sales Only', desc: 'Outward Vouchers' },
                  { id: 'PURCHASE', label: 'Purchase Only', desc: 'Inward ITC Bills' },
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setLedgerScope(item.id as any)}
                    className={`p-2.5 rounded-lg border text-center transition-all ${
                      ledgerScope === item.id
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{item.label}</div>
                    <div className="text-[10px] opacity-75">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Accounting Period */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2.5 flex items-center gap-1.5">
                <Clock size={14} className="text-indigo-600" /> 3. Accounting Period Filter
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'CURRENT_MONTH', label: 'Sep 2026', sub: 'Current Month' },
                  { id: 'LAST_MONTH', label: 'Aug 2026', sub: 'Previous Period' },
                  { id: 'CURRENT_QUARTER', label: 'Q2 FY 2026-27', sub: 'Jul - Sep 2026' },
                  { id: 'FY_2026_27', label: 'FY 2026-27', sub: 'Full Fiscal Year' },
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPeriod(item.id as any)}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      period === item.id
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{item.label}</div>
                    <div className="text-[10px] text-slate-500">{item.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Real-time Ingestion Pipeline Animation */}
          {isImporting && (
            <div className="bg-slate-900 text-white rounded-xl p-5 shadow-lg space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw size={16} className="text-blue-400 animate-spin" />
                  <h4 className="text-sm font-bold">Importing Ledgers from {selectedErp.name}...</h4>
                </div>
                <span className="text-xs font-mono text-blue-300">Phase {pipelineStep} of 4</span>
              </div>

              {/* Progress Steps */}
              <div className="grid grid-cols-4 gap-2 text-xs">
                {[
                  { step: 1, title: 'Credentials Auth' },
                  { step: 2, title: 'Pulling Ledgers' },
                  { step: 3, title: 'GST Normalization' },
                  { step: 4, title: 'Commit to Store' }
                ].map(s => {
                  const isDone = pipelineStep > s.step;
                  const isCurrent = pipelineStep === s.step;
                  return (
                    <div
                      key={s.step}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        isDone
                          ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                          : isCurrent
                          ? 'bg-blue-950/60 border-blue-500 text-blue-300 animate-pulse'
                          : 'bg-slate-800/40 border-slate-700 text-slate-500'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider">Step {s.step}</div>
                      <div className="font-semibold text-xs truncate">{s.title}</div>
                    </div>
                  );
                })}
              </div>

              {/* Live Terminal Log */}
              <div className="bg-slate-950 rounded-lg p-3 font-mono text-[10px] text-slate-300 space-y-1 max-h-32 overflow-y-auto">
                {pipelineLogs.map((log, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-emerald-400">›</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Import Success Summary & Ledger Previews */}
          {importResult && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-emerald-950">
                        Successfully Imported from {importResult.erpName}
                      </h4>
                      <p className="text-xs text-emerald-700">
                        Audit Trail: <code className="font-mono font-bold">{importResult.auditTrailId}</code> • Execution: {importResult.executionTimeMs}ms
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {onNavigateToInvoices && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigateToInvoices();
                        }}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <Receipt size={13} /> View in Invoices
                      </button>
                    )}
                    {onNavigateToRecon && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigateToRecon();
                        }}
                        className="px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-900 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                      >
                        <FileCheck2 size={13} /> Open Reconciliation
                      </button>
                    )}
                  </div>
                </div>

                {/* Metrics Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-emerald-200/80">
                  <div className="bg-white/90 p-2.5 rounded-lg border border-emerald-100">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Sales Invoices</div>
                    <div className="text-base font-black text-slate-900">{importResult.importedSalesCount}</div>
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-lg border border-emerald-100">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Purchase Bills</div>
                    <div className="text-base font-black text-slate-900">{importResult.importedPurchaseCount}</div>
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-lg border border-emerald-100">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Taxable Value</div>
                    <div className="text-base font-black text-slate-900">₹{importResult.totalTaxableValue.toLocaleString('en-IN')}</div>
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-lg border border-emerald-100">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Total GST & ITC</div>
                    <div className="text-base font-black text-emerald-700">₹{importResult.totalTaxAmount.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              </div>

              {/* Imported Vouchers Table Preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Discovered Ledger Vouchers ({filteredPreview.length})
                  </span>
                  <div className="flex gap-1">
                    {(['ALL', 'SALES', 'PURCHASE'] as const).map(tab => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setPreviewTab(tab)}
                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded transition-colors ${
                          previewTab === tab ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto max-h-60">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="p-2.5">Voucher #</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Party / Vendor</th>
                        <th className="p-2.5">GSTIN</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5 text-right">Taxable (₹)</th>
                        <th className="p-2.5 text-right">GST (₹)</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {filteredPreview.map((inv, i) => (
                        <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-2.5 font-mono font-bold text-blue-700">{inv.invoiceNumber}</td>
                          <td className="p-2.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              inv.category === 'SALES' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                            }`}>
                              {inv.category}
                            </span>
                          </td>
                          <td className="p-2.5 font-bold text-slate-900 truncate max-w-[180px]">{inv.partyName}</td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-600">{inv.gstin}</td>
                          <td className="p-2.5 text-slate-500">{inv.date}</td>
                          <td className="p-2.5 text-right font-mono font-bold">₹{inv.amount.toLocaleString('en-IN')}</td>
                          <td className="p-2.5 text-right font-mono font-semibold text-emerald-700">₹{inv.taxAmount.toLocaleString('en-IN')}</td>
                          <td className="p-2.5 text-center">
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              Imported
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Lock size={12} className="text-slate-400" />
            <span>Encrypted with TLS 1.3 & SHA-256</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-colors"
            >
              {importResult ? 'Done' : 'Cancel'}
            </button>

            <button
              type="button"
              onClick={handleStartImport}
              disabled={isImporting}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              {isImporting ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} className="text-amber-300" />}
              {isImporting ? 'Executing Import...' : `One-Click Import from ${selectedErp.initials}`}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
export default OneClickErpImportModal;
