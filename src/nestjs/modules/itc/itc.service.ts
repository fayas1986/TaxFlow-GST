import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { TaxLedgerService } from '../tax-ledger/tax-ledger.service';
import { ItcStatus, LedgerEntryType } from '@prisma/client';
import { Decimal } from 'decimal.js';

export interface EvaluateItcDto {
  companyId: string;
  gstinId: string;
  branchId?: string;
  purchaseInvoiceId?: string;
  gstr2bRecordId?: string;
  taxPeriodId: string;
  itemDescription: string;
  hsnSacCode: string;
  taxableValue: number | string;
  cgstAmount: number | string;
  sgstAmount: number | string;
  igstAmount: number | string;
  cessAmount?: number | string;
}

@Injectable()
export class ItcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxLedgerService: TaxLedgerService,
  ) {}

  async findRecords(tenantId: string, gstinId: string, taxPeriodId: string) {
    return this.prisma.itcRecord.findMany({
      where: { tenantId, gstinId, taxPeriodId },
      include: {
        purchaseInvoice: true,
        gstr2bRecord: true,
      },
    });
  }

  /**
   * Evaluates Section 17(5) statutory blocked credit rules
   */
  async evaluateAndCreate(tenantId: string, userId: string, dto: EvaluateItcDto) {
    const taxableVal = new Decimal(dto.taxableValue.toString());
    const cgst = new Decimal(dto.cgstAmount.toString());
    const sgst = new Decimal(dto.sgstAmount.toString());
    const igst = new Decimal(dto.igstAmount.toString());
    const cess = new Decimal((dto.cessAmount || 0).toString());
    const totalTax = cgst.plus(sgst).plus(igst).plus(cess);

    // Section 17(5) Rule-based Evaluation
    let isBlocked = false;
    let blockedReason: string | null = null;
    let statutoryClause: string | null = null;

    const desc = dto.itemDescription.toLowerCase();
    const hsn = dto.hsnSacCode;

    if (hsn.startsWith('8702') || hsn.startsWith('8703') || desc.includes('motor vehicle') || desc.includes('car')) {
      isBlocked = true;
      blockedReason = 'Motor Vehicles for Personal/Passenger Transport';
      statutoryClause = 'CGST Act Section 17(5)(a)';
    } else if (hsn.startsWith('9963') || desc.includes('food') || desc.includes('catering') || desc.includes('beverage')) {
      isBlocked = true;
      blockedReason = 'Food, Beverages and Outdoor Catering Services';
      statutoryClause = 'CGST Act Section 17(5)(b)(i)';
    } else if (desc.includes('club') || desc.includes('gym') || desc.includes('membership')) {
      isBlocked = true;
      blockedReason = 'Membership of Club, Health and Fitness Centre';
      statutoryClause = 'CGST Act Section 17(5)(b)(ii)';
    } else if (desc.includes('personal') || desc.includes('gift')) {
      isBlocked = true;
      blockedReason = 'Goods or Services Used for Personal Consumption';
      statutoryClause = 'CGST Act Section 17(5)(g)';
    }

    const status = isBlocked ? ItcStatus.INELIGIBLE : ItcStatus.ELIGIBLE;
    const eligibleTaxable = isBlocked ? new Decimal(0) : taxableVal;
    const eligibleCgst = isBlocked ? new Decimal(0) : cgst;
    const eligibleSgst = isBlocked ? new Decimal(0) : sgst;
    const eligibleIgst = isBlocked ? new Decimal(0) : igst;
    const eligibleCess = isBlocked ? new Decimal(0) : cess;
    const eligibleTotal = isBlocked ? new Decimal(0) : totalTax;
    const blockedAmt = isBlocked ? totalTax : new Decimal(0);

    const record = await this.prisma.itcRecord.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        gstinId: dto.gstinId,
        branchId: dto.branchId || null,
        purchaseInvoiceId: dto.purchaseInvoiceId || null,
        gstr2bRecordId: dto.gstr2bRecordId || null,
        taxPeriodId: dto.taxPeriodId,
        status,
        section17BlockedReason: blockedReason,
        statutoryClause,
        eligibleTaxable: eligibleTaxable.toFixed(4),
        eligibleCgst: eligibleCgst.toFixed(4),
        eligibleSgst: eligibleSgst.toFixed(4),
        eligibleIgst: eligibleIgst.toFixed(4),
        eligibleCess: eligibleCess.toFixed(4),
        eligibleTotalTax: eligibleTotal.toFixed(4),
        blockedTaxAmount: blockedAmt.toFixed(4),
        claimedTaxAmount: '0.0000',
        reversedTaxAmount: '0.0000',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        category: 'ITC_MUTATION',
        action: 'ITC_EVALUATED',
        entityName: 'ItcRecord',
        entityId: record.id,
        diff: { status, isBlocked, blockedReason } as any,
      },
    });

    return record;
  }

  /**
   * Claim Eligible ITC & Post to Append-Only Financial Tax Ledger
   */
  async claimItc(tenantId: string, userId: string, itcRecordId: string) {
    const record = await this.prisma.itcRecord.findFirst({
      where: { id: itcRecordId, tenantId },
    });

    if (!record) {
      throw new NotFoundException(`ITC record '${itcRecordId}' not found.`);
    }

    if (record.status === ItcStatus.INELIGIBLE) {
      throw new BadRequestException(`Cannot claim INELIGIBLE ITC (Section 17(5) Blocked).`);
    }

    if (record.status === ItcStatus.CLAIMED) {
      throw new BadRequestException(`ITC record '${itcRecordId}' is already CLAIMED.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.itcRecord.update({
        where: { id: itcRecordId },
        data: {
          status: ItcStatus.CLAIMED,
          claimedTaxAmount: record.eligibleTotalTax,
        },
      });

      // Post to Tax Ledger
      await this.taxLedgerService.postEntry(tenantId, userId, {
        companyId: record.companyId,
        gstinId: record.gstinId,
        branchId: record.branchId || undefined,
        invoiceId: record.purchaseInvoiceId || undefined,
        taxPeriodId: record.taxPeriodId,
        entryType: LedgerEntryType.INPUT_TAX_CREDIT,
        taxableValue: record.eligibleTaxable.toString(),
        cgstAmount: record.eligibleCgst.toString(),
        sgstAmount: record.eligibleSgst.toString(),
        igstAmount: record.eligibleIgst.toString(),
        cessAmount: record.eligibleCess.toString(),
        referenceNumber: `ITC-CLAIM-${record.id.substring(0, 8)}`,
        description: `Input Tax Credit Claimed for Tax Period ${record.taxPeriodId}`,
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          category: 'ITC_MUTATION',
          action: 'ITC_CLAIMED',
          entityName: 'ItcRecord',
          entityId: itcRecordId,
          diff: { claimedAmount: record.eligibleTotalTax.toString() } as any,
        },
      });

      return updated;
    });
  }

  /**
   * Reverse Claimed ITC & Post Reversal Ledger Entry
   */
  async reverseItc(tenantId: string, userId: string, itcRecordId: string, reason: string) {
    const record = await this.prisma.itcRecord.findFirst({
      where: { id: itcRecordId, tenantId },
    });

    if (!record) {
      throw new NotFoundException(`ITC record '${itcRecordId}' not found.`);
    }

    if (record.status !== ItcStatus.CLAIMED) {
      throw new BadRequestException(`Only CLAIMED ITC records can be REVERSED.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.itcRecord.update({
        where: { id: itcRecordId },
        data: {
          status: ItcStatus.REVERSED,
          reversedTaxAmount: record.claimedTaxAmount,
        },
      });

      // Post ITC Reversal Entry to Tax Ledger
      await this.taxLedgerService.postEntry(tenantId, userId, {
        companyId: record.companyId,
        gstinId: record.gstinId,
        branchId: record.branchId || undefined,
        invoiceId: record.purchaseInvoiceId || undefined,
        taxPeriodId: record.taxPeriodId,
        entryType: LedgerEntryType.ITC_REVERSAL,
        taxableValue: record.eligibleTaxable.toString(),
        cgstAmount: record.eligibleCgst.toString(),
        sgstAmount: record.eligibleSgst.toString(),
        igstAmount: record.eligibleIgst.toString(),
        cessAmount: record.eligibleCess.toString(),
        referenceNumber: `REV-ITC-${record.id.substring(0, 8)}`,
        description: `ITC Reversal: ${reason}`,
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          category: 'ITC_MUTATION',
          action: 'ITC_REVERSED',
          entityName: 'ItcRecord',
          entityId: itcRecordId,
          diff: { reversedAmount: record.claimedTaxAmount.toString(), reason } as any,
        },
      });

      return updated;
    });
  }
}
