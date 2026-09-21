import React, { useState } from 'react';
import {
  Database,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  ArrowRight,
  ArrowLeftRight,
  Settings,
  FileJson,
  RotateCcw,
  Download,
  Upload,
  Play,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Layers,
  Zap,
  Copy,
  Sliders,
  Code,
  Info,
  CheckCheck
} from 'lucide-react';

export interface FieldMappingRule {
  id: string;
  customErpField: string;
  erpFieldType: 'String' | 'Number' | 'Date' | 'Boolean' | 'Object';
  direction: 'IMPORT' | 'EXPORT' | 'BIDIRECTIONAL';
  targetEntity: string;
  targetDynamicsField: string;
  transformation: 'PASS_THROUGH' | 'UPPERCASE' | 'LOWERCASE' | 'TRIM' | 'DATE_ISO' | 'CURRENCY_ROUND' | 'LOOKUP_MAP' | 'PREFIX_IN';
  fallbackValue: string;
  isRequired: boolean;
  status: 'ACTIVE' | 'DRAFT' | 'ERROR';
  description?: string;
}

interface Props {
  erpType: 'BUSINESS_CENTRAL' | 'DYNAMICS_FO' | 'TALLY_PRIME' | 'QUICKBOOKS' | 'XERO' | 'DYNAMICS_BC' | string;
  onSaveMappings?: (rules: FieldMappingRule[]) => void;
}

const DEFAULT_BC_ENTITIES = [
  { id: 'salesInvoices', name: 'salesInvoices (Sales Invoices)' },
  { id: 'purchaseInvoices', name: 'purchaseInvoices (Purchase Ledger)' },
  { id: 'customers', name: 'customers (Customer Master)' },
  { id: 'vendors', name: 'vendors (Vendor Master)' },
  { id: 'salesCreditMemos', name: 'salesCreditMemos (Credit Memos)' },
];

const DEFAULT_FO_ENTITIES = [
  { id: 'SalesInvoiceHeadersV2', name: 'SalesInvoiceHeadersV2 (Invoice Headers)' },
  { id: 'SalesInvoiceLinesV2', name: 'SalesInvoiceLinesV2 (Line Items & HSN)' },
  { id: 'VendInvoiceInfoSubLineEntities', name: 'VendInvoiceInfoSubLineEntities (Vendor Invoices)' },
  { id: 'CustomerV3Entities', name: 'CustomerV3Entities (Customer Master V3)' },
  { id: 'TaxGroupEntities', name: 'TaxGroupEntities (Tax Posting Groups)' },
];

const DEFAULT_SAP_ENTITIES = [
  { id: 'API_BILLING_DOCUMENT_SRV', name: 'API_BILLING_DOCUMENT_SRV (VF01/VF03 SD Invoices)' },
  { id: 'API_SUPPLIERINVOICE_PROCESS_SRV', name: 'API_SUPPLIERINVOICE_PROCESS_SRV (MIRO MM Vendor Invoices)' },
  { id: 'A_Customer', name: 'A_Customer (Business Partner SD Master)' },
  { id: 'A_Supplier', name: 'A_Supplier (Vendor Master MM)' },
  { id: 'A_JournalEntryItem', name: 'A_JournalEntryItem (FI General Ledger)' },
];

const DEFAULT_ORACLE_ENTITIES = [
  { id: 'invoice', name: 'invoice (Sales Invoices & Billing)' },
  { id: 'vendorBill', name: 'vendorBill (Accounts Payable Bills & ITC)' },
  { id: 'creditMemo', name: 'creditMemo (Credit Memos)' },
  { id: 'customer', name: 'customer (Entity Customer Master)' },
  { id: 'vendor', name: 'vendor (Vendor Master)' },
  { id: 'taxCode', name: 'taxCode (SuiteTax GST Codes)' },
];

const DEFAULT_ZOHO_ENTITIES = [
  { id: 'invoices', name: 'invoices (Outward Tax Invoices)' },
  { id: 'bills', name: 'bills (Inward Vendor Bills & ITC)' },
  { id: 'contacts', name: 'contacts (Customers & Vendors)' },
  { id: 'taxes', name: 'taxes (GST Rates & Slabs)' },
  { id: 'chartofaccounts', name: 'chartofaccounts (General Ledger)' },
];

const DEFAULT_QB_ENTITIES = [
  { id: 'Invoices', name: 'Invoices (Customer Sales Invoices)' },
  { id: 'Bills', name: 'Bills (Vendor Expenses & Purchases)' },
  { id: 'Customers', name: 'Customers (Customer Master)' },
  { id: 'Vendors', name: 'Vendors (Vendor Master)' },
  { id: 'TaxCodes', name: 'TaxCodes (GST Agencies & Slabs)' },
];

