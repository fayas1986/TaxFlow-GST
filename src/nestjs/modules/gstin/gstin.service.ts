import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';

export interface CreateGstinDto {
  companyId: string;
  gstin: string;
  legalName: string;
  tradeName?: string;
  stateCode: string;
  registrationType?: string;
}

@Injectable()
export class GstinService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, companyId?: string, allowedGstinIds?: string[]) {
    const whereClause: any = { tenantId };
    if (companyId) {
      whereClause.companyId = companyId;
    }
    if (allowedGstinIds && allowedGstinIds.length > 0) {
      whereClause.id = { in: allowedGstinIds };
    }
    return this.prisma.gSTRegistration.findMany({
      where: whereClause,
      include: {
        company: true,
        branches: true,
      },
    });
  }

  async findOne(tenantId: string, gstinId: string, allowedGstinIds?: string[]) {
    if (allowedGstinIds && allowedGstinIds.length > 0 && !allowedGstinIds.includes(gstinId)) {
      throw new ForbiddenException(`User is not authorized to access GSTIN '${gstinId}'.`);
    }

    const gstin = await this.prisma.gSTRegistration.findFirst({
      where: { id: gstinId, tenantId },
      include: { company: true, branches: true },
    });

    if (!gstin) {
      throw new NotFoundException(`GSTIN registration '${gstinId}' not found in tenant '${tenantId}'.`);
    }

    return gstin;
  }

  async create(tenantId: string, userId: string, dto: CreateGstinDto) {
    // Verify company ownership in exact tenant boundary
    const company = await this.prisma.company.findFirst({
      where: { id: dto.companyId, tenantId },
    });

    if (!company) {
      throw new BadRequestException(
        `Company '${dto.companyId}' does not exist or does not belong to tenant '${tenantId}'. Cannot attach GSTIN.`,
      );
    }

    const gstinReg = await this.prisma.gSTRegistration.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        gstin: dto.gstin,
        legalName: dto.legalName,
        tradeName: dto.tradeName,
        stateCode: dto.stateCode,
        registrationType: dto.registrationType || 'REGULAR',
      },
    });

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        category: 'MASTER_DATA_MUTATION',
        action: 'GSTIN_REGISTERED',
        entityName: 'GSTRegistration',
        entityId: gstinReg.id,
        diff: dto as any,
      },
    });

    return gstinReg;
  }
}
