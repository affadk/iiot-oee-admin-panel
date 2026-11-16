import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Eye,
  XCircle,
  RefreshCw,
  Clock,
  Cpu,
  User,
  Info,
  AlertTriangle,
  Activity,
  ExternalLink,
} from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { WorkOrder, WorkOrderResolveResult } from '../../types/production';
import { ApiError } from '../../types/auth';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { ConflictDialog, ConflictDialogState } from '../../components/ui/ConflictDialog';
import { DataTable } from '../../components/industrial/DataTable';
import { formatDeletedRelationLabel, formatDuration } from '../../utils/oeeCalculations';
import {
  correlateWorkOrderData,
  resolveWorkOrderDeviceId,
  resolveWorkOrderWindow,
  useHistoryFilters,
} from '../shared/historyFilters';
import { useMasterAssetsQuery, useWorkOrdersQuery } from '../shared/useHistoricalQueries';

export const WorkOrdersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { reportForbidden, checkCapability } = useAuth();

  const { filters, isValid, validationErrors, updateFilters, resetFilters } = useHistoryFilters({
    limit: 20,
  });

  // Opaque cursor stack for Back / Next navigation
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const activeCursor = cursorStack[cursorStack.length - 1];

  const handleFilterChange = (patch: Parameters<typeof updateFilters>[0]) => {
    setCursorStack([undefined]);
    updateFilters(patch);
  };

  const handleResetFilters = () => {
    setCursorStack([undefined]);
    resetFilters();
  };

  const { data: masterData } = useMasterAssetsQuery();
  const machines = masterData?.machines ?? [];
  const products = masterData?.products ?? [];
  const operators = masterData?.operators ?? [];

  const workOrdersQuery = useWorkOrdersQuery(filters, activeCursor, isValid);
  const workOrders = workOrdersQuery.data?.data ?? [];
  const pagination = workOrdersQuery.data?.pagination;

  // Detail & Correlation Modal
  const [selectedWo, setSelectedWo] = useState<WorkOrder | null>(null);
  const [resolveResult, setResolveResult] = useState<WorkOrderResolveResult | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  // Cancel Modal + 409 Conflict Dialog
  const [cancelTarget, setCancelTarget] = useState<WorkOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [conflictState, setConflictState] = useState<ConflictDialogState | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const selectedDeviceId = useMemo(
    () => (selectedWo ? resolveWorkOrderDeviceId(selectedWo, machines) : null),
    [selectedWo, machines]
  );

  const selectedWindow = useMemo(
    () => (selectedWo ? resolveWorkOrderWindow(selectedWo) : null),
    [selectedWo]
  );

  // Correlated production data for selected WO
  const correlationQuery = useQuery({
    queryKey: ['wo-correlation', selectedWo?.wo_id, selectedDeviceId, selectedWindow?.from, selectedWindow?.to],
    enabled: Boolean(selectedWo && selectedWindow),
    staleTime: 5_000,
    queryFn: async ({ signal }) => {
      if (!selectedWo || !selectedWindow) return null;
      const freshWo = await apiClient.getWorkOrderById(selectedWo.wo_id, signal).catch(() => selectedWo);

      if (!selectedDeviceId) {
        const opEventsPage = await apiClient.getOperationalEventsPage(
          {
            machine_id: selectedWo.machine_id ?? undefined,
            from: selectedWindow.from,
            to: selectedWindow.to,
            limit: 50,
            envelope: true,
          },
          signal
        );
        return {
          wo: freshWo,
          telemetry: [],
          hourly: [],
          downtimes: [],
          operationalEvents: opEventsPage.data,
          summary: correlateWorkOrderData({
            workOrder: freshWo,
            machines,
            telemetryRecords: [],
            hourlyPoints: [],
            downtimeEvents: [],
            operationalEvents: opEventsPage.data,
          }),
        };
      }

      const [telPage, hourly, dtPage, opPage] = await Promise.all([
        apiClient.getTelemetryHistoryPage(
          {
            device_id: selectedDeviceId,
            from: selectedWindow.from,
            to: selectedWindow.to,
            limit: 100,
            envelope: true,
          },
          signal
        ),
        apiClient.getHourlyTrend(selectedDeviceId, signal).catch(() => []),
        apiClient.getDowntimeHistoryPage(
          {
            device_id: selectedDeviceId,
            from: selectedWindow.from,
            to: selectedWindow.to,
            limit: 50,
            envelope: true,
          },
          signal
        ),
        apiClient.getOperationalEventsPage(
          {
            device_id: selectedDeviceId,
            from: selectedWindow.from,
            to: selectedWindow.to,
            limit: 50,
            envelope: true,
          },
          signal
        ),
      ]);

      return {
        wo: freshWo,
        telemetry: telPage.data,
        hourly,
        downtimes: dtPage.data,
        operationalEvents: opPage.data,
        summary: correlateWorkOrderData({
          workOrder: freshWo,
          machines,
          telemetryRecords: telPage.data,
          hourlyPoints: hourly,
          downtimeEvents: dtPage.data,
          operationalEvents: opPage.data,
        }),
      };
    },
  });

  const handleOpenDetail = (wo: WorkOrder) => {
    setSelectedWo(wo);
    setResolveResult(null);
    setResolveError(null);
  };

  const handlePreviewResolve = async (wo: WorkOrder) => {
    if (isResolving) return;
    setIsResolving(true);
    setResolveError(null);
    try {
      const res = await apiClient.resolveWorkOrder(wo.wo_id);
      setResolveResult(res);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal melakukan resolve Work Order (periksa status online perangkat edge).';
      setResolveError(msg);
    } finally {
      setIsResolving(false);
    }
  };

  const handleCancelWorkOrder = async () => {
    if (!cancelTarget || isCancelling) return;
    setIsCancelling(true);
    setFeedback(null);
    try {
      const res = await apiClient.cancelWorkOrder(cancelTarget.wo_id, cancelReason.trim() || undefined);
      setFeedback({
        type: 'success',
        msg: `Work Order ${res.work_order.wo_id} berhasil dibatalkan (ABORTED).`,
      });
      setCancelTarget(null);
      setCancelReason('');
      await queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('work_order.cancel', cancelTarget.wo_id, err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 409) {
        setCancelTarget(null);
        setConflictState({
          open: true,
          code: err.code,
          title: 'Konflik Pembatalan Work Order (409)',
          message: err.message,
          activeWoId: err.activeWoId,
        });
        return;
      }
      setFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Gagal membatalkan Work Order.',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const columns = useMemo<ColumnDef<WorkOrder, unknown>[]>(
    () => [
      {
        id: 'wo_id',
        header: 'WO / Batch',
        cell: ({ row }) => {
          const wo = row.original;
          return (
            <div className="font-tabular">
              <div className="font-semibold text-slate-900 dark:text-slate-100">{wo.wo_id}</div>
              <div className="text-[11px] text-slate-500">
                {wo.order_number} · {wo.shift_name}
              </div>
            </div>
          );
        },
      },
      {
        id: 'product',
        header: 'Produk',
        cell: ({ row }) => {
          const wo = row.original;
          const prodLbl = formatDeletedRelationLabel(wo.product_name, wo.product_id);
          return (
            <div className="text-xs">
              <div
                className={
                  prodLbl.isDeleted
                    ? 'italic text-amber-700 dark:text-amber-400 font-medium'
                    : 'font-medium text-slate-800 dark:text-slate-200'
                }
              >
                {prodLbl.label}
              </div>
              <div className="text-[11px] font-tabular text-slate-400">{wo.product_id || '—'}</div>
            </div>
          );
        },
      },
      {
        id: 'machine',
        header: 'Mesin / Device',
        cell: ({ row }) => {
          const wo = row.original;
          const machLbl = formatDeletedRelationLabel(wo.machine_name, wo.machine_id);
          const devId = resolveWorkOrderDeviceId(wo, machines);
          return (
            <div className="text-xs">
              <div
                className={
                  machLbl.isDeleted
                    ? 'italic text-amber-700 dark:text-amber-400 font-medium'
                    : 'text-slate-800 dark:text-slate-200'
                }
              >
                {machLbl.label}
              </div>
              <div className="text-[11px] font-tabular text-slate-400">
                {wo.machine_id || '—'} {devId ? `· ${devId}` : ''}
              </div>
            </div>
          );
        },
      },
      {
        id: 'operator',
        header: 'Operator',
        cell: ({ row }) => {
          const wo = row.original;
          const opLbl = formatDeletedRelationLabel(wo.operator_name, wo.operator_id);
          return (
            <div className="text-xs">
              <div
                className={
                  opLbl.isDeleted
                    ? 'italic text-amber-700 dark:text-amber-400 font-medium'
                    : 'text-slate-800 dark:text-slate-200'
                }
              >
                {opLbl.label}
              </div>
              <div className="text-[11px] font-tabular text-slate-400">{wo.operator_id || '—'}</div>
            </div>
          );
        },
      },
      {
        id: 'output',
        header: 'Output / Target',
        cell: ({ row }) => {
          const wo = row.original;
          const target = wo.target_qty ?? wo.target_quantity;
          return (
            <div className="text-right font-tabular text-xs">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {wo.completed_quantity} / {target}
              </div>
              <div className="text-[11px] text-red-500">Reject: {wo.rejected_quantity}</div>
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const wo = row.original;
          return (
            <Badge
              variant={
                wo.status === 'ACTIVE'
                  ? 'success'
                  : wo.status === 'PENDING'
                  ? 'warning'
                  : wo.status === 'ABORTED'
                  ? 'danger'
                  : 'neutral'
              }
            >
              {wo.status}
            </Badge>
          );
        },
      },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => {
          const wo = row.original;
          const isCancellable = wo.status === 'PENDING' || wo.status === 'ACTIVE';
          const rowCancelCap = checkCapability('work_order.cancel', wo.wo_id);
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenDetail(wo);
                }}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Detail &amp; Korelasi</span>
              </Button>
              {isCancellable && rowCancelCap.canInteract && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCancelTarget(wo);
                    setCancelReason('');
                  }}
                  title="Batalkan Work Order (Khusus Admin di Jaringan Lokal)"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [machines, checkCapability]
  );

  const visibleWorkOrders = useMemo(() => {
    const prodFilter = products.length > 0 ? undefined : undefined;
    void prodFilter;
    return workOrders;
  }, [workOrders, products.length]);

  const displayedWo = correlationQuery.data?.wo ?? selectedWo;
  const corrSummary = correlationQuery.data?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Work Order Registry &amp; Production Correlation
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Daftar sesi Work Order, korelasi hasil produksi mesin &amp; downtime per jendela waktu sesi, pemeriksaan parameter, dan pembatalan administratif.
          </p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => workOrdersQuery.refetch()}
          isLoading={workOrdersQuery.isFetching}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Info Banner about HMI Boundary */}
      <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 text-xs text-sky-900 dark:text-sky-200 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
        <span>
          <strong>Pembagian Tugas &amp; Preservasi Histori:</strong> Pembuatan dan dispatch Work Order dilakukan di HMI lantai produksi. Master data yang telah dihapus tetap tampil sebagai{' '}
          <span className="font-mono">[dihapus] (ID)</span> agar jejak audit produksi tetap utuh.
        </span>
      </div>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
            feedback.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
          }`}
        >
          <span>{feedback.msg}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Tutup pesan status"
            className="font-bold px-1.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {!isValid && (
        <div
          role="alert"
          className="p-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2"
        >
          <span>
            Filter URL tidak valid: {Object.values(validationErrors).join(' · ')}
          </span>
          <Button size="sm" variant="secondary" onClick={handleResetFilters}>
            Reset Filter
          </Button>
        </div>
      )}

      {/* URL-Synced Server Filter Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            aria-label="Cari Work Order ID"
            value={filters.woId ?? ''}
            onChange={(e) => handleFilterChange({ woId: e.target.value || undefined })}
            placeholder="Filter WO ID (mis. WO-2026-101)"
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <select
          aria-label="Filter Status"
          value={filters.status ?? 'ALL'}
          onChange={(e) =>
            handleFilterChange({
              status: e.target.value === 'ALL' ? undefined : (e.target.value as WorkOrder['status']),
            })
          }
          className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
        >
          <option value="ALL">Semua Status</option>
          <option value="PENDING">PENDING</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="ABORTED">ABORTED</option>
        </select>

        <select
          aria-label="Filter Mesin"
          value={filters.machineId ?? 'ALL'}
          onChange={(e) =>
            handleFilterChange({
              machineId: e.target.value === 'ALL' ? undefined : e.target.value,
            })
          }
          className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
        >
          <option value="ALL">Semua Mesin</option>
          {machines.map((m) => (
            <option key={m.machine_id} value={m.machine_id}>
              {m.machine_id} · {m.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Limit Baris"
          value={String(filters.limit)}
          onChange={(e) => handleFilterChange({ limit: Number(e.target.value) || 20 })}
          className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 font-tabular"
        >
          <option value="10">10 baris / halaman</option>
          <option value="20">20 baris / halaman</option>
          <option value="50">50 baris / halaman</option>
          <option value="100">100 baris / halaman</option>
        </select>

        <div className="flex items-center justify-end gap-2">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {operators.length > 0 ? `${operators.length} operator aktif` : 'Mode ringkas'}
          </span>
          <Button size="sm" variant="ghost" onClick={handleResetFilters}>
            Reset
          </Button>
        </div>
      </div>

      {/* TanStack DataTable */}
      <DataTable
        data={visibleWorkOrders}
        columns={columns}
        getRowId={(row) => row.wo_id}
        isLoading={workOrdersQuery.isLoading}
        isFetching={workOrdersQuery.isFetching}
        error={workOrdersQuery.error}
        onRetry={() => workOrdersQuery.refetch()}
        dataUpdatedAt={workOrdersQuery.dataUpdatedAt}
        emptyTitle="Tidak ada Work Order"
        emptyDescription="Tidak ada sesi Work Order yang cocok dengan filter status, mesin, atau rentang waktu aktif."
        emptyActionLabel="Reset Filter"
        onEmptyAction={handleResetFilters}
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
          onPrevPage: () => {
            setCursorStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
          },
          onResetPage: () => setCursorStack([undefined]),
        }}
      />

      {/* Detail, Korelasi Sesi & /resolve Modal */}
      <Modal
        isOpen={Boolean(displayedWo)}
        onClose={() => {
          setSelectedWo(null);
          setResolveResult(null);
          setResolveError(null);
        }}
        title={displayedWo ? `Work Order ${displayedWo.wo_id}` : 'Detail Work Order'}
        subtitle={
          displayedWo
            ? `${displayedWo.order_number} · ${displayedWo.shift_name}`
            : undefined
        }
        maxWidth="3xl"
        footer={
          displayedWo && (
            <div className="flex items-center justify-between w-full">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handlePreviewResolve(displayedWo)}
                isLoading={isResolving}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Periksa Kesiapan Parameter</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedWo(null)}>
                Tutup
              </Button>
            </div>
          )
        }
      >
        {displayedWo && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <div className="text-slate-400">Status</div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {displayedWo.status}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Mesin</div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {formatDeletedRelationLabel(displayedWo.machine_name, displayedWo.machine_id).label}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Produk</div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {formatDeletedRelationLabel(displayedWo.product_name, displayedWo.product_id).label}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Operator</div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" />
                  {formatDeletedRelationLabel(displayedWo.operator_name, displayedWo.operator_id).label}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs font-tabular">
              <div className="p-2.5 border border-slate-200 dark:border-slate-800 rounded">
                <span className="text-slate-400 block">Target Qty</span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {displayedWo.target_qty ?? displayedWo.target_quantity} pcs
                </span>
              </div>
              <div className="p-2.5 border border-slate-200 dark:border-slate-800 rounded">
                <span className="text-slate-400 block">Good Output</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {displayedWo.completed_quantity} pcs
                </span>
              </div>
              <div className="p-2.5 border border-slate-200 dark:border-slate-800 rounded">
                <span className="text-slate-400 block">Rejects</span>
                <span className="text-sm font-bold text-red-600 dark:text-red-400">
                  {displayedWo.rejected_quantity} pcs
                </span>
              </div>
            </div>

            {/* Work Order Correlation Panel */}
            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <Activity className="w-4 h-4 text-sky-500" />
                  <span>Korelasi Telemetri, Downtime &amp; Audit Sesi Produksi</span>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  {displayedWo.machine_id ?? '—'} → {selectedDeviceId ?? 'Perangkat tidak terikat'}
                </span>
              </div>

              {correlationQuery.isLoading ? (
                <div className="h-16 rounded bg-slate-200/70 dark:bg-slate-800 animate-pulse" />
              ) : corrSummary ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-tabular">
                    <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Sampel Telemetri</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {corrSummary.telemetrySampleCount} rekaman
                      </span>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Rata-rata OEE Window</span>
                      <span className="font-bold text-sky-600 dark:text-sky-400">
                        {corrSummary.avgOeePct !== null ? `${corrSummary.avgOeePct}%` : '—'}
                      </span>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Downtime Sesi</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {corrSummary.downtimeCount} insiden ({formatDuration(corrSummary.totalDowntimeSec)})
                      </span>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Event Audit</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {corrSummary.operationalEventCount} kejadian
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    <strong>Catatan Metrik:</strong> <code className="font-mono">live-state</code>{' '}
                    menampilkan angka kumulatif lifetime perangkat, sedangkan ringkasan sesi ini hanya mengorelasikan data dalam jendela WO (
                    {new Date(corrSummary.window.from).toLocaleString()} –{' '}
                    {new Date(corrSummary.window.to).toLocaleString()}).
                    {corrSummary.provisionalHourlyCount > 0 &&
                      ` Terdapat ${corrSummary.provisionalHourlyCount} bucket per jam yang masih berstatus provisional.`}
                  </p>

                  {selectedDeviceId && (
                    <div className="flex flex-wrap items-center gap-3 text-[11px] pt-1">
                      <Link
                        to={`/telemetry?device_id=${encodeURIComponent(selectedDeviceId)}&from=${encodeURIComponent(corrSummary.window.from)}&to=${encodeURIComponent(corrSummary.window.to)}`}
                        className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline font-medium"
                      >
                        <span>Lihat Telemetri Sesi</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                      <span aria-hidden="true">·</span>
                      <Link
                        to={`/downtime?device_id=${encodeURIComponent(selectedDeviceId)}&from=${encodeURIComponent(corrSummary.window.from)}&to=${encodeURIComponent(corrSummary.window.to)}`}
                        className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline font-medium"
                      >
                        <span>Lihat Downtime Sesi</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                      <span aria-hidden="true">·</span>
                      <Link
                        to={`/audit?device_id=${encodeURIComponent(selectedDeviceId)}&from=${encodeURIComponent(corrSummary.window.from)}&to=${encodeURIComponent(corrSummary.window.to)}`}
                        className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline font-medium"
                      >
                        <span>Lihat Audit Operasional</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {displayedWo.cancel_reason && (
              <div className="p-2.5 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-200">
                <strong>Alasan Pembatalan:</strong> {displayedWo.cancel_reason}
              </div>
            )}

            {resolveError && (
              <div
                role="alert"
                className="p-3 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Pemeriksaan Parameter Belum Tersedia</div>
                  <p>{resolveError}</p>
                </div>
              </div>
            )}

            {resolveResult && (
              <div className="p-3.5 rounded-lg bg-slate-950 text-slate-100 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-emerald-400 font-semibold">
                  <span>Parameter Kesiapan Produksi · {resolveResult.work_order.wo_id}</span>
                  <span>SIAP</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-tabular text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Target per Jam</span>
                    <span className="font-bold text-sky-400">
                      {resolveResult.work_order.targetPerHour} pcs/jam
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Waktu Siklus Standar</span>
                    <span className="font-bold">{resolveResult.work_order.std_cycle_time_sec} dtk</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Durasi Operasi Rencana</span>
                    <span className="font-bold">
                      {resolveResult.work_order.shift_plan.planned_operating_sec} dtk
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Jadwal Shift</span>
                    <span>
                      {resolveResult.work_order.shift_plan.shift_start}–
                      {resolveResult.work_order.shift_plan.shift_end}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Jadwal Istirahat</span>
                    <span>
                      {resolveResult.work_order.break.start}–{resolveResult.work_order.break.end} (
                      {resolveResult.work_order.break.minutes}m)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Durasi Istirahat</span>
                    <span>{resolveResult.work_order.shift_plan.planned_break_min} min</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-tabular">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Planned Start: {new Date(displayedWo.planned_start).toLocaleString()}
                {displayedWo.actual_end
                  ? ` · Ended: ${new Date(displayedWo.actual_end).toLocaleString()}`
                  : ''}
              </span>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel Work Order Confirmation */}
      <ConfirmationDialog
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelWorkOrder}
        title={`Batalkan Work Order ${cancelTarget?.wo_id ?? ''}?`}
        variant="destructive"
        description={`Aksi ini akan membatalkan Work Order ${cancelTarget?.wo_id} (status menjadi Dibatalkan / ABORTED) dan membebaskan mesin terkait agar dapat digunakan kembali.`}
        impacts={[
          'Hanya dapat dilakukan oleh ADMIN dari jaringan lokal pabrik.',
          'Work Order yang sudah selesai atau dibatalkan tidak dapat dibatalkan ulang.',
        ]}
        confirmLabel="Ya, Batalkan WO"
        isLoading={isCancelling}
      >
        <Input
          label="Alasan Pembatalan (Opsional, maks 500 karakter)"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Contoh: Revisi jadwal material dari PPIC"
          maxLength={500}
        />
      </ConfirmationDialog>

      <ConflictDialog conflict={conflictState} onClose={() => setConflictState(null)} />
    </div>
  );
};
