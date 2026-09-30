import { Controller, Get, Post, Body, Param, Query, Patch, UseGuards, Req } from '@nestjs/common';
import { TaxPeriodsService, CreateTaxPeriodDto } from './tax-periods.service';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { TaxPeriodStatus } from '@prisma/client';

@Controller('api/v1/tax-periods')
@UseGuards(TenantContextGuard)
export class TaxPeriodsController {
  constructor(private readonly taxPeriodsService: TaxPeriodsService) {}

  @Get()
  async findAll(@Req() req: any, @Query('gstinId') gstinId?: string) {
    return this.taxPeriodsService.findAll(req.tenantId, gstinId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.taxPeriodsService.findOne(req.tenantId, id);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateTaxPeriodDto) {
    return this.taxPeriodsService.create(req.tenantId, req.user?.userId || 'system', dto);
  }

  @Patch(':id/status')
  async transitionStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { status: TaxPeriodStatus },
  ) {
    return this.taxPeriodsService.transitionStatus(req.tenantId, req.user?.userId || 'system', id, body.status);
  }
}
