import React, { useState } from 'react';
import { 
  Layers, Shield, FileText, CheckCircle2, AlertTriangle, ArrowRight, 
  HelpCircle, Eye, ChevronRight, Lock, Sparkles, Filter, RefreshCw, 
  ExternalLink, Building2, MapPin, UserCheck, Calendar, Sliders, 
  X, Check, AlertCircle, Info, Split, Database, Clock, Scale,
  LockKeyhole, Unlock, ShieldAlert, Cpu, GitPullRequest, Search,
  Server, ArrowUpRight, History, Bell, User, CheckSquare
} from 'lucide-react';

export type PeriodState = 'OPEN' | 'UNDER_REVIEW' | 'APPROVED' | 'FILED' | 'LOCKED';

export interface EnterpriseExceptionItem {
  id: string;
  domain: 'TAX_MISMATCH' | 'POS_ISSUE' | 'RULE_CONFLICT' | 'ITC_MISMATCH' | 'SEC_17_5' | 'RCM_ISSUE' | 'RECONCILIATION' | 'IRP_FAILURE' | 'EWB_FAILURE' | 'ERP_SYNC';
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  sourceRecord: string;
  detectedAt: string;
  slaDueDate: string;
  assignedOwner: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'PENDING_VENDOR' | 'AMENDED' | 'RESOLVED';
  summary: string;
  auditTrail: { timestamp: string; action: string; actor: string }[];
}

export const EnterpriseFrontendUxDesignPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'CONTRACT_FREEZE' | 'PERIOD_CONTROL' | 'EXCEPTION_CENTER' | 'TAX_EXPLAINER' | 'MULTI_SOURCE_RECON' | 'INVOICE_LIFECYCLE' | 'ITC_UX' | 'LEDGER_UX' | 'SCREENS_29' | 'IA_NAV'
  >('CONTRACT_FREEZE');

  // Global Period Control State
  const [activePeriod, setActivePeriod] = useState<string>('2026-09');
  const [periodState, setPeriodState] = useState<PeriodState>('APPROVED');
  const [amendmentModalOpen, setAmendmentModalOpen] = useState<boolean>(false);

  // Contract freeze inspection state
  const [selectedContractKey, setSelectedContractKey] = useState<string>('SCHEMA');
  const [liveExplainerResult, setLiveExplainerResult] = useState<any>(null);
  const [liveExplainerLoading, setLiveExplainerLoading] = useState<boolean>(false);

  // Invoice lifecycle stepper state
  const [currentStep, setCurrentStep] = useState<number>(3);
  const [explainerOpen, setExplainerOpen] = useState<boolean>(false);

  const fetchLiveTaxExplainer = async () => {
    setLiveExplainerLoading(true);
    try {
      const res = await fetch('/api/v1/tax-engine/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docNumber: 'INV-LIVE-9014',
          taxableValue: 100000,
          placeOfSupply: '29 (Karnataka)',
          supplierGstin: '27AABCT1332M1Z2',
          recipientGstin: '29AAACW1234L1Z1'
        })
      });
      const data = await res.json();
      setLiveExplainerResult(data);
    } catch (err) {
      console.warn('Explainer error fallback', err);
    } finally {
      setLiveExplainerLoading(false);
    }
  };

  // Exception Center Filters
  const [exceptionFilter, setExceptionFilter] = useState<string>('ALL');
  const [selectedException, setSelectedException] = useState<EnterpriseExceptionItem | null>(null);

  // Extensible Multi-Source Reconciliation Filters
  const [selectedEvidenceSources, setSelectedEvidenceSources] = useState<string[]>([
    'PURCHASE_REGISTER', 'GSTR_2B', 'EWAY_BILL', 'ERP_LEDGER'
  ]);

  // ITC Scenario Selector
  const [itcScenario, setItcScenario] = useState<'RAW_MATERIAL' | 'MOTOR_VEHICLE' | 'FOOD_BEVERAGES' | 'CAPITAL_GOODS'>('MOTOR_VEHICLE');

  const periodProgression: { state: PeriodState; label: string; desc: string; icon: string }[] = [
    { state: 'OPEN', label: '1. Open', desc: 'Daily operations & standard document ingestion', icon: '🟢' },
    { state: 'UNDER_REVIEW', label: '2. Under Review', desc: 'Reconciliation active; exceptions triaged', icon: '🟡' },
    { state: 'APPROVED', label: '3. Approved', desc: 'Tax Head sign-off; return payloads frozen', icon: '🔵' },
    { state: 'FILED', label: '4. Filed', desc: 'Furnished to GSTN; ARN stamped & challans paid', icon: '🟣' },
    { state: 'LOCKED', label: '5. Locked', desc: 'Immutable subledger; edits via controlled amendment', icon: '🔒' }
  ];

  const exceptionsData: EnterpriseExceptionItem[] = [
    {
      id: 'EXC-2026-09-0012',
      domain: 'TAX_MISMATCH',
      title: 'Tax Rate Mismatch: Vendor filed 12% vs Booked 18%',
      severity: 'HIGH',
      sourceRecord: 'INV-9014 (Acme Corp Ltd)',
      detectedAt: '2026-09-17 14:20 IST',
      slaDueDate: '2026-09-19 18:00 IST',
      assignedOwner: 'Anita Sharma (Tax Mgr)',
      status: 'UNDER_REVIEW',
      summary: 'Backend tax engine detected ₹9,000 variance between purchase booking and GSTR-2B data. Hold ITC claim until credit note or amendment is furnished.',
      auditTrail: [
        { timestamp: '2026-09-17 14:20', action: 'Detected by Reconciliation Worker', actor: 'SYSTEM' },
        { timestamp: '2026-09-17 14:35', action: 'Assigned to Anita Sharma', actor: 'AUTO_ROUTER' }
      ]
    },
    {
      id: 'EXC-2026-09-0018',
      domain: 'POS_ISSUE',
      title: 'Contradictory Place of Supply: Delivery state differs from Buyer GSTIN',
      severity: 'CRITICAL',
      sourceRecord: 'SO-8842 (Bharat Heavy Infra)',
      detectedAt: '2026-09-17 15:10 IST',
      slaDueDate: '2026-09-18 12:00 IST',
      assignedOwner: 'Rahul Verma (Billing Ops)',
      status: 'OPEN',
      summary: 'Recipient provided Karnataka GSTIN (29) but physical delivery address is Chennai, Tamil Nadu (33). Requires Bill-to/Ship-to statutory validation.',
      auditTrail: [
        { timestamp: '2026-09-17 15:10', action: 'POS validation failed in TaxEngine-v2.4', actor: 'SYSTEM' }
      ]
    },
    {
      id: 'EXC-2026-09-0024',
      domain: 'RULE_CONFLICT',
      title: 'Dual HSN Classification Ambiguity (Circular 198/2023)',
      severity: 'MEDIUM',
      sourceRecord: 'ITEM-CAT-4019 (Specialized Carbon Composite)',
      detectedAt: '2026-09-16 11:00 IST',
      slaDueDate: '2026-09-20 18:00 IST',
      assignedOwner: 'Suresh Menon (Compliance Lead)',
      status: 'UNDER_REVIEW',
      summary: 'Rule engine identified conflicting entries under Notification 14/2024 vs Circular 198. Requires tax counsel review before rate locking.',
      auditTrail: [
        { timestamp: '2026-09-16 11:00', action: 'Rule resolver flagged ambiguous match', actor: 'SYSTEM' }
      ]
    },
    {
      id: 'EXC-2026-09-0031',
      domain: 'SEC_17_5',
      title: 'Blocked Credit u/s 17(5)(a): Executive SUV Lease',
      severity: 'MEDIUM',
      sourceRecord: 'PO-7712 (LeasePlan India)',
      detectedAt: '2026-09-17 09:15 IST',
      slaDueDate: '2026-09-20 18:00 IST',
      assignedOwner: 'Anita Sharma (Tax Mgr)',
      status: 'RESOLVED',
      summary: 'Vehicle seating capacity < 13 persons. Auto-diverted from Electronic Credit Ledger to GSTR-3B Table 4(B)(1) Ineligible ITC. Cost capitalized.',
      auditTrail: [
        { timestamp: '2026-09-17 09:15', action: 'Statutory engine tagged Section 17(5)(a)', actor: 'SYSTEM' },
        { timestamp: '2026-09-17 10:00', action: 'Confirmed and capitalized to ledger', actor: 'Anita Sharma' }
      ]
    },
    {
      id: 'EXC-2026-09-0045',
      domain: 'IRP_FAILURE',
      title: 'NIC Gateway Timeout during E-Invoice IRN Generation',
      severity: 'HIGH',
      sourceRecord: 'INV-2026-09-0850',
      detectedAt: '2026-09-17 16:45 IST',
      slaDueDate: '2026-09-17 19:00 IST',
      assignedOwner: 'DevOps & Integration Hub',
      status: 'OPEN',
      summary: 'IRP Endpoint NIC-Portal-1 timed out after 15,000ms. Job queued in BullMQ retry buffer with exponential backoff (attempt 2 of 5).',
      auditTrail: [
        { timestamp: '2026-09-17 16:45', action: 'HTTP 504 Gateway Timeout from IRP', actor: 'SYSTEM' }
      ]
    },
    {
      id: 'EXC-2026-09-0052',
      domain: 'ERP_SYNC',
      title: 'SAP S/4HANA Document Id Mismatch (DOC-44819)',
      severity: 'MEDIUM',
      sourceRecord: 'SAP-BATCH-0917-A',
      detectedAt: '2026-09-17 13:00 IST',
      slaDueDate: '2026-09-18 18:00 IST',
      assignedOwner: 'IT Systems Admin',
      status: 'PENDING_VENDOR',
      summary: 'RFC Connector returned payload variance on debit note sequence. TaxFlow holds lock pending SAP IDoc regeneration.',
      auditTrail: [
        { timestamp: '2026-09-17 13:00', action: 'Connector sync variance logged', actor: 'SYSTEM' }
      ]
    }
  ];

  const filteredExceptions = exceptionFilter === 'ALL' 
    ? exceptionsData 
    : exceptionsData.filter(e => e.domain === exceptionFilter);

  const screenInventory = [
    { num: 1, name: 'Login & Authentication', category: 'Auth & Access', route: '/login', role: 'All' },
    { num: 2, name: 'Organization / Group Mgmt', category: 'Entity Hierarchy', route: '/settings/organization', role: 'Super Admin' },
    { num: 3, name: 'Control Tower Dashboard', category: 'Executive View', route: '/control-tower', role: 'Exec, Tax Head' },
    { num: 4, name: 'GSTIN Registration Directory', category: 'Masters', route: '/masters/gstin', role: 'Tax Admin' },
    { num: 5, name: 'Branch & Warehouse Directory', category: 'Masters', route: '/masters/branches', role: 'Ops' },
    { num: 6, name: 'Customer Master', category: 'Masters', route: '/masters/customers', role: 'Accountant' },
    { num: 7, name: 'Vendor Master & Risk Profile', category: 'Masters', route: '/masters/vendors', role: 'Procurement' },
    { num: 8, name: 'Item / HSN / SAC Master', category: 'Masters', route: '/masters/items', role: 'Catalog Mgr' },
    { num: 9, name: 'Sales Invoice Hub', category: 'Outward Supplies', route: '/sales/invoices', role: 'Accountant' },
    { num: 10, name: 'Invoice Approval Workflow', category: 'Outward Supplies', route: '/sales/approvals', role: 'Finance Mgr' },
    { num: 11, name: 'E-Invoice / IRN Gateway', category: 'Outward Supplies', route: '/sales/e-invoice', role: 'Billing Ops' },
    { num: 12, name: 'E-Way Bill Operations', category: 'Outward Supplies', route: '/sales/ewaybill', role: 'Logistics' },
    { num: 13, name: 'Purchase Register', category: 'Inward Supplies', route: '/purchases/register', role: 'Accountant' },
    { num: 14, name: 'GSTR-2B Data / Sync', category: 'Inward Supplies', route: '/purchases/gstr-2b', role: 'Tax Accountant' },
    { num: 15, name: 'ITC Management Center', category: 'ITC & RCM', route: '/itc/management', role: 'Tax Manager' },
    { num: 16, name: 'RCM Management & Self-Invoice', category: 'ITC & RCM', route: '/compliance/rcm', role: 'Accountant' },
    { num: 17, name: 'Reconciliation Workspace', category: 'Reconciliation', route: '/reconciliation', role: 'Analyst, Auditor' },
    { num: 18, name: 'Authoritative Tax Ledger', category: 'Subledger', route: '/ledger/electronic', role: 'CFO, Auditor' },
    { num: 19, name: 'GSTR-1 Return Preparer', category: 'Statutory Returns', route: '/returns/gstr-1', role: 'Tax Manager' },
    { num: 20, name: 'GSTR-3B Settlement Center', category: 'Statutory Returns', route: '/returns/gstr-3b', role: 'Tax Head' },
    { num: 21, name: 'GSTR-9 Annual Return', category: 'Statutory Returns', route: '/returns/gstr-9', role: 'Senior Tax Counsel' },
    { num: 22, name: 'Regulatory Rule Repository', category: 'Statutory Rules', route: '/regulatory/rules', role: 'Compliance Officer' },
    { num: 23, name: 'Compliance Archive Timeline', category: 'Audit & Legal', route: '/compliance-archive', role: 'Auditor, Legal' },
    { num: 24, name: 'Cryptographic Audit Trail', category: 'Audit & Legal', route: '/audit/trail', role: 'Security, Auditor' },
    { num: 25, name: 'Reports & Exports', category: 'Reporting', route: '/reports', role: 'Finance' },
    { num: 26, name: 'Users / Roles / Permissions', category: 'Governance', route: '/settings/rbac', role: 'Super Admin' },
    { num: 27, name: 'Integration Management', category: 'Governance', route: '/settings/integrations', role: 'IT Lead' },
    { num: 28, name: 'Notification & Alerts Center', category: 'Collaboration', route: '/notifications', role: 'All' },
    { num: 29, name: 'System Settings', category: 'Configuration', route: '/settings/system', role: 'System Admin' }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner with Statutory Disclaimer */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 border border-indigo-800/50 shadow-2xl text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-xs font-bold font-mono">
              <Sparkles size={14} className="text-indigo-400" />
              PHASE 2: ENTERPRISE FRONTEND UX/UI ARCHITECTURE SPECIFICATION
            </div>
            <h2 className="text-xl lg:text-3xl font-black tracking-tight text-white">
              TaxFlow Enterprise UX & Governance Workspace
            </h2>
            <p className="text-xs lg:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Decoupled, multi-tenant GST platform: Next.js 15 frontend strictly consumes authoritative NestJS + PostgreSQL services. Zero client-side statutory hardcoding.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-indigo-500/40 text-xs font-mono text-emerald-300 font-bold">
              29 Core Modules Defined
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-amber-500/40 text-xs font-mono text-amber-300 font-bold">
              {exceptionsData.length} Centralized Exceptions
            </span>
          </div>
        </div>

        {/* Universal Statutory Disclaimer Banner */}
        <div className="mt-4 p-3 rounded-xl bg-slate-900/80 border border-slate-700 text-[11px] text-slate-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-amber-400 shrink-0" />
            <span>
              <strong>STATUTORY DATA DISCLAIMER:</strong> All rates, sections, notification citations, and tax numbers shown in this interface are <em>mock/example fixtures only</em>. The frontend does not calculate or hardcode statutory rules; all values are supplied authoritatively by backend microservices.
            </span>
          </div>
          <span className="shrink-0 px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-200 font-mono text-[10px] font-bold border border-indigo-700">
            SYSTEM CALCULATION ONLY
          </span>
        </div>

        {/* Global Context Switcher Simulator Header */}
        <div className="mt-4 pt-4 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400 font-medium">Active Hierarchy:</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 font-bold text-slate-200 flex items-center gap-1.5">
              <Building2 size={13} className="text-indigo-400" /> Group: Tata Group
            </span>
            <span className="text-slate-500">➔</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 font-bold text-slate-200">
              Co: Titan Company Ltd
            </span>
            <span className="text-slate-500">➔</span>
            <span className="px-2.5 py-1 rounded-lg bg-indigo-900/60 border border-indigo-600/50 font-bold text-indigo-200 flex items-center gap-1.5">
              <MapPin size={13} className="text-emerald-400" /> GSTIN: 27AABCT1332M1Z2 (MH)
            </span>
            <span className="text-slate-500">➔</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 font-bold text-slate-200">
              Branch: Mumbai Central Depot (BR-001)
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <Calendar size={13} className="text-indigo-400" /> Period: <span className="text-white font-bold">{activePeriod}</span>
            <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
              periodState === 'LOCKED' ? 'bg-rose-900/70 text-rose-300 border border-rose-600' :
              periodState === 'FILED' ? 'bg-purple-900/70 text-purple-300 border border-purple-600' :
              periodState === 'APPROVED' ? 'bg-indigo-900/70 text-indigo-300 border border-indigo-600' :
              periodState === 'UNDER_REVIEW' ? 'bg-amber-900/70 text-amber-300 border border-amber-600' :
              'bg-emerald-900/70 text-emerald-300 border border-emerald-600'
            }`}>
              {periodState}
            </span>
          </div>
        </div>

        {/* Navigation Tabs for UX Spec Review */}
        <div className="flex bg-slate-900/90 p-1.5 rounded-xl border border-slate-700/70 mt-5 overflow-x-auto gap-1">
          {[
            { id: 'CONTRACT_FREEZE', label: '0. Architectural Freeze & Contracts' },
            { id: 'PERIOD_CONTROL', label: '1. Period Control Lifecycle' },
            { id: 'EXCEPTION_CENTER', label: '2. Enterprise Exception Center' },
            { id: 'MULTI_SOURCE_RECON', label: '3. Extensible Multi-Source Recon' },
            { id: 'TAX_EXPLAINER', label: '4. Statutory Tax Explainer' },
            { id: 'INVOICE_LIFECYCLE', label: '5. 9-Stage Invoice Stepper' },
            { id: 'ITC_UX', label: '6. ITC Decision Engine' },
            { id: 'LEDGER_UX', label: '7. Subledger Provenance' },
            { id: 'SCREENS_29', label: '8. 29 Screen Specifications' },
            { id: 'IA_NAV', label: '9. Information & Role Architecture' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 0. ARCHITECTURAL CONTRACTS FREEZE DASHBOARD */}
      {activeTab === 'CONTRACT_FREEZE' && (
        <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/80 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-700/80 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-600 text-[11px] font-bold uppercase tracking-wider">
                  Phase 2 Freeze Status: Complete
                </span>
                <span className="text-slate-400 text-xs font-mono">v2.2.0-FROZEN</span>
              </div>
              <h3 className="text-lg font-bold text-white mt-1.5 flex items-center gap-2">
                <Shield className="text-indigo-400" size={20} />
                Authoritative Contracts & Architectural Freeze Sign-Off
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Verification of all 10 core architectural contracts prior to writing full production frontend views.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={fetchLiveTaxExplainer}
                disabled={liveExplainerLoading}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
              >
                <RefreshCw size={13} className={liveExplainerLoading ? 'animate-spin' : ''} />
                Test Live Backend Explainer
              </button>
            </div>
          </div>

          {/* 10 Core Architectural Contracts Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { id: 'SCHEMA', title: '1. Database / Prisma', status: 'VERIFIED', desc: 'Tenant & PAN RLS schemas' },
              { id: 'API_CLIENT', title: '2. Typed API Client', status: 'VERIFIED', desc: 'Correlation IDs & headers' },
              { id: 'RBAC', title: '3. RBAC & Entity Scope', status: 'VERIFIED', desc: '6 roles with domain checks' },
              { id: 'PERIOD_SM', title: '4. Period State Machine', status: 'VERIFIED', desc: '5 stages + locked block' },
              { id: 'TAX_ENGINE', title: '5. Tax Engine API', status: 'VERIFIED', desc: 'Zero client statutory logic' },
              { id: 'TAX_EXPLAINER', title: '6. Tax Explainer', status: 'VERIFIED', desc: 'Provenance + legal notice' },
              { id: 'EXCEPTIONS', title: '7. Exception Center', status: 'VERIFIED', desc: '10 operational domains' },
              { id: 'RECON_EVIDENCE', title: '8. Extensible Recon', status: 'VERIFIED', desc: '6 pluggable evidence sources' },
              { id: 'INVOICE_WF', title: '9. Invoice Workflow', status: 'VERIFIED', desc: '9-stage backend machine' },
              { id: 'AUDIT_TRAIL', title: '10. Audit & Ledger', status: 'VERIFIED', desc: 'Cryptographic SHA256 trail' }
            ].map(item => (
              <div 
                key={item.id}
                onClick={() => setSelectedContractKey(item.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedContractKey === item.id 
                    ? 'bg-indigo-950/60 border-indigo-500 shadow-lg' 
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-white truncate">{item.title}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                    ✓ {item.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Contract Deep-Dive Inspector */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <FileText size={14} className="text-indigo-400" />
                Active Contract Schema & Constraints: {selectedContractKey}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Location: /services/contracts/enterpriseContracts.ts</span>
            </div>

            {selectedContractKey === 'SCHEMA' && (
              <div className="p-3.5 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
                <div className="text-emerald-400">// Holding Group ➔ Company (PAN) ➔ State GSTIN ➔ Branch (Unit)</div>
                <div>model LegalEntity &#123; id String @id, holdingGroupId String, pan String @unique, cin String &#125;</div>
                <div>model StateGstin &#123; id String @id, gstin String @unique, stateCode String, status String &#125;</div>
                <div>model OperationalBranch &#123; id String @id, gstinId String, branchCode String, address Json &#125;</div>
                <div className="text-slate-500 text-[11px] mt-2">Enforcement: RLS policies on Neon PostgreSQL ensure tenant cross-talk is impossible.</div>
              </div>
            )}

            {selectedContractKey === 'API_CLIENT' && (
              <div className="p-3.5 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
                <div className="text-indigo-400">// Centralized API Client with correlation tracing & entity headers</div>
                <div>Headers Injected: x-tenant-id, x-company-id, x-gstin-id, x-branch-id, x-tax-period, x-correlation-id</div>
                <div>Error Handler: Standardized HTTP 423 (Locked Period) & auto-retries for 500+ idempotency</div>
                <div>Singleton Instance: enterpriseApiClient from '/services/api/enterpriseApiClient'</div>
              </div>
            )}

            {selectedContractKey === 'PERIOD_SM' && (
              <div className="p-3.5 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
                <div className="text-purple-400">// Strict 5-Stage Period State Machine</div>
                <div>type PeriodState = 'OPEN' | 'UNDER_REVIEW' | 'APPROVED' | 'FILED' | 'LOCKED';</div>
                <div className="text-rose-400">// LOCKED Period Policy: Backend blocks any normal create/edit/delete with HTTP 423</div>
                <div>Amendment Protocol: Requires Section 34 CDN or Form DRC-03 adjustment with dual-authorization</div>
              </div>
            )}

            {selectedContractKey === 'TAX_ENGINE' && (
              <div className="p-3.5 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
                <div className="text-amber-400">// ZERO CLIENT-SIDE STATUTORY TAX LOGIC MANDATE</div>
                <div>Frontend Rule: React never computes rates, POS, CGST/SGST/IGST split, or 17(5) blocked credit.</div>
                <div>All tax determinations returned authoritatively by NestJS /api/v1/tax-engine/calculate</div>
                <div>Mock data is restricted solely to demo fixtures and explicitly marked as example values.</div>
              </div>
            )}

            {selectedContractKey === 'TAX_EXPLAINER' && (
              <div className="p-3.5 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
                <div className="text-blue-400">// Tax Explainer Response Contract with Legal Disclaimer</div>
                <div>Outputs: Tax inputs, resolved rule ID, version, effective date, tax treatment, calculation breakdown</div>
                <div className="text-amber-300 font-bold">Disclaimer: "System calculation explanation derived from backend rules for operational auditability. Does not constitute independent legal advice."</div>
              </div>
            )}

            {selectedContractKey === 'EXCEPTIONS' && (
              <div className="p-3.5 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
                <div className="text-emerald-400">// 10 Centralized Exception Domains</div>
                <div>Domains: TAX_MISMATCH, POS_ISSUE, RULE_CONFLICT, ITC_MISMATCH, SEC_17_5, RCM_ISSUE, RECONCILIATION, IRP_FAILURE, EWB_FAILURE, ERP_SYNC</div>
                <div>Payload: exceptionId, severity, status, sourceRecordId, slaDueDate, assignedOwner, auditTrail</div>
              </div>
            )}

            {selectedContractKey === 'RECON_EVIDENCE' && (
              <div className="p-3.5 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
                <div className="text-indigo-400">// Extensible Multi-Source Reconciliation Framework</div>
                <div>Sources: Purchase Register, GSTR-2B Data / Sync, E-Way Bill, ERP Ledger, Bank Clearance, ICEGATE</div>
                <div>UI Design: Pluggable evidence toggles; frontend displays whichever sources are configured.</div>
              </div>
            )}

            {selectedContractKey === 'INVOICE_WF' && (
              <div className="p-3.5 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
                <div className="text-cyan-400">// Deterministic 9-Stage Invoice Workflow</div>
                <div>Stages: Draft ➔ Validate ➔ Tax Calculate ➔ Review ➔ Approve ➔ Post ➔ IRN ➔ E-Way Bill ➔ Completed</div>
                <div>Backend Controls: State cannot be transitioned client-side without backend schema validation.</div>
              </div>
            )}

            {selectedContractKey === 'AUDIT_TRAIL' && (
              <div className="p-3.5 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
                <div className="text-slate-300">// Cryptographic Audit Trail & Provenance</div>
                <div>Attributes: Who, What, When, Why, Previous Value, New Value, Rule Version, Engine Version, Execution Hash</div>
                <div>Protocol: Append-only subledger vault with SHA-256 seal and Section 35/36 72-month compliance certificate.</div>
              </div>
            )}

            {selectedContractKey === 'RBAC' && (
              <div className="p-3.5 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
                <div className="text-rose-400">// 6 Enterprise Roles & Resource Domain Scope</div>
                <div>Roles: SUPER_ADMIN, TAX_ADMIN, OPERATIONS_ACCOUNTANT, FINANCE_APPROVER, STATUTORY_AUDITOR, BUSINESS_VIEWER</div>
                <div>Principle: "Frontend RBAC is UX protection. Backend RBAC is security enforcement."</div>
              </div>
            )}
          </div>

          {/* Live Explainer Verification Output if run */}
          {liveExplainerResult && (
            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Live Backend Explainer Response Verified
                </span>
                <span className="text-[10px] text-slate-400 font-mono">{liveExplainerResult.overallExplanation}</span>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-amber-200">
                ⚖️ <strong>Statutory Disclaimer:</strong> {liveExplainerResult.statutoryDisclaimer}
              </div>
              <pre className="text-[10px] font-mono text-slate-300 overflow-x-auto p-2 bg-slate-900/60 rounded max-h-40">
                {JSON.stringify(liveExplainerResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* 1. GLOBAL TAX / FINANCIAL PERIOD CONTROL */}
      {activeTab === 'PERIOD_CONTROL' && (
        <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/80 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <LockKeyhole size={18} className="text-indigo-400" />
                Global Tax / Financial Period Control Lifecycle
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                State machine: <code>OPEN ➔ UNDER REVIEW ➔ APPROVED ➔ FILED ➔ LOCKED</code>. Locked periods prevent normal edits. Corrections must use controlled amendment workflows.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Select Active Period:</span>
              <select 
                value={activePeriod}
                onChange={(e) => setActivePeriod(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-white font-mono font-bold"
              >
                <option value="2026-09">September 2026 (FY 2026-27)</option>
                <option value="2026-08">August 2026 (FY 2026-27)</option>
                <option value="2026-07">July 2026 (FY 2026-27)</option>
              </select>
            </div>
          </div>

          {/* Stepper for Period States */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {periodProgression.map((p) => {
              const isCurrent = periodState === p.state;
              return (
                <button
                  key={p.state}
                  onClick={() => setPeriodState(p.state)}
                  className={`p-3.5 rounded-xl border text-left transition-all relative ${
                    isCurrent 
                      ? 'bg-indigo-950/90 border-indigo-500 shadow-lg ring-2 ring-indigo-500/40' 
                      : 'bg-slate-900/50 border-slate-700/80 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-base">{p.icon}</span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">{p.state}</span>
                  </div>
                  <div className="text-xs font-bold text-white">{p.label}</div>
                  <div className="text-[10px] text-slate-400 leading-tight mt-1">{p.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Period State Enforcement Card */}
          <div className={`p-5 rounded-xl border space-y-4 ${
            periodState === 'LOCKED' 
              ? 'bg-rose-950/30 border-rose-600/50 text-rose-200'
              : periodState === 'FILED'
              ? 'bg-purple-950/30 border-purple-600/50 text-purple-200'
              : periodState === 'APPROVED'
              ? 'bg-indigo-950/30 border-indigo-600/50 text-indigo-200'
              : 'bg-slate-900/80 border-slate-700 text-slate-300'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {periodState === 'LOCKED' ? <Lock size={18} className="text-rose-400" /> : <Unlock size={18} className="text-emerald-400" />}
                <span className="text-xs font-bold font-mono uppercase tracking-wider">
                  Operational Permissions for Period {activePeriod} — Status: {periodState}
                </span>
              </div>
              {periodState === 'LOCKED' && (
                <button 
                  onClick={() => setAmendmentModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <GitPullRequest size={13} /> Initiate Controlled Amendment Protocol
                </button>
              )}
            </div>

            <div className="text-xs space-y-2">
              {periodState === 'OPEN' && (
                <p className="text-slate-300">
                  Full CRUD enabled: Sales invoices, inward purchase entries, credit/debit notes, and preliminary tax calculations are fully editable.
                </p>
              )}
              {periodState === 'UNDER_REVIEW' && (
                <p className="text-slate-300">
                  Reconciliation active: Normal invoice creation restricted to pending draft corrections. Matching engine active across all evidence sources.
                </p>
              )}
              {periodState === 'APPROVED' && (
                <p className="text-slate-300">
                  Tax Head Sign-off Complete: Financial values frozen. Final GSTR-1 and GSTR-3B payload compilation locked. Ready for GSTN portal submission.
                </p>
              )}
              {periodState === 'FILED' && (
                <p className="text-slate-300">
                  Statutory Return Furnished: ARN <code>AA270926019283K</code> stamped. Tax liability discharged via Electronic Cash/Credit Ledgers.
                </p>
              )}
              {periodState === 'LOCKED' && (
                <div className="space-y-2">
                  <p className="font-bold text-rose-300">
                    PERIOD IS SEALED & IMMUTABLE. Normal creates, updates, and deletes are disabled across all sales, purchase, and ledger screens.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Any required corrections must be executed as post-filing adjustments via <strong>Section 34 Credit/Debit Notes</strong> or <strong>Form GST DRC-03 Voluntary Tax Settlement</strong> with dual manager approval and an unbroken cryptographic audit trail.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Amendment Protocol Modal Simulator */}
          {amendmentModalOpen && (
            <div className="p-5 rounded-xl bg-slate-900 border border-rose-500/60 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={18} className="text-rose-400" />
                  <span className="text-xs font-bold text-white uppercase">
                    Controlled Post-Filing Amendment Workflow (Section 34 / DRC-03)
                  </span>
                </div>
                <button 
                  onClick={() => setAmendmentModalOpen(false)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-slate-300">
                You are requesting an adjustment entry for a <strong>LOCKED</strong> statutory period ({activePeriod}). This action creates a pending amendment docket requiring two authorized sign-offs before posting to the authoritative subledger.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Adjustment Instrument Type:</label>
                  <select className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-xs">
                    <option>Section 34(1) Credit Note (Reduction of Tax Liability)</option>
                    <option>Section 34(2) Debit Note (Supplementary Tax Liability)</option>
                    <option>Form GST DRC-03 (Voluntary Cash Payment)</option>
                    <option>Subledger Reclassification Journal</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Statutory Justification Reason:</label>
                  <input 
                    type="text" 
                    placeholder="e.g., Audit observation on rate discrepancy for Invoice #INV-9014" 
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button 
                  onClick={() => setAmendmentModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 text-xs font-bold text-slate-300"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    alert('Amendment Docket #AMD-2026-09-001 created and routed for Dual Tax Head sign-off.');
                    setAmendmentModalOpen(false);
                  }}
                  className="px-3 py-1.5 rounded bg-rose-600 text-xs font-bold text-white hover:bg-rose-500"
                >
                  Submit for Dual Approval
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. ENTERPRISE EXCEPTION CENTER */}
      {activeTab === 'EXCEPTION_CENTER' && (
        <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/80 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-400" />
                Enterprise Exception Center (Centralized Triage)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Centralizing: Tax Mismatches, POS Issues, Rule Conflicts, ITC Mismatches, 17(5) Blocks, RCM Exceptions, Reconciliation, IRP Failures, E-Way Bill Failures, and ERP Sync Failures.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Filter Domain:</span>
              <select 
                value={exceptionFilter}
                onChange={(e) => setExceptionFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-white font-bold"
              >
                <option value="ALL">All Domains ({exceptionsData.length})</option>
                <option value="TAX_MISMATCH">Tax Mismatches</option>
                <option value="POS_ISSUE">POS Issues</option>
                <option value="RULE_CONFLICT">Rule Conflicts</option>
                <option value="SEC_17_5">Section 17(5) Exceptions</option>
                <option value="IRP_FAILURE">IRP / E-Invoice Failures</option>
                <option value="ERP_SYNC">ERP Sync Failures</option>
              </select>
            </div>
          </div>

          {/* Exceptions Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-900 border-b border-slate-700 text-[11px] font-bold uppercase text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">Exception ID</th>
                  <th className="py-2.5 px-3">Domain</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Title & Summary</th>
                  <th className="py-2.5 px-3">Source Record</th>
                  <th className="py-2.5 px-3">Assigned Owner</th>
                  <th className="py-2.5 px-3">SLA Due Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredExceptions.map((exc) => (
                  <tr key={exc.id} className="hover:bg-slate-700/30">
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">{exc.id}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300">
                        {exc.domain}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        exc.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                        exc.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}>
                        {exc.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 max-w-xs">
                      <div className="font-bold text-white truncate">{exc.title}</div>
                      <div className="text-[10px] text-slate-400 truncate">{exc.summary}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300 text-[11px]">{exc.sourceRecord}</td>
                    <td className="py-2.5 px-3 text-slate-300 text-[11px]">{exc.assignedOwner}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400 text-[10px]">{exc.slaDueDate}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-300">
                        {exc.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <button 
                        onClick={() => setSelectedException(exc)}
                        className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center gap-1"
                      >
                        <Eye size={12} /> Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Exception Detail Drawer / Modal */}
          {selectedException && (
            <div className="p-5 rounded-xl bg-slate-900 border border-indigo-500/50 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-400 text-sm">{selectedException.id}</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                      {selectedException.severity} SEVERITY
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                      {selectedException.domain}
                    </span>
                  </div>
                  <div className="text-white font-bold text-sm">{selectedException.title}</div>
                </div>
                <button 
                  onClick={() => setSelectedException(null)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-300">
                <div className="p-3 rounded bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[10px] text-slate-500 block">Source Reference:</span>
                  <span className="font-mono text-white font-bold">{selectedException.sourceRecord}</span>
                </div>
                <div className="p-3 rounded bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[10px] text-slate-500 block">Assigned Owner:</span>
                  <span className="text-white font-bold">{selectedException.assignedOwner}</span>
                </div>
                <div className="p-3 rounded bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[10px] text-slate-500 block">Statutory Resolution SLA:</span>
                  <span className="font-mono text-amber-300 font-bold">{selectedException.slaDueDate}</span>
                </div>
              </div>

              <div className="p-3 rounded bg-slate-800/40 border border-slate-700 text-slate-200 leading-relaxed">
                <strong>Discrepancy Details:</strong> {selectedException.summary}
              </div>

              <div className="space-y-2">
                <div className="font-bold text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <History size={13} className="text-indigo-400" /> Immutable Audit & Triage History
                </div>
                <div className="space-y-1.5">
                  {selectedException.auditTrail.map((at, idx) => (
                    <div key={idx} className="p-2 rounded bg-slate-800/60 border border-slate-700/50 flex items-center justify-between text-[11px]">
                      <span className="text-slate-300 font-mono">{at.timestamp} — {at.action}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 font-mono text-[10px]">{at.actor}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button 
                  onClick={() => alert(`Re-evaluated ${selectedException.id} against active rules.`)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
                >
                  Re-evaluate Against Rules
                </button>
                <button 
                  onClick={() => {
                    alert(`Dispatched statutory vendor query for ${selectedException.id}.`);
                    setSelectedException(null);
                  }}
                  className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                >
                  Dispatch Vendor Query / Adjustment
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. EXTENSIBLE MULTI-SOURCE RECONCILIATION */}
      {activeTab === 'MULTI_SOURCE_RECON' && (
        <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/80 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RefreshCw size={18} className="text-indigo-400" />
                Extensible Multi-Evidence Reconciliation Framework
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Configurable matching framework. Not restricted to PR + 2B; supports additional evidence sources like ERP journals, E-Way Bill transit, Bank clearance, and ICEGATE customs data.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Match Tolerance:</span>
              <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-white">± ₹5.00 Rounding</span>
            </div>
          </div>

          {/* Evidence Sources Selector (Extensible) */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
              Active Evidence Sources (Select plugins to include in reconciliation pass):
            </span>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { id: 'PURCHASE_REGISTER', label: 'Purchase Register (Primary)', required: true },
                { id: 'GSTR_2B', label: 'GSTR-2B Data / Sync (GSTN Feed)', required: true },
                { id: 'EWAY_BILL', label: 'E-Way Bill (Movement Proof)', required: false },
                { id: 'ERP_LEDGER', label: 'ERP Subledger (SAP / Tally)', required: false },
                { id: 'BANK_CLEARANCE', label: 'Bank Statement (Rule 37 180-day Proof)', required: false },
                { id: 'ICEGATE', label: 'ICEGATE (Import Bill of Entry)', required: false }
              ].map(source => {
                const isSelected = selectedEvidenceSources.includes(source.id);
                return (
                  <button
                    key={source.id}
                    onClick={() => {
                      if (source.required) return;
                      if (isSelected) {
                        setSelectedEvidenceSources(prev => prev.filter(s => s !== source.id));
                      } else {
                        setSelectedEvidenceSources(prev => [...prev, source.id]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 transition-all ${
                      isSelected 
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200' 
                        : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[9px] ${
                      isSelected ? 'bg-indigo-500 text-white' : 'border border-slate-600'
                    }`}>
                      {isSelected ? '✓' : ''}
                    </span>
                    {source.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Multi-Evidence Record Comparison Drilldown */}
          <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/40 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-400" />
                <span className="text-xs font-bold text-white">
                  Multi-Evidence Case #REC-9812: Acme Corp Ltd (PO-9014)
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                TAX MISMATCH DETECTED (MOCK DATA)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 space-y-1">
                <span className="text-indigo-300 font-bold uppercase text-[10px] block">1. Purchase Register</span>
                <div className="flex justify-between"><span>Date:</span> <span className="text-white font-mono">2026-09-14</span></div>
                <div className="flex justify-between"><span>Taxable:</span> <span className="text-white font-mono">₹1,50,000</span></div>
                <div className="flex justify-between"><span>Booked Rate:</span> <span className="text-white font-mono">18%</span></div>
                <div className="flex justify-between"><span>Tax:</span> <span className="text-white font-mono font-bold">₹27,000</span></div>
              </div>

              <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 space-y-1">
                <span className="text-emerald-300 font-bold uppercase text-[10px] block">2. GSTR-2B Data / Sync</span>
                <div className="flex justify-between"><span>Date:</span> <span className="text-white font-mono">2026-09-14</span></div>
                <div className="flex justify-between"><span>Taxable:</span> <span className="text-white font-mono">₹1,50,000</span></div>
                <div className="flex justify-between"><span>Filed Rate:</span> <span className="text-rose-400 font-mono font-bold">12%</span></div>
                <div className="flex justify-between"><span>Tax:</span> <span className="text-rose-400 font-mono font-bold">₹18,000</span></div>
              </div>

              <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 space-y-1">
                <span className="text-blue-300 font-bold uppercase text-[10px] block">3. E-Way Bill Movement</span>
                <div className="flex justify-between"><span>EWB #:</span> <span className="text-white font-mono">381928391029</span></div>
                <div className="flex justify-between"><span>Vehicle:</span> <span className="text-white font-mono">MH-04-AX-9912</span></div>
                <div className="flex justify-between"><span>Status:</span> <span className="text-emerald-400 font-bold">Delivered</span></div>
                <div className="flex justify-between"><span>Consignment:</span> <span className="text-white font-mono">₹1,77,000</span></div>
              </div>

              <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 space-y-1">
                <span className="text-purple-300 font-bold uppercase text-[10px] block">4. ERP General Ledger</span>
                <div className="flex justify-between"><span>SAP Doc:</span> <span className="text-white font-mono">5100098412</span></div>
                <div className="flex justify-between"><span>Cost Center:</span> <span className="text-white font-mono">CC-2900</span></div>
                <div className="flex justify-between"><span>Posting:</span> <span className="text-white font-mono">2026-09-15</span></div>
                <div className="flex justify-between"><span>Match:</span> <span className="text-emerald-400 font-bold">Posted</span></div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-600/30 text-xs text-amber-200 flex items-center justify-between">
              <span>Evidence Analysis: Goods delivered (EWB confirmed); Vendor under-reported rate at 12% instead of 18%. Shortfall: ₹9,000.</span>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold">
                  Hold Difference ITC
                </button>
                <button className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold">
                  Send Vendor Query
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. STATUTORY TAX EXPLAINER DRAWER */}
      {activeTab === 'TAX_EXPLAINER' && (
        <div className="bg-slate-800/80 rounded-2xl p-6 border border-indigo-700/60 shadow-2xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale size={20} className="text-indigo-400" />
              <div>
                <h3 className="text-base font-bold text-white">
                  Statutory Tax Calculation Explainer (System Provenance)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Explains the system calculation provenance derived from the backend rule engine. <strong>Does not present itself as independent legal advice.</strong>
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded bg-slate-900 border border-indigo-500/40 text-indigo-300 font-mono text-xs font-bold">
              API: /api/v1/tax-engine/explain
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input & Parameters Card */}
            <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-700 space-y-4 text-xs">
              <div className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Info size={14} className="text-blue-400" /> 1. Tax Inputs Provided to Backend Engine
              </div>
              <div className="grid grid-cols-2 gap-3 text-slate-300">
                <div className="p-2.5 rounded bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[10px] text-slate-500 block">Supplier Location:</span>
                  <span className="font-bold text-white">Maharashtra (27)</span>
                </div>
                <div className="p-2.5 rounded bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[10px] text-slate-500 block">Place of Supply (POS):</span>
                  <span className="font-bold text-white">Karnataka (29)</span>
                </div>
                <div className="p-2.5 rounded bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[10px] text-slate-500 block">Tax Treatment:</span>
                  <span className="font-bold text-emerald-400">Inter-State Supply (IGST)</span>
                </div>
                <div className="p-2.5 rounded bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[10px] text-slate-500 block">HSN / SAC Code:</span>
                  <span className="font-bold text-white font-mono">8471.30.10 (Laptops - Example)</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700 space-y-2">
                <div className="flex justify-between font-mono">
                  <span className="text-slate-400">Taxable Line Value:</span>
                  <span className="text-white font-bold">₹1,00,000.00</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate-400">Integrated Tax (IGST 18.00%):</span>
                  <span className="text-indigo-400 font-bold">+ ₹18,000.00</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate-400">Compensation Cess (0.00%):</span>
                  <span className="text-slate-400">₹0.00</span>
                </div>
                <div className="flex justify-between font-mono pt-2 border-t border-slate-700 text-sm">
                  <span className="text-white font-bold">Total Computed Supply Value:</span>
                  <span className="text-emerald-400 font-extrabold">₹1,18,000.00</span>
                </div>
              </div>
            </div>

            {/* Resolved Statutory Rule & Provenance Card */}
            <div className="p-5 rounded-xl bg-slate-900/90 border border-indigo-500/40 space-y-4 text-xs">
              <div className="font-bold text-indigo-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Shield size={14} className="text-indigo-400" /> 2. Backend Resolved Rule & Provenance Reference
              </div>

              <div className="space-y-2.5 text-slate-300">
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Resolved Rule ID:</span>
                  <span className="font-mono text-indigo-300 font-bold">RULE-HSN-8471-STD</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Active Rule Version:</span>
                  <span className="font-mono text-white font-bold">v3 (Approved & Frozen)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Effective Date:</span>
                  <span className="text-white">2024-04-01 to Present</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Statutory Notification Reference:</span>
                  <span className="text-white text-right">CBIC Notif. No. 14/2024-CT (Rate) (Example)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Calculation Protocol:</span>
                  <span className="text-white">Banker's Half-Up + Sec 170 CGST</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Engine Determinism Hash:</span>
                  <span className="font-mono text-[10px] text-emerald-400">SHA256:7f8a9b0c1d2e...</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-600/40 text-[11px] text-indigo-200 leading-relaxed">
                <strong>System Logic Explanation:</strong> The supply involves movement of goods terminating in Karnataka (State 29) from Maharashtra (State 27). The backend engine applied Inter-State IGST treatment per Section 10(1)(a) of the IGST Act at the resolved notification rate.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. 9-STAGE INVOICE WORKFLOW STEPPER */}
      {activeTab === 'INVOICE_LIFECYCLE' && (
        <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/80 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={18} className="text-indigo-400" />
                Deterministic 9-Stage Invoice Workflow Stepper
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                The frontend strictly enforces backend workflow progression. Steps cannot be bypassed.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Simulate Progress:</span>
              <button 
                disabled={currentStep <= 1}
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="px-2.5 py-1 rounded bg-slate-700 text-xs font-bold text-slate-200 disabled:opacity-40"
              >
                Previous Step
              </button>
              <button 
                disabled={currentStep >= 9}
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="px-2.5 py-1 rounded bg-indigo-600 text-xs font-bold text-white disabled:opacity-40"
              >
                Next Step
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2">
            {[
              { num: 1, title: 'Draft', desc: 'Party KYC & lines' },
              { num: 2, title: 'Validate', desc: 'POS & schema syntax' },
              { num: 3, title: 'Tax Compute', desc: 'Pure backend engine' },
              { num: 4, title: 'Review', desc: 'Credit & margins' },
              { num: 5, title: 'Approve', desc: 'Finance threshold' },
              { num: 6, title: 'Post', desc: 'Subledger liability' },
              { num: 7, title: 'IRN', desc: 'IRP signed hash' },
              { num: 8, title: 'E-Way Bill', desc: 'Part-A & Part-B' },
              { num: 9, title: 'Completed', desc: 'Sealed for GSTR-1' }
            ].map((step) => {
              const isPast = step.num < currentStep;
              const isCurrent = step.num === currentStep;
              return (
                <div 
                  key={step.num}
                  className={`p-3 rounded-xl border transition-all ${
                    isCurrent 
                      ? 'bg-indigo-950/80 border-indigo-500 shadow-md ring-1 ring-indigo-500' 
                      : isPast
                      ? 'bg-slate-900/60 border-emerald-500/40 text-slate-300'
                      : 'bg-slate-900/30 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isPast 
                        ? 'bg-emerald-500 text-white' 
                        : isCurrent 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-slate-800 text-slate-500'
                    }`}>
                      {isPast ? '✓' : step.num}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">#{step.num}</span>
                  </div>
                  <div className="font-bold text-xs text-white">{step.title}</div>
                  <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{step.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. ITC DECISION ENGINE */}
      {activeTab === 'ITC_UX' && (
        <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/80 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Split size={18} className="text-amber-400" />
                Input Tax Credit (ITC) Statutory Decision Engine (Mock Fixture)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Every inward line item is evaluated against Section 16 (Eligibility), Section 17(5) (Blocked), and Rules 42/43 (Reversals).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Test Scenario:</span>
              <select 
                value={itcScenario} 
                onChange={(e) => setItcScenario(e.target.value as any)}
                className="bg-slate-900 border border-slate-700 text-xs rounded-lg px-3 py-1.5 text-white font-bold"
              >
                <option value="MOTOR_VEHICLE">Motor Vehicle for Executive (Sec 17(5)(a))</option>
                <option value="FOOD_BEVERAGES">Outdoor Catering / Food (Sec 17(5)(b))</option>
                <option value="RAW_MATERIAL">Direct Raw Material for Production</option>
                <option value="CAPITAL_GOODS">Production Machinery (Rule 43)</option>
              </select>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Statutory Decision Output from Backend Engine
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase font-mono ${
                itcScenario === 'RAW_MATERIAL' || itcScenario === 'CAPITAL_GOODS'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {itcScenario === 'RAW_MATERIAL' ? 'ELIGIBLE_ITC' : itcScenario === 'CAPITAL_GOODS' ? 'ELIGIBLE_CAPITAL_GOODS' : 'BLOCKED_ITC_SEC_17_5'}
              </span>
            </div>

            <div className="text-xs text-slate-300 space-y-2">
              {itcScenario === 'MOTOR_VEHICLE' && (
                <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-600/40 text-rose-200">
                  <strong>Section 17(5)(a) Block:</strong> Motor vehicles with seating capacity ≤ 13 persons are blocked from ITC unless used for taxable onward transport or driving school services. Routed to GSTR-3B Table 4(B)(1).
                </div>
              )}
              {itcScenario === 'FOOD_BEVERAGES' && (
                <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-600/40 text-rose-200">
                  <strong>Section 17(5)(b) Block:</strong> Inward food and catering expenses are blocked from credit. Value auto-excluded from Electronic Credit Ledger.
                </div>
              )}
              {itcScenario === 'RAW_MATERIAL' && (
                <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-600/40 text-emerald-200">
                  <strong>Section 16 Eligibility Met:</strong> Valid tax invoice, goods physically received, tax deposited by vendor. Credited to Electronic Credit Ledger (Table 4(A)(5)).
                </div>
              )}
              {itcScenario === 'CAPITAL_GOODS' && (
                <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-600/40 text-indigo-200">
                  <strong>Capital Goods Rule 43:</strong> Eligible with 60-month useful life tracking. No Section 32 Income Tax depreciation claimed on GST component.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. SUBLEDGER PROVENANCE */}
      {activeTab === 'LEDGER_UX' && (
        <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/80 shadow-xl space-y-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Database size={18} className="text-emerald-400" />
            Authoritative Tax Ledger: 6-Tier Audit Provenance Drilldown
          </h3>
          <p className="text-xs text-slate-400">
            Every return figure is traceable through an unbroken chain of authoritative financial records:
          </p>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 text-xs space-y-3 font-mono">
            <div className="flex items-center gap-3 text-slate-300">
              <span className="px-2 py-0.5 rounded bg-indigo-900 text-indigo-300 font-bold text-[10px]">TIER 1</span>
              <span>Source Transaction: <strong>INV-2026-09-0842</strong> (Client: Acme Corp, Taxable: ₹1,00,000)</span>
            </div>
            <div className="pl-6 text-slate-500">↓</div>
            <div className="flex items-center gap-3 text-slate-300">
              <span className="px-2 py-0.5 rounded bg-blue-900 text-blue-300 font-bold text-[10px]">TIER 2</span>
              <span>Deterministic Tax Result: <strong>IGST ₹18,000.00</strong> (Supply to Karnataka, POS 29)</span>
            </div>
            <div className="pl-6 text-slate-500">↓</div>
            <div className="flex items-center gap-3 text-slate-300">
              <span className="px-2 py-0.5 rounded bg-purple-900 text-purple-300 font-bold text-[10px]">TIER 3</span>
              <span>Regulatory Rule Applied: <strong>RULE-HSN-8471-STD v3</strong> (CBIC Notif 14/2024-CT)</span>
            </div>
            <div className="pl-6 text-slate-500">↓</div>
            <div className="flex items-center gap-3 text-slate-300">
              <span className="px-2 py-0.5 rounded bg-amber-900 text-amber-300 font-bold text-[10px]">TIER 4</span>
              <span>Subledger Journal: <strong>Credit Liability Register (R85)</strong> under Major Head IGST (Entry #L8821)</span>
            </div>
            <div className="pl-6 text-slate-500">↓</div>
            <div className="flex items-center gap-3 text-slate-300">
              <span className="px-2 py-0.5 rounded bg-emerald-900 text-emerald-300 font-bold text-[10px]">TIER 5</span>
              <span>Rule 88A Set-off Engine: <strong>Set off against IGST Credit Balance</strong> (Zero cash payout required)</span>
            </div>
            <div className="pl-6 text-slate-500">↓</div>
            <div className="flex items-center gap-3 text-slate-300">
              <span className="px-2 py-0.5 rounded bg-rose-900 text-rose-300 font-bold text-[10px]">TIER 6</span>
              <span>GSTR-3B Table 6.1: <strong>Auto-aggregated into Row 1 (IGST Payment of Tax)</strong> - ARN: AA270926019283K</span>
            </div>
          </div>
        </div>
      )}

      {/* 8. 29 SCREEN SPECIFICATIONS */}
      {activeTab === 'SCREENS_29' && (
        <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/80 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers size={18} className="text-indigo-400" />
              Complete 29-Screen Inventory Specification
            </h3>
            <span className="text-xs text-slate-400 font-mono">Total Functional Views: 29</span>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-900 border-b border-slate-700 text-[11px] font-bold uppercase text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Screen / Module Name</th>
                  <th className="py-2.5 px-3">Functional Domain</th>
                  <th className="py-2.5 px-3">Route Path</th>
                  <th className="py-2.5 px-3">Primary Persona</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {screenInventory.map((s) => (
                  <tr key={s.num} className="hover:bg-slate-700/30">
                    <td className="py-2.5 px-3 font-mono text-slate-500">{s.num}</td>
                    <td className="py-2.5 px-3 font-bold text-white">{s.name}</td>
                    <td className="py-2.5 px-3 text-slate-300">{s.category}</td>
                    <td className="py-2.5 px-3 font-mono text-indigo-300">{s.route}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-300">
                        {s.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9. INFORMATION & ROLE ARCHITECTURE */}
      {activeTab === 'IA_NAV' && (
        <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/80 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <UserCheck size={18} className="text-blue-400" />
            Enterprise Role-Based Access Matrix & UI Scoping
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-2">
              <div className="font-bold text-indigo-400">Super Administrator</div>
              <p className="text-slate-400">Pan-India group level. Can provision entities, configure RBAC, override statutory rules, and deploy system updates.</p>
            </div>
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-2">
              <div className="font-bold text-blue-400">Tax Administrator / Head</div>
              <p className="text-slate-400">Company / multi-GSTIN level. Files returns, manages cash ledger deposits, approves high-value exceptions, and reviews audits.</p>
            </div>
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-2">
              <div className="font-bold text-emerald-400">Operations Accountant</div>
              <p className="text-slate-400">Branch / GSTIN restricted. Drafts sales invoices, registers inward bills, validates HSN, and triggers IRN generation.</p>
            </div>
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-2">
              <div className="font-bold text-amber-400">Finance Approver</div>
              <p className="text-slate-400">Signs off on invoices exceeding policy thresholds and validates high-value ITC claims before subledger posting.</p>
            </div>
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-2">
              <div className="font-bold text-purple-400">Statutory Auditor</div>
              <p className="text-slate-400">Read-only cryptographic access. Inspects immutable subledgers, rule versions, GSTR-3B ARN filings, and CBIC 72-mo archives.</p>
            </div>
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-2">
              <div className="font-bold text-slate-400">Business Viewer</div>
              <p className="text-slate-400">Restricted analytics access to Control Tower KPIs and filing status timelines without document drilldown.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
