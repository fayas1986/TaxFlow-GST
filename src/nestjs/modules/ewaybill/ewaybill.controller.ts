import { Controller, Post, Body, Headers, BadRequestException } from '@nestjs/common';
import { EWayBillService, GenerateEWayBillDto, UpdateVehicleDto, CancelEWayBillDto } from './ewaybill.service';

@Controller('ewaybill')
export class EWayBillController {
  constructor(private readonly ewaybillService: EWayBillService) {}

  @Post('generate')
  async generate(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: GenerateEWayBillDto,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    return this.ewaybillService.generateEWayBill(tenantId, userId || 'system-user', dto);
  }

  @Post('update-vehicle')
  async updateVehicle(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    return this.ewaybillService.updateVehicleDetails(tenantId, userId || 'system-user', dto);
  }

  @Post('cancel')
  async cancel(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: CancelEWayBillDto,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    return this.ewaybillService.cancelEWayBill(tenantId, userId || 'system-user', dto);
  }
}
