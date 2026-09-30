export interface CanonicalLineItemDto {
  itemNumber: number;
  hsnSacCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  taxableValue: number;
  erpCgstAmount?: number;
  erpSgstAmount?: number;
  erpIgstAmount?: number;
  erpCessAmount?: number;
  erpTotalTax?: number;
}

export interface CanonicalTransactionDto {
  sourceSystem: string;
  sourceCompanyRef?: string;
  externalDocumentId: string;
  documentType: 'SALES' | 'PURCHASE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
  documentNumber: string;
  documentDate: Date | string;
  companyId: string;
  gstinId: string;
  branchId?: string;
  partyCode: string;
  partyLegalName: string;
  partyGstin?: string;
  placeOfSupplyStateCode: string;
  isReverseCharge?: boolean;
  currency?: string;
  exchangeRate?: number;
  lineItems: CanonicalLineItemDto[];
  totalTaxableAmount: number;
  erpCalculatedTax?: number;
  erpTotalInvoiceAmount?: number;
  references?: Record<string, any>;
}
