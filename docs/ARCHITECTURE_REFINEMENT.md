# TaxFlow Enterprise Architecture Refinement Specification
**Document Version:** 2.0.0-PROD-FREEZE  
**Status:** DRAFT FOR ARCHITECTURE REVIEW & FREEZE  
**Target Platform:** Next.js (Frontend) + NestJS (Backend API Runtime) + Neon PostgreSQL + Prisma ORM + Managed Queue/Object Storage  

---

## Executive Summary & Guiding Principles

This specification formalizes the **Architecture Refinement Phase** for TaxFlow, migrating the platform from an expressive prototype into an enterprise-grade, legally authoritative, multi-tenant Indian GST compliance engine.

### Core Non-Negotiable Tenets:
1. **Authoritative Tax Ledger Single Source of Truth**: Neither GSTR-1, GSTR-3B, nor reporting modules recalculate taxes. Every tax event flows through the deterministic Tax Engine into the append-only Tax Ledger.
2. **Deterministic, Version-Controlled Regulatory Rule Engine**: No hardcoded tax slabs or statutory exemptions. Rules have strict temporal validity (`effective_from` to `effective_to`), rule IDs, amendment citations, and automated golden regression suites.
3. **Multi-Tenant Server-Enforced Isolation**: Zero trust in browser-supplied `tenant_id`. Every request derives tenant context from authenticated JWT sessions and validates branch/GSTIN rights, backed by PostgreSQL Row-Level Security (RLS).
4. **Resilient Adapter-Based Integrations**: NIC, IRP, GSP, E-Way Bill, and ERPs (SAP, Tally, Zoho, Xero) interact exclusively via typed provider interfaces with correlation IDs, exponential backoff retries, idempotent mutations, and request/response audit trails.
5. **Decoupled Asynchronous Processing**: Long-running workflows (GSTR-2B ingestion, bulk CSV parsing, 3-way invoice matching, return generation) execute on managed background queues (BullMQ / Cloud Tasks).
6. **Strict AI Governance Guardrails**: AI acts as a decision-support advisory system (explaining variances, finding anomalies, drafting classifications). AI is strictly prohibited from altering ledger values, determining tax rates, claiming ITC, or declaring compliance status.

---

## 1. Repository Audit: KEEP / REFACTOR / REPLACE / REMOVE Matrix

### Assessment Taxonomy
- **KEEP**: Robust UI presentation, layout systems, visualization logic, client state management, or static templates that cleanly port to Next.js without backend entanglement.
- **REFACTOR**: Code with valuable business logic (e.g., matching algorithms, validation regexes, UI modals) that must be decoupled from client-side execution and moved to backend NestJS services or typed shared libraries.
- **REPLACE**: Monolithic prototype modules (e.g., Express monolith `server.ts`, mock in-memory localStorage databases, client-side cryptographic hashing) that must be replaced by PostgreSQL schemas, Prisma models, Redis queues, and server-side KMS.
- **REMOVE**: Ad-hoc development patch scripts (`fix_*.cjs`, `patch_*.cjs`, temporary test files) and deprecated prototype stubs.

