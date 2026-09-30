import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { ImmutableAuditService } from '../audit/immutable-audit.service';
import {
  NotificationChannel,
  NotificationStatus,
} from '@prisma/client';
import {
  NotificationProviderAdapter,
  EmailNotificationProviderAdapter,
  WebhookNotificationProviderAdapter,
  InAppNotificationProviderAdapter,
} from './notification-provider.adapter';

export interface SendNotificationDto {
  tenantId: string;
  userId?: string;
  channel: NotificationChannel;
  eventType: string;
  recipient: string;
  payload: any;
  idempotencyKey: string;
  correlationId: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private adapters: Map<NotificationChannel, NotificationProviderAdapter> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: ImmutableAuditService,
  ) {
    this.registerAdapter(new EmailNotificationProviderAdapter());
    this.registerAdapter(new WebhookNotificationProviderAdapter());
    this.registerAdapter(new InAppNotificationProviderAdapter());
  }

  registerAdapter(adapter: NotificationProviderAdapter) {
    this.adapters.set(adapter.channel, adapter);
  }

  /**
   * Safe Dispatch Wrapper: Guarantees that notification failures NEVER cause underlying financial transactions to fail.
   */
  async sendNotificationSafely(dto: SendNotificationDto) {
    try {
      return await this.sendNotification(dto);
    } catch (err: any) {
      this.logger.error(`Notification execution failed safely without breaking transaction: ${err.message}`);
      return null;
    }
  }

  /**
   * Asynchronous Notification Execution with Idempotency & Delivery Tracking.
   */
  async sendNotification(dto: SendNotificationDto) {
    // 1. IDEMPOTENCY GUARD
    const existing = await this.prisma.notificationRecord.findFirst({
      where: { tenantId: dto.tenantId, idempotencyKey: dto.idempotencyKey },
    });

    if (existing) {
      this.logger.log(`Idempotent notification hit for key: ${dto.idempotencyKey}`);
      return existing;
    }

    // 2. Create initial record in PENDING status
    const record = await this.prisma.notificationRecord.create({
      data: {
        tenantId: dto.tenantId,
        userId: dto.userId || null,
        channel: dto.channel,
        eventType: dto.eventType,
        recipient: dto.recipient,
        payload: dto.payload ? dto.payload : {},
        status: NotificationStatus.PENDING,
        attempts: 0,
        idempotencyKey: dto.idempotencyKey,
        correlationId: dto.correlationId,
      },
    });

    // 3. Process delivery via provider adapter
    return this.processDelivery(record.id, dto.correlationId);
  }

  /**
   * Process delivery for a notification record.
   */
  async processDelivery(notificationId: string, correlationId: string) {
    const record = await this.prisma.notificationRecord.findUnique({
      where: { id: notificationId },
    });

    if (!record) return null;

    const adapter = this.adapters.get(record.channel);
    if (!adapter) {
      const failed = await this.prisma.notificationRecord.update({
        where: { id: record.id },
        data: {
          status: NotificationStatus.FAILED,
          attempts: record.attempts + 1,
          lastError: `No provider adapter registered for channel ${record.channel}`,
        },
      });
      return failed;
    }

    const currentAttempts = record.attempts + 1;
    const result = await adapter.send(record.recipient, record.eventType, record.payload);

    if (result.success) {
      const delivered = await this.prisma.notificationRecord.update({
        where: { id: record.id },
        data: {
          status: NotificationStatus.DELIVERED,
          attempts: currentAttempts,
          lastError: null,
        },
      });

      await this.auditService.logEvent({
        tenantId: record.tenantId,
        actorUserId: record.userId || undefined,
        action: 'NOTIFICATION_DELIVERED',
        entityType: 'NotificationRecord',
        entityId: record.id,
        correlationId,
        afterState: { channel: record.channel, recipient: record.recipient, status: delivered.status },
        result: 'SUCCESS',
      });

      return delivered;
    } else {
      const maxAttempts = 3;
      const isDeadLetter = currentAttempts >= maxAttempts;
      const newStatus = isDeadLetter ? NotificationStatus.DEAD_LETTER : NotificationStatus.RETRYING;

      const updated = await this.prisma.notificationRecord.update({
        where: { id: record.id },
        data: {
          status: newStatus,
          attempts: currentAttempts,
          lastError: result.error || 'Provider delivery failed',
        },
      });

      await this.auditService.logEvent({
        tenantId: record.tenantId,
        actorUserId: record.userId || undefined,
        action: isDeadLetter ? 'NOTIFICATION_DEAD_LETTER' : 'NOTIFICATION_DELIVERY_FAILED',
        entityType: 'NotificationRecord',
        entityId: record.id,
        correlationId,
        afterState: { channel: record.channel, recipient: record.recipient, status: updated.status, attempts: updated.attempts },
        result: 'FAILURE',
        reason: result.error || 'Provider delivery failed',
      });

      return updated;
    }
  }

  /**
   * Retry pending/failed notifications for a tenant.
   */
  async retryFailedNotifications(tenantId: string) {
    const retryCandidates = await this.prisma.notificationRecord.findMany({
      where: {
        tenantId,
        status: { in: [NotificationStatus.PENDING, NotificationStatus.RETRYING, NotificationStatus.FAILED] },
        attempts: { lt: 3 },
      },
    });

    const results = [];
    for (const record of retryCandidates) {
      const res = await this.processDelivery(record.id, record.correlationId);
      results.push(res);
    }
    return results;
  }
}
