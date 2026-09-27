/**
 * Tenant-Isolated Background Job Queue Service
 * Guarantees every background task executes strictly within its declared TenantContext.
 */

import { TenantContext } from '../../core/tenancy/types';
import { tenantService } from '../../core/tenancy/tenantService';

export interface BackgroundJob {
  id: string;
  tenantId: string;
  userId: string;
  gstinId?: string;
  branchId?: string;
  resourceId?: string;
  jobType: 'GSTR2B_RECONCILIATION' | 'BULK_EINVOICE_GENERATION' | 'TAX_AUDIT_BATCH' | 'MONTHLY_LEDGER_ARCHIVE' | 'REPORT_EXPORT';
  payload: Record<string, any>;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  processedAt?: string;
  error?: string;
}

class TenantIsolatedJobQueueService {
  private jobs: Map<string, BackgroundJob> = new Map();

  /**
   * Enqueue a job with mandatory TenantContext stamping
   */
  public enqueueJob(
    ctx: TenantContext,
    jobType: BackgroundJob['jobType'],
    payload: Record<string, any>,
    options?: {
      gstinId?: string;
      branchId?: string;
      resourceId?: string;
    }
  ): BackgroundJob {
    if (!ctx.tenantId) {
      throw new Error('500 Internal Error: Cannot enqueue background job without tenant context');
    }

    // Verify GSTIN / branch if supplied
    if (options?.gstinId && ctx.assignedGstinIds && ctx.assignedGstinIds !== 'ALL') {
      if (!ctx.assignedGstinIds.includes(options.gstinId)) {
        throw new Error(`403 Forbidden: User not authorized to enqueue job for GSTIN '${options.gstinId}'`);
      }
    }
    if (options?.branchId && ctx.assignedBranchIds && ctx.assignedBranchIds !== 'ALL') {
      if (!ctx.assignedBranchIds.includes(options.branchId)) {
        throw new Error(`403 Forbidden: User not authorized to enqueue job for branch '${options.branchId}'`);
      }
    }

    const id = `job-${ctx.tenantId}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const job: BackgroundJob = {
      id,
      tenantId: ctx.tenantId, // FORCED tenant stamping
      userId: ctx.userId,
      gstinId: options?.gstinId,
      branchId: options?.branchId,
      resourceId: options?.resourceId,
      jobType,
      payload,
      status: 'QUEUED',
      createdAt: new Date().toISOString()
    };

    this.jobs.set(id, job);
    return job;
  }

  /**
   * Process job enforcing tenant context boundary.
   * Workers must restore and validate tenant context before processing.
   */
  public executeJob(jobId: string, runtimeContext: TenantContext): { success: boolean; error?: string } {
    const job = this.jobs.get(jobId);
    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    // 1. Tenant boundary check: background worker must match the tenant of the job
    if (job.tenantId !== runtimeContext.tenantId) {
      return {
        success: false,
        error: `403 Forbidden [Job Cross-Tenant Violation]: Worker running as tenant '${runtimeContext.tenantId}' attempted to process job '${job.id}' belonging to tenant '${job.tenantId}'`
      };
    }

    // 2. GSTIN boundary check
    if (job.gstinId && runtimeContext.assignedGstinIds && runtimeContext.assignedGstinIds !== 'ALL') {
      if (!runtimeContext.assignedGstinIds.includes(job.gstinId)) {
        return {
          success: false,
          error: `403 Forbidden [Job GSTIN Violation]: Worker not authorized for GSTIN '${job.gstinId}' on job '${job.id}'`
        };
      }
    }

    // 3. Branch boundary check
    if (job.branchId && runtimeContext.assignedBranchIds && runtimeContext.assignedBranchIds !== 'ALL') {
      if (!runtimeContext.assignedBranchIds.includes(job.branchId)) {
        return {
          success: false,
          error: `403 Forbidden [Job Branch Violation]: Worker not authorized for branch '${job.branchId}' on job '${job.id}'`
        };
      }
    }

    job.status = 'COMPLETED';
    job.processedAt = new Date().toISOString();
    return { success: true };
  }

  /**
   * Test cross-tenant job execution attempt
   */
  public testCrossTenantJobExecution(requestingCtx: TenantContext, targetJobId: string): { blocked: boolean; error?: string } {
    const job = this.jobs.get(targetJobId);
    if (!job) return { blocked: true, error: 'Job not found' };

    const result = this.executeJob(targetJobId, requestingCtx);
    if (!result.success) {
      return { blocked: true, error: result.error };
    }
    return { blocked: false };
  }

  public getJobsForTenant(ctx: TenantContext): BackgroundJob[] {
    return Array.from(this.jobs.values()).filter(j => j.tenantId === ctx.tenantId);
  }
}

export const jobQueueService = new TenantIsolatedJobQueueService();
