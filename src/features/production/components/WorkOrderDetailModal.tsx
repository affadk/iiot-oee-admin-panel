import React from 'react';
import { AlertTriangle, Clock, Cpu, User } from 'lucide-react';
import { WorkOrder, WorkOrderResolveResult } from '../../../types/production';
import { CorrelatedWorkOrderSummary } from '../../shared/historyFilters';
import { formatDeletedRelationLabel } from '../../../utils/oeeCalculations';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { WorkOrderCorrelationPanel } from './WorkOrderCorrelationPanel';

interface WorkOrderDetailModalProps {
  displayedWo: WorkOrder | null;
  selectedDeviceId: string | null;
  corrSummary: CorrelatedWorkOrderSummary | undefined;
  isCorrelationLoading: boolean;
  resolveResult: WorkOrderResolveResult | null;
  resolveError: string | null;
  isResolving: boolean;
  onPreviewResolve: (wo: WorkOrder, deviceId?: string) => void;
  onClose: () => void;
}

export const WorkOrderDetailModal: React.FC<WorkOrderDetailModalProps> = ({
  displayedWo,
  selectedDeviceId,
  corrSummary,
  isCorrelationLoading,
  resolveResult,
  resolveError,
  isResolving,
  onPreviewResolve,
  onClose,
}) => {
  return (
    <Modal
      isOpen={Boolean(displayedWo)}
      onClose={onClose}
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
              onClick={() => onPreviewResolve(displayedWo, selectedDeviceId ?? undefined)}
              isLoading={isResolving}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Periksa Kesiapan Parameter</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
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
            {/* E20 P20.5 (FAT-157): `completed_quantity`/`rejected_quantity`
                DIHAPUS dari kontrak WO (§C) — kartu diganti `dispatched_at` /
                `acked_at`; output/reject dibaca dari telemetri/OEE. */}
            <div className="p-2.5 border border-slate-200 dark:border-slate-800 rounded">
              <span className="text-slate-400 block">Dispatched</span>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {displayedWo.dispatched_at ? new Date(displayedWo.dispatched_at).toLocaleString() : '—'}
              </span>
            </div>
            <div className="p-2.5 border border-slate-200 dark:border-slate-800 rounded">
              <span className="text-slate-400 block">Acked</span>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {displayedWo.acked_at ? new Date(displayedWo.acked_at).toLocaleString() : '—'}
              </span>
            </div>
          </div>

          <WorkOrderCorrelationPanel
            displayedWo={displayedWo}
            selectedDeviceId={selectedDeviceId}
            corrSummary={corrSummary}
            isLoading={isCorrelationLoading}
          />

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
              {/* E20 P20.5 (FAT-157): `planned_start` null bila tak ada
                  (tanpa fallback) — tampil '—'; `actual_end_at` kanonis. */}
              Planned Start: {displayedWo.planned_start ? new Date(displayedWo.planned_start).toLocaleString() : '—'}
              {displayedWo.actual_end_at
                ? ` · Ended: ${new Date(displayedWo.actual_end_at).toLocaleString()}`
                : ''}
            </span>
          </div>
        </div>
      )}
    </Modal>
  );
};
