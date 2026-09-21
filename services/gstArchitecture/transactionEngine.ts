/**
 * Target Architecture: Transaction Engine
 * Canonical Model, Data Quality, Validation
 */

export interface CanonicalTransaction {
  id: string;
  sourceSystem: 'SAP_S4HANA' | 'ORACLE_NETSUITE' | 'TALLY_PRIME' | 'ZOHO_BOOKS' | 'CSV_INGEST' | 'PORTAL_DIRECT';
  tenantId: string;
  gstin: string;
  branchId?: string;
  docType: 'INV' | 'CRN' | 'DBN' | 'BOS';
  docNumber: string;
  docDate: string;
  partyGstin: string;
  partyLegalName: string;
  partyStateCode: string;
  placeOfSupply: string;
  isInterState: boolean;
  isRcm: boolean;
  isExport: boolean;
  isSez: boolean;
  supplyType: 'B2B' | 'B2C' | 'SEZWP' | 'SEZWOP' | 'EXPWP' | 'EXPWOP' | 'DEEMED_EXP';
  items: Array<{
    itemCode?: string;
    description: string;
    hsnCode: string;
    quantity: number;
    uom: string;
    unitPrice: number;
    taxableValue: number;
    gstRate: number;
    igstAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    cessAmount: number;
    totalAmount: number;
  }>;
  totalTaxableValue: number;
  totalTaxAmount: number;
  totalInvoiceValue: number;
  currency: string;
  exchangeRate: number;
  dataQualityScore: number;
  validationStatus: 'PASSED' | 'WARNING' | 'FAILED';
  validationErrors: string[];
}

export class CanonicalModelService {
  static normalize(rawPayload: any, sourceSystem: CanonicalTransaction['sourceSystem'] = 'CSV_INGEST'): CanonicalTransaction {
    const docDate = rawPayload.docDate || rawPayload.date || new Date().toISOString().split('T')[0];
    const supplierGstin = (rawPayload.supplierGstin || rawPayload.gstin || '27AAAAA0000A1Z5').toUpperCase();
    const recipientGstin = (rawPayload.recipientGstin || rawPayload.partyGstin || '').toUpperCase();
    const supplierState = supplierGstin.substring(0, 2) || '27';
    const placeOfSupply = rawPayload.placeOfSupply || (recipientGstin ? recipientGstin.substring(0, 2) : supplierState);
    const isInterState = supplierState !== placeOfSupply;

    const items = (rawPayload.items && rawPayload.items.length > 0)
      ? rawPayload.items.map((it: any) => {
          const qty = Number(it.quantity) || 1;
          const rate = Number(it.rate || it.unitPrice || it.taxableValue || rawPayload.amount) || 1000;
          const taxable = Number(it.taxableValue) || (qty * rate);
          const gstRate = Number(it.gstRate || it.taxRate || 18);
          const totalTax = (taxable * gstRate) / 100;
          
          return {
            itemCode: it.itemCode || 'ITM-01',
            description: it.description || 'Consulting / Tech Services',
            hsnCode: (it.hsnCode || '998311').replace(/[^0-9]/g, ''),
            quantity: qty,
            uom: it.uom || 'NOS',
            unitPrice: rate,
            taxableValue: taxable,
            gstRate,
            igstAmount: isInterState ? totalTax : 0,
            cgstAmount: !isInterState ? totalTax / 2 : 0,
            sgstAmount: !isInterState ? totalTax / 2 : 0,
            cessAmount: Number(it.cessAmount || 0),
            totalAmount: taxable + totalTax + Number(it.cessAmount || 0)
          };
        })
      : [{
          description: rawPayload.description || 'Standard Supplies',
          hsnCode: (rawPayload.hsnCode || '998311').replace(/[^0-9]/g, ''),
          quantity: 1,
          uom: 'NOS',
          unitPrice: Number(rawPayload.amount) || 10000,
          taxableValue: Number(rawPayload.amount) || 10000,
          gstRate: 18,
          igstAmount: isInterState ? (Number(rawPayload.amount || 10000) * 0.18) : 0,
          cgstAmount: !isInterState ? (Number(rawPayload.amount || 10000) * 0.09) : 0,
          sgstAmount: !isInterState ? (Number(rawPayload.amount || 10000) * 0.09) : 0,
          cessAmount: 0,
          totalAmount: (Number(rawPayload.amount) || 10000) * 1.18
        }];

    const totalTaxableValue = items.reduce((acc, it) => acc + it.taxableValue, 0);
    const totalTaxAmount = items.reduce((acc, it) => acc + it.igstAmount + it.cgstAmount + it.sgstAmount + it.cessAmount, 0);
    const totalInvoiceValue = totalTaxableValue + totalTaxAmount;

    return {
      id: rawPayload.id || `CAN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sourceSystem,
      tenantId: rawPayload.tenantId || 't1',
      gstin: supplierGstin,
      branchId: rawPayload.branchId || 'b1',
      docType: rawPayload.docType || 'INV',
      docNumber: rawPayload.docNumber || rawPayload.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
      docDate,
      partyGstin: recipientGstin,
      partyLegalName: rawPayload.partyName || rawPayload.partyLegalName || 'Enterprise Partner Ltd',
      partyStateCode: placeOfSupply,
      placeOfSupply,
      isInterState,
      isRcm: Boolean(rawPayload.isRcm),
      isExport: Boolean(rawPayload.isExport || placeOfSupply === '96'),
      isSez: Boolean(rawPayload.isSez),
      supplyType: rawPayload.supplyType || (recipientGstin ? 'B2B' : 'B2C'),
      items,
      totalTaxableValue,
      totalTaxAmount,
      totalInvoiceValue,
      currency: rawPayload.currency || 'INR',
      exchangeRate: Number(rawPayload.exchangeRate) || 1.0,
      dataQualityScore: 100,
      validationStatus: 'PASSED',
      validationErrors: []
    };
  }
}

export class DataQualityService {
  static assessQuality(tx: CanonicalTransaction): { score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;

    if (!tx.docNumber || tx.docNumber.trim() === '') {
      issues.push('Missing Document Number');
      score -= 25;
    }

    if (!tx.docDate || isNaN(Date.parse(tx.docDate))) {
      issues.push('Invalid or Missing Document Date');
      score -= 20;
    }

    if (tx.supplyType === 'B2B' && (!tx.partyGstin || tx.partyGstin.length !== 15)) {
      issues.push('B2B Transaction missing valid 15-character GSTIN');
      score -= 25;
    }

    if (!tx.items || tx.items.length === 0) {
      issues.push('Transaction contains 0 line items');
      score -= 30;
    } else {
      tx.items.forEach((it, idx) => {
        if (!it.hsnCode || it.hsnCode.length < 4) {
          issues.push(`Line item #${idx + 1} has insufficient HSN Code (min 4 digits required)`);
          score -= 10;
        }
        if (it.taxableValue <= 0) {
          issues.push(`Line item #${idx + 1} has non-positive taxable value`);
          score -= 10;
        }
      });
    }

    const calculatedTax = tx.items.reduce((acc, it) => acc + it.igstAmount + it.cgstAmount + it.sgstAmount + it.cessAmount, 0);
    if (Math.abs(calculatedTax - tx.totalTaxAmount) > 2) {
      issues.push('Tax header and line-item summation mismatch');
      score -= 15;
    }

    return {
      score: Math.max(0, score),
      issues
    };
  }
}

