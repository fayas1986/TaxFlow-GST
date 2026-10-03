import { GenericRestAdapter, GenericRestConfig } from '../modules/erp-adapter-framework/adapters/generic-rest.adapter';
import { SsrfGuardService } from '../modules/webhooks/ssrf-guard.service';
import { CanonicalERPInvoiceDto } from '../modules/erp-adapter-framework/interfaces/erp-adapter.interface';
import { ERPProviderException } from '../modules/erp-adapter-framework/exceptions/erp-provider.exception';
import { BadRequestException } from '@nestjs/common';

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

async function runStage15_5_2_Tests() {
  console.log('================================================================');
  console.log('  STAGE 15.5.2 — GENERIC REST ADAPTER TEST SUITE  ');
  console.log('================================================================\n');

  const ssrfGuard = new SsrfGuardService();
  const adapter = new GenericRestAdapter(ssrfGuard);
  const tenantA = '11111111-1111-1111-1111-111111111111';

  // Mock Http Dispatcher
  let lastCapturedHeaders: Record<string, string> = {};
  let mockHttpResponseStatus = 200;
  let mockHttpResponseBody = JSON.stringify({ id: 'ext_inv_9999' });
  let mockHttpResponseHeaders: Record<string, string> = {};

  adapter.setHttpDispatcher(async (url, method, headers, body) => {
    lastCapturedHeaders = headers;
    return {
      status: mockHttpResponseStatus,
      body: mockHttpResponseBody,
      headers: mockHttpResponseHeaders,
    };
  });

  // --- SECTION 1: Base URL Security & SSRF Protection ---
  console.log('--- SECTION 1: Base URL Security & SSRF Protection ---');
  const validConfig: GenericRestConfig = {
    baseUrl: 'https://api.erp.customer.com',
    authType: 'API_KEY',
    apiKey: 'secret_key_12345',
  };

  const connectRes = await adapter.connect(validConfig);
  assert(connectRes === true, 'HTTPS public baseUrl connects successfully');

  try {
    await adapter.connect({ baseUrl: 'http://127.0.0.1/admin', authType: 'API_KEY', apiKey: 'key' });
    assert(false, 'Loopback IP baseUrl must be rejected');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Loopback IP throws BadRequestException (SSRF Guard)');
  }

  try {
    await adapter.connect({ baseUrl: 'https://169.254.169.254/latest', authType: 'API_KEY', apiKey: 'key' });
    assert(false, 'IMDS metadata IP baseUrl must be rejected');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Cloud IMDS IP throws BadRequestException (SSRF Guard)');
  }

  // --- SECTION 2: Authentication Strategy Header Generation ---
  console.log('\n--- SECTION 2: Authentication Strategy Header Generation ---');
  
  // 1. API_KEY Auth
  await adapter.connect({ baseUrl: 'https://api.erp.customer.com', authType: 'API_KEY', apiKey: 'my_api_key_777', apiKeyHeader: 'X-Vendor-Key' });
  const invoiceDummy: CanonicalERPInvoiceDto = {
    invoiceNumber: 'INV-REST-001',
    invoiceDate: '2026-10-03',
    tenantId: tenantA,
    entityType: 'INVOICE',
    direction: 'OUTBOUND',
    sellerGstin: '27AAAAA0000A1Z5',
    buyerGstin: '27BBBBB1111B1Z2',
    buyerName: 'Beta Corp',
    placeOfSupply: '27',
    taxableValue: 5000,
    cgstTotal: 450,
    sgstTotal: 450,
    igstTotal: 0,
    totalValue: 5900,
    items: [],
  };

  await adapter.push(invoiceDummy);
  assert(lastCapturedHeaders['X-Vendor-Key'] === 'my_api_key_777', 'API_KEY auth sets custom X-Vendor-Key header');

  // 2. BEARER Auth
  await adapter.connect({ baseUrl: 'https://api.erp.customer.com', authType: 'BEARER', bearerToken: 'token_abc_123' });
  await adapter.push(invoiceDummy);
  assert(lastCapturedHeaders['Authorization'] === 'Bearer token_abc_123', 'BEARER auth sets Authorization: Bearer header');

  // 3. BASIC Auth
  await adapter.connect({ baseUrl: 'https://api.erp.customer.com', authType: 'BASIC', username: 'admin', password: 'secretpassword' });
  await adapter.push(invoiceDummy);
  assert(lastCapturedHeaders['Authorization'].startsWith('Basic '), 'BASIC auth sets Authorization: Basic header');

  // 4. OAUTH2 Auth
  await adapter.connect({ baseUrl: 'https://api.erp.customer.com', authType: 'OAUTH2', oauth2ClientId: 'client_id_007', oauth2ClientSecret: 'secret_007' });
  await adapter.push(invoiceDummy);
  assert(lastCapturedHeaders['Authorization'].includes('oauth_simulated_token_client_id_007'), 'OAUTH2 auth acquires and sets Bearer token');

  // --- SECTION 3: Connection Testing & Health Checks ---
  console.log('\n--- SECTION 3: Connection Testing & Health Checks ---');
  mockHttpResponseStatus = 200;
  const testRes = await adapter.testConnection(validConfig);
  assert(testRes.success === true, 'testConnection returns success=true on HTTP 200');
  assert(testRes.latencyMs >= 0, 'testConnection measures latency');

  mockHttpResponseStatus = 401;
  const testFailRes = await adapter.testConnection(validConfig);
  assert(testFailRes.success === false, 'testConnection returns success=false on HTTP 401');
  mockHttpResponseStatus = 200;

  const healthRes = await adapter.healthCheck();
  assert(healthRes.status === 'HEALTHY', 'healthCheck returns HEALTHY status on HTTP 200');

  mockHttpResponseStatus = 429;
  const healthDegraded = await adapter.healthCheck();
  assert(healthDegraded.status === 'DEGRADED', 'healthCheck returns DEGRADED status on HTTP 429');
  mockHttpResponseStatus = 200;

  // --- SECTION 4: Push / Pull Invoice Sync Operations ---
  console.log('\n--- SECTION 4: Push / Pull Invoice Sync Operations ---');
  mockHttpResponseBody = JSON.stringify({ externalId: 'ext_inv_9999' });
  const pushRes = await adapter.push(invoiceDummy);
  assert(pushRes.success === true, 'push returns success=true on HTTP 201');
  assert(pushRes.externalId === 'ext_inv_9999', 'push extracts external ID from response');
  assert(pushRes.status === 'POSTED', 'push sets status to POSTED');
  assert(lastCapturedHeaders['X-Tenant-ID'] === tenantA, 'push includes X-Tenant-ID header');
  assert(Boolean(lastCapturedHeaders['X-Correlation-ID']), 'push includes X-Correlation-ID header');

  // Duplicate record test (HTTP 409)
  mockHttpResponseStatus = 409;
  const dupRes = await adapter.push(invoiceDummy);
  assert(dupRes.success === false, 'Duplicate push returns success=false');
  assert(dupRes.status === 'DUPLICATE_RECORD', 'Duplicate push returns status=DUPLICATE_RECORD');
  mockHttpResponseStatus = 200;

  // Pull records test
  mockHttpResponseBody = JSON.stringify([
    { invoiceNumber: 'INV-EXT-101', taxableValue: 2000, totalValue: 2360 },
    { invoiceNumber: 'INV-EXT-102', taxableValue: 3000, totalValue: 3540 },
  ]);

  const pulledItems = await adapter.pull({});
  assert(pulledItems.length === 2, 'pull returns 2 mapped canonical invoices');
  assert(pulledItems[0].invoiceNumber === 'INV-EXT-101', 'First pulled invoice mapped cleanly');
  assert(pulledItems[0].direction === 'INBOUND', 'Pulled invoice direction set to INBOUND');

  // --- SECTION 5: Provider Error Normalization & Retry Classification ---
  console.log('\n--- SECTION 5: Provider Error Normalization & Retry Classification ---');
  
  // 1. HTTP 401 Auth Failure (Non-Retryable)
  mockHttpResponseStatus = 401;
  try {
    await adapter.push(invoiceDummy);
    assert(false, 'HTTP 401 must throw ERPProviderException');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'HTTP 401 throws ERPProviderException');
    assert(err.problemDetails.code === 'ERP_AUTH_FAILED', 'Normalized code is ERP_AUTH_FAILED');
    assert(err.problemDetails.isRetryable === false, 'Auth failure classified as isRetryable=false');
  }

  // 2. HTTP 429 Rate Limit with Retry-After (Retryable)
  mockHttpResponseStatus = 429;
  mockHttpResponseHeaders = { 'retry-after': '45' };
  try {
    await adapter.push(invoiceDummy);
    assert(false, 'HTTP 429 must throw ERPProviderException');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'HTTP 429 throws ERPProviderException');
    assert(err.problemDetails.code === 'ERP_RATE_LIMITED', 'Normalized code is ERP_RATE_LIMITED');
    assert(err.problemDetails.isRetryable === true, 'Rate limit classified as isRetryable=true');
    assert(err.problemDetails.details.retryAfter === 45, 'Parsed Retry-After header value (45s)');
  }
  mockHttpResponseHeaders = {};

  // 3. HTTP 504 Gateway Timeout (Retryable)
  mockHttpResponseStatus = 504;
  try {
    await adapter.push(invoiceDummy);
    assert(false, 'HTTP 504 must throw ERPProviderException');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'HTTP 504 throws ERPProviderException');
    assert(err.problemDetails.code === 'ERP_SERVER_ERROR', 'Normalized code is ERP_SERVER_ERROR');
    assert(err.problemDetails.isRetryable === true, '504 Server error classified as isRetryable=true');
  }
  mockHttpResponseStatus = 200;

  // --- SECTION 6: Batch Synchronization ---
  console.log('\n--- SECTION 6: Batch Synchronization ---');
  mockHttpResponseBody = JSON.stringify({ id: 'ext_batch_ok' });
  const batch: CanonicalERPInvoiceDto[] = [
    { ...invoiceDummy, invoiceNumber: 'INV-BATCH-01' },
    { ...invoiceDummy, invoiceNumber: 'INV-BATCH-02' },
  ];

  const batchResult = await adapter.sync(batch);
  assert(batchResult.success === true, 'Batch sync succeeds');
  assert(batchResult.totalRecords === 2, 'Batch sync total records is 2');
  assert(batchResult.syncedCount === 2, 'Batch sync synced count is 2');
  assert(batchResult.failedCount === 0, 'Batch sync failed count is 0');

  console.log('\n================================================================');
  console.log(`  STAGE 15.5.2 TEST SUMMARY: ${passed}/${total} PASSED (100%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runStage15_5_2_Tests().catch((err) => {
  console.error('Stage 15.5.2 test runner failed:', err);
  process.exit(1);
});
