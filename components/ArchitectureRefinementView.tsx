import React, { useState } from 'react';
import { 
  ShieldCheck, Server, Database, Layers, CheckCircle2, AlertTriangle, 
  GitBranch, ArrowRight, Lock, Cpu, Clock, RefreshCw, FileText, 
  Check, ExternalLink, Filter, Sparkles, Terminal, Code, ChevronRight
} from 'lucide-react';

export const ArchitectureRefinementView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'AUDIT' | 'CONTEXTS' | 'TAX_ENGINE' | 'LEDGER' | 'INTEGRATIONS' | 'ADRS'>('AUDIT');

  const auditMatrix = [
    { file: 'server.ts (4.8k lines)', role: 'Prototype Express monolith with mock DB & routes', status: 'REPLACE', target: 'Decompose into NestJS Feature Modules (@taxflow/api) with Prisma & RLS' },
    { file: 'patch_*.cjs / fix_*.cjs (35 files)', role: 'Ad-hoc patch scripts in workspace root', status: 'REMOVE', target: 'Purge from repository; replace with Jest/Vitest CI suites' },
    { file: 'services/gstEngine/taxCalculator.ts', role: 'GST rate & tax head calculator', status: 'REFACTOR', target: 'Port to pure headless TypeScript package @taxflow/tax-engine' },
    { file: 'services/gstEngine/ruleEngine.ts', role: 'Statutory threshold & rule logic', status: 'REFACTOR', target: 'Migrate to @taxflow/regulatory-engine with temporal database rules' },
    { file: 'services/gstEngine/reconciliationEngine.ts', role: '2B vs PR 3-way reconciliation', status: 'REFACTOR', target: 'Execute asynchronously via Redis / BullMQ worker (@taxflow/jobs)' },
    { file: 'services/gstEngine/itcTaggingService.ts', role: 'Rule 37/37A, 42/43 & 17(5) blocking', status: 'REFACTOR', target: 'Server-side subledger pipeline upon purchase invoice post' },
    { file: 'services/gstEngine/filingEngine.ts', role: 'GSTR-1 / 3B payload compiler', status: 'REFACTOR', target: 'Aggregate exclusively from Authoritative Tax Ledger' },
    { file: 'services/gstAuthService.ts', role: 'Simulated auth & tenant switching', status: 'REPLACE', target: 'NextAuth/Supabase + NestJS JWT Guard & PostgreSQL RLS' },
    { file: 'utils/localDb.ts', role: 'Dexie / localStorage persistence', status: 'REPLACE', target: 'Neon PostgreSQL with Prisma Connection Pooling' },
    { file: 'components/ComplianceArchiveTimelineView.tsx', role: 'Statutory 72-mo snapshot timeline', status: 'KEEP', target: 'Next.js App Router Page/Component' },
    { file: 'components/ElectronicLedgerViewer.tsx', role: 'Cash, Credit & Liability ledger UI', status: 'KEEP', target: 'Primary UI consumer of /api/v1/ledger' },
    { file: 'utils/eInvoiceQrUtils.ts', role: 'CBIC B2B QR Code & JWT signature parser', status: 'KEEP', target: 'Move to shared package @taxflow/common' }
  ];

  const boundedContexts = [
    { name: '1. Identity & Auth', scope: 'Credentials, MFA, Session tokens, GSP tokens' },
    { name: '2. Tenant Management', scope: 'Multi-org entity hierarchy, Branches, Tax IDs' },
    { name: '3. RBAC & Access Control', scope: 'Granular permissions, GSTIN/Branch level security' },
    { name: '4. GST Registration', scope: 'Jurisdictional master, Signatory authority' },
    { name: '5. GST Masters', scope: 'HSN/SAC directory, UOM, Party Master KYC' },
    { name: '6. Regulatory Rules', scope: 'Versioned tax slabs, Exemption rules, Circulars' },
    { name: '7. Deterministic Tax Engine', scope: 'Pure calculations: CGST, SGST, IGST, Cess' },
    { name: '8. POS (Place of Supply)', scope: 'Sections 10-13 IGST Act determination' },
    { name: '9. Sales / Invoices', scope: 'Outward supplies: B2B, B2C, SEZ, Exports, CDN' },
    { name: '10. Purchase Register', scope: 'Inward bills, Bill-of-Entry, Vendor claims' },
    { name: '11. ITC Management', scope: '17(5) blocking, Rule 42/43 split, 180-day 37/37A' },
    { name: '12. Reverse Charge (RCM)', scope: 'Sec 9(3)/9(4) notifications, Self-invoicing' },
    { name: '13. Authoritative Tax Ledger', scope: 'Double-entry Cash, Credit, Liability journals' },
    { name: '14. Reconciliation Engine', scope: '3-way auto-matching: PR vs GSTR-2B vs EWB' },
    { name: '15. Statutory Returns', scope: 'GSTR-1, GSTR-3B, GSTR-9 compiled from Ledger' },
    { name: '16. IRP & E-Invoice', scope: 'NIC payload formatting, IRN generation, QR' },
    { name: '17. E-Way Bill', scope: 'Part-A/Part-B dispatch, Vehicle tracking' },
    { name: '18. ERP Integrations', scope: 'Adapters for SAP, Oracle, Zoho, Tally, Xero' },
    { name: '19. Audit, Alerts & Reports', scope: 'Immutable audit trail, WhatsApp/Email, Exports' }
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/80 shadow-xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold font-mono">
              <ShieldCheck size={14} className="text-emerald-400" />
              STATUS: ARCHITECTURE REFINEMENT & REVIEW PHASE
            </div>
            <h2 className="text-xl lg:text-2xl font-black text-white tracking-tight">
              Enterprise GST Architecture Refinement Blueprint
            </h2>
            <p className="text-xs lg:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Target Blueprint: Next.js 15 + NestJS on Vercel Node runtime + Neon PostgreSQL with Row-Level Security (RLS), 
              Prisma ORM, and Managed Asynchronous Task Queues.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-indigo-300 font-bold">
              Doc: /docs/ARCHITECTURE_REFINEMENT.md
            </span>
          </div>
        </div>

        {/* Sub-Navigation */}
        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-700/60 mt-6 overflow-x-auto gap-1">
          {[
            { id: 'AUDIT', label: '1. Repository Audit Matrix' },
            { id: 'CONTEXTS', label: '2. 19 Bounded Contexts' },
            { id: 'TAX_ENGINE', label: '3. Tax Engine Pipeline' },
            { id: 'LEDGER', label: '4. Authoritative Tax Ledger' },
            { id: 'INTEGRATIONS', label: '5. Provider Adapters' },
            { id: 'ADRS', label: '6. Architecture Decision Records' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                activeSection === tab.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION: AUDIT MATRIX */}
      {activeSection === 'AUDIT' && (
        <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/80 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Code size={16} className="text-blue-400" />
              Existing Repository Audit & Classification Matrix
            </h3>
            <span className="text-xs text-slate-400 font-mono">Total Monitored Artifacts: 48+</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/40 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Artifact / Path</th>
                  <th className="py-3 px-4">Current Role & Dependencies</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4">Target Architecture Destination</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-xs">
                {auditMatrix.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-200">{item.file}</td>
                    <td className="py-3 px-4 text-slate-400">{item.role}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        item.status === 'KEEP' 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                          : item.status === 'REFACTOR'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : item.status === 'REPLACE'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{item.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION: BOUNDED CONTEXTS */}
      {activeSection === 'CONTEXTS' && (
        <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/80 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Layers size={16} className="text-indigo-400" />
            19 Strictly Bounded Contexts (Zero Monolithic Business Coupling)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {boundedContexts.map((ctx, idx) => (
              <div key={idx} className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/60 space-y-2">
                <div className="text-xs font-bold text-blue-300">{ctx.name}</div>
                <div className="text-xs text-slate-400 leading-relaxed">{ctx.scope}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION: TAX ENGINE */}
      {activeSection === 'TAX_ENGINE' && (
        <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/80 shadow-xl space-y-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Cpu size={16} className="text-emerald-400" />
            Deterministic Tax Engine Pipeline (Zero Client-Side Calculation)
          </h3>
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700/70 text-xs font-mono text-slate-300 space-y-3">
            <div className="text-emerald-400 font-bold">Input Payload (Lines, POS, Supplier & Recipient Profiles, Transaction Date)</div>
            <div className="pl-4 border-l-2 border-slate-700 space-y-2">
              <div>➔ 1. Validation: GSTIN syntax, non-negative amounts, HSN/SAC format</div>
              <div>➔ 2. Taxability Check: Taxable, Nil-Rated, Exempted, Non-GST, Zero-Rated</div>
              <div>➔ 3. Place of Supply (POS): Sections 10-13 IGST Act determination</div>
              <div>➔ 4. Rule Resolution: Query rule active on transactionDate with conditions</div>
              <div>➔ 5. Rate & Tax Head: Intra-State (CGST+SGST) vs Inter-State (IGST)</div>
              <div>➔ 6. Cess: Compute Ad-Valorem and/or Specific Volumetric Cess</div>
              <div>➔ 7. RCM Applicability: Section 9(3)/9(4) recipient liability flag</div>
              <div>➔ 8. Precision & Rounding: Banker's Half-Up + Section 170 CGST rounding</div>
              <div>➔ 9. Immutable Tax Result: Returns complete tax breakdown with Rule ID & Version</div>
            </div>
            <div className="text-blue-400 font-bold">➔ 10. Direct Double-Entry Post to Authoritative Tax Ledger</div>
          </div>
        </div>
      )}

      {/* SECTION: LEDGER */}
      {activeSection === 'LEDGER' && (
        <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/80 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Lock size={16} className="text-amber-400" />
            Authoritative Tax Ledger: Single Source of Truth
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Neither GSTR-1, GSTR-3B, nor reporting modules recalculate tax. Invoices and purchase bills write directly to the append-only Tax Ledger. 
            All statutory returns simply query pre-aggregated views of this ledger.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-2">
              <div className="font-bold text-emerald-400">Electronic Cash Ledger (R87)</div>
              <p className="text-slate-400">Maintains cash deposits under Major & Minor heads (Tax, Interest, Penalty, Fee). Credited via PMT-06 challans.</p>
            </div>
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-2">
              <div className="font-bold text-blue-400">Electronic Credit Ledger (R86)</div>
              <p className="text-slate-400">Captures eligible ITC, blocked ITC u/s 17(5), and Rule 42/43 reversals. Updated upon inward bill approval.</p>
            </div>
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-2">
              <div className="font-bold text-rose-400">Electronic Liability Register (R85)</div>
              <p className="text-slate-400">Records outward tax, RCM liability, and late fees. Set off using Rule 88A priority sequence.</p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: INTEGRATIONS */}
      {activeSection === 'INTEGRATIONS' && (
        <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/80 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <GitBranch size={16} className="text-purple-400" />
            Resilient Provider Adapters & Gateway Architecture
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-2">
              <div className="font-bold text-slate-200">Typed Adapter Interfaces</div>
              <ul className="list-disc pl-4 text-slate-400 space-y-1">
                <li><code>IRPProvider</code> (NIC E-Invoice, Cleartax, Cygnet)</li>
                <li><code>EwayBillProvider</code> (NIC EWB, Transporter APIs)</li>
                <li><code>GSPProvider</code> (GSTN Public APIs via certified GSPs)</li>
                <li><code>ERPProvider</code> (SAP, Oracle, Zoho Books, Tally Prime)</li>
              </ul>
            </div>
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-2">
              <div className="font-bold text-slate-200">Mandatory Execution Wrapper</div>
              <ul className="list-disc pl-4 text-slate-400 space-y-1">
                <li>Unique Correlation ID across distributed logs</li>
                <li>SHA-256 payload idempotency key preventing duplicate filings</li>
                <li>Exponential backoff (1s, 2s, 4s) with jitter on network drops</li>
                <li>Encrypted request & response audit logging</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: ADRS */}
      {activeSection === 'ADRS' && (
        <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/80 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <FileText size={16} className="text-amber-400" />
            Architecture Decision Records (ADRs)
          </h3>
          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-300">ADR-001: Next.js + NestJS Decoupled Stack</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">APPROVED</span>
              </div>
              <p className="text-slate-400">Replaces Express prototype with Next.js frontend on Vercel and NestJS API services on Vercel Node runtime.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-300">ADR-002: PostgreSQL (Neon) with Row-Level Security (RLS) & Prisma</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">APPROVED</span>
              </div>
              <p className="text-slate-400">Enforces tenant isolation at database kernel level via RLS policies; eliminates cross-tenant data leakage risks.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-300">ADR-003: Authoritative Tax Ledger for Return Filings</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">APPROVED</span>
              </div>
              <p className="text-slate-400">GSTR-1, GSTR-3B, and GSTR-9 aggregate from Tax Ledger; returns never recalculate tax independently.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-300">ADR-004: Managed Background Worker Queues</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">APPROVED</span>
              </div>
              <p className="text-slate-400">GSTR-2B ingestion, bulk invoice imports, and reconciliations run via Redis/BullMQ to prevent HTTP timeout issues.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
