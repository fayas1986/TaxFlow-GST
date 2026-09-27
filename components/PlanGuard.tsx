/**
 * PlanGuard Component & Hook Suite
 * 
 * Dynamically enforces subscription plan entitlements and role-based permissions across UI components.
 * Restricts Starter / Business plans from accessing Enterprise & Professional only GST features,
 * with support for complete hiding, disabled interactions, frosted blur overlays, or upgrade banners.
 */

import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../store/store';
import { UserRole } from '../types';
import { Feature, PlanCode, PLANS_CATALOG } from '../src/core/entitlements/types';
import { entitlementService } from '../src/core/entitlements/entitlementService';
import { globalModuleRegistry } from '../src/core/entitlements/globalModuleRegistry';
import { 
  useSubscriptionAccess, 
  UserSubscriptionProfile, 
  subscriptionManager 
} from '../src/core/billing/SubscriptionManager';
import { BillingService } from '../src/core/billing';
import { 
  Lock, 
  Sparkles, 
  ArrowUpRight, 
  ShieldAlert, 
  Check, 
  Crown, 
  Zap, 
  Layers, 
  X, 
  ShieldCheck,
  ChevronRight,
  Info
} from 'lucide-react';

// Plan hierarchy ranking for comparison
const PLAN_TIER_RANK: Record<PlanCode, number> = {
  [PlanCode.STARTER]: 1,
  [PlanCode.BUSINESS]: 2,
  [PlanCode.PROFESSIONAL]: 3,
  [PlanCode.ENTERPRISE]: 4,
  [PlanCode.ENTERPRISE_PLUS]: 5,
};

export const PLAN_DISPLAY_NAMES: Record<PlanCode, string> = {
  [PlanCode.STARTER]: 'Starter SME',
  [PlanCode.BUSINESS]: 'Business Growth',
  [PlanCode.PROFESSIONAL]: 'Professional Compliance',
  [PlanCode.ENTERPRISE]: 'Enterprise Multi-Entity',
  [PlanCode.ENTERPRISE_PLUS]: 'Enterprise Plus Dedicated',
};

