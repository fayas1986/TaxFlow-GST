# TaxFlow: Frontend Route & Navigation Map
**Document Version:** 1.0.0-FROZEN  
**Specification:** Complete mapping of 29 enterprise application screens to React Router DOM paths.  
**Architecture Rule:** Zero hash routing in production (`#/path` ➔ `/path`). Backward-compatibility hash redirector active.

---

## 1. Complete Route Specification Table

| Screen ID | Clean Route Path | Legacy Hash Route | Screen Name | Allowed RBAC Roles | Period Lock Sensitive? | Primary Query Keys |
|---|---|---|---|---|---|---|
| **SCR-01** | `/login` | `#/login` | Authentication & SSO Gateway | Public / All | No | `['auth', 'session']` |
| **SCR-02** | `/organization` | `#/organization` | Organization & Group Hierarchy | `SUPER_ADMIN`, `ADMIN` | No | `['organization', 'hierarchy']` |
| **SCR-03** | `/control-tower` | `#/control-tower` | Executive Control Tower & Pan-India Radar | All Roles | No | `['control-tower', 'radar']` |
| **SCR-04** | `/organization/gstins` | `#/organization` (Tab 2) | GSTIN & Registration Master | `SUPER_ADMIN`, `ADMIN` | No | `['gstin', 'registry']` |
| **SCR-05** | `/organization/branches` | `#/organization` (Tab 3) | Operational Branch & SEZ Unit Manager | `SUPER_ADMIN`, `ADMIN` | No | `['branch', 'list']` |
| **SCR-06** | `/parties?type=CUSTOMER` | `#/parties` | Customer Master Register | All except `VIEWER` | No | `['parties', 'customers']` |
| **SCR-07** | `/parties?type=VENDOR` | `#/parties` | Vendor Master & 2B Filing Compliance | All except `VIEWER` | No | `['parties', 'vendors']` |
| **SCR-08** | `/masters/items` | `#/rate-calculator` | Item, HSN & SAC Master Catalog | All except `VIEWER` | No | `['items', 'hsn-catalog']` |
| **SCR-09** | `/invoices` | `#/invoices` | Sales Invoice Management & Register | All Roles | **YES (HTTP 423 on Locked)** | `['invoices', 'sales']` |
| **SCR-10** | `/approvals` | `#/approvals` | Multi-Level Invoice Approval Workflow | `ADMIN`, `FINANCE_MANAGER` | **YES** | `['invoices', 'approvals']` |
| **SCR-11** | `/einvoice` | `#/einvoice` | E-Invoice / IRN Gateway & QR Generator | All except `VIEWER` | **YES** | `['einvoice', 'irn-logs']` |
| **SCR-12** | `/ewaybill` | `#/ewaybill` | E-Way Bill Part-A & Part-B Console | All except `VIEWER` | **YES** | `['ewaybill', 'active']` |
| **SCR-13** | `/purchases` | `#/invoices?type=INWARD` | Purchase Register & Inward Ingestion | All Roles | **YES** | `['purchases', 'inward']` |
| **SCR-14** | `/purchases/gstr2b-sync` | `#/reconciliation` | GSTR-2B Ingestion & Portal Sync Console | All except `VIEWER` | No | `['gstr2b', 'sync-status']` |
| **SCR-15** | `/reconciliation` | `#/reconciliation` | Extensible Multi-Evidence Reconciliation | All except `VIEWER` | **YES** | `['reconciliation', 'matches']` |
| **SCR-16** | `/compliance/exceptions` | `#/exceptions` | Centralized 10-Domain Exception Inbox | All Roles | **YES** | `['compliance', 'exceptions']` |
| **SCR-17** | `/itc/eligibility` | `#/computation` | ITC Eligibility & Rule 42/43 Apportionment | All except `VIEWER` | **YES** | `['itc', 'calculations']` |
| **SCR-18** | `/rcm/register` | `#/computation` | Reverse Charge (RCM) & Self-Invoicing | All except `VIEWER` | **YES** | `['rcm', 'register']` |
| **SCR-19** | `/ledger` | `#/computation` | Electronic Cash, Credit & Liability Ledgers | All except `VIEWER` | No | `['ledger', 'balances']` |
| **SCR-20** | `/statutory/gstr-1` | `#/filing` | GSTR-1 Outward Return Preparer & Filing | `ADMIN`, `FINANCE_MANAGER` | **YES (Dual-Signoff)** | `['returns', 'gstr1']` |
| **SCR-21** | `/statutory/gstr-3b` | `#/filing` | GSTR-3B Monthly Return & Tax Settlement | `ADMIN`, `FINANCE_MANAGER` | **YES (Dual-Signoff)** | `['returns', 'gstr3b']` |
| **SCR-22** | `/statutory/gstr-9` | `#/filing` | GSTR-9 Annual Return & 9C Reconciliation | `ADMIN`, `FINANCE_MANAGER` | **YES** | `['returns', 'gstr9']` |
| **SCR-23** | `/refunds` | `#/refunds` | GST Refund Lifecycle & RFD-01 Tracker | All Roles | No | `['refunds', 'cases']` |
| **SCR-24** | `/compliance/archive` | `#/compliance-archive` | 72-Month Statutory Compliance Vault | All Roles (Auditor) | No | `['archive', 'periods']` |
| **SCR-25** | `/audit` | `#/audit` | Append-Only Cryptographic Audit Log Trail | `ADMIN`, `AUDITOR` | No | `['audit', 'events']` |
| **SCR-26** | `/governance/rules` | `#/regulatory-intelligence`| CBIC Notifications & Dynamic Tax Rules | All Roles | No | `['regulatory', 'rules']` |
| **SCR-27** | `/reports` | `#/reports` | Executive Compliance & Turnover Reports | All Roles | No | `['reports', 'catalog']` |
| **SCR-28** | `/integrations` | `#/integrations` | ERP, Accounting & GSP Connector Hub | `SUPER_ADMIN`, `ADMIN` | No | `['integrations', 'connectors']` |
| **SCR-29** | `/settings` | `#/settings` | Platform Administration & Security | `SUPER_ADMIN` | No | `['settings', 'platform']` |

---

## 2. Navigation Redirect & Alias Table

To ensure zero broken links during transition, all legacy routes and shortcuts are aliased:

```text
/                      ───► /control-tower (Default Redirect)
/dashboard             ───► /control-tower
/architecture          ───► /control-tower (Architecture Telemetry Tab)
/exceptions            ───► /compliance/exceptions
/computation           ───► /ledger
/filing                ───► /statutory/gstr-1
/vault                 ───► /compliance/archive
/compliance-archive    ───► /compliance/archive
```

---

## 3. Backward-Compatibility Hash Routing Protocol

When an existing user opens a legacy bookmarked URL (e.g., `https://taxflow.app/#/reconciliation`):
1. The `HashRedirector` component intercepts the route on application boot.
2. Extracts the path segment (`/reconciliation`).
3. Uses HTML5 History API `window.history.replaceState` to cleanse the browser address bar.
4. Programmatically calls `navigate('/reconciliation', { replace: true })`.
5. User lands seamlessly on the target view without page reload.
