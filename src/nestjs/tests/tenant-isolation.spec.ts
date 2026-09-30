import { TenantContextGuard } from '../common/guards/tenant-context.guard';
import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';

describe('Tenant Isolation & Boundary Security Tests', () => {
  let guard: TenantContextGuard;

  beforeEach(() => {
    guard = new TenantContextGuard();
  });

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

  test('PASS: Valid JWT tenant context permits access', () => {
    const ctx = mockExecutionContext(
      {},
      {},
      {},
      { userId: 'user-1', tenantId: 'tenant-a', role: 'ADMIN' },
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  test('FAIL CLOSED: Missing JWT user or tenant context throws UnauthorizedException', () => {
    const ctx = mockExecutionContext({}, {}, {});
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  test('FAIL CLOSED: Header spoofing attempt (x-tenant-id mismatch) throws ForbiddenException', () => {
    const ctx = mockExecutionContext(
      { 'x-tenant-id': 'tenant-b' },
      {},
      {},
      { userId: 'user-1', tenantId: 'tenant-a', role: 'ADMIN' },
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  test('FAIL CLOSED: Body tenantId spoofing attempt throws ForbiddenException', () => {
    const ctx = mockExecutionContext(
      {},
      {},
      { tenantId: 'tenant-b' },
      { userId: 'user-1', tenantId: 'tenant-a', role: 'ADMIN' },
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  test('FAIL CLOSED: Unauthorized company access attempt throws ForbiddenException', () => {
    const ctx = mockExecutionContext(
      {},
      { companyId: 'comp-other' },
      {},
      {
        userId: 'user-1',
        tenantId: 'tenant-a',
        role: 'ADMIN',
        allowedCompanies: ['comp-allowed-1', 'comp-allowed-2'],
      },
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
