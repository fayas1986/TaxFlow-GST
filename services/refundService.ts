export type RefundCategory =
  | 'EXPORT_WITHOUT_TAX'         // Export of Goods & Services without payment of tax (under LUT/Bond)
  | 'INVERTED_DUTY_STRUCTURE'    // Accumulation of ITC due to Inverted Duty Structure
  | 'SEZ_WITHOUT_TAX'            // Supplies to SEZ Unit / Developer without payment of tax
  | 'DEEMED_EXPORTS'             // Deemed Export supplies
  | 'EXCESS_CASH_LEDGER'         // Refund of excess balance in Electronic Cash Ledger
  | 'INTRA_INTER_STATE_CORRECTION'; // Wrong tax head paid

export type RefundProcessingStatus =
  | 'RFD01_FILED'                   // Application Form GST RFD-01 Filed with ARN
  | 'RFD02_ACKNOWLEDGED'            // Formal Acknowledgement Issued by Officer (within 15 days)
  | 'UNDER_SCRUTINY'                // Under active verification by jurisdictional proper officer
  | 'RFD04_PROVISIONALLY_SANCTIONED' // Provisional Sanction Order Issued (90% for exports/SEZ)
  | 'RFD03_DEFICIENCY_MEMO'         // Deficiency Memo Issued (requires clarification or fresh filing)
  | 'RFD08_SCN_ISSUED'              // Show Cause Notice Issued (15 days to reply via RFD-09)
  | 'RFD09_REPLY_SUBMITTED'         // Taxpayer Reply Submitted to SCN
  | 'RFD06_SANCTIONED'              // Final Sanction Order Issued
  | 'RFD05_DISBURSED'               // Payment Advice Issued to PFMS & Bank Account Credited
  | 'RFD07_WITHHELD'                // Refund Withheld by Tax Authority under Sec 54(10)/54(11)
  | 'REJECTED';                     // Claim Rejected

export interface RefundTaxBreakdown {
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  total: number;
}

export interface StatutoryDocument {
  id: string;
  type: 'RFD-01' | 'RFD-02' | 'RFD-03' | 'RFD-04' | 'RFD-05' | 'RFD-06' | 'RFD-07' | 'RFD-08' | 'RFD-09' | 'STATEMENT_3' | 'STATEMENT_1A' | 'BRC_FIRC' | 'CA_CERTIFICATE';
  title: string;
  documentNumber: string;
  issuedDate: string;
  issuedBy: 'TAXPAYER' | 'TAX_OFFICER' | 'PFMS' | 'ICEGATE_CUSTOMS';
  status: 'VALID' | 'PENDING_ACTION' | 'SUPERSEDED';
  fileSize: string;
  remarks?: string;
}

export interface RefundTimelineEvent {
  id: string;
  timestamp: string;
  stage: string;
  title: string;
  description: string;
  actor: string;
  formRef?: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'ACTION_REQUIRED' | 'PENDING';
}

export interface PfmsBankingDetails {
  bankName: string;
  accountNumberMasked: string;
  ifsc: string;
  pfmsStatus: 'VALIDATED' | 'CBS_ACCEPTED' | 'PENDING_VALIDATION' | 'REJECTED';
  cbsReferenceNumber?: string;
  paymentOrderNumber?: string; // RFD-05 No.
  utrNumber?: string;
  disbursedDate?: string;
}

export interface StatutorySlaTracker {
  filingDate: string;
  statutoryLimitDays: number; // 60 days under Section 54(7)
  daysElapsed: number;
  daysRemaining: number;
  isInterestApplicable: boolean;
  interestRatePerAnnum: number; // 6% under Section 56
  accruedInterest: number;
  urgencyLevel: 'ON_TRACK' | 'ATTENTION' | 'OVERDUE' | 'CRITICAL_INTEREST_DUE';
}

export interface IcegateSyncDetails {
  totalShippingBills: number;
  egmMatched: number;
  scrollGenerated: boolean;
  icegateScrollNumber?: string;
  portCode: string;
  errorsDetected: string[];
}

export interface ItcRefundClaim {
  id: string;
  arn: string; // e.g. AA270826019284F
  tenantId: string;
  gstin: string;
  legalName: string;
  tradeName: string;
  branchId?: string;
  branchName?: string;
  taxPeriod: string; // e.g. "Jun 2026", "Jul 2026"
  taxPeriodCode: string; // e.g. "2026-06"
  financialYear: string; // e.g. "2026-27"
  category: RefundCategory;
  filingDate: string;
  acknowledgedDate?: string;
  
  // Tax Amount details
  amountClaimed: RefundTaxBreakdown;
  amountProvisionallySanctioned?: RefundTaxBreakdown;
  amountFinalSanctioned?: RefundTaxBreakdown;
  amountWithheld?: number;
  amountRejected?: number;
  amountDisbursed: number;
  
  status: RefundProcessingStatus;
  stageProgressPercent: number; // 0 - 100
  
  jurisdiction: {
    state: string;
    zone: string;
    commissionerate: string;
    division: string;
    range: string;
    assignedOfficerName: string;
    officerDesignation: string;
  };
  
  banking: PfmsBankingDetails;
  sla: StatutorySlaTracker;
  icegate?: IcegateSyncDetails;
  
  portalSync: {
    lastSyncedAt: string;
    portalGatewayStatus: 'HEALTHY' | 'SYNC_PENDING' | 'ACTION_ALERT';
    currentRemarks: string;
    rawSyncResponseCode: string;
  };

