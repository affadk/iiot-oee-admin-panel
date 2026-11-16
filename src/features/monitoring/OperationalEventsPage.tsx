import React, { useEffect, useMemo, useState } from 'react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle2, RefreshCw, MessageSquarePlus } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { OperationalEvent } from '../../types/monitoring';
import { ExportFormat, TimeWindowPreset } from '../../types/historical';
import { ApiError } from '../../types/auth';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { DataTable } from '../../components/industrial/DataTable';
import { HistoricalExportToolbar } from '../../components/industrial/HistoricalExportToolbar';
import {
  DEFAULT_HISTORY_PAGE_LIMIT,
  resolveTimeWindowPreset,
  triggerBrowserDownload,
  withExportAbortTimeout,
} from '../../utils/historicalExport';
import { formatDeletedRelationLabel } from '../../utils/oeeCalculations';
import { useHistoryFilters } from '../shared/historyFilters';
import { useMasterAssetsQuery, useOperationalEventsQuery } from '../shared/useHistoricalQueries';

const EVENT_TYPE_OPTIONS: Array<'ALL' | OperationalEvent['event_type']> = [
  'ALL',
  'ALARM',
  'STATE_CHANGE',
  'COMMAND_EXECUTED',
  'DISCONNECT',
  'HEARTBEAT_TIMEOUT',
  'MASTER_DATA_MUTATION',
  'MACHINE_BOUND',
  'MACHINE_UNBOUND',
  'PRODUCT_DELETED',
  'WORK_ORDER_CANCELLED',
  'WORK_ORDER_COMPLETED',
  'MQTT_ADMIN_ACTION',
  'IAM_POLICY_CHANGED',
  'SECURITY_REJECTION',
  'AUTH_TOKEN_REFRESHED',
];

