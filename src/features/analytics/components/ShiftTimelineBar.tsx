import React from 'react';
import { ShiftTimelineSegment } from '../../../types/analytics';
import { MachineFsmState } from '../../../types/monitoring';
import { formatJakartaTime } from '../../../utils/historicalExport';

export const FSM_SEGMENT_COLORS: Record<MachineFsmState, string> = {
  RUNNING: 'bg-emerald-500',
  READY: 'bg-sky-500',
  UNCONFIGURED: 'bg-slate-400',
  PLANNED_DOWNTIME: 'bg-amber-400',
  UNPLANNED_DOWNTIME: 'bg-red-500',
  BATCH_FINISHED: 'bg-indigo-500',
  // E20 P20.5 (FAT-157, D-4): OFFLINE nilai item sah (D-4) — segmen abu-abu.
  OFFLINE: 'bg-zinc-500',
};

export interface ShiftTimelineBarProps {
  timeline: ShiftTimelineSegment[];
  totalTimelineMin: number;
  activeSegmentIdx: number | null;
  onSelectSegment: (idx: number) => void;
  /**
   * E12 T12.12 (X-5 / FAT-58): flag provisional per segmen, diturunkan
   * dari jam hourly yang provisional (lihat `timelineProvisional`) —
   * dihitung di `ShiftTimeline` (dipakai juga untuk panel detail), bukan
   * di sini, supaya satu sumber kebenaran.
   */
  provisionalFlags: boolean[];
}

/**
 * E31 (FAT-277): bar segmen timeline — dipisah dari `ShiftTimeline`
 * (272 baris) mengikuti aturan R8 (satu komponen = satu concern).
 * JSX dan perilaku tidak berubah — hanya dipindah dari komponen induk.
 * Peta warna segmen (`FSM_SEGMENT_COLORS`) tinggal di sini dan dipakai
 * juga oleh legenda di `ShiftTimeline` (satu sumber kebenaran).
 */
export const ShiftTimelineBar: React.FC<ShiftTimelineBarProps> = ({
  timeline,
  totalTimelineMin,
  activeSegmentIdx,
  onSelectSegment,
  provisionalFlags,
}) => {
  return (
    <div className="w-full h-9 rounded overflow-hidden flex border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
      {timeline.map((seg, idx) => {
        const pct = Math.max(1.5, (seg.duration_min / totalTimelineMin) * 100);
        const hasDowntime = Boolean(seg.downtime_id);
        const isSelected = activeSegmentIdx === idx;
        // E12 T12.12 (X-5 / FAT-58): segmen di jam provisional —
        // diturunkan dari hourly, bukan dari field segmen.
        const isProvisional = provisionalFlags[idx] ?? false;
        // E12 T12.11 (X-4 / FAT-59): jam segmen diformat ke WIB —
        // start/end kini ISO 8601 (demo + Real), bukan 'HH:MM' polos.
        const segClock = `${formatJakartaTime(seg.start)}–${formatJakartaTime(seg.end)}`;
        return (
          <button
            key={`${seg.start}-${idx}`}
            type="button"
            onClick={() => onSelectSegment(idx)}
            style={{ width: `${pct}%` }}
            title={`${segClock}: ${seg.fsm_state} (${seg.duration_min} min)${seg.downtime_id ? ` · ${seg.downtime_id}` : ''}${isProvisional ? ' · Provisional' : ''}`}
            className={`${FSM_SEGMENT_COLORS[seg.fsm_state] ?? 'bg-slate-400'} relative h-full border-r border-white/30 last:border-r-0 transition-opacity hover:opacity-90 cursor-pointer focus:outline-none ${
              isSelected ? 'ring-2 ring-inset ring-slate-950 dark:ring-white' : ''
            }`}
          >
            {isProvisional && (
              <span
                aria-hidden="true"
                title="Provisional"
                className="absolute inset-x-0 top-0.5 mx-auto w-1.5 h-1.5 rounded-full bg-amber-300 ring-1 ring-white/70 shadow-xs"
              />
            )}
            {hasDowntime && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0.5 mx-auto w-1.5 h-1.5 rounded-full bg-white shadow-xs"
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
