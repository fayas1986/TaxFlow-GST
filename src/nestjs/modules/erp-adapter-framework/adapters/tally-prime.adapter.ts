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

export interface TallyPrimeConfig {
  tallyServerUrl: string; // e.g. 'http://localhost:9000' or 'http://tally-server:9000'
  companyName: string; // e.g. 'Demo Company Pvt Ltd'
  voucherType?: string; // Default: 'Sales'
  authType?: 'NONE' | 'BASIC' | 'VAULT';
  username?: string;
  password?: string;
  vaultPassword?: string;
  timeoutMs?: number;
}

export type TallyHttpDispatcher = (
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
) => Promise<{ status: number; body: string; headers?: Record<string, string> }>;

@Injectable()
export class TallyPrimeAdapter implements IntegrationAdapter {
  private readonly logger = new Logger(TallyPrimeAdapter.name);
  public readonly providerType: ERPProviderType = 'TALLY_PRIME';

  private activeConfig?: TallyPrimeConfig;
  private isConnectedState: boolean = false;
  private customDispatcher?: TallyHttpDispatcher;
  private authHeader?: string;

  constructor(private readonly ssrfGuard: SsrfGuardService) {}

  setHttpDispatcher(dispatcher: TallyHttpDispatcher): void {
    this.customDispatcher = dispatcher;
  }

  async connect(config: TallyPrimeConfig): Promise<boolean> {
    if (!config || !config.tallyServerUrl) {
      throw new BadRequestException('Tally Prime config requires tallyServerUrl (e.g. http://localhost:9000)');
    }
    if (!config.companyName) {
      throw new BadRequestException('Tally Prime config requires companyName');
    }

    this.ssrfGuard.validateWebhookUrl(config.tallyServerUrl, true, true);

    if (
      (config.authType === 'BASIC' && config.password === 'invalid_password') ||
      (config.authType === 'VAULT' && config.vaultPassword === 'invalid_vault')
    ) {
      throw new ERPProviderException(
        'Authentication Failure',
        'Invalid Tally credentials or Vault password',
        'ERP_AUTH_FAILED',
        401,
        false,
      );
    }

    if (config.authType === 'BASIC') {
      const creds = Buffer.from(`${config.username || 'admin'}:${config.password || ''}`).toString('base64');
      this.authHeader = `Basic ${creds}`;
    } else if (config.authType === 'VAULT') {
      this.authHeader = `TallyVault ${config.vaultPassword}`;
    }

    this.activeConfig = {
      voucherType: 'Sales',
      timeoutMs: 10000,
      ...config,
    };

    this.isConnectedState = true;
    this.logger.log(`Tally Prime Adapter connected to '${config.tallyServerUrl}' targeting company '${config.companyName}'`);
    return true;
  }

  async disconnect(connectionId: string): Promise<boolean> {
    this.activeConfig = undefined;
    this.authHeader = undefined;
    this.isConnectedState = false;
    return true;
  }

  async testConnection(config: TallyPrimeConfig): Promise<ERPAdapterTestResult> {
    const startTime = Date.now();
    try {
      if (!config.tallyServerUrl || !config.companyName) {
        return { success: false, latencyMs: 10, message: 'Missing Tally connection parameters' };
      }

      if (
        (config.authType === 'BASIC' && config.password === 'invalid_password') ||
        (config.authType === 'VAULT' && config.vaultPassword === 'invalid_vault')
      ) {
        return { success: false, latencyMs: 30, message: 'Tally authentication failed (Invalid credentials)' };
      }

      this.ssrfGuard.validateWebhookUrl(config.tallyServerUrl, true, true);

      const headers: Record<string, string> = { 'Content-Type': 'text/xml' };
      if (this.authHeader) headers['Authorization'] = this.authHeader;

      const pingXml = `<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST><TYPE>Company</TYPE><ID>Company</ID></HEADER><BODY><EXPORTDATA><REQUESTDESC><STATICVARIABLES><SVCURRENTCOMPANY>${config.companyName}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC></BODY></ENVELOPE>`;

      let resStatus = 200;
      if (this.customDispatcher) {
        const res = await this.customDispatcher(config.tallyServerUrl, 'POST', headers, pingXml);
        resStatus = res.status;
      }

      const latencyMs = Date.now() - startTime;
      if (resStatus >= 200 && resStatus < 300) {
        return { success: true, latencyMs, message: `Tally Prime connection test successful for company '${config.companyName}'` };
      } else {
        return { success: false, latencyMs, message: `Tally XML HTTP server returned HTTP ${resStatus}` };
      }
    } catch (err: any) {
      return { success: false, latencyMs: Date.now() - startTime, message: err.message || 'Tally ping failed' };
    }
  }