export class ValidationEngine {
  private static GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  static validate(tx: CanonicalTransaction): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // GSTIN checks
    if (tx.gstin && !this.GSTIN_REGEX.test(tx.gstin)) {
      errors.push(`Supplier GSTIN "${tx.gstin}" fails standard checksum regex validation`);
    }

    if (tx.partyGstin && tx.partyGstin !== 'URP' && !this.GSTIN_REGEX.test(tx.partyGstin)) {
      if (tx.supplyType === 'B2B') {
        errors.push(`Recipient GSTIN "${tx.partyGstin}" is invalid for B2B supply`);
      } else {
        warnings.push(`Recipient GSTIN format looks non-standard for B2C`);
      }
    }

    // Place of Supply vs Tax Component Validation
    const supplierState = tx.gstin.substring(0, 2);
    const isInter = supplierState !== tx.placeOfSupply;

    tx.items.forEach((it, i) => {
      if (isInter && (it.cgstAmount > 0 || it.sgstAmount > 0)) {
        errors.push(`Line item #${i + 1}: Inter-state supply (${supplierState} -> ${tx.placeOfSupply}) cannot charge CGST/SGST; must charge IGST.`);
      }
      if (!isInter && it.igstAmount > 0 && !tx.isSez) {
        errors.push(`Line item #${i + 1}: Intra-state supply (${supplierState} -> ${tx.placeOfSupply}) cannot charge IGST; must charge CGST+SGST.`);
      }
    });

    // E-Invoice threshold validation
    if (tx.totalInvoiceValue >= 5000000 && tx.supplyType === 'B2B') {
      warnings.push('High value invoice (>₹50L) mandates IRN generation before goods dispatch.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}
