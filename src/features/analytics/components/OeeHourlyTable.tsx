import React from 'react';
import { Link } from 'react-router-dom';
import { HourlyOeePoint } from '../../../types/analytics';
import { MachineStateBadge } from '../../../components/industrial/MachineStateBadge';
import { Badge } from '../../../components/ui/Badge';
import { formatDuration, formatNullablePct } from '../../../utils/oeeCalculations';
import { formatJakartaTime } from '../../../utils/historicalExport';
import { formatRollupPerformance } from '../../shared/historyFilters';
import { joinScopeLabel } from '../scopeLabels';
import { TableStateRow } from '../../shared/TableStateRow';

interface OeeHourlyTableProps {
  hourly: HourlyOeePoint[];
  resolvedDeviceId: string;
  /** Label periode dari filter aktif (from/to) — diteruskan dari halaman. */
  periodLabel?: string;
  /** Label mesin terpilih — diteruskan dari halaman. */
  machineLabel?: string;
  /** E12 T12.5 (U-2): sedang memuat dan belum ada data — tampilkan skeleton. */
  isLoading?: boolean;
  /** E12 T12.5 (U-2): query gagal dan tidak ada data — tampilkan pesan error. */
  isError?: boolean;
  /** Dipanggil tombol "Coba lagi" pada state error. */
  onRetry?: () => void;
}

export const OeeHourlyTable: React.FC<OeeHourlyTableProps> = ({
  hourly,
  resolvedDeviceId,
  periodLabel,
  machineLabel,
  isLoading = false,
  isError = false,
  onRetry,
}) => {
  // E11 T11.5 (U-1): label scope eksplisit — periode (from/to filter) + mesin.
  const scopeLabel = joinScopeLabel(periodLabel, machineLabel ? `Mesin ${machineLabel}` : '');
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Rincian Pencapaian OEE Per Jam{' '}
            <Badge variant="info">Tampilan kanonis</Badge>
          </h2>
          {scopeLabel && (
            <p className="text-[11px] text-slate-500">{scopeLabel}</p>
          )}
          <p className="text-[11px] text-slate-500">
            Setiap baris merepresentasikan delta produksi di dalam jam tersebut (bucket provisional dapat diperbarui oleh rekonsiliasi).
            Performa dihitung dengan kapasitas berbobot waktu; jam dengan kapasitas 0 atau tidak diketahui menampilkan tanda kapasitas 0/unknown.
            {/* E12 T12.19 (U-5 / FAT-64): tampilan kanonis OEE per jam (gap G23) — tab Per Jam di Riwayat Telemetri menampilkan data yang sama dari sumber yang sama. */}
            Tampilan kanonis OEE per jam — tab Per Jam di Riwayat Telemetri menampilkan data yang sama dari sumber yang sama (CAgg <code>oee_hourly_summary</code>).
          </p>
        </div>
        <Link
          to={`/telemetry?device_id=${encodeURIComponent(resolvedDeviceId)}&tab=hourly`}
          className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0"
        >
          Lihat di Telemetry History →
        </Link>
      </div>
      {/* E31.10 (FAT-273) BYPASS: tabel ini TIDAK dimigrasi ke DataTable.
          Tabel berada di dalam kartu yang sudah punya header sendiri (judul
          + catatan scope + link "Lihat di Telemetry History"); DataTable
          membawa kartu sendiri (border + rounded) sehingga migrasi akan
          menumpuk dua kartu. Memindahkan header keluar kartu akan mengubah
          tampilan. Isi tabel sendiri sebenarnya didukung ColumnDef — bila
          DataTable kelak mendukung mode tanpa-kartu, migrasi ini bisa
          dilakukan. */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <th className="py-2.5 px-4">Jam</th>
              <th className="py-2.5 px-4">FSM State &amp; Plan</th>
              <th className="py-2.5 px-4 text-right">OEE</th>
              <th className="py-2.5 px-4 text-right">A / P (Weighted) / Q</th>
              <th className="py-2.5 px-4 text-right">Parts / Target</th>
              <th className="py-2.5 px-4 text-right">Good</th>
              <th className="py-2.5 px-4 text-right">Reject</th>
              <th className="py-2.5 px-4 text-right">Op / Run · Sampel</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
            {hourly.length === 0 ? (
              <TableStateRow
                isLoading={isLoading}
                isError={isError}
                colSpan={8}
                emptyDescription="Tidak ada bucket produksi per jam untuk mesin dan periode yang dipilih."
                onRetry={onRetry}
              />
            ) : (
              hourly.map((pt) => {
              // E12 T12.3 (F-6): samakan perlakuan kapasitas unknown dengan
              // rollup — kapasitas 0/tidak diketahui (targetPerHour null/0)
              // menampilkan "— (Kapasitas 0/Unknown)", bukan Performance 0.
              // E20 P20.5 (FAT-157): `performance`/`oee` kini nullable di
              // tipe — `null` = kapasitas unknown, tampil '—' (bukan 0%).
              const capacityUnknown = pt.targetPerHour === null || pt.targetPerHour === 0;
              return (
              <tr key={pt.hour} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="py-2.5 px-4 font-tabular font-semibold text-slate-900 dark:text-slate-100">
                  {/* E12 T12.11 (X-4 / FAT-59): jam bucket dalam WIB. */}
                  <span>{formatJakartaTime(pt.hour)}</span>
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
                  {formatNullablePct(pt.oee, 2)}
                </td>
                <td className="py-2.5 px-4 text-right font-tabular text-slate-600 dark:text-slate-300">
                  {formatNullablePct(pt.availability, 2)} / {formatRollupPerformance(capacityUnknown ? null : pt.performance)} / {formatNullablePct(pt.quality, 2)}
                </td>
                <td className="py-2.5 px-4 text-right font-tabular">
                  {/* E28 Batch A (FAT-218 E2E-04): parts null → '—', bukan 0. */}
                  <strong>{pt.parts_produced ?? '—'}</strong>
                  <span className="text-slate-400"> / {pt.targetPerHour ?? '—'}</span>
                </td>
                <td className="py-2.5 px-4 text-right font-tabular text-emerald-600 dark:text-emerald-400">
                  {pt.good_count ?? '—'}
                </td>
                <td className="py-2.5 px-4 text-right font-tabular text-red-500 font-medium">
                  {pt.defect_count}
                </td>
                <td className="py-2.5 px-4 text-right font-tabular text-slate-500">
                  {pt.hourly_operating_sec === undefined ? '—' : formatDuration(pt.hourly_operating_sec)} /{' '}
                  {pt.hourly_run_sec === undefined ? '—' : formatDuration(pt.hourly_run_sec)} · {pt.sampleCount ?? '—'}
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
