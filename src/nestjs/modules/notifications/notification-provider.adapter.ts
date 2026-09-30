import { NotificationChannel } from '@prisma/client';

export interface DeliveryResult {
  success: boolean;
  providerReference?: string;
  error?: string;
}

export interface NotificationProviderAdapter {
  channel: NotificationChannel;
  send(recipient: string, eventType: string, payload: any): Promise<DeliveryResult>;
}

export class EmailNotificationProviderAdapter implements NotificationProviderAdapter {
  channel: NotificationChannel = NotificationChannel.EMAIL;

  async send(recipient: string, eventType: string, payload: any): Promise<DeliveryResult> {
    if (recipient.endsWith('@invalid.domain')) {
      return { success: false, error: 'Email provider rejected invalid domain recipient' };
    }
    return {
      success: true,
      providerReference: `email-ref-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
  }
}

export class WebhookNotificationProviderAdapter implements NotificationProviderAdapter {
  channel: NotificationChannel = NotificationChannel.WEBHOOK;

  async send(recipient: string, eventType: string, payload: any): Promise<DeliveryResult> {
    if (recipient.includes('fail-webhook')) {
      return { success: false, error: 'Webhook target endpoint HTTP 500 Connection Refused' };
    }
    return {
      success: true,
      providerReference: `wh-ref-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
  }
}

export class InAppNotificationProviderAdapter implements NotificationProviderAdapter {
  channel: NotificationChannel = NotificationChannel.IN_APP;

  async send(recipient: string, eventType: string, payload: any): Promise<DeliveryResult> {
    return {
      success: true,
      providerReference: `inapp-ref-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
  }
}
