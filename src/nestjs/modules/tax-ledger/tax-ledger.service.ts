import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { LedgerEntryType } from '@prisma/client';
import { Decimal } from 'decimal.js';

export interface PostLedgerEntryDto {
  companyId: string;
  gstinId: string;
  branchId?: string;
  invoiceId?: string;
  taxPeriodId: string;
  entryType: LedgerEntryType;
  taxableValue: string | number;
  cgstAmount: string | number;
  sgstAmount: string | number;
  igstAmount: string | number;
  cessAmount: string | number;
  referenceNumber: string;
  description: string;
}

@Injectable()
export class TaxLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async findEntries(tenantId: string, gstinId?: string, taxPeriodId?: string) {
    const whereClause: any = { tenantId };
    if (gstinId) whereClause.gstinId = gstinId;
    if (taxPeriodId) whereClause.taxPeriodId = taxPeriodId;

    return this.prisma.taxLedgerEntry.findMany({
      where: whereClause,
      include: {
        company: true,
        gstRegistration: true,
        taxPeriod: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async postEntry(tenantId: string, userId: string, dto: PostLedgerEntryDto) {
    const taxableVal = new Decimal(dto.taxableValue.toString());
    const cgst = new Decimal(dto.cgstAmount.toString());
    const sgst = new Decimal(dto.sgstAmount.toString());
    const igst = new Decimal(dto.igstAmount.toString());
    const cess = new Decimal(dto.cessAmount.toString());
    const totalTax = cgst.plus(sgst).plus(igst).plus(cess);

    const entry = await this.prisma.taxLedgerEntry.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        gstinId: dto.gstinId,
        branchId: dto.branchId || null,
        invoiceId: dto.invoiceId || null,
        taxPeriodId: dto.taxPeriodId,
        entryType: dto.entryType,
        taxableValue: taxableVal.toFixed(4),
        cgstAmount: cgst.toFixed(4),
        sgstAmount: sgst.toFixed(4),
        igstAmount: igst.toFixed(4),
        cessAmount: cess.toFixed(4),
        totalTaxAmount: totalTax.toFixed(4),
        referenceNumber: dto.referenceNumber,
        description: dto.description,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        category: 'LEDGER_POSTING',
        action: 'TAX_LEDGER_POSTED',
        entityName: 'TaxLedgerEntry',
        entityId: entry.id,
        diff: { referenceNumber: dto.referenceNumber, entryType: dto.entryType, totalTax: totalTax.toFixed(4) } as any,
      },
    });

    return entry;
  }

  async getLedgerSummary(tenantId: string, gstinId: string, taxPeriodId: string) {
    const entries = await this.prisma.taxLedgerEntry.findMany({
      where: { tenantId, gstinId, taxPeriodId },
    });

    let totalOutputLiability = new Decimal(0);
    let totalInputCredit = new Decimal(0);
    let totalReversals = new Decimal(0);

    for (const entry of entries) {
      const taxAmt = new Decimal(entry.totalTaxAmount.toString());
      if (entry.entryType === LedgerEntryType.OUTPUT_LIABILITY) {
        totalOutputLiability = totalOutputLiability.plus(taxAmt);
      } else if (entry.entryType === LedgerEntryType.INPUT_TAX_CREDIT) {
        totalInputCredit = totalInputCredit.plus(taxAmt);
      } else if (
        entry.entryType === LedgerEntryType.LIABILITY_REVERSAL ||
        entry.entryType === LedgerEntryType.ITC_REVERSAL
      ) {
        totalReversals = totalReversals.plus(taxAmt);
      }
    }

    const netTaxPayable = Decimal.max(0, totalOutputLiability.minus(totalInputCredit).minus(totalReversals));

    return {
      gstinId,
      taxPeriodId,
      totalOutputLiability: totalOutputLiability.toFixed(4),
      totalInputCredit: totalInputCredit.toFixed(4),
      totalReversals: totalReversals.toFixed(4),
      netTaxPayable: netTaxPayable.toFixed(4),
      entryCount: entries.length,
    };
  }
}
