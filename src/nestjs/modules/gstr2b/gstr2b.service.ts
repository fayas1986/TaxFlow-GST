import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { Gstr2bItcAvailability } from '@prisma/client';
import { Decimal } from 'decimal.js';

export interface ImportGstr2bRecordDto {
  supplierGstin: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceType?: string;
  taxableValue: number | string;
  cgstAmount: number | string;
  sgstAmount: number | string;
  igstAmount: number | string;
  cessAmount?: number | string;
  itcAvailability?: Gstr2bItcAvailability;
  rawPayload?: any;
}

export interface ImportGstr2bBatchDto {
  companyId: string;
  gstinId: string;
  taxPeriodId: string;
  periodKey: string; // MMYYYY
  sourceFilename: string;
  records: ImportGstr2bRecordDto[];
}

@Injectable()
export class Gstr2bService {
  constructor(private readonly prisma: PrismaService) {}

  async findRecords(tenantId: string, gstinId: string, periodKey: string) {
    return this.prisma.gstr2bRecord.findMany({
      where: { tenantId, gstinId, periodKey },
      include: { batch: true },
      orderBy: { invoiceDate: 'desc' },
    });
  }

  /**
   * Idempotent GSTR-2B JSON Batch Ingestion
   */
  async importBatch(tenantId: string, userId: string, dto: ImportGstr2bBatchDto) {
    // Verify GSTIN ownership
    const gstin = await this.prisma.gSTRegistration.findFirst({
      where: { id: dto.gstinId, companyId: dto.companyId, tenantId },
    });

    if (!gstin) {
      throw new BadRequestException(
        `GSTIN '${dto.gstinId}' does not belong to Company '${dto.companyId}' under Tenant '${tenantId}'.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create or retrieve Batch Log
      const batch = await tx.gstr2bImportBatch.create({
        data: {
          tenantId,
          gstinId: dto.gstinId,
          taxPeriodId: dto.taxPeriodId,
          periodKey: dto.periodKey,
          sourceFilename: dto.sourceFilename,
          recordCount: dto.records.length,
          importStatus: 'COMPLETED',
        },
      });

      let importedCount = 0;
      let skippedCount = 0;

      for (const rec of dto.records) {
        const taxableVal = new Decimal(rec.taxableValue.toString());
        const cgst = new Decimal(rec.cgstAmount.toString());
        const sgst = new Decimal(rec.sgstAmount.toString());
        const igst = new Decimal(rec.igstAmount.toString());
        const cess = new Decimal((rec.cessAmount || 0).toString());
        const totalTax = cgst.plus(sgst).plus(igst).plus(cess);
        const totalVal = taxableVal.plus(totalTax);

        try {
          await tx.gstr2bRecord.upsert({
            where: {
              tenantId_gstinId_periodKey_supplierGstin_invoiceNumber: {
                tenantId,
                gstinId: dto.gstinId,
                periodKey: dto.periodKey,
                supplierGstin: rec.supplierGstin,
                invoiceNumber: rec.invoiceNumber,
              },
            },
            create: {
              tenantId,
              gstinId: dto.gstinId,
              batchId: batch.id,
              taxPeriodId: dto.taxPeriodId,
              periodKey: dto.periodKey,
              supplierGstin: rec.supplierGstin,
              supplierName: rec.supplierName,
              invoiceNumber: rec.invoiceNumber,
              invoiceDate: new Date(rec.invoiceDate),
              invoiceType: rec.invoiceType || 'B2B',
              taxableValue: taxableVal.toFixed(4),
              cgstAmount: cgst.toFixed(4),
              sgstAmount: sgst.toFixed(4),
              igstAmount: igst.toFixed(4),
              cessAmount: cess.toFixed(4),
              totalTaxAmount: totalTax.toFixed(4),
              totalInvoiceAmount: totalVal.toFixed(4),
              itcAvailability: rec.itcAvailability || Gstr2bItcAvailability.ELIGIBLE,
              rawPayload: rec.rawPayload || null,
            },
            update: {
              taxableValue: taxableVal.toFixed(4),
              cgstAmount: cgst.toFixed(4),
              sgstAmount: sgst.toFixed(4),
              igstAmount: igst.toFixed(4),
              cessAmount: cess.toFixed(4),
              totalTaxAmount: totalTax.toFixed(4),
              totalInvoiceAmount: totalVal.toFixed(4),
              itcAvailability: rec.itcAvailability || Gstr2bItcAvailability.ELIGIBLE,
              rawPayload: rec.rawPayload || null,
            },
          });
          importedCount++;
        } catch {
          skippedCount++;
        }
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          category: 'GSTR2B_IMPORT',
          action: 'GSTR2B_BATCH_IMPORTED',
          entityName: 'Gstr2bImportBatch',
          entityId: batch.id,
          diff: { periodKey: dto.periodKey, importedCount, skippedCount } as any,
        },
      });

      return {
        batchId: batch.id,
        periodKey: dto.periodKey,
        totalRecords: dto.records.length,
        importedCount,
        skippedCount,
      };
    });
  }
}
