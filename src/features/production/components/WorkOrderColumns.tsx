import React, { useMemo } from 'react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { Eye, XCircle } from 'lucide-react';
import { Machine } from '../../../types/assets';
import { WorkOrder } from '../../../types/production';
import { formatDeletedRelationLabel } from '../../../utils/oeeCalculations';
import { resolveWorkOrderDeviceId } from '../../shared/historyFilters';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import type { useAuth } from '../../../context/AuthContext';

interface UseWorkOrderColumnsParams {
  machines: Machine[];
  checkCapability: ReturnType<typeof useAuth>['checkCapability'];
  onOpenDetail: (wo: WorkOrder) => void;
  onCancelRequest: (wo: WorkOrder) => void;
}

export function useWorkOrderColumns({
  machines,
  checkCapability,
  onOpenDetail,
  onCancelRequest,
}: UseWorkOrderColumnsParams) {
  return useMemo<ColumnDef<WorkOrder, unknown>[]>(
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
                  onOpenDetail(wo);
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
                    onCancelRequest(wo);
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
}
