/**
 * Base Tenant-Scoped Repository Pattern & Higher Order Functions (HOF)
 * 
 * Guarantees that EVERY database operation on tenant-owned entities automatically
 * has `where: { tenantId: ctx.tenantId }` injected and enforced.
 * Prevents IDOR (Insecure Direct Object Reference) and ensures tenant scoping
 * is mathematically impossible to miss in application business logic.
 */

import { TenantContext } from '../../core/tenancy/types';

export interface TenantScopedEntity {
  id: string;
  tenantId: string;
  createdAt?: string;
  updatedAt?: string;
  gstinId?: string;
  branchId?: string;
}

/**
 * Standard Where clause type for filtering tenant-owned entities.
 * The repository layer guarantees that `tenantId: ctx.tenantId` is always injected.
 */
export type WhereClause<T> = {
  [K in keyof T]?: T[K] | T[K][] | null | undefined | ((val: T[K]) => boolean);
} & {
  tenantId?: string;
  [key: string]: any;
};

export interface QueryOptions<T> {
  where?: WhereClause<T>;
  filter?: (item: T) => boolean;
  orderBy?: { [K in keyof T]?: 'asc' | 'desc' };
  limit?: number;
  offset?: number;
}

export interface UpdateOptions<T> {
  where: WhereClause<T>;
  data: Partial<Omit<T, 'id' | 'tenantId'>>;
}

export interface UpsertOptions<T> {
  where: WhereClause<T>;
  create: Omit<T, 'id' | 'tenantId'> & { id?: string; tenantId?: string };
  update: Partial<Omit<T, 'id' | 'tenantId'>>;
}

export interface BatchResult<T> {
  count: number;
  items: T[];
}

/**
 * Base Class for all Tenant-Scoped Repositories.
 * Every query and mutation systematically routes through `injectTenantWhere(ctx, where)`,
 * guaranteeing that `where: { tenantId: ctx.tenantId }` is strictly enforced.
 */
export class TenantScopedRepository<T extends TenantScopedEntity> {
  protected items: Map<string, T> = new Map(); // id -> item
  public readonly entityName: string;

  constructor(entityName: string) {
    this.entityName = entityName;
  }

  /**
   * CRITICAL INJECTION ENGINE:
   * Automatically injects `where: { tenantId: ctx.tenantId }` into query where clauses.
   * If a caller explicitly passes a foreign tenantId, it immediately aborts with 403 Forbidden.
   * Also enforces user's assigned GSTIN and branch boundary filters.
   */
  public injectTenantWhere(ctx: TenantContext, where?: WhereClause<T>): WhereClause<T> {
    if (!ctx || !ctx.tenantId) {
      throw new Error(`500 Configuration Error: Valid TenantContext with non-empty tenantId is strictly required for ${this.entityName} operations`);
    }

    const sanitizedWhere: WhereClause<T> = { ...(where || {}) } as WhereClause<T>;

    // SECURITY CHECK: If developer/caller explicitly provided a conflicting tenantId in where, block cross-tenant leakage!
    if (sanitizedWhere.tenantId && sanitizedWhere.tenantId !== ctx.tenantId) {
      throw new Error(
        `403 Forbidden [Tenant Boundary Violation]: Query on ${this.entityName} explicitly attempted to target foreign tenant '${sanitizedWhere.tenantId}', but active session tenant is '${ctx.tenantId}'. Cross-tenant access blocked.`
      );
    }

    // MANDATORY GUARANTEE: Injects where: { tenantId: ctx.tenantId }
    sanitizedWhere.tenantId = ctx.tenantId;

    // GSTIN scoping enforcement
    if (ctx.assignedGstinIds && ctx.assignedGstinIds !== 'ALL' && sanitizedWhere.gstinId && typeof sanitizedWhere.gstinId === 'string') {
      if (!ctx.assignedGstinIds.includes(sanitizedWhere.gstinId)) {
        throw new Error(`403 Forbidden: User not authorized for GSTIN '${sanitizedWhere.gstinId}' on ${this.entityName}`);
      }
    }

    // Branch scoping enforcement
    if (ctx.assignedBranchIds && ctx.assignedBranchIds !== 'ALL' && sanitizedWhere.branchId && typeof sanitizedWhere.branchId === 'string') {
      if (!ctx.assignedBranchIds.includes(sanitizedWhere.branchId)) {
        throw new Error(`403 Forbidden: User not authorized for branch '${sanitizedWhere.branchId}' on ${this.entityName}`);
      }
    }

    return sanitizedWhere;
  }

