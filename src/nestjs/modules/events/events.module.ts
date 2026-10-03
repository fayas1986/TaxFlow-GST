import { Module } from '@nestjs/common';
import { EventRegistryService } from './event-registry.service';
import { OutboxService } from './outbox.service';
import { OutboxProcessorService } from './outbox-processor.service';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [
    EventRegistryService,
    OutboxService,
    OutboxProcessorService,
    PrismaService,
  ],
  exports: [
    EventRegistryService,
    OutboxService,
    OutboxProcessorService,
  ],
})
export class EventsModule {}
