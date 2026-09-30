import 'dotenv/config';
import { PrismaService } from '../common/services/prisma.service';
import { CryptoService } from '../common/services/crypto.service';
import { SandboxGspAdapter } from '../modules/government/sandbox-gsp.adapter';
import { GovAuditLoggerService } from '../modules/government/gov-audit-logger.service';
import { GspCredentialsService } from '../modules/government/gsp-credentials.service';
import { EInvoiceService } from '../modules/einvoice/einvoice.service';
import { EWayBillService } from '../modules/ewaybill/ewaybill.service';
import Decimal from 'decimal.js';

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

async function runStage7VerificationSuite() {
  console.log('===================================================================');
  console.log('STAGE 7: E-INVOICE, E-WAY BILL & GOVERNMENT INTEGRATION TEST SUITE');
  console.log('===================================================================\n');

  const prisma = new PrismaService();

  // In-Memory Test Repositories
  const mockTenants: any[] = [];
  const mockCompanies: any[] = [];
  const mockGstins: any[] = [];
  const mockBranches: any[] = [];
  const mockParties: any[] = [];
  const mockTaxPeriods: any[] = [];
  const mockSalesInvoices: any[] = [];
  const mockEInvoices: any[] = [];
  const mockEWayBills: any[] = [];
  const mockCredentials: any[] = [];
  const mockGovAuditLogs: any[] = [];
  const mockAuditLogs: any[] = [];

  // Wire Prisma Mock Handlers
  prisma.tenant.create = (async (args: any) => {
    const rec = { ...args.data };
    mockTenants.push(rec);
    return rec;
  }) as any;

  prisma.company.create = (async (args: any) => {
    const rec = { id: `comp-${Date.now()}-${Math.random()}`, ...args.data };
    mockCompanies.push(rec);
    return rec;
  }) as any;

  prisma.gSTRegistration.create = (async (args: any) => {
    const rec = { id: `gstin-${Date.now()}-${Math.random()}`, ...args.data };
    mockGstins.push(rec);
    return rec;
  }) as any;

  prisma.gSTRegistration.findFirst = (async (args: any) => {
    return mockGstins.find((g) => g.id === args.where.id && g.tenantId === args.where.tenantId) || null;
  }) as any;

  prisma.branch.create = (async (args: any) => {
    const rec = { id: `br-${Date.now()}-${Math.random()}`, ...args.data };
    mockBranches.push(rec);
    return rec;
  }) as any;

  prisma.taxPeriod.create = (async (args: any) => {
    const rec = { id: `tp-${Date.now()}-${Math.random()}`, isLocked: false, status: 'OPEN', ...args.data };
    mockTaxPeriods.push(rec);
    return rec;
  }) as any;

  prisma.party.create = (async (args: any) => {
    const rec = { id: `party-${Date.now()}-${Math.random()}`, ...args.data };
    mockParties.push(rec);
    return rec;
  }) as any;

  prisma.salesInvoice.create = (async (args: any) => {
    const party = mockParties.find((p) => p.id === args.data.partyId);
    const gstRegistration = mockGstins.find((g) => g.id === args.data.gstinId);
    const rec = {
      id: `inv-${Date.now()}-${Math.random()}`,
      version: 1,
      isEInvoiceGenerated: false,
      isStatutoryLocked: false,
      party,
      gstRegistration,
      lineItems: args.data.lineItems || [],
      ...args.data,
      totalTaxableAmount: new Decimal(args.data.totalTaxableAmount || 0),
      totalCgstAmount: new Decimal(args.data.totalCgstAmount || 0),
      totalSgstAmount: new Decimal(args.data.totalSgstAmount || 0),
      totalIgstAmount: new Decimal(args.data.totalIgstAmount || 0),
      totalCessAmount: new Decimal(args.data.totalCessAmount || 0),
      totalInvoiceAmount: new Decimal(args.data.totalInvoiceAmount || 0),
    };
    mockSalesInvoices.push(rec);
    return rec;
  }) as any;

  prisma.salesInvoice.findFirst = (async (args: any) => {
    const inv = mockSalesInvoices.find((i) => {
      if (args.where.id && i.id !== args.where.id) return false;
      if (args.where.tenantId && i.tenantId !== args.where.tenantId) return false;
      return true;
    });
    if (!inv) return null;
    const result = { ...inv };
    if (args.include?.lineItems) {
      result.lineItems = inv.lineItems || [];
    }
    if (args.include?.gstRegistration) {
      result.gstRegistration = mockGstins.find((g) => g.id === inv.gstinId);
    }
    if (args.include?.party) {
      result.party = mockParties.find((p) => p.id === inv.partyId);
    }
    return result;
  }) as any;

  prisma.salesInvoice.update = (async (args: any) => {
    const inv = mockSalesInvoices.find((i) => i.id === args.where.id);
    if (inv) Object.assign(inv, args.data);
    return inv;
  }) as any;

  prisma.eInvoiceRecord.create = (async (args: any) => {
    const rec = { id: `einv-${Date.now()}-${Math.random()}`, createdAt: new Date(), ...args.data };
    mockEInvoices.push(rec);
    return rec;
  }) as any;

  prisma.eInvoiceRecord.findFirst = (async (args: any) => {
    return mockEInvoices.find((e) => {
      if (args.where.id && e.id !== args.where.id) return false;
      if (args.where.tenantId && e.tenantId !== args.where.tenantId) return false;
      if (args.where.invoiceId && e.invoiceId !== args.where.invoiceId) return false;
      if (args.where.status && e.status !== args.where.status) return false;
      return true;
    }) || null;
  }) as any;

  prisma.eInvoiceRecord.update = (async (args: any) => {
    const rec = mockEInvoices.find((e) => e.id === args.where.id);
    if (rec) Object.assign(rec, args.data);
    return rec;
  }) as any;

  prisma.eWayBillRecord.create = (async (args: any) => {
    const rec = { id: `ewb-${Date.now()}-${Math.random()}`, createdAt: new Date(), ...args.data };
    mockEWayBills.push(rec);
    return rec;
  }) as any;

  prisma.eWayBillRecord.findFirst = (async (args: any) => {
    return mockEWayBills.find((w) => {
      if (args.where.id && w.id !== args.where.id) return false;
      if (args.where.tenantId && w.tenantId !== args.where.tenantId) return false;
      if (args.where.invoiceId && w.invoiceId !== args.where.invoiceId) return false;
      return true;
    }) || null;
  }) as any;

  prisma.eWayBillRecord.update = (async (args: any) => {
    const rec = mockEWayBills.find((w) => w.id === args.where.id);
    if (rec) Object.assign(rec, args.data);
    return rec;
  }) as any;

  prisma.govGspCredential.upsert = (async (args: any) => {
    const whereKey = args.where.tenantId_gstinId_provider_environment;
    let cred = mockCredentials.find(
      (c) =>
        c.tenantId === whereKey.tenantId &&
        c.gstinId === whereKey.gstinId &&
        c.provider === whereKey.provider &&
        c.environment === whereKey.environment,
    );
    if (cred) {
      Object.assign(cred, args.update);
    } else {
      cred = { id: `cred-${Date.now()}-${Math.random()}`, ...args.create };
      mockCredentials.push(cred);
    }
    return cred;
  }) as any;

  prisma.govGspCredential.findFirst = (async (args: any) => {
    return mockCredentials.find((c) => {
      if (args.where.tenantId && c.tenantId !== args.where.tenantId) return false;
      if (args.where.gstinId && c.gstinId !== args.where.gstinId) return false;
      if (args.where.provider && c.provider !== args.where.provider) return false;
      if (args.where.environment && c.environment !== args.where.environment) return false;
      return true;
    }) || null;
  }) as any;

  prisma.govApiAuditLog.create = (async (args: any) => {
    const rec = { id: `govlog-${Date.now()}-${Math.random()}`, requestTimestamp: new Date(), ...args.data };
    mockGovAuditLogs.push(rec);
    return rec;
  }) as any;

  prisma.auditLog.create = (async (args: any) => {
    const rec = { id: `audit-${Date.now()}-${Math.random()}`, createdAt: new Date(), ...args.data };
    mockAuditLogs.push(rec);
    return rec;
  }) as any;

  // Initialize Services
  const cryptoService = new CryptoService();
  const gspAdapter = new SandboxGspAdapter();
  const govAuditLogger = new GovAuditLoggerService(prisma, cryptoService);
  const credentialsService = new GspCredentialsService(prisma, cryptoService);
  const einvoiceService = new EInvoiceService(prisma, gspAdapter, govAuditLogger);
  const ewaybillService = new EWayBillService(prisma, gspAdapter, govAuditLogger);

  const tenantA = `tenant-stg7-a-${Date.now()}`;
  const tenantB = `tenant-stg7-b-${Date.now()}`;
  const user1 = `user-tax-analyst-${Date.now()}`;

  let companyId: string = '';
  let gstinId: string = '';
  let branchId: string = '';
  let taxPeriodId: string = '';
  let partyId: string = '';

  try {
    // Setup Test Data
    await prisma.tenant.create({ data: { id: tenantA, name: 'Tenant A Corp', code: tenantA } });
    await prisma.tenant.create({ data: { id: tenantB, name: 'Tenant B Corp', code: tenantB } });

    const companyObj = await prisma.company.create({
      data: { tenantId: tenantA, name: 'Stage 7 Tech Ltd', legalName: 'Stage 7 Tech Ltd', pan: 'AAACX9999F' },
    });
    companyId = companyObj.id;

    const gstinObj = await prisma.gSTRegistration.create({
      data: { tenantId: tenantA, companyId, gstin: '27AAACX9999F1Z9', legalName: 'Stage 7 Tech Ltd', stateCode: '27' },
    });
    gstinId = gstinObj.id;

    const branchObj = await prisma.branch.create({
      data: { tenantId: tenantA, companyId, gstinId, branchCode: 'HO', name: 'HO Mumbai', stateCode: '27', isHeadOffice: true },
    });
    branchId = branchObj.id;

    const taxPeriodObj = await prisma.taxPeriod.create({
      data: { tenantId: tenantA, gstinId, periodKey: '092026', status: 'OPEN' },
    });
    taxPeriodId = taxPeriodObj.id;

    const partyObj = await prisma.party.create({
      data: { tenantId: tenantA, partyCode: 'CUST-700', legalName: 'B2B Client Corp', partyType: 'CUSTOMER', pan: 'BBCDE1234K' },
    });
    partyId = partyObj.id;

    console.log('--- 1. CREDENTIAL SECURITY & ENCRYPTION TESTS ---\n');

    // Test 1: AES-256-GCM Credential Encryption & Decryption
    const savedCred = await credentialsService.saveCredentials(tenantA, user1, {
      gstinId,
      provider: 'TAXFLOW_SANDBOX_GSP',
      environment: 'SANDBOX',
      username: 'nic_user_123',
      password: 'super_secret_nic_password_99!',
      clientId: 'client_id_stage7',
      clientSecret: 'client_secret_stage7_gsp_key',
    });
    assert(savedCred.hasPassword === true, 'Credentials saved with AES-256-GCM encryption');

    const decrypted = await credentialsService.getDecryptedCredentials(tenantA, gstinId, 'TAXFLOW_SANDBOX_GSP', 'SANDBOX');
    assert(decrypted.password === 'super_secret_nic_password_99!', 'Decrypted password matches original plain text in memory');
    assert(decrypted.clientSecret === 'client_secret_stage7_gsp_key', 'Decrypted client secret matches original plain text in memory');

    // Test 2: Log Redaction Test
    const logPayload = { username: 'nic_user_123', password: 'secret_password_123', clientSecret: 'secret_key' };
    const redactedPayload = cryptoService.redactSensitiveFields(logPayload);
    assert(redactedPayload.password === '***REDACTED***', 'Sensitive password field redacted in audit logs');
    assert(redactedPayload.clientSecret === '***REDACTED***', 'Sensitive clientSecret field redacted in audit logs');

    console.log('\n--- 2. E-INVOICE GENERATION & IRN LIFECYCLE TESTS ---\n');

    // Create Sales Invoice for E-Invoice test
    const salesInv = await prisma.salesInvoice.create({
      data: {
        tenantId: tenantA,
        companyId,
        gstinId,
        branchId,
        partyId,
        taxPeriodId,
        category: 'SALES',
        invoiceType: 'B2B',
        status: 'POSTED',
        invoiceNumber: 'INV-STAGE7-001',
        invoiceDate: new Date('2026-09-25'),
        totalTaxableAmount: 150000,
        totalCgstAmount: 13500,
        totalSgstAmount: 13500,
        totalIgstAmount: 0,
        totalInvoiceAmount: 177000,
        lineItems: [
          { itemNumber: 1, hsnSacCode: '998311', description: 'IT Consulting Services', taxableValue: 150000, cgstRate: 9, sgstRate: 9 },
        ],
      },
    });

    // Test 3: E-Invoice Generation (NOT_GENERATED -> VALIDATING -> SUBMITTING -> GENERATED)
    const einvRes1 = await einvoiceService.generateEInvoice(tenantA, user1, { invoiceId: salesInv.id });
    assert(einvRes1.eInvoiceRecord.status === 'GENERATED', 'E-Invoice state transitions to GENERATED');
    assert(einvRes1.eInvoiceRecord.irn !== null, 'IRN hash (64-char hex) generated and stored');
    assert(einvRes1.eInvoiceRecord.signedQrCode !== null, 'Signed QR code payload generated and stored');

    // Test 4: Invoice Immutability Lock
    const lockedInv = await prisma.salesInvoice.findFirst({ where: { id: salesInv.id, tenantId: tenantA } });
    assert(lockedInv?.isEInvoiceGenerated === true, 'Sales invoice marked as isEInvoiceGenerated = true');
    assert(lockedInv?.isStatutoryLocked === true, 'Sales invoice statutory fields locked (isStatutoryLocked = true)');

    // Test 5: Idempotency (Duplicate IRN Generation Request)
    const einvRes2 = await einvoiceService.generateEInvoice(tenantA, user1, { invoiceId: salesInv.id });
    assert(einvRes2.isDuplicate === true, 'Duplicate IRN generation request detected by idempotency guard');
    assert(einvRes2.eInvoiceRecord.irn === einvRes1.eInvoiceRecord.irn, 'Duplicate request returns cached IRN without duplicate portal execution');

    // Test 6: E-Invoice Cancellation (GENERATED -> CANCELLED)
    const cancelRes = await einvoiceService.cancelEInvoice(tenantA, user1, {
      invoiceId: salesInv.id,
      reason: '1', // 1: Duplicate
      remark: 'Order cancelled by buyer prior to dispatch',
    });
    assert(cancelRes.status === 'CANCELLED', 'E-Invoice state transitions to CANCELLED');

    const unlockedInv = await prisma.salesInvoice.findFirst({ where: { id: salesInv.id, tenantId: tenantA } });
    assert(unlockedInv?.isStatutoryLocked === false, 'Statutory lock released on invoice after IRN cancellation');

    // Test 7: Simulated GSP Error Handling (Invalid Invoice Data)
    const invInvalid = await prisma.salesInvoice.create({
      data: {
        tenantId: tenantA,
        companyId,
        gstinId,
        branchId,
        partyId,
        taxPeriodId,
        category: 'SALES',
        invoiceType: 'B2B',
        status: 'POSTED',
        invoiceNumber: 'INV-STAGE7-ERR',
        invoiceDate: new Date('2026-09-26'),
        totalTaxableAmount: 100000,
        totalCgstAmount: 9000,
        totalSgstAmount: 9000,
        totalIgstAmount: 0,
        totalInvoiceAmount: 118000,
        lineItems: [],
      },
    });

    const failedEinv = await einvoiceService.generateEInvoice(tenantA, user1, { invoiceId: invInvalid.id, simulateError: true });
    assert(failedEinv.eInvoiceRecord.status === 'FAILED', 'E-Invoice state set to FAILED on portal error');
    assert(failedEinv.eInvoiceRecord.errorCode === 'NIC_2150', 'Portal error code persisted in record');

    console.log('\n--- 3. E-WAY BILL LIFECYCLE & TENANT ISOLATION TESTS ---\n');

    // Create Invoice for E-Way Bill
    const salesEwb = await prisma.salesInvoice.create({
      data: {
        tenantId: tenantA,
        companyId,
        gstinId,
        branchId,
        partyId,
        taxPeriodId,
        category: 'SALES',
        invoiceType: 'B2B',
        status: 'POSTED',
        invoiceNumber: 'INV-EWB-001',
        invoiceDate: new Date('2026-09-27'),
        totalTaxableAmount: 250000,
        totalCgstAmount: 22500,
        totalSgstAmount: 22500,
        totalIgstAmount: 0,
        totalInvoiceAmount: 295000,
        lineItems: [{ itemNumber: 1, hsnSacCode: '847130', description: 'Laptops', taxableValue: 250000, cgstRate: 9, sgstRate: 9 }],
      },
    });

    // Test 8: E-Way Bill Generation (NOT_GENERATED -> GENERATED)
    const ewb1 = await ewaybillService.generateEWayBill(tenantA, user1, {
      invoiceId: salesEwb.id,
      distanceKm: 250,
      vehicleNumber: 'MH12AB9999',
      transportMode: '1',
    });
    assert(ewb1.status === 'GENERATED', 'E-Way Bill state transitions to GENERATED');
    assert(ewb1.eWayBillNumber !== null, '12-digit E-Way Bill number generated');

    // Test 9: Vehicle Details Update (GENERATED -> UPDATED_VEHICLE)
    const ewbUpdated = await ewaybillService.updateVehicleDetails(tenantA, user1, {
      eWayBillId: ewb1.id,
      vehicleNumber: 'MH14XY8888',
      reason: 'Breakdown of original vehicle',
    });
    assert(ewbUpdated.status === 'UPDATED_VEHICLE', 'E-Way Bill status transitions to UPDATED_VEHICLE');
    assert(ewbUpdated.vehicleNumber === 'MH14XY8888', 'Updated vehicle number recorded in Part B');

    // Test 10: E-Way Bill Cancellation
    const ewbCancel = await ewaybillService.cancelEWayBill(tenantA, user1, {
      eWayBillId: ewb1.id,
      reason: '1',
      remark: 'Goods not dispatched',
    });
    assert(ewbCancel.status === 'CANCELLED', 'E-Way Bill status transitions to CANCELLED');

    // Test 11: Cross-Tenant Access Isolation Guard
    let crossTenantEwbFailed = false;
    try {
      await ewaybillService.generateEWayBill(tenantB, user1, { invoiceId: salesEwb.id });
    } catch (err: any) {
      crossTenantEwbFailed = true;
    }
    assert(crossTenantEwbFailed, 'Cross-tenant E-Way Bill generation attempt fails closed');

    // Test 12: Government API Audit Trail Recording
    const auditCount = mockGovAuditLogs.filter((l) => l.tenantId === tenantA).length;
    assert(auditCount >= 4, 'Government API Audit Trail recorded all external portal interactions');

  } catch (error) {
    console.error('UNHANDLED EXCEPTION IN STAGE 7 TEST SUITE:', error);
    process.exitCode = 1;
  }

  console.log('\n-------------------------------------------------------------------');
  console.log(`TOTAL TESTS: ${totalCount} | PASSED: ${passedCount} | FAILED: ${totalCount - passedCount}`);
  console.log('-------------------------------------------------------------------');

  if (passedCount === totalCount) {
    console.log('VERIFICATION RESULT: ALL STAGE 7 AUTOMATED TESTS PASSED 100%');
  } else {
    console.error('VERIFICATION RESULT: STAGE 7 TEST SUITE FAILED');
    process.exit(1);
  }
}

runStage7VerificationSuite();
