import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../services/api/client';
import { HISTORY_DATA_STALE_TIME_MS, useTelemetryRollupQuery } from '../../shared/useHistoricalQueries';
import { toWidgetState } from './oeeWidgetState';
import { OeeAnalyticsBase } from './useOeeAnalyticsBase';

/**
 * E31 (FAT-266): alur rollup halaman OEE — dipisah dari
 * `useOeeAnalytics` mengikuti aturan R4 (satu hook = satu alur data).
 * Memuat ringkasan shift, OEE per jam, dan rollup multi-mesin; query
 * lain halaman (timeline, pareto) tinggal di hook domainnya sendiri.
 * Menerima konteks bersama (`useOeeAnalyticsBase`) sebagai parameter.
 */
export const useOeeRollup = (base: OeeAnalyticsBase) => {
  const { canReadOee, filters, selectedMachine, shiftCode, shiftDate, queryKeys } = base;

  // E11 T11.2 (F-2): periode (from/to) masuk queryKey + dikirim ke
  // server; bila filter shift aktif, kirim juga date/shift (API doc §I).
  const shiftSummaryQuery = useQuery({
    queryKey: queryKeys.shiftSummary,
    enabled: canReadOee.canInteract,
    staleTime: HISTORY_DATA_STALE_TIME_MS,
    queryFn: ({ signal }) =>
      apiClient.getShiftSummary(selectedMachine, signal, {
        from: filters.from,
        to: filters.to,
        date: shiftDate,
        shift: shiftCode,
        // E23 Batch 3 (FAT-196, N-27): minta hourly[] agar mapper bisa menurunkan parts dari Σ bucket (spec tidak mengirim counts); tanpa hourly parts = null.
        include_hourly: true,
      }),
  });

  const hourlyQuery = useQuery({
    queryKey: queryKeys.hourly,
    enabled: canReadOee.canInteract,
    staleTime: HISTORY_DATA_STALE_TIME_MS,
    queryFn: ({ signal }) =>
      apiClient.getOeeHourly(
        { machine_id: selectedMachine, from: filters.from, to: filters.to, date: shiftDate, shift: shiftCode },
        signal
      ),
  });

  const rollupQuery = useTelemetryRollupQuery(queryKeys.rollupFilters, undefined, canReadOee.canInteract);

  return {
    summary: shiftSummaryQuery.data ?? null,
    hourly: hourlyQuery.data ?? [],
    rollupRows: rollupQuery.data?.data ?? [],
    // E12 T12.5 (U-2 / FAT-52): status loading/error per widget untuk
    // skeleton / pesan kosong / error tiap widget (Guide §5, gap G17).
    summaryState: toWidgetState(shiftSummaryQuery),
    hourlyState: toWidgetState(hourlyQuery),
    rollupState: toWidgetState(rollupQuery),
    // Query mentah — dipakai `useOeeAnalytics` untuk gabungan status
    // halaman (`isLoading`/`isError`/`isRefreshing`) + `refetchAll`.
    shiftSummaryQuery,
    hourlyQuery,
    rollupQuery,
  };
};
