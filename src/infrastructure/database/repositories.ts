/**
 * Specialized Tenant-Scoped Repositories
 * Ensures all business domains (Invoices, Purchases, Sales, Recon, GSTINs, Reports, Integrations) are strictly partitioned.
 */

import { 
  TenantScopedRepository, 
  TenantScopedEntity, 
  withTenantScope, 
  withTenantWhere, 
  tenantScopedHOF, 
  WhereClause, 
  QueryOptions, 
  ScopedRepositoryClient 
} from './tenantScopedRepository';
import { TenantContext } from '../../core/tenancy/types';

// --- INVOICES REPOSITORY ---
export interface ScopedInvoice extends TenantScopedEntity {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerGstin: string;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: 'DRAFT' | 'GENERATED' | 'CANCELLED';
  irn?: string;
}

export class InvoiceRepository extends TenantScopedRepository<ScopedInvoice> {
  constructor() {
    super('Invoice');
    this.seedDefaultInvoices();
  }

  private seedDefaultInvoices() {
    // Tenant 1 Invoices (Acme Technologies)
    this.seedDirect({
      id: 'inv-t1-001',
      tenantId: 't1',
      branchId: 'br-t1-mh-01',
      invoiceNumber: 'ACM-2026-001',
      invoiceDate: '2026-09-10',
      customerName: 'Infosys Limited',
      customerGstin: '29AAACI4567M1Z2',
      taxableAmount: 1500000,
      taxAmount: 270000,
      totalAmount: 1770000,
      status: 'GENERATED',
      irn: 'irn-hash-acm-001'
    });

    this.seedDirect({
      id: 'inv-t1-002',
      tenantId: 't1',
      branchId: 'br-t1-mh-02', // Pune branch
      invoiceNumber: 'ACM-2026-002',
      invoiceDate: '2026-09-12',
      customerName: 'Tata Consultancy Services',
      customerGstin: '27AAACT8901L1Z4',
      taxableAmount: 850000,
      taxAmount: 153000,
      totalAmount: 1003000,
      status: 'GENERATED'
    });

    // Tenant 2 Invoices (Globex Manufacturing)
    this.seedDirect({
      id: 'inv-t2-001',
      tenantId: 't2',
      branchId: 'br-t2-ch-01',
      invoiceNumber: 'GLB-2026-001',
      invoiceDate: '2026-09-11',
      customerName: 'Bharat Heavy Electricals',
      customerGstin: '06AAACB1234N1Z5',
      taxableAmount: 4500000,
      taxAmount: 810000,
      totalAmount: 5310000,
      status: 'GENERATED',
      irn: 'irn-hash-glb-001'
    });
  }
}

// --- PURCHASES REPOSITORY ---
export interface ScopedPurchase extends TenantScopedEntity {
  billNumber: string;
  vendorName: string;
  vendorGstin: string;
  taxableValue: number;
  itcAvailable: number;
  status: 'PENDING' | 'RECONCILED' | 'EXCEPTION';
}

export class PurchaseRepository extends TenantScopedRepository<ScopedPurchase> {
  constructor() {
    super('Purchase');
    this.seedDirect({
      id: 'pur-t1-001',
      tenantId: 't1',
      branchId: 'br-t1-mh-01',
      billNumber: 'BILL-AWS-991',
      vendorName: 'Amazon Web Services India',
      vendorGstin: '27AAACA1234F1Z8',
      taxableValue: 350000,
      itcAvailable: 63000,
      status: 'RECONCILED'
    });
    this.seedDirect({
      id: 'pur-t2-001',
      tenantId: 't2',
      branchId: 'br-t2-ch-01',
      billNumber: 'BILL-STEL-44',
      vendorName: 'Tata Steel Industrial',
      vendorGstin: '03AAACT7788P1Z9',
      taxableValue: 2400000,
      itcAvailable: 432000,
      status: 'RECONCILED'
    });
  }
}

// --- RECONCILIATION REPOSITORY ---
export interface ScopedReconciliation extends TenantScopedEntity {
  batchId: string;
  period: string;
  matchedCount: number;
  mismatchCount: number;
  missingIn2bCount: number;
  totalTaxClaimed: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED';
}

