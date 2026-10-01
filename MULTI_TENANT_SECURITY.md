# TaxFlow — Multi-Tenant Security & Boundary Isolation

## 1. Multi-Tenant Isolation Overview

TaxFlow enforces strict multi-tenant boundary isolation across every API endpoint, background worker task, database query, report export, and webhook payload.

```text
Request Input Sources
(URL Params, Query String, Request Body, HTTP Headers)
                         │
                         ▼
        TenantContextGuard Validation
  (Verifies authenticated JWT tenantId matches)
                         │
       ┌─────────────────┴─────────────────┐
       ▼                                   ▼
 [Match Verified]                   [Mismatch Attempt]
Attach tenantId to request          Throw ForbiddenException
Execute with RLS Context            Log Security Violation
```

---

## 2. Attack Vector Protection Matrix

| Attack Vector | Vulnerability Attempt | Defense Mechanism | Result |
|---|---|---|---|
| URL Parameter Substitution | Requesting `/api/v1/invoices/inv-tenant-b` with Tenant A JWT | `TenantContextGuard` & `SalesInvoice.findFirst(where: { tenantId })` | 🚫 Blocked (403) |
| Header Spoofing | Supplying `x-tenant-id: tenant-b` header with Tenant A JWT | `TenantContextGuard` enforces JWT claim as single source of truth | 🚫 Blocked (403) |
| Request Body Injection | Sending `{ "tenantId": "tenant-b" }` in POST body | `TenantContextGuard` validates payload `tenantId === user.tenantId` | 🚫 Blocked (403) |
| UUID Substitution | Guessing foreign UUIDs in bulk upload/exports | SQL query scoped by `tenantId` in `WHERE` clause | 🚫 Blocked (404/403) |
| Background Job Spoofing | Enqueueing async job with forged `tenantId` | `JobDispatcherService` validates payload `tenantId === securityContext.tenantId` | 🚫 Blocked (403) |
| Report Download Token Reuse | Tenant B downloading Tenant A export URL | `ReportExportService` verifies `record.tenantId === requestingTenantId` | 🚫 Blocked (403) |
| Webhook Cross-Tenant Injection | Injecting payment webhook payload for foreign tenant | `PaymentWebhookService` verifies HMAC signature matching tenant webhook secret | 🚫 Blocked (401) |

---

## 3. Scope Hierarchy Enforcement

Isolation is enforced hierarchically:
`Tenant → Company → GSTIN → Branch → User`

A user authenticated under Tenant A cannot access resources under Tenant B, nor can a user restricted to Branch 1 access Branch 2 data within the same tenant.
