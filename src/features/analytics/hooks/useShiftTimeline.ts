import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../services/api/client';
import { HISTORY_DATA_STALE_TIME_MS } from '../../shared/useHistoricalQueries';
import { toWidgetState } from './oeeWidgetState';
import { resolveActiveTimelineSegment } from './oeeTimelineSelection';
import { useDowntimeOverlay } from './useDowntimeOverlay';
import { OeeAnalyticsBase } from './useOeeAnalyticsBase';

/**
 * E31 (FAT-266): alur timeline halaman OEE — dipisah dari
 * `useOeeAnalytics` mengikuti aturan R4 (satu hook = satu alur data).
 * Memuat segmen timeline + overlay downtime (cursor pagination) dan
 * menyelesaikan segmen aktif; query lain halaman (rollup, pareto)
 * tinggal di hook domainnya sendiri. Menerima konteks bersama
 * (`useOeeAnalyticsBase`) sebagai parameter.
 *
 * Seleksi segmen tetap di fungsi murni `resolveActiveTimelineSegment`
 * (bukan di hook ini) — satu sumber kebenaran aturan seleksi, dipakai
 * tanpa duplikasi oleh komponen `ShiftTimeline`.
 */
export const useShiftTimeline = (base: OeeAnalyticsBase) => {
  const { canReadOee, filters, selectedMachine, shiftCode, shiftDate, resolvedDeviceId, timelineBucket, selectedSegmentIdx, queryKeys } = base;

  const timelineQuery = useQuery({
    queryKey: queryKeys.timeline,
    enabled: canReadOee.canInteract,
    staleTime: HISTORY_DATA_STALE_TIME_MS,
    queryFn: ({ signal }) =>
      apiClient.getShiftTimeline(selectedMachine, timelineBucket, signal, {
        from: filters.from,
        to: filters.to,
        date: shiftDate,
        shift: shiftCode,
      }),
  });

  // E12 T12.13 (X-6 / FAT-63): overlay downtime memakai paginasi cursor
  // (`useDowntimeOverlay`, useInfiniteQuery — pola yang sama dengan halaman
  // Downtime) agar segmen yang downtime_id-nya di luar 50 event pertama
  // tetap bisa dikorelasikan lewat "Muat lebih banyak" (gap G18).
  // Halaman pertama = aktif + 50 histori pertama (perilaku lama); halaman
  // lanjutan diakumulasi, dedup per id, aktif tetap menang atas histori.
  const downtimeOverlay = useDowntimeOverlay({
    queryKey: queryKeys.downtimeOverlay,
    deviceId: resolvedDeviceId ?? '',
    from: filters.from,
    to: filters.to,
    enabled: canReadOee.canInteract,
  });

  const timeline = timelineQuery.data ?? [];
  const downtimeMap = downtimeOverlay.downtimeMap;

  const totalTimelineMin = timeline.reduce((acc, seg) => acc + seg.duration_min, 0) || 480;
  // E12 T12.10: seleksi segmen aktif dihitung di `oeeTimelineSelection`
  // (fungsi murni — aturan: pilihan valid menang, bila tidak ada pakai
  // segmen downtime pertama).
  const { activeSegmentIdx, activeSegment, matchedDowntime } = resolveActiveTimelineSegment(
    timeline,
    selectedSegmentIdx,
    downtimeMap
  );

  return {
    timeline,
    totalTimelineMin,
    activeSegmentIdx,
    activeSegment,
    matchedDowntime,
    // E12 T12.13 (X-6 / FAT-63): hitungan + paginasi overlay downtime —
    // "menampilkan N dari M" (M null bila server tidak mengirim total).
    downtimeLoadedCount: downtimeOverlay.loadedCount,
    downtimeTotalCount: downtimeOverlay.totalCount,
    downtimeHasMore: downtimeOverlay.hasMore,
    downtimeIsLoading: downtimeOverlay.isLoading,
    fetchNextDowntimePage: downtimeOverlay.fetchNextPage,
    isFetchingNextDowntimePage: downtimeOverlay.isFetchingNextPage,
    // E12 T12.5 (U-2 / FAT-52): status loading/error widget timeline.
    timelineState: toWidgetState(timelineQuery),
    // Query mentah — dipakai `useOeeAnalytics` untuk gabungan status
    // halaman (`isLoading`/`isError`/`isRefreshing`) + `refetchAll`.
    timelineQuery,
    downtimeOverlay,
  };
};
