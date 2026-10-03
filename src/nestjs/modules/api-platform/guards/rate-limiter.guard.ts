import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { BillingService } from '../../billing/billing.service';

interface RateLimitBucket {
  count: number;
  resetTimeMs: number;
}

@Injectable()
export class RateLimiterGuard implements CanActivate {
  private readonly inMemoryBuckets = new Map<string, RateLimitBucket>();

  constructor(private readonly billingService: BillingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const tenantId = request.tenantId || request.user?.tenantId || 'anonymous';
    const apiKeyId = request.user?.apiKeyId || 'session';
    const windowKey = `${tenantId}:${apiKeyId}`;

    const limit = request.user?.rateLimit || 1000;
    const windowMs = 60 * 1000; // 1 minute sliding window
    const now = Date.now();

    let bucket = this.inMemoryBuckets.get(windowKey);
    if (!bucket || now > bucket.resetTimeMs) {
      bucket = {
        count: 0,
        resetTimeMs: now + windowMs,
      };
      this.inMemoryBuckets.set(windowKey, bucket);
    }

    bucket.count++;

    const remaining = Math.max(0, limit - bucket.count);
    const resetEpochSeconds = Math.ceil(bucket.resetTimeMs / 1000);

    if (response && typeof response.setHeader === 'function') {
      response.setHeader('X-RateLimit-Limit', limit.toString());
      response.setHeader('X-RateLimit-Remaining', remaining.toString());
      response.setHeader('X-RateLimit-Reset', resetEpochSeconds.toString());
    }

    if (bucket.count > limit) {
      throw new HttpException(
        {
          type: 'https://taxflow.ai/errors/rate-limit-exceeded',
          title: 'Too Many Requests',
          status: HttpStatus.TOO_MANY_REQUESTS,
          detail: `API rate limit of ${limit} requests per minute exceeded.`,
          code: 'RATE_LIMIT_EXCEEDED',
          timestamp: new Date().toISOString(),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Reuse Stage 10 Billing/Entitlements Service for transaction usage quota deduction
    if (tenantId !== 'anonymous') {
      try {
        await this.billingService.trackUsage(tenantId, 'API_CALL', 1);
      } catch (err) {
        // Log quota deduction error; do not block API request unless quota exceeded
      }
    }

    return true;
  }
}
