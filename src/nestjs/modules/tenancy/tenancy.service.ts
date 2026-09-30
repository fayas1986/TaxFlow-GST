import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';

@Injectable()
export class TenancyService {
  constructor(private readonly prisma: PrismaService) {}

  async listTenants() {
    return this.prisma.tenant.findMany({
      include: {
        _count: {
          select: { companies: true, users: true, salesInvoices: true },
        },
      },
    });
  }

  async getTenantContext(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        companies: {
          include: {
            gstRegistrations: {
              include: { branches: true },
            },
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID '${tenantId}' not found.`);
    }

    return tenant;
  }

  async createTenant(data: { name: string; code: string; planCode?: string }) {
    return this.prisma.tenant.create({
      data: {
        name: data.name,
        code: data.code,
        planCode: data.planCode || 'ENTERPRISE',
      },
    });
  }
}