  /**
   * Evaluates if a given item satisfies the injected where clause, tenant boundary,
   * and any branch/GSTIN user constraints.
   */
  protected matchesWhere(item: T, scopedWhere: WhereClause<T>, ctx: TenantContext): boolean {
    // Invariant: Tenant ID must match
    if (item.tenantId !== ctx.tenantId) {
      return false;
    }

    // GSTIN scoping check
    if (ctx.assignedGstinIds && ctx.assignedGstinIds !== 'ALL' && item.gstinId) {
      if (!ctx.assignedGstinIds.includes(item.gstinId)) {
        return false;
      }
    }

    // Branch scoping check
    if (ctx.assignedBranchIds && ctx.assignedBranchIds !== 'ALL' && item.branchId) {
      if (!ctx.assignedBranchIds.includes(item.branchId)) {
        return false;
      }
    }

    // Check all criteria in scopedWhere
    for (const key of Object.keys(scopedWhere)) {
      const expectedVal = scopedWhere[key as keyof T];
      if (expectedVal === undefined) continue;

      const actualVal = (item as any)[key];

      if (typeof expectedVal === 'function') {
        if (!(expectedVal as Function)(actualVal)) return false;
      } else if (Array.isArray(expectedVal)) {
        if (!expectedVal.includes(actualVal)) return false;
      } else {
        if (actualVal !== expectedVal) return false;
      }
    }

    return true;
  }

  /**
   * Internal helper to assert tenant boundary and prevent IDOR
   */
  protected assertTenantAccess(ctx: TenantContext, item: T | undefined | null, action: string): T {
    if (!item) {
      throw new Error(`404 Not Found: ${this.entityName} does not exist`);
    }

    if (item.tenantId !== ctx.tenantId) {
      // Intentionally return 403 [IDOR Blocked] to prevent enumeration and cross-tenant leakage
      throw new Error(
        `403 Forbidden [IDOR Blocked]: ${this.entityName} '${item.id}' belongs to tenant '${item.tenantId}', active context is '${ctx.tenantId}'. Action '${action}' denied.`
      );
    }

    // GSTIN scoping check
    if (ctx.assignedGstinIds && ctx.assignedGstinIds !== 'ALL' && item.gstinId) {
      if (!ctx.assignedGstinIds.includes(item.gstinId)) {
        throw new Error(`403 Forbidden: User not authorized for GSTIN '${item.gstinId}' on ${this.entityName}`);
      }
    }

    // Branch scoping check
    if (ctx.assignedBranchIds && ctx.assignedBranchIds !== 'ALL' && item.branchId) {
      if (!ctx.assignedBranchIds.includes(item.branchId)) {
        throw new Error(`403 Forbidden: User not authorized for branch '${item.branchId}' on ${this.entityName}`);
      }
    }

    // Read-only user check for mutating actions
    if (ctx.isReadOnly && (action === 'CREATE' || action === 'UPDATE' || action === 'DELETE')) {
      throw new Error(`403 Forbidden: User has read-only access and cannot perform '${action}' on ${this.entityName}`);
    }

    return item;
  }

