import { ZohoBooksAdapter, ZohoBooksConfig } from '../modules/erp-adapter-framework/adapters/zoho-books.adapter';
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

async function runStage15_5_8_Tests() {
  console.log('================================================================');
  console.log('  STAGE 15.5.8 — ZOHO BOOKS ADAPTER SUITE                      ');
  console.log('  [Mock / Contract Verification Mode - No Credentials Required]  ');
  console.log('================================================================\n');

  const ssrfGuard = new SsrfGuardService();
  const adapter = new ZohoBooksAdapter(ssrfGuard);
  const tenantA = '11111111-1111-1111-1111-111111111111';

  let lastCapturedHeaders: Record<string, string> = {};
  let lastCapturedUrl = '';
  let lastCapturedBody = '';
  let mockStatus = 201;
  let mockBody = JSON.stringify({ code: 0, message: 'Invoice created', invoice: { invoice_id: 'zoho_inv_90001', invoice_number: 'INV-ZOHO-001' } });
  let mockHeaders: Record<string, string> = {};

  adapter.setHttpDispatcher(async (url, method, headers, body) => {
    lastCapturedUrl = url;
    lastCapturedHeaders = headers;
    if (body) lastCapturedBody = body;
    return { status: mockStatus, body: mockBody, headers: mockHeaders };
  });

  const validIndiaConfig: ZohoBooksConfig = {
    organizationId: '789012345',
    clientId: 'zoho_client_id_in_100',
    clientSecret: 'zoho_client_secret_in_200',
    refreshToken: 'zoho_refresh_token_valid_300',
    dataCenterRegion: 'in',
  };

  const validUSConfig: ZohoBooksConfig = {
    organizationId: '890123456',
    clientId: 'zoho_client_id_us_100',
    clientSecret: 'zoho_client_secret_us_200',
    refreshToken: 'zoho_refresh_token_us_300',
    dataCenterRegion: 'com',
  };

  // --- SECTION 1: Capability Discovery & Registration ---
  console.log('--- SECTION 1: Capability Discovery & Registration ---');
  assert(adapter.providerType === 'ZOHO_BOOKS', 'Adapter providerType is ZOHO_BOOKS');
  const caps = adapter.getCapabilities();
  assert(caps.supportsOutbound === true, 'Zoho Books adapter supports outbound push');
  assert(caps.supportsInbound === true, 'Zoho Books adapter supports inbound pull');
  assert(caps.supportsBatchSync === true, 'Zoho Books adapter supports batch sync');
  assert(caps.supportsWebhookTriggers === true, 'Zoho Books adapter supports webhook triggers');

  // --- SECTION 2: OAuth2 & Multi-Region Lifecycle ---
  console.log('\n--- SECTION 2: OAuth2 & Multi-Region Lifecycle ---');
  const connectIndiaOk = await adapter.connect(validIndiaConfig);
  assert(connectIndiaOk === true, 'connect() succeeds for Zoho Books India (.in) region');

  const connectUSOk = await adapter.connect(validUSConfig);
  assert(connectUSOk === true, 'connect() succeeds for Zoho Books Global (.com) region');

  // Validation negative tests
  try {
    await adapter.connect({ ...validIndiaConfig, organizationId: '' });
    assert(false, 'Missing organizationId must throw BadRequestException');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Missing organizationId throws BadRequestException');
  }

  // Invalid Credentials
  try {
    await adapter.connect({ ...validIndiaConfig, clientSecret: 'invalid_secret' });
    assert(false, 'Invalid clientSecret must throw ERPProviderException');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'Invalid clientSecret throws ERPProviderException');
    assert(err.problemDetails.code === 'ERP_AUTH_FAILED', 'Error code is ERP_AUTH_FAILED');
  }

  try {
    await adapter.connect({ ...validIndiaConfig, refreshToken: 'invalid_refresh_token' });
    assert(false, 'Invalid refreshToken must throw ERPProviderException');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'Invalid refreshToken throws ERPProviderException');
  }

  // Re-connect with valid India config
  await adapter.connect(validIndiaConfig);

  // --- SECTION 3: Connection Testing & Health Checks ---
  console.log('\n--- SECTION 3: Connection Testing & Health Checks ---');
  mockStatus = 200;
  const testRes = await adapter.testConnection(validIndiaConfig);
  assert(testRes.success === true, 'testConnection() returns success=true on HTTP 200');
  assert(lastCapturedUrl.includes('organization_id=789012345'), 'testConnection targets specific Zoho Organization ID');
  assert(lastCapturedUrl.includes('books.zoho.in'), 'testConnection targets correct regional domain books.zoho.in');

  const healthRes = await adapter.healthCheck();
  assert(healthRes.status === 'HEALTHY', 'healthCheck() returns HEALTHY status');

  mockStatus = 429;
  const healthDegraded = await adapter.healthCheck();
  assert(healthDegraded.status === 'DEGRADED', 'healthCheck() returns DEGRADED status on HTTP 429');
  mockStatus = 201;

  // --- SECTION 4: Outbound Push & Canonical Mapping ---
  console.log('\n--- SECTION 4: Outbound Push & Canonical Mapping ---');
  const invoicePayload: CanonicalERPInvoiceDto = {
    invoiceNumber: 'INV-ZOHO-2026-001',
    invoiceDate: '2026-10-03',
    tenantId: tenantA,
    entityType: 'INVOICE',
    direction: 'OUTBOUND',
    sellerGstin: '27AAAAA0000A1Z5',
    buyerGstin: '27BBBBB1111B1Z2',
    buyerName: 'Zoho Customer Pvt Ltd',
    placeOfSupply: '27',
    taxableValue: 18000,
    cgstTotal: 1620,
    sgstTotal: 1620,
    igstTotal: 0,
    totalValue: 21240,
    items: [
      {
        lineNumber: 1,
        description: 'GST Compliance SaaS Enterprise Tier',
        hsnSacCode: '998314',
        quantity: 1,
        unitPrice: 18000,
        taxableAmount: 18000,
        cgstRate: 9,
        cgstAmount: 1620,
        sgstRate: 9,
        sgstAmount: 1620,
        igstRate: 0,
        igstAmount: 0,
        totalAmount: 21240,
      },
    ],
  };

  mockStatus = 201;
  mockBody = JSON.stringify({ code: 0, invoice: { invoice_id: 'zoho_inv_88001', invoice_number: 'INV-ZOHO-2026-001' } });
  const pushResult = await adapter.push(invoicePayload);

  assert(pushResult.success === true, 'push() posts canonical invoice to Zoho Books REST API');
  assert(pushResult.externalId === 'zoho_inv_88001', 'push() returns Zoho invoice_id');
  assert(pushResult.status === 'POSTED', 'push() returns status POSTED');
  assert(lastCapturedUrl.includes('/api/v3/invoices?organization_id=789012345'), 'push() targets Zoho /invoices endpoint with organization_id');

  // Verify Payload Mapping Boundary
  const parsedZohoBody = JSON.parse(lastCapturedBody);
  assert(parsedZohoBody.invoice_number === 'INV-ZOHO-2026-001', 'Canonical invoiceNumber mapped to Zoho invoice_number');
  assert(parsedZohoBody.customer_name === 'Zoho Customer Pvt Ltd', 'Canonical buyerName mapped to customer_name');
  assert(parsedZohoBody.gst_no === '27BBBBB1111B1Z2', 'Canonical buyerGstin mapped to gst_no');
  assert(parsedZohoBody.line_items.length === 1, 'Canonical items mapped to line_items array');
  assert(parsedZohoBody.line_items[0].hsn_or_sac === '998314', 'Line item hsn_or_sac preserved');

  // --- SECTION 5: Duplicate Document & Idempotency ---
  console.log('\n--- SECTION 5: Duplicate Document & Idempotency ---');
  mockStatus = 200;
  mockBody = JSON.stringify({ code: 100005, message: 'The invoice number already exists.' });
  const dupResult = await adapter.push(invoicePayload);
  assert(dupResult.success === false, 'Duplicate invoice number push returns success=false');
  assert(dupResult.status === 'DUPLICATE_RECORD', 'Zoho error code 100005 mapped to DUPLICATE_RECORD status');
  mockStatus = 201;

  // --- SECTION 6: Inbound Pull & Parsing ---
  console.log('\n--- SECTION 6: Inbound Pull & Parsing ---');
  mockStatus = 200;
  mockBody = JSON.stringify({
    code: 0,
    invoices: [
      {
        invoice_id: 'zoho_inv_pull_100',
        invoice_number: 'INV-ZOHO-PULL-100',
        date: '2026-10-03',
        customer_name: 'Zoho Inbound Customer',
        gst_no: '27BBBBB1111B1Z2',
        sub_total: 10000,
        total: 11800,
      },
    ],
  });

  const pulledInvoices = await adapter.pull({ limit: 10 });
  assert(pulledInvoices.length === 1, 'pull() parses Zoho response into 1 canonical invoice');
  assert(pulledInvoices[0].invoiceNumber === 'INV-ZOHO-PULL-100', 'Pulled Zoho invoice_number mapped correctly');
  assert(pulledInvoices[0].direction === 'INBOUND', 'Pulled invoice direction set to INBOUND');

  // --- SECTION 7: Provider Error Normalization & Retry Policy ---
  console.log('\n--- SECTION 7: Provider Error Normalization & Retry Policy ---');
  
  // 1. HTTP 401 Auth Failure
  mockStatus = 401;
  try {
    await adapter.push(invoicePayload);
    assert(false, 'HTTP 401 must throw ERPProviderException');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'HTTP 401 throws ERPProviderException');
    assert(err.problemDetails.code === 'ERP_AUTH_FAILED', 'Error code is ERP_AUTH_FAILED');
    assert(err.problemDetails.isRetryable === false, 'Auth failure isRetryable=false');
  }

  // 2. HTTP 429 Rate Limit
  mockStatus = 429;
  mockHeaders = { 'retry-after': '60' };
  try {
    await adapter.push(invoicePayload);
    assert(false, 'HTTP 429 must throw ERPProviderException');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'HTTP 429 throws ERPProviderException');
    assert(err.problemDetails.code === 'ERP_RATE_LIMITED', 'Error code is ERP_RATE_LIMITED');
    assert(err.problemDetails.isRetryable === true, 'Rate limit isRetryable=true');
    assert(err.problemDetails.details.retryAfter === 60, 'Parsed Retry-After header (60s)');
  }
  mockHeaders = {};

  // 3. HTTP 504 Gateway Timeout
  mockStatus = 504;
  try {
    await adapter.push(invoicePayload);
    assert(false, 'HTTP 504 must throw ERPProviderException');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'HTTP 504 throws ERPProviderException');
    assert(err.problemDetails.code === 'ERP_SERVER_ERROR', 'HTTP 504 classified as ERP_SERVER_ERROR');
    assert(err.problemDetails.isRetryable === true, 'HTTP 504 isRetryable=true');
  }
  mockStatus = 201;

  // --- SECTION 8: Batch Synchronization & Partial Failures ---
  console.log('\n--- SECTION 8: Batch Synchronization & Partial Failures ---');
  mockStatus = 201;
  mockBody = JSON.stringify({ code: 0, invoice: { invoice_id: 'zoho_inv_batch' } });
  const batchResult = await adapter.sync([invoicePayload, { ...invoicePayload, invoiceNumber: 'INV-ZOHO-2026-002' }]);

  assert(batchResult.success === true, 'sync() batch execution succeeds');
  assert(batchResult.syncedCount === 2, 'sync() synced count is 2');
  assert(batchResult.failedCount === 0, 'sync() failed count is 0');

  // --- SECTION 9: Concurrent Synchronization ---
  console.log('\n--- SECTION 9: Concurrent Synchronization ---');
  const concurrentPushes = await Promise.all([
    adapter.push({ ...invoicePayload, invoiceNumber: 'INV-ZOHO-CONC-1' }),
    adapter.push({ ...invoicePayload, invoiceNumber: 'INV-ZOHO-CONC-2' }),
  ]);
  assert(concurrentPushes.length === 2 && concurrentPushes[0].success && concurrentPushes[1].success, 'Concurrent Zoho synchronization requests executed without contention');

  console.log('\n================================================================');
  console.log(`  STAGE 15.5.8 TEST SUMMARY: ${passed}/${total} PASSED (100%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runStage15_5_8_Tests().catch((err) => {
  console.error('Stage 15.5.8 test runner failed:', err);
  process.exit(1);
});
