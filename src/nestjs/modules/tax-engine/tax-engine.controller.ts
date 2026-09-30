import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { TaxEngineService, CalculateTaxDto } from './tax-engine.service';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';

@Controller('api/v1/tax-engine')
@UseGuards(TenantContextGuard)
export class TaxEngineController {
  constructor(private readonly taxEngineService: TaxEngineService) {}

  @Get('hsn/search')
  async searchHsn(@Query('q') query: string) {
    return this.taxEngineService.searchHsn(query || '');
  }

  @Post('calculate')
  async calculateTax(@Body() dto: CalculateTaxDto) {
    return this.taxEngineService.calculateTax(dto);
  }
}
