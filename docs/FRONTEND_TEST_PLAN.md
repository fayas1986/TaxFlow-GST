# TaxFlow: Frontend Enterprise Quality & Test Plan
**Document Version:** 1.0.0-FROZEN  
**Target Coverage:** Unit Tests, Integration Tests, and Playwright End-to-End (E2E) Journeys  
**Focus:** Statutory Integrity, Context Isolation, Period Locking, and Deterministic Workflows

---

## 1. Quality Assurance Strategy

The TaxFlow frontend operates under a strict enterprise verification regime. Every critical statutory workflow is guarded by automated test suites to ensure zero regression and 100% adherence to regulatory constraints.

```
┌────────────────────────────────────────────────────────────┐
│                    PLAYWRIGHT E2E SUITE                    │
│      6 Mission-Critical User Journeys (Browser-Level)      │
├────────────────────────────────────────────────────────────┤
│                  INTEGRATION TEST SUITE                    │
│  TanStack Query Invalidation, Context Sync, HTTP 423 Guards│
├────────────────────────────────────────────────────────────┤
│                    UNIT TEST SUITE                         │
│   Atomic UI Components, Form Formatting, Reducers, Stores  │
└────────────────────────────────────────────────────────────┘
```

---

## 2. Playwright End-to-End (E2E) Critical Journeys

### Journey 1: Authentication, Tenant Context & Entity Switching
- **Objective:** Verify that selecting an entity hierarchy correctly updates global UI state and injects accurate HTTP headers into backend API calls.
- **Test Steps:**
  1. Navigate to `/login`. Sign in with authorized credentials (`admin@taxflow.io`).
  2. Verify redirect to `/control-tower`.
  3. Open Entity Switcher dropdown in the header. Select Legal Entity `CO-TITAN` and GSTIN `27AABCT1332M1Z2`.
  4. Intercept network requests and assert that all outgoing API calls contain:
     - `x-tenant-id: GROUP-TATA`
     - `x-company-id: CO-TITAN`
     - `x-gstin-id: 27AABCT1332M1Z2`
     - `x-correlation-id: corr-...`
  5. Assert that the header breadcrumb updates reactively.

### Journey 2: Outward Sales Invoice Creation & Tax Explainer Audit
- **Objective:** Ensure invoices consume backend tax calculations (zero client-side formulas) and the Tax Explainer displays deterministic legal provenance.
- **Test Steps:**
  1. Navigate to `/invoices` and click **Create Invoice**.
  2. Enter recipient GSTIN (`29AAACB1234F1Z5` - Karnataka) and item line ($100,000, HSN 998311).
  3. Verify that the frontend does NOT compute taxes locally; verify network payload `POST /api/v1/tax-engine/calculate`.
  4. Verify that the backend returns `INTER_STATE_IGST` at 18% ($18,000).
  5. Click **View Tax Explainer** chip.
  6. Assert that `TaxExplainerDrawer` opens and displays:
     - Section 10(1)(a) IGST Act reference.
     - Rule AST version and effective date.
     - Step-by-step arithmetic computation.
     - Statutory legal disclaimer banner.

### Journey 3: Financial Period State Transition & HTTP 423 Lock Guard
- **Objective:** Verify that transitions through the 5-stage period state machine work correctly and locked periods reject mutations with the Controlled Amendment protocol.
- **Test Steps:**
  1. Navigate to `/control-tower` with active period `2026-09`.
  2. Transition period from `OPEN` ➔ `UNDER_REVIEW` ➔ `APPROVED` ➔ `FILED` ➔ `LOCKED`.
  3. Navigate to `/invoices` and attempt to edit an existing invoice in period `2026-09`.
  4. Assert that the edit button displays a disabled lock tooltip.
  5. Simulate an unauthorized `POST /api/v1/invoices` mutation for period `2026-09`.
  6. Verify that the backend responds with `HTTP 423 Locked`.
  7. Assert that the **Controlled Amendment Modal** appears, preventing silent corruption and offering compliant Section 34 / DRC-03 pathways.

### Journey 4: Extensible Multi-Evidence Reconciliation
- **Objective:** Ingest multiple data sources (PR + GSTR-2B + E-Way Bill + ERP) and verify matching results.
- **Test Steps:**
  1. Navigate to `/reconciliation`.
  2. Verify that registered evidence sources are loaded from `/api/v1/reconciliation/evidence-sources`.
  3. Trigger automated multi-source reconciliation.
  4. Assert the match categories: Exact Match (Green), Tolerance Match (Amber), and Unmatched (Red).
  5. Verify that unmatched records offer "Push to Exception Inbox".

### Journey 5: Centralized Exception Inbox Triage & Resolution
- **Objective:** Verify filtering, investigation, and resolution across the 10 discrepancy domains.
- **Test Steps:**
  1. Navigate to `/compliance/exceptions`.
  2. Filter by domain `ITC_MISMATCH` and severity `HIGH`.
  3. Select an exception card; inspect invoice disparity, tax variance, and root cause analysis.
  4. Click **Resolve Exception**, enter resolution notes ("Credit Note issued by vendor in October"), and confirm.
  5. Assert that TanStack Query invalidates the exception cache and the item moves to `RESOLVED` status.

### Journey 6: Inactivity Security Session Lock
- **Objective:** Verify compliance with enterprise security standards for idle sessions.
- **Test Steps:**
  1. Log into the application.
  2. Fast-forward timer by 15 minutes without user activity.
  3. Assert that the screen locks with a secure PIN/password prompt.
  4. Enter valid credentials; verify that user session resumes without data loss.

---

## 3. Automated CI/CD Testing Pipeline

```yaml
name: TaxFlow Frontend CI

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Typecheck
        run: npm run lint
      - name: Production Build Verification
        run: npm run build
      - name: Playwright E2E Tests
        run: npx playwright test
```
