import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { TelemetryRollupGroupBy } from '../../types/analytics';
import { HistoryFilters } from '../../types/historical';
import { useCapability } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { HistoricalExportToolbar } from '../../components/industrial/HistoricalExportToolbar';
import { DEFAULT_HISTORY_PAGE_LIMIT } from '../../utils/historicalExport';
import { useHistoryFilters } from '../shared/historyFilters';
import {
  AggBucket,
  TelemetryTab,
  useTelemetryQueries,
} from './hooks/useTelemetryQueries';
import { useTelemetryExport } from './hooks/useTelemetryExport';
import { useTelemetryRawColumns } from './components/TelemetryRawColumns';
import { useTelemetryHourlyColumns } from './components/TelemetryHourlyColumns';
import { useTelemetryAggregateColumns } from './components/TelemetryAggregateColumns';
import { useTelemetryRollupColumns } from './components/TelemetryRollupColumns';
import { TelemetryFilterBar } from './components/TelemetryFilterBar';
import { ShiftFilterBar } from './components/ShiftFilterBar';
import { TelemetrySummaryStrip } from './components/TelemetrySummaryStrip';
import { TelemetryTabs } from './components/TelemetryTabs';
import { TelemetryTabPanels } from './components/TelemetryTabPanels';
import { formatPeriodLabel, formatShiftFilterLabel } from './scopeLabels';
import {
  DEFAULT_AGGREGATE_BUCKET,
  DEFAULT_ROLLUP_GROUP_BY,
} from './telemetryDefaults';
import { useShiftsQuery } from '../shared/useHistoricalQueries';

export type { AggBucket, TelemetryTab };

