# TaxFlow: Enterprise React Frontend Architecture Specification
**Document Version:** 1.0.0-PRODUCTION-READY  
**Status:** APPROVED & FROZEN  
**Target Architecture:** React 19 + TypeScript + Vite + React Router + TanStack Query v5 + Zustand v5 + Tailwind CSS  
**Deployment Target:** Vercel (Frontend SPA) + NestJS API (Vercel Node Runtime) + Neon PostgreSQL (with RLS & Prisma)  

---

## 1. Executive Summary & Stack Confirmation

The TaxFlow frontend operates as a specialized enterprise GST compliance & tax operations portal. In accordance with architectural consensus:
- **TaxFlow frontend will remain React 19.** We are **NOT** migrating to Next.js.
- **Vite** is retained and configured for optimal developer velocity and static production builds.
- **React Router** provides clean, accessible browser routing (replacing legacy hash-based routing).
- **TanStack Query** serves as the authoritative server state caching and synchronization engine.
- **Zustand** is strictly constrained to client-side UI and contextual state (selected entity, branch, period, UI theme, drawer states).
- **Enterprise API Client** (`/services/api/enterpriseApiClient.ts` & `/src/api/client.ts`) acts as the unified gateway to the NestJS modular monolith backend.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        REACT 19 FRONTEND (VITE)                         │
│  ┌────────────────────────┐                    ┌─────────────────────┐  │
│  │   UI Views / Features  │                    │   Zustand Store     │  │
│  │ (Control Tower, Invoices│                    │ (Active PAN/GSTIN,  │  │
│  │  Reconciliation, etc.) │                    │  Period, UI Theme)  │  │
│  └───────────┬────────────┘                    └──────────┬──────────┘  │
│              │                                            │             │
│              ▼                                            │             │
│  ┌────────────────────────┐                               │             │
│  │     Feature Hooks      │                               │             │
│  │ (usePeriod, useTax,    │                               │             │
│  │  useExceptions, etc.)  │                               │             │
│  └───────────┬────────────┘                               │             │
│              │                                            │             │
│              ▼                                            │             │
│  ┌────────────────────────┐                               │             │
│  │     TanStack Query     │                               │             │
│  │ (Cache, SWR, Invalidate│                               │             │
│  └───────────┬────────────┘                               │             │
│              │                                            │             │
│              ▼                                            ▼             │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    ENTERPRISE API CLIENT                          │  │
│  │  • Context Header Injection (x-tenant-id, x-gstin-id, etc.)        │  │
│  │  • Correlation ID Tracking (x-correlation-id)                     │  │
│  │  • HTTP 423 Locked Period Interception & Amendment Protocol       │  │
│  │  • Exponential Backoff & Idempotent Retries                       │  │
│  └───────────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────────────┼──────────────────────────────────┘
                                       │ HTTP / HTTPS (REST API)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       NESTJS MODULAR MONOLITH                           │
│  • Domain Modules (TaxEngine, Compliance, Reconciliation, Ledgers)     │
│  • Row-Level Security (RLS) Context Propagation                        │
│  • Deterministic Rule Engine & Append-Only Subledger Vault             │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       │ Prisma ORM
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      NEON POSTGRESQL DATABASE                           │
│  • Multi-tenant Schemas with Row-Level Security (RLS)                  │
│  • Partitioned Tax Registers & Immutable Audit Event Vault              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Invariants

### 2.1 Non-Authoritative Frontend Mandate
React is **NEVER** an authoritative tax authority. The frontend is strictly a presentation and interaction layer. 
- **Zero Client-Side Statutory Logic:** All tax determinations, rates (0%, 5%, 12%, 18%, 28%), HSN/SAC classifications, Place of Supply (POS) rules under Sections 10-13 of the IGST Act, Inter vs. Intra-state determinations, Section 16/17(5) ITC eligibility, Reverse Charge (RCM) liabilities, Rule 42/43 reversals, and rounding conventions (Banker's Half-Up + Section 170 CGST) **must come exclusively from backend services**.
- The frontend renders backend responses and provides auditability through the Tax Explainer.

### 2.2 Global Entity Context & Tenant Isolation
Every business operation is contextualized within the 4-tier corporate hierarchy:
$$\text{Holding Group} \longrightarrow \text{Legal Entity (PAN)} \longrightarrow \text{State GSTIN} \longrightarrow \text{Operational Branch (Unit)}$$
- The authenticated user's session determines authorized entity boundaries.
- Active context headers are attached to every API request:
  - `x-tenant-id`: Holding Group ID
  - `x-company-id`: Legal Entity PAN ID
  - `x-gstin-id`: 15-character State GSTIN
  - `x-branch-id`: Branch Code (`BR-001` or `ALL`)
  - `x-tax-period`: Active Financial Period (e.g., `2026-09`)
  - `x-correlation-id`: Unique cryptographic tracing ID
- Browser-supplied context is **never** accepted blindly for authorization; backend Row-Level Security (RLS) enforces boundaries.

### 2.3 Financial Period State Machine & Lock Enforcement
Financial periods progress deterministically through 5 strict stages:
$$\text{OPEN} \longrightarrow \text{UNDER\_REVIEW} \longrightarrow \text{APPROVED} \longrightarrow \text{FILED} \longrightarrow \text{LOCKED}$$
- **State Machine Rules:**
  - `OPEN`: Daily transaction entry, purchase ingestion, initial validation.
  - `UNDER_REVIEW`: Inward/outward reconciliation active; exceptions triaged.
  - `APPROVED`: Tax Head sign-off; return payloads frozen.
  - `FILED`: Furnished to GSTN; ARN stamped; challans discharged.
  - `LOCKED`: Immutable vault. All standard `POST`/`PUT`/`PATCH`/`DELETE` mutations return `HTTP 423 Locked`.
- Edits to locked periods require the **Controlled Amendment Protocol** (Section 34 Credit/Debit Notes or Form DRC-03 adjustment dockets requiring dual-manager authorization).

### 2.4 Removal of Browser Storage as Authoritative Source
- **No Financial Persistence in `localStorage` or `Dexie`:** `localStorage`, `sessionStorage`, and IndexedDB (`Dexie`) are **prohibited** as authoritative persistence layers for financial records (invoices, ledgers, reconciliations, returns, audit logs).
- Transient client storage is strictly permitted only for:
  - Temporary unsubmitted UI drafts (e.g., offline auto-save crash recovery).
  - UI preferences (sidebar toggle, color theme, table column density).
- Authoritative state must be retrieved via TanStack Query from the backend.

### 2.5 Isolation of Demo & Mock Fixtures
- All mock data, demo tenants, and simulated figures are quarantined in `/src/fixtures/` and `/src/demo/`.
- Demo fixtures are clearly marked and prevented from entering production API execution paths.
- Control Tower metrics and portal telemetry are driven by real backend endpoints (`/api/v1/architecture/persistence/health`, `/api/v1/architecture/ledger`, etc.).

---

## 3. Directory & Module Structure

```text
src/
├── app/
│   ├── App.tsx             # Root app component (Providers + Router + InactivityTracker)
│   ├── router.tsx          # Clean React Router DOM configuration with RBAC guards
│   └── providers.tsx       # Root providers (TanStack Query, Redux, Language, Sync)
│
├── components/
│   ├── ui/                 # Atomic design components (Badge, Button, Modal, Card)
│   ├── layout/             # Application shell, headers, navigation sidebar
│   ├── tables/             # EnterpriseDataTable with sorting, pagination, keyboard nav
│   ├── drawers/            # TaxExplainerDrawer, AuditHistoryDrawer
│   └── workflow/           # PeriodControlBar, StatusWorkflowBadge, 9-Stage Stepper
│
├── features/               # Domain-centric feature modules
│   ├── control-tower/      # Pan-India filing radar, risk telemetry, executive dashboards
│   ├── organization/       # Group structure, Legal Entity PANs, GSTINs, branches
│   ├── sales/              # Invoices, approvals, e-invoicing (IRN), e-way bills
│   ├── purchases/          # Purchase register, GSTR-2B sync, vendor compliance
│   ├── itc/                # Section 17(5) blocking, Rule 42/43 apportionment
│   ├── rcm/                # Section 9(3)/9(4) reverse charge, self-invoicing
│   ├── reconciliation/     # Multi-evidence matching (PR vs 2B vs EWB vs ERP vs Bank)
│   ├── exceptions/         # Centralized 10-domain exception triage center
│   ├── ledger/             # Cash (R87), Credit (R86), Liability (R85) subledgers
│   ├── returns/            # GSTR-1, GSTR-3B, GSTR-9 preparers and settlement
│   ├── einvoice/           # NIC gateway integration, signed QR codes, IRN logs
│   ├── ewaybill/           # Part-A/Part-B generation, transporter updates
│   ├── audit/              # Cryptographic event trail, 72-month retention timeline
│   └── governance/         # Regulatory rule repository, CBIC circular ASTs
│
├── api/
│   ├── client.ts           # Enterprise API Client instance and HTTP error classes
│   ├── contracts.ts        # Re-exported authoritative TypeScript contracts
│   └── endpoints/          # Specific endpoint client wrappers
│
├── hooks/                  # TanStack Query feature hooks (usePeriodControl, useTaxExplainer, etc.)
├── stores/                 # Zustand UI and Entity Context stores (useEntityContextStore)
├── fixtures/               # Isolated demo fixtures and test datasets
├── lib/                    # Shared utility functions (formatting, date, math)
├── types/                  # Global application types
└── styles/                 # Tailwind CSS entry and custom styling rules
```

---

## 4. Frontend Security & RBAC Model

### 4.1 Principle of Separation
> *"Frontend RBAC is UX protection. Backend RBAC is security enforcement."*

- The frontend hides or disables controls that the active user is not permitted to access, preventing friction and user confusion.
- The backend evaluates JWT signatures, entity memberships, and RBAC permissions on every incoming API request using PostgreSQL Row-Level Security (RLS).
- A malicious actor attempting to invoke an endpoint via `curl` or modified client code receives `HTTP 401 Unauthorized` or `HTTP 403 Forbidden`.

### 4.2 Supported Enterprise Roles
1. **`SUPER_ADMIN`**: Full platform authority, organization setup, tenant management.
2. **`TAX_ADMIN`**: GSTIN configuration, period transitions, return approval and filing.
3. **`OPERATIONS_ACCOUNTANT`**: Inward/outward invoice entry, draft compilation, reconciliation matching.
4. **`FINANCE_APPROVER`**: High-value invoice approval, vendor payments, credit limit overrides.
5. **`STATUTORY_AUDITOR`**: Read-only compliance archive inspection, ledger verification, audit logs.
6. **`BUSINESS_VIEWER`**: Executive dashboards, high-level filing reports, turnover summaries.

---

## 5. Migration Strategy: KEEP → REFACTOR → REPLACE → REMOVE

| Module / Component | Action | Details |
|---|---|---|
| Control Tower UI | **REFACTOR** | Preserve visual layout; decouple from `Math.random()`; connect to `/api/v1/architecture/persistence/health` and `/api/v1/architecture/ledger`. |
| Invoices & E-Invoice | **REFACTOR** | Retain invoice creation forms; replace client-side tax computation with backend `/api/v1/tax-engine/calculate`. |
| Reconciliation Workspace | **REFACTOR** | Preserve multi-evidence comparison UI; connect evidence sources to `/api/v1/reconciliation/evidence-sources`. |
| Hash-Based Router | **REPLACE** | Replace `useHashLocation` with React Router (`BrowserRouter` + `Routes` + `Route`). Add hash redirector for backward compatibility. |
| Global Entity Context | **REPLACE** | Replace hard-coded string literals with Zustand `useEntityContextStore` synced to `enterpriseApiClient`. |
| Legacy `services/api.ts` | **REFACTOR** | Progressively route business calls through `enterpriseApiClient`; deprecate direct `localStorage` persistence. |
| Client Tax Calculator | **REPLACE** | Replace client calculation engine with backend statutory services; retain only as a mock test fixture in `/src/fixtures/`. |
| Financial `localStorage`/Dexie | **REMOVE** | Prohibit browser storage as authoritative financial persistence. Use solely for temporary offline form drafts. |

---

## 6. Architecture Sign-Off
- **Approved Stack:** React 19 + TypeScript + Vite + React Router + TanStack Query + Zustand + Tailwind CSS.
- **Specification Compliance:** 100% aligned with `/docs/PHASE_2_FRONTEND_UX_DESIGN.md`.
