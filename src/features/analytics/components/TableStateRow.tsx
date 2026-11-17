import React from 'react';
import { Button } from '../../../components/ui/Button';

// ---------------------------------------------------------------------------
// E12 T12.5 (U-2 / FAT-52): baris state untuk tabel OEE hand-rolled
// (OeeHourlyTable / OeeRollupTable) — pola yang sama dengan DataTable di
// Telemetry History, mengikuti Guide §5: Loading = skeleton (bukan
// spinner layar penuh), Empty = sebab + aksi, Error = pesan Indonesia +
// tombol "Coba lagi".
//
// Pemakaian: dirender di dalam <tbody> bila TIDAK ADA baris data. Bila data
// sudah ada, tabel tetap menampilkan barisnya (stale-while-revalidate);
// `isLoading` React Query hanya true saat belum ada data sama sekali.
// ---------------------------------------------------------------------------

interface TableStateRowProps {
  /** Sedang memuat dan belum ada data — tampilkan skeleton. */
  isLoading: boolean;
  /** Query gagal dan tidak ada data — tampilkan pesan error + "Coba lagi". */
  isError: boolean;
  /** Jumlah kolom tabel (untuk colSpan). */
  colSpan: number;
  /** Judul empty state. Default: "Tidak ada data pada rentang ini". */
  emptyTitle?: string;
  /** Penjelasan empty state (sebab: filter/periode yang aktif). */
  emptyDescription?: string;
  /** Dipanggil tombol "Coba lagi" pada state error. */
  onRetry?: () => void;
  skeletonRowCount?: number;
}

export const TableStateRow: React.FC<TableStateRowProps> = ({
  isLoading,
  isError,
  colSpan,
  emptyTitle = 'Tidak ada data pada rentang ini',
  emptyDescription,
  onRetry,
  skeletonRowCount = 3,
}) => {
  if (isLoading) {
    return (
      <>
        {Array.from({ length: skeletonRowCount }).map((_, idx) => (
          <tr key={idx}>
            <td colSpan={colSpan} className="py-2.5 px-4">
              <div className="h-5 rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
              {idx === 0 && <span className="sr-only">Memuat data…</span>}
            </td>
          </tr>
        ))}
      </>
    );
  }

  if (isError) {
    return (
      <tr>
        <td colSpan={colSpan} className="py-8 px-4">
          <div role="alert" className="text-center space-y-1.5">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              Gagal memuat data
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Terjadi kesalahan saat memuat tabel. Coba lagi atau periksa koneksi.
            </p>
            {onRetry && (
              <div className="pt-1">
                <Button size="sm" variant="secondary" onClick={onRetry}>
                  Coba lagi
                </Button>
              </div>
            )}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={colSpan} className="py-8 px-4">
        <div className="text-center space-y-1.5">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {emptyTitle}
          </p>
          {emptyDescription && (
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {emptyDescription}
            </p>
          )}
        </div>
      </td>
    </tr>
  );
};
