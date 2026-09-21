import { Invoice, FilingRecord, UserAccessProfile } from '../../types';

export interface HSNRecord {
  hsnCode: string;
  description: string;
  uqc: string;
  quantity: number;
  totalValue: number;
  taxableValue: number;
  taxRate: number;
  igst: number;
  cgst: number;
  sgst: number;
}

export interface MissingInfoIssue {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  partyName: string;
  date: string;
  amount: number;
  taxAmount: number;
  type: string;
  field: 'GSTIN' | 'HSN' | 'POS' | 'TAX_MATH' | 'METADATA' | 'B2CL_STATE';
  title: string;
  description: string;
  portalImpact: string;
  severity: 'CRITICAL' | 'WARNING';
  autoFixType?: 'SET_POS_FROM_GSTIN' | 'ASSIGN_DEFAULT_HSN' | 'CONVERT_TO_B2C' | 'RECALCULATE_TAX' | 'SET_DEFAULT_POS';
  autoFixLabel?: string;
}

export interface PortalTablesSummary {
  b2b: { count: number; taxable: number; igst: number; cgst: number; sgst: number; tax: number };
  b2cl: { count: number; taxable: number; igst: number };
  b2cs: { count: number; taxable: number; igst: number; cgst: number; sgst: number; tax: number };
  exp: { count: number; taxable: number; igst: number };
  exempt: { count: number; taxable: number };
  doc: { first: string; last: string; total: number; cancelled: number; net: number };
}

export interface Gstr1WizardSharedProps {
  selectedReturn: FilingRecord;
  tenantId: string;
  user: UserAccessProfile | null;
  currentTenant: {
    gstin: string;
    name: string;
    stateCode: string;
  };
  invoices: Invoice[];
  activeInvoices: Invoice[];
  excludedInvoices: Set<string>;
  allHsns: HSNRecord[];
  portalTablesData: PortalTablesSummary;
  totalTaxableValue: number;
  totalTaxValue: number;
  totalInvoiceValue: number;
  onUpdateInvoices: (invoices: Invoice[]) => void;
  onToggleExcludeInvoice: (invoiceId: string) => void;
  onEditInvoice: (invoice: Invoice) => void;
  onAddCustomHsn: (hsn: HSNRecord) => void;
  onDeleteCustomHsn: (index: number) => void;
  onNavigateStep: (step: number) => void;
  gstr1JsonPayload: any;
  onDownloadJson: () => void;
  onStartDirectUpload: () => void;
  isSubmitting?: boolean;
}
