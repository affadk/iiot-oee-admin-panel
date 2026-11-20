import React, { useMemo, useState } from 'react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { Download, History, RefreshCw, ShieldAlert } from 'lucide-react';
import { AuditLogItem } from '../../types/system';
import { OPERATIONAL_EVENT_TYPES } from '../../types/monitoring';
import { useCapability } from '../../context/AuthContext';
import { apiClient } from '../../services/api/client';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { DataTable } from '../../components/industrial/DataTable';
import { formatIsoWithOffset, triggerBrowserDownload, withExportAbortTimeout } from '../../utils/historicalExport';
import { formatDateTime } from '../../utils/formatDate';
import { useHistoryFilters } from '../shared/historyFilters';
import { useMasterAssetsQuery, useSystemAuditQuery } from '../shared/useHistoricalQueries';

export const AuditTrailPage: React.FC = () => {
  const canReadAudit = useCapability('access_control.read');
  const { filters, isValid, validationErrors, updateFilters, resetFilters } = useHistoryFilters({
    limit: 20,
  });

  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const activeCursor = cursorStack[cursorStack.length - 1];
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const auditQuery = useSystemAuditQuery(filters, activeCursor, canReadAudit.canInteract && isValid);

  const logs = auditQuery.data?.data ?? [];
  const pagination = auditQuery.data?.pagination;

  const { data: masterData } = useMasterAssetsQuery(canReadAudit.canInteract);
  const machines = masterData?.machines ?? [];
  const machineFilter = filters.machineId || 'ALL';
  const eventTypeFilter = filters.eventType || 'ALL';

  const applyTimeWindow = (nextFrom: string, nextTo: string) => {
    setCursorStack([undefined]);
    const patch: { from?: string; to?: string } = {};
    if (nextFrom) {
      const d = new Date(nextFrom);
      if (!Number.isNaN(d.getTime())) patch.from = formatIsoWithOffset(d);
    }
    if (nextTo) {
      const d = new Date(nextTo);
      if (!Number.isNaN(d.getTime())) patch.to = formatIsoWithOffset(d);
    }
    if (Object.keys(patch).length > 0) {
      updateFilters(patch);
    }
  };

  // E20 P20.4 (FAT-156, O9): ekspor system-audit — filter sama dengan daftar,
  // guard `access_control.read` (D-13), format csv default.
  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const result = await withExportAbortTimeout(undefined, (signal) =>
        apiClient.exportSystemAuditData(
          {
            from: filters.from,
            to: filters.to,
            event_type: eventTypeFilter === 'ALL' ? undefined : eventTypeFilter,
            machine_id: machineFilter === 'ALL' ? undefined : machineFilter,
            format: 'csv',
          },
          signal
        )
      );
      triggerBrowserDownload(result.filename, result.content, result.mimeType);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Gagal mengekspor audit sistem.');
    } finally {
      setIsExporting(false);
    }
  };

  const columns = useMemo<ColumnDef<AuditLogItem, unknown>[]>(
    () => [
      {
        id: 'timestamp',
        header: 'Timestamp',
        cell: ({ row }) => (
          <span className="font-tabular text-xs text-slate-500 whitespace-nowrap">
            {row.original.recorded_at ? formatDateTime(row.original.recorded_at) : '—'}
          </span>
        ),
      },
      {
        id: 'event',
        header: 'Event & Perangkat',
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                <History className="w-3.5 h-3.5 shrink-0" />
                <span>{item.event_type}</span>
              </div>
              <div className="text-[11px] text-slate-500">
                {item.machine_name ?? '[mesin dihapus]'}
                <span className="font-tabular text-slate-400"> · {item.device_id ?? '[dihapus]'}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'ack',
        header: 'Acknowledgment',
        cell: ({ row }) => {
          const item = row.original;
          return item.acknowledged ? (
            <div className="space-y-0.5 text-[11px]">
              <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                {item.acknowledged_by ?? '—'}
              </div>
              {item.acknowledged_at && (
                <div className="text-slate-400 font-tabular">
                  {formatDateTime(item.acknowledged_at)}
                </div>
              )}
              {item.ack_note && (
                <div className="italic text-slate-600 dark:text-slate-300">“{item.ack_note}”</div>
              )}
            </div>
          ) : (
            <Badge variant="warning">Belum Ack</Badge>
          );
        },
      },
      {
        id: 'trigger',
        header: 'Trigger & WO',
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="text-[11px] text-slate-500 space-y-0.5">
              <div className="font-tabular">{item.trigger_source ?? '—'}</div>
              <div className="font-tabular">{item.wo_id ?? '—'}</div>
            </div>
          );
        },
      },
      {
        id: 'details',
        header: 'Detail',
        cell: ({ row }) => (
          <span className="text-xs text-slate-700 dark:text-slate-300 block max-w-md">
            {row.original.description}
          </span>
        ),
      },
    ],
    []
  );

  if (!canReadAudit.canInteract) {
    return (
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold text-sm">
          <ShieldAlert className="w-5 h-5" />
          <span>Akses System Audit Trail Dibatasi</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {canReadAudit.reason ||
            'Riwayat audit sistem hanya dapat dilihat oleh Admin melalui jaringan lokal pabrik.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Riwayat Audit Aktivitas Sistem
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Catatan permanen mutasi sistem, perubahan data master, pengaturan hak akses, dan keamanan perangkat.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={handleExport} isLoading={isExporting}>
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => auditQuery.refetch()}
            isLoading={auditQuery.isFetching}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {exportError && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-xs text-red-900 dark:text-red-200 flex items-center justify-between gap-2"
        >
          <span>{exportError}</span>
          <Button size="sm" variant="ghost" onClick={() => setExportError(null)}>
            Tutup
          </Button>
        </div>
      )}

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

      {/* Time + Audit Filters */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="audit-from" className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
            Dari (From)
          </label>
          <input
            id="audit-from"
            type="datetime-local"
            value={fromInput}
            onChange={(e) => {
              setFromInput(e.target.value);
              applyTimeWindow(e.target.value, toInput);
            }}
            className="px-3 py-1.5 text-xs font-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          />
        </div>
        <div>
          <label htmlFor="audit-to" className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
            Sampai (To)
          </label>
          <input
            id="audit-to"
            type="datetime-local"
            value={toInput}
            onChange={(e) => {
              setToInput(e.target.value);
              applyTimeWindow(fromInput, e.target.value);
            }}
            className="px-3 py-1.5 text-xs font-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          />
        </div>
        {(fromInput || toInput) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFromInput('');
              setToInput('');
              setCursorStack([undefined]);
              resetFilters();
            }}
          >
            Reset Waktu
          </Button>
        )}
        <Select
          id="audit-event-type"
          label="Event Type"
          value={eventTypeFilter}
          onChange={(e) => {
              setCursorStack([undefined]);
              updateFilters({ eventType: e.target.value === 'ALL' ? undefined : e.target.value });
            }}
          options={[{ value: 'ALL', label: 'Semua Event Type' }, ...OPERATIONAL_EVENT_TYPES.map((t) => ({ value: t, label: t }))]}
        />
        <Select
          id="audit-machine"
          label="Mesin"
          value={machineFilter}
          onChange={(e) => {
              setCursorStack([undefined]);
              updateFilters({ machineId: e.target.value === 'ALL' ? undefined : e.target.value });
            }}
          options={[{ value: 'ALL', label: 'Semua Mesin' }, ...machines.map((m) => ({ value: m.machine_id, label: m.machine_id }))]}
        />
      </div>

      <DataTable
        data={logs}
        columns={columns}
        getRowId={(r) => r.id}
        isLoading={auditQuery.isLoading}
        isFetching={auditQuery.isFetching}
        error={auditQuery.error}
        onRetry={() => auditQuery.refetch()}
        dataUpdatedAt={auditQuery.dataUpdatedAt}
        emptyTitle="Tidak ada log audit sistem"
        emptyDescription="Belum ada mutasi sistem yang tercatat pada rentang waktu yang dipilih."
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
    </div>
  );
};
