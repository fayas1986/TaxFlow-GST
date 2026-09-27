/**
 * Comprehensive Test Suite for Server-Side Tenant Authentication Middleware
 * Validates:
 * 1. Session resolution from session store, cookies, bearer tokens, headers
 * 2. Target tenant resolution from sub-domain, custom domain, header, params, query
 * 3. Strict 403 Forbidden denial for unauthorized cross-tenant attempts
 * 4. Tenant lifecycle check (403 for suspended or deleted tenants)
 * 5. Successful context injection and audit logging
 */

import {
  createTenantAuthMiddleware,
  extractSubdomainFromHost,
  serverSessionStore
} from '../../middleware/tenantAuthMiddleware';
import { tenantService } from '../tenancy/tenantService';
import { auditService } from '../audit/auditService';

export interface MiddlewareTestResult {
  id: number;
  name: string;
  category: string;
  status: 'PASSED' | 'FAILED';
  expected: string;
  actual: string;
  durationMs: number;
}

export class ServerTenantAuthMiddlewareTestSuite {
  public static async runAllTests(): Promise<{
    passedCount: number;
    failedCount: number;
    totalCount: number;
    allPassed: boolean;
    results: MiddlewareTestResult[];
  }> {
    const results: MiddlewareTestResult[] = [];
    const middleware = createTenantAuthMiddleware({
      requireAuth: true,
      requireTenant: true,
      allowSuperAdminOverride: true,
      allowApiTokens: true
    });

    // Helper to mock Express Request / Response
    const createMockReqRes = (options: {
      headers?: Record<string, string>;
      hostname?: string;
      query?: Record<string, any>;
      params?: Record<string, any>;
      body?: Record<string, any>;
      session?: any;
    }) => {
      const headers = { ...(options.headers || {}) };
      if (options.hostname && !headers.host) {
        headers.host = options.hostname;
      }

      const req: any = {
        headers,
        hostname: options.hostname || (headers.host ? headers.host.split(':')[0] : 'localhost'),
        query: options.query || {},
        params: options.params || {},
        body: options.body || {},
        session: options.session,
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
        originalUrl: '/api/v1/tenancy/invoices',
        method: 'GET'
      };

      let statusCode = 200;
      let responseBody: any = null;
      let nextCalled = false;
      const responseHeaders: Record<string, string> = {};

      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (data: any) => {
          responseBody = data;
          return res;
        },
        setHeader: (key: string, val: string) => {
          responseHeaders[key.toLowerCase()] = val;
        }
      };

      const next = () => {
        nextCalled = true;
      };

      return { req, res, next, getStatus: () => statusCode, getBody: () => responseBody, isNextCalled: () => nextCalled, getHeaders: () => responseHeaders };
    };

    // -------------------------------------------------------------
    // TEST 1: Extract valid subdomain from Host header
    // -------------------------------------------------------------
    {
      const start = Date.now();
      const sub1 = extractSubdomainFromHost('acme.taxflow.io');
      const sub2 = extractSubdomainFromHost('globex.app.local:3000');
      const passed = sub1 === 'acme' && sub2 === 'globex';

      results.push({
        id: 1,
        name: 'Subdomain extractor identifies tenant slugs from multi-level hosts',
        category: 'Subdomain Resolution',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'acme, globex',
        actual: `${sub1}, ${sub2}`,
        durationMs: Date.now() - start
      });
    }

    // -------------------------------------------------------------
    // TEST 2: Reserved subdomains and infrastructure hosts are filtered out
    // -------------------------------------------------------------
    {
      const start = Date.now();
      const r1 = extractSubdomainFromHost('api.taxflow.io');
      const r2 = extractSubdomainFromHost('www.taxflow.io');
      const r3 = extractSubdomainFromHost('ais-dev-preview-app.europe-west3.run.app');
      const passed = r1 === null && r2 === null && r3 === null;

      results.push({
        id: 2,
        name: 'Subdomain extractor safely filters out reserved & cloud run domains',
        category: 'Subdomain Resolution',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'null, null, null',
        actual: `${r1}, ${r2}, ${r3}`,
        durationMs: Date.now() - start
      });
    }

    // -------------------------------------------------------------
    // TEST 3: Unauthenticated request returns 401 Unauthorized
    // -------------------------------------------------------------
    {
      const start = Date.now();
      const { req, res, next, getStatus, getBody, isNextCalled } = createMockReqRes({
        headers: {} // No session or user headers
      });

      middleware(req, res, next);
      const passed = getStatus() === 401 && !isNextCalled() && getBody()?.code === 'AUTHENTICATION_REQUIRED';

      results.push({
        id: 3,
        name: 'Unauthenticated API request denied at middleware boundary with 401',
        category: 'Authentication Enforcement',
        status: passed ? 'PASSED' : 'FAILED',
        expected: '401 Unauthorized [AUTHENTICATION_REQUIRED]',
        actual: `${getStatus()} [${getBody()?.code}]`,
        durationMs: Date.now() - start
      });
    }

