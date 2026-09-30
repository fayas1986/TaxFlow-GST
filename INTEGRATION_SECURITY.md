# Integration Security Architecture

## 1. Executive Summary & Design Principles

The TaxFlow Integration Security Architecture enforces strict multi-tenant isolation, AES-256-GCM credential encryption at rest, HMAC webhook signature validation, replay protection, and statutory lock security.

### Key Principles
* **Zero Plaintext Credential Exposure**: ERP API keys, client secrets, and OAuth refresh tokens are encrypted at rest using AES-256-GCM with random IVs and authentication tags.
* **Strict Tenant Isolation**: `tenantId` is validated on every integration execution. Webhook payloads cannot override authenticated tenant context.
* **Statutory Lock Security**: External ERP systems cannot overwrite statutory-locked invoices (IRN generated), filed tax periods, or approved returns.
* **Inbound Webhook Security**: Webhooks require HMAC-SHA256 signature verification and a 300-second timestamp freshness window for replay protection.

---

## 2. AES-256-GCM Credential Encryption

ERP credentials and endpoint URLs are stored in encrypted format (`encryptedCredentials` and `encryptedApiEndpoint`) in PostgreSQL:

```text
Plaintext Secret (e.g. OAuth Refresh Token)
     │
     ▼  CryptoService.encrypt()
AES-256-GCM (Ciphertext + 12-byte IV + 16-byte Auth Tag)
     │
     ▼
PostgreSQL (Format: "iv_hex:tag_hex:ciphertext_hex")
```

- Credentials are decrypted strictly in volatile worker memory during active sync runs.
- Decrypted credentials are never logged (`***REDACTED***`) or returned to frontend API endpoints.

---

## 3. Webhook Security & Replay Protection

### 1. HMAC-SHA256 Signature Verification
Every inbound webhook must include a signature header:
$$\text{Signature} = \text{HMAC-SHA256}(\text{webhookSecret}, \text{timestamp} + "." + \text{rawBody})$$

### 2. Timestamp Replay Window (300 Seconds)
Inbound webhook requests with timestamps older than 300 seconds (or in the future) are rejected with HTTP 401 `UnauthorizedException`.

---

## 4. Statutory Lock Protection

External ERP systems provide source financial data, but **TaxFlow remains authoritative for GST statutory state**.

```text
ERP Ingestion Request
        │
        ▼  SyncEngineService
 Check Target Invoice State
        │
        ├─► DRAFT ─────────────────► Update Allowed
        ├─► POSTED ────────────────► Requires Controlled Reversal
        └─► IRN GENERATED / ───────► REJECTED (ForbiddenException)
            TAX PERIOD LOCKED        Recorded ERR_STATUTORY_LOCK_VIOLATION
```
