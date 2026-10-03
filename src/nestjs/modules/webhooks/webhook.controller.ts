import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { WebhookSubscriptionService, CreateSubscriptionDto } from './webhook-subscription.service';

@Controller('api/v1/webhooks/subscriptions')
export class WebhookController {
  constructor(private readonly webhookSubscriptionService: WebhookSubscriptionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSubscription(
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Body() dto: CreateSubscriptionDto,
  ) {
    if (!tenantIdHeader) {
      throw new UnauthorizedException('x-tenant-id header required');
    }
    return this.webhookSubscriptionService.createSubscription(tenantIdHeader, dto);
  }

  @Get()
  async listSubscriptions(@Headers('x-tenant-id') tenantIdHeader: string) {
    if (!tenantIdHeader) {
      throw new UnauthorizedException('x-tenant-id header required');
    }
    return this.webhookSubscriptionService.listSubscriptions(tenantIdHeader);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disableSubscription(
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') id: string,
  ) {
    if (!tenantIdHeader) {
      throw new UnauthorizedException('x-tenant-id header required');
    }
    await this.webhookSubscriptionService.disableSubscription(tenantIdHeader, id);
  }
}
