/**
 * TaxFlow Enterprise React Router Configuration
 * 
 * Implements clean browser routing (replacing legacy hash-based routing).
 * Features RBAC guards, lazy-loading, and automatic hash-to-path redirection.
 */

import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { UserRole } from '../../types';
import Layout from '../../components/Layout';
import Login from '../../pages/Login';
import Dashboard from '../../pages/Dashboard';
import ErrorBoundary from '../../components/ErrorBoundary';
import { ShieldAlert, Loader2, ArrowLeft, UserCheck, Shield } from 'lucide-react';
import { switchRole } from '../../store/store';
import { useDispatch } from 'react-redux';

// Resilient dynamic module loader with automatic retry and stale bundle recovery
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (initialError) {
      console.warn('Dynamic module import initial attempt failed, retrying...', initialError);
      // Wait 350ms and try once more
      await new Promise((res) => setTimeout(res, 350));
      try {
        return await factory();
      } catch (retryError) {
        console.error('Dynamic module import retry failed, checking for stale bundle cache:', retryError);
        const lastReloadTs = Number(sessionStorage.getItem('chunk_reload_ts') || '0');
        const now = Date.now();
        // If not reloaded within the last 15 seconds, reload window to fetch latest assets
        if (now - lastReloadTs > 15000) {
          sessionStorage.setItem('chunk_reload_ts', String(now));
          window.location.reload();
          // Return a pending promise so React remains in fallback Suspense while reloading
          return new Promise<{ default: T }>(() => {});
        }
        throw retryError;
      }
    }
  });
}

// Lazy-loaded pages with automatic retry
const ControlTowerPage = lazyWithRetry(() => import('../../pages/ControlTowerPage'));
const Invoices = lazyWithRetry(() => import('../../pages/Invoices'));
const Reconciliation = lazyWithRetry(() => import('../../pages/Reconciliation'));
const ExceptionInboxPage = lazyWithRetry(() => import('../../pages/ExceptionInboxPage'));
const Computation = lazyWithRetry(() => import('../../pages/Computation'));
const Filing = lazyWithRetry(() => import('../../pages/Filing'));
const Organization = lazyWithRetry(() => import('../../pages/Organization'));
const PartyMasterPage = lazyWithRetry(() => import('../../pages/PartyMasterPage'));
const EInvoicePage = lazyWithRetry(() => import('../../pages/EInvoicePage'));
const EWayBillPage = lazyWithRetry(() => import('../../pages/EWayBillPage'));
const GstinVerificationPage = lazyWithRetry(() => import('../../pages/GstinVerificationPage'));
const DataQualityPage = lazyWithRetry(() => import('../../pages/DataQualityPage'));
const ApprovalsPage = lazyWithRetry(() => import('../../pages/ApprovalsPage'));
const Reports = lazyWithRetry(() => import('../../pages/Reports'));
const MonthlyTrendsDashboardPage = lazyWithRetry(() => import('../../pages/MonthlyTrendsDashboardPage'));
const RiskAnalysis = lazyWithRetry(() => import('../../pages/RiskAnalysis'));
const TaxForecastingPage = lazyWithRetry(() => import('../../pages/TaxForecastingPage'));
const Compliance = lazyWithRetry(() => import('../../pages/Compliance'));
const ComplianceArchivePage = lazyWithRetry(() => import('../../pages/ComplianceArchivePage'));
const RefundStatusDashboard = lazyWithRetry(() => import('../../pages/RefundStatusDashboard'));
const RegulatoryIntelligencePage = lazyWithRetry(() => import('../../pages/RegulatoryIntelligencePage'));
const Integrations = lazyWithRetry(() => import('../../pages/Integrations'));
const Settings = lazyWithRetry(() => import('../../pages/Settings'));
const AuditLogs = lazyWithRetry(() => import('../../pages/AuditLogs'));
const TransactionCompliancePage = lazyWithRetry(() => import('../../pages/TransactionCompliancePage'));
const GstRateCalculatorPage = lazyWithRetry(() => import('../../pages/GstRateCalculatorPage'));
const HsnSacLookupPage = lazyWithRetry(() => import('../../pages/HsnSacLookupPage'));

// Legacy Hash URL Redirector
const HashRedirector: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash) {
        let cleanPath = window.location.hash.replace(/^#\/?/, '/');
        if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
        window.history.replaceState(null, '', cleanPath);
        navigate(cleanPath, { replace: true });
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [navigate]);
  return null;
};

