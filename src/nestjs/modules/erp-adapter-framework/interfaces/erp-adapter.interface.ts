export type ERPProviderType =
  | 'GENERIC_REST'
  | 'SFTP_FILE'
  | 'DYNAMICS_365_BC'
  | 'DYNAMICS_365_FO'
  | 'SAP_ODATA'
  | 'TALLY_PRIME';

export type ERPEntityType = 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'EWAYBILL' | 'GSTR2B';

export type SyncDirection = 'INBOUND' | 'OUTBOUND';

export interface ERPAdapterCapabilities {
  supportsInbound: boolean;
  supportsOutbound: boolean;
  supportsRealtimePush: boolean;
  supportsBatchSync: boolean;
  supportsWebhookTriggers: boolean;
  supportedEntities: ERPEntityType[];
}

export interface CanonicalERPInvoiceLineDto {
  lineNumber: number;
  description: string;
  hsnSacCode: string;
  quantity: number;
  unitPrice: number;
  taxableAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalAmount: number;
}

export interface CanonicalERPInvoiceDto {
  invoiceNumber: string;
  invoiceDate: string; // ISO 8601 YYYY-MM-DD
  dueDate?: string;
  tenantId: string;
  entityType: ERPEntityType;
  direction: SyncDirection;
  sellerGstin: string;
  buyerGstin: string;
  buyerName: string;
  placeOfSupply: string;
  taxableValue: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  totalValue: number;
  items: CanonicalERPInvoiceLineDto[];
  irn?: string;
  ewayBillNumber?: string;
  externalRecordId?: string;
  metadata?: Record<string, any>;
}

export interface ERPAdapterSyncResult {
  success: boolean;
  externalId?: string;
  status: string;
  correlationId: string;
  error?: string;
  rawResponse?: any;
}

export interface ERPAdapterBatchResult {
  success: boolean;
  totalRecords: number;
  syncedCount: number;
  failedCount: number;
  correlationId: string;
  results: ERPAdapterSyncResult[];
  errors: Array<{ index: number; error: string; recordId?: string }>;
}

export interface ERPAdapterPullQueryDto {
  startDate?: string;
  endDate?: string;
  entityType?: ERPEntityType;
  limit?: number;
  cursor?: string;
}

export interface ERPAdapterTestResult {
  success: boolean;
  latencyMs: number;
  message?: string;
  details?: any;
}

export interface ERPAdapterHealthResult {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  details?: any;
}

export interface IntegrationAdapter {
  readonly providerType: ERPProviderType;
  connect(config: any): Promise<boolean>;
  disconnect(connectionId: string): Promise<boolean>;
  testConnection(config: any): Promise<ERPAdapterTestResult>;
  getCapabilities(): ERPAdapterCapabilities;
  push(payload: CanonicalERPInvoiceDto): Promise<ERPAdapterSyncResult>;
  pull(query: ERPAdapterPullQueryDto): Promise<CanonicalERPInvoiceDto[]>;
  sync(batch: CanonicalERPInvoiceDto[]): Promise<ERPAdapterBatchResult>;
  healthCheck(): Promise<ERPAdapterHealthResult>;
}
