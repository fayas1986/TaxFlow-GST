# TaxFlow — Job Idempotency & Retry Safety Architecture

## 1. Durable Idempotency Mechanism

To prevent duplicate execution during network retries, message replay, or user double-clicks, all background jobs require a unique `idempotencyKey`.

### Idempotency Key Format Standard:
`<tenantId>:<jobDomain>:<resourceType>:<resourceId>:<action>:<periodKey>`

Example: `11111111-1111-1111-1111-111111111111:GSTR_FILING:RETURN:ret-001:FILE:2026-09`

### Database Multi-Column Unique Guard:
The `BackgroundJobRecord` model enforces a database-level unique constraint on `(tenant_id, idempotency_key)`.

- If a duplicate job is dispatched while an existing job is `QUEUED`, `PROCESSING`, or `COMPLETED`, `JobDispatcherService` intercepts the duplicate request, logs an idempotency hit, and returns the existing job ID without re-enqueuing.

---

## 2. Retry Safety & Exponential Backoff

When a background job handler throws an unhandled error:
1. `JobWorkerService` catches the exception and increments `attempts`.
2. If `attempts < maxAttempts`, the job status is set to `FAILED` (scheduled for retry).
3. Circuit breaker failure counters are incremented.
4. Retry delay uses **exponential backoff with jitter** to avoid thundering herd problems on third-party government or ERP APIs.

---

## 3. Circuit Breaker Protection (`CircuitBreakerService`)

To protect external government endpoints (GSP E-Way Bill / E-Invoice servers) and ERP connectors from cascade failures:

- **Failure Threshold**: 3 consecutive failures trip the breaker for a domain to `OPEN`.
- **Fast-Fail Enforcement**: While a domain circuit is `OPEN`, `JobDispatcherService` immediately rejects new job dispatches with `ServiceUnavailableException` (503), preventing queue overload.
- **Recovery (`HALF_OPEN`)**: After a 10-second reset timeout, the breaker enters `HALF_OPEN` state to trial a single test job. Upon success, the circuit resets to `CLOSED`.