// Route RBAC configuration - Enterprise Role Workflow Matrix
const routePermissions: Record<string, UserRole[]> = {
  // Global visibility & Overview
  '/': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/dashboard': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/control-tower': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/architecture': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],

  // Transaction Operations & E-Way / E-Invoice
  '/invoices': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/einvoice': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/ewaybill': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],

  // Multi-tier Approval Hierarchy
  '/approvals': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR],

  // Compliance, Archive & Rule Engine
  '/compliance': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/compliance-archive': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/vault': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/transaction-compliance': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.VIEWER],
  '/rate-calculator': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/hsn-lookup': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/hsn-sac-lookup': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],

  // Reconciliation & Exceptions
  '/reconciliation': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR],
  '/compliance/exceptions': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR],
  '/exceptions': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR],

  // Tax Ledger, Computation & Statutory Filing (Restricted to Finance & Preparers)
  '/ledger': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT],
  '/computation': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT],
  '/statutory/gstr-1': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT],
  '/statutory/gstr-3b': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT],
  '/filing': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT],

  // Masters & Entity Governance
  '/organization': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER],
  '/parties': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/gstin-verification': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/data-quality': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],

  // Analytics, Risk & Governance
  '/reports': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/reports/monthly-trends': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/monthly-trends': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/risk-analysis': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.AUDITOR],
  '/tax-forecasting': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER],
  '/refunds': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/regulatory-intelligence': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],

  // System Administration & Security Logs
  '/integrations': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  '/settings': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  '/audit': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.AUDITOR],
};

interface UnauthorizedViewProps {
  currentPath: string;
  allowedRoles?: UserRole[];
}

