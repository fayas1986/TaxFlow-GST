import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { TaxLedgerService, PostLedgerEntryDto } from './tax-ledger.service';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';

@Controller('api/v1/ledger')
@UseGuards(TenantContextGuard)
export class TaxLedgerController {
  constructor(private readonly taxLedgerService: TaxLedgerService) {}

  @Get('entries')
  async findEntries(
    @Req() req: any,
    @Query('gstinId') gstinId?: string,
    @Query('taxPeriodId') taxPeriodId?: string,
  ) {
    return this.taxLedgerService.findEntries(req.tenantId, gstinId, taxPeriodId);
  }

  @Get('summary')
  async getSummary(
    @Req() req: any,
    @Query('gstinId') gstinId: string,
    @Query('taxPeriodId') taxPeriodId: string,
  ) {
    return this.taxLedgerService.getLedgerSummary(req.tenantId, gstinId, taxPeriodId);
  }

  @Post('entries')
  async postEntry(@Req() req: any, @Body() dto: PostLedgerEntryDto) {
    return this.taxLedgerService.postEntry(req.tenantId, req.user?.userId || 'system', dto);
  }
}
