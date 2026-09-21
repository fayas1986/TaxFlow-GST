# TaxFlow Phase 2: Enterprise Frontend UX/UI Architecture Specification & Contract Freeze
**Document Version:** 2.2.0-FINAL-FROZEN  
**Status:** ARCHITECTURAL FREEZE — AUTHORITATIVE BLUEPRINT FOR FRONTEND IMPLEMENTATION  
**Target Platform:** Next.js 15 (React 19 App Router) + Tailwind CSS + TanStack Query v5 + Zustand (UI state only) + NestJS Modular Monolith Backend + Neon PostgreSQL with RLS + Prisma ORM  

---

## 1. Architectural Freeze Statement & Statutory Disclaimer

### 1.1 Non-Authoritative Frontend Rule
> **CRITICAL ARCHITECTURAL MANDATE:** React / Next.js is **NOT** an authoritative tax engine. All tax calculations, rule resolutions, Place of Supply (POS) determinations, Input Tax Credit (ITC) eligibility decisions, Reverse Charge Mechanism (RCM) liabilities, reconciliation outcomes, return compilations, and subledger postings **MUST come exclusively from backend services**.

### 1.2 Zero Client-Side Statutory Logic Mandate
The frontend must **NEVER** hard-code:
- GST tax rates (0%, 0.1%, 0.25%, 1.5%, 3%, 5%, 12%, 18%, 28%)
- HSN / SAC schedule classifications
- Place of Supply (POS) statutory logic (Sections 10, 11, 12, 13 of IGST Act)
- Inter-State vs Intra-State tax treatment logic
- Input Tax Credit (ITC) eligibility decisions (Section 16)
- Blocked credit rules (Section 17(5))
- Reverse charge rules (Section 9(3) / 9(4))
- Rule 42 / 43 apportionment formulas
- Compensation Cess schedules (Ad-valorem / volumetric)
- Statutory turnover thresholds (₹5 Cr, ₹20 Cr, ₹50 Cr, ₹500 Cr)
- CBIC circulars or statutory notification rules

Mock and example values may exist **only** inside explicitly identified demo and test fixtures.

### 1.3 Statutory Tax Explainer Disclaimer
Every statutory tax explanation presented in the UI must prominently display the following mandatory statutory disclaimer:
> *"System calculation explanation derived from backend rules for operational auditability. Does not constitute independent legal advice."*

---

## 2. Authoritative Contracts (Freeze Baseline)

Before writing large-scale frontend views, the following contracts are frozen and verified:

### Contract 1: Entity & Tenant Context Hierarchy
```
[ HOLDING GROUP ] (e.g., Tata Group / Enterprise Holdings)
   └── [ COMPANY / LEGAL ENTITY (PAN) ] (e.g., Titan Company Ltd - AABCT1332M)
          └── [ STATE GSTIN ] (e.g., 27AABCT1332M1Z2 - Maharashtra)
                 └── [ OPERATIONAL BRANCH / UNIT ] (e.g., Mumbai Central Depot - BR-001)
```
- **Context Headers:** Every outgoing API request carries server-validated headers:
  - `x-tenant-id`: Holding Group ID
  - `x-company-id`: Legal Entity PAN ID
  - `x-gstin-id`: 15-character State GSTIN
  - `x-branch-id`: Operational Branch Code (`BR-001` or `ALL`)
  - `x-tax-period`: Active Financial Period (e.g., `2026-09`)
  - `x-correlation-id`: Cryptographic tracing ID
- **Security Rule:** Never trust an entity or role supplied only by browser storage. The server enforces tenant boundaries via Row-Level Security (RLS) in PostgreSQL.

### Contract 2: Financial Period State Machine
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│     OPEN     │ ──▶ │ UNDER REVIEW │ ──▶ │   APPROVED   │ ──▶ │    FILED     │ ──▶ │    LOCKED    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
 (Daily ops &         (Reconciliation     (Tax Head sign-off;   (GSTN submission;    (Frozen vault;
  inward/outward       active; draft       ready for return      ARN generated;       read-only; edits
  transactions)        returns compiled)   generation)           challans paid)       via amendments)
