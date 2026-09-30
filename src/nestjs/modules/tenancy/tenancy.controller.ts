import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { TenancyService } from './tenancy.service';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';

@Controller('api/v1/tenancy')
export class TenancyController {
  constructor(private readonly tenancyService: TenancyService) {}

  @Get('tenants')
  async listTenants() {
    return this.tenancyService.listTenants();
  }

  @Post('tenants')
  async createTenant(@Body() body: { name: string; code: string; planCode?: string }) {
    return this.tenancyService.createTenant(body);
  }

  @Get('context')
  @UseGuards(TenantContextGuard)
  async getContext(@Param('tenantId') tenantId: string) {
    return this.tenancyService.getTenantContext(tenantId);
  }
}
