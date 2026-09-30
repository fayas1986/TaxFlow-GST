import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { ImmutableAuditService } from '../audit/immutable-audit.service';
import { ApprovalStatus, ApprovalEntityType } from '@prisma/client';

export interface CreateWorkflowDto {
  tenantId: string;
  entityType: ApprovalEntityType;
  name: string;
  minAmount?: number;
  maxAmount?: number;
  stages: {
    stageIndex: number;
    stageName: string;
    requiredRole?: string;
    requiredUserId?: string;
    minApprovers?: number;
  }[];
}

export interface SubmitApprovalDto {
  tenantId: string;
  companyId?: string;
  gstinId?: string;
  branchId?: string;
  entityType: ApprovalEntityType;
  entityId: string;
  requesterUserId: string;
  comments?: string;
  correlationId: string;
}

export interface ApproveRequestDto {
  tenantId: string;
  requestId: string;
  actorUserId: string;
  actorRole: string;
  comment?: string;
  correlationId: string;
}

export interface RejectRequestDto {
  tenantId: string;
  requestId: string;
  actorUserId: string;
  actorRole: string;
  rejectionReason: string;
  comment?: string;
  correlationId: string;
}

export interface DelegateApprovalDto {
  tenantId: string;
  delegatorUserId: string;
  delegateeUserId: string;
  entityType?: ApprovalEntityType;
  startDate: Date;
  endDate: Date;
}

