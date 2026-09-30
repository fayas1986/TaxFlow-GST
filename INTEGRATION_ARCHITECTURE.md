# Integration Architecture

## 1. Executive Summary & Design Principles

The TaxFlow ERP & External Integration Platform establishes a **decoupled, provider-agnostic integration layer** connecting external ERPs (SAP S/4HANA, Microsoft Dynamics 365, Tally, Oracle, custom ERPs), CSV/Excel bulk imports, and REST API connectors to TaxFlow without polluting the core GST compliance domain with ERP-specific schemas.

### Key Principles
* **Decoupled Ingestion Pipeline**: External payloads flow through strict transformation stages: `External System → Connector/Adapter → Raw Ingestion → Canonical Mapping → Validation → Canonical Transaction Model → Tax Engine → Domain Services`.
* **Authoritative Tax Engine**: TaxFlow's Tax Engine remains authoritative for all GST computations. ERP-calculated tax values are recorded separately for variance tracking and reconciliation.
* **Statutory Lock Protection**: ERP syncs cannot overwrite statutory-locked invoices (IRN generated), filed tax periods, or posted transactions without formal amendment/reversal workflows.
* **Strong Idempotency**: Transactions are uniquely identified by `(tenantId, integrationId, externalDocumentId, documentType)` and payload SHA-256 hashes to prevent duplicate invoice creation.
* **AES-256-GCM Credential Security**: ERP API keys, OAuth refresh tokens, and secrets are encrypted at rest using AES-256-GCM and zeroized from log outputs.

---

## 2. End-to-End Pipeline Architecture

```text
  [ External ERP / CSV / Webhook ]
                 │
                 ▼  ErpIntegrationAdapter (Generic REST / CSV-Excel / Custom)
          [ Raw Ingestion ]
                 │
                 ▼  MappingEngineService (Field Mappings & Value Transformations)
    [ CanonicalTransactionDto ]
                 │
                 ▼  ValidationEngineService (GSTIN, State Code, Amounts)
    [ Validated Canonical DTO ]
                 │
                 ├─► TaxComparisonService ◄─► TaxEngineService (Authoritative GST Computation)
                 │     └── Records taxVariance & isTaxMatched
                 │
                 ▼  SyncEngineService
     ┌───────────┴────────────────────────┐
     │ Idempotency & Statutory Lock Check │
     └───────────┬────────────────────────┘
                 │
                 ▼  Domain Execution
   [ SalesInvoice / PurchaseInvoice / TaxLedger ]
                 │
                 ▼  Audit Log
       [ ImmutableAuditLog ]
```

---

## 3. Supported Adapter Framework

The integration layer defines `ErpIntegrationAdapter`:
1. **Generic REST Adapter (`GenericRestAdapter`)**: Pulls invoices from HTTP REST endpoints using encrypted credentials.
2. **CSV/Excel Import Adapter (`CsvExcelImportAdapter`)**: Parses bulk spreadsheet files into canonical transactions.
3. **Webhook Receiver (`WebhookIngestionService`)**: Receives inbound real-time push webhooks with HMAC-SHA256 signature verification and timestamp replay protection.

---

## 4. Integration Lifecycles & Error Categories

### Synchronization Run Status (`SyncRunLog`)
- `PENDING`: Initialized sync run.
- `RUNNING`: Processing in progress.
- `COMPLETED`: All records processed successfully.
- `PARTIAL_SUCCESS`: Some records succeeded while invalid records failed individually.
- `FAILED`: Total sync failure (e.g. authentication or connectivity error).

### Error Classification (`IntegrationErrorLog`)
- `VALIDATION_ERROR`: Invalid GSTIN, state code, or negative amounts.
- `MAPPING_ERROR`: Missing mandatory mapped fields.
- `AUTHENTICATION_ERROR`: Invalid ERP API keys/tokens.
- `CONNECTIVITY_ERROR`: Network timeout or endpoint unreachability.
- `RATE_LIMIT`: ERP API rate limit exceeded.
- `DUPLICATE`: Repeated record skipped.
- `DOMAIN_ERROR`: Statutory lock or tax period lock violation.
