# Approval Engine Architecture

## 1. Executive Summary & Design Principles

The TaxFlow Approval Engine establishes a **reusable, multi-stage enterprise workflow framework** governing compliance transactions, return filings, invoice state mutations, ITC reversals, and tax ledger adjustments. Rather than embedding bespoke approval logic inside individual entity modules, TaxFlow decouples state governance into a centralized engine (`ApprovalEngineService`).

### Key Design Principles
* **State Machine Formality**: Standardized lifecycle: `DRAFT` → `SUBMITTED` → `UNDER_REVIEW` → `APPROVED` (or `REJECTED`).
* **Multi-Stage & Role-Based Rules**: Workflows define ordered stages with role requirements (`FINANCE_MANAGER`, `CFO`, `TAX_HEAD`) and user-specific assignments.
* **Server-Side Segregation of Duties (SoD)**: Hard server-side guards prevent preparers/creators from self-approving transactions or modifying historical records.
* **Delegation Governance**: Time-bound delegation maps authority from delegators to delegatees without granting permanent permissions.
* **Immutability & Auditability**: Every submission, approval, rejection, and delegation creates append-only action history records (`ApprovalActionHistory`) linked to the central audit system.

---

## 2. Reusable State Machine Architecture

```text
       [ DRAFT ]
           │
           ▼  submitForApproval()
     [ SUBMITTED ] ── Stage 0
           │
           ▼  approveRequest() (Stage < TotalStages)
    [ UNDER_REVIEW ] ── Stage 1..N-1
           │
     ┌─────┴────────────────────────┐
     │                              │
     ▼  Final Stage Approve         ▼  rejectRequest()
[ APPROVED ]                   [ REJECTED ]
```

### Supported Lifecycle States
1. **DRAFT**: Entity created locally, editable by preparer.
2. **SUBMITTED**: Entity submitted into workflow engine, assigned to Stage 0.
3. **UNDER_REVIEW**: In progress across multi-stage review.
4. **APPROVED**: Final stage approved; entity moves to posted/locked state.
5. **REJECTED**: Terminal state with mandatory rejection reason and audit trace.

---

## 3. Workflow Configuration & Delegation Engine

### Workflow Schema (`ApprovalWorkflow` & `ApprovalStageDefinition`)
- **Min/Max Financial Thresholds**: Workflows trigger conditionally based on monetary limits (e.g., invoices > ₹1,00,000 require CFO approval).
- **Stage Definitions**: Configurable role requirements (`requiredRole`), explicit user assignments (`requiredUserId`), and minimum required approvers count (`minApprovers`).

### Delegation Rules (`ApprovalDelegation`)
- Users may delegate approval authority for specific entity types across a strict `[startDate, endDate]` range.
- When an active delegation exists, the delegatee user passes authorization checks on behalf of the delegator.

---

## 4. Segregation of Duties (SoD) & Bypass Prevention

TaxFlow enforces SoD strictly on the backend:
1. **Self-Approval Guard**: `requesterUserId !== actorUserId`. A preparer cannot approve their own invoice, return, or tax ledger reversal.
2. **Reversal Guard**: Users cannot approve their own reversal entries.
3. **History Protection**: Approval history logs (`ApprovalActionHistory`) are append-only. Administrators cannot delete or mutate approval records.
4. **Bypass Protection**: Bypassing configured approval rules throws NestJS `ForbiddenException` and logs a `SECURITY_VIOLATION` event in the immutable audit log.

---

## 5. Domain Entities Integrated
- `SalesInvoice` / `PurchaseInvoice`
- `GstReturn` (GSTR-1, GSTR-3B filing approvals)
- `ItcRecord` (Section 17(5) reversal approvals)
- `TaxLedgerEntry` (Manual ledger adjustment approvals)
- `EInvoiceRecord` (IRN cancellation approvals)
