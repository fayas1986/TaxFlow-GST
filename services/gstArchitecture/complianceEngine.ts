/**
 * Target Architecture: Compliance Engine
 * Rule Engine, Tax Engine, Risk Engine
 */

import { CanonicalTransaction } from './transactionEngine';

export interface TaxCalculationResult {
  taxableAmount: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  totalTax: number;
  totalInvoiceAmount: number;
  isInterState: boolean;
  isRcm: boolean;
  rateBreakdown: Record<number, { taxable: number; igst: number; cgst: number; sgst: number; cess: number }>;
}

export interface ComplianceRuleResult {
  ruleId: string;
  ruleName: string;
  category: 'POS' | 'HSN' | 'RCM' | 'ITC_ELIGIBILITY' | 'SEZ_EXPORT' | 'THRESHOLD';
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'WARNING';
  statutoryRef: string;
  message: string;
}

export interface RiskEvaluationResult {
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number; // 0 to 100
  itcExposureAmount: number;
  flags: Array<{
    code: string;
    description: string;
    severity: 'INFO' | 'WARNING' | 'ALERT' | 'BLOCKING';
    recommendation: string;
  }>;
}

export class TaxEngine {
  static calculate(tx: CanonicalTransaction): TaxCalculationResult {
    const isInter = tx.isInterState;
    let totalTaxable = 0;
    let totalIgst = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalCess = 0;
    const rateBreakdown: Record<number, any> = {};

    tx.items.forEach(it => {
      const taxable = it.taxableValue;
      const rate = it.gstRate;
      const taxTotal = (taxable * rate) / 100;
      
      const igst = isInter ? taxTotal : 0;
      const cgst = !isInter ? taxTotal / 2 : 0;
      const sgst = !isInter ? taxTotal / 2 : 0;
      const cess = it.cessAmount || 0;

      totalTaxable += taxable;
      totalIgst += igst;
      totalCgst += cgst;
      totalSgst += sgst;
      totalCess += cess;

      if (!rateBreakdown[rate]) {
        rateBreakdown[rate] = { taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };
      }
      rateBreakdown[rate].taxable += taxable;
      rateBreakdown[rate].igst += igst;
      rateBreakdown[rate].cgst += cgst;
      rateBreakdown[rate].sgst += sgst;
      rateBreakdown[rate].cess += cess;
    });

    const totalTax = totalIgst + totalCgst + totalSgst + totalCess;

    return {
      taxableAmount: totalTaxable,
      igst: totalIgst,
      cgst: totalCgst,
      sgst: totalSgst,
      cess: totalCess,
      totalTax,
      totalInvoiceAmount: totalTaxable + totalTax,
      isInterState: isInter,
      isRcm: tx.isRcm,
      rateBreakdown
    };
  }
}

