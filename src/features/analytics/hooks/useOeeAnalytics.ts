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
import { resolveMachineDeviceId } from '../../shared/defaultDevice';

export type { TimelineBucket, RollupScope, OeeWidgetState };

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
  // E12 T12.10 (X-3 / FAT-57): scope rollup 'MACHINE' vs 'ALL' —
  // sengaja TIDAK di-reset saat ganti mesin (rollup 'ALL' tetap plant-wide).
  const [rollupScope, setRollupScope] = useState<RollupScope>('MACHINE');

  const { data: masterData } = useMasterAssetsQuery(canReadOee.canInteract);
  const machines = masterData?.machines ?? [];

  // E12 T12.1 (X-1 / FAT-54): daftar shift untuk pemilih shift + kode
  // shift yang dikirim ke shift-summary/timeline (API doc §I `?date=&shift=`).
  // E28 Batch B (FAT-220, E2E-06): loading/error query shift diteruskan
  // ke halaman — peringatan "tidak tersedia" hanya setelah query gagal.
  const shiftsQuery = useShiftsQuery(canReadOee.canInteract);
  const shifts = shiftsQuery.data?.data ?? [];
  const selectedShift = shifts.find((s) => s.shiftId === filters.shiftId);
  const shiftCode = selectedShift?.shiftCode;
  const shiftDate = filters.shiftDate;

  // E28 Batch B (FAT-170, N-2): ikatan mesin utama; fallback dari daftar
  // live, bukan hardcode 'STM32-OEE-01' (daftar kosong → `undefined`).
  const resolvedDeviceId = useMemo(
    () => resolveMachineDeviceId(machines, masterData?.devices ?? [], selectedMachine),
    [machines, masterData, selectedMachine]
  );

  // E12 T12.9 (X-2 / FAT-62): semua queryKey dibangun dari satu fungsi
  // murni (`oeeQueryKeys`) — semuanya memuat from/to (gap G1).
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

  const rollupFilters = queryKeys.rollupFilters;
  const rollupQuery = useTelemetryRollupQuery(rollupFilters, undefined, canReadOee.canInteract);

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
    shiftsLoading: shiftsQuery.isLoading,
    shiftsError: shiftsQuery.isError,
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