```
- **Backend Lock Enforcement:** When a period is in the `LOCKED` state, the backend rejects any standard `POST`, `PUT`, `PATCH`, or `DELETE` mutation on sales, purchases, or ledger entries with `HTTP 423 Locked`.
- **Controlled Amendment Protocol:** Post-filing corrections must be initiated as Section 34 Credit/Debit Notes or Form GST DRC-03 voluntary payment dockets requiring dual-manager authorization.

### Contract 3: Tax Engine & Tax Explainer Contract
```typescript
// GET/POST /api/v1/tax-engine/explain
export interface TaxExplainerResponse {
  docNumber: string;
  statutoryDisclaimer: "System calculation explanation derived from backend rules for operational auditability. Does not constitute independent legal advice.";
  provenanceLines: [
    {
      lineId: string;
      hsnSacCode: string;
      taxInputs: {
        supplierGstin: string;
        supplierState: string;
        recipientGstin?: string;
        placeOfSupply: string;
        taxableValue: number;
      };
      resolvedRule: {
        ruleId: string;
        ruleVersion: string;
        effectiveDate: string;
        statutoryNotification: string;
        legalSectionReference: string;
      };
      taxTreatment: 'INTER_STATE_IGST' | 'INTRA_STATE_CGST_SGST' | 'ZERO_RATED' | 'EXEMPT';
      calculationBreakdown: {
        taxableValue: number;
        igstRate: number;
        igstAmount: number;
        cgstRate: number;
        cgstAmount: number;
        sgstRate: number;
        sgstAmount: number;
        cessAmount: number;
        roundingProtocol: string; // Banker's Half-Up + Section 170
        totalTax: number;
      };
      provenance: {
        engineVersion: string;
        executionHash: string; // SHA-256
        correlationId: string;
        explanationText: string;
      };
    }
  ];
  overallExplanation: string;
}
```

### Contract 4: Centralized Enterprise Exception Model
Centralizes 10 operational and statutory discrepancy domains:
1. **`TAX_MISMATCH`**: Line rate vs master rule variance.
2. **`POS_ISSUE`**: Conflict between supplier state, buyer GSTIN, and delivery destination.
3. **`RULE_CONFLICT`**: Ambiguous circulars or overlapping notifications.
4. **`ITC_MISMATCH`**: Purchase Register vs GSTR-2B filing variance.
5. **`SEC_17_5`**: Blocked credits (vehicles, catering, club memberships).
6. **`RCM_ISSUE`**: Section 9(3)/9(4) unregistered supplier exposure and self-invoicing gaps.
7. **`RECONCILIATION`**: Multi-evidence matching discrepancies and duplicate billings.
8. **`IRP_FAILURE`**: NIC gateway schema validation and IRN generation failures.
9. **`EWB_FAILURE`**: Part-B vehicle update expirations and distance anomalies.
10. **`ERP_SYNC`**: Two-way data synchronization conflicts with SAP/Oracle/Tally.

**Schema Attributes:** `exceptionId`, `domain`, `severity` (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), `status` (`OPEN`, `UNDER_REVIEW`, `PENDING_VENDOR`, `AMENDED`, `RESOLVED`), `sourceRecordId`, `slaDueDate`, `assignedOwner`, `proposedAction`, `auditHistory`.

### Contract 5: Extensible Multi-Evidence Reconciliation
Reconciliation is an extensible multi-source framework:
- Evidence Adapters:
  1. `Purchase Register` (Primary accounting record)
  2. `GSTR-2B Data / Sync` (Asynchronous auto-drafted GSTN statement)
  3. `E-Way Bill Transit Proof` (NIC movement verification)
  4. `ERP General Ledger` (SAP/Tally journal postings)
  5. `Bank Payment Clearance` (Rule 37 180-day vendor payment proof)
  6. `Customs ICEGATE` (Bill of Entry import records)

### Contract 6: Deterministic 9-Stage Invoice Workflow
$$\text{Draft} \to \text{Validate} \to \text{Tax Calculate} \to \text{Review} \to \text{Approve} \to \text{Post} \to \text{IRN} \to \text{E-Way Bill} \to \text{Completed}$$
- Backend enforces step progression; client components cannot directly modify an invoice's state without satisfying transition validations.

---

## 3. Complete 29-Screen Inventory & Navigation Route Map

| # | Screen Name | Route Path | Primary Persona | Key Functional Scope |
|---|-------------|------------|-----------------|----------------------|
| 1 | Login & Authentication | `/login` | All Personas | SSO, TOTP MFA, session invalidation |
| 2 | Organization Management | `/settings/organization` | Super Admin | Group structure, Legal Entity PANs, CIN, entity master |
| 3 | Control Tower Dashboard | `/control-tower` | Exec, Tax Head | Pan-India liability radar, filing heatmap, telemetry |
| 4 | GSTIN Registration Master | `/masters/gstin` | Tax Admin | State GSTIN directory, authorized signatories, principal places |
| 5 | Branch Master | `/masters/branches` | Operations | Operational units, delivery depots, warehouse dispatch points |
| 6 | Customer Master | `/masters/customers` | Accountant | Buyer KYC, GSTIN validation, composition status, SEZ flags |
| 7 | Vendor Master & Risk | `/masters/vendors` | Procurement | Vendor compliance rating, MSME status, Rule 37 180-day aging |
| 8 | Item / HSN / SAC Master | `/masters/items` | Catalog Mgr | Goods & services master, UOM codes, statutory rate lookups |
| 9 | Sales Invoice Hub | `/sales/invoices` | Accountant | B2B, B2C, SEZ, Exports, CDN, delivery challans |
| 10 | Invoice Approval Gateway | `/sales/approvals` | Finance Approver | Multi-tier threshold approval queue with audit sign-offs |
| 11 | E-Invoice / IRN Gateway | `/sales/e-invoice` | Billing Ops | NIC gateway integration, 64-char IRN viewer, signed QR codes |
| 12 | E-Way Bill Operations | `/sales/ewaybill` | Logistics | Part-A generation, Part-B vehicle updates, multi-vehicle slips |
| 13 | Purchase Register | `/purchases/register` | Accountant | Inward invoices, Bill-of-Entry imports, expense categories |
| 14 | GSTR-2B Data / Sync | `/purchases/gstr-2b` | Tax Accountant | GSTN auto-sync, raw JSON viewer, ITC status indicators |
| 15 | ITC Management Center | `/itc/management` | Tax Manager | Section 17(5) blocking, Rule 42/43 reversals, Rule 37 tracker |
| 16 | RCM & Self-Invoicing | `/compliance/rcm` | Accountant | Section 9(3)/9(4) tracker, self-invoice creation, payment vouchers |
| 17 | Reconciliation Workspace | `/reconciliation` | Analyst, Auditor | Multi-evidence matching (PR vs 2B vs EWB vs ERP) |
| 18 | Authoritative Tax Ledger | `/ledger/electronic` | CFO, Auditor | Electronic Cash (R87), Credit (R86), and Liability (R85) ledgers |
| 19 | GSTR-1 Return Preparer | `/returns/gstr-1` | Tax Manager | Outward supplies summary compiled directly from Tax Ledger |
| 20 | GSTR-3B Settlement Center | `/returns/gstr-3b` | Tax Head | Outward tax, eligible ITC, Rule 88A set-off, cash vouchers |
| 21 | GSTR-9 Annual Return | `/returns/gstr-9` | Tax Counsel | Annual reconciliation, tables 4-14 auto-population, DRC-03 |
| 22 | Regulatory Rule Repository | `/regulatory/rules` | Compliance Officer | Versioned statutory rules, CBIC circulars, condition ASTs |
| 23 | Compliance Archive Timeline | `/compliance-archive` | Auditor, Legal | 72-month statutory snapshots, SHA-256 seals, CBIC certs |
| 24 | Cryptographic Audit Trail | `/audit/trail` | Security, Auditor | Append-only event ledger, change diffs, correlation tracing |
| 25 | Reports & Statutory Exports | `/reports` | Finance | Turnover reports, HSN summaries, state liability, audit packs |
| 26 | Users, Roles & Permissions | `/settings/rbac` | Super Admin | RBAC matrix, GSTIN-level scopes, branch access delegation |
| 27 | Integration Gateway | `/settings/integrations` | IT Lead | IRP, EWB, GSP, SAP/Tally adapter health, API quotas |
| 28 | Enterprise Exception Center | `/compliance/exceptions` | All Roles | Centralized discrepancy triage across all 10 domains |
| 29 | System Settings | `/settings/system` | System Admin | Calculation rounding rules, invoice sequences, backup policies |

---

## 4. Design System & Component Library

### 4.1 Typography Pairing
- **Display Headings:** `Plus Jakarta Sans` (`font-sans`, weights: 600, 700, 800)
- **UI & Body Text:** `Inter` (`font-body`, weights: 400, 500, 600)
- **Financial & Tabular Numerals:** `JetBrains Mono` (`font-mono`, tabular figures for invoices, ledgers, tax amounts)

### 4.2 8pt Spacing Grid
All paddings, margins, and heights strictly adhere to multiples of 8 (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`).

