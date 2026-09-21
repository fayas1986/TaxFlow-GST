# TaxFlow: Enterprise Frontend-Backend API Contracts Specification
**Document Version:** 1.0.0-FROZEN  
**Status:** ARCHITECTURALLY FROZEN & RATIFIED  
**Consumer Target:** React 19 Frontend (`src/api/enterpriseApiClient.ts`)  
**Authority Target:** NestJS BFF Gateway / Statutory Core Tax Engine

---

## 1. Architectural Authority Boundary & Invariants

To eliminate regulatory non-compliance, race conditions, and silent ledger corruption, the boundary between the React frontend and the backend services is strictly frozen under the following invariants:

1. **Frontend is Consumer Only:** The frontend application possesses **zero authority** over tax calculations, statutory rates, HSN tax classifications, Place of Supply determination, ITC eligibility, RCM liability, or ledger postings.
2. **Zero Statutory Calculations in Browser:** The React client never executes arithmetic or formulaic calculations regarding CGST, SGST, IGST, UTGST, Cess, Section 17(5) blocked credits, or Rule 42/43 apportionment. All calculation results must be rendered strictly from backend API responses.
3. **Mandatory Multi-Tenant & Context Headers:** Every HTTP request dispatched from the frontend must include the active entity hierarchy (`x-tenant-id`, `x-company-id`, `x-gstin-id`), the active filing tax period (`x-tax-period`), and a W3C trace correlation ID (`x-correlation-id`).
4. **Deterministic HTTP 423 Period Locking:** Any mutation attempted on a financial period in state `LOCKED` or `FILED` must be rejected with HTTP 423 Locked. The response must supply statutory amendment instructions rather than permitting direct record modification.

---

## 2. HTTP Request Headers & Traceability Protocol

All requests routed through `enterpriseApiClient` must supply the following headers:

| Header Name | Mandatory | Type | Format / Example | Description |
|---|---|---|---|---|
| `x-tenant-id` | **YES** | String | `GROUP-TATA` | Holding Group / Enterprise Top-Level Tenant ID |
| `x-company-id` | **YES** | String | `CO-TITAN` | Legal Entity PAN Identifier |
| `x-gstin-id` | **YES** | String | `27AABCT1332M1Z2` | 15-character State GSTIN for localized compliance |
| `x-branch-id` | Optional | String | `BR-MUM-01` or `ALL` | Specific operational unit or all branches |
| `x-tax-period` | **YES** | String | `2026-09` | ISO Year-Month format for active compliance period |
| `x-correlation-id` | **YES** | UUIDv4 | `corr-9a7b1c4e-5f82-...` | End-to-end distributed tracing across all microservices |
| `x-idempotency-key` | Conditional | UUIDv4 | `idemp-1b2c3d4e-...` | Required for non-safe statutory mutations (invoices, filings) |

---

## 3. Standard API Envelopes & Error Specifications