export class RuleEngine {
  static evaluate(tx: CanonicalTransaction): ComplianceRuleResult[] {
    const results: ComplianceRuleResult[] = [];

    // Rule 1: Place of Supply Rule (IGST Act Sec 10/12)
    const supplierState = tx.gstin.substring(0, 2);
    if (tx.placeOfSupply && tx.placeOfSupply.length === 2) {
      const isInter = supplierState !== tx.placeOfSupply;
      results.push({
        ruleId: 'RULE-POS-01',
        ruleName: 'Place of Supply Validation',
        category: 'POS',
        status: isInter === tx.isInterState ? 'COMPLIANT' : 'NON_COMPLIANT',
        statutoryRef: 'Section 10 & 12 of IGST Act, 2017',
        message: `Origin ${supplierState} to Destination ${tx.placeOfSupply} successfully classified as ${isInter ? 'Inter-State (IGST)' : 'Intra-State (CGST+SGST)'}.`
      });
    }

    // Rule 2: Reverse Charge Mechanism (Sec 9(3) / 9(4))
    const rcmHsns = ['9965', '9967', '9982', '9983'];
    const matchesRcmHsn = tx.items.some(it => rcmHsns.some(h => it.hsnCode.startsWith(h)));
    if (matchesRcmHsn && !tx.isRcm) {
      results.push({
        ruleId: 'RULE-RCM-02',
        ruleName: 'Potential Reverse Charge Category',
        category: 'RCM',
        status: 'WARNING',
        statutoryRef: 'Notification No. 13/2017-Central Tax (Rate)',
        message: 'HSN code belongs to GTA / Legal / Arbitral service category. Verify if recipient is liable under RCM.'
      });
    } else {
      results.push({
        ruleId: 'RULE-RCM-02',
        ruleName: 'RCM Liability Check',
        category: 'RCM',
        status: 'COMPLIANT',
        statutoryRef: 'Section 9(3) CGST Act',
        message: tx.isRcm ? 'RCM supply flagged: Recipient pays tax to govt directly.' : 'Standard forward charge mechanism applies.'
      });
    }

    // Rule 3: SEZ / Export Zero-Rating Check
    if (tx.isSez || tx.isExport) {
      results.push({
        ruleId: 'RULE-EXP-03',
        ruleName: 'Zero-Rated Supplies Treatment',
        category: 'SEZ_EXPORT',
        status: 'COMPLIANT',
        statutoryRef: 'Section 16 of IGST Act',
        message: `Supply to ${tx.isSez ? 'SEZ Unit/Developer' : 'Foreign Export'} classified as Zero-Rated with valid LUT endorsement.`
      });
    }

    // Rule 4: Blocked ITC Section 17(5)
    const blockedKeywords = ['motor vehicle', 'food', 'catering', 'club membership', 'beauty', 'health insurance'];
    const hasBlockedItem = tx.items.some(it => 
      blockedKeywords.some(kw => it.description.toLowerCase().includes(kw))
    );
    if (hasBlockedItem) {
      results.push({
        ruleId: 'RULE-ITC-04',
        ruleName: 'Section 17(5) Blocked Credit Detection',
        category: 'ITC_ELIGIBILITY',
        status: 'WARNING',
        statutoryRef: 'Section 17(5) of CGST Act, 2017',
        message: 'Line item description matches blocked credit category (motor vehicle/food/hospitality). Flagged for ITC ineligibility.'
      });
    } else {
      results.push({
        ruleId: 'RULE-ITC-04',
        ruleName: 'ITC Eligibility Evaluation',
        category: 'ITC_ELIGIBILITY',
        status: 'COMPLIANT',
        statutoryRef: 'Section 16(1) CGST Act',
        message: 'Input supply eligible for full business input tax credit offset.'
      });
    }

    return results;
  }
}

export class RiskEngine {
  static evaluateRisk(tx: CanonicalTransaction, ruleResults: ComplianceRuleResult[], dataQualityScore: number): RiskEvaluationResult {
    let riskScore = 100 - dataQualityScore; // higher score = higher risk
    const flags: RiskEvaluationResult['flags'] = [];
    let itcExposure = 0;

    // Check non-compliant rules
    ruleResults.forEach(r => {
      if (r.status === 'NON_COMPLIANT') {
        riskScore += 30;
        flags.push({
          code: r.ruleId,
          description: r.message,
          severity: 'BLOCKING',
          recommendation: `Rectify statutory parameter before dispatching to return ledger.`
        });
      } else if (r.status === 'WARNING') {
        riskScore += 15;
        flags.push({
          code: r.ruleId,
          description: r.message,
          severity: 'WARNING',
          recommendation: `Review line item classification to avoid future GSTR-9 audit scrutiny.`
        });
      }
    });

    // Check vendor rating
    if (tx.partyGstin && tx.partyGstin.startsWith('07')) {
      // simulated example of non-compliant vendor
      itcExposure = tx.totalTaxAmount;
    }

    let overallRiskLevel: RiskEvaluationResult['overallRiskLevel'] = 'LOW';
    if (riskScore >= 60) overallRiskLevel = 'CRITICAL';
    else if (riskScore >= 40) overallRiskLevel = 'HIGH';
    else if (riskScore >= 20) overallRiskLevel = 'MEDIUM';

    return {
      overallRiskLevel,
      riskScore: Math.min(100, riskScore),
      itcExposureAmount: itcExposure,
      flags
    };
  }
}
