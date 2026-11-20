import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/Button';

// ---------------------------------------------------------------------------
// E28 Batch A (FAT-215 E2E-01, FAT-216 E2E-02, FAT-217 E2E-03): banner error
// pemuatan yang SAMA untuk semua halaman — pola yang sudah dipakai
// OeeSummaryCards / TableStateRow (Guide §5): pesan Indonesia + tombol
// "Coba lagi". Bedakan dari empty state: banner ini hanya tampil bila query
// GAGAL, bukan bila data kosong.
// ---------------------------------------------------------------------------

interface LoadErrorBannerProps {
  /** Judul banner, mis. "Gagal memuat status mesin". */
  title: string;
  /** Pesan rinci dari server (bila ada); fallback generik bila kosong. */
  message?: string | null;
  /** Dipanggil tombol "Coba lagi". */
  onRetry?: () => void;
  /** Label tombol retry. Default: "Coba lagi". */
  retryLabel?: string;
}

export const LoadErrorBanner: React.FC<LoadErrorBannerProps> = ({
  title,
  message,
  onRetry,
  retryLabel = 'Coba lagi',
}) => (
  <div
    role="alert"
    className="p-4 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3"
  >
    <div className="flex items-start gap-2.5">
      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-red-700 dark:text-red-300">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {message || 'Terjadi kesalahan saat memuat data. Coba lagi atau periksa koneksi.'}
        </p>
      </div>
    </div>
    {onRetry && (
      <Button size="sm" variant="secondary" onClick={onRetry} className="shrink-0">
        {retryLabel}
      </Button>
    )}
  </div>
);
