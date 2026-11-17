import React from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { TelemetryRollupGroupBy } from '../../types/analytics';
import { Button } from '../../components/ui/Button';
import { useOeeAnalytics, TimelineBucket } from './hooks/useOeeAnalytics';
import { OeeSummaryCards } from './components/OeeSummaryCards';
import { PeriodRangePicker } from './components/PeriodRangePicker';
import { ShiftFilterBar } from './components/ShiftFilterBar';
import { ShiftTimeline } from './components/ShiftTimeline';
import { OeeHourlyTable } from './components/OeeHourlyTable';
import { OeeRollupTable } from './components/OeeRollupTable';
import { QualityRejectPareto } from './components/QualityRejectPareto';
import { ReconciliationFootnote } from './components/ReconciliationFootnote';
import { formatPeriodLabel, formatShiftFilterLabel } from './scopeLabels';

export const OeeAnalyticsPage: React.FC = () => {
  const analytics = useOeeAnalytics();
  const {
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
    downtimeLoadedCount,
    downtimeTotalCount,
    downtimeHasMore,
    downtimeIsLoading,
    fetchNextDowntimePage,
    isFetchingNextDowntimePage,
    summaryState,
    hourlyState,
    timelineState,
    rollupState,
    isRefreshing,
    refetchAll,
  } = analytics;

  const selectedMachineLabel =
    machines.find((m) => m.machine_id === selectedMachine)?.name ?? selectedMachine;

  // E11 T11.5 (U-1): label periode dari from/to filter aktif (default 7 hari)
  // — diteruskan ke tiap widget sebagai label scope eksplisit.
  // E12 T12.1 (X-1 / FAT-54): bila filter shift aktif, label memakai
  // tanggal + shift terpilih ("Shift 1 (Pagi) · 16 Nov 2026 · 07:00–15:00").
  const periodLabel =
    selectedShift && filters.shiftDate
      ? formatShiftFilterLabel(selectedShift, filters.shiftDate)
      : formatPeriodLabel(filters.from, filters.to);

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
            onChange={(e) => {
              // E12 T12.17 (F-13 / FAT-69): ganti bucket me-refetch timeline
              // dengan daftar segmen baru — reset pilihan segmen seperti
              // ganti mesin (gap G13). Tanpa ini indeks lama dipakai pada
              // daftar baru dan overlay detail downtime bisa menampilkan
              // segmen yang salah. Satu-satunya jalur yang mengubah bucket
              // adalah select ini (grep: setTimelineBucket hanya dipanggil
              // di sini), jadi reset di sini mencakup semua ganti bucket.
              setSelectedSegmentIdx(null);
              setTimelineBucket(e.target.value as TimelineBucket);
            }}
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
            onClick={refetchAll}
            isLoading={isRefreshing}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* E12 T12.9 (X-2 / FAT-62): kontrol periode bebas (preset + rentang
          kustom) — sebelumnya from/to hanya lewat query string URL. Patch
          {from, to} tersimpan di URL via `updateFilters` dan me-refetch
          semua query halaman (queryKey memuat from/to, lihat
          `oeeQueryKeys`); label scope di bawah memakai rentang yang sama. */}
      <PeriodRangePicker
        from={filters.from}
        to={filters.to}
        onFilterChange={updateFilters}
        shiftFilterActive={Boolean(filters.shiftId)}
      />

      <ShiftFilterBar
        shifts={shifts}
        shiftDate={filters.shiftDate}
        shiftId={filters.shiftId}
        onFilterChange={updateFilters}
      />

      <OeeSummaryCards
        summary={summary}
        fallbackPeriodLabel={periodLabel}
        isLoading={summaryState.isLoading}
        isError={summaryState.isError}
        onRetry={summaryState.refetch}
      />

      {/* Shift Timeline Bar (6 canonical FSM states + interactive downtime overlay) */}
      <ShiftTimeline
        timeline={timeline}
        timelineBucket={timelineBucket}
        totalTimelineMin={totalTimelineMin}
        activeSegmentIdx={activeSegmentIdx}
        onSelectSegment={setSelectedSegmentIdx}
        activeSegment={activeSegment}
        matchedDowntime={matchedDowntime}
        resolvedDeviceId={resolvedDeviceId}
        summary={summary}
        // E12 T12.12 (X-5 / FAT-58): hourly diteruskan agar segmen di jam
        // provisional mendapat penanda (diturunkan dari data hourly).
        hourly={hourly}
        // E12 T12.13 (X-6 / FAT-63): hitungan + paginasi overlay downtime
        // ("menampilkan N dari M" + "Muat lebih banyak", gap G18).
        downtimeLoadedCount={downtimeLoadedCount}
        downtimeTotalCount={downtimeTotalCount}
        downtimeHasMore={downtimeHasMore}
        downtimeIsLoading={downtimeIsLoading}
        onLoadMoreDowntime={fetchNextDowntimePage}
        isLoadingMoreDowntime={isFetchingNextDowntimePage}
        isLoading={timelineState.isLoading}
        isError={timelineState.isError}
        onRetry={timelineState.refetch}
      />

      {/* Hourly Breakdown Table (authoritative /api/v1/oee/hourly fields) */}
      <OeeHourlyTable
        hourly={hourly}
        resolvedDeviceId={resolvedDeviceId}
        periodLabel={periodLabel}
        machineLabel={selectedMachineLabel}
        isLoading={hourlyState.isLoading}
        isError={hourlyState.isError}
        onRetry={hourlyState.refetch}
      />

      {/* Rollup — scope toggle (E12 T12.10 / X-3): "Mesin ini" (default,
          perilaku E11 T11.3) vs "Semua mesin" (plant-wide). Scope bertahan
          saat ganti mesin; judul selalu menunjukkan scope aktif. */}
      <OeeRollupTable
        rollupRows={rollupRows}
        rollupGroupBy={rollupGroupBy}
        machineLabel={selectedMachineLabel}
        onGroupByChange={(v: TelemetryRollupGroupBy) => updateFilters({ groupBy: v })}
        rollupScope={rollupScope}
        onScopeChange={setRollupScope}
        periodLabel={periodLabel}
        isLoading={rollupState.isLoading}
        isError={rollupState.isError}
        onRetry={rollupState.refetch}
      />

      {/* Integrated Quality Reject Pareto Section (capability gated: quality.read) */}
      <QualityRejectPareto
        paretoItems={paretoItems}
        paretoScope={paretoScope}
        onScopeChange={setParetoScope}
        resolvedDeviceId={resolvedDeviceId}
        canReadQuality={canReadQuality}
      />

      {/* E12 T12.6 (U-3 / FAT-56): catatan kaki rekonsiliasi — dihitung dari
          data yang sudah dimuat (summary/hourly/timeline), tanpa fetch baru;
          bukan blokir, hanya menandai selisih yang melewati ambang. */}
      <ReconciliationFootnote summary={summary} hourly={hourly} timeline={timeline} />
    </div>
  );
};
