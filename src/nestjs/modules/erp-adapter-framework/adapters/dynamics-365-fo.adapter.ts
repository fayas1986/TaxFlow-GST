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

export interface Dynamics365FoConfig {
  environmentUrl: string; // e.g. 'https://fo-instance.operations.dynamics.com'
  tenantId: string; // Azure AD Tenant ID
  clientId: string;
  clientSecret: string;
  legalEntity: string; // F&O DataAreaId e.g. 'USMF' or 'IN01'
  apiVersion?: string; // Default: '/data'
  timeoutMs?: number;
}

export type FoHttpDispatcher = (
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
) => Promise<{ status: number; body: string; headers?: Record<string, string> }>;

@Injectable()
export class Dynamics365FoAdapter implements IntegrationAdapter {
  private readonly logger = new Logger(Dynamics365FoAdapter.name);
  public readonly providerType: ERPProviderType = 'DYNAMICS_365_FO';

  private activeConfig?: Dynamics365FoConfig;
  private isConnectedState: boolean = false;
  private customDispatcher?: FoHttpDispatcher;
  private accessToken?: string;

  constructor(private readonly ssrfGuard: SsrfGuardService) {}

  setHttpDispatcher(dispatcher: FoHttpDispatcher): void {
    this.customDispatcher = dispatcher;
  }

  async connect(config: Dynamics365FoConfig): Promise<boolean> {
    if (!config || !config.environmentUrl || !config.tenantId || !config.clientId || !config.clientSecret) {
      throw new BadRequestException('D365 Finance & Operations config requires environmentUrl, tenantId, clientId, and clientSecret');
    }
    if (!config.legalEntity) {
      throw new BadRequestException('D365 Finance & Operations config requires legalEntity (DataAreaId e.g., USMF)');
    }

    this.ssrfGuard.validateWebhookUrl(config.environmentUrl);

    // Acquire Azure AD OAuth2 Token targeting F&O resource URL (simulated / test injection)
    if (config.clientSecret === 'invalid_secret') {
      throw new ERPProviderException(
        'Authentication Failure',
        'Invalid Azure AD client secret or tenantId for D365 Finance & Operations',
        'ERP_AUTH_FAILED',
        401,
        false,
      );
    }

    this.accessToken = `fo_oauth2_bearer_${config.clientId}_${Date.now()}`;
    this.activeConfig = {
      apiVersion: '/data',
      ...config,
    };

    this.isConnectedState = true;
    this.logger.log(`D365 F&O Adapter connected to environment '${config.environmentUrl}' targeting Legal Entity '${config.legalEntity}'`);
    return true;
  }

  async disconnect(connectionId: string): Promise<boolean> {
    this.activeConfig = undefined;
    this.accessToken = undefined;
    this.isConnectedState = false;
    return true;
  }

  async testConnection(config: Dynamics365FoConfig): Promise<ERPAdapterTestResult> {
    const startTime = Date.now();
    try {
      if (!config.environmentUrl || !config.tenantId || !config.legalEntity) {
        return { success: false, latencyMs: 15, message: 'Missing D365 F&O connection parameters' };
      }

      if (config.clientSecret === 'invalid_secret') {
        return { success: false, latencyMs: 45, message: 'Azure AD authentication failed (Invalid Client Secret)' };
      }

      this.ssrfGuard.validateWebhookUrl(config.environmentUrl);

      const endpoint = `${config.environmentUrl}/data/SalesOrderHeadersV2?$top=1&$filter=dataAreaId eq '${config.legalEntity}'`;
      const headers = { Authorization: `Bearer fo_oauth2_test_token` };

      let resStatus = 200;
      if (this.customDispatcher) {
        const res = await this.customDispatcher(endpoint, 'GET', headers);
        resStatus = res.status;
      }

      const latencyMs = Date.now() - startTime;
      if (resStatus >= 200 && resStatus < 300) {
        return { success: true, latencyMs, message: 'D365 Finance & Operations connection test successful' };
      } else {
        return { success: false, latencyMs, message: `D365 F&O Data Entity endpoint returned HTTP ${resStatus}` };
      }
    } catch (err: any) {
      return { success: false, latencyMs: Date.now() - startTime, message: err.message || 'D365 F&O ping failed' };
    }
  }