const DEFAULT_XERO_ENTITIES = [
  { id: 'Invoices', name: 'Invoices (ACCREC Sales Invoices)' },
  { id: 'Bills', name: 'Bills (ACCPAY Purchase Bills)' },
  { id: 'Contacts', name: 'Contacts (Customer & Supplier Master)' },
  { id: 'TaxRates', name: 'TaxRates (Tax Rates & Components)' },
  { id: 'ManualJournals', name: 'ManualJournals (GL Tax Adjustments)' },
];

const DEFAULT_TALLY_ENTITIES = [
  { id: 'SalesVouchers', name: 'SalesVouchers (Sales Invoices & Registers)' },
  { id: 'PurchaseVouchers', name: 'PurchaseVouchers (Purchase Invoices & ITC)' },
  { id: 'CreditDebitNotes', name: 'CreditDebitNotes (Credit/Debit Vouchers)' },
  { id: 'PartyLedgers', name: 'PartyLedgers (Customer & Vendor Masters)' },
  { id: 'TaxLedgers', name: 'TaxLedgers (CGST/SGST/IGST Ledgers)' },
];

const STANDARD_BC_FIELDS: Record<string, string[]> = {
  salesInvoices: [
    'number',
    'externalDocumentNo',
    'postingDate',
    'customerName',
    'customerNumber',
    'vatRegistrationNo',
    'shipToStateCode',
    'totalAmountExcludingTax',
    'totalTaxAmount',
    'currencyCode',
    'paymentTermsCode'
  ],
  purchaseInvoices: [
    'number',
    'vendorInvoiceNumber',
    'buyFromVendorNumber',
    'buyFromVendorName',
    'vatRegistrationNo',
    'postingDate',
    'totalAmountExcludingTax',
    'totalTaxAmount'
  ],
  customers: [
    'number',
    'displayName',
    'taxRegistrationNumber',
    'addressLine1',
    'city',
    'state',
    'postalCode',
    'countryRegionCode'
  ],
  vendors: [
    'number',
    'displayName',
    'taxRegistrationNumber',
    'addressLine1',
    'city',
    'state',
    'postalCode'
  ],
  salesCreditMemos: [
    'number',
    'externalDocumentNo',
    'postingDate',
    'customerNumber',
    'totalAmountExcludingTax',
    'totalTaxAmount'
  ]
};

const STANDARD_FO_FIELDS: Record<string, string[]> = {
  SalesInvoiceHeadersV2: [
    'SalesInvoiceHeaderV2.InvoiceNumber',
    'SalesInvoiceHeaderV2.InvoiceDate',
    'SalesInvoiceHeaderV2.InvoiceAccountName',
    'SalesInvoiceHeaderV2.GSTIN',
    'SalesInvoiceHeaderV2.InvoiceAmount',
    'SalesInvoiceHeaderV2.TotalTaxAmount',
    'SalesInvoiceHeaderV2.StateOfSupply',
    'SalesInvoiceHeaderV2.SalesOrderNumber'
  ],
  SalesInvoiceLinesV2: [
    'SalesInvoiceLineV2.LineNumber',
    'SalesInvoiceLineV2.ItemNumber',
    'SalesInvoiceLineV2.HSNCode',
    'SalesInvoiceLineV2.LineAmount',
    'SalesInvoiceLineV2.TaxItemGroup',
    'SalesInvoiceLineV2.Quantity'
  ],
  VendInvoiceInfoSubLineEntities: [
    'VendInvoiceHeaderEntity.VendorInvoiceNumber',
    'VendInvoiceHeaderEntity.InvoiceAccount',
    'VendInvoiceHeaderEntity.GSTIN',
    'VendInvoiceHeaderEntity.InvoiceAmount',
    'VendInvoiceHeaderEntity.StateOfSupply'
  ],
  CustomerV3Entities: [
    'CustomerV3.CustomerAccount',
    'CustomerV3.OrganizationName',
    'CustomerV3.GSTIN',
    'CustomerV3.AddressState',
    'CustomerV3.AddressZipCode'
  ],
  TaxGroupEntities: [
    'TaxGroupEntity.TaxGroupCode',
    'TaxGroupEntity.Description',
    'TaxGroupEntity.TaxCode'
  ]
};

