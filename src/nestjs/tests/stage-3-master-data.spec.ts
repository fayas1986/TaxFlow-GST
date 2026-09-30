import { CompaniesService } from '../modules/companies/companies.service';
import { GstinService } from '../modules/gstin/gstin.service';
import { BranchesService } from '../modules/branches/branches.service';
import { PartiesService } from '../modules/parties/parties.service';
import { TaxEngineService } from '../modules/tax-engine/tax-engine.service';
import { PrismaService } from '../common/services/prisma.service';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PartyType } from '@prisma/client';

export async function runStage3TestSuite() {
  console.log('====================================================');
  console.log('STAGE 3 MASTER DATA & ISOLATION AUTOMATED TEST SUITE');
  console.log('====================================================\n');

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

  // Mock Storage State for Master Data Testing
  const mockCompanies: any[] = [
    { id: 'c-tenant-a-1', tenantId: 'tenant-a', name: 'Acme India', legalName: 'Acme India Pvt Ltd', pan: 'AAACA1234A' },
    { id: 'c-tenant-b-1', tenantId: 'tenant-b', name: 'Beta Global', legalName: 'Beta Global Pvt Ltd', pan: 'BBBCB5678B' },
  ];

  const mockGstins: any[] = [
    { id: 'gst-a-1', tenantId: 'tenant-a', companyId: 'c-tenant-a-1', gstin: '27AAACA1234A1Z1', stateCode: '27' },
    { id: 'gst-b-1', tenantId: 'tenant-b', companyId: 'c-tenant-b-1', gstin: '29BBBCB5678B1Z2', stateCode: '29' },
  ];

  const mockBranches: any[] = [
    { id: 'br-a-1', tenantId: 'tenant-a', companyId: 'c-tenant-a-1', gstinId: 'gst-a-1', branchCode: 'HO-MUMBAI', stateCode: '27' },
    { id: 'br-b-1', tenantId: 'tenant-b', companyId: 'c-tenant-b-1', gstinId: 'gst-b-1', branchCode: 'HO-BLR', stateCode: '29' },
  ];

  const mockParties: any[] = [
    { id: 'p-a-1', tenantId: 'tenant-a', partyCode: 'CUST-001', legalName: 'Customer Alpha', partyType: 'CUSTOMER' },
    { id: 'p-b-1', tenantId: 'tenant-b', partyCode: 'CUST-002', legalName: 'Customer Beta', partyType: 'CUSTOMER' },
  ];

  // Wire Prisma Service Mocks
  prisma.company.findMany = (async (args: any) => {
    return mockCompanies.filter((c) => c.tenantId === args.where.tenantId);
  }) as any;

  prisma.company.findFirst = (async (args: any) => {
    return mockCompanies.find((c) => c.id === args.where.id && c.tenantId === args.where.tenantId) || null;
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

  const companiesService = new CompaniesService(prisma);
  const gstinService = new GstinService(prisma);
  const branchesService = new BranchesService(prisma);
  const partiesService = new PartiesService(prisma);
  const taxEngineService = new TaxEngineService(prisma);

  // ----------------------------------------------------
  // TEST 1: Tenant A cannot access Tenant B company
  // ----------------------------------------------------
  try {
    await companiesService.findOne('tenant-a', 'c-tenant-b-1');
    assert(false, 'Tenant A accessing Tenant B company must throw NotFoundException');
  } catch (err) {
    assert(err instanceof NotFoundException, 'Tenant A cannot access Tenant B company (NotFoundException)');
  }

  // ----------------------------------------------------
  // TEST 2: Tenant A cannot access Tenant B GSTIN
  // ----------------------------------------------------
  try {
    await gstinService.findOne('tenant-a', 'gst-b-1');
    assert(false, 'Tenant A accessing Tenant B GSTIN must throw NotFoundException');
  } catch (err) {
    assert(err instanceof NotFoundException, 'Tenant A cannot access Tenant B GSTIN (NotFoundException)');
  }

  // ----------------------------------------------------
  // TEST 3: Tenant A cannot access Tenant B branch
  // ----------------------------------------------------
  try {
    await branchesService.findOne('tenant-a', 'br-b-1');
    assert(false, 'Tenant A accessing Tenant B branch must throw NotFoundException');
  } catch (err) {
    assert(err instanceof NotFoundException, 'Tenant A cannot access Tenant B branch (NotFoundException)');
  }

  // ----------------------------------------------------
  // TEST 4: User without branch scope cannot access that branch
  // ----------------------------------------------------
  try {
    await branchesService.findOne('tenant-a', 'br-a-1', ['br-other-allowed']);
    assert(false, 'User without branch scope accessing restricted branch must throw ForbiddenException');
  } catch (err) {
    assert(err instanceof ForbiddenException, 'User without branch scope rejected (ForbiddenException)');
  }

  // ----------------------------------------------------
  // TEST 5: GSTIN cannot be attached to another company or tenant
  // ----------------------------------------------------
  try {
    await gstinService.create('tenant-a', 'u1', {
      companyId: 'c-tenant-b-1', // Company belongs to Tenant B!
      gstin: '27AAACA9999A1Z9',
      legalName: 'Spoofed Company',
      stateCode: '27',
    });
    assert(false, 'Attaching GSTIN to company of another tenant must throw BadRequestException');
  } catch (err) {
    assert(err instanceof BadRequestException, 'Attaching GSTIN to another tenant company fails closed');
  }

  // ----------------------------------------------------
  // TEST 6: Branch cannot be attached to mismatched GST registration
  // ----------------------------------------------------
  try {
    await branchesService.create('tenant-a', 'u1', {
      companyId: 'c-tenant-a-1',
      gstinId: 'gst-b-1', // GSTIN belongs to Tenant B!
      branchCode: 'INVALID-BR',
      name: 'Spoofed Branch',
      stateCode: '27',
    });
    assert(false, 'Attaching branch to mismatched GSTIN/company must throw BadRequestException');
  } catch (err) {
    assert(err instanceof BadRequestException, 'Attaching branch to mismatched company/GSTIN fails closed');
  }

  // ----------------------------------------------------
  // TEST 7: Party records cannot cross tenants
  // ----------------------------------------------------
  try {
    await partiesService.findOne('tenant-a', 'p-b-1');
    assert(false, 'Tenant A accessing Tenant B party must throw NotFoundException');
  } catch (err) {
    assert(err instanceof NotFoundException, 'Party records isolated per tenant boundary');
  }

  // ----------------------------------------------------
  // TEST 8: Tax Calculation Engine Math with Decimal Precision
  // ----------------------------------------------------
  prisma.hsnSacMaster.findFirst = (async (args: any) => ({
    code: '998311',
    description: 'IT Consulting Services',
    igstRate: { toString: () => '18.00' },
    cgstRate: { toString: () => '9.00' },
    sgstRate: { toString: () => '9.00' },
  })) as any;

  // Intrastate Tax Calculation (27 -> 27)
  const intrastate = await taxEngineService.calculateTax({
    supplierStateCode: '27',
    placeOfSupplyStateCode: '27',
    hsnSacCode: '998311',
    taxableValue: 100000,
  });

  assert(intrastate.isInterstate === false, 'Intrastate transaction correctly flagged (CGST+SGST)');
  assert(intrastate.cgstAmount === '9000.0000', 'CGST Amount calculated as ₹9,000.0000');
  assert(intrastate.sgstAmount === '9000.0000', 'SGST Amount calculated as ₹9,000.0000');
  assert(intrastate.igstAmount === '0.0000', 'IGST Amount is 0 for intrastate supply');

  // Interstate Tax Calculation (27 -> 29)
  const interstate = await taxEngineService.calculateTax({
    supplierStateCode: '27',
    placeOfSupplyStateCode: '29',
    hsnSacCode: '998311',
    taxableValue: 100000,
  });

  assert(interstate.isInterstate === true, 'Interstate transaction correctly flagged (IGST)');
  assert(interstate.igstAmount === '18000.0000', 'IGST Amount calculated as ₹18,000.0000');
  assert(interstate.cgstAmount === '0.0000', 'CGST Amount is 0 for interstate supply');

  console.log('\n----------------------------------------------------');
  console.log(`TOTAL STAGE 3 TESTS: ${totalCount} | PASSED: ${passedCount} | FAILED: ${totalCount - passedCount}`);
  console.log('----------------------------------------------------');

  if (passedCount === totalCount) {
    console.log('STAGE 3 VERIFICATION RESULT: ALL MASTER DATA TESTS PASSED 100%');
  } else {
    console.error('STAGE 3 VERIFICATION RESULT: TESTS FAILED');
    process.exit(1);
  }
}

runStage3TestSuite();
