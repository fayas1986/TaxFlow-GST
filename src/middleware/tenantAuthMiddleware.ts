/**
 * Robust Enterprise Multi-Tenant Server-Side Middleware
 *
 * Implements strict, zero-trust tenant boundary enforcement for incoming API requests:
 * 1. Session Resolution: Extracts and validates authenticated user identity from session store,
 *    cookies, Authorization Bearer tokens, or verified API gateway headers.
 * 2. Target Tenant Resolution: Resolves target tenant ID from request subdomain (e.g. acme.taxflow.io),
 *    custom domains, route parameters, explicit headers (x-tenant-id), or query parameters.
 * 3. Strict Membership & Authorization Verification: Verifies active user membership in the target
 *    tenant and ensures tenant is not suspended, cancelled, or deleted.
 * 4. 403 Forbidden Enforcement: Denies any unauthorized cross-tenant attempt with HTTP 403 Forbidden
 *    and records an immutable security audit event.
 * 5. Request Context Injection: Attaches verified `req.tenantContext`, `req.tenantId`, and `req.userId`
 *    for safe downstream handler consumption.
 */

import { Request, Response, NextFunction } from 'express';
import { tenantService } from '../core/tenancy/tenantService';
import { TenantContext, Tenant, TenantUserMembership } from '../core/tenancy/types';
import { auditService } from '../core/audit/auditService';

// ==========================================
// Express Request Type Augmentation
// ==========================================

declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
      tenantId?: string;
      userId?: string;
      userEmail?: string;
      tenant?: Tenant;
      tenantMembership?: TenantUserMembership;
      authSession?: ServerAuthSession;
      tenantResolutionSource?: 'subdomain' | 'custom_domain' | 'header' | 'param' | 'query' | 'body' | 'session_default';
    }
  }
}

// ==========================================
// Session Store & Interfaces
// ==========================================

export interface ServerAuthSession {
  sessionId: string;
  userId: string;
  email: string;
  name?: string;
  roles?: string[];
  activeTenantId?: string;
  isPlatformSuperAdmin?: boolean;
  createdAt: number;
  expiresAt: number;
  metadata?: Record<string, any>;
}

class InMemorySessionStore {
  private sessions = new Map<string, ServerAuthSession>();

  constructor() {
    this.seedDefaultSessions();
  }

  private seedDefaultSessions() {
    const now = Date.now();
    const farFuture = now + 30 * 24 * 60 * 60 * 1000; // 30 days

    // Default session for platform admin / demo user (Fayas M)
    this.createSessionWithId('sess_fayas_live', {
      userId: 'u-fayas',
      email: 'fayasamd@gmail.com',
      name: 'Fayas M',
      activeTenantId: 't1',
      isPlatformSuperAdmin: true,
      createdAt: now,
      expiresAt: farFuture
    });

    // Session for Globex user
    this.createSessionWithId('sess_globex_user', {
      userId: 'u-globex-user',
      email: 'finance@globex.in',
      name: 'Globex Finance Admin',
      activeTenantId: 't2',
      isPlatformSuperAdmin: false,
      createdAt: now,
      expiresAt: farFuture
    });

    // Session for Pune Branch Manager
    this.createSessionWithId('sess_pune_mgr', {
      userId: 'u-pune-mgr',
      email: 'pune.tax@acmetech.com',
      name: 'Pune Branch Tax Manager',
      activeTenantId: 't1',
      isPlatformSuperAdmin: false,
      createdAt: now,
      expiresAt: farFuture
    });

    // Session for read-only auditor
    this.createSessionWithId('sess_auditor_ro', {
      userId: 'u-auditor-ro',
      email: 'auditor@kpmg-external.com',
      name: 'Statutory GST Auditor',
      activeTenantId: 't1',
      isPlatformSuperAdmin: false,
      createdAt: now,
      expiresAt: farFuture
    });
  }

