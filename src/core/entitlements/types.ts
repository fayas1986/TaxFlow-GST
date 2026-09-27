/**
 * Feature Entitlements & Subscription Plans Model
 * Separates plans from features to allow changing pricing/packaging without changing application logic.
 */

export enum Feature {
  INVOICES = "invoices",
  PURCHASES = "purchases",
  E_INVOICE = "e_invoice",
  E_WAY_BILL = "eway_bill",
  GST_RETURNS = "gst_returns",
  RECONCILIATION = "reconciliation",
  ITC = "itc",
  AI = "ai",
  AUTOMATION = "automation",
  MULTI_GSTIN = "multi_gstin",
  MULTI_BRANCH = "multi_branch",
  ERP_INTEGRATION = "erp_integration",
  API = "api",
  WEBHOOKS = "webhooks",
  ADVANCED_RBAC = "advanced_rbac",
  AUDIT_LOGS = "audit_logs",
  CLOUD_BACKUPS = "cloud_backups",
  WHATSAPP_ALERTS = "whatsapp_alerts",
  DATABASE_SYNC = "database_sync"
}

export enum PlanCode {
  STARTER = "STARTER",
  BUSINESS = "BUSINESS",
  PROFESSIONAL = "PROFESSIONAL",
  ENTERPRISE = "ENTERPRISE",
  ENTERPRISE_PLUS = "ENTERPRISE_PLUS"
}

export interface PlanLimits {
  maxUsers: number;
  maxCompanies: number;
  maxTenants?: number;
  maxGstins: number;
  maxBranches: number;
  monthlyInvoiceVolume: number;
  monthlyEinvoiceVolume: number;
  monthlyEwayBills: number;
  monthlyReconciliationDocuments: number;
  monthlyAiRequests: number;
  monthlyApiCalls: number;
  storageMb: number;
  maxInvoicesPerMonth?: number;
  maxEInvoicesPerMonth?: number;
  maxReconciliationDocsPerMonth?: number;
  maxAiCallsPerMonth?: number;
  maxApiCallsPerMonth?: number;
  maxStorageMb?: number;
}

export interface PlanEntitlement {
  planId: PlanCode;
  feature: Feature;
  enabled: boolean;
  configuration?: Record<string, any>;
}

export interface Plan {
  code: PlanCode;
  name: string;
  description: string;
  monthlyPriceInr: number;
  annualPriceInr: number;
  features: Feature[];
  limits: PlanLimits;
}

export interface TenantSubscription {
  id: string;
  tenantId: string;
  planId: PlanCode;
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';
  startDate: string;
  renewalDate: string;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  limits: PlanLimits;
  customFeatureOverrides?: {
    enabledFeatures?: Feature[];
    disabledFeatures?: Feature[];
  };
  customMonthlyPrice?: number;
  customAnnualPrice?: number;
  customPlanName?: string;
  customNotes?: string;
}

