# TaxFlow Observability & Monitoring Architecture

## 1. Overview
TaxFlow GST SaaS implements end-to-end correlation tracking and structured JSON logging across API requests, domain services, database transactions, background workers, and government GSP provider calls.

---

## 2. Distributed Correlation Context
Every log event includes a standardized metadata schema:
- `correlationId`: Unique tracing ID generated per request or job context.
- `tenantId`: Active tenant identifier.
- `companyId`: Active company scope.
- `gstinId`: Active GSTIN scope.
- `operation`: Domain function name.
- `durationMs`: Execution time in milliseconds.

---

## 3. Log Redaction & Security Enforcement
The following data elements are strictly redacted before output:
- Passwords & Hashed Credentials
- JWT Tokens (`Authorization` headers)
- GSP API Keys & Client Secrets
- Private Cryptographic Keys
- Raw Credit Card / Banking Credentials

---

## 4. Health & Readiness Observability
- `GET /health/live`: Liveness endpoint checking application loop.
- `GET /health/ready`: Readiness endpoint performing real-time DB latency (`SELECT 1`) & background job queue depth monitoring.
