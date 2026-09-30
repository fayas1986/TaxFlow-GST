import { Injectable, ForbiddenException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CryptoService } from '../../common/services/crypto.service';
import { ImmutableAuditService } from '../audit/immutable-audit.service';
import * as crypto from 'crypto';

export interface InboundWebhookDto {
  tenantId: string;
  integrationId: string;
  signatureHeader: string;
  timestampHeader: string;
  rawBody: string;
  payload: any;
  correlationId: string;
}

@Injectable()
export class WebhookIngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly auditService: ImmutableAuditService,
  ) {}

  /**
   * Process inbound ERP webhook with HMAC signature validation, timestamp replay protection, and tenant isolation.
   */
  async processInboundWebhook(dto: InboundWebhookDto) {
    // 1. Fetch integration and enforce Tenant Isolation
    const integration = await this.prisma.erpIntegration.findFirst({
      where: { id: dto.integrationId, tenantId: dto.tenantId, isActive: true },
    });

    if (!integration) {
      await this.auditService.logEvent({
        tenantId: dto.tenantId,
        action: 'WEBHOOK_SECURITY_VIOLATION',
        entityType: 'ErpIntegration',
        entityId: dto.integrationId,
        correlationId: dto.correlationId,
        result: 'BLOCKED',
        reason: 'Tenant mismatch or integration inactive',
      });
      throw new ForbiddenException('Forbidden: Integration not found or tenant scope mismatch.');
    }

    // 2. Replay Protection (Timestamp within 300 seconds)
    const requestTime = Number(dto.timestampHeader);
    const now = Date.now();
    if (isNaN(requestTime) || Math.abs(now - requestTime) > 300000) {
      await this.auditService.logEvent({
        tenantId: dto.tenantId,
        action: 'WEBHOOK_REPLAY_ATTEMPT_BLOCKED',
        entityType: 'ErpIntegration',
        entityId: dto.integrationId,
        correlationId: dto.correlationId,
        result: 'BLOCKED',
        reason: 'Timestamp expired outside 300s window',
      });
      throw new UnauthorizedException('Unauthorized: Webhook timestamp expired (Replay protection).');
    }

    // 3. HMAC Signature Validation
    const webhookSecret = integration.webhookSecret || 'default-webhook-secret';
    const computedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${dto.timestampHeader}.${dto.rawBody}`)
      .digest('hex');

    if (dto.signatureHeader !== computedSignature && dto.signatureHeader !== `sha256=${computedSignature}`) {
      await this.auditService.logEvent({
        tenantId: dto.tenantId,
        action: 'WEBHOOK_SIGNATURE_FAILED',
        entityType: 'ErpIntegration',
        entityId: dto.integrationId,
        correlationId: dto.correlationId,
        result: 'BLOCKED',
        reason: 'HMAC signature mismatch',
      });
      throw new UnauthorizedException('Unauthorized: Invalid HMAC webhook signature.');
    }

    // 4. Record Webhook Audit
    await this.auditService.logEvent({
      tenantId: dto.tenantId,
      action: 'INBOUND_WEBHOOK_ACCEPTED',
      entityType: 'ErpIntegration',
      entityId: dto.integrationId,
      correlationId: dto.correlationId,
      result: 'SUCCESS',
    });

    return {
      status: 'ACCEPTED',
      integrationId: integration.id,
      correlationId: dto.correlationId,
      timestamp: new Date(),
    };
  }
}
