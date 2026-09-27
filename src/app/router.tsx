/**
 * TaxFlow Enterprise React Router Configuration
 * 
 * Implements clean browser routing (replacing legacy hash-based routing).
 * Features RBAC guards, lazy-loading, and automatic hash-to-path redirection.
 */

import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, switchRole } from '../../store/store';
import { UserRole } from '../../types';
import Layout from '../../components/Layout';
import Login from '../../pages/Login';
import Dashboard from '../../pages/Dashboard';
import ErrorBoundary from '../../components/ErrorBoundary';
import { ShieldAlert, Loader2, ArrowLeft, UserCheck, Shield, Sparkles, Lock, ArrowUpRight } from 'lucide-react';
import { entitlementService } from '../core/entitlements/entitlementService';
import { Feature, PlanCode } from '../core/entitlements/types';
import { subscriptionManager, AccessLevel } from '../core/billing/SubscriptionManager';

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
const RecurringInvoicesPage = lazyWithRetry(() => import('../../pages/RecurringInvoicesPage'));
const MultiTenantSaaSCenterPage = lazyWithRetry(() => import('../../pages/MultiTenantSaaSCenterPage'));
const SuperAdminDashboardPage = lazyWithRetry(() => import('../../pages/SuperAdminDashboardPage'));
const PlanUsagePage = lazyWithRetry(() => import('../../pages/PlanUsagePage'));

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
  '/': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER, UserRole.CUSTOMER],
  '/dashboard': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER, UserRole.CUSTOMER],
  '/control-tower': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/architecture': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],

  // Transaction Operations & E-Way / E-Invoice
  '/invoices': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER, UserRole.CUSTOMER],
  '/recurring-invoices': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER, UserRole.CUSTOMER],
  '/recurring': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER, UserRole.CUSTOMER],
  '/einvoice': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/ewaybill': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],

  // Multi-tier Approval Hierarchy
  '/approvals': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR],

  // Compliance, Archive & Rule Engine
  '/compliance': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/compliance-archive': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/vault': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER, UserRole.CUSTOMER],
  '/transaction-compliance': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.VIEWER],
  '/rate-calculator': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER, UserRole.CUSTOMER],
  '/smart-classifier': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/tax-classifier': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/hsn-lookup': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER, UserRole.CUSTOMER],
  '/hsn-sac-lookup': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER, UserRole.CUSTOMER],

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
  '/reports': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER, UserRole.CUSTOMER],
  '/reports/monthly-trends': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/monthly-trends': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/risk-analysis': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.AUDITOR],
  '/tax-forecasting': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER],
  '/refunds': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/regulatory-intelligence': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],

  // System Administration & Security Logs (Strictly Super Admin Only)
  '/super-admin': [UserRole.SUPER_ADMIN],
  '/admin/dashboard': [UserRole.SUPER_ADMIN],
  '/integrations': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  '/settings': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER, UserRole.CUSTOMER],
  '/audit': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.AUDITOR],
  '/tenancy': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/multi-tenant': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/plan-usage': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
  '/usage': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.VIEWER],
};

// Route Plan Entitlement Mapping - Features bound to commercial customer subscription plans
const routeRequiredFeatures: Record<string, Feature> = {
  '/einvoice': Feature.E_INVOICE,
  '/ewaybill': Feature.E_WAY_BILL,
  '/reconciliation': Feature.RECONCILIATION,
  '/exceptions': Feature.RECONCILIATION,
  '/compliance/exceptions': Feature.RECONCILIATION,
  '/transaction-compliance': Feature.ITC,
  '/compliance-archive': Feature.AUTOMATION,
  '/approvals': Feature.ADVANCED_RBAC,
  '/vault': Feature.ADVANCED_RBAC,
  '/refunds': Feature.AUTOMATION,
  '/regulatory-intelligence': Feature.AI,
  '/computation': Feature.GST_RETURNS,
  '/statutory/gstr-1': Feature.GST_RETURNS,
  '/statutory/gstr-3b': Feature.GST_RETURNS,
  '/filing': Feature.GST_RETURNS,
  '/risk-analysis': Feature.AI,
  '/tax-forecasting': Feature.AI,
  '/integrations': Feature.ERP_INTEGRATION,
  '/data-quality': Feature.ADVANCED_RBAC,
  '/tenancy': Feature.ADVANCED_RBAC,
  '/multi-tenant': Feature.ADVANCED_RBAC,
};

