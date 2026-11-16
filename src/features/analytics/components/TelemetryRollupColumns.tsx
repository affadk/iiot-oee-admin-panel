import { useMemo } from 'react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { TelemetryRollupGroupBy, TelemetryRollupItem } from '../../../types/analytics';
import { formatDuration, parseServerMetric } from '../../../utils/oeeCalculations';
import { formatRollupPerformance } from '../../shared/historyFilters';

export function useTelemetryRollupColumns(groupBy: TelemetryRollupGroupBy) {
  return useMemo<ColumnDef<TelemetryRollupItem, unknown>[]>(
    () => [
      {
        id: 'groupKey',
        header:
          groupBy === 'machine' ? 'Mesin / Perangkat' : groupBy === 'day' ? 'Tanggal' : 'Bulan',
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="text-xs">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {item.machine_name ?? item.groupKey}
                {item.provisional && (
                  <span className="ml-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                    (Provisional)
                  </span>
                )}
              </div>
              <div className="font-tabular text-[11px] text-slate-400">
                {item.groupKey}
                {item.device_id ? ` · ${item.device_id}` : ''}
              </div>
            </div>
          );
        },
      },
      {
        id: 'oeePct',
        header: 'OEE',
        cell: ({ row }) => (
          <span className="font-tabular text-xs font-bold text-slate-900 dark:text-slate-100">
            {parseServerMetric(row.original.oeePct).toFixed(2)}%
          </span>
        ),
      },
      {
        id: 'availPct',
        header: 'Availability',
        cell: ({ row }) => (
          <span className="font-tabular text-xs text-slate-700 dark:text-slate-300">
            {parseServerMetric(row.original.availabilityPct).toFixed(2)}%
          </span>
        ),
      },
      {
        id: 'perfPct',
        header: 'Performance',
        cell: ({ row }) => (
          <span className="font-tabular text-xs text-slate-700 dark:text-slate-300">
            {formatRollupPerformance(row.original.performancePct)}
          </span>
        ),
      },
      {
        id: 'qualPct',
        header: 'Quality',
        cell: ({ row }) => (
          <span className="font-tabular text-xs text-slate-700 dark:text-slate-300">
            {parseServerMetric(row.original.qualityPct).toFixed(2)}%
          </span>
        ),
      },
      {
        id: 'counts',
        header: 'Total / Good / Reject',
        cell: ({ row }) => {
          const r = row.original;
          return (
            <span className="font-tabular text-xs">
              {r.totalCount} / <span className="text-emerald-600 dark:text-emerald-400">{r.goodCount}</span> /{' '}
              <span className="text-red-500">{r.rejectCount}</span>
            </span>
          );
        },
      },
      {
        id: 'time',
        header: 'Op / Run · Sampel',
        cell: ({ row }) => (
          <span className="font-tabular text-xs text-slate-500">
            {formatDuration(row.original.operatingSec)} / {formatDuration(row.original.runSec)} ·{' '}
            {row.original.sampleCount}
          </span>
        ),
      },
    ],
    [groupBy]
  );
}
