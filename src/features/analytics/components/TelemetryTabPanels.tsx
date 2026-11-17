import React from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { UseQueryResult } from '@tanstack/react-query';
import {
  HourlyOeePoint,
  TelemetryAggregatePoint,
  TelemetryAggregateResult,
  TelemetryHistoryRecord,
  TelemetryRollupGroupBy,
  TelemetryRollupItem,
} from '../../../types/analytics';
import { TimeWindowPreset } from '../../../types/historical';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
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
import { TelemetryAggregateChart } from './TelemetryAggregateChart';
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
  aggregateQuery: UseQueryResult<TelemetryAggregateResult, Error>;
  aggColumns: ColumnDef<TelemetryAggregatePoint, unknown>[];
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
  /** E12 T12.7 (F-8 / FAT-60): ekspor rollup dari baris yang tampil. */
  canExportRollup?: boolean;
  onExportRollupCsv?: () => void;
  /** E12 T12.19 (U-5 / FAT-64): tautan ke tampilan kanonis OEE per jam di Analytics OEE (tab Per Jam di sini hanya tampilan ringkas). */
  oeeAnalyticsHref?: string;
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
  aggregateQuery,
  aggColumns,
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
  canExportRollup,
  onExportRollupCsv,
  oeeAnalyticsHref,
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
        {/* E12 T12.19 (U-5 / FAT-64): tampilan ringkas — tampilan kanonis OEE per jam ada di Analytics OEE; sumber data sama (CAgg `oee_hourly_summary`, gap G23). */}
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Tampilan ringkas dari OEE per jam — tampilan kanonis ada di <Link to={oeeAnalyticsHref ?? '/analytics/oee'} className="font-medium text-sky-600 dark:text-sky-400 hover:underline">Analytics OEE →</Link>. Sumber data sama (CAgg <code>oee_hourly_summary</code>).
        </p>
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
          {/* E12 T12.5 (U-2): badge jumlah sampel tidak lagi menampilkan "0"
              saat query masih memuat — konsisten dengan skeleton DataTable
              di bawahnya. */}
          <Badge variant="info">{aggregateQuery.isLoading ? '…' : (aggData?.sample_count ?? 0)} sampel</Badge>
        </div>
        {/* E12 T12.2 (F-5 / FAT-51): deret per-bucket, bukan satu kartu.
            Kartu ringkasan dipertahankan; grafik + tabel menampilkan seluruh
            rows. DataTable membawa loading/error/empty state-nya sendiri. */}
        {aggData && aggData.rows.length > 0 && (
          <>
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
            <TelemetryAggregateChart rows={aggData.rows} />
          </>
        )}
        <DataTable
          data={aggData?.rows ?? []}
          columns={aggColumns}
          getRowId={(r) => r.bucket}
          isLoading={aggregateQuery.isLoading}
          isFetching={aggregateQuery.isFetching}
          error={aggregateQuery.error}
          onRetry={() => aggregateQuery.refetch()}
          dataUpdatedAt={aggregateQuery.dataUpdatedAt}
          emptyTitle="Tidak ada data agregat"
          emptyDescription={`Belum ada bucket agregat untuk ${selectedDevice} pada rentang waktu yang dipilih.`}
        />
      </div>
    )}

    {activeTab === 'rollup' && (
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
    )}
  </>
  );
};
