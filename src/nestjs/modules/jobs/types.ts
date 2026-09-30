import { JobDomain, BackgroundJobStatus } from '@prisma/client';

export { JobDomain, BackgroundJobStatus };

export interface TenantSecurityContext {
  tenantId: string;
  userId?: string;
  permissions: string[];
  subscriptionStatus?: string;
  planCode?: string;
}

export interface AsyncJobPayload<T = any> {
  tenantId: string;
  userId?: string;
  domain: JobDomain;
  jobType: string;
  idempotencyKey: string;
  correlationId: string;
  data: T;
  securityContext: TenantSecurityContext;
  maxAttempts?: number;
}

export interface JobExecutionResult<T = any> {
  success: boolean;
  jobId: string;
  tenantId: string;
  domain: JobDomain;
  attempts: number;
  result?: T;
  error?: string;
  circuitOpen?: boolean;
  transientFailure?: boolean;
}

export interface StalledJobResolution {
  jobId: string;
  tenantId: string;
  action: 'REQUEUED' | 'MOVED_TO_DLQ';
  reason: string;
}
