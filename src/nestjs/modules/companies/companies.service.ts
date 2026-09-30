import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';

export interface CreateCompanyDto {
  name: string;
  legalName: string;
  pan: string;
  email?: string;
}

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, allowedCompanyIds?: string[]) {
    const whereClause: any = { tenantId };
    if (allowedCompanyIds && allowedCompanyIds.length > 0) {
      whereClause.id = { in: allowedCompanyIds };
    }
    return this.prisma.company.findMany({
      where: whereClause,
      include: {
        gstRegistrations: true,
        branches: true,
      },
    });
  }

  async findOne(tenantId: string, companyId: string, allowedCompanyIds?: string[]) {
    if (allowedCompanyIds && allowedCompanyIds.length > 0 && !allowedCompanyIds.includes(companyId)) {
      throw new ForbiddenException(`User is not authorized to access company '${companyId}'.`);
    }

    const company = await this.prisma.company.findFirst({
      where: { id: companyId, tenantId },
      include: {
        gstRegistrations: {
          include: { branches: true },
        },
      },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID '${companyId}' not found in tenant '${tenantId}'.`);
    }

    return company;
  }

  async create(tenantId: string, userId: string, dto: CreateCompanyDto) {
    const company = await this.prisma.company.create({
      data: {
        tenantId,
        name: dto.name,
        legalName: dto.legalName,
        pan: dto.pan,
        email: dto.email,
      },
    });

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        category: 'MASTER_DATA_MUTATION',
        action: 'COMPANY_CREATED',
        entityName: 'Company',
        entityId: company.id,
        diff: dto as any,
      },
    });

    return company;
  }
}
