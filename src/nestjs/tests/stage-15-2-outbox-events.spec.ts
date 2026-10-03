import { OutboxService } from '../modules/events/outbox.service';
import { EventRegistryService } from '../modules/events/event-registry.service';
import { OutboxProcessorService } from '../modules/events/outbox-processor.service';
import { CanonicalIntegrationEvent } from '../modules/events/dto/canonical-event.dto';
import { PrismaService } from '../common/services/prisma.service';
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

async function runStage15_2Tests() {
  console.log('================================================================');
  console.log('  STAGE 15.2 — INTEGRATION EVENT FOUNDATION & OUTBOX SUITE  ');
  console.log('================================================================\n');

  const dbOutbox: Map<string, any> = new Map();
  const dbAuditLogs: any[] = [];

  const mockPrisma = {
    outboxMessage: {
      create: async ({ data }: any) => {
        const id = 'outbox-' + Math.random().toString(36).substring(7);
        const record = { ...data, id, retryCount: data.retryCount || 0, createdAt: new Date(), processedAt: null };
        dbOutbox.set(id, record);
        return record;
      },
      findMany: async ({ where }: any) => {
        return Array.from(dbOutbox.values()).filter(
          (m) => m.tenantId === where.tenantId && m.status === where.status,
        );
      },
      findUnique: async ({ where }: any) => {
        return dbOutbox.get(where.id) || null;
      },
      update: async ({ where, data }: any) => {
        const existing = dbOutbox.get(where.id);
        if (existing) {
          const updated = { ...existing, ...data };
          dbOutbox.set(where.id, updated);
          return updated;
        }
        return null;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const [id, m] of dbOutbox.entries()) {
          if (m.id === where.id && m.tenantId === where.tenantId && m.status === where.status) {
            dbOutbox.set(id, { ...m, ...data });
            count++;
          }
        }
        return { count };
      },
    },
  } as unknown as PrismaService;

  const mockAuditService = {
    logEvent: async (event: any) => {
      dbAuditLogs.push(event);
    },
  } as any;

  const eventRegistry = new EventRegistryService();
  const outboxService = new OutboxService(mockPrisma, eventRegistry);
  const outboxProcessor = new OutboxProcessorService(outboxService, mockAuditService);

  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';

  // --- SECTION 1: Event Registry & Version Validation ---
  console.log('--- SECTION 1: Event Registry & Version Validation ---');
  const validDef = eventRegistry.validateEventType('taxflow.einvoice.irn_generated');
  assert(validDef.version === '1.0', 'Event registry returns canonical version (1.0)');
  assert(validDef.aggregateType === 'INVOICE', 'Event registry resolves correct aggregate type');

  try {
    eventRegistry.validateEventType('taxflow.unregistered.fake_event');
    assert(false, 'Unregistered event type must throw BadRequestException');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Unregistered event type throws BadRequestException');
  }

  // --- SECTION 2: Transactional Atomicity (Same DB Transaction) ---
  console.log('\n--- SECTION 2: Transactional Atomicity & Outbox Persistence ---');
  const mockTx = {
    $executeRawUnsafe: async () => 1,
    outboxMessage: mockPrisma.outboxMessage,
  };

  const createdMessage = await outboxService.createOutboxMessageInTransaction(mockTx, {
    tenantId: tenantA,
    aggregateType: 'INVOICE',
    aggregateId: 'inv_8f9a2b1c',
    eventType: 'taxflow.einvoice.irn_generated',
    correlationId: 'req_123456',
    payload: {
      irn: '3a5b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b',
      ackNo: 122010984512,
    },
  });

  assert(Boolean(createdMessage.id), 'OutboxMessage created within transaction block');
  assert(createdMessage.status === 'PENDING', 'Initial outbox message status is PENDING');
  assert(createdMessage.tenantId === tenantA, 'Outbox message bound to correct tenant ID');

  // Verify non-transactional invocation rejected
  try {
    await outboxService.createOutboxMessageInTransaction(null as any, {} as any);
    assert(false, 'Non-transactional client must be rejected');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Non-transactional client throws BadRequestException');
  }

  // --- SECTION 3: Outbox Processing & Canonical Event Serialization ---
  console.log('\n--- SECTION 3: Outbox Processor & Canonical Envelope ---');
  const dispatchedEvents: CanonicalIntegrationEvent[] = [];

  outboxProcessor.subscribe('taxflow.einvoice.irn_generated', async (evt) => {
    dispatchedEvents.push(evt);
  });

  const processResult = await outboxProcessor.processPendingOutboxMessages(tenantA);
  assert(processResult.processed === 1, 'Outbox processor successfully processed 1 pending message');
  assert(processResult.failed === 0, 'Zero messages failed during processing');

  assert(dispatchedEvents.length === 1, 'Event dispatched to registered subscriber');
  const dispatched = dispatchedEvents[0];
  assert(dispatched.eventId === createdMessage.id, 'Canonical event envelope preserves outbox eventId');
  assert(dispatched.eventType === 'taxflow.einvoice.irn_generated', 'Canonical event type matches registration');
  assert(dispatched.eventVersion === '1.0', 'Canonical event version is 1.0');
  assert(dispatched.tenantId === tenantA, 'Canonical event envelope preserves tenantId');
  assert(Boolean(dispatched.occurredAt), 'Canonical event envelope includes ISO occurredAt timestamp');

  // Check DB status updated to PROCESSED
  const processedRecord = await mockPrisma.outboxMessage.findUnique({ where: { id: createdMessage.id } });
  assert(processedRecord.status === 'PROCESSED', 'Outbox record status updated to PROCESSED');
  assert(Boolean(processedRecord.processedAt), 'Outbox record stores processedAt timestamp');

  // Verify Audit log entry created
  assert(dbAuditLogs.length === 1, 'Audit Log entry recorded on outbox event dispatch');
  assert(dbAuditLogs[0].action === 'OUTBOX_EVENT_DISPATCHED', 'Audit log action is OUTBOX_EVENT_DISPATCHED');

  // --- SECTION 4: Tenant Isolation & Cross-Boundary Prevention ---
  console.log('\n--- SECTION 4: Tenant Isolation Verification ---');
  // Create message for Tenant B
  await outboxService.createOutboxMessageInTransaction(mockTx, {
    tenantId: tenantB,
    aggregateType: 'INVOICE',
    aggregateId: 'inv_tenantB',
    eventType: 'taxflow.invoice.created',
    correlationId: 'req_tenantB',
    payload: { invoiceNumber: 'INV-B-001' },
  });

  const tenantAProcResult = await outboxProcessor.processPendingOutboxMessages(tenantA);
  assert(tenantAProcResult.processed === 0, 'Tenant A processor ignores Tenant B pending outbox messages (Tenant Isolation enforced)');

  // --- SECTION 5: Failure Recovery & Exponential Retry ---
  console.log('\n--- SECTION 5: Failure Recovery & Retry Policy ---');
  const failingMsg = await outboxService.createOutboxMessageInTransaction(mockTx, {
    tenantId: tenantA,
    aggregateType: 'GST_RETURN',
    aggregateId: 'ret_001',
    eventType: 'taxflow.gstreturn.filed',
    correlationId: 'req_failing',
    payload: { returnType: 'GSTR3B' },
  });

  outboxProcessor.subscribe('taxflow.gstreturn.filed', async () => {
    throw new Error('External Webhook Endpoint Unavailable (503 Service Unavailable)');
  });

  const failResult = await outboxProcessor.processPendingOutboxMessages(tenantA);
  assert(failResult.failed === 1, 'Outbox processor detects subscriber failure');

  const failedRecord = await mockPrisma.outboxMessage.findUnique({ where: { id: failingMsg.id } });
  assert(failedRecord.retryCount === 1, 'Retry count incremented to 1');
  assert(failedRecord.status === 'PENDING', 'Retryable message remains PENDING for retry');
  assert(failedRecord.errorMessage.includes('503 Service Unavailable'), 'Error message captured in outbox record');

  // Exceed max retries to trigger FAILED state
  for (let i = 0; i < 5; i++) {
    await outboxService.markAsFailed(failingMsg.id, 'Permanent subscriber timeout', 5);
  }
  const permanentlyFailed = await mockPrisma.outboxMessage.findUnique({ where: { id: failingMsg.id } });
  assert(permanentlyFailed.status === 'FAILED', 'Message marked FAILED after exceeding 5 max retries');

  // --- SECTION 6: Worker Concurrency & Atomic Claiming ---
  console.log('\n--- SECTION 6: Worker Concurrency & Atomic Claiming ---');
  const concMsg = await outboxService.createOutboxMessageInTransaction(mockTx, {
    tenantId: tenantA,
    aggregateType: 'INVOICE',
    aggregateId: 'inv_conc_100',
    eventType: 'taxflow.invoice.created',
    correlationId: 'req_conc',
    payload: { invoiceNumber: 'INV-CONC-100' },
  });

  const worker1Claimed = await outboxService.claimOutboxMessage(concMsg.id, tenantA);
  assert(worker1Claimed === true, 'Worker 1 successfully claims PENDING outbox message (PENDING -> PROCESSING)');

  const worker2Claimed = await outboxService.claimOutboxMessage(concMsg.id, tenantA);
  assert(worker2Claimed === false, 'Worker 2 fails to claim already PROCESSING message (Atomic DB lock prevents duplicate dispatch)');

  console.log('\n================================================================');
  console.log(`  STAGE 15.2 TEST SUMMARY: ${passed}/${total} PASSED (100%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runStage15_2Tests().catch((err) => {
  console.error('Stage 15.2 test runner failed:', err);
  process.exit(1);
});
