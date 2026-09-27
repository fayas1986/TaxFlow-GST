/**
 * Granular Role-Based Access Control (RBAC) & Permissions
 */

export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  FINANCE_MANAGER = 'FINANCE_MANAGER',
  TAX_ACCOUNTANT = 'TAX_ACCOUNTANT',
  AUDITOR = 'AUDITOR',
  VIEWER = 'VIEWER'
}

export enum Permission {
  // Invoices & Transactions
  INVOICE_READ = 'invoice:read',
  INVOICE_WRITE = 'invoice:write',
  INVOICE_DELETE = 'invoice:delete',
  PURCHASE_READ = 'purchase:read',
  PURCHASE_WRITE = 'purchase:write',

  // GSTIN & Branches
  GSTIN_READ = 'gstin:read',
  GSTIN_WRITE = 'gstin:write',
  BRANCH_READ = 'branch:read',
  BRANCH_WRITE = 'branch:write',

  // Reconciliation & ITC
  RECONCILIATION_READ = 'reconciliation:read',
  RECONCILIATION_EXECUTE = 'reconciliation:execute',
  RECONCILIATION_APPROVE = 'reconciliation:approve',
  ITC_MANAGE = 'itc:manage',

  // E-Invoice & E-Way Bill
  EINVOICE_GENERATE = 'einvoice:generate',
  EINVOICE_CANCEL = 'einvoice:cancel',
  EWAYBILL_GENERATE = 'ewaybill:generate',
  EWAYBILL_CANCEL = 'ewaybill:cancel',

  // Returns & Filing
  FILING_VIEW = 'filing:view',
  FILING_PREPARE = 'filing:prepare',
  FILING_SUBMIT = 'filing:submit',

  // Reports & Analytics
  REPORT_VIEW = 'report:view',
  REPORT_EXPORT = 'report:export',

  // Audit Logs & Security
  AUDIT_VIEW = 'audit:view',
  SECURITY_AUDIT = 'security:audit',

  // Integrations & API
  INTEGRATION_VIEW = 'integration:view',
  INTEGRATION_MANAGE = 'integration:manage',
  API_MANAGE = 'api:manage',

  // Organization & User Management
  USER_MANAGE = 'user:manage',
  SUBSCRIPTION_MANAGE = 'subscription:manage',
  SETTINGS_MANAGE = 'settings:manage'
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.SUPER_ADMIN]: Object.values(Permission),

  [Role.ADMIN]: [
    Permission.INVOICE_READ,
    Permission.INVOICE_WRITE,
    Permission.INVOICE_DELETE,
    Permission.GSTIN_READ,
    Permission.GSTIN_WRITE,
    Permission.BRANCH_READ,
    Permission.BRANCH_WRITE,
    Permission.RECONCILIATION_READ,
    Permission.RECONCILIATION_EXECUTE,
    Permission.RECONCILIATION_APPROVE,
    Permission.ITC_MANAGE,
    Permission.EINVOICE_GENERATE,
    Permission.EINVOICE_CANCEL,
    Permission.EWAYBILL_GENERATE,
    Permission.EWAYBILL_CANCEL,
    Permission.FILING_VIEW,
    Permission.FILING_PREPARE,
    Permission.FILING_SUBMIT,
    Permission.REPORT_VIEW,
    Permission.REPORT_EXPORT,
    Permission.AUDIT_VIEW,
    Permission.INTEGRATION_VIEW,
    Permission.INTEGRATION_MANAGE,
    Permission.API_MANAGE,
    Permission.USER_MANAGE,
    Permission.SETTINGS_MANAGE
  ],

  [Role.FINANCE_MANAGER]: [
    Permission.INVOICE_READ,
    Permission.INVOICE_WRITE,
    Permission.GSTIN_READ,
    Permission.BRANCH_READ,
    Permission.RECONCILIATION_READ,
    Permission.RECONCILIATION_EXECUTE,
    Permission.RECONCILIATION_APPROVE,
    Permission.ITC_MANAGE,
    Permission.EINVOICE_GENERATE,
    Permission.EWAYBILL_GENERATE,
    Permission.FILING_VIEW,
    Permission.FILING_PREPARE,
    Permission.FILING_SUBMIT,
    Permission.REPORT_VIEW,
    Permission.REPORT_EXPORT,
    Permission.AUDIT_VIEW,
    Permission.INTEGRATION_VIEW
  ],

  [Role.TAX_ACCOUNTANT]: [
    Permission.INVOICE_READ,
    Permission.INVOICE_WRITE,
    Permission.GSTIN_READ,
    Permission.BRANCH_READ,
    Permission.RECONCILIATION_READ,
    Permission.RECONCILIATION_EXECUTE,
    Permission.ITC_MANAGE,
    Permission.EINVOICE_GENERATE,
    Permission.EWAYBILL_GENERATE,
    Permission.FILING_VIEW,
    Permission.FILING_PREPARE,
    Permission.REPORT_VIEW,
    Permission.REPORT_EXPORT
  ],

  [Role.AUDITOR]: [
    Permission.INVOICE_READ,
    Permission.GSTIN_READ,
    Permission.BRANCH_READ,
    Permission.RECONCILIATION_READ,
    Permission.FILING_VIEW,
    Permission.REPORT_VIEW,
    Permission.REPORT_EXPORT,
    Permission.AUDIT_VIEW,
    Permission.SECURITY_AUDIT
  ],

  [Role.VIEWER]: [
    Permission.INVOICE_READ,
    Permission.GSTIN_READ,
    Permission.BRANCH_READ,
    Permission.RECONCILIATION_READ,
    Permission.FILING_VIEW,
    Permission.REPORT_VIEW
  ]
};

export function getPermissionsForRole(role: string): Permission[] {
  const normalized = (role || '').toUpperCase() as Role;
  return ROLE_PERMISSIONS[normalized] || ROLE_PERMISSIONS[Role.VIEWER];
}

export function roleHasPermission(role: string, permission: Permission, isReadOnly = false): boolean {
  if (isReadOnly) {
    // Read-only users can NEVER execute write, delete, cancel, or generate operations
    const writeKeywords = ['write', 'delete', 'execute', 'approve', 'generate', 'cancel', 'submit', 'manage'];
    const isWriteOp = writeKeywords.some(keyword => permission.includes(keyword));
    if (isWriteOp) {
      return false;
    }
  }

  const permissions = getPermissionsForRole(role);
  return permissions.includes(permission);
}
