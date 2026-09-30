import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ImmutableAuditService } from '../audit/immutable-audit.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { JobExecutionResult, JobDomain, BackgroundJobStatus, TenantSecurityContext } from './types';

export type JobHandlerFn<T = any, R = any> = (
  payload: T,
  securityContext: TenantSecurityContext
) => Promise<R>;

@Injectable()
export class JobWorkerService {
  private readonly logger = new Logger(JobWorkerService.name);
  private handlers = new Map<string, JobHandlerFn>();
  private readonly workerId = `worker-${Math.random().toString(36).substring(2, 9)}`;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: ImmutableAuditService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  registerHandler<T = any, R = any>(
    domain: JobDomain,
    jobType: string,
    handler: JobHandlerFn<T, R>
  ): void {
    const key = `${domain}:${jobType}`;
    this.handlers.set(key, handler);
    this.logger.log(`Registered background worker handler for [${key}]`);
  }

  async executeJob(jobId: string): Promise<JobExecutionResult> {
    const startTime = Date.now();

    // 1. Fetch Job Record
    const job = await this.prisma.backgroundJobRecord.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error(`Background job record [${jobId}] not found.`);
    }

    const payloadObj = job.payload as any;
    const securityContext: TenantSecurityContext = payloadObj?.securityContext;
    const jobData = payloadObj?.data;

    // 2. Re-verify Security & Tenant Context
    if (!securityContext || securityContext.tenantId !== job.tenantId) {
      const err = `Tenant context validation failed for job [${jobId}]: payload tenantId does not match job record tenantId [${job.tenantId}]`;
      await this.markJobFailed(job, err, 0, true);
      throw new ForbiddenException(err);
    }

    // 3. Check Circuit Breaker State
    if (!this.circuitBreaker.canExecute(job.domain as JobDomain)) {
      const err = `Circuit breaker for domain [${job.domain}] is OPEN. Skipping execution.`;
      await this.logExecutionStep(job.id, job.tenantId, job.attempts + 1, BackgroundJobStatus.FAILED, 0, err);
      return {
        success: false,
        jobId: job.id,
        tenantId: job.tenantId,
        domain: job.domain as JobDomain,
        attempts: job.attempts,
        error: err,
        circuitOpen: true,
      };
    }

    // 4. Atomic Lock & Status Update to PROCESSING
    const currentAttempt = job.attempts + 1;
    await this.prisma.backgroundJobRecord.update({
      where: { id: jobId },
      data: {
        status: BackgroundJobStatus.PROCESSING,
        attempts: currentAttempt,
        lockedAt: new Date(),
        lockedBy: this.workerId,
      },
    });

    await this.logExecutionStep(jobId, job.tenantId, currentAttempt, BackgroundJobStatus.PROCESSING, 0, `Worker [${this.workerId}] started processing attempt #${currentAttempt}`);

    // 5. Lookup Handler
    const handlerKey = `${job.domain}:${job.jobType}`;
    const handler = this.handlers.get(handlerKey);

    if (!handler) {
      const err = `No registered worker handler found for key [${handlerKey}]`;
      return await this.markJobFailed(job, err, currentAttempt, true);
    }

    // 6. Execute Handler within Reconstructed Security Context
    try {
      const result = await handler(jobData, securityContext);
      const executionTimeMs = Date.now() - startTime;

      // Mark Successful Completion
      await this.prisma.backgroundJobRecord.update({
        where: { id: jobId },
        data: {
          status: BackgroundJobStatus.COMPLETED,
          result: result || { status: 'SUCCESS' },
          lockedAt: null,
          lockedBy: null,
          completedAt: new Date(),
        },
      });

      await this.logExecutionStep(jobId, job.tenantId, currentAttempt, BackgroundJobStatus.COMPLETED, executionTimeMs, `Job completed successfully in ${executionTimeMs}ms`);

      this.circuitBreaker.recordSuccess(job.domain as JobDomain);

      await this.auditService.logEvent({
        tenantId: job.tenantId,
        userId: job.userId || 'SYSTEM',
        eventType: 'BACKGROUND_JOB_COMPLETED',
        resourceType: 'BACKGROUND_JOB',
        resourceId: job.id,
        action: 'EXECUTE',
        metadata: {
          domain: job.domain,
          jobType: job.jobType,
          executionTimeMs,
          attempt: currentAttempt,
        },
      });

      return {
        success: true,
        jobId: job.id,
        tenantId: job.tenantId,
        domain: job.domain as JobDomain,
        attempts: currentAttempt,
        result,
      };
    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;
      const errorMsg = error?.message || 'Unknown background job error';

      this.circuitBreaker.recordFailure(job.domain as JobDomain, errorMsg);

      return await this.markJobFailed(job, errorMsg, currentAttempt, false, executionTimeMs);
    }
  }

  private async markJobFailed(
    job: any,
    errorMessage: string,
    attempt: number,
    fatal: boolean,
    executionTimeMs = 0
  ): Promise<JobExecutionResult> {
    const isDeadLetter = fatal || attempt >= job.maxAttempts;
    const nextStatus = isDeadLetter ? BackgroundJobStatus.DEAD_LETTER : BackgroundJobStatus.FAILED;

    await this.prisma.backgroundJobRecord.update({
      where: { id: job.id },
      data: {
        status: nextStatus,
        errorMessage,
        lockedAt: null,
        lockedBy: null,
      },
    });

    await this.logExecutionStep(
      job.id,
      job.tenantId,
      attempt,
      nextStatus,
      executionTimeMs,
      `Attempt #${attempt} failed: ${errorMessage}. Status -> ${nextStatus}`
    );

    await this.auditService.logEvent({
      tenantId: job.tenantId,
      userId: job.userId || 'SYSTEM',
      eventType: isDeadLetter ? 'BACKGROUND_JOB_DEAD_LETTER' : 'BACKGROUND_JOB_FAILED',
      resourceType: 'BACKGROUND_JOB',
      resourceId: job.id,
      action: 'EXECUTE_FAILED',
      metadata: {
        domain: job.domain,
        jobType: job.jobType,
        attempt,
        fatal,
        errorMessage,
      },
    });

    return {
      success: false,
      jobId: job.id,
      tenantId: job.tenantId,
      domain: job.domain as JobDomain,
      attempts: attempt,
      error: errorMessage,
      transientFailure: !isDeadLetter,
    };
  }

  private async logExecutionStep(
    jobId: string,
    tenantId: string,
    attempt: number,
    status: BackgroundJobStatus,
    executionTimeMs: number,
    logMessage: string
  ): Promise<void> {
    await this.prisma.jobExecutionLog.create({
      data: {
        jobId,
        tenantId,
        attempt,
        status,
        executionTimeMs,
        logMessage,
      },
    });
  }
}