    // -------------------------------------------------------------
    // TEST 4: Session resolved from session store via Authorization Bearer token
    // -------------------------------------------------------------
    {
      const start = Date.now();
      const { req, res, next, getStatus, isNextCalled } = createMockReqRes({
        headers: {
          authorization: 'Bearer sess_fayas_live',
          'x-tenant-id': 't1'
        }
      });

      middleware(req, res, next);
      const passed = getStatus() === 200 && isNextCalled() && req.userId === 'u-fayas' && req.tenantId === 't1';

      results.push({
        id: 4,
        name: 'Authenticated user resolved from session store Bearer token',
        category: 'Session Resolution',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'User: u-fayas, Tenant: t1, Status: 200',
        actual: `User: ${req.userId}, Tenant: ${req.tenantId}, Status: ${getStatus()}`,
        durationMs: Date.now() - start
      });
    }

    // -------------------------------------------------------------
    // TEST 5: Target tenant resolved from sub-domain host header
    // -------------------------------------------------------------
    {
      const start = Date.now();
      const { req, res, next, getStatus, isNextCalled } = createMockReqRes({
        hostname: 'globex.taxflow.io',
        headers: {
          'x-session-id': 'sess_globex_user'
        }
      });

      middleware(req, res, next);
      const passed = getStatus() === 200 && isNextCalled() && req.tenantId === 't2' && req.tenantResolutionSource === 'subdomain';

      results.push({
        id: 5,
        name: 'Target tenant accurately resolved from incoming sub-domain (globex.taxflow.io -> t2)',
        category: 'Subdomain Resolution',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'Tenant: t2, Source: subdomain, Status: 200',
        actual: `Tenant: ${req.tenantId}, Source: ${req.tenantResolutionSource}, Status: ${getStatus()}`,
        durationMs: Date.now() - start
      });
    }

    // -------------------------------------------------------------
    // TEST 6: Unauthorized cross-tenant access DENIED WITH 403 FORBIDDEN
    // -------------------------------------------------------------
    {
      const start = Date.now();
      // u-globex-user is ONLY a member of t2 (Globex). Trying to access t1 (Acme) via subdomain or header
      const { req, res, next, getStatus, getBody, isNextCalled } = createMockReqRes({
        hostname: 'acme.taxflow.io',
        headers: {
          'x-session-id': 'sess_globex_user'
        }
      });

      middleware(req, res, next);
      const passed = getStatus() === 403 && !isNextCalled() && getBody()?.code === 'UNAUTHORIZED_TENANT_ACCESS';

      results.push({
        id: 6,
        name: 'Unauthorized user attempting cross-tenant access is DENIED with 403 Forbidden',
        category: 'Tenancy Boundary Enforcement',
        status: passed ? 'PASSED' : 'FAILED',
        expected: '403 Forbidden [UNAUTHORIZED_TENANT_ACCESS]',
        actual: `${getStatus()} [${getBody()?.code}]: ${getBody()?.message}`,
        durationMs: Date.now() - start
      });
    }

    // -------------------------------------------------------------
    // TEST 7: Cross-tenant attack via explicit x-tenant-id header is DENIED with 403
    // -------------------------------------------------------------
    {
      const start = Date.now();
      // u-globex-user forging header x-tenant-id: t1
      const { req, res, next, getStatus, getBody, isNextCalled } = createMockReqRes({
        headers: {
          'x-user-id': 'u-globex-user',
          'x-tenant-id': 't1'
        }
      });

      middleware(req, res, next);
      const passed = getStatus() === 403 && !isNextCalled() && getBody()?.error === 'Forbidden';

      results.push({
        id: 7,
        name: 'Forged x-tenant-id header without valid membership is strictly DENIED with 403',
        category: 'Tenancy Boundary Enforcement',
        status: passed ? 'PASSED' : 'FAILED',
        expected: '403 Forbidden',
        actual: `${getStatus()} ${getBody()?.error}`,
        durationMs: Date.now() - start
      });
    }

    // -------------------------------------------------------------
    // TEST 8: Suspended tenant access is DENIED WITH 403 Forbidden
    // -------------------------------------------------------------
    {
      const start = Date.now();
      // Tenant t4 is SUSPENDED
      const { req, res, next, getStatus, getBody, isNextCalled } = createMockReqRes({
        hostname: 'defunct.taxflow.io',
        headers: {
          'x-user-id': 'u-fayas'
        }
      });

      middleware(req, res, next);
      const passed = getStatus() === 403 && !isNextCalled() && getBody()?.code === 'TENANT_SUSPENDED';

      results.push({
        id: 8,
        name: 'Access to SUSPENDED tenant is DENIED with 403 Forbidden',
        category: 'Lifecycle Protection',
        status: passed ? 'PASSED' : 'FAILED',
        expected: '403 Forbidden [TENANT_SUSPENDED]',
        actual: `${getStatus()} [${getBody()?.code}]`,
        durationMs: Date.now() - start
      });
    }

