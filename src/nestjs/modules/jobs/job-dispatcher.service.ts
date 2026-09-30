import { Injectable, Logger, ForbiddenException, ServiceUnavailableException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementsService } from '../billing/entitlements.service';
import { ImmutableAuditService } from '../audit/immutable-audit.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { AsyncJobPayload, JobDomain, BackgroundJobStatus } from './types';

export interface DispatchOptions {
  maxAttempts?: number;
  skipEntitlementCheck?: boolean;
}

export interface DispatchResult {
  jobId: string;
  tenantId: string;
  domain: JobDomain;
  jobType: string;
  status: BackgroundJobStatus;
  idempotencyHit: boolean;
  correlationId: string;
}

@Injectable()
export class JobDispatcherService {
  private readonly logger = new Logger(JobDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementService: EntitlementsService,
    private readonly auditService: ImmutableAuditService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  async dispatchJob<T = any>(
    payload: AsyncJobPayload<T>,
    options?: DispatchOptions
  ): Promise<DispatchResult> {
    const { tenantId, userId, domain, jobType, idempotencyKey, correlationId, data, securityContext } = payload;

    // 1. Tenant Context & Security Validation
    if (!tenantId || tenantId !== securityContext.tenantId) {
      throw new ForbiddenException(`Tenant context mismatch: payload tenantId [${tenantId}] does not match securityContext tenantId [${securityContext?.tenantId}]`);
    }

    // 2. Authorization & Entitlement Pre-Check
    if (!options?.skipEntitlementCheck) {
      const activeSub = await this.prisma.subscription.findUnique({
        where: { tenantId },
      });

      if (activeSub && (activeSub.status === 'SUSPENDED' || activeSub.status === 'EXPIRED')) {
        throw new ForbiddenException(`Tenant subscription status [${activeSub.status}] prohibits launching async background job [${jobType}]`);
      }
    }

    // 3. Circuit Breaker Check
    if (!this.circuitBreaker.canExecute(domain)) {
      throw new ServiceUnavailableException(`External integration domain [${domain}] circuit is OPEN due to consecutive failures. Job dispatch aborted.`);
    }

    // 4. Idempotency Check in Persistence
    const existingJob = await this.prisma.backgroundJobRecord.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId,
          idempotencyKey,
        },
      },
    });

    if (existingJob) {
      this.logger.log(`Idempotent job hit for key [${idempotencyKey}] on tenant [${tenantId}]. Returning existing job [${existingJob.id}].`);
      return {
        jobId: existingJob.id,
        tenantId: existingJob.tenantId,
        domain: existingJob.domain as JobDomain,
        jobType: existingJob.jobType,
        status: existingJob.status as BackgroundJobStatus,
        idempotencyHit: true,
        correlationId: existingJob.correlationId,
      };
    }

    // 5. Create Persistent Job Record
    const maxAttempts = options?.maxAttempts || payload.maxAttempts || 3;
    const newJob = await this.prisma.backgroundJobRecord.create({
      data: {
        tenantId,
        userId,
        domain,
        jobType,
        idempotencyKey,
        status: BackgroundJobStatus.QUEUED,
        attempts: 0,
        maxAttempts,
        payload: {
          data,
          securityContext,
        },
        correlationId,
      },
    });

    // 6. Log Initial Job Execution Record
    await this.prisma.jobExecutionLog.create({
      data: {
        jobId: newJob.id,
        tenantId,
        attempt: 0,
        status: BackgroundJobStatus.QUEUED,
        logMessage: `Job [${jobType}] enqueued with idempotencyKey [${idempotencyKey}]`,
      },
    });

    // 7. Record Immutable Audit Event
    await this.auditService.logEvent({
      tenantId,
      userId: userId || 'SYSTEM',
      eventType: 'BACKGROUND_JOB_DISPATCHED',
      resourceType: 'BACKGROUND_JOB',
      resourceId: newJob.id,
      action: 'DISPATCH',
      metadata: {
        domain,
        jobType,
        idempotencyKey,
        correlationId,
      },
    });

    return {
      jobId: newJob.id,
      tenantId: newJob.tenantId,
      domain: newJob.domain as JobDomain,
      jobType: newJob.jobType,
      status: newJob.status as BackgroundJobStatus,
      idempotencyHit: false,
      correlationId: newJob.correlationId,
    };
  }
}
