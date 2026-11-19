import { useMemo } from 'react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { TelemetryAggregatePoint } from '../../../types/analytics';
import { parseServerMetric, formatNullablePct } from '../../../utils/oeeCalculations';

/**
 * Format label bucket agregat (ISO) ke tanggal + jam Asia/Jakarta.
 * Bila bukan ISO valid, tampilkan apa adanya.
 */
export function formatAggregateBucket(bucket: string): string {
  const ms = Date.parse(bucket);
  if (Number.isNaN(ms)) return bucket;
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ms));
}

/**
 * E12 T12.2 (F-5 / FAT-51): kolom tabel deret per-bucket tab Aggregate.
 * Pola penanda provisional mengikuti Hourly/Rollup: teks "(Provisional)"
 * amber di samping label bucket — bucket provisional dapat berubah setelah
 * rekonsiliasi CAgg.
 */
export function useTelemetryAggregateColumns() {
  return useMemo<ColumnDef<TelemetryAggregatePoint, unknown>[]>(
    () => [
      {
        id: 'bucket',
        header: 'Bucket',
        cell: ({ row }) => (
          <div className="flex items-center gap-2 font-tabular text-xs font-semibold text-slate-900 dark:text-slate-100">
            <span>{formatAggregateBucket(row.original.bucket)}</span>
            {row.original.provisional && (
              <span className="text-[11px] font-sans font-medium text-amber-600 dark:text-amber-400">
                (Provisional)
              </span>
            )}
          </div>
        ),
      },
      {
        id: 'oee',
        header: 'OEE %',
        cell: ({ row }) => (
          <span className="font-tabular text-xs font-bold text-slate-900 dark:text-slate-100">
            {formatNullablePct(row.original.oeePct)}
          </span>
        ),
      },
      {
        id: 'apq',
        header: 'A / P / Q',
        cell: ({ row }) => (
          <span className="font-tabular text-xs text-slate-600 dark:text-slate-300">
            {formatNullablePct(row.original.availabilityPct)} /{' '}
            {row.original.performancePct === null
              ? '—'
              : `${parseServerMetric(row.original.performancePct).toFixed(1)}%`}{' '}
            / {formatNullablePct(row.original.qualityPct)}
          </span>
        ),
      },
      {
        id: 'parts',
        header: 'Total Parts / Reject',
        cell: ({ row }) => (
          <span className="font-tabular text-xs">
            {row.original.totalCount} pcs ·{' '}
            <span className="text-red-500">{row.original.rejectCount} reject</span>
          </span>
        ),
      },
      {
        id: 'samples',
        header: 'Sampel',
        cell: ({ row }) => (
          <span className="font-tabular text-xs text-slate-500">
            {row.original.sampleCount} sampel
          </span>
        ),
      },
    ],
    []
  );
}
