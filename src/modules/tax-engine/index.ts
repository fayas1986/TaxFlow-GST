/**
 * Tax Calculation & Valuation Engine Module
 */
import { TenantContext } from '../../core/tenancy/types';

export class TaxEngineModule {
  public static calculateTax(params: { taxableAmount: number; supplierState: string; customerState: string; ratePercent: number }) {
    const isInterState = params.supplierState !== params.customerState;
    if (isInterState) {
      const igst = (params.taxableAmount * params.ratePercent) / 100;
      return { cgst: 0, sgst: 0, igst, cess: 0, totalTax: igst, totalAmount: params.taxableAmount + igst };
    } else {
      const halfRate = params.ratePercent / 2;
      const cgst = (params.taxableAmount * halfRate) / 100;
      const sgst = (params.taxableAmount * halfRate) / 100;
      return { cgst, sgst, igst: 0, cess: 0, totalTax: cgst + sgst, totalAmount: params.taxableAmount + cgst + sgst };
    }
  }
}
