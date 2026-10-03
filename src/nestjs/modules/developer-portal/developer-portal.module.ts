import { Module } from '@nestjs/common';
import { DeveloperPortalService } from './developer-portal.service';
import { DeveloperPortalController } from './developer-portal.controller';
import { PrismaService } from '../../common/services/prisma.service';
import { ApiPlatformModule } from '../api-platform/api-platform.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [ApiPlatformModule, WebhooksModule],
  controllers: [DeveloperPortalController],
  providers: [DeveloperPortalService, PrismaService],
  exports: [DeveloperPortalService],
})
export class DeveloperPortalModule {}