// Feature metadata for descriptive upgrade prompts
export const FEATURE_ENTITLEMENT_DETAILS: Record<Feature, { title: string; minPlan: PlanCode; desc: string; bullets?: string[] }> = {
  [Feature.INVOICES]: { 
    title: 'Sales Invoicing & Billing', 
    minPlan: PlanCode.STARTER, 
    desc: 'B2B/B2C invoicing, tax rates calculation, and sales register dispatch.',
    bullets: ['Standard GSTR-1 outward registers', 'PDF invoices & basic tax summary']
  },
  [Feature.PURCHASES]: { 
    title: 'Purchase & Inward Bills', 
    minPlan: PlanCode.STARTER, 
    desc: 'Vendor purchase register, inward tax booking and expense logging.',
    bullets: ['Expense ledger posting', 'Inward supply GST registers']
  },
  [Feature.GST_RETURNS]: { 
    title: 'Statutory GST Returns', 
    minPlan: PlanCode.STARTER, 
    desc: 'Monthly GSTR-1, GSTR-3B summary computation and JSON export.',
    bullets: ['Direct return computation', 'Government format JSON output']
  },
  [Feature.E_WAY_BILL]: { 
    title: 'NIC E-Way Bill Logistics', 
    minPlan: PlanCode.BUSINESS, 
    desc: 'Direct NIC portal integration, automated Part-A/B consignment dispatch & vehicle updates.',
    bullets: ['Direct NIC E-Way generation', 'Bulk vehicle & transporter updates', 'Consignment movement tracking']
  },
  [Feature.RECONCILIATION]: { 
    title: 'Automated 2B vs Purchase Reconciler', 
    minPlan: PlanCode.BUSINESS, 
    desc: 'Intelligent multi-criteria invoice matching, missing bill detection, and variance categorization.',
    bullets: ['Automated GSTR-2B vs ERP matching', 'One-click vendor mismatch notices', 'Tolerance rules & status tagging']
  },
  [Feature.ITC]: { 
    title: 'ITC Optimizer & Rule 37/42 Reversals', 
    minPlan: PlanCode.BUSINESS, 
    desc: 'Input tax credit ledger optimization, 180-day vendor aging, and statutory reversal tracking.',
    bullets: ['Maximizes eligible ITC claims', 'Automated Rule 37/42 reversal schedules', '180-day non-payment flags']
  },
  [Feature.MULTI_BRANCH]: { 
    title: 'Multi-Branch Hierarchy & SEZ Units', 
    minPlan: PlanCode.BUSINESS, 
    desc: 'Unit-level cost center tagging, localized branch dispatch, and SEZ zero-rated isolation.',
    bullets: ['Up to 100 localized branch cost centers', 'SEZ unit zero-rated compliance', 'Branch-specific performance metrics']
  },
  [Feature.AUDIT_LOGS]: { 
    title: 'Statutory Immutable Audit Trail', 
    minPlan: PlanCode.BUSINESS, 
    desc: 'Tamper-evident chronological compliance activity logs required for GST audits.',
    bullets: ['Complete historical change ledger', 'User action timestamps & IP capture', 'Auditor export package']
  },
  [Feature.E_INVOICE]: { 
    title: 'Government IRP E-Invoicing & QR Code', 
    minPlan: PlanCode.PROFESSIONAL, 
    desc: 'Direct government IRP API sync, IRN generation, digital signatures, and dynamic B2B QR codes.',
    bullets: ['Instant government IRN & QR generation', 'Automated e-Way bill sync with e-Invoice', 'Bulk JSON IRP batching']
  },
  [Feature.AUTOMATION]: { 
    title: 'GST Compliance Rules Engine', 
    minPlan: PlanCode.PROFESSIONAL, 
    desc: 'Automated filing alerts, custom validation triggers, and scheduled compliance workflows.',
    bullets: ['Custom rule validation pipelines', 'Scheduled compliance report triggers', 'Automated vendor follow-ups']
  },
  [Feature.MULTI_GSTIN]: { 
    title: 'Pan-India Multi-State GSTIN Management', 
    minPlan: PlanCode.PROFESSIONAL, 
    desc: 'Unified multi-registration dashboard, state-by-state filing rollups, and cross-state reconciliation.',
    bullets: ['Consolidated multi-state tax view', 'Independent state filing control', 'Cross-GSTIN stock transfer compliance']
  },
  [Feature.ADVANCED_RBAC]: { 
    title: 'Granular RBAC & Custom Privilege Matrix', 
    minPlan: PlanCode.PROFESSIONAL, 
    desc: 'Role-based access policies, departmental permission boundaries, and maker-checker approval tiers.',
    bullets: ['Custom roles & permission matrix', 'Dual-control maker-checker approvals', 'Branch-scoped user privileges']
  },
  [Feature.CLOUD_BACKUPS]: { 
    title: 'Automated Daily Cloud Backups', 
    minPlan: PlanCode.PROFESSIONAL, 
    desc: 'Immutable automated cloud snapshot protection and point-in-time disaster recovery.',
    bullets: ['Daily encrypted cloud snapshots', 'One-click disaster restore', 'Statutory 7-year data retention']
  },
  [Feature.WHATSAPP_ALERTS]: { 
    title: 'WhatsApp Compliance & Filing Alerts', 
    minPlan: PlanCode.PROFESSIONAL, 
    desc: 'Automated WhatsApp dispatch for invoices, payment reminders, and GSTR-2B mismatch notices.',
    bullets: ['Direct WhatsApp invoice PDF delivery', 'Automated vendor mismatch alerts', 'Due date filing reminders']
  },
  [Feature.AI]: { 
    title: 'Gemini AI Tax Copilot & Predictive Anomaly Engine', 
    minPlan: PlanCode.ENTERPRISE, 
    desc: 'AI-driven tax risk anomaly detection, automated HSN classification, and predictive tax liability forecasting.',
    bullets: ['Predictive ML liability projection', 'Automated tax anomaly scoring', 'Intelligent HSN/SAC code assistant', 'Natural language tax query copilot']
  },
  [Feature.ERP_INTEGRATION]: { 
    title: 'Enterprise ERP Connectors (SAP / Oracle / Tally)', 
    minPlan: PlanCode.ENTERPRISE, 
    desc: 'Real-time bi-directional sync with SAP S/4HANA, Oracle NetSuite, Tally Prime, and Microsoft Dynamics.',
    bullets: ['Bi-directional SAP/Oracle sync', 'Automated GL journal posting', 'Zero-touch master data synchronization']
  },
  [Feature.API]: { 
    title: 'Developer REST API & High-Throughput Ingestion', 
    minPlan: PlanCode.ENTERPRISE, 
    desc: 'Programmatic REST endpoints, custom webhook pipelines, and high-volume batch invoice processing.',
    bullets: ['Direct REST API keys with high rate-limits', 'Custom webhook event subscriptions', 'Headless billing integration']
  },
  [Feature.WEBHOOKS]: { 
    title: 'Real-Time Event Webhooks', 
    minPlan: PlanCode.ENTERPRISE, 
    desc: 'Low-latency statutory event streaming and webhook triggers for external financial pipelines.',
    bullets: ['Instant webhook notifications on filing/IRN', 'Signed HMAC payloads', 'Automated retry and failure alerts']
  },
  [Feature.DATABASE_SYNC]: { 
    title: 'Dedicated Cloud Database Replication', 
    minPlan: PlanCode.ENTERPRISE, 
    desc: 'High-availability dedicated database instances, external read replicas, and custom ETL pipelines.',
    bullets: ['Dedicated tenant database isolation', 'Real-time external replica streams', 'Custom data warehouse connectors']
  }
};

