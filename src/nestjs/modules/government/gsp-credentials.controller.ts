import { Controller, Post, Body, Headers, BadRequestException } from '@nestjs/common';
import { GspCredentialsService, SaveGspCredentialsDto } from './gsp-credentials.service';

@Controller('government/credentials')
export class GspCredentialsController {
  constructor(private readonly credentialsService: GspCredentialsService) {}

  @Post()
  async saveCredentials(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: SaveGspCredentialsDto,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    return this.credentialsService.saveCredentials(tenantId, userId || 'admin-user', dto);
  }
}
