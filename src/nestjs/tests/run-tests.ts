import { TenantContextGuard } from '../common/guards/tenant-context.guard';
import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';

function mockExecutionContext(headers: Record<string, string>, params: any, body: any, user?: any): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers,
        params,
        body,
        user,
      }),
    }),
  } as ExecutionContext;
}

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

async function runVerificationSuite() {
  console.log('====================================================');
  console.log('STAGE 1 & STAGE 2 AUTOMATED VERIFICATION TEST SUITE');
  console.log('====================================================\n');

  const guard = new TenantContextGuard();

  // Test 1: Valid JWT Tenant Context
  try {
    const ctx = mockExecutionContext({}, {}, {}, { userId: 'u1', tenantId: 't-1', role: 'ADMIN' });
    const result = guard.canActivate(ctx);
    assert(result === true, 'Valid JWT tenant context permits request');
  } catch (err) {
    assert(false, 'Valid JWT tenant context permits request');
  }

  // Test 2: Missing Tenant Context Fails Closed
  try {
    const ctx = mockExecutionContext({}, {}, {});
    guard.canActivate(ctx);
    assert(false, 'Missing JWT tenant context must throw UnauthorizedException');
  } catch (err: any) {
    assert(err instanceof UnauthorizedException, 'Missing JWT tenant context throws UnauthorizedException');
  }

  // Test 3: Header Spoofing (x-tenant-id mismatch) Fails Closed
  try {
    const ctx = mockExecutionContext({ 'x-tenant-id': 'tenant-b' }, {}, {}, { userId: 'u1', tenantId: 'tenant-a', role: 'ADMIN' });
    guard.canActivate(ctx);
    assert(false, 'Header spoofing x-tenant-id mismatch must throw ForbiddenException');
  } catch (err: any) {
    assert(err instanceof ForbiddenException, 'Header spoofing x-tenant-id mismatch throws ForbiddenException');
  }

  // Test 4: Body Spoofing (tenantId mismatch) Fails Closed
  try {
    const ctx = mockExecutionContext({}, {}, { tenantId: 'tenant-b' }, { userId: 'u1', tenantId: 'tenant-a', role: 'ADMIN' });
    guard.canActivate(ctx);
    assert(false, 'Body spoofing tenantId mismatch must throw ForbiddenException');
  } catch (err: any) {
    assert(err instanceof ForbiddenException, 'Body spoofing tenantId mismatch throws ForbiddenException');
  }

  // Test 5: Unauthorized Company IDOR Attempt Fails Closed
  try {
    const ctx = mockExecutionContext(
      {},
      { companyId: 'comp-unauthorized' },
      {},
      { userId: 'u1', tenantId: 'tenant-a', role: 'ADMIN', allowedCompanies: ['comp-1', 'comp-2'] }
    );
    guard.canActivate(ctx);
    assert(false, 'Unauthorized company IDOR attempt must throw ForbiddenException');
  } catch (err: any) {
    assert(err instanceof ForbiddenException, 'Unauthorized company IDOR attempt throws ForbiddenException');
  }

  // Test 6: RLS Transaction Context Session Injection
  const prisma = new PrismaService();
  const mockTx = {
    $executeRawUnsafe: async (sql: string) => 1,
  };
  (prisma as any).$transaction = async (callback: any) => callback(mockTx);

  const executedSqls: string[] = [];
  mockTx.$executeRawUnsafe = async (sql: string) => {
    executedSqls.push(sql);
    return 1;
  };

  const tenantId = '11111111-1111-1111-1111-111111111111';
  const companyId = '22222222-2222-2222-2222-222222222222';

  await prisma.withRlsContext(tenantId, companyId, async (tx) => {
    assert(tx === mockTx, 'Transaction object passed to withRlsContext execution block');
  });

  assert(
    executedSqls.includes(`SET LOCAL app.current_tenant_id = '${tenantId}';`),
    `RLS SET LOCAL app.current_tenant_id executed in transaction block`,
  );
  assert(
    executedSqls.includes(`SET LOCAL app.current_company_id = '${companyId}';`),
    `RLS SET LOCAL app.current_company_id executed in transaction block`,
  );

  console.log('\n----------------------------------------------------');
  console.log(`TOTAL TESTS: ${totalCount} | PASSED: ${passedCount} | FAILED: ${totalCount - passedCount}`);
  console.log('----------------------------------------------------');

  if (passedCount === totalCount) {
    console.log('VERIFICATION RESULT: ALL FOUNDATION TESTS PASSED 100%');
  } else {
    console.error('VERIFICATION RESULT: FOUNDATION TESTS FAILED');
    process.exit(1);
  }
}

runVerificationSuite();
