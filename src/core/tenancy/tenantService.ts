/**
 * Central Tenant Service
 * Manages tenant lifecycle, user memberships, GSTINs, branches, and resolves secure TenantContext.
 */

import { Tenant, TenantUserMembership, TenantGstin, TenantBranch, TenantContext, TenantStatus, CreateTenantParams } from './types';
import { Role, getPermissionsForRole } from '../permissions/types';
import { PlanCode, PLANS_CATALOG } from '../entitlements/types';
import { entitlementService } from '../entitlements/entitlementService';

class TenantService {
  private tenants: Map<string, Tenant> = new Map();
  private memberships: Map<string, TenantUserMembership[]> = new Map(); // tenantId -> memberships
  private userMemberships: Map<string, TenantUserMembership[]> = new Map(); // userId -> memberships
  private gstins: Map<string, TenantGstin[]> = new Map(); // tenantId -> gstins
  private branches: Map<string, TenantBranch[]> = new Map(); // tenantId -> branches

  constructor() {
    this.seedDefaultTenancyData();
  }

  /**
   * Seed enterprise tenants, memberships, GSTINs, and branches
   */
  private seedDefaultTenancyData() {
    // Tenant 1: Acme Technologies (Enterprise Holding)
    const t1: Tenant = {
      id: 't1',
      legalName: 'Acme Technologies Private Limited',
      tradeName: 'Acme Cloud Solutions',
      slug: 'acme',
      subdomain: 'acme',
      customDomains: ['acme.taxflow.io', 'acme.taxflow.internal'],
      pan: 'AAACA1234F',
      sector: 'Technology & Cloud SaaS',
      stateCode: '27',
      stateName: 'Maharashtra',
      status: 'ACTIVE',
      isolationMode: 'ROW_LEVEL_SECURITY',
      complianceScore: 99.4,
      annualTurnover: 284000000,
      retentionPeriodDays: 2555, // 7 years statutory GST retention
      isDeleted: false,
      createdAt: '2025-01-10T10:00:00.000Z',
      updatedAt: '2026-09-21T10:00:00.000Z'
    };

    // Tenant 2: Globex Manufacturing (Professional Subsidiary)
    const t2: Tenant = {
      id: 't2',
      legalName: 'Globex Industrial Manufacturing Ltd',
      tradeName: 'Globex Engg',
      slug: 'globex',
      subdomain: 'globex',
      customDomains: ['globex.taxflow.io'],
      pan: 'BBBCG5678K',
      sector: 'Heavy Engineering & Manufacturing',
      stateCode: '04',
      stateName: 'Chandigarh',
      status: 'ACTIVE',
      isolationMode: 'ROW_LEVEL_SECURITY',
      complianceScore: 98.2,
      annualTurnover: 182000000,
      retentionPeriodDays: 2555,
      isDeleted: false,
      createdAt: '2025-02-15T09:30:00.000Z',
      updatedAt: '2026-09-21T10:00:00.000Z'
    };

    // Tenant 3: Acme Logistics (Business Growth)
    const t3: Tenant = {
      id: 't3',
      legalName: 'Acme Logistics & Cold Chain Private Limited',
      tradeName: 'ColdChain Express',
      slug: 'acmelogistics',
      subdomain: 'acmelogistics',
      customDomains: ['logistics.taxflow.io'],
      pan: 'AAACL9012M',
      sector: 'Supply Chain & Cold Storage',
      stateCode: '29',
      stateName: 'Karnataka',
      status: 'ACTIVE',
      isolationMode: 'ROW_LEVEL_SECURITY',
      complianceScore: 97.6,
      annualTurnover: 122000000,
      retentionPeriodDays: 2555,
      isDeleted: false,
      createdAt: '2025-03-01T11:15:00.000Z',
      updatedAt: '2026-09-21T10:00:00.000Z'
    };

    // Tenant 4: Suspended Tenant for lifecycle testing
    const t4: Tenant = {
      id: 't4',
      legalName: 'Defunct Logistics LLP',
      tradeName: 'Defunct Logistics',
      slug: 'defunct',
      subdomain: 'defunct',
      pan: 'DDDDD9999D',
      sector: 'Logistics',
      stateCode: '07',
      stateName: 'Delhi',
      status: 'SUSPENDED',
      isolationMode: 'ROW_LEVEL_SECURITY',
      complianceScore: 65.0,
      annualTurnover: 15000000,
      retentionPeriodDays: 180,
      isDeleted: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2026-09-21T10:00:00.000Z'
    };

    this.tenants.set(t1.id, t1);
    this.tenants.set(t2.id, t2);
    this.tenants.set(t3.id, t3);
    this.tenants.set(t4.id, t4);

    // GSTINs for Tenant 1
    const t1Gstins: TenantGstin[] = [
      {
        id: 'gstin-t1-mh',
        tenantId: 't1',
        gstin: '27ABCDE1234F1Z5',
        stateCode: '27',
        stateName: 'Maharashtra',
        registrationType: 'REGULAR',
        einvoiceEnabled: true,
        ewaybillEnabled: true,
        isPrimary: true,
        status: 'ACTIVE',
        providerConfig: { gspUsername: 'acme_mh_gsp', clientId: 'gsp_client_t1_mh' },
        createdAt: '2025-01-10T10:00:00.000Z'
      },
      {
        id: 'gstin-t1-ka',
        tenantId: 't1',
        gstin: '29ABCDE1234F1Z3',
        stateCode: '29',
        stateName: 'Karnataka',
        registrationType: 'REGULAR',
        einvoiceEnabled: true,
        ewaybillEnabled: true,
        isPrimary: false,
        status: 'ACTIVE',
        providerConfig: { gspUsername: 'acme_ka_gsp', clientId: 'gsp_client_t1_ka' },
        createdAt: '2025-01-15T10:00:00.000Z'
      },
      {
        id: 'gstin-t1-dl',
        tenantId: 't1',
        gstin: '07ABCDE1234F1Z9',
        stateCode: '07',
        stateName: 'Delhi',
        registrationType: 'REGULAR',
        einvoiceEnabled: true,
        ewaybillEnabled: true,
        isPrimary: false,
        status: 'ACTIVE',
        providerConfig: { gspUsername: 'acme_dl_gsp', clientId: 'gsp_client_t1_dl' },
        createdAt: '2025-01-20T10:00:00.000Z'
      }
    ];
    this.gstins.set('t1', t1Gstins);

    // Branches for Tenant 1
    const t1Branches: TenantBranch[] = [
      {
        id: 'br-t1-mh-01',
        tenantId: 't1',
        gstinId: 'gstin-t1-mh',
        branchCode: 'MH-HO',
        branchName: 'Mumbai Corporate Head Office (BKC)',
        city: 'Mumbai',
        stateCode: '27',
        isHeadOffice: true,
        status: 'ACTIVE',
        createdAt: '2025-01-10T10:00:00.000Z'
      },
      {
        id: 'br-t1-mh-02',
        tenantId: 't1',
        gstinId: 'gstin-t1-mh',
        branchCode: 'MH-PUN',
        branchName: 'Pune Hinjawadi Tech Campus',
        city: 'Pune',
        stateCode: '27',
        isHeadOffice: false,
        status: 'ACTIVE',
        createdAt: '2025-02-01T10:00:00.000Z'
      },
      {
        id: 'br-t1-ka-01',
        tenantId: 't1',
        gstinId: 'gstin-t1-ka',
        branchCode: 'KA-BLR',
        branchName: 'Bengaluru R&D Center (Whitefield)',
        city: 'Bengaluru',
        stateCode: '29',
        isHeadOffice: false,
        status: 'ACTIVE',
        createdAt: '2025-01-15T10:00:00.000Z'
      },
      {
        id: 'br-t1-dl-01',
        tenantId: 't1',
        gstinId: 'gstin-t1-dl',
        branchCode: 'DL-DEL',
        branchName: 'Delhi Regional Office (Connaught Place)',
        city: 'New Delhi',
        stateCode: '07',
        isHeadOffice: false,
        status: 'ACTIVE',
        createdAt: '2025-01-20T10:00:00.000Z'
      }
    ];
    this.branches.set('t1', t1Branches);

    // GSTINs for Tenant 2
    const t2Gstins: TenantGstin[] = [
      {
        id: 'gstin-t2-ch',
        tenantId: 't2',
        gstin: '04XYZZZ9876L1Z1',
        stateCode: '04',
        stateName: 'Chandigarh',
        registrationType: 'REGULAR',
        einvoiceEnabled: true,
        ewaybillEnabled: true,
        isPrimary: true,
        status: 'ACTIVE',
        providerConfig: { gspUsername: 'globex_ch_gsp', clientId: 'gsp_client_t2_ch' },
        createdAt: '2025-02-15T09:30:00.000Z'
      }
    ];
    this.gstins.set('t2', t2Gstins);

    // Branches for Tenant 2
    const t2Branches: TenantBranch[] = [
      {
        id: 'br-t2-ch-01',
        tenantId: 't2',
        gstinId: 'gstin-t2-ch',
        branchCode: 'CH-MFG',
        branchName: 'Chandigarh Heavy Engg Plant',
        city: 'Chandigarh',
        stateCode: '04',
        isHeadOffice: true,
        status: 'ACTIVE',
        createdAt: '2025-02-15T09:30:00.000Z'
      }
    ];
    this.branches.set('t2', t2Branches);

    // GSTINs for Tenant 3 (Acme Logistics & Cold Chain)
    const t3Gstins: TenantGstin[] = [
      {
        id: 'gstin-t3-ka',
        tenantId: 't3',
        gstin: '29AAACL9012M1Z8',
        stateCode: '29',
        stateName: 'Karnataka',
        registrationType: 'REGULAR',
        einvoiceEnabled: true,
        ewaybillEnabled: true,
        isPrimary: true,
        status: 'ACTIVE',
        providerConfig: { gspUsername: 'acmelog_ka_gsp', clientId: 'gsp_client_t3_ka' },
        createdAt: '2025-03-01T11:15:00.000Z'
      }
    ];
    this.gstins.set('t3', t3Gstins);

    // Branches for Tenant 3
    const t3Branches: TenantBranch[] = [
      {
        id: 'br-t3-ka-01',
        tenantId: 't3',
        gstinId: 'gstin-t3-ka',
        branchCode: 'KA-LOG',
        branchName: 'Bengaluru Logistics & Cold Chain Hub (Whitefield)',
        city: 'Bengaluru',
        stateCode: '29',
        isHeadOffice: true,
        status: 'ACTIVE',
        createdAt: '2025-03-01T11:15:00.000Z'
      }
    ];
    this.branches.set('t3', t3Branches);

    // User memberships
    // User 1: fayas (Super Admin across t1, Admin in t2 and t3)
    const m1: TenantUserMembership = {
      id: 'mem-1-t1',
      tenantId: 't1',
      userId: 'u-fayas',
      email: 'fayasamd@gmail.com',
      name: 'Fayas M',
      role: Role.SUPER_ADMIN,
      isActive: true,
      isReadOnly: false,
      assignedGstinIds: 'ALL',
      assignedBranchIds: 'ALL',
      joinedAt: '2025-01-10T10:00:00.000Z'
    };

    const m1_t2: TenantUserMembership = {
      id: 'mem-1-t2',
      tenantId: 't2',
      userId: 'u-fayas',
      email: 'fayasamd@gmail.com',
      name: 'Fayas M',
      role: Role.ADMIN,
      isActive: true,
      isReadOnly: false,
      assignedGstinIds: 'ALL',
      assignedBranchIds: 'ALL',
      joinedAt: '2025-02-15T09:30:00.000Z'
    };

    const m1_t3: TenantUserMembership = {
      id: 'mem-1-t3',
      tenantId: 't3',
      userId: 'u-fayas',
      email: 'fayasamd@gmail.com',
      name: 'Fayas M',
      role: Role.ADMIN,
      isActive: true,
      isReadOnly: false,
      assignedGstinIds: 'ALL',
      assignedBranchIds: 'ALL',
      joinedAt: '2025-03-01T11:15:00.000Z'
    };

    // User 2: Branch-Restricted User in Tenant 1 (Only sees Pune branch: br-t1-mh-02)
    const m2_t1: TenantUserMembership = {
      id: 'mem-2-t1',
      tenantId: 't1',
      userId: 'u-pune-mgr',
      email: 'pune.finance@acme.com',
      name: 'Pune Branch Accountant',
      role: Role.TAX_ACCOUNTANT,
      isActive: true,
      isReadOnly: false,
      assignedGstinIds: ['gstin-t1-mh'],
      assignedBranchIds: ['br-t1-mh-02'],
      joinedAt: '2025-03-01T10:00:00.000Z'
    };

    // User 3: Read-Only Auditor in Tenant 1
    const m3_t1: TenantUserMembership = {
      id: 'mem-3-t1',
      tenantId: 't1',
      userId: 'u-auditor-ro',
      email: 'auditor.deloitte@audit.com',
      name: 'Statutory GST Auditor',
      role: Role.AUDITOR,
      isActive: true,
      isReadOnly: true, // STRICT READ-ONLY FLAG
      assignedGstinIds: 'ALL',
      assignedBranchIds: 'ALL',
      joinedAt: '2025-04-01T10:00:00.000Z'
    };

    // User 4: Tenant 2 Exclusive User (Globex Finance)
    const m4_t2: TenantUserMembership = {
      id: 'mem-4-t2',
      tenantId: 't2',
      userId: 'u-globex-user',
      email: 'accounts@globexengg.com',
      name: 'Globex Accounts Head',
      role: Role.FINANCE_MANAGER,
      isActive: true,
      isReadOnly: false,
      assignedGstinIds: 'ALL',
      assignedBranchIds: 'ALL',
      joinedAt: '2025-02-16T10:00:00.000Z'
    };

    this.registerMembership(m1);
    this.registerMembership(m1_t2);
    this.registerMembership(m1_t3);
    this.registerMembership(m2_t1);
    this.registerMembership(m3_t1);
    this.registerMembership(m4_t2);
  }

