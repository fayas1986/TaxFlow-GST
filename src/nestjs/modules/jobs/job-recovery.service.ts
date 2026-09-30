import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ImmutableAuditService } from '../audit/immutable-audit.service';
import { BackgroundJobStatus, StalledJobResolution } from './types';

@Injectable()
export class JobRecoveryService {
  private readonly logger = new Logger(JobRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: ImmutableAuditService,
  ) {}

  async detectAndRecoverStalledJobs(stalledThresholdSeconds = 60): Promise<StalledJobResolution[]> {
    const cutoffTime = new Date(Date.now() - stalledThresholdSeconds * 1000);

    const stalledJobs = await this.prisma.backgroundJobRecord.findMany({
      where: {
        status: BackgroundJobStatus.PROCESSING,
        lockedAt: {
          lt: cutoffTime,
        },
      },
    });

    const resolutions: StalledJobResolution[] = [];

    for (const job of stalledJobs) {
      if (job.attempts < job.maxAttempts) {
        // Re-queue job
        await this.prisma.backgroundJobRecord.update({
          where: { id: job.id },
          data: {
            status: BackgroundJobStatus.QUEUED,
            stalledAt: new Date(),
            lockedAt: null,
            lockedBy: null,
          },
        });

        await this.prisma.jobExecutionLog.create({
          data: {
            jobId: job.id,
            tenantId: job.tenantId,
            attempt: job.attempts,
            status: BackgroundJobStatus.STALLED,
            logMessage: `Stalled worker lock detected (lock timeout > ${stalledThresholdSeconds}s). Re-queued job for execution attempt #${job.attempts + 1}.`,
          },
        });

        await this.auditService.logEvent({
          tenantId: job.tenantId,
          userId: job.userId || 'SYSTEM',
          eventType: 'BACKGROUND_JOB_RECOVERED',
          resourceType: 'BACKGROUND_JOB',
          resourceId: job.id,
          action: 'RECOVER_STALLED',
          metadata: {
            previousStatus: BackgroundJobStatus.PROCESSING,
            newStatus: BackgroundJobStatus.QUEUED,
            attempt: job.attempts,
          },
        });

        resolutions.push({
          jobId: job.id,
          tenantId: job.tenantId,
          action: 'REQUEUED',
          reason: `Stalled lock > ${stalledThresholdSeconds}s`,
        });
      } else {
        // Exceeded max attempts -> Route to Dead Letter Queue
        await this.prisma.backgroundJobRecord.update({
          where: { id: job.id },
          data: {
            status: BackgroundJobStatus.DEAD_LETTER,
            stalledAt: new Date(),
            errorMessage: `Stalled execution exceeded max attempts (${job.attempts}/${job.maxAttempts})`,
            lockedAt: null,
            lockedBy: null,
          },
        });

        await this.prisma.jobExecutionLog.create({
          data: {
            jobId: job.id,
            tenantId: job.tenantId,
            attempt: job.attempts,
            status: BackgroundJobStatus.DEAD_LETTER,
            logMessage: `Stalled job exceeded max attempts (${job.attempts}/${job.maxAttempts}). Routed to Dead Letter Queue.`,
          },
        });

        await this.auditService.logEvent({
          tenantId: job.tenantId,
          userId: job.userId || 'SYSTEM',
          eventType: 'BACKGROUND_JOB_DEAD_LETTER',
          resourceType: 'BACKGROUND_JOB',
          resourceId: job.id,
          action: 'MOVE_TO_DLQ',
          metadata: {
            attempts: job.attempts,
            maxAttempts: job.maxAttempts,
          },
        });

        resolutions.push({
          jobId: job.id,
          tenantId: job.tenantId,
          action: 'MOVED_TO_DLQ',
          reason: `Stalled lock exceeded max attempts (${job.attempts}/${job.maxAttempts})`,
        });
      }
    }

    if (resolutions.length > 0) {
      this.logger.warn(`JobRecoveryService processed ${resolutions.length} stalled job(s).`);
    }

    return resolutions;
  }
}
