import { ERPAdapterRegistryService } from '../modules/erp-adapter-framework/services/erp-adapter-registry.service';
import { IntegrationConnectionService } from '../modules/erp-adapter-framework/services/integration-connection.service';
import { MockErpAdapter } from '../modules/erp-adapter-framework/mocks/mock-erp-adapter';
import { CryptographyService } from '../modules/security/cryptography.service';
import { SsrfGuardService } from '../modules/webhooks/ssrf-guard.service';
import { PrismaService } from '../common/services/prisma.service';
import { BadRequestException, NotFoundException, UnauthorizedException, ForbiddenException } from '@nestjs/common';

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

async function runStage15_6_1_Tests() {
  console.log('================================================================');
  console.log('  STAGE 15.6.1 — INTEGRATION CONNECTION & CREDENTIAL LIFECYCLE ');
  console.log('  [State Machine, Tenant Boundary & Entitlement Verification]   ');
  console.log('================================================================\n');

  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';

  const registry = new ERPAdapterRegistryService();
  const cryptoService = new CryptographyService();
  const ssrfGuard = new SsrfGuardService();

  const mockDbConnections: Map<string, any> = new Map();
  const mockAuditLogs: any[] = [];
  const mockOutboxMessages: any[] = [];
  const tenantQuotaMap: Map<string, { maxConnections: number }> = new Map([
    [tenantA, { maxConnections: 3 }],
    [tenantB, { maxConnections: 1 }],
  ]);

  const mockPrisma = {
    erpConnection: {
      create: async ({ data }: any) => {
        const id = 'conn-' + Math.random().toString(36).substring(7);
        const record = {
          ...data,
          id,
          state: data.state || 'CREATED',
          credentialState: data.credentialState || 'ACTIVE',
          environment: data.environment || 'PRODUCTION',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
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
      findMany: async ({ where }: any) => {
        const results: any[] = [];
        for (const conn of mockDbConnections.values()) {
          if (!where?.tenantId || conn.tenantId === where.tenantId) {
            if (!where?.state || conn.state === where.state) {
              results.push(conn);
            }
          }
        }
        return results;
      },
      count: async ({ where }: any) => {
        let count = 0;
        for (const conn of mockDbConnections.values()) {
          if (conn.tenantId === where.tenantId) {
            if (!where.state || (Array.isArray(where.state.in) ? where.state.in.includes(conn.state) : conn.state === where.state)) {
              count++;
            }
          }
        }
        return count;
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
    outboxMessage: {
      create: async ({ data }: any) => {
        mockOutboxMessages.push(data);
        return data;
      },
    },
  } as unknown as PrismaService;

  const mockAuditService = {
    logEvent: async (event: any) => {
      mockAuditLogs.push(event);
    },
  } as any;

  const mockEntitlementService = {
    checkConnectionQuota: async (tenantId: string) => {
      const activeCount = await mockPrisma.erpConnection.count({
        where: { tenantId, state: { in: ['ACTIVE', 'CONFIGURING', 'DEGRADED'] } },
      });
      const quota = tenantQuotaMap.get(tenantId)?.maxConnections || 5;
      if (activeCount >= quota) {
        throw new ForbiddenException(`Tenant connection quota exceeded (${activeCount}/${quota})`);
      }
    },
  };

  const genericRestAdapter = new MockErpAdapter('GENERIC_REST');
  const d365BcAdapter = new MockErpAdapter('DYNAMICS_365_BC');
  registry.registerAdapter(genericRestAdapter);
  registry.registerAdapter(d365BcAdapter);

  const connectionService = new IntegrationConnectionService(
    mockPrisma,
    cryptoService,
    ssrfGuard,
    mockAuditService,
    registry,
    mockEntitlementService as any,
  );

  // --- SECTION 1: Connection Registration & Entitlements ---
  console.log('--- SECTION 1: Connection Registration & Entitlements ---');
  
  const conn1 = await connectionService.createConnection(
    tenantA,
    'GENERIC_REST',
    'Tenant A Primary ERP',
    'https://api.erp.example.com/v1',
    { apiKey: 'secret-key-123', clientSecret: 'my-oauth-secret' },
  );

  assert(conn1.id !== undefined, 'createConnection() returns generated ID');
  assert(conn1.state === 'CREATED', 'Initial connection state is CREATED');
  assert(conn1.credentialState === 'ACTIVE', 'Initial credential state is ACTIVE');
  assert(mockOutboxMessages.some(m => m.eventType === 'integration.connection.created'), 'Outbox event integration.connection.created written');

  // Verify SSRF Guard protection on targetUrl
  try {
    await connectionService.createConnection(
      tenantA,
      'GENERIC_REST',
      'Malicious ERP',
      'http://169.254.169.254/latest/meta-data',
      { apiKey: 'key' },
    );
    assert(false, 'Malicious internal IP targetUrl should throw BadRequestException');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'SSRF Guard blocks internal IP targetUrl');
  }

  // --- SECTION 2: Connection Lifecycle State Machine Transitions ---
  console.log('\n--- SECTION 2: Connection Lifecycle State Machine Transitions ---');

  // CREATED -> CONFIGURING
  const configured = await connectionService.configureConnection(tenantA, conn1.id, {
    targetUrl: 'https://api.erp.example.com/v2',
    plainConfig: { apiKey: 'updated-key-456' },
  });
  assert(configured.state === 'CONFIGURING', 'Transition CREATED -> CONFIGURING succeeds');

  // CONFIGURING -> ACTIVE (Handshake succeeds)
  const activated = await connectionService.activateConnection(tenantA, conn1.id);
  assert(activated.state === 'ACTIVE', 'Handshake test PASS transitions CONFIGURING -> ACTIVE');
  assert(mockOutboxMessages.some(m => m.eventType === 'integration.connection.activated'), 'Outbox event integration.connection.activated written');

  // ACTIVE -> DEGRADED (Health check rate-limit / transient failure)
  const degraded = await connectionService.markDegraded(tenantA, conn1.id, 'HTTP 429 Rate Limit Exceeded');
  assert(degraded.state === 'DEGRADED', 'Transition ACTIVE -> DEGRADED succeeds');
  assert(mockOutboxMessages.some(m => m.eventType === 'integration.connection.degraded'), 'Outbox event integration.connection.degraded written');

  // DEGRADED -> ACTIVE (Health check recovery)
  const restored = await connectionService.restoreActive(tenantA, conn1.id);
  assert(restored.state === 'ACTIVE', 'Transition DEGRADED -> ACTIVE succeeds on recovery');

  // ACTIVE -> DISABLED (User manual deactivation)
  const disabled = await connectionService.disableConnection(tenantA, conn1.id);
  assert(disabled.state === 'DISABLED', 'Transition ACTIVE -> DISABLED succeeds');
  assert(mockOutboxMessages.some(m => m.eventType === 'integration.connection.disabled'), 'Outbox event integration.connection.disabled written');

  // DISABLED -> CONFIGURING (Re-enable)
  const reenabled = await connectionService.enableConnection(tenantA, conn1.id);
  assert(reenabled.state === 'CONFIGURING', 'Transition DISABLED -> CONFIGURING succeeds');

  // Reactivate for further tests
  await connectionService.activateConnection(tenantA, conn1.id);

  // --- SECTION 3: Credential Lifecycle & Rotation ---
  console.log('\n--- SECTION 3: Credential Lifecycle & Rotation ---');

  // Credential Rotation (ACTIVE -> ACTIVE with updated encrypted credentials)
  const rotated = await connectionService.rotateCredentials(tenantA, conn1.id, {
    apiKey: 'new-rotated-key-789',
    tokenUrl: 'https://auth.erp.example.com/oauth2/token',
  });
  assert(rotated.credentialState === 'ACTIVE', 'Credential rotation updates credentials and maintains ACTIVE state');
  assert(mockAuditLogs.some(a => a.action === 'INTEGRATION_CREDENTIAL_ROTATED'), 'Audit event INTEGRATION_CREDENTIAL_ROTATED logged');

  // SSRF Protection on OAuth tokenUrl during rotation
  try {
    await connectionService.rotateCredentials(tenantA, conn1.id, {
      tokenUrl: 'http://127.0.0.1/admin',
    });
    assert(false, 'Malicious tokenUrl in rotation should throw BadRequestException');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'SSRF Guard blocks malicious tokenUrl during rotation');
  }

  // Check Credential Expiry Flagging
  const expiringResult = await connectionService.checkCredentialExpiry(tenantA, conn1.id, {
    expiresAt: new Date(Date.now() + 3 * 86400 * 1000).toISOString(), // 3 days in future
  });
  assert(expiringResult.credentialState === 'EXPIRING', 'Credentials expiring within threshold flag credentialState as EXPIRING');

  const expiredResult = await connectionService.checkCredentialExpiry(tenantA, conn1.id, {
    expiresAt: new Date(Date.now() - 1000).toISOString(), // Past date
  });
  assert(expiredResult.credentialState === 'EXPIRED', 'Past expiry date sets credentialState to EXPIRED');
  assert(expiredResult.state === 'AUTH_FAILED', 'EXPIRED credentials automatically set connection state to AUTH_FAILED');

  // Revoke Credentials (EXPIRING/EXPIRED -> REVOKED)
  const revoked = await connectionService.revokeCredentials(tenantA, conn1.id);
  assert(revoked.credentialState === 'REVOKED', 'revokeCredentials() sets credentialState to REVOKED');
  assert(revoked.state === 'DISABLED', 'revoked credentials automatically set connection state to DISABLED');

  // --- SECTION 4: Tenant Boundary & Cross-Tenant Access Guards ---
  console.log('\n--- SECTION 4: Tenant Boundary & Cross-Tenant Access Guards ---');

  // Attempting cross-tenant connection retrieval must fail
  try {
    await connectionService.getConnection(tenantB, conn1.id);
    assert(false, 'Cross-tenant getConnection() should throw NotFoundException');
  } catch (err: any) {
    assert(err instanceof NotFoundException, 'Cross-tenant getConnection() throws NotFoundException');
  }

  // Attempting cross-tenant credential rotation must fail
  try {
    await connectionService.rotateCredentials(tenantB, conn1.id, { apiKey: 'hacked' });
    assert(false, 'Cross-tenant rotateCredentials() should throw NotFoundException');
  } catch (err: any) {
    assert(err instanceof NotFoundException, 'Cross-tenant rotateCredentials() throws NotFoundException');
  }

  // Attempting cross-tenant activation must fail
  try {
    await connectionService.activateConnection(tenantB, conn1.id);
    assert(false, 'Cross-tenant activateConnection() should throw NotFoundException');
  } catch (err: any) {
    assert(err instanceof NotFoundException, 'Cross-tenant activateConnection() throws NotFoundException');
  }

  // --- SECTION 5: Entitlement Quota Enforcement ---
  console.log('\n--- SECTION 5: Entitlement Quota Enforcement ---');

  // Tenant B has quota of 1 connection. Create 1 connection:
  const connTenantB = await connectionService.createConnection(
    tenantB,
    'GENERIC_REST',
    'Tenant B Connection 1',
    'https://tenantb.erp.com',
    { apiKey: 'key-b-1' },
  );
  await connectionService.activateConnection(tenantB, connTenantB.id);

  // Attempt to create second connection for Tenant B should throw ForbiddenException
  try {
    await connectionService.createConnection(
      tenantB,
      'GENERIC_REST',
      'Tenant B Connection 2 (Over Quota)',
      'https://tenantb.erp.com',
      { apiKey: 'key-b-2' },
    );
    assert(false, 'Exceeding tenant active connection quota should throw ForbiddenException');
  } catch (err: any) {
    assert(err instanceof ForbiddenException, 'Stage 10 Entitlement Guard blocks over-quota connection creation');
  }

  // Summary
  console.log('\n================================================================');
  console.log(`  STAGE 15.6.1 TEST SUMMARY: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================\n');

  if (passed === total) {
    console.log('VERIFICATION RESULT: ALL STAGE 15.6.1 TESTS PASSED 100%');
  } else {
    console.error('VERIFICATION RESULT: STAGE 15.6.1 TESTS FAILED');
    process.exit(1);
  }
}

runStage15_6_1_Tests();