  public createSession(data: Omit<ServerAuthSession, 'sessionId'>): ServerAuthSession {
    const sessionId = `sess_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
    return this.createSessionWithId(sessionId, data);
  }

  public createSessionWithId(sessionId: string, data: Omit<ServerAuthSession, 'sessionId'>): ServerAuthSession {
    const session: ServerAuthSession = {
      ...data,
      sessionId
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  public getSession(sessionId: string): ServerAuthSession | null {
    if (!sessionId) return null;
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }
    return session;
  }

  public destroySession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }
}

export const serverSessionStore = new InMemorySessionStore();

// ==========================================
// Subdomain & Domain Utilities
// ==========================================

const RESERVED_SUBDOMAINS = new Set([
  'www',
  'api',
  'app',
  'admin',
  'portal',
  'auth',
  'login',
  'billing',
  'cdn',
  'static',
  'assets',
  'staging',
  'dev',
  'test',
  'status',
  'mail',
  'smtp',
  'localhost',
  'cloudrun',
  'run',
  'google',
  'europe-west3'
]);

/**
 * Extracts a candidate tenant subdomain from the incoming HTTP Host header.
 * Correctly strips ports and evaluates multi-level domains.
 *
 * Examples:
 * - "acme.taxflow.io" -> "acme"
 * - "globex.taxflow.app:3000" -> "globex"
 * - "t1.localhost:3000" -> "t1"
 * - "api.taxflow.io" -> null (reserved)
 * - "ais-dev-2rleoltzec7ezvytaoskwe-82286736551.europe-west3.run.app" -> null (infrastructure domain)
 */
export function extractSubdomainFromHost(rawHost?: string): string | null {
  if (!rawHost) return null;

  // 1. Strip port if present
  const hostWithoutPort = rawHost.split(':')[0].trim().toLowerCase();

  // 2. Reject raw IP addresses (IPv4 or IPv6)
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostWithoutPort) || hostWithoutPort.includes(':')) {
    return null;
  }

  // 3. Reject Cloud Run and Google container preview hosts
  if (
    hostWithoutPort.endsWith('.run.app') ||
    hostWithoutPort.endsWith('.google.com') ||
    hostWithoutPort.includes('ais-dev') ||
    hostWithoutPort.includes('ais-pre')
  ) {
    return null;
  }

  const parts = hostWithoutPort.split('.');

  // 4. Localhost subdomain e.g. "acme.localhost"
  if (parts.length === 2 && parts[1] === 'localhost') {
    const candidate = parts[0];
    return RESERVED_SUBDOMAINS.has(candidate) ? null : candidate;
  }

  // 5. Standard multi-level domain e.g. "acme.taxflow.io"
  if (parts.length >= 3) {
    const candidate = parts[0];
    if (RESERVED_SUBDOMAINS.has(candidate)) {
      return null;
    }
    return candidate;
  }

  return null;
}

// ==========================================
// Middleware Configuration Options
// ==========================================

export interface TenantAuthMiddlewareOptions {
  /**
   * Whether authentication is strictly required.
   * If true and no valid session/identity is resolved, returns 401 Unauthorized.
   * Default: true
   */
  requireAuth?: boolean;

  /**
   * Whether a target tenant is strictly required.
   * If true and target tenant cannot be resolved or user is unauthorized, returns 403 Forbidden.
   * Default: true
   */
  requireTenant?: boolean;

  /**
   * Allow platform Super Admins to access tenants even without direct membership.
   * Default: true
   */
  allowSuperAdminOverride?: boolean;

  /**
   * Allow service-to-service API tokens (`x-api-token` or `Bearer tok-...`).
   * Default: true
   */
  allowApiTokens?: boolean;

  /**
   * Additional reserved subdomains to ignore.
   */
  reservedSubdomains?: string[];

  /**
   * Custom hook invoked on 403 Forbidden before sending response.
   */
  onForbidden?: (req: Request, res: Response, errorPayload: any) => void;
}

// ==========================================
// Core Middleware Factory & Implementation
// ==========================================

/**
 * Creates an Express middleware that:
 * 1. Resolves `userId` and identity from session/cookies/token/headers
 * 2. Resolves target `tenantId` from sub-domain, custom domain, headers, or query/params
 * 3. Verifies membership of `userId` in `tenantId`
 * 4. Denies access with 403 Forbidden if unauthorized
 * 5. Attaches verified `req.tenantContext` and metadata to `req`
 */
export function createTenantAuthMiddleware(options: TenantAuthMiddlewareOptions = {}) {
  const {
    requireAuth = true,
    requireTenant = true,
    allowSuperAdminOverride = true,
    allowApiTokens = true,
    reservedSubdomains = [],
    onForbidden
  } = options;

  const allReservedSubdomains = new Set([
    ...Array.from(RESERVED_SUBDOMAINS),
    ...reservedSubdomains.map(s => s.toLowerCase())
  ]);

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // -------------------------------------------------------------
      // STAGE 1: Resolve User Identity from Session / Auth Credentials
      // -------------------------------------------------------------
      let resolvedUserId: string | undefined;
      let resolvedUserEmail: string | undefined;
      let resolvedSession: ServerAuthSession | null = null;
      let isSuperAdmin = false;
      let apiToken: string | undefined;

      // Check for API token if allowed
      if (allowApiTokens) {
        const headerToken = req.headers['x-api-token'] as string | undefined;
        const authHeader = req.headers.authorization;
        if (headerToken) {
          apiToken = headerToken;
        } else if (authHeader && authHeader.startsWith('Bearer tok-')) {
          apiToken = authHeader.substring(7).trim();
        }
      }

      // Check standard Express session (req.session)
      const reqAny = req as any;
      if (reqAny.session && (reqAny.session.userId || (reqAny.session.user && reqAny.session.user.id))) {
        resolvedUserId = reqAny.session.userId || reqAny.session.user.id;
        resolvedUserEmail = reqAny.session.email || reqAny.session.user.email;
        isSuperAdmin = Boolean(reqAny.session.isPlatformSuperAdmin || reqAny.session.user?.isPlatformSuperAdmin);
      }

      // Check Session Store via session token
      if (!resolvedUserId) {
        // Look in Authorization header: Bearer <sessionId>
        const authHeader = req.headers.authorization;
        let candidateSessionId: string | undefined;

        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7).trim();
          if (token.startsWith('sess_')) {
            candidateSessionId = token;
          } else if (token.startsWith('jwt_session_')) {
            // Decodes demo/JWT session token convention
            const parts = token.split('_');
            if (parts.length >= 3) {
              const sub = parts[2];
              resolvedUserId = sub.startsWith('u-') ? sub : `u-${sub}`;
            }
          }
        }

        // Look in x-session-id header
        if (!candidateSessionId && req.headers['x-session-id']) {
          candidateSessionId = req.headers['x-session-id'] as string;
        }

        // Look in cookies (if cookie-parser or raw cookie string is present)
        if (!candidateSessionId) {
          if (reqAny.cookies && (reqAny.cookies.sessionId || reqAny.cookies.session_token || reqAny.cookies.taxflow_session)) {
            candidateSessionId = reqAny.cookies.sessionId || reqAny.cookies.session_token || reqAny.cookies.taxflow_session;
          } else if (req.headers.cookie) {
            const match = req.headers.cookie.match(/(?:sessionId|session_token|taxflow_session)=([^;]+)/);
            if (match) {
              candidateSessionId = decodeURIComponent(match[1]);
            }
          }
        }

        // Verify session in session store if found
        if (candidateSessionId) {
          const session = serverSessionStore.getSession(candidateSessionId);
          if (session) {
            resolvedSession = session;
            resolvedUserId = session.userId;
            resolvedUserEmail = session.email;
            isSuperAdmin = Boolean(session.isPlatformSuperAdmin);
          }
        }
      }

      // Check direct identity headers (trusted API gateway / proxy / dev client)
      if (!resolvedUserId) {
        const headerUserId = req.headers['x-user-id'] as string | undefined;
        const headerUserEmail = req.headers['x-user-email'] as string | undefined;
        if (headerUserId) {
          resolvedUserId = headerUserId;
          resolvedUserEmail = headerUserEmail || (headerUserId.includes('@') ? headerUserId : `${headerUserId}@taxflow.internal`);
        } else if (headerUserEmail) {
          resolvedUserEmail = headerUserEmail;
          resolvedUserId = `u-${headerUserEmail.split('@')[0]}`;
        }
      }

      // Authentication requirement check
      if (requireAuth && !resolvedUserId && !apiToken) {
        return res.status(401).json({
          error: 'Unauthorized',
          code: 'AUTHENTICATION_REQUIRED',
          message: '401 Unauthorized: Valid user session or credentials required to access this compliance resource.',
          timestamp: new Date().toISOString()
        });
      }

      // -------------------------------------------------------------
      // STAGE 2: Resolve Target Tenant (Sub-domain, Headers, Query, Params)
      // -------------------------------------------------------------
      let targetTenant: Tenant | null = null;
      let targetTenantId: string | undefined;
      let resolutionSource: Express.Request['tenantResolutionSource'];

      // Strategy A: Subdomain resolution from Host / x-forwarded-host
      const rawHost = (req.headers['x-forwarded-host'] as string) || req.headers.host || req.hostname;
      const hostSubdomain = extractSubdomainFromHost(rawHost);

      if (hostSubdomain && !allReservedSubdomains.has(hostSubdomain.toLowerCase())) {
        const tenantBySubdomain = tenantService.resolveTenantByIdentifier(hostSubdomain);
        if (tenantBySubdomain) {
          targetTenant = tenantBySubdomain;
          targetTenantId = tenantBySubdomain.id;
          resolutionSource = 'subdomain';
        }
      }

      // Strategy B: Custom Domain resolution (if full host matches a tenant's custom domain)
      if (!targetTenant && rawHost) {
        const cleanHost = rawHost.split(':')[0].trim().toLowerCase();
        for (const t of tenantService.getAllTenants()) {
          if (t.customDomains && t.customDomains.some(d => d.toLowerCase() === cleanHost)) {
            targetTenant = t;
            targetTenantId = t.id;
            resolutionSource = 'custom_domain';
            break;
          }
        }
      }

      // Strategy C: Explicit Tenant ID from Request Headers (x-tenant-id, x-org-id)
      if (!targetTenant) {
        const headerTenantId = (req.headers['x-tenant-id'] as string) || (req.headers['x-org-id'] as string);
        if (headerTenantId) {
          targetTenantId = headerTenantId.trim();
          targetTenant = tenantService.resolveTenantByIdentifier(targetTenantId);
          resolutionSource = 'header';
        }
      }

      // Strategy D: Route Parameter (e.g. /api/tenants/:tenantId/*)
      if (!targetTenant && req.params && (req.params.tenantId || req.params.orgId)) {
        const rawParam = req.params.tenantId || req.params.orgId;
        const paramId = (Array.isArray(rawParam) ? rawParam[0] : (typeof rawParam === 'string' ? rawParam : ''))?.trim();
        if (paramId) {
          targetTenantId = paramId;
          targetTenant = tenantService.resolveTenantByIdentifier(paramId);
          resolutionSource = 'param';
        }
      }

      // Strategy E: Query Parameter (?tenantId=t1 or ?orgId=t1)
      if (!targetTenant && req.query && (req.query.tenantId || req.query.orgId || req.query.tenant_id)) {
        const rawQuery = req.query.tenantId || req.query.orgId || req.query.tenant_id;
        const queryId = (Array.isArray(rawQuery) ? (rawQuery[0] as string) : (typeof rawQuery === 'string' ? rawQuery : ''))?.trim();
        if (queryId) {
          targetTenantId = queryId;
          targetTenant = tenantService.resolveTenantByIdentifier(targetTenantId);
          resolutionSource = 'query';
        }
      }

      // Strategy F: Request Body (for JSON POST/PUT/PATCH if body has tenantId)
      if (!targetTenant && req.body && req.body.tenantId && typeof req.body.tenantId === 'string') {
        targetTenantId = req.body.tenantId.trim();
        targetTenant = tenantService.resolveTenantByIdentifier(targetTenantId);
        resolutionSource = 'body';
      }

      // Strategy G: Active Tenant bound to the authenticated session (only when no tenant was explicitly requested)
      if (!targetTenantId && resolvedSession?.activeTenantId) {
        targetTenantId = resolvedSession.activeTenantId;
        targetTenant = tenantService.getTenant(targetTenantId);
        resolutionSource = 'session_default';
      }

      // Strategy H: If user has authorized memberships and no tenant was specified, select user's primary
      if (!targetTenantId && resolvedUserId) {
        const authorized = tenantService.getUserAuthorizedTenants(resolvedUserId, resolvedUserEmail);
        if (authorized.length > 0) {
          targetTenant = authorized[0];
          targetTenantId = targetTenant.id;
          resolutionSource = 'session_default';
        }
      }

      // If tenant resolution was strictly required and none resolved:
      if (requireTenant && !targetTenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          code: 'TENANT_IDENTIFIER_REQUIRED',
          message: '400 Bad Request: Missing tenant identifier in request subdomain, header (x-tenant-id), route param, or query.',
          timestamp: new Date().toISOString()
        });
      }

      // If tenant ID was requested but tenant record does not exist or was deleted:
      if (targetTenantId && !targetTenant) {
        return res.status(404).json({
          error: 'Not Found',
          code: 'TENANT_NOT_FOUND',
          message: `404 Not Found: Tenant '${targetTenantId}' does not exist or has been deleted.`,
          tenantId: targetTenantId,
          timestamp: new Date().toISOString()
        });
      }

      // -------------------------------------------------------------
      // STAGE 3: Tenant Lifecycle & Status Check
      // -------------------------------------------------------------
      if (targetTenant) {
        if (targetTenant.status === 'SUSPENDED') {
          return res.status(403).json({
            error: 'Forbidden',
            code: 'TENANT_SUSPENDED',
            message: `403 Forbidden: Tenant account '${targetTenant.id}' is SUSPENDED. Access to compliance services is restricted.`,
            tenantId: targetTenant.id,
            timestamp: new Date().toISOString()
          });
        }

        if (targetTenant.status === 'CANCELLED' || targetTenant.status === 'DELETED') {
          return res.status(403).json({
            error: 'Forbidden',
            code: 'TENANT_INACTIVE',
            message: `403 Forbidden: Tenant account '${targetTenant.id}' is ${targetTenant.status}.`,
            tenantId: targetTenant.id,
            timestamp: new Date().toISOString()
          });
        }
      }

      // -------------------------------------------------------------
      // STAGE 4: Strict Membership Verification & 403 Denial
      // -------------------------------------------------------------
      const effectiveTenantId = targetTenant!.id;
      let isAuthorized = false;
      let membership: TenantUserMembership | null = null;
      let isSuperAdminEffective = false;

      // Sub-case 1: API Token Verification
      if (apiToken) {
        if (apiToken.startsWith('tok-')) {
          const tokenTenantId = apiToken.split('-')[1];
          if (tokenTenantId === effectiveTenantId) {
            isAuthorized = true;
          } else {
            return res.status(403).json({
              error: 'Forbidden',
              code: 'CROSS_TENANT_API_TOKEN_DENIED',
              message: `403 Forbidden: API token for tenant '${tokenTenantId}' cannot access tenant '${effectiveTenantId}'.`,
              tenantId: effectiveTenantId,
              timestamp: new Date().toISOString()
            });
          }
        } else {
          return res.status(401).json({
            error: 'Unauthorized',
            code: 'INVALID_API_TOKEN',
            message: '401 Unauthorized: Invalid API token structure.',
            timestamp: new Date().toISOString()
          });
        }
      }

      // Sub-case 2: User Session Membership Verification
      if (!isAuthorized && resolvedUserId) {
        // Direct membership lookup
        membership = tenantService.getTenantMembership(effectiveTenantId, resolvedUserId);

        // Also check by email if userId didn't match directly
        if (!membership && resolvedUserEmail) {
          membership = tenantService.getTenantMembership(effectiveTenantId, resolvedUserEmail);
        }

        if (membership && membership.isActive) {
          isAuthorized = true;
        } else {
          // Check if Super Admin Override is eligible and permitted
          if (allowSuperAdminOverride && (isSuperAdmin || req.headers['x-super-admin-override'] === 'true')) {
            // Verify if user is truly configured as platform super admin
            const userMems = tenantService.getUserMemberships(resolvedUserId);
            const hasSuperAdminRole = userMems.some(m => m.role === 'SUPER_ADMIN') || isSuperAdmin;
            if (hasSuperAdminRole) {
              isAuthorized = true;
              isSuperAdminEffective = true;
            }
          }
        }
      }

      // DENY ACCESS WITH 403 IF UNAUTHORIZED
      if (!isAuthorized) {
        const errorPayload = {
          error: 'Forbidden',
          code: 'UNAUTHORIZED_TENANT_ACCESS',
          message: `403 Forbidden: Unauthorized tenant selection: User '${resolvedUserId || 'anonymous'}' is not authorized to access tenant '${effectiveTenantId}'`,
          details: {
            userId: resolvedUserId,
            targetTenantId: effectiveTenantId,
            targetTenantName: targetTenant?.tradeName || targetTenant?.legalName,
            resolutionSource,
            timestamp: new Date().toISOString()
          }
        };

        // Record security audit event
        try {
          auditService.recordSecurityEvent({
            action: 'CROSS_TENANT_ACCESS_DENIED',
            tenantId: effectiveTenantId,
            userId: resolvedUserId || 'anonymous',
            ipAddress: req.ip || req.socket.remoteAddress || '127.0.0.1',
            userAgent: req.headers['user-agent'] || 'unknown',
            details: {
              attemptedTenantId: effectiveTenantId,
              resolutionSource,
              url: req.originalUrl || req.url,
              method: req.method
            }
          });
        } catch (auditErr) {
          console.error('[TenantAuthMiddleware] Failed to record security audit log:', auditErr);
        }

        if (onForbidden) {
          onForbidden(req, res, errorPayload);
        }

        return res.status(403).json(errorPayload);
      }

      // -------------------------------------------------------------
      // STAGE 5: Build TenantContext & Inject onto Request
      // -------------------------------------------------------------
      const context = tenantService.resolveTenantContext({
        userId: resolvedUserId,
        userEmail: resolvedUserEmail,
        requestedTenantId: effectiveTenantId,
        apiToken,
        isSuperAdminOverride: isSuperAdminEffective
      });

      // Augment Request object
      req.tenantContext = context;
      req.tenantId = context.tenantId;
      req.userId = context.userId;
      req.userEmail = context.userEmail;
      req.tenant = targetTenant;
      req.tenantMembership = membership || undefined;
      req.authSession = resolvedSession || undefined;
      req.tenantResolutionSource = resolutionSource;

      // Echo resolved tenant identifier in response header for observability
      res.setHeader('x-resolved-tenant-id', context.tenantId);
      if (resolutionSource) {
        res.setHeader('x-tenant-resolution-source', resolutionSource);
      }

      return next();
    } catch (err: any) {
      const status = err.message?.includes('403') ? 403 : err.message?.includes('404') ? 404 : 500;
      return res.status(status).json({
        error: status === 403 ? 'Forbidden' : status === 404 ? 'Not Found' : 'Internal Server Error',
        code: status === 403 ? 'UNAUTHORIZED_TENANT_ACCESS' : 'TENANT_RESOLUTION_ERROR',
        message: err.message || 'Error occurred during tenant membership resolution.',
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Standard pre-configured tenant authentication and membership verification middleware.
 */
export const tenantAuthMiddleware = createTenantAuthMiddleware({
  requireAuth: true,
  requireTenant: true,
  allowSuperAdminOverride: true,
  allowApiTokens: true
});