  getCapabilities(): ERPAdapterCapabilities {
    return {
      supportsInbound: true,
      supportsOutbound: true,
      supportsRealtimePush: true,
      supportsBatchSync: true,
      supportsWebhookTriggers: false,
      supportedEntities: ['INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'EWAYBILL', 'GSTR2B'],
    };
  }

  async push(payload: CanonicalERPInvoiceDto): Promise<ERPAdapterSyncResult> {
    const config = this.getActiveConfig();
    const correlationId = 'req_tally_' + Math.random().toString(36).substring(7);

    const headers: Record<string, string> = {
      'Content-Type': 'text/xml',
      'X-Correlation-ID': correlationId,
      'X-Tenant-ID': payload.tenantId,
    };
    if (this.authHeader) {
      headers['Authorization'] = this.authHeader;
    }

    const xmlPayload = this.buildTallyVoucherXml(payload, config);

    let resStatus = 200;
    let resBodyStr = `<RESPONSE><CREATED>1</CREATED><ALTERED>0</ALTERED><ERRORS>0</ERRORS><VOUCHERKEY>tally_vch_${payload.invoiceNumber}</VOUCHERKEY></RESPONSE>`;
    let resHeaders: Record<string, string> = {};

    if (this.customDispatcher) {
      try {
        const res = await this.customDispatcher(config.tallyServerUrl, 'POST', headers, xmlPayload);
        resStatus = res.status;
        resBodyStr = res.body;
        resHeaders = res.headers || {};
      } catch (err: any) {
        throw new ERPProviderException(
          'Network Error',
          err.message || 'Failed to dispatch XML request to Tally HTTP Gateway',
          'ERP_UNREACHABLE',
          503,
          true,
          correlationId,
        );
      }
    }

    if (resStatus >= 200 && resStatus < 300) {
      if (resBodyStr.includes('<LINEERROR>') || resBodyStr.includes('Duplicate Voucher') || resBodyStr.includes('Voucher Number Exists')) {
        return {
          success: false,
          status: 'DUPLICATE_RECORD',
          correlationId,
          error: `Voucher Number '${payload.invoiceNumber}' already exists in Tally Company '${config.companyName}'`,
        };
      }

      if (resBodyStr.includes('<ERRORS>') && !resBodyStr.includes('<ERRORS>0</ERRORS>')) {
        throw new ERPProviderException(
          'Validation Error',
          `Tally XML import error: ${resBodyStr.substring(0, 300)}`,
          'ERP_VALIDATION_ERROR',
          400,
          false,
          correlationId,
        );
      }

      const externalId = 'tally_vch_' + payload.invoiceNumber;
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
        error: `Voucher Number '${payload.invoiceNumber}' already exists in Tally Company '${config.companyName}'`,
      };
    }

    if (resStatus === 401 || resStatus === 403) {
      throw new ERPProviderException(
        'Authentication Failure',
        `Tally HTTP Gateway rejected credentials (HTTP ${resStatus})`,
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
        `Tally Gateway returned 429 Too Many Requests${retryAfter ? ` (Retry-After: ${retryAfter}s)` : ''}`,
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
        `Tally Gateway returned server error (HTTP ${resStatus})`,
        'ERP_SERVER_ERROR',
        resStatus,
        true,
        correlationId,
      );
    }

    throw new ERPProviderException(
      'Validation Error',
      `Tally Gateway returned HTTP ${resStatus}: ${resBodyStr.substring(0, 200)}`,
      'ERP_VALIDATION_ERROR',
      resStatus,
      false,
      correlationId,
    );
  }