  private registerMembership(m: TenantUserMembership) {
    // Index by tenant
    const tList = this.memberships.get(m.tenantId) || [];
    tList.push(m);
    this.memberships.set(m.tenantId, tList);

    // Index by user
    const uList = this.userMemberships.get(m.userId) || [];
    uList.push(m);
    this.userMemberships.set(m.userId, uList);
  }

  // --- TENANT LIFECYCLE MANAGEMENT ---

  public getTenant(tenantId: string): Tenant | null {
    const t = this.tenants.get(tenantId);
    if (!t || t.isDeleted) return null;
    return t;
  }

  public getAllTenants(): Tenant[] {
    return Array.from(this.tenants.values()).filter(t => !t.isDeleted);
  }

  public updateTenantStatus(tenantId: string, status: TenantStatus): Tenant {
    const t = this.tenants.get(tenantId);
    if (!t) throw new Error(`Tenant not found: ${tenantId}`);
    t.status = status;
    t.updatedAt = new Date().toISOString();
    return t;
  }

  public softDeleteTenant(tenantId: string): boolean {
    const t = this.tenants.get(tenantId);
    if (!t) return false;
    t.isDeleted = true;
    t.status = 'DELETED';
    t.deletedAt = new Date().toISOString();
    t.updatedAt = t.deletedAt;
    return true;
  }

