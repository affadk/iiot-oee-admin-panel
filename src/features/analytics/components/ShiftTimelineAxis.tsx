import React from 'react';
import { ShiftTimelineSegment } from '../../../types/analytics';
import { buildTimelineAxisTicks } from '../timelineAxis';

export interface ShiftTimelineAxisProps {
  timeline: ShiftTimelineSegment[];
  /**
   * E12 T12.11 (X-4 / FAT-59): tanggal jangkar = tanggal kalender
   * shift_start summary (Jakarta); tanpa summary, segmen 'HH:MM' lama
   * tetap berlabel jam saja.
   */
  anchorDate: string | null;
}

/**
 * E31 (FAT-277): sumbu waktu Asia/Jakarta di bawah bar timeline —
 * dipisah dari `ShiftTimeline` (272 baris) mengikuti aturan R8 (satu
 * komponen = satu concern). JSX dan perilaku tidak berubah — hanya
 * dipindah dari komponen induk (tick dihitung dari start/end segmen).
 */
export const ShiftTimelineAxis: React.FC<ShiftTimelineAxisProps> = ({ timeline, anchorDate }) => {
  // E12 T12.11 (X-4 / FAT-59): sumbu waktu dari start/end segmen dalam
  // Asia/Jakarta — timeline bisa dibaca jamnya tanpa membuka tooltip.
  const axis = buildTimelineAxisTicks(timeline, anchorDate);
  if (axis.ticks.length === 0) {
    return null;
  }
  return (
    <div className="space-y-0.5">
      <div
        className="relative h-5"
        role="img"
        aria-label={`Sumbu waktu Asia/Jakarta: ${axis.ticks[0].label} sampai ${axis.ticks[axis.ticks.length - 1].label}`}
      >
        {axis.ticks.map((tick) => (
          <span
            key={tick.ms}
            className="absolute top-0 text-[10px] font-tabular text-slate-500 dark:text-slate-400 whitespace-nowrap"
            style={{
              left: `${tick.pct}%`,
              transform:
                tick.pct <= 0 ? 'translateX(0)' : tick.pct >= 100 ? 'translateX(-100%)' : 'translateX(-50%)',
            }}
          >
            {tick.label}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-right">
        Semua waktu Asia/Jakarta (WIB)
      </p>
    </div>
  );
};
