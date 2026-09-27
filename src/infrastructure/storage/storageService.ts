/**
 * Tenant-Isolated File Storage Service
 * Enforces file paths in the format: /tenants/{tenantId}/gstins/{gstinId}/invoices/{filename}
 * Rejects path traversal and cross-tenant file access.
 */

import { TenantContext } from '../../core/tenancy/types';

interface StoredFile {
  id: string;
  tenantId: string;
  path: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
  content: string; // Base64 or mock content
}

class TenantIsolatedStorageService {
  private files: Map<string, StoredFile> = new Map(); // path -> StoredFile

  constructor() {
    this.seedDefaultFiles();
  }

  private seedDefaultFiles() {
    this.files.set('/tenants/t1/invoices/ACM-INV-001.pdf', {
      id: 'file-t1-001',
      tenantId: 't1',
      path: '/tenants/t1/invoices/ACM-INV-001.pdf',
      filename: 'ACM-INV-001.pdf',
      sizeBytes: 1024 * 145,
      mimeType: 'application/pdf',
      uploadedBy: 'u-fayas',
      uploadedAt: '2026-09-10T10:00:00.000Z',
      content: 'MOCK_PDF_DATA_ACME'
    });

    this.files.set('/tenants/t2/invoices/GLB-INV-001.pdf', {
      id: 'file-t2-001',
      tenantId: 't2',
      path: '/tenants/t2/invoices/GLB-INV-001.pdf',
      filename: 'GLB-INV-001.pdf',
      sizeBytes: 1024 * 230,
      mimeType: 'application/pdf',
      uploadedBy: 'u-globex-user',
      uploadedAt: '2026-09-11T11:00:00.000Z',
      content: 'MOCK_PDF_DATA_GLOBEX'
    });
  }

  /**
   * Normalize and validate storage path against tenant boundary
   */
  public validateTenantPath(ctx: TenantContext, requestedPath: string): string {
    // Prevent directory traversal attacks (plain and URL-encoded)
    const normalized = decodeURIComponent(requestedPath);
    if (normalized.includes('..') || normalized.includes('//') || normalized.includes('\\')) {
      throw new Error('400 Bad Request: Path traversal detected in storage path');
    }

    const expectedPrefix = `/tenants/${ctx.tenantId}/`;
    if (!normalized.startsWith(expectedPrefix)) {
      throw new Error(`403 Forbidden [Storage Isolation Violation]: Path '${requestedPath}' does not belong to tenant '${ctx.tenantId}'`);
    }

    // Check GSTIN scoping if path contains /gstins/{gstinId}/
    const gstinMatch = normalized.match(/\/gstins\/([a-zA-Z0-9_-]+)\//);
    if (gstinMatch && gstinMatch[1]) {
      const pathGstin = gstinMatch[1];
      if (ctx.assignedGstinIds && ctx.assignedGstinIds !== 'ALL') {
        if (!ctx.assignedGstinIds.includes(pathGstin)) {
          throw new Error(`403 Forbidden: User not authorized to access files for GSTIN '${pathGstin}'`);
        }
      }
    }

    return normalized;
  }

  /**
   * Read file securely within tenant scope
   */
  public readFile(ctx: TenantContext, requestedPath: string): StoredFile {
    const validPath = this.validateTenantPath(ctx, requestedPath);

    const file = this.files.get(validPath);
    if (!file) {
      throw new Error(`404 Not Found: File '${validPath}' does not exist`);
    }

    if (file.tenantId !== ctx.tenantId) {
      throw new Error(`403 Forbidden: Storage file belongs to tenant '${file.tenantId}', active is '${ctx.tenantId}'`);
    }

    return file;
  }

  /**
   * Save file with enforced tenant directory prefix (optionally GSTIN-scoped)
   */
  public saveFile(
    ctx: TenantContext,
    subfolder: 'invoices' | 'exports' | 'returns' | 'reconciliation' | 'reports',
    filename: string,
    content: string,
    mimeType = 'application/pdf',
    gstinId?: string
  ): StoredFile {
    if (ctx.isReadOnly) {
      throw new Error('403 Forbidden: Read-only user cannot upload or write files');
    }

    if (gstinId && ctx.assignedGstinIds && ctx.assignedGstinIds !== 'ALL') {
      if (!ctx.assignedGstinIds.includes(gstinId)) {
        throw new Error(`403 Forbidden: User not authorized to save files under GSTIN '${gstinId}'`);
      }
    }

    const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = gstinId
      ? `/tenants/${ctx.tenantId}/gstins/${gstinId}/${subfolder}/${cleanName}`
      : `/tenants/${ctx.tenantId}/${subfolder}/${cleanName}`;
    const id = `file-${ctx.tenantId}-${Date.now()}`;

    const stored: StoredFile = {
      id,
      tenantId: ctx.tenantId,
      path,
      filename: cleanName,
      sizeBytes: content.length,
      mimeType,
      uploadedBy: ctx.userId,
      uploadedAt: new Date().toISOString(),
      content
    };

    this.files.set(path, stored);
    return stored;
  }

  /**
   * Test cross-tenant storage access attempt
   */
  public testCrossTenantFileAccess(ctx: TenantContext, targetForeignPath: string): { blocked: boolean; error?: string } {
    try {
      this.readFile(ctx, targetForeignPath);
      return { blocked: false };
    } catch (err: any) {
      return { blocked: true, error: err.message };
    }
  }
}

export const storageService = new TenantIsolatedStorageService();