export const DEFAULT_PLANS_CATALOG: Record<PlanCode, Plan> = {
  [PlanCode.STARTER]: {
    code: PlanCode.STARTER,
    name: "Starter SME",
    description: "Foundational GST compliance for small businesses with single state presence",
    monthlyPriceInr: 2999,
    annualPriceInr: 29990,
    features: [
      Feature.INVOICES,
      Feature.PURCHASES,
      Feature.GST_RETURNS
    ],
    limits: {
      maxUsers: 2,
      maxCompanies: 1,
      maxTenants: 1,
      maxGstins: 1,
      maxBranches: 1,
      monthlyInvoiceVolume: 500,
      monthlyEinvoiceVolume: 0,
      monthlyEwayBills: 0,
      monthlyReconciliationDocuments: 0,
      monthlyAiRequests: 20,
      monthlyApiCalls: 0,
      storageMb: 1024, // 1 GB
      maxInvoicesPerMonth: 500,
      maxEInvoicesPerMonth: 0,
      maxReconciliationDocsPerMonth: 0,
      maxAiCallsPerMonth: 20,
      maxApiCallsPerMonth: 0,
      maxStorageMb: 1024
    }
  },

  [PlanCode.BUSINESS]: {
    code: PlanCode.BUSINESS,
    name: "Business Growth",
    description: "Complete compliance suite with basic reconciliation and e-way bills",
    monthlyPriceInr: 6999,
    annualPriceInr: 69990,
    features: [
      Feature.INVOICES,
      Feature.PURCHASES,
      Feature.E_WAY_BILL,
      Feature.GST_RETURNS,
      Feature.RECONCILIATION,
      Feature.ITC,
      Feature.MULTI_BRANCH,
      Feature.AUDIT_LOGS
    ],
    limits: {
      maxUsers: 5,
      maxCompanies: 3,
      maxTenants: 3,
      maxGstins: 2,
      maxBranches: 5,
      monthlyInvoiceVolume: 2500,
      monthlyEinvoiceVolume: 500,
      monthlyEwayBills: 1000,
      monthlyReconciliationDocuments: 2500,
      monthlyAiRequests: 100,
      monthlyApiCalls: 1000,
      storageMb: 5120, // 5 GB
      maxInvoicesPerMonth: 2500,
      maxEInvoicesPerMonth: 500,
      maxReconciliationDocsPerMonth: 2500,
      maxAiCallsPerMonth: 100,
      maxApiCallsPerMonth: 1000,
      maxStorageMb: 5120
    }
  },

  [PlanCode.PROFESSIONAL]: {
    code: PlanCode.PROFESSIONAL,
    name: "Professional Compliance",
    description: "Advanced multi-state compliance with e-invoicing and automated matching",
    monthlyPriceInr: 14999,
    annualPriceInr: 149990,
    features: [
      Feature.INVOICES,
      Feature.PURCHASES,
      Feature.E_INVOICE,
      Feature.E_WAY_BILL,
      Feature.GST_RETURNS,
      Feature.RECONCILIATION,
      Feature.ITC,
      Feature.AUTOMATION,
      Feature.MULTI_GSTIN,
      Feature.MULTI_BRANCH,
      Feature.ADVANCED_RBAC,
      Feature.AUDIT_LOGS,
      Feature.CLOUD_BACKUPS,
      Feature.WHATSAPP_ALERTS
    ],
    limits: {
      maxUsers: 15,
      maxCompanies: 6,
      maxTenants: 6,
      maxGstins: 5,
      maxBranches: 15,
      monthlyInvoiceVolume: 10000,
      monthlyEinvoiceVolume: 5000,
      monthlyEwayBills: 5000,
      monthlyReconciliationDocuments: 10000,
      monthlyAiRequests: 500,
      monthlyApiCalls: 10000,
      storageMb: 20480, // 20 GB
      maxInvoicesPerMonth: 10000,
      maxEInvoicesPerMonth: 5000,
      maxReconciliationDocsPerMonth: 10000,
      maxAiCallsPerMonth: 500,
      maxApiCallsPerMonth: 10000,
      maxStorageMb: 20480
    }
  },

  [PlanCode.ENTERPRISE]: {
    code: PlanCode.ENTERPRISE,
    name: "Enterprise Multi-Entity",
    description: "Complete conglomerate and corporate multi-GSTIN suite with ERP integrations & AI",
    monthlyPriceInr: 34999,
    annualPriceInr: 349990,
    features: [
      Feature.INVOICES,
      Feature.PURCHASES,
      Feature.E_INVOICE,
      Feature.E_WAY_BILL,
      Feature.GST_RETURNS,
      Feature.RECONCILIATION,
      Feature.ITC,
      Feature.AI,
      Feature.AUTOMATION,
      Feature.MULTI_GSTIN,
      Feature.MULTI_BRANCH,
      Feature.ERP_INTEGRATION,
      Feature.API,
      Feature.WEBHOOKS,
      Feature.ADVANCED_RBAC,
      Feature.AUDIT_LOGS,
      Feature.CLOUD_BACKUPS,
      Feature.WHATSAPP_ALERTS,
      Feature.DATABASE_SYNC
    ],
    limits: {
      maxUsers: 50,
      maxCompanies: 50,
      maxTenants: 50,
      maxGstins: 20,
      maxBranches: 100,
      monthlyInvoiceVolume: 50000,
      monthlyEinvoiceVolume: 50000,
      monthlyEwayBills: 50000,
      monthlyReconciliationDocuments: 50000,
      monthlyAiRequests: 2500,
      monthlyApiCalls: 100000,
      storageMb: 102400, // 100 GB
      maxInvoicesPerMonth: 50000,
      maxEInvoicesPerMonth: 50000,
      maxReconciliationDocsPerMonth: 50000,
      maxAiCallsPerMonth: 2500,
      maxApiCallsPerMonth: 100000,
      maxStorageMb: 102400
    }
  },

  [PlanCode.ENTERPRISE_PLUS]: {
    code: PlanCode.ENTERPRISE_PLUS,
    name: "Enterprise Plus Dedicated",
    description: "Unlimited scale, dedicated tenancy, custom AI models, and real-time ERP bidirectional sync",
    monthlyPriceInr: 74999,
    annualPriceInr: 749990,
    features: Object.values(Feature),
    limits: {
      maxUsers: 999,
      maxCompanies: 999,
      maxTenants: 999,
      maxGstins: 999,
      maxBranches: 999,
      monthlyInvoiceVolume: 1000000,
      monthlyEinvoiceVolume: 1000000,
      monthlyEwayBills: 1000000,
      monthlyReconciliationDocuments: 1000000,
      monthlyAiRequests: 50000,
      monthlyApiCalls: 1000000,
      storageMb: 1048576, // 1 TB
      maxInvoicesPerMonth: 1000000,
      maxEInvoicesPerMonth: 1000000,
      maxReconciliationDocsPerMonth: 1000000,
      maxAiCallsPerMonth: 50000,
      maxApiCallsPerMonth: 1000000,
      maxStorageMb: 1048576
    }
  }
};

export const PLANS_CATALOG = DEFAULT_PLANS_CATALOG;

export interface UsageMetricItem {
  id: string;
  label: string;
  category: 'LEDGER' | 'COMPLIANCE' | 'INFRASTRUCTURE' | 'INTELLIGENCE';
  current: number;
  limit: number;
  unit: string;
  percentage: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'EXCEEDED';
  description: string;
  iconName: string;
  trendLabel?: string;
  isUnlimited?: boolean;
}

export interface PlanAddOn {
  id: string;
  name: string;
  category: 'INVOICES' | 'USERS' | 'STORAGE' | 'AI' | 'GSTIN';
  description: string;
  unitIncrement: number;
  unitLabel: string;
  monthlyPriceInr: number;
  annualPriceInr: number;
}

export interface TenantUsageSummary {
  tenantId: string;
  plan: Plan;
  subscription: TenantSubscription;
  metrics: UsageMetricItem[];
  billingPeriod: {
    startDate: string;
    renewalDate: string;
    daysRemaining: number;
    totalDays: number;
    progressPct: number;
  };
  overallHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  highestConsumedMetric: UsageMetricItem;
  recommendedUpgradePlan?: Plan;
}
