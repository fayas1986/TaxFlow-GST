import { Injectable, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CryptoService } from '../../common/services/crypto.service';
import { ImmutableAuditService } from '../audit/immutable-audit.service';
import { MappingEngineService } from './mapping-engine.service';
import { ValidationEngineService } from './validation-engine.service';
import { TaxComparisonService } from './tax-comparison.service';
import { CanonicalTransactionDto } from './canonical-transaction.dto';
import { SyncRunStatus, IntegrationErrorCategory, IntegrationProvider } from '@prisma/client';
import { GenericRestAdapter } from './adapters/generic-rest.adapter';
import { CsvExcelImportAdapter } from './adapters/csv-excel.adapter';
import { ErpIntegrationAdapter } from './adapters/base-adapter.interface';
import * as crypto from 'crypto';
import Decimal from 'decimal.js';

export interface CreateIntegrationDto {
  tenantId: string;
  provider: IntegrationProvider;
  name: string;
  apiEndpoint?: string;
  credentials: any;
  webhookSecret?: string;
}

export interface TriggerSyncDto {
  tenantId: string;
  integrationId: string;
  correlationId: string;
  rawPayloads?: any[];
  fileContent?: string;
}

@Injectable()
export class SyncEngineService {
  private readonly logger = new Logger(SyncEngineService.name);
  private adapters: Map<IntegrationProvider, ErpIntegrationAdapter> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly auditService: ImmutableAuditService,
    private readonly mappingEngine: MappingEngineService,
    private readonly validationEngine: ValidationEngineService,
    private readonly taxComparisonService: TaxComparisonService,
  ) {
    this.adapters.set(IntegrationProvider.GENERIC_REST, new GenericRestAdapter());
    this.adapters.set(IntegrationProvider.CSV_EXCEL, new CsvExcelImportAdapter());
  }

  /**
   * Register a new ERP Integration with AES-256-GCM encrypted credentials.
   */
  async createIntegration(dto: CreateIntegrationDto) {
    const encryptedCredentials = this.cryptoService.encrypt(JSON.stringify(dto.credentials));
    const encryptedApiEndpoint = dto.apiEndpoint ? this.cryptoService.encrypt(dto.apiEndpoint) : null;

    const integration = await this.prisma.erpIntegration.create({
      data: {
        tenantId: dto.tenantId,
        provider: dto.provider,
        name: dto.name,
        encryptedApiEndpoint,
        encryptedCredentials,
        webhookSecret: dto.webhookSecret || null,
        isActive: true,
      },
    });

    await this.auditService.logEvent({
      tenantId: dto.tenantId,
      action: 'ERP_INTEGRATION_CREATED',
      entityType: 'ErpIntegration',
      entityId: integration.id,
      correlationId: `create-int-${integration.id}`,
      afterState: { provider: integration.provider, name: integration.name },
      result: 'SUCCESS',
    });

    return integration;
  }

  /**
   * Execute Synchronization Run with full idempotency, statutory lock protection, and error isolation.
   */
  async executeSync(dto: TriggerSyncDto) {
    const startTime = Date.now();

    // 1. Fetch integration & enforce Tenant Isolation
    const integration = await this.prisma.erpIntegration.findFirst({
      where: { id: dto.integrationId, tenantId: dto.tenantId, isActive: true },
      include: { mappingConfigs: { where: { isDefault: true } } },
    });

    if (!integration) {
      throw new ForbiddenException('Forbidden: ERP Integration not found or tenant scope mismatch.');
    }

    // 2. Initialize Sync Run Log (PENDING -> RUNNING)
    const syncRun = await this.prisma.syncRunLog.create({
      data: {
        tenantId: dto.tenantId,
        integrationId: integration.id,
        status: SyncRunStatus.RUNNING,
        sourceSystem: integration.provider,
        correlationId: dto.correlationId,
      },
    });

    let rawRecords: any[] = [];
    try {
      if (dto.rawPayloads && dto.rawPayloads.length > 0) {
        rawRecords = dto.rawPayloads;
      } else {
        const adapter = this.adapters.get(integration.provider);
        if (adapter) {
          const decryptedCreds = JSON.parse(this.cryptoService.decrypt(integration.encryptedCredentials));
          const endpoint = integration.encryptedApiEndpoint ? this.cryptoService.decrypt(integration.encryptedApiEndpoint) : '';
          rawRecords = await adapter.fetchRawTransactions(endpoint, decryptedCreds, {
            parameters: { fileContent: dto.fileContent },
          });
        }
      }
    } catch (err: any) {
      await this.prisma.integrationErrorLog.create({
        data: {
          tenantId: dto.tenantId,
          integrationId: integration.id,
          syncRunId: syncRun.id,
          category: IntegrationErrorCategory.CONNECTIVITY_ERROR,
          errorCode: 'ERR_FETCH_FAILED',
          errorMessage: `Failed to fetch raw records from ERP adapter: ${err.message}`,
        },
      });

      const failedRun = await this.prisma.syncRunLog.update({
        where: { id: syncRun.id },
        data: {
          status: SyncRunStatus.FAILED,
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
          recordsReceived: 0,
          recordsFailed: 1,
        },
      });
      return failedRun;
    }

    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsSkipped = 0;
    let recordsFailed = 0;
    const mappingConfig = integration.mappingConfigs[0] || {};

    // 3. Process records individually for partial-success isolation
    for (const rawRecord of rawRecords) {
      try {
        // A. Canonical Mapping
        const canonical = this.mappingEngine.mapToCanonical(rawRecord, mappingConfig, integration.provider);

        // B. Data Validation
        const validationRes = this.validationEngine.validateCanonical(canonical);
        if (!validationRes.isValid) {
          recordsFailed++;
          for (const err of validationRes.errors) {
            await this.prisma.integrationErrorLog.create({
              data: {
                tenantId: dto.tenantId,
                integrationId: integration.id,
                syncRunId: syncRun.id,
                externalDocumentId: canonical.externalDocumentId || null,
                category: err.category,
                errorCode: err.errorCode,
                errorMessage: err.errorMessage,
                rawPayload: rawRecord,
              },
            });
          }
          continue;
        }

        // C. Calculate Payload Hash for Traceability
        const sourcePayloadHash = crypto.createHash('sha256').update(JSON.stringify(rawRecord)).digest('hex');

        // D. IDEMPOTENCY CHECK
        const existingImport = await this.prisma.importedTransactionRecord.findFirst({
          where: {
            tenantId: dto.tenantId,
            integrationId: integration.id,
            externalDocumentId: canonical.externalDocumentId,
            documentType: canonical.documentType,
          },
        });

        if (existingImport) {
          if (existingImport.sourcePayloadHash === sourcePayloadHash) {
            // Duplicate content -> Skip idempotently
            recordsSkipped++;
            continue;
          }
        }

        // E. STATUTORY LOCK & INVOICE STATE CHECK
        let existingInvoice: any = null;
        if (existingImport && existingImport.taxflowInvoiceId) {
          existingInvoice = await this.prisma.salesInvoice.findFirst({
            where: { id: existingImport.taxflowInvoiceId, tenantId: dto.tenantId },
            include: { taxPeriod: true },
          });
        }

        if (existingInvoice) {
          // Check Statutory Lock / E-Invoice Lock / Tax Period Lock
          if (existingInvoice.isStatutoryLocked || existingInvoice.isEInvoiceGenerated || existingInvoice.taxPeriod?.isLocked) {
            recordsFailed++;
            await this.prisma.integrationErrorLog.create({
              data: {
                tenantId: dto.tenantId,
                integrationId: integration.id,
                syncRunId: syncRun.id,
                externalDocumentId: canonical.externalDocumentId,
                category: IntegrationErrorCategory.DOMAIN_ERROR,
                errorCode: 'ERR_STATUTORY_LOCK_VIOLATION',
                errorMessage: `ERP modification rejected: Invoice ${existingInvoice.invoiceNumber} is statutory locked (IRN / Tax Period locked).`,
                rawPayload: rawRecord,
              },
            });

            await this.auditService.logEvent({
              tenantId: dto.tenantId,
              action: 'ERP_STATUTORY_LOCK_VIOLATION_BLOCKED',
              entityType: 'SalesInvoice',
              entityId: existingInvoice.id,
              correlationId: dto.correlationId,
              result: 'BLOCKED',
              reason: 'ERP attempted to bypass statutory/tax period lock',
            });
            continue;
          }
        }

        // F. Tax Comparison (Authoritative TaxFlow Engine vs ERP Tax)
        const supplierGstin = canonical.gstinId.length === 15 ? canonical.gstinId : '27AAAAA0000A1Z5';
        const taxComp = await this.taxComparisonService.compareTax(canonical, supplierGstin);

        // G. Persist or Update Imported Transaction Record
        if (existingImport) {
          await this.prisma.importedTransactionRecord.update({
            where: { id: existingImport.id },
            data: {
              sourcePayloadHash,
              canonicalPayload: canonical as any,
              erpCalculatedTax: taxComp.erpTotalTax,
              taxflowCalculatedTax: taxComp.taxflowTotalTax,
              taxVariance: taxComp.taxVariance,
              isTaxMatched: taxComp.isMatched,
              status: taxComp.isMatched ? 'PROCESSED' : 'TAX_MISMATCH',
            },
          });
          recordsUpdated++;
        } else {
          await this.prisma.importedTransactionRecord.create({
            data: {
              tenantId: dto.tenantId,
              integrationId: integration.id,
              syncRunId: syncRun.id,
              sourceSystem: integration.provider,
              externalDocumentId: canonical.externalDocumentId,
              externalCompanyRef: canonical.sourceCompanyRef || null,
              documentType: canonical.documentType,
              documentNumber: canonical.documentNumber,
              documentDate: new Date(canonical.documentDate),
              sourcePayloadHash,
              canonicalPayload: canonical as any,
              erpCalculatedTax: taxComp.erpTotalTax,
              taxflowCalculatedTax: taxComp.taxflowTotalTax,
              taxVariance: taxComp.taxVariance,
              isTaxMatched: taxComp.isMatched,
              status: taxComp.isMatched ? 'PROCESSED' : 'TAX_MISMATCH',
            },
          });
          recordsCreated++;
        }
      } catch (err: any) {
        recordsFailed++;
        await this.prisma.integrationErrorLog.create({
          data: {
            tenantId: dto.tenantId,
            integrationId: integration.id,
            syncRunId: syncRun.id,
            category: IntegrationErrorCategory.DOMAIN_ERROR,
            errorCode: 'ERR_PROCESSING_EXCEPTION',
            errorMessage: err.message,
            rawPayload: rawRecord,
          },
        });
      }
    }

    // 4. Finalize Sync Run Status
    const totalReceived = rawRecords.length;
    let finalStatus: SyncRunStatus = SyncRunStatus.COMPLETED;
    if (recordsFailed > 0 && (recordsCreated > 0 || recordsUpdated > 0 || recordsSkipped > 0)) {
      finalStatus = SyncRunStatus.PARTIAL_SUCCESS;
    } else if (recordsFailed > 0 && recordsCreated === 0 && recordsUpdated === 0) {
      finalStatus = SyncRunStatus.FAILED;
    }

    const completedRun = await this.prisma.syncRunLog.update({
      where: { id: syncRun.id },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        recordsReceived: totalReceived,
        recordsCreated,
        recordsUpdated,
        recordsSkipped,
        recordsFailed,
      },
    });

    await this.prisma.erpIntegration.update({
      where: { id: integration.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: finalStatus,
      },
    });

    await this.auditService.logEvent({
      tenantId: dto.tenantId,
      action: 'SYNC_RUN_COMPLETED',
      entityType: 'SyncRunLog',
      entityId: syncRun.id,
      correlationId: dto.correlationId,
      afterState: {
        status: finalStatus,
        recordsReceived: totalReceived,
        recordsCreated,
        recordsUpdated,
        recordsSkipped,
        recordsFailed,
      },
      result: finalStatus === SyncRunStatus.FAILED ? 'FAILURE' : 'SUCCESS',
    });

    return completedRun;
  }
}
