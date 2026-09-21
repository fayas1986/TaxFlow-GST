import { Invoice, FilingRecord, FilingDataSummary } from '../../types';
import { GSTRuleEngine } from './ruleEngine';

export interface FilingPreCheckResult {
  passed: boolean;
  violationsCount: number;
  warningsCount: number;
  details: {
    ruleCode: string;
    description: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
  }[];
}

export interface GSTR1Payload {
  gstin: string;
  fp: string; // Filing period e.g. "082026"
  cur_gt: number; // Gross turnover
  b2b: {
    ctin: string; // Customer GSTIN
    inv: {
      inum: string; // Invoice Number
      idt: string; // Invoice Date
      val: number; // Invoice Value
      pos: string; // Place of supply
      rchg: string; // Reverse Charge ("Y" / "N")
      inv_typ: string; // "R" for regular, "SEZWP" etc
      itms: {
        num: number;
        itm_det: {
          rt: number; // Tax Rate
          txval: number; // Taxable Value
          iamt?: number; // IGST
          camt?: number; // CGST
          samt?: number; // SGST
        };
      }[];
    }[];
  }[];
  b2cs: {
    sply_ty: string; // Supply type: "INTER" or "INTRA"
    txval: number;
    rt: number;
    pos: string;
    iamt?: number;
    camt?: number;
    samt?: number;
  }[];
  hsn: {
    data: {
      num: number;
      hsn_sc: string; // HSN/SAC
      desc: string;
      uqc: string;
      qty: number;
      val: number;
      txval: number;
      rt: number;
      iamt?: number;
      camt?: number;
      samt?: number;
    }[];
  };
}

/**
 * GST Return Filing & Validation Engine (Module 07)
 * Handles auto-population of returns, GSTR schema marshalling, pre-filing validation audits,
 * and secure GSTN portal transmission handshakes.
 */
export class GSTFilingEngine {
  /**
   * Performs an absolute pre-compliance validation checklist on invoices mapped to a filing period
   */
  public static preCheckFiling(invoices: Invoice[], tenantGstin: string): FilingPreCheckResult {
    const details: { ruleCode: string; description: string; severity: 'HIGH' | 'MEDIUM' | 'LOW' }[] = [];
    let violationsCount = 0;
    let warningsCount = 0;

    // 1. Audit counter-party GSTINs
    const badGstins = invoices.filter(inv => inv.type === 'B2B' && inv.gstin && !GSTRuleEngine.validateGSTIN(inv.gstin));
    if (badGstins.length > 0) {
      violationsCount += badGstins.length;
      details.push({
        ruleCode: 'VAL_GSTIN_FORMAT',
        severity: 'HIGH',
        description: `${badGstins.length} customer invoices have structurally invalid GSTIN characters.`
      });
    }

    // 2. Audit HSN/SAC Mapping
    let unmappedHsnCount = 0;
    invoices.forEach(inv => {
      inv.items.forEach(item => {
        if (!item.hsnSac || !GSTRuleEngine.validateHSN(item.hsnSac)) {
          unmappedHsnCount++;
        }
      });
    });

    if (unmappedHsnCount > 0) {
      warningsCount += unmappedHsnCount;
      details.push({
        ruleCode: 'VAL_HSN_INTEGRITY',
        severity: 'MEDIUM',
        description: `${unmappedHsnCount} line items are missing valid HSN/SAC codes. Mandatory for GSTR-1 Table 12.`
      });
    }

    // 3. Audit Place Of Supply Alignment
    const posMismatches = invoices.filter(inv => {
      if (inv.type === 'B2B' && inv.gstin) {
        const expectedState = inv.gstin.substring(0, 2);
        return inv.placeOfSupply !== expectedState;
      }
      return false;
    });

    if (posMismatches.length > 0) {
      warningsCount += posMismatches.length;
      details.push({
        ruleCode: 'VAL_POS_ALIGNMENT',
        severity: 'MEDIUM',
        description: `${posMismatches.length} B2B invoices have Place of Supply state mismatch with customer's state code.`
      });
    }

    // 4. Mathematical rounding discrepancy checks
    let roundingDeviations = 0;
    invoices.forEach(inv => {
      let lineTotalTax = 0;
      inv.items.forEach(it => {
        lineTotalTax += it.taxAmount;
      });
      const invoiceTax = (inv.taxDetails?.cgst || 0) + (inv.taxDetails?.sgst || 0) + (inv.taxDetails?.igst || 0);
      if (Math.abs(lineTotalTax - invoiceTax) > 5.0) {
        roundingDeviations++;
      }
    });

    if (roundingDeviations > 0) {
      violationsCount += roundingDeviations;
      details.push({
        ruleCode: 'VAL_TAX_MATH_DISCREPANCY',
        severity: 'HIGH',
        description: `${roundingDeviations} transaction headers contain severe mathematical tax split discrepancies.`
      });
    }

    return {
      passed: violationsCount === 0,
      violationsCount,
      warningsCount,
      details
    };
  }

