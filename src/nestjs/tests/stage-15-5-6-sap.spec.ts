import { SapAdapter, SapConfig } from '../modules/erp-adapter-framework/adapters/sap.adapter';
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

async function runStage15_5_6_Tests() {
  console.log('================================================================');
  console.log('  STAGE 15.5.6 — SAP S/4HANA / ECC ADAPTER SUITE               ');
  console.log('  [Mock / Contract Verification Mode - No Credentials Required]  ');
  console.log('================================================================\n');

  const ssrfGuard = new SsrfGuardService();
  const adapter = new SapAdapter(ssrfGuard);
  const tenantA = '11111111-1111-1111-1111-111111111111';

  let lastCapturedHeaders: Record<string, string> = {};
  let lastCapturedUrl = '';
  let lastCapturedBody = '';
  let mockStatus = 201;
  let mockBody = JSON.stringify({ SalesOrder: 'SAP-SO-90001', ReferenceDocumentNumber: 'INV-SAP-001' });
  let mockHeaders: Record<string, string> = {};

  adapter.setHttpDispatcher(async (url, method, headers, body) => {
    lastCapturedUrl = url;
    lastCapturedHeaders = headers;
    if (body) lastCapturedBody = body;
    return { status: mockStatus, body: mockBody, headers: mockHeaders };
  });

  const validODataConfig: SapConfig = {
    destinationUrl: 'https://s4hana.sap.mycompany.com',
    systemType: 'S4HANA',
    protocol: 'ODATA',
    companyCode: '1000', // BUKRS
    salesOrg: '1000',
    plant: '1010',
    authType: 'OAUTH2',
    clientId: 'sap_client_id_100',
    clientSecret: 'sap_client_secret_200',
  };

  const validBapiConfig: SapConfig = {
    destinationUrl: 'https://ecc.sap.mycompany.com',
    systemType: 'ECC',
    protocol: 'BAPI',
    companyCode: '2000',
    authType: 'BASIC',
    username: 'SAP_USER',
    password: 'SAP_PASSWORD_123',
  };

  const validApiKeyConfig: SapConfig = {
    destinationUrl: 'https://s4hana-api.sap.mycompany.com',
    systemType: 'S4HANA',
    protocol: 'IDOC',
    companyCode: '3000',
    authType: 'API_KEY',
    apiKey: 'sap_api_key_valid_999',
  };

  // --- SECTION 1: Capability Discovery & Registration ---
  console.log('--- SECTION 1: Capability Discovery & Registration ---');
  assert(adapter.providerType === 'SAP', 'Adapter providerType is SAP');
  const caps = adapter.getCapabilities();
  assert(caps.supportsOutbound === true, 'SAP adapter supports outbound push');
  assert(caps.supportsInbound === true, 'SAP adapter supports inbound pull');
  assert(caps.supportsBatchSync === true, 'SAP adapter supports batch sync');
  assert(caps.supportsWebhookTriggers === true, 'SAP adapter supports IDoc / Business Events webhook triggers');

  // --- SECTION 2: Authentication & Connection Lifecycle ---
  console.log('\n--- SECTION 2: Authentication & Connection Lifecycle ---');
  const connectODataOk = await adapter.connect(validODataConfig);
  assert(connectODataOk === true, 'connect() succeeds for S/4HANA OData with OAuth2');

  const connectBapiOk = await adapter.connect(validBapiConfig);
  assert(connectBapiOk === true, 'connect() succeeds for ECC BAPI with Basic Auth');

  const connectApiKeyOk = await adapter.connect(validApiKeyConfig);
  assert(connectApiKeyOk === true, 'connect() succeeds for S/4HANA IDoc with API Key');

  // Validation negative tests
  try {
    await adapter.connect({ ...validODataConfig, companyCode: '' });
    assert(false, 'Missing companyCode (BUKRS) must throw BadRequestException');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Missing companyCode throws BadRequestException');
  }

  // Invalid Credentials (OAuth2, Basic, API Key)
  try {
    await adapter.connect({ ...validODataConfig, clientSecret: 'invalid_secret' });
    assert(false, 'Invalid OAuth2 secret must throw ERPProviderException');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'Invalid OAuth2 secret throws ERPProviderException');
    assert(err.problemDetails.code === 'ERP_AUTH_FAILED', 'Error code is ERP_AUTH_FAILED');
  }

  try {
    await adapter.connect({ ...validBapiConfig, password: 'invalid_password' });
    assert(false, 'Invalid Basic password must throw ERPProviderException');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'Invalid Basic password throws ERPProviderException');
  }

  try {
    await adapter.connect({ ...validApiKeyConfig, apiKey: 'invalid_key' });
    assert(false, 'Invalid API Key must throw ERPProviderException');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'Invalid API Key throws ERPProviderException');
  }

  // Re-connect with valid OData Config
  await adapter.connect(validODataConfig);

  // --- SECTION 3: Connection Testing & Health Checks ---
  console.log('\n--- SECTION 3: Connection Testing & Health Checks ---');
  mockStatus = 200;
  const testRes = await adapter.testConnection(validODataConfig);
  assert(testRes.success === true, 'testConnection() returns success=true on HTTP 200');
  assert(lastCapturedUrl.includes("CompanyCode eq '1000'"), 'testConnection targets SAP Company Code 1000 (BUKRS)');

  const healthRes = await adapter.healthCheck();
  assert(healthRes.status === 'HEALTHY', 'healthCheck() returns HEALTHY status');

  mockStatus = 429;
  const healthDegraded = await adapter.healthCheck();
  assert(healthDegraded.status === 'DEGRADED', 'healthCheck() returns DEGRADED status on HTTP 429');
  mockStatus = 201;

  // --- SECTION 4: Outbound Push & Protocol Payload Mappings ---
  console.log('\n--- SECTION 4: Outbound Push & Protocol Payload Mappings ---');
  const invoicePayload: CanonicalERPInvoiceDto = {
    invoiceNumber: 'INV-SAP-2026-001',
    invoiceDate: '2026-10-03',
    tenantId: tenantA,
    entityType: 'INVOICE',
    direction: 'OUTBOUND',
    sellerGstin: '27AAAAA0000A1Z5',
    buyerGstin: '27BBBBB1111B1Z2',
    buyerName: 'SAP Global Enterprises',
    placeOfSupply: '27',
    taxableValue: 50000,
    cgstTotal: 4500,
    sgstTotal: 4500,
    igstTotal: 0,
    totalValue: 59000,
    items: [
      {
        lineNumber: 1,
        description: 'GST ERP Connector License',
        hsnSacCode: '998315',
        quantity: 1,
        unitPrice: 50000,
        taxableAmount: 50000,
        cgstRate: 9,
        cgstAmount: 4500,
        sgstRate: 9,
        sgstAmount: 4500,
        igstRate: 0,
        igstAmount: 0,
        totalAmount: 59000,
      },
    ],
  };

  // 1. OData Protocol Push
  await adapter.connect(validODataConfig);
  mockStatus = 201;
  mockBody = JSON.stringify({ SalesOrder: 'SAP-SO-77001' });
  const pushODataRes = await adapter.push(invoicePayload);
  assert(pushODataRes.success === true, 'OData push succeeds');
  assert(pushODataRes.externalId === 'SAP-SO-77001', 'push() returns SAP Sales Order Number');
  assert(lastCapturedUrl.includes('/API_SALES_ORDER_SRV/A_SalesOrder'), 'push() targets OData SalesOrder endpoint');

  const parsedODataBody = JSON.parse(lastCapturedBody);
  assert(parsedODataBody.PurchaseOrderByCustomer === 'INV-SAP-2026-001', 'Canonical invoiceNumber mapped to SAP PurchaseOrderByCustomer (XBLNR)');
  assert(parsedODataBody.CompanyCode === '1000', 'Canonical companyCode mapped to BUKRS 1000');

  // 2. BAPI Protocol Push
  await adapter.connect(validBapiConfig);
  mockStatus = 200;
  mockBody = JSON.stringify({ DocumentNumber: 'SAP-ACC-100200' });
  const pushBapiRes = await adapter.push(invoicePayload);
  assert(pushBapiRes.success === true, 'BAPI push succeeds');
  assert(lastCapturedUrl.includes('/bapi_acc_document_post'), 'push() targets BAPI RFC endpoint');

  const parsedBapiBody = JSON.parse(lastCapturedBody);
  assert(parsedBapiBody.HEADER.XBLNR === 'INV-SAP-2026-001', 'BAPI payload mapped XBLNR Reference Document Number');
  assert(parsedBapiBody.HEADER.BUKRS === '2000', 'BAPI payload mapped BUKRS 2000');

  // 3. IDoc Protocol Push
  await adapter.connect(validApiKeyConfig);
  mockStatus = 200;
  mockBody = JSON.stringify({ ReferenceDocumentNumber: 'SAP-IDOC-5001' });
  const pushIDocRes = await adapter.push(invoicePayload);
  assert(pushIDocRes.success === true, 'IDoc push succeeds');
  assert(lastCapturedUrl.includes('/sap/idoc/ACC_INVOICE_REC'), 'push() targets IDoc endpoint');

  const parsedIDocBody = JSON.parse(lastCapturedBody);
  assert(parsedIDocBody.E1EDK01.BELNR === 'INV-SAP-2026-001', 'IDoc payload mapped BELNR Document Number');
  assert(parsedIDocBody.E1EDK01.BUKRS === '3000', 'IDoc payload mapped BUKRS 3000');

  // Re-connect to OData config
  await adapter.connect(validODataConfig);

  // --- SECTION 5: Duplicate Document & Idempotency ---
  console.log('\n--- SECTION 5: Duplicate Document & Idempotency ---');
  mockStatus = 409;
  const dupResult = await adapter.push(invoicePayload);
  assert(dupResult.success === false, 'Duplicate XBLNR push returns success=false');
  assert(dupResult.status === 'DUPLICATE_RECORD', 'Duplicate XBLNR push returns DUPLICATE_RECORD status');
  mockStatus = 201;

  // --- SECTION 6: Inbound Pull & Parsing ---
  console.log('\n--- SECTION 6: Inbound Pull & Parsing ---');
  mockStatus = 200;
  mockBody = JSON.stringify({
    d: {
      results: [
        {
          SalesOrder: 'SAP-SO-PULL-10',
          PurchaseOrderByCustomer: 'INV-SAP-PULL-10',
          DocumentDate: '2026-10-03',
          SoldToParty: '27BBBBB1111B1Z2',
          CustomerName: 'SAP Inbound Customer',
          TotalNetAmount: 15000,
          TotalAmount: 17700,
        },
      ],
    },
  });

  const pulledInvoices = await adapter.pull({ limit: 10 });
  assert(pulledInvoices.length === 1, 'pull() parses SAP OData response into 1 canonical invoice');
  assert(pulledInvoices[0].invoiceNumber === 'INV-SAP-PULL-10', 'Pulled SAP PurchaseOrderByCustomer (XBLNR) mapped correctly');
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
  mockHeaders = { 'retry-after': '45' };
  try {
    await adapter.push(invoicePayload);
    assert(false, 'HTTP 429 must throw ERPProviderException');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'HTTP 429 throws ERPProviderException');
    assert(err.problemDetails.code === 'ERP_RATE_LIMITED', 'Error code is ERP_RATE_LIMITED');
    assert(err.problemDetails.isRetryable === true, 'Rate limit isRetryable=true');
    assert(err.problemDetails.details.retryAfter === 45, 'Parsed Retry-After header (45s)');
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
  mockBody = JSON.stringify({ SalesOrder: 'SAP-SO-BATCH' });
  const batchResult = await adapter.sync([invoicePayload, { ...invoicePayload, invoiceNumber: 'INV-SAP-2026-002' }]);

  assert(batchResult.success === true, 'sync() batch execution succeeds');
  assert(batchResult.syncedCount === 2, 'sync() synced count is 2');
  assert(batchResult.failedCount === 0, 'sync() failed count is 0');

  // --- SECTION 9: Concurrent Synchronization ---
  console.log('\n--- SECTION 9: Concurrent Synchronization ---');
  const concurrentPushes = await Promise.all([
    adapter.push({ ...invoicePayload, invoiceNumber: 'INV-SAP-CONC-1' }),
    adapter.push({ ...invoicePayload, invoiceNumber: 'INV-SAP-CONC-2' }),
  ]);
  assert(concurrentPushes.length === 2 && concurrentPushes[0].success && concurrentPushes[1].success, 'Concurrent SAP synchronization requests executed without contention');

  console.log('\n================================================================');
  console.log(`  STAGE 15.5.6 TEST SUMMARY: ${passed}/${total} PASSED (100%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runStage15_5_6_Tests().catch((err) => {
  console.error('Stage 15.5.6 test runner failed:', err);
  process.exit(1);
});