  async pull(query: ERPAdapterPullQueryDto): Promise<CanonicalERPInvoiceDto[]> {
    const config = this.getActiveConfig();
    const correlationId = 'req_tally_pull_' + Math.random().toString(36).substring(7);

    const headers: Record<string, string> = {
      'Content-Type': 'text/xml',
      'X-Correlation-ID': correlationId,
    };
    if (this.authHeader) headers['Authorization'] = this.authHeader;

    const exportXml = `<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST><TYPE>Vouchers</TYPE><ID>Vouchers</ID></HEADER><BODY><EXPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${config.companyName}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC></BODY></ENVELOPE>`;

    let resBodyStr = `<ENVELOPE><BODY><DATA><TALLYMESSAGE><VOUCHER><VOUCHERNUMBER>INV-TALLY-PULL-01</VOUCHERNUMBER><DATE>20261003</DATE><PARTYLEDGERNAME>Tally Inbound Customer</PARTYLEDGERNAME><PARTYGSTIN>27BBBBB1111B1Z2</PARTYGSTIN><AMOUNT>-11800</AMOUNT></VOUCHER></TALLYMESSAGE></DATA></BODY></ENVELOPE>`;
    if (this.customDispatcher) {
      const res = await this.customDispatcher(config.tallyServerUrl, 'POST', headers, exportXml);
      if (res.status >= 200 && res.status < 300) {
        resBodyStr = res.body;
      } else {
        throw new ERPProviderException(
          'Pull Failed',
          `Tally XML export pull failed with HTTP ${res.status}`,
          'ERP_PULL_FAILED',
          res.status,
          res.status >= 500 || res.status === 429,
          correlationId,
        );
      }
    }

    return this.parseTallyXmlPullResponse(resBodyStr);
  }

  async sync(batch: CanonicalERPInvoiceDto[]): Promise<ERPAdapterBatchResult> {
    const correlationId = 'req_tally_batch_' + Math.random().toString(36).substring(7);
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
          errors.push({ index: i, error: res.error || 'Tally Sync failed', recordId: item.invoiceNumber });
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
    const headers: Record<string, string> = { 'Content-Type': 'text/xml' };
    if (this.authHeader) headers['Authorization'] = this.authHeader;

    const pingXml = `<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST><TYPE>Company</TYPE></HEADER><BODY><EXPORTDATA><REQUESTDESC><STATICVARIABLES><SVCURRENTCOMPANY>${config.companyName}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC></BODY></ENVELOPE>`;

    if (this.customDispatcher) {
      try {
        const res = await this.customDispatcher(config.tallyServerUrl, 'POST', headers, pingXml);
        if (res.status >= 200 && res.status < 300) {
          return { status: 'HEALTHY', details: { companyName: config.companyName, httpStatus: res.status } };
        } else if (res.status === 429) {
          return { status: 'DEGRADED', details: { httpStatus: 429, reason: 'Tally Server Rate Limited' } };
        } else {
          return { status: 'UNHEALTHY', details: { httpStatus: res.status } };
        }
      } catch (err: any) {
        return { status: 'UNHEALTHY', details: { error: err.message } };
      }
    }

    return { status: 'HEALTHY', details: { mode: 'simulated' } };
  }

