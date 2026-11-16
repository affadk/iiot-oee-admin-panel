import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Clock,
  Layers,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { TelemetryRollupGroupBy } from '../../types/analytics';
import { DowntimeEvent, MachineFsmState } from '../../types/monitoring';
import { useCapability } from '../../context/AuthContext';
import { MetricCard } from '../../components/industrial/MetricCard';
import { MachineStateBadge } from '../../components/industrial/MachineStateBadge';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { mapDowntimeToSixBigLoss } from '../../utils/historicalExport';
import { formatDuration, formatDeletedRelationLabel, parseServerMetric } from '../../utils/oeeCalculations';
import { formatRollupPerformance, useHistoryFilters } from '../shared/historyFilters';
import {
  HISTORY_DATA_STALE_TIME_MS,
  useMasterAssetsQuery,
  useTelemetryRollupQuery,
} from '../shared/useHistoricalQueries';

type TimelineBucket = '1m' | '5m' | '15m' | '1h';

const FSM_SEGMENT_COLORS: Record<MachineFsmState, string> = {
  RUNNING: 'bg-emerald-500',
  READY: 'bg-sky-500',
  UNCONFIGURED: 'bg-slate-400',
  PLANNED_DOWNTIME: 'bg-amber-400',
  UNPLANNED_DOWNTIME: 'bg-red-500',
  BATCH_FINISHED: 'bg-indigo-500',
};

