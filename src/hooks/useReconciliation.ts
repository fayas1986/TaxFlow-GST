/**
 * Hook: useReconciliation
 * 
 * Manages multi-evidence reconciliation sources and matching datasets.
 */

import { useQuery } from '@tanstack/react-query';
import { enterpriseApiClient, EnterpriseApiError } from '../api/client';
import { ReconciliationEvidenceSource } from '../api/contracts';

export const RECON_QUERY_KEY = ['compliance', 'reconciliation'];

export function useReconciliationEvidenceSources() {
  return useQuery<ReconciliationEvidenceSource[], EnterpriseApiError>({
    queryKey: [...RECON_QUERY_KEY, 'evidence-sources'],
    queryFn: async () => {
      return await enterpriseApiClient.getReconciliationEvidenceSources();
    },
    staleTime: 60000,
  });
}