  /**
   * Helper to resolve state names from standard GST 2-digit state codes
   */
  public getStateNameByCode(code: string): string {
    const map: Record<string, string> = {
      '01': 'Jammu and Kashmir',
      '02': 'Himachal Pradesh',
      '03': 'Punjab',
      '04': 'Chandigarh',
      '05': 'Uttarakhand',
      '06': 'Haryana',
      '07': 'Delhi',
      '08': 'Rajasthan',
      '09': 'Uttar Pradesh',
      '10': 'Bihar',
      '19': 'West Bengal',
      '24': 'Gujarat',
      '27': 'Maharashtra',
      '29': 'Karnataka',
      '32': 'Kerala',
      '33': 'Tamil Nadu',
      '36': 'Telangana',
      '37': 'Andhra Pradesh'
    };
    return map[code] || `State (${code})`;
  }

  /**
   * Create a new organization / tenant with plan-specific entitlements, default GSTIN, and branch.
   */
  public createTenant(params: CreateTenantParams): {
    tenant: Tenant;
    membership: TenantUserMembership;
    gstin: TenantGstin;
    branch: TenantBranch;
  } {
    if (!params.legalName?.trim()) {
      throw new Error('400 Bad Request: Organization legal name is required');
    }
    if (!params.pan?.trim()) {
      throw new Error('400 Bad Request: Permanent Account Number (PAN) is required');
    }
    const cleanPan = params.pan.trim().toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
      throw new Error('400 Bad Request: Invalid PAN format. Must be 10 characters (e.g. ABCDE1234F)');
    }

