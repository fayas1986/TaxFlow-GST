/**
 * Core Tenancy Types & Domain Interfaces
 * Strictly enforces multi-tenant boundaries across TaxFlow.
 */

export type TenantStatus = 
  | 'TRIAL' 
  | 'ACTIVE' 
  | 'PAST_DUE' 
  | 'SUSPENDED' 
  | 'CANCELLED' 
  | 'DELETED';

export type IsolationMode = 'ROW_LEVEL_SECURITY' | 'SCHEMA_ISOLATION';

export interface Tenant {
  id: string;
  legalName: string;
  tradeName?: string;
  slug?: string;
  subdomain?: string;
  customDomains?: string[];
  pan: string;
  sector: string;
  stateCode: string;
  stateName: string;
  status: TenantStatus;
  isolationMode: IsolationMode;
  complianceScore: number;
  annualTurnover: number;
  retentionPeriodDays: number;
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantUserMembership {
  id: string;
  tenantId: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  isReadOnly: boolean;
  assignedGstinIds: string[] | 'ALL';
  assignedBranchIds: string[] | 'ALL';
  joinedAt: string;
}

export interface TenantGstin {
  id: string;
  tenantId: string;
  gstin: string;
  stateCode: string;
  stateName: string;
  registrationType: 'REGULAR' | 'COMPOSITION' | 'SEZ_UNIT' | 'ISD';
  einvoiceEnabled: boolean;
  ewaybillEnabled: boolean;
  isPrimary: boolean;
  status: 'ACTIVE' | 'CANCELLED' | 'SUSPENDED';
  providerConfig?: {
    gspUsername?: string;
    gspPasswordMasked?: string;
    clientId?: string;
    clientSecretMasked?: string;
    authExpiry?: string;
    lastSyncedAt?: string;
  };
  createdAt: string;
}

export interface TenantBranch {
  id: string;
  tenantId: string;
  gstinId: string;
  branchCode: string;
  branchName: string;
  city: string;
  stateCode: string;
  isHeadOffice: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface TenantContext {
  tenantId: string;
  userId: string;
  userEmail: string;
  role: string;
  plan: string;
  permissions: string[];
  assignedGstinIds?: string[] | 'ALL';
  assignedBranchIds?: string[] | 'ALL';
  isReadOnly?: boolean;
  apiToken?: string;
  membershipId?: string;
  isPlatformSuperAdmin?: boolean;
}

export interface CreateTenantParams {
  legalName: string;
  tradeName?: string;
  slug?: string;
  subdomain?: string;
  customDomains?: string[];
  pan: string;
  sector?: string;
  stateCode: string;
  stateName?: string;
  planCode?: string;
  billingCycle?: 'MONTHLY' | 'ANNUAL';
  creatorUserId?: string;
  creatorEmail?: string;
  creatorName?: string;
  primaryGstin?: string;
  primaryBranchName?: string;
  city?: string;
}
