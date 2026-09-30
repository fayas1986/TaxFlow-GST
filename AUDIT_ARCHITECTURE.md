# Immutable Audit System Architecture

## 1. Executive Summary & Design Principles

The TaxFlow Immutable Audit System (`ImmutableAuditService`) provides an **enterprise-grade, tamper-evident audit trail** for all statutory GST actions, security events, master data mutations, and integration calls. It is designed to meet statutory compliance requirements under Indian GST law and enterprise SOC 2 / ISO 27001 audit controls.

### Key Principles
* **Append-Only Immutability**: Audit records can only be created. `UPDATE` and `DELETE` operations are blocked at the application/service level.
* **Cryptographic Hash Chaining**: Every event includes a SHA-256 hash of its canonical payload (`payloadHash`) and a SHA-256 chain link hash (`currentEventHash = SHA256(previousEventHash + payloadHash)`).
* **Cryptographic Chain Verification**: Built-in verification engine (`verifyChainIntegrity`) scans audit chains to verify 100% cryptographic continuity and detect tampering.
* **Correlation & Distributed Observability**: Every audit event captures a `correlationId` to trace actions across HTTP requests, NestJS services, database transactions, BullMQ queue jobs, and external GSP portals.

---

## 2. Cryptographic Hash Chaining Architecture

```text
Event 0 (Genesis)
   │  previousEventHash = 0000...0000 (64 zeros)
   ├─► payloadHash_0 = SHA256(canonicalPayload_0)
   └─► currentEventHash_0 = SHA256(previousEventHash_0 + payloadHash_0)
         │
         ▼
Event 1
   │  previousEventHash_1 = currentEventHash_0
   ├─► payloadHash_1 = SHA256(canonicalPayload_1)
   └─► currentEventHash_1 = SHA256(previousEventHash_1 + payloadHash_1)
         │
         ▼
Event N
   │  previousEventHash_N = currentEventHash_N-1
   ├─► payloadHash_N = SHA256(canonicalPayload_N)
   └─► currentEventHash_N = SHA256(previousEventHash_N + payloadHash_N)
```

### Canonical Serialized Payload
To ensure deterministic hashing across runtime environments, payloads are serialized into canonical JSON:
```json
{
  "tenantId": "tenant-uuid",
  "actorUserId": "user-uuid",
  "action": "GST_RETURN_FILED",
  "entityType": "GstReturn",
  "entityId": "return-uuid",
  "correlationId": "corr-id-12345",
  "beforeState": null,
  "afterState": { "arn": "AA2709260000123" },
  "result": "SUCCESS",
  "reason": null
}
```

---

## 3. Audit Schema Specifications (`ImmutableAuditLog`)

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary key |
| `tenantId` | UUID | Tenant isolation foreign key |
| `actorUserId` | UUID? | Identity of user performing action |
| `action` | String | Standardized action name (e.g. `INVOICE_POSTED`) |
| `entityType` | String | Target domain entity (e.g. `SalesInvoice`) |
| `entityId` | String? | Target entity ID |
| `correlationId` | String | End-to-end request correlation identifier |
| `ipAddress` | String? | Client IP address where applicable |
| `beforeState` | Json? | State snapshot prior to mutation |
| `afterState` | Json? | State snapshot post mutation |
| `result` | String | `SUCCESS`, `FAILURE`, or `BLOCKED` |
| `reason` | String? | Failure / refusal explanation |
| `payloadHash` | String (64) | SHA-256 hash of canonical payload |
| `previousEventHash` | String (64) | SHA-256 hash of preceding event in tenant chain |
| `currentEventHash` | String (64) | SHA-256 chain link hash |
| `createdAt` | DateTime | Timestamp of event insertion |

---

## 4. Operational Actions Covered

1. **Authentication & Security**: Login, logout, failed login, privilege escalation, bypass attempts.
2. **Master Data & Scope**: Tenant configuration, company, GSTIN, branch additions/modifications.
3. **Invoicing & Ledger**: Creation, posting, cancellation, statutory locking, tax ledger entries.
4. **ITC & Reconciliation**: ITC qualification, Section 17(5) blocking/reversals, reconciliation runs.
5. **GST Returns**: Preparation, approval, filing submission, ARN generation.
6. **E-Invoice & E-Way Bill**: IRN generation, cancellation, Part B vehicle updates.
7. **Credentials & Integration**: GSP credential updates, AES-256-GCM encryption events, API calls.

---

## 5. Chain Integrity Verification Engine

The service includes `verifyChainIntegrity(tenantId)` which:
1. Fetches all tenant audit logs ordered chronologically.
2. Verifies that `previousEventHash` of log `N` equals `currentEventHash` of log `N-1`.
3. Recomputes `payloadHash` and `currentEventHash` for every record.
4. Reports total events scanned, verification status (`isValid: true/false`), and indices of any broken links.
