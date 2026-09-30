import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import * as crypto from 'crypto';

export interface CreateAuditEventDto {
  tenantId: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  correlationId: string;
  ipAddress?: string;
  beforeState?: any;
  afterState?: any;
  result?: string;
  reason?: string;
}

@Injectable()
export class ImmutableAuditService {
  private static GENESIS_HASH = '0'.repeat(64);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an immutable audit event into the tenant's tamper-evident hash chain.
   */
  async logEvent(dto: CreateAuditEventDto) {
    if (!dto.tenantId || !dto.action || !dto.entityType) {
      throw new BadRequestException('tenantId, action, and entityType are required for audit logging.');
    }

    // 1. Fetch latest audit event in tenant's append-only chain
    const lastEvent = await this.prisma.immutableAuditLog.findFirst({
      where: { tenantId: dto.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const previousEventHash = lastEvent ? lastEvent.currentEventHash : ImmutableAuditService.GENESIS_HASH;

    // 2. Build canonical payload representation
    const canonicalPayload = JSON.stringify({
      tenantId: dto.tenantId,
      actorUserId: dto.actorUserId || null,
      action: dto.action,
      entityType: dto.entityType,
      entityId: dto.entityId || null,
      correlationId: dto.correlationId,
      beforeState: dto.beforeState || null,
      afterState: dto.afterState || null,
      result: dto.result || 'SUCCESS',
      reason: dto.reason || null,
    });

    // 3. Calculate payload SHA-256 hash
    const payloadHash = crypto.createHash('sha256').update(canonicalPayload).digest('hex');

    // 4. Calculate current event SHA-256 hash (chain link)
    const currentEventHash = crypto.createHash('sha256').update(`${previousEventHash}${payloadHash}`).digest('hex');

    // 5. Append to database (Append-Only)
    const event = await this.prisma.immutableAuditLog.create({
      data: {
        tenantId: dto.tenantId,
        actorUserId: dto.actorUserId || null,
        action: dto.action,
        entityType: dto.entityType,
        entityId: dto.entityId || null,
        correlationId: dto.correlationId,
        ipAddress: dto.ipAddress || null,
        beforeState: dto.beforeState ? dto.beforeState : undefined,
        afterState: dto.afterState ? dto.afterState : undefined,
        result: dto.result || 'SUCCESS',
        reason: dto.reason || null,
        payloadHash,
        previousEventHash,
        currentEventHash,
      },
    });

    return event;
  }

  /**
   * Enforce Immutability: UPDATE is strictly forbidden.
   */
  async updateEvent() {
    throw new ForbiddenException('Audit records are immutable and append-only. UPDATE operations are forbidden.');
  }

  /**
   * Enforce Immutability: DELETE is strictly forbidden.
   */
  async deleteEvent() {
    throw new ForbiddenException('Audit records are immutable and append-only. DELETE operations are forbidden.');
  }

  /**
   * Verify the cryptographic chain integrity for a tenant's audit trail.
   */
  async verifyChainIntegrity(tenantId: string) {
    const logs = await this.prisma.immutableAuditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    let expectedPrevHash = ImmutableAuditService.GENESIS_HASH;
    let isValid = true;
    const brokenIndices: number[] = [];

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      // Check previous event hash matching
      if (log.previousEventHash !== expectedPrevHash) {
        isValid = false;
        brokenIndices.push(i);
      }

      // Recompute payload hash
      const canonicalPayload = JSON.stringify({
        tenantId: log.tenantId,
        actorUserId: log.actorUserId || null,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId || null,
        correlationId: log.correlationId,
        beforeState: log.beforeState || null,
        afterState: log.afterState || null,
        result: log.result,
        reason: log.reason || null,
      });

      const recomputedPayloadHash = crypto.createHash('sha256').update(canonicalPayload).digest('hex');
      const recomputedCurrentHash = crypto.createHash('sha256').update(`${log.previousEventHash}${recomputedPayloadHash}`).digest('hex');

      if (log.currentEventHash !== recomputedCurrentHash) {
        isValid = false;
        if (!brokenIndices.includes(i)) brokenIndices.push(i);
      }

      expectedPrevHash = log.currentEventHash;
    }

    return {
      tenantId,
      totalEventsScanned: logs.length,
      isValid,
      brokenIndices,
    };
  }

  /**
   * Get tenant-isolated audit trail.
   */
  async getAuditTrail(tenantId: string, entityType?: string, entityId?: string) {
    const where: any = { tenantId };
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    return this.prisma.immutableAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }
}