  deficiencyDetails?: {
    memoNumber: string;
    issuedDate: string;
    reason: string;
    requiredRectifications: string[];
    dueDateForReply: string;
  };

  scnDetails?: {
    scnNumber: string;
    issuedDate: string;
    groundsForRejection: string;
    proposedRejectionAmount: number;
    hearingDate?: string;
    replyDueDate: string;
    taxpayerReplySummary?: string;
    replyFiledDate?: string;
  };

  documents: StatutoryDocument[];
  timeline: RefundTimelineEvent[];
}

const STORAGE_KEY = 'TF_REFUND_CLAIMS_REGISTRY';

const calculateSla = (filingDateStr: string, claimedAmount: number, isCompleted: boolean, disbursedDateStr?: string): StatutorySlaTracker => {
  const filing = new Date(filingDateStr);
  const now = isCompleted && disbursedDateStr ? new Date(disbursedDateStr) : new Date('2026-08-29T08:34:00');
  const diffTime = Math.abs(now.getTime() - filing.getTime());
  const daysElapsed = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const statutoryLimitDays = 60;
  const daysRemaining = Math.max(0, statutoryLimitDays - daysElapsed);
  const isInterestApplicable = !isCompleted && daysElapsed > 60;
  
  // Interest calculation @ 6% p.a. on delay beyond 60 days
  const overdueDays = Math.max(0, daysElapsed - 60);
  const accruedInterest = isInterestApplicable 
    ? Math.round((claimedAmount * 0.06 * overdueDays) / 365) 
    : 0;

  let urgencyLevel: StatutorySlaTracker['urgencyLevel'] = 'ON_TRACK';
  if (isCompleted) {
    urgencyLevel = 'ON_TRACK';
  } else if (daysElapsed > 60) {
    urgencyLevel = 'CRITICAL_INTEREST_DUE';
  } else if (daysElapsed > 45) {
    urgencyLevel = 'OVERDUE';
  } else if (daysElapsed > 30) {
    urgencyLevel = 'ATTENTION';
  }

  return {
    filingDate: filingDateStr,
    statutoryLimitDays,
    daysElapsed,
    daysRemaining,
    isInterestApplicable,
    interestRatePerAnnum: 6,
    accruedInterest,
    urgencyLevel
  };
};