export interface PlanGuardOptions {
  /** Single feature or array of features required */
  feature?: Feature | Feature[];
  /** Minimum plan tier required */
  minPlan?: PlanCode;
  /** Explicit whitelist of allowed plan codes */
  allowedPlans?: PlanCode[];
  /** Flag shortcuts for common enterprise/pro checks */
  requireAi?: boolean;
  requireErp?: boolean;
  requireEInvoicing?: boolean;
  requireEWayBill?: boolean;
  requireReconciliation?: boolean;
  requireMultiGstin?: boolean;
  requireMultiBranch?: boolean;
  requireMultiEntity?: boolean;
  requireAdvancedAnalytics?: boolean;
  requireAuditLogs?: boolean;
  requireDatabaseSync?: boolean;
  requireAdvancedRbac?: boolean;
  /** Role restrictions */
  allowedRoles?: UserRole[];
  /** Custom condition evaluator */
  customCheck?: (profile: UserSubscriptionProfile) => boolean;
  /** If multiple features, whether all or any must match (default: true = ALL) */
  matchAllFeatures?: boolean;
  /** Optional tenant ID override (defaults to current tenant) */
  tenantId?: string;
}

export interface PlanGuardContext {
  isAllowed: boolean;
  isUpgradeRequired: boolean;
  currentPlan: PlanCode;
  currentPlanName: string;
  requiredPlan: PlanCode;
  requiredPlanName: string;
  reason?: string;
  featureDetails: { title: string; minPlan: PlanCode; desc: string; bullets?: string[] } | null;
  profile: UserSubscriptionProfile;
  upgradeToPlan: (targetPlan?: PlanCode) => void;
  navigateToPlans: () => void;
}

/**
 * Hook to evaluate plan entitlement and role access in component logic
 */
