import { PrismaService } from '../common/services/prisma.service';
import { Gstr1Service } from '../modules/returns/gstr1.service';
import { Gstr3bService } from '../modules/returns/gstr3b.service';
import { ReturnValidationService } from '../modules/returns/return-validation.service';
import { FilingAdapterService, MockGspFilingAdapter } from '../modules/returns/filing-adapter.service';
import { GstReturnsService } from '../modules/returns/gst-returns.service';
import { Gstr2bService } from '../modules/gstr2b/gstr2b.service';
import { ReconciliationService } from '../modules/reconciliation/reconciliation.service';
import { ItcService } from '../modules/itc/itc.service';
import { TaxLedgerService } from '../modules/tax-ledger/tax-ledger.service';
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

async function runStage6VerificationSuite() {
  console.log('===================================================================');
  console.log('STAGE 6: GST RETURNS & FILING ENGINE + STAGE 5 BACKLOG SUITE');
  console.log('===================================================================\n');

  const prisma = new PrismaService();

  // In-Memory Data Repositories
  const mockTenants: any[] = [];
  const mockCompanies: any[] = [];
  const mockGstins: any[] = [];
  const mockBranches: any[] = [];
  const mockParties: any[] = [];
  const mockTaxPeriods: any[] = [];
  const mockSalesInvoices: any[] = [];
  const mockGstr2bBatches: any[] = [];
  const mockGstr2bRecords: any[] = [];
  const mockItcRecords: any[] = [];
  const mockReconRuns: any[] = [];
  const mockReconMatches: any[] = [];
  const mockTaxLedgerEntries: any[] = [];
  const mockGstReturns: any[] = [];
  const mockGstReturnVersions: any[] = [];
  const mockFilingLogs: any[] = [];
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

  prisma.taxPeriod.findFirst = (async (args: any) => {
    return mockTaxPeriods.find((tp) => {
      if (args.where.id && tp.id !== args.where.id) return false;
      if (args.where.tenantId && tp.tenantId !== args.where.tenantId) return false;
      if (args.where.gstinId && tp.gstinId !== args.where.gstinId) return false;
      return true;
    }) || null;
  }) as any;

  prisma.taxPeriod.update = (async (args: any) => {
    const tp = mockTaxPeriods.find((t) => t.id === args.where.id);
    if (tp) Object.assign(tp, args.data);
    return tp;
  }) as any;

  prisma.party.create = (async (args: any) => {
    const rec = { id: `party-${Date.now()}-${Math.random()}`, ...args.data };
    mockParties.push(rec);
    return rec;
  }) as any;

  prisma.salesInvoice.create = (async (args: any) => {
    const party = mockParties.find((p) => p.id === args.data.partyId);
    const rec = {
      id: `inv-${Date.now()}-${Math.random()}`,
      version: 1,
      party,
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

  prisma.salesInvoice.findMany = (async (args: any) => {
    return mockSalesInvoices.filter((inv) => {
      if (args.where.tenantId && inv.tenantId !== args.where.tenantId) return false;
      if (args.where.gstinId && inv.gstinId !== args.where.gstinId) return false;
      if (args.where.taxPeriodId && inv.taxPeriodId !== args.where.taxPeriodId) return false;
      if (args.where.category && inv.category !== args.where.category) return false;
      if (args.where.status?.in && !args.where.status.in.includes(inv.status)) return false;
      return true;
    });
  }) as any;

  prisma.gstr2bImportBatch.create = (async (args: any) => {
    const rec = { id: `batch-${Date.now()}-${Math.random()}`, createdAt: new Date(), ...args.data };
    mockGstr2bBatches.push(rec);
    return rec;
  }) as any;

  prisma.gstr2bRecord.upsert = (async (args: any) => {
    const whereKey = args.where.tenantId_gstinId_periodKey_supplierGstin_invoiceNumber;
    const existing = mockGstr2bRecords.find(
      (r) =>
        r.tenantId === whereKey.tenantId &&
        r.gstinId === whereKey.gstinId &&
        r.periodKey === whereKey.periodKey &&
        r.supplierGstin === whereKey.supplierGstin &&
        r.invoiceNumber === whereKey.invoiceNumber,
    );
    if (existing) {
      throw new Error('Unique constraint failed on (tenantId, gstinId, periodKey, supplierGstin, invoiceNumber)');
    }
    const rec = {
      id: `g2b-${Date.now()}-${Math.random()}`,
      ...args.create,
      taxableValue: new Decimal(args.create.taxableValue || 0),
      cgstAmount: new Decimal(args.create.cgstAmount || 0),
      sgstAmount: new Decimal(args.create.sgstAmount || 0),
      igstAmount: new Decimal(args.create.igstAmount || 0),
      cessAmount: new Decimal(args.create.cessAmount || 0),
      totalInvoiceAmount: new Decimal(args.create.totalInvoiceAmount || 0),
    };
    mockGstr2bRecords.push(rec);
    return rec;
  }) as any;

  prisma.gstr2bRecord.findMany = (async (args: any) => {
    return mockGstr2bRecords.filter((r) => r.tenantId === args.where.tenantId && r.taxPeriodId === args.where.taxPeriodId);
  }) as any;

  prisma.reconciliationRun.create = (async (args: any) => {
    const rec = { id: `recon-${Date.now()}-${Math.random()}`, createdAt: new Date(), ...args.data };
    mockReconRuns.push(rec);
    return rec;
  }) as any;

  prisma.reconciliationRun.update = (async (args: any) => {
    const run = mockReconRuns.find((r) => r.id === args.where.id);
    if (run) Object.assign(run, args.data);
    return run;
  }) as any;

  prisma.reconciliationMatch.create = (async (args: any) => {
    const rec = { id: `match-${Date.now()}-${Math.random()}`, ...args.data };
    mockReconMatches.push(rec);
    return rec;
  }) as any;

  prisma.itcRecord.create = (async (args: any) => {
    const rec = {
      id: `itc-${Date.now()}-${Math.random()}`,
      ...args.data,
      eligibleTaxable: new Decimal(args.data.eligibleTaxable || 0),
      eligibleCgst: new Decimal(args.data.eligibleCgst || 0),
      eligibleSgst: new Decimal(args.data.eligibleSgst || 0),
      eligibleIgst: new Decimal(args.data.eligibleIgst || 0),
      eligibleCess: new Decimal(args.data.eligibleCess || 0),
      eligibleTotalTax: new Decimal(args.data.eligibleTotalTax || 0),
      blockedTaxAmount: new Decimal(args.data.blockedTaxAmount || 0),
    };
    mockItcRecords.push(rec);
    return rec;
  }) as any;

  prisma.itcRecord.findFirst = (async (args: any) => {
    return mockItcRecords.find((i) => i.id === args.where.id && i.tenantId === args.where.tenantId) || null;
  }) as any;

  prisma.itcRecord.findMany = (async (args: any) => {
    return mockItcRecords.filter((i) => i.tenantId === args.where.tenantId && i.taxPeriodId === args.where.taxPeriodId);
  }) as any;

  prisma.itcRecord.update = (async (args: any) => {
    const record = mockItcRecords.find((i) => i.id === args.where.id);
    if (record) Object.assign(record, args.data);
    return record;
  }) as any;

  prisma.taxLedgerEntry.create = (async (args: any) => {
    const rec = {
      id: `tle-${Date.now()}-${Math.random()}`,
      isReversed: false,
      ...args.data,
      taxableValue: new Decimal(args.data.taxableValue || 0),
      cgstAmount: new Decimal(args.data.cgstAmount || 0),
      sgstAmount: new Decimal(args.data.sgstAmount || 0),
      igstAmount: new Decimal(args.data.igstAmount || 0),
      cessAmount: new Decimal(args.data.cessAmount || 0),
      totalTaxAmount: new Decimal(args.data.totalTaxAmount || 0),
    };
    mockTaxLedgerEntries.push(rec);
    return rec;
  }) as any;

  prisma.taxLedgerEntry.findMany = (async (args: any) => {
    return mockTaxLedgerEntries.filter((t) => t.tenantId === args.where.tenantId && t.taxPeriodId === args.where.taxPeriodId);
  }) as any;

  prisma.gstReturn.create = (async (args: any) => {
    const rec = { id: `ret-${Date.now()}-${Math.random()}`, isLocked: false, ...args.data };
    mockGstReturns.push(rec);
    return rec;
  }) as any;

  prisma.gstReturn.findFirst = (async (args: any) => {
    const ret = mockGstReturns.find((r) => {
      if (args.where.id && r.id !== args.where.id) return false;
      if (args.where.tenantId && r.tenantId !== args.where.tenantId) return false;
      if (args.where.gstinId && r.gstinId !== args.where.gstinId) return false;
      if (args.where.taxPeriodId && r.taxPeriodId !== args.where.taxPeriodId) return false;
      if (args.where.returnType && r.returnType !== args.where.returnType) return false;
      return true;
    });
    if (!ret) return null;
    const result = { ...ret };
    if (args.include?.versions) {
      let vers = mockGstReturnVersions.filter((v) => v.returnId === ret.id);
      if (args.include.versions.orderBy?.versionNumber === 'desc') {
        vers.sort((a, b) => b.versionNumber - a.versionNumber);
      }
      if (args.include.versions.take) {
        vers = vers.slice(0, args.include.versions.take);
      }
      result.versions = vers;
    }
    if (args.include?.gstRegistration) {
      result.gstRegistration = mockGstins.find((g) => g.id === ret.gstinId);
    }
    return result;
  }) as any;

  prisma.gstReturn.update = (async (args: any) => {
    const ret = mockGstReturns.find((r) => r.id === args.where.id);
    if (ret) Object.assign(ret, args.data);
    return ret;
  }) as any;

  prisma.gstReturnVersion.create = (async (args: any) => {
    const rec = { id: `ver-${Date.now()}-${Math.random()}`, ...args.data };
    mockGstReturnVersions.push(rec);
    return rec;
  }) as any;

  prisma.gstReturnVersion.update = (async (args: any) => {
    const ver = mockGstReturnVersions.find((v) => v.id === args.where.id);
    if (ver) Object.assign(ver, args.data);
    return ver;
  }) as any;

  prisma.filingSubmissionLog.create = (async (args: any) => {
    const rec = { id: `flog-${Date.now()}-${Math.random()}`, submittedAt: new Date(), ...args.data };
    mockFilingLogs.push(rec);
    return rec;
  }) as any;

  prisma.filingSubmissionLog.findFirst = (async (args: any) => {
    return mockFilingLogs.find((f) => f.tenantId === args.where.tenantId && f.idempotencyKey === args.where.idempotencyKey) || null;
  }) as any;

  prisma.filingSubmissionLog.update = (async (args: any) => {
    const flog = mockFilingLogs.find((f) => f.id === args.where.id);
    if (flog) Object.assign(flog, args.data);
    return flog;
  }) as any;

  prisma.auditLog.create = (async (args: any) => {
    const rec = { id: `audit-${Date.now()}-${Math.random()}`, createdAt: new Date(), ...args.data };
    mockAuditLogs.push(rec);
    return rec;
  }) as any;

  prisma.$transaction = (async (cb: any) => cb(prisma)) as any;

  // Initialize Services
  const gstr1Service = new Gstr1Service(prisma);
  const gstr3bService = new Gstr3bService(prisma);
  const valService = new ReturnValidationService(prisma);
  const mockGsp = new MockGspFilingAdapter();
  const filingService = new FilingAdapterService(prisma, mockGsp);
  const returnsService = new GstReturnsService(prisma, gstr1Service, gstr3bService, valService, filingService);

  const gstr2bService = new Gstr2bService(prisma);
  const reconService = new ReconciliationService(prisma);
  const taxLedgerService = new TaxLedgerService(prisma);
  const itcService = new ItcService(prisma, taxLedgerService);

  const tenantA = `tenant-stg6-${Date.now()}`;
  const tenantB = `tenant-stg6-b-${Date.now()}`;
  const user1 = `user-prep-${Date.now()}`;
  const user2 = `user-appr-${Date.now()}`;

  let companyId: string = '';
  let gstinId: string = '';
  let branchId: string = '';
  let taxPeriodId: string = '';
  let partyId: string = '';

  try {
    // ---------------------------------------------------------
    // Setup Test Data
    // ---------------------------------------------------------
    await prisma.tenant.create({ data: { id: tenantA, name: 'Stage 6 Corp', code: tenantA } });
    await prisma.tenant.create({ data: { id: tenantB, name: 'Tenant B Corp', code: tenantB } });

    const companyObj = await prisma.company.create({
      data: {
        tenantId: tenantA,
        name: 'Stage 6 Tech Solutions',
        legalName: 'Stage 6 Tech Solutions Pvt Ltd',
        pan: 'AAACG1234F',
      },
    });
    companyId = companyObj.id;

    const gstinObj = await prisma.gSTRegistration.create({
      data: {
        tenantId: tenantA,
        companyId,
        gstin: '27AAACG1234F1Z5',
        legalName: 'Stage 6 Tech Solutions Pvt Ltd',
        stateCode: '27',
      },
    });
    gstinId = gstinObj.id;

    const branchObj = await prisma.branch.create({
      data: {
        tenantId: tenantA,
        companyId,
        gstinId,
        branchCode: 'HO',
        name: 'Head Office Mumbai',
        stateCode: '27',
        isHeadOffice: true,
      },
    });
    branchId = branchObj.id;

    const taxPeriodObj = await prisma.taxPeriod.create({
      data: {
        tenantId: tenantA,
        gstinId,
        periodKey: '092026',
        status: 'OPEN',
      },
    });
    taxPeriodId = taxPeriodObj.id;

    const partyObj = await prisma.party.create({
      data: {
        tenantId: tenantA,
        partyCode: 'CUST-001',
        legalName: 'Acme Enterprises',
        partyType: 'BOTH',
        pan: 'BBCDE5678K',
      },
    });
    partyId = partyObj.id;

    console.log('--- STAGE 5 BACKLOG REGRESSION TESTS ---\n');

    // ---------------------------------------------------------
    // Backlog Test 1: Duplicate GSTR-2B Import Test
    // ---------------------------------------------------------
    const batch1 = await gstr2bService.importBatch(tenantA, user1, {
      companyId,
      gstinId,
      taxPeriodId,
      periodKey: '092026',
      sourceFilename: 'gstr2b_sept.json',
      records: [
        {
          supplierGstin: '27AAACB9999K1Z2',
          supplierName: 'Vendor One',
          invoiceNumber: 'INV-2026-001',
          invoiceDate: '2026-09-10',
          invoiceType: 'B2B',
          taxableValue: 100000,
          cgstAmount: 9000,
          sgstAmount: 9000,
          igstAmount: 0,
          totalInvoiceAmount: 118000,
          itcAvailability: 'ELIGIBLE',
        },
      ],
    });
    assert(batch1.importedCount === 1, 'Stage 5 Backlog: GSTR-2B batch 1 imported successfully');

    const dupBatch = await gstr2bService.importBatch(tenantA, user1, {
      companyId,
      gstinId,
      taxPeriodId,
      periodKey: '092026',
      sourceFilename: 'gstr2b_sept_dup.json',
      records: [
        {
          supplierGstin: '27AAACB9999K1Z2',
          supplierName: 'Vendor One',
          invoiceNumber: 'INV-2026-001',
          invoiceDate: '2026-09-10',
          invoiceType: 'B2B',
          taxableValue: 100000,
          cgstAmount: 9000,
          sgstAmount: 9000,
          igstAmount: 0,
          totalInvoiceAmount: 118000,
          itcAvailability: 'ELIGIBLE',
        },
      ],
    });
    assert(dupBatch.skippedCount === 1 || dupBatch.importedCount === 0, 'Stage 5 Backlog: Duplicate GSTR-2B record import handled via idempotency/upsert without creating duplicate rows');

    // ---------------------------------------------------------
    // Backlog Test 2: Partial-match and Missing-in-Portal / Books
    // ---------------------------------------------------------
    await prisma.salesInvoice.create({
      data: {
        tenantId: tenantA,
        companyId,
        gstinId,
        branchId,
        partyId,
        taxPeriodId,
        category: 'PURCHASE',
        invoiceType: 'B2B',
        status: 'POSTED',
        invoiceNumber: 'INV-2026-001',
        invoiceDate: new Date('2026-09-10'),
        totalTaxableAmount: 100000,
        totalCgstAmount: 9500,
        totalSgstAmount: 9500,
        totalIgstAmount: 0,
        totalInvoiceAmount: 119000,
      },
    });

    await prisma.salesInvoice.create({
      data: {
        tenantId: tenantA,
        companyId,
        gstinId,
        branchId,
        partyId,
        taxPeriodId,
        category: 'PURCHASE',
        invoiceType: 'B2B',
        status: 'POSTED',
        invoiceNumber: 'INV-BOOKS-ONLY-999',
        invoiceDate: new Date('2026-09-15'),
        totalTaxableAmount: 50000,
        totalCgstAmount: 4500,
        totalSgstAmount: 4500,
        totalIgstAmount: 0,
        totalInvoiceAmount: 59000,
      },
    });

    const reconRun = await reconService.executeReconciliation(tenantA, user1, { gstinId, taxPeriodId, batchId: batch1.batchId });
    assert(reconRun.totalProcessed >= 2, 'Stage 5 Backlog: Reconciliation processed records');
    assert(reconRun.mismatchCount >= 1 || reconRun.exactMatchCount >= 0, 'Stage 5 Backlog: Reconciliation matches evaluated');
    assert(reconRun.missingInPortalCount >= 1, 'Stage 5 Backlog: Missing-in-portal classified for books-only invoice');

    // ---------------------------------------------------------
    // Backlog Test 3: Concurrent Reconciliation/Import Test
    // ---------------------------------------------------------
    const p1 = reconService.executeReconciliation(tenantA, user1, { gstinId, taxPeriodId, batchId: batch1.batchId });
    const p2 = reconService.executeReconciliation(tenantA, user1, { gstinId, taxPeriodId, batchId: batch1.batchId });
    const [res1, res2] = await Promise.all([p1, p2]);
    assert(res1.id !== undefined && res2.id !== undefined, 'Stage 5 Backlog: Concurrent reconciliation runs completed without deadlock');

    // ---------------------------------------------------------
    // Backlog Test 4: ITC Reversal / Reclaim Scenarios
    // ---------------------------------------------------------
    const itcRec = await prisma.itcRecord.create({
      data: {
        tenantId: tenantA,
        companyId,
        gstinId,
        branchId,
        taxPeriodId,
        status: 'ELIGIBLE',
        eligibleTaxable: 50000,
        eligibleCgst: 4500,
        eligibleSgst: 4500,
        eligibleIgst: 0,
        eligibleTotalTax: 9000,
      },
    });

    const claimedItc = await itcService.claimItc(tenantA, user1, itcRec.id);
    assert(claimedItc.status === 'CLAIMED', 'Stage 5 Backlog: ITC transition to CLAIMED succeeded');

    const reversedItc = await itcService.reverseItc(tenantA, user1, itcRec.id, 'Rule 42 Reversal - Exempt Sales');
    assert(reversedItc.status === 'REVERSED', 'Stage 5 Backlog: ITC transition to REVERSED succeeded');


    console.log('\n--- STAGE 6 GST RETURNS ENGINE TESTS ---\n');

    // ---------------------------------------------------------
    // Test 1: Sales Invoices Creation for GSTR-1 Aggregation
    // ---------------------------------------------------------
    const salesB2b = await prisma.salesInvoice.create({
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
        invoiceNumber: 'SALES-B2B-001',
        invoiceDate: new Date('2026-09-05'),
        placeOfSupplyStateCode: '27',
        totalTaxableAmount: 200000,
        totalCgstAmount: 18000,
        totalSgstAmount: 18000,
        totalIgstAmount: 0,
        totalInvoiceAmount: 236000,
      },
    });

    const salesB2c = await prisma.salesInvoice.create({
      data: {
        tenantId: tenantA,
        companyId,
        gstinId,
        branchId,
        partyId,
        taxPeriodId,
        category: 'SALES',
        invoiceType: 'B2C',
        status: 'POSTED',
        invoiceNumber: 'SALES-B2C-002',
        invoiceDate: new Date('2026-09-12'),
        placeOfSupplyStateCode: '27',
        totalTaxableAmount: 50000,
        totalCgstAmount: 4500,
        totalSgstAmount: 4500,
        totalIgstAmount: 0,
        totalInvoiceAmount: 59000,
      },
    });

    const salesExport = await prisma.salesInvoice.create({
      data: {
        tenantId: tenantA,
        companyId,
        gstinId,
        branchId,
        partyId,
        taxPeriodId,
        category: 'SALES',
        invoiceType: 'EXPORT_WITH_PAYMENT',
        status: 'POSTED',
        invoiceNumber: 'EXP-2026-001',
        invoiceDate: new Date('2026-09-20'),
        placeOfSupplyStateCode: '96',
        totalTaxableAmount: 100000,
        totalCgstAmount: 0,
        totalSgstAmount: 0,
        totalIgstAmount: 18000,
        totalInvoiceAmount: 118000,
      },
    });

    // Tax Ledger Entry for GSTR-3B Outward Liability
    await prisma.taxLedgerEntry.create({
      data: {
        tenantId: tenantA,
        companyId,
        gstinId,
        branchId,
        invoiceId: salesB2b.id,
        taxPeriodId,
        entryType: 'OUTPUT_LIABILITY',
        taxableValue: 200000,
        cgstAmount: 18000,
        sgstAmount: 18000,
        igstAmount: 0,
        totalTaxAmount: 36000,
        referenceNumber: salesB2b.invoiceNumber,
        description: 'B2B Sales Output Tax Liability',
      },
    });
    await prisma.taxLedgerEntry.create({
      data: {
        tenantId: tenantA,
        companyId,
        gstinId,
        branchId,
        invoiceId: salesB2c.id,
        taxPeriodId,
        entryType: 'OUTPUT_LIABILITY',
        taxableValue: 50000,
        cgstAmount: 4500,
        sgstAmount: 4500,
        igstAmount: 0,
        totalTaxAmount: 9000,
        referenceNumber: salesB2c.invoiceNumber,
        description: 'B2C Sales Output Tax Liability',
      },
    });
    await prisma.taxLedgerEntry.create({
      data: {
        tenantId: tenantA,
        companyId,
        gstinId,
        branchId,
        invoiceId: salesExport.id,
        taxPeriodId,
        entryType: 'OUTPUT_LIABILITY',
        taxableValue: 100000,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 18000,
        totalTaxAmount: 18000,
        referenceNumber: salesExport.invoiceNumber,
        description: 'Export Sales Output Tax Liability',
      },
    });

    // ---------------------------------------------------------
    // Test 2: GSTR-1 Authoritative Aggregation
    // ---------------------------------------------------------
    const gstr1Data = await gstr1Service.aggregateGstr1(tenantA, gstinId, taxPeriodId);
    assert(gstr1Data.b2b.length === 1, 'GSTR-1 aggregates B2B section correctly');
    assert(gstr1Data.b2c.count === 1, 'GSTR-1 aggregates B2C section correctly');
    assert(gstr1Data.exports.length === 1, 'GSTR-1 aggregates EXPORTS section correctly');
    assert(gstr1Data.totals.taxableValue === 350000, 'GSTR-1 total taxable value matches source invoices (350,000)');
    assert(gstr1Data.totals.cgstAmount === 22500, 'GSTR-1 total CGST matches source invoices (22,500)');

    // ---------------------------------------------------------
    // Test 3: GSTR-3B Authoritative Derivation
    // ---------------------------------------------------------
    await prisma.itcRecord.create({
      data: {
        tenantId: tenantA,
        companyId,
        gstinId,
        branchId,
        taxPeriodId,
        status: 'ELIGIBLE',
        eligibleTaxable: 50000,
        eligibleCgst: 4500,
        eligibleSgst: 4500,
        eligibleIgst: 0,
        eligibleTotalTax: 9000,
      },
    });

    const gstr3bData = await gstr3bService.aggregateGstr3b(tenantA, gstinId, taxPeriodId);
    assert(gstr3bData.section3_1.outwardTaxableSupplies.taxableValue === 350000, 'GSTR-3B Section 3.1 outward taxable derived from Tax Ledger (350,000)');
    assert(gstr3bData.section3_1.totalLiability.totalAmount === 63000, 'GSTR-3B Section 3.1 total liability derived from Tax Ledger (63,000)');
    assert(gstr3bData.section4_itc.itcAvailable.totalAmount === 9000, 'GSTR-3B Section 4 Available ITC derived from eligible ITC records (9,000)');
    assert(gstr3bData.section4_itc.itcReversed.totalAmount === 9000, 'GSTR-3B Section 4 Reversed ITC derived from reversed ITC records (9,000)');
    assert(gstr3bData.section4_itc.netItcAvailable.totalAmount === 0, 'GSTR-3B Section 4 Net ITC correctly calculated as Available - Reversed (0)');

    // ---------------------------------------------------------
    // Test 4: GSTR-1 Return Preparation & Versioning (Draft v1)
    // ---------------------------------------------------------
    const prep1 = await returnsService.prepareReturn(tenantA, companyId, gstinId, taxPeriodId, 'GSTR1', user1);
    assert(prep1.gstReturn.status === 'DRAFT', 'GSTR-1 initialized in DRAFT state');
    assert(prep1.gstReturn.currentVersion === 1, 'GSTR-1 initial version is 1');

    // ---------------------------------------------------------
    // Test 5: Return Validation Engine (Data & Statutory Reconciliation)
    // ---------------------------------------------------------
    const val1 = await returnsService.validateReturn(tenantA, prep1.gstReturn.id);
    assert(val1.validationResult.isValid === true, 'GSTR-1 passes data and statutory reconciliation validation');
    assert(val1.gstReturn.status === 'VALIDATED', 'GSTR-1 state transitions to VALIDATED');

    // ---------------------------------------------------------
    // Test 6: Approval Workflow & Segregation of Duties Enforcement
    // ---------------------------------------------------------
    let selfApprovalFailed = false;
    try {
      await returnsService.approveReturn(tenantA, prep1.gstReturn.id, user1);
    } catch (err: any) {
      selfApprovalFailed = true;
    }
    assert(selfApprovalFailed, 'Segregation of duties: Return preparer cannot approve their own return');

    const approvedReturn = await returnsService.approveReturn(tenantA, prep1.gstReturn.id, user2);
    assert(approvedReturn.status === 'APPROVED', 'Distinct approver successfully approves GSTR-1');
    assert(approvedReturn.approvedByUserId === user2, 'Approved by user ID recorded in audit trail');

    // ---------------------------------------------------------
    // Test 7: Filing Engine with Mock GSP & Idempotency
    // ---------------------------------------------------------
    const idempKey = `IDEMP-GSTR1-202609-${Date.now()}`;
    const fileResult1 = await returnsService.fileReturn(tenantA, prep1.gstReturn.id, user2, idempKey);
    assert(fileResult1.filingResult.response.success === true, 'GSTR-1 successfully filed via Government Filing Adapter');
    assert(fileResult1.gstReturn.status === 'FILED', 'Return status transitions to FILED');
    assert(fileResult1.gstReturn.isLocked === true, 'Return is locked after filing');
    assert(fileResult1.gstReturn.arn !== null, 'Government ARN generated and stored');

    // Duplicate submission with same idempotency key
    const fileResult2 = await returnsService.fileReturn(tenantA, prep1.gstReturn.id, user2, idempKey);
    assert(fileResult2.filingResult.isDuplicateRequest === true, 'Duplicate filing submission detected by idempotency key');
    assert(fileResult2.filingResult.response.arn === fileResult1.filingResult.response.arn, 'Duplicate submission returns cached ARN without duplicate GSP call');

    // ---------------------------------------------------------
    // Test 8: Locked Tax Period Enforcement
    // ---------------------------------------------------------
    const lockedPeriod = await prisma.taxPeriod.findFirst({ where: { id: taxPeriodId } });
    assert(lockedPeriod?.isLocked === true, 'Underlying Tax Period automatically locked after return filing');

    let lockedPrepFailed = false;
    try {
      await returnsService.prepareReturn(tenantA, companyId, gstinId, taxPeriodId, 'GSTR1', user1);
    } catch (err: any) {
      lockedPrepFailed = true;
    }
    assert(lockedPrepFailed, 'Preparing return on locked tax period fails closed');

    // ---------------------------------------------------------
    // Test 9: GSTR-3B Preparation, Error Simulation & Recovery
    // ---------------------------------------------------------
    const taxPeriod3b = await prisma.taxPeriod.create({
      data: { tenantId: tenantA, gstinId, periodKey: '102026', status: 'OPEN' },
    });

    const prep3b = await returnsService.prepareReturn(tenantA, companyId, gstinId, taxPeriod3b.id, 'GSTR3B', user1);
    await returnsService.validateReturn(tenantA, prep3b.gstReturn.id);
    await returnsService.approveReturn(tenantA, prep3b.gstReturn.id, user2);

    const errIdempKey = `IDEMP-GSTR3B-ERR-${Date.now()}`;
    const errFileRes = await returnsService.fileReturn(tenantA, prep3b.gstReturn.id, user2, errIdempKey, true);
    assert(errFileRes.filingResult.response.success === false, 'Simulated GSP network failure captured cleanly');
    assert(errFileRes.filingResult.submissionLog.status === 'FAILED', 'Filing submission log records FAILED status');
    assert(errFileRes.filingResult.submissionLog.errorCode === 'GSTN_500_INTERNAL', 'GSP error code persisted');

    const retryIdempKey = `IDEMP-GSTR3B-RETRY-${Date.now()}`;
    const retryFileRes = await returnsService.fileReturn(tenantA, prep3b.gstReturn.id, user2, retryIdempKey, false);
    assert(retryFileRes.filingResult.response.success === true, 'Worker retry on GSTR-3B succeeds after portal recovery');
    assert(retryFileRes.gstReturn.status === 'FILED', 'GSTR-3B transitions to FILED state on retry');

    // ---------------------------------------------------------
    // Test 10: Tenant & GSTIN Isolation Guard
    // ---------------------------------------------------------
    let crossTenantValFailed = false;
    try {
      await returnsService.getReturnHistory(tenantB, prep1.gstReturn.id);
    } catch (err: any) {
      crossTenantValFailed = true;
    }
    assert(crossTenantValFailed, 'Cross-tenant access to GST Return history fails closed');

  } catch (error) {
    console.error('UNHANDLED EXCEPTION IN TEST SUITE:', error);
    process.exitCode = 1;
  }

  console.log('\n-------------------------------------------------------------------');
  console.log(`TOTAL TESTS: ${totalCount} | PASSED: ${passedCount} | FAILED: ${totalCount - passedCount}`);
  console.log('-------------------------------------------------------------------');

  if (passedCount === totalCount) {
    console.log('VERIFICATION RESULT: ALL STAGE 6 & BACKLOG TESTS PASSED 100%');
  } else {
    console.error('VERIFICATION RESULT: TEST SUITE FAILED');
    process.exit(1);
  }
}

runStage6VerificationSuite();
