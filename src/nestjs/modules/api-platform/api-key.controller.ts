import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeyService, CreateApiKeyDto } from './api-key.service';

@Controller('api/v1/api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createApiKey(
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    if (!tenantIdHeader) {
      throw new UnauthorizedException('x-tenant-id header required for API Key creation');
    }
    return this.apiKeyService.createApiKey(tenantIdHeader, dto);
  }

  @Get()
  async listApiKeys(@Headers('x-tenant-id') tenantIdHeader: string) {
    if (!tenantIdHeader) {
      throw new UnauthorizedException('x-tenant-id header required');
    }
    return this.apiKeyService.listApiKeys(tenantIdHeader);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeApiKey(
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') id: string,
  ) {
    if (!tenantIdHeader) {
      throw new UnauthorizedException('x-tenant-id header required');
    }
    await this.apiKeyService.revokeApiKey(tenantIdHeader, id);
  }
}