const STANDARD_TALLY_FIELDS: Record<string, string[]> = {
  SalesVouchers: [
    'voucher_number',
    'doc_date',
    'party_gstin_id',
    'assessable_amt',
    'total_tax_amt',
    'cgst_amt',
    'sgst_amt',
    'igst_amt',
    'hsn_sac_code',
    'party_ledger_name',
    'state_code',
    'irn_no',
    'signed_qr_code'
  ],
  PurchaseVouchers: [
    'voucher_number',
    'supplier_inv_no',
    'doc_date',
    'party_gstin_id',
    'assessable_amt',
    'total_tax_amt',
    'itc_claim_eligibility',
    'gstr2b_reconciled_status'
  ],
  CreditDebitNotes: [
    'voucher_number',
    'original_invoice_no',
    'doc_date',
    'party_gstin_id',
    'note_type',
    'assessable_amt',
    'total_tax_amt'
  ],
  PartyLedgers: [
    'party_ledger_name',
    'party_gstin_id',
    'state_name',
    'pincode',
    'pan_number',
    'gst_registration_type'
  ],
  TaxLedgers: [
    'ledger_name',
    'tax_type',
    'gst_rate_percent',
    'is_reverse_charge'
  ]
};

const INITIAL_BC_RULES: FieldMappingRule[] = [
  {
    id: 'bc-1',
    customErpField: 'Custom_Invoice_DocNo',
    erpFieldType: 'String',
    direction: 'IMPORT',
    targetEntity: 'salesInvoices',
    targetDynamicsField: 'externalDocumentNo',
    transformation: 'UPPERCASE',
    fallbackValue: 'INV-TEMP-00',
    isRequired: true,
    status: 'ACTIVE',
    description: 'Header document tracking number from legacy ERP'
  },
  {
    id: 'bc-2',
    customErpField: 'ERP_Txn_Date',
    erpFieldType: 'Date',
    direction: 'IMPORT',
    targetEntity: 'salesInvoices',
    targetDynamicsField: 'postingDate',
    transformation: 'DATE_ISO',
    fallbackValue: 'CURRENT_DATE',
    isRequired: true,
    status: 'ACTIVE',
    description: 'Voucher transaction posting date formatted to ISO 8601'
  },
  {
    id: 'bc-3',
    customErpField: 'Client_GSTIN_Number',
    erpFieldType: 'String',
    direction: 'BIDIRECTIONAL',
    targetEntity: 'salesInvoices',
    targetDynamicsField: 'vatRegistrationNo',
    transformation: 'UPPERCASE',
    fallbackValue: '27AAAAA0000A1Z5',
    isRequired: true,
    status: 'ACTIVE',
    description: '15-digit GSTIN tax registration ID'
  },
  {
    id: 'bc-4',
    customErpField: 'Base_Taxable_Amt',
    erpFieldType: 'Number',
    direction: 'IMPORT',
    targetEntity: 'salesInvoices',
    targetDynamicsField: 'totalAmountExcludingTax',
    transformation: 'CURRENCY_ROUND',
    fallbackValue: '0.00',
    isRequired: true,
    status: 'ACTIVE',
    description: 'Net taxable base amount before GST calculations'
  },
  {
    id: 'bc-5',
    customErpField: 'Calculated_GST_Total',
    erpFieldType: 'Number',
    direction: 'IMPORT',
    targetEntity: 'salesInvoices',
    targetDynamicsField: 'totalTaxAmount',
    transformation: 'CURRENCY_ROUND',
    fallbackValue: '0.00',
    isRequired: true,
    status: 'ACTIVE',
    description: 'Statutory combined CGST+SGST or IGST tax sum'
  },
  {
    id: 'bc-6',
    customErpField: 'Dest_State_Tin',
    erpFieldType: 'String',
    direction: 'IMPORT',
    targetEntity: 'salesInvoices',
    targetDynamicsField: 'shipToStateCode',
    transformation: 'PREFIX_IN',
    fallbackValue: 'IN-MH',
    isRequired: false,
    status: 'ACTIVE',
    description: '2-digit Place of Supply state code'
  }
];

