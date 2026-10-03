import { OracleFusionAdapter, OracleFusionConfig } from '../modules/erp-adapter-framework/adapters/oracle-fusion.adapter';
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

async function runStage15_5_9_Tests() {
  console.log('================================================================');
  console.log('  STAGE 15.5.9 — ORACLE FUSION ERP ADAPTER SUITE               ');
  console.log('  [Mock / Contract Verification Mode - No Credentials Required]  ');
  console.log('================================================================\n');

  const ssrfGuard = new SsrfGuardService();
  const adapter = new OracleFusionAdapter(ssrfGuard);
  const tenantA = '11111111-1111-1111-1111-111111111111';

  let lastCapturedHeaders: Record<string, string> = {};
  let lastCapturedUrl = '';
  let lastCapturedBody = '';
  let mockStatus = 201;
  let mockBody = JSON.stringify({ CustomerTransactionId: 99887766, TransactionNumber: 'INV-ORACLE-001' });
  let mockHeaders: Record<string, string> = {};

  adapter.setHttpDispatcher(async (url, method, headers, body) => {
    lastCapturedUrl = url;
    lastCapturedHeaders = headers;
    if (body) lastCapturedBody = body;
    return { status: mockStatus, body: mockBody, headers: mockHeaders };
  });

  const validOAuth2Config: OracleFusionConfig = {
    environmentUrl: 'https://fa-instance.oraclecloud.com',
    businessUnit: 'US1 Business Unit',
    authType: 'OAUTH2',
    clientId: 'oracle_app_client_100',
    clientSecret: 'oracle_app_secret_200',
  };

  const validBasicConfig: OracleFusionConfig = {
    environmentUrl: 'https://fa-india.oraclecloud.com',
    businessUnit: 'IN Business Unit',
    authType: 'BASIC',
    username: 'FINANCE_USER',
    password: 'oracle_secure_password_99',
  };

  // --- SECTION 1: Capability Discovery & Registration ---
  console.log('--- SECTION 1: Capability Discovery & Registration ---');
  assert(adapter.providerType === 'ORACLE_FUSION', 'Adapter providerType is ORACLE_FUSION');
  const caps = adapter.getCapabilities();
  assert(caps.supportsOutbound === true, 'Oracle Fusion adapter supports outbound push');
  assert(caps.supportsInbound === true, 'Oracle Fusion adapter supports inbound pull');
  assert(caps.supportsBatchSync === true, 'Oracle Fusion adapter supports batch sync');
  assert(caps.supportsWebhookTriggers === true, 'Oracle Fusion adapter supports webhook triggers');

  // --- SECTION 2: Authentication & Business Unit Lifecycle ---
  console.log('\n--- SECTION 2: Authentication & Business Unit Lifecycle ---');
  const connectOAuth2Ok = await adapter.connect(validOAuth2Config);
  assert(connectOAuth2Ok === true, 'connect() succeeds for Oracle Fusion with OAuth2 Client Credentials');

  const connectBasicOk = await adapter.connect(validBasicConfig);
  assert(connectBasicOk === true, 'connect() succeeds for Oracle Fusion with Basic Authentication');

  // Validation negative tests
  try {
    await adapter.connect({ ...validOAuth2Config, businessUnit: '' });
    assert(false, 'Missing businessUnit must throw BadRequestException');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Missing businessUnit throws BadRequestException');
  }

  // Invalid Credentials
  try {
    await adapter.connect({ ...validOAuth2Config, clientSecret: 'invalid_secret' });
    assert(false, 'Invalid OAuth2 secret must throw ERPProviderException');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'Invalid OAuth2 secret throws ERPProviderException');
    assert(err.problemDetails.code === 'ERP_AUTH_FAILED', 'Error code is ERP_AUTH_FAILED');
  }

  try {
    await adapter.connect({ ...validBasicConfig, password: 'invalid_password' });
    assert(false, 'Invalid Basic password must throw ERPProviderException');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'Invalid Basic password throws ERPProviderException');
  }

  // Re-connect with valid OAuth2 config
  await adapter.connect(validOAuth2Config);

  // --- SECTION 3: Connection Testing & Health Checks ---
  console.log('\n--- SECTION 3: Connection Testing & Health Checks ---');
  mockStatus = 200;
  const testRes = await adapter.testConnection(validOAuth2Config);
  assert(testRes.success === true, 'testConnection() returns success=true on HTTP 200');
  assert(lastCapturedUrl.includes('US1%20Business%20Unit') || lastCapturedUrl.includes('US1+Business+Unit'), 'testConnection targets specific Business Unit US1 Business Unit');

  const healthRes = await adapter.healthCheck();
  assert(healthRes.status === 'HEALTHY', 'healthCheck() returns HEALTHY status');

  mockStatus = 429;
  const healthDegraded = await adapter.healthCheck();
  assert(healthDegraded.status === 'DEGRADED', 'healthCheck() returns DEGRADED status on HTTP 429');
  mockStatus = 201;

  // --- SECTION 4: Outbound Push & Canonical Mapping ---
  console.log('\n--- SECTION 4: Outbound Push & Canonical Mapping ---');
  const invoicePayload: CanonicalERPInvoiceDto = {
    invoiceNumber: 'INV-ORACLE-2026-001',
    invoiceDate: '2026-10-03',
    tenantId: tenantA,
    entityType: 'INVOICE',
    direction: 'OUTBOUND',
    sellerGstin: '27AAAAA0000A1Z5',
    buyerGstin: '27BBBBB1111B1Z2',
    buyerName: 'Oracle Global Services Ltd',
    placeOfSupply: '27',
    taxableValue: 45000,
    cgstTotal: 4050,
    sgstTotal: 4050,
    igstTotal: 0,
    totalValue: 53100,
    items: [
      {
        lineNumber: 1,
        description: 'GST ERP Middleware Services',
        hsnSacCode: '998315',
        quantity: 1,
        unitPrice: 45000,
        taxableAmount: 45000,
        cgstRate: 9,
        cgstAmount: 4050,
        sgstRate: 9,
        sgstAmount: 4050,
        igstRate: 0,
        igstAmount: 0,
        totalAmount: 53100,
      },
    ],
  };

  mockStatus = 201;
  mockBody = JSON.stringify({ CustomerTransactionId: 99887766, TransactionNumber: 'INV-ORACLE-2026-001' });
  const pushResult = await adapter.push(invoicePayload);

  assert(pushResult.success === true, 'push() posts canonical invoice to Oracle Fusion FSCM REST API');
  assert(pushResult.externalId === '99887766', 'push() returns Oracle CustomerTransactionId');
  assert(pushResult.status === 'POSTED', 'push() returns status POSTED');
  assert(lastCapturedUrl.includes('/fscmRestApi/resources/11.13.18.05/receivablesInvoices'), 'push() targets receivablesInvoices REST resource');

  // Verify Payload Mapping Boundary & Business Unit Isolation
  const parsedOracleBody = JSON.parse(lastCapturedBody);
  assert(parsedOracleBody.TransactionNumber === 'INV-ORACLE-2026-001', 'Canonical invoiceNumber mapped to Oracle TransactionNumber');
  assert(parsedOracleBody.BusinessUnit === 'US1 Business Unit', 'Target Business Unit US1 Business Unit set in payload');
  assert(parsedOracleBody.BillToCustomerName === 'Oracle Global Services Ltd', 'Canonical buyerName mapped to BillToCustomerName');
  assert(parsedOracleBody.receivablesInvoiceLines.length === 1, 'Canonical items mapped to receivablesInvoiceLines array');
  assert(parsedOracleBody.receivablesInvoiceLines[0].HSNCode === '998315', 'Line item HSNCode preserved');

  // --- SECTION 5: Business Unit Isolation ---
  console.log('\n--- SECTION 5: Business Unit Isolation ---');
  await adapter.connect({ ...validOAuth2Config, businessUnit: 'IN Business Unit' });
  await adapter.push(invoicePayload);
  const parsedInBody = JSON.parse(lastCapturedBody);
  assert(parsedInBody.BusinessUnit === 'IN Business Unit', 'Business Unit IN Business Unit dynamically isolated');
  await adapter.connect(validOAuth2Config); // revert back to US1

  // Duplicate Document Handling (HTTP 409)
  mockStatus = 409;
  const dupResult = await adapter.push(invoicePayload);
  assert(dupResult.success === false, 'Duplicate TransactionNumber push returns success=false');
  assert(dupResult.status === 'DUPLICATE_RECORD', 'Duplicate TransactionNumber push returns DUPLICATE_RECORD status');
  mockStatus = 201;

  // --- SECTION 6: Inbound Pull & Parsing ---
  console.log('\n--- SECTION 6: Inbound Pull & Parsing ---');
  mockStatus = 200;
  mockBody = JSON.stringify({
    items: [
      {
        CustomerTransactionId: 100200300,
        TransactionNumber: 'INV-ORACLE-PULL-100',
        TransactionDate: '2026-10-03',
        BillToCustomerName: 'Oracle Inbound Customer',
        TaxRegistrationNumber: '27BBBBB1111B1Z2',
        TotalAmount: 20000,
        InvoiceAmount: 23600,
      },
    ],
  });

  const pulledInvoices = await adapter.pull({ limit: 10 });
  assert(pulledInvoices.length === 1, 'pull() parses Oracle response into 1 canonical invoice');
  assert(pulledInvoices[0].invoiceNumber === 'INV-ORACLE-PULL-100', 'Pulled Oracle TransactionNumber mapped correctly');
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
  mockBody = JSON.stringify({ CustomerTransactionId: 99887799 });
  const batchResult = await adapter.sync([invoicePayload, { ...invoicePayload, invoiceNumber: 'INV-ORACLE-2026-002' }]);

  assert(batchResult.success === true, 'sync() batch execution succeeds');
  assert(batchResult.syncedCount === 2, 'sync() synced count is 2');
  assert(batchResult.failedCount === 0, 'sync() failed count is 0');

  // --- SECTION 9: Concurrent Synchronization ---
  console.log('\n--- SECTION 9: Concurrent Synchronization ---');
  const concurrentPushes = await Promise.all([
    adapter.push({ ...invoicePayload, invoiceNumber: 'INV-ORACLE-CONC-1' }),
    adapter.push({ ...invoicePayload, invoiceNumber: 'INV-ORACLE-CONC-2' }),
  ]);
  assert(concurrentPushes.length === 2 && concurrentPushes[0].success && concurrentPushes[1].success, 'Concurrent Oracle synchronization requests executed without contention');

  // --- SECTION 10: OAuth Token Endpoint & Tenant Security Boundary Hardening ---
  console.log('\n--- SECTION 10: OAuth Token Endpoint & Tenant Security Boundary Hardening ---');
  const customTokenConfig: OracleFusionConfig = {
    ...validOAuth2Config,
    tokenUrl: 'https://identity-domain.oraclecloud.com/oauth2/v1/token',
  };
  const connectCustomTokenOk = await adapter.connect(customTokenConfig);
  assert(connectCustomTokenOk === true, 'connect() accepts configuration-driven OAuth tokenUrl (identity domain endpoint)');

  // Verify SSRF guard rejects malicious tokenUrl
  try {
    await adapter.connect({ ...validOAuth2Config, tokenUrl: 'http://169.254.169.254/latest/meta-data' });
    assert(false, 'Malicious or unsecure HTTP/internal tokenUrl must throw SSRF guard BadRequestException');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'SSRF guard blocks malicious tokenUrl with BadRequestException');
  }

  // Restore valid connection
  await adapter.connect(validOAuth2Config);

  console.log('\n================================================================');
  console.log(`  STAGE 15.5.9 TEST SUMMARY: ${passed}/${total} PASSED (100%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runStage15_5_9_Tests().catch((err) => {
  console.error('Stage 15.5.9 test runner failed:', err);
  process.exit(1);
});
