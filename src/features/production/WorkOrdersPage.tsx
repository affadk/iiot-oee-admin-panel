import React, { useState } from 'react';
import { Info, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { ConflictDialog } from '../../components/ui/ConflictDialog';
import { DataTable } from '../../components/industrial/DataTable';
import { useHistoryFilters } from '../shared/historyFilters';
import { useMasterAssetsQuery, useWorkOrdersQuery } from '../shared/useHistoricalQueries';
import { useWorkOrderCorrelation } from './hooks/useWorkOrderCorrelation';
import { useWorkOrderDetail } from './hooks/useWorkOrderDetail';
import { useWorkOrderCancel } from './hooks/useWorkOrderCancel';
import { useWorkOrderColumns } from './components/WorkOrderColumns';
import { WorkOrderFilterBar } from './components/WorkOrderFilterBar';
import { WorkOrderDetailModal } from './components/WorkOrderDetailModal';
import { WorkOrderCancelDialog } from './components/WorkOrderCancelDialog';

export const WorkOrdersPage: React.FC = () => {
  const { checkCapability } = useAuth();

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
  const operators = masterData?.operators ?? [];

  const workOrdersQuery = useWorkOrdersQuery(filters, activeCursor, isValid);
  const workOrders = workOrdersQuery.data?.data ?? [];
  const pagination = workOrdersQuery.data?.pagination;

  const detail = useWorkOrderDetail();
  const cancel = useWorkOrderCancel();
  const { selectedDeviceId, correlationQuery, displayedWo, corrSummary } = useWorkOrderCorrelation(
    detail.selectedWo,
    machines
  );
  const columns = useWorkOrderColumns({
    machines,
    checkCapability,
    onOpenDetail: detail.openDetail,
    onCancelRequest: cancel.requestCancel,
  });

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

      {cancel.feedback && (
        <div
          role={cancel.feedback.type === 'error' ? 'alert' : 'status'}
          className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
            cancel.feedback.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
          }`}
        >
          <span>{cancel.feedback.msg}</span>
          <button
            type="button"
            onClick={cancel.dismissFeedback}
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

      <WorkOrderFilterBar
        filters={filters}
        machines={machines}
        operatorsCount={operators.length}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
      />

      {/* TanStack DataTable */}
      <DataTable
        data={workOrders}
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

      <WorkOrderDetailModal
        displayedWo={displayedWo}
        selectedDeviceId={selectedDeviceId}
        corrSummary={corrSummary}
        isCorrelationLoading={correlationQuery.isLoading}
        resolveResult={detail.resolveResult}
        resolveError={detail.resolveError}
        isResolving={detail.isResolving}
        onPreviewResolve={detail.previewResolve}
        onClose={detail.closeDetail}
      />

      <WorkOrderCancelDialog
        cancelTarget={cancel.cancelTarget}
        cancelReason={cancel.cancelReason}
        onCancelReasonChange={cancel.setCancelReason}
        isCancelling={cancel.isCancelling}
        onConfirm={cancel.confirmCancel}
        onClose={() => cancel.setCancelTarget(null)}
      />

      <ConflictDialog conflict={cancel.conflictState} onClose={cancel.closeConflict} />
    </div>
  );
};