| Area / Path | Current File / Module | Classification | Assessment & Rationale | Target Destination |
| :--- | :--- | :---: | :--- | :--- |
| **Server & API** | `server.ts` | **REPLACE** | 4,800+ line prototype Express monolith with mixed mock DB, sync handlers, and route definitions. | Decompose into NestJS Modules (`@taxflow/api`) with Prisma & NestJS Controllers |
| **Server Scripts** | `patch_*.cjs`, `fix_*.cjs`, `test_xlsx.js` | **REMOVE** | Temporary build and patching scripts used during rapid prototype generation. | Purge in migration cleanup; replace with Jest/Vitest CI suite |
| **Tax Engine** | `services/gstEngine/taxCalculator.ts` | **REFACTOR** | Rich GST tax calculation rules exist, but run client-side. | Move to isolated, pure `@taxflow/tax-engine` with validation pipelines |
| **Rule Engine** | `services/gstEngine/ruleEngine.ts` | **REFACTOR** | Contains statutory validations; needs schema-driven versioning and temporal validity tables. | Move to `@taxflow/regulatory-engine` backed by PostgreSQL `regulatory_rules` |
| **Reconciliation**| `services/gstEngine/reconciliationEngine.ts` & `gstr2bMatchingService.ts` | **REFACTOR** | Sophisticated 2B matching logic (exact, fuzzy, tolerance, PAN-level) is sound. | Move to backend queue worker (`@taxflow/jobs/reconciliation.worker.ts`) |
| **ITC Engine** | `services/gstEngine/itcTaggingService.ts` | **REFACTOR** | Rule 37/37A, 42/43, and 17(5) logic is well-structured. | Move to `@taxflow/tax-engine/itc` executed on purchase invoice post |
| **Returns Engine**| `services/gstEngine/filingEngine.ts` | **REFACTOR** | Table mapping for GSTR-1, 3B, 9. Must aggregate from Tax Ledger rather than raw invoice loops. | Migrate to `@taxflow/returns-service` querying Ledger views |
| **Audit Log** | `services/cbicValidationService.ts` | **REFACTOR** | SHA-256 and checksum logic. | Port to server-side immutable audit ledger with HMAC/KMS digital signatures |
| **Auth & Tenant** | `services/gstAuthService.ts` & `store/store.ts` | **REPLACE** | Client-managed tenant switching and simulated authentication. | Replace with NextAuth / Supabase Auth / Clerk + NestJS Passport JWT Guard & RLS |
| **Local Storage** | `utils/localDb.ts` | **REPLACE** | Prototype in-memory / localStorage fallback persistence. | Replace with PostgreSQL / Neon connection pool via Prisma |
| **Ledger Export** | `utils/automatedLedgerExport.ts` | **REFACTOR** | Rich multi-head Excel/CSV formatting and JSON schema. | Move generation to background worker; keep file download streaming |
| **PDF Engine** | `utils/pdfGenerator.ts`, `pdfReportGenerator.ts` | **REFACTOR** | Client jsPDF engine causes browser freeze on large datasets. | Move to headless server-side generation (Puppeteer / @react-pdf) in queue worker |
| **QR & IRN** | `utils/eInvoiceQrUtils.ts` | **KEEP** | Standard CBIC B2B QR code encoding, JWT payload extraction, and verification. | Shared utility library `@taxflow/common` |
| **UI Components** | `components/ComplianceArchiveTimelineView.tsx` | **KEEP** | Comprehensive statutory preservation timeline, filters, and inspector modals. | Migrate cleanly to Next.js App Router Page/Component |
| **UI Components** | `components/ElectronicLedgerViewer.tsx` | **KEEP** | High fidelity Cash, Credit, and Liability ledger dashboard. | Retain as primary Ledger View, consuming `/api/v1/ledger` |
| **UI Components** | `components/AutomatedLedgerExportModule.tsx` | **KEEP** | Intuitive backup policy manager and history log. | Retain in Settings / Compliance UI |
| **UI Components** | `components/Layout.tsx`, `components/Navigation` | **REFACTOR** | Dense desktop layout; needs conversion to Next.js layout structure with responsive navigation. | `apps/web/src/app/(dashboard)/layout.tsx` |
| **Master Data** | `services/partyMasterService.ts` | **REFACTOR** | Client validation for PAN/GSTIN/Bank; needs server CRUD and deduplication. | `@taxflow/party-master` NestJS service + Prisma model |
| **Integrations** | QuickBooks/Xero/Tally patch code | **REPLACE** | Ad-hoc webhook and sync endpoints scattered in `server.ts`. | Implement structured NestJS `ERPIntegrationModule` with Provider Adapters |

---

## 2. Target Architecture Specification

