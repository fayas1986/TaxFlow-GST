# TaxFlow — PostgreSQL Row-Level Security (RLS) Verification

## 1. Overview & Architecture

To prevent database isolation bypasses even if application-level filters are accidentally omitted, TaxFlow implements PostgreSQL Row-Level Security (RLS) policies at the database layer.

## 2. PostgreSQL RLS Session Variable Mechanism

Every database connection/transaction executed within a tenant request context triggers:

```sql
SET LOCAL app.current_tenant_id = '11111111-1111-1111-1111-111111111111';
SET LOCAL app.current_company_id = '22222222-2222-2222-2222-222222222222';
```

Executed via `PrismaService.withRlsContext()` and `RlsContextInterceptor`.

### Database Policy Definition Standard:
```sql
ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON sales_invoices
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
```

---

## 3. RLS Policy Audit & Table Coverage

RLS policies are enabled on 100% of tenant-owned tables:

- `tenants`
- `companies`
- `users`
- `gst_registrations`
- `branches`
- `parties`
- `sales_invoices`
- `tax_ledger_entries`
- `gstr2b_import_batches`
- `itc_records`
- `reconciliation_runs`
- `gst_returns`
- `einvoice_records`
- `ewaybill_records`
- `immutable_audit_logs`
- `background_job_records`
- `report_export_records`

---

## 4. Background Worker RLS Propagation

Background workers executing jobs via `JobWorkerService` set `withRlsContext(job.tenantId)` before processing domain logic, guaranteeing database-level isolation during async execution.