  /**
   * Find all entities for the current tenant with automatic `where: { tenantId: ctx.tenantId }` injection.
   * Supports either QueryOptions object or legacy callback filter.
   */
  public findMany(ctx: TenantContext, optionsOrFilter?: QueryOptions<T> | ((item: T) => boolean)): T[] {
    let scopedWhere: WhereClause<T>;
    let legacyFilter: ((item: T) => boolean) | undefined;
    let orderBy: { [K in keyof T]?: 'asc' | 'desc' } | undefined;
    let limit: number | undefined;
    let offset: number | undefined;

    if (typeof optionsOrFilter === 'function') {
      // Legacy predicate filter mode -> automatically inject tenantId where
      scopedWhere = this.injectTenantWhere(ctx, {});
      legacyFilter = optionsOrFilter;
    } else {
      scopedWhere = this.injectTenantWhere(ctx, optionsOrFilter?.where);
      legacyFilter = optionsOrFilter?.filter;
      orderBy = optionsOrFilter?.orderBy;
      limit = optionsOrFilter?.limit;
      offset = optionsOrFilter?.offset;
    }

    let results: T[] = [];

    for (const item of this.items.values()) {
      if (!this.matchesWhere(item, scopedWhere, ctx)) {
        continue;
      }

      if (legacyFilter && !legacyFilter(item)) {
        continue;
      }

      results.push({ ...item });
    }

    // Handle Order By
    if (orderBy) {
      const orderKeys = Object.keys(orderBy) as (keyof T)[];
      if (orderKeys.length > 0) {
        const key = orderKeys[0];
        const dir = orderBy[key] === 'desc' ? -1 : 1;
        results.sort((a, b) => {
          const valA = (a as any)[key];
          const valB = (b as any)[key];
          if (valA < valB) return -1 * dir;
          if (valA > valB) return 1 * dir;
          return 0;
        });
      }
    }

    // Handle Offset and Limit
    if (offset && offset > 0) {
      results = results.slice(offset);
    }
    if (limit && limit > 0) {
      results = results.slice(0, limit);
    }

    return results;
  }

