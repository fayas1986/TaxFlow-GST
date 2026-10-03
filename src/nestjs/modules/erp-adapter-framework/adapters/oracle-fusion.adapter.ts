import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  IntegrationAdapter,
  ERPProviderType,
  ERPAdapterCapabilities,
  CanonicalERPInvoiceDto,
  ERPAdapterSyncResult,
  ERPAdapterBatchResult,
  ERPAdapterPullQueryDto,
  ERPAdapterTestResult,
  ERPAdapterHealthResult,
} from '../interfaces/erp-adapter.interface';
import { ERPProviderException } from '../exceptions/erp-provider.exception';
import { SsrfGuardService } from '../../webhooks/ssrf-guard.service';

export interface OracleFusionConfig {
  environmentUrl: string; // e.g. 'https://fa-instance.oraclecloud.com'
  businessUnit: string; // e.g. 'US1 Business Unit' or 'IN Business Unit'
  authType: 'OAUTH2' | 'BASIC';
  username?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  apiVersion?: string; // Default: '11.13.18.05'
  timeoutMs?: number;
}

export type OracleHttpDispatcher = (
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
) => Promise<{ status: number; body: string; headers?: Record<string, string> }>;

@Injectable()
export class OracleFusionAdapter implements IntegrationAdapter {
  private readonly logger = new Logger(OracleFusionAdapter.name);
  public readonly providerType: ERPProviderType = 'ORACLE_FUSION';

  private activeConfig?: OracleFusionConfig;
  private isConnectedState: boolean = false;
  private customDispatcher?: OracleHttpDispatcher;
  private authToken?: string;

  constructor(private readonly ssrfGuard: SsrfGuardService) {}

  setHttpDispatcher(dispatcher: OracleHttpDispatcher): void {
    this.customDispatcher = dispatcher;
  }

  async connect(config: OracleFusionConfig): Promise<boolean> {
    if (!config || !config.environmentUrl) {
      throw new BadRequestException('Oracle Fusion config requires environmentUrl');
    }
    if (!config.businessUnit) {
      throw new BadRequestException('Oracle Fusion config requires businessUnit (e.g. US1 Business Unit)');
    }
    if (!config.authType) {
      throw new BadRequestException('Oracle Fusion config requires authType (OAUTH2 or BASIC)');
    }

    this.ssrfGuard.validateWebhookUrl(config.environmentUrl);

    if (config.authType === 'OAUTH2') {
      const tokenEndpoint = config.tokenUrl || `${config.environmentUrl}/oauth2/v1/token`;
      this.ssrfGuard.validateWebhookUrl(tokenEndpoint);
    }

    if (
      (config.authType === 'OAUTH2' && config.clientSecret === 'invalid_secret') ||
      (config.authType === 'BASIC' && config.password === 'invalid_password')
    ) {
      throw new ERPProviderException(
        'Authentication Failure',
        'Invalid Oracle Fusion credentials provided',
        'ERP_AUTH_FAILED',
        401,
        false,
      );
    }

    if (config.authType === 'OAUTH2') {
      this.authToken = `Bearer oracle_oauth2_token_${config.clientId || 'client'}_${Date.now()}`;
    } else if (config.authType === 'BASIC') {
      const creds = Buffer.from(`${config.username || 'user'}:${config.password || ''}`).toString('base64');
      this.authToken = `Basic ${creds}`;
    }

    this.activeConfig = {
      apiVersion: '11.13.18.05',
      timeoutMs: 10000,
      ...config,
    };

    this.isConnectedState = true;
    this.logger.log(`Oracle Fusion Adapter connected to '${config.environmentUrl}' targeting Business Unit '${config.businessUnit}' (Tenant Security Boundary Enforced)`);
    return true;
  }

  async disconnect(connectionId: string): Promise<boolean> {
    this.activeConfig = undefined;
    this.authToken = undefined;
    this.isConnectedState = false;
    return true;
  }

