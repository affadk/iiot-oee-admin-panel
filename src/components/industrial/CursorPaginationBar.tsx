import React from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';

interface CursorPaginationBarProps {
  loadedCount: number;
  totalCount: number;
  hasMore: boolean;
  nextCursor: string | null;
  pageLimit: number;
  onPageLimitChange: (limit: number) => void;
  onLoadMore: () => void;
  onReset: () => void;
  isLoading: boolean;
  hasActiveCursor: boolean;
}

export const CursorPaginationBar: React.FC<CursorPaginationBarProps> = ({
  loadedCount,
  totalCount,
  hasMore,
  nextCursor,
  pageLimit,
  onPageLimitChange,
  onLoadMore,
  onReset,
  isLoading,
  hasActiveCursor,
}) => {
  return (
    <div className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
      <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-300 font-tabular">
        <span>
          Menampilkan <strong className="text-slate-900 dark:text-slate-100">{loadedCount}</strong> dari{' '}
          <strong className="text-slate-900 dark:text-slate-100">{totalCount}</strong> rekaman
        </span>
        <span aria-hidden="true" className="text-slate-400">·</span>
        <span className="font-sans text-slate-500 dark:text-slate-400">Urutan menurun (terbaru)</span>
        {nextCursor && (
          <>
            <span aria-hidden="true" className="text-slate-400">·</span>
            <span className="font-sans text-[11px] text-sky-600 dark:text-sky-400">
              Halaman lanjutan tersedia
            </span>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="cursor-page-limit"
            className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap"
          >
            Per halaman:
          </label>
          <select
            id="cursor-page-limit"
            value={pageLimit}
            onChange={(e) => onPageLimitChange(Number(e.target.value))}
            className="px-2 py-1 text-xs font-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-sky-500 focus:outline-none"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>

        {hasActiveCursor && (
          <Button size="sm" variant="ghost" onClick={onReset} disabled={isLoading}>
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Halaman Awal</span>
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={onLoadMore}
          disabled={!hasMore || isLoading}
          isLoading={isLoading}
        >
          <ChevronDown className="w-3.5 h-3.5" />
          <span>{hasMore ? 'Muat Lebih Banyak' : 'Semua Rekaman Dimuat'}</span>
        </Button>
      </div>
    </div>
  );
};
