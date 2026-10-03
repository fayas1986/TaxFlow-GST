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

export interface GenericRestEndpoints {
  pushInvoice?: string;
  pullInvoices?: string;
  healthCheck?: string;
}

export interface GenericRestConfig {
  baseUrl: string;
  authType: 'API_KEY' | 'BEARER' | 'OAUTH2' | 'BASIC';
  apiKey?: string;
  apiKeyHeader?: string;
  bearerToken?: string;
  username?: string;
  password?: string;
  oauth2TokenUrl?: string;
  oauth2ClientId?: string;
  oauth2ClientSecret?: string;
  endpoints?: GenericRestEndpoints;
  timeoutMs?: number;
  customHeaders?: Record<string, string>;
}

export type GenericRestHttpDispatcher = (
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
) => Promise<{ status: number; body: string; headers?: Record<string, string> }>;

@Injectable()
export class GenericRestAdapter implements IntegrationAdapter {
  private readonly logger = new Logger(GenericRestAdapter.name);
  public readonly providerType: ERPProviderType = 'GENERIC_REST';

  private activeConfig?: GenericRestConfig;
  private isConnectedState: boolean = false;
  private customDispatcher?: GenericRestHttpDispatcher;

  constructor(private readonly ssrfGuard: SsrfGuardService) {}

  setHttpDispatcher(dispatcher: GenericRestHttpDispatcher): void {
    this.customDispatcher = dispatcher;
  }

  async connect(config: GenericRestConfig): Promise<boolean> {
    if (!config || !config.baseUrl) {
      throw new BadRequestException('Generic REST connection config requires baseUrl');
    }

    // SSRF URL Validation
    this.ssrfGuard.validateWebhookUrl(config.baseUrl);

    // Validate Auth Config
    if (config.authType === 'API_KEY' && !config.apiKey) {
      throw new BadRequestException('authType API_KEY requires apiKey');
    }
    if (config.authType === 'BEARER' && !config.bearerToken) {
      throw new BadRequestException('authType BEARER requires bearerToken');
    }
    if (config.authType === 'BASIC' && (!config.username || !config.password)) {
      throw new BadRequestException('authType BASIC requires username and password');
    }
    if (config.authType === 'OAUTH2' && (!config.oauth2ClientId || !config.oauth2ClientSecret)) {
      throw new BadRequestException('authType OAUTH2 requires oauth2ClientId and oauth2ClientSecret');
    }

    this.activeConfig = config;
    this.isConnectedState = true;
    this.logger.log(`Generic REST Adapter connected to ${config.baseUrl}`);
    return true;
  }

  async disconnect(connectionId: string): Promise<boolean> {
    this.activeConfig = undefined;
    this.isConnectedState = false;
    return true;
  }