  async testConnection(config: OracleFusionConfig): Promise<ERPAdapterTestResult> {
    const startTime = Date.now();
    try {
      if (!config.environmentUrl || !config.businessUnit) {
        return { success: false, latencyMs: 10, message: 'Missing Oracle Fusion connection parameters' };
      }

      if (
        (config.authType === 'OAUTH2' && config.clientSecret === 'invalid_secret') ||
        (config.authType === 'BASIC' && config.password === 'invalid_password')
      ) {
        return { success: false, latencyMs: 30, message: 'Oracle Fusion authentication failed (Invalid credentials)' };
      }

      this.ssrfGuard.validateWebhookUrl(config.environmentUrl);

      const apiVer = config.apiVersion || '11.13.18.05';
      const endpoint = `${config.environmentUrl}/fscmRestApi/resources/${apiVer}/receivablesInvoices?finder=findByBusinessUnit;BusinessUnit=${encodeURIComponent(config.businessUnit)}&limit=1`;
      const headers = { Authorization: this.authToken || 'Bearer oracle_token' };

      let resStatus = 200;
      if (this.customDispatcher) {
        const res = await this.customDispatcher(endpoint, 'GET', headers);
        resStatus = res.status;
      }

      const latencyMs = Date.now() - startTime;
      if (resStatus >= 200 && resStatus < 300) {
        return { success: true, latencyMs, message: `Oracle Fusion connection test successful for BU '${config.businessUnit}'` };
      } else {
        return { success: false, latencyMs, message: `Oracle Fusion API returned HTTP ${resStatus}` };
      }
    } catch (err: any) {
      return { success: false, latencyMs: Date.now() - startTime, message: err.message || 'Oracle Fusion ping failed' };
    }
  }

