import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { GstinService, CreateGstinDto } from './gstin.service';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';

@Controller('api/v1/gstin')
@UseGuards(TenantContextGuard)
export class GstinController {
  constructor(private readonly gstinService: GstinService) {}

  @Get('registrations')
  async findAll(@Req() req: any, @Query('companyId') companyId?: string) {
    return this.gstinService.findAll(req.tenantId, companyId, req.user?.allowedGstins);
  }

  @Get('registrations/:id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.gstinService.findOne(req.tenantId, id, req.user?.allowedGstins);
  }

  @Post('registrations')
  async create(@Req() req: any, @Body() dto: CreateGstinDto) {
    return this.gstinService.create(req.tenantId, req.user?.userId || 'system', dto);
  }
}