export const TelemetryHistoryPage: React.FC = () => {
  const { filters, isValid, validationErrors, updateFilters, resetFilters } = useHistoryFilters({
    deviceId: 'STM32-OEE-01',
    // E12 T12.18 (U-4 / FAT-65): default dokumen — groupBy `day`
    // (API doc §K.3c), bucket aggregate `5m` (Guide §4.1).
    groupBy: DEFAULT_ROLLUP_GROUP_BY,
    bucket: DEFAULT_AGGREGATE_BUCKET,
    limit: DEFAULT_HISTORY_PAGE_LIMIT,
  });

  // E12 T12.19 (U-5 / FAT-64): tab awal boleh diminta lewat URL
  // (`?tab=hourly`) — dipakai tautan silang dari tampilan kanonis OEE per
  // jam di Analytics OEE agar langsung mendarat di tab Per Jam. Nilai di
  // luar keempat tab jatuh ke 'raw' (default lama).
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TelemetryTab>(() => {
    const tab = searchParams.get('tab');
    return tab === 'raw' || tab === 'hourly' || tab === 'aggregate' || tab === 'rollup'
      ? tab
      : 'raw';
  });
  const [customDeviceInput, setCustomDeviceInput] = useState<string>('');
  const [rollupDeviceFilter, setRollupDeviceFilter] = useState<string>('ALL');
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const activeCursor = cursorStack[cursorStack.length - 1];

  const selectedDevice = filters.deviceId || 'STM32-OEE-01';
  const aggBucket: AggBucket = filters.bucket ?? DEFAULT_AGGREGATE_BUCKET;
  const groupBy: TelemetryRollupGroupBy = filters.groupBy ?? DEFAULT_ROLLUP_GROUP_BY;
  // E12 T12.1 (X-1 / FAT-54): daftar shift untuk pemilih shift.
  const { data: shiftsPage } = useShiftsQuery();
  const shifts = shiftsPage?.data ?? [];
  const selectedShift = shifts.find((s) => s.shiftId === filters.shiftId);
  // E11 T11.5 (U-1): label periode dari from/to filter aktif — diteruskan
  // ke tiap tab sebagai label scope eksplisit.
  // E12 T12.1 (X-1 / FAT-54): bila filter shift aktif, label memakai
  // tanggal + shift terpilih.
  const periodLabel =
    selectedShift && filters.shiftDate
      ? formatShiftFilterLabel(selectedShift, filters.shiftDate)
      : formatPeriodLabel(filters.from, filters.to);
  const canExport = useCapability('export.telemetry', selectedDevice);

  const handleFilterChange = (patch: Partial<HistoryFilters>) => {
    setCursorStack([undefined]);
    updateFilters(patch);
  };

  const {
    devices,
    machines,
    telemetryQuery,
    hourlyQuery,
    aggregateQuery,
    rollupQuery,
    rawRecords,
    rawPagination,
    rollupRecords,
    rollupPagination,
    hourlyData,
    aggData,
    deviceOptions,
  } = useTelemetryQueries({
    filters,
    isValid,
    selectedDevice,
    aggBucket,
    rollupDeviceFilter,
    activeTab,
    activeCursor,
  });

  const {
    preset,
    isExporting,
    cooldownSeconds,
    exportError,
    lastExport,
    handlePresetChange,
    handleExport,
    handleExportRollup,
    dismissExportError,
    dismissLastExport,
  } = useTelemetryExport({
    selectedDevice,
    from: filters.from,
    to: filters.to,
    limit: filters.limit,
    onFilterChange: handleFilterChange,
  });

  const rawColumns = useTelemetryRawColumns();
  const hourlyColumns = useTelemetryHourlyColumns();
  const aggColumns = useTelemetryAggregateColumns();
  const rollupColumns = useTelemetryRollupColumns(groupBy);

  // E12 T12.19 (U-5 / FAT-64): tautan silang ke tampilan kanonis OEE per jam
  // di Analytics OEE — mesin yang terikat perangkat terpilih (bila ada),
  // supaya halaman Analytics membuka mesin yang sama; tanpa ikatan mesin,
  // tautan memakai default halaman Analytics.
  const oeeAnalyticsHref = useMemo(() => {
    const machine = machines.find(
      (m) => (m.bound_device_id ?? m.boundDevice?.device_id) === selectedDevice
    );
    return machine
      ? `/analytics/oee?machine_id=${encodeURIComponent(machine.machine_id)}`
      : '/analytics/oee';
  }, [machines, selectedDevice]);

  const handleTabChange = (tab: TelemetryTab) => {
    setCursorStack([undefined]);
    setActiveTab(tab);
  };

  const handleRollupDeviceFilterChange = (value: string) => {
    setCursorStack([undefined]);
    setRollupDeviceFilter(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Telemetry History, Rollup &amp; Raw Export
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Data mentah perangkat, agregat interval, delta per jam (dengan penanda provisional), dan rollup multi-mesin/hari/bulan.
          </p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            telemetryQuery.refetch();
            hourlyQuery.refetch();
            aggregateQuery.refetch();
            rollupQuery.refetch();
          }}
          isLoading={telemetryQuery.isFetching || rollupQuery.isFetching}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </Button>
      </div>

      <TelemetryFilterBar
        deviceOptions={deviceOptions}
        selectedDevice={selectedDevice}
        customDeviceInput={customDeviceInput}
        isBuffered={filters.isBuffered}
        aggBucket={aggBucket}
        onFilterChange={handleFilterChange}
        onCustomDeviceInputChange={setCustomDeviceInput}
        isValid={isValid}
        validationErrors={validationErrors}
        onResetFilters={resetFilters}
      />

      <ShiftFilterBar
        shifts={shifts}
        shiftDate={filters.shiftDate}
        shiftId={filters.shiftId}
        onFilterChange={handleFilterChange}
      />

      <TelemetrySummaryStrip
        aggData={aggData}
        aggBucket={aggBucket}
        hourlyData={hourlyData}
        canExport={canExport.canInteract}
        isExporting={isExporting}
        cooldownSeconds={cooldownSeconds}
        onExportHourlyCsv={() => handleExport('csv', true)}
        aggIsLoading={aggregateQuery.isLoading}
        aggIsError={aggregateQuery.isError}
        aggIsFetched={aggregateQuery.isFetched}
        onRetryAggregate={() => aggregateQuery.refetch()}
      />

      {/* Raw Export Toolbar */}
      <HistoricalExportToolbar
        preset={preset}
        onPresetChange={handlePresetChange}
        fromIso={filters.from}
        toIso={filters.to}
        onCustomRangeChange={(from, to) => handleFilterChange({ from, to })}
        onExport={(fmt) => handleExport(fmt, false)}
        isExporting={isExporting}
        exportError={exportError}
        onDismissError={dismissExportError}
        lastExport={lastExport}
        onDismissExport={dismissLastExport}
        resourceId={selectedDevice}
        scopeLabel={`Perangkat: ${selectedDevice}`}
        cooldownSeconds={cooldownSeconds}
      />

      <TelemetryTabs
        activeTab={activeTab}
        groupBy={groupBy}
        machines={machines}
        devices={devices}
        machineIdFilter={filters.machineId}
        rollupDeviceFilter={rollupDeviceFilter}
        onTabChange={handleTabChange}
        onFilterChange={handleFilterChange}
        onRollupDeviceFilterChange={handleRollupDeviceFilterChange}
      />

      <TelemetryTabPanels
        activeTab={activeTab}
        selectedDevice={selectedDevice}
        aggBucket={aggBucket}
        rawRecords={rawRecords}
        rawColumns={rawColumns}
        telemetryQuery={telemetryQuery}
        rawPagination={rawPagination}
        hourlyData={hourlyData}
        hourlyColumns={hourlyColumns}
        hourlyQuery={hourlyQuery}
        oeeAnalyticsHref={oeeAnalyticsHref}
        aggData={aggData}
        aggregateQuery={aggregateQuery}
        aggColumns={aggColumns}
        rollupRecords={rollupRecords}
        rollupColumns={rollupColumns}
        rollupQuery={rollupQuery}
        rollupPagination={rollupPagination}
        cursorStackLength={cursorStack.length}
        onPushCursor={(next) => setCursorStack((prev) => [...prev, next])}
        onPopCursor={() =>
          setCursorStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
        }
        onResetCursor={() => setCursorStack([undefined])}
        onPresetChange={handlePresetChange}
        periodLabel={periodLabel}
        rollupDeviceFilter={rollupDeviceFilter}
        rollupGroupBy={groupBy}
        canExportRollup={canExport.canInteract}
        onExportRollupCsv={() => handleExportRollup(rollupRecords, groupBy)}
      />
    </div>
  );
};
