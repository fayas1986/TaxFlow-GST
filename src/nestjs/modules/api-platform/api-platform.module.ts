import { Module } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard';
import { IdempotencyService } from './idempotency/idempotency.service';
import { IdempotencyInterceptor } from './idempotency/idempotency.interceptor';
import { RateLimiterGuard } from './guards/rate-limiter.guard';
import { ApiExceptionFilter } from './filters/api-exception.filter';
import { PrismaService } from '../../common/services/prisma.service';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  controllers: [ApiKeyController],
  providers: [
    ApiKeyService,
    ApiKeyAuthGuard,
    IdempotencyService,
    IdempotencyInterceptor,
    RateLimiterGuard,
    ApiExceptionFilter,
    PrismaService,
  ],
  exports: [
    ApiKeyService,
    ApiKeyAuthGuard,
    IdempotencyService,
    IdempotencyInterceptor,
    RateLimiterGuard,
    ApiExceptionFilter,
  ],
})
export class ApiPlatformModule {}
