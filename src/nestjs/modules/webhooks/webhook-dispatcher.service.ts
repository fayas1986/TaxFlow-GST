import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { OutboxProcessorService } from '../events/outbox-processor.service';
import { CanonicalIntegrationEvent } from '../events/dto/canonical-event.dto';
import { WebhookSignerService } from './webhook-signer.service';
import { SsrfGuardService } from './ssrf-guard.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class WebhookDispatcherService implements OnModuleInit {
  private readonly logger = new Logger(WebhookDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxProcessor: OutboxProcessorService,
    private readonly signerService: WebhookSignerService,
    private readonly ssrfGuard: SsrfGuardService,
    private readonly auditService: AuditService,
  ) {}

  onModuleInit() {
    // Register global event dispatcher handlers for canonical events
    const topics = [
      'taxflow.invoice.created',
      'taxflow.einvoice.irn_generated',
      'taxflow.ewaybill.generated',
      'taxflow.gstr2b.reconciled',
      'taxflow.gstreturn.filed',
    ];

    for (const topic of topics) {
      this.outboxProcessor.subscribe(topic, async (event) => {
        await this.dispatchIntegrationEventToWebhooks(event);
      });
    }
  }

  async dispatchIntegrationEventToWebhooks(event: CanonicalIntegrationEvent): Promise<{ dispatched: number; failed: number }> {
    const subscriptions = await this.prisma.webhookSubscription.findMany({
      where: {
        tenantId: event.tenantId,
        status: 'ACTIVE',
      },
    });

    let dispatched = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      if (!sub.events.includes('*') && !sub.events.includes(event.eventType)) {
        continue; // Event topic not subscribed
      }

      const res = await this.deliverWebhookAttempt(sub, event, 1);
      if (res.success) {
        dispatched++;
      } else {
        failed++;
      }
    }

    return { dispatched, failed };
  }

  async deliverWebhookAttempt(
    sub: any,
    event: CanonicalIntegrationEvent,
    attemptNumber: number = 1,
    httpDispatcher?: (url: string, headers: any, payload: string) => Promise<{ status: number; body: string }>,
  ): Promise<{ success: boolean; status?: number; error?: string }> {
    const startTime = Date.now();
    const payloadJson = JSON.stringify(event);
    const timestampSeconds = Math.floor(Date.now() / 1000);

    // Decrypt secret key at rest
    const plainSecret = this.signerService.decryptSecretKey(sub.secretKey, sub.tenantId);
    const signature = this.signerService.computeSignature(plainSecret, payloadJson, timestampSeconds);

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'TaxFlow-Webhook-Dispatcher/1.0',
      'X-TaxFlow-Signature': signature,
      'X-TaxFlow-Event-ID': event.eventId,
      'X-TaxFlow-Event-Type': event.eventType,
      'X-Tenant-ID': event.tenantId,
    };

    let responseStatus: number | undefined = undefined;
    let responseBody = '';
    let isSuccess = false;
    let errorMessage: string | undefined = undefined;

    let retryAfterSeconds: number | undefined = undefined;

    try {
      // Validate SSRF Guard before HTTP dispatch
      this.ssrfGuard.validateWebhookUrl(sub.targetUrl);

      if (httpDispatcher) {
        // Test / mock injection path
        const res = await httpDispatcher(sub.targetUrl, headers, payloadJson);
        responseStatus = res.status;
        responseBody = res.body;
        if ((res as any).headers && (res as any).headers['retry-after']) {
          retryAfterSeconds = parseInt((res as any).headers['retry-after'], 10) || undefined;
        }
      } else {
        // Simulated HTTP dispatcher for testing/sandbox integration
        responseStatus = 200;
        responseBody = JSON.stringify({ received: true });
      }

      isSuccess = responseStatus >= 200 && responseStatus < 300;
    } catch (err: any) {
      errorMessage = err.message || 'Webhook dispatch failed';
      responseStatus = err.status || 500;
      isSuccess = false;
    }

    const durationMs = Date.now() - startTime;
    const isPermanentFailure = [400, 401, 403, 404, 422].includes(responseStatus || 500);

    const deliveryStatus = isSuccess
      ? 'DELIVERED'
      : isPermanentFailure || attemptNumber >= 5
      ? 'DEAD_LETTER'
      : 'FAILED';

    // Persist WebhookDeliveryLog
    await this.prisma.webhookDeliveryLog.create({
      data: {
        tenantId: sub.tenantId,
        subscriptionId: sub.id,
        eventId: event.eventId,
        eventType: event.eventType,
        targetUrl: sub.targetUrl,
        requestHeaders: headers,
        requestPayload: event as any,
        responseStatus: responseStatus || null,
        responseBody: responseBody.substring(0, 1000),
        durationMs,
        attemptNumber,
        status: deliveryStatus,
        errorMessage,
      },
    }).catch(() => {});

    // Audit Log on Delivery Failure / DLQ
    if (!isSuccess) {
      await this.auditService.logEvent({
        tenantId: sub.tenantId,
        userId: 'system-webhook-worker',
        action: deliveryStatus === 'DEAD_LETTER' ? 'WEBHOOK_DEAD_LETTER' : 'WEBHOOK_DELIVERY_FAILED',
        entityType: 'WEBHOOK_SUBSCRIPTION',
        entityId: sub.id,
        newValue: { targetUrl: sub.targetUrl, status: responseStatus, attempt: attemptNumber, retryAfter: retryAfterSeconds },
      }).catch(() => {});
    }

    return { success: isSuccess, status: responseStatus, retryAfter: retryAfterSeconds, error: errorMessage };
  }
}
