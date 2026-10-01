import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StandardReportFilters, ReportQueryResult, ReportType } from './types';

@Injectable()
export class FinancialReportsService {
  private readonly logger = new Logger(FinancialReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSalesRegister(filters: StandardReportFilters): Promise<ReportQueryResult> {
    const whereClause: any = {
      tenantId: filters.tenantId,
      invoiceCategory: 'SALES',
    };

    if (filters.gstinId) whereClause.gstinId = filters.gstinId;
    if (filters.branchId) whereClause.branchId = filters.branchId;
    if (filters.fromDate || filters.toDate) {
      whereClause.invoiceDate = {};
      if (filters.fromDate) whereClause.invoiceDate.gte = new Date(filters.fromDate);
      if (filters.toDate) whereClause.invoiceDate.lte = new Date(filters.toDate);
    }

    const invoices = await this.prisma.salesInvoice.findMany({
      where: whereClause,
      include: {
        party: true,
        items: true,
      },
      orderBy: { invoiceDate: 'desc' },
      take: filters.limit || 1000,
      skip: filters.offset || 0,
    });

    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalAmount = 0;

    const data = invoices.map((inv) => {
      const taxable = Number(inv.taxableValue || 0);
      const cgst = Number(inv.cgstAmount || 0);
      const sgst = Number(inv.sgstAmount || 0);
      const igst = Number(inv.igstAmount || 0);
      const total = Number(inv.totalAmount || 0);

      totalTaxable += taxable;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;
      totalAmount += total;

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        invoiceType: inv.invoiceType,
        customerName: inv.party?.name || 'Walk-in',
        customerGstin: inv.partyGstin,
        taxableValue: taxable,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        totalAmount: total,
        status: inv.status,
      };
    });

    return {
      reportType: ReportType.SALES_REGISTER,
      generatedAt: new Date().toISOString(),
      tenantId: filters.tenantId,
      filters,
      summary: {
        totalInvoices: invoices.length,
        totalTaxableValue: totalTaxable,
        totalCgst: totalCgst,
        totalSgst: totalSgst,
        totalIgst: totalIgst,
        totalTax: totalCgst + totalSgst + totalIgst,
        totalAmount,
      },
      data,
      totalRecords: invoices.length,
    };
  }

  async getPurchaseRegister(filters: StandardReportFilters): Promise<ReportQueryResult> {
    const whereClause: any = {
      tenantId: filters.tenantId,
      invoiceCategory: 'PURCHASE',
    };

    if (filters.gstinId) whereClause.gstinId = filters.gstinId;
    if (filters.branchId) whereClause.branchId = filters.branchId;
    if (filters.fromDate || filters.toDate) {
      whereClause.invoiceDate = {};
      if (filters.fromDate) whereClause.invoiceDate.gte = new Date(filters.fromDate);
      if (filters.toDate) whereClause.invoiceDate.lte = new Date(filters.toDate);
    }

    const purchases = await this.prisma.salesInvoice.findMany({
      where: whereClause,
      include: {
        party: true,
      },
      orderBy: { invoiceDate: 'desc' },
      take: filters.limit || 1000,
      skip: filters.offset || 0,
    });

    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalAmount = 0;

    const data = purchases.map((inv) => {
      const taxable = Number(inv.taxableValue || 0);
      const cgst = Number(inv.cgstAmount || 0);
      const sgst = Number(inv.sgstAmount || 0);
      const igst = Number(inv.igstAmount || 0);
      const total = Number(inv.totalAmount || 0);

      totalTaxable += taxable;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;
      totalAmount += total;

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        vendorName: inv.party?.name || 'Vendor',
        vendorGstin: inv.partyGstin,
        taxableValue: taxable,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        totalAmount: total,
        status: inv.status,
      };
    });

