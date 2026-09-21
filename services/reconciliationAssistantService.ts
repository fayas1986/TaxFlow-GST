import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  GSTR2BMatchingConfig,
  DEFAULT_GSTR2B_MATCHING_CONFIG,
  GSTR2BMatchResultItem,
  GSTR2BMatchStatus,
  GSTR2BPortalRecord,
  InternalLedgerEntry,
  FiveWayMatchDetails
} from './gstEngine/gstr2bMatchingService';

export interface PurchaseInvoiceInput {
  id: string;
  voucherNumber?: string;
  invoiceNumber: string;
  invoiceDate: string;
  supplierName: string;
  supplierGstin: string;
  placeOfSupply?: string;
  taxableAmount: number;
  taxRate?: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess?: number;
  totalTax: number;
  totalInvoiceValue: number;
  ledgerAccount?: string;
  isSec17Blocked?: boolean;
  blockedReason?: string;
  itcEligibility?: 'INPUTS' | 'CAPITAL_GOODS' | 'INPUT_SERVICES' | 'INELIGIBLE_17_5';
  paymentStatus?: 'PAID' | 'PAYMENT_HELD' | 'PENDING' | 'OVERDUE';
}

export interface ReconciliationAssistantSummary {
  totalPurchaseInvoices: number;
  totalGstr2bRecords: number;
  totalPurchaseTaxAmount: number;
  totalGstr2bTaxAmount: number;
  totalPurchaseTaxable: number;
  totalGstr2bTaxable: number;
  
  // Categorized counts
  exactMatchesCount: number;
  amountMismatchesCount: number;
  taxHeadMismatchesCount: number;
  dateMismatchesCount: number;
  missingInGstr2bCount: number;
  missingInBooksCount: number;
  sec17BlockedCount: number;
  
  // Financial metrics
  claimableItcAmount: number;
  atRiskItcAmount: number;
  unclaimedItcAmount: number;
  blockedItcAmount: number;
  taxDifferenceAmount: number;
  reconciliationMatchRate: number; // 0-100%

  // GSTR-3B Table 4 computed values
  gstr3bTable4: {
    table4A5_EligibleItc: number;
    table4B1_PermanentReversal17_5: number;
    table4B2_TemporaryReversals: number;
    table4C_NetItcAvailable: number;
  };
}

export interface SupplierNoticeData {
  supplierName: string;
  supplierGstin: string;
  invoiceNumber: string;
  invoiceDate: string;
  taxableAmount: number;
  taxAmount: number;
  issueDescription: string;
  recommendedResolution: string;
  statutoryDeadline: string;
  buyerName: string;
  buyerGstin: string;
  contactEmail?: string;
  contactPhone?: string;
}

/**
 * Parses user-uploaded Excel or CSV file into PurchaseInvoiceInput array
 */
export async function parsePurchaseRegisterFile(file: File): Promise<PurchaseInvoiceInput[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  return rows.map((row, idx) => {
    // Flexible header mapping for various ERP export formats (Tally, SAP, Zoho, Busy, ClearTax)
    const invoiceNumber = String(
      row['Invoice Number'] || row['Invoice No'] || row['InvoiceNo'] || row['Inv No'] || row['Doc No'] || `INV-${idx + 1}`
    ).trim();
    const invoiceDate = String(
      row['Invoice Date'] || row['Date'] || row['Inv Date'] || row['Document Date'] || new Date().toISOString().split('T')[0]
    ).trim();
    const supplierName = String(
      row['Supplier Name'] || row['Party Name'] || row['Vendor Name'] || row['Party'] || 'Unknown Supplier'
    ).trim();
    const supplierGstin = String(
      row['Supplier GSTIN'] || row['GSTIN'] || row['GSTIN/UIN'] || row['Vendor GSTIN'] || ''
    ).trim().toUpperCase();

    const taxableAmount = Number(
      row['Taxable Value'] || row['Taxable Amount'] || row['Taxable'] || row['Amount'] || 0
    );
    const igst = Number(row['IGST'] || row['Integrated Tax'] || 0);
    const cgst = Number(row['CGST'] || row['Central Tax'] || 0);
    const sgst = Number(row['SGST'] || row['State Tax'] || row['UTGST'] || 0);
    const cess = Number(row['Cess'] || row['CESS'] || 0);
    const totalTax = Number(row['Total Tax'] || row['Tax Amount'] || (igst + cgst + sgst + cess));
    const totalInvoiceValue = Number(
      row['Total Value'] || row['Total Amount'] || row['Invoice Total'] || (taxableAmount + totalTax)
    );

    const isSec17Blocked = String(row['Blocked ITC'] || row['Is Blocked'] || '').toLowerCase().includes('yes') ||
      String(row['Section 17(5)'] || '').toLowerCase().includes('yes');

    return {
      id: `purch-upl-${idx + 1}-${Date.now().toString(36)}`,
      voucherNumber: String(row['Voucher No'] || row['Voucher Number'] || `PV-${idx + 1}`),
      invoiceNumber,
      invoiceDate,
      supplierName,
      supplierGstin,
      placeOfSupply: String(row['Place of Supply'] || row['POS'] || '27-Maharashtra'),
      taxableAmount,
      taxRate: Number(row['Tax Rate'] || row['Rate'] || 18),
      cgst,
      sgst,
      igst,
      cess,
      totalTax,
      totalInvoiceValue,
      ledgerAccount: String(row['Ledger Account'] || row['Expense Category'] || 'General Purchases'),
      isSec17Blocked,
      blockedReason: isSec17Blocked ? 'Flagged in input file' : undefined,
      itcEligibility: isSec17Blocked ? 'INELIGIBLE_17_5' : 'INPUTS',
      paymentStatus: 'PAID'
    };
  });
}

/**
 * Parses user-uploaded GSTR-2B JSON or Excel file into GSTR2BPortalRecord array
 */
