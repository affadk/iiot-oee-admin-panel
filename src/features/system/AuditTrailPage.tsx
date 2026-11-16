import React, { useMemo, useState } from 'react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { History, RefreshCw, ShieldAlert } from 'lucide-react';
import { AuditLogItem } from '../../types/system';
import { useCapability } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/industrial/DataTable';
import { formatIsoWithOffset } from '../../utils/historicalExport';
import { useHistoryFilters } from '../shared/historyFilters';
import { useSystemAuditQuery } from '../shared/useHistoricalQueries';

export const AuditTrailPage: React.FC = () => {
  const canReadAudit = useCapability('audit.system.read');
  const { filters, isValid, validationErrors, updateFilters, resetFilters } = useHistoryFilters({
    limit: 20,
  });

  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const activeCursor = cursorStack[cursorStack.length - 1];

  const auditQuery = useSystemAuditQuery(filters, activeCursor, canReadAudit.canInteract && isValid);

  const logs = auditQuery.data?.data ?? [];
  const pagination = auditQuery.data?.pagination;

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

  const columns = useMemo<ColumnDef<AuditLogItem, unknown>[]>(
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
        id: 'actor',
        header: 'Aktor & Mode',
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="text-xs">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {item.operator_name}
              </div>
              <div className="text-[11px] font-tabular text-slate-400">
                {item.operator_id || 'SYSTEM'} · {item.access_mode}
              </div>
            </div>
          );
        },
      },
      {
        id: 'action',
        header: 'Aksi & Resource',
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="text-xs">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                <History className="w-3.5 h-3.5 shrink-0" />
                <span>{item.action}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                <Badge variant="neutral">{item.resource_type}</Badge>
                <span className="font-tabular">{item.resource_id}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'details',
        header: 'Detail',
        cell: ({ row }) => (
          <span className="text-xs text-slate-700 dark:text-slate-300 block max-w-md">
            {row.original.details}
          </span>
        ),
      },
      {
        id: 'client_ip',
        header: () => <div className="text-right">Client IP</div>,
        cell: ({ row }) => (
          <div className="text-right font-tabular text-xs text-slate-500">
            {row.original.client_ip}
          </div>
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

      {/* Time Filter */}
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
