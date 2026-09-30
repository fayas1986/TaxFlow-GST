# TaxFlow — Tenant Context & Async Hardening

## 1. Overview

In asynchronous background processing architectures, a critical vulnerability is context leakage or authorization bypass when jobs run outside HTTP request threads. TaxFlow guarantees strict multi-tenant isolation and security context preservation across all async background job executions.

## 2. Security Context Propagation

Every background job enqueued via `JobDispatcherService` packages a `TenantSecurityContext`:

```typescript
export interface TenantSecurityContext {
  tenantId: string;
  userId?: string;
  permissions: string[];
  subscriptionStatus?: string;
  planCode?: string;
}
```

### Context Security Principles:
1. **Mandatory Envelope Validation**: The `tenantId` in the job payload envelope **must match** `securityContext.tenantId`. Any mismatch results in immediate job dispatch rejection (`ForbiddenException`).
2. **Worker Context Reconstruction**: When a worker process picks up a job from `BackgroundJobRecord`, it reconstructs the original `TenantSecurityContext` before invoking the registered domain handler.
3. **Database Query Scoping**: All database operations executed inside job handlers must append `where: { tenantId }` filters. Cross-tenant queries are structurally impossible.

---

## 3. Subscription & Entitlement Pre-Checks

Before a job is enqueued or executed:
- `JobDispatcherService` verifies the tenant's current subscription status via `EntitlementsService`.
- If the tenant's subscription is `SUSPENDED` or `EXPIRED`, async job dispatch for hard-gated commercial features is rejected.
- If a tenant's subscription transitions to `SUSPENDED` while a job is queued, `JobWorkerService` re-validates entitlement before execution and halts processing if suspended.