export async function parseGstr2bFile(file: File): Promise<GSTR2BPortalRecord[]> {
  const fileName = file.name.toLowerCase();

  // Handle JSON file format (Official GST Portal GSTR-2B JSON dump)
  if (fileName.endsWith('.json')) {
    const text = await file.text();
    const json = JSON.parse(text);
    const records: GSTR2BPortalRecord[] = [];

    // Parse B2B section if present
    const b2bList = json?.data?.docdata?.b2b || json?.b2b || [];
    b2bList.forEach((supp: any, suppIdx: number) => {
      const gstin = supp.ctin || supp.gstin || '';
      const supplierName = supp.trdnm || supp.legal_name || `Supplier ${suppIdx + 1}`;
      const invList = supp.inv || supp.invoices || [];

      invList.forEach((inv: any, invIdx: number) => {
        let taxableValue = 0;
        let igst = 0;
        let cgst = 0;
        let sgst = 0;
        let cess = 0;

        (inv.items || inv.itms || []).forEach((itm: any) => {
          const det = itm.itm_det || itm;
          taxableValue += Number(det.txval || 0);
          igst += Number(det.iamt || 0);
          cgst += Number(det.camt || 0);
          sgst += Number(det.samt || 0);
          cess += Number(det.csamt || 0);
        });

        records.push({
          id: `2b-json-${suppIdx}-${invIdx}-${Date.now().toString(36)}`,
          gstin,
          supplierName,
          invoiceNumber: String(inv.inum || inv.invoiceNumber || `INV-${suppIdx}-${invIdx}`),
          invoiceDate: String(inv.dt || inv.invoiceDate || new Date().toISOString().split('T')[0]),
          invoiceType: (inv.inv_typ as any) || 'B2B',
          taxableValue,
          igst,
          cgst,
          sgst,
          cess,
          totalTax: igst + cgst + sgst + cess,
          gstr1FilingDate: inv.filingDate || '2026-09-11',
          gstr1FilingPeriod: inv.filingPeriod || '082026',
          itcAvailability: inv.itcavlbl === 'N' ? 'INELIGIBLE' : 'ELIGIBLE',
          placeOfSupply: inv.pos || '27-Maharashtra',
          supplierFilingStatus: 'ON_TIME'
        });
      });
    });

    if (records.length > 0) return records;
  }

  // Fallback / Excel parsing
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  return rows.map((row, idx) => {
    const taxableValue = Number(row['Taxable Value'] || row['Taxable Amount'] || row['txval'] || 0);
    const igst = Number(row['IGST'] || row['Integrated Tax'] || row['iamt'] || 0);
    const cgst = Number(row['CGST'] || row['Central Tax'] || row['camt'] || 0);
    const sgst = Number(row['SGST'] || row['State Tax'] || row['samt'] || 0);
    const cess = Number(row['Cess'] || row['csamt'] || 0);

    return {
      id: `2b-upl-${idx + 1}-${Date.now().toString(36)}`,
      gstin: String(row['GSTIN of Supplier'] || row['Supplier GSTIN'] || row['GSTIN'] || '').trim().toUpperCase(),
      supplierName: String(row['Trade/Legal Name'] || row['Supplier Name'] || row['Party Name'] || 'Portal Supplier').trim(),
      invoiceNumber: String(row['Invoice Number'] || row['Invoice No'] || row['inum'] || `INV-${idx + 1}`).trim(),
      invoiceDate: String(row['Invoice Date'] || row['Date'] || row['dt'] || new Date().toISOString().split('T')[0]).trim(),
      invoiceType: 'B2B',
      taxableValue,
      igst,
      cgst,
      sgst,
      cess,
      totalTax: igst + cgst + sgst + cess,
      gstr1FilingDate: String(row['GSTR-1 Filing Date'] || '2026-09-11'),
      gstr1FilingPeriod: '082026',
      itcAvailability: String(row['ITC Availability'] || '').toUpperCase() === 'NO' ? 'INELIGIBLE' : 'ELIGIBLE',
      placeOfSupply: String(row['Place of Supply'] || '27-Maharashtra'),
      supplierFilingStatus: 'ON_TIME'
    };
  });
}

/**
 * Benchmark Enterprise Invoices & GSTR-2B datasets for immediate walkthrough
 */
