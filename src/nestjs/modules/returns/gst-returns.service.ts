import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { Gstr1Service } from './gstr1.service';
import { Gstr3bService } from './gstr3b.service';
import { ReturnValidationService } from './return-validation.service';
import { FilingAdapterService } from './filing-adapter.service';
import { ReturnType, ReturnStatus } from '@prisma/client';

@Injectable()
export class GstReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gstr1Service: Gstr1Service,
    private readonly gstr3bService: Gstr3bService,
    private readonly validationService: ReturnValidationService,
    private readonly filingAdapter: FilingAdapterService,
  ) {}

  async prepareReturn(
    tenantId: string,
    companyId: string,
    gstinId: string,
    taxPeriodId: string,
    returnType: ReturnType,
    userId: string,
  ) {
    const taxPeriod = await this.prisma.taxPeriod.findFirst({
      where: { id: taxPeriodId, tenantId, gstinId },
    });
    if (!taxPeriod) {
      throw new NotFoundException(`Tax period ${taxPeriodId} not found`);
    }
    if (taxPeriod.isLocked) {
      throw new BadRequestException(`Tax period ${taxPeriod.periodKey} is locked`);
    }

    let summaryPayload: any;
    if (returnType === 'GSTR1') {
      summaryPayload = await this.gstr1Service.aggregateGstr1(tenantId, gstinId, taxPeriodId);
    } else if (returnType === 'GSTR3B') {
      summaryPayload = await this.gstr3bService.aggregateGstr3b(tenantId, gstinId, taxPeriodId);
    } else {
      throw new BadRequestException(`Return type ${returnType} not supported`);
    }

    let gstReturn = await this.prisma.gstReturn.findFirst({
      where: { tenantId, gstinId, taxPeriodId, returnType },
    });

    if (gstReturn) {
      if (gstReturn.isLocked || gstReturn.status === 'FILED' || gstReturn.status === 'SUBMITTED') {
        throw new BadRequestException(
          `Return ${returnType} for period ${taxPeriod.periodKey} is locked/filed and cannot be edited. Create a new version/amendment.`,
        );
      }

      const newVersion = gstReturn.currentVersion + 1;
      gstReturn = await this.prisma.gstReturn.update({
        where: { id: gstReturn.id },
        data: {
          currentVersion: newVersion,
          status: 'DRAFT',
          preparedByUserId: userId,
          updatedAt: new Date(),
        },
      });

      await this.prisma.gstReturnVersion.create({
        data: {
          returnId: gstReturn.id,
          tenantId,
          versionNumber: newVersion,
          status: 'DRAFT',
          summaryPayload,
          createdById: userId,
        },
      });
    } else {
      gstReturn = await this.prisma.gstReturn.create({
        data: {
          tenantId,
          companyId,
          gstinId,
          taxPeriodId,
          periodKey: taxPeriod.periodKey,
          returnType,
          status: 'DRAFT',
          currentVersion: 1,
          preparedByUserId: userId,
        },
      });

      await this.prisma.gstReturnVersion.create({
        data: {
          returnId: gstReturn.id,
          tenantId,
          versionNumber: 1,
          status: 'DRAFT',
          summaryPayload,
          createdById: userId,
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        category: 'GST_RETURN_MUTATION',
        action: 'PREPARE_RETURN',
        entityName: 'GstReturn',
        entityId: gstReturn.id,
        diff: { returnType, periodKey: taxPeriod.periodKey, version: gstReturn.currentVersion },
      },
    });

    return { gstReturn, summaryPayload };
  }

  async validateReturn(tenantId: string, returnId: string) {
    const gstReturn = await this.prisma.gstReturn.findFirst({
      where: { id: returnId, tenantId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    if (!gstReturn) {
      throw new NotFoundException(`GST Return ${returnId} not found`);
    }

    const latestVersion = gstReturn.versions[0];
    if (!latestVersion) {
      throw new BadRequestException(`No version found for return ${returnId}`);
    }

    let valResult: any;
    if (gstReturn.returnType === 'GSTR1') {
      valResult = await this.validationService.validateGstr1(
        tenantId,
        gstReturn.gstinId,
        gstReturn.taxPeriodId,
        latestVersion.summaryPayload,
      );
    } else {
      valResult = await this.validationService.validateGstr3b(
        tenantId,
        gstReturn.gstinId,
        gstReturn.taxPeriodId,
        latestVersion.summaryPayload,
      );
    }

    const newStatus: ReturnStatus = valResult.isValid ? 'VALIDATED' : 'DRAFT';

    const updatedReturn = await this.prisma.gstReturn.update({
      where: { id: returnId },
      data: { status: newStatus },
    });

    await this.prisma.gstReturnVersion.update({
      where: { id: latestVersion.id },
      data: { status: newStatus, validationResult: valResult as any },
    });

    return { gstReturn: updatedReturn, validationResult: valResult };
  }

  async approveReturn(tenantId: string, returnId: string, userId: string) {
    const gstReturn = await this.prisma.gstReturn.findFirst({
      where: { id: returnId, tenantId },
    });
    if (!gstReturn) {
      throw new NotFoundException(`GST Return ${returnId} not found`);
    }

    if (gstReturn.status !== 'VALIDATED' && gstReturn.status !== 'REVIEW') {
      throw new BadRequestException(`Return must be in VALIDATED state before approval. Current: ${gstReturn.status}`);
    }

    // Segregation of Duties Check
    if (gstReturn.preparedByUserId && gstReturn.preparedByUserId === userId) {
      throw new BadRequestException('Segregation of duties violation: Return preparer cannot approve their own return');
    }

    const updatedReturn = await this.prisma.gstReturn.update({
      where: { id: returnId },
      data: {
        status: 'APPROVED',
        approvedByUserId: userId,
        approvedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        category: 'GST_RETURN_APPROVAL',
        action: 'APPROVE_RETURN',
        entityName: 'GstReturn',
        entityId: returnId,
        diff: { status: 'APPROVED', approvedByUserId: userId },
      },
    });

    return updatedReturn;
  }

  async fileReturn(
    tenantId: string,
    returnId: string,
    userId: string,
    idempotencyKey: string,
    simulateError: boolean = false,
  ) {
    const gstReturn = await this.prisma.gstReturn.findFirst({
      where: { id: returnId, tenantId },
      include: {
        gstRegistration: true,
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    });

    if (!gstReturn) {
      throw new NotFoundException(`GST Return ${returnId} not found`);
    }

    const latestVersion = gstReturn.versions[0];

    // Check if duplicate submission request with same idempotency key
    const existingLog = await this.prisma.filingSubmissionLog.findFirst({
      where: { tenantId, idempotencyKey },
    });
    if (existingLog) {
      const filingResult = await this.filingAdapter.fileReturnWithIdempotency(tenantId, idempotencyKey, {
        tenantId,
        returnId,
        versionNumber: latestVersion?.versionNumber || 1,
        gstin: gstReturn.gstRegistration.gstin,
        periodKey: gstReturn.periodKey,
        returnType: gstReturn.returnType,
        summaryData: latestVersion?.summaryPayload || {},
        submittedByUserId: userId,
        simulateError,
      });
      return { gstReturn, filingResult };
    }

    if (gstReturn.status !== 'APPROVED') {
      throw new BadRequestException(`Return must be APPROVED before government filing. Current: ${gstReturn.status}`);
    }

    const filingResult = await this.filingAdapter.fileReturnWithIdempotency(tenantId, idempotencyKey, {
      tenantId,
      returnId,
      versionNumber: latestVersion.versionNumber,
      gstin: gstReturn.gstRegistration.gstin,
      periodKey: gstReturn.periodKey,
      returnType: gstReturn.returnType,
      summaryData: latestVersion.summaryPayload,
      submittedByUserId: userId,
      simulateError,
    });

    if (filingResult.response.success) {
      const filedReturn = await this.prisma.gstReturn.update({
        where: { id: returnId },
        data: {
          status: 'FILED',
          isLocked: true,
          arn: filingResult.response.arn,
          ackNumber: filingResult.response.ackNumber,
          ackDate: filingResult.response.ackDate ? new Date(filingResult.response.ackDate) : new Date(),
          submittedAt: new Date(),
          filedAt: new Date(),
        },
      });

      // Lock underlying tax period
      await this.prisma.taxPeriod.update({
        where: { id: gstReturn.taxPeriodId },
        data: { isLocked: true, status: 'FILED' },
      });

      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          category: 'GST_RETURN_FILING',
          action: 'FILE_RETURN_SUCCESS',
          entityName: 'GstReturn',
          entityId: returnId,
          diff: { arn: filingResult.response.arn, isDuplicate: filingResult.isDuplicateRequest },
        },
      });

      return { gstReturn: filedReturn, filingResult };
    } else {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          category: 'GST_RETURN_FILING',
          action: 'FILE_RETURN_FAILED',
          entityName: 'GstReturn',
          entityId: returnId,
          diff: { error: filingResult.response.errorMessage },
        },
      });

      return { gstReturn, filingResult };
    }
  }

  async getReturnHistory(tenantId: string, returnId: string) {
    const gstReturn = await this.prisma.gstReturn.findFirst({
      where: { id: returnId, tenantId },
      include: {
        versions: { orderBy: { versionNumber: 'desc' } },
        filingSubmissions: { orderBy: { submittedAt: 'desc' } },
      },
    });
    if (!gstReturn) {
      throw new NotFoundException(`GST Return ${returnId} not found`);
    }
    return gstReturn;
  }
}
