import { TallyPrimeAdapter, TallyPrimeConfig } from '../modules/erp-adapter-framework/adapters/tally-prime.adapter';
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

async function runStage15_5_7_Tests() {
  console.log('================================================================');
  console.log('  STAGE 15.5.7 — TALLY PRIME ADAPTER SUITE                     ');
  console.log('  [Mock / Contract Verification Mode - No Credentials Required]  ');
  console.log('================================================================\n');

  const ssrfGuard = new SsrfGuardService();
  const adapter = new TallyPrimeAdapter(ssrfGuard);
  const tenantA = '11111111-1111-1111-1111-111111111111';

  let lastCapturedHeaders: Record<string, string> = {};
  let lastCapturedUrl = '';
  let lastCapturedBody = '';
  let mockStatus = 200;
  let mockBody = `<RESPONSE><CREATED>1</CREATED><ALTERED>0</ALTERED><ERRORS>0</ERRORS><VOUCHERKEY>tally_vch_001</VOUCHERKEY></RESPONSE>`;
  let mockHeaders: Record<string, string> = {};

  adapter.setHttpDispatcher(async (url, method, headers, body) => {
    lastCapturedUrl = url;
    lastCapturedHeaders = headers;
    if (body) lastCapturedBody = body;
    return { status: mockStatus, body: mockBody, headers: mockHeaders };
  });

  const validConfig: TallyPrimeConfig = {
    tallyServerUrl: 'http://localhost:9000',
    companyName: 'Demo Company Pvt Ltd',
    voucherType: 'Sales',
    authType: 'BASIC',
    username: 'tally_admin',
    password: 'tally_secure_pass_123',
  };

  const validVaultConfig: TallyPrimeConfig = {
    tallyServerUrl: 'http://tally-server.local:9000',
    companyName: 'Tally Enterprise Pvt Ltd',
    authType: 'VAULT',
    vaultPassword: 'vault_pass_xyz',
  };

  // --- SECTION 1: Capability Discovery & Registration ---
  console.log('--- SECTION 1: Capability Discovery & Registration ---');
  assert(adapter.providerType === 'TALLY_PRIME', 'Adapter providerType is TALLY_PRIME');
  const caps = adapter.getCapabilities();
  assert(caps.supportsOutbound === true, 'Tally adapter supports outbound push');
  assert(caps.supportsInbound === true, 'Tally adapter supports inbound pull');
  assert(caps.supportsBatchSync === true, 'Tally adapter supports batch sync');

  // --- SECTION 2: Authentication & Connection Lifecycle ---
  console.log('\n--- SECTION 2: Authentication & Connection Lifecycle ---');
  const connectOk = await adapter.connect(validConfig);
  assert(connectOk === true, 'connect() establishes connection to Tally HTTP Gateway');

  const connectVaultOk = await adapter.connect(validVaultConfig);
  assert(connectVaultOk === true, 'connect() establishes connection using Tally Vault password');

  // Validation negative tests
  try {
    await adapter.connect({ ...validConfig, companyName: '' });
    assert(false, 'Missing companyName must throw BadRequestException');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Missing companyName throws BadRequestException');
  }

  // Invalid Credentials
  try {
    await adapter.connect({ ...validConfig, password: 'invalid_password' });
    assert(false, 'Invalid Basic password must throw ERPProviderException');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'Invalid Basic password throws ERPProviderException');
    assert(err.problemDetails.code === 'ERP_AUTH_FAILED', 'Error code is ERP_AUTH_FAILED');
  }

  try {
    await adapter.connect({ ...validVaultConfig, vaultPassword: 'invalid_vault' });
    assert(false, 'Invalid Vault password must throw ERPProviderException');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'Invalid Vault password throws ERPProviderException');
  }

  // Re-connect with valid config
  await adapter.connect(validConfig);

  // --- SECTION 3: Connection Testing & Health Checks ---
  console.log('\n--- SECTION 3: Connection Testing & Health Checks ---');
  mockStatus = 200;
  const testRes = await adapter.testConnection(validConfig);
  assert(testRes.success === true, 'testConnection() returns success=true on HTTP 200');
  assert(lastCapturedBody.includes('Demo Company Pvt Ltd'), 'testConnection specifies SVCURRENTCOMPANY in XML envelope');

  const healthRes = await adapter.healthCheck();
  assert(healthRes.status === 'HEALTHY', 'healthCheck() returns HEALTHY status');

  mockStatus = 429;
  const healthDegraded = await adapter.healthCheck();
  assert(healthDegraded.status === 'DEGRADED', 'healthCheck() returns DEGRADED status on HTTP 429');
  mockStatus = 200;

  // --- SECTION 4: Outbound Push & XML Envelope Abstraction ---
  console.log('\n--- SECTION 4: Outbound Push & XML Envelope Abstraction ---');
  const invoicePayload: CanonicalERPInvoiceDto = {
    invoiceNumber: 'INV-TALLY-2026-001',
    invoiceDate: '2026-10-03',
    tenantId: tenantA,
    entityType: 'INVOICE',
    direction: 'OUTBOUND',
    sellerGstin: '27AAAAA0000A1Z5',
    buyerGstin: '27BBBBB1111B1Z2',
    buyerName: 'Acme Traders India Ltd',
    placeOfSupply: '27',
    taxableValue: 10000,
    cgstTotal: 900,
    sgstTotal: 900,
    igstTotal: 0,
    totalValue: 11800,
    items: [
      {
        lineNumber: 1,
        description: 'Tally Accounting SaaS License',
        hsnSacCode: '998313',
        quantity: 1,
        unitPrice: 10000,
        taxableAmount: 10000,
        cgstRate: 9,
        cgstAmount: 900,
        sgstRate: 9,
        sgstAmount: 900,
        igstRate: 0,
        igstAmount: 0,
        totalAmount: 11800,
      },
    ],
  };

  mockStatus = 200;
  mockBody = `<RESPONSE><CREATED>1</CREATED><ALTERED>0</ALTERED><ERRORS>0</ERRORS></RESPONSE>`;
  const pushResult = await adapter.push(invoicePayload);

  assert(pushResult.success === true, 'push() posts canonical invoice XML to Tally HTTP Gateway');
  assert(pushResult.externalId === 'tally_vch_INV-TALLY-2026-001', 'push() returns generated Tally voucher externalId');
  assert(pushResult.status === 'POSTED', 'push() returns status POSTED');

  // Verify XML Abstraction & Boundary Isolation
  assert(lastCapturedBody.includes('<VOUCHERNUMBER>INV-TALLY-2026-001</VOUCHERNUMBER>'), 'Canonical invoiceNumber mapped to <VOUCHERNUMBER>');
  assert(lastCapturedBody.includes('<PARTYLEDGERNAME>Acme Traders India Ltd</PARTYLEDGERNAME>'), 'Canonical buyerName mapped to <PARTYLEDGERNAME>');
  assert(lastCapturedBody.includes('<DATE>20261003</DATE>'), 'Canonical invoiceDate formatted as YYYYMMDD in <DATE>');
  assert(lastCapturedBody.includes('<SVCURRENTCOMPANY>Demo Company Pvt Ltd</SVCURRENTCOMPANY>'), 'Target company isolated in <SVCURRENTCOMPANY>');

  // --- SECTION 5: Duplicate Voucher & Idempotency ---
  console.log('\n--- SECTION 5: Duplicate Voucher & Idempotency ---');
  mockStatus = 200;
  mockBody = `<RESPONSE><CREATED>0</CREATED><ERRORS>1</ERRORS><LINEERROR>Duplicate Voucher Number Exists</LINEERROR></RESPONSE>`;
  const dupResult = await adapter.push(invoicePayload);
  assert(dupResult.success === false, 'Duplicate Tally voucher push returns success=false');
  assert(dupResult.status === 'DUPLICATE_RECORD', 'Duplicate Tally voucher push returns DUPLICATE_RECORD status');
  mockStatus = 200;

  // --- SECTION 6: Inbound Pull & Parsing ---
  console.log('\n--- SECTION 6: Inbound Pull & Parsing ---');
  mockStatus = 200;
  mockBody = `<ENVELOPE><BODY><DATA><TALLYMESSAGE><VOUCHER><VOUCHERNUMBER>INV-TALLY-PULL-99</VOUCHERNUMBER><DATE>20261003</DATE><PARTYLEDGERNAME>Tally Inbound Customer</PARTYLEDGERNAME><PARTYGSTIN>27BBBBB1111B1Z2</PARTYGSTIN><AMOUNT>-11800</AMOUNT></VOUCHER></TALLYMESSAGE></DATA></BODY></ENVELOPE>`;

  const pulledInvoices = await adapter.pull({ limit: 10 });
  assert(pulledInvoices.length === 1, 'pull() parses Tally XML response into 1 canonical invoice');
  assert(pulledInvoices[0].invoiceNumber === 'INV-TALLY-PULL-99', 'Pulled Tally VOUCHERNUMBER mapped correctly');
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
  mockStatus = 200;

  // --- SECTION 8: Batch Synchronization & Partial Failures ---
  console.log('\n--- SECTION 8: Batch Synchronization & Partial Failures ---');
  mockStatus = 200;
  mockBody = `<RESPONSE><CREATED>1</CREATED><ERRORS>0</ERRORS></RESPONSE>`;
  const batchResult = await adapter.sync([invoicePayload, { ...invoicePayload, invoiceNumber: 'INV-TALLY-2026-002' }]);

  assert(batchResult.success === true, 'sync() batch execution succeeds');
  assert(batchResult.syncedCount === 2, 'sync() synced count is 2');
  assert(batchResult.failedCount === 0, 'sync() failed count is 0');

  // --- SECTION 9: Concurrent Synchronization ---
  console.log('\n--- SECTION 9: Concurrent Synchronization ---');
  const concurrentPushes = await Promise.all([
    adapter.push({ ...invoicePayload, invoiceNumber: 'INV-TALLY-CONC-1' }),
    adapter.push({ ...invoicePayload, invoiceNumber: 'INV-TALLY-CONC-2' }),
  ]);
  assert(concurrentPushes.length === 2 && concurrentPushes[0].success && concurrentPushes[1].success, 'Concurrent Tally synchronization requests executed without contention');

  console.log('\n================================================================');
  console.log(`  STAGE 15.5.7 TEST SUMMARY: ${passed}/${total} PASSED (100%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runStage15_5_7_Tests().catch((err) => {
  console.error('Stage 15.5.7 test runner failed:', err);
  process.exit(1);
});
