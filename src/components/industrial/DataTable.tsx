import React from 'react';
import { RowData } from '@tanstack/react-table';
import {
  LegacyColumnDef as ColumnDef,
  getCoreRowModel,
  useLegacyTable,
} from '@tanstack/react-table/legacy';
import { DataTableEmptyState } from './DataTableEmptyState';
import { DataTableErrorPanel } from './DataTableErrorPanel';
import { DataTableGrid } from './DataTableGrid';
import { DataTableCursorPagination, DataTablePagination } from './DataTablePagination';
import { DataTableSkeleton } from './DataTableSkeleton';
import { DataTableStatusStrip } from './DataTableStatusStrip';

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
  cursorPagination?: DataTableCursorPagination;
  onRowClick?: (row: TData) => void;
  skeletonRowCount?: number;
  minTableWidthClass?: string;
}

/**
 * Satu-satunya cara menampilkan tabel (R1): loading / error / empty /
 * skeleton / cursor pagination / row-click, berbasis tanstack ColumnDef.
 *
 * E32.6 (FAT-287): sub-tampilan dipecah per tanggung jawab ke file di
 * folder yang sama (ErrorPanel, StatusStrip, Skeleton, EmptyState, Grid,
 * Pagination, dataTableError). API publik (props/exports) tidak berubah.
 */
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
    return <DataTableErrorPanel error={error} onRetry={onRetry} />;
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
      {/* Status / Stale strip */}
      {(isFetching || isStale || dataUpdatedAt) && (
        <DataTableStatusStrip
          isLoading={isLoading}
          isFetching={isFetching}
          isStale={isStale}
          dataUpdatedAt={dataUpdatedAt}
        />
      )}

      {isLoading ? (
        <DataTableSkeleton skeletonRowCount={skeletonRowCount} />
      ) : data.length === 0 ? (
        <DataTableEmptyState
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          emptyActionLabel={emptyActionLabel}
          onEmptyAction={onEmptyAction}
        />
      ) : (
        <DataTableGrid table={table} onRowClick={onRowClick} minTableWidthClass={minTableWidthClass} />
      )}

      {cursorPagination && (
        <DataTablePagination
          rowCount={data.length}
          isFetching={isFetching}
          cursorPagination={cursorPagination}
        />
      )}
    </div>
  );
}
