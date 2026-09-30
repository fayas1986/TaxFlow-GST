# Prisma Schema Design Document (`schema.prisma`)

This document contains the complete proposed Prisma schema definition for TaxFlow.

```prisma
// ==========================================
// Generator & Datasource Configurations
// ==========================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==========================================
// Enums
// ==========================================

enum TenantStatus {
  ACTIVE
  SUSPENDED
  TRIAL
}

enum PartyType {
  CUSTOMER
  VENDOR
  BOTH
}

enum InvoiceType {
  B2B
  B2C
  SEZ_WITH_PAYMENT
  SEZ_WITHOUT_PAYMENT
  EXPORT_WITH_PAYMENT
  EXPORT_WITHOUT_PAYMENT
  CREDIT_NOTE
  DEBIT_NOTE
}

enum InvoiceStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  IRN_GENERATED
  EWAY_GENERATED
  CANCELLED
}

enum TaxPeriodStatus {
  OPEN
  LOCKED
  FILED
  ARCHIVED
}

enum ReturnType {
  GSTR1
  GSTR3B
  GSTR9
}

enum ReconciliationStatus {
  EXACT_MATCH
  AMOUNT_MISMATCH
  TAX_MISMATCH
  MISSING_IN_PURCHASE
  MISSING_IN_GSTR2B
}

enum AuditCategory {
  AUTHENTICATION
  INVOICE_MUTATION
  RETURN_FILING
  TAX_PERIOD_LOCK
  SECURITY_VIOLATION
}

// ==========================================
// Core Multi-Tenant & Organizational Models
// ==========================================

model Tenant {
  id          String       @id @default(uuid()) @db.Uuid
  name        String       @db.VarChar(255)
  code        String       @unique @db.VarChar(50)
  planCode    String       @default("ENTERPRISE") @map("plan_code") @db.VarChar(50)
  status      TenantStatus @default(ACTIVE)
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")

  companies       Company[]
  users           User[]
  gstRegistrations GSTRegistration[]
  branches        Branch[]
  parties         Party[]
  salesInvoices   SalesInvoice[]
  taxPeriods      TaxPeriod[]
  auditLogs       AuditLog[]

  @@map("tenants")
}

model Company {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  name        String   @db.VarChar(255)
  legalName   String   @map("legal_name") @db.VarChar(255)
  pan         String   @db.VarChar(10)
  email       String?  @db.VarChar(255)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  tenant           Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  gstRegistrations GSTRegistration[]
  branches         Branch[]
  salesInvoices    SalesInvoice[]

  @@unique([id, tenantId])
  @@unique([tenantId, pan])
  @@index([tenantId])
  @@map("companies")
}

model GSTRegistration {
  id               String   @id @default(uuid()) @db.Uuid
  tenantId         String   @map("tenant_id") @db.Uuid
  companyId        String   @map("company_id") @db.Uuid
  gstin            String   @db.VarChar(15)
  legalName        String   @map("legal_name") @db.VarChar(255)
  tradeName        String?  @map("trade_name") @db.VarChar(255)
  stateCode        String   @map("state_code") @db.VarChar(2)
  registrationType String   @default("REGULAR") @map("registration_type") @db.VarChar(50)
  status           String   @default("ACTIVE") @db.VarChar(20)
  createdAt        DateTime @default(now()) @map("created_at")

  tenant     Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  company    Company      @relation(fields: [companyId, tenantId], references: [id, tenantId], onDelete: Cascade)
  branches   Branch[]
  invoices   SalesInvoice[]
  taxPeriods TaxPeriod[]

  @@unique([id, tenantId])
  @@unique([id, tenantId, companyId])
  @@unique([tenantId, gstin])
  @@index([companyId])
  @@map("gst_registrations")
}

model Branch {
  id           String   @id @default(uuid()) @db.Uuid
  tenantId     String   @map("tenant_id") @db.Uuid
  companyId    String   @map("company_id") @db.Uuid
  gstinId      String   @map("gstin_id") @db.Uuid
  branchCode   String   @map("branch_code") @db.VarChar(50)
  name         String   @db.VarChar(255)
  stateCode    String   @map("state_code") @db.VarChar(2)
  isHeadOffice Boolean  @default(false) @map("is_head_office")
  address      Json?    @db.JsonB
  createdAt    DateTime @default(now()) @map("created_at")

  tenant          Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  company         Company         @relation(fields: [companyId, tenantId], references: [id, tenantId], onDelete: Cascade)
  gstRegistration GSTRegistration @relation(fields: [gstinId, tenantId, companyId], references: [id, tenantId, companyId], onDelete: Cascade)
  salesInvoices   SalesInvoice[]

  @@unique([id, tenantId])
  @@unique([tenantId, companyId, branchCode])
  @@index([gstinId])
  @@map("branches")
}

model User {
  id           String   @id @default(uuid()) @db.Uuid
  tenantId     String   @map("tenant_id") @db.Uuid
  email        String   @db.VarChar(255)
  passwordHash String   @map("password_hash") @db.VarChar(255)
  fullName     String   @map("full_name") @db.VarChar(255)
  role         String   @default("TAX_ANALYST") @db.VarChar(50)
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, email])
  @@map("users")
}

// ==========================================
// Master Data Models
// ==========================================

model Party {
  id        String    @id @default(uuid()) @db.Uuid
  tenantId  String    @map("tenant_id") @db.Uuid
  partyCode String    @map("party_code") @db.VarChar(50)
  legalName String    @map("legal_name") @db.VarChar(255)
  tradeName String?   @map("trade_name") @db.VarChar(255)
  partyType PartyType @map("party_type")
  pan       String?   @db.VarChar(10)
  createdAt DateTime  @default(now()) @map("created_at")

  tenant   Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  invoices SalesInvoice[]

  @@unique([id, tenantId])
  @@unique([tenantId, partyCode])
  @@map("parties")
}

// ==========================================
// Transaction & Invoicing Models
// ==========================================

model TaxPeriod {
  id        String          @id @default(uuid()) @db.Uuid
  tenantId  String          @map("tenant_id") @db.Uuid
  gstinId   String          @map("gstin_id") @db.Uuid
  periodKey String          @map("period_key") @db.VarChar(7) // MMYYYY
  status    TaxPeriodStatus @default(OPEN)
  isLocked  Boolean         @default(false) @map("is_locked")
  createdAt DateTime        @default(now()) @map("created_at")

  tenant          Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  gstRegistration GSTRegistration @relation(fields: [gstinId, tenantId], references: [id, tenantId], onDelete: Cascade)
  salesInvoices   SalesInvoice[]

  @@unique([id, tenantId])
  @@unique([tenantId, gstinId, periodKey])
  @@map("tax_periods")
}

model SalesInvoice {
  id                  String        @id @default(uuid()) @db.Uuid
  tenantId            String        @map("tenant_id") @db.Uuid
  companyId           String        @map("company_id") @db.Uuid
  gstinId             String        @map("gstin_id") @db.Uuid
  branchId            String?       @map("branch_id") @db.Uuid
  partyId             String        @map("party_id") @db.Uuid
  taxPeriodId         String        @map("tax_period_id") @db.Uuid
  invoiceNumber       String        @map("invoice_number") @db.VarChar(100)
  invoiceDate         DateTime      @map("invoice_date") @db.Date
  invoiceType         InvoiceType   @default(B2B) @map("invoice_type")
  status              InvoiceStatus @default(DRAFT)
  totalTaxableAmount Decimal       @default(0.0000) @map("total_taxable_amount") @db.Decimal(16, 4)
  totalCgstAmount    Decimal       @default(0.0000) @map("total_cgst_amount") @db.Decimal(16, 4)
  totalSgstAmount    Decimal       @default(0.0000) @map("total_sgst_amount") @db.Decimal(16, 4)
  totalIgstAmount    Decimal       @default(0.0000) @map("total_igst_amount") @db.Decimal(16, 4)
  totalCessAmount    Decimal       @default(0.0000) @map("total_cess_amount") @db.Decimal(16, 4)
  totalInvoiceAmount Decimal       @default(0.0000) @map("total_invoice_amount") @db.Decimal(16, 4)
  createdAt           DateTime      @default(now()) @map("created_at")
  updatedAt           DateTime      @updatedAt @map("updated_at")

  tenant          Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  company         Company         @relation(fields: [companyId, tenantId], references: [id, tenantId], onDelete: Cascade)
  gstRegistration GSTRegistration @relation(fields: [gstinId, tenantId, companyId], references: [id, tenantId, companyId], onDelete: Cascade)
  branch          Branch?         @relation(fields: [branchId, tenantId], references: [id, tenantId], onDelete: SetNull)
  party           Party           @relation(fields: [partyId, tenantId], references: [id, tenantId], onDelete: Restrict)
  taxPeriod       TaxPeriod       @relation(fields: [taxPeriodId, tenantId], references: [id, tenantId], onDelete: Restrict)
  lineItems       InvoiceItem[]

  @@unique([id, tenantId])
  @@unique([tenantId, gstinId, invoiceNumber])
  @@index([tenantId, taxPeriodId])
  @@map("sales_invoices")
}

model InvoiceItem {
  id            String   @id @default(uuid()) @db.Uuid
  invoiceId     String   @map("invoice_id") @db.Uuid
  itemNumber    Int      @map("item_number")
  hsnSacCode    String   @map("hsn_sac_code") @db.VarChar(10)
  description   String   @db.Text
  quantity      Decimal  @db.Decimal(16, 4)
  unitPrice     Decimal  @map("unit_price") @db.Decimal(16, 4)
  taxableValue  Decimal  @map("taxable_value") @db.Decimal(16, 4)
  cgstRate      Decimal  @default(0.00) @map("cgst_rate") @db.Decimal(5, 2)
  cgstAmount    Decimal  @default(0.0000) @map("cgst_amount") @db.Decimal(16, 4)
  sgstRate      Decimal  @default(0.00) @map("sgst_rate") @db.Decimal(5, 2)
  sgstAmount    Decimal  @default(0.0000) @map("sgst_amount") @db.Decimal(16, 4)
  igstRate      Decimal  @default(0.00) @map("igst_rate") @db.Decimal(5, 2)
  igstAmount    Decimal  @default(0.0000) @map("igst_amount") @db.Decimal(16, 4)
  totalAmount   Decimal  @map("total_amount") @db.Decimal(16, 4)

  salesInvoice SalesInvoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([invoiceId])
  @@map("invoice_items")
}

// ==========================================
// Audit & Security Logging
// ==========================================

model AuditLog {
  id         String        @id @default(uuid()) @db.Uuid
  tenantId   String        @map("tenant_id") @db.Uuid
  userId     String?       @map("user_id") @db.Uuid
  category   AuditCategory
  action     String        @db.VarChar(100)
  entityName String        @map("entity_name") @db.VarChar(100)
  entityId   String?       @map("entity_id") @db.VarChar(100)
  diff       Json?         @db.JsonB
  ipAddress  String?       @map("ip_address") @db.VarChar(45)
  createdAt  DateTime      @default(now()) @map("created_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, createdAt])
  @@map("audit_logs")
}
```
