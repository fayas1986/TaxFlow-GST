import { Controller, Get, Post, Body, Query, Param, UseGuards, Req } from '@nestjs/common';
import { FinancialReportsService } from './financial-reports.service';
import { GstReportsService } from './gst-reports.service';
import { AnalyticsService } from './analytics.service';
import { ReportExportService } from './report-export.service';
import { StandardReportFilters, ExportReportRequest, ExportFormat, ReportType } from './types';

@Controller('api/v1/reports')
export class ReportsController {
  constructor(
    private readonly financialReports: FinancialReportsService,
    private readonly gstReports: GstReportsService,
    private readonly analytics: AnalyticsService,
    private readonly exportService: ReportExportService,
  ) {}

  @Get('sales-register')
  async getSalesRegister(@Query() query: StandardReportFilters) {
    return this.financialReports.getSalesRegister(query);
  }

  @Get('purchase-register')
  async getPurchaseRegister(@Query() query: StandardReportFilters) {
    return this.financialReports.getPurchaseRegister(query);
  }

  @Get('tax-liability')
  async getTaxLiability(@Query() query: StandardReportFilters) {
    return this.financialReports.getTaxLiabilityReport(query);
  }

  @Get('input-tax-credit')
  async getInputTaxCredit(@Query() query: StandardReportFilters) {
    return this.financialReports.getInputTaxCreditReport(query);
  }

  @Get('invoice-ageing')
  async getInvoiceAgeing(@Query() query: StandardReportFilters) {
    return this.financialReports.getInvoiceAgeingReport(query);
  }

  @Get('gstr1-summary')
  async getGstr1Summary(@Query() query: StandardReportFilters) {
    return this.gstReports.getGstr1Summary(query);
  }

  @Get('gstr3b-summary')
  async getGstr3bSummary(@Query() query: StandardReportFilters) {
    return this.gstReports.getGstr3bSummary(query);
  }

  @Get('gstr2b-recon')
  async getGstr2bRecon(@Query() query: StandardReportFilters) {
    return this.gstReports.getGstr2bReconciliationReport(query);
  }

  @Get('analytics/revenue-trends')
  async getRevenueTrends(@Query() query: StandardReportFilters) {
    return this.analytics.getRevenueTrends(query);
  }

  @Get('analytics/customer-concentration')
  async getCustomerConcentration(@Query() query: StandardReportFilters, @Query('topN') topN?: number) {
    return this.analytics.getCustomerConcentration(query, topN || 5);
  }

  @Post('export')
  async requestExport(@Body() body: ExportReportRequest) {
    return this.exportService.requestReportExport(body);
  }

  @Get('download/:token')
  async downloadExport(@Param('token') token: string, @Query('tenantId') tenantId: string) {
    return this.exportService.verifyAndDownloadExport(token, tenantId);
  }
}
