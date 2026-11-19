import React from 'react';
import { TelemetryAggregatePoint } from '../../../types/analytics';
import { parseServerMetric } from '../../../utils/oeeCalculations';
import { formatAggregateBucket } from './TelemetryAggregateColumns';

export interface TelemetryAggregateChartProps {
  rows: TelemetryAggregatePoint[];
}

/**
 * E12 T12.2 (F-5 / FAT-51): grafik batang sederhana OEE per bucket —
 * satu batang per bucket, tinggi = OEE %. Bucket provisional memakai
 * warna amber (dapat berubah setelah rekonsiliasi); sisanya sky.
 * Bukan grafik interaktif — tren dibaca dari bentuk batang + tabel.
 */
export const TelemetryAggregateChart: React.FC<TelemetryAggregateChartProps> = ({ rows }) => {
  if (rows.length === 0) return null;
  // E20 P20.5 (FAT-157): `oeePct` null (kapasitas unknown) DIKELUARKAN dari
  // maks dan dirender sebagai celah (bukan batang 0%).
  const knownOee = rows
    .map((r) => r.oeePct)
    .filter((v): v is string | number => v !== null)
    .map((v) => parseServerMetric(v));
  const maxOee = Math.max(0, ...knownOee);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          Tren OEE per bucket
        </h4>
        <span className="text-[11px] text-slate-400">
          {rows.length} bucket · maks {maxOee.toFixed(1)}%
        </span>
      </div>
      <div
        className="flex items-end gap-px h-24 rounded bg-slate-50 dark:bg-slate-800/50 p-2"
        role="img"
        aria-label={`Grafik batang OEE per bucket, ${rows.length} bucket`}
      >
        {rows.map((r) => {
          const oee = r.oeePct === null ? null : parseServerMetric(r.oeePct);
          if (oee === null) {
            return (
              <div
                key={r.bucket}
                title={`${formatAggregateBucket(r.bucket)} — OEE — (kapasitas unknown)${r.provisional ? ' (Provisional)' : ''}`}
                className="flex-1 min-w-[2px] rounded-t border border-dashed border-slate-300 dark:border-slate-600"
                style={{ height: '100%' }}
              />
            );
          }
          return (
            <div
              key={r.bucket}
              title={`${formatAggregateBucket(r.bucket)} — OEE ${oee.toFixed(1)}%${r.provisional ? ' (Provisional)' : ''}`}
              className={`flex-1 min-w-[2px] rounded-t ${r.provisional ? 'bg-amber-400 dark:bg-amber-500' : 'bg-sky-500 dark:bg-sky-400'}`}
              style={{ height: `${Math.min(100, Math.max(2, oee))}%` }}
            />
          );
        })}
      </div>
      <p className="text-[11px] text-slate-400">
        Batang paling kanan = bucket terbaru
        {rows[rows.length - 1]?.provisional ? ' (masih provisional — dapat berubah setelah rekonsiliasi)' : ''}.
      </p>
    </div>
  );
};
