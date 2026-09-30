import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { TaxPeriodStatus } from '@prisma/client';

export interface CreateTaxPeriodDto {
  gstinId: string;
  periodKey: string; // MMYYYY e.g., "082026"
}

@Injectable()
export class TaxPeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, gstinId?: string) {
    const whereClause: any = { tenantId };
    if (gstinId) whereClause.gstinId = gstinId;
    return this.prisma.taxPeriod.findMany({
      where: whereClause,
      include: { gstRegistration: true },
      orderBy: { periodKey: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const period = await this.prisma.taxPeriod.findFirst({
      where: { id, tenantId },
      include: { gstRegistration: true },
    });

    if (!period) {
      throw new NotFoundException(`Tax period '${id}' not found in tenant '${tenantId}'.`);
    }

    return period;
  }

  async create(tenantId: string, userId: string, dto: CreateTaxPeriodDto) {
    // Verify GSTIN belongs to tenant
    const gstin = await this.prisma.gSTRegistration.findFirst({
      where: { id: dto.gstinId, tenantId },
    });

    if (!gstin) {
      throw new BadRequestException(`GSTIN '${dto.gstinId}' not found under tenant '${tenantId}'.`);
    }

    const period = await this.prisma.taxPeriod.create({
      data: {
        tenantId,
        gstinId: dto.gstinId,
        periodKey: dto.periodKey,
        status: TaxPeriodStatus.OPEN,
        isLocked: false,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        category: 'TAX_PERIOD_LOCK',
        action: 'TAX_PERIOD_CREATED',
        entityName: 'TaxPeriod',
        entityId: period.id,
        diff: { periodKey: dto.periodKey, status: 'OPEN' } as any,
      },
    });

    return period;
  }

  async transitionStatus(tenantId: string, userId: string, periodId: string, targetStatus: TaxPeriodStatus) {
    const period = await this.findOne(tenantId, periodId);

    if (period.isLocked || period.status === TaxPeriodStatus.LOCKED) {
      throw new ForbiddenException(`Tax period '${period.periodKey}' is LOCKED and cannot be modified.`);
    }

    const isLocked = targetStatus === TaxPeriodStatus.LOCKED || targetStatus === TaxPeriodStatus.FILED;

    const updatedPeriod = await this.prisma.taxPeriod.update({
      where: { id: periodId },
      data: {
        status: targetStatus,
        isLocked,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        category: 'TAX_PERIOD_LOCK',
        action: `TAX_PERIOD_STATUS_CHANGED_TO_${targetStatus}`,
        entityName: 'TaxPeriod',
        entityId: periodId,
        diff: { from: period.status, to: targetStatus, isLocked } as any,
      },
    });

    return updatedPeriod;
  }

  async assertPeriodOpen(tenantId: string, periodId: string) {
    const period = await this.findOne(tenantId, periodId);
    if (period.isLocked || period.status === TaxPeriodStatus.LOCKED || period.status === TaxPeriodStatus.FILED) {
      throw new ForbiddenException(
        `Tax period '${period.periodKey}' is ${period.status} (LOCKED). New transactions or mutations are strictly prohibited.`,
      );
    }
    return period;
  }
}
