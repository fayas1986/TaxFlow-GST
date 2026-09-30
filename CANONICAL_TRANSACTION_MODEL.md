# Canonical Transaction Model Specification

## 1. Overview

The Canonical Transaction Model (`CanonicalTransactionDto`) serves as the **universal data contract** between external ERP systems and the TaxFlow GST domain. Regardless of whether an invoice originates from SAP, Microsoft Dynamics 365, Tally, Oracle, or a CSV spreadsheet, it is mapped into this standardized DTO before entering the tax calculation and compliance pipeline.

---

## 2. Canonical DTO Schema Specification

```typescript
export interface CanonicalTransactionDto {
  // Source Identity & Traceability
  sourceSystem: string;              // e.g. "DYNAMICS_365", "SAP", "CSV_EXCEL", "GENERIC_REST"
  sourceCompanyRef?: string;         // External ERP Company Code / Company Name
  externalDocumentId: string;        // Unique Document ID in Source System (e.g. "SAP-INV-9001")
  
  // Document Classification
  documentType: 'SALES' | 'PURCHASE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
  documentNumber: string;            // External Invoice Number
  documentDate: Date | string;       // Document Issue Date
  
  // Organizational Boundary
  companyId: string;                 // TaxFlow Company UUID
  gstinId: string;                    // TaxFlow GSTIN UUID
  branchId?: string;                 // TaxFlow Branch UUID
  
  // Party & Place of Supply
  partyCode: string;                 // Customer / Vendor Code
  partyLegalName: string;            // Party Legal Name
  partyGstin?: string;               // 15-character Party GSTIN (if B2B)
  placeOfSupplyStateCode: string;    // 2-digit Indian State Code (e.g. "27" for Maharashtra)
  isReverseCharge?: boolean;         // Reverse Charge Mechanism flag
  
  // Financial & Currency
  currency?: string;                 // Currency Code (Default: "INR")
  exchangeRate?: number;             // Exchange Rate to INR (Default: 1.0)
  
  // Line Items
  lineItems: CanonicalLineItemDto[];
  
  // Totals & ERP Tax Evidence
  totalTaxableAmount: number;
  erpCalculatedTax?: number;         // Tax calculated by source ERP
  erpTotalInvoiceAmount?: number;    // Invoice total including ERP tax
  references?: Record<string, any>;  // Extra metadata references
}

export interface CanonicalLineItemDto {
  itemNumber: number;                // 1-indexed Line Item sequence
  hsnSacCode: string;                // HSN or SAC code (e.g. "998311")
  description: string;               // Line Item description
  quantity: number;                  // Item Quantity
  unitPrice: number;                 // Price per unit
  discountAmount?: number;           // Line item discount
  taxableValue: number;              // Net Taxable Value
  erpCgstAmount?: number;            // ERP CGST
  erpSgstAmount?: number;            // ERP SGST
  erpIgstAmount?: number;            // ERP IGST
  erpCessAmount?: number;            // ERP Cess
  erpTotalTax?: number;              // ERP Line Item Total Tax
}
```

---

## 3. Authoritative Tax Comparison

TaxFlow does not blindly accept ERP-calculated taxes. During ingestion:
1. `TaxComparisonService` passes the canonical line items to TaxFlow's `TaxEngineService`.
2. TaxFlow calculates authoritative CGST, SGST, IGST, and Cess.
3. `taxVariance` is calculated: `Math.abs(erpCalculatedTax - taxflowCalculatedTax)`.
4. If `taxVariance > tolerance` (default ₹1.00), `isTaxMatched = false` and the record is flagged as `TAX_MISMATCH` for compliance review.