const INITIAL_FO_RULES: FieldMappingRule[] = [
  {
    id: 'fo-1',
    customErpField: 'AX_Sales_Voucher_No',
    erpFieldType: 'String',
    direction: 'BIDIRECTIONAL',
    targetEntity: 'SalesInvoiceHeadersV2',
    targetDynamicsField: 'SalesInvoiceHeaderV2.InvoiceNumber',
    transformation: 'UPPERCASE',
    fallbackValue: 'INV-AX-0001',
    isRequired: true,
    status: 'ACTIVE',
    description: 'Unique sales ledger voucher invoice ID'
  },
  {
    id: 'fo-2',
    customErpField: 'AX_Posting_Date_Raw',
    erpFieldType: 'Date',
    direction: 'IMPORT',
    targetEntity: 'SalesInvoiceHeadersV2',
    targetDynamicsField: 'SalesInvoiceHeaderV2.InvoiceDate',
    transformation: 'DATE_ISO',
    fallbackValue: 'CURRENT_DATE',
    isRequired: true,
    status: 'ACTIVE',
    description: 'Financial posting ledger date'
  },
  {
    id: 'fo-3',
    customErpField: 'Tax_Registration_GSTIN',
    erpFieldType: 'String',
    direction: 'BIDIRECTIONAL',
    targetEntity: 'SalesInvoiceHeadersV2',
    targetDynamicsField: 'SalesInvoiceHeaderV2.GSTIN',
    transformation: 'UPPERCASE',
    fallbackValue: '33AAAAA0000A1Z5',
    isRequired: true,
    status: 'ACTIVE',
    description: 'Customer GSTIN for tax invoice validation'
  },
  {
    id: 'fo-4',
    customErpField: 'Custom_HSN_SAC_Code',
    erpFieldType: 'String',
    direction: 'IMPORT',
    targetEntity: 'SalesInvoiceLinesV2',
    targetDynamicsField: 'SalesInvoiceLineV2.HSNCode',
    transformation: 'TRIM',
    fallbackValue: '998311',
    isRequired: true,
    status: 'ACTIVE',
    description: '6-to-8 digit Harmonized System Nomenclature code'
  },
  {
    id: 'fo-5',
    customErpField: 'FFO_Header_Invoice_Val',
    erpFieldType: 'Number',
    direction: 'IMPORT',
    targetEntity: 'SalesInvoiceHeadersV2',
    targetDynamicsField: 'SalesInvoiceHeaderV2.InvoiceAmount',
    transformation: 'CURRENCY_ROUND',
    fallbackValue: '0.00',
    isRequired: true,
    status: 'ACTIVE',
    description: 'Gross invoice value including CGST/SGST/IGST'
  }
];

const INITIAL_TALLY_RULES: FieldMappingRule[] = [
  {
    id: 'tally-1',
    customErpField: 'voucher_number',
    erpFieldType: 'String',
    direction: 'BIDIRECTIONAL',
    targetEntity: 'SalesVouchers',
    targetDynamicsField: 'Invoice Number',
    transformation: 'TRIM',
    fallbackValue: 'INV-TALLY-001',
    isRequired: true,
    status: 'ACTIVE',
    description: 'Unique Tally Prime voucher invoice ID'
  },
  {
    id: 'tally-2',
    customErpField: 'doc_date',
    erpFieldType: 'Date',
    direction: 'IMPORT',
    targetEntity: 'SalesVouchers',
    targetDynamicsField: 'Invoice Date',
    transformation: 'DATE_ISO',
    fallbackValue: 'CURRENT_DATE',
    isRequired: true,
    status: 'ACTIVE',
    description: 'Tally transaction posting date'
  },
  {
    id: 'tally-3',
    customErpField: 'party_gstin_id',
    erpFieldType: 'String',
    direction: 'BIDIRECTIONAL',
    targetEntity: 'SalesVouchers',
    targetDynamicsField: 'Customer GSTIN',
    transformation: 'UPPERCASE',
    fallbackValue: '27AAACN8301B1Z2',
    isRequired: true,
    status: 'ACTIVE',
    description: '15-digit GSTIN tax registration number'
  },
  {
    id: 'tally-4',
    customErpField: 'assessable_amt',
    erpFieldType: 'Number',
    direction: 'IMPORT',
    targetEntity: 'SalesVouchers',
    targetDynamicsField: 'Taxable Value',
    transformation: 'CURRENCY_ROUND',
    fallbackValue: '0.00',
    isRequired: true,
    status: 'ACTIVE',
    description: 'Net taxable assessable value'
  },
  {
    id: 'tally-5',
    customErpField: 'total_tax_amt',
    erpFieldType: 'Number',
    direction: 'IMPORT',
    targetEntity: 'SalesVouchers',
    targetDynamicsField: 'Tax Amount',
    transformation: 'CURRENCY_ROUND',
    fallbackValue: '0.00',
    isRequired: true,
    status: 'ACTIVE',
    description: 'Combined GST tax liability amount'
  },
  {
    id: 'tally-6',
    customErpField: 'irn_no',
    erpFieldType: 'String',
    direction: 'EXPORT',
    targetEntity: 'SalesVouchers',
    targetDynamicsField: 'irn_no',
    transformation: 'UPPERCASE',
    fallbackValue: '',
    isRequired: false,
    status: 'ACTIVE',
    description: 'Govt E-Invoice IRN pushed back to Tally XML Narration/UDF'
  }
];

