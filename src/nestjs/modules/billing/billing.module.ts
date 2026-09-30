import { Module } from '@nestjs/common';
import { EntitlementService } from './entitlements.service';
import { UsageMeteringService } from './usage-metering.service';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import { PaymentWebhookService } from './payment-provider/payment-webhook.service';
import { AuditModule } from '../audit/audit.module';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  imports: [AuditModule],
  providers: [
    PrismaService,
    EntitlementService,
    UsageMeteringService,
    SubscriptionLifecycleService,
    PaymentWebhookService,
  ],
  exports: [
    EntitlementService,
    UsageMeteringService,
    SubscriptionLifecycleService,
    PaymentWebhookService,
  ],
})
export class BillingModule {}
