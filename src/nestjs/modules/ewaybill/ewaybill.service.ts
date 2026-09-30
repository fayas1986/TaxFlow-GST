import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { SandboxGspAdapter } from '../government/sandbox-gsp.adapter';
import { GovAuditLoggerService } from '../government/gov-audit-logger.service';
import { EWayBillStatus } from '@prisma/client';

export interface GenerateEWayBillDto {
  invoiceId: string;
  transporterId?: string;
  transporterName?: string;
  transportMode?: string;
  distanceKm?: number;
  vehicleNumber?: string;
  vehicleType?: string;
  simulateError?: boolean;
}

export interface UpdateVehicleDto {
  eWayBillId: string;
  vehicleNumber: string;
  transportMode?: string;
  reason: string;
}

export interface CancelEWayBillDto {
  eWayBillId: string;
  reason: string;
  remark: string;
}

@Injectable()
export class EWayBillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gspAdapter: SandboxGspAdapter,
    private readonly auditLogger: GovAuditLoggerService,
  ) {}

  async generateEWayBill(tenantId: string, userId: string, dto: GenerateEWayBillDto) {
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: { id: dto.invoiceId, tenantId },
      include: { gstRegistration: true },
    });

    if (!invoice) {
      throw new NotFoundException(`Sales invoice ${dto.invoiceId} not found under tenant ${tenantId}`);
    }

    const existingEInvoice = await this.prisma.eInvoiceRecord.findFirst({
      where: { tenantId, invoiceId: dto.invoiceId, status: 'GENERATED' },
    });

    const gspReq = {
      tenantId,
      gstinId: invoice.gstinId,
      invoiceId: invoice.id,
      eInvoiceId: existingEInvoice?.id || undefined,
      transporterId: dto.transporterId,
      transporterName: dto.transporterName,
      transportMode: dto.transportMode || '1',
      distanceKm: dto.distanceKm || 150,
      vehicleNumber: dto.vehicleNumber || 'MH12AB1234',
      vehicleType: dto.vehicleType || 'R',
      simulateError: dto.simulateError,
    };

    const gspRes = await this.gspAdapter.generateEWayBill(gspReq);

    const correlationId = `CORR-EWB-${Date.now()}`;

    if (gspRes.success && gspRes.eWayBillNumber) {
      const ewbRecord = await this.prisma.eWayBillRecord.create({
        data: {
          tenantId,
          companyId: invoice.companyId,
          gstinId: invoice.gstinId,
          invoiceId: dto.invoiceId,
          eInvoiceId: existingEInvoice?.id || null,
          status: 'GENERATED',
          eWayBillNumber: gspRes.eWayBillNumber,
          eWayBillDate: gspRes.eWayBillDate ? new Date(gspRes.eWayBillDate) : new Date(),
          validUntil: gspRes.validUntil ? new Date(gspRes.validUntil) : new Date(),
          transporterId: dto.transporterId || null,
          transporterName: dto.transporterName || null,
          transportMode: dto.transportMode || '1',
          distanceKm: dto.distanceKm || 150,
          vehicleNumber: dto.vehicleNumber || 'MH12AB1234',
          vehicleType: dto.vehicleType || 'R',
          provider: this.gspAdapter.getProviderName(),
          environment: 'SANDBOX',
          rawResponse: gspRes.rawResponse || {},
        },
      });

      await this.auditLogger.logApiCall({
        tenantId,
        gstinId: invoice.gstinId,
        documentReference: invoice.invoiceNumber,
        provider: this.gspAdapter.getProviderName(),
        environment: 'SANDBOX',
        action: 'GENERATE_EWAYBILL',
        correlationId,
        requestPayload: gspReq,
        responsePayload: gspRes.rawResponse,
        isSuccess: true,
        governmentReference: gspRes.eWayBillNumber,
      });

      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          category: 'E_WAY_BILL_MUTATION',
          action: 'GENERATE_EWAYBILL_SUCCESS',
          entityName: 'EWayBillRecord',
          entityId: ewbRecord.id,
          diff: { eWayBillNumber: gspRes.eWayBillNumber },
        },
      });

      return ewbRecord;
    } else {
      const failedRecord = await this.prisma.eWayBillRecord.create({
        data: {
          tenantId,
          companyId: invoice.companyId,
          gstinId: invoice.gstinId,
          invoiceId: dto.invoiceId,
          status: 'FAILED',
          provider: this.gspAdapter.getProviderName(),
          environment: 'SANDBOX',
          rawResponse: gspRes.rawResponse || {},
        },
      });

      await this.auditLogger.logApiCall({
        tenantId,
        gstinId: invoice.gstinId,
        documentReference: invoice.invoiceNumber,
        provider: this.gspAdapter.getProviderName(),
        environment: 'SANDBOX',
        action: 'GENERATE_EWAYBILL',
        correlationId,
        requestPayload: gspReq,
        responsePayload: gspRes.rawResponse,
        isSuccess: false,
        errorCode: gspRes.errorCode,
        errorMessage: gspRes.errorMessage,
      });

      return failedRecord;
    }
  }

  async updateVehicleDetails(tenantId: string, userId: string, dto: UpdateVehicleDto) {
    const ewb = await this.prisma.eWayBillRecord.findFirst({
      where: { id: dto.eWayBillId, tenantId },
    });

    if (!ewb || !ewb.eWayBillNumber || ewb.status === 'CANCELLED') {
      throw new BadRequestException('Active E-Way Bill record not found for vehicle update');
    }

    const res = await this.gspAdapter.updateVehicleDetails(ewb.eWayBillNumber, dto.vehicleNumber, dto.reason);

    const updated = await this.prisma.eWayBillRecord.update({
      where: { id: ewb.id },
      data: {
        status: 'UPDATED_VEHICLE',
        vehicleNumber: dto.vehicleNumber,
        transportMode: dto.transportMode || ewb.transportMode,
        updatedAt: new Date(),
      },
    });

    await this.auditLogger.logApiCall({
      tenantId,
      gstinId: ewb.gstinId,
      documentReference: ewb.eWayBillNumber,
      provider: this.gspAdapter.getProviderName(),
      environment: 'SANDBOX',
      action: 'UPDATE_VEHICLE',
      correlationId: `CORR-VEH-${Date.now()}`,
      requestPayload: { eWayBillNo: ewb.eWayBillNumber, vehicleNo: dto.vehicleNumber, reason: dto.reason },
      responsePayload: res.rawResponse,
      isSuccess: true,
      governmentReference: ewb.eWayBillNumber,
    });

    return updated;
  }

  async cancelEWayBill(tenantId: string, userId: string, dto: CancelEWayBillDto) {
    const ewb = await this.prisma.eWayBillRecord.findFirst({
      where: { id: dto.eWayBillId, tenantId },
    });

    if (!ewb || !ewb.eWayBillNumber || ewb.status === 'CANCELLED') {
      throw new BadRequestException('Active E-Way Bill record not found for cancellation');
    }

    const cancelRes = await this.gspAdapter.cancelEWayBill(ewb.eWayBillNumber, dto.reason, dto.remark);

    const cancelled = await this.prisma.eWayBillRecord.update({
      where: { id: ewb.id },
      data: {
        status: 'CANCELLED',
        cancelReason: dto.reason,
        cancelRemark: dto.remark,
        cancelDate: cancelRes.cancelDate ? new Date(cancelRes.cancelDate) : new Date(),
      },
    });

    await this.auditLogger.logApiCall({
      tenantId,
      gstinId: ewb.gstinId,
      documentReference: ewb.eWayBillNumber,
      provider: this.gspAdapter.getProviderName(),
      environment: 'SANDBOX',
      action: 'CANCEL_EWAYBILL',
      correlationId: `CORR-EWBCANCEL-${Date.now()}`,
      requestPayload: { eWayBillNo: ewb.eWayBillNumber, reason: dto.reason, remark: dto.remark },
      responsePayload: cancelRes.rawResponse,
      isSuccess: true,
      governmentReference: ewb.eWayBillNumber,
    });

    return cancelled;
  }
}