export function generateReconciliationAssistantBenchmarkDataset(period: string = 'August 2026'): {
  purchaseInvoices: PurchaseInvoiceInput[];
  gstr2bRecords: GSTR2BPortalRecord[];
} {
  const prefixDate = '2026-08';

  const purchaseInvoices: PurchaseInvoiceInput[] = [
    // 1. Exact Match
    {
      id: 'purch-001',
      voucherNumber: 'PV/202608/001',
      invoiceNumber: 'TCS-CONS-8821',
      invoiceDate: `${prefixDate}-02`,
      supplierName: 'Tata Consultancy Services Ltd',
      supplierGstin: '27AAACT2727Q1ZW',
      placeOfSupply: '27-Maharashtra',
      taxableAmount: 450000,
      taxRate: 18,
      cgst: 40500,
      sgst: 40500,
      igst: 0,
      cess: 0,
      totalTax: 81000,
      totalInvoiceValue: 531000,
      ledgerAccount: 'IT & Software Consulting',
      itcEligibility: 'INPUT_SERVICES',
      paymentStatus: 'PAID'
    },
    // 2. Exact Match - Inter-state
    {
      id: 'purch-002',
      voucherNumber: 'PV/202608/002',
      invoiceNumber: 'INF-BLR-1092',
      invoiceDate: `${prefixDate}-04`,
      supplierName: 'Infosys BPM Limited',
      supplierGstin: '29AABCI1234K1ZV',
      placeOfSupply: '27-Maharashtra',
      taxableAmount: 220000,
      taxRate: 18,
      cgst: 0,
      sgst: 0,
      igst: 39600,
      cess: 0,
      totalTax: 39600,
      totalInvoiceValue: 259600,
      ledgerAccount: 'Cloud Support & Backoffice',
      itcEligibility: 'INPUT_SERVICES',
      paymentStatus: 'PAID'
    },
    // 3. Amount Mismatch (Supplier reported lower tax in GSTR-1)
    {
      id: 'purch-003',
      voucherNumber: 'PV/202608/003',
      invoiceNumber: 'LGT-DEL-4419',
      invoiceDate: `${prefixDate}-05`,
      supplierName: 'Blue Dart Express Freight Ltd',
      supplierGstin: '27AAACB2014P1ZV',
      placeOfSupply: '27-Maharashtra',
      taxableAmount: 64000,
      taxRate: 18,
      cgst: 5760,
      sgst: 5760,
      igst: 0,
      cess: 0,
      totalTax: 11520,
      totalInvoiceValue: 75520,
      ledgerAccount: 'Freight & Logistics Outward',
      itcEligibility: 'INPUT_SERVICES',
      paymentStatus: 'PENDING'
    },
    // 4. Fuzzy Invoice Number & Minor Date Variance
    {
      id: 'purch-004',
      voucherNumber: 'PV/202608/004',
      invoiceNumber: 'SHK/PKG/2026/5512',
      invoiceDate: `${prefixDate}-07`,
      supplierName: 'Shree Krishna Packaging Industries',
      supplierGstin: '24AAECS9912K1Z3',
      placeOfSupply: '27-Maharashtra',
      taxableAmount: 92000,
      taxRate: 12,
      cgst: 0,
      sgst: 0,
      igst: 11040,
      cess: 0,
      totalTax: 11040,
      totalInvoiceValue: 103040,
      ledgerAccount: 'Packaging Materials',
      itcEligibility: 'INPUTS',
      paymentStatus: 'PAID'
    },
    // 5. Section 17(5) Blocked ITC (Motor Vehicle)
    {
      id: 'purch-005',
      voucherNumber: 'PV/202608/005',
      invoiceNumber: 'AUTO-SERV-2201',
      invoiceDate: `${prefixDate}-09`,
      supplierName: 'Apex Motor Fleet Services Pvt Ltd',
      supplierGstin: '27AAACA9812M1Z0',
      placeOfSupply: '27-Maharashtra',
      taxableAmount: 58000,
      taxRate: 18,
      cgst: 5220,
      sgst: 5220,
      igst: 0,
      cess: 0,
      totalTax: 10440,
      totalInvoiceValue: 68440,
      ledgerAccount: 'Executive Fleet Maintenance',
      isSec17Blocked: true,
      blockedReason: 'Motor vehicle servicing and maintenance blocked under Section 17(5)(a)',
      itcEligibility: 'INELIGIBLE_17_5',
      paymentStatus: 'PAID'
    },
    // 6. Missing in GSTR-2B (Supplier did not file GSTR-1 - High Risk!)
    {
      id: 'purch-006',
      voucherNumber: 'PV/202608/006',
      invoiceNumber: 'UNFILED-CHEM-881',
      invoiceDate: `${prefixDate}-12`,
      supplierName: 'Vanguard Industrial Chemicals LLP',
      supplierGstin: '27AABCV5512D1ZR',
      placeOfSupply: '27-Maharashtra',
      taxableAmount: 180000,
      taxRate: 18,
      cgst: 16200,
      sgst: 16200,
      igst: 0,
      cess: 0,
      totalTax: 32400,
      totalInvoiceValue: 212400,
      ledgerAccount: 'Raw Materials & Reagents',
      itcEligibility: 'INPUTS',
      paymentStatus: 'PAYMENT_HELD'
    },
    // 7. Missing in GSTR-2B (Capital Equipment Supplier delayed filing)
    {
      id: 'purch-007',
      voucherNumber: 'PV/202608/007',
      invoiceNumber: 'MACH-IND-9021',
      invoiceDate: `${prefixDate}-14`,
      supplierName: 'Precision CNC Machinery Works',
      supplierGstin: '27AAACP4412B1ZX',
      placeOfSupply: '27-Maharashtra',
      taxableAmount: 650000,
      taxRate: 18,
      cgst: 58500,
      sgst: 58500,
      igst: 0,
      cess: 0,
      totalTax: 117000,
      totalInvoiceValue: 767000,
      ledgerAccount: 'Plant & Machinery Additions',
      itcEligibility: 'CAPITAL_GOODS',
      paymentStatus: 'PENDING'
    },
    // 8. Section 17(5) Blocked (Food & Catering)
    {
      id: 'purch-008',
      voucherNumber: 'PV/202608/008',
      invoiceNumber: 'CAT-ROYAL-771',
      invoiceDate: `${prefixDate}-17`,
      supplierName: 'Royal Gourmet Hospitality Ltd',
      supplierGstin: '27AABCR8814E1Z6',
      placeOfSupply: '27-Maharashtra',
      taxableAmount: 42000,
      taxRate: 5,
      cgst: 1050,
      sgst: 1050,
      igst: 0,
      cess: 0,
      totalTax: 2100,
      totalInvoiceValue: 44100,
      ledgerAccount: 'Staff Welfare & Catering',
      isSec17Blocked: true,
      blockedReason: 'Food and beverages catering blocked under Section 17(5)(b)(i)',
      itcEligibility: 'INELIGIBLE_17_5',
      paymentStatus: 'PAID'
    },
    // 9. Exact Match
    {
      id: 'purch-009',
      voucherNumber: 'PV/202608/009',
      invoiceNumber: 'AWS-CLOUD-2608',
      invoiceDate: `${prefixDate}-19`,
      supplierName: 'Amazon Web Services India Pvt Ltd',
      supplierGstin: '27AABCA1299P1ZK',
      placeOfSupply: '27-Maharashtra',
      taxableAmount: 115000,
      taxRate: 18,
      cgst: 10350,
      sgst: 10350,
      igst: 0,
      cess: 0,
      totalTax: 20700,
      totalInvoiceValue: 135700,
      ledgerAccount: 'Cloud Infrastructure & Servers',
      itcEligibility: 'INPUT_SERVICES',
      paymentStatus: 'PAID'
    },
    // 10. Tax Head Mismatch (Books booked Intra-state CGST/SGST, but Supplier filed Inter-state IGST)
    {
      id: 'purch-010',
      voucherNumber: 'PV/202608/010',
      invoiceNumber: 'DEL-NET-8820',
      invoiceDate: `${prefixDate}-22`,
      supplierName: 'Delta Network Solutions India',
      supplierGstin: '07AACCD9921K1ZM',
      placeOfSupply: '27-Maharashtra',
      taxableAmount: 80000,
      taxRate: 18,
      cgst: 7200,
      sgst: 7200,
      igst: 0,
      cess: 0,
      totalTax: 14400,
      totalInvoiceValue: 94400,
      ledgerAccount: 'Networking Equipment & Cabling',
      itcEligibility: 'INPUTS',
      paymentStatus: 'PAID'
    },
    // 11. Date Discrepancy (Supplier filed under July period, Books dated in August)
    {
      id: 'purch-011',
      voucherNumber: 'PV/202608/011',
      invoiceNumber: 'KIR-STEEL-401',
      invoiceDate: `${prefixDate}-25`,
      supplierName: 'Kirloskar Structural Steel Ltd',
      supplierGstin: '27AAACK1902M1Z5',
      placeOfSupply: '27-Maharashtra',
      taxableAmount: 310000,
      taxRate: 18,
      cgst: 27900,
      sgst: 27900,
      igst: 0,
      cess: 0,
      totalTax: 55800,
      totalInvoiceValue: 365800,
      ledgerAccount: 'Raw Material Steel Sections',
      itcEligibility: 'INPUTS',
      paymentStatus: 'PAID'
    }
  ];

  const gstr2bRecords: GSTR2BPortalRecord[] = [
    // 1. Matches purch-001 exactly
    {
      id: '2b-001',
      gstin: '27AAACT2727Q1ZW',
      supplierName: 'Tata Consultancy Services Ltd',
      invoiceNumber: 'TCS-CONS-8821',
      invoiceDate: `${prefixDate}-02`,
      invoiceType: 'B2B',
      taxableValue: 450000,
      cgst: 40500,
      sgst: 40500,
      igst: 0,
      cess: 0,
      totalTax: 81000,
      gstr1FilingDate: `${prefixDate}-11`,
      gstr1FilingPeriod: '082026',
      itcAvailability: 'ELIGIBLE',
      placeOfSupply: '27-Maharashtra',
      supplierFilingStatus: 'ON_TIME'
    },
    // 2. Matches purch-002 exactly
    {
      id: '2b-002',
      gstin: '29AABCI1234K1ZV',
      supplierName: 'Infosys BPM Limited',
      invoiceNumber: 'INF-BLR-1092',
      invoiceDate: `${prefixDate}-04`,
      invoiceType: 'B2B',
      taxableValue: 220000,
      cgst: 0,
      sgst: 0,
      igst: 39600,
      cess: 0,
      totalTax: 39600,
      gstr1FilingDate: `${prefixDate}-11`,
      gstr1FilingPeriod: '082026',
      itcAvailability: 'ELIGIBLE',
      placeOfSupply: '27-Maharashtra',
      supplierFilingStatus: 'ON_TIME'
    },
    // 3. Matches purch-003 with Amount Mismatch (Supplier reported 50k instead of 64k)
    {
      id: '2b-003',
      gstin: '27AAACB2014P1ZV',
      supplierName: 'Blue Dart Express Freight Ltd',
      invoiceNumber: 'LGT-DEL-4419',
      invoiceDate: `${prefixDate}-05`,
      invoiceType: 'B2B',
      taxableValue: 50000,
      cgst: 4500,
      sgst: 4500,
      igst: 0,
      cess: 0,
      totalTax: 9000,
      gstr1FilingDate: `${prefixDate}-10`,
      gstr1FilingPeriod: '082026',
      itcAvailability: 'ELIGIBLE',
      placeOfSupply: '27-Maharashtra',
      supplierFilingStatus: 'ON_TIME'
    },
    // 4. Matches purch-004 with fuzzy invoice format (SHK-PKG-5512 vs SHK/PKG/2026/5512)
    {
      id: '2b-004',
      gstin: '24AAECS9912K1Z3',
      supplierName: 'Shree Krishna Packaging Industries',
      invoiceNumber: 'SHK-PKG-5512',
      invoiceDate: `${prefixDate}-08`,
      invoiceType: 'B2B',
      taxableValue: 92000,
      cgst: 0,
      sgst: 0,
      igst: 11040,
      cess: 0,
      totalTax: 11040,
      gstr1FilingDate: `${prefixDate}-11`,
      gstr1FilingPeriod: '082026',
      itcAvailability: 'ELIGIBLE',
      placeOfSupply: '27-Maharashtra',
      supplierFilingStatus: 'ON_TIME'
    },
    // 5. Matches purch-005 (Apex Motors - blocked u/s 17(5))
    {
      id: '2b-005',
      gstin: '27AAACA9812M1Z0',
      supplierName: 'Apex Motor Fleet Services Pvt Ltd',
      invoiceNumber: 'AUTO-SERV-2201',
      invoiceDate: `${prefixDate}-09`,
      invoiceType: 'B2B',
      taxableValue: 58000,
      cgst: 5220,
      sgst: 5220,
      igst: 0,
      cess: 0,
      totalTax: 10440,
      gstr1FilingDate: `${prefixDate}-11`,
      gstr1FilingPeriod: '082026',
      itcAvailability: 'ELIGIBLE',
      placeOfSupply: '27-Maharashtra',
      supplierFilingStatus: 'ON_TIME'
    },
    // 6. Matches purch-008 (Royal Gourmet Catering)
    {
      id: '2b-006',
      gstin: '27AABCR8814E1Z6',
      supplierName: 'Royal Gourmet Hospitality Ltd',
      invoiceNumber: 'CAT-ROYAL-771',
      invoiceDate: `${prefixDate}-17`,
      invoiceType: 'B2B',
      taxableValue: 42000,
      cgst: 1050,
      sgst: 1050,
      igst: 0,
      cess: 0,
      totalTax: 2100,
      gstr1FilingDate: `${prefixDate}-11`,
      gstr1FilingPeriod: '082026',
      itcAvailability: 'ELIGIBLE',
      placeOfSupply: '27-Maharashtra',
      supplierFilingStatus: 'ON_TIME'
    },
    // 7. Matches purch-009 (AWS Cloud)
    {
      id: '2b-007',
      gstin: '27AABCA1299P1ZK',
      supplierName: 'Amazon Web Services India Pvt Ltd',
      invoiceNumber: 'AWS-CLOUD-2608',
      invoiceDate: `${prefixDate}-19`,
      invoiceType: 'B2B',
      taxableValue: 115000,
      cgst: 10350,
      sgst: 10350,
      igst: 0,
      cess: 0,
      totalTax: 20700,
      gstr1FilingDate: `${prefixDate}-11`,
      gstr1FilingPeriod: '082026',
      itcAvailability: 'ELIGIBLE',
      placeOfSupply: '27-Maharashtra',
      supplierFilingStatus: 'ON_TIME'
    },
    // 8. Matches purch-010 with Tax Head Mismatch (Supplier reported IGST 14,400)
    {
      id: '2b-008',
      gstin: '07AACCD9921K1ZM',
      supplierName: 'Delta Network Solutions India',
      invoiceNumber: 'DEL-NET-8820',
      invoiceDate: `${prefixDate}-22`,
      invoiceType: 'B2B',
      taxableValue: 80000,
      cgst: 0,
      sgst: 0,
      igst: 14400,
      cess: 0,
      totalTax: 14400,
      gstr1FilingDate: `${prefixDate}-11`,
      gstr1FilingPeriod: '082026',
      itcAvailability: 'ELIGIBLE',
      placeOfSupply: '27-Maharashtra',
      supplierFilingStatus: 'ON_TIME'
    },
    // 9. Matches purch-011 with Date variance (Supplier billed on 2026-07-28)
    {
      id: '2b-009',
      gstin: '27AAACK1902M1Z5',
      supplierName: 'Kirloskar Structural Steel Ltd',
      invoiceNumber: 'KIR-STEEL-401',
      invoiceDate: `2026-07-28`,
      invoiceType: 'B2B',
      taxableValue: 310000,
      cgst: 27900,
      sgst: 27900,
      igst: 0,
      cess: 0,
      totalTax: 55800,
      gstr1FilingDate: `${prefixDate}-10`,
      gstr1FilingPeriod: '082026',
      itcAvailability: 'ELIGIBLE',
      placeOfSupply: '27-Maharashtra',
      supplierFilingStatus: 'ON_TIME'
    },
    // 10. Missing in Books (Unclaimed GSTR-2B ITC from Oracle India!)
    {
      id: '2b-010',
      gstin: '27AABCO9912L1ZP',
      supplierName: 'Oracle Software India Private Limited',
      invoiceNumber: 'ORA-SUB-2026-99',
      invoiceDate: `${prefixDate}-15`,
      invoiceType: 'B2B',
      taxableValue: 160000,
      cgst: 14400,
      sgst: 14400,
      igst: 0,
      cess: 0,
      totalTax: 28800,
      gstr1FilingDate: `${prefixDate}-11`,
      gstr1FilingPeriod: '082026',
      itcAvailability: 'ELIGIBLE',
      placeOfSupply: '27-Maharashtra',
      supplierFilingStatus: 'ON_TIME'
    },
    // 11. Missing in Books (Unclaimed GSTR-2B ITC from Godrej Office)
    {
      id: '2b-011',
      gstin: '27AAACG0014H1Z1',
      supplierName: 'Godrej & Boyce Mfg Co Ltd',
      invoiceNumber: 'GB-FURN-4491',
      invoiceDate: `${prefixDate}-21`,
      invoiceType: 'B2B',
      taxableValue: 75000,
      cgst: 6750,
      sgst: 6750,
      igst: 0,
      cess: 0,
      totalTax: 13500,
      gstr1FilingDate: `${prefixDate}-11`,
      gstr1FilingPeriod: '082026',
      itcAvailability: 'ELIGIBLE',
      placeOfSupply: '27-Maharashtra',
      supplierFilingStatus: 'ON_TIME'
    }
  ];

  return { purchaseInvoices, gstr2bRecords };
}

