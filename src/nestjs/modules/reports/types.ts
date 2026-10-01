import { ReportType, ExportFormat, ExportStatus } from '@prisma/client';

export { ReportType, ExportFormat, ExportStatus };

export interface StandardReportFilters {
  tenantId: string;
  companyId?: string;
  gstinId?: string;
  branchId?: string;
  fromDate?: string; // YYYY-MM-DD
  toDate?: string;   // YYYY-MM-DD
  taxPeriod?: string;// YYYY-MM
  fiscalYear?: string;// e.g. "2026-2027"
  limit?: number;
  offset?: number;
}

export interface ReportQueryResult<T = any> {
  reportType: ReportType;
  generatedAt: string;
  tenantId: string;
  filters: StandardReportFilters;
  summary: Record<string, any>;
  data: T[];
  totalRecords: number;
}

export interface ExportReportRequest {
  tenantId: string;
  userId: string;
  reportType: ReportType;
  format: ExportFormat;
  filters: StandardReportFilters;
  idempotencyKey: string;
}

export interface ExportReportResult {
  exportId: string;
  tenantId: string;
  reportType: ReportType;
  format: ExportFormat;
  status: ExportStatus;
  downloadToken?: string;
  downloadUrl?: string;
  fileSizeBytes?: number;
  idempotencyHit: boolean;
  asyncQueued: boolean;
  jobId?: string;
}
