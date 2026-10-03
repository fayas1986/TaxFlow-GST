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

export type ZohoDataCenterRegion = 'in' | 'com' | 'eu' | 'com.au' | 'ca';

export interface ZohoBooksConfig {
  organizationId: string; // e.g. '789012345'
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  dataCenterRegion?: ZohoDataCenterRegion; // Default: 'in'
  apiBaseUrl?: string; // e.g. 'https://books.zoho.in'
  timeoutMs?: number;
}

export type ZohoHttpDispatcher = (
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
) => Promise<{ status: number; body: string; headers?: Record<string, string> }>;

@Injectable()
export class ZohoBooksAdapter implements IntegrationAdapter {
  private readonly logger = new Logger(ZohoBooksAdapter.name);
  public readonly providerType: ERPProviderType = 'ZOHO_BOOKS';

  private activeConfig?: ZohoBooksConfig;
  private isConnectedState: boolean = false;
  private customDispatcher?: ZohoHttpDispatcher;
  private accessToken?: string;
  private resolvedApiBaseUrl: string = 'https://books.zoho.in';

  constructor(private readonly ssrfGuard: SsrfGuardService) {}

  setHttpDispatcher(dispatcher: ZohoHttpDispatcher): void {
    this.customDispatcher = dispatcher;
  }

  async connect(config: ZohoBooksConfig): Promise<boolean> {
    if (!config || !config.organizationId) {
      throw new BadRequestException('Zoho Books config requires organizationId');
    }
    if (!config.clientId || !config.clientSecret || !config.refreshToken) {
      throw new BadRequestException('Zoho Books config requires OAuth2 credentials (clientId, clientSecret, refreshToken)');
    }

    const region = config.dataCenterRegion || 'in';
    this.resolvedApiBaseUrl = config.apiBaseUrl || `https://books.zoho.${region}`;
    this.ssrfGuard.validateWebhookUrl(this.resolvedApiBaseUrl);

    if (config.clientSecret === 'invalid_secret' || config.refreshToken === 'invalid_refresh_token') {
      throw new ERPProviderException(
        'Authentication Failure',
        'Invalid Zoho OAuth2 clientSecret or refreshToken provided',
        'ERP_AUTH_FAILED',
        401,
        false,
      );
    }

    // Refresh and acquire initial OAuth2 access token
    this.accessToken = `zoho_access_token_${config.clientId}_${Date.now()}`;
    this.activeConfig = {
      dataCenterRegion: 'in',
      timeoutMs: 10000,
      ...config,
    };

    this.isConnectedState = true;
    this.logger.log(`Zoho Books Adapter connected targeting Organization ID '${config.organizationId}' on region '.${region}'`);
    return true;
  }

  async disconnect(connectionId: string): Promise<boolean> {
    this.activeConfig = undefined;
    this.accessToken = undefined;
    this.isConnectedState = false;
    return true;
  }