export function usePlanGuard(options: PlanGuardOptions = {}): PlanGuardContext {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const activeTenantId = options.tenantId || user?.currentTenantId || 't1';
  const role = user?.role || UserRole.VIEWER;
  
  const profile = useSubscriptionAccess(role, activeTenantId);
  const currentPlan = profile.planCode;
  const currentRank = PLAN_TIER_RANK[currentPlan] || 1;

  // 1. Super Admin always bypasses all plan restrictions
  if (profile.isSuperAdmin) {
    return {
      isAllowed: true,
      isUpgradeRequired: false,
      currentPlan,
      currentPlanName: profile.planName,
      requiredPlan: PlanCode.STARTER,
      requiredPlanName: PLAN_DISPLAY_NAMES[PlanCode.STARTER],
      featureDetails: null,
      profile,
      upgradeToPlan: () => {},
      navigateToPlans: () => navigate('/plan-usage'),
    };
  }

  // 2. Role Check
  if (options.allowedRoles && options.allowedRoles.length > 0 && !options.allowedRoles.includes(role)) {
    return {
      isAllowed: false,
      isUpgradeRequired: false,
      currentPlan,
      currentPlanName: profile.planName,
      requiredPlan: currentPlan,
      requiredPlanName: profile.planName,
      reason: `Access restricted for role '${role}'. Requires: ${options.allowedRoles.join(', ')}.`,
      featureDetails: null,
      profile,
      upgradeToPlan: () => {},
      navigateToPlans: () => navigate('/plan-usage'),
    };
  }

  // 3. Resolve required features from options and flag shortcuts
  const requiredFeatures: Feature[] = [];
  if (options.feature) {
    if (Array.isArray(options.feature)) {
      requiredFeatures.push(...options.feature);
    } else {
      requiredFeatures.push(options.feature);
    }
  }
  if (options.requireAi) requiredFeatures.push(Feature.AI);
  if (options.requireErp) requiredFeatures.push(Feature.ERP_INTEGRATION);
  if (options.requireEInvoicing) requiredFeatures.push(Feature.E_INVOICE);
  if (options.requireEWayBill) requiredFeatures.push(Feature.E_WAY_BILL);
  if (options.requireReconciliation) requiredFeatures.push(Feature.RECONCILIATION);
  if (options.requireMultiGstin) requiredFeatures.push(Feature.MULTI_GSTIN);
  if (options.requireMultiBranch) requiredFeatures.push(Feature.MULTI_BRANCH);
  if (options.requireAuditLogs) requiredFeatures.push(Feature.AUDIT_LOGS);
  if (options.requireDatabaseSync) requiredFeatures.push(Feature.DATABASE_SYNC);
  if (options.requireAdvancedRbac) requiredFeatures.push(Feature.ADVANCED_RBAC);

  // Check specific capability flags
  if (options.requireMultiEntity && !profile.canGroupConsolidation) {
    return {
      isAllowed: false,
      isUpgradeRequired: true,
      currentPlan,
      currentPlanName: profile.planName,
      requiredPlan: PlanCode.BUSINESS,
      requiredPlanName: PLAN_DISPLAY_NAMES[PlanCode.BUSINESS],
      reason: 'Multi-entity consolidation and conglomerate rollups require Business Growth plan or higher.',
      featureDetails: {
        title: 'Multi-Entity Group Consolidation',
        minPlan: PlanCode.BUSINESS,
        desc: 'Manage multiple corporate entities, consolidated reports, and inter-company tax settlements.',
        bullets: ['Unified balance rollup across subsidiaries', 'Single-login multi-company switching', 'Consolidated GSTR compliance view']
      },
      profile,
      upgradeToPlan: (target) => handleUpgrade(target || PlanCode.BUSINESS),
      navigateToPlans: () => navigate('/plan-usage'),
    };
  }

  if (options.requireAdvancedAnalytics && !profile.canAdvancedAnalytics) {
    return {
      isAllowed: false,
      isUpgradeRequired: true,
      currentPlan,
      currentPlanName: profile.planName,
      requiredPlan: PlanCode.ENTERPRISE,
      requiredPlanName: PLAN_DISPLAY_NAMES[PlanCode.ENTERPRISE],
      reason: 'Advanced predictive analytics and tax risk forecasting require Enterprise plan.',
      featureDetails: FEATURE_ENTITLEMENT_DETAILS[Feature.AI],
      profile,
      upgradeToPlan: (target) => handleUpgrade(target || PlanCode.ENTERPRISE),
      navigateToPlans: () => navigate('/plan-usage'),
    };
  }

  // 4. Check explicit minPlan
  let requiredPlan = options.minPlan || PlanCode.STARTER;
  if (options.minPlan) {
    const requiredRank = PLAN_TIER_RANK[options.minPlan] || 1;
    if (currentRank < requiredRank) {
      return {
        isAllowed: false,
        isUpgradeRequired: true,
        currentPlan,
        currentPlanName: profile.planName,
        requiredPlan: options.minPlan,
        requiredPlanName: PLAN_DISPLAY_NAMES[options.minPlan] || options.minPlan,
        reason: `This capability requires the ${PLAN_DISPLAY_NAMES[options.minPlan]} tier (Current: ${profile.planName}).`,
        featureDetails: null,
        profile,
        upgradeToPlan: (target) => handleUpgrade(target || options.minPlan || PlanCode.ENTERPRISE),
        navigateToPlans: () => navigate('/plan-usage'),
      };
    }
  }

  // 5. Check allowedPlans whitelist
  if (options.allowedPlans && options.allowedPlans.length > 0) {
    if (!options.allowedPlans.includes(currentPlan)) {
      const highestNeeded = options.allowedPlans[0] || PlanCode.ENTERPRISE;
      return {
        isAllowed: false,
        isUpgradeRequired: true,
        currentPlan,
        currentPlanName: profile.planName,
        requiredPlan: highestNeeded,
        requiredPlanName: PLAN_DISPLAY_NAMES[highestNeeded] || highestNeeded,
        reason: `This feature is exclusive to ${options.allowedPlans.map(p => PLAN_DISPLAY_NAMES[p]).join(' / ')}.`,
        featureDetails: null,
        profile,
        upgradeToPlan: (target) => handleUpgrade(target || highestNeeded),
        navigateToPlans: () => navigate('/plan-usage'),
      };
    }
  }

  // 6. Check required features against entitlementService & globalModuleRegistry
  if (requiredFeatures.length > 0) {
    const matchAll = options.matchAllFeatures !== false;
    let failedFeature: Feature | null = null;
    let anyPassed = false;

    for (const f of requiredFeatures) {
      const isGloballyAvailable = globalModuleRegistry.isFeatureGloballyAvailable(f);
      const isEntitled = entitlementService.hasFeature(activeTenantId, f);

      if (!isGloballyAvailable) {
        return {
          isAllowed: false,
          isUpgradeRequired: false,
          currentPlan,
          currentPlanName: profile.planName,
          requiredPlan: currentPlan,
          requiredPlanName: profile.planName,
          reason: 'This module is temporarily disabled for system maintenance.',
          featureDetails: FEATURE_ENTITLEMENT_DETAILS[f] || null,
          profile,
          upgradeToPlan: () => {},
          navigateToPlans: () => navigate('/plan-usage'),
        };
      }

      if (isEntitled) {
        anyPassed = true;
      } else {
        failedFeature = f;
        if (matchAll) break;
      }
    }

    const featureCheckFailed = matchAll ? failedFeature !== null : !anyPassed;

    if (featureCheckFailed && failedFeature) {
      const fDetail = FEATURE_ENTITLEMENT_DETAILS[failedFeature];
      const minTier = fDetail?.minPlan || PlanCode.PROFESSIONAL;

      return {
        isAllowed: false,
        isUpgradeRequired: true,
        currentPlan,
        currentPlanName: profile.planName,
        requiredPlan: minTier,
        requiredPlanName: PLAN_DISPLAY_NAMES[minTier] || minTier,
        reason: `'${fDetail?.title || failedFeature}' is available on ${PLAN_DISPLAY_NAMES[minTier]} or higher.`,
        featureDetails: fDetail || null,
        profile,
        upgradeToPlan: (target) => handleUpgrade(target || minTier),
        navigateToPlans: () => navigate('/plan-usage'),
      };
    }
  }

  // 7. Custom check
  if (options.customCheck && !options.customCheck(profile)) {
    return {
      isAllowed: false,
      isUpgradeRequired: true,
      currentPlan,
      currentPlanName: profile.planName,
      requiredPlan: PlanCode.ENTERPRISE,
      requiredPlanName: PLAN_DISPLAY_NAMES[PlanCode.ENTERPRISE],
      reason: 'This action is restricted under your active organization plan.',
      featureDetails: null,
      profile,
      upgradeToPlan: (target) => handleUpgrade(target || PlanCode.ENTERPRISE),
      navigateToPlans: () => navigate('/plan-usage'),
    };
  }

  function handleUpgrade(targetPlan: PlanCode) {
    try {
      BillingService.upgradePlan(activeTenantId, targetPlan);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('taxflow:subscription_updated', {
          detail: { tenantId: activeTenantId, planId: targetPlan }
        }));
      }
    } catch (e) {
      console.error('Failed to trigger in-memory plan upgrade:', e);
      navigate('/plan-usage');
    }
  }

  return {
    isAllowed: true,
    isUpgradeRequired: false,
    currentPlan,
    currentPlanName: profile.planName,
    requiredPlan: PlanCode.STARTER,
    requiredPlanName: PLAN_DISPLAY_NAMES[PlanCode.STARTER],
    featureDetails: null,
    profile,
    upgradeToPlan: handleUpgrade,
    navigateToPlans: () => navigate('/plan-usage'),
  };
}