export const FieldMappingConfiguration: React.FC<Props> = ({ erpType, onSaveMappings }) => {
  const normType = (erpType || '').toUpperCase();
  const isTally = normType.includes('TALLY');
  const isBc = normType.includes('BC') || normType.includes('BUSINESS_CENTRAL');
  const isFo = normType.includes('FO') || normType.includes('DYNAMICS_FO');
  const isSap = normType.includes('SAP');
  const isOracle = normType.includes('ORACLE') || normType.includes('NETSUITE');
  const isZoho = normType.includes('ZOHO');
  const isQb = normType.includes('QB') || normType.includes('QUICKBOOKS');
  const isXero = normType.includes('XERO');

  const entityList = isTally ? DEFAULT_TALLY_ENTITIES 
    : isSap ? DEFAULT_SAP_ENTITIES
    : isOracle ? DEFAULT_ORACLE_ENTITIES
    : isZoho ? DEFAULT_ZOHO_ENTITIES
    : isQb ? DEFAULT_QB_ENTITIES
    : isXero ? DEFAULT_XERO_ENTITIES
    : isBc ? DEFAULT_BC_ENTITIES 
    : DEFAULT_FO_ENTITIES;

  const standardFieldsMap = isTally ? STANDARD_TALLY_FIELDS : isBc ? STANDARD_BC_FIELDS : STANDARD_FO_FIELDS;

  const [selectedEntity, setSelectedEntity] = useState<string>(entityList[0]?.id || 'salesInvoices');
  const [rules, setRules] = useState<FieldMappingRule[]>(isTally ? INITIAL_TALLY_RULES : isBc ? INITIAL_BC_RULES : INITIAL_FO_RULES);
  const [searchTerm, setSearchTerm] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'IMPORT' | 'EXPORT' | 'BIDIRECTIONAL'>('ALL');
  const [copiedJson, setCopiedJson] = useState(false);

  // New Rule Modal / Drawer State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<FieldMappingRule | null>(null);

  // Form State
  const [formCustomErpField, setFormCustomErpField] = useState('');
  const [formErpType, setFormErpType] = useState<'String' | 'Number' | 'Date' | 'Boolean' | 'Object'>('String');
  const [formDirection, setFormDirection] = useState<'IMPORT' | 'EXPORT' | 'BIDIRECTIONAL'>('IMPORT');
  const [formTargetEntity, setFormTargetEntity] = useState(selectedEntity);
  const [formTargetField, setFormTargetField] = useState('');
  const [formTransformation, setFormTransformation] = useState<FieldMappingRule['transformation']>('PASS_THROUGH');
  const [formFallbackValue, setFormFallbackValue] = useState('');
  const [formIsRequired, setFormIsRequired] = useState(true);
  const [formDescription, setFormDescription] = useState('');

  // Live Tester Workbench State
  const [testInputJson, setTestInputJson] = useState<string>(
    JSON.stringify(
      {
        Custom_Invoice_DocNo: 'inv-2026-0941',
        ERP_Txn_Date: '2026-08-26',
        Client_GSTIN_Number: '27aaaaa0000a1z5',
        Base_Taxable_Amt: 154000.758,
        Calculated_GST_Total: 27720.136,
        Dest_State_Tin: '27'
      },
      null,
      2
    )
  );
  const [testOutput, setTestOutput] = useState<Record<string, any> | null>(null);
  const [testExecuted, setTestExecuted] = useState(false);

  // Filtered Rules
  const filteredRules = rules.filter(r => {
    const matchesEntity = r.targetEntity === selectedEntity || selectedEntity === 'ALL_ENTITIES';
    const matchesSearch =
      r.customErpField.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.targetDynamicsField.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDirection = directionFilter === 'ALL' || r.direction === directionFilter;
    return matchesEntity && matchesSearch && matchesDirection;
  });

  const handleOpenAddModal = (ruleToEdit?: FieldMappingRule) => {
    if (ruleToEdit) {
      setEditingRule(ruleToEdit);
      setFormCustomErpField(ruleToEdit.customErpField);
      setFormErpType(ruleToEdit.erpFieldType);
      setFormDirection(ruleToEdit.direction);
      setFormTargetEntity(ruleToEdit.targetEntity);
      setFormTargetField(ruleToEdit.targetDynamicsField);
      setFormTransformation(ruleToEdit.transformation);
      setFormFallbackValue(ruleToEdit.fallbackValue);
      setFormIsRequired(ruleToEdit.isRequired);
      setFormDescription(ruleToEdit.description || '');
    } else {
      setEditingRule(null);
      setFormCustomErpField('');
      setFormErpType('String');
      setFormDirection('IMPORT');
      setFormTargetEntity(selectedEntity);
      const availFields = standardFieldsMap[selectedEntity] || [];
      setFormTargetField(availFields[0] || '');
      setFormTransformation('PASS_THROUGH');
      setFormFallbackValue('');
      setFormIsRequired(true);
      setFormDescription('');
    }
    setIsAddModalOpen(true);
  };

  const handleSaveRule = () => {
    if (!formCustomErpField.trim() || !formTargetField.trim()) return;

    if (editingRule) {
      const updated = rules.map(r =>
        r.id === editingRule.id
          ? {
              ...r,
              customErpField: formCustomErpField.trim(),
              erpFieldType: formErpType,
              direction: formDirection,
              targetEntity: formTargetEntity,
              targetDynamicsField: formTargetField.trim(),
              transformation: formTransformation,
              fallbackValue: formFallbackValue.trim(),
              isRequired: formIsRequired,
              description: formDescription.trim()
            }
          : r
      );
      setRules(updated);
      if (onSaveMappings) onSaveMappings(updated);
    } else {
      const newRule: FieldMappingRule = {
        id: `rule-${Date.now()}`,
        customErpField: formCustomErpField.trim(),
        erpFieldType: formErpType,
        direction: formDirection,
        targetEntity: formTargetEntity,
        targetDynamicsField: formTargetField.trim(),
        transformation: formTransformation,
        fallbackValue: formFallbackValue.trim(),
        isRequired: formIsRequired,
        status: 'ACTIVE',
        description: formDescription.trim()
      };
      const updated = [...rules, newRule];
      setRules(updated);
      if (onSaveMappings) onSaveMappings(updated);
    }

    setIsAddModalOpen(false);
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter(r => r.id !== id);
    setRules(updated);
    if (onSaveMappings) onSaveMappings(updated);
  };

  const handleToggleRequired = (id: string) => {
    const updated = rules.map(r => (r.id === id ? { ...r, isRequired: !r.isRequired } : r));
    setRules(updated);
    if (onSaveMappings) onSaveMappings(updated);
  };

  const handleResetToPreset = () => {
    const defaults = isTally ? INITIAL_TALLY_RULES : isBc ? INITIAL_BC_RULES : INITIAL_FO_RULES;
    setRules(defaults);
    if (onSaveMappings) onSaveMappings(defaults);
  };

  const handleRunTestTransformation = () => {
    try {
      const parsedInput = JSON.parse(testInputJson);
      const entityRules = rules.filter(r => r.targetEntity === selectedEntity);
      const outputPayload: Record<string, any> = {};

      entityRules.forEach(rule => {
        let val = parsedInput[rule.customErpField];
        if (val === undefined || val === null || val === '') {
          val = rule.fallbackValue || null;
        }

        if (val !== null && val !== undefined) {
          switch (rule.transformation) {
            case 'UPPERCASE':
              val = String(val).toUpperCase();
              break;
            case 'LOWERCASE':
              val = String(val).toLowerCase();
              break;
            case 'TRIM':
              val = String(val).trim();
              break;
            case 'DATE_ISO':
              val = new Date(val).toISOString().split('T')[0];
              break;
            case 'CURRENCY_ROUND':
              val = Math.round(Number(val) * 100) / 100;
              break;
            case 'PREFIX_IN':
              val = String(val).startsWith('IN-') ? val : `IN-${val}`;
              break;
            default:
              break;
          }
        }

        outputPayload[rule.targetDynamicsField] = val;
      });

      setTestOutput(outputPayload);
      setTestExecuted(true);
    } catch (err) {
      setTestOutput({ error: 'Invalid Input JSON format. Please format as valid JSON.' });
      setTestExecuted(true);
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(rules, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="space-y-6 text-xs">
      {/* Top Banner Header */}
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${isTally ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950' : isBc ? 'bg-indigo-50/70 border-indigo-200/80 text-indigo-950' : 'bg-blue-50/70 border-blue-200/80 text-blue-950'}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg shrink-0 ${isTally ? 'bg-emerald-600 text-white' : isBc ? 'bg-indigo-600 text-white' : 'bg-blue-600 text-white'}`}>
            <Sliders size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              Field Mapping Configuration Engine
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isTally ? 'bg-emerald-100 text-emerald-800' : isBc ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800'}`}>
                {isTally ? 'Tally Prime XML & ODBC Protocol' : isBc ? 'MS Dynamics 365 Business Central OData' : 'MS Dynamics 365 F&O Data Entities'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-600 mt-0.5">
              {isTally ? 'Map Tally Prime XML tags and User-Defined Fields (UDF) directly to TaxFlow canonical schema with bidirectional transformation rules.' : 'Map legacy & custom ERP payload fields directly to standard Microsoft Dynamics schema attributes with real-time transformations and fallback validation rules.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyJson}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            {copiedJson ? <Check size={14} className="text-emerald-600" /> : <FileJson size={14} className="text-slate-500" />}
            {copiedJson ? 'Copied Rules!' : 'Export JSON'}
          </button>
          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            className={`px-3.5 py-1.5 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-sm transition-all ${isTally ? 'bg-emerald-600 hover:bg-emerald-700' : isBc ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            <Plus size={14} /> Add Field Mapping
          </button>
        </div>
      </div>

      {/* Target Entity Navigation & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Database size={12} /> Target Entity:
          </span>
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
          >
            {entityList.map(ent => (
              <option key={ent.id} value={ent.id}>
                {ent.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search custom or Dynamics field..."
              className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value as any)}
            className="h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600"
          >
            <option value="ALL">All Sync Directions</option>
            <option value="IMPORT">Import (ERP → Dynamics)</option>
            <option value="EXPORT">Export (Dynamics → ERP)</option>
            <option value="BIDIRECTIONAL">Bidirectional ⇄</option>
          </select>

          <button
            type="button"
            onClick={handleResetToPreset}
            title="Reset to Factory Presets"
            className="p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Mapping Rules Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-3">Source Custom ERP Field</th>
              <th className="p-3 text-center">Sync Flow</th>
              <th className="p-3">Standard Dynamics Field</th>
              <th className="p-3">Transformation Rule</th>
              <th className="p-3">Fallback Default</th>
              <th className="p-3 text-center">Required</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredRules.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  <div className="space-y-2">
                    <Database size={24} className="mx-auto text-slate-300" />
                    <p className="font-semibold text-xs">No field mappings defined for entity '{selectedEntity}'</p>
                    <button
                      onClick={() => handleOpenAddModal()}
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-700 font-bold rounded-lg hover:bg-indigo-100"
                    >
                      + Add First Mapping
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRules.map(rule => (
                <tr key={rule.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="p-3">
                    <div className="font-bold text-slate-900 font-mono text-[11px] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                      {rule.customErpField}
                    </div>
                    <div className="text-[10px] text-slate-400 font-sans flex items-center gap-2 mt-0.5">
                      <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-mono text-[9px]">
                        {rule.erpFieldType}
                      </span>
                      {rule.description && <span className="truncate max-w-[200px]">{rule.description}</span>}
                    </div>
                  </td>

                  <td className="p-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                        rule.direction === 'IMPORT'
                          ? 'bg-blue-50 text-blue-700 border border-blue-100'
                          : rule.direction === 'EXPORT'
                          ? 'bg-amber-50 text-amber-700 border border-amber-100'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      }`}
                    >
                      {rule.direction === 'IMPORT' && <ArrowRight size={10} />}
                      {rule.direction === 'EXPORT' && <ArrowRight size={10} className="rotate-180" />}
                      {rule.direction === 'BIDIRECTIONAL' && <ArrowLeftRight size={10} />}
                      {rule.direction}
                    </span>
                  </td>

                  <td className="p-3 font-mono">
                    <div className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-indigo-900 font-bold text-[11px] flex items-center gap-1.5">
                      <Database size={12} className={isBc ? 'text-indigo-600' : 'text-blue-600'} />
                      {rule.targetDynamicsField}
                    </div>
                  </td>

                  <td className="p-3">
                    <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded-md font-bold text-[10px] border border-slate-200 uppercase">
                      ⚡ {rule.transformation}
                    </span>
                  </td>

                  <td className="p-3 font-mono text-slate-500 text-[11px]">
                    {rule.fallbackValue ? (
                      <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 font-semibold">{rule.fallbackValue}</span>
                    ) : (
                      <span className="text-slate-300 italic">None</span>
                    )}
                  </td>

                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleToggleRequired(rule.id)}
                      className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-200 inline-block ${
                        rule.isRequired ? (isBc ? 'bg-indigo-600' : 'bg-blue-600') : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`bg-white w-3 h-3 rounded-full shadow-sm transform transition-transform duration-200 ${
                          rule.isRequired ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      ></div>
                    </button>
                  </td>

                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenAddModal(rule)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit Field Mapping"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Field Mapping"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Interactive Transformation Workbench & Tester */}
      <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Code size={16} className="text-indigo-400" />
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-200">
              Live Schema Transformation & Output Tester Workbench
            </h4>
          </div>
          <button
            type="button"
            onClick={handleRunTestTransformation}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm ${
              isBc ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            <Play size={12} /> Run Test Simulation
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Sample Custom ERP Input (JSON)</span>
              <span className="text-slate-500">Edit values to test mappings</span>
            </label>
            <textarea
              rows={6}
              value={testInputJson}
              onChange={(e) => setTestInputJson(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-emerald-400 font-mono text-[11px] focus:outline-none focus:border-indigo-500 leading-relaxed"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Simulated Microsoft Dynamics Payload Output</span>
              {testExecuted && <span className="text-emerald-400 font-bold">✓ Transformation Passed</span>}
            </label>
            <div className="w-full h-[142px] p-2.5 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px] text-indigo-300 overflow-y-auto leading-relaxed">
              {testOutput ? (
                <pre>{JSON.stringify(testOutput, null, 2)}</pre>
              ) : (
                <span className="text-slate-600 italic">Click 'Run Test Simulation' to preview mapped OData JSON payload...</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Field Rule Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Sliders size={16} className={isBc ? 'text-indigo-600' : 'text-blue-600'} />
                {editingRule ? 'Edit Field Mapping Rule' : 'Add Custom ERP Field Mapping'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Target Entity</label>
                  <select
                    value={formTargetEntity}
                    onChange={(e) => {
                      setFormTargetEntity(e.target.value);
                      const avail = standardFieldsMap[e.target.value] || [];
                      setFormTargetField(avail[0] || '');
                    }}
                    className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                  >
                    {entityList.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Sync Direction</label>
                  <select
                    value={formDirection}
                    onChange={(e) => setFormDirection(e.target.value as any)}
                    className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                  >
                    <option value="IMPORT">Import (ERP → Dynamics)</option>
                    <option value="EXPORT">Export (Dynamics → ERP)</option>
                    <option value="BIDIRECTIONAL">Bidirectional ⇄</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Custom ERP Source Field</label>
                  <input
                    value={formCustomErpField}
                    onChange={(e) => setFormCustomErpField(e.target.value)}
                    placeholder="e.g. ERP_Voucher_No"
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-lg font-mono font-semibold focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Field Data Type</label>
                  <select
                    value={formErpType}
                    onChange={(e) => setFormErpType(e.target.value as any)}
                    className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                  >
                    <option value="String">String (Text)</option>
                    <option value="Number">Number (Decimal/Int)</option>
                    <option value="Date">Date (ISO 8601)</option>
                    <option value="Boolean">Boolean (True/False)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Dynamics Target Entity Field</label>
                <div className="space-y-1">
                  <select
                    value={formTargetField}
                    onChange={(e) => setFormTargetField(e.target.value)}
                    className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-indigo-900"
                  >
                    {(standardFieldsMap[formTargetEntity] || []).map(f => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                    <option value="custom">-- Specify Custom Dynamics Extension Attribute --</option>
                  </select>
                  {formTargetField === 'custom' && (
                    <input
                      placeholder="Enter custom OData property name"
                      onChange={(e) => setFormTargetField(e.target.value)}
                      className="w-full h-9 px-2.5 border border-slate-200 rounded-lg font-mono text-[11px] mt-1"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Transformation Pipeline</label>
                  <select
                    value={formTransformation}
                    onChange={(e) => setFormTransformation(e.target.value as any)}
                    className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                  >
                    <option value="PASS_THROUGH">Pass-Through (As Is)</option>
                    <option value="UPPERCASE">UPPERCASE Text</option>
                    <option value="LOWERCASE">lowercase Text</option>
                    <option value="TRIM">Trim Whitespace</option>
                    <option value="DATE_ISO">Date Format (YYYY-MM-DD)</option>
                    <option value="CURRENCY_ROUND">Currency Rounding (.00)</option>
                    <option value="PREFIX_IN">Add State Code Prefix (IN-)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Fallback / Default Value</label>
                  <input
                    value={formFallbackValue}
                    onChange={(e) => setFormFallbackValue(e.target.value)}
                    placeholder="e.g. 0.00 or IN-MH"
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Description / Audit Notes</label>
                <input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Purpose of this field mapping..."
                  className="w-full h-9 px-2.5 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsRequired}
                    onChange={(e) => setFormIsRequired(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-bold text-slate-700">Required Field Validation</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-3 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveRule}
                    className={`px-4 py-2 text-white font-bold rounded-xl shadow-sm transition-all ${
                      isBc ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {editingRule ? 'Update Mapping' : 'Save New Rule'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
