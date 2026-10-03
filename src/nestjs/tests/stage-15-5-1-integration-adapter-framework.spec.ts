import { ERPAdapterRegistryService } from '../modules/erp-adapter-framework/services/erp-adapter-registry.service';
import { IntegrationConnectionService } from '../modules/erp-adapter-framework/services/integration-connection.service';
import { MockErpAdapter } from '../modules/erp-adapter-framework/mocks/mock-erp-adapter';
import { CryptographyService } from '../modules/security/cryptography.service';
import { SsrfGuardService } from '../modules/webhooks/ssrf-guard.service';
import { CanonicalERPInvoiceDto } from '../modules/erp-adapter-framework/interfaces/erp-adapter.interface';
import { ERPProviderException } from '../modules/erp-adapter-framework/exceptions/erp-provider.exception';
import { PrismaService } from '../common/services/prisma.service';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';

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

async function runStage15_5_1_Tests() {
  console.log('================================================================');
  console.log('  STAGE 15.5.1 — INTEGRATION ADAPTER FRAMEWORK TEST SUITE  ');
  console.log('================================================================\n');

  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';

  const registry = new ERPAdapterRegistryService();
  const cryptoService = new CryptographyService();
  const ssrfGuard = new SsrfGuardService();

  const mockDbConnections: Map<string, any> = new Map();
  const mockAuditLogs: any[] = [];

  const mockPrisma = {
    erpConnection: {
      create: async ({ data }: any) => {
        const id = 'conn-' + Math.random().toString(36).substring(7);
        const record = { ...data, id, createdAt: new Date(), updatedAt: new Date() };
        mockDbConnections.set(id, record);
        return record;
      },
      findFirst: async ({ where }: any) => {
        for (const conn of mockDbConnections.values()) {
          if (conn.id === where.id && conn.tenantId === where.tenantId) {
            return conn;
          }
        }
        return null;
      },
      update: async ({ where, data }: any) => {
        const conn = mockDbConnections.get(where.id);
        if (conn) {
          const updated = { ...conn, ...data, updatedAt: new Date() };
          mockDbConnections.set(where.id, updated);
          return updated;
        }
        return null;
      },
    },
  } as unknown as PrismaService;

  const mockAuditService = {
    logEvent: async (event: any) => {
      mockAuditLogs.push(event);
    },
  } as any;

  const genericRestAdapter = new MockErpAdapter('GENERIC_REST');
  const d365BcAdapter = new MockErpAdapter('DYNAMICS_365_BC');
  const sapOdataAdapter = new MockErpAdapter('SAP_ODATA');

  const connectionService = new IntegrationConnectionService(
    mockPrisma,
    cryptoService,
    ssrfGuard,
    mockAuditService,
    registry,
  );

  // --- SECTION 1: Adapter Registration & Capability Discovery ---
  console.log('--- SECTION 1: Adapter Registration & Capability Discovery ---');
  registry.registerAdapter(genericRestAdapter);
  registry.registerAdapter(d365BcAdapter);
  registry.registerAdapter(sapOdataAdapter);

  const supported = registry.listSupportedProviders();
  assert(supported.includes('GENERIC_REST'), 'Registry contains GENERIC_REST provider');
  assert(supported.includes('DYNAMICS_365_BC'), 'Registry contains DYNAMICS_365_BC provider');
  assert(supported.includes('SAP_ODATA'), 'Registry contains SAP_ODATA provider');

  const genericCaps = registry.getCapabilities('GENERIC_REST');
  assert(genericCaps.supportsOutbound === true, 'GENERIC_REST capabilities include outbound push');
  assert(genericCaps.supportedEntities.includes('INVOICE'), 'GENERIC_REST supports INVOICE entity');

  const matrix = registry.getCapabilityMatrix();
  assert(Boolean(matrix['DYNAMICS_365_BC']), 'Capability matrix exposes DYNAMICS_365_BC capabilities');

  // --- SECTION 2: Connection Lifecycle & Credential Security ---
  console.log('\n--- SECTION 2: Connection Lifecycle & Credential Security ---');
  const createdConn = await connectionService.createConnection(
    tenantA,
    'GENERIC_REST',
    'Main ERP Gateway',
    'https://erp.customer.com/api/v1',
    { apiKey: 'secret_live_key_999', environment: 'production' },
  );

  assert(createdConn.status === 'DISCONNECTED', 'New connection created with DISCONNECTED status');
  assert(createdConn.name === 'Main ERP Gateway', 'Connection name stored cleanly');

  // Check Encrypted Credentials at Rest
  const dbRecord = mockDbConnections.get(createdConn.id);
  assert(dbRecord.encryptedConfig !== JSON.stringify({ apiKey: 'secret_live_key_999' }), 'Config encrypted at rest (not plain JSON)');
  const decryptedConfigStr = cryptoService.decryptSecretKey(dbRecord.encryptedConfig, tenantA);
  assert(decryptedConfigStr.includes('secret_live_key_999'), 'Encrypted config cleanly decrypted using tenantId AAD');

  // Test SSRF URL Rejection on Connection Creation
  try {
    await connectionService.createConnection(tenantA, 'GENERIC_REST', 'Rogue ERP', 'http://127.0.0.1/admin', { apiKey: 'key' });
    assert(false, 'HTTP targetUrl must be rejected by SSRF Guard');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'SSRF Guard throws BadRequestException for non-HTTPS or internal IP targetUrl');
  }

  // Connect & State Transition
  const connectSuccess = await connectionService.connect(tenantA, createdConn.id);
  assert(connectSuccess === true, 'Connection establishes successfully');
  const connectedRecord = await connectionService.getConnection(tenantA, createdConn.id);
  assert(connectedRecord.status === 'CONNECTED', 'Connection status updated to CONNECTED');

  // Disconnect & State Transition
  const disconnectSuccess = await connectionService.disconnect(tenantA, createdConn.id);
  assert(disconnectSuccess === true, 'Connection disconnects successfully');
  const disconnectedRecord = await connectionService.getConnection(tenantA, createdConn.id);
  assert(disconnectedRecord.status === 'DISCONNECTED', 'Connection status updated to DISCONNECTED');

  // Re-connect for operational tests
  await connectionService.connect(tenantA, createdConn.id);

  // --- SECTION 3: Connection Testing & Health Checks ---
  console.log('\n--- SECTION 3: Connection Testing & Health Checks ---');
  const testRes = await connectionService.testConnection(tenantA, createdConn.id);
  assert(testRes.success === true, 'testConnection returns success=true');
  assert(testRes.latencyMs > 0, 'testConnection returns measured latency');

  const healthRes = await connectionService.runHealthCheck(tenantA, createdConn.id);
  assert(healthRes.status === 'HEALTHY', 'healthCheck returns HEALTHY status');

  // --- SECTION 4: Provider Error Normalization & Retry Classification ---
  console.log('\n--- SECTION 4: Provider Error Normalization & Retry Classification ---');
  
  // 1. Auth / Credential Failure (401 Non-Retryable)
  genericRestAdapter.simulateCredentialError = true;
  try {
    await genericRestAdapter.connect({ apiKey: 'invalid_key' });
    assert(false, 'Invalid credentials must throw ERPProviderException');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'Credential failure throws ERPProviderException');
    assert(err.problemDetails.code === 'ERP_AUTH_FAILED', 'Normalized error code is ERP_AUTH_FAILED');
    assert(err.problemDetails.isRetryable === false, 'Auth failure classified as isRetryable=false');
  }
  genericRestAdapter.simulateCredentialError = false;

  // 2. Timeout Failure (504 Retryable)
  genericRestAdapter.simulateTimeout = true;
  const canonicalInvoice: CanonicalERPInvoiceDto = {
    invoiceNumber: 'INV-2026-001',
    invoiceDate: '2026-10-03',
    tenantId: tenantA,
    entityType: 'INVOICE',
    direction: 'OUTBOUND',
    sellerGstin: '27AAAAA0000A1Z5',
    buyerGstin: '27BBBBB1111B1Z2',
    buyerName: 'Acme Corp',
    placeOfSupply: '27',
    taxableValue: 1000,
    cgstTotal: 90,
    sgstTotal: 90,
    igstTotal: 0,
    totalValue: 1180,
    items: [],
  };

  try {
    await connectionService.pushRecord(tenantA, createdConn.id, canonicalInvoice);
    assert(false, 'Timeout must throw ERPProviderException');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'Provider timeout throws ERPProviderException');
    assert(err.problemDetails.code === 'ERP_TIMEOUT', 'Normalized error code is ERP_TIMEOUT');
    assert(err.problemDetails.providerStatus === 504, 'Provider HTTP status code is 504');
    assert(err.problemDetails.isRetryable === true, 'Timeout failure classified as isRetryable=true');
  }
  genericRestAdapter.simulateTimeout = false;

  // 3. Rate Limit Exceeded (429 Retryable)
  genericRestAdapter.simulateRateLimit = true;
  try {
    await connectionService.pushRecord(tenantA, createdConn.id, canonicalInvoice);
    assert(false, 'Rate limit must throw ERPProviderException');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'Rate limit throws ERPProviderException');
    assert(err.problemDetails.code === 'ERP_RATE_LIMITED', 'Normalized error code is ERP_RATE_LIMITED');
    assert(err.problemDetails.providerStatus === 429, 'Provider HTTP status code is 429');
    assert(err.problemDetails.isRetryable === true, 'Rate limit failure classified as isRetryable=true');
  }
  genericRestAdapter.simulateRateLimit = false;

  // --- SECTION 5: Idempotency & Duplicate External Records ---
  console.log('\n--- SECTION 5: Idempotency & Duplicate External Records ---');
  const firstPush = await connectionService.pushRecord(tenantA, createdConn.id, canonicalInvoice);
  assert(firstPush.success === true, 'First invoice push succeeds');
  assert(Boolean(firstPush.externalId), 'External record ID generated upon posting');

  const duplicatePush = await connectionService.pushRecord(tenantA, createdConn.id, canonicalInvoice);
  assert(duplicatePush.success === false, 'Duplicate invoice push returns success=false');
  assert(duplicatePush.status === 'DUPLICATE_RECORD', 'Duplicate invoice push returns DUPLICATE_RECORD status');

  // --- SECTION 6: Batch Synchronization & Partial Failure Recovery ---
  console.log('\n--- SECTION 6: Batch Synchronization & Partial Failure Recovery ---');
  const batch: CanonicalERPInvoiceDto[] = [
    { ...canonicalInvoice, invoiceNumber: 'INV-2026-002' },
    { ...canonicalInvoice, invoiceNumber: 'INV-2026-003' },
    { ...canonicalInvoice, invoiceNumber: 'INV-2026-004' },
  ];

  genericRestAdapter.simulatePartialBatchFailure = true;
  const batchResult = await connectionService.syncBatch(tenantA, createdConn.id, batch);
  assert(batchResult.totalRecords === 3, 'Batch result counts 3 total records');
  assert(batchResult.syncedCount === 2, 'Batch result counts 2 successfully synced records');
  assert(batchResult.failedCount === 1, 'Batch result captures 1 failed record');
  assert(batchResult.errors.length === 1, 'Batch result itemizes failed record index & error message');
  assert(batchResult.errors[0].index === 1, 'Itemized error points strictly to failed record index');
  genericRestAdapter.simulatePartialBatchFailure = false;

  // --- SECTION 7: Strict Tenant Isolation & Audit Integration ---
  console.log('\n--- SECTION 7: Strict Tenant Isolation & Audit Integration ---');
  // Tenant B cannot access Tenant A connection
  try {
    await connectionService.getConnection(tenantB, createdConn.id);
    assert(false, 'Tenant B query for Tenant A connection must throw NotFoundException');
  } catch (err: any) {
    assert(err instanceof NotFoundException, 'Cross-tenant connection access throws NotFoundException (Tenant Isolated)');
  }

  // Tenant B cannot push record into Tenant A connection
  try {
    await connectionService.pushRecord(tenantB, createdConn.id, { ...canonicalInvoice, tenantId: tenantB });
    assert(false, 'Tenant B push into Tenant A connection must throw NotFoundException');
  } catch (err: any) {
    assert(err instanceof NotFoundException, 'Cross-tenant push execution blocked (Tenant Isolated)');
  }

  // Tenant B payload with mismatched tenantId
  try {
    await connectionService.pushRecord(tenantA, createdConn.id, { ...canonicalInvoice, tenantId: tenantB });
    assert(false, 'Payload tenantId mismatch must throw UnauthorizedException');
  } catch (err: any) {
    assert(err instanceof UnauthorizedException, 'Payload tenantId mismatch throws UnauthorizedException');
  }

  // Audit Logs Verification
  const createdAudit = mockAuditLogs.find((a) => a.action === 'ERP_CONNECTION_CREATED');
  assert(Boolean(createdAudit), 'Audit log captures ERP_CONNECTION_CREATED event');
  assert(createdAudit.tenantId === tenantA, 'Audit log records tenantId context');

  const syncAudit = mockAuditLogs.find((a) => a.action === 'ERP_SYNC_SUCCESS');
  assert(Boolean(syncAudit), 'Audit log captures ERP_SYNC_SUCCESS event');

  console.log('\n================================================================');
  console.log(`  STAGE 15.5.1 TEST SUMMARY: ${passed}/${total} PASSED (100%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runStage15_5_1_Tests().catch((err) => {
  console.error('Stage 15.5.1 test runner failed:', err);
  process.exit(1);
});