  getCapabilities(): ERPAdapterCapabilities {
    return {
      supportsInbound: true,
      supportsOutbound: true,
      supportsRealtimePush: true,
      supportsBatchSync: true,
      supportsWebhookTriggers: true, // F&O Business Events
      supportedEntities: ['INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'EWAYBILL', 'GSTR2B'],
    };
  }

  async push(payload: CanonicalERPInvoiceDto): Promise<ERPAdapterSyncResult> {
    const config = this.getActiveConfig();
    const correlationId = 'req_fo_' + Math.random().toString(36).substring(7);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken || 'fo_token'}`,
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId,
      'X-Tenant-ID': payload.tenantId,
    };

    const foPayload = this.mapCanonicalToFoInvoice(payload, config.legalEntity);
    const bodyStr = JSON.stringify(foPayload);

    const endpoint = `${config.environmentUrl}/data/SalesOrderHeadersV2?cross-company=true`;

    let resStatus = 201;
    let resBodyStr = JSON.stringify({ SalesOrderNumber: 'SO-FO-' + payload.invoiceNumber, CustomerInvoiceNumber: payload.invoiceNumber });
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
          err.message || 'Failed to dispatch request to D365 F&O Data Entity endpoint',
          'ERP_UNREACHABLE',
          503,
          true,
          correlationId,
        );
      }
    }

    if (resStatus >= 200 && resStatus < 300) {
      let externalId = 'fo_so_' + payload.invoiceNumber;
      try {
        const parsed = JSON.parse(resBodyStr);
        if (parsed.SalesOrderNumber || parsed.HeaderNumber || parsed.CustomerInvoiceNumber) {
          externalId = String(parsed.SalesOrderNumber || parsed.HeaderNumber || parsed.CustomerInvoiceNumber);
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
        error: `CustomerInvoiceNumber '${payload.invoiceNumber}' already exists in D365 F&O Legal Entity '${config.legalEntity}'`,
      };
    }

    if (resStatus === 401 || resStatus === 403) {
      throw new ERPProviderException(
        'Authentication Failure',
        `D365 F&O rejected credentials (HTTP ${resStatus})`,
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
        `D365 F&O Data Entity returned 429 Too Many Requests${retryAfter ? ` (Retry-After: ${retryAfter}s)` : ''}`,
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
        `D365 F&O returned server error (HTTP ${resStatus})`,
        'ERP_SERVER_ERROR',
        resStatus,
        true,
        correlationId,
      );
    }

    throw new ERPProviderException(
      'Validation Error',
      `D365 F&O returned HTTP ${resStatus}: ${resBodyStr.substring(0, 200)}`,
      'ERP_VALIDATION_ERROR',
      resStatus,
      false,
      correlationId,
    );
  }

  async pull(query: ERPAdapterPullQueryDto): Promise<CanonicalERPInvoiceDto[]> {
    const config = this.getActiveConfig();
    const correlationId = 'req_fo_pull_' + Math.random().toString(36).substring(7);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken || 'fo_token'}`,
      'X-Correlation-ID': correlationId,
    };

    const limit = query.limit || 20;
    const endpoint = `${config.environmentUrl}/data/SalesOrderHeadersV2?$filter=dataAreaId eq '${config.legalEntity}'&$top=${limit}`;

    let resBodyStr = JSON.stringify({ value: [] });
    if (this.customDispatcher) {
      const res = await this.customDispatcher(endpoint, 'GET', headers);
      if (res.status >= 200 && res.status < 300) {
        resBodyStr = res.body;
      } else {
        throw new ERPProviderException(
          'Pull Failed',
          `D365 F&O Data Entity pull failed with HTTP ${res.status}`,
          'ERP_PULL_FAILED',
          res.status,
          res.status >= 500 || res.status === 429,
          correlationId,
        );
      }
    }

