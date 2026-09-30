# TaxFlow Database Architecture & Multi-Tenancy Strategy

## 1. Domain Hierarchy & Strict Multi-Tenant Isolation

TaxFlow structures all organizational data strictly according to a 5-tier relational hierarchy:

```
Tenant (Top-Level Isolation boundary)
  └── Company (Legal Entity / PAN level)
       └── GSTRegistration (GSTIN level - 15-digit Tax Identifier)
            └── Branch (Physical Location / Operational Place of Business)
                 └── Transaction (Invoice / Credit Note / Debit Note / Voucher)
```

### Isolation Rules
1. **Tenant Boundary (`tenant_id`)**: Every table containing operational business data MUST include `tenant_id UUID NOT NULL`.
2. **Compound Foreign Keys**: Child entities enforce tenant scoping via compound foreign keys:
   - `Company`: `(id, tenant_id)`
   - `GSTRegistration`: `(id, tenant_id, company_id)`
   - `Branch`: `(id, tenant_id, company_id, gstin_id)`
   - `SalesInvoice`: `(id, tenant_id, company_id, gstin_id)`
3. **Cross-Tenant Prevention**: Foreign key constraints guarantee that `company_id` referenced by a `GSTRegistration` belongs to the exact same `tenant_id`. Cross-tenant record association is physically impossible at the database engine level.

---

## 2. Monetary & Tax Precision Strategy

JavaScript `Number` (IEEE 754 float) introduces catastrophic rounding errors (e.g., `0.1 + 0.2 = 0.30000000000000004`). In Indian GST compliance:
- Tax computations must match statutory rounding (CGST/SGST rounded to 2 decimal places per invoice line or total).
- Decimal mismatch causes NIC E-Invoice / E-Way Bill API rejections.

### Database Precision Rules
- **Monetary Values**: `NUMERIC(16,4)` (Supports up to ₹99,999,999,999,999.9999).
- **Tax Rates**: `NUMERIC(5,2)` (Supports rate percentages e.g. `18.00`, `0.25`, `28.00`).
- **Prisma Representation**: All currency and tax fields use `Decimal` mapped to `Decimal.js` in TypeScript.

---

## 3. PostgreSQL Row-Level Security (RLS) as Defense in Depth

PostgreSQL RLS acts as an unbypassable layer of security behind application authorization logic.

### RLS Implementation Pattern
```sql
-- Enable RLS on all tenant tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE gstin_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_masters ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY tenant_isolation_policy ON sales_invoices
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

### Execution Session Context
Every request initiated by NestJS `PrismaService` opens a session block executing:
```sql
SET LOCAL app.current_tenant_id = 'c0a80101-0000-0000-0000-000000000001';
```

---

## 4. Statutory Rule Versioning & Tax Period Locking

### Statutory Tax Rules & Rate Matrix
GST rules and tax rate slabs change per government notifications.
- Rules are stored in `tax_rate_rules` and `hsn_sac_masters` with effective start and end dates (`effective_from`, `effective_to`).
- Invoices store both the applied rate and a snapshot of the applied rule version (`rule_version_id`), ensuring historical audits produce identical tax computations even after rate changes.

### Tax Period Locking Mechanism
Tax periods (`tax_periods` table) have states: `OPEN`, `LOCKED`, `FILED`, `ARCHIVED`.
- Trigger & Middleware Enforcements: When a `tax_period` is marked `LOCKED` or `FILED`, any `INSERT`, `UPDATE`, or `DELETE` on invoices or tax ledgers for that period is aborted with a PostgreSQL exception:
  `ERROR: 45000: Tax period 2026-08 is LOCKED/FILED. Transactions cannot be modified.`

---

## 5. Relational vs. JSONB Storage Strategy

| Data Category | Storage Strategy | Rationale |
| :--- | :--- | :--- |
| **Core Invoices, Line Items, Taxes** | Strictly Relational (`sales_invoices`, `invoice_items`) | Indexing, foreign keys, aggregated SQL tax reporting, immutability. |
| **Parties, HSN, Tax Ledgers** | Strictly Relational (`parties`, `hsn_masters`, `tax_ledgers`) | Master integrity, compound constraints, audit trails. |
| **GSTR-2B Raw Download** | Hybrid (`gstr2b_reconciliations` + `JSONB raw_payload`) | Fast relational matching + preservation of exact government payload. |
| **E-Invoice / E-Way Bill Responses** | Hybrid (`einvoices` + `JSONB raw_response`) | Quick lookup of Signed QR/IRN + storing full raw NIC payload. |
| **Audit Log Changes** | `JSONB` (`audit_logs.diff`) | Schema-agnostic storage of before/after delta snapshots. |