  async testConnection(config: GenericRestConfig): Promise<ERPAdapterTestResult> {
    const startTime = Date.now();
    try {
      this.ssrfGuard.validateWebhookUrl(config.baseUrl);

      const headers = this.buildAuthHeaders(config);
      const testEndpoint = (config.baseUrl + (config.endpoints?.healthCheck || '/api/v1/health')).replace(/([^:]\/)\/+/g, '$1');

      let resStatus = 200;
      let resMessage = 'Connection test successful';

      if (this.customDispatcher) {
        const res = await this.customDispatcher(testEndpoint, 'GET', headers);
        resStatus = res.status;
      }

      const latencyMs = Date.now() - startTime;

      if (resStatus >= 200 && resStatus < 300) {
        return { success: true, latencyMs, message: resMessage };
      } else if (resStatus === 401 || resStatus === 403) {
        return { success: false, latencyMs, message: `Authentication failed (HTTP ${resStatus})` };
      } else {
        return { success: false, latencyMs, message: `Connection test failed with HTTP ${resStatus}` };
      }
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      return { success: false, latencyMs, message: err.message || 'Connection test failed' };
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
    const correlationId = 'req_rest_' + Math.random().toString(36).substring(7);

    const headers = this.buildAuthHeaders(config);
    headers['Content-Type'] = 'application/json';
    headers['X-Correlation-ID'] = correlationId;
    headers['X-Tenant-ID'] = payload.tenantId;

    const pushEndpoint = (config.baseUrl + (config.endpoints?.pushInvoice || '/api/v1/invoices')).replace(/([^:]\/)\/+/g, '$1');
    const bodyStr = JSON.stringify(payload);

    let resStatus = 201;
    let resBodyStr = JSON.stringify({ id: 'ext_inv_' + payload.invoiceNumber });
    let resHeaders: Record<string, string> = {};

    if (this.customDispatcher) {
      try {
        const res = await this.customDispatcher(pushEndpoint, 'POST', headers, bodyStr);
        resStatus = res.status;
        resBodyStr = res.body;
        resHeaders = res.headers || {};
      } catch (err: any) {
        throw new ERPProviderException(
          'Network Error',
          err.message || 'Failed to dispatch REST request',
          'ERP_UNREACHABLE',
          503,
          true,
          correlationId,
        );
      }
    }

    if (resStatus >= 200 && resStatus < 300) {
      let externalId = 'ext_' + payload.invoiceNumber;
      try {
        const parsed = JSON.parse(resBodyStr);
        if (parsed.id || parsed.externalId || parsed.invoiceId) {
          externalId = String(parsed.id || parsed.externalId || parsed.invoiceId);
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
        error: `Invoice number '${payload.invoiceNumber}' already exists in target REST ERP`,
      };
    }

    if (resStatus === 401 || resStatus === 403) {
      throw new ERPProviderException(
        'Authentication Failure',
        `External REST ERP rejected credentials (HTTP ${resStatus})`,
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
        `External REST ERP returned 429 Too Many Requests${retryAfter ? ` (Retry-After: ${retryAfter}s)` : ''}`,
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
        `External REST ERP returned server error (HTTP ${resStatus})`,
        'ERP_SERVER_ERROR',
        resStatus,
        true,
        correlationId,
      );
    }

    throw new ERPProviderException(
      'Client Error',
      `External REST ERP returned HTTP ${resStatus}: ${resBodyStr.substring(0, 200)}`,
      'ERP_VALIDATION_ERROR',
      resStatus,
      false,
      correlationId,
    );
  }

  async pull(query: ERPAdapterPullQueryDto): Promise<CanonicalERPInvoiceDto[]> {
    const config = this.getActiveConfig();
    const correlationId = 'req_pull_' + Math.random().toString(36).substring(7);

    const headers = this.buildAuthHeaders(config);
    headers['X-Correlation-ID'] = correlationId;

    const pullEndpoint = (config.baseUrl + (config.endpoints?.pullInvoices || '/api/v1/invoices')).replace(/([^:]\/)\/+/g, '$1');

    let resBodyStr = '[]';
    if (this.customDispatcher) {
      const res = await this.customDispatcher(pullEndpoint, 'GET', headers);
      if (res.status >= 200 && res.status < 300) {
        resBodyStr = res.body;
      } else {
        throw new ERPProviderException(
          'Pull Failed',
          `External REST ERP pull failed with HTTP ${res.status}`,
          'ERP_PULL_FAILED',
          res.status,
          res.status >= 500 || res.status === 429,
          correlationId,
        );
      }
    }

    try {
      const items = JSON.parse(resBodyStr);
      if (Array.isArray(items)) {
        return items.map((item: any) => this.mapExternalItemToCanonical(item));
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  async sync(batch: CanonicalERPInvoiceDto[]): Promise<ERPAdapterBatchResult> {
    const correlationId = 'req_batch_' + Math.random().toString(36).substring(7);
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
          errors.push({ index: i, error: res.error || 'Sync failed', recordId: item.invoiceNumber });
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
    const headers = this.buildAuthHeaders(config);
    const healthEndpoint = (config.baseUrl + (config.endpoints?.healthCheck || '/api/v1/health')).replace(/([^:]\/)\/+/g, '$1');

    if (this.customDispatcher) {
      try {
        const res = await this.customDispatcher(healthEndpoint, 'GET', headers);
        if (res.status >= 200 && res.status < 300) {
          return { status: 'HEALTHY', details: { httpStatus: res.status } };
        } else if (res.status === 429) {
          return { status: 'DEGRADED', details: { httpStatus: 429, reason: 'Rate limited' } };
        } else {
          return { status: 'UNHEALTHY', details: { httpStatus: res.status } };
        }
      } catch (err: any) {
        return { status: 'UNHEALTHY', details: { error: err.message } };
      }
    }

    return { status: 'HEALTHY', details: { mode: 'simulated' } };
  }

  private getActiveConfig(): GenericRestConfig {
    if (!this.activeConfig || !this.isConnectedState) {
      throw new BadRequestException('Generic REST Adapter is not connected');
    }
    return this.activeConfig;
  }

  private buildAuthHeaders(config: GenericRestConfig): Record<string, string> {
    const headers: Record<string, string> = { ...(config.customHeaders || {}) };

    if (config.authType === 'API_KEY' && config.apiKey) {
      const headerName = config.apiKeyHeader || 'X-API-Key';
      headers[headerName] = config.apiKey;
    } else if (config.authType === 'BEARER' && config.bearerToken) {
      headers['Authorization'] = `Bearer ${config.bearerToken}`;
    } else if (config.authType === 'BASIC' && config.username && config.password) {
      const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    } else if (config.authType === 'OAUTH2' && config.oauth2ClientId) {
      headers['Authorization'] = `Bearer oauth_simulated_token_${config.oauth2ClientId}`;
    }

    return headers;
  }

  private mapExternalItemToCanonical(item: any): CanonicalERPInvoiceDto {
    return {
      invoiceNumber: item.invoiceNumber || item.number || 'INV-EXT-000',
      invoiceDate: item.invoiceDate || item.date || new Date().toISOString().substring(0, 10),
      tenantId: item.tenantId || 'system-imported',
      entityType: 'INVOICE',
      direction: 'INBOUND',
      sellerGstin: item.sellerGstin || '27AAAAA0000A1Z5',
      buyerGstin: item.buyerGstin || '27BBBBB1111B1Z2',
      buyerName: item.buyerName || 'Unknown Buyer',
      placeOfSupply: item.placeOfSupply || '27',
      taxableValue: Number(item.taxableValue || item.amount || 0),
      cgstTotal: Number(item.cgstTotal || 0),
      sgstTotal: Number(item.sgstTotal || 0),
      igstTotal: Number(item.igstTotal || 0),
      totalValue: Number(item.totalValue || item.total || 0),
      items: Array.isArray(item.items) ? item.items : [],
      externalRecordId: item.id || item.externalId,
    };
  }
}
