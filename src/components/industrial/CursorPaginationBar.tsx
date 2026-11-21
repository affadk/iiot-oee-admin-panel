import React from 'react';
import { Select } from '../../components/ui/Select';
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
          Menampilkan <strong className="text-slate-900 dark:text-slate-100">{loadedCount}</strong>
          {/* E20 tindak lanjut: total dataset tidak pernah dikirim server
              (envelope `meta.count` = baris halaman, bukan total) — "dari
              total" hanya jujur bila tidak ada halaman lanjutan, karena
              saat itu semua rekaman sudah dimuat. Bila masih ada halaman,
              total tidak diketahui, jadi jangan tampilkan angka total. */}
          {!hasMore ? (
            <>
              {' '}dari <strong className="text-slate-900 dark:text-slate-100">{totalCount}</strong> rekaman
            </>
          ) : (
            <> rekaman</>
          )}
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
          <Select
            id="cursor-page-limit"
            aria-label="Per halaman"
            wrapperClassName="shrink-0"
            value={pageLimit}
            onChange={(e) => onPageLimitChange(Number(e.target.value))}
            options={[{ value: 10, label: '10' }, { value: 20, label: '20' }, { value: 50, label: '50' }]}
          />
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
