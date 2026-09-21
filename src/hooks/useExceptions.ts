/**
 * Hook: useExceptions
 * 
 * Centralized exception management hook consuming backend enterprise exceptions API.
 * Supports all 10 frozen discrepancy domains.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { enterpriseApiClient, EnterpriseApiError } from '../api/client';
import { EnterpriseException, ExceptionStatus } from '../api/contracts';

export const EXCEPTIONS_QUERY_KEY = ['compliance', 'exceptions'];

export interface ExceptionsQueryResult {
  exceptions: EnterpriseException[];
  totalCount: number;
}

export function useExceptions(domain?: string, status?: ExceptionStatus) {
  return useQuery<ExceptionsQueryResult, EnterpriseApiError>({
    queryKey: [...EXCEPTIONS_QUERY_KEY, { domain, status }],
    queryFn: async () => {
      return await enterpriseApiClient.getExceptions({ domain, status });
    },
    staleTime: 15000,
  });
}

export function useResolveException() {
  const queryClient = useQueryClient();

  return useMutation<
    EnterpriseException,
    EnterpriseApiError,
    { exceptionId: string; status: ExceptionStatus; comment?: string }
  >({
    mutationFn: async ({ exceptionId, status, comment }) => {
      return await enterpriseApiClient.updateExceptionStatus(exceptionId, status, comment);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXCEPTIONS_QUERY_KEY });
    },
  });
}
