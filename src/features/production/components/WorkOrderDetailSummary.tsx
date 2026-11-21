import React from 'react';
import { User } from 'lucide-react';
import { WorkOrder } from '../../../types/production';
import { formatDeletedRelationLabel } from '../../../utils/oeeCalculations';
import { formatDateTime } from '../../../utils/formatDate';

// E32.7 (FAT-288): ringkasan identitas + kuantitas WO dipindah dari
// components/WorkOrderDetailModal.tsx — satu presentasi murni atas
// satu WorkOrder (tanpa state, tanpa efek).
export const WorkOrderDetailSummary: React.FC<{ wo: WorkOrder }> = ({ wo }) => {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-200 dark:border-slate-800 text-xs">
        <div>
          <div className="text-slate-400">Status</div>
          <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
            {wo.status}
          </div>
        </div>
        <div>
          <div className="text-slate-400">Mesin</div>
          <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
            {formatDeletedRelationLabel(wo.machine_name, wo.machine_id).label}
          </div>
        </div>
        <div>
          <div className="text-slate-400">Produk</div>
          <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
            {formatDeletedRelationLabel(wo.product_name, wo.product_id).label}
          </div>
        </div>
        <div>
          <div className="text-slate-400">Operator</div>
          <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 flex items-center gap-1">
            <User className="w-3 h-3 text-slate-400" />
            {formatDeletedRelationLabel(wo.operator_name, wo.operator_id).label}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs font-tabular">
        <div className="p-2.5 border border-slate-200 dark:border-slate-800 rounded">
          <span className="text-slate-400 block">Target Qty</span>
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {wo.target_qty ?? wo.target_quantity} pcs
          </span>
        </div>
        {/* E20 P20.5 (FAT-157): `completed_quantity`/`rejected_quantity`
            DIHAPUS dari kontrak WO (§C) — kartu diganti `dispatched_at` /
            `acked_at`; output/reject dibaca dari telemetri/OEE. */}
        <div className="p-2.5 border border-slate-200 dark:border-slate-800 rounded">
          <span className="text-slate-400 block">Dispatched</span>
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {wo.dispatched_at ? formatDateTime(wo.dispatched_at) : '—'}
          </span>
        </div>
        <div className="p-2.5 border border-slate-200 dark:border-slate-800 rounded">
          <span className="text-slate-400 block">Acked</span>
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {wo.acked_at ? formatDateTime(wo.acked_at) : '—'}
          </span>
        </div>
      </div>
    </>
  );
};
