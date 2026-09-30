# TaxFlow — Stage 10 Entitlement Architecture

## 1. Core Principles & Single Authoritative Pipeline

The Entitlement Engine centralizes feature gating and quota enforcement for TaxFlow. It consolidates the pre-existing entitlement types from `src/core/entitlements/types.ts` into NestJS backend services. Plan checks are strictly prohibited inside domain controllers or scattered throughout application logic (e.g. `if (plan === "PRO")`). All feature availability and usage limits are evaluated against symbolic keys (`Feature` and `UsageMetric`).

```text
User Request
    ↓
1. Authentication & JWT Validation
    ↓
2. Tenant Authorization (RBAC)
    ↓
3. Subscription Entitlement Check (Feature Gating)
    ↓
4. Usage Limit Check (Hard / Soft Quotas)
    ↓
5. Business Operation Execution
```

---

## 2. Plan Definitions & Feature Mapping

Features are defined in `src/core/entitlements/types.ts`:

- `INVOICES`, `PURCHASES`, `E_INVOICE`, `E_WAY_BILL`
- `GST_RETURNS`, `RECONCILIATION`, `ITC`
- `AI`, `AUTOMATION`
- `MULTI_GSTIN`, `MULTI_BRANCH`
- `ERP_INTEGRATION`, `API`, `WEBHOOKS`
- `ADVANCED_RBAC`, `AUDIT_LOGS`, `CLOUD_BACKUPS`
- `WHATSAPP_ALERTS`, `DATABASE_SYNC`

### Default Plan Matrix:

| Feature / Limit Key | STARTER | PROFESSIONAL | ENTERPRISE |
|---|---|---|---|
| `INVOICES` | ✅ Enabled | ✅ Enabled | ✅ Enabled |
| `E_INVOICE` | ❌ Disabled | ✅ Enabled | ✅ Enabled |
| `E_WAY_BILL` | ❌ Disabled | ✅ Enabled | ✅ Enabled |
| `ERP_INTEGRATION` | ❌ Disabled | ❌ Disabled | ✅ Enabled |
| `AI` | ❌ Disabled | ✅ Enabled | ✅ Enabled |
| Max Invoices / Mo | 500 | 5,000 | Unlimited (-1) |
| Max Users | 2 | 10 | Unlimited (-1) |
| Max GSTINs | 1 | 5 | Unlimited (-1) |
| Max Branches | 1 | 10 | Unlimited (-1) |
| Max Storage (MB) | 1,000 | 10,000 | Unlimited (-1) |

---

## 3. Limit Policy Engine (`EntitlementsService`)

The limit engine evaluates quota consumption into four distinct evaluation states:

1. **`UNLIMITED`**: The plan provides unbounded usage (-1 quota).
2. **`FEATURE_DISABLED`**: The requested feature is not included in the active subscription plan.
3. **`SOFT_WARNING`**: Usage has exceeded the warning threshold (default 80% of quota). The request proceeds normally, but warnings are returned in response metadata and logged for billing alerts.
4. **`HARD_LIMIT_EXCEEDED`**: Usage has reached or exceeded 100% of the allocated quota. Hard-gated business operations throw `ForbiddenException(Quota exceeded for <metric>)`.

---

## 4. Hard-Gated vs. Soft-Gated Classification

To maintain operational integrity without causing accidental business disruption, TaxFlow classifies operations into **hard-gated** and **soft-gated** enforcement categories.

### Hard-Gated Operations:
*New resource allocation or outbound compliance submissions that directly impact billing tiers or third-party costs.*
- Invoice / E-Invoice / E-Way Bill Creation beyond monthly limit.
- Adding Users, GSTINs, or Branches exceeding plan limit.
- Enabling un-entitled ERP integrations or Webhooks.
- Consuming AI generation requests beyond quota.

### Soft-Gated Operations:
*Core operational views, reporting, audit trails, and statutory compliance read operations.*
- GST Return generation when slightly exceeding invoice limits (soft warning appended to UI).
- Viewing historical tax ledgers or downloading existing invoices.
- System audit trail access & compliance data export.
- Immediate billing alerts and provider notification retries.

*Rationale*: Compliance reporting and historical data accessibility must never be completely blocked due to minor billing sync delays or soft limit breaches.
