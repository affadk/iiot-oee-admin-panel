import { useMemo } from 'react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { HourlyOeePoint } from '../../../types/analytics';
import { MachineStateBadge } from '../../../components/industrial/MachineStateBadge';
import { formatNullablePct } from '../../../utils/oeeCalculations';
import { formatJakartaTime } from '../../../utils/historicalExport';

export function useTelemetryHourlyColumns() {
  return useMemo<ColumnDef<HourlyOeePoint, unknown>[]>(
    () => [
      {
        id: 'hour',
        header: 'Bucket Jam',
        cell: ({ row }) => (
          <div className="flex items-center gap-2 font-tabular text-xs font-semibold text-slate-900 dark:text-slate-100">
            {/* E12 T12.11 (X-4 / FAT-59): jam bucket dalam WIB — Real
                mengirim bucket ISO, demo 'HH:MM'; keduanya diformat ke
                jam Asia/Jakarta yang sama. */}
            <span>{formatJakartaTime(row.original.hour)}</span>
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
            {/* E20 P20.5 (FAT-157): `oee` null (kapasitas unknown) tampil '—', bukan 0%. */}
            {formatNullablePct(row.original.oee)}
          </span>
        ),
      },
      {
        id: 'apq',
        header: 'A / P / Q',
        cell: ({ row }) => (
          <span className="font-tabular text-xs text-slate-600 dark:text-slate-300">
            {formatNullablePct(row.original.availability)} / {formatNullablePct(row.original.performance)} /{' '}
            {formatNullablePct(row.original.quality)}
          </span>
        ),
      },
      {
        id: 'delta',
        header: 'Delta Output / Reject',
        cell: ({ row }) => (
          <span className="font-tabular text-xs">
            {/* E28 Batch A (FAT-218 E2E-04): parts null → '—', bukan 0. */}
            {row.original.parts_produced ?? '—'} pcs ·{' '}
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