export class ReconciliationRepository extends TenantScopedRepository<ScopedReconciliation> {
  constructor() {
    super('Reconciliation');
    this.seedDirect({
      id: 'rec-t1-2026-08',
      tenantId: 't1',
      batchId: 'BATCH-T1-AUG-2026',
      period: '2026-08',
      matchedCount: 3420,
      mismatchCount: 12,
      missingIn2bCount: 4,
      totalTaxClaimed: 4890000,
      status: 'APPROVED'
    });
    this.seedDirect({
      id: 'rec-t2-2026-08',
      tenantId: 't2',
      batchId: 'BATCH-T2-AUG-2026',
      period: '2026-08',
      matchedCount: 1240,
      mismatchCount: 8,
      missingIn2bCount: 2,
      totalTaxClaimed: 1820000,
      status: 'COMPLETED'
    });
  }
}

// --- REPORTS REPOSITORY ---
export interface ScopedReport extends TenantScopedEntity {
  reportName: string;
  reportType: 'GSTR_1_SUMMARY' | 'GSTR_3B_LIABILITY' | 'ITC_LEDGER' | 'TURNOVER_ANALYTICS';
  period: string;
  generatedBy: string;
  fileFormat: 'PDF' | 'EXCEL' | 'JSON';
  fileSizeKb: number;
}

export class ReportRepository extends TenantScopedRepository<ScopedReport> {
  constructor() {
    super('Report');
    this.seedDirect({
      id: 'rep-t1-001',
      tenantId: 't1',
      reportName: 'Acme Q1 FY26 ITC Optimization Dossier',
      reportType: 'ITC_LEDGER',
      period: '2026-Q1',
      generatedBy: 'u-fayas',
      fileFormat: 'PDF',
      fileSizeKb: 1450
    });
    this.seedDirect({
      id: 'rep-t2-001',
      tenantId: 't2',
      reportName: 'Globex Aug 2026 GSTR-3B Tax Liability',
      reportType: 'GSTR_3B_LIABILITY',
      period: '2026-08',
      generatedBy: 'u-globex-user',
      fileFormat: 'EXCEL',
      fileSizeKb: 890
    });
  }
}

// --- INTEGRATIONS REPOSITORY ---
export interface ScopedIntegration extends TenantScopedEntity {
  providerName: 'SAP_S4HANA' | 'ORACLE_NETSUITE' | 'TALLY_PRIME' | 'ZOHO_BOOKS';
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  syncDirection: 'BIDIRECTIONAL' | 'IMPORT_ONLY' | 'EXPORT_ONLY';
  apiKeyMasked: string;
  webhookUrl?: string;
  lastSyncAt: string;
}

export class IntegrationRepository extends TenantScopedRepository<ScopedIntegration> {
  constructor() {
    super('Integration');
    this.seedDirect({
      id: 'int-t1-sap',
      tenantId: 't1',
      providerName: 'SAP_S4HANA',
      connectionStatus: 'CONNECTED',
      syncDirection: 'BIDIRECTIONAL',
      apiKeyMasked: 'sap_live_sec_****_991',
      webhookUrl: 'https://api.acmetech.com/webhooks/gst-inbound',
      lastSyncAt: '2026-09-21T08:30:00.000Z'
    });
    this.seedDirect({
      id: 'int-t2-oracle',
      tenantId: 't2',
      providerName: 'ORACLE_NETSUITE',
      connectionStatus: 'CONNECTED',
      syncDirection: 'IMPORT_ONLY',
      apiKeyMasked: 'netsuite_auth_****_441',
      webhookUrl: 'https://erp.globexengg.com/gst-sync',
      lastSyncAt: '2026-09-20T17:45:00.000Z'
    });
  }
}

// --- SALE REPOSITORY ---
export interface ScopedSale extends TenantScopedEntity {
  orderNumber: string;
  customerName: string;
  customerGstin: string;
  amount: number;
  taxAmount: number;
  saleDate: string;
  status: 'PENDING' | 'DISPATCHED' | 'DELIVERED';
}

