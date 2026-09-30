import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';

export interface CreateBranchDto {
  companyId: string;
  gstinId: string;
  branchCode: string;
  name: string;
  stateCode: string;
  isHeadOffice?: boolean;
  address?: any;
}

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, companyId?: string, gstinId?: string, allowedBranchIds?: string[]) {
    const whereClause: any = { tenantId };
    if (companyId) whereClause.companyId = companyId;
    if (gstinId) whereClause.gstinId = gstinId;
    if (allowedBranchIds && allowedBranchIds.length > 0) {
      whereClause.id = { in: allowedBranchIds };
    }

    return this.prisma.branch.findMany({
      where: whereClause,
      include: {
        company: true,
        gstRegistration: true,
      },
    });
  }

  async findOne(tenantId: string, branchId: string, allowedBranchIds?: string[]) {
    if (allowedBranchIds && allowedBranchIds.length > 0 && !allowedBranchIds.includes(branchId)) {
      throw new ForbiddenException(`User is not authorized to access branch '${branchId}'.`);
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      include: { company: true, gstRegistration: true },
    });

    if (!branch) {
      throw new NotFoundException(`Branch '${branchId}' not found in tenant '${tenantId}'.`);
    }

    return branch;
  }

  async create(tenantId: string, userId: string, dto: CreateBranchDto) {
    // Enforce hierarchy integrity: Verify GSTIN belongs to Company and Tenant
    const gstin = await this.prisma.gSTRegistration.findFirst({
      where: {
        id: dto.gstinId,
        companyId: dto.companyId,
        tenantId,
      },
    });

    if (!gstin) {
      throw new BadRequestException(
        `GSTIN '${dto.gstinId}' does not belong to Company '${dto.companyId}' under Tenant '${tenantId}'. Cannot attach branch.`,
      );
    }

    const branch = await this.prisma.branch.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        gstinId: dto.gstinId,
        branchCode: dto.branchCode,
        name: dto.name,
        stateCode: dto.stateCode,
        isHeadOffice: dto.isHeadOffice || false,
        address: dto.address,
      },
    });

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        category: 'MASTER_DATA_MUTATION',
        action: 'BRANCH_CREATED',
        entityName: 'Branch',
        entityId: branch.id,
        diff: dto as any,
      },
    });

    return branch;
  }
}
