import React from 'react';
import { UseQueryResult } from '@tanstack/react-query';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import {
  TelemetryAggregatePoint,
  TelemetryAggregateResult,
} from '../../../types/analytics';
import { Badge } from '../../../components/ui/Badge';
import { DataTable } from '../../../components/industrial/DataTable';
import { AggBucket, TelemetryAggregateSummary } from '../hooks/useTelemetryQueries';
import { TelemetryAggregateChart } from './TelemetryAggregateChart';
import { joinScopeLabel } from '../scopeLabels';

export interface TelemetryAggregateTabPanelProps {
  selectedDevice: string;
  aggBucket: AggBucket;
  aggData: TelemetryAggregateSummary | undefined;
  aggregateQuery: UseQueryResult<TelemetryAggregateResult, Error>;
  aggColumns: ColumnDef<TelemetryAggregatePoint, unknown>[];
  /** Label periode dari filter aktif (from/to) — diteruskan dari halaman. */
  periodLabel?: string;
}

/**
 * E31 (FAT-267): tab Aggregate — dipisah dari `TelemetryTabPanels`
 * (296 baris, sisa 4 ke batas keras 300) mengikuti aturan R8 (satu
 * panel = satu concern). JSX dan perilaku tidak berubah — hanya dipindah
 * dari komponen induk.
 */
export const TelemetryAggregateTabPanel: React.FC<TelemetryAggregateTabPanelProps> = ({
  selectedDevice,
  aggBucket,
  aggData,
  aggregateQuery,
  aggColumns,
  periodLabel,
}) => {
  return (
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
                {aggData.avg_oee === null ? '—' : `${aggData.avg_oee}%`}
              </div>
            </div>
            <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50">
              <div className="text-[11px] text-slate-400">Availability</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {aggData.avg_availability === null ? '—' : `${aggData.avg_availability}%`}
              </div>
            </div>
            <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50">
              <div className="text-[11px] text-slate-400">Performance</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {aggData.avg_performance === null ? '—' : `${aggData.avg_performance}%`}
              </div>
            </div>
            <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50">
              <div className="text-[11px] text-slate-400">Quality</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {aggData.avg_quality === null ? '—' : `${aggData.avg_quality}%`}
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
  );
};
