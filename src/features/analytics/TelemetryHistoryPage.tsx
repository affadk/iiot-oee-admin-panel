import React, { useState } from 'react';
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
import { useTelemetryRollupColumns } from './components/TelemetryRollupColumns';
import { TelemetryFilterBar } from './components/TelemetryFilterBar';
import { TelemetrySummaryStrip } from './components/TelemetrySummaryStrip';
import { TelemetryTabs } from './components/TelemetryTabs';
import { TelemetryTabPanels } from './components/TelemetryTabPanels';
import { formatPeriodLabel } from './scopeLabels';

export type { AggBucket, TelemetryTab };

export const TelemetryHistoryPage: React.FC = () => {
  const { filters, isValid, validationErrors, updateFilters, resetFilters } = useHistoryFilters({
    deviceId: 'STM32-OEE-01',
    groupBy: 'machine',
    bucket: '1h',
    limit: DEFAULT_HISTORY_PAGE_LIMIT,
  });

  const [activeTab, setActiveTab] = useState<TelemetryTab>('raw');
  const [customDeviceInput, setCustomDeviceInput] = useState<string>('');
  const [rollupDeviceFilter, setRollupDeviceFilter] = useState<string>('ALL');
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const activeCursor = cursorStack[cursorStack.length - 1];

  const selectedDevice = filters.deviceId || 'STM32-OEE-01';
  const aggBucket: AggBucket = filters.bucket ?? '1h';
  const groupBy: TelemetryRollupGroupBy = filters.groupBy ?? 'machine';
  // E11 T11.5 (U-1): label periode dari from/to filter aktif — diteruskan
  // ke tiap tab sebagai label scope eksplisit.
  const periodLabel = formatPeriodLabel(filters.from, filters.to);
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
    dismissExportError,
    dismissLastExport,
  } = useTelemetryExport({
    selectedDevice,
    from: filters.from,
    to: filters.to,
    onFilterChange: handleFilterChange,
  });

  const rawColumns = useTelemetryRawColumns();
  const hourlyColumns = useTelemetryHourlyColumns();
  const rollupColumns = useTelemetryRollupColumns(groupBy);

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

      <TelemetrySummaryStrip
        aggData={aggData}
        aggBucket={aggBucket}
        hourlyData={hourlyData}
        canExport={canExport.canInteract}
        isExporting={isExporting}
        cooldownSeconds={cooldownSeconds}
        onExportHourlyCsv={() => handleExport('csv', true)}
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
        aggData={aggData}
        aggregateIsLoading={aggregateQuery.isLoading}
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
      />
    </div>
  );
};
