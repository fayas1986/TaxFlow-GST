/**
 * Core Billing & Subscription Cycle Management
 */

import { PlanCode, TenantSubscription, PLANS_CATALOG } from '../entitlements/types';
import { entitlementService } from '../entitlements/entitlementService';

export interface BillingInvoice {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  period: string;
  amountInr: number;
  taxInr: number;
  totalInr: number;
  status: 'PAID' | 'DUE' | 'FAILED';
  paidAt?: string;
  invoicePdfUrl: string;
}

export class BillingService {
  public static getSubscription(tenantId: string): TenantSubscription | null {
    return entitlementService.getSubscription(tenantId);
  }

  public static upgradePlan(tenantId: string, newPlan: PlanCode): TenantSubscription {
    return entitlementService.updateSubscriptionPlan(tenantId, newPlan);
  }

  public static setPlan(tenantId: string, newPlan: PlanCode): TenantSubscription {
    return entitlementService.updateSubscriptionPlan(tenantId, newPlan);
  }

  public static getBillingHistory(tenantId: string): BillingInvoice[] {
    const sub = entitlementService.getSubscription(tenantId);
    const plan = PLANS_CATALOG[sub?.planId || PlanCode.STARTER];

    return [
      {
        id: `bill-${tenantId}-2026-08`,
        tenantId,
        invoiceNumber: `INV-TAXFLOW-${tenantId.toUpperCase()}-2608`,
        period: '2026-08',
        amountInr: plan.monthlyPriceInr,
        taxInr: Math.round(plan.monthlyPriceInr * 0.18),
        totalInr: Math.round(plan.monthlyPriceInr * 1.18),
        status: 'PAID',
        paidAt: '2026-08-01T09:00:00.000Z',
        invoicePdfUrl: `/tenants/${tenantId}/invoices/bill-2026-08.pdf`
      }
    ];
  }
}

export * from './SubscriptionManager';
export * from './PlanGuard';

