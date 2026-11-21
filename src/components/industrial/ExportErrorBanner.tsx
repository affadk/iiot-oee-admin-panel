import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

interface ExportErrorBannerProps {
  exportError: { code?: string; status?: number; message: string };
  onDismissError: () => void;
}

/** Banner error retensi/otorisasi ekspor. Dipindah dari HistoricalExportToolbar.tsx (E32.6, FAT-287). */
export function ExportErrorBanner({ exportError, onDismissError }: ExportErrorBannerProps) {
  return (
    <div
      role="alert"
      className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-lg text-xs text-red-900 dark:text-red-200 flex items-start justify-between gap-3"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold">
            Ekspor Data Tidak Dapat Diproses
          </div>
          <p className="text-red-800 dark:text-red-300">{exportError.message}</p>
          {exportError.code === 'RETENTION_EXCEEDED' && (
            <div>
              <Link
                to="/analytics"
                className="inline-block font-semibold text-red-900 dark:text-red-100 underline hover:no-underline"
              >
                Buka Analitik Shift OEE →
              </Link>
            </div>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onDismissError}
        aria-label="Tutup pesan error ekspor"
        className="text-red-600 dark:text-red-400 hover:text-red-800 font-bold px-1.5 py-0.5 cursor-pointer"
      >
        ✕
      </button>
    </div>
  );
}