```
                          [ BROWSER / CLIENT ]
                    Next.js 15 (React 19) on Vercel
           Edge Middleware (Session, Tenant Routing, Subdomain)
                                   │
                                   ▼ HTTPS / TLS 1.3 (Bearer JWT + Tenant Context)
           ┌───────────────────────────────────────────────────────┐
           │            API GATEWAY & SECURITY LAYER               │
           │  • Rate Limiting (Upstash Redis)                      │
           │  • Tenant Extraction Guard (No client-trusted tenant) │
           │  • RBAC & Permission Matrix Evaluation                │
           │  • Correlation ID Injection (x-correlation-id)        │
           └───────────────────────┬───────────────────────────────┘
                                   │
                                   ▼
        ┌─────────────────────────────────────────────────────────────┐
        │                 NestJS ENTERPRISE CORE                      │
        │                                                             │
        │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
        │  │ Auth & Tenant│  │ Party Master │  │ Regulatory Engine │  │
        │  │ Context Guard│  │ & Branch Dir │  │ (Versioned Rules) │  │
        │  └──────┬───────┘  └──────┬───────┘  └─────────┬─────────┘  │
        │         │                 │                    │            │
        │         ▼                 ▼                    ▼            │
        │  ┌───────────────────────────────────────────────────────┐  │
        │  │               DETERMINISTIC TAX ENGINE                │  │
        │  │  Validate ➔ POS ➔ Rule Resolve ➔ Rate ➔ Cess ➔ RCM   │  │
        │  └───────────────────────┬───────────────────────────────┘  │
        │                          │                                  │
        │                          ▼                                  │
        │  ┌───────────────────────────────────────────────────────┐  │
        │  │              AUTHORITATIVE TAX LEDGER                 │  │
        │  │ Cash Ledger │ Credit (ITC) Ledger │ Liability Register│  │
        │  └──────┬────────────────────┬───────────────────┬───────┘  │
        │         │                    │                   │          │
        │         ▼                    ▼                   ▼          │
        │  ┌──────────────┐    ┌──────────────┐    ┌───────────────┐  │
        │  │ Returns (3B) │    │Reconciliation│    │ Statutory     │  │
        │  │ & GSTR-1 Agg │    │  (2B vs PR)  │    │ Audit Trail   │  │
        │  └──────────────┘    └──────────────┘    └───────────────┘  │
        └──────────────────────────────┬──────────────────────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
  ┌───────────────────────────┐                 ┌───────────────────────────┐
  │   PostgreSQL / Neon RLS   │                 │   ASYNC TASK BROKER       │
  │ • Tenant Schema Isolation │                 │ • Managed BullMQ / QStash │
  │ • Prisma Connection Pool  │                 │ • GSTR-2B Ingest Worker   │
  │ • Immutable Audit Logs    │                 │ • 3-Way Auto-Recon Worker │
  │ • Temporal Rule Storage   │                 │ • PDF / Excel Generator   │
  └───────────────────────────┘                 └─────────────┬─────────────┘
                                                              │
                                                              ▼
                                                ┌───────────────────────────┐
                                                │   INTEGRATION ADAPTERS    │
                                                │ • IRP / NIC E-Invoice     │
                                                │ • E-Way Bill Portal       │
                                                │ • GSTN GSP Connector      │
                                                │ • ERP Adapters (SAP/Zoho) │
                                                └───────────────────────────┘
```

---

## 3. Bounded Context Definitions (19 Enterprise Domains)

To eliminate monolithic coupling, the system is segmented into 19 strictly bounded contexts. Each context owns its contracts, domain entities, and events.