export class SaleRepository extends TenantScopedRepository<ScopedSale> {
  constructor() {
    super('Sale');
    this.seedDirect({
      id: 'sal-t1-001',
      tenantId: 't1',
      branchId: 'br-t1-mh-01',
      orderNumber: 'SO-ACM-9901',
      customerName: 'Infosys Limited',
      customerGstin: '29AAACI4567M1Z2',
      amount: 1500000,
      taxAmount: 270000,
      saleDate: '2026-09-10',
      status: 'DELIVERED'
    });
    this.seedDirect({
      id: 'sal-t2-001',
      tenantId: 't2',
      branchId: 'br-t2-ch-01',
      orderNumber: 'SO-GLB-4401',
      customerName: 'Bharat Heavy Electricals',
      customerGstin: '06AAACB1234N1Z5',
      amount: 4500000,
      taxAmount: 810000,
      saleDate: '2026-09-11',
      status: 'DELIVERED'
    });
  }
}

// --- GST RETURN REPOSITORY ---
export interface ScopedGstReturn extends TenantScopedEntity {
  returnType: 'GSTR_1' | 'GSTR_3B' | 'GSTR_9';
  period: string;
  arn?: string;
  taxLiability: number;
  status: 'DRAFT' | 'FILED' | 'PENDING_APPROVAL';
}

export class GstReturnRepository extends TenantScopedRepository<ScopedGstReturn> {
  constructor() {
    super('GstReturn');
    this.seedDirect({
      id: 'ret-t1-gstr1-08',
      tenantId: 't1',
      gstinId: 'gstin-t1-mh',
      returnType: 'GSTR_1',
      period: '2026-08',
      arn: 'ARN-ACM-GSTR1-202608-8819',
      taxLiability: 423000,
      status: 'FILED'
    });
    this.seedDirect({
      id: 'ret-t2-gstr1-08',
      tenantId: 't2',
      gstinId: 'gstin-t2-ch',
      returnType: 'GSTR_1',
      period: '2026-08',
      arn: 'ARN-GLB-GSTR1-202608-1120',
      taxLiability: 810000,
      status: 'FILED'
    });
  }
}

// --- ITC RECORD REPOSITORY ---
export interface ScopedItcRecord extends TenantScopedEntity {
  vendorGstin: string;
  vendorName: string;
  invoiceNumber: string;
  itcAvailable: number;
  itcClaimed: number;
  ruleApplied: string;
  eligibilityStatus: 'ELIGIBLE' | 'INELIGIBLE' | 'BLOCKED_17_5';
}

export class ItcRecordRepository extends TenantScopedRepository<ScopedItcRecord> {
  constructor() {
    super('ItcRecord');
    this.seedDirect({
      id: 'itc-t1-001',
      tenantId: 't1',
      gstinId: 'gstin-t1-mh',
      vendorGstin: '27AAACA1234F1Z8',
      vendorName: 'Amazon Web Services India',
      invoiceNumber: 'BILL-AWS-991',
      itcAvailable: 63000,
      itcClaimed: 63000,
      ruleApplied: 'RULE_36_4',
      eligibilityStatus: 'ELIGIBLE'
    });
    this.seedDirect({
      id: 'itc-t2-001',
      tenantId: 't2',
      gstinId: 'gstin-t2-ch',
      vendorGstin: '03AAACT7788P1Z9',
      vendorName: 'Tata Steel Industrial',
      invoiceNumber: 'BILL-STEL-44',
      itcAvailable: 432000,
      itcClaimed: 432000,
      ruleApplied: 'RULE_36_4',
      eligibilityStatus: 'ELIGIBLE'
    });
  }
}

// --- E-INVOICE REPOSITORY ---
export interface ScopedEInvoice extends TenantScopedEntity {
  invoiceNumber: string;
  irn: string;
  signedQrCode: string;
  ackNumber: string;
  ackDate: string;
  status: 'ACTIVE' | 'CANCELLED';
}

