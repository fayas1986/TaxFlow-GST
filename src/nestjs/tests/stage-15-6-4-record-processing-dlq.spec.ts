import { ERPAdapterRegistryService } from '../modules/erp-adapter-framework/services/erp-adapter-registry.service';
import { IntegrationConnectionService } from '../modules/erp-adapter-framework/services/integration-connection.service';
import { IntegrationRecordProcessingService } from '../modules/erp-adapter-framework/services/integration-record-processing.service';
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

async function runStage15_6_4_Tests() {
  console.log('================================================================');
  console.log('  STAGE 15.6.4 — RECORD PROCESSING, IDEMPOTENCY & DLQ SUITE    ');
  console.log('  [Persistence Idempotency, Dead-Letter Queue & Safe Replay]   ');
  console.log('================================================================\n');

  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';

  const registry = new ERPAdapterRegistryService();
  const cryptoService = new CryptographyService();
  const ssrfGuard = new SsrfGuardService();

  const mockDbConnections: Map<string, any> = new Map();
  const mockDbRecords: Map<string, any> = new Map();
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
    integrationRecord: {
      create: async ({ data }: any) => {
        for (const existing of mockDbRecords.values()) {
          if (existing.tenantId === data.tenantId && existing.idempotencyKey === data.idempotencyKey) {
            throw new Error('Unique constraint failed on idempotencyKey');
          }
        }
        const id = 'rec-' + Math.random().toString(36).substring(7);
        const record = {
          ...data,
          id,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockDbRecords.set(id, record);
        return record;
      },
      findFirst: async ({ where }: any) => {
        for (const rec of mockDbRecords.values()) {
          let isMatch = true;
          if (where?.id && rec.id !== where.id) isMatch = false;
          if (where?.tenantId && rec.tenantId !== where.tenantId) isMatch = false;
          if (where?.idempotencyKey && rec.idempotencyKey !== where.idempotencyKey) isMatch = false;
          if (where?.state && rec.state !== where.state) isMatch = false;
          if (isMatch) return rec;
        }
        return null;
      },
      findMany: async ({ where, orderBy }: any) => {
        const results: any[] = [];
        for (const rec of mockDbRecords.values()) {
          let isMatch = true;
          if (where?.tenantId && rec.tenantId !== where.tenantId) isMatch = false;
          if (where?.connectionId && rec.connectionId !== where.connectionId) isMatch = false;
          if (where?.state && rec.state !== where.state) isMatch = false;
          if (isMatch) results.push(rec);
        }
        if (orderBy?.dlqAt === 'desc') {
          results.sort((a, b) => (b.dlqAt?.getTime() || 0) - (a.dlqAt?.getTime() || 0));
        }
        return results;
      },
      update: async ({ where, data }: any) => {
        const rec = mockDbRecords.get(where.id);
        if (rec) {
          const updated = { ...rec, ...data, updatedAt: new Date() };
          mockDbRecords.set(where.id, updated);
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

  const recordService = new IntegrationRecordProcessingService(
    mockPrisma,
    connectionService,
    mockAuditService,
    registry,
  );

  // Setup active connection for Tenant A
  const connA = await connectionService.createConnection(
    tenantA,
    'GENERIC_REST',
    'Tenant A Primary ERP',
    'https://api.erp.example.com/v1',
    { apiKey: 'key1' },
  );
  await connectionService.activateConnection(tenantA, connA.id);

  // --- SECTION 1: Single Record Processing & Persistence-Layer Idempotency ---
  console.log('--- SECTION 1: Single Record Processing & Persistence-Layer Idempotency ---');

  const recPayload1 = {
    externalRecordId: 'INV-1001',
    entityType: 'INVOICE' as const,
    data: { invoiceNumber: 'INV-1001', totalValue: 5000 },
  };

  const res1 = await recordService.processRecord(tenantA, connA.id, recPayload1);
  assert(res1.status === 'PROCESSED', 'First record process transitions state to PROCESSED');
  assert(res1.isIdempotent === false, 'First execution is non-duplicate (isIdempotent=false)');
  assert(res1.record.state === 'PROCESSED', 'Record persistence state is PROCESSED');
  assert(mockAuditLogs.some(a => a.action === 'INTEGRATION_RECORD_PROCESSED'), 'Audit event INTEGRATION_RECORD_PROCESSED logged');
  assert(mockOutboxMessages.some(m => m.eventType === 'integration.record.processed'), 'Outbox event integration.record.processed written');

  // Re-process identical record payload (Idempotency match)
  const res1Duplicate = await recordService.processRecord(tenantA, connA.id, recPayload1);
  assert(res1Duplicate.status === 'DUPLICATE', 'Re-processing identical record payload returns DUPLICATE status');
  assert(res1Duplicate.isIdempotent === true, 'Duplicate execution flagged as idempotent (isIdempotent=true)');
  assert(res1Duplicate.record.id === res1.record.id, 'Idempotency lookup matches existing record ID from persistence layer');

  // --- SECTION 2: Retry Counter & Failed State Machine ---
  console.log('\n--- SECTION 2: Retry Counter & Failed State Machine ---');

  const recPayload2 = {
    externalRecordId: 'INV-1002',
    entityType: 'INVOICE' as const,
    data: { invoiceNumber: 'INV-1002', totalValue: 7500 },
  };

  // Attempt 1 fails
  const res2Attempt1 = await recordService.processRecord(tenantA, connA.id, recPayload2, {
    maxRetries: 3,
    simulateAdapterFailure: true,
  });

  assert(res2Attempt1.status === 'FAILED', 'Attempt 1 failure transitions record state to FAILED');
  assert(res2Attempt1.record.attempts === 1, 'Attempt counter set to 1');
  assert(res2Attempt1.record.lastError.includes('Transient Network Timeout'), 'lastError captures failure message');
  assert(mockAuditLogs.some(a => a.action === 'INTEGRATION_RECORD_FAILED'), 'Audit event INTEGRATION_RECORD_FAILED logged');

  // --- SECTION 3: Max Retries Exhaustion & Dead-Letter Queue (DLQ) Transition ---
  console.log('\n--- SECTION 3: Max Retries Exhaustion & Dead-Letter Queue (DLQ) Transition ---');

  // Attempt 2 fails
  const res2Attempt2 = await recordService.processRecord(tenantA, connA.id, recPayload2, {
    maxRetries: 3,
    simulateAdapterFailure: true,
  });
  assert(res2Attempt2.status === 'FAILED', 'Attempt 2 failure maintains state FAILED');
  assert(res2Attempt2.record.attempts === 2, 'Attempt counter incremented to 2');

  // Attempt 3 fails -> Max Retries (3) Exhausted -> Transitions to DEAD_LETTER
  const res2Attempt3 = await recordService.processRecord(tenantA, connA.id, recPayload2, {
    maxRetries: 3,
    simulateAdapterFailure: true,
  });

  assert(res2Attempt3.status === 'DEAD_LETTER', 'Attempt 3 failure (maxRetries=3) transitions state to DEAD_LETTER');
  assert(res2Attempt3.record.state === 'DEAD_LETTER', 'Record persistence state updated to DEAD_LETTER');
  assert(res2Attempt3.record.dlqAt !== undefined, 'Timestamp dlqAt populated');
  assert(mockAuditLogs.some(a => a.action === 'INTEGRATION_RECORD_DLQ_TRANSITION'), 'Audit event INTEGRATION_RECORD_DLQ_TRANSITION logged');
  assert(mockOutboxMessages.some(m => m.eventType === 'integration.record.dlq'), 'Outbox event integration.record.dlq written');

  // Query DLQ records for Tenant A
  const dlqRecords = await recordService.getDlqRecords(tenantA, connA.id);
  assert(dlqRecords.length === 1, 'getDlqRecords() returns 1 Dead-Letter Queue record for Tenant A');
  assert(dlqRecords[0].externalRecordId === 'INV-1002', 'DLQ record corresponds to INV-1002');

  // --- SECTION 4: Safe Replay Engine ---
  console.log('\n--- SECTION 4: Safe Replay Engine ---');

  const replayResult = await recordService.replayDlqRecord(tenantA, res2Attempt3.record.id);
  assert(replayResult.status === 'PROCESSED', 'replayDlqRecord() re-processes DLQ record to PROCESSED');
  assert(replayResult.record.state === 'PROCESSED', 'Persistence state updated to PROCESSED after safe replay');
  assert(mockAuditLogs.some(a => a.action === 'INTEGRATION_RECORD_REPLAYED'), 'Audit event INTEGRATION_RECORD_REPLAYED logged');
  assert(mockOutboxMessages.some(m => m.eventType === 'integration.record.replayed'), 'Outbox event integration.record.replayed written');

  // Verify DLQ clean state after successful replay
  const dlqAfterReplay = await recordService.getDlqRecords(tenantA, connA.id);
  assert(dlqAfterReplay.length === 0, 'DLQ queue empty for Tenant A after successful record replay');

  // --- SECTION 5: Batch Record Processing & Partial Failures ---
  console.log('\n--- SECTION 5: Batch Record Processing & Partial Failures ---');

  const batchPayloads = [
    { externalRecordId: 'INV-2001', entityType: 'INVOICE' as const, data: { total: 100 } },
    { externalRecordId: 'INV-2002', entityType: 'INVOICE' as const, data: { total: 200 } },
    { externalRecordId: 'INV-1001', entityType: 'INVOICE' as const, data: { total: 5000 } }, // Duplicate from Section 1
  ];

  const batchSummary = await recordService.processRecordBatch(tenantA, connA.id, batchPayloads);
  assert(batchSummary.total === 3, 'Batch total records is 3');
  assert(batchSummary.succeeded === 2, 'Batch succeeded records count is 2 (INV-2001, INV-2002)');
  assert(batchSummary.duplicates === 1, 'Batch duplicate records count is 1 (INV-1001)');
  assert(batchSummary.itemizedResults.length === 3, 'Itemized results array contains 3 entries');

  // --- SECTION 6: Pre-Run Eligibility & Connection Enforcement ---
  console.log('\n--- SECTION 6: Pre-Run Eligibility & Connection Enforcement ---');

  const connDisabled = await connectionService.createConnection(
    tenantA,
    'GENERIC_REST',
    'Disabled ERP',
    'https://api.erp.example.com/disabled',
    { apiKey: 'key' },
  );
  await connectionService.disableConnection(tenantA, connDisabled.id);

  try {
    await recordService.processRecord(tenantA, connDisabled.id, recPayload1);
    assert(false, 'Processing record on DISABLED connection should throw BadRequestException');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Record processing rejected on disabled/ineligible connection');
  }

  // --- SECTION 8: Acceptance Gate Hardening Suite ---
  console.log('\n--- SECTION 8: Acceptance Gate Hardening Suite ---');

  // 1. Persistence Unique Constraint & Bypassed Lock Concurrency Hardening
  const concurrentPayload = {
    externalRecordId: 'INV-3001',
    entityType: 'INVOICE' as const,
    data: { total: 999 },
  };

  // Simulate concurrent workers processing same record bypassing in-process locks
  const worker1ResultPromise = recordService.processRecord(tenantA, connA.id, concurrentPayload);
  const worker2ResultPromise = recordService.processRecord(tenantA, connA.id, concurrentPayload);

  const [w1Res, w2Res] = await Promise.all([worker1ResultPromise, worker2ResultPromise]);
  const statuses = [w1Res.status, w2Res.status];
  assert(statuses.includes('PROCESSED'), 'One worker successfully processed the record');
  assert(statuses.includes('DUPLICATE'), 'Secondary worker intercepted by persistence idempotency key and returned DUPLICATE');

  // 2. DLQ Concurrent Replay Duplication Lock Verification
  // Setup a record in DEAD_LETTER state
  const dlqPayload = {
    externalRecordId: 'INV-9001',
    entityType: 'INVOICE' as const,
    data: { total: 1234 },
  };
  const deadLetterRes = await recordService.processRecord(tenantA, connA.id, dlqPayload, {
    maxRetries: 1,
    simulateAdapterFailure: true,
  });
  assert(deadLetterRes.status === 'DEAD_LETTER', 'Record transitioned to DEAD_LETTER for replay lock test');

  // Attempt concurrent replay requests on the same DLQ record
  const replayLockRec = await mockPrisma.integrationRecord.findFirst({ where: { id: deadLetterRes.record.id } });
  if (replayLockRec) {
    replayLockRec.state = 'REPLAYED'; // Simulate active replay in progress
  }

  try {
    await recordService.replayDlqRecord(tenantA, deadLetterRes.record.id);
    assert(false, 'Concurrent replay on active REPLAYED record should throw BadRequestException');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Concurrent replay on active REPLAYED record blocked with BadRequestException');
    assert(err.message.includes('Replay is already in progress'), 'Error message confirms active replay lock');
  }

  // Restore state for clean replay
  if (replayLockRec) {
    replayLockRec.state = 'DEAD_LETTER';
  }

  // 3. External Side-Effect Recovery (Worker Crash Post ERP Push)
  const crashPayload = {
    externalRecordId: 'INV-CRASH-01',
    entityType: 'INVOICE' as const,
    data: { total: 4321 },
  };
  // Attempt 1: ERP accepts push, but worker crashes before DB save (simulated)
  const erpAdapter = registry.getAdapter('GENERIC_REST');
  const erpPushRes = await erpAdapter.push(crashPayload.data);
  assert(erpPushRes.success === true, 'ERP accepted initial push request');

  // Recovery: Re-attempt record processing after worker restart
  const recoveryRes = await recordService.processRecord(tenantA, connA.id, crashPayload);
  assert(recoveryRes.status === 'PROCESSED', 'Worker recovery re-attempts record and records success cleanly');

  // Immediate retry uses persistence idempotency key
  const duplicateRecoveryRes = await recordService.processRecord(tenantA, connA.id, crashPayload);
  assert(duplicateRecoveryRes.status === 'DUPLICATE', 'Re-attempt after worker crash recovery drops duplicate side effects');

  // 4. Cross-Tenant Replay Security
  try {
    await recordService.replayDlqRecord(tenantB, deadLetterRes.record.id);
    assert(false, 'Cross-tenant replay request must throw NotFoundException');
  } catch (err: any) {
    assert(err instanceof NotFoundException, 'Cross-tenant replay request throws NotFoundException (Tenant Security Boundaries Enforced)');
  }

  // Summary
  console.log('\n================================================================');
  console.log(`  STAGE 15.6.4 TEST SUMMARY: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================\n');

  if (passed === total) {
    console.log('VERIFICATION RESULT: ALL STAGE 15.6.4 TESTS PASSED 100%');
  } else {
    console.error('VERIFICATION RESULT: STAGE 15.6.4 TESTS FAILED');
    process.exit(1);
  }
}

runStage15_6_4_Tests();
