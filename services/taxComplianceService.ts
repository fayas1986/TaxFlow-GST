import { 
  TaxProfile, 
  TaxpayerClassification, 
  TurnoverBracket, 
  StateCategory, 
  TaxComplianceAlert, 
  TaxComplianceSummary,
  ComplianceAlertStatus,
  AlertSeverity
} from '../types/taxCompliance';
import { FilingRecord } from '../types';
import { safeStorage, safeDispatchEvent } from '../utils/safeStorage';

// Category 1 States and UTs (QRMP GSTR-3B Due Date is 22nd)
export const CATEGORY_1_STATE_CODES = new Set([
  '22', // Chhattisgarh
  '23', // Madhya Pradesh
  '24', // Gujarat
  '26', // Dadra and Nagar Haveli & Daman and Diu
  '27', // Maharashtra
  '29', // Karnataka
  '30', // Goa
  '31', // Lakshadweep
  '32', // Kerala
  '33', // Tamil Nadu
  '34', // Puducherry
  '35', // Andaman and Nicobar Islands
  '36', // Telangana
  '37'  // Andhra Pradesh
]);

export const STATE_NAMES_BY_CODE: Record<string, string> = {
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
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh'
};

export const getStateCategory = (stateCode: string): StateCategory => {
  const codeClean = (stateCode || '27').trim().padStart(2, '0');
  return CATEGORY_1_STATE_CODES.has(codeClean) ? 'CATEGORY_1' : 'CATEGORY_2';
};

const STORAGE_KEY_PREFIX = 'TF_TAX_PROFILE_';
const STORAGE_ALERT_STATE_KEY = 'TF_TAX_ALERT_STATE_';

export const DEFAULT_PROFILES_BY_TENANT: Record<string, Partial<TaxProfile>> = {
  t1: { // Acme Corp - Large Enterprise Tech
    taxpayerType: 'REGULAR_MONTHLY',
    filingFrequency: 'MONTHLY',
    turnoverBracket: 'ABOVE_50CR',
    annualTurnoverEstimate: 284000000,
    stateCode: '27',
    stateName: 'Maharashtra',
    stateCategory: 'CATEGORY_1',
    isEInvoicingApplicable: true,
    isRcmApplicable: true,
    isSez: false,
    alertLeadDays: 7,
    enableUrgentSmsAlerts: true,
    enableEmailReminders: true,
    enableWhatsAppReminders: true,
    enableBrowserPush: true,
    customNotes: 'Conglomerate Headquarters. Strict monthly GSTR-1 (11th) and GSTR-3B (20th) enforcement with E-Invoicing.'
  },
  t2: { // Globex Inc - Manufacturing in Chandigarh (Cat 2)
    taxpayerType: 'REGULAR_MONTHLY',
    filingFrequency: 'MONTHLY',
    turnoverBracket: 'ABOVE_50CR',
    annualTurnoverEstimate: 182000000,
    stateCode: '04',
    stateName: 'Chandigarh',
    stateCategory: 'CATEGORY_2',
    isEInvoicingApplicable: true,
    isRcmApplicable: true,
    isSez: false,
    alertLeadDays: 7,
    enableUrgentSmsAlerts: true,
    enableEmailReminders: true,
    enableWhatsAppReminders: true,
    enableBrowserPush: true,
  },
  t3: { // Acme Logistics & Cold Chain
    taxpayerType: 'REGULAR_MONTHLY',
    filingFrequency: 'MONTHLY',
    turnoverBracket: 'ABOVE_50CR',
    annualTurnoverEstimate: 122000000,
    stateCode: '29',
    stateName: 'Karnataka',
    stateCategory: 'CATEGORY_1',
    isEInvoicingApplicable: true,
    isRcmApplicable: true,
    isSez: false,
    alertLeadDays: 7,
    enableUrgentSmsAlerts: true,
    enableEmailReminders: true,
    enableWhatsAppReminders: true,
    enableBrowserPush: true,
  },
  t4: { // Acme Retail & Commerce - Needs attention
    taxpayerType: 'REGULAR_MONTHLY',
    filingFrequency: 'MONTHLY',
    turnoverBracket: 'ABOVE_50CR',
    annualTurnoverEstimate: 142000000,
    stateCode: '07',
    stateName: 'Delhi',
    stateCategory: 'CATEGORY_2',
    isEInvoicingApplicable: true,
    isRcmApplicable: true,
    isSez: false,
    alertLeadDays: 5,
    enableUrgentSmsAlerts: true,
    enableEmailReminders: true,
    enableWhatsAppReminders: true,
    enableBrowserPush: true,
  },
  t5: { // CleanTech SEZ Unit
    taxpayerType: 'SEZ_UNIT',
    filingFrequency: 'MONTHLY',
    turnoverBracket: 'ABOVE_50CR',
    annualTurnoverEstimate: 91000000,
    stateCode: '24',
    stateName: 'Gujarat',
    stateCategory: 'CATEGORY_1',
    isEInvoicingApplicable: true,
    isRcmApplicable: false,
    isSez: true,
    alertLeadDays: 7,
    enableUrgentSmsAlerts: true,
    enableEmailReminders: true,
    enableWhatsAppReminders: true,
    enableBrowserPush: true,
  }
};

