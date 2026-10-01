# TaxFlow — Stage 12 GST Statutory Reporting Architecture

## 1. Statutory Alignments

The GST Reporting module (`GstReportsService`) builds statutory return views directly from posted transaction ledgers and statutory filing records:

1. **GSTR-1 Summary Report**:
   - Table 4A: B2B Invoices
   - Table 7: B2C Small Invoices
   - Table 6A: Exports / SEZ Supplies
   - Table 9B: Credit / Debit Notes (CDNR)
2. **GSTR-3B Summary Report**:
   - Table 3.1: Outward Taxable Supplies (Output Tax Liability)
   - Table 4: Eligible ITC (Import of Goods, Import of Services, Inward Supplies) & Ineligible ITC
   - Net Tax Payable Calculation (`Gross Liability - Eligible ITC`)
3. **GSTR-2B Reconciliation Report**:
   - Categorizes matches from `ReconciliationMatch`: `EXACT`, `PARTIAL`, `MISMATCH`, `MISSING_IN_PR`, `MISSING_IN_2B`.
4. **E-Invoice Status Report**:
   - Aggregates IRN generation status (`GENERATED`, `CANCELLED`, `FAILED`) from `EInvoiceRecord`.
5. **E-Way Bill Status Report**:
   - Summarizes active, expired, and cancelled E-Way Bills from `EWayBillRecord`.
6. **Filing Status & History**:
   - Tracks filing submission acknowledgements (`ARN`), timestamps, and filing statuses from `GstReturn` and `FilingSubmissionLog`.

---

## 2. Guaranteed Data Consistency

Because GSTR-1 and GSTR-3B report summaries read from the exact same `SalesInvoice` and `TaxLedgerEntry` records used during statutory return generation (Stage 6), **report numbers are guaranteed 100% consistent with filed returns**.