### 4.3 Semantic Status Palette
- **Authority Action / Primary:** Indigo-600 (`#4F46E5`)
- **Compliance Verified / Approved:** Emerald-600 (`#059669`)
- **Discrepancy / Review Pending:** Amber-600 (`#D97706`)
- **Blocked / Period Locked / Critical:** Rose-600 (`#E11D48`)
- **Financial Ledger / Deep Storage:** Slate-900 (`#0F172A`)

### 4.4 Standardized Reusable UI Components
1. `EnterpriseDataTable<T>`: Accessible grid with server-side pagination, multi-column sorting, column filtering, and keyboard navigation (`Up/Down/Enter`).
2. `TaxExplainerDrawer`: Slide-over drawer rendering backend-provided rule provenance, Banker's Half-Up rounding, and mandatory statutory legal disclaimer.
3. `PeriodControlBar`: Global header widget rendering `OPEN ➔ UNDER REVIEW ➔ APPROVED ➔ FILED ➔ LOCKED` with transition buttons and amendment protocol triggers.
4. `StatusWorkflowBadge`: Consistent pill component representing workflow states with semantic dot indicators and accessible labels.
5. `AuditHistoryDrawer`: Expandable panel displaying who, what, when, why, previous value, new value, rule version, engine version, and correlation ID.

