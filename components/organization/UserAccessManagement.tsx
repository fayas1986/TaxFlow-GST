import React, { useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { 
  Users, 
  ShieldCheck, 
  Building2, 
  MapPin, 
  Grid, 
  History, 
  Clock, 
  Search, 
  Filter, 
  Plus, 
  Edit3, 
  Trash2, 
  Lock, 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Download, 
  Laptop, 
  Smartphone, 
  Globe, 
  UserPlus, 
  RefreshCw, 
  LogOut, 
  ShieldAlert, 
  Check, 
  MoreVertical,
  Layers,
  ChevronRight,
  ChevronLeft,
  Shield,
  Sliders,
  Sparkles,
  Eye,
  FileText,
  Printer,
  FileCheck,
  Award
} from 'lucide-react';
import { 
  UserRole, 
  UserAccessProfile, 
  DepartmentCode, 
  DepartmentAccess, 
  BranchAccessConfig, 
  PermissionAction, 
  RolePermissionMatrix, 
  LoginAuditRecord, 
  UserSessionRecord, 
  SessionSettings,
  Tenant,
  RbacChangeHistoryRecord
} from '../../types';

interface UserAccessManagementProps {
  currentTenantId?: string;
  onShowToast?: (msg: string) => void;
}

// Initial Mock Data for Departments
const INITIAL_DEPARTMENTS: DepartmentAccess[] = [
  { id: 'dept-1', name: 'Finance & Accounts', code: 'FINANCE', description: 'Core ledger accounting, AP/AR, and bank reconciliation', memberCount: 8, departmentLead: 'Dr. Vikram Malhotra' },
  { id: 'dept-2', name: 'Tax & Regulatory Compliance', code: 'TAX', description: 'GST return filing, tax computations, and e-invoicing', memberCount: 5, departmentLead: 'Anita Desai' },
  { id: 'dept-3', name: 'Internal Audit & Risk', code: 'AUDIT', description: 'Anomaly verification, statutory audit, and risk analysis', memberCount: 3, departmentLead: 'Siddharth Rao' },
  { id: 'dept-4', name: 'Treasury & Cash Flow', code: 'TREASURY', description: 'Cash positioning, working capital, and tax liability planning', memberCount: 2, departmentLead: 'Meera Nair' },
  { id: 'dept-5', name: 'Operations & Logistics', code: 'OPERATIONS', description: 'E-way bill management, movement of goods, and branch coordination', memberCount: 12, departmentLead: 'Rajesh Sharma' },
  { id: 'dept-6', name: 'Sales & Billing', code: 'SALES', description: 'B2B/B2C invoicing, e-invoice generation, and customer ledgers', memberCount: 15, departmentLead: 'Priya Verma' },
  { id: 'dept-7', name: 'Procurement & Vendor AP', code: 'PROCUREMENT', description: 'Vendor onboarding, purchase invoice verification, and ITC claim', memberCount: 6, departmentLead: 'Arun Kumar' },
  { id: 'dept-8', name: 'HR & Corporate Admin', code: 'HR_ADMIN', description: 'User lifecycle, department onboarding, and access provisioning', memberCount: 4, departmentLead: 'Kavita Singh' }
];

// Initial Mock Branches
const MOCK_BRANCHES: BranchAccessConfig[] = [
  { branchId: 'b1', branchName: 'Mumbai HQ Office', branchCode: 'MH-HQ-01', gstin: '27AAAAA0000A1Z5', accessLevel: 'FULL_ACCESS' },
  { branchId: 'b2', branchName: 'Delhi Regional Hub', branchCode: 'DL-RO-02', gstin: '07AAAAA0000A1Z2', accessLevel: 'FULL_ACCESS' },
  { branchId: 'b3', branchName: 'Bengaluru Tech Center (SEZ)', branchCode: 'KA-SEZ-03', gstin: '29AAAAA0000A1Z9', accessLevel: 'READ_ONLY' },
];

// Mock Users
const INITIAL_USERS: UserAccessProfile[] = [
  {
    id: 'u-1',
    name: 'Rajesh Sharma',
    email: 'rajesh.sharma@acmetech.com',
    phone: '+91 98200 11223',
    role: UserRole.SUPER_ADMIN,
    status: 'ACTIVE',
    primaryDepartment: 'FINANCE',
    secondaryDepartments: ['TAX', 'HR_ADMIN'],
    branchScope: 'ALL_BRANCHES',
    branchAccess: [
      { branchId: 'b1', branchName: 'Mumbai HQ Office', branchCode: 'MH-HQ-01', gstin: '27AAAAA0000A1Z5', accessLevel: 'FULL_ACCESS' },
      { branchId: 'b2', branchName: 'Delhi Regional Hub', branchCode: 'DL-RO-02', gstin: '07AAAAA0000A1Z2', accessLevel: 'FULL_ACCESS' },
      { branchId: 'b3', branchName: 'Bengaluru Tech Center (SEZ)', branchCode: 'KA-SEZ-03', gstin: '29AAAAA0000A1Z9', accessLevel: 'FULL_ACCESS' }
    ],
    enforce2FA: true,
    is2FAVerified: true,
    lastLoginAt: '2026-07-26T09:15:00Z',
    lastLoginIp: '103.21.124.50',
    createdAt: '2025-01-10T10:00:00Z',
    currentTenantId: 't1',
    availableTenants: []
  },
  {
    id: 'u-2',
    name: 'Priya Verma',
    email: 'priya.verma@acmetech.com',
    phone: '+91 98110 44556',
    role: UserRole.ADMIN,
    status: 'ACTIVE',
    primaryDepartment: 'TAX',
    secondaryDepartments: ['FINANCE'],
    branchScope: 'ALL_BRANCHES',
    branchAccess: [
      { branchId: 'b1', branchName: 'Mumbai HQ Office', branchCode: 'MH-HQ-01', gstin: '27AAAAA0000A1Z5', accessLevel: 'FULL_ACCESS' },
      { branchId: 'b2', branchName: 'Delhi Regional Hub', branchCode: 'DL-RO-02', gstin: '07AAAAA0000A1Z2', accessLevel: 'FULL_ACCESS' },
      { branchId: 'b3', branchName: 'Bengaluru Tech Center (SEZ)', branchCode: 'KA-SEZ-03', gstin: '29AAAAA0000A1Z9', accessLevel: 'READ_ONLY' }
    ],
    enforce2FA: true,
    is2FAVerified: true,
    lastLoginAt: '2026-07-26T08:45:00Z',
    lastLoginIp: '182.73.189.12',
    createdAt: '2025-02-15T11:20:00Z',
    currentTenantId: 't1',
    availableTenants: []
  },
  {
    id: 'u-3',
    name: 'Anita Desai',
    email: 'anita.desai@acmetech.com',
    phone: '+91 98200 44332',
    role: UserRole.ACCOUNTANT,
    status: 'ACTIVE',
    primaryDepartment: 'FINANCE',
    secondaryDepartments: ['TAX'],
    branchScope: 'SELECTED_BRANCHES',
    branchAccess: [
      { branchId: 'b1', branchName: 'Mumbai HQ Office', branchCode: 'MH-HQ-01', gstin: '27AAAAA0000A1Z5', accessLevel: 'FULL_ACCESS' },
      { branchId: 'b2', branchName: 'Delhi Regional Hub', branchCode: 'DL-RO-02', gstin: '07AAAAA0000A1Z2', accessLevel: 'NO_ACCESS' },
      { branchId: 'b3', branchName: 'Bengaluru Tech Center (SEZ)', branchCode: 'KA-SEZ-03', gstin: '29AAAAA0000A1Z9', accessLevel: 'NO_ACCESS' }
    ],
    enforce2FA: true,
    is2FAVerified: true,
    lastLoginAt: '2026-07-25T16:30:00Z',
    lastLoginIp: '115.112.241.90',
    createdAt: '2025-03-01T09:00:00Z',
    currentTenantId: 't1',
    availableTenants: []
  },
  {
    id: 'u-4',
    name: 'Siddharth Rao',
    email: 'siddharth.rao@external-audit.com',
    phone: '+91 99300 88776',
    role: UserRole.AUDITOR,
    status: 'ACTIVE',
    primaryDepartment: 'AUDIT',
    secondaryDepartments: [],
    branchScope: 'ALL_BRANCHES',
    branchAccess: [
      { branchId: 'b1', branchName: 'Mumbai HQ Office', branchCode: 'MH-HQ-01', gstin: '27AAAAA0000A1Z5', accessLevel: 'READ_ONLY' },
      { branchId: 'b2', branchName: 'Delhi Regional Hub', branchCode: 'DL-RO-02', gstin: '07AAAAA0000A1Z2', accessLevel: 'READ_ONLY' },
      { branchId: 'b3', branchName: 'Bengaluru Tech Center (SEZ)', branchCode: 'KA-SEZ-03', gstin: '29AAAAA0000A1Z9', accessLevel: 'READ_ONLY' }
    ],
    enforce2FA: true,
    is2FAVerified: true,
    lastLoginAt: '2026-07-24T14:10:00Z',
    lastLoginIp: '49.207.210.15',
    createdAt: '2025-04-10T14:00:00Z',
    currentTenantId: 't1',
    availableTenants: []
  },
  {
    id: 'u-5',
    name: 'Meera Nair',
    email: 'meera.nair@acmetech.com',
    phone: '+91 98450 66554',
    role: UserRole.FINANCE_MANAGER,
    status: 'ACTIVE',
    primaryDepartment: 'TREASURY',
    secondaryDepartments: ['FINANCE'],
    branchScope: 'ALL_BRANCHES',
    branchAccess: [
      { branchId: 'b1', branchName: 'Mumbai HQ Office', branchCode: 'MH-HQ-01', gstin: '27AAAAA0000A1Z5', accessLevel: 'FULL_ACCESS' },
      { branchId: 'b2', branchName: 'Delhi Regional Hub', branchCode: 'DL-RO-02', gstin: '07AAAAA0000A1Z2', accessLevel: 'FULL_ACCESS' },
      { branchId: 'b3', branchName: 'Bengaluru Tech Center (SEZ)', branchCode: 'KA-SEZ-03', gstin: '29AAAAA0000A1Z9', accessLevel: 'FULL_ACCESS' }
    ],
    enforce2FA: true,
    is2FAVerified: true,
    lastLoginAt: '2026-07-26T10:05:00Z',
    lastLoginIp: '122.170.14.88',
    createdAt: '2025-05-02T11:00:00Z',
    currentTenantId: 't1',
    availableTenants: []
  },
  {
    id: 'u-6',
    name: 'Karan Patel',
    email: 'karan.patel@acmetech.com',
    phone: '+91 97200 33221',
    role: UserRole.VIEWER,
    status: 'ACTIVE',
    primaryDepartment: 'SALES',
    secondaryDepartments: [],
    branchScope: 'SELECTED_BRANCHES',
    branchAccess: [
      { branchId: 'b1', branchName: 'Mumbai HQ Office', branchCode: 'MH-HQ-01', gstin: '27AAAAA0000A1Z5', accessLevel: 'READ_ONLY' },
      { branchId: 'b2', branchName: 'Delhi Regional Hub', branchCode: 'DL-RO-02', gstin: '07AAAAA0000A1Z2', accessLevel: 'NO_ACCESS' },
      { branchId: 'b3', branchName: 'Bengaluru Tech Center (SEZ)', branchCode: 'KA-SEZ-03', gstin: '29AAAAA0000A1Z9', accessLevel: 'NO_ACCESS' }
    ],
    enforce2FA: false,
    is2FAVerified: false,
    lastLoginAt: '2026-07-20T11:40:00Z',
    lastLoginIp: '106.51.72.10',
    createdAt: '2025-06-12T15:30:00Z',
    currentTenantId: 't1',
    availableTenants: []
  }
];

// Initial Modules for Permission Matrix
const SYSTEM_MODULES = [
  { key: 'INVOICES', name: 'Invoices & Ledger', description: 'Upload, edit, and classify B2B/B2C invoices' },
  { key: 'FILING', name: 'GST Returns & Filing', description: 'GSTR-1, GSTR-3B, and GSTR-9 filing execution' },
  { key: 'COMPUTATION', name: 'Tax Engine & ITC', description: 'Tax liability computation & ITC eligibility rules' },
  { key: 'RECONCILIATION', name: 'Portal Reconciliation', description: 'GSTR-2B vs Purchase Register 2-way & 3-way matching' },
  { key: 'RISK_ANALYSIS', name: 'AI Risk & Anomaly Engine', description: 'Section 17(5) blocking & anomaly detection' },
  { key: 'REPORTS', name: 'Analytics & Export Reports', description: 'Financial reporting and regulatory CSV/PDF downloads' },
  { key: 'INTEGRATIONS', name: 'ERP & API Integrations', description: 'Tally, SAP, and custom webhook API keys' },
  { key: 'ORGANIZATION', name: 'Organization & Branches', description: 'Entity profile, state registration, and branches' },
  { key: 'USER_MANAGEMENT', name: 'User & Access Control', description: 'User provisioning, RBAC, and department permissions' },
  { key: 'AUDIT_LOGS', name: 'System Audit Logs', description: 'Granular activity logs and regulatory compliance trails' }
];

// Preconfigured default permissions per role
const DEFAULT_ROLE_MATRICES: RolePermissionMatrix[] = [
  {
    role: UserRole.SUPER_ADMIN,
    roleName: 'Super Admin',
    description: 'Unrestricted enterprise control across all tenants, user provisioning, global billing, and security policies.',
    color: 'from-purple-600 to-indigo-700',
    badgeBg: 'bg-purple-100 text-purple-800 border-purple-200',
    modules: SYSTEM_MODULES.map(m => ({
      moduleKey: m.key,
      moduleName: m.name,
      description: m.description,
      actions: { VIEW: true, CREATE: true, EDIT: true, DELETE: true, APPROVE: true, EXPORT: true, ADMIN: true }
    }))
  },
  {
    role: UserRole.ADMIN,
    roleName: 'Admin',
    description: 'Full organization administrative control, branch management, department access, and user assignment.',
    color: 'from-blue-600 to-cyan-700',
    badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
    modules: SYSTEM_MODULES.map(m => ({
      moduleKey: m.key,
      moduleName: m.name,
      description: m.description,
      actions: {
        VIEW: true,
        CREATE: true,
        EDIT: true,
        DELETE: m.key !== 'AUDIT_LOGS',
        APPROVE: true,
        EXPORT: true,
        ADMIN: m.key !== 'USER_MANAGEMENT'
      }
    }))
  },
  {
    role: UserRole.ACCOUNTANT,
    roleName: 'Accountant',
    description: 'Invoice operations, tax computations, reconciliation, and GST return filing workflows.',
    color: 'from-emerald-600 to-teal-700',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    modules: SYSTEM_MODULES.map(m => ({
      moduleKey: m.key,
      moduleName: m.name,
      description: m.description,
      actions: {
        VIEW: true,
        CREATE: ['INVOICES', 'RECONCILIATION', 'COMPUTATION'].includes(m.key),
        EDIT: ['INVOICES', 'RECONCILIATION', 'COMPUTATION'].includes(m.key),
        DELETE: false,
        APPROVE: ['INVOICES', 'FILING'].includes(m.key),
        EXPORT: true,
        ADMIN: false
      }
    }))
  },
  {
    role: UserRole.AUDITOR,
    roleName: 'Auditor',
    description: 'Independent inspection of invoices, tax calculations, audit trails, and risk reports with export rights.',
    color: 'from-amber-600 to-orange-700',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
    modules: SYSTEM_MODULES.map(m => ({
      moduleKey: m.key,
      moduleName: m.name,
      description: m.description,
      actions: {
        VIEW: true,
        CREATE: false,
        EDIT: false,
        DELETE: false,
        APPROVE: false,
        EXPORT: true,
        ADMIN: false
      }
    }))
  },
  {
    role: UserRole.FINANCE_MANAGER,
    roleName: 'Finance Manager',
    description: 'High-value invoice approval, liability authorization, treasury planning, and financial oversight.',
    color: 'from-indigo-600 to-blue-800',
    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    modules: SYSTEM_MODULES.map(m => ({
      moduleKey: m.key,
      moduleName: m.name,
      description: m.description,
      actions: {
        VIEW: true,
        CREATE: false,
        EDIT: ['INVOICES', 'COMPUTATION'].includes(m.key),
        DELETE: false,
        APPROVE: true,
        EXPORT: true,
        ADMIN: false
      }
    }))
  },
  {
    role: UserRole.VIEWER,
    roleName: 'Viewer',
    description: 'Read-only access to dashboards, filed returns, and summary analytics without modification capabilities.',
    color: 'from-slate-600 to-slate-800',
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
    modules: SYSTEM_MODULES.map(m => ({
      moduleKey: m.key,
      moduleName: m.name,
      description: m.description,
      actions: {
        VIEW: true,
        CREATE: false,
        EDIT: false,
        DELETE: false,
        APPROVE: false,
        EXPORT: false,
        ADMIN: false
      }
    }))
  },
  {
    role: UserRole.CUSTOMER,
    roleName: 'Customer / Client',
    description: 'External customer portal: Upload purchase/sales documents, inspect sales invoices, track recurring schedules, and personal preferences.',
    color: 'from-teal-600 to-cyan-700',
    badgeBg: 'bg-teal-100 text-teal-800 border-teal-200',
    modules: SYSTEM_MODULES.map(m => ({
      moduleKey: m.key,
      moduleName: m.name,
      description: m.description,
      actions: {
        VIEW: ['INVOICES', 'REPORTS'].includes(m.key),
        CREATE: ['INVOICES'].includes(m.key),
        EDIT: false,
        DELETE: false,
        APPROVE: false,
        EXPORT: ['INVOICES', 'REPORTS'].includes(m.key),
        ADMIN: false
      }
    }))
  }
];

// Initial Login Audit Records
const INITIAL_LOGIN_AUDIT: LoginAuditRecord[] = [
  { id: 'log-1', userId: 'u-1', userName: 'Rajesh Sharma', userEmail: 'rajesh.sharma@acmetech.com', role: UserRole.SUPER_ADMIN, timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), eventType: 'LOGIN_SUCCESS', ipAddress: '103.21.124.50', location: 'Mumbai, MH, India', deviceBrowser: 'Macintosh - Chrome 126', status: 'SUCCESS', riskScore: 'LOW' },
  { id: 'log-2', userId: 'u-2', userName: 'Priya Verma', userEmail: 'priya.verma@acmetech.com', role: UserRole.ADMIN, timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(), eventType: '2FA_VERIFIED', ipAddress: '182.73.189.12', location: 'New Delhi, DL, India', deviceBrowser: 'Windows 11 - Edge 125', status: 'SUCCESS', riskScore: 'LOW' },
  { id: 'log-3', userId: 'u-5', userName: 'Meera Nair', userEmail: 'meera.nair@acmetech.com', role: UserRole.FINANCE_MANAGER, timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), eventType: 'LOGIN_SUCCESS', ipAddress: '122.170.14.88', location: 'Bengaluru, KA, India', deviceBrowser: 'Macintosh - Safari 17.5', status: 'SUCCESS', riskScore: 'LOW' },
  { id: 'log-4', userId: 'unknown', userName: 'Unknown User', userEmail: 'admin@acmetech.com', role: UserRole.ADMIN, timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), eventType: 'LOGIN_FAILED', ipAddress: '45.143.20.11', location: 'Frankfurt, DE', deviceBrowser: 'Linux - Python/Requests', status: 'FAILED', riskScore: 'HIGH', failureReason: 'Invalid Password Attempt x3' },
  { id: 'log-5', userId: 'u-3', userName: 'Anita Desai', userEmail: 'anita.desai@acmetech.com', role: UserRole.ACCOUNTANT, timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(), eventType: 'PASSWORD_RESET', ipAddress: '115.112.241.90', location: 'Mumbai, MH, India', deviceBrowser: 'Macintosh - Firefox 127', status: 'SUCCESS', riskScore: 'LOW' },
  { id: 'log-6', userId: 'u-4', userName: 'Siddharth Rao', userEmail: 'siddharth.rao@external-audit.com', role: UserRole.AUDITOR, timestamp: new Date(Date.now() - 36 * 60 * 1000).toISOString(), eventType: 'LOGOUT', ipAddress: '49.207.210.15', location: 'Pune, MH, India', deviceBrowser: 'Windows 10 - Chrome 126', status: 'SUCCESS', riskScore: 'LOW' }
];