export class EInvoiceRepository extends TenantScopedRepository<ScopedEInvoice> {
  constructor() {
    super('EInvoice');
    this.seedDirect({
      id: 'einv-t1-001',
      tenantId: 't1',
      branchId: 'br-t1-mh-01',
      invoiceNumber: 'ACM-2026-001',
      irn: 'b76a91c3efd123e456789abcdef0123456789abcdef0123456789abcdef01234',
      signedQrCode: 'QR_CODE_PAYLOAD_ACM_001',
      ackNumber: '112233445566',
      ackDate: '2026-09-10T14:30:00.000Z',
      status: 'ACTIVE'
    });
    this.seedDirect({
      id: 'einv-t2-001',
      tenantId: 't2',
      branchId: 'br-t2-ch-01',
      invoiceNumber: 'GLB-2026-001',
      irn: 'c99a88b77d6655e4433221100fedcba9876543210fedcba9876543210fedcba9',
      signedQrCode: 'QR_CODE_PAYLOAD_GLB_001',
      ackNumber: '998877665544',
      ackDate: '2026-09-11T16:15:00.000Z',
      status: 'ACTIVE'
    });
  }
}

// --- E-WAY BILL REPOSITORY ---
export interface ScopedEWayBill extends TenantScopedEntity {
  ewbNumber: string;
  documentNumber: string;
  vehicleNumber: string;
  transporterId: string;
  validUpto: string;
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
}

export class EWayBillRepository extends TenantScopedRepository<ScopedEWayBill> {
  constructor() {
    super('EWayBill');
    this.seedDirect({
      id: 'ewb-t1-001',
      tenantId: 't1',
      branchId: 'br-t1-mh-01',
      ewbNumber: '241098765432',
      documentNumber: 'ACM-2026-001',
      vehicleNumber: 'MH-12-AB-1234',
      transporterId: '27AABCT9988D1Z2',
      validUpto: '2026-09-15T23:59:59.000Z',
      status: 'ACTIVE'
    });
    this.seedDirect({
      id: 'ewb-t2-001',
      tenantId: 't2',
      branchId: 'br-t2-ch-01',
      ewbNumber: '181055443322',
      documentNumber: 'GLB-2026-001',
      vehicleNumber: 'PB-65-CD-5678',
      transporterId: '04AABCG1122K1Z9',
      validUpto: '2026-09-16T23:59:59.000Z',
      status: 'ACTIVE'
    });
  }
}

// --- VENDOR RISK REPOSITORY ---
export interface ScopedVendorRisk extends TenantScopedEntity {
  vendorGstin: string;
  vendorName: string;
  riskRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  complianceScore: number;
  filingFrequency: 'REGULAR' | 'DELAYED' | 'DEFAULTER';
  twoBvsGstr3bGapPercentage: number;
}

export class VendorRiskRepository extends TenantScopedRepository<ScopedVendorRisk> {
  constructor() {
    super('VendorRisk');
    this.seedDirect({
      id: 'vr-t1-001',
      tenantId: 't1',
      vendorGstin: '27AAACA1234F1Z8',
      vendorName: 'Amazon Web Services India',
      riskRating: 'LOW',
      complianceScore: 99.4,
      filingFrequency: 'REGULAR',
      twoBvsGstr3bGapPercentage: 0.1
    });
    this.seedDirect({
      id: 'vr-t2-001',
      tenantId: 't2',
      vendorGstin: '03AAACT7788P1Z9',
      vendorName: 'Tata Steel Industrial',
      riskRating: 'LOW',
      complianceScore: 98.2,
      filingFrequency: 'REGULAR',
      twoBvsGstr3bGapPercentage: 0.4
    });
  }
}

// --- DATA EXCHANGE (IMPORTS/EXPORTS) REPOSITORY ---
export interface ScopedDataExchange extends TenantScopedEntity {
  type: 'IMPORT' | 'EXPORT';
  module: 'INVOICES' | 'PURCHASES' | 'GSTR2B' | 'EWAY_BILLS';
  fileName: string;
  rowCount: number;
  fileFormat: 'CSV' | 'XLSX' | 'JSON';
  status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED';
}

export class DataExchangeRepository extends TenantScopedRepository<ScopedDataExchange> {
  constructor() {
    super('DataExchange');
    this.seedDirect({
      id: 'dex-t1-001',
      tenantId: 't1',
      type: 'EXPORT',
      module: 'INVOICES',
      fileName: 'acme_september_sales_export.xlsx',
      rowCount: 1420,
      fileFormat: 'XLSX',
      status: 'COMPLETED'
    });
    this.seedDirect({
      id: 'dex-t2-001',
      tenantId: 't2',
      type: 'EXPORT',
      module: 'INVOICES',
      fileName: 'globex_q1_gst_export.csv',
      rowCount: 820,
      fileFormat: 'CSV',
      status: 'COMPLETED'
    });
  }
}

