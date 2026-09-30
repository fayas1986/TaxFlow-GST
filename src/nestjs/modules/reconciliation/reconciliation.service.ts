import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { ReconciliationMatchStatus, InvoiceCategory } from '@prisma/client';
import { Decimal } from 'decimal.js';

export interface ExecuteReconciliationDto {
  gstinId: string;
  taxPeriodId: string;
  batchId?: string;
  dateToleranceDays?: number;
  taxToleranceAmount?: number | string;
}

@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async findRuns(tenantId: string, gstinId: string, taxPeriodId: string) {
    return this.prisma.reconciliationRun.findMany({
      where: { tenantId, gstinId, taxPeriodId },
      include: { matches: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Helper function for normalizing invoice numbers for fuzzy matching
   * Strips slashes, dashes, spaces, and leading zeros
   */
  private normalizeInvoiceNumber(invNum: string): string {
    return invNum.replace(/[\/\-\s]/g, '').replace(/^0+/, '').toUpperCase();
  }

  /**
   * Deterministic Purchase-to-GSTR-2B Matching Engine
   */
  async executeReconciliation(tenantId: string, userId: string, dto: ExecuteReconciliationDto) {
    const taxPeriod = await this.prisma.taxPeriod.findFirst({
      where: { id: dto.taxPeriodId, tenantId },
    });

    if (!taxPeriod) {
      throw new NotFoundException(`Tax period '${dto.taxPeriodId}' not found under tenant '${tenantId}'.`);
    }

    const dateTolerance = dto.dateToleranceDays || 7;
    const taxTolerance = new Decimal((dto.taxToleranceAmount || 10.0).toString());

    // 1. Fetch Purchase Invoices for Tenant, GSTIN & Tax Period
    const purchaseInvoices = await this.prisma.salesInvoice.findMany({
      where: {
        tenantId,
        gstinId: dto.gstinId,
        taxPeriodId: dto.taxPeriodId,
        category: InvoiceCategory.PURCHASE,
      },
      include: { party: true },
    });

    // 2. Fetch GSTR-2B Records for Tenant, GSTIN & Tax Period
    const gstr2bRecords = await this.prisma.gstr2bRecord.findMany({
      where: {
        tenantId,
        gstinId: dto.gstinId,
        taxPeriodId: dto.taxPeriodId,
      },
    });

    return this.prisma.$transaction(async (tx) => {
      // 3. Create Reconciliation Run Header
      const run = await tx.reconciliationRun.create({
        data: {
          tenantId,
          gstinId: dto.gstinId,
          taxPeriodId: dto.taxPeriodId,
          batchId: dto.batchId || null,
          runStatus: 'COMPLETED',
          matchingRuleVersion: '1.0.0',
          dateToleranceDays: dateTolerance,
          taxToleranceAmount: taxTolerance.toFixed(4),
          totalProcessed: purchaseInvoices.length + gstr2bRecords.length,
        },
      });

      const matched2bIds = new Set<string>();
      let exactCount = 0;
      let partialCount = 0;
      let mismatchCount = 0;
      let missingInPortalCount = 0;

      for (const purc of purchaseInvoices) {
        const normPurcNum = this.normalizeInvoiceNumber(purc.invoiceNumber);
        const purcTax = new Decimal(purc.totalCgstAmount.toString())
          .plus(new Decimal(purc.totalSgstAmount.toString()))
          .plus(new Decimal(purc.totalIgstAmount.toString()));

        // Find candidate match in GSTR-2B records
        const match2b = gstr2bRecords.find(
          (g) =>
            this.normalizeInvoiceNumber(g.invoiceNumber) === normPurcNum ||
            g.invoiceNumber === purc.invoiceNumber,
        );

        if (!match2b) {
          missingInPortalCount++;
          await tx.reconciliationMatch.create({
            data: {
              tenantId,
              runId: run.id,
              purchaseInvoiceId: purc.id,
              gstr2bRecordId: null,
              matchStatus: ReconciliationMatchStatus.MISSING_IN_GSTR2B,
              matchScore: '0.00',
              varianceAmount: purcTax.toFixed(4),
              matchExplanation: `Purchase invoice '${purc.invoiceNumber}' was not found in GSTR-2B portal upload for period ${taxPeriod.periodKey}.`,
            },
          });
        } else {
          matched2bIds.add(match2b.id);
          const gstr2bTax = new Decimal(match2b.totalTaxAmount.toString());
          const taxVariance = purcTax.minus(gstr2bTax).abs();

          let status: ReconciliationMatchStatus;
          let explanation: string;
          let score = '100.00';

          if (taxVariance.lte(taxTolerance)) {
            status = ReconciliationMatchStatus.EXACT_MATCH;
            explanation = `Exact match: Invoice number '${purc.invoiceNumber}' matched supplier GSTR-2B. Tax variance ₹${taxVariance.toFixed(4)} within tolerance ₹${taxTolerance.toFixed(4)}.`;
            exactCount++;
          } else {
            status = ReconciliationMatchStatus.AMOUNT_MISMATCH;
            score = '70.00';
            explanation = `Amount mismatch: Invoice '${purc.invoiceNumber}' tax variance ₹${taxVariance.toFixed(4)} exceeds tolerance ₹${taxTolerance.toFixed(4)}. Books Tax: ₹${purcTax.toFixed(4)}, Portal Tax: ₹${gstr2bTax.toFixed(4)}.`;
            mismatchCount++;
          }

          await tx.reconciliationMatch.create({
            data: {
              tenantId,
              runId: run.id,
              purchaseInvoiceId: purc.id,
              gstr2bRecordId: match2b.id,
              matchStatus: status,
              matchScore: score,
              varianceAmount: taxVariance.toFixed(4),
              matchExplanation: explanation,
            },
          });
        }
      }

      // Identify GSTR-2B records missing in books
      let missingInBooksCount = 0;
      for (const g2b of gstr2bRecords) {
        if (!matched2bIds.has(g2b.id)) {
          missingInBooksCount++;
          await tx.reconciliationMatch.create({
            data: {
              tenantId,
              runId: run.id,
              purchaseInvoiceId: null,
              gstr2bRecordId: g2b.id,
              matchStatus: ReconciliationMatchStatus.MISSING_IN_BOOKS,
              matchScore: '0.00',
              varianceAmount: g2b.totalTaxAmount.toString(),
              matchExplanation: `Portal invoice '${g2b.invoiceNumber}' from supplier '${g2b.supplierGstin}' was not found in internal purchase register.`,
            },
          });
        }
      }

      // Update Run Statistics
      const updatedRun = await tx.reconciliationRun.update({
        where: { id: run.id },
        data: {
          exactMatchCount: exactCount,
          partialMatchCount: partialCount,
          mismatchCount,
          missingInPortalCount,
          missingInBooksCount,
        },
        include: { matches: true },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          category: 'RECONCILIATION_RUN',
          action: 'RECONCILIATION_EXECUTED',
          entityName: 'ReconciliationRun',
          entityId: run.id,
          diff: { exactMatchCount: exactCount, mismatchCount, missingInPortalCount, missingInBooksCount } as any,
        },
      });

      return updatedRun;
    });
  }
}
