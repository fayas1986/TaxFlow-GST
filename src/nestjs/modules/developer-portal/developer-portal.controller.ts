import {
  Controller,
  Get,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { DeveloperPortalService, WebhookHistoryQueryDto } from './developer-portal.service';

@Controller('api/v1/developer')
export class DeveloperPortalController {
  constructor(private readonly developerPortalService: DeveloperPortalService) {}

  @Get('docs/openapi')
  getOpenApiSpec() {
    return this.developerPortalService.getOpenApiSpec();
  }

  @Get('docs/postman')
  getPostmanCollection() {
    return this.developerPortalService.getPostmanCollection();
  }

  @Get('webhooks/history')
  async getWebhookDeliveryHistory(
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Query() query: WebhookHistoryQueryDto,
  ) {
    if (!tenantIdHeader) {
      throw new UnauthorizedException('x-tenant-id header required');
    }
    return this.developerPortalService.getWebhookDeliveryHistory(tenantIdHeader, query);
  }

  @Get('metrics')
  async getIntegrationMetrics(@Headers('x-tenant-id') tenantIdHeader: string) {
    if (!tenantIdHeader) {
      throw new UnauthorizedException('x-tenant-id header required');
    }
    return this.developerPortalService.getIntegrationMetrics(tenantIdHeader);
  }
}
