import React from 'react';
import { Link } from 'react-router-dom';
import { UseQueryResult } from '@tanstack/react-query';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { HourlyOeePoint } from '../../../types/analytics';
import { DataTable } from '../../../components/industrial/DataTable';
import { joinScopeLabel } from '../scopeLabels';

export interface TelemetryHourlyTabPanelProps {
  selectedDevice: string;
  hourlyData: HourlyOeePoint[];
  hourlyColumns: ColumnDef<HourlyOeePoint, unknown>[];
  hourlyQuery: UseQueryResult<HourlyOeePoint[], Error>;
  /** Label periode dari filter aktif (from/to) — diteruskan dari halaman. */
  periodLabel?: string;
  /** E12 T12.19 (U-5 / FAT-64): tautan ke tampilan kanonis OEE per jam di Analytics OEE (tab Per Jam di sini hanya tampilan ringkas). */
  oeeAnalyticsHref?: string;
}

/**
 * E31 (FAT-267): tab Per Jam — dipisah dari `TelemetryTabPanels`
 * (296 baris, sisa 4 ke batas keras 300) mengikuti aturan R8 (satu
 * panel = satu concern). JSX dan perilaku tidak berubah — hanya dipindah
 * dari komponen induk.
 */
export const TelemetryHourlyTabPanel: React.FC<TelemetryHourlyTabPanelProps> = ({
  selectedDevice,
  hourlyData,
  hourlyColumns,
  hourlyQuery,
  periodLabel,
  oeeAnalyticsHref,
}) => {
  // E11 T11.5 (U-1): label scope eksplisit di tiap tab — periode (from/to
  // filter) + perangkat.
  const deviceScopeLabel = joinScopeLabel(periodLabel, `Perangkat ${selectedDevice}`);
  return (
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
  );
};
