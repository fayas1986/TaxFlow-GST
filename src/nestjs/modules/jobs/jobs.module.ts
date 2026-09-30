import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BillingModule } from '../billing/billing.module';
import { AuditModule } from '../audit/audit.module';
import { CircuitBreakerService } from './circuit-breaker.service';
import { JobDispatcherService } from './job-dispatcher.service';
import { JobWorkerService } from './job-worker.service';
import { JobRecoveryService } from './job-recovery.service';

@Module({
  imports: [PrismaModule, BillingModule, AuditModule],
  providers: [
    CircuitBreakerService,
    JobDispatcherService,
    JobWorkerService,
    JobRecoveryService,
  ],
  exports: [
    CircuitBreakerService,
    JobDispatcherService,
    JobWorkerService,
    JobRecoveryService,
  ],
})
export class JobsModule {}
