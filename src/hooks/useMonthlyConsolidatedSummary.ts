/**
 * Hook: useMonthlyConsolidatedSummary
 * 
 * Production TanStack Query hook that fetches the monthly consolidated GST summary
 * from the backend enterprise analytics API.
 * 
 * Architectural Invariants:
 * 1. Strictly a client consumer; backend engine computes aggregate multi-entity metrics.
 * 2. Injects tenant, company, GSTIN, branch, and tax-period entity context automatically.
 * 3. Enforces typed loading, fetching, and error states (including HTTP 423 Locked period handling).
 * 4. Provides granular error categorization conforming to RFC 7807 problem details.
 */

import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { enterpriseApiClient, EnterpriseApiError } from '../api/client';
import { MonthlyConsolidatedGstSummaryDto } from '../api/contracts';
import { useEntityContextStore } from '../stores/useEntityContextStore';

export const CONSOLIDATED_SUMMARY_QUERY_KEY = ['analytics', 'monthly-consolidated-summary'] as const;

export interface UseMonthlyConsolidatedGstSummaryOptions {
  groupId?: string;
  timeRange?: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  period?: string;
  gstin?: string;
  branchId?: string;
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
  retry?: boolean | number;
}

export type UseMonthlyConsolidatedGstSummaryResult = UseQueryResult<MonthlyConsolidatedGstSummaryDto, EnterpriseApiError> & {
  // Enhanced Convenience Properties for Architectural UX & Error Handling
  isLockedPeriod: boolean;
  errorMessage: string | null;
  correlationId: string | null;
  hasData: boolean;
};

/**
 * Custom TanStack Query Hook to fetch Consolidated Monthly GST Summary across subsidiaries.
 */
export function useMonthlyConsolidatedGstSummary(
  options: UseMonthlyConsolidatedGstSummaryOptions = {}
): UseMonthlyConsolidatedGstSummaryResult {
  const storeGroupId = useEntityContextStore((s) => s.activeHoldingGroupId);
  const storePeriod = useEntityContextStore((s) => s.activePeriod);
  const storeGstin = useEntityContextStore((s) => s.activeGstin);
  const storeBranchId = useEntityContextStore((s) => s.activeBranchId);

  const resolvedGroupId = options.groupId ?? storeGroupId ?? undefined;
  const resolvedPeriod = options.period ?? storePeriod ?? '2026-09';
  const resolvedTimeRange = options.timeRange ?? 'MONTHLY';
  const resolvedGstin = options.gstin ?? storeGstin ?? undefined;
  const resolvedBranchId = options.branchId ?? storeBranchId ?? undefined;

  const queryKey = [
    ...CONSOLIDATED_SUMMARY_QUERY_KEY,
    {
      groupId: resolvedGroupId,
      period: resolvedPeriod,
      timeRange: resolvedTimeRange,
      gstin: resolvedGstin,
      branchId: resolvedBranchId,
    }
  ] as const;

  const query = useQuery<MonthlyConsolidatedGstSummaryDto, EnterpriseApiError>({
    queryKey,
    queryFn: async () => {
      return await enterpriseApiClient.getMonthlyConsolidatedGstSummary({
        groupId: resolvedGroupId,
        timeRange: resolvedTimeRange,
        period: resolvedPeriod,
        gstin: resolvedGstin,
        branchId: resolvedBranchId,
      });
    },
    enabled: options.enabled ?? true,
    staleTime: options.staleTime ?? 30000, // 30s cache freshness
    refetchInterval: options.refetchInterval ?? false,
    retry: (failureCount, error) => {
      if (typeof options.retry === 'number') return failureCount < options.retry;
      if (typeof options.retry === 'boolean') return options.retry;

      // Do not retry client 400 Bad Request or 423 Locked errors
      if (error?.status === 400 || error?.status === 423 || error?.code === 'PERIOD_LOCKED') {
        return false;
      }
      return failureCount < 2;
    }
  });

  // Calculate enhanced contract status indicators
  const isLockedPeriod = query.error?.status === 423 || query.error?.code === 'PERIOD_LOCKED';
  const correlationId = query.data?.correlationId || query.error?.correlationId || null;
  
  let errorMessage: string | null = null;
  if (query.error) {
    if (isLockedPeriod) {
      errorMessage = `Tax Period ${resolvedPeriod} is officially locked. Data is presented in statutory read-only audit mode.`;
    } else if (query.error.status === 403) {
      errorMessage = 'Insufficient executive privileges to view group-level consolidated summary.';
    } else if (query.error.status === 404) {
      errorMessage = `No consolidated GST records found for period ${resolvedPeriod}.`;
    } else {
      errorMessage = query.error.message || 'Failed to retrieve consolidated GST summary from backend server.';
    }
  }

  return {
    ...query,
    isLockedPeriod,
    errorMessage,
    correlationId,
    hasData: !!query.data,
  };
}

/**
 * Invalidation Hook to refresh consolidated summary caches on state changes
 */
export function useInvalidateConsolidatedSummary() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: CONSOLIDATED_SUMMARY_QUERY_KEY });
}
