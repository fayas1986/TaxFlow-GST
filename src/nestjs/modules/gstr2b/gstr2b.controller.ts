import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { Gstr2bService, ImportGstr2bBatchDto } from './gstr2b.service';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';

@Controller('api/v1/gstr2b')
@UseGuards(TenantContextGuard)
export class Gstr2bController {
  constructor(private readonly gstr2bService: Gstr2bService) {}

  @Get('records')
  async findRecords(
    @Req() req: any,
    @Query('gstinId') gstinId: string,
    @Query('periodKey') periodKey: string,
  ) {
    return this.gstr2bService.findRecords(req.tenantId, gstinId, periodKey);
  }

  @Post('import')
  async importBatch(@Req() req: any, @Body() dto: ImportGstr2bBatchDto) {
    return this.gstr2bService.importBatch(req.tenantId, req.user?.userId || 'system', dto);
  }
}