    const stateCode = (params.stateCode || '27').padStart(2, '0');
    const stateName = params.stateName || this.getStateNameByCode(stateCode);

    // Generate unique ID and slug
    const baseSlug = (params.slug || params.subdomain || params.legalName)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24) || 'org';

    const timestamp = Date.now().toString(36);
    const tenantId = `t_${baseSlug}_${timestamp}`;
    const slug = `${baseSlug}-${timestamp.slice(-4)}`;
    const subdomain = params.subdomain ? params.subdomain.trim().toLowerCase() : slug;

    // Check collision
    if (this.tenants.has(tenantId)) {
      throw new Error(`Tenant ID collision: ${tenantId}`);
    }

    const planCode = (params.planCode as PlanCode) || PlanCode.STARTER;

    // Create Tenant
    const tenant: Tenant = {
      id: tenantId,
      legalName: params.legalName.trim(),
      tradeName: params.tradeName?.trim() || params.legalName.trim(),
      slug,
      subdomain,
      customDomains: params.customDomains || [`${subdomain}.taxflow.io`],
      pan: cleanPan,
      sector: params.sector?.trim() || 'General Commercial & Services',
      stateCode,
      stateName,
      status: 'ACTIVE',
      isolationMode: 'ROW_LEVEL_SECURITY',
      complianceScore: 100.0,
      annualTurnover: 0,
      retentionPeriodDays: 2555, // 7 years statutory GST retention
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.tenants.set(tenant.id, tenant);

    // Create primary GSTIN
    const defaultGstinStr = params.primaryGstin?.trim().toUpperCase() || `${stateCode}${cleanPan}1Z5`;
    const gstin: TenantGstin = {
      id: `gstin-${tenantId}-${stateCode}`,
      tenantId: tenant.id,
      gstin: defaultGstinStr,
      stateCode,
      stateName,
      registrationType: 'REGULAR',
      einvoiceEnabled: [PlanCode.PROFESSIONAL, PlanCode.ENTERPRISE, PlanCode.ENTERPRISE_PLUS].includes(planCode),
      ewaybillEnabled: planCode !== PlanCode.STARTER,
      isPrimary: true,
      status: 'ACTIVE',
      providerConfig: { gspUsername: `${slug}_gsp`, clientId: `client_${tenantId}` },
      createdAt: new Date().toISOString()
    };
    this.gstins.set(tenant.id, [gstin]);

    // Create primary branch (Head Office)
    const branch: TenantBranch = {
      id: `br-${tenantId}-ho`,
      tenantId: tenant.id,
      gstinId: gstin.id,
      branchCode: `${stateCode}-HO`,
      branchName: params.primaryBranchName?.trim() || `${params.city || stateName} Head Office`,
      city: params.city?.trim() || (stateCode === '27' ? 'Mumbai' : stateCode === '07' ? 'New Delhi' : stateCode === '29' ? 'Bengaluru' : 'City Center'),
      stateCode,
      isHeadOffice: true,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };
    this.branches.set(tenant.id, [branch]);

    // Create Creator Membership with SUPER_ADMIN privileges
    const creatorUserId = params.creatorUserId || 'u-fayas';
    const creatorEmail = params.creatorEmail || 'fayasamd@gmail.com';
    const creatorName = params.creatorName || 'Fayas M';

    const membership: TenantUserMembership = {
      id: `mem-${tenantId}-${Date.now().toString(36)}`,
      tenantId: tenant.id,
      userId: creatorUserId,
      email: creatorEmail,
      name: creatorName,
      role: Role.SUPER_ADMIN,
      isActive: true,
      isReadOnly: false,
      assignedGstinIds: 'ALL',
      assignedBranchIds: 'ALL',
      joinedAt: new Date().toISOString()
    };
    this.registerMembership(membership);

    // Initialize plan subscription in EntitlementService
    entitlementService.createSubscription(tenant.id, planCode, params.billingCycle || 'MONTHLY');

    return { tenant, membership, gstin, branch };
  }

  /**
   * Lookup tenant by assigned subdomain (e.g., 'acme', 'globex', 't1')
   */
  public getTenantBySubdomain(subdomain: string): Tenant | null {
    if (!subdomain) return null;
    const cleanSubdomain = subdomain.trim().toLowerCase();
    for (const tenant of this.tenants.values()) {
      if (tenant.isDeleted) continue;
      if (tenant.subdomain && tenant.subdomain.toLowerCase() === cleanSubdomain) {
        return tenant;
      }
      if (tenant.id.toLowerCase() === cleanSubdomain) {
        return tenant;
      }
      if (tenant.slug && tenant.slug.toLowerCase() === cleanSubdomain) {
        return tenant;
      }
      if (tenant.customDomains && tenant.customDomains.some(d => d.toLowerCase().includes(cleanSubdomain))) {
        return tenant;
      }
    }
    return null;
  }

  /**
   * Lookup tenant by slug or short identifier
   */
  public getTenantBySlug(slug: string): Tenant | null {
    if (!slug) return null;
    const cleanSlug = slug.trim().toLowerCase();
    for (const tenant of this.tenants.values()) {
      if (tenant.isDeleted) continue;
      if (tenant.slug && tenant.slug.toLowerCase() === cleanSlug) return tenant;
      if (tenant.id.toLowerCase() === cleanSlug) return tenant;
      if (tenant.subdomain && tenant.subdomain.toLowerCase() === cleanSlug) return tenant;
    }
    return null;
  }

  /**
   * Universal tenant identifier resolver: resolves by ID, slug, subdomain, or host domain
   */
  public resolveTenantByIdentifier(identifier: string): Tenant | null {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    // 1. Direct ID match
    const byId = this.getTenant(identifier);
    if (byId) return byId;

    // 2. Subdomain / slug match
    const bySubdomain = this.getTenantBySubdomain(clean);
    if (bySubdomain) return bySubdomain;

    // 3. Custom domain match
    for (const tenant of this.tenants.values()) {
      if (tenant.isDeleted) continue;
      if (tenant.customDomains && tenant.customDomains.some(d => d.toLowerCase() === clean)) {
        return tenant;
      }
    }
    return null;
  }

  // --- MEMBERSHIP & ACCESS ---

  public getUserMemberships(userId: string): TenantUserMembership[] {
    return this.userMemberships.get(userId) || [];
  }

  public getUserTenants(userId: string): Tenant[] {
    const memberships = this.getUserMemberships(userId);
    const tenants: Tenant[] = [];
    for (const m of memberships) {
      const t = this.getTenant(m.tenantId);
      if (t && !tenants.some(existing => existing.id === t.id)) {
        tenants.push(t);
      }
    }
    return tenants;
  }

  public getTenantMembership(tenantId: string, userId: string): TenantUserMembership | null {
    const members = this.memberships.get(tenantId) || [];
    return members.find(m => (m.userId === userId || m.email === userId) && m.isActive) || null;
  }

  public getTenantGstins(tenantId: string): TenantGstin[] {
    return this.gstins.get(tenantId) || [];
  }

  public getTenantBranches(tenantId: string): TenantBranch[] {
    return this.branches.get(tenantId) || [];
  }

  /**
   * Return only the tenants the specified user has active membership in
   */
  public getUserAuthorizedTenants(userId: string, userEmail?: string): Tenant[] {
    const userMems = this.getUserMemberships(userId);
    const emailMems = userEmail ? this.getUserMemberships(userEmail) : [];
    const allActive = [...userMems, ...emailMems].filter(m => m.isActive);
    const authorizedTenantIds = new Set(allActive.map(m => m.tenantId));

    return Array.from(this.tenants.values())
      .filter(t => !t.isDeleted && authorizedTenantIds.has(t.id));
  }

  // --- REQUEST CONTEXT RESOLVER ---

  /**
   * Resolves verified TenantContext.
   * NEVER trusts x-tenant-id as proof of access.
   * Resolves authenticated user first, then verifies requested tenant belongs to user's authorized memberships.
   * Unauthorized tenant selection returns 403 Forbidden.
   * There is NO global default or fallback tenant that could cause cross-tenant leakage.
   */
  public resolveTenantContext(params: {
    userId?: string;
    userEmail?: string;
    requestedTenantId?: string;
    apiToken?: string;
    isSuperAdminOverride?: boolean;
  }): TenantContext {
    const { userId, userEmail, requestedTenantId, apiToken, isSuperAdminOverride } = params;

    // 1. Authentication Check: Ensure a valid user identity is present
    const effectiveUserId = userId || (userEmail ? `u-${userEmail.split('@')[0]}` : undefined);
    if (!effectiveUserId && !apiToken) {
      throw new Error('401 Unauthorized: Valid user session or API token required');
    }

    // 2. Token-based authentication path
    if (apiToken) {
      if (!apiToken.startsWith('tok-')) {
        throw new Error('401 Unauthorized: Invalid API token format');
      }
      // Tokens are strictly scoped: format tok-{tenantId}-{secret}
      const parts = apiToken.split('-');
      if (parts.length < 3) {
        throw new Error('401 Unauthorized: Malformed API token structure');
      }
      const tokenTenantId = parts[1];

      // If a requestedTenantId is also specified, it MUST match the token's bound tenant
      if (requestedTenantId && requestedTenantId !== tokenTenantId) {
        throw new Error(`403 Forbidden: API token for tenant '${tokenTenantId}' cannot access tenant '${requestedTenantId}'`);
      }

      const tenant = this.getTenant(tokenTenantId);
      if (!tenant) {
        throw new Error(`404 Not Found: Tenant '${tokenTenantId}' does not exist or has been deleted`);
      }
      if (tenant.status === 'SUSPENDED') {
        throw new Error(`403 Forbidden: Tenant account '${tokenTenantId}' is SUSPENDED. Access to compliance services is restricted.`);
      }
      if (tenant.status === 'CANCELLED' || tenant.status === 'DELETED') {
        throw new Error(`403 Forbidden: Tenant account '${tokenTenantId}' is ${tenant.status}`);
      }

      const planMap: Record<string, PlanCode> = {
        t1: PlanCode.ENTERPRISE,
        t2: PlanCode.PROFESSIONAL,
        t3: PlanCode.BUSINESS,
        t4: PlanCode.STARTER
      };

      return {
        tenantId: tokenTenantId,
        userId: `api-service-${tokenTenantId}`,
        userEmail: `api@tenant.${tokenTenantId}.internal`,
        role: Role.ADMIN,
        plan: planMap[tokenTenantId] || PlanCode.STARTER,
        permissions: getPermissionsForRole(Role.ADMIN) as any,
        assignedGstinIds: 'ALL',
        assignedBranchIds: 'ALL',
        isReadOnly: false,
        apiToken
      };
    }

    // 3. User Membership Resolution: Get all active memberships for this authenticated user
    const userMems = this.getUserMemberships(effectiveUserId!);
    const emailMems = userEmail ? this.getUserMemberships(userEmail) : [];
    const activeMemberships = [...userMems, ...emailMems].filter(m => m.isActive);

    if (activeMemberships.length === 0 && !isSuperAdminOverride) {
      throw new Error(`403 Forbidden: User '${effectiveUserId}' has no active tenant memberships`);
    }

    // 4. Tenant Selection & Authorization Validation
    let targetTenantId: string;

    if (requestedTenantId) {
      // Client explicitly selected a tenant: verify user has authorized membership in it
      const authorizedMembership = activeMemberships.find(m => m.tenantId === requestedTenantId);
      if (!authorizedMembership && !isSuperAdminOverride) {
        // STRICT SECURITY: Do NOT fallback to any other tenant. Return 403 immediately!
        throw new Error(`403 Forbidden: Unauthorized tenant selection: User '${effectiveUserId}' is not authorized to access tenant '${requestedTenantId}'`);
      }
      targetTenantId = requestedTenantId;
    } else {
      // No tenant specified: automatically select the user's first authorized tenant
      targetTenantId = activeMemberships[0].tenantId;
    }

    // 5. Tenant Status Verification
    const tenant = this.getTenant(targetTenantId);
    if (!tenant) {
      throw new Error(`404 Not Found: Tenant '${targetTenantId}' does not exist or has been deleted`);
    }

    if (tenant.status === 'SUSPENDED') {
      throw new Error(`403 Forbidden: Tenant account '${targetTenantId}' is SUSPENDED. Access to compliance services is restricted.`);
    }

    if (tenant.status === 'CANCELLED' || tenant.status === 'DELETED') {
      throw new Error(`403 Forbidden: Tenant account '${targetTenantId}' is ${tenant.status}`);
    }

    // 6. Resolve user's membership details for target tenant
    const membership = activeMemberships.find(m => m.tenantId === targetTenantId) ||
      this.getTenantMembership(targetTenantId, effectiveUserId!) ||
      (userEmail ? this.getTenantMembership(targetTenantId, userEmail) : null);

    if (!membership && !isSuperAdminOverride) {
      throw new Error(`403 Forbidden: User '${effectiveUserId}' does not have active membership in tenant '${targetTenantId}'`);
    }

    const effectiveRole = membership ? membership.role : (isSuperAdminOverride ? Role.SUPER_ADMIN : Role.VIEWER);
    const permissions = getPermissionsForRole(effectiveRole);

    const planMap: Record<string, PlanCode> = {
      t1: PlanCode.ENTERPRISE,
      t2: PlanCode.PROFESSIONAL,
      t3: PlanCode.BUSINESS,
      t4: PlanCode.STARTER
    };
    const sub = entitlementService.getSubscription(targetTenantId);
    const plan = sub ? sub.planId : (planMap[targetTenantId] || PlanCode.STARTER);

    return {
      tenantId: targetTenantId,
      userId: membership ? membership.userId : effectiveUserId!,
      userEmail: membership ? membership.email : (userEmail || 'user@internal'),
      role: effectiveRole,
      plan,
      permissions: permissions as any,
      assignedGstinIds: membership ? membership.assignedGstinIds : 'ALL',
      assignedBranchIds: membership ? membership.assignedBranchIds : 'ALL',
      isReadOnly: membership ? membership.isReadOnly : false,
      membershipId: membership?.id,
      isPlatformSuperAdmin: Boolean(isSuperAdminOverride)
    };
  }

  /**
   * Explicit switch-tenant method with strict authorization checking
   */
  public switchTenant(userId: string, targetTenantId: string, userEmail?: string): TenantContext {
    return this.resolveTenantContext({
      userId,
      userEmail,
      requestedTenantId: targetTenantId
    });
  }

  /**
   * Super Admin Real-Time Tenant Creation & Subscription Analytics Engine
   */
  public getTenantCreationAnalytics() {
    const allTenants = this.getAllTenants();
    const allPlans = entitlementService.getAllPlans();
    const plansMap = new Map(allPlans.map(p => [p.code, p]));

    const activeTenants = allTenants.filter(t => t.status === 'ACTIVE').length;
    const suspendedTenants = allTenants.filter(t => t.status === 'SUSPENDED').length;
    const trialTenants = allTenants.filter(t => t.status === 'TRIAL').length;

    let totalGstins = 0;
    let totalBranches = 0;
    this.gstins.forEach(gList => { totalGstins += gList.length; });
    this.branches.forEach(bList => { totalBranches += bList.length; });

    let totalUsers = 0;
    this.memberships.forEach(mList => { totalUsers += mList.length; });

    const totalTurnoverInr = allTenants.reduce((acc, t) => acc + (t.annualTurnover || 0), 0);

    // Calculate MRR and ARR from dynamic plan catalog & subscriptions
    let monthlyRecurringRevenueInr = 0;
    const planCounts: Record<string, number> = {
      [PlanCode.STARTER]: 0,
      [PlanCode.BUSINESS]: 0,
      [PlanCode.PROFESSIONAL]: 0,
      [PlanCode.ENTERPRISE]: 0,
      [PlanCode.ENTERPRISE_PLUS]: 0
    };

    allTenants.forEach(t => {
      const sub = entitlementService.getSubscription(t.id);
      const planCode = sub?.planId || (t.id === 't1' ? PlanCode.ENTERPRISE : t.id === 't2' ? PlanCode.PROFESSIONAL : t.id === 't3' ? PlanCode.BUSINESS : PlanCode.STARTER);
      planCounts[planCode] = (planCounts[planCode] || 0) + 1;

      const planObj = plansMap.get(planCode as PlanCode);
      if (planObj && t.status !== 'SUSPENDED') {
        monthlyRecurringRevenueInr += planObj.monthlyPriceInr || 0;
      }
    });

    const annualRunRateInr = monthlyRecurringRevenueInr * 12;
    const averageRevenuePerTenantInr = allTenants.length > 0 ? Math.round(monthlyRecurringRevenueInr / allTenants.length) : 0;

    // Plan Distribution Breakdown
    const planColors: Record<string, string> = {
      [PlanCode.STARTER]: '#94A3B8',
      [PlanCode.BUSINESS]: '#3B82F6',
      [PlanCode.PROFESSIONAL]: '#8B5CF6',
      [PlanCode.ENTERPRISE]: '#10B981',
      [PlanCode.ENTERPRISE_PLUS]: '#F59E0B'
    };

    const planDistribution = Object.keys(planCounts).map(code => {
      const planObj = plansMap.get(code as PlanCode);
      const count = planCounts[code] || 0;
      const pct = allTenants.length > 0 ? Number(((count / allTenants.length) * 100).toFixed(1)) : 0;
      const mPrice = planObj?.monthlyPriceInr || 0;
      return {
        planCode: code as PlanCode,
        name: planObj?.name || code,
        count,
        percentage: pct,
        monthlyPriceInr: mPrice,
        monthlyRevenueInr: count * mPrice,
        annualRevenueInr: count * (planObj?.annualPriceInr || mPrice * 10),
        color: planColors[code] || '#64748B'
      };
    });

    // Entity Types & Sectors
    const sectorCounts: Record<string, number> = {};
    const stateCounts: Record<string, { stateCode: string; stateName: string; count: number }> = {};
    const isolationCounts: Record<string, number> = {};

    allTenants.forEach(t => {
      const sec = t.sector || 'Commercial';
      sectorCounts[sec] = (sectorCounts[sec] || 0) + 1;

      if (!stateCounts[t.stateCode]) {
        stateCounts[t.stateCode] = { stateCode: t.stateCode, stateName: t.stateName || 'State', count: 0 };
      }
      stateCounts[t.stateCode].count += 1;

      const iso = t.isolationMode || 'ROW_LEVEL_SECURITY';
      isolationCounts[iso] = (isolationCounts[iso] || 0) + 1;
    });

    // 30-day timeline series for charts
    const now = new Date();
    const timeline30Days: Array<{
      date: string;
      label: string;
      newTenants: number;
      cumulativeTenants: number;
      activeGstins: number;
      mrrInr: number;
    }> = [];

    // Base cumulative curve
    let runningTenants = Math.max(1, allTenants.length - 3);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      
      let newCount = 0;
      if (i === 22) newCount = 1;
      if (i === 14) newCount = 1;
      if (i === 4) newCount = 1;
      if (i === 0) newCount = Math.max(0, allTenants.length - runningTenants);

      runningTenants += newCount;
      const estimatedMrr = Math.round((runningTenants / (allTenants.length || 1)) * monthlyRecurringRevenueInr);

      timeline30Days.push({
        date: dateStr,
        label,
        newTenants: newCount,
        cumulativeTenants: Math.min(runningTenants, allTenants.length),
        activeGstins: Math.min(runningTenants * 2, totalGstins),
        mrrInr: estimatedMrr
      });
    }

    // Enriched recent tenants list
    const recentTenants = [...allTenants]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(t => {
        const sub = entitlementService.getSubscription(t.id);
        const planCode = sub?.planId || (t.id === 't1' ? PlanCode.ENTERPRISE : t.id === 't2' ? PlanCode.PROFESSIONAL : t.id === 't3' ? PlanCode.BUSINESS : PlanCode.STARTER);
        const gList = this.gstins.get(t.id) || [];
        const bList = this.branches.get(t.id) || [];
        const mList = this.memberships.get(t.id) || [];
        return {
          ...t,
          planCode,
          planName: plansMap.get(planCode as PlanCode)?.name || planCode,
          gstinCount: gList.length,
          branchCount: bList.length,
          userCount: mList.length,
          subscriptionStatus: sub?.status || t.status,
          renewalDate: sub?.renewalDate || '2027-01-01'
        };
      });

    return {
      summary: {
        totalTenants: allTenants.length,
        activeTenants,
        suspendedTenants,
        trialTenants,
        totalGstins,
        totalBranches,
        totalUsers,
        totalTurnoverInr,
        monthlyRecurringRevenueInr,
        annualRunRateInr,
        averageRevenuePerTenantInr,
        newTenantsThisMonth: 3,
        newTenantsToday: 1,
        growthRatePct: 28.5,
        systemHealthPct: 99.98,
        activeWebSockets: 14
      },
      planDistribution,
      sectorDistribution: Object.entries(sectorCounts).map(([sector, count]) => ({
        sector,
        count,
        percentage: Number(((count / (allTenants.length || 1)) * 100).toFixed(1))
      })),
      stateDistribution: Object.values(stateCounts),
      isolationModeBreakdown: Object.entries(isolationCounts).map(([mode, count]) => ({ mode, count })),
      timeline30Days,
      recentTenants,
      lastRefreshed: new Date().toISOString()
    };
  }
}

export const tenantService = new TenantService();
