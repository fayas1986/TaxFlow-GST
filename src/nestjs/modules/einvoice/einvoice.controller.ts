import { Controller, Post, Body, Headers, BadRequestException } from '@nestjs/common';
import { EInvoiceService, GenerateEInvoiceDto, CancelEInvoiceDto } from './einvoice.service';

@Controller('einvoice')
export class EInvoiceController {
  constructor(private readonly einvoiceService: EInvoiceService) {}

  @Post('generate')
  async generate(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: GenerateEInvoiceDto,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    return this.einvoiceService.generateEInvoice(tenantId, userId || 'system-user', dto);
  }

  @Post('cancel')
  async cancel(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: CancelEInvoiceDto,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    return this.einvoiceService.cancelEInvoice(tenantId, userId || 'system-user', dto);
  }
}
