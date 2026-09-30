import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/services/prisma.service';
import { ImmutableAuditService } from '../../audit/immutable-audit.service';
import { SubscriptionLifecycleService } from '../subscription-lifecycle.service';
import { SandboxPaymentProviderAdapter, PaymentWebhookPayload } from './payment-provider.adapter';
import { PaymentStatus, SubscriptionStatus } from '@prisma/client';

@Injectable()
export class PaymentWebhookService {
  private adapter = new SandboxPaymentProviderAdapter();
  private webhookSecret = 'taxflow-payment-webhook-secret-999';

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: ImmutableAuditService,
    private readonly subscriptionLifecycle: SubscriptionLifecycleService,
  ) {}

  /**
   * Process Server/Provider Inbound Payment Webhook.
   * Server/provider webhook determines payment status (never client-side).
   */
  async processPaymentWebhook(payload: PaymentWebhookPayload, correlationId: string) {
    if (!payload.tenantId || !payload.eventId) {
      throw new BadRequestException('tenantId and eventId are required for payment webhook processing.');
    }

    // 1. Replay Protection (Timestamp within 300 seconds)
    const requestTime = Number(payload.timestamp);
    const now = Date.now();
    if (isNaN(requestTime) || Math.abs(now - requestTime) > 300000) {
      await this.auditService.logEvent({
        tenantId: payload.tenantId,
        action: 'PAYMENT_WEBHOOK_REPLAY_BLOCKED',
        entityType: 'BillingEvent',
        entityId: payload.eventId,
        correlationId,
        result: 'BLOCKED',
        reason: 'Payment webhook timestamp expired (>300s)',
      });
      throw new UnauthorizedException('Unauthorized: Webhook timestamp expired.');
    }

    // 2. Signature Verification
    const isValidSig = this.adapter.verifyWebhookSignature(payload, this.webhookSecret);
    if (!isValidSig) {
      await this.auditService.logEvent({
        tenantId: payload.tenantId,
        action: 'PAYMENT_WEBHOOK_SIGNATURE_FAILED',
        entityType: 'BillingEvent',
        entityId: payload.eventId,
        correlationId,
        result: 'BLOCKED',
        reason: 'Payment webhook signature verification failed',
      });
      throw new UnauthorizedException('Unauthorized: Invalid payment webhook signature.');
    }

    // 3. IDEMPOTENCY GUARD
    const existingEvent = await this.prisma.billingEvent.findFirst({
      where: { tenantId: payload.tenantId, idempotencyKey: payload.eventId },
    });

    if (existingEvent) {
      return { status: 'IDEMPOTENT_DUPLICATE_SKIPPED', event: existingEvent };
    }

    // 4. Update Subscription State based on Server Webhook
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId: payload.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    let newSubStatus: SubscriptionStatus = SubscriptionStatus.ACTIVE;
    let paymentStatus: PaymentStatus = PaymentStatus.SUCCESS;

    if (payload.eventType === 'PAYMENT_SUCCESS' || payload.eventType === 'SUBSCRIPTION_RENEWED') {
      newSubStatus = SubscriptionStatus.ACTIVE;
      paymentStatus = PaymentStatus.SUCCESS;
      if (subscription) {
        await this.subscriptionLifecycle.renewSubscription(payload.tenantId);
      }
    } else if (payload.eventType === 'PAYMENT_FAILED') {
      newSubStatus = SubscriptionStatus.PAST_DUE;
      paymentStatus = PaymentStatus.FAILED;
      if (subscription) {
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: SubscriptionStatus.PAST_DUE },
        });
      }
    }

    // 5. Record Billing Event
    const billingEvent = await this.prisma.billingEvent.create({
      data: {
        tenantId: payload.tenantId,
        subscriptionId: subscription ? subscription.id : null,
        eventType: payload.eventType,
        amountInr: payload.amountInr,
        paymentStatus,
        providerReference: payload.providerReference,
        idempotencyKey: payload.eventId,
        payload: payload as any,
      },
    });

    await this.auditService.logEvent({
      tenantId: payload.tenantId,
      action: `PAYMENT_WEBHOOK_${payload.eventType}`,
      entityType: 'BillingEvent',
      entityId: billingEvent.id,
      correlationId,
      afterState: { paymentStatus, subscriptionStatus: newSubStatus },
      result: 'SUCCESS',
    });

    return {
      status: 'PROCESSED',
      billingEvent,
      subscriptionStatus: newSubStatus,
    };
  }
}