// --- DOCUMENT VAULT (FILES/DOCUMENTS) REPOSITORY ---
export interface ScopedDocument extends TenantScopedEntity {
  fileName: string;
  storagePath: string;
  fileSizeBytes: number;
  mimeType: string;
  category: 'INVOICE_PDF' | 'AUDIT_REPORT' | 'RECON_LOG' | 'SIGNED_JSON';
}

export class DocumentVaultRepository extends TenantScopedRepository<ScopedDocument> {
  constructor() {
    super('DocumentVault');
    this.seedDirect({
      id: 'doc-t1-001',
      tenantId: 't1',
      fileName: 'acme_einv_sept_001.pdf',
      storagePath: '/tenants/t1/invoices/acme_einv_sept_001.pdf',
      fileSizeBytes: 245000,
      mimeType: 'application/pdf',
      category: 'INVOICE_PDF'
    });
    this.seedDirect({
      id: 'doc-t2-001',
      tenantId: 't2',
      fileName: 'globex_confidential_itc_audit.pdf',
      storagePath: '/tenants/t2/reports/globex_confidential_itc_audit.pdf',
      fileSizeBytes: 890000,
      mimeType: 'application/pdf',
      category: 'AUDIT_REPORT'
    });
  }
}

// --- NOTIFICATION REPOSITORY ---
export interface ScopedNotification extends TenantScopedEntity {
  title: string;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  read: boolean;
  category: 'FILING_DEADLINE' | 'EWAY_EXPIRY' | 'ITC_MISMATCH' | 'QUOTA_WARNING';
}

export class NotificationRepository extends TenantScopedRepository<ScopedNotification> {
  constructor() {
    super('Notification');
    this.seedDirect({
      id: 'notif-t1-001',
      tenantId: 't1',
      title: 'GSTR-1 Filing Window Closing',
      message: 'Monthly return for period 2026-08 is due in 48 hours.',
      priority: 'HIGH',
      read: false,
      category: 'FILING_DEADLINE'
    });
    this.seedDirect({
      id: 'notif-t2-001',
      tenantId: 't2',
      title: 'E-Way Bill Expiring Today',
      message: 'EWB 181055443322 for vehicle PB-65-CD-5678 will expire at midnight.',
      priority: 'MEDIUM',
      read: false,
      category: 'EWAY_EXPIRY'
    });
  }
}

// --- AUTOMATION RULES REPOSITORY ---
export interface ScopedAutomationRule extends TenantScopedEntity {
  ruleName: string;
  triggerEvent: 'INVOICE_CREATED' | 'GSTR2B_DOWNLOADED' | 'EWB_EXPIRED';
  action: 'AUTO_GENERATE_IRN' | 'AUTO_RECONCILE_36_4' | 'SEND_VENDOR_NOTICE';
  isActive: boolean;
}

export class AutomationRuleRepository extends TenantScopedRepository<ScopedAutomationRule> {
  constructor() {
    super('AutomationRule');
    this.seedDirect({
      id: 'auto-t1-001',
      tenantId: 't1',
      ruleName: 'Instant Auto-IRN Generation',
      triggerEvent: 'INVOICE_CREATED',
      action: 'AUTO_GENERATE_IRN',
      isActive: true
    });
    this.seedDirect({
      id: 'auto-t2-001',
      tenantId: 't2',
      ruleName: 'Daily GSTR-2B Auto-Matching',
      triggerEvent: 'GSTR2B_DOWNLOADED',
      action: 'AUTO_RECONCILE_36_4',
      isActive: true
    });
  }
}

// --- AI DATA/RESULTS REPOSITORY ---
export interface ScopedAiResult extends TenantScopedEntity {
  modelName: string;
  taskType: 'ANOMALY_DETECTION' | 'ITC_OPTIMIZATION' | 'NOTICE_ANALYSIS';
  inputHash: string;
  resultSummary: string;
  confidenceScore: number;
}

