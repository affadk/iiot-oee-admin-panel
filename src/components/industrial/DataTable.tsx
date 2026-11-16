import React from 'react';
import { RowData, flexRender } from '@tanstack/react-table';
import {
  LegacyColumnDef as ColumnDef,
  getCoreRowModel,
  useLegacyTable,
} from '@tanstack/react-table/legacy';
import { AlertCircle, Clock, Database, RefreshCw } from 'lucide-react';
import { ApiError } from '../../types/auth';
import { Button } from '../ui/Button';

interface DataTableProps<TData extends RowData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  getRowId?: (row: TData, index: number) => string;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: unknown;
  onRetry?: () => void;
  dataUpdatedAt?: number;
  staleThresholdMs?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  cursorPagination?: {
    hasMore: boolean;
    hasPrev: boolean;
    totalCount?: number;
    pageIndex: number;
    onNextPage: () => void;
    onPrevPage: () => void;
    onResetPage: () => void;
  };
  onRowClick?: (row: TData) => void;
  skeletonRowCount?: number;
  minTableWidthClass?: string;
}

function getErrorDisplay(error: unknown): {
  title: string;
  message: string;
  canRetry: boolean;
  isRetention: boolean;
} {
  if (error instanceof ApiError) {
    if (error.httpStatus === 401) {
      return {
        title: 'Sesi Berakhir (401)',
        message: error.message,
        canRetry: false,
        isRetention: false,
      };
    }
    if (error.httpStatus === 403) {
      return {
        title: 'Akses Ditolak (403)',
        message: error.message,
        canRetry: false,
        isRetention: false,
      };
    }
    if (error.code === 'RETENTION_EXCEEDED') {
      return {
        title: 'Melebihi Batas Retensi 90 Hari (400)',
        message: `${error.message} Gunakan rentang waktu lebih baru (≤ 90 hari) atau buka Analitik Shift / Rollup.`,
        canRetry: false,
        isRetention: true,
      };
    }
    if (error.httpStatus === 404) {
      return {
        title: 'Data Tidak Ditemukan (404)',
        message: error.message,
        canRetry: false,
        isRetention: false,
      };
    }
    if (error.httpStatus === 429) {
      return {
        title: 'Batas Permintaan Tercapai (429)',
        message: error.message,
        canRetry: true,
        isRetention: false,
      };
    }
    if (error.httpStatus >= 500) {
      return {
        title: `Kesalahan Server (${error.httpStatus})`,
        message: `${error.message} (Waktu: ${new Date().toLocaleTimeString()})`,
        canRetry: true,
        isRetention: false,
      };
    }
    return {
      title: `Gagal Memuat Data (${error.code})`,
      message: error.message,
      canRetry: true,
      isRetention: false,
    };
  }

  return {
    title: 'Gagal Memuat Data',
    message: error instanceof Error ? error.message : 'Terjadi kesalahan saat memuat tabel.',
    canRetry: true,
    isRetention: false,
  };
}

export function DataTable<TData extends RowData>({
  data,
  columns,
  getRowId,
  isLoading = false,
  isFetching = false,
  error,
  onRetry,
  dataUpdatedAt,
  staleThresholdMs = 60_000,
  emptyTitle = 'Data tidak ditemukan',
  emptyDescription = 'Tidak ada baris yang cocok dengan filter aktif saat ini.',
  emptyActionLabel,
  onEmptyAction,
  cursorPagination,
  onRowClick,
  skeletonRowCount = 5,
  minTableWidthClass = 'min-w-[780px]',
}: DataTableProps<TData>) {
  const table = useLegacyTable<TData>({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: getRowId ? (row, idx) => getRowId(row, idx) : undefined,
  });

  const isStale = Boolean(
    dataUpdatedAt && dataUpdatedAt > 0 && Date.now() - dataUpdatedAt > staleThresholdMs
  );

  if (error) {
    const info = getErrorDisplay(error);
    return (
      <div
        role="alert"
        className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 rounded-lg p-6 text-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-red-900 dark:text-red-200">{info.title}</div>
              <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">{info.message}</p>
            </div>
          </div>
          {info.canRetry && onRetry && (
            <Button size="sm" variant="secondary" onClick={onRetry} className="shrink-0">
              <RefreshCw className="w-3.5 h-3.5" />
              Coba Lagi
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
      {/* Status / Stale strip */}
      {(isFetching || isStale || dataUpdatedAt) && (
        <div className="px-4 py-2 bg-slate-50/70 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2 font-tabular">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            {dataUpdatedAt && dataUpdatedAt > 0 ? (
              <span>Diperbarui: {new Date(dataUpdatedAt).toLocaleTimeString()}</span>
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
      )}

      {isLoading ? (
        <div className="p-4 space-y-2.5" aria-busy="true" aria-label="Memuat baris tabel">
          {Array.from({ length: skeletonRowCount }).map((_, idx) => (
            <div
              key={idx}
              className="h-10 rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse"
            />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="p-10 text-center space-y-3">
          <Database className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto" />
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {emptyTitle}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {emptyDescription}
            </p>
          </div>
          {emptyActionLabel && onEmptyAction && (
            <div>
              <Button size="sm" variant="secondary" onClick={onEmptyAction}>
                {emptyActionLabel}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className={`w-full text-left border-collapse ${minTableWidthClass}`}>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                >
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-4 py-3 whitespace-nowrap">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cursorPagination && (
        <div className="px-4 py-3 bg-slate-50/60 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-tabular">
            Menampilkan {data.length} baris
            {cursorPagination.totalCount !== undefined
              ? ` dari total ${cursorPagination.totalCount}`
              : ''}
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
      )}
    </div>
  );
}
