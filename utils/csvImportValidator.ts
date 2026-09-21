import { Invoice, TaxBreakdown } from '../types';
import { GSTRuleEngine } from '../services/gstEngine/ruleEngine';
import { ITCTaggingService } from '../services/gstEngine/itcTaggingService';

export const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
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
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '96': 'Foreign Country',
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction',
};

/**
 * Validates Indian GSTIN format and state code prefix
 * GSTIN Structure: 15 chars (e.g., 27ABCDE1234F1Z1)
 * - 2 digits state code
 * - 10 chars PAN
 * - 1 digit entity number
 * - 1 char 'Z' by default
 * - 1 checksum digit
 */
export const validateGstin = (gstin: string): { isValid: boolean; error?: string; stateName?: string } => {
  const cleaned = gstin.trim().toUpperCase();
  if (!cleaned) {
    return { isValid: false, error: 'GSTIN cannot be empty' };
  }

  // Use Tax Engine Rule
  if (!GSTRuleEngine.validateGSTIN(cleaned)) {
    return { isValid: false, error: 'Invalid GSTIN structure (Failed GST Tax Engine Validation)' };
  }

  const stateCode = cleaned.substring(0, 2);
  if (!GST_STATE_CODES[stateCode]) {
    return { isValid: false, error: `Invalid GST state code prefix '${stateCode}'` };
  }

  return { isValid: true, stateName: GST_STATE_CODES[stateCode] };
};

/**
 * Validates GST Rule 46 Invoice Number
 * Max 16 characters, alphanumeric, hyphens, or slashes
 */
export const validateInvoiceNumber = (invNum: string): { isValid: boolean; error?: string } => {
  const cleaned = invNum.trim();
  if (!cleaned) {
    return { isValid: false, error: 'Invoice number is required' };
  }
  if (cleaned.length > 16) {
    return { isValid: false, error: `Invoice number exceeds GST limit of 16 characters (${cleaned.length} chars)` };
  }
  const invRegex = /^[A-Za-z0-9\/-]+$/;
  if (!invRegex.test(cleaned)) {
    return { isValid: false, error: 'Invoice number contains invalid characters (Only A-Z, 0-9, / and - allowed)' };
  }
  return { isValid: true };
};

/**
 * Validates Date format (YYYY-MM-DD, DD/MM/YYYY, or DD-MM-YYYY)
 */
export const validateInvoiceDate = (dateStr: string): { isValid: boolean; formattedDate?: string; error?: string } => {
  const cleaned = dateStr.trim();
  if (!cleaned) {
    return { isValid: false, error: 'Date is required' };
  }

  let formattedDate = '';
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    formattedDate = cleaned;
  } 
  // DD/MM/YYYY or DD-MM-YYYY
  else if (/^\d{2}[\/-]\d{2}[\/-]\d{4}$/.test(cleaned)) {
    const parts = cleaned.split(/[\/-]/);
    formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  } else {
    return { isValid: false, error: 'Invalid date format (Use YYYY-MM-DD or DD/MM/YYYY)' };
  }

  const dateObj = new Date(formattedDate);
  if (isNaN(dateObj.getTime())) {
    return { isValid: false, error: 'Invalid date value' };
  }

  return { isValid: true, formattedDate };
};

export interface ParsedCsvRow {
  rowIndex: number;
  invoiceNumber: string;
  date: string;
  partyName: string;
  gstin: string;
  placeOfSupply: string;
  totalAmount: number; // Taxable Value
  taxAmount: number;
  category: 'SALES' | 'PURCHASE';
  type: 'B2B' | 'B2C' | 'EXPORT';
  isValid: boolean;
  errors: string[];
  isBlockedItc?: boolean;
  itcEligibilityTag?: 'Input Tax Credit Eligible' | 'Input Tax Credit Non-Eligible' | 'N/A (Sales Supply)';
  itcReason?: string;
  itcStatutoryClause?: string;
  rawRow: Record<string, string>;
}

/**
 * Standard CSV Line Parser handling quotes and commas
 */
export const parseCsvText = (csvText: string): Record<string, string>[] => {
  const lines = csvText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length < 2) return [];

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^["']|["']$/g, ''));
    return result;
  };

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const rowObj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      rowObj[header] = values[idx] || '';
    });
    rows.push(rowObj);
  }

  return rows;
};

/**
 * Validates and transforms CSV rows into structured ParsedCsvRow
 */
