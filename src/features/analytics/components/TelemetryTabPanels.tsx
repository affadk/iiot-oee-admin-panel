import React from 'react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { UseQueryResult } from '@tanstack/react-query';
import {
  HourlyOeePoint,
  TelemetryHistoryRecord,
  TelemetryRollupGroupBy,
  TelemetryRollupItem,
} from '../../../types/analytics';
import { TimeWindowPreset } from '../../../types/historical';
import { Badge } from '../../../components/ui/Badge';
import { DataTable } from '../../../components/industrial/DataTable';
import {
  useTelemetryHistoryQuery,
  useTelemetryRollupQuery,
} from '../../shared/useHistoricalQueries';
import {
  AggBucket,
  TelemetryAggregateSummary,
  TelemetryTab,
} from '../hooks/useTelemetryQueries';
import { joinScopeLabel } from '../scopeLabels';

const ROLLUP_GROUP_BY_LABEL: Record<TelemetryRollupGroupBy, string> = {
  machine: 'Per Mesin',
  day: 'Per Hari',
  month: 'Per Bulan',
};

export interface TelemetryTabPanelsProps {
  activeTab: TelemetryTab;
  selectedDevice: string;
  aggBucket: AggBucket;
  rawRecords: TelemetryHistoryRecord[];
  rawColumns: ColumnDef<TelemetryHistoryRecord, unknown>[];
  telemetryQuery: ReturnType<typeof useTelemetryHistoryQuery>;
  rawPagination: { has_more?: boolean; next_cursor?: string | null; total_count?: number } | undefined;
  hourlyData: HourlyOeePoint[];
  hourlyColumns: ColumnDef<HourlyOeePoint, unknown>[];
  hourlyQuery: UseQueryResult<HourlyOeePoint[], Error>;
  aggData: TelemetryAggregateSummary | undefined;
  aggregateIsLoading: boolean;
  rollupRecords: TelemetryRollupItem[];
  rollupColumns: ColumnDef<TelemetryRollupItem, unknown>[];
  rollupQuery: ReturnType<typeof useTelemetryRollupQuery>;
  rollupPagination: { has_more?: boolean; next_cursor?: string | null; total_count?: number } | undefined;
  cursorStackLength: number;
  onPushCursor: (next: string | undefined) => void;
  onPopCursor: () => void;
  onResetCursor: () => void;
  onPresetChange: (preset: TimeWindowPreset) => void;
  /** Label periode dari filter aktif (from/to) — diteruskan dari halaman. */
  periodLabel?: string;
  /** Filter perangkat rollup (independen dari perangkat halaman) + groupBy rollup. */
  rollupDeviceFilter?: string;
  rollupGroupBy?: TelemetryRollupGroupBy;
}

export const TelemetryTabPanels: React.FC<TelemetryTabPanelsProps> = ({
  activeTab,
  selectedDevice,
  aggBucket,
  rawRecords,
  rawColumns,
  telemetryQuery,
  rawPagination,
  hourlyData,
  hourlyColumns,
  hourlyQuery,
  aggData,
  aggregateIsLoading,
  rollupRecords,
  rollupColumns,
  rollupQuery,
  rollupPagination,
  cursorStackLength,
  onPushCursor,
  onPopCursor,
  onResetCursor,
  onPresetChange,
  periodLabel,
  rollupDeviceFilter,
  rollupGroupBy,
}) => {
  // E11 T11.5 (U-1): label scope eksplisit di tiap tab — periode (from/to
  // filter) + perangkat. Rollup memakai filter perangkatnya sendiri
  // (rollupDeviceFilter, independen dari perangkat halaman) + groupBy.
  const deviceScopeLabel = joinScopeLabel(periodLabel, `Perangkat ${selectedDevice}`);
  const rollupScopeLabel = joinScopeLabel(
    periodLabel,
    rollupDeviceFilter && rollupDeviceFilter !== 'ALL'
      ? `Perangkat ${rollupDeviceFilter}`
      : 'Semua perangkat',
    rollupGroupBy ? ROLLUP_GROUP_BY_LABEL[rollupGroupBy] : ''
  );
  return (
  <>
    {activeTab === 'raw' && (
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
    )}

    {activeTab === 'hourly' && (
      <div className="space-y-2">
        {deviceScopeLabel && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{deviceScopeLabel}</p>
        )}
      <DataTable
        data={hourlyData}
        columns={hourlyColumns}
        getRowId={(r) => r.hour}
        isLoading={hourlyQuery.isLoading}
        isFetching={hourlyQuery.isFetching}
        error={hourlyQuery.error}
        onRetry={() => hourlyQuery.refetch()}
        dataUpdatedAt={hourlyQuery.dataUpdatedAt}
        emptyTitle="Data per jam tidak tersedia"
        emptyDescription="Tidak ada bucket produksi per jam untuk perangkat ini."
      />
      </div>
    )}

    {activeTab === 'aggregate' && (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Hasil Downsampling Interval {aggBucket} · {selectedDevice}
            </h3>
            <p className="text-xs text-slate-500">
              {joinScopeLabel(
                periodLabel,
                'Menyaring resolusi data telemetri berdasarkan bucket waktu untuk analisis tren cepat.'
              )}
            </p>
          </div>
          <Badge variant="info">{aggData?.sample_count ?? 0} sampel</Badge>
        </div>
        {aggregateIsLoading ? (
          <div className="h-20 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
        ) : aggData ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-tabular">
            <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50">
              <div className="text-[11px] text-slate-400">OEE Rata-rata</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {aggData.avg_oee}%
              </div>
            </div>
            <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50">
              <div className="text-[11px] text-slate-400">Availability</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {aggData.avg_availability}%
              </div>
            </div>
            <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50">
              <div className="text-[11px] text-slate-400">Performance</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {aggData.avg_performance}%
              </div>
            </div>
            <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50">
              <div className="text-[11px] text-slate-400">Quality</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {aggData.avg_quality}%
              </div>
            </div>
            <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50">
              <div className="text-[11px] text-slate-400">Total Parts</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {aggData.total_parts} pcs
              </div>
            </div>
          </div>
        ) : null}
      </div>
    )}

    {activeTab === 'rollup' && (
      <div className="space-y-2">
        {rollupScopeLabel && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{rollupScopeLabel}</p>
        )}
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
    )}
  </>
  );
};