/**
 * Normalizes invoice string for fuzzy comparison
 */
function normalizeInvoice(str: string): string {
  if (!str) return '';
  return str.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '');
}

/**
 * Executes step-by-step reconciliation matching engine
 */
export function executeReconciliationEngine(
  purchases: PurchaseInvoiceInput[],
  portalRecords: GSTR2BPortalRecord[],
  config: GSTR2BMatchingConfig = DEFAULT_GSTR2B_MATCHING_CONFIG
): {
  results: GSTR2BMatchResultItem[];
  summary: ReconciliationAssistantSummary;
} {
  const results: GSTR2BMatchResultItem[] = [];
  const matched2bIds = new Set<string>();

  const dateToleranceDays = config.dateToleranceDays ?? 7;
  const taxAmountTolerance = config.taxAmountTolerance ?? 10;
  const taxableValueTolerance = config.taxableValueTolerance ?? 100;
  const fuzzyInvoiceMatching = config.fuzzyInvoiceMatching ?? true;
  const enforceGstinStrictMatch = config.enforceGstinStrictMatch ?? true;
  const autoTagSec17Blocked = config.autoTagSec17Blocked ?? true;

  let exactMatchesCount = 0;
  let amountMismatchesCount = 0;
  let taxHeadMismatchesCount = 0;
  let dateMismatchesCount = 0;
  let missingInGstr2bCount = 0;
  let missingInBooksCount = 0;
  let sec17BlockedCount = 0;

  let totalPurchaseTaxAmount = 0;
  let totalGstr2bTaxAmount = 0;
  let totalPurchaseTaxable = 0;
  let totalGstr2bTaxable = 0;

  let claimableItcAmount = 0;
  let atRiskItcAmount = 0;
  let unclaimedItcAmount = 0;
  let blockedItcAmount = 0;
  let taxDifferenceAmount = 0;

  // 1. Process all Purchase Invoices against GSTR-2B
  purchases.forEach((purch, idx) => {
    totalPurchaseTaxAmount += purch.totalTax;
    totalPurchaseTaxable += purch.taxableAmount;

    const normPurchNo = normalizeInvoice(purch.invoiceNumber);
    const normPurchGstin = purch.supplierGstin.trim().toUpperCase();

    // Check Section 17(5) blocked condition
    const isBlocked = autoTagSec17Blocked && (
      purch.isSec17Blocked ||
      purch.itcEligibility === 'INELIGIBLE_17_5' ||
      purch.ledgerAccount?.toLowerCase().includes('fleet') ||
      purch.ledgerAccount?.toLowerCase().includes('catering') ||
      purch.ledgerAccount?.toLowerCase().includes('welfare')
    );

    let bestCandidate: GSTR2BPortalRecord | null = null;
    let maxScore = -1;
    let candidateDiscrepancies: string[] = [];
    let bestFiveWay: FiveWayMatchDetails = {
      gstinMatched: false,
      invoiceNoMatched: 'MISMATCH',
      dateMatched: 'MISMATCH',
      taxableValueMatched: 'MISMATCH',
      taxAmountMatched: 'MISMATCH'
    };

    portalRecords.forEach(portal => {
      if (matched2bIds.has(portal.id)) return;

      let score = 0;
      const reasons: string[] = [];
      const fiveWay: FiveWayMatchDetails = {
        gstinMatched: false,
        invoiceNoMatched: 'MISMATCH',
        dateMatched: 'MISMATCH',
        taxableValueMatched: 'MISMATCH',
        taxAmountMatched: 'MISMATCH'
      };

      // 1. GSTIN Match
      const normPortalGstin = portal.gstin.trim().toUpperCase();
      if (normPurchGstin && normPurchGstin === normPortalGstin) {
        fiveWay.gstinMatched = true;
        score += 25;
      } else if (enforceGstinStrictMatch) {
        return;
      } else {
        reasons.push(`GSTIN Mismatch: Books (${normPurchGstin}) vs GSTR-2B (${normPortalGstin})`);
      }

      // 2. Invoice Number Match
      const normPortalNo = normalizeInvoice(portal.invoiceNumber);
      if (normPurchNo === normPortalNo) {
        fiveWay.invoiceNoMatched = 'EXACT';
        score += 30;
      } else if (
        fuzzyInvoiceMatching &&
        (normPurchNo.includes(normPortalNo) || normPortalNo.includes(normPurchNo) ||
         normPurchNo.slice(-4) === normPortalNo.slice(-4)) &&
        Math.min(normPurchNo.length, normPortalNo.length) >= 3
      ) {
        fiveWay.invoiceNoMatched = 'FUZZY';
        score += 20;
        reasons.push(`Fuzzy Invoice Match: Books (${purch.invoiceNumber}) ~ GSTR-2B (${portal.invoiceNumber})`);
      } else {
        reasons.push(`Invoice No. Mismatch: Books (${purch.invoiceNumber}) vs GSTR-2B (${portal.invoiceNumber})`);
      }

      // 3. Invoice Date Match
      let dayDiff = 999;
      try {
        const d1 = new Date(purch.invoiceDate).getTime();
        const d2 = new Date(portal.invoiceDate).getTime();
        dayDiff = Math.abs(Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)));
      } catch {
        dayDiff = 999;
      }

      if (dayDiff === 0) {
        fiveWay.dateMatched = 'EXACT';
        score += 15;
      } else if (dayDiff <= dateToleranceDays) {
        fiveWay.dateMatched = 'TOLERANCE';
        score += 10;
        reasons.push(`Date tolerance variance of ${dayDiff} days (${purch.invoiceDate} vs ${portal.invoiceDate})`);
      } else {
        reasons.push(`Date out of tolerance window (${dayDiff} days)`);
      }

      // 4. Taxable Value Match
      const taxableDiff = Math.abs(purch.taxableAmount - portal.taxableValue);
      if (taxableDiff === 0) {
        fiveWay.taxableValueMatched = 'EXACT';
        score += 15;
      } else if (taxableDiff <= taxableValueTolerance) {
        fiveWay.taxableValueMatched = 'TOLERANCE';
        score += 10;
        reasons.push(`Taxable Value variance within tolerance: ₹${taxableDiff.toFixed(2)}`);
      } else {
        reasons.push(`Taxable Value mismatch: Books ₹${purch.taxableAmount.toLocaleString()} vs GSTR-2B ₹${portal.taxableValue.toLocaleString()} (Diff: ₹${taxableDiff.toFixed(2)})`);
      }

      // 5. Tax Amount & Tax Head Match
      const taxDiff = Math.abs(purch.totalTax - portal.totalTax);
      const taxHeadDiff = (purch.igst > 0 && portal.cgst > 0) || (purch.cgst > 0 && portal.igst > 0);

      if (taxHeadDiff) {
        reasons.push(`Tax Head Mismatch: Books has ${purch.igst > 0 ? 'IGST' : 'CGST+SGST'} while 2B has ${portal.igst > 0 ? 'IGST' : 'CGST+SGST'}`);
      }

      if (taxDiff === 0 && !taxHeadDiff) {
        fiveWay.taxAmountMatched = 'EXACT';
        score += 15;
      } else if (taxDiff <= taxAmountTolerance) {
        fiveWay.taxAmountMatched = 'TOLERANCE';
        score += 10;
        if (taxDiff > 0) reasons.push(`Tax round-off variance: ₹${taxDiff.toFixed(2)}`);
      } else {
        reasons.push(`Tax Amount discrepancy: Books ₹${purch.totalTax.toLocaleString()} vs GSTR-2B ₹${portal.totalTax.toLocaleString()} (Diff: ₹${taxDiff.toFixed(2)})`);
      }

      if (score > maxScore && score >= 40) {
        maxScore = score;
        bestCandidate = portal;
        candidateDiscrepancies = reasons;
        bestFiveWay = fiveWay;
      }
    });

    const purchaseFormatted = {
      id: purch.id,
      voucherNumber: purch.voucherNumber,
      invoiceNumber: purch.invoiceNumber,
      date: purch.invoiceDate,
      partyName: purch.supplierName,
      gstin: purch.supplierGstin,
      ledgerAccount: purch.ledgerAccount,
      placeOfSupply: purch.placeOfSupply,
      taxableValue: purch.taxableAmount,
      taxAmount: purch.totalTax,
      igst: purch.igst,
      cgst: purch.cgst,
      sgst: purch.sgst,
      cess: purch.cess || 0,
      isBlockedItc: isBlocked,
      reasonForBlocked: isBlocked ? (purch.blockedReason || 'Blocked under CGST Act Section 17(5)') : undefined,
      itcEligibility: isBlocked ? 'INELIGIBLE_17_5' : (purch.itcEligibility || 'INPUTS'),
      paymentStatus: purch.paymentStatus || 'PAID'
    };

    if (bestCandidate) {
      matched2bIds.add(bestCandidate.id);
      const taxDiff = purch.totalTax - bestCandidate.totalTax;
      taxDifferenceAmount += Math.abs(taxDiff);

      let status: GSTR2BMatchStatus = 'EXACT_MATCH';
      let discrepancyCategory = 'Matched';
      let statutoryClause = 'CGST Act Section 16(2)(aa) & Rule 36(4) - Fully Compliant';
      let recommendedAction = 'Ready for GSTR-3B Table 4(A)(5) ITC claim.';

      if (isBlocked) {
        status = 'SECTION_17_5_BLOCKED';
        discrepancyCategory = 'Section 17(5) Blocked ITC';
        statutoryClause = 'CGST Act Section 17(5) - Ineligible Inward Supply';
        recommendedAction = 'Reverse under GSTR-3B Table 4(B)(1) - Ineligible ITC.';
        sec17BlockedCount++;
        blockedItcAmount += purch.totalTax;
      } else if (candidateDiscrepancies.some(d => d.includes('Tax Head Mismatch'))) {
        status = 'TAX_HEAD_MISMATCH';
        discrepancyCategory = 'Tax Head Allocation Mismatch (IGST vs CGST/SGST)';
        statutoryClause = 'CGST Act Section 77 & IGST Act Section 19 - Wrong Tax Paid';
        recommendedAction = 'Review Place of Supply (POS) and notify supplier to amend in next GSTR-1.';
        taxHeadMismatchesCount++;
        claimableItcAmount += Math.min(purch.totalTax, bestCandidate.totalTax);
        atRiskItcAmount += Math.abs(taxDiff);
      } else if (candidateDiscrepancies.some(d => d.includes('Tax Amount discrepancy') || d.includes('Taxable Value mismatch'))) {
        status = 'AMOUNT_MISMATCH';
        discrepancyCategory = 'Taxable / Tax Value Discrepancy';
        statutoryClause = 'CGST Rule 36(4) - ITC Capped to GSTR-2B Statement';
        recommendedAction = taxDiff > 0
          ? `Claim ₹${bestCandidate.totalTax.toLocaleString()} in 3B; Hold payment of ₹${taxDiff.toFixed(2)} until supplier amends.`
          : 'Accept lower books claim or adjust purchase invoice voucher.';
        amountMismatchesCount++;
        claimableItcAmount += Math.min(purch.totalTax, bestCandidate.totalTax);
        if (taxDiff > 0) atRiskItcAmount += taxDiff;
      } else if (candidateDiscrepancies.some(d => d.includes('Date out of tolerance') || d.includes('Date tolerance variance'))) {
        status = 'DATE_MISMATCH';
        discrepancyCategory = 'Invoice Date Period Variance';
        statutoryClause = 'CGST Act Section 16(4) - Time Limit for ITC Claim';
        recommendedAction = 'Verify physical invoice receipt date and claim in current tax period.';
        dateMismatchesCount++;
        claimableItcAmount += bestCandidate.totalTax;
      } else {
        exactMatchesCount++;
        claimableItcAmount += bestCandidate.totalTax;
      }

      results.push({
        id: `recon-${idx + 1}-${purch.id}`,
        purchaseRecord: purchaseFormatted,
        gstr2bRecord: bestCandidate,
        status,
        matchingScore: maxScore,
        taxDifference: taxDiff,
        discrepancyCategory,
        discrepancies: candidateDiscrepancies,
        statutoryClause,
        recommendedAction,
        fiveWayMatch: bestFiveWay,
        actionStatus: isBlocked ? 'ACCEPTED_OVERRIDE' : 'PENDING_REVIEW'
      });
    } else {
      // Missing in GSTR-2B
      missingInGstr2bCount++;
      atRiskItcAmount += purch.totalTax;

      results.push({
        id: `recon-${idx + 1}-missing-2b`,
        purchaseRecord: purchaseFormatted,
        gstr2bRecord: undefined,
        status: isBlocked ? 'SECTION_17_5_BLOCKED' : 'MISSING_IN_GSTR2B',
        matchingScore: 0,
        taxDifference: purch.totalTax,
        discrepancyCategory: isBlocked ? 'Section 17(5) Blocked' : 'Missing in GSTR-2B (Supplier Default)',
        discrepancies: [
          'Supplier has not uploaded invoice in GSTR-1 / IFF for this tax period',
          'Not reflected in Government auto-populated GSTR-2B statement'
        ],
        statutoryClause: 'CGST Act Section 16(2)(aa) - Non-negotiable Statutory Condition',
        recommendedAction: 'HOLD supplier payment and send automated WhatsApp/Email follow-up notice. Do NOT claim in GSTR-3B.',
        actionStatus: 'PENDING_REVIEW'
      });
    }
  });

  // 2. Identify GSTR-2B records missing in accounting books (Unclaimed ITC opportunity)
  portalRecords.forEach((portal, pIdx) => {
    totalGstr2bTaxAmount += portal.totalTax;
    totalGstr2bTaxable += portal.taxableValue;

    if (!matched2bIds.has(portal.id)) {
      missingInBooksCount++;
      unclaimedItcAmount += portal.totalTax;

      results.push({
        id: `recon-2b-only-${pIdx + 1}-${portal.id}`,
        purchaseRecord: undefined,
        gstr2bRecord: portal,
        status: 'MISSING_IN_BOOKS',
        matchingScore: 0,
        taxDifference: -portal.totalTax,
        discrepancyCategory: 'Missing in Accounting Books (Unclaimed ITC Opportunity)',
        discrepancies: [
          'Invoice filed by supplier in GSTR-1 and available in GSTR-2B',
          'No matching purchase voucher found in internal ERP register'
        ],
        statutoryClause: 'Section 16(2)(a) - Physical Tax Invoice / Possession Requirement',
        recommendedAction: 'Locate vendor invoice in accounts payable and book purchase entry to claim ₹' + portal.totalTax.toLocaleString() + ' ITC.',
        actionStatus: 'PENDING_REVIEW'
      });
    }
  });

  const totalEvaluated = purchases.length;
  const matchRate = totalEvaluated > 0 ? Math.round((exactMatchesCount / totalEvaluated) * 100) : 0;

  // GSTR-3B Table 4 computation
  const table4A5 = claimableItcAmount;
  const table4B1 = blockedItcAmount;
  const table4B2 = atRiskItcAmount; // Deferred due to missing in 2B
  const table4C = Math.max(0, table4A5 - table4B1);

  const summary: ReconciliationAssistantSummary = {
    totalPurchaseInvoices: purchases.length,
    totalGstr2bRecords: portalRecords.length,
    totalPurchaseTaxAmount,
    totalGstr2bTaxAmount,
    totalPurchaseTaxable,
    totalGstr2bTaxable,
    exactMatchesCount,
    amountMismatchesCount,
    taxHeadMismatchesCount,
    dateMismatchesCount,
    missingInGstr2bCount,
    missingInBooksCount,
    sec17BlockedCount,
    claimableItcAmount,
    atRiskItcAmount,
    unclaimedItcAmount,
    blockedItcAmount,
    taxDifferenceAmount,
    reconciliationMatchRate: matchRate,
    gstr3bTable4: {
      table4A5_EligibleItc: table4A5,
      table4B1_PermanentReversal17_5: table4B1,
      table4B2_TemporaryReversals: table4B2,
      table4C_NetItcAvailable: table4C
    }
  };

  return { results, summary };
}

