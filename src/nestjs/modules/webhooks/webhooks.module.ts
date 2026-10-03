import { Module } from '@nestjs/common';
import { SsrfGuardService } from './ssrf-guard.service';
import { WebhookSignerService } from './webhook-signer.service';
import { WebhookSubscriptionService } from './webhook-subscription.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { WebhookController } from './webhook.controller';
import { PrismaService } from '../../common/services/prisma.service';
import { EventsModule } from '../events/events.module';
import { SecurityModule } from '../security/security.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [EventsModule, SecurityModule, AuditModule],
  controllers: [WebhookController],
  providers: [
    SsrfGuardService,
    WebhookSignerService,
    WebhookSubscriptionService,
    WebhookDispatcherService,
    PrismaService,
  ],
  exports: [
    SsrfGuardService,
    WebhookSignerService,
    WebhookSubscriptionService,
    WebhookDispatcherService,
  ],
})
export class WebhooksModule {}
