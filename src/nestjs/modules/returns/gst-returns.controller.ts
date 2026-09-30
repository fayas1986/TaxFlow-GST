import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { GstReturnsService } from './gst-returns.service';
import { ReturnType } from '@prisma/client';

@Controller('returns')
export class GstReturnsController {
  constructor(private readonly returnsService: GstReturnsService) {}

  @Post('prepare')
  async prepare(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-user-id') userId: string,
    @Body() body: { companyId: string; gstinId: string; taxPeriodId: string; returnType: ReturnType },
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    return this.returnsService.prepareReturn(
      tenantId,
      body.companyId,
      body.gstinId,
      body.taxPeriodId,
      body.returnType,
      userId || 'system-user',
    );
  }

  @Post(':id/validate')
  async validate(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') returnId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    return this.returnsService.validateReturn(tenantId, returnId);
  }

  @Post(':id/approve')
  async approve(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-user-id') userId: string,
    @Param('id') returnId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    return this.returnsService.approveReturn(tenantId, returnId, userId || 'approver-user');
  }

  @Post(':id/file')
  async file(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-idempotency-key') idempotencyKey: string,
    @Param('id') returnId: string,
    @Body() body: { simulateError?: boolean },
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    const key = idempotencyKey || `IDEMP-${returnId}-${Date.now()}`;
    return this.returnsService.fileReturn(tenantId, returnId, userId || 'filer-user', key, body?.simulateError || false);
  }

  @Get(':id/history')
  async getHistory(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') returnId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    return this.returnsService.getReturnHistory(tenantId, returnId);
  }
}
