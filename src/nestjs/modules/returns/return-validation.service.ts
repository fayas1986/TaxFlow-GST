import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import Decimal from 'decimal.js';

export interface ValidationIssue {
  type: 'DATA_VALIDATION' | 'STATUTORY_RECONCILIATION';
  code: string;
  field?: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export interface ReturnValidationResult {
  isValid: boolean;
  dataValidationPassed: boolean;
  reconciliationPassed: boolean;
  issues: ValidationIssue[];
  reconciliationCheck: {
    invoiceVsGstr1Variance: number;
    ledgerVsGstr3bVariance: number;
    itcVsGstr3bVariance: number;
  };
}

@Injectable()
export class ReturnValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async validateGstr1(
    tenantId: string,
    gstinId: string,
    taxPeriodId: string,
    aggregatedGstr1: any,
  ): Promise<ReturnValidationResult> {
    const issues: ValidationIssue[] = [];

    // 1. Data Validation
    const gstinRecord = await this.prisma.gSTRegistration.findFirst({
      where: { id: gstinId, tenantId },
    });
    if (!gstinRecord) {
      issues.push({
        type: 'DATA_VALIDATION',
        code: 'INVALID_GSTIN',
        message: `GSTIN registration ${gstinId} not found`,
        severity: 'ERROR',
      });
    } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstinRecord.gstin)) {
      issues.push({
        type: 'DATA_VALIDATION',
        code: 'MALFORMED_GSTIN',
        message: `GSTIN format ${gstinRecord.gstin} is invalid`,
        severity: 'ERROR',
      });
    }

    const taxPeriod = await this.prisma.taxPeriod.findFirst({
      where: { id: taxPeriodId, tenantId },
    });
    if (!taxPeriod) {
      issues.push({
        type: 'DATA_VALIDATION',
        code: 'INVALID_TAX_PERIOD',
        message: `Tax period ${taxPeriodId} not found`,
        severity: 'ERROR',
      });
    } else if (taxPeriod.isLocked) {
      issues.push({
        type: 'DATA_VALIDATION',
        code: 'TAX_PERIOD_LOCKED',
        message: `Tax period ${taxPeriod.periodKey} is locked for modification`,
        severity: 'ERROR',
      });
    }

    // 2. Reconciliation Check (Sales Invoices vs GSTR-1 Aggregation)
    const salesInvoices = await this.prisma.salesInvoice.findMany({
      where: { tenantId, gstinId, taxPeriodId, category: 'SALES', status: { in: ['POSTED', 'VALIDATED'] } },
    });

    let rawInvoiceTotalTax = new Decimal(0);
    for (const inv of salesInvoices) {
      const taxSum = new Decimal(inv.totalCgstAmount.toString())
        .plus(inv.totalSgstAmount.toString())
        .plus(inv.totalIgstAmount.toString())
        .plus(inv.totalCessAmount.toString());
      rawInvoiceTotalTax = rawInvoiceTotalTax.plus(taxSum);
    }

    const aggregatedTotals = aggregatedGstr1?.totals || { cgstAmount: 0, sgstAmount: 0, igstAmount: 0, cessAmount: 0 };
    const aggregatedTotalTax = new Decimal(aggregatedTotals.cgstAmount || 0)
      .plus(aggregatedTotals.sgstAmount || 0)
      .plus(aggregatedTotals.igstAmount || 0)
      .plus(aggregatedTotals.cessAmount || 0);

    const invoiceVsGstr1Variance = rawInvoiceTotalTax.minus(aggregatedTotalTax).abs().toNumber();

    if (invoiceVsGstr1Variance > 0.01) {
      issues.push({
        type: 'STATUTORY_RECONCILIATION',
        code: 'GSTR1_INVOICE_VARIANCE',
        message: `Unexplained variance of ${invoiceVsGstr1Variance} detected between source Sales Invoices and GSTR-1 aggregated totals`,
        severity: 'ERROR',
      });
    }

    const hasErrors = issues.some((i) => i.severity === 'ERROR');

    return {
      isValid: !hasErrors,
      dataValidationPassed: !issues.some((i) => i.type === 'DATA_VALIDATION' && i.severity === 'ERROR'),
      reconciliationPassed: invoiceVsGstr1Variance <= 0.01,
      issues,
      reconciliationCheck: {
        invoiceVsGstr1Variance,
        ledgerVsGstr3bVariance: 0,
        itcVsGstr3bVariance: 0,
      },
    };
  }

  async validateGstr3b(
    tenantId: string,
    gstinId: string,
    taxPeriodId: string,
    aggregatedGstr3b: any,
  ): Promise<ReturnValidationResult> {
    const issues: ValidationIssue[] = [];

    // 1. Data Validation
    const gstinRecord = await this.prisma.gSTRegistration.findFirst({
      where: { id: gstinId, tenantId },
    });
    if (!gstinRecord) {
      issues.push({
        type: 'DATA_VALIDATION',
        code: 'INVALID_GSTIN',
        message: `GSTIN registration ${gstinId} not found`,
        severity: 'ERROR',
      });
    }

    const taxPeriod = await this.prisma.taxPeriod.findFirst({
      where: { id: taxPeriodId, tenantId },
    });
    if (!taxPeriod) {
      issues.push({
        type: 'DATA_VALIDATION',
        code: 'INVALID_TAX_PERIOD',
        message: `Tax period ${taxPeriodId} not found`,
        severity: 'ERROR',
      });
    }

    // 2. Reconciliation Check (Tax Ledger vs GSTR-3B Liability & ITC vs GSTR-3B Section 4)
    const ledgerEntries = await this.prisma.taxLedgerEntry.findMany({
      where: { tenantId, gstinId, taxPeriodId, isReversed: false },
    });

    let ledgerLiabilitySum = new Decimal(0);
    for (const entry of ledgerEntries) {
      if (entry.entryType === 'OUTPUT_LIABILITY' || entry.entryType === 'ADJUSTMENT') {
        ledgerLiabilitySum = ledgerLiabilitySum.plus(entry.totalTaxAmount.toString());
      }
    }

    const gstr3bLiability = aggregatedGstr3b?.section3_1?.totalLiability?.totalAmount || 0;
    const ledgerVsGstr3bVariance = ledgerLiabilitySum.minus(gstr3bLiability).abs().toNumber();

    if (ledgerVsGstr3bVariance > 0.01) {
      issues.push({
        type: 'STATUTORY_RECONCILIATION',
        code: 'GSTR3B_LEDGER_VARIANCE',
        message: `Unexplained variance of ${ledgerVsGstr3bVariance} detected between Tax Ledger and GSTR-3B output liability`,
        severity: 'ERROR',
      });
    }

    const itcRecords = await this.prisma.itcRecord.findMany({
      where: { tenantId, gstinId, taxPeriodId },
    });

    let itcEligibleSum = new Decimal(0);
    let itcReversedSum = new Decimal(0);
    for (const record of itcRecords) {
      if (record.status === 'ELIGIBLE' || record.status === 'CLAIMED' || record.status === 'RECLAIMED') {
        itcEligibleSum = itcEligibleSum.plus(record.eligibleTotalTax.toString());
      } else if (record.status === 'REVERSED') {
        itcReversedSum = itcReversedSum.plus(record.eligibleTotalTax.toString());
      }
    }
    const expectedNetItc = itcEligibleSum.minus(itcReversedSum);

    const gstr3bNetItc = aggregatedGstr3b?.section4_itc?.netItcAvailable?.totalAmount || 0;
    const itcVsGstr3bVariance = expectedNetItc.minus(gstr3bNetItc).abs().toNumber();

    if (itcVsGstr3bVariance > 0.01) {
      issues.push({
        type: 'STATUTORY_RECONCILIATION',
        code: 'GSTR3B_ITC_VARIANCE',
        message: `Unexplained variance of ${itcVsGstr3bVariance} detected between ITC Records and GSTR-3B Net ITC`,
        severity: 'ERROR',
      });
    }

    const hasErrors = issues.some((i) => i.severity === 'ERROR');

    return {
      isValid: !hasErrors,
      dataValidationPassed: !issues.some((i) => i.type === 'DATA_VALIDATION' && i.severity === 'ERROR'),
      reconciliationPassed: ledgerVsGstr3bVariance <= 0.01 && itcVsGstr3bVariance <= 0.01,
      issues,
      reconciliationCheck: {
        invoiceVsGstr1Variance: 0,
        ledgerVsGstr3bVariance,
        itcVsGstr3bVariance,
      },
    };
  }
}
