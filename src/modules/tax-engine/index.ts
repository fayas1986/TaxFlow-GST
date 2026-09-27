/**
 * Deterministic Versioned Tax Engine & Ledger Core
 * Handles POS, CGST/SGST/IGST, CESS, RCM, Rule 42/43, and Versioned Effective-Dated Tax Rules.
 */
import { TenantContext } from '../../core/tenancy/types';

export interface VersionedTaxRule {
  id: string;
  hsnSacCode: string;
  ratePercent: number;
  cgstPercent: number;
  sgstPercent: number;
  igstPercent: number;
  cessPercent: number;
  effectiveFrom: string; // ISO date 'YYYY-MM-DD'
  effectiveTo?: string;  // ISO date or undefined for active
  rcmApplicable?: boolean;
}

export interface TaxCalculationParams {
  taxableAmount: number;
  supplierGstin: string;
  customerGstin?: string;
  placeOfSupplyStateCode: string; // e.g. '27' for Maharashtra, '07' for Delhi
  supplierStateCode: string;      // e.g. '27'
  hsnSacCode: string;
  transactionDate: string;        // ISO Date 'YYYY-MM-DD'
  isRcmTransaction?: boolean;
  cessAmountOverride?: number;
}

export interface TaxCalculationResult {
  taxableAmount: number;
  isInterState: boolean;
  hsnSacCode: string;
  appliedRuleId: string;
  effectiveTaxRate: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cessRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  totalTax: number;
  totalAmount: number;
  isRcmApplicable: boolean;
  posStateCode: string;
}

export interface Rule42_43ReversalInput {
  totalInputTax: number; // T
  taxOnExemptSupplies: number; // T1
  taxOnNonBusinessInputs: number; // T2
  taxIneligibleUnderSection17_5: number; // T3
  exemptTurnover: number; // E
  totalTurnover: number; // F
}

export interface Rule42_43ReversalResult {
  commonCredit: number; // C2 = T - (T1 + T2 + T3)
  ineligibleCommonCreditExempt: number; // D1 = (E/F) * C2
  ineligibleCommonCreditNonBusiness: number; // D2 = 5% of C2
  eligibleNetItc: number; // C3 = C2 - (D1 + D2)
}

/**
 * Built-in Versioned Tax Rules Register
 */
const DEFAULT_VERSIONED_TAX_RULES: VersionedTaxRule[] = [
  // HSN 8471 - Laptops / Computers (18% under GST)
  {
    id: 'tr-8471-2017',
    hsnSacCode: '8471',
    ratePercent: 18.0,
    cgstPercent: 9.0,
    sgstPercent: 9.0,
    igstPercent: 18.0,
    cessPercent: 0,
    effectiveFrom: '2017-07-01',
  },
  // HSN 9983 - IT & Software Professional Services (18%)
  {
    id: 'tr-9983-2017',
    hsnSacCode: '9983',
    ratePercent: 18.0,
    cgstPercent: 9.0,
    sgstPercent: 9.0,
    igstPercent: 18.0,
    cessPercent: 0,
    effectiveFrom: '2017-07-01',
  },
  // HSN 9967 - Goods Transport Agency Services (RCM Applicable 5% / Direct 12%)
  {
    id: 'tr-9967-2017',
    hsnSacCode: '9967',
    ratePercent: 5.0,
    cgstPercent: 2.5,
    sgstPercent: 2.5,
    igstPercent: 5.0,
    cessPercent: 0,
    effectiveFrom: '2017-07-01',
    rcmApplicable: true,
  },
  // Default fallback rule for general goods (18%)
  {
    id: 'tr-general-18',
    hsnSacCode: 'DEFAULT_18',
    ratePercent: 18.0,
    cgstPercent: 9.0,
    sgstPercent: 9.0,
    igstPercent: 18.0,
    cessPercent: 0,
    effectiveFrom: '2017-07-01',
  },
];

export class TaxEngineModule {
  private static customRules: VersionedTaxRule[] = [];

  public static registerTaxRule(rule: VersionedTaxRule) {
    this.customRules.push(rule);
  }