/**
 * Generates an Audit & Discrepancy Excel Workbook (.xlsx)
 */
export function exportReconciliationAssistantExcel(
  results: GSTR2BMatchResultItem[],
  summary: ReconciliationAssistantSummary,
  entityName: string = 'TaxFlow Enterprise Ltd',
  period: string = 'August 2026'
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Executive KPI Summary
  const summaryRows = [
    ['TaxFlow Enterprise - GST Reconciliation Assistant Summary'],
    ['Entity Name:', entityName],
    ['Return Period:', period],
    ['Generated At:', new Date().toLocaleString()],
    [''],
    ['Metric Description', 'Value (INR / Count)'],
    ['Total Purchase Invoices in Books', summary.totalPurchaseInvoices],
    ['Total GSTR-2B Portal Records', summary.totalGstr2bRecords],
    ['Reconciliation Match Rate', `${summary.reconciliationMatchRate}%`],
    ['Total Input Tax in Books (INR)', summary.totalPurchaseTaxAmount],
    ['Total GSTR-2B Statement Tax (INR)', summary.totalGstr2bTaxAmount],
    ['Eligible Claimable ITC in GSTR-3B (INR)', summary.claimableItcAmount],
    ['High-Risk ITC (Missing in 2B) (INR)', summary.atRiskItcAmount],
    ['Potential Unclaimed ITC (Missing in Books) (INR)', summary.unclaimedItcAmount],
    ['Section 17(5) Ineligible / Blocked ITC (INR)', summary.blockedItcAmount],
    [''],
    ['GSTR-3B Table 4 Statutory Preparation', 'Computed Value (INR)'],
    ['Table 4(A)(5) - All Other ITC (Eligible Inward Supplies)', summary.gstr3bTable4.table4A5_EligibleItc],
    ['Table 4(B)(1) - Reversals: As per Section 17(5)', summary.gstr3bTable4.table4B1_PermanentReversal17_5],
    ['Table 4(B)(2) - Reversals: Others (Deferred / Unfiled in 2B)', summary.gstr3bTable4.table4B2_TemporaryReversals],
    ['Table 4(C) - Net ITC Available (4A - 4B)', summary.gstr3bTable4.table4C_NetItcAvailable],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Executive Summary');

  // Sheet 2: All Reconciliation Items & Mismatches
  const itemRows = results.map(r => ({
    'Match Status': r.status,
    'Discrepancy Category': r.discrepancyCategory,
    'Match Score (%)': r.matchingScore,
    'Action Status': r.actionStatus || 'PENDING_REVIEW',
    
    // Books Side
    'Books Voucher No': r.purchaseRecord?.voucherNumber || '-',
    'Books Invoice No': r.purchaseRecord?.invoiceNumber || '-',
    'Books Invoice Date': r.purchaseRecord?.date || '-',
    'Supplier Name': r.purchaseRecord?.partyName || r.gstr2bRecord?.supplierName || '-',
    'Supplier GSTIN': r.purchaseRecord?.gstin || r.gstr2bRecord?.gstin || '-',
    'Books Taxable (INR)': r.purchaseRecord?.taxableValue || 0,
    'Books Total Tax (INR)': r.purchaseRecord?.taxAmount || 0,
    'Books IGST (INR)': r.purchaseRecord?.igst || 0,
    'Books CGST (INR)': r.purchaseRecord?.cgst || 0,
    'Books SGST (INR)': r.purchaseRecord?.sgst || 0,

    // 2B Side
    '2B Invoice No': r.gstr2bRecord?.invoiceNumber || '-',
    '2B Invoice Date': r.gstr2bRecord?.invoiceDate || '-',
    '2B Taxable (INR)': r.gstr2bRecord?.taxableValue || 0,
    '2B Total Tax (INR)': r.gstr2bRecord?.totalTax || 0,
    '2B IGST (INR)': r.gstr2bRecord?.igst || 0,
    '2B CGST (INR)': r.gstr2bRecord?.cgst || 0,
    '2B SGST (INR)': r.gstr2bRecord?.sgst || 0,
    '2B Filing Date': r.gstr2bRecord?.gstr1FilingDate || '-',

    // Audit Info
    'Tax Variance (INR)': r.taxDifference,
    'Statutory Reference': r.statutoryClause,
    'Recommended Action': r.recommendedAction,
    'Discrepancy Details': r.discrepancies.join('; ')
  }));
  const itemsSheet = XLSX.utils.json_to_sheet(itemRows);
  XLSX.utils.book_append_sheet(wb, itemsSheet, 'Discrepancy Matrix');

  // Sheet 3: Defaulting Suppliers Notice List
  const defaultingSuppliers = results
    .filter(r => r.status === 'MISSING_IN_GSTR2B' || r.status === 'AMOUNT_MISMATCH')
    .map(r => ({
      'Supplier Name': r.purchaseRecord?.partyName || '-',
      'Supplier GSTIN': r.purchaseRecord?.gstin || '-',
      'Invoice Number': r.purchaseRecord?.invoiceNumber || '-',
      'Invoice Date': r.purchaseRecord?.date || '-',
      'Taxable Value (INR)': r.purchaseRecord?.taxableValue || 0,
      'Tax at Risk (INR)': r.purchaseRecord?.taxAmount || 0,
      'Default Issue': r.discrepancyCategory,
      'Required Action': 'File/Amend in GSTR-1 immediately to avoid invoice payment hold'
    }));
  const supplierSheet = XLSX.utils.json_to_sheet(defaultingSuppliers);
  XLSX.utils.book_append_sheet(wb, supplierSheet, 'Defaulting Suppliers List');

  const fileName = `GST_Reconciliation_Assistant_${period.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}

/**
 * Generates Statutory Audit PDF Report
 */
export function exportReconciliationAssistantPdf(
  results: GSTR2BMatchResultItem[],
  summary: ReconciliationAssistantSummary,
  entityName: string = 'TaxFlow Enterprise Ltd',
  period: string = 'August 2026'
): string {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TaxFlow Enterprise — Statutory GST Reconciliation & ITC Audit Report', 14, 12);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`Entity: ${entityName}  |  Period: ${period}  |  Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 19);

  // Executive Summary Card
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 28, pageWidth - 28, 28, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 28, pageWidth - 28, 28, 2, 2, 'D');

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('EXECUTIVE RECONCILIATION SUMMARY & GSTR-3B TABLE 4 PREPARATION', 18, 34);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Purchase Vouchers: ${summary.totalPurchaseInvoices} (₹${(summary.totalPurchaseTaxAmount / 100000).toFixed(2)} L Tax)`, 18, 41);
  doc.text(`Total GSTR-2B Records: ${summary.totalGstr2bRecords} (₹${(summary.totalGstr2bTaxAmount / 100000).toFixed(2)} L Tax)`, 18, 46);
  doc.text(`Reconciliation Match Rate: ${summary.reconciliationMatchRate}% (${summary.exactMatchesCount} fully matched)`, 18, 51);

  doc.text(`Eligible 3B Table 4(A)(5) ITC: ₹${summary.claimableItcAmount.toLocaleString()}`, 110, 41);
  doc.text(`High-Risk Unfiled ITC: ₹${summary.atRiskItcAmount.toLocaleString()} (Hold Payment)`, 110, 46);
  doc.text(`Section 17(5) Blocked ITC: ₹${summary.blockedItcAmount.toLocaleString()} (Table 4B1)`, 110, 51);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text(`NET CLAIMABLE ITC: ₹${summary.gstr3bTable4.table4C_NetItcAvailable.toLocaleString()}`, 200, 41);
  doc.setTextColor(225, 29, 72);
  doc.text(`TOTAL AT-RISK TAX: ₹${summary.atRiskItcAmount.toLocaleString()}`, 200, 46);
  doc.setTextColor(16, 185, 129);
  doc.text(`UNCLAIMED 2B CREDIT: ₹${summary.unclaimedItcAmount.toLocaleString()}`, 200, 51);

  // Table of Discrepancies
  const tableData = results.slice(0, 40).map((r, i) => [
    i + 1,
    r.purchaseRecord?.partyName || r.gstr2bRecord?.supplierName || '-',
    r.purchaseRecord?.invoiceNumber || r.gstr2bRecord?.invoiceNumber || '-',
    r.purchaseRecord?.date || '-',
    r.purchaseRecord ? `Rs. ${r.purchaseRecord.taxAmount.toLocaleString()}` : '-',
    r.gstr2bRecord ? `Rs. ${r.gstr2bRecord.totalTax.toLocaleString()}` : 'MISSING',
    r.status.replace(/_/g, ' '),
    r.recommendedAction
  ]);

  autoTable(doc, {
    startY: 60,
    head: [['#', 'Supplier', 'Invoice No', 'Date', 'Books Tax', 'GSTR-2B Tax', 'Audit Status', 'Action Plan']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 }
  });

  const fileName = `GST_Reconciliation_Audit_${period.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
  return fileName;
}