---

## 5. API Client & Consumption Architecture

All views interact through the centralized singleton client: `/services/api/enterpriseApiClient.ts`.

```
┌────────────────────────────────────────────────────────┐
│               REACT / NEXT.JS UI LAYER                 │
│   (Control Tower, Invoices, Exception Center, etc.)    │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│           ENTERPRISE API CLIENT LAYER                  │
│       (/services/api/enterpriseApiClient.ts)           │
│  • Auto-injects Entity Context Headers                 │
│  • Generates Unique Correlation IDs                    │
│  • Enforces Period Locked Rejections (HTTP 423)        │
│  • Standardizes Error Payloads & Auto-Retries          │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│             NESTJS MODULAR MONOLITH BACKEND            │
│  • Tenant & Role Validation via PostgreSQL RLS         │
│  • Deterministic Rule Engine Execution                 │
│  • Append-Only Compliance Subledger Posting            │
└────────────────────────────────────────────────────────┘
```

---

## 6. Frontend Verification & Test Plan

### 6.1 Critical-Path Playwright E2E Journeys
1. **Journey 1: Outward Supply End-to-End**
   `Sales Invoice Draft` ➔ `Backend Tax Compute` ➔ `Approval Threshold Gate` ➔ `Subledger Posting` ➔ `IRN Generation` ➔ `E-Way Bill Slip`.
2. **Journey 2: Inward Reconciliation & ITC Claim**
   `Purchase Ingestion` ➔ `GSTR-2B Sync` ➔ `Multi-Evidence Match` ➔ `Section 17(5) Evaluation` ➔ `Credit Ledger Allocation`.
3. **Journey 3: Global Period Lock Enforcement**
   `Period Transition: APPROVED ➔ FILED ➔ LOCKED` ➔ `Attempt Invoice Create on LOCKED Period` ➔ `Verify UI blocks mutation and shows 423 Locked / Amendment Protocol`.
4. **Journey 4: Enterprise Exception Lifecycle**
   `Rate Discrepancy Triggered` ➔ `Appears in Central Exception Center` ➔ `Assigned to Owner` ➔ `Vendor Query Dispatched` ➔ `Resolved & Audit Logged`.
5. **Journey 5: Role-Based Access Enforcement**
   `Accountant Role Login` ➔ `Attempt to File GSTR-3B` ➔ `Verify Permission Denied Shield`.

### 6.2 Accessibility & Compliance Audit
- Full WCAG 2.1 AA contrast compliance across all financial numerals and status chips.
- Keyboard-accessible data tables with ARIA row selection and screen-reader announcements.
- Responsive bento-grid layouts tested from 375px mobile viewport to 2560px ultra-wide monitors.

---

## 7. Architecture Freeze Sign-Off Checklist

- [x] Database Schema & Prisma models verified for multi-tenancy and RLS.
- [x] Zero client-side statutory tax logic: All calculations backend-driven.
- [x] Tax Explainer consumes backend explanation contract with mandatory legal disclaimer.
- [x] Global Entity Context (`Group ➔ Company ➔ GSTIN ➔ Branch`) validated on every request.
- [x] Financial Period Controller implemented as a strict 5-stage state machine with mutation blocking.
- [x] Enterprise Exception Center centralizes all 10 operational and statutory domains.
- [x] Reconciliation framework is extensible across PR, GSTR-2B, E-Way Bill, ERP, Bank, and ICEGATE.
- [x] All 29 screens specified with route paths, primary personas, and functional boundaries.
- [x] Reusable Design System components defined.
- [x] Structured API Client implemented with correlation IDs and period-locked error handling.