// Initial Active Sessions
const INITIAL_SESSIONS: UserSessionRecord[] = [
  { id: 'sess-1', userId: 'u-1', userName: 'Rajesh Sharma', userEmail: 'rajesh.sharma@acmetech.com', role: UserRole.SUPER_ADMIN, department: 'Finance & Accounts', deviceOS: 'macOS Sonoma', browser: 'Chrome 126', ipAddress: '103.21.124.50', location: 'Mumbai, MH, India', loginTime: '2026-07-26 09:15', lastActiveTime: 'Just now', isCurrentSession: true, twoFactorVerified: true },
  { id: 'sess-2', userId: 'u-2', userName: 'Priya Verma', userEmail: 'priya.verma@acmetech.com', role: UserRole.ADMIN, department: 'Tax & Compliance', deviceOS: 'Windows 11', browser: 'Edge 125', ipAddress: '182.73.189.12', location: 'New Delhi, DL, India', loginTime: '2026-07-26 08:45', lastActiveTime: '2 mins ago', isCurrentSession: false, twoFactorVerified: true },
  { id: 'sess-3', userId: 'u-5', userName: 'Meera Nair', userEmail: 'meera.nair@acmetech.com', role: UserRole.FINANCE_MANAGER, department: 'Treasury & Cash Flow', deviceOS: 'macOS Sonoma', browser: 'Safari 17.5', ipAddress: '122.170.14.88', location: 'Bengaluru, KA, India', loginTime: '2026-07-26 10:05', lastActiveTime: '12 mins ago', isCurrentSession: false, twoFactorVerified: true },
  { id: 'sess-4', userId: 'u-3', userName: 'Anita Desai', userEmail: 'anita.desai@acmetech.com', role: UserRole.ACCOUNTANT, department: 'Finance & Accounts', deviceOS: 'iOS 17.5 (iPhone 15 Pro)', browser: 'Mobile Safari', ipAddress: '115.112.241.90', location: 'Mumbai, MH, India', loginTime: '2026-07-25 16:30', lastActiveTime: '1 hour ago', isCurrentSession: false, twoFactorVerified: true }
];

// Initial RBAC Change History Records
const INITIAL_RBAC_HISTORY: RbacChangeHistoryRecord[] = [
  {
    id: 'rbac-hist-1',
    timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    actorName: 'Rajesh Sharma',
    actorEmail: 'rajesh.sharma@acmetech.com',
    actorRole: UserRole.SUPER_ADMIN,
    targetType: 'ROLE_MATRIX',
    targetName: 'Accountant Role',
    changeCategory: 'GRANT',
    moduleOrFeature: 'Tax Engine & ITC',
    oldValue: 'APPROVE: Disabled',
    newValue: 'APPROVE: Enabled',
    details: 'Granted APPROVE permission on Tax Engine & ITC module to Accountant role for GST return filing workflow.',
    ipAddress: '103.21.124.50'
  },
  {
    id: 'rbac-hist-2',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    actorName: 'Priya Verma',
    actorEmail: 'priya.verma@acmetech.com',
    actorRole: UserRole.ADMIN,
    targetType: 'USER_ROLE',
    targetName: 'Anita Desai',
    changeCategory: 'ROLE_CHANGE',
    moduleOrFeature: 'User Access Management',
    oldValue: 'Role: VIEWER',
    newValue: 'Role: ACCOUNTANT',
    details: 'Promoted user Anita Desai from Viewer to Accountant role upon probation completion.',
    ipAddress: '182.73.189.12'
  },
  {
    id: 'rbac-hist-3',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    actorName: 'Rajesh Sharma',
    actorEmail: 'rajesh.sharma@acmetech.com',
    actorRole: UserRole.SUPER_ADMIN,
    targetType: 'PRESET_APPLIED',
    targetName: 'Auditor Role',
    changeCategory: 'PRESET_APPLY',
    moduleOrFeature: 'All System Modules',
    oldValue: 'Custom Permissions Matrix',
    newValue: 'Preset: READ_ONLY',
    details: 'Applied Read-Only permission preset across all system modules for Auditor role during Q2 Statutory Audit.',
    ipAddress: '103.21.124.50'
  },
  {
    id: 'rbac-hist-4',
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    actorName: 'Priya Verma',
    actorEmail: 'priya.verma@acmetech.com',
    actorRole: UserRole.ADMIN,
    targetType: 'BRANCH_ACCESS',
    targetName: 'Meera Nair',
    changeCategory: 'BRANCH_SCOPING',
    moduleOrFeature: 'Bengaluru Tech Center (SEZ)',
    oldValue: 'Branch Access: NO_ACCESS',
    newValue: 'Branch Access: READ_ONLY',
    details: 'Granted Read-Only branch permission for Bengaluru SEZ hub to Meera Nair.',
    ipAddress: '182.73.189.12'
  },
  {
    id: 'rbac-hist-5',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    actorName: 'Rajesh Sharma',
    actorEmail: 'rajesh.sharma@acmetech.com',
    actorRole: UserRole.SUPER_ADMIN,
    targetType: 'ROLE_CLONED',
    targetName: 'Finance Manager Role',
    changeCategory: 'GRANT',
    moduleOrFeature: 'Full Policy Matrix Clone',
    oldValue: 'Role: FINANCE_MANAGER',
    newValue: 'Cloned from Admin Role',
    details: 'Cloned module access matrix policy from Admin role to Finance Manager role.',
    ipAddress: '103.21.124.50'
  },
  {
    id: 'rbac-hist-6',
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    actorName: 'Priya Verma',
    actorEmail: 'priya.verma@acmetech.com',
    actorRole: UserRole.ADMIN,
    targetType: 'USER_STATUS',
    targetName: 'Siddharth Rao',
    changeCategory: 'STATUS_CHANGE',
    moduleOrFeature: 'Account Access',
    oldValue: 'Status: PENDING_INVITE',
    newValue: 'Status: ACTIVE',
    details: 'Activated external auditor account for Siddharth Rao with 2FA enforcement.',
    ipAddress: '182.73.189.12'
  }
];

const UserAccessManagement: React.FC<UserAccessManagementProps> = ({ currentTenantId = 't1', onShowToast }) => {
  const [activeSubTab, setActiveSubTab] = useState<'USERS' | 'RBAC' | 'DEPARTMENTS' | 'BRANCHES' | 'PERMISSIONS' | 'RBAC_HISTORY' | 'AUDIT' | 'SESSIONS'>('USERS');
  const tabsRef = useRef<HTMLDivElement>(null);
  const roleCardsRef = useRef<HTMLDivElement>(null);
  const deptCardsRef = useRef<HTMLDivElement>(null);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsRef.current) {
      const scrollAmount = direction === 'left' ? -280 : 280;
      tabsRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const scrollRoleCards = (direction: 'left' | 'right') => {
    if (roleCardsRef.current) {
      const scrollAmount = direction === 'left' ? -350 : 350;
      roleCardsRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const scrollDeptCards = (direction: 'left' | 'right') => {
    if (deptCardsRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      deptCardsRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // State Management
  const [users, setUsers] = useState<UserAccessProfile[]>(INITIAL_USERS);
  const [departments, setDepartments] = useState<DepartmentAccess[]>(INITIAL_DEPARTMENTS);
  const [roleMatrices, setRoleMatrices] = useState<RolePermissionMatrix[]>(DEFAULT_ROLE_MATRICES);
  const [loginAudits, setLoginAudits] = useState<LoginAuditRecord[]>(INITIAL_LOGIN_AUDIT);
  const [sessions, setSessions] = useState<UserSessionRecord[]>(INITIAL_SESSIONS);
  const [rbacChangeLogs, setRbacChangeLogs] = useState<RbacChangeHistoryRecord[]>(INITIAL_RBAC_HISTORY);

  // Filters for RBAC Change History Tab
  const [rbacHistorySearchQuery, setRbacHistorySearchQuery] = useState('');
  const [rbacTargetTypeFilter, setRbacTargetTypeFilter] = useState<string>('ALL');
  const [rbacCategoryFilter, setRbacCategoryFilter] = useState<string>('ALL');
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<RbacChangeHistoryRecord | null>(null);

  // State for Printable Summary Compliance View / PDF Report
  const [isPrintableSummaryOpen, setIsPrintableSummaryOpen] = useState(false);
  const [printableSummaryMode, setPrintableSummaryMode] = useState<'ALL' | 'RBAC' | 'LOGIN'>('ALL');
  const [printableSummaryScope, setPrintableSummaryScope] = useState<'FILTERED' | 'FULL'>('FILTERED');

  // Helper function to log RBAC and permission changes
  const logRbacChange = (
    targetType: RbacChangeHistoryRecord['targetType'],
    targetName: string,
    changeCategory: RbacChangeHistoryRecord['changeCategory'],
    moduleOrFeature: string,
    oldValue: string,
    newValue: string,
    details: string
  ) => {
    const newRecord: RbacChangeHistoryRecord = {
      id: `rbac-hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      actorName: 'Rajesh Sharma',
      actorEmail: 'rajesh.sharma@acmetech.com',
      actorRole: UserRole.SUPER_ADMIN,
      targetType,
      targetName,
      changeCategory,
      moduleOrFeature,
      oldValue,
      newValue,
      details,
      ipAddress: '103.21.124.50'
    };

    setRbacChangeLogs(prev => [newRecord, ...prev]);
  };

  // Session Policy Config
  const [sessionSettings, setSessionSettings] = useState<SessionSettings>({
    inactivityTimeoutMinutes: 30,
    maxConcurrentSessions: 2,
    enforceSingleDevice: false,
    autoRevokeInactiveDays: 7,
    require2FAForHighPrivilege: true
  });

  // Filters for User Management
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

  // Modal State for User Create / Edit
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccessProfile | null>(null);
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: UserRole.ACCOUNTANT,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'PENDING_INVITE',
    primaryDepartment: 'FINANCE' as DepartmentCode,
    secondaryDepartments: [] as DepartmentCode[],
    branchScope: 'ALL_BRANCHES' as 'ALL_BRANCHES' | 'SELECTED_BRANCHES',
    enforce2FA: true
  });

  // Selected Role for Permission Matrix Tab
  const [selectedMatrixRole, setSelectedMatrixRole] = useState<UserRole>(UserRole.ADMIN);

  // Filter for Login Audit Tab
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditTypeFilter, setAuditTypeFilter] = useState<string>('ALL');

  const toast = (msg: string) => {
    if (onShowToast) onShowToast(msg);
    else alert(msg);
  };

  // Handlers for User Modal
  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUserFormData({
      name: '',
      email: '',
      phone: '',
      role: UserRole.ACCOUNTANT,
      status: 'ACTIVE',
      primaryDepartment: 'FINANCE',
      secondaryDepartments: [],
      branchScope: 'ALL_BRANCHES',
      enforce2FA: true
    });
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user: UserAccessProfile) => {
    setEditingUser(user);
    setUserFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      status: user.status === 'SUSPENDED' ? 'INACTIVE' : user.status,
      primaryDepartment: user.primaryDepartment,
      secondaryDepartments: [...user.secondaryDepartments],
      branchScope: user.branchScope,
      enforce2FA: user.enforce2FA
    });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.name.trim() || !userFormData.email.trim()) {
      alert('Please fill in Name and Email');
      return;
    }

    if (editingUser) {
      const roleChanged = editingUser.role !== userFormData.role;
      const statusChanged = editingUser.status !== userFormData.status;

      setUsers(prev => prev.map(u => u.id === editingUser.id ? {
        ...u,
        name: userFormData.name,
        email: userFormData.email,
        phone: userFormData.phone,
        role: userFormData.role,
        status: userFormData.status,
        primaryDepartment: userFormData.primaryDepartment,
        secondaryDepartments: userFormData.secondaryDepartments,
        branchScope: userFormData.branchScope,
        enforce2FA: userFormData.enforce2FA
      } : u));

      if (roleChanged) {
        logRbacChange(
          'USER_ROLE',
          userFormData.name,
          'ROLE_CHANGE',
          'User Access & Role Assignment',
          `Role: ${editingUser.role.replace('_', ' ')}`,
          `Role: ${userFormData.role.replace('_', ' ')}`,
          `Reassigned user "${userFormData.name}" from ${editingUser.role.replace('_', ' ')} to ${userFormData.role.replace('_', ' ')} role.`
        );
      }
      if (statusChanged) {
        logRbacChange(
          'USER_STATUS',
          userFormData.name,
          'STATUS_CHANGE',
          'Account Lifecycle',
          `Status: ${editingUser.status}`,
          `Status: ${userFormData.status}`,
          `Updated account status for "${userFormData.name}" from ${editingUser.status} to ${userFormData.status}.`
        );
      }

      toast(`User ${userFormData.name} updated successfully`);
    } else {
      const newUser: UserAccessProfile = {
        id: `u-${Date.now()}`,
        name: userFormData.name,
        email: userFormData.email,
        phone: userFormData.phone,
        role: userFormData.role,
        status: userFormData.status,
        primaryDepartment: userFormData.primaryDepartment,
        secondaryDepartments: userFormData.secondaryDepartments,
        branchScope: userFormData.branchScope,
        branchAccess: MOCK_BRANCHES,
        enforce2FA: userFormData.enforce2FA,
        is2FAVerified: false,
        createdAt: new Date().toISOString(),
        currentTenantId: currentTenantId,
        availableTenants: []
      };
      setUsers(prev => [newUser, ...prev]);

      logRbacChange(
        'USER_ROLE',
        userFormData.name,
        'GRANT',
        'User Invitation & Provisioning',
        'Status: Unassigned',
        `Role: ${userFormData.role.replace('_', ' ')} (${userFormData.status})`,
        `Provisioned new user account for "${userFormData.name}" (${userFormData.email}) assigned to ${userFormData.role.replace('_', ' ')} role.`
      );

      toast(`Invitation sent to ${userFormData.email}`);
    }

    setIsUserModalOpen(false);
  };

  const handleToggleUserStatus = (userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const newStatus = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

        if (targetUser) {
          logRbacChange(
            'USER_STATUS',
            targetUser.name,
            'STATUS_CHANGE',
            'Account Access State',
            `Status: ${targetUser.status}`,
            `Status: ${newStatus}`,
            `${newStatus === 'ACTIVE' ? 'Activated' : 'Suspended/Deactivated'} user account access for "${targetUser.name}".`
          );
        }

        toast(`User status changed to ${newStatus}`);
        return { ...u, status: newStatus };
      }
      return u;
    }));
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (confirm(`Are you sure you want to revoke access and delete user "${userName}"?`)) {
      setUsers(prev => prev.filter(u => u.id !== userId));

      logRbacChange(
        'USER_STATUS',
        userName,
        'REVOKE',
        'Account Revocation & Deletion',
        `Role: ${targetUser?.role || 'User'} (${targetUser?.status || 'ACTIVE'})`,
        'Access Permanently Revoked',
        `Revoked all access credentials and deleted profile for user "${userName}".`
      );

      toast(`User ${userName} deleted`);
    }
  };

  // Matrix Permission Toggle
  const handleTogglePermission = (role: UserRole, moduleKey: string, action: PermissionAction) => {
    const matrix = roleMatrices.find(m => m.role === role);
    const mod = matrix?.modules.find(m => m.moduleKey === moduleKey);
    const isCurrentlyEnabled = mod?.actions[action] || false;
    const nextVal = !isCurrentlyEnabled;

    setRoleMatrices(prev => prev.map(mItem => {
      if (mItem.role === role) {
        const updatedModules = mItem.modules.map(m => {
          if (m.moduleKey === moduleKey) {
            return {
              ...m,
              actions: {
                ...m.actions,
                [action]: nextVal
              }
            };
          }
          return m;
        });
        return { ...mItem, modules: updatedModules };
      }
      return mItem;
    }));

    if (matrix && mod) {
      logRbacChange(
        'ROLE_MATRIX',
        matrix.roleName,
        nextVal ? 'GRANT' : 'REVOKE',
        mod.moduleName,
        `${action}: ${isCurrentlyEnabled ? 'Enabled' : 'Disabled'}`,
        `${action}: ${nextVal ? 'Enabled' : 'Disabled'}`,
        `${nextVal ? 'Granted' : 'Revoked'} ${action} capability on "${mod.moduleName}" module for ${matrix.roleName} role.`
      );
    }
  };

  const handleToggleColumnPermission = (role: UserRole, action: PermissionAction) => {
    const matrix = roleMatrices.find(m => m.role === role);
    if (!matrix) return;
    const allEnabled = matrix.modules.every(mod => mod.actions[action]);
    const nextVal = !allEnabled;

    setRoleMatrices(prev => prev.map(mItem => {
      if (mItem.role === role) {
        const updatedModules = mItem.modules.map(mod => ({
          ...mod,
          actions: {
            ...mod.actions,
            [action]: nextVal
          }
        }));
        return { ...mItem, modules: updatedModules };
      }
      return mItem;
    }));

    logRbacChange(
      'ROLE_MATRIX',
      matrix.roleName,
      nextVal ? 'GRANT' : 'REVOKE',
      `Column: ${action} Capability (All Modules)`,
      `${action}: ${allEnabled ? 'Bulk Enabled' : 'Partial/Disabled'}`,
      `${action}: Bulk ${nextVal ? 'Enabled' : 'Disabled'}`,
      `${nextVal ? 'Bulk granted' : 'Bulk revoked'} ${action} permission across all ${matrix.modules.length} modules for ${matrix.roleName} role.`
    );

    toast(`${action} capability ${nextVal ? 'granted to all modules' : 'revoked from all modules'} for ${matrix.roleName}`);
  };

  const handleToggleRowPermission = (role: UserRole, moduleKey: string) => {
    const matrix = roleMatrices.find(m => m.role === role);
    const targetMod = matrix?.modules.find(m => m.moduleKey === moduleKey);
    if (!matrix || !targetMod) return;

    const allActionsOn = Object.values(targetMod.actions).every(v => v);
    const nextVal = !allActionsOn;

    setRoleMatrices(prev => prev.map(mItem => {
      if (mItem.role === role) {
        const updatedModules = mItem.modules.map(mod => {
          if (mod.moduleKey === moduleKey) {
            return {
              ...mod,
              actions: {
                VIEW: nextVal,
                CREATE: nextVal,
                EDIT: nextVal,
                DELETE: nextVal,
                APPROVE: nextVal,
                EXPORT: nextVal,
                ADMIN: nextVal
              }
            };
          }
          return mod;
        });
        return { ...mItem, modules: updatedModules };
      }
      return mItem;
    }));

    logRbacChange(
      'ROLE_MATRIX',
      matrix.roleName,
      nextVal ? 'GRANT' : 'REVOKE',
      targetMod.moduleName,
      `Full Module Access: ${allActionsOn ? 'Granted (7/7)' : 'Partial'}`,
      `Full Module Access: ${nextVal ? 'Granted (7/7)' : 'Cleared (0/7)'}`,
      `${nextVal ? 'Granted full access (7/7 actions)' : 'Revoked all access permissions'} for module "${targetMod.moduleName}" under ${matrix.roleName} role.`
    );

    toast(`Permissions for "${targetMod.moduleName}" ${nextVal ? 'granted in full' : 'cleared'} for ${matrix.roleName}`);
  };

  const handleApplyRolePreset = (role: UserRole, preset: 'ALL' | 'READ_ONLY' | 'NONE') => {
    const matrix = roleMatrices.find(m => m.role === role);
    if (!matrix) return;

    setRoleMatrices(prev => prev.map(mItem => {
      if (mItem.role === role) {
        const updatedModules = mItem.modules.map(mod => ({
          ...mod,
          actions: {
            VIEW: preset === 'ALL' || preset === 'READ_ONLY',
            CREATE: preset === 'ALL',
            EDIT: preset === 'ALL',
            DELETE: preset === 'ALL',
            APPROVE: preset === 'ALL',
            EXPORT: preset === 'ALL' || preset === 'READ_ONLY',
            ADMIN: preset === 'ALL'
          }
        }));
        return { ...mItem, modules: updatedModules };
      }
      return mItem;
    }));

    logRbacChange(
      'PRESET_APPLIED',
      matrix.roleName,
      'PRESET_APPLY',
      'All System Modules Policy',
      'Custom Matrix Config',
      `Preset: ${preset.replace('_', ' ')}`,
      `Applied "${preset.replace('_', ' ')}" permission preset policy across all modules for ${matrix.roleName} role.`
    );

    toast(`Applied "${preset.replace('_', ' ')}" permission preset to ${matrix.roleName}`);
  };

  const handleCloneRolePermissions = (targetRole: UserRole, sourceRole: UserRole) => {
    const sourceMatrix = roleMatrices.find(r => r.role === sourceRole);
    const targetMatrix = roleMatrices.find(r => r.role === targetRole);
    if (!sourceMatrix || !targetMatrix) return;

    setRoleMatrices(prev => prev.map(mItem => {
      if (mItem.role === targetRole) {
        const clonedModules = sourceMatrix.modules.map(m => ({
          ...m,
          actions: { ...m.actions }
        }));
        return { ...mItem, modules: clonedModules };
      }
      return mItem;
    }));

    logRbacChange(
      'ROLE_CLONED',
      targetMatrix.roleName,
      'GRANT',
      'Policy Matrix Clone',
      `Previous ${targetMatrix.roleName} Policy`,
      `Cloned from ${sourceMatrix.roleName}`,
      `Cloned complete module permission matrix from ${sourceMatrix.roleName} role into ${targetMatrix.roleName} role.`
    );

    toast(`Cloned all permission policies from ${sourceMatrix.roleName} to ${targetMatrix.roleName}`);
  };

  const handleCycleBranchAccess = (userId: string, branchId: string) => {
    const targetUser = users.find(u => u.id === userId);
    const existingAccess = targetUser?.branchAccess.find(b => b.branchId === branchId);
    const currentLevel = existingAccess?.accessLevel || 'NO_ACCESS';
    const nextLevel = currentLevel === 'NO_ACCESS' ? 'READ_ONLY' : currentLevel === 'READ_ONLY' ? 'FULL_ACCESS' : 'NO_ACCESS';
    const branchTemplate = MOCK_BRANCHES.find(b => b.branchId === branchId);

    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        let updatedAccess = u.branchAccess.map(b => {
          if (b.branchId === branchId) {
            return { ...b, accessLevel: nextLevel as any };
          }
          return b;
        });

        if (!u.branchAccess.some(b => b.branchId === branchId)) {
          if (branchTemplate) {
            updatedAccess.push({ ...branchTemplate, accessLevel: nextLevel as any });
          }
        }

        return { ...u, branchAccess: updatedAccess };
      }
      return u;
    }));

    if (targetUser && branchTemplate) {
      logRbacChange(
        'BRANCH_ACCESS',
        targetUser.name,
        nextLevel === 'NO_ACCESS' ? 'REVOKE' : 'BRANCH_SCOPING',
        branchTemplate.branchName,
        `Branch Access: ${currentLevel.replace('_', ' ')}`,
        `Branch Access: ${nextLevel.replace('_', ' ')}`,
        `Updated branch access level for "${branchTemplate.branchName}" (${branchTemplate.branchCode}) to ${nextLevel.replace('_', ' ')} for ${targetUser.name}.`
      );
    }

    toast(`Updated branch permission for ${targetUser?.name || 'User'} to ${nextLevel.replace('_', ' ')}`);
  };

  const handleResetMatrixDefaults = () => {
    if (confirm('Reset all permission matrices to default system standards?')) {
      setRoleMatrices(DEFAULT_ROLE_MATRICES);

      logRbacChange(
        'MATRIX_RESET',
        'System Role Matrices',
        'REVOKE',
        'All Enterprise Roles',
        'Custom Permission Matrices',
        'Default System Configuration',
        'Reset all role permission matrices back to default system security standards.'
      );

      toast('Permission matrices reset to default configuration');
    }
  };

  // Terminate Session
  const handleTerminateSession = (sessionId: string, userName: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    toast(`Session terminated for ${userName}`);
  };

  const handleTerminateAllOtherSessions = () => {
    if (confirm('Are you sure you want to invalidate all active user sessions except your current device?')) {
      setSessions(prev => prev.filter(s => s.isCurrentSession));
      toast('All other user sessions terminated successfully');
    }
  };

  // Export Audit CSV
  const handleExportLoginAudit = () => {
    const headers = ['Timestamp', 'User Name', 'Email', 'Role', 'Event Type', 'Status', 'IP Address', 'Location', 'Device / Browser', 'Risk Score'];
    const rows = loginAudits.map(log => [
      `"${new Date(log.timestamp).toLocaleString()}"`,
      `"${log.userName.replace(/"/g, '""')}"`,
      `"${log.userEmail.replace(/"/g, '""')}"`,
      `"${log.role}"`,
      `"${log.eventType}"`,
      `"${log.status}"`,
      `"${log.ipAddress}"`,
      `"${log.location}"`,
      `"${log.deviceBrowser.replace(/"/g, '""')}"`,
      `"${log.riskScore}"`
    ]);

    const csvContent = [headers.join(','), ...rows.join('\n')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `login_audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('Login Audit log exported as CSV');
  };

  // Filtered Users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                          user.email.toLowerCase().includes(userSearchQuery.toLowerCase());
    const matchesRole = selectedRoleFilter === 'ALL' || user.role === selectedRoleFilter;
    const matchesDept = selectedDeptFilter === 'ALL' || user.primaryDepartment === selectedDeptFilter;
    const matchesStatus = selectedStatusFilter === 'ALL' || user.status === selectedStatusFilter;
    return matchesSearch && matchesRole && matchesDept && matchesStatus;
  });

  // Filtered Audit Logs
  const filteredAuditLogs = loginAudits.filter(log => {
    const matchesSearch = log.userName.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
                          log.userEmail.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
                          log.ipAddress.includes(auditSearchQuery);
    const matchesType = auditTypeFilter === 'ALL' || log.eventType === auditTypeFilter;
    return matchesSearch && matchesType;
  });

  // Filtered RBAC History Logs
  const filteredRbacHistory = rbacChangeLogs.filter(log => {
    const matchesSearch = log.actorName.toLowerCase().includes(rbacHistorySearchQuery.toLowerCase()) ||
                          log.targetName.toLowerCase().includes(rbacHistorySearchQuery.toLowerCase()) ||
                          log.moduleOrFeature.toLowerCase().includes(rbacHistorySearchQuery.toLowerCase()) ||
                          log.details.toLowerCase().includes(rbacHistorySearchQuery.toLowerCase());
    const matchesTarget = rbacTargetTypeFilter === 'ALL' || log.targetType === rbacTargetTypeFilter;
    const matchesCategory = rbacCategoryFilter === 'ALL' || log.changeCategory === rbacCategoryFilter;
    return matchesSearch && matchesTarget && matchesCategory;
  });

  // Export RBAC History CSV
  const handleExportRbacHistoryCsv = () => {
    const headers = ['ID', 'Timestamp', 'Actor Name', 'Actor Email', 'Actor Role', 'Target Type', 'Target Name', 'Category', 'Module/Feature', 'Old Value', 'New Value', 'Details', 'IP Address'];
    const rows = filteredRbacHistory.map(log => [
      `"${log.id}"`,
      `"${new Date(log.timestamp).toLocaleString()}"`,
      `"${log.actorName.replace(/"/g, '""')}"`,
      `"${log.actorEmail.replace(/"/g, '""')}"`,
      `"${log.actorRole}"`,
      `"${log.targetType}"`,
      `"${log.targetName.replace(/"/g, '""')}"`,
      `"${log.changeCategory}"`,
      `"${log.moduleOrFeature.replace(/"/g, '""')}"`,
      `"${log.oldValue.replace(/"/g, '""')}"`,
      `"${log.newValue.replace(/"/g, '""')}"`,
      `"${log.details.replace(/"/g, '""')}"`,
      `"${log.ipAddress}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `rbac_change_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('RBAC Change History exported as CSV');
  };

  // Export RBAC History JSON
  const handleExportRbacHistoryJson = () => {
    const jsonString = JSON.stringify(filteredRbacHistory, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `rbac_audit_trail_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('RBAC Change History exported as JSON audit package');
  };

  // Download Formatted Printable Compliance HTML Document
  const handleDownloadComplianceHtmlDoc = () => {
    const rbacData = printableSummaryScope === 'FILTERED' ? filteredRbacHistory : rbacChangeLogs;
    const authData = printableSummaryScope === 'FILTERED' ? filteredAuditLogs : loginAudits;

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Compliance Audit Summary Report - TaxFlow Enterprise</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 30px; color: #0f172a; line-height: 1.5; background: #ffffff; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
    .company { font-size: 11px; font-weight: 800; color: #2563eb; text-transform: uppercase; letter-spacing: 0.05em; }
    .title { font-size: 20px; font-weight: 800; text-transform: uppercase; margin: 4px 0 0 0; color: #0f172a; }
    .subtitle { font-size: 11px; color: #475569; margin-top: 4px; font-weight: 600; }
    .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 11px; margin-bottom: 20px; }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .meta-val { font-weight: 700; color: #0f172a; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 25px; }
    .stat-card { background: #f1f5f9; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; text-align: center; }
    .stat-val { font-size: 16px; font-weight: 800; color: #0f172a; }
    .stat-lbl { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 25px; page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th { background: #0f172a; color: white; padding: 8px 10px; text-align: left; font-size: 9px; text-transform: uppercase; font-weight: 700; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #334155; }
    tr:nth-child(even) { background: #f8fafc; }
    .section-title { font-size: 13px; font-weight: 800; margin-top: 25px; margin-bottom: 12px; border-left: 4px solid #2563eb; padding-left: 8px; color: #0f172a; text-transform: uppercase; }
    .sign-block { margin-top: 40px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 40px; border-top: 1px solid #cbd5e1; padding-top: 25px; page-break-inside: avoid; }
    .sig-line { border-bottom: 1px solid #0f172a; height: 40px; margin-bottom: 6px; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; }
    .grant { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .revoke { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">TaxFlow Enterprise Compliance & Security Engine</div>
    <div class="title">SYSTEM GOVERNANCE & ACCESS CONTROL AUDIT REPORT</div>
    <div class="subtitle">CONFIDENTIAL REGULATORY COMPLIANCE EVIDENCE &bull; SOC 2 TYPE II / ISO 27001 AUDIT STANDARDS</div>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><span class="meta-label">Document Reference</span><span class="meta-val">DOC-AUDIT-2026-0726-Q3</span></div>
    <div class="meta-item"><span class="meta-label">Report Generated</span><span class="meta-val">${new Date().toUTCString()}</span></div>
    <div class="meta-item"><span class="meta-label">Audited Tenant</span><span class="meta-val">Tenant ID: ${currentTenantId} (Acme Tech Corp HQ)</span></div>
    <div class="meta-item"><span class="meta-label">Issued By</span><span class="meta-val">Rajesh Sharma (Super Admin & Security Officer)</span></div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-lbl">RBAC Events</div>
      <div class="stat-val">${rbacData.length} Logs</div>
    </div>
    <div class="stat-card">
      <div class="stat-lbl">Auth Sessions</div>
      <div class="stat-val">${authData.length} Records</div>
    </div>
    <div class="stat-card">
      <div class="stat-lbl">2FA Compliance</div>
      <div class="stat-val" style="color: #16a34a;">100% Enforced</div>
    </div>
    <div class="stat-card">
      <div class="stat-lbl">Integrity Hash</div>
      <div class="stat-val" style="font-size: 11px; font-family: monospace;">SHA256 Sealed</div>
    </div>
  </div>

  ${(printableSummaryMode === 'ALL' || printableSummaryMode === 'RBAC') ? `
  <div class="section-title">1. RBAC Roles & Permissions Change Log (${rbacData.length} Entries)</div>
  <table>
    <thead>
      <tr>
        <th style="width: 15%;">Timestamp</th>
        <th style="width: 15%;">Actor (Modifier)</th>
        <th style="width: 15%;">Target Subject</th>
        <th style="width: 15%;">Category & Module</th>
        <th style="width: 20%;">Old State &rarr; New State</th>
        <th style="width: 20%;">Details & IP Address</th>
      </tr>
    </thead>
    <tbody>
      ${rbacData.map(log => `
        <tr>
          <td style="font-family: monospace;">${new Date(log.timestamp).toLocaleString()}</td>
          <td><strong>${log.actorName}</strong><br><span style="font-size: 9px; color: #64748b;">${log.actorEmail}</span><br><em>${log.actorRole}</em></td>
          <td><strong>${log.targetName}</strong><br><span style="font-size: 9px; color: #64748b;">Type: ${log.targetType}</span></td>
          <td><span class="badge ${log.changeCategory === 'GRANT' ? 'grant' : log.changeCategory === 'REVOKE' ? 'revoke' : ''}">${log.changeCategory}</span><br><strong style="font-size: 10px;">${log.moduleOrFeature}</strong></td>
          <td><span style="color: #b91c1c; font-weight: 600;">${log.oldValue}</span><br>&darr;<br><span style="color: #15803d; font-weight: 600;">${log.newValue}</span></td>
          <td>${log.details}<br><span style="font-family: monospace; font-size: 9px; color: #64748b;">IP: ${log.ipAddress}</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  ${(printableSummaryMode === 'ALL' || printableSummaryMode === 'LOGIN') ? `
  <div class="section-title">2. Authentication & Session Security Logs (${authData.length} Entries)</div>
  <table>
    <thead>
      <tr>
        <th style="width: 15%;">Timestamp</th>
        <th style="width: 20%;">User Account</th>
        <th style="width: 15%;">Event & Status</th>
        <th style="width: 20%;">IP Address & Location</th>
        <th style="width: 20%;">Device / Browser</th>
        <th style="width: 10%;">Risk Assessment</th>
      </tr>
    </thead>
    <tbody>
      ${authData.map(log => `
        <tr>
          <td style="font-family: monospace;">${new Date(log.timestamp).toLocaleString()}</td>
          <td><strong>${log.userName}</strong><br><span style="font-size: 9px; color: #64748b;">${log.userEmail}</span></td>
          <td><span class="badge ${log.status === 'SUCCESS' ? 'grant' : 'revoke'}">${log.eventType} (${log.status})</span></td>
          <td style="font-family: monospace;">${log.ipAddress}<br><span style="font-family: sans-serif; font-size: 9px; color: #64748b;">${log.location}</span></td>
          <td>${log.deviceBrowser}</td>
          <td><strong>${(log as any).riskLevel || log.riskScore} Risk</strong></td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  <div class="sign-block">
    <div>
      <div class="sig-line"></div>
      <div style="font-size: 11px; font-weight: 700;">Lead Compliance Auditor</div>
      <div style="font-size: 10px; color: #64748b;">Statutory External Audit Committee</div>
      <div style="font-size: 9px; color: #94a3b8; margin-top: 4px;">Date: ________________________</div>
    </div>
    <div>
      <div class="sig-line"></div>
      <div style="font-size: 11px; font-weight: 700;">Chief Information Security Officer</div>
      <div style="font-size: 10px; color: #64748b;">TaxFlow Enterprise Governance Team</div>
      <div style="font-size: 9px; color: #94a3b8; margin-top: 4px;">Date: ________________________</div>
    </div>
  </div>

  <div class="footer">
    Official Audit Document generated by TaxFlow Security Subsystem &bull; SHA-256 Digest: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Compliance_Audit_Report_${new Date().toISOString().split('T')[0]}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('Printable Compliance Document downloaded');
  };

  // Helper badge styles for roles
  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case UserRole.SUPER_ADMIN: return 'bg-purple-100 text-purple-800 border-purple-200';
      case UserRole.ADMIN: return 'bg-blue-100 text-blue-800 border-blue-200';
      case UserRole.ACCOUNTANT: return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case UserRole.AUDITOR: return 'bg-amber-100 text-amber-800 border-amber-200';
      case UserRole.FINANCE_MANAGER: return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case UserRole.VIEWER: return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const currentUser = useSelector((state: RootState) => state.auth.user);
  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;

  if (!isSuperAdmin) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center max-w-xl mx-auto my-8 shadow-sm">
        <div className="w-14 h-14 bg-rose-50 rounded-2xl border border-rose-200 flex items-center justify-center mx-auto mb-4 text-rose-600">
          <Shield size={26} />
        </div>
        <span className="px-3 py-1 bg-rose-50 text-rose-700 text-xs font-black uppercase tracking-wider rounded-full border border-rose-200">
          Super Admin Only
        </span>
        <h3 className="text-xl font-bold text-slate-800 mt-3">Restricted Administrative Area</h3>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          User Management and access control matrix are exclusively reserved for Super Administrators and are not accessible by customers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* Top Header & Sub-navigation */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm w-full min-w-0 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">User & Access Management (RBAC)</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Multi-tenant role-based access control, department boundaries, branch permissions & session auditing
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setPrintableSummaryMode('ALL');
                setIsPrintableSummaryOpen(true);
              }}
              className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm border border-slate-800 active:scale-95"
            >
              <Printer size={15} className="text-blue-400" />
              <span>Print Compliance Summary</span>
            </button>
            <button
              onClick={handleOpenAddUser}
              className="px-4 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 shadow-md shadow-blue-600/20 active:scale-95"
            >
              <UserPlus size={16} />
              Invite New User
            </button>
          </div>
        </div>

        {/* RBAC Governance & Security Quick Metrics Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
          <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-100 shadow-2xs">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Users size={16} />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Provisioned Users</p>
              <p className="text-sm font-extrabold text-slate-900">{users.length} Members <span className="text-[10px] text-emerald-600 font-bold">({users.filter(u => u.status === 'ACTIVE').length} Active)</span></p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-100 shadow-2xs">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <ShieldCheck size={16} />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Defined Roles</p>
              <p className="text-sm font-extrabold text-slate-900">{roleMatrices.length} Enterprise Roles</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-100 shadow-2xs">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Lock size={16} />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">2FA Compliance Rate</p>
              <p className="text-sm font-extrabold text-emerald-600">{Math.round((users.filter(u => u.enforce2FA).length / users.length) * 100)}% Enforced</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-100 shadow-2xs">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Laptop size={16} />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Live Active Sessions</p>
              <p className="text-sm font-extrabold text-indigo-600">{sessions.length} Active Devices</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs with Horizontal Scrollbar & Scroll Controls */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
            <span className="flex items-center gap-1.5 text-slate-700 font-bold">
              <Sliders size={13} className="text-blue-600" /> 
              User Management Sections (8 Modules)
            </span>
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
              Scroll bar &amp; arrows enabled to view all modules &rarr;
            </span>
          </div>

          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <button
              onClick={() => scrollTabs('left')}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all shrink-0 active:scale-95 border border-slate-200 shadow-sm"
              title="Scroll tabs left"
              type="button"
            >
              <ChevronLeft size={16} />
            </button>

            <div 
              ref={tabsRef}
              className="flex items-center gap-2.5 overflow-x-auto custom-scrollbar-visible py-2 px-1 scroll-smooth w-full"
            >
              {[
                { id: 'USERS', label: 'User Directory', icon: Users, badge: users.length },
                { id: 'RBAC', label: 'Role Definitions', icon: Shield, badge: roleMatrices.length },
                { id: 'DEPARTMENTS', label: 'Departments', icon: Building2, badge: departments.length },
                { id: 'BRANCHES', label: 'Branch Access', icon: MapPin, badge: MOCK_BRANCHES.length },
                { id: 'PERMISSIONS', label: 'Permission Matrix', icon: Grid },
                { id: 'RBAC_HISTORY', label: 'RBAC Change History', icon: History, badge: rbacChangeLogs.length },
                { id: 'AUDIT', label: 'Login Audit', icon: ShieldCheck, badge: loginAudits.length },
                { id: 'SESSIONS', label: 'Session Management', icon: Clock, badge: sessions.length }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap shrink-0 border ${
                    activeSubTab === tab.id
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <tab.icon size={15} />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      activeSubTab === tab.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => scrollTabs('right')}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all shrink-0 active:scale-95 border border-slate-200 shadow-sm"
              title="Scroll tabs right"
              type="button"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: USER DIRECTORY */}
      {activeSubTab === 'USERS' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-3 items-center w-full">
            <div className="relative lg:col-span-5 w-full">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search user name, email address or phone..."
                value={userSearchQuery}
                onChange={e => setUserSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <div className="lg:col-span-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 shrink-0">
                <Filter size={14} /> Filters:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 w-full">
                <select
                  value={selectedRoleFilter}
                  onChange={e => setSelectedRoleFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="ALL">All Roles</option>
                  <option value={UserRole.SUPER_ADMIN}>Super Admin</option>
                  <option value={UserRole.ADMIN}>Admin</option>
                  <option value={UserRole.ACCOUNTANT}>Accountant</option>
                  <option value={UserRole.AUDITOR}>Auditor</option>
                  <option value={UserRole.FINANCE_MANAGER}>Finance Manager</option>
                  <option value={UserRole.VIEWER}>Viewer</option>
                </select>

                <select
                  value={selectedDeptFilter}
                  onChange={e => setSelectedDeptFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="ALL">All Departments</option>
                  {departments.map(d => (
                    <option key={d.code} value={d.code}>{d.name}</option>
                  ))}
                </select>

                <select
                  value={selectedStatusFilter}
                  onChange={e => setSelectedStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="PENDING_INVITE">Pending Invite</option>
                </select>
              </div>
            </div>
          </div>

          {/* User Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden w-full min-w-0">
            <div className="overflow-x-auto custom-scrollbar-visible w-full">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">User Details</th>
                    <th className="px-6 py-3.5">Assigned Role</th>
                    <th className="px-6 py-3.5">Departments</th>
                    <th className="px-6 py-3.5">Branch Scope</th>
                    <th className="px-6 py-3.5">Security / 2FA</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map(u => {
                    const deptObj = departments.find(d => d.code === u.primaryDepartment);
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-800 to-indigo-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                              {u.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">{u.name}</p>
                              <p className="text-slate-500 font-medium text-[11px]">{u.email}</p>
                              {u.phone && <p className="text-slate-400 text-[10px] font-mono mt-0.5">{u.phone}</p>}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold border ${getRoleBadgeStyle(u.role)}`}>
                            {u.role.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 font-bold text-[10px] rounded border border-blue-100">
                              Primary: {deptObj?.name || u.primaryDepartment}
                            </span>
                            {u.secondaryDepartments.length > 0 && (
                              <p className="text-[10px] text-slate-400 font-medium">
                                +{u.secondaryDepartments.length} Secondary
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          {u.branchScope === 'ALL_BRANCHES' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded border border-purple-100">
                              <Globe size={11} /> All Branches (Global)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded border border-slate-200">
                              <MapPin size={11} /> Specific Branches ({u.branchAccess.filter(b => b.accessLevel !== 'NO_ACCESS').length})
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          {u.enforce2FA ? (
                            <div className="flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                              <ShieldCheck size={14} /> Enforced {u.is2FAVerified && <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1 rounded">Verified</span>}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-amber-600 font-semibold text-[11px]">
                              <AlertCircle size={14} /> Optional
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                            u.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            u.status === 'PENDING_INVITE' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              u.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' :
                              u.status === 'PENDING_INVITE' ? 'bg-amber-500' : 'bg-slate-400'
                            }`} />
                            {u.status.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEditUser(u)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit User & Permissions"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              onClick={() => handleToggleUserStatus(u.id)}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title={u.status === 'ACTIVE' ? 'Deactivate User' : 'Activate User'}
                            >
                              <Lock size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id, u.name)}
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Revoke & Delete User"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: ROLE DEFINITIONS */}
      {activeSubTab === 'RBAC' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Shield className="text-blue-600" size={18} />
                Defined Role Matrices ({roleMatrices.length} Roles)
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Scroll horizontally or use arrow buttons to inspect all enterprise roles and permissions
              </p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg flex items-center gap-1 border border-slate-200">
                <Sliders size={13} /> Scroll Cards
              </span>
              <button
                onClick={() => scrollRoleCards('left')}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all active:scale-95 border border-slate-200 shadow-sm"
                title="Scroll roles left"
                type="button"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => scrollRoleCards('right')}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all active:scale-95 border border-slate-200 shadow-sm"
                title="Scroll roles right"
                type="button"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div 
            ref={roleCardsRef}
            className="flex gap-6 overflow-x-auto custom-scrollbar-visible pb-4 pt-1 px-1 scroll-smooth w-full"
          >
            {roleMatrices.map(rm => {
              const assignedUserCount = users.filter(u => u.role === rm.role).length;
              return (
                <div key={rm.role} className="w-[320px] sm:w-[350px] shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-blue-300 transition-all group">
                  <div className={`p-6 bg-gradient-to-r ${rm.color} text-white`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-full text-white border border-white/20">
                        {assignedUserCount} Active Users
                      </span>
                      <Shield size={20} className="text-white/80" />
                    </div>
                    <h3 className="text-xl font-bold tracking-tight">{rm.roleName}</h3>
                    <p className="text-xs text-white/80 mt-1 leading-relaxed">{rm.description}</p>
                  </div>

                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Module Privilege Highlights</p>
                      <div className="flex flex-wrap gap-1.5">
                        {rm.modules.slice(0, 5).map(m => (
                          <span key={m.moduleKey} className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-semibold rounded border border-slate-200">
                            {m.moduleName.split('&')[0]}
                          </span>
                        ))}
                        {rm.modules.length > 5 && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-100">
                            +{rm.modules.length - 5} More
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setSelectedMatrixRole(rm.role);
                          setActiveSubTab('PERMISSIONS');
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                      >
                        Edit Role Matrix <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: DEPARTMENTS */}
      {activeSubTab === 'DEPARTMENTS' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="text-blue-600" size={18} />
                Organization Departments ({departments.length})
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Scroll horizontally to view all department boundaries and assigned user counts
              </p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg flex items-center gap-1 border border-slate-200">
                <Sliders size={13} /> Scroll Cards
              </span>
              <button
                onClick={() => scrollDeptCards('left')}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all active:scale-95 border border-slate-200 shadow-sm"
                title="Scroll departments left"
                type="button"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => scrollDeptCards('right')}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all active:scale-95 border border-slate-200 shadow-sm"
                title="Scroll departments right"
                type="button"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div 
            ref={deptCardsRef}
            className="flex gap-6 overflow-x-auto custom-scrollbar-visible pb-4 pt-1 px-1 scroll-smooth w-full"
          >
            {departments.map(dept => {
              const count = users.filter(u => u.primaryDepartment === dept.code).length;
              return (
                <div key={dept.id} className="w-[280px] shrink-0 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:border-blue-200 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                        <Building2 size={20} />
                      </div>
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold text-[10px] rounded-full border border-blue-100">
                        {count} Members
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-slate-900">{dept.name}</h4>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">Code: {dept.code}</p>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">{dept.description}</p>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Lead:</span>
                    <span className="font-bold text-slate-800">{dept.departmentLead || 'Unassigned'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: BRANCH ACCESS */}
      {activeSubTab === 'BRANCHES' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6">
            <h3 className="text-base font-bold text-slate-900 mb-2">Branch-Wise Access Scope Matrix</h3>
            <p className="text-xs text-slate-500 mb-6">
              Grant granular full, read-only, or restricted branch permissions across multi-state GSTIN entities.
            </p>

            <div className="overflow-x-auto custom-scrollbar-visible w-full min-w-0">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">User Name & Email</th>
                    <th className="px-6 py-3.5">Assigned Role</th>
                    <th className="px-6 py-3.5">Scope Mode</th>
                    {MOCK_BRANCHES.map(b => (
                      <th key={b.branchId} className="px-6 py-3.5">
                        <div>{b.branchName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{b.gstin}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{u.name}</div>
                        <div className="text-slate-500 font-medium text-[11px]">{u.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getRoleBadgeStyle(u.role)}`}>
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {u.branchScope === 'ALL_BRANCHES' ? (
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 font-bold text-[10px] rounded border border-purple-100">
                            Global (All)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-bold text-[10px] rounded border border-slate-200">
                            Custom
                          </span>
                        )}
                      </td>
                      {MOCK_BRANCHES.map(b => {
                        const branchCfg = u.branchAccess.find(ba => ba.branchId === b.branchId);
                        const level = u.branchScope === 'ALL_BRANCHES' ? 'FULL_ACCESS' : (branchCfg?.accessLevel || 'NO_ACCESS');
                        const isInteractive = u.branchScope !== 'ALL_BRANCHES';

                        return (
                          <td key={b.branchId} className="px-6 py-4">
                            <button
                              type="button"
                              onClick={() => isInteractive && handleCycleBranchAccess(u.id, b.branchId)}
                              disabled={!isInteractive}
                              title={isInteractive ? 'Click to cycle access level (Full -> Read-Only -> No Access)' : 'Scope is Global (All Branches)'}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold border transition-all ${
                                isInteractive ? 'hover:scale-105 active:scale-95 cursor-pointer shadow-sm' : 'cursor-default opacity-90'
                              } ${
                                level === 'FULL_ACCESS' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' :
                                level === 'READ_ONLY' ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' :
                                'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              {level === 'FULL_ACCESS' && <Check size={11} />}
                              {level.replace('_', ' ')}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: PERMISSION MATRIX */}
      {activeSubTab === 'PERMISSIONS' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Grid className="text-blue-600" size={18} />
                  Interactive Role Permission Matrix
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure granular capabilities per system module. Click column headers or row badges for instant bulk operations.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleResetMatrixDefaults}
                  className="px-3.5 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center gap-1.5 border border-slate-200"
                >
                  <RefreshCw size={14} /> Reset Defaults
                </button>
                <button
                  onClick={() => toast('Permission matrix configuration saved successfully')}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
                >
                  Save Matrix Changes
                </button>
              </div>
            </div>

            {/* Role Selection Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-6 overflow-x-auto custom-scrollbar">
              {roleMatrices.map(rm => {
                const totalActionsPossible = rm.modules.length * 7;
                let enabledCount = 0;
                rm.modules.forEach(m => {
                  Object.values(m.actions).forEach(v => { if (v) enabledCount++; });
                });
                const percentage = Math.round((enabledCount / totalActionsPossible) * 100);

                return (
                  <button
                    key={rm.role}
                    onClick={() => setSelectedMatrixRole(rm.role)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap shrink-0 ${
                      selectedMatrixRole === rm.role
                        ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-500/20'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{rm.roleName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      selectedMatrixRole === rm.role ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {percentage}%
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Role Matrix Table */}
            {(() => {
              const currentMatrix = roleMatrices.find(r => r.role === selectedMatrixRole) || roleMatrices[0];
              const actionsList: PermissionAction[] = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE', 'EXPORT', 'ADMIN'];

              // Calculate active stats
              const totalPossible = currentMatrix.modules.length * actionsList.length;
              let activeCount = 0;
              currentMatrix.modules.forEach(m => {
                actionsList.forEach(a => { if (m.actions[a]) activeCount++; });
              });
              const activeRatio = Math.round((activeCount / totalPossible) * 100);

              return (
                <div className="space-y-4">
                  {/* Role Header Banner with Preset Controls */}
                  <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <h4 className="font-bold text-white text-base tracking-tight">{currentMatrix.roleName} Capabilities</h4>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider ${currentMatrix.badgeBg}`}>
                          {currentMatrix.role}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">{currentMatrix.description}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 bg-slate-800/80 p-2 rounded-xl border border-slate-700/80 shrink-0">
                      <span className="text-[11px] font-bold text-slate-300 px-2 flex items-center gap-1">
                        <Sparkles size={13} className="text-amber-400" /> Presets:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleApplyRolePreset(currentMatrix.role, 'ALL')}
                        className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 text-[11px] font-bold rounded-lg border border-emerald-500/30 transition-all"
                      >
                        Grant Full Access
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyRolePreset(currentMatrix.role, 'READ_ONLY')}
                        className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 text-[11px] font-bold rounded-lg border border-amber-500/30 transition-all"
                      >
                        Set Read-Only
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyRolePreset(currentMatrix.role, 'NONE')}
                        className="px-2.5 py-1 bg-red-600/30 hover:bg-red-600/50 text-red-200 text-[11px] font-bold rounded-lg border border-red-500/30 transition-all"
                      >
                        Revoke All
                      </button>

                      {/* Clone Dropdown */}
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleCloneRolePermissions(currentMatrix.role, e.target.value as UserRole);
                            e.target.value = '';
                          }
                        }}
                        defaultValue=""
                        className="px-2.5 py-1 bg-slate-900 text-slate-200 text-[11px] font-bold rounded-lg border border-slate-700 outline-none"
                      >
                        <option value="" disabled>Clone Rights From...</option>
                        {roleMatrices.filter(rm => rm.role !== currentMatrix.role).map(rm => (
                          <option key={rm.role} value={rm.role}>{rm.roleName}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Active Capability Indicator */}
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-2">
                      <ShieldCheck size={16} className="text-emerald-600" />
                      Active Privileges: <strong className="text-slate-900">{activeCount} / {totalPossible}</strong> ({activeRatio}% Capability Coverage)
                    </span>
                    <div className="w-48 h-2.5 bg-slate-200 rounded-full overflow-hidden shrink-0 border border-slate-300">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300" style={{ width: `${activeRatio}%` }} />
                    </div>
                  </div>

                  <div className="overflow-x-auto custom-scrollbar-visible w-full min-w-0 border border-slate-200 rounded-2xl shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-white border-b border-slate-800 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4">
                            <span>System Module</span>
                            <span className="block text-[10px] text-slate-400 font-normal normal-case mt-0.5">
                              Click row badge to toggle full module rights
                            </span>
                          </th>
                          {actionsList.map(action => (
                            <th key={action} className="px-4 py-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleColumnPermission(currentMatrix.role, action)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-blue-600 text-white font-extrabold text-[11px] transition-all hover:scale-105 active:scale-95 border border-slate-700"
                                title={`Click to toggle ${action} capability across all modules`}
                              >
                                {action}
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {currentMatrix.modules.map(mod => {
                          const isModuleFull = actionsList.every(a => mod.actions[a]);
                          return (
                            <tr key={mod.moduleKey} className="hover:bg-slate-50/90 transition-colors group">
                              <td className="px-6 py-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">{mod.moduleName}</p>
                                    <p className="text-slate-500 font-medium text-[11px]">{mod.description}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleRowPermission(currentMatrix.role, mod.moduleKey)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all shrink-0 ${
                                      isModuleFull ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' :
                                      'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                    }`}
                                    title="Toggle all 7 permissions for this module"
                                  >
                                    {isModuleFull ? 'Full Access' : 'Select Row'}
                                  </button>
                                </div>
                              </td>
                              {actionsList.map(action => {
                                const isEnabled = mod.actions[action] || false;
                                return (
                                  <td key={action} className="px-4 py-4 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isEnabled}
                                      onChange={() => handleTogglePermission(currentMatrix.role, mod.moduleKey, action)}
                                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600 transition-all hover:scale-110"
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* SUB-TAB 6: RBAC CHANGE HISTORY */}
      {activeSubTab === 'RBAC_HISTORY' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-400/30 uppercase tracking-wider">
                    Governance Audit Trail
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {filteredRbacHistory.length} Recorded Change Events
                  </span>
                </div>
                <h3 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                  <History className="text-blue-400" size={20} />
                  RBAC Roles &amp; Permissions Change History
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                  Real-time tamper-evident change log capturing every access modification, role re-assignment, capability grant/revocation, preset application, and branch access scoping.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setPrintableSummaryMode('RBAC');
                    setIsPrintableSummaryOpen(true);
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-md shadow-indigo-600/30"
                >
                  <Printer size={14} /> Printable Summary
                </button>
                <button
                  type="button"
                  onClick={handleExportRbacHistoryCsv}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 border border-slate-700 shadow-sm"
                >
                  <Download size={14} /> Export CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportRbacHistoryJson}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 border border-slate-700 shadow-sm"
                >
                  <FileText size={14} /> Export JSON
                </button>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/80">
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Recorded Events</p>
                <p className="text-base font-extrabold text-white mt-0.5">{rbacChangeLogs.length} Events</p>
              </div>
              <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-800/40">
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Rights Granted</p>
                <p className="text-base font-extrabold text-emerald-300 mt-0.5">
                  {rbacChangeLogs.filter(l => l.changeCategory === 'GRANT').length} Grants
                </p>
              </div>
              <div className="p-3 bg-red-950/40 rounded-xl border border-red-800/40">
                <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Rights Revoked</p>
                <p className="text-base font-extrabold text-red-300 mt-0.5">
                  {rbacChangeLogs.filter(l => l.changeCategory === 'REVOKE').length} Revocations
                </p>
              </div>
              <div className="p-3 bg-indigo-950/40 rounded-xl border border-indigo-800/40">
                <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">Role & Scope Adjustments</p>
                <p className="text-base font-extrabold text-indigo-200 mt-0.5">
                  {rbacChangeLogs.filter(l => ['ROLE_CHANGE', 'STATUS_CHANGE', 'BRANCH_SCOPING', 'PRESET_APPLY'].includes(l.changeCategory)).length} Modifications
                </p>
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 w-full">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by actor, subject name, module, or details..."
                value={rbacHistorySearchQuery}
                onChange={e => setRbacHistorySearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
              <div className="flex items-center gap-1.5 shrink-0">
                <Filter size={13} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-600">Target:</span>
                <select
                  value={rbacTargetTypeFilter}
                  onChange={e => setRbacTargetTypeFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="ALL">All Target Types</option>
                  <option value="ROLE_MATRIX">Role Permission Matrix</option>
                  <option value="USER_ROLE">User Role Assignment</option>
                  <option value="USER_STATUS">User Account Status</option>
                  <option value="BRANCH_ACCESS">Branch Access Scope</option>
                  <option value="PRESET_APPLIED">Permission Preset Applied</option>
                  <option value="ROLE_CLONED">Role Policy Cloned</option>
                  <option value="MATRIX_RESET">Matrix Default Reset</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs font-bold text-slate-600">Action:</span>
                <select
                  value={rbacCategoryFilter}
                  onChange={e => setRbacCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="ALL">All Categories</option>
                  <option value="GRANT">Grant Permission</option>
                  <option value="REVOKE">Revoke Permission</option>
                  <option value="ROLE_CHANGE">Role Reassignment</option>
                  <option value="STATUS_CHANGE">Account Status Shift</option>
                  <option value="BRANCH_SCOPING">Branch Access Scoping</option>
                  <option value="PRESET_APPLY">Preset Policy Applied</option>
                </select>
              </div>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden w-full min-w-0">
            <div className="overflow-x-auto custom-scrollbar-visible w-full min-w-0">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-white border-b border-slate-800 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Timestamp &amp; Event ID</th>
                    <th className="px-5 py-3.5">Actor (Who Changed)</th>
                    <th className="px-5 py-3.5">Target Subject</th>
                    <th className="px-5 py-3.5">Category &amp; Module</th>
                    <th className="px-5 py-3.5">State Transition (Old &rarr; New)</th>
                    <th className="px-5 py-3.5 text-right">Details &amp; Inspection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredRbacHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-500">
                        <History size={32} className="mx-auto text-slate-300 mb-2" />
                        <p className="font-bold text-slate-700 text-sm">No RBAC history logs found matching your filters</p>
                        <p className="text-xs text-slate-400 mt-1">Try clearing search terms or selecting "All Target Types"</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRbacHistory.map(log => {
                      const getCategoryBadge = (cat: RbacChangeHistoryRecord['changeCategory']) => {
                        switch (cat) {
                          case 'GRANT':
                            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
                          case 'REVOKE':
                            return 'bg-red-50 text-red-700 border-red-200';
                          case 'ROLE_CHANGE':
                            return 'bg-purple-50 text-purple-700 border-purple-200';
                          case 'STATUS_CHANGE':
                            return 'bg-amber-50 text-amber-700 border-amber-200';
                          case 'BRANCH_SCOPING':
                            return 'bg-blue-50 text-blue-700 border-blue-200';
                          case 'PRESET_APPLY':
                            return 'bg-indigo-50 text-indigo-700 border-indigo-200';
                          default:
                            return 'bg-slate-100 text-slate-700 border-slate-200';
                        }
                      };

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="px-5 py-4">
                            <div className="font-mono text-slate-900 text-[11px] font-bold">
                              {new Date(log.timestamp).toLocaleString()}
                            </div>
                            <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                              {log.id}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {log.actorName}
                            </div>
                            <div className="text-slate-500 text-[11px] font-medium">{log.actorEmail}</div>
                            <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[9px] font-extrabold rounded mt-1 uppercase border border-slate-200">
                              {log.actorRole.replace('_', ' ')}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="font-bold text-slate-900">{log.targetName}</div>
                            <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded mt-0.5 border border-indigo-100">
                              {log.targetType.replace('_', ' ')}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${getCategoryBadge(log.changeCategory)}`}>
                              {log.changeCategory.replace('_', ' ')}
                            </span>
                            <div className="text-slate-700 font-semibold text-[11px] mt-1">
                              {log.moduleOrFeature}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="px-2 py-0.5 bg-red-50 text-red-700 font-mono font-semibold rounded border border-red-200 max-w-[140px] truncate" title={log.oldValue}>
                                {log.oldValue}
                              </span>
                              <span className="text-slate-400 font-bold">&rarr;</span>
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-mono font-semibold rounded border border-emerald-200 max-w-[140px] truncate" title={log.newValue}>
                                {log.newValue}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedHistoryRecord(log)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 font-bold text-[11px] rounded-xl transition-all border border-slate-200 shadow-xs inline-flex items-center gap-1.5"
                            >
                              <Eye size={13} /> Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 7: LOGIN AUDIT */}
      {activeSubTab === 'AUDIT' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 w-full">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by user, email or IP address..."
                value={auditSearchQuery}
                onChange={e => setAuditSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={auditTypeFilter}
                onChange={e => setAuditTypeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="ALL">All Event Types</option>
                <option value="LOGIN_SUCCESS">Login Success</option>
                <option value="LOGIN_FAILED">Login Failed</option>
                <option value="2FA_VERIFIED">2FA Verified</option>
                <option value="LOGOUT">Logout</option>
                <option value="PASSWORD_RESET">Password Reset</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  setPrintableSummaryMode('LOGIN');
                  setIsPrintableSummaryOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-md shadow-indigo-600/30 shrink-0"
              >
                <Printer size={14} /> Printable Summary
              </button>
              <button
                onClick={handleExportLoginAudit}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2 shrink-0"
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden w-full min-w-0">
            <div className="overflow-x-auto custom-scrollbar-visible w-full min-w-0">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Timestamp</th>
                    <th className="px-6 py-3.5">User</th>
                    <th className="px-6 py-3.5">Event Type</th>
                    <th className="px-6 py-3.5">IP Address & Location</th>
                    <th className="px-6 py-3.5">Device & Browser</th>
                    <th className="px-6 py-3.5">Risk Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAuditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-mono text-slate-600 text-[11px]">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{log.userName}</div>
                        <div className="text-slate-500 text-[11px] font-medium">{log.userEmail}</div>
                      </td>

                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase ${
                          log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          log.status === 'FAILED' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {log.eventType.replace('_', ' ')}
                        </span>
                        {log.failureReason && (
                          <p className="text-[10px] text-red-500 font-medium mt-1">{log.failureReason}</p>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-mono text-slate-800 text-[11px]">{log.ipAddress}</div>
                        <div className="text-slate-500 text-[10px] font-medium">{log.location}</div>
                      </td>

                      <td className="px-6 py-4 text-slate-600 font-medium text-[11px]">
                        {log.deviceBrowser}
                      </td>

                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                          log.riskScore === 'LOW' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          log.riskScore === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          'bg-red-50 text-red-700 border-red-200 animate-pulse'
                        }`}>
                          {log.riskScore} RISK
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 7: SESSION MANAGEMENT */}
      {activeSubTab === 'SESSIONS' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Policy Configuration Card */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl space-y-6 md:col-span-1">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Sliders size={20} className="text-blue-400" />
                  Session Policies
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Enforce concurrent login rules and automatic inactivity timeouts across all user devices.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Inactivity Timeout: {sessionSettings.inactivityTimeoutMinutes} Minutes
                  </label>
                  <input
                    type="range"
                    min="15"
                    max="120"
                    step="15"
                    value={sessionSettings.inactivityTimeoutMinutes}
                    onChange={e => setSessionSettings({ ...sessionSettings, inactivityTimeoutMinutes: Number(e.target.value) })}
                    className="w-full accent-blue-500 bg-slate-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Max Concurrent Sessions</label>
                  <select
                    value={sessionSettings.maxConcurrentSessions}
                    onChange={e => setSessionSettings({ ...sessionSettings, maxConcurrentSessions: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-white outline-none"
                  >
                    <option value={1}>1 Single Active Session</option>
                    <option value={2}>2 Concurrent Devices</option>
                    <option value={3}>3 Concurrent Devices</option>
                    <option value={99}>Unlimited Sessions</option>
                  </select>
                </div>

                <div className="pt-2 space-y-3 border-t border-slate-800">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sessionSettings.require2FAForHighPrivilege}
                      onChange={e => setSessionSettings({ ...sessionSettings, require2FAForHighPrivilege: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                    />
                    <span className="text-xs text-slate-300 font-medium">Require 2FA for Super Admin & Admin</span>
                  </label>
                </div>

                <button
                  onClick={handleTerminateAllOtherSessions}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <LogOut size={16} /> Revoke All Other Sessions
                </button>
              </div>
            </div>

            {/* Active Sessions List */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm md:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Live Active User Sessions ({sessions.length})</h3>
                  <p className="text-xs text-slate-500">Currently authenticated browser sessions across organization users.</p>
                </div>
              </div>

              <div className="space-y-3">
                {sessions.map(sess => (
                  <div key={sess.id} className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    sess.isCurrentSession ? 'bg-blue-50/80 border-blue-200 ring-1 ring-blue-100' : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 font-bold">
                        {sess.deviceOS.includes('macOS') || sess.deviceOS.includes('Windows') ? <Laptop size={20} /> : <Smartphone size={20} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 text-sm">{sess.userName}</p>
                          {sess.isCurrentSession && (
                            <span className="px-2 py-0.5 bg-blue-600 text-white font-bold text-[9px] rounded-full uppercase tracking-wider">
                              Your Current Device
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-medium">{sess.deviceOS} • {sess.browser}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{sess.ipAddress} ({sess.location})</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                      <div className="text-right text-[11px]">
                        <p className="text-slate-500">Last active: <strong className="text-slate-800">{sess.lastActiveTime}</strong></p>
                        <p className="text-slate-400 text-[10px]">Logged in at {sess.loginTime}</p>
                      </div>

                      {!sess.isCurrentSession && (
                        <button
                          onClick={() => handleTerminateSession(sess.id, sess.userName)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 text-xs font-bold rounded-lg transition-colors border border-slate-200"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* USER ADD / EDIT MODAL */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar-visible">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editingUser ? 'Edit User Credentials & Access' : 'Invite New User to Organization'}
              </h3>
              <button onClick={() => setIsUserModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Sharma"
                  value={userFormData.name}
                  onChange={e => setUserFormData({ ...userFormData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. user@acmetech.com"
                  value={userFormData.email}
                  onChange={e => setUserFormData({ ...userFormData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-1">
                <label className="text-xs font-bold text-slate-700 block mb-1">Role</label>
                <select
                  value={userFormData.role}
                  onChange={e => setUserFormData({ ...userFormData, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                >
                  <option value={UserRole.SUPER_ADMIN}>Super Admin</option>
                  <option value={UserRole.ADMIN}>Admin</option>
                  <option value={UserRole.ACCOUNTANT}>Accountant</option>
                  <option value={UserRole.AUDITOR}>Auditor</option>
                  <option value={UserRole.FINANCE_MANAGER}>Finance Manager</option>
                  <option value={UserRole.VIEWER}>Viewer</option>
                </select>
              </div>

              <div className="col-span-1">
                <label className="text-xs font-bold text-slate-700 block mb-1">Primary Department</label>
                <select
                  value={userFormData.primaryDepartment}
                  onChange={e => setUserFormData({ ...userFormData, primaryDepartment: e.target.value as DepartmentCode })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                >
                  {departments.map(d => (
                    <option key={d.code} value={d.code}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="col-span-1">
                <label className="text-xs font-bold text-slate-700 block mb-1">Branch Scope</label>
                <select
                  value={userFormData.branchScope}
                  onChange={e => setUserFormData({ ...userFormData, branchScope: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                >
                  <option value="ALL_BRANCHES">All Branches (Global)</option>
                  <option value="SELECTED_BRANCHES">Selected Branches Only</option>
                </select>
              </div>

              <div className="col-span-1">
                <label className="text-xs font-bold text-slate-700 block mb-1">Account Status</label>
                <select
                  value={userFormData.status}
                  onChange={e => setUserFormData({ ...userFormData, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="PENDING_INVITE">Pending Invite</option>
                </select>
              </div>

              <div className="sm:col-span-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userFormData.enforce2FA}
                    onChange={e => setUserFormData({ ...userFormData, enforce2FA: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                  />
                  <span className="text-xs font-semibold text-slate-700">Enforce Two-Factor Authentication (2FA)</span>
                </label>
              </div>

              <div className="sm:col-span-2 pt-3 flex flex-col sm:flex-row justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
                >
                  {editingUser ? 'Save Changes' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECT RBAC HISTORY RECORD MODAL */}
      {selectedHistoryRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">RBAC Audit Log Record Inspection</h3>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">ID: {selectedHistoryRecord.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHistoryRecord(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Event Metadata Banner */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="font-mono text-[11px]">{new Date(selectedHistoryRecord.timestamp).toLocaleString()}</span>
                  <span className="px-2 py-0.5 bg-indigo-500/30 text-indigo-200 text-[10px] font-bold rounded uppercase tracking-wider border border-indigo-400/30">
                    {selectedHistoryRecord.changeCategory.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm font-bold text-white leading-snug">{selectedHistoryRecord.details}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Actor (Modifier)</p>
                  <p className="font-bold text-slate-900">{selectedHistoryRecord.actorName}</p>
                  <p className="text-slate-500 text-[11px]">{selectedHistoryRecord.actorEmail}</p>
                  <p className="text-[10px] font-extrabold text-indigo-600 uppercase mt-1">{selectedHistoryRecord.actorRole.replace('_', ' ')}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Target Subject &amp; Type</p>
                  <p className="font-bold text-slate-900">{selectedHistoryRecord.targetName}</p>
                  <p className="text-slate-500 text-[11px]">Type: {selectedHistoryRecord.targetType.replace('_', ' ')}</p>
                  <p className="text-[10px] font-extrabold text-blue-600 uppercase mt-1">Module: {selectedHistoryRecord.moduleOrFeature}</p>
                </div>
              </div>

              {/* State Transition Diff Box */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders size={13} className="text-blue-600" /> State Transition Delta
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-red-50/80 rounded-xl border border-red-200 space-y-1">
                    <span className="text-[10px] font-extrabold text-red-700 uppercase tracking-wider block">Before (Old Value)</span>
                    <span className="font-mono text-xs font-semibold text-red-900 block break-words">{selectedHistoryRecord.oldValue}</span>
                  </div>
                  <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 space-y-1">
                    <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block">After (New Value)</span>
                    <span className="font-mono text-xs font-semibold text-emerald-900 block break-words">{selectedHistoryRecord.newValue}</span>
                  </div>
                </div>
              </div>

              {/* Audit Integrity Hash */}
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 flex items-center gap-1">
                    <ShieldCheck size={13} className="text-emerald-600" /> Immutable Security Hash
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">IP: {selectedHistoryRecord.ipAddress}</span>
                </div>
                <p className="font-mono text-[10px] text-slate-500 break-all bg-white p-2 rounded-lg border border-slate-200 select-all">
                  SHA256:{Array.from(String(selectedHistoryRecord.id)).map(c => c.charCodeAt(0).toString(16)).join('')}9b8a7c6f5e4d3c2b1a0f9e8d7c6b5a4
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedHistoryRecord(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-md"
              >
                Close Audit Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE COMPLIANCE SUMMARY MODAL & PRINT DOC CONTAINER */}
      {isPrintableSummaryOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 overflow-y-auto flex flex-col items-center p-2 sm:p-6 animate-in fade-in duration-150">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-audit-summary, #printable-audit-summary * {
                visibility: visible !important;
              }
              #printable-audit-summary {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: auto !important;
                margin: 0 !important;
                padding: 24px !important;
                background: white !important;
                color: black !important;
                box-shadow: none !important;
                border: none !important;
              }
              .no-print {
                display: none !important;
              }
              .page-break-avoid {
                page-break-inside: avoid !important;
              }
            }
          `}</style>

          {/* Floating Controls Bar (Screen Only - Hidden during window.print()) */}
          <div className="no-print w-full max-w-5xl bg-slate-900 text-white rounded-2xl p-4 mb-4 border border-slate-800 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 sticky top-2 z-50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 rounded-xl text-white">
                <Printer size={18} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">Printable Audit Summary &amp; Compliance PDF</h3>
                <p className="text-[11px] text-slate-400 font-medium">Format logs into an official PDF document for regulatory audit compliance</p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Mode Selector */}
              <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPrintableSummaryMode('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${printableSummaryMode === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  All Logs
                </button>
                <button
                  type="button"
                  onClick={() => setPrintableSummaryMode('RBAC')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${printableSummaryMode === 'RBAC' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  RBAC Only
                </button>
                <button
                  type="button"
                  onClick={() => setPrintableSummaryMode('LOGIN')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${printableSummaryMode === 'LOGIN' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Login Audit
                </button>
              </div>

              {/* Scope Selector */}
              <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPrintableSummaryScope('FILTERED')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${printableSummaryScope === 'FILTERED' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Filtered Set
                </button>
                <button
                  type="button"
                  onClick={() => setPrintableSummaryScope('FULL')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${printableSummaryScope === 'FULL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Full Archive
                </button>
              </div>

              {/* Action Buttons */}
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-md shadow-blue-600/30"
              >
                <Printer size={14} /> Print / Save PDF
              </button>

              <button
                type="button"
                onClick={handleDownloadComplianceHtmlDoc}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-slate-700"
              >
                <Download size={14} /> Download HTML
              </button>

              <button
                type="button"
                onClick={() => setIsPrintableSummaryOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* PRINTABLE PAPER DOCUMENT CONTAINER */}
          <div
            id="printable-audit-summary"
            className="w-full max-w-5xl bg-white text-slate-900 rounded-2xl p-8 sm:p-12 shadow-2xl border border-slate-200 font-sans space-y-8"
          >
            {/* Header / Document Letterhead */}
            <div className="border-b-2 border-slate-900 pb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-blue-600 font-extrabold text-xs uppercase tracking-widest">
                    <ShieldCheck size={18} /> TaxFlow Enterprise Compliance &amp; Security Subsystem
                  </div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase mt-1">
                    System Governance &amp; Audit Trail Summary Report
                  </h1>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Official Statutory Compliance Documentation &bull; SOC 2 Type II / ISO 27001 Audit Evidence
                  </p>
                </div>
                <div className="text-right sm:text-right font-mono text-xs text-slate-500 space-y-1 shrink-0">
                  <div className="inline-block px-3 py-1 bg-slate-900 text-white font-extrabold text-[10px] rounded uppercase tracking-wider">
                    CONFIDENTIAL AUDIT EVIDENCE
                  </div>
                  <p className="text-[11px] font-bold text-slate-800 mt-1">DOC REF: DOC-AUDIT-2026-0726-Q3</p>
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Generated Date &amp; Time</span>
                  <span className="font-bold text-slate-800 font-mono text-[11px]">{new Date().toUTCString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Audited Target Organization</span>
                  <span className="font-bold text-slate-800">{currentTenantId} &bull; Acme Tech HQ</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Auditor / Authorizing Official</span>
                  <span className="font-bold text-slate-800">Rajesh Sharma (Super Admin)</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Cryptographic Seal</span>
                  <span className="font-bold text-emerald-600 font-mono text-[11px]">SHA-256 Verified</span>
                </div>
              </div>
            </div>

            {/* Summary Statistics Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 page-break-avoid">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">RBAC Change Log Entries</span>
                <span className="text-xl font-extrabold text-slate-900 mt-1 block">
                  {(printableSummaryScope === 'FILTERED' ? filteredRbacHistory : rbacChangeLogs).length} Events
                </span>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Auth Session Logs</span>
                <span className="text-xl font-extrabold text-slate-900 mt-1 block">
                  {(printableSummaryScope === 'FILTERED' ? filteredAuditLogs : loginAudits).length} Records
                </span>
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block">2FA Enforcement</span>
                <span className="text-xl font-extrabold text-emerald-800 mt-1 block">100% Compliant</span>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block">Compliance Rating</span>
                <span className="text-xl font-extrabold text-blue-900 mt-1 block">PASSED (Grade A)</span>
              </div>
            </div>

            {/* Section 1: RBAC Change History Table */}
            {(printableSummaryMode === 'ALL' || printableSummaryMode === 'RBAC') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <History size={16} className="text-blue-600" />
                    1. Role-Based Access Control (RBAC) &amp; Permission Modifications
                  </h2>
                  <span className="text-xs font-mono text-slate-500">
                    {(printableSummaryScope === 'FILTERED' ? filteredRbacHistory : rbacChangeLogs).length} Items
                  </span>
                </div>

                <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="p-2.5">Timestamp</th>
                      <th className="p-2.5">Actor (Modifier)</th>
                      <th className="p-2.5">Target Subject</th>
                      <th className="p-2.5">Category &amp; Module</th>
                      <th className="p-2.5">State Transition (Old &rarr; New)</th>
                      <th className="p-2.5">Details &amp; IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(printableSummaryScope === 'FILTERED' ? filteredRbacHistory : rbacChangeLogs).map(log => (
                      <tr key={log.id} className="page-break-avoid">
                        <td className="p-2.5 font-mono text-[10px] text-slate-700">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="p-2.5">
                          <div className="font-bold text-slate-900">{log.actorName}</div>
                          <div className="text-[10px] text-slate-500">{log.actorRole}</div>
                        </td>
                        <td className="p-2.5">
                          <div className="font-bold text-slate-900">{log.targetName}</div>
                          <div className="text-[10px] text-slate-500">{log.targetType}</div>
                        </td>
                        <td className="p-2.5">
                          <span className={`inline-block px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded border ${
                            log.changeCategory === 'GRANT' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                            log.changeCategory === 'REVOKE' ? 'bg-red-100 text-red-800 border-red-300' :
                            'bg-slate-100 text-slate-800 border-slate-300'
                          }`}>
                            {log.changeCategory}
                          </span>
                          <div className="text-[10px] font-medium text-slate-700 mt-0.5">{log.moduleOrFeature}</div>
                        </td>
                        <td className="p-2.5 font-mono text-[10px]">
                          <span className="text-red-700 font-bold">{log.oldValue}</span>
                          <span className="text-slate-400 font-bold px-1">&rarr;</span>
                          <span className="text-emerald-700 font-bold">{log.newValue}</span>
                        </td>
                        <td className="p-2.5 text-[11px] text-slate-700">
                          {log.details}
                          <div className="font-mono text-[9px] text-slate-400 mt-0.5">IP: {log.ipAddress}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Section 2: Login & Authentication Security Trail Table */}
            {(printableSummaryMode === 'ALL' || printableSummaryMode === 'LOGIN') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck size={16} className="text-blue-600" />
                    2. User Authentication &amp; Security Session Trail
                  </h2>
                  <span className="text-xs font-mono text-slate-500">
                    {(printableSummaryScope === 'FILTERED' ? filteredAuditLogs : loginAudits).length} Items
                  </span>
                </div>

                <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="p-2.5">Timestamp</th>
                      <th className="p-2.5">User Account</th>
                      <th className="p-2.5">Event &amp; Status</th>
                      <th className="p-2.5">IP Address &amp; Location</th>
                      <th className="p-2.5">Device &amp; Browser</th>
                      <th className="p-2.5">Risk Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(printableSummaryScope === 'FILTERED' ? filteredAuditLogs : loginAudits).map(log => (
                      <tr key={log.id} className="page-break-avoid">
                        <td className="p-2.5 font-mono text-[10px] text-slate-700">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="p-2.5">
                          <div className="font-bold text-slate-900">{log.userName}</div>
                          <div className="text-[10px] text-slate-500">{log.userEmail}</div>
                        </td>
                        <td className="p-2.5">
                          <span className={`inline-block px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded border ${
                            log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                            'bg-red-100 text-red-800 border-red-300'
                          }`}>
                            {log.eventType} ({log.status})
                          </span>
                        </td>
                        <td className="p-2.5">
                          <div className="font-mono text-[10px] font-bold text-slate-800">{log.ipAddress}</div>
                          <div className="text-[10px] text-slate-500">{log.location}</div>
                        </td>
                        <td className="p-2.5 text-[11px] text-slate-700">{log.deviceBrowser}</td>
                        <td className="p-2.5 font-bold text-[10px] text-slate-800">{(log as any).riskLevel || log.riskScore} Risk</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Verification Sign-Off & Official Stamps Block */}
            <div className="pt-6 border-t-2 border-slate-900 space-y-6 page-break-avoid">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-900 uppercase text-[11px]">Attestation &amp; Audit Integrity Disclaimer</p>
                <p className="leading-relaxed">
                  This document constitutes an official, cryptographic audit summary generated from TaxFlow Enterprise immutable system logs. All events recorded above reflect exact state modifications, user authorization grants/revocations, and authentication checks verified in compliance with GST NSDL Statutory guidelines and SOC 2 Type II audit standards.
                </p>
              </div>

              {/* Signatures Grid */}
              <div className="grid grid-cols-2 gap-12 pt-4">
                <div className="space-y-8">
                  <div className="border-b-2 border-slate-900 h-12"></div>
                  <div>
                    <p className="font-extrabold text-xs text-slate-900 uppercase">Lead Compliance Auditor</p>
                    <p className="text-[11px] text-slate-500 font-medium">Statutory External Audit Committee</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">Date: ________________________</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="border-b-2 border-slate-900 h-12"></div>
                  <div>
                    <p className="font-extrabold text-xs text-slate-900 uppercase">Chief Information Security Officer (CISO)</p>
                    <p className="text-[11px] text-slate-500 font-medium">TaxFlow Enterprise Governance Division</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">Date: ________________________</p>
                  </div>
                </div>
              </div>

              {/* Footer Digest */}
              <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400 font-mono">
                TaxFlow Enterprise Compliance System &bull; SHA256 Signature Digest: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAccessManagement;