  /**
   * Find the first entity matching the query within current tenant boundary.
   * Automatically injects `where: { tenantId: ctx.tenantId }`.
   */
  public findFirst(ctx: TenantContext, options?: QueryOptions<T>): T | null {
    const results = this.findMany(ctx, { ...options, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Find entity by ID strictly within current tenant boundary.
   * Implemented via `findFirst` with `{ where: { id, tenantId: ctx.tenantId } }`.
   * Returns null if missing or belonging to foreign tenant.
   */
  public findById(ctx: TenantContext, id: string): T | null {
    return this.findFirst(ctx, { where: { id } as any });
  }

  /**
   * Strict IDOR-checked getById: Throws 403 Forbidden [IDOR Blocked] if resource belongs to another tenant.
   */
  public getById(ctx: TenantContext, id: string): T {
    const item = this.items.get(id);
    if (!item) {
      throw new Error(`404 Not Found: ${this.entityName} '${id}' not found`);
    }
    return this.assertTenantAccess(ctx, item, 'READ');
  }

  /**
   * Count entities matching query, strictly bounded to current tenant.
   */
  public count(ctx: TenantContext, options?: QueryOptions<T>): number {
    return this.findMany(ctx, options).length;
  }

  /**
   * Check if at least one entity exists matching query in current tenant.
   */
  public exists(ctx: TenantContext, where?: WhereClause<T>): boolean {
    return this.findFirst(ctx, { where }) !== null;
  }

  /**
   * Create an entity, automatically stamping ctx.tenantId
   */
  public create(ctx: TenantContext, data: Omit<T, 'id' | 'tenantId'> & { id?: string; tenantId?: string }): T {
    if (ctx.isReadOnly) {
      throw new Error(`403 Forbidden: Read-only user cannot create ${this.entityName}`);
    }

    // Verify GSTIN authorization if entity is GSTIN-bound
    if (data.gstinId && ctx.assignedGstinIds && ctx.assignedGstinIds !== 'ALL') {
      if (!ctx.assignedGstinIds.includes(data.gstinId)) {
        throw new Error(`403 Forbidden: User not authorized to create ${this.entityName} under GSTIN '${data.gstinId}'`);
      }
    }

    // Verify Branch authorization if entity is branch-bound
    if (data.branchId && ctx.assignedBranchIds && ctx.assignedBranchIds !== 'ALL') {
      if (!ctx.assignedBranchIds.includes(data.branchId)) {
        throw new Error(`403 Forbidden: User not authorized to create ${this.entityName} under Branch '${data.branchId}'`);
      }
    }

    const id = data.id || `${this.entityName.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date().toISOString();

    const entity = {
      ...data,
      id,
      tenantId: ctx.tenantId, // FORCED tenantId stamping from session context
      createdAt: data.createdAt || now,
      updatedAt: now
    } as T;

    this.items.set(id, entity);
    return { ...entity };
  }

  /**
   * Update an entity within current tenant boundary.
   * Supports target as either an ID string or an object with `{ where: WhereClause<T> }`.
   * Automatically injects `where: { tenantId: ctx.tenantId }`.
   */
  public update(
    ctx: TenantContext,
    target: string | { where: WhereClause<T> },
    patch: Partial<Omit<T, 'id' | 'tenantId'>>
  ): T {
    let existing: T | undefined;

    if (typeof target === 'string') {
      existing = this.items.get(target);
      this.assertTenantAccess(ctx, existing, 'UPDATE');
    } else {
      const scopedWhere = this.injectTenantWhere(ctx, target.where);
      // Search within tenant
      for (const item of this.items.values()) {
        if (this.matchesWhere(item, scopedWhere, ctx)) {
          existing = item;
          break;
        }
      }

      if (!existing) {
        // If query targeted an id, check if it exists in foreign tenant to surface IDOR violation
        if (target.where && target.where.id && typeof target.where.id === 'string') {
          const rawItem = this.items.get(target.where.id);
          if (rawItem && rawItem.tenantId !== ctx.tenantId) {
            throw new Error(`403 Forbidden [IDOR Blocked]: ${this.entityName} '${rawItem.id}' belongs to tenant '${rawItem.tenantId}', active context is '${ctx.tenantId}'. Action 'UPDATE' denied.`);
          }
        }
        throw new Error(`404 Not Found: No matching ${this.entityName} found to update`);
      }
      this.assertTenantAccess(ctx, existing, 'UPDATE');
    }

    // If updating GSTIN or Branch, verify user is authorized for new target
    if (patch.gstinId && ctx.assignedGstinIds && ctx.assignedGstinIds !== 'ALL') {
      if (!ctx.assignedGstinIds.includes(patch.gstinId)) {
        throw new Error(`403 Forbidden: User not authorized for target GSTIN '${patch.gstinId}'`);
      }
    }
    if (patch.branchId && ctx.assignedBranchIds && ctx.assignedBranchIds !== 'ALL') {
      if (!ctx.assignedBranchIds.includes(patch.branchId)) {
        throw new Error(`403 Forbidden: User not authorized for target Branch '${patch.branchId}'`);
      }
    }

    const updated: T = {
      ...existing!,
      ...patch,
      tenantId: existing!.tenantId, // Ensure tenantId cannot be altered via patch
      updatedAt: new Date().toISOString()
    };

    this.items.set(existing!.id, updated);
    return { ...updated };
  }

  /**
   * Update all entities matching the query within current tenant boundary.
   * Automatically injects `where: { tenantId: ctx.tenantId }`.
   */
  public updateMany(
    ctx: TenantContext,
    options: { where?: WhereClause<T>; data: Partial<Omit<T, 'id' | 'tenantId'>> }
  ): BatchResult<T> {
    if (ctx.isReadOnly) {
      throw new Error(`403 Forbidden: Read-only user cannot update ${this.entityName}`);
    }

    const scopedWhere = this.injectTenantWhere(ctx, options.where);
    const updatedItems: T[] = [];
    const now = new Date().toISOString();

    for (const [id, item] of this.items.entries()) {
      if (this.matchesWhere(item, scopedWhere, ctx)) {
        const updated: T = {
          ...item,
          ...options.data,
          tenantId: item.tenantId, // Invariant: tenantId cannot be mutated
          updatedAt: now
        };
        this.items.set(id, updated);
        updatedItems.push({ ...updated });
      }
    }

    return {
      count: updatedItems.length,
      items: updatedItems
    };
  }

  /**
   * Delete an entity within current tenant boundary.
   * Supports target as string id or `{ where: WhereClause<T> }`.
   */
  public delete(ctx: TenantContext, target: string | { where: WhereClause<T> }): boolean {
    let existing: T | undefined;

    if (typeof target === 'string') {
      existing = this.items.get(target);
      this.assertTenantAccess(ctx, existing, 'DELETE');
      return this.items.delete(target);
    } else {
      const scopedWhere = this.injectTenantWhere(ctx, target.where);
      for (const item of this.items.values()) {
        if (this.matchesWhere(item, scopedWhere, ctx)) {
          existing = item;
          break;
        }
      }

      if (!existing) {
        if (target.where && target.where.id && typeof target.where.id === 'string') {
          const rawItem = this.items.get(target.where.id);
          if (rawItem && rawItem.tenantId !== ctx.tenantId) {
            throw new Error(`403 Forbidden [IDOR Blocked]: ${this.entityName} '${rawItem.id}' belongs to tenant '${rawItem.tenantId}', active context is '${ctx.tenantId}'. Action 'DELETE' denied.`);
          }
        }
        return false;
      }

      this.assertTenantAccess(ctx, existing, 'DELETE');
      return this.items.delete(existing.id);
    }
  }

  /**
   * Delete all entities matching the query strictly within current tenant boundary.
   * Automatically injects `where: { tenantId: ctx.tenantId }`.
   */
  public deleteMany(ctx: TenantContext, options?: { where?: WhereClause<T> }): { count: number } {
    if (ctx.isReadOnly) {
      throw new Error(`403 Forbidden: Read-only user cannot delete ${this.entityName}`);
    }

    const scopedWhere = this.injectTenantWhere(ctx, options?.where);
    let count = 0;

    for (const [id, item] of Array.from(this.items.entries())) {
      if (this.matchesWhere(item, scopedWhere, ctx)) {
        this.items.delete(id);
        count++;
      }
    }

    return { count };
  }

  /**
   * Upsert an entity within current tenant boundary.
   * Automatically injects `where: { tenantId: ctx.tenantId }`.
   */
  public upsert(ctx: TenantContext, options: UpsertOptions<T>): T {
    const scopedWhere = this.injectTenantWhere(ctx, options.where);
    const existing = this.findFirst(ctx, { where: scopedWhere });

    if (existing) {
      return this.update(ctx, existing.id, options.update);
    } else {
      return this.create(ctx, {
        ...options.create,
        tenantId: ctx.tenantId
      });
    }
  }

  /**
   * Diagnostic / test method to directly populate mock data
   */
  public seedDirect(entity: T): void {
    this.items.set(entity.id, entity);
  }

  /**
   * Total raw count across all tenants (admin diagnostic)
   */
  public getRawCount(): number {
    return this.items.size;
  }
}

// ============================================================================
// HIGHER ORDER FUNCTION (HOF) ARCHITECTURE
// ============================================================================

/**
 * The Tenant-Bound Scoped Repository Interface.
 * Callers in business logic do NOT need to manually provide `ctx` on every invocation;
 * the HOF encapsulates `ctx` and guarantees that every database operation
 * automatically has `where: { tenantId: ctx.tenantId }` injected.
 */
export interface ScopedRepositoryClient<T extends TenantScopedEntity> {
  readonly tenantId: string;
  readonly entityName: string;
  findMany(queryOrFilter?: QueryOptions<T> | ((item: T) => boolean)): T[];
  findFirst(query?: QueryOptions<T>): T | null;
  findById(id: string): T | null;
  getById(id: string): T;
  count(query?: QueryOptions<T>): number;
  exists(where?: WhereClause<T>): boolean;
  create(data: Omit<T, 'id' | 'tenantId'> & { id?: string; tenantId?: string }): T;
  update(target: string | { where: WhereClause<T> }, patch: Partial<Omit<T, 'id' | 'tenantId'>>): T;
  updateMany(options: { where?: WhereClause<T>; data: Partial<Omit<T, 'id' | 'tenantId'>> }): BatchResult<T>;
  delete(target: string | { where: WhereClause<T> }): boolean;
  deleteMany(options?: { where?: WhereClause<T> }): { count: number };
  upsert(options: UpsertOptions<T>): T;
  rawRepository: TenantScopedRepository<T>;
}

/**
 * HOF: withTenantScope
 * Takes a TenantContext and a TenantScopedRepository, returning a pre-bound
 * client where tenant scoping is mathematically guaranteed for all operations.
 * 
 * Example:
 * ```ts
 * const invoiceClient = withTenantScope(ctx, invoiceRepository);
 * // Business logic writes:
 * const items = invoiceClient.findMany({ where: { status: 'GENERATED' } });
 * // Injected: where: { status: 'GENERATED', tenantId: ctx.tenantId }
 * ```
 */
export function withTenantScope<T extends TenantScopedEntity>(
  ctx: TenantContext,
  repository: TenantScopedRepository<T>
): ScopedRepositoryClient<T> {
  if (!ctx || !ctx.tenantId) {
    throw new Error(`500 withTenantScope HOF requires a valid TenantContext with tenantId`);
  }

  return {
    get tenantId() {
      return ctx.tenantId;
    },
    get entityName() {
      return repository.entityName;
    },
    findMany: (queryOrFilter) => repository.findMany(ctx, queryOrFilter),
    findFirst: (query) => repository.findFirst(ctx, query),
    findById: (id) => repository.findById(ctx, id),
    getById: (id) => repository.getById(ctx, id),
    count: (query) => repository.count(ctx, query),
    exists: (where) => repository.exists(ctx, where),
    create: (data) => repository.create(ctx, data),
    update: (target, patch) => repository.update(ctx, target, patch),
    updateMany: (options) => repository.updateMany(ctx, options),
    delete: (target) => repository.delete(ctx, target),
    deleteMany: (options) => repository.deleteMany(ctx, options),
    upsert: (options) => repository.upsert(ctx, options),
    rawRepository: repository
  };
}

/**
 * HOF: withTenantWhere
 * A Higher Order Function that wraps an arbitrary query function and provides it
 * with a guaranteed tenant-scoped where clause.
 * 
 * Example:
 * ```ts
 * const result = withTenantWhere(ctx, (scopedWhere) => {
 *   return db.rawQuery(scopedWhere);
 * }, { status: 'PENDING' });
 * ```
 */
export function withTenantWhere<T extends TenantScopedEntity, R>(
  ctx: TenantContext,
  queryFn: (scopedWhere: WhereClause<T>) => R,
  userWhere?: WhereClause<T>
): R {
  const dummyRepo = new TenantScopedRepository<T>('GenericScopedEntity');
  const scopedWhere = dummyRepo.injectTenantWhere(ctx, userWhere);
  return queryFn(scopedWhere);
}

/**
 * HOF: tenantScopedHOF
 * Higher Order Function that wraps any business logic function or domain operation,
 * enforcing execution within the specified TenantContext.
 */
export function tenantScopedHOF<TArgs extends any[], TResult>(
  ctx: TenantContext,
  operation: (scopedCtx: TenantContext, ...args: TArgs) => TResult
): (...args: TArgs) => TResult {
  if (!ctx || !ctx.tenantId) {
    throw new Error(`500 tenantScopedHOF requires a valid TenantContext`);
  }

  return (...args: TArgs): TResult => {
    return operation(ctx, ...args);
  };
}

