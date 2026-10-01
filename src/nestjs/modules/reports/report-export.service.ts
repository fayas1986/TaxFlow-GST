import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ImmutableAuditService } from '../audit/immutable-audit.service';
import { JobDispatcherService } from '../jobs/job-dispatcher.service';
import { JobDomain } from '../jobs/types';
import { ExportReportRequest, ExportReportResult, ExportStatus, ExportFormat, ReportType } from './types';
import * as crypto from 'crypto';

@Injectable()
export class ReportExportService {
  private readonly logger = new Logger(ReportExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: ImmutableAuditService,
    private readonly jobDispatcher: JobDispatcherService,
  ) {}

  async requestReportExport(req: ExportReportRequest): Promise<ExportReportResult> {
    const { tenantId, userId, reportType, format, filters, idempotencyKey } = req;

    // 1. Idempotency Check
    const existingExport = await this.prisma.reportExportRecord.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId,
          idempotencyKey,
        },
      },
    });

    if (existingExport) {
      this.logger.log(`Idempotent report export hit for key [${idempotencyKey}] on tenant [${tenantId}].`);
      return {
        exportId: existingExport.id,
        tenantId: existingExport.tenantId,
        reportType: existingExport.reportType as ReportType,
        format: existingExport.format as ExportFormat,
        status: existingExport.status as ExportStatus,
        downloadToken: existingExport.downloadToken || undefined,
        downloadUrl: existingExport.downloadToken ? `/api/v1/reports/download/${existingExport.downloadToken}` : undefined,
        fileSizeBytes: Number(existingExport.fileSizeBytes || 0),
        idempotencyHit: true,
        asyncQueued: existingExport.status === ExportStatus.PENDING || existingExport.status === ExportStatus.GENERATING,
      };
    }

    // 2. Generate Secure Token & Record Database Entry
    const downloadToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000); // 24-hour expiration

    const exportRecord = await this.prisma.reportExportRecord.create({
      data: {
        tenantId,
        userId,
        reportType,
        format,
        status: ExportStatus.PENDING,
        filters: JSON.parse(JSON.stringify(filters)),
        downloadToken,
        expiresAt,
        idempotencyKey,
      },
    });

    // 3. Dispatch Async Background Generation Job
    const jobResult = await this.jobDispatcher.dispatchJob({
      tenantId,
      userId,
      domain: JobDomain.DOCUMENT_PROCESSING,
      jobType: 'GENERATE_REPORT_EXPORT',
      idempotencyKey: `export-job-${exportRecord.id}`,
      correlationId: `corr-exp-${exportRecord.id}`,
      data: {
        exportId: exportRecord.id,
        reportType,
        format,
        filters,
      },
      securityContext: {
        tenantId,
        userId,
        permissions: ['REPORT_EXPORT'],
      },
    });

    // 4. Record Audit Log
    await this.auditService.logEvent({
      tenantId,
      userId,
      eventType: 'REPORT_EXPORTED',
      resourceType: 'REPORT_EXPORT',
      resourceId: exportRecord.id,
      action: 'EXPORT',
      metadata: {
        reportType,
        format,
        idempotencyKey,
        downloadToken,
      },
    });

    return {
      exportId: exportRecord.id,
      tenantId: exportRecord.tenantId,
      reportType: exportRecord.reportType as ReportType,
      format: exportRecord.format as ExportFormat,
      status: ExportStatus.PENDING,
      downloadToken,
      downloadUrl: `/api/v1/reports/download/${downloadToken}`,
      idempotencyHit: false,
      asyncQueued: true,
      jobId: jobResult.jobId,
    };
  }

  async verifyAndDownloadExport(downloadToken: string, requestingTenantId: string): Promise<any> {
    const record = await this.prisma.reportExportRecord.findUnique({
      where: { downloadToken },
    });

    if (!record) {
      throw new NotFoundException(`Export file token [${downloadToken}] not found.`);
    }

    if (record.tenantId !== requestingTenantId) {
      throw new ForbiddenException(`Tenant isolation violation: Cannot access export record belonging to another tenant.`);
    }

    if (record.expiresAt && new Date() > record.expiresAt) {
      throw new ForbiddenException(`Export download link has expired.`);
    }

    return {
      exportId: record.id,
      tenantId: record.tenantId,
      reportType: record.reportType,
      format: record.format,
      status: record.status,
      fileKey: record.fileKey || `exports/${record.tenantId}/${record.id}.${record.format.toLowerCase()}`,
      fileSizeBytes: Number(record.fileSizeBytes || 0),
    };
  }

  formatReportToCsv(data: any[]): string {
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map((header) => {
        const val = row[header];
        if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
        return val !== undefined && val !== null ? val : '';
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }
}