export interface PlanGuardProps extends PlanGuardOptions {
  children?: React.ReactNode | ((ctx: PlanGuardContext) => React.ReactNode);
  /**
   * Display mode when plan access is denied:
   * - 'hide' (default): Hides children entirely or renders optional `fallback`
   * - 'disable': Renders children with opacity-50, pointer-events-none, and disabled lock badge
   * - 'blur': Shows children blurred with a frosted glass upgrade card overlay
   * - 'card' | 'upgrade-card': Shows an in-place rich upgrade card with feature benefits & CTA
   * - 'banner': Shows an informative horizontal banner with an upgrade button
   * - 'tooltip': Renders children disabled with a hover tooltip explaining the plan requirement
   * - 'custom': Calls fallbackRender with PlanGuardContext
   */
  mode?: 'hide' | 'disable' | 'blur' | 'card' | 'upgrade-card' | 'banner' | 'tooltip' | 'custom';
  /** Custom fallback component when access is denied */
  fallback?: React.ReactNode;
  /** Custom render callback for denied state */
  fallbackRender?: (ctx: PlanGuardContext) => React.ReactNode;
  /** Custom title for upgrade card/banner */
  upgradeTitle?: string;
  /** Custom description for upgrade card/banner */
  upgradeDescription?: string;
  /** Human friendly feature name override */
  featureName?: string;
  /** Custom badge label (e.g. 'Enterprise Only') */
  badgeText?: string;
  /** Compact styling for small table rows, sidebar items, or dropdown cards */
  compact?: boolean;
  /** Custom upgrade button callback (defaults to in-memory upgrade modal / navigate to plan-usage) */
  onUpgradeClick?: (requiredPlan: PlanCode) => void;
  /** Additional container styling */
  className?: string;
  /** Message to display when hovering in tooltip or disable mode */
  disabledTooltipMessage?: string;
  /** Whether to show one-click instant upgrade modal */
  showInstantUpgradeModal?: boolean;
}

/**
 * Universal PlanGuard Component Wrapper
 */