const initialRefundClaims: ItcRefundClaim[] = [
  {
    id: 'ref-001',
    arn: 'AA2706260018921',
    tenantId: 't1',
    gstin: '27ABCDE1234F1Z5',
    legalName: 'Acme Enterprise Technologies Ltd',
    tradeName: 'Acme Tech',
    branchId: 'b1',
    branchName: 'Mumbai HQ & Technology Unit',
    taxPeriod: 'Jun 2026',
    taxPeriodCode: '2026-06',
    financialYear: '2026-27',
    category: 'EXPORT_WITHOUT_TAX',
    filingDate: '2026-07-05',
    acknowledgedDate: '2026-07-09',
    amountClaimed: { igst: 1450000, cgst: 0, sgst: 0, cess: 0, total: 1450000 },
    amountProvisionallySanctioned: { igst: 1305000, cgst: 0, sgst: 0, cess: 0, total: 1305000 },
    amountFinalSanctioned: { igst: 1450000, cgst: 0, sgst: 0, cess: 0, total: 1450000 },
    amountWithheld: 0,
    amountRejected: 0,
    amountDisbursed: 1450000,
    status: 'RFD05_DISBURSED',
    stageProgressPercent: 100,
    jurisdiction: {
      state: 'Maharashtra',
      zone: 'Mumbai West',
      commissionerate: 'Mumbai Central Division II',
      division: 'Division IV - Exports & SEZ',
      range: 'Range III',
      assignedOfficerName: 'Shri Rajesh K. Sharma, IRS',
      officerDesignation: 'Assistant Commissioner of Central Tax'
    },
    banking: {
      bankName: 'State Bank of India',
      accountNumberMasked: '•••• •••• 8842',
      ifsc: 'SBIN0001234',
      pfmsStatus: 'CBS_ACCEPTED',
      cbsReferenceNumber: 'CBS/PFMS/2026/07/998124',
      paymentOrderNumber: 'RFD05/27/2026/004821',
      utrNumber: 'SBIN262098412891',
      disbursedDate: '2026-07-28'
    },
    sla: calculateSla('2026-07-05', 1450000, true, '2026-07-28'),
    icegate: {
      totalShippingBills: 14,
      egmMatched: 14,
      scrollGenerated: true,
      icegateScrollNumber: 'SCR/INNSA1/2026/8941',
      portCode: 'INNSA1 (Nhava Sheva Sea)',
      errorsDetected: []
    },
    portalSync: {
      lastSyncedAt: '2026-08-29 07:15 AM',
      portalGatewayStatus: 'HEALTHY',
      currentRemarks: 'Payment advice RFD-05 credited via PFMS to taxpayer account. Claim closed with zero variance.',
      rawSyncResponseCode: 'GSTN_200_DISBURSED'
    },
    documents: [
      { id: 'doc-1', type: 'RFD-01', title: 'Form GST RFD-01 Application', documentNumber: 'AA2706260018921', issuedDate: '2026-07-05', issuedBy: 'TAXPAYER', status: 'VALID', fileSize: '1.4 MB' },
      { id: 'doc-2', type: 'RFD-02', title: 'Form GST RFD-02 Acknowledgement Receipt', documentNumber: 'ACK/27/2026/7821', issuedDate: '2026-07-09', issuedBy: 'TAX_OFFICER', status: 'VALID', fileSize: '420 KB' },
      { id: 'doc-3', type: 'RFD-04', title: 'Form GST RFD-04 Provisional Sanction Order (90%)', documentNumber: 'ORD/PROV/2026/092', issuedDate: '2026-07-14', issuedBy: 'TAX_OFFICER', status: 'VALID', fileSize: '680 KB' },
      { id: 'doc-4', type: 'RFD-06', title: 'Form GST RFD-06 Final Sanction Order', documentNumber: 'ORD/SANCT/2026/341', issuedDate: '2026-07-25', issuedBy: 'TAX_OFFICER', status: 'VALID', fileSize: '780 KB' },
      { id: 'doc-5', type: 'RFD-05', title: 'Form GST RFD-05 Payment Advice Order', documentNumber: 'RFD05/27/2026/004821', issuedDate: '2026-07-27', issuedBy: 'PFMS', status: 'VALID', fileSize: '340 KB' },
      { id: 'doc-6', type: 'STATEMENT_3', title: 'Statement 3 - Shipping Bills & Invoices Annexure', documentNumber: 'ST3/2026/06/01', issuedDate: '2026-07-05', issuedBy: 'TAXPAYER', status: 'VALID', fileSize: '2.8 MB' }
    ],
    timeline: [
      { id: 't-1', timestamp: '2026-07-05 11:20 AM', stage: 'FILING', title: 'Refund Application RFD-01 Filed', description: 'Application filed online on GST Portal under Export without Payment of Tax (LUT). ARN generated.', actor: 'Tax Manager (TaxFlow)', formRef: 'RFD-01', status: 'COMPLETED' },
      { id: 't-2', timestamp: '2026-07-09 03:45 PM', stage: 'ACKNOWLEDGEMENT', title: 'Acknowledgement RFD-02 Issued', description: 'Jurisdictional tax officer verified all statutory statements and issued Form GST RFD-02.', actor: 'Shri Rajesh K. Sharma (Proper Officer)', formRef: 'RFD-02', status: 'COMPLETED' },
      { id: 't-3', timestamp: '2026-07-14 05:10 PM', stage: 'PROVISIONAL_SANCTION', title: 'Provisional Sanction Order RFD-04 (90%)', description: '90% of admissible ITC refund (₹13,05,000) sanctioned under Section 54(6).', actor: 'Assistant Commissioner', formRef: 'RFD-04', status: 'COMPLETED' },
      { id: 't-4', timestamp: '2026-07-22 02:30 PM', stage: 'SCRUTINY', title: 'ICEGATE Customs EGM Matching Completed', description: 'All 14 Shipping Bills matched with ICEGATE EDI servers and Customs Scroll validated.', actor: 'ICEGATE EDI System', status: 'COMPLETED' },
      { id: 't-5', timestamp: '2026-07-25 04:00 PM', stage: 'FINAL_ORDER', title: 'Final Sanction Order RFD-06 Issued', description: '100% of claim (₹14,50,000) sanctioned without any deductions or demand adjustments.', actor: 'Assistant Commissioner', formRef: 'RFD-06', status: 'COMPLETED' },
      { id: 't-6', timestamp: '2026-07-28 10:15 AM', stage: 'DISBURSEMENT', title: 'PFMS Direct Credit Executed', description: 'Funds credited to SBI A/c •••• 8842 via PFMS. UTR SBIN262098412891 generated.', actor: 'PFMS / RBI Gateway', formRef: 'RFD-05', status: 'COMPLETED' }
    ]
  },
  {
    id: 'ref-002',
    arn: 'AA2707260098124',
    tenantId: 't1',
    gstin: '27ABCDE1234F1Z5',
    legalName: 'Acme Enterprise Technologies Ltd',
    tradeName: 'Acme Tech',
    branchId: 'b1',
    branchName: 'Mumbai HQ',
    taxPeriod: 'Jul 2026',
    taxPeriodCode: '2026-07',
    financialYear: '2026-27',
    category: 'INVERTED_DUTY_STRUCTURE',
    filingDate: '2026-08-04',
    acknowledgedDate: '2026-08-11',
    amountClaimed: { igst: 380000, cgst: 420000, sgst: 420000, cess: 0, total: 1220000 },
    amountProvisionallySanctioned: undefined,
    amountFinalSanctioned: undefined,
    amountWithheld: 0,
    amountRejected: 0,
    amountDisbursed: 0,
    status: 'UNDER_SCRUTINY',
    stageProgressPercent: 50,
    jurisdiction: {
      state: 'Maharashtra',
      zone: 'Mumbai West',
      commissionerate: 'Mumbai Central Division II',
      division: 'Division IV - Audit & Assessment',
      range: 'Range II',
      assignedOfficerName: 'Smt. Ananya Deshmukh, IRS',
      officerDesignation: 'Deputy Commissioner of State Tax'
    },
    banking: {
      bankName: 'HDFC Bank Ltd',
      accountNumberMasked: '•••• •••• 4019',
      ifsc: 'HDFC0000060',
      pfmsStatus: 'VALIDATED'
    },
    sla: calculateSla('2026-08-04', 1220000, false),
    portalSync: {
      lastSyncedAt: '2026-08-29 08:10 AM',
      portalGatewayStatus: 'HEALTHY',
      currentRemarks: 'Officer reviewing input-output ratio under Rule 89(5) calculation sheet and GSTR-2B inward supplies.',
      rawSyncResponseCode: 'GSTN_200_UNDER_VERIFICATION'
    },
    documents: [
      { id: 'doc-10', type: 'RFD-01', title: 'Form GST RFD-01 Application', documentNumber: 'AA2707260098124', issuedDate: '2026-08-04', issuedBy: 'TAXPAYER', status: 'VALID', fileSize: '2.1 MB' },
      { id: 'doc-11', type: 'RFD-02', title: 'Form GST RFD-02 Acknowledgement Receipt', documentNumber: 'ACK/27/2026/8912', issuedDate: '2026-08-11', issuedBy: 'TAX_OFFICER', status: 'VALID', fileSize: '380 KB' },
      { id: 'doc-12', type: 'STATEMENT_1A', title: 'Statement 1A - Inverted Duty Structure Register', documentNumber: 'ST1A/2026/07/01', issuedDate: '2026-08-04', issuedBy: 'TAXPAYER', status: 'VALID', fileSize: '3.4 MB' },
      { id: 'doc-13', type: 'CA_CERTIFICATE', title: 'Chartered Accountant Certificate (Rule 89(2)(m))', documentNumber: 'UDIN260981249A01', issuedDate: '2026-08-03', issuedBy: 'TAXPAYER', status: 'VALID', fileSize: '950 KB' }
    ],
    timeline: [
      { id: 't-10', timestamp: '2026-08-04 02:40 PM', stage: 'FILING', title: 'Refund Application RFD-01 Filed', description: 'Inverted Duty Structure refund application submitted. Electronic Credit Ledger debited by ₹12,20,000.', actor: 'Chief Tax Officer (TaxFlow)', formRef: 'RFD-01', status: 'COMPLETED' },
      { id: 't-11', timestamp: '2026-08-11 11:15 AM', stage: 'ACKNOWLEDGEMENT', title: 'Acknowledgement RFD-02 Issued', description: 'Proper Officer issued RFD-02 after initial document checklist validation.', actor: 'Smt. Ananya Deshmukh', formRef: 'RFD-02', status: 'COMPLETED' },
      { id: 't-12', timestamp: '2026-08-18 04:00 PM', stage: 'SCRUTINY', title: 'GSTR-2B Cross-Verification in Progress', description: 'Assigned officer conducting system cross-matching of input tax credit claimed against supplier GSTR-1 filings.', actor: 'Audit & Assessment Division', status: 'IN_PROGRESS' },
      { id: 't-13', timestamp: '2026-08-29 (Expected)', stage: 'SANCTION_ORDER', title: 'Final Sanction Order Awaited', description: 'Statutory deadline for final sanction order: 2026-10-03 (36 days remaining).', actor: 'Tax Officer', status: 'PENDING' }
    ]
  },
  {
    id: 'ref-003',
    arn: 'AA2707260144908',
    tenantId: 't1',
    gstin: '27ABCDE1234F1Z5',
    legalName: 'Acme Enterprise Technologies Ltd',
    tradeName: 'Acme Tech',
    branchId: 'b2',
    branchName: 'Pune Innovation Park',
    taxPeriod: 'May 2026 - Jun 2026',
    taxPeriodCode: '2026-Q1',
    financialYear: '2026-27',
    category: 'SEZ_WITHOUT_TAX',
    filingDate: '2026-07-18',
    acknowledgedDate: undefined,
    amountClaimed: { igst: 890000, cgst: 0, sgst: 0, cess: 0, total: 890000 },
    amountProvisionallySanctioned: undefined,
    amountFinalSanctioned: undefined,
    amountWithheld: 0,
    amountRejected: 0,
    amountDisbursed: 0,
    status: 'RFD03_DEFICIENCY_MEMO',
    stageProgressPercent: 30,
    jurisdiction: {
      state: 'Maharashtra',
      zone: 'Pune Zone',
      commissionerate: 'Pune SEZ & Customs Division',
      division: 'Division I',
      range: 'SEZ Range II',
      assignedOfficerName: 'Shri Vikramaditya Joshi, IRS',
      officerDesignation: 'Superintendent of Central Tax'
    },
    banking: {
      bankName: 'Axis Bank Ltd',
      accountNumberMasked: '•••• •••• 9921',
      ifsc: 'UTIB0000182',
      pfmsStatus: 'VALIDATED'
    },
    sla: calculateSla('2026-07-18', 890000, false),
    portalSync: {
      lastSyncedAt: '2026-08-29 08:25 AM',
      portalGatewayStatus: 'ACTION_ALERT',
      currentRemarks: 'Deficiency Memo RFD-03 issued. Specified endorsement by SEZ Specified Officer missing for 3 invoices.',
      rawSyncResponseCode: 'GSTN_400_DEFICIENCY_MEMO'
    },
    deficiencyDetails: {
      memoNumber: 'DEF/27/PUNE/2026/00912',
      issuedDate: '2026-07-29',
      reason: 'Endorsement from Authorized Officer / Specified Officer of SEZ Unit under Rule 89(2)(f) not attached for Invoices #EXP-2026-089 to #EXP-2026-091.',
      requiredRectifications: [
        'Upload SEZ Specified Officer certified endorsement for ₹1,85,000 invoice batch',
        'Provide LUT acknowledgement for FY 2026-27 under Circular 125/44/2019-GST',
        'Submit revised Form GST RFD-01 along with complete Annexure B'
      ],
      dueDateForReply: '2026-09-12'
    },
    documents: [
      { id: 'doc-20', type: 'RFD-01', title: 'Form GST RFD-01 Initial Application', documentNumber: 'AA2707260144908', issuedDate: '2026-07-18', issuedBy: 'TAXPAYER', status: 'PENDING_ACTION', fileSize: '1.9 MB' },
      { id: 'doc-21', type: 'RFD-03', title: 'Form GST RFD-03 Deficiency Memo', documentNumber: 'DEF/27/PUNE/2026/00912', issuedDate: '2026-07-29', issuedBy: 'TAX_OFFICER', status: 'PENDING_ACTION', fileSize: '520 KB', remarks: 'Action required within 45 days of memo issuance' }
    ],
    timeline: [
      { id: 't-20', timestamp: '2026-07-18 10:00 AM', stage: 'FILING', title: 'Refund Application RFD-01 Filed', description: 'SEZ Supplies without payment of tax claim submitted.', actor: 'Pune Branch Tax Lead', formRef: 'RFD-01', status: 'COMPLETED' },
      { id: 't-21', timestamp: '2026-07-29 03:20 PM', stage: 'DEFICIENCY_MEMO', title: 'Deficiency Memo RFD-03 Issued', description: 'Officer highlighted missing SEZ endorsement certificates for 3 specific invoices.', actor: 'Shri Vikramaditya Joshi', formRef: 'RFD-03', status: 'ACTION_REQUIRED' },
      { id: 't-22', timestamp: '2026-08-20', stage: 'RECTIFICATION', title: 'SEZ Endorsements Procured', description: 'Procured signed endorsement from SEZ Development Commissioner. Ready for re-submission.', actor: 'Acme Operations Team', status: 'IN_PROGRESS' }
    ]
  },
  {
    id: 'ref-004',
    arn: 'AA2706260081239',
    tenantId: 't1',
    gstin: '27ABCDE1234F1Z5',
    legalName: 'Acme Enterprise Technologies Ltd',
    tradeName: 'Acme Tech',
    branchId: 'b1',
    branchName: 'Mumbai HQ',
    taxPeriod: 'May 2026',
    taxPeriodCode: '2026-05',
    financialYear: '2026-27',
    category: 'EXPORT_WITHOUT_TAX',
    filingDate: '2026-06-15',
    acknowledgedDate: '2026-06-22',
    amountClaimed: { igst: 2150000, cgst: 0, sgst: 0, cess: 0, total: 2150000 },
    amountProvisionallySanctioned: { igst: 1935000, cgst: 0, sgst: 0, cess: 0, total: 1935000 },
    amountFinalSanctioned: undefined,
    amountWithheld: 0,
    amountRejected: 0,
    amountDisbursed: 1935000,
    status: 'RFD08_SCN_ISSUED',
    stageProgressPercent: 70,
    jurisdiction: {
      state: 'Maharashtra',
      zone: 'Mumbai West',
      commissionerate: 'Mumbai Central Division II',
      division: 'Division IV - Exports & SEZ',
      range: 'Range III',
      assignedOfficerName: 'Shri Rajesh K. Sharma, IRS',
      officerDesignation: 'Assistant Commissioner of Central Tax'
    },
    banking: {
      bankName: 'State Bank of India',
      accountNumberMasked: '•••• •••• 8842',
      ifsc: 'SBIN0001234',
      pfmsStatus: 'CBS_ACCEPTED',
      paymentOrderNumber: 'RFD05/PROV/27/2026/00319',
      utrNumber: 'SBIN261809124810',
      disbursedDate: '2026-07-02'
    },
    sla: calculateSla('2026-06-15', 2150000, false), // >60 days: interest applicable
    portalSync: {
      lastSyncedAt: '2026-08-29 08:30 AM',
      portalGatewayStatus: 'ACTION_ALERT',
      currentRemarks: 'Show Cause Notice RFD-08 issued regarding remaining 10% claim balance (₹2,15,000) proposing rejection due to Foreign Inward Remittance Certificate (FIRC) date mismatch.',
      rawSyncResponseCode: 'GSTN_300_SCN_ISSUED'
    },
    scnDetails: {
      scnNumber: 'SCN/27/MUM/2026/00481',
      issuedDate: '2026-08-14',
      groundsForRejection: 'BRC / FIRC realization certificate dated 2026-05-30 indicates realization beyond 1 year for 2 service export agreements. Balance 10% (₹2,15,000) proposed for rejection under Rule 96A.',
      proposedRejectionAmount: 215000,
      hearingDate: '2026-09-08 11:30 AM',
      replyDueDate: '2026-08-30'
    },
    documents: [
      { id: 'doc-30', type: 'RFD-01', title: 'Form GST RFD-01 Application', documentNumber: 'AA2706260081239', issuedDate: '2026-06-15', issuedBy: 'TAXPAYER', status: 'VALID', fileSize: '2.5 MB' },
      { id: 'doc-31', type: 'RFD-02', title: 'Form GST RFD-02 Acknowledgement', documentNumber: 'ACK/27/2026/6510', issuedDate: '2026-06-22', issuedBy: 'TAX_OFFICER', status: 'VALID', fileSize: '410 KB' },
      { id: 'doc-32', type: 'RFD-04', title: 'Form GST RFD-04 Provisional Sanction (90%)', documentNumber: 'ORD/PROV/2026/055', issuedDate: '2026-06-29', issuedBy: 'TAX_OFFICER', status: 'VALID', fileSize: '690 KB' },
      { id: 'doc-33', type: 'RFD-05', title: 'Form GST RFD-05 Provisional Payment Advice', documentNumber: 'RFD05/PROV/27/2026/00319', issuedDate: '2026-07-01', issuedBy: 'PFMS', status: 'VALID', fileSize: '320 KB' },
      { id: 'doc-34', type: 'RFD-08', title: 'Form GST RFD-08 Notice to Show Cause', documentNumber: 'SCN/27/MUM/2026/00481', issuedDate: '2026-08-14', issuedBy: 'TAX_OFFICER', status: 'PENDING_ACTION', fileSize: '850 KB' }
    ],
    timeline: [
      { id: 't-30', timestamp: '2026-06-15 03:00 PM', stage: 'FILING', title: 'Refund Application RFD-01 Filed', description: 'Zero rated export of IT consulting services refund claimed.', actor: 'Chief Tax Officer', formRef: 'RFD-01', status: 'COMPLETED' },
      { id: 't-31', timestamp: '2026-06-22 11:30 AM', stage: 'ACKNOWLEDGEMENT', title: 'Acknowledgement RFD-02 Issued', description: 'Proper Officer issued acknowledgement.', actor: 'Shri Rajesh K. Sharma', formRef: 'RFD-02', status: 'COMPLETED' },
      { id: 't-32', timestamp: '2026-06-29 04:00 PM', stage: 'PROVISIONAL_SANCTION', title: '90% Provisional Refund Sanctioned', description: '₹19,35,000 sanctioned under Section 54(6).', actor: 'Assistant Commissioner', formRef: 'RFD-04', status: 'COMPLETED' },
      { id: 't-33', timestamp: '2026-07-02 10:45 AM', stage: 'DISBURSEMENT', title: 'Provisional 90% Disbursed via PFMS', description: '₹19,35,000 credited to SBI A/c •••• 8842.', actor: 'PFMS', formRef: 'RFD-05', status: 'COMPLETED' },
      { id: 't-34', timestamp: '2026-08-14 02:15 PM', stage: 'SCN_ISSUED', title: 'Show Cause Notice RFD-08 Issued', description: 'SCN issued proposing to reject remaining 10% (₹2,15,000) due to FIRC realization date query.', actor: 'Shri Rajesh K. Sharma', formRef: 'RFD-08', status: 'ACTION_REQUIRED' }
    ]
  },
  {
    id: 'ref-005',
    arn: 'AA0407260029145',
    tenantId: 't2',
    gstin: '04XYZZZ9876L1Z1',
    legalName: 'Globex Industrial Solutions Inc',
    tradeName: 'Globex North',
    branchId: 'b-chd',
    branchName: 'Chandigarh Unit',
    taxPeriod: 'Jun 2026',
    taxPeriodCode: '2026-06',
    financialYear: '2026-27',
    category: 'EXCESS_CASH_LEDGER',
    filingDate: '2026-08-10',
    acknowledgedDate: '2026-08-16',
    amountClaimed: { igst: 0, cgst: 250000, sgst: 250000, cess: 0, total: 500000 },
    amountProvisionallySanctioned: undefined,
    amountFinalSanctioned: { igst: 0, cgst: 250000, sgst: 250000, cess: 0, total: 500000 },
    amountWithheld: 0,
    amountRejected: 0,
    amountDisbursed: 500000,
    status: 'RFD05_DISBURSED',
    stageProgressPercent: 100,
    jurisdiction: {
      state: 'Chandigarh',
      zone: 'Panchkula Zone',
      commissionerate: 'Chandigarh Central GST',
      division: 'Division I',
      range: 'Range V',
      assignedOfficerName: 'Shri Manpreet Singh, IRS',
      officerDesignation: 'Assistant Commissioner'
    },
    banking: {
      bankName: 'Punjab National Bank',
      accountNumberMasked: '•••• •••• 1102',
      ifsc: 'PUNB0002100',
      pfmsStatus: 'CBS_ACCEPTED',
      paymentOrderNumber: 'RFD05/04/2026/00192',
      utrNumber: 'PUNB262309182390',
      disbursedDate: '2026-08-24'
    },
    sla: calculateSla('2026-08-10', 500000, true, '2026-08-24'),
    portalSync: {
      lastSyncedAt: '2026-08-29 07:45 AM',
      portalGatewayStatus: 'HEALTHY',
      currentRemarks: 'Electronic cash ledger excess balance refunded directly to registered bank account.',
      rawSyncResponseCode: 'GSTN_200_DISBURSED'
    },
    documents: [
      { id: 'doc-40', type: 'RFD-01', title: 'Form GST RFD-01 Application', documentNumber: 'AA0407260029145', issuedDate: '2026-08-10', issuedBy: 'TAXPAYER', status: 'VALID', fileSize: '1.1 MB' },
      { id: 'doc-41', type: 'RFD-02', title: 'Form GST RFD-02 Acknowledgement', documentNumber: 'ACK/04/2026/1902', issuedDate: '2026-08-16', issuedBy: 'TAX_OFFICER', status: 'VALID', fileSize: '320 KB' },
      { id: 'doc-42', type: 'RFD-06', title: 'Form GST RFD-06 Final Sanction Order', documentNumber: 'ORD/SANCT/04/2026/088', issuedDate: '2026-08-22', issuedBy: 'TAX_OFFICER', status: 'VALID', fileSize: '650 KB' },
      { id: 'doc-43', type: 'RFD-05', title: 'Form GST RFD-05 Payment Advice Order', documentNumber: 'RFD05/04/2026/00192', issuedDate: '2026-08-23', issuedBy: 'PFMS', status: 'VALID', fileSize: '310 KB' }
    ],
    timeline: [
      { id: 't-40', timestamp: '2026-08-10 11:00 AM', stage: 'FILING', title: 'Refund Application RFD-01 Filed', description: 'Application for refund of unutilized cash in cash ledger.', actor: 'Globex Tax Accountant', formRef: 'RFD-01', status: 'COMPLETED' },
      { id: 't-41', timestamp: '2026-08-16 02:30 PM', stage: 'ACKNOWLEDGEMENT', title: 'Acknowledgement Issued', description: 'Acknowledgement generated by system.', actor: 'Proper Officer', formRef: 'RFD-02', status: 'COMPLETED' },
      { id: 't-42', timestamp: '2026-08-22 05:00 PM', stage: 'FINAL_ORDER', title: 'Sanction Order RFD-06 Issued', description: 'Full amount ₹5,00,000 sanctioned without any dispute.', actor: 'Shri Manpreet Singh', formRef: 'RFD-06', status: 'COMPLETED' },
      { id: 't-43', timestamp: '2026-08-24 11:30 AM', stage: 'DISBURSEMENT', title: 'PFMS Disbursement Complete', description: 'Credited to PNB Account.', actor: 'PFMS', formRef: 'RFD-05', status: 'COMPLETED' }
    ]
  }
];

