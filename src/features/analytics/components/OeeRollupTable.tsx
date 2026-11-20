import React from 'react';
import { TelemetryRollupGroupBy, TelemetryRollupItem } from '../../../types/analytics';
import { RollupScope } from '../hooks/oeeQueryKeys';
import { formatRollupPerformance } from '../../shared/historyFilters';
import { formatDuration, formatDeletedRelationLabel, formatNullablePct } from '../../../utils/oeeCalculations';
import { formatRollupScopeTitle, joinScopeLabel } from '../scopeLabels';
import { TableStateRow } from '../../shared/TableStateRow';

interface OeeRollupTableProps {
  rollupRows: TelemetryRollupItem[];
  rollupGroupBy: TelemetryRollupGroupBy;
  machineLabel: string;
  onGroupByChange: (next: TelemetryRollupGroupBy) => void;
  /** E12 T12.10 (X-3): scope rollup — 'MACHINE' (mesin ini, default) vs 'ALL' (semua mesin). */
  rollupScope: RollupScope;
  /** Dipanggil saat pengguna mengubah toggle scope rollup. */
  onScopeChange: (next: RollupScope) => void;
  /** Label periode dari filter aktif (from/to) — diteruskan dari halaman. */
  periodLabel?: string;
  /** E12 T12.5 (U-2): sedang memuat dan belum ada data — tampilkan skeleton. */
  isLoading?: boolean;
  /** E12 T12.5 (U-2): query gagal dan tidak ada data — tampilkan pesan error. */
  isError?: boolean;
  /** Dipanggil tombol "Coba lagi" pada state error. */
  onRetry?: () => void;
}

export const OeeRollupTable: React.FC<OeeRollupTableProps> = ({
  rollupRows,
  rollupGroupBy,
  machineLabel,
  onGroupByChange,
  rollupScope,
  onScopeChange,
  periodLabel,
  isLoading = false,
  isError = false,
  onRetry,
}) => {
  // E11 T11.5 (U-1): judul rollup selalu menampilkan scope (E12 T12.10
  // memakai helper `formatRollupScopeTitle` dari scopeLabels — "Rollup —
  // <mesin>" vs "Rollup — Semua Mesin"); subjudul menambahkan periode
  // dari filter aktif.
  const scopeNote = joinScopeLabel(
    periodLabel,
    'Performa dihitung dengan kapasitas berbobot waktu; mesin dengan kapasitas 0 atau tidak diketahui menampilkan tanda kapasitas 0/unknown.'
  );
  // Pesan kosong mengikuti scope: plant-wide tidak menyebut "mesin" tertentu.
  const emptyDescription =
    rollupScope === 'ALL'
      ? 'Tidak ada hasil agregasi rollup untuk semua mesin pada periode yang dipilih.'
      : 'Tidak ada hasil agregasi rollup untuk mesin dan periode yang dipilih.';
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {formatRollupScopeTitle(rollupScope, machineLabel)}
          </h2>
          <p className="text-[11px] text-slate-500">
            {scopeNote}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Scope Rollup"
          value={rollupScope}
          onChange={(e) => onScopeChange(e.target.value as RollupScope)}
          className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
        >
          <option value="MACHINE">Mesin ini</option>
          <option value="ALL">Semua mesin</option>
        </select>
        <select
          aria-label="Grouping Rollup Analitik"
          value={rollupGroupBy}
          onChange={(e) => onGroupByChange(e.target.value as TelemetryRollupGroupBy)}
          className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
        >
          <option value="machine">Per Mesin</option>
          <option value="line">Per Lini</option>
          <option value="day">Per Hari</option>
          <option value="month">Per Bulan</option>
        </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <th className="py-2.5 px-4">
                {/* E23 Batch 3 (FAT-195, N-26): header 'line' = Lini. */}
                {rollupGroupBy === 'machine'
                  ? 'Mesin / Perangkat'
                  : rollupGroupBy === 'line'
                    ? 'Lini'
                    : rollupGroupBy === 'day'
                      ? 'Tanggal'
                      : 'Bulan'}
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
            {rollupRows.length === 0 ? (
              <TableStateRow
                isLoading={isLoading}
                isError={isError}
                colSpan={7}
                emptyDescription={emptyDescription}
                onRetry={onRetry}
              />
            ) : (
              rollupRows.map((row) => {
              const machInfo = formatDeletedRelationLabel(row.machine_name, row.machine_id);
              return (
                <tr key={row.groupKey} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-2.5 px-4">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {rollupGroupBy === 'machine' ? machInfo.label : row.groupKey}
                      {row.provisional && (
                        <span className="ml-1.5 text-[11px] font-sans font-medium text-amber-600 dark:text-amber-400">
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
                    {formatNullablePct(row.oeePct, 2)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-tabular text-slate-700 dark:text-slate-300">
                    {formatNullablePct(row.availabilityPct, 2)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-tabular text-slate-700 dark:text-slate-300">
                    {formatRollupPerformance(row.performancePct)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-tabular text-slate-700 dark:text-slate-300">
                    {formatNullablePct(row.qualityPct, 2)}
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
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
