# TaxFlow API Endpoint to NestJS Module Mapping

This document provides a comprehensive mapping of existing Express prototype API routes (`server.ts` / `services/api.ts`) to their new target **NestJS Controllers and Modules**.

## 1. Authentication & Tenancy Module (`AuthModule`, `TenancyModule`)

| Existing Endpoint Path | HTTP Method | Target NestJS Controller Method | Target NestJS Module |
| :--- | :--- | :--- | :--- |
| `/api/v1/auth/login` | POST | `AuthController.login()` | `AuthModule` |
| `/api/v1/auth/refresh` | POST | `AuthController.refreshToken()` | `AuthModule` |
| `/api/v1/tenancy/verify-access` | GET | `TenancyController.verifyAccess()` | `TenancyModule` |
| `/api/v1/tenancy/subdomain/inspect` | GET | `TenancyController.inspectSubdomain()` | `TenancyModule` |
| `/api/v1/tenancy/context` | GET | `TenancyController.getContext()` | `TenancyModule` |
| `/api/v1/tenancy/tenants` | GET | `TenancyController.listTenants()` | `TenancyModule` |
| `/api/v1/tenancy/tenants` | POST | `TenancyController.createTenant()` | `TenancyModule` |

---

## 2. Admin & Subscription Module (`AdminModule`)

| Existing Endpoint Path | HTTP Method | Target NestJS Controller Method | Target NestJS Module |
| :--- | :--- | :--- | :--- |
| `/api/v1/admin/stats` | GET | `AdminController.getStats()` | `AdminModule` |
| `/api/v1/admin/tenants/stats` | GET | `AdminController.getTenantStats()` | `AdminModule` |
| `/api/v1/admin/tenants` | GET | `AdminController.listAllTenants()` | `AdminModule` |
| `/api/v1/admin/tenants` | POST | `AdminController.provisionTenant()` | `AdminModule` |
| `/api/v1/admin/modules` | GET | `AdminController.getModuleFlags()` | `AdminModule` |
| `/api/v1/admin/modules/:feature` | PUT | `AdminController.toggleModuleFlag()` | `AdminModule` |
| `/api/v1/admin/plans` | GET | `AdminController.listPlans()` | `AdminModule` |
| `/api/v1/admin/plans/:planCode` | PUT | `AdminController.updatePlan()` | `AdminModule` |

---

## 3. Companies, GST Registrations & Branches (`CompanyModule`, `GstinModule`, `BranchModule`)

| Existing Endpoint Path | HTTP Method | Target NestJS Controller Method | Target NestJS Module |
| :--- | :--- | :--- | :--- |
| `/api/v1/companies` | GET | `CompanyController.findAll()` | `CompanyModule` |
| `/api/v1/companies` | POST | `CompanyController.create()` | `CompanyModule` |
| `/api/v1/companies/:id` | GET | `CompanyController.findOne()` | `CompanyModule` |
| `/api/v1/gstin/registrations` | GET | `GstinController.findAll()` | `GstinModule` |
| `/api/v1/gstin/verify` | POST | `GstinController.verifyGstin()` | `GstinModule` |
| `/api/v1/branches` | GET | `BranchController.findAll()` | `BranchModule` |
| `/api/v1/branches` | POST | `BranchController.create()` | `BranchModule` |

---

## 4. Party Master & HSN Module (`PartyModule`, `TaxEngineModule`)

| Existing Endpoint Path | HTTP Method | Target NestJS Controller Method | Target NestJS Module |
| :--- | :--- | :--- | :--- |
| `/api/v1/parties` | GET | `PartyController.findAll()` | `PartyModule` |
| `/api/v1/parties` | POST | `PartyController.create()` | `PartyModule` |
| `/api/v1/parties/:id` | PUT | `PartyController.update()` | `PartyModule` |
| `/api/v1/hsn/search` | GET | `TaxEngineController.searchHsn()` | `TaxEngineModule` |
| `/api/v1/tax/calculate` | POST | `TaxEngineController.calculateTax()` | `TaxEngineModule` |

---

## 5. Invoicing & Tax Ledger Module (`InvoiceModule`, `LedgerModule`)

| Existing Endpoint Path | HTTP Method | Target NestJS Controller Method | Target NestJS Module |
| :--- | :--- | :--- | :--- |
| `/api/v1/invoices/sales` | GET | `InvoiceController.findSalesInvoices()` | `InvoiceModule` |
| `/api/v1/invoices/sales` | POST | `InvoiceController.createSalesInvoice()` | `InvoiceModule` |
| `/api/v1/invoices/purchase` | GET | `InvoiceController.findPurchaseInvoices()` | `InvoiceModule` |
| `/api/v1/invoices/purchase` | POST | `InvoiceController.createPurchaseInvoice()` | `InvoiceModule` |
| `/api/v1/ledger/entries` | GET | `LedgerController.getEntries()` | `LedgerModule` |

---

## 6. GSTR-2B & Reconciliation Module (`ReconciliationModule`)

| Existing Endpoint Path | HTTP Method | Target NestJS Controller Method | Target NestJS Module |
| :--- | :--- | :--- | :--- |
| `/api/v1/reconciliation/gstr2b/upload` | POST | `ReconciliationController.upload2b()` | `ReconciliationModule` |
| `/api/v1/reconciliation/run` | POST | `ReconciliationController.runRecon()` | `ReconciliationModule` |
| `/api/v1/reconciliation/results` | GET | `ReconciliationController.getResults()` | `ReconciliationModule` |
| `/api/v1/reconciliation/action` | POST | `ReconciliationController.takeAction()` | `ReconciliationModule` |

---

## 7. E-Invoice & E-Way Bill Module (`EInvoiceModule`, `EWayBillModule`)

| Existing Endpoint Path | HTTP Method | Target NestJS Controller Method | Target NestJS Module |
| :--- | :--- | :--- | :--- |
| `/api/v1/einvoice/generate` | POST | `EInvoiceController.generateIRN()` | `EInvoiceModule` |
| `/api/v1/einvoice/cancel` | POST | `EInvoiceController.cancelIRN()` | `EInvoiceModule` |
| `/api/v1/ewaybill/generate` | POST | `EWayBillController.generateEWayBill()` | `EWayBillModule` |
| `/api/v1/ewaybill/cancel` | POST | `EWayBillController.cancelEWayBill()` | `EWayBillModule` |

---

## 8. WhatsApp & Notification Jobs (`NotificationModule`, `QueueModule`)

| Existing Endpoint Path | HTTP Method | Target NestJS Controller Method | Target NestJS Module |
| :--- | :--- | :--- | :--- |
| `/api/v1/whatsapp/status` | GET | `NotificationController.getWhatsappStatus()` | `NotificationModule` |
| `/api/v1/whatsapp/notify` | POST | `NotificationController.sendNotification()` | `NotificationModule` |
| `/api/v1/jobs/schedule-report` | POST | `QueueController.scheduleReport()` | `QueueModule` |
| `/api/v1/jobs/list` | GET | `QueueController.listJobs()` | `QueueModule` |
