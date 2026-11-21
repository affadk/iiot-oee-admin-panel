import React from 'react';
import { Button } from '../../../components/ui/Button';

// ---------------------------------------------------------------------------
// E12 T12.5 (U-2 / FAT-52): baris state untuk tabel hand-rolled (pola yang
// sama dengan DataTable, mengikuti Guide §5): Loading = skeleton (bukan
// spinner layar penuh), Empty = sebab + aksi, Error = pesan Indonesia +
// tombol "Coba lagi".
//
// E28 Batch B (FAT-219, E2E-05): dipindah dari
// `features/analytics/components/TableStateRow.tsx` ke `features/shared/`
// supaya SATU pola empty-state yang sama dipakai semua halaman —
// Products/Lines/Shifts/Shift-Schedules/Reconciliation — bukan duplikasi
// markup di 5 tempat. `EmptyStateBlock` adalah varian non-tabelnya (untuk
// halaman yang merender kartu, mis. DataReconciliationPage): judul +
// deskripsi yang SAMA dengan cabang empty di bawah, jadi tampilannya
// konsisten di kedua bentuk. Impor lama tetap jalan lewat re-export di
// path lama.
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
        <EmptyStateBlock emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
      </td>
    </tr>
  );
};

interface EmptyStateBlockProps {
  /** Judul empty state, mis. "Belum ada produk". */
  emptyTitle: string;
  /** Penjelasan empty state (sebab + aksi yang bisa dilakukan). */
  emptyDescription?: string;
}

/**
 * E28 Batch B (FAT-219): empty state sebagai blok mandiri (bukan `<tr>`)
 * untuk halaman tanpa `<table>` — dipakai DataReconciliationPage (kartu
 * job). Tipografi + warna SAMA dengan cabang empty `TableStateRow` di
 * atas: satu pola visual, dua bentuk penampung.
 */
export const EmptyStateBlock: React.FC<EmptyStateBlockProps> = ({
  emptyTitle,
  emptyDescription,
}) => (
  <div className="text-center space-y-1.5">
    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{emptyTitle}</p>
    {emptyDescription && (
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
        {emptyDescription}
      </p>
    )}
  </div>
);
