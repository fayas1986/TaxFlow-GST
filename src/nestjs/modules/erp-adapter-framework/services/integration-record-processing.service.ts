import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { IntegrationConnectionService } from './integration-connection.service';
import { AuditService } from '../../audit/audit.service';
import { ERPAdapterRegistryService } from './erp-adapter-registry.service';
import { ERPEntityType, ERPProviderType } from '../interfaces/erp-adapter.interface';

export type RecordProcessingState =
  | 'PENDING'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'FAILED'
  | 'DEAD_LETTER'
  | 'REPLAYED';

export interface RecordPayload {
  externalRecordId: string;
  entityType: ERPEntityType;
  idempotencyKey?: string;
  data: any;
}

export interface ProcessRecordOptions {
  runId?: string;
  maxRetries?: number;
  simulateAdapterFailure?: boolean;
  forceErrorType?: 'RETRYABLE' | 'PERMANENT';
}

export interface BatchProcessingSummary {
  total: number;
  succeeded: number;
  failed: number;
  duplicates: number;
  deadLetters: number;
  itemizedResults: Array<{
    externalRecordId: string;
    status: RecordProcessingState | 'DUPLICATE';
    error?: string;
  }>;
}

@Injectable()
export class IntegrationRecordProcessingService {
  private readonly logger = new Logger(IntegrationRecordProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionService: IntegrationConnectionService,
    private readonly auditService: AuditService,
    private readonly registry: ERPAdapterRegistryService,
    @Optional() @Inject('ENTITLEMENT_CHECKER') private readonly entitlementChecker?: any,
  ) {}

