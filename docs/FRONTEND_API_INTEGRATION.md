# TaxFlow: Frontend API Integration & Data Flow Specification
**Document Version:** 1.0.0-FROZEN  
**Gateway Client:** `EnterpriseApiClient` (`/src/api/client.ts`)  
**Backend Architecture:** NestJS Modular Monolith with Row-Level Security (RLS) & REST Endpoints

---

## 1. Enterprise API Client Architecture

The `EnterpriseApiClient` is the single authoritative data-access pipeline for the entire React 19 application. It guarantees consistent tenant propagation, distributed tracing, and period-locked mutation guards.

```
React Component / Feature Hook
           │
           ▼
    useQuery / useMutation (TanStack Query)
           │
           ▼
    EnterpriseApiClient.request()
           │
           ├─► Attach x-correlation-id (Cryptographic Trace ID)
           ├─► Read Active Entity Context from Zustand Store:
           │     • x-tenant-id    (Holding Group)
           │     • x-company-id   (Legal Entity PAN)
           │     • x-gstin-id     (15-character GSTIN)
           │     • x-branch-id    (Branch Code or 'ALL')
           │     • x-tax-period   (Active Return Period, e.g., '2026-09')
           │
           ├─► Execute Fetch with AbortController Timeout (10,000ms)
           │
           ├─► Error Interceptor:
           │     • HTTP 423 Locked   ──► Trigger PeriodLockException Modal
           │     • HTTP 401 Unauth   ──► Redirect to /login
           │     • HTTP 403 Forbidden ──► Render Access Denied
           │     • HTTP 5xx Server   ──► Exponential Backoff Retry (Max 2)
           │
           ▼
    Return Typed Payload to TanStack Query Cache
```

---

## 2. Comprehensive Endpoint & TanStack Query Matrix

| Domain | REST Endpoint | Method | Hook Name | Query Key Structure | Stale Time | Cache Invalidation Trigger |
|---|---|---|---|---|---|---|
| **Period Control** | `/api/v1/compliance/period/status` | `GET` | `usePeriodStatus(period)` | `['compliance', 'period', 'status', period]` | 30s | Transition mutation |
| **Period Control** | `/api/v1/compliance/period/transition` | `POST` | `useTransitionPeriod()` | N/A (Mutation) | N/A | Invalidates `['compliance', 'period']` |
| **Tax Engine** | `/api/v1/tax-engine/calculate` | `POST` | `useCalculateTax()` | N/A (Mutation) | N/A | None (Ephemeral form state) |
| **Tax Explainer** | `/api/v1/tax-engine/explain` | `POST` | `useTaxExplainer()` | N/A (Mutation) | N/A | None (Flyout display) |
| **Exceptions** | `/api/v1/compliance/exceptions` | `GET` | `useExceptions(domain, status)` | `['compliance', 'exceptions', {domain, status}]` | 15s | Resolve mutation, period switch |
| **Exceptions** | `/api/v1/compliance/exceptions/:id` | `PATCH` | `useResolveException()` | N/A (Mutation) | N/A | Invalidates `['compliance', 'exceptions']` |
| **Reconciliation** | `/api/v1/reconciliation/evidence-sources`| `GET` | `useReconciliationEvidenceSources()` | `['compliance', 'reconciliation', 'evidence-sources']` | 60s | Period switch |
| **Reconciliation** | `/api/v1/reconciliation/matches` | `POST` | `useReconciliationMatches(filters)` | `['compliance', 'reconciliation', 'matches', filters]` | 30s | Match/Accept action |
| **Control Tower** | `/api/v1/architecture/persistence/health` | `GET` | `usePersistenceHealth()` | `['architecture', 'persistence-health']` | 10s | Periodic polling |
| **Control Tower** | `/api/v1/architecture/ledger` | `GET` | `useLedgerTelemetry()` | `['architecture', 'ledger-telemetry']` | 15s | Periodic polling |
| **Invoices** | `/api/v1/invoices` | `GET` | `useInvoices(filters)` | `['invoices', 'list', filters]` | 20s | Create, Approve, Transition |
| **Invoices** | `/api/v1/invoices/:id/workflow-transition` | `POST` | `useAdvanceInvoiceWorkflow()` | N/A (Mutation) | N/A | Invalidates `['invoices']` |
| **Returns** | `/api/v1/gst/filing/pre-check` | `POST` | `useFilingPreCheck()` | N/A (Mutation) | N/A | None |
| **Returns** | `/api/v1/gst/filing/transmit` | `POST` | `useTransmitReturn()` | N/A (Mutation) | N/A | Invalidates `['compliance', 'period']`, `['returns']` |

---

## 3. Handling HTTP 423 Locked Periods

When an invoice creation, credit note, or reconciliation adjustment is attempted against a period marked `APPROVED`, `FILED`, or `LOCKED`, the backend rejects the request with:

```json
{
  "status": 423,
  "code": "PERIOD_LOCKED",
  "message": "Tax period 2026-09 is LOCKED for GSTIN 27AABCT1332M1Z2. No direct mutations permitted.",
  "correlationId": "corr-k7y29a-14d",
  "allowedActions": ["SUBMIT_AMENDMENT_DOCKET_DRC03", "CREATE_CREDIT_NOTE_NEXT_OPEN_PERIOD"]
}
```

### Frontend Handling Protocol:
1. `EnterpriseApiClient` catches `HTTP 423` and throws an `EnterpriseApiError` with `code: 'PERIOD_LOCKED'`.
2. The TanStack Query error boundary displays the **Controlled Amendment Modal**.
3. The user is offered two compliant pathways:
   - **Route to Next Open Period:** Automatically carry the transaction into the subsequent `OPEN` period (Section 34).
   - **Initiate Amendment Docket:** Request dual-manager approval to lodge a voluntary DRC-03 adjustment.
4. Direct modification of historical locked rows is permanently blocked.

---

## 4. Separation of Real Telemetry vs Isolated Demo Fixtures

- **Production Gateway:** All production views connect to real backend routes.
- **Fixture Quarantine:** Mock datasets, demo companies (`DEMO-GROUP-TATA`), and test invoices are stored in `/src/fixtures/` and cannot be bundled into production builds without explicit environment flags (`VITE_ENABLE_DEMO_FIXTURES=true`).
- **Telemetry Integrity:** Control Tower statistics (active connections, pipeline queue latency, ledger balances) are retrieved directly from backend diagnostics, not `Math.random()`.
