import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { SandboxGspAdapter } from '../government/sandbox-gsp.adapter';
import { GovAuditLoggerService } from '../government/gov-audit-logger.service';
import { EInvoiceStatus, GspEnvironment } from '@prisma/client';
import Decimal from 'decimal.js';

export interface GenerateEInvoiceDto {
  invoiceId: string;
  simulateError?: boolean;
  simulateTimeout?: boolean;
}

export interface CancelEInvoiceDto {
  invoiceId: string;
  reason: string;
  remark: string;
}

@Injectable()
export class EInvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gspAdapter: SandboxGspAdapter,
    private readonly auditLogger: GovAuditLoggerService,
  ) {}

  async generateEInvoice(tenantId: string, userId: string, dto: GenerateEInvoiceDto) {
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: { id: dto.invoiceId, tenantId },
      include: {
        company: true,
        gstRegistration: true,
        party: true,
        lineItems: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Sales invoice ${dto.invoiceId} not found under tenant ${tenantId}`);
    }

    if (invoice.category !== 'SALES') {
      throw new BadRequestException('E-Invoice generation is only applicable to Sales Invoices');
    }

    if (invoice.isStatutoryLocked && invoice.isEInvoiceGenerated) {
      // Check existing EInvoiceRecord for idempotency
      const existing = await this.prisma.eInvoiceRecord.findFirst({
        where: { tenantId, invoiceId: dto.invoiceId },
      });
      if (existing && existing.status === 'GENERATED') {
        return { eInvoiceRecord: existing, invoice, isDuplicate: true };
      }
      throw new BadRequestException('Invoice is locked and IRN is already generated');
    }

    // 1. Compliance Validation Layer
    if (!invoice.gstRegistration.gstin || invoice.gstRegistration.gstin.length !== 15) {
      throw new BadRequestException('Invalid Seller GSTIN for E-Invoice compliance validation');
    }

    const totalTax = new Decimal(invoice.totalCgstAmount.toString())
      .plus(new Decimal(invoice.totalSgstAmount.toString()))
      .plus(new Decimal(invoice.totalIgstAmount.toString()))
      .plus(new Decimal(invoice.totalCessAmount.toString()));

    if (totalTax.lessThan(0)) {
      throw new BadRequestException('Total tax amount cannot be negative');
    }

    // Create or retrieve pending EInvoiceRecord
    let eInvRecord = await this.prisma.eInvoiceRecord.findFirst({
      where: { tenantId, invoiceId: dto.invoiceId },
    });

    if (!eInvRecord) {
      eInvRecord = await this.prisma.eInvoiceRecord.create({
        data: {
          tenantId,
          companyId: invoice.companyId,
          gstinId: invoice.gstinId,
          invoiceId: dto.invoiceId,
          status: 'VALIDATING',
          provider: this.gspAdapter.getProviderName(),
          environment: 'SANDBOX',
        },
      });
    } else {
      eInvRecord = await this.prisma.eInvoiceRecord.update({
        where: { id: eInvRecord.id },
        data: { status: 'VALIDATING', updatedAt: new Date() },
      });
    }

    // Update status to SUBMITTING
    await this.prisma.eInvoiceRecord.update({
      where: { id: eInvRecord.id },
      data: { status: 'SUBMITTING' },
    });

    const correlationId = `CORR-EINV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const gspReqPayload = {
      tenantId,
      gstinId: invoice.gstinId,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate.toISOString().split('T')[0],
      sellerGstin: invoice.gstRegistration.gstin,
      buyerGstin: invoice.party?.pan ? `${invoice.party.pan}1Z5` : '27AAACB9999K1Z2',
      taxableValue: new Decimal(invoice.totalTaxableAmount.toString()).toNumber(),
      cgstAmount: new Decimal(invoice.totalCgstAmount.toString()).toNumber(),
      sgstAmount: new Decimal(invoice.totalSgstAmount.toString()).toNumber(),
      igstAmount: new Decimal(invoice.totalIgstAmount.toString()).toNumber(),
      totalInvoiceValue: new Decimal(invoice.totalInvoiceAmount.toString()).toNumber(),
      items: invoice.lineItems.map((item) => {
        const cgst = item.cgstRate ? item.cgstRate.toString() : '0';
        const sgst = item.sgstRate ? item.sgstRate.toString() : '0';
        const igst = item.igstRate ? item.igstRate.toString() : '0';
        return {
          hsnCode: item.hsnSacCode,
          description: item.description,
          taxableValue: new Decimal(item.taxableValue.toString()).toNumber(),
          gstRate: new Decimal(cgst).plus(sgst).plus(igst).toNumber(),
        };
      }),
      simulateError: dto.simulateError,
      simulateTimeout: dto.simulateTimeout,
    };

    let response: any;
    try {
      response = await this.gspAdapter.generateIRN(gspReqPayload);
    } catch (err: any) {
      await this.prisma.eInvoiceRecord.update({
        where: { id: eInvRecord.id },
        data: {
          status: 'FAILED',
          errorCode: 'TIMEOUT',
          errorMessage: err.message || 'GSP portal timeout',
        },
      });

      await this.auditLogger.logApiCall({
        tenantId,
        gstinId: invoice.gstinId,
        documentReference: invoice.invoiceNumber,
        provider: this.gspAdapter.getProviderName(),
        environment: 'SANDBOX',
        action: 'GENERATE_IRN',
        correlationId,
        requestPayload: gspReqPayload,
        responsePayload: { error: err.message },
        isSuccess: false,
        errorCode: 'TIMEOUT',
        errorMessage: err.message,
      });

      throw new BadRequestException(`GSP Integration Failure: ${err.message}`);
    }

    if (response.success && response.irn) {
      const updatedRecord = await this.prisma.eInvoiceRecord.update({
        where: { id: eInvRecord.id },
        data: {
          status: 'GENERATED',
          irn: response.irn,
          ackNumber: response.ackNumber,
          ackDate: response.ackDate ? new Date(response.ackDate) : new Date(),
          signedInvoice: response.signedInvoice,
          signedQrCode: response.signedQrCode,
          rawResponse: response.rawResponse || {},
        },
      });

      // Lock invoice statutory fields
      await this.prisma.salesInvoice.update({
        where: { id: dto.invoiceId },
        data: {
          isEInvoiceGenerated: true,
          irn: response.irn,
          isStatutoryLocked: true,
        },
      });

      await this.auditLogger.logApiCall({
        tenantId,
        gstinId: invoice.gstinId,
        documentReference: invoice.invoiceNumber,
        provider: this.gspAdapter.getProviderName(),
        environment: 'SANDBOX',
        action: 'GENERATE_IRN',
        correlationId,
        requestPayload: gspReqPayload,
        responsePayload: response.rawResponse,
        isSuccess: true,
        governmentReference: response.irn,
      });

      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          category: 'E_INVOICE_MUTATION',
          action: 'GENERATE_IRN_SUCCESS',
          entityName: 'SalesInvoice',
          entityId: dto.invoiceId,
          diff: { irn: response.irn, ackNumber: response.ackNumber },
        },
      });

      return { eInvoiceRecord: updatedRecord, invoice, isDuplicate: false };
    } else {
      const failedRecord = await this.prisma.eInvoiceRecord.update({
        where: { id: eInvRecord.id },
        data: {
          status: 'FAILED',
          errorCode: response.errorCode || 'UNKNOWN_ERROR',
          errorMessage: response.errorMessage || 'IRN generation failed',
          rawResponse: response.rawResponse || {},
        },
      });

      await this.auditLogger.logApiCall({
        tenantId,
        gstinId: invoice.gstinId,
        documentReference: invoice.invoiceNumber,
        provider: this.gspAdapter.getProviderName(),
        environment: 'SANDBOX',
        action: 'GENERATE_IRN',
        correlationId,
        requestPayload: gspReqPayload,
        responsePayload: response.rawResponse,
        isSuccess: false,
        errorCode: response.errorCode,
        errorMessage: response.errorMessage,
      });

      return { eInvoiceRecord: failedRecord, invoice, isDuplicate: false };
    }
  }

  async cancelEInvoice(tenantId: string, userId: string, dto: CancelEInvoiceDto) {
    const eInvRecord = await this.prisma.eInvoiceRecord.findFirst({
      where: { tenantId, invoiceId: dto.invoiceId },
    });

    if (!eInvRecord || eInvRecord.status !== 'GENERATED' || !eInvRecord.irn) {
      throw new BadRequestException('No active generated IRN found for cancellation');
    }

    const cancelRes = await this.gspAdapter.cancelIRN(eInvRecord.irn, dto.reason, dto.remark);

    const cancelledRecord = await this.prisma.eInvoiceRecord.update({
      where: { id: eInvRecord.id },
      data: {
        status: 'CANCELLED',
        cancelReason: dto.reason,
        cancelRemark: dto.remark,
        cancelDate: cancelRes.cancelDate ? new Date(cancelRes.cancelDate) : new Date(),
      },
    });

    // Release statutory lock on invoice
    await this.prisma.salesInvoice.update({
      where: { id: dto.invoiceId },
      data: { isStatutoryLocked: false },
    });

    await this.auditLogger.logApiCall({
      tenantId,
      gstinId: eInvRecord.gstinId,
      documentReference: eInvRecord.irn,
      provider: this.gspAdapter.getProviderName(),
      environment: 'SANDBOX',
      action: 'CANCEL_IRN',
      correlationId: `CORR-CANCEL-${Date.now()}`,
      requestPayload: { irn: eInvRecord.irn, reason: dto.reason, remark: dto.remark },
      responsePayload: cancelRes.rawResponse,
      isSuccess: true,
      governmentReference: eInvRecord.irn,
    });

    return cancelledRecord;
  }
}
