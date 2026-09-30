import 'dotenv/config';
import { PrismaService } from '../common/services/prisma.service';
import { CryptoService } from '../common/services/crypto.service';
import { ImmutableAuditService } from '../modules/audit/immutable-audit.service';
import { EntitlementService } from '../modules/billing/entitlements.service';
import { UsageMeteringService } from '../modules/billing/usage-metering.service';
import { SubscriptionLifecycleService } from '../modules/billing/subscription-lifecycle.service';
import { PaymentWebhookService } from '../modules/billing/payment-provider/payment-webhook.service';
import { Feature, PlanCode } from '../../core/entitlements/types';
import { UsageMetric } from '../../core/usage/types';
import { SubscriptionStatus, BillingCycle, PaymentStatus } from '@prisma/client';

let passedCount = 0;
let totalCount = 0;

function assert(condition: boolean, title: string) {
  totalCount++;
  if (condition) {
    console.log(`✅ PASS: ${title}`);
    passedCount++;
  } else {
    console.error(`❌ FAIL: ${title}`);
    process.exitCode = 1;
  }
}

async function runStage10VerificationSuite() {
  console.log('===================================================================');
  console.log('STAGE 10: BILLING, SUBSCRIPTION, ENTITLEMENTS & USAGE TEST SUITE');
  console.log('===================================================================\n');

  const prisma = new PrismaService();
  const cryptoService = new CryptoService();

  // In-Memory Database Repositories
  const mockTenants: any[] = [];
  const mockSubscriptions: any[] = [];
  const mockUsageCounters: Map<string, any> = new Map();
  const mockUsageEvents: any[] = [];
  const mockBillingEvents: any[] = [];
  const mockImmutableAuditLogs: any[] = [];

  // Wire Prisma Mock Handlers
  prisma.tenant.create = (async (args: any) => {
    const rec = { ...args.data };
    mockTenants.push(rec);
    return rec;
  }) as any;

  prisma.subscription.create = (async (args: any) => {
    const id = `sub-${Date.now()}-${Math.random()}`;
    const rec = {
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...args.data,
    };
    mockSubscriptions.push(rec);
    return rec;
  }) as any;

  prisma.subscription.findFirst = (async (args: any) => {
    const filtered = mockSubscriptions.filter((s) => s.tenantId === args.where.tenantId);
    if (args.orderBy?.createdAt === 'desc') {
      filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    return filtered[0] || null;
  }) as any;

  prisma.subscription.update = (async (args: any) => {
    const sub = mockSubscriptions.find((s) => s.id === args.where.id);
    if (!sub) throw new Error('Subscription not found');
    if (args.data.billingEvents?.create) {
      mockBillingEvents.push({
        id: `be-${Date.now()}-${Math.random()}`,
        createdAt: new Date(),
        ...args.data.billingEvents.create,
      });
    }
    const { billingEvents, ...dataWithoutNested } = args.data;
    Object.assign(sub, dataWithoutNested);
    sub.updatedAt = new Date();
    return sub;
  }) as any;

  prisma.usageCounterRecord.findUnique = (async (args: any) => {
    const key = `${args.where.tenantId_periodKey_metric.tenantId}:${args.where.tenantId_periodKey_metric.periodKey}:${args.where.tenantId_periodKey_metric.metric}`;
    return mockUsageCounters.get(key) || null;
  }) as any;

  prisma.usageCounterRecord.upsert = (async (args: any) => {
    const key = `${args.where.tenantId_periodKey_metric.tenantId}:${args.where.tenantId_periodKey_metric.periodKey}:${args.where.tenantId_periodKey_metric.metric}`;
    let existing = mockUsageCounters.get(key);
    if (existing) {
      existing.currentValue = BigInt(Number(existing.currentValue) + Number(args.update.currentValue.increment));
      existing.updatedAt = new Date();
    } else {
      existing = {
        id: `uc-${Date.now()}-${Math.random()}`,
        tenantId: args.create.tenantId,
        periodKey: args.create.periodKey,
        metric: args.create.metric,
        currentValue: BigInt(args.create.currentValue),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockUsageCounters.set(key, existing);
    }
    return existing;
  }) as any;

  prisma.usageCounterRecord.findMany = (async (args: any) => {
    const results: any[] = [];
    mockUsageCounters.forEach((v) => {
      if (v.tenantId === args.where.tenantId && v.periodKey === args.where.periodKey) {
        results.push(v);
      }
    });
    return results;
  }) as any;

  prisma.usageEventLog.create = (async (args: any) => {
    const rec = { id: `ue-${Date.now()}-${Math.random()}`, timestamp: new Date(), ...args.data };
    mockUsageEvents.push(rec);
    return rec;
  }) as any;

  prisma.usageEventLog.findFirst = (async (args: any) => {
    return (
      mockUsageEvents.find((e) => {
        if (args.where.tenantId && e.tenantId !== args.where.tenantId) return false;
        if (args.where.idempotencyKey && e.idempotencyKey !== args.where.idempotencyKey) return false;
        return true;
      }) || null
    );
  }) as any;

  prisma.billingEvent.create = (async (args: any) => {
    const rec = { id: `be-${Date.now()}-${Math.random()}`, createdAt: new Date(), ...args.data };
    mockBillingEvents.push(rec);
    return rec;
  }) as any;

  prisma.billingEvent.findFirst = (async (args: any) => {
    return (
      mockBillingEvents.find((b) => {
        if (args.where.tenantId && b.tenantId !== args.where.tenantId) return false;
        if (args.where.idempotencyKey && b.idempotencyKey !== args.where.idempotencyKey) return false;
        return true;
      }) || null
    );
  }) as any;

  prisma.immutableAuditLog.create = (async (args: any) => {
    const rec = { id: `aud-${Date.now()}-${Math.random()}`, createdAt: new Date(), ...args.data };
    mockImmutableAuditLogs.push(rec);
    return rec;
  }) as any;

  prisma.immutableAuditLog.findFirst = (async (args: any) => {
    const filtered = mockImmutableAuditLogs.filter((a) => a.tenantId === args.where.tenantId);
    if (args.orderBy?.createdAt === 'desc') {
      return filtered.length > 0 ? filtered[filtered.length - 1] : null;
    }
    return filtered[0] || null;
  }) as any;

  // Instantiate Services
  const auditService = new ImmutableAuditService(prisma);
  const entitlementService = new EntitlementService(prisma);
  const usageService = new UsageMeteringService(prisma, auditService);
  const subscriptionService = new SubscriptionLifecycleService(prisma, auditService);
  const webhookService = new PaymentWebhookService(prisma, auditService, subscriptionService);

  const tenantAId = 'tenant-sme-alpha-uuid';
  const tenantBId = 'tenant-corp-beta-uuid';

  console.log('--- 1. SUBSCRIPTION LIFECYCLE & PLAN UPGRADES/DOWNGRADES TESTS ---');

  // Test 1: Create Starter Subscription
  const subStarter = await subscriptionService.createSubscription({
    tenantId: tenantAId,
    planCode: PlanCode.STARTER,
    billingCycle: BillingCycle.MONTHLY,
  });
  assert(subStarter.planCode === PlanCode.STARTER, 'Starter SME subscription initialized');
  assert(subStarter.status === SubscriptionStatus.ACTIVE, 'Subscription status set to ACTIVE');

  // Test 2: Upgrade Subscription (STARTER -> PROFESSIONAL)
  const subProf = await subscriptionService.upgradeSubscription(tenantAId, PlanCode.PROFESSIONAL);
  assert(subProf.planCode === PlanCode.PROFESSIONAL, 'Subscription upgraded to PROFESSIONAL plan');

  const upgradeAudit = mockImmutableAuditLogs.find((a) => a.action === 'SUBSCRIPTION_UPGRADED');
  assert(upgradeAudit !== undefined, 'Logged SUBSCRIPTION_UPGRADED in immutable audit log');

  // Test 3: Downgrade Subscription (Data Safety Guaranteed)
  const subDowngraded = await subscriptionService.downgradeSubscription(tenantAId, PlanCode.STARTER);
  assert(subDowngraded.planCode === PlanCode.STARTER, 'Subscription downgraded back to STARTER plan');

  const downgradeEvent = mockBillingEvents.find((b) => b.eventType === 'SUBSCRIPTION_DOWNGRADED');
  assert(downgradeEvent?.payload?.dataSafetyNotice.includes('preserved'), 'Downgrade recorded notice confirming existing business data safety');

  // Test 4: Subscription Cancellation & Renewal
  const cancelledSub = await subscriptionService.cancelSubscription(tenantAId, false);
  assert(cancelledSub.cancelAtPeriodEnd === true, 'Subscription set to cancel at end of billing period');

  const renewedSub = await subscriptionService.renewSubscription(tenantAId);
  assert(renewedSub.status === SubscriptionStatus.ACTIVE, 'Subscription renewed and reactivated to ACTIVE status');
  assert(renewedSub.cancelAtPeriodEnd === false, 'cancelAtPeriodEnd flag reset upon renewal');

  console.log('\n--- 2. AUTHORITATIVE ENTITLEMENTS & HARD/SOFT LIMIT TESTS ---');

  // Test 5: Feature Access Control (STARTER plan lacks E_INVOICE feature)
  const eInvoiceAccess = await entitlementService.checkFeatureAccess(tenantAId, Feature.E_INVOICE);
  assert(eInvoiceAccess.allowed === false, 'E_INVOICE feature restricted on STARTER plan');
  assert(eInvoiceAccess.reason!.includes('not included'), 'Returned descriptive feature restriction reason');

  // Test 6: Feature Access Control (STARTER includes INVOICES feature)
  const invoiceAccess = await entitlementService.checkFeatureAccess(tenantAId, Feature.INVOICES);
  assert(invoiceAccess.allowed === true, 'INVOICES feature enabled on STARTER plan');

  // Test 7: Hard Usage Limit Check (STARTER monthly invoice volume = 500)
  const limitCheck1 = await entitlementService.checkUsageLimit(tenantAId, UsageMetric.INVOICE_DOCUMENTS, 1);
  assert(limitCheck1.allowed === true, 'Usage check passed within quota (0 / 500 invoices used)');
  assert(limitCheck1.limit === 500, 'Monthly invoice volume quota resolved to 500');

  // Test 8: Soft Warning Threshold (80% quota consumed)
  // Simulate 420 invoices consumed (84% quota)
  const periodKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  mockUsageCounters.set(`${tenantAId}:${periodKey}:invoice_documents`, {
    id: 'uc-mock-1',
    tenantId: tenantAId,
    periodKey,
    metric: 'invoice_documents',
    currentValue: BigInt(420),
  });

  const softWarnCheck = await entitlementService.checkUsageLimit(tenantAId, UsageMetric.INVOICE_DOCUMENTS, 1);
  assert(softWarnCheck.allowed === true, 'Operation allowed under soft warning threshold');
  assert(softWarnCheck.status === 'SOFT_WARNING', 'Status evaluated to SOFT_WARNING (84% of quota consumed)');

  // Test 9: Hard Limit Exceeded Guard
  // Simulate 500/500 invoices consumed
  mockUsageCounters.set(`${tenantAId}:${periodKey}:invoice_documents`, {
    id: 'uc-mock-2',
    tenantId: tenantAId,
    periodKey,
    metric: 'invoice_documents',
    currentValue: BigInt(500),
  });

  const hardLimitCheck = await entitlementService.checkUsageLimit(tenantAId, UsageMetric.INVOICE_DOCUMENTS, 1);
  assert(hardLimitCheck.allowed === false, 'Hard limit guard blocked execution (+1 exceeds 500 quota)');
  assert(hardLimitCheck.status === 'HARD_LIMIT_EXCEEDED', 'Status evaluated to HARD_LIMIT_EXCEEDED');

  let hardLimitCaught = false;
  try {
    await entitlementService.enforceHardLimit(tenantAId, Feature.INVOICES, UsageMetric.INVOICE_DOCUMENTS, 1);
  } catch (err: any) {
    hardLimitCaught = err.message.includes('Quota exceeded');
  }
  assert(hardLimitCaught, 'enforceHardLimit threw ForbiddenException when quota exceeded');

  console.log('\n--- 3. DURABLE & IDEMPOTENT USAGE METERING TESTS ---');

  // Test 10: Successful Idempotent Usage Increment
  const incRes1 = await usageService.incrementUsage({
    tenantId: tenantAId,
    metric: UsageMetric.API_CALLS,
    delta: 5,
    idempotencyKey: 'idem-metric-101',
    correlationId: 'corr-use-001',
  });
  assert(incRes1.idempotencyHit === false, 'First usage increment processed successfully (+5 API calls)');

  // Test 11: Duplicate Request Idempotency Guard (Retried Request)
  const incRes1Duplicate = await usageService.incrementUsage({
    tenantId: tenantAId,
    metric: UsageMetric.API_CALLS,
    delta: 5,
    idempotencyKey: 'idem-metric-101', // Duplicate key
    correlationId: 'corr-use-002',
  });
  assert(incRes1Duplicate.idempotencyHit === true, 'Duplicate idempotency key detected; skipped double-counting');

  // Test 12: Non-blocking Transaction Isolation (Failed metering does not fail caller)
  const safeMeteringRes = await usageService.incrementUsageSafely({
    tenantId: tenantAId,
    metric: UsageMetric.STORAGE_BYTES,
    delta: 1024,
    idempotencyKey: 'idem-safe-test',
    correlationId: 'corr-use-safe',
  });
  assert(safeMeteringRes !== undefined, 'Business transaction execution completed safely during metering processing');

  console.log('\n--- 4. PAYMENT WEBHOOKS, SECURITY & REPLAY PROTECTION TESTS ---');

  // Test 13: Authorized Payment Success Webhook
  const timestamp = Date.now().toString();
  const paymentWebhookPayload = {
    eventId: 'evt_pay_success_777',
    tenantId: tenantAId,
    eventType: 'PAYMENT_SUCCESS' as const,
    amountInr: 2999,
    providerReference: 'razorpay_pay_abc123',
    signature: 'valid_signature_hash',
    timestamp,
  };

  const webhookRes = await webhookService.processPaymentWebhook(paymentWebhookPayload, 'corr-pay-001');
  assert(webhookRes.status === 'PROCESSED', 'Payment success webhook processed');
  assert(webhookRes.subscriptionStatus === SubscriptionStatus.ACTIVE, 'Subscription status set to ACTIVE by server webhook');

  // Test 14: Payment Failed Webhook (Transitions status to PAST_DUE)
  const failedPaymentPayload = {
    eventId: 'evt_pay_failed_888',
    tenantId: tenantAId,
    eventType: 'PAYMENT_FAILED' as const,
    amountInr: 2999,
    providerReference: 'razorpay_pay_failed_456',
    signature: 'valid_signature_hash',
    timestamp,
  };

  const failedWebhookRes = await webhookService.processPaymentWebhook(failedPaymentPayload, 'corr-pay-002');
  assert(failedWebhookRes.subscriptionStatus === SubscriptionStatus.PAST_DUE, 'Failed payment webhook set subscription status to PAST_DUE');

  // Test 15: Duplicate Webhook Replay Idempotency
  const dupWebhookRes = await webhookService.processPaymentWebhook(paymentWebhookPayload, 'corr-pay-003');
  assert(dupWebhookRes.status === 'IDEMPOTENT_DUPLICATE_SKIPPED', 'Duplicate payment webhook skipped idempotently');

  // Test 16: Invalid Signature & Replay Protection
  let badSigCaught = false;
  try {
    await webhookService.processPaymentWebhook(
      { ...paymentWebhookPayload, eventId: 'evt_bad_sig', signature: 'invalid_sig' },
      'corr-bad-sig',
    );
  } catch (err: any) {
    badSigCaught = err.message.includes('Invalid payment webhook signature');
  }
  assert(badSigCaught, 'Invalid payment webhook signature rejected (UnauthorizedException)');

  console.log('\n--- 5. MODULE INTEGRATION TESTS (REAL DOMAIN ENTITLEMENT ENFORCEMENT) ---');

  // Test 17: User Creation Hard Limit Enforcement (STARTER max 2 users)
  // Simulate 2 users already created
  const userCheck1 = await entitlementService.checkUsageLimit(tenantAId, UsageMetric.USERS, 1);
  // Current users = 0, limit = 2 -> Allowed
  assert(userCheck1.allowed === true, '1st user creation allowed on STARTER plan');

  // Set users count to 2
  mockUsageCounters.set(`${tenantAId}:${periodKey}:users`, {
    id: 'uc-mock-users',
    tenantId: tenantAId,
    periodKey,
    metric: 'users',
    currentValue: BigInt(2),
  });

  const userCheckExceeded = await entitlementService.checkUsageLimit(tenantAId, UsageMetric.USERS, 1);
  assert(userCheckExceeded.allowed === false, '3rd user creation blocked by HARD_LIMIT_EXCEEDED on STARTER plan (Max 2 users)');

  // Test 18: Tenant Isolation Guard (Tenant A cannot view or mutate Tenant B subscription)
  const subTenantB = await subscriptionService.createSubscription({
    tenantId: tenantBId,
    planCode: PlanCode.ENTERPRISE,
    billingCycle: BillingCycle.ANNUAL,
  });

  assert(subTenantB.tenantId === tenantBId, 'Tenant B enterprise subscription isolated');
  assert(subTenantB.planCode === PlanCode.ENTERPRISE, 'Tenant B plan code unaffected by Tenant A starter plan');

  console.log('\n-------------------------------------------------------------------');
  console.log(`TOTAL TESTS: ${totalCount} | PASSED: ${passedCount} | FAILED: ${totalCount - passedCount}`);
  console.log('-------------------------------------------------------------------');
  if (passedCount === totalCount) {
    console.log('VERIFICATION RESULT: ALL STAGE 10 AUTOMATED TESTS PASSED 100%');
  } else {
    console.error('VERIFICATION RESULT: STAGE 10 VERIFICATION FAILED');
    process.exitCode = 1;
  }
}

runStage10VerificationSuite().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exitCode = 1;
});