export const PlanGuard: React.FC<PlanGuardProps> = ({
  children,
  mode = 'hide',
  fallback = null,
  fallbackRender,
  upgradeTitle,
  upgradeDescription,
  featureName,
  badgeText,
  compact = false,
  onUpgradeClick,
  className = '',
  disabledTooltipMessage,
  showInstantUpgradeModal = true,
  ...options
}) => {
  const guard = usePlanGuard(options);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  // If user has full access, render children
  if (guard.isAllowed) {
    if (typeof children === 'function') {
      return <>{children(guard)}</>;
    }
    return <>{children}</>;
  }

  // If custom fallbackRender provided
  if (fallbackRender) {
    return <>{fallbackRender(guard)}</>;
  }

  // If custom static fallback provided (and mode is hide)
  if (fallback && mode === 'hide') {
    return <>{fallback}</>;
  }

  const effectiveTitle = upgradeTitle || guard.featureDetails?.title || featureName || 'Premium GST Capability';
  const effectiveDesc = upgradeDescription || guard.reason || guard.featureDetails?.desc || 
    `This feature requires the ${guard.requiredPlanName}. Upgrade your organization plan to unlock immediate access.`;
  const effectiveBadge = badgeText || `${guard.requiredPlanName} Only`;

  const handleAction = () => {
    if (onUpgradeClick) {
      onUpgradeClick(guard.requiredPlan);
      return;
    }
    if (showInstantUpgradeModal) {
      setIsUpgradeModalOpen(true);
    } else {
      guard.navigateToPlans();
    }
  };

  const executeInstantUpgrade = () => {
    setIsUpgrading(true);
    setTimeout(() => {
      guard.upgradeToPlan(guard.requiredPlan);
      setIsUpgrading(false);
      setIsUpgradeModalOpen(false);
    }, 450);
  };

  // Render Denied UI based on mode
  switch (mode) {
    case 'disable':
      return (
        <div className={`relative group/planguard ${className}`}>
          <div className="opacity-45 pointer-events-none select-none filter grayscale-[40%] transition-opacity">
            {typeof children === 'function' ? children(guard) : children}
          </div>
          <div className="absolute inset-0 z-10 flex items-center justify-center p-2">
            <div 
              onClick={handleAction}
              className="bg-slate-900/90 hover:bg-slate-900 text-white backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-lg flex items-center gap-2 text-xs font-bold cursor-pointer transition-all hover:scale-105"
              title={disabledTooltipMessage || guard.reason}
            >
              <Lock size={12} className="text-amber-400 shrink-0" />
              <span className="truncate max-w-[200px]">{effectiveBadge}</span>
              <ArrowUpRight size={12} className="text-indigo-300 shrink-0" />
            </div>
          </div>
          {isUpgradeModalOpen && (
            <InstantUpgradeModal 
              isOpen={isUpgradeModalOpen}
              onClose={() => setIsUpgradeModalOpen(false)}
              onConfirm={executeInstantUpgrade}
              targetPlan={guard.requiredPlan}
              targetPlanName={guard.requiredPlanName}
              featureTitle={effectiveTitle}
              featureDetails={guard.featureDetails}
              currentPlanName={guard.currentPlanName}
              isUpgrading={isUpgrading}
            />
          )}
        </div>
      );

    case 'blur':
      return (
        <div className={`relative overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/50 ${className}`}>
          {/* Blurred Child Background Content */}
          <div className="filter blur-sm opacity-40 pointer-events-none select-none max-h-[420px] overflow-hidden">
            {typeof children === 'function' ? children(guard) : children}
          </div>

          {/* Centered Frosted Lock Overlay */}
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-gradient-to-b from-white/40 via-white/80 to-white/95 backdrop-blur-[2px]">
            <div className="max-w-md w-full p-5 bg-white/95 rounded-2xl shadow-xl border border-indigo-100/90 text-center animate-in fade-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                <Lock size={22} />
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-extrabold uppercase tracking-wider mb-2">
                <Crown size={11} className="text-amber-600" />
                {effectiveBadge}
              </div>

              <h4 className="text-base font-black text-slate-900 tracking-tight">
                {effectiveTitle}
              </h4>

              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {effectiveDesc}
              </p>

              {guard.featureDetails?.bullets && guard.featureDetails.bullets.length > 0 && (
                <div className="my-3 py-2 px-3 bg-slate-50 border border-slate-200/70 rounded-xl text-left space-y-1">
                  {guard.featureDetails.bullets.map((b, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-[11px] font-medium text-slate-700">
                      <Check size={12} className="text-emerald-600 shrink-0" strokeWidth={3} />
                      <span className="truncate">{b}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleAction}
                  className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles size={13} />
                  Upgrade to {guard.requiredPlanName}
                </button>
              </div>
            </div>
          </div>

          {isUpgradeModalOpen && (
            <InstantUpgradeModal 
              isOpen={isUpgradeModalOpen}
              onClose={() => setIsUpgradeModalOpen(false)}
              onConfirm={executeInstantUpgrade}
              targetPlan={guard.requiredPlan}
              targetPlanName={guard.requiredPlanName}
              featureTitle={effectiveTitle}
              featureDetails={guard.featureDetails}
              currentPlanName={guard.currentPlanName}
              isUpgrading={isUpgrading}
            />
          )}
        </div>
      );

    case 'banner':
      return (
        <div className={`p-4 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/80 via-white to-blue-50/70 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${className}`}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5 border border-indigo-200">
              <Lock size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h5 className="text-xs font-bold text-slate-900">{effectiveTitle}</h5>
                <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-800 px-2 py-0.2 rounded-full border border-indigo-200">
                  {effectiveBadge}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-normal max-w-xl">
                {effectiveDesc}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAction}
            className="shrink-0 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles size={12} />
            Upgrade Plan
          </button>
          {isUpgradeModalOpen && (
            <InstantUpgradeModal 
              isOpen={isUpgradeModalOpen}
              onClose={() => setIsUpgradeModalOpen(false)}
              onConfirm={executeInstantUpgrade}
              targetPlan={guard.requiredPlan}
              targetPlanName={guard.requiredPlanName}
              featureTitle={effectiveTitle}
              featureDetails={guard.featureDetails}
              currentPlanName={guard.currentPlanName}
              isUpgrading={isUpgrading}
            />
          )}
        </div>
      );

    case 'card':
    case 'upgrade-card':
      return (
        <div className={`p-6 bg-white rounded-2xl border border-indigo-100 shadow-xs text-center relative overflow-hidden ${className}`}>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-violet-500" />
          
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-200/80 flex items-center justify-center mx-auto mb-3">
            <Lock size={22} />
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-extrabold uppercase tracking-wider rounded-full mb-2">
            <Sparkles size={11} /> {effectiveBadge}
          </span>

          <h4 className="text-base font-black text-slate-900 tracking-tight">
            {effectiveTitle}
          </h4>

          <p className="text-xs text-slate-600 mt-1.5 max-w-md mx-auto leading-relaxed">
            {effectiveDesc}
          </p>

          {guard.featureDetails?.bullets && (
            <div className="my-4 max-w-md mx-auto p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-left space-y-1.5">
              {guard.featureDetails.bullets.map((bullet, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-slate-700">
                  <Check size={13} className="text-emerald-600 shrink-0" strokeWidth={3} />
                  <span>{bullet}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleAction}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Sparkles size={14} /> Unlock on {guard.requiredPlanName}
            </button>
          </div>

          {isUpgradeModalOpen && (
            <InstantUpgradeModal 
              isOpen={isUpgradeModalOpen}
              onClose={() => setIsUpgradeModalOpen(false)}
              onConfirm={executeInstantUpgrade}
              targetPlan={guard.requiredPlan}
              targetPlanName={guard.requiredPlanName}
              featureTitle={effectiveTitle}
              featureDetails={guard.featureDetails}
              currentPlanName={guard.currentPlanName}
              isUpgrading={isUpgrading}
            />
          )}
        </div>
      );

    case 'tooltip':
      return (
        <div className={`relative inline-block ${className}`} title={`${effectiveTitle}: ${effectiveDesc}`}>
          <div className="opacity-50 pointer-events-none cursor-not-allowed select-none">
            {typeof children === 'function' ? children(guard) : children}
          </div>
        </div>
      );

    case 'hide':
    default:
      return null;
  }
};

/**
 * Instant Upgrade Confirmation Modal
 */
export interface InstantUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  targetPlan: PlanCode;
  targetPlanName: string;
  featureTitle: string;
  featureDetails?: { title: string; minPlan?: PlanCode; desc?: string; bullets?: string[] } | null;
  featureDescription?: string;
  featureBullets?: string[];
  currentPlanName?: string;
  isUpgrading?: boolean;
}

export const InstantUpgradeModal: React.FC<InstantUpgradeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  targetPlan,
  targetPlanName,
  featureTitle,
  featureDetails,
  featureDescription,
  featureBullets,
  currentPlanName = 'Starter SME',
  isUpgrading = false
}) => {
  if (!isOpen) return null;

  const plan = PLANS_CATALOG[targetPlan] || PLANS_CATALOG[PlanCode.ENTERPRISE];
  const effectiveBullets = featureBullets || featureDetails?.bullets || [
    'Multi-entity statutory filing & real-time e-Invoicing/E-Way integration',
    'Automated 2B reconciliation with vendor risk scorecards',
    'Priority compliance SLA & dedicated data branch isolation'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white max-w-lg w-full rounded-2xl shadow-2xl border border-indigo-100 overflow-hidden text-left animate-in zoom-in-95 duration-200">
        <div className="p-5 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-700/60 border border-indigo-500/50 flex items-center justify-center text-amber-300">
              <Crown size={20} />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Upgrade to {targetPlanName}</h3>
              <p className="text-xs text-indigo-200">Unlock {featureTitle} & Enterprise GST tools</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-3.5 bg-indigo-50/80 border border-indigo-100 rounded-xl">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 block">Plan Transition</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-bold text-slate-700">{currentPlanName}</span>
                <ChevronRight size={14} className="text-indigo-400" />
                <span className="text-xs font-black text-indigo-950 bg-indigo-200/70 px-2 py-0.5 rounded">{targetPlanName}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-black text-slate-900">₹{plan.monthlyPriceInr.toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-500 block">/ month (Billed Annually)</span>
            </div>
          </div>

          <div>
            <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Entitlements Unlocked</h5>
            <div className="space-y-1.5">
              {effectiveBullets.map((bullet, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                  <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Check size={10} strokeWidth={3} />
                  </div>
                  <span>{bullet}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check size={10} strokeWidth={3} />
                </div>
                <span>Increased monthly document & API volume limits</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check size={10} strokeWidth={3} />
                </div>
                <span>Priority statutory SLA and compliance engineering support</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
            <Info size={14} className="shrink-0 mt-0.5 text-amber-600" />
            <span>Instant sandbox demo upgrade: switching plan updates all tenant entitlements, dashboard telemetry, and multi-state routers immediately.</span>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isUpgrading}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-black rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            {isUpgrading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Upgrading Plan...
              </>
            ) : (
              <>
                <Zap size={13} />
                Confirm Instant Upgrade
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// Specialized Helper Presets for Quick Usage
// ==========================================

/**
 * Guard for Enterprise-Only features (AI, ERP, Dedicated DB Sync, Multi-Company Consolidation)
 */
export const EnterpriseOnly: React.FC<Omit<PlanGuardProps, 'minPlan'>> = (props) => (
  <PlanGuard {...props} minPlan={PlanCode.ENTERPRISE} />
);

/**
 * Guard for Professional+ features (E-Invoicing, Multi-GSTIN, Rules Automation, WhatsApp)
 */
export const ProfessionalOnly: React.FC<Omit<PlanGuardProps, 'minPlan'>> = (props) => (
  <PlanGuard {...props} minPlan={PlanCode.PROFESSIONAL} />
);

/**
 * Guard for Business Growth+ features (E-Way Bills, 2B Reconciliation, ITC Optimizer, Multi-Branch)
 */
export const BusinessOnly: React.FC<Omit<PlanGuardProps, 'minPlan'>> = (props) => (
  <PlanGuard {...props} minPlan={PlanCode.BUSINESS} />
);

/**
 * Guard specifically for AI features (Copilot, Anomaly Scoring, Risk Forecasting)
 */
export const AiFeatureGuard: React.FC<Omit<PlanGuardProps, 'feature'>> = (props) => (
  <PlanGuard {...props} feature={Feature.AI} />
);

/**
 * Guard specifically for ERP integration capabilities (SAP, Oracle, Tally, Webhooks)
 */
export const ErpIntegrationGuard: React.FC<Omit<PlanGuardProps, 'feature'>> = (props) => (
  <PlanGuard {...props} feature={Feature.ERP_INTEGRATION} />
);

/**
 * Inline locked badge indicator for menu items, table rows, and headers
 */
export interface PlanLockBadgeProps {
  plan?: PlanCode;
  feature?: Feature;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}

export const PlanLockBadge: React.FC<PlanLockBadgeProps> = ({
  plan = PlanCode.ENTERPRISE,
  feature,
  className = '',
  size = 'xs'
}) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const guard = usePlanGuard({ feature, minPlan: plan });

  if (guard.isAllowed) return null;

  const sizeClasses = {
    xs: 'text-[9px] px-1.5 py-0.2 gap-1',
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5'
  };

  const planLabel = feature 
    ? (FEATURE_ENTITLEMENT_DETAILS[feature]?.minPlan ? PLAN_DISPLAY_NAMES[FEATURE_ENTITLEMENT_DETAILS[feature].minPlan] : 'Pro')
    : PLAN_DISPLAY_NAMES[plan];

  return (
    <span 
      className={`inline-flex items-center font-extrabold rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 uppercase tracking-wider ${sizeClasses[size]} ${className}`}
      title={guard.reason}
    >
      <Lock size={size === 'xs' ? 9 : 11} className="text-amber-600" />
      <span>{planLabel}</span>
    </span>
  );
};

/**
 * PlanGateButton: Button that automatically disables or prompts upgrade when clicked if user lacks access
 */
export interface PlanGateButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  minPlan?: PlanCode;
  feature?: Feature;
  requireAi?: boolean;
  requireErp?: boolean;
  requireEInvoicing?: boolean;
  requireEWayBill?: boolean;
  requireReconciliation?: boolean;
  requireMultiGstin?: boolean;
  upgradePromptTitle?: string;
  children: React.ReactNode;
}

export const PlanGateButton: React.FC<PlanGateButtonProps> = ({
  minPlan,
  feature,
  requireAi,
  requireErp,
  requireEInvoicing,
  requireEWayBill,
  requireReconciliation,
  requireMultiGstin,
  upgradePromptTitle,
  onClick,
  children,
  className = '',
  ...btnProps
}) => {
  const guard = usePlanGuard({
    minPlan,
    feature,
    requireAi,
    requireErp,
    requireEInvoicing,
    requireEWayBill,
    requireReconciliation,
    requireMultiGstin
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (guard.isAllowed) {
      if (onClick) onClick(e);
    } else {
      e.preventDefault();
      e.stopPropagation();
      setIsModalOpen(true);
    }
  };

  const handleConfirmUpgrade = () => {
    setIsUpgrading(true);
    setTimeout(() => {
      guard.upgradeToPlan(guard.requiredPlan);
      setIsUpgrading(false);
      setIsModalOpen(false);
    }, 450);
  };

  return (
    <>
      <button
        {...btnProps}
        onClick={handleClick}
        className={`${className} ${!guard.isAllowed ? 'relative' : ''}`}
        title={!guard.isAllowed ? guard.reason : btnProps.title}
      >
        {children}
        {!guard.isAllowed && (
          <Lock size={12} className="inline ml-1.5 text-amber-500 shrink-0" />
        )}
      </button>

      {isModalOpen && (
        <InstantUpgradeModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleConfirmUpgrade}
          targetPlan={guard.requiredPlan}
          targetPlanName={guard.requiredPlanName}
          featureTitle={upgradePromptTitle || guard.featureDetails?.title || 'Plan Restricted Action'}
          featureDetails={guard.featureDetails}
          currentPlanName={guard.currentPlanName}
          isUpgrading={isUpgrading}
        />
      )}
    </>
  );
};

export default PlanGuard;