### 3.1 Success Envelope (Single Entity)

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-09-17T21:24:00.000Z",
    "correlationId": "corr-9a7b1c4e-5f82-412d-88b1-3e4b7c123456",
    "tenantId": "GROUP-TATA",
    "companyId": "CO-TITAN",
    "gstinId": "27AABCT1332M1Z2",
    "taxPeriod": "2026-09",
    "periodStatus": "OPEN",
    "version": "1.0.0"
  }
}
```

### 3.2 Paginated Envelope (Collections)

All list endpoints accept standard pagination and sorting query parameters:
`?page=1&pageSize=25&sortBy=date&sortDirection=desc&search=VendorXYZ`

```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "totalItems": 1420,
    "page": 1,
    "pageSize": 25,
    "totalPages": 57,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "meta": {
    "timestamp": "2026-09-17T21:24:00.000Z",
    "correlationId": "corr-9a7b1c4e-5f82-412d-88b1-3e4b7c123456",
    "tenantId": "GROUP-TATA",
    "companyId": "CO-TITAN",
    "gstinId": "27AABCT1332M1Z2",
    "taxPeriod": "2026-09",
    "periodStatus": "OPEN",
    "version": "1.0.0"
  }
}
```

### 3.3 RFC 7807 Problem Details Error Envelope

All API errors return a standard problem details JSON structure:

```json
{
  "success": false,
  "status": 422,
  "error": {
    "type": "https://taxflow.io/errors/validation-failed",
    "title": "Invoice Validation Failed",
    "detail": "Line item 2 contains an invalid 4-digit HSN code for turnover > ₹5 Crores.",
    "code": "ERR_HSN_INVALID_LENGTH",
    "instance": "/api/v1/invoices",
    "timestamp": "2026-09-17T21:24:00.000Z",
    "correlationId": "corr-9a7b1c4e-5f82-412d-88b1-3e4b7c123456",
    "validationErrors": [
      {
        "field": "lineItems[1].hsnSacCode",
        "code": "HSN_MIN_6_DIGITS_REQUIRED",
        "message": "Turnover exceeds ₹5 Cr; minimum 6 digits mandatory under Notification 78/2020.",
        "rejectedValue": "8471"
      }
    ]
  }
}
```

### 3.4 HTTP 423 Period Lock Error Structure

When an edit or creation is attempted on a locked period:

```json
{
  "success": false,
  "status": 423,
  "error": {
    "type": "https://taxflow.io/errors/period-locked",
    "title": "Statutory Period Locked",
    "detail": "Period 2026-09 has been permanently filed and sealed with ARN AA270926123456C.",
    "code": "ERR_PERIOD_LOCKED",
    "instance": "/api/v1/invoices/INV-2026-0981",
    "timestamp": "2026-09-17T21:24:00.000Z",
    "correlationId": "corr-9a7b1c4e-5f82-412d-88b1-3e4b7c123456",
    "periodLockDetails": {
      "period": "2026-09",
      "lockedAt": "2026-10-20T18:30:00.000Z",
      "lockedBy": "compliance-officer@taxflow.io",
      "currentState": "LOCKED",
      "filingArn": "AA270926123456C",
      "allowedAmendments": [
        {
          "protocol": "SECTION_34_CREDIT_DEBIT_NOTE",
          "targetPeriod": "2026-10",
          "actionEndpoint": "/api/v1/invoices/credit-notes"
        },
        {
          "protocol": "TABLE_9_GSTR_1_AMENDMENT",
          "targetPeriod": "2026-10",
          "actionEndpoint": "/api/v1/statutory/gstr-1/amendments"
        },
        {
          "protocol": "DRC_03_VOLUNTARY_PAYMENT",
          "targetPeriod": "2026-10",
          "actionEndpoint": "/api/v1/statutory/drc-03/create"
        }
      ]
    }
  }
}
```

---

## 4. Statutory Tax Engine & Tax Explainer Contract

### Endpoint: `POST /api/v1/tax-engine/calculate`

**Request Payload:**
```json
{
  "supplierGstin": "27AABCT1332M1Z2",
  "recipientGstin": "29AAACB1234F1Z5",
  "placeOfSupplyStateCode": "29",
  "isRecipientSez": false,
  "isExport": false,
  "documentType": "INVOICE",
  "documentDate": "2026-09-17",
  "lineItems": [
    {
      "lineNumber": 1,
      "hsnSacCode": "998311",
      "itemDescription": "Cloud Infrastructure Management Services",
      "quantity": 1,
      "unitPrice": 100000.00,
      "discountAmount": 0.00,
      "isRcmSubject": false,
      "isCapitalGood": false,
      "intendedUsage": "BUSINESS"
    }
  ]
}
```

**Response Payload:**
```json
{
  "success": true,
  "data": {
    "calculationId": "CALC-2026-98172",
    "calculatedAt": "2026-09-17T21:24:00.000Z",
    "totalTaxableValue": 100000.00,
    "totalCgstAmount": 0.00,
    "totalSgstAmount": 0.00,
    "totalIgstAmount": 18000.00,
    "totalCessAmount": 0.00,
    "grandTotalTax": 18000.00,
    "grandTotalInvoiceAmount": 118000.00,
    "taxTreatmentSummary": "INTER_STATE",
    "isRcmApplicable": false,
    "eligibleItcTotal": 18000.00,
    "blockedItcTotal": 0.00,
    "lineItems": [
      {
        "lineNumber": 1,
        "hsnSacCode": "998311",
        "taxableValue": 100000.00,
        "taxTreatment": "INTER_STATE",
        "cgstRate": 0.0,
        "cgstAmount": 0.00,
        "sgstRate": 0.0,
        "sgstAmount": 0.00,
        "igstRate": 18.0,
        "igstAmount": 18000.00,
        "cessRate": 0.0,
        "cessAmount": 0.00,
        "totalTaxAmount": 18000.00,
        "totalLineAmount": 118000.00,
        "isRcm": false,
        "itcEligibility": "ELIGIBLE_SERVICES",
        "statutoryProvenance": {
          "primarySection": "Section 10(1)(a) IGST Act, 2017",
          "rulesApplied": [
            "Section 7(1) IGST Act (Inter-State Supply Definition)",
            "Notification No. 11/2017 - Integrated Tax (Rate)"
          ],
          "ruleAstVersion": "GST-AST-2026.04-REL3",
          "effectiveDate": "2026-04-01",
          "notificationReference": "Notification No. 11/2017-CT(R) as amended",
          "explanationText": "Supplier state (27 - Maharashtra) differs from Place of Supply (29 - Karnataka). Supply constitutes an Inter-State supply subject to 18% Integrated Goods and Services Tax (IGST).",
          "nonLegalAdviceDisclaimer": "Statutory provenance and tax explanation generated strictly for audit documentation purposes. Does not constitute independent tax or legal counsel."
        }
      }
    ]
  },
  "meta": { ... }
}
```

---

## 5. Inward & Outward Invoices Contract

### 5.1 Endpoint: `GET /api/v1/invoices`
**Query Parameters:**
- `category`: `SALES` | `PURCHASE`
- `docType`: `INVOICE` | `CREDIT_NOTE` | `DEBIT_NOTE`
- `status`: `DRAFT` | `APPROVED` | `VALIDATED` | `IRN_GENERATED` | `CANCELLED`
- `taxPeriod`: `2026-09`
- `page`, `pageSize`, `sortBy`, `sortDirection`, `search`

### 5.2 Endpoint: `POST /api/v1/invoices`
**Request Payload:**
```json
{
  "category": "SALES",
  "docType": "INVOICE",
  "invoiceNumber": "INV-2026-1049",
  "date": "2026-09-17",
  "partyName": "Infosys Technologies Ltd",
  "partyGstin": "29AAACB1234F1Z5",
  "placeOfSupply": "29",
  "isRcm": false,
  "lineItems": [
    {
      "lineNumber": 1,
      "hsnSacCode": "998311",
      "description": "Cloud Architecture Consulting",
      "quantity": 1,
      "unit": "PCS",
      "unitPrice": 100000.00,
      "discount": 0.00,
      "taxableValue": 100000.00,
      "taxRate": 18.0
    }
  ]
}
```

---

## 6. Extensible Multi-Evidence Reconciliation Contract

### 6.1 Evidence Sources Configuration: `GET /api/v1/reconciliation/evidence-sources`
**Response Payload:**
```json
{
  "success": true,
  "data": [
    {
      "id": "PURCHASE_REGISTER_ERP",
      "displayName": "Inward Purchase Register (ERP / Books)",
      "authorityLevel": "PRIMARY_BOOKS",
      "isRealTime": false,
      "lastIngestedAt": "2026-09-17T20:00:00Z",
      "recordCount": 1840,
      "status": "CONNECTED"
    },
    {
      "id": "GSTR_2B_GOVERNMENT_PORTAL",
      "displayName": "GSTR-2B Data / Sync (GSTN Portal)",
      "authorityLevel": "STATUTORY_PORTAL",
      "isRealTime": false,
      "lastIngestedAt": "2026-09-14T06:00:00Z",
      "recordCount": 1782,
      "status": "CONNECTED"
    },
    {
      "id": "EWAY_BILL_INWARD",
      "displayName": "E-Way Bill Logistics Delivery Evidence",
      "authorityLevel": "PHYSICAL_LOGISTICS",
      "isRealTime": true,
      "lastIngestedAt": "2026-09-17T21:15:00Z",
      "recordCount": 612,
      "status": "CONNECTED"
    },
    {
      "id": "CUSTOMS_ICEGATE_BOE",
      "displayName": "ICEGATE Customs Bill of Entry Stream",
      "authorityLevel": "CUSTOMS_PORTAL",
      "isRealTime": false,
      "lastIngestedAt": "2026-09-15T12:00:00Z",
      "recordCount": 48,
      "status": "CONNECTED"
    }
  ],
  "meta": { ... }
}
```

### 6.2 Execute Multi-Source Reconciliation: `POST /api/v1/reconciliation/execute`
**Request Payload:**
```json
{
  "taxPeriod": "2026-09",
  "targetGstin": "27AABCT1332M1Z2",
  "evidenceSourcesToMatch": [
    "PURCHASE_REGISTER_ERP",
    "GSTR_2B_GOVERNMENT_PORTAL",
    "EWAY_BILL_INWARD"
  ],
  "tolerances": {
    "taxAmountTolerance": 5.0,
    "dateToleranceDays": 30,
    "fuzzyInvoiceNumberMatching": true
  }
}
```

---

## 7. Centralized Compliance Exception Inbox Contract

### 7.1 Filter Exceptions: `GET /api/v1/compliance/exceptions`
**Query Parameters:**
- `domain`: `ITC_MISMATCH` | `E_INVOICE_MISSING` | `E_WAY_BILL_EXPIRED` | `SECTION_16_4_DEADLINE` | `RULE_37_REVERSAL_180_DAYS` | `GSTIN_CANCELLED_SUPPLIER` | `REVERSE_CHARGE_UNPAID` | `CIRCULAR_TRADING_FLAG` | `DATA_QUALITY_HSN_INVALID` | `PERIOD_LOCK_VIOLATION`
- `severity`: `CRITICAL` | `HIGH` | `MEDIUM` | `LOW`
- `status`: `OPEN` | `IN_INVESTIGATION` | `ESCALATED` | `RESOLVED` | `WAIVED_WITH_AUDIT`

### 7.2 Resolve Exception: `POST /api/v1/compliance/exceptions/:id/resolve`
**Request Payload:**
```json
{
  "action": "ADJUST_CREDIT_NOTE",
  "justificationNotes": "Vendor confirmed clerical error in invoice #INV-9901; Credit Note #CN-044 issued for ₹18,000 difference.",
  "supportingDocumentId": "DOC-VAULT-991823"
}
```

---

## 8. Summary of API Contracts Status

| Domain | Contract File | Implementation File | Status |
|---|---|---|---|
| Envelopes & Headers | `/src/types/apiContracts.ts` | `/src/api/enterpriseApiClient.ts` | **FROZEN** |
| Tax Engine & Explainer | `/src/types/apiContracts.ts` | `/src/components/TaxExplainerDrawer.tsx` | **FROZEN** |
| Period State Machine | `/src/types/apiContracts.ts` | `/src/components/PeriodControlBar.tsx` | **FROZEN** |
| Invoices (Sales & Purchase) | `/src/types/apiContracts.ts` | `/pages/Invoices.tsx` | **FROZEN** |
| Multi-Evidence Reconciliation | `/src/types/apiContracts.ts` | `/pages/Reconciliation.tsx` | **FROZEN** |
| Exception Inbox | `/src/types/apiContracts.ts` | `/pages/ExceptionInboxPage.tsx` | **FROZEN** |
| Ledgers & Return Filing | `/src/types/apiContracts.ts` | `/pages/Filing.tsx`, `/pages/Computation.tsx` | **FROZEN** |
