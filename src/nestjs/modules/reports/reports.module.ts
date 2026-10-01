import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { JobsModule } from '../jobs/jobs.module';
import { FinancialReportsService } from './financial-reports.service';
import { GstReportsService } from './gst-reports.service';
import { AnalyticsService } from './analytics.service';
import { ReportExportService } from './report-export.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [PrismaModule, AuditModule, JobsModule],
  controllers: [ReportsController],
  providers: [
    FinancialReportsService,
    GstReportsService,
    AnalyticsService,
    ReportExportService,
  ],
  exports: [
    FinancialReportsService,
    GstReportsService,
    AnalyticsService,
    ReportExportService,
  ],
})
export class ReportsModule {}
