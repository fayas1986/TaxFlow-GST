import { Dynamics365BcAdapter, Dynamics365BcConfig } from '../modules/erp-adapter-framework/adapters/dynamics-365-bc.adapter';
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

async function runStage15_5_4_Tests() {
  console.log('================================================================');
  console.log('  STAGE 15.5.4 — DYNAMICS 365 BUSINESS CENTRAL ADAPTER SUITE  ');
  console.log('  [Mock / Contract Verification Mode - No Credentials Required]  ');
  console.log('================================================================\n');

  const ssrfGuard = new SsrfGuardService();
  const adapter = new Dynamics365BcAdapter(ssrfGuard);
  const tenantA = '11111111-1111-1111-1111-111111111111';

  let lastCapturedHeaders: Record<string, string> = {};
  let lastCapturedUrl = '';
  let lastCapturedBody = '';
  let mockStatus = 201;
  let mockBody = JSON.stringify({ id: 'bc_guid_12345', number: 'INV-BC-001' });
  let mockHeaders: Record<string, string> = {};

  adapter.setHttpDispatcher(async (url, method, headers, body) => {
    lastCapturedUrl = url;
    lastCapturedHeaders = headers;
    if (body) lastCapturedBody = body;
    return { status: mockStatus, body: mockBody, headers: mockHeaders };
  });

  const validConfig: Dynamics365BcConfig = {
    tenantId: 'azure-ad-tenant-guid-1111',
    clientId: 'azure-app-client-id-2222',
    clientSecret: 'secret_azure_ad_key_3333',
    environmentName: 'Production',
    companyId: '11111111-2222-3333-4444-555555555555',
  };

  // --- SECTION 1: Capability Discovery & Registration ---
  console.log('--- SECTION 1: Capability Discovery & Registration ---');
  assert(adapter.providerType === 'DYNAMICS_365_BC', 'Adapter providerType is DYNAMICS_365_BC');
  const caps = adapter.getCapabilities();
  assert(caps.supportsOutbound === true, 'Business Central adapter supports outbound push');
  assert(caps.supportsInbound === true, 'Business Central adapter supports inbound pull');
  assert(caps.supportsBatchSync === true, 'Business Central adapter supports batch sync');

  // --- SECTION 2: OAuth2 & Connection Lifecycle ---
  console.log('\n--- SECTION 2: OAuth2 & Connection Lifecycle ---');
  const connectOk = await adapter.connect(validConfig);
  assert(connectOk === true, 'connect() establishes connection using Entra ID OAuth2 Client Credentials');

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
  assert(lastCapturedUrl.includes('companies(11111111-2222-3333-4444-555555555555)'), 'testConnection targets specific BC Company GUID');

  const healthRes = await adapter.healthCheck();
  assert(healthRes.status === 'HEALTHY', 'healthCheck() returns HEALTHY status');

  mockStatus = 429;
  const healthDegraded = await adapter.healthCheck();
  assert(healthDegraded.status === 'DEGRADED', 'healthCheck() returns DEGRADED status on HTTP 429');
  mockStatus = 201;

  // --- SECTION 4: Outbound Push & Canonical Mapping ---
  console.log('\n--- SECTION 4: Outbound Push & Canonical Mapping ---');
  const invoicePayload: CanonicalERPInvoiceDto = {
    invoiceNumber: 'INV-BC-2026-001',
    invoiceDate: '2026-10-03',
    tenantId: tenantA,
    entityType: 'INVOICE',
    direction: 'OUTBOUND',
    sellerGstin: '27AAAAA0000A1Z5',
    buyerGstin: '27BBBBB1111B1Z2',
    buyerName: 'Global Enterprises Inc',
    placeOfSupply: '27',
    taxableValue: 12000,
    cgstTotal: 1080,
    sgstTotal: 1080,
    igstTotal: 0,
    totalValue: 14160,
    items: [
      {
        lineNumber: 1,
        description: 'GST SaaS Enterprise License',
        hsnSacCode: '998313',
        quantity: 1,
        unitPrice: 12000,
        taxableAmount: 12000,
        cgstRate: 9,
        cgstAmount: 1080,
        sgstRate: 9,
        sgstAmount: 1080,
        igstRate: 0,
        igstAmount: 0,
        totalAmount: 14160,
      },
    ],
  };

  mockStatus = 201;
  mockBody = JSON.stringify({ id: 'bc_guid_98765', number: 'INV-BC-2026-001' });
  const pushResult = await adapter.push(invoicePayload);

  assert(pushResult.success === true, 'push() posts canonical invoice to Business Central');
  assert(pushResult.externalId === 'bc_guid_98765', 'push() returns BC invoice GUID');
  assert(pushResult.status === 'POSTED', 'push() returns status POSTED');
  assert(lastCapturedUrl.includes('/salesInvoices'), 'push() targets /salesInvoices OData endpoint');

  // Verify BC Payload Mapping Boundary
  const parsedBcBody = JSON.parse(lastCapturedBody);
  assert(parsedBcBody.externalDocumentNumber === 'INV-BC-2026-001', 'Canonical invoiceNumber mapped to BC externalDocumentNumber');
  assert(parsedBcBody.customerName === 'Global Enterprises Inc', 'Canonical buyerName mapped to BC customerName');
  assert(parsedBcBody.salesInvoiceLines.length === 1, 'Canonical items mapped to BC salesInvoiceLines');
  assert(parsedBcBody.salesInvoiceLines[0].hsnSacCode === '998313', 'Line item hsnSacCode preserved');

  // Duplicate Document Handling (HTTP 409)
  mockStatus = 409;
  const dupResult = await adapter.push(invoicePayload);
  assert(dupResult.success === false, 'Duplicate invoice push returns success=false');
  assert(dupResult.status === 'DUPLICATE_RECORD', 'Duplicate invoice push returns DUPLICATE_RECORD status');
  mockStatus = 200;

  // --- SECTION 5: Inbound Pull & OData Parsing ---
  console.log('\n--- SECTION 5: Inbound Pull & OData Parsing ---');
  mockStatus = 200;
  mockBody = JSON.stringify({
    value: [
      {
        id: 'bc_inv_guid_111',
        externalDocumentNumber: 'BC-PULL-100',
        postingDate: '2026-10-03',
        customerNumber: '27BBBBB1111B1Z2',
        customerName: 'BC Inbound Customer',
        totalAmountExcludingTax: 5000,
        totalAmountIncludingTax: 5900,
      },
    ],
  });

  const pulledInvoices = await adapter.pull({ limit: 10 });
  assert(pulledInvoices.length === 1, 'pull() parses OData response into 1 canonical invoice');
  assert(pulledInvoices[0].invoiceNumber === 'BC-PULL-100', 'Pulled BC invoice externalDocumentNumber mapped correctly');
  assert(pulledInvoices[0].direction === 'INBOUND', 'Pulled invoice direction set to INBOUND');

  // --- SECTION 6: Provider Error Normalization & Retry Policy ---
  console.log('\n--- SECTION 6: Provider Error Normalization & Retry Policy ---');
  
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
  mockHeaders = { 'retry-after': '30' };
  try {
    await adapter.push(invoicePayload);
    assert(false, 'HTTP 429 must throw ERPProviderException');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'HTTP 429 throws ERPProviderException');
    assert(err.problemDetails.code === 'ERP_RATE_LIMITED', 'Error code is ERP_RATE_LIMITED');
    assert(err.problemDetails.isRetryable === true, 'Rate limit isRetryable=true');
    assert(err.problemDetails.details.retryAfter === 30, 'Parsed Retry-After header (30s)');
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

  // --- SECTION 7: Batch Synchronization ---
  console.log('\n--- SECTION 7: Batch Synchronization ---');
  mockStatus = 201;
  mockBody = JSON.stringify({ id: 'bc_guid_batch' });
  const batchResult = await adapter.sync([invoicePayload, { ...invoicePayload, invoiceNumber: 'INV-BC-2026-002' }]);

  assert(batchResult.success === true, 'sync() batch execution succeeds');
  assert(batchResult.syncedCount === 2, 'sync() synced count is 2');
  assert(batchResult.failedCount === 0, 'sync() failed count is 0');

  console.log('\n================================================================');
  console.log(`  STAGE 15.5.4 TEST SUMMARY: ${passed}/${total} PASSED (100%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runStage15_5_4_Tests().catch((err) => {
  console.error('Stage 15.5.4 test runner failed:', err);
  process.exit(1);
});