```
+----------------------------------------------------------------------------------------------------+
|                                    TAXFLOW BOUNDED CONTEXT MAP                                     |
+----------------------------------------------------------------------------------------------------+

 [CORE IDENTITY & ACCESS]
   ├── 1. Identity & Authentication Context   (Credentials, MFA, Session tokens, GSP credentials)
   ├── 2. Tenant Management Context           (Subscriptions, Multi-Org entities, Branches, Tax IDs)
   └── 3. RBAC & Access Control Context       (Role definitions, Permissions, Branch-level scopes)

 [MASTER DATA & STATUTORY REPOSITORY]
   ├── 4. GST Registration & Branch Context   (State codes, GSTIN status, Authorized signatories)
   ├── 5. GST Masters Context                 (HSN/SAC directory, UOM standards, Party Master KYC)
   └── 6. Regulatory Rules Context            (Versioned tax slabs, Exemption rules, Circular citations)

 [TRANSACTION & TAX CORE]
   ├── 7. Deterministic Tax Engine Context    (Pure calculations: Rate, IGST/CGST/SGST, Cess, RCM)
   ├── 8. POS (Place of Supply) Engine        (Section 10/12 IGST Act determination matrix)
   ├── 9. Sales & Invoicing Context           (B2B, B2C, SEZ, Exports, CDN, Credit/Debit notes)
   ├── 10. Purchase Register Context          (Vendor bills, Inward supplies, Expense categorization)
   ├── 11. ITC (Input Tax Credit) Context     (Eligibility rules, 17(5) blocking, 42/43 reversal)
   └── 12. RCM (Reverse Charge) Context       (Section 9(3)/9(4) notifications, Self-invoicing)

 [SETTLEMENT & COMPLIANCE]
   ├── 13. Tax Ledger Context [AUTHORITATIVE] (Cash, Credit, Liability, Offsets, Frozen snapshots)
   ├── 14. Reconciliation Engine Context      (2B vs PR 3-way matching, Variance categorization)
   └── 15. Statutory Returns Context          (GSTR-1, GSTR-3B, GSTR-9, CMP-08 payload compilation)

 [PERIPHERAL PLATFORM & INFRASTRUCTURE]
   ├── 16. IRP & E-Invoice Integration        (NIC payload formatting, IRN generation, QR signing)
   ├── 17. E-Way Bill Integration            (Part-A/Part-B dispatch, Vehicle tracking, Transporter)
   ├── 18. ERP & Accounting Gateway           (Adapters for SAP, Oracle, Tally, Zoho, QuickBooks)
   ├── 19. Audit, Notification & Reporting   (Tamper-evident trail, Alerts, WhatsApp/Email dispatches)
+----------------------------------------------------------------------------------------------------+
```

---

## 4. Deterministic Tax Engine Architecture

The tax calculation pipeline is completely decoupled from any UI component or HTTP controller. The Tax Engine is a pure, idempotent function:
`calculateTax(input: TaxCalculationInput): TaxCalculationResult`

### Pipeline Flowchart
```
  [ Invoice Line Items + Supply Context ]
                     │
                     ▼
  ┌─────────────────────────────────────┐
  │ 1. VALIDATION & SANITIZATION        │  • Check valid GSTIN formats, HSN lengths (4/6/8), non-negative amounts
  └──────────────────┬──────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────┐
  │ 2. TAXABILITY DETERMINATION         │  • Taxable, Exempted, Nil-Rated, Non-GST, Zero-Rated (SEZ/Export)
  └──────────────────┬──────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────┐
  │ 3. PLACE OF SUPPLY (POS) RESOLUTION │  • Sections 10, 11, 12, 13 IGST Act
  │                                     │  • Supplier State vs POS State ➔ Intra-State vs Inter-State
  └──────────────────┬──────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────┐
  │ 4. STATUTORY RULE RESOLUTION        │  • Match active rule ID & version effective on `transactionDate`
  │                                     │  • Check conditional thresholds and turnover exclusions
  └──────────────────┬──────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────┐
  │ 5. TAX HEAD & RATE RESOLUTION       │  • If Intra-State: CGST Rate + SGST/UTGST Rate
  │                                     │  • If Inter-State: IGST Rate
  └──────────────────┬──────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────┐
  │ 6. CESS & SPECIAL DUTIES            │  • Ad-valorem Cess + Specific Cess (Quantity/Volumetric)
  └──────────────────┬──────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────┐
  │ 7. RCM APPLICABILITY CHECK          │  • Section 9(3) specified goods/services
  │                                     │  • Flag recipient liability & auto-generate payment obligations
  └──────────────────┬──────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────┐
  │ 8. MATHEMATICAL PRECISION & ROUNDING│  • High-precision Decimal (Banker's rounding / Half-Up)
  │                                     │  • Line-level rounding + Invoice-level Section 170 CGST rounding
  └──────────────────┬──────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────┐
  │ 9. TAX CALCULATION RESULT           │  • Immutable Result Object with Rule ID, Version, and Head breakdowns
  └──────────────────┬──────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────┐
  │ 10. DIRECT POSTING TO TAX LEDGER    │  • Ledger Journal Entries (Cash, ITC, Output Liability)
  └─────────────────────────────────────┘
```