export class RefundService {
  private static getClaims(): ItcRefundClaim[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading refund claims', e);
    }
    this.saveClaims(initialRefundClaims);
    return initialRefundClaims;
  }

  private static saveClaims(claims: ItcRefundClaim[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(claims));
    } catch (e) {
      console.error('Error saving refund claims', e);
    }
  }

  public static async fetchClaims(tenantId?: string): Promise<ItcRefundClaim[]> {
    await new Promise(r => setTimeout(r, 200));
    const all = this.getClaims();
    if (!tenantId) return all;
    return all.filter(c => c.tenantId === tenantId);
  }

  public static async getClaimByArn(arn: string): Promise<ItcRefundClaim | undefined> {
    await new Promise(r => setTimeout(r, 150));
    const all = this.getClaims();
    return all.find(c => c.arn.toUpperCase() === arn.trim().toUpperCase() || c.id === arn);
  }

  public static async syncWithGovernmentPortals(tenantId?: string): Promise<{
    syncedCount: number;
    updatedClaims: ItcRefundClaim[];
    syncLog: string[];
  }> {
    await new Promise(r => setTimeout(r, 1400));
    const all = this.getClaims();
    const nowStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
                   new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    const logs: string[] = [
      `[AUTH] Authenticating with GSTN Production Gateway (e-Sign/EVC API v2.4)... SUCCESS`,
      `[ICEGATE] Handshaking ICEGATE Customs EDI Gateway for Shipping Bill manifests... CONNECTED`,
      `[PFMS] Validating PFMS Banking Clearing Server API response... OPERATIONAL`
    ];

    const updated = all.map(claim => {
      // Refresh SLA
      const isCompleted = claim.status === 'RFD05_DISBURSED' || claim.status === 'REJECTED';
      const sla = calculateSla(claim.filingDate, claim.amountClaimed.total, isCompleted, claim.banking.disbursedDate);
      
      logs.push(`[SYNC] Queried ARN ${claim.arn} (${claim.category}) -> Status: ${claim.status} | Officer: ${claim.jurisdiction.assignedOfficerName}`);

      return {
        ...claim,
        sla,
        portalSync: {
          ...claim.portalSync,
          lastSyncedAt: nowStr
        }
      };
    });

    this.saveClaims(updated);
    const filtered = tenantId ? updated.filter(c => c.tenantId === tenantId) : updated;
    return {
      syncedCount: filtered.length,
      updatedClaims: filtered,
      syncLog: logs
    };
  }

  public static async submitReplyToScn(claimId: string, replyText: string, attachedFileNames: string[]): Promise<ItcRefundClaim> {
    await new Promise(r => setTimeout(r, 800));
    const all = this.getClaims();
    const claim = all.find(c => c.id === claimId);
    if (!claim) throw new Error('Refund claim not found');

    const nowStr = new Date().toISOString().split('T')[0];
    const newDoc: StatutoryDocument = {
      id: `doc-${Date.now()}`,
      type: 'RFD-09',
      title: 'Form GST RFD-09 Taxpayer Reply to Show Cause Notice',
      documentNumber: `REP/27/2026/${Math.floor(1000 + Math.random() * 9000)}`,
      issuedDate: nowStr,
      issuedBy: 'TAXPAYER',
      status: 'VALID',
      fileSize: '1.8 MB',
      remarks: `Reply with ${attachedFileNames.length} supporting clarification documents attached.`
    };

    const newTimeline: RefundTimelineEvent = {
      id: `t-${Date.now()}`,
      timestamp: `${nowStr} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
      stage: 'SCN_REPLY_FILED',
      title: 'Taxpayer Reply (RFD-09) Submitted',
      description: `Formal defense and statutory reconciliation submitted: "${replyText.substring(0, 80)}..."`,
      actor: 'Authorized Signatory (Digital Token / EVC)',
      formRef: 'RFD-09',
      status: 'COMPLETED'
    };

    claim.status = 'RFD09_REPLY_SUBMITTED';
    claim.stageProgressPercent = 80;
    claim.documents.push(newDoc);
    claim.timeline.push(newTimeline);
    claim.scnDetails = {
      ...claim.scnDetails!,
      taxpayerReplySummary: replyText,
      replyFiledDate: nowStr
    };
    claim.portalSync.currentRemarks = 'Taxpayer response Form GST RFD-09 successfully received on Common Portal. Officer review scheduled.';

    this.saveClaims(all);
    return claim;
  }

  public static async submitDeficiencyRectification(claimId: string, rectificationNotes: string): Promise<ItcRefundClaim> {
    await new Promise(r => setTimeout(r, 800));
    const all = this.getClaims();
    const claim = all.find(c => c.id === claimId);
    if (!claim) throw new Error('Refund claim not found');

    const nowStr = new Date().toISOString().split('T')[0];
    const newDoc: StatutoryDocument = {
      id: `doc-${Date.now()}`,
      type: 'RFD-01',
      title: 'Form GST RFD-01 Rectified Application',
      documentNumber: `${claim.arn}-R1`,
      issuedDate: nowStr,
      issuedBy: 'TAXPAYER',
      status: 'VALID',
      fileSize: '2.4 MB',
      remarks: 'Rectified application addressing all queries in Deficiency Memo RFD-03.'
    };

    const newTimeline: RefundTimelineEvent = {
      id: `t-${Date.now()}`,
      timestamp: `${nowStr} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
      stage: 'RECTIFIED_RFD01',
      title: 'Rectified RFD-01 Application Submitted',
      description: `Deficiency rectifications filed: "${rectificationNotes.substring(0, 80)}..."`,
      actor: 'Tax Manager (TaxFlow)',
      formRef: 'RFD-01',
      status: 'COMPLETED'
    };

    claim.status = 'RFD02_ACKNOWLEDGED';
    claim.stageProgressPercent = 40;
    claim.documents.push(newDoc);
    claim.timeline.push(newTimeline);
    claim.portalSync.currentRemarks = 'Rectified application received. Proper Officer assigned for fresh review.';

    this.saveClaims(all);
    return claim;
  }

  public static async createNewRefundDraft(draft: {
    tenantId: string;
    gstin: string;
    legalName: string;
    branchId?: string;
    branchName?: string;
    taxPeriod: string;
    taxPeriodCode: string;
    financialYear: string;
    category: RefundCategory;
    amountClaimed: RefundTaxBreakdown;
    bankName: string;
    accountNumber: string;
    ifsc: string;
  }): Promise<ItcRefundClaim> {
    await new Promise(r => setTimeout(r, 600));
    const all = this.getClaims();
    const stateCode = draft.gstin.substring(0, 2);
    const arnNum = `AA${stateCode}${new Date().getFullYear().toString().substring(2)}${Math.floor(10000000 + Math.random() * 90000000)}F`;
    const nowStr = new Date().toISOString().split('T')[0];

    const newClaim: ItcRefundClaim = {
      id: `ref-${Date.now()}`,
      arn: arnNum,
      tenantId: draft.tenantId,
      gstin: draft.gstin,
      legalName: draft.legalName,
      tradeName: draft.legalName.split(' ')[0],
      branchId: draft.branchId || 'b1',
      branchName: draft.branchName || 'Primary Unit',
      taxPeriod: draft.taxPeriod,
      taxPeriodCode: draft.taxPeriodCode,
      financialYear: draft.financialYear,
      category: draft.category,
      filingDate: nowStr,
      amountClaimed: draft.amountClaimed,
      amountDisbursed: 0,
      status: 'RFD01_FILED',
      stageProgressPercent: 15,
      jurisdiction: {
        state: stateCode === '27' ? 'Maharashtra' : stateCode === '04' ? 'Chandigarh' : 'Karnataka',
        zone: 'Central Tax Zone',
        commissionerate: 'GST Commissionerate Division I',
        division: 'Division I - Refunds',
        range: 'Range I',
        assignedOfficerName: 'Proper Officer (Auto-Assigned)',
        officerDesignation: 'Assistant Commissioner'
      },
      banking: {
        bankName: draft.bankName,
        accountNumberMasked: `•••• •••• ${draft.accountNumber.slice(-4)}`,
        ifsc: draft.ifsc,
        pfmsStatus: 'VALIDATED'
      },
      sla: calculateSla(nowStr, draft.amountClaimed.total, false),
      portalSync: {
        lastSyncedAt: 'Just Now',
        portalGatewayStatus: 'HEALTHY',
        currentRemarks: 'Form GST RFD-01 filed successfully on GST Portal. Awaiting Form GST RFD-02 acknowledgement within 15 days.',
        rawSyncResponseCode: 'GSTN_200_FILED'
      },
      documents: [
        {
          id: `doc-${Date.now()}`,
          type: 'RFD-01',
          title: 'Form GST RFD-01 Refund Application',
          documentNumber: arnNum,
          issuedDate: nowStr,
          issuedBy: 'TAXPAYER',
          status: 'VALID',
          fileSize: '1.6 MB'
        }
      ],
      timeline: [
        {
          id: `t-${Date.now()}`,
          timestamp: `${nowStr} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
          stage: 'FILING',
          title: 'Refund Application RFD-01 Filed',
          description: `Filed on GST Portal for ${draft.category.replace(/_/g, ' ')}. ARN ${arnNum} generated.`,
          actor: 'TaxFlow Portal Integrator',
          formRef: 'RFD-01',
          status: 'COMPLETED'
        }
      ]
    };

    all.unshift(newClaim);
    this.saveClaims(all);
    return newClaim;
  }
}
