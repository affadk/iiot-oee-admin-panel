import React from 'react';
import { AlertTriangle, Clock, Cpu } from 'lucide-react';
import { WorkOrder, WorkOrderResolveResult } from '../../../types/production';
import { CorrelatedWorkOrderSummary } from '../../shared/historyFilters';
import { formatDateTime } from '../../../utils/formatDate';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { WorkOrderCorrelationPanel } from './WorkOrderCorrelationPanel';
import { WorkOrderDetailSummary } from './WorkOrderDetailSummary';
import { WorkOrderResolveResultPanel } from './WorkOrderResolveResultPanel';

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

// E32.7 (FAT-288): ringkasan identitas/kuantitas → WorkOrderDetailSummary,
// panel hasil pemeriksaan parameter → WorkOrderResolveResultPanel — modal
// ini tinggal orkestrasi: korelasi + alasan batal + error resolve +
// stempel waktu.
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
          <WorkOrderDetailSummary wo={displayedWo} />

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

          {resolveResult && <WorkOrderResolveResultPanel resolveResult={resolveResult} />}

          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-tabular">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {/* E20 P20.5 (FAT-157): `planned_start` null bila tak ada
                  (tanpa fallback) — tampil '—'; `actual_end_at` kanonis. */}
              Planned Start: {displayedWo.planned_start ? formatDateTime(displayedWo.planned_start) : '—'}
              {displayedWo.actual_end_at
                ? ` · Ended: ${formatDateTime(displayedWo.actual_end_at)}`
                : ''}
            </span>
          </div>
        </div>
      )}
    </Modal>
  );
};
