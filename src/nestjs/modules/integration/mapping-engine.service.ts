import { Injectable, BadRequestException } from '@nestjs/common';
import { CanonicalTransactionDto, CanonicalLineItemDto } from './canonical-transaction.dto';

export interface FieldMappingRule {
  externalField: string;
  canonicalField: string;
  defaultValue?: any;
  transform?: 'DATE_ISO' | 'DATE_INDIAN' | 'UPPERCASE' | 'NUMBER' | 'STATE_CODE';
}

@Injectable()
export class MappingEngineService {
  private static STATE_CODE_MAP: Record<string, string> = {
    MAHARASHTRA: '27',
    DELHI: '07',
    KARNATAKA: '29',
    TAMIL_NADU: '33',
    GUJARAT: '24',
    WEST_BENGAL: '19',
    TELANGANA: '36',
    HARYANA: '06',
    UTTAR_PRADESH: '09',
  };

  /**
   * Map raw ERP payload to CanonicalTransactionDto using configurable mapping rules.
   */
  mapToCanonical(rawRecord: any, mappingConfig: any, sourceSystem: string): CanonicalTransactionDto {
    if (!rawRecord || typeof rawRecord !== 'object') {
      throw new BadRequestException('Raw ERP payload must be a valid JSON object.');
    }

    const fieldMappings: Record<string, string> = mappingConfig?.fieldMappings || {};
    const getVal = (canonicalKey: string, fallbackKey: string) => {
      const field = fieldMappings[canonicalKey] || fallbackKey;
      return rawRecord[field] !== undefined ? rawRecord[field] : rawRecord[canonicalKey];
    };

    const externalDocumentId = String(getVal('externalDocumentId', 'DocId') || getVal('documentNumber', 'DocNo') || '');
    const documentNumber = String(getVal('documentNumber', 'DocNo') || externalDocumentId);
    const rawDocType = String(getVal('documentType', 'DocType') || 'SALES').toUpperCase();

    let documentType: 'SALES' | 'PURCHASE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' = 'SALES';
    if (rawDocType.includes('PURCHASE') || rawDocType.includes('BILL')) documentType = 'PURCHASE';
    if (rawDocType.includes('CREDIT')) documentType = 'CREDIT_NOTE';
    if (rawDocType.includes('DEBIT')) documentType = 'DEBIT_NOTE';

    const rawDate = getVal('documentDate', 'DocDate');
    const documentDate = this.parseDate(rawDate);

    const companyId = String(getVal('companyId', 'CompanyId') || '');
    const gstinId = String(getVal('gstinId', 'GstinId') || '');
    const branchId = getVal('branchId', 'BranchId') ? String(getVal('branchId', 'BranchId')) : undefined;

    const partyCode = String(getVal('partyCode', 'CustomerCode') || getVal('vendorCode', 'VendorCode') || 'CUST-001');
    const partyLegalName = String(getVal('partyLegalName', 'CustomerName') || getVal('vendorName', 'VendorName') || 'External Party');
    const partyGstin = getVal('partyGstin', 'CustomerGSTIN') ? String(getVal('partyGstin', 'CustomerGSTIN')).trim().toUpperCase() : undefined;

    const rawPos = String(getVal('placeOfSupplyStateCode', 'PlaceOfSupply') || '27');
    const placeOfSupplyStateCode = this.normalizeStateCode(rawPos);

    // Line items mapping
    const rawItems = Array.isArray(rawRecord.lineItems || rawRecord.Items || rawRecord.Lines)
      ? rawRecord.lineItems || rawRecord.Items || rawRecord.Lines
      : [rawRecord];

    let totalTaxable = 0;
    let erpTotalTax = 0;

    const lineItems: CanonicalLineItemDto[] = rawItems.map((item: any, idx: number) => {
      const qty = Number(item.quantity || item.Qty || 1);
      const price = Number(item.unitPrice || item.Rate || item.Price || 0);
      const taxable = Number(item.taxableValue || item.TaxableAmount || item.Amount || qty * price);
      const erpCgst = Number(item.cgstAmount || item.CGST || 0);
      const erpSgst = Number(item.sgstAmount || item.SGST || 0);
      const erpIgst = Number(item.igstAmount || item.IGST || 0);
      const erpCess = Number(item.cessAmount || item.Cess || 0);
      const lineTax = erpCgst + erpSgst + erpIgst + erpCess;

      totalTaxable += taxable;
      erpTotalTax += lineTax;

      return {
        itemNumber: idx + 1,
        hsnSacCode: String(item.hsnSacCode || item.HSN || item.SAC || '998311'),
        description: String(item.description || item.ItemDesc || 'Imported Line Item'),
        quantity: qty,
        unitPrice: price,
        discountAmount: Number(item.discountAmount || item.Discount || 0),
        taxableValue: taxable,
        erpCgstAmount: erpCgst,
        erpSgstAmount: erpSgst,
        erpIgstAmount: erpIgst,
        erpCessAmount: erpCess,
        erpTotalTax: lineTax,
      };
    });

    return {
      sourceSystem,
      sourceCompanyRef: getVal('sourceCompanyRef', 'SourceCompany'),
      externalDocumentId,
      documentType,
      documentNumber,
      documentDate,
      companyId,
      gstinId,
      branchId,
      partyCode,
      partyLegalName,
      partyGstin,
      placeOfSupplyStateCode,
      isReverseCharge: Boolean(getVal('isReverseCharge', 'ReverseCharge')),
      currency: String(getVal('currency', 'Currency') || 'INR'),
      exchangeRate: Number(getVal('exchangeRate', 'ExchangeRate') || 1.0),
      lineItems,
      totalTaxableAmount: Number(getVal('totalTaxableAmount', 'TotalTaxable') || totalTaxable),
      erpCalculatedTax: Number(getVal('erpCalculatedTax', 'TotalTax') || erpTotalTax),
      erpTotalInvoiceAmount: Number(getVal('erpTotalInvoiceAmount', 'InvoiceTotal') || totalTaxable + erpTotalTax),
    };
  }

  private parseDate(val: any): Date {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    if (typeof val === 'string') {
      if (val.includes('/')) {
        const parts = val.split('/');
        if (parts.length === 3 && parts[0].length === 2) {
          // DD/MM/YYYY format
          return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        }
      }
      const parsed = Date.parse(val);
      if (!isNaN(parsed)) return new Date(parsed);
    }
    return new Date();
  }

  private normalizeStateCode(val: string): string {
    const clean = val.trim().toUpperCase();
    if (/^\d{2}$/.test(clean)) return clean;
    if (MappingEngineService.STATE_CODE_MAP[clean]) return MappingEngineService.STATE_CODE_MAP[clean];
    return '27';
  }
}