const UnauthorizedView: React.FC<UnauthorizedViewProps> = ({ currentPath, allowedRoles = [] }) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const roleNameMap: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: 'Super Admin',
    [UserRole.ADMIN]: 'Enterprise Admin / CFO',
    [UserRole.FINANCE_MANAGER]: 'Finance Manager',
    [UserRole.ACCOUNTANT]: 'Senior Accountant',
    [UserRole.AUDITOR]: 'Tax Auditor',
    [UserRole.VIEWER]: 'Executive Viewer',
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 py-8">
      <div className="bg-white max-w-xl w-full p-8 rounded-2xl shadow-xl border border-rose-100 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />
        
        <div className="w-16 h-16 bg-rose-50 rounded-2xl border border-rose-200/60 flex items-center justify-center mx-auto mb-4 text-rose-600 shadow-inner">
          <ShieldAlert size={32} />
        </div>

        <span className="inline-block px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black uppercase tracking-wider rounded-full mb-3">
          RBAC Access Boundary
        </span>

        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Access Restricted</h2>
        
        <p className="text-slate-600 text-sm mt-2 leading-relaxed">
          Your current active persona <strong className="text-slate-900 font-bold">({user ? roleNameMap[user.role] || user.role : 'Guest'})</strong> does not have authorization to access <code className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono text-slate-800">{currentPath}</code> under the enterprise workflow policy.
        </p>

        {allowedRoles.length > 0 && (
          <div className="my-5 p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-left">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Authorized Roles For This Module:
            </span>
            <div className="flex flex-wrap gap-2">
              {allowedRoles.map(role => (
                <span key={role} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 shadow-xs">
                  <Shield size={12} className="text-indigo-600" />
                  {roleNameMap[role] || role}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <ArrowLeft size={14} />
            Return to Dashboard
          </button>
          
          {allowedRoles.length > 0 && (
            <button
              onClick={() => {
                const targetRole = allowedRoles[0];
                dispatch(switchRole(targetRole));
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <UserCheck size={14} />
              Switch to {roleNameMap[allowedRoles[0]] || allowedRoles[0]}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const PageLoader: React.FC = () => (
  <div className="flex h-[80vh] items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      <span className="text-sm font-medium text-slate-500">Loading module...</span>
    </div>
  </div>
);

interface ProtectedRouteProps {
  element: React.ReactElement;
  path: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ element, path }) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const allowedRoles = routePermissions[path];

  if (!user) {
    return <Login />;
  }

  if (allowedRoles && user.role && !allowedRoles.includes(user.role)) {
    return <UnauthorizedView currentPath={path} allowedRoles={allowedRoles} />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        {element}
      </Suspense>
    </ErrorBoundary>
  );
};

export const AppRouter: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) {
    return <Login />;
  }

  return (
    <>
      <HashRedirector />
      <Layout currentPath={location.pathname} onNavigate={(path) => navigate(path)}>
        <Routes>
          {/* Executive Dashboard */}
          <Route path="/" element={<ProtectedRoute path="/" element={<Dashboard />} />} />
          <Route path="/dashboard" element={<ProtectedRoute path="/dashboard" element={<Dashboard />} />} />

          {/* Core Control Tower & Architecture */}
          <Route path="/control-tower" element={<ProtectedRoute path="/control-tower" element={<ControlTowerPage />} />} />
          <Route path="/architecture" element={<ProtectedRoute path="/architecture" element={<ControlTowerPage />} />} />

          {/* Sales, Invoices & E-Way Bill */}
          <Route path="/invoices" element={<ProtectedRoute path="/invoices" element={<Invoices />} />} />
          <Route path="/einvoice" element={<ProtectedRoute path="/einvoice" element={<EInvoicePage />} />} />
          <Route path="/ewaybill" element={<ProtectedRoute path="/ewaybill" element={<EWayBillPage />} />} />
          <Route path="/approvals" element={<ProtectedRoute path="/approvals" element={<ApprovalsPage />} />} />

          {/* Compliance & Regulatory Center */}
          <Route path="/compliance" element={<ProtectedRoute path="/compliance" element={<Compliance />} />} />
          <Route path="/compliance-archive" element={<ProtectedRoute path="/compliance-archive" element={<ComplianceArchivePage />} />} />
          <Route path="/vault" element={<ProtectedRoute path="/vault" element={<ComplianceArchivePage />} />} />
          <Route path="/transaction-compliance" element={<ProtectedRoute path="/transaction-compliance" element={<TransactionCompliancePage />} />} />
          <Route path="/rate-calculator" element={<ProtectedRoute path="/rate-calculator" element={<GstRateCalculatorPage />} />} />
          <Route path="/hsn-lookup" element={<ProtectedRoute path="/hsn-lookup" element={<HsnSacLookupPage />} />} />
          <Route path="/hsn-sac-lookup" element={<ProtectedRoute path="/hsn-sac-lookup" element={<HsnSacLookupPage />} />} />

          {/* Reconciliation & Exceptions */}
          <Route path="/reconciliation" element={<ProtectedRoute path="/reconciliation" element={<Reconciliation />} />} />
          <Route path="/reconciliation/assistant" element={<Navigate to="/reconciliation?tab=assistant" replace />} />
          <Route path="/reconciliation/gstr-2a" element={<Navigate to="/reconciliation?tab=gstr2a" replace />} />
          <Route path="/reconciliation/gstr2a" element={<Navigate to="/reconciliation?tab=gstr2a" replace />} />
          <Route path="/compliance/exceptions" element={<ProtectedRoute path="/compliance/exceptions" element={<ExceptionInboxPage />} />} />
          <Route path="/exceptions" element={<ProtectedRoute path="/exceptions" element={<ExceptionInboxPage />} />} />

          {/* Tax Ledger & Returns */}
          <Route path="/ledger" element={<ProtectedRoute path="/ledger" element={<Computation />} />} />
          <Route path="/computation" element={<ProtectedRoute path="/computation" element={<Computation />} />} />
          <Route path="/filing" element={<ProtectedRoute path="/filing" element={<Filing />} />} />
          <Route path="/statutory/gstr-1" element={<ProtectedRoute path="/statutory/gstr-1" element={<Filing />} />} />
          <Route path="/statutory/gstr-3b" element={<ProtectedRoute path="/statutory/gstr-3b" element={<Filing />} />} />

          {/* Masters & Entity Management */}
          <Route path="/organization" element={<ProtectedRoute path="/organization" element={<Organization />} />} />
          <Route path="/parties" element={<ProtectedRoute path="/parties" element={<PartyMasterPage />} />} />
          <Route path="/gstin-verification" element={<ProtectedRoute path="/gstin-verification" element={<GstinVerificationPage />} />} />
          <Route path="/data-quality" element={<ProtectedRoute path="/data-quality" element={<DataQualityPage />} />} />

          {/* Analytics, Reports & Intelligence */}
          <Route path="/reports" element={<ProtectedRoute path="/reports" element={<Reports />} />} />
          <Route path="/reports/monthly-trends" element={<ProtectedRoute path="/reports/monthly-trends" element={<MonthlyTrendsDashboardPage />} />} />
          <Route path="/monthly-trends" element={<ProtectedRoute path="/monthly-trends" element={<MonthlyTrendsDashboardPage />} />} />
          <Route path="/risk-analysis" element={<ProtectedRoute path="/risk-analysis" element={<RiskAnalysis />} />} />
          <Route path="/tax-forecasting" element={<ProtectedRoute path="/tax-forecasting" element={<TaxForecastingPage />} />} />
          <Route path="/refunds" element={<ProtectedRoute path="/refunds" element={<RefundStatusDashboard />} />} />
          <Route path="/regulatory-intelligence" element={<ProtectedRoute path="/regulatory-intelligence" element={<RegulatoryIntelligencePage />} />} />

          {/* System & Audit */}
          <Route path="/integrations" element={<ProtectedRoute path="/integrations" element={<Integrations />} />} />
          <Route path="/settings" element={<ProtectedRoute path="/settings" element={<Settings />} />} />
          <Route path="/audit" element={<ProtectedRoute path="/audit" element={<AuditLogs />} />} />

          {/* Catch-all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </>
  );
};