    // -------------------------------------------------------------
    // TEST 9: Non-existent tenant returns 404 Not Found
    // -------------------------------------------------------------
    {
      const start = Date.now();
      const { req, res, next, getStatus, getBody, isNextCalled } = createMockReqRes({
        headers: {
          'x-user-id': 'u-fayas',
          'x-tenant-id': 't999_non_existent'
        }
      });

      middleware(req, res, next);
      const passed = getStatus() === 404 && !isNextCalled() && getBody()?.code === 'TENANT_NOT_FOUND';

      results.push({
        id: 9,
        name: 'Request targeting non-existent tenant returns 404 Not Found',
        category: 'Tenant Resolution',
        status: passed ? 'PASSED' : 'FAILED',
        expected: '404 Not Found [TENANT_NOT_FOUND]',
        actual: `${getStatus()} [${getBody()?.code}]`,
        durationMs: Date.now() - start
      });
    }

    // -------------------------------------------------------------
    // TEST 10: Authorized user has full TenantContext injected onto Request
    // -------------------------------------------------------------
    {
      const start = Date.now();
      const { req, res, next, getStatus, isNextCalled, getHeaders } = createMockReqRes({
        hostname: 'acme.taxflow.io',
        headers: {
          authorization: 'Bearer sess_fayas_live'
        }
      });

      middleware(req, res, next);
      const passed =
        getStatus() === 200 &&
        isNextCalled() &&
        req.tenantContext?.tenantId === 't1' &&
        req.tenantContext?.userId === 'u-fayas' &&
        req.tenantContext?.role === 'SUPER_ADMIN' &&
        getHeaders()['x-resolved-tenant-id'] === 't1';

      results.push({
        id: 10,
        name: 'Authorized request has fully populated TenantContext & response observability header',
        category: 'Context Injection',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'Tenant: t1, User: u-fayas, Role: SUPER_ADMIN, Header: t1',
        actual: `Tenant: ${req.tenantContext?.tenantId}, User: ${req.tenantContext?.userId}, Role: ${req.tenantContext?.role}, Header: ${getHeaders()['x-resolved-tenant-id']}`,
        durationMs: Date.now() - start
      });
    }

    // -------------------------------------------------------------
    // TEST 11: Cross-tenant API token is rejected with 403
    // -------------------------------------------------------------
    {
      const start = Date.now();
      // Token for t1 trying to access t2
      const { req, res, next, getStatus, getBody, isNextCalled } = createMockReqRes({
        headers: {
          'x-api-token': 'tok-t1-secretxyz',
          'x-tenant-id': 't2'
        }
      });

      middleware(req, res, next);
      const passed = getStatus() === 403 && !isNextCalled() && getBody()?.code === 'CROSS_TENANT_API_TOKEN_DENIED';

      results.push({
        id: 11,
        name: 'Cross-tenant API token spoofing is rejected with 403 Forbidden',
        category: 'API Token Security',
        status: passed ? 'PASSED' : 'FAILED',
        expected: '403 Forbidden [CROSS_TENANT_API_TOKEN_DENIED]',
        actual: `${getStatus()} [${getBody()?.code}]`,
        durationMs: Date.now() - start
      });
    }

    // -------------------------------------------------------------
    // TEST 12: Unauthorized attempt triggers security audit event recording
    // -------------------------------------------------------------
    {
      const start = Date.now();
      // Trigger unauthorized attempt
      const { req, res, next } = createMockReqRes({
        headers: {
          'x-user-id': 'u-globex-user',
          'x-tenant-id': 't1'
        }
      });

      middleware(req, res, next);

      // Verify audit service recorded security event for t1
      const superAdminLogs = auditService.getPlatformSuperAdminLogs({
        tenantId: 't1',
        userId: 'u-fayas',
        userEmail: 'fayasamd@gmail.com',
        role: 'SUPER_ADMIN',
        plan: 'ENTERPRISE',
        permissions: [] as any,
        assignedGstinIds: 'ALL',
        assignedBranchIds: 'ALL',
        isReadOnly: false,
        isPlatformSuperAdmin: true
      });

      const securityEvent = superAdminLogs.find(l => l.action === 'CROSS_TENANT_ACCESS_DENIED' && l.userId === 'u-globex-user');
      const passed = Boolean(securityEvent && securityEvent.status === 'FAILURE');

      results.push({
        id: 12,
        name: 'Unauthorized cross-tenant attempt produces immutable security audit log event',
        category: 'Audit & Compliance',
        status: passed ? 'PASSED' : 'FAILED',
        expected: 'Recorded CROSS_TENANT_ACCESS_DENIED with status FAILURE',
        actual: securityEvent ? `${securityEvent.action} (${securityEvent.status})` : 'No audit event found',
        durationMs: Date.now() - start
      });
    }

    const passedCount = results.filter(r => r.status === 'PASSED').length;
    const failedCount = results.filter(r => r.status === 'FAILED').length;

    return {
      passedCount,
      failedCount,
      totalCount: results.length,
      allPassed: failedCount === 0,
      results
    };
  }
}
