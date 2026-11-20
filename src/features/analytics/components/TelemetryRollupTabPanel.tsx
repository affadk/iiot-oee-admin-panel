import React from 'react';
import { Download } from 'lucide-react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { TelemetryRollupGroupBy, TelemetryRollupItem } from '../../../types/analytics';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/industrial/DataTable';
import { useTelemetryRollupQuery } from '../../shared/useHistoricalQueries';
import { joinScopeLabel } from '../scopeLabels';

const ROLLUP_GROUP_BY_LABEL: Record<TelemetryRollupGroupBy, string> = {
  machine: 'Per Mesin',
  line: 'Per Lini',
  day: 'Per Hari',
  month: 'Per Bulan',
};

export interface TelemetryRollupTabPanelProps {
  rollupRecords: TelemetryRollupItem[];
  rollupColumns: ColumnDef<TelemetryRollupItem, unknown>[];
  rollupQuery: ReturnType<typeof useTelemetryRollupQuery>;
  rollupPagination: { has_more?: boolean; next_cursor?: string | null; total_count?: number } | undefined;
  cursorStackLength: number;
  onPushCursor: (next: string | undefined) => void;
  onPopCursor: () => void;
  onResetCursor: () => void;
  /** Label periode dari filter aktif (from/to) — diteruskan dari halaman. */
  periodLabel?: string;
  /** Filter perangkat rollup (independen dari perangkat halaman) + groupBy rollup. */
  rollupDeviceFilter?: string;
  rollupGroupBy?: TelemetryRollupGroupBy;
  /** E12 T12.7 (F-8 / FAT-60): ekspor rollup dari baris yang tampil. */
  canExportRollup?: boolean;
  onExportRollupCsv?: () => void;
}

/**
 * E31 (FAT-267): tab Rollup — dipisah dari `TelemetryTabPanels`
 * (296 baris, sisa 4 ke batas keras 300) mengikuti aturan R8 (satu
 * panel = satu concern). JSX dan perilaku tidak berubah — hanya dipindah
 * dari komponen induk. (Audit hanya menyebut 3 tab; file ini sebenarnya
 * punya 4 tab — rollup ikut dipecah supaya induknya benar-benar tipis.)
 */
export const TelemetryRollupTabPanel: React.FC<TelemetryRollupTabPanelProps> = ({
  rollupRecords,
  rollupColumns,
  rollupQuery,
  rollupPagination,
  cursorStackLength,
  onPushCursor,
  onPopCursor,
  onResetCursor,
  periodLabel,
  rollupDeviceFilter,
  rollupGroupBy,
  canExportRollup,
  onExportRollupCsv,
}) => {
  // E11 T11.5 (U-1): label scope eksplisit di tiap tab — periode (from/to
  // filter) + perangkat. Rollup memakai filter perangkatnya sendiri
  // (rollupDeviceFilter, independen dari perangkat halaman) + groupBy.
  const rollupScopeLabel = joinScopeLabel(
    periodLabel,
    rollupDeviceFilter && rollupDeviceFilter !== 'ALL'
      ? `Perangkat ${rollupDeviceFilter}`
      : 'Semua perangkat',
    rollupGroupBy ? ROLLUP_GROUP_BY_LABEL[rollupGroupBy] : ''
  );
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        {rollupScopeLabel && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{rollupScopeLabel}</p>
        )}
        {/* E12 T12.7 (F-8 / FAT-60): ekspor rollup dari baris yang sedang
            tampil di halaman ini (tanpa endpoint baru). */}
        <Button
          size="sm"
          variant="secondary"
          onClick={onExportRollupCsv}
          disabled={!canExportRollup || rollupRecords.length === 0 || !onExportRollupCsv}
          title="Ekspor baris rollup yang sedang tampil (halaman ini) sebagai CSV — kolom sama dengan layar"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Ekspor Rollup (CSV)</span>
        </Button>
      </div>
      <DataTable
        data={rollupRecords}
        columns={rollupColumns}
        getRowId={(r) => r.groupKey}
        isLoading={rollupQuery.isLoading}
        isFetching={rollupQuery.isFetching}
        error={rollupQuery.error}
        onRetry={() => rollupQuery.refetch()}
        dataUpdatedAt={rollupQuery.dataUpdatedAt}
        emptyTitle="Tidak ada data rollup"
        emptyDescription="Tidak ada hasil agregasi rollup untuk kombinasi filter yang dipilih."
        cursorPagination={{
          hasMore: Boolean(rollupPagination?.has_more),
          hasPrev: cursorStackLength > 1,
          totalCount: rollupPagination?.total_count,
          pageIndex: cursorStackLength - 1,
          onNextPage: () => {
            if (rollupPagination?.next_cursor) {
              onPushCursor(rollupPagination.next_cursor ?? undefined);
            }
          },
          onPrevPage: onPopCursor,
          onResetPage: onResetCursor,
        }}
      />
    </div>
  );
};
