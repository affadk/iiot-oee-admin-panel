import React from 'react';
import { Button } from '../ui/Button';

export interface DataTableCursorPagination {
  hasMore: boolean;
  hasPrev: boolean;
  /**
   * E20 P20.4 (FAT-156, item 10): jumlah baris HALAMAN ini (envelope
   * `meta.count`, API doc §I FR-034-30..34) — BUKAN total dataset (tidak
   * ada query COUNT(*) total). Jangan ditampilkan sebagai "dari total".
   */
  totalCount?: number;
  pageIndex: number;
  onNextPage: () => void;
  onPrevPage: () => void;
  onResetPage: () => void;
}

interface DataTablePaginationProps {
  rowCount: number;
  isFetching: boolean;
  cursorPagination: DataTableCursorPagination;
}

/** Footer paginasi cursor. Dipindah dari DataTable.tsx (E32.6, FAT-287). */
export function DataTablePagination({
  rowCount,
  isFetching,
  cursorPagination,
}: DataTablePaginationProps) {
  return (
    <div className="px-4 py-3 bg-slate-50/60 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
      <span className="font-tabular">
        Menampilkan {rowCount} baris
        {' · '}Halaman {cursorPagination.pageIndex + 1}
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={!cursorPagination.hasPrev || isFetching}
          onClick={cursorPagination.onResetPage}
        >
          Awal
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={!cursorPagination.hasPrev || isFetching}
          onClick={cursorPagination.onPrevPage}
        >
          Sebelumnya
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={!cursorPagination.hasMore || isFetching}
          onClick={cursorPagination.onNextPage}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  );
}
