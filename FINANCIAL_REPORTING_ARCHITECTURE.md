# TaxFlow — Stage 12 Financial Reporting Architecture

## 1. Scope & Domain Coverage

The Financial Reporting module (`FinancialReportsService`) provides comprehensive transactional and ledger visibility for tax accounting:

1. **Sales Register**: Aggregates outward sales invoices (`invoiceCategory = SALES`), listing taxable values, CGST, SGST, IGST, cess, and total amounts.
2. **Purchase Register**: Aggregates inward purchase invoices (`invoiceCategory = PURCHASE`), supplier GSTINs, and ITC claims.
3. **Tax Liability Report**: Aggregates output tax liabilities directly from `TaxLedgerEntry` records (`entryType = OUTPUT_LIABILITY`).
4. **Input Tax Credit Report**: Summarizes eligible vs ineligible ITC from `ItcRecord` and `TaxLedgerEntry` (`entryType = INPUT_TAX_CREDIT`).
5. **HSN/SAC Summary Report**: Consolidates invoice line items grouped by HSN/SAC codes for statutory reporting.
6. **Customer-wise Sales**: Summarizes total revenue, invoice counts, and tax contributions per customer.
7. **Vendor-wise Purchases**: Summarizes total spend, invoice counts, and ITC claims per supplier.
8. **Invoice Ageing Report**: Buckets outstanding invoices by age (0-30, 31-60, 61-90, 90+ days).
9. **Tax-Period Summary**: Provides a consolidated overview of liabilities, credits, and net tax payable for a specific period.

---

## 2. Authoritative Data Source Mapping

| Financial Report | Primary Authoritative Table | Supporting Tables |
|---|---|---|
| Sales Register | `SalesInvoice` (`SALES`) | `Party`, `SalesInvoiceItem` |
| Purchase Register | `SalesInvoice` (`PURCHASE`) | `Party`, `ItcRecord` |
| Tax Liability | `TaxLedgerEntry` (`OUTPUT_LIABILITY`) | `SalesInvoice` |
| Input Tax Credit | `ItcRecord` | `TaxLedgerEntry` (`INPUT_TAX_CREDIT`) |
| Invoice Ageing | `SalesInvoice` (`POSTED`, `VALIDATED`) | `Party` |
