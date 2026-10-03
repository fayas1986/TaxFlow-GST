import { ERPAdapterRegistryService } from '../modules/erp-adapter-framework/services/erp-adapter-registry.service';
import { IntegrationConnectionService } from '../modules/erp-adapter-framework/services/integration-connection.service';
import { IntegrationMappingService } from '../modules/erp-adapter-framework/services/integration-mapping.service';
import { MockErpAdapter } from '../modules/erp-adapter-framework/mocks/mock-erp-adapter';
import { CryptographyService } from '../modules/security/cryptography.service';
import { SsrfGuardService } from '../modules/webhooks/ssrf-guard.service';
import { PrismaService } from '../common/services/prisma.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

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

async function runStage15_6_2_Tests() {
  console.log('================================================================');
  console.log('  STAGE 15.6.2 — INTEGRATION MAPPING & VERSION MANAGEMENT SUITE ');
  console.log('  [Versioning, Immutability, Rollback & Security Verification]  ');
  console.log('================================================================\n');

  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';

  const registry = new ERPAdapterRegistryService();
  const cryptoService = new CryptographyService();
  const ssrfGuard = new SsrfGuardService();

  const mockDbConnections: Map<string, any> = new Map();
  const mockDbMappings: Map<string, any> = new Map();
  const mockDbRuns: Map<string, any> = new Map();
  const mockAuditLogs: any[] = [];
  const mockOutboxMessages: any[] = [];

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
    integrationMapping: {
      create: async ({ data }: any) => {
        // Enforce Database Unique Constraint @@unique([connectionId, entityType, version])
        for (const existing of mockDbMappings.values()) {
          if (
            existing.tenantId === data.tenantId &&
            existing.connectionId === data.connectionId &&
            existing.entityType === data.entityType &&
            existing.version === data.version
          ) {
            const err: any = new Error(`UNIQUE constraint failed: connectionId, entityType, version (${data.version})`);
            err.code = 'P2002';
            throw err;
          }
        }

        const id = 'map-' + Math.random().toString(36).substring(7);
        const record = {
          ...data,
          id,
          version: data.version || 1,
          isActive: data.isActive !== undefined ? data.isActive : true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockDbMappings.set(id, record);
        return record;
      },
      findFirst: async ({ where, orderBy }: any) => {
        let matches: any[] = [];
        for (const map of mockDbMappings.values()) {
          let isMatch = true;
          if (where?.id && map.id !== where.id) isMatch = false;
          if (where?.tenantId && map.tenantId !== where.tenantId) isMatch = false;
          if (where?.connectionId && map.connectionId !== where.connectionId) isMatch = false;
          if (where?.entityType && map.entityType !== where.entityType) isMatch = false;
          if (where?.version && map.version !== where.version) isMatch = false;
          if (where?.isActive !== undefined && map.isActive !== where.isActive) isMatch = false;
          if (isMatch) matches.push(map);
        }
        if (orderBy?.version === 'desc') {
          matches.sort((a, b) => b.version - a.version);
        }
        return matches.length > 0 ? matches[0] : null;
      },
      findMany: async ({ where, orderBy }: any) => {
        let matches: any[] = [];
        for (const map of mockDbMappings.values()) {
          let isMatch = true;
          if (where?.tenantId && map.tenantId !== where.tenantId) isMatch = false;
          if (where?.connectionId && map.connectionId !== where.connectionId) isMatch = false;
          if (where?.entityType && map.entityType !== where.entityType) isMatch = false;
          if (where?.isActive !== undefined && map.isActive !== where.isActive) isMatch = false;
          if (isMatch) matches.push(map);
        }
        if (orderBy?.version === 'asc') {
          matches.sort((a, b) => a.version - b.version);
        } else if (orderBy?.version === 'desc') {
          matches.sort((a, b) => b.version - a.version);
        }
        return matches;
      },
      update: async ({ where, data }: any) => {
        const map = mockDbMappings.get(where.id);
        if (map) {
          const updated = { ...map, ...data, updatedAt: new Date() };
          mockDbMappings.set(where.id, updated);
          return updated;
        }
        return null;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const [id, map] of mockDbMappings.entries()) {
          let isMatch = true;
          if (where?.tenantId && map.tenantId !== where.tenantId) isMatch = false;
          if (where?.connectionId && map.connectionId !== where.connectionId) isMatch = false;
          if (where?.entityType && map.entityType !== where.entityType) isMatch = false;
          if (where?.version && map.version !== where.version) isMatch = false;
          if (isMatch) {
            mockDbMappings.set(id, { ...map, ...data, updatedAt: new Date() });
            count++;
          }
        }
        return { count };
      },
      delete: async ({ where }: any) => {
        const map = mockDbMappings.get(where.id);
        if (map) {
          mockDbMappings.delete(where.id);
          return map;
        }
        return null;
      },
    },
    integrationRun: {
      count: async ({ where }: any) => {
        let count = 0;
        for (const run of mockDbRuns.values()) {
          if (run.connectionId === where.connectionId && run.mappingVersion === where.mappingVersion) {
            count++;
          }
        }
        return count;
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

  const genericRestAdapter = new MockErpAdapter('GENERIC_REST');
  registry.registerAdapter(genericRestAdapter);

  const connectionService = new IntegrationConnectionService(
    mockPrisma,
    cryptoService,
    ssrfGuard,
    mockAuditService,
    registry,
  );

  const mappingService = new IntegrationMappingService(
    mockPrisma,
    connectionService,
    mockAuditService,
    registry,
  );

  // Setup active connection for Tenant A
  const connA = await connectionService.createConnection(
    tenantA,
    'GENERIC_REST',
    'Tenant A Rest Connection',
    'https://api.erp.example.com/v1',
    { apiKey: 'key1' },
  );
  await connectionService.activateConnection(tenantA, connA.id);

  // --- SECTION 1: Mapping Creation & Initial Versioning (v1) ---
  console.log('--- SECTION 1: Mapping Creation & Initial Versioning (v1) ---');

  const fieldMappingsV1 = [
    { canonicalField: 'invoiceNumber', erpField: 'DocNum', direction: 'BOTH', required: true },
    { canonicalField: 'totalValue', erpField: 'DocTotal', direction: 'OUTBOUND', required: true },
    { canonicalField: 'sellerGstin', erpField: 'SellerGST', direction: 'OUTBOUND' },
    { canonicalField: 'buyerGstin', erpField: 'BuyerGST', direction: 'OUTBOUND' },
  ];

  const mapV1 = await mappingService.createMapping(
    tenantA,
    connA.id,
    'INVOICE',
    fieldMappingsV1,
    { dateFormat: 'YYYY-MM-DD' },
  );

  assert(mapV1.id !== undefined, 'createMapping() returns generated mapping ID');
  assert(mapV1.version === 1, 'Initial mapping version is 1');
  assert(mapV1.isActive === true, 'Initial mapping is active (isActive=true)');
  assert(mapV1.entityType === 'INVOICE', 'EntityType set to INVOICE');
  assert(mockAuditLogs.some(a => a.action === 'INTEGRATION_MAPPING_CREATED'), 'Audit event INTEGRATION_MAPPING_CREATED logged');
  assert(mockOutboxMessages.some(m => m.eventType === 'integration.mapping.created'), 'Outbox event integration.mapping.created written');

  // Verify Required Canonical Field Validation
  try {
    await mappingService.createMapping(
      tenantA,
      connA.id,
      'INVOICE',
      [{ canonicalField: 'sellerGstin', erpField: 'SellerGST' }], // Missing invoiceNumber & totalValue
    );
    assert(false, 'Mapping missing required canonical fields should throw BadRequestException');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Mapping validation rejects missing required canonical fields');
  }

  // --- SECTION 2: Version Incrementing & Active Mapping Isolation ---
  console.log('\n--- SECTION 2: Version Incrementing & Active Mapping Isolation ---');

  const fieldMappingsV2 = [
    ...fieldMappingsV1,
    { canonicalField: 'placeOfSupply', erpField: 'POS', direction: 'OUTBOUND' },
  ];

  const mapV2 = await mappingService.updateMapping(
    tenantA,
    connA.id,
    'INVOICE',
    fieldMappingsV2,
    { dateFormat: 'YYYY-MM-DD', currencyDefault: 'INR' },
  );

  assert(mapV2.version === 2, 'Updating mapping increments version to 2');
  assert(mapV2.isActive === true, 'Version 2 is now active');

  const activeMap = await mappingService.getActiveMapping(tenantA, connA.id, 'INVOICE');
  assert(activeMap.version === 2, 'getActiveMapping() returns active Version 2');

  const historicalV1 = await mappingService.getMappingVersion(tenantA, connA.id, 'INVOICE', 1);
  assert(historicalV1.version === 1, 'getMappingVersion(1) retrieves Version 1');
  assert(historicalV1.isActive === false, 'Version 1 is now inactive (isActive=false)');
  assert(mockOutboxMessages.some(m => m.eventType === 'integration.mapping.updated'), 'Outbox event integration.mapping.updated written');

  // --- SECTION 3: Rollback & Version Activation ---
  console.log('\n--- SECTION 3: Rollback & Version Activation ---');

  const rolledBack = await mappingService.rollbackMapping(tenantA, connA.id, 'INVOICE', 1);
  assert(rolledBack.version === 1, 'rollbackMapping(1) targets Version 1');
  assert(rolledBack.isActive === true, 'Rolled back Version 1 is now active');

  const activeAfterRollback = await mappingService.getActiveMapping(tenantA, connA.id, 'INVOICE');
  assert(activeAfterRollback.version === 1, 'getActiveMapping() confirms Version 1 is active after rollback');
  assert(mockAuditLogs.some(a => a.action === 'INTEGRATION_MAPPING_ROLLED_BACK'), 'Audit event INTEGRATION_MAPPING_ROLLED_BACK logged');
  assert(mockOutboxMessages.some(m => m.eventType === 'integration.mapping.rolled_back'), 'Outbox event integration.mapping.rolled_back written');

  // Re-activate Version 2 for next tests
  await mappingService.activateMappingVersion(tenantA, connA.id, 'INVOICE', 2);

  // --- SECTION 4: Immutability of Used Historical Mapping Versions ---
  console.log('\n--- SECTION 4: Immutability of Used Historical Mapping Versions ---');

  // Register mock run referencing Version 1
  mockDbRuns.set('run-1', {
    id: 'run-1',
    connectionId: connA.id,
    mappingVersion: 1,
    state: 'COMPLETED',
  });

  // Attempting to delete Version 1 must fail because it was used in run-1
  try {
    await mappingService.deleteMappingVersion(tenantA, connA.id, 'INVOICE', 1);
    assert(false, 'Deleting used historical mapping version should throw BadRequestException');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Historical mapping version used by integration run is immutable');
  }

  // --- SECTION 5: Connection Eligibility & Provider Compatibility ---
  console.log('\n--- SECTION 5: Connection Eligibility & Provider Compatibility ---');

  // Setup disabled connection for Tenant A
  const connDisabled = await connectionService.createConnection(
    tenantA,
    'GENERIC_REST',
    'Disabled Connection',
    'https://api.erp.example.com/disabled',
    { apiKey: 'key' },
  );
  await connectionService.disableConnection(tenantA, connDisabled.id);

  try {
    await mappingService.createMapping(
      tenantA,
      connDisabled.id,
      'INVOICE',
      fieldMappingsV1,
    );
    assert(false, 'Creating mapping on DISABLED connection should throw BadRequestException');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Mapping creation rejected on ineligible/disabled connection');
  }

  // --- SECTION 6: Tenant Security Boundary & Cross-Tenant Access Guards ---
  console.log('\n--- SECTION 6: Tenant Security Boundary & Cross-Tenant Access Guards ---');

  try {
    await mappingService.getActiveMapping(tenantB, connA.id, 'INVOICE');
    assert(false, 'Cross-tenant getActiveMapping() should throw NotFoundException');
  } catch (err: any) {
    assert(err instanceof NotFoundException, 'Cross-tenant getActiveMapping() throws NotFoundException');
  }

  try {
    await mappingService.updateMapping(tenantB, connA.id, 'INVOICE', fieldMappingsV2);
    assert(false, 'Cross-tenant updateMapping() should throw NotFoundException');
  } catch (err: any) {
    assert(err instanceof NotFoundException, 'Cross-tenant updateMapping() throws NotFoundException');
  }

  try {
    await mappingService.rollbackMapping(tenantB, connA.id, 'INVOICE', 1);
    assert(false, 'Cross-tenant rollbackMapping() should throw NotFoundException');
  } catch (err: any) {
    assert(err instanceof NotFoundException, 'Cross-tenant rollbackMapping() throws NotFoundException');
  }

  // --- SECTION 7: In-Process Concurrent Mapping Updates ---
  console.log('\n--- SECTION 7: In-Process Concurrent Mapping Updates ---');

  const concurrentUpdates = await Promise.all([
    mappingService.updateMapping(tenantA, connA.id, 'INVOICE', fieldMappingsV1, { note: 'concurrent 1' }),
    mappingService.updateMapping(tenantA, connA.id, 'INVOICE', fieldMappingsV2, { note: 'concurrent 2' }),
  ]);

  assert(concurrentUpdates.length === 2, 'Concurrent mapping updates completed cleanly');
  const versions = concurrentUpdates.map(u => u.version);
  assert(versions.includes(3) && versions.includes(4), 'Concurrent mapping updates received distinct version numbers (3 and 4)');

  const finalActive = await mappingService.getActiveMapping(tenantA, connA.id, 'INVOICE');
  assert(finalActive.version === 4, 'Highest version (4) remains active after concurrent updates');

  // --- SECTION 8: Database Unique Constraint & Bypassed Lock Concurrency Hardening ---
  console.log('\n--- SECTION 8: Database Unique Constraint & Bypassed Lock Concurrency Hardening ---');

  // Simulate multiple independent process API nodes calling updateMapping() with in-memory lock bypassed:
  const bypassedUpdates = await Promise.all([
    mappingService.updateMapping(tenantA, connA.id, 'INVOICE', fieldMappingsV1, { node: 'api-pod-1' }, true),
    mappingService.updateMapping(tenantA, connA.id, 'INVOICE', fieldMappingsV2, { node: 'api-pod-2' }, true),
  ]);

  assert(bypassedUpdates.length === 2, 'Multi-node updates with bypassed in-process lock completed successfully via DB unique constraint retry');
  const dbVersions = Array.from(mockDbMappings.values())
    .filter(m => m.tenantId === tenantA && m.connectionId === connA.id && m.entityType === 'INVOICE')
    .map(m => m.version);

  // Verify DB Invariants:
  const uniqueVersions = new Set(dbVersions);
  assert(uniqueVersions.size === dbVersions.length, 'Invariant 1: Zero duplicate version numbers in database persistence layer');

  const activeMappings = Array.from(mockDbMappings.values())
    .filter(m => m.tenantId === tenantA && m.connectionId === connA.id && m.entityType === 'INVOICE' && m.isActive === true);
  assert(activeMappings.length === 1, 'Invariant 2: Exactly ONE mapping version is active in database');

  const activeInDb = activeMappings[0];
  const highestVersionInDb = Math.max(...dbVersions);
  assert(activeInDb.version === highestVersionInDb, `Invariant 3: Active mapping version (${activeInDb.version}) corresponds to highest persisted version (${highestVersionInDb})`);

  // Summary
  console.log('\n================================================================');
  console.log(`  STAGE 15.6.2 TEST SUMMARY: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================\n');

  if (passed === total) {
    console.log('VERIFICATION RESULT: ALL STAGE 15.6.2 TESTS PASSED 100%');
  } else {
    console.error('VERIFICATION RESULT: STAGE 15.6.2 TESTS FAILED');
    process.exit(1);
  }
}

runStage15_6_2_Tests();
