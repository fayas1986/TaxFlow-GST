import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  ShieldAlert, 
  KeyRound, 
  Database, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Play, 
  RefreshCw, 
  Layers, 
  Cpu, 
  BarChart3, 
  Lock, 
  Unlock, 
  HardDrive, 
  FileText, 
  Zap, 
  Users, 
  Check, 
  ChevronRight, 
  ExternalLink,
  Crown,
  Scale
} from 'lucide-react';
import { useTenantContext, MiddlewareTestSuiteSummary } from '../src/core/tenancy/TenantContext';
import { PLANS_CATALOG, Feature, PlanCode } from '../src/core/entitlements/types';
import { MultiTenantTestSuiteSummary } from '../src/core/tests/multiTenantIsolation.test';

export const MultiTenantSaaSCenterPage: React.FC = () => {
  const { 
    tenant, 
    tenantContext, 
    availableTenants, 
    subscription, 
    entitlements, 
    usage, 
    gstins, 
    branches, 
    switchTenant, 
    runIsolationTests, 
    testResults,
    runMiddlewareTests,
    middlewareTestResults
  } = useTenantContext();

  const [activeTab, setActiveTab] = useState<'overview' | 'entitlements' | 'usage' | 'security_tests' | 'audit_trail'>('overview');
  const [securitySubTab, setSecuritySubTab] = useState<'middleware' | 'isolation' | 'simulator'>('middleware');
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [localTestSummary, setLocalTestSummary] = useState<MultiTenantTestSuiteSummary | null>(testResults);
  const [localMiddlewareSummary, setLocalMiddlewareSummary] = useState<MiddlewareTestSuiteSummary | null>(middlewareTestResults);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Interactive Live Gateway Simulator state
  const [simUserId, setSimUserId] = useState<string>('u-fayas');
  const [simTargetTenant, setSimTargetTenant] = useState<string>('t1');
  const [simMode, setSimMode] = useState<'subdomain' | 'header'>('subdomain');
  const [simSubdomain, setSimSubdomain] = useState<string>('acme.taxflow.io');
  const [simResponse, setSimResponse] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  useEffect(() => {
    // Fetch tenant audit logs
    if (tenantContext?.tenantId) {
      fetch(`/api/v1/tenancy/audit-logs`, {
        headers: { 'x-tenant-id': tenantContext.tenantId }
      })
        .then(res => res.json())
        .then(data => {
          if (data.logs) setAuditLogs(data.logs);
        })
        .catch(err => console.error('Failed to load audit logs:', err));
    }
  }, [tenantContext?.tenantId]);

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const [isolationSummary, middlewareSummary] = await Promise.all([
        runIsolationTests(),
        runMiddlewareTests()
      ]);
      setLocalTestSummary(isolationSummary);
      setLocalMiddlewareSummary(middlewareSummary);
    } catch (e) {
      console.error('Test run failed:', e);
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleProbeGateway = async () => {
    setIsSimulating(true);
    setSimResponse(null);
    try {
      const headers: Record<string, string> = {
        'x-user-id': simUserId
      };

      if (simMode === 'header') {
        headers['x-tenant-id'] = simTargetTenant;
      } else {
        // Forwarded host simulates tenant routing e.g. acme.taxflow.io
        headers['x-forwarded-host'] = simSubdomain;
      }

      const res = await fetch('/api/v1/tenancy/verify-access', {
        headers
      });

      const data = await res.json();
      setSimResponse({
        status: res.status,
        ok: res.ok,
        data,
        timestamp: new Date().toLocaleTimeString(),
        attemptedTenant: simMode === 'header' ? simTargetTenant : simSubdomain,
        user: simUserId
      });
    } catch (err: any) {
      setSimResponse({
        status: 500,
        ok: false,
        error: err.message,
        timestamp: new Date().toLocaleTimeString()
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const currentPlan = subscription?.planId ? PLANS_CATALOG[subscription.planId] : null;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Multi-Tenant SaaS Architecture
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <ShieldCheck className="h-3 w-3 mr-1" /> Isolated & Enforced
                </span>
              </div>
              <p className="text-sm text-slate-500">
                Server-side tenant partitioning, RBAC gatekeeping, plan-wise entitlements, and cryptographic audit trails.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunTests}
            disabled={isRunningTests}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50"
          >
            {isRunningTests ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Running 20 Security Tests...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-white" />
                <span>Run Isolation Test Suite (20 Tests)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tenant Context Selector Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Active Tenant Boundary</span>
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-slate-900">{tenant?.legalName}</span>
              <span className="px-2 py-0.5 text-xs font-mono bg-slate-100 text-slate-700 rounded border border-slate-300">
                ID: {tenant?.id}
              </span>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200 flex items-center gap-1">
                <Crown className="h-3 w-3 text-amber-500" /> Plan: {subscription?.planId}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-1">
              <span>PAN: <strong className="text-slate-700 font-mono">{tenant?.pan}</strong></span>
              <span>•</span>
              <span>State: <strong className="text-slate-700">{tenant?.stateName} ({tenant?.stateCode})</strong></span>
              <span>•</span>
              <span>Status: <strong className="text-emerald-600 font-semibold">{tenant?.status}</strong></span>
              <span>•</span>
              <span>User Role: <strong className="text-slate-700">{tenantContext?.role}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Switch Tenant:</span>
            <select
              value={tenant?.id || 't1'}
              onChange={(e) => switchTenant(e.target.value)}
              className="bg-white border border-slate-300 rounded-md px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {availableTenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.legalName} ({t.id})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Architecture Overview', icon: Layers },
            { id: 'entitlements', label: 'Plan Entitlements Matrix', icon: Zap },
            { id: 'usage', label: 'Usage & Quotas', icon: BarChart3 },
            { id: 'security_tests', label: 'Security & Middleware Tests (32)', icon: ShieldCheck },
            { id: 'audit_trail', label: 'Tenant Audit Logs', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-1 border-b-2 font-medium text-sm inline-flex items-center gap-2 transition-colors ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tenant Partitioning & HOF</span>
              <Database className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">TenantScopedRepository & HOF</div>
            <p className="text-xs text-slate-600">
              All database queries and mutations automatically inject <code className="font-mono text-indigo-600 font-bold">where: {'{'} tenantId: ctx.tenantId {'}'}</code> via the base class and <code className="font-mono text-indigo-600 font-bold">withTenantScope</code> HOF. Tamper attempts trigger 403.
            </p>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>GSTINs Registered:</span>
              <strong className="text-slate-800">{gstins.length} GSTINs</strong>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Branches Registered:</span>
              <strong className="text-slate-800">{branches.length} Branches</strong>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Authorization Pipeline</span>
              <KeyRound className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">7-Stage Gatekeeper</div>
            <p className="text-xs text-slate-600">
              Enforces Auth → Membership → Role → Permission → Feature Entitlement → Quota Check → Data Mutation before any logic executes.
            </p>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Active Role:</span>
              <strong className="text-emerald-700">{tenantContext?.role || 'Tenant Admin'}</strong>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Permissions Assigned:</span>
              <strong className="text-slate-800">{tenantContext?.permissions?.length ?? 0} actions</strong>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Plan Entitlements</span>
              <Crown className="h-5 w-5 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{currentPlan?.name || 'Enterprise'}</div>
            <p className="text-xs text-slate-600">
              Feature flags are gated server-side. Attempts to bypass UI gating directly trigger HTTP 403 Forbidden with zero data disclosure.
            </p>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Monthly Invoices Limit:</span>
              <strong className="text-slate-800">
                {(currentPlan?.limits?.monthlyInvoiceVolume ?? currentPlan?.limits?.maxInvoicesPerMonth ?? 50000).toLocaleString()}
              </strong>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Active Features:</span>
              <strong className="text-slate-800">{entitlements?.length ?? 0} modules</strong>
            </div>
          </div>

          {/* Architecture Pipeline Map */}
          <div className="md:col-span-3 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              Tenant Request Authorization & Isolation Lifecycle
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 text-center">
              {[
                { step: '1', title: 'Session Auth', desc: 'Verify user token & identity' },
                { step: '2', title: 'Membership', desc: 'Ensure user belongs to tenant' },
                { step: '3', title: 'RBAC', desc: 'Validate active role & read-only flag' },
                { step: '4', title: 'Permission', desc: 'Check explicit capability grant' },
                { step: '5', title: 'Plan Feature', desc: 'Ensure module enabled in plan' },
                { step: '6', title: 'Quota Meter', desc: 'Check and increment usage' },
                { step: '7', title: 'Scoped Op', desc: 'Run with tenant-isolated DB repo' }
              ].map((s) => (
                <div key={s.step} className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex flex-col items-center">
                  <span className="h-6 w-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center mb-1.5">
                    {s.step}
                  </span>
                  <span className="font-bold text-xs text-slate-800">{s.title}</span>
                  <span className="text-[11px] text-slate-500 mt-1 leading-tight">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ENTITLEMENTS MATRIX */}
      {activeTab === 'entitlements' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Plan Feature Entitlements Matrix</h3>
              <p className="text-xs text-slate-500">
                Comparing feature gates between STARTER, BUSINESS, PROFESSIONAL, and ENTERPRISE tiers. Active tenant plan is highlighted.
              </p>
            </div>
            <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
              Current Plan: {subscription?.planId}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-xs border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Feature Module</th>
                  <th className="py-3 px-4 text-center">Starter (₹999/mo)</th>
                  <th className="py-3 px-4 text-center">Business (₹2,999/mo)</th>
                  <th className="py-3 px-4 text-center">Professional (₹7,999/mo)</th>
                  <th className="py-3 px-4 text-center bg-indigo-50/50 text-indigo-900">Enterprise (Custom)</th>
                  <th className="py-3 px-4 text-center">Active Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {[
                  { feature: Feature.INVOICES, name: 'Invoices & Sales Registers', starter: true, biz: true, pro: true, ent: true },
                  { feature: Feature.PURCHASES, name: 'Purchase Inward Bills', starter: true, biz: true, pro: true, ent: true },
                  { feature: Feature.GST_RETURNS, name: 'GST Statutory Returns (GSTR-1, 3B, 9)', starter: true, biz: true, pro: true, ent: true },
                  { feature: Feature.RECONCILIATION, name: 'ITC 2A/2B Automated Reconciliation', starter: false, biz: true, pro: true, ent: true },
                  { feature: Feature.ITC, name: 'Rule 36(4) / 42 / 43 Reversals Ledger', starter: false, biz: true, pro: true, ent: true },
                  { feature: Feature.E_INVOICE, name: 'E-Invoice IRN & QR Generation', starter: false, biz: false, pro: true, ent: true },
                  { feature: Feature.E_WAY_BILL, name: 'E-Way Bill Generation & Tracking', starter: false, biz: false, pro: true, ent: true },
                  { feature: Feature.AUTOMATION, name: 'Automated Filing & Background Recon', starter: false, biz: false, pro: true, ent: true },
                  { feature: Feature.MULTI_GSTIN, name: 'Multi-GSTIN Group Consolidation', starter: false, biz: false, pro: true, ent: true },
                  { feature: Feature.MULTI_BRANCH, name: 'Branch-Level Isolation & Filing', starter: false, biz: false, pro: true, ent: true },
                  { feature: Feature.AI, name: 'AI Discrepancy Classifier & Explainer', starter: false, biz: false, pro: false, ent: true },
                  { feature: Feature.ERP_INTEGRATION, name: 'Direct ERP Connectors (SAP, Oracle, Tally)', starter: false, biz: false, pro: false, ent: true },
                  { feature: Feature.API, name: 'Tenant-Scoped REST API Tokens', starter: false, biz: false, pro: false, ent: true },
                  { feature: Feature.ADVANCED_RBAC, name: 'Custom Branch RBAC & Role Restrictions', starter: false, biz: false, pro: false, ent: true },
                ].map((item) => {
                  const isEnabledInCurrentTenant = entitlements.includes(item.feature);
                  return (
                    <tr key={item.feature} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {item.name}
                        <div className="text-[10px] font-mono text-slate-400">{item.feature}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.starter ? <Check className="h-4 w-4 text-emerald-600 mx-auto" /> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.biz ? <Check className="h-4 w-4 text-emerald-600 mx-auto" /> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.pro ? <Check className="h-4 w-4 text-emerald-600 mx-auto" /> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center bg-indigo-50/50">
                        {item.ent ? <Check className="h-4 w-4 text-indigo-600 mx-auto font-bold" /> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isEnabledInCurrentTenant ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            ENABLED
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">
                            LOCKED
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: USAGE & QUOTAS */}
      {activeTab === 'usage' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Invoice Volume',
                consumed: usage?.invoicesCount ?? 0,
                max: currentPlan?.limits?.monthlyInvoiceVolume ?? currentPlan?.limits?.maxInvoicesPerMonth ?? 1000,
                unit: 'documents / month'
              },
              {
                title: 'E-Invoice Documents',
                consumed: usage?.eInvoicesCount ?? 0,
                max: currentPlan?.limits?.monthlyEinvoiceVolume ?? currentPlan?.limits?.maxEInvoicesPerMonth ?? 500,
                unit: 'IRNs / month'
              },
              {
                title: 'Reconciliation Records',
                consumed: usage?.reconciliationCount ?? 0,
                max: currentPlan?.limits?.monthlyReconciliationDocuments ?? currentPlan?.limits?.maxReconciliationDocsPerMonth ?? 2000,
                unit: 'records / month'
              },
              {
                title: 'AI Compliance Calls',
                consumed: usage?.aiRequestsCount ?? 0,
                max: currentPlan?.limits?.monthlyAiRequests ?? currentPlan?.limits?.maxAiCallsPerMonth ?? 100,
                unit: 'queries / month'
              },
              {
                title: 'API Requests',
                consumed: usage?.apiCallsCount ?? 0,
                max: currentPlan?.limits?.monthlyApiCalls ?? currentPlan?.limits?.maxApiCallsPerMonth ?? 10000,
                unit: 'calls / month'
              },
              {
                title: 'Storage Capacity',
                consumed: usage?.storageMb ?? 0,
                max: currentPlan?.limits?.storageMb ?? currentPlan?.limits?.maxStorageMb ?? 5000,
                unit: 'MB used'
              },
            ].map((metric) => {
              const safeMax = Math.max(1, metric.max || 1);
              const safeConsumed = metric.consumed || 0;
              const pct = Math.min(100, Math.round((safeConsumed / safeMax) * 100));
              const isHigh = pct >= 80;
              return (
                <div key={metric.title} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase">{metric.title}</span>
                    <span className={`text-xs font-bold ${isHigh ? 'text-amber-600' : 'text-slate-600'}`}>
                      {pct}% Used
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {safeConsumed.toLocaleString()} <span className="text-xs font-normal text-slate-500">/ {safeMax.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${isHigh ? 'bg-amber-500' : 'bg-indigo-600'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">{metric.unit}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: AUTOMATED SECURITY & MIDDLEWARE TESTS */}
      {activeTab === 'security_tests' && (
        <div className="space-y-4">
          {/* Sub-tab switcher */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSecuritySubTab('middleware')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                  securitySubTab === 'middleware'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Lock className="h-3.5 w-3.5" /> Server Tenant Auth Middleware (12 Tests)
              </button>
              <button
                onClick={() => setSecuritySubTab('isolation')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                  securitySubTab === 'isolation'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Database className="h-3.5 w-3.5" /> Repository & Partitioning Suite (20 Tests)
              </button>
              <button
                onClick={() => setSecuritySubTab('simulator')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                  securitySubTab === 'simulator'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Cpu className="h-3.5 w-3.5" /> Live Gateway Prober & 403 Tester
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRunTests}
                disabled={isRunningTests}
                className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                {isRunningTests ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-white" />}
                Run All Verification Suites
              </button>
            </div>
          </div>

          {/* SUB-TAB 1: SERVER MIDDLEWARE VERIFICATION */}
          {securitySubTab === 'middleware' && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-indigo-600" />
                    Server-Side Tenant Authentication & Subdomain Gatekeeper Suite
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Validates session resolution from bearer tokens and cookies, target tenant extraction from sub-domains (<code className="text-indigo-600">acme.taxflow.io</code>), strict 403 Forbidden denial for unauthorized cross-tenant attempts, and contextual request decoration.
                  </p>
                </div>
                {localMiddlewareSummary && (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {localMiddlewareSummary.passedCount} / {localMiddlewareSummary.totalCount} PASSED
                    </span>
                  </div>
                )}
              </div>

              {localMiddlewareSummary ? (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-200">
                  {localMiddlewareSummary.results.map((test) => {
                    const isPassed = test.status === 'PASSED';
                    return (
                      <div key={test.id} className="p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="pt-0.5">
                              {isPassed ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                              ) : (
                                <XCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900">
                                  #{test.id}. {test.name}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                                  {test.category}
                                </span>
                              </div>
                              <div className="mt-2 text-xs space-y-0.5 bg-slate-50 p-2.5 rounded border border-slate-200 font-mono">
                                <div className="text-slate-600"><strong>Expected:</strong> {test.expected}</div>
                                <div className="text-slate-800"><strong>Actual:</strong> {test.actual}</div>
                              </div>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                              {test.status}
                            </span>
                            <div className="text-[10px] text-slate-400 mt-1">{test.durationMs}ms</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white p-10 text-center rounded-xl border border-slate-200">
                  <Lock className="h-10 w-10 text-indigo-500 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-800">Middleware Test Suite Ready</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-3">
                    Click "Run All Verification Suites" to execute automated tests against the server-side tenant authentication middleware.
                  </p>
                  <button
                    onClick={handleRunTests}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                  >
                    Run Middleware Suite
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 2: DATA ISOLATION SUITE */}
          {securitySubTab === 'isolation' && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {localTestSummary?.totalTests ? `${localTestSummary.totalTests}-Point` : '25-Point'} Multi-Tenant Repository, HOF & Data Isolation Suite
                  </h3>
                  <p className="text-xs text-slate-500">
                    Automated end-to-end tests validating base repository where-injection, HOF client scoping, IDOR prevention, cache namespaces, branch segregation, read-only RBAC, and plan entitlements.
                  </p>
                </div>
                {localTestSummary && (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {localTestSummary.passedCount} / {localTestSummary.totalTests} PASSED
                    </span>
                  </div>
                )}
              </div>

              {localTestSummary ? (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-200">
                  {localTestSummary.results.map((test) => {
                    const isPassed = test.status === 'PASSED';
                    return (
                      <div key={test.id} className="p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="pt-0.5">
                              {isPassed ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                              ) : (
                                <XCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900">
                                  #{test.id}. {test.name}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                                  {test.category}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mt-1">{test.description}</p>
                              <div className="mt-2 text-xs space-y-0.5 bg-slate-50 p-2.5 rounded border border-slate-200 font-mono">
                                <div className="text-slate-600"><strong>Expected:</strong> {test.expected}</div>
                                <div className="text-slate-800"><strong>Actual:</strong> {test.actual}</div>
                              </div>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                              {test.status}
                            </span>
                            <div className="text-[10px] text-slate-400 mt-1">{test.executionTimeMs}ms</div>
                            <div className="text-[11px] font-semibold text-indigo-600 mt-1">{test.securityVerdict}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white p-10 text-center rounded-xl border border-slate-200">
                  <ShieldCheck className="h-10 w-10 text-indigo-500 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-800">Isolation Suite Ready</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-3">
                    Click "Run All Verification Suites" to execute 20 repository and isolation tests.
                  </p>
                  <button
                    onClick={handleRunTests}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                  >
                    Run 20 Security Tests
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 3: INTERACTIVE LIVE GATEWAY PROBER */}
          {securitySubTab === 'simulator' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-indigo-600" />
                  Live HTTP Middleware Gateway Tester & 403 Boundary Inspector
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Send real requests to <code className="text-indigo-600 font-bold">/api/v1/tenancy/verify-access</code>. The server-side middleware will resolve the user identity, parse the target tenant (via virtual subdomain host header or header), verify tenant membership, and respond with either 200 OK or 403 Forbidden.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">User Identity (Session / Header)</label>
                  <select
                    value={simUserId}
                    onChange={(e) => setSimUserId(e.target.value)}
                    className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="u-fayas">u-fayas (Member of Acme Corp t1 - SUPER_ADMIN)</option>
                    <option value="u-globex-user">u-globex-user (Member of Globex t2 - TENANT_ADMIN)</option>
                    <option value="u-logistics-mgr">u-logistics-mgr (Member of Logistics Hub t3)</option>
                    <option value="u-unauthorized-guest">u-unauthorized-guest (No tenant memberships - Hacker/Guest)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Tenant Resolution Method</label>
                  <select
                    value={simMode}
                    onChange={(e) => setSimMode(e.target.value as any)}
                    className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="subdomain">Virtual Sub-domain (Host: [sub].taxflow.io)</option>
                    <option value="header">Request Header (x-tenant-id)</option>
                  </select>
                </div>

                <div>
                  {simMode === 'subdomain' ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Target Sub-domain Host</label>
                      <select
                        value={simSubdomain}
                        onChange={(e) => setSimSubdomain(e.target.value)}
                        className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="acme.taxflow.io">acme.taxflow.io (t1 - Acme Corp)</option>
                        <option value="globex.taxflow.io">globex.taxflow.io (t2 - Globex Industries)</option>
                        <option value="logistics.taxflow.io">logistics.taxflow.io (t3 - Logistics Hub)</option>
                        <option value="defunct.taxflow.io">defunct.taxflow.io (t4 - Suspended Tenant)</option>
                        <option value="malicious.attacker.com">malicious.attacker.com (Unknown domain)</option>
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Target x-tenant-id Header</label>
                      <select
                        value={simTargetTenant}
                        onChange={(e) => setSimTargetTenant(e.target.value)}
                        className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="t1">t1 (Acme Corp)</option>
                        <option value="t2">t2 (Globex Industries)</option>
                        <option value="t3">t3 (Logistics Hub)</option>
                        <option value="t4">t4 (Suspended Tenant)</option>
                        <option value="t999_fake">t999_fake (Non-existent Tenant)</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  Expected outcome:
                  {simUserId === 'u-fayas' && (simMode === 'subdomain' ? simSubdomain.startsWith('acme') : simTargetTenant === 't1') ? (
                    <span className="text-emerald-700 font-bold ml-1">200 OK (Authorized membership in t1)</span>
                  ) : simUserId === 'u-globex-user' && (simMode === 'subdomain' ? simSubdomain.startsWith('globex') : simTargetTenant === 't2') ? (
                    <span className="text-emerald-700 font-bold ml-1">200 OK (Authorized membership in t2)</span>
                  ) : simUserId === 'u-logistics-mgr' && (simMode === 'subdomain' ? simSubdomain.startsWith('logistics') : simTargetTenant === 't3') ? (
                    <span className="text-emerald-700 font-bold ml-1">200 OK (Authorized membership in t3)</span>
                  ) : (
                    <span className="text-rose-700 font-bold ml-1">403 FORBIDDEN (Denied at middleware boundary)</span>
                  )}
                </div>

                <button
                  onClick={handleProbeGateway}
                  disabled={isSimulating}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {isSimulating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-white" />}
                  Probe Middleware Gateway
                </button>
              </div>

              {simResponse && (
                <div className={`p-4 rounded-xl border text-xs font-mono space-y-2 ${
                  simResponse.status === 200 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950' 
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}>
                  <div className="flex items-center justify-between font-sans">
                    <span className="font-bold flex items-center gap-1.5">
                      {simResponse.status === 200 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-600" />
                      )}
                      HTTP Response Status: <span className="font-mono text-sm px-1.5 py-0.5 rounded bg-white border">{simResponse.status}</span>
                      {simResponse.status === 403 && <span className="text-rose-700 font-bold ml-2">ACCESS DENIED (403 FORBIDDEN)</span>}
                      {simResponse.status === 200 && <span className="text-emerald-700 font-bold ml-2">ACCESS GRANTED (200 OK)</span>}
                    </span>
                    <span className="text-slate-500 text-[11px]">{simResponse.timestamp}</span>
                  </div>

                  <div className="bg-white/80 p-3 rounded border border-slate-200/80 overflow-x-auto">
                    <pre className="text-[11px] leading-relaxed">
                      {JSON.stringify(simResponse.data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: AUDIT LOGS */}
      {activeTab === 'audit_trail' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Tenant-Scoped Immutable Audit Trail</h3>
              <p className="text-xs text-slate-500">
                Cryptographically hashed audit log for tenant: <span className="font-mono font-bold text-indigo-600">{tenant?.id}</span>. Filtered strictly to current tenant.
              </p>
            </div>
            <span className="text-xs font-medium text-slate-500">
              {auditLogs.length} audit entries
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Module</th>
                  <th className="py-2.5 px-4">User</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Hash Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 text-slate-500 font-mono">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-800">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {log.module}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">
                      {log.userEmail}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[10px] text-slate-400 truncate max-w-xs">
                      {log.recordHash ? `sha256:${log.recordHash.substring(0, 16)}...` : 'genesis'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiTenantSaaSCenterPage;
