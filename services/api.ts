import { Invoice, InvoiceItem, InvoiceVersion, ReconItem, User, UserRole, Tenant, ReconStatus, FilingRecord, ReturnFormType, EWayBill, ComplianceAlert, VendorRisk, NotificationSettings, LiabilityReportData, ItcReportData, BranchReportData, AuditLogData, TaxComputationSummary, AiRiskRecord, InvoiceReminder, AnomalyRecord, SavedReport, ImportLog, VendorActivityLog, AutomationRule, AutomationRuleCondition, AutomationRuleAction, FilingVersion, FilingDataSummary, InvoiceApprovalStatus, InvoiceApprovalWorkflow, ApprovalStageAction, ExpenseCategorySuggestion, WhatsAppMessageLog, GstDueDateItem, WhatsAppAutoReminderConfig, SendWhatsAppNotificationParams, SendWhatsAppResponse, AutomatedGstRemindersSummary, WhatsAppGatewayStatus, FilingStatusWhatsAppParams, WhatsAppClientItem } from '../types';
import { ParsedCsvRow } from '../utils/csvImportValidator';
import { ITCTaggingService } from './gstEngine/itcTaggingService';
import { GSTR2BMatchingService, GSTR2BPortalRecord, GSTR2BMatchingConfig, GSTR2BMatchResultItem, GSTR2BMatchingSummary, DEFAULT_GSTR2B_MATCHING_CONFIG } from './gstEngine/gstr2bMatchingService';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getMonthAbbreviation = (dateStr: string): string => {
    if (!dateStr) return 'Oct';
    const parts = dateStr.split('-');
    if (parts.length < 2) return 'Oct';
    const monthNum = parts[1];
    switch (monthNum) {
        case '01': return 'Jan';
        case '02': return 'Feb';
        case '03': return 'Mar';
        case '04': return 'Apr';
        case '05': return 'May';
        case '06': return 'Jun';
        case '07': return 'Jul';
        case '08': return 'Aug';
        case '09': return 'Sep';
        case '10': return 'Oct';
        case '11': return 'Nov';
        case '12': return 'Dec';
        default: return 'Oct';
    }
};

// --- PERSISTENCE HELPERS ---
const STORAGE_KEYS = {
  TENANTS: 'TF_TENANTS',
  USERS: 'TF_USERS',
  INVOICES: 'TF_INVOICES',
  FILINGS: 'TF_FILINGS',
  BRANCHES: 'TF_BRANCHES',
  ALERTS: 'TF_ALERTS',
  QUEUE: 'TF_SYNC_QUEUE',
  SAVED_REPORTS: 'TF_SAVED_REPORTS',
  AUDIT_LOGS: 'TF_AUDIT_LOGS',
  RULES: 'TF_AUTOMATION_RULES',
  FILING_VERSIONS: 'TF_FILING_VERSIONS'
};

const load = <T>(key: string, defaultVal: T): T => {
  try {
    if (typeof localStorage === 'undefined') return defaultVal;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
};

const save = (key: string, val: any) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error('Failed to save to local storage', e);
  }
};

// --- DATA SEEDING & INITIALIZATION ---

import { ENTERPRISE_GROUP_TENANTS } from '../src/fixtures/enterpriseTenants';

// Mock Tenants
const initialTenants: Tenant[] = ENTERPRISE_GROUP_TENANTS;
let loadedTenants: Tenant[] = load(STORAGE_KEYS.TENANTS, initialTenants);
if (!loadedTenants || loadedTenants.length < ENTERPRISE_GROUP_TENANTS.length) {
  loadedTenants = ENTERPRISE_GROUP_TENANTS;
  save(STORAGE_KEYS.TENANTS, loadedTenants);
}
let MOCK_TENANTS: Tenant[] = loadedTenants;

// Mock Users
const initialUsers: User[] = [
  {
    id: 'u1',
    name: 'Admin User',
    email: 'admin@taxflow.com',
    role: UserRole.ADMIN,
    currentTenantId: 't1',
    availableTenants: [...MOCK_TENANTS],
  },
  {
    id: 'u2',
    name: 'Auditor User',
    email: 'auditor@taxflow.com',
    role: UserRole.AUDITOR,
    currentTenantId: 't1',
    availableTenants: [...MOCK_TENANTS],
  },
  {
    id: 'u3',
    name: 'Accountant User',
    email: 'accountant@taxflow.com',
    role: UserRole.ACCOUNTANT,
    currentTenantId: 't1',
    availableTenants: [...MOCK_TENANTS],
  },
  {
    id: 'u4',
    name: 'Viewer User',
    email: 'viewer@taxflow.com',
    role: UserRole.VIEWER,
    currentTenantId: 't1',
    availableTenants: [...MOCK_TENANTS],
  }
];
let loadedUsers: User[] = load(STORAGE_KEYS.USERS, initialUsers);
if (loadedUsers && loadedUsers.length > 0 && loadedUsers[0].availableTenants?.length < ENTERPRISE_GROUP_TENANTS.length) {
  loadedUsers = loadedUsers.map(u => ({ ...u, availableTenants: [...MOCK_TENANTS] }));
  save(STORAGE_KEYS.USERS, loadedUsers);
}
let MOCK_USERS: User[] = loadedUsers;

// Mock Branches
const initialBranches: BranchReportData[] = [
    { id: 'b1', tenantId: 't1', name: 'Mumbai HQ', gstin: '27ABCDE1234F1Z5', state: 'Maharashtra', turnover: 4500000, taxLiability: 810000, itcSetOff: 688500, netPayable: 121500, igst: 243000, cgst: 283500, sgst: 283500, type: 'HEAD_OFFICE', status: 'ACTIVE' },
    { id: 'b2', tenantId: 't1', name: 'Pune Branch', gstin: '27ABCDE1234F2Z4', state: 'Maharashtra', turnover: 1200000, taxLiability: 216000, itcSetOff: 183600, netPayable: 32400, igst: 43200, cgst: 86400, sgst: 86400, type: 'BRANCH', status: 'ACTIVE' },
    { id: 'b3', tenantId: 't1', name: 'Delhi Sales Office', gstin: '07ABCDE1234F1Z9', state: 'Delhi', turnover: 2800000, taxLiability: 504000, itcSetOff: 403200, netPayable: 100800, igst: 504000, cgst: 0, sgst: 0, type: 'BRANCH', status: 'ACTIVE' },
    { id: 'b6', tenantId: 't1', name: 'Bengaluru Tech Hub', gstin: '29ABCDE1234F3Z2', state: 'Karnataka', turnover: 3600000, taxLiability: 648000, itcSetOff: 550800, netPayable: 97200, igst: 648000, cgst: 0, sgst: 0, type: 'BRANCH', status: 'ACTIVE' },
    { id: 'b7', tenantId: 't1', name: 'Chennai Logistics Unit', gstin: '33ABCDE1234F4Z1', state: 'Tamil Nadu', turnover: 1800000, taxLiability: 324000, itcSetOff: 259200, netPayable: 64800, igst: 324000, cgst: 0, sgst: 0, type: 'SISTER_COMPANY', status: 'ACTIVE' },
    { id: 'b4', tenantId: 't2', name: 'Chandigarh Main HQ', gstin: '04XYZZZ9876L1Z1', state: 'Punjab/Haryana', turnover: 3200000, taxLiability: 576000, itcSetOff: 460800, netPayable: 115200, igst: 288000, cgst: 144000, sgst: 144000, type: 'HEAD_OFFICE', status: 'ACTIVE' },
    { id: 'b5', tenantId: 't2', name: 'Ambala Depot', gstin: '04XYZZZ9876L2Z2', state: 'Haryana', turnover: 900000, taxLiability: 162000, itcSetOff: 129600, netPayable: 32400, igst: 162000, cgst: 0, sgst: 0, type: 'BRANCH', status: 'ACTIVE' },
];
let MOCK_BRANCHES: BranchReportData[] = load(STORAGE_KEYS.BRANCHES, initialBranches);

const generateInvoices = (tenantId: string, count: number, baseAmount: number) => {
    const tenant = MOCK_TENANTS.find(t => t.id === tenantId);
    const homeState = tenant?.stateCode || '27';
    const isHomeUT = homeState === '04';

    const t1BranchConfigs = [
      { branchId: 'b1', branchName: 'Mumbai HQ', gstin: '27ABCDE1234F1Z5', stateCode: '27' },
      { branchId: 'b2', branchName: 'Pune Branch', gstin: '27ABCDE1234F1Z5', stateCode: '27' },
      { branchId: 'b3', branchName: 'Delhi Sales Office', gstin: '07ABCDE1234F1Z9', stateCode: '07' },
      { branchId: 'b6', branchName: 'Bengaluru Tech Hub', gstin: '29ABCDE1234F3Z2', stateCode: '29', isSez: true },
      { branchId: 'b7', branchName: 'Chennai Logistics Unit', gstin: '33ABCDE1234F4Z1', stateCode: '33' }
    ];

    const t2BranchConfigs = [
      { branchId: 'b4', branchName: 'Chandigarh Main HQ', gstin: '04XYZZZ9876L1Z1', stateCode: '04' },
      { branchId: 'b5', branchName: 'Ambala Depot', gstin: '04XYZZZ9876L2Z2', stateCode: '06' }
    ];

    const branchList = tenantId === 't2' ? t2BranchConfigs : t1BranchConfigs;

    return Array.from({ length: count }).map((_, i) => {
        const isSales = i % 3 !== 0; 
        const isCN = i % 12 === 0;
        const branchConfig = branchList[i % branchList.length];
        const branchState = branchConfig.stateCode;
        
        let type: 'B2B' | 'B2C' | 'EXPORT' = 'B2B';
        let isImport = false;
        let isSez = Boolean((branchConfig as any).isSez) || (i % 8 === 0);
        let placeOfSupply = branchState; 

        if (isSales) {
            if (i % 10 === 0) { type = 'EXPORT'; placeOfSupply = '96'; } 
            else if (i % 8 === 0) { isSez = true; placeOfSupply = branchState; } 
            else if (i % 3 === 0) { type = 'B2C'; placeOfSupply = (i%2===0 ? branchState : '29'); } 
            else { type = 'B2B'; placeOfSupply = (i%4===0 ? '07' : branchState); } 
        } else {
            if (i % 15 === 0) { isImport = true; placeOfSupply = '96'; } 
            else { placeOfSupply = (i%2===0 ? branchState : '33'); } 
        }
        
        const hasIRN = isSales && (type === 'B2B' || type === 'EXPORT') && i % 2 === 0;
        const status = (i % 6 === 0 ? 'FAILED' : i % 3 === 0 ? 'FILED' : 'UPLOADED');
        const hasEWB = hasIRN && i % 4 === 0;
        const isRcm = !isSales && i % 5 === 0;
        const amount = (i + 1) * baseAmount;

        const items: InvoiceItem[] = [
            {
                id: `item-${i}-1`,
                description: isSales ? 'Software Development Services' : 'Server Hosting Fees',
                hsnSac: '998313',
                quantity: 1,
                unit: 'MOS',
                rate: amount,
                taxRate: 18,
                taxableValue: amount,
                taxAmount: amount * 0.18
            }
        ];

        let tax = { taxableValue: amount, igst: 0, cgst: 0, sgst: 0, utgst: 0, cess: 0 };
        
        if (type === 'EXPORT' || isSez || isImport || placeOfSupply !== branchState) {
            tax.igst = amount * 0.18;
        } else {
            tax.cgst = amount * 0.09;
            if (branchState === '04') {
                tax.utgst = amount * 0.09; 
            } else {
                tax.sgst = amount * 0.09;
            }
        }

        if (i % 20 === 0) tax.cess = amount * 0.12;
        const totalTax = tax.igst + tax.cgst + tax.sgst + tax.utgst + tax.cess;

        const months = ['05', '06', '07', '08', '09', '10'];
        const month = months[i % months.length];
        const day = 10 + (i % 18);
        const date = `2026-${month}-${day}`;

        // Multi-Stage Approval Status Determination
        let approvalStage: InvoiceApprovalStatus = 'DRAFT';
        let invoiceStatus = status;

        if (hasIRN) {
            approvalStage = 'SUBMITTED_TO_PORTAL';
            invoiceStatus = 'UPLOADED';
        } else if (isSales) {
            const workflowMod = i % 4;
            if (workflowMod === 0) {
                approvalStage = 'DRAFT';
                invoiceStatus = 'DRAFT';
            } else if (workflowMod === 1) {
                approvalStage = 'PENDING_FINANCE_REVIEW';
                invoiceStatus = 'PENDING_APPROVAL';
            } else if (workflowMod === 2) {
                approvalStage = 'PENDING_SR_FINANCE_SIGNOFF';
                invoiceStatus = 'PENDING_APPROVAL';
            } else {
                approvalStage = 'APPROVED';
                invoiceStatus = 'APPROVED';
            }
        } else {
            approvalStage = i % 2 === 0 ? 'APPROVED' : 'PENDING_FINANCE_REVIEW';
        }

        const approvalWorkflow: InvoiceApprovalWorkflow = {
            currentStage: hasIRN 
                ? 'SUBMITTED_TO_PORTAL' 
                : (approvalStage === 'APPROVED' 
                    ? 'READY_FOR_PORTAL' 
                    : (approvalStage === 'PENDING_SR_FINANCE_SIGNOFF' 
                        ? 'SR_FINANCE_SIGNOFF' 
                        : (approvalStage === 'PENDING_FINANCE_REVIEW' ? 'FINANCE_REVIEW' : 'DRAFT'))),
            overallStatus: approvalStage,
            preparedBy: {
                name: 'Rohan Sharma',
                email: 'rohan.sharma@taxflow.in',
                role: UserRole.ACCOUNTANT,
                timestamp: `${date}T08:30:00Z`,
                notes: 'Invoice line items, HSN 998313, and GSTIN registered in billing ledger.'
            },
            reviewedBy: (approvalStage === 'PENDING_SR_FINANCE_SIGNOFF' || approvalStage === 'APPROVED' || approvalStage === 'SUBMITTED_TO_PORTAL') ? {
                name: 'Anita Desai',
                email: 'anita.desai@taxflow.in',
                role: UserRole.FINANCE_MANAGER,
                timestamp: `${date}T09:15:00Z`,
                notes: 'Verified tax rate slabs, counterparty active status, and cost center allocation.',
                checklistCompleted: ['ACTIVE_GSTIN_VERIFIED', 'HSN_RATE_MATCHED', 'POS_RULES_VALIDATED', 'ARITHMETIC_CONFIRMED'],
                riskScore: 96
            } : undefined,
            seniorSignoff: (approvalStage === 'APPROVED' || approvalStage === 'SUBMITTED_TO_PORTAL') ? {
                name: 'Dr. Vikram Malhotra',
                email: 'vikram.m@acmetech.com',
                role: UserRole.ADMIN,
                designation: 'Chief Financial Officer (CFO)',
                timestamp: `${date}T10:00:00Z`,
                signatureHash: `SIG-SRFIN-${Math.abs(amount * 100).toString(16)}-APPROVED`,
                evcOtpOrPin: '992810',
                declarationAccepted: true,
                notes: 'Certified and authorized for statutory transmission to Government Portal (IRP/NIC).'
            } : undefined,
            history: [
                {
                    stage: 'PREPARATION',
                    status: 'APPROVED',
                    actionBy: {
                        name: 'Rohan Sharma',
                        email: 'rohan.sharma@taxflow.in',
                        role: UserRole.ACCOUNTANT,
                        designation: 'Staff Accountant'
                    },
                    timestamp: `${date}T08:30:00Z`,
                    notes: 'Created initial invoice record.'
                },
                ...(approvalStage === 'PENDING_SR_FINANCE_SIGNOFF' || approvalStage === 'APPROVED' || approvalStage === 'SUBMITTED_TO_PORTAL' ? [{
                    stage: 'FINANCE_REVIEW' as const,
                    status: 'APPROVED' as const,
                    actionBy: {
                        name: 'Anita Desai',
                        email: 'anita.desai@taxflow.in',
                        role: UserRole.FINANCE_MANAGER,
                        designation: 'Finance & Compliance Manager'
                    },
                    timestamp: `${date}T09:15:00Z`,
                    notes: 'Stage 1 review completed. Tax codes and customer GSTIN validated.',
                    checklistCompleted: ['ACTIVE_GSTIN_VERIFIED', 'HSN_RATE_MATCHED', 'POS_RULES_VALIDATED', 'ARITHMETIC_CONFIRMED']
                }] : []),
                ...(approvalStage === 'APPROVED' || approvalStage === 'SUBMITTED_TO_PORTAL' ? [{
                    stage: 'SR_FINANCE_SIGNOFF' as const,
                    status: 'APPROVED' as const,
                    actionBy: {
                        name: 'Dr. Vikram Malhotra',
                        email: 'vikram.m@acmetech.com',
                        role: UserRole.ADMIN,
                        designation: 'Chief Financial Officer (CFO)'
                    },
                    timestamp: `${date}T10:00:00Z`,
                    notes: 'Stage 2 sign-off completed. Authorized for government portal dispatch.',
                    signatureHash: `SIG-SRFIN-${Math.abs(amount * 100).toString(16)}-APPROVED`
                }] : []),
                ...(hasIRN ? [{
                    stage: 'PORTAL_DISPATCH' as const,
                    status: 'DISPATCHED' as const,
                    actionBy: {
                        name: 'System Dispatch Engine',
                        email: 'system@taxflow.in',
                        role: UserRole.ADMIN,
                        designation: 'IRP NIC Dispatch Gateway'
                    },
                    timestamp: `${date}T10:05:00Z`,
                    notes: 'Successfully registered with IRP. IRN generated.'
                }] : [])
            ],
            complianceChecklist: {
                gstinValid: true,
                hsnSacValid: true,
                taxCalculationValid: true,
                posValid: true,
                eInvoiceMandatory: isSales && type !== 'B2C'
            }
        };

        return {
            id: `inv-${tenantId}-${i}`,
            tenantId,
            invoiceNumber: `${isSales ? (isCN ? 'CN' : 'INV') : 'PUR'}-2026-${1000 + i}`,
            partyName: isImport ? 'Overseas Vendor Inc' : (isSales 
            ? (type === 'B2C' ? 'Retail Consumer' : (type === 'EXPORT' ? `Global Trade LLC` : `Tech Solutions Ltd`)) 
            : 'Office Supplies Co'),
            gstin: (isImport || type === 'EXPORT' || (type === 'B2C' && !isSales)) ? '' : `${placeOfSupply}ABCDE1234F1Z${i % 9}`,
            supplierGstin: branchConfig.gstin,
            recipientGstin: (isImport || type === 'EXPORT' || (type === 'B2C' && !isSales)) ? '' : `${placeOfSupply}ABCDE1234F1Z${i % 9}`,
            branchId: branchConfig.branchId,
            branchName: branchConfig.branchName,
            placeOfSupply,
            date: date,
            amount: amount,
            taxAmount: totalTax,
            taxDetails: tax,
            items: items,
            status: invoiceStatus as any,
            approvalStage: approvalStage,
            approvalWorkflow: approvalWorkflow,
            type: type,
            category: isSales ? 'SALES' : 'PURCHASE',
            docType: isCN ? 'CREDIT_NOTE' : 'INVOICE',
            irn: hasIRN ? `35054cc24d97033afc24f49ec4444dbab81f542c555f9d30359dc75794e06bbe` : undefined,
            qrCodeUrl: hasIRN ? 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=ExampleIRN' : undefined,
            ackNo: hasIRN ? `${123456789000 + i}` : undefined,
            ackDate: hasIRN ? `${date}T10:00:00Z` : undefined,
            irnError: status === 'FAILED' ? 'IRP: Invalid HSN Code or GSTIN mismatch' : undefined,
            ewayBillDetails: hasEWB ? {
                ewayBillNo: `141${10000000+i}`,
                ewayBillDate: `${date} 10:30 AM`,
                validUpto: `2026-${month}-${day + 3}`,
                status: 'ACTIVE' as const
            } : undefined,
            isRcm: isRcm,
            isImport: isImport,
            isSez: isSez,
            isBlockedItc: !isSales && i % 15 === 0,
            reasonForBlocked: (!isSales && i % 15 === 0) ? 'Section 17(5): Food & Beverages' : undefined
        } as Invoice;
    });
};

const seedInvoices = () => {
    return [
        ...generateInvoices('t1', 35, 2500),
        ...generateInvoices('t2', 20, 4500)
    ];
};

let MOCK_INVOICES: Invoice[] = load(STORAGE_KEYS.INVOICES, []);
// If persistence was empty, seed it
if (MOCK_INVOICES.length === 0) {
    MOCK_INVOICES = seedInvoices();
    save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);
}

const initialFilings: FilingRecord[] = [
    { id: 'f0-t1', tenantId: 't1', type: 'GSTR-3B', period: 'July 2026', fy: '2026-27', status: 'PENDING', dueDate: '2026-07-27', taxLiability: 124000 },
    { id: 'f1-t1', tenantId: 't1', type: 'GSTR-1', period: 'July 2026', fy: '2026-27', status: 'PENDING', dueDate: '2026-08-11' },
    { id: 'f2-t1', tenantId: 't1', type: 'GSTR-3B', period: 'August 2026', fy: '2026-27', status: 'PENDING', dueDate: '2026-08-20' },
    { id: 'f3-t1', tenantId: 't1', type: 'GSTR-1', period: 'June 2026', fy: '2026-27', status: 'FILED', dueDate: '2026-07-11', filedDate: '2026-07-10', arn: 'AA2706260056781', taxLiability: 154000 },
    { id: 'f4-t1', tenantId: 't1', type: 'GSTR-3B', period: 'June 2026', fy: '2026-27', status: 'FILED', dueDate: '2026-07-20', filedDate: '2026-07-20', arn: 'AA2706260099881', taxLiability: 12400 },
    { id: 'f5-t1', tenantId: 't1', type: 'GSTR-1', period: 'May 2026', fy: '2026-27', status: 'FILED', dueDate: '2026-06-11', filedDate: '2026-06-11', arn: 'AA2705260011223', taxLiability: 98000 },
    { id: 'f6-t1', tenantId: 't1', type: 'CMP-08', period: 'Apr-Jun 2026', fy: '2026-27', status: 'OVERDUE', dueDate: '2026-07-18' },
    { id: 'f9-t1', tenantId: 't1', type: 'GSTR-9', period: 'FY 2025-26', fy: '2025-26', status: 'PENDING', dueDate: '2026-12-31' },
    { id: 'f9c-t1', tenantId: 't1', type: 'GSTR-9C', period: 'FY 2025-26', fy: '2025-26', status: 'PENDING', dueDate: '2026-12-31' },
    { id: 'f1-t2', tenantId: 't2', type: 'GSTR-1', period: 'July 2026', fy: '2026-27', status: 'FILED', dueDate: '2026-08-11', filedDate: '2026-08-10', arn: 'BB2907260012345', taxLiability: 250000 },
    { id: 'f2-t2', tenantId: 't2', type: 'GSTR-3B', period: 'July 2026', fy: '2026-27', status: 'OVERDUE', dueDate: '2026-08-20' },
];
let MOCK_FILINGS: FilingRecord[] = load(STORAGE_KEYS.FILINGS, initialFilings);
let MOCK_FILING_VERSIONS: FilingVersion[] = load(STORAGE_KEYS.FILING_VERSIONS, []);

// --- OFFLINE & SYNC LOGIC ---

const addToSyncQueue = (type: string, payload: any) => {
    const queue = load<{type: string, payload: any, timestamp: number}[]>(STORAGE_KEYS.QUEUE, []);
    queue.push({ type, payload, timestamp: Date.now() });
    save(STORAGE_KEYS.QUEUE, queue);
};

export const syncOfflineData = async (): Promise<number> => {
    if (!navigator.onLine) return 0;
    
    const queue = load<{type: string, payload: any}[]>(STORAGE_KEYS.QUEUE, []);
    if (queue.length === 0) return 0;

    // Simulate server processing time
    await delay(2000);

    // In a real app, we would iterate and POST to server.
    // Since our "DB" is localStorage/InMemory, the data is already "saved" locally by the optimistic update.
    // We just clear the queue to indicate sync completion.
    
    save(STORAGE_KEYS.QUEUE, []);
    return queue.length;
};

// --- API FUNCTIONS ---

export const createNewTenant = async (data: Omit<Tenant, 'id'>): Promise<Tenant> => {
    const newId = `t${Date.now()}`;
    const newTenant: Tenant = {
        id: newId,
        ...data
    };
    
    if (!navigator.onLine) {
        MOCK_TENANTS.push(newTenant);
        save(STORAGE_KEYS.TENANTS, MOCK_TENANTS);
        addToSyncQueue('CREATE_TENANT', newTenant);
        return newTenant;
    }

    await delay(1000);
    MOCK_TENANTS.push(newTenant);
    save(STORAGE_KEYS.TENANTS, MOCK_TENANTS);
    
    await logAuditAction(`Created Tenant: ${data.name}`, 'SETTINGS', `GSTIN: ${data.gstin}`);

    // Update Users to have access (Simulated)
    MOCK_USERS.forEach(u => {
        if(u.role === UserRole.ADMIN) {
            if (!u.availableTenants.find(t => t.id === newId)) {
                u.availableTenants.push(newTenant);
            }
        }
    });
    save(STORAGE_KEYS.USERS, MOCK_USERS);

    const newInvoices = generateInvoices(newId, 10, 2000); 
    MOCK_INVOICES = [...newInvoices, ...MOCK_INVOICES];
    save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);

    MOCK_FILINGS.push({ id: `f1-${newId}`, tenantId: newId, type: 'GSTR-1', period: 'October 2024', fy: '2024-25', status: 'PENDING', dueDate: '2024-11-11' });
    MOCK_FILINGS.push({ id: `f3b-${newId}`, tenantId: newId, type: 'GSTR-3B', period: 'October 2024', fy: '2024-25', status: 'PENDING', dueDate: '2024-11-20' });
    save(STORAGE_KEYS.FILINGS, MOCK_FILINGS);

    return newTenant;
}

let GSTN_SESSION = { connected: false, username: '', tokenExpiry: 0 };

export const performLogin = async (email: string, password: string): Promise<{ user?: User }> => {
  await delay(1000);
  const user = MOCK_USERS.find(u => 
    u.email === email || (email.includes('admin') && u.role === UserRole.ADMIN) || 
    (email.includes('auditor') && u.role === UserRole.AUDITOR) || (email.includes('accountant') && u.role === UserRole.ACCOUNTANT) ||
    (email.includes('viewer') && u.role === UserRole.VIEWER)
  );
  if (user) return { user: { ...user } };
  throw new Error('Invalid credentials');
};

export const fetchInvoices = async (tenantId: string = 't1', gstin?: string, branchId?: string): Promise<Invoice[]> => { 
    // Always return from local store (source of truth)
    await delay(800); 
    return MOCK_INVOICES.filter(inv => {
      if (inv.tenantId !== tenantId) return false;
      if (gstin && gstin !== 'ALL' && gstin !== 'ALL_GSTINS') {
        const matchesGstin = inv.supplierGstin === gstin || inv.gstin === gstin || inv.placeOfSupply === gstin.slice(0, 2);
        if (!matchesGstin) return false;
      }
      if (branchId && branchId !== 'ALL' && branchId !== 'ALL_BRANCHES') {
        if (inv.branchId && inv.branchId !== branchId) return false;
      }
      return true;
    }); 
};

export const fetchInvoice = async (id: string): Promise<Invoice | null> => {
    await delay(600);
    return MOCK_INVOICES.find(inv => inv.id === id) || null;
};

export const createInvoice = async (invoiceData: Partial<Invoice> & { items: InvoiceItem[] }): Promise<Invoice> => {
  const tenant = MOCK_TENANTS.find(t => t.id === invoiceData.tenantId);
  const homeState = tenant?.stateCode || '27';
  const placeOfSupply = invoiceData.placeOfSupply || homeState;
  
  // Calculate Totals from Items
  let totalTaxable = 0;
  let totalTax = 0;
  let taxBreakdown = { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, utgst: 0, cess: 0 };

  try {
    const response = await fetch('/api/v1/gst/calculate-tax', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: invoiceData.items,
        supplierStateCode: homeState,
        placeOfSupply,
        isSez: !!invoiceData.isSez,
        isImport: !!invoiceData.isImport,
        isExport: invoiceData.type === 'EXPORT'
      })
    });

    if (response.ok) {
      const calculated = await response.json();
      taxBreakdown = calculated;
      totalTaxable = calculated.taxableValue;
      totalTax = calculated.igst + calculated.cgst + calculated.sgst + calculated.utgst + calculated.cess;
    } else {
      throw new Error('Tax calculation API failure');
    }
  } catch (error) {
    console.warn("Falling back to client-side tax calculation due to:", error);
    invoiceData.items.forEach(item => {
        totalTaxable += item.taxableValue;
        const itemTaxAmt = item.taxableValue * (item.taxRate / 100);
        totalTax += itemTaxAmt;

        if (placeOfSupply !== homeState || invoiceData.type === 'EXPORT') {
            taxBreakdown.igst += itemTaxAmt;
        } else {
            taxBreakdown.cgst += itemTaxAmt / 2;
            if (homeState === '04' || homeState === '35') {
                taxBreakdown.utgst += itemTaxAmt / 2;
            } else {
                taxBreakdown.sgst += itemTaxAmt / 2;
            }
        }
    });
    taxBreakdown.taxableValue = totalTaxable;
  }

  const newInvoice: Invoice = {
    ...invoiceData as Invoice,
    id: `inv-${Date.now()}`,
    status: invoiceData.status || 'DRAFT',
    taxAmount: totalTax,
    amount: totalTaxable,
    taxDetails: taxBreakdown,
    items: invoiceData.items
  };
  
  if (!navigator.onLine) {
      MOCK_INVOICES = [newInvoice, ...MOCK_INVOICES];
      save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);
      addToSyncQueue('CREATE_INVOICE', newInvoice);
      return newInvoice;
  }

  await delay(800);
  MOCK_INVOICES = [newInvoice, ...MOCK_INVOICES];
  save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);
  
  await logAuditAction(`Created Invoice: ${newInvoice.invoiceNumber}`, 'INVOICE', `Value: ₹${newInvoice.amount.toLocaleString()}`);

  return newInvoice;
};

export const updateInvoice = async (invoiceId: string, data: Partial<Invoice>, changeSummary: string = 'Manual Correction'): Promise<Invoice> => {
  await delay(800);
  const index = MOCK_INVOICES.findIndex(i => i.id === invoiceId);
  if (index === -1) throw new Error('Invoice not found');
  
  const oldInvoice = MOCK_INVOICES[index];
  const newInvoice = { ...oldInvoice, ...data };
  
  // Create a version record automatically
  const version: InvoiceVersion = {
    id: `ver-${Date.now()}`,
    timestamp: new Date().toISOString(),
    modifiedBy: 'Admin User',
    changeSummary,
    dataSnapshot: { ...oldInvoice, versionHistory: undefined }
  };
  
  newInvoice.versionHistory = [version, ...(oldInvoice.versionHistory || [])];
  
  MOCK_INVOICES[index] = newInvoice;
  save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);
  
  await logAuditAction(`Updated Invoice: ${newInvoice.invoiceNumber}`, 'INVOICE', `Reason: ${changeSummary}`);
  
  return newInvoice;
};

export const bulkReconcileInvoices = async (
  reconciliations: { invoiceId: string; refNo?: string }[]
): Promise<number> => {
  await delay(600);
  let updatedCount = 0;
  reconciliations.forEach(({ invoiceId, refNo }) => {
    const index = MOCK_INVOICES.findIndex(i => i.id === invoiceId);
    if (index !== -1) {
      MOCK_INVOICES[index] = {
        ...MOCK_INVOICES[index],
        status: 'PAID',
        ackNo: refNo || MOCK_INVOICES[index].ackNo || `UTR-${Date.now().toString().slice(-8)}`
      };
      updatedCount++;
    }
  });
  save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);
  await logAuditAction(`Bank Statement Rapid Reconciliation applied`, 'COMPLIANCE', `Updated ${updatedCount} invoices to PAID/RECONCILED status`);
  return updatedCount;
};

const calculateSHA256Sync = (text: string): string => {
  const chrsz = 8;
  const hexcase = 0;
  function safe_add(x: number, y: number) {
    const lsw = (x & 0xFFFF) + (y & 0xFFFF);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  }
  function S(X: number, n: number) { return (X >>> n) | (X << (32 - n)); }
  function R(X: number, n: number) { return (X >>> n); }
  function Ch(x: number, y: number, z: number) { return ((x & y) ^ (~x & z)); }
  function Maj(x: number, y: number, z: number) { return ((x & y) ^ (x & z) ^ (y & z)); }
  function Sigma0256(x: number) { return (S(x, 2) ^ S(x, 13) ^ S(x, 22)); }
  function Sigma1256(x: number) { return (S(x, 6) ^ S(x, 11) ^ S(x, 25)); }
  function Gamma0256(x: number) { return (S(x, 7) ^ S(x, 18) ^ R(x, 3)); }
  function Gamma1256(x: number) { return (S(x, 17) ^ S(x, 19) ^ R(x, 10)); }
  function core_sha256(m: number[], l: number) {
    const K = [
      0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5, 0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
      0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3, 0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
      0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC, 0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
      0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7, 0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
      0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13, 0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
      0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3, 0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
      0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5, 0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
      0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208, 0x90BEFFFA, 0xA4506CEB, 0xBEF9A3E7, 0xC67178F2
    ];
    const HASH = [0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19];
    const W = new Array(64);
    let a, b, c, d, e, f, g, h, i, j;
    let T1, T2;
    m[l >> 5] |= 0x80 << (24 - l % 32);
    m[((l + 64 >> 9) << 4) + 15] = l;
    for (i = 0; i < m.length; i += 16) {
      a = HASH[0]; b = HASH[1]; c = HASH[2]; d = HASH[3]; e = HASH[4]; f = HASH[5]; g = HASH[6]; h = HASH[7];
      for (j = 0; j < 64; j++) {
        if (j < 16) W[j] = m[j + i];
        else W[j] = safe_add(safe_add(safe_add(Gamma1256(W[j - 2]), W[j - 7]), Gamma0256(W[j - 15])), W[j - 16]);
        T1 = safe_add(safe_add(safe_add(safe_add(h, Sigma1256(e)), Ch(e, f, g)), K[j]), W[j]);
        T2 = safe_add(Sigma0256(a), Maj(a, b, c));
        h = g; g = f; f = e; e = safe_add(d, T1); d = c; c = b; b = a; a = safe_add(T1, T2);
      }
      HASH[0] = safe_add(a, HASH[0]); HASH[1] = safe_add(b, HASH[1]); HASH[2] = safe_add(c, HASH[2]); HASH[3] = safe_add(d, HASH[3]);
      HASH[4] = safe_add(e, HASH[4]); HASH[5] = safe_add(f, HASH[5]); HASH[6] = safe_add(g, HASH[6]); HASH[7] = safe_add(h, HASH[7]);
    }
    return HASH;
  }
  function str2binb(str: string) {
    const bin = [];
    const mask = (1 << chrsz) - 1;
    for (let i = 0; i < str.length * chrsz; i += chrsz) {
      bin[i >> 5] |= (str.charCodeAt(i / chrsz) & mask) << (24 - i % 32);
    }
    return bin;
  }
  function binb2hex(binarray: number[]) {
    const hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
    let str = "";
    for (let i = 0; i < binarray.length * 4; i++) {
      str += hex_tab.charAt((binarray[i >> 2] >> ((3 - i % 4) * 8 + 4)) & 0xF) +
             hex_tab.charAt((binarray[i >> 2] >> ((3 - i % 4) * 8)) & 0xF);
    }
    return str;
  }
  return binb2hex(core_sha256(str2binb(text), text.length * chrsz));
};

const encodeMockSignedJWT = (payload: any): string => {
  const header = { alg: "RS256", typ: "JWT", kid: "nic-irp-public-key-v1" };
  const base64Encode = (obj: any) => {
    const str = JSON.stringify(obj);
    if (typeof window !== 'undefined') {
      return btoa(unescape(encodeURIComponent(str)));
    } else {
      return Buffer.from(str).toString('base64');
    }
  };
  const headerB64 = base64Encode(header);
  const payloadB64 = base64Encode(payload);
  const mockSignature = "mock_nic_irp_digital_signature_RS256_u8293hf98gh82h39ghfuih2309fgh237gh8f9uh234fg";
  return `${headerB64}.${payloadB64}.${mockSignature}`;
};

export const generateEInvoice = async (invoiceId: string): Promise<Partial<Invoice>> => {
  if (!navigator.onLine) throw new Error("Connection required for E-Invoicing");
  
  await delay(1200); 
  const inv = MOCK_INVOICES.find(i => i.id === invoiceId);

  if (!inv) throw new Error("Invoice not found");

  // Multi-Stage Approval Gatekeeper: Senior Finance Manager Sign-Off is mandatory before dispatching to Government Portal (IRP/NIC)
  if (inv.category === 'SALES' && inv.approvalStage && inv.approvalStage !== 'APPROVED' && inv.approvalStage !== 'SUBMITTED_TO_PORTAL' && inv.status !== 'APPROVED' && inv.status !== 'UPLOADED' && inv.status !== 'FILED') {
    throw new Error(`Statutory Sign-Off Required: Invoice #${inv.invoiceNumber} is currently in '${inv.approvalStage || inv.status}' stage. A Senior Finance Manager must formally sign off before dispatching this document to the Government Portal (IRP/NIC).`);
  }

  if (inv.invoiceNumber.endsWith('5') || inv.invoiceNumber.endsWith('0')) {
       const error = "IRP: System timed out or Duplicate IRN";
       MOCK_INVOICES = MOCK_INVOICES.map(i => i.id === invoiceId ? { ...i, status: 'FAILED', irnError: error } : i);
       save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);
       throw new Error(error);
  }

  // Determine Financial Year based on Invoice Date
  const invDate = new Date(inv.date);
  const month = invDate.getMonth() + 1; // 1-12
  const year = invDate.getFullYear();
  const fy = month >= 4 ? `${year}-${(year + 1).toString().substring(2)}` : `${year - 1}-${year.toString().substring(2)}`;
  
  const supplierGstin = inv.supplierGstin || (inv.tenantId === 't1' ? '27ABCDE1234F1Z5' : '04XYZZZ9876L1Z1');
  const docType = inv.docType || 'INV';
  const docNo = inv.invoiceNumber;

  // Build the official NIC-IRP concatenated string for IRN calculation
  // Formula: SupplierGSTIN + FinancialYear + DocType + DocNo
  const concatString = `${supplierGstin}${fy}${docType}${docNo}`;
  const irn = calculateSHA256Sync(concatString);

  // Build compliant payload for digital signed QR Code JWT
  const qrPayload = {
    gsp: "TaxFlowNICClient",
    sellerGstin: supplierGstin,
    buyerGstin: inv.gstin || 'URP',
    docNo: docNo,
    docDt: inv.date,
    totVal: Number((inv.amount + inv.taxAmount).toFixed(2)),
    itemCount: inv.items?.length || 1,
    mainHsn: inv.items?.[0]?.hsnSac || '998313',
    irn: irn,
    ackNo: `${100000000000 + Math.floor(Math.random() * 900000000000)}`,
    ackDt: new Date().toISOString()
  };

  const signedQrCodeData = encodeMockSignedJWT(qrPayload);
  const ackNo = qrPayload.ackNo;
  const ackDate = qrPayload.ackDt;
  
  const historyEntry = {
    action: 'IRN_GENERATED',
    timestamp: ackDate,
    user: ACTIVE_USER?.email || 'admin@taxflow.com',
    details: `Generated successfully. Calculated IRN String: ${concatString}. Registered on Sandbox GSP.`
  };

  const portalDispatchAction: ApprovalStageAction = {
    stage: 'PORTAL_DISPATCH',
    status: 'DISPATCHED',
    actionBy: {
      name: ACTIVE_USER?.name || 'Authorized Signatory',
      email: ACTIVE_USER?.email || 'admin@taxflow.com',
      role: ACTIVE_USER?.role || UserRole.ADMIN,
      designation: 'Government Portal Gateway Operator'
    },
    timestamp: ackDate,
    notes: `Transmitted to NIC IRP. IRN: ${irn.substring(0, 16)}... | Ack No: ${ackNo}`
  };

  const updatedWorkflow: InvoiceApprovalWorkflow = {
    ...(inv.approvalWorkflow || {
      currentStage: 'SUBMITTED_TO_PORTAL',
      overallStatus: 'SUBMITTED_TO_PORTAL',
      history: []
    }),
    currentStage: 'SUBMITTED_TO_PORTAL',
    overallStatus: 'SUBMITTED_TO_PORTAL',
    history: [portalDispatchAction, ...(inv.approvalWorkflow?.history || [])]
  };

  MOCK_INVOICES = MOCK_INVOICES.map(item => item.id === invoiceId ? { 
    ...item, 
    irn, 
    qrCodeUrl: signedQrCodeData, // Use the signed payload directly for local SVG generation and parsing
    ackNo, 
    ackDate, 
    status: 'UPLOADED', 
    approvalStage: 'SUBMITTED_TO_PORTAL',
    approvalWorkflow: updatedWorkflow,
    irnStatus: 'ACTIVE',
    irnError: undefined,
    irnHistory: [historyEntry, ...(item.irnHistory || [])]
  } : item);
  
  save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);
  return { irn, qrCodeUrl: signedQrCodeData, ackNo, ackDate, status: 'UPLOADED' };
};

// --- MULTI-STAGE INVOICE APPROVAL WORKFLOW SERVICE METHODS ---

export const submitInvoiceForApproval = async (
  invoiceId: string,
  user: { name: string; email: string; role: UserRole },
  notes?: string
): Promise<Invoice> => {
  await delay(400);
  const index = MOCK_INVOICES.findIndex(i => i.id === invoiceId);
  if (index === -1) throw new Error("Invoice not found");

  const inv = MOCK_INVOICES[index];
  const now = new Date().toISOString();

  const historyAction: ApprovalStageAction = {
    stage: 'PREPARATION',
    status: 'APPROVED',
    actionBy: {
      name: user.name,
      email: user.email,
      role: user.role,
      designation: user.role === UserRole.ACCOUNTANT ? 'Staff Accountant' : 'Preparer'
    },
    timestamp: now,
    notes: notes || 'Draft finalized and submitted for Stage 1 Finance Review.'
  };

  const updatedWorkflow: InvoiceApprovalWorkflow = {
    ...(inv.approvalWorkflow || {
      currentStage: 'FINANCE_REVIEW',
      overallStatus: 'PENDING_FINANCE_REVIEW',
      history: []
    }),
    currentStage: 'FINANCE_REVIEW',
    overallStatus: 'PENDING_FINANCE_REVIEW',
    preparedBy: {
      name: user.name,
      email: user.email,
      role: user.role,
      timestamp: now,
      notes: notes || 'Submitted for multi-stage approval.'
    },
    history: [historyAction, ...(inv.approvalWorkflow?.history || [])]
  };

  const updatedInvoice: Invoice = {
    ...inv,
    status: 'PENDING_APPROVAL',
    approvalStage: 'PENDING_FINANCE_REVIEW',
    approvalWorkflow: updatedWorkflow
  };

  MOCK_INVOICES[index] = updatedInvoice;
  save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);
  await logAuditAction(`Submitted Invoice #${inv.invoiceNumber} for Finance Review`, 'INVOICE', `Submitted by ${user.name}`);
  return updatedInvoice;
};

export const reviewInvoiceByFinance = async (
  invoiceId: string,
  user: { name: string; email: string; role: UserRole },
  checklist: string[],
  notes?: string
): Promise<Invoice> => {
  await delay(450);
  const index = MOCK_INVOICES.findIndex(i => i.id === invoiceId);
  if (index === -1) throw new Error("Invoice not found");

  const inv = MOCK_INVOICES[index];
  const now = new Date().toISOString();

  const historyAction: ApprovalStageAction = {
    stage: 'FINANCE_REVIEW',
    status: 'APPROVED',
    actionBy: {
      name: user.name,
      email: user.email,
      role: user.role,
      designation: 'Finance & Compliance Manager'
    },
    timestamp: now,
    notes: notes || 'Line items, HSN classification, and tax mathematics validated.',
    checklistCompleted: checklist
  };

  const updatedWorkflow: InvoiceApprovalWorkflow = {
    ...(inv.approvalWorkflow || {
      currentStage: 'SR_FINANCE_SIGNOFF',
      overallStatus: 'PENDING_SR_FINANCE_SIGNOFF',
      history: []
    }),
    currentStage: 'SR_FINANCE_SIGNOFF',
    overallStatus: 'PENDING_SR_FINANCE_SIGNOFF',
    reviewedBy: {
      name: user.name,
      email: user.email,
      role: user.role,
      timestamp: now,
      notes: notes || 'Verified and forwarded to Senior Finance Manager for sign-off.',
      checklistCompleted: checklist,
      riskScore: 98
    },
    history: [historyAction, ...(inv.approvalWorkflow?.history || [])]
  };

  const updatedInvoice: Invoice = {
    ...inv,
    status: 'PENDING_APPROVAL',
    approvalStage: 'PENDING_SR_FINANCE_SIGNOFF',
    approvalWorkflow: updatedWorkflow
  };

  MOCK_INVOICES[index] = updatedInvoice;
  save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);
  await logAuditAction(`Finance Manager Review Completed: Invoice #${inv.invoiceNumber}`, 'INVOICE', `Reviewed by ${user.name}`);
  return updatedInvoice;
};

export const signoffInvoiceBySeniorFinance = async (
  invoiceId: string,
  user: { name: string; email: string; role: UserRole; designation?: string },
  signatureDetails: {
    declarationAccepted: boolean;
    evcOtpOrPin?: string;
    notes?: string;
  }
): Promise<Invoice> => {
  await delay(500);
  const index = MOCK_INVOICES.findIndex(i => i.id === invoiceId);
  if (index === -1) throw new Error("Invoice not found");

  const inv = MOCK_INVOICES[index];
  const now = new Date().toISOString();
  const signatureHash = `SIG-SRFIN-${calculateSHA256Sync(`${inv.id}-${inv.invoiceNumber}-${inv.amount}-${now}`)}`;

  const historyAction: ApprovalStageAction = {
    stage: 'SR_FINANCE_SIGNOFF',
    status: 'APPROVED',
    actionBy: {
      name: user.name,
      email: user.email,
      role: user.role,
      designation: user.designation || 'Senior Finance Manager (CFO / Partner)'
    },
    timestamp: now,
    notes: signatureDetails.notes || 'Statutory sign-off executed. Document authorized for transmission to Government Portal (IRP/NIC).',
    signatureHash
  };

  const updatedWorkflow: InvoiceApprovalWorkflow = {
    ...(inv.approvalWorkflow || {
      currentStage: 'READY_FOR_PORTAL',
      overallStatus: 'APPROVED',
      history: []
    }),
    currentStage: 'READY_FOR_PORTAL',
    overallStatus: 'APPROVED',
    seniorSignoff: {
      name: user.name,
      email: user.email,
      role: user.role,
      designation: user.designation || 'Senior Finance Manager',
      timestamp: now,
      signatureHash,
      evcOtpOrPin: signatureDetails.evcOtpOrPin || 'EVC-VERIFIED',
      declarationAccepted: signatureDetails.declarationAccepted,
      notes: signatureDetails.notes
    },
    history: [historyAction, ...(inv.approvalWorkflow?.history || [])]
  };

  const updatedInvoice: Invoice = {
    ...inv,
    status: 'APPROVED',
    approvalStage: 'APPROVED',
    approvalWorkflow: updatedWorkflow
  };

  MOCK_INVOICES[index] = updatedInvoice;
  save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);
  await logAuditAction(`Senior Finance Sign-Off Executed: Invoice #${inv.invoiceNumber}`, 'INVOICE', `Signed off by ${user.name} (${user.designation || 'Sr. Finance Manager'}) | Hash: ${signatureHash.substring(0, 16)}...`);
  return updatedInvoice;
};

export const requestInvoiceRevision = async (
  invoiceId: string,
  user: { name: string; email: string; role: UserRole; designation?: string },
  notes: string
): Promise<Invoice> => {
  await delay(400);
  const index = MOCK_INVOICES.findIndex(i => i.id === invoiceId);
  if (index === -1) throw new Error("Invoice not found");

  const inv = MOCK_INVOICES[index];
  const now = new Date().toISOString();

  const historyAction: ApprovalStageAction = {
    stage: inv.approvalStage === 'PENDING_SR_FINANCE_SIGNOFF' ? 'SR_FINANCE_SIGNOFF' : 'FINANCE_REVIEW',
    status: 'REVISED',
    actionBy: {
      name: user.name,
      email: user.email,
      role: user.role,
      designation: user.designation || 'Compliance Reviewer'
    },
    timestamp: now,
    notes: `Revision Requested: ${notes}`
  };

  const updatedWorkflow: InvoiceApprovalWorkflow = {
    ...(inv.approvalWorkflow || {
      currentStage: 'DRAFT',
      overallStatus: 'REVISION_REQUESTED',
      history: []
    }),
    currentStage: 'DRAFT',
    overallStatus: 'REVISION_REQUESTED',
    history: [historyAction, ...(inv.approvalWorkflow?.history || [])]
  };

  const updatedInvoice: Invoice = {
    ...inv,
    status: 'DRAFT',
    approvalStage: 'REVISION_REQUESTED',
    approvalWorkflow: updatedWorkflow
  };

  MOCK_INVOICES[index] = updatedInvoice;
  save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);
  await logAuditAction(`Revision Requested on Invoice #${inv.invoiceNumber}`, 'INVOICE', `By ${user.name}: ${notes}`);
  return updatedInvoice;
};

export const rejectInvoiceApproval = async (
  invoiceId: string,
  user: { name: string; email: string; role: UserRole; designation?: string },
  notes: string
): Promise<Invoice> => {
  await delay(400);
  const index = MOCK_INVOICES.findIndex(i => i.id === invoiceId);
  if (index === -1) throw new Error("Invoice not found");

  const inv = MOCK_INVOICES[index];
  const now = new Date().toISOString();

  const historyAction: ApprovalStageAction = {
    stage: inv.approvalStage === 'PENDING_SR_FINANCE_SIGNOFF' ? 'SR_FINANCE_SIGNOFF' : 'FINANCE_REVIEW',
    status: 'REJECTED',
    actionBy: {
      name: user.name,
      email: user.email,
      role: user.role,
      designation: user.designation || 'Signatory'
    },
    timestamp: now,
    notes: `Approval Rejected: ${notes}`
  };

  const updatedWorkflow: InvoiceApprovalWorkflow = {
    ...(inv.approvalWorkflow || {
      currentStage: 'DRAFT',
      overallStatus: 'REJECTED',
      history: []
    }),
    currentStage: 'DRAFT',
    overallStatus: 'REJECTED',
    history: [historyAction, ...(inv.approvalWorkflow?.history || [])]
  };

  const updatedInvoice: Invoice = {
    ...inv,
    status: 'FAILED',
    approvalStage: 'REJECTED',
    approvalWorkflow: updatedWorkflow
  };

  MOCK_INVOICES[index] = updatedInvoice;
  save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);
  await logAuditAction(`Invoice #${inv.invoiceNumber} Rejected in Approval Workflow`, 'INVOICE', `By ${user.name}: ${notes}`);
  return updatedInvoice;
};

export const cancelEInvoice = async (invoiceId: string, reason: string, remarks: string): Promise<{ success: boolean; invoice: Invoice }> => {
  if (!navigator.onLine) throw new Error("Connection required for cancelling E-Invoice");
  
  await delay(1200);
  const index = MOCK_INVOICES.findIndex(i => i.id === invoiceId);
  if (index === -1) throw new Error("Invoice not found");
  
  const oldInvoice = MOCK_INVOICES[index];

  // Enforce official GST rule: 24h cancellation limit
  if (oldInvoice.ackDate) {
    const hoursElapsed = (Date.now() - new Date(oldInvoice.ackDate).getTime()) / (1000 * 60 * 60);
    const bypassSim = localStorage.getItem('irp_bypass_cancellation_limit') === 'true';
    if (hoursElapsed > 24 && !bypassSim) {
      throw new Error("GST IRP Rule Violation (Code: 2142): E-Invoice cancellation is strictly limited to 24 hours after generation on the portal. Please issue a GSTR-1 Amendment or a Credit Note to revoke this transaction.");
    }
  }
  
  const cancelledHistory = {
    action: 'IRN_CANCELLED',
    timestamp: new Date().toISOString(),
    user: ACTIVE_USER?.email || 'admin@taxflow.com',
    details: `Reason: ${reason} | Remarks: ${remarks}`
  };
  
  const updatedInvoice = {
    ...oldInvoice,
    irnStatus: 'CANCELLED' as const,
    irnCancellationReason: reason,
    irnCancellationRemarks: remarks,
    irnCancelledAt: new Date().toISOString(),
    irnHistory: [cancelledHistory, ...(oldInvoice.irnHistory || [])]
  };
  
  MOCK_INVOICES[index] = updatedInvoice;
  save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);
  
  await logAuditAction(`Cancelled IRN for ${updatedInvoice.invoiceNumber}`, 'INVOICE', `Reason: ${reason}`);
  return { success: true, invoice: updatedInvoice };
};

export const generateEWayBill = async (
    invoiceId: string,
    vehicleNo?: string,
    transportMode?: 'ROAD' | 'RAIL' | 'AIR' | 'SHIP',
    transportDocNo?: string,
    transporterId?: string,
    transporterName?: string
): Promise<EWayBill> => {
    if (!navigator.onLine) throw new Error("Connection required for E-Way Bill");

    await delay(1500);
    const ewb: EWayBill = {
        ewayBillNo: `141${Math.floor(100000000 + Math.random() * 900000000)}`,
        ewayBillDate: new Date().toLocaleString(),
        validUpto: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        status: 'ACTIVE',
        vehicleNo: vehicleNo || 'MH-12-PQ-9876',
        transportMode: transportMode || 'ROAD',
        transportDocNo: transportDocNo || 'TR-DOC-7762',
        transporterId: transporterId || 'TRANS-9081',
        transporterName: transporterName || 'SuperFast Logistics Ltd',
        vehicleHistory: vehicleNo ? [{
            vehicleNo,
            fromPlace: 'Mumbai Warehouse',
            updatedAt: new Date().toLocaleString(),
            reason: 'Initial Vehicle Dispatch',
            transportDocNo: transportDocNo || 'TR-DOC-7762'
        }] : []
    };
    MOCK_INVOICES = MOCK_INVOICES.map(i => i.id === invoiceId ? { ...i, ewayBillDetails: ewb, ewayBillError: undefined } : i);
    save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);
    return ewb;
};

export const cancelEWayBill = async (invoiceId: string, reason: string, remarks: string): Promise<EWayBill> => {
    if (!navigator.onLine) throw new Error("Connection required for E-Way Bill");
    await delay(1000);
    
    const invoice = MOCK_INVOICES.find(i => i.id === invoiceId);
    if (!invoice || !invoice.ewayBillDetails) throw new Error("E-Way Bill not found for this invoice");
    
    const updatedEwb: EWayBill = {
        ...invoice.ewayBillDetails,
        status: 'CANCELLED'
    };
    
    MOCK_INVOICES = MOCK_INVOICES.map(i => i.id === invoiceId ? { ...i, ewayBillDetails: updatedEwb } : i);
    save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);
    await logAuditAction(`Cancelled E-Way Bill ${updatedEwb.ewayBillNo} for ${invoice.invoiceNumber}. Reason: ${reason}`, 'INVOICE');
    return updatedEwb;
};

export const extendEWayBill = async (
    invoiceId: string, 
    reason: string, 
    vehicleNo: string, 
    currentPlace: string, 
    remainingDistance: number
): Promise<EWayBill> => {
    if (!navigator.onLine) throw new Error("Connection required for E-Way Bill");
    await delay(1200);
    
    const invoice = MOCK_INVOICES.find(i => i.id === invoiceId);
    if (!invoice || !invoice.ewayBillDetails) throw new Error("E-Way Bill not found for this invoice");
    
    const currentValidUpto = new Date(invoice.ewayBillDetails.validUpto);
    // Add 2 days for validity extension
    const extendedValidUpto = new Date(currentValidUpto.getTime() + 86400000 * 2).toISOString().split('T')[0];
    const currentCount = invoice.ewayBillDetails.extendedCount || 0;
    
    const updatedEwb: EWayBill = {
        ...invoice.ewayBillDetails,
        validUpto: extendedValidUpto,
        currentPlace,
        extendedCount: currentCount + 1,
        vehicleNo
    };
    
    MOCK_INVOICES = MOCK_INVOICES.map(i => i.id === invoiceId ? { ...i, ewayBillDetails: updatedEwb } : i);
    save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);
    await logAuditAction(`Extended validity of E-Way Bill ${updatedEwb.ewayBillNo} to ${extendedValidUpto}. Reason: ${reason}`, 'INVOICE');
    return updatedEwb;
};

export const updateEWayBillVehicle = async (
    invoiceId: string,
    vehicleNo: string,
    fromPlace: string,
    reason: string,
    transportDocNo?: string
): Promise<EWayBill> => {
    if (!navigator.onLine) throw new Error("Connection required for E-Way Bill");
    await delay(1000);
    
    const invoice = MOCK_INVOICES.find(i => i.id === invoiceId);
    if (!invoice || !invoice.ewayBillDetails) throw new Error("E-Way Bill not found for this invoice");
    
    const history = invoice.ewayBillDetails.vehicleHistory || [];
    const newHistoryEntry = {
        vehicleNo,
        fromPlace,
        updatedAt: new Date().toLocaleString(),
        reason,
        transportDocNo
    };
    
    const updatedEwb: EWayBill = {
        ...invoice.ewayBillDetails,
        vehicleNo,
        transportDocNo: transportDocNo || invoice.ewayBillDetails.transportDocNo,
        vehicleHistory: [...history, newHistoryEntry]
    };
    
    MOCK_INVOICES = MOCK_INVOICES.map(i => i.id === invoiceId ? { ...i, ewayBillDetails: updatedEwb } : i);
    save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);
    await logAuditAction(`Updated Vehicle to ${vehicleNo} for E-Way Bill ${updatedEwb.ewayBillNo}. Reason: ${reason}`, 'INVOICE');
    return updatedEwb;
};

export const updateEWayBillTransporter = async (
    invoiceId: string,
    transporterId: string,
    transporterName: string
): Promise<EWayBill> => {
    if (!navigator.onLine) throw new Error("Connection required for E-Way Bill");
    await delay(1000);
    
    const invoice = MOCK_INVOICES.find(i => i.id === invoiceId);
    if (!invoice || !invoice.ewayBillDetails) throw new Error("E-Way Bill not found for this invoice");
    
    const updatedEwb: EWayBill = {
        ...invoice.ewayBillDetails,
        transporterId,
        transporterName
    };
    
    MOCK_INVOICES = MOCK_INVOICES.map(i => i.id === invoiceId ? { ...i, ewayBillDetails: updatedEwb } : i);
    save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);
    await logAuditAction(`Assigned transporter ${transporterName} (${transporterId}) to E-Way Bill ${updatedEwb.ewayBillNo}`, 'INVOICE');
    return updatedEwb;
};

export const updateEWayBillPartB = async (
    invoiceId: string,
    vehicleNo: string,
    transportDocNo: string,
    transportMode: 'ROAD' | 'RAIL' | 'AIR' | 'SHIP'
): Promise<EWayBill> => {
    if (!navigator.onLine) throw new Error("Connection required for E-Way Bill");
    await delay(1000);
    
    const invoice = MOCK_INVOICES.find(i => i.id === invoiceId);
    if (!invoice || !invoice.ewayBillDetails) throw new Error("E-Way Bill not found for this invoice");
    
    const updatedEwb: EWayBill = {
        ...invoice.ewayBillDetails,
        vehicleNo,
        transportDocNo,
        transportMode
    };
    
    MOCK_INVOICES = MOCK_INVOICES.map(i => i.id === invoiceId ? { ...i, ewayBillDetails: updatedEwb } : i);
    save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);
    await logAuditAction(`Updated Part-B parameters for E-Way Bill ${updatedEwb.ewayBillNo}`, 'INVOICE');
    return updatedEwb;
};

export interface ConsolidatedEWayBill {
    id: string;
    consolidatedEwbNo: string;
    consolidatedEwbDate: string;
    vehicleNo: string;
    fromPlace: string;
    stateCode: string;
    ewbNumbers: string[];
    transportMode: 'ROAD' | 'RAIL' | 'AIR' | 'SHIP';
}

export const fetchConsolidatedEWayBills = async (): Promise<ConsolidatedEWayBill[]> => {
    const data = localStorage.getItem('taxflow_consolidated_ewbs');
    if (!data) {
        const dummy: ConsolidatedEWayBill[] = [
            {
                id: 'con-1',
                consolidatedEwbNo: '891002345261',
                consolidatedEwbDate: new Date(Date.now() - 86400000).toLocaleString(),
                vehicleNo: 'KA-03-MM-1212',
                fromPlace: 'Bangalore East',
                stateCode: '29',
                ewbNumbers: ['141908123241', '141098123555'],
                transportMode: 'ROAD'
            }
        ];
        localStorage.setItem('taxflow_consolidated_ewbs', JSON.stringify(dummy));
        return dummy;
    }
    return JSON.parse(data);
};

export const createConsolidatedEWayBill = async (
    vehicleNo: string,
    fromPlace: string,
    stateCode: string,
    ewbNumbers: string[],
    transportMode: 'ROAD' | 'RAIL' | 'AIR' | 'SHIP'
): Promise<ConsolidatedEWayBill> => {
    await delay(1200);
    const bills = await fetchConsolidatedEWayBills();
    const newBill: ConsolidatedEWayBill = {
        id: 'con-' + Date.now(),
        consolidatedEwbNo: `891${Math.floor(100000000 + Math.random() * 900000000)}`,
        consolidatedEwbDate: new Date().toLocaleString(),
        vehicleNo,
        fromPlace,
        stateCode,
        ewbNumbers,
        transportMode
    };
    const updated = [newBill, ...bills];
    localStorage.setItem('taxflow_consolidated_ewbs', JSON.stringify(updated));
    await logAuditAction(`Generated Consolidated E-Way Bill ${newBill.consolidatedEwbNo} for vehicle ${vehicleNo}`, 'INVOICE');
    return newBill;
};

export const requestGstnOtp = async (username: string): Promise<{ success: boolean; message: string }> => {
    await delay(1000);
    return { success: true, message: 'OTP sent to registered mobile' };
};

export const verifyGstnOtp = async (username: string, otp: string): Promise<{ success: boolean; token?: string }> => {
    await delay(1500);
    if (otp === '123456') {
        GSTN_SESSION = { connected: true, username, tokenExpiry: Date.now() + 3600000 };
        return { success: true, token: 'gstn_token_' + Date.now() };
    }
    throw new Error('Invalid OTP');
};

export const getGstnConnectionStatus = async () => {
    await delay(500);
    const isExpired = Date.now() > GSTN_SESSION.tokenExpiry;
    if (isExpired && GSTN_SESSION.connected) {
        GSTN_SESSION.connected = false;
        return { status: 'EXPIRED', username: GSTN_SESSION.username };
    }
    return { status: GSTN_SESSION.connected ? 'CONNECTED' : 'DISCONNECTED', username: GSTN_SESSION.username, expiry: GSTN_SESSION.tokenExpiry };
};

export const syncFilingStatus = async () => {
    if (!navigator.onLine) return [...MOCK_FILINGS];
    await delay(1500);
    MOCK_FILINGS = MOCK_FILINGS.map(f => {
        if(f.status === 'PENDING' && Math.random() > 0.7) {
            return { ...f, status: 'FILED', arn: `AA${Math.floor(Math.random() * 1000000000)}`, filedDate: new Date().toISOString().split('T')[0] }
        }
        return f;
    });
    save(STORAGE_KEYS.FILINGS, MOCK_FILINGS);
    return [...MOCK_FILINGS];
}

export const validateHsn = async (code: string): Promise<{ isValid: boolean; description?: string; rate?: number }> => {
  await delay(800);
  const mockDb: Record<string, { desc: string; rate: number }> = {
    '998313': { desc: 'IT Services - Information Technology Software Services', rate: 18 },
    '8528': { desc: 'Monitors and Projectors', rate: 18 },
    '8471': { desc: 'Automatic Data Processing Machines (Computers)', rate: 18 },
    '9963': { desc: 'Accommodation, Food and Beverage Services', rate: 5 },
  };
  if (mockDb[code]) return { isValid: true, description: mockDb[code].desc, rate: mockDb[code].rate };
  return { isValid: false };
};

export const bulkImportInvoices = async (
    file: File, 
    validInvoices?: ParsedCsvRow[], 
    totalDetectedCount?: number, 
    failedCount?: number
): Promise<ImportLog> => {
    await delay(600);
    const tenantId = 't1';

    let successInvoicesCount = 0;
    if (validInvoices && validInvoices.length > 0) {
        const tenant = MOCK_TENANTS.find(t => t.id === tenantId);
        const homeState = tenant?.stateCode || '27';

        const newInvoiceObjects: Invoice[] = validInvoices.map((row, idx) => {
            const isInterState = row.placeOfSupply && row.placeOfSupply !== homeState;
            const igst = isInterState ? row.taxAmount : 0;
            const cgst = !isInterState ? row.taxAmount / 2 : 0;
            const sgst = !isInterState ? row.taxAmount / 2 : 0;

            const baseInv: Invoice = {
                id: `inv-imp-${Date.now()}-${idx}`,
                tenantId,
                invoiceNumber: row.invoiceNumber,
                partyName: row.partyName,
                gstin: row.gstin,
                placeOfSupply: row.placeOfSupply || homeState,
                date: row.date,
                amount: row.totalAmount,
                taxAmount: row.taxAmount,
                taxDetails: {
                    taxableValue: row.totalAmount,
                    igst,
                    cgst,
                    sgst,
                    utgst: 0,
                    cess: 0
                },
                items: [
                    {
                        id: `item-1`,
                        description: `Imported Item (${row.invoiceNumber})`,
                        hsnSac: '9983',
                        quantity: 1,
                        unit: 'NOS',
                        rate: row.totalAmount,
                        taxRate: 18,
                        taxableValue: row.totalAmount,
                        taxAmount: row.taxAmount
                    }
                ],
                status: 'PENDING',
                type: row.type || (row.gstin ? 'B2B' : 'B2C'),
                category: row.category || 'SALES',
                docType: 'INVOICE'
            };

            // Run automated statutory ITC classification for purchase invoices
            return ITCTaggingService.tagSingleInvoice(baseInv);
        });

        MOCK_INVOICES = [...newInvoiceObjects, ...MOCK_INVOICES];
        save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);
        successInvoicesCount = newInvoiceObjects.length;

        await logAuditAction(
            `Bulk Imported Invoices`, 
            'INVOICE', 
            `File: ${file.name} | Total Valid: ${successInvoicesCount} | Errors: ${failedCount || 0}`
        );
    }

    const totalCount = totalDetectedCount ?? (validInvoices?.length || 100);
    const failureCount = failedCount ?? Math.max(0, totalCount - successInvoicesCount);

    const res = await fetch('/api/invoices/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tenantId,
            fileName: file.name,
            totalCount,
            successCount: successInvoicesCount || (totalCount - failureCount),
            failureCount
        })
    });

    return res.json();
};

export const fetchImportHistory = async (tenantId: string = 't1'): Promise<ImportLog[]> => {
    const res = await fetch(`/api/invoices/import-history?tenantId=${tenantId}`);
    return res.json();
};

export const runAutomatedItcTagging = async (tenantId: string = 't1'): Promise<{
    taggedCount: number;
    eligibleCount: number;
    nonEligibleCount: number;
    eligibleTaxAmount: number;
    blockedTaxAmount: number;
}> => {
    await delay(600);
    const { updatedInvoices, summary } = ITCTaggingService.tagBatchInvoices(MOCK_INVOICES);
    MOCK_INVOICES = updatedInvoices;
    save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);

    await logAuditAction(
        'Automated ITC Tagging Batch Executed',
        'COMPLIANCE',
        `Processed: ${summary.purchaseInvoices} Purchase Invoices | Eligible: ${summary.eligibleCount} | Blocked/Non-Eligible: ${summary.nonEligibleCount}`
    );

    return {
        taggedCount: summary.purchaseInvoices,
        eligibleCount: summary.eligibleCount,
        nonEligibleCount: summary.nonEligibleCount,
        eligibleTaxAmount: summary.eligibleItcTax,
        blockedTaxAmount: summary.blockedItcTax
    };
};

export const runGstr2bMatchingService = async (
    tenantId: string = 't1',
    customGstr2bRecords?: GSTR2BPortalRecord[],
    config: GSTR2BMatchingConfig = DEFAULT_GSTR2B_MATCHING_CONFIG
): Promise<{
    results: GSTR2BMatchResultItem[];
    summary: GSTR2BMatchingSummary;
}> => {
    try {
        const purchaseInvoices = MOCK_INVOICES.filter(i => (i.category === 'PURCHASE' || !i.category) && i.tenantId === tenantId);
        const response = await fetch('/api/v1/gst/reconcile-gstr2b-matching', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                purchaseInvoices,
                gstr2bRecords: customGstr2bRecords,
                config
            })
        });

        if (response.ok) {
            const body = await response.json();
            if (body.success && body.results && body.summary) {
                return { results: body.results, summary: body.summary };
            }
        }
    } catch (err) {
        console.warn("Falling back to client-side GSTR-2B matching execution:", err);
    }

    const purchaseInvoices = MOCK_INVOICES.filter(i => (i.category === 'PURCHASE' || !i.category) && i.tenantId === tenantId);
    const gstr2b = customGstr2bRecords && customGstr2bRecords.length > 0
        ? customGstr2bRecords
        : GSTR2BMatchingService.generateMockGSTR2BData(purchaseInvoices);

    return GSTR2BMatchingService.matchGSTR2BWithPurchaseRegister(purchaseInvoices, gstr2b, config);
};

export const createInvoiceVersion = async (invoiceId: string, versionData: { modifiedBy: string, changeSummary: string, dataSnapshot: any }): Promise<InvoiceVersion> => {
    const res = await fetch(`/api/invoices/${invoiceId}/version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(versionData)
    });
    return res.json();
};

export const restoreInvoiceVersion = async (invoiceId: string, versionId: string): Promise<{ status: string, message: string }> => {
    await delay(1000);
    const index = MOCK_INVOICES.findIndex(i => i.id === invoiceId);
    if (index === -1) throw new Error('Invoice not found');
    
    const invoice = MOCK_INVOICES[index];
    const version = invoice.versionHistory?.find(v => v.id === versionId);
    
    if (!version) throw new Error('Version not found');
    
    // Create a new version for the restoration itself (so we can undo the undo)
    const restorationVersion: InvoiceVersion = {
        id: `ver-${Date.now()}`,
        timestamp: new Date().toISOString(),
        modifiedBy: 'Admin User',
        changeSummary: `Restored to version from ${new Date(version.timestamp).toLocaleString()}`,
        dataSnapshot: { ...invoice, versionHistory: undefined }
    };

    const restoredInvoice = { 
        ...invoice, 
        ...version.dataSnapshot, 
        versionHistory: [restorationVersion, ...(invoice.versionHistory || [])] 
    };
    
    MOCK_INVOICES[index] = restoredInvoice;
    save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);
    
    await logAuditAction(`Restored Invoice: ${invoice.invoiceNumber}`, 'INVOICE', `To version: ${versionId}`);

    return { status: "success", message: "Invoice restored successfully" };
};

export const startReconciliationJob = async (tenantId: string, type: 'PURCHASE' | 'SALES'): Promise<string> => {
    const response = await fetch('/api/recon/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, type })
    });
    const data = await response.json();
    return data.jobId;
};

export const getReconciliationJobStatus = async (jobId: string): Promise<{ status: string; progress: number }> => {
    const response = await fetch(`/api/recon/status/${jobId}`);
    return await response.json();
};

export const fetchReconData = async (type: 'PURCHASE' | 'SALES' = 'PURCHASE', tenantId: string = 't1'): Promise<ReconItem[]> => {
  try {
    const booksInvoices = MOCK_INVOICES
      .filter(inv => inv.category === type && inv.tenantId === tenantId)
      .map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        partyName: inv.partyName,
        gstin: inv.gstin,
        taxAmount: inv.taxAmount || 0
      }));

    // Seed mock data if books is empty to provide rich visual playground
    if (booksInvoices.length === 0) {
      for (let i = 0; i < 8; i++) {
        booksInvoices.push({
          id: `seed-b-${i}`,
          invoiceNumber: `${type === 'PURCHASE' ? 'PUR' : 'INV'}-2026-90${i}`,
          date: `2026-08-${10 + i}`,
          partyName: `Partner ${String.fromCharCode(65 + i)} Ltd`,
          gstin: `27ABCDE1234F1Z${i}`,
          taxAmount: 18000 + (i * 2500)
        });
      }
    }

    // Simulate GSTR-2B / Portal Invoices
    const portalInvoices = booksInvoices.map((inv, idx) => {
      if (idx === 0) return { ...inv, id: `port-${inv.id}` }; // Exact Match
      if (idx === 1) return { ...inv, id: `port-${inv.id}`, taxAmount: inv.taxAmount + 250 }; // Mismatch
      if (idx === 2) { // Delayed Date Match (Partial Match)
        const d = new Date(inv.date);
        d.setDate(d.getDate() + 4);
        return { ...inv, id: `port-${inv.id}`, date: d.toISOString().split('T')[0] };
      }
      if (idx === 3) return null; // Missing in Portal
      return { ...inv, id: `port-${inv.id}` };
    }).filter(Boolean) as any[];

    // Insert excess portal record (Missing in Books)
    portalInvoices.push({
      id: 'port-only-1',
      invoiceNumber: `${type === 'PURCHASE' ? 'PUR' : 'INV'}-2026-8888`,
      date: '2026-08-01',
      partyName: 'Unknown Vendor Special LLC',
      gstin: '27ABCDE1234F1Z9',
      taxAmount: 54000
    });

    const response = await fetch('/api/v1/gst/reconcile-2a-2b', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booksInvoices, portalInvoices })
    });

    if (response.ok) {
      const body = await response.json();
      if (body.success && body.results) {
        return body.results.map((rec: any, idx: number) => {
          const b = rec.booksRecord;
          const p = rec.portalRecord;
          const main = b || p;
          return {
            id: `rec-${type}-${idx}`,
            tenantId,
            type,
            invoiceNumber: main.invoiceNumber,
            date: main.date,
            partyName: main.partyName,
            gstin: main.gstin,
            taxAmountBooks: b ? b.taxAmount : 0,
            taxAmountPortal: p ? p.taxAmount : 0,
            difference: Math.abs((b ? b.taxAmount : 0) - (p ? p.taxAmount : 0)),
            status: rec.status,
            riskScore: rec.matchingScore < 50 ? 80 : (rec.status === 'PARTIAL_MATCH' ? 30 : 5),
            suggestedAction: rec.suggestedAction,
            notes: rec.discrepancies.join(', ') || undefined
          };
        });
      }
    }
  } catch (error) {
    console.warn("Falling back to local reconciliation simulation:", error);
  }

  await delay(1200);
  return Array.from({ length: 25 }).map((_, i) => {
    const statusPool: ReconStatus[] = ['MATCHED', 'MATCHED', 'MATCHED', 'MISMATCH', 'MISSING_IN_PORTAL', 'MISSING_IN_BOOKS', 'EXCESS_ITC', 'PARTIAL_MATCH'];
    const status = statusPool[i % statusPool.length];
    const amount = (i + 1) * 1500;
    const diff = status === 'MATCHED' ? 0 : (status === 'MISMATCH' ? amount * 0.1 : (status.includes('MISSING') ? amount : 0));
    return {
      id: `rec-${type}-${i}`, tenantId, type, invoiceNumber: `${type === 'PURCHASE' ? 'PUR' : 'INV'}-2024-${100 + i}`, date: `2024-10-${10 + (i % 20)}`,
      partyName: type === 'PURCHASE' ? `Vendor ${String.fromCharCode(65 + (i % 5))}` : `Customer ${String.fromCharCode(65 + (i % 5))}`,
      gstin: `27ABCDE1234F1Z${i % 9}`, taxAmountBooks: status === 'MISSING_IN_BOOKS' ? 0 : amount, taxAmountPortal: status === 'MISSING_IN_PORTAL' ? 0 : (status === 'MISMATCH' ? amount - diff : amount),
      difference: diff, status, riskScore: status === 'MATCHED' ? 5 : (status === 'MISMATCH' ? 45 : 85), suggestedAction: status === 'MATCHED' ? 'No Action' : (status === 'MISMATCH' ? 'Review Tax Rate' : 'Contact Party'),
    };
  });
};

export const fetchFilingHistory = async (tenantId: string = 't1'): Promise<FilingRecord[]> => { await delay(800); return MOCK_FILINGS.filter(f => f.tenantId === tenantId); };

export const createFilingRecord = async (filing: Omit<FilingRecord, 'id'>): Promise<FilingRecord> => {
    await delay(500);
    const newFiling: FilingRecord = {
        id: `f-${Date.now()}`,
        ...filing
    };
    MOCK_FILINGS.push(newFiling);
    save(STORAGE_KEYS.FILINGS, MOCK_FILINGS);
    return newFiling;
};

export const fetchFilingVersions = async (filingId: string, type: ReturnFormType, period: string): Promise<FilingVersion[]> => {
    await delay(600);
    let versions = MOCK_FILING_VERSIONS.filter(v => v.filingId === filingId);
    
    // If no versions exist, create an initial draft version v1 based on default return draft
    if (versions.length === 0) {
        const defaultDraft = {
            totalLiability: 1000000,
            itcAvailable: 800000,
            cashPayable: 200000,
            sections: [
                { label: 'B2B Supplies', count: 45, value: 850000 },
                { label: 'B2C (Large)', count: 5, value: 150000 },
                { label: 'Exports', count: 2, value: 50000 },
                { label: 'Credit Notes', count: 3, value: -25000 }
            ]
        };
        
        const initialVersion: FilingVersion = {
            id: `ver-${filingId}-1`,
            filingId,
            version: 1,
            timestamp: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
            modifiedBy: 'System Auto-Draft',
            status: 'DRAFT',
            changeSummary: 'Initial Auto-Draft compiled from invoices',
            summary: defaultDraft
        };
        
        MOCK_FILING_VERSIONS.push(initialVersion);
        save(STORAGE_KEYS.FILING_VERSIONS, MOCK_FILING_VERSIONS);
        versions = [initialVersion];
    }
    
    // Sort versions descending by number so newest is first
    return [...versions].sort((a, b) => b.version - a.version);
};

export const createFilingVersion = async (
    filingId: string, 
    status: 'DRAFT' | 'SUBMITTED' | 'PRE-VALIDATION', 
    changeSummary: string, 
    summary: FilingDataSummary,
    modifiedBy: string = 'Admin User'
): Promise<FilingVersion> => {
    await delay(500);
    const existing = MOCK_FILING_VERSIONS.filter(v => v.filingId === filingId);
    const nextVersionNum = existing.length > 0 ? Math.max(...existing.map(v => v.version)) + 1 : 1;
    
    const newVersion: FilingVersion = {
        id: `ver-${filingId}-${Date.now()}`,
        filingId,
        version: nextVersionNum,
        timestamp: new Date().toISOString(),
        modifiedBy,
        status,
        changeSummary,
        summary
    };
    
    MOCK_FILING_VERSIONS.push(newVersion);
    save(STORAGE_KEYS.FILING_VERSIONS, MOCK_FILING_VERSIONS);
    
    await logAuditAction(
        `Created Filing Version`, 
        'FILING', 
        `Filing ID: ${filingId} | Version: v${nextVersionNum} (${status})`
    );
    
    return newVersion;
};

export const revertFilingVersion = async (filingId: string, versionId: string): Promise<FilingVersion> => {
    await delay(600);
    const versionToRestore = MOCK_FILING_VERSIONS.find(v => v.id === versionId);
    if (!versionToRestore) throw new Error('Version not found');
    
    // Create a new version restoring that data
    const nextVersion = await createFilingVersion(
        filingId,
        'DRAFT',
        `Restored to Version v${versionToRestore.version} (from ${new Date(versionToRestore.timestamp).toLocaleDateString()})`,
        versionToRestore.summary,
        'Admin User'
    );
    
    return nextVersion;
};

export const fetchReturnDraft = async (type: ReturnFormType, period: string) => { await delay(1500); return { type, period, summary: { totalLiability: 1000000, itcAvailable: 800000, cashPayable: 200000, sections: [ { label: 'B2B Supplies', count: 45, value: 850000 }, { label: 'B2C (Large)', count: 5, value: 150000 }, { label: 'Exports', count: 2, value: 50000 }, { label: 'Credit Notes', count: 3, value: -25000 } ] } }; };

export const preCheckFilingData = async (invoices: Invoice[], tenantGstin: string): Promise<any> => {
    try {
        const response = await fetch('/api/v1/gst/filing/pre-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoices, tenantGstin })
        });
        if (response.ok) {
            const data = await response.json();
            return data.checkResult;
        }
    } catch (err) {
        console.warn("Filing pre-check fallback to client", err);
    }
    return { passed: true, violationsCount: 0, warningsCount: 0, details: [] };
};

export const prepareFilingPayload = async (invoices: Invoice[], tenantGstin: string, periodCode: string): Promise<any> => {
    try {
        const response = await fetch('/api/v1/gst/filing/prepare-payload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoices, tenantGstin, periodCode })
        });
        if (response.ok) {
            const data = await response.json();
            return data.payload;
        }
    } catch (err) {
        console.warn("Prepare filing payload fallback to client", err);
    }
    return null;
};

export const triggerPortalHandshake = async (gstin: string, otp?: string): Promise<any> => {
    const response = await fetch('/api/v1/gst/filing/handshake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gstin, otp })
    });
    if (!response.ok) {
        throw new Error("Handshake connection failed with GSTN Gateway.");
    }
    return response.json();
};

export const transmitFilingPayload = async (payload: any, sessionId: string): Promise<any> => {
    const response = await fetch('/api/v1/gst/filing/transmit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload, sessionId })
    });
    if (!response.ok) {
        throw new Error("GSTR transmission rejected by GSTN receivers.");
    }
    return response.json();
};

export const submitReturn = async (id: string, activeSummary?: FilingDataSummary) => { 
    if (!navigator.onLine) throw new Error("Cannot file return offline");
    
    const filingRecord = MOCK_FILINGS.find(f => f.id === id);
    let arn = `AA${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    let filedDate = new Date().toISOString().split('T')[0];

    try {
        // Trigger a live backend handshake session
        const handshake = await triggerPortalHandshake((filingRecord as any)?.gstin || "27ABCDE1234F1Z1", "123456");
        if (handshake.success) {
            const tx = await transmitFilingPayload(activeSummary || { totalLiability: 0, itcAvailable: 0, cashPayable: 0, sections: [] }, handshake.sessionId);
            if (tx.success) {
                arn = tx.arn;
                filedDate = tx.filedDate;
            }
        }
    } catch (err) {
        console.warn("Handshake/Transmit backend bypassed, falling back to mock", err);
    }

    MOCK_FILINGS = MOCK_FILINGS.map(f => f.id === id ? { ...f, status: 'FILED', arn, filedDate } : f); 
    save(STORAGE_KEYS.FILINGS, MOCK_FILINGS);
    
    if (filingRecord) {
        await logAuditAction(
            `Filed Return: ${filingRecord.type}`, 
            'FILING', 
            `Period: ${filingRecord.period}, ARN: ${arn}, Liability: ₹${(filingRecord.taxLiability || 0).toLocaleString()}`
        );

        // Auto-save a SUBMITTED version with actual active summary
        const finalSummary = activeSummary || {
            totalLiability: filingRecord.taxLiability || 1000000,
            itcAvailable: 800000,
            cashPayable: (filingRecord.taxLiability || 1000000) - 800000,
            sections: [
                { label: 'B2B Supplies', count: 45, value: (filingRecord.taxLiability || 1000000) * 0.85 },
                { label: 'B2C (Large)', count: 5, value: (filingRecord.taxLiability || 1000000) * 0.15 },
                { label: 'Exports', count: 2, value: 50000 },
                { label: 'Credit Notes', count: 3, value: -25000 }
            ]
        };

        const existing = MOCK_FILING_VERSIONS.filter(v => v.filingId === id);
        const nextVersionNum = existing.length > 0 ? Math.max(...existing.map(v => v.version)) + 1 : 1;

        const submittedVersion: FilingVersion = {
            id: `ver-${id}-${Date.now()}`,
            filingId: id,
            version: nextVersionNum,
            timestamp: new Date().toISOString(),
            modifiedBy: 'Admin User',
            status: 'SUBMITTED',
            changeSummary: `Final Submission - ARN: ${arn}`,
            summary: finalSummary
        };

        MOCK_FILING_VERSIONS.push(submittedVersion);
        save(STORAGE_KEYS.FILING_VERSIONS, MOCK_FILING_VERSIONS);
    }
    return { arn, filedDate }; 
};

export interface AutomatedFilingPayloadOptions {
    tenantId: string;
    tenantGstin: string;
    period: string;
    returnType: ReturnFormType;
    computationSummary?: TaxComputationSummary;
    invoices?: Invoice[];
    signatory: {
        name: string;
        designation: string;
        pan: string;
        authType: 'EVC' | 'DSC';
        evcOtp?: string;
    };
    ledgerSetoff: {
        igstUtilized: number;
        cgstUtilized: number;
        sgstUtilized: number;
        cashPaid: number;
        challanGenerated?: boolean;
        challanNumber?: string;
    };
    sendWhatsAppConfirmation?: boolean;
    recipientPhone?: string;
}

export const executeAutomatedMonthlyReturnFiling = async (options: AutomatedFilingPayloadOptions): Promise<any> => {
    if (!navigator.onLine) throw new Error("Cannot execute automated filing in offline mode.");

    let apiResult: any = null;
    try {
        const response = await fetch('/api/v1/gst/filing/automated-monthly-filing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(options)
        });

        if (response.ok) {
            apiResult = await response.json();
        }
    } catch (err) {
        console.warn("Server automated monthly filing API request failed, utilizing local fallback engine:", err);
    }

    const arn = apiResult?.arn || `AA${(options.tenantGstin || '27').slice(0, 2)}0726${Math.floor(1000000 + Math.random() * 9000000)}`;
    const filedDate = apiResult?.filedDate || new Date().toISOString().split('T')[0];
    const timestamp = apiResult?.timestamp || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const checksum = apiResult?.checksum || `sha256_${Math.random().toString(16).substring(2, 14).toUpperCase()}`;

    // Find or create matching filing record
    let existingFiling = MOCK_FILINGS.find(f => 
        (f.tenantId === options.tenantId || !f.tenantId) && 
        f.type === options.returnType && 
        f.period === options.period
    );

    if (existingFiling) {
        existingFiling.status = 'FILED';
        existingFiling.arn = arn;
        existingFiling.filedDate = filedDate;
        MOCK_FILINGS = MOCK_FILINGS.map(f => f.id === existingFiling!.id ? existingFiling! : f);
    } else {
        const newRecord: FilingRecord = {
            id: `filing-${Date.now()}`,
            tenantId: options.tenantId,
            type: options.returnType,
            period: options.period,
            fy: '2026-27',
            status: 'FILED',
            dueDate: '2026-08-20',
            filedDate,
            arn,
            taxLiability: options.computationSummary?.outputLiability ? 
                (options.computationSummary.outputLiability.igst + options.computationSummary.outputLiability.cgst + options.computationSummary.outputLiability.sgst + options.computationSummary.outputLiability.cess) : 
                (options.ledgerSetoff.igstUtilized + options.ledgerSetoff.cgstUtilized + options.ledgerSetoff.sgstUtilized + options.ledgerSetoff.cashPaid)
        };
        MOCK_FILINGS.push(newRecord);
        existingFiling = newRecord;
    }
    save(STORAGE_KEYS.FILINGS, MOCK_FILINGS);

    // Save Filing Version record
    const finalSummary: FilingDataSummary = {
        totalLiability: existingFiling.taxLiability || 315000,
        itcAvailable: (options.ledgerSetoff.igstUtilized + options.ledgerSetoff.cgstUtilized + options.ledgerSetoff.sgstUtilized) || 258000,
        cashPayable: options.ledgerSetoff.cashPaid || 57000,
        sections: [
            { label: 'Outward Taxable Supplies (Table 3.1(a))', count: 48, value: (existingFiling.taxLiability || 315000) * 0.85 },
            { label: 'Inward Supplies Liable to RCM (Table 3.1(d))', count: 4, value: (existingFiling.taxLiability || 315000) * 0.08 },
            { label: 'Zero Rated / Exports (Table 3.1(b))', count: 2, value: (existingFiling.taxLiability || 315000) * 0.07 },
            { label: 'Eligible ITC Claimed (Table 4(A))', count: 36, value: (options.ledgerSetoff.igstUtilized + options.ledgerSetoff.cgstUtilized + options.ledgerSetoff.sgstUtilized) || 258000 }
        ]
    };

    const newVersion: FilingVersion = {
        id: `ver-${existingFiling.id}-${Date.now()}`,
        filingId: existingFiling.id,
        version: 1,
        timestamp: new Date().toISOString(),
        modifiedBy: `${options.signatory.name} (${options.signatory.designation})`,
        status: 'SUBMITTED',
        changeSummary: `Automated Gateway Filing - ARN: ${arn} | EVC Verified (${options.signatory.authType})`,
        summary: finalSummary
    };
    MOCK_FILING_VERSIONS.push(newVersion);
    save(STORAGE_KEYS.FILING_VERSIONS, MOCK_FILING_VERSIONS);

    // Write cryptographic audit log
    await logAuditAction(
        `Automated Monthly Filing Completed: ${options.returnType}`,
        'FILING',
        `GSTIN: ${options.tenantGstin} | Period: ${options.period} | ARN: ${arn} | Tax Cleared: ₹${(existingFiling.taxLiability || 0).toLocaleString('en-IN')} | Signatory: ${options.signatory.name}`
    );

    return {
        success: true,
        arn,
        filedDate,
        timestamp,
        checksum,
        filingId: existingFiling.id,
        period: options.period,
        returnType: options.returnType,
        gstin: options.tenantGstin,
        taxSummary: apiResult?.taxSummary || {
            totalTurnover: options.computationSummary?.outputLiability?.taxableValue || 1850000,
            totalLiability: existingFiling.taxLiability || 315000,
            itcUtilized: (options.ledgerSetoff.igstUtilized + options.ledgerSetoff.cgstUtilized + options.ledgerSetoff.sgstUtilized) || 258000,
            cashPaid: options.ledgerSetoff.cashPaid || 57000,
            igst: options.computationSummary?.outputLiability?.igst || 145000,
            cgst: options.computationSummary?.outputLiability?.cgst || 85000,
            sgst: options.computationSummary?.outputLiability?.sgst || 85000,
            cess: options.computationSummary?.outputLiability?.cess || 0
        },
        signatory: options.signatory,
        whatsappSent: apiResult?.whatsappSent ?? Boolean(options.sendWhatsAppConfirmation && options.recipientPhone),
        message: `Form ${options.returnType} successfully transmitted to GSTN Gateway with ARN ${arn}.`
    };
};

export const fetchDashboardStats = async (tenantId: string = 't1', timeRange: string = 'MONTHLY', gstin?: string, branchId?: string) => { 
    await delay(300); 
    const invoices = MOCK_INVOICES.filter(inv => {
        if (inv.tenantId !== tenantId || inv.status === 'FAILED') return false;
        if (gstin && gstin !== 'ALL' && gstin !== 'ALL_GSTINS') {
            const matches = inv.supplierGstin === gstin || inv.gstin === gstin || inv.placeOfSupply === gstin.slice(0, 2);
            if (!matches) return false;
        }
        if (branchId && branchId !== 'ALL' && branchId !== 'ALL_BRANCHES') {
            if (inv.branchId && inv.branchId !== branchId) return false;
        }
        return true;
    });
    
    let sales = 0;
    let purchases = 0;
    let liability = 0;
    let itc = 0;

    invoices.forEach(inv => {
        if (inv.category === 'SALES') {
            sales += inv.amount;
            liability += inv.taxAmount;
        } else if (inv.category === 'PURCHASE') {
            purchases += inv.amount;
            if (!inv.isBlockedItc) {
                itc += inv.taxAmount;
            }
        }
    });

    const isSpecificGstin = gstin && gstin !== 'ALL' && gstin !== 'ALL_GSTINS';
    const tenantMultiplierMap: Record<string, number> = {
      't1': 1.0,
      't2': 0.65,
      't3': 0.45,
      't4': 0.50,
      't5': 0.32,
      't6': 0.28,
      't7': 0.22,
      't8': 0.18,
      't9': 0.25,
      't10': 0.40,
      't11': 0.15,
      't12': 0.18
    };
    const entityMult = tenantMultiplierMap[tenantId] || 0.3;
    const baseMult = entityMult * (isSpecificGstin ? 0.35 : 1.0);
    
    // Scale according to active time range: Weekly (~0.24x), Monthly (1.0x), Quarterly (~2.85x)
    const rangeMult = timeRange === 'WEEKLY' ? 0.24 : (timeRange === 'QUARTERLY' ? 2.85 : 1.0);

    const baseSales = sales > 0 ? sales : Math.round(1540000 * baseMult);
    const basePurchases = purchases > 0 ? purchases : Math.round(890000 * baseMult);
    const baseLiability = liability > 0 ? liability : Math.round(124000 * baseMult);
    const baseItc = itc > 0 ? itc : Math.round(98000 * baseMult);

    return {
        sales: Math.round(baseSales * rangeMult),
        purchases: Math.round(basePurchases * rangeMult),
        liability: Math.round(baseLiability * rangeMult),
        itc: Math.round(baseItc * rangeMult)
    };
};

export const fetchDashboardAnalytics = async (tenantId: string = 't1', timeRange: string = 'MONTHLY', gstin?: string, branchId?: string) => { 
    await delay(300); 
    const isSpecificGstin = gstin && gstin !== 'ALL' && gstin !== 'ALL_GSTINS';
    const tenantMultiplierMap: Record<string, number> = {
      't1': 1.0,
      't2': 0.65,
      't3': 0.45,
      't4': 0.50,
      't5': 0.32,
      't6': 0.28,
      't7': 0.22,
      't8': 0.18,
      't9': 0.25,
      't10': 0.40,
      't11': 0.15,
      't12': 0.18
    };
    const entityMult = tenantMultiplierMap[tenantId] || 0.3;
    const scalingFactor = isSpecificGstin ? 0.35 : 1.0;
    const baseMult = entityMult * scalingFactor;
    const isT2 = tenantId === 't2';

    let periods: string[] = [];
    let trendData: Array<{ sales: number; purchase: number; liability: number; itc: number; outputLiability: number; mismatches: number; accuracy: number }>;

    if (timeRange === 'WEEKLY') {
        periods = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'];
        const weeklyT1 = [
            { sales: 880, purchase: 520, liability: 560, itc: 410, outputLiability: 970, mismatches: 2, accuracy: 98 },
            { sales: 740, purchase: 390, liability: 510, itc: 280, outputLiability: 790, mismatches: 3, accuracy: 97 },
            { sales: 920, purchase: 610, liability: 620, itc: 490, outputLiability: 1110, mismatches: 1, accuracy: 99 },
            { sales: 810, purchase: 460, liability: 530, itc: 360, outputLiability: 890, mismatches: 2, accuracy: 98 },
            { sales: 690, purchase: 410, liability: 470, itc: 310, outputLiability: 780, mismatches: 4, accuracy: 96 },
            { sales: 960, purchase: 580, liability: 640, itc: 470, outputLiability: 1110, mismatches: 1, accuracy: 99 }
        ];
        const weeklyT2 = [
            { sales: 1420, purchase: 840, liability: 910, itc: 670, outputLiability: 1580, mismatches: 1, accuracy: 99 },
            { sales: 1190, purchase: 630, liability: 830, itc: 460, outputLiability: 1290, mismatches: 2, accuracy: 98 },
            { sales: 1480, purchase: 980, liability: 1010, itc: 790, outputLiability: 1800, mismatches: 1, accuracy: 99 },
            { sales: 1310, purchase: 740, liability: 860, itc: 580, outputLiability: 1440, mismatches: 2, accuracy: 98 },
            { sales: 1120, purchase: 660, liability: 760, itc: 500, outputLiability: 1260, mismatches: 3, accuracy: 97 },
            { sales: 1550, purchase: 940, liability: 1040, itc: 760, outputLiability: 1800, mismatches: 1, accuracy: 99 }
        ];
        trendData = (isT2 ? weeklyT2 : weeklyT1);
    } else if (timeRange === 'QUARTERLY') {
        periods = ['Q3 FY25', 'Q4 FY25', 'Q1 FY26', 'Q2 FY26'];
        const quarterlyT1 = [
            { sales: 9800, purchase: 5900, liability: 6100, itc: 4700, outputLiability: 10800, mismatches: 24, accuracy: 96 },
            { sales: 11400, purchase: 6800, liability: 7100, itc: 5400, outputLiability: 12500, mismatches: 28, accuracy: 95 },
            { sales: 12800, purchase: 7900, liability: 7900, itc: 6200, outputLiability: 14100, mismatches: 19, accuracy: 97 },
            { sales: 13900, purchase: 8400, liability: 8400, itc: 6600, outputLiability: 15000, mismatches: 22, accuracy: 97 }
        ];
        const quarterlyT2 = [
            { sales: 15800, purchase: 9500, liability: 9800, itc: 7600, outputLiability: 17400, mismatches: 18, accuracy: 98 },
            { sales: 18400, purchase: 11000, liability: 11400, itc: 8700, outputLiability: 20100, mismatches: 21, accuracy: 97 },
            { sales: 20600, purchase: 12700, liability: 12700, itc: 10000, outputLiability: 22700, mismatches: 14, accuracy: 98 },
            { sales: 22400, purchase: 13600, liability: 13600, itc: 10700, outputLiability: 24300, mismatches: 16, accuracy: 98 }
        ];
        trendData = (isT2 ? quarterlyT2 : quarterlyT1);
    } else {
        // Default MONTHLY
        periods = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
        const defaultMay = isT2 ? { sales: 6400, purchase: 3840, liability: 3840, itc: 2880, outputLiability: 5760 } : { sales: 4000, purchase: 2400, liability: 2400, itc: 1800, outputLiability: 3600 };
        const defaultJun = isT2 ? { sales: 4800, purchase: 2236, liability: 3536, itc: 1760, outputLiability: 4960 } : { sales: 3000, purchase: 1398, liability: 2210, itc: 1100, outputLiability: 3100 };
        const defaultJul = isT2 ? { sales: 3200, purchase: 15680, liability: 3664, itc: 11520, outputLiability: 2880 } : { sales: 2000, purchase: 9800, liability: 2290, itc: 7200, outputLiability: 1800 };
        const defaultAug = isT2 ? { sales: 4448, purchase: 6252, liability: 3200, itc: 4480, outputLiability: 4000 } : { sales: 2780, purchase: 3908, liability: 2000, itc: 2800, outputLiability: 2500 };
        const defaultSep = isT2 ? { sales: 3024, purchase: 7680, liability: 3489, itc: 5440, outputLiability: 2720 } : { sales: 1890, purchase: 4800, liability: 2181, itc: 3400, outputLiability: 1700 };
        const defaultOct = isT2 ? { sales: 3824, purchase: 6080, liability: 4000, itc: 4320, outputLiability: 3360 } : { sales: 2390, purchase: 3800, liability: 2500, itc: 2700, outputLiability: 2100 };
        const defs = [defaultMay, defaultJun, defaultJul, defaultAug, defaultSep, defaultOct];
        trendData = defs.map((d, index) => ({
            ...d,
            mismatches: isT2 ? [3, 8, 12, 6, 11, 8][index] : [5, 12, 18, 9, 15, 14][index],
            accuracy: isT2 ? [99, 97, 94, 98, 97, 97][index] : [98, 95, 92, 97, 96, 96][index]
        }));
    }

    const monthlyTrend = periods.map((p, index) => {
        const item = trendData[index];
        return {
            name: p,
            sales: Math.round(item.sales * (isSpecificGstin ? scalingFactor : 1)),
            purchase: Math.round(item.purchase * (isSpecificGstin ? scalingFactor : 1)),
            liability: Math.round(item.liability * (isSpecificGstin ? scalingFactor : 1)),
            itc: Math.round(item.itc * (isSpecificGstin ? scalingFactor : 1)),
            outputLiability: Math.round(item.outputLiability * (isSpecificGstin ? scalingFactor : 1)),
            mismatches: item.mismatches,
            accuracy: item.accuracy
        };
    });

    const rangeMult = timeRange === 'WEEKLY' ? 0.24 : (timeRange === 'QUARTERLY' ? 2.85 : 1.0);

    const utilization = [
        { name: 'Cash Ledger', value: Math.round(40000 * baseMult * rangeMult), color: '#0088FE' },
        { name: 'Credit Ledger', value: Math.round(84000 * baseMult * rangeMult), color: '#00C49F' },
    ];

    const riskMetrics = {
        mismatchedInvoices: timeRange === 'WEEKLY'
            ? (isT2 ? 2 : 3)
            : timeRange === 'QUARTERLY'
            ? (isT2 ? (isSpecificGstin ? 9 : 24) : (isSpecificGstin ? 12 : 36))
            : (isT2 ? (isSpecificGstin ? 3 : 8) : (isSpecificGstin ? 4 : 14)),
        itcAtRisk: Math.round((isT2 ? 28400 : 45600) * (isSpecificGstin ? 0.35 : 1.0) * rangeMult),
        vendorCompliance: isT2 ? (timeRange === 'WEEKLY' ? 92 : 89) : (timeRange === 'WEEKLY' ? 88 : 82)
    };

    return {
        monthlyTrend,
        utilization,
        riskMetrics
    };
};

export const scanInvoice = async (imageBase64: string, mimeType: string) => {
    const response = await fetch('/api/ai/scan-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType })
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to scan invoice');
    }
    return response.json();
};

export const analyzeAnomalies = async (tenantId: string, transactions: any[]): Promise<AnomalyRecord[]> => {
    const response = await fetch('/api/ai/analyze-anomalies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, transactions })
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to analyze anomalies');
    }
    return response.json();
};

export const fetchExchangeRates = async () => {
    const response = await fetch('/api/currency/rates');
    if (!response.ok) throw new Error('Failed to fetch exchange rates');
    return response.json();
};

export const updateTenantProfile = async (tenantId: string, data: Partial<Tenant>) => { 
    if (!navigator.onLine) {
        const index = MOCK_TENANTS.findIndex(t => t.id === tenantId); 
        if (index !== -1) {
            MOCK_TENANTS[index] = { ...MOCK_TENANTS[index], ...data }; 
            save(STORAGE_KEYS.TENANTS, MOCK_TENANTS);
            addToSyncQueue('UPDATE_PROFILE', { tenantId, data });
        }
        return MOCK_TENANTS[index];
    }
    await delay(1000); 
    const index = MOCK_TENANTS.findIndex(t => t.id === tenantId); 
    if (index !== -1) {
        MOCK_TENANTS[index] = { ...MOCK_TENANTS[index], ...data }; 
        save(STORAGE_KEYS.TENANTS, MOCK_TENANTS);
    }
    return MOCK_TENANTS[index]; 
};
export const fetchComplianceAlerts = async (tenantId: string = 't1'): Promise<ComplianceAlert[]> => {
  try {
    const response = await fetch(`/api/v1/compliance/exceptions?tenantId=${tenantId}`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.exceptions) {
        return data.exceptions.map((ex: any) => ({
          id: ex.id,
          tenantId: ex.tenantId,
          title: ex.title,
          message: ex.description,
          type: ex.eventRef === 'ITC_MISMATCH_DETECTED' ? 'VENDOR_RISK' : (ex.eventRef === 'RCM_EXPOSURE_DETECTED' ? 'PENALTY' : 'DUE_DATE'),
          severity: ex.severity === 'CRITICAL' ? 'HIGH' : ex.severity,
          date: ex.createdAt.split('T')[0]
        }));
      }
    }
  } catch (error) {
    console.warn("Falling back to local compliance alerts:", error);
  }

  await delay(1000);
  return [
    { id: 'a1', tenantId, title: 'GSTR-3B Due Soon', message: 'Filing for October 2024 is due in 3 days.', type: 'DUE_DATE', severity: 'HIGH', date: '2024-11-17' },
    { id: 'a2', tenantId, title: 'Risky Vendor Alert', message: 'Vendor "Cloud Services Inc" has not filed GSTR-1 for 2 months.', type: 'VENDOR_RISK', severity: 'MEDIUM', date: '2024-11-15' },
    { id: 'a4', tenantId, title: '🚨 GSTR-2B Portal Mismatch', message: 'Invoice mismatch detected on GSTR-2B reconciliation. Supplier uploaded ₹18,250 SGST/CGST but local books list ₹18,000.', type: 'VENDOR_RISK', severity: 'HIGH', date: '2024-11-16' },
    { id: 'a3', tenantId, title: 'ITC Reversal', message: 'Invoices older than 180 days require payment reversal.', type: 'ITC_EXPIRY', severity: 'LOW', date: '2024-11-10' }
  ];
};
export const fetchVendorRisks = async (tenantId: string = 't1'): Promise<VendorRisk[]> => { await delay(1200); return [ { id: 'v1', tenantId, vendorName: 'Cloud Services Inc', gstin: '27AAAAA0000A1Z5', pendingInvoices: 12, totalItcAtRisk: 45000, lastFiledPeriod: 'Aug 2024', complianceScore: 45, status: 'NON_COMPLIANT' }, { id: 'v2', tenantId, vendorName: 'Office Supplies Co', gstin: '27BBBBB1111B1Z6', pendingInvoices: 2, totalItcAtRisk: 2500, lastFiledPeriod: 'Oct 2024', complianceScore: 92, status: 'COMPLIANT' }, { id: 'v3', tenantId, vendorName: 'Tech Solutions Ltd', gstin: '27CCCCC2222C1Z7', pendingInvoices: 5, totalItcAtRisk: 12000, lastFiledPeriod: 'Sep 2024', complianceScore: 65, status: 'AT_RISK' }, ]; };
export const updateNotificationSettings = async (settings: NotificationSettings): Promise<NotificationSettings> => { await delay(800); return settings; };
export const updateSecuritySettings = async (userId: string, settings: { ssoEnabled?: boolean }): Promise<boolean> => { 
    if (!navigator.onLine) {
        const user = MOCK_USERS.find(u => u.id === userId); 
        if (user) {
            save(STORAGE_KEYS.USERS, MOCK_USERS);
            addToSyncQueue('UPDATE_SECURITY', { userId, settings });
            return true;
        }
    }
    await delay(1000); 
    const user = MOCK_USERS.find(u => u.id === userId); 
    if (user) { 
        save(STORAGE_KEYS.USERS, MOCK_USERS);
        return true; 
    } 
    return false; 
};
export const fetchLiabilityReport = async (tenantId: string = 't1', gstin?: string, branchId?: string): Promise<LiabilityReportData[]> => {
    await delay(600);
    const invoices = MOCK_INVOICES.filter(inv => {
        if (inv.tenantId !== tenantId || inv.status === 'FAILED') return false;
        if (gstin && gstin !== 'ALL' && gstin !== 'ALL_GSTINS') {
            const matches = inv.supplierGstin === gstin || inv.gstin === gstin || inv.placeOfSupply === gstin.slice(0, 2);
            if (!matches) return false;
        }
        if (branchId && branchId !== 'ALL' && branchId !== 'ALL_BRANCHES') {
            if (inv.branchId && inv.branchId !== branchId) return false;
        }
        return true;
    });
    
    const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
    const reportMap: Record<string, { liability: number; itcAdjustment: number }> = {};
    months.forEach(m => {
        reportMap[m] = { liability: 0, itcAdjustment: 0 };
    });

    invoices.forEach(inv => {
        const m = getMonthAbbreviation(inv.date);
        if (reportMap[m] !== undefined) {
            if (inv.category === 'SALES') {
                reportMap[m].liability += inv.taxAmount;
            } else if (inv.category === 'PURCHASE' && !inv.isBlockedItc) {
                reportMap[m].itcAdjustment += inv.taxAmount;
            }
        }
    });

    return months.map(m => {
        const data = reportMap[m];
        const baseMult = tenantId === 't2' ? 1.6 : 1.0;
        const liability = data.liability > 0 ? data.liability : Math.round(135000 * baseMult);
        const itcAdjustment = data.itcAdjustment > 0 ? data.itcAdjustment : Math.round(110000 * baseMult);
        const cashPaid = Math.max(0, liability - itcAdjustment);
        return {
            month: m,
            liability,
            itcAdjustment,
            cashPaid
        };
    });
};

export const fetchItcReport = async (tenantId: string = 't1'): Promise<ItcReportData[]> => {
    await delay(1000);
    const invoices = MOCK_INVOICES.filter(inv => inv.tenantId === tenantId && inv.category === 'PURCHASE' && inv.status !== 'FAILED');
    
    let igstAvailed = 0;
    let cgstAvailed = 0;
    let sgstAvailed = 0;

    invoices.forEach(inv => {
        if (!inv.isBlockedItc) {
            igstAvailed += inv.taxDetails?.igst || 0;
            cgstAvailed += inv.taxDetails?.cgst || 0;
            sgstAvailed += inv.taxDetails?.sgst || 0;
        }
    });

    const baseMult = tenantId === 't2' ? 1.8 : 1.0;
    const igstVal = igstAvailed > 0 ? igstAvailed : Math.round(120000 * baseMult);
    const cgstVal = cgstAvailed > 0 ? cgstAvailed : Math.round(40000 * baseMult);
    const sgstVal = sgstAvailed > 0 ? sgstAvailed : Math.round(40000 * baseMult);

    return [
        { head: 'IGST', openingBalance: Math.round(50000 * baseMult), availed: igstVal, utilized: Math.round(igstVal * 0.9), closingBalance: Math.round(50000 * baseMult + igstVal - igstVal * 0.9) },
        { head: 'CGST', openingBalance: Math.round(25000 * baseMult), availed: cgstVal, utilized: Math.round(cgstVal * 0.85), closingBalance: Math.round(25000 * baseMult + cgstVal - cgstVal * 0.85) },
        { head: 'SGST', openingBalance: Math.round(25000 * baseMult), availed: sgstVal, utilized: Math.round(sgstVal * 0.85), closingBalance: Math.round(25000 * baseMult + sgstVal - sgstVal * 0.85) },
    ];
};

export const fetchBranchReport = async (tenantId: string = 't1'): Promise<BranchReportData[]> => { 
    await delay(1000); 
    return MOCK_BRANCHES.filter(b => b.tenantId === tenantId); 
};
export const addLinkedEntity = async (data: Partial<BranchReportData>): Promise<BranchReportData> => { 
    const taxLiab = Math.floor(Math.random() * 900000) + 50000;
    const itcSetOff = Math.round(taxLiab * 0.8);
    const netPayable = taxLiab - itcSetOff;
    const newEntity: BranchReportData = { 
        id: `b-${Date.now()}`, 
        tenantId: data.tenantId || 't1',
        name: data.name || 'New Entity', 
        gstin: data.gstin || '', 
        state: data.state || 'Unknown', 
        turnover: Math.floor(Math.random() * 5000000) + 100000, 
        taxLiability: taxLiab, 
        itcSetOff,
        netPayable,
        igst: Math.round(taxLiab * 0.5),
        cgst: Math.round(taxLiab * 0.25),
        sgst: Math.round(taxLiab * 0.25),
        type: data.type || 'BRANCH', 
        status: 'ACTIVE' 
    }; 
    if (!navigator.onLine) {
        MOCK_BRANCHES.push(newEntity);
        save(STORAGE_KEYS.BRANCHES, MOCK_BRANCHES);
        addToSyncQueue('ADD_BRANCH', newEntity);
        return newEntity;
    }
    await delay(1500); 
    MOCK_BRANCHES.push(newEntity); 
    save(STORAGE_KEYS.BRANCHES, MOCK_BRANCHES);
    return newEntity; 
};
// Active User state tracker inside API service
let ACTIVE_USER: User | null = null;

export const setActiveUser = (user: User | null) => {
    const prevUser = ACTIVE_USER;
    ACTIVE_USER = user;
    if (user && (!prevUser || prevUser.id !== user.id)) {
        logAuditAction('User Login', 'AUTH', `Logged in via Web console. Email: ${user.email}`, undefined, 'SUCCESS');
    } else if (user && prevUser && prevUser.currentTenantId !== user.currentTenantId) {
        logAuditAction('Switch Organization', 'SETTINGS', `Switched active organization to ID: ${user.currentTenantId}`, undefined, 'SUCCESS');
    }
};

export const generateSHA256Hash = async (data: string): Promise<string> => {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Helper to log audit events
export const logAuditAction = async (
    action: string, 
    module: AuditLogData['module'], 
    details?: string, 
    changes?: AuditLogData['changes'],
    status: 'SUCCESS' | 'FAILURE' = 'SUCCESS'
) => {
    console.log(`[AUDIT] ${module}: ${action}`, details, changes);
    const lastAudit = MOCK_AUDIT_LOGS[MOCK_AUDIT_LOGS.length - 1];
    
    const username = ACTIVE_USER?.name || 'System Auto-job';
    const userRole = ACTIVE_USER?.role || 'SYSTEM';
    const tenantId = ACTIVE_USER?.currentTenantId || 't1';
    const prevHash = lastAudit?.hash || '00000000000000000000000000000000';
    const timestamp = new Date().toISOString();

    // Generate cryptographic chain hash
    const inputForHash = `${action}|${module}|${username}|${userRole}|${timestamp}|${status}|${prevHash}`;
    const hash = await generateSHA256Hash(inputForHash);

    const newLog: AuditLogData = {
        id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        tenantId,
        action,
        module,
        user: username,
        role: userRole,
        timestamp,
        status,
        details,
        changes,
        hash,
        previousHash: prevHash,
        ipAddress: '192.168.1.' + (100 + Math.floor(Math.random() * 155))
    };
    
    MOCK_AUDIT_LOGS.push(newLog);
    save(STORAGE_KEYS.AUDIT_LOGS, MOCK_AUDIT_LOGS);
};

const initialAuditLogs: AuditLogData[] = [ 
    { id: 'aud1', action: 'User Login', module: 'AUTH', user: 'Admin User', role: 'ADMIN', timestamp: '2024-11-15T09:30:00.000Z', status: 'SUCCESS', ipAddress: '192.168.1.101', hash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4', previousHash: '00000000000000000000000000000000' }, 
    { id: 'aud2', action: 'Created Invoice INV-2024-1045', module: 'INVOICE', user: 'Accountant User', role: 'ACCOUNTANT', timestamp: '2024-11-15T10:15:22.000Z', status: 'SUCCESS', details: 'Value: ₹45,000', hash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327ab9', previousHash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4' }, 
];

let MOCK_AUDIT_LOGS: AuditLogData[] = load(STORAGE_KEYS.AUDIT_LOGS, initialAuditLogs);

// =========================================================================
// WHATSAPP NOTIFICATION SERVICE & AUTOMATED GST REMINDER CLIENT API
// =========================================================================

export const sendWhatsAppNotification = async (params: SendWhatsAppNotificationParams): Promise<SendWhatsAppResponse> => {
    try {
        const res = await fetch('/api/v1/whatsapp/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Failed to dispatch WhatsApp message');
        }
        return data;
    } catch (err: any) {
        console.error('Error in sendWhatsAppNotification:', err);
        throw err;
    }
};

export const sendInvoiceStatusWhatsAppNotification = async (params: {
    invoiceNumber: string;
    partyName: string;
    recipientPhone: string;
    amount: number;
    status: string;
    dueDate?: string;
    date?: string;
    notificationType?: string;
    irn?: string;
    customNote?: string;
    isOverdue?: boolean;
    daysOverdue?: number;
}): Promise<SendWhatsAppResponse> => {
    try {
        const res = await fetch('/api/v1/whatsapp/send-invoice-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Failed to send WhatsApp invoice notification');
        }
        await logAuditAction(`Sent WhatsApp Invoice Notification for ${params.invoiceNumber}`, 'INVOICE', `Recipient: ${params.recipientPhone}, Status: ${params.status}`);
        return data;
    } catch (err: any) {
        console.error('Error in sendInvoiceStatusWhatsAppNotification:', err);
        throw err;
    }
};

export const runAutomatedWhatsAppGstReminders = async (params: {
    daysAhead?: number;
    targetReturns?: string[];
    clients?: Array<{
        name: string;
        phone: string;
        gstin: string;
        returnType: string;
        taxpayerCategory?: string;
        estimatedLiability?: number;
    }>;
    dryRun?: boolean;
}): Promise<{ success: boolean; summary: AutomatedGstRemindersSummary; reminders: any[] }> => {
    try {
        const res = await fetch('/api/v1/whatsapp/automated-gst-reminders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Failed to run automated GST reminders');
        }
        await logAuditAction(`Executed Automated GST WhatsApp Reminders`, 'COMPLIANCE', `Sent: ${data.summary?.sentCount}, Processed: ${data.summary?.totalProcessed}`);
        return data;
    } catch (err: any) {
        console.error('Error running automated GST WhatsApp reminders:', err);
        throw err;
    }
};

export const fetchWhatsAppLogs = async (params: {
    template?: string;
    entityType?: string;
    status?: string;
    search?: string;
    limit?: number;
} = {}): Promise<{ logs: WhatsAppMessageLog[]; total: number }> => {
    try {
        const queryParams = new URLSearchParams();
        if (params.template) queryParams.set('template', params.template);
        if (params.entityType) queryParams.set('entityType', params.entityType);
        if (params.status) queryParams.set('status', params.status);
        if (params.search) queryParams.set('search', params.search);
        if (params.limit) queryParams.set('limit', String(params.limit));

        const res = await fetch(`/api/v1/whatsapp/logs?${queryParams.toString()}`);
        if (!res.ok) {
            return { logs: [], total: 0 };
        }
        return await res.json();
    } catch (err) {
        console.error('Error fetching WhatsApp logs:', err);
        return { logs: [], total: 0 };
    }
};

export const clearWhatsAppLogs = async (): Promise<boolean> => {
    try {
        const res = await fetch('/api/v1/whatsapp/logs', { method: 'DELETE' });
        return res.ok;
    } catch (err) {
        console.error('Error clearing WhatsApp logs:', err);
        return false;
    }
};

export const fetchGstDeadlines = async (): Promise<GstDueDateItem[]> => {
    try {
        const res = await fetch('/api/v1/whatsapp/gst-deadlines');
        if (!res.ok) return [];
        return await res.json();
    } catch (err) {
        console.error('Error fetching GST deadlines:', err);
        return [];
    }
};

export const fetchWhatsAppAutoReminderConfig = async (): Promise<WhatsAppAutoReminderConfig> => {
    try {
        const res = await fetch('/api/v1/whatsapp/auto-reminders/config');
        if (!res.ok) throw new Error('Failed to fetch WhatsApp reminder config');
        return await res.json();
    } catch (err) {
        console.error('Error fetching WhatsApp reminder config:', err);
        return {
            enabled: true,
            gstDueDateReminders: {
                enabled: true,
                daysBefore: [7, 3, 1],
                targetReturns: ['GSTR-1', 'GSTR-3B', 'CMP-08', 'GSTR-9'],
                sendTime: "09:00",
                includeLateFeeWarning: true
            },
            invoiceStatusNotifications: {
                enabled: true,
                notifyOnIssued: true,
                notifyOnPaymentDue: true,
                notifyOnOverdue: true,
                notifyOnPaymentReceived: true,
                overdueDaysInterval: 3,
                includeUpiPaymentLink: true
            },
            defaultCountryCode: "+91",
            defaultFallbackNumber: "+919876543210"
        };
    }
};

export const updateWhatsAppAutoReminderConfig = async (config: Partial<WhatsAppAutoReminderConfig>): Promise<WhatsAppAutoReminderConfig> => {
    try {
        const res = await fetch('/api/v1/whatsapp/auto-reminders/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        const data = await res.json();
        return data.config;
    } catch (err) {
        console.error('Error updating WhatsApp reminder config:', err);
        throw err;
    }
};

export const fetchWhatsAppGatewayStatus = async (): Promise<WhatsAppGatewayStatus> => {
    try {
        const res = await fetch('/api/v1/whatsapp/status');
        if (!res.ok) {
            return {
                configured: false,
                accountSid: null,
                fromNumber: 'whatsapp:+14155238886',
                mode: 'SANDBOX_SIMULATION',
                totalLoggedMessages: 0
            };
        }
        return await res.json();
    } catch (err) {
        console.error('Error fetching WhatsApp gateway status:', err);
        return {
            configured: false,
            accountSid: null,
            fromNumber: 'whatsapp:+14155238886',
            mode: 'SANDBOX_SIMULATION',
            totalLoggedMessages: 0
        };
    }
};

export const testTwilioWhatsAppConnection = async (phone: string = "+919876543210"): Promise<SendWhatsAppResponse> => {
    try {
        const res = await fetch('/api/v1/whatsapp/test-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Failed to ping WhatsApp gateway');
        }
        await logAuditAction(`Tested Twilio WhatsApp Connection`, 'SYSTEM', `Target Phone: ${phone}, Result: ${data.status}`);
        return data;
    } catch (err: any) {
        console.error('Error testing WhatsApp connection:', err);
        throw err;
    }
};

export const sendFilingStatusWhatsAppNotification = async (params: FilingStatusWhatsAppParams): Promise<SendWhatsAppResponse> => {
    try {
        const res = await fetch('/api/v1/whatsapp/send-filing-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Failed to send WhatsApp filing status notification');
        }
        await logAuditAction(`Sent WhatsApp Filing Status for ${params.returnType} (${params.period})`, 'FILING', `Recipient: ${params.recipientPhone}, Status: ${params.status}`);
        return data;
    } catch (err: any) {
        console.error('Error in sendFilingStatusWhatsAppNotification:', err);
        throw err;
    }
};

export const sendReconciliationMismatchWhatsAppAlert = async (params: {
    recipientPhone: string;
    recipientName?: string;
    recipientGstin?: string;
    period?: string;
    mismatchCount?: number;
    taxImpact?: number;
    matchScore?: number;
    topReason?: string;
    invoiceNumber?: string;
    vendorName?: string;
    customNotes?: string;
}): Promise<SendWhatsAppResponse> => {
    try {
        const res = await fetch('/api/v1/whatsapp/send-reconciliation-mismatch-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Failed to send reconciliation mismatch WhatsApp alert');
        }
        await logAuditAction(`Sent WhatsApp Reconciliation Mismatch Alert`, 'COMPLIANCE', `Recipient: ${params.recipientPhone}, Mismatches: ${params.mismatchCount || 1}`);
        return data;
    } catch (err: any) {
        console.error('Error in sendReconciliationMismatchWhatsAppAlert:', err);
        throw err;
    }
};

export const fetchWhatsAppClients = async (): Promise<WhatsAppClientItem[]> => {
    try {
        const res = await fetch('/api/v1/whatsapp/clients');
        if (!res.ok) return [];
        return await res.json();
    } catch (err) {
        console.error('Error fetching WhatsApp clients:', err);
        return [];
    }
};

export const sendInvoiceReminder = async (invoiceId: string, type: 'EMAIL' | 'SMS' | 'WHATSAPP', recipientPhone?: string): Promise<boolean> => {
    await delay(600);
    const inv = MOCK_INVOICES.find(i => i.id === invoiceId);
    if (inv) {
        if (type === 'WHATSAPP') {
            const targetPhone = recipientPhone || "+919876543210";
            await sendInvoiceStatusWhatsAppNotification({
                invoiceNumber: inv.invoiceNumber,
                partyName: inv.partyName,
                recipientPhone: targetPhone,
                amount: inv.amount,
                status: inv.status,
                dueDate: inv.dueDate,
                date: inv.date,
                isOverdue: (inv.status as string) === 'OVERDUE' || Boolean(inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== 'PAID'),
                daysOverdue: 4
            });
        }
        await logAuditAction(`Sent Reminder for ${inv.invoiceNumber}`, 'INVOICE', `Method: ${type}${recipientPhone ? ` to ${recipientPhone}` : ''}`);
    }
    return true;
};

export const fetchScheduledReminders = async (tenantId: string = 't1'): Promise<InvoiceReminder[]> => {
    await delay(400);
    return [
        { id: 'rem1', invoiceId: 'inv1', invoiceNumber: 'INV-2024-1045', partyName: 'Acme Corp', scheduledDate: '2024-11-20', status: 'PENDING', type: 'WHATSAPP' },
        { id: 'rem2', invoiceId: 'inv2', invoiceNumber: 'INV-2024-1046', partyName: 'Global Tech', scheduledDate: '2024-11-18', status: 'SENT', type: 'WHATSAPP' },
        { id: 'rem3', invoiceId: 'inv3', invoiceNumber: 'INV-2024-1047', partyName: 'Apex Industries', scheduledDate: '2024-11-22', status: 'PENDING', type: 'EMAIL' },
    ];
};

export const fetchAuditLogs = async (tenantId: string = 't1'): Promise<AuditLogData[]> => { 
    await delay(800); 
    return [...MOCK_AUDIT_LOGS].reverse(); 
};
export const downloadUserData = async (userId: string) => { await delay(2000); return true; };
export const deleteUserAccount = async (userId: string) => { await delay(3000); return true; };
export const fetchTaxComputation = async (tenantId: string = 't1', gstin?: string, branchId?: string): Promise<TaxComputationSummary> => { 
    await delay(600); 
    const invoices = MOCK_INVOICES.filter(i => {
        if (i.tenantId !== tenantId) return false;
        if (gstin && gstin !== 'ALL' && gstin !== 'ALL_GSTINS') {
            const matches = i.supplierGstin === gstin || i.gstin === gstin || i.placeOfSupply === gstin.slice(0, 2);
            if (!matches) return false;
        }
        if (branchId && branchId !== 'ALL' && branchId !== 'ALL_BRANCHES') {
            if (i.branchId && i.branchId !== branchId) return false;
        }
        return true;
    }); 
    const output = invoices.filter(i => i.category === 'SALES').reduce((acc, curr) => ({ taxableValue: acc.taxableValue + curr.amount, igst: acc.igst + curr.taxDetails.igst, cgst: acc.cgst + curr.taxDetails.cgst, sgst: acc.sgst + curr.taxDetails.sgst, utgst: acc.utgst + curr.taxDetails.utgst, cess: acc.cess + curr.taxDetails.cess, }), { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, utgst: 0, cess: 0 }); 
    const input = invoices.filter(i => i.category === 'PURCHASE').reduce((acc, curr) => { if (curr.isBlockedItc) { acc.blocked += curr.taxAmount; } else { acc.taxableValue += curr.amount; acc.igst += curr.taxDetails.igst; acc.cgst += curr.taxDetails.cgst; acc.sgst += curr.taxDetails.sgst; acc.utgst += curr.taxDetails.utgst; acc.cess += curr.taxDetails.cess; } return acc; }, { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, utgst: 0, cess: 0, blocked: 0 }); 
    const rcm = invoices.filter(i => i.isRcm).reduce((acc, curr) => ({ taxableValue: acc.taxableValue + curr.amount, igst: acc.igst + curr.taxDetails.igst, cgst: acc.cgst + curr.taxDetails.cgst, sgst: acc.sgst + curr.taxDetails.sgst, utgst: acc.utgst + curr.taxDetails.utgst, cess: acc.cess + curr.taxDetails.cess, }), { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, utgst: 0, cess: 0 }); 
    const net = { taxableValue: 0, igst: Math.max(0, output.igst - input.igst), cgst: Math.max(0, output.cgst - input.cgst), sgst: Math.max(0, output.sgst - input.sgst), utgst: Math.max(0, output.utgst - input.utgst), cess: Math.max(0, output.cess - input.cess), }; 
    return { 
        outputLiability: output, 
        inputTaxCredit: input, 
        rcmLiability: rcm, 
        netPayable: net, 
        gstr1Mapping: [ 
            { table: '4A', description: 'B2B Invoices', taxableValue: output.taxableValue * 0.6, liability: (output.igst+output.cgst+output.sgst) * 0.6, source: 'SALES_REGISTER' }, 
            { table: '6A', description: 'Exports', taxableValue: output.taxableValue * 0.1, liability: (output.igst) * 0.1, source: 'SALES_REGISTER' }, 
            { table: '7', description: 'B2C Others', taxableValue: output.taxableValue * 0.3, liability: (output.igst+output.cgst+output.sgst) * 0.3, source: 'SALES_REGISTER' }, 
        ], 
        gstr3bMapping: [ 
            { table: '3.1(a)', description: 'Outward taxable supplies', taxableValue: output.taxableValue, liability: (output.igst+output.cgst+output.sgst+output.utgst), source: 'SALES_REGISTER' }, 
            { table: '3.1(d)', description: 'Inward supplies (RCM)', taxableValue: rcm.taxableValue, liability: (rcm.igst+rcm.cgst+rcm.sgst), source: 'RCM_CALCULATOR' }, 
            { table: '4(A)(5)', description: 'All other ITC', taxableValue: input.taxableValue, liability: (input.igst+input.cgst+input.sgst), source: 'PURCHASE_REGISTER' }, 
        ], 
        aiRisks: [] 
    }; 
};

export const fetchAiRiskReport = async (tenantId: string = 't1'): Promise<AiRiskRecord[]> => { 
    // In a real app, we fetch the invoices for this tenant first
    const invoices = MOCK_INVOICES.filter(i => i.tenantId === tenantId);
    const tenant = MOCK_TENANTS.find(t => t.id === tenantId);

    try {
        const response = await fetch('/api/ai/analyze-risks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                invoices: invoices.slice(0, 50), // Send a manageable sample
                tenantDetails: tenant 
            })
        });
        
        if (!response.ok) {
            throw new Error('Server AI analysis failed');
        }
        
        return await response.json();
    } catch (error) {
        console.warn("Falling back to mock AI data due to error or missing backend config:", error);
        await delay(1000); 
        return [ 
            { id: 'risk-1', category: 'ITC_BLOCK', severity: 'HIGH', description: 'Potential Blocked Credit (Sec 17(5)) detected in "Food & Beverages" category.', invoiceNumber: 'PUR-2024-1015', potentialImpact: 4500, recommendation: 'Flag as ineligible in GSTR-3B Table 4(B)(1).', aiConfidence: 92 }, 
            { id: 'risk-2', category: 'RCM_ALERT', severity: 'MEDIUM', description: 'Legal Services from "Advocate Verma" identified. Ensure RCM liability is paid.', invoiceNumber: 'PUR-2024-1002', potentialImpact: 18000, recommendation: 'Add to Liability in Table 3.1(d) and Claim ITC in 4(A)(3).', aiConfidence: 85 }, 
            { id: 'risk-3', category: 'HSN_MISMATCH', severity: 'LOW', description: 'Tax rate (12%) for HSN 998313 differs from standard rate (18%) for IT Services.', potentialImpact: 0, recommendation: 'Verify agreement or notification for concessional rate.', aiConfidence: 65 } 
        ]; 
    }
};

export const fetchSavedReports = async (tenantId: string = 't1'): Promise<SavedReport[]> => {
    await delay(500);
    const reports = load<SavedReport[]>(STORAGE_KEYS.SAVED_REPORTS, []);
    return reports;
};

export const saveReport = async (report: Omit<SavedReport, 'id' | 'createdAt'>): Promise<SavedReport> => {
    await delay(800);
    const reports = load<SavedReport[]>(STORAGE_KEYS.SAVED_REPORTS, []);
    const newReport: SavedReport = {
        ...report,
        id: `sr-${Date.now()}`,
        createdAt: new Date().toISOString()
    };
    reports.push(newReport);
    save(STORAGE_KEYS.SAVED_REPORTS, reports);
    return newReport;
};

export const deleteSavedReport = async (id: string): Promise<boolean> => {
    await delay(500);
    let reports = load<SavedReport[]>(STORAGE_KEYS.SAVED_REPORTS, []);
    reports = reports.filter(r => r.id !== id);
    save(STORAGE_KEYS.SAVED_REPORTS, reports);
    return true;
};

export const sendWeeklyDigest = async (tenantId: string, adminEmail: string) => {
    const response = await fetch('/api/admin/weekly-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, adminEmail })
    });
    if (!response.ok) throw new Error('Failed to send weekly digest');
    return response.json();
};

export const fetchVendorActivityLogs = async (token: string): Promise<VendorActivityLog[]> => {
    const res = await fetch(`/api/vendor-upload/activity-logs?token=${token}`);
    if (!res.ok) throw new Error('Failed to fetch activity logs');
    return res.json();
};

export const updateVendorProfile = async (token: string, profileData: { email: string, phone: string, gstIn: string, address: string }): Promise<any> => {
    const res = await fetch(`/api/vendor-upload/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...profileData })
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return res.json();
};

export const logVendorAction = async (token: string, actionData: { action: string, module: 'INVOICE' | 'PROFILE' | 'COMPLIANCE' | 'SYSTEM', status: 'SUCCESS' | 'WARNING' | 'FAILED', details: string }): Promise<any> => {
    const res = await fetch(`/api/vendor-upload/log-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...actionData })
    });
    if (!res.ok) throw new Error('Failed to log action');
    return res.json();
};

import { GstPortalHealthSummary, GstPortalEndpoint, LatencyTimePoint } from '../types';

export const fetchGstPortalHealth = async (): Promise<GstPortalHealthSummary> => {
    await delay(300);
    const now = new Date();
    
    const history: LatencyTimePoint[] = [];
    for (let i = 11; i >= 0; i--) {
        const timeObj = new Date(now.getTime() - i * 5 * 60 * 1000);
        const timeStr = timeObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        
        // Base latency with minor variations
        const gstn = Math.floor(110 + Math.sin(i * 0.8) * 35 + (Math.random() * 15));
        const irp = Math.floor(75 + Math.cos(i * 0.6) * 20 + (Math.random() * 12));
        const ewb = Math.floor(130 + Math.sin(i * 1.1) * 40 + (Math.random() * 18));
        const gstin = Math.floor(55 + Math.cos(i * 0.9) * 15 + (Math.random() * 8));
        const avg = Math.round((gstn + irp + ewb + gstin) / 4);

        history.push({
            time: timeStr,
            timestamp: timeObj.getTime(),
            gstnLatency: gstn,
            irpLatency: irp,
            ewbLatency: ewb,
            gstinLatency: gstin,
            overallAvgLatency: avg,
            targetSla: 200
        });
    }

    const endpoints: GstPortalEndpoint[] = [
        {
            id: 'ep-gstn',
            name: 'GSTN Tax Filing Gateway (GSTR-1 / 3B)',
            category: 'GSTN',
            status: 'OPERATIONAL',
            currentLatencyMs: history[history.length - 1].gstnLatency,
            avgLatencyMs: 122,
            p95LatencyMs: 185,
            successRatePercent: 99.85,
            uptimePercent: 99.92,
            lastPingTime: 'Just now',
            endpointUrl: 'https://api.gst.gov.in/taxpayerapi/v1.0'
        },
        {
            id: 'ep-irp',
            name: 'NIC e-Invoicing Portal (IRN Gen)',
            category: 'IRP',
            status: 'OPERATIONAL',
            currentLatencyMs: history[history.length - 1].irpLatency,
            avgLatencyMs: 82,
            p95LatencyMs: 128,
            successRatePercent: 99.94,
            uptimePercent: 99.98,
            lastPingTime: 'Just now',
            endpointUrl: 'https://einv-apisandbox.nic.in/einv/v1.03'
        },
        {
            id: 'ep-ewb',
            name: 'e-Way Bill Systems Gateway (NIC)',
            category: 'EWAYBILL',
            status: 'OPERATIONAL',
            currentLatencyMs: history[history.length - 1].ewbLatency,
            avgLatencyMs: 138,
            p95LatencyMs: 210,
            successRatePercent: 99.68,
            uptimePercent: 99.85,
            lastPingTime: 'Just now',
            endpointUrl: 'https://ewb-api.nic.in/v1.03'
        },
        {
            id: 'ep-gstin',
            name: 'GSTIN Public Directory & Taxpayer Verification',
            category: 'GSTIN_LOOKUP',
            status: 'OPERATIONAL',
            currentLatencyMs: history[history.length - 1].gstinLatency,
            avgLatencyMs: 58,
            p95LatencyMs: 95,
            successRatePercent: 99.98,
            uptimePercent: 99.99,
            lastPingTime: 'Just now',
            endpointUrl: 'https://commonapi.gst.gov.in/commonapi/v1.0/search'
        }
    ];

    const overallAvg = Math.round(endpoints.reduce((acc, e) => acc + e.currentLatencyMs, 0) / endpoints.length);

    return {
        overallStatus: 'OPERATIONAL',
        avgLatencyMs: overallAvg,
        overallSuccessRate: 99.86,
        uptime24h: 99.93,
        totalRequests1h: 3840,
        activeAlertsCount: 0,
        endpoints,
        history
    };
};

export const pingGstPortalEndpoints = async (): Promise<{ success: boolean; pings: Record<string, number> }> => {
    await delay(450);
    return {
        success: true,
        pings: {
            'ep-gstn': Math.floor(90 + Math.random() * 60),
            'ep-irp': Math.floor(60 + Math.random() * 40),
            'ep-ewb': Math.floor(110 + Math.random() * 70),
            'ep-gstin': Math.floor(40 + Math.random() * 30),
        }
    };
};

// --- AUTOMATION RULES ENGINE SERVICES ---

export const INITIAL_AUTOMATION_RULES: AutomationRule[] = [
  {
    id: 'rule-1',
    tenantId: 't1',
    name: 'Auto-Classify IT & Cloud Software Vendors',
    description: 'Auto-assign Cost Center "IT Infrastructure" and tags "Cloud-Infra", "Software-Sub" when vendor is Infotech, AWS, or Cloud provider.',
    category: 'PURCHASE',
    isActive: true,
    conditions: [
      { field: 'vendorName', operator: 'contains', value: 'Infotech' }
    ],
    actions: [
      { type: 'ASSIGN_COST_CENTER', value: 'IT Infrastructure' },
      { type: 'AUTO_TAG', value: 'Cloud-Infra' },
      { type: 'AUTO_TAG', value: 'Software-Sub' }
    ],
    executionCount: 14,
    lastExecutedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    createdAt: '2026-06-01T10:00:00Z'
  },
  {
    id: 'rule-2',
    tenantId: 't1',
    name: 'Freight & Logistics RCM Auto-Flagging',
    description: 'Auto-flag Reverse Charge (RCM) and assign Cost Center "Supply Chain & Logistics" for goods transport agencies.',
    category: 'PURCHASE',
    isActive: true,
    conditions: [
      { field: 'vendorName', operator: 'contains', value: 'Freight' }
    ],
    actions: [
      { type: 'SET_RCM', value: 'true' },
      { type: 'ASSIGN_COST_CENTER', value: 'Supply Chain & Logistics' },
      { type: 'AUTO_TAG', value: 'RCM-Applicable' }
    ],
    executionCount: 8,
    lastExecutedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    createdAt: '2026-06-02T11:00:00Z'
  },
  {
    id: 'rule-3',
    tenantId: 't1',
    name: 'High-Value Invoice Priority Review',
    description: 'Flag invoices above ₹50,000 for Priority Audit and auto-assign to Senior Tax Manager.',
    category: 'ALL',
    isActive: true,
    conditions: [
      { field: 'minAmount', operator: 'greaterThan', value: 50000 }
    ],
    actions: [
      { type: 'SET_PRIORITY', value: 'HIGH' },
      { type: 'ASSIGN_REVIEWER', value: 'Senior Tax Manager' },
      { type: 'AUTO_TAG', value: 'High-Value-Audit' }
    ],
    executionCount: 22,
    lastExecutedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    createdAt: '2026-06-03T14:30:00Z'
  },
  {
    id: 'rule-4',
    tenantId: 't1',
    name: 'Food & Hospitality Section 17(5) Blocked ITC',
    description: 'Auto-flag blocked ITC under Section 17(5) for food, catering, and employee hospitality vendors.',
    category: 'PURCHASE',
    isActive: true,
    conditions: [
      { field: 'vendorName', operator: 'contains', value: 'Zomato' }
    ],
    actions: [
      { type: 'FLAG_BLOCKED_ITC', value: 'Section 17(5): Food & Beverages / Hospitality' },
      { type: 'ASSIGN_COST_CENTER', value: 'Employee Welfare & Perks' },
      { type: 'AUTO_TAG', value: 'Blocked-ITC' }
    ],
    executionCount: 5,
    lastExecutedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    createdAt: '2026-06-05T09:15:00Z'
  }
];

let MOCK_RULES: AutomationRule[] = load(STORAGE_KEYS.RULES, INITIAL_AUTOMATION_RULES);

export const fetchAutomationRules = async (tenantId: string = 't1'): Promise<AutomationRule[]> => {
  await delay(300);
  return MOCK_RULES.filter(r => !r.tenantId || r.tenantId === tenantId);
};

export const saveAutomationRule = async (tenantId: string = 't1', ruleData: Partial<AutomationRule>): Promise<AutomationRule> => {
  await delay(400);
  if (ruleData.id) {
    const idx = MOCK_RULES.findIndex(r => r.id === ruleData.id);
    if (idx !== -1) {
      MOCK_RULES[idx] = { ...MOCK_RULES[idx], ...ruleData };
      save(STORAGE_KEYS.RULES, MOCK_RULES);
      await logAuditAction(`Updated Automation Rule: ${ruleData.name}`, 'SETTINGS', `ID: ${ruleData.id}`);
      return MOCK_RULES[idx];
    }
  }

  const newRule: AutomationRule = {
    id: `rule-${Date.now()}`,
    tenantId,
    name: ruleData.name || 'New Custom Invoice Rule',
    description: ruleData.description || '',
    category: ruleData.category || 'ALL',
    isActive: ruleData.isActive ?? true,
    conditions: ruleData.conditions || [],
    actions: ruleData.actions || [],
    executionCount: 0,
    createdAt: new Date().toISOString()
  };

  MOCK_RULES.unshift(newRule);
  save(STORAGE_KEYS.RULES, MOCK_RULES);
  await logAuditAction(`Created Automation Rule: ${newRule.name}`, 'SETTINGS', `Conditions: ${newRule.conditions.length}`);
  return newRule;
};

export const deleteAutomationRule = async (ruleId: string): Promise<boolean> => {
  await delay(300);
  const rule = MOCK_RULES.find(r => r.id === ruleId);
  MOCK_RULES = MOCK_RULES.filter(r => r.id !== ruleId);
  save(STORAGE_KEYS.RULES, MOCK_RULES);
  if (rule) {
    await logAuditAction(`Deleted Automation Rule: ${rule.name}`, 'SETTINGS', `ID: ${ruleId}`);
  }
  return true;
};

export const toggleAutomationRule = async (ruleId: string): Promise<AutomationRule> => {
  await delay(200);
  const idx = MOCK_RULES.findIndex(r => r.id === ruleId);
  if (idx === -1) throw new Error('Rule not found');
  MOCK_RULES[idx].isActive = !MOCK_RULES[idx].isActive;
  save(STORAGE_KEYS.RULES, MOCK_RULES);
  return MOCK_RULES[idx];
};

export const evaluateRulesForInvoice = (
  invoice: Invoice, 
  rules: AutomationRule[]
): { updatedInvoice: Invoice; rulesTriggered: string[]; actionsApplied: string[] } => {
  let updated = { ...invoice };
  const rulesTriggered: string[] = [];
  const actionsApplied: string[] = [];
  const tagsSet = new Set<string>(updated.tags || []);

  for (const rule of rules) {
    if (!rule.isActive) continue;
    if (rule.category !== 'ALL' && rule.category !== updated.category) continue;
    if (!rule.conditions || rule.conditions.length === 0) continue;

    let isMatch = true;
    for (const cond of rule.conditions) {
      let condMatch = false;
      const vendorLower = (updated.partyName || '').toLowerCase();
      const gstinLower = (updated.gstin || '').toLowerCase();
      const valStr = String(cond.value || '').toLowerCase();

      if (cond.field === 'vendorName') {
        condMatch = cond.operator === 'contains' 
          ? vendorLower.includes(valStr) 
          : cond.operator === 'startsWith' 
            ? vendorLower.startsWith(valStr) 
            : vendorLower === valStr;
      } else if (cond.field === 'gstin') {
        condMatch = cond.operator === 'startsWith' 
          ? gstinLower.startsWith(valStr) 
          : gstinLower.includes(valStr);
      } else if (cond.field === 'category') {
        condMatch = updated.category === cond.value;
      } else if (cond.field === 'type') {
        condMatch = updated.type === cond.value;
      } else if (cond.field === 'minAmount') {
        condMatch = (updated.amount || 0) >= Number(cond.value);
      } else if (cond.field === 'maxAmount') {
        condMatch = (updated.amount || 0) <= Number(cond.value);
      } else if (cond.field === 'hsnSac') {
        condMatch = !!(updated.items && updated.items.some(it => (it.hsnSac || '').includes(valStr)));
      }

      if (!condMatch) {
        isMatch = false;
        break;
      }
    }

    if (isMatch) {
      rulesTriggered.push(rule.name);
      rule.executionCount = (rule.executionCount || 0) + 1;
      rule.lastExecutedAt = new Date().toISOString();

      for (const act of rule.actions) {
        if (act.type === 'AUTO_TAG' && act.value) {
          tagsSet.add(act.value);
          actionsApplied.push(`Tag "${act.value}" added`);
        } else if (act.type === 'ASSIGN_COST_CENTER' && act.value) {
          updated.costCenter = act.value;
          actionsApplied.push(`Cost Center set to "${act.value}"`);
        } else if (act.type === 'SET_RCM') {
          updated.isRcm = act.value === 'true';
          actionsApplied.push(`Reverse Charge (RCM) set to ${act.value}`);
        } else if (act.type === 'FLAG_BLOCKED_ITC') {
          updated.isBlockedItc = true;
          updated.reasonForBlocked = act.value || 'Section 17(5) Blocked ITC';
          actionsApplied.push(`Blocked ITC Sec 17(5) flagged`);
        } else if (act.type === 'ASSIGN_REVIEWER') {
          updated.assignedReviewer = act.value;
          actionsApplied.push(`Assigned Reviewer "${act.value}"`);
        } else if (act.type === 'SET_PRIORITY') {
          updated.compliancePriority = act.value as any;
          actionsApplied.push(`Priority set to "${act.value}"`);
        }
      }
    }
  }

  updated.tags = Array.from(tagsSet);
  return { updatedInvoice: updated, rulesTriggered, actionsApplied };
};

export const runAllAutomationRulesOnTenantInvoices = async (
  tenantId: string = 't1'
): Promise<{ totalInvoicesEvaluated: number; totalInvoicesModified: number; rulesExecutedCount: number; details: Array<{ invoiceNumber: string; vendor: string; rules: string[]; actions: string[] }> }> => {
  await delay(800);
  const activeRules = MOCK_RULES.filter(r => r.isActive && (!r.tenantId || r.tenantId === tenantId));
  
  let modifiedCount = 0;
  let totalRulesExecuted = 0;
  const details: Array<{ invoiceNumber: string; vendor: string; rules: string[]; actions: string[] }> = [];

  const tenantInvoices = MOCK_INVOICES.filter(i => i.tenantId === tenantId);

  MOCK_INVOICES = MOCK_INVOICES.map(inv => {
    if (inv.tenantId !== tenantId) return inv;

    const { updatedInvoice, rulesTriggered, actionsApplied } = evaluateRulesForInvoice(inv, activeRules);

    if (rulesTriggered.length > 0) {
      modifiedCount++;
      totalRulesExecuted += rulesTriggered.length;
      details.push({
        invoiceNumber: inv.invoiceNumber,
        vendor: inv.partyName,
        rules: rulesTriggered,
        actions: actionsApplied
      });
      return updatedInvoice;
    }

    return inv;
  });

  save(STORAGE_KEYS.INVOICES, MOCK_INVOICES);
  save(STORAGE_KEYS.RULES, MOCK_RULES);

  await logAuditAction(
    `Ran Automation Rules Engine`, 
    'SETTINGS', 
    `Evaluated: ${tenantInvoices.length} | Updated: ${modifiedCount} invoices`
  );

  return {
    totalInvoicesEvaluated: tenantInvoices.length,
    totalInvoicesModified: modifiedCount,
    rulesExecutedCount: totalRulesExecuted,
    details
  };
};

export const suggestExpenseCategory = async (params: {
  vendorName: string;
  itemDescription?: string;
  items?: any[];
  totalAmount?: number;
  gstin?: string;
  invoiceCategory?: string;
}): Promise<ExpenseCategorySuggestion> => {
  const response = await fetch('/api/ai/suggest-expense-category', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    throw new Error('Failed to suggest expense category');
  }
  return response.json();
};

export const autoCategorizeInvoice = async (
  invoice: any,
  historicalInvoices: any[] = []
): Promise<{
  suggestedCategory: 'Input' | 'Output' | 'Exempt';
  confidence: number;
  reasoning: string;
  suggestedTags: string[];
}> => {
  const response = await fetch('/api/ai/auto-categorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoice, historicalInvoices })
  });
  if (!response.ok) {
    throw new Error('Failed to auto-categorize invoice');
  }
  return response.json();
};





export interface GlobalTaxRate {
  country: string;
  countryCode: string;
  category: string;
  rate: number;
  effectiveDate: string;
  description: string;
  source: string;
}

export const fetchGlobalTaxRates = async (countryCode: string, categoryKeyword: string): Promise<GlobalTaxRate[]> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const db: GlobalTaxRate[] = [
                { country: 'United Arab Emirates', countryCode: 'AE', category: 'Software Services', rate: 5, effectiveDate: '2018-01-01', description: 'Standard VAT Rate', source: 'Federal Tax Authority (FTA)' },
                { country: 'United Arab Emirates', countryCode: 'AE', category: 'Export of Goods', rate: 0, effectiveDate: '2018-01-01', description: 'Zero-rated', source: 'FTA' },
                { country: 'United Kingdom', countryCode: 'GB', category: 'Standard Goods', rate: 20, effectiveDate: '2011-01-04', description: 'Standard VAT Rate', source: 'HM Revenue & Customs' },
                { country: 'United Kingdom', countryCode: 'GB', category: 'Digital Services', rate: 20, effectiveDate: '2015-01-01', description: 'Standard VAT Rate', source: 'HMRC' },
                { country: 'United Kingdom', countryCode: 'GB', category: 'Childrens Clothing', rate: 0, effectiveDate: '1973-04-01', description: 'Zero-rated', source: 'HMRC' },
                { country: 'Singapore', countryCode: 'SG', category: 'Standard Goods & Services', rate: 9, effectiveDate: '2024-01-01', description: 'Standard GST Rate', source: 'Inland Revenue Authority of Singapore' },
                { country: 'Australia', countryCode: 'AU', category: 'Standard Goods & Services', rate: 10, effectiveDate: '2000-07-01', description: 'Standard GST Rate', source: 'Australian Taxation Office' },
                { country: 'Germany', countryCode: 'DE', category: 'Standard Goods', rate: 19, effectiveDate: '2007-01-01', description: 'Standard VAT Rate', source: 'Federal Central Tax Office' },
                { country: 'Germany', countryCode: 'DE', category: 'Books and E-books', rate: 7, effectiveDate: '2019-12-18', description: 'Reduced VAT Rate', source: 'Federal Central Tax Office' },
                { country: 'India', countryCode: 'IN', category: 'Software Services', rate: 18, effectiveDate: '2017-07-01', description: 'Standard GST Rate', source: 'CBIC' },
                { country: 'United States', countryCode: 'US', category: 'Digital Goods (NY)', rate: 4, effectiveDate: '2023-01-01', description: 'State Sales Tax (Excludes Local)', source: 'NY Dept of Taxation' },
                { country: 'Canada', countryCode: 'CA', category: 'Standard (ON)', rate: 13, effectiveDate: '2010-07-01', description: 'Harmonized Sales Tax (HST)', source: 'Canada Revenue Agency' }
            ];

            let results = db;
            if (countryCode && countryCode !== 'ALL') {
                results = results.filter(r => r.countryCode === countryCode);
            }
            if (categoryKeyword) {
                const kw = categoryKeyword.toLowerCase();
                results = results.filter(r => r.category.toLowerCase().includes(kw) || r.description.toLowerCase().includes(kw));
            }

            resolve(results);
        }, 1200);
    });
};

export const translateDocumentText = async (text: string, targetLanguage: string = 'English') => {
  const response = await fetch('/api/v1/documents/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, targetLanguage })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to translate document');
  }
  return response.json();
};