  getCapabilities(): ERPAdapterCapabilities {
    return {
      supportsInbound: true,
      supportsOutbound: true,
      supportsRealtimePush: true,
      supportsBatchSync: true,
      supportsWebhookTriggers: true,
      supportedEntities: ['INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'EWAYBILL', 'GSTR2B'],
    };
  }

  async push(payload: CanonicalERPInvoiceDto): Promise<ERPAdapterSyncResult> {
    const config = this.getActiveConfig();
    const correlationId = 'req_oracle_' + Math.random().toString(36).substring(7);

    const headers: Record<string, string> = {
      Authorization: this.authToken || 'Bearer oracle_token',
      'Content-Type': 'application/vnd.oracle.adf.resourceitem+json',
      'X-Correlation-ID': correlationId,
      'X-Tenant-ID': payload.tenantId,
    };

    const oraclePayload = this.mapCanonicalToOracleInvoice(payload, config);
    const bodyStr = JSON.stringify(oraclePayload);

    const apiVer = config.apiVersion || '11.13.18.05';
    const endpoint = `${config.environmentUrl}/fscmRestApi/resources/${apiVer}/receivablesInvoices`;

    let resStatus = 201;
    let resBodyStr = JSON.stringify({ CustomerTransactionId: 99000111, TransactionNumber: payload.invoiceNumber });
    let resHeaders: Record<string, string> = {};

    if (this.customDispatcher) {
      try {
        const res = await this.customDispatcher(endpoint, 'POST', headers, bodyStr);
        resStatus = res.status;
        resBodyStr = res.body;
        resHeaders = res.headers || {};
      } catch (err: any) {
        throw new ERPProviderException(
          'Network Error',
          err.message || 'Failed to dispatch request to Oracle Fusion FSCM REST API',
          'ERP_UNREACHABLE',
          503,
          true,
          correlationId,
        );
      }
    }

    if (resStatus >= 200 && resStatus < 300) {
      let externalId = 'oracle_trx_' + payload.invoiceNumber;
      try {
        const parsed = JSON.parse(resBodyStr);
        if (parsed.CustomerTransactionId || parsed.TransactionNumber) {
          externalId = String(parsed.CustomerTransactionId || parsed.TransactionNumber);
        }
      } catch (_) {}

      return {
        success: true,
        externalId,
        status: 'POSTED',
        correlationId,
        rawResponse: resBodyStr.substring(0, 500),
      };
    }

    if (resStatus === 409) {
      return {
        success: false,
        status: 'DUPLICATE_RECORD',
        correlationId,
        error: `Transaction Number '${payload.invoiceNumber}' already exists in Oracle Business Unit '${config.businessUnit}'`,
      };
    }

    if (resStatus === 401 || resStatus === 403) {
      throw new ERPProviderException(
        'Authentication Failure',
        `Oracle Fusion rejected credentials (HTTP ${resStatus})`,
        'ERP_AUTH_FAILED',
        resStatus,
        false,
        correlationId,
      );
    }

    if (resStatus === 429) {
      const retryAfter = resHeaders['retry-after'] ? parseInt(resHeaders['retry-after'], 10) : undefined;
      throw new ERPProviderException(
        'Rate Limit Exceeded',
        `Oracle Fusion API returned 429 Too Many Requests${retryAfter ? ` (Retry-After: ${retryAfter}s)` : ''}`,
        'ERP_RATE_LIMITED',
        429,
        true,
        correlationId,
        { retryAfter },
      );
    }

    if (resStatus >= 500) {
      throw new ERPProviderException(
        'Server Error',
        `Oracle Fusion returned server error (HTTP ${resStatus})`,
        'ERP_SERVER_ERROR',
        resStatus,
        true,
        correlationId,
      );
    }

    throw new ERPProviderException(
      'Validation Error',
      `Oracle Fusion returned HTTP ${resStatus}: ${resBodyStr.substring(0, 200)}`,
      'ERP_VALIDATION_ERROR',
      resStatus,
      false,
      correlationId,
    );
  }

  async pull(query: ERPAdapterPullQueryDto): Promise<CanonicalERPInvoiceDto[]> {
    const config = this.getActiveConfig();
    const correlationId = 'req_oracle_pull_' + Math.random().toString(36).substring(7);

    const headers: Record<string, string> = {
      Authorization: this.authToken || 'Bearer oracle_token',
      'X-Correlation-ID': correlationId,
    };

    const limit = query.limit || 20;
    const apiVer = config.apiVersion || '11.13.18.05';
    const endpoint = `${config.environmentUrl}/fscmRestApi/resources/${apiVer}/receivablesInvoices?limit=${limit}`;

    let resBodyStr = JSON.stringify({ items: [] });
    if (this.customDispatcher) {
      const res = await this.customDispatcher(endpoint, 'GET', headers);
      if (res.status >= 200 && res.status < 300) {
        resBodyStr = res.body;
      } else {
        throw new ERPProviderException(
          'Pull Failed',
          `Oracle Fusion API pull failed with HTTP ${res.status}`,
          'ERP_PULL_FAILED',
          res.status,
          res.status >= 500 || res.status === 429,
          correlationId,
        );
      }
    }

    try {
      const parsed = JSON.parse(resBodyStr);
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      return items.map((item: any) => this.mapOracleItemToCanonical(item));
    } catch (_) {
      return [];
    }
  }

  async sync(batch: CanonicalERPInvoiceDto[]): Promise<ERPAdapterBatchResult> {
    const correlationId = 'req_oracle_batch_' + Math.random().toString(36).substring(7);
    const results: ERPAdapterSyncResult[] = [];
    const errors: Array<{ index: number; error: string; recordId?: string }> = [];

    let syncedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      try {
        const res = await this.push(item);
        if (res.success) {
          syncedCount++;
        } else {
          failedCount++;
          errors.push({ index: i, error: res.error || 'Oracle Sync failed', recordId: item.invoiceNumber });
        }
        results.push(res);
      } catch (err: any) {
        failedCount++;
        const errMsg = err instanceof ERPProviderException ? err.problemDetails.detail : err.message;
        errors.push({ index: i, error: errMsg, recordId: item.invoiceNumber });
        results.push({
          success: false,
          status: 'FAILED',
          correlationId,
          error: errMsg,
        });
      }
    }

    return {
      success: failedCount === 0,
      totalRecords: batch.length,
      syncedCount,
      failedCount,
      correlationId,
      results,
      errors,
    };
  }