@Injectable()
export class ApprovalEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: ImmutableAuditService,
  ) {}

  /**
   * Configure a reusable multi-stage approval workflow.
   */
  async createWorkflow(dto: CreateWorkflowDto) {
    if (!dto.stages || dto.stages.length === 0) {
      throw new BadRequestException('Approval workflow must contain at least one stage definition.');
    }

    const workflow = await this.prisma.approvalWorkflow.create({
      data: {
        tenantId: dto.tenantId,
        entityType: dto.entityType,
        name: dto.name,
        minAmount: dto.minAmount !== undefined ? dto.minAmount : null,
        maxAmount: dto.maxAmount !== undefined ? dto.maxAmount : null,
        stages: {
          create: dto.stages.map((st) => ({
            stageIndex: st.stageIndex,
            stageName: st.stageName,
            requiredRole: st.requiredRole || null,
            requiredUserId: st.requiredUserId || null,
            minApprovers: st.minApprovers || 1,
          })),
        },
      },
      include: {
        stages: true,
      },
    });

    await this.auditService.logEvent({
      tenantId: dto.tenantId,
      action: 'APPROVAL_WORKFLOW_CREATED',
      entityType: 'ApprovalWorkflow',
      entityId: workflow.id,
      correlationId: `wf-create-${workflow.id}`,
      afterState: workflow,
      result: 'SUCCESS',
    });

    return workflow;
  }

  /**
   * Submit an entity (invoice, return, reversal) into the approval engine.
   */
  async submitForApproval(dto: SubmitApprovalDto) {
    // Check if an open approval request already exists for this entity
    const existing = await this.prisma.approvalRequest.findFirst({
      where: {
        tenantId: dto.tenantId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        status: { in: [ApprovalStatus.SUBMITTED, ApprovalStatus.UNDER_REVIEW] },
      },
    });

    if (existing) {
      throw new BadRequestException(`An active approval request (${existing.id}) already exists for entity ${dto.entityId}`);
    }

    const request = await this.prisma.approvalRequest.create({
      data: {
        tenantId: dto.tenantId,
        companyId: dto.companyId || null,
        gstinId: dto.gstinId || null,
        branchId: dto.branchId || null,
        entityType: dto.entityType,
        entityId: dto.entityId,
        status: ApprovalStatus.SUBMITTED,
        currentStageIndex: 0,
        requesterUserId: dto.requesterUserId,
        comments: dto.comments || null,
        actions: {
          create: {
            tenantId: dto.tenantId,
            stageIndex: 0,
            actorUserId: dto.requesterUserId,
            action: 'SUBMIT',
            comment: dto.comments || 'Submitted for approval',
          },
        },
      },
      include: {
        actions: true,
      },
    });

    await this.auditService.logEvent({
      tenantId: dto.tenantId,
      actorUserId: dto.requesterUserId,
      action: 'APPROVAL_SUBMITTED',
      entityType: dto.entityType,
      entityId: dto.entityId,
      correlationId: dto.correlationId,
      afterState: { requestId: request.id, status: request.status },
      result: 'SUCCESS',
    });

    return request;
  }

  /**
   * Approve a request at the current stage with Segregation of Duties and Delegation enforcement.
   */
  async approveRequest(dto: ApproveRequestDto) {
    const request = await this.prisma.approvalRequest.findFirst({
      where: { id: dto.requestId, tenantId: dto.tenantId },
      include: { actions: true },
    });

    if (!request) {
      throw new NotFoundException(`Approval request ${dto.requestId} not found for tenant ${dto.tenantId}`);
    }

    if (request.status === ApprovalStatus.APPROVED || request.status === ApprovalStatus.REJECTED) {
      throw new BadRequestException(`Approval request is already in terminal state: ${request.status}`);
    }

    // 1. SEGREGATION OF DUTIES GUARD: Preparer cannot approve own request
    if (request.requesterUserId === dto.actorUserId) {
      await this.auditService.logEvent({
        tenantId: dto.tenantId,
        actorUserId: dto.actorUserId,
        action: 'APPROVAL_BYPASS_ATTEMPT_BLOCKED',
        entityType: request.entityType,
        entityId: request.entityId,
        correlationId: dto.correlationId,
        result: 'BLOCKED',
        reason: 'Segregation of duties violation: Preparer cannot approve own transaction',
      });
      throw new ForbiddenException('Segregation of duties violation: You cannot approve a request created/prepared by yourself.');
    }

    // 2. WORKFLOW CONFIGURATION & STAGE RESOLUTION
    const workflow = await this.prisma.approvalWorkflow.findFirst({
      where: { tenantId: dto.tenantId, entityType: request.entityType, isActive: true },
      include: { stages: { orderBy: { stageIndex: 'asc' } } },
    });

    let targetStage: { stageIndex: number; requiredRole?: string | null; requiredUserId?: string | null } | null = null;
    let totalStages = 1;

    if (workflow && workflow.stages.length > 0) {
      totalStages = workflow.stages.length;
      targetStage = workflow.stages.find((st) => st.stageIndex === request.currentStageIndex) || null;
    }

    // 3. AUTHORIZATION & DELEGATION CHECK
    let isAuthorized = false;

    if (targetStage) {
      if (targetStage.requiredUserId && targetStage.requiredUserId === dto.actorUserId) {
        isAuthorized = true;
      } else if (targetStage.requiredRole && targetStage.requiredRole === dto.actorRole) {
        isAuthorized = true;
      }

      // Check delegation if direct role/user match failed
      if (!isAuthorized && targetStage.requiredUserId) {
        const delegation = await this.prisma.approvalDelegation.findFirst({
          where: {
            tenantId: dto.tenantId,
            delegatorUserId: targetStage.requiredUserId,
            delegateeUserId: dto.actorUserId,
            isActive: true,
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
          },
        });
        if (delegation) {
          isAuthorized = true;
        }
      }
    } else {
      // Default rule: non-preparer approver role
      isAuthorized = true;
    }

    if (!isAuthorized) {
      await this.auditService.logEvent({
        tenantId: dto.tenantId,
        actorUserId: dto.actorUserId,
        action: 'UNAUTHORIZED_APPROVAL_ATTEMPT',
        entityType: request.entityType,
        entityId: request.entityId,
        correlationId: dto.correlationId,
        result: 'BLOCKED',
        reason: 'User lacks required role or delegation for stage',
      });
      throw new ForbiddenException('Unauthorized approval: You do not possess the required role or delegation to approve this stage.');
    }

    // 4. ADVANCE STAGE OR COMPLETE APPROVAL
    const nextStageIndex = request.currentStageIndex + 1;
    const isFullyApproved = nextStageIndex >= totalStages;

    const updatedRequest = await this.prisma.approvalRequest.update({
      where: { id: request.id },
      data: {
        status: isFullyApproved ? ApprovalStatus.APPROVED : ApprovalStatus.UNDER_REVIEW,
        currentStageIndex: isFullyApproved ? request.currentStageIndex : nextStageIndex,
        comments: dto.comment || request.comments,
        actions: {
          create: {
            tenantId: dto.tenantId,
            stageIndex: request.currentStageIndex,
            actorUserId: dto.actorUserId,
            action: 'APPROVE',
            comment: dto.comment || 'Stage approved',
          },
        },
      },
      include: { actions: true },
    });

    await this.auditService.logEvent({
      tenantId: dto.tenantId,
      actorUserId: dto.actorUserId,
      action: isFullyApproved ? 'APPROVAL_COMPLETED' : 'APPROVAL_STAGE_PASSED',
      entityType: request.entityType,
      entityId: request.entityId,
      correlationId: dto.correlationId,
      afterState: { requestId: updatedRequest.id, status: updatedRequest.status, stage: request.currentStageIndex },
      result: 'SUCCESS',
    });

    return updatedRequest;
  }

  /**
   * Reject an approval request with mandatory rejection reason.
   */
  async rejectRequest(dto: RejectRequestDto) {
    if (!dto.rejectionReason || dto.rejectionReason.trim().length === 0) {
      throw new BadRequestException('A valid rejection reason must be provided.');
    }

    const request = await this.prisma.approvalRequest.findFirst({
      where: { id: dto.requestId, tenantId: dto.tenantId },
    });

    if (!request) {
      throw new NotFoundException(`Approval request ${dto.requestId} not found.`);
    }

    if (request.status === ApprovalStatus.APPROVED || request.status === ApprovalStatus.REJECTED) {
      throw new BadRequestException(`Cannot reject request already in terminal state: ${request.status}`);
    }

    // Preparer cannot reject own request as an approval action
    if (request.requesterUserId === dto.actorUserId) {
      throw new ForbiddenException('Segregation of duties: Preparer cannot process approval actions on own request.');
    }

    const updatedRequest = await this.prisma.approvalRequest.update({
      where: { id: request.id },
      data: {
        status: ApprovalStatus.REJECTED,
        rejectionReason: dto.rejectionReason,
        comments: dto.comment || null,
        actions: {
          create: {
            tenantId: dto.tenantId,
            stageIndex: request.currentStageIndex,
            actorUserId: dto.actorUserId,
            action: 'REJECT',
            comment: `Rejected: ${dto.rejectionReason} ${dto.comment ? `(${dto.comment})` : ''}`,
          },
        },
      },
      include: { actions: true },
    });

    await this.auditService.logEvent({
      tenantId: dto.tenantId,
      actorUserId: dto.actorUserId,
      action: 'APPROVAL_REJECTED',
      entityType: request.entityType,
      entityId: request.entityId,
      correlationId: dto.correlationId,
      afterState: { requestId: updatedRequest.id, status: updatedRequest.status, reason: dto.rejectionReason },
      result: 'SUCCESS',
    });

    return updatedRequest;
  }

  /**
   * Delegate approval authority for a user within a specified timeframe.
   */
  async delegateApproval(dto: DelegateApprovalDto) {
    if (dto.delegatorUserId === dto.delegateeUserId) {
      throw new BadRequestException('Delegator and delegatee cannot be the same user.');
    }

    if (new Date(dto.startDate) >= new Date(dto.endDate)) {
      throw new BadRequestException('End date must be strictly after start date for delegation.');
    }

    const delegation = await this.prisma.approvalDelegation.create({
      data: {
        tenantId: dto.tenantId,
        delegatorUserId: dto.delegatorUserId,
        delegateeUserId: dto.delegateeUserId,
        entityType: dto.entityType || null,
        startDate: dto.startDate,
        endDate: dto.endDate,
        isActive: true,
      },
    });

    await this.auditService.logEvent({
      tenantId: dto.tenantId,
      actorUserId: dto.delegatorUserId,
      action: 'APPROVAL_DELEGATED',
      entityType: 'ApprovalDelegation',
      entityId: delegation.id,
      correlationId: `delegation-${delegation.id}`,
      afterState: delegation,
      result: 'SUCCESS',
    });

    return delegation;
  }

  /**
   * Fetch immutable approval history for an entity or request.
   */
  async getApprovalHistory(tenantId: string, requestId: string) {
    const request = await this.prisma.approvalRequest.findFirst({
      where: { id: requestId, tenantId },
      include: { actions: true },
    });

    if (!request) {
      throw new NotFoundException(`Approval request ${requestId} not found for tenant ${tenantId}.`);
    }

    return request;
  }
}
