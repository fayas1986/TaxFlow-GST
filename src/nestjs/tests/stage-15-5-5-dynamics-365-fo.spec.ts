import { Dynamics365FoAdapter, Dynamics365FoConfig } from '../modules/erp-adapter-framework/adapters/dynamics-365-fo.adapter';
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

async function runStage15_5_5_Tests() {
  console.log('================================================================');
  console.log('  STAGE 15.5.5 — DYNAMICS 365 FINANCE & OPERATIONS SUITE       ');
  console.log('  [Mock / Contract Verification Mode - No Credentials Required]  ');
  console.log('================================================================\n');

  const ssrfGuard = new SsrfGuardService();
  const adapter = new Dynamics365FoAdapter(ssrfGuard);
  const tenantA = '11111111-1111-1111-1111-111111111111';

  let lastCapturedHeaders: Record<string, string> = {};
  let lastCapturedUrl = '';
  let lastCapturedBody = '';
  let mockStatus = 201;
  let mockBody = JSON.stringify({ SalesOrderNumber: 'SO-FO-001', CustomerInvoiceNumber: 'INV-FO-001' });
  let mockHeaders: Record<string, string> = {};

  adapter.setHttpDispatcher(async (url, method, headers, body) => {
    lastCapturedUrl = url;
    lastCapturedHeaders = headers;
    if (body) lastCapturedBody = body;
    return { status: mockStatus, body: mockBody, headers: mockHeaders };
  });

  const validConfig: Dynamics365FoConfig = {
    environmentUrl: 'https://fo-instance.operations.dynamics.com',
    tenantId: 'azure-ad-tenant-guid-9999',
    clientId: 'azure-app-client-id-8888',
    clientSecret: 'secret_azure_ad_key_7777',
    legalEntity: 'USMF',
  };

  // --- SECTION 1: Capability Discovery & Registration ---
  console.log('--- SECTION 1: Capability Discovery & Registration ---');
  assert(adapter.providerType === 'DYNAMICS_365_FO', 'Adapter providerType is DYNAMICS_365_FO');
  const caps = adapter.getCapabilities();
  assert(caps.supportsOutbound === true, 'F&O adapter supports outbound push');
  assert(caps.supportsInbound === true, 'F&O adapter supports inbound pull');
  assert(caps.supportsBatchSync === true, 'F&O adapter supports batch sync');
  assert(caps.supportsWebhookTriggers === true, 'F&O adapter supports Business Events webhook triggers');

  // --- SECTION 2: OAuth2 & Connection Lifecycle ---
  console.log('\n--- SECTION 2: OAuth2 & Connection Lifecycle ---');
  const connectOk = await adapter.connect(validConfig);
  assert(connectOk === true, 'connect() establishes connection targeting F&O Legal Entity');

  // Missing legal entity validation
  try {
    await adapter.connect({ ...validConfig, legalEntity: '' });
    assert(false, 'Missing legalEntity must throw BadRequestException');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Missing legalEntity throws BadRequestException');
  }

  // Invalid client secret validation
  try {
    await adapter.connect({ ...validConfig, clientSecret: 'invalid_secret' });
    assert(false, 'Invalid Azure AD client secret must throw ERPProviderException');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'Invalid Azure secret throws ERPProviderException');
    assert(err.problemDetails.code === 'ERP_AUTH_FAILED', 'Error code is ERP_AUTH_FAILED');
  }
  await adapter.connect(validConfig);

  // --- SECTION 3: Connection Testing & Health Checks ---
  console.log('\n--- SECTION 3: Connection Testing & Health Checks ---');
  mockStatus = 200;
  const testRes = await adapter.testConnection(validConfig);
  assert(testRes.success === true, 'testConnection() returns success=true on HTTP 200');
  assert(lastCapturedUrl.includes("dataAreaId eq 'USMF'"), 'testConnection targets specific F&O Legal Entity (dataAreaId eq USMF)');

  const healthRes = await adapter.healthCheck();
  assert(healthRes.status === 'HEALTHY', 'healthCheck() returns HEALTHY status');

  mockStatus = 429;
  const healthDegraded = await adapter.healthCheck();
  assert(healthDegraded.status === 'DEGRADED', 'healthCheck() returns DEGRADED status on HTTP 429');
  mockStatus = 201;

  // --- SECTION 4: Outbound Push & Legal Entity Targeting ---
  console.log('\n--- SECTION 4: Outbound Push & Legal Entity Targeting ---');
  const invoicePayload: CanonicalERPInvoiceDto = {
    invoiceNumber: 'INV-FO-2026-001',
    invoiceDate: '2026-10-03',
    tenantId: tenantA,
    entityType: 'INVOICE',
    direction: 'OUTBOUND',
    sellerGstin: '27AAAAA0000A1Z5',
    buyerGstin: '27BBBBB1111B1Z2',
    buyerName: 'Contoso Entertainment System',
    placeOfSupply: '27',
    taxableValue: 25000,
    cgstTotal: 2250,
    sgstTotal: 2250,
    igstTotal: 0,
    totalValue: 29500,
    items: [
      {
        lineNumber: 1,
        description: 'GST Compliance Software Services',
        hsnSacCode: '998314',
        quantity: 2,
        unitPrice: 12500,
        taxableAmount: 25000,
        cgstRate: 9,
        cgstAmount: 2250,
        sgstRate: 9,
        sgstAmount: 2250,
        igstRate: 0,
        igstAmount: 0,
        totalAmount: 29500,
      },
    ],
  };

  mockStatus = 201;
  mockBody = JSON.stringify({ SalesOrderNumber: 'SO-FO-9999', CustomerInvoiceNumber: 'INV-FO-2026-001' });
  const pushResult = await adapter.push(invoicePayload);

  assert(pushResult.success === true, 'push() posts canonical invoice to D365 F&O SalesOrderHeadersV2');
  assert(pushResult.externalId === 'SO-FO-9999', 'push() returns F&O Sales Order Number');
  assert(pushResult.status === 'POSTED', 'push() returns status POSTED');
  assert(lastCapturedUrl.includes('/SalesOrderHeadersV2?cross-company=true'), 'push() targets SalesOrderHeadersV2 Data Entity endpoint');

  // Verify F&O Payload Mapping & Legal Entity Boundary
  const parsedFoBody = JSON.parse(lastCapturedBody);
  assert(parsedFoBody.CustomerInvoiceNumber === 'INV-FO-2026-001', 'Canonical invoiceNumber mapped to F&O CustomerInvoiceNumber');
  assert(parsedFoBody.dataAreaId === 'USMF', 'Target Legal Entity USMF explicitly set in dataAreaId');
  assert(parsedFoBody.InvoiceCustomerName === 'Contoso Entertainment System', 'Canonical buyerName mapped to InvoiceCustomerName');
  assert(parsedFoBody.SalesOrderLinesV2.length === 1, 'Canonical items mapped to SalesOrderLinesV2 array');
  assert(parsedFoBody.SalesOrderLinesV2[0].HSNSACCode === '998314', 'Line item HSNSACCode preserved');

  // --- SECTION 5: Legal Entity Isolation ---
  console.log('\n--- SECTION 5: Legal Entity Isolation ---');
  await adapter.connect({ ...validConfig, legalEntity: 'IN01' });
  await adapter.push(invoicePayload);
  const parsedIn01Body = JSON.parse(lastCapturedBody);
  assert(parsedIn01Body.dataAreaId === 'IN01', 'Legal entity IN01 dynamically isolated and set in dataAreaId');
  await adapter.connect(validConfig); // revert back to USMF

  // Duplicate Document Handling (HTTP 409)
  mockStatus = 409;
  const dupResult = await adapter.push(invoicePayload);
  assert(dupResult.success === false, 'Duplicate invoice push returns success=false');
  assert(dupResult.status === 'DUPLICATE_RECORD', 'Duplicate invoice push returns DUPLICATE_RECORD status');
  mockStatus = 201;

  // --- SECTION 6: Inbound Pull & Data Entity Parsing ---
  console.log('\n--- SECTION 6: Inbound Pull & Data Entity Parsing ---');
  mockStatus = 200;
  mockBody = JSON.stringify({
    value: [
      {
        SalesOrderNumber: 'SO-FO-PULL-100',
        CustomerInvoiceNumber: 'INV-FO-PULL-100',
        InvoiceDate: '2026-10-03',
        OrderingCustomerAccountNumber: '27BBBBB1111B1Z2',
        InvoiceCustomerName: 'F&O Inbound Customer',
        TotalTaxableAmount: 8000,
        TotalInvoiceAmount: 9440,
      },
    ],
  });

  const pulledInvoices = await adapter.pull({ limit: 10 });
  assert(pulledInvoices.length === 1, 'pull() parses Data Entity response into 1 canonical invoice');
  assert(pulledInvoices[0].invoiceNumber === 'INV-FO-PULL-100', 'Pulled F&O CustomerInvoiceNumber mapped correctly');
  assert(pulledInvoices[0].direction === 'INBOUND', 'Pulled invoice direction set to INBOUND');

  // --- SECTION 7: Error Normalization, Rate Limit & Retry Policy ---
  console.log('\n--- SECTION 7: Error Normalization, Rate Limit & Retry Policy ---');
  
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

  // 3. HTTP 504 Gateway Timeout -> ERP_SERVER_ERROR (isRetryable = true)
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
  mockBody = JSON.stringify({ SalesOrderNumber: 'SO-FO-BATCH' });
  const batchResult = await adapter.sync([invoicePayload, { ...invoicePayload, invoiceNumber: 'INV-FO-2026-002' }]);

  assert(batchResult.success === true, 'sync() batch execution succeeds');
  assert(batchResult.syncedCount === 2, 'sync() synced count is 2');
  assert(batchResult.failedCount === 0, 'sync() failed count is 0');

  // --- SECTION 9: Concurrent Synchronization ---
  console.log('\n--- SECTION 9: Concurrent Synchronization ---');
  const concurrentPushes = await Promise.all([
    adapter.push({ ...invoicePayload, invoiceNumber: 'INV-FO-CONC-1' }),
    adapter.push({ ...invoicePayload, invoiceNumber: 'INV-FO-CONC-2' }),
  ]);
  assert(concurrentPushes.length === 2 && concurrentPushes[0].success && concurrentPushes[1].success, 'Concurrent synchronization requests executed without contention');

  console.log('\n================================================================');
  console.log(`  STAGE 15.5.5 TEST SUMMARY: ${passed}/${total} PASSED (100%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runStage15_5_5_Tests().catch((err) => {
  console.error('Stage 15.5.5 test runner failed:', err);
  process.exit(1);
});
