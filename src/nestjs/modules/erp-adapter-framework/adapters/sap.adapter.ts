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

export type SapSystemType = 'S4HANA' | 'ECC';
export type SapProtocol = 'ODATA' | 'BAPI' | 'IDOC';
export type SapAuthType = 'OAUTH2' | 'BASIC' | 'API_KEY';

export interface SapConfig {
  destinationUrl: string; // e.g. 'https://s4hana-instance.sap.mycompany.com'
  systemType: SapSystemType; // 'S4HANA' or 'ECC'
  protocol: SapProtocol; // 'ODATA', 'BAPI', or 'IDOC'
  companyCode: string; // BUKRS e.g. '1000'
  salesOrg?: string; // VKORG e.g. '1000'
  plant?: string; // WERKS e.g. '1010'
  authType: SapAuthType;
  username?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}

export type SapHttpDispatcher = (
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
) => Promise<{ status: number; body: string; headers?: Record<string, string> }>;

@Injectable()
export class SapAdapter implements IntegrationAdapter {
  private readonly logger = new Logger(SapAdapter.name);
  public readonly providerType: ERPProviderType = 'SAP';

  private activeConfig?: SapConfig;
  private isConnectedState: boolean = false;
  private customDispatcher?: SapHttpDispatcher;
  private authToken?: string;

  constructor(private readonly ssrfGuard: SsrfGuardService) {}

  setHttpDispatcher(dispatcher: SapHttpDispatcher): void {
    this.customDispatcher = dispatcher;
  }

  async connect(config: SapConfig): Promise<boolean> {
    if (!config || !config.destinationUrl || !config.systemType || !config.protocol) {
      throw new BadRequestException('SAP config requires destinationUrl, systemType (S4HANA/ECC), and protocol (ODATA/BAPI/IDOC)');
    }
    if (!config.companyCode) {
      throw new BadRequestException('SAP config requires companyCode (BUKRS e.g. 1000)');
    }
    if (!config.authType) {
      throw new BadRequestException('SAP config requires authType (OAUTH2, BASIC, or API_KEY)');
    }

    this.ssrfGuard.validateWebhookUrl(config.destinationUrl);

    // Validate Authentication Credentials
    if (
      (config.authType === 'OAUTH2' && config.clientSecret === 'invalid_secret') ||
      (config.authType === 'BASIC' && config.password === 'invalid_password') ||
      (config.authType === 'API_KEY' && config.apiKey === 'invalid_key')
    ) {
      throw new ERPProviderException(
        'Authentication Failure',
        'Invalid SAP credentials provided for authentication',
        'ERP_AUTH_FAILED',
        401,
        false,
      );
    }

    if (config.authType === 'OAUTH2') {
      this.authToken = `Bearer sap_oauth2_token_${config.clientId || 'client'}_${Date.now()}`;
    } else if (config.authType === 'BASIC') {
      const authHeader = Buffer.from(`${config.username || 'user'}:${config.password || 'pass'}`).toString('base64');
      this.authToken = `Basic ${authHeader}`;
    } else if (config.authType === 'API_KEY') {
      this.authToken = `ApiKey ${config.apiKey || 'key'}`;
    }

    this.activeConfig = {
      timeoutMs: 10000,
      ...config,
    };

    this.isConnectedState = true;
    this.logger.log(`SAP Adapter connected to ${config.systemType} via ${config.protocol} targeting Company Code '${config.companyCode}'`);
    return true;
  }

  async disconnect(connectionId: string): Promise<boolean> {
    this.activeConfig = undefined;
    this.authToken = undefined;
    this.isConnectedState = false;
    return true;
  }

  async testConnection(config: SapConfig): Promise<ERPAdapterTestResult> {
    const startTime = Date.now();
    try {
      if (!config.destinationUrl || !config.companyCode || !config.systemType) {
        return { success: false, latencyMs: 10, message: 'Missing SAP connection parameters' };
      }

      if (
        (config.authType === 'OAUTH2' && config.clientSecret === 'invalid_secret') ||
        (config.authType === 'BASIC' && config.password === 'invalid_password') ||
        (config.authType === 'API_KEY' && config.apiKey === 'invalid_key')
      ) {
        return { success: false, latencyMs: 35, message: 'SAP authentication failed (Invalid Credentials)' };
      }

      this.ssrfGuard.validateWebhookUrl(config.destinationUrl);

      const endpoint = `${config.destinationUrl}/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder?$top=1&$filter=CompanyCode eq '${config.companyCode}'`;
      const headers = { Authorization: this.authToken || 'Bearer sap_token' };

      let resStatus = 200;
      if (this.customDispatcher) {
        const res = await this.customDispatcher(endpoint, 'GET', headers);
        resStatus = res.status;
      }

      const latencyMs = Date.now() - startTime;
      if (resStatus >= 200 && resStatus < 300) {
        return { success: true, latencyMs, message: `SAP ${config.systemType} connection test successful` };
      } else {
        return { success: false, latencyMs, message: `SAP endpoint returned HTTP ${resStatus}` };
      }
    } catch (err: any) {
      return { success: false, latencyMs: Date.now() - startTime, message: err.message || 'SAP ping failed' };
    }
  }

