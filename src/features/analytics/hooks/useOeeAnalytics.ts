import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../services/api/client';
import { TelemetryRollupGroupBy } from '../../../types/analytics';
import { DowntimeEvent } from '../../../types/monitoring';
import { useCapability } from '../../../context/AuthContext';
import { useHistoryFilters } from '../../shared/historyFilters';
import {
  HISTORY_DATA_STALE_TIME_MS,
  useMasterAssetsQuery,
  useTelemetryRollupQuery,
} from '../../shared/useHistoricalQueries';

export type TimelineBucket = '1m' | '5m' | '15m' | '1h';

export const useOeeAnalytics = () => {
  const canReadOee = useCapability('oee.read');
  const canReadQuality = useCapability('quality.read');

  const { filters, updateFilters } = useHistoryFilters({
    machineId: 'CNC-MILLING-01',
    groupBy: 'machine',
    limit: 20,
  });

  const selectedMachine = filters.machineId || 'CNC-MILLING-01';
  const rollupGroupBy: TelemetryRollupGroupBy = filters.groupBy ?? 'machine';
  const [timelineBucket, setTimelineBucket] = useState<TimelineBucket>('15m');
  const [selectedSegmentIdx, setSelectedSegmentIdx] = useState<number | null>(null);
  const [paretoScope, setParetoScope] = useState<'GLOBAL' | 'DEVICE'>('GLOBAL');

  const { data: masterData } = useMasterAssetsQuery(canReadOee.canInteract);
  const machines = masterData?.machines ?? [];

  const resolvedDeviceId = useMemo(() => {
    const matched = machines.find((m) => m.machine_id === selectedMachine);
    return matched?.bound_device_id ?? matched?.boundDevice?.device_id ?? 'STM32-OEE-01';
  }, [machines, selectedMachine]);

  // E11 T11.2 (F-2): periode (filters.from/to — sama dengan hourly) masuk
  // queryKey + dikirim ke server, sehingga ganti periode via URL me-refetch
  // summary/timeline juga; satu halaman, satu periode (gap G1).
  const shiftSummaryQuery = useQuery({
    queryKey: ['oee-shift-summary', selectedMachine, filters.from, filters.to],
    enabled: canReadOee.canInteract,
    staleTime: HISTORY_DATA_STALE_TIME_MS,
    queryFn: ({ signal }) =>
      apiClient.getShiftSummary(selectedMachine, signal, { from: filters.from, to: filters.to }),
  });

  const hourlyQuery = useQuery({
    queryKey: ['oee-hourly', selectedMachine, filters.from, filters.to],
    enabled: canReadOee.canInteract,
    staleTime: HISTORY_DATA_STALE_TIME_MS,
    queryFn: ({ signal }) =>
      apiClient.getOeeHourly(
        { machine_id: selectedMachine, from: filters.from, to: filters.to },
        signal
      ),
  });

  const timelineQuery = useQuery({
    queryKey: ['oee-shift-timeline', selectedMachine, timelineBucket, filters.from, filters.to],
    enabled: canReadOee.canInteract,
    staleTime: HISTORY_DATA_STALE_TIME_MS,
    queryFn: ({ signal }) =>
      apiClient.getShiftTimeline(selectedMachine, timelineBucket, signal, {
        from: filters.from,
        to: filters.to,
      }),
  });

  const downtimeOverlayQuery = useQuery({
    queryKey: ['oee-timeline-downtime', resolvedDeviceId, filters.from, filters.to],
    enabled: canReadOee.canInteract && Boolean(resolvedDeviceId),
    staleTime: HISTORY_DATA_STALE_TIME_MS,
    queryFn: async ({ signal }) => {
      const [active, histPage] = await Promise.all([
        apiClient.getActiveDowntimes(signal),
        apiClient.getDowntimeHistoryPage(
          {
            device_id: resolvedDeviceId,
            from: filters.from,
            to: filters.to,
            limit: 50,
            envelope: true,
          },
          signal
        ),
      ]);
      const byId = new Map<string, DowntimeEvent>();
      [...histPage.data, ...active].forEach((ev) => byId.set(ev.id, ev));
      return byId;
    },
  });

  // E11 T11.3 (F-3): rollup mengikuti mesin terpilih — sama seperti
  // hourly/summary/timeline di hook ini (gap G4). Sebelumnya machineId dan
  // deviceId dipaksa undefined sehingga rollup selalu agregat semua mesin.
  // Hanya machineId yang diteruskan: mesin adalah scope yang dipilih di
  // halaman ini, dan deviceId sengaja dikosongkan agar mesin tanpa device
  // terikat (mis. CNC-GRIND-05) tetap mendapat barisnya.
  const rollupFilters = useMemo(
    () => ({
      ...filters,
      machineId: selectedMachine,
      deviceId: undefined,
      groupBy: rollupGroupBy,
    }),
    [filters, rollupGroupBy, selectedMachine]
  );
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
  const downtimeMap = downtimeOverlayQuery.data ?? new Map<string, DowntimeEvent>();
  const rollupRows = rollupQuery.data?.data ?? [];
  const paretoItems = rejectParetoQuery.data ?? [];

  const totalTimelineMin = timeline.reduce((acc, seg) => acc + seg.duration_min, 0) || 480;
  const downtimeSegments = timeline
    .map((seg, idx) => ({ seg, idx }))
    .filter(({ seg }) => Boolean(seg.downtime_id));

  const activeSegmentIdx =
    selectedSegmentIdx !== null && timeline[selectedSegmentIdx]
      ? selectedSegmentIdx
      : (downtimeSegments[0]?.idx ?? null);
  const activeSegment = activeSegmentIdx !== null ? timeline[activeSegmentIdx] : null;
  const matchedDowntime = activeSegment?.downtime_id
    ? downtimeMap.get(activeSegment.downtime_id) ?? null
    : null;

  const isRefreshing =
    shiftSummaryQuery.isFetching ||
    hourlyQuery.isFetching ||
    timelineQuery.isFetching ||
    rollupQuery.isFetching;

  // Refresh fan-out: hanya hourly + timeline + rollup + pareto kondisional —
  // BUKAN shift summary / downtime overlay.
  const refetchAll = () => {
    shiftSummaryQuery.refetch();
    hourlyQuery.refetch();
    timelineQuery.refetch();
    downtimeOverlayQuery.refetch();
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
    machines,
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
    isRefreshing,
    refetchAll,
  };
};
