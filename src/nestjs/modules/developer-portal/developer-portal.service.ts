import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { ApiKeyService } from '../api-platform/api-key.service';
import { WebhookSubscriptionService } from '../webhooks/webhook-subscription.service';

export interface WebhookHistoryQueryDto {
  subscriptionId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class DeveloperPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apiKeyService: ApiKeyService,
    private readonly webhookSubscriptionService: WebhookSubscriptionService,
  ) {}

  getOpenApiSpec(): any {
    return {
      openapi: '3.0.3',
      info: {
        title: 'TaxFlow GST SaaS Public API',
        description: 'Developer & ERP Integration Ecosystem API Platform',
        version: '1.0.0',
        contact: { name: 'TaxFlow Developer Support', email: 'dev-support@taxflow.ai' },
      },
      servers: [
        { url: 'https://api.taxflow.ai', description: 'Production API Gateway' },
        { url: 'https://sandbox.taxflow.ai', description: 'Sandbox Developer Environment' },
      ],
      paths: {
        '/api/v1/invoices': {
          post: { summary: 'Create Sales or Purchase Invoice', security: [{ BearerAuth: [] }] },
          get: { summary: 'List Invoices', security: [{ BearerAuth: [] }] },
        },
        '/api/v1/einvoice/generate': {
          post: { summary: 'Generate E-Invoice IRN with NIC/GSP', security: [{ BearerAuth: [] }] },
        },
        '/api/v1/webhooks/subscriptions': {
          post: { summary: 'Register Webhook Endpoint', security: [{ BearerAuth: [] }] },
          get: { summary: 'List Webhook Subscriptions', security: [{ BearerAuth: [] }] },
        },
      },
      components: {
        securitySchemes: {
          BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'API_KEY' },
        },
      },
    };
  }

  getPostmanCollection(): any {
    return {
      info: {
        name: 'TaxFlow GST Public API Collection (v2.1)',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: [
        {
          name: 'Authentication',
          item: [{ name: 'Create API Key', request: { method: 'POST', url: '{{baseUrl}}/api/v1/api-keys' } }],
        },
        {
          name: 'Invoices',
          item: [{ name: 'Create Invoice', request: { method: 'POST', url: '{{baseUrl}}/api/v1/invoices' } }],
        },
        {
          name: 'Webhooks',
          item: [{ name: 'List Webhook Subscriptions', request: { method: 'GET', url: '{{baseUrl}}/api/v1/webhooks/subscriptions' } }],
        },
      ],
    };
  }

  async getWebhookDeliveryHistory(tenantId: string, query: WebhookHistoryQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (query.subscriptionId) where.subscriptionId = query.subscriptionId;
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.webhookDeliveryLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.webhookDeliveryLog.count({ where }),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getIntegrationMetrics(tenantId: string) {
    const [apiKeysCount, activeWebhooksCount, totalDeliveries, successfulDeliveries] = await Promise.all([
      this.prisma.apiKey.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.webhookSubscription.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.webhookDeliveryLog.count({ where: { tenantId } }),
      this.prisma.webhookDeliveryLog.count({ where: { tenantId, status: 'DELIVERED' } }),
    ]);

    const successRate = totalDeliveries > 0 ? Math.round((successfulDeliveries / totalDeliveries) * 100) : 100;

    return {
      activeApiKeys: apiKeysCount,
      activeWebhookSubscriptions: activeWebhooksCount,
      totalWebhookDeliveries: totalDeliveries,
      successfulWebhookDeliveries: successfulDeliveries,
      deliverySuccessRatePercentage: successRate,
      integrationStatus: successRate >= 90 ? 'CONNECTED' : 'DEGRADED',
    };
  }
}
