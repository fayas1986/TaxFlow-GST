# E-Invoice Lifecycle Architecture

**TaxFlow GST Compliance SaaS — Stage 7 Architecture Specification**

---

## 1. E-Invoice Lifecycle State Machine

E-Invoice processing uses an explicit, deterministic state machine:

```text
       ┌───────────────────┐
       │   NOT_GENERATED   │
       └─────────┬─────────┘
                 │
                 ▼
       ┌───────────────────┐
       │    VALIDATING     │
       └─────────┬─────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
 ┌───────────────┐ ┌──────────────┐
 │  SUBMITTING   │ │    FAILED    │ (Transient / Permanent Error)
 └───────┬───────┘ └──────┬───────┘
         │                │ (Worker Retry)
         ▼                │
 ┌───────────────┐        │
 │   GENERATED   │◄───────┘
 └───────┬───────┘
         │
         ▼
 ┌───────────────┐
 │ CANCEL_PENDING│
 └───────┬───────┘
         │
         ▼
 ┌───────────────┐
 │   CANCELLED   │
 └───────────────┘
```

---

## 2. State Transition Rules

| Initial State | Target State | Trigger / Conditions | Actions & Side Effects |
| :--- | :--- | :--- | :--- |
| `NOT_GENERATED` | `VALIDATING` | User or Worker initiates IRN request | Runs compliance & tax validation rules |
| `VALIDATING` | `SUBMITTING` | Compliance check passes | Creates pending `EInvoiceRecord`, locks invoice payload |
| `VALIDATING` | `FAILED` | Compliance check fails | Logs statutory validation errors |
| `SUBMITTING` | `GENERATED` | GSP/NIC portal returns 200 OK + IRN | Sets IRN, Ack No, Ack Date, Signed QR; locks `SalesInvoice` (`isStatutoryLocked = true`) |
| `SUBMITTING` | `FAILED` | Network timeout / GSP error | Logs error details, unlocks for worker retry |
| `GENERATED` | `CANCEL_PENDING` | User requests cancellation within 24 hours | Checks cancellation validity window |
| `CANCEL_PENDING`| `CANCELLED` | GSP confirms IRN cancellation | Records cancel timestamp, reason & remark; releases invoice statutory lock for amendment |

---

## 3. Immutability Enforcement

Once an invoice reaches state `GENERATED`:
1. **Database Guard**: `SalesInvoice.isStatutoryLocked = true` prevents UPDATE operations on `totalTaxableAmount`, `totalCgstAmount`, `totalSgstAmount`, `totalIgstAmount`, `invoiceNumber`, `invoiceDate`, and `partyId`.
2. **Audit Snapshot**: The exact submitted JSON payload is preserved in `EInvoiceRecord.rawResponse` alongside the signed QR code string.
3. **Amendment Requirements**: Any modification requires formal cancellation through the government portal within the statutory 24-hour window, followed by an amendment invoice workflow.
