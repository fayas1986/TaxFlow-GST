import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ReconciliationService, ExecuteReconciliationDto } from './reconciliation.service';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';

@Controller('api/v1/reconciliation')
@UseGuards(TenantContextGuard)
export class ReconciliationController {
  constructor(private readonly reconService: ReconciliationService) {}

  @Get('runs')
  async findRuns(
    @Req() req: any,
    @Query('gstinId') gstinId: string,
    @Query('taxPeriodId') taxPeriodId: string,
  ) {
    return this.reconService.findRuns(req.tenantId, gstinId, taxPeriodId);
  }

  @Post('run')
  async executeRun(@Req() req: any, @Body() dto: ExecuteReconciliationDto) {
    return this.reconService.executeReconciliation(req.tenantId, req.user?.userId || 'system', dto);
  }
}
