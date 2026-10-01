# TaxFlow — Stage 12 Reporting Architecture

## 1. Executive Summary

The TaxFlow Reporting Engine establishes a unified, multi-tenant Business Intelligence (BI) and reporting platform across financial, statutory GST, and management analytics domains.

## 2. Core Architectural Rule

**Read Model Pipeline Integrity**:
The reporting architecture strictly adheres to a one-way read model pipeline:

```text
Authoritative Domain Tables
(SalesInvoice, TaxLedgerEntry, ItcRecord, Gstr2bRecord, GstReturn)
                 │
                 ▼
     Read Model / Query Layer
(FinancialReportsService, GstReportsService, AnalyticsService)
                 │
                 ▼
      Standardized Report DTO
                 │
                 ▼
       Export Engine (CSV/PDF)
```

**Anti-Pattern Prevention**:
- Reports **never** recalculate taxes independently.
- Reports **never** mutate domain state.
- All numbers presented in reports are directly queryable from authoritative ledgers, tax engine results, or posted invoices established in Stages 4–6.

---

## 3. Standardized Filter Model

Every report endpoint and service method accepts a uniform filter envelope (`StandardReportFilters`):

- `tenantId` (Mandatory, extracted from JWT)
- `companyId` (Optional filter)
- `gstinId` (Optional GSTIN filter)
- `branchId` (Optional Branch filter)
- `fromDate` & `toDate` (Optional date range filter: `YYYY-MM-DD`)
- `taxPeriod` (Optional tax period filter: `YYYY-MM`)
- `fiscalYear` (Optional fiscal year filter: e.g. `2026-2027`)
- `limit` & `offset` (Pagination)

---

## 4. Authorization & Security

1. **Strict Multi-Tenant Scoping**: All SQL queries append `WHERE tenant_id = :tenantId`.
2. **Permission-Gated Access**: Sensitive reports (e.g. Sales Register, Tax Liability) enforce `REPORT_VIEW` and `SENSITIVE_FINANCIAL_REPORT_VIEW` permissions.
3. **Audit Integration**: Report exports trigger immutable audit logging (`REPORT_EXPORTED`) in Stage 8 `ImmutableAuditLog`.
