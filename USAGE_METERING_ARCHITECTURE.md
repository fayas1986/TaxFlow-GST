# TaxFlow — Stage 10 Usage Metering Architecture

## 1. Overview & Data Model

TaxFlow implements a durable, auditable, and idempotent usage metering system. Usage metrics map directly to `src/core/usage/types.ts`:

* `invoice_documents`
* `e_invoice_documents`
* `e_way_bills`
* `reconciliation_documents`
* `ai_requests`
* `api_calls`
* `users`
* `gstins`
* `branches`
* `storage_mb`

### Schema Models:

```prisma
model UsageCounterRecord {
  id           String   @id @default(uuid())
  tenantId     String
  periodKey    String   // Format: YYYY-MM e.g. "2026-09"
  metric       String
  currentValue BigInt   @default(0)
  updatedAt    DateTime @updatedAt

  @@unique([tenantId, periodKey, metric])
}

model UsageEventLog {
  id             String   @id @default(uuid())
  tenantId       String
  metric         String
  delta          Int
  idempotencyKey String   @unique
  correlationId  String?
  timestamp      DateTime @default(now())

  @@index([tenantId, metric])
}
```

---

## 2. Idempotency Mechanism

Usage tracking guarantees **at-most-once processing** through durable idempotency keys (`idempotencyKey`).

```text
Request (TenantId, Metric, Delta, IdempotencyKey)
    │
    ▼
Check UsageEventLog for existing idempotencyKey
    │
    ├─────► [Key Exists]  ──► Return existing record (idempotencyHit: true, skip increment)
    │
    └─────► [Key Missing] ──► Atomic Transaction:
                               1. Insert UsageEventLog
                               2. Upsert UsageCounterRecord (currentValue += delta)
                               3. Return updated counter
```

### Handled Test Cases:
- **Duplicate Request**: Secondary requests sharing the same `idempotencyKey` return immediately without double-counting.
- **Retries**: Retried business operations re-use the original operation transaction `idempotencyKey`.
- **Concurrent Requests**: Unique constraint on `UsageEventLog.idempotencyKey` ensures atomic database serialization under high concurrency.
- **Rolled-Back Business Transactions**: Usage increment is coupled to business operation transaction completion. If the business operation fails, usage increment is rolled back.

---

## 3. Period Boundaries & Reset Strategy

- **Period Key Format**: Usage is partitioned by billing periods formatted as `YYYY-MM` (e.g. `2026-09`).
- **Billing Period Boundary Reset**: Period key resolution dynamically calculates active period boundaries based on `Subscription.currentPeriodStart` and `currentPeriodEnd`. Historical period records remain immutable for billing auditability.
- **Resource Counters**: Static entity metrics (`users`, `gstins`, `branches`) represent current active entity counts rather than monthly cumulative deltas.
