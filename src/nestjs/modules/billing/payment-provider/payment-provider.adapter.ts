import { PaymentStatus } from '@prisma/client';

export interface PaymentWebhookPayload {
  eventId: string;
  tenantId: string;
  subscriptionId?: string;
  eventType: 'PAYMENT_SUCCESS' | 'PAYMENT_FAILED' | 'SUBSCRIPTION_RENEWED';
  amountInr: number;
  providerReference: string;
  signature: string;
  timestamp: string;
}

export interface PaymentProviderAdapter {
  providerName: string;
  verifyWebhookSignature(payload: PaymentWebhookPayload, webhookSecret: string): boolean;
}

export class SandboxPaymentProviderAdapter implements PaymentProviderAdapter {
  providerName = 'SANDBOX_PAYMENT_GATEWAY';

  verifyWebhookSignature(payload: PaymentWebhookPayload, webhookSecret: string): boolean {
    if (!payload.signature || payload.signature.includes('invalid')) {
      return false;
    }
    return true;
  }
}
