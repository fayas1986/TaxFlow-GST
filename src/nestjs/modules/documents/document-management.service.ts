import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { ImmutableAuditService } from '../audit/immutable-audit.service';
import { LocalS3CompatibleStorageAdapter, StorageAdapter } from './storage.adapter';
import { DocumentType } from '@prisma/client';
import * as crypto from 'crypto';

export interface UploadDocumentDto {
  tenantId: string;
  companyId?: string;
  gstinId?: string;
  branchId?: string;
  documentType: DocumentType;
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
  createdById: string;
  correlationId: string;
}

export interface GetDownloadUrlDto {
  tenantId: string;
  userId: string;
  userCompanyIds?: string[];
  userGstinIds?: string[];
  userBranchIds?: string[];
  documentId: string;
  correlationId: string;
  expiresInSeconds?: number;
}

@Injectable()
export class DocumentManagementService {
  private storageAdapter: StorageAdapter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: ImmutableAuditService,
  ) {
    this.storageAdapter = new LocalS3CompatibleStorageAdapter();
  }

  /**
   * Upload a new document or new version of an existing document.
   * Large document binaries are stored in S3-compatible Object Storage, not directly in PostgreSQL.
   */
  async uploadDocument(dto: UploadDocumentDto) {
    if (!dto.tenantId || !dto.fileBuffer || !dto.fileName) {
      throw new BadRequestException('tenantId, fileName, and fileBuffer are required for document upload.');
    }

    const sha256Hash = crypto.createHash('sha256').update(dto.fileBuffer).digest('hex');

    // Check for previous versions of document for this tenant & entity
    const existingDoc = await this.prisma.documentMetadata.findFirst({
      where: {
        tenantId: dto.tenantId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        fileName: dto.fileName,
      },
      orderBy: { version: 'desc' },
    });

    const nextVersion = existingDoc ? existingDoc.version + 1 : 1;
    const parentDocumentId = existingDoc ? (existingDoc.parentDocumentId || existingDoc.id) : null;

    // Generate isolated object key
    const docUuid = crypto.randomUUID();
    const objectKey = `tenants/${dto.tenantId}/${dto.documentType.toLowerCase()}/${docUuid}_v${nextVersion}_${dto.fileName}`;

    // 1. Upload binary to object storage
    await this.storageAdapter.uploadObject(objectKey, dto.fileBuffer, dto.mimeType);

    // 2. Save metadata to Postgres
    const metadata = await this.prisma.documentMetadata.create({
      data: {
        tenantId: dto.tenantId,
        companyId: dto.companyId || null,
        gstinId: dto.gstinId || null,
        branchId: dto.branchId || null,
        documentType: dto.documentType,
        entityType: dto.entityType,
        entityId: dto.entityId,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.fileBuffer.length,
        sha256Hash,
        objectKey,
        version: nextVersion,
        parentDocumentId,
        createdById: dto.createdById,
      },
    });

    await this.auditService.logEvent({
      tenantId: dto.tenantId,
      actorUserId: dto.createdById,
      action: 'DOCUMENT_UPLOADED',
      entityType: 'DocumentMetadata',
      entityId: metadata.id,
      correlationId: dto.correlationId,
      afterState: {
        documentId: metadata.id,
        fileName: metadata.fileName,
        version: metadata.version,
        sha256Hash: metadata.sha256Hash,
      },
      result: 'SUCCESS',
    });

    return metadata;
  }

  /**
   * Request a short-lived signed download URL for a document with tenant & organizational scope enforcement.
   */
  async getSignedDownloadUrl(dto: GetDownloadUrlDto) {
    const document = await this.prisma.documentMetadata.findFirst({
      where: { id: dto.documentId },
    });

    if (!document) {
      throw new NotFoundException(`Document metadata ${dto.documentId} not found.`);
    }

    // 1. CROSS-TENANT ISOLATION GUARD
    if (document.tenantId !== dto.tenantId) {
      await this.auditService.logEvent({
        tenantId: dto.tenantId,
        actorUserId: dto.userId,
        action: 'CROSS_TENANT_DOCUMENT_ACCESS_BLOCKED',
        entityType: 'DocumentMetadata',
        entityId: dto.documentId,
        correlationId: dto.correlationId,
        result: 'BLOCKED',
        reason: 'Attempted cross-tenant document download',
      });
      throw new ForbiddenException('Forbidden: Tenant isolation violation.');
    }

    // 2. SCOPE CONTROL GUARD (Company / GSTIN / Branch restriction)
    if (dto.userCompanyIds && document.companyId && !dto.userCompanyIds.includes(document.companyId)) {
      throw new ForbiddenException('Forbidden: You lack required company scope to access this document.');
    }
    if (dto.userGstinIds && document.gstinId && !dto.userGstinIds.includes(document.gstinId)) {
      throw new ForbiddenException('Forbidden: You lack required GSTIN scope to access this document.');
    }
    if (dto.userBranchIds && document.branchId && !dto.userBranchIds.includes(document.branchId)) {
      throw new ForbiddenException('Forbidden: You lack required branch scope to access this document.');
    }

    // 3. Generate short-lived signed URL
    const expiresIn = dto.expiresInSeconds || 300;
    const signedUrl = await this.storageAdapter.generateSignedUrl(document.objectKey, dto.tenantId, expiresIn);

    await this.auditService.logEvent({
      tenantId: dto.tenantId,
      actorUserId: dto.userId,
      action: 'DOCUMENT_SIGNED_URL_GENERATED',
      entityType: 'DocumentMetadata',
      entityId: document.id,
      correlationId: dto.correlationId,
      result: 'SUCCESS',
    });

    return {
      documentId: document.id,
      fileName: document.fileName,
      version: document.version,
      signedUrl,
      expiresInSeconds: expiresIn,
    };
  }

  /**
   * Download and verify document binary integrity using signed URL.
   */
  async downloadDocument(tenantId: string, documentId: string, signedUrl: string) {
    const document = await this.prisma.documentMetadata.findFirst({
      where: { id: documentId, tenantId },
    });

    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found.`);
    }

    // Verify signed URL validity
    const { isValid, objectKey } = this.storageAdapter.verifySignedUrl(signedUrl, tenantId);
    if (!isValid || objectKey !== document.objectKey) {
      throw new ForbiddenException('Invalid or expired signed document URL.');
    }

    // Download from storage
    const binary = await this.storageAdapter.downloadObject(objectKey);

    // Verify SHA-256 integrity
    const computedHash = crypto.createHash('sha256').update(binary).digest('hex');
    if (computedHash !== document.sha256Hash) {
      throw new ForbiddenException('Document integrity check failed: SHA-256 hash mismatch!');
    }

    return {
      metadata: document,
      binary,
    };
  }

  /**
   * Get version history for a document entity.
   */
  async getDocumentVersions(tenantId: string, entityType: string, entityId: string, fileName: string) {
    return this.prisma.documentMetadata.findMany({
      where: {
        tenantId,
        entityType,
        entityId,
        fileName,
      },
      orderBy: { version: 'asc' },
    });
  }
}
