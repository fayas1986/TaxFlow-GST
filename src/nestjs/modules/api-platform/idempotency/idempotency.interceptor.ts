import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const method = request.method?.toUpperCase();
    const idempotencyKey = request.headers['idempotency-key'] || request.headers['x-idempotency-key'];

    // Only apply idempotency to mutation requests containing Idempotency-Key
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) || !idempotencyKey) {
      return next.handle();
    }

    const tenantId = request.tenantId || request.user?.tenantId;
    if (!tenantId) {
      return next.handle();
    }

    const endpointPath = request.route?.path || request.url;

    const result = await this.idempotencyService.lockOrRetrieve(
      tenantId,
      idempotencyKey,
      endpointPath,
      method,
      request.body,
    );

    if (result.isCached) {
      if (result.headers) {
        Object.entries(result.headers).forEach(([k, v]) => response.setHeader(k, v));
      }
      response.setHeader('X-Cache', 'HIT-IDEMPOTENT');
      response.status(result.status || 200);
      return of(result.body);
    }

    return next.handle().pipe(
      tap({
        next: async (body) => {
          const status = response.statusCode || 200;
          await this.idempotencyService.saveResponse(
            tenantId,
            idempotencyKey,
            endpointPath,
            status,
            body,
            { 'X-Idempotent-Replayed': 'true' },
          );
        },
        error: async () => {
          await this.idempotencyService.unlockOnFailure(tenantId, idempotencyKey, endpointPath);
        },
      }),
    );
  }
}