export class AiResultRepository extends TenantScopedRepository<ScopedAiResult> {
  constructor() {
    super('AiResult');
    this.seedDirect({
      id: 'ai-t1-001',
      tenantId: 't1',
      modelName: 'gemini-1.5-pro',
      taskType: 'ITC_OPTIMIZATION',
      inputHash: 'hash_t1_itc_data_q1',
      resultSummary: 'Optimized claim order saving INR 1,42,000 across inter-state IGST ledgers.',
      confidenceScore: 0.98
    });
    this.seedDirect({
      id: 'ai-t2-001',
      tenantId: 't2',
      modelName: 'gemini-1.5-flash',
      taskType: 'ANOMALY_DETECTION',
      inputHash: 'hash_t2_sales_aug',
      resultSummary: 'Identified 2 potential circular trade anomalies under Vendor GSTIN 03AAACT7788P1Z9.',
      confidenceScore: 0.94
    });
  }
}

// --- API CREDENTIALS REPOSITORY ---
export interface ScopedApiCredential extends TenantScopedEntity {
  name: string;
  tokenPrefix: string;
  tokenHash: string;
  scopes: string[];
  expiresAt: string;
  isActive: boolean;
}

export class ApiCredentialRepository extends TenantScopedRepository<ScopedApiCredential> {
  constructor() {
    super('ApiCredential');
    this.seedDirect({
      id: 'cred-t1-001',
      tenantId: 't1',
      name: 'Production ERP Connector Key',
      tokenPrefix: 'tok-t1-prod',
      tokenHash: 'sha256_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      scopes: ['invoices:read', 'invoices:write', 'einvoice:generate'],
      expiresAt: '2027-01-01T00:00:00.000Z',
      isActive: true
    });
    this.seedDirect({
      id: 'cred-t2-001',
      tenantId: 't2',
      name: 'Globex Netsuite API Token',
      tokenPrefix: 'tok-t2-netsuite',
      tokenHash: 'sha256_ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
      scopes: ['invoices:read', 'returns:read'],
      expiresAt: '2027-01-01T00:00:00.000Z',
      isActive: true
    });
  }
}

// --- WEBHOOKS REPOSITORY ---
export interface ScopedWebhook extends TenantScopedEntity {
  name: string;
  url: string;
  secretMasked: string;
  events: string[];
  status: 'ACTIVE' | 'PAUSED' | 'FAILED';
}

export class WebhookRepository extends TenantScopedRepository<ScopedWebhook> {
  constructor() {
    super('Webhook');
    this.seedDirect({
      id: 'wh-t1-001',
      tenantId: 't1',
      name: 'Acme Inbound Webhook Endpoint',
      url: 'https://api.acmetech.com/webhooks/gst-events',
      secretMasked: 'whsec_****_acm991',
      events: ['invoice.generated', 'einvoice.ready', 'ewaybill.expired'],
      status: 'ACTIVE'
    });
    this.seedDirect({
      id: 'wh-t2-001',
      tenantId: 't2',
      name: 'Globex ERP Sync Webhook',
      url: 'https://erp.globexengg.com/webhooks/compliance',
      secretMasked: 'whsec_****_glb441',
      events: ['reconciliation.completed', 'return.filed'],
      status: 'ACTIVE'
    });
  }
}

// --- AUDIT LOG REPOSITORY ---
export interface ScopedAuditLog extends TenantScopedEntity {
  action: string;
  userId: string;
  details: string;
  ipAddress: string;
  tamperHash: string;
}

export class AuditLogRepository extends TenantScopedRepository<ScopedAuditLog> {
  constructor() {
    super('AuditLog');
    this.seedDirect({
      id: 'aud-t1-001',
      tenantId: 't1',
      action: 'RECONCILIATION_APPROVED',
      userId: 'u-fayas',
      details: 'Approved batch BATCH-T1-AUG-2026 with 3420 matched invoices.',
      ipAddress: '192.168.1.1',
      tamperHash: 'sha256_audit_t1_hash_991'
    });
    this.seedDirect({
      id: 'aud-t2-001',
      tenantId: 't2',
      action: 'INVOICE_GENERATED',
      userId: 'u-globex-user',
      details: 'Created invoice GLB-2026-001 for Bharat Heavy Electricals.',
      ipAddress: '10.0.0.4',
      tamperHash: 'sha256_audit_t2_hash_441'
    });
  }
}