---

## 5. Regulatory Rule Engine: Schema & Historical Reproducibility

Statutory rules change constantly via CBIC notifications. TaxFlow stores rules as temporal immutable records. When recalculating or auditing an invoice from 2024, the engine queries rules active on `2024-xx-xx`, guaranteeing 100% historical accuracy.

### Prisma Schema Definition (`regulatory_rules`)
```prisma
model RegulatoryRule {
  id                  String       @id @default(uuid())
  ruleCode            String       // e.g., "RULE-17-5-MOTOR-VEHICLES", "RATE-HSN-8471"
  version             Int          @default(1)
  description         String
  effectiveFrom       DateTime
  effectiveTo         DateTime?    // NULL indicates currently active
  notificationNumber  String       // e.g., "Notification No. 14/2024-Central Tax"
  notificationDate    DateTime
  hsnPrefix           String?      // e.g., "8471"
  supplyType          SupplyType   // GOODS, SERVICES, BOTH
  rateSchedule        Json         // { igst: 18.0, cgst: 9.0, sgst: 9.0, cessAdValorem: 0 }
  conditions          Json         // Structured condition AST
  exceptions          Json?        // Override exceptions
  status              RuleStatus   // DRAFT, APPROVED, ACTIVE, SUPERSEDED
  approvedBy          String
  approvedAt          DateTime
  testSuiteCases      Json         // Golden test vector fixtures
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt

  @@unique([ruleCode, version])
  @@index([hsnPrefix, effectiveFrom, effectiveTo])
}
```

---

## 6. Authoritative Tax Ledger Architecture

The Tax Ledger acts as the immutable double-entry subledger for all indirect tax events. **GSTR-1, GSTR-3B, and GSTR-9 do not recalculate tax**. They query aggregate projections of this ledger.

```
       [ Outward Invoice ]                [ Inward Bill (Purchase) ]           [ PMT-06 Challan ]
                │                                     │                                │
                ▼                                     ▼                                ▼
       [ Tax Engine Result ]                 [ Tax Engine Result ]            [ Bank Debit Advice ]
                │                                     │                                │
                └─────────────────────────┬───────────┴────────────────────────────────┘
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
                      │    CENTRAL TAX LEDGER JOURNAL POST    │
                      │  (Double-entry, append-only entries)  │
                      └───────────────────┬───────────────────┘
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        ▼                                 ▼                                 ▼
┌──────────────────┐            ┌──────────────────┐            ┌──────────────────┐
│ ELECTRONIC CASH  │            │ELECTRONIC CREDIT │            │   ELECTRONIC     │
│     LEDGER       │            │  (ITC) LEDGER    │            │LIABILITY REGISTER│
│  (PMT-05 / R87)  │            │ (PMT-02 / R86)   │            │  (PMT-01 / R85)  │
│                  │            │                  │            │                  │
│ • Major Heads    │            │ • Table 4(A) ITC │            │ • Outward Tax    │
│ • Minor Heads    │            │ • Rule 42/43 Rev │            │ • RCM Liability  │
│ • Challan CIN    │            │ • Sec 17(5) Blk  │            │ • Late Fee / Int │
└────────┬─────────┘            └────────┬─────────┘            └────────┬─────────┘
         │                               │                               │
         └───────────────────────────────┼───────────────────────────────┘
                                         ▼
                      ┌───────────────────────────────────────┐
                      │  OFFSET & SET-OFF ENGINE (RULE 88A)   │
                      │  1. IGST Credit ➔ IGST, CGST, SGST   │
                      │  2. CGST Credit ➔ CGST, IGST         │
                      │  3. SGST Credit ➔ SGST, IGST         │
                      │  4. Remaining ➔ Cash Ledger Balance  │
                      └───────────────────┬───────────────────┘
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
                      │    CONSUMED BY DOWNSTREAM SERVICES    │
                      │ • GSTR-3B Table 6.1 (Payment of Tax)  │
                      │ • Automated Ledger Export (.xlsx/.csv)│
                      │ • Statutory 72-Month Retention Archive│
                      │ • Auditor Drilldown Inspection Vault  │
                      └───────────────────────────────────────┘
```

