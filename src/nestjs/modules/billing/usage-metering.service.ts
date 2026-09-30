import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { ImmutableAuditService } from '../audit/immutable-audit.service';
import { UsageMetric } from '../../../core/usage/types';

export interface IncrementUsageDto {
  tenantId: string;
  metric: UsageMetric;
  delta?: number;
  idempotencyKey: string;
  correlationId: string;
  entityType?: string;
  entityId?: string;
}

@Injectable()
export class UsageMeteringService {
  private readonly logger = new Logger(UsageMeteringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: ImmutableAuditService,
  ) {}

  /**
   * Safe metering wrapper: guarantees usage recording errors do not roll back financial transactions.
   */
  async incrementUsageSafely(dto: IncrementUsageDto) {
    try {
      return await this.incrementUsage(dto);
    } catch (err: any) {
      this.logger.error(`Metering error caught safely without failing business transaction: ${err.message}`);
      return null;
    }
  }

  /**
   * Idempotent & Durable Usage Metering.
   */
  async incrementUsage(dto: IncrementUsageDto) {
    const delta = dto.delta !== undefined ? dto.delta : 1;

    // 1. IDEMPOTENCY GUARD: Check if usage event with this key was already processed
    const existingLog = await this.prisma.usageEventLog.findFirst({
      where: { tenantId: dto.tenantId, idempotencyKey: dto.idempotencyKey },
    });

    if (existingLog) {
      this.logger.log(`Idempotent usage event hit for key: ${dto.idempotencyKey}`);
      return { idempotencyHit: true, eventLog: existingLog };
    }

    // 2. Determine Current Billing Period Key (YYYY-MM)
    const now = new Date();
    const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 3. Upsert UsageCounterRecord
    const counter = await this.prisma.usageCounterRecord.upsert({
      where: {
        tenantId_periodKey_metric: {
          tenantId: dto.tenantId,
          periodKey,
          metric: String(dto.metric),
        },
      },
      update: {
        currentValue: { increment: delta },
      },
      create: {
        tenantId: dto.tenantId,
        periodKey,
        metric: String(dto.metric),
        currentValue: BigInt(delta),
      },
    });

    // 4. Record Usage Event Log
    const eventLog = await this.prisma.usageEventLog.create({
      data: {
        tenantId: dto.tenantId,
        metric: String(dto.metric),
        delta,
        idempotencyKey: dto.idempotencyKey,
        entityType: dto.entityType || null,
        entityId: dto.entityId || null,
        correlationId: dto.correlationId,
      },
    });

    return { idempotencyHit: false, counter, eventLog };
  }

  /**
   * Fetch durable usage summary for a tenant.
   */
  async getTenantUsage(tenantId: string, periodKey?: string) {
    const now = new Date();
    const activePeriod = periodKey || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const counters = await this.prisma.usageCounterRecord.findMany({
      where: { tenantId, periodKey: activePeriod },
    });

    const metricsMap: Record<string, number> = {};
    counters.forEach((c) => {
      metricsMap[c.metric] = Number(c.currentValue);
    });

    return {
      tenantId,
      periodKey: activePeriod,
      metrics: metricsMap,
    };
  }
}
