import { ERPAdapterRegistryService } from '../modules/erp-adapter-framework/services/erp-adapter-registry.service';
import { IntegrationConnectionService } from '../modules/erp-adapter-framework/services/integration-connection.service';
import { IntegrationMappingService } from '../modules/erp-adapter-framework/services/integration-mapping.service';
import { IntegrationRunService } from '../modules/erp-adapter-framework/services/integration-run.service';
import { MockErpAdapter } from '../modules/erp-adapter-framework/mocks/mock-erp-adapter';
import { CryptographyService } from '../modules/security/cryptography.service';
import { SsrfGuardService } from '../modules/webhooks/ssrf-guard.service';
import { PrismaService } from '../common/services/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

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

async function runStage15_6_3_Tests() {
  console.log('================================================================');
  console.log('  STAGE 15.6.3 — INTEGRATION RUN & CHECKPOINT ENGINE SUITE      ');
  console.log('  [Safe Checkpoint Advancement & Run Lifecycle Verification]     ');
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
        const id = 'map-' + Math.random().toString(36).substring(7);
        const record = { ...data, id, version: data.version || 1, isActive: true, createdAt: new Date(), updatedAt: new Date() };
        mockDbMappings.set(id, record);
        return record;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const [id, map] of mockDbMappings.entries()) {
          if (map.tenantId === where.tenantId && map.connectionId === where.connectionId && map.entityType === where.entityType) {
            mockDbMappings.set(id, { ...map, ...data });
            count++;
          }
        }
        return { count };
      },
      findFirst: async ({ where }: any) => {
        for (const map of mockDbMappings.values()) {
          if (map.tenantId === where.tenantId && map.connectionId === where.connectionId && map.entityType === where.entityType && map.isActive) {
            return map;
          }
        }
        return null;
      },
    },
    integrationRun: {
      create: async ({ data }: any) => {
        const id = 'run-' + Math.random().toString(36).substring(7);
        const record = {
          ...data,
          id,
          state: data.state || 'REQUESTED',
          checkpoint: data.checkpoint || {},
          totalRecords: data.totalRecords || 0,
          processedRecords: data.processedRecords || 0,
          succeededRecords: data.succeededRecords || 0,
          failedRecords: data.failedRecords || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockDbRuns.set(id, record);
        return record;
      },
      findFirst: async ({ where, orderBy }: any) => {
        let matches: any[] = [];
        for (const run of mockDbRuns.values()) {
          let isMatch = true;
          if (where?.id && run.id !== where.id) isMatch = false;
          if (where?.tenantId && run.tenantId !== where.tenantId) isMatch = false;
          if (where?.connectionId && run.connectionId !== where.connectionId) isMatch = false;
          if (where?.state) {
            if (typeof where.state === 'string' && run.state !== where.state) isMatch = false;
            if (where.state.in && !where.state.in.includes(run.state)) isMatch = false;
          }
          if (isMatch) matches.push(run);
        }
        if (orderBy?.createdAt === 'desc') {
          matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return matches.length > 0 ? matches[0] : null;
      },
      findMany: async ({ where }: any) => {
        let matches: any[] = [];
        for (const run of mockDbRuns.values()) {
          let isMatch = true;
          if (where?.tenantId && run.tenantId !== where.tenantId) isMatch = false;
          if (where?.connectionId && run.connectionId !== where.connectionId) isMatch = false;
          if (where?.state) {
            if (typeof where.state === 'string' && run.state !== where.state) isMatch = false;
            if (where.state.in && !where.state.in.includes(run.state)) isMatch = false;
          }
          if (isMatch) matches.push(run);
        }
        return matches;
      },
      update: async ({ where, data }: any) => {
        const run = mockDbRuns.get(where.id);
        if (run) {
          const updated = { ...run, ...data, updatedAt: new Date() };
          mockDbRuns.set(where.id, updated);
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

  const runService = new IntegrationRunService(
    mockPrisma,
    connectionService,
    mappingService,
    mockAuditService,
    registry,
  );

  // Setup active connection & mapping for Tenant A
  const connA = await connectionService.createConnection(
    tenantA,
    'GENERIC_REST',
    'Tenant A Primary ERP',
    'https://api.erp.example.com/v1',
    { apiKey: 'key1' },
  );
  await connectionService.activateConnection(tenantA, connA.id);

  await mappingService.createMapping(
    tenantA,
    connA.id,
    'INVOICE',
    [
      { canonicalField: 'invoiceNumber', erpField: 'DocNum', direction: 'BOTH', required: true },
      { canonicalField: 'totalValue', erpField: 'DocTotal', direction: 'OUTBOUND', required: true },
    ],
  );

  // --- SECTION 1: Sync Run Creation & Full Lifecycle ---
  console.log('--- SECTION 1: Sync Run Creation & Full Lifecycle ---');

  const run1 = await runService.triggerSync(tenantA, connA.id, {
    direction: 'OUTBOUND',
    mode: 'FULL',
    entityType: 'INVOICE',
    triggerType: 'MANUAL',
  });

  assert(run1.id !== undefined, 'triggerSync() returns generated run ID');
  assert(run1.state === 'QUEUED', 'Triggered run initial state is QUEUED');
  assert(run1.mode === 'FULL', 'Run mode is FULL');
  assert(mockAuditLogs.some(a => a.action === 'INTEGRATION_RUN_REQUESTED'), 'Audit event INTEGRATION_RUN_REQUESTED logged');
  assert(mockOutboxMessages.some(m => m.eventType === 'integration.run.requested'), 'Outbox event integration.run.requested written');

  // Execute sync run to completion
  const sampleInvoices = [
    { invoiceNumber: 'INV-001', totalValue: 1000, tenantId: tenantA, entityType: 'INVOICE', direction: 'OUTBOUND', sellerGstin: '27A', buyerGstin: '27B', buyerName: 'B1', placeOfSupply: '27', taxableValue: 1000, cgstTotal: 0, sgstTotal: 0, igstTotal: 0, items: [] },
    { invoiceNumber: 'INV-002', totalValue: 2000, tenantId: tenantA, entityType: 'INVOICE', direction: 'OUTBOUND', sellerGstin: '27A', buyerGstin: '27B', buyerName: 'B2', placeOfSupply: '27', taxableValue: 2000, cgstTotal: 0, sgstTotal: 0, igstTotal: 0, items: [] },
  ];

  const executedRun1 = await runService.executeSyncRun(tenantA, run1.id, sampleInvoices);
  assert(executedRun1.state === 'COMPLETED', 'Clean execution transitions run state QUEUED -> RUNNING -> COMPLETED');
  assert(executedRun1.succeededRecords === 2, 'succeededRecords equals 2');
  assert(executedRun1.failedRecords === 0, 'failedRecords equals 0');
  assert(executedRun1.completedAt !== undefined, 'completedAt timestamp populated');
  assert(mockAuditLogs.some(a => a.action === 'INTEGRATION_RUN_COMPLETED'), 'Audit event INTEGRATION_RUN_COMPLETED logged');
  assert(mockOutboxMessages.some(m => m.eventType === 'integration.run.completed'), 'Outbox event integration.run.completed written');

  // --- SECTION 2: Connection Eligibility & Pre-Run Invariants ---
  console.log('\n--- SECTION 2: Connection Eligibility & Pre-Run Invariants ---');

  // Disabled connection cannot trigger sync
  const connDisabled = await connectionService.createConnection(
    tenantA,
    'GENERIC_REST',
    'Disabled Connection',
    'https://api.erp.example.com/disabled',
    { apiKey: 'key' },
  );
  await connectionService.disableConnection(tenantA, connDisabled.id);

  try {
    await runService.triggerSync(tenantA, connDisabled.id, { direction: 'OUTBOUND', mode: 'FULL' });
    assert(false, 'Triggering sync on DISABLED connection should throw BadRequestException');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Sync trigger rejected on ineligible/disabled connection');
  }

  // --- SECTION 3: Safe Checkpoint Advancement & Crash Recovery ---
  console.log('\n--- SECTION 3: Safe Checkpoint Advancement & Crash Recovery ---');

  // Trigger incremental run
  const run2 = await runService.triggerSync(tenantA, connA.id, {
    direction: 'OUTBOUND',
    mode: 'INCREMENTAL',
    entityType: 'INVOICE',
    triggerType: 'MANUAL',
  });

  // Execute with batch slice 1 (commit succeeds)
  const batch1 = [sampleInvoices[0]];
  const run2Part1 = await runService.processBatchSlice(tenantA, run2.id, batch1, {
    lastProcessedId: 'INV-001',
    lastTimestamp: '2026-10-03T12:00:00.000Z',
    batchSequence: 1,
  });

  assert(run2Part1.checkpoint.lastProcessedId === 'INV-001', 'Checkpoint advanced AFTER batch 1 durably committed');
  assert(run2Part1.succeededRecords === 1, 'succeededRecords count updated to 1');

  // Simulate batch slice 2 failure during commit (record processing failure)
  try {
    await runService.processBatchSlice(
      tenantA,
      run2.id,
      [sampleInvoices[1]],
      { lastProcessedId: 'INV-002', lastTimestamp: '2026-10-03T12:05:00.000Z', batchSequence: 2 },
      true, // Simulate DB commit failure
    );
    assert(false, 'Simulated batch commit failure should throw Error');
  } catch (err: any) {
    assert(err.message.includes('Simulated commit failure'), 'Batch commit failure intercepted');
  }

  // Verify Checkpoint Invariant: Checkpoint MUST NOT advance ahead of failed record processing
  const run2AfterCrash = await runService.getSyncRun(tenantA, run2.id);
  assert(
    run2AfterCrash.checkpoint.lastProcessedId === 'INV-001',
    'Checkpoint INVARIANT verified: Checkpoint remained at last valid committed watermark (INV-001) and did NOT skip uncommitted record INV-002',
  );

  // Resume / Safe Replay from committed checkpoint (INV-001)
  const resumedRun = await runService.processBatchSlice(tenantA, run2.id, [sampleInvoices[1]], {
    lastProcessedId: 'INV-002',
    lastTimestamp: '2026-10-03T12:05:00.000Z',
    batchSequence: 2,
  });
  await runService.finalizeSyncRun(tenantA, run2.id);

  const finalResumed = await runService.getSyncRun(tenantA, run2.id);
  assert(finalResumed.checkpoint.lastProcessedId === 'INV-002', 'Checkpoint safely advanced to INV-002 after successful retry');
  assert(finalResumed.succeededRecords === 2, 'All records processed cleanly after safe replay');

  // --- SECTION 4: Full vs Incremental Sync Checkpoint Resolution ---
  console.log('\n--- SECTION 4: Full vs Incremental Sync Checkpoint Resolution ---');

  const incRun = await runService.triggerSync(tenantA, connA.id, {
    direction: 'OUTBOUND',
    mode: 'INCREMENTAL',
    entityType: 'INVOICE',
  });

  const resolvedCheckpoint = await runService.resolveRunStartingCheckpoint(tenantA, incRun.id);
  assert(resolvedCheckpoint.lastProcessedId === 'INV-002', 'INCREMENTAL mode cleanly inherits previous run committed checkpoint (INV-002)');
  await runService.cancelSyncRun(tenantA, incRun.id);

  const fullRun = await runService.triggerSync(tenantA, connA.id, {
    direction: 'OUTBOUND',
    mode: 'FULL',
    entityType: 'INVOICE',
  });
  const fullCheckpoint = await runService.resolveRunStartingCheckpoint(tenantA, fullRun.id);
  assert(fullCheckpoint.lastProcessedId === undefined, 'FULL mode ignores prior checkpoint and starts clean');

  // Clean up active test runs for concurrency test
  await runService.cancelSyncRun(tenantA, fullRun.id);

  // --- SECTION 5: Concurrency & Duplicate Active Run Protection ---
  console.log('\n--- SECTION 5: Concurrency & Duplicate Active Run Protection ---');

  const activeRun = await runService.triggerSync(tenantA, connA.id, {
    direction: 'OUTBOUND',
    mode: 'INCREMENTAL',
  });

  try {
    await runService.triggerSync(tenantA, connA.id, {
      direction: 'OUTBOUND',
      mode: 'INCREMENTAL',
    });
    assert(false, 'Triggering concurrent sync on active connection should throw BadRequestException');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Concurrent synchronization run blocked for active connection');
  }

  // --- SECTION 6: Run Cancellation & Partial Failure ---
  console.log('\n--- SECTION 6: Run Cancellation & Partial Failure ---');

  const cancelled = await runService.cancelSyncRun(tenantA, activeRun.id);
  assert(cancelled.state === 'CANCELLED', 'cancelSyncRun() transitions state QUEUED -> CANCELLED');
  assert(mockOutboxMessages.some(m => m.eventType === 'integration.run.cancelled'), 'Outbox event integration.run.cancelled written');

  // --- SECTION 7: Tenant Boundary & Cross-Tenant Access Guards ---
  console.log('\n--- SECTION 7: Tenant Boundary & Cross-Tenant Access Guards ---');

  try {
    await runService.getSyncRun(tenantB, run1.id);
    assert(false, 'Cross-tenant getSyncRun() should throw NotFoundException');
  } catch (err: any) {
    assert(err instanceof NotFoundException, 'Cross-tenant getSyncRun() throws NotFoundException');
  }

  try {
    await runService.cancelSyncRun(tenantB, run1.id);
    assert(false, 'Cross-tenant cancelSyncRun() should throw NotFoundException');
  } catch (err: any) {
    assert(err instanceof NotFoundException, 'Cross-tenant cancelSyncRun() throws NotFoundException');
  }

  // Summary
  console.log('\n================================================================');
  console.log(`  STAGE 15.6.3 TEST SUMMARY: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================\n');

  if (passed === total) {
    console.log('VERIFICATION RESULT: ALL STAGE 15.6.3 TESTS PASSED 100%');
  } else {
    console.error('VERIFICATION RESULT: STAGE 15.6.3 TESTS FAILED');
    process.exit(1);
  }
}

runStage15_6_3_Tests();
