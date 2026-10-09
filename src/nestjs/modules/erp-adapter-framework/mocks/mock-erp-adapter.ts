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

export class MockErpAdapter implements IntegrationAdapter {
  public readonly providerType: ERPProviderType;

  public isConnected: boolean = false;
  public simulateConnectFailure: boolean = false;
  public simulateCredentialError: boolean = false;
  public simulateTimeout: boolean = false;
  public simulateRateLimit: boolean = false;
  public simulate5xxError: boolean = false;
  public simulateDuplicateRecord: boolean = false;
  public simulatePartialBatchFailure: boolean = false;

  public pushCount: number = 0;

  private externalDatabase = new Map<string, CanonicalERPInvoiceDto>();

  constructor(
    providerType: ERPProviderType = 'GENERIC_REST',
    private capabilities: ERPAdapterCapabilities = {
      supportsInbound: true,
      supportsOutbound: true,
      supportsRealtimePush: true,
      supportsBatchSync: true,
      supportsWebhookTriggers: true,
      supportedEntities: ['INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'EWAYBILL', 'GSTR2B'],
    },
  ) {
    this.providerType = providerType;
  }

  async connect(config: any): Promise<boolean> {
    if (this.simulateCredentialError || (config && config.apiKey === 'invalid_key')) {
      throw new ERPProviderException(
        'Authentication Failure',
        'Invalid ERP API key or OAuth credentials provided',
        'ERP_AUTH_FAILED',
        401,
        false,
      );
    }
    if (this.simulateConnectFailure) {
      this.isConnected = false;
      return false;
    }
    this.isConnected = true;
    return true;
  }

  async disconnect(connectionId: string): Promise<boolean> {
    this.isConnected = false;
    return true;
  }

  async testConnection(config: any): Promise<ERPAdapterTestResult> {
    if (this.simulateCredentialError || (config && config.apiKey === 'invalid_key')) {
      return {
        success: false,
        latencyMs: 120,
        message: 'Authentication failed: Invalid credentials',
      };
    }
    if (this.simulateTimeout) {
      throw new ERPProviderException(
        'Connection Timeout',
        'External ERP gateway failed to respond within 10,000ms',
        'ERP_TIMEOUT',
        504,
        true,
      );
    }
    return {
      success: true,
      latencyMs: 45,
      message: 'Connection test successful',
    };
  }

  getCapabilities(): ERPAdapterCapabilities {
    return this.capabilities;
  }

  setCapabilities(caps: ERPAdapterCapabilities): void {
    this.capabilities = caps;
  }

  async push(payload: CanonicalERPInvoiceDto): Promise<ERPAdapterSyncResult> {
    this.pushCount++;
    const correlationId = 'req_mock_' + Math.random().toString(36).substring(7);

    if (this.simulateTimeout) {
      throw new ERPProviderException(
        'Provider Timeout',
        'External ERP system timed out during invoice push',
        'ERP_TIMEOUT',
        504,
        true,
        correlationId,
      );
    }

    if (this.simulateRateLimit) {
      throw new ERPProviderException(
        'Rate Limit Exceeded',
        'External ERP provider returned 429 Too Many Requests',
        'ERP_RATE_LIMITED',
        429,
        true,
        correlationId,
      );
    }

    if (this.simulate5xxError) {
      throw new ERPProviderException(
        'ERP Internal Error',
        'External ERP endpoint returned HTTP 500 Internal Server Error',
        'ERP_SERVER_ERROR',
        500,
        true,
        correlationId,
      );
    }

    const invKey = payload?.invoiceNumber || payload?.externalRecordId || correlationId;
    if (this.simulateDuplicateRecord || (invKey && this.externalDatabase.has(invKey))) {
      return {
        success: false,
        status: 'DUPLICATE_RECORD',
        correlationId,
        error: `Invoice number '${invKey}' already exists in target ERP`,
      };
    }

    const externalId = 'ext_inv_' + Math.random().toString(36).substring(7);
    this.externalDatabase.set(invKey, { ...payload, externalRecordId: externalId });

    return {
      success: true,
      externalId,
      status: 'POSTED',
      correlationId,
    };
  }

  async pull(query: ERPAdapterPullQueryDto): Promise<CanonicalERPInvoiceDto[]> {
    return Array.from(this.externalDatabase.values());
  }

  async sync(batch: CanonicalERPInvoiceDto[]): Promise<ERPAdapterBatchResult> {
    const correlationId = 'req_batch_' + Math.random().toString(36).substring(7);
    const results: ERPAdapterSyncResult[] = [];
    const errors: Array<{ index: number; error: string; recordId?: string }> = [];

    let syncedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < batch.length; i++) {
      const record = batch[i];

      if (this.simulatePartialBatchFailure && i === 1) {
        // Fail middle item
        failedCount++;
        errors.push({ index: i, error: `Invalid HSN code for item ${record.invoiceNumber}`, recordId: record.invoiceNumber });
        results.push({
          success: false,
          status: 'FAILED',
          correlationId,
          error: `Invalid HSN code for item ${record.invoiceNumber}`,
        });
      } else {
        const res = await this.push(record).catch((err: any) => ({
          success: false,
          status: 'FAILED',
          correlationId,
          error: err.message,
        }));

        if (res.success) {
          syncedCount++;
        } else {
          failedCount++;
          errors.push({ index: i, error: res.error || 'Sync failed', recordId: record.invoiceNumber });
        }
        results.push(res);
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
    if (this.simulate5xxError || !this.isConnected) {
      return { status: 'UNHEALTHY', details: { reason: 'Adapter disconnected or ERP 500 error' } };
    }
    if (this.simulateRateLimit) {
      return { status: 'DEGRADED', details: { reason: 'External ERP rate limited (429)' } };
    }
    return { status: 'HEALTHY', details: { latencyMs: 25 } };
  }
}
