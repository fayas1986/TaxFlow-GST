export type TaxpayerClassification = 
  | 'REGULAR_MONTHLY'
  | 'QRMP_QUARTERLY'
  | 'COMPOSITION'
  | 'ISD'
  | 'TDS_TCS'
  | 'SEZ_UNIT';

export type TurnoverBracket = 
  | 'BELOW_1_5CR'
  | '1_5CR_TO_5CR'
  | '5CR_TO_50CR'
  | 'ABOVE_50CR';

export type StateCategory = 'CATEGORY_1' | 'CATEGORY_2';

export interface TaxProfile {
  taxpayerType: TaxpayerClassification;
  filingFrequency: 'MONTHLY' | 'QUARTERLY';
  turnoverBracket: TurnoverBracket;
  annualTurnoverEstimate: number; // in INR
  stateCode: string; // e.g. '27' for MH
  stateName?: string;
  stateCategory: StateCategory;
  isEInvoicingApplicable: boolean;
  isRcmApplicable: boolean;
  isSez: boolean;
  alertLeadDays: number; // Days in advance to trigger high/urgent alerts (default: 7)
  enableUrgentSmsAlerts: boolean;
  enableEmailReminders: boolean;
  enableWhatsAppReminders: boolean;
  enableBrowserPush: boolean;
  customNotes?: string;
  lastUpdated?: string;
}

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO';

export type ComplianceAlertStatus = 'OVERDUE' | 'URGENT' | 'DUE_SOON' | 'SCHEDULED' | 'FILED';

export interface TaxComplianceAlert {
  id: string;
  formType: 'GSTR-1' | 'GSTR-3B' | 'IFF' | 'PMT-06' | 'CMP-08' | 'GSTR-4' | 'GSTR-9' | 'GSTR-9C' | 'GSTR-6' | 'GSTR-7' | 'GSTR-8' | 'ITC-04';
  title: string;
  period: string; // e.g. "August 2026", "September 2026", "Q2 (Jul - Sep 2026)"
  dueDateStr: string; // YYYY-MM-DD
  dueDateFormatted: string; // e.g. "Sep 20, 2026"
  daysRemaining: number;
  status: ComplianceAlertStatus;
  severity: AlertSeverity;
  applicableTaxpayerTypes: TaxpayerClassification[];
  statutorySection: string;
  ruleReference: string;
  estimatedLiability: number;
  dailyLateFee: number;
  accumulatedLateFee: number;
  estimatedInterestRisk: number; // calculated if overdue
  description: string;
  taxProfileMatchReason: string;
  actionLabel: string;
  actionPath: string;
  isDismissed?: boolean;
  isSnoozed?: boolean;
  snoozedUntil?: string;
  filedArn?: string;
  filedDate?: string;
  complianceChecklist: string[];
}

export interface TaxComplianceSummary {
  overallStatus: 'EXCELLENT' | 'ATTENTION_REQUIRED' | 'CRITICAL_RISK';
  complianceHealthScore: number; // 0 - 100
  totalAlertsCount: number;
  criticalOverdueCount: number;
  urgentDueSoonCount: number;
  upcomingScheduledCount: number;
  filedCompletedCount: number;
  potentialLateFeeExposure: number;
  nextCriticalDeadline: TaxComplianceAlert | null;
}
