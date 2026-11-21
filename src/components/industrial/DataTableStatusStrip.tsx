import React from 'react';
import { Clock } from 'lucide-react';
import { formatTimeWithSeconds } from '../../utils/formatDate';

interface DataTableStatusStripProps {
  isLoading: boolean;
  isFetching: boolean;
  isStale: boolean;
  dataUpdatedAt?: number;
}

/**
 * Strip status di atas tabel: jam pembaruan terakhir, penanda data usang,
 * dan indikator sinkronisasi. Dipindah dari DataTable.tsx (E32.6, FAT-287).
 */
export function DataTableStatusStrip({
  isLoading,
  isFetching,
  isStale,
  dataUpdatedAt,
}: DataTableStatusStripProps) {
  return (
    <div className="px-4 py-2 bg-slate-50/70 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
      <div className="flex items-center gap-2 font-tabular">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        {dataUpdatedAt && dataUpdatedAt > 0 ? (
          <span>Diperbarui: {formatTimeWithSeconds(dataUpdatedAt)}</span>
        ) : (
          <span>Memuat data...</span>
        )}
        {isStale && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-amber-600 dark:text-amber-400 font-medium font-sans">
              Data mungkin usang (&gt;1 menit)
            </span>
          </>
        )}
      </div>
      {isFetching && !isLoading && (
        <span className="text-sky-600 dark:text-sky-400 font-medium">Menyinkronkan...</span>
      )}
    </div>
  );
}
