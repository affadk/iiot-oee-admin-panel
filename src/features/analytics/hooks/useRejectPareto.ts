import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../services/api/client';
import { HISTORY_DATA_STALE_TIME_MS } from '../../shared/useHistoricalQueries';
import { OeeAnalyticsBase } from './useOeeAnalyticsBase';

/**
 * E31 (FAT-266): alur pareto reject halaman OEE — dipisah dari
 * `useOeeAnalytics` mengikuti aturan R4 (satu hook = satu alur data).
 * Satu query (pareto global vs per-device mengikuti scope); query lain
 * halaman (rollup, timeline) tinggal di hook domainnya sendiri.
 * Menerima konteks bersama (`useOeeAnalyticsBase`) sebagai parameter.
 */
export const useRejectPareto = (base: OeeAnalyticsBase) => {
  const { canReadQuality, paretoScope, resolvedDeviceId } = base;

  const rejectParetoQuery = useQuery({
    queryKey: ['quality-rejects', paretoScope, resolvedDeviceId],
    // E28 Batch B (FAT-170): scope DEVICE tanpa device → jangan query.
    enabled: canReadQuality.canInteract && (paretoScope === 'GLOBAL' || Boolean(resolvedDeviceId)),
    staleTime: HISTORY_DATA_STALE_TIME_MS,
    queryFn: ({ signal }) =>
      paretoScope === 'GLOBAL'
        ? apiClient.getRejectParetoGlobal(signal)
        : apiClient.getRejectPareto(resolvedDeviceId ?? '', signal),
  });

  return {
    paretoItems: rejectParetoQuery.data ?? [],
    // Query mentah — dipakai `useOeeAnalytics` untuk gabungan status
    // halaman (`isLoading`/`isError`/`isRefreshing`) + `refetchAll`.
    rejectParetoQuery,
  };
};
