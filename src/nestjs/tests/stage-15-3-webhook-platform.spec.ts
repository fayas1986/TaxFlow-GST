import { SsrfGuardService } from '../modules/webhooks/ssrf-guard.service';
import { WebhookSignerService } from '../modules/webhooks/webhook-signer.service';
import { WebhookSubscriptionService } from '../modules/webhooks/webhook-subscription.service';
import { WebhookDispatcherService } from '../modules/webhooks/webhook-dispatcher.service';
import { CryptographyService } from '../modules/security/cryptography.service';
import { buildCanonicalEvent } from '../modules/events/dto/canonical-event.dto';
import { PrismaService } from '../common/services/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

let passed = 0;
let total = 0;

function assert(condition: boolean, description: string) {
  total++;
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    process.exitCode = 1;
  }
}

async function runStage15_3Tests() {
  console.log('================================================================');
  console.log('  STAGE 15.3 — WEBHOOK PLATFORM & HMAC SECURITY TEST SUITE  ');
  console.log('================================================================\n');

  const ssrfGuard = new SsrfGuardService();
  const cryptoService = new CryptographyService();
  const signerService = new WebhookSignerService(cryptoService);

  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';

  // --- SECTION 1: SSRF Guard & HTTPS Enforcement ---
  console.log('--- SECTION 1: SSRF Guard & HTTPS Enforcement ---');
  const validHttps = ssrfGuard.validateWebhookUrl('https://api.customer.com/webhooks/gst');
  assert(validHttps.isValid, 'HTTPS public webhook URL accepted');

  try {
    ssrfGuard.validateWebhookUrl('http://api.customer.com/webhooks/gst');
    assert(false, 'HTTP target URL must be rejected');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'HTTP URL throws BadRequestException (HTTPS Enforced)');
  }

  try {
    ssrfGuard.validateWebhookUrl('https://127.0.0.1/admin');
    assert(false, 'Loopback IP target URL must be rejected');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Loopback IP throws BadRequestException (SSRF Guard)');
  }

  try {
    ssrfGuard.validateWebhookUrl('https://169.254.169.254/latest/meta-data/');
    assert(false, 'AWS Instance Metadata IMDS IP target URL must be rejected');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Cloud IMDS IP throws BadRequestException (SSRF Guard)');
  }

  // --- SECTION 2: HMAC SHA-256 Signing & Replay Protection ---
  console.log('\n--- SECTION 2: HMAC SHA-256 Signing & Replay Protection ---');
  const secretKey = signerService.generateSecretKey();
  assert(secretKey.startsWith('whsec_'), 'Generated secret key has expected whsec_ prefix');

  const payloadStr = JSON.stringify({ event: 'test', amount: 500 });
  const timestampSeconds = Math.floor(Date.now() / 1000);

  const signatureHeader = signerService.computeSignature(secretKey, payloadStr, timestampSeconds);
  assert(signatureHeader.includes('t='), 'Signature header includes timestamp (t=)');
  assert(signatureHeader.includes('v1='), 'Signature header includes HMAC SHA-256 hash (v1=)');

  const isValidSig = signerService.verifySignature(secretKey, payloadStr, signatureHeader);
  assert(isValidSig === true, 'HMAC SHA-256 signature verification succeeds');

  const isTamperedSig = signerService.verifySignature(secretKey, JSON.stringify({ event: 'test', amount: 9999 }), signatureHeader);
  assert(isTamperedSig === false, 'Tampered payload fails HMAC signature verification');

  // Replay Attack Timestamp Verification (> 5 min old)
  const oldTimestamp = timestampSeconds - 400; // 6.6 minutes old
  const oldSigHeader = signerService.computeSignature(secretKey, payloadStr, oldTimestamp);
  const isExpiredSig = signerService.verifySignature(secretKey, payloadStr, oldSigHeader, 300);
  assert(isExpiredSig === false, 'Replay attack prevented for timestamps older than 5 minutes');

  // Encryption at Rest Verification (AES-256-GCM)
  const encryptedSecret = signerService.encryptSecretKey(secretKey, tenantA);
  assert(encryptedSecret !== secretKey, 'Secret key encrypted at rest');
  const decryptedSecret = signerService.decryptSecretKey(encryptedSecret, tenantA);
  assert(decryptedSecret === secretKey, 'Encrypted secret key cleanly decrypted using AAD tenantId');

  // --- SECTION 3: Subscriptions & DB Mock Integration ---
  console.log('\n--- SECTION 3: Subscriptions & Delivery Log Persistence ---');
  const dbSubs: Map<string, any> = new Map();
  const dbLogs: any[] = [];

  const mockPrisma = {
    webhookSubscription: {
      create: async ({ data }: any) => {
        const id = 'sub-' + Math.random().toString(36).substring(7);
        const record = { ...data, id, createdAt: new Date(), updatedAt: new Date() };
        dbSubs.set(id, record);
        return record;
      },
      findMany: async ({ where }: any) => {
        return Array.from(dbSubs.values()).filter(
          (s) => s.tenantId === where.tenantId && (where.status ? s.status === where.status : true),
        );
      },
      findFirst: async ({ where }: any) => {
        for (const s of dbSubs.values()) {
          if (s.id === where.id && s.tenantId === where.tenantId) return s;
        }
        return null;
      },
      update: async ({ where, data }: any) => {
        const s = dbSubs.get(where.id);
        if (s) {
          const updated = { ...s, ...data };
          dbSubs.set(where.id, updated);
          return updated;
        }
        return null;
      },
    },
    webhookDeliveryLog: {
      create: async ({ data }: any) => {
        dbLogs.push({ ...data, id: 'log-' + Math.random() });
        return data;
      },
    },
  } as unknown as PrismaService;

  const mockAuditService = { logEvent: async () => {} } as any;
  const mockOutboxProcessor = { subscribe: () => {} } as any;

  const subService = new WebhookSubscriptionService(mockPrisma, ssrfGuard, signerService);
  const dispatcherService = new WebhookDispatcherService(
    mockPrisma,
    mockOutboxProcessor,
    signerService,
    ssrfGuard,
    mockAuditService,
  );

  const subCreated = await subService.createSubscription(tenantA, {
    name: 'ERP Webhook',
    targetUrl: 'https://api.customer.com/webhooks/einvoice',
    events: ['taxflow.einvoice.irn_generated'],
  });

  assert(subCreated.targetUrl === 'https://api.customer.com/webhooks/einvoice', 'Webhook subscription target URL stored');
  assert(Boolean(subCreated.secretKey), 'Plain secret key returned ONCE upon creation');

  // --- SECTION 4: Canonical Event Dispatch & HTTP Response Handling ---
  console.log('\n--- SECTION 4: Event Dispatch & Retry/DLQ State Machine ---');
  const canonicalEvent = buildCanonicalEvent({
    eventId: 'evt_test_001',
    eventType: 'taxflow.einvoice.irn_generated',
    tenantId: tenantA,
    aggregateType: 'INVOICE',
    aggregateId: 'inv_100',
    correlationId: 'req_100',
    payload: { irn: '3a5b7c8d9e0f' },
  });

  // Test Successful Delivery (HTTP 200)
  const mockHttpSuccess = async (url: string, headers: any, payload: string) => {
    assert(headers['X-TaxFlow-Signature'].includes('v1='), 'HTTP headers include HMAC signature');
    assert(headers['X-Tenant-ID'] === tenantA, 'HTTP headers include X-Tenant-ID');
    return { status: 200, body: JSON.stringify({ ok: true }) };
  };

  const subRecord = await mockPrisma.webhookSubscription.findFirst({ where: { id: subCreated.id, tenantId: tenantA } });
  const deliveryRes = await dispatcherService.deliverWebhookAttempt(subRecord, canonicalEvent, 1, mockHttpSuccess);
  assert(deliveryRes.success === true, 'Webhook delivery succeeds on HTTP 200');

  const successLog = dbLogs.find((l) => l.eventId === 'evt_test_001');
  assert(successLog.status === 'DELIVERED', 'Delivery status marked DELIVERED');
  assert(successLog.responseStatus === 200, 'Delivery log captures HTTP 200 response status');

  // Test Permanent Failure (HTTP 404) -> Immediate DEAD_LETTER
  const mockHttpPermanentFail = async () => ({ status: 404, body: 'Not Found' });
  const canonicalEvent2 = buildCanonicalEvent({
    eventId: 'evt_test_002',
    eventType: 'taxflow.einvoice.irn_generated',
    tenantId: tenantA,
    aggregateType: 'INVOICE',
    aggregateId: 'inv_200',
    correlationId: 'req_200',
    payload: { irn: '3a5b7c8d9e0f2' },
  });

  const permFailRes = await dispatcherService.deliverWebhookAttempt(subRecord, canonicalEvent2, 1, mockHttpPermanentFail);
  assert(permFailRes.success === false, 'Webhook delivery fails on HTTP 404');
  const deadLetterLog = dbLogs.find((l) => l.eventId === 'evt_test_002');
  assert(deadLetterLog.status === 'DEAD_LETTER', 'Permanent HTTP 404 failure transitions status immediately to DEAD_LETTER');

  // --- SECTION 5: Retryable Paths & DNS Rebinding Hardening Evidence ---
  console.log('\n--- SECTION 5: Retryable Paths & DNS Rebinding Hardening Evidence ---');
  
  // 1. DNS Rebinding Verification
  try {
    ssrfGuard.validateResolvedDnsIp('127.0.0.1');
    assert(false, 'DNS rebinding validation must reject 127.0.0.1');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'DNS rebinding rejects resolved 127.0.0.1 (Loopback)');
  }

  try {
    ssrfGuard.validateResolvedDnsIp('10.0.0.55');
    assert(false, 'DNS rebinding validation must reject 10.0.0.55');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'DNS rebinding rejects resolved 10.0.0.55 (Private Subnet)');
  }

  try {
    ssrfGuard.validateResolvedDnsIp('93.184.216.34');
    assert(true, 'DNS rebinding accepts resolved public IP 93.184.216.34');
  } catch (err: any) {
    assert(false, 'DNS rebinding threw on valid public IP');
  }

  // 2. HTTP 5xx -> Retryable FAILED state
  const mockHttp500 = async () => ({ status: 500, body: 'Internal Server Error' });
  const event500 = buildCanonicalEvent({
    eventId: 'evt_test_500',
    eventType: 'taxflow.einvoice.irn_generated',
    tenantId: tenantA,
    aggregateType: 'INVOICE',
    aggregateId: 'inv_500',
    correlationId: 'req_500',
    payload: {},
  });
  const res500 = await dispatcherService.deliverWebhookAttempt(subRecord, event500, 1, mockHttp500);
  assert(res500.success === false, 'HTTP 500 delivery returns success=false');
  const log500 = dbLogs.find((l) => l.eventId === 'evt_test_500');
  assert(log500.status === 'FAILED', 'HTTP 500 attempt 1 sets status to FAILED (Retryable Path)');

  // 3. HTTP 429 -> Retryable FAILED state with Retry-After header
  const mockHttp429 = async () => ({ status: 429, body: 'Rate Limit Exceeded', headers: { 'retry-after': '60' } });
  const event429 = buildCanonicalEvent({
    eventId: 'evt_test_429',
    eventType: 'taxflow.einvoice.irn_generated',
    tenantId: tenantA,
    aggregateType: 'INVOICE',
    aggregateId: 'inv_429',
    correlationId: 'req_429',
    payload: {},
  });
  const res429 = await dispatcherService.deliverWebhookAttempt(subRecord, event429, 1, mockHttp429);
  assert(res429.success === false, 'HTTP 429 delivery returns success=false');
  assert(res429.retryAfter === 60, 'HTTP 429 correctly extracts Retry-After header (60s)');
  const log429 = dbLogs.find((l) => l.eventId === 'evt_test_429');
  assert(log429.status === 'FAILED', 'HTTP 429 attempt 1 sets status to FAILED (Retryable Path)');

  // 4. Maximum retry attempts (attempt 5) -> DEAD_LETTER
  const resMaxRetry = await dispatcherService.deliverWebhookAttempt(subRecord, event500, 5, mockHttp500);
  assert(resMaxRetry.success === false, 'Attempt 5 delivery returns success=false');
  const logMaxRetry = dbLogs.filter((l) => l.eventId === 'evt_test_500').find((l) => l.attemptNumber === 5);
  assert(logMaxRetry.status === 'DEAD_LETTER', 'Attempt 5 failure transitions status to DEAD_LETTER (Max Retries Exhausted)');

  // 5. Independent delivery attempts & Retry count persistence
  const attempt3Res = await dispatcherService.deliverWebhookAttempt(subRecord, event500, 3, mockHttp500);
  const logAttempt3 = dbLogs.find((l) => l.eventId === 'evt_test_500' && l.attemptNumber === 3);
  assert(Boolean(logAttempt3), 'Each delivery attempt recorded independently');
  assert(logAttempt3.attemptNumber === 3, 'Retry count (attemptNumber=3) persisted correctly in delivery log');

  // --- SECTION 6: Tenant Isolation ---
  console.log('\n--- SECTION 6: Tenant Isolation Verification ---');
  const tenantBEvent = buildCanonicalEvent({
    eventId: 'evt_tenantB_001',
    eventType: 'taxflow.einvoice.irn_generated',
    tenantId: tenantB,
    aggregateType: 'INVOICE',
    aggregateId: 'inv_B',
    correlationId: 'req_B',
    payload: {},
  });

  const dispatchResult = await dispatcherService.dispatchIntegrationEventToWebhooks(tenantBEvent);
  assert(dispatchResult.dispatched === 0, 'Tenant B event zero dispatches to Tenant A webhook subscriptions (Tenant Isolation Enforced)');

  console.log('\n================================================================');
  console.log(`  STAGE 15.3 TEST SUMMARY: ${passed}/${total} PASSED (100%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runStage15_3Tests().catch((err) => {
  console.error('Stage 15.3 test runner failed:', err);
  process.exit(1);
});