  /**
   * Compiles the official, portal-compliant GSTR-1 JSON schema payload based on sales invoices
   */
  public static generateGSTR1Payload(
    invoices: Invoice[],
    tenantGstin: string,
    periodCode: string // e.g. "082026"
  ): GSTR1Payload {
    const b2bMap: { [ctin: string]: any[] } = {};
    const b2csList: any[] = [];
    const hsnMap: { [key: string]: any } = {};

    let hsnNumIndex = 1;

    invoices.forEach(inv => {
      const isIntra = inv.placeOfSupply === tenantGstin.substring(0, 2) || !inv.placeOfSupply;

      // HSN aggregator
      inv.items.forEach(item => {
        const hsn = item.hsnSac || '998311';
        const rate = item.taxRate || 18;
        const key = `${hsn}-${rate}`;

        if (hsnMap[key]) {
          hsnMap[key].qty += item.quantity || 1;
          hsnMap[key].val += item.taxableValue + item.taxAmount;
          hsnMap[key].txval += item.taxableValue;
          if (isIntra) {
            hsnMap[key].camt = (hsnMap[key].camt || 0) + item.taxAmount / 2;
            hsnMap[key].samt = (hsnMap[key].samt || 0) + item.taxAmount / 2;
          } else {
            hsnMap[key].iamt = (hsnMap[key].iamt || 0) + item.taxAmount;
          }
        } else {
          hsnMap[key] = {
            num: hsnNumIndex++,
            hsn_sc: hsn,
            desc: item.description || 'Outward taxable supply',
            uqc: 'NOS',
            qty: item.quantity || 1,
            val: item.taxableValue + item.taxAmount,
            txval: item.taxableValue,
            rt: rate,
            ...(isIntra
              ? { camt: item.taxAmount / 2, samt: item.taxAmount / 2 }
              : { iamt: item.taxAmount })
          };
        }
      });

      // B2B Supples (Table 4A, 4B)
      if (inv.type === 'B2B' && inv.gstin) {
        const ctin = inv.gstin.trim().toUpperCase();
        if (!b2bMap[ctin]) {
          b2bMap[ctin] = [];
        }

        const itemsPayload = inv.items.map((item, idx) => {
          const expectedTax = item.taxAmount;
          return {
            num: idx + 1,
            itm_det: {
              rt: item.taxRate,
              txval: item.taxableValue,
              ...(isIntra
                ? { camt: expectedTax / 2, samt: expectedTax / 2 }
                : { iamt: expectedTax })
            }
          };
        });

        b2bMap[ctin].push({
          inum: inv.invoiceNumber,
          idt: inv.date,
          val: inv.amount + ((inv.taxDetails?.cgst || 0) + (inv.taxDetails?.sgst || 0) + (inv.taxDetails?.igst || 0)),
          pos: inv.placeOfSupply || '27',
          rchg: inv.isRcm ? 'Y' : 'N',
          inv_typ: 'R',
          itms: itemsPayload
        });
      } else {
        // B2C Supplies (Table 7)
        inv.items.forEach(item => {
          const totalTax = item.taxAmount;
          b2csList.push({
            sply_ty: isIntra ? 'INTRA' : 'INTER',
            txval: item.taxableValue,
            rt: item.taxRate,
            pos: inv.placeOfSupply || '27',
            ...(isIntra
              ? { camt: totalTax / 2, samt: totalTax / 2 }
              : { iamt: totalTax })
          });
        });
      }
    });

    // Assemble final structured list
    const b2bFormatted = Object.keys(b2bMap).map(ctin => ({
      ctin,
      inv: b2bMap[ctin]
    }));

    const hsnData = Object.values(hsnMap).map(h => ({
      ...h,
      // Round everything nicely to 2 decimals for government portals
      val: Math.round(h.val * 100) / 100,
      txval: Math.round(h.txval * 100) / 100,
      ...(h.iamt !== undefined ? { iamt: Math.round(h.iamt * 100) / 100 } : {}),
      ...(h.camt !== undefined ? { camt: Math.round(h.camt * 100) / 100 } : {}),
      ...(h.samt !== undefined ? { samt: Math.round(h.samt * 100) / 100 } : {})
    }));

    const totalTurnover = invoices.reduce((sum, i) => sum + i.amount, 0);

    return {
      gstin: tenantGstin,
      fp: periodCode,
      cur_gt: totalTurnover,
      b2b: b2bFormatted,
      b2cs: b2csList,
      hsn: { data: hsnData }
    };
  }
}