export const validateCsvInvoices = (rawRows: Record<string, string>[], existingInvoiceNumbers: Set<string> = new Set()): ParsedCsvRow[] => {
  const seenInvoiceNumbers = new Set<string>();

  return rawRows.map((row, index) => {
    const errors: string[] = [];

    // Header normalization helpers
    const getVal = (keys: string[]) => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== '') return row[k].trim();
      }
      return '';
    };

    const invNum = getVal(['invoicenumber', 'invoiceno', 'invno', 'number', 'invoice']);
    const dateRaw = getVal(['date', 'invoicedate', 'invdate']);
    const partyName = getVal(['partyname', 'party', 'customer', 'vendor', 'party_name']);
    const gstinRaw = getVal(['gstin', 'gstnumber', 'partygstin', 'gst']);
    const posRaw = getVal(['placeofsupply', 'pos', 'state', 'statecode']);
    const amountRaw = getVal(['totalamount', 'amount', 'taxablevalue', 'subtotal', 'value']);
    const taxRaw = getVal(['taxamount', 'tax', 'gstamount']);
    const catRaw = getVal(['category', 'invoicecategory', 'typecategory']).toUpperCase();
    const typeRaw = getVal(['type', 'invoicetype', 'supplytype']).toUpperCase();

    // Validate Invoice Number
    const invCheck = validateInvoiceNumber(invNum);
    if (!invCheck.isValid) {
      errors.push(invCheck.error || 'Invalid invoice number');
    } else if (seenInvoiceNumbers.has(invNum.toUpperCase())) {
      errors.push(`Duplicate invoice number '${invNum}' in this file`);
    } else if (existingInvoiceNumbers.has(invNum.toUpperCase())) {
      errors.push(`Invoice number '${invNum}' already exists in system`);
    } else {
      seenInvoiceNumbers.add(invNum.toUpperCase());
    }

    // Validate Date
    const dateCheck = validateInvoiceDate(dateRaw);
    let finalDate = dateRaw;
    if (!dateCheck.isValid) {
      errors.push(dateCheck.error || 'Invalid date');
    } else {
      finalDate = dateCheck.formattedDate || dateRaw;
    }

    // Validate Party Name
    if (!partyName) {
      errors.push('Party Name is required');
    }

    // Determine Type (B2B, B2C, EXPORT)
    let invoiceType: 'B2B' | 'B2C' | 'EXPORT' = 'B2B';
    if (typeRaw === 'B2C' || typeRaw === 'B2B' || typeRaw === 'EXPORT') {
      invoiceType = typeRaw as any;
    } else if (!gstinRaw) {
      invoiceType = 'B2C';
    }

    // Validate GSTIN if B2B or present
    let finalPlaceOfSupply = posRaw || '27';
    if (gstinRaw) {
      const gstinCheck = validateGstin(gstinRaw);
      if (!gstinCheck.isValid) {
        errors.push(gstinCheck.error || 'Invalid GSTIN');
      } else {
        // Derive place of supply from GSTIN state code if pos is empty
        if (!posRaw) {
          finalPlaceOfSupply = gstinRaw.substring(0, 2);
        }
      }
    } else if (invoiceType === 'B2B') {
      errors.push('GSTIN is required for B2B Invoices');
    }

    // Validate Taxable Amount
    const totalAmount = parseFloat(amountRaw.replace(/,/g, ''));
    if (isNaN(totalAmount) || totalAmount <= 0) {
      errors.push('Total Amount must be a valid number greater than 0');
    }

    // Tax Amount (Default to 18% if not given)
    let taxAmount = parseFloat(taxRaw.replace(/,/g, ''));
    if (isNaN(taxAmount)) {
      taxAmount = Math.round((totalAmount || 0) * 0.18 * 100) / 100;
    }

    // Category (SALES / PURCHASE)
    let category: 'SALES' | 'PURCHASE' = 'SALES';
    if (catRaw === 'PURCHASE' || catRaw === 'PURCHASES' || catRaw === 'INWARD') {
      category = 'PURCHASE';
    }

    // Run Automated Statutory ITC Tagging for the parsed row
    const tempInv: Invoice = {
      id: `temp-${index}`,
      tenantId: 't1',
      invoiceNumber: invNum || `INV-${index}`,
      partyName: partyName || 'Party',
      gstin: gstinRaw.toUpperCase(),
      placeOfSupply: finalPlaceOfSupply,
      date: finalDate,
      amount: isNaN(totalAmount) ? 0 : totalAmount,
      taxAmount: isNaN(taxAmount) ? 0 : taxAmount,
      taxDetails: { taxableValue: totalAmount || 0, igst: taxAmount || 0, cgst: 0, sgst: 0, utgst: 0, cess: 0 },
      items: [
        {
          id: 'temp-item-1',
          description: getVal(['itemdescription', 'description', 'particulars', 'item']) || partyName || 'Purchase Item',
          hsnSac: getVal(['hsn', 'hsncode', 'sac']) || '9983',
          quantity: 1,
          unit: 'NOS',
          rate: totalAmount || 0,
          taxRate: 18,
          taxableValue: totalAmount || 0,
          taxAmount: taxAmount || 0
        }
      ],
      status: 'PENDING',
      type: invoiceType,
      category,
      docType: 'INVOICE'
    };

    const itcResult = ITCTaggingService.classifyInvoiceITC(tempInv);

    return {
      rowIndex: index + 1,
      invoiceNumber: invNum,
      date: finalDate,
      partyName,
      gstin: gstinRaw.toUpperCase(),
      placeOfSupply: finalPlaceOfSupply,
      totalAmount: isNaN(totalAmount) ? 0 : totalAmount,
      taxAmount,
      category,
      type: invoiceType,
      isValid: errors.length === 0,
      errors,
      isBlockedItc: !itcResult.isEligible,
      itcEligibilityTag: itcResult.eligibilityTag,
      itcReason: itcResult.reason,
      itcStatutoryClause: itcResult.statutoryClause,
      rawRow: row
    };
  });
};

/**
 * Sample CSV Content for Download Template
 */
export const SAMPLE_INVOICE_CSV = `InvoiceNumber,Date,PartyName,GSTIN,PlaceOfSupply,TotalAmount,TaxAmount,Category,Type
INV-2024-101,2024-11-15,Acme Solutions Pvt Ltd,27ABCDE1234F1Z1,27,150000,27000,SALES,B2B
INV-2024-102,2024-11-18,Global Logistics India,07AAACG1234H1Z5,07,85000,15300,SALES,B2B
INV-2024-103,2024-11-20,Walk-in Consumer,,27,12500,2250,SALES,B2C
PUR-2024-045,2024-11-10,TechSupplies Enterprises,29AAACT9876K1Z9,29,220000,39600,PURCHASE,B2B`;
