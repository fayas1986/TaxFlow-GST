import { Injectable, Logger } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { buildCanonicalEvent, CanonicalIntegrationEvent } from './dto/canonical-event.dto';
import { AuditService } from '../audit/audit.service';

export type EventSubscriber = (event: CanonicalIntegrationEvent) => Promise<void>;

@Injectable()
export class OutboxProcessorService {
  private readonly logger = new Logger(OutboxProcessorService.name);
  private readonly subscribers = new Map<string, EventSubscriber[]>();

  constructor(
    private readonly outboxService: OutboxService,
    private readonly auditService: AuditService,
  ) {}

  subscribe(eventType: string, subscriber: EventSubscriber): void {
    const list = this.subscribers.get(eventType) || [];
    list.push(subscriber);
    this.subscribers.set(eventType, list);
  }

  async processPendingOutboxMessages(tenantId: string, limit: number = 20): Promise<{ processed: number; failed: number }> {
    const messages = await this.outboxService.fetchPendingOutboxMessages(tenantId, limit);
    let processed = 0;
    let failed = 0;

    for (const msg of messages) {
      // Atomic DB Claim: PENDING -> PROCESSING
      const claimed = await this.outboxService.claimOutboxMessage(msg.id, tenantId);
      if (!claimed) {
        continue; // Message claimed by another worker concurrently
      }

      try {
        const canonicalEvent = buildCanonicalEvent({
          eventId: msg.id,
          eventType: msg.eventType,
          eventVersion: msg.eventVersion,
          tenantId: msg.tenantId,
          aggregateType: msg.aggregateType,
          aggregateId: msg.aggregateId,
          correlationId: msg.correlationId,
          causationId: msg.causationId,
          payload: msg.payload,
        });

        // Dispatch event to registered subscribers (Webhooks / ERP Processors)
        const handlers = this.subscribers.get(msg.eventType) || [];
        for (const handler of handlers) {
          await handler(canonicalEvent);
        }

        // Mark as processed in database
        await this.outboxService.markAsProcessed(msg.id);
        processed++;

        // Audit log dispatch success
        await this.auditService.logEvent({
          tenantId: msg.tenantId,
          userId: 'system-outbox-worker',
          action: 'OUTBOX_EVENT_DISPATCHED',
          entityType: msg.aggregateType,
          entityId: msg.aggregateId,
          newValue: { eventId: msg.id, eventType: msg.eventType },
        }).catch(() => {});
      } catch (err: any) {
        failed++;
        this.logger.error(`Outbox processing failed for message ${msg.id}: ${err.message}`);
        await this.outboxService.markAsFailed(msg.id, err.message || 'Processing failed');
      }
    }

    return { processed, failed };
  }
}
