/**
 * Hook: useTaxExplainer
 * 
 * Fetches deterministic statutory tax calculation provenance from backend.
 * Zero client-side statutory tax logic.
 */

import { useMutation } from '@tanstack/react-query';
import { enterpriseApiClient, EnterpriseApiError } from '../api/client';
import { TaxExplainerResponse } from '../api/contracts';

export interface ExplainTaxPayload {
  docNumber: string;
  taxableValue: number;
  placeOfSupply: string;
  supplierGstin?: string;
  recipientGstin?: string;
  hsnSacCode?: string;
}

export function useTaxExplainer() {
  return useMutation<TaxExplainerResponse, EnterpriseApiError, ExplainTaxPayload>({
    mutationFn: async (payload) => {
      return await enterpriseApiClient.explainTax(payload.docNumber, payload as any);
    },
  });
}