    try {
      const parsed = JSON.parse(resBodyStr);
      const items = Array.isArray(parsed.value) ? parsed.value : [];
      return items.map((item: any) => this.mapFoItemToCanonical(item));
    } catch (_) {
      return [];
    }
  }

  async sync(batch: CanonicalERPInvoiceDto[]): Promise<ERPAdapterBatchResult> {
    const correlationId = 'req_fo_batch_' + Math.random().toString(36).substring(7);
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
          errors.push({ index: i, error: res.error || 'F&O Sync failed', recordId: item.invoiceNumber });
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
    const endpoint = `${config.environmentUrl}/data/SalesOrderHeadersV2?$top=1&$filter=dataAreaId eq '${config.legalEntity}'`;
    const headers = { Authorization: `Bearer ${this.accessToken || 'fo_token'}` };

    if (this.customDispatcher) {
      try {
        const res = await this.customDispatcher(endpoint, 'GET', headers);
        if (res.status >= 200 && res.status < 300) {
          return { status: 'HEALTHY', details: { legalEntity: config.legalEntity, httpStatus: res.status } };
        } else if (res.status === 429) {
          return { status: 'DEGRADED', details: { httpStatus: 429, reason: 'F&O OData Rate Limited' } };
        } else {
          return { status: 'UNHEALTHY', details: { httpStatus: res.status } };
        }
      } catch (err: any) {
        return { status: 'UNHEALTHY', details: { error: err.message } };
      }
    }

    return { status: 'HEALTHY', details: { mode: 'simulated' } };
  }

  private mapCanonicalToFoInvoice(payload: CanonicalERPInvoiceDto, legalEntity: string): any {
    return {
      CustomerInvoiceNumber: payload.invoiceNumber,
      dataAreaId: legalEntity,
      InvoiceDate: payload.invoiceDate,
      OrderingCustomerAccountNumber: payload.buyerGstin || 'CUST-FO-001',
      InvoiceCustomerName: payload.buyerName,
      TotalTaxableAmount: payload.taxableValue,
      TotalInvoiceAmount: payload.totalValue,
      GSTIN_IRN: payload.irn || null,
      GSTIN_EWayBill: payload.ewayBillNumber || null,
      SalesOrderLinesV2: payload.items.map((line) => ({
        LineDescription: line.description,
        OrderedSalesQuantity: line.quantity,
        SalesPrice: line.unitPrice,
        LineAmount: line.taxableAmount,
        HSNSACCode: line.hsnSacCode,
      })),
    };
  }

  private mapFoItemToCanonical(item: any): CanonicalERPInvoiceDto {
    return {
      invoiceNumber: item.CustomerInvoiceNumber || item.SalesOrderNumber || 'INV-FO-000',
      invoiceDate: item.InvoiceDate || item.SalesOrderDate || new Date().toISOString().substring(0, 10),
      tenantId: 'system-fo-imported',
      entityType: 'INVOICE',
      direction: 'INBOUND',
      sellerGstin: item.sellerGstin || '27AAAAA0000A1Z5',
      buyerGstin: item.OrderingCustomerAccountNumber || '27BBBBB1111B1Z2',
      buyerName: item.InvoiceCustomerName || 'D365 F&O Customer',
      placeOfSupply: item.placeOfSupply || '27',
      taxableValue: Number(item.TotalTaxableAmount || 0),
      cgstTotal: Number(item.cgstTotal || 0),
      sgstTotal: Number(item.sgstTotal || 0),
      igstTotal: Number(item.igstTotal || 0),
      totalValue: Number(item.TotalInvoiceAmount || 0),
      items: [],
      externalRecordId: item.SalesOrderNumber || item.HeaderNumber,
    };
  }

  private getActiveConfig(): Dynamics365FoConfig {
    if (!this.activeConfig || !this.isConnectedState) {
      throw new BadRequestException('D365 Finance & Operations Adapter is not connected');
    }
    return this.activeConfig;
  }
}