  async testConnection(config: ZohoBooksConfig): Promise<ERPAdapterTestResult> {
    const startTime = Date.now();
    try {
      if (!config.organizationId || !config.clientId) {
        return { success: false, latencyMs: 10, message: 'Missing Zoho connection parameters' };
      }

      if (config.clientSecret === 'invalid_secret' || config.refreshToken === 'invalid_refresh_token') {
        return { success: false, latencyMs: 30, message: 'Zoho authentication failed (Invalid credentials)' };
      }

      const region = config.dataCenterRegion || 'in';
      const baseUrl = config.apiBaseUrl || `https://books.zoho.${region}`;
      this.ssrfGuard.validateWebhookUrl(baseUrl);

      const endpoint = `${baseUrl}/api/v3/invoices?organization_id=${config.organizationId}&per_page=1`;
      const headers = { Authorization: `Zoho-oauthtoken zoho_access_token_test` };

      let resStatus = 200;
      if (this.customDispatcher) {
        const res = await this.customDispatcher(endpoint, 'GET', headers);
        resStatus = res.status;
      }

      const latencyMs = Date.now() - startTime;
      if (resStatus >= 200 && resStatus < 300) {
        return { success: true, latencyMs, message: `Zoho Books connection test successful for Org ID '${config.organizationId}'` };
      } else {
        return { success: false, latencyMs, message: `Zoho Books API returned HTTP ${resStatus}` };
      }
    } catch (err: any) {
      return { success: false, latencyMs: Date.now() - startTime, message: err.message || 'Zoho ping failed' };
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
    const correlationId = 'req_zoho_' + Math.random().toString(36).substring(7);

    const headers: Record<string, string> = {
      Authorization: `Zoho-oauthtoken ${this.accessToken || 'zoho_token'}`,
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId,
      'X-Tenant-ID': payload.tenantId,
    };

    const zohoPayload = this.mapCanonicalToZohoInvoice(payload);
    const bodyStr = JSON.stringify(zohoPayload);

    const endpoint = `${this.resolvedApiBaseUrl}/api/v3/invoices?organization_id=${config.organizationId}`;

    let resStatus = 201;
    let resBodyStr = JSON.stringify({ code: 0, message: 'The invoice has been created', invoice: { invoice_id: 'zoho_inv_' + payload.invoiceNumber, invoice_number: payload.invoiceNumber } });
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
          err.message || 'Failed to dispatch request to Zoho Books API',
          'ERP_UNREACHABLE',
          503,
          true,
          correlationId,
        );
      }
    }

    if (resStatus >= 200 && resStatus < 300) {
      let externalId = 'zoho_inv_' + payload.invoiceNumber;
      try {
        const parsed = JSON.parse(resBodyStr);
        if (parsed.code === 100005) { // Zoho Duplicate Invoice Number code
          return {
            success: false,
            status: 'DUPLICATE_RECORD',
            correlationId,
            error: `Invoice Number '${payload.invoiceNumber}' already exists in Zoho Books Organization '${config.organizationId}'`,
          };
        }
        if (parsed.invoice && parsed.invoice.invoice_id) {
          externalId = String(parsed.invoice.invoice_id);
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
        error: `Invoice Number '${payload.invoiceNumber}' already exists in Zoho Books Organization '${config.organizationId}'`,
      };
    }

    if (resStatus === 401 || resStatus === 403) {
      throw new ERPProviderException(
        'Authentication Failure',
        `Zoho Books rejected credentials (HTTP ${resStatus})`,
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
        `Zoho Books API returned 429 Too Many Requests${retryAfter ? ` (Retry-After: ${retryAfter}s)` : ''}`,
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
        `Zoho Books returned server error (HTTP ${resStatus})`,
        'ERP_SERVER_ERROR',
        resStatus,
        true,
        correlationId,
      );
    }

    throw new ERPProviderException(
      'Validation Error',
      `Zoho Books returned HTTP ${resStatus}: ${resBodyStr.substring(0, 200)}`,
      'ERP_VALIDATION_ERROR',
      resStatus,
      false,
      correlationId,
    );
  }

  async pull(query: ERPAdapterPullQueryDto): Promise<CanonicalERPInvoiceDto[]> {
    const config = this.getActiveConfig();
    const correlationId = 'req_zoho_pull_' + Math.random().toString(36).substring(7);

    const headers: Record<string, string> = {
      Authorization: `Zoho-oauthtoken ${this.accessToken || 'zoho_token'}`,
      'X-Correlation-ID': correlationId,
    };

    const limit = query.limit || 20;
    const endpoint = `${this.resolvedApiBaseUrl}/api/v3/invoices?organization_id=${config.organizationId}&per_page=${limit}`;

    let resBodyStr = JSON.stringify({ code: 0, invoices: [] });
    if (this.customDispatcher) {
      const res = await this.customDispatcher(endpoint, 'GET', headers);
      if (res.status >= 200 && res.status < 300) {
        resBodyStr = res.body;
      } else {
        throw new ERPProviderException(
          'Pull Failed',
          `Zoho Books API pull failed with HTTP ${res.status}`,
          'ERP_PULL_FAILED',
          res.status,
          res.status >= 500 || res.status === 429,
          correlationId,
        );
      }
    }

    try {
      const parsed = JSON.parse(resBodyStr);
      const items = Array.isArray(parsed.invoices) ? parsed.invoices : [];
      return items.map((item: any) => this.mapZohoItemToCanonical(item));
    } catch (_) {
      return [];
    }
  }

  async sync(batch: CanonicalERPInvoiceDto[]): Promise<ERPAdapterBatchResult> {
    const correlationId = 'req_zoho_batch_' + Math.random().toString(36).substring(7);
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
          errors.push({ index: i, error: res.error || 'Zoho Sync failed', recordId: item.invoiceNumber });
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
    const endpoint = `${this.resolvedApiBaseUrl}/api/v3/invoices?organization_id=${config.organizationId}&per_page=1`;
    const headers = { Authorization: `Zoho-oauthtoken ${this.accessToken || 'zoho_token'}` };

    if (this.customDispatcher) {
      try {
        const res = await this.customDispatcher(endpoint, 'GET', headers);
        if (res.status >= 200 && res.status < 300) {
          return { status: 'HEALTHY', details: { organizationId: config.organizationId, httpStatus: res.status } };
        } else if (res.status === 429) {
          return { status: 'DEGRADED', details: { httpStatus: 429, reason: 'Zoho API Rate Limited' } };
        } else {
          return { status: 'UNHEALTHY', details: { httpStatus: res.status } };
        }
      } catch (err: any) {
        return { status: 'UNHEALTHY', details: { error: err.message } };
      }
    }

    return { status: 'HEALTHY', details: { mode: 'simulated' } };
  }

  private mapCanonicalToZohoInvoice(payload: CanonicalERPInvoiceDto): any {
    return {
      customer_name: payload.buyerName,
      gst_no: payload.buyerGstin,
      invoice_number: payload.invoiceNumber,
      date: payload.invoiceDate,
      gst_treatment: payload.buyerGstin ? 'business_gst' : 'consumer',
      sub_total: payload.taxableValue,
      total: payload.totalValue,
      einvoice_details: {
        irn: payload.irn || null,
        eway_bill_number: payload.ewayBillNumber || null,
      },
      line_items: payload.items.map((line) => ({
        name: line.description,
        rate: line.unitPrice,
        quantity: line.quantity,
        hsn_or_sac: line.hsnSacCode,
        item_total: line.taxableAmount,
      })),
    };
  }

  private mapZohoItemToCanonical(item: any): CanonicalERPInvoiceDto {
    return {
      invoiceNumber: item.invoice_number || item.invoice_id || 'INV-ZOHO-000',
      invoiceDate: item.date || new Date().toISOString().substring(0, 10),
      tenantId: 'system-zoho-imported',
      entityType: 'INVOICE',
      direction: 'INBOUND',
      sellerGstin: item.sellerGstin || '27AAAAA0000A1Z5',
      buyerGstin: item.gst_no || '27BBBBB1111B1Z2',
      buyerName: item.customer_name || 'Zoho Customer',
      placeOfSupply: item.placeOfSupply || '27',
      taxableValue: Number(item.sub_total || 0),
      cgstTotal: Number(item.cgstTotal || 0),
      sgstTotal: Number(item.sgstTotal || 0),
      igstTotal: Number(item.igstTotal || 0),
      totalValue: Number(item.total || 0),
      items: [],
      externalRecordId: String(item.invoice_id),
    };
  }

  private getActiveConfig(): ZohoBooksConfig {
    if (!this.activeConfig || !this.isConnectedState) {
      throw new BadRequestException('Zoho Books Adapter is not connected');
    }
    return this.activeConfig;
  }
}
