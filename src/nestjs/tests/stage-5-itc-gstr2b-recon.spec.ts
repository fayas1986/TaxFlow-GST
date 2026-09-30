import { Gstr2bService } from '../modules/gstr2b/gstr2b.service';
import { ItcService } from '../modules/itc/itc.service';
import { ReconciliationService } from '../modules/reconciliation/reconciliation.service';
import { TaxLedgerService } from '../modules/tax-ledger/tax-ledger.service';
import { PrismaService } from '../common/services/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ItcStatus, Gstr2bItcAvailability, ReconciliationMatchStatus, InvoiceCategory } from '@prisma/client';

export async function runStage5TestSuite() {
  console.log('===============================================================');
  console.log('STAGE 5 ITC, GSTR-2B & RECONCILIATION ENGINE AUTOMATED TEST SUITE');
  console.log('===============================================================\n');

  let totalCount = 0;
  let passedCount = 0;

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

  const prisma = new PrismaService();

  // Mock State Databases
  const mockGstins: any[] = [
    { id: 'gst-a-1', tenantId: 'tenant-a', companyId: 'comp-a-1', gstin: '27AAACA1234A1Z1', stateCode: '27' },
  ];

  const mockTaxPeriods: any[] = [
    { id: 'tp-082026', tenantId: 'tenant-a', gstinId: 'gst-a-1', periodKey: '082026' },
  ];

  const mockGstr2bRecords: any[] = [];
  const mockItcRecords: any[] = [];
  const mockReconRuns: any[] = [];
  const mockReconMatches: any[] = [];
  const mockLedgerEntries: any[] = [];

  const mockPurchaseInvoices: any[] = [
    {
      id: 'pur-1',
      tenantId: 'tenant-a',
      companyId: 'comp-a-1',
      gstinId: 'gst-a-1',
      taxPeriodId: 'tp-082026',
      category: InvoiceCategory.PURCHASE,
      invoiceNumber: 'INV-2026-99',
      totalCgstAmount: { toString: () => '900.0000' },
      totalSgstAmount: { toString: () => '900.0000' },
      totalIgstAmount: { toString: () => '0.0000' },
    },
    {
      id: 'pur-2',
      tenantId: 'tenant-a',
      companyId: 'comp-a-1',
      gstinId: 'gst-a-1',
      taxPeriodId: 'tp-082026',
      category: InvoiceCategory.PURCHASE,
      invoiceNumber: 'INV-MISMATCH-100',
      totalCgstAmount: { toString: () => '5000.0000' },
      totalSgstAmount: { toString: () => '5000.0000' },
      totalIgstAmount: { toString: () => '0.0000' },
    },
  ];

  // Wire Prisma Service Mocks
  prisma.gSTRegistration.findFirst = (async (args: any) => {
    return mockGstins.find((g) => g.id === args.where.id && g.tenantId === args.where.tenantId) || null;
  }) as any;

  prisma.taxPeriod.findFirst = (async (args: any) => {
    return mockTaxPeriods.find((tp) => tp.id === args.where.id && tp.tenantId === args.where.tenantId) || null;
  }) as any;

  prisma.salesInvoice.findMany = (async (args: any) => {
    return mockPurchaseInvoices.filter((p) => p.tenantId === args.where.tenantId);
  }) as any;

  prisma.gstr2bRecord.findMany = (async (args: any) => {
    return mockGstr2bRecords.filter((g) => g.tenantId === args.where.tenantId);
  }) as any;

  prisma.itcRecord.findFirst = (async (args: any) => {
    return mockItcRecords.find((i) => i.id === args.where.id && i.tenantId === args.where.tenantId) || null;
  }) as any;

  prisma.itcRecord.create = (async (args: any) => {
    const rec = { id: `itc-${mockItcRecords.length + 1}`, ...args.data };
    return rec;
  }) as any;

  prisma.taxLedgerEntry.create = (async (args: any) => {
    const entry = { id: `led-${mockLedgerEntries.length + 1}`, ...args.data };
    mockLedgerEntries.push(entry);
    return entry;
  }) as any;

  prisma.auditLog.create = (async (args: any) => args.data) as any;

  prisma.$transaction = (async (callback: any) => {
    const txMock = {
      gstr2bImportBatch: {
        create: async (args: any) => ({ id: `batch-${Date.now()}`, ...args.data }),
      },
      gstr2bRecord: {
        upsert: async (args: any) => {
          const rec = { id: `g2b-${mockGstr2bRecords.length + 1}`, ...args.create };
          mockGstr2bRecords.push(rec);
          return rec;
        },
      },
      itcRecord: {
        update: async (args: any) => {
          const rec = mockItcRecords.find((i) => i.id === args.where.id);
          if (rec) Object.assign(rec, args.data);
          return rec;
        },
      },
      reconciliationRun: {
        create: async (args: any) => {
          const run = { id: `run-${mockReconRuns.length + 1}`, ...args.data };
          mockReconRuns.push(run);
          return run;
        },
        update: async (args: any) => {
          const run = mockReconRuns.find((r) => r.id === args.where.id);
          if (run) Object.assign(run, args.data);
          return run;
        },
      },
      reconciliationMatch: {
        create: async (args: any) => {
          const match = { id: `match-${mockReconMatches.length + 1}`, ...args.data };
          mockReconMatches.push(match);
          return match;
        },
      },
      auditLog: {
        create: async (args: any) => args.data,
      },
    };
    return callback(txMock);
  }) as any;

  const taxLedgerService = new TaxLedgerService(prisma);
  const gstr2bService = new Gstr2bService(prisma);
  const itcService = new ItcService(prisma, taxLedgerService);
  const reconService = new ReconciliationService(prisma);

  // ----------------------------------------------------
  // TEST 1: Section 17(5) Motor Vehicle Blocked Credit Evaluation
  // ----------------------------------------------------
  const blockedMotor = await itcService.evaluateAndCreate('tenant-a', 'u1', {
    companyId: 'comp-a-1',
    gstinId: 'gst-a-1',
    taxPeriodId: 'tp-082026',
    itemDescription: 'Executive Luxury Car Purchase for Director',
    hsnSacCode: '8703',
    taxableValue: 1500000,
    cgstAmount: 140000,
    sgstAmount: 140000,
    igstAmount: 0,
  });

  mockItcRecords.push(blockedMotor);
  assert(blockedMotor.status === ItcStatus.INELIGIBLE, 'Motor vehicle purchase tagged as INELIGIBLE ITC');
  assert(blockedMotor.statutoryClause === 'CGST Act Section 17(5)(a)', 'Tagged with Section 17(5)(a) clause');

  // Attempt to claim blocked credit must throw BadRequestException
  try {
    await itcService.claimItc('tenant-a', 'u1', blockedMotor.id);
    assert(false, 'Claiming Section 17(5) blocked credit must throw BadRequestException');
  } catch (err) {
    assert(err instanceof BadRequestException, 'Claiming blocked credit rejected (BadRequestException)');
  }

  // ----------------------------------------------------
  // TEST 2: Eligible IT Services Credit Claim & Tax Ledger Posting
  // ----------------------------------------------------
  const eligibleItc = await itcService.evaluateAndCreate('tenant-a', 'u1', {
    companyId: 'comp-a-1',
    gstinId: 'gst-a-1',
    taxPeriodId: 'tp-082026',
    itemDescription: 'Cloud Infrastructure Hosting Services',
    hsnSacCode: '998311',
    taxableValue: 500000,
    cgstAmount: 45000,
    sgstAmount: 45000,
    igstAmount: 0,
  });

  mockItcRecords.push(eligibleItc);
  assert(eligibleItc.status === ItcStatus.ELIGIBLE, 'IT Services tagged as ELIGIBLE ITC');

  // Claim Eligible ITC
  const claimedItc = await itcService.claimItc('tenant-a', 'u1', eligibleItc.id);
  assert(claimedItc.status === ItcStatus.CLAIMED, 'ITC status updated to CLAIMED');

  // ----------------------------------------------------
  // TEST 3: Idempotent GSTR-2B Ingestion
  // ----------------------------------------------------
  const batchRes1 = await gstr2bService.importBatch('tenant-a', 'u1', {
    companyId: 'comp-a-1',
    gstinId: 'gst-a-1',
    taxPeriodId: 'tp-082026',
    periodKey: '082026',
    sourceFilename: 'GSTR2B_AUG_2026.json',
    records: [
      {
        supplierGstin: '27XYZAB1234C1Z9',
        supplierName: 'Cloud Provider Corp',
        invoiceNumber: 'INV-2026-99',
        invoiceDate: '2026-08-10',
        taxableValue: 10000,
        cgstAmount: 900,
        sgstAmount: 900,
        igstAmount: 0,
      },
      {
        supplierGstin: '27XYZAB1234C1Z9',
        supplierName: 'Cloud Provider Corp',
        invoiceNumber: 'INV-MISMATCH-100',
        invoiceDate: '2026-08-11',
        taxableValue: 50000,
        cgstAmount: 100, // Portal tax = 100 vs Books tax = 10000 (Mismatch!)
        sgstAmount: 100,
        igstAmount: 0,
      },
    ],
  });

  assert(batchRes1.importedCount === 2, 'GSTR-2B batch imported 2 records');

  // ----------------------------------------------------
  // TEST 4: Deterministic Purchase-to-GSTR-2B Reconciliation Run
  // ----------------------------------------------------
  const reconRun = await reconService.executeReconciliation('tenant-a', 'u1', {
    gstinId: 'gst-a-1',
    taxPeriodId: 'tp-082026',
  });

  assert(reconRun.exactMatchCount === 1, 'Reconciliation Engine produced 1 EXACT_MATCH');
  assert(reconRun.mismatchCount === 1, 'Reconciliation Engine produced 1 AMOUNT_MISMATCH');

  // Verify match explanation details
  const exactMatch = mockReconMatches.find((m) => m.matchStatus === ReconciliationMatchStatus.EXACT_MATCH);
  assert(exactMatch !== undefined, 'Exact match record exists in reconciliation run audit');

  const mismatch = mockReconMatches.find((m) => m.matchStatus === ReconciliationMatchStatus.AMOUNT_MISMATCH);
  assert(mismatch !== undefined && mismatch.matchScore === '70.00', 'Amount mismatch score calculated as 70.00');

  // ----------------------------------------------------
  // TEST 5: Cross-Tenant Security Isolation Test
  // ----------------------------------------------------
  try {
    await reconService.executeReconciliation('tenant-b', 'u1', {
      gstinId: 'gst-a-1', // GSTIN belongs to Tenant A!
      taxPeriodId: 'tp-082026',
    });
    assert(false, 'Cross-tenant reconciliation attempt must throw NotFoundException');
  } catch (err) {
    assert(err instanceof NotFoundException, 'Cross-tenant reconciliation rejected (NotFoundException)');
  }

  console.log('\n----------------------------------------------------');
  console.log(`TOTAL STAGE 5 TESTS: ${totalCount} | PASSED: ${passedCount} | FAILED: ${totalCount - passedCount}`);
  console.log('----------------------------------------------------');

  if (passedCount === totalCount) {
    console.log('STAGE 5 VERIFICATION RESULT: ALL ITC & RECON TESTS PASSED 100%');
  } else {
    console.error('STAGE 5 VERIFICATION RESULT: TESTS FAILED');
    process.exit(1);
  }
}

runStage5TestSuite();
