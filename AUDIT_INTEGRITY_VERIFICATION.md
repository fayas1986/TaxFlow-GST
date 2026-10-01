# TaxFlow — Audit Trail Integrity & Hash Chain Verification

## 1. Overview & Cryptographic Chaining

The `ImmutableAuditService` maintains a tamper-evident audit trail for statutory compliance and security forensic analysis.

```text
Genesis Hash ("0000...0000")
             │
             ▼
[Event 1: LOGIN] ──────────► SHA-256 (PreviousHash + PayloadHash) = Hash 1
                                       │
                                       ▼
[Event 2: INVOICE_POST] ───► SHA-256 (Hash 1 + PayloadHash) = Hash 2
                                       │
                                       ▼
[Event 3: RETURN_FILE] ───► SHA-256 (Hash 2 + PayloadHash) = Hash 3
```

---

## 2. Immutability & Tamper Detection

1. **Database-Level Immutability**:
   `ImmutableAuditService` enforces append-only semantics. Direct `updateEvent()` or `deleteEvent()` calls throw `ForbiddenException`.
2. **Cryptographic Tamper Verification (`verifyChainIntegrity`)**:
   The verification worker scans the tenant's audit trail in ascending chronological order (`createdAt: 'asc'`), re-calculates the canonical payload hash for each record, and verifies that `currentEventHash` matches `SHA-256(previousEventHash + payloadHash)`.
3. **Detection Evidence**:
   If an attacker modifies record data directly in the database, `verifyChainIntegrity` flags `isValid: false` and identifies the exact tampered record index (`brokenIndices`).
