import 'dotenv/config';
import { PrismaService } from '../common/services/prisma.service';
import { CryptoService } from '../common/services/crypto.service';
import { ImmutableAuditService } from '../modules/audit/immutable-audit.service';
import { TaxEngineService } from '../modules/tax-engine/tax-engine.service';
import { MappingEngineService } from '../modules/integration/mapping-engine.service';
import { ValidationEngineService } from '../modules/integration/validation-engine.service';
import { TaxComparisonService } from '../modules/integration/tax-comparison.service';
import { SyncEngineService } from '../modules/integration/sync-engine.service';
import { WebhookIngestionService } from '../modules/integration/webhook-ingestion.service';
import { IntegrationProvider, SyncRunStatus, IntegrationErrorCategory } from '@prisma/client';
import Decimal from 'decimal.js';
import * as crypto from 'crypto';

let passedCount = 0;
let totalCount = 0;

function assert(condition: boolean, title: string) {
  totalCount++;
  if (condition) {
    console.log(`✅ PASS: ${title}`);
    passedCount++;
  } else {
    console.error(`❌ FAIL: ${title}`);
    process.exitCode = 1;
  }
}

async function runStage9VerificationSuite() {
  console.log('===================================================================');
  console.log('STAGE 9: ERP & EXTERNAL INTEGRATION PLATFORM TEST SUITE');
  console.log('===================================================================\n');

  const prisma = new PrismaService();
  const cryptoService = new CryptoService();

  // In-Memory Database Repositories
  const mockTenants: any[] = [];
  const mockIntegrations: any[] = [];
  const mockMappingConfigs: any[] = [];
  const mockSyncRunLogs: any[] = [];
  const mockImportedRecords: any[] = [];
  const mockIntegrationErrors: any[] = [];
  const mockImmutableAuditLogs: any[] = [];
  const mockSalesInvoices: any[] = [];

  // Wire Prisma Mock Handlers
  prisma.tenant.create = (async (args: any) => {
    const rec = { ...args.data };
    mockTenants.push(rec);
    return rec;
  }) as any;

  prisma.erpIntegration.create = (async (args: any) => {
    const rec = {
      id: `int-${Date.now()}-${Math.random()}`,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...args.data,
    };
    mockIntegrations.push(rec);
    return rec;
  }) as any;

  prisma.erpIntegration.findFirst = (async (args: any) => {
    const found = mockIntegrations.find((i) => {
      if (args.where.id && i.id !== args.where.id) return false;
      if (args.where.tenantId && i.tenantId !== args.where.tenantId) return false;
      if (args.where.isActive !== undefined && i.isActive !== args.where.isActive) return false;
      return true;
    });
    if (!found) return null;
    const mappingConfigs = mockMappingConfigs.filter((m) => m.integrationId === found.id);
    return { ...found, mappingConfigs };
  }) as any;

  prisma.erpIntegration.update = (async (args: any) => {
    const found = mockIntegrations.find((i) => i.id === args.where.id);
    if (!found) throw new Error('Integration not found');
    Object.assign(found, args.data);
    found.updatedAt = new Date();
    return found;
  }) as any;

  prisma.integrationMappingConfig.create = (async (args: any) => {
    const rec = { id: `map-${Date.now()}-${Math.random()}`, createdAt: new Date(), ...args.data };
    mockMappingConfigs.push(rec);
    return rec;
  }) as any;

  prisma.syncRunLog.create = (async (args: any) => {
    const rec = {
      id: `sync-${Date.now()}-${Math.random()}`,
      recordsReceived: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      recordsFailed: 0,
      startedAt: new Date(),
      ...args.data,
    };
    mockSyncRunLogs.push(rec);
    return rec;
  }) as any;

  prisma.syncRunLog.update = (async (args: any) => {
    const log = mockSyncRunLogs.find((s) => s.id === args.where.id);
    if (!log) throw new Error('Sync run log not found');
    Object.assign(log, args.data);
    return log;
  }) as any;

  prisma.importedTransactionRecord.create = (async (args: any) => {
    const rec = {
      id: `imp-${Date.now()}-${Math.random()}`,
      importTimestamp: new Date(),
      ...args.data,
    };
    mockImportedRecords.push(rec);
    return rec;
  }) as any;

  prisma.importedTransactionRecord.findFirst = (async (args: any) => {
    return (
      mockImportedRecords.find((r) => {
        if (args.where.tenantId && r.tenantId !== args.where.tenantId) return false;
        if (args.where.integrationId && r.integrationId !== args.where.integrationId) return false;
        if (args.where.externalDocumentId && r.externalDocumentId !== args.where.externalDocumentId) return false;
        if (args.where.documentType && r.documentType !== args.where.documentType) return false;
        return true;
      }) || null
    );
  }) as any;

  prisma.importedTransactionRecord.update = (async (args: any) => {
    const rec = mockImportedRecords.find((r) => r.id === args.where.id);
    if (!rec) throw new Error('Imported record not found');
    Object.assign(rec, args.data);
    return rec;
  }) as any;

  prisma.integrationErrorLog.create = (async (args: any) => {
    const rec = { id: `err-${Date.now()}-${Math.random()}`, createdAt: new Date(), ...args.data };
    mockIntegrationErrors.push(rec);
    return rec;
  }) as any;

  prisma.immutableAuditLog.create = (async (args: any) => {
    const rec = { id: `aud-${Date.now()}-${Math.random()}`, createdAt: new Date(), ...args.data };
    mockImmutableAuditLogs.push(rec);
    return rec;
  }) as any;

  prisma.immutableAuditLog.findFirst = (async (args: any) => {
    const filtered = mockImmutableAuditLogs.filter((a) => a.tenantId === args.where.tenantId);
    if (args.orderBy?.createdAt === 'desc') {
      return filtered.length > 0 ? filtered[filtered.length - 1] : null;
    }
    return filtered[0] || null;
  }) as any;

  prisma.salesInvoice.findFirst = (async (args: any) => {
    return mockSalesInvoices.find((i) => i.id === args.where.id && i.tenantId === args.where.tenantId) || null;
  }) as any;

  prisma.hsnSacMaster.findFirst = (async (args: any) => {
    return {
      code: args.where.code || '998311',
      description: 'Consulting Services',
      igstRate: new Decimal('18.00'),
      cgstRate: new Decimal('9.00'),
      sgstRate: new Decimal('9.00'),
      cessRate: new Decimal('0.00'),
    };
  }) as any;

  // Instantiate Services
  const auditService = new ImmutableAuditService(prisma);
  const taxEngine = new TaxEngineService(prisma);
  const mappingEngine = new MappingEngineService();
  const validationEngine = new ValidationEngineService();
  const taxComparisonService = new TaxComparisonService(taxEngine);
  const syncEngine = new SyncEngineService(
    prisma,
    cryptoService,
    auditService,
    mappingEngine,
    validationEngine,
    taxComparisonService,
  );
  const webhookService = new WebhookIngestionService(prisma, cryptoService, auditService);

  const tenantAId = 'tenant-corp-alpha-uuid';
  const tenantBId = 'tenant-corp-beta-uuid';

  console.log('--- 1. CREDENTIAL SECURITY & TENANT ISOLATION TESTS ---');

  // Test 1: Create Integration with AES-256-GCM Encrypted Credentials
  const integrationA = await syncEngine.createIntegration({
    tenantId: tenantAId,
    provider: IntegrationProvider.GENERIC_REST,
    name: 'SAP S/4HANA Finance Connector',
    apiEndpoint: 'https://sap.corp-alpha.in/api/v1/invoices',
    credentials: { clientId: 'sap_client_999', clientSecret: 'super_secret_sap_token_123' },
    webhookSecret: 'wh_secret_alpha_key_555',
  });

  assert(integrationA.encryptedCredentials.includes(':'), 'ERP credentials encrypted with AES-256-GCM (IV:Tag:Ciphertext)');
  assert(!integrationA.encryptedCredentials.includes('super_secret_sap_token_123'), 'Plaintext credentials zeroized from database storage');

  // Test 2: Tenant Isolation Guard (Tenant B cannot access Tenant A integration)
  let tenantIsoCaught = false;
  try {
    await syncEngine.executeSync({
      tenantId: tenantBId, // Tenant B trying to access Tenant A integration
      integrationId: integrationA.id,
      correlationId: 'corr-attack-001',
    });
  } catch (err: any) {
    tenantIsoCaught = err.message.includes('tenant scope mismatch');
  }
  assert(tenantIsoCaught, 'Cross-tenant integration access blocked (ForbiddenException)');

  console.log('\n--- 2. CANONICAL MAPPING & DATA VALIDATION TESTS ---');

  // Test 3: Canonical Mapping Engine
  const rawErpPayload = {
    DocId: 'SAP-INV-2026-9001',
    DocNo: 'SAP-INV-9001',
    DocType: 'SALES_INVOICE',
    DocDate: '2026-09-30',
    CompanyId: 'comp-alpha-123',
    GstinId: 'gstin-27AAAAA0000A1Z5',
    CustomerCode: 'CUST-MAH-001',
    CustomerName: 'Reliance Retail Ltd',
    CustomerGSTIN: '27AAACR5532R1Z1',
    PlaceOfSupply: 'MAHARASHTRA',
    TotalTaxable: 100000,
    TotalTax: 18000,
    InvoiceTotal: 118000,
    Items: [
      { HSN: '998311', ItemDesc: 'GST Software Consulting Services', Qty: 1, Price: 100000, TaxableAmount: 100000, CGST: 9000, SGST: 9000 },
    ],
  };

  const canonical = mappingEngine.mapToCanonical(rawErpPayload, {}, 'SAP');
  assert(canonical.externalDocumentId === 'SAP-INV-2026-9001', 'Mapped external document ID correctly');
  assert(canonical.placeOfSupplyStateCode === '27', 'Normalized state name MAHARASHTRA to 2-digit code 27');
  assert(canonical.lineItems.length === 1, 'Mapped line items array correctly');

  // Test 4: Validation Engine & Error Classification
  const invalidPayload: any = {
    externalDocumentId: 'INV-BAD-001',
    documentNumber: 'INV-BAD-001',
    documentDate: 'invalid-date-string',
    companyId: 'comp-alpha-123',
    gstinId: 'gstin-123',
    partyCode: 'CUST-001',
    partyLegalName: 'Test Party',
    partyGstin: 'INVALID_GSTIN_123', // Bad GSTIN
    placeOfSupplyStateCode: '999',   // Bad state code
    lineItems: [],
    totalTaxableAmount: 100,
  };

  const valRes = validationEngine.validateCanonical(invalidPayload);
  assert(valRes.isValid === false, 'Validation Engine caught invalid ERP transaction payload');
  assert(valRes.errors.some((e) => e.errorCode === 'ERR_INVALID_PARTY_GSTIN'), 'Classified ERR_INVALID_PARTY_GSTIN validation error');
  assert(valRes.errors.some((e) => e.errorCode === 'ERR_EMPTY_LINE_ITEMS'), 'Classified ERR_EMPTY_LINE_ITEMS validation error');

  console.log('\n--- 3. TAX COMPARISON ENGINE TESTS ---');

  // Test 5: Authoritative Tax Engine Comparison & Tax Variance Tracking
  const taxCompRes = await taxComparisonService.compareTax(canonical, '27AAAAA0000A1Z5');
  assert(taxCompRes.taxflowTotalTax === 18000, 'Authoritative TaxEngine calculated ₹18,000 tax (9% CGST + 9% SGST)');
  assert(taxCompRes.taxVariance === 0, 'Tax variance is 0.00 between ERP and TaxFlow');
  assert(taxCompRes.isMatched === true, 'Tax matched boolean set to true within tolerance');

  console.log('\n--- 4. IDEMPOTENCY, REPEAT SYNC & STATUTORY LOCK TESTS ---');

  // Test 6: Sync Run Execution & Source Traceability
  const syncRun1 = await syncEngine.executeSync({
    tenantId: tenantAId,
    integrationId: integrationA.id,
    correlationId: 'corr-sync-001',
    rawPayloads: [rawErpPayload],
  });

  assert(syncRun1.status === SyncRunStatus.COMPLETED, 'Sync run state completed with 100% success');
  assert(syncRun1.recordsCreated === 1, 'Sync run recorded 1 transaction created');

  const importedRec = await prisma.importedTransactionRecord.findFirst({
    where: { tenantId: tenantAId, externalDocumentId: 'SAP-INV-2026-9001' },
  });
  assert(importedRec !== null, 'Imported transaction record persisted in database');
  assert(importedRec.sourcePayloadHash.length === 64, 'Source payload SHA-256 hash stored for audit traceability');

  // Test 7: Idempotent Re-sync (Same document payload retried)
  const syncRun2 = await syncEngine.executeSync({
    tenantId: tenantAId,
    integrationId: integrationA.id,
    correlationId: 'corr-sync-002',
    rawPayloads: [rawErpPayload], // Duplicate payload
  });

  assert(syncRun2.recordsSkipped === 1, 'Idempotent re-sync detected duplicate payload hash and skipped duplicate invoice creation');

  // Test 8: Statutory Lock Protection (ERP cannot mutate IRN / Tax Period locked invoice)
  // Simulate a statutory locked sales invoice in TaxFlow
  mockSalesInvoices.push({
    id: 'inv-statutory-locked-999',
    tenantId: tenantAId,
    invoiceNumber: 'SAP-INV-9001',
    isEInvoiceGenerated: true,
    isStatutoryLocked: true, // Statutory Lock Active
    taxPeriod: { isLocked: true },
  });

  // Link imported record to locked sales invoice
  importedRec.taxflowInvoiceId = 'inv-statutory-locked-999';

  // Modified ERP payload attempting to alter invoice value after IRN generation
  const modifiedRawErpPayload = {
    ...rawErpPayload,
    TotalTaxable: 200000, // Attempting to alter statutory taxable value
  };

  const syncRun3 = await syncEngine.executeSync({
    tenantId: tenantAId,
    integrationId: integrationA.id,
    correlationId: 'corr-sync-003',
    rawPayloads: [modifiedRawErpPayload],
  });

  assert(syncRun3.recordsFailed === 1, 'ERP attempt to alter statutory locked invoice failed and recorded error');

  const lockErr = mockIntegrationErrors.find((e) => e.errorCode === 'ERR_STATUTORY_LOCK_VIOLATION');
  assert(lockErr !== undefined, 'Recorded ERR_STATUTORY_LOCK_VIOLATION in integration error log');

  console.log('\n--- 5. WEBHOOK REPLAY PROTECTION & SIGNATURE TESTS ---');

  // Test 9: Webhook HMAC Signature Validation
  const webhookBody = JSON.stringify({ event: 'INVOICE_CREATED', docId: 'SAP-INV-WEBHOOK-101' });
  const timestamp = Date.now().toString();
  const validSignature = crypto.createHmac('sha256', 'wh_secret_alpha_key_555').update(`${timestamp}.${webhookBody}`).digest('hex');

  const webhookRes = await webhookService.processInboundWebhook({
    tenantId: tenantAId,
    integrationId: integrationA.id,
    signatureHeader: validSignature,
    timestampHeader: timestamp,
    rawBody: webhookBody,
    payload: JSON.parse(webhookBody),
    correlationId: 'corr-wh-001',
  });

  assert(webhookRes.status === 'ACCEPTED', 'Inbound webhook HMAC signature validated successfully');

  // Test 10: Webhook Replay Protection (Expired Timestamp)
  let replayCaught = false;
  try {
    const expiredTimestamp = (Date.now() - 600000).toString(); // 10 minutes ago (>300s window)
    const expiredSignature = crypto.createHmac('sha256', 'wh_secret_alpha_key_555').update(`${expiredTimestamp}.${webhookBody}`).digest('hex');

    await webhookService.processInboundWebhook({
      tenantId: tenantAId,
      integrationId: integrationA.id,
      signatureHeader: expiredSignature,
      timestampHeader: expiredTimestamp,
      rawBody: webhookBody,
      payload: JSON.parse(webhookBody),
      correlationId: 'corr-wh-replay',
    });
  } catch (err: any) {
    replayCaught = err.message.includes('timestamp expired');
  }
  assert(replayCaught, 'Expired webhook timestamp rejected (Replay protection activated)');

  console.log('\n--- 6. HIGH-VOLUME SYNTHETIC DATASET INTEGRATION TEST ---');

  // Test 11: Bulk High-Volume Processing (100 Synthetic ERP Documents)
  const bulkPayloads: any[] = [];
  for (let i = 1; i <= 100; i++) {
    bulkPayloads.push({
      DocId: `BULK-INV-2026-${1000 + i}`,
      DocNo: `BULK-${1000 + i}`,
      DocType: 'SALES',
      DocDate: '2026-09-30',
      CompanyId: 'comp-alpha-123',
      GstinId: 'gstin-27AAAAA0000A1Z5',
      CustomerCode: `CUST-${i}`,
      CustomerName: `Customer ${i} Pvt Ltd`,
      CustomerGSTIN: '27AAACR5532R1Z1',
      PlaceOfSupply: '27',
      TotalTaxable: 1000 * i,
      TotalTax: 180 * i,
      InvoiceTotal: 1180 * i,
      Items: [
        { HSN: '998311', ItemDesc: `Bulk Goods Item ${i}`, Qty: 1, Price: 1000 * i, TaxableAmount: 1000 * i, CGST: 90 * i, SGST: 90 * i },
      ],
    });
  }

  const highVolSyncRun = await syncEngine.executeSync({
    tenantId: tenantAId,
    integrationId: integrationA.id,
    correlationId: 'corr-highvol-001',
    rawPayloads: bulkPayloads,
  });

  assert(highVolSyncRun.status === SyncRunStatus.COMPLETED, 'High-volume bulk sync run completed successfully');
  assert(highVolSyncRun.recordsReceived === 100, 'Processed 100 synthetic ERP documents in single batch');
  assert(highVolSyncRun.recordsCreated === 100, 'Persisted 100 canonical transaction records without data loss');

  console.log('\n-------------------------------------------------------------------');
  console.log(`TOTAL TESTS: ${totalCount} | PASSED: ${passedCount} | FAILED: ${totalCount - passedCount}`);
  console.log('-------------------------------------------------------------------');
  if (passedCount === totalCount) {
    console.log('VERIFICATION RESULT: ALL STAGE 9 AUTOMATED TESTS PASSED 100%');
  } else {
    console.error('VERIFICATION RESULT: STAGE 9 VERIFICATION FAILED');
    process.exitCode = 1;
  }
}

runStage9VerificationSuite().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exitCode = 1;
});
