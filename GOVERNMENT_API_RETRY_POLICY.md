# Government API Retry Policy & Rate Limiting

**TaxFlow GST Compliance SaaS — Stage 7 Architecture Specification**

---

## 1. Transient vs. Permanent Error Classification

TaxFlow distinguishes transient failures (which should be retried automatically with exponential backoff) from permanent compliance/validation errors (which must fail immediately without wasting API quotas or retry attempts).

```text
               ┌───────────────────────────────┐
               │    Government API Error      │
               └───────────────┬───────────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             ▼
     ┌───────────────────┐         ┌───────────────────┐
     │  TRANSIENT ERROR  │         │  PERMANENT ERROR  │
     └──────────┬────────┘         └─────────┬─────────┘
                │                            │
                ▼                            ▼
  - Network Timeout / 504       - Invalid GSTIN (2150)
  - HTTP 500 / 502 / 503        - Duplicate IRN (2151)
  - HTTP 429 Rate Limit         - Validation Fail (1000)
  - GSP Auth Token Expiry       - Invalid Credentials
                │                            │
                ▼                            ▼
      [BullMQ Worker Retry]          [Fail Immediately]
    Exponential Backoff (1s-30s)    Log Permanent Failure
```

---

## 2. Error Matrix

| Code / Exception | Category | Retry Strategy | Action |
| :--- | :--- | :--- | :--- |
| `ETIMEDOUT`, `ECONNRESET` | Transient | Exponential Backoff (3 retries) | Re-query portal by correlation ID before resubmitting |
| `HTTP 500 / 502 / 503` | Transient | Exponential Backoff (3 retries) | Retry job via BullMQ worker queue |
| `HTTP 429 Rate Limit` | Transient | Respect `Retry-After` header | Pause queue for designated rate limit window |
| `AUTH_TOKEN_EXPIRED` | Transient | Auto-refresh token | Request new Auth Token & retry |
| `INVALID_GSTIN_FORMAT` | Permanent | Zero Retries | Fail closed immediately, inform user |
| `INVALID_INVOICE_DATA` | Permanent | Zero Retries | Fail closed, user must edit invoice |
| `IRN_ALREADY_GENERATED` | Permanent | Zero Retries | Fetch existing IRN snapshot & attach to invoice |

---

## 3. Rate Limiting Architecture

- **Token Bucket Rate Limiter**: Rate limits are enforced per tenant and per GSTIN (e.g., maximum 10 requests per second to NIC E-Invoice API).
- **Configurable Limits**: Limits are defined via environment variables (`GOV_API_MAX_RPS=10`, `GOV_API_BURST=20`).
- **Idempotent Network Retries**: Retrying a timed-out request uses the saved idempotency key to prevent creating duplicate IRNs or duplicate E-Way Bills on the government portal.
