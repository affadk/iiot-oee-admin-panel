import React from 'react';
import { Button } from '../../../components/ui/Button';
import { EmptyStateBlock } from '../../shared/TableStateRow';

export interface ShiftTimelineStatesProps {
  /** Sedang memuat dan belum ada segmen — tampilkan skeleton. */
  isLoading: boolean;
  /** Query gagal dan tidak ada segmen — tampilkan pesan error. */
  isError: boolean;
  /** Tidak ada segmen pada rentang ini — tampilkan pesan kosong. */
  isEmpty: boolean;
  /** Dipanggil tombol "Coba lagi" pada state error. */
  onRetry?: () => void;
}

/**
 * E31 (FAT-277): state memuat/gagal/kosong timeline — dipisah dari
 * `ShiftTimeline` mengikuti aturan R8 (satu komponen = satu concern).
 * JSX dan perilaku tidak berubah — hanya dipindah dari komponen induk.
 *
 * E12 T12.5 (U-2): timeline kosong bukan lagi bar kosong tanpa pesan
 * (gap G17, Guide §5) — bedakan memuat / gagal / tidak ada data pada
 * rentang ini. Urutan prioritas sama seperti sebelumnya: memuat menang
 * atas gagal, gagal menang atas kosong.
 */
export const ShiftTimelineStates: React.FC<ShiftTimelineStatesProps> = ({
  isLoading,
  isError,
  isEmpty,
  onRetry,
}) => {
  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Memuat timeline"
        className="w-full h-9 rounded bg-slate-100 dark:bg-slate-800 animate-pulse"
      >
        <span className="sr-only">Memuat timeline…</span>
      </div>
    );
  }
  if (isError) {
    return (
      <div
        role="alert"
        className="w-full rounded border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
      >
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">
            Gagal memuat timeline
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Terjadi kesalahan saat memuat timeline status mesin. Coba lagi atau periksa koneksi.
          </p>
        </div>
        {onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry} className="shrink-0">
            Coba lagi
          </Button>
        )}
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="w-full rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 text-center space-y-0.5">
        <EmptyStateBlock
          emptyTitle="Tidak ada data timeline pada rentang ini"
          emptyDescription="Belum ada segmen status mesin untuk mesin dan periode yang dipilih."
        />
      </div>
    );
  }
  return null;
};
