import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { EventRegistryService } from './event-registry.service';

export interface CreateOutboxMessageParams {
  tenantId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: any;
  correlationId: string;
  causationId?: string;
  eventVersion?: string;
}

@Injectable()
export class OutboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventRegistry: EventRegistryService,
  ) {}

  /**
   * MANDATORY ATOMIC TRANSACTION METHOD:
   * Writes domain state change and OutboxMessage in the SAME database transaction block.
   */
  async createOutboxMessageInTransaction(
    tx: any,
    params: CreateOutboxMessageParams,
  ): Promise<any> {
    if (!tx || typeof tx.$executeRawUnsafe === 'undefined' && typeof tx.outboxMessage === 'undefined') {
      throw new BadRequestException('Prisma transaction client (tx) is required for atomic outbox message creation');
    }

    // Validate event type schema against registry
    const eventDef = this.eventRegistry.validateEventType(params.eventType);

    const outboxRecord = await tx.outboxMessage.create({
      data: {
        tenantId: params.tenantId,
        aggregateType: params.aggregateType || eventDef.aggregateType,
        aggregateId: params.aggregateId,
        eventType: params.eventType,
        eventVersion: params.eventVersion || eventDef.version,
        payload: params.payload,
        correlationId: params.correlationId,
        causationId: params.causationId,
        status: 'PENDING',
        retryCount: 0,
        scheduledAt: new Date(),
      },
    });

    return outboxRecord;
  }

  async fetchPendingOutboxMessages(tenantId: string, limit: number = 50): Promise<any[]> {
    return this.prisma.outboxMessage.findMany({
      where: {
        tenantId,
        status: 'PENDING',
        scheduledAt: { lte: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });
  }

  async claimOutboxMessage(id: string, tenantId: string): Promise<boolean> {
    const updated = await this.prisma.outboxMessage.updateMany({
      where: {
        id,
        tenantId,
        status: 'PENDING',
      },
      data: {
        status: 'PROCESSING',
      },
    });
    return updated.count > 0;
  }

  async markAsProcessed(id: string): Promise<void> {
    await this.prisma.outboxMessage.update({
      where: { id },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });
  }

  async markAsFailed(id: string, errorMessage: string, maxRetries: number = 5): Promise<void> {
    const record = await this.prisma.outboxMessage.findUnique({ where: { id } });
    if (!record) return;

    const newRetryCount = record.retryCount + 1;
    const isPermanentFailure = newRetryCount >= maxRetries;

    await this.prisma.outboxMessage.update({
      where: { id },
      data: {
        retryCount: newRetryCount,
        status: isPermanentFailure ? 'FAILED' : 'PENDING',
        errorMessage,
        scheduledAt: isPermanentFailure
          ? undefined
          : new Date(Date.now() + Math.pow(2, newRetryCount) * 1000), // Exponential backoff
      },
    });
  }
}
