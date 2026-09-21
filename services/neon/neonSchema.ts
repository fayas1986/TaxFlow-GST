/**
 * Neon Serverless PostgreSQL Multi-Tenant Database Schema
 * 
 * Implements enterprise-grade multi-tenancy with:
 * 1. PostgreSQL Row-Level Security (RLS) policies
 * 2. Session Context via `app.current_tenant_id`
 * 3. Client Dataset Isolation across Invoices, GSTINs, Returns, and Ledgers
 * 4. Audit Trail with Cryptographic Tamper Hash
 */

export const NEON_MULTITENANT_SQL_SCHEMA = `-- ==============================================================================
-- NEON POSTGRESQL MULTI-TENANT ARCHITECTURE FOR GST COMPLIANCE SAAS
-- Provides strict dataset isolation across distinct corporate entities & clients.
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Master Tenants / Clients Registry
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) PRIMARY KEY,
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    pan VARCHAR(10) NOT NULL UNIQUE,
    sector VARCHAR(100) DEFAULT 'General Commercial',
    state_code VARCHAR(2) NOT NULL,
    state_name VARCHAR(100) NOT NULL,
    compliance_score NUMERIC(5,2) DEFAULT 98.50,
    annual_turnover NUMERIC(16,2) DEFAULT 0.00,
    isolation_mode VARCHAR(32) DEFAULT 'ROW_LEVEL_SECURITY', -- 'ROW_LEVEL_SECURITY' or 'SCHEMA_ISOLATION'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tenant Users & Role-Based Access
CREATE TABLE IF NOT EXISTS tenant_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'ACCOUNTANT', -- 'SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'AUDITOR', 'VIEWER'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tenant_user UNIQUE(tenant_id, email)
);
CREATE INDEX IF NOT EXISTS idx_tenant_users_lookup ON tenant_users(tenant_id, email);

-- 4. Tenant GSTIN Registrations (State-wise registrations per client)
CREATE TABLE IF NOT EXISTS tenant_gstin_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    gstin VARCHAR(15) NOT NULL,
    state_code VARCHAR(2) NOT NULL,
    state_name VARCHAR(100) NOT NULL,
    registration_type VARCHAR(50) DEFAULT 'REGULAR', -- 'REGULAR', 'COMPOSITION', 'SEZ_UNIT', 'ISD'
    einvoice_enabled BOOLEAN DEFAULT TRUE,
    ewaybill_enabled BOOLEAN DEFAULT TRUE,
    is_primary BOOLEAN DEFAULT FALSE,
    status VARCHAR(32) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tenant_gstin UNIQUE(tenant_id, gstin)
);
CREATE INDEX IF NOT EXISTS idx_tenant_gstins ON tenant_gstin_registrations(tenant_id, gstin);

-- 5. Tenant Invoices & E-Invoices (Strictly isolated by tenant_id)
CREATE TABLE IF NOT EXISTS tenant_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_number VARCHAR(64) NOT NULL,
    invoice_date DATE NOT NULL,
    financial_year VARCHAR(10) NOT NULL,
    supplier_gstin VARCHAR(15) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_gstin VARCHAR(15) NOT NULL,
    customer_state_code VARCHAR(2) NOT NULL,
    invoice_type VARCHAR(32) DEFAULT 'B2B', -- 'B2B', 'B2C', 'EXPORT', 'SEZ_WP', 'SEZ_WOP'
    taxable_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    cgst_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    cess_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    irn VARCHAR(64),
    ack_no VARCHAR(64),
    status VARCHAR(32) DEFAULT 'GENERATED', -- 'DRAFT', 'PENDING_APPROVAL', 'GENERATED', 'CANCELLED'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tenant_invoice_num UNIQUE(tenant_id, invoice_number)
);
CREATE INDEX IF NOT EXISTS idx_tenant_invoices_tenant_date ON tenant_invoices(tenant_id, invoice_date);
CREATE INDEX IF NOT EXISTS idx_tenant_invoices_irn ON tenant_invoices(tenant_id, irn);

-- 6. Tenant Statutory Returns & Filings (GSTR-1, GSTR-3B, GSTR-9)
CREATE TABLE IF NOT EXISTS tenant_gstr_filings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    return_type VARCHAR(16) NOT NULL, -- 'GSTR-1', 'GSTR-3B', 'GSTR-9', 'GSTR-2B'
    period VARCHAR(16) NOT NULL,      -- '2026-04', '2026-05', etc.
    financial_year VARCHAR(10) NOT NULL,
    gstin VARCHAR(15) NOT NULL,
    arn VARCHAR(64),
    filing_date TIMESTAMPTZ,
    status VARCHAR(32) DEFAULT 'FILED', -- 'DRAFT', 'SUBMITTED', 'FILED', 'OVERDUE'
    tax_liability NUMERIC(14,2) DEFAULT 0.00,
    tax_paid NUMERIC(14,2) DEFAULT 0.00,
    itc_availed NUMERIC(14,2) DEFAULT 0.00,
    hash_signature VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tenant_filing UNIQUE(tenant_id, return_type, period, gstin)
);
CREATE INDEX IF NOT EXISTS idx_tenant_filings_period ON tenant_gstr_filings(tenant_id, period);

-- 7. Tenant ITC Reconciliation & GSTR-2B Records
CREATE TABLE IF NOT EXISTS tenant_itc_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vendor_name VARCHAR(255) NOT NULL,
    vendor_gstin VARCHAR(15) NOT NULL,
    invoice_number VARCHAR(64) NOT NULL,
    invoice_date DATE NOT NULL,
    invoice_value NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    itc_claimed NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    itc_in_2b NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    reconciliation_status VARCHAR(32) DEFAULT 'MATCHED', -- 'MATCHED', 'MISMATCH_VALUE', 'NOT_IN_2B', 'EXCESS_CLAIM'
    rule_applied VARCHAR(32) DEFAULT 'RULE_36_4',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tenant_itc_vendor ON tenant_itc_records(tenant_id, vendor_gstin);

-- 8. Cryptographic Tamper-Proof Audit Logs
CREATE TABLE IF NOT EXISTS tenant_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    action VARCHAR(64) NOT NULL,
    performed_by VARCHAR(255) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64),
    details JSONB,
    tamper_hash VARCHAR(128) NOT NULL,
    prev_hash VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_time ON tenant_audit_logs(tenant_id, created_at DESC);

-- ==============================================================================
-- POSTGRES ROW-LEVEL SECURITY (RLS) ENFORCEMENT
-- Policies guarantee that clients cannot inspect or modify other clients' records.
-- ==============================================================================

-- Enable RLS across all multi-tenant tables
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_gstin_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_gstr_filings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_itc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_audit_logs ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners to avoid accidental superuser bypass in queries
ALTER TABLE tenant_users FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_gstin_registrations FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_gstr_filings FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_itc_records FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_audit_logs FORCE ROW LEVEL SECURITY;

-- Drop existing policies if updating
DROP POLICY IF EXISTS tenant_isolation_users ON tenant_users;
DROP POLICY IF EXISTS tenant_isolation_gstins ON tenant_gstin_registrations;
DROP POLICY IF EXISTS tenant_isolation_invoices ON tenant_invoices;
DROP POLICY IF EXISTS tenant_isolation_filings ON tenant_gstr_filings;
DROP POLICY IF EXISTS tenant_isolation_itc ON tenant_itc_records;
DROP POLICY IF EXISTS tenant_isolation_audit ON tenant_audit_logs;

-- Policy 1: Tenant Users Isolation
CREATE POLICY tenant_isolation_users ON tenant_users
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

-- Policy 2: Tenant GSTIN Registrations Isolation
CREATE POLICY tenant_isolation_gstins ON tenant_gstin_registrations
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

-- Policy 3: Invoices Isolation
CREATE POLICY tenant_isolation_invoices ON tenant_invoices
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

-- Policy 4: Statutory Filings Isolation
CREATE POLICY tenant_isolation_filings ON tenant_gstr_filings
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

-- Policy 5: ITC Reconciliation Isolation
CREATE POLICY tenant_isolation_itc ON tenant_itc_records
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

-- Policy 6: Audit Logs Isolation
CREATE POLICY tenant_isolation_audit ON tenant_audit_logs
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

-- ==============================================================================
-- CONVENIENCE STORED PROCEDURES & SECURE TRANSACTION HELPERS
-- ==============================================================================

-- Function to set active tenant session context
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id VARCHAR)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', p_tenant_id, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active tenant session context
CREATE OR REPLACE FUNCTION get_current_tenant()
RETURNS VARCHAR AS $$
BEGIN
    RETURN current_setting('app.current_tenant_id', true);
END;
$$ LANGUAGE plpgsql STABLE;
`;