---

## 7. Multi-Tenant Server-Side Isolation Architecture

### Threat Model
Browser-supplied `tenant_id` query params or JSON payloads are vulnerable to manipulation. An attacker could alter parameters to view another company's records.

### Security Pipeline
```
[ Incoming HTTP Request with JWT Authorization: Bearer <Token> ]
                             │
                             ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 1. JWT Authentication Guard                                 │
 │    • Verify cryptographic signature against JWKS (RS256)    │
 │    • Extract `sub` (User ID), `membership_ids`, `org_id`    │
 └───────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 2. Server-Side Tenant Context Middleware                    │
 │    • Resolve Active Tenant from validated DB Session        │
 │    • Check user-to-tenant active membership status         │
 │    • Inject `TenantContext { tenantId, gstinScope, roles }` │
 └───────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 3. Branch / GSTIN-Level Authorization Interceptor           │
 │    • Check if user has permission for the specific GSTIN    │
 │    • Apply branch-level filters for multi-locational users  │
 └───────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 4. Prisma Client Extension / PostgreSQL RLS Session         │
 │    • Execute: `SET LOCAL app.current_tenant_id = 'tenant_1'`│
 │    • PostgreSQL enforces RLS across all tables:             │
 │      `WHERE tenant_id = CURRENT_SETTING('app.current_tenant')│
 └─────────────────────────────────────────────────────────────┘
```

---

## 8. Integration Architecture & Provider Adapter Pattern

All third-party services connect via typed Interfaces. Switching from NIC directly to Cygnet GSP or Cleartax requires zero domain logic modifications.

### Architecture Contract
```typescript
// Core Provider Interfaces
export interface IRPProvider {
  generateIRN(payload: EInvoicePayload, context: ProviderContext): Promise<IRNResponse>;
  cancelIRN(payload: CancelIRNPayload, context: ProviderContext): Promise<CancelIRNResponse>;
  getIRNDetails(irn: string, context: ProviderContext): Promise<IRNDetailsResponse>;
}

export interface EwayBillProvider {
  generateEwayBill(payload: EwayBillPayload, context: ProviderContext): Promise<EwayBillResponse>;
  updateVehicle(payload: VehicleUpdatePayload, context: ProviderContext): Promise<VehicleUpdateResponse>;
  cancelEwayBill(payload: CancelEwbPayload, context: ProviderContext): Promise<CancelEwbResponse>;
}

export interface GSPProvider {
  authenticateGSTN(gstin: string, otp: string, context: ProviderContext): Promise<AuthTokenResponse>;
  fetchGSTR2B(gstin: string, returnPeriod: string, context: ProviderContext): Promise<GSTR2BPayload>;
  submitGSTR1(payload: GSTR1SubmitPayload, context: ProviderContext): Promise<GSTR1SubmitResponse>;
  fileGSTR3B(payload: GSTR3BFilePayload, context: ProviderContext): Promise<GSTR3BFileResponse>;
}

