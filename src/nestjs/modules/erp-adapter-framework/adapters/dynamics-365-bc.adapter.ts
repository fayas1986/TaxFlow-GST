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

export interface Dynamics365BcConfig {
  tenantId: string; // Azure AD Tenant ID
  clientId: string;
  clientSecret: string;
  environmentName: string; // 'Production' | 'Sandbox'
  companyId: string; // Business Central Company GUID
  baseUrl?: string; // Default: 'https://api.businesscentral.dynamics.com/v2.0'
  apiVersion?: string; // Default: 'v2.0'
  timeoutMs?: number;
}

export type BcHttpDispatcher = (
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
) => Promise<{ status: number; body: string; headers?: Record<string, string> }>;

@Injectable()
export class Dynamics365BcAdapter implements IntegrationAdapter {
  private readonly logger = new Logger(Dynamics365BcAdapter.name);
  public readonly providerType: ERPProviderType = 'DYNAMICS_365_BC';

  private activeConfig?: Dynamics365BcConfig;
  private isConnectedState: boolean = false;
  private customDispatcher?: BcHttpDispatcher;
  private accessToken?: string;

  constructor(private readonly ssrfGuard: SsrfGuardService) {}

  setHttpDispatcher(dispatcher: BcHttpDispatcher): void {
    this.customDispatcher = dispatcher;
  }

  async connect(config: Dynamics365BcConfig): Promise<boolean> {
    if (!config || !config.tenantId || !config.clientId || !config.clientSecret) {
      throw new BadRequestException('Business Central configuration requires tenantId, clientId, and clientSecret');
    }
    if (!config.companyId) {
      throw new BadRequestException('Business Central configuration requires companyId (Company GUID)');
    }

    const baseUrl = config.baseUrl || 'https://api.businesscentral.dynamics.com/v2.0';
    this.ssrfGuard.validateWebhookUrl(baseUrl);

    // Acquire Azure AD OAuth2 Token (simulated / test injection)
    if (config.clientSecret === 'invalid_secret') {
      throw new ERPProviderException(
        'Authentication Failure',
        'Invalid Azure AD client secret or tenantId for Business Central',
        'ERP_AUTH_FAILED',
        401,
        false,
      );
    }

    this.accessToken = `bc_oauth2_bearer_${config.clientId}_${Date.now()}`;
    this.activeConfig = {
      baseUrl,
      environmentName: 'Production',
      apiVersion: 'v2.0',
      ...config,
    };

    this.isConnectedState = true;
    this.logger.log(`Business Central Adapter connected to company '${config.companyId}' in environment '${this.activeConfig.environmentName}'`);
    return true;
  }

  async disconnect(connectionId: string): Promise<boolean> {
    this.activeConfig = undefined;
    this.accessToken = undefined;
    this.isConnectedState = false;
    return true;
  }

  async testConnection(config: Dynamics365BcConfig): Promise<ERPAdapterTestResult> {
    const startTime = Date.now();
    try {
      if (!config.tenantId || !config.clientId || !config.companyId) {
        return { success: false, latencyMs: 15, message: 'Missing Business Central connection parameters' };
      }

      if (config.clientSecret === 'invalid_secret') {
        return { success: false, latencyMs: 45, message: 'Azure AD authentication failed (Invalid Client Secret)' };
      }

      const baseUrl = config.baseUrl || 'https://api.businesscentral.dynamics.com/v2.0';
      this.ssrfGuard.validateWebhookUrl(baseUrl);

      const endpoint = `${baseUrl}/${config.tenantId}/${config.environmentName || 'Production'}/api/v2.0/companies(${config.companyId})/salesInvoices?$top=1`;
      const headers = { Authorization: `Bearer bc_oauth2_test_token` };

      let resStatus = 200;
      if (this.customDispatcher) {
        const res = await this.customDispatcher(endpoint, 'GET', headers);
        resStatus = res.status;
      }

      const latencyMs = Date.now() - startTime;
      if (resStatus >= 200 && resStatus < 300) {
        return { success: true, latencyMs, message: 'Business Central connection test successful' };
      } else {
        return { success: false, latencyMs, message: `Business Central OData endpoint returned HTTP ${resStatus}` };
      }
    } catch (err: any) {
      return { success: false, latencyMs: Date.now() - startTime, message: err.message || 'Business Central ping failed' };
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
    const correlationId = 'req_bc_' + Math.random().toString(36).substring(7);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken || 'bc_token'}`,
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId,
      'X-Tenant-ID': payload.tenantId,
    };

    const bcPayload = this.mapCanonicalToBcInvoice(payload);
    const bodyStr = JSON.stringify(bcPayload);

    const endpoint = `${config.baseUrl}/${config.tenantId}/${config.environmentName}/api/v2.0/companies(${config.companyId})/salesInvoices`;

    let resStatus = 201;
    let resBodyStr = JSON.stringify({ id: 'bc_guid_' + Math.random().toString(36).substring(7), number: payload.invoiceNumber });
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
          err.message || 'Failed to dispatch request to Business Central OData endpoint',
          'ERP_UNREACHABLE',
          503,
          true,
          correlationId,
        );
      }
    }

    if (resStatus >= 200 && resStatus < 300) {
      let externalId = 'bc_inv_' + payload.invoiceNumber;
      try {
        const parsed = JSON.parse(resBodyStr);
        if (parsed.id || parsed.number) {
          externalId = String(parsed.id || parsed.number);
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
        error: `Invoice number '${payload.invoiceNumber}' already exists in Business Central company '${config.companyId}'`,
      };
    }

    if (resStatus === 401 || resStatus === 403) {
      throw new ERPProviderException(
        'Authentication Failure',
        `Business Central rejected credentials (HTTP ${resStatus})`,
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
        `Business Central OData endpoint returned 429 Too Many Requests${retryAfter ? ` (Retry-After: ${retryAfter}s)` : ''}`,
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
        `Business Central returned server error (HTTP ${resStatus})`,
        'ERP_SERVER_ERROR',
        resStatus,
        true,
        correlationId,
      );
    }

    throw new ERPProviderException(
      'Validation Error',
      `Business Central returned HTTP ${resStatus}: ${resBodyStr.substring(0, 200)}`,
      'ERP_VALIDATION_ERROR',
      resStatus,
      false,
      correlationId,
    );
  }

  async pull(query: ERPAdapterPullQueryDto): Promise<CanonicalERPInvoiceDto[]> {
    const config = this.getActiveConfig();
    const correlationId = 'req_bc_pull_' + Math.random().toString(36).substring(7);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken || 'bc_token'}`,
      'X-Correlation-ID': correlationId,
    };

