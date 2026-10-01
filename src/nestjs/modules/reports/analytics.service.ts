import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StandardReportFilters, ReportQueryResult, ReportType } from './types';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getRevenueTrends(filters: StandardReportFilters): Promise<ReportQueryResult> {
    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        tenantId: filters.tenantId,
        invoiceCategory: 'SALES',
        status: { in: ['POSTED', 'VALIDATED'] },
      },
      select: {
        invoiceDate: true,
        taxableValue: true,
        totalAmount: true,
        cgstAmount: true,
        sgstAmount: true,
        igstAmount: true,
      },
    });

    const monthlyTrends = new Map<string, { taxable: number; tax: number; total: number; count: number }>();

    for (const inv of invoices) {
      const d = new Date(inv.invoiceDate);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      const curr = monthlyTrends.get(monthKey) || { taxable: 0, tax: 0, total: 0, count: 0 };
      const taxable = Number(inv.taxableValue || 0);
      const tax = Number(inv.cgstAmount || 0) + Number(inv.sgstAmount || 0) + Number(inv.igstAmount || 0);
      const total = Number(inv.totalAmount || 0);

      monthlyTrends.set(monthKey, {
        taxable: curr.taxable + taxable,
        tax: curr.tax + tax,
        total: curr.total + total,
        count: curr.count + 1,
      });
    }

    const data = Array.from(monthlyTrends.entries()).map(([month, val]) => ({
      month,
      taxableValue: val.taxable,
      taxAmount: val.tax,
      totalRevenue: val.total,
      invoiceCount: val.count,
    })).sort((a, b) => a.month.localeCompare(b.month));

    return {
      reportType: ReportType.REVENUE_TRENDS,
      generatedAt: new Date().toISOString(),
      tenantId: filters.tenantId,
      filters,
      summary: {
        totalMonthsAnalyzed: data.length,
        totalRevenue: data.reduce((acc, d) => acc + d.totalRevenue, 0),
        totalInvoices: data.reduce((acc, d) => acc + d.invoiceCount, 0),
      },
      data,
      totalRecords: data.length,
    };
  }

  async getCustomerConcentration(filters: StandardReportFilters, topN = 5): Promise<ReportQueryResult> {
    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        tenantId: filters.tenantId,
        invoiceCategory: 'SALES',
      },
      include: {
        party: true,
      },
    });

    const customerMap = new Map<string, { customerName: string; gstin: string; totalRevenue: number; count: number }>();
    let grandTotalRevenue = 0;

    for (const inv of invoices) {
      const key = inv.partyId || inv.partyGstin || 'UNKNOWN';
      const name = inv.party?.name || 'Walk-in / Cash';
      const gstin = inv.partyGstin || 'N/A';
      const rev = Number(inv.totalAmount || 0);

      grandTotalRevenue += rev;
      const curr = customerMap.get(key) || { customerName: name, gstin, totalRevenue: 0, count: 0 };
      customerMap.set(key, {
        customerName: name,
        gstin,
        totalRevenue: curr.totalRevenue + rev,
        count: curr.count + 1,
      });
    }

    const sortedCustomers = Array.from(customerMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, topN)
      .map((cust) => ({
        ...cust,
        revenueSharePercent: grandTotalRevenue > 0 ? Number(((cust.totalRevenue / grandTotalRevenue) * 100).toFixed(2)) : 0,
      }));

    return {
      reportType: ReportType.CUSTOMER_SALES,
      generatedAt: new Date().toISOString(),
      tenantId: filters.tenantId,
      filters,
      summary: {
        totalCustomers: customerMap.size,
        topNAnalyzed: topN,
        grandTotalRevenue,
        topNRevenueShare: sortedCustomers.reduce((acc, c) => acc + c.revenueSharePercent, 0),
      },
      data: sortedCustomers,
      totalRecords: sortedCustomers.length,
    };
  }

  async getGstinPerformance(filters: StandardReportFilters): Promise<ReportQueryResult> {
    const invoices = await this.prisma.salesInvoice.findMany({
      where: { tenantId: filters.tenantId },
    });

    const gstinMap = new Map<string, { gstinId: string; sales: number; purchases: number; tax: number }>();

    for (const inv of invoices) {
      const key = inv.gstinId || 'UNASSIGNED';
      const curr = gstinMap.get(key) || { gstinId: key, sales: 0, purchases: 0, tax: 0 };
      const amount = Number(inv.totalAmount || 0);
      const tax = Number(inv.cgstAmount || 0) + Number(inv.sgstAmount || 0) + Number(inv.igstAmount || 0);

      if (inv.invoiceCategory === 'SALES') {
        curr.sales += amount;
        curr.tax += tax;
      } else {
        curr.purchases += amount;
      }

      gstinMap.set(key, curr);
    }

    const data = Array.from(gstinMap.values());

    return {
      reportType: ReportType.GSTIN_PERFORMANCE,
      generatedAt: new Date().toISOString(),
      tenantId: filters.tenantId,
      filters,
      summary: {
        totalGstinsActive: data.length,
      },
      data,
      totalRecords: data.length,
    };
  }
}
