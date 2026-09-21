import { Invoice, InvoiceItem } from '../../types';

export interface RuleViolation {
  field: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'TAX_RATE' | 'HSN_MISMATCH' | 'ITC_BLOCK' | 'RCM_ALERT' | 'VALUATION' | 'FORMAT_ERROR';
  description: string;
  recommendation: string;
}

/**
 * GST Rule & Compliance Validation Engine
 */
export class GSTRuleEngine {
  // 15-digit GSTIN Regex: State code (2 digits) + PAN (10 chars) + Entity code (1 char) + Blank char (Z) + Check digit (1 char)
  private static GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  // HSN code pattern (typically 4, 6, or 8 digits)
  private static HSN_REGEX = /^[0-9]{4}([0-9]{2})?([0-9]{2})?$/;

  /**
   * Validates structure and state-checksum of an Indian GSTIN
   */
  public static validateGSTIN(gstin: string): boolean {
    if (!gstin) return false;
    const cleanGstin = gstin.trim().toUpperCase();
    return this.GSTIN_REGEX.test(cleanGstin);
  }

  /**
   * Validates HSN/SAC structural code integrity
   */
  public static validateHSN(hsn: string): boolean {
    if (!hsn) return false;
    const cleanHsn = hsn.trim();
    return this.HSN_REGEX.test(cleanHsn);
  }

  /**
   * Runs extensive compliance checks on individual line items
   */
  public static auditLineItem(item: InvoiceItem): RuleViolation[] {
    const violations: RuleViolation[] = [];

    // 1. Check HSN/SAC format
    if (item.hsnSac && !this.validateHSN(item.hsnSac)) {
      violations.push({
        field: 'hsnSac',
        severity: 'MEDIUM',
        category: 'FORMAT_ERROR',
        description: `HSN/SAC Code "${item.hsnSac}" is formatted incorrectly. Must be 4, 6, or 8 digits.`,
        recommendation: 'Check the HSN/SAC master database to verify the numeric code structure.'
      });
    }

    // 2. Identify potential Blocked ITC (Section 17(5)) rules based on item description
    const desc = (item.description || '').toLowerCase();
    const blockedKeywords = ['food', 'beverage', 'car hire', 'motor vehicle', 'club membership', 'catering', 'life insurance', 'health insurance', 'beauty treatment', 'travel benefit'];
    
    const matchedKeyword = blockedKeywords.find(keyword => desc.includes(keyword));
    if (matchedKeyword) {
      violations.push({
        field: 'description',
        severity: 'HIGH',
        category: 'ITC_BLOCK',
        description: `Potential blocked Input Tax Credit (ITC) under Section 17(5) detected. Item: "${item.description}"`,
        recommendation: 'Flag this item as Blocked ITC to prevent non-compliant reconciliation and tax audits.'
      });
    }

    // 3. Reverse Charge Mechanism (RCM) heuristic alerts
    const rcmKeywords = ['legal services', 'advocate fee', 'arbitral tribunal', 'sponsorship services', 'security service', 'gta', 'goods transport agency', 'recovery agent'];
    const matchedRcm = rcmKeywords.find(keyword => desc.includes(keyword));
    if (matchedRcm) {
      violations.push({
        field: 'description',
        severity: 'MEDIUM',
        category: 'RCM_ALERT',
        description: `This line item ("${item.description}") typically falls under Reverse Charge Mechanism (RCM).`,
        recommendation: 'Review if Reverse Charge (RCM) should be enabled for this transaction.'
      });
    }

    // 4. Mathematical accuracy of line tax calculation
    const expectedTax = Math.round((item.taxableValue * (item.taxRate / 100)) * 100) / 100;
    const actualTax = Math.round(item.taxAmount * 100) / 100;
    if (Math.abs(expectedTax - actualTax) > 1.0) {
      violations.push({
        field: 'taxAmount',
        severity: 'HIGH',
        category: 'VALUATION',
        description: `Line item tax amount ₹${actualTax} deviates significantly from calculated tax ₹${expectedTax} for a rate of ${item.taxRate}%.`,
        recommendation: 'Recalculate line-level tax split or adjust rounding thresholds.'
      });
    }

    return violations;
  }

  /**
   * Performs an absolute compliance audit on a full transaction (Invoice)
   */
  public static auditInvoice(invoice: Invoice, tenantGstin: string): RuleViolation[] {
    const violations: RuleViolation[] = [];

    // 1. Audit counter-party GSTIN format (for B2B category)
    if (invoice.type === 'B2B' && invoice.gstin) {
      if (!this.validateGSTIN(invoice.gstin)) {
        violations.push({
          field: 'gstin',
          severity: 'HIGH',
          category: 'FORMAT_ERROR',
          description: `Counter-party GSTIN "${invoice.gstin}" has an invalid structure.`,
          recommendation: 'Request a valid 15-character GSTIN from your customer or vendor.'
        });
      }

      // Check if state code in GSTIN matches place of supply
      const gstinState = invoice.gstin.substring(0, 2);
      if (invoice.category === 'SALES' && gstinState !== invoice.placeOfSupply) {
        violations.push({
          field: 'placeOfSupply',
          severity: 'MEDIUM',
          category: 'HSN_MISMATCH',
          description: `Place of Supply State Code "${invoice.placeOfSupply}" does not match the customer's GSTIN State Code prefix "${gstinState}".`,
          recommendation: 'Align the Place of Supply to customer\'s registered GST location to prevent tax-head assignment errors.'
        });
      }
    }

    // 2. Audit all contained line items
    const items = invoice.items || [];
    items.forEach(item => {
      const lineViolations = this.auditLineItem(item);
      violations.push(...lineViolations);
    });

    // 3. Verify total mathematical sums
    let computedTaxable = 0;
    let computedTax = 0;
    items.forEach(it => {
      computedTaxable += it.taxableValue;
      computedTax += it.taxAmount;
    });

    if (items.length > 0) {
      if (Math.abs(computedTaxable - invoice.amount) > 2.0) {
        violations.push({
          field: 'amount',
          severity: 'HIGH',
          category: 'VALUATION',
          description: `Invoice taxable sum ₹${invoice.amount} is inconsistent with summed line items total ₹${computedTaxable.toFixed(2)}.`,
          recommendation: 'Update invoice header subtotal to reflect consolidated line item values.'
        });
      }

      if (Math.abs(computedTax - invoice.taxAmount) > 2.0) {
        violations.push({
          field: 'taxAmount',
          severity: 'HIGH',
          category: 'VALUATION',
          description: `Invoice tax total ₹${invoice.taxAmount} does not match computed line items tax sum ₹${computedTax.toFixed(2)}.`,
          recommendation: 'Update invoice header tax totals to match sum of items.'
        });
      }
    }

    return violations;
  }
}