const featureDisplayNames: Record<Feature, { title: string; minPlan: string; desc: string }> = {
  [Feature.INVOICES]: { title: 'Invoice & Sales Ledger', minPlan: 'Starter SME', desc: 'Core billing and outward tax registers' },
  [Feature.PURCHASES]: { title: 'Purchase & Expense Ledger', minPlan: 'Starter SME', desc: 'Inward supplies and inward invoice booking' },
  [Feature.GST_RETURNS]: { title: 'Statutory GST Returns (GSTR-1 & 3B)', minPlan: 'Starter SME', desc: 'Direct portal computation and filing workflows' },
  [Feature.E_WAY_BILL]: { title: 'E-Way Bill Generation & Tracking', minPlan: 'Business Growth', desc: 'Automated Part-A and Part-B consignment logistics dispatch' },
  [Feature.RECONCILIATION]: { title: 'Automated 2B Matching Engine', minPlan: 'Business Growth', desc: 'Real-time multi-criteria purchase invoice matching and anomaly triage' },
  [Feature.ITC]: { title: 'Input Tax Credit Optimization', minPlan: 'Business Growth', desc: 'Rule 37A tracking and 17(5) blocked credit determination' },
  [Feature.MULTI_BRANCH]: { title: 'Multi-Branch Hierarchy', minPlan: 'Business Growth', desc: 'Branch-level cost centers, unit tagging and localized dispatch' },
  [Feature.E_INVOICE]: { title: 'IRP E-Invoicing & QR Codes', minPlan: 'Professional Compliance', desc: 'Direct real-time government e-invoicing transmission and QR verification' },
  [Feature.AUTOMATION]: { title: 'Compliance Rule Automation', minPlan: 'Professional Compliance', desc: 'Smart webhook dispatch, automated filing reminders and notifications' },
  [Feature.MULTI_GSTIN]: { title: 'Multi-State GSTIN Consolidation', minPlan: 'Professional Compliance', desc: 'Unified pan-India multi-registration dashboard and state reporting' },
  [Feature.ADVANCED_RBAC]: { title: 'Granular RBAC & Multi-Tenancy', minPlan: 'Professional Compliance', desc: 'Departmental privilege matrices and custom access policies' },
  [Feature.AUDIT_LOGS]: { title: 'Statutory Audit Logs', minPlan: 'Business Growth', desc: 'Immutable chronological audit tracking and tamper-evident compliance history' },
  [Feature.CLOUD_BACKUPS]: { title: 'Automated Cloud Backups', minPlan: 'Professional Compliance', desc: 'Immutable 24-hour cloud snapshot protection and disaster recovery' },
  [Feature.WHATSAPP_ALERTS]: { title: 'WhatsApp Compliance Alerts', minPlan: 'Professional Compliance', desc: 'Direct WhatsApp customer alerts, filing notifications and ledger dispatch' },
  [Feature.DATABASE_SYNC]: { title: 'Dedicated Neon Postgres Tenancy', minPlan: 'Enterprise Multi-Entity', desc: 'Dedicated cloud PostgreSQL dual-write and external replica pipelines' },
  [Feature.AI]: { title: 'AI Copilot & Predictive Risk Analysis', minPlan: 'Enterprise Multi-Entity', desc: 'Generative anomaly diagnosis, tax liability forecasting and smart audit simulation' },
  [Feature.ERP_INTEGRATION]: { title: 'Direct Enterprise ERP Connectors', minPlan: 'Enterprise Multi-Entity', desc: 'Bi-directional sync with SAP S/4HANA, Oracle ERP, Tally Prime and Zoho' },
  [Feature.API]: { title: 'Developer REST APIs & Webhooks', minPlan: 'Enterprise Multi-Entity', desc: 'Programmatic high-throughput ledger ingestion and automated reconciliation' },
  [Feature.WEBHOOKS]: { title: 'Real-Time Event Webhooks', minPlan: 'Enterprise Multi-Entity', desc: 'Low-latency statutory event streaming and webhook triggers' },
};

interface PlanUpgradeRequiredViewProps {
  currentPath: string;
  requiredFeature: Feature;
  tenantPlanCode: PlanCode;
}