export const OeeAnalyticsPage: React.FC = () => {
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

  const shiftSummaryQuery = useQuery({
    queryKey: ['oee-shift-summary', selectedMachine],
    enabled: canReadOee.canInteract,
    staleTime: HISTORY_DATA_STALE_TIME_MS,
    queryFn: ({ signal }) => apiClient.getShiftSummary(selectedMachine, signal),
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
    queryKey: ['oee-shift-timeline', selectedMachine, timelineBucket],
    enabled: canReadOee.canInteract,
    staleTime: HISTORY_DATA_STALE_TIME_MS,
    queryFn: ({ signal }) => apiClient.getShiftTimeline(selectedMachine, timelineBucket, signal),
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

  const rollupFilters = useMemo(
    () => ({
      ...filters,
      machineId: undefined,
      deviceId: undefined,
      groupBy: rollupGroupBy,
    }),
    [filters, rollupGroupBy]
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

  if (!canReadOee.canInteract) {
    return (
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold text-sm">
          <ShieldAlert className="w-5 h-5" />
          <span>Akses Analitik OEE Dibatasi</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {canReadOee.reason || 'Anda tidak memiliki capability oee.read untuk membuka analitik shift.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            OEE Shift Analytics, Timeline &amp; Quality Pareto
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Ringkasan pencapaian OEE per shift, lini masa 6-state FSM dengan overlay downtime, rollup multi-mesin, dan pareto reject.
          </p>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 shrink-0">
          <select
            aria-label="Pilih Mesin"
            value={selectedMachine}
            onChange={(e) => {
              setSelectedSegmentIdx(null);
              updateFilters({ machineId: e.target.value });
            }}
            className="max-w-[260px] px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
          >
            {machines.length === 0 ? (
              <option value={selectedMachine}>{selectedMachine}</option>
            ) : (
              machines.map((m) => (
                <option key={m.machine_id} value={m.machine_id}>
                  {m.machine_id} · {m.name}
                </option>
              ))
            )}
          </select>
          <select
            aria-label="Bucket Timeline"
            value={timelineBucket}
            onChange={(e) => setTimelineBucket(e.target.value as TimelineBucket)}
            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
          >
            <option value="1m">Bucket 1m (&le; 6 jam)</option>
            <option value="5m">Bucket 5m</option>
            <option value="15m">Bucket 15m</option>
            <option value="1h">Bucket 1h</option>
          </select>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              shiftSummaryQuery.refetch();
              hourlyQuery.refetch();
              timelineQuery.refetch();
              downtimeOverlayQuery.refetch();
              rollupQuery.refetch();
              if (canReadQuality.canInteract) rejectParetoQuery.refetch();
            }}
            isLoading={isRefreshing}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Shift Total OEE"
            value={summary.oee.toFixed(1)}
            unit="%"
            subtext={`${summary.shift_name} (${summary.tz || 'Asia/Jakarta'})`}
            statusVariant={summary.oee >= 80 ? 'success' : 'warning'}
            icon={<TrendingUp className="w-4 h-4" />}
          />
          <MetricCard
            label="Availability"
            value={summary.availability.toFixed(1)}
            unit="%"
            subtext={`Run ${summary.run_time_min}m / Operating ${summary.operating_time_min}m`}
            statusVariant="normal"
            icon={<Clock className="w-4 h-4" />}
          />
          <MetricCard
            label="Performance"
            value={summary.performance.toFixed(1)}
            unit="%"
            subtext={`Target/Jam: ${summary.target_per_hour ?? '-'} pcs · Break ${summary.planned_break_min ?? 0}m`}
            statusVariant="normal"
            icon={<Layers className="w-4 h-4" />}
          />
          <MetricCard
            label="Quality"
            value={summary.quality.toFixed(1)}
            unit="%"
            subtext={`${summary.good_parts} good / ${summary.defect_parts} defect`}
            statusVariant="success"
            icon={<BarChart3 className="w-4 h-4" />}
          />
        </div>
      )}

      {/* Shift Timeline Bar (6 canonical FSM states + interactive downtime overlay) */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Timeline Status Mesin Shift (Bucket {timelineBucket})
          </h2>
          <span className="text-[11px] text-slate-500">
            Klik segmen downtime (kuning/merah) untuk melihat korelasi penyebab henti mesin. Interval 1m berlaku maks 6 jam.
          </span>
        </div>

        <div className="w-full h-9 rounded overflow-hidden flex border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
          {timeline.map((seg, idx) => {
            const pct = Math.max(1.5, (seg.duration_min / totalTimelineMin) * 100);
            const hasDowntime = Boolean(seg.downtime_id);
            const isSelected = activeSegmentIdx === idx;
            return (
              <button
                key={`${seg.start}-${idx}`}
                type="button"
                onClick={() => setSelectedSegmentIdx(idx)}
                style={{ width: `${pct}%` }}
                title={`${seg.start}–${seg.end}: ${seg.fsm_state} (${seg.duration_min} min)${seg.downtime_id ? ` · ${seg.downtime_id}` : ''}`}
                className={`${FSM_SEGMENT_COLORS[seg.fsm_state] ?? 'bg-slate-400'} relative h-full border-r border-white/30 last:border-r-0 transition-opacity hover:opacity-90 cursor-pointer focus:outline-none ${
                  isSelected ? 'ring-2 ring-inset ring-slate-950 dark:ring-white' : ''
                }`}
              >
                {hasDowntime && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0.5 mx-auto w-1.5 h-1.5 rounded-full bg-white shadow-xs"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* 6 Canonical Legend Items */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600 dark:text-slate-300 pt-1">
          {(Object.keys(FSM_SEGMENT_COLORS) as MachineFsmState[]).map((st) => (
            <div key={st} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-xs ${FSM_SEGMENT_COLORS[st]}`} />
              <span className="font-tabular">{st}</span>
            </div>
          ))}
        </div>

        {/* Interactive Downtime Overlay Panel */}
        {activeSegment && (
          <div className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-tabular font-semibold text-slate-900 dark:text-slate-100">
                  Segmen {activeSegment.start} – {activeSegment.end} ({activeSegment.duration_min} menit)
                </span>
                <MachineStateBadge state={activeSegment.fsm_state} />
                {activeSegment.planned && <Badge variant="warning">Planned</Badge>}
              </div>
              {activeSegment.downtime_id ? (
                matchedDowntime ? (
                  <div className="text-slate-600 dark:text-slate-300 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="font-semibold">
                        {mapDowntimeToSixBigLoss(matchedDowntime.category).label}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{matchedDowntime.reason}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-tabular">
                      ID: {matchedDowntime.id} · Durasi:{' '}
                      {matchedDowntime.durationFormatted || formatDuration(matchedDowntime.duration_seconds)} ·{' '}
                      {matchedDowntime.is_labeled ? 'Sudah dilabeli' : 'Belum dilabeli'}
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 font-tabular">
                    Overlay Downtime ID: {activeSegment.downtime_id} (sedang memuat rincian atau di luar rentang filter).
                  </p>
                )
              ) : (
                <p className="text-slate-500">
                  Segmen operasi normal tanpa insiden downtime terikat.
                </p>
              )}
            </div>

            {activeSegment.downtime_id && (
              <Link
                to={`/downtime?device_id=${encodeURIComponent(resolvedDeviceId)}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium text-sky-700 dark:text-sky-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <span>Buka Log Downtime</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Hourly Breakdown Table (authoritative /api/v1/oee/hourly fields) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Rincian Pencapaian OEE Per Jam
            </h2>
            <p className="text-[11px] text-slate-500">
              Setiap baris merepresentasikan delta produksi di dalam jam tersebut (bucket provisional dapat diperbarui oleh rekonsiliasi).
            </p>
          </div>
          <Link
            to={`/telemetry?device_id=${encodeURIComponent(resolvedDeviceId)}`}
            className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0"
          >
            Buka Riwayat Telemetri →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Jam</th>
                <th className="py-2.5 px-4">FSM State &amp; Plan</th>
                <th className="py-2.5 px-4 text-right">OEE</th>
                <th className="py-2.5 px-4 text-right">A / P / Q</th>
                <th className="py-2.5 px-4 text-right">Parts / Target</th>
                <th className="py-2.5 px-4 text-right">Reject</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {hourly.map((pt) => (
                <tr key={pt.hour} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-2.5 px-4 font-tabular font-semibold text-slate-900 dark:text-slate-100">
                    <span>{pt.hour}</span>
                    {pt.provisional && (
                      <span className="ml-1.5 text-[11px] font-sans font-medium text-amber-600 dark:text-amber-400">
                        (Provisional)
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-1.5">
                      {pt.state && <MachineStateBadge state={pt.state} />}
                      {pt.planned && <Badge variant="warning">Planned</Badge>}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right font-tabular font-bold text-slate-900 dark:text-slate-100">
                    {pt.oee.toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-4 text-right font-tabular text-slate-600 dark:text-slate-300">
                    {pt.availability.toFixed(0)}% / {pt.performance.toFixed(0)}% / {pt.quality.toFixed(0)}%
                  </td>
                  <td className="py-2.5 px-4 text-right font-tabular">
                    <strong>{pt.parts_produced}</strong>
                    <span className="text-slate-400"> / {pt.targetPerHour ?? '—'}</span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-tabular text-red-500 font-medium">
                    {pt.defect_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Multi-Machine / Period Rollup Comparison */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Rollup Analitik Multi-Mesin &amp; Periode
            </h2>
            <p className="text-[11px] text-slate-500">
              Performa dihitung dengan kapasitas berbobot waktu; mesin dengan kapasitas 0 atau tidak diketahui menampilkan tanda kapasitas 0/unknown.
            </p>
          </div>
          <select
            aria-label="Grouping Rollup Analitik"
            value={rollupGroupBy}
            onChange={(e) => updateFilters({ groupBy: e.target.value as TelemetryRollupGroupBy })}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          >
            <option value="machine">Per Mesin</option>
            <option value="day">Per Hari</option>
            <option value="month">Per Bulan</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">
                  {rollupGroupBy === 'machine' ? 'Mesin / Perangkat' : rollupGroupBy === 'day' ? 'Tanggal' : 'Bulan'}
                </th>
                <th className="py-2.5 px-4 text-right">OEE</th>
                <th className="py-2.5 px-4 text-right">Avail</th>
                <th className="py-2.5 px-4 text-right">Perf (Weighted)</th>
                <th className="py-2.5 px-4 text-right">Quality</th>
                <th className="py-2.5 px-4 text-right">Total / Good / Reject</th>
                <th className="py-2.5 px-4 text-right">Op / Run · Sampel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {rollupRows.map((row) => {
                const machInfo = formatDeletedRelationLabel(row.machine_name, row.machine_id);
                return (
                  <tr key={row.groupKey} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {rollupGroupBy === 'machine' ? machInfo.label : row.groupKey}
                        {row.provisional && (
                          <span className="ml-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                            (Provisional)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-tabular text-slate-400">
                        {row.groupKey}
                        {row.device_id ? ` · ${row.device_id}` : ''}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-tabular font-bold text-slate-900 dark:text-slate-100">
                      {parseServerMetric(row.oeePct).toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-4 text-right font-tabular text-slate-700 dark:text-slate-300">
                      {parseServerMetric(row.availabilityPct).toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-4 text-right font-tabular text-slate-700 dark:text-slate-300">
                      {formatRollupPerformance(row.performancePct)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-tabular text-slate-700 dark:text-slate-300">
                      {parseServerMetric(row.qualityPct).toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-4 text-right font-tabular">
                      {row.totalCount} / <span className="text-emerald-600 dark:text-emerald-400">{row.goodCount}</span> /{' '}
                      <span className="text-red-500">{row.rejectCount}</span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-tabular text-slate-500">
                      {formatDuration(row.operatingSec)} / {formatDuration(row.runSec)} · {row.sampleCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Integrated Quality Reject Pareto Section (capability gated: quality.read) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Quality Reject Pareto ({paretoScope === 'GLOBAL' ? 'Plant-Wide' : resolvedDeviceId})
            </h2>
            <p className="text-[11px] text-slate-500">
              Distribusi cacat produksi terbanyak beserta persentase kumulatif (80/20).
            </p>
          </div>
          {canReadQuality.canInteract && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setParetoScope('GLOBAL')}
                className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  paretoScope === 'GLOBAL'
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                Plant-Wide
              </button>
              <button
                type="button"
                onClick={() => setParetoScope('DEVICE')}
                className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  paretoScope === 'DEVICE'
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                Device ({resolvedDeviceId})
              </button>
            </div>
          )}
        </div>

        {!canReadQuality.canInteract ? (
          <div className="p-4 text-xs text-slate-500">
            {canReadQuality.reason || 'Anda tidak memiliki capability quality.read untuk melihat Pareto Reject.'}
          </div>
        ) : (
          <div className="p-4 space-y-2.5">
            {paretoItems.map((item) => (
              <div key={item.reason} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{item.reason}</span>
                  <span className="font-tabular text-slate-600 dark:text-slate-400">
                    {item.count} pcs ({item.percentage.toFixed(1)}% · Kumulatif {item.cumulative_percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(2, item.percentage))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
