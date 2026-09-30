# Notification & Reliability Architecture

## 1. Executive Summary & Design Principles

The TaxFlow Notification System (`NotificationService`) delivers real-time notifications, email alerts, and webhook event dispatches for GST compliance operations (e.g. return filing completions, approval requests, E-Way Bill expiry warnings, reconciliation discrepancies).

### Key Principles
* **Provider Adapter Abstraction**: Decouples business logic from delivery providers via `NotificationProviderAdapter` implementations (`EmailNotificationProviderAdapter`, `WebhookNotificationProviderAdapter`, `InAppNotificationProviderAdapter`).
* **Asynchronous Queue Delivery**: Notifications are dispatched asynchronously via BullMQ background workers to ensure low HTTP response latency for financial operations.
* **Idempotent Dispatch**: Uses composite idempotency keys (`@@unique([tenantId, idempotencyKey])`) to guarantee that duplicate event triggers do not send multiple notifications.
* **Transient Failure Retries & Dead-Letter Handling**: Failed deliveries undergo automatic exponential backoff retries (up to 3 attempts). Exceeding max retries transitions the record to `DEAD_LETTER` status.
* **Transaction Safety**: **A failed notification MUST NEVER roll back or abort an underlying financial or compliance transaction**. All notification dispatches are wrapped in non-blocking error boundary handlers (`sendNotificationSafely`).

---

## 2. Component Architecture

```text
Business Operations (Invoices, Approvals, Returns)
       │
       ▼  sendNotificationSafely() [Non-Blocking]
Notification Service
       │
       ├─► Idempotency Guard (Check idempotencyKey)
       │
       ▼  Asynchronous Queue Worker (BullMQ)
Provider Adapter Router
       ├── Email Provider Adapter ──► SMTP / SES
       ├── Webhook Provider Adapter ──► HTTP Webhook Endpoints
       └── In-App Provider Adapter ──► In-App User Feed
```

---

## 3. Delivery Lifecycle & Retry State Machine

```text
  [ PENDING ]
       │
       ▼  Process Delivery
 ┌─────┴────────────────────────┐
 │                              │
 ▼ Success                      ▼ Failure (Attempt < 3)
[ DELIVERED ]              [ RETRYING ]
                                │
                                ▼ Attempt == 3
                           [ DEAD_LETTER ]
```

### Supported Channels & Behavior
1. **IN_APP**: Instant delivery to user's internal inbox/dashboard feed.
2. **EMAIL**: Transactional email notifications sent to compliance managers.
3. **WEBHOOK**: Secure HTTP POST JSON webhooks sent to enterprise ERP systems (QuickBooks, SAP, Xero).

---

## 4. End-to-End Correlation & Observability

Every notification record retains a `correlationId` passed from the initiating HTTP request down through service layers, BullMQ queue jobs, provider delivery attempts, and immutable audit logs. This enables unified distributed tracing:

```text
HTTP Request (X-Correlation-ID)
 └─► NestJS Service (Invoice / Return Approval)
      └─► Database Transaction (PostgreSQL)
           └─► BullMQ Notification Job
                └─► Webhook Provider HTTP Post
                     └─► Immutable Audit Log (NOTIFICATION_DELIVERED)
```