export interface ERPProvider {
  syncInwardInvoices(since: Date, context: ProviderContext): Promise<InwardInvoice[]>;
  postTaxJournal(journalEntry: TaxJournalEntry, context: ProviderContext): Promise<ERPPostResponse>;
}
```

### Mandatory Execution Wrapper
Every provider call executes inside the **Resilience & Audit Wrapper**:
- **Correlation ID**: Generates UUIDv4 tracing ID across requests.
- **Idempotency Key**: Uses SHA-256 of canonical payload to prevent duplicate filings.
- **Exponential Backoff**: 3 retries (1s, 2s, 4s) with jitter on network timeouts.
- **Circuit Breaker**: Trips to fail-open/fallback after 5 consecutive 5xx errors.
- **Request/Response Audit**: Encrypted storage of raw request/response payloads in `integration_audit_logs`.

---

## 9. Asynchronous Processing & Managed Background Jobs

Long-running operations must never execute synchronously within web request lifecycles.

```
┌──────────────────────────────────────┬────────────────────────────────────────────────────────┐
│ Long-Running Operation               │ Execution Model & Queue Strategy                       │
├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ GSTR-2B Bulk JSON Ingestion (100k+)  │ Chunked streaming upload ➔ BullMQ `gstr-ingest-queue`  │
│ 3-Way ITC Reconciliation Run         │ Distributed batch worker ➔ Redis stream partition      │
│ Bulk Invoice CSV/Excel Import        │ Worker parses & validates in 1,000-record chunks       │
│ PDF / E-Invoice Bulk QR Rendering    │ Headless worker with S3 presigned URL delivery         │
│ Statutory Return (GSTR-1) Payload Gen│ Background ledger compilation with progress webhooks   │
│ ERP Two-Way Synchronization          │ Scheduled cron worker with rate-limited paging         │
│ Automated Monthly Ledger Snapshots   │ Cron job (1st of month 00:05 UTC) with integrity seal  │
└──────────────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 10. Security Architecture & Threat Defense

1. **Authentication**: JWT with RS256 signing, 15-minute access token lifespan, rotating refresh tokens stored in HTTP-only, SameSite=Strict cookies.
2. **Secret Management**: Zero plaintext credentials. GSTN auth tokens, NIC client passwords, and ERP API secrets stored in AWS Secrets Manager / GCP Secret Manager, encrypted at rest with envelope encryption (AES-256-GCM).
3. **Branch-Level RBAC**: Roles (`SUPER_ADMIN`, `TAX_ADMIN`, `ACCOUNTANT`, `AUDITOR`, `VIEWER`) constrained by GSTIN/branch matrices.
4. **VAPT & Hardening**:
   - Helmet security headers (CSP, HSTS 2-year, X-Frame-Options DENY).
   - SQL Injection immunity via Prisma parameterized queries.
   - Global rate limiter (100 requests/minute per tenant IP).
   - Audit trail capturing source IP, user agent, and payload checksums.

---

## 11. Comprehensive Audit Architecture

Every financial, tax, or configuration change writes an immutable audit record:

```prisma
model AuditLog {
  id              String       @id @default(uuid())
  tenantId        String
  userId          String
  actorEmail      String
  actionType      AuditAction  // INVOICE_CREATE, TAX_OVERRIDE, 2B_ACCEPT, RETURN_SUBMIT
  entityType      String       // Invoice, TaxLedgerEntry, Vendor, Rule
  entityId        String
  previousState   Json?        // Full snapshot before mutation
  newState        Json         // Full snapshot after mutation
  reason          String?      // Mandatory for tax overrides
  ruleId          String?      // Applicable regulatory rule ID
  ruleVersion     Int?         // Applicable regulatory rule version
  engineVersion   String       // Semantic version of calculation engine
  ipAddress       String
  userAgent       String
  correlationId   String
  integrityHash   String       // SHA-256 (prevHash + currentRecord)
  createdAt       DateTime     @default(now())

  @@index([tenantId, entityType, entityId])
  @@index([tenantId, createdAt])
}
```

---

## 12. AI Governance & Decision Guardrails

To maintain strict statutory compliance and prevent hallucination-induced tax liabilities, clear operational boundaries are established:

