# TaxFlow: Frontend Component Architecture Specification
**Document Version:** 1.0.0-FROZEN  
**Design System:** Enterprise B2B SaaS (High Information Density, Accessible, Minimalist Dark Canvas)  
**WCAG Compliance:** AA Level (Contrast > 4.5:1, Full Keyboard Navigability, Semantic HTML5)

---

## 1. Architectural Component Hierarchy

```
App (Root Provider & Router)
 ├── InactivityTracker (Security Session Guard)
 └── AppRouter
      └── Layout (Application Shell)
           ├── GlobalHeader
           │    ├── EntityBreadcrumb (Holding Group > Legal Entity > GSTIN > Branch)
           │    ├── PeriodControlSelector (Tax Period Picker & Period State Badge)
           │    ├── GlobalSearchDialog (Cmd+K / Ctrl+K shortcut)
           │    ├── NotificationCenter (WebSocket live alerts)
           │    └── UserProfileMenu (Role, Switch Tenant, Logout)
           ├── NavigationSidebar
           │    ├── Core Operations (Control Tower, Invoices, Reconciliation)
           │    ├── Compliance Registers (Exceptions, ITC, RCM, Ledgers)
           │    ├── Statutory Filings (GSTR-1, GSTR-3B, GSTR-9)
           │    └── Admin & System (Org, Integrations, Audit, Settings)
           └── MainContentCanvas
                ├── [Page View / Feature Component]
                ├── TaxExplainerDrawer (Global Flyout)
                └── AuditHistoryDrawer (Global Flyout)
```

---

## 2. Specialized Shared Enterprise Components

### 2.1 Tax Explainer Drawer (`TaxExplainerDrawer.tsx`)
**Directive Compliance:** Must display backend-provided tax provenance without presenting itself as legal advice.
- **Contract Consumed:** `TaxExplainerResponse`
- **Data Attributes Displayed:**
  1. **Tax Inputs:** Taxable Value, Place of Supply, Supplier State Code, Recipient State Code, Transaction Type (B2B, B2C, SEZ, Export).
  2. **Resolved Rule Identifier:** Unique Rule AST ID (e.g., `RULE-GST-SEC10-INTRA-GOODS-2024-v2`).
  3. **Rule Version & Effective Date:** Exact statutory version number and gazette effective date.
  4. **Tax Treatment Applied:** `INTRA_STATE_CGST_SGST` vs `INTER_STATE_IGST` vs `NIL_RATED` vs `ZERO_RATED`.
  5. **Calculation Breakdown:** Step-by-step arithmetic steps showing rate, base value, tax amount, and rounding adjustment.
  6. **Legal Provenance:** Section of the CGST/IGST Act, relevant notification number, or circular reference.
  7. **Statutory Disclaimer Badge:** Explicit persistent banner:
     > *"Notice: This breakdown explains the automated deterministic calculation executed by the TaxFlow Statutory Engine. It is intended solely for internal compliance verification and does not constitute formal legal counsel."*

### 2.2 Period Control Bar (`PeriodControlBar.tsx`)
**Directive Compliance:** Reflects the 5-stage period state machine and prevents invalid client mutations.
- **States:** `OPEN`, `UNDER_REVIEW`, `APPROVED`, `FILED`, `LOCKED`
- **Visual Feedback:**
  - `OPEN`: Green accent badge; all creation and edit actions active.
  - `UNDER_REVIEW`: Amber accent; reconciliation locked, exceptions open for triage.
  - `APPROVED`: Blue accent; edit controls disabled; awaiting filing.
  - `FILED`: Purple accent; read-only display; ARN and submission timestamps visible.
  - `LOCKED`: Slate/Gray padlock badge; all mutation buttons replaced with "Locked Period" tooltips.
- **Actions:**
  - Forward Transition Trigger (with dual-signoff confirmation modal).
  - Controlled Amendment Request modal (for post-filing adjustments).

### 2.3 Extensible Reconciliation Evidence Workspace
**Directive Compliance:** Supports arbitrary evidence datasets beyond simple 2B/PR matching.
- **Extensible Architecture:** Renders registered evidence sources dynamically retrieved from `/api/v1/reconciliation/evidence-sources`:
  1. `PURCHASE_REGISTER` (Internal ERP / Inward Ledger)
  2. `GSTR_2B` (GSTN Auto-Drafted Statutory Feed)
  3. `E_WAY_BILL` (NIC Movement Register)
  4. `CUSTOMS_ICEGATE` (Bill of Entry Inward Imports)
  5. `BANK_STATEMENT` (Payment Discharge Records)
  6. `VENDOR_DISPATCH` (Supplier ASN Inward Feed)
- **Matching Matrix:** Displays side-by-side evidence chips with confidence scores (100% Exact, 95% Date-Tolerance, 80% Tax-Tolerance, 0% Unmatched).

### 2.4 Centralized Exception Inbox (`ExceptionInbox.tsx`)
**Directive Compliance:** Standardized triage and resolution workflow for the 10 discrepancy domains.
- **Domain Tabs:**
  1. `ITC_MISMATCH`: Purchase Register vs. GSTR-2B credit discrepancies.
  2. `GSTR1_VS_GSTR3B`: Outward liability variance exceeding Rule 88C limits.
  3. `EWAY_BILL_INVOICE_VARIANCE`: Part-A vs Sales Invoice value mismatch.
  4. `VENDOR_GSTIN_INACTIVE`: Blocked or cancelled supplier status under Section 16(2)(c).
  5. `HSN_RATE_ANOMALY`: Incompatible HSN/SAC rate classifications.
  6. `PLACE_OF_SUPPLY_ERRORS`: Invalid interstate vs intrastate treatment.
  7. `RULE_42_43_EXCESS`: Ineligible exempt-turnover ITC claimed.
  8. `RCM_UNPAID`: Unpaid reverse charge liability on notified goods/services.
  9. `E_INVOICE_IRN_GAP`: Sales invoice exceeding turnover threshold lacking valid IRN.
  10. `TDS_TCS_CREDIT_GAP`: Discrepancy between internal sales and GSTR-7/8 portal credits.

---

## 3. Form Validation Architecture

Form validation is split into two non-overlapping layers:

1. **Client-Side Validation (Structural Only):**
   - Syntax format: GSTIN checksum (`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`), PAN (`^[A-Z]{5}[0-9]{4}[A-Z]{1}$`), PIN code (6 digits).
   - Cardinality: Required fields, positive quantities, non-negative unit prices.
   - Date sanity: Invoice date not in the future, within allowable tax period window.

2. **Server-Side Validation (Statutory & Semantic):**
   - Tax rate determination and applicability.
   - Inter-state vs intra-state classification.
   - GSP/GSTN taxpayer status verification.
   - Period-lock compliance verification.
   - Any client calculation is prohibited.
