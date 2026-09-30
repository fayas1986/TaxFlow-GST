# TaxFlow Database Entity-Relationship Diagram (ERD)

This document presents the complete relational ERD for the TaxFlow PostgreSQL database.

## 1. Core Organizational Hierarchy

```mermaid
erDiagram
    Tenants ||--o{ Companies : "owns"
    Tenants ||--o{ Users : "has"
    Companies ||--o{ GSTRegistrations : "has"
    Companies ||--o{ Branches : "operates"
    GSTRegistrations ||--o{ Branches : "assigned_to"

    Tenants {
        uuid id PK
        string name
        string code
        string plan_code
        string status
        datetime created_at
    }

    Companies {
        uuid id PK
        uuid tenant_id FK
        string name
        string pan
        string legal_name
        string email
        datetime created_at
    }

    GSTRegistrations {
        uuid id PK
        uuid tenant_id FK
        uuid company_id FK
        string gstin
        string state_code
        string registration_type
        string status
    }

    Branches {
        uuid id PK
        uuid tenant_id FK
        uuid company_id FK
        uuid gstin_id FK
        string branch_code
        string name
        string state_code
        boolean is_head_office
    }

    Users {
        uuid id PK
        uuid tenant_id FK
        string email
        string password_hash
        string full_name
        string role
        boolean is_active
    }
```

---

## 2. Party Master, HSN & Tax Rules

```mermaid
erDiagram
    Tenants ||--o{ Parties : "manages"
    Parties ||--o{ PartyGSTINs : "has"
    TaxRateRules ||--o{ HSNMasters : "applies_to"

    Parties {
        uuid id PK
        uuid tenant_id FK
        string party_code
        string legal_name
        string trade_name
        string party_type
        string pan
    }

    PartyGSTINs {
        uuid id PK
        uuid party_id FK
        string gstin
        string state_code
        string address
        boolean is_active
    }

    HSNMasters {
        uuid id PK
        string code
        string description
        string type
        decimal igst_rate
        decimal cgst_rate
        decimal sgst_rate
        decimal cess_rate
    }

    TaxRateRules {
        uuid id PK
        string rule_code
        string description
        datetime effective_from
        datetime effective_to
        string version
    }
```

---

## 3. Invoices, Line Items & Tax Calculation Engine

```mermaid
erDiagram
    Companies ||--o{ SalesInvoices : "issues"
    GSTRegistrations ||--o{ SalesInvoices : "registered_under"
    Branches ||--o{ SalesInvoices : "originated_at"
    Parties ||--o{ SalesInvoices : "billed_to"
    SalesInvoices ||--o{ InvoiceLineItems : "contains"
    TaxPeriods ||--o{ SalesInvoices : "belongs_to"

    TaxPeriods {
        uuid id PK
        uuid tenant_id FK
        uuid gstin_id FK
        string period_key
        string status
        boolean is_locked
    }

    SalesInvoices {
        uuid id PK
        uuid tenant_id FK
        uuid company_id FK
        uuid gstin_id FK
        uuid branch_id FK
        uuid customer_id FK
        uuid tax_period_id FK
        string invoice_number
        date invoice_date
        string invoice_type
        decimal total_taxable_amount
        decimal total_cgst_amount
        decimal total_sgst_amount
        decimal total_igst_amount
        decimal total_cess_amount
        decimal total_invoice_amount
        string status
    }

    InvoiceLineItems {
        uuid id PK
        uuid invoice_id FK
        integer item_number
        string hsn_sac_code
        string description
        decimal quantity
        decimal unit_price
        decimal taxable_value
        decimal cgst_rate
        decimal cgst_amount
        decimal sgst_rate
        decimal sgst_amount
        decimal igst_rate
        decimal igst_amount
        decimal total_item_amount
    }
```

---

## 4. GSTR-2B Reconciliation, Returns, E-Invoice & E-Way Bill

```mermaid
erDiagram
    SalesInvoices ||--o| EInvoices : "generates"
    SalesInvoices ||--o| EWayBills : "generates"
    TaxPeriods ||--o{ GSTReturns : "filed_for"
    TaxPeriods ||--o{ ReconciliationRuns : "executes"
    ReconciliationRuns ||--o{ ReconciliationMatches : "produces"

    EInvoices {
        uuid id PK
        uuid tenant_id FK
        uuid invoice_id FK
        string irn
        string ack_number
        datetime ack_date
        string qr_code_url
        string status
    }

    EWayBills {
        uuid id PK
        uuid tenant_id FK
        uuid invoice_id FK
        string eway_bill_number
        datetime generated_date
        datetime valid_until
        string status
    }

    GSTReturns {
        uuid id PK
        uuid tenant_id FK
        uuid gstin_id FK
        uuid tax_period_id FK
        string return_type
        string arn
        datetime filing_date
        string status
        jsonb return_payload
    }

    ReconciliationRuns {
        uuid id PK
        uuid tenant_id FK
        uuid gstin_id FK
        uuid tax_period_id FK
        datetime run_at
        integer total_matched
        integer total_mismatched
        decimal match_percentage
    }

    ReconciliationMatches {
        uuid id PK
        uuid run_id FK
        uuid purchase_invoice_id FK
        string gstr2b_item_id
        string match_status
        decimal variance_amount
    }
```
