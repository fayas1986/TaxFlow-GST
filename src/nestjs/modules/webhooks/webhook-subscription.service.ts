import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { SsrfGuardService } from './ssrf-guard.service';
import { WebhookSignerService } from './webhook-signer.service';

export interface CreateSubscriptionDto {
  name: string;
  targetUrl: string;
  events: string[];
}

@Injectable()
export class WebhookSubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ssrfGuard: SsrfGuardService,
    private readonly signerService: WebhookSignerService,
  ) {}

  async createSubscription(tenantId: string, dto: CreateSubscriptionDto): Promise<any> {
    // SSRF & HTTPS Validation
    this.ssrfGuard.validateWebhookUrl(dto.targetUrl);

    const plainSecret = this.signerService.generateSecretKey();
    const encryptedSecret = this.signerService.encryptSecretKey(plainSecret, tenantId);

    const record = await this.prisma.webhookSubscription.create({
      data: {
        tenantId,
        name: dto.name,
        targetUrl: dto.targetUrl,
        secretKey: encryptedSecret,
        events: dto.events || ['*'],
        status: 'ACTIVE',
      },
    });

    return {
      id: record.id,
      tenantId: record.tenantId,
      name: record.name,
      targetUrl: record.targetUrl,
      secretKey: plainSecret, // Returned ONCE to developer
      events: record.events,
      status: record.status,
      createdAt: record.createdAt,
    };
  }

  async listSubscriptions(tenantId: string): Promise<any[]> {
    const list = await this.prisma.webhookSubscription.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((item) => ({
      id: item.id,
      tenantId: item.tenantId,
      name: item.name,
      targetUrl: item.targetUrl,
      events: item.events,
      status: item.status,
      createdAt: item.createdAt,
    }));
  }

  async disableSubscription(tenantId: string, id: string): Promise<void> {
    const existing = await this.prisma.webhookSubscription.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Webhook subscription not found');
    }

    await this.prisma.webhookSubscription.update({
      where: { id },
      data: { status: 'DISABLED' },
    });
  }
}
