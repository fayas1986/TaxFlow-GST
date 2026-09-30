# Sync & Retry Architecture

## 1. Executive Summary & Design Principles

The Sync & Retry Architecture (`SyncEngineService`) governs background ERP synchronization, idempotency enforcement, error recovery, partial-success handling, and distributed BullMQ worker jobs.

### Key Principles
* **Strong Idempotency**: composite key `(tenantId, integrationId, externalDocumentId, documentType)` and payload SHA-256 hash check prevents duplicate invoice creation.
* **Partial-Success Error Isolation**: Individual document validation or domain errors are caught and logged (`IntegrationErrorLog`), while valid invoices in the same batch complete successfully.
* **Asynchronous Queue Processing**: Bulk imports and ERP sync runs are executed asynchronously via BullMQ background workers with full tenant context propagation.
* **Auditability & Observability**: Every sync run creates an auditable record (`SyncRunLog`) tracking records received, created, updated, skipped, and failed.

---

## 2. Sync Run Lifecycle

```text
[ Trigger Sync ] ──► Create SyncRunLog (Status: PENDING)
                            │
                            ▼
                     [ RUNNING ]
                            │
              ┌─────────────┴─────────────┐
              │ Iterative Record Sync     │
              └─────────────┬─────────────┘
                            │
       ┌────────────────────┼────────────────────┐
       ▼                    ▼                    ▼
[ COMPLETED ]      [ PARTIAL_SUCCESS ]      [ FAILED ]
(All Succeeded)     (Some Failed, Some      (Total Sync Failure)
                     Succeeded)
```

---

## 3. Idempotency & Duplicate Resolution

```text
Inbound ERP Transaction
         │
         ▼  Query ImportedTransactionRecord
Existing Record Found?
         │
         ├── NO  ──► Create ImportedTransactionRecord & Process Invoice
         │
         └── YES ──► Check Source Payload SHA-256 Hash
                       │
                       ├── Same Hash ──────► Skip (Idempotent Duplicate)
                       │
                       └── Different Hash ─► Evaluate Invoice Statutory Lock State
```

---

## 4. Partial-Success & Failure Recovery

In a bulk sync run of 50,000 documents:
- Documents that pass mapping and validation are imported (`recordsCreated` / `recordsUpdated`).
- Documents with invalid GSTINs, negative amounts, or statutory lock conflicts record individual `IntegrationErrorLog` entries (`recordsFailed`).
- The sync run completes with status `PARTIAL_SUCCESS`.
- Admins can correct mapping/validation issues and trigger incremental syncs without re-importing already processed documents.