    return {
      reportType: ReportType.PURCHASE_REGISTER,
      generatedAt: new Date().toISOString(),
      tenantId: filters.tenantId,
      filters,
      summary: {
        totalPurchases: purchases.length,
        totalTaxableValue: totalTaxable,
        totalCgst: totalCgst,
        totalSgst: totalSgst,
        totalIgst: totalIgst,
        totalTax: totalCgst + totalSgst + totalIgst,
        totalAmount,
      },
      data,
      totalRecords: purchases.length,
    };
  }

  async getTaxLiabilityReport(filters: StandardReportFilters): Promise<ReportQueryResult> {
    const whereClause: any = {
      tenantId: filters.tenantId,
      entryType: 'OUTPUT_LIABILITY',
    };

    if (filters.gstinId) whereClause.gstinId = filters.gstinId;

    const entries = await this.prisma.taxLedgerEntry.findMany({
      where: whereClause,
      orderBy: { postingDate: 'desc' },
    });

    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const data = entries.map((entry) => {
      const cgst = Number(entry.cgstAmount || 0);
      const sgst = Number(entry.sgstAmount || 0);
      const igst = Number(entry.igstAmount || 0);

      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;

      return {
        id: entry.id,
        postingDate: entry.postingDate,
        documentNumber: entry.documentNumber,
        description: entry.description,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        totalLiability: cgst + sgst + igst,
      };
    });

    return {
      reportType: ReportType.TAX_LIABILITY,
      generatedAt: new Date().toISOString(),
      tenantId: filters.tenantId,
      filters,
      summary: {
        totalOutputCgst: totalCgst,
        totalOutputSgst: totalSgst,
        totalOutputIgst: totalIgst,
        grossOutputTaxLiability: totalCgst + totalSgst + totalIgst,
      },
      data,
      totalRecords: entries.length,
    };
  }

  async getInputTaxCreditReport(filters: StandardReportFilters): Promise<ReportQueryResult> {
    const whereClause: any = {
      tenantId: filters.tenantId,
    };

    if (filters.gstinId) whereClause.gstinId = filters.gstinId;

    const itcRecords = await this.prisma.itcRecord.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    let eligibleCgst = 0;
    let eligibleSgst = 0;
    let eligibleIgst = 0;
    let ineligibleAmount = 0;

    const data = itcRecords.map((rec) => {
      const cgst = Number(rec.cgstAmount || 0);
      const sgst = Number(rec.sgstAmount || 0);
      const igst = Number(rec.igstAmount || 0);

      if (rec.status === 'ELIGIBLE' || rec.status === 'CLAIMED') {
        eligibleCgst += cgst;
        eligibleSgst += sgst;
        eligibleIgst += igst;
      } else if (rec.status === 'INELIGIBLE') {
        ineligibleAmount += (cgst + sgst + igst);
      }

      return {
        id: rec.id,
        invoiceNumber: rec.invoiceNumber,
        supplierGstin: rec.supplierGstin,
        status: rec.status,
        claimType: rec.claimType,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        totalItc: cgst + sgst + igst,
      };
    });

    return {
      reportType: ReportType.INPUT_TAX_CREDIT,
      generatedAt: new Date().toISOString(),
      tenantId: filters.tenantId,
      filters,
      summary: {
        totalEligibleCgst: eligibleCgst,
        totalEligibleSgst: eligibleSgst,
        totalEligibleIgst: eligibleIgst,
        totalEligibleItc: eligibleCgst + eligibleSgst + eligibleIgst,
        totalIneligibleItc: ineligibleAmount,
      },
      data,
      totalRecords: itcRecords.length,
    };
  }

  async getInvoiceAgeingReport(filters: StandardReportFilters): Promise<ReportQueryResult> {
    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        tenantId: filters.tenantId,
        invoiceCategory: 'SALES',
        status: { in: ['POSTED', 'VALIDATED'] },
      },
    });

    const now = new Date();
    let bucket0to30 = 0;
    let bucket31to60 = 0;
    let bucket61to90 = 0;
    let bucket90Plus = 0;

    const data = invoices.map((inv) => {
      const invDate = new Date(inv.invoiceDate);
      const diffDays = Math.floor((now.getTime() - invDate.getTime()) / (1000 * 3600 * 24));
      const amount = Number(inv.totalAmount || 0);

      let ageingBucket = '0-30 Days';
      if (diffDays > 90) {
        ageingBucket = '90+ Days';
        bucket90Plus += amount;
      } else if (diffDays > 60) {
        ageingBucket = '61-90 Days';
        bucket61to90 += amount;
      } else if (diffDays > 30) {
        ageingBucket = '31-60 Days';
        bucket31to60 += amount;
      } else {
        bucket0to30 += amount;
      }

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        partyGstin: inv.partyGstin,
        totalAmount: amount,
        ageInDays: diffDays,
        ageingBucket,
      };
    });

    return {
      reportType: ReportType.INVOICE_AGEING,
      generatedAt: new Date().toISOString(),
      tenantId: filters.tenantId,
      filters,
      summary: {
        totalOutstandingAmount: bucket0to30 + bucket31to60 + bucket61to90 + bucket90Plus,
        bucket0to30,
        bucket31to60,
        bucket61to90,
        bucket90Plus,
      },
      data,
      totalRecords: invoices.length,
    };
  }
}
