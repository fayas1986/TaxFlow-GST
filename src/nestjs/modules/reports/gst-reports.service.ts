import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StandardReportFilters, ReportQueryResult, ReportType } from './types';

@Injectable()
export class GstReportsService {
  private readonly logger = new Logger(GstReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getGstr1Summary(filters: StandardReportFilters): Promise<ReportQueryResult> {
    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        tenantId: filters.tenantId,
        invoiceCategory: 'SALES',
        status: { in: ['POSTED', 'VALIDATED'] },
      },
    });

    let b2bTaxable = 0, b2bTax = 0;
    let b2cTaxable = 0, b2cTax = 0;
    let exportTaxable = 0, exportTax = 0;
    let cdnrTaxable = 0, cdnrTax = 0;

    const sections = {
      b2b: [] as any[],
      b2c: [] as any[],
      exports: [] as any[],
      cdnr: [] as any[],
    };

    for (const inv of invoices) {
      const taxable = Number(inv.taxableValue || 0);
      const tax = Number(inv.cgstAmount || 0) + Number(inv.sgstAmount || 0) + Number(inv.igstAmount || 0);

      const entry = {
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        partyGstin: inv.partyGstin,
        taxableValue: taxable,
        taxAmount: tax,
        totalAmount: Number(inv.totalAmount || 0),
      };

      if (inv.invoiceType === 'B2B') {
        b2bTaxable += taxable;
        b2bTax += tax;
        sections.b2b.push(entry);
      } else if (inv.invoiceType === 'B2C') {
        b2cTaxable += taxable;
        b2cTax += tax;
        sections.b2c.push(entry);
      } else if (inv.invoiceType?.startsWith('EXPORT') || inv.invoiceType?.startsWith('SEZ')) {
        exportTaxable += taxable;
        exportTax += tax;
        sections.exports.push(entry);
      } else if (inv.invoiceType === 'CREDIT_NOTE' || inv.invoiceType === 'DEBIT_NOTE') {
        cdnrTaxable += taxable;
        cdnrTax += tax;
        sections.cdnr.push(entry);
      }
    }

    return {
      reportType: ReportType.GSTR1_SUMMARY,
      generatedAt: new Date().toISOString(),
      tenantId: filters.tenantId,
      filters,
      summary: {
        totalOutwardInvoices: invoices.length,
        b2b: { count: sections.b2b.length, taxable: b2bTaxable, tax: b2bTax },
        b2c: { count: sections.b2c.length, taxable: b2cTaxable, tax: b2cTax },
        exports: { count: sections.exports.length, taxable: exportTaxable, tax: exportTax },
        cdnr: { count: sections.cdnr.length, taxable: cdnrTaxable, tax: cdnrTax },
        grossTaxableValue: b2bTaxable + b2cTaxable + exportTaxable + cdnrTaxable,
        grossTaxLiability: b2bTax + b2cTax + exportTax + cdnrTax,
      },
      data: [sections],
      totalRecords: invoices.length,
    };
  }

  async getGstr3bSummary(filters: StandardReportFilters): Promise<ReportQueryResult> {
    const ledgerEntries = await this.prisma.taxLedgerEntry.findMany({
      where: {
        tenantId: filters.tenantId,
      },
    });

    let outwardCgst = 0, outwardSgst = 0, outwardIgst = 0;
    let itcCgst = 0, itcSgst = 0, itcIgst = 0;

    for (const entry of ledgerEntries) {
      const cgst = Number(entry.cgstAmount || 0);
      const sgst = Number(entry.sgstAmount || 0);
      const igst = Number(entry.igstAmount || 0);

      if (entry.entryType === 'OUTPUT_LIABILITY') {
        outwardCgst += cgst;
        outwardSgst += sgst;
        outwardIgst += igst;
      } else if (entry.entryType === 'INPUT_TAX_CREDIT') {
        itcCgst += cgst;
        itcSgst += sgst;
        itcIgst += igst;
      }
    }

    const netCgstPayable = Math.max(0, outwardCgst - itcCgst);
    const netSgstPayable = Math.max(0, outwardSgst - itcSgst);
    const netIgstPayable = Math.max(0, outwardIgst - itcIgst);

    return {
      reportType: ReportType.GSTR3B_SUMMARY,
      generatedAt: new Date().toISOString(),
      tenantId: filters.tenantId,
      filters,
      summary: {
        table3_1_OutwardLiability: {
          cgst: outwardCgst,
          sgst: outwardSgst,
          igst: outwardIgst,
          total: outwardCgst + outwardSgst + outwardIgst,
        },
        table4_EligibleITC: {
          cgst: itcCgst,
          sgst: itcSgst,
          igst: itcIgst,
          total: itcCgst + itcSgst + itcIgst,
        },
        netTaxPayable: {
          cgst: netCgstPayable,
          sgst: netSgstPayable,
          igst: netIgstPayable,
          total: netCgstPayable + netSgstPayable + netIgstPayable,
        },
      },
      data: ledgerEntries,
      totalRecords: ledgerEntries.length,
    };
  }

  async getGstr2bReconciliationReport(filters: StandardReportFilters): Promise<ReportQueryResult> {
    const matches = await this.prisma.reconciliationMatch.findMany({
      where: { tenantId: filters.tenantId },
    });

    let exactMatches = 0;
    let partialMatches = 0;
    let mismatches = 0;

    matches.forEach((m) => {
      if (m.matchType === 'EXACT') exactMatches++;
      else if (m.matchType === 'PARTIAL') partialMatches++;
      else mismatches++;
    });

    return {
      reportType: ReportType.GSTR2B_RECONCILIATION,
      generatedAt: new Date().toISOString(),
      tenantId: filters.tenantId,
      filters,
      summary: {
        totalMatchesEvaluated: matches.length,
        exactMatchCount: exactMatches,
        partialMatchCount: partialMatches,
        mismatchCount: mismatches,
      },
      data: matches,
      totalRecords: matches.length,
    };
  }

  async getEInvoiceStatusReport(filters: StandardReportFilters): Promise<ReportQueryResult> {
    const einvoices = await this.prisma.eInvoiceRecord.findMany({
      where: { tenantId: filters.tenantId },
    });

    let generatedCount = 0;
    let cancelledCount = 0;
    let failedCount = 0;

    einvoices.forEach((e) => {
      if (e.status === 'GENERATED') generatedCount++;
      else if (e.status === 'CANCELLED') cancelledCount++;
      else failedCount++;
    });

    return {
      reportType: ReportType.EINVOICE_STATUS,
      generatedAt: new Date().toISOString(),
      tenantId: filters.tenantId,
      filters,
      summary: {
        totalEInvoices: einvoices.length,
        generatedCount,
        cancelledCount,
        failedCount,
      },
      data: einvoices,
      totalRecords: einvoices.length,
    };
  }

  async getEWayBillStatusReport(filters: StandardReportFilters): Promise<ReportQueryResult> {
    const ewaybills = await this.prisma.eWayBillRecord.findMany({
      where: { tenantId: filters.tenantId },
    });

    let activeCount = 0;
    let cancelledCount = 0;
    let expiredCount = 0;

    ewaybills.forEach((e) => {
      if (e.status === 'GENERATED' || e.status === 'ACTIVE') activeCount++;
      else if (e.status === 'CANCELLED') cancelledCount++;
      else expiredCount++;
    });

    return {
      reportType: ReportType.EWAYBILL_STATUS,
      generatedAt: new Date().toISOString(),
      tenantId: filters.tenantId,
      filters,
      summary: {
        totalEWayBills: ewaybills.length,
        activeCount,
        cancelledCount,
        expiredCount,
      },
      data: ewaybills,
      totalRecords: ewaybills.length,
    };
  }
}