  /**
   * Resolves effective-dated tax rule for a given HSN/SAC code and transaction date
   */
  public static resolveEffectiveRule(hsnSacCode: string, transactionDate: string): VersionedTaxRule {
    const targetDate = new Date(transactionDate).getTime();

    const allRules = [...this.customRules, ...DEFAULT_VERSIONED_TAX_RULES];

    const matchingRule = allRules.find((rule) => {
      if (rule.hsnSacCode !== hsnSacCode && rule.hsnSacCode !== 'DEFAULT_18') {
        return false;
      }

      const fromTime = new Date(rule.effectiveFrom).getTime();
      const toTime = rule.effectiveTo ? new Date(rule.effectiveTo).getTime() : Infinity;

      return targetDate >= fromTime && targetDate <= toTime;
    });

    if (matchingRule) {
      return matchingRule;
    }

    return DEFAULT_VERSIONED_TAX_RULES[DEFAULT_VERSIONED_TAX_RULES.length - 1];
  }

  /**
   * Performs deterministic tax calculation with POS and RCM evaluation
   */
  public static calculateTax(params: TaxCalculationParams): TaxCalculationResult {
    const rule = this.resolveEffectiveRule(params.hsnSacCode, params.transactionDate);

    // Place of Supply vs Supplier State determines Inter-State (IGST) vs Intra-State (CGST+SGST)
    const isInterState = params.supplierStateCode !== params.placeOfSupplyStateCode;

    const isRcm = params.isRcmTransaction !== undefined ? params.isRcmTransaction : !!rule.rcmApplicable;

    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    let cessAmount = params.cessAmountOverride !== undefined
      ? params.cessAmountOverride
      : (params.taxableAmount * (rule.cessPercent || 0)) / 100;

    if (isInterState) {
      igstAmount = Number(((params.taxableAmount * rule.igstPercent) / 100).toFixed(2));
    } else {
      cgstAmount = Number(((params.taxableAmount * rule.cgstPercent) / 100).toFixed(2));
      sgstAmount = Number(((params.taxableAmount * rule.sgstPercent) / 100).toFixed(2));
    }

    const totalTax = Number((cgstAmount + sgstAmount + igstAmount + cessAmount).toFixed(2));
    const totalAmount = Number((params.taxableAmount + totalTax).toFixed(2));

    return {
      taxableAmount: params.taxableAmount,
      isInterState,
      hsnSacCode: params.hsnSacCode,
      appliedRuleId: rule.id,
      effectiveTaxRate: rule.ratePercent,
      cgstRate: isInterState ? 0 : rule.cgstPercent,
      sgstRate: isInterState ? 0 : rule.sgstPercent,
      igstRate: isInterState ? rule.igstPercent : 0,
      cessRate: rule.cessPercent || 0,
      cgstAmount,
      sgstAmount,
      igstAmount,
      cessAmount,
      totalTax,
      totalAmount,
      isRcmApplicable: isRcm,
      posStateCode: params.placeOfSupplyStateCode,
    };
  }

  /**
   * Calculates Rule 42 & 43 ITC Reversal for exempt / non-business supplies
   */
  public static calculateRule42Reversal(input: Rule42_43ReversalInput): Rule42_43ReversalResult {
    // T = Total Input Tax
    // C1 = T - (T1 + T2 + T3) -> Tax credited to electronic credit ledger
    const T1 = input.taxOnExemptSupplies || 0;
    const T2 = input.taxOnNonBusinessInputs || 0;
    const T3 = input.taxIneligibleUnderSection17_5 || 0;

    const commonCredit = Math.max(0, input.totalInputTax - (T1 + T2 + T3));

    // D1 = (Exempt Turnover / Total Turnover) * C2
    const turnoverRatio = input.totalTurnover > 0 ? input.exemptTurnover / input.totalTurnover : 0;
    const ineligibleCommonCreditExempt = Number((turnoverRatio * commonCredit).toFixed(2));

    // D2 = 5% of Common Credit for Non-Business Use
    const ineligibleCommonCreditNonBusiness = Number((0.05 * commonCredit).toFixed(2));

    const eligibleNetItc = Number((commonCredit - (ineligibleCommonCreditExempt + ineligibleCommonCreditNonBusiness)).toFixed(2));

    return {
      commonCredit,
      ineligibleCommonCreditExempt,
      ineligibleCommonCreditNonBusiness,
      eligibleNetItc: Math.max(0, eligibleNetItc),
    };
  }
}
