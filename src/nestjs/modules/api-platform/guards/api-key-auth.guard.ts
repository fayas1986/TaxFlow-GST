import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyService } from '../api-key.service';

export const REQUIRED_SCOPE_KEY = 'required_scope';
export const RequireScope = (scope: string) => SetMetadata(REQUIRED_SCOPE_KEY, scope);

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    const apiKeyHeader = request.headers['x-api-key'];

    let secretKey: string | undefined = undefined;

    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      secretKey = authHeader.substring(7).trim();
    } else if (apiKeyHeader && typeof apiKeyHeader === 'string') {
      secretKey = apiKeyHeader.trim();
    }

    if (!secretKey) {
      throw new UnauthorizedException('API Key header missing (Authorization: Bearer <key> or x-api-key)');
    }

    const requiredScope = this.reflector.get<string>(REQUIRED_SCOPE_KEY, context.getHandler());

    const keyRecord = await this.apiKeyService.validateApiKey(secretKey, requiredScope);

    // Enforce Tenant Identity resolution from API key
    request.user = {
      tenantId: keyRecord.tenantId,
      apiKeyId: keyRecord.id,
      scopes: keyRecord.scopes,
      environment: keyRecord.environment,
    };
    request.tenantId = keyRecord.tenantId;

    return true;
  }
}