export const OperationalEventsPage: React.FC = () => {
  const { reportForbidden, checkCapability } = useAuth();
  const queryClient = useQueryClient();

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

  const [preset, setPreset] = useState<TimeWindowPreset>('7d');
  const [isExporting, setIsExporting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [exportError, setExportError] = useState<{
    code?: string;
    status?: number;
    message: string;
  } | null>(null);
  const [lastExport, setLastExport] = useState<Awaited<
    ReturnType<typeof apiClient.exportOperationalEventsData>
  > | null>(null);

  const [ackTarget, setAckTarget] = useState<OperationalEvent | null>(null);
  const [ackNote, setAckNote] = useState('');
  const [isAcking, setIsAcking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const t = setInterval(() => setCooldownSeconds((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldownSeconds]);

  const handleFilterChange = (patch: Parameters<typeof updateFilters>[0]) => {
    setCursorStack([undefined]);
    updateFilters(patch);
  };

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

  const handlePresetChange = (nextPreset: TimeWindowPreset) => {
    setPreset(nextPreset);
    setExportError(null);
    if (nextPreset !== 'custom') {
      const range = resolveTimeWindowPreset(nextPreset);
      handleFilterChange({ from: range.from, to: range.to });
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (isExporting || cooldownSeconds > 0) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const result = await withExportAbortTimeout(undefined, (signal) =>
        apiClient.exportOperationalEventsData(
          {
            device_id: deviceFilter,
            machine_id:
              deviceFilter === 'ALL' && machineFilter !== 'ALL' ? machineFilter : undefined,
            event_type: eventTypeFilter === 'ALL' ? undefined : eventTypeFilter,
            from: filters.from,
            to: filters.to,
            format,
          },
          signal
        )
      );
      setLastExport(result);
      triggerBrowserDownload(result.filename, result.content, result.mimeType);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('export.telemetry', deviceFilter, err.message);
      }
      const status =
        err instanceof ApiError
          ? err.httpStatus
          : (err as { status?: number })?.status;
      if (status === 429) {
        setCooldownSeconds(30);
      }
      setExportError({
        code: (err as { code?: string })?.code,
        status,
        message: err instanceof Error ? err.message : 'Gagal mengekspor operational events.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleConfirmAck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ackTarget || isAcking) return;
    setIsAcking(true);
    setActionError(null);
    try {
      await apiClient.acknowledgeOperationalEvent(ackTarget.id, ackNote.trim() || undefined);
      setAckTarget(null);
      setAckNote('');
      await queryClient.invalidateQueries({ queryKey: ['operational-events'] });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('operational_event.ack', ackTarget.id, err.message);
      }
      setActionError(err instanceof Error ? err.message : 'Gagal melakukan acknowledge event.');
    } finally {
      setIsAcking(false);
    }
  };

  const columns = useMemo<ColumnDef<OperationalEvent, unknown>[]>(
    () => [
      {
        id: 'timestamp',
        header: 'Timestamp',
        cell: ({ row }) => (
          <span className="font-tabular text-xs text-slate-500 whitespace-nowrap">
            {new Date(row.original.timestamp).toLocaleString()}
          </span>
        ),
      },
      {
        id: 'severity',
        header: 'Severity & Type',
        cell: ({ row }) => {
          const ev = row.original;
          return (
            <div className="space-y-1">
              <Badge
                variant={
                  ev.severity === 'CRITICAL'
                    ? 'danger'
                    : ev.severity === 'WARN'
                    ? 'warning'
                    : 'info'
                }
              >
                {ev.severity}
              </Badge>
              <div className="text-[11px] font-tabular text-slate-500">{ev.event_type}</div>
            </div>
          );
        },
      },
      {
        id: 'machine',
        header: 'Mesin / Device',
        cell: ({ row }) => {
          const ev = row.original;
          const machLbl = formatDeletedRelationLabel(ev.machine_name, ev.machine_id);
          const devLbl = formatDeletedRelationLabel(ev.device_id, null);
          return (
            <div className="text-xs">
              <div
                className={
                  machLbl.isDeleted
                    ? 'italic text-slate-400'
                    : 'font-semibold text-slate-900 dark:text-slate-100'
                }
              >
                {machLbl.label}
              </div>
              <div className="text-[11px] font-tabular text-slate-400">
                {devLbl.isDeleted ? '[dihapus]' : ev.device_id}
              </div>
            </div>
          );
        },
      },
      {
        id: 'message',
        header: 'Pesan',
        cell: ({ row }) => (
          <span className="text-xs text-slate-700 dark:text-slate-300 block max-w-md">
            {row.original.message}
          </span>
        ),
      },
      {
        id: 'ack',
        header: 'Acknowledgment',
        cell: ({ row }) => {
          const ev = row.original;
          return ev.acknowledged ? (
            <div className="space-y-0.5 text-[11px]">
              <div className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{ev.acknowledged_by}</span>
              </div>
              {ev.acknowledged_at && (
                <div className="text-slate-400 font-tabular">
                  {new Date(ev.acknowledged_at).toLocaleString()}
                </div>
              )}
              {ev.ack_note && (
                <div className="italic text-slate-600 dark:text-slate-300">“{ev.ack_note}”</div>
              )}
            </div>
          ) : (
            <Badge variant="warning">Pending Ack</Badge>
          );
        },
      },
      {
        id: 'actions',
        header: () => <div className="text-right">Aksi</div>,
        cell: ({ row }) => {
          const ev = row.original;
          const rowAckCap = checkCapability('operational_event.ack', ev.id);
          return (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant={ev.acknowledged ? 'outline' : 'primary'}
                disabled={!rowAckCap.canInteract}
                title={
                  !rowAckCap.canInteract
                    ? rowAckCap.reason
                    : 'Acknowledge / perbarui catatan event'
                }
                onClick={() => {
                  setAckTarget(ev);
                  setAckNote(ev.ack_note ?? '');
                }}
              >
                {ev.acknowledged ? (
                  <>
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                    <span>Note</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5" />
                    <span>Ack</span>
                  </>
                )}
              </Button>
            </div>
          );
        },
      },
    ],
    [checkCapability]
  );

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

      {/* Filters */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label htmlFor="opev-device-scope" className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
              Device Scope
            </label>
            <select
              id="opev-device-scope"
              value={deviceFilter}
              onChange={(e) =>
                handleFilterChange({
                  deviceId: e.target.value === 'ALL' ? undefined : e.target.value,
                })
              }
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
            >
              <option value="ALL">Global Feed (ALL Devices)</option>
              {deviceOptions.map((d) => (
                <option key={d.device_id} value={d.device_id}>
                  {d.device_id}
                </option>
              ))}
              <option value="STM32-OEE-90-DEL">STM32-OEE-90-DEL — [dihapus]</option>
            </select>
          </div>

          <div>
            <label htmlFor="opev-machine-filter" className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
              Machine Filter {isGlobalScope ? '' : '(Global Only)'}
            </label>
            <select
              id="opev-machine-filter"
              value={machineFilter}
              disabled={!isGlobalScope}
              onChange={(e) =>
                handleFilterChange({
                  machineId: e.target.value === 'ALL' ? undefined : e.target.value,
                })
              }
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 disabled:opacity-50"
            >
              <option value="ALL">Semua Mesin</option>
              {machines.map((m) => (
                <option key={m.machine_id} value={m.machine_id}>
                  {m.machine_id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="opev-type-filter" className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
              Event Type
            </label>
            <select
              id="opev-type-filter"
              value={eventTypeFilter}
              onChange={(e) =>
                handleFilterChange({
                  eventType: e.target.value === 'ALL' ? undefined : e.target.value,
                })
              }
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
            >
              {EVENT_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="opev-severity-filter" className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
              Severity
            </label>
            <select
              id="opev-severity-filter"
              value={severityFilter}
              onChange={(e) => {
                setCursorStack([undefined]);
                setSeverityFilter(e.target.value as 'ALL' | OperationalEvent['severity']);
              }}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
            >
              <option value="ALL">Semua Severity</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="WARN">WARN</option>
              <option value="INFO">INFO</option>
            </select>
          </div>

          <div>
            <label htmlFor="opev-ack-filter" className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
              Ack Status
            </label>
            <select
              id="opev-ack-filter"
              value={ackFilter}
              onChange={(e) => {
                setCursorStack([undefined]);
                setAckFilter(e.target.value as 'ALL' | 'UNACK' | 'ACK');
              }}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
            >
              <option value="ALL">Semua</option>
              <option value="UNACK">Belum Ack</option>
              <option value="ACK">Sudah Ack</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <label htmlFor="opev-custom-device" className="text-[11px] font-medium text-slate-500">
            Cari Device ID Historis / Terhapus:
          </label>
          <input
            id="opev-custom-device"
            type="text"
            value={customDeviceInput}
            onChange={(e) => setCustomDeviceInput(e.target.value)}
            placeholder="mis. STM32-OEE-90-DEL"
            className="w-56 px-2.5 py-1 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (customDeviceInput.trim()) {
                handleFilterChange({ deviceId: customDeviceInput.trim() });
              }
            }}
          >
            Terapkan
          </Button>
        </div>
      </div>

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

      {/* Ack Modal */}
      <Modal
        isOpen={Boolean(ackTarget)}
        onClose={() => !isAcking && setAckTarget(null)}
        title={`Acknowledge Event ${ackTarget?.id ?? ''}`}
        subtitle={ackTarget ? `${ackTarget.event_type} · ${ackTarget.machine_name}` : undefined}
        footer={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setAckTarget(null)} disabled={isAcking}>
              Batal
            </Button>
            <Button onClick={handleConfirmAck} isLoading={isAcking}>
              Simpan Acknowledgment
            </Button>
          </div>
        }
      >
        <form onSubmit={handleConfirmAck} className="space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-300 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-200 dark:border-slate-800">
            {ackTarget?.message}
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Catatan Tindak Lanjut (Opsional, maks 500 karakter)
            </label>
            <textarea
              rows={3}
              maxLength={500}
              value={ackNote}
              onChange={(e) => setAckNote(e.target.value)}
              placeholder="Contoh: Tim maintenance telah memeriksa sensor aliran coolant..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
            />
            <div className="text-[11px] text-slate-400 text-right font-tabular mt-0.5">
              {ackNote.length}/500
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
