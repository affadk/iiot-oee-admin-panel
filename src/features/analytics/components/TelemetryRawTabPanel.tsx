import React from 'react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { TelemetryHistoryRecord } from '../../../types/analytics';
import { TimeWindowPreset } from '../../../types/historical';
import { DataTable } from '../../../components/industrial/DataTable';
import { useTelemetryHistoryQuery } from '../../shared/useHistoricalQueries';
import { joinScopeLabel } from '../scopeLabels';

export interface TelemetryRawTabPanelProps {
  selectedDevice: string;
  rawRecords: TelemetryHistoryRecord[];
  rawColumns: ColumnDef<TelemetryHistoryRecord, unknown>[];
  telemetryQuery: ReturnType<typeof useTelemetryHistoryQuery>;
  rawPagination: { has_more?: boolean; next_cursor?: string | null; total_count?: number } | undefined;
  cursorStackLength: number;
  onPushCursor: (next: string | undefined) => void;
  onPopCursor: () => void;
  onResetCursor: () => void;
  onPresetChange: (preset: TimeWindowPreset) => void;
  /** Label periode dari filter aktif (from/to) — diteruskan dari halaman. */
  periodLabel?: string;
}

/**
 * E31 (FAT-267): tab Raw — dipisah dari `TelemetryTabPanels`
 * (296 baris, sisa 4 ke batas keras 300) mengikuti aturan R8 (page/
 * panel hanya menyusun; satu panel = satu concern). JSX dan perilaku
 * tidak berubah — hanya dipindah dari komponen induk.
 */
export const TelemetryRawTabPanel: React.FC<TelemetryRawTabPanelProps> = ({
  selectedDevice,
  rawRecords,
  rawColumns,
  telemetryQuery,
  rawPagination,
  cursorStackLength,
  onPushCursor,
  onPopCursor,
  onResetCursor,
  onPresetChange,
  periodLabel,
}) => {
  // E11 T11.5 (U-1): label scope eksplisit di tiap tab — periode (from/to
  // filter) + perangkat.
  const deviceScopeLabel = joinScopeLabel(periodLabel, `Perangkat ${selectedDevice}`);
  return (
    <div className="space-y-2">
      {deviceScopeLabel && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{deviceScopeLabel}</p>
      )}
      <DataTable
        data={rawRecords}
        columns={rawColumns}
        getRowId={(r) => r.id}
        isLoading={telemetryQuery.isLoading}
        isFetching={telemetryQuery.isFetching}
        error={telemetryQuery.error}
        onRetry={() => telemetryQuery.refetch()}
        dataUpdatedAt={telemetryQuery.dataUpdatedAt}
        emptyTitle="Tidak ada rekaman telemetri"
        emptyDescription={`Belum ada paket telemetri untuk ${selectedDevice} pada rentang waktu yang dipilih.`}
        emptyActionLabel="Reset ke 7 Hari"
        onEmptyAction={() => onPresetChange('7d')}
        cursorPagination={{
          hasMore: Boolean(rawPagination?.has_more),
          hasPrev: cursorStackLength > 1,
          totalCount: rawPagination?.total_count,
          pageIndex: cursorStackLength - 1,
          onNextPage: () => {
            if (rawPagination?.next_cursor) {
              onPushCursor(rawPagination.next_cursor ?? undefined);
            }
          },
          onPrevPage: onPopCursor,
          onResetPage: onResetCursor,
        }}
      />
    </div>
  );
};