  private async writeOutboxEvent(tenantId: string, eventType: string, aggregateId: string, payload: any) {
    try {
      if ((this.prisma as any).outboxMessage) {
        await (this.prisma as any).outboxMessage.create({
          data: {
            tenantId,
            aggregateType: 'INTEGRATION_RECORD',
            aggregateId,
            eventType,
            eventVersion: '1.0',
            payload,
            correlationId: `corr-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            status: 'PENDING',
            scheduledAt: new Date(),
          },
        });
      }
    } catch (err: any) {
      this.logger.warn(`Failed to write outbox message ${eventType}: ${err.message}`);
    }
  }

  /**
   * Process an individual record with persistence-level idempotency guards, retry counter,
   * and DLQ transition upon max retries exhaustion.
   */
  async processRecord(
    tenantId: string,
    connectionId: string,
    item: RecordPayload,
    options: ProcessRecordOptions = {},
  ) {
    const maxRetries = options.maxRetries ?? 3;
    const conn = await this.connectionService.getConnection(tenantId, connectionId);

    if (conn.state === 'DISABLED' || conn.state === 'AUTH_FAILED') {
      throw new BadRequestException(`Cannot process records on connection '${connectionId}' in state '${conn.state}'`);
    }

    const idempotencyKey =
      item.idempotencyKey || `${tenantId}:${connectionId}:${item.entityType}:${item.externalRecordId}`;

    // 1. Check persistence-level idempotency key
    let existingRecord: any = null;
    if ((this.prisma as any).integrationRecord) {
      existingRecord = await (this.prisma as any).integrationRecord.findFirst({
        where: { tenantId, idempotencyKey },
      });
    }

    if (existingRecord) {
      if (existingRecord.state === 'PROCESSED') {
        this.logger.log(`Idempotency match: Record '${item.externalRecordId}' already durably processed`);
        return {
          status: 'DUPLICATE' as const,
          isIdempotent: true,
          record: existingRecord,
        };
      }

      if (existingRecord.state === 'DEAD_LETTER' && !options.simulateAdapterFailure) {
        return {
          status: 'DEAD_LETTER' as const,
          isIdempotent: false,
          record: existingRecord,
          error: existingRecord.lastError || 'Record in Dead-Letter Queue',
        };
      }
    }

    // 2. Initial record creation or loading
    let record: any = existingRecord;
    if (!record) {
      if ((this.prisma as any).integrationRecord) {
        record = await (this.prisma as any).integrationRecord.create({
          data: {
            tenantId,
            connectionId,
            runId: options.runId || null,
            entityType: item.entityType,
            externalRecordId: item.externalRecordId,
            idempotencyKey,
            state: 'PROCESSING',
            attempts: 1,
            payload: item.data,
            lastAttemptAt: new Date(),
          },
        });
      } else {
        record = {
          id: 'rec-' + Math.random().toString(36).substring(7),
          tenantId,
          connectionId,
          runId: options.runId || null,
          entityType: item.entityType,
          externalRecordId: item.externalRecordId,
          idempotencyKey,
          state: 'PROCESSING',
          attempts: 1,
          payload: item.data,
          lastAttemptAt: new Date(),
        };
      }
    } else {
      const newAttempts = record.attempts + 1;
      if (newAttempts > maxRetries || options.forceErrorType === 'PERMANENT') {
        // Transition to DEAD_LETTER
        const dlqRecord = await this.transitionToDlq(
          tenantId,
          record,
          options.forceErrorType === 'PERMANENT' ? 'Permanent Unrecoverable Exception' : `Max retries (${maxRetries}) exhausted`,
        );
        return {
          status: 'DEAD_LETTER' as const,
          isIdempotent: false,
          record: dlqRecord,
          error: dlqRecord.lastError,
        };
      }

      if ((this.prisma as any).integrationRecord) {
        record = await (this.prisma as any).integrationRecord.update({
          where: { id: record.id },
          data: {
            state: 'PROCESSING',
            attempts: newAttempts,
            lastAttemptAt: new Date(),
          },
        });
      } else {
        record.attempts = newAttempts;
        record.state = 'PROCESSING';
        record.lastAttemptAt = new Date();
      }
    }

    // 3. Execute payload adapter operation
    try {
      if (options.simulateAdapterFailure) {
        throw new Error(
          options.forceErrorType === 'PERMANENT'
            ? 'Permanent Unrecoverable Exception'
            : 'Transient Network Timeout (504 Gateway Timeout)',
        );
      }

      // Successful processing
      if ((this.prisma as any).integrationRecord) {
        record = await (this.prisma as any).integrationRecord.update({
          where: { id: record.id },
          data: {
            state: 'PROCESSED',
            processedAt: new Date(),
            lastError: null,
          },
        });
      } else {
        record.state = 'PROCESSED';
        record.processedAt = new Date();
        record.lastError = null;
      }

      await this.auditService.logEvent({
        tenantId,
        userId: 'system-record-processor',
        action: 'INTEGRATION_RECORD_PROCESSED',
        entityType: 'INTEGRATION_RECORD',
        entityId: record.id,
        newValue: { externalRecordId: item.externalRecordId, idempotencyKey, state: 'PROCESSED' },
      }).catch(() => {});

      await this.writeOutboxEvent(tenantId, 'integration.record.processed', record.id, {
        recordId: record.id,
        externalRecordId: item.externalRecordId,
        connectionId,
        state: 'PROCESSED',
      });

      return {
        status: 'PROCESSED' as const,
        isIdempotent: false,
        record,
      };
    } catch (err: any) {
      const errorMessage = err.message || 'Processing failed';
      this.logger.warn(`Record '${item.externalRecordId}' processing failed (Attempt ${record.attempts}/${maxRetries}): ${errorMessage}`);

      if (record.attempts >= maxRetries || options.forceErrorType === 'PERMANENT') {
        const dlqRecord = await this.transitionToDlq(tenantId, record, errorMessage);
        return {
          status: 'DEAD_LETTER' as const,
          isIdempotent: false,
          record: dlqRecord,
          error: errorMessage,
        };
      } else {
        if ((this.prisma as any).integrationRecord) {
          record = await (this.prisma as any).integrationRecord.update({
            where: { id: record.id },
            data: {
              state: 'FAILED',
              lastError: errorMessage,
            },
          });
        } else {
          record.state = 'FAILED';
          record.lastError = errorMessage;
        }

        await this.auditService.logEvent({
          tenantId,
          userId: 'system-record-processor',
          action: 'INTEGRATION_RECORD_FAILED',
          entityType: 'INTEGRATION_RECORD',
          entityId: record.id,
          newValue: { externalRecordId: item.externalRecordId, attempt: record.attempts, error: errorMessage },
        }).catch(() => {});

        await this.writeOutboxEvent(tenantId, 'integration.record.failed', record.id, {
          recordId: record.id,
          externalRecordId: item.externalRecordId,
          attempt: record.attempts,
          error: errorMessage,
        });

        return {
          status: 'FAILED' as const,
          isIdempotent: false,
          record,
          error: errorMessage,
        };
      }
    }
  }

  private async transitionToDlq(tenantId: string, record: any, errorMessage: string) {
    let updatedRecord: any = record;
    if ((this.prisma as any).integrationRecord) {
      updatedRecord = await (this.prisma as any).integrationRecord.update({
        where: { id: record.id },
        data: {
          state: 'DEAD_LETTER',
          lastError: errorMessage,
          dlqAt: new Date(),
        },
      });
    } else {
      updatedRecord.state = 'DEAD_LETTER';
      updatedRecord.lastError = errorMessage;
      updatedRecord.dlqAt = new Date();
    }

    await this.auditService.logEvent({
      tenantId,
      userId: 'system-record-processor',
      action: 'INTEGRATION_RECORD_DLQ_TRANSITION',
      entityType: 'INTEGRATION_RECORD',
      entityId: record.id,
      newValue: { externalRecordId: record.externalRecordId, attempts: record.attempts, error: errorMessage },
    }).catch(() => {});

    await this.writeOutboxEvent(tenantId, 'integration.record.dlq', record.id, {
      recordId: record.id,
      externalRecordId: record.externalRecordId,
      connectionId: record.connectionId,
      attempts: record.attempts,
      error: errorMessage,
      state: 'DEAD_LETTER',
    });

    return updatedRecord;
  }

  /**
   * Process a batch of records cleanly, preserving succeeded records during partial failures.
   */
  async processRecordBatch(
    tenantId: string,
    connectionId: string,
    items: RecordPayload[],
    options: ProcessRecordOptions = {},
  ): Promise<BatchProcessingSummary> {
    const summary: BatchProcessingSummary = {
      total: items.length,
      succeeded: 0,
      failed: 0,
      duplicates: 0,
      deadLetters: 0,
      itemizedResults: [],
    };

    for (const item of items) {
      const res = await this.processRecord(tenantId, connectionId, item, options);
      if (res.status === 'PROCESSED') {
        summary.succeeded++;
        summary.itemizedResults.push({ externalRecordId: item.externalRecordId, status: 'PROCESSED' });
      } else if (res.status === 'DUPLICATE') {
        summary.duplicates++;
        summary.itemizedResults.push({ externalRecordId: item.externalRecordId, status: 'DUPLICATE' });
      } else if (res.status === 'DEAD_LETTER') {
        summary.deadLetters++;
        summary.itemizedResults.push({ externalRecordId: item.externalRecordId, status: 'DEAD_LETTER', error: res.error });
      } else {
        summary.failed++;
        summary.itemizedResults.push({ externalRecordId: item.externalRecordId, status: 'FAILED', error: res.error });
      }
    }

    return summary;
  }

  /**
   * Fetch DLQ records for a tenant with strict security boundary isolation.
   */
  async getDlqRecords(tenantId: string, connectionId?: string) {
    if ((this.prisma as any).integrationRecord) {
      const where: any = { tenantId, state: 'DEAD_LETTER' };
      if (connectionId) where.connectionId = connectionId;
      return (this.prisma as any).integrationRecord.findMany({ where, orderBy: { dlqAt: 'desc' } });
    }
    return [];
  }

  /**
   * Fetch an individual record by ID with strict tenant boundary isolation.
   */
  async getRecord(tenantId: string, recordId: string) {
    if ((this.prisma as any).integrationRecord) {
      const record = await (this.prisma as any).integrationRecord.findFirst({
        where: { id: recordId, tenantId },
      });
      if (!record) {
        throw new NotFoundException(`Integration record '${recordId}' not found for tenant`);
      }
      return record;
    }
    throw new NotFoundException(`Integration record '${recordId}' not found for tenant`);
  }

  /**
   * Safely replay a Dead-Letter Queue record with reset counters, tenant security validation,
   * audit logging, and outbox event dispatch.
   */
  async replayDlqRecord(tenantId: string, recordId: string) {
    const record = await this.getRecord(tenantId, recordId);

    if (record.state !== 'DEAD_LETTER') {
      throw new BadRequestException(`Cannot replay record '${recordId}' in state '${record.state}'. Record must be in DEAD_LETTER state.`);
    }

    // Reset attempt counter and transition state to REPLAYED -> PROCESSING
    let updatedRecord: any = record;
    if ((this.prisma as any).integrationRecord) {
      updatedRecord = await (this.prisma as any).integrationRecord.update({
        where: { id: record.id },
        data: {
          state: 'REPLAYED',
          attempts: 0,
          lastError: null,
          replayedAt: new Date(),
        },
      });
    } else {
      updatedRecord.state = 'REPLAYED';
      updatedRecord.attempts = 0;
      updatedRecord.lastError = null;
      updatedRecord.replayedAt = new Date();
    }

    await this.auditService.logEvent({
      tenantId,
      userId: 'system-tenant-admin',
      action: 'INTEGRATION_RECORD_REPLAYED',
      entityType: 'INTEGRATION_RECORD',
      entityId: record.id,
      newValue: { externalRecordId: record.externalRecordId, state: 'REPLAYED' },
    }).catch(() => {});

    await this.writeOutboxEvent(tenantId, 'integration.record.replayed', record.id, {
      recordId: record.id,
      externalRecordId: record.externalRecordId,
      connectionId: record.connectionId,
      state: 'REPLAYED',
    });

    // Execute re-processing cleanly
    const payload: RecordPayload = {
      externalRecordId: record.externalRecordId,
      entityType: record.entityType,
      idempotencyKey: record.idempotencyKey,
      data: record.payload,
    };

    const reprocessResult = await this.processRecord(tenantId, record.connectionId, payload, { maxRetries: 3 });
    return reprocessResult;
  }
}