/**
 * Formats a WhatsApp / Email message for supplier mismatch notification
 */
export function generateSupplierNoticeContent(data: SupplierNoticeData): {
  subject: string;
  emailBody: string;
  whatsAppText: string;
} {
  const subject = `URGENT: GST Mismatch Notice - Invoice #${data.invoiceNumber} missing/discrepancy in GSTR-2B`;

  const emailBody = `Dear Accounts Team at ${data.supplierName},

Greetings from ${data.buyerName} (GSTIN: ${data.buyerGstin}).

During our monthly GST compliance audit for our tax return filing, we observed a discrepancy regarding the following inward supply:

• Invoice Number: ${data.invoiceNumber}
• Invoice Date: ${data.invoiceDate}
• Taxable Amount: ₹${data.taxableAmount.toLocaleString('en-IN')}
• Tax Amount (ITC): ₹${data.taxAmount.toLocaleString('en-IN')}
• Audit Flag: ${data.issueDescription}

STATUTORY NOTICE UNDER CGST ACT SECTION 16(2)(aa):
Under CGST Rule 36(4) and Section 16(2)(aa), Input Tax Credit (ITC) is strictly available only if the invoice is uploaded by the supplier in GSTR-1/IFF and reflected in the buyer's auto-populated GSTR-2B statement.

REQUIRED ACTION:
Please ensure this invoice is uploaded / amended in your GSTR-1 return for the upcoming tax period prior to the statutory cutoff date (${data.statutoryDeadline}). 

Note: Our internal ERP has flagged this voucher, and payment against this invoice may be held pending reflection in the GST Portal.

Thank you for your prompt cooperation.

Sincerely,
GST Compliance & Accounts Payable Team
${data.buyerName}
${data.contactEmail ? `Email: ${data.contactEmail}` : ''}
`;

  const whatsAppText = `*URGENT: GST Discrepancy Notice from ${data.buyerName}*
To: ${data.supplierName} (GSTIN: ${data.supplierGstin})

Dear Team, invoice *#${data.invoiceNumber}* dated ${data.invoiceDate} (Tax: ₹${data.taxAmount.toLocaleString('en-IN')}) is *not reflected in our GSTR-2B statement*.

Under GST Section 16(2)(aa), this ITC is blocked for us. Please upload/amend this invoice in your GSTR-1 by ${data.statutoryDeadline} to avoid invoice payment hold.

Thank you,
${data.buyerName} GST Compliance Team`;

  return { subject, emailBody, whatsAppText };
}
