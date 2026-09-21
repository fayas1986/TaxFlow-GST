/**
 * Hook: usePeriodControl
 * 
 * Manages financial period state transitions and status queries via TanStack Query.
 * Intercepts HTTP 423 Locked errors and enforces state machine integrity.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { enterpriseApiClient, EnterpriseApiError } from '../api/client';
import { TaxPeriodStatus, PeriodTransitionRequest, PeriodState } from '../api/contracts';
import { useEntityContextStore } from '../stores/useEntityContextStore';

export const PERIOD_QUERY_KEY = ['compliance', 'period'];

export function usePeriodStatus(periodOverride?: string) {
  const storePeriod = useEntityContextStore((s) => s.activePeriod);
  const period = periodOverride || storePeriod;

  return useQuery<TaxPeriodStatus, EnterpriseApiError>({
    queryKey: [...PERIOD_QUERY_KEY, 'status', period],
    queryFn: async () => {
      return await enterpriseApiClient.getPeriodStatus(period);
    },
    staleTime: 30000,
    retry: (failureCount, error) => {
      // Don't retry on 423 Locked or 400 Bad Request
      if (error?.status === 423 || error?.status === 400) return false;
      return failureCount < 2;
    }
  });
}

export function useTransitionPeriod() {
  const queryClient = useQueryClient();
  const setActivePeriodInStore = useEntityContextStore((s) => s.setActivePeriod);

  return useMutation<TaxPeriodStatus, EnterpriseApiError, PeriodTransitionRequest>({
    mutationFn: async (req) => {
      return await enterpriseApiClient.transitionPeriod(req);
    },
    onSuccess: (updatedStatus, variables) => {
      // Invalidate queries so all dependent UI components refresh
      queryClient.invalidateQueries({ queryKey: PERIOD_QUERY_KEY });
      // Update global period store if period was changed
      if (variables.period) {
        setActivePeriodInStore(variables.period);
      }
    },
  });
}
