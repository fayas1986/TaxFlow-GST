import { Controller, Get, Post, Body, Param, Query, Patch, UseGuards, Req } from '@nestjs/common';
import { InvoicesService, CreateInvoiceDto } from './invoices.service';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { InvoiceCategory } from '@prisma/client';

@Controller('api/v1/invoices')
@UseGuards(TenantContextGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  async findAll(
    @Req() req: any,
    @Query('category') category?: InvoiceCategory,
    @Query('gstinId') gstinId?: string,
    @Query('taxPeriodId') taxPeriodId?: string,
  ) {
    return this.invoicesService.findAll(req.tenantId, category, gstinId, taxPeriodId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.invoicesService.findOne(req.tenantId, id);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateInvoiceDto) {
    return this.invoicesService.createInvoice(req.tenantId, req.user?.userId || 'system', dto);
  }

  @Patch(':id/cancel')
  async cancel(@Req() req: any, @Param('id') id: string) {
    return this.invoicesService.cancelInvoice(req.tenantId, req.user?.userId || 'system', id);
  }
}