/**
 * Get active tax profile for a tenant from localStorage or fallback
 */
export const getTaxProfile = (tenantId: string, fallbackStateCode: string = '27', fallbackName?: string): TaxProfile => {
  try {
    const raw = safeStorage.getItem(`${STORAGE_KEY_PREFIX}${tenantId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.taxpayerType) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load stored tax profile:', e);
  }

  const preset = DEFAULT_PROFILES_BY_TENANT[tenantId];
  const stateCode = preset?.stateCode || fallbackStateCode || '27';
  const stateCat = getStateCategory(stateCode);

  const defaultProfile: TaxProfile = {
    taxpayerType: preset?.taxpayerType || 'REGULAR_MONTHLY',
    filingFrequency: preset?.filingFrequency || 'MONTHLY',
    turnoverBracket: preset?.turnoverBracket || '5CR_TO_50CR',
    annualTurnoverEstimate: preset?.annualTurnoverEstimate || 65000000,
    stateCode: stateCode,
    stateName: preset?.stateName || STATE_NAMES_BY_CODE[stateCode] || 'Maharashtra',
    stateCategory: stateCat,
    isEInvoicingApplicable: preset?.isEInvoicingApplicable ?? true,
    isRcmApplicable: preset?.isRcmApplicable ?? true,
    isSez: preset?.isSez ?? false,
    alertLeadDays: preset?.alertLeadDays || 7,
    enableUrgentSmsAlerts: preset?.enableUrgentSmsAlerts ?? true,
    enableEmailReminders: preset?.enableEmailReminders ?? true,
    enableWhatsAppReminders: preset?.enableWhatsAppReminders ?? true,
    enableBrowserPush: preset?.enableBrowserPush ?? true,
    customNotes: preset?.customNotes || `Configured for ${fallbackName || 'Operating Entity'}.`,
    lastUpdated: new Date().toISOString()
  };

  return defaultProfile;
};

/**
 * Save updated tax profile to localStorage
 */
export const saveTaxProfile = (tenantId: string, profile: TaxProfile): void => {
  try {
    const updated = {
      ...profile,
      stateCategory: getStateCategory(profile.stateCode),
      stateName: STATE_NAMES_BY_CODE[profile.stateCode] || profile.stateName || 'State',
      lastUpdated: new Date().toISOString()
    };
    safeStorage.setItem(`${STORAGE_KEY_PREFIX}${tenantId}`, JSON.stringify(updated));
    // Trigger custom event so reactive components update across tabs or modules
    safeDispatchEvent('taxProfileUpdated', { tenantId, profile: updated });
  } catch (e) {
    console.error('Failed to save tax profile:', e);
  }
};

interface AlertActionState {
  dismissedIds: Record<string, boolean>;
  snoozedUntil: Record<string, string>;
  manuallyFiled: Record<string, { arn: string; date: string }>;
}

export const getAlertActionState = (tenantId: string): AlertActionState => {
  try {
    const raw = safeStorage.getItem(`${STORAGE_ALERT_STATE_KEY}${tenantId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { dismissedIds: {}, snoozedUntil: {}, manuallyFiled: {} };
};

export const saveAlertActionState = (tenantId: string, state: AlertActionState): void => {
  try {
    safeStorage.setItem(`${STORAGE_ALERT_STATE_KEY}${tenantId}`, JSON.stringify(state));
    safeDispatchEvent('taxAlertStateUpdated', { tenantId });
  } catch (e) {
    console.error('Failed to save alert state:', e);
  }
};

/**
 * Calculate dynamic GST deadlines and statutory compliance alerts based on the Tax Profile
 */
export const computeTaxComplianceAlerts = (
  tenantId: string,
  taxProfile: TaxProfile,
  filings: FilingRecord[] = [],
  customReferenceDate?: Date
): { alerts: TaxComplianceAlert[]; summary: TaxComplianceSummary } => {
  // Use custom reference date if provided, or default to current date
  const now = customReferenceDate || new Date('2026-09-24T23:00:00Z');
  const alertActionState = getAlertActionState(tenantId);

  const rawMilestoneTemplates: Omit<TaxComplianceAlert, 'daysRemaining' | 'status' | 'severity' | 'accumulatedLateFee' | 'estimatedInterestRisk'>[] = [];

  const stateCategory = taxProfile.stateCategory || getStateCategory(taxProfile.stateCode);

  // 1. REGULAR MONTHLY TAXPAYER RULES (GSTR-1, GSTR-3B, GSTR-9, GSTR-9C)
  if (taxProfile.taxpayerType === 'REGULAR_MONTHLY' || taxProfile.taxpayerType === 'SEZ_UNIT') {
    // Current Period: August 2026 (filed in Sep) and September 2026 (filed in Oct)
    
    // GSTR-1 August 2026 (Due Sep 11, 2026)
    rawMilestoneTemplates.push({
      id: `${tenantId}-gstr1-2026-08`,
      formType: 'GSTR-1',
      title: 'GSTR-1 Monthly Return of Outward Supplies',
      period: 'August 2026',
      dueDateStr: '2026-09-11',
      dueDateFormatted: 'Sep 11, 2026',
      applicableTaxpayerTypes: ['REGULAR_MONTHLY', 'SEZ_UNIT'],
      statutorySection: 'Section 37(1) CGST Act, 2017',
      ruleReference: 'Rule 59(1) of CGST Rules',
      estimatedLiability: 245000,
      dailyLateFee: 50,
      description: 'Mandatory monthly outward invoice declaration for B2B, B2C, and credit/debit notes.',
      taxProfileMatchReason: 'Matched because taxpayer is enrolled as a Regular Monthly Filer.',
      actionLabel: 'Review Outward Invoices',
      actionPath: '#/invoices',
      complianceChecklist: [
        'Check that all B2B invoices have valid recipient GSTINs',
        'Verify E-Invoice IRN sync on invoices > ₹5 Cr turnover threshold',
        'Reconcile credit & debit notes issued in August 2026'
      ]
    });

    // GSTR-3B August 2026 (Due Sep 20, 2026)
    rawMilestoneTemplates.push({
      id: `${tenantId}-gstr3b-2026-08`,
      formType: 'GSTR-3B',
      title: 'GSTR-3B Summary Return & Tax Settlement',
      period: 'August 2026',
      dueDateStr: '2026-09-20',
      dueDateFormatted: 'Sep 20, 2026',
      applicableTaxpayerTypes: ['REGULAR_MONTHLY', 'SEZ_UNIT'],
      statutorySection: 'Section 39(1) CGST Act, 2017',
      ruleReference: 'Rule 61(1) of CGST Rules',
      estimatedLiability: 485000,
      dailyLateFee: 50,
      description: 'Self-assessed monthly summary of outward tax liability, eligible ITC claims, and cash ledger offset.',
      taxProfileMatchReason: 'Regular monthly taxpayer required to settle net liability and file GSTR-3B by 20th.',
      actionLabel: 'Prepare & Settle GSTR-3B',
      actionPath: '#/computation',
      complianceChecklist: [
        'Confirm GSTR-2B ITC auto-population match before claiming credit',
        'Verify 180-day vendor payment rule for Rule 37 reversals',
        'Ensure sufficient electronic cash/credit balance for tax offset'
      ]
    });

    // GSTR-1 September 2026 (Due Oct 11, 2026)
    rawMilestoneTemplates.push({
      id: `${tenantId}-gstr1-2026-09`,
      formType: 'GSTR-1',
      title: 'GSTR-1 Outward Supplies Return',
      period: 'September 2026',
      dueDateStr: '2026-10-11',
      dueDateFormatted: 'Oct 11, 2026',
      applicableTaxpayerTypes: ['REGULAR_MONTHLY', 'SEZ_UNIT'],
      statutorySection: 'Section 37(1) CGST Act, 2017',
      ruleReference: 'Rule 59(1) of CGST Rules',
      estimatedLiability: 275000,
      dailyLateFee: 50,
      description: 'Upcoming monthly outward supplies filing for September 2026.',
      taxProfileMatchReason: 'Regular monthly taxpayer scheduled filing for the next period.',
      actionLabel: 'Pre-validate Invoices',
      actionPath: '#/invoices',
      complianceChecklist: [
        'Upload sales register into TaxFlow engine',
        'Perform HSN/SAC code 6-digit validation',
        'Pre-generate e-Way Bill linkage'
      ]
    });

    // GSTR-3B September 2026 (Due Oct 20, 2026)
    rawMilestoneTemplates.push({
      id: `${tenantId}-gstr3b-2026-09`,
      formType: 'GSTR-3B',
      title: 'GSTR-3B Monthly Return & Tax Settlement',
      period: 'September 2026',
      dueDateStr: '2026-10-20',
      dueDateFormatted: 'Oct 20, 2026',
      applicableTaxpayerTypes: ['REGULAR_MONTHLY', 'SEZ_UNIT'],
      statutorySection: 'Section 39(1) CGST Act, 2017',
      ruleReference: 'Rule 61(1) of CGST Rules',
      estimatedLiability: 512000,
      dailyLateFee: 50,
      description: 'Statutory summary return for September 2026 transactions and final ITC reconciliation.',
      taxProfileMatchReason: 'Standard monthly compliance cycle for Regular registered entities.',
      actionLabel: 'Schedule Filing Draft',
      actionPath: '#/filing',
      complianceChecklist: [
        'Run preliminary GSTR-2B vs Purchase Register matching',
        'Verify Reverse Charge (RCM) liabilities',
        'Calculate Net GST payable'
      ]
    });
  }

  // 2. QRMP SCHEME RULES (IFF for M1 & M2, PMT-06 Challan by 25th, Quarterly GSTR-1 by 13th, Quarterly GSTR-3B by 22nd/24th)
  if (taxProfile.taxpayerType === 'QRMP_QUARTERLY') {
    const qrmpGstr3bDueDate = stateCategory === 'CATEGORY_1' ? '2026-10-22' : '2026-10-24';
    const qrmpGstr3bFormatted = stateCategory === 'CATEGORY_1' ? 'Oct 22, 2026 (Cat 1 State)' : 'Oct 24, 2026 (Cat 2 State)';

    // IFF for August 2026 (Month 2 of Q2) - Due Sep 13, 2026
    rawMilestoneTemplates.push({
      id: `${tenantId}-iff-2026-08`,
      formType: 'IFF',
      title: 'QRMP Invoice Furnishing Facility (IFF) - Month 2',
      period: 'August 2026 (Q2 M2)',
      dueDateStr: '2026-09-13',
      dueDateFormatted: 'Sep 13, 2026',
      applicableTaxpayerTypes: ['QRMP_QUARTERLY'],
      statutorySection: 'Rule 59(2) CGST Rules, 2017',
      ruleReference: 'CBIC Notification No. 82/2020-CT',
      estimatedLiability: 95000,
      dailyLateFee: 0,
      description: 'Optional but highly recommended facility to upload B2B outward invoices so recipients can claim ITC in GSTR-2B.',
      taxProfileMatchReason: 'Matched because taxpayer opted for QRMP (Quarterly Returns with Monthly Payments).',
      actionLabel: 'Upload B2B Invoices via IFF',
      actionPath: '#/invoices',
      complianceChecklist: [
        'Max limit of ₹50 Lakhs per month outward taxable value for IFF',
        'Ensure invoice values match portal JSON schema',
        'Notify key enterprise buyers once uploaded'
      ]
    });

    // PMT-06 Monthly Tax Challan for August 2026 - Due Sep 25, 2026
    rawMilestoneTemplates.push({
      id: `${tenantId}-pmt06-2026-08`,
      formType: 'PMT-06',
      title: 'GST PMT-06 Monthly Tax Deposit Challan',
      period: 'August 2026 (Q2 M2)',
      dueDateStr: '2026-09-25',
      dueDateFormatted: 'Sep 25, 2026',
      applicableTaxpayerTypes: ['QRMP_QUARTERLY'],
      statutorySection: 'Section 39(7) CGST Act, 2017',
      ruleReference: 'Rule 61(6) - Fixed Sum or Self-Assessment Method',
      estimatedLiability: 180000,
      dailyLateFee: 0, // No late fee for PMT-06, but 18% p.a. interest applies if delayed
      description: 'Mandatory deposit of 35% fixed sum or self-assessed tax liability for Month 2 of the quarter.',
      taxProfileMatchReason: 'QRMP taxpayers must deposit monthly tax by the 25th of the next month using PMT-06.',
      actionLabel: 'Generate PMT-06 Challan',
      actionPath: '#/computation',
      complianceChecklist: [
        'Choose Fixed Sum Method (35% of past quarterly net cash) OR Self-Assessment Method',
        'Verify Electronic Cash Ledger balance',
        'Generate CPIN and complete NEFT / NetBanking transfer'
      ]
    });

    // Quarterly GSTR-1 for Q2 (Jul - Sep 2026) - Due Oct 13, 2026
    rawMilestoneTemplates.push({
      id: `${tenantId}-qrmp-gstr1-q2`,
      formType: 'GSTR-1',
      title: 'Quarterly GSTR-1 Outward Supplies Statement',
      period: 'Q2 FY 2026-27 (Jul - Sep)',
      dueDateStr: '2026-10-13',
      dueDateFormatted: 'Oct 13, 2026',
      applicableTaxpayerTypes: ['QRMP_QUARTERLY'],
      statutorySection: 'Section 37(1) CGST Act',
      ruleReference: 'CBIC Circular No. 143/13/2020-GST',
      estimatedLiability: 310000,
      dailyLateFee: 50,
      description: 'Consolidated quarterly return including invoices not previously uploaded in M1/M2 IFF.',
      taxProfileMatchReason: 'QRMP quarterly GSTR-1 is statutory by 13th of the month following the quarter.',
      actionLabel: 'Consolidate Q2 Outward Supplies',
      actionPath: '#/filing',
      complianceChecklist: [
        'Import B2C small sales, B2C large sales, and debit/credit notes',
        'Verify HSN summary table matches totals',
        'Confirm IFF uploaded invoices from July and August are excluded from duplication'
      ]
    });

    // Quarterly GSTR-3B for Q2 (Jul - Sep 2026) - Due Oct 22 / 24 based on State Category
    rawMilestoneTemplates.push({
      id: `${tenantId}-qrmp-gstr3b-q2`,
      formType: 'GSTR-3B',
      title: `Quarterly GSTR-3B Tax Return & Settlement (${stateCategory === 'CATEGORY_1' ? 'Category 1 State' : 'Category 2 State'})`,
      period: 'Q2 FY 2026-27 (Jul - Sep)',
      dueDateStr: qrmpGstr3bDueDate,
      dueDateFormatted: qrmpGstr3bFormatted,
      applicableTaxpayerTypes: ['QRMP_QUARTERLY'],
      statutorySection: 'Section 39(1) CGST Act, 2017',
      ruleReference: `Notification No. 82/2020-CT (${taxProfile.stateName || 'State'} due on ${stateCategory === 'CATEGORY_1' ? '22nd' : '24th'})`,
      estimatedLiability: 420000,
      dailyLateFee: 50,
      description: `Comprehensive quarterly summary return. Due date is strictly calibrated to state jurisdiction (${stateCategory === 'CATEGORY_1' ? '22nd for Southern/Western/Central states' : '24th for Northern/Eastern states'}).`,
      taxProfileMatchReason: `Calibrated specifically for ${taxProfile.stateName || 'your state'} under QRMP regulations.`,
      actionLabel: 'Calculate Final Q2 Tax Offset',
      actionPath: '#/computation',
      complianceChecklist: [
        'Aggregate cumulative Q2 inward invoices against GSTR-2B quarterly view',
        'Adjust PMT-06 tax credits deposited in July and August',
        'File using Digital Signature Certificate (DSC) or EVC OTP'
      ]
    });
  }

  // 3. COMPOSITION SCHEME RULES (CMP-08 Quarterly Challan by 18th, GSTR-4 Annual Return)
  if (taxProfile.taxpayerType === 'COMPOSITION') {
    rawMilestoneTemplates.push({
      id: `${tenantId}-cmp08-q2`,
      formType: 'CMP-08',
      title: 'CMP-08 Quarterly Tax Statement & Payment',
      period: 'Q2 FY 2026-27 (Jul - Sep)',
      dueDateStr: '2026-10-18',
      dueDateFormatted: 'Oct 18, 2026',
      applicableTaxpayerTypes: ['COMPOSITION'],
      statutorySection: 'Rule 62 of CGST Rules, 2017',
      ruleReference: 'Section 10 of CGST Act',
      estimatedLiability: 45000,
      dailyLateFee: 50,
      description: 'Quarterly statement for self-assessed tax payment at flat composition concessional rate (1% / 2% / 5% / 6%).',
      taxProfileMatchReason: 'Targeted for entities registered under Section 10 Composition Scheme.',
      actionLabel: 'Prepare CMP-08 Statement',
      actionPath: '#/filing',
      complianceChecklist: [
        'Calculate turnover on manufacturing (1%), trader (1%), restaurant (5%), or service (6%)',
        'Ensure no outward Inter-state supply was made',
        'Pay tax directly via cash ledger (No ITC permitted under Composition)'
      ]
    });

    rawMilestoneTemplates.push({
      id: `${tenantId}-gstr4-annual`,
      formType: 'GSTR-4',
      title: 'GSTR-4 Annual Return for Composition Taxpayers',
      period: 'FY 2025-26 Annual',
      dueDateStr: '2027-04-30',
      dueDateFormatted: 'Apr 30, 2027',
      applicableTaxpayerTypes: ['COMPOSITION'],
      statutorySection: 'Section 39(2) CGST Act',
      ruleReference: 'Rule 62(1)(ii)',
      estimatedLiability: 0,
      dailyLateFee: 50,
      description: 'Annual return consolidating all four quarterly CMP-08 statements and inward supplies.',
      taxProfileMatchReason: 'Statutory annual compliance requirement for composition registered dealers.',
      actionLabel: 'View Composition Ledger',
      actionPath: '#/settings',
      complianceChecklist: [
        'Verify inward supplies subject to Reverse Charge',
        'Reconcile turnover with audited financial statements'
      ]
    });
  }

  // 4. INPUT SERVICE DISTRIBUTOR (ISD - GSTR-6 Due by 13th)
  if (taxProfile.taxpayerType === 'ISD') {
    rawMilestoneTemplates.push({
      id: `${tenantId}-gstr6-2026-08`,
      formType: 'GSTR-6',
      title: 'GSTR-6 Input Service Distributor Monthly Return',
      period: 'August 2026',
      dueDateStr: '2026-09-13',
      dueDateFormatted: 'Sep 13, 2026',
      applicableTaxpayerTypes: ['ISD'],
      statutorySection: 'Section 39(4) CGST Act',
      ruleReference: 'Rule 65 CGST Rules',
      estimatedLiability: 0,
      dailyLateFee: 50,
      description: 'Declaration of input service invoices received and distribution of ITC to operating units.',
      taxProfileMatchReason: 'Taxpayer profile indicates Input Service Distributor registration.',
      actionLabel: 'Distribute ISD Credits',
      actionPath: '#/filing',
      complianceChecklist: [
        'Map head office input service invoices to recipient branches by turnover ratio',
        'Generate ISD invoices with unique distribution sequence',
        'Reconcile GSTR-6A inward feed'
      ]
    });
  }

  // 5. TDS / TCS TAXPAYERS (GSTR-7 / GSTR-8 Due by 10th)
  if (taxProfile.taxpayerType === 'TDS_TCS') {
    rawMilestoneTemplates.push({
      id: `${tenantId}-gstr7-8-2026-08`,
      formType: 'GSTR-7',
      title: 'GSTR-7 / GSTR-8 Tax Deducted / Collected at Source',
      period: 'August 2026',
      dueDateStr: '2026-09-10',
      dueDateFormatted: 'Sep 10, 2026',
      applicableTaxpayerTypes: ['TDS_TCS'],
      statutorySection: 'Section 51 / Section 52 CGST Act',
      ruleReference: 'Rule 66 / Rule 67 CGST Rules',
      estimatedLiability: 68000,
      dailyLateFee: 50,
      description: 'Monthly return of tax deducted on government contracts (TDS 2%) or collected by e-commerce operators (TCS 1%).',
      taxProfileMatchReason: 'Targeted for Tax Deductor / E-Commerce Operator tax profiles.',
      actionLabel: 'Reconcile Deductions',
      actionPath: '#/filing',
      complianceChecklist: [
        'Verify contract payments exceeding ₹2.5 Lakhs threshold',
        'Issue TDS certificates in Form GSTR-7A to deductees within 5 days of filing'
      ]
    });
  }

  // 6. ANNUAL COMPLIANCE AUDITS (GSTR-9 & GSTR-9C) - Applicable if Turnover > ₹2 Cr / ₹5 Cr
  if (
    taxProfile.turnoverBracket === '5CR_TO_50CR' || 
    taxProfile.turnoverBracket === 'ABOVE_50CR' || 
    taxProfile.turnoverBracket === '1_5CR_TO_5CR'
  ) {
    const is9cMandatory = taxProfile.turnoverBracket === '5CR_TO_50CR' || taxProfile.turnoverBracket === 'ABOVE_50CR';

    rawMilestoneTemplates.push({
      id: `${tenantId}-gstr9-fy25-26`,
      formType: 'GSTR-9',
      title: 'GSTR-9 Annual Return for FY 2025-26',
      period: 'FY 2025-26',
      dueDateStr: '2026-12-31',
      dueDateFormatted: 'Dec 31, 2026',
      applicableTaxpayerTypes: ['REGULAR_MONTHLY', 'SEZ_UNIT'],
      statutorySection: 'Section 44 of CGST Act, 2017',
      ruleReference: 'Rule 80(1) CGST Rules (Mandatory for turnover > ₹2 Crore)',
      estimatedLiability: 0,
      dailyLateFee: 200,
      description: 'Consolidated annual return of all monthly/quarterly filings with comprehensive ITC matching.',
      taxProfileMatchReason: `Mandatory because annual turnover (${taxProfile.turnoverBracket === 'ABOVE_50CR' ? '> ₹50 Cr' : '₹5 - 50 Cr'}) exceeds the ₹2 Crore exemption threshold.`,
      actionLabel: 'Launch GSTR-9 Wizard',
      actionPath: '#/gstr9-wizard',
      complianceChecklist: [
        'Consolidate all 12 months GSTR-1 and GSTR-3B filings',
        'Reconcile Table 8A (GSTR-2A) vs claimed ITC Table 6B',
        'Account for any spillover ITC claimed up to November 30'
      ]
    });

    if (is9cMandatory) {
      rawMilestoneTemplates.push({
        id: `${tenantId}-gstr9c-fy25-26`,
        formType: 'GSTR-9C',
        title: 'GSTR-9C Self-Certified Reconciliation Statement & Audit',
        period: 'FY 2025-26',
        dueDateStr: '2026-12-31',
        dueDateFormatted: 'Dec 31, 2026',
        applicableTaxpayerTypes: ['REGULAR_MONTHLY', 'SEZ_UNIT'],
        statutorySection: 'Section 44(2) CGST Act, 2017',
        ruleReference: 'Rule 80(3) CGST Rules (Mandatory for aggregate turnover > ₹5 Crore)',
        estimatedLiability: 0,
        dailyLateFee: 200,
        description: 'Statutory self-certified reconciliation statement between audited annual financial statements and GSTR-9.',
        taxProfileMatchReason: 'Mandatory because aggregate business turnover exceeds ₹5 Crore threshold.',
        actionLabel: 'Prepare 9C Reconciliation',
        actionPath: '#/gstr9-wizard',
        complianceChecklist: [
          'Reconcile gross turnover from Audited P&L with GST portal figures',
          'Calculate tax rate-wise difference and reasons for un-reconciled differences',
          'Ensure self-certification signoff by CFO / Authorized Signatory'
        ]
      });
    }
  }

  // 7. E-INVOICING COMPLIANCE ADVISORY (If Turnover > ₹5 Cr)
  if (taxProfile.isEInvoicingApplicable && (taxProfile.turnoverBracket === '5CR_TO_50CR' || taxProfile.turnoverBracket === 'ABOVE_50CR')) {
    rawMilestoneTemplates.push({
      id: `${tenantId}-einv-realtime`,
      formType: 'GSTR-1',
      title: 'E-Invoicing Real-Time Compliance & IRN Portal Verification',
      period: 'Continuous Real-Time (FY 2026-27)',
      dueDateStr: '2026-09-30',
      dueDateFormatted: 'Continuous Real-Time',
      applicableTaxpayerTypes: ['REGULAR_MONTHLY', 'SEZ_UNIT'],
      statutorySection: 'Rule 48(4) of CGST Rules, 2017',
      ruleReference: 'CBIC Notification No. 10/2023-Central Tax',
      estimatedLiability: 0,
      dailyLateFee: 0,
      description: 'Mandatory generation of Invoice Reference Number (IRN) and signed QR code from IRP for all B2B and export invoices.',
      taxProfileMatchReason: 'Applicable because annual turnover exceeds ₹5 Crore threshold.',
      actionLabel: 'View E-Invoice Console',
      actionPath: '#/einvoice',
      complianceChecklist: [
        'Ensure all B2B invoices have 64-character IRN and QR code before dispatch',
        'Strict 30-day reporting window for e-invoices on IRP portal',
        'Verify auto-population from IRP into GSTR-1 Table 4A'
      ]
    });
  }

  // 8. JOB WORK RETURN (ITC-04) - Half-yearly due Oct 25
  if (taxProfile.turnoverBracket === '5CR_TO_50CR' || taxProfile.turnoverBracket === 'ABOVE_50CR') {
    rawMilestoneTemplates.push({
      id: `${tenantId}-itc04-h1`,
      formType: 'ITC-04',
      title: 'Form GST ITC-04 Half-Yearly Job Work Return',
      period: 'H1 FY 2026-27 (Apr - Sep)',
      dueDateStr: '2026-10-25',
      dueDateFormatted: 'Oct 25, 2026',
      applicableTaxpayerTypes: ['REGULAR_MONTHLY', 'SEZ_UNIT'],
      statutorySection: 'Section 143(1) CGST Act',
      ruleReference: 'Rule 45(3) CGST Rules',
      estimatedLiability: 0,
      dailyLateFee: 50,
      description: 'Details of goods/capital goods sent to job workers and received back within statutory time limits (1 yr for inputs, 3 yrs for capital goods).',
      taxProfileMatchReason: 'Applicable for large operating entities dispatching materials to job workers.',
      actionLabel: 'Review Job Work Register',
      actionPath: '#/invoices',
      complianceChecklist: [
        'Verify goods returned within 1 year threshold (Section 19)',
        'Track challan numbers and job worker GSTIN'
      ]
    });
  }

  // Evaluate each alert against current date, filing records, dismissals, and snoozes
  const activeAlerts: TaxComplianceAlert[] = rawMilestoneTemplates.map(template => {
    const dueDate = new Date(template.dueDateStr + 'T23:59:59Z');
    const diffMs = dueDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    // Check if recorded as filed in API or manually entered
    const isManuallyFiled = alertActionState.manuallyFiled[template.id];
    const matchingFilingRecord = filings.find(f => 
      (f.type === template.formType || (f as any).returnType === template.formType || (f as any).formType === template.formType) && 
      (f.period?.toLowerCase() === template.period.toLowerCase() || f.period?.includes(template.period))
    );

    const isFiled = Boolean(isManuallyFiled || (matchingFilingRecord && matchingFilingRecord.status === 'FILED'));
    const filedArn = isManuallyFiled?.arn || matchingFilingRecord?.arn || (isFiled ? `AA270926${Math.floor(100000 + Math.random() * 900000)}` : undefined);
    const filedDate = isManuallyFiled?.date || matchingFilingRecord?.filedDate || (isFiled ? '2026-09-08' : undefined);

    let status: ComplianceAlertStatus = 'SCHEDULED';
    let severity: AlertSeverity = 'INFO';
    let accumulatedLateFee = 0;
    let estimatedInterestRisk = 0;

    if (isFiled) {
      status = 'FILED';
      severity = 'INFO';
    } else if (daysRemaining < 0) {
      status = 'OVERDUE';
      severity = 'CRITICAL';
      const daysOverdue = Math.abs(daysRemaining);
      accumulatedLateFee = daysOverdue * template.dailyLateFee;
      // 18% annual interest on estimated liability for overdue days
      estimatedInterestRisk = Math.round((template.estimatedLiability * 0.18 * daysOverdue) / 365);
    } else if (daysRemaining <= 3) {
      status = 'URGENT';
      severity = 'CRITICAL';
    } else if (daysRemaining <= taxProfile.alertLeadDays) {
      status = 'DUE_SOON';
      severity = 'HIGH';
    } else if (daysRemaining <= 15) {
      status = 'SCHEDULED';
      severity = 'MEDIUM';
    } else {
      status = 'SCHEDULED';
      severity = 'INFO';
    }

    const isDismissed = Boolean(alertActionState.dismissedIds[template.id]);
    const snoozedUntilStr = alertActionState.snoozedUntil[template.id];
    const isSnoozed = Boolean(snoozedUntilStr && new Date(snoozedUntilStr).getTime() > now.getTime());

    return {
      ...template,
      daysRemaining,
      status,
      severity,
      accumulatedLateFee,
      estimatedInterestRisk,
      isDismissed,
      isSnoozed,
      snoozedUntil: snoozedUntilStr,
      filedArn,
      filedDate
    };
  });

  // Sort alerts: Overdue first, then Urgent, then Due Soon, then Scheduled, then Filed
  activeAlerts.sort((a, b) => {
    if (a.status === 'OVERDUE' && b.status !== 'OVERDUE') return -1;
    if (b.status === 'OVERDUE' && a.status !== 'OVERDUE') return 1;
    if (a.status === 'URGENT' && b.status !== 'URGENT') return -1;
    if (b.status === 'URGENT' && a.status !== 'URGENT') return 1;
    if (a.status === 'DUE_SOON' && b.status !== 'DUE_SOON') return -1;
    if (b.status === 'DUE_SOON' && a.status !== 'DUE_SOON') return 1;
    if (a.status === 'FILED' && b.status !== 'FILED') return 1;
    if (b.status === 'FILED' && a.status !== 'FILED') return -1;
    return a.daysRemaining - b.daysRemaining;
  });

  // Generate compliance summary metrics
  const criticalOverdueCount = activeAlerts.filter(a => a.status === 'OVERDUE' && !a.isDismissed).length;
  const urgentDueSoonCount = activeAlerts.filter(a => (a.status === 'URGENT' || a.status === 'DUE_SOON') && !a.isDismissed).length;
  const upcomingScheduledCount = activeAlerts.filter(a => a.status === 'SCHEDULED' && !a.isDismissed).length;
  const filedCompletedCount = activeAlerts.filter(a => a.status === 'FILED').length;
  const totalAlertsCount = activeAlerts.filter(a => !a.isDismissed).length;

  const totalLateFee = activeAlerts.reduce((sum, a) => sum + (a.status === 'OVERDUE' ? a.accumulatedLateFee : 0), 0);

  let healthScore = 100;
  if (criticalOverdueCount > 0) healthScore -= criticalOverdueCount * 25;
  if (urgentDueSoonCount > 0) healthScore -= urgentDueSoonCount * 8;
  healthScore = Math.max(20, Math.min(100, healthScore));

  let overallStatus: 'EXCELLENT' | 'ATTENTION_REQUIRED' | 'CRITICAL_RISK' = 'EXCELLENT';
  if (criticalOverdueCount > 0 || healthScore < 70) {
    overallStatus = 'CRITICAL_RISK';
  } else if (urgentDueSoonCount > 0 || healthScore < 90) {
    overallStatus = 'ATTENTION_REQUIRED';
  }

  const nextCriticalDeadline = activeAlerts.find(a => a.status !== 'FILED' && !a.isDismissed) || null;

  return {
    alerts: activeAlerts,
    summary: {
      overallStatus,
      complianceHealthScore: healthScore,
      totalAlertsCount,
      criticalOverdueCount,
      urgentDueSoonCount,
      upcomingScheduledCount,
      filedCompletedCount,
      potentialLateFeeExposure: totalLateFee,
      nextCriticalDeadline
    }
  };
};

/**
 * Mark a statutory return as filed
 */
export const markAlertAsFiled = (tenantId: string, alertId: string, arn: string = `AA270926${Math.floor(100000 + Math.random() * 900000)}`): void => {
  const current = getAlertActionState(tenantId);
  current.manuallyFiled[alertId] = {
    arn,
    date: new Date().toISOString().split('T')[0]
  };
  saveAlertActionState(tenantId, current);
};

/**
 * Dismiss an alert
 */
export const dismissAlert = (tenantId: string, alertId: string): void => {
  const current = getAlertActionState(tenantId);
  current.dismissedIds[alertId] = true;
  saveAlertActionState(tenantId, current);
};

/**
 * Snooze an alert for N hours or days
 */
export const snoozeAlert = (tenantId: string, alertId: string, hours: number = 24): void => {
  const current = getAlertActionState(tenantId);
  const snoozedDate = new Date(Date.now() + hours * 60 * 60 * 1000);
  current.snoozedUntil[alertId] = snoozedDate.toISOString();
  saveAlertActionState(tenantId, current);
};

/**
 * Restore all dismissed or snoozed alerts
 */
export const resetAlertStates = (tenantId: string): void => {
  saveAlertActionState(tenantId, { dismissedIds: {}, snoozedUntil: {}, manuallyFiled: {} });
};

/**
 * Export compliance deadlines to an iCalendar (.ics) format for Outlook / Google Calendar
 */
export const generateIcsCalendar = (alerts: TaxComplianceAlert[], companyName: string): string => {
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TaxFlow Compliance Engine//GST Filing Deadlines//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:GST Statutory Deadlines - ${companyName}`
  ];

  alerts.forEach(alert => {
    if (alert.dueDateStr && alert.dueDateStr.length === 10) {
      const cleanDate = alert.dueDateStr.replace(/-/g, '');
      ics.push(
        'BEGIN:VEVENT',
        `UID:${alert.id}@taxflow.internal`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART;VALUE=DATE:${cleanDate}`,
        `DTEND;VALUE=DATE:${cleanDate}`,
        `SUMMARY:GST Filing Deadline: ${alert.formType} (${alert.period})`,
        `DESCRIPTION:${alert.title}\\n\\nStatutory Section: ${alert.statutorySection}\\nLate fee: ₹${alert.dailyLateFee}/day\\n\\n${alert.description}`,
        'STATUS:CONFIRMED',
        'BEGIN:VALARM',
        'TRIGGER:-P2D',
        'ACTION:DISPLAY',
        `DESCRIPTION:Reminder: ${alert.formType} due in 2 days`,
        'END:VALARM',
        'END:VEVENT'
      );
    }
  });

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
};