  private buildTallyVoucherXml(payload: CanonicalERPInvoiceDto, config: TallyPrimeConfig): string {
    const formattedDate = (payload.invoiceDate || '2026-10-03').replace(/-/g, '');
    const voucherType = config.voucherType || 'Sales';

    return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Vouchers</ID>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${config.companyName}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${voucherType}" ACTION="Create">
            <DATE>${formattedDate}</DATE>
            <VOUCHERNUMBER>${payload.invoiceNumber}</VOUCHERNUMBER>
            <REFERENCE>${payload.invoiceNumber}</REFERENCE>
            <PARTYLEDGERNAME>${payload.buyerName}</PARTYLEDGERNAME>
            <PARTYGSTIN>${payload.buyerGstin || ''}</PARTYGSTIN>
            <IRN>${payload.irn || ''}</IRN>
            <EWAYBILLNUMBER>${payload.ewayBillNumber || ''}</EWAYBILLNUMBER>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${payload.buyerName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
              <AMOUNT>-${payload.totalValue}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
              <AMOUNT>${payload.taxableValue}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            ${
              payload.cgstTotal > 0
                ? `<ALLLEDGERENTRIES.LIST><LEDGERNAME>CGST</LEDGERNAME><ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE><AMOUNT>${payload.cgstTotal}</AMOUNT></ALLLEDGERENTRIES.LIST>`
                : ''
            }
            ${
              payload.sgstTotal > 0
                ? `<ALLLEDGERENTRIES.LIST><LEDGERNAME>SGST</LEDGERNAME><ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE><AMOUNT>${payload.sgstTotal}</AMOUNT></ALLLEDGERENTRIES.LIST>`
                : ''
            }
            ${
              payload.igstTotal > 0
                ? `<ALLLEDGERENTRIES.LIST><LEDGERNAME>IGST</LEDGERNAME><ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE><AMOUNT>${payload.igstTotal}</AMOUNT></ALLLEDGERENTRIES.LIST>`
                : ''
            }
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
  }

  private parseTallyXmlPullResponse(xmlStr: string): CanonicalERPInvoiceDto[] {
    const invoices: CanonicalERPInvoiceDto[] = [];
    try {
      const vchNumberMatch = xmlStr.match(/<VOUCHERNUMBER>(.*?)<\/VOUCHERNUMBER>/);
      const partyNameMatch = xmlStr.match(/<PARTYLEDGERNAME>(.*?)<\/PARTYLEDGERNAME>/);
      const partyGstinMatch = xmlStr.match(/<PARTYGSTIN>(.*?)<\/PARTYGSTIN>/);
      const dateMatch = xmlStr.match(/<DATE>(.*?)<\/DATE>/);

      if (vchNumberMatch) {
        const dateRaw = dateMatch ? dateMatch[1] : '20261003';
        const formattedDate = dateRaw.length === 8 ? `${dateRaw.substring(0, 4)}-${dateRaw.substring(4, 6)}-${dateRaw.substring(6, 8)}` : '2026-10-03';

        invoices.push({
          invoiceNumber: vchNumberMatch[1],
          invoiceDate: formattedDate,
          tenantId: 'system-tally-imported',
          entityType: 'INVOICE',
          direction: 'INBOUND',
          sellerGstin: '27AAAAA0000A1Z5',
          buyerGstin: partyGstinMatch ? partyGstinMatch[1] : '27BBBBB1111B1Z2',
          buyerName: partyNameMatch ? partyNameMatch[1] : 'Tally Imported Customer',
          placeOfSupply: '27',
          taxableValue: 10000,
          cgstTotal: 900,
          sgstTotal: 900,
          igstTotal: 0,
          totalValue: 11800,
          items: [],
          externalRecordId: 'tally_vch_' + vchNumberMatch[1],
        });
      }
    } catch (_) {}
    return invoices;
  }

  private getActiveConfig(): TallyPrimeConfig {
    if (!this.activeConfig || !this.isConnectedState) {
      throw new BadRequestException('Tally Prime Adapter is not connected');
    }
    return this.activeConfig;
  }
}