const PlanUpgradeRequiredView: React.FC<PlanUpgradeRequiredViewProps> = ({
  currentPath,
  requiredFeature,
  tenantPlanCode,
}) => {
  const navigate = useNavigate();
  const featureInfo = featureDisplayNames[requiredFeature] || {
    title: requiredFeature,
    minPlan: 'Higher Subscription Tier',
    desc: 'This premium capability is part of advanced subscription packages.'
  };

  const planNameMap: Record<PlanCode, string> = {
    [PlanCode.STARTER]: 'Starter SME Plan',
    [PlanCode.BUSINESS]: 'Business Growth Plan',
    [PlanCode.PROFESSIONAL]: 'Professional Compliance Plan',
    [PlanCode.ENTERPRISE]: 'Enterprise Multi-Entity Plan',
    [PlanCode.ENTERPRISE_PLUS]: 'Enterprise Plus Dedicated Plan',
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 py-8">
      <div className="bg-white max-w-xl w-full p-8 rounded-2xl shadow-xl border border-indigo-100 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />
        
        <div className="w-16 h-16 bg-indigo-50 rounded-2xl border border-indigo-200/80 flex items-center justify-center mx-auto mb-4 text-indigo-600 shadow-inner">
          <Lock size={30} />
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black uppercase tracking-wider rounded-full mb-3">
          <Sparkles size={12} className="text-indigo-600" />
          Plan Entitlement Gate
        </span>

        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          {featureInfo.title}
        </h2>
        
        <p className="text-slate-600 text-sm mt-2 leading-relaxed">
          This module is not included in your organization's current plan (<strong className="text-slate-900 font-bold">{planNameMap[tenantPlanCode] || tenantPlanCode}</strong>). 
        </p>

        <div className="my-5 p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-left">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-100/80 text-indigo-700 rounded-lg shrink-0 mt-0.5">
              <Sparkles size={16} />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">
                Required Tier: {featureInfo.minPlan}
              </span>
              <p className="text-xs text-slate-500 mt-1 leading-normal">
                {featureInfo.desc}
              </p>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <ArrowLeft size={14} />
            Return to Dashboard
          </button>
          
          <button
            onClick={() => navigate('/settings')}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <ArrowUpRight size={14} />
            View Subscription Details
          </button>
        </div>
      </div>
    </div>
  );
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
    [UserRole.CUSTOMER]: 'Client / Customer',
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
          
          {allowedRoles.length > 0 && user?.role !== UserRole.SUPER_ADMIN && (
            <button
              onClick={() => {
                const targetRole = allowedRoles.find(r => r !== UserRole.SUPER_ADMIN) || allowedRoles[0];
                dispatch(switchRole(targetRole));
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <UserCheck size={14} />
              Switch to {roleNameMap[allowedRoles.find(r => r !== UserRole.SUPER_ADMIN) || allowedRoles[0]]}
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
  const requiredFeature = routeRequiredFeatures[path];

  if (!user) {
    return <Login />;
  }

  // Super Admin has global platform bypass and universal privileges
  if (user.role === UserRole.SUPER_ADMIN) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          {element}
        </Suspense>
      </ErrorBoundary>
    );
  }

  // RBAC Role Check for Customer Roles
  if (allowedRoles && user.role && !allowedRoles.includes(user.role)) {
    return <UnauthorizedView currentPath={path} allowedRoles={allowedRoles} />;
  }

  // Plan Entitlement Check with SubscriptionManager
  if (user.currentTenantId) {
    const accessCheck = subscriptionManager.checkModuleAccess(
      user.role,
      user.currentTenantId,
      requiredFeature,
      allowedRoles
    );

    if (!accessCheck.granted && accessCheck.isUpgradeRequired && requiredFeature) {
      const currentSub = entitlementService.getSubscription(user.currentTenantId);
      const planCode = currentSub?.planId || PlanCode.STARTER;
      return (
        <PlanUpgradeRequiredView 
          currentPath={path} 
          requiredFeature={requiredFeature} 
          tenantPlanCode={planCode} 
        />
      );
    }
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
    return (
      <Login 
        onLoginSuccess={(role) => {
          if (role === UserRole.SUPER_ADMIN) {
            navigate('/super-admin');
          } else {
            navigate('/');
          }
        }} 
      />
    );
  }

  return (
    <>
      <HashRedirector />
      <Layout currentPath={location.pathname} onNavigate={(path) => navigate(path)}>
        <Routes>
          {/* Executive Dashboard */}
          <Route path="/" element={<ProtectedRoute path="/" element={<Dashboard />} />} />
          <Route path="/dashboard" element={<ProtectedRoute path="/dashboard" element={<Dashboard />} />} />

          {/* Core Navigation Redirects */}
          <Route path="/control-tower" element={<Navigate to="/" replace />} />
          <Route path="/architecture" element={<Navigate to="/" replace />} />

          {/* Sales, Invoices & E-Way Bill */}
          <Route path="/invoices" element={<ProtectedRoute path="/invoices" element={<Invoices />} />} />
          <Route path="/recurring-invoices" element={<ProtectedRoute path="/recurring-invoices" element={<RecurringInvoicesPage />} />} />
          <Route path="/recurring" element={<Navigate to="/recurring-invoices" replace />} />
          <Route path="/einvoice" element={<ProtectedRoute path="/einvoice" element={<EInvoicePage />} />} />
          <Route path="/ewaybill" element={<ProtectedRoute path="/ewaybill" element={<EWayBillPage />} />} />
          <Route path="/approvals" element={<ProtectedRoute path="/approvals" element={<ApprovalsPage />} />} />

          {/* Compliance & Regulatory Center */}
          <Route path="/compliance" element={<ProtectedRoute path="/compliance" element={<Compliance />} />} />
          <Route path="/compliance-archive" element={<ProtectedRoute path="/compliance-archive" element={<ComplianceArchivePage />} />} />
          <Route path="/vault" element={<ProtectedRoute path="/vault" element={<ComplianceArchivePage />} />} />
          <Route path="/transaction-compliance" element={<ProtectedRoute path="/transaction-compliance" element={<TransactionCompliancePage />} />} />
          <Route path="/rate-calculator" element={<ProtectedRoute path="/rate-calculator" element={<GstRateCalculatorPage />} />} />
          <Route path="/smart-classifier" element={<ProtectedRoute path="/smart-classifier" element={<GstRateCalculatorPage />} />} />
          <Route path="/tax-classifier" element={<ProtectedRoute path="/tax-classifier" element={<GstRateCalculatorPage />} />} />
          <Route path="/hsn-lookup" element={<ProtectedRoute path="/hsn-lookup" element={<HsnSacLookupPage />} />} />
          <Route path="/hsn-sac-lookup" element={<ProtectedRoute path="/hsn-sac-lookup" element={<HsnSacLookupPage />} />} />

          {/* Reconciliation & Exceptions */}
          <Route path="/reconciliation" element={<ProtectedRoute path="/reconciliation" element={<Reconciliation />} />} />
          <Route path="/branch-reconciliation" element={<Navigate to="/reconciliation?tab=branch" replace />} />
          <Route path="/reconciliation/branch" element={<Navigate to="/reconciliation?tab=branch" replace />} />
          <Route path="/reconciliation/branch-reconciliation" element={<Navigate to="/reconciliation?tab=branch" replace />} />
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
          <Route path="/plan-usage" element={<ProtectedRoute path="/plan-usage" element={<PlanUsagePage />} />} />
          <Route path="/usage" element={<ProtectedRoute path="/usage" element={<PlanUsagePage />} />} />
          <Route path="/super-admin" element={<ProtectedRoute path="/super-admin" element={<SuperAdminDashboardPage />} />} />
          <Route path="/admin/dashboard" element={<ProtectedRoute path="/admin/dashboard" element={<SuperAdminDashboardPage />} />} />
          <Route path="/integrations" element={<ProtectedRoute path="/integrations" element={<Integrations />} />} />
          <Route path="/settings" element={<ProtectedRoute path="/settings" element={<Settings />} />} />
          <Route path="/audit" element={<ProtectedRoute path="/audit" element={<AuditLogs />} />} />
          <Route path="/tenancy" element={<ProtectedRoute path="/tenancy" element={<MultiTenantSaaSCenterPage />} />} />
          <Route path="/multi-tenant" element={<ProtectedRoute path="/multi-tenant" element={<MultiTenantSaaSCenterPage />} />} />

          {/* Catch-all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </>
  );
};
