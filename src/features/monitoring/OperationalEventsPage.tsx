import React, { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { OperationalEvent } from '../../types/monitoring';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/industrial/DataTable';
import { HistoricalExportToolbar } from '../../components/industrial/HistoricalExportToolbar';
import { DEFAULT_HISTORY_PAGE_LIMIT } from '../../utils/historicalExport';
import { useHistoryFilters } from '../shared/historyFilters';
import { useMasterAssetsQuery, useOperationalEventsQuery } from '../shared/useHistoricalQueries';
import { useOperationalEvents } from './hooks/useOperationalEvents';
import { useOperationalEventColumns } from './hooks/useOperationalEventColumns';
import { OperationalEventsFilters } from './components/OperationalEventsFilters';
import { OperationalEventAckModal } from './components/OperationalEventAckModal';

export const OperationalEventsPage: React.FC = () => {
  const { filters, isValid, validationErrors, updateFilters, resetFilters } = useHistoryFilters({
    limit: DEFAULT_HISTORY_PAGE_LIMIT,
  });

  const [severityFilter, setSeverityFilter] = useState<'ALL' | OperationalEvent['severity']>('ALL');
  const [ackFilter, setAckFilter] = useState<'ALL' | 'UNACK' | 'ACK'>('ALL');
  const [customDeviceInput, setCustomDeviceInput] = useState('');
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const activeCursor = cursorStack[cursorStack.length - 1];

  const deviceFilter = filters.deviceId || 'ALL';
  const machineFilter = filters.machineId || 'ALL';
  const eventTypeFilter = (filters.eventType as 'ALL' | OperationalEvent['event_type']) || 'ALL';

  const handleFilterChange = (patch: Parameters<typeof updateFilters>[0]) => {
    setCursorStack([undefined]);
    updateFilters(patch);
  };

  const handleSeverityChange = (value: 'ALL' | OperationalEvent['severity']) => {
    setCursorStack([undefined]);
    setSeverityFilter(value);
  };

  const handleAckChange = (value: 'ALL' | 'UNACK' | 'ACK') => {
    setCursorStack([undefined]);
    setAckFilter(value);
  };

  const handleApplyCustomDevice = () => {
    if (customDeviceInput.trim()) {
      handleFilterChange({ deviceId: customDeviceInput.trim() });
    }
  };

  const {
    preset,
    isExporting,
    cooldownSeconds,
    exportError,
    setExportError,
    lastExport,
    setLastExport,
    ackTarget,
    setAckTarget,
    isAcking,
    actionError,
    handlePresetChange,
    handleExport,
    confirmAck,
  } = useOperationalEvents({
    filters,
    deviceFilter,
    machineFilter,
    eventTypeFilter,
    onFilterChange: handleFilterChange,
  });

  const columns = useOperationalEventColumns(setAckTarget);

  const { data: masterData } = useMasterAssetsQuery();
  const devices = masterData?.devices ?? [];
  const machines = masterData?.machines ?? [];

  const eventsQuery = useOperationalEventsQuery(
    deviceFilter,
    filters,
    activeCursor,
    {
      severity: severityFilter,
      acknowledged: ackFilter === 'ALL' ? undefined : ackFilter === 'ACK',
    },
    isValid
  );

  const events = eventsQuery.data?.data ?? [];
  const pagination = eventsQuery.data?.pagination;

  const isGlobalScope = deviceFilter === 'ALL';

  const deviceOptions = useMemo(() => {
    const ids = new Set(devices.map((d) => d.device_id));
    if (
      deviceFilter !== 'ALL' &&
      deviceFilter !== 'STM32-OEE-90-DEL' &&
      !ids.has(deviceFilter)
    ) {
      return [
        ...devices,
        {
          device_id: deviceFilter,
          bound_machine_name: '[dihapus / historis]',
        },
      ];
    }
    return devices;
  }, [devices, deviceFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Operational Events &amp; Incident Acknowledgments
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isGlobalScope
              ? 'Jejak audit operasional seluruh perangkat pabrik beserta fitur ack idempoten dan ekspor.'
              : `Riwayat kejadian operasional khusus perangkat ${deviceFilter}.`}
          </p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => eventsQuery.refetch()}
          isLoading={eventsQuery.isFetching}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </Button>
      </div>

      {!isValid && (
        <div
          role="alert"
          className="p-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2"
        >
          <span>Filter tidak valid: {Object.values(validationErrors).join(' · ')}</span>
          <Button size="sm" variant="secondary" onClick={resetFilters}>
            Reset Filter
          </Button>
        </div>
      )}

      <OperationalEventsFilters
        filters={filters}
        deviceOptions={deviceOptions}
        machines={machines}
        severityFilter={severityFilter}
        ackFilter={ackFilter}
        customDeviceInput={customDeviceInput}
        onCustomDeviceInputChange={setCustomDeviceInput}
        onFilterChange={handleFilterChange}
        onSeverityChange={handleSeverityChange}
        onAckChange={handleAckChange}
        onApplyCustomDevice={handleApplyCustomDevice}
      />

      <HistoricalExportToolbar
        preset={preset}
        onPresetChange={handlePresetChange}
        fromIso={filters.from}
        toIso={filters.to}
        onCustomRangeChange={(from, to) => handleFilterChange({ from, to })}
        onExport={handleExport}
        isExporting={isExporting}
        exportError={exportError}
        onDismissError={() => setExportError(null)}
        lastExport={lastExport}
        onDismissExport={() => setLastExport(null)}
        resourceId={deviceFilter}
        scopeLabel={isGlobalScope ? 'Scope: Global Plant Feed' : `Scope: ${deviceFilter}`}
        cooldownSeconds={cooldownSeconds}
      />

      {actionError && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-xs text-red-900 dark:text-red-200"
        >
          {actionError}
        </div>
      )}

      <DataTable
        data={events}
        columns={columns}
        getRowId={(r) => r.id}
        isLoading={eventsQuery.isLoading}
        isFetching={eventsQuery.isFetching}
        error={eventsQuery.error}
        onRetry={() => eventsQuery.refetch()}
        dataUpdatedAt={eventsQuery.dataUpdatedAt}
        emptyTitle="Tidak ada operational event"
        emptyDescription="Tidak ada kejadian operasional yang sesuai filter aktif."
        emptyActionLabel="Reset Filter"
        onEmptyAction={() => {
          setSeverityFilter('ALL');
          setAckFilter('ALL');
          resetFilters();
        }}
        cursorPagination={{
          hasMore: Boolean(pagination?.has_more),
          hasPrev: cursorStack.length > 1,
          totalCount: pagination?.total_count,
          pageIndex: cursorStack.length - 1,
          onNextPage: () => {
            if (pagination?.next_cursor) {
              setCursorStack((prev) => [...prev, pagination.next_cursor ?? undefined]);
            }
          },
          onPrevPage: () =>
            setCursorStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev)),
          onResetPage: () => setCursorStack([undefined]),
        }}
      />

      <OperationalEventAckModal
        target={ackTarget}
        isSubmitting={isAcking}
        onClose={() => {
          if (!isAcking) setAckTarget(null);
        }}
        onConfirmAck={confirmAck}
      />
    </div>
  );
};
