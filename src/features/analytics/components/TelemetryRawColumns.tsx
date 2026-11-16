import { useMemo } from 'react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { TelemetryHistoryRecord } from '../../../types/analytics';
import { MachineStateBadge } from '../../../components/industrial/MachineStateBadge';
import { Badge } from '../../../components/ui/Badge';
import { formatDuration } from '../../../utils/oeeCalculations';

export function useTelemetryRawColumns() {
  return useMemo<ColumnDef<TelemetryHistoryRecord, unknown>[]>(
    () => [
      {
        id: 'timestamp',
        header: 'Timestamp',
        cell: ({ row }) => (
          <span className="font-tabular text-xs text-slate-700 dark:text-slate-300">
            {new Date(row.original.timestamp).toLocaleString()}
          </span>
        ),
      },
      {
        id: 'fsm_state',
        header: 'FSM State',
        cell: ({ row }) => <MachineStateBadge state={row.original.fsm_state} />,
      },
      {
        id: 'mode',
        header: 'Packet Mode',
        cell: ({ row }) =>
          row.original.is_buffered ? (
            <Badge variant="warning">BUFFERED</Badge>
          ) : (
            <Badge variant="success">REALTIME</Badge>
          ),
      },
      {
        id: 'oee',
        header: 'OEE / A / P / Q',
        cell: ({ row }) => {
          const rec = row.original;
          return (
            <div className="font-tabular text-xs">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {rec.oee.toFixed(1)}%
              </span>
              <span className="text-[11px] text-slate-400 ml-1.5">
                ({rec.availability.toFixed(0)}/{rec.performance.toFixed(0)}/{rec.quality.toFixed(0)})
              </span>
            </div>
          );
        },
      },
      {
        id: 'counters',
        header: 'Counters (T / G / R)',
        cell: ({ row }) => {
          const rec = row.original;
          const total = rec.totalCount ?? rec.total_count;
          const good = rec.goodCount ?? rec.good_count;
          const reject = rec.rejectCount ?? rec.reject_count;
          return (
            <span className="font-tabular text-xs">
              {total} / <span className="text-emerald-600 dark:text-emerald-400">{good}</span> /{' '}
              <span className="text-red-500">{reject}</span>
            </span>
          );
        },
      },
      {
        id: 'durations',
        header: 'Op / Run / Down',
        cell: ({ row }) => {
          const rec = row.original;
          return (
            <span className="font-tabular text-xs text-slate-500 dark:text-slate-400">
              {formatDuration(rec.operatingTimeSec ?? 0)} / {formatDuration(rec.runTimeSec ?? 0)} /{' '}
              {formatDuration(rec.downtimeSec ?? 0)}
            </span>
          );
        },
      },
      {
        id: 'cycle',
        header: 'Cycle / Temp',
        cell: ({ row }) => {
          const rec = row.original;
          const cycleSec =
            rec.lastCycleTimeSec !== undefined && rec.lastCycleTimeSec !== null
              ? rec.lastCycleTimeSec.toFixed(1)
              : (rec.cycle_time_ms / 1000).toFixed(1);
          return (
            <span className="font-tabular text-xs text-slate-500">
              {cycleSec}s · {rec.temperature_c ?? '-'}°C
            </span>
          );
        },
      },
    ],
    []
  );
}
