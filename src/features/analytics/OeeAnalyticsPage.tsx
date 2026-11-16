import React from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { TelemetryRollupGroupBy } from '../../types/analytics';
import { Button } from '../../components/ui/Button';
import { useOeeAnalytics, TimelineBucket } from './hooks/useOeeAnalytics';
import { OeeSummaryCards } from './components/OeeSummaryCards';
import { ShiftTimeline } from './components/ShiftTimeline';
import { OeeHourlyTable } from './components/OeeHourlyTable';
import { OeeRollupTable } from './components/OeeRollupTable';
import { QualityRejectPareto } from './components/QualityRejectPareto';

export const OeeAnalyticsPage: React.FC = () => {
  const analytics = useOeeAnalytics();
  const {
    canReadOee,
    canReadQuality,
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
  } = analytics;

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
            onClick={refetchAll}
            isLoading={isRefreshing}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      <OeeSummaryCards summary={summary} />

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
      />

      {/* Hourly Breakdown Table (authoritative /api/v1/oee/hourly fields) */}
      <OeeHourlyTable hourly={hourly} resolvedDeviceId={resolvedDeviceId} />

      {/* Multi-Machine / Period Rollup Comparison */}
      <OeeRollupTable
        rollupRows={rollupRows}
        rollupGroupBy={rollupGroupBy}
        onGroupByChange={(v: TelemetryRollupGroupBy) => updateFilters({ groupBy: v })}
      />

      {/* Integrated Quality Reject Pareto Section (capability gated: quality.read) */}
      <QualityRejectPareto
        paretoItems={paretoItems}
        paretoScope={paretoScope}
        onScopeChange={setParetoScope}
        resolvedDeviceId={resolvedDeviceId}
        canReadQuality={canReadQuality}
      />
    </div>
  );
};