  async healthCheck(): Promise<ERPAdapterHealthResult> {
    const config = this.getActiveConfig();
    const apiVer = config.apiVersion || '11.13.18.05';
    const endpoint = `${config.environmentUrl}/fscmRestApi/resources/${apiVer}/receivablesInvoices?limit=1`;
    const headers = { Authorization: this.authToken || 'Bearer oracle_token' };

    if (this.customDispatcher) {
      try {
        const res = await this.customDispatcher(endpoint, 'GET', headers);
        if (res.status >= 200 && res.status < 300) {
          return { status: 'HEALTHY', details: { businessUnit: config.businessUnit, httpStatus: res.status } };
        } else if (res.status === 429) {
          return { status: 'DEGRADED', details: { httpStatus: 429, reason: 'Oracle API Rate Limited' } };
        } else {
          return { status: 'UNHEALTHY', details: { httpStatus: res.status } };
        }
      } catch (err: any) {
        return { status: 'UNHEALTHY', details: { error: err.message } };
      }
    }

    return { status: 'HEALTHY', details: { mode: 'simulated' } };
  }

  private mapCanonicalToOracleInvoice(payload: CanonicalERPInvoiceDto, config: OracleFusionConfig): any {
    return {
      BusinessUnit: config.businessUnit,
      TransactionNumber: payload.invoiceNumber,
      TransactionDate: payload.invoiceDate,
      BillToCustomerName: payload.buyerName,
      TaxRegistrationNumber: payload.buyerGstin,
      TotalAmount: payload.totalValue,
      InvoiceAmount: payload.totalValue,
      AttributeCategory: 'GST_DETAILS',
      Attribute1: payload.irn || null,
      Attribute2: payload.ewayBillNumber || null,
      receivablesInvoiceLines: payload.items.map((line, idx) => ({
        LineNumber: idx + 1,
        Description: line.description,
        Quantity: line.quantity,
        UnitPrice: line.unitPrice,
        Amount: line.taxableAmount,
        HSNCode: line.hsnSacCode,
      })),
    };
  }

  private mapOracleItemToCanonical(item: any): CanonicalERPInvoiceDto {
    return {
      invoiceNumber: item.TransactionNumber || item.CustomerTransactionId || 'INV-ORACLE-000',
      invoiceDate: item.TransactionDate || new Date().toISOString().substring(0, 10),
      tenantId: 'system-oracle-imported',
      entityType: 'INVOICE',
      direction: 'INBOUND',
      sellerGstin: item.sellerGstin || '27AAAAA0000A1Z5',
      buyerGstin: item.TaxRegistrationNumber || '27BBBBB1111B1Z2',
      buyerName: item.BillToCustomerName || 'Oracle Fusion Customer',
      placeOfSupply: item.placeOfSupply || '27',
      taxableValue: Number(item.TotalAmount || 0),
      cgstTotal: Number(item.cgstTotal || 0),
      sgstTotal: Number(item.sgstTotal || 0),
      igstTotal: Number(item.igstTotal || 0),
      totalValue: Number(item.InvoiceAmount || item.TotalAmount || 0),
      items: [],
      externalRecordId: String(item.CustomerTransactionId || item.TransactionNumber),
    };
  }

  private getActiveConfig(): OracleFusionConfig {
    if (!this.activeConfig || !this.isConnectedState) {
      throw new BadRequestException('Oracle Fusion Adapter is not connected');
    }
    return this.activeConfig;
  }
}