// --- BACKGROUND JOB REPOSITORY ---
export interface ScopedJob extends TenantScopedEntity {
  jobType: string;
  userId: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  payloadSummary: string;
}

export class BackgroundJobRepository extends TenantScopedRepository<ScopedJob> {
  constructor() {
    super('BackgroundJob');
    this.seedDirect({
      id: 'job-t1-001',
      tenantId: 't1',
      branchId: 'br-t1-mh-01',
      jobType: 'GSTR2B_RECONCILIATION',
      userId: 'u-fayas',
      status: 'COMPLETED',
      payloadSummary: 'GSTR-2B 2026-08 matching completed.'
    });
    this.seedDirect({
      id: 'job-t2-001',
      tenantId: 't2',
      branchId: 'br-t2-ch-01',
      jobType: 'REPORT_EXPORT',
      userId: 'u-globex-user',
      status: 'COMPLETED',
      payloadSummary: 'Tax liability export completed.'
    });
  }
}

// Singleton instances
export const invoiceRepository = new InvoiceRepository();
export const purchaseRepository = new PurchaseRepository();
export const saleRepository = new SaleRepository();
export const gstReturnRepository = new GstReturnRepository();
export const reconciliationRepository = new ReconciliationRepository();
export const itcRecordRepository = new ItcRecordRepository();
export const eInvoiceRepository = new EInvoiceRepository();
export const eWayBillRepository = new EWayBillRepository();
export const vendorRiskRepository = new VendorRiskRepository();
export const reportRepository = new ReportRepository();
export const dataExchangeRepository = new DataExchangeRepository();
export const documentVaultRepository = new DocumentVaultRepository();
export const notificationRepository = new NotificationRepository();
export const automationRuleRepository = new AutomationRuleRepository();
export const aiResultRepository = new AiResultRepository();
export const integrationRepository = new IntegrationRepository();
export const apiCredentialRepository = new ApiCredentialRepository();
export const webhookRepository = new WebhookRepository();
export const auditLogRepository = new AuditLogRepository();
export const backgroundJobRepository = new BackgroundJobRepository();

// Re-export HOF helpers and interfaces
export { withTenantScope, withTenantWhere, tenantScopedHOF };
export type { ScopedRepositoryClient, WhereClause, QueryOptions };

/**
 * Universal Tenant Database Client Factory (HOF-powered)
 * Automatically binds all domain repositories to the caller's TenantContext.
 * Any query executed on these repositories has `where: { tenantId: ctx.tenantId }`
 * injected automatically without manual intervention in business logic.
 */
export function createTenantDatabaseClient(ctx: TenantContext) {
  return {
    invoices: withTenantScope(ctx, invoiceRepository),
    purchases: withTenantScope(ctx, purchaseRepository),
    sales: withTenantScope(ctx, saleRepository),
    gstReturns: withTenantScope(ctx, gstReturnRepository),
    reconciliations: withTenantScope(ctx, reconciliationRepository),
    itcRecords: withTenantScope(ctx, itcRecordRepository),
    eInvoices: withTenantScope(ctx, eInvoiceRepository),
    eWayBills: withTenantScope(ctx, eWayBillRepository),
    vendorRisks: withTenantScope(ctx, vendorRiskRepository),
    reports: withTenantScope(ctx, reportRepository),
    dataExchanges: withTenantScope(ctx, dataExchangeRepository),
    documents: withTenantScope(ctx, documentVaultRepository),
    notifications: withTenantScope(ctx, notificationRepository),
    automationRules: withTenantScope(ctx, automationRuleRepository),
    aiResults: withTenantScope(ctx, aiResultRepository),
    integrations: withTenantScope(ctx, integrationRepository),
    apiCredentials: withTenantScope(ctx, apiCredentialRepository),
    webhooks: withTenantScope(ctx, webhookRepository),
    auditLogs: withTenantScope(ctx, auditLogRepository),
    backgroundJobs: withTenantScope(ctx, backgroundJobRepository)
  };
}

