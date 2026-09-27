/**
 * Core Authentication & Session Token Resolution
 */

import { TenantContext } from '../tenancy/types';
import { tenantService } from '../tenancy/tenantService';

export interface UserSession {
  userId: string;
  email: string;
  name: string;
  authToken: string;
  activeTenantId: string;
  availableTenantIds: string[];
}

export class AuthService {
  public static verifySession(authToken?: string): UserSession {
    // In production, verifies JWT/OAuth session token
    return {
      userId: 'u-fayas',
      email: 'fayasamd@gmail.com',
      name: 'Fayas M',
      authToken: authToken || 'jwt_session_fayas_live',
      activeTenantId: 't1',
      availableTenantIds: ['t1', 't2']
    };
  }

  public static getContextForRequest(reqHeaders: Record<string, string | string[] | undefined>): TenantContext {
    const tenantId = (reqHeaders['x-tenant-id'] as string) || 't1';
    const userId = (reqHeaders['x-user-id'] as string) || 'u-fayas';
    const email = (reqHeaders['x-user-email'] as string) || 'fayasamd@gmail.com';
    const apiToken = reqHeaders['x-api-token'] as string | undefined;

    return tenantService.resolveTenantContext({
      userId,
      userEmail: email,
      requestedTenantId: tenantId,
      apiToken
    });
  }
}
