import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../services/api/client';
import { TelemetryRollupGroupBy } from '../../../types/analytics';
import { useCapability } from '../../../context/AuthContext';
import { useHistoryFilters } from '../../shared/historyFilters';
import {
  HISTORY_DATA_STALE_TIME_MS,
  useMasterAssetsQuery,
  useShiftsQuery,
  useTelemetryRollupQuery,
} from '../../shared/useHistoricalQueries';
import { combineIsRefreshing, combineQueryStatus, OeeWidgetState, toWidgetState } from './oeeWidgetState';
import { buildOeeAnalyticsQueryKeys, RollupScope, TimelineBucket } from './oeeQueryKeys';
import { resolveActiveTimelineSegment } from './oeeTimelineSelection';
import { useDowntimeOverlay } from './useDowntimeOverlay';
import { DEFAULT_ROLLUP_GROUP_BY, DEFAULT_TIMELINE_BUCKET } from '../telemetryDefaults';

export type { TimelineBucket, RollupScope };

export type { OeeWidgetState };

export const useOeeAnalytics = () => {
  const canReadOee = useCapability('oee.read');
  const canReadQuality = useCapability('quality.read');

  const { filters, updateFilters } = useHistoryFilters({
    machineId: 'CNC-MILLING-01',
    groupBy: DEFAULT_ROLLUP_GROUP_BY,
    limit: 20,
  });

  const selectedMachine = filters.machineId || 'CNC-MILLING-01';
  const rollupGroupBy: TelemetryRollupGroupBy = filters.groupBy ?? DEFAULT_ROLLUP_GROUP_BY;
  const [timelineBucket, setTimelineBucket] = useState<TimelineBucket>(DEFAULT_TIMELINE_BUCKET);
  const [selectedSegmentIdx, setSelectedSegmentIdx] = useState<number | null>(null);
  const [paretoScope, setParetoScope] = useState<'GLOBAL' | 'DEVICE'>('GLOBAL');
  // E12 T12.10 (X-3 / FAT-57): scope rollup — 'MACHINE' (default, perilaku
  // E11 T11.3) vs 'ALL' (plant-wide). State ini sengaja TIDAK di-reset
  // saat ganti mesin: bila scope 'ALL', ganti mesin tidak diam-diam
  // mengembalikan rollup ke mesin — rollup tetap plant-wide sampai
  // pengguna sendiri mengubah toggle-nya.
  const [rollupScope, setRollupScope] = useState<RollupScope>('MACHINE');

  const { data: masterData } = useMasterAssetsQuery(canReadOee.canInteract);
  const machines = masterData?.machines ?? [];

  // E12 T12.1 (X-1 / FAT-54): daftar shift (definisi Shift.startTime /
  // endTime) untuk pemilih shift + kode shift yang dikirim ke
  // shift-summary/timeline (API doc §I `?date=&shift=`).
  const { data: shiftsPage } = useShiftsQuery(canReadOee.canInteract);
  const shifts = shiftsPage?.data ?? [];
  const selectedShift = shifts.find((s) => s.shiftId === filters.shiftId);
  const shiftCode = selectedShift?.shiftCode;
  const shiftDate = filters.shiftDate;

  const resolvedDeviceId = useMemo(() => {
    const matched = machines.find((m) => m.machine_id === selectedMachine);
    return matched?.bound_device_id ?? matched?.boundDevice?.device_id ?? 'STM32-OEE-01';
  }, [machines, selectedMachine]);

  // E12 T12.9 (X-2 / FAT-62): semua queryKey halaman dibangun dari satu
  // fungsi murni (`oeeQueryKeys`) — semuanya memuat from/to, sehingga
  // mengganti rentang di pemilih periode me-refetch summary, hourly,
  // timeline, rollup, DAN downtime overlay (gap G1).
  const queryKeys = buildOeeAnalyticsQueryKeys({
    machineId: selectedMachine,
    deviceId: resolvedDeviceId,
    from: filters.from,
    to: filters.to,
    shiftDate,
    shiftId: filters.shiftId,
    timelineBucket,
    rollupGroupBy,
    rollupScope,
    baseFilters: filters,
  });

  // E11 T11.2 (F-2): periode (filters.from/to — sama dengan hourly) masuk
  // queryKey + dikirim ke server, sehingga ganti periode via URL me-refetch
  // summary/timeline juga; satu halaman, satu periode (gap G1).
  // E12 T12.1 (X-1 / FAT-54): bila filter shift aktif, kirim juga
  // date/shift (API doc §I) + masukkan ke queryKey supaya ganti shift
  // me-refetch; from/to sudah jendela shift itu.
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
    deviceId: resolvedDeviceId,
    from: filters.from,
    to: filters.to,
    enabled: canReadOee.canInteract,
  });

  const rollupFilters = queryKeys.rollupFilters;
  const rollupQuery = useTelemetryRollupQuery(rollupFilters, undefined, canReadOee.canInteract);

  const rejectParetoQuery = useQuery({
    queryKey: ['quality-rejects', paretoScope, resolvedDeviceId],
    enabled: canReadQuality.canInteract,
    staleTime: HISTORY_DATA_STALE_TIME_MS,
    queryFn: ({ signal }) =>
      paretoScope === 'GLOBAL'
        ? apiClient.getRejectParetoGlobal(signal)
        : apiClient.getRejectPareto(resolvedDeviceId, signal),
  });

  const summary = shiftSummaryQuery.data ?? null;
  const hourly = hourlyQuery.data ?? [];
  const timeline = timelineQuery.data ?? [];
  const downtimeMap = downtimeOverlay.downtimeMap;
  const rollupRows = rollupQuery.data?.data ?? [];
  const paretoItems = rejectParetoQuery.data ?? [];

  const totalTimelineMin = timeline.reduce((acc, seg) => acc + seg.duration_min, 0) || 480;
  // E12 T12.10: seleksi segmen aktif dihitung di `oeeTimelineSelection`
  // (fungsi murni — aturan: pilihan valid menang, bila tidak ada pakai
  // segmen downtime pertama).
  const { activeSegmentIdx, activeSegment, matchedDowntime } = resolveActiveTimelineSegment(
    timeline,
    selectedSegmentIdx,
    downtimeMap
  );

  // E12 T12.16 (F-12 / FAT-68): spinner Refresh mencakup keenam query (G10).
  const isRefreshing = combineIsRefreshing([
    shiftSummaryQuery, hourlyQuery, timelineQuery,
    downtimeOverlay, rollupQuery, rejectParetoQuery,
  ]);

  // E12 T12.5 (U-2 / FAT-52): status loading/error — gabungan halaman +
  // per widget (summary/hourly/timeline/rollup) untuk skeleton / pesan
  // kosong / error tiap widget (Guide §5, gap G17). Downtime overlay +
  // pareto ikut gabungan halaman, tapi tampilannya menempel di widget
  // timeline/pareto. (E12 T12.16/F-12: `isRefreshing` mencakup keenam
  // query yang sama — spinner Refresh, bukan status widget ini.)
  const summaryState = toWidgetState(shiftSummaryQuery);
  const hourlyState = toWidgetState(hourlyQuery);
  const timelineState = toWidgetState(timelineQuery);
  const rollupState = toWidgetState(rollupQuery);
  const { isLoading, isError } = combineQueryStatus([
    shiftSummaryQuery,
    hourlyQuery,
    timelineQuery,
    downtimeOverlay,
    rollupQuery,
    rejectParetoQuery,
  ]);

  // Refresh fan-out: me-refetch keenam query halaman secara paralel tanpa
  // `await` (summary, hourly, timeline, overlay downtime, rollup, pareto
  // bila quality.read diizinkan). BUKAN refresh rekonsiliasi — endpoint
  // `POST /telemetry/reconciliation/refresh` tidak dipanggil; master
  // assets tidak ikut ter-refresh.
  const refetchAll = () => {
    shiftSummaryQuery.refetch();
    hourlyQuery.refetch();
    timelineQuery.refetch();
    downtimeOverlay.refetch();
    rollupQuery.refetch();
    if (canReadQuality.canInteract) rejectParetoQuery.refetch();
  };

  return {
    canReadOee,
    canReadQuality,
    filters,
    updateFilters,
    selectedMachine,
    rollupGroupBy,
    rollupScope,
    setRollupScope,
    machines,
    shifts,
    selectedShift,
    timelineBucket,
    setTimelineBucket,
    setSelectedSegmentIdx,
    paretoScope,
    setParetoScope,
    resolvedDeviceId,
    summary,
    hourly,
    timeline,
    rollupRows,
    paretoItems,
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
    isLoading,
    isError,
    summaryState,
    hourlyState,
    timelineState,
    rollupState,
    isRefreshing,
    refetchAll,
  };
};
