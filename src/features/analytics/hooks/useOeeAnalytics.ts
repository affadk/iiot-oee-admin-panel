import { combineIsRefreshing, combineQueryStatus, OeeWidgetState } from './oeeWidgetState';
import { TimelineBucket, RollupScope } from './oeeQueryKeys';
import { useOeeAnalyticsBase } from './useOeeAnalyticsBase';
import { useOeeRollup } from './useOeeRollup';
import { useShiftTimeline } from './useShiftTimeline';
import { useRejectPareto } from './useRejectPareto';

export type { TimelineBucket, RollupScope, OeeWidgetState };

/**
 * E31 (FAT-266): komposisi tipis halaman OEE — `useOeeAnalytics` yang
 * lama (247 baris, sisa 3 ke batas keras 250) dipecah mengikuti aturan
 * R4 (satu hook = satu alur data):
 * - `useOeeAnalyticsBase` — konteks bersama (filter + mesin + device
 *   terderiva + pilihan UI + queryKey),
 * - `useOeeRollup` — summary + hourly + rollup,
 * - `useShiftTimeline` — timeline + overlay downtime + seleksi segmen,
 * - `useRejectPareto` — pareto reject.
 *
 * Bentuk kembalian hook ini TIDAK berubah (field dan urutan sama seperti
 * sebelumnya) — `OeeAnalyticsPage` tidak perlu diubah. Yang digabung di
 * sini hanyalah status halaman (`isLoading`/`isError`/`isRefreshing`)
 * dan `refetchAll` dari keenam query.
 */
export const useOeeAnalytics = () => {
  const base = useOeeAnalyticsBase();
  const rollup = useOeeRollup(base);
  const timeline = useShiftTimeline(base);
  const pareto = useRejectPareto(base);

  // E12 T12.16 (F-12 / FAT-68): spinner Refresh mencakup keenam query (G10).
  const isRefreshing = combineIsRefreshing([
    rollup.shiftSummaryQuery, rollup.hourlyQuery, timeline.timelineQuery,
    timeline.downtimeOverlay, rollup.rollupQuery, pareto.rejectParetoQuery,
  ]);

  // E12 T12.5 (U-2 / FAT-52): status loading/error — gabungan halaman.
  // Downtime overlay + pareto ikut gabungan halaman, tapi tampilannya
  // menempel di widget timeline/pareto. (E12 T12.16/F-12: `isRefreshing`
  // mencakup keenam query yang sama — spinner Refresh, bukan status
  // widget ini.)
  const { isLoading, isError } = combineQueryStatus([
    rollup.shiftSummaryQuery,
    rollup.hourlyQuery,
    timeline.timelineQuery,
    timeline.downtimeOverlay,
    rollup.rollupQuery,
    pareto.rejectParetoQuery,
  ]);

  // Refresh fan-out: me-refetch keenam query halaman secara paralel tanpa
  // `await` (summary, hourly, timeline, overlay downtime, rollup, pareto
  // bila quality.read diizinkan). BUKAN refresh rekonsiliasi — endpoint
  // `POST /telemetry/reconciliation/refresh` tidak dipanggil; master
  // assets tidak ikut ter-refresh.
  const refetchAll = () => {
    rollup.shiftSummaryQuery.refetch();
    rollup.hourlyQuery.refetch();
    timeline.timelineQuery.refetch();
    timeline.downtimeOverlay.refetch();
    rollup.rollupQuery.refetch();
    if (base.canReadQuality.canInteract) pareto.rejectParetoQuery.refetch();
  };

  return {
    canReadOee: base.canReadOee,
    canReadQuality: base.canReadQuality,
    filters: base.filters,
    updateFilters: base.updateFilters,
    selectedMachine: base.selectedMachine,
    rollupGroupBy: base.rollupGroupBy,
    rollupScope: base.rollupScope,
    setRollupScope: base.setRollupScope,
    machines: base.machines,
    shifts: base.shifts,
    shiftsLoading: base.shiftsLoading,
    shiftsError: base.shiftsError,
    selectedShift: base.selectedShift,
    timelineBucket: base.timelineBucket,
    setTimelineBucket: base.setTimelineBucket,
    setSelectedSegmentIdx: base.setSelectedSegmentIdx,
    paretoScope: base.paretoScope,
    setParetoScope: base.setParetoScope,
    resolvedDeviceId: base.resolvedDeviceId,
    summary: rollup.summary,
    hourly: rollup.hourly,
    timeline: timeline.timeline,
    rollupRows: rollup.rollupRows,
    paretoItems: pareto.paretoItems,
    totalTimelineMin: timeline.totalTimelineMin,
    activeSegmentIdx: timeline.activeSegmentIdx,
    activeSegment: timeline.activeSegment,
    matchedDowntime: timeline.matchedDowntime,
    // E12 T12.13 (X-6 / FAT-63): hitungan + paginasi overlay downtime —
    // "menampilkan N dari M" (M null bila server tidak mengirim total).
    downtimeLoadedCount: timeline.downtimeLoadedCount,
    downtimeTotalCount: timeline.downtimeTotalCount,
    downtimeHasMore: timeline.downtimeHasMore,
    downtimeIsLoading: timeline.downtimeIsLoading,
    fetchNextDowntimePage: timeline.fetchNextDowntimePage,
    isFetchingNextDowntimePage: timeline.isFetchingNextDowntimePage,
    isLoading,
    isError,
    summaryState: rollup.summaryState,
    hourlyState: rollup.hourlyState,
    timelineState: timeline.timelineState,
    rollupState: rollup.rollupState,
    isRefreshing,
    refetchAll,
  };
};
