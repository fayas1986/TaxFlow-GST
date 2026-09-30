import { Controller, Get, Post, Body, Param, Query, Patch, UseGuards, Req } from '@nestjs/common';
import { ItcService, EvaluateItcDto } from './itc.service';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';

@Controller('api/v1/itc')
@UseGuards(TenantContextGuard)
export class ItcController {
  constructor(private readonly itcService: ItcService) {}

  @Get('records')
  async findRecords(
    @Req() req: any,
    @Query('gstinId') gstinId: string,
    @Query('taxPeriodId') taxPeriodId: string,
  ) {
    return this.itcService.findRecords(req.tenantId, gstinId, taxPeriodId);
  }

  @Post('evaluate')
  async evaluate(@Req() req: any, @Body() dto: EvaluateItcDto) {
    return this.itcService.evaluateAndCreate(req.tenantId, req.user?.userId || 'system', dto);
  }

  @Patch(':id/claim')
  async claim(@Req() req: any, @Param('id') id: string) {
    return this.itcService.claimItc(req.tenantId, req.user?.userId || 'system', id);
  }

  @Patch(':id/reverse')
  async reverse(@Req() req: any, @Param('id') id: string, @Body() body: { reason: string }) {
    return this.itcService.reverseItc(req.tenantId, req.user?.userId || 'system', id, body.reason || 'Statutory Reversal');
  }
}