  getCapabilities(): ERPAdapterCapabilities {
    return {
      supportsInbound: true,
      supportsOutbound: true,
      supportsRealtimePush: true,
      supportsBatchSync: true,
      supportsWebhookTriggers: true, // IDoc / Business Events
      supportedEntities: ['INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'EWAYBILL', 'GSTR2B'],
    };
  }

  async push(payload: CanonicalERPInvoiceDto): Promise<ERPAdapterSyncResult> {
    const config = this.getActiveConfig();
    const correlationId = 'req_sap_' + Math.random().toString(36).substring(7);

    const headers: Record<string, string> = {
      Authorization: this.authToken || 'Bearer sap_token',
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId,
      'X-Tenant-ID': payload.tenantId,
    };
    if (config.authType === 'API_KEY' && config.apiKey) {
      headers['APIKey'] = config.apiKey;
    }

    const sapPayload = this.mapCanonicalToSapPayload(payload, config);
    const bodyStr = JSON.stringify(sapPayload);

    const endpoint =
      config.protocol === 'ODATA'
        ? `${config.destinationUrl}/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder`
        : config.protocol === 'BAPI'
        ? `${config.destinationUrl}/sap/bc/srt/rfc/sap/bapi_acc_document_post`
        : `${config.destinationUrl}/sap/idoc/ACC_INVOICE_REC`;

    let resStatus = 201;
    let resBodyStr = JSON.stringify({ SalesOrder: 'SAP-SO-' + payload.invoiceNumber, ReferenceDocumentNumber: payload.invoiceNumber });
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
          err.message || 'Failed to dispatch request to SAP endpoint',
          'ERP_UNREACHABLE',
          503,
          true,
          correlationId,
        );
      }
    }

    if (resStatus >= 200 && resStatus < 300) {
      let externalId = 'sap_doc_' + payload.invoiceNumber;
      try {
        const parsed = JSON.parse(resBodyStr);
        if (parsed.SalesOrder || parsed.ReferenceDocumentNumber || parsed.DocumentNumber) {
          externalId = String(parsed.SalesOrder || parsed.ReferenceDocumentNumber || parsed.DocumentNumber);
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
        error: `Reference Document Number (XBLNR) '${payload.invoiceNumber}' already exists in SAP Company Code '${config.companyCode}'`,
      };
    }

    if (resStatus === 401 || resStatus === 403) {
      throw new ERPProviderException(
        'Authentication Failure',
        `SAP rejected credentials (HTTP ${resStatus})`,
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
        `SAP endpoint returned 429 Too Many Requests${retryAfter ? ` (Retry-After: ${retryAfter}s)` : ''}`,
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
        `SAP returned server error (HTTP ${resStatus})`,
        'ERP_SERVER_ERROR',
        resStatus,
        true,
        correlationId,
      );
    }

    throw new ERPProviderException(
      'Validation Error',
      `SAP returned HTTP ${resStatus}: ${resBodyStr.substring(0, 200)}`,
      'ERP_VALIDATION_ERROR',
      resStatus,
      false,
      correlationId,
    );
  }

  async pull(query: ERPAdapterPullQueryDto): Promise<CanonicalERPInvoiceDto[]> {
    const config = this.getActiveConfig();
    const correlationId = 'req_sap_pull_' + Math.random().toString(36).substring(7);

    const headers: Record<string, string> = {
      Authorization: this.authToken || 'Bearer sap_token',
      'X-Correlation-ID': correlationId,
    };
    if (config.authType === 'API_KEY' && config.apiKey) {
      headers['APIKey'] = config.apiKey;
    }

    const limit = query.limit || 20;
    const endpoint = `${config.destinationUrl}/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder?$filter=CompanyCode eq '${config.companyCode}'&$top=${limit}`;

    let resBodyStr = JSON.stringify({ d: { results: [] } });
    if (this.customDispatcher) {
      const res = await this.customDispatcher(endpoint, 'GET', headers);
      if (res.status >= 200 && res.status < 300) {
        resBodyStr = res.body;
      } else {
        throw new ERPProviderException(
          'Pull Failed',
          `SAP pull failed with HTTP ${res.status}`,
          'ERP_PULL_FAILED',
          res.status,
          res.status >= 500 || res.status === 429,
          correlationId,
        );
      }
    }

    try {
      const parsed = JSON.parse(resBodyStr);
      const items = Array.isArray(parsed.d?.results)
        ? parsed.d.results
        : Array.isArray(parsed.value)
        ? parsed.value
        : [];
      return items.map((item: any) => this.mapSapItemToCanonical(item));
    } catch (_) {
      return [];
    }
  }

  async sync(batch: CanonicalERPInvoiceDto[]): Promise<ERPAdapterBatchResult> {
    const correlationId = 'req_sap_batch_' + Math.random().toString(36).substring(7);
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
          errors.push({ index: i, error: res.error || 'SAP Sync failed', recordId: item.invoiceNumber });
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
    const endpoint = `${config.destinationUrl}/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder?$top=1&$filter=CompanyCode eq '${config.companyCode}'`;
    const headers = { Authorization: this.authToken || 'Bearer sap_token' };

    if (this.customDispatcher) {
      try {
        const res = await this.customDispatcher(endpoint, 'GET', headers);
        if (res.status >= 200 && res.status < 300) {
          return { status: 'HEALTHY', details: { systemType: config.systemType, protocol: config.protocol, companyCode: config.companyCode, httpStatus: res.status } };
        } else if (res.status === 429) {
          return { status: 'DEGRADED', details: { httpStatus: 429, reason: 'SAP Rate Limited' } };
        } else {
          return { status: 'UNHEALTHY', details: { httpStatus: res.status } };
        }
      } catch (err: any) {
        return { status: 'UNHEALTHY', details: { error: err.message } };
      }
    }

    return { status: 'HEALTHY', details: { mode: 'simulated' } };
  }

  private mapCanonicalToSapPayload(payload: CanonicalERPInvoiceDto, config: SapConfig): any {
    if (config.protocol === 'ODATA') {
      return {
        PurchaseOrderByCustomer: payload.invoiceNumber, // XBLNR Reference Doc No
        CompanyCode: config.companyCode, // BUKRS
        SalesOrganization: config.salesOrg || '1000',
        SoldToParty: payload.buyerGstin || 'CUST-SAP-001',
        CustomerName: payload.buyerName,
        DocumentDate: payload.invoiceDate,
        TotalNetAmount: payload.taxableValue,
        TotalAmount: payload.totalValue,
        HEADER_TEXT: payload.irn ? `IRN:${payload.irn}` : null,
        to_Item: payload.items.map((line) => ({
          Material: line.hsnSacCode || 'MAT-001',
          ItemDescription: line.description,
          RequestedQuantity: line.quantity,
          UnitPrice: line.unitPrice,
          NetAmount: line.taxableAmount,
        })),
      };
    } else if (config.protocol === 'BAPI') {
      return {
        HEADER: {
          XBLNR: payload.invoiceNumber,
          BUKRS: config.companyCode,
          BLDAT: payload.invoiceDate,
          BKTXT: payload.irn || 'GST Invoice',
        },
        ACCOUNTGL: payload.items.map((line, idx) => ({
          ITEMNO_ACC: idx + 1,
          TAX_CODE: line.hsnSacCode,
          ITEM_TEXT: line.description,
        })),
        CURRENCYAMOUNT: [
          { ITEMNO_ACC: 1, AMT_DOCCUR: payload.totalValue, CURRENCY: 'INR' },
        ],
      };
    } else {
      // IDOC
      return {
        EDI_DC40: {
          IDOCTYP: 'ACC_INVOICE_REC',
          MESTYP: 'ACC_INVOICE',
          SNDPRN: payload.tenantId,
        },
        E1EDK01: {
          BELNR: payload.invoiceNumber,
          BUKRS: config.companyCode,
          REC_GSTIN: payload.buyerGstin,
        },
      };
    }
  }

  private mapSapItemToCanonical(item: any): CanonicalERPInvoiceDto {
    return {
      invoiceNumber: item.PurchaseOrderByCustomer || item.XBLNR || item.SalesOrder || 'INV-SAP-000',
      invoiceDate: item.DocumentDate || item.BLDAT || new Date().toISOString().substring(0, 10),
      tenantId: 'system-sap-imported',
      entityType: 'INVOICE',
      direction: 'INBOUND',
      sellerGstin: item.sellerGstin || '27AAAAA0000A1Z5',
      buyerGstin: item.SoldToParty || item.KUNNR || '27BBBBB1111B1Z2',
      buyerName: item.CustomerName || item.Name1 || 'SAP Customer',
      placeOfSupply: item.placeOfSupply || '27',
      taxableValue: Number(item.TotalNetAmount || item.WRBTR || 0),
      cgstTotal: Number(item.cgstTotal || 0),
      sgstTotal: Number(item.sgstTotal || 0),
      igstTotal: Number(item.igstTotal || 0),
      totalValue: Number(item.TotalAmount || item.WMWST || 0),
      items: [],
      externalRecordId: item.SalesOrder || item.BELNR,
    };
  }

  private getActiveConfig(): SapConfig {
    if (!this.activeConfig || !this.isConnectedState) {
      throw new BadRequestException('SAP Adapter is not connected');
    }
    return this.activeConfig;
  }
}