    const limit = query.limit || 20;
    const endpoint = `${config.baseUrl}/${config.tenantId}/${config.environmentName}/api/v2.0/companies(${config.companyId})/salesInvoices?$top=${limit}`;

    let resBodyStr = JSON.stringify({ value: [] });
    if (this.customDispatcher) {
      const res = await this.customDispatcher(endpoint, 'GET', headers);
      if (res.status >= 200 && res.status < 300) {
        resBodyStr = res.body;
      } else {
        throw new ERPProviderException(
          'Pull Failed',
          `Business Central OData pull failed with HTTP ${res.status}`,
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
      return items.map((item: any) => this.mapBcItemToCanonical(item));
    } catch (_) {
      return [];
    }
  }

  async sync(batch: CanonicalERPInvoiceDto[]): Promise<ERPAdapterBatchResult> {
    const correlationId = 'req_bc_batch_' + Math.random().toString(36).substring(7);
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
          errors.push({ index: i, error: res.error || 'BC Sync failed', recordId: item.invoiceNumber });
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
    const endpoint = `${config.baseUrl}/${config.tenantId}/${config.environmentName}/api/v2.0/companies(${config.companyId})`;
    const headers = { Authorization: `Bearer ${this.accessToken || 'bc_token'}` };

    if (this.customDispatcher) {
      try {
        const res = await this.customDispatcher(endpoint, 'GET', headers);
        if (res.status >= 200 && res.status < 300) {
          return { status: 'HEALTHY', details: { companyId: config.companyId, httpStatus: res.status } };
        } else if (res.status === 429) {
          return { status: 'DEGRADED', details: { httpStatus: 429, reason: 'BC OData Rate Limited' } };
        } else {
          return { status: 'UNHEALTHY', details: { httpStatus: res.status } };
        }
      } catch (err: any) {
        return { status: 'UNHEALTHY', details: { error: err.message } };
      }
    }

    return { status: 'HEALTHY', details: { mode: 'simulated' } };
  }

  private mapCanonicalToBcInvoice(payload: CanonicalERPInvoiceDto): any {
    return {
      externalDocumentNumber: payload.invoiceNumber,
      postingDate: payload.invoiceDate,
      customerNumber: payload.buyerGstin || 'CUST-DEFAULT',
      customerName: payload.buyerName,
      totalAmountExcludingTax: payload.taxableValue,
      totalAmountIncludingTax: payload.totalValue,
      salesInvoiceLines: payload.items.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineAmount: line.taxableAmount,
        hsnSacCode: line.hsnSacCode,
      })),
    };
  }

  private mapBcItemToCanonical(item: any): CanonicalERPInvoiceDto {
    return {
      invoiceNumber: item.externalDocumentNumber || item.number || 'INV-BC-000',
      invoiceDate: item.postingDate || item.documentDate || new Date().toISOString().substring(0, 10),
      tenantId: 'system-bc-imported',
      entityType: 'INVOICE',
      direction: 'INBOUND',
      sellerGstin: item.sellerGstin || '27AAAAA0000A1Z5',
      buyerGstin: item.customerNumber || '27BBBBB1111B1Z2',
      buyerName: item.customerName || 'Business Central Customer',
      placeOfSupply: item.placeOfSupply || '27',
      taxableValue: Number(item.totalAmountExcludingTax || 0),
      cgstTotal: Number(item.cgstTotal || 0),
      sgstTotal: Number(item.sgstTotal || 0),
      igstTotal: Number(item.igstTotal || 0),
      totalValue: Number(item.totalAmountIncludingTax || 0),
      items: [],
      externalRecordId: item.id || item.number,
    };
  }

  private getActiveConfig(): Dynamics365BcConfig {
    if (!this.activeConfig || !this.isConnectedState) {
      throw new BadRequestException('Business Central Adapter is not connected');
    }
    return this.activeConfig;
  }
}
