/**
 * Tenant-Isolated Cache Service
 * Mandates all cache keys follow the format: tenant:{tenantId}:{subsystem}:{key}
 * Rejects any cross-tenant cache access attempts.
 */

import { TenantContext } from '../../core/tenancy/types';

interface CacheEntry {
  tenantId: string;
  subsystem: string;
  key: string;
  value: any;
  expiresAt: number;
}

class TenantIsolatedCacheService {
  private cacheStore: Map<string, CacheEntry> = new Map();

  /**
   * Generates strictly isolated cache key
   */
  public buildKey(tenantId: string, subsystem: string, key: string): string {
    return `tenant:${tenantId}:${subsystem}:${key}`;
  }

  /**
   * Store item in cache scoped strictly to ctx.tenantId
   */
  public set(ctx: TenantContext, subsystem: string, key: string, value: any, ttlSeconds = 300): void {
    const fullKey = this.buildKey(ctx.tenantId, subsystem, key);
    const expiresAt = Date.now() + ttlSeconds * 1000;

    this.cacheStore.set(fullKey, {
      tenantId: ctx.tenantId,
      subsystem,
      key,
      value,
      expiresAt
    });
  }

  /**
   * Retrieve item from cache, verifying that the requesting tenant owns the key
   */
  public get<T = any>(ctx: TenantContext, subsystem: string, key: string): T | null {
    const fullKey = this.buildKey(ctx.tenantId, subsystem, key);
    const entry = this.cacheStore.get(fullKey);

    if (!entry) return null;

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cacheStore.delete(fullKey);
      return null;
    }

    // Safety assert: verify tenant matches
    if (entry.tenantId !== ctx.tenantId) {
      throw new Error(`403 Forbidden [Cache Leakage Prevented]: Cross-tenant access from ${ctx.tenantId} to ${entry.tenantId}`);
    }

    return entry.value as T;
  }

  /**
   * Diagnostic probe to test cross-tenant cache access attempt
   */
  public testCrossTenantCacheAccess(requestingCtx: TenantContext, foreignTenantId: string, subsystem: string, key: string): { blocked: boolean; error?: string } {
    const foreignKey = this.buildKey(foreignTenantId, subsystem, key);
    const entry = this.cacheStore.get(foreignKey);

    if (!entry) {
      return { blocked: true, error: 'Foreign key not accessible' };
    }

    if (requestingCtx.tenantId !== foreignTenantId) {
      return {
        blocked: true,
        error: `403 Forbidden: Tenant ${requestingCtx.tenantId} cannot read cache key for tenant ${foreignTenantId}`
      };
    }

    return { blocked: false };
  }

  /**
   * Clear all cache keys belonging to a specific tenant
   */
  public invalidateTenant(tenantId: string): number {
    let count = 0;
    const prefix = `tenant:${tenantId}:`;
    for (const key of this.cacheStore.keys()) {
      if (key.startsWith(prefix)) {
        this.cacheStore.delete(key);
        count++;
      }
    }
    return count;
  }
}

export const cacheService = new TenantIsolatedCacheService();