```
┌───────────────────────────────────────────────────────────────┐
│              PERMITTED (AI ADVISORY SCOPE)                    │
├───────────────────────────────────────────────────────────────┤
│  • Suggesting HSN/SAC codes based on item descriptions        │
│  • Explaining variances in GSTR-2B vs Purchase Register       │
│  • Identifying potential duplicate invoice anomalies          │
│  • Natural language querying of the compliance ledger         │
│  • Highlighting upcoming regulatory deadlines & notifications │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│             STRICTLY PROHIBITED (AI BLACKLIST)                │
├───────────────────────────────────────────────────────────────┤
│  ✗ Determining final GST tax rates                            │
│  ✗ Deciding Place of Supply (POS)                             │
│  ✗ Authorizing Input Tax Credit (ITC) eligibility or reversal │
│  ✗ Determining Reverse Charge (RCM) applicability             │
│  ✗ Submitting or filing official returns (GSTR-1, 3B, 9)       │
│  ✗ Mutating authoritative ledger entries                      │
└───────────────────────────────────────────────────────────────┘
```

---

## 13. Environment Architecture

```
[ DEV ENVIRONMENT ]
 • Local / Ephemeral branch previews
 • Neon DB Dev Branch (Sanitized seed data)
 • Mock IRP / GSTN Sandbox endpoints

[ TEST / CI ENVIRONMENT ]
 • Automated GitHub Actions / Vercel Preview
 • Neon DB Ephemeral Test Branch
 • Golden Tax Test Vector Regression Suite (100% pass required)

[ UAT / STAGING ENVIRONMENT ]
 • Mirrors production architecture exactly
 • Dedicated Neon Staging DB
 • Direct connection to GSTN / NIC Sandbox APIs
 • Customer acceptance & auditor verification

[ PRODUCTION ENVIRONMENT ]
 • High-availability Neon Serverless PostgreSQL with auto-scaling
 • Dedicated Vercel Pro / Enterprise edge routing
 • Multi-AZ Redis for queue scheduling
 • Live CBIC / NIC / GSTN Production Gateways
 • Strict RBAC & zero developer direct write access
```

---

## 14. Architecture Decision Records (ADRs)

### ADR-001: Next.js + NestJS Decoupled Full-Stack Architecture
- **Status:** APPROVED
- **Context:** The current prototype combines Express and Vite in a single `server.ts` process. Enterprise compliance requires distinct separation between UI rendering and high-assurance financial calculations.
- **Decision:** Separate the architecture into a Next.js (App Router) frontend deployed to Vercel, paired with a modular NestJS API runtime.
- **Consequence:** Clean separation of concerns, high-velocity frontend development, typed OpenAPI contracts, and testable enterprise services.

### ADR-002: PostgreSQL (Neon) with Row-Level Security (RLS) & Prisma ORM
- **Status:** APPROVED
- **Context:** Tax data requires relational consistency, ACID compliance, and absolute tenant privacy.
- **Decision:** Adopt PostgreSQL on Neon serverless with Prisma ORM. Enforce tenant isolation through both application-level guards and PostgreSQL Row-Level Security policies.
- **Consequence:** Robust double-entry ledger math, schema migrations with version control, and multi-layered data protection.

### ADR-003: Authoritative Subledger Approach for Return Filing
- **Status:** APPROVED
- **Context:** In many accounting systems, GSTR-1 and GSTR-3B calculate tax liabilities independently from invoice tables, creating reconciliation discrepancies.
- **Decision:** Enforce the Tax Ledger as the sole authoritative source of truth. Invoices post immutable debit/credit entries to the Tax Ledger; returns aggregate directly from the ledger.
- **Consequence:** Zero mathematical variance between balance sheets, ledger accounts, and filed returns.

### ADR-004: Managed Background Workers for Batch Compliance
- **Status:** APPROVED
- **Context:** 2B downloads, GSTR-1 filings, and bulk invoice imports exceed Vercel's standard HTTP function timeout limits.
- **Decision:** Shift all operations involving more than 50 records or external portal polling to managed queues (BullMQ / QStash) with client-facing WebSocket / SSE progress updates.
- **Consequence:** Immediate UI responsiveness, zero request timeouts, and resilient retry mechanisms.
