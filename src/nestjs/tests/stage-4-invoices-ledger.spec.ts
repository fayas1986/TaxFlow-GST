import { InvoicesService } from '../modules/invoices/invoices.service';
import { TaxPeriodsService } from '../modules/tax-periods/tax-periods.service';
import { TaxLedgerService } from '../modules/tax-ledger/tax-ledger.service';
import { TaxEngineService } from '../modules/tax-engine/tax-engine.service';
import { PrismaService } from '../common/services/prisma.service';
import { ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { InvoiceCategory, InvoiceType, TaxPeriodStatus, LedgerEntryType } from '@prisma/client';

export async function runStage4TestSuite() {
  console.log('===========================================================');
  console.log('STAGE 4 TAX PERIODS, INVOICES & LEDGER AUTOMATED TEST SUITE');
  console.log('===========================================================\n');

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
  const mockTaxPeriods: any[] = [
    { id: 'tp-open-1', tenantId: 'tenant-a', gstinId: 'gst-a-1', periodKey: '082026', status: TaxPeriodStatus.OPEN, isLocked: false },
    { id: 'tp-locked-1', tenantId: 'tenant-a', gstinId: 'gst-a-1', periodKey: '072026', status: TaxPeriodStatus.LOCKED, isLocked: true },
  ];

  const mockCompanies: any[] = [
    { id: 'comp-a-1', tenantId: 'tenant-a', name: 'Acme India' },
  ];

  const mockGstins: any[] = [
    { id: 'gst-a-1', tenantId: 'tenant-a', companyId: 'comp-a-1', gstin: '27AAACA1234A1Z1', stateCode: '27' },
  ];

  const mockBranches: any[] = [
    { id: 'br-a-1', tenantId: 'tenant-a', companyId: 'comp-a-1', gstinId: 'gst-a-1', branchCode: 'HO-MUMBAI', stateCode: '27' },
  ];

  const mockParties: any[] = [
    { id: 'p-a-1', tenantId: 'tenant-a', partyCode: 'CUST-100', legalName: 'Alpha Customer' },
  ];

  const mockInvoices: any[] = [];
  const mockLedgerEntries: any[] = [];

  // Wire Prisma Service Mocks
  prisma.taxPeriod.findFirst = (async (args: any) => {
    return mockTaxPeriods.find((tp) => tp.id === args.where.id && tp.tenantId === args.where.tenantId) || null;
  }) as any;

  prisma.taxPeriod.update = (async (args: any) => {
    const period = mockTaxPeriods.find((tp) => tp.id === args.where.id);
    if (period) {
      period.status = args.data.status;
      period.isLocked = args.data.isLocked;
    }
    return period;
  }) as any;

  prisma.gSTRegistration.findFirst = (async (args: any) => {
    return mockGstins.find((g) => g.id === args.where.id && g.tenantId === args.where.tenantId) || null;
  }) as any;

  prisma.branch.findFirst = (async (args: any) => {
    return mockBranches.find((b) => b.id === args.where.id && b.tenantId === args.where.tenantId) || null;
  }) as any;

  prisma.party.findFirst = (async (args: any) => {
    return mockParties.find((p) => p.id === args.where.id && p.tenantId === args.where.tenantId) || null;
  }) as any;

  prisma.auditLog.create = (async (args: any) => args.data) as any;

  prisma.salesInvoice.findFirst = (async (args: any) => {
    return mockInvoices.find(
      (inv) =>
        (args.where.id ? inv.id === args.where.id : true) &&
        (args.where.invoiceNumber ? inv.invoiceNumber === args.where.invoiceNumber : true) &&
        inv.tenantId === args.where.tenantId,
    ) || null;
  }) as any;

  prisma.$transaction = (async (callback: any) => {
    const txMock = {
      salesInvoice: {
        create: async (args: any) => {
          const inv = { id: `inv-${mockInvoices.length + 1}`, ...args.data };
          mockInvoices.push(inv);
          return inv;
        },
        update: async (args: any) => {
          const inv = mockInvoices.find((i) => i.id === args.where.id);
          if (inv) Object.assign(inv, args.data);
          return inv;
        },
      },
      taxLedgerEntry: {
        create: async (args: any) => {
          const entry = { id: `led-${mockLedgerEntries.length + 1}`, ...args.data };
          mockLedgerEntries.push(entry);
          return entry;
        },
      },
      auditLog: {
        create: async (args: any) => args.data,
      },
    };
    return callback(txMock);
  }) as any;

  prisma.taxLedgerEntry.findMany = (async (args: any) => {
    return mockLedgerEntries.filter((l) => l.tenantId === args.where.tenantId);
  }) as any;

  prisma.hsnSacMaster.findFirst = (async (args: any) => ({
    code: '998311',
    description: 'IT Services',
    igstRate: { toString: () => '18.00' },
    cgstRate: { toString: () => '9.00' },
    sgstRate: { toString: () => '9.00' },
  })) as any;

  const taxPeriodsService = new TaxPeriodsService(prisma);
  const taxLedgerService = new TaxLedgerService(prisma);
  const taxEngineService = new TaxEngineService(prisma);
  const invoicesService = new InvoicesService(prisma, taxEngineService, taxPeriodsService, taxLedgerService);

  // ----------------------------------------------------
  // TEST 1: Tax Period State Transition & Lock Enforcement
  // ----------------------------------------------------
  await taxPeriodsService.transitionStatus('tenant-a', 'u1', 'tp-open-1', TaxPeriodStatus.APPROVED);
  const periodState = await taxPeriodsService.findOne('tenant-a', 'tp-open-1');
  assert(periodState.status === TaxPeriodStatus.APPROVED, 'Tax Period transitioned from OPEN -> APPROVED');

  try {
    await taxPeriodsService.assertPeriodOpen('tenant-a', 'tp-locked-1');
    assert(false, 'Asserting open on locked period must throw ForbiddenException');
  } catch (err) {
    assert(err instanceof ForbiddenException, 'Locked Tax Period rejects new transaction assertions');
  }

  // ----------------------------------------------------
  // TEST 2: Intrastate Invoice Creation & Tax Ledger Posting
  // ----------------------------------------------------
  const salesInv = await invoicesService.createInvoice('tenant-a', 'u1', {
    companyId: 'comp-a-1',
    gstinId: 'gst-a-1',
    branchId: 'br-a-1',
    partyId: 'p-a-1',
    taxPeriodId: 'tp-open-1',
    category: InvoiceCategory.SALES,
    invoiceType: InvoiceType.B2B,
    invoiceNumber: 'INV-2026-001',
    invoiceDate: '2026-08-15',
    placeOfSupplyStateCode: '27', // Intrastate 27 -> 27
    lineItems: [
      { itemNumber: 1, hsnSacCode: '998311', description: 'Cloud Consulting', quantity: 1, unitPrice: 100000 },
    ],
  });

  assert(salesInv.invoiceNumber === 'INV-2026-001', 'Sales Invoice created with correct invoice number');
  assert(salesInv.totalTaxableAmount === '100000.0000', 'Taxable value calculated accurately as ₹100,000.0000');
  assert(salesInv.totalCgstAmount === '9000.0000', 'CGST calculated accurately as ₹9,000.0000');
  assert(salesInv.totalSgstAmount === '9000.0000', 'SGST calculated accurately as ₹9,000.0000');
  assert(salesInv.totalInvoiceAmount === '118000.0000', 'Total Invoice Amount calculated as ₹118,000.0000');

  // Verify Ledger Entry Created for Sales Invoice
  const salesLedgerEntry = mockLedgerEntries.find((l) => l.referenceNumber === 'INV-2026-001');
  assert(salesLedgerEntry !== undefined, 'Append-Only Financial Tax Ledger entry created automatically');
  assert(salesLedgerEntry.entryType === LedgerEntryType.OUTPUT_LIABILITY, 'Sales invoice posted as OUTPUT_LIABILITY');

  // ----------------------------------------------------
  // TEST 3: Interstate Purchase Invoice & Input Tax Credit Posting
  // ----------------------------------------------------
  const purcInv = await invoicesService.createInvoice('tenant-a', 'u1', {
    companyId: 'comp-a-1',
    gstinId: 'gst-a-1',
    partyId: 'p-a-1',
    taxPeriodId: 'tp-open-1',
    category: InvoiceCategory.PURCHASE,
    invoiceType: InvoiceType.B2B,
    invoiceNumber: 'PUR-2026-001',
    invoiceDate: '2026-08-16',
    placeOfSupplyStateCode: '29', // Interstate 27 -> 29
    lineItems: [
      { itemNumber: 1, hsnSacCode: '998311', description: 'Server Hardware', quantity: 2, unitPrice: 50000 },
    ],
  });

  assert(purcInv.totalIgstAmount === '18000.0000', 'Interstate Purchase IGST calculated as ₹18,000.0000');
  const purcLedgerEntry = mockLedgerEntries.find((l) => l.referenceNumber === 'PUR-2026-001');
  assert(purcLedgerEntry.entryType === LedgerEntryType.INPUT_TAX_CREDIT, 'Purchase invoice posted as INPUT_TAX_CREDIT');

  // ----------------------------------------------------
  // TEST 4: Duplicate Invoice Numbering Prevention
  // ----------------------------------------------------
  try {
    await invoicesService.createInvoice('tenant-a', 'u1', {
      companyId: 'comp-a-1',
      gstinId: 'gst-a-1',
      partyId: 'p-a-1',
      taxPeriodId: 'tp-open-1',
      category: InvoiceCategory.SALES,
      invoiceNumber: 'INV-2026-001', // Duplicate!
      invoiceDate: '2026-08-17',
      placeOfSupplyStateCode: '27',
      lineItems: [{ itemNumber: 1, hsnSacCode: '998311', description: 'Duplicate Test', quantity: 1, unitPrice: 1000 }],
    });
    assert(false, 'Creating duplicate invoice number must throw ConflictException');
  } catch (err) {
    assert(err instanceof ConflictException, 'Duplicate invoice creation prevented (ConflictException)');
  }

  // ----------------------------------------------------
  // TEST 5: Invoice Cancellation & Controlled Reversal Ledger Entry
  // ----------------------------------------------------
  const cancelledInv = await invoicesService.cancelInvoice('tenant-a', 'u1', salesInv.id);
  assert(updatedInvStatusIsCancelled(cancelledInv), 'Invoice status set to CANCELLED');

  const reversalLedgerEntry = mockLedgerEntries.find((l) => l.referenceNumber === 'REV-INV-2026-001');
  assert(reversalLedgerEntry !== undefined, 'Cancellation appended explicit LIABILITY_REVERSAL ledger entry');
  assert(reversalLedgerEntry.isReversed === true, 'Reversal entry flagged as isReversed = true');

  // ----------------------------------------------------
  // TEST 6: Tax Ledger Summary Derivation
  // ----------------------------------------------------
  const ledgerSummary = await taxLedgerService.getLedgerSummary('tenant-a', 'gst-a-1', 'tp-open-1');
  assert(ledgerSummary.totalOutputLiability === '18000.0000', 'Total output liability tracked accurately');
  assert(ledgerSummary.totalInputCredit === '18000.0000', 'Total input credit tracked accurately');

  console.log('\n----------------------------------------------------');
  console.log(`TOTAL STAGE 4 TESTS: ${totalCount} | PASSED: ${passedCount} | FAILED: ${totalCount - passedCount}`);
  console.log('----------------------------------------------------');

  if (passedCount === totalCount) {
    console.log('STAGE 4 VERIFICATION RESULT: ALL INVOICE & LEDGER TESTS PASSED 100%');
  } else {
    console.error('STAGE 4 VERIFICATION RESULT: TESTS FAILED');
    process.exit(1);
  }
}

function updatedInvStatusIsCancelled(inv: any) {
  return inv.status === 'CANCELLED';
}

runStage4TestSuite();
