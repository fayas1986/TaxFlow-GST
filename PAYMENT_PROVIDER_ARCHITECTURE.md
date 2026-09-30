# TaxFlow — Stage 10 Payment Provider Architecture

## 1. Provider Abstraction Layer

TaxFlow decouples billing logic from specific gateway implementations (Stripe, Razorpay, BillDesk) using a provider-agnostic interface (`PaymentProviderAdapter`).

```text
               ┌───────────────────────┐
               │ PaymentProviderAdapter│
               └───────────┬───────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌─────────────────────────┐ ┌─────────────────────────┐
│  SandboxPaymentAdapter  │ │  Stripe/RazorpayAdapter │
│ (Test/Simulated Engine) │ │ (Production Gateways)   │
└─────────────────────────┘ └─────────────────────────┘
```

### Supported Adapter Operations:
- `createCustomer(tenantId, email, name)`
- `createSubscription(tenantId, planCode, billingCycle)`
- `cancelSubscription(providerSubId, immediate)`
- `verifyWebhookSignature(payload, signature, secret)`

---

## 2. Webhook Verification & Replay Protection

Payment webhooks are processed with enterprise-grade security controls in `PaymentWebhookService`:

1. **HMAC Signature Verification**: Webhook payloads are verified against provider signing secrets via SHA-256 HMAC digest verification before any parsing occurs.
2. **Replay Window Enforcement**: Webhook headers are checked for timestamp headers. Signatures with timestamp drift exceeding 300 seconds are rejected (`UnauthorizedException`).
3. **Event Idempotency**: Webhook event IDs are tracked in `BillingEvent` records. Replayed webhook events return status `SKIPPED_DUPLICATE` without re-processing state changes.
4. **Server-Side Authority**: Client-side payment success callbacks are strictly untrusted. Subscription activation only occurs upon receipt and verification of an authoritative server-to-server payment webhook.

---

## 3. PCI Compliance & Credential Protection

- **Zero Cardholder Data Storage**: Card numbers, CVV, pin codes, and provider passwords are **never transmitted to or stored in TaxFlow databases**. All payment input occurs directly via provider-hosted elements (Stripe Elements / Razorpay Checkout).
- **Encrypted Gateway Credentials**: Payment gateway API keys and webhook secrets are stored using TaxFlow's Stage 9 AES-256-GCM credential encryption architecture.
