# TaxFlow — Stage 12 Report Export Architecture

## 1. Export Engine & Background Processing

For large multi-thousand transaction reports, synchronous HTTP downloads can cause timeouts or exhaust server memory. The Export Engine (`ReportExportService`) offloads heavy rendering to background workers using Stage 11's `JobDispatcherService`.

```text
Client Request (POST /api/v1/reports/export)
                    │
                    ▼
          Check Idempotency Key
                    │
       ┌────────────┴────────────┐
       ▼                         ▼
[Idempotent Hit]          [New Request]
Return Download Token     1. Create ReportExportRecord (PENDING)
                          2. Dispatch Background Job (DOCUMENT_PROCESSING)
                          3. Log Immutable Audit (REPORT_EXPORTED)
                          4. Return Secure Download Token
```

---

## 2. Supported Formats

- **`CSV`**: Comma-separated tabular export with RFC 4180 escaping.
- **`EXCEL`**: Structured JSON/tabular dataset ready for spreadsheet engines.
- **`PDF`**: Formatted document metadata with header/footer compliance branding.
- **`JSON`**: Structured REST payload export.

---

## 3. Security, Token Expiration & Tenant Isolation

1. **Secure Download Token**: Every export request generates a 256-bit cryptographically random token (`downloadToken`).
2. **Time-Bound Expiration**: Export links expire automatically after 24 hours (`expiresAt`).
3. **Tenant Isolation Verification**: When a client requests `/api/v1/reports/download/:token`, the server verifies that `record.tenantId === requestingTenantId`. Cross-tenant download attempts throw `ForbiddenException`.
4. **Idempotency**: Duplicate requests sharing `(tenantId, idempotencyKey)` return the original export record without re-processing.
