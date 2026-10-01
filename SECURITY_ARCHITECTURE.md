# TaxFlow — Stage 13 Security Architecture

## 1. Executive Summary

The TaxFlow Security Architecture establishes an enterprise-grade, defense-in-depth security model across the entire SaaS platform. The system is designed to prevent cross-tenant data leakage, unauthorized privilege escalation, statutory audit tampering, financial calculation bypass, API injection attacks, and secret exposure.

## 2. Security Defense-in-Depth Model

```text
Incoming API / Event Request
              │
              ▼
1. Transport Layer Security (HTTPS / TLS 1.3)
              │
              ▼
2. API Gateway & Rate Limiting Guard
              │
              ▼
3. JWT Authentication & Session Validation
              │
              ▼
4. Tenant Context & Boundary Isolation Guard (TenantContextGuard)
              │
              ▼
5. Role & Permission Authorization (RBAC / SoD)
              │
              ▼
6. Domain Immutability & Financial Control Guards
              │
              ▼
7. Database RLS Context Setting (SET LOCAL app.current_tenant_id)
              │
              ▼
8. PostgreSQL Row-Level Security Policies (Append-Only Audit)
```

---

## 3. Core Security Pillars

1. **Multi-Tenant Isolation**: Enforces tenant boundary isolation across URL parameters, query parameters, request bodies, HTTP headers, background jobs, document download tokens, and webhooks.
2. **PostgreSQL Row-Level Security (RLS)**: Database tables enforce `tenant_id` policies via session variable `app.current_tenant_id`.
3. **Financial Immutability & Statutory Locks**: Posted invoices and ledger entries cannot be mutated or deleted. Locked tax periods block new transaction creation.
4. **Cryptographic Protection**: AES-256-GCM authenticated encryption for stored gateway credentials; HMAC SHA-256 signatures for payment webhooks.
5. **SHA-256 Immutable Audit Trail**: Audit records are append-only with SHA-256 hash chaining to detect event forgery or record tampering.
