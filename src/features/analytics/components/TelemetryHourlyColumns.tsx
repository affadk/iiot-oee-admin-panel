import { useMemo } from 'react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { HourlyOeePoint } from '../../../types/analytics';
import { MachineStateBadge } from '../../../components/industrial/MachineStateBadge';
import { parseServerMetric } from '../../../utils/oeeCalculations';

export function useTelemetryHourlyColumns() {
  return useMemo<ColumnDef<HourlyOeePoint, unknown>[]>(
    () => [
      {
        id: 'hour',
        header: 'Bucket Jam',
        cell: ({ row }) => (
          <div className="flex items-center gap-2 font-tabular text-xs font-semibold text-slate-900 dark:text-slate-100">
            <span>{row.original.hour}</span>
            {row.original.provisional && (
              <span className="text-[11px] font-sans font-medium text-amber-600 dark:text-amber-400">
                (Provisional)
              </span>
            )}
          </div>
        ),
      },
      {
        id: 'state',
        header: 'State Dominan',
        cell: ({ row }) =>
          row.original.state ? <MachineStateBadge state={row.original.state} /> : <span>—</span>,
      },
      {
        id: 'oee',
        header: 'OEE %',
        cell: ({ row }) => (
          <span className="font-tabular text-xs font-bold text-slate-900 dark:text-slate-100">
            {parseServerMetric(row.original.oee).toFixed(1)}%
          </span>
        ),
      },
      {
        id: 'apq',
        header: 'A / P / Q',
        cell: ({ row }) => (
          <span className="font-tabular text-xs text-slate-600 dark:text-slate-300">
            {row.original.availability.toFixed(1)}% / {row.original.performance.toFixed(1)}% /{' '}
            {row.original.quality.toFixed(1)}%
          </span>
        ),
      },
      {
        id: 'delta',
        header: 'Delta Output / Reject',
        cell: ({ row }) => (
          <span className="font-tabular text-xs">
            {row.original.parts_produced} pcs ·{' '}
            <span className="text-red-500">{row.original.defect_count} reject</span>
          </span>
        ),
      },
      {
        id: 'samples',
        header: 'Sampel',
        cell: ({ row }) => (
          <span className="font-tabular text-xs text-slate-500">
            {row.original.sampleCount ?? 0} sampel
          </span>
        ),
      },
    ],
    []
  );
}
