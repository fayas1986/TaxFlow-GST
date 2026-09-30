# Document Management Architecture

## 1. Executive Summary & Design Principles

The TaxFlow Document Management System (`DocumentManagementService`) handles statutory compliance documents, GSTR-2B JSON files, invoice attachments, E-Way Bill PDFs, and return filing acknowledgements. To maintain database performance and security, **large document binaries are never stored directly in PostgreSQL**. Instead, metadata is maintained in PostgreSQL while binaries are stored in **S3-compatible Object Storage**.

### Key Principles
* **Decoupled Architecture**: PostgreSQL manages document metadata (`DocumentMetadata`), while S3 Object Storage holds encrypted binary payloads.
* **Strict Tenant & Scope Security**: Documents are strictly isolated by `tenantId`. Company, GSTIN, and Branch scope controls prevent unauthorized internal access.
* **No Public URLs**: Documents are non-public. Access is granted exclusively via short-lived, HMAC-signed download URLs.
* **Immutability & Version Lineage**: Updating a compliance document creates a new version (`v1` → `v2` → `v3`) while preserving historical versions linked to the parent document.
* **SHA-256 Binary Integrity**: Every document upload computes a SHA-256 checksum stored in metadata. On download, binary content is re-verified against the hash.

---

## 2. Storage Topology

```text
TaxFlow Application Core
       │
       ├─► PostgreSQL Metadata (DocumentMetadata)
       │     ├── ID, Tenant, Company, GSTIN, Branch
       │     ├── File Name, MIME Type, Size, Version
       │     ├── SHA-256 Checksum Hash
       │     └── S3 Object Key Reference
       │
       └─► S3-Compatible Object Storage
             └── tenants/{tenantId}/{docType}/{uuid}_v{version}_{fileName}
```

---

## 3. Security & Access Control

### 1. Cross-Tenant Isolation Guard
Every document query filters strictly on `tenantId`. Attempting to retrieve a document belonging to another tenant returns `ForbiddenException` and logs a `SECURITY_VIOLATION` event in the audit trail.

### 2. Organizational Scope Enforcement
If a document is associated with a specific `companyId`, `gstinId`, or `branchId`, access is restricted to users assigned to those explicit organizational scopes.

### 3. Short-Lived HMAC Signed Download URLs
- Download URLs are generated dynamically with a short time-to-live (default 300 seconds).
- Signed URLs include an HMAC-SHA256 signature calculated from the object key, tenant ID, and expiration timestamp.
- URLs with expired timestamps or tampered signatures are rejected by `StorageAdapter`.

---

## 4. Document Versioning Model

```text
Document (gstr1_export.pdf)
  ├── Version 1 (ID: doc-101, Parent: null) ── Original Upload
  └── Version 2 (ID: doc-102, Parent: doc-101) ── Revised Amendments
```

- When a document is re-uploaded for an existing entity, `version` automatically increments (`version = previousVersion + 1`).
- `parentDocumentId` links new versions back to the original Version 1 root.
- Historical versions remain traceable and downloadable; compliance documents are never silently overwritten.
