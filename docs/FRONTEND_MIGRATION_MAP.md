# TaxFlow: Frontend Migration Map (KEEP → REFACTOR → REPLACE → REMOVE)
**Document Version:** 1.0.0-FROZEN  
**Target:** Systematic transformation of the TaxFlow React codebase into an enterprise-grade compliance platform without blind rewrites.

---

## 1. Migration Strategy Overview

Every file and module across the TaxFlow repository is categorized into one of four distinct operational pathways:
1. **KEEP**: High-value UI components, domain types, charts, and layout elements that align with the target architecture.
2. **REFACTOR**: Essential business interfaces that require decoupling from local state, migration to TanStack Query, or connection to the `EnterpriseApiClient`.
3. **REPLACE**: Legacy constructs being superseded by standardized modern tooling (e.g., hash routing replaced by React Router).
4. **REMOVE**: Anti-patterns, direct financial storage in the browser, or obsolete stubs.

---

## 2. File-by-File Classification & Action Plan

### 2.1 Core Application & Shell

| File Path | Action | Rationale & Migration Execution |
|---|---|---|
| `/App.tsx` | **REPLACE** | Replaced with `/src/app/App.tsx` and modern React Router DOM `<AppRouter>`. Legacy hash routing removed. |
| `/index.tsx` | **REFACTOR** | Refactored to mount the consolidated `<App />` provider tree cleanly. |
| `/components/Layout.tsx` | **REFACTOR** | Keep visual structure and enterprise sidebar; refactor `onNavigate` to utilize React Router's `useNavigate()`; bind tenant switcher to `useEntityContextStore`. |
| `/components/Header.tsx` | **REFACTOR** | Bind entity breadcrumbs, active GSTIN, and period selector to `useEntityContextStore`. |
| `/components/NotificationCenter.tsx` | **KEEP** | Retain WebSocket alert feed and compliance toast notifications. |
| `/components/WorkspaceSyncContext.tsx` | **REFACTOR** | Restrict sync scope to non-financial offline drafts; eliminate full financial database syncing. |
| `/components/InactivityTracker.tsx` | **KEEP** | Retain 15-minute security idle timer and session lock. |

### 2.2 Operational Views & Screens (Phase 2 Frozen 29 Screens)

| File Path | Action | Rationale & Migration Execution |
|---|---|---|
| `/pages/ControlTowerPage.tsx` | **REFACTOR** | Keep comprehensive radar layout; remove random simulation logic (`Math.random()`); connect to `/api/v1/architecture/persistence/health` and `/api/v1/architecture/ledger`. |
| `/pages/Invoices.tsx` | **REFACTOR** | Retain invoice list and creation workflows; remove client-side tax calculation; invoke `useTaxEngineCalculation()` via backend; add HTTP 423 Period Lock guard. |
| `/pages/Reconciliation.tsx` | **REFACTOR** | Retain multi-evidence visual matching workspace; generalize evidence ingestion via `/api/v1/reconciliation/evidence-sources` to support ERP/EWB/Bank feeds. |
| `/pages/ExceptionInboxPage.tsx` | **REFACTOR** | Connect to centralized `/api/v1/compliance/exceptions` and bind resolution actions to `useResolveException()`. |
| `/pages/Computation.tsx` (Ledger) | **REFACTOR** | Retain Cash (R87), Credit (R86), and Liability (R85) subledger tables; populate via TanStack Query from backend ledger endpoints. |
| `/pages/Filing.tsx` (Returns) | **REFACTOR** | Retain GSTR-1 and GSTR-3B preparation UI; remove client-side formula computations; bind pre-check and filing to backend GSP orchestrator. |
| `/pages/Organization.tsx` | **REFACTOR** | Retain 4-tier hierarchy manager; bind mutations to backend organization endpoints. |
| `/pages/EInvoicePage.tsx` | **REFACTOR** | Retain NIC IRN generation and signed QR code display; consume backend IRP adapter. |
| `/pages/EWayBillPage.tsx` | **REFACTOR** | Retain Part-A/Part-B movement manager; consume backend EWB adapter. |
| `/pages/PartyMasterPage.tsx` | **KEEP** | Retain vendor and customer master tables; verify GSTR-2B compliance flags. |
| `/pages/AuditLogs.tsx` | **KEEP** | Retain cryptographic audit log inspection and filter controls. |
| `/pages/RegulatoryIntelligencePage.tsx` | **KEEP** | Retain CBIC gazette notification browser and statutory timeline feed. |
| `/pages/Reports.tsx` | **KEEP** | Retain report export engine and PDF/Excel generation controls. |

### 2.3 Data Layer, APIs & State

| File Path | Action | Rationale & Migration Execution |
|---|---|---|
| `/services/api.ts` (Legacy) | **REFACTOR** | Transition all remaining API calls to `/src/api/client.ts` (`EnterpriseApiClient`); deprecate monolithic client. |
| `/services/api/enterpriseApiClient.ts` | **KEEP / REFACTOR** | Keep as the authoritative production gateway; decouple hard-coded demo context; bind dynamically to `useEntityContextStore`. |
| `/services/contracts/enterpriseContracts.ts`| **KEEP** | Authoritative shared TypeScript contracts. |
| `/store/store.ts` (Redux) | **REFACTOR** | Maintain during transition; migrate entity context and UI states to Zustand (`useEntityContextStore`); migrate server data to TanStack Query. |
| `/services/gstEngine/taxCalculator.ts` | **REPLACE** | Prohibit client invocation; keep strictly as server-side reference or test fixture in `/src/fixtures/`. |
| `/services/db.ts` (Dexie) | **REFACTOR / REMOVE**| Remove all financial persistence; retain strictly as a temporary offline draft scratchpad. |

---

## 3. Migration Checklist & Quality Gate

- [x] React Router installed and configured with clean `/path` routes.
- [x] Legacy hash URL redirector tested and operational.
- [x] Zustand `useEntityContextStore` created and synchronized with `EnterpriseApiClient`.
- [x] Demo entity fixtures isolated in `/src/fixtures/demoEntityContext.ts`.
- [x] TanStack Query feature hooks implemented (`usePeriodControl`, `useTaxExplainer`, `useExceptions`, `useReconciliation`).
- [x] Zero client-side statutory tax logic enforced.
- [x] Strict 5-stage period state machine and HTTP 423 handling documented and wired.
- [x] TypeScript compilation (`tsc --noEmit`) passes with 0 errors.
