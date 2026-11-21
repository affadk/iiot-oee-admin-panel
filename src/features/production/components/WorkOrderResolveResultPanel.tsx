import React from 'react';
import { WorkOrderResolveResult } from '../../../types/production';

// E32.7 (FAT-288): panel hasil pemeriksaan kesiapan parameter dipindah
// dari components/WorkOrderDetailModal.tsx — satu presentasi murni atas
// satu WorkOrderResolveResult (tanpa state, tanpa efek).
export const WorkOrderResolveResultPanel: React.FC<{ resolveResult: WorkOrderResolveResult }> = ({
  resolveResult,
}) => {
  return (
    <div className="p-3.5 rounded-lg bg-slate-950 text-slate-100 border border-slate-800 space-y-2 text-xs">
      <div className="flex items-center justify-between text-emerald-400 font-semibold">
        <span>Parameter Kesiapan Produksi · {resolveResult.work_order.wo_id}</span>
        <span>SIAP</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-tabular text-[11px]">
        <div>
          <span className="text-slate-400 block">Target per Jam</span>
          <span className="font-bold text-sky-400">
            {/* E23 Batch 4 (FAT-204, N-35): targetPerHour null =
                'tidak diketahui' (bukan 0 pcs/jam). */}
            {resolveResult.work_order.targetPerHour === null
              ? '—'
              : `${resolveResult.work_order.targetPerHour} pcs/jam`}
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
            {/* E23 Batch 4 (FAT-204, N-35): `break` null bila
                spec tidak mengirimnya — tampil '—', bukan
                jadwal fabrikasi kosong. */}
            {resolveResult.work_order.break
              ? `${resolveResult.work_order.break.start}–${resolveResult.work_order.break.end} (${resolveResult.work_order.break.minutes}m)`
              : '—'}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block">Durasi Istirahat</span>
          <span>{resolveResult.work_order.shift_plan.planned_break_min} min</span>
        </div>
      </div>
    </div>
  );
};
