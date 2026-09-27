/**
 * Usage Tracking & Metering Types
 * Tracks real-time consumption against plan quotas.
 */

export enum UsageMetric {
  INVOICE_DOCUMENTS = "invoice_documents",
  E_INVOICE_DOCUMENTS = "e_invoice_documents",
  EWAY_BILLS = "eway_bills",
  RECONCILIATION_DOCUMENTS = "reconciliation_documents",
  AI_REQUESTS = "ai_requests",
  API_CALLS = "api_calls",
  USERS = "users",
  GSTINS = "gstins",
  BRANCHES = "branches",
  STORAGE_BYTES = "storage_bytes"
}

export interface MetricUsage {
  current: number;
  limit: number;
  remaining: number;
  usagePercentage: number;
  isExceeded: boolean;
}

export interface TenantUsage {
  tenantId: string;
  billingPeriod: string; // e.g. '2026-09'
  metrics: Record<UsageMetric, MetricUsage>;
  updatedAt: string;
  invoicesCount?: number;
  eInvoicesCount?: number;
  ewayBillsCount?: number;
  reconciliationCount?: number;
  aiRequestsCount?: number;
  apiCallsCount?: number;
  usersCount?: number;
  gstinsCount?: number;
  branchesCount?: number;
  storageMb?: number;
}

export interface UsageCheckResult {
  allowed: boolean;
  metric: UsageMetric;
  current: number;
  limit: number;
  remaining: number;
  requestedDelta: number;
  reason?: string;
}
