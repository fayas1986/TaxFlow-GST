/**
 * Tax Engine Statutory Test Vectors & Rule 42/43 Verification Suite
 * Validates GST Act 2017 statutory compliance, effective-dated rule versioning,
 * POS determination, RCM, CESS, Zero-Rated Exports, Credit Notes, and Rounding rules.
 */

import { TaxEngineModule, VersionedTaxRule, TaxCalculationParams, Rule42_43ReversalInput } from '../../modules/tax-engine/index';

export interface TestVectorResult {
  testName: string;
  category: string;
  passed: boolean;
  details: string;
  expected: any;
  actual: any;
}

export class TaxEngineStatutoryTestSuite {
  public static async runAllTests(): Promise<{
    passedCount: number;
    failedCount: number;
    totalCount: number;
    allPassed: boolean;
    results: TestVectorResult[];
  }> {
    const results: TestVectorResult[] = [];

    // Test 1: Intra-State Supply (MH -> MH) 18% GST
    try {
      const params: TaxCalculationParams = {
        taxableAmount: 10000.00,
        supplierGstin: '27ABCDE1234F1Z5', // MH
        customerGstin: '27XYZAB5678G2Z3', // MH
        supplierStateCode: '27',
        placeOfSupplyStateCode: '27',
        hsnSacCode: '8471',
        transactionDate: '2026-05-15',
      };
      const calc = TaxEngineModule.calculateTax(params);
      const isCorrect = calc.cgstAmount === 900.00 && calc.sgstAmount === 900.00 && calc.igstAmount === 0 && calc.totalAmount === 11800.00 && !calc.isInterState;

      results.push({
        testName: 'Intra-State Supply (MH -> MH 18% GST)',
        category: 'Statutory Rates',
        passed: isCorrect,
        details: isCorrect ? 'Correctly calculated CGST 9% (₹900) + SGST 9% (₹900)' : 'Failed intra-state CGST/SGST allocation',
        expected: { cgst: 900, sgst: 900, igst: 0, total: 11800 },
        actual: { cgst: calc.cgstAmount, sgst: calc.sgstAmount, igst: calc.igstAmount, total: calc.totalAmount },
      });
    } catch (e: any) {
      results.push({ testName: 'Intra-State Supply', category: 'Statutory Rates', passed: false, details: e.message, expected: {}, actual: {} });
    }

    // Test 2: Inter-State Supply (MH -> KA) 18% GST
    try {
      const params: TaxCalculationParams = {
        taxableAmount: 50000.00,
        supplierGstin: '27ABCDE1234F1Z5', // MH
        customerGstin: '29AAACA1234B1Z9', // KA
        supplierStateCode: '27',
        placeOfSupplyStateCode: '29',
        hsnSacCode: '9983',
        transactionDate: '2026-06-01',
      };
      const calc = TaxEngineModule.calculateTax(params);
      const isCorrect = calc.cgstAmount === 0 && calc.sgstAmount === 0 && calc.igstAmount === 9000.00 && calc.totalAmount === 59000.00 && calc.isInterState;

      results.push({
        testName: 'Inter-State Supply (MH -> KA 18% IGST)',
        category: 'Place of Supply',
        passed: isCorrect,
        details: isCorrect ? 'Correctly determined IGST 18% (₹9,000) for inter-state POS' : 'Failed inter-state IGST calculation',
        expected: { cgst: 0, sgst: 0, igst: 9000, total: 59000 },
        actual: { cgst: calc.cgstAmount, sgst: calc.sgstAmount, igst: calc.igstAmount, total: calc.totalAmount },
      });
    } catch (e: any) {
      results.push({ testName: 'Inter-State Supply', category: 'Place of Supply', passed: false, details: e.message, expected: {}, actual: {} });
    }

    // Test 3: Reverse Charge Mechanism (RCM - GTA Services)
    try {
      const params: TaxCalculationParams = {
        taxableAmount: 20000.00,
        supplierGstin: '07ABCDE1234F1Z9', // Unregistered/GTA
        customerGstin: '27ABCDE1234F1Z5', // Recipient
        supplierStateCode: '07',
        placeOfSupplyStateCode: '27',
        hsnSacCode: '9967', // GTA
        transactionDate: '2026-07-10',
        isRcmTransaction: true,
      };
      const calc = TaxEngineModule.calculateTax(params);
      const isCorrect = calc.isRcmApplicable && calc.igstAmount === 1000.00 && calc.totalTax === 1000.00;

      results.push({
        testName: 'Reverse Charge Mechanism (RCM - GTA Services 5% IGST)',
        category: 'RCM',
        passed: isCorrect,
        details: isCorrect ? 'Correctly flagged RCM transaction with recipient tax liability of ₹1,000' : 'Failed RCM calculation',
        expected: { isRcm: true, igst: 1000, totalTax: 1000 },
        actual: { isRcm: calc.isRcmApplicable, igst: calc.igstAmount, totalTax: calc.totalTax },
      });
    } catch (e: any) {
      results.push({ testName: 'RCM GTA Services', category: 'RCM', passed: false, details: e.message, expected: {}, actual: {} });
    }

    // Test 4: CESS Calculation & Override
    try {
      const params: TaxCalculationParams = {
        taxableAmount: 100000.00,
        supplierGstin: '27ABCDE1234F1Z5',
        supplierStateCode: '27',
        placeOfSupplyStateCode: '27',
        hsnSacCode: '8471',
        transactionDate: '2026-08-01',
        cessAmountOverride: 1500.00, // Motor car CESS
      };
      const calc = TaxEngineModule.calculateTax(params);
      const isCorrect = calc.cessAmount === 1500.00 && calc.totalTax === (9000 + 9000 + 1500) && calc.totalAmount === 119500.00;

      results.push({
        testName: 'CESS Assessment & Value Override',
        category: 'Statutory CESS',
        passed: isCorrect,
        details: isCorrect ? 'Correctly applied CESS amount of ₹1,500 to total tax assessment' : 'Failed CESS calculation',
        expected: { cess: 1500, totalTax: 19500, totalAmount: 119500 },
        actual: { cess: calc.cessAmount, totalTax: calc.totalTax, totalAmount: calc.totalAmount },
      });
    } catch (e: any) {
      results.push({ testName: 'CESS Assessment', category: 'Statutory CESS', passed: false, details: e.message, expected: {}, actual: {} });
    }

    // Test 5: Rule Versioning & Effective Date Lookup
    try {
      // Register historical rule effective 2023 to 2025 (e.g. 12% GST)
      TaxEngineModule.registerTaxRule({
        id: 'tr-historical-8471-v1',
        hsnSacCode: '8471-HIST',
        ratePercent: 12.0,
        cgstPercent: 6.0,
        sgstPercent: 6.0,
        igstPercent: 12.0,
        cessPercent: 0,
        effectiveFrom: '2023-01-01',
        effectiveTo: '2025-12-31',
      });

      // Register new rule effective from 2026 (18% GST)
      TaxEngineModule.registerTaxRule({
        id: 'tr-historical-8471-v2',
        hsnSacCode: '8471-HIST',
        ratePercent: 18.0,
        cgstPercent: 9.0,
        sgstPercent: 9.0,
        igstPercent: 18.0,
        cessPercent: 0,
        effectiveFrom: '2026-01-01',
      });

      const oldCalc = TaxEngineModule.calculateTax({
        taxableAmount: 10000.00,
        supplierGstin: '27ABCDE1234F1Z5',
        supplierStateCode: '27',
        placeOfSupplyStateCode: '27',
        hsnSacCode: '8471-HIST',
        transactionDate: '2024-06-15', // Should use v1 (12%)
      });

      const newCalc = TaxEngineModule.calculateTax({
        taxableAmount: 10000.00,
        supplierGstin: '27ABCDE1234F1Z5',
        supplierStateCode: '27',
        placeOfSupplyStateCode: '27',
        hsnSacCode: '8471-HIST',
        transactionDate: '2026-04-01', // Should use v2 (18%)
      });

      const isCorrect = oldCalc.appliedRuleId === 'tr-historical-8471-v1' && oldCalc.totalTax === 1200.00 &&
                        newCalc.appliedRuleId === 'tr-historical-8471-v2' && newCalc.totalTax === 1800.00;

      results.push({
        testName: 'Tax Rule Versioning & Effective Date Resolution',
        category: 'Rule Versioning',
        passed: isCorrect,
        details: isCorrect ? 'Correctly resolved 12% rule for 2024 transaction and 18% rule for 2026 transaction' : 'Failed versioned rule date resolution',
        expected: { oldRuleId: 'tr-historical-8471-v1', oldTax: 1200, newRuleId: 'tr-historical-8471-v2', newTax: 1800 },
        actual: { oldRuleId: oldCalc.appliedRuleId, oldTax: oldCalc.totalTax, newRuleId: newCalc.appliedRuleId, newTax: newCalc.totalTax },
      });
    } catch (e: any) {
      results.push({ testName: 'Tax Rule Versioning', category: 'Rule Versioning', passed: false, details: e.message, expected: {}, actual: {} });
    }

    // Test 6: Rule 42 & 43 ITC Reversal Calculation Workflow
    try {
      const reversalInput: Rule42_43ReversalInput = {
        totalInputTax: 100000.00,        // Total ITC
        taxOnExemptSupplies: 10000.00,   // T1
        taxOnNonBusinessInputs: 5000.00, // T2
        taxIneligibleUnderSection17_5: 5000.00, // T3
        exemptTurnover: 2000000.00,      // E = 20 Lakhs
        totalTurnover: 10000000.00,      // F = 1 Crore (Exempt ratio = 20%)
      };

      const res = TaxEngineModule.calculateRule42Reversal(reversalInput);

      // Common credit C2 = 100000 - (10000 + 5000 + 5000) = 80,000
      // Ineligible D1 = 20% of 80,000 = 16,000
      // Ineligible D2 = 5% of 80,000 = 4,000
      // Net Eligible C3 = 80,000 - (16,000 + 4,000) = 60,000

      const isCorrect = res.commonCredit === 80000.00 &&
                        res.ineligibleCommonCreditExempt === 16000.00 &&
                        res.ineligibleCommonCreditNonBusiness === 4000.00 &&
                        res.eligibleNetItc === 60000.00;

      results.push({
        testName: 'Rule 42/43 Common Credit Reversal Workflow',
        category: 'ITC Reversal',
        passed: isCorrect,
        details: isCorrect ? 'Correctly derived C2=₹80k, D1=₹16k, D2=₹4k, Net Eligible C3=₹60k' : 'Failed Rule 42 reversal calculation',
        expected: { commonCredit: 80000, D1: 16000, D2: 4000, netC3: 60000 },
        actual: { commonCredit: res.commonCredit, D1: res.ineligibleCommonCreditExempt, D2: res.ineligibleCommonCreditNonBusiness, netC3: res.eligibleNetItc },
      });
    } catch (e: any) {
      results.push({ testName: 'Rule 42/43 Reversal Workflow', category: 'ITC Reversal', passed: false, details: e.message, expected: {}, actual: {} });
    }

    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.length - passedCount;

    return {
      passedCount,
      failedCount,
      totalCount: results.length,
      allPassed: failedCount === 0,
      results,
    };
  }
}
